// Writes scenes/{team,agent,rich}/scene.jsonl from apron.chat's screenshot
// fixtures (screenshot/scenes/*.js there, copied unchanged into fixtures/):
// the same users, rooms, messages, reactions, typing, files and live terminal
// output, as static scenes. The fixture server timed them in minutes before it
// started; here they end at END, a fixed time. Pictures in a scene's directory
// add what the fixtures don't have: <user_id>.png is that user's avatar, and
// scene.png the scene's. (apron.chat's piper fixture grew into its own
// script, piper.mjs.)
//
//   node scripts/scenes/fixtures.mjs [name ...]
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Script } from "./lib.mjs";

const ORIGIN = "https://scene.apron.chat";
const END = Date.parse("2026-11-02T17:00:00Z");
/** Who the fixture server signed every connection in as. */
const YOU = "ada";

const SCENES = {
	team: { title: "Team chat", description: "A small team's day: a thread, a bot, an admin, replies, a code block, reactions and presence." },
	agent: { title: "Coding agent", description: "A coding agent fixing a flaky test in a thread, with a finished terminal run and a live one." },
	rich: { title: "Design review", description: "An uploaded image, a mention, a link preview, reactions, and someone typing." },
};

for (const name of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENES)) {
	const fixture = (await import(`./fixtures/${name}.js`)).default;
	const media = `${ORIGIN}/${name}`;
	const minutesAgo = (minutes) => END - minutes * 60_000;
	// Pictures the scene's directory has by name: <user_id>.png, a user's avatar, and scene.png, the scene's own.
	const picture = (file) => (existsSync(fileURLToPath(new URL(`../../scenes/${name}/${file}`, import.meta.url))) ? `${media}/${file}` : undefined);
	const s = new Script({ start: new Date(minutesAgo(240) - 1).toISOString(), you: YOU, users: fixture.users, avatars: (user_id) => picture(`${user_id}.png`) });
	/** Each record a millisecond past the last at least, as the fixture server's log_ids were. */
	const at = (time) => {
		if (time - 1 > s.now) s.at(time - 1);
		return { after: 0.001 };
	};

	for (const { room_id, members, title, description, parent_room_id, private: isPrivate } of fixture.rooms) {
		s.room(room_id, { ...at(minutesAgo(240)), joined: members.includes(YOU), announce: false, ...(title ? { title } : {}), ...(description ? { description } : {}), ...(parent_room_id ? { parent_room_id } : {}), ...(isPrivate ? { private: true } : {}) }, members);
	}

	// Paths the fixture server served itself, /files/<name> and /streams/<name>, as this scene's own.
	const url = (path) => path?.replace(/^\/files\//, `${media}/`).replace(/^\/streams\//, `${media}/live/`);
	const embed = ({ kind, format, text, url: link, og, ...rest }) => {
		// apron 9's `stream` embed with `format: "terminal"` is apron 10's `terminal` (PROTOCOL.md §4.8.6): its
		// finished `text` is `output`, and while it runs it has a `url`.
		if (kind === "stream" && format === "terminal") return { ...rest, kind: "terminal", ...(text !== undefined ? { output: text } : {}), ...(link ? { url: url(link) } : {}) };
		return { ...rest, kind, ...(link ? { url: url(link) } : {}), ...(og ? { og: { ...og, ...(og.image ? { image: { ...og.image, url: url(og.image.url) } } : {}) } } : {}) };
	};

	const keys = new Map();
	const events = [
		...fixture.script.map(([ago, room_id, from, text, options = {}]) => ({ ago, message: { room_id, from, text, ...options } })),
		...(fixture.reactions ?? []).map(([ago, key, from, emojis]) => ({ ago, reaction: { key, from, emojis } })),
	].sort((a, b) => b.ago - a.ago);
	for (const { ago, message, reaction } of events) {
		if (message) {
			const { room_id, from, text, key, reply, mentions, embeds } = message;
			const id = s.say(room_id, from, text, { ...at(minutesAgo(ago)), ...(reply ? { reply: keys.get(reply) } : {}), ...(mentions ? { mentions } : {}), ...(embeds ? { embeds: embeds.map(embed) } : {}) });
			if (key) keys.set(key, id);
		} else {
			s.react(keys.get(reaction.key), reaction.from, reaction.emojis, at(minutesAgo(ago)));
		}
	}
	for (const { room_id, user } of fixture.typing ?? []) s.typing(room_id, user);
	for (const [stream, chunks] of Object.entries(fixture.streams ?? {})) s.live(stream, chunks);

	// The fixture's files, next to the scene: copied from where the fixture names them, or already there.
	const files = Object.entries(fixture.files ?? {});
	for (const [file, from] of files) {
		const to = fileURLToPath(new URL(`../../scenes/${name}/${file}`, import.meta.url));
		const source = fileURLToPath(new URL(`./fixtures/${from}`, import.meta.url));
		mkdirSync(fileURLToPath(new URL(`../../scenes/${name}/`, import.meta.url)), { recursive: true });
		if (existsSync(source)) copyFileSync(source, to);
		else if (!existsSync(to)) throw new Error(`${name}: ${file} is neither at ${source} nor at ${to}`);
	}

	const { room, thread } = fixture.open ?? {};
	mkdirSync(fileURLToPath(new URL(`../../scenes/${name}/`, import.meta.url)), { recursive: true });
	const out = new URL(`../../scenes/${name}/scene.jsonl`, import.meta.url);
	const avatar = picture("scene.png");
	const pictures = files.length > 0 || avatar !== undefined || Object.keys(fixture.users).some((user_id) => picture(`${user_id}.png`));
	writeFileSync(out, s.archive({ server: `wss://scene.apron.chat/${name}`, ...SCENES[name], ...(avatar ? { avatar } : {}), ...(thread ?? room ? { room: thread ?? room } : {}), ...(pictures ? { media: [ORIGIN] } : {}) }));
	console.log(`Wrote ${fileURLToPath(out)}`);
}
