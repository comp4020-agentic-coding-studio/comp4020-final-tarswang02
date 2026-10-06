import { randomUUID } from "node:crypto";
import type { Context, Router } from "./router.ts";
import { readBody } from "./router.ts";
import { db, recordEvent } from "./db.ts";
import { resolveAgentActor } from "./apiAuth.ts";
import type { Actor } from "./actors.ts";
import {
  ValidationError,
  requireLength,
  validateSourceUrl,
  validateRelation,
} from "./validate.ts";
import { allow } from "./ratelimit.ts";
import { reviewClaim } from "./reviews.ts";

// Gate 2: a minimal versioned JSON API for external agent clients. Every
// route requires a scoped agent bearer token (src/apiAuth.ts) — never the
// human session cookie, never an actor name from the request body. Invalid
// input and authentication failures are answered as JSON errors, not mock
// success.

function sendJson(res: Context["res"], status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJson(req: Context["req"]): Promise<Record<string, unknown>> {
  const text = await readBody(req);
  if (!text.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new ValidationError("request body must be a JSON object");
  }
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// Resolves the agent, applies the same per-caller rate limit as the human
// routes (keyed by agent identity rather than IP), and turns a thrown
// ValidationError into a 400 — so every handler below only has to describe
// the happy path.
function withAgent(
  handler: (ctx: Context, actor: Actor) => Promise<void>,
): (ctx: Context) => Promise<void> {
  return async (ctx) => {
    const actor = resolveAgentActor(ctx.req);
    if (!actor) return sendJson(ctx.res, 401, { error: "missing or unrecognised agent token" });
    if (ctx.req.method !== "GET" && !allow(`agent:${actor.name}`)) {
      return sendJson(ctx.res, 429, { error: "too many requests" });
    }
    try {
      await handler(ctx, actor);
    } catch (err) {
      if (err instanceof ValidationError) {
        return sendJson(ctx.res, 400, { error: err.message });
      }
      throw err;
    }
  };
}

export function registerApiRoutes(router: Router): void {
  router.get(
    "/api/v1/questions",
    withAgent(async (ctx) => {
      const rows = db
        .prepare(
          `SELECT q.id, q.title, q.created_at, a.name AS actor_name,
                  (SELECT COUNT(*) FROM claims c WHERE c.question_id = q.id) AS claim_count
           FROM questions q JOIN actors a ON a.id = q.actor_id
           ORDER BY q.created_at DESC`,
        )
        .all();
      sendJson(ctx.res, 200, { questions: rows });
    }),
  );

  router.post(
    "/api/v1/questions",
    withAgent(async (ctx, actor) => {
      const input = await readJson(ctx.req);
      const title = requireLength(str(input.title), "title", 3, 200);
      const body = str(input.body).trim().slice(0, 4000);
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      db.prepare(
        "INSERT INTO questions (id, title, body, actor_id, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run(id, title, body, actor.id, createdAt);
      recordEvent("question_created", { id, title }, actor.id);
      sendJson(ctx.res, 201, {
        id,
        title,
        body,
        actor_name: actor.name,
        created_at: createdAt,
      });
    }),
  );

  router.get(
    "/api/v1/questions/:id",
    withAgent(async (ctx) => {
      const id = ctx.params.id!;
      const question = db
        .prepare(
          `SELECT q.id, q.title, q.body, q.created_at, a.name AS actor_name
           FROM questions q JOIN actors a ON a.id = q.actor_id WHERE q.id = ?`,
        )
        .get(id) as
        | { id: string; title: string; body: string; created_at: string; actor_name: string }
        | undefined;
      if (!question) return sendJson(ctx.res, 404, { error: "question not found" });

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

      const claims = claimRows.map((claim) => {
        const evidence = db
          .prepare(
            `SELECT e.id, e.relation, e.body, e.source_url, e.created_at, a.name AS actor_name
             FROM evidence e JOIN actors a ON a.id = e.actor_id
             WHERE e.claim_id = ? ORDER BY e.created_at ASC`,
          )
          .all(claim.id);
        const reviews = db.prepare(
          `SELECT r.version, r.reason, r.created_at, a.name AS actor_name
           FROM claim_reviews r JOIN actors a ON a.id = r.actor_id
           WHERE r.claim_id = ? ORDER BY r.version ASC`,
        ).all(claim.id);
        return { ...claim, evidence, reviews };
      });

      sendJson(ctx.res, 200, { ...question, claims });
    }),
  );

  router.post(
    "/api/v1/questions/:id/claims",
    withAgent(async (ctx, actor) => {
      const questionId = ctx.params.id!;
      const exists = db.prepare("SELECT 1 FROM questions WHERE id = ?").get(questionId);
      if (!exists) return sendJson(ctx.res, 404, { error: "question not found" });

      const input = await readJson(ctx.req);
      const body = requireLength(str(input.body), "claim", 1, 4000);
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      db.prepare(
        "INSERT INTO claims (id, question_id, body, actor_id, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run(id, questionId, body, actor.id, createdAt);
      recordEvent("claim_created", { id, questionId }, actor.id);
      sendJson(ctx.res, 201, {
        id,
        question_id: questionId,
        body,
        actor_name: actor.name,
        created_at: createdAt,
      });
    }),
  );

  router.post(
    "/api/v1/claims/:id/review",
    withAgent(async (ctx, actor) => {
      const input = await readJson(ctx.req);
      const expectedVersion = input.expected_version;
      if (!Number.isSafeInteger(expectedVersion) || (expectedVersion as number) < 1) {
        throw new ValidationError("expected_version must be a positive integer");
      }
      const reason = requireLength(str(input.reason), "review reason", 10, 1000);
      const result = reviewClaim(ctx.params.id!, expectedVersion as number, actor.id, reason);
      if (result.kind === "not_found") return sendJson(ctx.res, 404, { error: "claim not found" });
      if (result.kind === "conflict") {
        const latest = db.prepare(
          `SELECT c.version, c.reviewed_at, c.review_reason, a.name AS reviewed_by
           FROM claims c LEFT JOIN actors a ON a.id = c.reviewed_by WHERE c.id = ?`,
        ).get(ctx.params.id!);
        return sendJson(ctx.res, 409, { error: "stale review", latest });
      }
      recordEvent("claim_reviewed", {
        claimId: ctx.params.id!, questionId: result.questionId, version: result.version,
      }, actor.id);
      sendJson(ctx.res, 200, { claim_id: ctx.params.id!, version: result.version, reviewed_by: actor.name });
    }),
  );

  router.post(
    "/api/v1/claims/:id/evidence",
    withAgent(async (ctx, actor) => {
      const claimId = ctx.params.id!;
      const claim = db.prepare("SELECT question_id FROM claims WHERE id = ?").get(claimId) as
        | { question_id: string }
        | undefined;
      if (!claim) return sendJson(ctx.res, 404, { error: "claim not found" });

      const input = await readJson(ctx.req);
      const body = requireLength(str(input.body), "evidence", 1, 4000);
      const relation = validateRelation(str(input.relation));
      const sourceUrl = validateSourceUrl(str(input.source_url));
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      db.prepare(
        `INSERT INTO evidence (id, claim_id, relation, body, source_url, actor_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(id, claimId, relation, body, sourceUrl, actor.id, createdAt);
      recordEvent("evidence_created", { id, claimId, questionId: claim.question_id, relation }, actor.id);
      sendJson(ctx.res, 201, {
        id,
        claim_id: claimId,
        relation,
        body,
        source_url: sourceUrl,
        actor_name: actor.name,
        created_at: createdAt,
      });
    }),
  );

  router.get(
    "/api/v1/events",
    withAgent(async (ctx) => {
      const sinceParam = ctx.url.searchParams.get("since") ?? "0";
      const since = Number.parseInt(sinceParam, 10);
      if (!Number.isFinite(since) || since < 0 || String(since) !== sinceParam.trim()) {
        return sendJson(ctx.res, 400, { error: "since must be a non-negative integer" });
      }
      const rows = db
        .prepare(
          `SELECT e.seq, e.type, e.payload, e.created_at, a.name AS actor_name
           FROM events e JOIN actors a ON a.id = e.actor_id
           WHERE e.seq > ? ORDER BY e.seq ASC LIMIT 100`,
        )
        .all(since) as Array<{
        seq: number;
        type: string;
        payload: string;
        created_at: string;
        actor_name: string;
      }>;
      const events = rows.map((row) => ({ ...row, payload: JSON.parse(row.payload) }));
      sendJson(ctx.res, 200, { events });
    }),
  );
}
