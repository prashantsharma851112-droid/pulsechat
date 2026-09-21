import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  esbuild: {
    // Strip debug logs and legal comments in production
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    legalComments: 'none'
  },
  build: {
    // STRICT SECURITY: Do NOT generate source maps so original .jsx files are never visible
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
    cssMinify: true,
    rollupOptions: {
      output: {
        compact: true,
        // Chunk splitting into dense minified modules
        manualChunks: {
          vendor: ['react', 'react-dom'],
          icons: ['lucide-react'],
          socket: ['socket.io-client']
        }
      }
    }
  }
});

