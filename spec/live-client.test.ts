import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { expect, it } from "vitest";

const script = readFileSync(new URL("../src/live-client.js", import.meta.url), "utf8");

it("refreshes the canonical question after a conflict response, not the POST route", async () => {
  const questionId = "question-123";
  const dom = new JSDOM(
    `<div class="live-status"></div><div id="live-records" data-live-scope="question" data-question-id="${questionId}" data-since="0"></div>`,
    { url: `https://example.test/claims/claim-456/review`, runScripts: "outside-only" },
  );
  const requested: string[] = [];
  dom.window.fetch = (async (url: string) => {
    requested.push(url);
    return { ok: true, text: async () => `<div id="live-records" data-live-scope="question" data-since="1"></div>` };
  }) as typeof dom.window.fetch;
  class FakeEventSource {
    listeners = new Map<string, () => void>();
    constructor(_url: string) { sources.push(this); }
    addEventListener(type: string, listener: () => void) { this.listeners.set(type, listener); }
    close() {}
  }
  const sources: FakeEventSource[] = [];
  dom.window.EventSource = FakeEventSource as unknown as typeof dom.window.EventSource;
  dom.window.eval(script);
  sources[0]!.listeners.get("open")!();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(requested).toEqual([`/questions/${questionId}`]);
  dom.window.close();
});
