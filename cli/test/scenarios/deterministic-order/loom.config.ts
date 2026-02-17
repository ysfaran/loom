import { defineLoomConfig, definePlugin } from '@loom/core';

const seedPlugin = definePlugin({
  name: 'seed',
  setup: () => ({ seed: 'stable-order' })
});

const contractPlugin = definePlugin({
  name: 'contract',
  setup: (context: { seed?: string }) => {
    if (context.seed !== 'stable-order') {
      throw new Error('plugin setup order is not deterministic');
    }

    return {
      list: async ({ root }: { root: string }) => ({ root, files: [], count: 0 }),
      validate: async ({ root }: { root: string }) => ({ root, filesChecked: 0, errors: [], errorCount: 0 }),
      build: async ({ root, outDir }: { root: string; outDir: string }) => ({ root, outDir, pageCount: 0, durationMs: 0 }),
      dev: async () => ({
        url: 'http://localhost:4173/',
        pageCount: 0,
        close: async () => undefined
      })
    };
  }
});

export default defineLoomConfig({
  plugins: [seedPlugin, contractPlugin]
});
