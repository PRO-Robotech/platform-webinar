import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: false,
  build: {
    // Keep fonts embedded so the exported HTML also works offline.
    assetsInlineLimit: Infinity,
    modulePreload: false,
    cssCodeSplit: false,
    sourcemap: false,
  },
});
