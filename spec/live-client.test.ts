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

it("recovers a terminal stream error with backoff, retains a draft, and cancels retries on leaving", async () => {
  const dom = new JSDOM(
    '<div class="live-status"></div><textarea id="draft">unfinished reason</textarea><div id="live-records" data-live-scope="questions" data-since="7"></div>',
    { url: "https://example.test/questions", runScripts: "outside-only" },
  );
  const sources: FakeEventSource[] = [];
  class FakeEventSource {
    static CLOSED = 2;
    readyState = 0;
    listeners = new Map<string, () => void>();
    constructor(public url: string) { sources.push(this); }
    addEventListener(type: string, listener: () => void) { this.listeners.set(type, listener); }
    close() { this.readyState = 2; }
  }
  const pending = new Map<number, () => void>();
  const delays: number[] = [];
  dom.window.setTimeout = ((callback: () => void, delay: number) => {
    delays.push(delay);
    pending.set(delays.length, callback);
    return delays.length;
  }) as typeof dom.window.setTimeout;
  dom.window.clearTimeout = (id: number) => { pending.delete(id); };
  dom.window.fetch = async () => new Response(
    '<div id="live-records" data-live-scope="questions" data-since="11"></div>',
  );
  dom.window.EventSource = FakeEventSource as unknown as typeof dom.window.EventSource;
  dom.window.eval(script);

  // Normal CONNECTING errors are already retried by the browser.
  sources[0]!.listeners.get("error")!();
  expect(pending.size).toBe(0);
  sources[0]!.readyState = FakeEventSource.CLOSED;
  sources[0]!.listeners.get("error")!();
  sources[0]!.listeners.get("error")!();
  expect(pending.size).toBe(1);
  expect(delays).toEqual([2000]);
  pending.get(1)!();
  pending.delete(1);
  expect(sources).toHaveLength(2);
  expect(sources[1]!.url).toBe("/events/stream?since=7");
  sources[1]!.listeners.get("open")!();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(dom.window.document.querySelector(".live-status")!.textContent).toBe("Live updates on");
  expect((dom.window.document.querySelector("#draft") as HTMLTextAreaElement).value).toBe("unfinished reason");

  sources[1]!.readyState = FakeEventSource.CLOSED;
  sources[1]!.listeners.get("error")!();
  expect(delays[1]).toBe(2000); // Successful open resets the backoff.
  pending.get(2)!();
  pending.delete(2);
  expect(sources[2]!.url).toBe("/events/stream?since=11");
  sources[2]!.readyState = FakeEventSource.CLOSED;
  sources[2]!.listeners.get("error")!();
  expect(delays[2]).toBe(4000);
  dom.window.dispatchEvent(new dom.window.Event("pagehide"));
  expect(pending.size).toBe(0);
  dom.window.close();
});
