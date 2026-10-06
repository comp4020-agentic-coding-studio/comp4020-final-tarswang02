import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export const DATA_DIR = process.env.DATA_DIR ?? "./.data";
mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(join(DATA_DIR, "proofroom.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS actors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    actor_id TEXT NOT NULL REFERENCES actors(id),
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL REFERENCES questions(id),
    body TEXT NOT NULL,
    actor_id TEXT NOT NULL REFERENCES actors(id),
    created_at TEXT NOT NULL,
    reviewed_at TEXT,
    reviewed_by TEXT,
    review_reason TEXT,
    version INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL REFERENCES claims(id),
    relation TEXT NOT NULL CHECK (relation IN ('supports', 'challenges')),
    body TEXT NOT NULL,
    source_url TEXT,
    actor_id TEXT NOT NULL REFERENCES actors(id),
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_claims_question ON claims(question_id);
  CREATE INDEX IF NOT EXISTS idx_evidence_claim ON evidence(claim_id);
`);

export function recordEvent(type: string, payload: unknown, actorId: string): void {
  db.prepare(
    "INSERT INTO events (type, payload, actor_id, created_at) VALUES (?, ?, ?, ?)",
  ).run(type, JSON.stringify(payload), actorId, new Date().toISOString());
}
