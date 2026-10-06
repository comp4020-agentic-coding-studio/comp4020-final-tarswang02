import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { db, recordEvent } from "./db.ts";
import { resolveActor, renameActor } from "./actors.ts";
import { Router, readBody, parseForm } from "./router.ts";
import type { Context } from "./router.ts";
import { ValidationError, requireLength, validateSourceUrl, validateRelation } from "./validate.ts";
import { allow } from "./ratelimit.ts";
import { renderQuestionList } from "./views/question-list.ts";
import type { QuestionSummary } from "./views/question-list.ts";
import { renderQuestionDetail } from "./views/question-detail.ts";
import type { QuestionDetail, ClaimRow, EvidenceRow } from "./views/question-detail.ts";
import { renderNotFound } from "./views/not-found.ts";
import { renderReadme } from "./views/readme.ts";
import { registerApiRoutes } from "./api.ts";
import { streamEvents } from "./live.ts";
import { reviewClaim } from "./reviews.ts";

const router = new Router();

function clientKey(ctx: Context): string {
  const forwarded = ctx.req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) return forwarded.split(",")[0]!.trim();
  return ctx.req.socket.remoteAddress ?? "unknown";
}

function send(res: Context["res"], status: number, html: string): void {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function redirect(res: Context["res"], location: string): void {
  res.writeHead(303, { Location: location });
  res.end();
}

function loadQuestionDetail(id: string): QuestionDetail | undefined {
  const question = db
    .prepare(
      `SELECT q.id, q.title, q.body, q.created_at, a.name AS actor_name
       FROM questions q JOIN actors a ON a.id = q.actor_id
       WHERE q.id = ?`,
    )
    .get(id) as
    | { id: string; title: string; body: string; created_at: string; actor_name: string }
    | undefined;
  if (!question) return undefined;

  const claimRows = db
    .prepare(
      `SELECT c.id, c.body, c.created_at, c.reviewed_at, c.version, a.name AS actor_name
       FROM claims c JOIN actors a ON a.id = c.actor_id
       WHERE c.question_id = ? ORDER BY c.created_at ASC`,
    )
    .all(id) as Array<{
    id: string;
    body: string;
    created_at: string;
    reviewed_at: string | null;
    version: number;
    actor_name: string;
  }>;

  const claims: ClaimRow[] = claimRows.map((c) => {
    const evidenceRows = db
      .prepare(
        `SELECT e.id, e.relation, e.body, e.source_url, e.created_at, a.name AS actor_name
         FROM evidence e JOIN actors a ON a.id = e.actor_id
         WHERE e.claim_id = ? ORDER BY e.created_at ASC`,
      )
      .all(c.id) as unknown as EvidenceRow[];
    const reviews = db.prepare(
      `SELECT r.version, r.reason, r.created_at, a.name AS actor_name
       FROM claim_reviews r JOIN actors a ON a.id = r.actor_id
       WHERE r.claim_id = ? ORDER BY r.version ASC`,
    ).all(c.id) as ClaimRow["reviews"];
    return { ...c, evidence: evidenceRows, reviews };
  });

  return { ...question, claims };
}

function fetchQuestionSummaries(): QuestionSummary[] {
  return db
    .prepare(
      `SELECT q.id, q.title, q.created_at, a.name AS actor_name,
              (SELECT COUNT(*) FROM claims c WHERE c.question_id = q.id) AS claim_count
       FROM questions q JOIN actors a ON a.id = q.actor_id
       ORDER BY q.created_at DESC`,
    )
    .all() as unknown as QuestionSummary[];
}

function listQuestions(ctx: Context): void {
  const actor = resolveActor(ctx.req, ctx.res);
  send(ctx.res, 200, renderQuestionList(fetchQuestionSummaries(), actor.name));
}

router.get("/", async (ctx) => listQuestions(ctx));
router.get("/questions", async (ctx) => listQuestions(ctx));

router.post("/questions", async (ctx) => {
  const actor = resolveActor(ctx.req, ctx.res);
  if (!allow(clientKey(ctx))) return send(ctx.res, 429, "too many requests");

  const form = parseForm(await readBody(ctx.req));
  try {
    const title = requireLength(form.title ?? "", "title", 3, 200);
    const body = (form.body ?? "").trim().slice(0, 4000);
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    db.prepare(
      "INSERT INTO questions (id, title, body, actor_id, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run(id, title, body, actor.id, createdAt);
    recordEvent("question_created", { id, title }, actor.id);
    redirect(ctx.res, `/questions/${id}`);
  } catch (err) {
    if (err instanceof ValidationError) {
      return send(
        ctx.res,
        400,
        renderQuestionList(fetchQuestionSummaries(), actor.name, err.message, {
          title: form.title ?? "",
          body: form.body ?? "",
        }),
      );
    }
    throw err;
  }
});

router.get("/questions/:id", async (ctx) => {
  const actor = resolveActor(ctx.req, ctx.res);
  const detail = loadQuestionDetail(ctx.params.id!);
  if (!detail) return send(ctx.res, 404, renderNotFound(actor.name));
  send(ctx.res, 200, renderQuestionDetail(detail, actor.name));
});

router.post("/questions/:id/claims", async (ctx) => {
  const actor = resolveActor(ctx.req, ctx.res);
  if (!allow(clientKey(ctx))) return send(ctx.res, 429, "too many requests");

  const questionId = ctx.params.id!;
  const exists = db.prepare("SELECT 1 FROM questions WHERE id = ?").get(questionId);
  if (!exists) return send(ctx.res, 404, renderNotFound(actor.name));

  const form = parseForm(await readBody(ctx.req));
  try {
    const body = requireLength(form.body ?? "", "claim", 1, 4000);
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    db.prepare(
      "INSERT INTO claims (id, question_id, body, actor_id, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run(id, questionId, body, actor.id, createdAt);
    recordEvent("claim_created", { id, questionId }, actor.id);
    redirect(ctx.res, `/questions/${questionId}`);
  } catch (err) {
    if (err instanceof ValidationError) {
      const detail = loadQuestionDetail(questionId)!;
      return send(ctx.res, 400, renderQuestionDetail(detail, actor.name, err.message));
    }
    throw err;
  }
});

router.post("/claims/:id/evidence", async (ctx) => {
  const actor = resolveActor(ctx.req, ctx.res);
  if (!allow(clientKey(ctx))) return send(ctx.res, 429, "too many requests");

  const claimId = ctx.params.id!;
  const claim = db
    .prepare("SELECT question_id FROM claims WHERE id = ?")
    .get(claimId) as { question_id: string } | undefined;
  if (!claim) return send(ctx.res, 404, renderNotFound(actor.name));

  const form = parseForm(await readBody(ctx.req));
  try {
    const body = requireLength(form.body ?? "", "evidence", 1, 4000);
    const relation = validateRelation(form.relation ?? "");
    const sourceUrl = validateSourceUrl(form.source_url ?? "");
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO evidence (id, claim_id, relation, body, source_url, actor_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, claimId, relation, body, sourceUrl, actor.id, createdAt);
    recordEvent("evidence_created", { id, claimId, questionId: claim.question_id, relation }, actor.id);
    redirect(ctx.res, `/questions/${claim.question_id}`);
  } catch (err) {
    if (err instanceof ValidationError) {
      const detail = loadQuestionDetail(claim.question_id)!;
      return send(ctx.res, 400, renderQuestionDetail(detail, actor.name, err.message));
    }
    throw err;
  }
});

router.post("/claims/:id/review", async (ctx) => {
  const actor = resolveActor(ctx.req, ctx.res);
  if (!allow(clientKey(ctx))) return send(ctx.res, 429, "too many requests");
  const claimId = ctx.params.id!;
  const form = parseForm(await readBody(ctx.req));
  const current = db.prepare("SELECT question_id FROM claims WHERE id = ?").get(claimId) as
    | { question_id: string }
    | undefined;
  if (!current) return send(ctx.res, 404, renderNotFound(actor.name));

  const expected = form.expected_version ?? "";
  const expectedVersion = /^(0|[1-9][0-9]*)$/.test(expected) ? Number(expected) : NaN;
  const reasonDraft = form.reason ?? "";
  try {
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
      throw new ValidationError("review version is invalid");
    }
    const reason = requireLength(reasonDraft, "review reason", 10, 1000);
    const result = reviewClaim(claimId, expectedVersion, actor.id, reason);
    if (result.kind === "not_found") return send(ctx.res, 404, renderNotFound(actor.name));
    if (result.kind === "conflict") {
      return send(ctx.res, 409, renderQuestionDetail(
        loadQuestionDetail(result.questionId)!, actor.name,
        `Someone reviewed this claim first. Latest version is ${result.version}; inspect it before trying again.`,
        { claimId, reason },
      ));
    }
    recordEvent("claim_reviewed", { claimId, questionId: result.questionId, version: result.version }, actor.id);
    redirect(ctx.res, `/questions/${result.questionId}`);
  } catch (error) {
    if (error instanceof ValidationError) {
      return send(ctx.res, 400, renderQuestionDetail(
        loadQuestionDetail(current.question_id)!, actor.name, error.message,
        { claimId, reason: reasonDraft },
      ));
    }
    throw error;
  }
});

router.post("/actor/name", async (ctx) => {
  const actor = resolveActor(ctx.req, ctx.res);
  if (!allow(clientKey(ctx))) return send(ctx.res, 429, "too many requests");

  const form = parseForm(await readBody(ctx.req));
  try {
    const name = requireLength(form.name ?? "", "name", 1, 40);
    renameActor(actor.id, name);
    recordEvent("actor_renamed", { actorId: actor.id }, actor.id);
  } catch {
    // keep the previous name silently; this is a low-stakes convenience field
  }
  const referer = ctx.req.headers.referer;
  let redirectTo = "/questions";
  if (referer && referer.startsWith("http")) {
    try {
      redirectTo = new URL(referer).pathname;
    } catch {
      // malformed Referer header; fall back to the default above
    }
  }
  redirect(ctx.res, redirectTo);
});

router.get("/readme/", async (ctx) => {
  send(ctx.res, 200, renderReadme());
});

const liveClient = readFileSync(new URL("./live-client.js", import.meta.url), "utf8");
router.get("/live.js", async (ctx) => {
  ctx.res.writeHead(200, {
    "Content-Type": "text/javascript; charset=utf-8",
    "Cache-Control": "public, max-age=60",
  });
  ctx.res.end(liveClient);
});
router.get("/events/stream", async (ctx) => streamEvents(ctx));

// Gate 2: external agent HTTP API, additive — see src/api.ts. Scoped agent
// bearer tokens only; never the human session cookie above.
registerApiRoutes(router);

const server = createServer((req, res) => {
  router.dispatch(req, res, (ctx) => {
    send(ctx.res, 404, renderNotFound());
  }).catch((err) => {
    console.error(err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("internal error");
    }
  });
});

const port = Number(process.env.PORT ?? 8080);
server.listen(port, "0.0.0.0", () => {
  console.log(`proofroom listening on 0.0.0.0:${port}`);
});
