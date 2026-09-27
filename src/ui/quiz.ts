// 問題の表示と回答の受け付け（4択）。正解・不正解の表示もここで行う。

import type { Choice, MistakeType, Question } from '../core/types';
import { MISTAKES } from '../questions/mistakes';
import { h } from './dom';

export interface QuizHandlers {
  /** 4択で選んだとき */
  onChoice(choice: Choice): void;
  /** 不正解の解説を読んで「次の問題へ」を押したとき */
  onNext(): void;
}

export class QuizView {
  readonly el: HTMLElement;
  private handlers: QuizHandlers;
  private buttons: HTMLButtonElement[] = [];

  constructor(handlers: QuizHandlers) {
    this.handlers = handlers;
    this.el = h('div', { class: 'quiz' });
  }

  /** 問題を表示する */
  show(q: Question, label: string): void {
    this.buttons = q.choices.map((c) =>
      h('button', { class: 'answer-btn', onClick: () => this.handlers.onChoice(c) }, `${c.text} ${q.unit}`),
    );
    this.el.replaceChildren(
      h('div', { class: 'quiz-head' }, h('span', { class: 'tag' }, label)),
      h('div', { class: 'quiz-text' }, q.text),
      h('div', { class: 'answers' }, ...this.buttons),
    );
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

  /** 正解したときの短い表示 */
  showToast(content: Node | string): void {
    this.el.querySelector('.toast')?.remove();
    this.el.append(h('div', { class: 'toast' }, content));
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
        h('div', { class: 'explain' }, q.explanation),
        h('button', { class: 'btn primary', onClick: () => this.handlers.onNext() }, '次の問題へ'),
      ),
    );
  }
}
