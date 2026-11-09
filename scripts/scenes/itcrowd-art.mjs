// Draws the itcrowd scene's pictures into scenes/itcrowd/: the swarm's avatar (one for all twelve agents, as a
// swarm should look), the scene's image, and the Internet, which Moss uploads for Jen's presentation. Each is an
// SVG rendered to PNG, which every client can show; itcrowd.mjs names them. The PNGs are committed; run this only
// to change them:
//
//   node scripts/scenes/itcrowd-art.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const out = new URL("../../scenes/itcrowd/", import.meta.url);
mkdirSync(out, { recursive: true });

function png(name, width, height, size, body) {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${body}</svg>`;
	const image = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
	writeFileSync(new URL(name, out), image);
	console.log(`scenes/itcrowd/${name}: ${Math.round(image.length / 1024)} KiB`);
}

const INK = "#1b1b1b";

/** The Internet: a small black box with one red light. It weighs nothing. */
const internet = (x, y, w, glow = true) => {
	const h = w * 0.62;
	return `
	<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w * 0.05}" fill="${INK}"/>
	<rect x="${x}" y="${y}" width="${w}" height="${h * 0.12}" rx="${w * 0.05}" fill="#2c2c2c"/>
	${glow ? `<circle cx="${x + w * 0.82}" cy="${y + h * 0.7}" r="${w * 0.07}" fill="#ff3b30" opacity="0.25"/>` : ""}
	<circle cx="${x + w * 0.82}" cy="${y + h * 0.7}" r="${w * 0.03}" fill="#ff3b30"/>`;
};

// The scene: the Internet, on Reynholm green.
png("scene.png", 512, 512, 256, `<rect width="512" height="512" fill="#2f5d50"/>${internet(116, 176, 280)}`);

// The swarm: a beige monitor in Moss's glasses, with the only answer it knows on its screen.
png(
	"agent.png",
	512,
	512,
	256,
	`<rect width="512" height="512" fill="#e9e1cf"/>
	<rect x="86" y="84" width="340" height="276" rx="34" fill="#cfc4a8"/>
	<rect x="122" y="116" width="268" height="206" rx="20" fill="#16302a"/>
	<g fill="none" stroke="#6fe3a8" stroke-width="18" stroke-linecap="round">
		<path d="M220 176 A60 60 0 1 0 292 176"/>
		<line x1="256" y1="150" x2="256" y2="214"/>
	</g>
	<g fill="none" stroke="${INK}" stroke-width="16">
		<rect x="136" y="242" width="96" height="62" rx="12"/>
		<rect x="280" y="242" width="96" height="62" rx="12"/>
		<line x1="232" y1="268" x2="280" y2="268"/>
	</g>
	<rect x="206" y="360" width="100" height="44" fill="#cfc4a8"/>
	<rect x="150" y="400" width="212" height="30" rx="15" fill="#b9ad8f"/>`,
);

// The Internet, on a desk in the basement, for the shareholders.
png(
	"internet.png",
	1200,
	800,
	1200,
	`<rect width="1200" height="800" fill="#cbbfa6"/>
	<rect y="520" width="1200" height="280" fill="#8a6a4a"/>
	<rect y="520" width="1200" height="14" fill="#6f5338"/>
	<ellipse cx="600" cy="606" rx="250" ry="26" fill="#000" opacity="0.25"/>
	${internet(400, 352, 400)}
	<rect x="840" y="130" width="230" height="150" fill="#f4efe2" stroke="#b3a789" stroke-width="4" transform="rotate(4 955 205)"/>
	<text x="955" y="205" transform="rotate(4 955 205)" font-family="Inter" font-size="30" font-weight="700" fill="${INK}" text-anchor="middle">DO NOT</text>
	<text x="955" y="245" transform="rotate(4 955 205)" font-family="Inter" font-size="30" font-weight="700" fill="${INK}" text-anchor="middle">DROP</text>`,
);
