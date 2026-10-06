import type { IncomingMessage, ServerResponse } from "node:http";

export interface Context {
  req: IncomingMessage;
  res: ServerResponse;
  params: Record<string, string>;
  url: URL;
}

export type Handler = (ctx: Context) => void | Promise<void>;

interface Route {
  method: string;
  segments: string[];
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  add(method: string, path: string, handler: Handler): void {
    this.routes.push({ method, segments: path.split("/").filter(Boolean), handler });
  }

  get(path: string, handler: Handler): void {
    this.add("GET", path, handler);
  }

  post(path: string, handler: Handler): void {
    this.add("POST", path, handler);
  }

  async dispatch(req: IncomingMessage, res: ServerResponse, notFound: Handler): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");
    const requestSegments = url.pathname.split("/").filter(Boolean);

    for (const route of this.routes) {
      if (route.method !== req.method) continue;
      if (route.segments.length !== requestSegments.length) continue;

      const params: Record<string, string> = {};
      let matched = true;
      for (let i = 0; i < route.segments.length; i++) {
        const seg = route.segments[i]!;
        if (seg.startsWith(":")) {
          params[seg.slice(1)] = decodeURIComponent(requestSegments[i]!);
        } else if (seg !== requestSegments[i]) {
          matched = false;
          break;
        }
      }
      if (!matched) continue;

      await route.handler({ req, res, params, url });
      return;
    }

    await notFound({ req, res, params: {}, url });
  }
}

export async function readBody(req: IncomingMessage, limitBytes = 64 * 1024): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    total += (chunk as Buffer).length;
    if (total > limitBytes) throw new Error("request body too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function parseForm(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  const out: Record<string, string> = {};
  for (const [key, value] of params) out[key] = value;
  return out;
}
