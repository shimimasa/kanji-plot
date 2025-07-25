// js/dataLoader.js

export let stageData = [];
let enemyData = [];
export let kanjiData = [];
let stageKanjiMap = {};

export async function loadAllGameData() {
  try {
    console.log("外部JSONファイルの読み込みを開始します...");

    // 複数学年の漢字データをまとめて読み込む
    const grades = [1, 2, 3, 4, 5, 6];
    const kanjiPromises = grades.map(n =>
      fetch(`/data/kanji_g${n}_proto.json`).then(r => {
        if (!r.ok) throw new Error(`漢字データ g${n} の読み込みに失敗: ${r.statusText}`);
        return r.json();
      })
    );
    const kanjiArrays = await Promise.all(kanjiPromises);
    kanjiData = kanjiArrays.flat().map(k => ({
      ...k,
      incorrectCount: k.incorrectCount ?? 0
    }));
    console.log("漢字データ読み込み完了");

    // 敵データ読み込み
    const enemyPath = '/data/enemies_proto.json';
    const enemyResponse = await fetch(enemyPath);
    if (!enemyResponse.ok) throw new Error(`敵データの読み込みに失敗: ${enemyResponse.statusText}`);
    enemyData = await enemyResponse.json();
    console.log("敵データ読み込み完了");

    // ステージデータ読み込み
    const stagePath = '/data/stages_proto.json';
    const stageResponse = await fetch(stagePath);
    if (!stageResponse.ok) throw new Error(`ステージデータの読み込みに失敗: ${stageResponse.statusText}`);
    stageData = await stageResponse.json();
    console.log("ステージデータ読み込み完了");

    // 🔽 正しいマッピング処理（stageIdごとにグループ化）
    const kanjiMap = {};
    for (const k of kanjiData) {
      const sid = k.stageId;
      if (!kanjiMap[sid]) kanjiMap[sid] = [];
      kanjiMap[sid].push(k);
    }
    setStageKanjiMap(kanjiMap);

    return { kanjiData, enemyData, stageData };
  } catch (error) {
    console.error("ゲームデータの読み込み中にエラーが発生しました:", error);
    return null;
  }
}


export function getEnemiesByStageId(stageId) {
  const stage = stageData.find(s => s.stageId === stageId);
  if (!stage || !stage.enemyIdList) return [];
  
  // IDリストに基づいて敵データをフィルタリング
  let enemies = enemyData.filter(e => stage.enemyIdList.includes(e.id));
  
  // 敵が見つからない場合、IDの接頭辞マッピングを試す
  if (enemies.length === 0) {
    console.warn(`⚠️ ステージ ${stageId} の敵が見つかりません。IDマッピングを試みます。`);
    
    // ステージIDから地域を判断
    const regionMapping = {
      'tohoku_area1': 'AOM',   // 青森
      'tohoku_area2': 'IWT',   // 岩手
      'tohoku_area3': 'AKT',   // 秋田
      'tohoku_area4': 'MYG',   // 宮城
      'tohoku_area5': 'YMG',   // 山形
      'tohoku_area6': 'HKS',   // 福島
      'kanto_area1': 'TOC',    // 栃木
      'kanto_area2': 'GNM',    // 群馬
      'kanto_area3': 'IBK',    // 茨城
      'kanto_area4': 'SIT',    // 埼玉
      'kanto_area5': 'TB',     // 千葉
      'kanto_area6': 'TKY',    // 東京
      'kanto_area7': 'KNG',    // 神奈川
      'chubu_area1': 'NGT',    // 新潟
      'chubu_area2': 'TYM',    // 富山
      'chubu_area3': 'ISK',    // 石川
      'chubu_area4': 'HKI',    // 福井
      'chubu_area5': 'NGN',    // 長野
      'chubu_area6': 'GF',     // 岐阜
      'kinki_area1': 'ME',    // 三重
      'kinki_area2': 'SG',    // 滋賀
      'kinki_area3': 'OSK',    // 大阪
      'kinki_area4': 'KYT',    // 京都
      'kinki_area5': 'HYG',    // 兵庫
      'kinki_area6': 'NR',    // 奈良
      'kinki_area7': 'WKY',   // 和歌山
      'chuugoku_area1': 'TTR',    // 鳥取
      'chuugoku_area2': 'OKY',    // 岡山
      'chuugoku_area3': 'SMN',    // 島根
      'chuugoku_area4': 'HRS',    // 広島
      'chuugoku_area5': 'YMGC',    // 山口
    };
    
    const prefCode = regionMapping[stageId];
    if (prefCode) {
      // 該当する都道府県コードの敵を検索
      enemies = enemyData.filter(e => e.id.startsWith(prefCode));
      console.log(`${prefCode} で始まる敵を ${enemies.length} 件見つけました。`);
    }
  }
  
  // それでも見つからない場合は、北海道の敵を代替として使用
  if (enemies.length === 0) {
    console.warn('代替として北海道の敵を使用します。');
    enemies = enemyData.filter(e => e.id.startsWith('HKD-E')).slice(0, 10);
  }
  
  return enemies;
}

export function setStageKanjiMap(map) {
  stageKanjiMap = map;
}

export function getKanjiByStageId(stageId) {
  // ステージIDの正規化（chubu_area1 → chuubu_area1 のような違いを吸収）
  const normalizedStageId = stageId
    .replace('chubu_area', 'chuubu_area')
    .replace('kanto_area', 'kantou_area');
  
  if (!stageKanjiMap || !stageKanjiMap[normalizedStageId]) {
    console.warn(`stageKanjiMap[${stageId}] が見つかりません。正規化されたID: ${normalizedStageId}`);
    
    // 学年に基づいた漢字データを返す代替処理
    const stage = stageData.find(s => s.stageId === stageId);
    if (stage && stage.grade) {
      const gradeKanji = kanjiData.filter(k => k.grade === stage.grade);
      console.log(`代替として学年${stage.grade}の漢字 ${gradeKanji.length}件を使用します。`);
      return gradeKanji.slice(0, 50); // 最大50件に制限
    }
    
    return [];
  }
  return stageKanjiMap[normalizedStageId];
}

// 追加: ID から単一の漢字データを取得するヘルパ関数
export function getKanjiById(id) {
  const k = kanjiData.find(item => item.id === id);
  if (!k) {
    console.warn(`kanjiData に ID=${id} のデータが見つかりません`);
    return null;
  }
  return k;
}

// 以下を追加：monsterDexScreen.js からインポートする getMonsterById / getAllMonsterIds
/**
 * 敵データ（モンスター）を ID から取得
 * @param {number|string} id
 * @returns {object|null}
 */
export function getMonsterById(id) {
  const m = enemyData.find(item => item.id === id);
  if (!m) {
    console.warn(`enemyData に ID=${id} のデータが見つかりません`);
    return null;
  }
  return m;
}

/**
 * 全モンスターの ID リストを返却
 * @returns {Array<number|string>}
 */
export function getAllMonsterIds() {
  return enemyData.map(item => item.id);
}


