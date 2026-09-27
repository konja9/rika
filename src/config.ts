// ★ ゲームの数値設定はすべてこのファイルにまとめている。
// 当たりやすさ・出玉・確変などを調整したいときは、ここの数字だけを変えればよい。
// （確率は 0〜1 の小数で書く。0.06 = 6%）

import type { Difficulty } from './core/types';

/** 保留の色（期待度の低い順） */
export const HOLD_COLORS = ['white', 'blue', 'green', 'red', 'gold'] as const;
export type HoldColor = (typeof HOLD_COLORS)[number];

/** 保留の色の日本語名 */
export const HOLD_COLOR_NAMES: Record<HoldColor, string> = {
  white: '白',
  blue: '青',
  green: '緑',
  red: '赤',
  gold: '金',
};

export const CONFIG = {
  /** 保留の最大数 */
  maxHolds: 4,

  /** 保留の色を決める「難度点」（★1=0, ★2=1, ★3=2） */
  difficultyPoints: { 1: 0, 2: 1, 3: 2 } as Record<Difficulty, number>,

  /** 速さの基準時間（秒）。難度ごと */
  baseTimeSec: { 1: 20, 2: 30, 3: 45 } as Record<Difficulty, number>,

  /** 数値入力のときは基準時間をこの倍率でのばす */
  numericTimeFactor: 1.5,

  /** 速さ点：基準時間の「この割合以内」なら2点 */
  fastRatio: 0.5,

  /**
   * 当選確率（保留の色ごと）
   * 合計点 0=白 1=青 2=緑 3=赤 4=金
   */
  hitRate: {
    normal: { white: 0.06, blue: 0.1, green: 0.15, red: 0.25, gold: 0.4 },
    kakuhen: { white: 0.15, blue: 0.22, green: 0.3, red: 0.45, gold: 0.65 },
  } as Record<'normal' | 'kakuhen', Record<HoldColor, number>>,

  /** 大当たりの出玉 */
  payout: { normal: 1000, kakuhen: 1500 },

  /** 大当たりのとき確変になる確率 */
  kakuhenRate: 0.5,

  /** 確変が続く問題数（正解も誤答も1問と数える） */
  kakuhenQuestions: 8,

  /** 確変中の難度の上がり幅（上限は★3） */
  kakuhenDifficultyUp: 1,

  /** リーチ演出（当否が決まった後に選ぶ見た目だけの抽選） */
  reach: {
    /** 当たりのときリーチになる確率 */
    onHit: 1.0,
    /** 当たりリーチのうちスーパーリーチになる確率 */
    superOnHit: 0.7,
    /** ハズレのときリーチになる確率 */
    onMiss: 0.15,
    /** ハズレリーチのうちスーパーリーチになる確率 */
    superOnMiss: 0.2,
  },

  /** 苦手の出し分け */
  weakness: {
    /** 直近何回の回答を見るか */
    recentWindow: 30,
    /** ミス1回あたりに増やす出題比率 */
    perMistake: 0.25,
    /** 出題比率の上限（2 = 最大2倍） */
    maxFactor: 2,
  },

  /** 演出の長さ（ミリ秒） */
  timing: {
    spinNoReach: 2200,
    spinNormalReach: 4500,
    spinSuperReach: 8000,
  },
} as const;
