import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';
import { ng } from '@analogjs/vite-plugin-angular';

export default defineConfig({
  plugins: [ng()],
  resolve: {
    alias: {
      '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@core': fileURLToPath(new URL('./src/app/core', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/app/shared', import.meta.url)),
      '@features': fileURLToPath(new URL('./src/app/features', import.meta.url)),
      '@environments': fileURLToPath(new URL('./src/environments', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'vitest',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
    },
  },
});
