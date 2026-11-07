import { DurableObject } from "cloudflare:workers";
import { history, listRooms, type Json, type Scene } from "./scene";
import { loadScene } from "./scenes";

/** Answered by the runtime itself, without waking the object (PROTOCOL.md §1). */
export const PING = '{"method":"ping"}';
export const PONG = '{"method":"pong"}';

/** The largest frame a reader has reason to send. Requests here are a few hundred bytes. */
export const MAX_FRAME_BYTES = 4096;

/**
 * How many frames one connection may send, pings answered by the runtime not counted. Reading a scene takes
 * `auth`, a few `room_list`s, and a `history` page per room; past this, the connection is closed.
 */
export const MAX_FRAMES = 300;

/** Methods that would change something (ARCHIVE.md §4): `denied`. Any other unknown method is `unsupported`. */
const WRITES = new Set(["me", "message", "command", "reactions", "room_set", "room_join", "room_leave", "status", "push_register", "push_unregister"]);

/** Schemes that PROTOCOL.md §3.2 defines, which this doesn't offer: `unsupported`. Any other is `invalid_params`. */
const SCHEMES = new Set(["token", "webauthn", "email", "external"]);

/** What a connection keeps across hibernation (`serializeAttachment`). */
interface Connection {
	scene: string;
	frames: number;
	/** Signed in: the scene has been pushed. */
	authed: boolean;
}

/**
 * Serves scenes, one object per scene (`idFromName`), read-only.
 *
 * A connection gets the `server` frame on open. Its `auth` signs it in as the scene's `you`, allowed only to read,
 * and is followed at once by every record of the rooms `you` joined, as live deliveries. `room_list` and `history`
 * are answered from the scene for clients that page; everything that would change something is `denied`.
 *
 * Then it goes idle: pings are answered by the runtime (`setWebSocketAutoResponse`), so an open connection that
 * only pings never wakes the object, which hibernates and is billed for nothing. It keeps no storage, alarms, or
 * timers, which would keep it awake.
 */
export class SceneServer extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
	}

	override async fetch(request: Request): Promise<Response> {
		const name = new URL(request.url).pathname.split("/")[1] ?? "";
		const scene = loadScene(name);
		if (!scene) return new Response("No such scene", { status: 404 });
		if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("WebSocket upgrade required", { status: 426 });
		const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
		this.ctx.acceptWebSocket(server);
		server.serializeAttachment({ scene: name, frames: 0, authed: false } satisfies Connection);
		server.send(scene.server);
		return new Response(null, { status: 101, webSocket: client });
	}

	override webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
		const connection = ws.deserializeAttachment() as Connection | null;
		const scene = connection && loadScene(connection.scene);
		if (!connection || !scene) return ws.close(1011, "Scene unavailable");
		if (typeof message !== "string" || message.length > MAX_FRAME_BYTES) return ws.close(1009, "Frame too large");
		if (++connection.frames > MAX_FRAMES) {
			// A reader never gets here; hold off a client that loops, and close (PROTOCOL.md §1.1).
			ws.send(JSON.stringify({ error: { code: -32002, message: "Too many requests for a scene", data: { retry_after: 600 } } }));
			return ws.close(1008, "Too many requests");
		}
		const signedIn = this.receive(ws, scene, connection, message);
		if (signedIn) connection.authed = true;
		ws.serializeAttachment(connection);
	}

	override webSocketClose(ws: WebSocket, code: number, reason: string): void {
		try {
			ws.close(code, reason);
		} catch {
			// Already closed: the runtime replied to the close.
		}
	}

	/** Handles one frame; true when it signed the connection in. */
	private receive(ws: WebSocket, scene: Scene, connection: Connection, message: string): boolean {
		let frame: Json;
		try {
			const parsed: unknown = JSON.parse(message);
			if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not an object");
			frame = parsed as Json;
		} catch {
			ws.send(JSON.stringify({ error: { code: -32700, message: "Invalid JSON" } }));
			return false;
		}
		// A ping with other spacing or keys, which the runtime didn't recognize.
		if (frame.method === "ping") {
			ws.send(PONG);
			return false;
		}
		// Notifications go nowhere: no one else is here. Replies to nothing are ignored.
		if (typeof frame.id !== "string" || typeof frame.method !== "string") return false;
		const id = frame.id;
		const params = typeof frame.params === "object" && frame.params !== null ? (frame.params as Json) : {};
		const reply = (result: Json) => ws.send(JSON.stringify({ id, result }));
		const fail = (code: number, text: string) => ws.send(JSON.stringify({ id, error: { code, message: text } }));

		if (frame.method === "auth") {
			if (params.scheme !== "guest") {
				fail(SCHEMES.has(params.scheme as string) ? -32601 : -32602, "This scene offers only guest sign-in, to read.");
				return false;
			}
			reply({ you: scene.you });
			// A sign-in is followed by its deliveries (PROTOCOL.md §3.2.2); `auth` again as the same reader is not one.
			if (!connection.authed) for (const frame of scene.pushed) ws.send(frame);
			return true;
		}
		if (!connection.authed) return fail(-32001, "Sign in as a guest first."), false;
		switch (frame.method) {
			case "room_list":
				reply(listRooms(scene, params));
				break;
			case "history": {
				const page = history(scene, params);
				if (page) reply(page);
				else fail(-32602, "This scene has no such room.");
				break;
			}
			default:
				if (WRITES.has(frame.method)) fail(-32001, "This scene is read-only: nothing in it can change.");
				else fail(-32601, "Unsupported method");
		}
		return false;
	}
}
