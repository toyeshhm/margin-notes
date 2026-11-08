// Layered parallax for the still pictures: each layer slides a little against the visitor's hand,
// deeper layers further, eased with GSAP so it settles like dust. Pictures inside a frame are
// enlarged a touch so their edges never show. Under reduced motion nothing moves.

import gsap from "gsap";
import { useEffect, useRef } from "react";

import { prefersReducedMotion } from "../motion";
import { onHand } from "./pointer";

// `depth` is how far the layer travels at the window's edge, in px; negative moves with the hand.
// `zoom` enlarges a picture inside its frame so the slide never shows an edge.
export function useDrift<T extends HTMLElement>(depth: number, zoom = 1): React.RefObject<T | null> {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (el === null || prefersReducedMotion()) return;
    if (zoom !== 1) gsap.set(el, { scale: zoom });
    const x = gsap.quickTo(el, "x", { duration: 1.4, ease: "power3.out" });
    const y = gsap.quickTo(el, "y", { duration: 1.4, ease: "power3.out" });
    const off = onHand((hand) => {
      x(hand.live ? -hand.x * depth : 0);
      y(hand.live ? -hand.y * depth * 0.6 : 0);
    });
    return () => {
      off();
      gsap.killTweensOf(el);
      gsap.set(el, { clearProps: "transform" });
    };
  }, [depth, zoom]);
  return ref;
}
