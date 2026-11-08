// Title card: an index card on the desk at night. The name types itself, a red-pen stroke underlines
// it, then the tagline and the address. The dust and the turning page keep moving underneath.

import gsap from "gsap";
import { createRoot } from "react-dom/client";

import "../tokens.css";
import "./cards.css";
import { inkSVG, underline, BALLPOINT } from "../ink/pen";
import { cards } from "./content";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
const stroke = inkSVG(underline(4, 996, 22, { seed: 41, rise: -6, waver: 3 }), { pen: { ...BALLPOINT, size: 7 }, write: true, delay: 1.9, speed: 1400 });

createRoot(root).render(
  <main className="stage">
    <img className="dust" src="/assets/home-pencil.webp" alt="" />
    <video className="loop" autoPlay muted loop playsInline src="/assets/relief-loop.mp4" />
    <div className="title-card">
      <h1>
        <span className="typed" aria-label={cards.title} />
        <span className="caret" aria-hidden="true" />
      </h1>
      <svg className="stroke" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true" dangerouslySetInnerHTML={{ __html: stroke.svg }} />
      <p className="tagline">{cards.tagline}</p>
      <p className="url">{cards.url}</p>
    </div>
  </main>,
);

requestAnimationFrame(() => {
  const typed = document.querySelector(".typed");
  if (typed === null) return;
  const letters = { n: 0 };
  const tl = gsap.timeline();
  tl.from(".title-card", { y: 40, rotate: -4, opacity: 0, duration: 0.7, ease: "expo.out" })
    .to(letters, { n: cards.title.length, duration: 1.1, ease: `steps(${String(cards.title.length)})`, onUpdate: () => { typed.textContent = cards.title.slice(0, Math.round(letters.n)); } }, 0.5)
    .to(".caret", { opacity: 0, repeat: 5, yoyo: true, duration: 0.25 }, 1.6)
    .from(".tagline", { y: 14, opacity: 0, duration: 0.6, ease: "expo.out" }, 2.6)
    .from(".url", { y: 10, opacity: 0, duration: 0.6, ease: "expo.out" }, 3.0);
  gsap.to(".dust", { scale: 1.06, x: "-1.5%", duration: 12, ease: "sine.inOut", yoyo: true, repeat: -1 });
  gsap.to(".title-card", { rotate: -0.4, y: "+=6", duration: 5, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 3.4 });
});
