import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:4000',
      '/socket.io': { target: 'http://127.0.0.1:4000', ws: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (/(three|react-three|three-stdlib)/.test(id)) return 'three';
            if (id.includes('firebase')) return 'firebase';
            if (/(recharts|d3-)/.test(id)) return 'charts';
          }
        },
      },
    },
  },
});
