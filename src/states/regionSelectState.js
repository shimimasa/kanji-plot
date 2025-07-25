import { gameState } from '../core/gameState.js';
import { publish } from '../core/eventBus.js';
import { images } from '../loaders/assetsLoader.js';

// 全国8地方の定義（コードは画像キーに合わせる）
const regions = [
  { name: '北海道', code: 'hokkaido' },
  { name: '東北',   code: 'tohoku'   },
  { name: '関東',   code: 'kanto'    },
  { name: '中部',   code: 'chubu'    },
  { name: '近畿',   code: 'kinki'    },
  { name: '中国',   code: 'chugoku'  },
  { name: '四国',   code: 'shikoku'  },
  { name: '九州',   code: 'kyushu'   },
];

const regionSelectState = {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{grade?: number}} props
   */
  enter(canvas, props = {}) {
    // canvas 引数がない場合は DOM から取得
    this.canvas = canvas || document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');
    // grade を受け取って gameState にセット
    if (props.grade != null) {
      gameState.currentGrade = props.grade;
    }
    // region は未選択にリセット
    gameState.currentRegion = null;
    // カード位置を初期化
    this.cardRects = [];
    // イベント登録
    this._clickHandler = this.handleClick.bind(this);
    this.canvas.addEventListener('click', this._clickHandler);
    this._keyHandler = this.handleKeydown.bind(this);
    window.addEventListener('keydown', this._keyHandler);
  },

  /**
   * @param {number} dt
   */
  update(dt) {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // レイアウト設定
    const cols     = 4;
    const marginX  = 20;
    const marginY  = 20;
    const cardW    = (canvas.width - marginX * (cols + 1)) / cols;
    const cardH    = cardW * 0.7;  // 縦横比仮置き
    this.cardRects = [];

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.font         = '16px sans-serif';

    regions.forEach((region, idx) => {
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      const x = marginX + col * (cardW + marginX);
      const y = marginY + row * (cardH + 40 + marginY);

      // カード枠
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(x, y, cardW, cardH);

      // サムネイル（images.regionThumb_<code> を想定）
      const imgKey = `regionThumb_${region.code}`;
      const img = images[imgKey];
      if (img) {
        ctx.drawImage(img, x, y, cardW, cardH);
      }

      // 地方名
      ctx.fillStyle = '#000';
      ctx.fillText(region.name, x + cardW / 2, y + cardH + 8);

      // クリック判定用に保存
      this.cardRects.push({
        x, y, w: cardW, h: cardH,
        code: region.code
      });
    });
  },

  exit() {
    // イベント解除
    this.canvas.removeEventListener('click', this._clickHandler);
    window.removeEventListener('keydown', this._keyHandler);
    this.canvas    = null;
    this.ctx       = null;
    this.cardRects = [];
  },

  /**
   * クリック処理：カードが押されたら地方をセットして次画面へ
   * @param {MouseEvent} e
   */
  handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    for (const r of this.cardRects) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        gameState.currentRegion = r.code;
        publish('changeScreen', 'prefSelect');
        return;
      }
    }
  },

  /**
   * キー処理：ESC または BackSpace で一つ前の画面（gradeSelect）へ戻す
   * @param {KeyboardEvent} e
   */
  handleKeydown(e) {
    if (e.key === 'Escape' || e.key === 'Backspace') {
      publish('changeScreen', 'gradeSelect');
    }
  }
};

export default regionSelectState;
