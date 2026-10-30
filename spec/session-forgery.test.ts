import { expect, inject, it } from "vitest";

// Regression test for a cookie-forgery bug in resolveActor (src/actors.ts):
// agent actors are stored with ids shaped `agent:<label>` (ensureAgentActor,
// src/apiAuth.ts), and the browser session path looked up whatever cookie
// value it was given with no check on its shape. A request carrying
// `Cookie: proofroom_session=agent:<label>` was attributed to that agent.
//
// Matches the demo agent credential documented in docs/api.md's "Trying it
// against a local server" section. Start the app under test with
//   AGENT_TOKENS=demo-token-change-me:demo-agent
// (or override AGENT_TOKEN/AGENT_LABEL below to match a different value)
// before running `pnpm check`.
const baseUrl = inject("baseUrl");
const AGENT_TOKEN = process.env.AGENT_TOKEN ?? "demo-token-change-me";
const AGENT_LABEL = process.env.AGENT_LABEL ?? "demo-agent";
const testSource = `192.0.2.${Math.floor(Math.random() * 100) + 1}`;

it("never attributes a forged agent-shaped cookie to the agent, while a real bearer call still is", async () => {
  // 1. A real bearer call still resolves to, and creates if needed, the
  //    agent's own actor row (`agent:<label>`) — the path this fix must not
  //    touch.
  const bearerRes = await fetch(new URL("/api/v1/questions", baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AGENT_TOKEN}`,
    },
    body: JSON.stringify({ title: `Bearer attribution check ${Date.now()}` }),
  });
  expect(bearerRes.status).toBe(201);
  const bearerBody = (await bearerRes.json()) as { actor_name: string };
  expect(bearerBody.actor_name).toBe(AGENT_LABEL);

  // 2. A browser-path request presenting that agent's actor id as its own
  // session cookie must be treated as an unrecognised cookie: a fresh
  // visitor actor, and a freshly issued session cookie.
  const forgedCookie = `proofroom_session=${encodeURIComponent(`agent:${AGENT_LABEL}`)}`;
  const createRes = await fetch(new URL("/questions", baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: forgedCookie,
      "X-Forwarded-For": testSource,
    },
    body: new URLSearchParams({ title: `Forged cookie check ${Date.now()}` }),
    redirect: "manual",
  });
  expect(createRes.status).toBe(303);

  const freshCookie = createRes.headers
    .getSetCookie()
    .find((value) => value.startsWith("proofroom_session="));
  expect(freshCookie, "a forged/unrecognised cookie must get a fresh session").toBeDefined();

  const questionPath = createRes.headers.get("location")!;
  const detail = await fetch(new URL(questionPath, baseUrl));
  const html = await detail.text();
  expect(html).not.toContain(`asked by ${AGENT_LABEL}`);
  expect(html).toMatch(/Visitor-\d{4}/);
});
