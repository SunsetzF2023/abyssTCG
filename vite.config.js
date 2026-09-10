import { defineConfig } from 'vite';

// Deployed as a GitHub Pages *project* page
// (https://sunsetzf2023.github.io/abyssTCG/), so all built asset
// URLs need the repo name as a base path.
export default defineConfig({
  base: '/abyssTCG/',
});
