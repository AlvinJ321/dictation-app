import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  const API_BASE_URL = isProduction
    ? 'http://47.117.8.146'
    : 'http://localhost:3001';

  return {
    base: './',
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(API_BASE_URL),
    },
    plugins: [react(), tailwindcss()],
    build: {
      sourcemap: false,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          feedback: resolve(__dirname, 'feedback.html'),
        },
      },
    },
  };
}); 