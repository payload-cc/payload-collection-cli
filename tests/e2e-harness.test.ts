import { beforeEach, describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { getCollectionData, runCLI, runCLIFull } from '../e2e-tests/utils';

vi.mock('node:child_process', () => ({ spawnSync: vi.fn() }));
const spawn = vi.mocked(spawnSync);
beforeEach(() => {
  spawn.mockReset();
  spawn.mockReturnValue({ stdout: 'ok', stderr: 'warning', status: 0, signal: null } as any);
});
describe('E2E process contract', () => {
  it('preserves successful stderr and uses a literal argument array', () => {
    const data = JSON.stringify({ name: `O'Brien $(touch never) and spaces` });
    expect(runCLIFull(['categories', 'create', data])).toEqual({ stdout: 'ok', stderr: 'warning', status: 0 });
    expect(spawn).toHaveBeenCalledWith(process.execPath,
      expect.arrayContaining([data]), expect.objectContaining({ shell: false, timeout: 55000 }));
  });
  it('requires failures to be explicitly expected', () => {
    spawn.mockReturnValue({ stdout: '', stderr: 'error', status: 1, signal: null } as any);
    expect(() => runCLI(['bad'])).toThrow('Expected exit 0, got 1');
    expect(runCLI(['bad'], 1)).toBe('error');
  });
  it('fails on spawn errors, timeouts, and signals', () => {
    spawn.mockReturnValue({ error: new Error('ETIMEDOUT') } as any);
    expect(() => runCLIFull([])).toThrow('ETIMEDOUT');
    spawn.mockReturnValue({ stdout: '', stderr: '', status: null, signal: 'SIGTERM' } as any);
    expect(() => runCLIFull([])).toThrow('SIGTERM');
  });
  it('never turns failed database inspection into an empty collection', () => {
    spawn.mockReturnValue({ stdout: '', stderr: 'database unavailable', status: 1, signal: null } as any);
    expect(() => getCollectionData('users')).toThrow('database unavailable');
  });
  it('requires exactly one valid database result', () => {
    expect(() => getCollectionData('users')).toThrow('Missing or ambiguous');
    spawn.mockReturnValue({ stdout: '__E2E_DATA__not-json', stderr: '', status: 0, signal: null } as any);
    expect(() => getCollectionData('users')).toThrow();
    spawn.mockReturnValue({ stdout: '__E2E_DATA__[]\n', stderr: '', status: 0, signal: null } as any);
    expect(getCollectionData('users')).toEqual([]);
  });
});
