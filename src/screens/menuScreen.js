// js/menuScreen.js
import { gameState } from '../core/gameState.js';
import { drawButton, isMouseOverRect } from '../ui/uiRenderer.js';

import { publish } from '../core/eventBus.js';
import { images } from '../loaders/assetsLoader.js';

const menuItems = [
  { text: "ゲームスタート", screen: "stageSelect", x: 150, y: 200 },
  { text: "せってい", screen: "settings", x: 150, y: 280 }
];

const buttonWidth = 200;
const buttonHeight = 60;

export function renderMenuScreen(ctx) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // 各ボタンを描画
  for (const item of menuItems) {
    // 背景画像
    if (images.buttonNormal) {
      ctx.drawImage(images.buttonNormal, item.x, item.y, buttonWidth, buttonHeight);
    }

    // テキスト
    ctx.fillStyle = "white";
    ctx.font = "20px 'UDデジタル教科書体', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(item.text, item.x + buttonWidth / 2, item.y + 38);
  }
}

export function handleMenuClick(x, y,event) {
  for (const item of menuItems) {
    if (
      x >= item.x &&
      x <= item.x + buttonWidth &&
      y >= item.y &&
      y <= item.y + buttonHeight
    ) {
      publish('changeScreen', item.screen);
      break;
    }
  }
}

const menuScreenState = {
  canvas: null,
  ctx:    null,
  startButton:       null,
  statusButton:      null,
  achievementsButton: null,
  settingsButton:    null,
  _clickHandler:     null,

  /** 画面表示時の初期化 */
  enter(arg) {
    // canvas が渡されなければ DOM から取得
    this.canvas = (arg && typeof arg.getContext === 'function')
      ? arg
      : document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // ボタン設定（Y座標を調整してトロフィーボタンのスペースを確保）
    const cx = this.canvas.width / 2;
    this.startButton       = { x: cx - 150, y: 200, width: 300, height: 60, text: '冒険を始める' };
    this.statusButton      = { x: cx - 100, y: 280, width: 200, height: 50, text: 'ステータス' };
    this.achievementsButton = { x: cx - 100, y: 340, width: 200, height: 50, text: 'トロフィー' };
    this.settingsButton    = { x: cx - 100, y: 400, width: 200, height: 50, text: '設定' };

    // クリックイベント登録
    this.registerHandlers();
  },

  /** 毎フレームの描画更新 */
  update(dt) {
    const { ctx, canvas, startButton, statusButton, achievementsButton, settingsButton } = this;

    // 背景
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // タイトル
    ctx.fillStyle = 'white';
    ctx.font      = '40px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('メインメニュー', canvas.width / 2, 100);

    // プレイヤー名
    if (gameState.playerName) {
      ctx.font = '20px "UDデジタル教科書体", sans-serif';
      ctx.fillText(`ようこそ、${gameState.playerName} さん`, canvas.width / 2, 150);
    }

    // ステータスボタンのテキストを動的に生成（スキルポイント通知付き）
    const skillPoints = gameState.playerStats.skillPoints;
    statusButton.text = skillPoints > 0 ? `ステータス (+${skillPoints})` : 'ステータス';

    // トロフィーボタンのテキストを動的に生成（実績通知付き）
    const unlockedCount = gameState.unlockedAchievements.size;
    if (unlockedCount > 0) {
      achievementsButton.text = `トロフィー (${unlockedCount})`;
    } else {
      achievementsButton.text = 'トロフィー';
    }

    // ボタン背景画像
    if (images.buttonNormal) {
      ctx.drawImage(images.buttonNormal, startButton.x, startButton.y, startButton.width, startButton.height);
      ctx.drawImage(images.buttonNormal, statusButton.x, statusButton.y, statusButton.width, statusButton.height);
      ctx.drawImage(images.buttonNormal, achievementsButton.x, achievementsButton.y, achievementsButton.width, achievementsButton.height);
      ctx.drawImage(images.buttonNormal, settingsButton.x, settingsButton.y, settingsButton.width, settingsButton.height);
    }

    // ボタン文字
    drawButton(ctx, startButton.x, startButton.y, startButton.width, startButton.height, startButton.text, '#2ecc71', 'white');
    
    // ステータスボタンの色をスキルポイントに応じて変更
    const statusButtonColor = skillPoints > 0 ? '#f39c12' : '#9b59b6';
    drawButton(ctx, statusButton.x, statusButton.y, statusButton.width, statusButton.height, statusButton.text, statusButtonColor, 'white');
    
    // トロフィーボタンの色を実績数に応じて変更
    const achievementButtonColor = unlockedCount > 0 ? '#FFD700' : '#8e44ad';
    drawButton(ctx, achievementsButton.x, achievementsButton.y, achievementsButton.width, achievementsButton.height, achievementsButton.text, achievementButtonColor, 'white');
    
    drawButton(ctx, settingsButton.x, settingsButton.y, settingsButton.width, settingsButton.height, settingsButton.text, '#3498db', 'white');
  },

  /** 画面離脱時のクリーンアップ */
  exit() {
    this.unregisterHandlers();
    this.canvas = null;
    this.ctx    = null;
  },

  /** クリックイベントリスナ登録 */
  registerHandlers() {
    this._clickHandler = this.handleClick.bind(this);
    this.canvas.addEventListener('click', this._clickHandler);
    this.canvas.addEventListener('touchstart', this._clickHandler);
  },

  /** クリックイベントリスナ解除 */
  unregisterHandlers() {
    this.canvas.removeEventListener('click', this._clickHandler);
    this.canvas.removeEventListener('touchstart', this._clickHandler);
  },

  /** クリック処理 */
  handleClick(e) {
    // === ここからが新しい座標変換ロジック ===
    e.preventDefault(); // ダブルタップによる画面拡大などを防ぐ

    let eventX, eventY;
    // e.changedTouchesが存在すればタッチイベント、なければマウスイベントと判定
    if (e.changedTouches) {
      eventX = e.changedTouches[0].clientX;
      eventY = e.changedTouches[0].clientY;
    } else {
      eventX = e.clientX;
      eventY = e.clientY;
    }

    const rect = this.canvas.getBoundingClientRect();
    
    // Canvasの実際の表示サイズと内部解像度の比率を計算
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    // 実際のタッチ/クリック座標を、800x600のゲーム内座標に変換
    const x = (eventX - rect.left) * scaleX;
    const y = (eventY - rect.top) * scaleY;
    // === 座標変換ロジックここまで ===

    // ▼ 以下は元のクリック判定ロジック（x, y を使うようにする）
    // 「冒険を始める」ボタン押下時
    if (isMouseOverRect(x, y, this.startButton)) {
      gameState.currentGrade = 0;
      publish('changeScreen', 'stageSelect');
      return;
    }
    
    // 「ステータス」ボタン押下時
    if (isMouseOverRect(x, y, this.statusButton)) {
      publish('changeScreen', 'status');
      return;
    }
    
    // 「トロフィー」ボタン押下時
    if (isMouseOverRect(x, y, this.achievementsButton)) {
      publish('changeScreen', 'achievements');
      return;
    }
    
    // 「設定」ボタン押下時
    if (isMouseOverRect(x, y, this.settingsButton)) {
      publish('changeScreen', 'settings');
      return;
    }
  }
};

export default menuScreenState;