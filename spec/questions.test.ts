import { expect, inject, it } from "vitest";

// End-to-end against the RUNNING app (see spec/global-setup.ts): create a
// question, add a claim, add supporting evidence, then re-read the question
// page and confirm the full trace — including server-assigned attribution —
// is there. This is Gate 1's "create and re-read an item" check.
const baseUrl = inject("baseUrl");

function form(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}

async function post(
  path: string,
  fields: Record<string, string>,
  cookie: string,
): Promise<Response> {
  return fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: form(fields),
    redirect: "manual",
  });
}

function extractCookie(res: Response): string {
  const cookies = res.headers.getSetCookie?.() ?? [];
  const session = cookies.find((c) => c.startsWith("proofroom_session="));
  expect(session, "expected the server to set a session cookie").toBeDefined();
  return session!.split(";")[0]!;
}

it("creates a question, a claim and evidence, then re-reads the full trace", async () => {
  const title = `Does replay preserve the preset? ${Date.now()}`;
  const questionBody = "Observed on a Pixel 7, replay after backgrounding the app.";

  // 1. Create the question as a fresh visitor.
  const createRes = await post("/questions", { title, body: questionBody }, "");
  expect(createRes.status).toBe(303);
  const cookie = extractCookie(createRes);
  const questionPath = createRes.headers.get("location");
  expect(questionPath, "expected a redirect to the new question").toBeTruthy();

  // 2. Add a claim, as the same actor (same session cookie).
  const claimBody = "Fixed in build 42: the preset id now survives backgrounding.";
  const claimRes = await post(`${questionPath}/claims`, { body: claimBody }, cookie);
  expect(claimRes.status).toBe(303);

  // 3. Read the question page to find the claim's evidence form target.
  const afterClaim = await fetch(new URL(questionPath!, baseUrl), {
    headers: { Cookie: cookie },
  });
  const afterClaimHtml = await afterClaim.text();
  const claimMatch = afterClaimHtml.match(/\/claims\/([^/"]+)\/evidence/);
  expect(claimMatch, "expected an add-evidence form referencing the new claim").not.toBeNull();
  const claimId = claimMatch![1]!;

  // 4. Add supporting evidence with a source URL.
  const evidenceBody = "Ran the replay test 10 times on CI; all passed.";
  const sourceUrl = "https://example.com/ci/run/42";
  const evidenceRes = await post(
    `/claims/${claimId}/evidence`,
    { body: evidenceBody, relation: "supports", source_url: sourceUrl },
    cookie,
  );
  expect(evidenceRes.status).toBe(303);

  // 5. Re-read: everything just written must be present, attributed to a
  // server-assigned actor name (never one we supplied).
  const finalRes = await fetch(new URL(questionPath!, baseUrl), {
    headers: { Cookie: cookie },
  });
  expect(finalRes.status).toBe(200);
  const html = await finalRes.text();

  expect(html).toContain(title);
  expect(html).toContain(questionBody);
  expect(html).toContain(claimBody);
  expect(html).toContain(evidenceBody);
  expect(html).toContain(sourceUrl);
  expect(html).toMatch(/Visitor-\d{4}/);
});

it("rejects a non-http(s) source URL instead of silently storing it", async () => {
  const title = `Rejects bad source URLs ${Date.now()}`;
  const createRes = await post("/questions", { title, body: "" }, "");
  const cookie = extractCookie(createRes);
  const questionPath = createRes.headers.get("location")!;

  const claimRes = await post(`${questionPath}/claims`, { body: "a claim" }, cookie);
  const afterClaim = await fetch(new URL(questionPath, baseUrl), { headers: { Cookie: cookie } });
  const claimId = (await afterClaim.text()).match(/\/claims\/([^/"]+)\/evidence/)![1]!;
  void claimRes;

  const evidenceRes = await post(
    `/claims/${claimId}/evidence`,
    { body: "evidence", relation: "supports", source_url: "javascript:alert(1)" },
    cookie,
  );
  expect(evidenceRes.status).toBe(400);
});

it("answers 404 for an unknown question instead of an empty 200", async () => {
  const res = await fetch(new URL("/questions/does-not-exist", baseUrl));
  expect(res.status).toBe(404);
});
