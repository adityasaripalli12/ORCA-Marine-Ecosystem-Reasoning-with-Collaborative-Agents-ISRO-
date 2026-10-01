import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BACKEND = 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,   // fail if port is taken
    host: '127.0.0.1',
    proxy: {
      // Proxy all /auth/* calls → FastAPI backend (bypasses CORS in dev)
      '/auth': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
      '/geo': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
      '/devices': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
      '/datasets': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
      '/chat': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
      '/security': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
      '/audit': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
      '/users': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
      '/hazards': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
