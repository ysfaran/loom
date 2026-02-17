import { defineLoomConfig } from '@loom/core';
import { astroRendererPlugin } from '@loom/renderer-astro';

export default defineLoomConfig({
  site: {
    title: 'Plugin Config Docs'
  },
  plugins: [
    astroRendererPlugin,
    {
      name: 'test-plugin',
      hooks: {
        transformMdx: ({ source }) => `${source}\n\nPlugin transform marker.`,
        mdxPage: ({ frontmatter }) => {
          if (frontmatter.type === 'adr') {
            return {
              beforeContentHtml: '<section id="adr-banner">ADR Context</section>'
            };
          }

          return undefined;
        },
        extendLayout: () => ({
          slots: {
            header: '<div id="plugin-header">Header Extension</div>',
            footer: '<div id="plugin-footer">Footer Extension</div>'
          }
        }),
        extendPages: () => [
          {
            path: '/adr-tree',
            title: 'ADR Tree',
            navLabel: 'ADR Tree',
            html: '<h1>ADR Tree</h1><p>Relationships.</p>'
          }
        ]
      }
    }
  ]
});
