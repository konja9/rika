// モル計算の生成関数のテスト
import { describe, expect, it } from 'vitest';
import { nearlyEqual } from '../src/core/numbers';
import { createRng } from '../src/core/random';
import { makeQuestion } from '../src/questions/index';
import { MOLE_PATTERNS, type Quantity } from '../src/questions/mole';
import { expectCommon, RUNS } from './helpers';

// 生成関数とは別に、テスト側で原子量を持っておく
const MASS: Record<string, number> = {
  H: 1, C: 12, N: 14, O: 16, Na: 23, Mg: 24, S: 32, Cl: 35.5, Ca: 40,
};

interface MoleParams {
  atoms: Record<string, number>;
  formula: string;
  gas: boolean;
  from: Quantity;
  to: Quantity;
  given: number;
}

function perMol(q: Quantity, M: number): number {
  return { mass: M, mol: 1, particles: 6.0e23, volume: 22.4 }[q];
}

describe('モル計算', () => {
  it('★1は1段階、★2は2段階の変換', () => {
    for (const p of MOLE_PATTERNS.filter((x) => x.difficulty === 1)) {
      expect(p.id.includes('Mol') || p.id.startsWith('mol')).toBe(true);
    }
    for (const p of MOLE_PATTERNS.filter((x) => x.difficulty === 2)) {
      expect(p.id.includes('Mol') || p.id.startsWith('mol')).toBe(false);
    }
  });

  for (const pattern of MOLE_PATTERNS) {
    it(`★${pattern.difficulty} ${pattern.id}：${RUNS}回生成して正解・選択肢・桁数を確認`, () => {
      const rng = createRng(3000 + pattern.id.length * 13 + pattern.difficulty);
      for (let i = 0; i < RUNS; i++) {
        const q = makeQuestion(pattern, rng);
        const p = q.params as unknown as MoleParams;
        const M = Object.entries(p.atoms).reduce((s, [el, c]) => s + MASS[el] * c, 0);
        const expected = (p.given / perMol(p.from, M)) * perMol(p.to, M);
        expect(nearlyEqual(q.answer, expected, 1e-9), q.text).toBe(true);
        // 体積の問題は気体だけ
        if (p.from === 'volume' || p.to === 'volume') expect(p.gas).toBe(true);
        // 粒子数を答える問題は a×10ⁿ の形
        expect(q.scientific).toBe(p.to === 'particles');
        expectCommon(q);
      }
    });
  }

  it('分子量の計算ミス（添字の掛け忘れ・原子量のまま）が選択肢に出てくる', () => {
    const rng = createRng(5);
    const seen = new Set<string>();
    for (const p of MOLE_PATTERNS.filter((x) => x.id === 'massToMol' || x.id === 'molToMass')) {
      for (let i = 0; i < 300; i++) {
        for (const c of makeQuestion(p, rng).choices) if (c.mistake) seen.add(c.mistake);
      }
    }
    expect(seen.has('molarSubscript')).toBe(true);
    expect(seen.has('molarAtomic')).toBe(true);
  });
});
