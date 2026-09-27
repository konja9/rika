// タイトル画面：ジャンルと難度を選んでスタートする。

import type { Difficulty } from '../core/types';
import { GENRE_NAMES, GENRES, type GenreChoice } from '../questions/index';
import type { App, Screen } from './app';
import { comma, h } from './dom';

const DIFF_NOTES: Record<Difficulty, string> = {
  1: '基本',
  2: '単位換算・2段階',
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
  );

  return { el };
}
