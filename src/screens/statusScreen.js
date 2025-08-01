import { gameState } from '../core/gameState.js';
import { drawButton, isMouseOverRect } from '../ui/uiRenderer.js';
import { publish } from '../core/eventBus.js';
import { images } from '../loaders/assetsLoader.js';
import { checkAchievements } from '../core/achievementManager.js';

const statusScreenState = {
  canvas: null,
  ctx: null,
  _clickHandler: null,
  hpUpgradeButton: null,
  attackUpgradeButton: null,
  backButton: null,

  /** 画面表示時の初期化 */
  enter(arg) {
    // canvas が渡されなければ DOM から取得
    this.canvas = (arg && typeof arg.getContext === 'function')
      ? arg
      : document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // ボタン設定
    const cx = this.canvas.width / 2;
    this.hpUpgradeButton = { 
      x: cx - 180, y: 300, width: 160, height: 50, 
      text: 'HP+10 (SP:1)', 
      cost: 1, 
      stat: 'maxHp', 
      increase: 10 
    };
    this.attackUpgradeButton = { 
      x: cx + 20, y: 300, width: 160, height: 50, 
      text: '攻撃+2 (SP:1)', 
      cost: 1, 
      stat: 'attack', 
      increase: 2 
    };
    this.backButton = { 
      x: cx - 100, y: 400, width: 200, height: 50, 
      text: 'メニューに戻る' 
    };

    // クリックイベント登録
    this.registerHandlers();
  },

  /** 毎フレームの描画更新 */
  update(dt) {
    const { ctx, canvas } = this;
    const player = gameState.playerStats;

    // 背景
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // タイトル
    ctx.fillStyle = 'white';
    ctx.font = '36px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('プレイヤーステータス', canvas.width / 2, 80);

    // プレイヤー名
    if (gameState.playerName) {
      ctx.font = '24px "UDデジタル教科書体", sans-serif';
      ctx.fillText(`${gameState.playerName}`, canvas.width / 2, 120);
    }

    // ステータス表示
    ctx.font = '20px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'left';
    const statusX = canvas.width / 2 - 120;
    const statusY = 160;
    const lineHeight = 30;

    ctx.fillText(`レベル: ${player.level}`, statusX, statusY);
    ctx.fillText(`HP: ${player.hp} / ${player.maxHp}`, statusX, statusY + lineHeight);
    ctx.fillText(`攻撃力: ${player.attack}`, statusX, statusY + lineHeight * 2);
    
    // スキルポイント表示（目立たせる）
    ctx.fillStyle = player.skillPoints > 0 ? '#FFD700' : 'white';
    ctx.font = '22px "UDデジタル教科書体", sans-serif';
    ctx.fillText(`スキルポイント: ${player.skillPoints}`, statusX, statusY + lineHeight * 3);

    // スキルポイントがない場合の説明
    if (player.skillPoints === 0) {
      ctx.fillStyle = '#888888';
      ctx.font = '16px "UDデジタル教科書体", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('レベルアップでスキルポイントを獲得できます', canvas.width / 2, statusY + lineHeight * 4.5);
    }

    // アップグレードボタンの描画
    this.drawUpgradeButton(this.hpUpgradeButton, player.skillPoints >= this.hpUpgradeButton.cost);
    this.drawUpgradeButton(this.attackUpgradeButton, player.skillPoints >= this.attackUpgradeButton.cost);

    // 戻るボタン
    ctx.fillStyle = 'white';
    drawButton(ctx, this.backButton.x, this.backButton.y, this.backButton.width, this.backButton.height, this.backButton.text, '#34495e', 'white');
  },

  /** アップグレードボタンの描画 */
  drawUpgradeButton(button, isEnabled) {
    const { ctx } = this;
    
    // ボタンの色を決定
    const bgColor = isEnabled ? '#27ae60' : '#95a5a6';
    const textColor = isEnabled ? 'white' : '#7f8c8d';
    
    // ボタン背景
    if (images.buttonNormal && isEnabled) {
      ctx.drawImage(images.buttonNormal, button.x, button.y, button.width, button.height);
    }
    
    // ボタン描画
    drawButton(ctx, button.x, button.y, button.width, button.height, button.text, bgColor, textColor);
    
    // 無効な場合はオーバーレイ
    if (!isEnabled) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(button.x, button.y, button.width, button.height);
    }
  },

  /** 画面離脱時のクリーンアップ */
  exit() {
    this.unregisterHandlers();
    this.canvas = null;
    this.ctx = null;
  },

  /** クリックイベントリスナ登録 */
  registerHandlers() {
    this._clickHandler = this.handleClick.bind(this);
    this.canvas.addEventListener('click', this._clickHandler);
  },

  /** クリックイベントリスナ解除 */
  unregisterHandlers() {
    if (this.canvas && this._clickHandler) {
      this.canvas.removeEventListener('click', this._clickHandler);
    }
  },

  /** クリック処理 */
  handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const player = gameState.playerStats;

    // HP アップグレードボタン
    if (isMouseOverRect(x, y, this.hpUpgradeButton) && player.skillPoints >= this.hpUpgradeButton.cost) {
      this.upgradeStatus(this.hpUpgradeButton);
      publish('playSE', 'correct'); // 成功音
      return;
    }

    // 攻撃力アップグレードボタン
    if (isMouseOverRect(x, y, this.attackUpgradeButton) && player.skillPoints >= this.attackUpgradeButton.cost) {
      this.upgradeStatus(this.attackUpgradeButton);
      publish('playSE', 'correct'); // 成功音
      return;
    }

    // 戻るボタン
    if (isMouseOverRect(x, y, this.backButton)) {
      publish('changeScreen', 'menu');
      return;
    }
  },

  /** ステータスアップグレード処理 */
  upgradeStatus(button) {
    const player = gameState.playerStats;
    
    // スキルポイントを消費
    player.skillPoints -= button.cost;
    
    // スキルポイント使用統計の更新
    player.skillPointsUsed += button.cost;
    
    // ステータスを上昇
    player[button.stat] += button.increase;
    
    // HPの場合は現在HPも回復
    if (button.stat === 'maxHp') {
      player.hp += button.increase;
    }
    
    // スキルポイント振り分け直後に実績チェック
    checkAchievements().catch(error => {
      console.error('実績チェック中にエラーが発生しました:', error);
    });
    
    console.log(`${button.stat} を ${button.increase} 上昇させました。残りSP: ${player.skillPoints}`);
  }
};

export default statusScreenState; 