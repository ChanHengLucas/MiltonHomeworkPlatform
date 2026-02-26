import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => {
  const isServe = command === 'serve';
  const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000';
  const port = Number(process.env.VITE_PORT || '3000');

  if (isServe) {
    // eslint-disable-next-line no-console
    console.log(`[Vite] Dev server proxy enabled: /api and /auth -> ${apiTarget}`);
  } else {
    // eslint-disable-next-line no-console
    console.log('[Vite] Production build: dev proxy disabled');
  }

  return {
    plugins: [react()],
    ...(isServe
      ? {
          server: {
            port,
            strictPort: process.env.E2E_TEST === '1',
            proxy: {
              '/api': {
                target: apiTarget,
                changeOrigin: true,
              },
              '/auth': {
                target: apiTarget,
                changeOrigin: true,
              },
            },
          },
        }
      : {}),
  };
});
