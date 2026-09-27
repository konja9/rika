// 問題の下書きから4択の選択肢を作る共通処理。
// 誤答は「典型的なミス」の計算結果から作る。
// 表示が正解と同じになるもの・重複するものは除き、足りないときは「その他の計算ミス」で補う。

import { formatNumber, nearlyEqual } from '../core/numbers';
import { shuffle, type Rng } from '../core/random';
import type { Choice, QuestionDraft, WrongAnswer } from '../core/types';

/** 選択肢の数 */
export const CHOICE_COUNT = 4;

/** 誤答として使えるか（正の有限の数か） */
function usable(v: number): boolean {
  return Number.isFinite(v) && v > 0;
}

/** 補充用の誤答（桁や倍率のまちがい） */
function fillers(answer: number): WrongAnswer[] {
  return [10, 0.1, 2, 0.5, 100, 0.01, 3, 1 / 3, 4, 0.25].map((k) => ({
    value: answer * k,
    mistake: 'other' as const,
  }));
}

/** 4つの選択肢を作る（混ぜた順で返す） */
export function buildChoices(draft: QuestionDraft, rng: Rng): Choice[] {
  const correctText = formatNumber(draft.answer, draft.scientific);
  const choices: Choice[] = [{ value: draft.answer, text: correctText, correct: true }];
  const usedTexts = new Set([correctText]);

  for (const w of [...draft.wrongs, ...fillers(draft.answer)]) {
    if (choices.length >= CHOICE_COUNT) break;
    if (!usable(w.value) || nearlyEqual(w.value, draft.answer, 1e-6)) continue;
    const text = formatNumber(w.value, draft.scientific);
    if (usedTexts.has(text)) continue;
    usedTexts.add(text);
    choices.push({ value: w.value, text, correct: false, mistake: w.mistake });
  }
  return shuffle(rng, choices);
}
