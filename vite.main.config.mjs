import { defineConfig } from 'vite';

 defineConfig({
  build: {
    rollupOptions: {
      external: [
        '@xenova/transformers',
        '@lancedb/lancedb'
      ]
    }
  }
});
export default defineConfig;
