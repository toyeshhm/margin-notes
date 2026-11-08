// Essays and their rounds live in this browser only (localStorage). Storage can be missing or full
// (private windows, blocked site data); the app then keeps working for this visit and says so.

import { useSyncExternalStore } from "react";

import { log } from "../log";
import type { Essay } from "./types";

const KEY = "margin-notes:essays";
const listeners = new Set<() => void>();
let cache: Essay[] | undefined;
export let storageWorks = true;

function read(): Essay[] {
  if (cache !== undefined) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw === null ? [] : (JSON.parse(raw) as Essay[]);
  } catch (error) {
    storageWorks = false;
    log("warn", "essays could not be read from this browser", { error: String(error) });
    cache = [];
  }
  return cache;
}

function write(next: Essay[]): void {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    storageWorks = true;
  } catch (error) {
    storageWorks = false;
    log("warn", "essays could not be saved in this browser", { error: String(error) });
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent): void => {
    if (e.key === KEY) {
      cache = undefined;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useEssays(): Essay[] {
  return useSyncExternalStore(subscribe, read, read);
}

export function getEssay(id: string): Essay | undefined {
  return read().find((e) => e.id === id);
}

export function saveEssay(essay: Essay): void {
  const rest = read().filter((e) => e.id !== essay.id);
  write([essay, ...rest]);
}

export function updateEssay(id: string, change: (essay: Essay) => Essay): void {
  write(read().map((e) => (e.id === id ? change(e) : e)));
}

export function deleteEssay(id: string): void {
  write(read().filter((e) => e.id !== id));
}

export function newId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}
