// ゲーム進行（保留・確変・出玉）のテスト
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { createRng } from '../src/core/random';
import type { SpinResult } from '../src/game/lottery';
import {
  applySpin, currentDifficulty, isNumericMode, newGameState, recordAnswer, settlePending, takeSpin,
} from '../src/game/state';

function fakeHit(kakuhen: boolean, holdMode: 'normal' | 'kakuhen'): SpinResult {
  return {
    hit: true, kakuhen, reach: 'super', reels: kakuhen ? [7, 7, 7] : [2, 2, 2],
    payout: CONFIG.payout[holdMode], hold: { color: 'red', mode: holdMode },
  };
}

describe('保留', () => {
  it('正解で1つたまり、最大4つ。誤答ではたまらない', () => {
    const s = newGameState();
    expect(recordAnswer(s, false, null).holdAdded).toBe(false);
    for (let i = 0; i < 4; i++) expect(recordAnswer(s, true, 'blue').holdAdded).toBe(true);
    const full = recordAnswer(s, true, 'gold');
    expect(full.holdAdded).toBe(false);
    expect(full.holdFull).toBe(true);
    expect(s.holds).toHaveLength(CONFIG.maxHolds);
  });

  it('保留は古い順に抽選される', () => {
    const s = newGameState();
    recordAnswer(s, true, 'white');
    recordAnswer(s, true, 'gold');
    const rng = createRng(1);
    expect(takeSpin(s, rng)!.hold.color).toBe('white');
    expect(takeSpin(s, rng)!.hold.color).toBe('gold');
    expect(takeSpin(s, rng)).toBeNull();
    expect(s.spins).toBe(2);
  });
});

describe('確変', () => {
  it('確変当たりで確変に入り、正誤あわせて8問で終わる', () => {
    const s = newGameState();
    applySpin(s, fakeHit(true, 'normal'));
    expect(s.mode).toBe('kakuhen');
    expect(isNumericMode(s)).toBe(true);
    expect(s.kakuhenLeft).toBe(CONFIG.kakuhenQuestions);
    for (let i = 0; i < CONFIG.kakuhenQuestions - 1; i++) {
      expect(recordAnswer(s, i % 2 === 0, i % 2 === 0 ? 'green' : null).kakuhenEnded).toBe(false);
    }
    expect(recordAnswer(s, false, null).kakuhenEnded).toBe(true);
    expect(s.mode).toBe('normal');
    expect(isNumericMode(s)).toBe(false);
  });

  it('確変中に獲得した保留は、確変が終わっても確変の確率で抽選される', () => {
    const s = newGameState();
    applySpin(s, fakeHit(true, 'normal'));
    s.kakuhenLeft = 1;
    recordAnswer(s, true, 'blue');
    expect(s.mode).toBe('normal');
    expect(s.holds[0].mode).toBe('kakuhen');
  });

  it('確変中は難度が上がる（上限★3）', () => {
    const s = newGameState();
    expect(currentDifficulty(s, 1)).toBe(1);
    applySpin(s, fakeHit(true, 'normal'));
    const up = CONFIG.kakuhenDifficultyUp;
    expect(currentDifficulty(s, 1)).toBe(Math.min(3, 1 + up));
    expect(currentDifficulty(s, 2)).toBe(Math.min(3, 2 + up));
    expect(currentDifficulty(s, 3)).toBe(3);
  });

  it('通常当たりで確変が終わる', () => {
    const s = newGameState();
    applySpin(s, fakeHit(true, 'normal'));
    applySpin(s, fakeHit(false, 'kakuhen'));
    expect(s.mode).toBe('normal');
    expect(s.kakuhenLeft).toBe(0);
  });
});

describe('出玉・連チャン', () => {
  it('出玉・大当たり回数・連チャンを数える', () => {
    const s = newGameState();
    applySpin(s, fakeHit(true, 'normal'));
    applySpin(s, fakeHit(true, 'kakuhen'));
    applySpin(s, fakeHit(false, 'kakuhen'));
    expect(s.balls).toBe(CONFIG.payout.normal + 2 * CONFIG.payout.kakuhen);
    expect(s.bigHits).toBe(3);
    expect(s.kakuhenHits).toBe(2);
    expect(s.chain).toBe(3);
    applySpin(s, fakeHit(false, 'normal'));
    expect(s.chain).toBe(1);
    expect(s.maxChain).toBe(3);
  });

  it('ハズレでは何も変わらない', () => {
    const s = newGameState();
    recordAnswer(s, true, 'white');
    const rng = createRng(3);
    let r = takeSpin(s, rng)!;
    while (r.hit) {
      recordAnswer(s, true, 'white');
      r = takeSpin(s, rng)!;
    }
    const before = { ...s };
    applySpin(s, r);
    expect(s.balls).toBe(before.balls);
    expect(s.mode).toBe(before.mode);
  });
});

describe('演出中の結果の保存', () => {
  it('抽選した結果は pending に残り、反映すると消える', () => {
    const s = newGameState();
    recordAnswer(s, true, 'gold');
    const r = takeSpin(s, createRng(5))!;
    expect(s.pending).toEqual(r);
    applySpin(s, r);
    expect(s.pending).toBeNull();
  });

  it('起動時に演出途中の当たりがあれば反映する', () => {
    const s = newGameState();
    s.pending = fakeHit(true, 'normal');
    expect(settlePending(s)).not.toBeNull();
    expect(s.balls).toBe(CONFIG.payout.normal);
    expect(s.mode).toBe('kakuhen');
    expect(s.pending).toBeNull();
  });
});
