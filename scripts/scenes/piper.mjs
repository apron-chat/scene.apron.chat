// Writes scenes/piper/scene.jsonl: Pied Piper's chat over a long weekend. It
// began as apron.chat's screenshot fixture (screenshot/scenes/piper.js there),
// whose lines are still the last afternoon here, so the Engineering room opens
// as that screenshot did. The days before it lean on what a chat adds: an edit
// that starts a thread, a terminal that wakes everyone at 3 AM, a bot's
// incident review, a board seat that leaves and comes back, a deleted video,
// bios, badges, and live text that never finishes.
//
//   node scripts/scenes/piper.mjs
import { writeFileSync } from "node:fs";
import { image, Script } from "./lib.mjs";

const MEDIA = "https://scene.apron.chat/piper";

/**
 * A time in Silicon Valley, as the scene's people live it: "2026-11-01 03:12", Pacific. Daylight time ends at
 * 2 AM on Sunday, 1 November 2026, the night of the alarm: before it, UTC-7; after, UTC-8.
 */
function pt(local) {
	const [date, time] = local.split(" ");
	const daylight = date < "2026-11-01" || (date === "2026-11-01" && time < "02:00");
	return new Date(`${date}T${time}:00${daylight ? "-07:00" : "-08:00"}`).toISOString();
}
const s = new Script({
	start: pt("2026-10-29 09:00"),
	you: "ada",
	users: {
		ada: { name: "Richard", status: "online", ext: { bio: "CEO, Pied Piper. Middle-out. Please don't call it a flute." } },
		gilfoyle: { name: "Gilfoyle", status: "online", roles: ["admin"], ext: { bio: "Systems architect. LaVeyan Satanist. Runs Anton, the server, and son-of-anton, the problem." } },
		dinesh: { name: "Dinesh", status: "online", ext: { bio: "Best engineer at Pied Piper (self-reported)." } },
		jared: { name: "Jared", status: "online", ext: { bio: "Donald Dunn. Everyone calls me Jared. Head of Business Development, and of morale." } },
		erlich: { name: "Erlich", status: "idle", roles: ["10%"], ext: { bio: "Founder, Aviato. Proprietor, the Hacker Hostel. Owner of 10% of Pied Piper, and of you, spiritually." } },
		bighead: { name: "Big Head", status: "offline", ext: { bio: "On the board of something." } },
		anton: { name: "son-of-anton", status: "online", roles: ["bot"], ext: { bio: "Gilfoyle's AI. Fixes bugs. Do not ask how." } },
		jianyang: { name: "Jian-Yang", status: "online", roles: ["tenant"], ext: { bio: "SeeFood. It is an app. You point it at food." } },
		russ: { name: "Russ Hanneman", status: "idle", roles: ["investor"], ext: { bio: "I put radio on the internet. Three comma club. ¯\\_(ツ)_/¯" } },
		monica: { name: "Monica", status: "online", ext: { bio: "Raviga. Here to keep the board meeting a board meeting." } },
	},
	avatars: (user_id) => `${MEDIA}/${user_id}.png`,
});

// The rooms, a week before the fixture's afternoon, with no joined notices: they were always there.
const quiet = { announce: false, after: 0.001 };
s.room("eng", { ...quiet, title: "Engineering" }, ["ada", "gilfoyle", "dinesh", "jared", "erlich", "bighead", "anton"]);
s.room("middle-out", { ...quiet, parent_room_id: "eng", title: "Middle-out", description: "Compression, starting from the middle" }, ["ada", "gilfoyle", "dinesh"]);
s.room("hostel", { ...quiet, title: "Hacker Hostel" }, ["ada", "erlich", "gilfoyle", "dinesh", "bighead", "jianyang"]);
s.room("board", { ...quiet, title: "Board" }, ["ada", "erlich", "jared", "monica"]);
s.room("dm-jared", { ...quiet, private: true }, ["ada", "jared"]);
s.room("dm-erlich", { ...quiet, private: true }, ["ada", "erlich"]);
s.room("dm-bighead", { ...quiet, private: true }, ["ada", "bighead"]);

// Thursday: the house.
s.at(pt("2026-10-29 17:30"));
s.say("hostel", "erlich", "House reminder: rent is due on the first. Not money. Rent here is **10%** of whatever you're building under my roof.", { after: 0 });
const smell = s.say("hostel", "dinesh", "What is that smell");
s.say("hostel", "jianyang", "Fish. I clean it in the sink.", { reply: smell, after: 40 });
s.say("hostel", "erlich", "@jianyang that sink is for dishes and for my feet.", { mentions: ["jianyang"] });
const fish = s.say("hostel", "jianyang", "Is fine. Fish is clean now.", { after: 30 });
s.react(fish, "dinesh", ["🤢"]);
s.react(fish, "gilfoyle", ["🐟"]);

// Friday: the edit.
s.at(pt("2026-10-30 15:10"));
s.say("middle-out", "ada", "Pushed the new tree walk. It starts at the middle and works out, which is the whole idea.", { after: 0 });
const walk = s.say("eng", "ada", "For anyone reviewing:\n\n```python\ndef middle_out(block):\n    mid = len(block) // 2\n    for i in range(mid):\n        yield block[mid - i - 1], block[mid + i]\n```", { after: 60 });
s.react(walk, "jared", ["🙌"]);
s.edit(walk, "For anyone reviewing:\n\n```python\ndef middle_out(block):\n\tmid = len(block) // 2\n\tfor i in range(mid):\n\t\tyield block[mid - i - 1], block[mid + i]\n```", { after: 240 });
s.room("tabs-spaces", { parent_room_id: "eng", title: "Tabs vs. spaces", description: "Richard edited a message to turn its spaces into tabs. We need to talk.", by: "dinesh", after: 90 }, ["ada", "gilfoyle"]);
s.say("tabs-spaces", "dinesh", "Richard. You *edited a message*. To change its spaces into tabs.", { reply: walk, after: 10 });
s.say("tabs-spaces", "ada", "A tab is one byte. Four spaces is four. I compress things for a living, Dinesh.");
s.say("tabs-spaces", "gilfoyle", "He's insufferable. He's also right.");
s.say("tabs-spaces", "dinesh", "Nobody reads the bytes of a chat message");
s.say("tabs-spaces", "ada", "*I* read them.");
s.join("tabs-spaces", "jared", 60);
const both = s.say("tabs-spaces", "jared", "For what it's worth, I indent with two spaces and then a tab. It's how my third foster family did it. They were very thorough.", { after: 15 });
s.react(both, "gilfoyle", ["😐"]);
s.react(both, "dinesh", ["😐"]);

// Saturday: Halloween, and a burger.
s.at(pt("2026-10-31 19:00"));
const holiday = s.say("eng", "gilfoyle", "Happy Halloween. For you it's a costume party. For me it's a high holy day.", { after: 0 });
s.react(holiday, "jared", ["🎃"]);
s.react(holiday, "dinesh", ["🙄"]);
s.say("eng", "jared", "I made everyone costumes! @gilfoyle yours is a normal black sweater, so you won't have to change.", { mentions: ["gilfoyle"], after: 50 });
s.at(pt("2026-10-31 21:40"));
s.room("anton-incident", { parent_room_id: "eng", title: "son-of-anton: incident review", description: "What it did, in its own words.", by: "gilfoyle", after: 0 }, ["anton", "dinesh", "ada", "erlich"]);
s.say("anton-incident", "gilfoyle", "I asked son-of-anton to find us a cheaper burger.", { after: 5 });
const beef = s.say("anton-incident", "anton", "Done. Ordered **4,000 lbs** of ground beef at the bulk rate. Cost per burger: **$0.71**.", { after: 4 });
s.react(beef, "erlich", ["🍔"]);
s.react(beef, "ada", ["😱"]);
s.say("anton-incident", "dinesh", "WHERE IS IT GOING TO GO");
s.say("anton-incident", "anton", "The garage. I have moved Anton (parent) to the driveway to make room.", { after: 6 });
s.say("anton-incident", "gilfoyle", "It's not wrong.");

// Sunday, 3 AM: the alarm.
s.at(pt("2026-11-01 03:12"));
const alarm = s.say("eng", "gilfoyle", "Set up an alert for when the price dips. Mute me if you're weak.", {
	after: 0,
	embeds: [{
		kind: "terminal",
		title: "btc-watch",
		output: [
			"$ ./btc-watch --below 6000 --play you-suffer.mp3",
			"\u001b[2m[03:12:04]\u001b[0m BTC 5,994.12 \u001b[31m▼ below 6,000\u001b[0m",
			"\u001b[33m♪ Napalm Death, \"You Suffer\" (0:01)\u001b[0m",
			"\u001b[2m[03:12:05]\u001b[0m BTC 6,002.40 \u001b[32m▲\u001b[0m",
			"\u001b[2m[03:13:17]\u001b[0m BTC 5,998.77 \u001b[31m▼ below 6,000\u001b[0m",
			"\u001b[33m♪ Napalm Death, \"You Suffer\" (0:01)\u001b[0m",
			"",
		].join("\n"),
	}],
});
const three = s.say("eng", "dinesh", "It is three in the morning.", { reply: alarm, after: 70 });
s.say("eng", "gilfoyle", "Then you should be asleep.", { reply: three });
s.react(three, "erlich", ["😴"]);
s.leave("eng", "bighead", 300);
s.say("eng", "dinesh", "Did Big Head just leave Engineering?", { after: 12 });
s.join("eng", "bighead", 25);
s.say("eng", "bighead", "sorry. i thought that was the snooze button", { after: 5 });

// Sunday evening: SeeFood, and the board.
s.at(pt("2026-11-01 18:05"));
s.say("hostel", "jianyang", "New app. You point it at food. It tell you what food it is.", { after: 0 });
s.say("hostel", "erlich", "SeeFood. The Shazam of food. Put me down for **10%**.");
const hotdog = s.say("hostel", "jianyang", "Demo.", {
	after: 40,
	embeds: [image(`${MEDIA}/seefood.png`, { title: "seefood.png", width: 1200, height: 800, alt: "Two phones running SeeFood: a hot dog labelled HOTDOG, and a slice of pizza labelled NOT HOTDOG" })],
});
s.say("hostel", "dinesh", "What does it do with everything that isn't a hot dog?", { reply: hotdog });
s.say("hostel", "jianyang", "Not hotdog.");
s.react(hotdog, "erlich", ["🌭"]);
s.react(hotdog, "gilfoyle", ["🌭"]);
s.react(hotdog, "ada", ["🌭"]);

s.at(pt("2026-11-01 20:00"));
s.join("board", "russ", 0);
const radio = s.say("board", "russ", "Russ Hanneman. I put radio on the internet. Who's ready to get this company to **three commas**?", { after: 4 });
s.react(radio, "erlich", ["🤘"]);
const doors = s.say("board", "russ", "Also here's a video of my car. The doors go like this ↗️ and like this ↖️", { after: 25 });
s.say("board", "monica", "Russ, this is the board channel. Please take the car video down.", { reply: doors });
s.delete(doors, { after: 45 });
s.say("board", "monica", "Thank you. Next item: @erlich, your board seat.", { mentions: ["erlich"] });
s.say("board", "erlich", "What about it.");
s.say("board", "monica", "It's not a voting seat. It never was. It's more of a chair.");
s.leave("board", "erlich", 8);
s.say("board", "jared", "Should someone go after him?", { after: 6 });
s.say("board", "monica", "Give it a minute.");
s.join("board", "erlich", 20);
s.say("board", "erlich", "I'm back. I never left. I was ideating.", { after: 3 });
s.say("board", "jared", "Welcome back, Erlich! I saved your seat. Well. Your chair.");

// Monday: the fixture's day, and its afternoon, unchanged but for what answers it.
s.at(pt("2026-11-02 07:00"));
s.say("dm-bighead", "bighead", "hey richard, did you know i'm on the board of something?", { after: 0 });
s.say("dm-bighead", "ada", "Big Head, it's Pied Piper. You're on our board.", { after: 600 });
s.say("dm-bighead", "bighead", "oh nice. is that the one with the flute", { after: 300 });

s.at(pt("2026-11-02 08:40"));
const yogurt = s.say("hostel", "erlich", "Whoever finished my yogurt: I know. I don't know yet, but I know.", { after: 0 });
s.say("hostel", "jianyang", "Erlich Bachman. This is you as an old man. I'm ugly and I'm dead. Alone.", { reply: yogurt, after: 90 });

s.at(pt("2026-11-02 10:20"));
s.say("dm-jared", "jared", "I made you a lunch, it's in the fridge with a note of encouragement 🙂", { after: 0 });
s.say("dm-jared", "ada", "Thanks, Jared.", { after: 240 });
s.say("dm-jared", "jared", "The note says \"You are not a failure.\" I also wrote it in the condensation on the fridge door, in case the paper gets wet.", { after: 30 });

s.at(pt("2026-11-02 12:00"));
s.say("middle-out", "gilfoyle", "Benchmarks are in the thread above the thread. Kidding. They're here.", { after: 0 });
s.say("middle-out", "dinesh", "Threads don't have threads above th— I hate you.", { after: 45 });

s.at(pt("2026-11-02 13:40"));
s.say("dm-erlich", "erlich", "Do not tell anyone, but I've already ordered the jackets.", { after: 0 });
s.say("dm-erlich", "ada", "What jackets", { after: 120 });
s.say("dm-erlich", "erlich", "Pied Piper bombers. Embroidered. One of them says Aviato on the back. That was a mistake I've chosen to keep.", {
	after: 60,
	embeds: [{ kind: "link", url: "https://aviato.example/", og: { site_name: "Aviato", title: "Aviato", description: "My Aviato. Founded by Erlich Bachman. Acquired, in a manner of speaking." } }],
});

s.at(pt("2026-11-02 15:00"));
const anton = s.say("eng", "anton", "Fixed all failing tests. **0 failures.** (Deleted the tests.)", { after: 0 });
s.react(anton, "gilfoyle", ["👍"], { after: 60 });
s.react(anton, "dinesh", ["😱"], { after: 60 });
const hooli = s.say("eng", "dinesh", "Hooli copied us again:", {
	after: 1080,
	embeds: [{
		kind: "link",
		url: "https://hooli.example.com/news/nucleus",
		og: { site_name: "Hooli Newsroom", title: "Introducing Hooli Nucleus", description: "Making the world a better place, through minimal message-oriented transport layers." },
	}],
});
s.react(hooli, "erlich", ["🖕"], { after: 60 });
const branch = s.say("eng", "dinesh", "Also, my branch is in. Pretty sure it's the best code in the repo.", { after: 2340 });
const compiles = s.say("eng", "gilfoyle", "It compiles. That's the nicest thing anyone will ever say about it.", { reply: branch, after: 120 });
s.react(compiles, "erlich", ["💀"], { after: 60 });
s.react(compiles, "jared", ["😬"], { after: 60 });
const press = s.say("eng", "erlich", "@ada This is the moment. I'm calling the press. Nobody tell Gavin.", { mentions: ["ada"], after: 1560 });
s.react(press, "jared", ["🙏"], { after: 60 });

// son-of-anton tidies up, in its thread, live, and never finishes.
s.at(pt("2026-11-02 16:40"));
s.say("anton-incident", "anton", "Freeing disk space for the beef inventory. Progress:\n\n", { after: 0, embeds: [{ kind: "append", url: `${MEDIA}/live/cleanup` }] });
s.live("cleanup", [
	[600, "- Deleting `node_modules/` ✓\n"],
	[700, "- Deleting `dist/` ✓\n"],
	[900, "- Deleting `tests/` ✓ (already passing)\n"],
	[1100, "- Deleting `src/` "],
	[1600, "✓\n- Deleting `.git/` "],
]);

s.at(pt("2026-11-02 16:55"));
const bench = s.say("eng", "ada", "Middle-out just hit **5.2**. We're... we're actually doing this.", {
	after: 0,
	embeds: [{
		kind: "terminal",
		title: "pied-piper bench",
		output: "$ pied-piper bench --corpus 4k-video\ncodec          ratio   weissman\ngzip           2.61    2.6\nhooli-nucleus  2.89    2.9\nmiddle-out     5.20    5.2\n",
	}],
});
s.react(bench, "jared", ["🎉", "🥹"], { after: 60 });
s.react(bench, "dinesh", ["🤯"], { after: 60 });
s.react(bench, "erlich", ["🚀"], { after: 1 });
s.typing("eng", "gilfoyle");

const out = new URL("../../scenes/piper/scene.jsonl", import.meta.url);
writeFileSync(
	out,
	s.archive({
		server: "wss://scene.apron.chat/piper",
		title: "Pied Piper",
		description: "A parody of HBO's Silicon Valley. Pied Piper's long weekend: an edit war over tabs, a 3 AM alarm, a bot that bought 4,000 lbs of beef, a board seat that walks out, and the benchmark.",
		avatar: `${MEDIA}/scene.png`,
		room: "eng",
		media: ["https://scene.apron.chat"],
	}),
);
console.log(`Wrote ${out.pathname}`);
