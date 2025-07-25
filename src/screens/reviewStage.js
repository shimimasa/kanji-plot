import { publish } from '../core/eventBus.js';
import ReviewQueue   from '../models/reviewQueue.js';
import { getKanjiById } from '../loaders/dataLoader.js';
import { drawButton, isMouseOverRect } from '../ui/uiRenderer.js';

// 追加：バトル画面と同じ読み判定ロジックを再現するユーティリティ
function hiraShift(ch) {
  return String.fromCharCode(ch.charCodeAt(0) - 0x60);
}
function toHiragana(input) {
  return input
    .trim()
    .replace(/\s+/g, '')
    .replace(/[\u30a1-\u30f6]/g, hiraShift);
}
function getReadings(data) {
  const set = new Set();
  if (data.kunyomi) {
    data.kunyomi.split(' ').forEach(r => {
      if (r) set.add(toHiragana(r.trim()));
    });
  }
  if (data.onyomi) {
    data.onyomi.split(' ').forEach(r => {
      if (r) set.add(toHiragana(r.trim()));
    });
  }
  return [...set];
}

const reviewStage = {
  canvas: null,
  ctx:    null,
  inputEl: null,
  _keydownHandler: null,
  _clickHandler:  null,
  kanjiIds:    [],
  currentIndex: 0,
  currentKanji: null,
  message:     '',

  /** enter: 初期化 */
  enter(arg) {
    // canvas 引数が渡されない場合は DOM から取得
    this.canvas = (arg && typeof arg.getContext === 'function')
      ? arg
      : document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');

    // 1) 復習対象をポップ
    this.kanjiIds = ReviewQueue.popBatch(5)
      // null, undefined な ID を除外
      .filter(id => id != null);

    if (this.kanjiIds.length === 0) {
      publish('changeScreen', 'stageSelect');
      return;
    }

    // 2) DOM入力欄を表示＆クリア
    this.inputEl = document.getElementById('kanjiInput');
    if (this.inputEl) {
      this.inputEl.style.display = 'block';
      this.inputEl.value = '';
    }

    // 3) 最初の漢字をロード
    this.currentIndex = 0;
    this._loadCurrent();

    // 4) キーダウン登録 (Enter判定)
    this._keydownHandler = this._onKeydown.bind(this);
    this.inputEl?.addEventListener('keydown', this._keydownHandler);

    // 5) クリック登録 (ステージ選択へ戻るボタン用)
    this._clickHandler = e => {
      const r = this.canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      // 左上「ステージ選択」ボタン
      if (x >= 20 && x <= 120 && y >= 20 && y <= 50) {
        publish('playSE', 'decide');
        publish('changeScreen', 'stageSelect');
      }
    };
    this.canvas.addEventListener('click', this._clickHandler);
  },

  /** _loadCurrent: currentKanji とメッセージをセット */
  _loadCurrent() {
    const id = this.kanjiIds[this.currentIndex++];
    const data = getKanjiById(id);
    // 読み候補もセット
    this.currentKanji = { ...data, readings: getReadings(data) };
    this.message = `「${data.kanji}」をよもう！`;
  },

  /** キー処理: Enter で読み判定 */
  _onKeydown(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!this.currentKanji) return;

    // バトル画面と同じ normalize + 完全一致判定
    const answer = toHiragana(this.inputEl.value);
    const ok = this.currentKanji.readings.includes(answer);

    if (ok) {
      publish('playSE', 'correct');
      this.message = '正解！';
      // 正解の場合：品質5（完璧に正解）でSM-2アルゴリズムに記録
      ReviewQueue.updateReview(this.currentKanji.id, 5);
    } else {
      publish('playSE', 'wrong');
      // 正答リストを表示
      this.message = `不正解…正答: ${this.currentKanji.readings.join('、')}`;
      // 不正解の場合：品質1（間違えた）でSM-2アルゴリズムに記録
      ReviewQueue.updateReview(this.currentKanji.id, 1);
    }

    // 次の漢字へ or 終了
    setTimeout(() => {
      if (this.currentIndex < this.kanjiIds.length) {
        this.inputEl.value = '';
        this._loadCurrent();
      } else {
        this.inputEl.style.display = 'none';
        publish('changeScreen', 'stageSelect');
      }
    }, 1000);
  },

  /** 毎フレーム描画 */
  update(dt) {
    const { ctx, canvas } = this;
    // currentKanji が未設定であればスキップ
    if (!this.currentKanji) return;

    // 背景
    ctx.fillStyle = '#1e3c72';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // タイトル
    ctx.fillStyle = 'white';
    ctx.font      = '24px "UDデジタル教科書体",sans-serif';
    ctx.fillText('復習モード', 20, 50);

    // ステージ選択ボタン
    drawButton(ctx, 20, 20, 100, 30, 'ステージ選択');

    // 漢字ボックス
    const x = canvas.width/2, y = canvas.height/2;
    const w = 180, h = 180;
    ctx.strokeStyle = 'white';
    ctx.lineWidth   = 2;
    ctx.strokeRect(x - w/2, y - h/2, w, h);

    // 漢字本体
    ctx.fillStyle = 'white';
    ctx.font      = '100px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.currentKanji.kanji, x, y);

    // メッセージ
    ctx.font      = '20px "UDデジタル教科書体",sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(this.message, x, y + h/2 + 10);
  },

  /** exit: クリーンアップ */
  exit() {
    // 入力欄イベント解除
    this.inputEl?.removeEventListener('keydown', this._keydownHandler);
    if (this.inputEl) this.inputEl.style.display = 'none';
    // キャンバスクリック解除
    if (this.canvas && this._clickHandler) {
      this.canvas.removeEventListener('click', this._clickHandler);
    }
    this.canvas = this.ctx = this.inputEl = null;
  }
};

export default reviewStage;

// 追加: FSM 一貫化のため描画エントリポイントを alias
reviewStage.render = function() {
  this.update(0);
};
