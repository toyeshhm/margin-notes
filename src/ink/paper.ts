// A sample essay's printed page as DOM, the way a student prints it: Tinos 12 pt, double-spaced,
// one-inch margins, the heading block, surname and page number top right. Used for the sample page
// photos and the cards; the app draws scanned essays with the Page component.

import type { SampleEssay } from "../samples/types";

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

export function samplePage(sample: SampleEssay, index: number, width: number): HTMLElement {
  const el = document.createElement("article");
  el.className = "paper";
  el.style.setProperty("--u", `${String(width / 816)}px`);
  let id = 0;
  const paras = (sample.pages[index] ?? [])
    .map(
      (p) =>
        `<p>${p
          .map((s) => {
            const sid = `s${String(index)}-${String(id++)}`;
            if (typeof s === "string") return `<span class="s" data-s="${sid}">${escape(s)}</span>`;
            const inner = s.map((part) => (typeof part === "string" ? escape(part) : `<span class="t" data-c="${String(part.c)}">${escape(part.t)}</span>`)).join("");
            return `<span class="s" data-s="${sid}">${inner}</span>`;
          })
          .join(" ")}</p>`,
    )
    .join("");
  const head =
    index === 0
      ? `<div class="paper-head">${sample.heading
          .slice(0, -1)
          .map((l) => `<p>${escape(l)}</p>`)
          .join("")}<p class="paper-title">${escape(sample.heading[sample.heading.length - 1] ?? "")}</p></div>`
      : "";
  el.innerHTML = `${index === 0 ? '<i class="staple" aria-hidden="true"></i>' : ""}<span class="paper-run">${escape(sample.surname)} ${String(index + 1)}</span>${head}${paras}`;
  return el;
}
