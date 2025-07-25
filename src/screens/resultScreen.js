// js/resultScreen.js
import { publish } from '../core/eventBus.js';
import { drawButton, isMouseOverRect } from '../ui/uiRenderer.js';
import { gameState } from '../core/gameState.js';

const resultScreenState = {
  canvas: null,
  ctx: null,
  finalScore: 0,
  correctCount: 0,
  wrongCount: 0,
  ranking: [],

  enter(canvas, resultData) {
    // canvasの取得を確実にする
    this.canvas = canvas || document.getElementById('gameCanvas');
    if (!this.canvas) {
      console.error('Canvas element not found!');
      return;
    }
    
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      console.error('Canvas context not available!');
      return;
    }

    // resultDataが渡されていない場合のデフォルト処理
    const result = resultData || {
      correct: gameState.correctKanjiList || [],
      wrong: gameState.wrongKanjiList || [],
      time: 0,
      playerHp: gameState.playerStats.hp
    };

    // スコア計算
    this.correctCount = result.correct.length;
    this.wrongCount = result.wrong.length;
    // 基本スコア：正解数 × 10点
    let baseScore = this.correctCount * 10;
    // HP ボーナス：残りHP × 1点
    let hpBonus = result.playerHp || 0;
    // 時間ボーナス（チャレンジモードの場合）
    let timeBonus = 0;
    if (gameState.gameMode === 'challenge' && result.time > 0) {
      timeBonus = result.time * 2; // 残り時間 × 2点
    }
    
    this.finalScore = baseScore + hpBonus + timeBonus;

    const cx = this.canvas.width / 2;
    this.retryButton = { x: cx - 150, y: 400, width: 300, height: 50, text: 'もう一度プレイ' };
    this.titleButton = { x: cx - 150, y: 470, width: 300, height: 50, text: 'タイトルへもどる' };

    this._clickHandler = this.handleClick.bind(this);
    this.canvas.addEventListener('click', this._clickHandler);
    
    // ここでスコアを保存し、ランキングを更新する
    this.updateRanking();
  },

  update(dt) {
    this.ctx.fillStyle = 'black';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.fillStyle = 'white';
    this.ctx.textAlign = 'center';
    
    this.ctx.font = '48px sans-serif';
    this.ctx.fillText('結果発表', this.canvas.width / 2, 80);

    this.ctx.font = '32px sans-serif';
    this.ctx.fillText(`スコア: ${this.finalScore} 点`, this.canvas.width / 2, 150);
    
    this.ctx.font = '24px sans-serif';
    this.ctx.fillText(`正解数: ${this.correctCount}`, this.canvas.width / 2, 200);
    this.ctx.fillText(`不正解数: ${this.wrongCount}`, this.canvas.width / 2, 230);

    // ランキング表示（ステップ3で実装）
    this.ctx.font = '28px sans-serif';
    this.ctx.fillText('ランキング', this.canvas.width / 2, 280);
    this.ranking.forEach((entry, index) => {
      this.ctx.font = '22px sans-serif';
      const rankText = `${index + 1}位: ${entry.score}点 (${new Date(entry.date).toLocaleDateString()})`;
      this.ctx.fillText(rankText, this.canvas.width / 2, 320 + index * 30);
    });

    drawButton(this.ctx, this.retryButton.x, this.retryButton.y, this.retryButton.width, this.retryButton.height, this.retryButton.text);
    drawButton(this.ctx, this.titleButton.x, this.titleButton.y, this.titleButton.width, this.titleButton.height, this.titleButton.text);
  },

  exit() {
    if (this.canvas && this._clickHandler) {
      this.canvas.removeEventListener('click', this._clickHandler);
    }
  },

  handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isMouseOverRect(x, y, this.retryButton)) {
      // 直前のモードでステージ選択画面からやり直す
      publish('changeScreen', 'stageSelect');
    }

    if (isMouseOverRect(x, y, this.titleButton)) {
      publish('changeScreen', 'title');
    }
  },
  
  updateRanking() {
    // 1) 既存のスコア履歴を取得（なければ空配列）
    const raw = localStorage.getItem('kanjiBattleScores');
    const scores = raw ? JSON.parse(raw) : [];

    // 2) 今回のスコアを追加
    scores.push({
      score: this.finalScore,
      date: new Date().toISOString()
    });

    // 3) スコア降順にソート
    scores.sort((a, b) => b.score - a.score);

    // 4) 上位5件を切り出し
    const top5 = scores.slice(0, 5);

    // 5) localStorageに保存
    localStorage.setItem('kanjiBattleScores', JSON.stringify(top5));

    // 6) this.ranking にセット
    this.ranking = top5;
  },
  
  render() {
      this.update(0);
  }
};

export default resultScreenState;