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
| `https://scene.apron.chat/<name>.jsonl` | the scene's file |
| `https://scene.apron.chat/` | the list of scenes |

The first scene is [`whosonfirst`](https://scene.apron.chat/whosonfirst): a
new assistant manager's first day in a team chat where the players are named
Who, What and I Don't Know.

## What a client sees

A scene is a replay: the build compiles the archive into fixed frames, and
the server sends them and asks the client for nothing. A client can't be
stopped from asking for some things, so those few answers are worked out up
front too; serving a request only writes its `id` into a precomputed string.

1. On connect: a `server` frame with `auth: ["guest"]`, `ping: 45`, the scene's
   `title` and `description`, and the capabilities `rooms`, `reactions`,
   `ext:settings` (`read_cursors: false`), `ext:permissions`, `ext:archive`,
   and `ext:bio` when a user has a bio. **Not `history`**: a client with it
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
   `parent_room_id`.
5. Everything that would change something (`message`, `reactions`,
   `room_join`, `me`, `command`, ...) is `denied`; `history` and anything else
   is `unsupported`.

The stream comes after the `auth` reply rather than on connect, because the
protocol puts a sign-in's deliveries after its result (PROTOCOL.md §3.2.2).
apron-web, given the stream before it signed in, took it for an earlier
connection's and marked a gap ("Reconnected · earlier messages aren't
available"). Every client sends `auth`, so it costs nothing.

Then the connection goes idle, answering only pings.

## Cost

The server is one Worker, with no Durable Object: a connection shares nothing
with any other, so nothing needs to be in one place. Each scene is compiled
at build time (`scripts/build.mjs`) into the strings that are sent, so the
Worker parses nothing, and reads no storage. What a viewer costs, by
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/):

- **Connecting:** one Worker request. WebSocket messages through a Worker are
  not requests, and a Worker is billed no duration, so the rest is CPU time.
- **Reading:** about 130 `send`s of precomputed strings (for `whosonfirst`), and the replies to
  `auth` and a few `room_list`s (six from apron-web), each a lookup and a
  string write. No `history`.
- **Staying open:** a `{"method":"pong"}` every `ping` (45 seconds), a few
  microseconds of CPU each, and nothing for the time between.
- **The file and the redirect:** `/<name>.jsonl` is a static asset, which
  doesn't run the Worker. The redirect and the index are one Worker request
  each.

The same server in a Durable Object, with hibernation and the runtime
answering pings, costs more: a Durable Object request on top of the Worker's,
each incoming frame billed at 20 per request, and the object's wall-clock time
while it handles them.

Cloudflare restarts Workers when it updates its runtime or a new version is
deployed, which closes their WebSockets after a grace period. A client then
reconnects, and is sent the scene again.

Limits, against a client that misbehaves:

- 30 WebSockets per minute from one address (the `CONNECTIONS` rate limit),
  checked before a scene is served. Past it, the handshake is refused, and a
  client that asks why (`?apron_connection_status=1`, apron-web EXT.md §5) is
  told to wait a minute.
- Frames over 4 KiB close the connection. A connection may send 100 frames at
  once, pings included, and one more every 10 seconds after; past that, it
  gets `retry_after` and is closed. That bounds the CPU time any one
  connection can use.

## Scenes

Each `scenes/<name>.jsonl` is a scene. Its name is lowercase letters, digits
and dashes. `npm run build` compiles them into the Worker, and `npm test`
checks that each one is complete: every record is in a listed room, and every
author, mention, member, reply and parent room it refers to is in it.

A scene is an ordinary archive, with two optional keys in its header for the
`server` frame (PROTOCOL.md §3.1): `title` and `description`. Readers of
archives ignore keys they don't know.

```jsonl
{"apron_archive":1,"server":"wss://scene.apron.chat/demo","you":{"user_id":"viewer","name":"Viewer"},"title":"Demo","description":"A scene."}
{"joined":[{"room_id":"general","log_id":"1774546201000","title":"General","latest_log_id":"1774546230000","history_log_id":"1774546201000","members":[{"user_id":"ada"},{"user_id":"viewer"}]}],"not_joined":[],"users":[{"user_id":"ada","name":"Ada"},{"user_id":"viewer","name":"Viewer"}]}
{"messages":[{"message_id":"1774546230000","log_id":"1774546230000","room_id":"general","from":{"user_id":"ada","name":"Ada"},"body":{"text":"Hi!"}}]}
```

To make one:

- **Export it from apron-web**, from a real or a
  scratch server.
- **Script it**, with `scripts/scenes/lib.mjs`, which keeps `log_id`s,
  listings and members consistent. `scripts/scenes/whosonfirst.mjs` writes
  `whosonfirst.jsonl`: run `npm run scenes` after changing it.

The `you` of a scene is who reads it. Make it a member of the rooms it
joined, without a membership record, so it reads as someone who came to
watch.

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
