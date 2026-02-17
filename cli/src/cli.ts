#!/usr/bin/env node

import { Command } from 'commander';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { constants as fsConstants } from 'node:fs';
import { createLoom, loadLoomConfig, resolveRendererFromContext, scanMdxFiles, validateMdxFiles } from '@loom/core';

function resolveTargetPath(inputPath?: string): string {
  return resolve(process.cwd(), inputPath ?? '.');
}

const program = new Command();

async function createRuntime(targetPath: string) {
  const config = await loadLoomConfig(targetPath);
  const loom = createLoom();

  for (const plugin of config.runtimePlugins) {
    await loom.use(plugin);
  }

  return {
    config,
    renderer: resolveRendererFromContext(loom.context)
  };
}

program
  .name('loom')
  .description('Loom CLI for MDX documentation workflows')
  .version('0.1.0');

program
  .command('init [path]')
  .description('Create a loom.config.ts with the default renderer plugin')
  .action(async (path: string | undefined) => {
    const targetPath = resolveTargetPath(path);
    const configPath = join(targetPath, 'loom.config.ts');

    await mkdir(targetPath, { recursive: true });

    try {
      await access(configPath, fsConstants.F_OK);
      console.log(`Config already exists: ${configPath}`);
      process.exitCode = 1;
      return;
    } catch {
      // No config yet.
    }

    const configSource = `import { defineLoomConfig } from '@loom/core';
import { viteReactRendererPlugin } from '@loom/renderer-vite-react';

export default defineLoomConfig({
  plugins: [viteReactRendererPlugin]
});
`;

    await mkdir(dirname(configPath), { recursive: true });
    await writeFile(configPath, configSource, 'utf8');

    console.log(`Created ${configPath}`);
  });

program
  .command('list [path]')
  .alias('ls')
  .description('List .mdx files from a target path (default: current directory)')
  .action(async (path: string | undefined) => {
    const targetPath = resolveTargetPath(path);
    const scanResult = await scanMdxFiles(targetPath);

    for (const file of scanResult.files) {
      console.log(file);
    }
  });

program
  .command('validate [path]')
  .description('Validate MDX files from a target path (default: current directory)')
  .action(async (path: string | undefined) => {
    const targetPath = resolveTargetPath(path);
    const result = await validateMdxFiles(targetPath);

    if (result.errorCount === 0) {
      console.log(`Validated ${result.filesChecked} MDX file${result.filesChecked === 1 ? '' : 's'} with no errors.`);
    } else {
      for (const error of result.errors) {
        const location =
          error.line !== undefined && error.column !== undefined
            ? `${error.file}:${error.line}:${error.column}`
            : error.file;
        console.log(`${location} [${error.ruleId}] ${error.message}`);
      }
      console.log(
        `Validation failed: ${result.errorCount} error${result.errorCount === 1 ? '' : 's'} in ${result.filesChecked} file${
          result.filesChecked === 1 ? '' : 's'
        }.`
      );
      process.exitCode = 1;
    }
  });

program
  .command('build [path]')
  .description('Build docs site from a target path (default: current directory)')
  .option('--out <path>', 'Output directory', 'dist/docs')
  .action(async (path: string | undefined, options: { out: string }) => {
    const targetPath = resolveTargetPath(path);
    const outPath = resolve(process.cwd(), options.out);
    const { config, renderer } = await createRuntime(targetPath);
    const validation = await validateMdxFiles(targetPath);

    if (validation.errorCount > 0) {
      for (const error of validation.errors) {
        const location =
          error.line !== undefined && error.column !== undefined
            ? `${error.file}:${error.line}:${error.column}`
            : error.file;
        console.log(`${location} [${error.ruleId}] ${error.message}`);
      }
      console.log(`Build failed: ${validation.errorCount} validation error${validation.errorCount === 1 ? '' : 's'}.`);
      process.exitCode = 1;
      return;
    }

    if (!renderer) {
      console.log('No renderer configured. Add a renderer plugin as the first entry in plugins[] or run "loom init".');
      process.exitCode = 1;
      return;
    }

    const buildResult = await renderer.build({
      sourceRoot: targetPath,
      outputDir: outPath,
      config
    });

    console.log(
      `Built ${buildResult.pageCount} page${buildResult.pageCount === 1 ? '' : 's'} to ${buildResult.outDir} in ${buildResult.durationMs}ms.`
    );
  });

program
  .command('dev [path]')
  .description('Start docs dev server with hot reloading (default: current directory)')
  .option('--port <port>', 'Port for dev server', '4173')
  .action(async (path: string | undefined, options: { port: string }) => {
    const targetPath = resolveTargetPath(path);
    const port = Number.parseInt(options.port, 10);

    if (Number.isNaN(port) || port <= 0) {
      console.log(`Invalid port: ${options.port}`);
      process.exitCode = 1;
      return;
    }

    const { config, renderer } = await createRuntime(targetPath);

    if (!renderer) {
      console.log('No renderer configured. Add a renderer plugin as the first entry in plugins[] or run "loom init".');
      process.exitCode = 1;
      return;
    }

    const server = await renderer.dev({
      sourceRoot: targetPath,
      port,
      config
    });
    console.log(`Serving ${server.pageCount} page${server.pageCount === 1 ? '' : 's'} at ${server.url}`);

    const shutdown = async (): Promise<void> => {
      await server.close();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });

program.parseAsync(process.argv);
