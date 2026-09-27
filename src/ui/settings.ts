// 設定画面：効果音・振動、バックアップ（JSONの書き出し・読み込み）、リセット。

import { sound } from '../audio/sound';
import { canVibrate, setVibration, vibrate, VIBES } from '../audio/vibrate';
import { exportJson, importJson, resetSave, writeSave } from '../storage/save';
import type { App, Screen } from './app';
import { h } from './dom';

export function settingsScreen(app: App): Screen {
  const s = app.data.settings;
  const msg = h('div', { class: 'settings-msg', attrs: { role: 'status' } });

  function say(text: string, ok = true): void {
    msg.textContent = text;
    msg.className = `settings-msg ${ok ? 'ok' : 'ng'}`;
  }

  // ---------- 効果音・振動 ----------
  function toggle(label: string, get: () => boolean, set: (v: boolean) => void, note?: string, disabled = false) {
    const btn = h('button', {
      class: 'switch',
      attrs: { role: 'switch', 'aria-checked': String(get()), disabled },
      onClick: () => {
        set(!get());
        btn.setAttribute('aria-checked', String(get()));
        app.save();
      },
    }, h('span', { class: 'knob' }));
    return h('div', { class: 'setting-row' },
      h('div', { class: 'grow' }, h('div', {}, label), note ? h('div', { class: 'muted small' }, note) : null),
      btn,
    );
  }

  const soundRow = toggle('効果音', () => s.sound, (v) => {
    s.sound = v;
    sound.enabled = v;
    if (v) {
      sound.unlock();
      sound.correct();
    }
  }, 'マナーモードのときは鳴らないことがあります');

  const vibeRow = toggle('振動', () => s.vibration, (v) => {
    s.vibration = v;
    setVibration(v);
    if (v) vibrate(VIBES.correct);
  }, canVibrate ? '大当たりやリーチのときに振動します' : 'この端末（iPhoneなど）は振動に対応していません', !canVibrate);

  // ---------- バックアップ ----------
  function download(): void {
    const json = exportJson(app.data);
    const blob = new Blob([json], { type: 'application/json' });
    const a = h('a', {
      attrs: {
        href: URL.createObjectURL(blob),
        download: `rika-pachi-backup-${new Date().toISOString().slice(0, 10)}.json`,
      },
    });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    say('バックアップファイルを書き出しました。');
  }

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(exportJson(app.data));
      say('バックアップをコピーしました。メモ帳などに貼り付けて保存してください。');
    } catch {
      say('コピーできませんでした。「ファイルに書き出す」を使ってください。', false);
    }
  }

  function load(text: string): void {
    try {
      const data = importJson(text);
      if (!confirm('今の記録をバックアップの内容で上書きします。よろしいですか？')) return;
      app.data = data;
      writeSave(data);
      sound.enabled = data.settings.sound;
      setVibration(data.settings.vibration);
      say('バックアップを読み込みました。');
      app.go('settings');
    } catch (e) {
      say(e instanceof Error ? e.message : '読み込めませんでした。', false);
    }
  }

  const fileInput = h('input', { attrs: { type: 'file', accept: 'application/json,.json', hidden: true } });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (file) load(await file.text());
    fileInput.value = '';
  });
  const pasteArea = h('textarea', { class: 'paste', attrs: { rows: '4', placeholder: 'ここにバックアップの文字を貼り付け' } });

  // ---------- リセット ----------
  function reset(): void {
    if (!confirm('すべての記録（持ち玉・正答率・ミスの記録）を消します。よろしいですか？')) return;
    if (!confirm('本当に消しますか？ 元にはもどせません。')) return;
    app.data = resetSave();
    sound.enabled = app.data.settings.sound;
    setVibration(app.data.settings.vibration);
    app.go('settings');
  }

  const el = h('div', { class: 'screen' },
    h('div', { class: 'topbar' },
      h('button', { class: 'btn small', onClick: () => app.go('title') }, '← メニュー'),
      h('h2', { class: 'grow center' }, '設定'),
      h('span', { class: 'spacer' }),
    ),
    h('div', { class: 'card' }, soundRow, vibeRow),
    h('div', { class: 'card stack' },
      h('h3', {}, 'バックアップ'),
      h('p', { class: 'muted small' }, '記録はこの端末のブラウザの中に保存されています。機種変更やデータ消去に備えて、ときどき書き出しておきましょう。'),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn grow', onClick: download }, 'ファイルに書き出す'),
        h('button', { class: 'btn grow', onClick: () => void copy() }, 'コピーする'),
      ),
      h('button', { class: 'btn', onClick: () => fileInput.click() }, 'ファイルから読み込む'),
      fileInput,
      h('details', {},
        h('summary', { class: 'muted small' }, '文字を貼り付けて読み込む'),
        h('div', { class: 'stack' },
          pasteArea,
          h('button', { class: 'btn', onClick: () => load(pasteArea.value) }, '貼り付けた内容を読み込む'),
        ),
      ),
    ),
    msg,
    h('div', { class: 'card stack' },
      h('h3', {}, 'リセット'),
      h('p', { class: 'muted small' }, '持ち玉・正答率・ミスの記録をすべて消して、最初からにします。'),
      h('button', { class: 'btn danger', onClick: reset }, 'すべての記録を消す'),
    ),
  );
  return { el };
}
