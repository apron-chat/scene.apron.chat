import { SCENES } from "./scenes.gen";
import { parseScene, type Scene } from "./scene";

/** A scene's name: its file's, `scenes/<name>.jsonl`. */
export const SCENE_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Parsed once per isolate, when first served. */
const parsed = new Map<string, Scene>();

/** The scene of that name, or undefined when there is none. */
export function loadScene(name: string): Scene | undefined {
	if (!Object.hasOwn(SCENES, name)) return undefined;
	let scene = parsed.get(name);
	if (!scene) {
		scene = parseScene(SCENES[name]!);
		parsed.set(name, scene);
	}
	return scene;
}

/** Whether there is a scene of that name, without reading it. */
export function hasScene(name: string): boolean {
	return Object.hasOwn(SCENES, name);
}

/** The names of every scene. */
export function sceneNames(): string[] {
	return Object.keys(SCENES).sort();
}
