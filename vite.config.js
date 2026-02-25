import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  base: process.env.VITE_BASE_PATH || '/', // Vercel default. For GitHub Pages set VITE_BASE_PATH=/GTM-Dashboard/
  build: {
    outDir: 'docs', // commit this folder; set Pages to main /docs
  },
});
