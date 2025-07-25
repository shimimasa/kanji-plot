// process-images.js
const fs     = require('fs');
const path   = require('path');
const mkdirp = require('mkdirp');
const tinify = require('tinify');

// TinyPNG SDK にキーをセット
tinify.key = process.env.TINYPNG_API_KEY || "CvXw9ZsCJcs66Ns04VySFH5qfWk20hG4";

const SRC_DIR   = path.resolve(__dirname, 'src_images');
const COMP_DIR  = path.resolve(__dirname, 'compressed');
const OUT_FULL  = path.resolve(__dirname, 'output/full');
const OUT_THUMB = path.resolve(__dirname, 'output/thumb');

async function run() {
  [COMP_DIR, OUT_FULL, OUT_THUMB].forEach(d => mkdirp.sync(d));

  // 1) TinyPNG で圧縮
  console.log('→ TinyPNG で圧縮中…');
  const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.png'));
  for (const file of files) {
    const source = tinify.fromFile(path.join(SRC_DIR, file));
    await source.toFile(path.join(COMP_DIR, file));
  }

  // 2) Sharp でリサイズ＋WebP変換
  console.log('→ Sharp でリサイズ＆WebP変換中…');
  const sharp = require('sharp');
  for (const file of files) {
    const name   = path.parse(file).name;
    const inPath = path.join(COMP_DIR, file);

    await sharp(inPath).resize({ width: 512 }).webp({ quality: 80 }).toFile(path.join(OUT_FULL, name + '.webp'));
    await sharp(inPath).resize({ width: 128 }).webp({ quality: 80 }).toFile(path.join(OUT_THUMB, name + '.webp'));
  }

  console.log('✅ 完了！');
}

run().catch(console.error);