import { CANONICAL_ORIGIN, type CompiledScene } from "./scene";
import { SCENES } from "./scenes.gen";

/** A scene's name: its directory's, `scenes/<name>/`. */
export const SCENE_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Scenes as served from origins other than `CANONICAL_ORIGIN`, made once per isolate. */
const elsewhere = new Map<string, CompiledScene>();

/**
 * The scene of that name, as compiled at build time, or undefined when there is none. Served from `origin` other than
 * `CANONICAL_ORIGIN`, such as `wrangler dev` or a Preview, its own media is rewritten to come from `origin`, so that
 * clients load it from there (they load media from the server's origin, apron-web EXT.md §6).
 */
export function getScene(name: string, origin: string = CANONICAL_ORIGIN): CompiledScene | undefined {
	if (!Object.hasOwn(SCENES, name)) return undefined;
	const scene = SCENES[name]!;
	if (origin === CANONICAL_ORIGIN) return scene;
	const key = `${origin} ${name}`;
	let moved = elsewhere.get(key);
	if (!moved) {
		const at = (text: string) => text.replaceAll(CANONICAL_ORIGIN, origin);
		moved = {
			...scene,
			server: at(scene.server),
			auth: at(scene.auth),
			pushed: scene.pushed.map(at),
			replies: Object.fromEntries(Object.entries(scene.replies).map(([key, reply]) => [key, at(reply)])),
		};
		// Only this Worker's own hosts reach it, but the cache stays small whatever comes.
		if (elsewhere.size >= 16) elsewhere.clear();
		elsewhere.set(key, moved);
	}
	return moved;
}

/** The names of every scene. */
export function sceneNames(): string[] {
	return Object.keys(SCENES).sort();
}
