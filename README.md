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

The server follows ARCHIVE.md §4 (Serving), with one addition: it doesn't wait
to be asked.

1. On connect: a `server` frame with `auth: ["guest"]`, `ping: 45`, the scene's
   `title` and `description`, and the capabilities `history`, `rooms`,
   `reactions`, `ext:settings` (`read_cursors: false`), `ext:permissions`,
   `ext:archive`, and `ext:bio` when a user has a bio.
2. `auth` with scheme `guest` signs in as the header's `you` (or a `viewer`),
   with `ext.permissions` `{write: false, add_members: false, move_any: false}`.
   Nothing lifts it: no other scheme is offered.
3. Right after the `auth` result, the scene is pushed: a `user` notification
   for each user, then every record of the rooms `you` joined, in `log_id`
   order, as the live deliveries (`message`, `reactions`, `room_update`
   memberships) a member would have seen. A core-only client, one with no
   `rooms` or `history`, sees the whole scene from this alone.
4. `room_list` and `history` are answered from the scene for clients that page,
   as any server would. A client that follows recovery (PROTOCOL.md §4.3.5)
   drops the pushed records at or below each room's `latest_log_id`, so they
   don't show as new.
5. Everything that would change something (`message`, `reactions`,
   `room_join`, `me`, `command`, ...) is `denied`; other methods are
   `unsupported`.

Then the connection goes idle. Pings are answered by the runtime, without
running any code.

## Cost

Each scene is one Durable Object (`idFromName(name)`), using the WebSocket
Hibernation API. What a viewer costs:

- **Connecting:** one Worker request and one Durable Object request. Unknown
  scene names are refused by the Worker, before any object is reached.
- **Reading:** a handful of frames (`auth`, `room_list`, a `history` page per
  room), which Cloudflare bills at 20 frames per request. The object parses
  the scene once per isolate, from the Worker bundle: no storage, no fetch.
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
- Frames over 4 KiB close the connection. After 300 frames (pings not
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
