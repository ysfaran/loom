import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { compile } from '@mdx-js/mdx';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

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
    return '';
  }

  if (withoutExt.toLowerCase().endsWith('/index')) {
    return withoutExt.slice(0, -'/index'.length);
  }

  return withoutExt;
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
    const href = route === '' ? '/' : `/${route}`;
    return {
      file,
      href,
      route,
      title: basename(route === '' ? 'index' : route)
    };
  });

  const navHtml = pages
    .map((page) => `<li><a href="${escapeHtml(page.href)}">${escapeHtml(page.route === '' ? 'index' : page.route)}</a></li>`)
    .join('\n');

  await rm(outDir, { force: true, recursive: true });

  for (const page of pages) {
    const outputFile = page.route === '' ? join(outDir, 'index.html') : join(outDir, page.route, 'index.html');
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
