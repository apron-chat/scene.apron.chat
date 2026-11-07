// Types for scripts/landing.mjs, which the build runs with Node and the tests import.
export interface SceneSummary {
	title?: string;
	description?: string;
	avatar?: string;
	room?: string;
	counts: { rooms: number; threads: number; DMs: number; messages: number; people: number };
	features: string[];
}
export function describe(text: string): SceneSummary;
export function landing(scenes: [name: string, text: string][], options?: { version?: (path: string) => string | undefined }): string;
