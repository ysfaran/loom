import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const cliPath = resolve(import.meta.dirname, '../dist/cli.js');
const scenarioPath = resolve(import.meta.dirname, 'scenarios/basic');

describe('loom list', () => {
  it('lists mdx files recursively as plain paths', async () => {
    const { stdout } = await execFileAsync('node', [cliPath, 'list', scenarioPath], {
      cwd: resolve(import.meta.dirname, '../../..')
    });

    const lines = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    expect(lines).toEqual(['README.mdx', 'apps/frontend/guide.mdx']);
  });

  it('supports ls alias', async () => {
    const { stdout } = await execFileAsync('node', [cliPath, 'ls', scenarioPath], {
      cwd: resolve(import.meta.dirname, '../../..')
    });

    const lines = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    expect(lines).toEqual(['README.mdx', 'apps/frontend/guide.mdx']);
  });
});
