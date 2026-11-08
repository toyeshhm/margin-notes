// Which words changed between two versions of a sentence: a longest-common-subsequence over words,
// compared without case or punctuation. Returns the new text as runs of kept and changed words.

export interface Run {
  text: string;
  changed: boolean;
}

const key = (w: string): string => w.toLowerCase().replace(/[^a-z0-9']/g, "");

export function changedWords(before: string, after: string): Run[] {
  const a = before.split(/\s+/).filter((w) => w !== "");
  const b = after.split(/\s+/).filter((w) => w !== "");
  const n = a.length;
  const m = b.length;
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const row = table[i];
      if (row === undefined) continue;
      row[j] = key(a[i] ?? "") === key(b[j] ?? "") ? (table[i + 1]?.[j + 1] ?? 0) + 1 : Math.max(table[i + 1]?.[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  const kept = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (key(a[i] ?? "") === key(b[j] ?? "")) {
      kept.add(j);
      i++;
      j++;
    } else if ((table[i + 1]?.[j] ?? 0) >= (table[i]?.[j + 1] ?? 0)) i++;
    else j++;
  }
  const runs: Run[] = [];
  b.forEach((w, k) => {
    const changed = !kept.has(k);
    const last = runs[runs.length - 1];
    if (last?.changed === changed) last.text += ` ${w}`;
    else runs.push({ text: w, changed });
  });
  return runs;
}
