# Proofroom external agent API

A minimal versioned HTTP API for external agent clients, separate from the
browser's cookie-based session. See `docs/IMPLEMENTATION_PLAN.md` Gate 2 for
the requirement this implements, and `src/api.ts` / `src/apiAuth.ts` for the
implementation.

## Authentication

Every `/api/v1/*` request needs `Authorization: Bearer <token>`. Valid tokens
are configured on the server via the `AGENT_TOKENS` environment variable, a
comma-separated list of `token:label` pairs:

```
AGENT_TOKENS=9f2c1e...:review-agent,4b7a08...:research-agent
```

Each `label` becomes that agent's permanent, server-attributed actor name —
the same label always resolves to the same actor row, so repeated calls from
one agent accumulate under one consistent identity. A request's actor is
**always** resolved from its token server-side; a JSON body can never assert
who made a request.

These tokens are local, scoped demo/agent credentials. They are **not** the
course Claude development token, must never be set to it, and are never
committed to the repo (keep them in an untracked env file or your shell).
When this app is deployed, `AGENT_TOKENS` belongs in Fly's secrets
(`flyctl secrets set AGENT_TOKENS=...`), never added to `fly.toml`'s
`[env]` block, which is committed.

A request with no token, or a token not listed in `AGENT_TOKENS`, gets
`401 {"error": "missing or unrecognised agent token"}`.

## Endpoints

All bodies and responses are JSON. Validation failures return
`400 {"error": "..."}`; unknown ids return `404 {"error": "..."}`; too many
requests from one agent identity return `429 {"error": "too many requests"}`.

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/v1/questions` | — | List: `{ questions: [{ id, title, created_at, actor_name, claim_count }] }` |
| POST | `/api/v1/questions` | `{ title, body? }` | `title` 3–200 chars. `201` with the created question. |
| GET | `/api/v1/questions/:id` | — | Full detail: question + claims, each with evidence, current review `version`, and review history. |
| POST | `/api/v1/questions/:id/claims` | `{ body }` | `body` 1–4000 chars. `201` with the created claim. |
| POST | `/api/v1/claims/:id/evidence` | `{ body, relation, source_url? }` | `relation` is `"supports"` or `"challenges"`; `source_url`, if given, must be `http(s)`. `201` with the created evidence. |
| POST | `/api/v1/claims/:id/review` | `{ expected_version, reason }` | `reason` 10–1000 chars. The number must equal the version last read. On stale input, `409` returns `{ error, latest }` and changes nothing. On success, `200` returns the new version. A review records an inspection, not verification. |
| GET | `/api/v1/events?since=<seq>` | — | Up to 100 append-only events with `seq > since`, oldest first. Agents can poll this durable log. |

Browser co-presence uses `/events/stream` (server-sent events) to trigger a fresh
server-rendered snapshot. It does not accept writes or bearer tokens; the JSON
API above remains the explicit write/read boundary for external agents.

## Trying it against a local server

```sh
AGENT_TOKENS=demo-token-change-me:demo-agent DATA_DIR=./.data PORT=8080 \
  node src/server.ts

# in another shell
AGENT_TOKEN=demo-token-change-me pnpm demo:agent
```

`scripts/demo-agent-client.ts` is a real external client (a separate process
over HTTP, not a mock): it reads the current questions, creates a question
and a claim, then re-reads the question and prints the actor name the server
attributed the writes to.
