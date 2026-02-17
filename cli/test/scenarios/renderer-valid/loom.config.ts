import { defineLoomConfig } from '@loom/core';
import { loomRendererViteReact } from '@loom/renderer-vite-react';

export default defineLoomConfig({
  site: {
    title: 'Renderer Valid'
  },
  plugins: [loomRendererViteReact()]
});
