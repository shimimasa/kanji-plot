const fs = require('fs');
const path = require('path');

// ファイルパスの定義
const ENEMIES_PATH = path.join(__dirname, '../src/data/enemies_proto.json');
const STAGES_PATH = path.join(__dirname, '../src/data/stages_proto.json');

/**
 * JSONファイルを読み込む
 * @param {string} filePath ファイルパス
 * @returns {Object} パースされたJSONオブジェクト
 */
function loadJsonFile(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`ファイル読み込みエラー: ${filePath}`, error);
        process.exit(1);
    }
}

/**
 * JSONファイルに書き出す
 * @param {string} filePath ファイルパス
 * @param {Object} data 書き出すデータ
 */
function saveJsonFile(filePath, data) {
    try {
        const jsonString = JSON.stringify(data, null, 2);
        fs.writeFileSync(filePath, jsonString, 'utf8');
        console.log(`ファイル書き出し完了: ${filePath}`);
    } catch (error) {
        console.error(`ファイル書き出しエラー: ${filePath}`, error);
        process.exit(1);
    }
}

/**
 * 指定されたレベルに到達するために必要な経験値を計算する（再帰関数）
 * @param {number} level 計算したいレベル（1以上の整数）
 * @returns {number} そのレベルに到達するための必要経験値
 */
function calculateExpForLevel(level) {
    // 入力値の検証
    if (!Number.isInteger(level) || level < 1) {
        throw new Error('レベルは1以上の整数である必要があります');
    }
    
    // ベースケース: レベル1の必要経験値は100
    if (level === 1) {
        return 100;
    }
    
    // 再帰ケース: レベルLからL+1になるための必要経験値
    // Math.floor(（レベルL-1の必要経験値） * 1.2) + 20
    const previousLevelExp = calculateExpForLevel(level - 1);
    return Math.floor(previousLevelExp * 1.2) + 20;
}

/**
 * レベル1からN までの経験値テーブルを生成する
 * @param {number} maxLevel 最大レベル
 * @returns {Array} 経験値テーブル配列
 */
function generateExpTable(maxLevel) {
    const expTable = [];
    for (let level = 1; level <= maxLevel; level++) {
        expTable.push({
            level: level,
            requiredExp: calculateExpForLevel(level)
        });
    }
    return expTable;
}

/**
 * ステージインデックスに基づいて推奨レベルを計算する
 * @param {number} stageIndex ステージのインデックス（0ベース）
 * @returns {number} 推奨レベル
 */
function calculateRecommendedLevel(stageIndex) {
    // パターン1: 緩やかな上昇 (1, 2, 3, 3, 4, 5, 5, 6, 7, 7...)
    if (stageIndex === 0) return 1;
    return Math.floor((stageIndex + 1) / 1.5) + 1;
    
    // パターン2: より緩やかな上昇 (1, 1, 2, 2, 3, 3, 4, 4...)
    // return Math.floor(stageIndex / 2) + 1;
    
    // パターン3: 段階的上昇 (1-3: レベル1, 4-6: レベル2, 7-9: レベル3...)
    // return Math.floor(stageIndex / 3) + 1;
    
    // パターン4: シンプルな線形上昇 (1, 2, 3, 4, 5...)
    // return stageIndex + 1;
}

/**
 * ステージとエネミーデータを連携して処理する
 * @param {Array} stages ステージデータ配列
 * @param {Array} enemies エネミーデータ配列
 * @returns {Object} 処理後のステージとエネミーデータ
 */
function processGameBalance(stages, enemies) {
    console.log('ゲームバランス調整処理開始');
    
    // エネミーデータをIDでマップ化（高速検索用）
    const enemyMap = new Map();
    enemies.forEach(enemy => {
        enemyMap.set(enemy.id, enemy);
    });
    
    // ステージデータを処理
    const processedStages = stages.map((stage, stageIndex) => {
        const recommendedLevel = calculateRecommendedLevel(stageIndex);
        const requiredExp = calculateExpForLevel(recommendedLevel);
        
        console.log(`\nステージ${stageIndex + 1} (ID: ${stage.id || 'N/A'}): 推奨レベル ${recommendedLevel}`);
        console.log(`必要経験値: ${requiredExp}`);
        
        // ステージ内の敵リストを処理
        if (stage.enemyIdList && Array.isArray(stage.enemyIdList)) {
            stage.enemyIdList.forEach((enemyId, enemyIndex) => {
                const enemy = enemyMap.get(enemyId);
                if (!enemy) {
                    console.warn(`エネミーID "${enemyId}" が見つかりません`);
                    return;
                }
                
                // 基本ステータス計算
                let exp = Math.round(requiredExp / 10);
                let maxHp = Math.round((recommendedLevel * 10) + ((stageIndex + 1) * 5));
                let atk = Math.round(recommendedLevel * 2.5);
                
                // 中ボス判定（enemyIdListの10番目、インデックス9）
                const isMidBoss = enemyIndex === 9;
                if (isMidBoss) {
                    maxHp = Math.round(maxHp * 1.5);
                    atk = Math.round(atk * 1.5);
                    exp = Math.round(exp * 2);
                    console.log(`  ${enemy.name} [中ボス]: HP=${maxHp}, ATK=${atk}, EXP=${exp}`);
                } else {
                    console.log(`  ${enemy.name}: HP=${maxHp}, ATK=${atk}, EXP=${exp}`);
                }
                
                // エネミーデータを更新
                enemy.maxHp = maxHp;
                enemy.atk = atk;
                enemy.exp = exp;
                enemy.level = recommendedLevel; // レベルも設定
            });
        }
        
        // ステージデータを更新
        return {
            ...stage,
            recommendedLevel: recommendedLevel
        };
    });
    
    console.log('\nゲームバランス調整処理完了');
    return {
        stages: processedStages,
        enemies: Array.from(enemyMap.values())
    };
}

/**
 * エネミーデータの処理
 * @param {Array} enemies エネミーデータ配列
 * @returns {Array} 処理後のエネミーデータ配列
 */
function processEnemies(enemies) {
    console.log(`エネミーデータ処理開始: ${enemies.length}件`);
    
    const processedEnemies = enemies.map(enemy => {
        // 個別のエネミー調整がある場合はここに実装
        return enemy;
    });
    
    console.log('エネミーデータ処理完了');
    return processedEnemies;
}

/**
 * ステージデータの処理
 * @param {Array} stages ステージデータ配列
 * @returns {Array} 処理後のステージデータ配列
 */
function processStages(stages) {
    console.log(`ステージデータ処理開始: ${stages.length}件`);
    
    const processedStages = stages.map((stage, index) => {
        const recommendedLevel = calculateRecommendedLevel(index);
        
        // ステージデータを更新
        const updatedStage = {
            ...stage,
            recommendedLevel: recommendedLevel
        };
        
        console.log(`ステージ${index + 1} (ID: ${stage.id || 'N/A'}): 推奨レベル ${recommendedLevel} に設定`);
        
        return updatedStage;
    });
    
    console.log('ステージデータ処理完了');
    return processedStages;
}

/**
 * メイン処理
 */
function main() {
    console.log('ゲームデータバランス調整開始');
    
    // 経験値テーブルの生成例（レベル1-10）
    console.log('経験値テーブル生成中...');
    const expTable = generateExpTable(10);
    console.log('レベル1-10の経験値テーブル:');
    expTable.forEach(({ level, requiredExp }) => {
        console.log(`レベル${level}: ${requiredExp}経験値`);
    });
    
    // ファイル読み込み
    console.log('\nデータファイル読み込み中...');
    const enemies = loadJsonFile(ENEMIES_PATH);
    const stages = loadJsonFile(STAGES_PATH);
    
    // ゲームバランス調整処理
    const { stages: processedStages, enemies: processedEnemies } = processGameBalance(stages, enemies);
    
    // ファイル書き出し
    console.log('\n処理済みデータを書き出し中...');
    saveJsonFile(ENEMIES_PATH, processedEnemies);
    saveJsonFile(STAGES_PATH, processedStages);
    
    console.log('ゲームデータバランス調整完了');
}

// スクリプト実行
if (require.main === module) {
    main();
}

module.exports = {
    loadJsonFile,
    saveJsonFile,
    processEnemies,
    processStages,
    calculateExpForLevel,
    generateExpTable,
    calculateRecommendedLevel,
    processGameBalance
};
