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

  CREATE TABLE IF NOT EXISTS claim_reviews (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL REFERENCES claims(id),
    version INTEGER NOT NULL,
    actor_id TEXT NOT NULL REFERENCES actors(id),
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (claim_id, version)
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
  CREATE INDEX IF NOT EXISTS idx_claim_reviews_claim ON claim_reviews(claim_id);
`);

export interface StoredEvent {
  seq: number;
  type: string;
  payload: unknown;
  created_at: string;
}

const eventListeners = new Set<(event: StoredEvent) => void>();

export function latestEventSeq(): number {
  const row = db.prepare("SELECT COALESCE(MAX(seq), 0) AS seq FROM events").get() as { seq: number };
  return row.seq;
}

export function eventsAfter(seq: number, limit = 200): StoredEvent[] {
  const rows = db.prepare(
    "SELECT seq, type, payload, created_at FROM events WHERE seq > ? ORDER BY seq ASC LIMIT ?",
  ).all(seq, limit) as Array<{ seq: number; type: string; payload: string; created_at: string }>;
  return rows.map((row) => ({ ...row, payload: JSON.parse(row.payload) }));
}

export function subscribeEvents(listener: (event: StoredEvent) => void): () => void {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
}

export function recordEvent(type: string, payload: unknown, actorId: string): number {
  const createdAt = new Date().toISOString();
  const result = db.prepare(
    "INSERT INTO events (type, payload, actor_id, created_at) VALUES (?, ?, ?, ?)",
  ).run(type, JSON.stringify(payload), actorId, createdAt);
  const event = { seq: Number(result.lastInsertRowid), type, payload, created_at: createdAt };
  for (const listener of eventListeners) listener(event);
  return event.seq;
}
