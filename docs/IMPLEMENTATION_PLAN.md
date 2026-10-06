# Proofroom — implementation plan and decision gates

This is a sequence for Claude Code, not a report of completed work. Keep commits small and preserve the student's authority over assessed writing.

## Gate 0 — inspect and choose the stack

Read the official current briefs, starter comments, supplied tests and project documents. Confirm the Fly app name and limits. Propose a small server-rendered or progressively enhanced stack that fits 256 MB, runs on `0.0.0.0:$PORT`, stores authoritative data in `/data`, and serves the complete `README.md` at `/readme/` in initial HTML. Compare one alternative and record the trade-off in a short ADR under `docs/decisions/`. Suggested baseline to evaluate: TypeScript HTTP server + SQLite on the Fly volume + HTTP JSON API; SSE for browser updates if suitable. Do not add a heavyweight graph engine or remote database for fashion.

## Gate 1 — Crit 8 durable vertical slice

Implement a real web path to create and revisit a question, then add a claim or evidence item with server timestamp and actor attribution. Use a durable schema on `/data` and a local development data directory outside Git. Render untrusted content safely. Keep `/` and `/readme/` operational. Add an end-to-end spec test against the running app that creates and re-reads an item. Demonstrate a process restart using the same data path. Provide `dev`, `build` and `start` scripts and a Docker image that fits the course machine. Run `pnpm check`; report `check:evidence` honestly until assessed evidence documents are authored. Do not deploy or flip the repo public without the student's explicit instruction.

## Gate 2 — external agent interface

Document a minimal versioned HTTP API: read room/questions, append a claim, append supporting/challenging evidence, retrieve events since a sequence number. Agent credentials are scoped and separate from the school Claude development token. Show one real external client doing read → write → read against the local server and attribute it to its configured identity. Handle invalid input and authentication failures. If this cannot be done by Crit 8, keep it next rather than fake integration.

## Gate 3 — co-presence and conflict

Give two human browser sessions distinct identities. Broadcast committed events to open sessions in about one second; on reconnect, fetch a snapshot or replay missing events. Preserve both independent append operations. Mutable review-state changes require an expected version and return a conflict with latest state on stale writes. Add spec tests and a real two-browser test; note timing gaps. Only after the HTTP contract is stable, consider a small MCP adapter exposing the same operations to more agent clients.

## Gate 4 — design, resilience and assessed evidence

Implement graph/list views to `docs/ART_DIRECTION.md`; avoid animation that conceals information. Test both marking viewports, keyboard, resize, reduced motion, long content, offline/reconnect and two people acting at once. If authorised to ship, verify persistence after a deployed restart/redeploy. Add server-side observability for Crit 10. The student drafts `README.md` (400–600 words), `PROCESS.md` (900–1100 words), reflections and COMP8020 `research-note.md` (600–800 words) from actual decisions, sources, commits and observations; Claude may critique gaps and check references but must not invent the account.

## Stop conditions and status language

If blocked by a missing human product choice, deployment permission, token or unsafe operation, stop that branch and explain the exact decision needed. Never replace a failure with a green assertion. End each work period with a ledger: implemented / tested / committed / pushed / deployed / still unverified, plus the smallest next step.
