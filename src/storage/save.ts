// 進行データの保存（localStorage）、JSONでのバックアップ書き出し・読み込み、リセット。
// 記録（ジャンル別の正答率・ミスの型ごとの回数・直近の回答）もここで持つ。

import { CONFIG, HOLD_COLORS } from '../config';
import type { Difficulty, Genre, MistakeType } from '../core/types';
import { newGameState, type GameState } from '../game/state';
import { GENRES, type GenreChoice, type MistakeCounts } from '../questions/index';
import { MISTAKE_TYPES } from '../questions/mistakes';

/** localStorage に保存するときの名前 */
export const STORAGE_KEY = 'rika-pachi-save';
/** データの形の版。形を変えたら上げる */
export const SAVE_VERSION = 1;

export interface AnswerLog {
  genre: Genre;
  correct: boolean;
  mistake: MistakeType | null;
}

export interface Settings {
  genre: GenreChoice;
  difficulty: Difficulty;
  sound: boolean;
  vibration: boolean;
}

export interface Stats {
  byGenre: Record<Genre, { answered: number; correct: number }>;
  mistakes: Record<MistakeType, number>;
  /** 直近の回答（苦手の出し分けに使う） */
  recent: AnswerLog[];
}

export interface SaveData {
  version: number;
  settings: Settings;
  game: GameState;
  stats: Stats;
}

/** 保存先（テストでは偽物に差し替える） */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    settings: { genre: 'mix', difficulty: 1, sound: true, vibration: true },
    game: newGameState(),
    stats: {
      byGenre: { ohm: { answered: 0, correct: 0 }, resistance: { answered: 0, correct: 0 }, mole: { answered: 0, correct: 0 } },
      mistakes: Object.fromEntries(MISTAKE_TYPES.map((m) => [m, 0])) as Record<MistakeType, number>,
      recent: [],
    },
  };
}

// ---------- 読み込んだデータの点検 ----------
// 壊れたデータや古い形のデータでも動くように、1項目ずつ確かめて、おかしい所は初期値にする。

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const num = (x: unknown, fallback: number) =>
  typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : fallback;
const bool = (x: unknown, fallback: boolean) => (typeof x === 'boolean' ? x : fallback);

function normalize(raw: Obj): SaveData {
  const d = defaultSave();

  const s = isObj(raw.settings) ? raw.settings : {};
  if (s.genre === 'mix' || GENRES.includes(s.genre as Genre)) d.settings.genre = s.genre as GenreChoice;
  if (s.difficulty === 1 || s.difficulty === 2 || s.difficulty === 3) d.settings.difficulty = s.difficulty;
  d.settings.sound = bool(s.sound, d.settings.sound);
  d.settings.vibration = bool(s.vibration, d.settings.vibration);

  const g = isObj(raw.game) ? raw.game : {};
  d.game.mode = g.mode === 'kakuhen' ? 'kakuhen' : 'normal';
  d.game.kakuhenLeft = d.game.mode === 'kakuhen' ? Math.min(num(g.kakuhenLeft, 0), CONFIG.kakuhenQuestions) : 0;
  if (d.game.mode === 'kakuhen' && d.game.kakuhenLeft === 0) d.game.mode = 'normal';
  if (Array.isArray(g.holds)) {
    d.game.holds = g.holds
      .filter((h): h is Obj => isObj(h))
      .filter((h) => HOLD_COLORS.includes(h.color as never) && (h.mode === 'normal' || h.mode === 'kakuhen'))
      .slice(0, CONFIG.maxHolds)
      .map((h) => ({ color: h.color as (typeof HOLD_COLORS)[number], mode: h.mode as 'normal' | 'kakuhen' }));
  }
  for (const key of ['balls', 'spins', 'bigHits', 'kakuhenHits', 'chain', 'maxChain'] as const) {
    d.game[key] = num(g[key], 0);
  }

  const st = isObj(raw.stats) ? raw.stats : {};
  const byGenre = isObj(st.byGenre) ? st.byGenre : {};
  for (const genre of GENRES) {
    const x = isObj(byGenre[genre]) ? byGenre[genre] : {};
    const answered = num(x.answered, 0);
    d.stats.byGenre[genre] = { answered, correct: Math.min(num(x.correct, 0), answered) };
  }
  const mistakes = isObj(st.mistakes) ? st.mistakes : {};
  for (const m of MISTAKE_TYPES) d.stats.mistakes[m] = num(mistakes[m], 0);
  if (Array.isArray(st.recent)) {
    d.stats.recent = st.recent
      .filter((r): r is Obj => isObj(r) && GENRES.includes(r.genre as Genre) && typeof r.correct === 'boolean')
      .map((r) => ({
        genre: r.genre as Genre,
        correct: r.correct as boolean,
        mistake: MISTAKE_TYPES.includes(r.mistake as MistakeType) ? (r.mistake as MistakeType) : null,
      }))
      .slice(-CONFIG.weakness.recentWindow);
  }
  return d;
}

// ---------- 保存・読み込み ----------

/** 保存データを読み込む。なければ初期データ */
export function loadSave(storage: StorageLike | null = defaultStorage()): SaveData {
  try {
    const text = storage?.getItem(STORAGE_KEY);
    if (!text) return defaultSave();
    const raw: unknown = JSON.parse(text);
    return isObj(raw) ? normalize(raw) : defaultSave();
  } catch {
    return defaultSave();
  }
}

/** 保存する（保存できない環境では何もしない） */
export function writeSave(data: SaveData, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 容量オーバーやプライベートモードなど。ゲームは続けられるので無視する
  }
}

/** すべての記録を消す */
export function resetSave(storage: StorageLike | null = defaultStorage()): SaveData {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // 無視
  }
  return defaultSave();
}

/** バックアップ用のJSON文字列 */
export function exportJson(data: SaveData): string {
  return JSON.stringify({ app: 'rika-pachi', exportedAt: new Date().toISOString(), ...data }, null, 2);
}

/** バックアップのJSONを読み込む。おかしいときは日本語のエラーを投げる */
export function importJson(text: string): SaveData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('JSONとして読めませんでした。バックアップファイルを選んでください。');
  }
  if (!isObj(raw) || raw.app !== 'rika-pachi' || typeof raw.version !== 'number') {
    throw new Error('このゲームのバックアップファイルではないようです。');
  }
  if (raw.version > SAVE_VERSION) {
    throw new Error('新しい版のゲームで作られたバックアップです。ゲームを更新してから読み込んでください。');
  }
  return normalize(raw);
}

// ---------- 記録 ----------

/** 1問の回答を記録する */
export function recordStats(data: SaveData, genre: Genre, correct: boolean, mistake: MistakeType | null): void {
  const g = data.stats.byGenre[genre];
  g.answered += 1;
  if (correct) g.correct += 1;
  if (!correct && mistake) data.stats.mistakes[mistake] += 1;
  data.stats.recent.push({ genre, correct, mistake: correct ? null : mistake });
  if (data.stats.recent.length > CONFIG.weakness.recentWindow) {
    data.stats.recent.splice(0, data.stats.recent.length - CONFIG.weakness.recentWindow);
  }
}

/** 直近の回答から、ミスの型ごとの回数を数える（苦手の出し分け用） */
export function recentMistakeCounts(data: SaveData): MistakeCounts {
  const counts: MistakeCounts = {};
  for (const r of data.stats.recent) {
    if (r.mistake && r.mistake !== 'other') counts[r.mistake] = (counts[r.mistake] ?? 0) + 1;
  }
  return counts;
}
