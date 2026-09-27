// 数値の丸め・桁数チェック・表示の整形。

/** 小数の計算で出る小さな誤差（0.1+0.2=0.30000000000000004 など）を消す */
export function clean(x: number): number {
  if (x === 0 || !Number.isFinite(x)) return x;
  return Number(x.toPrecision(12));
}

/** 小数第2位までに収まっているか（整数もOK） */
export function isAtMost2Decimals(x: number): boolean {
  if (!Number.isFinite(x)) return false;
  const scaled = x * 100;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

/** ほぼ等しいか（相対誤差で比べる） */
export function nearlyEqual(a: number, b: number, rel = 1e-9): boolean {
  if (a === b) return true;
  return Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b));
}

/** a × 10^n の形に分ける（aは1以上10未満） */
export function toSci(x: number): { coef: number; exp: number } {
  if (x === 0) return { coef: 0, exp: 0 };
  let exp = Math.floor(Math.log10(Math.abs(x)));
  let coef = clean(x / 10 ** exp);
  // 丸め誤差で 10.0 や 0.999… になったときの調整
  if (Math.abs(coef) >= 10) {
    coef = clean(coef / 10);
    exp += 1;
  } else if (Math.abs(coef) < 1) {
    coef = clean(coef * 10);
    exp -= 1;
  }
  return { coef, exp };
}

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻',
};

/** 指数を上付き文字にする（23 → ²³） */
export function superscript(n: number): string {
  return String(n).split('').map((c) => SUPERSCRIPT[c] ?? c).join('');
}

/** 末尾の余分な0を消して文字列にする（2.50 → 2.5） */
function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}

/** 指数表示の係数を整形（3 → 3.0、1.25 → 1.25、1.234 → 1.23） */
function formatCoef(coef: number): string {
  const rounded = Math.round(coef * 100) / 100;
  if (Number.isInteger(rounded)) return rounded.toFixed(1);
  return trimZeros(rounded.toFixed(2));
}

/** a×10ⁿ の形で表示する */
export function formatSci(x: number): string {
  const { coef, exp } = toSci(x);
  // 係数を丸めた結果 10.0 になる場合（9.996 など）はくり上げる
  if (Math.round(coef * 100) / 100 >= 10) return `${formatCoef(coef / 10)}×10${superscript(exp + 1)}`;
  return `${formatCoef(coef)}×10${superscript(exp)}`;
}

/**
 * 数値を画面に出す形にする。
 * - scientific が true、または極端に大きい/小さい数は a×10ⁿ の形
 * - 1000以上は整数に丸める（正解が1000以上になるときは整数だけにしている）
 * - 小数第2位までに収まる数はそのまま
 * - それ以外は有効数字3桁に丸める（100以上は整数に丸める）
 */
export function formatNumber(x: number, scientific = false): string {
  const abs = Math.abs(x);
  if (scientific || (abs !== 0 && (abs >= 1e6 || abs < 1e-4))) return formatSci(x);
  if (abs >= 1000) return String(Math.round(x));
  if (isAtMost2Decimals(x)) return trimZeros((Math.round(x * 100) / 100).toFixed(2));
  if (abs >= 100) return String(Math.round(x));
  return trimZeros(Number(x.toPrecision(3)).toString());
}

/** 正解として使える数か：小数第2位まで、かつ1000以上なら整数 */
export function isNiceAnswer(x: number): boolean {
  if (!isAtMost2Decimals(x) || x <= 0) return false;
  return x < 1000 || Number.isInteger(clean(x));
}
