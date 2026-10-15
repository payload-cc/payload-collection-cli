import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushOutput, runWithCompletionGuard } from '../src/completion';

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


describe('CLI output flush', () => {
  it('waits for both stdout and stderr queues', async () => {
    const callbacks: (() => void)[] = [];
    const write = vi.fn((_chunk: string, callback: () => void) => { callbacks.push(callback); });
    let flushed = false;
    const result = flushOutput([{ write }, { write }] as any).then(() => { flushed = true; });
    expect(write).toHaveBeenCalledTimes(2);
    callbacks[0]();
    await Promise.resolve();
    expect(flushed).toBe(false);
    callbacks[1]();
    await result;
    expect(flushed).toBe(true);
  });
  it('completes when the output queues are already drained', async () => {
    const write = vi.fn((_chunk: string, callback: () => void) => callback());
    await flushOutput([{ write }] as any);
    expect(write).toHaveBeenCalledWith('', expect.any(Function));
  });
});
