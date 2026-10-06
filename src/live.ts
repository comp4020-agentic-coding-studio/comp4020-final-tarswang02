import type { Context } from "./router.ts";
import { eventsAfter, subscribeEvents } from "./db.ts";
import type { StoredEvent } from "./db.ts";
import { resolveActor } from "./actors.ts";

const MAX_CONNECTIONS = 64;
let connections = 0;

function nonNegativeInteger(value: string): number | undefined {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : undefined;
}

// One-way notifications only. The event row and all visible records live in
// SQLite; the client fetches a fresh server-rendered snapshot after a notice.
export function streamEvents(ctx: Context): void {
  if (connections >= MAX_CONNECTIONS) {
    ctx.res.writeHead(503, { "Retry-After": "2" });
    ctx.res.end("too many live connections");
    return;
  }

  const lastId = ctx.req.headers["last-event-id"];
  const rawSince = typeof lastId === "string" && lastId ? lastId : ctx.url.searchParams.get("since") ?? "0";
  const since = nonNegativeInteger(rawSince);
  if (since === undefined) {
    ctx.res.writeHead(400);
    ctx.res.end("since must be a non-negative integer");
    return;
  }

  resolveActor(ctx.req, ctx.res);
  ctx.res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  ctx.res.flushHeaders();
  connections++;

  let lastSent = since;
  const send = (event: StoredEvent): void => {
    if (event.seq <= lastSent || ctx.res.destroyed) return;
    lastSent = event.seq;
    ctx.res.write(`id: ${event.seq}\ndata: ${JSON.stringify(event)}\n\n`);
  };
  const unsubscribe = subscribeEvents(send);
  // Durable catch-up. A fresh snapshot is also fetched on every connection,
  // so a backlog larger than the replay cap cannot leave the UI stale.
  for (let page = 0; page < 5; page++) {
    const batch = eventsAfter(lastSent, 200);
    for (const event of batch) send(event);
    if (batch.length < 200) break;
  }
  ctx.res.write(": connected\n\n");

  const heartbeat = setInterval(() => {
    if (!ctx.res.destroyed) ctx.res.write(": keep-alive\n\n");
  }, 20_000);
  ctx.res.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    connections--;
  });
}
