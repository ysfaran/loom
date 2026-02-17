import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { compile } from '@mdx-js/mdx';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export type ScanResult = {
  count: number;
  durationMs: number;
  files: string[];
  root: string;
};

export type ValidationError = {
  column?: number;
  file: string;
  line?: number;
  message: string;
  ruleId: 'mdx/parse-error';
};

export type ValidationResult = {
  errorCount: number;
  errors: ValidationError[];
  filesChecked: number;
  root: string;
};

export type BuildResult = {
  durationMs: number;
  errorCount: number;
  errors: ValidationError[];
  outDir: string;
  pageCount: number;
  root: string;
  warningCount: number;
};

export type LoomRenderer = string;

type MaybePromise<T> = T | Promise<T>;

export type LoomRendererBuildResult = {
  durationMs: number;
  outDir: string;
  pageCount: number;
};

export type LoomRendererDevResult = {
  close: () => Promise<void>;
  pageCount: number;
  url: string;
};

export type LoomRendererPlugin = {
  build: (input: { config: LoomResolvedConfig; outputDir: string; sourceRoot: string }) => Promise<LoomRendererBuildResult>;
  dev: (input: { config: LoomResolvedConfig; port: number; sourceRoot: string }) => Promise<LoomRendererDevResult>;
  name: string;
};

export type LoomRuntimeBaseContext = {};

export type LoomRuntimePlugin<Provides extends object = object, Needs extends object = object> = {
  name: string;
  setup: (context: LoomRuntimeBaseContext & Needs) => MaybePromise<Provides | void>;
};

export type LoomRouteSummary = {
  file?: string;
  frontmatter: Record<string, unknown>;
  path: string;
  title: string;
};

export type LoomMdxPageDecoration = {
  afterContentHtml?: string | string[];
  beforeContentHtml?: string | string[];
  replaceContentHtml?: string;
};

export type LoomLayoutContribution = {
  classNames?: {
    content?: string;
    footer?: string;
    header?: string;
    main?: string;
    root?: string;
    sidebar?: string;
  };
  hideDefaultFooter?: boolean;
  hideDefaultHeader?: boolean;
  hideDefaultSidebar?: boolean;
  slots?: {
    footer?: string | string[];
    header?: string | string[];
    sidebarBottom?: string | string[];
    sidebarTop?: string | string[];
  };
};

export type LoomExtraPage = {
  html: string;
  navLabel?: string;
  order?: number;
  path: string;
  showInSidebar?: boolean;
  title?: string;
};

export type LoomPluginHooks = {
  extendLayout?: (context: {
    renderer: LoomRenderer;
    root: string;
    routes: LoomRouteSummary[];
  }) => MaybePromise<LoomLayoutContribution | void>;
  extendPages?: (context: {
    renderer: LoomRenderer;
    root: string;
    routes: LoomRouteSummary[];
  }) => MaybePromise<LoomExtraPage[] | void>;
  mdxPage?: (context: {
    file: string;
    frontmatter: Record<string, unknown>;
    path: string;
    renderer: LoomRenderer;
    root: string;
    source: string;
    title: string;
  }) => MaybePromise<LoomMdxPageDecoration | void>;
  transformMdx?: (context: {
    file: string;
    frontmatter: Record<string, unknown>;
    path: string;
    renderer: LoomRenderer;
    root: string;
    source: string;
  }) => MaybePromise<string>;
};

export type LoomPlugin = {
  hooks?: LoomPluginHooks;
  name: string;
};

export type LoomConfig = {
  plugins?: Array<LoomPlugin | LoomRuntimePlugin<any, any> | null | undefined | false>;
  site?: {
    title?: string;
  };
};

export type LoomResolvedConfig = {
  configPath?: string;
  plugins: LoomPlugin[];
  runtimePlugins: LoomRuntimePlugin<any, any>[];
  root: string;
  site: {
    title: string;
  };
};

export type LoomPreparedLayout = {
  classNames: {
    content?: string;
    footer?: string;
    header?: string;
    main?: string;
    root?: string;
    sidebar?: string;
  };
  hideDefaultFooter: boolean;
  hideDefaultHeader: boolean;
  hideDefaultSidebar: boolean;
  slots: {
    footer: string[];
    header: string[];
    sidebarBottom: string[];
    sidebarTop: string[];
  };
};

export type LoomPreparedRoute = {
  file?: string;
  frontmatter: Record<string, unknown>;
  html?: string;
  kind: 'html' | 'mdx';
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

export type LoomPreparedMdxFile = {
  file: string;
  source: string;
};

export type LoomPreparedSite = {
  config: LoomResolvedConfig;
  layout: LoomPreparedLayout;
  mdxFiles: LoomPreparedMdxFile[];
  pageCount: number;
  routes: LoomPreparedRoute[];
  root: string;
};

export function defineLoomConfig(config: LoomConfig): LoomConfig {
  return config;
}

export function definePlugin<Provides extends object = object, Needs extends object = object>(
  plugin: LoomRuntimePlugin<Provides, Needs>
): LoomRuntimePlugin<Provides, Needs> {
  return plugin;
}

export function createLoom(initialContext?: Record<string, unknown>) {
  const runtimeContext: LoomRuntimeBaseContext & Record<string, unknown> = {
    ...(initialContext ?? {})
  };

  return {
    use: async (plugin: LoomRuntimePlugin<any, any>) => {
      const provided = await plugin.setup(runtimeContext as LoomRuntimeBaseContext & Record<string, unknown>);
      if (provided && typeof provided === 'object') {
        for (const [key, value] of Object.entries(provided)) {
          runtimeContext[key] = value;
        }
      }
      return runtimeContext;
    },
    context: runtimeContext
  };
}

export function defineRendererPlugin(renderer: LoomRendererPlugin): LoomRuntimePlugin<{ __loomRenderer?: LoomRendererPlugin }> {
  return definePlugin({
    name: renderer.name,
    setup: (context: { __loomRenderer?: LoomRendererPlugin }) => {
      if (context.__loomRenderer) {
        return;
      }

      return {
        __loomRenderer: renderer
      };
    }
  });
}

export function resolveRendererFromContext(context: Record<string, unknown>): LoomRendererPlugin | undefined {
  const value = context.__loomRenderer;
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const maybeRenderer = value as LoomRendererPlugin;
  if (typeof maybeRenderer.name !== 'string') {
    return undefined;
  }
  if (typeof maybeRenderer.build !== 'function') {
    return undefined;
  }
  if (typeof maybeRenderer.dev !== 'function') {
    return undefined;
  }

  return maybeRenderer;
}

function toPosixPath(filePath: string): string {
  return filePath.split(sep).join('/');
}

async function walkMdxFiles(rootPath: string, currentPath: string, files: string[]): Promise<void> {
  const entries = await readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = join(currentPath, entry.name);

    if (entry.isDirectory()) {
      await walkMdxFiles(rootPath, entryPath, files);
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.mdx')) {
      files.push(toPosixPath(relative(rootPath, entryPath)));
    }
  }
}

export async function scanMdxFiles(inputPath: string): Promise<ScanResult> {
  const root = resolve(inputPath);
  const startedAt = Date.now();
  const files: string[] = [];

  await walkMdxFiles(root, root, files);
  files.sort();

  return {
    root,
    files,
    count: files.length,
    durationMs: Date.now() - startedAt
  };
}

export async function validateMdxFiles(inputPath: string): Promise<ValidationResult> {
  const scanResult = await scanMdxFiles(inputPath);
  const errors: ValidationError[] = [];

  for (const file of scanResult.files) {
    const absolutePath = join(scanResult.root, file);
    const contents = await readFile(absolutePath, 'utf8');

    try {
      await compile(contents, { jsx: true });
    } catch (error) {
      const err = error as {
        message?: string;
        reason?: string;
        position?: { end?: { column?: number; line?: number }; start?: { column?: number; line?: number } };
      };
      const position = err.position?.start ?? err.position?.end;
      errors.push({
        ruleId: 'mdx/parse-error',
        file,
        line: position?.line,
        column: position?.column,
        message: err.reason ?? err.message ?? 'Unknown MDX parse error'
      });
    }
  }

  return {
    root: scanResult.root,
    filesChecked: scanResult.count,
    errors,
    errorCount: errors.length
  };
}

function toRoutePath(filePath: string): string {
  const withoutExt = filePath.replace(/\.mdx$/i, '');
  if (withoutExt.toLowerCase() === 'index') {
    return '/';
  }

  if (withoutExt.toLowerCase().endsWith('/index')) {
    return `/${withoutExt.slice(0, -'/index'.length)}`;
  }

  return `/${withoutExt}`;
}

function toRouteSlug(path: string): string | undefined {
  if (path === '/') {
    return undefined;
  }

  return path.startsWith('/') ? path.slice(1) : path;
}

function normalizeRoutePath(routePath: string): string {
  const trimmed = routePath.trim();
  if (!trimmed || trimmed === '/') {
    return '/';
  }

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildHtmlPage(title: string, navHtml: string, source: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; color: #0f172a; }
      .layout { display: grid; grid-template-columns: 280px 1fr; min-height: 100vh; }
      nav { background: #f8fafc; border-right: 1px solid #e2e8f0; padding: 16px; }
      nav h2 { font-size: 14px; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; }
      nav ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
      nav a { color: #0f172a; text-decoration: none; font-size: 14px; word-break: break-word; }
      main { padding: 24px; }
      h1 { margin-top: 0; font-size: 24px; }
      pre { background: #0f172a; color: #e2e8f0; padding: 16px; border-radius: 8px; overflow: auto; }
      @media (max-width: 900px) {
        .layout { grid-template-columns: 1fr; }
        nav { border-right: 0; border-bottom: 1px solid #e2e8f0; }
      }
    </style>
  </head>
  <body>
    <div class="layout">
      <nav>
        <h2>Docs</h2>
        <ul>
          ${navHtml}
        </ul>
      </nav>
      <main>
        <h1>${escapeHtml(title)}</h1>
        <pre><code>${escapeHtml(source)}</code></pre>
      </main>
    </div>
  </body>
</html>`;
}

function parseFrontmatter(source: string): Record<string, unknown> {
  if (!source.startsWith('---\n') && !source.startsWith('---\r\n')) {
    return {};
  }

  const normalized = source.replaceAll('\r\n', '\n');
  const lines = normalized.split('\n');

  if (lines[0] !== '---') {
    return {};
  }

  const frontmatter: Record<string, unknown> = {};

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === '---') {
      return frontmatter;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    if (!key) {
      continue;
    }

    if (rawValue === 'true') {
      frontmatter[key] = true;
      continue;
    }

    if (rawValue === 'false') {
      frontmatter[key] = false;
      continue;
    }

    if (rawValue === 'null') {
      frontmatter[key] = null;
      continue;
    }

    if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
      frontmatter[key] = rawValue.slice(1, -1);
      continue;
    }

    if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
      frontmatter[key] = rawValue.slice(1, -1);
      continue;
    }

    const numeric = Number(rawValue);
    if (!Number.isNaN(numeric) && rawValue !== '') {
      frontmatter[key] = numeric;
      continue;
    }

    frontmatter[key] = rawValue;
  }

  return {};
}

function toStringArray(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function formatPluginError(pluginName: string, hookName: keyof LoomPluginHooks, error: unknown): Error {
  const detail =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : `Unknown error: ${JSON.stringify(error)}`;

  return new Error(`Plugin \"${pluginName}\" failed in hook \"${hookName}\": ${detail}`);
}

const configNames = ['loom.config.ts', 'loom.config.mts', 'loom.config.js', 'loom.config.mjs', 'loom.config.cjs'] as const;

async function findConfigFile(root: string): Promise<string | undefined> {
  for (const configName of configNames) {
    const configPath = join(root, configName);
    try {
      await readFile(configPath, 'utf8');
      return configPath;
    } catch {
      continue;
    }
  }

  return undefined;
}

async function importConfigModule(configPath: string): Promise<LoomConfig> {
  const extension = extname(configPath).toLowerCase();

  if (extension === '.ts' || extension === '.mts') {
    const source = await readFile(configPath, 'utf8');
    const moduleApi = (await import('node:module')) as {
      stripTypeScriptTypes?: (code: string, options?: { mode?: 'strip' | 'transform' }) => string;
    };
    const transpiled =
      moduleApi.stripTypeScriptTypes?.(source, { mode: 'transform' }) ??
      (await (async () => {
        try {
          const typescript = await import('typescript');
          return typescript.transpileModule(source, {
            compilerOptions: {
              module: typescript.ModuleKind.ESNext,
              target: typescript.ScriptTarget.ES2022
            },
            fileName: configPath
          }).outputText;
        } catch {
          throw new Error('TypeScript config loading requires Node strip-types support or an installed TypeScript runtime.');
        }
      })());
    const tempConfigPath = join(dirname(configPath), `.loom.config.${Date.now()}.${Math.random().toString(36).slice(2)}.mjs`);

    try {
      await writeFile(tempConfigPath, transpiled, 'utf8');
      const loaded = await import(pathToFileURL(tempConfigPath).href);
      return (loaded.default ?? loaded) as LoomConfig;
    } finally {
      await rm(tempConfigPath, { force: true });
    }
  }

  const loaded = await import(pathToFileURL(configPath).href);
  return (loaded.default ?? loaded) as LoomConfig;
}

function normalizeConfig(root: string, rawConfig: LoomConfig, configPath?: string): LoomResolvedConfig {
  const plugins: LoomPlugin[] = [];
  const runtimePlugins: LoomRuntimePlugin<any, any>[] = [];

  for (const plugin of rawConfig.plugins ?? []) {
    if (!plugin) {
      continue;
    }

    if (!plugin.name || typeof plugin.name !== 'string') {
      throw new Error('Invalid Loom plugin: every plugin must define a non-empty name.');
    }

    if ('hooks' in plugin) {
      plugins.push({
        name: plugin.name,
        hooks: plugin.hooks
      });
    }

    if ('setup' in plugin && typeof plugin.setup === 'function') {
      runtimePlugins.push(plugin as LoomRuntimePlugin<any, any>);
    }
  }

  return {
    root,
    configPath,
    plugins,
    runtimePlugins,
    site: {
      title: rawConfig.site?.title?.trim() || 'Loom Docs'
    }
  };
}

export async function loadLoomConfig(inputPath: string): Promise<LoomResolvedConfig> {
  const root = resolve(inputPath);
  const configPath = await findConfigFile(root);

  if (!configPath) {
    return normalizeConfig(root, {});
  }

  const loaded = await importConfigModule(configPath);
  return normalizeConfig(root, loaded, configPath);
}

export async function prepareLoomSite(inputPath: string, renderer: LoomRenderer, loadedConfig?: LoomResolvedConfig): Promise<LoomPreparedSite> {
  const root = resolve(inputPath);
  const config = loadedConfig ?? (await loadLoomConfig(root));
  const scanResult = await scanMdxFiles(root);

  const mdxFiles: LoomPreparedMdxFile[] = [];
  const routes: LoomPreparedRoute[] = [];

  for (const file of scanResult.files) {
    const absolutePath = join(root, file);
    let source = await readFile(absolutePath, 'utf8');
    let frontmatter = parseFrontmatter(source);
    const path = toRoutePath(file);

    for (const plugin of config.plugins) {
      const transformHook = plugin.hooks?.transformMdx;
      if (!transformHook) {
        continue;
      }

      try {
        source = await transformHook({
          file,
          frontmatter,
          path,
          renderer,
          root,
          source
        });
        frontmatter = parseFrontmatter(source);
      } catch (error) {
        throw formatPluginError(plugin.name, 'transformMdx', error);
      }
    }

    const mdxDecoration: LoomPreparedRoute['mdxDecoration'] = {
      beforeContentHtml: [],
      afterContentHtml: []
    };

    for (const plugin of config.plugins) {
      const mdxPageHook = plugin.hooks?.mdxPage;
      if (!mdxPageHook) {
        continue;
      }

      try {
        const contribution = await mdxPageHook({
          file,
          frontmatter,
          path,
          renderer,
          root,
          source,
          title: typeof frontmatter.title === 'string' ? frontmatter.title : basename(path === '/' ? 'index' : path)
        });

        if (!contribution) {
          continue;
        }

        mdxDecoration.beforeContentHtml.push(...toStringArray(contribution.beforeContentHtml));
        mdxDecoration.afterContentHtml.push(...toStringArray(contribution.afterContentHtml));

        if (typeof contribution.replaceContentHtml === 'string') {
          mdxDecoration.replaceContentHtml = contribution.replaceContentHtml;
        }
      } catch (error) {
        throw formatPluginError(plugin.name, 'mdxPage', error);
      }
    }

    const title = typeof frontmatter.title === 'string' ? frontmatter.title : basename(path === '/' ? 'index' : path);
    const navLabel = typeof frontmatter.navLabel === 'string' ? frontmatter.navLabel : title;
    const showInSidebar = frontmatter.sidebar !== false;

    mdxFiles.push({ file, source });
    routes.push({
      kind: 'mdx',
      file,
      frontmatter,
      path,
      slug: toRouteSlug(path),
      title,
      navLabel,
      showInSidebar,
      mdxDecoration
    });
  }

  const layout: LoomPreparedLayout = {
    hideDefaultFooter: false,
    hideDefaultHeader: false,
    hideDefaultSidebar: false,
    slots: {
      header: [],
      footer: [],
      sidebarTop: [],
      sidebarBottom: []
    },
    classNames: {}
  };

  for (const plugin of config.plugins) {
    const extendLayoutHook = plugin.hooks?.extendLayout;
    if (!extendLayoutHook) {
      continue;
    }

    try {
      const contribution = await extendLayoutHook({
        renderer,
        root,
        routes
      });

      if (!contribution) {
        continue;
      }

      layout.hideDefaultHeader = contribution.hideDefaultHeader ?? layout.hideDefaultHeader;
      layout.hideDefaultFooter = contribution.hideDefaultFooter ?? layout.hideDefaultFooter;
      layout.hideDefaultSidebar = contribution.hideDefaultSidebar ?? layout.hideDefaultSidebar;

      for (const [key, value] of Object.entries(contribution.classNames ?? {})) {
        if (!value) {
          continue;
        }

        const classKey = key as keyof LoomPreparedLayout['classNames'];
        const merged = [layout.classNames[classKey], value].filter(Boolean).join(' ').trim();
        layout.classNames[classKey] = merged || undefined;
      }

      layout.slots.header.push(...toStringArray(contribution.slots?.header));
      layout.slots.footer.push(...toStringArray(contribution.slots?.footer));
      layout.slots.sidebarTop.push(...toStringArray(contribution.slots?.sidebarTop));
      layout.slots.sidebarBottom.push(...toStringArray(contribution.slots?.sidebarBottom));
    } catch (error) {
      throw formatPluginError(plugin.name, 'extendLayout', error);
    }
  }

  const takenPaths = new Set(routes.map((route) => route.path));

  for (const plugin of config.plugins) {
    const extendPagesHook = plugin.hooks?.extendPages;
    if (!extendPagesHook) {
      continue;
    }

    try {
      const extraPages = await extendPagesHook({
        renderer,
        root,
        routes
      });

      for (const page of extraPages ?? []) {
        const path = normalizeRoutePath(page.path);

        if (takenPaths.has(path)) {
          throw new Error(`Route path collision for \"${path}\".`);
        }

        takenPaths.add(path);

        const title = page.title?.trim() || basename(path === '/' ? 'index' : path);

        routes.push({
          kind: 'html',
          frontmatter: {},
          html: page.html,
          path,
          slug: toRouteSlug(path),
          title,
          navLabel: page.navLabel?.trim() || title,
          showInSidebar: page.showInSidebar ?? true
        });
      }
    } catch (error) {
      throw formatPluginError(plugin.name, 'extendPages', error);
    }
  }

  routes.sort((left, right) => left.path.localeCompare(right.path));

  return {
    root,
    config,
    layout,
    routes,
    mdxFiles,
    pageCount: routes.length
  };
}

export async function buildDocsSite(inputPath: string, outputPath: string): Promise<BuildResult> {
  const startedAt = Date.now();
  const root = resolve(inputPath);
  const outDir = resolve(outputPath);
  const validationResult = await validateMdxFiles(root);

  if (validationResult.errorCount > 0) {
    return {
      root,
      outDir,
      pageCount: 0,
      warningCount: 0,
      errors: validationResult.errors,
      errorCount: validationResult.errorCount,
      durationMs: Date.now() - startedAt
    };
  }

  const scanResult = await scanMdxFiles(root);
  const pages = scanResult.files.map((file) => {
    const route = toRoutePath(file);
    const href = route;
    return {
      file,
      href,
      route,
      title: basename(route === '/' ? 'index' : route)
    };
  });

  const navHtml = pages
    .map((page) => `<li><a href="${escapeHtml(page.href)}">${escapeHtml(page.route === '/' ? 'index' : page.route)}</a></li>`)
    .join('\n');

  await rm(outDir, { force: true, recursive: true });

  for (const page of pages) {
    const routePath = page.route === '/' ? '' : page.route;
    const outputFile = routePath === '' ? join(outDir, 'index.html') : join(outDir, routePath, 'index.html');
    const source = await readFile(join(root, page.file), 'utf8');
    const html = buildHtmlPage(page.title, navHtml, source);
    await mkdir(dirname(outputFile), { recursive: true });
    await writeFile(outputFile, html, 'utf8');
  }

  return {
    root,
    outDir,
    pageCount: pages.length,
    warningCount: 0,
    errors: [],
    errorCount: 0,
    durationMs: Date.now() - startedAt
  };
}
