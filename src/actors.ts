import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { db } from "./db.ts";

export interface Actor {
  id: string;
  name: string;
}

const COOKIE_NAME = "proofroom_session";

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function randomName(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `Visitor-${n}`;
}

// Resolves (and if necessary creates) the actor for this request from the
// server-issued session cookie only — never from request-body/JSON fields,
// so a client can't claim someone else's identity.
export function resolveActor(req: IncomingMessage, res: ServerResponse): Actor {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies[COOKIE_NAME];

  if (sessionId) {
    const row = db.prepare("SELECT id, name FROM actors WHERE id = ?").get(sessionId) as
      | Actor
      | undefined;
    if (row) return row;
  }

  const id = randomUUID();
  const name = randomName();
  db.prepare("INSERT INTO actors (id, name, created_at) VALUES (?, ?, ?)").run(
    id,
    name,
    new Date().toISOString(),
  );
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
  );
  return { id, name };
}

export function renameActor(actorId: string, name: string): void {
  db.prepare("UPDATE actors SET name = ? WHERE id = ?").run(name, actorId);
}
