import { defineConfig } from 'vite';

export default defineConfig({
  base: '/SpineCompare/',
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
  },
});
