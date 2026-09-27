// 抽選のテスト：大量にシミュレーションして、当選確率・確変率・リーチ率が設定値どおりかを確認する
import { describe, expect, it } from 'vitest';
import { CONFIG, HOLD_COLORS } from '../src/config';
import { createRng } from '../src/core/random';
import { drawSpin, holdColor, holdColorMeter, type Mode } from '../src/game/lottery';

/** 回数 n・確率 p のとき、ずれの許容幅（標準偏差の5倍） */
function tolerance(p: number, n: number): number {
  return 5 * Math.sqrt((p * (1 - p)) / n);
}

const N = 200_000;

describe('当選確率', () => {
  for (const mode of ['normal', 'kakuhen'] as Mode[]) {
    for (const color of HOLD_COLORS) {
      const p = CONFIG.hitRate[mode][color];
      it(`${mode === 'normal' ? '通常' : '確変'}・${color}保留：${N}回で約${(p * 100).toFixed(0)}%`, () => {
        const rng = createRng(mode.length * 100 + color.length);
        let hits = 0;
        for (let i = 0; i < N; i++) if (drawSpin({ color, mode }, rng).hit) hits++;
        expect(Math.abs(hits / N - p)).toBeLessThan(tolerance(p, N));
      });
    }
  }

  it('色が上がるほど当選確率が上がる／確変中は通常より高い', () => {
    for (const mode of ['normal', 'kakuhen'] as Mode[]) {
      const rates = HOLD_COLORS.map((c) => CONFIG.hitRate[mode][c]);
      for (let i = 1; i < rates.length; i++) expect(rates[i]).toBeGreaterThan(rates[i - 1]);
    }
    for (const c of HOLD_COLORS) expect(CONFIG.hitRate.kakuhen[c]).toBeGreaterThan(CONFIG.hitRate.normal[c]);
  });
});

describe('確変率・リーチ・図柄・出玉', () => {
  // 当たりを多く集めるため、確変中の金保留でまわす
  const rng = createRng(12345);
  const results = Array.from({ length: N }, () => drawSpin({ color: 'gold', mode: 'kakuhen' }, rng));
  const hits = results.filter((r) => r.hit);
  const misses = results.filter((r) => !r.hit);

  it(`確変率が約${CONFIG.kakuhenRate * 100}%`, () => {
    const rate = hits.filter((r) => r.kakuhen).length / hits.length;
    expect(Math.abs(rate - CONFIG.kakuhenRate)).toBeLessThan(tolerance(CONFIG.kakuhenRate, hits.length));
  });

  it('ハズレで確変になることはない', () => {
    expect(misses.every((r) => !r.kakuhen)).toBe(true);
  });

  it('リーチの出現率が設定値どおり', () => {
    const r = CONFIG.reach;
    const hitReach = hits.filter((x) => x.reach !== 'none').length / hits.length;
    expect(Math.abs(hitReach - r.onHit)).toBeLessThanOrEqual(tolerance(r.onHit, hits.length) + 1e-12);
    const hitSuper = hits.filter((x) => x.reach === 'super').length / hits.length;
    const pHitSuper = r.onHit * r.superOnHit;
    expect(Math.abs(hitSuper - pHitSuper)).toBeLessThan(tolerance(pHitSuper, hits.length));
    const missReach = misses.filter((x) => x.reach !== 'none').length / misses.length;
    expect(Math.abs(missReach - r.onMiss)).toBeLessThan(tolerance(r.onMiss, misses.length));
    const missSuper = misses.filter((x) => x.reach === 'super').length / misses.length;
    const pMissSuper = r.onMiss * r.superOnMiss;
    expect(Math.abs(missSuper - pMissSuper)).toBeLessThan(tolerance(pMissSuper, misses.length));
  });

  it('図柄：当たりは3つそろい（奇数=確変、偶数=通常）、ハズレはそろわない', () => {
    for (const r of results) {
      const [a, b, c] = r.reels;
      if (r.hit) {
        expect(a === b && b === c).toBe(true);
        expect(a % 2 === 1).toBe(r.kakuhen);
      } else {
        expect(a === b && b === c).toBe(false);
        // リーチのときだけ左右がそろう
        expect(a === c).toBe(r.reach !== 'none');
      }
      for (const x of r.reels) expect(x >= 1 && x <= 9).toBe(true);
    }
  });

  it('出玉：当たりのときだけ、獲得時の状態に応じた数', () => {
    for (const r of results) expect(r.payout).toBe(r.hit ? CONFIG.payout.kakuhen : 0);
    const normal = drawSpinUntilHit('normal');
    expect(normal.payout).toBe(CONFIG.payout.normal);
  });
});

function drawSpinUntilHit(mode: Mode) {
  const rng = createRng(99);
  for (;;) {
    const r = drawSpin({ color: 'gold', mode }, rng);
    if (r.hit) return r;
  }
}

describe('保留の色', () => {
  it('難度点＋速さ点で決まる', () => {
    // ★1：基準20秒
    expect(holdColor(1, 30, false)).toBe('white'); // 0+0
    expect(holdColor(1, 15, false)).toBe('blue'); // 0+1
    expect(holdColor(1, 10, false)).toBe('green'); // 0+2
    // ★2：基準30秒
    expect(holdColor(2, 31, false)).toBe('blue'); // 1+0
    expect(holdColor(2, 30, false)).toBe('green'); // 1+1
    expect(holdColor(2, 15, false)).toBe('red'); // 1+2
    // ★3：基準45秒
    expect(holdColor(3, 60, false)).toBe('green'); // 2+0
    expect(holdColor(3, 40, false)).toBe('red'); // 2+1
    expect(holdColor(3, 22, false)).toBe('gold'); // 2+2
  });

  it('色メーターは判定と同じ色を示す', () => {
    for (const d of [1, 2, 3] as const) {
      for (let t = 0; t < 80; t += 0.5) {
        for (const numeric of [false, true]) {
          expect(holdColorMeter(d, t, numeric).color).toBe(holdColor(d, t, numeric));
        }
      }
    }
    expect(holdColorMeter(1, 0, false).ratio).toBe(1);
    expect(holdColorMeter(1, 99, false).ratio).toBeNull();
  });

  it('数値入力では基準時間が1.5倍', () => {
    // ★3・数値入力：基準67.5秒、半分は33.75秒
    expect(holdColor(3, 60, true)).toBe('red');
    expect(holdColor(3, 33, true)).toBe('gold');
    expect(holdColor(3, 70, true)).toBe('green');
  });
});
