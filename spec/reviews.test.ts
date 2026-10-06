import { expect, inject, it } from "vitest";

const baseUrl = inject("baseUrl");
const testSource = `203.0.113.${Math.floor(Math.random() * 100) + 1}`;

async function post(path: string, fields: Record<string, string>, cookie?: string): Promise<Response> {
  return fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Forwarded-For": testSource,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: new URLSearchParams(fields),
    redirect: "manual",
  });
}

async function session(): Promise<string> {
  const res = await fetch(new URL("/questions", baseUrl));
  const cookie = res.headers.getSetCookie().find((value) => value.startsWith("proofroom_session="));
  expect(cookie).toBeDefined();
  return cookie!.split(";")[0]!;
}

it("preserves a stale review draft, rejects overwrite, and records both accepted versions", async () => {
  const alice = await session();
  const bob = await session();
  expect(alice).not.toBe(bob);

  const created = await post("/questions", { title: `Concurrent review ${Date.now()}` }, alice);
  expect(created.status).toBe(303);
  const path = created.headers.get("location")!;
  expect((await post(`${path}/claims`, { body: "The result is reproducible." }, alice)).status).toBe(303);

  const initial = await (await fetch(new URL(path, baseUrl), { headers: { Cookie: bob } })).text();
  const claimId = initial.match(/action="\/claims\/([^/]+)\/review"/)?.[1];
  expect(claimId).toBeDefined();
  expect(initial).toContain('name="expected_version" value="1"');

  const firstReason = "Alice checked the commit history but not production.";
  const secondReason = "Bob checked the deployment log and found a mismatch.";
  const first = await post(`/claims/${claimId}/review`, { expected_version: "1", reason: firstReason }, alice);
  expect(first.status).toBe(303);

  const stale = await post(`/claims/${claimId}/review`, { expected_version: "1", reason: secondReason }, bob);
  expect(stale.status).toBe(409);
  const conflictPage = await stale.text();
  expect(conflictPage).toContain("Someone reviewed this claim first");
  expect(conflictPage).toContain(firstReason);
  expect(conflictPage).toContain(secondReason);
  expect(conflictPage).toContain('name="expected_version" value="2"');
  expect(conflictPage).toContain('<details class="add-review" open>');

  const retry = await post(`/claims/${claimId}/review`, { expected_version: "2", reason: secondReason }, bob);
  expect(retry.status).toBe(303);
  const latest = await (await fetch(new URL(path, baseUrl), { headers: { Cookie: alice } })).text();
  expect(latest).toContain("Review v2");
  expect(latest).toContain("Review v3");
  expect(latest).toContain(firstReason);
  expect(latest).toContain(secondReason);
  expect(latest).toContain('name="expected_version" value="3"');
});
