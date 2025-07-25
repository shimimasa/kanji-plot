// src/states/prefSelectState.js

import { stageData } from '../loaders/dataLoader.js';
import { gameState } from '../core/gameState.js';
import { publish } from '../core/eventBus.js';
import { images } from '../loaders/assetsLoader.js';

const MARKER_SIZE = 32;

const prefSelectState = {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{grade?: number, region?: string}} props
   */
  enter(canvas, props = {}) {
    // canvas 引数がない場合は DOM から取得
    this.canvas = canvas || document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');
    // props で渡された grade / region を gameState にセット
    const { grade, region } = props;
    if (grade != null)  gameState.currentGrade  = grade;
    if (region != null) gameState.currentRegion = region;
    // フィルタ済みステージ一覧を保持
    this.stages = stageData.filter(s =>
      s.grade  === gameState.currentGrade &&
      s.region === gameState.currentRegion
    );
    // イベント登録
    this._click = this.handleClick.bind(this);
    this.canvas.addEventListener('click', this._click);
    this._key = this.handleKeydown.bind(this);
    window.addEventListener('keydown', this._key);
  },

  /** @param {number} dt */
  update(dt) {
    const { ctx, canvas, stages } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 各ステージをマーカーで描画
    stages.forEach(stage => {
      const { pos } = stage;
      if (images.markerPref) {
        ctx.drawImage(
          images.markerPref,
          pos.x, pos.y,
          MARKER_SIZE, MARKER_SIZE
        );
      } else {
        // 画像がなければ代替表示
        ctx.fillStyle = '#f00';
        ctx.fillRect(pos.x, pos.y, MARKER_SIZE, MARKER_SIZE);
      }
    });
  },

  exit() {
    // イベント解除
    this.canvas.removeEventListener('click', this._click);
    window.removeEventListener('keydown', this._key);
    // 参照解放
    this.canvas = null;
    this.ctx    = null;
    this.stages = [];
  },

  /**
   * @param {MouseEvent} e
   */
  handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // フィルタ済みステージからヒット判定
    for (const stage of this.stages) {
      const { pos, stageId } = stage;
      if (
        x >= pos.x && x <= pos.x + MARKER_SIZE &&
        y >= pos.y && y <= pos.y + MARKER_SIZE
      ) {
        // ステージ確定
        gameState.currentStageId = stageId;
        publish('changeScreen', 'battle');
        return;
      }
    }
  },

  /**
   * @param {KeyboardEvent} e
   */
  handleKeydown(e) {
    if (e.key === 'Escape') {
      publish('changeScreen', 'regionSelect');
    }
  }
};

export default prefSelectState; 