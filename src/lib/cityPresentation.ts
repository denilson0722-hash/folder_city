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
const DISTRICT_TITLE_LEFT = 14;
const DISTRICT_TITLE_BADGE_GAP = 64;

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

function estimatedTitleWidth(label: string): number {
  return Array.from(label).reduce((width, character) => (
    width + (/^[\x00-\xff]$/.test(character) ? 8 : 15)
  ), 0);
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
    const minX = buildingBounds.minX - DISTRICT_PADDING;
    const contentMaxX = buildingBounds.maxX + DISTRICT_PADDING;
    const titleMaxX = minX
      + DISTRICT_TITLE_LEFT
      + estimatedTitleWidth(first.districtLabel)
      + DISTRICT_TITLE_BADGE_GAP;
    return {
      key,
      label: first.districtLabel,
      category: first.category,
      firstLevelDirectory: first.firstLevelDirectory,
      directoryDepth: first.directoryDepth,
      count: members.length,
      totalBytes: members.reduce((sum, building) => sum + building.size, 0),
      bounds: {
        minX,
        minY: buildingBounds.minY - DISTRICT_PADDING - DISTRICT_TITLE_HEIGHT,
        maxX: Math.max(contentMaxX, titleMaxX),
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
      building.districtKey,
      building.category,
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

function displayBuildingFor(building: CityBuilding, x: number, y: number): CityBuilding {
  return { ...building, x, y };
}

function placeItem(item: CityVisualItem, x: number, y: number): CityVisualItem {
  const source = item.kind === 'building' ? item.building : item.representative;
  const displayBuilding = displayBuildingFor(source, x, y);
  const bounds = boundsForBuilding(displayBuilding);
  return item.kind === 'building'
    ? { ...item, displayBuilding, bounds }
    : {
      ...item,
      displayBuilding,
      bounds: {
        minX: x - 12,
        minY: y - 22,
        maxX: Math.max(bounds.maxX, x + displayBuilding.width + 36),
        maxY: bounds.maxY,
      },
    };
}

function compactCityLayout(
  items: readonly CityVisualItem[],
  buildings: readonly CityBuilding[],
): { items: CityVisualItem[]; districts: CityDistrict[] } {
  const sourcesByDistrict = groupsByDistrict(buildings);
  const itemsByDistrict = new Map<string, CityVisualItem[]>();
  for (const item of items) {
    const districtKey = item.kind === 'building' ? item.building.districtKey : item.districtKey;
    const members = itemsByDistrict.get(districtKey) ?? [];
    members.push(item);
    itemsByDistrict.set(districtKey, members);
  }

  const keys = [...sourcesByDistrict.keys()].sort(compareText);
  const placedItems: CityVisualItem[] = [];
  const districts: CityDistrict[] = [];
  let rowY = 0;
  let rowHeight = 0;

  keys.forEach((key, districtIndex) => {
    if (districtIndex > 0 && districtIndex % 2 === 0) {
      rowY += rowHeight + 48;
      rowHeight = 0;
    }
    const column = districtIndex % 2;
    const originX = column * 700;
    const sourceMembers = sourcesByDistrict.get(key)!;
    const visibleMembers = itemsByDistrict.get(key) ?? [];
    const columns = Math.min(8, Math.max(1, Math.ceil(Math.sqrt(visibleMembers.length * 1.5))));
    const districtItems = visibleMembers.map((item, index) => placeItem(
      item,
      originX + 42 + (index % columns) * 78,
      rowY + 92 + Math.floor(index / columns) * 112,
    ));
    placedItems.push(...districtItems);
    const first = sourceMembers[0];
    const itemBounds = unionBounds(districtItems.map((item) => item.bounds)) ?? {
      minX: originX + 42,
      minY: rowY + 70,
      maxX: originX + 220,
      maxY: rowY + 180,
    };
    const minX = itemBounds.minX - DISTRICT_PADDING;
    const titleMaxX = minX + DISTRICT_TITLE_LEFT + estimatedTitleWidth(first.districtLabel) + DISTRICT_TITLE_BADGE_GAP;
    const bounds: Bounds = {
      minX,
      minY: itemBounds.minY - DISTRICT_PADDING - DISTRICT_TITLE_HEIGHT,
      maxX: Math.max(itemBounds.maxX + DISTRICT_PADDING, titleMaxX),
      maxY: itemBounds.maxY + DISTRICT_PADDING,
    };
    rowHeight = Math.max(rowHeight, bounds.maxY - rowY);
    districts.push({
      key,
      label: first.districtLabel,
      category: first.category,
      firstLevelDirectory: first.firstLevelDirectory,
      directoryDepth: first.directoryDepth,
      count: sourceMembers.length,
      totalBytes: sourceMembers.reduce((sum, building) => sum + building.size, 0),
      bounds,
    });
  });

  return { items: placedItems, districts };
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
  const sourceDistricts = districtsFor(sortedBuildings);

  if (options.level !== 'city') {
    const district = options.districtKey === null
      ? undefined
      : sourceDistricts.find((candidate) => candidate.key === options.districtKey);
    if (district === undefined) {
      return { items: [], districts: sourceDistricts, contentBounds: null, sourceCount: 0 };
    }

    const districtBuildings = sortedBuildings.filter((building) => building.districtKey === district.key);
    return {
      items: districtBuildings.map(buildingItem),
      districts: sourceDistricts,
      contentBounds: district.bounds,
      sourceCount: districtBuildings.length,
    };
  }

  const city = compactCityLayout(cityItems(sortedBuildings), sortedBuildings);
  return {
    items: city.items,
    districts: city.districts,
    contentBounds: unionBounds(city.districts.map((district) => district.bounds)),
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
