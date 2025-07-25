import { gameState } from '../core/gameState.js';
import { publish } from '../core/eventBus.js';

// タブ定義：1〜6年 と 総復習（総復習は grade=0）
const tabs = [
  { label: '1年',   grade: 1 },
  { label: '2年',   grade: 2 },
  { label: '3年',   grade: 2 },
  { label: '4年',   grade: 4 },
  { label: '5年',   grade: 5 },
  { label: '6年',   grade: 6 },
  { label: '総復習', grade: 0 },
];

const gradeSelectState = {
  /** 画面表示時 */
  enter(canvas) {
    // canvas 引数がない場合は DOM から取得
    this.canvas = canvas || document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');
    // 初期値セット（未定義時のみ）
    if (gameState.currentGrade == null) {
      gameState.currentGrade = 1;
    }
    // クリックイベント登録
    this._clickHandler = this.handleClick.bind(this);
    this.canvas.addEventListener('click', this._clickHandler);
  },

  /** 毎フレーム描画 */
  update(dt) {
    const { ctx, canvas } = this;
    const cw    = canvas.width;
    const ch    = canvas.height;
    const count = tabs.length;
    const w     = cw / count;
    const h     = 50;             // タブの高さ（仮）
    ctx.clearRect(0, 0, cw, ch);

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = '16px sans-serif';

    tabs.forEach((tab, i) => {
      const x = i * w;
      // 背景
      ctx.fillStyle = (tab.grade === gameState.currentGrade) ? '#ddd' : '#ccc';
      ctx.fillRect(x, 0, w, h);
      // ラベル
      ctx.fillStyle = '#000';
      ctx.fillText(tab.label, x + w/2, h/2);

      // バッジ描画
      const rateText = this.getClearRate(tab.grade) + '%';
      const badgePadding = 4;
      ctx.font = '12px sans-serif';
      const tw = ctx.measureText(rateText).width;
      const bw = tw + badgePadding*2;
      const bh = 20;
      const bx = x + w - bw - 8;
      const by = 8;
      ctx.fillStyle = '#f00';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#fff';
      ctx.fillText(rateText, bx + bw/2, by + bh/2);
      // フォントを戻す
      ctx.font = '16px sans-serif';
    });
  },

  /** 画面離脱時 */
  exit() {
    this.canvas.removeEventListener('click', this._clickHandler);
    this.canvas = null;
    this.ctx    = null;
  },

  /** クリック処理 */
  handleClick(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x    = event.clientX - rect.left;
    const idx  = Math.floor(x / (this.canvas.width / tabs.length));
    const tab  = tabs[idx];
    if (tab) {
      gameState.currentGrade = tab.grade;
      publish('changeScreen', 'stageSelect');
    }
  },

  /**
   * 指定 grade のクリア率を算出
   * （window.fsm.states を活用して全ステージ数を取得）
   */
  getClearRate(grade) {
    const allStates = window.fsm?.states ? Object.keys(window.fsm.states) : [];
    // 'stageSelect' は除外
    const stageIds = allStates.filter(name => name !== 'stageSelect');
    // grade でフィルタ（0 は総復習 → すべてのステージ）
    const list = grade === 0
      ? stageIds
      : stageIds.filter(id => id.startsWith(`${grade}_`));
    const total   = list.length;
    if (total === 0) return 0;
    const cleared = list.filter(id => localStorage.getItem(`clear_${id}`)).length;
    return Math.round((cleared / total) * 100);
  }
};

export default gradeSelectState;
