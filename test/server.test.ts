import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { MAX_FRAMES, PING, PONG } from "../src/server";

type Frame = { id?: string; method?: string; params?: any; result?: any; error?: any };

/** Opens a WebSocket to a scene and queues its frames. */
async function connect(path = "/whosonfirst", ip = `192.0.2.${Math.floor(Math.random() * 250) + 1}`) {
	const response = await SELF.fetch(`https://scene.test${path}`, { headers: { Upgrade: "websocket", "CF-Connecting-IP": ip } });
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

async function signIn(peer: Awaited<ReturnType<typeof connect>>) {
	const server = await peer.next();
	peer.send({ method: "auth", id: "a1", params: { scheme: "guest" } });
	const frames = await peer.next();
	return { server, auth: frames };
}

describe("a scene over the protocol", () => {
	it("greets with a read-only server frame", async () => {
		const peer = await connect();
		const server = await peer.next();
		expect(server.method).toBe("server");
		expect(server.params).toMatchObject({ apron: 10, auth: ["guest"], ping: 45, title: "Who's on First?" });
		expect(server.params.capabilities).toEqual(["history", "rooms", "reactions", "ext:settings", "ext:permissions", "ext:archive", "ext:bio"]);
		expect(server.params.ext).toEqual({ settings: { read_cursors: false }, archive: { server: "wss://scene.apron.chat/whosonfirst" } });
		peer.close();
	});

	it("signs in as the scene's reader, allowed only to read, then pushes the scene", async () => {
		const peer = await connect();
		await peer.next();
		peer.send({ method: "auth", id: "a1", params: { scheme: "guest" } });
		const auth = await peer.next();
		expect(auth.id).toBe("a1");
		expect(auth.result.you).toMatchObject({ user_id: "bleachers", name: "Bleachers", ext: { permissions: { write: false, add_members: false, move_any: false } } });
		// A marker after the push: everything before it was pushed unasked.
		peer.send({ method: "room_list", id: "marker", params: {} });
		const pushed = (await peer.until("marker")).slice(0, -1);
		const methods = new Set(pushed.map((frame) => frame.method));
		expect([...methods].sort()).toEqual(["message", "reactions", "room_update", "user"]);
		const users = pushed.filter((frame) => frame.method === "user").map((frame) => frame.params.new.user_id);
		expect(users).toContain("who");
		expect(users).not.toContain("bleachers");
		// Records of joined rooms only, in log order.
		const records = pushed.filter((frame) => frame.method !== "user").map((frame) => frame.params.log_id ?? frame.params.memberships[0].log_id);
		expect(records).toEqual([...records].sort((a, b) => a.length - b.length || a.localeCompare(b)));
		const rooms = new Set(pushed.filter((frame) => frame.method === "message").map((frame) => frame.params.room_id));
		expect([...rooms].sort()).toEqual(["dugout", "i-dont-know", "lineup", "whos-on-first"]);
		// A reply carries the snapshot it replies to.
		const reply = pushed.find((frame) => frame.method === "message" && frame.params.reply_to)!;
		expect(reply.params.reply_to.from).toBeDefined();
		peer.close();
	});

	it("lists rooms and pages history like a server", async () => {
		const peer = await connect();
		await signIn(peer);
		peer.send({ method: "room_list", id: "r1", params: { members: true } });
		const list = (await peer.until("r1")).at(-1)!.result;
		expect(list.joined.map((room: any) => room.room_id).sort()).toEqual(["dugout", "i-dont-know", "lineup", "whos-on-first"]);
		expect(list.not_joined.map((room: any) => room.room_id)).toEqual(["bullpen"]);
		const dugout = list.joined.find((room: any) => room.room_id === "dugout");
		expect(dugout).toMatchObject({ title: "Dugout", history_log_id: dugout.log_id });
		expect(dugout.members.map((member: any) => member.user_id)).toContain("bleachers");
		expect(list.users.find((user: any) => user.user_id === "who")).toMatchObject({ name: "Who", roles: ["1B"] });

		// Threads of the dugout.
		peer.send({ method: "room_list", id: "r2", params: { parent_room_id: "dugout" } });
		const threads = (await peer.until("r2")).at(-1)!.result;
		expect(threads.joined.map((room: any) => room.title).sort()).toEqual(["I Don't Know", "Who's on first"]);

		// The newest page, then older ones to the start, which gather every record of the room once.
		const seen = new Set<string>();
		let before: string | undefined;
		for (let page = 0; ; page++) {
			peer.send({ method: "history", id: `h${page}`, params: { room_id: "dugout", limit: 25, ...(before ? { before } : {}) } });
			const result = (await peer.until(`h${page}`)).at(-1)!.result;
			expect(result.latest_log_id).toBe(dugout.latest_log_id);
			for (const kind of ["rooms", "messages", "reactions", "memberships"]) for (const record of result[kind]) seen.add(`${kind}:${record.log_id}`);
			if (!result.more) break;
			before = String(Number(result.first_log_id) - 1);
		}
		expect([...seen].filter((key) => key.startsWith("messages:")).length).toBeGreaterThan(60);
		expect(seen.has(`rooms:${dugout.log_id}`)).toBe(true);

		// A room you haven't joined reads through its history too.
		peer.send({ method: "history", id: "b1", params: { room_id: "bullpen", after: "1" } });
		const bullpen = (await peer.until("b1")).at(-1)!.result;
		expect(bullpen.messages.length).toBe(8);
		expect(bullpen.more).toBe(false);

		peer.send({ method: "history", id: "x1", params: { room_id: "nowhere" } });
		expect((await peer.until("x1")).at(-1)!.error.code).toBe(-32602);
		peer.close();
	});

	it("refuses everything that would change something", async () => {
		const peer = await connect();
		await peer.next();
		peer.send({ method: "message", id: "m0", params: { room_id: "dugout", body: { text: "early" } } });
		expect((await peer.next()).error.code).toBe(-32001);
		peer.send({ method: "auth", id: "a1", params: { scheme: "token", token: "x" } });
		expect((await peer.next()).error.code).toBe(-32601);
		peer.send({ method: "auth", id: "a2", params: { scheme: "guest" } });
		expect((await peer.next()).result.you.user_id).toBe("bleachers");
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
		peer.send({ method: "push_shiny", id: "u1", params: {} });
		expect((await peer.until("u1")).at(-1)!.error.code).toBe(-32601);
		peer.close();
	});

	it("answers pings, and closes a connection that sends too much", async () => {
		const peer = await connect();
		await peer.next();
		peer.send(PING);
		expect((await peer.next()).method).toBe("pong");
		peer.send({ method: "ping" });
		expect((await peer.next()).method).toBe("pong");
		peer.send("x".repeat(5000));
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(peer.closed()?.code).toBe(1009);

		const loop = await connect();
		await loop.next();
		for (let i = 0; i <= MAX_FRAMES; i++) loop.send({ method: "activity", params: { typing: 1 } });
		const last = await loop.next();
		expect(last.error.code).toBe(-32002);
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(loop.closed()?.code).toBe(1008);
	});
});

describe("the Worker", () => {
	it("redirects a visit to a link that opens the scene", async () => {
		const response = await SELF.fetch("https://scene.apron.chat/whosonfirst?room=dugout&utm=x", { redirect: "manual" });
		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toBe("https://link.apron.chat/#server=wss://scene.apron.chat/whosonfirst&room=dugout");
		const slash = await SELF.fetch("https://scene.apron.chat/whosonfirst/", { redirect: "manual" });
		expect(slash.headers.get("Location")).toBe("https://link.apron.chat/#server=wss://scene.apron.chat/whosonfirst");
		const local = await SELF.fetch("http://localhost:8787/whosonfirst", { redirect: "manual" });
		expect(local.headers.get("Location")).toBe("https://link.apron.chat/#server=ws://localhost:8787/whosonfirst");
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
