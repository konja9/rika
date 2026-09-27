// オームの法則の生成関数のテスト
import { describe, expect, it } from 'vitest';
import { nearlyEqual } from '../src/core/numbers';
import { createRng } from '../src/core/random';
import type { Question } from '../src/core/types';
import { makeQuestion } from '../src/questions/index';
import { OHM_PATTERNS, type OhmParams } from '../src/questions/ohm';
import { expectCommon, RUNS } from './helpers';

/** 元データから正解を計算し直す（生成関数とは別の書き方で） */
function expectedAnswer(p: OhmParams): number {
  const base = { V: p.V, I: p.I, R: p.R }[p.find];
  const scale: Record<OhmParams['unit'], number> = { V: 1, A: 1, mA: 1000, 'Ω': 1, 'kΩ': 0.001 };
  return base * scale[p.unit];
}

describe('オームの法則', () => {
  it('★1〜★3のパターンがそろっている', () => {
    for (const d of [1, 2, 3]) {
      expect(OHM_PATTERNS.filter((p) => p.difficulty === d).length).toBeGreaterThanOrEqual(3);
    }
  });

  for (const pattern of OHM_PATTERNS) {
    it(`★${pattern.difficulty} ${pattern.id}：${RUNS}回生成して正解・選択肢・桁数を確認`, () => {
      const rng = createRng(1000 + pattern.id.length * 7 + pattern.difficulty);
      for (let i = 0; i < RUNS; i++) {
        const q: Question = makeQuestion(pattern, rng);
        const p = q.params as unknown as OhmParams;
        // V = I × R が成り立っている
        expect(nearlyEqual(p.V, p.I * p.R, 1e-9), `V=${p.V} I=${p.I} R=${p.R}`).toBe(true);
        // 答えがたずねた量・単位になっている
        expect(nearlyEqual(q.answer, expectedAnswer(p), 1e-9), q.text).toBe(true);
        expect(q.unit).toBe(p.unit);
        expectCommon(q);
      }
    });
  }

  it('★2以上では mA が問題文か単位に出てくる', () => {
    const rng = createRng(7);
    for (const pattern of OHM_PATTERNS.filter((p) => p.difficulty >= 2)) {
      const q = makeQuestion(pattern, rng);
      expect(q.text.includes('mA') || q.unit === 'mA').toBe(true);
    }
  });
});
