#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { Command } from 'commander';

import { resolveLoomRuntime } from '@loom/core';

type LoomRuntime = Awaited<ReturnType<typeof resolveLoomRuntime>>;

const DEFAULT_DEV_PORT = 4173;
const DEFAULT_OUT_DIR = 'dist';

function createProgram(): Command {
  const program = new Command();

  program
    .name('loom')
    .description('Plugin-first documentation CLI')
    .showHelpAfterError('(use --help for usage)');

  program
    .command('init')
    .description('Create a starter Loom project config and docs scaffold')
    .argument('[path]', 'project path', process.cwd())
    .action(async (pathArg: string) => {
      await scaffoldInitProject(formatPath(pathArg));
      console.log(`created ${join(formatPath(pathArg), 'loom.config.ts')}`);
      console.log(`created ${join(formatPath(pathArg), 'docs/index.mdx')}`);
    });

  program
    .command('list')
    .description('Discover Markdown and MDX documentation files')
    .argument('[path]', 'project path', process.cwd())
    .action(async (pathArg: string) => {
      const code = await runList(pathArg);
      if (code !== 0) {
        process.exitCode = code;
      }
    });

  program
    .command('validate')
    .description('Validate Markdown/MDX input for parse errors')
    .argument('[path]', 'project path', process.cwd())
    .action(async (pathArg: string) => {
      const code = await runValidate(pathArg);
      if (code !== 0) {
        process.exitCode = code;
      }
    });

  program
    .command('build')
    .description('Build static documentation output')
    .argument('[path]', 'project path', process.cwd())
    .option('-o, --out <path>', 'output directory', DEFAULT_OUT_DIR)
    .action(async (pathArg: string, options: { out: string }) => {
      const code = await runBuild(pathArg, options.out);
      if (code !== 0) {
        process.exitCode = code;
      }
    });

  program
    .command('dev')
    .description('Start the local development server')
    .argument('[path]', 'project path', process.cwd())
    .option('-p, --port <port>', 'server port', `${DEFAULT_DEV_PORT}`)
    .action(async (pathArg: string, options: { port: string }) => {
      const parsedPort = Number.parseInt(options.port, 10);
      if (!Number.isFinite(parsedPort) || parsedPort <= 0) {
        throw new Error(`Invalid --port value: ${options.port}`);
      }

      await runDev(pathArg, parsedPort);
    });

  return program;
}

export async function scaffoldInitProject(projectRoot: string): Promise<void> {
  const root = resolve(projectRoot);
  await ensureConfigDoesNotExist(root);

  const configPath = join(root, 'loom.config.ts');
  const docsDir = join(root, 'docs');
  const indexPath = join(docsDir, 'index.mdx');

  await mkdir(docsDir, { recursive: true });

  const configSource = `import { defineLoomConfig } from '@loom/core';
import { loomRendererViteReact } from '@loom/renderer-vite-react';

export default defineLoomConfig({
  site: {
    title: 'Loom Docs'
  },
  plugins: [loomRendererViteReact()]
});
`;

  const docsSource = `# Loom Docs

Welcome to Loom.

Edit this file and run \`loom dev\` to preview your docs.
`;

  await writeFile(configPath, configSource, 'utf8');
  await writeFile(indexPath, docsSource, 'utf8');
}

async function runList(pathArg: string | undefined): Promise<number> {
  const runtime = await resolveLoomRuntime(formatPath(pathArg));
  const result = await runtime.context.list({ root: runtime.config.root });

  console.log(`root: ${result.root}`);
  console.log(`count: ${result.count}`);

  for (const file of result.files) {
    console.log(file);
  }

  return 0;
}

async function runValidate(pathArg: string | undefined): Promise<number> {
  const runtime = await resolveLoomRuntime(formatPath(pathArg));
  const result = await runtime.context.validate({ root: runtime.config.root });

  if (result.errorCount === 0) {
    console.log(`validated ${result.filesChecked} files with no errors`);
    return 0;
  }

  console.error(`validation failed with ${result.errorCount} error(s)`);

  for (const error of result.errors) {
    const location =
      error.line !== undefined && error.column !== undefined
        ? `${error.file}:${error.line}:${error.column}`
        : error.file;
    console.error(`${location} ${error.message}`);
  }

  return 1;
}

async function runBuild(pathArg: string | undefined, outDir: string): Promise<number> {
  const runtime = await resolveLoomRuntime(formatPath(pathArg));
  const result = await runtime.context.build({
    root: runtime.config.root,
    siteTitle: runtime.config.site.title,
    outDir
  });

  console.log(`built ${result.pageCount} page(s) to ${result.outDir} in ${result.durationMs}ms`);
  return 0;
}

async function runDev(pathArg: string | undefined, port: number): Promise<number> {
  const runtime = await resolveLoomRuntime(formatPath(pathArg));
  const server = await runtime.context.dev({
    root: runtime.config.root,
    siteTitle: runtime.config.site.title,
    port
  });

  console.log(`dev server running at ${server.url}`);
  console.log(`loaded ${server.pageCount} route(s)`);

  const shutdown = async (): Promise<void> => {
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return new Promise<number>(() => {
    // Keep process alive until interrupted.
  });
}

async function ensureConfigDoesNotExist(projectRoot: string): Promise<void> {
  const candidates = [
    'loom.config.ts',
    'loom.config.mts',
    'loom.config.js',
    'loom.config.mjs',
    'loom.config.cjs'
  ];

  for (const fileName of candidates) {
    try {
      await readFile(join(projectRoot, fileName), 'utf8');
      throw new Error(`A Loom config already exists: ${fileName}`);
    } catch (error) {
      const typed = error as NodeJS.ErrnoException;
      if (typed.code === 'ENOENT') {
        continue;
      }

      if (typed.message.startsWith('A Loom config already exists')) {
        throw typed;
      }

      throw error;
    }
  }
}

function formatPath(inputPath: string | undefined): string {
  return resolve(inputPath ?? process.cwd());
}

const program = createProgram();
const argv = process.argv.slice(2);

if (argv.length === 0) {
  program.outputHelp();
  process.exit(0);
}

program.parseAsync(process.argv, { from: 'node' }).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
