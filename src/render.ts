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
      :root { color-scheme: light dark; }
      body { font-family: system-ui, sans-serif; max-width: 48rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
      header.site { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
      nav a { margin-right: 1rem; }
      form.actor-name { display: flex; gap: 0.5rem; align-items: center; }
      input, textarea, button { font: inherit; }
      textarea { width: 100%; box-sizing: border-box; }
      .claim { border-left: 3px solid #888; padding-left: 1rem; margin: 1.5rem 0; }
      .evidence { margin: 0.75rem 0 0.75rem 1rem; padding: 0.5rem 0.75rem; border-radius: 4px; }
      .evidence.supports { background: #e6f3ef; }
      .evidence.challenges { background: #fbeae3; }
      .meta { font-size: 0.85rem; color: #555; font-family: ui-monospace, monospace; }
      .error { color: #a02020; }
      .empty-state { padding: 2rem 0; }
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
  </body>
</html>
`.__html;
}
