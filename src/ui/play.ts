// プレイ画面：問題 → 回答 → 保留 → 抽選 → 当たり の流れをまとめる。
// 抽選は問題を解いている間も裏で順番に進む（本物のパチンコと同じ）。

import { sound } from '../audio/sound';
import { VIBES, vibrate } from '../audio/vibrate';
import { CONFIG, HOLD_COLOR_NAMES, HOLD_COLORS, type HoldColor } from '../config';
import type { Choice, MistakeType, Question } from '../core/types';
import { holdColor, holdColorMeter, type SpinResult } from '../game/lottery';
import { applySpin, currentDifficulty, isNumericMode, recordAnswer, takeSpin } from '../game/state';
import { checkNumeric, GENRE_NAMES, generateQuestion } from '../questions/index';
import { recentMistakeCounts, recordStats } from '../storage/save';
import type { App, Screen } from './app';
import { comma, h } from './dom';
import { Machine } from './machine';
import { QuizView } from './quiz';

/** 画面が裏に回っている間などは止められるストップウォッチ */
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
  const quiz = new QuizView({ onChoice, onNumeric, onNext: () => nextQuestion(), onTap: () => sound.tap() });
  const ballsEl = h('b');
  const watch = new Stopwatch();

  let question: Question;
  /** 今の問題を数値入力で出したか */
  let numeric = false;
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
    numeric = isNumericMode(game);
    question = generateQuestion({
      genre: settings.genre,
      difficulty,
      rng: app.rng,
      mistakeCounts: recentMistakeCounts(app.data),
    });
    quiz.show(question, {
      label: `★${difficulty} ${GENRE_NAMES[question.genre]}`,
      numeric,
      kakuhenLeft: game.kakuhenLeft,
    });
    // 開発中だけ、自動テストから今の問題を読めるようにする（公開版には含まれない）
    if (import.meta.env.DEV) (window as unknown as { __rikaQuestion: Question }).__rikaQuestion = question;
    watch.restart();
    if (overlayOpen || document.hidden) watch.pause();
    updateMeter();
  }

  /** 「いま正解すると何色の保留か」のメーターを更新する */
  function updateMeter(): void {
    if (answered || !question) return;
    const m = holdColorMeter(question.difficulty, watch.seconds, numeric);
    quiz.setMeter(m.color, m.ratio);
  }
  const meterTimer = setInterval(updateMeter, 100);

  // ---------- 回答 ----------

  function onChoice(choice: Choice): void {
    if (answered) return;
    quiz.markChoices(question, choice);
    handleAnswer(choice.correct, choice.correct ? null : (choice.mistake ?? 'other'), choice.text);
  }

  function onNumeric(value: number, text: string): void {
    if (answered) return;
    quiz.lockNumpad();
    const r = checkNumeric(question, value);
    handleAnswer(r.correct, r.correct ? null : r.mistake, text);
  }

  function handleAnswer(correct: boolean, mistake: MistakeType | null, pickedText: string): void {
    answered = true;
    const elapsed = watch.seconds;
    watch.pause();

    // 記録には、型がわからない誤答も「その他」として数える
    recordStats(app.data, question.genre, correct, correct ? null : (mistake ?? 'other'));
    const color: HoldColor | null = correct ? holdColor(question.difficulty, elapsed, numeric) : null;
    const outcome = recordAnswer(game, correct, color);
    app.save();
    machine.renderHolds(game.holds, outcome.holdAdded ? game.holds.length - 1 : -1);
    refresh();

    if (correct) {
      sound.correct();
      vibrate(VIBES.correct);
      if (outcome.holdAdded) sound.hold(HOLD_COLORS.indexOf(color!));
      const msg = outcome.holdAdded
        ? h('span', {}, '正解！ ', h('span', { class: `hold inline ${color}` }), ` ${HOLD_COLOR_NAMES[color!]}保留 GET（${elapsed.toFixed(1)}秒）`)
        : '正解！（保留MAX：抽選が終わるのを待とう）';
      quiz.showToast(msg);
      nextTimer = setTimeout(nextQuestion, outcome.kakuhenEnded ? 1800 : 1000);
    } else {
      sound.wrong();
      vibrate(VIBES.wrong);
      feedbackOpen = true;
      quiz.showFeedback(question, pickedText, mistake);
    }
    if (outcome.kakuhenEnded) {
      sound.kakuhenEnd();
      machine.setMessage('確変終了', 'lose');
      if (correct) quiz.showToast('確変終了… 通常にもどります', 'info');
    }
    void pump();
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
    sound.bigHit();
    vibrate(result.kakuhen ? VIBES.kakuhen : VIBES.bigHit);
    if (result.kakuhen) sound.kakuhenIn();
    return new Promise((resolve) => {
      const overlay = h('div', { class: 'overlay' },
        h('div', { class: `bighit${result.kakuhen ? ' is-kakuhen' : ''}` },
          h('h2', {}, '大当たり！'),
          h('div', { class: 'reels-big' }, result.reels.join('')),
          h('div', { class: 'payout' }, `+${comma(result.payout)} 玉`),
          result.kakuhen
            ? h('div', { class: 'kakuhen-in' }, '確変突入！',
              h('div', { class: 'kakuhen-sub' },
                `次の${CONFIG.kakuhenQuestions}問は当たりやすさアップ！`, h('br'),
                'そのかわり難度が上がり、答えは数値入力'))
            : h('div', { class: 'normal-in' }, game.chain > 1 ? `${game.chain}連チャンで終了` : '通常大当たり'),
          h('button', {
            class: 'btn primary',
            onClick: () => {
              sound.tap();
              overlay.remove();
              overlayOpen = false;
              // 大当たりの後は新しい問題から（確変の始まり・終わりで出し方が変わるため）
              if (!feedbackOpen) nextQuestion();
              else if (!answered) watch.resume();
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
      clearInterval(meterTimer);
      machine.dispose();
      document.removeEventListener('visibilitychange', onVisibility);
      document.querySelectorAll('.overlay').forEach((o) => o.remove());
    },
  };
}
