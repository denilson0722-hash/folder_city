export const FILE_CATEGORIES = [
  'document',
  'image',
  'media',
  'code',
  'archive',
  'other',
] as const;

export type FileCategory = (typeof FILE_CATEGORIES)[number];

export type Freshness = 'recent' | 'current' | 'aged';

export interface FileEntry {
  name: string;
  relativePath: string;
  size: number;
  lastModified: Date;
  type: string;
}

export interface CityBuilding extends FileEntry {
  category: FileCategory;
  freshness: Freshness;
  height: number;
  x: number;
  y: number;
  width: number;
  districtLabel: string;
}

export interface CitySummary {
  fileCount: number;
  totalBytes: number;
  largestFile: CityBuilding | null;
  categoryCounts: Record<FileCategory, number>;
}
