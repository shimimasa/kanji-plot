import { gameState, battleState, addPlayerExp, recordEnemyDefeated } from '../core/gameState.js';
import { drawButton, isMouseOverRect, drawStoneButton } from '../ui/uiRenderer.js';
import { loadMonsterImage, loadBgImage, images, clearImageCache, drawStonePanel } from '../loaders/assetsLoader.js';
import { getEnemiesByStageId, getKanjiByStageId, kanjiData } from '../loaders/dataLoader.js';
import { publish } from '../core/eventBus.js';
import { addKanji } from '../models/kanjiDex.js';
import { addMonster } from '../models/monsterDex.js';
import { checkAchievements } from '../core/achievementManager.js';

// battleStateに残り時間プロパティを追加
battleState.timeRemaining = 60;

// 直近に出題された問題を避けるための設定値
const RECENT_QUESTIONS_BUFFER_SIZE = 5; // 直近5問は出題しない

const BTN = {
  back:   { x: 20,  y: 20,  w: 100, h: 30,  label: 'タイトルへ' },
  stage:  { x: 140, y: 20,  w: 120, h: 30,  label: 'ステージ選択' },
  attack: { x: 230, y: 380, w: 110, h: 50,  label: 'こうげき' },
  heal:   { x: 350, y: 380, w: 110, h: 50,  label: 'かいふく' },
  hint:   { x: 470, y: 380, w: 110, h: 50,  label: 'ヒント' },
};

const ENEMY_DAMAGE_ANIM_DURATION = 10; // ダメージ時の振動フレーム数
const ENEMY_ATTACK_ANIM_DURATION = 15; // 攻撃時の突進フレーム数
const ENEMY_DEFEAT_ANIM_DURATION = 30; // フレーム数（30フレームで約0.5秒）
const PLAYER_HP_ANIM_SPEED = 2;

const battleScreenState = {
  canvas: null,
  ctx: null,
  inputEl: null,
  victoryCallback: null,
  stageBgImage: null,
  _keydownHandler: null,
  _clickHandler: null,
  _wheelHandler: null,
  _mousemoveHandler: null, // マウス移動ハンドラーを追加
  logOffset: 0,
  timerId: null,

  // マウス座標を保存するプロパティを追加
  mouseX: 0,
  mouseY: 0,

  // 経験値アニメーション制御用のプロパティを追加
  isAnimatingExp: false,
  expAnimQueue: [],
  levelUpMessage: '',

  // ステージクリア待機フラグを追加
  stageClearPending: false,

  // 画面フラッシュ効果用のプロパティを追加
  flashEffect: {
    active: false,
    timer: 0,
    duration: 15, // フラッシュ持続フレーム数
    color: 'rgba(255, 0, 0, 0.5)' // 赤色の半透明
  },

  // 読みハイライト効果用のプロパティを追加
  readingHighlight: {
    active: false,
    timer: 0,
    duration: 60, // 1秒 = 約60フレーム
    type: null    // 'onyomi' または 'kunyomi'
  },

  // コンボ表示アニメーション用のプロパティを追加
  comboAnimation: {
    active: false,
    timer: 0,
    duration: 30, // アニメーション持続フレーム数
    scale: 1.0,   // 現在のスケール値
    comboCount: 0 // 表示するコンボ数
  },

  // 経験値アニメーション関連の新しいプロパティを追加
  playerExpDisplay: 0,    // 現在表示している経験値
  playerExpTarget: 0,     // 目標経験値
  playerExpAnimating: false, // アニメーション中かどうか
  expAnimSpeed: 1,        // 経験値バーのアニメーション速度

  // 不正解の答えを保存するプロパティを追加
  lastIncorrectAnswer: null,

  // 漢字ボックスのエフェクト用プロパティを追加
  kanjiBoxEffect: {
    active: false,
    timer: 0,
    duration: 0,
    color: 'rgba(46, 204, 113, 0.8)',
    originalSize: { width: 180, height: 180 },
    currentSize: { width: 180, height: 180 },
    maxScale: 1.1,
    pulsePhase: 0
  },

  // レベルアップ演出強化用のプロパティ
  levelUpEffect: {
    active: false,
    timer: 0,
    duration: 120, // 2秒間 (60フレーム/秒として)
    overlayOpacity: 0.5, // オーバーレイの透明度
    pulsateSpeed: 0.05 // メッセージの点滅速度
  },

  // メッセージログのタイプライター効果用プロパティ
  typewriterEffect: {
    active: false,          // アニメーション中かどうか
    targetMessage: "",      // アニメーション対象のメッセージ
    displayedChars: 0,      // 現在表示している文字数
    messageIndex: -1,       // 対象メッセージのインデックス
    charInterval: 2,        // 文字表示の間隔（フレーム数）
    charTimer: 0,           // 次の文字表示までのタイマー
    soundInterval: 3        // タイプ音の間隔（文字数）
  },

  // 経験値パーティクル用のプロパティを追加
  expParticles: {
    active: false,
    particles: [],
    maxParticles: 15,
    sourceX: 0,
    sourceY: 0,
    targetX: 0,
    targetY: 0,
    expAmount: 0
  },

  shakeEffect: {
    active: false,
    timer: 0,
    duration: 0,
    intensity: 0
  },

  // 「１つまえの漢字」パネル関連
  isPrevKanjiPanelOpen: false,
  lastAnsweredKanji: null,

  // 修正2: pressedButtonsプロパティを追加
  pressedButtons: new Set(),

  /**
   * 漢字ボックスのエフェクトを開始するメソッド
   * @param {string} color - エフェクトの色
   * @param {number} duration - エフェクトの持続フレーム数
   */
  startKanjiBoxEffect(color = 'rgba(46, 204, 113, 0.8)', duration = 15) {
    this.kanjiBoxEffect.active = true;
    this.kanjiBoxEffect.timer = duration;
    this.kanjiBoxEffect.duration = duration;
    this.kanjiBoxEffect.color = color;
    this.kanjiBoxEffect.pulsePhase = 0;
    console.log('漢字ボックスエフェクト開始:', color, duration); // デバッグ用
  },
  
  /**
   * シェイクエフェクトを開始するメソッド
   * @param {number} duration - エフェクトの持続フレーム数
   * @param {number} intensity - 震えの強さ
   */
  startShakeEffect(duration = 15, intensity = 5) {
    this.shakeEffect.active = true;
    this.shakeEffect.timer = duration;
    this.shakeEffect.duration = duration;
    this.shakeEffect.intensity = intensity;
    console.log('シェイクエフェクト開始:', duration, intensity); // デバッグ用
  },

  /** 画面がアクティブになったときの初期化 */
  enter(canvasEl, onVictory) {
    try {
      // デバッグ情報
      console.log("🧪 battleScreen.enter() 実行", {
        canvasEl: canvasEl,
        gameStateId: gameState.currentStageId
      });
      
      if (!gameState.currentStageId) {
        alert('ステージIDが未設定です。タイトルに戻ります。');
        publish('changeScreen', 'title');
        return;
      }
      
      // バトル画面に入ったら BGM をバトル用に切り替える
      publish('playBGM', 'battle');
      
      // バトル開始時にプレイヤー HP とターン状態を初期化
      gameState.playerStats.hp       = gameState.playerStats.maxHp;
      battleState.turn               = 'player';
      battleState.inputEnabled       = true;
      battleState.comboCount         = 0;
      battleState.message            = '';
      battleState.enemyAction        = null;
      battleState.enemyActionTimer   = 0;
      
      // 経験値アニメーション関連の初期化
      this.isAnimatingExp = false;
      this.expAnimQueue = [];
      this.levelUpMessage = '';
      
      // チャレンジモードの場合、タイマーを開始
      if (gameState.gameMode === 'challenge') {
        battleState.timeRemaining = 60;
        this.timerId = setInterval(() => {
          battleState.timeRemaining--;
          if (battleState.timeRemaining <= 0) {
            clearInterval(this.timerId);
            this.timerId = null;
            publish('changeScreen', 'gameOver');
          }
        }, 1000);
      }

      // ※※※ 重要な修正: キャンバス要素の取得 ※※※
      // 引数のcanvasElがnullまたはundefinedの場合は、DOMから取得する
      if (!canvasEl) {
        console.log("⚠️ canvasEl引数がありません。DOMから取得します。");
        canvasEl = document.getElementById('gameCanvas');
      }
      
      // 最終チェック
      if (!canvasEl) {
        throw new Error("キャンバス要素が見つかりません");
      }
      
      this.canvas = canvasEl;
      this.ctx = this.canvas.getContext('2d');
      
      if (!this.ctx) {
        throw new Error("Canvas 2Dコンテキストの取得に失敗しました");
      }
      
      // 以下、通常の初期化処理
      this.inputEl = document.getElementById('kanjiInput');
      
      if (!this.inputEl) {
        console.error('kanjiInput要素が見つかりません');
        // ここではエラーをスローせず、続行する
      } else {
        // 入力欄を確実に表示
        this.inputEl.style.display = 'block';
        this.inputEl.placeholder = 'よみを にゅうりょく';
        
        // ここで関数を参照する前に、関数が定義されていることを確認
        // Enter キーで最後に選択したコマンドを呼び出す
        this._keydownHandler = e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (battleState.turn === 'player' && battleState.inputEnabled) {
              const mode = battleState.lastCommandMode || 'attack';
              
              // 安全な遅延実行で関数の定義を待つ
              setTimeout(() => {
                try {
                  if (mode === 'attack') {
                    if (typeof onAttack === 'function') {
                      onAttack();
                    } else {
                      console.error('onAttack関数が定義されていません');
                      battleState.inputEnabled = true;
                    }
                  } else if (mode === 'heal') {
                    if (typeof onHeal === 'function') {
                      onHeal();
                    } else {
                      console.error('onHeal関数が定義されていません');
                      battleState.inputEnabled = true;
                    }
                  } else {
                    if (typeof onHint === 'function') {
                      onHint();
                    } else {
                      console.error('onHint関数が定義されていません');
                      battleState.inputEnabled = true;
                    }
                  }
                } catch (error) {
                  console.error('処理中にエラーが発生しました:', error);
                  battleState.inputEnabled = true;
                  // 入力欄をクリア
                  if (this.inputEl) {
                    this.inputEl.value = '';
                  }
                }
              }, 0); // 0ミリ秒の遅延で次のイベントループで実行
            }
          }
        };
        this.inputEl.addEventListener('keydown', this._keydownHandler);
      }

      this.victoryCallback = onVictory;

      // 各リストを初期化
      gameState.correctKanjiList = [];
      gameState.wrongKanjiList = [];
      battleState.log = [];

      // 背景画像をキャッシュから取得
      try {
        this.stageBgImage = images[`bg_${gameState.currentStageId}`] || null;
        console.log(`🖼️ 背景画像取得: ${gameState.currentStageId}`, this.stageBgImage ? '成功' : '失敗');
      } catch (e) {
        console.warn('背景画像が見つかりませんでした:', e);
        this.stageBgImage = null;
      }

      // ステージデータの取得
      gameState.enemies = getEnemiesByStageId(gameState.currentStageId);
      gameState.kanjiPool = getKanjiByStageId(gameState.currentStageId);
      
      // 漢字プールの事前フィルタリング
      battleState.kanjiPool_onyomi = gameState.kanjiPool.filter(kanji => {
        return kanji.onyomi && 
               ((Array.isArray(kanji.onyomi) && kanji.onyomi.length > 0) || 
                (typeof kanji.onyomi === 'string' && kanji.onyomi.trim() !== ''));
      });
      
      battleState.kanjiPool_kunyomi = gameState.kanjiPool.filter(kanji => {
        return kanji.kunyomi && 
               ((Array.isArray(kanji.kunyomi) && kanji.kunyomi.length > 0) || 
                (typeof kanji.kunyomi === 'string' && kanji.kunyomi.trim() !== ''));
      });
      
      if (!gameState.kanjiPool.length) {
        alert('このステージに紐づく漢字データがありません。\nステージ選択へ戻ります。');
        publish('changeScreen', 'stageSelect');
        return;
      }
      
      gameState.currentEnemyIndex = 0;
      battleState.recentKanjiIds = [];
      battleState.shuffledKanjiList = [...gameState.kanjiPool].sort(() => Math.random() - 0.5);
      battleState.currentKanjiIndex = 0;

      // 敵画像をキャッシュから取得
      for (const e of gameState.enemies) {
        e.img = images[e.id] || null;
        e.hp = e.maxHp;
      }

      // 表示用HPステートを初期化
      battleState.playerHpDisplay = gameState.playerStats.hp;
      battleState.playerHpTarget = gameState.playerStats.hp;
      battleState.playerHpAnimating = false;
      battleState.lastAnswered = null;

      // 敵の生成と最初の漢字を選択
      spawnEnemy();
      pickNextKanji();
      this.logOffset = 0;

      // イベントハンドラの登録
      this.registerHandlers();

      // コンボアニメーション関連の初期化
      this.comboAnimation.active = false;
      this.comboAnimation.timer = 0;
      this.comboAnimation.scale = 1.0;
      this.comboAnimation.comboCount = 0;

      // 経験値表示の初期化（修正版）
      const player = gameState.playerStats;
      const currentLevelExp = calculateExpForLevel(player.level);
      const expInCurrentLevel = Math.max(0, player.exp - currentLevelExp);
      this.playerExpDisplay = expInCurrentLevel;
      this.playerExpTarget = expInCurrentLevel;
      this.playerExpAnimating = false;

      // ヒントレベルを初期化
      gameState.hintLevel = 0;
      
      console.log("✅ battleScreen.enter() 完了");
      
    } catch (error) {
      // エラーハンドリング
      console.error("❌ battleScreen.enter() でエラー発生:", error);
      alert(`ゲーム画面の初期化に失敗しました: ${error.message}\nステージ選択に戻ります。`);
      publish('changeScreen', 'stageSelect');
    }
  },

  /** 1フレームごとの描画更新 */
  update(dt) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // ① 背景描画 (画像 or グラデ)
    if (this.stageBgImage) {
      // ステージ背景画像がある場合は画像を描画
      this.ctx.drawImage(this.stageBgImage, 0, 0, this.canvas.width, this.canvas.height);
    } else {
      // 背景画像がない場合はグラデーション背景を使用
    const grad = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    grad.addColorStop(0, '#1e3c72');
    grad.addColorStop(1, '#2a5298');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // ② 左上に「タイトルへ」「ステージ選択」ボタンを描画（リッチなデザイン）
    [BTN.back, BTN.stage].forEach(b => {
      const isHovered = isMouseOverRect(this.mouseX, this.mouseY, b);
      this.drawRichButton(this.ctx, b.x, b.y, b.w, b.h, b.label, '#34495e', isHovered);
    });

    /* 敵 */
    const enemy = gameState.currentEnemy;
    const ex = 480, ey = 80, ew = 240, eh = 120;

    // アニメーション用オフセット計算
    let offsetX = 0, offsetY = 0, rotateAngle = 0, alpha = 1;
    if (battleState.enemyAction === 'damage' && battleState.enemyActionTimer > 0) {
      // 振動エフェクト（ランダムに±幅を動かす）
      offsetX = (Math.random() - 0.5) * 20; 
      offsetY = (Math.random() - 0.5) * 10;
      battleState.enemyActionTimer--;
      if (battleState.enemyActionTimer === 0) {
        battleState.enemyAction = null;
      }
    }
    else if (battleState.enemyAction === 'attack' && battleState.enemyActionTimer > 0) {
      // 突進エフェクト（経過に応じて手前に移動して戻る）
      const total = ENEMY_ATTACK_ANIM_DURATION;
      const half  = total / 2;
      const t     = battleState.enemyActionTimer;
      const progress = (half - Math.abs(t - half)) / half; // 0→1→0 の波
      offsetX = -progress * 30; // 左に最大30px
      battleState.enemyActionTimer--;
      if (battleState.enemyActionTimer === 0) {
        battleState.enemyAction = null;
      }
    }

    // ここから追加：撃破時の倒れるアニメーション
    if (battleState.enemyAction === 'defeat' && battleState.enemyActionTimer > 0) {
      const total    = ENEMY_DEFEAT_ANIM_DURATION;
      const timer    = battleState.enemyActionTimer;
      const progress = (total - timer) / total;      // 0→1
      rotateAngle    = progress * (Math.PI / 2);     // 最大90度倒れる
      alpha          = 1 - progress;                 // 徐々にフェードアウト
      battleState.enemyActionTimer--;
      if (battleState.enemyActionTimer === 0) {
        battleState.enemyAction = null;
      }
    }

    // ── 敵描画：回転と透明度を反映 ──
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.translate(ex + ew/2 + offsetX, ey + eh/2 + offsetY);
    this.ctx.rotate(rotateAngle);

    // ボスシールドの描画（敵画像の前に描画）
    if (enemy && enemy.isBoss && enemy.shieldHp > 0) {
      const shieldRadius = Math.max(ew, eh) * 0.6; // 敵の大きさに合わせたバリア半径
      const shieldOpacity = 0.3 + (Math.sin(Date.now() / 300) + 1) * 0.1; // 0.3〜0.5の間で脈動
      
      // グラデーションのバリアを作成
      const shieldGrad = this.ctx.createRadialGradient(0, 0, shieldRadius * 0.7, 0, 0, shieldRadius);
      shieldGrad.addColorStop(0, `rgba(100, 180, 255, 0)`);
      shieldGrad.addColorStop(0.7, `rgba(100, 180, 255, ${shieldOpacity * 0.5})`);
      shieldGrad.addColorStop(1, `rgba(120, 210, 255, ${shieldOpacity})`);
      
      this.ctx.fillStyle = shieldGrad;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, shieldRadius, 0, Math.PI * 2);
      this.ctx.fill();
      
      // バリアの輪郭線
      this.ctx.strokeStyle = `rgba(200, 230, 255, ${shieldOpacity + 0.2})`;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }

    if (enemy && enemy.img) {
      // 画像がある場合は画像を描画（シンプルに）
      // 透明度を保持するために、背景を先に描画しない
      this.ctx.drawImage(enemy.img, -ew/2, -eh/2, ew, eh);
    } else {
      // 画像がない場合は代替表示
      this.ctx.fillStyle = '#6b8e23';
      this.ctx.fillRect(-ew/2, -eh/2, ew, eh);
      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 20px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(enemy ? enemy.name : 'モンスター', 0, 0);
    }

    this.ctx.restore();

    // ── 漢字 & ヒント ──
    // 問題漢字を枠付き＆拡大描画
    const kanjiX = this.canvas.width / 2;
    const kanjiY = 200;
    const kanjiBoxW = 180, kanjiBoxH = 160;
    
    // 弱点表示を「テキストメッセージ」に変更
    if (gameState.currentEnemy && gameState.currentEnemy.weakness) {
      const weaknessLabel = gameState.currentEnemy.weakness === 'onyomi' ? '音読み' : '訓読み';
      const message = `弱点は${weaknessLabel}！`;
      
      this.drawTextWithOutline(
        message,
        kanjiX, // X座標（中央寄せ）
        kanjiY - kanjiBoxH / 2 - 20, // Y座標（漢字ボックスの上）
        '#f39c12', // オレンジ色
        'black',
        'bold 20px "UDデジタル教科書体",sans-serif',
        'center',
        'bottom', // 基準点を下にすることで位置調整
        3
      );
    }
    
    
    
    // コンボ表示を描画（2コンボ以上の場合）
    // battleState.comboCountが0の場合は表示しない
    if ((battleState.comboCount >= 2 && battleState.comboCount > 0) || this.comboAnimation.active) {
      this.drawComboIndicator(this.ctx);
    }

    // ヒントを表示（ヒントレベルに応じて表示内容を変更）
    if (gameState.hintLevel > 0) {
      let hintText = '';
      let hintColor = 'yellow';
      
      switch(gameState.hintLevel) {
        case 1:
          hintText = `ヒント（基本）: 画数は${gameState.currentKanji.strokes}`;
          hintColor = '#3498db'; // 青色
          break;
        case 2:
          // 音読みと訓読みのどちらかをランダムに選ぶ（ただし毎回同じになるよう固定する）
          const kanjiId = gameState.currentKanji.id;
          const isOnyomi = (kanjiId % 2 === 0); // IDの偶数奇数で固定
          const readings = isOnyomi ? gameState.currentKanji.onyomi : gameState.currentKanji.kunyomi;
          
          if (readings && readings.length > 0) {
            const firstReading = readings[0];
            const hintText2 = firstReading.substring(0, 1) + '○○';
            hintText = `ヒント（読み）: ${isOnyomi ? '音読み' : '訓読み'}は「${hintText2}」から始まる`;
          } else {
            hintText = `ヒント（読み）: ${isOnyomi ? '訓読み' : '音読み'}で読むことが多い`;
          }
          hintColor = '#f39c12'; // オレンジ色
          break;
        case 3:
          hintText = `ヒント（意味）: ${gameState.currentKanji.meaning}`;
          hintColor = '#e74c3c'; // 赤色
          break;
      }
      
      // ヒントの背景を描画
      const kanjiBoxH = 160;
      const hintBoxWidth = this.ctx.measureText(hintText).width + 40;
      const hintBoxHeight = 30;
      const hintBoxX = kanjiX - hintBoxWidth / 2;
      const hintBoxY = kanjiY + kanjiBoxH / 2 + 10;
      
      // 半透明の背景
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(hintBoxX, hintBoxY, hintBoxWidth, hintBoxHeight);
      
      // 枠線
      this.ctx.strokeStyle = hintColor;
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(hintBoxX, hintBoxY, hintBoxWidth, hintBoxHeight);
      
      // ヒントレベルに応じたアイコン表示
      const icons = ['💡', '💡💡', '💡💡💡'];
      const iconText = icons[gameState.hintLevel - 1];
      
      // アイコンを描画
      this.ctx.font = '14px sans-serif';
      this.ctx.fillStyle = hintColor;
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(iconText, hintBoxX + 10, hintBoxY + hintBoxHeight / 2);
      
      // ヒントテキストを描画
      this.drawTextWithOutline(
        hintText,
        hintBoxX + 40, // アイコン分の余白を確保
        hintBoxY + hintBoxHeight / 2,
        hintColor,
        'black',
        '16px "UDデジタル教科書体",sans-serif',
        'left',
        'middle',
        1
      );
    }

    // ← ここから追加：前回解答表示エリア（左側）
    if (battleState.lastAnswered) {
      const bx = 20, by = 70, bw = 140, bh = 180; // 高さを160から180に増加
      
      // パネル背景描画
      this.drawPanelBackground(this.ctx, bx, by, bw, bh, 'stone');

      this.ctx.fillStyle = 'white';
      this.ctx.textAlign = 'center';
      // タイトル
      this.ctx.font = 'bold 14px "UDデジタル教科書体",sans-serif';
      this.ctx.fillText('1つまえの漢字', bx + bw/2, by + 15);
      
      // 漢字本体
      this.ctx.font = '42px serif';
      this.ctx.fillText(battleState.lastAnswered.text, bx + bw/2, by + 55);

      // 訓読み（ひらがな）
      this.ctx.font = '12px "UDデジタル教科書体",sans-serif';
      const kun = battleState.lastAnswered.kunyomi.join('、');
      
      // 訓読みのハイライト効果
      if (this.readingHighlight.active && this.readingHighlight.type === 'kunyomi') {
        this.ctx.fillStyle = 'yellow'; // ハイライト色
      } else {
        this.ctx.fillStyle = 'white';  // 通常色
      }
      this.ctx.textAlign = 'left';
      this.ctx.fillText(`訓読み: ${kun}`, bx + 10, by + 85); // Y座標を調整
      
      // 音読み（カタカナ）
      const on = battleState.lastAnswered.onyomi.join('、');
      
      // 音読みのハイライト効果
      if (this.readingHighlight.active && this.readingHighlight.type === 'onyomi') {
        this.ctx.fillStyle = 'yellow'; // ハイライト色
      } else {
        this.ctx.fillStyle = 'white';  // 通常色
      }
      this.ctx.fillText(`音読み: ${on}`, bx + 10, by + 105); // Y座標を調整

      // 画数（常に白色）
      this.ctx.fillStyle = 'white';
      this.ctx.fillText(`画数: ${battleState.lastAnswered.strokes}`, bx + 10, by + 125); // Y座標を調整

      // 自分の間違った答えを表示（lastIncorrectAnswerが存在する場合のみ）
      if (this.lastIncorrectAnswer) {
        // 背景（半透明の赤）
        this.ctx.fillStyle = 'rgba(231, 76, 60, 0.2)';
        this.ctx.fillRect(bx + 10, by + 140, bw - 20, 22); // Y座標を調整
        
        // 枠線（赤）
        this.ctx.strokeStyle = 'rgba(231, 76, 60, 0.8)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(bx + 10, by + 140, bw - 20, 22); // Y座標を調整
        
        // 間違った答えのテキスト
        this.ctx.fillStyle = '#e74c3c'; // 赤色
        this.ctx.font = 'bold 12px "UDデジタル教科書体",sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`あなたの答え: ${this.lastIncorrectAnswer}`, bx + bw/2, by + 155); // Y座標を調整
      }
    }
    // ← ここまで追加

    // ── 経験値アニメーション処理 ──
    // isAnimatingExpがfalse、かつexpAnimQueueに要素がある場合に処理開始
    if (!this.isAnimatingExp && this.expAnimQueue.length > 0) {
      this.isAnimatingExp = true;
      
      // expAnimQueueから経験値を1つ取り出し
      const expGained = this.expAnimQueue.shift();
      
      // addPlayerExp関数を呼び出してgameStateを更新し、戻り値を取得
      const levelUpResult = addPlayerExp(expGained);
      
      // レベルアップした場合の演出処理
      if (levelUpResult.leveledUp) {
        // レベルアップSE再生
        publish('playSE', 'levelUp');
        
        // レベルアップメッセージをセット
        this.levelUpMessage = `レベルが ${levelUpResult.newLevel} にあがった！`;
        
        // レベルアップ強化エフェクトを開始
        this.startLevelUpEffect(120); // 2秒間表示
        
        // レベルアップ時の実績チェック
        checkAchievements().catch(error => {
          console.error('実績チェック中にエラーが発生しました:', error);
        });
        
        // HPバーアニメーション設定
        battleState.playerHpTarget = gameState.playerStats.hp;
        battleState.playerHpAnimating = true;
      }
      
      // アニメーションが完了したらフラグをリセット
      this.isAnimatingExp = false;
    }

    // ── HPアニメーション更新 ──
    if (battleState.playerHpAnimating) {
      const disp = battleState.playerHpDisplay;
      const tgt  = battleState.playerHpTarget;
      const diff = tgt - disp;
      if (Math.abs(diff) <= PLAYER_HP_ANIM_SPEED) {
        battleState.playerHpDisplay   = tgt;
        battleState.playerHpAnimating = false;
      } else {
        battleState.playerHpDisplay += Math.sign(diff) * PLAYER_HP_ANIM_SPEED;
      }
    }

    // ── 経験値アニメーション更新 ──
    if (this.playerExpAnimating) {
      const disp = this.playerExpDisplay;
      const tgt = this.playerExpTarget;
      const diff = tgt - disp;
      
      // 差分が小さければアニメーション終了
      if (Math.abs(diff) <= this.expAnimSpeed) {
        this.playerExpDisplay = tgt;
        this.playerExpAnimating = false;
      } else {
        // 徐々に目標値に近づける
        this.playerExpDisplay += Math.sign(diff) * this.expAnimSpeed;
      }
    }

    // ── 新規：UIパネル描画 ──
    this.drawPlayerStatusPanel(this.ctx);
    this.drawEnemyStatusPanel(this.ctx);

    /* ボタン描画（リッチなデザイン） */
    Object.entries(BTN).forEach(([key, b]) => {
      if (key === 'back' || key === 'stage') return; // 既に上で描画済み

      // ボタンの色を決定
      let buttonColor = '#2980b9';
      if (key === 'attack') buttonColor = '#e74c3c';
      else if (key === 'heal') buttonColor = '#27ae60';
      else if (key === 'hint') buttonColor = '#f39c12';

      // ホバー判定
      const isHovered = isMouseOverRect(this.mouseX, this.mouseY, b);
      
      this.drawRichButton(this.ctx, b.x, b.y, b.w, b.h, b.label, buttonColor, isHovered);

      // アイコンマップ
      const iconMap = {
        attack: images.iconAttack,
        heal:   images.iconHeal,
        hint:   images.iconHint
      };
      const iconImg = iconMap[key];
      const padding = 8;
      
      // ホバー時のスケール調整を考慮したアイコンとテキストの位置計算
      const scale = isHovered ? 1.05 : 1.0;
      let adjustedX = b.x;
      let adjustedY = b.y;
      let adjustedW = b.w;
      let adjustedH = b.h;
      
      if (isHovered) {
        const centerX = b.x + b.w / 2;
        const centerY = b.y + b.h / 2;
        adjustedW = b.w * scale;
        adjustedH = b.h * scale;
        adjustedX = centerX - adjustedW / 2;
        adjustedY = centerY - adjustedH / 2;
      }
      
      const iconSize = adjustedH - padding * 2;

      // アイコン描画
      if (iconImg) {
        this.ctx.drawImage(iconImg, adjustedX + padding, adjustedY + padding, iconSize, iconSize);
      }

      // テキスト描画（縁取り付き）
      const textX = adjustedX + padding + (iconImg ? iconSize + padding : 0);
      const textY = adjustedY + adjustedH / 2;
      this.drawTextWithOutline(
        b.label,
        textX,
        textY,
        'white',
        'black',
        '16px "UDデジタル教科書体",sans-serif',
        'left',
        'middle',
        1
      );
    });

    /* 入力欄 */
    if (this.inputEl) {
      this.inputEl.style.display = 'block';
      this.inputEl.style.position = 'fixed';
      this.inputEl.style.left = '50%';
      this.inputEl.style.transform = 'translateX(-50%)';
      
      // レスポンシブ対応：画面サイズに応じて位置を調整
      const isSmallScreen = window.innerWidth <= 768;
      if (isSmallScreen) {
        // スマホの場合：ビューポートの下部に配置
        this.inputEl.style.bottom = '25vh';
        this.inputEl.style.top = 'auto';
        this.inputEl.style.width = '70vw';
        this.inputEl.style.maxWidth = '280px';
        this.inputEl.style.fontSize = '16px';
      } else {
        // PC の場合：従来の位置
        this.inputEl.style.top = '320px';
        this.inputEl.style.bottom = 'auto';
        this.inputEl.style.width = '280px';
        this.inputEl.style.fontSize = '20px';
      }
      
      this.inputEl.style.padding = '8px 12px';
      this.inputEl.style.textAlign = 'center';
      this.inputEl.style.zIndex = '1000';
      this.inputEl.style.backgroundColor = 'white';
      this.inputEl.style.border = '2px solid #ccc';
      this.inputEl.style.borderRadius = '5px';
      this.inputEl.style.boxSizing = 'border-box';
    }

    // ── メッセージ欄 ──（右下に配置、横幅を拡張）
    const msgX = this.canvas.width - 380; // 330から380に拡張
    const msgY = 450; // ボトムエリアの開始位置
    const msgW = 360; // 310から360に拡張
    const msgH = 130; // 高さを調整（プレイヤーパネルと同じ）

    // 半透明の黒背景から石版風デザインに変更
    this.drawPanelBackground(this.ctx, msgX, msgY, msgW, msgH, 'stone');

    // メッセージログタイトル追加（まとまり感向上）
    this.drawTextWithOutline(
      "バトルログ",
      msgX + msgW/2,
      msgY + 8,
      'white',
      'black',
      'bold 14px "UDデジタル教科書体", sans-serif',
      'center',
      'top',
      1
    );
    
    // メッセージログ表示（タイプライター効果対応）
    const N = 5; // 表示行数
    const len = battleState.log.length;
    const maxOffset = Math.max(0, len - N);
    this.logOffset = Math.min(Math.max(0, this.logOffset), maxOffset);
    const start = Math.max(0, len - N - this.logOffset);
    let lines = battleState.log.slice(start, start + N);
    
    this.ctx.font = '14px "UDデジタル教科書体", sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    
    // タイプライターエフェクトの更新処理
    if (this.typewriterEffect.active) {
      this.typewriterEffect.charTimer--;
      
      if (this.typewriterEffect.charTimer <= 0) {
        // 次の文字を表示
        this.typewriterEffect.displayedChars++;
        this.typewriterEffect.charTimer = this.typewriterEffect.charInterval;
        
        // タイプ音を一定間隔で再生
        if (this.typewriterEffect.displayedChars % this.typewriterEffect.soundInterval === 0) {
          // タイプ音の再生（軽いクリック音）- 'type'が未定義の場合は'decide'を使用
          try {
            publish('playSE', 'decide', 0.1); // 音量小さめ
          } catch (error) {
            // SE再生に失敗した場合は無視
            console.warn('タイプ音の再生に失敗しました:', error);
          }
        }
        
        // 全ての文字を表示し終えたらエフェクト終了
        if (this.typewriterEffect.displayedChars >= this.typewriterEffect.targetMessage.length) {
          this.typewriterEffect.active = false;
        }
      }
      
      // 対象メッセージを切り詰めたバージョンに置き換え
      if (this.typewriterEffect.messageIndex >= 0 && 
          this.typewriterEffect.messageIndex < lines.length) {
        const displayedText = this.typewriterEffect.targetMessage.substring(
          0, 
          this.typewriterEffect.displayedChars
        );
        lines[this.typewriterEffect.messageIndex] = displayedText;
      }
    }
    
    // メッセージログの描画
    lines.forEach((l, i) => {
      const color = this.getMessageColor(l);
      const baseX = msgX + 8;
      const baseY = msgY + 28 + i * 20; // タイトル分を下にずらす
      
      // アイコンサイズとマージン
      const iconSize = 16;
      const iconMargin = 4;
      let textOffsetX = 0; // テキストのオフセット
      
      // メッセージ内容に応じてアイコンを描画
      let iconImg = null;
      
      if (l.includes('ダメージ') || l.includes('こうげき')) {
        iconImg = images.iconAttack;
      } else if (l.includes('せいかい！') || l.includes('弱点にヒット') || l.includes('ボーナス')) {
        // チェックマークアイコンがない場合は、攻撃アイコンを緑色で描画
        iconImg = images.iconAttack;
        // または専用のチェックマークを描画
        this.ctx.save();
        this.ctx.fillStyle = '#2ecc71';
        this.ctx.font = `${iconSize}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('✓', baseX + iconSize/2, baseY + 10);
        this.ctx.restore();
        textOffsetX = iconSize + iconMargin;
      } else if (l.includes('かいふく')) {
        iconImg = images.iconHeal;
      } else if (l.includes('をたおした') || l.includes('あらわれた')) {
        // モンスター関連のメッセージには剣のアイコン
        iconImg = images.iconAttack;
      } else if (l.includes('経験値') || l.includes('レベル')) {
        // 経験値・レベル関連には星マーク
        this.ctx.save();
        this.ctx.fillStyle = '#f1c40f';
        this.ctx.font = `${iconSize}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('★', baseX + iconSize/2, baseY + 10);
        this.ctx.restore();
        textOffsetX = iconSize + iconMargin;
      } else if (l.includes('ヒント')) {
        iconImg = images.iconHint;
      }
      
      // アイコン画像を描画（チェックマークや星以外）
      if (iconImg && !l.includes('せいかい！') && !l.includes('弱点にヒット') && 
          !l.includes('ボーナス') && !l.includes('経験値') && !l.includes('レベル')) {
        this.ctx.save();
        
        // アイコンの色調整（メッセージの種類に応じて）
        if (l.includes('ダメージ') || l.includes('こうげき')) {
          // 攻撃系は少し赤みを帯びさせる
          this.ctx.filter = 'hue-rotate(0deg) saturate(1.2)';
        } else if (l.includes('かいふく')) {
          // 回復系は緑色を強調
          this.ctx.filter = 'hue-rotate(90deg) saturate(1.5)';
        } else if (l.includes('ヒント')) {
          // ヒント系は黄色を強調
          this.ctx.filter = 'hue-rotate(45deg) saturate(1.3)';
        }
        
        this.ctx.drawImage(iconImg, baseX, baseY + 2, iconSize, iconSize);
        this.ctx.restore();
        textOffsetX = iconSize + iconMargin;
      }
      
      // テキストを描画（アイコン分オフセット）
      this.drawTextWithOutline(
        l,
        baseX + textOffsetX,
        baseY,
        color,
        'black',
        '14px "UDデジタル教科書体", sans-serif',
        'left',
        'top',
        1 // 縁取りの太さを細く
      );
    });
    
    // メッセージログのスクロールヒント表示
    if (len > N) {
      this.drawTextWithOutline(
        "↑↓ スクロール可能 ↑↓",
        msgX + msgW/2,
        msgY + msgH - 18,
        'rgba(255, 255, 255, 0.7)',
        'black',
        '10px "UDデジタル教科書体", sans-serif',
        'center',
        'top',
        1
      );
    }

    // レベルアップメッセージの描画
    if (this.levelUpMessage) {
      // 半透明の黒いオーバーレイで背景を暗く
      if (this.levelUpEffect.active) {
        this.ctx.save();
        this.ctx.fillStyle = `rgba(0, 0, 0, ${this.levelUpEffect.overlayOpacity})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // エフェクトタイマーを更新
        this.levelUpEffect.timer--;
        if (this.levelUpEffect.timer <= 0) {
          this.levelUpEffect.active = false;
          this.levelUpMessage = '';
        }
        
        // メッセージのサイズを脈動させる効果
        const pulsateFactor = 1 + 0.2 * Math.sin(Date.now() * this.levelUpEffect.pulsateSpeed);
        
        // ゴールド色のグラデーションで光る効果を作成
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const gradient = this.ctx.createLinearGradient(
          centerX - 200, centerY, 
          centerX + 200, centerY
        );
        gradient.addColorStop(0, '#f39c12'); // 琥珀色
        gradient.addColorStop(0.5, '#f1c40f'); // 黄色
        gradient.addColorStop(1, '#f39c12'); // 琥珀色
        
        // 黒い縁取り（外側）
        this.ctx.font = `bold ${38 * pulsateFactor}px "UDデジタル教科書体", sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.lineWidth = 6;
        this.ctx.strokeStyle = 'black';
        this.ctx.strokeText(this.levelUpMessage, centerX, centerY);
        
        // テキスト本体（内側）
        this.ctx.fillStyle = gradient;
        this.ctx.fillText(this.levelUpMessage, centerX, centerY);
        
        // 輝く光線エフェクト
        this.ctx.save();
        this.ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() * 0.003);
        this.ctx.translate(centerX, centerY);
        
        // 放射状の光線
        for (let i = 0; i < 12; i++) {
          this.ctx.rotate(Math.PI / 6);
          this.ctx.beginPath();
          this.ctx.moveTo(0, -20);
          this.ctx.lineTo(0, -150 * pulsateFactor);
          this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
          this.ctx.lineWidth = 10;
          this.ctx.stroke();
        }
        
        this.ctx.restore();
        
        // レベルアップ演出の追加情報
        const subMessage = `攻撃力アップ！ HP最大値アップ！`;
        this.ctx.font = '20px "UDデジタル教科書体", sans-serif';
        this.ctx.fillStyle = 'white';
        this.ctx.fillText(subMessage, centerX, centerY + 60);
        
        this.ctx.restore();
      } else {
        // 従来のシンプルなメッセージ表示（フォールバック用）
      this.ctx.save();
      this.ctx.fillStyle = 'yellow';
      this.ctx.font = '32px "UDデジタル教科書体", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.strokeStyle = 'black';
      this.ctx.lineWidth = 2;
      
      // 画面中央に目立つように表示
      const messageX = this.canvas.width / 2;
      const messageY = this.canvas.height / 2;
      
      // 文字の縁取り効果
      this.ctx.strokeText(this.levelUpMessage, messageX, messageY);
      this.ctx.fillText(this.levelUpMessage, messageX, messageY);
      
      this.ctx.restore();
      }
    }

    // チャレンジモードの時のみ、残り時間を描画（縁取り付き）
    if (gameState.gameMode === 'challenge') {
      this.drawTextWithOutline(
        `残り時間: ${battleState.timeRemaining}`,
        this.canvas.width / 2,
        30,
        'yellow',
        'black',
        '24px "UDデジタル教科書体", sans-serif',
        'center'
      );
    }

    // ── 画面フラッシュ効果の更新と描画 ──
    if (this.flashEffect.active) {
      // フラッシュタイマーを減らす
      this.flashEffect.timer--;
      
      // フラッシュ効果を描画
      const alpha = this.flashEffect.timer / this.flashEffect.duration;
      this.ctx.save();
      this.ctx.globalAlpha = alpha * 0.5; // 最大透明度を0.5に制限
      this.ctx.fillStyle = this.flashEffect.color;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
      
      // タイマーが0になったらフラッシュ終了
      if (this.flashEffect.timer <= 0) {
        this.flashEffect.active = false;
      }
    }

    // 読みハイライト効果のタイマー更新
    if (this.readingHighlight.active) {
      this.readingHighlight.timer--;
      if (this.readingHighlight.timer <= 0) {
        this.readingHighlight.active = false;
        this.readingHighlight.type = null;
      }
    }

    // ステージクリア画面遷移の実行チェック
    if (this.stageClearPending && 
        !this.isAnimatingExp && 
        this.expAnimQueue.length === 0) {
      // 全ての経験値アニメーションが完了した場合、ステージクリア画面へ遷移
      this.stageClearPending = false;
      this.victoryCallback && this.victoryCallback();
    }

    // コンボアニメーションの更新
    if (this.comboAnimation.active) {
      this.comboAnimation.timer--;
      
      // スケールを計算（最初は大きく、徐々に小さくなる）
      const progress = this.comboAnimation.timer / this.comboAnimation.duration;
      this.comboAnimation.scale = 1.0 + (1 - progress) * 0.5; // 最大1.5倍まで拡大
      
      if (this.comboAnimation.timer <= 0) {
        this.comboAnimation.active = false;
        this.comboAnimation.scale = 1.0;
      }
    }

    // ここに漢字ボックスエフェクトの更新処理を追加
    if (this.kanjiBoxEffect.active) {
      this.kanjiBoxEffect.timer--;
      if (this.kanjiBoxEffect.timer <= 0) {
        this.kanjiBoxEffect.active = false;
      }
    }

    if (this.shakeEffect.active) {
      this.shakeEffect.timer--;
      if (this.shakeEffect.timer <= 0) {
        this.shakeEffect.active = false;
      }
    }

    // ── 経験値パーティクルの更新と描画 ──
    if (this.expParticles.active) {
      this.updateAndDrawExpParticles();
    }

    // コンボタイマーの更新処理を強化
    if (battleState.comboCount > 0 && battleState.comboTimer > 0) {
      battleState.comboTimer--;
      
      // タイマーが0になったらコンボをリセット
      if (battleState.comboTimer <= 0) {
        console.log('⏰ コンボタイマー終了：コンボがリセットされました');
        battleState.comboCount = 0;
        battleState.comboTimer = 0;
      }
    }
    
    // コンボカウントが0以下の場合は強制的に0にする
    if (battleState.comboCount < 0) {
      battleState.comboCount = 0;
    }

    // 例：異なる用途の場合は変数名を変更
    const displayKanjiX = this.canvas.width / 2 - 90;
    const displayKanjiY = 200;

    // または、ブロックスコープを使用
    {
      const kanjiX = this.canvas.width / 2 - 90;
      const kanjiY = 200;
      // この処理...
    }

    // 別の処理
    {
      const kanjiX = this.canvas.width / 2; // 異なる値でも問題なし
      const kanjiY = 180;
      // この処理...
    }

    // シェイクエフェクトの処理
    let shakeOffsetX = 0;
    let shakeOffsetY = 0;

    if (this.shakeEffect && this.shakeEffect.active) {
      this.shakeEffect.timer--;
      const intensity = this.shakeEffect.intensity * (this.shakeEffect.timer / this.shakeEffect.duration);
      shakeOffsetX = (Math.random() * 2 - 1) * intensity;
      shakeOffsetY = (Math.random() * 2 - 1) * intensity;
      
      if (this.shakeEffect.timer <= 0) {
        this.shakeEffect.active = false;
      }
    }

    // 漢字ボックスエフェクトの処理
    let boxScale = 1.0;
    let boxColor = 'rgba(0, 0, 0, 0.7)';
    let borderColor = 'rgba(255, 255, 255, 0.5)';
    let borderWidth = 2;

    if (this.kanjiBoxEffect && this.kanjiBoxEffect.active) {
      this.kanjiBoxEffect.timer--;
      this.kanjiBoxEffect.pulsePhase += 0.2;
      
      const progress = 1 - (this.kanjiBoxEffect.timer / this.kanjiBoxEffect.duration);
      const pulseValue = Math.sin(this.kanjiBoxEffect.pulsePhase) * 0.5 + 0.5;
      boxScale = 1 + (this.kanjiBoxEffect.maxScale - 1) * pulseValue * (1 - progress);
      
      borderColor = this.kanjiBoxEffect.color;
      borderWidth = 4;
      
      if (this.kanjiBoxEffect.timer <= 0) {
        this.kanjiBoxEffect.active = false;
      }
    }

    // スケールに基づいたサイズと位置の計算
    const scaledW = kanjiBoxW * boxScale;
    const scaledH = kanjiBoxH * boxScale;
    const adjustedX = kanjiX - (scaledW / 2) + shakeOffsetX; // 中央基準に修正
    const adjustedY = kanjiY - (scaledH / 2) + shakeOffsetY; // 中央基準に修正

    // ↓↓↓ここから変更↓↓↓

// 漢字ボックスの背景を石版パネルに変更
// 古い fillRect と strokeRect を drawStonePanel に置き換える
drawStonePanel(this.ctx, adjustedX, adjustedY, scaledW, scaledH);

// 漢字の表示 (フォントサイズもスケールに連動)
if (gameState.currentKanji) {
  this.ctx.font = `${80 * boxScale}px serif`; // フォントサイズを調整
  this.ctx.fillStyle = 'white';
  this.ctx.textAlign = 'center';
  this.ctx.textBaseline = 'middle';

  // 影をつけて立体感を出す
  this.ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  this.ctx.shadowBlur = 5;
  this.ctx.shadowOffsetX = 3 * boxScale;
  this.ctx.shadowOffsetY = 3 * boxScale;

  this.ctx.fillText(
    gameState.currentKanji.text,
    adjustedX + scaledW / 2,
    adjustedY + scaledH / 2
  );

  // 影をリセット
  this.ctx.shadowColor = 'transparent';
  this.ctx.shadowBlur = 0;
  this.ctx.shadowOffsetX = 0;
  this.ctx.shadowOffsetY = 0;
}
  },

  /**
   * リッチなボタンを描画するメソッド
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D コンテキスト
   * @param {number} x - X座標
   * @param {number} y - Y座標
   * @param {number} width - 幅
   * @param {number} height - 高さ
   * @param {string} label - ボタンのラベル
   * @param {string} baseColor - ベース色
   * @param {boolean} isHovered - ホバー状態かどうか
   */
  drawRichButton(ctx, x, y, width, height, label, baseColor = '#2980b9', isHovered = false, isPressed = false) {
    // 押下状態の表現を追加
    const pressOffset = isPressed ? 2 : 0;
    const shadowOffset = isHovered ? 4 : (isPressed ? 1 : 3);
    
    // 押下時は少し沈み込む表現
    const adjustedY = y + pressOffset;
    const adjustedShadowY = y + shadowOffset - pressOffset;
    
    // 影の描画
    ctx.fillStyle = `rgba(0, 0, 0, ${isPressed ? 0.2 : 0.3})`;
    ctx.fillRect(x + shadowOffset, adjustedShadowY + shadowOffset, width, height);
    
    // ボタン本体（押下時は少し暗く）
    const buttonColor = isPressed ? this.darkenColor(baseColor, 10) : baseColor;
    
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
    
    // グラデーション背景を作成
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, this.lightenColor(hoverColor, 20)); // 上部を明るく
    gradient.addColorStop(1, this.darkenColor(hoverColor, 20));  // 下部を暗く
    
    // ボタン本体を描画
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
    
    // 枠線を描画
    ctx.strokeStyle = this.darkenColor(hoverColor, 30);
    ctx.lineWidth = isHovered ? 3 : 2; // ホバー時は枠線を太く
    ctx.strokeRect(x, y, width, height);
    
    // 上部のハイライト（立体感を演出）
    const highlightGradient = ctx.createLinearGradient(x, y, x, y + height * 0.3);
    const highlightOpacity = isHovered ? 0.4 : 0.3; // ホバー時はハイライトを強く
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
    
    ctx.restore();
  },

  /**
   * 色を明るくするヘルパーメソッド
   * @param {string} color - 16進数カラーコード
   * @param {number} percent - 明るくする割合（0-100）
   * @returns {string} 明るくした色
   */
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

  /**
   * 色を暗くするヘルパーメソッド
   * @param {string} color - 16進数カラーコード
   * @param {number} percent - 暗くする割合（0-100）
   * @returns {string} 暗くした色
   */
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

  /**
   * パネル背景を描画するメソッド
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D コンテキスト
   * @param {number} x - X座標
   * @param {number} y - Y座標
   * @param {number} width - 幅
   * @param {number} height - 高さ
   * @param {string} style - 背景スタイル ('default', 'stone', 'paper')
   */
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

  /**
   * 画面フラッシュ効果を開始するメソッド
   * @param {string} color - フラッシュの色（デフォルト: 赤）
   * @param {number} duration - フラッシュの持続フレーム数（デフォルト: 15）
   */
  startFlashEffect(color = 'rgba(255, 0, 0, 0.5)', duration = 15) {
    this.flashEffect.active = true;
    this.flashEffect.timer = duration;
    this.flashEffect.duration = duration;
    this.flashEffect.color = color;
  },

  /**
   * テキストに縁取りを付けて描画するヘルパーメソッド
   * @param {string} text - 描画するテキスト
   * @param {number} x - X座標
   * @param {number} y - Y座標
   * @param {string} fillColor - 塗りつぶし色
   * @param {string} strokeColor - 縁取り色
   * @param {string} font - フォント設定
   * @param {string} textAlign - テキスト配置（left, center, right）
   * @param {string} textBaseline - ベースライン（top, middle, bottom）
   * @param {number} lineWidth - 縁取りの太さ（デフォルト: 2）
   */
  drawTextWithOutline(text, x, y, fillColor, strokeColor, font, textAlign = 'left', textBaseline = 'top', lineWidth = 2) {
    this.ctx.save();
    this.ctx.font = font;
    this.ctx.textAlign = textAlign;
    this.ctx.textBaseline = textBaseline;
    
    // 縁取り描画
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = lineWidth;
    this.ctx.strokeText(text, x, y);
    
    // 塗りつぶし描画
    this.ctx.fillStyle = fillColor;
    this.ctx.fillText(text, x, y);
    
    this.ctx.restore();
  },

  /**
   * メッセージの内容に応じて色を決定する
   * @param {string} message - メッセージ内容
   * @returns {string} 色コード
   */
  getMessageColor(message) {
    // 肯定的なメッセージ（正解・成功系）
    if (message.includes('せいかい！') || 
        message.includes('弱点にヒット！') || 
        message.includes('大ダメージ！') || 
        message.includes('れんぞくせいかいボーナス！') || 
        message.includes('かいふくせいこう！') || 
        message.includes('シールドにヒビが入った！') || 
        message.includes('ボスの防御が崩れた！') || 
        message.includes('をたおした！') || 
        message.includes('の経験値を獲得した！')) {
      return '#2ecc71'; // 明るい緑色
    }
    
    // 特別な成功メッセージ（より目立つ色）
    if (message.includes('弱点にヒット！') || 
        message.includes('れんぞくせいかいボーナス！')) {
      return '#f1c40f'; // 黄色
    }
    
    // 否定的なメッセージ（失敗・ダメージ系）
    if (message.includes('こうげきしっぱい！') || 
        message.includes('かいふくしっぱい！') || 
        message.includes('のこうげき！') || 
        message.includes('のダメージ！')) {
      return '#ff6b9d'; // ピンク色
    }
    
    // 危険なメッセージ（HP低下など）
    if (message.includes('のダメージ！')) {
      return '#e74c3c'; // 赤色
    }
    
    // その他の通知メッセージ
    return 'white'; // 白色（デフォルト）
  },

 // battleScreen.js内の既存のdrawPlayerStatusPanel関数を、以下のコードで完全に置き換えてください。

 drawPlayerStatusPanel(ctx) {
  const panelW = 260;
  const panelH = 130;
  const panelX = 20;
  const panelY = 600 - panelH - 20;

  if (images.panelPlayer) {
    ctx.drawImage(images.panelPlayer, panelX, panelY, panelW, panelH);
  }

  // --- ▼ここからレイアウトと配色を調整▼ ---
  const horizontalPadding = 55;
  const contentX = panelX + horizontalPadding;
  const contentY = panelY + 22;
  const contentW = panelW - (horizontalPadding * 2);

  // プレイヤー名（インクのような濃い茶色に変更）
  this.drawTextWithOutline(
    gameState.playerName,
    contentX, contentY,
    '#5C4033', '#F5DEB3', 'bold 16px "UDデジタル教科書体", sans-serif',
    'left', 'top', 2
  );

  // レベル表示（金色に黒い縁取りで視認性アップ）
  this.drawTextWithOutline(
    `Lv.${gameState.playerStats.level}`,
    contentX + contentW, contentY,
    '#DAA520', '#654321', 'bold 16px "UDデジタル教科書体", sans-serif',
    'right', 'top', 2
  );

  // HP バー
  const barY = contentY + 25;
  const barH = 18;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fillRect(contentX, barY, contentW, barH);

  const hpRatio = gameState.playerStats.hp / gameState.playerStats.maxHp;
  ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : (hpRatio > 0.2 ? '#f39c12' : '#e74c3c');
  ctx.fillRect(contentX, barY, contentW * hpRatio, barH);
  // HPテキスト（黒い縁取りで視認性アップ）
  this.drawTextWithOutline(
    `${gameState.playerStats.hp} / ${gameState.playerStats.maxHp}`,
    contentX + contentW / 2, barY + barH / 2,
    'white', 'black', '12px "UDデジタル教科書体", sans-serif', 'center', 'middle', 2
  );

  // 攻撃力表示（濃い茶色に変更）
  this.drawTextWithOutline(
    `ATK: ${gameState.playerStats.attack}`,
    contentX, barY + barH + 18,
    '#5C4033', '#F5DEB3', '14px "UDデジタル教科書体", sans-serif',
    'left', 'top', 2
  );
  // --- ▲ここまで▲ ---
},

// battleScreen.js内の既存のdrawEnemyStatusPanel関数を、以下のコードで完全に置き換えてください。

drawEnemyStatusPanel(ctx) {
  const panelW = 280;
  const panelH = 120;
  const panelX = 800 - panelW - 20;
  const panelY = 10;

  if (images.panelEnemy) {
    ctx.drawImage(images.panelEnemy, panelX, panelY, panelW, panelH);
  }

  if (!gameState.currentEnemy) return;

  // --- ▼ここからY軸の配置を調整▼ ---
  const horizontalPadding = 35;
  const contentX = panelX + horizontalPadding;
  const contentW = panelW - (horizontalPadding * 2);

  // 上段グループのY座標を少し下げて、中央に寄せる
  const topRowY = panelY + 30;

  // HPバーのY座標を上げて、中央に寄せる
  const barY = panelY + 65;
  const barH = 22;
  // --- ▲ここまでY軸の配置を調整▲ ---

  // 1. レベルを右上に配置
  const levelText = `Lv.${gameState.currentEnemy.level || 1}`;
  this.drawTextWithOutline(
    levelText,
    contentX + contentW, topRowY,
    '#FFD700', '#000000', 'bold 18px "UDデジタル教科書体", sans-serif',
    'right', 'top', 3
  );

  // 2. レベルの左隣に弱点アイコンを配置
  if (gameState.currentEnemy.weakness) {
    const levelMetrics = ctx.measureText(levelText);
    const iconSize = 20;
    const iconPadding = 8;
    const iconX = contentX + contentW - levelMetrics.width - iconPadding - iconSize;
    const iconY = topRowY;
    const iconImg = gameState.currentEnemy.weakness === 'onyomi' ? images.iconOnyomi : images.iconKunyomi;

    if (iconImg) {
      ctx.drawImage(iconImg, iconX, iconY, iconSize, iconSize);
    }
  }

  // 3. 敵の名前を左上に配置
  this.drawTextWithOutline(
    gameState.currentEnemy.name,
    contentX, topRowY,
    '#FF6347', '#000000', 'bold 18px "UDデジタル教科書体", sans-serif',
    'left', 'top', 3
  );

  // 4. HPバーを下段に配置
  // HPバー背景
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(contentX, barY, contentW, barH);
  // HPバー本体
  const hpRatio = gameState.currentEnemy.hp / gameState.currentEnemy.maxHp;
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(contentX, barY, contentW * hpRatio, barH);
  // HPテキスト
  this.drawTextWithOutline(
    `${gameState.currentEnemy.hp}/${gameState.currentEnemy.maxHp}`,
    contentX + contentW / 2, barY + barH / 2,
    'white', 'black', '14px "UDデジタル教科書体", sans-serif', 'center', 'middle', 2
  );
},

  /** 画面離脱時のクリーンアップ */
  exit() {
    // 入力欄を非表示＆キーイベント解除
    if (this.inputEl) {
      this.inputEl.style.display = 'none';
      this.inputEl.removeEventListener('keydown', this._keydownHandler);
    }
    // クリックイベントリスナ解除
    if (this._clickHandler) {
      this.unregisterHandlers();
    }
    // タイマーの停止
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    // canvas/ctx/inputEl をクリア
    this.canvas = this.ctx = this.inputEl = null;
  },

  /** クリックなどのイベントを登録 */
  registerHandlers() {
    this._clickHandler = e => {
      // handleClickメソッドを直接呼び出す（座標変換はhandleClick内で行う）
      this.handleClick(e);
    };
    this.canvas.addEventListener('click', this._clickHandler);
    this.canvas.addEventListener('touchstart', this._clickHandler);
    
    // マウス移動ハンドラーを追加
    this._mousemoveHandler = e => {
      const rect = this.canvas.getBoundingClientRect();
      
      // Canvasの実際の表示サイズと内部解像度の比率を計算
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      
      // マウス座標を800x600のゲーム内座標に変換
      this.mouseX = (e.clientX - rect.left) * scaleX;
      this.mouseY = (e.clientY - rect.top) * scaleY;
    };
    this.canvas.addEventListener('mousemove', this._mousemoveHandler);
    
    // メッセージログスクロール用ホイールイベント登録
    this._wheelHandler = e => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      // メッセージログの位置を更新
      const msgX = this.canvas.width - 330;
      const msgY = 450;
      const msgW = 310;
      const msgH = 130;
      
      if (x >= msgX && x <= msgX + msgW && y >= msgY && y <= msgY + msgH) {
        e.preventDefault();
        const N = 5;
        const len = battleState.log.length;
        const maxOffset = Math.max(0, len - N);
        if (e.deltaY < 0) {
          this.logOffset = Math.min(this.logOffset + 1, maxOffset);
        } else {
          this.logOffset = Math.max(0, this.logOffset - 1);
        }
      }
    };
    this.canvas.addEventListener('wheel', this._wheelHandler);
  },

  /** イベント登録を解除 */
  unregisterHandlers() {
    this.canvas.removeEventListener('click', this._clickHandler);
    this.canvas.removeEventListener('touchstart', this._clickHandler);
    this.canvas.removeEventListener('mousemove', this._mousemoveHandler);
    this.canvas.removeEventListener('wheel', this._wheelHandler);
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
    // ③ 「タイトルへ」ボタン押下時
    if (isMouseOverRect(x, y, BTN.back)) {
      publish('changeScreen', 'title');
      return true;
    }
    // ④ 「ステージ選択」ボタン押下時
    if (isMouseOverRect(x, y, BTN.stage)) {
      publish('changeScreen', 'stageSelect');
      return true;
    }
    // ⑤ 既存のこうげき／かいふく／ヒント処理
    if (isMouseOverRect(x, y, BTN.attack)) {
      e.preventDefault();
      e.stopPropagation();
      onAttack();
      battleState.lastCommandMode = 'attack';
      return true;
    }
    if (isMouseOverRect(x, y, BTN.heal)) {
      e.preventDefault();
      e.stopPropagation();
      onHeal();
      battleState.lastCommandMode = 'heal';
      return true;
    }
    if (isMouseOverRect(x, y, BTN.hint)) {
      e.preventDefault();
      e.stopPropagation();
      onHint();
      battleState.lastCommandMode = 'hint';
      return true;
    }
    return false; // イベント未処理を示す
  },

  // ※ 必要に応じて spawnEnemy, onAttack, onHeal, onHint, enemyTurn なども
  //   このオブジェクト内にメソッドとして整理してください。

  /**
   * 読み方ハイライト効果を開始するメソッド
   * @param {string} type - ハイライトする読み方のタイプ ('onyomi' または 'kunyomi')
   * @param {number} duration - ハイライトの持続フレーム数（デフォルト: 60 = 約1秒）
   */
  startReadingHighlight(type, duration = 60) {
    this.readingHighlight.active = true;
    this.readingHighlight.timer = duration;
    this.readingHighlight.duration = duration;
    this.readingHighlight.type = type;
  },

  /**
   * コンボインジケーターを描画する関数
   * @param {CanvasRenderingContext2D} ctx - 描画コンテキスト
   */
  drawComboIndicator(ctx) {
    const comboCount = this.comboAnimation.active 
      ? this.comboAnimation.comboCount 
      : battleState.comboCount;
    
    // デバッグログ
    console.log('🔢 コンボ表示:', {
      comboCount: comboCount,
      battleStateCombo: battleState.comboCount,
      animationActive: this.comboAnimation.active
    });
    
    if (comboCount < 2) return; // 2コンボ未満は表示しない
    
    const kanjiX = this.canvas.width / 2;
    const kanjiY = 200;
    const kanjiBoxW = 180;
    
    // コンボ表示の位置（漢字の右横）
    const comboX = kanjiX + kanjiBoxW / 2 + 40;
    const comboY = kanjiY;
    
    ctx.save();
    
    // アニメーション中はスケーリング
    if (this.comboAnimation.active) {
      ctx.translate(comboX, comboY);
      ctx.scale(this.comboAnimation.scale, this.comboAnimation.scale);
      ctx.translate(-comboX, -comboY);
    }
    
    // コンボ数に応じた色を設定
    let comboColor = '#3498db'; // 青（デフォルト）
    if (comboCount >= 10) comboColor = '#e74c3c'; // 赤（10コンボ以上）
    else if (comboCount >= 5) comboColor = '#f39c12'; // オレンジ（5コンボ以上）
    else if (comboCount >= 3) comboColor = '#2ecc71'; // 緑（3コンボ以上）
    
    // 背景円を描画
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.arc(comboX, comboY, 35, 0, Math.PI * 2);
    ctx.fill();
    
    // 縁取り円を描画
    ctx.strokeStyle = comboColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(comboX, comboY, 35, 0, Math.PI * 2);
    ctx.stroke();
    
    // コンボ数テキスト
    this.drawTextWithOutline(
      `${comboCount}`,
      comboX,
      comboY - 5,
      comboColor,
      'black',
      'bold 28px "UDデジタル教科書体", sans-serif',
      'center',
      'middle'
    );
    
    // コンボテキスト
    this.drawTextWithOutline(
      'コンボ',
      comboX,
      comboY + 20,
      'white',
      'black',
      'bold 14px "UDデジタル教科書体", sans-serif',
      'center',
      'middle'
    );
    
    ctx.restore();
  },
  
  /**
   * コンボ表示のアニメーションを開始
   * @param {number} comboCount - 表示するコンボ数
   */
  startComboAnimation(comboCount) {
    this.comboAnimation.active = true;
    this.comboAnimation.timer = this.comboAnimation.duration;
    this.comboAnimation.scale = 1.5; // 最初は大きく
    this.comboAnimation.comboCount = comboCount;
  },

  // 経験値パーティクル用のメソッドを修正
  startExpParticleEffect(sourceX, sourceY, targetX, targetY, expAmount) {
    // パーティクルの初期化
    this.expParticles = {
      active: true,
      particles: [],
      maxParticles: 15,
      sourceX: sourceX,
      sourceY: sourceY,
      targetX: targetX,
      targetY: targetY,
      expAmount: expAmount
    };

    // パーティクルを生成
    for (let i = 0; i < this.expParticles.maxParticles; i++) {
      const angle = (Math.PI * 2 * i) / this.expParticles.maxParticles + Math.random() * 0.5;
      const speed = 2 + Math.random() * 3;
      const delay = i * 3; // パーティクルごとに少しずつ遅延
      
      this.expParticles.particles.push({
        x: sourceX,
        y: sourceY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 60 + Math.random() * 30, // 1-1.5秒の寿命
        size: 3 + Math.random() * 4,
        delay: delay,
        phase: 'spread', // 'spread' -> 'converge' -> 'arrived'
        alpha: 1.0,
        color: `hsl(${45 + Math.random() * 30}, 100%, ${60 + Math.random() * 20}%)` // 黄色系のランダムな色
      });
    }
  },

  

  /** レベルアップ演出を開始するメソッド */
  startLevelUpEffect(duration = 120) {
    this.levelUpEffect.active = true;
    this.levelUpEffect.timer = duration;
    this.levelUpEffect.duration = duration;
    
    // 画面シェイク効果を追加（小さな揺れで臨場感を出す）
    if (this.canvas) {
      const intensity = 5; // 揺れの強さ
      const shakeDuration = 500; // ミリ秒
      
      // キャンバス要素に一時的にシェイクエフェクトを適用
      const originalTransform = this.canvas.style.transform || '';
      
      const shake = () => {
        const dx = (Math.random() - 0.5) * intensity;
        const dy = (Math.random() - 0.5) * intensity;
        this.canvas.style.transform = `${originalTransform} translate(${dx}px, ${dy}px)`;
      };
      
      // シェイクエフェクトのアニメーション
      let elapsed = 0;
      const interval = 50; // 50ミリ秒ごとに位置を更新
      
      const shakeInterval = setInterval(() => {
        shake();
        elapsed += interval;
        
        if (elapsed >= shakeDuration) {
          clearInterval(shakeInterval);
          this.canvas.style.transform = originalTransform; // 元の位置に戻す
        }
      }, interval);
    }
  },

  /** 
   * タイプライターエフェクトを開始するメソッド
   * @param {string} message - アニメーションするメッセージ
   */
  startTypewriterEffect(message) {
    // 最新のメッセージに対してエフェクトを開始
    const logLength = battleState.log.length;
    if (logLength === 0) return;
    
    // 表示可能な最大行数
    const N = 5;
    const start = Math.max(0, logLength - N - this.logOffset);
    const relativeIndex = logLength - 1 - start;
    
    // 表示範囲内のメッセージのみアニメーション
    if (relativeIndex >= 0 && relativeIndex < N) {
      this.typewriterEffect.active = true;
      this.typewriterEffect.targetMessage = message;
      this.typewriterEffect.displayedChars = 0;
      this.typewriterEffect.messageIndex = relativeIndex;
      this.typewriterEffect.charTimer = this.typewriterEffect.charInterval;
    }
  },

  /**
   * シンプルなアイコン記号を描画するヘルパーメソッド
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D コンテキスト
   * @param {string} symbol - 描画する記号
   * @param {number} x - X座標
   * @param {number} y - Y座標
   * @param {number} size - アイコンサイズ
   * @param {string} color - アイコンの色
   */
  drawSimpleIcon(ctx, symbol, x, y, size, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 背景円を描画（オプション）
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(x + size/2, y + size/2, size/2 + 2, 0, Math.PI * 2);
    ctx.fill();
    
    // 記号を描画
    ctx.fillStyle = color;
    ctx.fillText(symbol, x + size/2, y + size/2);
    ctx.restore();
  },

  /** 
   * タイプライターエフェクトを開始するメソッド
   * @param {string} message - アニメーションするメッセージ
   */
  startTypewriterEffect(message) {
    // 最新のメッセージに対してエフェクトを開始
    const logLength = battleState.log.length;
    if (logLength === 0) return;
    
    // 表示可能な最大行数
    const N = 5;
    const start = Math.max(0, logLength - N - this.logOffset);
    const relativeIndex = logLength - 1 - start;
    
    // 表示範囲内のメッセージのみアニメーション
    if (relativeIndex >= 0 && relativeIndex < N) {
      this.typewriterEffect.active = true;
      this.typewriterEffect.targetMessage = message;
      this.typewriterEffect.displayedChars = 0;
      this.typewriterEffect.messageIndex = relativeIndex;
      this.typewriterEffect.charTimer = this.typewriterEffect.charInterval;
    }
  },

  // 弱点表示（アイコン化）
  drawOnyomiIcon(ctx, x, y, size) {
    this.drawSimpleIcon(ctx, '🔴', x, y, size, 'red');
  },

  // 弱点表示（アイコン化）
  drawKunyomiIcon(ctx, x, y, size) {
    this.drawSimpleIcon(ctx, '🌿', x, y, size, 'blue');
  },

  /**
   * 音読み用アイコン（音波）を描画
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D コンテキスト
   * @param {number} x - X座標
   * @param {number} y - Y座標
   * @param {number} size - アイコンサイズ
   */
  drawOnyomiIcon(ctx, x, y, size) {
    ctx.save();
    
    // 背景円（半透明の赤）
    ctx.fillStyle = 'rgba(231, 76, 60, 0.2)';
    ctx.beginPath();
    ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
    ctx.fill();
    
    // 音波を描画（3つの同心円弧）
    const centerX = x + size/2;
    const centerY = y + size/2;
    
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    
    // 内側の音波
    ctx.beginPath();
    ctx.arc(centerX, centerY, size * 0.15, -Math.PI/3, Math.PI/3);
    ctx.stroke();
    
    // 中間の音波
    ctx.beginPath();
    ctx.arc(centerX, centerY, size * 0.25, -Math.PI/4, Math.PI/4);
    ctx.stroke();
    
    // 外側の音波
    ctx.beginPath();
    ctx.arc(centerX, centerY, size * 0.35, -Math.PI/6, Math.PI/6);
    ctx.stroke();
    
    // 中央の発音源（小さな円）
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(centerX, centerY, size * 0.08, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  },

  /**
   * 訓読み用アイコン（葉っぱ）を描画
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D コンテキスト
   * @param {number} x - X座標
   * @param {number} y - Y座標
   * @param {number} size - アイコンサイズ
   */
  drawKunyomiIcon(ctx, x, y, size) {
    ctx.save();
    
    // 背景円（半透明の青緑）
    ctx.fillStyle = 'rgba(46, 204, 113, 0.2)';
    ctx.beginPath();
    ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
    ctx.fill();
    
    const centerX = x + size/2;
    const centerY = y + size/2;
    
    // 葉っぱの形を描画
    ctx.fillStyle = '#27ae60';
    ctx.beginPath();
    
    // 葉っぱの輪郭（ベジェ曲線で自然な形を作成）
    ctx.moveTo(centerX, centerY - size * 0.3); // 上端
    ctx.quadraticCurveTo(
      centerX + size * 0.25, centerY - size * 0.1, // 制御点
      centerX + size * 0.15, centerY + size * 0.2   // 右下
    );
    ctx.quadraticCurveTo(
      centerX, centerY + size * 0.3,               // 制御点（下端）
      centerX - size * 0.15, centerY + size * 0.2  // 左下
    );
    ctx.quadraticCurveTo(
      centerX - size * 0.25, centerY - size * 0.1, // 制御点
      centerX, centerY - size * 0.3                // 上端に戻る
    );
    ctx.fill();
    
    // 葉脈を描画
    ctx.strokeStyle = '#1e8449';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    
    // 中央の葉脈
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - size * 0.25);
    ctx.lineTo(centerX, centerY + size * 0.25);
    ctx.stroke();
    
    // 左右の葉脈
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - size * 0.1);
    ctx.lineTo(centerX - size * 0.12, centerY + size * 0.1);
    ctx.moveTo(centerX, centerY - size * 0.1);
    ctx.lineTo(centerX + size * 0.12, centerY + size * 0.1);
    ctx.stroke();
    
    ctx.restore();
  },

  /**
   * 経験値パーティクルの更新と描画
   */
  updateAndDrawExpParticles() {
    // コンテキストがnullの場合は処理をスキップ
    if (!this.ctx) {
      console.warn('描画コンテキストがnullです。パーティクル更新をスキップします。');
      this.expParticles.active = false;
      return;
    }
    
    const particles = this.expParticles.particles;
    let activeParticles = 0;

    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      
      // 遅延中はスキップ
      if (particle.delay > 0) {
        particle.delay--;
        activeParticles++;
        continue;
      }

      particle.life++;

      // フェーズ管理
      if (particle.phase === 'spread') {
        // 最初は放射状に広がる
        particle.x += particle.vx;
        particle.y += particle.vy;
        
        // 一定時間後に収束フェーズに移行
        if (particle.life > 20) {
          particle.phase = 'converge';
        }
      } else if (particle.phase === 'converge') {
        // 経験値バーに向かって収束
        const dx = this.expParticles.targetX - particle.x;
        const dy = this.expParticles.targetY - particle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 5) {
          // 到達した
          particle.phase = 'arrived';
          
          // 経験値アニメーションキューに追加
          if (!this.expAnimQueue) this.expAnimQueue = [];
          this.expAnimQueue.push(Math.floor(this.expParticles.expAmount / this.expParticles.maxParticles));
          
          // パーティクル到達時のエフェクト
          this.createExpImpactEffect(particle.x, particle.y);
          
          // パーティクルを削除
          particles.splice(i, 1);
          continue;
        } else {
          // 経験値バーに向かって移動（加速）
          const speed = Math.min(8, distance * 0.1);
          particle.vx = (dx / distance) * speed;
          particle.vy = (dy / distance) * speed;
          particle.x += particle.vx;
          particle.y += particle.vy;
        }
      }

      // 寿命チェック
      if (particle.life > particle.maxLife) {
        particles.splice(i, 1);
        continue;
      }

      // アルファ値の計算（寿命に応じてフェードアウト）
      const lifeRatio = particle.life / particle.maxLife;
      if (lifeRatio > 0.8) {
        particle.alpha = 1 - ((lifeRatio - 0.8) / 0.2);
      }

      // パーティクルを描画
      this.drawExpParticle(particle);
      activeParticles++;
    }

    // 全てのパーティクルが消えたらエフェクト終了
    if (activeParticles === 0) {
      this.expParticles.active = false;
    }
  },

  /**
   * 経験値パーティクルを描画
   * @param {Object} particle - パーティクルオブジェクト
   */
  drawExpParticle(particle) {
    // コンテキストがnullの場合は処理をスキップ
    if (!this.ctx) {
      console.warn('描画コンテキストがnullです。パーティクル描画をスキップします。');
      return;
    }
    
    this.ctx.save();
    this.ctx.globalAlpha = particle.alpha;
    
    // 光る効果のためのグラデーション
    const gradient = this.ctx.createRadialGradient(
      particle.x, particle.y, 0,
      particle.x, particle.y, particle.size * 2
    );
    gradient.addColorStop(0, particle.color);
    gradient.addColorStop(0.5, particle.color.replace(')', ', 0.5)').replace('hsl', 'hsla'));
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    // パーティクル本体
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    this.ctx.fill();
    
    // 中心の明るい点
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.beginPath();
    this.ctx.arc(particle.x, particle.y, particle.size * 0.3, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.restore();
  },

  /**
   * パーティクルが経験値バーに到達した時のインパクトエフェクト
   * @param {number} x - X座標
   * @param {number} y - Y座標
   */
  createExpImpactEffect(x, y) {
    // コンテキストがnullの場合は処理をスキップ
    if (!this.ctx) {
      console.warn('描画コンテキストがnullです。エフェクト描画をスキップします。');
      return;
    }
    
    // 小さな爆発エフェクト
    this.ctx.save();
    
    // 放射状の光線
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      const length = 8 + Math.random() * 4;
      
      this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
      this.ctx.lineWidth = 2;
      this.ctx.lineCap = 'round';
      
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(
        x + Math.cos(angle) * length,
        y + Math.sin(angle) * length
      );
      this.ctx.stroke();
    }
    
    // 中心の光る円
    const impactGradient = this.ctx.createRadialGradient(x, y, 0, x, y, 12);
    impactGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    impactGradient.addColorStop(0.5, 'rgba(255, 215, 0, 0.6)');
    impactGradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
    
    this.ctx.fillStyle = impactGradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, 12, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.restore();
    
    // 軽いSE再生
    publish('playSE', 'expGain', 0.3);
  },

  // 攻撃処理を行うメソッド
  handleAttack() {
    // ここに元々のonAttack関数の内容をコピー
    // または単純にonAttack()を呼び出す（関数が定義済みであることを確認）
    if (typeof onAttack === 'function') {
      onAttack();
    } else {
      console.error('onAttack関数が定義されていません');
    }
  },
  
  // 回復処理を行うメソッド
  handleHeal() {
    if (typeof onHeal === 'function') {
      onHeal();
    } else {
      console.error('onHeal関数が定義されていません');
    }
  },
  
  // ヒント処理を行うメソッド
  handleHint() {
    if (typeof onHint === 'function') {
      onHint();
    } else {
      console.error('onHint関数が定義されていません');
    }
  },

  // アイコンサイズとスペーシングの統一
  drawIconWithText(ctx, icon, text, x, y, color = 'white') {
    // アイコン描画
    if (icon) {
      ctx.drawImage(icon, x, y, this.UI_CONSTANTS.ICON_SIZE, this.UI_CONSTANTS.ICON_SIZE);
    }
    
    // テキスト描画（アイコンとの間隔を統一）
    const textX = x + this.UI_CONSTANTS.ICON_SIZE + this.UI_CONSTANTS.ICON_MARGIN;
    this.drawTextWithOutline(text, textX, y + this.UI_CONSTANTS.ICON_SIZE/2, color, 'black');
  },

  drawWeaknessIndicator(ctx, weakness, x, y) {
    const config = {
      onyomi: { icon: images.iconOnyomi },
      kunyomi: { icon: images.iconKunyomi }
    };

    const weaknessConfig = config[weakness];
    if (!weaknessConfig || !weaknessConfig.icon) return;

    const iconSize = 32;
    // アイコンが中央に来るようにX座標を調整
    ctx.drawImage(weaknessConfig.icon, x - iconSize / 2, y - iconSize / 2, iconSize, iconSize);
  },

  // 経験値バーにパーセンテージ表示を追加
  drawExpBarWithPercentage(ctx, x, y, width, height, currentExp, maxExp) {
    // 既存の経験値バー描画
    drawExpBar(ctx, x, y, width, height, currentExp, maxExp);
    
    // パーセンテージ表示
    const percentage = Math.floor((currentExp / maxExp) * 100);
    const percentText = `${percentage}%`;
    
    // バーの中央にパーセンテージを表示
    ctx.font = '10px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    
    // 背景色に応じてテキスト色を調整
    const textColor = percentage > 50 ? 'black' : 'white';
    this.drawTextWithOutline(
      percentText,
      x + width/2, y + height/2,
      textColor, textColor === 'black' ? 'white' : 'black',
      '10px "UDデジタル教科書体", sans-serif',
      'center', 'middle', 1
    );
  },

  // 画面サイズに応じたUI調整
  getResponsiveLayout() {
    const canvas = this.canvas;
    const isSmall = canvas.width < 600 || canvas.height < 400;
    const isMedium = canvas.width < 800 || canvas.height < 600;
    
    return {
      panelScale: isSmall ? 0.8 : (isMedium ? 0.9 : 1.0),
      fontSize: isSmall ? 12 : (isMedium ? 14 : 16),
      buttonSize: isSmall ? 0.8 : 1.0,
      spacing: isSmall ? 8 : 12
    };
  },

  // レスポンシブ対応のパネル描画
  drawResponsivePanel(ctx, baseX, baseY, baseW, baseH) {
    const layout = this.getResponsiveLayout();
    
    const x = baseX * layout.panelScale;
    const y = baseY * layout.panelScale;
    const w = baseW * layout.panelScale;
    const h = baseH * layout.panelScale;
    
    return { x, y, w, h };
  },

  // コンボ表示の改善（残り時間表示付き）
  drawComboIndicatorWithTimer(ctx) {
    if (battleState.comboCount < 2) return;
    
    // 既存のコンボ表示
    this.drawComboIndicator(ctx);
    
    // コンボタイマーの視覚化
    if (battleState.comboTimer > 0) {
      const kanjiX = this.canvas.width / 2;
      const kanjiY = 200;
      const kanjiBoxW = 180;
      const comboX = kanjiX + kanjiBoxW / 2 + 40;
      const comboY = kanjiY;
      
      const timerRatio = battleState.comboTimer / 300; // 5秒 = 300フレーム
      const timerBarWidth = 60;
      const timerBarHeight = 4;
      
      // タイマーバー背景
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(comboX - timerBarWidth/2, comboY + 45, timerBarWidth, timerBarHeight);
      
      // タイマーバー（残り時間）
      const timerColor = timerRatio > 0.3 ? '#2ecc71' : '#e74c3c';
      ctx.fillStyle = timerColor;
      ctx.fillRect(comboX - timerBarWidth/2, comboY + 45, timerBarWidth * timerRatio, timerBarHeight);
    }
  },

  // カラーブラインド対応の色設定
  ACCESSIBLE_COLORS: {
    success: '#2ecc71',    // 緑（成功）
    warning: '#f39c12',    // オレンジ（警告）
    danger: '#e74c3c',     // 赤（危険）
    info: '#3498db',       // 青（情報）
    // パターンも併用
    successPattern: '✓',
    warningPattern: '⚠',
    dangerPattern: '✗',
    infoPattern: 'ℹ'
  },

  // 色とパターンを組み合わせた表示
  drawStatusWithPattern(ctx, status, x, y) {
    const config = this.ACCESSIBLE_COLORS[status];
    if (!config) return;
    
    // 色での表示
    ctx.fillStyle = config;
    ctx.fillRect(x, y, 20, 20);
    
    // パターンでの表示（色が識別できない場合の補助）
    ctx.fillStyle = 'white';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.ACCESSIBLE_COLORS[status + 'Pattern'], x + 10, y + 15);
  },

  // UI定数を追加
  UI_CONSTANTS: {
    ICON_SIZE: 16,
    ICON_MARGIN: 8,
    TEXT_PADDING: 12,
    SECTION_SPACING: 20
  },

  /**
   * シェイクエフェクトを開始するメソッド
   * @param {number} duration - エフェクトの持続フレーム数
   * @param {number} intensity - 震えの強さ
   */
  startShakeEffect(duration = 15, intensity = 5) {
    this.shakeEffect.active = true;
    this.shakeEffect.timer = duration;
    this.shakeEffect.duration = duration;
    this.shakeEffect.intensity = intensity;
    console.log('シェイクエフェクト開始:', duration, intensity); // デバッグ用
  },

  

  

  // マウスダウンイベントハンドラを追加
  handleMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // ボタンの押下状態を更新
    Object.entries(BTN).forEach(([key, b]) => {
      if (isMouseOverRect(x, y, b)) {
        this.pressedButtons.add(key);
      }
    });
  },

  // マウスアップイベントハンドラを追加
  handleMouseUp(e) {
    // pressedButtonsが存在することを確認してからクリア
    if (this.pressedButtons) {
      this.pressedButtons.clear();
    }
  },

  // イベントハンドラの登録を更新
  registerHandlers() {
    // ... 既存のイベントハンドラ ...
    
    // マウスイベントハンドラを追加
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this)); // マウスが離れた時も押下状態をクリア
  },

  // イベントハンドラの解除を更新
  unregisterHandlers() {
    // ... 既存のイベントハンドラ解除 ...
    
    // マウスイベントハンドラを解除
    this.canvas.removeEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.removeEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.removeEventListener('mouseleave', this.handleMouseUp.bind(this));
  },
};

export default battleScreenState;

// ---------- バトルロジック ----------

// 敵をスポーン（初期化）
function spawnEnemy() {
  const e = gameState.enemies[gameState.currentEnemyIndex];
  gameState.currentEnemy = e;
  updateEnemyUI(e.name, e.hp, e.maxHp);
  
  // 従来のログ初期化をaddToLogに置き換え
  // battleState.log = [`${e.name} があらわれた！`];
  battleState.log = [];
  addToLog(`${e.name} があらわれた！`);
  
  publish('playSE', 'appear');
  
  // ヒントレベルをリセット
  gameState.hintLevel = 0;
}

// battleScreen.js の onAttack 関数を修正
function onAttack() {
  console.log('🗡 onAttack() called — turn:', battleState.turn, 'inputEnabled:', battleState.inputEnabled);

  // 1) プレイヤーターンかつ入力許可中でなければ終了
  if (battleState.turn !== 'player' || !battleState.inputEnabled) return;
  battleState.inputEnabled = false;

  // 2) 入力を取得してひらがなに変換
  const inputEl = battleScreenState.inputEl;
  if (!inputEl) return;
  const raw = inputEl.value.trim();
  const answer = toHiragana(raw);

  // ── 読みメッセージ生成 ──
  const onyomiStr = gameState.currentKanji.onyomi.join('、');
  const kunyomiStr = gameState.currentKanji.kunyomi.join('、');
  const readingMsg = `正しいよみ: 音「${onyomiStr}」訓「${kunyomiStr}」`;

  // ── 正解判定 ──
  const correctReadings = getReadings(gameState.currentKanji);
  const correct = correctReadings.includes(answer);

  if (correct) {
    // 正解処理
    console.log('正解！エフェクト開始'); // デバッグ用
    
    // 漢字ボックスのエフェクトを開始（黄色で光らせる）
    battleScreenState.startKanjiBoxEffect('rgba(241, 196, 15, 0.8)', 20);
    
    // 前回正解した漢字の情報を保存
    battleScreenState.lastAnsweredKanji = { ...gameState.currentKanji };
    
    // 正解時に前回の不正解をクリア
    battleScreenState.lastIncorrectAnswer = null;
    
    // 正解時の入力欄フィードバック
    inputEl.style.borderColor = 'green';
    inputEl.style.backgroundColor = 'rgba(0, 255, 0, 0.1)';
    setTimeout(() => {
      inputEl.style.borderColor = '#ccc';
      inputEl.style.backgroundColor = 'white';
    }, 500);
    
    // 正解処理
    battleState.lastAnswered = { ...gameState.currentKanji };
    gameState.correctKanjiList.push({ ...gameState.currentKanji });
    publish('playSE', 'correct');
    publish('addToKanjiDex', gameState.currentKanji.id);
    
    // 統計データの更新（正解）
    gameState.playerStats.totalCorrect++;
    gameState.playerStats.comboCount++;
    
    // ← 学習データ記録を追加（正解）
    const kanjiItem = kanjiData.find(k => k.id === gameState.currentKanji.id);
    if (kanjiItem) {
      kanjiItem.correctCount = (kanjiItem.correctCount || 0) + 1;
      console.log(`📈 漢字ID:${gameState.currentKanji.id} の正解カウント: ${kanjiItem.correctCount}`);
    }
    
    // チャレンジモードの場合、残り時間を加算
    if (gameState.gameMode === 'challenge') {
      battleState.timeRemaining += 5; // 正解ごとに5秒加算
    }
    
    // 1) 連続正解カウントアップ（既存のbattleState.comboCountは保持）
    battleState.comboCount++;
    
    // コンボカウントが2以上になったらコンボアニメーションを開始
    if (battleState.comboCount >= 2) {
      battleScreenState.startComboAnimation(battleState.comboCount);
    }
    
    // 2) 基本ダメージ計算
    let baseDamage = gameState.playerStats.attack;
    
    // ダメージに少しゆらぎを持たせる（例: 攻撃力の±10%）
    let randomFactor = (Math.random() * 0.2) - 0.1; // -0.1 〜 +0.1
    let dmg = Math.round(baseDamage * (1 + randomFactor));
    
    // 属性システム：敵の弱点判定
    let readingType = null;
    let isWeaknessHit = false;
    
    // プレイヤーの答えが音読みか訓読みかを正確に判定
    const isInKunyomi = gameState.currentKanji.kunyomi.includes(answer);
    const isInOnyomi = gameState.currentKanji.onyomi.includes(answer);
    
    if (isInKunyomi && !isInOnyomi) {
      readingType = 'kunyomi';
    } else if (isInOnyomi && !isInKunyomi) {
      readingType = 'onyomi';
    } else if (isInKunyomi && isInOnyomi) {
      // 両方に含まれる場合は、敵の弱点に合わせて判定
      readingType = gameState.currentEnemy.weakness;
    }
    
    // 敵の弱点と一致するかチェック
    if (readingType && gameState.currentEnemy.weakness === readingType) {
      isWeaknessHit = true;
      dmg = Math.floor(dmg * 1.5);
      battleState.log.push('弱点にヒット！大ダメージ！');
      
      // 弱点ヒット統計データの更新
      gameState.playerStats.weaknessHits++;
      
      console.log(`🎯 弱点ヒット! 敵の弱点: ${gameState.currentEnemy.weakness}, プレイヤーの読み: ${readingType}`);
    }
    
    // 5連続正解ボーナス判定
    if (battleState.comboCount === 5) {
      // 連続正解ボーナス：ダメージ増加のみ（経験値ボーナスは削除）
      dmg = Math.floor(dmg * 1.5);
      battleState.log.push('れんぞくせいかいボーナス！');
      battleState.comboCount = 0;
    }
    
    // ====== ボス戦のシールドシステム ======
    if (gameState.currentEnemy.isBoss) {
      // ボス戦の場合
      if (gameState.currentEnemy.shieldHp > 0) {
        // シールドがある場合
        if (isWeaknessHit) {
          // 弱点を突いた場合：シールドを削る
          gameState.currentEnemy.shieldHp--;
          battleState.log.push(`せいかい！${readingMsg}`);
          battleState.log.push('シールドにヒビが入った！');
          
          if (gameState.currentEnemy.shieldHp === 0) {
            battleState.log.push('ボスの防御が崩れた！');
          }
          
          // シールドを削った場合は敵にダメージを与えない
          dmg = 0;
          
          // シールド破壊後も入力を継続できるように処理を修正
          battleState.lastCommandMode = 'attack';
          battleState.turn = 'enemy';
          battleState.inputEnabled = false;
          
          // 1秒後に敵のターンを実行し、その後プレイヤーターンに戻す
          setTimeout(() => {
            enemyTurn();
            // 敵の攻撃後、次の問題を出題してプレイヤーターンに戻す
            setTimeout(() => {
              pickNextKanji();
              battleState.turn = 'player';
              battleState.inputEnabled = true;
            }, 1500); // 敵の攻撃アニメーション分の時間を確保
          }, 1000);
          
          // 入力欄をクリア
          inputEl.value = '';
          return; // ここで処理を終了
          
        } else {
          // 弱点を突いていない場合：ダメージを1に固定
          dmg = 1;
          battleState.log.push(`せいかい！${readingMsg}、しかし${gameState.currentEnemy.name}の防御は固い！`);
        }
      } else {
        // シールドHPが0の場合：通常通りのダメージ
        battleState.log.push(`せいかい！${readingMsg}、${gameState.currentEnemy.name}に${dmg}のダメージ！`);
      }
    } else {
      // 通常の敵の場合：通常通りのダメージ
      battleState.log.push(`せいかい！${readingMsg}、${gameState.currentEnemy.name}に${dmg}のダメージ！`);
    }
    
    // ダメージ適用（ボス戦でシールドを削った場合はdmg=0なので実質ダメージなし）
    if (dmg > 0) {
      gameState.currentEnemy.hp = Math.max(0, gameState.currentEnemy.hp - dmg);
    }
    
    battleState.enemyAction      = 'damage';
    battleState.enemyActionTimer = ENEMY_DAMAGE_ANIM_DURATION;
    updateEnemyUI(gameState.currentEnemy.name, gameState.currentEnemy.hp, gameState.currentEnemy.maxHp);
    
    // 敵撃破判定
    if (gameState.currentEnemy.hp === 0) {
      // 撃破ログ
      battleState.log.push(
        `${gameState.playerName}は${gameState.currentEnemy.name}をたおした！`
      );
      publish('playSE', 'defeat');
      battleState.enemyAction      = 'defeat';
      battleState.enemyActionTimer = ENEMY_DEFEAT_ANIM_DURATION;
      
      // ボス撃破統計の更新
      if (gameState.currentEnemy.isBoss) {
        gameState.playerStats.bossesDefeated++;
      }
      
      // モンスターデックスに登録
      addMonster(gameState.currentEnemy.id);
      
      // 敵撃破の統計データを更新
      recordEnemyDefeated();
      
      // 実績チェックを実行
      checkAchievements().catch(error => {
        console.error('実績チェック中にエラーが発生しました:', error);
      });
      
      // 経験値獲得量を計算
      const expGained = gameState.currentEnemy.exp || 30; // フォールバック値として30を設定
      
      // 敵の位置（中心点）を計算
      const enemyX = 480 + 240/2; // ex + ew/2
      const enemyY = 80 + 120/2;  // ey + eh/2
      
      // プレイヤー経験値バーの位置を計算
      // プレイヤーステータスパネルの経験値バーの位置を取得
      const panelX = 20;
      const panelY = battleScreenState.canvas.height - 120;
      const expBarY = panelY + 25 + 35; // 経験値バーのY座標
      const expBarX = panelX + 140; // 経験値バーの中央あたり
      
      // パーティクルエフェクトを開始
      battleScreenState.startExpParticleEffect(
        enemyX, enemyY, // 敵の位置（発生源）
        expBarX, expBarY, // 経験値バーの位置（目標）
        expGained // 獲得経験値
      );
      
      // 経験値獲得メッセージを表示
      battleState.log.push(`${expGained}の経験値を獲得した！`);
      
      // 敵が残っていれば次の敵をスポーン、最後の敵ならステージクリア待機
      if (gameState.currentEnemyIndex < gameState.enemies.length - 1) {
        setTimeout(() => {
          // 敵撃破後に入力欄をクリア
          const inputEl = battleScreenState.inputEl;
          if (inputEl) inputEl.value = '';
          gameState.currentEnemyIndex++;
          spawnEnemy();
          pickNextKanji();
          battleState.turn = 'player';
          battleState.inputEnabled = true;
          
          // 次の問題に進む際にヒントレベルをリセット
          gameState.hintLevel = 0;
        }, 500);
      } else {
        // 最後の敵を倒した場合：ステージクリアを保留状態にする
        setTimeout(() => {
          // 最後の敵撃破後に入力欄をクリア
          const inputEl = battleScreenState.inputEl;
          if (inputEl) inputEl.value = '';
          // 直接 victoryCallback を呼ばずに保留状態にする
          battleScreenState.stageClearPending = true;
        }, 500);
      }
      return;
    } else {
      // ← 敵を倒していない場合の処理：敵のターンに移行
      battleState.lastCommandMode = 'attack';
      battleState.turn = 'enemy';
      battleState.inputEnabled = false;
      
      // 1秒後に敵のターンを実行し、その後プレイヤーターンに戻す
      setTimeout(() => {
        enemyTurn();
        // 敵の攻撃後、次の問題を出題してプレイヤーターンに戻す
        setTimeout(() => {
          pickNextKanji();
          battleState.turn = 'player';
          battleState.inputEnabled = true;
        }, 1500); // 敵の攻撃アニメーション分の時間を確保
      }, 1000);
    }
    
  } else {
    // 不正解時の入力欄フィードバック
    inputEl.style.borderColor = 'red';
    inputEl.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
    setTimeout(() => {
      inputEl.style.borderColor = '#ccc';
      inputEl.style.backgroundColor = 'white';
    }, 500);
    
    // 不正解処理
    battleScreenState.lastIncorrectAnswer = answer;
    
    // 前回の漢字として記録
    battleState.lastAnswered = { ...gameState.currentKanji };
    gameState.wrongKanjiList.push({ ...gameState.currentKanji });
    publish('addToReview', gameState.currentKanji.id);
    publish('playSE', 'wrong');
    addToLog(`こうげきしっぱい！${readingMsg}`);
    
    // 統計データの更新（不正解）
    gameState.playerStats.totalIncorrect++;
    battleState.mistakesThisStage++;
    gameState.playerStats.comboCount = 0; // プレイヤー統計のコンボリセット
    
    // ← 学習データ記録を追加（不正解）
    const kanjiItem = kanjiData.find(k => k.id === gameState.currentKanji.id);
    if (kanjiItem) {
      kanjiItem.incorrectCount = (kanjiItem.incorrectCount || 0) + 1;
      console.log(`📉 漢字ID:${gameState.currentKanji.id} の不正解カウント: ${kanjiItem.incorrectCount}`);
    }
    
    // ★ コンボカウントを確実にリセット ★
    battleState.comboCount = 0;
    battleState.comboTimer = 0;
    console.log('❌ 不正解によりコンボがリセットされました');
    
    // 不正解時の正しい読みをハイライト表示
    const onyomiReadings = gameState.currentKanji.onyomi || [];
    const kunyomiReadings = gameState.currentKanji.kunyomi || [];
    
    let minOnyomiDistance = Infinity;
    let minKunyomiDistance = Infinity;
    
    // 音読みとの距離を計算
    for (const reading of onyomiReadings) {
      const distance = levenshteinDistance(answer, reading);
      minOnyomiDistance = Math.min(minOnyomiDistance, distance);
    }
    
    // 訓読みとの距離を計算
    for (const reading of kunyomiReadings) {
      const distance = levenshteinDistance(answer, reading);
      minKunyomiDistance = Math.min(minKunyomiDistance, distance);
    }
    
    // 入力に最も近い読み方を判定
    let correctType;
    if (minOnyomiDistance < minKunyomiDistance) {
      correctType = 'onyomi'; // 音読みが正解
    } else {
      correctType = 'kunyomi'; // 訓読みが正解
    }
    
    // ハイライト効果を開始
    battleScreenState.startReadingHighlight(correctType);
    
    // ★ 敵のターンへ移行（確実に実行） ★
    battleState.turn = 'enemy';
    battleState.inputEnabled = false;
    
    console.log('🔄 敵のターンに移行します');
    
    // 1秒後に敵の攻撃を実行
    setTimeout(() => {
      console.log('👹 敵の攻撃を開始');
      enemyTurn();
      
      // 敵の攻撃後、1.5秒後に次の問題を出題してプレイヤーターンに戻す
      setTimeout(() => {
        console.log('📝 次の漢字を出題');
        pickNextKanji();
        
        // プレイヤーターンに戻す
        setTimeout(() => {
          console.log('🎮 プレイヤーターンに戻ります');
          battleState.turn = 'player';
          battleState.inputEnabled = true;
        }, 500);
      }, 1500); // 敵の攻撃アニメーション分の時間を確保
    }, 1000);
  }
  
  // 入力欄をクリア
  inputEl.value = '';
}

// Levenshtein距離（文字列の類似度）を計算する関数
function levenshteinDistance(a, b) {
  // トリムして両方小文字に変換
  const normalizedA = a.trim().toLowerCase();
  const normalizedB = b.trim().toLowerCase();
  
  const matrix = [];
  
  // 初期化
  for (let i = 0; i <= normalizedB.length; i++) {
    matrix[i] = [i];
  }
  
  for (let i = 0; i <= normalizedA.length; i++) {
    matrix[0][i] = i;
  }
  
  // 行列を埋める
  for (let i = 1; i <= normalizedB.length; i++) {
    for (let j = 1; j <= normalizedA.length; j++) {
      if (normalizedB.charAt(i-1) === normalizedA.charAt(j-1)) {
        matrix[i][j] = matrix[i-1][j-1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i-1][j-1] + 1, // 置換
          matrix[i][j-1] + 1,   // 挿入
          matrix[i-1][j] + 1    // 削除
        );
      }
    }
  }
  
  return matrix[normalizedB.length][normalizedA.length];
}

// 回復ボタン
function onHeal() {
  console.log('💚 onHeal() called — turn:', battleState.turn, 'inputEnabled:', battleState.inputEnabled);

  // プレイヤーターンかつ入力許可中でなければ終了
  if (battleState.turn !== 'player' || !battleState.inputEnabled) return;

  // 回復回数チェック
  if (gameState.playerStats.healCount <= 0) {
    alert('回復はもう使えません！');
    return;
  }

  battleState.inputEnabled = false;

  // 入力を取得してひらがなに変換
  const inputEl = battleScreenState.inputEl;
  if (!inputEl) return;
  const raw    = inputEl.value.trim();
  const answer = toHiragana(raw);

  // 読みメッセージ生成
  const onyomiStr = gameState.currentKanji.onyomi.join('、');
  const kunyomiStr = gameState.currentKanji.kunyomi.join('、');
  const readingMsg = `正しいよみ: 音「${onyomiStr}」訓「${kunyomiStr}」`;

  // 正解判定
  const correctReadings = getReadings(gameState.currentKanji);
  const correct = correctReadings.includes(answer);

  if (correct) {
    // 正解処理
    
    // 正解時に前回の不正解をクリア
    battleScreenState.lastIncorrectAnswer = null;
    
    battleState.lastAnswered = { ...gameState.currentKanji };
    battleState.comboCount++;
    gameState.correctKanjiList.push({ ...gameState.currentKanji });
    publish('playSE', 'correct');
    publish('addToKanjiDex', gameState.currentKanji.id);

    // 統計データの更新（正解）
    gameState.playerStats.totalCorrect++;
    gameState.playerStats.comboCount++;

    // 回復前のHPを保存
    const prevHp = gameState.playerStats.hp;
    publish('playSE', 'heal');
    gameState.playerStats.hp = Math.min(
      gameState.playerStats.maxHp,
      gameState.playerStats.hp + 30
    );
    battleState.playerHpTarget    = gameState.playerStats.hp;
    battleState.playerHpAnimating = true;
    // 回復成功ログ（新仕様）
    battleState.log.push(`かいふくせいこう！${readingMsg}`);

    // 回復成功統計の更新
    gameState.playerStats.healsSuccessful++;

    // チャレンジモードの場合、残り時間を加算
    if (gameState.gameMode === 'challenge') {
      battleState.timeRemaining += 5; // 正解ごとに5秒加算
    }
  } else {
    // 不正解処理
    
    // 不正解の答えを保存
    battleScreenState.lastIncorrectAnswer = answer;
    
    battleState.lastAnswered = { ...gameState.currentKanji };
    gameState.wrongKanjiList.push({ ...gameState.currentKanji });
    publish('addToReview', gameState.currentKanji.id);
    publish('playSE', 'wrong');
    addToLog(`かいふくしっぱい！${readingMsg}`);

    // 統計データの更新（不正解）
    gameState.playerStats.totalIncorrect++;
    battleState.mistakesThisStage++;
    gameState.playerStats.comboCount = 0; // コンボカウントをリセット

    // チャレンジモードの時だけダメージを受ける
    if (gameState.gameMode === 'challenge') {
      // 失敗時：ダメージ
      const atk = gameState.currentEnemy.atk || 5;
      gameState.playerStats.hp = Math.max(
        0,
        gameState.playerStats.hp - atk
      );
      if (gameState.playerStats.hp === 0) {
        return setTimeout(() => publish('changeScreen','gameOver'), 500);
      }
    }
  }

  // 入力欄をクリア
  inputEl.value = '';

  // 3) 敵ターン＆プレイヤー復帰
  battleState.turn = 'enemy';
  setTimeout(() => {
    enemyTurn();
    // 敵の行動ログの後で、次の漢字を提示
    pickNextKanji();
    setTimeout(() => {
      battleState.turn = 'player';
      battleState.inputEnabled = true;
    }, 500);
  }, 1000);
}
  

// ヒント切替
function onHint() {
  // 段階的にヒントレベルを上げる（最大3）
  gameState.hintLevel = (gameState.hintLevel + 1) % 4;
  
  // ヒントレベルに応じたメッセージをログに表示
  switch(gameState.hintLevel) {
    case 0:
      addToLog('ヒントを非表示にした');
      break;
    case 1:
      addToLog(`ヒント（基本）: 画数は${gameState.currentKanji.strokes}`);
      break;
    case 2:
      // 音読みと訓読みのどちらかをランダムに選んで部分的に表示
      const isOnyomi = Math.random() > 0.5;
      const readings = isOnyomi ? gameState.currentKanji.onyomi : gameState.currentKanji.kunyomi;
      
      if (readings && readings.length > 0) {
        // 読みの最初の1文字を表示
        const firstReading = readings[0];
        const hintText = firstReading.substring(0, 1) + '○○';
        addToLog(`ヒント（読み）: ${isOnyomi ? '音読み' : '訓読み'}は「${hintText}」から始まる`);
  } else {
        // 該当する読みがない場合は別のヒント
        addToLog(`ヒント（読み）: ${isOnyomi ? '訓読み' : '音読み'}で読むことが多い`);
      }
      break;
    case 3:
      addToLog(`ヒント（意味）: ${gameState.currentKanji.meaning}`);
      break;
  }
}

// 敵行動（フラッシュ効果を追加）
function enemyTurn() {
  // 敵の攻撃時に突進アニメーション開始
  battleState.enemyAction      = 'attack';
  battleState.enemyActionTimer = ENEMY_ATTACK_ANIM_DURATION;

  const atk = gameState.currentEnemy.atk || 5;
  // 敵攻撃メッセージのフォーマットを `${e.name} のこうげき！プレイヤー名に～のダメージ！` に変更
  battleState.log.push(
    `${gameState.currentEnemy.name} のこうげき！${gameState.playerName}に${atk}のダメージ！`
  );

  gameState.playerStats.hp = Math.max(0, gameState.playerStats.hp - atk);
  // ── ここから追加 ──
  battleState.playerHpTarget    = gameState.playerStats.hp;
  battleState.playerHpAnimating = true;
  
  // 被ダメージ時の画面フラッシュ効果を開始
  battleScreenState.startFlashEffect('rgba(255, 0, 0, 0.5)', 15);
  // ── ここまで追加 ──
  
  publish('playSE', 'damage');

  if (gameState.playerStats.hp <= 0) {
    // タイマーがある場合は停止
    if (battleScreenState.timerId) {
      clearInterval(battleScreenState.timerId);
      battleScreenState.timerId = null;
    }
    return setTimeout(() => publish('changeScreen', 'gameOver'), 1500);
  }
}


export function pickNextKanji() {
  // ヒントレベルをリセット
  gameState.hintLevel = 0;
  
  console.log('🎯 pickNextKanji() 開始 (属性システム対応)');

  const currentEnemy = gameState.currentEnemy;
  if (!currentEnemy || !currentEnemy.weakness) {
    console.warn('⚠️ 敵の弱点情報が見つかりません。通常の選択方法を使用します。');
    // フォールバック：通常の全体プールから選択
    return pickFromPool(gameState.kanjiPool, '全体プール');
  }

  console.log(`🎯 敵の弱点: ${currentEnemy.weakness}`);

  // 1. 敵の弱点に応じて第一候補リストを選択
  const primaryPool = currentEnemy.weakness === 'onyomi' 
    ? battleState.kanjiPool_onyomi 
    : battleState.kanjiPool_kunyomi;
  
  const fallbackPool = currentEnemy.weakness === 'onyomi' 
    ? battleState.kanjiPool_kunyomi 
    : battleState.kanjiPool_onyomi;

  console.log(`📋 第一候補プール: ${primaryPool.length}件`);
  console.log(`📋 フォールバックプール: ${fallbackPool.length}件`);

  // 2. 第一候補リストから出題可能な漢字を探す
  const primaryResult = pickFromPool(primaryPool, '第一候補');
  if (primaryResult) {
    console.log('✅ 第一候補プールから問題を選択しました');
    return primaryResult;
  }

  // 3. 第一候補が尽きた場合、フォールバックプールから選択
  console.log('⚠️ 第一候補プールが尽きました。フォールバックプールを使用します。');
  const fallbackResult = pickFromPool(fallbackPool, 'フォールバック');
  if (fallbackResult) {
    console.log('✅ フォールバックプールから問題を選択しました');
    return fallbackResult;
  }

  // 4. 両方のプールが尽きた場合の最終フォールバック
  console.warn('⚠️ 全てのプールが尽きました。全体プールから強制選択します。');
  return pickFromPool(gameState.kanjiPool, '最終フォールバック');
}

/**
 * 指定されたプールから直近出題回避ロジックを使って漢字を選択
 * @param {Array} pool 選択対象の漢字プール
 * @param {string} poolName プール名（ログ用）
 * @returns {boolean} 選択に成功したかどうか
 */
function pickFromPool(pool, poolName) {
  if (!pool || pool.length === 0) {
    console.warn(`⚠️ ${poolName}が空です`);
    return false;
  }

  // 直近出題を避けて候補を絞り込む
  let candidatePool = pool.filter(
    kanji => !battleState.recentKanjiIds.includes(kanji.id)
  );

  // 候補がいなくなったら全範囲から選ぶ
  if (candidatePool.length === 0) {
    console.warn(`⚠️ ${poolName}の全ての漢字が直近に出題済みです。全範囲から選択します。`);
    candidatePool = pool;
  }

  // ランダムに1問選択
  const selectedKanji = candidatePool[Math.floor(Math.random() * candidatePool.length)];
  
  if (!selectedKanji) {
    console.error(`❌ ${poolName}から漢字を選択できませんでした`);
    return false;
  }

  // 直近の出題履歴を更新
  battleState.recentKanjiIds.push(selectedKanji.id);
  if (battleState.recentKanjiIds.length > RECENT_QUESTIONS_BUFFER_SIZE) {
    battleState.recentKanjiIds.shift();
  }

  // 現在の問題として設定
  const processReadings = (readings) => {
    if (!readings) return [];
    if (Array.isArray(readings)) {
      return readings.map(r => toHiragana(r.trim())).filter(Boolean);
    } else if (typeof readings === 'string') {
      return readings.split(' ').map(r => toHiragana(r.trim())).filter(Boolean);
    }
    return [];
  };

  gameState.currentKanji = {
    id: selectedKanji.id,
    text: selectedKanji.kanji,
    kunyomi: processReadings(selectedKanji.kunyomi),
    onyomi: processReadings(selectedKanji.onyomi),
    weakness: selectedKanji.weakness,
    readings: getReadings(selectedKanji),
    meaning: selectedKanji.meaning,
    strokes: selectedKanji.strokes,
  };

  gameState.showHint = false;
  addToLog(`「${gameState.currentKanji.text}」をよもう！`);
  
  console.log(`✅ ${poolName}から選択: ${selectedKanji.kanji} (ID: ${selectedKanji.id})`);
  console.log('📝 直近リスト:', battleState.recentKanjiIds);
  
  return true;
}

// HPバー・テキスト更新
function updateEnemyUI(name, hp, maxHp) {
  // battleScreenState の canvas と ctx を参照
  const ctx    = battleScreenState.ctx;
  const canvas = battleScreenState.canvas;
  if (!ctx || !canvas) return;
  // 画面上部に HP 表示＆ゲージ描画
  ctx.clearRect(0, 0, canvas.width, 50);
  ctx.fillStyle = 'white';
  ctx.font = '20px "UDデジタル教科書体",sans-serif';
  ctx.fillText(`${name} HP: ${hp}／${maxHp}`, 20, 30);

  const barW = 200;
  const rate = hp / maxHp;
  ctx.fillStyle = 'red';
  ctx.fillRect(20, 35, barW * rate, 10);
  ctx.strokeStyle = 'white';
  ctx.strokeRect(20, 35, barW, 10);
}


export function cleanup() {  
  // バトル画面を離れるときに、入力欄を非表示にする
  if (inputEl) {
    inputEl.style.display = 'none';
  }
  // バトル画面固有のリスナ解除は不要（main.js が一元管理しているため）
  canvas = null;
  inputEl = null;
}

/* ---------- ユーティリティ ---------- */
const hiraShift = ch => String.fromCharCode(ch.charCodeAt(0) - 0x60);
const toHira = s => s.replace(/[\u30a1-\u30f6]/g, hiraShift).trim();

// getReadings 関数を修正
function getReadings(k) {
  const set = new Set();
  
  // kunyomiの処理：配列か文字列かをチェック
  if (k.kunyomi) {
    if (Array.isArray(k.kunyomi)) {
      // 既に配列の場合
      k.kunyomi.forEach(r => {
        if (r && typeof r === 'string') {
          set.add(toHira(r.trim()));
        }
      });
    } else if (typeof k.kunyomi === 'string') {
      // 文字列の場合
      k.kunyomi.split(' ').forEach(r => {
        if (r) set.add(toHira(r.trim()));
      });
    }
  }
  
  // onyomiの処理：配列か文字列かをチェック
  if (k.onyomi) {
    if (Array.isArray(k.onyomi)) {
      // 既に配列の場合
      k.onyomi.forEach(r => {
        if (r && typeof r === 'string') {
          set.add(toHira(r.trim()));
        }
      });
    } else if (typeof k.onyomi === 'string') {
      // 文字列の場合
      k.onyomi.split(' ').forEach(r => {
        if (r) set.add(toHira(r.trim()));
      });
    }
  }
  
  return [...set].filter(Boolean); // undefined や空文字を除外
}

// battleScreen.js の normalizeReading 関数を改善
function toHiragana(input) {
  if (!input) return '';
  // 全角スペース、半角スペースをトリム
  let normalized = input.trim().replace(/\s+/g, '');
  // カタカナをひらがなに変換
  normalized = toHira(normalized);
  return normalized;
}

/**
 * 経験値バーを描画する関数（改良版）
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D コンテキスト
 * @param {number} x - バーのX座標
 * @param {number} y - バーのY座標
 * @param {number} width - バーの幅
 * @param {number} height - バーの高さ
 * @param {number} currentExp - 現在の経験値（レベル内での進行分）
 * @param {number} maxExp - 次のレベルまでに必要な経験値
 */
function drawExpBar(ctx, x, y, width, height, currentExp, maxExp) {
  // 背景（半透明の暗い色）
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(x, y, width, height);
  
  // 経験値バー（黄色グラデーション）
  if (maxExp > 0) {
    const expRatio = Math.min(currentExp / maxExp, 1);
    
    // グラデーションを作成して経験値バーをより鮮やかに
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, '#f1c40f'); // 上部は明るい黄色
    gradient.addColorStop(1, '#f39c12'); // 下部は琥珀色
    
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width * expRatio, height);
    
    // アニメーション中は光るエフェクトを追加
    if (battleScreenState.playerExpAnimating) {
      // バーの先端に光るハイライト
      const glowWidth = 5;
      const glowX = x + (width * expRatio) - glowWidth;
      
      // 光るグラデーション
      const glowGradient = ctx.createLinearGradient(glowX, y, glowX + glowWidth, y);
      glowGradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
      glowGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
      glowGradient.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
      
      ctx.fillStyle = glowGradient;
      ctx.fillRect(glowX, y, glowWidth, height);
      
      // パーティクル効果（小さな光の粒）
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      for (let i = 0; i < 3; i++) {
        const particleX = x + Math.random() * (width * expRatio);
        const particleY = y + Math.random() * height;
        const particleSize = 1 + Math.random() * 2;
        ctx.fillRect(particleX, particleY, particleSize, particleSize);
      }
    }
  }
  
  // 枠線（白）
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
  
  // 目盛り線を追加（進捗感を強化）
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.beginPath();
  for (let i = 1; i < 5; i++) {
    const markX = x + (width * i / 5);
    ctx.moveTo(markX, y);
    ctx.lineTo(markX, y + height);
  }
  ctx.stroke();
}

/**
 * 指定されたレベルに到達するために必要な経験値を計算する（再帰関数）
 * @param {number} level 計算したいレベル（1以上の整数）
 * @returns {number} そのレベルに到達するための必要経験値
 */
function calculateExpForLevel(level) {
  // 入力値の検証
  if (!Number.isInteger(level) || level < 1) {
    return 100; // エラー時のフォールバック
  }
  
  // ベースケース: レベル1の必要経験値は100
  if (level === 1) {
    return 100;
  }
  
  // 再帰ケース: レベルLからL+1になるための必要経験値
  // Math.floor(（レベルL-1の必要経験値） * 1.2) + 20
  const previousLevelExp = calculateExpForLevel(level - 1);
  return Math.floor(previousLevelExp * 1.2) + 20;
}

// addPlayerExp関数の拡張または経験値更新時の処理を修正
// onAttackやその他経験値が増加する箇所で呼び出す
function updatePlayerExp(expGained) {
  // 既存の経験値加算処理
  const levelUpResult = addPlayerExp(expGained);
  
  // 経験値バーアニメーションの設定
  const player = gameState.playerStats;
  const currentLevelExp = calculateExpForLevel(player.level);
  const expForBar = player.exp - currentLevelExp;
  
  battleScreenState.playerExpTarget = expForBar;
  battleScreenState.playerExpAnimating = true;
  
  return levelUpResult;
}

// メッセージをログに追加する共通関数を追加
function addToLog(message) {
  battleState.log.push(message);
  // メッセージ追加時にタイプライターエフェクトを開始
  battleScreenState.startTypewriterEffect(message);
}

// 以下の関数をbattleScreenStateオブジェクトの外部に定義
// これらのヘルパー関数を追加
function onAttackHandler() {
  // 関数内で使用する変数や関数を直接参照せず、
  // battleScreenStateのメソッドを通して安全に呼び出す
  try {
    // onAttack関数を直接呼び出す代わりに、
    // battleScreenStateのhandleAttackメソッドを呼び出す
    battleScreenState.handleAttack();
  } catch (error) {
    console.error('攻撃処理でエラーが発生しました:', error);
    battleState.inputEnabled = true;
  }
}

function onHealHandler() {
  try {
    battleScreenState.handleHeal();
  } catch (error) {
    console.error('回復処理でエラーが発生しました:', error);
    battleState.inputEnabled = true;
  }
}

function onHintHandler() {
  try {
    battleScreenState.handleHint();
  } catch (error) {
    console.error('ヒント処理でエラーが発生しました:', error);
    battleState.inputEnabled = true;
  }
}

// UIテーマの定義
const UI_THEME = {
  colors: {
    primary: '#3498db',
    secondary: '#2ecc71',
    accent: '#f39c12',
    danger: '#e74c3c',
    background: 'rgba(0, 0, 0, 0.7)',
    text: 'white',
    textSecondary: 'rgba(255, 255, 255, 0.8)'
  },
  fonts: {
    primary: '"UDデジタル教科書体", sans-serif',
    secondary: 'sans-serif'
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20
  },
  borderRadius: 4,
  shadowOpacity: 0.3
};

