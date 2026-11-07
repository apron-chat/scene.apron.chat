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

A scene is a replay: the server compiles the archive once per isolate into
fixed frames, sends them, and asks the client for nothing. A client can't be
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

Then the connection goes idle. Pings are answered by the runtime, without
running any code.

## Cost

Each scene is one Durable Object (`idFromName(name)`), using the WebSocket
Hibernation API. What a viewer costs:

- **Connecting:** one Worker request and one Durable Object request. Unknown
  scene names are refused by the Worker, before any object is reached.
- **Reading:** `auth` and a few `room_list`s (six from apron-web), which
  Cloudflare bills at 20 frames per request. Each is a lookup and a string
  write. The object compiles the scene once per isolate, from the Worker
  bundle: no storage, no fetch.
- **Staying open:** nothing. `{"method":"ping"}` is answered with
  `{"method":"pong"}` by `setWebSocketAutoResponse`, which never wakes the
  object. The object keeps no alarms, timers or storage, so it hibernates
  between frames and is billed no duration while it does.
- **The file and the redirect:** `/<name>.jsonl` is a static asset, which
  doesn't run the Worker. The redirect and the index are one Worker request
  each.

Limits, against a client that misbehaves:

- 30 WebSockets per minute from one address (the `CONNECTIONS` rate limit),
  checked in the Worker. Past it, the handshake is refused, and a client that
  asks why (`?apron_connection_status=1`, apron-web EXT.md §5) is told to wait
  a minute.
- Frames over 4 KiB close the connection. After 100 frames (pings not
  counted), the connection gets `retry_after` and is closed.

## Scenes

Each `scenes/<name>.jsonl` is a scene. Its name is lowercase letters, digits
and dashes. `npm run build` bundles them into the Worker, and `npm test`
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

Requires Node 22 or later.

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
its `serializeAttachment` (up to 2 KiB, which survives hibernation), and
forgotten when it closes. That keeps the cost model above: no storage, and
nothing shared between connections.
