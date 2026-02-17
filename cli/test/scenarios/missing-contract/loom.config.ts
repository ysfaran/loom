import { defineLoomConfig, definePlugin } from '@loom/core';

const partialPlugin = definePlugin({
  name: 'partial',
  setup: () => ({
    list: async () => ({ root: '.', files: [], count: 0 }),
    validate: async () => ({ root: '.', filesChecked: 0, errors: [], errorCount: 0 })
  })
});

export default defineLoomConfig({
  plugins: [partialPlugin]
});
