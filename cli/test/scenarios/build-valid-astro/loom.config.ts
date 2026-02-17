import { defineLoomConfig } from '@loom/core';
import { astroRendererPlugin } from '@loom/renderer-astro';

export default defineLoomConfig({
  plugins: [astroRendererPlugin]
});
