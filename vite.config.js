import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  base: '/GTM-Dashboard/', // for GitHub Pages: https://jim925d.github.io/GTM-Dashboard/
  build: {
    outDir: 'docs', // commit this folder; set Pages to main /docs
  },
});
