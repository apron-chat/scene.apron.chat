/**
 * A scene: an Apron archive (apron-web's ARCHIVE.md, version 1) compiled into
 * a replay: a fixed stream of frames that a connection is sent as it signs
 * in, so that a client has the whole scene without asking for any of it.
 *
 * A connection opens with the `server` frame. Its `auth`, which every client
 * sends, is answered with the reader, allowed only to read, followed by a
 * `room_update` with every room the reader joined (records, members, and
 * users), then every record of the scene as the live delivery a member would
 * have seen, in `log_id` order.
 *
 * The server advertises `rooms` but not `history`: a client then pages nothing,
 * and shows what arrived live, which is all of it. What a client must still ask
 * is answered from strings worked out here, once: `auth`, whose reply needs the
 * request's `id`, and `room_list`, which a client with `rooms` sends after it,
 * in a few shapes, all listed in `replies`. Only the `id` is written in.
 *
 * This runs at build time (`compileScene`), so the Worker serves strings and
 * parses nothing. Scenes are files in this repository, checked by the build
 * and by `npm test`, not uploads: this trusts their shape, and clients decode
 * every record as untrusted anyway (PROTOCOL.md §5.4).
 */

export type Json = Record<string, unknown>;

/** The archive version this reads (ARCHIVE.md §2). */
export const ARCHIVE_VERSION = 1;

/** The protocol version this serves. */
export const APRON_VERSION = 10;

/**
 * The origin that scenes' own media is written with: `https://scene.apron.chat/<name>/<file>`. Served from another
 * host, such as `wrangler dev` or a Preview, it is rewritten to that host's (`src/scenes.ts`).
 */
export const CANONICAL_ORIGIN = "https://scene.apron.chat";

/**
 * What it advertises: rooms to list and read, nothing to write with (ARCHIVE.md §4). Not `history`: everything
 * has been sent, so there is nothing to page.
 */
export const CAPABILITIES = ["rooms", "reactions", "ext:settings", "ext:permissions", "ext:archive"];

export interface Room {
	/** The room record, without delivery fields. */
	record: Json & { room_id: string };
	joined: boolean;
	members: string[];
	/** The room's listing, as `room_list` and `room_update` carry it, with members. */
	listing: Json;
}

export interface Scene {
	title?: string;
	/** Sent as a connection opens. */
	server: string;
	/** Sent after the reply to a guest `auth`: the whole scene. */
	pushed: string[];
	/** The `result` of a guest `auth`: who reads, allowed only to read. */
	auth: string;
	/** The `result` of each `room_list` a client may send, by `roomListKey`. */
	replies: Map<string, string>;
	you: Json;
	rooms: Map<string, Room>;
	users: Map<string, Json>;
}

/** A scene as the Worker serves it: built by `compileScene` from its file, at build time (`scripts/build.mjs`). */
export interface CompiledScene {
	title?: string;
	server: string;
	auth: string;
	pushed: string[];
	/** The `result` of each `room_list`, by `roomListKey`. */
	replies: Record<string, string>;
}

/** Compiles a scene's JSON Lines into the strings it is served as. Throws `SceneError` for a file that isn't one. */
export function compileScene(text: string): CompiledScene {
	const { title, server, auth, pushed, replies } = parseScene(text);
	return { ...(title !== undefined ? { title } : {}), server, auth, pushed, replies: Object.fromEntries(replies) };
}

/** Why a file isn't a scene this reads. */
export class SceneError extends Error {}

/** Who reads a scene whose header has no `you`. */
const VIEWER: Json = { user_id: "viewer", name: "Viewer" };

const DELIVERY = ["latest_log_id", "history_log_id", "members", "member_count"];

/** Compares `log_id`s as numbers (PROTOCOL.md §2.1). */
export function compareLogIds(a: string, b: string): number {
	return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
}

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const isLogId = (value: unknown): value is string => typeof value === "string" && /^[1-9][0-9]{0,15}$/.test(value);
const isId = (value: unknown): value is string => typeof value === "string" && value !== "" && !/[\s\p{Cc}]/u.test(value);

/**
 * Which `room_list` a request is (PROTOCOL.md §4.2.1), by the filters that change its result: `filter`, `members`,
 * and `room_id` or else `parent_room_id`. `user_id` and `latest_log_id` are filters a server MAY ignore, and this
 * one does. Undefined for a room the scene doesn't list.
 */
export function roomListKey(params: Json): string {
	const filter = params.filter === "joined" || params.filter === "not_joined" ? params.filter : "all";
	const scope = typeof params.room_id === "string" ? `room:${params.room_id}` : typeof params.parent_room_id === "string" ? `parent:${params.parent_room_id}` : "";
	return `${filter} ${params.members === true ? "members" : "-"} ${scope}`;
}

/** Reads a scene from its JSON Lines. Throws `SceneError` for a file that isn't one. */
export function parseScene(text: string): Scene {
	const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "").map(parseLine);
	const header = lines[0];
	if (!header || !Object.hasOwn(header, "apron_archive")) throw new SceneError("The first line isn't an Apron archive header.");
	if (header.apron_archive !== ARCHIVE_VERSION) throw new SceneError(`Archive version ${String(header.apron_archive)} isn't one this reads.`);

	const users = new Map<string, Json>();
	const listed = new Map<string, { listing: Json; joined: boolean }>();
	const records: { log: string; kind: "rooms" | "messages" | "reactions" | "memberships"; record: Json }[] = [];
	for (const line of lines.slice(1)) {
		if (!line) continue;
		const each = (key: string, read: (value: Json) => void) => {
			if (Array.isArray(line[key])) for (const value of line[key]) if (isObject(value)) read(value);
		};
		// A later listing of a room replaces an earlier one, and a later user object an earlier one (ARCHIVE.md §3).
		each("joined", (room) => isId(room.room_id) && listed.set(room.room_id, { listing: room, joined: true }));
		each("not_joined", (room) => isId(room.room_id) && listed.set(room.room_id, { listing: room, joined: false }));
		each("users", (user) => isId(user.user_id) && users.set(user.user_id, withoutStatus(user)));
		for (const kind of ["rooms", "messages", "reactions", "memberships"] as const) {
			each(kind, (record) => {
				if (isLogId(record.log_id)) records.push({ log: record.log_id, kind, record });
			});
		}
	}
	records.sort((a, b) => compareLogIds(a.log, b.log));

	// Each room's latest record: what it is listed as.
	const latestRecord = new Map<string, Json>();
	for (const { kind, record } of records) if (kind === "rooms" && isId(record.room_id)) latestRecord.set(record.room_id, withoutDelivery(record));

	const rooms = new Map<string, Room>();
	for (const [id, { listing, joined }] of listed) {
		const record = { ...(latestRecord.get(id) ?? withoutDelivery(listing)), room_id: id };
		const members = Array.isArray(listing.members) ? listing.members.filter(isObject).map((member) => member.user_id).filter(isId) : [];
		rooms.set(id, {
			record,
			joined,
			members,
			listing: {
				...record,
				...(isLogId(listing.latest_log_id) ? { latest_log_id: listing.latest_log_id } : {}),
				members: members.map((user_id) => ({ user_id })),
				...(typeof listing.member_count === "number" ? { member_count: listing.member_count } : {}),
			},
		});
	}

	// Each message's latest snapshot: what a reply to it embeds (PROTOCOL.md §3.5.4), so a quote shows whether or not
	// its message is in a room the scene lists.
	const latest = new Map<string, Json>();
	for (const { kind, record } of records) if (kind === "messages" && isId(record.message_id)) latest.set(record.message_id, record);
	const withReply = (message: Json): Json => {
		const to = isObject(message.reply_to) ? latest.get(message.reply_to.message_id as string) : undefined;
		if (!to || to.message_id === message.message_id) return message;
		const { reply_to: nested, ...target } = to;
		return { ...message, reply_to: isObject(nested) ? { ...target, reply_to: { message_id: nested.message_id } } : target };
	};
	// A message's room, for its reactions: a reaction is in the room its message is in (ARCHIVE.md §4).
	const roomOf = (record: Json): unknown => (record.room_id !== undefined ? record.room_id : latest.get(record.message_id as string)?.room_id);

	const media = Array.isArray(header.media) ? header.media.filter((origin): origin is string => typeof origin === "string") : [];
	const archive = { ...(typeof header.server === "string" ? { server: header.server } : {}), ...(typeof header.exported_at === "string" ? { exported_at: header.exported_at } : {}) };
	// Bios show only with `ext:bio` (EXTENSIONS.md): advertised when a user has one.
	const bios = [...users.values()].some((user) => isObject(user.ext) && typeof user.ext.bio === "string");
	const look = Object.fromEntries((["title", "description", "avatar"] as const).filter((key) => typeof header[key] === "string").map((key) => [key, header[key] as string]));
	const server = {
		method: "server",
		params: {
			apron: APRON_VERSION,
			agent: "apron-scene/1",
			auth: ["guest"],
			// No `ping`: a client then sends none (PROTOCOL.md §1). A scene is read and left, and an idle connection
			// costs nothing, so nothing needs to know it is still there.
			...look,
			capabilities: [...CAPABILITIES, ...(media.length ? ["ext:media"] : []), ...(bios ? ["ext:bio"] : [])],
			ext: { settings: { read_cursors: false }, archive, ...(media.length ? { media: { origins: media } } : {}) },
		},
	};
	const you = readOnly(isObject(header.you) && isId(header.you.user_id) ? withoutStatus(header.you) : VIEWER);

	// A sign-in's deliveries come after its `auth` result (PROTOCOL.md §3.2.2); a client that got them earlier
	// would take them for another connection's. Every listed room's records go, those of rooms not joined too: a
	// client accepts a record at any time (§3.5.3).
	const joined = [...rooms.values()].filter((room) => room.joined);
	const pushed = [
		JSON.stringify({ method: "room_update", params: { joined: joined.map((room) => room.listing), users: [...users.values()] } }),
		...records
			.filter(({ kind, record }) => kind !== "rooms" && rooms.has((kind === "reactions" ? roomOf(record) : record.room_id) as string))
			.map(({ kind, record }) => {
				if (kind === "messages") return JSON.stringify({ method: "message", params: withReply(record) });
				if (kind === "reactions") return JSON.stringify({ method: "reactions", params: record });
				return JSON.stringify({ method: "room_update", params: { memberships: [record] } });
			}),
	];

	// Every `room_list` there is, by its key.
	const replies = new Map<string, string>();
	const scopes: Json[] = [{}, ...[...rooms.keys()].flatMap((id) => [{ room_id: id }, { parent_room_id: id }])];
	for (const scope of scopes) {
		for (const filter of ["all", "joined", "not_joined"]) {
			for (const members of [false, true]) {
				const params = { ...scope, filter, members };
				replies.set(roomListKey(params), JSON.stringify(listRooms(rooms, users, params)));
			}
		}
	}

	return { ...(look.title ? { title: look.title } : {}), server: JSON.stringify(server), pushed, auth: JSON.stringify({ you }), replies, you, rooms, users };
}

/** `room_list` (PROTOCOL.md §4.2.1): the scene's rooms, as `you` joined them. */
function listRooms(rooms: Map<string, Room>, users: Map<string, Json>, params: Json): Json {
	const parent = typeof params.parent_room_id === "string" ? params.parent_room_id : undefined;
	const exact = typeof params.room_id === "string" ? params.room_id : undefined;
	const withMembers = params.members === true;
	const matching = [...rooms.values()].filter((room) => (exact !== undefined ? room.record.room_id === exact : parent !== undefined ? room.record.parent_room_id === parent : true));
	const listing = (room: Room): Json => {
		if (withMembers) return room.listing;
		const { members: _members, member_count: _count, ...rest } = room.listing;
		return rest;
	};
	const joined = matching.filter((room) => room.joined).map(listing);
	// Without `parent_room_id` or `room_id`, `not_joined` holds top-level rooms only.
	const notJoined = matching.filter((room) => !room.joined && (exact !== undefined || parent !== undefined || room.record.parent_room_id === undefined)).map(listing);
	const listed = withMembers ? { users: [...new Set(matching.flatMap((room) => room.members))].map((id) => users.get(id) ?? { user_id: id }) } : {};
	if (params.filter === "joined") return { joined, ...listed };
	if (params.filter === "not_joined") return { not_joined: notJoined, ...listed };
	return { joined, not_joined: notJoined, ...listed };
}

function withoutDelivery(room: Json): Json {
	return Object.fromEntries(Object.entries(room).filter(([key]) => !DELIVERY.includes(key)));
}

/** A user object without `status` and `seen`, which are about a moment (ARCHIVE.md §2). */
function withoutStatus(user: Json): Json {
	const { status: _status, seen: _seen, ...rest } = user;
	return rest;
}

/** `you` as this server signs one in: allowed only to read (`ext:permissions` `write: false`). */
function readOnly(you: Json): Json {
	const ext = isObject(you.ext) ? you.ext : {};
	return { ...you, ext: { ...ext, permissions: { write: false, add_members: false, move_any: false } } };
}

function parseLine(text: string): Json | undefined {
	try {
		const value: unknown = JSON.parse(text);
		return isObject(value) ? value : undefined;
	} catch {
		return undefined;
	}
}
