import { act, renderHook } from '@testing-library/react';
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
  });
});
