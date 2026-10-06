# Proofroom — product requirements (planning version)

## Status and audience

The student chose the **Proofroom / 证据室** direction. This is a working specification, not a claim that the product is implemented or submitted. Detailed labels, layout and stack below are proposals to test with the student and users. The course brief and the student's authored `README.md` remain the authority on what "good" means.

The first audience is a small group using different coding agents to review one piece of software work. For example, one agent says a bug is fixed; another finds a counterexample; a person decides what has actually been verified. Proofroom should reduce the cost of trusting a handoff, not replace Git, tests, code review or human judgement.

## Core loop

1. A person enters with a distinguishable identity (a low-friction pseudonym is acceptable for the course showcase) and creates a **question** such as “Does mobile replay preserve the selected preset?”
2. A person or external agent contributes a **claim**. A claim records author and time but starts **unreviewed**; it is never automatically true.
3. Someone adds **evidence** that explicitly **supports** or **challenges** a claim. Evidence includes a short explanation and optional validated URL to a test run, commit, issue or other inspectable source. A URL is not itself proof.
4. Other open browsers see the committed record without reloading, and a returning visitor sees the durable history of what changed and who changed it.
5. A human may mark an item reviewed with a reason, or leave it unresolved. Challenging evidence remains visible after review.

## Data and trust boundaries

Proposed minimal entities: `actor`, `question`, `claim`, `evidence`, append-only `event`. A claim belongs to a question. Evidence belongs to a claim and has a `supports` or `challenges` relation. Events carry a monotonic sequence, server timestamp and authenticated actor ID. Avoid deletion in the first slice; correction can supersede an earlier item with a linked event.

Browser and agent identities are separate. Human sessions are server-issued and distinguish two people. Each external agent integration has its own scoped credential. The server derives actor identity from session/token, not user-supplied JSON. Never put the course Claude token in app configuration or an API example. Do not expose private repository contents by default. Public demo writes need bounded text, abuse controls and recovery from malicious input.

This is a **shared evidence register**, not automatic code/file merging or magic agent memory sync. External clients must deliberately call its API or later MCP adapter. No autonomous truth scoring, generic chat room, Kanban board, public arbitrary file upload, or live LLM inference is required for the first release.

## Verifiable promises

- A human can create a question and add claim/evidence in a browser; a second human browser can act on the same question with distinct attribution.
- An external client can read the current question and append evidence through documented HTTP endpoints. This is a real API, not a mock animation.
- A committed change appears in another open browser within roughly one second. After disconnect/reconnect, the browser reconciles to persisted state.
- Question, claim, evidence and provenance survive reload, process restart and redeploy. Local storage alone does not count.
- Immutable evidence cannot be silently overwritten. Mutable review state has conflict detection; stale updates receive an explicit error and latest state. Rendered submitted content is inert text.
- The README's full content appears at `/readme/` in server-sent HTML; the app works at both marking viewports and from the keyboard.

## Human-judged promises to test, not assert

- A newcomer can tell within about a minute what is claimed, what supports/challenges it, and what has actually been reviewed.
- The room is more useful with another person present: their contribution changes what others can inspect or decide, not just a presence counter.
- The visual network makes provenance easier to grasp than a flat list, while the list remains useful for details, keyboard and small screens.

## Course milestones and acceptance demos

### Crit 8: first life — cutoff 2026-10-07 12:00 AEDT

Ship the smallest deployed, persisted loop: a stranger creates/opens a question, contributes a claim or evidence item, and finds that trace on a return visit. Include an independent HTTP read/write path for an external client if time permits; do not sacrifice the stranger's web path or persistence to pursue integration. `README.md` contains the student's first argument for "good" and appears at `/readme/`. `PROCESS.md` and `reflections/crit-8.md` describe actual work and commits, not this plan. The [Crit 8 page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/08-its-alive/) explicitly allows real-time and full polish to follow later.

### Crit 9 and final

Two human browsers act on the same room and see committed changes in about one second. Exercise simultaneous additions, stale review edits, connection loss and replay. Demonstrate a genuine external agent client reading and writing through the API; then consider a thin MCP adapter for Claude Code/Codex ergonomics. Test restart and redeploy persistence on Fly, not merely in a local process. Keep source and actor visible.

The Final Project is due **2026-11-09 12:00 AEDT**, source: [official brief](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/).
