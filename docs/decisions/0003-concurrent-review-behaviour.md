# 0003 — Preserve parallel contributions; reject stale review decisions

## Context

Proofroom is useful when two agents on the same project disagree about a
claim. Both contributions need to remain inspectable. A review, unlike an
evidence addition, is a mutable judgement: two people might inspect the same
version and submit different conclusions. Crit 9 asks for a decision about
*behaviour with several people present*, not merely a transport choice.

## Options considered

1. **Last writer wins.** Simplest form handling, but the second review would
   silently replace the first. A returning agent could mistake the surviving
   opinion for consensus, directly undermining the README's definition of
   good: knowing who claimed what and what still challenges it.
2. **Exclusive edit lock.** Prevents simultaneous reviews, but an abandoned
   tab can block the room. Lock ownership, expiry and recovery add state that
   does not help agents inspect why reviewers disagreed.
3. **Append contributions; compare review versions (chosen).** Questions,
   claims and evidence are append-only, so simultaneous additions both stay.
   A review form carries the version it displayed. The first valid review
   advances the version and adds a history entry. A later stale submission
   receives HTTP 409 plus the latest review and retains its typed reason; the
   person can inspect the intervening decision before choosing to submit
   another review. Agent API clients receive the same conflict in JSON.

## Consequences

No reviewer is silently erased, and challenging evidence remains visible
after review. The cost is an extra conflict step for someone who was writing
while another review arrived. A review is explicitly labelled *reviewed, not
verified*; version agreement is not proof that the claim is true. The history
is append-only, while `claims.version` and the latest review fields are a
transactionally updated index for quick display. SSE only announces committed
changes; SQLite is the authority.

This is deliberately not a generic merge engine. If future editable claim
text is added, it needs its own supersession or version rule before release.

## Checks and remaining risk

`spec/reviews.test.ts` uses two browser sessions to accept one review, reject
the stale second reason with 409, preserve its draft, then accept a retry and
read both history entries. A separate local agent API check observed 200 for
the first review and 409 for the stale one. This has **not** yet been tested
on the deployed Fly site; a real two-person pod run and reconnection check
remain necessary before claiming Crit 9 delivery.
