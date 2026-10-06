// A tiny tagged-template helper: every interpolated value is HTML-escaped by
// default, so a claim/evidence body containing "<script>" renders as inert
// text. Use `raw()` only for markup this module itself built from already-
// escaped pieces (e.g. joining an array of `html` results) — never for
// user-supplied strings directly.
export type SafeHtml = { __html: string };

export function raw(value: string): SafeHtml {
  return { __html: value };
}

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function part(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(part).join("");
  if (typeof value === "object" && "__html" in (value as SafeHtml)) {
    return (value as SafeHtml).__html;
  }
  return escape(String(value));
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml {
  let out = strings[0] ?? "";
  for (let i = 0; i < values.length; i++) {
    out += part(values[i]);
    out += strings[i + 1] ?? "";
  }
  return raw(out);
}

export function page(title: string, body: SafeHtml, actorName?: string): string {
  return html`<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      /* Keep the evidence-room palette consistent regardless of the visitor's
         OS theme. The previous light default hid the intended art direction. */
      :root {
        color-scheme: dark;
        --bg: #0b1118;
        --surface: #17232e;
        --border: #2a3744;
        --text: #e9e4d8;
        --meta: #a6b1ba;
        --support: #7cbac4;
        --support-bg: rgba(124, 186, 196, 0.14);
        --challenge: #d89978;
        --challenge-bg: rgba(216, 153, 120, 0.14);
        --unreviewed: #a6b1ba;
        --error: #ff8a73;
      }
      body {
        font-family: system-ui, sans-serif;
        max-width: 64rem;
        margin: 1.5rem auto 4rem;
        padding: 0 1rem;
        line-height: 1.5;
        background: var(--bg);
        color: var(--text);
      }
      h1 {
        font-family: Georgia, "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif;
        font-weight: 600;
        font-size: 2rem;
        line-height: 1.2;
        margin: 0.2rem 0 0.6rem;
        max-width: 38rem;
      }
      h2 {
        font-family: Georgia, "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif;
        font-weight: 600;
        font-size: 1.15rem;
        color: var(--meta);
        margin: 2rem 0 0.75rem;
      }
      /* Trimmed top bar: a thin rule, no card chrome, so it stays out of the
         way of the question title below it (docs/ART_DIRECTION.md: "compact
         room header"). */
      header.site {
        display: flex; justify-content: space-between; align-items: center;
        gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem;
        padding: 0.6rem 0; border-bottom: 1px solid var(--border);
        font-size: 0.9rem;
      }
      nav a { margin-right: 1.25rem; color: var(--support); text-decoration: none; }
      nav a:hover { text-decoration: underline; }
      form.actor-name {
        display: flex; gap: 0.4rem; align-items: center;
        color: var(--meta); font-size: 0.85rem;
      }
      form.actor-name input { padding: 0.25rem 0.4rem; font-size: 0.85rem; width: 9rem; }
      form.actor-name button { padding: 0.25rem 0.6rem; font-size: 0.85rem; }
      input, textarea, button { font: inherit; }
      input, textarea {
        background: var(--bg); color: var(--text);
        border: 1px solid var(--border); border-radius: 4px; padding: 0.4rem;
      }
      textarea { width: 100%; box-sizing: border-box; }
      button {
        background: var(--surface); color: var(--text);
        border: 1px solid var(--border); border-radius: 4px;
        padding: 0.5rem 1rem; cursor: pointer;
      }
      /* Hover/press feedback below is scoped to :hover/:active only — never
         to :focus-visible, so tabbing through the page never animates, per
         the motion rules ("keyboard operations respond immediately"). */
      @media (prefers-reduced-motion: no-preference) {
        button, .question-list a, .evidence a {
          transition: transform 150ms cubic-bezier(0.23, 1, 0.32, 1), opacity 150ms ease;
        }
        button:hover { transform: translateY(-1px); }
        button:active { transform: translateY(0) scale(0.97); transition-duration: 80ms; }
        .question-list li:hover a { transform: translateX(2px); opacity: 0.85; }
        .evidence a:hover { opacity: 0.75; }
      }
      a:focus-visible, button:focus-visible, input:focus-visible, textarea:focus-visible {
        outline: 2px solid var(--support);
        outline-offset: 2px;
      }

      /* Desktop: primary content column + a narrower, quieter auxiliary
         action rail (docs/ART_DIRECTION.md: "Add claim/evidence must be easy
         to find" without competing with the evidence itself for attention).
         Mobile ignores this and stacks in document order. */
      .layout { display: block; }
      .layout .layout-aside { margin-top: 2rem; }
      @media (min-width: 60rem) {
        .layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 16rem;
          gap: 0 2.5rem;
          align-items: start;
        }
        .layout.entry-first .layout-main { grid-column: 1; grid-row: 1; }
        .layout.entry-first .layout-aside { grid-column: 2; grid-row: 1; }
        .layout .layout-aside { margin-top: 0; position: sticky; top: 1rem; }
      }
      .layout-aside {
        font-size: 0.9rem; padding-top: 0.25rem; border-top: 1px solid var(--border);
      }
      @media (min-width: 60rem) {
        .layout-aside { border-top: none; padding-top: 0; }
      }
      .layout-aside h2 { margin-top: 0; font-size: 1rem; }

      .question-list, .claim {
        background: var(--surface); border: 1px solid var(--border);
        border-left: 3px solid var(--border);
        border-radius: 6px; padding: 0.75rem 1rem; margin: 1rem 0;
      }
      .question-list { list-style: none; padding: 0; }
      .question-list li {
        background: transparent; border: none; border-radius: 0;
        padding: 0.85rem 0; margin: 0;
      }
      .question-list li + li { border-top: 1px solid var(--border); }
      .question-list li a {
        display: inline-block; color: var(--text); text-decoration: none;
        font-size: 1.05rem; line-height: 1.35; font-weight: 600;
      }
      .question-list li a:hover { color: var(--support); }
      .question-list li .meta { display: block; margin-top: 0.3rem; }

      /* Evidence spine: the claim is the primary node (a filled dot plus the
         usual card), real supports/challenges evidence rows hang off it as
         side branches on a vertical line. The structure mirrors the actual
         claim→evidence relationship already in the markup — nothing here is
         a generated/decorative graph. */
      .claim.unreviewed { border-left-color: var(--unreviewed); }
      .claim.reviewed { border-left-color: var(--support); }
      .claim-head { display: flex; align-items: baseline; gap: 0.5rem; }
      .claim-head .node-dot {
        flex: none; width: 0.6rem; height: 0.6rem; border-radius: 50%;
        background: var(--unreviewed); margin-top: 0.4rem;
      }
      .claim.reviewed .node-dot { background: var(--support); }
      .claim-body { margin: 0; font-size: 1.05rem; }
      .evidence-branches {
        position: relative;
        margin: 0.75rem 0 0.75rem 0.3rem;
        padding-left: 1.5rem;
        border-left: 2px solid var(--border);
      }
      .evidence-branches:empty { display: none; }
      .evidence {
        position: relative;
        margin: 0 0 0.6rem; padding: 0.4rem 0.65rem;
        border-radius: 4px; border-left: 3px solid transparent;
        font-size: 0.95rem;
      }
      .evidence:last-child { margin-bottom: 0; }
      .evidence::before {
        content: ""; position: absolute; top: 0.9rem; left: -1.5rem;
        width: 1.1rem; height: 2px; background: var(--border);
      }
      .evidence.supports { background: var(--support-bg); color: var(--text); border-left-color: var(--support); }
      .evidence.challenges { background: var(--challenge-bg); color: var(--text); border-left-color: var(--challenge); }
      .evidence.supports::before { background: var(--support); }
      .evidence.challenges::before { background: var(--challenge); }
      .evidence.supports > strong { color: var(--support); }
      .evidence.challenges > strong { color: var(--challenge); }
      .evidence .meta { color: var(--meta); opacity: 0.85; }
      .evidence p { margin: 0.3rem 0; }

      /* Add-evidence/add-claim are actions, not evidence nodes — tuck them
         behind a native <details> disclosure so the spine above stays the
         visual subject. Native <details> needs no JS and is fully keyboard
         operable (Enter/Space on the summary), so this costs no
         accessibility. */
      details.add-evidence {
        margin-top: 0.5rem; font-size: 0.9rem;
      }
      details.add-evidence > summary {
        cursor: pointer; color: var(--meta); user-select: none;
      }
      details.add-evidence > summary:hover { color: var(--text); }
      details.add-evidence[open] > summary { margin-bottom: 0.5rem; }
      .review-notes:empty { display: none; }
      .review-note { border-left: 2px solid var(--support); padding-left: 0.65rem; font-size: 0.9rem; }
      details.add-review { margin-top: 0.6rem; font-size: 0.9rem; }
      details.add-review > summary { cursor: pointer; color: var(--meta); }
      details.add-review > summary:hover { color: var(--text); }

      .meta { font-size: 0.85rem; color: var(--meta); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      .live-status { margin: -0.3rem 0 0.8rem; }
      .meta.kicker { text-transform: uppercase; letter-spacing: 0.04em; font-size: 0.75rem; }
      .error { color: var(--error); }
      .empty-state { padding: 2rem 0; }
      /* "New committed evidence may briefly illuminate its real link, then
         settle" — opacity-only (no spatial movement), and skipped entirely
         under reduced motion. There is no live push yet (Gate 3), so this
         only fires for evidence the viewer just submitted and was
         redirected back to read. */
      .evidence.is-new { animation: illuminate 280ms cubic-bezier(0.23, 1, 0.32, 1); }
      @keyframes illuminate {
        from { opacity: 0.6; }
        to { opacity: 1; }
      }
      @media (prefers-reduced-motion: reduce) {
        .evidence.is-new { animation: none; }
      }
    </style>
  </head>
  <body>
    <header class="site">
      <nav>
        <a href="/questions">Questions</a>
        <a href="/readme/">About</a>
      </nav>
      ${
        actorName == null
          ? raw("")
          : html`<form class="actor-name" method="post" action="/actor/name">
              <label for="actor-name-input">You are</label>
              <input id="actor-name-input" name="name" value="${actorName}" maxlength="40" />
              <button type="submit">Rename</button>
            </form>`
      }
    </header>
    <main>${body}</main>
    <script src="/live.js" defer></script>
  </body>
</html>
`.__html;
}
