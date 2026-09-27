// テストで共通に使う確認処理。
import { expect } from 'vitest';
import { isAtMost2Decimals, toSci } from '../src/core/numbers';
import type { Question } from '../src/core/types';
import { MISTAKES } from '../src/questions/mistakes';

/** 答えの桁数ルール：整数か小数第2位まで（粒子数は a×10ⁿ の a が小数第2位まで） */
export function expectAnswerDigits(q: Question): void {
  expect(q.answer).toBeGreaterThan(0);
  if (q.scientific) {
    const { coef } = toSci(q.answer);
    expect(coef).toBeGreaterThanOrEqual(1);
    expect(coef).toBeLessThan(10);
    expect(isAtMost2Decimals(coef), `係数 ${coef}（${q.text}）`).toBe(true);
  } else {
    expect(isAtMost2Decimals(q.answer), `答え ${q.answer}（${q.text}）`).toBe(true);
    // 1000以上の正解は整数（表示で丸めても正解が変わらないように）
    if (q.answer >= 1000) expect(Number.isInteger(q.answer), `答え ${q.answer}`).toBe(true);
  }
}

/** 4択の形：4つ・重複なし・正解がちょうど1つ・誤答にはミスの型が付いている */
export function expectValidChoices(q: Question): void {
  expect(q.choices).toHaveLength(4);
  const texts = q.choices.map((c) => c.text);
  expect(new Set(texts).size, `選択肢が重複：${texts.join(' / ')}（${q.text}）`).toBe(4);
  const values = q.choices.map((c) => c.value);
  expect(values.every((v) => Number.isFinite(v) && v > 0)).toBe(true);

  const correct = q.choices.filter((c) => c.correct);
  expect(correct).toHaveLength(1);
  expect(correct[0].value).toBe(q.answer);

  for (const c of q.choices.filter((x) => !x.correct)) {
    expect(c.mistake, `誤答 ${c.text} にミスの型がない`).toBeDefined();
    expect(MISTAKES[c.mistake!]).toBeDefined();
  }
}

/** 問題文・解説に計算の失敗（NaN など）が混ざっていない */
export function expectCleanText(q: Question): void {
  for (const s of [q.text, q.explanation]) {
    expect(s).not.toMatch(/NaN|undefined|Infinity|null/);
  }
}

export function expectCommon(q: Question): void {
  expectAnswerDigits(q);
  expectValidChoices(q);
  expectCleanText(q);
}

/** 1パターンあたりの生成回数 */
export const RUNS = 1000;
