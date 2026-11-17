// Builds the static edition into dist-static/ for GitHub Pages (`npm run build:static`). The full Cloudflare site
// keeps using vite.config.ts. Addresses are relative (base ./), so the site works at any address, such as
// findastra.github.io/papermon/ or a local preview. Set PAPERMON_BASE to use a fixed address instead.
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'static-site',
  base: process.env.PAPERMON_BASE || './',
  publicDir: '../public',
  define: {'import.meta.env.VITE_PAPERMON_STATIC': JSON.stringify('1')},
  resolve: {alias: {'@': fileURLToPath(new URL('.', import.meta.url))}},
  plugins: [react()],
  // [hash] changes whenever a file's content changes, so every release has new file names and browsers never keep
  // showing an old copy (2026-11-14: visitors saw the previous release after a merge because the names never changed).
  build: {outDir: '../dist-static', emptyOutDir: true, rollupOptions: {output: {entryFileNames:'assets/papermon-[hash]-20261019.js',chunkFileNames:'assets/[name]-[hash]-20261019.js',assetFileNames:'assets/[name]-[hash]-20261019[extname]'}}},
});
