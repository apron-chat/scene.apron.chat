// Draws the homealone scene's pictures into scenes/homealone/: the scene's
// image (the house, with a plane leaving), home-alarm's avatar, and Kevin's
// battle plan, on notebook paper. Each is an SVG rendered to PNG, which every
// client can show; homealone.mjs names them. The PNGs are committed; run this
// only to change them:
//
//   node scripts/scenes/homealone-art.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const out = new URL("../../scenes/homealone/", import.meta.url);
mkdirSync(out, { recursive: true });

const FONT = "Inter";
const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/'/g, "&#39;");

function png(name, svg, width) {
	const image = new Resvg(svg, { fitTo: { mode: "width", value: width }, font: { loadSystemFonts: true, defaultFontFamily: FONT } }).render().asPng();
	writeFileSync(new URL(name, out), image);
	console.log(`scenes/homealone/${name}: ${Math.round(image.length / 1024)} KiB`);
}

const NIGHT = "#1b2a41";
const BRICK = "#9c4a3a";
const SNOW = "#f6f4ef";
const GLOW = "#ffd56b";
const INK = "#1f1d1a";

/** A window, lit or not. */
const pane = (x, y, lit = true) =>
	`<rect x="${x}" y="${y}" width="40" height="48" fill="${lit ? GLOW : "#2e3d55"}" stroke="${SNOW}" stroke-width="5"/><path d="M${x + 20} ${y} V${y + 48} M${x} ${y + 24} H${x + 40}" stroke="${SNOW}" stroke-width="3"/>`;

// The scene: a brick house in the snow, every light on, and a plane on its way to Paris.
png(
	"scene.png",
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
	<rect width="512" height="512" fill="${NIGHT}"/>
	${[[60, 60], [140, 110], [430, 70], [470, 150], [300, 40], [40, 190]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="${SNOW}"/>`).join("")}
	<g transform="translate(330 96) rotate(-18)" fill="${SNOW}">
		<rect x="-56" y="-8" width="112" height="16" rx="8"/><path d="M-6 -6 L-34 -46 L-18 -46 L22 -6 Z M-6 6 L-34 46 L-18 46 L22 6 Z M-50 -6 L-62 -26 L-52 -26 L-38 -6 Z"/>
	</g>
	<path d="M96 250 L256 150 L416 250 Z" fill="#5b2a22"/>
	<path d="M90 252 L256 146 L422 252" fill="none" stroke="${SNOW}" stroke-width="12" stroke-linejoin="round"/>
	<rect x="112" y="250" width="288" height="190" fill="${BRICK}"/>
	<rect x="336" y="168" width="34" height="60" fill="${BRICK}"/><rect x="330" y="160" width="46" height="14" fill="${SNOW}"/>
	${pane(140, 280)}${pane(236, 270, false)}${pane(332, 280)}${pane(140, 360)}${pane(332, 360)}
	<rect x="232" y="350" width="48" height="90" fill="#3a5a40"/><circle cx="270" cy="398" r="4" fill="${GLOW}"/>
	<path d="M222 350 Q256 330 290 350" fill="none" stroke="#2d6a4f" stroke-width="10"/><circle cx="256" cy="340" r="6" fill="#c0392b"/>
	<rect y="436" width="512" height="76" fill="${SNOW}"/>
	<path d="M0 440 Q128 424 256 440 T512 440" fill="${SNOW}"/>
</svg>`,
	256,
);

// home-alarm: a bell, ringing, with nobody home to hear it. Nearly nobody.
png(
	"homealarm.png",
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
	<rect width="512" height="512" fill="#c0392b"/>
	<path d="M156 340 Q156 170 256 150 Q356 170 356 340 L386 370 L126 370 Z" fill="${SNOW}"/>
	<circle cx="256" cy="140" r="22" fill="${SNOW}"/>
	<circle cx="256" cy="396" r="30" fill="${GLOW}"/>
	<g fill="none" stroke="${GLOW}" stroke-width="16" stroke-linecap="round">
		<path d="M108 190 Q84 240 100 296"/><path d="M68 166 Q34 240 58 320"/>
		<path d="M404 190 Q428 240 412 296"/><path d="M444 166 Q478 240 454 320"/>
	</g>
</svg>`,
	256,
);

// The battle plan: the house in cross-section, in an eight-year-old's pencil, every trap where it goes.
{
	const PENCIL = "#3b3b3b";
	const RED = "#c0392b";
	const note = (x, y, text, { color = PENCIL, size = 25, rotate = 0, anchor = "start" } = {}) =>
		`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="${anchor}" transform="rotate(${rotate} ${x} ${y})">${escape(text)}</text>`;
	const lines = Array.from({ length: 22 }, (_, i) => `<line x1="0" x2="1200" y1="${70 + i * 34}" y2="${70 + i * 34}" stroke="#a9c7e8" stroke-width="2"/>`).join("");
	const x = (cx, cy, r = 12) => `<path d="M${cx - r} ${cy - r} L${cx + r} ${cy + r} M${cx + r} ${cy - r} L${cx - r} ${cy + r}" stroke="${RED}" stroke-width="6" stroke-linecap="round"/>`;
	png(
		"battleplan.png",
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
	<rect width="1200" height="800" fill="#fdfcf6"/>
	${lines}
	<line x1="110" x2="110" y1="0" y2="800" stroke="#e8a0a0" stroke-width="3"/>
	${[150, 400, 650].map((y) => `<circle cx="44" cy="${y}" r="16" fill="#d9d4c7"/>`).join("")}
	<g font-family="${FONT}" font-weight="800" stroke-linecap="round" stroke-linejoin="round">
		${note(150, 58, "BATTLE PLAN", { size: 44, color: INK, rotate: -1.5 })}
		${note(470, 58, "(TOP SECRET!!) by Kevin", { size: 24, rotate: -1.5 })}
		<g fill="none" stroke="${PENCIL}" stroke-width="5">
			<path d="M260 250 L560 110 L860 250"/>
			<path d="M280 250 V700 H840 V250"/>
			<path d="M280 420 H840 M280 560 H840"/>
			<path d="M640 560 L720 420"/>
			<path d="M360 700 L430 560"/>
			<path d="M860 250 Q1000 330 1110 520"/>
			<path d="M1080 520 V700 M1140 520 V700 M1060 520 H1160 L1110 470 Z"/>
		</g>
		${note(300, 300, "ATTIC: me", { size: 22 })}
		${note(880, 300, "ZIP LINE →", { size: 22, color: RED, rotate: 28 })}
		${note(1030, 740, "TREEHOUSE", { size: 22 })}
		${note(250, 475, "front door:", { size: 20, anchor: "end" })}
		${note(250, 505, "BBQ starter", { size: 20, anchor: "end", color: RED })}
		${note(250, 530, "on the knob", { size: 20, anchor: "end", color: RED })}
		${x(286, 490)}
		${note(870, 475, "back door:", { size: 20 })}
		${note(870, 505, "blowtorch", { size: 20, color: RED })}
		${x(834, 490)}
		${note(300, 470, "front hall: fan + feathers", { size: 20 })}
		${note(300, 500, "floor: Micro Machines", { size: 20 })}
		${note(300, 530, "window: ornaments", { size: 20 })}
		${note(705, 470, "stairs:", { size: 18 })}
		${note(705, 500, "PAINT CANS", { size: 18, color: RED })}
		${note(705, 530, "(x2), rope", { size: 18 })}
		${note(450, 610, "basement steps: ice", { size: 20 })}
		${note(450, 640, "stairs: tar, then nail", { size: 20, color: RED })}
		${note(450, 670, "laundry chute: IRON", { size: 20, color: RED })}
		${note(700, 610, "furnace", { size: 18 })}
		${note(700, 632, "(not a trap,", { size: 14 })}
		${note(700, 650, "just scary)", { size: 14 })}
		${note(150, 765, "9:00 PM: they come.  9:01: AAAAAH.", { size: 22, rotate: -0.5 })}
		${note(300, 340, "Buzz's room: AXL (on duty)", { size: 20, color: RED })}
	</g>
</svg>`,
		1200,
	);
}
