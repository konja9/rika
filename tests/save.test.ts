// 保存・バックアップ・記録のテスト
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import {
  defaultSave, exportJson, importJson, loadSave, recentMistakeCounts, recordStats, resetSave,
  STORAGE_KEY, writeSave, type StorageLike,
} from '../src/storage/save';

/** テスト用の偽の localStorage */
function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('保存と読み込み', () => {
  it('保存したものが読み込める', () => {
    const st = memoryStorage();
    const d = defaultSave();
    d.game.balls = 4500;
    d.game.holds = [{ color: 'red', mode: 'kakuhen' }];
    d.settings.difficulty = 3;
    recordStats(d, 'ohm', false, 'unitShift');
    writeSave(d, st);
    const loaded = loadSave(st);
    expect(loaded).toEqual(d);
  });

  it('演出中だった抽選結果も保存・復元できる', () => {
    const st = memoryStorage();
    const d = defaultSave();
    d.game.pending = {
      hit: true, kakuhen: true, reach: 'super', reels: [7, 7, 7], payout: CONFIG.payout.normal,
      hold: { color: 'gold', mode: 'normal' },
    };
    writeSave(d, st);
    expect(loadSave(st).game.pending).toEqual(d.game.pending);
  });

  it('何も保存されていなければ初期データ', () => {
    expect(loadSave(memoryStorage())).toEqual(defaultSave());
  });

  it('壊れたデータでも初期値で補って動く', () => {
    const st = memoryStorage();
    st.setItem(STORAGE_KEY, '{これはJSONではない');
    expect(loadSave(st)).toEqual(defaultSave());

    st.setItem(STORAGE_KEY, JSON.stringify({
      settings: { difficulty: 9, genre: 'xxx', sound: 'yes' },
      game: { balls: -5, holds: [{ color: 'purple', mode: 'normal' }, { color: 'gold', mode: 'normal' }], mode: 'kakuhen', kakuhenLeft: 99 },
      stats: { byGenre: { ohm: { answered: 3, correct: 10 } } },
    }));
    const d = loadSave(st);
    expect(d.settings.difficulty).toBe(1);
    expect(d.settings.genre).toBe('mix');
    expect(d.settings.sound).toBe(true);
    expect(d.game.balls).toBe(0);
    expect(d.game.holds).toEqual([{ color: 'gold', mode: 'normal' }]);
    expect(d.game.kakuhenLeft).toBe(CONFIG.kakuhenQuestions);
    expect(d.stats.byGenre.ohm).toEqual({ answered: 3, correct: 3 });
  });

  it('リセットで消える', () => {
    const st = memoryStorage();
    writeSave(defaultSave(), st);
    expect(resetSave(st)).toEqual(defaultSave());
    expect(st.data.has(STORAGE_KEY)).toBe(false);
  });
});

describe('JSONバックアップ', () => {
  it('書き出したJSONを読み込むと元にもどる', () => {
    const d = defaultSave();
    d.game.bigHits = 7;
    recordStats(d, 'mole', true, null);
    expect(importJson(exportJson(d))).toEqual(d);
  });

  it('関係ないファイルは日本語のエラーになる', () => {
    expect(() => importJson('abc')).toThrow('JSONとして読めませんでした');
    expect(() => importJson('{"foo":1}')).toThrow('バックアップファイルではない');
    expect(() => importJson(JSON.stringify({ app: 'rika-pachi', version: 999 }))).toThrow('新しい版');
  });
});

describe('記録', () => {
  it('ジャンル別の正答数とミスの型の回数を数える', () => {
    const d = defaultSave();
    recordStats(d, 'resistance', true, null);
    recordStats(d, 'resistance', false, 'parallelNoReciprocal');
    recordStats(d, 'resistance', false, 'parallelNoReciprocal');
    expect(d.stats.byGenre.resistance).toEqual({ answered: 3, correct: 1 });
    expect(d.stats.mistakes.parallelNoReciprocal).toBe(2);
    expect(recentMistakeCounts(d)).toEqual({ parallelNoReciprocal: 2 });
  });

  it(`直近の記録は${CONFIG.weakness.recentWindow}件まで`, () => {
    const d = defaultSave();
    for (let i = 0; i < 50; i++) recordStats(d, 'ohm', false, 'opSwap');
    expect(d.stats.recent).toHaveLength(CONFIG.weakness.recentWindow);
    expect(d.stats.mistakes.opSwap).toBe(50);
  });
});
