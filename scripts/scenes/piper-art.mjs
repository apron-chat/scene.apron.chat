// Draws the piper scene's pictures into scenes/piper/: a face for each person,
// one feature apiece so they read at avatar size, and the scene's own image,
// a flute and its notes. Each is an SVG rendered to PNG, which every client
// can show. fixtures.mjs picks them up by name: <user_id>.png is that user's
// avatar, scene.png the scene's. The PNGs are committed; run this only to
// change them:
//
//   node scripts/scenes/piper-art.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const out = new URL("../../scenes/piper/", import.meta.url);
mkdirSync(out, { recursive: true });

function png(name, background, body) {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${background}"/>${body}</svg>`;
	const image = new Resvg(svg, { fitTo: { mode: "width", value: 256 } }).render().asPng();
	writeFileSync(new URL(name, out), image);
	console.log(`scenes/piper/${name}: ${Math.round(image.length / 1024)} KiB`);
}

const INK = "#1f1d1a";

/**
 * Shoulders in `shirt`, then `back` (hair behind the head), a head in `skin` of radius `r`, eyes, a mouth, and
 * `front` (whatever sits on the face: hair, glasses, a beard).
 */
function person({ shirt, skin, back = "", front = "", mouth = "M226 318 Q256 336 286 318", eyes = true, r = 118 }) {
	return `
	<path d="M76 512 Q90 392 256 384 Q422 392 436 512 Z" fill="${shirt}"/>
	${back}
	<circle cx="256" cy="246" r="${r}" fill="${skin}"/>
	${eyes ? `<circle cx="214" cy="236" r="12" fill="${INK}"/><circle cx="298" cy="236" r="12" fill="${INK}"/>` : ""}
	<path d="${mouth}" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>
	${front}`;
}

// Richard (user_id "ada", as every fixture's reader): a hoodie, unruly hair, and a nervous mouth.
png(
	"ada.png",
	"#2a9d8f",
	person({
		shirt: "#6b7280",
		skin: "#f1c7a5",
		back: `<path d="M120 400 Q256 352 392 400 L392 430 Q256 380 120 430 Z" fill="#4b5563"/>`,
		front: `<path d="M140 210 Q150 110 256 112 Q362 110 372 210 Q330 160 300 180 Q280 140 250 170 Q220 140 196 176 Q170 160 140 210 Z" fill="#6b4a2f"/>`,
		mouth: "M222 322 Q238 312 254 322 Q270 332 290 320",
	}),
);

// Gilfoyle: long dark hair, a full beard, and nothing on his face at all.
png(
	"gilfoyle.png",
	"#26232b",
	person({
		shirt: "#0f0f12",
		skin: "#efc9ab",
		back: `<path d="M126 250 Q120 120 256 108 Q392 120 386 250 L392 420 L330 420 L330 250 L182 250 L182 420 L120 420 Z" fill="#2b2118"/>`,
		front: `<path d="M140 210 Q160 116 256 116 Q352 116 372 210 Q300 150 256 152 Q212 150 140 210 Z" fill="#2b2118"/>
		<path d="M160 268 Q170 380 256 388 Q342 380 352 268 Q320 300 256 300 Q192 300 160 268 Z" fill="#2b2118"/>`,
		mouth: "M232 322 L280 322",
	}),
);

// Dinesh: short dark hair, a moustache, and a gold chain.
png(
	"dinesh.png",
	"#e9c46a",
	person({
		shirt: "#264653",
		skin: "#a86f4c",
		front: `<path d="M142 214 Q150 118 256 116 Q362 118 370 214 Q330 168 256 168 Q182 168 142 214 Z" fill="#1d1a17"/>
		<path d="M220 300 Q256 284 292 300 Q256 312 220 300 Z" fill="#1d1a17"/>
		<path d="M186 410 Q256 460 326 410" fill="none" stroke="#f4b400" stroke-width="12" stroke-dasharray="2 14" stroke-linecap="round"/>`,
		mouth: "M228 330 Q256 340 284 326",
	}),
);

// Jared: neat, thin hair, and the kindest smile.
png(
	"jared.png",
	"#a8dadc",
	person({
		shirt: "#8ecae6",
		skin: "#f3d3bd",
		front: `<path d="M146 206 Q160 126 256 124 Q352 126 366 206 Q300 150 220 160 Q180 168 146 206 Z" fill="#c9b18b"/>
		<path d="M150 400 L256 470 L362 400" fill="none" stroke="#ffffff" stroke-width="14"/>`,
		mouth: "M212 312 Q256 360 300 312",
	}),
);

// Erlich: a big beard, longish hair, and sunglasses indoors.
png(
	"erlich.png",
	"#e76f51",
	person({
		shirt: "#3d405b",
		skin: "#efc6a4",
		back: `<path d="M128 240 Q124 118 256 112 Q388 118 384 240 L384 330 L128 330 Z" fill="#7a5230"/>`,
		front: `<path d="M150 266 Q160 396 256 404 Q352 396 362 266 Q320 296 256 298 Q192 296 150 266 Z" fill="#7a5230"/>
		<rect x="176" y="214" width="72" height="44" rx="16" fill="${INK}"/><rect x="264" y="214" width="72" height="44" rx="16" fill="${INK}"/>
		<path d="M248 232 L264 232" stroke="${INK}" stroke-width="8"/>`,
		mouth: "M230 326 Q256 338 282 326",
	}),
);

// Big Head: a big head, small features.
png(
	"bighead.png",
	"#90be6d",
	person({
		shirt: "#577590",
		skin: "#f1c7a5",
		r: 168,
		front: `<path d="M120 190 Q160 76 256 74 Q352 76 392 190 Q330 130 256 132 Q182 130 120 190 Z" fill="#b5835a"/>`,
		mouth: "M240 318 Q256 326 272 318",
	}),
);

// son-of-anton: a bot whose tests all pass. It deleted them.
png(
	"anton.png",
	"#6d597a",
	`<line x1="256" y1="88" x2="256" y2="140" stroke="#f6efe0" stroke-width="14"/><circle cx="256" cy="80" r="20" fill="#e9c46a"/>
	<rect x="116" y="140" width="280" height="240" rx="44" fill="#f6efe0"/>
	<path d="M176 240 L204 268 L250 214 M262 240 L290 268 L336 214" fill="none" stroke="#2a9d8f" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
	<rect x="196" y="310" width="120" height="26" rx="13" fill="${INK}"/>
	<path d="M76 512 Q90 420 256 412 Q422 420 436 512 Z" fill="#b56576"/>`,
);

// The scene: a flute, and the notes coming out of it.
png(
	"scene.png",
	"#2d6a4f",
	`<g transform="rotate(-35 256 256)">
		<rect x="70" y="232" width="372" height="48" rx="24" fill="#f6efe0"/>
		${[150, 200, 250, 300, 350].map((x) => `<circle cx="${x}" cy="256" r="9" fill="#2d6a4f"/>`).join("")}
		<rect x="70" y="232" width="40" height="48" rx="20" fill="#d4a373"/>
	</g>
	<g fill="#f6efe0">
		<circle cx="356" cy="130" r="22"/><rect x="372" y="62" width="9" height="70"/><path d="M372 62 Q410 74 404 108 Q396 86 381 84 Z"/>
		<circle cx="420" cy="220" r="17"/><rect x="433" y="166" width="7" height="56"/>
	</g>`,
);
