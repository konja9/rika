// 記録画面：遊びの記録、ジャンル別の正答率、ミスの型ごとの回数、苦手の出し分けの状況。

import { CONFIG } from '../config';
import type { MistakeType } from '../core/types';
import { GENRE_NAMES, GENRES } from '../questions/index';
import { MISTAKE_TYPES, MISTAKES } from '../questions/mistakes';
import { recentMistakeCounts } from '../storage/save';
import type { App, Screen } from './app';
import { comma, h } from './dom';

function row(label: string, value: string): HTMLElement {
  return h('div', { class: 'stat-row' }, h('span', {}, label), h('b', {}, value));
}

export function statsScreen(app: App): Screen {
  const { game, stats } = app.data;

  // 遊びの記録
  const playCard = h('div', { class: 'card' },
    h('h3', {}, '遊びの記録'),
    row('持ち玉', `${comma(game.balls)} 玉`),
    row('抽選した回数', `${comma(game.spins)} 回`),
    row('大当たり', `${comma(game.bigHits)} 回`),
    row('うち確変に入った回数', `${comma(game.kakuhenHits)} 回`),
    row('最高連チャン', `${comma(game.maxChain)} 連`),
  );

  // ジャンル別の正答率
  const genreCard = h('div', { class: 'card' }, h('h3', {}, 'ジャンル別の正答率'));
  let totalAnswered = 0;
  let totalCorrect = 0;
  for (const g of GENRES) {
    const s = stats.byGenre[g];
    totalAnswered += s.answered;
    totalCorrect += s.correct;
    const rate = s.answered ? s.correct / s.answered : 0;
    const bar = h('div', { class: 'bar' }, h('span'));
    (bar.firstElementChild as HTMLElement).style.width = `${rate * 100}%`;
    genreCard.append(
      h('div', { class: 'genre-stat' },
        h('div', { class: 'row' },
          h('span', { class: 'grow' }, GENRE_NAMES[g]),
          h('b', {}, s.answered ? `${Math.round(rate * 100)}%` : '—'),
          h('span', { class: 'muted small' }, `${s.correct}/${s.answered}問`),
        ),
        bar,
      ),
    );
  }
  genreCard.append(
    h('div', { class: 'muted small total-line' },
      `合計 ${totalCorrect}/${totalAnswered}問正解`,
      totalAnswered ? `（${Math.round((totalCorrect / totalAnswered) * 100)}%）` : ''),
  );

  // ミスの型
  const recent = recentMistakeCounts(app.data);
  const mistakeCard = h('div', { class: 'card' },
    h('h3', {}, 'ミスの型ごとの回数'),
    h('p', { class: 'muted small' },
      `直近${CONFIG.weakness.recentWindow}問でよく出たミスの型は、それに関係する問題を少し多めに出しています（最大${CONFIG.weakness.maxFactor}倍）。`),
  );
  const list = MISTAKE_TYPES
    .map((m) => ({ m, n: stats.mistakes[m] }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  if (list.length === 0) {
    mistakeCard.append(h('p', { class: 'muted' }, 'まだミスの記録はありません。'));
  }
  for (const { m, n } of list) mistakeCard.append(mistakeItem(m, n, recent[m] ?? 0));

  const el = h('div', { class: 'screen' },
    h('div', { class: 'topbar' },
      h('button', { class: 'btn small', onClick: () => app.go('title') }, '← メニュー'),
      h('h2', { class: 'grow center' }, '記録'),
      h('span', { class: 'spacer' }),
    ),
    playCard,
    genreCard,
    mistakeCard,
  );
  return { el };
}

function mistakeItem(m: MistakeType, total: number, recent: number): HTMLElement {
  const info = MISTAKES[m];
  const weak = recent > 0 && m !== 'other';
  return h('details', { class: 'mistake-item' },
    h('summary', {},
      h('span', { class: 'grow' },
        info.label,
        weak ? h('span', { class: 'weak-badge' }, `多めに出題中（直近${recent}回）`) : null,
      ),
      h('b', {}, `${total}回`),
    ),
    h('p', {}, info.hint),
  );
}
