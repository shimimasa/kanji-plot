import { defineConfig } from 'vite';

export default defineConfig({
  // ビルド時の出力先を 'dist' に設定
  build: {
    outDir: 'dist'
  },
  // 開発サーバーがルートを正しく認識するように設定
  server: {
    watch: {
      usePolling: true,
    },
  },
});