// A small script for writing scenes by hand: say who posts what, where, and
// how long after the last thing, and it writes an Apron archive (apron-web's
// ARCHIVE.md) with consistent log_ids, listings and members.
//
//   const s = new Script({ start: "2026-03-26T18:00:00Z", users: {...}, you: "bleachers" });
//   s.room("general", { title: "General" }, ["ada", "bob"]);
//   const hi = s.say("general", "ada", "Hi @bob", { mentions: ["bob"] });
//   s.react(hi, "bob", ["👋"]);
//   writeFileSync("scenes/demo/scene.jsonl", s.archive({ title: "Demo" }));

/**
 * An image embed (PROTOCOL.md §4.8): a file at `url`, shown from its `og.image`. `url` is on the scene's own origin,
 * such as `https://scene.apron.chat/<name>/<file>`, which clients load media from (and which is rewritten when the
 * scene is served from another host).
 */
export function image(url, { title, width, height, alt, type = "image/png" }) {
	return { kind: "upload", title, url, og: { title, image: { url, type, width, height, ...(alt ? { alt } : {}) } } };
}

export class Script {
	#at;
	#users;
	#you;
	#rooms = new Map();
	#records = [];
	#messages = new Map();
	#activity = [];
	#live = {};

	/**
	 * @param {{ start: string, users: Record<string, object>, you?: string }} options
	 *   `users` maps each user_id to its user object, without user_id. `you` is who reads the scene. `avatars`, if
	 *   given, maps a user_id to its avatar's URL.
	 */
	constructor({ start, users, you, avatars }) {
		this.#at = Date.parse(start);
		// `avatars`, when given, makes each user's `avatar` URL from their user_id.
		this.#users = new Map(Object.entries(users).map(([user_id, user]) => [user_id, { user_id, ...user, ...(avatars ? { avatar: avatars(user_id) } : {}) }]));
		this.#you = you;
	}

	/** The next log_id, `seconds` after the last. */
	#next(seconds = 20) {
		this.#at += Math.round(seconds * 1000);
		return String(this.#at);
	}

	/** The time of the last record, in milliseconds. */
	get now() {
		return this.#at;
	}

	/**
	 * Moves the clock to `time` (an ISO string or milliseconds), so that the next record is at `time` with `after: 0`.
	 * Time only goes forward: a `time` before the last record is refused.
	 */
	at(time) {
		const ms = typeof time === "number" ? time : Date.parse(time);
		if (!(ms >= this.#at)) throw new Error(`at(${time}) is before the last record`);
		this.#at = ms;
		return this;
	}

	/** A user as a record carries it (PROTOCOL.md §3.3.1): its id, name and roles. */
	#from(user_id) {
		const user = this.#users.get(user_id);
		if (!user) throw new Error(`unknown user ${user_id}`);
		return { user_id, ...(user.name ? { name: user.name } : {}), ...(user.avatar ? { avatar: user.avatar } : {}), ...(user.roles ? { roles: user.roles } : {}) };
	}

	#room(room_id) {
		const room = this.#rooms.get(room_id);
		if (!room) throw new Error(`unknown room ${room_id}`);
		return room;
	}

	#membership(room_id, user_ids, joined, after) {
		const room = this.#room(room_id);
		const log_id = this.#next(after);
		for (const user_id of user_ids) {
			if (joined) room.members.add(user_id);
			else room.members.delete(user_id);
		}
		room.latest = log_id;
		this.#records.push({ memberships: [{ log_id, room_id, members: user_ids.map((user_id) => ({ user: this.#from(user_id), joined })) }] });
	}

	/**
	 * A room, or with `parent_room_id` a thread, made by `by` with `members` in it. `joined: false` lists it under
	 * the rooms `you` hasn't joined, readable without joining. `announce: false` lists its members without a record
	 * of them joining, so the room shows no "joined" notice at its start.
	 */
	room(room_id, { joined = true, by, after = 1, announce = true, ...fields }, members) {
		const log_id = this.#next(after);
		const record = { room_id, log_id, ...fields };
		this.#rooms.set(room_id, { record, joined, members: new Set(), start: log_id, latest: log_id });
		this.#records.push({ rooms: [record] });
		const everyone = [...new Set([...(by ? [by] : []), ...members])];
		if (announce) this.#membership(room_id, everyone, true, 0.001);
		else for (const user_id of everyone) this.#room(room_id).members.add(user_id);
		return room_id;
	}

	/**
	 * `user_id` typing in a room when the scene is read, for `seconds` (scene extension `activity`, sent as PROTOCOL.md
	 * §4.6's `activity` notification after everything else).
	 */
	typing(room_id, user_id, seconds = 600) {
		this.#room(room_id);
		this.#activity.push({ room_id, from: this.#from(user_id), typing: seconds });
	}

	/**
	 * Live text (scene extension `live`): `chunks` of `[milliseconds to wait, text]`, served at `/<name>/live/<id>` as
	 * a writer would have sent them. A `terminal` or `append` embed whose `url` is there shows them as they come, and
	 * stays live.
	 */
	live(id, chunks) {
		this.#live[id] = chunks;
	}

	join(room_id, user_id, after) {
		this.#membership(room_id, [user_id], true, after);
	}

	leave(room_id, user_id, after) {
		this.#membership(room_id, [user_id], false, after);
	}

	/**
	 * A message; returns its id. `text` is Markdown unless `plain`. `reply` is the id of the message it replies
	 * to. `mentions` are user_ids, which `text` writes as `@user_id` (PROTOCOL.md Appendix A.3). `embeds` are
	 * embed objects (PROTOCOL.md §4.8), such as `image()` makes.
	 */
	say(room_id, user_id, text, { after, reply, mentions, embeds, plain = false } = {}) {
		const room = this.#room(room_id);
		const log_id = this.#next(after);
		const message = {
			message_id: log_id,
			log_id,
			room_id,
			from: this.#from(user_id),
			body: { text, format: plain ? "plain" : "markdown", ...(mentions ? { mentions } : {}), ...(embeds ? { embeds } : {}) },
			...(reply ? { reply_to: { message_id: reply } } : {}),
		};
		room.latest = log_id;
		this.#messages.set(log_id, message);
		this.#records.push({ messages: [message] });
		return log_id;
	}

	/** A new snapshot of a message (PROTOCOL.md §4.4) with `text`: an edit. */
	edit(message_id, text, { after } = {}) {
		const old = this.#messages.get(message_id);
		const log_id = this.#next(after);
		const message = { ...old, log_id, prev_log_id: old.log_id, body: { ...old.body, text } };
		this.#room(old.room_id).latest = log_id;
		this.#messages.set(message_id, message);
		this.#records.push({ messages: [message] });
	}

	/** A tombstone (PROTOCOL.md §4.4). */
	delete(message_id, { after } = {}) {
		const old = this.#messages.get(message_id);
		const log_id = this.#next(after);
		const { body: _body, ext: _ext, ...rest } = old;
		const message = { ...rest, log_id, prev_log_id: old.log_id, deleted: true };
		this.#room(old.room_id).latest = log_id;
		this.#messages.set(message_id, message);
		this.#records.push({ messages: [message] });
	}

	/** `user_id`'s whole set of emoji on a message (PROTOCOL.md §4.7). */
	react(message_id, user_id, emojis, { after = 2 } = {}) {
		const message = this.#messages.get(message_id);
		const log_id = this.#next(after);
		this.#room(message.room_id).latest = log_id;
		this.#records.push({ reactions: [{ log_id, message_id, room_id: message.room_id, reactions: [{ from: this.#from(user_id), emojis }] }] });
	}

	/**
	 * The archive, as JSON Lines: a header with the scene's `title`, `description`, `avatar` and the `room` it opens
	 * on, the listing, then
	 * each record, then the scene extensions (`activity`, `live`), which other readers of archives skip.
	 */
	archive({ server, title, description, avatar, room, exported_at, media }) {
		const header = {
			apron_archive: 1,
			...(server ? { server } : {}),
			...(exported_at ? { exported_at } : {}),
			...(this.#you ? { you: this.#users.get(this.#you) } : {}),
			...(title ? { title } : {}),
			...(description ? { description } : {}),
			...(avatar ? { avatar } : {}),
			...(room ? { room } : {}),
			...(media ? { media } : {}),
		};
		const listing = (room) => ({
			...room.record,
			latest_log_id: room.latest,
			history_log_id: room.start,
			// `you` is in the rooms it joined, without a record of joining: it came to read.
			members: [...new Set([...room.members, ...(room.joined && this.#you ? [this.#you] : [])])].map((user_id) => ({ user_id })),
		});
		const rooms = [...this.#rooms.values()];
		const lines = [
			header,
			{
				joined: rooms.filter((room) => room.joined).map(listing),
				not_joined: rooms.filter((room) => !room.joined).map(listing),
				users: [...this.#users.values()],
			},
			...this.#records,
			...(this.#activity.length ? [{ activity: this.#activity }] : []),
			...(Object.keys(this.#live).length ? [{ live: this.#live }] : []),
		];
		return lines.map((line) => JSON.stringify(line)).join("\n") + "\n";
	}
}
