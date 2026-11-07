// Draws the whosonfirst scene's pictures into scenes/whosonfirst/: an avatar
// for each user, and the whiteboard Costello photographs. Each is an SVG
// rendered to PNG, which every client can show. The PNGs are committed; run
// this only to change them:
//
//   node scripts/scenes/whosonfirst-art.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const out = new URL("../../scenes/whosonfirst/", import.meta.url);
mkdirSync(out, { recursive: true });

const FONT = "Inter";
const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/'/g, "&#39;");

function png(name, svg, width) {
	const image = new Resvg(svg, { fitTo: { mode: "width", value: width }, font: { loadSystemFonts: true, defaultFontFamily: FONT } }).render().asPng();
	writeFileSync(new URL(name, out), image);
	console.log(`scenes/whosonfirst/${name}: ${Math.round(image.length / 1024)} KiB`);
}

/** A player in a jersey: their name across the chest, so everyone can read who's who. Nobody can. */
function jersey({ background, shirt, ink, name, number }) {
	const lines = name.split("\n");
	const size = Math.min(64, Math.floor(260 / Math.max(...lines.map((line) => line.length)) * 1.6));
	const text = lines
		.map((line, i) => `<text x="256" y="${282 + (i - (lines.length - 1) / 2) * size * 1.05}" font-size="${size}">${escape(line)}</text>`)
		.join("");
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
	<rect width="512" height="512" fill="${background}"/>
	<path d="M176 150 L216 128 Q256 168 296 128 L336 150 L430 206 L398 284 L354 262 L354 512 L158 512 L158 262 L114 284 L82 206 Z" fill="${shirt}"/>
	<path d="M216 128 Q256 168 296 128" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round"/>
	<g font-family="${FONT}" font-weight="900" fill="${ink}" text-anchor="middle">${text}
		<text x="256" y="430" font-size="96">${escape(number)}</text>
	</g>
</svg>`;
}

const NAVY = "#1d3557";
const CREAM = "#f6efe0";
const players = [
	["who", "#f4a261", "WHO", "1B"],
	["what", "#90be6d", "WHAT", "2B"],
	["idontknow", "#e76f51", "I DON'T\nKNOW", "3B"],
	["why", "#e9c46a", "WHY", "LF"],
	["because", "#f28482", "BECAUSE", "CF"],
	["tomorrow", "#84a59d", "TOMOR-\nROW", "P"],
	["today", "#8ecae6", "TODAY", "C"],
	["idontgiveadarn", "#cdb4db", "I DON'T\nGIVE A\nDARN", "SS"],
];
for (const [id, background, name, number] of players) png(`${id}.png`, jersey({ background, shirt: CREAM, ink: NAVY, name, number }), 256);
png("abbott.png", jersey({ background: "#457b9d", shirt: NAVY, ink: CREAM, name: "ABBOTT", number: "MGR" }), 256);
png("costello.png", jersey({ background: "#ffb703", shirt: NAVY, ink: CREAM, name: "COSTELLO", number: "NEW" }), 256);

png(
	"scorebot.png",
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
	<rect width="512" height="512" fill="#2a9d8f"/>
	<line x1="256" y1="70" x2="256" y2="130" stroke="${CREAM}" stroke-width="14"/><circle cx="256" cy="62" r="20" fill="#e9c46a"/>
	<rect x="106" y="130" width="300" height="250" rx="40" fill="${CREAM}"/>
	<rect x="146" y="180" width="220" height="90" rx="16" fill="${NAVY}"/>
	<g font-family="JetBrains Mono" font-weight="800" fill="#e9c46a" text-anchor="middle"><text x="256" y="244" font-size="56">0-0</text></g>
	<rect x="186" y="300" width="140" height="28" rx="14" fill="${NAVY}"/>
</svg>`,
	256,
);
png(
	"bleachers.png",
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
	<rect width="512" height="512" fill="#a8dadc"/>
	${[0, 1, 2, 3, 4].map((row) => `<rect x="${60 + row * 20}" y="${170 + row * 64}" width="${392 - row * 40}" height="40" rx="8" fill="${row % 2 ? NAVY : "#457b9d"}"/>`).join("")}
	<circle cx="256" cy="110" r="44" fill="#ffffff"/><path d="M256 66 Q236 110 256 154 M256 66 Q276 110 256 154" stroke="#e63946" stroke-width="6" fill="none"/>
</svg>`,
	256,
);

// The whiteboard: Costello's diagram of the infield, which is correct.
const BLUE = "#1d4ed8";
const RED = "#dc2626";
const label = (x, y, text, color = BLUE, size = 38, rotate = 0) =>
	`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" transform="rotate(${rotate} ${x} ${y})">${escape(text)}</text>`;
png(
	"whiteboard.png",
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
	<rect width="1200" height="800" fill="#9ca3af"/>
	<rect x="30" y="30" width="1140" height="740" rx="10" fill="#fdfdfb"/>
	<g font-family="${FONT}" font-weight="800" text-anchor="middle" stroke-linecap="round" stroke-linejoin="round">
		${label(600, 110, "WHO'S ON FIRST??", NAVY, 56, -1.5)}
		<path d="M420 130 Q600 122 780 134" stroke="${NAVY}" stroke-width="6" fill="none"/>
		<path d="M600 660 L820 450 L600 250 L380 450 Z" stroke="${BLUE}" stroke-width="8" fill="none"/>
		${[[600, 660], [820, 450], [600, 250], [380, 450]].map(([x, y]) => `<rect x="${x - 16}" y="${y - 16}" width="32" height="32" fill="#fdfdfb" stroke="${BLUE}" stroke-width="6" transform="rotate(45 ${x} ${y})"/>`).join("")}
		${label(600, 715, "TODAY (catcher)", BLUE, 34)}
		${label(600, 470, "TOMORROW", BLUE, 34, -2)}
		${label(600, 505, "(pitching... tomorrow?)", BLUE, 22, -2)}
		${label(965, 455, "WHO?", RED, 64, 4)}
		${label(600, 215, "WHAT?", RED, 56, -3)}
		${label(205, 455, "I DON'T KNOW", RED, 44, -4)}
		${label(220, 250, "WHY? (left)", BLUE, 34, -6)}
		${label(860, 200, "BECAUSE (center)", BLUE, 30, 3)}
		${label(390, 318, "I DON'T GIVE", BLUE, 26, -8)}
		${label(398, 348, "A DARN (SS)", BLUE, 26, -8)}
		${label(1010, 300, "right field:", BLUE, 30, 5)}
		${label(1020, 345, "???", RED, 44, 5)}
		${label(1030, 650, "ask Abbott", NAVY, 30, -3)}
		${label(165, 700, "?????", RED, 60, -10)}
	</g>
</svg>`,
	1200,
);

// The scene's own avatar, which clients show for the server: a baseball, in question.
png(
	"scene.png",
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
	<rect width="512" height="512" fill="${NAVY}"/>
	<circle cx="256" cy="256" r="190" fill="#fdfdfb"/>
	<path d="M120 124 Q190 256 120 388 M392 124 Q322 256 392 388" stroke="#e63946" stroke-width="10" fill="none" stroke-dasharray="4 14" stroke-linecap="round"/>
	<g font-family="${FONT}" font-weight="900" fill="${NAVY}" text-anchor="middle"><text x="256" y="335" font-size="230">?</text></g>
</svg>`,
	256,
);
