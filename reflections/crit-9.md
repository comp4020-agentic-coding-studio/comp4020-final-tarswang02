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
steal focus. After deployment, two isolated Chrome sessions showed remote
updates in 160–434 ms and kept syncing after a real 409. A controlled network
cut recovered missing content without reload or draft loss. Injecting a 503,
however, exposed a reconnect message with no actual retry. The correction
recreates a closed stream with bounded backoff; the patched browser then
connected on its second attempt. A source audit also removed session IDs
from public events and historical replay. These corrections came from
checking failure states, rather than trusting a successful connection.
Two physical devices on different networks and the pod session remain
unverified; the measured results are from one computer with separate sessions.
