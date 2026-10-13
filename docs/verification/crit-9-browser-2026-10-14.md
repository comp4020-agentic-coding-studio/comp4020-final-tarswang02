# Crit 9 browser verification — 14 October 2026

Performed by Codex at 08:38–08:42 AEDT (Australia/Sydney), against
`https://comp4020-final-tarswang02.fly.dev/`, initially deployed commit
`9abea63`. These are automated interactions in real Google Chrome using
Playwright, with two fresh, isolated browser contexts on one computer.
Desktop viewport: 1365 × 768. Mobile viewport: 390 × 844, mobile/touch
emulation. This does not establish physical-phone, cross-network or two-person
classroom behaviour.

The test question is deliberately labelled QA; no existing question was
edited or removed:
<https://comp4020-final-tarswang02.fly.dev/questions/7e6995f8-6eaa-4172-8837-3787117e3f71>.

## Observed results

| Behaviour | Actual result |
|---|---|
| Separate identities | Distinct server-issued session cookies; contributions show QA Desktop and QA Mobile. No cookie values recorded here. |
| New question appears in other open browser | 124 ms in the observed run, no reload. |
| Claim/evidence arrives in other browser | Five observed interactions: 434, 338, 180, 160, 184 ms. Timing starts before submitting and ends when the other DOM displays the text; it includes browser interaction overhead, not only server delivery. |
| Parallel additions | Both concurrent claim submissions remained visible in both browsers. |
| Draft and focus | A mobile draft and its active textarea survived a remote claim addition, with no navigation. |
| Supporting/challenging evidence | Both relation labels, sources and authors displayed; updates worked in both directions. |
| Actual review conflict | First review accepted; stale second form returned HTTP 409, retained its reason and displayed the conflict. |
| Updates after 409 | New remote evidence appeared while the page remained on the POST response route; the review draft stayed intact. |
| Network loss | A controlled HTTP CONNECT proxy destroyed the mobile context's TCP connections. The page displayed reconnecting after 17 ms. A claim committed while disconnected was absent until recovery. |
| Network recovery | After restoring the proxy, the missing claim appeared after 3312 ms, without page reload, draft loss or focus change. |
| Desktop/mobile layout | `scrollWidth` equals viewport width (1365 / 390); screenshots inspected. Long source links and metadata wrap within their cards. |
| Reduced motion | Chrome's reduced-motion media query matched; the sampled claim had 0 s animation and transition durations. |
| Return visit | Reload retrieved the contribution committed during disconnect. |
| Client errors | No page JavaScript errors during the successful checks. |

## Failure found and correction tested

A browser intercept returned one HTTP 503 with `Retry-After: 2` for
`/events/stream`, then permitted all later requests. The deployed client made
only one attempt and still said “Reconnecting live updates…” after ten
seconds. This is a controlled injected failure, not an observed Fly outage.

Commit `7d1f7d4` recreates the stream when EventSource reports CLOSED, with
2-second initial delay and bounded exponential backoff. Normal transport
reconnection remains browser-managed. Reconnection re-reads the durable
snapshot; leaving the page cancels pending retries.

Using the patched local script in the real browser against the same deployed
server, the identical one-off 503 test made two attempts and reached
“Live updates on”. The regression test also checks draft retention, updated
replay cursor, backoff reset and cancellation. `pnpm check`: 7 files / 17
tests passed; `pnpm check:evidence` passed. This patched-script check preceded
release; deployment confirmation is tracked separately in the course progress.

## Remaining boundaries

No physical second device, campus shared-IP stress test, iOS Safari or pod
session was used. The public 20-write/minute shared-IP limit, 429 draft
recovery, evidence arriving during review and mutable display names remain
separate concerns. Browser “offline” emulation alone did not promptly sever
the existing SSE socket, so the successful disconnect check used the proxy
instead. Neither measured normal delivery nor reconnect timing is a guarantee
for every network or participant.
