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
  districtKey: string;
  firstLevelDirectory: string;
  directoryDepth: number;
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

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CityLevel = 'city' | 'district' | 'building';

export interface CityBuildingVisualItem {
  kind: 'building';
  key: string;
  building: CityBuilding;
  bounds: Bounds;
}

export interface CityClusterVisualItem {
  kind: 'cluster';
  key: string;
  label: string;
  count: number;
  totalBytes: number;
  category: FileCategory;
  freshness: Freshness;
  firstLevelDirectory: string;
  districtKey: string;
  representative: CityBuilding;
  bounds: Bounds;
}

export type CityVisualItem = CityBuildingVisualItem | CityClusterVisualItem;

export interface CityDistrict {
  key: string;
  label: string;
  category: FileCategory;
  firstLevelDirectory: string;
  directoryDepth: number;
  count: number;
  totalBytes: number;
  bounds: Bounds;
}

export interface CityPresentation {
  items: CityVisualItem[];
  districts: CityDistrict[];
  contentBounds: Bounds | null;
  sourceCount: number;
}
