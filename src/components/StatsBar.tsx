import type { FolderScanStatus } from '../hooks/useFolderScan';
import { FILE_CATEGORIES, type CitySummary, type FileCategory } from '../types';

export interface StatsBarProps {
  summary: CitySummary;
  status: FolderScanStatus;
  scannedCount?: number;
  skippedCount: number;
  wasTruncated: boolean;
}

const CATEGORY_LABELS: Record<FileCategory, string> = {
  document: '文档',
  image: '图像',
  media: '媒体',
  code: '代码',
  archive: '压缩包',
  other: '其他',
};

function formatBytes(bytes: number): string {
  const safeBytes = Math.max(0, bytes);
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unitIndex = safeBytes === 0 ? 0 : Math.min(Math.floor(Math.log(safeBytes) / Math.log(1024)), units.length - 1);
  const value = safeBytes / 1024 ** unitIndex;
  const formatted = unitIndex === 0 ? String(value) : value.toFixed(1).replace(/\.0$/, '');
  return `${formatted} ${units[unitIndex]}`;
}

function statusLabel(status: FolderScanStatus, scannedCount: number): string {
  switch (status) {
    case 'scanning':
      return `正在扫描，已检查 ${scannedCount} 项`;
    case 'success':
      return '扫描完成';
    case 'error':
      return '扫描失败';
    default:
      return '尚未扫描';
  }
}

export function StatsBar({ summary, status, scannedCount = 0, skippedCount, wasTruncated }: StatsBarProps) {
  const largestFile = summary.largestFile;

  return (
    <section aria-label="扫描统计">
      <p>扫描状态：{statusLabel(status, scannedCount)}</p>
      <p>文件数：{summary.fileCount}</p>
      <p>总大小：{formatBytes(summary.totalBytes)}</p>
      <p>
        最大文件：{largestFile === null ? '无' : `${largestFile.name}（${formatBytes(largestFile.size)}）`}
      </p>
      <section aria-label="当前筛选结果按类型分布">
        <p>当前筛选结果按类型分布：</p>
        <ul>
          {FILE_CATEGORIES.map((category) => (
            <li key={category}>{CATEGORY_LABELS[category]}：{summary.categoryCounts[category]}</li>
          ))}
        </ul>
      </section>
      <p>跳过项：{skippedCount}</p>
      {wasTruncated && <p>目录包含超过 1,000 个文件；仅展示最近修改的 1,000 个文件。</p>}
    </section>
  );
}
