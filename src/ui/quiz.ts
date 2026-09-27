// 問題の表示と回答の受け付け（通常は4択、確変中は数値入力）。
// 正解・不正解の表示と、「いま答えると何色の保留か」のメーターもここで描く。

import { HOLD_COLOR_NAMES, type HoldColor } from '../config';
import { superscript } from '../core/numbers';
import type { Choice, MistakeType, Question } from '../core/types';
import { MISTAKES } from '../questions/mistakes';
import { circuitSvg } from './circuit';
import { h } from './dom';

export interface QuizHandlers {
  /** 4択で選んだとき */
  onChoice(choice: Choice): void;
  /** 数値入力で「答える」を押したとき（value は数値、text は表示用） */
  onNumeric(value: number, text: string): void;
  /** 不正解の解説を読んで「次の問題へ」を押したとき */
  onNext(): void;
  /** ボタンを押したとき（効果音用） */
  onTap?(): void;
}

export interface ShowOptions {
  label: string;
  numeric: boolean;
  kakuhenLeft?: number;
}

export class QuizView {
  readonly el: HTMLElement;
  private handlers: QuizHandlers;
  private buttons: HTMLButtonElement[] = [];
  private meterDot = h('span', { class: 'meter-dot' });
  private meterText = h('span', { class: 'meter-text' });
  private meterBar = h('span');
  private numpad: Numpad | null = null;

  constructor(handlers: QuizHandlers) {
    this.handlers = handlers;
    this.el = h('div', { class: 'quiz' });
  }

  /** 問題を表示する */
  show(q: Question, opts: ShowOptions): void {
    const head = h('div', { class: 'quiz-head' },
      h('span', { class: 'tag' }, opts.label),
      opts.numeric ? h('span', { class: 'tag kakuhen-tag' }, `確変 数値入力 残り${opts.kakuhenLeft ?? 0}問`) : null,
    );
    const meter = h('div', { class: 'meter' },
      this.meterDot, this.meterText,
      h('div', { class: 'meter-bar' }, this.meterBar),
    );
    const body: (Node | null)[] = [
      head,
      meter,
      h('div', { class: 'quiz-text' }, q.text),
      q.circuit ? h('div', { class: 'circuit-wrap' }, circuitSvg(q.circuit)) : null,
    ];

    this.buttons = [];
    this.numpad = null;
    if (opts.numeric) {
      this.numpad = new Numpad(q, (v, t) => this.handlers.onNumeric(v, t), () => this.handlers.onTap?.());
      body.push(this.numpad.el);
    } else {
      this.buttons = q.choices.map((c) =>
        h('button', { class: 'answer-btn', onClick: () => this.handlers.onChoice(c) }, `${c.text} ${q.unit}`),
      );
      body.push(h('div', { class: 'answers' }, ...this.buttons));
    }
    this.el.replaceChildren(...body.filter((x): x is Node => x !== null));
  }

  /**
   * 保留の色メーター。
   * @param color いま答えたときの保留の色
   * @param ratio 次に色が下がるまでの残り（1→0）。これ以上下がらないときは null
   */
  setMeter(color: HoldColor, ratio: number | null): void {
    this.meterDot.className = `meter-dot hold ${color}`;
    this.meterText.textContent = `いま正解すると ${HOLD_COLOR_NAMES[color]}保留`;
    this.meterBar.style.width = ratio === null ? '0%' : `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    this.meterBar.className = color;
  }

  /** 選んだ答えと正解に色を付け、ボタンを押せなくする */
  markChoices(q: Question, picked: Choice): void {
    q.choices.forEach((c, i) => {
      const b = this.buttons[i];
      b.disabled = true;
      if (c.correct) b.classList.add('is-correct');
      else if (c === picked) b.classList.add('is-wrong');
    });
  }

  /** 数値入力を受け付けないようにする */
  lockNumpad(): void {
    this.numpad?.lock();
  }

  /** 正解したときの短い表示 */
  showToast(content: Node | string, kind: 'good' | 'info' = 'good'): void {
    this.el.querySelector('.toast')?.remove();
    this.el.append(h('div', { class: `toast ${kind}` }, content));
  }

  /** 不正解のとき：選んだ答えのミスの型・解説・正しい答えを出す */
  showFeedback(q: Question, pickedText: string, mistake: MistakeType | null): void {
    const info = mistake ? MISTAKES[mistake] : null;
    const correctText = q.choices.find((c) => c.correct)?.text ?? String(q.answer);
    this.el.replaceChildren(
      h('div', { class: 'feedback' },
        h('div', { class: 'verdict' }, '× ざんねん'),
        h('div', {}, `あなたの答え：${pickedText} ${q.unit}`),
        info
          ? h('div', { class: 'mistake-box' },
            h('div', { class: 'mistake-name' }, `ミスの型：${info.label}`),
            h('div', {}, info.hint))
          : h('div', { class: 'mistake-box' },
            h('div', { class: 'mistake-name' }, 'ミスの型：判定できませんでした'),
            h('div', {}, '下の解き方と見くらべて、どこでずれたか確かめましょう。')),
        h('div', { class: 'answer-line' }, '正しい答え：', h('b', {}, `${correctText} ${q.unit}`)),
        h('div', { class: 'quiz-text muted' }, q.text),
        q.circuit ? h('div', { class: 'circuit-wrap' }, circuitSvg(q.circuit)) : null,
        h('div', { class: 'explain' }, q.explanation),
        h('button', { class: 'btn primary', onClick: () => this.handlers.onNext() }, '次の問題へ'),
      ),
    );
    this.el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
}

/** 数値入力用のテンキー。粒子数の問題では「係数 × 10ⁿ」の2つの欄を使う */
class Numpad {
  readonly el: HTMLElement;
  private coef = '';
  private exp = '';
  private field: 'coef' | 'exp' = 'coef';
  private coefBox: HTMLButtonElement;
  private expBox: HTMLButtonElement | null = null;
  private msg = h('div', { class: 'numpad-msg' });
  private locked = false;

  constructor(
    private q: Question,
    private submit: (value: number, text: string) => void,
    private tap: () => void,
  ) {
    const sci = q.scientific;
    this.coefBox = h('button', { class: 'num-field active', onClick: () => this.select('coef') });
    const display = h('div', { class: 'num-display' }, this.coefBox);
    if (sci) {
      this.expBox = h('button', { class: 'num-field exp', onClick: () => this.select('exp') });
      display.append(h('span', { class: 'times' }, '× 10'), h('sup', {}, this.expBox));
    }
    display.append(h('span', { class: 'num-unit' }, q.unit));

    const key = (label: string, action: () => void, cls = '') =>
      h('button', {
        class: `key ${cls}`,
        onClick: () => {
          if (this.locked) return;
          this.tap();
          action();
          this.render();
        },
      }, label);
    const digit = (d: string) => key(d, () => this.input(d));

    const keys = h('div', { class: 'keys' },
      digit('7'), digit('8'), digit('9'), key('⌫', () => this.back(), 'fn'),
      digit('4'), digit('5'), digit('6'), key('C', () => this.clear(), 'fn'),
      digit('1'), digit('2'), digit('3'),
      key('答える', () => this.trySubmit(), 'submit'),
      key('0', () => this.input('0'), sci ? '' : 'wide'),
      key('.', () => this.input('.')),
      sci ? key('±', () => this.toggleSign(), 'fn') : null,
    );

    this.el = h('div', { class: 'numpad' },
      display,
      sci ? h('div', { class: 'numpad-hint muted' }, '10 の右上の欄をタップすると指数を入力できます') : null,
      this.msg,
      keys,
    );
    this.render();
  }

  lock(): void {
    this.locked = true;
    this.el.classList.add('locked');
  }

  private select(f: 'coef' | 'exp'): void {
    if (this.locked) return;
    this.field = f;
    this.render();
  }

  private input(ch: string): void {
    this.msg.textContent = '';
    if (this.field === 'exp') {
      if (ch === '.' || this.exp.replace('-', '').length >= 3) return;
      this.exp += ch;
      return;
    }
    if (ch === '.' && this.coef.includes('.')) return;
    if (this.coef.length >= 10) return;
    this.coef = this.coef === '' && ch === '.' ? '0.' : this.coef + ch;
  }

  private back(): void {
    if (this.field === 'exp') this.exp = this.exp.slice(0, -1);
    else this.coef = this.coef.slice(0, -1);
  }

  private clear(): void {
    this.coef = '';
    this.exp = '';
    this.field = 'coef';
    this.msg.textContent = '';
  }

  private toggleSign(): void {
    this.field = 'exp';
    this.exp = this.exp.startsWith('-') ? this.exp.slice(1) : `-${this.exp}`;
  }

  private render(): void {
    this.coefBox.textContent = this.coef || ' ';
    this.coefBox.classList.toggle('active', this.field === 'coef');
    if (this.expBox) {
      this.expBox.textContent = this.exp || ' ';
      this.expBox.classList.toggle('active', this.field === 'exp');
    }
  }

  private trySubmit(): void {
    const c = Number(this.coef);
    if (this.coef === '' || this.coef === '.' || !Number.isFinite(c)) {
      this.msg.textContent = '数値を入力してください';
      return;
    }
    if (this.q.scientific) {
      const e = Number(this.exp);
      if (this.exp === '' || this.exp === '-' || !Number.isInteger(e)) {
        this.field = 'exp';
        this.msg.textContent = '10 の右上の指数も入力してください';
        return;
      }
      this.submit(c * 10 ** e, `${this.coef}×10${superscript(e)}`);
      return;
    }
    this.submit(c, this.coef);
  }
}
