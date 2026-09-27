// ミスの型の一覧。名前と短い解説文をここにまとめる。

import type { MistakeType } from '../core/types';

export const MISTAKES: Record<MistakeType, { label: string; hint: string }> = {
  opSwap: {
    label: '掛け算と割り算の取り違え',
    hint: '掛けるところで割った（または割るところで掛けた）ようです。公式をもう一度確認し、答えの単位が合うかで確かめましょう。',
  },
  formulaInvert: {
    label: '公式の変形・使い方のミス',
    hint: '割る順番が逆になっているか、公式を使える場面をまちがえたようです。「求めたいもの＝」の形に直してから数字を入れましょう。',
  },
  unitShift: {
    label: '単位換算の桁ずれ',
    hint: '1 A＝1000 mA、1 kΩ＝1000 Ω です。計算の前に単位をそろえ、答えをたずねられた単位に直しましょう。',
  },
  parallelNoReciprocal: {
    label: '並列で逆数の取り忘れ',
    hint: '並列は 1/R＝1/R₁＋1/R₂ で求めた値が「1/R」です。最後に逆数をとって R にもどしましょう。',
  },
  seriesParallelSwap: {
    label: '直列と並列の取り違え',
    hint: '直列はそのまま足し算、並列は逆数の足し算です。並列にすると合成抵抗は一番小さい抵抗よりも小さくなります。',
  },
  combinationOrder: {
    label: '組み合わせの計算順ミス',
    hint: 'どの抵抗どうしが直列・並列なのかを回路図で確かめ、内側のまとまりから順に計算しましょう。',
  },
  molarSubscript: {
    label: '分子量の添字の掛け忘れ',
    hint: 'H₂O なら H が2個です。原子量に添字（右下の小さい数）を掛けてから足しましょう。',
  },
  molarAtomic: {
    label: '原子量を分子量として使う',
    hint: 'O₂ や H₂ は原子が2個結びついた分子です。分子量は原子量の2倍になります。',
  },
  exponentShift: {
    label: '指数のずれ',
    hint: '10の何乗かがずれています。6.0×10²³ を掛けたあと、係数が1以上10未満になるように指数を直しましょう。',
  },
  other: {
    label: 'その他の計算ミス',
    hint: '途中の数値の取り違えや、桁のまちがいがあったようです。式を1行ずつ書いて確かめましょう。',
  },
};

/** 出し分けや記録の表示に使う、すべてのミスの型の並び */
export const MISTAKE_TYPES = Object.keys(MISTAKES) as MistakeType[];
