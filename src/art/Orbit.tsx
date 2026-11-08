// A Gather point cloud that turns with the visitor's hand. The turn was recorded as a row of
// frames in one sheet; the hand's x picks a place in the row, GSAP eases toward it, and the canvas
// blends the two nearest frames. Before anyone moves, the cloud sways slowly on its own. Off screen
// it stops drawing; under reduced motion only the still shows.

import gsap from "gsap";
import { useEffect, useRef } from "react";

import { log } from "../log";
import { prefersReducedMotion } from "../motion";
import { askForTilt, onHand } from "./pointer";

export interface Sheet {
  src: string;
  frames: number;
  cols: number;
  w: number;
  h: number;
}

interface Props {
  className: string;
  // The middle frame, shown at once, while the sheet loads, and under reduced motion.
  still: string;
  large: Sheet;
  // Used on screens under 768 px wide.
  small: Sheet;
  // Which part of a frame stays in view when the box crops it, 0 to 1 on each axis.
  focus?: readonly [number, number];
  // How far the cloud sways on its own before the hand arrives, as a share of the turn.
  sway?: number;
}

const DPR_CAP = 1.5;
const MIDDLE = [0.5, 0.5] as const;

export function Orbit({ className, still, large, small, focus = MIDDLE, sway = 0.28 }: Props): React.JSX.Element {
  const box = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    const el = box.current;
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (reduced || el === null || cv === null || ctx === null || ctx === undefined) return;
    const sheet = window.matchMedia("(max-width: 767px)").matches ? small : large;
    const last = sheet.frames - 1;
    const mid = last / 2;
    const at = { t: mid };
    let image: HTMLImageElement | undefined;
    let drawn = "";
    let visible = false;
    let live = false;
    let handT = mid;
    const start = performance.now();

    const draw = (): void => {
      const pic = image;
      if (pic === undefined) return;
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      const cw = Math.max(1, Math.round(el.clientWidth * dpr));
      const ch = Math.max(1, Math.round(el.clientHeight * dpr));
      const t = Math.max(0, Math.min(last, at.t));
      const key = `${t.toFixed(3)} ${String(cw)} ${String(ch)}`;
      if (key === drawn) return;
      drawn = key;
      if (cv.width !== cw || cv.height !== ch) {
        cv.width = cw;
        cv.height = ch;
      }
      // Cover: the largest part of the frame with the box's shape, placed by `focus`.
      const scale = Math.max(cw / sheet.w, ch / sheet.h);
      const sw = cw / scale;
      const sh = ch / scale;
      const ox = (sheet.w - sw) * focus[0];
      const oy = (sheet.h - sh) * focus[1];
      const i = Math.floor(t);
      const f = t - i;
      const frame = (n: number, alpha: number): void => {
        const col = n % sheet.cols;
        const row = Math.floor(n / sheet.cols);
        ctx.globalAlpha = alpha;
        ctx.drawImage(pic, col * sheet.w + ox, row * sheet.h + oy, sw, sh, 0, 0, cw, ch);
      };
      ctx.clearRect(0, 0, cw, ch);
      frame(i, 1);
      if (f > 0.001 && i < last) frame(i + 1, f);
    };

    const quick = gsap.quickTo(at, "t", { duration: 1.1, ease: "power3.out", onUpdate: draw });

    // While visible and before the hand arrives (or after the mouse leaves the window), the cloud
    // sways slowly, a 9 s breath.
    const tick = (): void => {
      if (live) return;
      const s = Math.sin(((performance.now() - start) / 9000) * Math.PI * 2);
      quick(mid + s * sway * last);
    };
    const show = (on: boolean): void => {
      if (on === visible) return;
      visible = on;
      if (on) {
        gsap.ticker.add(tick);
        if (live) quick(handT);
      } else gsap.ticker.remove(tick);
    };

    const off = onHand((hand) => {
      live = hand.live;
      handT = ((hand.x + 1) / 2) * last;
      if (live && visible) quick(handT);
    });
    const seen = new IntersectionObserver((entries) => {
      for (const e of entries) show(e.isIntersecting);
    });
    const sized = new ResizeObserver(() => {
      drawn = "";
      draw();
    });

    const img = new Image();
    img.decoding = "async";
    img.src = sheet.src;
    let gone = false;
    img
      .decode()
      .then(() => {
        if (gone) return;
        image = img;
        draw();
        el.dataset["ready"] = "1";
        seen.observe(el);
        sized.observe(el);
      })
      .catch((error: unknown) => {
        // The still stays in place; the picture just doesn't turn.
        log("warn", "orbit sheet did not load", { src: sheet.src, error: String(error) });
      });

    return () => {
      gone = true;
      off();
      seen.disconnect();
      sized.disconnect();
      gsap.ticker.remove(tick);
      gsap.killTweensOf(at);
    };
  }, [reduced, large, small, focus, sway]);

  return (
    <span ref={box} className={`orbit ${className}`} aria-hidden="true" onClick={askForTilt}>
      <img src={still} alt="" style={{ objectPosition: `${String(focus[0] * 100)}% ${String(focus[1] * 100)}%` }} />
      {!reduced && <canvas ref={canvas} />}
    </span>
  );
}
