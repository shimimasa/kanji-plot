// src/core/screenManager.js
// グローバル FSM への委譲ラッパーモジュール

import { subscribe } from './eventBus.js';

let canvas = null;

/**
 * <canvas> 要素を登録
 */
export function setCanvas(c) {
  canvas = c;
}

/**
 * changeScreen イベントをグローバル FSM の switchScreen に委譲
 * payload は
 *  - string           → name
 *  - { name, props }  → name, props
 *  - [name, props]    → array 解釈
 */
subscribe('changeScreen', payload => {
  if (Array.isArray(payload)) {
    window.switchScreen(payload[0], payload[1]);
  } else if (payload && typeof payload === 'object' && 'name' in payload) {
    window.switchScreen(payload.name, payload.props);
  } else {
    window.switchScreen(payload);
  }
});

/**
 * 毎フレーム呼び出すロジック更新
 * @param {number} dt
 */
export function update(dt) {
  if (window.fsm && typeof window.fsm.update === 'function') {
    window.fsm.update(dt);
  }
}

/**
 * 毎フレーム呼び出す描画
 * @param {Function} [battleDrawFn] battle 画面の場合のみ外部描画関数を注入
 */
export function render(battleDrawFn = null) {
  if (window.fsm && typeof window.fsm.render === 'function') {
    window.fsm.render(battleDrawFn);
  }
}
