import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:8080" },
  },
  envPrefix: ['VITE_'],
  test: { environment: 'jsdom', setupFiles: './src/test/setup.ts' },
});
