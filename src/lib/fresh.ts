// The photos of a scan that just finished, kept in memory only, so the essay can open with them
// turning into its typed pages. Never saved: a reload shows the typed pages straight away.

let fresh: { id: string; photos: string[] } | undefined;

export function setFresh(value: { id: string; photos: string[] }): void {
  fresh = value;
}

// Hand over the photos once; a second visit to the essay opens without the reveal.
export function takeFresh(id: string): string[] | undefined {
  if (fresh?.id !== id) return undefined;
  const photos = fresh.photos;
  fresh = undefined;
  return photos;
}
