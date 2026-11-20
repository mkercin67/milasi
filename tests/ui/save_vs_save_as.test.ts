// SPDX-License-Identifier: GPL-3.0-or-later
/** Save vs Save As semantics of the native file picker path. */
import { describe, expect, it, vi } from 'vitest';
import { saveViaNativePicker, type SaveFileHandle } from '../../src/ui/app/useAppStorage';

function makeHandle() {
  const write = vi.fn(async () => undefined);
  const close = vi.fn(async () => undefined);
  const handle: SaveFileHandle = { createWritable: async () => ({ write, close }) };
  return { handle, write, close };
}

describe('Save / Save As', () => {
  it('Save As always opens the picker, even when a file is already remembered', async () => {
    const old = makeHandle();
    const fresh = makeHandle();
    const picker = vi.fn(async () => fresh.handle);
    const r = await saveViaNativePicker(picker, 'X', 'a.sfscore', true, old.handle);
    expect(picker).toHaveBeenCalledTimes(1);
    expect(old.write).not.toHaveBeenCalled();
    expect(fresh.write).toHaveBeenCalledWith('X');
    expect(r).toEqual({ status: 'saved', handle: fresh.handle });
  });

  it('Save rewrites the remembered file without opening the picker', async () => {
    const old = makeHandle();
    const picker = vi.fn(async () => makeHandle().handle);
    const r = await saveViaNativePicker(picker, 'Y', 'a.sfscore', false, old.handle);
    expect(picker).not.toHaveBeenCalled();
    expect(old.write).toHaveBeenCalledWith('Y');
    expect(r.status).toBe('saved');
  });

  it('first Save opens the picker and remembers the handle', async () => {
    const h = makeHandle();
    const picker = vi.fn(async () => h.handle);
    const r = await saveViaNativePicker(picker, 'Z', 'a.sfscore', false, null);
    expect(picker).toHaveBeenCalledTimes(1);
    expect(r.handle).toBe(h.handle);
  });

  it('cancelled picker aborts and keeps the old handle; no picker means download fallback', async () => {
    const old = makeHandle();
    const abort = Object.assign(new Error('x'), { name: 'AbortError' });
    const r = await saveViaNativePicker(async () => { throw abort; }, 'Z', 'a', true, old.handle);
    expect(r).toEqual({ status: 'aborted', handle: old.handle });
    const u = await saveViaNativePicker(undefined, 'Z', 'a', false, null);
    expect(u.status).toBe('unavailable');
  });
});
