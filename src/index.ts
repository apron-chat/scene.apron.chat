import { link, LINK_ORIGIN } from "./link";
import { hasScene, loadScene, SCENE_NAME, sceneNames } from "./scenes";

export { SceneServer } from "./server";

/**
 * scene.apron.chat:
 *
 * - `/<name>`, a WebSocket: the scene, served by its Durable Object (`SceneServer`).
 * - `/<name>`, a page visit: a redirect to `link.apron.chat`, which opens the scene in a client.
 * - `/<name>.jsonl`: the scene's file, a static asset that never runs this Worker.
 * - `/`: the list of scenes.
 *
 * Unknown names are refused here, before any Durable Object is reached. WebSockets are limited per address
 * (`CONNECTIONS`), so a client that reconnects in a loop can't run up requests.
 */
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === "/") return index(url);
		const name = url.pathname.replace(/^\/|\/$/g, "");
		if (!SCENE_NAME.test(name) || !hasScene(name)) return text(404, "No such scene. The list is at /");

		const upgrade = request.headers.get("Upgrade")?.toLowerCase() === "websocket";
		const status = url.searchParams.get("apron_connection_status") === "1";
		if (upgrade || status) {
			if (request.method !== "GET") return text(405, "Method not allowed");
			const { success } = await env.CONNECTIONS.limit({ key: request.headers.get("CF-Connecting-IP") ?? "unknown" });
			// After a refused handshake a client asks why over HTTP (apron-web EXT.md §5): told to wait, it does.
			if (!success) return refused(request, "Too many connections from your address; try again in a minute", 60);
			if (!upgrade) return text(404, "Connections are open");
			return env.SCENE.get(env.SCENE.idFromName(name)).fetch(request);
		}
		if (request.method !== "GET" && request.method !== "HEAD") return text(405, "Method not allowed");
		return Response.redirect(link(url, name), 302);
	},
} satisfies ExportedHandler<Env>;

function index(url: URL): Response {
	const rows = sceneNames()
		.map((name) => {
			const title = JSON.parse(loadScene(name)!.server).params.title ?? name;
			return `<li><a href="/${name}">${escape(title)}</a> <code>${escape(`wss://${url.host}/${name}`)}</code> <a href="/${name}.jsonl">jsonl</a></li>`;
		})
		.join("\n");
	const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Apron scenes</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem}code{font-size:.85em;opacity:.7}</style></head>
<body><h1>Apron scenes</h1><p>Static chats served read-only over the <a href="https://apron.chat/protocol">Apron protocol</a>, for any client to open. Each link opens one in <a href="${LINK_ORIGIN}">a web client</a>; or connect a client to its address.</p>
<ul>
${rows}
</ul></body></html>`;
	return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}

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

function escape(value: string): string {
	return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
