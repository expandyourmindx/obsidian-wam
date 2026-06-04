import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/obsidian-wam/',
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'ObsidianWAM',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
    minify: false,
  },
});
