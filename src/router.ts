// Path routing on the History API: one hook for the current path, one function to move.

import { useSyncExternalStore, type MouseEvent } from "react";

function subscribe(listener: () => void): () => void {
  window.addEventListener("popstate", listener);
  return () => {
    window.removeEventListener("popstate", listener);
  };
}

const current = (): string => location.pathname + location.search;

export function usePath(): string {
  return useSyncExternalStore(subscribe, current, current);
}

export function go(to: string, { replace = false } = {}): void {
  if (to === current()) return;
  if (replace) history.replaceState(null, "", to);
  else history.pushState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}

// For <a href> links: keep the page, let modified clicks open a new tab.
export function follow(e: MouseEvent<HTMLAnchorElement>): void {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  go(e.currentTarget.getAttribute("href") ?? "/");
}
