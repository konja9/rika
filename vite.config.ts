/// <reference types="vitest/config" />
// Vite（開発サーバー・ビルド）と Vitest（テスト）の設定。
import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages では https://<ユーザー名>.github.io/rika/ で公開されるので、その場所を指定する
  base: '/rika/',
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
