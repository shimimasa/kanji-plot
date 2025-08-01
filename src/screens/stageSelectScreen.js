// js/stageSelectScreen.js
import { gameState, resetStageProgress } from '../core/gameState.js';
import { drawButton, isMouseOverRect } from '../ui/uiRenderer.js';
import { publish } from '../core/eventBus.js';
import { images } from '../loaders/assetsLoader.js';
import reviewQueue from '../models/reviewQueue.js';
import { stageData } from '../loaders/dataLoader.js';

// uiRoot の安全な取得に修正
const getUiRoot = () => {
  let uiRoot = document.getElementById('uiOverlay');
  if (!uiRoot) {
    // uiOverlay要素が存在しない場合は作成
    uiRoot = document.createElement('div');
    uiRoot.id = 'uiOverlay';
    uiRoot.style.position = 'absolute';
    uiRoot.style.top = '0';
    uiRoot.style.left = '0';
    uiRoot.style.pointerEvents = 'none'; // キャンバスのクリックを妨げない
    document.body.appendChild(uiRoot);
  }
  return uiRoot;
};

// フッターボタンを画面下部に水平一列に配置
const BUTTON_CONFIG = {
  width: 160,
  height: 40,
  gap: 20,
  y: 540
};

// 合計幅を計算
const totalWidth = (BUTTON_CONFIG.width * 4) + (BUTTON_CONFIG.gap * 3);
// 開始X座標を計算（中央揃え）
const startX = (800 - totalWidth) / 2; // キャンバス幅800pxを想定

// 各ボタンのx座標を計算（テキストを短縮）
const backButton = { 
  x: startX, 
  y: BUTTON_CONFIG.y, 
  width: BUTTON_CONFIG.width, 
  height: BUTTON_CONFIG.height, 
  text: 'もどる',
  icon: '⬅️'
};

const reviewButton = { 
  x: startX + (BUTTON_CONFIG.width + BUTTON_CONFIG.gap) * 1, 
  y: BUTTON_CONFIG.y, 
  width: BUTTON_CONFIG.width, 
  height: BUTTON_CONFIG.height, 
  text: '復習',
  icon: '📖'
};

const dexButton = { 
  x: startX + (BUTTON_CONFIG.width + BUTTON_CONFIG.gap) * 2, 
  y: BUTTON_CONFIG.y, 
  width: BUTTON_CONFIG.width, 
  height: BUTTON_CONFIG.height, 
  text: '漢字図鑑',
  icon: '📚'
};

const monsterButton = { 
  x: startX + (BUTTON_CONFIG.width + BUTTON_CONFIG.gap) * 3, 
  y: BUTTON_CONFIG.y, 
  width: BUTTON_CONFIG.width, 
  height: BUTTON_CONFIG.height, 
  text: 'モンスター',
  icon: '👾'
};

// マーカー半径
const MARKER_SIZE = 32;

// 追加：学年タブ定義（1～6年＋総復習）
const tabs = [
  { label: '1年',   grade: 1 },
  { label: '2年',   grade: 2 },
  { label: '3年',   grade: 3 },
  { label: '4年',   grade: 4 },
  { label: '5年',   grade: 5 },
  { label: '6年',   grade: 6 },
  { label: '総復習', grade: 0 },
];

const stageSelectScreenState = {
  canvas: null,
  ctx: null,
  stages: [],
  stageButtons: [],
  _clickHandler: null,
  _mousemoveHandler: null,
  cbToggle: null,
  fontToggle: null,
  mouseX: 0,
  mouseY: 0,
  hoveredStage: null,
  animationTime: 0, // アニメーション用のタイマー
  
  // クロスフェード用の状態
  crossfadeState: {
    active: false,
    timer: 0,
    duration: 30, // 30フレーム（約0.5秒）
    oldImage: null,
    newImage: null,
    oldGrade: null,
    newGrade: null
  },

  // 総復習用の大きなボタン
  reviewChallengeButton: {
    x: 50,
    y: 200,
    width: 300,
    height: 80,
    text: '今日の復習に挑戦！'
  },

  /** 画面表示時の初期化 */
  enter(arg) {
    // BGM 再生 & canvas 取得
    publish('playBGM', 'title');
    this.canvas = (arg && typeof arg.getContext === 'function')
      ? arg
      : document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // 未設定時は総復習(0)に
    if (gameState.currentGrade == null) {
      gameState.currentGrade = 0;
    }

    // ステージデータ初期化（現在の学年に応じたフィルタリング）
    this.updateStageList();

    // イベント登録
    this._clickHandler = this.handleClick.bind(this);
    this._mousemoveHandler = this.handleMouseMove.bind(this);
    this.canvas.addEventListener('click', this._clickHandler);
    this.canvas.addEventListener('touchstart', this._clickHandler);
    this.canvas.addEventListener('mousemove', this._mousemoveHandler);

    // ── 追加：復習ボタンの有効/無効とクリックイベント登録 ──
    const btnReview = document.getElementById('btnReview');
    if (btnReview) {
      btnReview.disabled = reviewQueue.size() === 0;
      btnReview.onclick  = () => publish('changeScreen', 'reviewStage');
    }

    // uiRootを安全に取得
    const uiRoot = getUiRoot();

    // --- ① 色弱モード切替トグル ------------------
    const cbToggle = document.createElement('label');
    cbToggle.innerHTML = `
      <input type="checkbox" id="cbMode">
      <span></span>
    `;
    uiRoot.appendChild(cbToggle);
    // 追加: 後で削除できるようにプロパティとして保持
    this.cbToggle = cbToggle;

    // --- ② フォント+20% トグル ---------------------
    const fontToggle = document.createElement('label');
    fontToggle.innerHTML = `
      <input type="checkbox" id="bigFont">
      <span>文字サイズ +20%</span>
    `;
    uiRoot.appendChild(fontToggle);
    // 追加: 後で削除できるようにプロパティとして保持
    this.fontToggle = fontToggle;
  },

  /** ステージリストを更新する（学年切り替え時に呼ばれる） */
  updateStageList() {
    // 既存のフィルタリング処理
    this.stages = (gameState.currentGrade === 0)
      ? stageData
      : stageData.filter(s => s.grade === gameState.currentGrade);

    // 総復習モードの場合はステージボタンを作成しない
    if (gameState.currentGrade === 0) {
      this.stageButtons = [];
      return;
    }

    // --- この部分を新しいロジックに置き換え ---
    const stageCount = this.stages.length;
    const startY = 80; // ボタンリストの開始Y座標
    const leftPanelWidth = this.canvas.width / 2;

    // ボタンのサイズ設定を動的に決定
    let buttonHeight, buttonMargin, fontSize;
    if (stageCount > 7) {
      // ステージ数が多い場合 (4年生: 9個)
      buttonHeight = 40;  // 高さを小さく
      buttonMargin = 8;   // 余白を詰める
      fontSize = 16;      // フォントも少し小さく
    } else {
      // 通常の場合
      buttonHeight = 50;
      buttonMargin = 15;
      fontSize = 20;
    }

    const buttonWidth = leftPanelWidth - 60;

    this.stageButtons = this.stages.map((stage, index) => {
      return {
        id: stage.stageId,
        text: stage.name,
        x: 30,
        y: startY + index * (buttonHeight + buttonMargin),
        width: buttonWidth,
        height: buttonHeight,
        fontSize: fontSize, // フォントサイズも保持
        stage: stage, // ステージデータも保持
      };
    });
  },

  /** ステージのクリア状況を確認 */
  isStageCleared(stageId) {
    const localStorageCleared = localStorage.getItem(`clear_${stageId}`);
    const gameStateCleared = gameState.stageProgress && gameState.stageProgress[stageId]?.cleared;
    return localStorageCleared || gameStateCleared;
  },

  /** 次に挑戦すべきステージを取得 */
  getNextStage() {
    for (const stage of this.stages) {
      if (!this.isStageCleared(stage.stageId)) {
        return stage;
      }
    }
    return null; // 全てクリア済み
  },

  /** 総復習用の推奨ステージを選択 */
  selectReviewStage() {
    // 1. 未クリアのステージを優先
    const unclearedStages = stageData.filter(stage => !this.isStageCleared(stage.stageId));
    if (unclearedStages.length > 0) {
      // 未クリアステージの中から学年の低いものを優先
      unclearedStages.sort((a, b) => a.grade - b.grade);
      return unclearedStages[0];
    }

    // 2. 全てクリア済みの場合は、復習キューにあるステージを選択
    if (reviewQueue.size() > 0) {
      // 復習キューから漢字を取得し、その漢字が含まれるステージを探す
      const reviewKanjiIds = Array.from(reviewQueue.getAll());
      for (const stage of stageData) {
        if (stage.kanjiPoolIdList && stage.kanjiPoolIdList.some(id => reviewKanjiIds.includes(id))) {
          return stage;
        }
      }
    }

    // 3. 最後の手段として、ランダムにステージを選択
    const randomIndex = Math.floor(Math.random() * stageData.length);
    return stageData[randomIndex];
  },

  /** クロスフェードアニメーションを開始 */
  startCrossfade(oldGrade, newGrade) {
    const oldKey = oldGrade === 0 ? 'stageSelect0' : `stageSelect${oldGrade}`;
    const newKey = newGrade === 0 ? 'stageSelect0' : `stageSelect${newGrade}`;
    
    this.crossfadeState.active = true;
    this.crossfadeState.timer = 0;
    this.crossfadeState.oldImage = images[oldKey] || images.stageSelect0;
    this.crossfadeState.newImage = images[newKey] || images.stageSelect0;
    this.crossfadeState.oldGrade = oldGrade;
    this.crossfadeState.newGrade = newGrade;
  },

  /** マウス移動ハンドラー */
  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    this.mouseX = (e.clientX - rect.left) * scaleX;
    this.mouseY = (e.clientY - rect.top) * scaleY;

    // ホバー中のステージを検出
    this.hoveredStage = null;

    // 総復習モードの場合は通常のホバー判定をスキップ
    if (gameState.currentGrade === 0) {
      return;
    }

    // ステージボタンのホバー判定
    if (this.stageButtons) {
      for (const button of this.stageButtons) {
        if (isMouseOverRect(this.mouseX, this.mouseY, button)) {
          this.hoveredStage = button.stage;
          return;
        }
      }
    }

    // マップマーカーのホバー判定
    if (gameState.currentGrade !== 0) {
      for (const stage of this.stages) {
        const { x, y } = stage.pos;
        if (this.mouseX >= x && this.mouseX <= x + MARKER_SIZE && 
            this.mouseY >= y && this.mouseY <= y + MARKER_SIZE) {
          this.hoveredStage = stage;
          return;
        }
      }
    }
  },

  /** ツールチップを描画 */
  drawTooltip(stage) {
    if (!stage) return;

    const ctx = this.ctx;
    const tooltipX = this.mouseX + 20;
    const tooltipY = this.mouseY - 80;
    const tooltipWidth = 200;
    const tooltipHeight = 90;

    // 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);

    // テキスト
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    let yOffset = 10;
    ctx.fillText(`ステージ: ${stage.name}`, tooltipX + 10, tooltipY + yOffset);
    yOffset += 20;
    
    if (stage.recommendedLevel) {
      ctx.fillText(`推奨Lv: ${stage.recommendedLevel}`, tooltipX + 10, tooltipY + yOffset);
      yOffset += 20;
    }
    
    ctx.fillText(`地方: ${stage.region}`, tooltipX + 10, tooltipY + yOffset);
    yOffset += 20;
    
    const isCleared = this.isStageCleared(stage.stageId);
    ctx.fillStyle = isCleared ? '#4CAF50' : '#FFC107';
    ctx.fillText(isCleared ? 'クリア済み' : '未クリア', tooltipX + 10, tooltipY + yOffset);
  },

  /** 総復習用の統計情報を描画 */
  drawReviewStats(ctx) {
    const panelX = 50;
    const panelY = 320;
    const panelW = 300;
    const panelH = 120;

    // 統計パネルの背景
    this.drawPanelBackground(ctx, panelX, panelY, panelW, panelH, 'paper');

    // 統計情報の計算
    const totalStages = stageData.length;
    const clearedStages = stageData.filter(stage => this.isStageCleared(stage.stageId)).length;
    const clearRate = Math.round((clearedStages / totalStages) * 100);
    const reviewCount = reviewQueue.size();

    // テキスト描画
    ctx.fillStyle = '#333';
    ctx.font = '16px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    let yOffset = 15;
    ctx.fillText('📊 学習状況', panelX + 15, panelY + yOffset);
    yOffset += 25;

    ctx.font = '14px "UDデジタル教科書体", sans-serif';
    ctx.fillText(`ステージクリア率: ${clearRate}% (${clearedStages}/${totalStages})`, panelX + 15, panelY + yOffset);
    yOffset += 20;

    ctx.fillText(`復習待ち漢字: ${reviewCount}個`, panelX + 15, panelY + yOffset);
    yOffset += 20;

    // プログレスバー
    const barX = panelX + 15;
    const barY = panelY + yOffset;
    const barW = panelW - 30;
    const barH = 10;

    // 背景
    ctx.fillStyle = '#ddd';
    ctx.fillRect(barX, barY, barW, barH);

    // 進捗
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(barX, barY, barW * (clearRate / 100), barH);

    // 枠線
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
  },

  /** リッチなボタンを描画するメソッド（battleScreenから移植） */
  drawRichButton(ctx, x, y, width, height, label, baseColor = '#2980b9', isHovered = false) {
    ctx.save();
    
    // ホバー時のスケールとカラー調整
    const scale = isHovered ? 1.05 : 1.0;
    const hoverColor = isHovered ? this.lightenColor(baseColor, 15) : baseColor;
    
    // ホバー時はボタンを中央基準で拡大
    if (isHovered) {
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const scaledWidth = width * scale;
      const scaledHeight = height * scale;
      x = centerX - scaledWidth / 2;
      y = centerY - scaledHeight / 2;
      width = scaledWidth;
      height = scaledHeight;
    }
    
    // 影を描画（少し下と右にオフセット）
    const shadowOffset = isHovered ? 4 : 3;
    const shadowOpacity = isHovered ? 0.4 : 0.3;
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
    ctx.fillRect(x + shadowOffset, y + shadowOffset, width, height);
    
    // グラデーション背景を作成
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, this.lightenColor(hoverColor, 20));
    gradient.addColorStop(1, this.darkenColor(hoverColor, 20));
    
    // ボタン本体を描画
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
    
    // 枠線を描画
    ctx.strokeStyle = this.darkenColor(hoverColor, 30);
    ctx.lineWidth = isHovered ? 3 : 2;
    ctx.strokeRect(x, y, width, height);
    
    // 上部のハイライト（立体感を演出）
    const highlightGradient = ctx.createLinearGradient(x, y, x, y + height * 0.3);
    const highlightOpacity = isHovered ? 0.4 : 0.3;
    highlightGradient.addColorStop(0, `rgba(255, 255, 255, ${highlightOpacity})`);
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlightGradient;
    ctx.fillRect(x, y, width, height * 0.3);
    
    // ホバー時の光るエフェクト
    if (isHovered) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
    }
    
    // テキストを描画
    ctx.fillStyle = 'white';
    ctx.font = '18px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + width / 2, y + height / 2);
    
    ctx.restore();
  },

  /** パネル背景を描画するメソッド（battleScreenから移植） */
  drawPanelBackground(ctx, x, y, width, height, style = 'default') {
    ctx.save();
    
    // 基本的な背景（半透明の暗い色）
    let bgColor = 'rgba(0, 0, 0, 0.7)';
    
    if (style === 'stone') {
      // 石のような質感の背景
      bgColor = 'rgba(50, 50, 60, 0.8)';
    } else if (style === 'paper') {
      // 紙のような質感の背景
      bgColor = 'rgba(245, 235, 215, 0.9)';
    }
    
    // 背景を描画
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, width, height);
    
    // 枠線を描画
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    
    // スタイルに応じた追加装飾
    if (style === 'stone') {
      // 石の質感を表現する細かな線
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      
      // 横線
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x, y + height * i / 3);
        ctx.lineTo(x + width, y + height * i / 3);
        ctx.stroke();
      }
    }
    
    ctx.restore();
  },

  /** 色を明るくするヘルパーメソッド */
  lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  },

  /** 色を暗くするヘルパーメソッド */
  darkenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return '#' + (0x1000000 + (R > 255 ? 255 : R < 0 ? 0 : R) * 0x10000 +
      (G > 255 ? 255 : G < 0 ? 0 : G) * 0x100 +
      (B > 255 ? 255 : B < 0 ? 0 : B)).toString(16).slice(1);
  },

  /** 毎フレーム描画・更新 */
  update(dt) {
    const { ctx, canvas, stages } = this;
    const cw = canvas.width, ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    // アニメーション時間を更新
    this.animationTime += dt || 16; // デフォルト16ms

    // クロスフェードアニメーションの更新
    if (this.crossfadeState.active) {
      this.crossfadeState.timer++;
      if (this.crossfadeState.timer >= this.crossfadeState.duration) {
        this.crossfadeState.active = false;
      }
    }

    // 背景画像をキャンバスの右半分に描画（クロスフェード対応）
    const imageX = cw / 2;
    
    if (this.crossfadeState.active) {
      // クロスフェード中
      const progress = this.crossfadeState.timer / this.crossfadeState.duration;
      const oldAlpha = 1 - progress;
      const newAlpha = progress;
      
      // 古い画像をフェードアウト
      if (this.crossfadeState.oldImage) {
        ctx.save();
        ctx.globalAlpha = oldAlpha;
        ctx.drawImage(this.crossfadeState.oldImage, imageX, 0, cw / 2, ch);
        ctx.restore();
      }
      
      // 新しい画像をフェードイン
      if (this.crossfadeState.newImage) {
        ctx.save();
        ctx.globalAlpha = newAlpha;
        ctx.drawImage(this.crossfadeState.newImage, imageX, 0, cw / 2, ch);
        ctx.restore();
      }
    } else {
      // 通常表示
      const grade = gameState.currentGrade ?? 0;
      const key = grade === 0 ? 'stageSelect0' : `stageSelect${grade}`;
      const bgImg = images[key] || images.stageSelect0;
      if (bgImg) {
        ctx.drawImage(bgImg, imageX, 0, cw / 2, ch);
      }
    }

    // 左側のステージリスト背景パネル
    const panelX = 10;
    const panelY = 60;
    const panelW = cw / 2 - 20;
    const panelH = ch - 140; // フッターバー分の高さを調整
    this.drawPanelBackground(ctx, panelX, panelY, panelW, panelH, 'stone');

    // 追加：学年タブ描画
    const tabCount = tabs.length;
    const tabW = cw / tabCount;
    const tabH = 50;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = '16px sans-serif';
    tabs.forEach((tab, i) => {
      const x0 = i * tabW;
      ctx.fillStyle = (tab.grade === gameState.currentGrade) ? '#ddd' : '#ccc';
      ctx.fillRect(x0, 0, tabW, tabH);
      ctx.fillStyle = '#000';
      ctx.fillText(tab.label, x0 + tabW / 2, tabH / 2);
    });

    // 総復習モードと通常モードで分岐
    if (gameState.currentGrade === 0) {
      // 総復習モード専用UI
      
      // タイトル
      ctx.fillStyle = 'white';
      ctx.font = '24px "UDデジタル教科書体", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('総復習モード', panelX + panelW / 2, panelY + 20);

      // 説明文
      ctx.font = '14px "UDデジタル教科書体", sans-serif';
      ctx.fillStyle = '#ccc';
      ctx.fillText('あなたに最適なステージを自動選択します', panelX + panelW / 2, panelY + 55);

      // メインの復習ボタン
      const button = this.reviewChallengeButton;
      const isHovered = isMouseOverRect(this.mouseX, this.mouseY, button);
      
      // 点滅エフェクト
      const pulse = Math.sin(this.animationTime * 0.003) * 0.2 + 0.8;
      const buttonColor = `hsl(${120 + Math.sin(this.animationTime * 0.002) * 30}, 70%, ${50 + pulse * 10}%)`;
      
      this.drawRichButton(ctx, button.x, button.y, button.width, button.height, button.text, buttonColor, isHovered);

      // アイコン追加
      ctx.fillStyle = 'white';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🎯', button.x + 30, button.y + button.height / 2);

      // 統計情報パネル
      this.drawReviewStats(ctx);

    } else {
      // 通常モード（学年別ステージ選択）
      
      // ステージボタンの描画（リッチなデザイン版）
      if (this.stageButtons) {
        const nextStage = this.getNextStage();
        
        this.stageButtons.forEach(button => {
          const stage = button.stage;
          const isCleared = this.isStageCleared(stage.stageId);
          const isNext = nextStage && nextStage.stageId === stage.stageId;
          const isHovered = this.hoveredStage && this.hoveredStage.stageId === stage.stageId;

          // ボタンの色を決定
          let buttonColor = '#2980b9'; // デフォルト青
          if (isCleared) {
            buttonColor = '#27ae60'; // クリア済みは緑
          } else if (isNext) {
            buttonColor = '#e74c3c'; // 次に挑戦すべきは赤
          }
          
          // リッチなボタンを描画
          this.drawRichButton(ctx, button.x, button.y, button.width, button.height, button.text, buttonColor, isHovered);

          // 追加情報の描画
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.font = '12px sans-serif';

          // クリア状況（星アイコン）
          if (isCleared) {
            ctx.fillStyle = '#FFD700';
            ctx.font = '16px sans-serif';
            ctx.fillText('⭐', button.x + button.width - 25, button.y + 5);
          }

          // 推奨レベル
          if (stage.recommendedLevel) {
            ctx.fillStyle = '#fff';
            ctx.font = '10px sans-serif';
            ctx.fillText(`推奨Lv.${stage.recommendedLevel}`, button.x + 5, button.y + button.height - 15);
          }

          // 次に挑戦すべきステージの表示
          if (isNext) {
            ctx.fillStyle = '#FFD700';
            ctx.font = '10px sans-serif';
            ctx.fillText('NEXT!', button.x + button.width - 50, button.y + button.height - 15);
          }
        });
      }

      // 各ステージのマーカーを動的に描画（ステータス別表示）
      if (gameState.currentGrade !== 0) {
        const nextStage = this.getNextStage();
        
        stages.forEach(stage => {
          const { x, y } = stage.pos;
          const isCleared = this.isStageCleared(stage.stageId);
          const isNext = nextStage && nextStage.stageId === stage.stageId;
          
          let markerImage = images.markerPref;
          let scale = 1;
          let alpha = 1;

          // ステータス別の表示
          if (isCleared) {
            // クリア済み: 金色のマーカー
            markerImage = images.markerCleared || images.markerPref;
            ctx.save();
            ctx.globalAlpha = 1;
            ctx.filter = 'hue-rotate(45deg) saturate(1.5) brightness(1.2)';
          } else if (isNext) {
            // 次に挑戦すべきステージ: 点滅アニメーション
            const pulse = Math.sin(this.animationTime * 0.005) * 0.3 + 0.7;
            scale = 1 + pulse * 0.2;
            alpha = pulse;
            ctx.save();
            ctx.globalAlpha = alpha;
          } else {
            // 未挑戦: 通常表示
            ctx.save();
            ctx.globalAlpha = 0.7;
          }

          if (markerImage) {
            const drawSize = MARKER_SIZE * scale;
            const offsetX = (drawSize - MARKER_SIZE) / 2;
            const offsetY = (drawSize - MARKER_SIZE) / 2;
            ctx.drawImage(markerImage, x - offsetX, y - offsetY, drawSize, drawSize);
          } else {
            ctx.fillStyle = isCleared ? '#FFD700' : (isNext ? '#FF6B35' : '#f00');
            const drawSize = MARKER_SIZE * scale;
            const offsetX = (drawSize - MARKER_SIZE) / 2;
            const offsetY = (drawSize - MARKER_SIZE) / 2;
            ctx.fillRect(x - offsetX, y - offsetY, drawSize, drawSize);
          }

          ctx.restore();
        });
      }
    }

    // フッターバーの描画
    this._drawFooterBar(ctx, cw, ch);

    // ツールチップの描画（総復習モード以外）
    if (gameState.currentGrade !== 0) {
      this.drawTooltip(this.hoveredStage);
    }
  },

  /** フッターバーとボタンの描画 */
  _drawFooterBar(ctx, canvasWidth, canvasHeight) {
    // フッターバーの背景を描画
    const footerBarX = startX - 10;
    const footerBarY = BUTTON_CONFIG.y - 10;
    const footerBarWidth = totalWidth + 20;
    const footerBarHeight = BUTTON_CONFIG.height + 20;
    
    // 半透明の背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(footerBarX, footerBarY, footerBarWidth, footerBarHeight);
    
    // 枠線
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(footerBarX, footerBarY, footerBarWidth, footerBarHeight);
    
    // 上部のハイライト（立体感）
    const gradientHeight = 15;
    const gradient = ctx.createLinearGradient(footerBarX, footerBarY, footerBarX, footerBarY + gradientHeight);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(footerBarX, footerBarY, footerBarWidth, gradientHeight);

    // ホバー判定
    const isBackHovered = isMouseOverRect(this.mouseX, this.mouseY, backButton);
    const isReviewHovered = isMouseOverRect(this.mouseX, this.mouseY, reviewButton);
    const isDexHovered = isMouseOverRect(this.mouseX, this.mouseY, dexButton);
    const isMonsterHovered = isMouseOverRect(this.mouseX, this.mouseY, monsterButton);

    // リッチボタンで描画（色分けとアイコン付き）
    this._drawRichFooterButton(ctx, backButton, '#808080', isBackHovered); // グレー系
    this._drawRichFooterButton(ctx, reviewButton, '#2980b9', isReviewHovered); // 青系
    this._drawRichFooterButton(ctx, dexButton, '#2980b9', isDexHovered); // 青系
    this._drawRichFooterButton(ctx, monsterButton, '#2980b9', isMonsterHovered); // 青系
  },

  /** フッター専用のリッチボタン描画（アイコン付き） */
  _drawRichFooterButton(ctx, button, baseColor, isHovered) {
    ctx.save();
    
    // ホバー時のスケールとカラー調整
    const scale = isHovered ? 1.02 : 1.0; // フッターボタンは控えめなスケール
    const hoverColor = isHovered ? this.lightenColor(baseColor, 15) : baseColor;
    
    let { x, y, width, height } = button;
    
    // ホバー時はボタンを中央基準で拡大
    if (isHovered) {
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const scaledWidth = width * scale;
      const scaledHeight = height * scale;
      x = centerX - scaledWidth / 2;
      y = centerY - scaledHeight / 2;
      width = scaledWidth;
      height = scaledHeight;
    }
    
    // 影を描画（少し下と右にオフセット）
    const shadowOffset = isHovered ? 3 : 2;
    const shadowOpacity = isHovered ? 0.4 : 0.3;
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
    ctx.fillRect(x + shadowOffset, y + shadowOffset, width, height);
    
    // グラデーション背景を作成
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, this.lightenColor(hoverColor, 20));
    gradient.addColorStop(1, this.darkenColor(hoverColor, 20));
    
    // ボタン本体を描画
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
    
    // 枠線を描画
    ctx.strokeStyle = this.darkenColor(hoverColor, 30);
    ctx.lineWidth = isHovered ? 2 : 1;
    ctx.strokeRect(x, y, width, height);
    
    // 上部のハイライト（立体感を演出）
    const highlightGradient = ctx.createLinearGradient(x, y, x, y + height * 0.3);
    const highlightOpacity = isHovered ? 0.4 : 0.3;
    highlightGradient.addColorStop(0, `rgba(255, 255, 255, ${highlightOpacity})`);
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlightGradient;
    ctx.fillRect(x, y, width * 0.8, height * 0.3);
    
    // ホバー時の光るエフェクト
    if (isHovered) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
    }
    
    // アイコンとテキストを描画
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // アイコンを左側に描画
    if (button.icon) {
      ctx.font = '16px sans-serif';
      ctx.fillText(button.icon, x + width * 0.25, y + height / 2);
    }
    
    // テキストを右側に描画
    ctx.font = '14px "UDデジタル教科書体", sans-serif';
    const textX = button.icon ? x + width * 0.65 : x + width / 2;
    ctx.fillText(button.text, textX, y + height / 2);
    
    ctx.restore();
  },

  /** 画面離脱時のクリーンアップ */
  exit() {
    this.unregisterHandlers();
    // スライダー削除
    const bgmSlider = document.getElementById('bgmVolumeSlider');
    if (bgmSlider) bgmSlider.remove();
    const seSlider = document.getElementById('seVolumeSlider');
    if (seSlider) seSlider.remove();

    // 追加: トグル要素を削除
    if (this.cbToggle) {
      this.cbToggle.remove();
      this.cbToggle = null;
    }
    if (this.fontToggle) {
      this.fontToggle.remove();
      this.fontToggle = null;
    }

    this.canvas      = null;
    this.ctx         = null;
    this.backButton  = null;
    this.resetButton = null;
  },

  /** クリックイベント登録 */
  registerHandlers() {
    this._clickHandler = this.handleClick.bind(this);
    this._mousemoveHandler = this.handleMouseMove.bind(this);
    this.canvas.addEventListener('click', this._clickHandler);
    this.canvas.addEventListener('touchstart', this._clickHandler);
    this.canvas.addEventListener('mousemove', this._mousemoveHandler);
  },

  /** クリックイベント解除 */
  unregisterHandlers() {
    this.canvas.removeEventListener('click', this._clickHandler);
    this.canvas.removeEventListener('touchstart', this._clickHandler);
    this.canvas.removeEventListener('mousemove', this._mousemoveHandler);
  },

  /** クリック処理 */
  handleClick(e) {
    // === 座標変換ロジック ===
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

    // タブクリック判定
    const tabCount = tabs.length;
    const tabW = this.canvas.width / tabCount;
    const tabH = 50;
    if (y >= 0 && y <= tabH) {
      const idx = Math.floor(x / tabW);
      const tab = tabs[idx];
      if (tab) {
        const oldGrade = gameState.currentGrade;
        gameState.currentGrade = tab.grade;
        
        // クロスフェードアニメーションを開始
        this.startCrossfade(oldGrade, tab.grade);
        
        this.updateStageList(); // ここでボタンリストも更新される
        publish('playSE', 'decide');
      }
      return;
    }

    // 総復習モードの場合の特別処理
    if (gameState.currentGrade === 0) {
      // 「今日の復習に挑戦！」ボタンのクリック判定
      const button = this.reviewChallengeButton;
      if (isMouseOverRect(x, y, button)) {
        // 推奨ステージを選択
        const selectedStage = this.selectReviewStage();
        if (selectedStage) {
          gameState.currentStageId = selectedStage.stageId;
          resetStageProgress(selectedStage.stageId);
          
          publish('playSE', 'decide');
          publish('changeScreen', 'stageLoading');
        }
        return;
      }
    } else {
      // 通常モード（学年別）の処理
      
      // ステージボタンのクリック判定（ワンクリックで即座にステージ開始）
      if (this.stageButtons) {
        for (const button of this.stageButtons) {
          if (isMouseOverRect(x, y, button)) {
            // バトル画面へ直接遷移する
            gameState.currentStageId = button.id;
            resetStageProgress(button.id);
            
            publish('playSE', 'decide');
            publish('changeScreen', 'stageLoading');
            return;
          }
        }
      }

      // 各ステージマーカーのクリック判定（ワンクリックで即座にステージ開始）
      if (gameState.currentGrade !== 0) {
        for (const stage of this.stages) {
          const { x: sx, y: sy } = stage.pos;
          if (x >= sx && x <= sx + MARKER_SIZE && y >= sy && y <= sy + MARKER_SIZE) {
            gameState.currentStageId = stage.stageId;
            resetStageProgress(stage.stageId);
            
            publish('playSE', 'decide');
            // battleFactory で登録したステート名（stageId）へ遷移
            publish('changeScreen', 'stageLoading');
            return;
          }
        }
      }
    }

    // 「もどる」ボタン
    if (isMouseOverRect(x, y, backButton)) {
      publish('playSE', 'decide');
      publish('changeScreen', 'title');
      return;
    }

    // 復習するボタン押下時 → レビュー画面へ遷移
    if (isMouseOverRect(x, y, reviewButton)) {
      publish('playSE', 'decide');
      publish('changeScreen', 'reviewStage');
      return;
    }

    // 漢字図鑑ボタン
    if (isMouseOverRect(x, y, dexButton)) {
      publish('playSE', 'decide');
      publish('changeScreen', 'kanjiDex');
      return;
    }

    // モンスターデックスボタン
    if (isMouseOverRect(x, y, monsterButton)) {
      publish('playSE', 'decide');
      publish('changeScreen', 'monsterDex');
      return;
    }
  },

  render() {
    this.update(0);
  }
};

export default stageSelectScreenState;

// 追加: FSM 一貫化のため描画エントリポイントを alias
stageSelectScreenState.render = function() {
  this.update(0);
};

