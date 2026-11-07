import { link } from "./link";
import { serve, serveLive } from "./connection";
import { getScene, SCENE_NAME } from "./scenes";

/**
 * scene.apron.chat:
 *
 * - `/<name>`, a WebSocket: the scene, served by this Worker (`serve`).
 * - `/<name>`, a page visit: a redirect to `link.apron.chat`, which opens the scene in a client.
 * - `/<name>/scene.jsonl`: the scene's file, a static asset that never runs this Worker, as is its media in `/<name>/`.
 * - `/<name>/live/<id>`: a scene's live text, written on its timeline (`serveLive`).
 * - `/`: the landing page, `scenes/index.html`, a static asset that the build writes (scripts/landing.mjs).
 *
 * WebSockets are limited per address (`CONNECTIONS`), so a client that reconnects in a loop can't run up requests.
 */
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		// A scene's live text: /<name>/live/<id>.
		const live = /^\/([a-z0-9][a-z0-9-]{0,63})\/live\/([\w-]{1,64})$/.exec(url.pathname);
		if (live) {
			const chunks = getScene(live[1]!)?.live[live[2]!];
			if (!chunks || request.method !== "GET") return text(404, "No such live text");
			return serveLive(chunks);
		}
		const name = url.pathname.replace(/^\/|\/$/g, "");
		const scene = SCENE_NAME.test(name) ? getScene(name, url.origin) : undefined;
		if (!scene) return text(404, "No such scene. The list is at /");

		const upgrade = request.headers.get("Upgrade")?.toLowerCase() === "websocket";
		const status = url.searchParams.get("apron_connection_status") === "1";
		if (upgrade || status) {
			if (request.method !== "GET") return text(405, "Method not allowed");
			const { success } = await env.CONNECTIONS.limit({ key: request.headers.get("CF-Connecting-IP") ?? "unknown" });
			// After a refused handshake a client asks why over HTTP (apron-web EXT.md §5): told to wait, it does.
			if (!success) return refused(request, "Too many connections from your address; try again in a minute", 60);
			if (!upgrade) return text(404, "Connections are open");
			return serve(scene);
		}
		if (request.method !== "GET" && request.method !== "HEAD") return text(405, "Method not allowed");
		return Response.redirect(link(url, name, scene.room), 302);
	},
} satisfies ExportedHandler<Env>;

function refused(request: Request, error: string, retryAfter: number): Response {
	return new Response(JSON.stringify({ error }), {
		status: 429,
		headers: {
			"Content-Type": "application/json",
			"Apron-Connection-Status": "1",
			"Retry-After": String(retryAfter),
			"Access-Control-Allow-Origin": request.headers.get("Origin") ?? "*",
			"Access-Control-Expose-Headers": "Apron-Connection-Status, Retry-After",
		},
	});
}

function text(status: number, body: string): Response {
	return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
