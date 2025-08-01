// src/kanjiDex.js
// 漢字図鑑管理モジュール
// localStorage に Set<string> 形式で永続化
// 使用キー: 'krb_kanji_dex'

import DataSync from '../services/firebase/dataSync.js';

const STORAGE_KEY = 'krb_kanji_dex';

/**
 * 図鑑をロードして Set<string> で返却
 * localStorage にデータがなければ空の Set を返す
 * @returns {Set<string>}
 */
export function loadDex() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    // null/undefined を除外する
    const filtered = Array.isArray(arr) ? arr.filter(id => id != null) : [];
    const dexSet = new Set(filtered);
    
    // デバッグ用ログを追加
    console.log('【図鑑】データをロードしました。収集数:', dexSet.size);
    if (dexSet.size > 0) {
      console.log('【図鑑】収集済み漢字ID:', [...dexSet]);
    }
    
    return dexSet;
  } catch (e) {
    console.error('kanjiDex: 図鑑のロードに失敗しました', e);
    return new Set();
  }
}

/**
 * 図鑑の Set<string> を localStorage に保存
 * @param {Set<string>} dex
 */
export function saveDex(dex) {
  try {
    const dataToSave = [...dex];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    console.log('【図鑑】データを保存しました。収集数:', dex.size);
    DataSync.syncAll();
  } catch (e) {
    console.error('kanjiDex: 図鑑の保存に失敗しました', e);
  }
}

/**
 * 図鑑に漢字IDを追加して保存
 * すでに登録済みの場合は何もしない
 * @param {string} id  漢字の一意ID
 */
export function addKanji(id) {
  const dex = loadDex();
  if (!dex.has(id)) {
    dex.add(id);
    saveDex(dex);
    // デバッグ用ログを追加
    console.log('【図鑑】漢字を追加しました:', id);
    console.log('【図鑑】現在の収集数:', dex.size);
  } else {
    // 既に登録済みの場合もログ出力
    console.log('【図鑑】漢字は既に登録済みです:', id);
  }
}
