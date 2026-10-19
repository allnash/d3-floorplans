import { defineConfig } from 'vitest/config';
import dts from 'vite-plugin-dts';
import { resolve } from 'node:path';

// Library build: ESM core + ESM React entry, with d3/motion/react kept external.
export default defineConfig({
  plugins: [
    dts({
      include: ['src'],
      tsconfigPath: './tsconfig.json',
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    cssCodeSplit: false,
    lib: {
      entry: {
        'd3-floorplan': resolve(import.meta.dirname, 'src/index.ts'),
        react: resolve(import.meta.dirname, 'src/react/index.ts'),
      },
      formats: ['es'],
      cssFileName: 'd3-floorplan',
    },
    rollupOptions: {
      output: { chunkFileNames: 'chunks/[name]-[hash].js' },
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'd3-selection',
        'd3-drag',
        'd3-zoom',
        'd3-polygon',
        'motion',
        'motion/react',
      ],
    },
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
  },
});
