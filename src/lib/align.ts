// Lining up two drafts in order. Given how alike each old sentence is to each new one
// (and to pairs of neighbours), find the in-order matching with the highest total, where one
// old sentence may pair with two new ones (a split), two old with one new (a merge), or none
// (cut or added). Dynamic programming over the two sentence lists.

export interface Similarity {
  // one[i][j]: old i with new j. split[i][j]: old i with new j and j+1 joined.
  // merge[i][j]: old i and i+1 joined with new j.
  one: number[][];
  split: number[][];
  merge: number[][];
}

// A pair below this likeness scores less than leaving both unmatched.
export const THRESHOLD = 0.5;
// Joining sentences must beat a plain pair by a little, so equal scores keep the simpler match.
const JOIN_COST = 0.03;

// For each old sentence, the indexes of the new sentences it lines up with (empty when cut).
export function align(sim: Similarity, oldCount: number, newCount: number): number[][] {
  const at = (m: number[][], i: number, j: number): number => m[i]?.[j] ?? 0;
  const best: number[][] = Array.from({ length: oldCount + 1 }, () => new Array<number>(newCount + 1).fill(0));
  const step: string[][] = Array.from({ length: oldCount + 1 }, () => new Array<string>(newCount + 1).fill(""));
  const get = (i: number, j: number): number => best[i]?.[j] ?? Number.NEGATIVE_INFINITY;
  for (let i = 0; i <= oldCount; i++) {
    for (let j = 0; j <= newCount; j++) {
      if (i === 0 && j === 0) continue;
      const options: [number, string][] = [];
      if (i > 0) options.push([get(i - 1, j), "cut"]);
      if (j > 0) options.push([get(i, j - 1), "add"]);
      if (i > 0 && j > 0) options.push([get(i - 1, j - 1) + at(sim.one, i - 1, j - 1) - THRESHOLD, "one"]);
      if (i > 0 && j > 1) options.push([get(i - 1, j - 2) + at(sim.split, i - 1, j - 2) - THRESHOLD - JOIN_COST, "split"]);
      if (i > 1 && j > 0) options.push([get(i - 2, j - 1) + at(sim.merge, i - 2, j - 1) - THRESHOLD - JOIN_COST, "merge"]);
      let [score, how] = options[0] ?? [0, ""];
      for (const [s, h] of options) {
        if (s > score) [score, how] = [s, h];
      }
      const row = best[i];
      const steps = step[i];
      if (row !== undefined && steps !== undefined) {
        row[j] = score;
        steps[j] = how;
      }
    }
  }
  const out: number[][] = Array.from({ length: oldCount }, () => []);
  let i = oldCount;
  let j = newCount;
  while (i > 0 || j > 0) {
    const how = step[i]?.[j] ?? "";
    if (how === "one") {
      out[i - 1]?.push(j - 1);
      i -= 1;
      j -= 1;
    } else if (how === "split") {
      out[i - 1]?.push(j - 2, j - 1);
      i -= 1;
      j -= 2;
    } else if (how === "merge") {
      out[i - 2]?.push(j - 1);
      out[i - 1]?.push(j - 1);
      i -= 2;
      j -= 1;
    } else if (how === "cut") i -= 1;
    else j -= 1;
  }
  return out;
}

export function cosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let k = 0; k < a.length; k++) {
    const x = a[k] ?? 0;
    const y = b[k] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}
