import { roomListKey, type CompiledScene, type Json } from "./scene";

export const PONG = '{"method":"pong"}';

/** The largest frame a reader has reason to send. Requests here are a few hundred bytes. */
export const MAX_FRAME_BYTES = 4096;

/**
 * How many frames a connection may send: reading a scene takes `auth` and a few `room_list`s (seven frames from
 * apron-web), and the server asks for no pings. Past it, the connection is closed: each frame runs this Worker's
 * code, and this bounds the CPU time one connection can use.
 */
export const MAX_FRAMES = 100;

/** Methods that would change something (ARCHIVE.md §4): `denied`. Any other unknown method is `unsupported`. */
const WRITES = new Set(["me", "message", "command", "reactions", "room_set", "room_join", "room_leave", "status", "push_register", "push_unregister"]);

/** Schemes that PROTOCOL.md §3.2 defines, which this doesn't offer: `unsupported`. Any other is `invalid_params`. */
const SCHEMES = new Set(["token", "webauthn", "email", "external"]);

/**
 * Serves a scene on a new WebSocket, from the Worker itself: a connection shares nothing with any other, so it needs
 * no Durable Object. Cloudflare bills the upgrade as one Worker request, and nothing for the frames or for the time
 * the connection stays open; only the CPU time of the handlers below. A connection is left open for as long as the
 * client keeps it: idle, it costs nothing, and closing it would only make the client reconnect and be sent the scene
 * again.
 *
 * The `server` frame goes at once. `auth`, which every client sends, is answered with the scene's reader, allowed only
 * to read, and followed by the whole scene (`CompiledScene.pushed`). `room_list` is answered from the scene's replies.
 * Each answer is a string compiled at build time, with only the request's `id` written in. Everything that would
 * change something is `denied`.
 */
export function serve(scene: CompiledScene): Response {
	const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
	server.accept();
	let frames = 0;
	let authed = false;

	server.addEventListener("message", ({ data }) => {
		if (server.readyState !== WebSocket.OPEN) return;
		if (typeof data !== "string" || data.length > MAX_FRAME_BYTES) return server.close(1009, "Frame too large");
		if (++frames > MAX_FRAMES) {
			// A reader never gets here; hold off a client that loops, and close (PROTOCOL.md §1.1).
			server.send(JSON.stringify({ error: { code: -32002, message: "Too many requests for a scene", data: { retry_after: 600 } } }));
			return server.close(1008, "Too many requests");
		}
		// The server asks for none (no `server.ping`), but answers a client that pings anyway (PROTOCOL.md §1).
		if (data === '{"method":"ping"}') return server.send(PONG);

		let frame: Json;
		try {
			const parsed: unknown = JSON.parse(data);
			if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not an object");
			frame = parsed as Json;
		} catch {
			return server.send(JSON.stringify({ error: { code: -32700, message: "Invalid JSON" } }));
		}
		if (frame.method === "ping") return server.send(PONG);
		// Notifications go nowhere: no one else is here.
		if (typeof frame.id !== "string" || typeof frame.method !== "string") return;

		const id = JSON.stringify(frame.id);
		const params = typeof frame.params === "object" && frame.params !== null ? (frame.params as Json) : {};
		const reply = (result: string) => server.send(`{"id":${id},"result":${result}}`);
		const fail = (code: number, text: string) => server.send(`{"id":${id},"error":${JSON.stringify({ code, message: text })}}`);
		if (frame.method === "auth") {
			if (params.scheme !== "guest") return fail(SCHEMES.has(params.scheme as string) ? -32601 : -32602, "This scene offers only guest sign-in, to read.");
			reply(scene.auth);
			// Its sign-in's deliveries come after its result (PROTOCOL.md §3.2.2). `auth` again as the same reader is
			// not a sign-in, and gets nothing more.
			if (!authed) for (const pushed of scene.pushed) server.send(pushed);
			authed = true;
		} else if (!authed) {
			fail(-32001, "Sign in as a guest first.");
		} else if (frame.method === "room_list") {
			const key = roomListKey(params);
			if (Object.hasOwn(scene.replies, key)) reply(scene.replies[key]!);
			else fail(-32602, "This scene has no such room.");
		} else if (WRITES.has(frame.method)) {
			fail(-32001, "This scene is read-only: nothing in it can change.");
		} else {
			fail(-32601, "Unsupported method");
		}
	});
	server.addEventListener("close", ({ code, reason }) => {
		try {
			server.close(code, reason);
		} catch {
			// Already closed.
		}
	});

	server.send(scene.server);
	return new Response(null, { status: 101, webSocket: client });
}
