import { readFile, readdir } from 'node:fs/promises';
import { compile } from '@mdx-js/mdx';
import { join, relative, resolve, sep } from 'node:path';

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
