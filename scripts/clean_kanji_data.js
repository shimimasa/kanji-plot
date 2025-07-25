// clean_kanji_data.js

// ファイルシステムモジュールをインポート
const fs = require('fs');
const path = require('path');

// 削除するプロパティのリスト
const propertiesToRemove = [
  'hasMultipleRead',
  'correctCount',
  'incorrectCount',
  'accuracy',
  'weakness'
];

// ファイルパス
const filePath = path.join('public', 'data', 'kanji_g10_proto.json');
const outputPath = path.join('public', 'data', 'kanji_g10_cleaned.json');

// ファイルを読み込む
try {
  const data = fs.readFileSync(filePath, 'utf8');
  const jsonData = JSON.parse(data);
  
  // 各漢字オブジェクトから指定されたプロパティを削除
  const cleanedData = jsonData.map(kanji => {
    const newKanji = { ...kanji };
    propertiesToRemove.forEach(prop => {
      delete newKanji[prop];
    });
    return newKanji;
  });
  
  // 整形してJSONファイルに書き込む
  fs.writeFileSync(outputPath, JSON.stringify(cleanedData, null, 2), 'utf8');
  console.log(`処理が完了しました。結果は ${outputPath} に保存されています。`);
  
  // 元のファイルを上書きする場合はコメントを外してください
  // fs.writeFileSync(filePath, JSON.stringify(cleanedData, null, 2), 'utf8');
  // console.log(`${filePath} を更新しました。`);
} catch (error) {
  console.error('エラーが発生しました:', error);
}
