#!/usr/bin/env node
// Gate 2 demo: a real external client — a separate process, over HTTP, with
// its own scoped credential — doing read -> write -> read against a running
// Proofroom server and printing back the identity the SERVER attributed the
// writes to (never an identity this script asserts itself).
//
// Setup: the server must be started with an AGENT_TOKENS entry for the token
// this script uses, e.g.
//   AGENT_TOKENS=demo-token-change-me:demo-agent node src/server.ts
//   AGENT_TOKEN=demo-token-change-me node scripts/demo-agent-client.ts
// This token is a local demo credential, not the course Claude token and not
// a value to reuse anywhere real.

const baseUrl = process.env.APP_URL ?? "http://localhost:8080";
const token = process.env.AGENT_TOKEN;

if (!token) {
  console.error(
    "AGENT_TOKEN is not set. Start the server with a matching AGENT_TOKENS entry, " +
      "then set AGENT_TOKEN to that same token before running this script.",
  );
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

async function api(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(new URL(path, baseUrl), {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function main(): Promise<void> {
  console.log(`-> GET  /api/v1/questions`);
  const before = (await api("/api/v1/questions")) as { questions: Array<{ id: string }> };
  console.log(`   ${before.questions.length} existing question(s)`);

  const title = `[agent demo] does the API attribute writes correctly? ${Date.now()}`;
  console.log(`-> POST /api/v1/questions`);
  const question = (await api("/api/v1/questions", {
    method: "POST",
    body: JSON.stringify({ title, body: "Created by the Gate 2 demo client." }),
  })) as { id: string; actor_name: string };
  console.log(`   created ${question.id}, attributed to "${question.actor_name}"`);

  console.log(`-> POST /api/v1/questions/${question.id}/claims`);
  const claim = (await api(`/api/v1/questions/${question.id}/claims`, {
    method: "POST",
    body: JSON.stringify({ body: "The read -> write -> read round trip works end to end." }),
  })) as { id: string; actor_name: string };
  console.log(`   created claim ${claim.id}, attributed to "${claim.actor_name}"`);

  console.log(`-> GET  /api/v1/questions/${question.id}`);
  const detail = (await api(`/api/v1/questions/${question.id}`)) as {
    title: string;
    claims: Array<{ id: string; body: string; actor_name: string }>;
  };
  const found = detail.claims.find((c) => c.id === claim.id);
  if (!found) throw new Error("re-read did not show the claim just written");
  console.log(`   re-read confirms: "${detail.title}" has a claim by "${found.actor_name}"`);

  console.log("\nGate 2 read -> write -> read demo succeeded.");
}

main().catch((err: unknown) => {
  console.error("Gate 2 demo failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
