import type {
  Bounds,
  CityBuilding,
  CityDistrict,
  CityLevel,
  CityPresentation,
  CityVisualItem,
  FileCategory,
  ViewBox,
} from '../types';
import { unionBounds } from './cityViewport';

const CITY_EXACT_LIMIT = 180;
const CITY_REPRESENTATIVE_LIMIT = 600;
const MAX_DISTRICT_REPRESENTATIVES = 24;
const ROOF_DEPTH = 10;
const SHADOW_DEPTH = 12;
const DISTRICT_PADDING = 24;
const DISTRICT_TITLE_HEIGHT = 34;

const CATEGORY_LABELS: Record<FileCategory, string> = {
  document: '文档',
  image: '图像',
  media: '媒体',
  code: '代码',
  archive: '压缩',
  other: '其他',
};

export interface PresentationOptions {
  level: CityLevel;
  districtKey: string | null;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareBuildings(left: CityBuilding, right: CityBuilding): number {
  return compareText(left.districtKey, right.districtKey)
    || compareText(left.relativePath, right.relativePath);
}

function boundsForBuilding(building: CityBuilding): Bounds {
  return {
    minX: building.x,
    minY: building.y - ROOF_DEPTH,
    maxX: building.x + building.width + SHADOW_DEPTH,
    maxY: building.y + building.height + SHADOW_DEPTH,
  };
}

function buildingItem(building: CityBuilding): CityVisualItem {
  return {
    kind: 'building',
    key: building.relativePath,
    building,
    bounds: boundsForBuilding(building),
  };
}

function groupsByDistrict(buildings: readonly CityBuilding[]): Map<string, CityBuilding[]> {
  const groups = new Map<string, CityBuilding[]>();
  for (const building of buildings) {
    const members = groups.get(building.districtKey) ?? [];
    members.push(building);
    groups.set(building.districtKey, members);
  }
  return groups;
}

function districtsFor(buildings: readonly CityBuilding[]): CityDistrict[] {
  const groups = groupsByDistrict(buildings);
  return [...groups.entries()].map(([key, members]) => {
    const first = members[0];
    const buildingBounds = unionBounds(members.map(boundsForBuilding))!;
    return {
      key,
      label: first.districtLabel,
      category: first.category,
      firstLevelDirectory: first.firstLevelDirectory,
      directoryDepth: first.directoryDepth,
      count: members.length,
      totalBytes: members.reduce((sum, building) => sum + building.size, 0),
      bounds: {
        minX: buildingBounds.minX - DISTRICT_PADDING,
        minY: buildingBounds.minY - DISTRICT_PADDING - DISTRICT_TITLE_HEIGHT,
        maxX: buildingBounds.maxX + DISTRICT_PADDING,
        maxY: buildingBounds.maxY + DISTRICT_PADDING,
      },
    };
  });
}

function representativeItems(buildings: readonly CityBuilding[]): CityVisualItem[] {
  const items: CityVisualItem[] = [];

  for (const [districtKey, members] of groupsByDistrict(buildings)) {
    const stride = Math.ceil(members.length / MAX_DISTRICT_REPRESENTATIVES);
    const representativeIndexes = new Set<number>();
    for (let index = 0; index < members.length && representativeIndexes.size < MAX_DISTRICT_REPRESENTATIVES; index += stride) {
      representativeIndexes.add(index);
      items.push(buildingItem(members[index]));
    }

    const omitted = members.filter((_, index) => !representativeIndexes.has(index));
    if (omitted.length > 0) {
      const representative = omitted[0];
      items.push({
        kind: 'cluster',
        key: `cluster:omitted:${districtKey}`,
        label: `${representative.districtLabel}建筑群`,
        count: omitted.length,
        totalBytes: omitted.reduce((sum, building) => sum + building.size, 0),
        category: representative.category,
        freshness: representative.freshness,
        firstLevelDirectory: representative.firstLevelDirectory,
        districtKey,
        representative,
        bounds: boundsForBuilding(representative),
      });
    }
  }

  return items;
}

function aggregateItems(buildings: readonly CityBuilding[]): CityVisualItem[] {
  const groups = new Map<string, CityBuilding[]>();
  for (const building of buildings) {
    const groupKey = JSON.stringify([
      building.category,
      building.firstLevelDirectory,
      building.freshness,
    ]);
    const members = groups.get(groupKey) ?? [];
    members.push(building);
    groups.set(groupKey, members);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([groupKey, members]) => {
      const orderedMembers = [...members].sort((left, right) => (
        compareText(left.relativePath, right.relativePath)
      ));
      const representative = orderedMembers[0];
      return {
        kind: 'cluster' as const,
        key: `cluster:aggregate:${groupKey}`,
        label: `${representative.firstLevelDirectory} 的${CATEGORY_LABELS[representative.category]}建筑群`,
        count: orderedMembers.length,
        totalBytes: orderedMembers.reduce((sum, building) => sum + building.size, 0),
        category: representative.category,
        freshness: representative.freshness,
        firstLevelDirectory: representative.firstLevelDirectory,
        districtKey: representative.districtKey,
        representative,
        bounds: boundsForBuilding(representative),
      };
    });
}

function cityItems(buildings: readonly CityBuilding[]): CityVisualItem[] {
  if (buildings.length <= CITY_EXACT_LIMIT) {
    return buildings.map(buildingItem);
  }
  if (buildings.length <= CITY_REPRESENTATIVE_LIMIT) {
    return representativeItems(buildings);
  }
  return aggregateItems(buildings);
}

export function presentationFor(
  buildings: readonly CityBuilding[],
  options: PresentationOptions,
): CityPresentation {
  const sortedBuildings = [...buildings].sort(compareBuildings);
  const districts = districtsFor(sortedBuildings);

  if (options.level !== 'city') {
    const district = options.districtKey === null
      ? undefined
      : districts.find((candidate) => candidate.key === options.districtKey);
    if (district === undefined) {
      return { items: [], districts, contentBounds: null, sourceCount: 0 };
    }

    const districtBuildings = sortedBuildings.filter((building) => building.districtKey === district.key);
    return {
      items: districtBuildings.map(buildingItem),
      districts,
      contentBounds: district.bounds,
      sourceCount: districtBuildings.length,
    };
  }

  return {
    items: cityItems(sortedBuildings),
    districts,
    contentBounds: unionBounds(districts.map((district) => district.bounds)),
    sourceCount: sortedBuildings.length,
  };
}

export function itemsIntersectingViewBox(
  items: readonly CityVisualItem[],
  viewBox: ViewBox,
  overscanRatio = 0.12,
): CityVisualItem[] {
  const horizontalOverscan = viewBox.width * overscanRatio;
  const verticalOverscan = viewBox.height * overscanRatio;
  const visibleBounds: Bounds = {
    minX: viewBox.x - horizontalOverscan,
    minY: viewBox.y - verticalOverscan,
    maxX: viewBox.x + viewBox.width + horizontalOverscan,
    maxY: viewBox.y + viewBox.height + verticalOverscan,
  };

  return items.filter(({ bounds }) => (
    bounds.maxX >= visibleBounds.minX
    && bounds.minX <= visibleBounds.maxX
    && bounds.maxY >= visibleBounds.minY
    && bounds.minY <= visibleBounds.maxY
  ));
}
