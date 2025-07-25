const fs = require('fs');
const path = require('path');

// プロジェクトルートとdistフォルダのパスを設定
const projectRoot = path.join(__dirname, '..');
const distPath = path.join(projectRoot, 'dist');

console.log('📁 ファイルコピー処理を開始します...');

/**
 * ディレクトリを再帰的にコピーする関数
 * @param {string} src コピー元パス
 * @param {string} dest コピー先パス
 */
function copyDirectory(src, dest) {
  try {
    // コピー先ディレクトリが存在しない場合は作成
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    // Node.js 16.7.0以降でfs.cpSyncが利用可能な場合
    if (fs.cpSync) {
      fs.cpSync(src, dest, { 
        recursive: true,
        force: true,
        preserveTimestamps: true
      });
      console.log(`✅ ディレクトリをコピーしました: ${path.basename(src)} -> dist/`);
    } else {
      // 古いNode.jsバージョン用のフォールバック
      copyDirectoryRecursive(src, dest);
      console.log(`✅ ディレクトリをコピーしました: ${path.basename(src)} -> dist/`);
    }
  } catch (error) {
    console.error(`❌ ディレクトリのコピーに失敗: ${src}`, error.message);
  }
}

/**
 * 再帰的ディレクトリコピー（古いNode.jsバージョン用）
 * @param {string} src コピー元パス
 * @param {string} dest コピー先パス
 */
function copyDirectoryRecursive(src, dest) {
  const stats = fs.statSync(src);
  
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const files = fs.readdirSync(src);
    files.forEach(file => {
      const srcFile = path.join(src, file);
      const destFile = path.join(dest, file);
      copyDirectoryRecursive(srcFile, destFile);
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

/**
 * 単一ファイルをコピーする関数
 * @param {string} filename ファイル名
 */
function copyFile(filename) {
  const srcFile = path.join(projectRoot, filename);
  const destFile = path.join(distPath, filename);
  
  try {
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, destFile);
      console.log(`✅ ファイルをコピーしました: ${filename}`);
    } else {
      console.warn(`⚠️ ファイルが見つかりません: ${filename}`);
    }
  } catch (error) {
    console.error(`❌ ファイルのコピーに失敗: ${filename}`, error.message);
  }
}

async function main() {
  try {
    // 1. distフォルダを作成（存在しない場合）
    console.log('📂 distフォルダを準備中...');
    if (!fs.existsSync(distPath)) {
      fs.mkdirSync(distPath, { recursive: true });
      console.log('✅ distフォルダを作成しました');
    } else {
      console.log('📂 distフォルダは既に存在します');
    }

    // 2. フォルダをコピー
    const foldersToConst = ['src', 'assets', 'data'];
    console.log('\n📁 フォルダのコピーを開始...');
    
    for (const folder of foldersToConst) {
      const srcFolder = path.join(projectRoot, folder);
      const destFolder = path.join(distPath, folder);
      
      if (fs.existsSync(srcFolder)) {
        copyDirectory(srcFolder, destFolder);
      } else {
        console.warn(`⚠️ フォルダが見つかりません: ${folder}`);
      }
    }

    // 3. 個別ファイルをコピー
    const filesToCopy = ['index.html', 'style.css', 'manifest.json'];
    console.log('\n📄 個別ファイルのコピーを開始...');
    
    for (const file of filesToCopy) {
      copyFile(file);
    }

    console.log('\n🎉 ファイルコピー処理が完了しました！');
    
  } catch (error) {
    console.error('❌ コピー処理中にエラーが発生しました:', error.message);
    process.exit(1);
  }
}

// スクリプトを実行
main(); 