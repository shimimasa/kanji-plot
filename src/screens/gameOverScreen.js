// src/screens/gameOverScreen.js
// プレイヤー敗北時の画面（Game Over Screen）

import { publish } from '../core/eventBus.js';
import { drawButton, isMouseOverRect } from '../ui/uiRenderer.js';
import { gameState } from '../core/gameState.js';

const retryButton = {
  x: 250,
  y: 420,
  width: 140,
  height: 50,
  text: 'リトライ'
};

const titleButton = {
  x: 410,
  y: 420,
  width: 140,
  height: 50,
  text: 'タイトルへ'
};

const gameOverState = {
  canvas: null,
  ctx: null,
  _clickHandler: null,
  _mousemoveHandler: null,
  mouseX: 0,
  mouseY: 0,
  animationTime: 0, // アニメーション用タイマー
  
  /** 画面表示時の初期化 */
  enter() {
    // ゲームオーバー画面に入ったらBGMを変更
    publish('playBGM', 'gameover');
    
    // キャンバスを取得
    this.canvas = document.getElementById('gameCanvas');
    if (!this.canvas) {
      console.error('キャンバス要素が見つかりません');
      return;
    }
    
    this.ctx = this.canvas.getContext('2d');
    
    // 失敗SEを再生
    publish('playSE', 'gameover');
    
    // アニメーションタイマーを初期化
    this.animationTime = 0;
    
    // イベントハンドラ登録
    this.registerHandlers();
  },
  
  /** 毎フレーム呼び出し（描画） */
  update(dt) {
    if (!this.ctx || !this.canvas) return;
    
    const { ctx, canvas } = this;
    this.animationTime += 16; // 約60FPSでアニメーション
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 1. 嵐の空と石板風背景を描画
    this.drawStormyBackground(ctx, canvas.width, canvas.height);
    
    // 2. ひび割れたタイトルを描画
    this.drawCrackedTitle(ctx, canvas.width / 2, 120);
    
    // 3. 風化した石板の結果パネル
    this.drawWeatheredResultPanel(ctx, canvas.width / 2 - 150, 220, 300, 160);
    
    // 4. 重厚なボタン群
    const isRetryHovered = isMouseOverRect(this.mouseX, this.mouseY, retryButton);
    const isTitleHovered = isMouseOverRect(this.mouseX, this.mouseY, titleButton);
    
    this.drawSomberButton(ctx, retryButton, isRetryHovered, 'retry');
    this.drawSomberButton(ctx, titleButton, isTitleHovered, 'title');
    
    // 5. 絶望的な雰囲気の装飾要素
    this.drawDespairEffects(ctx, canvas.width, canvas.height);
  },

  /**
   * 嵐の空と石板風の背景を描画
   */
  drawStormyBackground(ctx, width, height) {
    ctx.save();
    
    // ベースの暗い背景グラデーション（嵐の空）
    const skyGradient = ctx.createLinearGradient(0, 0, 0, height);
    skyGradient.addColorStop(0, '#2C3E50'); // 暗い青灰色
    skyGradient.addColorStop(0.3, '#34495E'); // スレートグレー
    skyGradient.addColorStop(0.7, '#1C2833'); // より暗い青
    skyGradient.addColorStop(1, '#17202A'); // 最も暗い青
    
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, width, height);
    
    // 雲の効果（動的な暗い雲）
    const cloudOffset = (this.animationTime * 0.001) % (width + 100);
    ctx.fillStyle = 'rgba(44, 62, 80, 0.3)';
    for (let i = 0; i < 5; i++) {
      const x = (cloudOffset + i * 200 - 100) % (width + 200) - 100;
      const y = 50 + i * 30;
      const radius = 40 + i * 10;
      
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.arc(x + 30, y, radius * 0.8, 0, Math.PI * 2);
      ctx.arc(x + 60, y, radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // 石板のテクスチャ効果
    ctx.fillStyle = 'rgba(85, 85, 85, 0.4)';
    for (let i = 0; i < 300; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = Math.random() * 2 + 0.5;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // ひび割れ効果
    ctx.strokeStyle = 'rgba(169, 169, 169, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      const startX = Math.random() * width;
      const startY = Math.random() * height;
      let currentX = startX;
      let currentY = startY;
      
      ctx.moveTo(currentX, currentY);
      for (let j = 0; j < 5; j++) {
        currentX += (Math.random() - 0.5) * 100;
        currentY += (Math.random() - 0.5) * 100;
        ctx.lineTo(currentX, currentY);
      }
      ctx.stroke();
    }
    
    // 縁の装飾（風化した境界線）
    ctx.strokeStyle = 'rgba(105, 105, 105, 0.5)';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, width - 16, height - 16);
    
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)';
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, width - 24, height - 24);
    
    ctx.restore();
  },

  /**
   * ひび割れたタイトルを描画
   */
  drawCrackedTitle(ctx, centerX, centerY) {
    ctx.save();
    
    // タイトルの影（深い絶望感）
    ctx.font = 'bold 48px "UDデジタル教科書体", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillText('ゲームオーバー', centerX + 4, centerY + 4);
    
    // メインタイトル（深い赤色のグラデーション）
    const titleGradient = ctx.createLinearGradient(centerX - 150, centerY - 25, centerX + 150, centerY + 25);
    titleGradient.addColorStop(0, '#8B0000'); // ダークレッド
    titleGradient.addColorStop(0.5, '#DC143C'); // クリムゾン
    titleGradient.addColorStop(1, '#B22222'); // ファイアブリック
    
    ctx.fillStyle = titleGradient;
    ctx.fillText('ゲームオーバー', centerX, centerY);
    
    // タイトルの縁取り（かすれ効果）
    ctx.strokeStyle = '#2F4F4F';
    ctx.lineWidth = 2;
    ctx.strokeText('ゲームオーバー', centerX, centerY);
    
    // ひび割れ効果をタイトルに追加
    ctx.strokeStyle = 'rgba(105, 105, 105, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // タイトル文字の上にひび割れ線を描画
    ctx.moveTo(centerX - 120, centerY - 10);
    ctx.lineTo(centerX - 80, centerY + 5);
    ctx.lineTo(centerX - 40, centerY - 8);
    ctx.moveTo(centerX + 20, centerY + 8);
    ctx.lineTo(centerX + 60, centerY - 5);
    ctx.lineTo(centerX + 100, centerY + 10);
    ctx.stroke();
    
    // サブタイトル
    ctx.font = '24px "UDデジタル教科書体", sans-serif';
    ctx.fillStyle = '#696969'; // ダークグレー
    ctx.fillText('チャレンジ失敗...', centerX, centerY + 50);
    
    // 絶望的な装飾（破片効果）
    ctx.fillStyle = 'rgba(169, 169, 169, 0.4)';
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      const distance = 80 + Math.sin(this.animationTime * 0.003 + i) * 10;
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;
      const size = 3 + Math.random() * 2;
      
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  },

  /**
   * 風化した石板の結果パネルを描画
   */
  drawWeatheredResultPanel(ctx, x, y, width, height) {
    ctx.save();
    
    // パネルの深い影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x + 6, y + 6, width, height);
    
    // 石板背景（風化した石の質感）
    const stoneGradient = ctx.createLinearGradient(x, y, x, y + height);
    stoneGradient.addColorStop(0, '#708090'); // スレートグレー
    stoneGradient.addColorStop(0.3, '#696969'); // ダークグレー
    stoneGradient.addColorStop(0.7, '#556B2F'); // ダークオリーブグリーン
    stoneGradient.addColorStop(1, '#2F4F4F'); // ダークスレートグレー
    
    ctx.fillStyle = stoneGradient;
    ctx.fillRect(x, y, width, height);
    
    // 石板の深い縁取り
    ctx.strokeStyle = '#2F2F2F';
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, width, height);
    
    // 内側の装飾線（風化効果）
    ctx.strokeStyle = '#A9A9A9';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 8, y + 8, width - 16, height - 16);
    
    // 石板のひび割れ
    ctx.strokeStyle = 'rgba(169, 169, 169, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 20, y + height * 0.3);
    ctx.lineTo(x + width - 30, y + height * 0.7);
    ctx.moveTo(x + width * 0.7, y + 15);
    ctx.lineTo(x + width * 0.3, y + height - 20);
    ctx.stroke();
    
    // パネルタイトル
    ctx.font = 'bold 22px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#F5F5DC'; // ベージュ
    ctx.fillText('戦績', x + width/2, y + 35);
    
    // 結果データ
    const results = [
      `正解した漢字: ${gameState.correctKanjiList.length}個`,
      `間違えた漢字: ${gameState.wrongKanjiList.length}個`,
      `現在レベル: ${gameState.playerStats.level}`,
      `挑戦回数: ${gameState.playerStats.totalAttempts || 1}`
    ];
    
    ctx.font = '16px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#DCDCDC'; // ガインズボロ
    
    results.forEach((text, index) => {
      ctx.fillText(text, x + 20, y + 70 + index * 22);
    });
    
    // 敗北メッセージ
    ctx.font = 'italic 14px "UDデジタル教科書体", sans-serif';
    ctx.fillStyle = '#CD5C5C'; // インディアンレッド
    ctx.textAlign = 'center';
    ctx.fillText('次こそは勝利を掴もう...', x + width/2, y + height - 15);
    
    ctx.restore();
  },

  /**
   * 重厚で暗いトーンのボタンを描画
   */
  drawSomberButton(ctx, button, isHovered, type) {
    ctx.save();
    
    const { x, y, width, height, text } = button;
    const scale = isHovered ? 1.05 : 1.0;
    
    // ホバー時のスケール調整
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;
    const scaledX = x + (width - scaledWidth) / 2;
    const scaledY = y + (height - scaledHeight) / 2;
    
    // ボタンの深い影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(scaledX + 5, scaledY + 5, scaledWidth, scaledHeight);
    
    // ボタン背景のグラデーション（暗いトーン）
    const buttonGradient = ctx.createLinearGradient(scaledX, scaledY, scaledX, scaledY + scaledHeight);
    
    if (type === 'retry') {
      // リトライボタン（暗い青系）
      if (isHovered) {
        buttonGradient.addColorStop(0, '#4682B4'); // スチールブルー
        buttonGradient.addColorStop(0.5, '#2F4F4F'); // ダークスレートグレー
        buttonGradient.addColorStop(1, '#191970'); // ミッドナイトブルー
      } else {
        buttonGradient.addColorStop(0, '#2F4F4F'); // ダークスレートグレー
        buttonGradient.addColorStop(0.5, '#191970'); // ミッドナイトブルー
        buttonGradient.addColorStop(1, '#0F0F23'); // より暗い青
      }
    } else {
      // タイトルボタン（暗い赤系）
      if (isHovered) {
        buttonGradient.addColorStop(0, '#A0522D'); // シエナ
        buttonGradient.addColorStop(0.5, '#8B4513'); // サドルブラウン
        buttonGradient.addColorStop(1, '#654321'); // ダークブラウン
      } else {
        buttonGradient.addColorStop(0, '#8B4513'); // サドルブラウン
        buttonGradient.addColorStop(0.5, '#654321'); // ダークブラウン
        buttonGradient.addColorStop(1, '#2F1B14'); // より暗いブラウン
      }
    }
    
    ctx.fillStyle = buttonGradient;
    ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
    
    // ボタンの縁取り
    ctx.strokeStyle = isHovered ? '#696969' : '#2F2F2F';
    ctx.lineWidth = isHovered ? 3 : 2;
    ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);
    
    // 風化効果（ボタンにもひび）
    if (!isHovered) {
      ctx.strokeStyle = 'rgba(169, 169, 169, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(scaledX + 10, scaledY + scaledHeight * 0.3);
      ctx.lineTo(scaledX + scaledWidth - 10, scaledY + scaledHeight * 0.7);
      ctx.stroke();
    }
    
    // ハイライト効果（控えめ）
    const highlightGradient = ctx.createLinearGradient(scaledX, scaledY, scaledX, scaledY + scaledHeight * 0.3);
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlightGradient;
    ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight * 0.3);
    
    // ボタンテキスト
    ctx.font = 'bold 18px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // テキストの影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillText(text, scaledX + scaledWidth/2 + 2, scaledY + scaledHeight/2 + 2);
    
    // テキスト本体
    ctx.fillStyle = isHovered ? '#F5F5DC' : '#DCDCDC'; // ベージュまたはガインズボロ
    ctx.fillText(text, scaledX + scaledWidth/2, scaledY + scaledHeight/2);
    
    ctx.restore();
  },

  /**
   * 絶望的な雰囲気の装飾要素を描画
   */
  drawDespairEffects(ctx, width, height) {
    ctx.save();
    
    // 落下する灰のような粒子
    ctx.fillStyle = 'rgba(169, 169, 169, 0.3)';
    for (let i = 0; i < 20; i++) {
      const x = (this.animationTime * 0.02 + i * 40) % width;
      const y = (this.animationTime * 0.05 + i * 30) % height;
      const size = 1 + Math.random() * 2;
      
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // 画面四隅の暗いビネット効果
    const vignetteGradient = ctx.createRadialGradient(
      width/2, height/2, 0,
      width/2, height/2, Math.max(width, height) * 0.7
    );
    vignetteGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignetteGradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    
    ctx.fillStyle = vignetteGradient;
    ctx.fillRect(0, 0, width, height);
    
    ctx.restore();
  },
  
  /** 画面離脱時のクリーンアップ */
  exit() {
    if (this.canvas) {
      this.unregisterHandlers();
    }
    this.canvas = null;
    this.ctx = null;
  },
  
  /** イベントハンドラ登録 */
  registerHandlers() {
    if (!this.canvas) return;
    
    this._clickHandler = this.handleClick.bind(this);
    this._mousemoveHandler = this.handleMouseMove.bind(this);
    
    this.canvas.addEventListener('click', this._clickHandler);
    this.canvas.addEventListener('touchstart', this._clickHandler);
    this.canvas.addEventListener('mousemove', this._mousemoveHandler);
  },
  
  /** イベントハンドラ解除 */
  unregisterHandlers() {
    if (!this.canvas) return;
    
    if (this._clickHandler) {
      this.canvas.removeEventListener('click', this._clickHandler);
      this.canvas.removeEventListener('touchstart', this._clickHandler);
    }
    if (this._mousemoveHandler) {
      this.canvas.removeEventListener('mousemove', this._mousemoveHandler);
    }
    
    this._clickHandler = null;
    this._mousemoveHandler = null;
  },

  /** マウス移動処理 */
  handleMouseMove(e) {
    if (!this.canvas) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    this.mouseX = (e.clientX - rect.left) * scaleX;
    this.mouseY = (e.clientY - rect.top) * scaleY;
  },
  
  /** クリック処理 */
  handleClick(e) {
    if (!this.canvas) return;
    
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
    
    // リトライボタン
    if (isMouseOverRect(x, y, retryButton)) {
      publish('playSE', 'decide');
      // 同じステージを再挑戦
      publish('changeScreen', gameState.currentStageId);
    }
    
    // タイトルへボタン
    if (isMouseOverRect(x, y, titleButton)) {
      publish('playSE', 'decide');
      // タイトル画面へ戻る
      publish('changeScreen', 'title');
    }
  },
  
  render() {
    this.update(0);
  }
};

export default gameOverState;
