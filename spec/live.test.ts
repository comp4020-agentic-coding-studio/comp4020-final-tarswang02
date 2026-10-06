import { expect, inject, it } from "vitest";

const baseUrl = inject("baseUrl");
const testSource = `198.51.100.${Math.floor(Math.random() * 100) + 1}`;

async function freshSession(name: string): Promise<string> {
  const visit = await fetch(new URL("/questions", baseUrl));
  const cookie = visit.headers.getSetCookie().find((value) => value.startsWith("proofroom_session="))?.split(";")[0];
  expect(cookie).toBeDefined();
  const rename = await fetch(new URL("/actor/name", baseUrl), {
    method: "POST",
    headers: { Cookie: cookie!, "Content-Type": "application/x-www-form-urlencoded", "X-Forwarded-For": testSource },
    body: new URLSearchParams({ name }),
    redirect: "manual",
  });
  expect(rename.status).toBe(303);
  return cookie!;
}

function eventReader(reader: ReadableStreamDefaultReader<Uint8Array>): () => Promise<{ seq: number; type: string; payload: Record<string, string> }> {
  const decoder = new TextDecoder();
  let buffer = "";
  return async () => {
    while (true) {
      while (buffer.includes("\n\n")) {
        const end = buffer.indexOf("\n\n");
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const data = frame.split("\n").find((line) => line.startsWith("data: "))?.slice(6);
        if (data) return JSON.parse(data);
      }
      const { value, done } = await reader.read();
      if (done) throw new Error("event stream ended before an event arrived");
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    }
  };
}

it("delivers another browser's committed question within a second and retains both actors", async () => {
  const alice = await freshSession(`Alice-${Date.now()}`);
  const bob = await freshSession(`Bob-${Date.now()}`);
  expect(alice).not.toBe(bob);

  const initial = await fetch(new URL("/questions", baseUrl), { headers: { Cookie: bob } });
  const since = (await initial.text()).match(/data-live-scope="questions" data-since="(\d+)"/)?.[1];
  expect(since).toBeDefined();

  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 3_000);
  try {
    const stream = await fetch(new URL(`/events/stream?since=${since}`, baseUrl), {
      headers: { Cookie: bob },
      signal: stop.signal,
    });
    expect(stream.status).toBe(200);
    expect(stream.headers.get("content-type")).toContain("text/event-stream");
    const reader = stream.body!.getReader();

    const start = Date.now();
    const create = await fetch(new URL("/questions", baseUrl), {
      method: "POST",
      headers: { Cookie: alice, "Content-Type": "application/x-www-form-urlencoded", "X-Forwarded-For": testSource },
      body: new URLSearchParams({ title: `Can both people see this? ${start}` }),
      redirect: "manual",
    });
    expect(create.status).toBe(303);
    const nextEvent = eventReader(reader);
    const expectedId = create.headers.get("location")?.split("/").pop();
    let event;
    do { event = await nextEvent(); } while (event.payload.id !== expectedId);
    expect(Date.now() - start).toBeLessThan(1_200);
    expect(event.type).toBe("question_created");
    expect(event.payload.id).toBe(expectedId);

    const detail = await fetch(new URL(create.headers.get("location")!, baseUrl), { headers: { Cookie: bob } });
    const html = await detail.text();
    expect(html).toContain("Alice-");
    const claim = await fetch(new URL(`${create.headers.get("location")}/claims`, baseUrl), {
      method: "POST",
      headers: { Cookie: bob, "Content-Type": "application/x-www-form-urlencoded", "X-Forwarded-For": testSource },
      body: new URLSearchParams({ body: "Bob finds a counterexample." }),
      redirect: "manual",
    });
    expect(claim.status).toBe(303);
    const after = await (await fetch(new URL(create.headers.get("location")!, baseUrl), { headers: { Cookie: alice } })).text();
    expect(after).toContain("Alice-");
    expect(after).toContain("Bob-");
    expect(after).toContain("Bob finds a counterexample.");
  } finally {
    clearTimeout(timer);
    stop.abort();
  }
});

it("replays missed durable events after a client reconnects", async () => {
  const visitor = await freshSession(`Replay-${Date.now()}`);
  const initial = await (await fetch(new URL("/questions", baseUrl), { headers: { Cookie: visitor } })).text();
  const since = initial.match(/data-live-scope="questions" data-since="(\d+)"/)?.[1];
  expect(since).toBeDefined();
  const create = await fetch(new URL("/questions", baseUrl), {
    method: "POST",
    headers: { Cookie: visitor, "Content-Type": "application/x-www-form-urlencoded", "X-Forwarded-For": testSource },
    body: new URLSearchParams({ title: `A missed event ${Date.now()}` }),
    redirect: "manual",
  });
  expect(create.status).toBe(303);

  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 3_000);
  try {
    const stream = await fetch(new URL(`/events/stream?since=${since}`, baseUrl), {
      headers: { Cookie: visitor },
      signal: stop.signal,
    });
    expect(stream.status).toBe(200);
    const nextEvent = eventReader(stream.body!.getReader());
    const expectedId = create.headers.get("location")?.split("/").pop();
    let event;
    do { event = await nextEvent(); } while (event.payload.id !== expectedId);
    expect(event.type).toBe("question_created");
    expect(event.payload.id).toBe(expectedId);
  } finally {
    clearTimeout(timer);
    stop.abort();
  }
});
