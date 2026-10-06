# Crit 9 reflection — Proofroom (pre-deployment draft)

This reflection is grounded in the repository and local checks as of 7 October
2026; it is not a claim that the Crit 9 version has been deployed or tried by
the pod. The key shift after Crit 8 was recognising that “shared data” and
“working together at once” are different promises. An API that two agents can
call, or a page that shows another person's work after refresh, does not let a
pod notice and respond to a new challenge while everyone has the room open.

The implementation uses server-sent events to announce committed changes,
then re-reads server-rendered records. This keeps browser and agent writes on
the existing validated paths and makes SQLite, not a transient connection,
the authority. The more important design choice is what happens when two
people contribute at once: new questions, claims and evidence both remain;
competing reviews do not silently overwrite each other. A stale review gets a
409 response showing the intervening decision and preserving the second
person's reason for an informed retry. The trade-off is an extra step at the
moment of disagreement. That cost fits Proofroom better than the apparent
smoothness of last-write-wins, which could hide the disagreement.

Local two-browser use showed new questions and claims arriving without reload
while a draft and keyboard focus remained intact. Automated checks exercised
event replay and stale review rejection. A later correction kept an existing
question link mounted during live list updates so remote activity would not
steal focus. These checks make the next test precise, not unnecessary: the
current public Fly site still serves the Crit 8 version. A separate local
restart check showed an open browser recovering a durable record without
reload or draft loss. Before claiming this crit is delivered, the new commits
need deployment, online two-device timing and reconnection, and a real pod
session. Those online outcomes are unknown at this draft
stage and should be added only after they happen.
