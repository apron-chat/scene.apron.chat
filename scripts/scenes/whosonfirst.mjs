// Writes scenes/whosonfirst/scene.jsonl: a new assistant manager's first day in a
// team chat where the players are named Who, What and I Don't Know. A riff on
// the old ballpark routine that leans on what a chat adds: mentions that ping
// the wrong person, reactions that list names, people leaving and joining,
// threads named after players, an edit and a deletion.
//
//   npm run scenes
import { writeFileSync } from "node:fs";
import { image, Script } from "./lib.mjs";

// Its pictures, drawn by whosonfirst-art.mjs, are static files next to the scene, on its own origin.
const MEDIA = "https://scene.apron.chat/whosonfirst";
const player = (name, position, bio) => ({ name, roles: [position], ext: { bio } });
const s = new Script({
	start: "2026-03-26T17:30:00Z",
	you: "bleachers",
	users: {
		abbott: { name: "Abbott", roles: ["manager"], ext: { bio: "Manager, St. Louis Wolves. Knows every name on this team." } },
		costello: { name: "Costello", roles: ["new"], ext: { bio: "Assistant manager. First day. Would just like to know the players' names." } },
		who: player("Who", "1B", "First base."),
		what: player("What", "2B", "Second base."),
		idontknow: player("I Don't Know", "3B", "Third base."),
		why: player("Why", "LF", "Left field."),
		because: player("Because", "CF", "Center field."),
		tomorrow: player("Tomorrow", "P", "Pitching. Not today."),
		today: player("Today", "C", "Catcher. Every day, but mostly Today."),
		idontgiveadarn: player("I Don't Give a Darn", "SS", "Shortstop."),
		scorebot: { name: "Scorebot", roles: ["bot"], ext: { bio: "Posts the lineup card. Takes no questions." } },
		bleachers: { name: "Bleachers", ext: { bio: "Here for the game." } },
	},
	avatars: (user_id) => `${MEDIA}/${user_id}.png`,
});

const players = ["who", "what", "idontknow", "why", "because", "tomorrow", "today", "idontgiveadarn"];

// The rooms, before anyone arrives. I Don't Know and Costello join the dugout later.
s.room("dugout", { title: "Dugout", description: "Clubhouse chat for the St. Louis Wolves. The lineup is in #lineup.", by: "abbott" }, ["who", "what", "why", "because", "today", "idontgiveadarn"]);
s.room("lineup", { title: "Lineup", description: "Today's lineup card. Questions go to the manager.", by: "scorebot", after: 30 }, ["abbott", ...players]);
s.room("bullpen", { title: "Bullpen", description: "Tomorrow warms up. Today catches.", by: "tomorrow", joined: false, after: 30 }, ["today"]);

const card = s.say(
	"lineup",
	"scorebot",
	[
		"**Opening Day lineup: St. Louis Wolves**",
		"",
		"| | Position | Player |",
		"|---|---|---|",
		"| 1 | First base | @who |",
		"| 2 | Second base | @what |",
		"| 3 | Third base | @idontknow |",
		"| 4 | Left field | @why |",
		"| 5 | Center field | @because |",
		"| 6 | Shortstop | @idontgiveadarn |",
		"| 7 | Catcher | @today |",
		"| 8 | Pitcher | @tomorrow |",
		"",
		"_Questions about the lineup go to the manager._",
	].join("\n"),
	{ mentions: players, after: 60 },
);
for (const user of ["who", "what", "idontknow", "because", "today"]) s.react(card, user, ["⚾"]);

// The bullpen, which you haven't joined, but can read.
const warm = s.say("bullpen", "tomorrow", "Warming up. Who's catching me?", { after: 120 });
s.say("bullpen", "today", "No, Who's on first. I'm catching.", { reply: warm });
s.say("bullpen", "tomorrow", "Today?");
s.say("bullpen", "today", "Yes.");
s.say("bullpen", "tomorrow", "So I'm pitching today?");
s.say("bullpen", "today", "No, you're pitching Tomorrow.");
s.say("bullpen", "tomorrow", "I *am* Tomorrow.");
const settled = s.say("bullpen", "today", "Exactly. Today's catching, Tomorrow's pitching. Glad we settled that.");
s.react(settled, "tomorrow", ["🙃"]);

// The dugout.
s.join("dugout", "costello", 300);
const hello = s.say("dugout", "abbott", "Everybody, say hi to @costello, our new assistant manager. First day! 🎉", { mentions: ["costello"], after: 10 });
for (const user of ["who", "what", "why", "because", "today"]) s.react(hello, user, ["👋"], { after: 3 });
const waving = s.say("dugout", "costello", "Thanks! Who's waving?", { reply: hello });
s.say("dugout", "abbott", "Yes. And What, and Why, and Because. Today too.");
s.say("dugout", "costello", "I'm asking who waved.");
s.say("dugout", "abbott", "Right. Who waved. Hover over the 👋, it's all there.", { reply: waving });
s.say("dugout", "costello", "It says “Because, Today, What, Who and Why reacted with 👋”. Is this app broken?", { after: 30 });
s.say("dugout", "abbott", "Works great. Those are the guys' names.");

const first = s.say("dugout", "costello", "Okay. Let's start simple. Who's on first?", { after: 25 });
s.react(first, "who", ["🙋"]);
s.say("dugout", "abbott", "Yes.", { reply: first });
s.say("dugout", "costello", "I mean the fella's name.");
s.say("dugout", "abbott", "Who.");
s.say("dugout", "costello", "The guy playing first!");
s.say("dugout", "abbott", "@who", { mentions: ["who"] });
const rang = s.say("dugout", "who", "you rang?", { after: 8 });
const areYou = s.say("dugout", "costello", "Who are you?", { reply: rang });
s.say("dugout", "who", "yep", { reply: areYou, after: 5 });

const second = s.say("dugout", "costello", "I'll try it another way. What's the name of the guy on second?", { after: 40 });
s.react(second, "what", ["🙋"]);
s.say("dugout", "abbott", "No. What's on second. Who's on first.");
s.say("dugout", "costello", "I'm not asking who's on first!");
s.say("dugout", "abbott", "Who is.");
s.say("dugout", "who", "can people stop pinging me while I stretch 🧘", { after: 30 });
s.say("dugout", "costello", "Nobody pinged you!");
s.say("dugout", "who", "my phone has buzzed nine times", { after: 10 });
s.leave("dugout", "who", 5);
const left = s.say("dugout", "costello", "Who left?", { after: 6 });
s.say("dugout", "abbott", "Yes.", { reply: left });
s.say("dugout", "costello", "The guy who just left the dugout!");
s.say("dugout", "abbott", "Exactly. Who left. What is still here.");
const still = s.say("dugout", "what", "still here 👍");
s.react(still, "abbott", ["👍"]);

s.say("dugout", "costello", "Fine. Third base. Who's on third?", { after: 30 });
s.say("dugout", "abbott", "No, Who's on first. Who's *in the outfield stretching*, but he's on first.");
s.say("dugout", "costello", "Then who is on third??");
s.say("dugout", "abbott", "Who is on first.");
const dunno = s.say("dugout", "costello", "I don't know!");
s.join("dugout", "idontknow", 12);
s.say("dugout", "idontknow", "Somebody call me? Third base, reporting for duty 🫡", { after: 4 });
s.say("dugout", "abbott", "There he is. Third base.", { reply: dunno });
const outburst = s.say("dugout", "costello", "This is the most ******* ***** ****** team in the entire ******* league", { after: 15 });
s.delete(outburst, { after: 9 });
const was = s.say("dugout", "abbott", "What was that?", { after: 4 });
s.say("dugout", "what", "wasn't me", { reply: was });
s.say("dugout", "costello", "Not you!");

// A thread to clear things up, which doesn't.
s.say("dugout", "abbott", "Let's take this to a thread so we don't clutter the dugout.", { after: 20 });
s.room("whos-on-first", { parent_room_id: "dugout", title: "Who's on first", description: "Clearing things up for @costello.", by: "abbott", after: 5 }, ["costello"]);
s.say("dugout", "abbott", "Started one: #whos-on-first", { after: 3 });
const simple = s.say("whos-on-first", "costello", "Great. One simple question, in writing: who is on first?", { after: 20 });
s.say("whos-on-first", "abbott", "It's the title of the thread.");
s.say("whos-on-first", "costello", "I KNOW what the title of the thread is!");
const board = s.say("whos-on-first", "costello", "Fine. I drew the whole infield. Just tell me what's wrong with it.", {
	after: 90,
	embeds: [image(`${MEDIA}/whiteboard.png`, { title: "whiteboard.png", width: 1200, height: 800, alt: "A whiteboard with a baseball diamond: WHO? on first, WHAT? on second, I DON'T KNOW on third, and question marks everywhere" })],
});
s.say("whos-on-first", "abbott", "Nothing. That's the team.", { reply: board });
s.say("whos-on-first", "abbott", "Right field's still open, though. We're looking for a guy.");
s.say("whos-on-first", "costello", "What's his name?");
s.join("whos-on-first", "what", 5);
s.say("whos-on-first", "what", "somebody said my name?", { after: 3 });
s.say("whos-on-first", "costello", "Not you, What!");
s.say("whos-on-first", "abbott", "See, now you've got it. What's on second.");
s.edit(simple, "Great. One simple question, in writing, no pronouns: **the man on first base**. His name. Spell it.", { after: 40 });
s.say("whos-on-first", "abbott", "W-H-O.", { reply: simple });
s.say("whos-on-first", "costello", "I'm starting my own thread.");

s.room("i-dont-know", { parent_room_id: "dugout", title: "I Don't Know", description: "Everything I don't know about this team. Long list.", by: "costello", after: 25 }, []);
s.join("i-dont-know", "idontknow", 10);
s.say("i-dont-know", "idontknow", "Hey, thanks for the thread, boss 🙌", { after: 3 });
s.say("i-dont-know", "costello", "This thread is not FOR you.");
s.say("i-dont-know", "idontknow", "it's got my name on it though");
const his = s.say("i-dont-know", "abbott", "He's right. It's his thread now.");
s.react(his, "idontknow", ["💯"]);

// The outfield, the battery, and the shortstop.
s.say("dugout", "costello", "Forget the infield. Who's in left?", { after: 60 });
s.say("dugout", "abbott", "No, Who's on first.");
s.say("dugout", "costello", "I'm not asking about first! Left field!");
const why = s.say("dugout", "abbott", "Why.");
s.react(why, "why", ["🙋"]);
s.say("dugout", "costello", "I just thought I'd ask.");
s.say("dugout", "abbott", "Well, I just thought I'd tell you. Why's in left.");
s.say("dugout", "costello", "Then tell me why's in left!");
const because = s.say("dugout", "abbott", "Because.");
s.say("dugout", "because", "center field! 🙋", { reply: because, after: 5 });

s.say("dugout", "costello", "Pitcher. Who's pitching?", { after: 30 });
s.say("dugout", "abbott", "Who's on first. Tomorrow's pitching.");
s.say("dugout", "costello", "You won't tell me today?");
s.say("dugout", "abbott", "Today's catching.");
s.say("dugout", "today", "🧤 that's me", { after: 5 });
const time = s.say("dugout", "costello", "WHAT TIME??");
s.say("dugout", "what", "second base, coach 🙋", { reply: time, after: 5 });

const play = s.say(
	"dugout",
	"costello",
	"Alright. Hypothetically. Tomorrow pitches, the batter bunts, Today picks it up and throws it to first. Who gets it?",
	{ after: 45 },
);
s.say("dugout", "abbott", "Naturally.", { reply: play });
s.say("dugout", "costello", "Naturally? Fine! Today throws it to Naturally.");
s.say("dugout", "abbott", "No he doesn't. He throws it to Who.");
s.say("dugout", "costello", "Naturally.");
s.say("dugout", "abbott", "Now you've got it.");
const darn = s.say(
	"dugout",
	"costello",
	[
		"So Today throws it to Who, who is only *sometimes* in the dugout. Who throws it to What. What throws it to I Don't Know, who has his own thread now.",
		"",
		"Everybody waves, nobody will tell me anybody's **name**, and frankly I DON'T GIVE A DARN!",
	].join("\n"),
	{ after: 50 },
);
s.say("dugout", "abbott", "Oh, that's our shortstop.", { after: 6 });
s.say("dugout", "idontgiveadarn", "🙋 shortstop. Nice to meet you, boss!", { reply: darn, after: 4 });
s.react(darn, "idontgiveadarn", ["❤️"]);
for (const user of ["what", "idontknow", "why", "because", "today"]) s.react(darn, user, ["😂"], { after: 2 });

s.join("dugout", "who", 40);
s.say("dugout", "who", "back from stretching. did I miss anything?", { after: 4 });
s.say("dugout", "costello", "I don't know.");
const third = s.say("dugout", "idontknow", "third base! 🙋", { after: 3 });
s.react(third, "costello", ["🤦"]);

const out = new URL("../../scenes/whosonfirst/scene.jsonl", import.meta.url);
writeFileSync(
	out,
	s.archive({
		server: "wss://scene.apron.chat/whosonfirst",
		media: ["https://scene.apron.chat"],
		avatar: `${MEDIA}/scene.png`,
		title: "Who's on First?",
		room: "dugout",
		description: "Opening Day in the St. Louis Wolves dugout. The new assistant manager would just like to know the players' names.",
	}),
);
console.log(`Wrote ${out.pathname}`);
