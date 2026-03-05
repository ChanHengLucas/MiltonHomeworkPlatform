import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isServe = command === 'serve';
  const apiPort = env.API_PORT || env.PORT || '4000';
  const apiTarget =
    env.VITE_API_TARGET
    || env.VITE_API_PROXY_TARGET
    || `http://localhost:${apiPort}`;
  const port = Number(env.VITE_PORT || '3000');

  if (isServe) {
    // eslint-disable-next-line no-console
    console.log(`[Vite] Dev server proxy enabled: /api and /auth -> ${apiTarget}`);
    // eslint-disable-next-line no-console
    console.log(`[Vite] Web dev server port: ${port}`);
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
