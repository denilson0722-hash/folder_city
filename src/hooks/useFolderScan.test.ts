import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useFolderScan } from './useFolderScan';

const originalShowDirectoryPicker = Object.getOwnPropertyDescriptor(window, 'showDirectoryPicker');

afterEach(() => {
  if (originalShowDirectoryPicker) {
    Object.defineProperty(window, 'showDirectoryPicker', originalShowDirectoryPicker);
  } else {
    delete (window as typeof window & { showDirectoryPicker?: unknown }).showDirectoryPicker;
  }
});

describe('useFolderScan', () => {
  it('reports progress for scanned and skipped files, then resets the count', async () => {
    let resolveReadableFile: (file: File) => void;
    let rejectRestrictedFile: (error: Error) => void;
    const readableFile = new Promise<File>((resolve) => {
      resolveReadableFile = resolve;
    });
    const restrictedFile = new Promise<File>((_, reject) => {
      rejectRestrictedFile = reject;
    });
    const directory = {
      kind: 'directory',
      name: 'root',
      async *values() {
        yield {
          kind: 'file',
          name: 'readable.txt',
          getFile: () => readableFile,
        } as unknown as FileSystemFileHandle;
        yield {
          kind: 'file',
          name: 'restricted.txt',
          getFile: () => restrictedFile,
        } as unknown as FileSystemFileHandle;
      },
    } as unknown as FileSystemDirectoryHandle;
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: () => Promise.resolve(directory),
    });
    const { result } = renderHook(() => useFolderScan());

    let pickFolderPromise: Promise<void>;
    await act(async () => {
      pickFolderPromise = result.current.pickFolder();
      await Promise.resolve();
    });

    expect(result.current.status).toBe('scanning');
    expect(result.current.scannedCount).toBe(0);

    await act(async () => {
      resolveReadableFile!(new File(['metadata only'], 'readable.txt', {
        lastModified: 1,
        type: 'text/plain',
      }));
    });

    await waitFor(() => {
      expect(result.current.status).toBe('scanning');
      expect(result.current.scannedCount).toBe(1);
    });

    await act(async () => {
      rejectRestrictedFile!(new DOMException('Permission denied', 'NotAllowedError'));
      await pickFolderPromise!;
    });

    expect(result.current.status).toBe('success');
    expect(result.current.scannedCount).toBe(2);
    expect(result.current.result?.skippedCount).toBe(1);

    act(() => {
      result.current.reset();
    });

    expect(result.current.scannedCount).toBe(0);
  });

  it('reports the required no-data message when folder selection is cancelled', async () => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: () => Promise.reject(new DOMException('Cancelled', 'AbortError')),
    });
    const { result } = renderHook(() => useFolderScan());

    await act(async () => {
      await result.current.pickFolder();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBe('未选择文件夹，未读取任何数据。');
    expect(result.current.scannedCount).toBe(0);
  });
});
