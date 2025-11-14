// vite.main.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  
  build: {
    rollupOptions: {
      external: [
        '@lancedb/lancedb', 
        '@langchain/textsplitters',
        'onnxruntime-node',
        'sharp',
        'pdf-parse' 
      ]
    }
  },
  
  commonjsOptions: {
    ignoreDynamicRequires: true // MANTENHA ISTO AQUI
  }
});