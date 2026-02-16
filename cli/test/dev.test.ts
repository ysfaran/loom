import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const cliPath = resolve(import.meta.dirname, '../dist/cli.js');
const repoRoot = resolve(import.meta.dirname, '../../..');
const scenarioPath = resolve(import.meta.dirname, 'scenarios/build-valid');

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
});
