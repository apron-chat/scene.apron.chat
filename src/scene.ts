/**
 * A scene: an Apron archive (apron-web's ARCHIVE.md, version 1) made ready to
 * serve, read-only, over the protocol.
 *
 * Everything a connection can be sent is worked out once per isolate, when
 * the scene is first served: the `server` frame, who `auth` signs in as, the
 * frames pushed after it, each room's listing, and each room's log. A request
 * then only slices a sorted array.
 *
 * Scenes are files in this repository, checked by `npm test`, not uploads: the
 * reader trusts their shape, and clients decode every record as untrusted
 * anyway (PROTOCOL.md §5.4).
 */

export type Json = Record<string, unknown>;

/** The archive version this reads (ARCHIVE.md §2). */
export const ARCHIVE_VERSION = 1;

/** The protocol version this serves. */
export const APRON_VERSION = 10;

/** Seconds between client pings (PROTOCOL.md §1), answered by the runtime without waking the object. */
export const PING_SECONDS = 45;

/** The most records one `history` page holds. */
export const PAGE_LIMIT = 200;

/** What it advertises (ARCHIVE.md §4): enough to list and read, nothing to write with. */
export const CAPABILITIES = ["history", "rooms", "reactions", "ext:settings", "ext:permissions", "ext:archive"];

type Kind = "rooms" | "messages" | "reactions" | "memberships";

/** One logged record, whole: a reaction or membership record keeps all its entries at its `log_id`. */
interface Entry {
	log: string;
	kind: Kind;
	record: Json;
}

interface Log {
	/** Ascending by `log`. */
	entries: Entry[];
	/** The effective lower bound (PROTOCOL.md §4.3.3). */
	bound: string;
	latest: string;
}

interface Room extends Log {
	/** The room record, with its `log_id`, and without delivery fields. */
	record: Json & { room_id: string; log_id: string };
	joined: boolean;
	members: string[];
	memberCount?: number;
}

export interface Scene {
	/** The `server` frame, as sent. */
	server: string;
	/** Who `auth` signs in as: allowed only to read. */
	you: Json;
	/** Sent after the `auth` result: every record of the joined rooms, as live deliveries. */
	pushed: string[];
	rooms: Map<string, Room>;
	/** The joined rooms' logs as one, for `history` without `room_id`. */
	joined: Log;
	users: Map<string, Json>;
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

const max = (a: string, b: string) => (compareLogIds(a, b) >= 0 ? a : b);
const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const isLogId = (value: unknown): value is string => typeof value === "string" && /^[1-9][0-9]{0,15}$/.test(value);
const isId = (value: unknown): value is string => typeof value === "string" && value !== "" && !/[\s\p{Cc}]/u.test(value);

/** Reads a scene from its JSON Lines. Throws `SceneError` for a file that isn't one. */
export function parseScene(text: string): Scene {
	const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "").map(parseLine);
	const header = lines[0];
	if (!header || !Object.hasOwn(header, "apron_archive")) throw new SceneError("The first line isn't an Apron archive header.");
	if (header.apron_archive !== ARCHIVE_VERSION) throw new SceneError(`Archive version ${String(header.apron_archive)} isn't one this reads.`);

	const users = new Map<string, Json>();
	const listed = new Map<string, { listing: Json; joined: boolean }>();
	const records: Entry[] = [];
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

	// Each message's latest snapshot: where its reactions are, and what a reply to it embeds (PROTOCOL.md §3.5.4).
	const latest = new Map<string, Json>();
	for (const { kind, record } of records) {
		if (kind !== "messages" || !isId(record.message_id)) continue;
		const kept = latest.get(record.message_id);
		if (!kept || compareLogIds(record.log_id as string, kept.log_id as string) > 0) latest.set(record.message_id, record);
	}
	const withReply = (message: Json): Json => {
		const to = isObject(message.reply_to) ? latest.get(message.reply_to.message_id as string) : undefined;
		if (!to || to.message_id === message.message_id) return message;
		const { reply_to: _nested, ...target } = to;
		return { ...message, reply_to: isObject(to.reply_to) ? { ...target, reply_to: { message_id: to.reply_to.message_id } } : target };
	};

	// Each room's records, each once: an archive may repeat one. A reaction record is in its message's room (§4).
	const byRoom = new Map<string, Map<string, Entry>>();
	const taken = new Set<string>();
	const add = (room: unknown, key: string, entry: Entry) => {
		if (!isId(room)) return;
		taken.add(entry.log);
		const log = byRoom.get(room) ?? new Map<string, Entry>();
		log.set(`${entry.kind}\n${entry.log}\n${key}`, entry);
		byRoom.set(room, log);
	};
	for (const entry of records) {
		const { kind, record } = entry;
		if (kind === "messages") add(record.room_id, String(record.message_id), { ...entry, record: withReply(record) });
		else if (kind === "reactions") add(latest.get(record.message_id as string)?.room_id ?? record.room_id, String(record.message_id), entry);
		else if (kind === "memberships") add(record.room_id, "", entry);
		else add(record.room_id, "", { ...entry, record: withoutDelivery(record) });
	}
	for (const [id, { listing }] of listed) {
		if (isLogId(listing.log_id)) add(id, "", { log: listing.log_id, kind: "rooms", record: withoutDelivery(listing) });
	}

	const rooms = new Map<string, Room>();
	for (const [id, { listing, joined }] of listed) {
		const all = [...(byRoom.get(id)?.values() ?? [])].sort((a, b) => compareLogIds(a.log, b.log));
		const last = all.findLast((entry) => entry.kind === "rooms")?.record;
		// A listed room without `log_id` gets one below its records that no record holds (ARCHIVE.md §4).
		const record = { ...(last ?? withoutDelivery(listing)), room_id: id, log_id: (last?.log_id as string | undefined) ?? positionBefore(all[0]?.log ?? (listing.latest_log_id as string | undefined), taken) };
		const latestLog = [record.log_id, isLogId(listing.latest_log_id) ? listing.latest_log_id : undefined, all.at(-1)?.log].filter((log) => log !== undefined).reduce(max);
		// `history_log_id` absent: from its oldest record. Null: none of it (ARCHIVE.md §3.1).
		const start = listing.history_log_id === undefined ? all[0]?.log : isLogId(listing.history_log_id) ? listing.history_log_id : undefined;
		const bound = start ?? String(Number(latestLog) + 1);
		rooms.set(id, {
			record,
			joined,
			members: Array.isArray(listing.members) ? listing.members.filter(isObject).map((member) => member.user_id).filter(isId) : membersFromLog(all),
			...(typeof listing.member_count === "number" ? { memberCount: listing.member_count } : {}),
			entries: all.filter((entry) => compareLogIds(entry.log, bound) >= 0),
			bound,
			latest: latestLog,
		});
	}

	const joinedRooms = [...rooms.values()].filter((room) => room.joined);
	// Below the greatest bound, one room's stretch may start while another's hasn't; one log can't say so (§4).
	const joinedBound = joinedRooms.map((room) => room.bound).reduce(max, "1");
	const joinedLog: Log = {
		entries: joinedRooms.flatMap((room) => room.entries.filter((entry) => compareLogIds(entry.log, joinedBound) >= 0)).sort((a, b) => compareLogIds(a.log, b.log)),
		bound: joinedBound,
		latest: joinedRooms.map((room) => room.latest).reduce(max, "1"),
	};

	const media = Array.isArray(header.media) ? header.media.filter((origin): origin is string => typeof origin === "string") : [];
	const archive = { ...(typeof header.server === "string" ? { server: header.server } : {}), ...(typeof header.exported_at === "string" ? { exported_at: header.exported_at } : {}) };
	// Bios show only with `ext:bio` (EXTENSIONS.md): advertised when a user has one.
	const bios = [...users.values()].some((user) => isObject(user.ext) && typeof user.ext.bio === "string");
	const look = Object.fromEntries((["title", "description", "avatar"] as const).filter((key) => typeof header[key] === "string").map((key) => [key, header[key]]));
	const server = {
		method: "server",
		params: {
			apron: APRON_VERSION,
			agent: "apron-scene/1",
			auth: ["guest"],
			ping: PING_SECONDS,
			...look,
			capabilities: [...CAPABILITIES, ...(media.length ? ["ext:media"] : []), ...(bios ? ["ext:bio"] : [])],
			ext: { settings: { read_cursors: false }, archive, ...(media.length ? { media: { origins: media } } : {}) },
		},
	};

	const you = readOnly(isObject(header.you) && isId(header.you.user_id) ? withoutStatus(header.you) : VIEWER);
	// Every record of the joined rooms, as the live deliveries a client that joined them would have seen
	// (PROTOCOL.md §3.5.3), and the users first, so a client that never lists rooms still knows them (§3.3.3).
	const pushed = [
		...[...users.values()].filter((user) => user.user_id !== you.user_id).map((user) => JSON.stringify({ method: "user", params: { new: user } })),
		...joinedRooms
			.flatMap((room) => room.entries.filter((entry) => entry.kind !== "rooms"))
			.sort((a, b) => compareLogIds(a.log, b.log))
			.map(delivery),
	];

	return { server: JSON.stringify(server), you, pushed, rooms, joined: joinedLog, users };
}

/** A record as the notification that delivers it live. */
function delivery({ kind, record }: Entry): string {
	if (kind === "messages") return JSON.stringify({ method: "message", params: record });
	if (kind === "reactions") return JSON.stringify({ method: "reactions", params: record });
	return JSON.stringify({ method: "room_update", params: { memberships: [record] } });
}

/** `room_list` (PROTOCOL.md §4.2.1): the scene's rooms, as `you` joined them, the most recently active first. */
export function listRooms(scene: Scene, params: Json): Json {
	const parent = typeof params.parent_room_id === "string" ? params.parent_room_id : undefined;
	const exact = typeof params.room_id === "string" ? params.room_id : undefined;
	const withMembers = params.members === true;
	const matching = [...scene.rooms.values()]
		.filter((room) => (exact !== undefined ? room.record.room_id === exact : parent !== undefined ? room.record.parent_room_id === parent : true))
		.sort((a, b) => compareLogIds(b.latest, a.latest));
	const listing = (room: Room): Json => ({
		...room.record,
		latest_log_id: room.latest,
		history_log_id: historyLogId(room),
		...(withMembers ? { members: room.members.map((user_id) => ({ user_id })) } : {}),
		...(withMembers && room.memberCount !== undefined ? { member_count: room.memberCount } : {}),
	});
	const joined = matching.filter((room) => room.joined).map(listing);
	// Without `parent_room_id` or `room_id`, `not_joined` holds top-level rooms only.
	const notJoined = matching.filter((room) => !room.joined && (exact !== undefined || parent !== undefined || room.record.parent_room_id === undefined)).map(listing);
	const users = withMembers ? { users: [...new Set(matching.flatMap((room) => room.members))].map((id) => scene.users.get(id) ?? { user_id: id }) } : {};
	if (params.filter === "joined") return { joined, ...users };
	if (params.filter === "not_joined") return { not_joined: notJoined, ...users };
	return { joined, not_joined: notJoined, ...users };
}

/**
 * `history` (PROTOCOL.md §4.3.2): within the bounds, the oldest `limit` records with `after`, else the newest.
 * Undefined for a room the scene doesn't list.
 */
export function history(scene: Scene, params: Json): Json | undefined {
	const log = params.room_id === undefined ? scene.joined : typeof params.room_id === "string" ? scene.rooms.get(params.room_id) : undefined;
	if (!log) return undefined;
	const requested = Math.floor(Number(params.limit));
	const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, PAGE_LIMIT) : PAGE_LIMIT;
	const { entries } = log;
	const start = isLogId(params.after) ? boundary(entries, params.after, false) : 0;
	const end = isLogId(params.before) ? boundary(entries, params.before, true) : entries.length;
	let from = start;
	let to = end;
	// Records at one `log_id` go on one page together, so continuing from its bounds skips none.
	if (isLogId(params.after)) {
		to = Math.min(end, start + limit);
		while (to < end && entries[to]!.log === entries[to - 1]!.log) to++;
	} else {
		from = Math.max(start, end - limit);
		while (from > start && entries[from - 1]!.log === entries[from]!.log) from--;
	}
	const page = end > start ? entries.slice(from, to) : [];
	const result: Json = { rooms: [], messages: [], reactions: [], memberships: [] };
	for (const entry of page) (result[entry.kind] as Json[]).push(entry.record);
	return {
		...result,
		more: page.length < Math.max(0, end - start),
		...(page.length ? { first_log_id: page[0]!.log, last_log_id: page.at(-1)!.log } : {}),
		latest_log_id: log.latest,
		history_log_id: historyLogId(log),
	};
}

/** The first index whose entry is at or past `position` (`strict`: past it), in an ascending log. */
function boundary(entries: readonly Entry[], position: string, strict: boolean): number {
	let low = 0;
	let high = entries.length;
	while (low < high) {
		const middle = (low + high) >>> 1;
		const order = compareLogIds(entries[middle]!.log, position);
		if (order < 0 || (strict && order === 0)) low = middle + 1;
		else high = middle;
	}
	return low;
}

/** `history_log_id`: the bound, or null when it is past the latest, as for a room that keeps none. */
function historyLogId(log: Log): string | null {
	return compareLogIds(log.bound, log.latest) > 0 ? null : log.bound;
}

/** Who had joined, as the room's memberships leave them. */
function membersFromLog(entries: readonly Entry[]): string[] {
	const joined = new Map<string, boolean>();
	for (const { kind, record } of entries) {
		if (kind !== "memberships" || !Array.isArray(record.members)) continue;
		for (const member of record.members) if (isObject(member) && isObject(member.user) && isId(member.user.user_id)) joined.set(member.user.user_id, member.joined === true);
	}
	return [...joined].filter(([, member]) => member).map(([id]) => id);
}

/** A position below `log` (or 1) that no record holds. */
function positionBefore(log: string | undefined, taken: ReadonlySet<string>): string {
	let position = log === undefined ? 1 : Math.max(1, Number(log) - 1);
	while (taken.has(String(position)) && position > 1) position--;
	return String(position);
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
