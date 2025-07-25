// reviewQueue.js
// localStorage に SM-2 用のレビューキューを永続化
// 格納データ例：{ id, repetition, interval, eFactor, nextReviewAt }

import DataSync from '../services/firebase/dataSync.js';

const reviewQueue = (() => {
  const STORAGE_KEY = 'krb_review_queue';
  /** @type {Array<{id:string, repetition:number, interval:number, eFactor:number, nextReviewAt:number}>} */
  let items = [];

  // ローカルストレージからロード
  const load = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      items = raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('ReviewQueue の読み込みに失敗しました:', e);
      items = [];
    }
  };

  // ストレージへ保存
  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('ReviewQueue の保存に失敗しました:', e);
    }
    DataSync.syncAll();
  };

  load();

  // SM-2 の EF 更新式
  const calcEF = (oldEF, quality) => {
    const q = Math.max(0, Math.min(5, quality));
    const newEF = oldEF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    return Math.max(1.3, newEF);
  };

  return {
    /**
     * 新規にキューへ登録。存在する場合はスキップ。
     * repetition=0, interval=0, eFactor=2.5, nextReviewAt=now で初期化
     */
    add(id) {
      if (items.some(i => i.id === id)) return;
      items.push({
        id,
        repetition: 0,
        interval:   0,
        eFactor:    2.5,
        nextReviewAt: Date.now()
      });
      save();
    },

    /**
     * SM-2 アルゴリズムで結果を登録
     * @param {string|number} id
     * @param {number} quality 0〜5 （0…完全忘却, 5…完全正解）
     */
    updateReview(id, quality) {
      const entry = items.find(i => i.id === id);
      if (!entry) return;
      if (quality < 3) {
        // 再出現を翌日に固定
        entry.repetition = 0;
        entry.interval   = 1;
      } else {
        entry.repetition++;
        if (entry.repetition === 1)      entry.interval = 1;
        else if (entry.repetition === 2) entry.interval = 6;
        else                             entry.interval = Math.round(entry.interval * entry.eFactor);
        entry.eFactor = calcEF(entry.eFactor, quality);
      }
      entry.nextReviewAt = Date.now() + entry.interval * 24 * 60 * 60 * 1000;
      save();
    },

    /**
     * 次回レビュー日時(now <= nextReviewAt) を経過している項目を取得
     * @returns Array<entry>
     */
    getDueReviews() {
      const now = Date.now();
      return items.filter(i =>
        i != null &&
        typeof i.nextReviewAt === 'number' &&
        i.nextReviewAt <= now
      );
    },

    /**
     * due なものから先頭 n 件の ID 配列を返し、キューから除去
     * @param {number} [n=5]
     * @returns {Array<string|number>}
     */
    popBatch(n = 5) {
      const due = this.getDueReviews().slice(0, n);
      due.forEach(d => {
        const idx = items.findIndex(i => i.id === d.id);
        if (idx >= 0) items.splice(idx, 1);
      });
      save();
      return due.map(d => d.id);
    },

    /** due 項目の数 */
    size() {
      return this.getDueReviews().length;
    }
  };
})();

export default reviewQueue;
