// Cloudflare runs this Worker only for /api/* (wrangler.jsonc, run_worker_first).
// Each api/<name>.ts exports one function per HTTP method it answers, taking (request, env).

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const routes: Partial<Record<string, Partial<Record<string, (request: Request, env: Env) => Promise<Response>>>>> = {};

export default {
  fetch(request: Request, env: Env): Promise<Response> | Response {
    const route = routes[new URL(request.url).pathname];
    const handler = route?.[request.method];
    if (handler !== undefined) return handler(request, env);
    if (route === undefined) return new Response("Not found", { status: 404 });
    return new Response("Method not allowed", { status: 405, headers: { allow: Object.keys(route).join(", ") } });
  },
};
