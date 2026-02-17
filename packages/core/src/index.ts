import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { compile } from '@mdx-js/mdx';

export type MaybePromise<T> = T | Promise<T>;

export type LoomListResult = {
  count: number;
  files: string[];
  root: string;
};

export type LoomValidationError = {
  column?: number;
  file: string;
  line?: number;
  message: string;
};

export type LoomValidateResult = {
  errorCount: number;
  errors: LoomValidationError[];
  filesChecked: number;
  root: string;
};

export type LoomBuildResult = {
  durationMs: number;
  outDir: string;
  pageCount: number;
  root: string;
};

export type LoomDevResult = {
  close: () => Promise<void>;
  pageCount: number;
  url: string;
};

export type LoomListCommand = (input: { root: string }) => Promise<LoomListResult>;
export type LoomValidateCommand = (input: { root: string }) => Promise<LoomValidateResult>;
export type LoomBuildCommand = (input: {
  outDir: string;
  root: string;
  siteTitle: string;
}) => Promise<LoomBuildResult>;
export type LoomDevCommand = (input: {
  port: number;
  root: string;
  siteTitle: string;
}) => Promise<LoomDevResult>;

export type LoomCommandContext = {
  build: LoomBuildCommand;
  dev: LoomDevCommand;
  list: LoomListCommand;
  validate: LoomValidateCommand;
};

export type LoomPlugin<ProvidesContext extends object = object, NeedsContext extends object = object> = {
  name: string;
  setup: (
    context: {
      config: LoomResolvedConfig;
      root: string;
    } & NeedsContext & Record<string, unknown>
  ) => MaybePromise<ProvidesContext | void>;
};

export type LoomConfig = {
  plugins?: Array<LoomPlugin<any, any> | false | null | undefined>;
  site?: {
    title?: string;
  };
};

export type LoomResolvedConfig = {
  configPath?: string;
  plugins: LoomPlugin<any, any>[];
  root: string;
  site: {
    title: string;
  };
};

const CONFIG_NAMES = [
  'loom.config.ts',
  'loom.config.mts',
  'loom.config.js',
  'loom.config.mjs',
  'loom.config.cjs'
] as const;

const DEFAULT_SITE_TITLE = 'Loom Docs';

const IGNORED_DIRS = new Set(['.git', '.loom', 'dist', 'node_modules']);

export function defineLoomConfig(config: LoomConfig): LoomConfig {
  return config;
}

export function definePlugin<ProvidesContext extends object = object, NeedsContext extends object = object>(
  plugin: LoomPlugin<ProvidesContext, NeedsContext>
): LoomPlugin<ProvidesContext, NeedsContext> {
  return plugin;
}

export async function resolveLoomRuntime(root: string): Promise<{
  config: LoomResolvedConfig;
  context: LoomCommandContext & Record<string, unknown>;
}> {
  const config = await loadLoomConfig(root);
  const context = await registerPlugins(config);
  enforceCommandContract(context);

  return {
    config,
    context
  };
}

export async function loadLoomConfig(root: string): Promise<LoomResolvedConfig> {
  const absoluteRoot = resolve(root);
  const configPath = await findConfigPath(absoluteRoot);

  if (!configPath) {
    return normalizeConfig(absoluteRoot, undefined);
  }

  const loaded = await importConfigModule(configPath);
  return normalizeConfig(absoluteRoot, loaded, configPath);
}

export async function registerPlugins(config: LoomResolvedConfig): Promise<Record<string, unknown>> {
  const context: Record<string, unknown> = {
    config,
    root: config.root
  };

  for (const plugin of config.plugins) {
    let provided: object | void;

    try {
      provided = await plugin.setup(context);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Plugin "${plugin.name}" failed during setup: ${message}`);
    }

    if (!provided || typeof provided !== 'object') {
      continue;
    }

    for (const [key, value] of Object.entries(provided)) {
      context[key] = value;
    }
  }

  return context;
}

export function enforceCommandContract(context: Record<string, unknown>): asserts context is Record<
  string,
  unknown
> & LoomCommandContext {
  const missing: string[] = [];

  if (typeof context.list !== 'function') {
    missing.push('list');
  }
  if (typeof context.validate !== 'function') {
    missing.push('validate');
  }
  if (typeof context.build !== 'function') {
    missing.push('build');
  }
  if (typeof context.dev !== 'function') {
    missing.push('dev');
  }

  if (missing.length > 0) {
    throw new Error(formatMissingContractError(missing));
  }
}

export const list: LoomListCommand = async ({ root }): Promise<LoomListResult> => {
  const absoluteRoot = resolve(root);
  const files: string[] = [];

  await walkDocs(absoluteRoot, absoluteRoot, files);
  files.sort((left, right) => left.localeCompare(right));

  return {
    root: absoluteRoot,
    files,
    count: files.length
  };
};

export const validate: LoomValidateCommand = async ({ root }): Promise<LoomValidateResult> => {
  const listed = await list({ root });
  const errors: LoomValidationError[] = [];

  for (const file of listed.files) {
    const absolutePath = join(listed.root, file);
    const source = await readFile(absolutePath, 'utf8');

    try {
      await compile(source, { jsx: true });
    } catch (error) {
      const typed = error as Error & {
        position?: {
          end?: { column?: number; line?: number };
          start?: { column?: number; line?: number };
        };
        reason?: string;
      };

      const position = typed.position?.start ?? typed.position?.end;
      errors.push({
        file,
        line: position?.line,
        column: position?.column,
        message: typed.reason ?? typed.message ?? 'Failed to parse document source.'
      });
    }
  }

  return {
    root: listed.root,
    filesChecked: listed.count,
    errors,
    errorCount: errors.length
  };
};

export function toRoutePath(filePath: string): string {
  const normalized = filePath.replace(/\.(md|mdx)$/i, '');
  if (normalized.toLowerCase() === 'index') {
    return '/';
  }
  if (normalized.toLowerCase().endsWith('/index')) {
    return `/${normalized.slice(0, -'/index'.length)}`;
  }
  return `/${normalized}`;
}

export function toDefaultTitle(filePath: string): string {
  const withoutExt = filePath.replace(/\.(md|mdx)$/i, '');
  const base = basename(withoutExt);

  if (base.toLowerCase() !== 'index') {
    return base
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
      .join(' ');
  }

  const parent = basename(dirname(withoutExt));
  if (!parent || parent === '.' || parent === '/') {
    return 'Home';
  }

  return parent
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

async function findConfigPath(root: string): Promise<string | undefined> {
  for (const fileName of CONFIG_NAMES) {
    const candidate = join(root, fileName);

    try {
      await readFile(candidate, 'utf8');
      return candidate;
    } catch {
      continue;
    }
  }

  return undefined;
}

async function importConfigModule(configPath: string): Promise<unknown> {
  const extension = extname(configPath).toLowerCase();
  if (extension !== '.ts' && extension !== '.mts') {
    const loaded = await import(pathToFileURL(configPath).href);
    return (loaded.default ?? loaded) as unknown;
  }

  const source = await readFile(configPath, 'utf8');

  let transpiledSource: string;
  try {
    const typescript = await import('typescript');
    transpiledSource = typescript.transpileModule(source, {
      compilerOptions: {
        module: typescript.ModuleKind.ESNext,
        target: typescript.ScriptTarget.ES2022
      },
      fileName: configPath
    }).outputText;
  } catch {
    throw new Error(
      'Unable to load TypeScript Loom config. Install TypeScript in the CLI runtime environment.'
    );
  }

  const tempConfigPath = join(
    dirname(configPath),
    `.loom.config.runtime.${Date.now()}-${Math.random().toString(16).slice(2)}.mjs`
  );

  try {
    await writeFile(tempConfigPath, transpiledSource, 'utf8');
    const loaded = await import(pathToFileURL(tempConfigPath).href);
    return (loaded.default ?? loaded) as unknown;
  } finally {
    await rm(tempConfigPath, { force: true });
  }
}

function normalizeConfig(root: string, raw: unknown, configPath?: string): LoomResolvedConfig {
  if (raw !== undefined && raw !== null && typeof raw !== 'object') {
    throw new Error('Invalid Loom config: expected an object export.');
  }

  const rawConfig = (raw ?? {}) as LoomConfig;
  const plugins = (rawConfig.plugins ?? []).filter(Boolean) as LoomPlugin<any, any>[];

  for (const plugin of plugins) {
    if (!plugin || typeof plugin !== 'object') {
      throw new Error('Invalid Loom config: each plugin must be an object.');
    }

    if (!plugin.name || typeof plugin.name !== 'string') {
      throw new Error('Invalid Loom config: each plugin must provide a non-empty name.');
    }

    if (typeof plugin.setup !== 'function') {
      throw new Error(`Invalid Loom config: plugin "${plugin.name}" must provide a setup function.`);
    }
  }

  return {
    root,
    configPath,
    plugins,
    site: {
      title: rawConfig.site?.title?.trim() || DEFAULT_SITE_TITLE
    }
  };
}

async function walkDocs(root: string, current: string, files: string[]): Promise<void> {
  const entries = await readdir(current, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) {
      continue;
    }

    const absolutePath = join(current, entry.name);

    if (entry.isDirectory()) {
      await walkDocs(root, absolutePath, files);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!entry.name.toLowerCase().endsWith('.md') && !entry.name.toLowerCase().endsWith('.mdx')) {
      continue;
    }

    files.push(toPosixPath(relative(root, absolutePath)));
  }
}

function formatMissingContractError(missing: string[]): string {
  const required = missing.join(', ');
  const hasBuildOrDevGap = missing.includes('build') || missing.includes('dev');

  const lines = [
    `Invalid Loom config: plugin context is missing required command function(s): ${required}.`,
    'Ensure your plugins provide list, validate, build, and dev.'
  ];

  if (hasBuildOrDevGap) {
    lines.push(
      'Hint: build/dev are typically provided by a renderer plugin. Register @loom/renderer-vite-react in loom.config.ts.'
    );
  }

  return lines.join(' ');
}

function toPosixPath(filePath: string): string {
  return filePath.split(sep).join('/');
}
