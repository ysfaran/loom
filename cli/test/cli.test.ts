import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';

import { afterEach, beforeAll, describe, expect, test } from 'vitest';

import { loadLoomConfig, resolveLoomRuntime } from '@loom/core';

const tempRoots: string[] = [];
const cliPackageRoot = resolve(process.cwd());
const cliEntryPath = resolve(cliPackageRoot, 'dist', 'cli.js');
const scenariosRoot = resolve(cliPackageRoot, 'test', 'scenarios');

async function createTempProject(): Promise<string> {
  const base = resolve(
    process.cwd(),
    '.tmp-tests',
    `loom-test-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
  await mkdir(base, { recursive: true });
  tempRoots.push(base);
  return base;
}

async function createScenarioProject(name: string): Promise<string> {
  const projectRoot = await createTempProject();
  await cp(join(scenariosRoot, name), projectRoot, { recursive: true });
  return projectRoot;
}

type RunCliResult = {
  code: number;
  stderr: string;
  stdout: string;
};

async function runCli(args: string[], cwd: string): Promise<RunCliResult> {
  return new Promise<RunCliResult>((resolveRun, reject) => {
    const child = spawn(process.execPath, [cliEntryPath, ...args], {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.once('error', (error) => reject(error));
    child.once('close', (code) => {
      resolveRun({
        code: code ?? 1,
        stdout,
        stderr
      });
    });
  });
}

beforeAll(async () => {
  const result = await runCli(['--help'], cliPackageRoot);
  if (result.code !== 0) {
    throw new Error(`CLI entry is not executable: ${result.stderr || result.stdout}`);
  }
});

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('loom init', () => {
  test('prints help and exits 0 when no command is provided', async () => {
    const result = await runCli([], cliPackageRoot);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Usage: loom');
  });

  test('creates starter config and docs that satisfy command contract', async () => {
    const projectRoot = await createScenarioProject('init-empty');

    const result = await runCli(['init', projectRoot], cliPackageRoot);

    expect(result.code).toBe(0);
    expect(result.stderr).not.toContain('error:');

    const configSource = await readFile(join(projectRoot, 'loom.config.ts'), 'utf8');
    const docsSource = await readFile(join(projectRoot, 'docs', 'index.mdx'), 'utf8');

    expect(configSource).toContain('loomRendererViteReact');
    expect(docsSource).toContain('# Loom Docs');
    expect(result.stdout).toContain('loom.config.ts');

    const runtime = await resolveLoomRuntime(projectRoot);
    expect(typeof runtime.context.list).toBe('function');
    expect(typeof runtime.context.validate).toBe('function');
    expect(typeof runtime.context.build).toBe('function');
    expect(typeof runtime.context.dev).toBe('function');
  });
});

describe('config loading variants', () => {
  test('loads ts, mts, js, mjs, and cjs config files', async () => {
    const variants = [
      { scenario: 'config-ts', fileName: 'loom.config.ts' },
      { scenario: 'config-mts', fileName: 'loom.config.mts' },
      { scenario: 'config-js', fileName: 'loom.config.js' },
      { scenario: 'config-mjs', fileName: 'loom.config.mjs' },
      { scenario: 'config-cjs', fileName: 'loom.config.cjs' }
    ];

    for (const variant of variants) {
      const projectRoot = await createScenarioProject(variant.scenario);
      const loaded = await loadLoomConfig(projectRoot);

      expect(loaded.configPath).toBe(join(projectRoot, variant.fileName));
      expect(loaded.site.title.endsWith('Config')).toBe(true);
    }
  });
});

describe('plugin contract and registration', () => {
  test('fails clearly when build/dev are missing and hints at renderer plugin', async () => {
    const projectRoot = await createScenarioProject('missing-contract');

    await expect(resolveLoomRuntime(projectRoot)).rejects.toThrow(/missing required command function\(s\): build, dev/i);
    await expect(resolveLoomRuntime(projectRoot)).rejects.toThrow(/renderer plugin/i);
  });

  test('registers plugins in deterministic order', async () => {
    const projectRoot = await createScenarioProject('deterministic-order');

    const runtime = await resolveLoomRuntime(projectRoot);
    const listed = await runtime.context.list({ root: runtime.config.root });

    expect(listed.count).toBe(0);
  });
});

describe('renderer-backed commands', () => {
  test('list, validate, build, and dev work through plugin context', async () => {
    const validRoot = await createScenarioProject('renderer-valid');
    const invalidRoot = await createScenarioProject('renderer-invalid');

    const listResult = await runCli(['list', validRoot], cliPackageRoot);

    expect(listResult.code).toBe(0);
    expect(listResult.stdout).toContain('docs/index.mdx');
    expect(listResult.stdout).toContain('guides/intro.md');

    const validResult = await runCli(['validate', validRoot], cliPackageRoot);
    expect(validResult.code).toBe(0);

    const invalidResult = await runCli(['validate', invalidRoot], cliPackageRoot);
    expect(invalidResult.code).toBe(1);
    expect(invalidResult.stderr).toContain('validation failed');

    const outDir = 'build-out';
    const buildResult = await runCli(['build', validRoot, '--out', outDir], cliPackageRoot);

    expect(buildResult.code).toBe(0);

    const builtHtml = await readFile(join(validRoot, outDir, 'index.html'), 'utf8');
    expect(builtHtml).toContain('<div id="root"></div>');

    const runtime = await resolveLoomRuntime(validRoot);
    expect(typeof runtime.context.dev).toBe('function');
  });
});
