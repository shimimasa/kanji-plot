// src/monsterDex.js
// モンスターデックス管理モジュール
// localStorage に Set<string> 形式で永続化
// 使用キー: 'krb_monster_dex', 'krb_seen_monsters'

import DataSync from '../services/firebase/dataSync.js';

const STORAGE_KEY = 'krb_monster_dex';
const SEEN_STORAGE_KEY = 'krb_seen_monsters';

/**
 * 図鑑をロードして Set<string> を返却
 * localStorage にデータがなければ空の Set を返す
 * @returns {Set<string>}
 */
export function loadDex() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return new Set();
    // string 型のみを抽出
    const strings = arr.filter(id => typeof id === 'string');
    return new Set(strings);
  } catch (e) {
    console.error('monsterDex: 図鑑のロードに失敗しました', e);
    return new Set();
  }
}

/**
 * 確認済みモンスターセットをロードして Set<string> を返却
 * @returns {Set<string>}
 */
export function loadSeenMonsters() {
  try {
    const raw = localStorage.getItem(SEEN_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return new Set();
    const strings = arr.filter(id => typeof id === 'string');
    return new Set(strings);
  } catch (e) {
    console.error('monsterDex: 確認済みモンスターのロードに失敗しました', e);
    return new Set();
  }
}

/**
 * 図鑑の Set<string> を localStorage に保存
 * @param {Set<string>} dex
 */
export function saveDex(dex) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...dex]));
    DataSync.syncAll();
  } catch (e) {
    console.error('monsterDex: 図鑑の保存に失敗しました', e);
  }
}

/**
 * 確認済みモンスターセットを localStorage に保存
 * @param {Set<string>} seenSet
 */
export function saveSeenMonsters(seenSet) {
  try {
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify([...seenSet]));
    DataSync.syncAll();
  } catch (e) {
    console.error('monsterDex: 確認済みモンスターの保存に失敗しました', e);
  }
}

/**
 * 図鑑にモンスターIDを追加して保存
 * すでに登録済みの場合は何もしない
 * @param {string} id モンスターの一意ID
 */
export function addMonster(id) {
  const dex = loadDex();
  if (!dex.has(id)) {
    dex.add(id);
    saveDex(dex);
  }
}

/**
 * モンスターを「確認済み」として記録
 * @param {string} id モンスターの一意ID
 */
export function markAsSeen(id) {
  const seenSet = loadSeenMonsters();
  if (!seenSet.has(id)) {
    seenSet.add(id);
    saveSeenMonsters(seenSet);
  }
}

/**
 * モンスターが「NEW」（捕獲済みだが未確認）かどうかを判定
 * @param {string} id モンスターの一意ID
 * @returns {boolean}
 */
export function isNewMonster(id) {
  const dex = loadDex();
  const seenSet = loadSeenMonsters();
  return dex.has(id) && !seenSet.has(id);
}
