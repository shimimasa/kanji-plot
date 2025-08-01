// src/fsm.js
// ESモジュールスタイルのシンプル状態マシン（FSM）クラス

export class FSM {
  /**
   * @param {string} initialState - 初期状態名（自動遷移はしない）
   * @param {Object<string, { enter?: Function, update?: Function, exit?: Function }>} states
   */
  constructor(initialState, states) {
    this.states = states;
    this.currentState = null;
    // ※ 自動的な初期遷移は行わず、外部から changeScreen() によって明示的に遷移を呼び出す
  }

  /**
   * 状態を切り替える
   * @param {string} stateName - 遷移先状態名
   * @param  {...any} args    - enter() に渡す引数
   */
  change(stateName, ...args) {
    const next = this.states[stateName];
    if (!next) {
      throw new Error(`FSM: 状態 "${stateName}" が見つかりません`);
    }
    // 旧状態の exit()
    if (this.currentState?.exit) {
      this.currentState.exit();
    }
    // 新状態へ
    this.currentState = next;
    if (this.currentState.enter) {
      this.currentState.enter(...args);
    }
  }

  /**
   * 現在の状態を更新する
   * @param {number} dt - 経過時間など任意のパラメータ
   */
  update(dt) {
    if (this.currentState?.update) {
      this.currentState.update(dt);
    }
  }
}
