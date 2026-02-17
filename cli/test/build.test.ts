import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const cliPath = resolve(import.meta.dirname, '../dist/cli.js');
const repoRoot = resolve(import.meta.dirname, '../../..');

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('loom build', () => {
  it('builds static output for valid mdx', async () => {
    const scenarioPath = resolve(import.meta.dirname, 'scenarios/build-valid');
    const outDir = await mkdtemp(join(tmpdir(), 'loom-build-'));
    tempDirs.push(outDir);

    const { stdout } = await execFileAsync('node', [cliPath, 'build', scenarioPath, '--out', outDir], {
      cwd: repoRoot
    });

    expect(stdout).toContain('Built 2 pages to');

    const indexHtml = await readFile(join(outDir, 'index.html'), 'utf8');
    const assetsDirEntries = await readdir(join(outDir, 'assets'));

    expect(indexHtml).toContain('<div id="root"></div>');
    expect(assetsDirEntries.some((entry) => entry.endsWith('.js'))).toBe(true);
  });

  it('builds static output with astro renderer', async () => {
    const scenarioPath = resolve(import.meta.dirname, 'scenarios/build-valid-astro');
    const outDir = await mkdtemp(join(tmpdir(), 'loom-build-astro-'));
    tempDirs.push(outDir);

    const { stdout } = await execFileAsync('node', [cliPath, 'build', scenarioPath, '--out', outDir], {
      cwd: repoRoot
    });

    expect(stdout).toContain('Built 2 pages to');

    const indexHtml = await readFile(join(outDir, 'index.html'), 'utf8');
    const setupHtml = await readFile(join(outDir, 'guide', 'setup', 'index.html'), 'utf8');

    expect(indexHtml).toContain('Loom Docs');
    expect(indexHtml).toContain('Welcome to docs.');
    expect(setupHtml).toContain('Run install first.');
  });

  it('loads loom.config.ts plugins and renderer defaults', async () => {
    const scenarioPath = resolve(import.meta.dirname, 'scenarios/build-with-config');
    const outDir = await mkdtemp(join(tmpdir(), 'loom-build-config-'));
    tempDirs.push(outDir);

    const { stdout } = await execFileAsync('node', [cliPath, 'build', scenarioPath, '--out', outDir], {
      cwd: repoRoot
    });

    expect(stdout).toContain('Built 2 pages to');

    const indexHtml = await readFile(join(outDir, 'index.html'), 'utf8');
    const adrTreeHtml = await readFile(join(outDir, 'adr-tree', 'index.html'), 'utf8');

    expect(indexHtml).toContain('Plugin Config Docs');
    expect(indexHtml).toContain('Plugin transform marker.');
    expect(indexHtml).toContain('id="adr-banner"');
    expect(indexHtml).toContain('id="plugin-header"');
    expect(indexHtml).toContain('id="plugin-footer"');
    expect(adrTreeHtml).toContain('ADR Tree');
    expect(indexHtml).not.toContain('<div id="root"></div>');
  });

  it('fails when validation finds invalid mdx', async () => {
    const scenarioPath = resolve(import.meta.dirname, 'scenarios/build-invalid');
    const outDir = await mkdtemp(join(tmpdir(), 'loom-build-'));
    tempDirs.push(outDir);

    try {
      await execFileAsync('node', [cliPath, 'build', scenarioPath, '--out', outDir], {
        cwd: repoRoot
      });
      throw new Error('Expected build command to fail for invalid MDX.');
    } catch (error) {
      const execError = error as { code?: number; stdout?: string };
      expect(execError.code).toBe(1);
      expect(execError.stdout ?? '').toContain('broken.mdx');
      expect(execError.stdout ?? '').toContain('[mdx/parse-error]');
      expect(execError.stdout ?? '').toContain('Build failed: 1 validation error.');
    }
  });

  it('fails when no renderer is configured', async () => {
    const scenarioPath = resolve(import.meta.dirname, 'scenarios/build-valid');
    const scenarioDir = await mkdtemp(join(tmpdir(), 'loom-build-no-renderer-'));
    const outDir = await mkdtemp(join(tmpdir(), 'loom-build-'));
    tempDirs.push(scenarioDir);
    tempDirs.push(outDir);

    await cp(scenarioPath, scenarioDir, { recursive: true });
    await rm(join(scenarioDir, 'loom.config.ts'), { force: true });

    try {
      await execFileAsync('node', [cliPath, 'build', scenarioDir, '--out', outDir], {
        cwd: repoRoot
      });
      throw new Error('Expected build command to fail without a configured renderer.');
    } catch (error) {
      const execError = error as { code?: number; stdout?: string };
      expect(execError.code).toBe(1);
      expect(execError.stdout ?? '').toContain('No renderer configured.');
    }
  });
});
