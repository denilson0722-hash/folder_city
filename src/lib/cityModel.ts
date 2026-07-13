import {
  FILE_CATEGORIES,
  type CityBuilding,
  type CitySummary,
  type FileCategory,
  type FileEntry,
  type Freshness,
} from '../types';

const MIN_HEIGHT = 24;
const MAX_HEIGHT = 180;
const SCALE_MAX_BYTES = 1024 ** 3;
const BUILDING_WIDTH = 54;
const BUILDING_GAP = 18;
const BUILDINGS_PER_ROW = 6;
const DISTRICT_X_START = 72;
const DISTRICT_X_STEP = 500;
const DISTRICT_Y = 300;
const ROW_STEP = 220;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

const CATEGORY_EXTENSIONS: Record<FileCategory, readonly string[]> = {
  document: ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'xls', 'xlsx', 'ppt', 'pptx', 'ods', 'odt', 'csv'],
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic', 'bmp', 'tif', 'tiff'],
  media: ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'mp4', 'mov', 'mkv', 'avi', 'webm'],
  code: ['js', 'jsx', 'ts', 'tsx', 'json', 'html', 'htm', 'css', 'scss', 'sass', 'less', 'py', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rs', 'rb', 'php', 'sh', 'zsh', 'bash', 'yaml', 'yml', 'toml', 'xml', 'sql', 'ini', 'env'],
  archive: ['zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar'],
  other: [],
};

const DISTRICT_LABELS: Record<FileCategory, string> = {
  document: '文档街区',
  image: '图像街区',
  media: '媒体街区',
  code: '代码街区',
  archive: '压缩街区',
  other: '其他街区',
};

const extensionCategories = new Map<string, FileCategory>(
  FILE_CATEGORIES.flatMap((category) =>
    CATEGORY_EXTENSIONS[category].map((extension) => [extension, category] as const),
  ),
);

function extensionFor(name: string): string | null {
  const lastDot = name.lastIndexOf('.');
  if (lastDot < 0 || lastDot === name.length - 1) {
    return null;
  }

  const suffix = name.slice(lastDot).replace(/^\.+/, '').toLowerCase();
  return suffix || null;
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatBytes(bytes: number): string {
  const safeBytes = Math.max(0, bytes);
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unitIndex = safeBytes === 0 ? 0 : Math.min(Math.floor(Math.log(safeBytes) / Math.log(1024)), units.length - 1);
  const value = safeBytes / 1024 ** unitIndex;
  const formatted = unitIndex === 0 ? String(value) : value.toFixed(1).replace(/\.0$/, '');
  return `${formatted} ${units[unitIndex]}`;
}

export function classifyFile(name: string): FileCategory {
  const extension = extensionFor(name);
  return extension ? extensionCategories.get(extension) ?? 'other' : 'other';
}

export function heightForBytes(size: number): number {
  const ratio = Math.log10(Math.max(0, size) + 1) / Math.log10(SCALE_MAX_BYTES + 1);
  return Math.round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, MIN_HEIGHT + ratio * (MAX_HEIGHT - MIN_HEIGHT))));
}

export function freshnessFor(modified: Date, now: Date): Freshness {
  const ageInDays = Math.max(0, now.getTime() - modified.getTime()) / DAY_IN_MILLISECONDS;
  if (ageInDays <= 7) {
    return 'recent';
  }
  if (ageInDays <= 90) {
    return 'current';
  }
  return 'aged';
}

export function buildCity(entries: readonly FileEntry[], now: Date): CityBuilding[] {
  const sortedEntries = [...entries].sort((left, right) => (
    left.relativePath < right.relativePath ? -1 : left.relativePath > right.relativePath ? 1 : 0
  ));
  const categoryIndices: Record<FileCategory, number> = {
    document: 0,
    image: 0,
    media: 0,
    code: 0,
    archive: 0,
    other: 0,
  };

  return sortedEntries.map((entry) => {
    const category = classifyFile(entry.name);
    const categoryIndex = FILE_CATEGORIES.indexOf(category);
    const indexInDistrict = categoryIndices[category]++;
    const height = heightForBytes(entry.size);
    const column = indexInDistrict % BUILDINGS_PER_ROW;
    const row = Math.floor(indexInDistrict / BUILDINGS_PER_ROW);
    const districtX = DISTRICT_X_START + categoryIndex * DISTRICT_X_STEP;

    return {
      ...entry,
      category,
      freshness: freshnessFor(entry.lastModified, now),
      height,
      x: districtX + column * (BUILDING_WIDTH + BUILDING_GAP),
      y: DISTRICT_Y + row * ROW_STEP - height,
      width: BUILDING_WIDTH,
      districtLabel: DISTRICT_LABELS[category],
    };
  });
}

export function storyFor(building: CityBuilding): string {
  return `“${building.name}”属于${building.districtLabel}，最近一次翻新于 ${formatDate(building.lastModified)}，占地 ${formatBytes(building.size)}。`;
}

export function summarize(buildings: readonly CityBuilding[]): CitySummary {
  const categoryCounts: Record<FileCategory, number> = {
    document: 0,
    image: 0,
    media: 0,
    code: 0,
    archive: 0,
    other: 0,
  };
  let totalBytes = 0;
  let largestFile: CityBuilding | null = null;

  for (const building of buildings) {
    categoryCounts[building.category] += 1;
    totalBytes += building.size;
    if (largestFile === null || building.size > largestFile.size) {
      largestFile = building;
    }
  }

  return { fileCount: buildings.length, totalBytes, largestFile, categoryCounts };
}
