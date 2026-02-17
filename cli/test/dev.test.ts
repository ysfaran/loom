import { execFile } from 'node:child_process';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const cliPath = resolve(import.meta.dirname, '../dist/cli.js');
const repoRoot = resolve(import.meta.dirname, '../../..');
const scenarioPath = resolve(import.meta.dirname, 'scenarios/build-valid');
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('loom dev', () => {
  it('rejects invalid port values', async () => {
    try {
      await execFileAsync('node', [cliPath, 'dev', scenarioPath, '--port', 'invalid'], {
        cwd: repoRoot
      });
      throw new Error('Expected dev command to fail with invalid port.');
    } catch (error) {
      const execError = error as { code?: number; stdout?: string };
      expect(execError.code).toBe(1);
      expect(execError.stdout ?? '').toContain('Invalid port: invalid');
    }
  });

  it('fails when no renderer is configured', async () => {
    const scenarioDir = await mkdtemp(join(tmpdir(), 'loom-dev-no-renderer-'));
    tempDirs.push(scenarioDir);
    await cp(scenarioPath, scenarioDir, { recursive: true });
    await rm(join(scenarioDir, 'loom.config.ts'), { force: true });

    try {
      await execFileAsync('node', [cliPath, 'dev', scenarioDir, '--port', '4173'], {
        cwd: repoRoot
      });
      throw new Error('Expected dev command to fail without a configured renderer.');
    } catch (error) {
      const execError = error as { code?: number; stdout?: string };
      expect(execError.code).toBe(1);
      expect(execError.stdout ?? '').toContain('No renderer configured.');
    }
  });
});
