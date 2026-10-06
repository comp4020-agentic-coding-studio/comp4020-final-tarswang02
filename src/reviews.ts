import { randomUUID } from "node:crypto";
import { db } from "./db.ts";

export type ReviewResult =
  | { kind: "accepted"; questionId: string; version: number }
  | { kind: "conflict"; questionId: string; version: number }
  | { kind: "not_found" };

// Synchronous SQLite transaction: the visible latest review and the append-
// only history row advance together. The caller publishes the live event only
// after this transaction commits, never while the record is provisional.
export function reviewClaim(
  claimId: string,
  expectedVersion: number,
  actorId: string,
  reason: string,
): ReviewResult {
  db.exec("BEGIN IMMEDIATE");
  try {
    const current = db.prepare("SELECT question_id, version FROM claims WHERE id = ?").get(claimId) as
      | { question_id: string; version: number }
      | undefined;
    if (!current) {
      db.exec("ROLLBACK");
      return { kind: "not_found" };
    }
    if (current.version !== expectedVersion) {
      db.exec("ROLLBACK");
      return { kind: "conflict", questionId: current.question_id, version: current.version };
    }

    const version = current.version + 1;
    const createdAt = new Date().toISOString();
    db.prepare(
      `UPDATE claims SET reviewed_at = ?, reviewed_by = ?, review_reason = ?, version = ?
       WHERE id = ? AND version = ?`,
    ).run(createdAt, actorId, reason, version, claimId, expectedVersion);
    db.prepare(
      `INSERT INTO claim_reviews (id, claim_id, version, actor_id, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(randomUUID(), claimId, version, actorId, reason, createdAt);
    db.exec("COMMIT");
    return { kind: "accepted", questionId: current.question_id, version };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
