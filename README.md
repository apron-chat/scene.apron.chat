# scene.apron.chat

Serve Apron exports as static scenes.

A scene is an Apron archive (apron-web's
[ARCHIVE.md](https://github.com/apron-chat/apron-web/blob/main/ARCHIVE.md),
JSON Lines) served read-only over the
[Apron protocol](https://apron.chat/protocol). Any client that can connect to
an Apron server can open one: to read it, to test itself against an edge case,
or to take the same screenshot in many clients.

| URL | what |
|---|---|
| `wss://scene.apron.chat/<name>` | the scene, as an Apron server |
| `https://scene.apron.chat/<name>` | redirects to `https://link.apron.chat/#server=wss://scene.apron.chat/<name>`, which opens it in a client. `?room=`, `?message=` and `?user=` pass on to the link. |
| `https://scene.apron.chat/<name>/scene.jsonl` | the scene's file; its media is next to it |
| `https://scene.apron.chat/` | the landing page: every scene, what it shows, and how to open it |

The first scene is [`whosonfirst`](https://scene.apron.chat/whosonfirst): a
new assistant manager's first day in a team chat where the players are named
Who, What and I Don't Know.

## What a client sees

A scene is a replay: the build compiles the archive into fixed frames, and
the server sends them and asks the client for nothing. A client can't be
stopped from asking for some things, so those few answers are worked out up
front too; serving a request only writes its `id` into a precomputed string.

1. On connect: a `server` frame with `auth: ["guest"]`, the scene's `title`,
   `description` and `avatar`, and the capabilities `rooms`, `reactions`,
   `ext:settings` (`read_cursors: false`, or, in a scene with someone's read
   cursor, `read_cursors: true` and `read_receipts: "private"`), `ext:permissions`, `ext:archive`,
   `status` when users have presence, `activity` when the scene has typing,
   `ext:media` when the header names `media` origins, and `ext:bio` when a
   user has a bio. **No `ping`**: a client then sends none. **Not `history`**: a client with it
   would page each room; without it, a client shows what arrived live, which
   is everything.
2. `auth`, which every client sends: it's answered with the header's `you` (or
   a `viewer`), with `ext.permissions` `{write: false, add_members: false,
   move_any: false}`. Nothing lifts it: no scheme besides `guest` is offered.
3. Right after that reply, unasked: a `room_update` with every room `you`
   joined (records and members) and every user, then every record of the
   scene, in `log_id` order, as the live deliveries a member would have seen
   (`message`, `reactions`, `room_update` memberships). The records of rooms
   `you` didn't join come too: a client accepts a record at any time.
4. `room_list`, which a client with `rooms` sends after `auth` in a few shapes
   (joined, not joined, the threads of each room): every shape is
   precomputed, keyed by `filter`, `members`, and `room_id` or
   `parent_room_id`. With presence, a `status` request (an idle report) is
   answered `{}`.
5. Everything that would change something (`message`, `reactions`,
   `room_join`, `me`, `command`, ...) is `denied`; `history` and anything else
   is `unsupported`.

The stream comes after the `auth` reply rather than on connect, because the
protocol puts a sign-in's deliveries after its result (PROTOCOL.md §3.2.2).
apron-web, given the stream before it signed in, took it for an earlier
connection's and marked a gap ("Reconnected · earlier messages aren't
available"). Every client sends `auth`, so it costs nothing.

Then the connection goes idle. The server never closes it: an idle WebSocket
costs nothing on a Worker, and a closed one would only make the client
reconnect and be sent the scene again.

## Cost

The server is one Worker, with no Durable Object: a connection shares nothing
with any other, so nothing needs to be in one place. Each scene is compiled
at build time (`scripts/build.mjs`) into the strings that are sent, so the
Worker parses nothing, and reads no storage. By
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
(Standard: $5 a month, with 10 million requests and 30 million CPU
milliseconds included, then $0.30 per million requests and $0.02 per million
CPU milliseconds), a view costs:

- **Two Worker requests:** the visit to `scene.apron.chat/<name>`, which
  redirects, and the WebSocket. Messages through a Worker are not requests.
- **About 1–2 ms of CPU** (an estimate; the Worker's metrics will tell):
  about 130 `send`s of precomputed strings for `whosonfirst`, and the replies
  to `auth` and a few `room_list`s, each a lookup and a string write.
- **Nothing more for staying open.** A Worker is billed no duration, and the
  server asks for no pings.
- **Nothing for files.** A scene's `scene.jsonl` and its media are static
  assets, which don't run the Worker.

| views a month | requests | CPU (at 2 ms) | over the $5 |
|---|---|---|---|
| 1 million | 2 million | 2 million ms | $0 |
| 10 million | 20 million | 20 million ms | about $3 |
| 100 million | 200 million | 200 million ms | about $60 |

On the Free plan the same fits 100,000 requests a day, about 50,000 views,
and then is refused rather than billed.

The same server in a Durable Object costs more: a Durable Object request on
top of the Worker's, each incoming frame billed at 20 per request, and the
object's wall-clock time while it handles them.

Cloudflare restarts Workers when it updates its runtime or a new version is
deployed, which closes their WebSockets after a grace period. A client then
reconnects, and is sent the scene again.

### Limits

Both are there for a client that loops, buggy or not; a reader never meets
them.

- **30 WebSockets per minute from one address** (the `CONNECTIONS` rate
  limit, which Cloudflare doesn't charge for; it counts per location, and
  roughly). Past it, the handshake is refused, and a client that asks why
  (`?apron_connection_status=1`, apron-web EXT.md §5) is told to wait a
  minute. Without it, one machine reconnecting as fast as it can could make
  tens of millions of requests a day, about $25. With it, one address can
  make at most 43,200 a day, about a cent.
- **100 frames per connection**, pings included, and none over 4 KiB.
  apron-web sends five to seven. Past it, the connection gets `retry_after`
  and is closed, so one connection can't run up CPU time.

## Scenes

| scene | what it shows |
|---|---|
| [`whosonfirst`](https://scene.apron.chat/whosonfirst) | the old ballpark routine in a team chat: mentions, reactions, joins and leaves, threads, an edit, a deletion, avatars, an image |
| [`team`](https://scene.apron.chat/team) | a small team's General room: a thread, a bot, an admin, replies, a code block, reactions, presence |
| [`agent`](https://scene.apron.chat/agent) | a coding agent in a thread, with a finished terminal run and a live one |
| [`rich`](https://scene.apron.chat/rich) | an uploaded image, a mention, a link preview, reactions, typing |
| [`piper`](https://scene.apron.chat/piper) | Pied Piper's long weekend: an edit that starts a thread, a 3 AM terminal alarm, a bot's incident review, live text that never finishes, a board seat that walks out, a deleted video, DMs |
| [`homealone`](https://scene.apron.chat/homealone) | the McCallisters' week: a kid who leaves the family room and isn't counted, an edit that admits who was, a house bot's log, a deleted calling card, burglars in a public room, unanswered DMs, a live log of the traps that never finishes, and a live status screen that redraws in place |

`team`, `agent` and `rich` are apron.chat's screenshot scenes
(`screenshot/scenes/` there), copied unchanged into `scripts/scenes/fixtures/`
and converted by `scripts/scenes/fixtures.mjs`. `piper` began as the fourth,
and grew into its own script, `scripts/scenes/piper.mjs`, whose last
afternoon is still that fixture's. It's a parody of HBO's *Silicon Valley*;
its cast's avatars are cut by `scripts/scenes/piper-avatars.py` from
`piper-avatars.webp`, a pixel-art drawing of them (Richard and Gilfoyle from
drawings of their own), and
`scripts/scenes/piper-art.mjs` draws the rest of its pictures.
`homealone` (`scripts/scenes/homealone.mjs`) is a parody of *Home Alone*
(1990), grown from a one-room screenshot into the week around it;
`scripts/scenes/homealone-art.mjs` draws its pictures, and
`scripts/scenes/homealone-avatars.py` cuts nine of its cast's avatars:
illustrated from `homealone-avatars.webp`, photographed from
`homealone-avatars-photos.webp`, and Kevin, Kate and Peter in watercolour
from `homealone-avatars-family.webp`; the rest of the family keep initials.
Its two photos, Frank's Eiffel Tower and Kevin's dinner, are from Unsplash
(Unsplash License), and the polka behind its voice message is from Pixabay
(Pixabay Content License), credited in the script.

### Adding a scene

1. Make a directory, `scenes/<name>/`. Its name is lowercase letters,
   digits and dashes, and is the scene's address:
   `wss://scene.apron.chat/<name>`. Everything of the scene goes in it, and
   is served from `https://scene.apron.chat/<name>/`.
2. Write the scene in it as `scene.jsonl`, and put its pictures, if any,
   next to it ([Media](#media)).
3. Run `npm test`. It compiles every scene, and checks that each one is
   complete: every record is in a listed room; every author, mention, member,
   reply and parent room it names is in it; every picture it names is a file
   in `scenes/<name>/`; and every live URL names its live text.
4. Look at it: `npm run dev`, and open it in a client
   ([Develop](#develop)).

Nothing else lists scenes: the build finds them, writes the landing page
from them (`scripts/landing.mjs`, as the static `scenes/index.html`), and the
redirect and the server serve whatever it found. A scene's card on the page
takes its `title` and `avatar` from its header, and counts and lists what
it shows from its records, so it changes when the scene does. An avatar on
the scene's own origin is versioned by its contents (`?v=<hash>`), so a new
image under the same name shows at once.

To write the file:

- **Export it from apron-web**, from a real or a scratch server.
- **Script it** with `scripts/scenes/lib.mjs`, which keeps `log_id`s,
  listings and members consistent: `scripts/scenes/whosonfirst.mjs` is an
  example. Add the script to `npm run scenes`, which writes every scripted
  scene.
- **Convert an apron.chat fixture**: add its `.js` to
  `scripts/scenes/fixtures/`, give it a title in `fixtures.mjs`, and run
  `node scripts/scenes/fixtures.mjs <name>`. Pictures in the scene's directory add what
  a fixture doesn't have: `<user_id>.png` becomes that user's avatar, and
  `scene.png` the scene's own.

### The file

A scene is an ordinary archive (apron-web's ARCHIVE.md). A few extensions add
what a screenshot needs and an archive leaves out; readers of archives ignore
them.

```jsonl
{"apron_archive":1,"server":"wss://scene.apron.chat/demo","you":{"user_id":"viewer","name":"Viewer"},"title":"Demo","description":"A scene.","room":"general"}
{"joined":[{"room_id":"general","log_id":"1774546201000","title":"General","latest_log_id":"1774546230000","history_log_id":"1774546201000","members":[{"user_id":"ada"},{"user_id":"viewer"}]}],"not_joined":[],"users":[{"user_id":"ada","name":"Ada","status":"online"},{"user_id":"viewer","name":"Viewer"}]}
{"messages":[{"message_id":"1774546230000","log_id":"1774546230000","room_id":"general","from":{"user_id":"ada","name":"Ada"},"body":{"text":"Hi!"}}]}
{"activity":[{"room_id":"general","from":{"user_id":"ada","name":"Ada"},"typing":5}]}
```

| where | key | what it does |
|---|---|---|
| header | `title`, `description`, `avatar` | the `server` frame's (PROTOCOL.md §3.1) |
| header | `room` | the room or thread that `/<name>` opens on |
| `users` | `status` (and `seen`) | presence: the server advertises `status`, and sends each user's status at sign-in (§4.5.4). An archive leaves these out |
| part | `activity` | `activity` notifications' params, such as typing, sent after everything else; the server advertises `activity`. Keep typing short (the scripts use 5 seconds): long enough to show in a screenshot, gone soon after a visitor arrives. A `read_message_id` is a read cursor (`read()` in `lib.mjs`): someone else's shows who has seen a message in a private room, and `you`'s marks what the reader has read, so only what's after it shows as unread |
| part | `live` | live text by id, `{"<id>": [[ms, "text"], ...]}`, served at `/<name>/live/<id>`: each chunk after its wait, then held open for 30 minutes, so a `terminal` or `append` embed whose `url` is there shows it live |

Times are fixed: a scene shows the dates its `log_id`s say. For a screenshot
that should look recent, set the browser's clock to the scene's time (with
Playwright, `page.clock.setFixedTime`).

### Media

A scene's pictures, such as avatars and image embeds, are files in
`scenes/<name>/`, served as static assets at
`https://scene.apron.chat/<name>/<file>`, and the scene names them by those
URLs. Clients load media from the server's own origin
([§4.8.1](https://github.com/shazow/apron/blob/main/PROTOCOL.md#481-opengraph-metadata-og)),
which for `wss://scene.apron.chat/<name>` is `https://scene.apron.chat`, so
they need nothing more. The header's `media` names that origin too, so that
the file, imported into apron-web as an archive, says where its media is
(ARCHIVE.md §5); the server advertises it as `ext:media`.

The scripts give each picture on the scene's origin a short hash of its file
(`?v=<hash>`), so a client that cached it fetches it again once it changes,
and `npm test` fails while a scene names a picture by an older hash: run
`npm run scenes`. Avatars are in the listing's `users` only, not in each
message's `from`: clients show each field from the user object they keep
([§3.3.1](https://github.com/shazow/apron/blob/main/PROTOCOL.md#331-user-objects)),
and a record's `from` needs only `user_id` and `name`.

Served from another host, such as `wrangler dev` or a Preview, the scene's
`https://scene.apron.chat` URLs are rewritten to that host's origin, so
pictures load from there. `npm test` checks that every URL a scene names is a
file in `scenes/`.

An image embed is an `upload` embed with `og.image` (PROTOCOL.md §4.8.4);
`image()` in `scripts/scenes/lib.mjs` makes one. Use PNG, JPEG, GIF or WebP,
which every client can show; `npm test` checks PNG and JPEG (`.jpg`) files.
A voice message is an `upload` embed with `og.audio`, as apron-web records
one; `audio()` makes it, from an MP3 next to the scene. `scripts/scenes/whosonfirst-art.mjs` draws
`whosonfirst`'s as SVG and renders them to PNG.

### Readers

The `you` of a scene is who reads it: one of its people, as Ada is in the
fixtures, whose messages show as the reader's own; or someone who came to
watch, as Bleachers is in `whosonfirst`, a member of the rooms it joined
without a record of joining.

## Develop

Requires Node 22.6 or later (the build imports TypeScript directly).

```sh
npm install
npm test            # the server in workerd, and every scene
npm run typecheck
npm run dev         # wrangler dev on http://localhost:8787
```

To read a scene in apron-web while developing, run apron-web (`npm run dev`)
and open `http://localhost:5173/#server=ws://localhost:8787/whosonfirst`.

## Deploy

Workers Builds deploys `main` to `scene.apron.chat` (a custom domain in
`wrangler.jsonc`). Its Build command must be `npm run build`; wrangler runs
it itself for `wrangler dev` and `wrangler deploy`.

## Later: instanced scenes

Every connection to a scene reads the same records, and nothing it sends is
kept. An instanced scene could instead let each connection play its own copy
of a room: the writes it sends are answered on that connection only, kept in
the connection's own memory in the Worker, and forgotten when it closes. That
keeps the cost model above: no storage, and nothing shared between
connections.
