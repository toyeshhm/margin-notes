// Renders a sample essay's page as a phone photo of the marked page, for the samples folder.
// Open /scripts/photo.html?sample=<id>&p=<page index> on the Vite dev server and screenshot it.
import "../src/tokens.css";
import "../src/paper.css";
import { drawMarks } from "../src/ink/marks";
import { samplePage } from "../src/ink/paper";
import { samples } from "../src/samples";

const q = new URLSearchParams(location.search);
const sample = samples.find((s) => s.id === q.get("sample")) ?? samples[0];
const index = Number(q.get("p") ?? "0");
const shot = document.getElementById("shot");
if (sample !== undefined && shot !== null) {
  document.documentElement.style.setProperty("--rz", index % 2 === 0 ? "-1.6deg" : "1.3deg");
  await document.fonts.load("16px Tinos");
  const page = samplePage(sample, index, Number(q.get("w") ?? "1100"));
  shot.appendChild(page);
  const ids = new Set([...page.querySelectorAll(".t")].map((t) => Number(t.getAttribute("data-c"))));
  const marks = sample.comments
    .filter((c) => ids.has(c.n))
    .map((c) => ({ ...c, sentenceId: page.querySelector(`.t[data-c="${String(c.n)}"]`)?.closest(".s")?.getAttribute("data-s") ?? "" }));
  for (const color of new Set(marks.map((m) => m.color ?? "#c22026"))) {
    const { svg } = drawMarks(page, marks.filter((m) => (m.color ?? "#c22026") === color), { pen: { size: 3.1, thinning: 0.5, smoothing: 0.6, streamline: 0.35 }, color, markSize: 25 });
    page.insertAdjacentHTML("beforeend", svg);
  }
  shot.classList.add("tilt");
  document.body.dataset["ready"] = "1";
}
