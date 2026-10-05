// Builds the static edition into dist-static/ for GitHub Pages (`npm run build:static`). The full Cloudflare site
// keeps using vite.config.ts. Set PAPER_GIRL_BASE to serve from somewhere other than /paper-girl/.
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'static-site',
  base: process.env.PAPER_GIRL_BASE || '/paper-girl/',
  publicDir: '../public',
  define: {'import.meta.env.VITE_PAPER_GIRL_STATIC': JSON.stringify('1')},
  resolve: {alias: {'@': fileURLToPath(new URL('.', import.meta.url))}},
  plugins: [react()],
  build: {outDir: '../dist-static', emptyOutDir: true},
});
