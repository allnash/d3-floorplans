import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Embeddable build: one self-contained script that exposes `window.Floorplan`.
// D3 modules and motion are bundled in; no React.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'Floorplan',
      formats: ['iife'],
      fileName: () => 'd3-floorplan.iife.js',
      cssFileName: 'd3-floorplan',
    },
    rollupOptions: {
      output: { extend: true },
    },
  },
});
