// 盤面：3つの図柄、保留ランプ、状態表示。抽選結果の演出（リーチ・スーパーリーチ）を行う。
// 当たりかどうかは演出の前に決まっている。演出は結果を見せるための「見た目」だけ。

import { sound } from '../audio/sound';
import { VIBES, vibrate } from '../audio/vibrate';
import { CONFIG, HOLD_COLOR_NAMES } from '../config';
import type { Hold, SpinResult } from '../game/lottery';
import type { GameState } from '../game/state';
import { h, sleep } from './dom';

export class Machine {
  readonly el: HTMLElement;
  private reels: HTMLElement[];
  private msg: HTMLElement;
  private holdsEl: HTMLElement;
  private statusEl: HTMLElement;
  private timers: ReturnType<typeof setInterval>[] = [];
  private disposed = false;

  constructor() {
    this.reels = [0, 1, 2].map(() => h('div', { class: 'reel' }, '7'));
    this.msg = h('div', { class: 'machine-msg', attrs: { 'aria-live': 'polite' } });
    this.holdsEl = h('div', { class: 'holds' });
    this.statusEl = h('div', { class: 'status-right' });
    this.el = h('div', { class: 'machine' },
      h('div', { class: 'reels' }, ...this.reels),
      this.msg,
      h('div', { class: 'holds-row' },
        h('span', { class: 'holds-label' }, '保留'),
        this.holdsEl,
        this.statusEl,
      ),
    );
    this.setReels([1, 2, 3]);
  }

  /** 保留ランプを描く（newIndex は今増えたランプ） */
  renderHolds(holds: Hold[], newIndex = -1): void {
    const lamps = [];
    for (let i = 0; i < CONFIG.maxHolds; i++) {
      const hold = holds[i];
      const cls = ['hold'];
      let title = '空き';
      if (hold) {
        cls.push(hold.color);
        if (hold.mode === 'kakuhen') cls.push('kakuhen-hold');
        if (i === newIndex) cls.push('new');
        title = `${HOLD_COLOR_NAMES[hold.color]}保留${hold.mode === 'kakuhen' ? '（確変）' : ''}`;
      }
      lamps.push(h('span', { class: cls.join(' '), attrs: { title } }));
    }
    this.holdsEl.replaceChildren(...lamps);
    this.holdsEl.setAttribute('aria-label', `保留 ${holds.length}個`);
  }

  /** 右下の状態表示と、確変中の盤面の色 */
  renderStatus(game: GameState): void {
    const kakuhen = game.mode === 'kakuhen';
    this.el.classList.toggle('kakuhen', kakuhen);
    const lines = [h('div', {}, `大当たり ${game.bigHits}回${game.chain > 1 ? `・${game.chain}連チャン` : ''}`)];
    if (kakuhen) lines.unshift(h('div', { class: 'kakuhen-status' }, `確変中 残り${game.kakuhenLeft}問`));
    this.statusEl.replaceChildren(...lines);
  }

  setMessage(text: string, cls = ''): void {
    this.msg.textContent = text;
    this.msg.className = `machine-msg ${cls}`;
  }

  private setReels(nums: number[]): void {
    nums.forEach((n, i) => this.setReel(i, n));
  }

  private setReel(i: number, n: number): void {
    this.reels[i].textContent = String(n);
    this.reels[i].classList.toggle('odd', n % 2 === 1);
  }

  /** 図柄 i を指定の速さで回す */
  private rotate(i: number, intervalMs: number): void {
    clearInterval(this.timers[i]);
    if (this.disposed) return;
    let n = Number(this.reels[i].textContent) || 1;
    this.reels[i].classList.add('spinning');
    this.reels[i].classList.remove('stopped');
    this.timers[i] = setInterval(() => {
      n = (n % 9) + 1;
      this.setReel(i, n);
    }, intervalMs);
  }

  private stop(i: number, n: number): void {
    clearInterval(this.timers[i]);
    this.reels[i].classList.remove('spinning');
    this.reels[i].classList.add('stopped');
    this.setReel(i, n);
    if (!this.disposed) sound.reelStop();
  }

  /** 演出を途中でやめる（画面を離れるとき） */
  dispose(): void {
    this.disposed = true;
    this.timers.forEach((t) => clearInterval(t));
  }

  /** 抽選結果の演出。図柄がすべて止まったら終わる */
  async spin(result: SpinResult): Promise<void> {
    const t = CONFIG.timing;
    const [left, center, right] = result.reels;
    this.setMessage('');
    this.el.classList.remove('reach', 'super', 'win');
    [0, 1, 2].forEach((i) => this.rotate(i, 55));

    if (result.reach === 'none') {
      await sleep(t.spinNoReach * 0.4);
      this.stop(0, left);
      await sleep(t.spinNoReach * 0.25);
      this.stop(2, right);
      await sleep(t.spinNoReach * 0.35);
      this.stop(1, center);
      return;
    }

    // ここからリーチ
    await sleep(800);
    this.stop(0, left);
    await sleep(500);
    this.stop(2, right);
    this.el.classList.add('reach');
    this.setMessage('リーチ！', 'reach');
    sound.reach();
    vibrate(VIBES.reach);

    const total = result.reach === 'super' ? t.spinSuperReach : t.spinNormalReach;
    let elapsed = 1300;
    if (result.reach === 'super') {
      this.rotate(1, 110);
      await sleep(1000);
      elapsed += 1000;
      this.el.classList.add('super');
      this.setMessage('スーパーリーチ！！', 'super');
      sound.superReach();
      vibrate(VIBES.reach);
      this.rotate(1, 200);
    } else {
      this.rotate(1, 140);
    }
    // 最後は少しゆっくりにして止める
    await sleep(Math.max(0, total - elapsed - 900));
    this.rotate(1, 320);
    await sleep(900);
    this.stop(1, center);
    this.el.classList.remove('reach', 'super');
    if (result.hit) {
      this.el.classList.add('win');
      this.setMessage(result.kakuhen ? '確変大当たり！' : '大当たり！', 'win');
    } else {
      this.setMessage('ざんねん…', 'lose');
    }
  }
}
