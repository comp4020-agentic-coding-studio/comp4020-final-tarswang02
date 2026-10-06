# 0002 — Live co-presence and concurrent changes

## Context

Proofroom's value is that collaborators inspect the *same* question and can challenge an unsupported claim. The final-project brief and Crit 9 require one person's committed change to appear in another open browser in about one second, without a reload. The app runs on one Fly machine with one SQLite volume. Its existing `events` table records question, claim and evidence additions, but browsers currently see new records only after navigation or reload.

## Options

1. **Fast polling:** every browser requests the latest page several times per second. It is simple, but mostly transfers unchanged HTML, grows linearly with visitors, and offers little explanation of missed changes during a disconnect.
2. **WebSockets:** bidirectional messages could carry presence and writes, but browser forms and the agent HTTP API already provide write paths. A second bidirectional protocol would duplicate validation and authority boundaries.
3. **Server-sent events (chosen):** a one-way stream tells browsers that a committed event exists. The browser fetches the current server-rendered records and merges them into the visible page. The event sequence is durable in SQLite; reconnecting clients replay from a sequence number and reconcile from a fresh snapshot.

## Decision

Use SSE for change notification, not as a second source of truth. Keep all writes through the existing authenticated browser/API routes. Broadcast only *after* the event row is committed. A client receiving a notification re-fetches the authoritative HTML and adds or updates records without replacing the visitor's active form, focus or selection. A reconnect also fetches the snapshot, so correctness does not depend on an unbroken socket or a perfectly complete transient broadcast.

Append-only questions, claims and evidence never conflict: both writers' records remain visible. For the first mutable field, claim review state, require the version the reviewer saw; a stale version returns a conflict and the latest state rather than silently overwriting another person's decision. The server derives actor identity from each browser session or agent token. No presence counter or typing indicator is added: seeing a durable new contribution is more relevant to this room than seeing an avatar online.

## Consequences and checks

- SSE is one open HTTP response per browser. Limit connections and send keep-alives; a client that disconnects must release server resources.
- The payload is a cue to re-read, not an instruction to trust client-provided text. Escaping and attribution stay in server rendering.
- Replay uses monotonically increasing event IDs. A new page includes its initial sequence; on reconnect the browser reconciles even when no event was received.
- The spec must exercise two distinct session cookies, delivery after a write, missed-event replay and stale review rejection. A real two-browser pass must confirm that remote content appears without a document reload, while a partly typed form retains its value and focus.
