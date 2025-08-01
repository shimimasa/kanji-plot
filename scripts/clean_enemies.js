const fs = require('fs');
const path = require('path');

// ファイルパスを設定
const enemiesFilePath = path.join(__dirname, '..', 'src', 'data', 'enemies_proto.json');

console.log('🔧 敵データの重複除去処理を開始します...');

try {
  // 1. enemies_proto.jsonを読み込み
  console.log(`📂 ファイルを読み込み中: ${enemiesFilePath}`);
  const fileContent = fs.readFileSync(enemiesFilePath, 'utf-8');
  const enemiesData = JSON.parse(fileContent);
  
  console.log(`📊 処理前の敵データ件数: ${enemiesData.length}件`);
  
  // 2. IDをキーとしてMapオブジェクトに格納（重複除去）
  const enemiesMap = new Map();
  
  enemiesData.forEach(enemy => {
    if (enemy.id) {
      // 既に同じIDが存在する場合は上書きされる（最新のデータが残る）
      enemiesMap.set(enemy.id, enemy);
    } else {
      console.warn('⚠️ IDが存在しない敵データをスキップしました:', enemy);
    }
  });
  
  // 3. Mapの値を配列に変換
  const cleanedEnemiesData = Array.from(enemiesMap.values());
  
  console.log(`📊 処理後の敵データ件数: ${cleanedEnemiesData.length}件`);
  console.log(`🗑️ 除去された重複データ: ${enemiesData.length - cleanedEnemiesData.length}件`);
  
  // 4. 整形された配列をJSONファイルに書き戻し
  const jsonOutput = JSON.stringify(cleanedEnemiesData, null, 2);
  fs.writeFileSync(enemiesFilePath, jsonOutput, 'utf-8');
  
  console.log('✅ 敵データの重複除去処理が完了しました');
  console.log(`💾 更新されたファイル: ${enemiesFilePath}`);
  
  // 5. 重複があった場合の詳細情報
  if (enemiesData.length !== cleanedEnemiesData.length) {
    console.log('\n📋 重複除去の詳細:');
    console.log(`  - 元の件数: ${enemiesData.length}`);
    console.log(`  - 除去後件数: ${cleanedEnemiesData.length}`);
    console.log(`  - 重複除去数: ${enemiesData.length - cleanedEnemiesData.length}`);
  } else {
    console.log('ℹ️ 重複するIDは見つかりませんでした');
  }

} catch (error) {
  console.error('❌ 処理中にエラーが発生しました:', error.message);
  process.exit(1);
} 