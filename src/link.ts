/** The web client that opens Apron links (PROTOCOL.md Appendix A.4). */
export const LINK_ORIGIN = "https://link.apron.chat";

/** Link keys that a visit to a scene passes on to its link, such as `?room=dugout`. */
const LINK_KEYS = ["room", "message", "user"];

/** `https://link.apron.chat/#server=wss://scene.apron.chat/<name>`, with the link keys of the visit. */
export function link(url: URL, name: string): string {
	const server = `${url.protocol === "http:" ? "ws:" : "wss:"}//${url.host}/${name}`;
	const keys = [["server", server], ...LINK_KEYS.flatMap((key) => (url.searchParams.has(key) ? [[key, url.searchParams.get(key)!]] : []))];
	// `:` and `/` stay as they are, as apron-web writes links; everything else that could end a key is encoded.
	return `${LINK_ORIGIN}/#${keys.map(([key, value]) => `${key}=${encodeURIComponent(value!).replace(/%3A/gi, ":").replace(/%2F/gi, "/")}`).join("&")}`;
}

