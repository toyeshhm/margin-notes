// Where the visitor's hand is, for the art: the mouse or a finger across the window, or the phone's
// tilt, as x and y from -1 to 1 (0 is the middle). One set of window listeners feeds every picture.
// Under reduced motion nothing listens and the art stays still.

import { log } from "../log";
import { prefersReducedMotion } from "../motion";

export interface Hand {
  x: number;
  y: number;
  // False until the visitor has moved the mouse, touched the art or tilted the phone.
  live: boolean;
}

type Listener = (hand: Hand) => void;

const listeners = new Set<Listener>();
const hand: Hand = { x: 0, y: 0, live: false };
let tiltBase: { beta: number; gamma: number } | undefined;
let detach: (() => void) | undefined;

const clamp = (v: number): number => Math.max(-1, Math.min(1, v));

function emit(): void {
  for (const l of listeners) l(hand);
}

function onPointer(e: PointerEvent): void {
  hand.x = clamp((e.clientX / window.innerWidth) * 2 - 1);
  hand.y = clamp((e.clientY / window.innerHeight) * 2 - 1);
  hand.live = true;
  emit();
}

function onLeave(e: PointerEvent): void {
  if (e.pointerType !== "mouse") return;
  hand.live = false;
  emit();
}

function onTilt(e: DeviceOrientationEvent): void {
  if (e.beta === null || e.gamma === null) return;
  // However the phone is held, the first reading is the middle; 25 degrees either way is the end.
  tiltBase ??= { beta: e.beta, gamma: e.gamma };
  hand.x = clamp((e.gamma - tiltBase.gamma) / 25);
  hand.y = clamp((e.beta - tiltBase.beta) / 25);
  hand.live = true;
  emit();
}

function attach(): () => void {
  const leave = (e: PointerEvent): void => {
    if (e.relatedTarget === null) onLeave(e);
  };
  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("pointerdown", onPointer, { passive: true });
  document.documentElement.addEventListener("pointerleave", leave);
  window.addEventListener("deviceorientation", onTilt, { passive: true });
  return () => {
    window.removeEventListener("pointermove", onPointer);
    window.removeEventListener("pointerdown", onPointer);
    document.documentElement.removeEventListener("pointerleave", leave);
    window.removeEventListener("deviceorientation", onTilt);
  };
}

// Calls `listener` with every change of the hand; returns the unsubscribe. Does nothing under
// reduced motion.
export function onHand(listener: Listener): () => void {
  if (prefersReducedMotion()) return () => undefined;
  listeners.add(listener);
  detach ??= attach();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      detach?.();
      detach = undefined;
    }
  };
}

interface OrientationPermission {
  requestPermission?: () => Promise<"granted" | "denied">;
}

// iPhones share the tilt only after a tap asks for it: the art asks when it is tapped.
export function askForTilt(): void {
  const ask = (window.DeviceOrientationEvent as unknown as OrientationPermission | undefined)?.requestPermission;
  if (ask === undefined || prefersReducedMotion()) return;
  ask().then(
    (answer) => {
      if (answer === "denied") log("info", "tilt not shared", {});
    },
    (error: unknown) => {
      log("warn", "tilt permission failed", { error: String(error) });
    },
  );
}
