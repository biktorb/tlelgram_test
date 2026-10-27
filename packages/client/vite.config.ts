import { defineConfig } from 'vite';

// Relative base so the build works from any path (GitHub Pages, Telegram).
export default defineConfig({
  base: './',
  build: { target: 'es2020' },
});
