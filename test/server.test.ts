import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { MAX_FRAMES, PONG } from "../src/connection";

const PING = '{"method":"ping"}';

type Frame = { id?: string; method?: string; params?: any; result?: any; error?: any };

/** Opens a WebSocket to a scene and queues its frames. */
async function connect(path = "/whosonfirst", ip = `192.0.2.${Math.floor(Math.random() * 250) + 1}`, host = "scene.test") {
	const response = await SELF.fetch(`https://${host}${path}`, { headers: { Upgrade: "websocket", "CF-Connecting-IP": ip } });
	expect(response.status).toBe(101);
	const socket = response.webSocket!;
	const frames: Frame[] = [];
	const waiters: ((frame: Frame) => void)[] = [];
	let closed: { code: number; reason: string } | undefined;
	socket.addEventListener("message", (event) => {
		const frame = event.data === PONG ? { method: "pong", raw: event.data } : JSON.parse(String(event.data));
		const waiter = waiters.shift();
		if (waiter) waiter(frame);
		else frames.push(frame);
	});
	socket.addEventListener("close", (event) => {
		closed = { code: event.code, reason: event.reason };
	});
	socket.accept();
	const next = (): Promise<Frame> => {
		const frame = frames.shift();
		return frame ? Promise.resolve(frame) : new Promise((resolve) => waiters.push(resolve));
	};
	return {
		send: (frame: unknown) => socket.send(typeof frame === "string" ? frame : JSON.stringify(frame)),
		next,
		/** Frames until the reply to `id`, which is last. */
		async until(id: string): Promise<Frame[]> {
			const seen: Frame[] = [];
			for (;;) {
				const frame = await next();
				seen.push(frame);
				if (frame.id === id) return seen;
			}
		},
		closed: () => closed,
		close: () => socket.close(1000, "done"),
	};
}

/** The `server` frame, the reply to `auth`, and what follows it unasked: the scene. */
async function opening(peer: Awaited<ReturnType<typeof connect>>) {
	const server = await peer.next();
	peer.send({ method: "auth", id: "a1", params: { scheme: "guest" } });
	const auth = await peer.next();
	// A marker after the stream: whatever comes before its reply was sent unasked.
	peer.send({ method: "room_list", id: "marker", params: {} });
	const frames = await peer.until("marker");
	return { server, auth, pushed: frames.slice(0, -1) };
}

const logOf = (frame: Frame): string => frame.params.log_id ?? frame.params.memberships[0].log_id;

describe("a scene over the protocol", () => {
	it("sends the whole scene as the connection signs in, unasked", async () => {
		const peer = await connect();
		const { server, auth, pushed } = await opening(peer);
		const [rooms, ...records] = pushed;
		expect(server!.method).toBe("server");
		expect(server!.params).toMatchObject({ apron: 10, auth: ["guest"], title: "Who's on First?", avatar: "https://scene.test/whosonfirst/scene.png" });
		// No pings asked for: an idle connection costs nothing, and nothing needs to know it's there.
		expect(server!.params.ping).toBeUndefined();
		// Nothing to page: everything is here.
		expect(server!.params.capabilities).toEqual(["rooms", "reactions", "ext:settings", "ext:permissions", "ext:archive", "ext:media", "ext:bio"]);
		// The scene's own media, served from wherever the scene is: here, https://scene.test.
		expect(server!.params.ext).toEqual({ settings: { read_cursors: false }, archive: { server: "wss://scene.apron.chat/whosonfirst" }, media: { origins: ["https://scene.test"] } });

		expect(rooms!.method).toBe("room_update");
		expect(rooms!.params.joined.map((room: any) => room.room_id).sort()).toEqual(["dugout", "i-dont-know", "lineup", "whos-on-first"]);
		expect(rooms!.params.joined.find((room: any) => room.room_id === "whos-on-first")).toMatchObject({ parent_room_id: "dugout", title: "Who's on first" });
		expect(rooms!.params.joined[0].members.map((member: any) => member.user_id)).toContain("bleachers");
		expect(rooms!.params.users.find((user: any) => user.user_id === "who")).toMatchObject({ name: "Who", roles: ["1B"], ext: { bio: "First base." } });

		// Every record, in log order, as live deliveries; the rooms you haven't joined too.
		expect(new Set(records.map((frame) => frame.method))).toEqual(new Set(["message", "reactions", "room_update"]));
		const logs = records.map(logOf);
		expect(logs).toEqual([...logs].sort((a, b) => a.length - b.length || a.localeCompare(b)));
		const messages = records.filter((frame) => frame.method === "message");
		expect(new Set(messages.map((frame) => frame.params.room_id))).toEqual(new Set(["dugout", "i-dont-know", "lineup", "whos-on-first", "bullpen"]));
		expect(messages.length).toBeGreaterThan(90);
		// A reply carries the snapshot it replies to; an edit and a deletion are later snapshots.
		expect(messages.find((frame) => frame.params.reply_to)!.params.reply_to.from).toBeDefined();
		expect(messages.some((frame) => frame.params.deleted === true)).toBe(true);
		expect(messages.some((frame) => frame.params.prev_log_id && !frame.params.deleted)).toBe(true);

		expect(auth.result.you).toMatchObject({ user_id: "bleachers", name: "Bleachers", ext: { permissions: { write: false, add_members: false, move_any: false } } });
		peer.close();
	});

	it("answers the room listings a client asks for", async () => {
		const peer = await connect();
		await opening(peer);
		const ask = async (params: object) => {
			const id = `r${Math.random()}`;
			peer.send({ method: "room_list", id, params });
			return (await peer.until(id)).at(-1)!;
		};
		const joined = (await ask({ filter: "joined", members: true })).result;
		expect(Object.keys(joined)).toEqual(["joined", "users"]);
		expect(joined.joined).toHaveLength(4);
		expect(joined.users.map((user: any) => user.user_id)).toContain("bleachers");
		const others = (await ask({ filter: "not_joined", members: true, user_id: "who" })).result;
		expect(others.not_joined.map((room: any) => room.room_id)).toEqual(["bullpen"]);
		const threads = (await ask({ parent_room_id: "dugout", filter: "not_joined" })).result;
		expect(threads).toEqual({ not_joined: [] });
		const all = (await ask({ parent_room_id: "dugout" })).result;
		expect(all.joined.map((room: any) => room.title).sort()).toEqual(["I Don't Know", "Who's on first"]);
		expect(all.joined[0].members).toBeUndefined();
		const one = (await ask({ room_id: "bullpen", members: true })).result;
		expect(one.not_joined[0]).toMatchObject({ room_id: "bullpen", members: [{ user_id: "tomorrow" }, { user_id: "today" }] });
		expect((await ask({ room_id: "nowhere" })).error.code).toBe(-32602);
		peer.close();
	});

	it("refuses everything that would change something", async () => {
		const peer = await connect();
		expect((await peer.next()).method).toBe("server");
		peer.send({ method: "room_list", id: "early", params: {} });
		expect((await peer.next()).error.code).toBe(-32001);
		peer.send({ method: "auth", id: "t1", params: { scheme: "token", token: "x" } });
		expect((await peer.until("t1")).at(-1)!.error.code).toBe(-32601);
		peer.send({ method: "auth", id: "a2", params: { scheme: "guest" } });
		expect((await peer.next()).result.you.user_id).toBe("bleachers");
		peer.send({ method: "me", id: "drain", params: {} });
		await peer.until("drain");
		// Signing in again as the same reader sends nothing more.
		peer.send({ method: "auth", id: "a3", params: { scheme: "guest" } });
		peer.send({ method: "me", id: "after", params: {} });
		expect((await peer.until("after")).map((frame) => frame.id)).toEqual(["a3", "after"]);
		for (const [method, params] of [
			["message", { room_id: "dugout", body: { text: "Who's on first?" } }],
			["reactions", { message_id: "1", emojis: ["👍"] }],
			["room_join", { room_id: "bullpen" }],
			["me", { name: "Who" }],
			["command", { body: { text: "/nick Who" } }],
		] as const) {
			peer.send({ method, id: method, params });
			expect((await peer.until(method)).at(-1)!.error.code).toBe(-32001);
		}
		for (const method of ["history", "push_shiny"]) {
			peer.send({ method, id: method, params: {} });
			expect((await peer.until(method)).at(-1)!.error.code).toBe(-32601);
		}
		peer.close();
	});

	it("answers pings, and closes a connection that sends too much", async () => {
		const peer = await connect();
		await opening(peer);
		peer.send(PING);
		expect((await peer.next()).method).toBe("pong");
		peer.send({ method: "ping" });
		expect((await peer.next()).method).toBe("pong");
		peer.send("x".repeat(5000));
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(peer.closed()?.code).toBe(1009);

		const loop = await connect();
		await opening(loop);
		for (let i = 0; i < MAX_FRAMES; i++) loop.send({ method: "activity", params: { typing: 1 } });
		const last = await loop.next();
		expect(last.error.code).toBe(-32002);
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(loop.closed()?.code).toBe(1008);
	});
});

describe("scene extensions", () => {
	it("shows presence: the status capability, each user's status, and idle reports answered", async () => {
		const peer = await connect("/team");
		const { server, auth, pushed } = await opening(peer);
		expect(server.params.capabilities).toContain("status");
		expect(auth.result.you).toMatchObject({ user_id: "ada", status: "online" });
		expect(pushed[0]!.params.users.find((user: any) => user.user_id === "tomas")).toMatchObject({ status: "idle" });
		// After a sign-in, each other user's shown status, but offline ones (PROTOCOL.md §4.5.4).
		const statuses = pushed.filter((frame) => frame.method === "user").map((frame) => frame.params.new);
		expect(statuses).toContainEqual({ user_id: "tomas", status: "idle" });
		expect(statuses.find((user: any) => user.user_id === "jun")).toBeUndefined();
		expect(statuses.find((user: any) => user.user_id === "ada")).toBeUndefined();
		peer.send({ method: "status", id: "idle", params: { idle: 300 } });
		expect((await peer.until("idle")).at(-1)!.result).toEqual({});
		peer.close();
	});

	it("shows typing, last", async () => {
		const peer = await connect("/rich");
		const { server, pushed } = await opening(peer);
		expect(server.params.capabilities).toContain("activity");
		expect(pushed.at(-1)).toEqual({ method: "activity", params: { room_id: "design", from: { user_id: "tomas", name: "Tomás" }, typing: 600 } });
		peer.close();
	});

	it("leaves out what a scene doesn't have", async () => {
		const peer = await connect("/whosonfirst");
		const { server } = await opening(peer);
		expect(server.params.capabilities).not.toContain("status");
		expect(server.params.capabilities).not.toContain("activity");
		peer.send({ method: "status", id: "idle", params: { idle: 300 } });
		expect((await peer.until("idle")).at(-1)!.error.code).toBe(-32001);
		peer.close();
	});

	it("serves live text on its timeline, which an embed follows", async () => {
		const peer = await connect("/agent");
		const { pushed } = await opening(peer);
		const suite = pushed.find((frame) => frame.method === "message" && frame.params.body.embeds?.[0]?.url)!;
		expect(suite.params.body.embeds[0]).toMatchObject({ kind: "terminal", title: "npm test", url: "https://scene.test/agent/live/suite" });
		const finished = pushed.find((frame) => frame.method === "message" && frame.params.body.embeds?.[0]?.output)!;
		expect(finished.params.body.embeds[0]).toMatchObject({ kind: "terminal", title: "npm test -- --repeat 50" });
		peer.close();

		// Held open after its last chunk, as live; read until the last chunk, then let go.
		const response = await SELF.fetch("https://scene.test/agent/live/suite");
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
		expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
		// Never compressed, which holds small chunks back until the stream ends.
		expect(response.headers.get("Content-Encoding")).toBe("identity");
		const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
		let text = "";
		while (!text.includes("12/19")) {
			const { done, value } = await reader.read();
			expect(done).toBe(false);
			text += value;
		}
		expect(text).toContain("tests/history.test.ts");
		const held = await Promise.race([reader.read().then(() => "ended"), new Promise((resolve) => setTimeout(() => resolve("open"), 300))]);
		expect(held).toBe("open");
		await reader.cancel();
		expect((await SELF.fetch("https://scene.test/agent/live/nope")).status).toBe(404);
		expect((await SELF.fetch("https://scene.test/team/live/suite")).status).toBe(404);
	});
});

describe("media", () => {
	it("comes from the host the scene is served from", async () => {
		for (const [host, origin] of [["scene.apron.chat", "https://scene.apron.chat"], ["scene.test", "https://scene.test"], ["preview.scene.test", "https://preview.scene.test"]]) {
			const peer = await connect("/whosonfirst", undefined, host);
			const { pushed } = await opening(peer);
			const who = pushed[0]!.params.users.find((user: any) => user.user_id === "who");
			expect(who.avatar).toBe(`${origin}/whosonfirst/who.png`);
			const board = pushed.find((frame) => frame.method === "message" && frame.params.body?.embeds)!;
			expect(board.params.body.embeds[0]).toMatchObject({ kind: "upload", url: `${origin}/whosonfirst/whiteboard.png`, og: { image: { url: `${origin}/whosonfirst/whiteboard.png`, width: 1200, height: 800 } } });
			const all = pushed.map((frame) => JSON.stringify(frame)).join("\n");
			if (origin !== "https://scene.apron.chat") expect(all).not.toContain("https://scene.apron.chat");
			peer.close();
		}
	});
});

describe("the Worker", () => {
	it("redirects a visit to a link that opens the scene", async () => {
		const response = await SELF.fetch("https://scene.apron.chat/whosonfirst?room=dugout&utm=x", { redirect: "manual" });
		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toBe("https://link.apron.chat/#server=wss://scene.apron.chat/whosonfirst&room=dugout");
		// Without a room, the scene's own: whosonfirst opens on the dugout, agent on its thread.
		const slash = await SELF.fetch("https://scene.apron.chat/whosonfirst/", { redirect: "manual" });
		expect(slash.headers.get("Location")).toBe("https://link.apron.chat/#server=wss://scene.apron.chat/whosonfirst&room=dugout");
		const thread = await SELF.fetch("https://scene.apron.chat/agent?room=general", { redirect: "manual" });
		expect(thread.headers.get("Location")).toBe("https://link.apron.chat/#server=wss://scene.apron.chat/agent&room=general");
		const agent = await SELF.fetch("https://scene.apron.chat/agent", { redirect: "manual" });
		expect(agent.headers.get("Location")).toBe("https://link.apron.chat/#server=wss://scene.apron.chat/agent&room=fix-reconnect");
		const local = await SELF.fetch("http://localhost:8787/whosonfirst", { redirect: "manual" });
		expect(local.headers.get("Location")).toBe("https://link.apron.chat/#server=ws://localhost:8787/whosonfirst&room=dugout");
	});

	it("refuses unknown scenes without reaching an object", async () => {
		expect((await SELF.fetch("https://scene.test/nope")).status).toBe(404);
		expect((await SELF.fetch("https://scene.test/../etc", { headers: { Upgrade: "websocket" } })).status).toBe(404);
		expect((await SELF.fetch("https://scene.test/Who's%20on", { headers: { Upgrade: "websocket" } })).status).toBe(404);
	});

	it("lists the scenes", async () => {
		const response = await SELF.fetch("https://scene.test/");
		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain('<a href="/whosonfirst">Who&#39;s on First?</a>');
	});

	it("limits connections from one address", async () => {
		const ip = "198.51.100.7";
		let refused: Response | undefined;
		for (let i = 0; i < 40 && !refused; i++) {
			const response = await SELF.fetch("https://scene.test/whosonfirst", { headers: { Upgrade: "websocket", "CF-Connecting-IP": ip } });
			if (response.status === 101) response.webSocket!.accept(), response.webSocket!.close();
			else refused = response;
		}
		expect(refused?.status).toBe(429);
		const status = await SELF.fetch("https://scene.test/whosonfirst?apron_connection_status=1", { headers: { "CF-Connecting-IP": ip, Origin: "https://web.apron.chat" } });
		expect(status.status).toBe(429);
		expect(status.headers.get("Apron-Connection-Status")).toBe("1");
		expect(status.headers.get("Retry-After")).toBe("60");
		expect(await status.json()).toEqual({ error: expect.stringContaining("Too many connections") });
	});
});
