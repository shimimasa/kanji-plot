import { publish } from '../core/eventBus.js';
import * as assetLoader from '../loaders/assetsLoader.js';

const loadingState = {
  canvas: null,
  ctx:    null,
  progress: 0,

  /** 画面に遷移したときに呼ばれる */
  enter(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.progress = 0;

    // 資産ロード開始。進捗コールバックで this.progress を更新
    assetLoader.loadAll((loaded, total) => {
      this.progress = loaded / total;
    })
    .then(() => {
      // ロード完了後、タイトル画面へ遷移
      publish('changeScreen', 'title');
    })
    .catch(err => {
      console.error('資産ロード中にエラーが発生しました:', err);
      // （必要ならエラー画面へ遷移などの処理を追加）
    });
  },

  /** 毎フレームの描画更新 */
  update(dt) {
    const { ctx, canvas } = this;
    if (!ctx) return;

    // キャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // プログレスバーの基本設定
    const barWidth  = 600;
    const barHeight = 30;
    const x = (canvas.width  - barWidth)  / 2;
    const y = (canvas.height - barHeight) / 2;

    // 背景バー
    ctx.fillStyle = '#555';
    ctx.fillRect(x, y, barWidth, barHeight);

    // 進捗バー
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(x, y, barWidth * this.progress, barHeight);

    // 枠線
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(x, y, barWidth, barHeight);

    // パーセント表示（任意）
    ctx.fillStyle    = '#fff';
    ctx.font         = '16px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(
      `${Math.floor(this.progress * 100)}%`,
      canvas.width / 2,
      y + barHeight + 8
    );
  },

  /** 画面離脱時のクリーンアップ */
  exit() {
    this.ctx    = null;
    this.canvas = null;
  }
};

export default loadingState; 