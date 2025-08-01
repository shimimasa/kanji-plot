const fs = require('fs').promises;
const path = require('path');

// ファイルパスを設定
const dataDir = path.join(__dirname, '..', 'src', 'data');
const stagesFilePath = path.join(dataDir, 'stages_proto.json');

console.log('🔧 漢字データのstageID自動割り当て処理を開始します...');

async function assignStageIds() {
  try {
    // 1. stages_proto.jsonを読み込み
    console.log('📂 ステージデータを読み込み中...');
    const stagesContent = await fs.readFile(stagesFilePath, 'utf-8');
    const stagesData = JSON.parse(stagesContent);
    
    // 2. 漢字データファイルを非同期で読み込み
    console.log('📂 漢字データを読み込み中...');
    const grades = [1, 2, 3, 4, 5, 6];
    const kanjiDataByGrade = {};
    
    const loadPromises = grades.map(async (grade) => {
      const filePath = path.join(dataDir, `kanji_g${grade}_proto.json`);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        kanjiDataByGrade[grade] = JSON.parse(content);
        console.log(`  ✅ kanji_g${grade}_proto.json 読み込み完了: ${kanjiDataByGrade[grade].length}件`);
      } catch (error) {
        console.warn(`  ⚠️ kanji_g${grade}_proto.json の読み込みに失敗: ${error.message}`);
        kanjiDataByGrade[grade] = [];
      }
    });
    
    await Promise.all(loadPromises);
    
    // 3. kanjiPoolIdListを基に逆引きマップを作成
    console.log('🗺️ 漢字ID→ステージIDの逆引きマップを作成中...');
    const kanjiIdToStageIdMap = new Map();
    
    stagesData.forEach(stage => {
      if (stage.kanjiPoolIdList && Array.isArray(stage.kanjiPoolIdList)) {
        stage.kanjiPoolIdList.forEach(kanjiId => {
          kanjiIdToStageIdMap.set(kanjiId, stage.stageId);
        });
      }
    });
    
    console.log(`  📊 マップ作成完了: ${kanjiIdToStageIdMap.size}件の漢字ID→ステージID関連付け`);
    
    // 4. 各学年の漢字データを処理
    let totalUpdated = 0;
    const missingKanjiIds = [];
    
    for (const grade of grades) {
      console.log(`\n📝 学年${grade}の漢字データを処理中...`);
      const kanjiData = kanjiDataByGrade[grade];
      let gradeUpdated = 0;
      
      kanjiData.forEach(kanji => {
        // stageIdプロパティが存在しない場合
        if (!kanji.stageId) {
          // マップから対応するstageIdを検索
          if (kanjiIdToStageIdMap.has(kanji.id)) {
            kanji.stageId = kanjiIdToStageIdMap.get(kanji.id);
            gradeUpdated++;
            totalUpdated++;
          } else {
            // マップにも存在しない場合は警告
            missingKanjiIds.push(kanji.id);
          }
        }
      });
      
      console.log(`  ✅ 学年${grade}: ${gradeUpdated}件のstageIdを設定`);
      
      // 5. 更新されたデータをファイルに書き戻し
      if (gradeUpdated > 0) {
        const filePath = path.join(dataDir, `kanji_g${grade}_proto.json`);
        const jsonOutput = JSON.stringify(kanjiData, null, 2);
        await fs.writeFile(filePath, jsonOutput, 'utf-8');
        console.log(`  💾 kanji_g${grade}_proto.json を更新しました`);
      }
    }
    
    // 6. 処理結果の表示
    console.log('\n📊 処理結果:');
    console.log(`  ✅ 総更新件数: ${totalUpdated}件`);
    
    if (missingKanjiIds.length > 0) {
      console.log(`  ⚠️ ステージIDが見つからない漢字ID: ${missingKanjiIds.length}件`);
      console.log('     対象ID:', missingKanjiIds.slice(0, 10).join(', '));
      if (missingKanjiIds.length > 10) {
        console.log(`     (他${missingKanjiIds.length - 10}件...)`);
      }
    } else {
      console.log('  ✅ 全ての漢字IDに対応するステージIDが見つかりました');
    }
    
    console.log('\n🎉 漢字データのstageID自動割り当て処理が完了しました！');
    
  } catch (error) {
    console.error('❌ 処理中にエラーが発生しました:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// メイン処理を実行
assignStageIds(); 