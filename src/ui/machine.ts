// 盤面：3つの図柄、保留ランプ、状態表示。抽選結果の演出を行う。

import { CONFIG } from '../config';
import type { Hold, SpinResult } from '../game/lottery';
import type { GameState } from '../game/state';
import { h, sleep } from './dom';

export class Machine {
  readonly el: HTMLElement;
  private reels: HTMLElement[];
  private msg: HTMLElement;
  private holdsEl: HTMLElement;
  private statusEl: HTMLElement;

  constructor() {
    this.reels = [0, 1, 2].map(() => h('div', { class: 'reel' }, String(7)));
    this.msg = h('div', { class: 'machine-msg' });
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
      if (hold) {
        cls.push(hold.color);
        if (hold.mode === 'kakuhen') cls.push('kakuhen-hold');
        if (i === newIndex) cls.push('new');
      }
      lamps.push(h('span', { class: cls.join(' '), attrs: { 'aria-hidden': 'true' } }));
    }
    this.holdsEl.replaceChildren(...lamps);
    this.holdsEl.setAttribute('aria-label', `保留 ${holds.length}個`);
  }

  /** 右下の状態表示 */
  renderStatus(game: GameState): void {
    this.statusEl.textContent = `大当たり ${game.bigHits}回`;
  }

  setMessage(text: string): void {
    this.msg.textContent = text;
  }

  private setReels(nums: number[]): void {
    nums.forEach((n, i) => this.setReel(i, n));
  }

  private setReel(i: number, n: number): void {
    this.reels[i].textContent = String(n);
    this.reels[i].classList.toggle('odd', n % 2 === 1);
  }

  /** 抽選結果の演出。図柄がすべて止まったら終わる */
  async spin(result: SpinResult): Promise<void> {
    this.setMessage('');
    // 図柄を回す
    const timers = this.reels.map((reel, i) => {
      reel.classList.add('spinning');
      reel.classList.remove('stopped');
      let n = Math.floor(Math.random() * 9) + 1;
      return setInterval(() => {
        n = (n % 9) + 1;
        this.setReel(i, n);
      }, 60);
    });
    const stop = (i: number) => {
      clearInterval(timers[i]);
      this.reels[i].classList.remove('spinning');
      this.reels[i].classList.add('stopped');
      this.setReel(i, result.reels[i]);
    };

    const total = CONFIG.timing.spinNoReach;
    await sleep(total * 0.4);
    stop(0);
    await sleep(total * 0.25);
    stop(2);
    await sleep(total * 0.35);
    stop(1);
    this.setMessage(result.hit ? '大当たり！' : '');
  }
}
