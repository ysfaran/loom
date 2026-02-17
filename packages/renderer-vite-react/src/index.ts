import mdx from '@mdx-js/rollup';
import {
  defineRendererPlugin,
  prepareLoomSite,
  type LoomPreparedSite,
  type LoomResolvedConfig
} from '@loom/core';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as viteBuild, createServer } from 'vite';

type RendererContext = {
  cleanup: () => Promise<void>;
  pageCount: number;
  tempRoot: string;
};

type RendererBuildResult = {
  durationMs: number;
  outDir: string;
  pageCount: number;
};

type RendererDevResult = {
  close: () => Promise<void>;
  pageCount: number;
  url: string;
};

const require = createRequire(import.meta.url);

async function writePreparedSite(site: LoomPreparedSite, tempRoot: string): Promise<void> {
  await mkdir(join(tempRoot, 'content'), { recursive: true });

  for (const mdxFile of site.mdxFiles) {
    const outputPath = join(tempRoot, 'content', mdxFile.file);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, mdxFile.source, 'utf8');
  }

  const routesSource = `export type DocRoute = {
  file?: string;
  html?: string;
  kind: 'mdx' | 'html';
  mdxDecoration?: {
    afterContentHtml: string[];
    beforeContentHtml: string[];
    replaceContentHtml?: string;
  };
  navLabel: string;
  route: string;
  showInSidebar: boolean;
  slug?: string;
  title: string;
};

export const routes: DocRoute[] = ${JSON.stringify(
    site.routes.map((route) => ({
      file: route.file,
      html: route.html,
      kind: route.kind,
      mdxDecoration: route.mdxDecoration,
      navLabel: route.navLabel,
      route: route.path,
      showInSidebar: route.showInSidebar,
      slug: route.slug,
      title: route.title
    })),
    null,
    2
  )};
`;

  const pluginSource = `export const siteTitle = ${JSON.stringify(site.config.site.title)};

export const layout = ${JSON.stringify(site.layout, null, 2)};
`;

  await writeFile(join(tempRoot, 'src', 'routes.gen.ts'), routesSource, 'utf8');
  await writeFile(join(tempRoot, 'src', 'plugin.gen.ts'), pluginSource, 'utf8');
}

async function createRendererContext(sourceRoot: string, config?: LoomResolvedConfig): Promise<RendererContext> {
  const absoluteSourceRoot = resolve(sourceRoot);
  const site = await prepareLoomSite(absoluteSourceRoot, 'vite-react', config);

  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const runtimeTemplateRoot = join(packageRoot, 'runtime');
  const tempRoot = join(packageRoot, '.loom-runtime');

  await rm(tempRoot, { force: true, recursive: true });
  await mkdir(tempRoot, { recursive: true });

  await cp(runtimeTemplateRoot, tempRoot, { recursive: true });
  await writePreparedSite(site, tempRoot);

  return {
    tempRoot,
    pageCount: site.pageCount,
    cleanup: async () => {
      await rm(tempRoot, { force: true, recursive: true });
    }
  };
}

export async function buildWithViteReact(
  sourceRoot: string,
  outputDir: string,
  config?: LoomResolvedConfig
): Promise<RendererBuildResult> {
  const startedAt = Date.now();
  const context = await createRendererContext(sourceRoot, config);
  const outDir = resolve(outputDir);

  const reactRoot = dirname(require.resolve('react/package.json'));
  const reactDomRoot = dirname(require.resolve('react-dom/package.json'));

  try {
    await viteBuild({
      root: context.tempRoot,
      plugins: [mdx({ providerImportSource: '/src/mdx-components' }), react(), tailwindcss()],
      resolve: {
        alias: {
          react: reactRoot,
          'react/jsx-runtime': join(reactRoot, 'jsx-runtime.js'),
          'react/jsx-dev-runtime': join(reactRoot, 'jsx-dev-runtime.js'),
          'react-dom': reactDomRoot,
          'react-dom/client': join(reactDomRoot, 'client.js')
        }
      },
      logLevel: 'error',
      server: {
        fs: {
          allow: [resolve(sourceRoot), context.tempRoot]
        }
      },
      build: {
        emptyOutDir: true,
        outDir
      }
    });

    return {
      outDir,
      pageCount: context.pageCount,
      durationMs: Date.now() - startedAt
    };
  } finally {
    await context.cleanup();
  }
}

export async function startViteReactDevServer(
  sourceRoot: string,
  port: number,
  config?: LoomResolvedConfig
): Promise<RendererDevResult> {
  const context = await createRendererContext(sourceRoot, config);

  const reactRoot = dirname(require.resolve('react/package.json'));
  const reactDomRoot = dirname(require.resolve('react-dom/package.json'));

  const server = await createServer({
    root: context.tempRoot,
    plugins: [mdx({ providerImportSource: '/src/mdx-components' }), react(), tailwindcss()],
    resolve: {
      alias: {
        react: reactRoot,
        'react/jsx-runtime': join(reactRoot, 'jsx-runtime.js'),
        'react/jsx-dev-runtime': join(reactRoot, 'jsx-dev-runtime.js'),
        'react-dom': reactDomRoot,
        'react-dom/client': join(reactDomRoot, 'client.js')
      }
    },
    logLevel: 'error',
    server: {
      host: '127.0.0.1',
      port,
      strictPort: true,
      fs: {
        allow: [resolve(sourceRoot), context.tempRoot]
      }
    }
  });

  await server.listen();

  const url = server.resolvedUrls?.local?.[0] ?? `http://127.0.0.1:${port}`;

  return {
    url,
    pageCount: context.pageCount,
    close: async () => {
      await server.close();
      await context.cleanup();
    }
  };
}

export const viteReactRendererPlugin = defineRendererPlugin({
  name: '@loom/renderer-vite-react',
  build: async ({ sourceRoot, outputDir, config }) => buildWithViteReact(sourceRoot, outputDir, config),
  dev: async ({ sourceRoot, port, config }) => startViteReactDevServer(sourceRoot, port, config)
});
