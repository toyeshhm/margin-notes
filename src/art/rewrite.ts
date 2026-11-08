// Ink that writes itself again when the hand comes over it: bump the key of the drawn mark so its
// pen strokes replay. A mark still being written isn't restarted.

import { useCallback, useRef, useState } from "react";

export function useRewrite(busyFor = 1.2): [number, () => void] {
  const [round, setRound] = useState(0);
  const last = useRef(Number.NEGATIVE_INFINITY);
  const again = useCallback(() => {
    const now = performance.now();
    if (now - last.current < busyFor * 1000) return;
    last.current = now;
    setRound((r) => r + 1);
  }, [busyFor]);
  return [round, again];
}
