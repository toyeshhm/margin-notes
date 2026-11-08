// Calls to the Worker. Every failure becomes an ApiError with a message a student can act on.

import type { Note } from "../../api/note";
import type { PageScan, Plain, Verdict } from "./types";

export class ApiError extends Error {
  constructor(
    readonly kind: "allowance" | "bad-request" | "not-found" | "failed" | "offline",
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers: { "content-type": "application/json" } });
  } catch {
    throw new ApiError("offline", "Couldn't reach Margin Notes. Check your connection and try again.");
  }
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const kind = body["error"];
    const message = typeof body["message"] === "string" ? body["message"] : "Something went wrong. Try again in a minute.";
    throw new ApiError(kind === "allowance" || kind === "bad-request" || kind === "not-found" ? kind : "failed", message);
  }
  return body as T;
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export function readPageText(image: string): Promise<{ isEssay: boolean; text: string }> {
  return call("/api/scan", post({ image }));
}

export async function readMarks(sheet: string, inMargin: boolean[]): Promise<PageScan["marks"]> {
  const { marks } = await call<{ marks: PageScan["marks"] }>("/api/scan", post({ sheet, inMargin }));
  return marks;
}

export async function readWholePage(image: string): Promise<PageScan["marks"]> {
  const { marks } = await call<{ marks: PageScan["marks"] }>("/api/scan", post({ image, whole: true }));
  return marks;
}

export async function explain(marks: { n: number; words: string; sentence: string }[]): Promise<Map<number, Plain>> {
  const { plains } = await call<{ plains: (Plain & { n: number })[] }>("/api/explain", post({ marks }));
  return new Map(plains.map((p) => [p.n, { meaning: p.meaning, todo: p.todo }]));
}

export async function check(body: {
  sentences: { id: string; text: string }[];
  draft: string;
  comments: { n: number; words: string; meaning: string; sentenceId: string }[];
}): Promise<Verdict[]> {
  const { verdicts } = await call<{ verdicts: Verdict[] }>("/api/check", post(body));
  return verdicts;
}

export async function saveNote(note: Note): Promise<string> {
  const { id } = await call<{ id: string }>("/api/note", post(note));
  return id;
}

export function loadNote(id: string): Promise<Note> {
  return call<Note>(`/api/note?id=${encodeURIComponent(id)}`);
}
