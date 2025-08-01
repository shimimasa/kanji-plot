// js/screens/regionSelectScreen.js
import { publish } from '../core/eventBus.js';
import { gameState } from '../core/gameState.js';
import { drawButton, isMouseOverRect } from '../ui/uiRenderer.js';
import { images } from '../loaders/assetsLoader.js';
import { stageData } from '../loaders/dataLoader.js';

// 地方マーカーの定義（新しい日本地図の地理的位置に合わせて調整）
const regionMarkers = [
  { grade: 1, name: '北海道', x: 665, y: 170, color: '#4A90E2' },  // 右上（北海道）
  { grade: 2, name: '東北', x: 615, y: 220, color: '#7ED321' },    // 本州北部
  { grade: 3, name: '関東', x: 595, y: 290, color: '#F5A623' },    // 本州中央東側
  { grade: 4, name: '中部', x: 535, y: 315, color: '#BD10E0' },    // 本州中央
  { grade: 5, name: '近畿', x: 475, y: 355, color: '#B8E986' },    // 本州中央西側
  { grade: 6, name: '中国', x: 415, y: 375, color: '#50E3C2' },    // 本州西側
];

const backButton = { x: 10, y: 540, width: 120, height: 40, text: 'タイトルへ' };

const regionSelectState = {
  canvas: null,
  ctx: null,
  animationTime: 0,
  hoveredMarker: null,
  
  // ズームアニメーション用の状態
  isZooming: false,
  zoomProgress: 0,
  zoomTarget: null,
  zoomStartTime: 0,
  zoomDuration: 800, // 0.8秒に延長してより滑らかに
  
  // カメラ状態
  camera: {
    x: 0,
    y: 0,
    scale: 1,
    targetX: 0,
    targetY: 0,
    targetScale: 1
  },

  enter(canvas) {
    this.canvas = canvas || document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.animationTime = 0;
    this.hoveredMarker = null;
    this.isZooming = false;
    this.zoomProgress = 0;
    this.zoomTarget = null;
    
    // カメラをリセット
    this.camera = {
      x: 0,
      y: 0,
      scale: 1,
      targetX: 0,
      targetY: 0,
      targetScale: 1
    };

    this._clickHandler = this.handleClick.bind(this);
    this._mouseMoveHandler = this.handleMouseMove.bind(this);
    
    this.canvas.addEventListener('click', this._clickHandler);
    this.canvas.addEventListener('touchstart', this._clickHandler);
    this.canvas.addEventListener('mousemove', this._mouseMoveHandler);
  },

  /**
   * 各地方の達成率を計算
   * @param {number} grade 学年（1-6）
   * @returns {number} 達成率（0-100）
   */
  calculateRegionProgress(grade) {
    // 該当学年のステージを取得
    const regionStages = stageData.filter(stage => stage.grade === grade);
    if (regionStages.length === 0) return 0;

    // クリア済みステージ数を計算
    const clearedStages = regionStages.filter(stage => {
      // localStorageとgameState.stageProgressの両方をチェック
      const localStorageCleared = localStorage.getItem(`clear_${stage.stageId}`);
      const gameStateCleared = gameState.stageProgress && gameState.stageProgress[stage.stageId]?.cleared;
      return localStorageCleared || gameStateCleared;
    });

    return Math.round((clearedStages.length / regionStages.length) * 100);
  },

  /**
   * 次に挑戦すべき地方を判定
   * @returns {number|null} 学年（1-6）またはnull
   */
  getNextRegion() {
    for (let grade = 1; grade <= 6; grade++) {
      const progress = this.calculateRegionProgress(grade);
      if (progress < 100) {
        return grade;
      }
    }
    return null; // 全地方クリア済み
  },

  /**
   * ズームアニメーションを開始
   * @param {object} targetMarker ズーム対象のマーカー
   */
  startZoomAnimation(targetMarker) {
    this.isZooming = true;
    this.zoomProgress = 0;
    this.zoomTarget = targetMarker;
    this.zoomStartTime = this.animationTime;
    
    // 新しい地図位置に合わせてズーム先の座標とスケールを計算
    const canvasCenterX = this.canvas.width / 2;
    const canvasCenterY = this.canvas.height / 2;
    
    // ズーム時のスケール（地方によって微調整）
    let targetScale = 2.2;
    if (targetMarker.grade === 1) { // 北海道は少し大きく
      targetScale = 2.5;
    } else if (targetMarker.grade === 4) { // 中部は広いので少し小さく
      targetScale = 2.0;
    }
    
    // マーカーが画面中央に来るようにカメラ位置を計算
    this.camera.targetX = canvasCenterX - (targetMarker.x * targetScale);
    this.camera.targetY = canvasCenterY - (targetMarker.y * targetScale);
    this.camera.targetScale = targetScale;
    
    // ズーム効果音を再生
    publish('playSE', 'decide');
  },

  /**
   * ズームアニメーションを更新
   * @param {number} dt デルタタイム
   */
  updateZoomAnimation(dt) {
    if (!this.isZooming) return;
    
    const elapsed = this.animationTime - this.zoomStartTime;
    this.zoomProgress = Math.min(elapsed / this.zoomDuration, 1);
    
    // より滑らかなイージング関数（ease-in-out）
    const easeInOut = this.zoomProgress < 0.5
      ? 4 * this.zoomProgress * this.zoomProgress * this.zoomProgress
      : 1 - Math.pow(-2 * this.zoomProgress + 2, 3) / 2;
    
    // カメラ位置とスケールを滑らかに補間
    const lerpFactor = 0.15; // 補間係数を調整
    this.camera.x = this.camera.x + (this.camera.targetX - this.camera.x) * easeInOut * lerpFactor;
    this.camera.y = this.camera.y + (this.camera.targetY - this.camera.y) * easeInOut * lerpFactor;
    this.camera.scale = this.camera.scale + (this.camera.targetScale - this.camera.scale) * easeInOut * lerpFactor;
    
    // アニメーション完了時の処理
    if (this.zoomProgress >= 1) {
      // 最終位置に正確に設定
      this.camera.x = this.camera.targetX;
      this.camera.y = this.camera.targetY;
      this.camera.scale = this.camera.targetScale;
      
      this.isZooming = false;
      gameState.currentGrade = this.zoomTarget.grade;
      
      // 少し遅延してからステージ選択画面に遷移
      setTimeout(() => {
        publish('changeScreen', 'stageSelect');
      }, 200);
    }
  },

  update(dt) {
    this.animationTime += dt;
    
    // ズームアニメーションを更新
    this.updateZoomAnimation(dt);
    
    // カメラ変換を適用
    this.ctx.save();
    this.ctx.translate(this.camera.x, this.camera.y);
    this.ctx.scale(this.camera.scale, this.camera.scale);
    
    // 背景をクリア
    this.ctx.fillStyle = '#87CEEB'; // 空色の背景
    this.ctx.fillRect(-this.camera.x / this.camera.scale, -this.camera.y / this.camera.scale, 
                      this.canvas.width / this.camera.scale, this.canvas.height / this.camera.scale);

    // 日本地図を描画（ステージ選択画面と同じ画像を使用）
    this.drawJapanMap();

    // 木製看板とタイトルを描画
    this.drawTitle();

    // 地方マーカーを描画
    this.drawRegionMarkers();

    // カメラ変換を元に戻す
    this.ctx.restore();

    // UI要素（戻るボタンなど）はカメラ変換の影響を受けない
    if (!this.isZooming) {
      drawButton(this.ctx, backButton.x, backButton.y, backButton.width, backButton.height, backButton.text);
    }

    // ホバー中のマーカー情報を表示（カメラ変換の影響を受けない）
    if (this.hoveredMarker && !this.isZooming) {
      this.drawMarkerTooltip(this.hoveredMarker);
    }
  },

  drawJapanMap() {
    // ステージ選択画面の総復習で使われている日本地図画像を使用
    const japanMapImage = images.stageSelect0 || images.stageSelect;
    
    if (japanMapImage) {
      // 地図を画面の右半分にバランス良く表示
      const mapX = this.canvas.width * 0.3; // 左側30%の位置から開始
      const mapY = 100; // 上部に余白を確保
      const mapWidth = this.canvas.width * 0.65; // 画面幅の65%を使用
      const mapHeight = this.canvas.height - 200; // 下部に余白を確保
      
      // 地図画像を描画
      this.ctx.drawImage(japanMapImage, mapX, mapY, mapWidth, mapHeight);
      
      // 地図に軽い影効果を追加してより立体的に
      this.ctx.save();
      this.ctx.globalAlpha = 0.3;
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      this.ctx.fillRect(mapX + 5, mapY + 5, mapWidth, mapHeight);
      this.ctx.restore();
      
    } else {
      // フォールバック：ステージ選択画像が利用できない場合
      console.warn('日本地図画像が見つかりません。シンプルな代替地図を表示します。');
      this.drawFallbackJapanMap();
    }
  },

  /**
   * フォールバック用のシンプルな日本地図描画
   * ステージ選択画像が利用できない場合のみ使用
   */
  drawFallbackJapanMap() {
    const mapX = this.canvas.width * 0.3;
    const mapY = 100;
    const mapWidth = this.canvas.width * 0.65;
    const mapHeight = this.canvas.height - 200;
    
    // 背景の海
    this.ctx.fillStyle = '#4682B4';
    this.ctx.fillRect(mapX, mapY, mapWidth, mapHeight);
    
    // 日本列島のシルエット（簡略化）
    this.ctx.fillStyle = '#228B22';
    this.ctx.strokeStyle = '#006400';
    this.ctx.lineWidth = 2;
    
    // 本州
    this.ctx.beginPath();
    this.ctx.ellipse(mapX + mapWidth * 0.5, mapY + mapHeight * 0.6, 
                     mapWidth * 0.35, mapHeight * 0.15, -0.2, 0, 2 * Math.PI);
    this.ctx.fill();
    this.ctx.stroke();
    
    // 北海道
    this.ctx.beginPath();
    this.ctx.ellipse(mapX + mapWidth * 0.7, mapY + mapHeight * 0.25, 
                     mapWidth * 0.15, mapHeight * 0.12, 0, 0, 2 * Math.PI);
    this.ctx.fill();
    this.ctx.stroke();
    
    // 九州
    this.ctx.beginPath();
    this.ctx.ellipse(mapX + mapWidth * 0.25, mapY + mapHeight * 0.85, 
                     mapWidth * 0.12, mapHeight * 0.08, 0, 0, 2 * Math.PI);
    this.ctx.fill();
    this.ctx.stroke();
    
    // 四国
    this.ctx.beginPath();
    this.ctx.ellipse(mapX + mapWidth * 0.4, mapY + mapHeight * 0.75, 
                     mapWidth * 0.08, mapHeight * 0.05, 0, 0, 2 * Math.PI);
    this.ctx.fill();
    this.ctx.stroke();
    
    // 枠線
    this.ctx.strokeStyle = '#2F4F4F';
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(mapX, mapY, mapWidth, mapHeight);
  },

  drawTitle() {
    const centerX = this.canvas.width / 2;
    
    if (images.woodenSign) {
      // 木製看板画像が利用可能な場合
      this.ctx.drawImage(images.woodenSign, centerX - 200, 10, 400, 80);
    } else {
      // 代替：木製看板風の描画
      this.ctx.fillStyle = '#8B4513';
      this.ctx.fillRect(centerX - 200, 20, 400, 60);
      
      // 木目風の線
      this.ctx.strokeStyle = '#654321';
      this.ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        this.ctx.beginPath();
        this.ctx.moveTo(centerX - 190, 30 + i * 10);
        this.ctx.lineTo(centerX + 190, 30 + i * 10);
        this.ctx.stroke();
      }
      
      // 枠線
      this.ctx.strokeStyle = '#4A4A4A';
      this.ctx.lineWidth = 3;
      this.ctx.strokeRect(centerX - 200, 20, 400, 60);
    }

    // タイトルテキスト
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 2;
    this.ctx.textAlign = 'center';
    this.ctx.font = 'bold 28px serif';
    this.ctx.strokeText('挑戦する地方を選ぼう', centerX, 55);
    this.ctx.fillText('挑戦する地方を選ぼう', centerX, 55);
  },

  drawRegionMarkers() {
    const nextRegion = this.getNextRegion();

    // ホバー中の地方の境界線ハイライトを先に描画（マーカーの下に表示）
    if (this.hoveredMarker) {
      this.drawRegionBoundaryHighlight(this.hoveredMarker);
    }

    regionMarkers.forEach(marker => {
      const isHovered = this.hoveredMarker === marker;
      const isNext = nextRegion === marker.grade;
      const pulseScale = 1 + Math.sin(this.animationTime * 0.003) * 0.1;
      
      // ホバー時の拡大効果を強化
      let scale = pulseScale;
      if (isHovered) {
        scale = 1.4 + Math.sin(this.animationTime * 0.01) * 0.1; // より大きく、より動的に
      }
      
      // 達成率を計算
      const progress = this.calculateRegionProgress(marker.grade);
      
      // マーカーの影（ホバー時は影も大きく）
      const shadowOffset = isHovered ? 5 : 3;
      this.ctx.fillStyle = `rgba(0, 0, 0, ${isHovered ? 0.4 : 0.3})`;
      this.ctx.beginPath();
      this.ctx.ellipse(marker.x + shadowOffset, marker.y + shadowOffset, 25 * scale, 25 * scale, 0, 0, 2 * Math.PI);
      this.ctx.fill();

      // ホバー時の光る背景効果
      if (isHovered) {
        const glowRadius = 40 * scale;
        const gradient = this.ctx.createRadialGradient(marker.x, marker.y, 0, marker.x, marker.y, glowRadius);
        gradient.addColorStop(0, `${marker.color}40`); // 透明度40%
        gradient.addColorStop(0.7, `${marker.color}20`); // 透明度20%
        gradient.addColorStop(1, 'transparent');
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.ellipse(marker.x, marker.y, glowRadius, glowRadius, 0, 0, 2 * Math.PI);
        this.ctx.fill();
      }

      // マーカー本体
      if (images.regionMarker) {
        // マーカー画像が利用可能な場合
        const size = 50 * scale;
        this.ctx.drawImage(images.regionMarker, marker.x - size/2, marker.y - size/2, size, size);
      } else {
        // 代替：円形マーカー
        // 外側の輪（ホバー時は明るく）
        this.ctx.fillStyle = isHovered ? this.lightenColor(marker.color, 30) : marker.color;
        this.ctx.beginPath();
        this.ctx.ellipse(marker.x, marker.y, 25 * scale, 25 * scale, 0, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // 内側の輪
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.beginPath();
        this.ctx.ellipse(marker.x, marker.y, 18 * scale, 18 * scale, 0, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // 中央の点
        this.ctx.fillStyle = isHovered ? this.lightenColor(marker.color, 30) : marker.color;
        this.ctx.beginPath();
        this.ctx.ellipse(marker.x, marker.y, 8 * scale, 8 * scale, 0, 0, 2 * Math.PI);
        this.ctx.fill();
      }

      // 学年番号
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 2;
      this.ctx.textAlign = 'center';
      this.ctx.font = `bold ${16 * scale}px sans-serif`;
      this.ctx.strokeText(marker.grade.toString(), marker.x, marker.y + 5);
      this.ctx.fillText(marker.grade.toString(), marker.x, marker.y + 5);

      // 達成率プログレスバーを描画（位置調整）
      this.drawProgressBar(marker.x, marker.y + 40 * scale, progress, isHovered);

      // 達成率テキスト（位置調整）
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 1;
      this.ctx.textAlign = 'center';
      this.ctx.font = `bold ${12 * (isHovered ? 1.1 : 1)}px sans-serif`;
      this.ctx.strokeText(`${progress}%`, marker.x, marker.y + 65 * scale);
      this.ctx.fillText(`${progress}%`, marker.x, marker.y + 65 * scale);

      // NEXTインジケーター
      if (isNext) {
        this.drawNextIndicator(marker.x, marker.y);
      }

      // ホバー時の追加エフェクト
      if (isHovered) {
        // 外側の光る輪
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.ellipse(marker.x, marker.y, 35 * scale, 35 * scale, 0, 0, 2 * Math.PI);
        this.ctx.stroke();
        
        // 回転する光る粒子効果
        for (let i = 0; i < 12; i++) {
          const angle = (this.animationTime * 0.003 + i * Math.PI / 6) % (2 * Math.PI);
          const radius = 45 + Math.sin(this.animationTime * 0.005 + i) * 5;
          const sparkleX = marker.x + Math.cos(angle) * radius;
          const sparkleY = marker.y + Math.sin(angle) * radius;
          
          const sparkleAlpha = 0.5 + 0.5 * Math.sin(this.animationTime * 0.008 + i);
          this.ctx.fillStyle = `rgba(255, 215, 0, ${sparkleAlpha})`;
          this.ctx.beginPath();
          this.ctx.ellipse(sparkleX, sparkleY, 4, 4, 0, 0, 2 * Math.PI);
          this.ctx.fill();
        }
      }
    });
  },

  /**
   * 地方境界線のハイライト表示
   * @param {object} marker ハイライト対象のマーカー
   */
  drawRegionBoundaryHighlight(marker) {
    const boundaryImageKey = `region${marker.grade}Boundary`;
    const boundaryImage = images[boundaryImageKey];
    
    if (boundaryImage) {
      // 地図と同じ座標・サイズで境界線画像を描画
      const mapX = this.canvas.width * 0.3;
      const mapY = 100;
      const mapWidth = this.canvas.width * 0.65;
      const mapHeight = this.canvas.height - 200;
      
      // ホバー時のハイライト効果（点滅）
      const blinkAlpha = 0.4 + 0.3 * Math.sin(this.animationTime * 0.008);
      
      this.ctx.save();
      this.ctx.globalAlpha = blinkAlpha;
      
      // 地方の色に基づいたカラーフィルター効果
      this.ctx.globalCompositeOperation = 'multiply';
      this.ctx.fillStyle = marker.color;
      this.ctx.fillRect(mapX, mapY, mapWidth, mapHeight);
      
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.globalAlpha = blinkAlpha * 1.5; // 境界線を少し強調
      
      // 境界線画像を描画
      this.ctx.drawImage(boundaryImage, mapX, mapY, mapWidth, mapHeight);
      
      this.ctx.restore();
      
      // 境界線の光る効果を追加
      this.drawBoundaryGlowEffect(mapX, mapY, mapWidth, mapHeight, marker.color);
      
    } else {
      // フォールバック：シンプルな色付きハイライト
      this.drawFallbackRegionHighlight(marker);
    }
  },

  /**
   * 境界線の光る効果を描画
   * @param {number} mapX 地図のX座標
   * @param {number} mapY 地図のY座標
   * @param {number} mapWidth 地図の幅
   * @param {number} mapHeight 地図の高さ
   * @param {string} color マーカーの色
   */
  drawBoundaryGlowEffect(mapX, mapY, mapWidth, mapHeight, color) {
    this.ctx.save();
    
    // 光る境界線効果
    const glowAlpha = 0.3 + 0.4 * Math.sin(this.animationTime * 0.01);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 4;
    this.ctx.globalAlpha = glowAlpha;
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 15;
    
    // 地図エリアの境界を光らせる
    this.ctx.strokeRect(mapX, mapY, mapWidth, mapHeight);
    
    this.ctx.restore();
  },

  /**
   * フォールバック用の地方ハイライト
   * @param {object} marker ハイライト対象のマーカー
   */
  drawFallbackRegionHighlight(marker) {
    // 境界線画像が利用できない場合の代替表示
    const mapX = this.canvas.width * 0.3;
    const mapY = 100;
    const mapWidth = this.canvas.width * 0.65;
    const mapHeight = this.canvas.height - 200;
    
    const blinkAlpha = 0.2 + 0.2 * Math.sin(this.animationTime * 0.008);
    
    this.ctx.save();
    this.ctx.globalAlpha = blinkAlpha;
    this.ctx.fillStyle = marker.color;
    
    // 地方に応じた大まかなエリアハイライト
    switch (marker.grade) {
      case 1: // 北海道
        this.ctx.fillRect(mapX + mapWidth * 0.6, mapY, mapWidth * 0.4, mapHeight * 0.4);
        break;
      case 2: // 東北
        this.ctx.fillRect(mapX + mapWidth * 0.5, mapY + mapHeight * 0.3, mapWidth * 0.3, mapHeight * 0.3);
        break;
      case 3: // 関東
        this.ctx.fillRect(mapX + mapWidth * 0.45, mapY + mapHeight * 0.45, mapWidth * 0.25, mapHeight * 0.25);
        break;
      case 4: // 中部
        this.ctx.fillRect(mapX + mapWidth * 0.3, mapY + mapHeight * 0.4, mapWidth * 0.3, mapHeight * 0.3);
        break;
      case 5: // 近畿
        this.ctx.fillRect(mapX + mapWidth * 0.25, mapY + mapHeight * 0.5, mapWidth * 0.25, mapHeight * 0.25);
        break;
      case 6: // 中国
        this.ctx.fillRect(mapX + mapWidth * 0.1, mapY + mapHeight * 0.55, mapWidth * 0.3, mapHeight * 0.25);
        break;
    }
    
    this.ctx.restore();
  },

  /**
   * 色を明るくするヘルパー関数
   * @param {string} color 元の色（#RRGGBB形式）
   * @param {number} percent 明るくする割合（0-100）
   * @returns {string} 明るくした色
   */
  lightenColor(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  },

  /**
   * プログレスバーを描画
   * @param {number} x 中心X座標
   * @param {number} y 中心Y座標
   * @param {number} progress 進捗率（0-100）
   * @param {boolean} isHovered ホバー状態
   */
  drawProgressBar(x, y, progress, isHovered = false) {
    const barWidth = isHovered ? 70 : 60; // ホバー時は少し大きく
    const barHeight = isHovered ? 10 : 8;
    const barX = x - barWidth / 2;
    const barY = y - barHeight / 2;

    // 背景
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(barX, barY, barWidth, barHeight);

    // 進捗部分
    const progressWidth = (barWidth * progress) / 100;
    if (progress === 100) {
      // 100%の場合は金色（ホバー時はより明るく）
      this.ctx.fillStyle = isHovered ? '#FFED4E' : '#FFD700';
    } else if (progress >= 75) {
      // 75%以上は緑色
      this.ctx.fillStyle = isHovered ? '#4ADE80' : '#32CD32';
    } else if (progress >= 50) {
      // 50%以上は黄色
      this.ctx.fillStyle = isHovered ? '#FBBF24' : '#FFA500';
    } else if (progress >= 25) {
      // 25%以上はオレンジ色
      this.ctx.fillStyle = isHovered ? '#FB7185' : '#FF6347';
    } else {
      // 25%未満は赤色
      this.ctx.fillStyle = isHovered ? '#F87171' : '#FF4500';
    }
    
    this.ctx.fillRect(barX, barY, progressWidth, barHeight);

    // 枠線（ホバー時は太く）
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = isHovered ? 2 : 1;
    this.ctx.strokeRect(barX, barY, barWidth, barHeight);
  },

  /**
   * NEXTインジケーターを描画
   * @param {number} x マーカーのX座標
   * @param {number} y マーカーのY座標
   */
  drawNextIndicator(x, y) {
    const blinkAlpha = 0.5 + 0.5 * Math.sin(this.animationTime * 0.008);
    
    // NEXT!バッジの背景
    this.ctx.fillStyle = `rgba(255, 69, 0, ${blinkAlpha})`;
    this.ctx.fillRect(x + 35, y - 20, 50, 20);
    
    // NEXT!バッジの枠線
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x + 35, y - 20, 50, 20);
    
    // NEXT!テキスト
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 1;
    this.ctx.textAlign = 'center';
    this.ctx.font = 'bold 10px sans-serif';
    this.ctx.strokeText('NEXT!', x + 60, y - 7);
    this.ctx.fillText('NEXT!', x + 60, y - 7);

    // 矢印アニメーション
    const arrowOffset = Math.sin(this.animationTime * 0.01) * 3;
    this.ctx.fillStyle = `rgba(255, 215, 0, ${blinkAlpha})`;
    this.ctx.beginPath();
    this.ctx.moveTo(x + 30 + arrowOffset, y - 10);
    this.ctx.lineTo(x + 25 + arrowOffset, y - 15);
    this.ctx.lineTo(x + 25 + arrowOffset, y - 5);
    this.ctx.closePath();
    this.ctx.fill();
    
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
  },

  /**
   * マーカーツールチップを描画（カメラ変換の影響を受けない位置に）
   * @param {object} marker マーカーオブジェクト
   */
  drawMarkerTooltip(marker) {
    const progress = this.calculateRegionProgress(marker.grade);
    const regionStages = stageData.filter(stage => stage.grade === marker.grade);
    const clearedStages = regionStages.filter(stage => {
      const localStorageCleared = localStorage.getItem(`clear_${stage.stageId}`);
      const gameStateCleared = gameState.stageProgress && gameState.stageProgress[stage.stageId]?.cleared;
      return localStorageCleared || gameStateCleared;
    });

    // カメラ変換を考慮した画面座標を計算
    const screenX = marker.x * this.camera.scale + this.camera.x;
    const screenY = marker.y * this.camera.scale + this.camera.y;

    const tooltipX = screenX + 40;
    const tooltipY = screenY - 50;
    const tooltipWidth = 200;
    const tooltipHeight = 90;

    // ツールチップの背景（グラデーション）
    const gradient = this.ctx.createLinearGradient(tooltipX, tooltipY, tooltipX, tooltipY + tooltipHeight);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
    gradient.addColorStop(1, 'rgba(20, 20, 20, 0.95)');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
    
    // ツールチップの枠線（光る効果）
    this.ctx.strokeStyle = '#FFD700';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
    
    // 内側の光る枠線
    this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(tooltipX + 2, tooltipY + 2, tooltipWidth - 4, tooltipHeight - 4);

    // ツールチップのテキスト
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.textAlign = 'left';
    this.ctx.font = 'bold 16px sans-serif';
    this.ctx.fillText(`${marker.grade}年生 ${marker.name}地方`, tooltipX + 10, tooltipY + 25);
    
    // 進捗情報
    this.ctx.font = '14px sans-serif';
    this.ctx.fillStyle = progress === 100 ? '#FFD700' : '#FFFFFF';
    this.ctx.fillText(`進捗: ${progress}%`, tooltipX + 10, tooltipY + 50);
    
    this.ctx.fillStyle = '#CCCCCC';
    this.ctx.font = '12px sans-serif';
    this.ctx.fillText(`${clearedStages.length} / ${regionStages.length} ステージクリア`, tooltipX + 10, tooltipY + 70);
  },

  handleMouseMove(e) {
    if (this.isZooming) return; // ズーム中はマウス処理を無効化
    
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const screenX = (e.clientX - rect.left) * scaleX;
    const screenY = (e.clientY - rect.top) * scaleY;
    
    // カメラ変換を逆算してワールド座標を取得
    const worldX = (screenX - this.camera.x) / this.camera.scale;
    const worldY = (screenY - this.camera.y) / this.camera.scale;

    // マーカーとの当たり判定
    const previousHovered = this.hoveredMarker;
    this.hoveredMarker = null;
    
    for (const marker of regionMarkers) {
      const distance = Math.sqrt((worldX - marker.x) ** 2 + (worldY - marker.y) ** 2);
      if (distance <= 35) { // 当たり判定を少し大きく
        this.hoveredMarker = marker;
        this.canvas.style.cursor = 'pointer';
        
        // 新しくホバーした場合はホバー音を再生
        if (previousHovered !== marker) {
          publish('playSE', 'hover');
        }
        break;
      }
    }

    if (!this.hoveredMarker) {
      this.canvas.style.cursor = 'default';
    }
  },

  exit() {
    this.canvas.removeEventListener('click', this._clickHandler);
    this.canvas.removeEventListener('touchstart', this._clickHandler);
    this.canvas.removeEventListener('mousemove', this._mouseMoveHandler);
    this.canvas.style.cursor = 'default';
  },

  handleClick(e) {
    if (this.isZooming) return; // ズーム中はクリックを無効化
    
    // 座標変換ロジック
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
    const screenX = (eventX - rect.left) * scaleX;
    const screenY = (eventY - rect.top) * scaleY;
    
    // カメラ変換を逆算してワールド座標を取得
    const worldX = (screenX - this.camera.x) / this.camera.scale;
    const worldY = (screenY - this.camera.y) / this.camera.scale;

    // 地方マーカーのクリック処理
    for (const marker of regionMarkers) {
      const distance = Math.sqrt((worldX - marker.x) ** 2 + (worldY - marker.y) ** 2);
      if (distance <= 35) {
        // ズームアニメーションを開始
        this.startZoomAnimation(marker);
        return;
      }
    }

    // 戻るボタンのクリック処理（カメラ変換の影響を受けない）
    if (isMouseOverRect(screenX, screenY, backButton)) {
      publish('playSE', 'decide');
      publish('changeScreen', 'title');
      return;
    }
  },
  
  render() {
    this.update(0);
  }
};

export default regionSelectState;