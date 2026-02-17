import {
  defineRendererPlugin,
  prepareLoomSite,
  type LoomPreparedSite,
  type LoomResolvedConfig
} from '@loom/core';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
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

async function writePreparedSite(site: LoomPreparedSite, tempRoot: string): Promise<void> {
  await mkdir(join(tempRoot, 'content'), { recursive: true });

  for (const mdxFile of site.mdxFiles) {
    const outputPath = join(tempRoot, 'content', mdxFile.file);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, mdxFile.source, 'utf8');
  }

  const routesSource = `export type DocRoute = {
  file?: string;
  frontmatter: Record<string, unknown>;
  html?: string;
  kind: 'mdx' | 'html';
  mdxDecoration?: {
    afterContentHtml: string[];
    beforeContentHtml: string[];
    replaceContentHtml?: string;
  };
  navLabel: string;
  path: string;
  showInSidebar: boolean;
  slug?: string;
  title: string;
};

export const routes: DocRoute[] = ${JSON.stringify(
    site.routes.map((route) => ({
      file: route.file,
      frontmatter: route.frontmatter,
      html: route.html,
      kind: route.kind,
      mdxDecoration: route.mdxDecoration,
      navLabel: route.navLabel,
      path: route.path,
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

  await writeFile(join(tempRoot, 'src', 'generated', 'routes.ts'), routesSource, 'utf8');
  await writeFile(join(tempRoot, 'src', 'generated', 'plugin.ts'), pluginSource, 'utf8');
}

async function createRendererContext(sourceRoot: string, config?: LoomResolvedConfig): Promise<RendererContext> {
  const absoluteSourceRoot = resolve(sourceRoot);
  const site = await prepareLoomSite(absoluteSourceRoot, 'astro', config);

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

export async function buildWithAstro(sourceRoot: string, outputDir: string, config?: LoomResolvedConfig): Promise<RendererBuildResult> {
  const startedAt = Date.now();
  const context = await createRendererContext(sourceRoot, config);
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

export async function startAstroDevServer(sourceRoot: string, port: number, config?: LoomResolvedConfig): Promise<RendererDevResult> {
  const context = await createRendererContext(sourceRoot, config);
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

export const astroRendererPlugin = defineRendererPlugin({
  name: '@loom/renderer-astro',
  build: async ({ sourceRoot, outputDir, config }) => buildWithAstro(sourceRoot, outputDir, config),
  dev: async ({ sourceRoot, port, config }) => startAstroDevServer(sourceRoot, port, config)
});
