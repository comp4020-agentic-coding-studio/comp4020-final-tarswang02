import type { IncomingMessage, ServerResponse } from "node:http";

const actorNames = new WeakMap<IncomingMessage, string>();

export function markRequestActor(req: IncomingMessage, actorName: string): void {
  actorNames.set(req, actorName);
}

export interface ActionRoute {
  action: string;
  targetId?: string;
}

// Only known user interactions are logged. Static assets, SSE keep-alives,
// polling and health checks would drown out the story of what people did.
export function actionRoute(method: string | undefined, path: string): ActionRoute | undefined {
  const normalPath = path === "/" ? path : path.replace(/\/+$/, "");
  const direct: Record<string, string> = {
    "GET /": "questions_viewed",
    "GET /questions": "questions_viewed",
    "POST /questions": "question_submitted",
    "GET /readme": "about_viewed",
    "POST /actor/name": "name_change_submitted",
    "GET /api/v1/questions": "agent_questions_read",
    "POST /api/v1/questions": "agent_question_submitted",
  };
  const known = direct[`${method} ${normalPath}`];
  if (known) return { action: known };

  const patterns: Array<[RegExp, string]> = [
    [/^GET \/questions\/([^/]+)$/, "question_viewed"],
    [/^POST \/questions\/([^/]+)\/claims$/, "claim_submitted"],
    [/^POST \/claims\/([^/]+)\/evidence$/, "evidence_submitted"],
    [/^POST \/claims\/([^/]+)\/review$/, "review_submitted"],
    [/^GET \/api\/v1\/questions\/([^/]+)$/, "agent_question_read"],
    [/^POST \/api\/v1\/questions\/([^/]+)\/claims$/, "agent_claim_submitted"],
    [/^POST \/api\/v1\/claims\/([^/]+)\/evidence$/, "agent_evidence_submitted"],
    [/^POST \/api\/v1\/claims\/([^/]+)\/review$/, "agent_review_submitted"],
  ];
  for (const [pattern, action] of patterns) {
    const match = `${method} ${normalPath}`.match(pattern);
    if (match) return { action, targetId: match[1] };
  }
  return undefined;
}

export function observeRequest(req: IncomingMessage, res: ServerResponse): void {
  const started = Date.now();
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  const route = actionRoute(req.method, path);
  if (!route) return;

  let logged = false;
  const write = (outcome: "finished" | "aborted"): void => {
    if (logged) return;
    logged = true;
    // No body, source URL, query string, cookie, bearer token, or client IP.
    // Each line can be tailed directly with `flyctl logs` during Crit 10.
    console.log(JSON.stringify({
      kind: "proofroom_action",
      at: new Date().toISOString(),
      actor: actorNames.get(req) ?? "unidentified",
      action: route.action,
      ...(route.targetId ? { target_id: route.targetId } : {}),
      status: res.statusCode,
      outcome,
      duration_ms: Date.now() - started,
    }));
  };
  res.once("finish", () => write("finished"));
  res.once("close", () => write("aborted"));
}
