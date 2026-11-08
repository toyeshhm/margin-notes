// End card: the first sample's first page, handed back with one fresh word in red ink, "Better.";
// then the name and address in large type, then what it was built with.

import gsap from "gsap";
import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

import "../tokens.css";
import "../paper.css";
import "./cards.css";
import { samplePage } from "../ink/paper";
import { handSVG } from "../ink/pen";
import { laterBells } from "../samples/laterBells";
import { cards } from "./content";

function Page(): React.JSX.Element {
  const slot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = slot.current;
    if (el === null || el.childElementCount > 0) return;
    el.appendChild(samplePage(laterBells, 0, Math.round(window.innerHeight * 0.78 * (816 / 1056))));
  }, []);
  return <div ref={slot} />;
}

const better = handSVG("Better.", { size: 64, write: true, delay: 1.0, speed: 380, pen: { size: 4.2, thinning: 0.5, smoothing: 0.6, streamline: 0.35 } });

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
createRoot(root).render(
  <main className="stage">
    <img className="dust" src="/assets/band-pages.webp" alt="" />
    <div className="end-page">
      <span className="better" dangerouslySetInnerHTML={{ __html: better.svg }} />
      <Page />
    </div>
    <div className="end-text">
      <h1>{cards.title}</h1>
      <p className="end-url">{cards.url}</p>
      <ul className="credits">
        <li>Built with</li>
        {cards.builtWith.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </div>
  </main>,
);

requestAnimationFrame(() => {
  const tl = gsap.timeline();
  tl.from(".end-page", { x: "-30vw", rotate: -9, opacity: 0, duration: 1.0, ease: "expo.out" })
    .from(".end-text h1", { y: 30, opacity: 0, duration: 0.8, ease: "expo.out" }, 2.6)
    .from(".end-url", { y: 16, opacity: 0, duration: 0.7, ease: "expo.out" }, 3.0)
    .from(".credits li", { y: 10, opacity: 0, duration: 0.5, stagger: 0.12, ease: "expo.out" }, 3.6);
  gsap.to(".end-page", { rotate: -1.2, y: "-=8", duration: 6, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1.0 });
  gsap.to(".dust", { scale: 1.05, x: "1.5%", duration: 12, ease: "sine.inOut", yoyo: true, repeat: -1 });
});
