// POST /api/note { title, round, rows } -> { id }   GET /api/note?id=<id> -> the note
// The note for a teacher is the only thing saved on the server: the essay's title, and for each
// comment the teacher's mark and the student's quoted answer. Never the essay itself.

import type { Env } from "../worker";
import { BadRequest, failure, json, readJSON, str } from "./ai";

export interface NoteRow {
  n: number;
  mark: string;
  typed: boolean;
  quote: string;
  removed: boolean;
}

export interface Note {
  title: string;
  round: number;
  rows: NoteRow[];
}

const TABLE = "create table if not exists notes (id text primary key, body text not null, playtest integer not null default 0, created_at text not null)";

function clean(raw: unknown): Note {
  const o = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const rows = (Array.isArray(o["rows"]) ? (o["rows"] as unknown[]) : []).slice(0, 60).map((r) => {
    const x = (typeof r === "object" && r !== null ? r : {}) as Record<string, unknown>;
    return { n: Number(x["n"]) || 0, mark: str(x["mark"], 300), typed: x["typed"] === true, quote: str(x["quote"], 1000), removed: x["removed"] === true };
  });
  const title = str(o["title"], 200).trim();
  if (title === "" || rows.length === 0) throw new BadRequest("A note needs a title and at least one comment.");
  return { title, round: Number(o["round"]) || 1, rows };
}

export const POST = async (request: Request, env: Env): Promise<Response> => {
  try {
    const note = clean(await readJSON(request, 100_000));
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const playtest = request.headers.get("x-playtest") === "1" ? 1 : 0;
    await env.DB.batch([
      env.DB.prepare(TABLE),
      env.DB.prepare("insert into notes (id, body, playtest, created_at) values (?, ?, ?, ?)").bind(id, JSON.stringify(note), playtest, new Date().toISOString()),
    ]);
    return json({ id });
  } catch (error) {
    return failure(error);
  }
};

export const GET = async (request: Request, env: Env): Promise<Response> => {
  try {
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!/^[a-f0-9]{12}$/.test(id)) return json({ error: "not-found", message: "There's no note at this link." }, 404);
    await env.DB.prepare(TABLE).run();
    const row = await env.DB.prepare("select body from notes where id = ?").bind(id).first<{ body: string }>();
    if (row === null) return json({ error: "not-found", message: "There's no note at this link." }, 404);
    return json(JSON.parse(row.body) as Note);
  } catch (error) {
    return failure(error);
  }
};
