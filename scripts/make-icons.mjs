// アプリのアイコンを作るスクリプト（外部の画像素材は使わない）。
// 図形（背景・パチンコ玉・原子の軌道）をコードで描き、SVG と PNG を public/icons に出力する。
// 使い方： npm run icons
//
// PNG は Node.js に入っている zlib だけで書き出している（追加のライブラリ不要）。

import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('../public/icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

// ---------- 図形の定義（512×512 の座標） ----------
const BG_TOP = [0x1d, 0x2a, 0x5c];
const BG_BOTTOM = [0x0b, 0x10, 0x20];
const BALL = { cx: 256, cy: 262, r: 132 };
const ORBIT = { cx: 256, cy: 262, rx: 200, ry: 70, angle: -28, width: 16, color: [0xff, 0x5f, 0xa2] };
const ELECTRON = { angleOnOrbit: 200, r: 24, color: [0xfb, 0xbf, 0x24] };

const rad = (d) => (d * Math.PI) / 180;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function electronPos() {
  const t = rad(ELECTRON.angleOnOrbit);
  const x = ORBIT.rx * Math.cos(t);
  const y = ORBIT.ry * Math.sin(t);
  const a = rad(ORBIT.angle);
  return { x: ORBIT.cx + x * Math.cos(a) - y * Math.sin(a), y: ORBIT.cy + x * Math.sin(a) + y * Math.cos(a) };
}

/** 点 (x, y) の色を返す（512×512 の座標） */
function colorAt(x, y) {
  // 背景（上から下へのグラデーション）
  let c = mix(BG_TOP, BG_BOTTOM, y / 512);

  // パチンコ玉（銀色の球）
  const dx = x - BALL.cx;
  const dy = y - BALL.cy;
  if (dx * dx + dy * dy <= BALL.r * BALL.r) {
    // 左上から光が当たっているように明るさを変える
    const lx = (x - (BALL.cx - 50)) / BALL.r;
    const ly = (y - (BALL.cy - 55)) / BALL.r;
    const d = Math.min(1, Math.sqrt(lx * lx + ly * ly) / 1.6);
    c = mix([255, 255, 255], [0x6b, 0x74, 0x96], d);
    // 光の反射
    const hx = (x - (BALL.cx - 48)) / 34;
    const hy = (y - (BALL.cy - 52)) / 24;
    if (hx * hx + hy * hy <= 1) c = [255, 255, 255];
  }

  // 原子の軌道（かたむけただえん）
  const a = rad(-ORBIT.angle);
  const ox = (x - ORBIT.cx) * Math.cos(a) - (y - ORBIT.cy) * Math.sin(a);
  const oy = (x - ORBIT.cx) * Math.sin(a) + (y - ORBIT.cy) * Math.cos(a);
  const k = Math.sqrt((ox / ORBIT.rx) ** 2 + (oy / ORBIT.ry) ** 2);
  const grad = Math.sqrt((ox / ORBIT.rx ** 2) ** 2 + (oy / ORBIT.ry ** 2) ** 2) || 1e-9;
  const dist = Math.abs(k - 1) / (grad / (k || 1e-9));
  // 玉の後ろを通る部分（上半分）は玉に隠す
  const behind = oy < 0 && dx * dx + dy * dy <= BALL.r * BALL.r;
  if (dist <= ORBIT.width / 2 && !behind) c = ORBIT.color;

  // 電子（金色の点）
  const e = electronPos();
  if ((x - e.x) ** 2 + (y - e.y) ** 2 <= ELECTRON.r ** 2) c = ELECTRON.color;
  return c;
}

// ---------- PNG の書き出し ----------
function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** size×size の PNG を作る（なめらかにするため 1画素を 4×4 に分けて平均する） */
function png(size) {
  const S = 4;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 3 + 1)] = 0; // 各行の先頭はフィルタ種別（0=なし）
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const x = ((px + (sx + 0.5) / S) / size) * 512;
          const y = ((py + (sy + 0.5) / S) / size) * 512;
          const c = colorAt(x, y);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const o = py * (size * 3 + 1) + 1 + px * 3;
      raw[o] = Math.round(r / (S * S));
      raw[o + 1] = Math.round(g / (S * S));
      raw[o + 2] = Math.round(b / (S * S));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // ビット深度
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- SVG の書き出し（同じ図形をSVGで） ----------
function svg() {
  const hex = (c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  const e = electronPos();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${hex(BG_TOP)}"/><stop offset="1" stop-color="${hex(BG_BOTTOM)}"/>
    </linearGradient>
    <radialGradient id="ball" cx="${BALL.cx - 50}" cy="${BALL.cy - 55}" r="${BALL.r * 1.6}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#6b7496"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <!-- 軌道の全体（玉の後ろ） -->
  <g transform="rotate(${ORBIT.angle} ${ORBIT.cx} ${ORBIT.cy})">
    <ellipse cx="${ORBIT.cx}" cy="${ORBIT.cy}" rx="${ORBIT.rx}" ry="${ORBIT.ry}" fill="none" stroke="${hex(ORBIT.color)}" stroke-width="${ORBIT.width}"/>
  </g>
  <circle cx="${BALL.cx}" cy="${BALL.cy}" r="${BALL.r}" fill="url(#ball)"/>
  <ellipse cx="${BALL.cx - 48}" cy="${BALL.cy - 52}" rx="34" ry="24" fill="#fff"/>
  <!-- 軌道の手前側（玉の前） -->
  <g transform="rotate(${ORBIT.angle} ${ORBIT.cx} ${ORBIT.cy})">
    <path d="M${ORBIT.cx - ORBIT.rx} ${ORBIT.cy} A${ORBIT.rx} ${ORBIT.ry} 0 0 0 ${ORBIT.cx + ORBIT.rx} ${ORBIT.cy}" fill="none" stroke="${hex(ORBIT.color)}" stroke-width="${ORBIT.width}"/>
  </g>
  <circle cx="${e.x.toFixed(1)}" cy="${e.y.toFixed(1)}" r="${ELECTRON.r}" fill="${hex(ELECTRON.color)}"/>
</svg>
`;
}

writeFileSync(new URL('icon.svg', OUT), svg());
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(new URL(name, OUT), png(size));
  console.log(`作成：public/icons/${name}`);
}
console.log('作成：public/icons/icon.svg');
