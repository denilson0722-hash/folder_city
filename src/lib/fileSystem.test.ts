import { afterEach, describe, expect, it, vi } from 'vitest';

import { isDirectoryPickerSupported, scanDirectory } from './fileSystem';

type TestFile = Pick<File, 'name' | 'size' | 'lastModified' | 'type'>;

function fileHandle(file: TestFile): FileSystemFileHandle {
  return {
    kind: 'file',
    name: file.name,
    getFile: vi.fn().mockResolvedValue(file),
  } as unknown as FileSystemFileHandle;
}

function failingFileHandle(name: string): FileSystemFileHandle {
  return {
    kind: 'file',
    name,
    getFile: vi.fn().mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError')),
  } as unknown as FileSystemFileHandle;
}

function directoryHandle(name: string, entries: FileSystemHandle[]): FileSystemDirectoryHandle {
  return {
    kind: 'directory',
    name,
    async *values() {
      yield* entries;
    },
  } as unknown as FileSystemDirectoryHandle;
}

function unreadableDirectoryHandle(name: string): FileSystemDirectoryHandle {
  return {
    kind: 'directory',
    name,
    async *values() {
      throw new DOMException('Permission denied', 'NotAllowedError');
    },
  } as unknown as FileSystemDirectoryHandle;
}

const originalShowDirectoryPicker = Object.getOwnPropertyDescriptor(window, 'showDirectoryPicker');

afterEach(() => {
  if (originalShowDirectoryPicker) {
    Object.defineProperty(window, 'showDirectoryPicker', originalShowDirectoryPicker);
  } else {
    delete (window as typeof window & { showDirectoryPicker?: unknown }).showDirectoryPicker;
  }
});

describe('scanDirectory', () => {
  it('recursively returns metadata entries with relative paths', async () => {
    const rootFile = fileHandle({
      name: 'root.txt',
      size: 12,
      lastModified: 1_700_000_000_000,
      type: 'text/plain',
    });
    const nestedFile = fileHandle({
      name: 'photo.jpg',
      size: 34,
      lastModified: 1_700_000_001_000,
      type: 'image/jpeg',
    });
    const root = directoryHandle('root', [rootFile, directoryHandle('nested', [nestedFile])]);

    const result = await scanDirectory(root, vi.fn());

    expect(result.entries).toEqual([
      expect.objectContaining({
        name: 'photo.jpg',
        relativePath: 'nested/photo.jpg',
        size: 34,
        type: 'image/jpeg',
      }),
      expect.objectContaining({
        name: 'root.txt',
        relativePath: 'root.txt',
        size: 12,
        type: 'text/plain',
      }),
    ]);
    expect(result.entries[0].lastModified).toEqual(new Date(1_700_000_001_000));
    expect(rootFile.getFile).toHaveBeenCalledOnce();
    expect(nestedFile.getFile).toHaveBeenCalledOnce();
  });

  it('skips inaccessible files and counts them', async () => {
    const root = directoryHandle('root', [
      fileHandle({ name: 'available.txt', size: 1, lastModified: 1, type: 'text/plain' }),
      failingFileHandle('restricted.txt'),
    ]);

    const result = await scanDirectory(root, vi.fn());

    expect(result.entries.map((entry) => entry.relativePath)).toEqual(['available.txt']);
    expect(result.skippedCount).toBe(1);
  });

  it('retains only the 1,000 newest files after traversal', async () => {
    const files = Array.from({ length: 1_001 }, (_, index) => fileHandle({
      name: `file-${index}.txt`,
      size: index,
      lastModified: index,
      type: 'text/plain',
    }));
    const root = directoryHandle('root', files);

    const result = await scanDirectory(root, vi.fn());

    expect(result.entries).toHaveLength(1_000);
    expect(result.entries[0].name).toBe('file-1000.txt');
    expect(result.entries[result.entries.length - 1]?.name).toBe('file-1.txt');
    expect(result.wasTruncated).toBe(true);
  });

  it('throws a user-facing error when the selected root directory cannot be iterated', async () => {
    await expect(scanDirectory(unreadableDirectoryHandle('root'), vi.fn()))
      .rejects.toThrow('无法读取所选文件夹，请检查权限后重试。');
  });
});

describe('isDirectoryPickerSupported', () => {
  it('returns false when showDirectoryPicker is unavailable', () => {
    delete (window as typeof window & { showDirectoryPicker?: unknown }).showDirectoryPicker;

    expect(isDirectoryPickerSupported()).toBe(false);
  });
});
