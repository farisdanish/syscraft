import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['sql.js'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@monaco-editor') || id.includes('monaco-editor')) {
              return 'vendor-monaco';
            }
            if (id.includes('sql.js')) {
              return 'vendor-sql';
            }
            if (id.includes('@xyflow') || id.includes('d3-')) {
              return 'vendor-flow';
            }
            if (id.includes('@govtechmy/myds')) {
              return 'vendor-myds';
            }
            return 'vendor-core';
          }
        },
      },
    },
  },
})
