import { publish } from '../core/eventBus.js';
import { gameState } from '../core/gameState.js';
import { drawButton, isMouseOverRect } from '../ui/uiRenderer.js';
import { images } from '../loaders/assetsLoader.js';

// 大陸マーカーの定義
const continentMarkers = [
  { name: 'アジア・オセアニア', kanken_level: 5, x: 650, y: 350, color: '#4A90E2' },
  { name: 'ヨーロッパ・中東',   kanken_level: 4, x: 450, y: 200, color: '#7ED321' },
  { name: 'アフリカ',          kanken_level: 2, x: 450, y: 350, color: '#F5A623' },
  { name: 'アメリカ大陸',      kanken_level: 3, x: 250, y: 250, color: '#BD10E0' },
  { name: '世界の名作',        kanken_level: 1, x: 350, y: 300, color: '#50E3C2' },
];

const backButton = { x: 10, y: 540, width: 120, height: 40, text: '戻る' };

const continentSelectState = {
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
    
    // ズーム時のスケール（大陸によって微調整）
    let targetScale = 2.2;
    if (targetMarker.name === 'アジア・オセアニア') { // アジアは広いので少し小さく
      targetScale = 2.0;
    } else if (targetMarker.name === 'アメリカ大陸') { // アメリカは少し大きく
      targetScale = 2.5;
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
      
      // 少し遅延してから世界ステージ選択画面に遷移
      setTimeout(() => {
        publish('changeScreen', 'worldStageSelect', { 
          continent: this.zoomTarget.name, 
          kanken_level: this.zoomTarget.kanken_level 
        });
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
    this.ctx.fillStyle = '#1E3A8A'; // 深い青色の背景（海）
    this.ctx.fillRect(-this.camera.x / this.camera.scale, -this.camera.y / this.camera.scale, 
                      this.canvas.width / this.camera.scale, this.canvas.height / this.camera.scale);

    // 世界地図を描画
    this.drawWorldMap();

    // 木製看板とタイトルを描画
    this.drawTitle();

    // 大陸マーカーを描画
    this.drawContinentMarkers();

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

  drawWorldMap() {
    // 世界地図画像を使用
    const worldMapImage = images.worldMap;
    
    if (worldMapImage) {
      // 地図を画面全体にバランス良く表示
      const mapX = 50;
      const mapY = 100;
      const mapWidth = this.canvas.width - 100;
      const mapHeight = this.canvas.height - 200;
      
      // 地図画像を描画
      this.ctx.drawImage(worldMapImage, mapX, mapY, mapWidth, mapHeight);
      
      // 地図に軽い影効果を追加してより立体的に
      this.ctx.save();
      this.ctx.globalAlpha = 0.3;
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      this.ctx.fillRect(mapX + 5, mapY + 5, mapWidth, mapHeight);
      this.ctx.restore();
      
    } else {
      // フォールバック：世界地図画像が利用できない場合
      console.warn('世界地図画像が見つかりません。シンプルな代替地図を表示します。');
      this.drawFallbackWorldMap();
    }
  },

  /**
   * フォールバック用のシンプルな世界地図描画
   * 世界地図画像が利用できない場合のみ使用
   */
  drawFallbackWorldMap() {
    const mapX = 50;
    const mapY = 100;
    const mapWidth = this.canvas.width - 100;
    const mapHeight = this.canvas.height - 200;
    
    // 背景の海
    this.ctx.fillStyle = '#4682B4';
    this.ctx.fillRect(mapX, mapY, mapWidth, mapHeight);
    
    // 大陸のシルエット（簡略化）
    this.ctx.fillStyle = '#228B22';
    this.ctx.strokeStyle = '#006400';
    this.ctx.lineWidth = 2;
    
    // アジア・オセアニア
    this.ctx.beginPath();
    this.ctx.ellipse(mapX + mapWidth * 0.7, mapY + mapHeight * 0.4, 
                     mapWidth * 0.25, mapHeight * 0.2, 0, 0, 2 * Math.PI);
    this.ctx.fill();
    this.ctx.stroke();
    
    // ヨーロッパ
    this.ctx.beginPath();
    this.ctx.ellipse(mapX + mapWidth * 0.5, mapY + mapHeight * 0.3, 
                     mapWidth * 0.1, mapHeight * 0.15, 0, 0, 2 * Math.PI);
    this.ctx.fill();
    this.ctx.stroke();
    
    // アフリカ
    this.ctx.beginPath();
    this.ctx.ellipse(mapX + mapWidth * 0.5, mapY + mapHeight * 0.6, 
                     mapWidth * 0.15, mapHeight * 0.2, 0, 0, 2 * Math.PI);
    this.ctx.fill();
    this.ctx.stroke();
    
    // 北アメリカ
    this.ctx.beginPath();
    this.ctx.ellipse(mapX + mapWidth * 0.25, mapY + mapHeight * 0.3, 
                     mapWidth * 0.15, mapHeight * 0.2, 0, 0, 2 * Math.PI);
    this.ctx.fill();
    this.ctx.stroke();
    
    // 南アメリカ
    this.ctx.beginPath();
    this.ctx.ellipse(mapX + mapWidth * 0.3, mapY + mapHeight * 0.7, 
                     mapWidth * 0.1, mapHeight * 0.15, 0, 0, 2 * Math.PI);
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
    this.ctx.strokeText('挑戦する大陸を選ぼう', centerX, 55);
    this.ctx.fillText('挑戦する大陸を選ぼう', centerX, 55);
  },

  drawContinentMarkers() {
    continentMarkers.forEach(marker => {
      const isHovered = this.hoveredMarker === marker;
      const pulseScale = 1 + Math.sin(this.animationTime * 0.003) * 0.1;
      
      // ホバー時の拡大効果を強化
      let scale = pulseScale;
      if (isHovered) {
        scale = 1.4 + Math.sin(this.animationTime * 0.01) * 0.1; // より大きく、より動的に
      }
      
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

      // 漢検レベル表示
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 2;
      this.ctx.textAlign = 'center';
      this.ctx.font = `bold ${16 * scale}px sans-serif`;
      
      // 漢検レベルを表示
      const levelText = typeof marker.kanken_level === 'number' ? 
        `${marker.kanken_level}級` : `${marker.kanken_level}`;
      this.ctx.strokeText(levelText, marker.x, marker.y + 5);
      this.ctx.fillText(levelText, marker.x, marker.y + 5);

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
   * マーカーツールチップを描画（カメラ変換の影響を受けない位置に）
   * @param {object} marker マーカーオブジェクト
   */
  drawMarkerTooltip(marker) {
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
    this.ctx.fillText(`${marker.name}`, tooltipX + 10, tooltipY + 25);
    
    // 漢検レベル情報
    this.ctx.font = '14px sans-serif';
    this.ctx.fillStyle = '#FFD700';
    
    // 漢検レベルを表示
    const levelText = typeof marker.kanken_level === 'number' ? 
      `漢検 ${marker.kanken_level}級 相当` : `漢検 ${marker.kanken_level} 相当`;
    this.ctx.fillText(levelText, tooltipX + 10, tooltipY + 50);
    
    this.ctx.fillStyle = '#CCCCCC';
    this.ctx.font = '12px sans-serif';
    this.ctx.fillText('クリックして挑戦する', tooltipX + 10, tooltipY + 70);
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
    
    for (const marker of continentMarkers) {
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

    // 大陸マーカーのクリック処理
    for (const marker of continentMarkers) {
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
      publish('changeScreen', 'courseSelect');
      return;
    }
  },
  
  render() {
    this.update(0);
  }
};

export default continentSelectState;
