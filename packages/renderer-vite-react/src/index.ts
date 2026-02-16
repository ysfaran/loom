import mdx from '@mdx-js/rollup';
import { scanMdxFiles } from '@loom/core';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { cp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
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

async function createRendererContext(sourceRoot: string): Promise<RendererContext> {
  const absoluteSourceRoot = resolve(sourceRoot);
  const scanResult = await scanMdxFiles(absoluteSourceRoot);

  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const runtimeTemplateRoot = join(packageRoot, 'runtime');
  const tempRoot = join(packageRoot, '.loom-runtime');

  await rm(tempRoot, { force: true, recursive: true });
  await mkdir(tempRoot, { recursive: true });

  await cp(runtimeTemplateRoot, tempRoot, { recursive: true });
  await symlink(absoluteSourceRoot, join(tempRoot, 'content'), 'dir');

  const routes = scanResult.files
    .map((file) => {
      const withoutExt = file.replace(/\.mdx$/i, '');
      if (withoutExt.toLowerCase() === 'index') {
        return { file, route: '/' };
      }

      if (withoutExt.toLowerCase().endsWith('/index')) {
        return { file, route: `/${withoutExt.slice(0, -'/index'.length)}` };
      }

      return { file, route: `/${withoutExt}` };
    })
    .sort((a, b) => a.route.localeCompare(b.route));

  const escapeForLiteral = (value: string) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
  const routeRows = routes
    .map((route) => `  { file: '${escapeForLiteral(route.file)}', route: '${escapeForLiteral(route.route)}' }`)
    .join(',\n');

  const routesSource = `export type DocRoute = { file: string; route: string };

export const routes: DocRoute[] = [
${routeRows}
];
`;

  await writeFile(join(tempRoot, 'src', 'routes.gen.ts'), routesSource, 'utf8');

  return {
    tempRoot,
    pageCount: scanResult.count,
    cleanup: async () => {
      await rm(tempRoot, { force: true, recursive: true });
    }
  };
}

export async function buildWithViteReact(sourceRoot: string, outputDir: string): Promise<RendererBuildResult> {
  const startedAt = Date.now();
  const context = await createRendererContext(sourceRoot);
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

export async function startViteReactDevServer(sourceRoot: string, port: number): Promise<RendererDevResult> {
  const context = await createRendererContext(sourceRoot);

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
