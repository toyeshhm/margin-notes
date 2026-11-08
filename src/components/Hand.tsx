import { handSVG, tick, inkSVG, FELT } from "../ink/pen";

// The teacher's words in red pen, as drawn SVG. A Word file's typed comment shows as typed red text.
export function Hand({ words, size = 18, typed = false, write = false, delay = 0, color }: { words: string; size?: number; typed?: boolean; write?: boolean; delay?: number; color?: string }): React.JSX.Element {
  if (typed) return <span className="typed-mark">{words}</span>;
  const { svg } = handSVG(words, { size, write, delay, seed: words.length * 7 + 3, ...(color !== undefined && { color }) });
  return <span className="hand-wrap" dangerouslySetInnerHTML={{ __html: svg }} />;
}

// A green felt-tip tick, written on when `write` is set.
export function Tick({ size = 30, write = false, delay = 0, seed = 11 }: { size?: number; write?: boolean; delay?: number; seed?: number }): React.JSX.Element {
  const pad = 4;
  const g = inkSVG(tick(pad, pad + size * 0.1, size, { seed }), { pen: { ...FELT, size: 3.6 }, color: "var(--color-tick)", write, delay, speed: 260 });
  const box = String(size + pad * 2);
  return <span className="tick" aria-label="Answered" role="img" dangerouslySetInnerHTML={{ __html: `<svg width="${box}" height="${box}" viewBox="0 0 ${box} ${box}" aria-hidden="true">${g.svg}</svg>` }} />;
}
