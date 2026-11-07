import { describe, expect, it } from "vitest";
import { CANONICAL_ORIGIN, compileScene, parseScene, roomListKey, SceneError } from "../src/scene";
import { SCENES } from "../src/scenes.gen";
import { SCENE_NAME } from "../src/scenes";

/** Every file served next to the scenes, by its path: what their media URLs may name. */
const SERVED = new Set(Object.keys(import.meta.glob("../scenes/**/*.png")).map((path) => path.slice("../scenes".length)));

const FILES = Object.fromEntries(
	Object.entries(import.meta.glob<string>("../scenes/*.jsonl", { query: "?raw", import: "default", eager: true })).map(([path, text]) => [path.slice("../scenes/".length, -".jsonl".length), text]),
);

it("bundles every scene, compiled from its file as it is now", () => {
	expect(Object.keys(SCENES).sort()).toEqual(Object.keys(FILES).sort());
	for (const [name, text] of Object.entries(FILES)) expect(SCENES[name], `run npm run build for ${name}`).toEqual(compileScene(text));
});

/** Every scene in scenes/ is one a client can read whole: what it refers to is in it. */
describe.each(Object.entries(FILES))("scenes/%s.jsonl", (name, text) => {
	const lines = text.trim().split("\n").map((line) => JSON.parse(line));
	const header = lines[0];
	const scene = parseScene(text);

	it("has a name, a header and a title", () => {
		expect(name).toMatch(SCENE_NAME);
		expect(header.apron_archive).toBe(1);
		expect(typeof header.title).toBe("string");
		expect(header.server).toBe(`wss://scene.apron.chat/${name}`);
	});

	it("names only media it has, on its own origin", () => {
		const scene = compileScene(text);
		const own = `${CANONICAL_ORIGIN}/${name}/`;
		// Images load only from the server's origin (PROTOCOL.md §4.8.1): avatars and `og` media are files here.
		const media = [...text.matchAll(/"avatar":"([^"]+)"|"(?:image|video|audio)":\{[^{}]*"url":"([^"]+)"/g)].map((match) => (match[1] ?? match[2])!);
		for (const url of media) {
			expect(url.startsWith(own), `${url} isn't on ${own}`).toBe(true);
			expect(SERVED.has(url.slice(CANONICAL_ORIGIN.length)), `${url} isn't a file in scenes/`).toBe(true);
		}
		// Any other URL on its origin is a file here, or its live text. A link elsewhere is a link.
		for (const [, url] of text.matchAll(/"url":"([^"]+)"/g)) {
			if (!url!.startsWith(CANONICAL_ORIGIN)) continue;
			const live = url!.startsWith(`${own}live/`) ? url!.slice(`${own}live/`.length) : undefined;
			if (live !== undefined) expect(Object.hasOwn(scene.live, live), `${url} names no live text`).toBe(true);
			else expect(SERVED.has(url!.slice(CANONICAL_ORIGIN.length)), `${url} isn't a file in scenes/`).toBe(true);
		}
	});

	it("refers only to users, rooms and messages it has", () => {
		const users = new Set(scene.users.keys());
		const messages = new Map<string, any>();
		const logIds = new Set<string>();
		for (const line of lines.slice(1)) {
			for (const kind of ["rooms", "messages", "reactions", "memberships"]) {
				for (const record of line[kind] ?? []) {
					// One record per log position (PROTOCOL.md §2.1).
					expect(logIds.has(record.log_id), `${kind} ${record.log_id} repeats a log_id`).toBe(false);
					logIds.add(record.log_id);
					expect(scene.rooms.has(record.room_id), `${kind} ${record.log_id} is in unlisted room ${record.room_id}`).toBe(true);
					if (kind === "messages") messages.set(record.message_id, record);
				}
			}
		}
		for (const message of messages.values()) {
			expect(users.has(message.from.user_id), `unknown author ${message.from.user_id}`).toBe(true);
			for (const mention of message.body?.mentions ?? []) {
				expect(users.has(mention), `unknown mention ${mention}`).toBe(true);
				expect(message.body.text).toContain(`@${mention}`);
			}
			if (message.reply_to) expect(messages.has(message.reply_to.message_id), `reply to unknown ${message.reply_to.message_id}`).toBe(true);
		}
		for (const room of scene.rooms.values()) {
			for (const member of room.members) expect(users.has(member), `unknown member ${member}`).toBe(true);
			const parent = room.record.parent_room_id;
			if (typeof parent === "string") expect(scene.rooms.has(parent), `thread of unlisted ${parent}`).toBe(true);
		}
		expect(users.has(scene.you.user_id as string)).toBe(true);
	});

});

describe("parseScene", () => {
	it("refuses a file that isn't an archive it reads", () => {
		expect(() => parseScene('{"hello":1}\n')).toThrow(SceneError);
		expect(() => parseScene('{"apron_archive":2}\n')).toThrow(SceneError);
	});

	it("reads an archive without `you` as a viewer, and skips junk", () => {
		const scene = parseScene(
			[
				'{"apron_archive":1}',
				"not json",
				'{"joined":[{"room_id":"general","title":"General"}],"users":[{"user_id":"ada","name":"Ada","status":"online"}]}',
				'{"messages":[{"message_id":"100","log_id":"100","room_id":"general","from":{"user_id":"ada"},"body":{"text":"hi"}}]}',
				'{"messages":[{"message_id":"101","log_id":"101","room_id":"elsewhere","from":{"user_id":"ada"},"body":{"text":"ref"}}]}',
				'{"messages":[{"message_id":"102","log_id":"102","room_id":"general","from":{"user_id":"ada"},"body":{"text":"re"},"reply_to":{"message_id":"101"}}]}',
			].join("\n"),
		);
		expect(scene.you).toMatchObject({ user_id: "viewer", ext: { permissions: { write: false } } });
		// A scene keeps a user's `status`: its presence, which an archive leaves out.
		expect(scene.users.get("ada")).toEqual({ user_id: "ada", name: "Ada", status: "online" });
		// A message outside any listed room is only embedded, in the reply to it.
		const messages = scene.pushed.map((frame) => JSON.parse(frame)).filter((frame) => frame.method === "message");
		expect(messages.map((frame) => frame.params.message_id)).toEqual(["100", "102"]);
		expect(messages[1].params.reply_to.body.text).toBe("ref");
		expect(JSON.parse(scene.replies.get(roomListKey({}))!)).toEqual({ joined: [{ room_id: "general", title: "General" }], not_joined: [] });
	});
});
