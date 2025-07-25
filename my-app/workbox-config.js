module.exports = {
    globDirectory: 'dist/',
    globPatterns: [
      '**/*.{html,js,css,png,svg,json}'
    ],
    swDest: 'dist/sw.js',
    runtimeCaching: [
      {
        urlPattern: /.*/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'runtime-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 7 * 24 * 60 * 60  // 1 week
          }
        }
      }
    ]
  };

  