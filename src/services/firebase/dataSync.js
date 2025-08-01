// firebase は index.html の <script> で読み込まれる compat SDK を使用するので import 不要
// import firebase from 'firebase/compat/app';
// import 'firebase/compat/firestore';
import { getCurrentUser } from './firebaseController.js';

// コレクション名
const COLL = 'progress';

// Firestore を遅延取得するヘルパ
function getDb() {
  // Firebase App が初期化されていないときは null
  if (!firebase.apps?.length) {
    console.warn('DataSync: Firebase App is not initialized yet');
    return null;
  }
  return firebase.firestore();
}

// Firestore と localStorage のキー
const LS_KEYS = {
  kanjiDex:      'krb_kanji_dex',
  monsterDex:    'krb_monster_dex',
  reviewQueue:   'krb_review_queue'
};

const DataSync = {
  // Firestore のドキュメント参照
  _ref() {
    const user = getCurrentUser();
    if (!user) return null;
    const db = getDb();
    if (!db) return null;
    return db.collection('users').doc(user.uid).collection(COLL).doc('state');
  },

  // 初期化：Firestore から取得して localStorage に書き戻し
  async initialize() {
    const ref = this._ref();
    if (!ref) return;
    ref.onSnapshot(snap => {
      const data = snap.data() || {};
      Object.entries(LS_KEYS).forEach(([field, key]) => {
        if (data[field] !== undefined) {
          localStorage.setItem(key, JSON.stringify(data[field]));
        }
      });
    });
  },

  // localStorage の全データを Firestore にマージ保存
  async syncAll() {
    const ref = this._ref();
    if (!ref) return;
    const payload = {};
    Object.entries(LS_KEYS).forEach(([field, key]) => {
      const raw = localStorage.getItem(key);
      payload[field] = raw ? JSON.parse(raw) : null;
    });
    try {
      await ref.set(payload, { merge: true });
    } catch (e) {
      console.warn('DataSync.syncAll error:', e);
    }
  }
};

export default DataSync;