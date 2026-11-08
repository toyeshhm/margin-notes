import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function initMotion(): void {
  gsap.registerPlugin(ScrollTrigger, SplitText);
  document.documentElement.dataset["motion"] = prefersReducedMotion() ? "reduced" : "full";
}
