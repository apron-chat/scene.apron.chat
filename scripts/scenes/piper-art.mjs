// Draws the piper scene's own pictures into scenes/piper/: son-of-anton's
// avatar, the scene's image (a flute and its notes), and Jian-Yang's SeeFood
// demo. Each is an SVG rendered to PNG, which every client can show;
// piper.mjs names them. The cast's avatars are cut from a drawing of them by
// piper-avatars.py instead. The PNGs are committed; run this only to change
// them:
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

// SeeFood: two phones, a verdict each.
{
	const phone = (x, food, verdict, color) => `
	<rect x="${x}" y="90" width="380" height="640" rx="44" fill="${INK}"/>
	<rect x="${x + 20}" y="130" width="340" height="560" rx="16" fill="#fdfdfb"/>
	<rect x="${x + 20}" y="130" width="340" height="90" fill="${color}"/>
	<text x="${x + 190}" y="192" font-family="Inter" font-weight="900" font-size="${verdict.length > 9 ? 34 : 44}" fill="#ffffff" text-anchor="middle">${verdict}</text>
	${food}
	<rect x="${x + 120}" y="610" width="140" height="44" rx="22" fill="#e5e7eb"/>
	<text x="${x + 190}" y="640" font-family="Inter" font-weight="700" font-size="22" fill="${INK}" text-anchor="middle">SeeFood</text>`;
	const hotdog = (cx, cy) => `
	<rect x="${cx - 130}" y="${cy - 34}" width="260" height="68" rx="34" fill="#e9c46a"/>
	<rect x="${cx - 150}" y="${cy - 18}" width="300" height="36" rx="18" fill="#c0392b"/>
	<path d="M${cx - 120} ${cy} q20 -14 40 0 t40 0 t40 0 t40 0 t40 0 t40 0" fill="none" stroke="#f4d03f" stroke-width="6"/>
	<rect x="${cx - 130}" y="${cy + 8}" width="260" height="34" rx="17" fill="#e9c46a"/>`;
	const pizza = (cx, cy) => `
	<path d="M${cx} ${cy + 110} L${cx - 110} ${cy - 90} Q${cx} ${cy - 130} ${cx + 110} ${cy - 90} Z" fill="#f4d35e"/>
	<path d="M${cx - 110} ${cy - 90} Q${cx} ${cy - 130} ${cx + 110} ${cy - 90} L${cx + 100} ${cy - 72} Q${cx} ${cy - 110} ${cx - 100} ${cy - 72} Z" fill="#d4a373"/>
	${[[-30, -50], [35, -40], [0, 10], [-15, 55]].map(([dx, dy]) => `<circle cx="${cx + dx}" cy="${cy + dy}" r="16" fill="#c0392b"/>`).join("")}`;
	writeFileSync(
		new URL("seefood.png", out),
		new Resvg(
			`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#f1f0ea"/>
			${phone(150, hotdog(340, 420), "HOTDOG ✓", "#2a9d8f")}
			${phone(670, pizza(860, 420), "NOT HOTDOG ✗", "#c0392b")}</svg>`,
			{ fitTo: { mode: "width", value: 1200 }, font: { loadSystemFonts: true, defaultFontFamily: "Inter" } },
		).render().asPng(),
	);
	console.log("scenes/piper/seefood.png");
}
