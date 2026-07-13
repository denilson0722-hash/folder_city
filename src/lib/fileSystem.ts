import type { FileEntry } from '../types';

const MAX_ENTRIES = 1_000;

export interface ScanResult {
  entries: FileEntry[];
  skippedCount: number;
  wasTruncated: boolean;
  scannedAt: Date;
}

export type ScanProgressHandler = (scannedCount: number) => void;

export function isDirectoryPickerSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

export async function scanDirectory(
  handle: FileSystemDirectoryHandle,
  onProgress: ScanProgressHandler = () => undefined,
): Promise<ScanResult> {
  const entries: FileEntry[] = [];
  let skippedCount = 0;
  let scannedCount = 0;

  const reportProgress = () => {
    scannedCount += 1;
    onProgress(scannedCount);
  };

  const visitDirectory = async (directory: FileSystemDirectoryHandle, pathPrefix: string): Promise<void> => {
    try {
      for await (const child of directory.values()) {
        try {
          const relativePath = pathPrefix ? `${pathPrefix}/${child.name}` : child.name;

          if (child.kind === 'directory') {
            await visitDirectory(child as FileSystemDirectoryHandle, relativePath);
            continue;
          }

          if (child.kind === 'file') {
            const file = await (child as FileSystemFileHandle).getFile();
            entries.push({
              name: file.name,
              relativePath,
              size: file.size,
              lastModified: new Date(file.lastModified),
              type: file.type,
            });
            reportProgress();
          }
        } catch {
          skippedCount += 1;
          reportProgress();
        }
      }
    } catch {
      skippedCount += 1;
    }
  };

  await visitDirectory(handle, '');
  entries.sort((left, right) => (
    right.lastModified.getTime() - left.lastModified.getTime()
    || left.relativePath.localeCompare(right.relativePath)
  ));

  return {
    entries: entries.slice(0, MAX_ENTRIES),
    skippedCount,
    wasTruncated: entries.length > MAX_ENTRIES,
    scannedAt: new Date(),
  };
}
