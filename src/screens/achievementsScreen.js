// src/screens/achievementsScreen.js
// 実績一覧画面

import { publish } from '../core/eventBus.js';
import { gameState, isAchievementUnlocked } from '../core/gameState.js';
import { drawButton, isMouseOverRect } from '../ui/uiRenderer.js';

const BTN = {
  back: { x: 20, y: 20, w: 100, h: 30, label: 'メニューへ' },
  prevPage: { x: 580, y: 500, w: 100, h: 40, label: '前のページ' },
  nextPage: { x: 690, y: 500, w: 100, h: 40, label: '次のページ' }
};

const achievementsScreen = {
  canvas: null,
  ctx: null,
  achievements: [],     // 全実績データ
  scroll: 0,           // 表示開始インデックス
  itemsPerPage: 8,     // 1ページあたりの表示数
  _clickHandler: null,
  _keyHandler: null,

  /** enter：画面表示時の初期化 */
  async enter(arg) {
    // canvas 引数が HTMLCanvasElement ならそれを使い、そうでなければ DOM から取得
    this.canvas = (arg && typeof arg.getContext === 'function')
      ? arg
      : document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    
    // 実績データを読み込み
    await this.loadAchievements();
    
    this.scroll = 0;
    
    // イベント登録
    this._clickHandler = e => {
      const r = this.canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      
      // 戻るボタン
      if (isMouseOverRect(x, y, BTN.back)) {
        publish('playSE', 'decide');
        publish('changeScreen', 'menu');
        return;
      }
      
      // 前のページボタン
      if (isMouseOverRect(x, y, BTN.prevPage)) {
        this.scroll = Math.max(0, this.scroll - this.itemsPerPage);
        publish('playSE', 'decide');
        return;
      }
      
      // 次のページボタン
      if (isMouseOverRect(x, y, BTN.nextPage)) {
        const maxScroll = Math.max(0, this.achievements.length - this.itemsPerPage);
        this.scroll = Math.min(maxScroll, this.scroll + this.itemsPerPage);
        publish('playSE', 'decide');
        return;
      }
    };
    this.canvas.addEventListener('click', this._clickHandler);
    
    this._keyHandler = e => {
      if (e.key === 'ArrowUp') {
        this.scroll = Math.max(0, this.scroll - this.itemsPerPage);
      } else if (e.key === 'ArrowDown') {
        const maxScroll = Math.max(0, this.achievements.length - this.itemsPerPage);
        this.scroll = Math.min(maxScroll, this.scroll + this.itemsPerPage);
      }
    };
    window.addEventListener('keydown', this._keyHandler);
  },

  /** 実績データを読み込む */
  async loadAchievements() {
    try {
      const response = await fetch('/src/data/achievements.json');
      if (!response.ok) {
        throw new Error(`実績データの読み込みに失敗: ${response.statusText}`);
      }
      this.achievements = await response.json();
      console.log(`📋 実績データを読み込みました: ${this.achievements.length}件`);
    } catch (error) {
      console.error('❌ 実績データの読み込みエラー:', error);
      this.achievements = [];
    }
  },

  /** update：毎フレーム描画 */
  update(dt) {
    const { ctx, canvas } = this;
    
    // 背景
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 戻るボタン描画
    drawButton(ctx, BTN.back.x, BTN.back.y, BTN.back.w, BTN.back.h, BTN.back.label);

    // ページ送りボタン描画（必要な場合のみ）
    if (this.achievements.length > this.itemsPerPage) {
      drawButton(ctx, BTN.prevPage.x, BTN.prevPage.y, BTN.prevPage.w, BTN.prevPage.h, BTN.prevPage.label);
      drawButton(ctx, BTN.nextPage.x, BTN.nextPage.y, BTN.nextPage.w, BTN.nextPage.h, BTN.nextPage.label);
    }

    // タイトル
    ctx.fillStyle = 'white';
    ctx.font = '28px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('実績一覧', canvas.width / 2, 70);

    // 実績の統計情報
    const unlockedCount = gameState.unlockedAchievements.size;
    const totalCount = this.achievements.length;
    const percentage = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;
    
    ctx.font = '18px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`🏆 ${unlockedCount}/${totalCount} (${percentage}%)`, canvas.width - 20, 40);

    // 実績リスト描画
    this.drawAchievementsList();

    // ページ情報表示
    if (this.achievements.length > this.itemsPerPage) {
      const currentPage = Math.floor(this.scroll / this.itemsPerPage) + 1;
      const totalPages = Math.ceil(this.achievements.length / this.itemsPerPage);
      ctx.fillStyle = 'white';
      ctx.font = '16px "UDデジタル教科書体", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${currentPage} / ${totalPages}`, canvas.width / 2, 525);
    }
  },

  /** 実績リストを描画 */
  drawAchievementsList() {
    const { ctx } = this;
    const startY = 110;
    const lineHeight = 45;
    const itemWidth = 680;
    const itemHeight = 40;
    
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < this.itemsPerPage; i++) {
      const idx = this.scroll + i;
      if (idx >= this.achievements.length) break;
      
      const achievement = this.achievements[idx];
      const y = startY + i * lineHeight;
      const isUnlocked = isAchievementUnlocked(achievement.id);
      
      // アイテム背景
      if (isUnlocked) {
        // 解除済み：輝く背景
        const gradient = ctx.createLinearGradient(50, y - itemHeight/2, 50 + itemWidth, y + itemHeight/2);
        gradient.addColorStop(0, 'rgba(255, 215, 0, 0.1)');
        gradient.addColorStop(0.5, 'rgba(255, 215, 0, 0.2)');
        gradient.addColorStop(1, 'rgba(255, 215, 0, 0.1)');
        ctx.fillStyle = gradient;
      } else {
        // 未解除：暗い背景
        ctx.fillStyle = 'rgba(100, 100, 100, 0.1)';
      }
      ctx.fillRect(50, y - itemHeight/2, itemWidth, itemHeight);
      
      // 枠線
      ctx.strokeStyle = isUnlocked ? '#FFD700' : '#555';
      ctx.lineWidth = 1;
      ctx.strokeRect(50, y - itemHeight/2, itemWidth, itemHeight);

      if (isUnlocked) {
        // 解除済み実績の表示
        this.drawUnlockedAchievement(achievement, y);
      } else {
        // 未解除実績の表示
        this.drawLockedAchievement(achievement, y);
      }
    }
  },

  /** 解除済み実績を描画 */
  drawUnlockedAchievement(achievement, y) {
    const { ctx } = this;
    
    // トロフィーアイコン
    ctx.fillStyle = '#FFD700';
    ctx.font = '24px serif';
    ctx.fillText('🏆', 60, y);
    
    // タイトル
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 18px "UDデジタル教科書体", sans-serif';
    ctx.fillText(achievement.title, 95, y - 8);
    
    // 説明
    ctx.fillStyle = 'white';
    ctx.font = '14px "UDデジタル教科書体", sans-serif';
    ctx.fillText(achievement.description, 95, y + 12);
    
    // 解除済みマーク
    ctx.fillStyle = '#00FF00';
    ctx.font = '12px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('✓ 解除済み', 720, y);
    ctx.textAlign = 'left';
  },

  /** 未解除実績を描画 */
  drawLockedAchievement(achievement, y) {
    const { ctx } = this;
    
    // ロックアイコン
    ctx.fillStyle = '#666';
    ctx.font = '24px serif';
    ctx.fillText('🔒', 60, y);
    
    // 隠されたタイトル
    ctx.fillStyle = '#666';
    ctx.font = '18px "UDデジタル教科書体", sans-serif';
    ctx.fillText('？？？', 95, y - 8);
    
    // 隠された説明
    ctx.fillStyle = '#555';
    ctx.font = '14px "UDデジタル教科書体", sans-serif';
    ctx.fillText('未解除の実績です', 95, y + 12);
    
    // 条件のヒント（オプション）
    if (this.shouldShowHint(achievement)) {
      ctx.fillStyle = '#888';
      ctx.font = '12px "UDデジタル教科書体", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(this.getConditionHint(achievement), 720, y);
      ctx.textAlign = 'left';
    }
  },

  /** ヒントを表示するかどうかの判定 */
  shouldShowHint(achievement) {
    // プレイヤーが一定の進歩をしている場合はヒントを表示
    const { condition } = achievement;
    const playerStats = gameState.playerStats;
    
    switch (condition.type) {
      case 'enemiesDefeated':
        return playerStats.enemiesDefeated > 0;
      case 'levelReached':
        return playerStats.level > 1;
      case 'stagesCleared':
        return playerStats.stagesCleared > 0;
      default:
        return false;
    }
  },

  /** 条件のヒントテキストを生成 */
  getConditionHint(achievement) {
    const { condition } = achievement;
    const playerStats = gameState.playerStats;
    
    switch (condition.type) {
      case 'enemiesDefeated':
        return `敵撃破 ${playerStats.enemiesDefeated}/${condition.value}`;
      case 'levelReached':
        return `レベル ${playerStats.level}/${condition.value}`;
      case 'stagesCleared':
        return `ステージ ${playerStats.stagesCleared}/${condition.value}`;
      case 'kanjiCollected':
        const kanjiCount = gameState.kanjiDex?.size || 0;
        return `漢字 ${kanjiCount}/${condition.value}`;
      case 'monstersCollected':
        const monsterCount = gameState.monsterDex?.size || 0;
        return `モンスター ${monsterCount}/${condition.value}`;
      default:
        return '条件を満たすと解除';
    }
  },

  /** exit：画面離脱時のクリーンアップ */
  exit() {
    // イベント解除
    if (this.canvas && this._clickHandler) {
      this.canvas.removeEventListener('click', this._clickHandler);
    }
    if (this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler);
    }
    this.canvas = this.ctx = null;
    this.achievements = [];
  }
};

export default achievementsScreen;

// 追加: FSM 一貫化のため描画エントリポイントを alias
achievementsScreen.render = function() {
  this.update(0);
}; 