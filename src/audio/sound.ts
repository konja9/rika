// 効果音。音声ファイルは使わず、Web Audio API で音をその場で作る。
// スマホ（特にiPhone）は、画面をタップするまで音を出せないので、最初のタップで準備する。

type Wave = OscillatorType;

class SoundPlayer {
  enabled = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  /** 最初のタップで呼ぶ。音を出す準備をする */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
  }

  /**
   * 音を1つ鳴らす
   * @param freq 高さ（Hz）
   * @param dur 長さ（秒）
   * @param at 何秒後に鳴らすか
   * @param to 音の高さをこの値まで変化させる（なくてもよい）
   */
  private tone(freq: number, dur: number, wave: Wave = 'sine', vol = 0.5, at = 0, to?: number): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime + at;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** ボタンを押したとき */
  tap(): void {
    this.tone(1200, 0.04, 'square', 0.15);
  }

  /** 正解 */
  correct(): void {
    this.tone(880, 0.1, 'triangle', 0.5);
    this.tone(1320, 0.18, 'triangle', 0.5, 0.09);
  }

  /** 不正解 */
  wrong(): void {
    this.tone(220, 0.18, 'square', 0.25);
    this.tone(160, 0.28, 'square', 0.25, 0.16);
  }

  /** 保留がたまった（色が上がるほど高い音、金はキラキラ） */
  hold(level: number): void {
    const base = 520 * 2 ** (level / 4);
    this.tone(base, 0.12, 'sine', 0.45, 0.2);
    this.tone(base * 1.5, 0.16, 'sine', 0.4, 0.28);
    if (level >= 4) [0, 1, 2, 3].forEach((i) => this.tone(2000 + i * 300, 0.08, 'triangle', 0.25, 0.4 + i * 0.06));
  }

  /** 図柄が止まった */
  reelStop(): void {
    this.tone(300, 0.06, 'square', 0.2, 0, 120);
  }

  /** リーチ */
  reach(): void {
    [0, 1, 2].forEach((i) => this.tone(660 + i * 220, 0.12, 'sawtooth', 0.22, i * 0.1));
  }

  /** スーパーリーチ（サイレンのような音） */
  superReach(): void {
    for (let i = 0; i < 4; i++) {
      this.tone(500, 0.35, 'sawtooth', 0.18, i * 0.4, 1000);
    }
  }

  /** 大当たり（ファンファーレ） */
  bigHit(): void {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((f, i) => this.tone(f, i === notes.length - 1 ? 0.6 : 0.14, 'square', 0.3, i * 0.12));
  }

  /** 確変突入 */
  kakuhenIn(): void {
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.35, 0.9 + i * 0.1));
  }

  /** 確変終了 */
  kakuhenEnd(): void {
    [784, 659, 523].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.3, i * 0.15));
  }
}

export const sound = new SoundPlayer();
