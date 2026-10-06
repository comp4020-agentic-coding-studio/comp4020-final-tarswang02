import type { IncomingMessage } from "node:http";
import { db } from "./db.ts";
import type { Actor } from "./actors.ts";
import { markRequestActor } from "./observability.ts";

// Gate 2: external agent credentials are scoped and separate from any human
// session cookie, and separate from the course Claude development token —
// never put that token here or in an example. Configure as a comma-separated
// list of "token:label" pairs, e.g.
//   AGENT_TOKENS=9f2c1e...:review-agent,4b7a08...:research-agent
// Each label becomes that agent's stable, server-attributed actor identity
// (never a name the request body supplies).
function parseAgentTokens(): Map<string, string> {
  const raw = process.env.AGENT_TOKENS ?? "";
  const out = new Map<string, string>();
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const i = trimmed.indexOf(":");
    if (i === -1) continue;
    const token = trimmed.slice(0, i).trim();
    const label = trimmed.slice(i + 1).trim();
    if (token && /^[a-zA-Z0-9_-]{1,64}$/.test(label)) out.set(token, label);
  }
  return out;
}

function bearerToken(req: IncomingMessage): string | undefined {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

function ensureAgentActor(label: string): Actor {
  const id = `agent:${label}`;
  const existing = db.prepare("SELECT id, name FROM actors WHERE id = ?").get(id) as
    | Actor
    | undefined;
  if (existing) return existing;
  db.prepare("INSERT INTO actors (id, name, created_at) VALUES (?, ?, ?)").run(
    id,
    label,
    new Date().toISOString(),
  );
  return { id, name: label };
}

// Resolves the calling agent's actor from its bearer token only. Returns
// undefined for a missing or unrecognised token — callers answer 401 rather
// than falling back to an anonymous actor, since every API write must be
// attributed to a configured agent identity.
export function resolveAgentActor(req: IncomingMessage): Actor | undefined {
  const token = bearerToken(req);
  if (!token) return undefined;
  const tokens = parseAgentTokens();
  const label = tokens.get(token);
  if (!label) return undefined;
  const actor = ensureAgentActor(label);
  markRequestActor(req, actor.name);
  return actor;
}
