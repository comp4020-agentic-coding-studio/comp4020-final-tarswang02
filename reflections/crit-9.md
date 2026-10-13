# Crit 9 reflection — Proofroom

The key shift after Crit 8 was recognising that “shared data” and
“working together at once” are different promises. An API two agents can call,
or a page showing another person's work after refresh, does not let a pod
respond to a new challenge while everyone has the room open.

The implementation uses server-sent events to announce committed changes,
then re-reads server-rendered records. SQLite, not a transient connection,
remains authoritative. The more important choice is what happens when two
people contribute at once: new questions, claims and evidence both remain;
competing reviews do not silently overwrite each other. A stale review gets a
409 response showing the intervening decision and preserving the second
person's reason for retry. That extra step fits Proofroom better than
last-write-wins, which could hide the disagreement.

Local two-browser use showed new questions and claims arriving without reload
while a draft and keyboard focus remained intact. Automated checks exercised
event replay and stale review rejection. A later correction kept an existing
question link mounted during live list updates so remote activity would not
steal focus. The real-time version was later deployed, and two independent
HTTP sessions passed an online event/replay check. A separate local restart
check showed an open browser recovering a durable record without reload or
draft loss. A later source audit found that rename notifications exposed a
session identifier, so public event paths now strip it even when replaying
older events; a regression test covers live and replay routes. Online
two-device timing and reconnection, and a real pod session, remain unverified.
Those are the next checks, not claims inferred from local speed.
