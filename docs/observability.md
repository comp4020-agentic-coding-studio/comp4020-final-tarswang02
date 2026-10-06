# Proofroom action logs (Crit 10 preparation)

The server writes one JSON line for each recognised browser or agent action.
It includes `kind`, UTC `at`, pseudonymous `actor`, `action`, optional
`target_id`, HTTP `status`, `outcome` and `duration_ms`. It deliberately omits
request bodies, evidence text, source URLs, query strings, cookies, bearer
tokens and IP addresses. Static assets, SSE keep-alives and event polling are
excluded so a room of simultaneous users remains readable in a log tail.

Example shape (not a claim about a deployed event):

```json
{"kind":"proofroom_action","at":"2026-10-07T00:00:00.000Z","actor":"Visitor-1234","action":"claim_submitted","target_id":"question-id","status":303,"outcome":"finished","duration_ms":3}
```

For the course's live instrument view, open a terminal in this repo and run:

```sh
mise exec -- flyctl logs -a comp4020-final-tarswang02
```

At the Crit 10 demo, ask pod members to open the *deployed* site on their own
devices. Watch the log tail, identify who opened a question, who submitted a
claim/evidence/review, and whether each write succeeded or was rejected. Do
not click through the presenter UI during this exercise. A failing action
logs its status; it does not imply the record was stored. This local logging
implementation and test do not establish that Fly is receiving the lines yet.
