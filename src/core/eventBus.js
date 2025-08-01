// ESモジュールスタイルの最小限パブリッシュ・サブスクライブ EventBus

// 内部でイベント名→ハンドラ集合を管理するMap
const subscribers = new Map();

/**
 * イベントにハンドラを登録する
 * @param {string} event - イベント名
 * @param {(payload: any) => void} handler - イベント発行時に呼び出される関数
 */
export function subscribe(event, handler) {
  if (!subscribers.has(event)) {
    subscribers.set(event, new Set());
  }
  subscribers.get(event).add(handler);
}

/**
 * イベントを発行する
 * @param {string} event - イベント名
 * @param {any} [payload] - ハンドラに渡す任意のデータ
 */
export function publish(event, payload) {
  const handlers = subscribers.get(event);
  if (!handlers) return;
  for (const handler of handlers) {
    try {
      handler(payload);
    } catch (err) {
      // あるハンドラの例外が他に影響しないようにする
      console.error(`イベント "${event}" のハンドラでエラー発生:`, err);
    }
  }
}


// イベントハンドラを定義
function onPlayerMove(data) {
  console.log('プレイヤーが移動しました:', data);
}

// イベントを購読
subscribe('player:move', onPlayerMove);

// 後でイベントを発行
publish('player:move', { x: 10, y: 20 });