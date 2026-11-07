import type { CompiledScene } from "./scene";
import { SCENES } from "./scenes.gen";

/** A scene's name: its file's, `scenes/<name>.jsonl`. */
export const SCENE_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** The scene of that name, as compiled at build time, or undefined when there is none. */
export function getScene(name: string): CompiledScene | undefined {
	return Object.hasOwn(SCENES, name) ? SCENES[name] : undefined;
}

/** The names of every scene. */
export function sceneNames(): string[] {
	return Object.keys(SCENES).sort();
}
