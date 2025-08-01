#!/usr/bin/env node
/**
 * 画像最適化ツール
 * Sharp を使って指定ディレクトリ内の画像を 128px 幅と 512px 幅の WebP に変換して出力します
 * 使用法: node tools/optimizeImages.js <入力ディレクトリ> <出力ディレクトリ>
 * 必要: npm install sharp
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// コマンドライン引数からディレクトリを取得
const [,, inputDir = 'assets/images', outputDir = 'assets/images/webp'] = process.argv;

// 出力ディレクトリが存在しなければ作成
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 対応する拡張子
const exts = ['.jpg', '.jpeg', '.png'];

fs.readdirSync(inputDir).forEach(file => {
  const ext = path.extname(file).toLowerCase();
  if (!exts.includes(ext)) return;
  const name = path.basename(file, ext);
  const inputPath = path.join(inputDir, file);

  // 128px 幅バリアント
  const out128 = path.join(outputDir, `${name}-128.webp`);
  sharp(inputPath)
    .resize({ width: 128 })
    .toFormat('webp')
    .toFile(out128)
    .then(() => console.log(`出力: ${out128}`))
    .catch(err => console.error(err));

  // 512px 幅バリアント
  const out512 = path.join(outputDir, `${name}-512.webp`);
  sharp(inputPath)
    .resize({ width: 512 })
    .toFormat('webp')
    .toFile(out512)
    .then(() => console.log(`出力: ${out512}`))
    .catch(err => console.error(err));
}); 