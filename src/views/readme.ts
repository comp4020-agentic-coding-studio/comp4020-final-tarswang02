import { marked } from "marked";
import { readFileSync } from "node:fs";
import { page, raw } from "../render.ts";

// Server-rendered, not client-rendered: README.md is read and converted to
// HTML on the server for every request, so the full content is present in
// the initial response body (spec/invariants.test.ts fetches this with no
// script execution).
export function renderReadme(): string {
  const source = readFileSync("README.md", "utf8");
  const bodyHtml = marked.parse(source, { async: false });
  return page("About — Proofroom", raw(`<article>${bodyHtml}</article>`));
}
