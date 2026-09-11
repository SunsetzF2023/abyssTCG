import { defineConfig } from 'vite';

const buildId = (process.env.GITHUB_SHA || 'local').slice(0, 8);

// Deployed as a GitHub Pages *project* page
// (https://sunsetzf2023.github.io/abyssTCG/), so all built asset
// URLs need the repo name as a base path.
export default defineConfig({
  base: '/abyssTCG/',
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash]-${buildId}.js`,
        chunkFileNames: `assets/[name]-[hash]-${buildId}.js`,
        assetFileNames: `assets/[name]-[hash]-${buildId}[extname]`,
      },
    },
  },
});
