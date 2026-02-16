import { scanMdxFiles } from '@loom/core';
import { cp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { execFile, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

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

const execFileAsync = promisify(execFile);
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
        return { file, path: '/', slug: undefined as string | undefined };
      }

      if (withoutExt.toLowerCase().endsWith('/index')) {
        const routePath = `/${withoutExt.slice(0, -'/index'.length)}`;
        return { file, path: routePath, slug: routePath.slice(1) };
      }

      const routePath = `/${withoutExt}`;
      return { file, path: routePath, slug: routePath.slice(1) };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  const escapeForLiteral = (value: string) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
  const routeRows = routes
    .map((route) => {
      const slugPart = route.slug ? `, slug: '${escapeForLiteral(route.slug)}'` : '';
      return `  { file: '${escapeForLiteral(route.file)}', path: '${escapeForLiteral(route.path)}'${slugPart} }`;
    })
    .join(',\n');

  const routesSource = `export type DocRoute = {
  file: string;
  path: string;
  slug?: string;
};

export const routes: DocRoute[] = [
${routeRows}
];
`;

  await writeFile(join(tempRoot, 'src', 'generated', 'routes.ts'), routesSource, 'utf8');

  return {
    tempRoot,
    pageCount: scanResult.count,
    cleanup: async () => {
      await rm(tempRoot, { force: true, recursive: true });
    }
  };
}

export async function buildWithAstro(sourceRoot: string, outputDir: string): Promise<RendererBuildResult> {
  const startedAt = Date.now();
  const context = await createRendererContext(sourceRoot);
  const outDir = resolve(outputDir);
  const astroBin = join(dirname(require.resolve('astro/package.json')), 'astro.js');

  try {
    await execFileAsync(process.execPath, [astroBin, 'build', '--outDir', outDir], {
      cwd: context.tempRoot,
      env: {
        ...process.env,
        ASTRO_TELEMETRY_DISABLED: '1'
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

export async function startAstroDevServer(sourceRoot: string, port: number): Promise<RendererDevResult> {
  const context = await createRendererContext(sourceRoot);
  const astroBin = join(dirname(require.resolve('astro/package.json')), 'astro.js');

  const child = spawn(process.execPath, [astroBin, 'dev', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: context.tempRoot,
    stdio: 'ignore',
    env: {
      ...process.env,
      ASTRO_TELEMETRY_DISABLED: '1'
    }
  });

  return {
    url: `http://127.0.0.1:${port}`,
    pageCount: context.pageCount,
    close: async () => {
      if (!child.killed) {
        child.kill('SIGTERM');
      }
      await new Promise<void>((resolveExit) => {
        child.once('exit', () => resolveExit());
      });
      await context.cleanup();
    }
  };
}
