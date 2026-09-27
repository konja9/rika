// 合成抵抗の回路図を、回路の形（Circuit）からSVGで描く。

import { formatNumber } from '../core/numbers';
import type { Circuit } from '../core/types';

const NS = 'http://www.w3.org/2000/svg';

// 大きさの設定
const R_W = 84; // 抵抗1つ分の横幅
const R_H = 44; // 抵抗1つ分の高さ
const BOX_W = 62; // 抵抗の四角の幅
const BOX_H = 22;
const RAIL = 14; // 並列の縦線と部品のすき間
const GAP = 6; // 並列の部品どうしのすき間
const LEAD = 22; // 端子から回路までの線

interface Size { w: number; h: number }

function size(c: Circuit): Size {
  if (c.kind === 'R') return { w: R_W, h: R_H };
  const sizes = c.parts.map(size);
  if (c.kind === 'series') {
    return { w: sizes.reduce((s, x) => s + x.w, 0), h: Math.max(...sizes.map((x) => x.h)) };
  }
  return {
    w: Math.max(...sizes.map((x) => x.w)) + RAIL * 2,
    h: sizes.reduce((s, x) => s + x.h, 0) + GAP * (sizes.length - 1),
  };
}

function el(tag: string, attrs: Record<string, string | number>, text?: string): SVGElement {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text) e.textContent = text;
  return e;
}

function line(g: SVGElement, x1: number, y1: number, x2: number, y2: number): void {
  if (x1 === x2 && y1 === y2) return;
  g.append(el('line', { x1, y1, x2, y2, class: 'wire' }));
}

/** (x, y) を左端・中心の高さとして c を描く */
function draw(g: SVGElement, c: Circuit, x: number, y: number): void {
  const { w } = size(c);
  if (c.kind === 'R') {
    const bx = x + (R_W - BOX_W) / 2;
    line(g, x, y, bx, y);
    g.append(el('rect', { x: bx, y: y - BOX_H / 2, width: BOX_W, height: BOX_H, rx: 3, class: 'res' }));
    line(g, bx + BOX_W, y, x + R_W, y);
    g.append(el('text', { x: x + R_W / 2, y: y - BOX_H / 2 - 4, class: 'res-name' }, c.name));
    g.append(el('text', { x: x + R_W / 2, y: y + 4.5, class: 'res-val' }, `${formatNumber(c.ohm)}Ω`));
    return;
  }
  if (c.kind === 'series') {
    let cx = x;
    for (const p of c.parts) {
      draw(g, p, cx, y);
      cx += size(p).w;
    }
    return;
  }
  // 並列：上から順に並べ、左右を縦線でつなぐ
  const { h } = size(c);
  const left = x + RAIL / 2;
  const right = x + w - RAIL / 2;
  let top = y - h / 2;
  const ys: number[] = [];
  for (const p of c.parts) {
    const ps = size(p);
    const py = top + ps.h / 2;
    ys.push(py);
    line(g, left, py, x + RAIL, py);
    draw(g, p, x + RAIL, py);
    line(g, x + RAIL + ps.w, py, right, py);
    top += ps.h + GAP;
  }
  line(g, x, y, left, y);
  line(g, left, Math.min(...ys), left, Math.max(...ys));
  line(g, right, Math.min(...ys), right, Math.max(...ys));
  line(g, right, y, x + w, y);
}

/** 回路図のSVGを作る */
export function circuitSvg(c: Circuit): SVGSVGElement {
  const s = size(c);
  const W = s.w + LEAD * 2 + 12;
  const H = s.h + 12;
  const svg = el('svg', {
    viewBox: `0 0 ${W} ${H}`,
    class: 'circuit',
    role: 'img',
    'aria-label': '回路図',
  }) as SVGSVGElement;
  const g = el('g', {});
  const y = H / 2;
  const x0 = 6;
  g.append(el('circle', { cx: x0 + 3, cy: y, r: 3.5, class: 'terminal' }));
  line(g, x0 + 3, y, x0 + LEAD, y);
  draw(g, c, x0 + LEAD, y);
  line(g, x0 + LEAD + s.w, y, W - x0 - 3, y);
  g.append(el('circle', { cx: W - x0 - 3, cy: y, r: 3.5, class: 'terminal' }));
  svg.append(g);
  return svg;
}
