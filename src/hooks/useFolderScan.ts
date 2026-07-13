import { useCallback, useState } from 'react';

import {
  scanDirectory,
  type ScanResult,
} from '../lib/fileSystem';

export type FolderScanStatus = 'idle' | 'scanning' | 'success' | 'error';

export interface FolderScanState {
  status: FolderScanStatus;
  result: ScanResult | null;
  error: string | null;
  scannedCount: number;
  pickFolder: () => Promise<void>;
  reset: () => void;
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}

export function useFolderScan(): FolderScanState {
  const [status, setStatus] = useState<FolderScanStatus>('idle');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scannedCount, setScannedCount] = useState(0);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
    setScannedCount(0);
  }, []);

  const pickFolder = useCallback(async () => {
    const pickDirectory = window.showDirectoryPicker;
    if (typeof pickDirectory !== 'function') {
      setStatus('error');
      setResult(null);
      setError('当前浏览器不支持选择文件夹。');
      return;
    }

    setStatus('scanning');
    setResult(null);
    setError(null);
    setScannedCount(0);

    try {
      const handle = await pickDirectory();
      const nextResult = await scanDirectory(handle, setScannedCount);
      setResult(nextResult);
      setStatus('success');
    } catch (caughtError) {
      setStatus('error');
      setError(
        isAbortError(caughtError)
          ? '未选择文件夹，未读取任何数据。'
          : '读取文件夹失败，请检查权限后重试。',
      );
    }
  }, []);

  return { status, result, error, scannedCount, pickFolder, reset };
}
