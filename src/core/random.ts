// 乱数まわりの道具。
// テストで同じ結果を再現できるように、「シード（種）」から作れる乱数を使う。

/** 0以上1未満の数を返す関数 */
export type Rng = () => number;

/** シードから乱数関数を作る（mulberry32 という軽い方式） */
export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 毎回ちがうシードを作る（ゲーム本番用） */
export function randomSeed(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Math.floor(Math.random() * 2 ** 32);
}

/** min以上max以下の整数 */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** 配列から1つ選ぶ */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

/** 配列を混ぜた新しい配列を返す（元の配列は変えない） */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 重み付きで1つ選ぶ（重みが大きいほど選ばれやすい） */
export function weightedPick<T>(rng: Rng, items: readonly { item: T; weight: number }[]): T {
  const total = items.reduce((sum, x) => sum + x.weight, 0);
  let r = rng() * total;
  for (const x of items) {
    r -= x.weight;
    if (r < 0) return x.item;
  }
  return items[items.length - 1].item;
}

/** 確率 p で true を返す */
export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}
