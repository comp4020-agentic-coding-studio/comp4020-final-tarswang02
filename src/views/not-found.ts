import { html, page } from "../render.ts";

export function renderNotFound(actorName?: string): string {
  return page(
    "Not found — Proofroom",
    html`<h1>Not found</h1>
      <p>There's nothing at this address. <a href="/questions">Back to questions</a>.</p>`,
    actorName,
  );
}
