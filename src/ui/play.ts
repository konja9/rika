// プレイ画面：問題 → 回答 → 保留 → 抽選 → 当たり の流れをまとめる。
// 抽選は問題を解いている間も裏で順番に進む（本物のパチンコと同じ）。

import { HOLD_COLOR_NAMES, type HoldColor } from '../config';
import type { Choice, MistakeType, Question } from '../core/types';
import { holdColor, type SpinResult } from '../game/lottery';
import { applySpin, currentDifficulty, recordAnswer, takeSpin } from '../game/state';
import { GENRE_NAMES, generateQuestion } from '../questions/index';
import { recentMistakeCounts, recordStats } from '../storage/save';
import type { App, Screen } from './app';
import { comma, h } from './dom';
import { Machine } from './machine';
import { QuizView } from './quiz';

/** 画面が裏に回っている間は止まるストップウォッチ */
class Stopwatch {
  private acc = 0;
  private startedAt: number | null = null;

  restart(): void {
    this.acc = 0;
    this.startedAt = performance.now();
  }
  pause(): void {
    if (this.startedAt !== null) {
      this.acc += performance.now() - this.startedAt;
      this.startedAt = null;
    }
  }
  resume(): void {
    if (this.startedAt === null) this.startedAt = performance.now();
  }
  get seconds(): number {
    const running = this.startedAt === null ? 0 : performance.now() - this.startedAt;
    return (this.acc + running) / 1000;
  }
}

export function playScreen(app: App): Screen {
  const game = app.data.game;
  const settings = app.data.settings;

  const machine = new Machine();
  const quiz = new QuizView({ onChoice, onNext });
  const ballsEl = h('b');
  const watch = new Stopwatch();

  let question: Question;
  /** 今の問題に答えたか */
  let answered = false;
  /** 不正解の解説を表示中か */
  let feedbackOpen = false;
  /** 抽選の演出中か */
  let spinning = false;
  /** 大当たりの画面を表示中か */
  let overlayOpen = false;
  let destroyed = false;
  let nextTimer: ReturnType<typeof setTimeout> | null = null;

  const el = h('div', { class: 'screen play' },
    h('div', { class: 'topbar' },
      h('button', { class: 'btn small', onClick: () => app.go('title') }, '← メニュー'),
      h('span', { class: 'balls' }, '持ち玉 ', ballsEl, ' 玉'),
    ),
    machine.el,
    quiz.el,
  );

  function refresh(): void {
    ballsEl.textContent = comma(game.balls);
    machine.renderStatus(game);
  }

  // ---------- 出題 ----------

  function nextQuestion(): void {
    if (nextTimer) clearTimeout(nextTimer);
    nextTimer = null;
    answered = false;
    feedbackOpen = false;
    const difficulty = currentDifficulty(game, settings.difficulty);
    question = generateQuestion({
      genre: settings.genre,
      difficulty,
      rng: app.rng,
      mistakeCounts: recentMistakeCounts(app.data),
    });
    quiz.show(question, `★${difficulty} ${GENRE_NAMES[question.genre]}`);
    // 開発中だけ、自動テストから今の問題を読めるようにする（公開版には含まれない）
    if (import.meta.env.DEV) (window as unknown as { __rikaQuestion: Question }).__rikaQuestion = question;
    watch.restart();
    if (overlayOpen || document.hidden) watch.pause();
  }

  // ---------- 回答 ----------

  function onChoice(choice: Choice): void {
    if (answered) return;
    quiz.markChoices(question, choice);
    handleAnswer(choice.correct, choice.correct ? null : (choice.mistake ?? 'other'), choice.text);
  }

  function handleAnswer(correct: boolean, mistake: MistakeType | null, pickedText: string): void {
    answered = true;
    const elapsed = watch.seconds;
    watch.pause();

    recordStats(app.data, question.genre, correct, mistake);
    const color: HoldColor | null = correct ? holdColor(question.difficulty, elapsed, false) : null;
    const outcome = recordAnswer(game, correct, color);
    app.save();
    machine.renderHolds(game.holds, outcome.holdAdded ? game.holds.length - 1 : -1);

    if (correct) {
      quiz.showToast(
        outcome.holdAdded
          ? `正解！ ${HOLD_COLOR_NAMES[color!]}保留 GET（${elapsed.toFixed(1)}秒）`
          : '正解！（保留MAX）',
      );
      nextTimer = setTimeout(nextQuestion, 900);
    } else {
      feedbackOpen = true;
      quiz.showFeedback(question, pickedText, mistake);
    }
    void pump();
  }

  function onNext(): void {
    nextQuestion();
  }

  // ---------- 抽選 ----------

  /** 保留があれば順番に抽選する */
  async function pump(): Promise<void> {
    if (spinning || overlayOpen || destroyed) return;
    // 前回の演出の途中で画面を離れていたら、その結果から続ける
    const result = game.pending ?? takeSpin(game, app.rng);
    if (!result) return;
    spinning = true;
    app.save();
    machine.renderHolds(game.holds);
    await machine.spin(result);
    if (destroyed) return; // 結果は pending に残っているので、次に開いたときに反映される
    applySpin(game, result);
    app.save();
    refresh();
    spinning = false;
    if (result.hit) await showBigHit(result);
    if (!destroyed) void pump();
  }

  /** 大当たりの画面。「つづける」を押すまで問題の時間を止める */
  function showBigHit(result: SpinResult): Promise<void> {
    overlayOpen = true;
    watch.pause();
    return new Promise((resolve) => {
      const overlay = h('div', { class: 'overlay' },
        h('div', { class: 'bighit' },
          h('h2', {}, '大当たり！'),
          h('div', { class: 'reels-big' }, result.reels.join('')),
          h('div', { class: 'payout' }, `+${comma(result.payout)} 玉`),
          h('button', {
            class: 'btn primary',
            onClick: () => {
              overlay.remove();
              overlayOpen = false;
              // 大当たりの後は新しい問題から（状態が変わっていることがあるため）
              if (!feedbackOpen) nextQuestion();
              resolve();
            },
          }, 'つづける'),
        ),
      );
      document.body.append(overlay);
    });
  }

  // ---------- 画面が裏に回ったら時間を止める ----------

  function onVisibility(): void {
    if (document.hidden) watch.pause();
    else if (!answered && !overlayOpen) watch.resume();
  }
  document.addEventListener('visibilitychange', onVisibility);

  // 開始
  refresh();
  machine.renderHolds(game.holds);
  nextQuestion();
  void pump();

  return {
    el,
    destroy() {
      destroyed = true;
      if (nextTimer) clearTimeout(nextTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      document.querySelectorAll('.overlay').forEach((o) => o.remove());
    },
  };
}
