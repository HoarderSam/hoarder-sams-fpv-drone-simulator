import { defineConfig } from 'vite';

// relative base so the build works at any path (GitHub Pages serves this
// project at /hoarder-sams-fpv-drone-simulator/)
export default defineConfig({
  base: './',
});
