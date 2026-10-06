# Proofroom — working rules for coding agents

Read the current [Final Project brief](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/), [Crit 8 brief](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/08-its-alive/), `spec/README.md`, `docs/PRODUCT_REQUIREMENTS.md`, `docs/ART_DIRECTION.md`, and `docs/IMPLEMENTATION_PLAN.md` before implementing. The course and starter contracts override suggestions here. The student owns product judgement; AI may draft assessed documents at the student's direction from verified decisions, code and commits, but must mark uncertainty and never invent the student's experience or citations.

## Product thesis

Proofroom is a shared evidence room for people and coding agents working on the same question. A claim is not a fact just because an agent wrote it. Visitors create questions, make claims, attach supporting or challenging evidence with sources, and inspect who changed the record and when. Human browsers and external agent clients read and write the same persisted state. Visual links explain relationships, not truth.

## Non-negotiable invariants

1. Preserve the starter's `/` and `/readme/` contracts. `/readme/` serves the complete current `README.md` in server-sent HTML, not only by client-side rendering. Do not remove or weaken supplied checks.
2. A stranger can complete the core interaction without the developer's machine: create/open a question, contribute a claim or evidence item, and later retrieve the same trace from the deployed app.
3. Two distinct people in separate browsers can act on shared state; two bots alone do not satisfy the course's multi-user requirement. Attribute each action to the server-identified actor, not an actor name supplied in JSON.
4. Once real-time is implemented, a committed change reaches other open browser sessions within about one second without reload. Reconnection reconciles from durable state, not transient broadcasts alone.
5. Authoritative records persist under `/data` on Fly and survive process restart and redeploy. Browser storage and the image filesystem are not authoritative. Preserve the one-machine/one-volume, 256 MB `fly.toml` configuration.
6. Evidence is immutable in the first version: corrections append a new event or superseding note. Never silently overwrite a claim or source. Mutable fields require an expected version and return a conflict rather than last-write-wins.
7. Never label model output verified merely because it was submitted. If review exists, record the human reviewer and basis. Keep challenges visible after review.
8. Submitted text and URLs are untrusted data. Escape content, validate lengths and URL schemes, authenticate write APIs, rate-limit public entry points, and never execute submitted instructions. Do not store credentials, private prompts, source files, or course API keys in the shared room.
9. Never commit or log tokens. Keep local Claude settings under ignored `.claude/`; Fly credentials under ignored `mise.local.toml` or course-provided secrets. The development token is not a Proofroom runtime token.
10. Do not push, deploy, flip repository visibility, delete material files, or claim a browser/user test happened without authorisation and evidence. Local preparation is not shipping.

## Product and visual rules

- The visual centre is a legible relationship map of questions, claims and evidence. Every edge means `supports` or `challenges`; no random graph decoration or perpetual particles.
- Keep a readable list/detail view of the same records. The graph is never the only navigation or editing path.
- Show actor, source, timestamp and review state adjacent to consequential statements; not only on hover.
- Preserve clear labels, keyboard focus, mobile layout, contrast and reduced-motion support. Colour alone cannot communicate epistemic status.
- Animate a committed event briefly to explain what changed. Frequent and keyboard-driven controls respond immediately. See `docs/ART_DIRECTION.md`.

## Workflow and evidence

- Work in small, reviewable commits: harness/decision, durable core, external API, live sync, visual correction. Run relevant checks and record actual results before claiming each stage.
- Add `spec/` tests for machine-checkable promises: persistence, attribution, immutable evidence, conflicts, API and later two-session real-time behaviour. Verify human-judged visual/usability claims in a real browser at both marking viewports.
- Preserve `pnpm check` and `pnpm check:evidence`. The latter will fail while `PROCESS.md` remains its template; report that honestly. Never fabricate commit links or process narrative.
- Record a stack decision in `docs/decisions/` before committing to it. A working HTTP API comes first; an MCP adapter is optional later, not a substitute for the web UI or API.
- At every handoff distinguish implemented, locally tested, committed, pushed, deployed and live-verified. Unknown stays unknown.
