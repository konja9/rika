// ジャンル1：オームの法則（V = I × R）
// 電圧・電流・抵抗のうち2つから残り1つを求める。
//   ★1：A・Ω・V だけ。整数
//   ★2：mA と A の換算あり
//   ★3：mA と kΩ、小数あり
// 答えから逆算して数値を選び、答えが整数か小数第2位までに収まるものだけを使う。

import { clean, isNiceAnswer } from '../core/numbers';
import { pick, type Rng } from '../core/random';
import type { PatternDef, QuestionDraft, WrongAnswer } from '../core/types';
import { n, retry } from './util';

/** テストで使う元データの形 */
export interface OhmParams {
  find: 'V' | 'I' | 'R';
  /** 電圧 [V] */
  V: number;
  /** 電流 [A] */
  I: number;
  /** 抵抗 [Ω] */
  R: number;
  /** 答えの単位 */
  unit: 'V' | 'A' | 'mA' | 'Ω' | 'kΩ';
}

function draft(
  pattern: string,
  params: OhmParams,
  text: string,
  answer: number,
  wrongs: WrongAnswer[],
  explanation: string,
): QuestionDraft {
  return {
    pattern,
    text,
    unit: params.unit,
    answer: clean(answer),
    scientific: false,
    wrongs: wrongs.map((w) => ({ ...w, value: clean(w.value) })),
    explanation,
    params: { ...params },
  };
}

/** 答えが小数第2位まで（1000以上は整数）・範囲内かを確かめる */
function ok(answer: number, min: number, max: number): boolean {
  return isNiceAnswer(answer) && answer >= min && answer <= max;
}

// ---------- ★1：整数だけ ----------

const R1_LIST = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50];
const I1_LIST = [1, 2, 3, 4, 5, 6];
/** ★1の電圧の上限 [V] */
const V1_MAX = 60;

/** ★1の I と R を選ぶ（電圧が大きくなりすぎない組み合わせ） */
function pickIR1(rng: Rng): { I: number; R: number; V: number } {
  return retry(() => {
    const I = pick(rng, I1_LIST);
    const R = pick(rng, R1_LIST);
    const V = I * R;
    return V <= V1_MAX ? { I, R, V } : null;
  });
}

function findV1(rng: Rng): QuestionDraft {
  const { I, R, V } = pickIR1(rng);
  return draft(
    'findV',
    { find: 'V', V, I, R, unit: 'V' },
    `${n(R)} Ω の電熱線に ${n(I)} A の電流が流れている。電熱線にかかる電圧は何 V か。`,
    V,
    [
      { value: I / R, mistake: 'opSwap' },
      { value: R / I, mistake: 'formulaInvert' },
      { value: I + R, mistake: 'other' },
    ],
    `V = I × R = ${n(I)} A × ${n(R)} Ω = ${n(V)} V`,
  );
}

function findI1(rng: Rng): QuestionDraft {
  // 電流が1 Aだと「割る順番の逆」でも同じ答えになるので使わない
  const { I, R, V } = retry(() => {
    const x = pickIR1(rng);
    return x.I > 1 ? x : null;
  });
  return draft(
    'findI',
    { find: 'I', V, I, R, unit: 'A' },
    `${n(R)} Ω の抵抗に ${n(V)} V の電圧をかけた。流れる電流は何 A か。`,
    I,
    [
      { value: V * R, mistake: 'opSwap' },
      { value: R / V, mistake: 'formulaInvert' },
      { value: V - R, mistake: 'other' },
    ],
    `I = V ÷ R = ${n(V)} V ÷ ${n(R)} Ω = ${n(I)} A`,
  );
}

function findR1(rng: Rng): QuestionDraft {
  const { I, R, V } = pickIR1(rng);
  return draft(
    'findR',
    { find: 'R', V, I, R, unit: 'Ω' },
    `ある抵抗に ${n(V)} V の電圧をかけると、${n(I)} A の電流が流れた。この抵抗は何 Ω か。`,
    R,
    [
      { value: V * I, mistake: 'opSwap' },
      { value: I / V, mistake: 'formulaInvert' },
      { value: V - I, mistake: 'other' },
    ],
    `R = V ÷ I = ${n(V)} V ÷ ${n(I)} A = ${n(R)} Ω`,
  );
}

// ---------- ★2：mA と A の換算 ----------

const MA2_LIST = [20, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500, 600, 800];
const R2_LIST = [5, 10, 15, 20, 25, 30, 40, 50, 60, 100, 120, 150, 200];
const V2_LIST = [1, 1.5, 2, 3, 4.5, 5, 6, 9, 10, 12];

function findV2(rng: Rng): QuestionDraft {
  return retry(() => {
    const mA = pick(rng, MA2_LIST);
    const R = pick(rng, R2_LIST);
    const I = mA / 1000;
    const V = clean(I * R);
    if (!ok(V, 0.5, 100)) return null;
    return draft(
      'findV_mA',
      { find: 'V', V, I, R, unit: 'V' },
      `${n(R)} Ω の抵抗に ${n(mA)} mA の電流が流れている。抵抗にかかる電圧は何 V か。`,
      V,
      [
        { value: mA * R, mistake: 'unitShift' },
        { value: I / R, mistake: 'opSwap' },
        { value: (mA / 100) * R, mistake: 'unitShift' },
        { value: R / I, mistake: 'formulaInvert' },
      ],
      `${n(mA)} mA = ${n(I)} A\nV = I × R = ${n(I)} A × ${n(R)} Ω = ${n(V)} V`,
    );
  });
}

function findI2(rng: Rng): QuestionDraft {
  return retry(() => {
    const V = pick(rng, V2_LIST);
    const R = pick(rng, R2_LIST);
    const I = clean(V / R);
    const mA = clean(I * 1000);
    if (!ok(mA, 1, 2000)) return null;
    return draft(
      'findI_mA',
      { find: 'I', V, I, R, unit: 'mA' },
      `${n(R)} Ω の抵抗に ${n(V)} V の電圧をかけた。流れる電流は何 mA か。`,
      mA,
      [
        { value: I, mistake: 'unitShift' },
        { value: V * R, mistake: 'opSwap' },
        { value: (R / V) * 1000, mistake: 'formulaInvert' },
        { value: I * 100, mistake: 'unitShift' },
      ],
      `I = V ÷ R = ${n(V)} V ÷ ${n(R)} Ω = ${n(I)} A\n${n(I)} A = ${n(mA)} mA`,
    );
  });
}

function findR2(rng: Rng): QuestionDraft {
  return retry(() => {
    const V = pick(rng, V2_LIST);
    const mA = pick(rng, MA2_LIST);
    const I = mA / 1000;
    const R = clean(V / I);
    if (!ok(R, 1, 1000)) return null;
    return draft(
      'findR_mA',
      { find: 'R', V, I, R, unit: 'Ω' },
      `ある抵抗に ${n(V)} V の電圧をかけると、${n(mA)} mA の電流が流れた。この抵抗は何 Ω か。`,
      R,
      [
        { value: V / mA, mistake: 'unitShift' },
        { value: V * I, mistake: 'opSwap' },
        { value: I / V, mistake: 'formulaInvert' },
        { value: V / (mA / 100), mistake: 'unitShift' },
      ],
      `${n(mA)} mA = ${n(I)} A\nR = V ÷ I = ${n(V)} V ÷ ${n(I)} A = ${n(R)} Ω`,
    );
  });
}

// ---------- ★3：mA と kΩ、小数 ----------

const MA3_LIST = [0.5, 0.8, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 12, 15];
const K3_LIST = [0.2, 0.5, 1, 1.2, 1.5, 2, 2.4, 3, 4, 5, 6, 7.5, 10, 12];
const V3_LIST = [1.2, 1.5, 2.4, 3, 3.6, 4.5, 4.8, 6, 7.2, 9, 12, 18, 24];

function findV3(rng: Rng): QuestionDraft {
  return retry(() => {
    const mA = pick(rng, MA3_LIST);
    const kOhm = pick(rng, K3_LIST);
    const V = clean(mA * kOhm); // mA × kΩ = V
    if (!ok(V, 0.1, 200)) return null;
    const I = mA / 1000;
    const R = kOhm * 1000;
    return draft(
      'findV_k',
      { find: 'V', V, I, R, unit: 'V' },
      `${n(kOhm)} kΩ の抵抗に ${n(mA)} mA の電流が流れている。抵抗にかかる電圧は何 V か。`,
      V,
      [
        { value: mA * R, mistake: 'unitShift' },
        { value: I * kOhm, mistake: 'unitShift' },
        { value: mA / kOhm, mistake: 'opSwap' },
        { value: kOhm / mA, mistake: 'formulaInvert' },
      ],
      `${n(mA)} mA = ${n(I)} A、${n(kOhm)} kΩ = ${n(R)} Ω\nV = I × R = ${n(I)} A × ${n(R)} Ω = ${n(V)} V`,
    );
  });
}

function findI3(rng: Rng): QuestionDraft {
  return retry(() => {
    const V = pick(rng, V3_LIST);
    const kOhm = pick(rng, K3_LIST);
    const mA = clean(V / kOhm); // V ÷ kΩ = mA
    if (!ok(mA, 0.1, 200)) return null;
    const I = clean(mA / 1000);
    const R = kOhm * 1000;
    return draft(
      'findI_k',
      { find: 'I', V, I, R, unit: 'mA' },
      `${n(kOhm)} kΩ の抵抗に ${n(V)} V の電圧をかけた。流れる電流は何 mA か。`,
      mA,
      [
        { value: I, mistake: 'unitShift' },
        { value: V * kOhm, mistake: 'opSwap' },
        { value: kOhm / V, mistake: 'formulaInvert' },
        { value: mA * 1000, mistake: 'unitShift' },
      ],
      `${n(kOhm)} kΩ = ${n(R)} Ω\nI = V ÷ R = ${n(V)} V ÷ ${n(R)} Ω = ${n(I)} A = ${n(mA)} mA`,
    );
  });
}

function findR3(rng: Rng): QuestionDraft {
  return retry(() => {
    const V = pick(rng, V3_LIST);
    const mA = pick(rng, MA3_LIST);
    const kOhm = clean(V / mA); // V ÷ mA = kΩ
    if (!ok(kOhm, 0.1, 100)) return null;
    const I = mA / 1000;
    const R = clean(kOhm * 1000);
    return draft(
      'findR_k',
      { find: 'R', V, I, R, unit: 'kΩ' },
      `ある抵抗に ${n(V)} V の電圧をかけると、${n(mA)} mA の電流が流れた。この抵抗は何 kΩ か。`,
      kOhm,
      [
        { value: R, mistake: 'unitShift' },
        { value: V * mA, mistake: 'opSwap' },
        { value: mA / V, mistake: 'formulaInvert' },
        { value: kOhm / 1000, mistake: 'unitShift' },
      ],
      `${n(mA)} mA = ${n(I)} A\nR = V ÷ I = ${n(V)} V ÷ ${n(I)} A = ${n(R)} Ω = ${n(kOhm)} kΩ`,
    );
  });
}

export const OHM_PATTERNS: PatternDef[] = [
  { id: 'findV', genre: 'ohm', difficulty: 1, mistakes: ['opSwap', 'formulaInvert'], make: findV1 },
  { id: 'findI', genre: 'ohm', difficulty: 1, mistakes: ['opSwap', 'formulaInvert'], make: findI1 },
  { id: 'findR', genre: 'ohm', difficulty: 1, mistakes: ['opSwap', 'formulaInvert'], make: findR1 },
  { id: 'findV_mA', genre: 'ohm', difficulty: 2, mistakes: ['unitShift', 'opSwap', 'formulaInvert'], make: findV2 },
  { id: 'findI_mA', genre: 'ohm', difficulty: 2, mistakes: ['unitShift', 'opSwap', 'formulaInvert'], make: findI2 },
  { id: 'findR_mA', genre: 'ohm', difficulty: 2, mistakes: ['unitShift', 'opSwap', 'formulaInvert'], make: findR2 },
  { id: 'findV_k', genre: 'ohm', difficulty: 3, mistakes: ['unitShift', 'opSwap', 'formulaInvert'], make: findV3 },
  { id: 'findI_k', genre: 'ohm', difficulty: 3, mistakes: ['unitShift', 'opSwap', 'formulaInvert'], make: findI3 },
  { id: 'findR_k', genre: 'ohm', difficulty: 3, mistakes: ['unitShift', 'opSwap', 'formulaInvert'], make: findR3 },
];
