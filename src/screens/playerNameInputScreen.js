// js/playerNameInputScreen.js
import { publish } from '../core/eventBus.js';
import { images } from '../loaders/assetsLoader.js';
import { drawButton, isMouseOverRect } from '../ui/uiRenderer.js';
import { gameState, updatePlayerName } from '../core/gameState.js';
import { getCurrentUser, initializeNewPlayerData } from '../services/firebase/firebaseController.js';

const playerNameInputState = {
  /** 画面表示時の初期化 */
  enter(canvas) {
    // canvas が未渡しの場合は DOM から取得
    this.canvas = canvas || document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    
    const cx = this.canvas.width / 2;
    this.confirmButton = { x: cx - 100, y: 400, width: 200, height: 50, text: 'けってい' };
    
    // HTML入力欄をセットアップ
    this.nameInputElement = document.getElementById('playerNameInputField');
    if (this.nameInputElement) {
      this.nameInputElement.style.display = 'block';
      this.nameInputElement.value = "";
      this.nameInputElement.maxLength = 10;
      
      // 位置調整
      const canvasRect = this.canvas.getBoundingClientRect();
      this.nameInputElement.style.left = `${canvasRect.left + cx - this.nameInputElement.offsetWidth / 2}px`;
      this.nameInputElement.style.top = `${canvasRect.top + 300}px`;
      
      this.nameInputElement.focus();
    }
    
    this.registerHandlers();
  },

  /** 毎フレーム呼び出し（描画） */
  update(dt) {
    const cw = this.canvas.width, ch = this.canvas.height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, cw, ch);

    // 背景
    ctx.fillStyle = '#1e3c72';
    ctx.fillRect(0, 0, cw, ch);

    // タイトル
    ctx.fillStyle = 'white';
    ctx.font = '32px "UDデジタル教科書体",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('なまえを にゅうりょく してください', cw / 2, 150);
    
    ctx.font = '20px "UDデジタル教科書体",sans-serif';
    ctx.fillText('(10もじまで)', cw / 2, 200);

    // 入力欄の枠（HTMLの入力欄が見えるように透明な枠を描画）
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(cw / 2 - 150, 280, 300, 40);

    // 決定ボタン
    if (images.buttonNormal) {
      ctx.drawImage(images.buttonNormal,
        this.confirmButton.x, this.confirmButton.y, this.confirmButton.width, this.confirmButton.height
      );
    }
    drawButton(ctx, this.confirmButton.x, this.confirmButton.y, this.confirmButton.width, this.confirmButton.height, this.confirmButton.text);
  },

  /** 画面離脱時のクリーンアップ */
  exit() {
    this.unregisterHandlers();
    if (this.nameInputElement) {
      this.nameInputElement.style.display = 'none';
      this.nameInputElement.onkeydown = null;
    }
    this.canvas = null;
    this.ctx = null;
  },

  /** イベントリスナー登録 */
  registerHandlers() {
    this._clickHandler = this.handleClick.bind(this);
    this._keyHandler = this.handleKeydown.bind(this);
    
    this.canvas.addEventListener('click', this._clickHandler);
    this.canvas.addEventListener('touchstart', this._clickHandler);
    
    if (this.nameInputElement) {
      this.nameInputElement.onkeydown = this._keyHandler;
    }
  },

  /** イベントリスナー解除 */
  unregisterHandlers() {
    this.canvas.removeEventListener('click', this._clickHandler);
    this.canvas.removeEventListener('touchstart', this._clickHandler);
  },

  /** Enterキー処理 */
  handleKeydown(event) {
    if (event.key === 'Enter') {
      this.submitNameAndSave();
      event.preventDefault();
    }
  },

  /** クリック処理 */
  handleClick(e) {
    e.preventDefault();

    let eventX, eventY;
    if (e.changedTouches) {
      eventX = e.changedTouches[0].clientX;
      eventY = e.changedTouches[0].clientY;
    } else {
      eventX = e.clientX;
      eventY = e.clientY;
    }

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = (eventX - rect.left) * scaleX;
    const y = (eventY - rect.top) * scaleY;

    if (isMouseOverRect(x, y, this.confirmButton)) {
      publish('playSE', 'decide');
      this.submitNameAndSave();
    }
  },

  /** 名前送信と保存処理 */
  async submitNameAndSave() {
    if (!this.nameInputElement) return;
    
    const trimmedName = this.nameInputElement.value.trim();
    
    // 入力値の検証
    if (trimmedName === "" || trimmedName === "ななしのごんべえ" || trimmedName === "ゲスト" || trimmedName === "新規プレイヤー") {
      alert("有効な なまえを いれてください。");
      this.nameInputElement.value = "";
      this.nameInputElement.focus();
      return;
    }

    // プレイヤー名を更新
    updatePlayerName(trimmedName);
    
    // Firebase保存処理
    const user = getCurrentUser();
    if (user && user.uid) {
      try {
        const newPlayerData = await initializeNewPlayerData(user.uid, trimmedName);
        if (newPlayerData) {
          console.log("New player profile created/updated in Firestore:", newPlayerData);
        }
      } catch (error) {
        console.error("Firebase保存エラー:", error);
      }
    }

    // ゲームモードを設定
    if (gameState.pendingGameMode) {
      gameState.gameMode = gameState.pendingGameMode;
      gameState.pendingGameMode = null;
    }
    
    // 地方選択画面へ遷移
    gameState.currentGrade = 0;
    publish('changeScreen', 'regionSelect');
  },

  render() {
    this.update(0);
  }
};

export default playerNameInputState;