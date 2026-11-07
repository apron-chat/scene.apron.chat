// The landing page, scenes/index.html: every scene, what it shows, and how to
// open it. Written by scripts/build.mjs, so it is a static asset: visiting it
// runs no Worker. It follows apron.chat's look (public/site.css there).

const CANONICAL = "https://scene.apron.chat";
const REPO = "https://github.com/apron-chat/scene.apron.chat";

const escape = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** What a scene has to show, read from its file: counts, and the protocol features it uses. */
export function describe(text) {
	const lines = text.split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line));
	const [header, ...parts] = lines;
	const all = (key) => parts.flatMap((part) => (Array.isArray(part[key]) ? part[key] : []));
	const rooms = new Map([...all("joined"), ...all("not_joined")].map((room) => [room.room_id, room]));
	const users = new Map(all("users").map((user) => [user.user_id, user]));
	const latest = new Map();
	for (const message of all("messages")) latest.set(message.message_id, message);
	const messages = [...latest.values()].filter((message) => rooms.has(message.room_id));
	const snapshots = all("messages");
	const embeds = messages.flatMap((message) => message.body?.embeds ?? []);
	const has = {
		threads: [...rooms.values()].some((room) => room.parent_room_id),
		DMs: [...rooms.values()].some((room) => room.private),
		replies: messages.some((message) => message.reply_to),
		mentions: messages.some((message) => message.body?.mentions?.length),
		reactions: all("reactions").length > 0,
		"joins & leaves": all("memberships").some((record) => record.members?.some((member) => !member.joined)),
		edits: snapshots.some((message) => message.log_id !== message.message_id && !message.deleted),
		deletions: messages.some((message) => message.deleted),
		"code blocks": messages.some((message) => message.body?.text?.includes("```")),
		images: embeds.some((embed) => embed.og?.image),
		"link previews": embeds.some((embed) => !embed.og?.image && embed.og?.title && embed.kind !== "upload"),
		terminal: embeds.some((embed) => embed.kind === "terminal"),
		"live text": parts.some((part) => part.live && Object.keys(part.live).length),
		avatars: [...users.values()].some((user) => user.avatar),
		badges: [...users.values()].some((user) => user.roles?.length),
		presence: [...users.values()].some((user) => typeof user.status === "string"),
		typing: all("activity").length > 0,
		bios: [...users.values()].some((user) => user.ext?.bio),
	};
	return {
		title: header.title,
		description: header.description,
		avatar: header.avatar,
		room: header.room,
		counts: {
			rooms: [...rooms.values()].filter((room) => !room.parent_room_id && !room.private).length,
			threads: [...rooms.values()].filter((room) => room.parent_room_id).length,
			DMs: [...rooms.values()].filter((room) => room.private && !room.parent_room_id).length,
			messages: messages.filter((message) => !message.deleted).length,
			people: [...users.keys()].filter((id) => id !== header.you?.user_id).length,
		},
		features: Object.entries(has).filter(([, yes]) => yes).map(([feature]) => feature),
	};
}

/** The first letters of the first two words, as clients draw a missing avatar. */
const initials = (title) => (title.match(/[\p{L}\p{N}]+/gu) ?? ["?"]).slice(0, 2).map((word) => [...word][0]).join("").toUpperCase();

const plural = (count, word) => `${count} ${count === 1 ? word.replace(/s$/, "") : word}`;

/**
 * Where the card's image loads from: the scene's header `avatar`, as clients show it for the server. One on the
 * scene's own origin loads from this page's host, with `version(path)` added, so that a new image under the same
 * name loads at once rather than when the old one's cache runs out; one elsewhere (`https:`, or a small inline
 * image) as it is. Anything else: none, and the card shows initials.
 */
function avatarSource(avatar, version) {
	if (typeof avatar !== "string") return undefined;
	if (avatar.startsWith(`${CANONICAL}/`)) {
		const path = avatar.slice(CANONICAL.length);
		const v = version?.(path);
		return v ? `${path}?v=${v}` : path;
	}
	if (/^https:\/\//.test(avatar) || /^data:image\/(png|jpeg|gif|webp);base64,/.test(avatar)) return avatar;
	return undefined;
}

function card(name, scene, version) {
	const avatar = avatarSource(scene.avatar, version);
	const title = scene.title ?? name;
	const counts = Object.entries(scene.counts)
		.filter(([, count]) => count > 0)
		.map(([what, count]) => plural(count, what))
		.join(" · ");
	return `<article class="scene" id="${escape(name)}">
<div class="head">
${avatar ? `<img class="avatar" src="${escape(avatar)}" width="56" height="56" alt="">` : `<span class="avatar mono" aria-hidden="true">${escape(initials(title))}</span>`}
<div>
<h3><a href="/${escape(name)}">${escape(title)}</a></h3>
<p class="counts">${escape(counts)}</p>
</div>
</div>
<ul class="tags" aria-label="What it shows">${scene.features.map((feature) => `<li>${escape(feature)}</li>`).join("")}</ul>
<div class="use">
<div class="address"><code data-scene="${escape(name)}">wss://scene.apron.chat/${escape(name)}</code><button type="button" class="copy" data-copy="${escape(name)}" aria-label="Copy the address of ${escape(title)}">copy</button></div>
<a class="button" href="/${escape(name)}">Open</a>
<a class="file" href="/${escape(name)}/scene.jsonl" download="${escape(name)}.jsonl">scene.jsonl</a>
</div>
</article>`;
}

/**
 * The page, for `scenes`: [name, file text] in the order to show them. Everything on a card comes from its scene's
 * file. `version`, given a served path such as `/piper/scene.png`, names that file's contents (the build hashes it).
 */
export function landing(scenes, { version } = {}) {
	const cards = scenes.map(([name, text]) => card(name, describe(text), version)).join("\n");
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Apron Scenes</title>
<meta name="description" content="Read-only scenes served over the Apron Chat Protocol, so any client can open them to explore, test, and generate screenshots.">
<link rel="icon" href="/apron-logo.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap">
<style>
:root { --paper: #fafaf8; --ink: #1a1a1a; --muted: #55554f; --chip: #eceae2; --rule: #d9d7ce; --accent: #a33e0c; --server: #1f5a9e; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 15px/1.65 "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace; }
a { color: var(--accent); }
a:hover { color: var(--ink); }
code { background: var(--chip); padding: 1px 5px; font: inherit; font-size: 0.92em; }
h1, h2, h3, p { margin: 0; }
.wrap { max-width: 1040px; margin: 0 auto; padding: 0 20px; }
header.top { border-bottom: 2px solid var(--ink); }
header.top nav { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px clamp(12px, 3.5vw, 28px); padding: 14px 16px; font-size: 14px; }
header.top nav a { color: var(--ink); }
header.top nav a.strong { color: var(--accent); font-weight: 700; }
.hero { padding: 56px 0 8px; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 28px 44px; }
.hero img { width: 128px; height: 128px; flex: 0 0 auto; }
.hero div { flex: 1 1 420px; min-width: 0; display: flex; flex-direction: column; gap: 14px; }
.hero h1 { font-size: clamp(30px, 4.6vw, 44px); line-height: 1.1; }
.hero .lead { font-size: 16px; max-width: 640px; }
section { padding-top: 64px; display: flex; flex-direction: column; gap: 20px; }
section h2 { font-size: 22px; line-height: 1.3; display: flex; gap: 14px; }
section h2 span { color: var(--accent); }
section > p { max-width: 680px; }
.scenes { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 460px), 1fr)); gap: 24px; }
.scene { display: flex; flex-direction: column; gap: 14px; padding: 20px; border: 2px solid var(--ink); background: #fff; box-shadow: 6px 6px 0 var(--ink); }
.scene:target { outline: 3px solid var(--accent); outline-offset: 4px; }
.scene .head { display: flex; gap: 16px; align-items: center; }
.avatar { width: 56px; height: 56px; flex: 0 0 auto; border: 2px solid var(--ink); display: block; }
.avatar.mono { display: flex; align-items: center; justify-content: center; background: var(--chip); color: var(--accent); font-weight: 700; font-size: 20px; }
.scene h3 { font-size: 19px; line-height: 1.3; }
.scene h3 a { color: var(--ink); text-decoration: none; }
.scene h3 a:hover { color: var(--accent); text-decoration: underline; }
.counts { font-size: 13px; color: var(--muted); }
.tags { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.tags li { font-size: 12px; padding: 1px 8px; border: 1px solid var(--ink); }
.use { margin-top: auto; padding-top: 6px; display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; }
.address { display: flex; min-width: 0; flex: 1 1 100%; border: 1px solid var(--rule); }
.address code { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 8px 10px; background: var(--chip); font-size: 13px; }
.copy { flex: 0 0 auto; min-height: 40px; padding: 0 12px; border: 0; border-left: 1px solid var(--rule); background: #fff; font: inherit; font-size: 13px; cursor: pointer; color: var(--ink); }
.copy:hover, .copy:focus-visible { background: var(--ink); color: #fff; }
.file { font-size: 13px; display: inline-flex; align-items: center; min-height: 40px; }
a.button { display: inline-flex; align-items: center; min-height: 44px; padding: 0 20px; background: var(--accent); color: #fff; text-decoration: none; font-weight: 700; border: 2px solid var(--ink); box-shadow: 4px 4px 0 var(--ink); }
a.button:hover { background: var(--ink); color: #fff; }
ol.how { margin: 0; padding-left: 22px; max-width: 760px; display: flex; flex-direction: column; gap: 10px; }
ol.how li::marker { color: var(--accent); font-weight: 700; }
footer { margin-top: 88px; border-top: 2px solid var(--ink); }
footer .wrap { padding: 20px; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 24px; font-size: 13px; color: var(--muted); }
footer a { color: var(--muted); }
</style>
</head>
<body>

<header class="top">
<nav aria-label="Primary">
<a href="https://apron.chat/">apron.chat</a>
<a href="https://apron.chat/protocol">protocol</a>
<a href="#scenes">scenes</a>
<a href="#use">use them</a>
<a class="strong" href="${REPO}">github</a>
</nav>
</header>

<main class="wrap">

<div class="hero">
<img src="/apron-logo.svg" width="128" height="128" alt="The Apron logo">
<div>
<h1>Apron Scenes</h1>
<p class="lead">Read-only scenes served over the <a href="https://apron.chat/protocol">Apron Chat Protocol</a>, so any client can open them to explore, test, and generate screenshots.</p>
</div>
</div>

<section id="scenes" aria-labelledby="scenes-title">
<h2 id="scenes-title"><span>§</span>${plural(scenes.length, "scenes")}</h2>
<div class="scenes">
${cards}
</div>
</section>

<section id="use" aria-labelledby="use-title">
<h2 id="use-title"><span>§</span>Use them</h2>
<ol class="how">
<li><b>Open</b> one in a browser: <code>scene.apron.chat/&lt;name&gt;</code> sends you to <a href="https://link.apron.chat/">link.apron.chat</a>, which opens it in a web client. Add <code>?room=</code> to start in another room.</li>
<li><b>Connect</b> any Apron client to its address, <code>wss://scene.apron.chat/&lt;name&gt;</code>, and sign in as a guest. It sends the whole scene at once, and lets no one change it.</li>
<li><b>Download</b> its <code>scene.jsonl</code>, an Apron archive that apron-web can open on its own.</li>
<li><b>Add</b> your own: a scene is a directory with a <code>scene.jsonl</code> and its pictures. <a href="${REPO}#adding-a-scene">How to add one</a>.</li>
</ol>
</section>

</main>

<footer>
<div class="wrap">
<span>Apron Scenes · MIT-licensed</span>
<span><a href="https://apron.chat/">apron.chat</a> · <a href="https://apron.chat/protocol">protocol</a> · <a href="${REPO}">apron-chat/scene.apron.chat</a></span>
</div>
</footer>

<script>
// Addresses on this host, for a Preview or wrangler dev; and copy buttons.
const scheme = location.protocol === "http:" ? "ws:" : "wss:";
for (const code of document.querySelectorAll("code[data-scene]")) code.textContent = scheme + "//" + location.host + "/" + code.dataset.scene;
for (const button of document.querySelectorAll("button[data-copy]")) {
	button.addEventListener("click", async () => {
		const address = document.querySelector('code[data-scene="' + button.dataset.copy + '"]').textContent;
		try {
			await navigator.clipboard.writeText(address);
			button.textContent = "copied";
		} catch {
			button.textContent = "select it";
		}
		setTimeout(() => (button.textContent = "copy"), 1600);
	});
}
</script>
</body>
</html>
`;
}
