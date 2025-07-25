import { publish } from '../core/eventBus.js';
import { images } from '../loaders/assetsLoader.js';
import { drawButton, isMouseOverRect } from '../ui/uiRenderer.js';
import { gameState, updatePlayerName, clearSaveData } from '../core/gameState.js';
import { getCurrentUser, initializeNewPlayerData } from '../services/firebase/firebaseController.js';

const titleState = {
  /** 画面表示時の初期化 */
  enter(canvas) {
    // BGM再生
    publish('playBGM', 'title');
    
    // canvas が未渡しの場合は DOM から取得
    this.canvas = canvas || document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');
    const cx    = this.canvas.width / 2;
    
    // アニメーション用の時間管理
    this.animationTime = 0;
    this.logoFloatSpeed = 0.02; // ロゴ浮遊の速度
    this.logoFloatAmplitude = 8; // ロゴ浮遊の振幅（ピクセル）
    this.particleTime = 0; // パーティクル用時間
    
    // プレイヤー名の有無でUIを変更
    const isReturnPlayer = gameState.playerName && gameState.playerName.trim() !== '';
    
    if (isReturnPlayer) {
      // リピートプレイヤー用のボタン配置
      this.jikkuriButton = { x: cx - 150, y: 320, width: 300, height: 50, text: 'つづきから（じっくり）' };
      this.challengeButton = { x: cx - 150, y: 380, width: 300, height: 50, text: 'つづきから（チャレンジ）' };
      this.settingsButton = { x: cx - 80, y: 450, width: 160, height: 50, text: 'せってい' };
      
      // リセットボタンは誤タップ防止のため、小さく、離れた位置に配置
      this.resetButton = { 
        x: cx - 90, 
        y: 520, 
        width: 180, 
        height: 35, 
        text: 'はじめから' 
      };
    } else {
      // 新規プレイヤー用のボタン配置（従来通り）
      this.jikkuriButton = { x: cx - 150, y: 350, width: 300, height: 50, text: 'じっくりモードで はじめる' };
      this.challengeButton = { x: cx - 150, y: 420, width: 300, height: 50, text: 'チャレンジモードで はじめる' };
      this.resetButton = null; // リセットボタンは表示しない
      this.settingsButton = { x: cx - 80, y: 490, width: 160, height: 50, text: 'せってい' };
    }
    
    this.registerHandlers();
  },

  /** 毎フレーム呼び出し（描画） */
  update(dt) {
    // アニメーション時間を更新
    this.animationTime += dt || 16; // dtが未定義の場合は16ms（60FPS想定）とする
    this.particleTime += dt || 16;
    
    const cw = this.canvas.width, ch = this.canvas.height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, cw, ch);

    // 背景画像の描画
    this._drawFantasyBackground(ctx, cw, ch);

    // ロゴ描画（浮遊アニメーション付き）
    this._drawAnimatedLogo(ctx, cw, ch);

    // リピートプレイヤー向けの歓迎メッセージ
    const isReturnPlayer = gameState.playerName && gameState.playerName.trim() !== '';
    if (isReturnPlayer) {
      this._drawWelcomeMessage(ctx, cw, ch);
    }

    // ボタン描画
    this._drawFantasyButtons(ctx);

    // 著作（画面下部）
    this._drawCopyright(ctx, cw, ch);
  },

  /** 古文書・冒険ファンタジー風背景の描画 */
  _drawFantasyBackground(ctx, cw, ch) {
    // 基本の茶色系グラデーション背景
    const gradient = ctx.createLinearGradient(0, 0, cw, ch);
    gradient.addColorStop(0, '#2c1810');
    gradient.addColorStop(0.25, '#3d2414');
    gradient.addColorStop(0.5, '#2c1810');
    gradient.addColorStop(0.75, '#3d2414');
    gradient.addColorStop(1, '#2c1810');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, cw, ch);

    // 書斎の窓からの光を表現
    const lightGradient1 = ctx.createRadialGradient(cw * 0.3, ch * 0.2, 0, cw * 0.3, ch * 0.2, cw * 0.4);
    lightGradient1.addColorStop(0, 'rgba(222, 184, 135, 0.15)');
    lightGradient1.addColorStop(1, 'transparent');
    ctx.fillStyle = lightGradient1;
    ctx.fillRect(0, 0, cw, ch);

    const lightGradient2 = ctx.createRadialGradient(cw * 0.7, ch * 0.8, 0, cw * 0.7, ch * 0.8, cw * 0.5);
    lightGradient2.addColorStop(0, 'rgba(205, 133, 63, 0.1)');
    lightGradient2.addColorStop(1, 'transparent');
    ctx.fillStyle = lightGradient2;
    ctx.fillRect(0, 0, cw, ch);

    // 和紙のような質感を追加
    this._drawPaperTexture(ctx, cw, ch);

    // 魔法のパーティクル効果
    this._drawMagicParticles(ctx, cw, ch);
  },

  /** 和紙のような質感を描画 */
  _drawPaperTexture(ctx, cw, ch) {
    ctx.save();
    ctx.globalAlpha = 0.1;
    
    // 繊維のような細い線を描画
    ctx.strokeStyle = 'rgba(222, 184, 135, 0.3)';
    ctx.lineWidth = 0.5;
    
    for (let i = 0; i < 50; i++) {
      ctx.beginPath();
      const x1 = Math.random() * cw;
      const y1 = Math.random() * ch;
      const x2 = x1 + (Math.random() - 0.5) * 100;
      const y2 = y1 + (Math.random() - 0.5) * 100;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // 斜めの繊維パターン
    ctx.strokeStyle = 'rgba(139, 69, 19, 0.05)';
    for (let i = 0; i < cw + ch; i += 6) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i - ch, ch);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(cw, i - cw);
      ctx.stroke();
    }
    
    ctx.restore();
  },

  /** 魔法のパーティクル効果 */
  _drawMagicParticles(ctx, cw, ch) {
    ctx.save();
    
    // 浮遊する光の粒子
    for (let i = 0; i < 20; i++) {
      const x = (cw * 0.2 + Math.sin(this.particleTime * 0.001 + i) * cw * 0.6);
      const y = (ch * 0.3 + Math.cos(this.particleTime * 0.0008 + i * 0.5) * ch * 0.4);
      const size = 2 + Math.sin(this.particleTime * 0.002 + i) * 1;
      const alpha = 0.3 + Math.sin(this.particleTime * 0.003 + i) * 0.2;
      
      ctx.globalAlpha = alpha;
      const particleGradient = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
      particleGradient.addColorStop(0, 'rgba(255, 215, 0, 0.8)');
      particleGradient.addColorStop(0.5, 'rgba(255, 165, 0, 0.4)');
      particleGradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = particleGradient;
      ctx.beginPath();
      ctx.arc(x, y, size * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  },

  /** アニメーション付きロゴの描画（台座付き） */
  _drawAnimatedLogo(ctx, cw, ch) {
    if (images.logo) {
      const { width: iw, height: ih } = images.logo;
      let w = cw * 0.6, h = (cw * 0.6 / iw) * ih;
      if (h > ch * 0.25) { h = ch * 0.25; w = (ch * 0.25 / ih) * iw; }
      
      // 浮遊アニメーション：Math.sin()を使って上下に揺らす
      const floatOffset = Math.sin(this.animationTime * this.logoFloatSpeed) * this.logoFloatAmplitude;
      
      const x = (cw - w) / 2;
      const y = ch * 0.2 - h / 2 + floatOffset;
      
      // 台座の描画
      this._drawLogoPedestal(ctx, x - 20, y + h - 10, w + 40, 30);
      
      // ロゴに光る効果を追加
      ctx.save();
      ctx.shadowColor = 'rgba(255, 215, 0, 0.4)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 5;
      
      ctx.drawImage(images.logo, x, y, w, h);
      
      ctx.restore();
    }
  },

  /** ロゴの台座を描画 */
  _drawLogoPedestal(ctx, x, y, width, height) {
    ctx.save();
    
    // 石板のような台座
    const pedestalGradient = ctx.createLinearGradient(x, y, x, y + height);
    pedestalGradient.addColorStop(0, '#8B7355');
    pedestalGradient.addColorStop(0.3, '#A0522D');
    pedestalGradient.addColorStop(0.7, '#8B4513');
    pedestalGradient.addColorStop(1, '#654321');
    
    ctx.fillStyle = pedestalGradient;
    ctx.fillRect(x, y, width, height);
    
    // 台座の装飾的な枠線
    ctx.strokeStyle = '#D2B48C';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    
    // 内側のハイライト
    ctx.strokeStyle = 'rgba(245, 222, 179, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 2, y + 2, width - 4, height - 4);
    
    // 台座の影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(x + 5, y + height, width, 8);
    
    ctx.restore();
  },

  /** 歓迎メッセージを巻物風に描画 */
  _drawWelcomeMessage(ctx, cw, ch) {
    const message = `ようこそ、${gameState.playerName}さん！`;
    
    // 巻物の背景
    const scrollX = cw / 2 - 200;
    const scrollY = ch * 0.4 - 20;
    const scrollWidth = 400;
    const scrollHeight = 40;
    
    this._drawScroll(ctx, scrollX, scrollY, scrollWidth, scrollHeight);
    
    // メッセージテキスト
    ctx.save();
    ctx.fillStyle = '#2F1B14';
    ctx.font = '24px "UDデジタル教科書体", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, cw / 2, ch * 0.4);
    ctx.restore();
  },

  /** 巻物を描画 */
  _drawScroll(ctx, x, y, width, height) {
    ctx.save();
    
    // 巻物の本体
    const scrollGradient = ctx.createLinearGradient(x, y, x, y + height);
    scrollGradient.addColorStop(0, '#F5DEB3');
    scrollGradient.addColorStop(0.5, '#DEB887');
    scrollGradient.addColorStop(1, '#D2B48C');
    
    ctx.fillStyle = scrollGradient;
    ctx.fillRect(x, y, width, height);
    
    // 巻物の端の装飾
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x - 10, y - 5, 20, height + 10);
    ctx.fillRect(x + width - 10, y - 5, 20, height + 10);
    
    // 巻物の枠線
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    
    ctx.restore();
  },

  /** ファンタジー風ボタンの描画 */
  _drawFantasyButtons(ctx) {
    // メインボタン
    this._drawStyledButton(ctx, this.jikkuriButton, 'primary');
    this._drawStyledButton(ctx, this.challengeButton, 'primary');
    this._drawStyledButton(ctx, this.settingsButton, 'secondary');
    
    // リセットボタン（危険な操作用）
    if (this.resetButton) {
      this._drawStyledButton(ctx, this.resetButton, 'danger');
      
      // 注意文
      ctx.save();
      ctx.font = '10px "UDデジタル教科書体", sans-serif';
      ctx.fillStyle = '#CD853F';
      ctx.textAlign = 'center';
      ctx.fillText(
        '※データがリセットされます', 
        this.resetButton.x + this.resetButton.width / 2, 
        this.resetButton.y + this.resetButton.height + 15
      );
      ctx.restore();
    }
  },

  /** スタイル付きボタンを描画 */
  _drawStyledButton(ctx, button, style = 'primary') {
    ctx.save();
    
    const { x, y, width, height, text } = button;
    
    // スタイルに応じた色設定
    let gradientColors, borderColor, textColor;
    
    switch (style) {
      case 'primary':
        gradientColors = ['#CD853F', '#8B4513'];
        borderColor = '#D2B48C';
        textColor = '#FFFFFF';
        break;
      case 'secondary':
        gradientColors = ['#D2B48C', '#CD853F'];
        borderColor = '#8B4513';
        textColor = '#FFFFFF';
        break;
      case 'danger':
        gradientColors = ['#e74c3c', '#c0392b'];
        borderColor = '#a93226';
        textColor = '#FFFFFF';
        break;
    }
    
    // ボタンの影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(x + 4, y + 4, width, height);
    
    // ボタンの本体（グラデーション）
    const buttonGradient = ctx.createLinearGradient(x, y, x, y + height);
    buttonGradient.addColorStop(0, gradientColors[0]);
    buttonGradient.addColorStop(1, gradientColors[1]);
    
    ctx.fillStyle = buttonGradient;
    ctx.fillRect(x, y, width, height);
    
    // ボタンの枠線
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    
    // 内側のハイライト（立体感）
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 2, y + 2, width - 4, height - 4);
    
    // ボタンテキスト
    ctx.fillStyle = textColor;
    ctx.font = '16px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // テキストの影
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillText(text, x + width / 2 + 1, y + height / 2 + 1);
    ctx.restore();
    
    // メインテキスト
    ctx.fillStyle = textColor;
    ctx.fillText(text, x + width / 2, y + height / 2);
    
    ctx.restore();
  },

  /** 著作権表示 */
  _drawCopyright(ctx, cw, ch) {
    ctx.save();
    ctx.font = '12px "UDデジタル教科書体", sans-serif';
    ctx.fillStyle = '#8B7355';
    ctx.textAlign = 'center';
    ctx.fillText('© あなたの名前 2025', cw / 2, ch - 30);
    ctx.restore();
  },

  /** 画面離脱時のクリーンアップ */
  exit() {
    this.unregisterHandlers();
    this.canvas = null;
    this.ctx    = null;
  },

  /** クリックイベント登録 */
  registerHandlers() {
    this._clickHandler = this.handleClick.bind(this);
    this.canvas.addEventListener('click', this._clickHandler);
    this.canvas.addEventListener('touchstart', this._clickHandler);
  },

  /** クリックイベント解除 */
  unregisterHandlers() {
    this.canvas.removeEventListener('click', this._clickHandler);
    this.canvas.removeEventListener('touchstart', this._clickHandler);
  },

  /** プレイヤー名確認と画面遷移の共通処理 */
  _startGame(gameMode) {
    // プレイヤー名未設定なら名前入力画面へ遷移
    if (!gameState.playerName) {
      // ゲームモードを保存して名前入力画面へ
      gameState.pendingGameMode = gameMode;
      publish('changeScreen', 'playerNameInput');
      return;
    }
    
    // ゲームモードを設定
    gameState.gameMode = gameMode;
    
    // 直接ステージセレクト（総復習モード）へ
    gameState.currentGrade = 0;
    publish('changeScreen', 'courseSelect');
  },

  /** データリセット処理 */
  async _resetGameData() {
    try {
      // 第1段階: 具体的な確認ダイアログ
      const firstConfirm = confirm(
        '【最終確認】レベル、図鑑、ステージの進捗など、全てのセーブデータが完全に削除されます。\n' +
        'この操作は取り消せません。よろしいですか？'
      );
      
      if (!firstConfirm) {
        console.log('データリセット操作がキャンセルされました（第1段階）');
        return;
      }

      // 第2段階: ダブルチェック - 確認ワードの入力
      const confirmWord = prompt(
        '最終確認として、以下の文字を正確に入力してください：\n\n' +
        '「リセット」\n\n' +
        '※ひらがな・カタカナは区別されます'
      );
      
      if (confirmWord !== 'リセット') {
        if (confirmWord === null) {
          console.log('データリセット操作がキャンセルされました（第2段階）');
        } else {
          alert('入力された文字が正しくありません。データリセットを中止します。');
          console.log('データリセット操作が中止されました（確認ワード不一致）');
        }
        return;
      }

      // 第3段階: 実際のデータ削除処理
      console.log('データリセット処理を開始します...');
      
      try {
        // 1. ゲームデータのクリア
        clearSaveData();
        
        // 2. Firebase関連データのクリア（必要に応じて）
        const user = getCurrentUser();
        if (user?.uid) {
          // Firebase側のデータも削除（具体的な実装はfirebaseControllerに依存）
          // await clearFirebaseUserData(user.uid);
        }
        
        console.log('データリセット処理が完了しました');
        
        // 成功メッセージ表示
        alert('全てのデータが正常にリセットされました。\nタイトル画面をリロードします。');
        
        // ページをリロードして完全にリセット
        window.location.reload();
        
      } catch (error) {
        console.error('データリセット処理中にエラーが発生しました:', error);
        alert('データのリセット中にエラーが発生しました。\n一部のデータが削除されていない可能性があります。');
      }
      
    } catch (error) {
      console.error('データリセット処理でエラーが発生しました:', error);
      alert('データのリセットに失敗しました。');
    }
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
    if (isMouseOverRect(x, y, this.jikkuriButton)) {
      publish('playSE', 'decide');
      this._startGame('jikkuri');
      return;
    }

    // チャレンジモードボタン
    if (isMouseOverRect(x, y, this.challengeButton)) {
      publish('playSE', 'decide');
      this._startGame('challenge');
      return;
    }

    // はじめからボタン（リピートプレイヤーのみ）
    if (this.resetButton && isMouseOverRect(x, y, this.resetButton)) {
      publish('playSE', 'decide');
      this._resetGameData();
      return;
    }

    // 設定ボタン
    if (isMouseOverRect(x, y, this.settingsButton)) {
      publish('playSE', 'decide');
      publish('changeScreen', 'settings');
    }
  },

  render() {
    this.update(0);
  }
};

export default titleState;

