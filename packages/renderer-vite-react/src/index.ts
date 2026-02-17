import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import mdx from '@mdx-js/rollup';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin, UserConfig } from 'vite';
import { build as viteBuild, createServer } from 'vite';

import {
  definePlugin,
  type LoomBuildCommand,
  list,
  type LoomDevCommand,
  type LoomCommandContext,
  type LoomListResult,
  type LoomPlugin,
  toDefaultTitle,
  toRoutePath,
  validate
} from '@loom/core';

type RouteEntry = {
  importId: string;
  importPath: string;
  routePath: string;
  title: string;
};

const RENDERER_PACKAGE_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const RUNTIME_TEMPLATE_ROOT = join(RENDERER_PACKAGE_ROOT, 'runtime');

export function loomRendererViteReact(): LoomPlugin<Pick<LoomCommandContext, 'build' | 'dev' | 'list' | 'validate'>> {
  return definePlugin({
    name: '@loom/renderer-vite-react',
    setup: () => ({
      list,
      validate,
      build,
      dev
    })
  });
}

export const rendererViteReactPlugin = loomRendererViteReact;

const build: LoomBuildCommand = async ({ outDir, root, siteTitle }) => {
  const startedAt = Date.now();
  const outputPath = resolve(root, outDir);
  const prepared = await prepareRuntimeProject({ root, siteTitle });

  try {
    await viteBuild(createViteConfig(prepared.runtimeRoot, root, outputPath));
  } finally {
    await rm(prepared.runtimeRoot, { recursive: true, force: true });
  }

  return {
    root,
    outDir: outputPath,
    pageCount: prepared.pageCount,
    durationMs: Date.now() - startedAt
  };
};

const dev: LoomDevCommand = async ({ port, root, siteTitle }) => {
  const prepared = await prepareRuntimeProject({ root, siteTitle });
  const server = await createServer(createViteConfig(prepared.runtimeRoot, root, undefined, port));

  await server.listen();

  const url =
    server.resolvedUrls?.local?.[0] ?? server.resolvedUrls?.network?.[0] ?? `http://localhost:${port}/`;

  return {
    url,
    pageCount: prepared.pageCount,
    close: async () => {
      await server.close();
      await rm(prepared.runtimeRoot, { recursive: true, force: true });
    }
  };
};

async function prepareRuntimeProject(input: {
  root: string;
  siteTitle: string;
}): Promise<{
  files: string[];
  pageCount: number;
  runtimeRoot: string;
}> {
  const listed = await list({ root: input.root });
  const routes = createRoutes(listed.files, input.root);
  const runtimeRoot = join(
    RENDERER_PACKAGE_ROOT,
    '.loom-runtime',
    `vite-react-runtime-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );

  await mkdir(join(runtimeRoot, 'src'), { recursive: true });

  await copyTemplateFile(runtimeRoot, 'index.html');
  await copyTemplateFile(runtimeRoot, 'src/App.tsx');
  await copyTemplateFile(runtimeRoot, 'src/main.tsx');
  await copyTemplateFile(runtimeRoot, 'src/styles.css');

  await writeFile(
    join(runtimeRoot, 'src', 'loom.generated.ts'),
    buildGeneratedRoutesSource(routes, input.siteTitle),
    'utf8'
  );

  return {
    runtimeRoot,
    files: listed.files,
    pageCount: listed.count
  };
}

function createViteConfig(runtimeRoot: string, projectRoot: string, outputDir?: string, port?: number): UserConfig {
  return {
    root: runtimeRoot,
    logLevel: 'error',
    plugins: [...createMdxVitePlugins(), react(), tailwindcss()],
    server: {
      fs: {
        allow: [projectRoot, runtimeRoot]
      },
      host: '127.0.0.1',
      port,
      strictPort: port !== undefined
    },
    build: outputDir
      ? {
          emptyOutDir: true,
          outDir: outputDir
        }
      : undefined
  };
}

function createMdxVitePlugins(): Plugin[] {
  const plugin = mdx({ include: /\.mdx?$/ }) as unknown;
  const asArray = Array.isArray(plugin) ? plugin : [plugin];

  return asArray.map((entry, index) => ({
    ...(entry as Plugin),
    name: ((entry as Plugin).name || `loom-mdx-${index}`) as string,
    enforce: 'pre'
  }));
}

async function copyTemplateFile(runtimeRoot: string, relativePath: string): Promise<void> {
  const sourcePath = join(RUNTIME_TEMPLATE_ROOT, relativePath);
  const destinationPath = join(runtimeRoot, relativePath);
  const source = await readFile(sourcePath, 'utf8');
  await writeFile(destinationPath, source, 'utf8');
}

function buildGeneratedRoutesSource(routes: RouteEntry[], siteTitle: string): string {
  const importLines = routes.map((route) => `import ${route.importId} from '${route.importPath}';`).join('\n');
  const routeEntries = routes
    .map(
      (route) =>
        `  { path: '${escapeForStringLiteral(route.routePath)}', title: '${escapeForStringLiteral(route.title)}', Component: ${route.importId} }`
    )
    .join(',\n');

  return `import type React from 'react';
${importLines}

export type LoomRoute = {
  Component: React.ComponentType;
  path: string;
  title: string;
};

export const siteTitle = '${escapeForStringLiteral(siteTitle)}';

export const routes: LoomRoute[] = [
${routeEntries}
];
`;
}

function createRoutes(files: LoomListResult['files'], root: string): RouteEntry[] {
  return files.map((file, index) => ({
    importId: `DocPage${index}`,
    importPath: toRuntimeImportPath(resolve(root, file)),
    routePath: toRoutePath(file),
    title: toDefaultTitle(file)
  }));
}

function escapeForStringLiteral(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

function toRuntimeImportPath(filePath: string): string {
  return filePath.split('\\').join('/');
}
