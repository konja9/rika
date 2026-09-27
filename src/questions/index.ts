// 出題の入り口。ジャンル・難度・苦手の記録から問題パターンを選び、4択つきの問題を作る。

import { CONFIG } from '../config';
import { nearlyEqual } from '../core/numbers';
import { weightedPick, type Rng } from '../core/random';
import type { Difficulty, Genre, MistakeType, PatternDef, Question } from '../core/types';
import { buildChoices } from './choices';
import { MOLE_PATTERNS } from './mole';
import { OHM_PATTERNS } from './ohm';
import { RESISTANCE_PATTERNS } from './resistance';

export const GENRES: Genre[] = ['ohm', 'resistance', 'mole'];

export const GENRE_NAMES: Record<Genre, string> = {
  ohm: 'オームの法則',
  resistance: '合成抵抗',
  mole: 'モル計算',
};

/** 選べる出題範囲（「ミックス」は3ジャンルを均等に） */
export type GenreChoice = Genre | 'mix';

export const ALL_PATTERNS: PatternDef[] = [...OHM_PATTERNS, ...RESISTANCE_PATTERNS, ...MOLE_PATTERNS];

/** ミスの型ごとの回数（直近の記録から数えたもの） */
export type MistakeCounts = Partial<Record<MistakeType, number>>;

/**
 * パターンごとの出題の重みを計算する。
 * 基本はジャンル均等・パターン均等。苦手なミスの型に関係するパターンは
 * 「1 + 0.25 × 回数」倍（上限2倍）にする。
 */
export function patternWeights(
  genre: GenreChoice,
  difficulty: Difficulty,
  counts: MistakeCounts = {},
): { item: PatternDef; weight: number }[] {
  const genres = genre === 'mix' ? GENRES : [genre];
  const result: { item: PatternDef; weight: number }[] = [];
  for (const g of genres) {
    const list = ALL_PATTERNS.filter((p) => p.genre === g && p.difficulty === difficulty);
    for (const p of list) {
      const misses = p.mistakes.reduce((sum, m) => sum + (counts[m] ?? 0), 0);
      const factor = Math.min(CONFIG.weakness.maxFactor, 1 + CONFIG.weakness.perMistake * misses);
      result.push({ item: p, weight: factor / list.length });
    }
  }
  return result;
}

let serial = 0;

/** パターンから問題を1つ作る */
export function makeQuestion(pattern: PatternDef, rng: Rng): Question {
  const draft = pattern.make(rng);
  serial += 1;
  return {
    ...draft,
    id: `q${serial}`,
    genre: pattern.genre,
    difficulty: pattern.difficulty,
    choices: buildChoices(draft, rng),
  };
}

/** 条件に合わせて問題を1つ作る */
export function generateQuestion(opts: {
  genre: GenreChoice;
  difficulty: Difficulty;
  rng: Rng;
  mistakeCounts?: MistakeCounts;
}): Question {
  const pattern = weightedPick(opts.rng, patternWeights(opts.genre, opts.difficulty, opts.mistakeCounts));
  return makeQuestion(pattern, opts.rng);
}

/** 数値入力の答え合わせの結果 */
export type NumericResult = { correct: true } | { correct: false; mistake: MistakeType | null };

/**
 * 数値入力の答え合わせ。
 * 正解でなければ、典型的なミスの計算結果と近い（1%以内）かを調べて型を返す。
 * どの型にも当てはまらなければ mistake は null。
 */
export function checkNumeric(q: Question, value: number): NumericResult {
  if (!Number.isFinite(value)) return { correct: false, mistake: null };
  if (nearlyEqual(value, q.answer, 1e-6)) return { correct: true };
  const hit = q.wrongs.find((w) => nearlyEqual(value, w.value, 0.01));
  return { correct: false, mistake: hit ? hit.mistake : null };
}
