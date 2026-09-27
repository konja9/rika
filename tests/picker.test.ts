// 出題の選び方（苦手の出し分け）と数値入力の答え合わせのテスト
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { createRng } from '../src/core/random';
import { checkNumeric, generateQuestion, patternWeights } from '../src/questions/index';

describe('出題の重み', () => {
  it('記録がなければ均等', () => {
    const w = patternWeights('ohm', 1);
    expect(new Set(w.map((x) => x.weight)).size).toBe(1);
  });

  it('ミックスはジャンルごとの合計が均等', () => {
    const w = patternWeights('mix', 2);
    const sum = (g: string) => w.filter((x) => x.item.genre === g).reduce((s, x) => s + x.weight, 0);
    expect(sum('ohm')).toBeCloseTo(sum('mole'));
    expect(sum('ohm')).toBeCloseTo(sum('resistance'));
  });

  it('苦手なミスの型に関係するパターンは多めになる（上限2倍）', () => {
    const base = patternWeights('resistance', 1);
    const weak = patternWeights('resistance', 1, { parallelNoReciprocal: 2 });
    const wBase = base.find((x) => x.item.id === 'parallel2')!.weight;
    const wWeak = weak.find((x) => x.item.id === 'parallel2')!.weight;
    expect(wWeak / wBase).toBeCloseTo(1 + CONFIG.weakness.perMistake * 2);
    const capped = patternWeights('resistance', 1, { parallelNoReciprocal: 50 });
    expect(capped.find((x) => x.item.id === 'parallel2')!.weight / wBase).toBeCloseTo(CONFIG.weakness.maxFactor);
  });

  it('実際に出題される割合も上がる', () => {
    const count = (counts: Record<string, number>) => {
      const rng = createRng(8);
      let n = 0;
      for (let i = 0; i < 4000; i++) {
        if (generateQuestion({ genre: 'resistance', difficulty: 1, rng, mistakeCounts: counts }).pattern === 'parallel2') n++;
      }
      return n / 4000;
    };
    // ★1の合成抵抗は2パターン。parallel2 だけが「逆数の取り忘れ」に関係する
    const f = Math.min(CONFIG.weakness.maxFactor, 1 + CONFIG.weakness.perMistake * 10);
    expect(count({})).toBeCloseTo(0.5, 1);
    expect(count({ parallelNoReciprocal: 10 })).toBeCloseTo(f / (f + 1), 1);
  });
});

describe('数値入力の答え合わせ', () => {
  const rng = createRng(21);
  const q = generateQuestion({ genre: 'ohm', difficulty: 2, rng });

  it('正解ならOK', () => {
    expect(checkNumeric(q, q.answer)).toEqual({ correct: true });
  });

  it('典型的なミスの値ならその型がわかる', () => {
    const w = q.wrongs[0];
    expect(checkNumeric(q, Number(w.value.toPrecision(3)))).toEqual({ correct: false, mistake: w.mistake });
  });

  it('どれにも当てはまらなければ型は不明', () => {
    expect(checkNumeric(q, 123456789)).toEqual({ correct: false, mistake: null });
    expect(checkNumeric(q, NaN)).toEqual({ correct: false, mistake: null });
  });

  it('粒子数は係数×10ⁿで入力しても判定できる', () => {
    const r = createRng(22);
    for (let i = 0; i < 50; i++) {
      const m = generateQuestion({ genre: 'mole', difficulty: 1, rng: r });
      if (!m.scientific) continue;
      const exp = Math.floor(Math.log10(m.answer));
      const coef = Math.round((m.answer / 10 ** exp) * 100) / 100;
      expect(checkNumeric(m, coef * 10 ** exp).correct).toBe(true);
    }
  });
});
