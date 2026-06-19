import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Builds a single self-executing widget.js bundle that mounts itself into a
// Shadow DOM on load. No exports — the entry has side effects only.
export default defineConfig({
  plugins: [preact()],
  define: {
    // Strip Preact dev warnings from the production bundle.
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    target: 'es2019',
    cssCodeSplit: false,
    lib: {
      entry: 'src/index.tsx',
      name: 'FeedbackWidget',
      formats: ['iife'],
      fileName: () => 'widget.js',
    },
    rollupOptions: {
      output: {
        // Inline everything into one file, no chunk splitting.
        inlineDynamicImports: true,
        // Keep CSS (if any leaks) out — we inline styles in the component.
        assetFileNames: 'widget.[ext]',
      },
    },
    minify: 'esbuild',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
  },
});
