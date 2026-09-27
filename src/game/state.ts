// ゲームの進行状態（保留・確変・出玉）を管理する。画面は持たない。

import { CONFIG, type HoldColor } from '../config';
import type { Rng } from '../core/random';
import type { Difficulty } from '../core/types';
import { drawSpin, type Hold, type Mode, type SpinResult } from './lottery';

export interface GameState {
  mode: Mode;
  /** 確変の残り問題数 */
  kakuhenLeft: number;
  /** 抽選待ちの保留（先頭から順に抽選する） */
  holds: Hold[];
  /** 出玉の合計 */
  balls: number;
  /** 抽選した回数 */
  spins: number;
  /** 大当たりの回数 */
  bigHits: number;
  /** 確変当たりの回数 */
  kakuhenHits: number;
  /** 今の連チャン数 */
  chain: number;
  /** 最高連チャン数 */
  maxChain: number;
}

export function newGameState(): GameState {
  return {
    mode: 'normal',
    kakuhenLeft: 0,
    holds: [],
    balls: 0,
    spins: 0,
    bigHits: 0,
    kakuhenHits: 0,
    chain: 0,
    maxChain: 0,
  };
}

/** 今出す問題の難度（確変中は1つ上、上限★3） */
export function currentDifficulty(state: GameState, chosen: Difficulty): Difficulty {
  if (state.mode !== 'kakuhen') return chosen;
  return Math.min(3, chosen + CONFIG.kakuhenDifficultyUp) as Difficulty;
}

/** 数値入力で答える状態か（確変中） */
export function isNumericMode(state: GameState): boolean {
  return state.mode === 'kakuhen';
}

export interface AnswerOutcome {
  /** 保留が増えたか */
  holdAdded: boolean;
  /** 保留が満タンで増えなかったか */
  holdFull: boolean;
  /** この回答で確変が終わったか */
  kakuhenEnded: boolean;
}

/**
 * 回答を反映する。
 * 正解なら保留を1つ足す（満タンなら足さない）。
 * 確変中は正誤にかかわらず残り問題数を1つ減らし、0になったら通常にもどす。
 */
export function recordAnswer(state: GameState, correct: boolean, color: HoldColor | null): AnswerOutcome {
  let holdAdded = false;
  let holdFull = false;
  if (correct && color) {
    if (state.holds.length < CONFIG.maxHolds) {
      state.holds.push({ color, mode: state.mode });
      holdAdded = true;
    } else {
      holdFull = true;
    }
  }
  let kakuhenEnded = false;
  if (state.mode === 'kakuhen') {
    state.kakuhenLeft -= 1;
    if (state.kakuhenLeft <= 0) {
      state.mode = 'normal';
      state.kakuhenLeft = 0;
      kakuhenEnded = true;
    }
  }
  return { holdAdded, holdFull, kakuhenEnded };
}

/** 先頭の保留を取り出して抽選する（保留がなければ null） */
export function takeSpin(state: GameState, rng: Rng): SpinResult | null {
  const hold = state.holds.shift();
  if (!hold) return null;
  state.spins += 1;
  return drawSpin(hold, rng);
}

/** 抽選結果（演出が終わった後）を反映する */
export function applySpin(state: GameState, result: SpinResult): void {
  if (!result.hit) return;
  state.balls += result.payout;
  state.bigHits += 1;
  // 確変中に獲得した保留での当たりなら連チャンが続く
  state.chain = result.hold.mode === 'kakuhen' ? state.chain + 1 : 1;
  state.maxChain = Math.max(state.maxChain, state.chain);
  if (result.kakuhen) {
    state.kakuhenHits += 1;
    state.mode = 'kakuhen';
    state.kakuhenLeft = CONFIG.kakuhenQuestions;
  } else {
    state.mode = 'normal';
    state.kakuhenLeft = 0;
  }
}
