import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// eslint-disable-next-line no-console
console.log('[Vite] Config loaded: proxy /api -> http://localhost:4000, port 3000');

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: !!process.env.E2E_TEST,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
