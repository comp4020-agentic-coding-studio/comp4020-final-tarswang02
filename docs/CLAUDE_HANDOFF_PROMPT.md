# Claude Code handoff prompt

Use the text below **after starting Claude Code inside this repository with the course environment**. It authorises local implementation and verification, not a push, deployment or visibility change.

---

You are implementing Proofroom, the COMP4020/8020 Final Project in this exact repository. Read `CLAUDE.md`, `docs/PRODUCT_REQUIREMENTS.md`, `docs/ART_DIRECTION.md`, `docs/IMPLEMENTATION_PLAN.md`, the starter `spec/README.md`, `fly.toml`, `Dockerfile`, and the current official Final Project and Crit 8 briefs before editing. Inspect `git status` and preserve existing work.

The agreed concept is a small shared evidence room: humans and external coding agents can read questions, append claims and supporting/challenging evidence, and see actor/source/history. Agent output is unreviewed by default. The visual map must show real relationships; a legible list/detail path is equally important. Do not build a generic chat room or Kanban board.

Start with Gate 0 and Gate 1 of `docs/IMPLEMENTATION_PLAN.md`: make a durable, deployed-ready vertical slice for Crit 8, with a stranger-operable browser path, real database on `/data`, safe rendering, starter `/` and `/readme/` contracts, and tests against the running app. Choose a small stack after explaining one alternative in an ADR. If time permits, continue to Gate 2 with a genuine external HTTP read/write client; do not claim this exists from a mock UI. Keep commits small and meaningful, and run actual checks. Do not silently proceed to extra features at the cost of durability.

The assessed `README.md`, `PROCESS.md`, reflections and research note need the student's own argument and real evidence. Do not invent their words, sources, tests, commits or personal learning. You may leave a concrete question list for the student and review their draft. Note that the starter evidence check will fail until template `PROCESS.md` is honestly replaced.

Do not print or commit secrets. The school Claude token is for your development session only, never the Proofroom runtime or user-facing API. Do not push, deploy, make the repo public, or delete material files without explicit user authorisation. At the end, report separately what is implemented, locally tested, committed, pushed, deployed and still unverified, including the exact next action required for Crit 8.
