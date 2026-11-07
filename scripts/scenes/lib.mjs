// A small script for writing scenes by hand: say who posts what, where, and
// how long after the last thing, and it writes an Apron archive (apron-web's
// ARCHIVE.md) with consistent log_ids, listings and members.
//
//   const s = new Script({ start: "2026-03-26T18:00:00Z", users: {...}, you: "bleachers" });
//   s.room("general", { title: "General" }, ["ada", "bob"]);
//   const hi = s.say("general", "ada", "Hi @bob", { mentions: ["bob"] });
//   s.react(hi, "bob", ["👋"]);
//   writeFileSync("scenes/demo.jsonl", s.archive({ title: "Demo" }));

export class Script {
	#at;
	#users;
	#you;
	#rooms = new Map();
	#records = [];
	#messages = new Map();

	/**
	 * @param {{ start: string, users: Record<string, object>, you?: string }} options
	 *   `users` maps each user_id to its user object, without user_id. `you` is who reads the scene.
	 */
	constructor({ start, users, you }) {
		this.#at = Date.parse(start);
		this.#users = new Map(Object.entries(users).map(([user_id, user]) => [user_id, { user_id, ...user }]));
		this.#you = you;
	}

	/** The next log_id, `seconds` after the last. */
	#next(seconds = 20) {
		this.#at += Math.round(seconds * 1000);
		return String(this.#at);
	}

	/** A user as a record carries it (PROTOCOL.md §3.3.1): its id, name and roles. */
	#from(user_id) {
		const user = this.#users.get(user_id);
		if (!user) throw new Error(`unknown user ${user_id}`);
		return { user_id, ...(user.name ? { name: user.name } : {}), ...(user.roles ? { roles: user.roles } : {}) };
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
	 * the rooms `you` hasn't joined, readable without joining.
	 */
	room(room_id, { joined = true, by, after = 1, ...fields }, members) {
		const log_id = this.#next(after);
		const record = { room_id, log_id, ...fields };
		this.#rooms.set(room_id, { record, joined, members: new Set(), start: log_id, latest: log_id });
		this.#records.push({ rooms: [record] });
		this.#membership(room_id, [...new Set([...(by ? [by] : []), ...members])], true, 0.001);
		return room_id;
	}

	join(room_id, user_id, after) {
		this.#membership(room_id, [user_id], true, after);
	}

	leave(room_id, user_id, after) {
		this.#membership(room_id, [user_id], false, after);
	}

	/**
	 * A message; returns its id. `text` is Markdown unless `plain`. `reply` is the id of the message it replies
	 * to. `mentions` are user_ids, which `text` writes as `@user_id` (PROTOCOL.md Appendix A.3).
	 */
	say(room_id, user_id, text, { after, reply, mentions, plain = false } = {}) {
		const room = this.#room(room_id);
		const log_id = this.#next(after);
		const message = {
			message_id: log_id,
			log_id,
			room_id,
			from: this.#from(user_id),
			body: { text, format: plain ? "plain" : "markdown", ...(mentions ? { mentions } : {}) },
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

	/** The archive, as JSON Lines: a header with the scene's `title` and `description`, the listing, then each record. */
	archive({ server, title, description, exported_at }) {
		const header = {
			apron_archive: 1,
			...(server ? { server } : {}),
			...(exported_at ? { exported_at } : {}),
			...(this.#you ? { you: this.#users.get(this.#you) } : {}),
			...(title ? { title } : {}),
			...(description ? { description } : {}),
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
		];
		return lines.map((line) => JSON.stringify(line)).join("\n") + "\n";
	}
}
