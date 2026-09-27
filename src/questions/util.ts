// 生成関数で共通に使う小さな道具。

import { formatNumber } from '../core/numbers';

/**
 * 条件に合う問題ができるまで作り直す。
 * make が null を返したら「条件に合わなかった」としてやり直す。
 */
export function retry<T>(make: () => T | null, tries = 2000): T {
  for (let i = 0; i < tries; i++) {
    const result = make();
    if (result !== null) return result;
  }
  throw new Error('条件に合う問題を作れませんでした');
}

/** 問題文・解説に数値を書くときの形 */
export function n(x: number, scientific = false): string {
  return formatNumber(x, scientific);
}
