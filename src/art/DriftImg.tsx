// A still picture that slides against the visitor's hand inside its frame (see drift.ts).

import { useDrift } from "./drift";

export function DriftImg({ src, depth, zoom = 1.1, lazy = false }: { src: string; depth: number; zoom?: number; lazy?: boolean }): React.JSX.Element {
  const ref = useDrift<HTMLImageElement>(depth, zoom);
  return <img ref={ref} src={src} alt="" {...(lazy && { loading: "lazy" as const })} />;
}
