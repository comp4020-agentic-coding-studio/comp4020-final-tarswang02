# Proofroom — art direction and interaction

This is a design target, not an implementation-complete claim. The visual language should communicate the state of evidence with the gravity of a research instrument and the atmosphere of a quiet observatory. Do not reuse the prior dry-garden or pixel-boxing look.

## Visual concept

Imagine a dark archival table at night. A small number of precise luminous threads connect statements to supporting and challenging records. Claims are primary nodes; evidence is smaller and nearer its claim. Each link has a text label as well as line treatment. The graph comes from real relationships only. Density should reveal work, not obscure it.

Provisional palette: near-black blue `#0B1118` background, blue-charcoal `#17232E` surfaces, warm parchment `#E9E4D8` type, muted cyan `#7CBAC4` for support, restrained ember `#D89978` for challenge, cool slate `#A6B1BA` for unreviewed. Tune in the browser; never encode status with colour alone. Avoid glossy glassmorphism, neon gradients everywhere, faux terminal text and stock AI imagery.

Typography: a quiet editorial serif for major question titles, legible sans for actions/evidence, modest mono for timestamps, event IDs and source details. Use actual labels and sufficient contrast. Do not shrink long evidence text to preserve the composition.

## Information architecture

Desktop: compact room header and actor/connection indicator; central relationship map; selected-record detail panel with text, source, author, time and review state; concise chronological activity rail. “Add claim” and “Add evidence” must be easy to find.

Mobile: list-first. Selecting a record opens relationships and detail; the map is an optional overview, never the only navigation. No horizontal page overflow. The empty state shows a meaningful example and direct first action, not decorative filler.

## Motion rules

- New committed evidence may briefly illuminate its real link, then settle. A remote change must not move the reader's selected detail or steal keyboard focus.
- Frequent actions and keyboard operations respond immediately. Use short, interruptible opacity/transform transitions only to explain arrival or relationship. No perpetual particles, breathing nodes or orbiting logos.
- Respect `prefers-reduced-motion`: remove spatial movement while keeping clear text/state change. Animation is never the sole cue for support, challenge, conflict, saved/unsaved or connection state.
- Loading, empty, offline, conflict and validation states deserve the same attention as the populated ideal. Announce consequential updates accessibly without flooding screen readers.

## Visual QA before claiming polish

Inspect the running app at both course marking viewports and resize mid-use. In a real browser try keyboard traversal, long text, a source URL, a contested claim, two agents writing in succession, a remote update while a detail panel is open, no data and reduced motion. Record actual shortcomings. A static mockup or automated screenshot alone is not visual verification.
