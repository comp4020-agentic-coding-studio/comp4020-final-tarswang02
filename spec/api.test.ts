import { expect, inject, it } from "vitest";

// Gate 2's auth-failure requirement, checked unconditionally: these must hold
// no matter how the already-running app was started, so — unlike the happy
// path (see docs/api.md's demo client, which needs a matching AGENT_TOKENS
// value on the server) — none of this depends on any token being configured.
const baseUrl = inject("baseUrl");

it("rejects an API request with no bearer token", async () => {
  const res = await fetch(new URL("/api/v1/questions", baseUrl));
  expect(res.status).toBe(401);
  const body = (await res.json()) as { error: string };
  expect(body.error).toMatch(/token/i);
});

it("rejects an API request with an unrecognised bearer token", async () => {
  const res = await fetch(new URL("/api/v1/questions", baseUrl), {
    headers: { Authorization: "Bearer not-a-real-token" },
  });
  expect(res.status).toBe(401);
});

it("never creates a question for an unauthenticated write", async () => {
  const res = await fetch(new URL("/api/v1/questions", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "should never be created", body: "" }),
  });
  expect(res.status).toBe(401);
});
