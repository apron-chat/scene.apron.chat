// Writes scenes/homealone/scene.jsonl: the McCallisters' chat over the week
// they went to Paris and left one behind. A parody of Home Alone (1990). It
// grew from a one-room screenshot (Buzz's "probably eating junk and watching
// rubbish", home-alarm's live log, Kate's KEVIN!!!) into the week around it:
// the pizza, the headcount, the empty house, the trip home, and Christmas Eve
// at nine. What a chat adds: a kid who leaves the family room the night before
// and isn't in it to be counted, an edit that admits who was, a bot that logs
// the house, a deleted calling card, a public room two burglars think is
// private, a live log of the traps that never finishes (and, in the family room,
// the same night as home-alarm's sensors see it), and DMs nobody answers.
//
//   node scripts/scenes/homealone.mjs
import { writeFileSync } from "node:fs";
import { audio, image, Script } from "./lib.mjs";

const MEDIA = "https://scene.apron.chat/homealone";

/** A time in Winnetka, Illinois, in December: "2025-12-19 18:30", Central Standard Time (UTC-6). */
const ct = (local) => new Date(`${local.replace(" ", "T")}:00-06:00`).toISOString();

const ESC = "\u001b";
const dim = (text) => `${ESC}[2m${text}${ESC}[0m`;
const red = (text) => `${ESC}[31m${text}${ESC}[0m`;
const yellow = (text) => `${ESC}[33m${text}${ESC}[0m`;
const green = (text) => `${ESC}[32m${text}${ESC}[0m`;
/** One line of home-alarm's log: a time, where, what, and who. */
const event = (time, where, what, who) => `${dim(time)}  ${where.padEnd(14)}${what.padEnd(26)}${who}`;

const s = new Script({
	start: ct("2025-12-12 09:00"),
	you: "kate",
	users: {
		kate: { name: "Kate", status: "online", ext: { bio: "Mother of five. Has the feeling we forgot something." } },
		peter: { name: "Peter", status: "idle", ext: { bio: "Dad. Booked fifteen seats to Paris. Pretty sure he locked the door." } },
		kevin: { name: "Kevin", status: "online", ext: { bio: "8. Man of the house. Not afraid anymore." } },
		buzz: { name: "Buzz", status: "online", ext: { bio: "Eldest. Owner of Axl (tarantula). Do not go in my room." } },
		megan: { name: "Megan", status: "offline", ext: { bio: "Packs her own suitcase, like an adult." } },
		linnie: { name: "Linnie", status: "offline", ext: { bio: "Takes French. Ask me the French for incompetent." } },
		jeff: { name: "Jeff", status: "offline", ext: { bio: "Not packing Kevin's stuff." } },
		fuller: { name: "Fuller", status: "idle", ext: { bio: "Cousin. Likes Pepsi. Do not share a bed with me." } },
		heather: { name: "Heather", status: "offline", ext: { bio: "Cousin. Counted everyone." } },
		frank: { name: "Uncle Frank", status: "idle", roles: ["admin"], ext: { bio: "Peter's brother. Rob's paying for the apartment, which makes this trip free. Free is my favorite price." } },
		homealarm: { name: "home-alarm", status: "online", roles: ["bot"], ext: { bio: "671 Lincoln Blvd. Doors, windows, motion, smoke, furnace. Reports to the family." } },
		harry: { name: "Harry", status: "online", roles: ["officer"], ext: { bio: "Officer Harry. Real police. Gold tooth is regulation." } },
		marv: { name: "Marv", status: "online", ext: { bio: "Oh-Kay Plumbing & Heating. Leaves the water running. It's our thing." } },
		marley: { name: "Marley", status: "idle", ext: { bio: "Shovels the walks on Lincoln Blvd. Salts them. Merry Christmas." } },
		mitch: { name: "Mitch Murphy", status: "offline", ext: { bio: "Next door. Not a McCallister. Counted as one once." } },
		nero: { name: "Little Nero's", status: "online", roles: ["delivery"], ext: { bio: "Pizza, delivered hot to most addresses on Lincoln Blvd." } },
		gus: { name: "Gus Polinski", status: "online", ext: { bio: "The Polka King of the Midwest. Kenosha Kickers. You've heard \"Polka, Polka, Polka\"." } },
		ziggy: { name: "Ziggy", status: "online", ext: { bio: "Tuba, Kenosha Kickers." } },
		stan: { name: "Stan", status: "idle", ext: { bio: "Accordion, Kenosha Kickers. Drives the van." } },
		balzak: { name: "Officer Balzak", status: "idle", roles: ["police"], ext: { bio: "Police. You want the Family Affairs desk." } },
		agent: { name: "Ticket Counter", status: "online", roles: ["airline"], ext: { bio: "Booked through Christmas." } },
	},
	// Pictures for those who'd set one: the bot, the businesses, the Polka King, Buzz (Axl), Harry (his "badge"),
	// Marley (the shovel), and the house's own: Kevin, Kate and Peter. The rest of the family is too busy, Uncle Frank
	// won't pay for one, and Mitch Murphy is a nobody; they keep initials.
	avatars: (user_id) => (["homealarm", "kevin", "kate", "peter", "buzz", "gus", "harry", "marv", "nero", "marley"].includes(user_id) ? `${MEDIA}/${user_id}.png` : undefined),
});

// The rooms, a week before the trip, with no joined notices: they were always there.
const quiet = { announce: false, after: 0.001 };
const kids = ["kevin", "buzz", "megan", "linnie", "jeff", "fuller", "heather"];
s.room("family", { ...quiet, title: "McCallisters ✈️ Paris", description: "15 people. 1 apartment. Flight's at 9.", private: true }, ["kate", "peter", "frank", ...kids, "homealarm"]);
s.room("watch", { ...quiet, title: "Neighborhood Watch", description: "Lincoln Blvd, Winnetka. Report anything suspicious." }, ["kate", "peter", "kevin", "buzz", "marley", "mitch"]);
s.room("security", { ...quiet, title: "Home Security", description: "671 Lincoln Blvd. home-alarm's log." }, ["kate", "peter", "homealarm"]);
s.room("plumbing", { ...quiet, joined: false, title: "Oh-Kay Plumbing & Heating", description: "Licensed. Bonded. We come to you. (While you're out.)" }, ["harry", "marv"]);
s.room("kickers", { ...quiet, joined: false, title: "Kenosha Kickers", description: "Polka, polka, polka. Weddings, wakes, Rotary dinners." }, ["gus", "ziggy", "stan"]);
s.room("dm-peter", { ...quiet, private: true }, ["kate", "peter"]);
s.room("dm-kevin", { ...quiet, private: true, title: "Kevin & Mom" }, ["kate", "kevin"]);
s.room("dm-police", { ...quiet, private: true }, ["kate", "balzak"]);
s.room("dm-airline", { ...quiet, private: true }, ["kate", "agent"]);
s.room("dm-gus", { ...quiet, private: true }, ["kate", "gus"]);

// A week out: the plan.
s.at(ct("2025-12-12 19:00"));
const plan = s.say("family", "peter", "Paris! All fifteen of us, Rob's apartment. Flight **9:00 AM Saturday the 20th**, O'Hare. Airport vans at 7:45. Nobody be late.", { after: 0 });
s.react(plan, "linnie", ["🇫🇷"]);
s.react(plan, "frank", ["🥂"]);
s.say("family", "frank", "Rob's apartment, Rob's dime. Best kind of trip.", { reply: plan, after: 90 });
s.say("family", "fuller", "Is there Pepsi in France?", { after: 40 });
const pepsi = s.say("family", "kate", "@fuller go easy on the Pepsi, okay?", { mentions: ["fuller"], after: 30 });
s.react(pepsi, "kevin", ["😬"]);

s.at(ct("2025-12-13 11:00"));
s.say("plumbing", "harry", "Got the van lettered. **Oh-Kay Plumbing & Heating.** Nobody looks twice at a plumber.", { after: 0 });
s.say("plumbing", "marv", "The O and the K are hyphenated, Harry. It looks like Oh, K.", { after: 60 });
s.say("plumbing", "harry", "That's the joke, Marv.", { after: 30 });

// Thursday the 18th: the list.
s.at(ct("2025-12-18 19:30"));
const PACKING = (done) => `Packing list. Check yourself off when your suitcase is **by the front door**.\n\n${[
	["Buzz", "(Axl stays home)"],
	["Megan", ""],
	["Linnie", "(passport, phrasebook)"],
	["Jeff", ""],
	["Fuller", "(no Pepsi in the suitcase)"],
	["Heather", ""],
	["Kevin", ""],
].map(([kid, note]) => `- [${done.includes(kid) ? "x" : " "}] ${kid} ${note}`.trimEnd()).join("\n")}`;
const packing = s.say("family", "kate", PACKING([]), { after: 0 });
s.react(packing, "peter", ["🙏"]);
s.say("family", "linnie", "*J'ai fini.*", { reply: packing, after: 600 });

// Friday the 19th: Buzz tells the little kids about the neighbor.
s.at(ct("2025-12-19 15:30"));
s.room("marley", { parent_room_id: "watch", title: "Old Man Marley", description: "Buzz says. Nobody can prove it.", by: "buzz", after: 0 }, ["kevin", "kate"]);
s.say("marley", "buzz", "PSA for the little kids, re: the old guy who shovels the walks.", { after: 5 });
s.say("marley", "buzz", "In 1958 he murdered his whole family with a snow shovel. They call him the **South Bend Shovel Slayer**. Everybody knows it. There's just not enough evidence to arrest him.");
const salt = s.say("marley", "buzz", "That bucket of salt he carries around? For the sidewalks? Think about it.", { after: 25 });
s.say("marley", "kevin", "Think about what", { reply: salt, after: 30 });
s.say("marley", "buzz", "The bodies, Kevin.", { after: 10 });
const behave = s.say("marley", "kate", "Buzz, that's enough.", { after: 90 });
s.react(behave, "buzz", ["🙄"]);
const merry = s.say("marley", "marley", "Merry Christmas.", { after: 600 });
s.react(merry, "kevin", ["😱"]);

// The night before: a policeman comes round.
s.at(ct("2025-12-19 17:10"));
s.join("watch", "harry", 0);
s.say("watch", "harry", "Evening, folks. Officer Harry. We're making the rounds before the holidays: anybody going away?", { after: 4 });
const fifteen = s.say("watch", "peter", "We are! All fifteen of us. Paris, first thing in the morning.", { after: 120 });
s.say("watch", "kate", "Peter.", { reply: fifteen, after: 20 });
s.say("watch", "harry", "Lights on timers?", { after: 15 });
s.say("watch", "peter", "Every one of them.", { after: 10 });
s.say("watch", "harry", "Good man. You folks have a nice trip.", { after: 15 });
const tooth = s.say("watch", "kevin", "Why does the policeman have a gold tooth", { after: 50 });
s.react(tooth, "buzz", ["🤨"]);

s.at(ct("2025-12-19 17:40"));
s.say("plumbing", "harry", "Every house on Lincoln is on a timer. I wrote them down.\n\n```\nhouse          lights on\nMurphy         6:30\nHargreaves     6:45\nthe yellow one 7:00\nMcCallister    9:00   ← the silver mine\n```", { after: 0 });
s.say("plumbing", "harry", "The McCallisters leave for Paris at eight. The jewel of Lincoln Boulevard, Marv. The silver mine.");
s.say("plumbing", "marv", "I've been thinking. When we do a house, I want to leave the water running. Plug the sinks. Every house.", { after: 45 });
s.say("plumbing", "harry", "Why would we do that.", { after: 12 });
s.say("plumbing", "marv", "A calling card. So everybody knows it was us. **The Wet Bandits.** 💦", { after: 20 });
s.say("plumbing", "harry", "Marv, this room is public.", { after: 30 });
s.say("plumbing", "marv", "Who reads a plumbing room?", { after: 8 });

// Pizza night.
s.at(ct("2025-12-19 18:30"));
s.room("pizza", { parent_room_id: "family", title: "Pizza", description: "One plain cheese. Spoken for.", by: "kate", after: 0 }, ["peter", "frank", ...kids]);
s.say("pizza", "kate", "Pizza's here. The plain cheese is Kevin's. Nobody touch it.", { after: 5 });
s.say("pizza", "kevin", "Where's the plain cheese?", { after: 300 });
const barf = s.say("pizza", "buzz", "Hey Kev, we got plain cheese, but if you want any, somebody's gonna have to barf it all up. 'Cause I ate it.", { after: 15 });
s.react(barf, "jeff", ["😂"]);
s.react(barf, "kevin", ["😡"]);
s.say("pizza", "fuller", "I'm drinking Pepsi.", { after: 30 });
s.say("pizza", "kevin", "You know what that means. He wets the bed, and I have to sleep with him.", { after: 10 });
s.say("pizza", "kevin", "Who's packing my suitcase anyway", { after: 40 });
s.say("pizza", "megan", "Kevin, you're completely helpless.", { after: 15 });
const french = s.say("pizza", "linnie", "You're what the French call *les incompétents*.", { after: 10 });
s.react(french, "megan", ["🇫🇷"]);
s.react(french, "buzz", ["😂"]);
s.say("pizza", "jeff", "Not it.", { after: 5 });
const milk = s.say("pizza", "peter", "MILK. Kevin just knocked the milk over. It's all over the passports and the tickets.", { after: 60 });
s.say("pizza", "kate", "Got it. Drying the passports, napkins in the trash.", { reply: milk, after: 40 });
const jerk = s.say("pizza", "frank", "Look what you did, you little jerk.", { after: 15 });
s.react(jerk, "kate", ["😐"]);
s.say("pizza", "kevin", "Everyone in this family hates me!", { after: 20 });
s.say("pizza", "kate", "Kevin. Upstairs. Third floor. Now.", { after: 15 });

s.at(ct("2025-12-19 20:10"));
s.edit(packing, PACKING(["Buzz", "Megan", "Linnie", "Jeff", "Fuller", "Heather"]), { after: 0 });

s.at(ct("2025-12-19 20:40"));
s.say("family", "kevin", "I'm the only one in this family who gets treated like scum.", { after: 0 });
s.say("family", "kate", "Then maybe you should ask Santa for a new family.", { after: 120 });
const families = s.say("family", "kevin", "I don't want a new family. I don't want any family. **Families suck!**", { after: 20 });
s.react(families, "buzz", ["🍿"]);
s.say("family", "kevin", "I wish you'd all just disappear.", { after: 40 });
s.leave("family", "kevin", 5);
s.say("family", "buzz", "He left the chat. Can we leave him too?", { after: 30 });
s.say("family", "kate", "Buzz.", { after: 20 });

// In the night, a tree on the power line.
s.at(ct("2025-12-20 02:13"));
s.say("security", "homealarm", "⚡ Power lost (wind; tree on the line at Lincoln & Elm). Running on battery.", { after: 0 });
s.say("security", "homealarm", "Power restored.\n\n- Clocks reset: **7** (all blinking 12:00)\n- Bedroom alarm clocks rung: **0**\n- Phone line: **down**", { after: 12_480 });

// Saturday the 20th: they oversleep.
s.at(ct("2025-12-20 07:58"));
s.say("family", "kate", "PETER. WE OVERSLEPT.", { after: 0 });
s.say("family", "peter", "THE VANS ARE HERE. Everybody GO. Shoes on in the van.", { after: 20 });
s.room("headcount", { parent_room_id: "family", title: "Headcount", description: "Who counted? Be honest.", by: "peter", after: 60 }, ["kate", "frank", "heather", "buzz", "megan", "linnie", "jeff", "fuller"]);
s.say("headcount", "peter", "@heather count the kids. Quick.", { mentions: ["heather"], after: 5 });
const count = s.say("headcount", "heather", "1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11. Eleven! Everyone's here 👍", { after: 40 });
s.react(count, "peter", ["👍"]);
s.say("headcount", "peter", "Eleven. Good. Go, go, go.", { after: 10 });

s.at(ct("2025-12-20 08:15"));
const counted = s.say("watch", "mitch", "uh. why did a girl just count me and then fifteen people drove off in vans", { after: 0 });
s.react(counted, "marley", ["🤔"]);

s.at(ct("2025-12-20 08:52"));
const gate = s.say("family", "frank", "Made it. Kate and Peter are in first class. The rest of us are in coach. Not that I'm counting.", { after: 0 });
s.react(gate, "fuller", ["🥤"]);
s.say("family", "fuller", "Is the Pepsi free on the plane?", { after: 30 });

// Kevin wakes up in an empty house.
s.at(ct("2025-12-20 09:40"));
s.say("security", "homealarm", "Motion: upstairs (third floor). 1 small human. Everyone else: gone since 08:01.", { after: 0 });
s.join("family", "kevin", 300);
s.say("family", "kevin", "Mom? Dad?", { after: 10 });
s.say("family", "kevin", "Buzz?? I'm going in your room", { after: 120 });
const disappear = s.say("family", "kevin", "**I made my family disappear!**", { after: 180 });

s.at(ct("2025-12-20 10:40"));
const forgot = s.say("family", "kate", "I feel like we forgot something.", { after: 0 });
s.say("family", "peter", "You didn't shut the garage.", { reply: forgot, after: 60 });
s.say("family", "kate", "No, that's not it.", { after: 30 });
const kevin = s.say("family", "kate", "KEVIN!!!", { reply: disappear, after: 90 });
s.react(kevin, "peter", ["😱"]);
s.react(kevin, "frank", ["😱"]);
s.react(kevin, "buzz", ["🙄"]);
s.react(kevin, "heather", ["😶"]);
s.edit(count, "1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11. Eleven! Everyone's here 👍 (one was Mitch Murphy from next door)", { after: 60 });
const who = s.say("headcount", "kate", "WHO IS MITCH MURPHY", { reply: count, after: 20 });
s.react(who, "peter", ["🤦"]);
s.say("headcount", "buzz", "In fairness, Kevin wasn't in the chat. You can't count someone who's not in the chat.", { after: 40 });

s.at(ct("2025-12-20 11:00"));
s.say("dm-kevin", "kate", "Kevin, it's Mom. Are you okay? We're on the plane. Answer me.", { after: 0 });
const junk = s.say("family", "kevin", "I'm eating junk and watching rubbish!", {
	after: 300,
	// Photo by Toa Heftiba on Unsplash (Unsplash License): https://unsplash.com/photos/qmgqtK4xIQs
	embeds: [image(`${MEDIA}/dinner.jpg`, { title: "dinner.jpg", type: "image/jpeg", width: 800, height: 1200, alt: "A milkshake with an upside-down ice cream cone and marshmallows on top, and a striped bag of caramel popcorn" })],
});
s.say("family", "kevin", "You'd better come out and stop me!", { after: 20 });
s.react(junk, "buzz", ["🍿"]);
s.say("dm-kevin", "kate", "Kevin. Mom. Please look at your messages.", { after: 900 });

// Paris, and the police in Illinois. The flight lands about five in the afternoon, Chicago time: midnight in Paris.
s.at(ct("2025-12-20 17:40"));
s.say("dm-police", "kate", "Hello, I'm calling from Paris, France. My son is home alone at 671 Lincoln Boulevard, Winnetka. He's eight.", { after: 0 });
s.say("dm-police", "balzak", "Ma'am, you want the Family Affairs desk. I'll transfer you.", { after: 240 });
s.say("dm-police", "kate", "I was transferred FROM the Family Affairs desk.", { after: 30 });
s.say("dm-police", "balzak", "...Hold, please.", { after: 600 });
s.say("dm-police", "balzak", "Okay. I sent a car.", { after: 1800 });

s.at(ct("2025-12-20 18:51"));
s.say("security", "homealarm", "Front door: knock (Winnetka PD). Upstairs: motion → master bedroom → **under the bed**. Front door: knock. Visitor: left.", { after: 0 });
s.say("dm-police", "balzak", "Officer knocked. Nobody answered. House looks fine, lights on timers. I'd say everything's okay.", { after: 600 });
s.say("dm-police", "kate", "He's EIGHT. He's hiding under the bed.", { after: 30 });
s.say("dm-police", "balzak", "We'll swing by again, ma'am. Merry Christmas.", { after: 120 });

s.at(ct("2025-12-20 19:40"));
s.say("dm-peter", "kate", "I'm going home. Next flight, whatever it is.", { after: 0 });
s.say("dm-peter", "peter", "Everything's booked through Christmas. I asked.", { after: 60 });
s.say("dm-peter", "kate", "Then I'll ask again.", { after: 20 });

// The first night at the house.
s.at(ct("2025-12-20 21:02"));
s.say("security", "homealarm", "Night 1 at the house:", {
	after: 0,
	embeds: [{
		kind: "terminal",
		title: "home-alarm events",
		output: [
			event("21:02", "kitchen", "motion", "1 small human (Kevin)"),
			event("21:03", "basement", "door: opened", ""),
			event("21:03", "basement", "furnace: on (loud)", red("screaming")),
			event("21:03", "basement", "door: closed", ""),
			event("21:04", "stairs", "motion (fast)", "1 small human"),
			event("21:04", "bedroom 3", "motion", "under the covers"),
			"",
		].join("\n"),
	}],
});

// Sunday the 21st: Kevin keeps house.
s.at(ct("2025-12-21 08:20"));
s.say("family", "kevin", "I took a shower washing every body part with actual soap. Including all my major crevices. Including in between my toes and in my belly button, which I never did before but sort of enjoyed.", { after: 0 });
const shave = s.say("family", "kevin", "AAAAAAAAAAAAAAAH", { after: 240 });
s.say("family", "kevin", "(aftershave)", { reply: shave, after: 30 });
s.react(shave, "peter", ["😬"]);
s.say("dm-airline", "kate", "I need a seat to Chicago. Today. Any seat.", { after: 600 });
s.say("dm-airline", "agent", "Ma'am, we're booked through Christmas.", { after: 120 });
const hope = s.say("dm-airline", "kate", "This is Christmas. The season of perpetual hope. And I don't care if I have to get out and push this plane myself, I am getting home to my son. If I have to sell my soul to the devil myself, I am going to get home to my son.", { after: 40 });
s.say("dm-airline", "agent", "I have one seat. Dallas, tomorrow. Then you'd standby to Scranton.", { reply: hope, after: 180 });
s.say("dm-airline", "kate", "Take it.", { after: 5 });

// Paris at dusk: five in the afternoon there, ten in the morning in Chicago.
s.at(ct("2025-12-21 10:05"));
const view = s.say("family", "frank", "Paris! The view from Rob's window. Free.", {
	after: 0,
	// Photo by Anna Hunko on Unsplash (Unsplash License): https://unsplash.com/photos/kgz0aexIG9I
	embeds: [image(`${MEDIA}/paris.jpg`, { title: "IMG_0412.jpg", type: "image/jpeg", width: 800, height: 1200, alt: "The Eiffel Tower at dusk, its lights coming on, over the Seine" })],
});
s.react(view, "linnie", ["😍"]);
s.react(view, "peter", ["😬"]);
const wonderful = s.say("family", "frank", "Rob's TV gets one channel and it's *It's a Wonderful Life* dubbed in French.", { after: 300 });
s.react(wonderful, "linnie", ["🇫🇷"]);
s.react(wonderful, "megan", ["😭"]);

s.at(ct("2025-12-21 11:30"));
s.say("family", "kevin", "Did the grocery shopping. By myself.\n\n- [x] milk\n- [x] orange juice\n- [x] fabric softener\n- [x] TV dinner (macaroni and cheese)\n- [x] toy army men\n- [x] a blowtorch\n- [ ] toilet paper\n- [ ] a toothbrush approved by the American Dental Association\n\nTotal: **$58.17**", { after: 0 });
s.say("family", "buzz", "With WHAT money", { after: 60 });
s.say("family", "kevin", "Yours. It was under your bed.", { after: 20 });
s.say("family", "buzz", "KEVIN. That's my savings. And don't you dare touch Axl.", { after: 10 });
s.say("dm-kevin", "kate", "Kevin, don't open the door to anyone. I'm coming home.", { after: 600 });

s.at(ct("2025-12-21 13:05"));
s.say("plumbing", "marv", "Harry, that kid at the light on Main was staring at us.", { after: 0 });
s.say("plumbing", "harry", "Kids stare. It's what they do. Drive.", { after: 20 });

// Monday the 22nd: Marv's calling card, and a party.
s.at(ct("2025-12-22 10:15"));
s.join("watch", "marv", 0);
const card = s.say("watch", "marv", "Hi neighbors!! Just did a house on Lincoln. Left the water running. **We're the Wet Bandits!** 💦💦", { after: 3 });
s.say("watch", "harry", "Marv.", { after: 25 });
s.say("watch", "harry", "Delete that.", { after: 3 });
s.delete(card, { after: 20 });
s.leave("watch", "marv", 2);
s.say("watch", "mitch", "who are the wet bandits", { after: 60 });
s.say("watch", "harry", "Nobody. Plumbers. It's a plumbing thing. Merry Christmas everybody.", { after: 30 });
s.leave("watch", "harry", 2);
s.say("dm-peter", "kate", "Peter, a burglar just posted in Neighborhood Watch and deleted it.", { after: 400 });
s.say("dm-peter", "peter", "Officer Harry handled it. Nice guy.", { after: 300 });

s.at(ct("2025-12-22 18:30"));
s.say("security", "homealarm", "Living room: occupancy **9**. Music: on. One guest (tall, 6'6\") walking past the window every 30 seconds.", { after: 0 });
s.say("plumbing", "marv", "They're home, Harry. They're having a party.", { after: 120 });
s.say("plumbing", "harry", "The tall guy walks past the window every thirty seconds.", { after: 60 });
s.say("plumbing", "marv", "Popular guy.", { after: 10 });
s.say("plumbing", "harry", "...Let's go. We'll come back.", { after: 40 });

s.at(ct("2025-12-22 20:05"));
const cheese = s.say("family", "kevin", "Ordered a lovely cheese pizza. Just for me.", { after: 0 });
s.react(cheese, "buzz", ["😤"]);
s.join("watch", "nero", 1500);
s.say("watch", "nero", "Driver report, 671 Lincoln. Customer said leave the pizza on the step, money's under the mat. Then a guy named Johnny counted to ten and SHOT AT ME. Then he said keep the change.", { after: 5 });
s.say("watch", "kevin", "Keep the change, ya filthy animal.", {
	after: 90,
	embeds: [{ kind: "link", url: "https://filthysouls.example/", og: { site_name: "Videotheque", title: "Angels with Filthy Souls (1938)", description: "Johnny, a gangster, has a word with Snakes. Black and white. Do not watch alone." } }],
});
s.say("watch", "nero", "Not delivering to Lincoln after dark again.", { after: 60 });
s.leave("watch", "nero", 2);
s.say("dm-kevin", "kate", "Kevin, who is Johnny???", { after: 1200 });

// Tuesday the 23rd: Kate gets as far as Scranton; the bandits work it out.
s.at(ct("2025-12-23 16:00"));
s.say("dm-airline", "kate", "Scranton. I'm in Scranton. The Chicago flights are booked?", { after: 0 });
s.say("dm-airline", "agent", "Through Christmas, ma'am.", { after: 90 });
const bribe = s.say("dm-airline", "kate", "I'll give you my earrings. My watch. Anything.", { after: 20 });
s.say("dm-airline", "agent", "Ma'am, that's a bribe. And they're still booked.", { reply: bribe, after: 60 });

s.at(ct("2025-12-23 21:00"));
s.say("plumbing", "harry", "I went back by. The tall guy at the party is a cardboard cutout on a train set, Marv.", { after: 0 });
s.say("plumbing", "harry", "And the guy who shot the pizza boy is a movie. The kid's alone. He's been alone the whole time.", { after: 20 });
s.say("plumbing", "marv", "Johnny's not real?", { after: 15 });
s.say("plumbing", "harry", "Tomorrow night. Nine o'clock. The McCallister house.", { after: 30 });

// Christmas Eve.
s.at(ct("2025-12-24 09:10"));
const ringing = s.say("dm-gus", "gus", "Excuse me, ma'am. I couldn't help overhearing you at the ticket counter. Gus Polinski. Polka King of the Midwest? Kenosha Kickers?", { after: 0 });
s.say("dm-gus", "kate", "...Hi.", { after: 60 });
s.say("dm-gus", "gus", "We're driving to Milwaukee for a show. Chicago's on the way, more or less. It's a van, but it's warm. You're welcome to come.", { after: 30 });
s.say("dm-gus", "kate", "Yes. Thank you. Yes.", { reply: ringing, after: 10 });
s.say("kickers", "gus", "Picked up a lady at the Scranton airport. Her boy's home alone in Chicago. We're taking her.", { after: 90 });
const polka = s.say("kickers", "ziggy", "Should we play her something?", { after: 30 });
s.say("kickers", "gus", "We'll play her the hit.", {
	reply: polka,
	after: 20,
	embeds: [{ kind: "link", url: "https://kenoshakickers.example/", og: { site_name: "Kenosha Kickers", title: "Polka, Polka, Polka", description: "The Kenosha Kickers, led by Gus Polinski, the Polka King of the Midwest. Available on cassette." } }],
});
s.react(polka, "stan", ["🪗"]);

s.at(ct("2025-12-24 11:30"));
s.say("dm-gus", "gus", "Don't worry about your boy. One time I left one of my kids at a funeral parlor. All day. He was fine.", { after: 0 });
s.say("dm-gus", "gus", "Kids are resilient like that.", { after: 20 });
s.say("dm-gus", "kate", "...", { after: 60 });
s.say("dm-gus", "gus", "I probably shouldn't have told you that one.", { after: 30 });

s.at(ct("2025-12-24 14:00"));
s.room("choir", { parent_room_id: "watch", title: "Church, 2 PM", description: "Choir practice. Mostly empty pews.", by: "kevin", after: 0 }, ["marley"]);
s.say("choir", "kevin", "Old Man Marley is at church. He waved. I'm sitting by him. If I stop posting, tell Buzz he was right.", { after: 5 });
s.say("choir", "marley", "My granddaughter sings in the choir. I can't come tonight, so I come to practice.", { after: 300 });
s.say("choir", "kevin", "Why can't you come tonight?", { after: 30 });
s.say("choir", "marley", "My son and I had a fight, years ago. We haven't spoken since.", { after: 60 });
const call = s.say("choir", "kevin", "Why don't you call him? If you're scared, you could do it anyway. I was scared of my basement.", { after: 40 });
s.react(call, "marley", ["🙏"]);
s.say("choir", "marley", "Merry Christmas, Kevin.", { after: 30 });

s.at(ct("2025-12-24 16:30"));
s.join("security", "kevin", 0);
s.room("battleplan", { parent_room_id: "security", title: "Battle plan", description: "This is my house. I have to defend it.", by: "kevin", after: 5 }, ["homealarm", "kate"]);
const battle = s.say("battleplan", "kevin", "This is my house. I have to defend it.", {
	after: 5,
	embeds: [image(`${MEDIA}/battleplan.png`, { title: "battleplan.png", width: 1200, height: 800, alt: "Kevin's pencil battle plan of the house: a BBQ starter on the front door knob, a blowtorch at the back door, ice on the basement steps, tar and a nail on the stairs, an iron in the laundry chute, paint cans on the stairs, Micro Machines, ornaments, a fan and feathers, Axl the tarantula, and a zip line to the treehouse" })],
});
s.react(battle, "homealarm", ["🫡"]);
s.say("battleplan", "kevin", "@homealarm don't call the police until I say.", { mentions: ["homealarm"], after: 30 });
s.say("battleplan", "homealarm", "Armed. Mode: Kevin. Police: on hold until you say.", { after: 2 });
// A voice message from the van: Kate's voice, with the band faintly behind her, "Fun Polka Song for Dancing" by
// Nick Panek (Pixabay Content License; Pixabay track 221380). Mixed with ffmpeg: the voice at -16 LUFS, the polka
// 18 dB under it, low-passed at 3 kHz, faded in and out. Its alt is the script she read.
const love = s.say("dm-kevin", "kate", "I'm on my way!! Don't open the door for anyone", {
	after: 3000,
	embeds: [audio(`${MEDIA}/voicenote.mp3`, { title: "voice-message.mp3", alt: "Kate, over a polka band in a van: Kevin, it's Mom. I'm in a van with a polka band. Don't ask. We're in Indiana. Don't open the door for anyone. I'm coming home, sweetheart. I love you." })],
});

s.at(ct("2025-12-24 20:30"));
const heard = s.say("family", "kate", "Has anyone heard from Kevin today?", { after: 0 });
s.say("family", "buzz", "@kate relax, he's fine. Probably eating junk and watching rubbish.", { mentions: ["kate"], reply: heard, after: 240 });
const champagne = s.say("family", "frank", "Kate, the airline lounge asks if we still want the champagne. I said yes. It's on your card.", { after: 600 });
s.react(champagne, "kate", ["😤"]);

// Nine o'clock.
s.at(ct("2025-12-24 21:00"));
s.say("plumbing", "harry", "Nine o'clock. I'll take the front. You take the basement.", { after: 0 });
s.say("plumbing", "marv", "Should I leave the water running?", { after: 8 });
const alarm = s.say("security", "homealarm", "🚨 **Alarm**: front door, back door, basement. Live log:", { after: 40, embeds: [{ kind: "terminal", title: "home-alarm events", url: `${MEDIA}/live/christmas-eve` }] });
s.react(alarm, "kevin", ["😈"]);
const mirror = s.say("family", "homealarm", "🚨 **Alarm** at the house. Kevin says not to worry.", { after: 2, embeds: [{ kind: "terminal", title: "home-alarm status", url: `${MEDIA}/live/christmas-eve-status` }] });
s.react(mirror, "buzz", ["🍿"]);
s.react(mirror, "kate", ["😱"]);
s.live("christmas-eve", [
	[400, `${dim("$ home-alarm tail --house 671-lincoln")}\n`],
	[700, `${event("21:00:41", "front door", "knob: 400°F (BBQ starter)", `intruder 1: ${red("AAAAAH")}`)}\n`],
	[700, `${event("21:00:58", "basement", "steps: ice", "intruder 2: down")}\n`],
	[700, `${event("21:01:20", "doggy door", "BB gun", `intruder 2: ${red("AAAAAH")}`)}\n`],
	[800, `${event("21:02:07", "basement", "laundry chute: iron", "intruder 2: face")}\n`],
	[800, `${event("21:02:40", "back door", "blowtorch", `intruder 1: ${yellow("hat on fire")}`)}\n`],
	[800, `${event("21:03:15", "basement", "stairs: tar", "intruder 2: shoes lost")}\n`],
	[700, `${event("21:03:31", "basement", "stairs: nail", `intruder 1: ${red("AAAAAAAAAAAH")}`)}\n`],
	[800, `${event("21:04:02", "kitchen", "window: ornaments", "intruder 2: barefoot")}\n`],
	[800, `${event("21:04:30", "front hall", "fan: feathers", "intruder 1: chicken")}\n`],
	[800, `${event("21:05:11", "stairs", "paint can ×2", "both")}\n`],
	[800, `${event("21:05:50", "dining room", "Axl (tarantula)", `intruder 2: ${red("AAAAAAAAAAAAAAAAH")}`)}\n`],
	[500, `${event("21:05:52", "dining room", "crowbar", "intruder 1 → intruder 2")}\n`],
	[800, `${event("21:06:30", "hall", "Micro Machines", "intruder 2: down")}\n`],
	[900, `${event("21:07:04", "attic", "zip line → treehouse", "1 small human (Kevin)")}\n`],
	[900, `${event("21:07:40", "zip line", "rope: cut", "2 adults: down")}\n`],
	[1200, `${event("21:09:12", "next door", "motion", "2 adults, 1 small human, ")}`],
	[1500, "1 snow sh"],
]);
// The family room's copy is the same night as home-alarm sees it, sensor by sensor, redrawn in place rather than
// appended: a bar of history for each (an evening of green, then the traps), what each reports in its own narrow terms
// (the smoke detector smells a hat; the thermostat minds the doors), the latest event, and, along the bottom, the
// living-room TV, playing Kevin's gangster film to the end. It doesn't know who broke in: they're adults, or a chicken.
// It promised Kevin not to call the police until he says (in Battle plan), and counts every time it wanted to. Its
// last frame is Kevin caught next door: it calls anyway, then breaks off mid-line, so Kevin's row keeps the frame
// before: fine.
const OK = 0, WARN = 1, BAD = 2;
const shade = { [OK]: green, [WARN]: yellow, [BAD]: red };
const sensors = ["doorbell", "front door", "smoke", "thermostat", "motion", "police", "Kevin"];
const subtitles = {
	start: "Who is it?",
	"21:00:58": "Leave it on the doorstep and get the hell outta here.",
	"21:03:15": "I'm gonna give you to the count of ten…",
	"21:05:11": "One… two…",
	"21:05:50": "…ten.",
	"21:05:52": "[gunfire]",
	"21:07:40": "Keep the change, ya filthy animal.",
};
const night = [
	// [time, what happened, and what the sensors now report: [level, text]].
	["21:00:41", "front door: knob at 400°F · adult: AAAAAH", { "front door": [BAD, "knob 400°F (Kevin's setting)"] }],
	["21:00:58", "basement steps: ice · adult: down", { thermostat: [WARN, "67°F · basement door open"], motion: [WARN, "1 small human, 2 adults"] }],
	["21:01:20", "doggy door: BB · adult: AAAAAH", {}],
	["21:02:07", "laundry chute: iron · adult: face", {}],
	["21:02:40", "back door: blowtorch · adult: hat on fire", { smoke: [BAD, "detected: 1 hat"], thermostat: [WARN, "66°F · back door open"] }],
	["21:03:15", "basement stairs: tar · adult: shoes off", {}],
	["21:03:31", "basement stairs: nail · adult: AAAAAAAAAAAH", {}],
	["21:04:02", "kitchen window: ornaments · adult: barefoot", { thermostat: [WARN, "65°F · kitchen window open"] }],
	["21:04:30", "front hall: fan, feathers · adult: feathered", { motion: [BAD, "1 small human, 1 adult, 1 chicken (?)"] }],
	["21:05:11", "stairs: paint cans · 2 adults: face", {}],
	["21:05:50", "dining room: Axl · adult: AAAAAAAAAAAAAAAAH", { motion: [BAD, "1 small human, 1 adult, 1 chicken (?), 1 spider"] }],
	["21:05:52", "dining room: crowbar · adult → adult", {}],
	["21:06:30", "hall: Micro Machines · adult: down", {}],
	["21:07:40", "zip line: rope cut · 2 adults: down", { thermostat: [WARN, "63°F · please close the back door"], motion: [BAD, "1 spider · yard: 1 adult, 1 chicken (?)"] }],
];
const CELLS = 16;
const home = `${ESC}[H`;
const row = (n) => `${ESC}[${n};1H${ESC}[2K`;
const italic = (text) => `${ESC}[3m${text}${ESC}[23m`;
const state = {
	doorbell: [WARN, "2 unfamiliar faces · didn't ring"],
	"front door": [OK, "locked"],
	smoke: [OK, "clear"],
	thermostat: [OK, "68°F"],
	motion: [OK, "1 small human"],
	police: [OK, "on hold (Kevin said)"],
	Kevin: [OK, "fine"],
};
// An evening of history, all green, then where each stands at nine.
const history = Object.fromEntries(sensors.map((name) => [name, [...Array(CELLS - 1).fill(OK), state[name][0]]]));
const top = () => `${row(1)}  home-alarm · 671 Lincoln Blvd${" ".repeat(36)}${dim("mode: Kevin")}${row(2)}  ${green("●")} Everything is fine. Kevin says.`;
const board = () => sensors.map((name, i) => `${row(4 + i)}  ${dim(name.padEnd(12))}${history[name].map((level) => shade[level]("▐")).join("")}  ${state[name][1]}`).join("");
const latest = (time, text) => `${row(12)}  ${dim(time)}  ${text}`;
const tv = (line) => `${row(13)}  ${dim("─".repeat(76))}${row(14)}  TV ▶ Angels with Filthy Souls${" ".repeat(26)}${dim("living room · vol 100")}${row(15)}     ${italic(line)}`;
/** Seconds since nine o'clock, of a time such as "21:03:31". */
const since9 = (time) => time.split(":").map(Number).reduce((total, part, i) => total + part * [3600, 60, 1][i], 0) - 21 * 3600;
/**
 * The wait between updates, longer the longer the night took between them: 2 to 4 seconds (a minute or more: 4),
 * played 40% faster, about 1.4 to 2.9.
 */
const pace = (from, to) => Math.round((20 + (Math.min(since9(to) - since9(from), 60) / 60) * 20) / 1.4) * 100;
/** Moves every sensor's history on by one, to where it stands now. */
const tick = () => {
	for (const name of sensors) history[name] = [...history[name].slice(1), state[name][0]];
};
let subtitle = subtitles.start;
const status = [[400, `${ESC}[2J${home}${top()}${board()}${latest("21:00:00", dim("2 adults at the doors"))}${tv(subtitle)}`]];
let then = "21:00:00";
let urges = 0;
for (const [time, text, now] of night) {
	Object.assign(state, now);
	urges++;
	state.police = [urges < 5 ? WARN : BAD, `wanted to call: ${urges} · allowed: 0`];
	subtitle = subtitles[time] ?? subtitle;
	tick();
	status.push([pace(then, time), `${home}${top()}${board()}${latest(time, text)}${tv(subtitle)}`]);
	then = time;
}
// Kevin, caught next door. It calls anyway.
state.police = [BAD, `wanted to call: ${urges + 1} · calling anyway`];
tick();
status.push([pace(then, "21:09:12"), `${home}${top()}${board()}${latest("21:09:12", "next door: 2 adults, 1 small human, ")}`], [1800, "1 snow sh"]);
s.live("christmas-eve-status", status);

// Kate, somewhere in Indiana, in a polka van.
s.at(ct("2025-12-24 21:08"));
s.say("dm-gus", "kate", "Gus. Drive faster.", { after: 0 });
s.say("dm-gus", "gus", "Ma'am, it's a polka van.", { after: 20 });
// Kevin has read every one of Mom's messages. He has answered none.
s.read("dm-kevin", "kevin", love);
// Kate has read none of it: a reader's first visit starts with every room unread, and reads its way in. (Where Kate
// posted, apron-web counts only what came after her own last message.)
for (const room of ["family", "pizza", "headcount", "watch", "marley", "choir", "security", "battleplan", "dm-peter", "dm-kevin", "dm-police", "dm-airline", "dm-gus"]) s.unread(room, "kate");
s.typing("family", "kevin");
s.typing("dm-gus", "gus");

const out = new URL("../../scenes/homealone/scene.jsonl", import.meta.url);
writeFileSync(
	out,
	s.archive({
		server: "wss://scene.apron.chat/homealone",
		title: "McCallisters",
		description: "A parody of Home Alone (1990). Fifteen McCallisters go to Paris and one stays home: a headcount that counted the neighbor, a house bot's log, two burglars in a public room, a mother in a polka van, and Christmas Eve at nine, live.",
		avatar: `${MEDIA}/scene.png`,
		room: "family",
		media: ["https://scene.apron.chat"],
	}),
);
console.log(`Wrote ${out.pathname}`);
