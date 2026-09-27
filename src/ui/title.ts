// タイトル画面：ジャンルと難度を選んでスタートする。

import { CONFIG } from '../config';
import type { Difficulty } from '../core/types';
import { GENRE_NAMES, GENRES, type GenreChoice } from '../questions/index';
import type { App, Screen } from './app';
import { comma, h } from './dom';

const DIFF_NOTES: Record<Difficulty, string> = {
  1: '基本',
  2: '標準',
  3: '応用',
};

export function titleScreen(app: App): Screen {
  const s = app.data.settings;
  const g = app.data.game;

  const genreChoices: { id: GenreChoice; label: string }[] = [
    { id: 'mix', label: 'ミックス' },
    ...GENRES.map((id) => ({ id, label: GENRE_NAMES[id] })),
  ];

  const genreGrid = h('div', { class: 'choice-grid' });
  const diffGrid = h('div', { class: 'choice-grid three' });

  function renderChoices(): void {
    genreGrid.replaceChildren(
      ...genreChoices.map((c) =>
        h('button', {
          class: `btn${s.genre === c.id ? ' selected' : ''}`,
          attrs: { 'aria-pressed': String(s.genre === c.id) },
          onClick: () => {
            s.genre = c.id;
            app.save();
            renderChoices();
          },
        }, c.label),
      ),
    );
    diffGrid.replaceChildren(
      ...([1, 2, 3] as Difficulty[]).map((d) =>
        h('button', {
          class: `btn${s.difficulty === d ? ' selected' : ''}`,
          attrs: { 'aria-pressed': String(s.difficulty === d) },
          onClick: () => {
            s.difficulty = d;
            app.save();
            renderChoices();
          },
        }, '★'.repeat(d), h('span', { class: 'diff-note' }, DIFF_NOTES[d])),
      ),
    );
  }
  renderChoices();

  const el = h('div', { class: 'screen' },
    h('div', { class: 'title-logo' },
      h('h1', {}, 'リカパチ'),
      h('p', {}, '理科の計算 × パチンコ'),
    ),
    h('div', { class: 'card center total-balls' },
      '持ち玉 ', h('b', {}, comma(g.balls)), ' 玉',
      g.mode === 'kakuhen' ? h('div', { class: 'kakuhen-note' }, `確変中！（残り${g.kakuhenLeft}問）`) : null,
    ),
    h('div', {}, h('div', { class: 'section-label' }, 'ジャンル'), genreGrid),
    h('div', {},
      h('div', { class: 'section-label' }, '難度（難しいほど保留の色が上がる）'),
      diffGrid,
    ),
    h('button', { class: 'btn primary', onClick: () => app.go('play') }, 'スタート'),
    h('div', { class: 'menu-row' },
      h('button', { class: 'btn', onClick: () => app.go('stats') }, '記録'),
      h('button', { class: 'btn', onClick: () => app.go('settings') }, '設定'),
    ),
    howToPlay(),
  );

  return { el };
}

/** 遊び方（タップで開く） */
function howToPlay(): HTMLElement {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const r = CONFIG.hitRate.normal;
  return h('details', { class: 'card howto' },
    h('summary', {}, '遊び方'),
    h('ol', {},
      h('li', {}, '理科の計算問題に正解すると「保留」が1つたまります（最大4つ）。'),
      h('li', {}, '保留は自動で順番に抽選されます。3つそろえば大当たりで玉がもらえます。'),
      h('li', {}, `速く解くほど、難しい問題ほど保留の色が上がり、当たりやすくなります。白${pct(r.white)}・青${pct(r.blue)}・緑${pct(r.green)}・赤${pct(r.red)}・金${pct(r.gold)}。`),
      h('li', {}, `大当たりの${pct(CONFIG.kakuhenRate)}で「確変」に入ります。確変中の${CONFIG.kakuhenQuestions}問は当たりやすいかわりに、問題が難しくなり、答えは数値で入力します。`),
      h('li', {}, 'まちがえると保留はたまりません。どんなミスだったかと解き方が出るので、確かめてから次へ進みましょう。'),
    ),
    h('p', { class: 'muted small' }, '当たりの抽選は正解したあとにだけ行われます。正解しないと当たりは出ません。'),
  );
}
