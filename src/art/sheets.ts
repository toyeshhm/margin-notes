// The recorded turns of the three Gather clouds: each a sheet of frames in reading order, a
// smaller sheet for phones, and which part of a frame stays in view when a box crops it.

import type { Sheet } from "./Orbit";

interface Turn {
  large: Sheet;
  small: Sheet;
  focus: readonly [number, number];
}

// The first sample's page 1, turning about 55 degrees either way so its printed lines stand up.
export const PAGE_TURN: Turn = {
  large: { src: "/assets/turn-page.sheet.webp", frames: 26, cols: 6, w: 640, h: 400 },
  small: { src: "/assets/turn-page.sheet-small.webp", frames: 13, cols: 6, w: 384, h: 240 },
  focus: [0.5, 0.42],
};

// The pencil, eraser and paper clips, settled.
export const PENCIL_TURN: Turn = {
  large: { src: "/assets/turn-pencil.sheet.webp", frames: 22, cols: 6, w: 640, h: 480 },
  small: { src: "/assets/turn-pencil.sheet-small.webp", frames: 11, cols: 6, w: 384, h: 288 },
  focus: [0.5, 0.5],
};

// The same things with their dust blowing off to the right, for the essay's title band.
export const BAND_TURN: Turn = {
  large: { src: "/assets/turn-band.sheet.webp", frames: 20, cols: 4, w: 1000, h: 328 },
  small: { src: "/assets/turn-band.sheet-small.webp", frames: 10, cols: 4, w: 640, h: 210 },
  focus: [0.15, 0.5],
};
