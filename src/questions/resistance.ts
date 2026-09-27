// ジャンル2：合成抵抗
//   ★1：2個の直列・並列
//   ★2：3個の直列・並列
//   ★3：直列と並列の組み合わせ（3個）
// 答えが整数か小数第2位までに収まる抵抗の組み合わせだけを使う。

import { clean, isNiceAnswer, nearlyEqual } from '../core/numbers';
import { pick, type Rng } from '../core/random';
import type { Circuit, PatternDef, QuestionDraft, WrongAnswer } from '../core/types';
import { n, retry } from './util';

const SUB = ['₁', '₂', '₃'];

/** 直列の合成抵抗 */
const series = (...rs: number[]) => clean(rs.reduce((a, b) => a + b, 0));
/** 並列の合成抵抗 */
const parallel = (...rs: number[]) => clean(1 / rs.reduce((a, b) => a + 1 / b, 0));
/** 逆数の和（並列で逆数を取り忘れたときの値） */
const recipSum = (...rs: number[]) => clean(rs.reduce((a, b) => a + 1 / b, 0));

function R(i: number, ohm: number): Circuit {
  return { kind: 'R', name: `R${SUB[i]}`, ohm };
}

function draft(
  pattern: string,
  rs: number[],
  circuit: Circuit,
  text: string,
  answer: number,
  wrongs: WrongAnswer[],
  explanation: string,
): QuestionDraft {
  const given = rs.map((r, i) => `R${SUB[i]} = ${n(r)} Ω`).join('、');
  return {
    pattern,
    text: `${text}\n（${given}）`,
    unit: 'Ω',
    answer,
    scientific: false,
    wrongs,
    explanation,
    params: { resistors: rs },
    circuit,
  };
}

/** 抵抗の値を選ぶ */
function pickRs(rng: Rng, list: number[], count: number): number[] {
  return Array.from({ length: count }, () => pick(rng, list));
}

const LIST1 = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 24, 30, 40, 60];
const LIST2 = [2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 18, 20, 24, 30, 36, 40, 60];

// ---------- ★1 ----------

function series2(rng: Rng): QuestionDraft {
  const [a, b] = pickRs(rng, LIST1, 2);
  const ans = series(a, b);
  return draft(
    'series2',
    [a, b],
    { kind: 'series', parts: [R(0, a), R(1, b)] },
    '2つの抵抗 R₁、R₂ を直列につないだ。合成抵抗は何 Ω か。',
    ans,
    [
      { value: parallel(a, b), mistake: 'seriesParallelSwap' },
      { value: recipSum(a, b), mistake: 'parallelNoReciprocal' },
      { value: a * b, mistake: 'other' },
    ],
    `直列は足し算：R = R₁ + R₂ = ${n(a)} + ${n(b)} = ${n(ans)} Ω`,
  );
}

function parallel2(rng: Rng): QuestionDraft {
  return retry(() => {
    const [a, b] = pickRs(rng, LIST1, 2);
    const ans = parallel(a, b);
    // 逆数を取り忘れても同じ答えになる組み合わせ（2Ωと2Ωなど）は使わない
    if (!isNiceAnswer(ans) || nearlyEqual(recipSum(a, b), ans)) return null;
    return draft(
      'parallel2',
      [a, b],
      { kind: 'parallel', parts: [R(0, a), R(1, b)] },
      '2つの抵抗 R₁、R₂ を並列につないだ。合成抵抗は何 Ω か。',
      ans,
      [
        { value: recipSum(a, b), mistake: 'parallelNoReciprocal' },
        { value: series(a, b), mistake: 'seriesParallelSwap' },
        { value: (a + b) / 2, mistake: 'other' },
      ],
      `並列は逆数の和：1/R = 1/${n(a)} + 1/${n(b)}\nR = ${n(a)}×${n(b)} ÷ (${n(a)}+${n(b)}) = ${n(ans)} Ω`,
    );
  });
}

// ---------- ★2 ----------

function series3(rng: Rng): QuestionDraft {
  const [a, b, c] = pickRs(rng, LIST2, 3);
  const ans = series(a, b, c);
  return draft(
    'series3',
    [a, b, c],
    { kind: 'series', parts: [R(0, a), R(1, b), R(2, c)] },
    '3つの抵抗 R₁、R₂、R₃ を直列につないだ。合成抵抗は何 Ω か。',
    ans,
    [
      { value: parallel(a, b, c), mistake: 'seriesParallelSwap' },
      { value: recipSum(a, b, c), mistake: 'parallelNoReciprocal' },
      { value: series(a, b), mistake: 'other' },
    ],
    `直列は足し算：R = ${n(a)} + ${n(b)} + ${n(c)} = ${n(ans)} Ω`,
  );
}

function parallel3(rng: Rng): QuestionDraft {
  return retry(() => {
    const [a, b, c] = pickRs(rng, LIST2, 3);
    const ans = parallel(a, b, c);
    if (!isNiceAnswer(ans) || nearlyEqual(recipSum(a, b, c), ans)) return null;
    return draft(
      'parallel3',
      [a, b, c],
      { kind: 'parallel', parts: [R(0, a), R(1, b), R(2, c)] },
      '3つの抵抗 R₁、R₂、R₃ を並列につないだ。合成抵抗は何 Ω か。',
      ans,
      [
        { value: recipSum(a, b, c), mistake: 'parallelNoReciprocal' },
        { value: (a * b * c) / (a + b + c), mistake: 'formulaInvert' },
        { value: series(a, b, c), mistake: 'seriesParallelSwap' },
      ],
      `1/R = 1/${n(a)} + 1/${n(b)} + 1/${n(c)} = ${n(recipSum(a, b, c))}\nR = 1 ÷ ${n(recipSum(a, b, c))} = ${n(ans)} Ω\n（「積÷和」は2個のときだけ使える）`,
    );
  });
}

// ---------- ★3：組み合わせ ----------

/** R₁ に「R₂ と R₃ の並列」を直列につなぐ */
function seriesWithParallel(rng: Rng): QuestionDraft {
  return retry(() => {
    const [a, b, c] = pickRs(rng, LIST2, 3);
    const p = parallel(b, c);
    const ans = series(a, p);
    if (!isNiceAnswer(ans)) return null;
    return draft(
      'seriesWithParallel',
      [a, b, c],
      { kind: 'series', parts: [R(0, a), { kind: 'parallel', parts: [R(1, b), R(2, c)] }] },
      'R₂ と R₃ を並列につないだ部分に、R₁ を直列につないだ。全体の合成抵抗は何 Ω か。',
      ans,
      [
        { value: series(a, recipSum(b, c)), mistake: 'parallelNoReciprocal' },
        { value: parallel(series(a, b), c), mistake: 'combinationOrder' },
        { value: series(a, b, c), mistake: 'seriesParallelSwap' },
        { value: parallel(a, b, c), mistake: 'seriesParallelSwap' },
      ],
      `並列部分：${n(b)}×${n(c)} ÷ (${n(b)}+${n(c)}) = ${n(p)} Ω\n全体：${n(a)} + ${n(p)} = ${n(ans)} Ω`,
    );
  });
}

/** 「R₁ と R₂ の直列」に R₃ を並列につなぐ */
function parallelWithSeries(rng: Rng): QuestionDraft {
  return retry(() => {
    const [a, b, c] = pickRs(rng, LIST2, 3);
    const s = series(a, b);
    const ans = parallel(s, c);
    if (!isNiceAnswer(ans)) return null;
    return draft(
      'parallelWithSeries',
      [a, b, c],
      { kind: 'parallel', parts: [{ kind: 'series', parts: [R(0, a), R(1, b)] }, R(2, c)] },
      'R₁ と R₂ を直列につないだ部分に、R₃ を並列につないだ。全体の合成抵抗は何 Ω か。',
      ans,
      [
        { value: recipSum(s, c), mistake: 'parallelNoReciprocal' },
        { value: series(a, parallel(b, c)), mistake: 'combinationOrder' },
        { value: series(a, b, c), mistake: 'seriesParallelSwap' },
        { value: parallel(a, b, c), mistake: 'seriesParallelSwap' },
      ],
      `直列部分：${n(a)} + ${n(b)} = ${n(s)} Ω\n全体：${n(s)}×${n(c)} ÷ (${n(s)}+${n(c)}) = ${n(ans)} Ω`,
    );
  });
}

export const RESISTANCE_PATTERNS: PatternDef[] = [
  { id: 'series2', genre: 'resistance', difficulty: 1, mistakes: ['seriesParallelSwap'], make: series2 },
  {
    id: 'parallel2', genre: 'resistance', difficulty: 1,
    mistakes: ['parallelNoReciprocal', 'seriesParallelSwap'], make: parallel2,
  },
  { id: 'series3', genre: 'resistance', difficulty: 2, mistakes: ['seriesParallelSwap'], make: series3 },
  {
    id: 'parallel3', genre: 'resistance', difficulty: 2,
    mistakes: ['parallelNoReciprocal', 'formulaInvert', 'seriesParallelSwap'], make: parallel3,
  },
  {
    id: 'seriesWithParallel', genre: 'resistance', difficulty: 3,
    mistakes: ['parallelNoReciprocal', 'combinationOrder', 'seriesParallelSwap'], make: seriesWithParallel,
  },
  {
    id: 'parallelWithSeries', genre: 'resistance', difficulty: 3,
    mistakes: ['parallelNoReciprocal', 'combinationOrder', 'seriesParallelSwap'], make: parallelWithSeries,
  },
];
