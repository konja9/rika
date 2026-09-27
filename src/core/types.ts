// ゲーム全体で使う「型」（データの形）の定義。

/** 問題のジャンル */
export type Genre = 'ohm' | 'resistance' | 'mole';

/** 難度（★1〜★3） */
export type Difficulty = 1 | 2 | 3;

/** ミスの型（誤答の選択肢に付けるラベル） */
export type MistakeType =
  | 'opSwap' // 掛け算と割り算の取り違え
  | 'formulaInvert' // 公式の変形・使い方のミス
  | 'unitShift' // 単位換算の桁ずれ
  | 'parallelNoReciprocal' // 並列で逆数の取り忘れ
  | 'seriesParallelSwap' // 直列と並列の取り違え
  | 'combinationOrder' // 組み合わせの計算順ミス
  | 'molarSubscript' // 分子量の添字の掛け忘れ
  | 'molarAtomic' // 原子量を分子量として使う
  | 'exponentShift' // 指数のずれ
  | 'other'; // その他の計算ミス

/** 典型的なミスをしたときの答え */
export interface WrongAnswer {
  value: number;
  mistake: MistakeType;
}

/** 4択の選択肢1つ分 */
export interface Choice {
  value: number;
  /** 画面に出す文字（単位なし） */
  text: string;
  correct: boolean;
  /** 誤答のときのミスの型 */
  mistake?: MistakeType;
}

/** 合成抵抗の回路の形（回路図の表示とテストに使う） */
export type Circuit =
  | { kind: 'R'; name: string; ohm: number }
  | { kind: 'series'; parts: Circuit[] }
  | { kind: 'parallel'; parts: Circuit[] };

/** 生成関数が作る「問題の下書き」（選択肢はまだ作っていない） */
export interface QuestionDraft {
  /** 問題パターンの名前（苦手の出し分けに使う） */
  pattern: string;
  text: string;
  /** 答えの単位（例："V", "mA", "mol", "個"） */
  unit: string;
  answer: number;
  /** 答えを a×10ⁿ の形で表すか（粒子数） */
  scientific: boolean;
  wrongs: WrongAnswer[];
  /** 正しい解き方 */
  explanation: string;
  /** テストで正解を計算し直すための元データ */
  params: Record<string, unknown>;
  circuit?: Circuit;
}

/** 出題する問題 */
export interface Question extends QuestionDraft {
  id: string;
  genre: Genre;
  difficulty: Difficulty;
  /** 4つの選択肢（混ぜた順） */
  choices: Choice[];
}

/** 問題パターンの定義 */
export interface PatternDef {
  id: string;
  genre: Genre;
  difficulty: Difficulty;
  /** このパターンで起きやすいミスの型（苦手の出し分けに使う） */
  mistakes: MistakeType[];
  make: (rng: import('./random').Rng) => QuestionDraft;
}
