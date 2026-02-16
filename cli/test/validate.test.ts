import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const cliPath = resolve(import.meta.dirname, '../dist/cli.js');

function getRepoRoot(): string {
  return resolve(import.meta.dirname, '../../..');
}

describe('loom validate', () => {
  it('returns success for valid mdx', async () => {
    const scenarioPath = resolve(import.meta.dirname, 'scenarios/validate-valid');
    const { stdout } = await execFileAsync('node', [cliPath, 'validate', scenarioPath], {
      cwd: getRepoRoot()
    });

    expect(stdout).toContain('Validated 1 MDX file with no errors.');
  });

  it('returns exit code 1 for invalid mdx', async () => {
    const scenarioPath = resolve(import.meta.dirname, 'scenarios/validate-invalid');

    try {
      await execFileAsync('node', [cliPath, 'validate', scenarioPath], {
        cwd: getRepoRoot()
      });
      throw new Error('Expected validate command to fail for invalid MDX.');
    } catch (error) {
      const execError = error as { code?: number; stdout?: string };
      expect(execError.code).toBe(1);
      expect(execError.stdout ?? '').toContain('broken.mdx');
      expect(execError.stdout ?? '').toContain('[mdx/parse-error]');
      expect(execError.stdout ?? '').toContain('Validation failed: 1 error in 1 file.');
    }
  });
});
