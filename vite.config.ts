import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/ghhn/',
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
