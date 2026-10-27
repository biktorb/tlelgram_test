import { defineConfig } from 'vite';

// Relative base so the build works from any path (GitHub Pages, Telegram).
// Two pages: the current game and «Коты против пылесосов» while it is built.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    rollupOptions: { input: { main: 'index.html', cats: 'cats.html' } },
  },
});
