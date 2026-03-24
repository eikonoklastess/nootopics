import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'convex/**/*.{test,spec}.{ts,tsx}'],
  },
});
