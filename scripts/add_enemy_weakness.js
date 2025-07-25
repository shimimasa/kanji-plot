const fs = require('fs');
const path = require('path');

// ファイルパスを設定
const enemiesFilePath = path.join(__dirname, '..', 'src', 'data', 'enemies_proto.json');

console.log('🔧 敵データにweaknessプロパティを追加する処理を開始します...');

/**
 * ランダムにweaknessを選択する関数
 * @returns {string} "onyomi" または "kunyomi"
 */
function getRandomWeakness() {
  const weaknessTypes = ['onyomi', 'kunyomi'];
  return weaknessTypes[Math.floor(Math.random() * weaknessTypes.length)];
}

try {
  // 1. enemies_proto.jsonを読み込み
  console.log(`📂 ファイルを読み込み中: ${enemiesFilePath}`);
  const fileContent = fs.readFileSync(enemiesFilePath, 'utf-8');
  const enemiesData = JSON.parse(fileContent);
  
  console.log(`📊 処理前の敵データ件数: ${enemiesData.length}件`);
  
  // 2. 各敵にweaknessプロパティを追加
  let addedCount = 0;
  let skippedCount = 0;
  
  enemiesData.forEach((enemy, index) => {
    if (!enemy.id) {
      console.warn(`⚠️ インデックス${index}: IDが存在しない敵データをスキップしました`);
      skippedCount++;
      return;
    }
    
    // 既にweaknessプロパティが存在する場合はスキップ
    if (enemy.weakness) {
      console.log(`ℹ️ ${enemy.id}: 既にweaknessプロパティが存在します (${enemy.weakness})`);
      skippedCount++;
      return;
    }
    
    // ランダムなweaknessを追加
    const randomWeakness = getRandomWeakness();
    enemy.weakness = randomWeakness;
    addedCount++;
    
    console.log(`✅ ${enemy.id}: weakness = "${randomWeakness}" を追加`);
  });
  
  console.log(`\n📊 処理結果:`);
  console.log(`  ✅ weakness追加数: ${addedCount}件`);
  console.log(`  ⏭️ スキップ数: ${skippedCount}件`);
  console.log(`  📦 総件数: ${enemiesData.length}件`);
  
  // 3. 更新されたデータをJSONファイルに書き戻し
  const jsonOutput = JSON.stringify(enemiesData, null, 2);
  fs.writeFileSync(enemiesFilePath, jsonOutput, 'utf-8');
  
  console.log('\n✅ 敵データのweakness追加処理が完了しました');
  console.log(`💾 更新されたファイル: ${enemiesFilePath}`);
  
  // 4. weakness分布の表示
  if (addedCount > 0) {
    const onyomiCount = enemiesData.filter(e => e.weakness === 'onyomi').length;
    const kunyomiCount = enemiesData.filter(e => e.weakness === 'kunyomi').length;
    
    console.log('\n📈 weakness分布:');
    console.log(`  🎌 onyomi: ${onyomiCount}件`);
    console.log(`  🎋 kunyomi: ${kunyomiCount}件`);
  }

} catch (error) {
  console.error('❌ 処理中にエラーが発生しました:', error.message);
  
  if (error.code === 'ENOENT') {
    console.error('💡 ファイルが見つかりません。パスを確認してください。');
  } else if (error instanceof SyntaxError) {
    console.error('💡 JSONファイルの形式が正しくありません。');
  }
  
  process.exit(1);
} 