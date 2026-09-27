// アプリの入り口：保存データを読み込み、タイトル画面を出す。

import './ui/style.css';
import { createRng, randomSeed } from './core/random';
import { settlePending } from './game/state';
import { loadSave, writeSave } from './storage/save';
import type { App, Screen, ScreenName } from './ui/app';
import { playScreen } from './ui/play';
import { titleScreen } from './ui/title';

const root = document.getElementById('app')!;

const screens: Record<ScreenName, (app: App) => Screen> = {
  title: titleScreen,
  play: playScreen,
  stats: titleScreen, // 記録画面は後で追加
  settings: titleScreen, // 設定画面は後で追加
};

let current: Screen | null = null;

const app: App = {
  data: loadSave(),
  rng: createRng(randomSeed()),
  save() {
    writeSave(app.data);
  },
  go(name) {
    current?.destroy?.();
    current = screens[name](app);
    root.replaceChildren(current.el);
    window.scrollTo(0, 0);
  },
};

// 前回、抽選の演出中にアプリを閉じていたら、その結果をここで反映する
settlePending(app.data.game);
app.save();
app.go('title');
