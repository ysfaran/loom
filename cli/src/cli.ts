#!/usr/bin/env node

import { Command } from 'commander';
import { resolve } from 'node:path';
import { scanMdxFiles, validateMdxFiles } from '@loom/core';
import { buildWithViteReact, startViteReactDevServer } from '@loom/renderer-vite-react';

function resolveTargetPath(inputPath?: string): string {
  return resolve(process.cwd(), inputPath ?? '.');
}

const program = new Command();

program
  .name('loom')
  .description('Loom CLI for MDX documentation workflows')
  .version('0.1.0');

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

    const buildResult = await buildWithViteReact(targetPath, outPath);

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

    const server = await startViteReactDevServer(targetPath, port);
    console.log(`Serving ${server.pageCount} page${server.pageCount === 1 ? '' : 's'} at ${server.url}`);

    const shutdown = async (): Promise<void> => {
      await server.close();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });

program.parseAsync(process.argv);
