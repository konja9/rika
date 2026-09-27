// 画面の部品（HTML要素）を短く書くための小さな道具。

type Child = Node | string | number | null | undefined | false;

interface Props {
  class?: string;
  text?: string;
  /** そのほかの属性（type, disabled, aria-label など） */
  attrs?: Record<string, string | boolean>;
  /** クリックしたときの処理 */
  onClick?: (e: MouseEvent) => void;
}

/** HTML要素を作る。h('button', { class: 'big', onClick }, '押す') のように使う */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.text !== undefined) el.textContent = props.text;
  for (const [k, v] of Object.entries(props.attrs ?? {})) {
    if (v === false) continue;
    el.setAttribute(k, v === true ? '' : v);
  }
  const onClick = props.onClick;
  if (onClick) el.addEventListener('click', (e) => onClick(e as MouseEvent));
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'number' ? String(c) : c);
  }
  return el;
}

/** 指定したミリ秒だけ待つ */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 3桁ごとにカンマを付ける（12500 → 12,500） */
export function comma(n: number): string {
  return Math.round(n).toLocaleString('ja-JP');
}
