import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Demo site / React example. Aliases the package to local source so the demo
// always runs against the working tree.
export default defineConfig({
  root: resolve(import.meta.dirname),
  base: process.env.DEMO_BASE ?? '/',
  publicDir: resolve(import.meta.dirname, '../../assets'),
  plugins: [react()],
  resolve: {
    alias: {
      'd3-floorplan/react': resolve(import.meta.dirname, '../../src/react/index.ts'),
      'd3-floorplan/style.css': resolve(import.meta.dirname, '../../src/styles/floorplan.css'),
      'd3-floorplan': resolve(import.meta.dirname, '../../src/index.ts'),
    },
  },
  server: { port: 5173, open: false },
  build: { outDir: resolve(import.meta.dirname, '../../site'), emptyOutDir: true },
});
