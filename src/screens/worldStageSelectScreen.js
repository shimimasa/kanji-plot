import { gameState, resetStageProgress } from '../core/gameState.js';
import { drawButton, isMouseOverRect } from '../ui/uiRenderer.js';
import { publish } from '../core/eventBus.js';
import { images } from '../loaders/assetsLoader.js';
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
const totalWidth = (BUTTON_CONFIG.width * 3) + (BUTTON_CONFIG.gap * 2);
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

const dexButton = { 
  x: startX + (BUTTON_CONFIG.width + BUTTON_CONFIG.gap) * 1, 
  y: BUTTON_CONFIG.y, 
  width: BUTTON_CONFIG.width, 
  height: BUTTON_CONFIG.height, 
  text: '漢字図鑑',
  icon: '📚'
};

const monsterButton = { 
  x: startX + (BUTTON_CONFIG.width + BUTTON_CONFIG.gap) * 2, 
  y: BUTTON_CONFIG.y, 
  width: BUTTON_CONFIG.width, 
  height: BUTTON_CONFIG.height, 
  text: 'モンスター',
  icon: '👾'
};

// マーカー半径
const MARKER_SIZE = 32;

// 漢検級タブ定義
const tabs = [
  { label: '4級',   kanken_level: 4 },
  { label: '3級',   kanken_level: 3 },
  { label: '準2級', kanken_level: '準2' },
  { label: '2級',   kanken_level: 2 },
];

const worldStageSelectScreen = {
  canvas: null,
  ctx: null,
  stages: [],
  stageButtons: [],
  _clickHandler: null,
  _mousemoveHandler: null,
  mouseX: 0,
  mouseY: 0,
  hoveredStage: null,
  animationTime: 0, // アニメーション用のタイマー
  selectedTabLevel: 4, // デフォルトは4級
  continentInfo: null, // 選択された大陸の情報

  /** 画面表示時の初期化 */
  enter(arg) {
    // BGM 再生 & canvas 取得
    publish('playBGM', 'title');
    this.canvas = (arg && typeof arg.getContext === 'function')
      ? arg
      : document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // 大陸情報を取得
    this.continentInfo = arg?.props || {};
    
    // デフォルトの漢検レベルを設定（大陸情報から取得）
    if (this.continentInfo.kanken_level) {
      this.selectedTabLevel = this.continentInfo.kanken_level;
    }

    // ステージデータ初期化（選択された大陸と漢検レベルに応じたフィルタリング）
    this.updateStageList();

    // イベント登録
    this._clickHandler = this.handleClick.bind(this);
    this._mousemoveHandler = this.handleMouseMove.bind(this);
    this.canvas.addEventListener('click', this._clickHandler);
    this.canvas.addEventListener('touchstart', this._clickHandler);
    this.canvas.addEventListener('mousemove', this._mousemoveHandler);

    // uiRootを安全に取得
    const uiRoot = getUiRoot();
  },

  /** ステージリストを更新する（漢検レベル切り替え時に呼ばれる） */
  updateStageList() {
    // 中学生ステージ（grade: 'J'）かつ選択された大陸と漢検レベルでフィルタリング
    this.stages = stageData.filter(s => 
      s.grade === 'J' && 
      s.continent === this.continentInfo.continent && 
      s.kanken_level === this.selectedTabLevel
    );

    // --- ステージボタンの作成 ---
    const stageCount = this.stages.length;
    const startY = 80; // ボタンリストの開始Y座標
    const leftPanelWidth = this.canvas.width / 2;

    // ボタンのサイズ設定を動的に決定
    let buttonHeight, buttonMargin, fontSize;
    if (stageCount > 7) {
      // ステージ数が多い場合
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

  /** マウス移動ハンドラー */
  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    this.mouseX = (e.clientX - rect.left) * scaleX;
    this.mouseY = (e.clientY - rect.top) * scaleY;

    // ホバー中のステージを検出
    this.hoveredStage = null;

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
    for (const stage of this.stages) {
      if (stage.pos) {
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
    const tooltipHeight = 100;

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
    
    // 漢検レベルを表示
    const levelText = typeof stage.kanken_level === 'number' ? 
      `漢検 ${stage.kanken_level}級 相当` : `漢検 ${stage.kanken_level} 相当`;
    ctx.fillText(levelText, tooltipX + 10, tooltipY + yOffset);
    yOffset += 20;
    
    const isCleared = this.isStageCleared(stage.stageId);
    ctx.fillStyle = isCleared ? '#4CAF50' : '#FFC107';
    ctx.fillText(isCleared ? 'クリア済み' : '未クリア', tooltipX + 10, tooltipY + yOffset);
  },

  /** リッチなボタンを描画するメソッド */
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

  /** パネル背景を描画するメソッド */
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

    // 背景を描画（グラデーション）
    const bgGradient = ctx.createLinearGradient(0, 0, 0, ch);
    bgGradient.addColorStop(0, '#1a365d'); // 暗い青
    bgGradient.addColorStop(1, '#2c5282'); // やや明るい青
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, cw, ch);

    // 右側の大陸地図を描画
    const mapX = cw / 2;
    const mapY = 60;
    const mapWidth = cw / 2;
    const mapHeight = ch - 120;
    
    // 選択された大陸に対応する地図画像を描画
    let continentMap = null;
    
    // 大陸名に基づいて画像を選択
    if (this.continentInfo.continent === 'アジア・オセアニア') {
      continentMap = images.asiaMap || images.worldMap;
    } else if (this.continentInfo.continent === 'ヨーロッパ・中東') {
      continentMap = images.europeMap || images.worldMap;
    } else if (this.continentInfo.continent === 'アフリカ') {
      continentMap = images.africaMap || images.worldMap;
    } else if (this.continentInfo.continent === 'アメリカ大陸') {
      continentMap = images.americaMap || images.worldMap;
    } else {
      continentMap = images.worldMap;
    }
    
    if (continentMap) {
      ctx.drawImage(continentMap, mapX, mapY, mapWidth, mapHeight);
    } else {
      // 地図画像がない場合は代替表示
      this.drawFallbackContinentMap(mapX, mapY, mapWidth, mapHeight);
    }

    // 左側のステージリスト背景パネル
    const panelX = 10;
    const panelY = 60;
    const panelW = cw / 2 - 20;
    const panelH = ch - 140; // フッターバー分の高さを調整
    this.drawPanelBackground(ctx, panelX, panelY, panelW, panelH, 'stone');

    // 漢検級タブ描画
    const tabCount = tabs.length;
    const tabW = cw / tabCount;
    const tabH = 50;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '16px sans-serif';
    tabs.forEach((tab, i) => {
      const x0 = i * tabW;
      const isSelected = tab.kanken_level === this.selectedTabLevel;
      ctx.fillStyle = isSelected ? '#3182ce' : '#4a5568';
      ctx.fillRect(x0, 0, tabW, tabH);
      ctx.fillStyle = '#fff';
      ctx.fillText(tab.label, x0 + tabW / 2, tabH / 2);
    });

    // 大陸名とレベルを表示
    ctx.fillStyle = 'white';
    ctx.font = '24px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    // 漢検レベルのテキスト
    const levelText = typeof this.selectedTabLevel === 'number' ? 
      `漢検${this.selectedTabLevel}級` : `漢検${this.selectedTabLevel}`;
    
    ctx.fillText(`${this.continentInfo.continent} (${levelText})`, panelX + panelW / 2, panelY + 10);

    // ステージボタンの描画
    if (this.stageButtons && this.stageButtons.length > 0) {
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
    } else {
      // ステージがない場合のメッセージ
      ctx.fillStyle = '#ccc';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('この大陸・級のステージはまだありません', panelX + panelW / 2, panelY + 100);
    }

    // 各ステージのマーカーを描画
    stages.forEach(stage => {
      // ステージに位置情報がある場合のみ描画
      if (stage.pos) {
        const { x, y } = stage.pos;
        const isCleared = this.isStageCleared(stage.stageId);
        const isHovered = this.hoveredStage && this.hoveredStage.stageId === stage.stageId;
        
        // マーカーの描画
        ctx.save();
        
        // ホバー時は拡大・発光効果
        if (isHovered) {
          const pulse = Math.sin(this.animationTime * 0.005) * 0.2 + 1.2;
          ctx.shadowColor = '#FFD700';
          ctx.shadowBlur = 15;
          ctx.globalAlpha = 0.9;
          ctx.scale(pulse, pulse);
          ctx.translate(x * (1 - pulse) + x, y * (1 - pulse) + y);
        }
        
        // マーカーの色を決定
        ctx.fillStyle = isCleared ? '#27ae60' : '#e74c3c';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        
        // 円形マーカーを描画
        ctx.beginPath();
        ctx.arc(x, y, MARKER_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // 国・地域の名前を表示
        if (isHovered) {
          ctx.fillStyle = '#fff';
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(stage.name, x, y - 20);
        }
        
        ctx.restore();
      }
    });

    // フッターバーの描画
    this._drawFooterBar(ctx, cw, ch);

    // ツールチップの描画
    this.drawTooltip(this.hoveredStage);
  },

  /** 代替大陸地図を描画 */
  drawFallbackContinentMap(x, y, width, height) {
    const ctx = this.ctx;
    
    // 背景（海）
    ctx.fillStyle = '#4682B4';
    ctx.fillRect(x, y, width, height);
    
    // 大陸名に基づいて簡易的な地図を描画
    ctx.fillStyle = '#228B22';
    ctx.strokeStyle = '#006400';
    ctx.lineWidth = 2;
    
    if (this.continentInfo.continent === 'アジア・オセアニア') {
      // アジア大陸の簡略形状
      ctx.beginPath();
      ctx.ellipse(x + width * 0.5, y + height * 0.4, width * 0.4, height * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // オーストラリア
      ctx.beginPath();
      ctx.ellipse(x + width * 0.6, y + height * 0.7, width * 0.15, height * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
    } else if (this.continentInfo.continent === 'ヨーロッパ・中東') {
      // ヨーロッパの簡略形状
      ctx.beginPath();
      ctx.ellipse(x + width * 0.4, y + height * 0.3, width * 0.3, height * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // 中東
      ctx.beginPath();
      ctx.ellipse(x + width * 0.6, y + height * 0.5, width * 0.2, height * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
    } else if (this.continentInfo.continent === 'アフリカ') {
      // アフリカ大陸の簡略形状
      ctx.beginPath();
      ctx.ellipse(x + width * 0.5, y + height * 0.5, width * 0.3, height * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
    } else if (this.continentInfo.continent === 'アメリカ大陸') {
      // 北アメリカ
      ctx.beginPath();
      ctx.ellipse(x + width * 0.4, y + height * 0.3, width * 0.25, height * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // 南アメリカ
      ctx.beginPath();
      ctx.ellipse(x + width * 0.5, y + height * 0.6, width * 0.2, height * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
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
    const isDexHovered = isMouseOverRect(this.mouseX, this.mouseY, dexButton);
    const isMonsterHovered = isMouseOverRect(this.mouseX, this.mouseY, monsterButton);

    // ボタンの描画
    this.drawRichButton(ctx, backButton.x, backButton.y, backButton.width, backButton.height, backButton.text, isBackHovered ? '#4A90E2' : '#ccc', isBackHovered);
    this.drawRichButton(ctx, dexButton.x, dexButton.y, dexButton.width, dexButton.height, dexButton.text, isDexHovered ? '#4A90E2' : '#ccc', isDexHovered);
    this.drawRichButton(ctx, monsterButton.x, monsterButton.y, monsterButton.width, monsterButton.height, monsterButton.text, isMonsterHovered ? '#4A90E2' : '#ccc', isMonsterHovered);
  },
};

export default worldStageSelectScreen;
