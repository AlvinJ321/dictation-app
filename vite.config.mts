import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://localhost:3001')
  },
  plugins: [react(), tailwindcss()],
}); 