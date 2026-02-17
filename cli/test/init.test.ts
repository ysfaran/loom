import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
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

describe('loom init', () => {
  it('creates a default loom.config.ts', async () => {
    const targetPath = await mkdtemp(join(tmpdir(), 'loom-init-'));
    tempDirs.push(targetPath);

    const { stdout } = await execFileAsync('node', [cliPath, 'init', targetPath], {
      cwd: repoRoot
    });

    expect(stdout).toContain('Created');

    const configSource = await readFile(join(targetPath, 'loom.config.ts'), 'utf8');
    expect(configSource).toContain("import { viteReactRendererPlugin } from '@loom/renderer-vite-react';");
    expect(configSource).toContain('plugins: [viteReactRendererPlugin]');
  });

  it('fails when config already exists', async () => {
    const targetPath = await mkdtemp(join(tmpdir(), 'loom-init-existing-'));
    tempDirs.push(targetPath);

    await execFileAsync('node', [cliPath, 'init', targetPath], {
      cwd: repoRoot
    });

    try {
      await execFileAsync('node', [cliPath, 'init', targetPath], {
        cwd: repoRoot
      });
      throw new Error('Expected init command to fail when config already exists.');
    } catch (error) {
      const execError = error as { code?: number; stdout?: string };
      expect(execError.code).toBe(1);
      expect(execError.stdout ?? '').toContain('Config already exists');
    }
  });
});
