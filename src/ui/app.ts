// 画面どうしで共有するもの（保存データ・乱数・画面の切り替え）。

import type { Rng } from '../core/random';
import type { SaveData } from '../storage/save';

export type ScreenName = 'title' | 'play' | 'stats' | 'settings';

/** 1つの画面 */
export interface Screen {
  el: HTMLElement;
  /** 画面を離れるときの後片付け */
  destroy?: () => void;
}

export interface App {
  data: SaveData;
  rng: Rng;
  /** 今のデータを保存する */
  save(): void;
  /** 画面を切り替える */
  go(name: ScreenName): void;
}
