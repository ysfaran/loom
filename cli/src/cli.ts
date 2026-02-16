#!/usr/bin/env node

import { Command } from 'commander';
import { resolve } from 'node:path';
import { scanMdxFiles, validateMdxFiles } from '@loom/core';

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
  .action((path: string | undefined, options: { out: string }) => {
    const targetPath = resolveTargetPath(path);
    const outPath = resolve(process.cwd(), options.out);

    console.log(`Build is not implemented yet. Target: ${targetPath} Output: ${outPath}`);
  });

program.parseAsync(process.argv);
