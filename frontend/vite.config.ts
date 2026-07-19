import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Lets the frontend call fetch('/api/...') during `npm run dev`
      // without hitting CORS -- Vite forwards it to the FastAPI backend.
      // Not used in the Docker setup (nginx.conf does the same job there).
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
