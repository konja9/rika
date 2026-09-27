/// <reference types="vitest/config" />
// Vite（開発サーバー・ビルド）、PWA（ホーム画面に追加・オフライン対応）、Vitest（テスト）の設定。
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages では https://<ユーザー名>.github.io/<リポジトリ名>/ で公開される。
// リポジトリ名を変えたときは、ここも同じ名前に変える。
const BASE = '/rika/';

export default defineConfig({
  base: BASE,
  plugins: [
    VitePWA({
      // 新しい版を公開したら、次に開いたときに自動で入れ替わる
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'リカパチ 理科の計算×パチンコ',
        short_name: 'リカパチ',
        description: '理科の計算問題に正解すると保留がたまり、抽選で大当たりを狙う学習ゲーム',
        lang: 'ja',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b1020',
        theme_color: '#0b1020',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // オフラインでも動くように、アプリのファイルをすべて端末に保存しておく
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: `${BASE}index.html`,
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // 大量のシミュレーションをするので、遅いマシンでも止まらないように長めにしておく
    testTimeout: 30000,
  },
});
