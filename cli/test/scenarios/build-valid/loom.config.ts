import { defineLoomConfig } from '@loom/core';
import { viteReactRendererPlugin } from '@loom/renderer-vite-react';

export default defineLoomConfig({
  plugins: [viteReactRendererPlugin]
});
