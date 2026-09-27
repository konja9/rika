// ジャンル3：モル計算
// 質量・物質量・粒子数・気体の体積（標準状態で 22.4 L/mol）の相互変換。
//   ★1：1段階の変換（例：質量 → mol）
//   ★2：mol を経由する2段階の変換（例：質量 → 粒子数）
//   ★3：分子量が複雑な物質で、1〜2段階の変換
// 物質量(mol)を先に決め、そこから問題の数値と答えを計算する。

import { clean, isAtMost2Decimals, isNiceAnswer, toSci } from '../core/numbers';
import { pick, type Rng } from '../core/random';
import type { MistakeType, PatternDef, QuestionDraft, WrongAnswer } from '../core/types';
import { n, retry } from './util';

/** 原子量（概数） */
export const ATOMIC_MASS = {
  H: 1, C: 12, N: 14, O: 16, Na: 23, Mg: 24, S: 32, Cl: 35.5, Ca: 40,
} as const;
export type Element = keyof typeof ATOMIC_MASS;

/** アボガドロ定数 6.0×10²³ /mol（係数と指数で持つ） */
export const AVOGADRO = 6.0e23;
/** 標準状態の気体 1 mol の体積 [L] */
export const MOLAR_VOLUME = 22.4;

export interface Substance {
  formula: string; // 表示用（添字つき）
  name: string;
  atoms: Partial<Record<Element, number>>;
  /** 標準状態で気体か（体積の問題に使えるか） */
  gas: boolean;
  /** 粒子を何と呼ぶか（イオンからなる物質は粒子数の問題に使わない） */
  particle: '分子' | '原子' | null;
}

/** ★1・★2で使う物質 */
const BASIC: Substance[] = [
  { formula: 'H₂', name: '水素', atoms: { H: 2 }, gas: true, particle: '分子' },
  { formula: 'O₂', name: '酸素', atoms: { O: 2 }, gas: true, particle: '分子' },
  { formula: 'N₂', name: '窒素', atoms: { N: 2 }, gas: true, particle: '分子' },
  { formula: 'CO₂', name: '二酸化炭素', atoms: { C: 1, O: 2 }, gas: true, particle: '分子' },
  { formula: 'CH₄', name: 'メタン', atoms: { C: 1, H: 4 }, gas: true, particle: '分子' },
  { formula: 'NH₃', name: 'アンモニア', atoms: { N: 1, H: 3 }, gas: true, particle: '分子' },
  { formula: 'HCl', name: '塩化水素', atoms: { H: 1, Cl: 1 }, gas: true, particle: '分子' },
  { formula: 'H₂O', name: '水', atoms: { H: 2, O: 1 }, gas: false, particle: '分子' },
  { formula: 'NaCl', name: '塩化ナトリウム', atoms: { Na: 1, Cl: 1 }, gas: false, particle: null },
  { formula: 'C', name: '炭素', atoms: { C: 1 }, gas: false, particle: '原子' },
];

/** ★3で使う、分子量が複雑な物質 */
const COMPLEX: Substance[] = [
  { formula: 'H₂SO₄', name: '硫酸', atoms: { H: 2, S: 1, O: 4 }, gas: false, particle: '分子' },
  { formula: 'CaCO₃', name: '炭酸カルシウム', atoms: { Ca: 1, C: 1, O: 3 }, gas: false, particle: null },
  { formula: 'C₆H₁₂O₆', name: 'グルコース', atoms: { C: 6, H: 12, O: 6 }, gas: false, particle: '分子' },
  { formula: 'C₂H₅OH', name: 'エタノール', atoms: { C: 2, H: 6, O: 1 }, gas: false, particle: '分子' },
  { formula: 'NaOH', name: '水酸化ナトリウム', atoms: { Na: 1, O: 1, H: 1 }, gas: false, particle: null },
  { formula: 'MgCl₂', name: '塩化マグネシウム', atoms: { Mg: 1, Cl: 2 }, gas: false, particle: null },
  { formula: 'SO₂', name: '二酸化硫黄', atoms: { S: 1, O: 2 }, gas: true, particle: '分子' },
  { formula: 'NO₂', name: '二酸化窒素', atoms: { N: 1, O: 2 }, gas: true, particle: '分子' },
  { formula: 'C₃H₈', name: 'プロパン', atoms: { C: 3, H: 8 }, gas: true, particle: '分子' },
  { formula: 'Cl₂', name: '塩素', atoms: { Cl: 2 }, gas: true, particle: '分子' },
];

/** 分子量（式量）を計算する */
export function molarMass(s: Substance): number {
  let m = 0;
  for (const [el, count] of Object.entries(s.atoms)) m += ATOMIC_MASS[el as Element] * (count ?? 0);
  return clean(m);
}

/** よくある分子量のまちがい */
function wrongMolarMasses(s: Substance): { value: number; mistake: MistakeType }[] {
  const entries = Object.entries(s.atoms) as [Element, number][];
  const onceEach = clean(entries.reduce((sum, [el]) => sum + ATOMIC_MASS[el], 0));
  if (entries.length === 1 && entries[0][1] > 1) {
    // O₂ を 16 としてしまう
    return [{ value: onceEach, mistake: 'molarAtomic' }];
  }
  if (entries.length > 1 && entries.some(([, c]) => c > 1)) {
    // H₂O を 1+16=17 としてしまう
    return [{ value: onceEach, mistake: 'molarSubscript' }];
  }
  return [];
}

/** 扱う量の種類 */
export type Quantity = 'mass' | 'mol' | 'particles' | 'volume';

const UNIT: Record<Quantity, string> = { mass: 'g', mol: 'mol', particles: '個', volume: 'L' };

/** 1 mol あたりの量（mol → その量 にするときに掛ける数） */
function factor(q: Quantity, M: number): number {
  switch (q) {
    case 'mass': return M;
    case 'particles': return AVOGADRO;
    case 'volume': return MOLAR_VOLUME;
    case 'mol': return 1;
  }
}

/** 粒子数は係数、それ以外は値そのものが小数第2位まで（1000以上は整数）か */
function isNice(x: number, q: Quantity): boolean {
  if (q === 'particles') {
    const { coef } = toSci(x);
    return isAtMost2Decimals(coef) && coef >= 1 && coef < 10;
  }
  return isNiceAnswer(x);
}

/** 問題文で「与える量」の書き方 */
function givenPhrase(s: Substance, q: Quantity, v: number): string {
  const sub = `${s.name}（${s.formula}）`;
  switch (q) {
    case 'mass': return `${n(v)} g の${sub}`;
    case 'mol': return `${n(v)} mol の${sub}`;
    case 'particles': return `${n(v, true)} 個の${s.name}${s.particle}（${s.formula}）`;
    case 'volume': return `標準状態で ${n(v)} L の${sub}`;
  }
}

/** 問題文で「たずねる量」の書き方 */
function askPhrase(s: Substance, q: Quantity): string {
  switch (q) {
    case 'mass': return 'の質量は何 g か。';
    case 'mol': return 'は何 mol か。';
    case 'particles': return `に含まれる${s.particle}は何個か。`;
    case 'volume': return 'の体積は標準状態で何 L か。';
  }
}

/** 問題の下に付ける「使ってよい数値」 */
function dataNote(s: Substance, from: Quantity, to: Quantity): string {
  const notes: string[] = [];
  if (from === 'mass' || to === 'mass') {
    const els = Object.keys(s.atoms) as Element[];
    notes.push(`原子量 ${els.map((e) => `${e}=${ATOMIC_MASS[e]}`).join(', ')}`);
  }
  if (from === 'particles' || to === 'particles') notes.push('アボガドロ定数 6.0×10²³ /mol');
  return notes.length ? `\n（${notes.join('、')}）` : '';
}

/** 1段階の式（mol への変換・mol からの変換）の説明 */
function stepText(q: Quantity, M: number, dir: 'toMol' | 'fromMol', value: number, mol: number): string {
  const f = q === 'mass' ? `${n(M)} g/mol` : q === 'particles' ? '6.0×10²³ /mol' : '22.4 L/mol';
  const sci = q === 'particles';
  return dir === 'toMol'
    ? `物質量 = ${n(value, sci)} ${UNIT[q]} ÷ ${f} = ${n(mol)} mol`
    : `${n(mol)} mol × ${f} = ${n(value, sci)} ${UNIT[q]}`;
}

/** mol の候補 */
const MOL_BASIC = [0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5];
const MOL_HARD = [...MOL_BASIC, 0.02, 0.05, 0.15, 0.35, 0.6, 1.2, 1.25, 0.125];

/** 変換問題を1つ作る */
function makeConversion(
  rng: Rng,
  pattern: string,
  from: Quantity,
  to: Quantity,
  substances: Substance[],
  mols: number[],
): QuestionDraft {
  // 使える物質だけにしぼる（体積は気体だけ、粒子数は分子・原子だけ）
  const usable = substances.filter(
    (s) =>
      (from !== 'volume' && to !== 'volume' ? true : s.gas) &&
      (from !== 'particles' && to !== 'particles' ? true : s.particle !== null),
  );
  return retry(() => {
    const s = pick(rng, usable);
    const mol = pick(rng, mols);
    const M = molarMass(s);
    const fFrom = factor(from, M);
    const fTo = factor(to, M);
    const given = clean(mol * fFrom);
    const answer = clean(mol * fTo);
    if (!isNice(given, from) || !isNice(answer, to)) return null;
    if (to === 'mass' && answer > 5000) return null;

    const wrongs: WrongAnswer[] = [];
    // 分子量のまちがい
    if (from === 'mass' || to === 'mass') {
      for (const w of wrongMolarMasses(s)) {
        const fF = from === 'mass' ? w.value : fFrom;
        const fT = to === 'mass' ? w.value : fTo;
        wrongs.push({ value: (given / fF) * fT, mistake: w.mistake });
      }
    }
    // 掛け算と割り算の取り違え（mol にするとき掛けてしまう／mol から直すとき割ってしまう）
    if (from !== 'mol') wrongs.push({ value: given * fFrom * fTo, mistake: 'opSwap' });
    if (to !== 'mol') wrongs.push({ value: (given / fFrom) / fTo, mistake: 'opSwap' });
    // 割る順番が逆
    if (from !== 'mol') wrongs.push({ value: (fFrom / given) * fTo, mistake: 'formulaInvert' });
    else wrongs.push({ value: fTo / given, mistake: 'formulaInvert' });
    // 指数のずれ
    if (to === 'particles' || from === 'particles') {
      wrongs.push({ value: answer * 10, mistake: 'exponentShift' });
      wrongs.push({ value: answer / 10, mistake: 'exponentShift' });
    }

    // 分子量が必要なときは先に並べて、選択肢に入りやすくする
    const order: MistakeType[] = ['molarAtomic', 'molarSubscript', 'opSwap', 'exponentShift', 'formulaInvert'];
    wrongs.sort((a, b) => order.indexOf(a.mistake) - order.indexOf(b.mistake));
    // 同じ型が続かないように、型ごとに1つずつ先に出す
    const firstOfEach = wrongs.filter((w, i) => wrongs.findIndex((x) => x.mistake === w.mistake) === i);
    const rest = wrongs.filter((w) => !firstOfEach.includes(w));

    const lines: string[] = [];
    if (from === 'mass' || to === 'mass') {
      const parts = (Object.entries(s.atoms) as [Element, number][])
        .map(([el, c]) => (c > 1 ? `${ATOMIC_MASS[el]}×${c}` : `${ATOMIC_MASS[el]}`));
      const word = s.particle === '分子' ? '分子量' : s.particle === '原子' ? '原子量' : '式量';
      lines.push(`${s.formula} の${word} = ${parts.join(' + ')} = ${n(M)}`);
    }
    if (from !== 'mol') lines.push(stepText(from, M, 'toMol', given, mol));
    if (to !== 'mol') lines.push(stepText(to, M, 'fromMol', answer, mol));

    return {
      pattern,
      text: `${givenPhrase(s, from, given)}${askPhrase(s, to)}${dataNote(s, from, to)}`,
      unit: UNIT[to],
      answer,
      scientific: to === 'particles',
      wrongs: [...firstOfEach, ...rest].map((w) => ({ ...w, value: clean(w.value) })),
      explanation: lines.join('\n'),
      params: { atoms: { ...s.atoms }, formula: s.formula, gas: s.gas, from, to, given, mol },
    };
  });
}

type Conv = [Quantity, Quantity];

const ONE_STEP: Conv[] = [
  ['mass', 'mol'], ['mol', 'mass'],
  ['mol', 'particles'], ['particles', 'mol'],
  ['mol', 'volume'], ['volume', 'mol'],
];
const TWO_STEP: Conv[] = [
  ['mass', 'particles'], ['particles', 'mass'],
  ['mass', 'volume'], ['volume', 'mass'],
  ['volume', 'particles'], ['particles', 'volume'],
];

/** 変換の種類から、起きやすいミスの型を決める */
function mistakesOf(from: Quantity, to: Quantity, withMolar: boolean): MistakeType[] {
  const list: MistakeType[] = ['opSwap', 'formulaInvert'];
  if (withMolar && (from === 'mass' || to === 'mass')) list.push('molarSubscript', 'molarAtomic');
  if (from === 'particles' || to === 'particles') list.push('exponentShift');
  return list;
}

function patterns(
  difficulty: 1 | 2 | 3,
  convs: Conv[],
  substances: Substance[],
  mols: number[],
): PatternDef[] {
  return convs.map(([from, to]) => {
    const id = `${from}To${to[0].toUpperCase()}${to.slice(1)}`;
    return {
      id,
      genre: 'mole' as const,
      difficulty,
      mistakes: mistakesOf(from, to, true),
      make: (rng: Rng) => makeConversion(rng, id, from, to, substances, mols),
    };
  });
}

export const MOLE_PATTERNS: PatternDef[] = [
  ...patterns(1, ONE_STEP, BASIC, MOL_BASIC),
  ...patterns(2, TWO_STEP, BASIC, MOL_BASIC),
  ...patterns(3, [['mass', 'mol'], ['mol', 'mass'], ...TWO_STEP], COMPLEX, MOL_HARD),
];
