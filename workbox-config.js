module.exports = {
    globDirectory: "dist/", // ビルド後のファイルが出力されるディレクトリを指定
    globPatterns: ["**/*.{js,css,html,png,webp,mp3}"],
    swDest: "dist/sw.js", // 生成されるサービスワーカーファイルの出力先
    runtimeCaching: [
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|webp)$/,
        handler: "CacheFirst", // まずキャッシュを探し、なければネットワークから取得
        options: {
          cacheName: "images-cache",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30日間
          },
        },
      },
      {
        urlPattern: /\.(?:mp3)$/,
        handler: "StaleWhileRevalidate", // まずキャッシュを返し、裏でネットワークから最新版を取得
        options: {
          cacheName: "audio-cache",
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7日間
          },
        },
      },
    ],
  };