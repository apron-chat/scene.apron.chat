import { describe, expect, it } from "vitest";
import { CANONICAL_ORIGIN, compileScene, parseScene, roomListKey, SceneError } from "../src/scene";
import { SCENES } from "../src/scenes.gen";
import { SCENE_NAME } from "../src/scenes";
import { describe as summarize, landing } from "../scripts/landing.mjs";

/** A URL's path on the scene's origin, without its version (`?v=`). */
const path = (url: string) => url.slice(CANONICAL_ORIGIN.length).replace(/\?.*$/, "");

/** Every file served next to the scenes, by its path: what their media URLs may name. */
const SERVED = new Set(Object.keys(import.meta.glob("../scenes/**/*.png")).map((path) => path.slice("../scenes".length)));

/** Each picture's file, by its path, as a data URL: what its version (`?v=`) hashes. */
const PICTURES = Object.fromEntries(Object.entries(import.meta.glob<string>("../scenes/**/*.png", { query: "?inline", import: "default", eager: true })).map(([path, data]) => [path.slice("../scenes".length), data]));

async function version(data: string): Promise<string> {
	const bytes = Uint8Array.from(atob(data.slice(data.indexOf(",") + 1)), (c) => c.charCodeAt(0));
	return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 8);
}

const FILES = Object.fromEntries(
	Object.entries(import.meta.glob<string>("../scenes/*/scene.jsonl", { query: "?raw", import: "default", eager: true })).map(([path, text]) => [path.slice("../scenes/".length, -"/scene.jsonl".length), text]),
);

it("bundles every scene, compiled from its file as it is now", () => {
	expect(Object.keys(SCENES).sort()).toEqual(Object.keys(FILES).sort());
	for (const [name, text] of Object.entries(FILES)) expect(SCENES[name], `run npm run build for ${name}`).toEqual(compileScene(text));
});

/** Every scene in scenes/ is one a client can read whole: what it refers to is in it. */
describe.each(Object.entries(FILES))("scenes/%s/scene.jsonl", (name, text) => {
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
			expect(SERVED.has(path(url)), `${url} isn't a file in scenes/`).toBe(true);
		}
		// Any other URL on its origin is a file here, or its live text. A link elsewhere is a link.
		for (const [, url] of text.matchAll(/"url":"([^"]+)"/g)) {
			if (!url!.startsWith(CANONICAL_ORIGIN)) continue;
			const live = url!.startsWith(`${own}live/`) ? url!.slice(`${own}live/`.length) : undefined;
			if (live !== undefined) expect(Object.hasOwn(scene.live, live), `${url} names no live text`).toBe(true);
			else expect(SERVED.has(path(url!)), `${url} isn't a file in scenes/`).toBe(true);
		}
	});

	it("versions each picture on its origin by its file, so clients fetch it again when it changes", async () => {
		for (const [, url] of text.matchAll(/"(https:\/\/scene\.apron\.chat\/[^"]+\.png[^"]*)"/g)) {
			const data = PICTURES[path(url!)];
			expect(data, `${url} isn't a file in scenes/`).toBeDefined();
			expect(url, "run npm run scenes").toBe(`${CANONICAL_ORIGIN}${path(url!)}?v=${await version(data!)}`);
		}
	});

	it("gives avatars in its users, not in every record's from", () => {
		for (const line of lines.slice(2)) {
			for (const [, from] of JSON.stringify(line).matchAll(/"(?:from|user)":(\{[^{}]*\})/g)) expect(JSON.parse(from!), "a recorded user").not.toHaveProperty("avatar");
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

describe("the landing page", () => {
	const page = landing(Object.entries(FILES).sort(([a], [b]) => a.localeCompare(b)));

	it("has a card for every scene, with how to open, connect to and download it", () => {
		expect(page).toContain(`<h2 id="scenes-title"><span>§</span>${Object.keys(FILES).length} scenes</h2>`);
		for (const name of Object.keys(FILES)) {
			expect(page).toContain(`<article class="scene" id="${name}">`);
			expect(page).toContain(`<a class="button" href="/${name}">Open</a>`);
			expect(page).toContain(`<code data-scene="${name}">wss://scene.apron.chat/${name}</code>`);
			expect(page).toContain(`<a class="file" href="/${name}/scene.jsonl" download="${name}.jsonl">scene.jsonl</a>`);
		}
		expect(page).toContain('<h3><a href="/whosonfirst">Who&#39;s on First?</a></h3>');
		// A scene's own avatar, from wherever the page is served; else its initials.
		expect(page).toMatch(/<img class="avatar" src="\/whosonfirst\/scene\.png\?v=[0-9a-f]{8}"/);
		expect(page).toMatch(/<img class="avatar" src="\/piper\/scene\.png\?v=[0-9a-f]{8}"/);
		expect(page).toContain('<span class="avatar mono" aria-hidden="true">TC</span>');
	});

	it("says what each scene shows", () => {
		expect(summarize(FILES.agent!)).toMatchObject({ counts: { rooms: 3, threads: 1, DMs: 0, people: 4 } });
		expect(summarize(FILES.agent!).features).toEqual(expect.arrayContaining(["threads", "terminal", "live text", "presence", "badges"]));
		expect(summarize(FILES.piper!).counts.DMs).toBe(3);
		expect(summarize(FILES.rich!).features).toEqual(expect.arrayContaining(["images", "link previews", "typing", "mentions"]));
		expect(summarize(FILES.whosonfirst!).features).toEqual(expect.arrayContaining(["edits", "deletions", "joins & leaves", "avatars", "bios"]));
		expect(summarize(FILES.whosonfirst!).features).not.toContain("presence");
	});
});

describe("the landing page's cards", () => {
	const header = (text: string, change: (header: Record<string, unknown>) => void) => {
		const [first, ...rest] = text.split("\n");
		const parsed = JSON.parse(first!);
		change(parsed);
		return [JSON.stringify(parsed), ...rest].join("\n");
	};

	it("follow the scene's header: its avatar, versioned by its contents, and its title", () => {
		const text = header(FILES.piper!, (h) => {
			h.avatar = "https://scene.apron.chat/piper/new.png";
			h.title = "Pied Piper, Inc.";
		});
		const page = landing([["piper", text]], { version: (path) => (path === "/piper/new.png" ? "abc123" : undefined) });
		expect(page).toContain('<img class="avatar" src="/piper/new.png?v=abc123"');
		expect(page).toContain('<h3><a href="/piper">Pied Piper, Inc.</a></h3>');
	});

	it("take an avatar from elsewhere as it is, and draw initials without one", () => {
		const elsewhere = landing([["piper", header(FILES.piper!, (h) => (h.avatar = "https://images.example/pp.png"))]]);
		expect(elsewhere).toContain('<img class="avatar" src="https://images.example/pp.png"');
		const none = landing([["piper", header(FILES.piper!, (h) => delete h.avatar)]]);
		expect(none).toContain('<span class="avatar mono" aria-hidden="true">PP</span>');
		const bad = landing([["piper", header(FILES.piper!, (h) => (h.avatar = "javascript:alert(1)"))]]);
		expect(bad).not.toContain("javascript:");
	});
});
