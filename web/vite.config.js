import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server proxies /api to the Express backend so the browser never hits
// CORS: backend only allows the Expo origins by default.
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  return {
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: env.VITE_API_PROXY || 'http://localhost:5000', changeOrigin: true },
    },
  },
  };
});
