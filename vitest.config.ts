import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'core',
          include: [
            'packages/core/test/**/*.test.ts',
            'tools/mapgen/**/*.test.mjs',
          ],
          environment: 'node',
          benchmark: { include: ['packages/core/test/**/*.bench.ts'] },
        },
      },
      {
        test: {
          name: 'client',
          include: ['packages/client/test/**/*.test.ts'],
          environment: 'happy-dom',
          benchmark: { include: [] },
        },
      },
    ],
  },
});
