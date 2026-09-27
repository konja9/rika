// 合成抵抗の生成関数のテスト
import { describe, expect, it } from 'vitest';
import { nearlyEqual } from '../src/core/numbers';
import { createRng } from '../src/core/random';
import type { Circuit } from '../src/core/types';
import { makeQuestion } from '../src/questions/index';
import { RESISTANCE_PATTERNS } from '../src/questions/resistance';
import { expectCommon, RUNS } from './helpers';

/** 回路の形から合成抵抗を計算し直す */
function total(c: Circuit): number {
  if (c.kind === 'R') return c.ohm;
  const values = c.parts.map(total);
  if (c.kind === 'series') return values.reduce((a, b) => a + b, 0);
  return 1 / values.reduce((a, b) => a + 1 / b, 0);
}

function resistorsOf(c: Circuit): number[] {
  return c.kind === 'R' ? [c.ohm] : c.parts.flatMap(resistorsOf);
}

describe('合成抵抗', () => {
  for (const pattern of RESISTANCE_PATTERNS) {
    it(`★${pattern.difficulty} ${pattern.id}：${RUNS}回生成して正解・選択肢・桁数を確認`, () => {
      const rng = createRng(2000 + pattern.id.length * 11 + pattern.difficulty);
      for (let i = 0; i < RUNS; i++) {
        const q = makeQuestion(pattern, rng);
        expect(q.circuit).toBeDefined();
        const rs = (q.params as { resistors: number[] }).resistors;
        // 回路図の抵抗と問題文の抵抗が一致
        expect(resistorsOf(q.circuit!)).toEqual(rs);
        const count = { 1: [2], 2: [3], 3: [3] }[pattern.difficulty];
        expect(count).toContain(rs.length);
        // 回路から計算し直した値と答えが一致
        expect(nearlyEqual(q.answer, total(q.circuit!), 1e-9), q.text).toBe(true);
        expectCommon(q);
      }
    });
  }

  it('★3は直列と並列の両方を含む', () => {
    const rng = createRng(3);
    for (const pattern of RESISTANCE_PATTERNS.filter((p) => p.difficulty === 3)) {
      const c = makeQuestion(pattern, rng).circuit!;
      const kinds = new Set<string>();
      const walk = (x: Circuit) => {
        kinds.add(x.kind);
        if (x.kind !== 'R') x.parts.forEach(walk);
      };
      walk(c);
      expect(kinds.has('series') && kinds.has('parallel')).toBe(true);
    }
  });

  it('並列の問題では「逆数の取り忘れ」の誤答が選択肢に入る', () => {
    const rng = createRng(4);
    const p = RESISTANCE_PATTERNS.find((x) => x.id === 'parallel2')!;
    let seen = 0;
    for (let i = 0; i < 200; i++) {
      if (makeQuestion(p, rng).choices.some((c) => c.mistake === 'parallelNoReciprocal')) seen++;
    }
    expect(seen).toBe(200);
  });
});
