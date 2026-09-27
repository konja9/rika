// 保留の色の判定と、抽選（当たり・ハズレ、確変、リーチ演出、図柄）。
// ここは画面を持たないので、テストで大量にまわして確率を確かめられる。

import { CONFIG, HOLD_COLORS, type HoldColor } from '../config';
import { chance, pick, randInt, type Rng } from '../core/random';
import type { Difficulty } from '../core/types';

/** 通常時か確変中か */
export type Mode = 'normal' | 'kakuhen';

/** 保留1つ分。獲得したときの状態（通常/確変）と色を覚えておく */
export interface Hold {
  color: HoldColor;
  mode: Mode;
}

export type Reach = 'none' | 'normal' | 'super';

/** 抽選1回分の結果 */
export interface SpinResult {
  hit: boolean;
  /** 当たりのとき、確変になるか */
  kakuhen: boolean;
  reach: Reach;
  /** 図柄 [左, 中, 右]（1〜9）。奇数そろい＝確変、偶数そろい＝通常 */
  reels: [number, number, number];
  /** 獲得出玉（ハズレは0） */
  payout: number;
  /** 抽選した保留 */
  hold: Hold;
}

/**
 * 保留の色を決める。
 * 難度点（★1=0, ★2=1, ★3=2）＋速さ点（基準の半分以内=2、基準以内=1、それより遅い=0）
 */
export function holdColor(difficulty: Difficulty, elapsedSec: number, numeric: boolean): HoldColor {
  const base = CONFIG.baseTimeSec[difficulty] * (numeric ? CONFIG.numericTimeFactor : 1);
  const speed = elapsedSec <= base * CONFIG.fastRatio ? 2 : elapsedSec <= base ? 1 : 0;
  const points = CONFIG.difficultyPoints[difficulty] + speed;
  return HOLD_COLORS[Math.min(points, HOLD_COLORS.length - 1)];
}

/**
 * 色メーター用：いま答えたときの色と、次に色が下がるまでの残りの割合（1→0）。
 * これ以上下がらないときは ratio が null。
 */
export function holdColorMeter(
  difficulty: Difficulty,
  elapsedSec: number,
  numeric: boolean,
): { color: HoldColor; ratio: number | null } {
  const base = CONFIG.baseTimeSec[difficulty] * (numeric ? CONFIG.numericTimeFactor : 1);
  const fast = base * CONFIG.fastRatio;
  const color = holdColor(difficulty, elapsedSec, numeric);
  if (elapsedSec <= fast) return { color, ratio: (fast - elapsedSec) / fast };
  if (elapsedSec <= base) return { color, ratio: (base - elapsedSec) / (base - fast) };
  return { color, ratio: null };
}

/** その保留の当選確率 */
export function hitRateOf(hold: Hold): number {
  return CONFIG.hitRate[hold.mode][hold.color];
}

const KAKUHEN_SYMBOLS = [1, 3, 5, 7, 9];
const NORMAL_SYMBOLS = [2, 4, 6, 8];

/** 保留1つを抽選する */
export function drawSpin(hold: Hold, rng: Rng): SpinResult {
  // 1. 当たりかハズレか（ここだけが本当の抽選）
  const hit = chance(rng, hitRateOf(hold));
  // 2. 当たりなら確変かどうか
  const kakuhen = hit && chance(rng, CONFIG.kakuhenRate);

  // 3. リーチ演出（結果が決まった後の見た目だけ）
  let reach: Reach = 'none';
  const r = CONFIG.reach;
  if (hit ? chance(rng, r.onHit) : chance(rng, r.onMiss)) {
    reach = chance(rng, hit ? r.superOnHit : r.superOnMiss) ? 'super' : 'normal';
  }

  // 4. 図柄
  let reels: [number, number, number];
  if (hit) {
    const s = pick(rng, kakuhen ? KAKUHEN_SYMBOLS : NORMAL_SYMBOLS);
    reels = [s, s, s];
  } else if (reach !== 'none') {
    const s = randInt(rng, 1, 9);
    // 真ん中だけ1つずれる
    const center = ((s - 1 + (chance(rng, 0.5) ? 1 : 8)) % 9) + 1;
    reels = [s, center, s];
  } else {
    const left = randInt(rng, 1, 9);
    const right = ((left - 1 + randInt(rng, 1, 8)) % 9) + 1; // 左とちがう数
    reels = [left, randInt(rng, 1, 9), right];
  }

  const payout = hit ? CONFIG.payout[hold.mode] : 0;
  return { hit, kakuhen, reach, reels, payout, hold };
}
