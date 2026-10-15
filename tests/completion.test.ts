import { afterEach, describe, expect, it, vi } from 'vitest';
import { runWithCompletionGuard } from '../src/completion';

const originalExitCode = process.exitCode;
afterEach(() => { process.exitCode = originalExitCode; vi.restoreAllMocks(); });
describe('CLI completion guard', () => {
  it('does not let an unresolved asynchronous operation exit successfully', () => {
    let handler: () => void = () => {};
    vi.spyOn(process, 'once').mockImplementation(((event: string, callback: () => void) => {
      if (event === 'beforeExit') handler = callback;
      return process;
    }) as any);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    void runWithCompletionGuard(() => new Promise(() => {}));
    handler();
    expect(process.exitCode).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('did not complete'));
  });
  it('removes the guard after success', async () => {
    const remove = vi.spyOn(process, 'removeListener');
    await runWithCompletionGuard(async () => {});
    expect(remove).toHaveBeenCalledWith('beforeExit', expect.any(Function));
    expect(process.exitCode).toBe(originalExitCode);
  });
  it('propagates real failures and removes the guard', async () => {
    const remove = vi.spyOn(process, 'removeListener');
    await expect(runWithCompletionGuard(async () => { throw new Error('original failure'); }))
      .rejects.toThrow('original failure');
    expect(remove).toHaveBeenCalledWith('beforeExit', expect.any(Function));
  });
});
