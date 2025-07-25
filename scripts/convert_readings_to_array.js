// convert_readings_to_array.js

// ファイルシステムモジュールをインポート
const fs = require('fs');
const path = require('path');

// ファイルパス
const filePath = path.join('public', 'data', 'kanji_g10_proto.json');
const outputPath = path.join('public', 'data', 'kanji_g10_array_readings.json');

// 文字列を配列に変換する関数
function convertToArray(readingStr) {
  // 空文字列の場合は空配列を返す
  if (!readingStr || readingStr === "") {
    return [];
  }
  
  // スペースで区切って配列に変換
  return readingStr.split(' ').filter(item => item.length > 0);
}

// ファイルを読み込む
try {
  const data = fs.readFileSync(filePath, 'utf8');
  const jsonData = JSON.parse(data);
  
  // 各漢字オブジェクトのonyomiとkunyomiを配列に変換
  const convertedData = jsonData.map(kanji => {
    const newKanji = { ...kanji };
    
    // onyomiを配列に変換
    newKanji.onyomi = convertToArray(kanji.onyomi);
    
    // kunyomiを配列に変換
    newKanji.kunyomi = convertToArray(kanji.kunyomi);
    
    return newKanji;
  });
  
  // 整形してJSONファイルに書き込む
  fs.writeFileSync(outputPath, JSON.stringify(convertedData, null, 2), 'utf8');
  console.log(`処理が完了しました。結果は ${outputPath} に保存されています。`);
  
  // 元のファイルを上書きする場合はコメントを外してください
  // fs.writeFileSync(filePath, JSON.stringify(convertedData, null, 2), 'utf8');
  // console.log(`${filePath} を更新しました。`);
} catch (error) {
  console.error('エラーが発生しました:', error);
}
