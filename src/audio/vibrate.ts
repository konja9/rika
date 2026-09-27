// 振動（対応している端末だけ。iPhoneのSafariは振動に対応していない）

/** この端末で振動が使えるか */
export const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

let enabled = true;

export function setVibration(on: boolean): void {
  enabled = on;
}

/** 振動のパターン（数字は「振動する・止まる」をくり返すミリ秒） */
export const VIBES = {
  correct: [25],
  wrong: [40, 60, 40],
  reach: [30, 40, 30],
  bigHit: [120, 60, 120, 60, 300],
  kakuhen: [200, 100, 200, 100, 400],
} as const;

export function vibrate(pattern: readonly number[]): void {
  if (!enabled || !canVibrate) return;
  try {
    navigator.vibrate([...pattern]);
  } catch {
    // 振動できなくてもゲームは続ける
  }
}
