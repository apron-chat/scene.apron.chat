// Writes scenes/itcrowd/scene.jsonl: a Monday at Reynholm Industries, in the basement. A parody of Channel 4's
// The IT Crowd. Moss has automated Roy: twelve agents, moss-00 to moss-11 (he counts from zero), trained on Roy's
// answering machine, one per ticket, each ticket its own thread on the Support Desk. Every thread ends the same way.
// What a chat adds: a sidebar of threads whose last line is all one answer, a live terminal of the swarm at work, an
// edit that turns a fire report into Moss's email, a deleted message HR made Douglas take back, twelve bots
// reacting in the same second, an answering machine for a bio, and a server room behind a red door nobody joins.
//
//   node scripts/scenes/itcrowd.mjs
import { writeFileSync } from "node:fs";
import { image, Script } from "./lib.mjs";

const MEDIA = "https://scene.apron.chat/itcrowd";

/** A time in London, in November: "2026-11-02 09:00", Greenwich Mean Time (UTC). */
const gmt = (local) => new Date(`${local.replace(" ", "T")}:00Z`).toISOString();

const ESC = "\u001b";
const dim = (text) => `${ESC}[2m${text}${ESC}[0m`;
const green = (text) => `${ESC}[32m${text}${ESC}[0m`;
const yellow = (text) => `${ESC}[33m${text}${ESC}[0m`;

/** The answer. Every agent gives it; every thread ends with it. */
const ANSWER = "Have you tried turning it off and on again?";
const agents = Array.from({ length: 12 }, (_, i) => `moss-${String(i).padStart(2, "0")}`);

const s = new Script({
	start: gmt("2026-11-02 08:30"),
	you: "jen",
	users: {
		jen: { name: "Jen", status: "online", roles: ["head of IT"], ext: { bio: "Head of IT. Relationship manager. IT stands for something, and I'm looking into it." } },
		roy: { name: "Roy", status: "idle", ext: { bio: "Hello, IT. Have you tried turning it off and on again? (This is a recording.)" } },
		moss: { name: "Moss", status: "online", ext: { bio: "I came here to drink milk and kick ass. And I've just finished my milk." } },
		douglas: { name: "Douglas Reynholm", status: "online", roles: ["CEO"], ext: { bio: "Reynholm Industries. My father built it. I'm building on it, mostly with lawyers." } },
		richmond: { name: "Richmond", status: "online", roles: ["server room"], ext: { bio: "Behind the red door. I was going places, once. Then I heard Cradle of Filth." } },
		phil: { name: "Phil", status: "online", ext: { bio: "Accounts. Arsenal till I die." } },
		patricia: { name: "Patricia", status: "online", ext: { bio: "Reception. I put calls through to IT. Nobody answers." } },
		...Object.fromEntries(agents.map((id, i) => [id, { name: id, status: "online", roles: ["bot"], ext: { bio: `Agent ${i} of Moss's twelve, counting from zero. Trained on Roy's answering machine.` } }])),
	},
	// The swarm shares one face, as a swarm should. People keep their initials.
	avatars: (user_id) => (user_id.startsWith("moss-") ? `${MEDIA}/agent.png` : undefined),
});

// The rooms, with no joined notices: they were always there. The Support Desk first, so its threads lead the sidebar.
const quiet = { announce: false, after: 0.001 };
const staff = ["jen", "roy", "moss", "douglas", "richmond", "phil", "patricia"];
s.room("desk", { ...quiet, title: "Support Desk", description: `Hello, IT. ${ANSWER} One thread per problem, please.` }, [...staff, ...agents]);
s.room("company", { ...quiet, title: "Reynholm Industries", description: "Everyone. Shareholders' meeting, Thursday, 4 PM." }, [...staff, ...agents]);
s.room("serverroom", { ...quiet, joined: false, title: "Server room", description: "Behind the red door. Do not open the red door." }, ["richmond"]);
s.room("it", { ...quiet, title: "IT Department", description: "The basement. Mind the stairs.", private: true }, ["jen", "roy", "moss"]);
s.room("dm-douglas", { ...quiet, private: true }, ["jen", "douglas"]);

// Twenty to nine: Moss tells Roy.
s.at(gmt("2026-11-02 08:40"));
s.say("it", "moss", "Roy. I've automated you.", { after: 0 });
s.say("it", "roy", "You've what?", { after: 20 });
s.say("it", "moss", "Twelve agents. Trained on you. Well, on your answering machine. It's the best-documented part of you.", { after: 15 });
s.say("it", "roy", "I am more than my answering machine, Moss.", { after: 30 });
s.say("it", "moss", "It resolves 94% of tickets.", { after: 10 });
s.say("it", "roy", "...And the other six?", { after: 20 });
const hangup = s.say("it", "moss", "They hang up.", { after: 5 });
s.react(hangup, "roy", ["😐"]);
s.say("it", "moss", "I've given them small talk, too. For the lads upstairs.", {
	after: 60,
	embeds: [{ kind: "link", url: "https://bluffball.example/", og: { site_name: "Bluffball", title: "Bluffball: football conversation for people who don't like football", description: "Ten phrases. Learn them, say them, nod. Nobody will know." } }],
});
s.say("it", "roy", "Oh no.", { after: 25 });

// Ten to nine: the swarm, on the Support Desk, with its live status.
s.at(gmt("2026-11-02 08:50"));
const launch = s.say("desk", "moss", "Good morning, Reynholm Industries! The IT department is now twelve agents, one per ticket, around the clock. Open a thread for your problem, and an agent will be with you shortly.", {
	after: 0,
	embeds: [{ kind: "terminal", title: "swarm status", url: `${MEDIA}/live/swarm` }],
});
s.react(launch, "phil", ["🤖"]);
s.react(launch, "patricia", ["🙏"]);

// The swarm at work, on one screen, each agent's row redrawn in place as it takes its ticket and answers it. The
// header's resolution rate is 100% throughout. The last agent escalates the fire, and calls the new emergency
// services number, 0118 999 881 999 119 725... 3, a group at a time. It never gets to the end.
const swarm = [
	["#4471", "Computer won't turn on"],
	["#4472", "What does IT stand for?"],
	["#4473", "Fire"],
	["#4474", "Stuck in the lift"],
	["#4475", "The server room is cold"],
	["#4476", "Nobody in IT answers the phone"],
	["#4477", "Out of milk"],
	["#4478", "The Internet is blinking"],
	["#4479", "Where is the any key?"],
	["#4480", "Monitor's gone black"],
	["#4481", "Locked out. Password: password"],
];
const row = (n) => `${ESC}[${n};1H${ESC}[2K`;
const line = (agent, [ticket, title], state) => ` ${agent}  ${dim(ticket)}  ${title.padEnd(31)}${state}`;
const header = (resolved) => `${row(1)} swarm status · 12 agents · trained on Roy${" ".repeat(14)}${dim(`resolved ${String(resolved).padStart(2)} · 100%`)}`;
const live = [[400, `${ESC}[2J${header(0)}${agents.map((agent, i) => `${row(3 + i)} ${agent}  ${dim("idle")}`).join("")}`]];
swarm.forEach((ticket, i) => {
	live.push([900, `${row(3 + i)}${line(agents[i], ticket, yellow("reading…"))}`]);
	live.push([700, `${row(3 + i)}${line(agents[i], ticket, green("✓ asked: off and on again?"))}${header(i + 1)}`]);
});
live.push([1200, `${row(14)} moss-11  ${dim("#4473")}  ${"Fire (escalated)".padEnd(31)}${yellow("calling")} 0118`]);
for (const digits of [" 999", " 881", " 999", " 119", " 72"]) live.push([900, digits]);
s.live("swarm", live);

// Nine: Douglas, and twelve thumbs in the same second.
s.at(gmt("2026-11-02 09:00"));
const meeting = s.say("company", "douglas", "Morning all. Shareholders' meeting, Thursday, 4 PM. Jen from IT will be giving a speech. About IT.", { after: 0 });
for (const agent of agents) s.react(meeting, agent, ["👍"], { after: 0.05 });
s.react(meeting, "phil", ["👍"], { after: 30 });
s.say("company", "douglas", "Who are all these people giving me the thumbs up?", { after: 60 });
const roughly = s.say("company", "moss", "They're me, sir. Roughly.", { reply: meeting, after: 40 });
s.react(roughly, "douglas", ["🤨"]);

// The morning's tickets, each its own thread, each answered.
const ticket = (id, title, description, by, after, lines, agent) => {
	s.room(id, { parent_room_id: "desk", title, description, by, after }, [agent]);
	let first;
	for (const [i, text] of lines.entries()) {
		const said = s.say(id, by, text, { after: i ? 25 : 5 });
		first ??= said;
	}
	return first;
};
const answer = (id, agent, after = 4) => s.say(id, agent, ANSWER, { after });

s.at(gmt("2026-11-02 09:20"));
ticket("t4471", "#4471 Computer won't turn on", "Pressed the button. Nothing.", "phil", 0, ["Pressed the power button. Nothing. Pressed it harder. Nothing."], "moss-00");
answer("t4471", "moss-00");

s.at(gmt("2026-11-02 09:41"));
ticket("t4472", "#4472 What does IT stand for?", "Asking for a friend.", "jen", 0, ["Quick one. What does IT stand for? Not for me. For a speech."], "moss-01");
answer("t4472", "moss-01");

s.at(gmt("2026-11-02 10:12"));
ticket("t4475", "#4475 The server room is cold", "Colder than usual.", "richmond", 0, ["The server room is cold. I like it cold. But today it is colder, and the servers have begun to hum in a minor key."], "moss-04");
answer("t4475", "moss-04");
s.say("serverroom", "richmond", "Someone has filed a ticket about the cold. It was me.", { after: 300 });

s.at(gmt("2026-11-02 10:45"));
ticket("t4476", "#4476 Nobody in IT answers the phone", "Forty calls today.", "patricia", 0, ["I've put forty calls through to IT today. Nobody answers. Just a recording of a man saying 'have you tried turning it off and on again'."], "moss-05");
answer("t4476", "moss-05");

// Eleven: small talk with the lads upstairs, off Bluffball.
s.at(gmt("2026-11-02 11:10"));
s.say("company", "phil", "Anyone see the match last night?", { after: 0 });
s.say("company", "moss-08", "Did you see that ludicrous display last night?", { after: 3 });
s.say("company", "phil", "What was Wenger thinking, sending Walcott on that early?", { after: 40 });
const walk = s.say("company", "moss-08", "The thing about Arsenal is, they always try and walk it in.", { after: 3 });
s.react(walk, "phil", ["⚽"]);
s.say("company", "phil", "Finally. Someone in IT who gets it.", { after: 30 });

s.at(gmt("2026-11-02 11:52"));
const milk = ticket("t4477", "#4477 Out of milk", "IT kitchenette. Urgent.", "moss", 0, ["Someone has finished my milk. I came here to drink milk."], "moss-06");
s.react(milk, "roy", ["😬"]);
answer("t4477", "moss-06");

// Lunch: Jen's speech, and the Internet.
s.at(gmt("2026-11-02 12:30"));
s.say("it", "jen", "Douglas wants me to give a speech about IT on Thursday. To the shareholders. What do I say?", { after: 0 });
s.say("it", "roy", "Tell them about the Internet.", { after: 40 });
s.say("it", "moss", "Better. Show them the Internet.", { after: 15 });
s.say("it", "roy", "Moss, you can't just show people the Internet.", { after: 20 });
const box = s.say("it", "moss", "I can. It's here.", {
	after: 60,
	embeds: [image(`${MEDIA}/internet.png`, { title: "the-internet.png", width: 1200, height: 800, alt: "The Internet: a small black box with a single red light, on a desk in the basement. A note on the wall above it says DO NOT DROP." })],
});
s.react(box, "jen", ["😮"]);
s.say("it", "jen", "That's the Internet? It's so small.", { after: 30 });
s.say("it", "moss", "It's wireless.", { after: 5 });
s.say("it", "roy", "And it weighs nothing.", { after: 5 });
s.say("it", "jen", "Can I borrow it?", { after: 20 });
s.say("it", "moss", "The Elders of the Internet would never allow it.", { after: 10 });
s.say("it", "roy", "Moss.", { after: 8 });
s.say("it", "moss", "...But they don't have to know.", { after: 15 });

// One o'clock: Douglas, rephrased.
s.at(gmt("2026-11-02 13:05"));
const office = s.say("dm-douglas", "douglas", "Jen. My office. Wear something", { after: 0 });
s.delete(office, { after: 240 });
s.say("dm-douglas", "douglas", "HR say I have to rephrase that.", { after: 20 });
s.say("dm-douglas", "douglas", "Jen. My office. Bring the Internet.", { after: 30 });

s.at(gmt("2026-11-02 13:30"));
ticket("t4474", "#4474 Stuck in the lift", "Between six and seven.", "douglas", 0, ["Stuck in the lift between six and seven. With the new girl from Legal."], "moss-03");
const time = s.say("t4474", "douglas", "Take your time.", { after: 20 });
s.delete(time, { after: 90 });
answer("t4474", "moss-03");

// Two: the fire. Moss reports it formally, thinks better of it, and edits it into his email.
s.at(gmt("2026-11-02 14:02"));
const fire = ticket("t4473", "#4473 Fire", "Basement. Ongoing.", "moss", 0, ["Dear Sir stroke Madam, I am writing to inform you of a fire which has broken out at the premises of Reynholm Industries."], "moss-02");
s.edit(fire, "Fire! Fire! Help me! Reynholm Industries, the basement.\n\nLooking forward to hearing from you.\n\nAll the best,\nMaurice Moss", { after: 30 });
s.say("t4473", "moss", "I'll just put this over here, with the rest of the fire.", { after: 40 });
answer("t4473", "moss-02");
s.say("it", "roy", "Moss, there's smoke coming from under your desk.", { after: 120 });
s.say("it", "moss", "I know. I've filed a ticket.", { after: 10 });

s.at(gmt("2026-11-02 14:40"));
ticket("t4478", "#4478 The Internet is blinking", "Presenting it on Thursday.", "jen", 0, ["The Internet's light is blinking. Is it meant to blink? I'm presenting it on Thursday."], "moss-07");
answer("t4478", "moss-07");

// Half three: Roy reads the Support Desk.
s.at(gmt("2026-11-02 15:30"));
s.say("desk", "roy", "Moss. Every single one of them says 'have you tried turning it off and on again'.", { reply: launch, after: 0 });
s.say("desk", "moss", "That's what you say.", { after: 12 });
s.say("desk", "roy", "...", { after: 20 });
const fair = s.say("desk", "roy", "Fair.", { after: 15 });
s.react(fair, "moss", ["🥛"]);

s.at(gmt("2026-11-02 15:45"));
s.say("it", "jen", "So which one of them is the Internet?", { after: 0 });
s.say("it", "moss", "None of them, Jen.", { after: 15 });
s.say("it", "roy", "It's in the box, Jen.", { after: 10 });

// Four: behind the red door, Richmond takes the advice. The swarm runs on those servers.
s.at(gmt("2026-11-02 15:57"));
s.say("serverroom", "richmond", "An agent has told me to try turning it off and on again.", { after: 0 });
s.say("serverroom", "richmond", "I am a servant of the servers. But I will do as it says.", { after: 45 });
s.say("serverroom", "richmond", "Turning it off.", { after: 30 });
s.typing("serverroom", "richmond");

// When the scene is read: the agents are typing, the way agents do, for as long as the swarm's status takes to play
// out, half a minute. Jen has read none of it yet.
for (const agent of ["moss-01", "moss-04", "moss-09"]) s.typing("desk", agent, 30);
for (const room of ["desk", "company", "it", "dm-douglas"]) s.unread(room, "jen");

const out = new URL("../../scenes/itcrowd/scene.jsonl", import.meta.url);
writeFileSync(
	out,
	s.archive({
		server: "wss://scene.apron.chat/itcrowd",
		title: "Reynholm Industries",
		description: "A parody of The IT Crowd. Moss has automated Roy: twelve agents on the Support Desk, a thread per ticket, one answer for all of them. Upstairs, the Internet, a fire, the football, and a server room behind a red door.",
		avatar: `${MEDIA}/scene.png`,
		room: "desk",
		media: ["https://scene.apron.chat"],
	}),
);
console.log(`Wrote ${out.pathname}`);
