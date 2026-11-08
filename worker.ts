// Cloudflare runs this Worker only for /api/* (wrangler.jsonc, run_worker_first).
// Each api/<name>.ts exports one function per HTTP method it answers, taking (request, env).

import * as check from "./api/check";
import * as explain from "./api/explain";
import * as note from "./api/note";
import * as scan from "./api/scan";

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}

export interface Env {
  GROQ_API_KEY?: string;
  ASSETS: { fetch(request: Request): Promise<Response> };
  AI: { run(model: string, input: Record<string, unknown>): Promise<unknown> };
  DB: {
    prepare(sql: string): D1Statement;
    batch(statements: D1Statement[]): Promise<unknown>;
  };
}

const routes: Partial<Record<string, Partial<Record<string, (request: Request, env: Env) => Promise<Response>>>>> = {
  "/api/scan": scan,
  "/api/explain": explain,
  "/api/check": check,
  "/api/note": note,
};

export default {
  fetch(request: Request, env: Env): Promise<Response> | Response {
    const route = routes[new URL(request.url).pathname];
    const handler = route?.[request.method];
    if (handler !== undefined) return handler(request, env);
    if (route === undefined) return new Response("Not found", { status: 404 });
    return new Response("Method not allowed", { status: 405, headers: { allow: Object.keys(route).join(", ") } });
  },
};
