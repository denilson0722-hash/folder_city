import { describe, expect, test } from 'vitest';

import type { CityBuilding, FileCategory, Freshness } from '../types';
import { itemsIntersectingViewBox, presentationFor } from './cityPresentation';

const CATEGORIES: readonly FileCategory[] = ['document', 'image', 'media', 'code', 'archive', 'other'];
const FRESHNESS: readonly Freshness[] = ['recent', 'current', 'aged'];

function makeBuildings(
  count: number,
  options: { districts?: number; categories?: number } = {},
): CityBuilding[] {
  const districtCount = options.districts ?? 1;
  const categoryCount = options.categories ?? 1;

  return Array.from({ length: count }, (_, index) => {
    const districtIndex = index % districtCount;
    const category = CATEGORIES[districtIndex % categoryCount];
    const firstLevelDirectory = `dir-${districtIndex % Math.max(1, categoryCount)}`;
    const directoryDepth = Math.floor(districtIndex / Math.max(1, categoryCount)) + 1;
    const districtKey = `${category}:${firstLevelDirectory}:${directoryDepth}`;
    const row = Math.floor(index / 6);
    const column = index % 6;
    return {
      name: `file-${String(index).padStart(4, '0')}.txt`,
      relativePath: `${firstLevelDirectory}/${String(index).padStart(4, '0')}.txt`,
      size: index + 1,
      lastModified: new Date(Date.UTC(2026, 6, (index % 28) + 1)),
      type: 'text/plain',
      category,
      freshness: FRESHNESS[index % FRESHNESS.length],
      districtKey,
      firstLevelDirectory,
      directoryDepth,
      height: 24 + (index % 60),
      x: districtIndex * 500 + column * 72,
      y: row * 220,
      width: 54,
      districtLabel: `${category} district ${firstLevelDirectory}`,
    };
  });
}

describe('presentationFor city thresholds', () => {
  test('shows every exact building through the 180-file threshold', () => {
    const buildings = makeBuildings(180);
    const presentation = presentationFor(buildings, { level: 'city', districtKey: null });

    expect(presentation.items).toHaveLength(180);
    expect(presentation.items.every((item) => item.kind === 'building')).toBe(true);
    expect(presentation.items[0]).toMatchObject({
      kind: 'building',
      key: buildings[0].relativePath,
      building: buildings[0],
    });
    expect(presentation.sourceCount).toBe(180);
  });

  test('uses district representatives and omitted-member badges for 181–600 files', () => {
    const buildings = makeBuildings(200, { districts: 2, categories: 2 });
    const presentation = presentationFor(buildings, { level: 'city', districtKey: null });
    const representatives = presentation.items.filter((item) => item.kind === 'building');
    const clusters = presentation.items.filter((item) => item.kind === 'cluster');

    expect(presentation.items.length).toBeLessThan(200);
    expect(representatives).toHaveLength(40);
    expect(clusters).toHaveLength(2);
    expect(representatives.length + clusters.reduce((sum, cluster) => sum + cluster.count, 0)).toBe(200);
    expect(clusters.every((cluster) => cluster.label.endsWith('建筑群'))).toBe(true);
    expect(clusters[0].representative.relativePath).toBe('dir-0/0002.txt');
    expect(clusters[0].count).toBe(80);
    expect(clusters[0].totalBytes).toBe(
      buildings.filter((building) => building.districtKey === clusters[0].districtKey)
        .filter((_, index) => index % Math.ceil(100 / 24) !== 0)
        .reduce((sum, building) => sum + building.size, 0),
    );
  });

  test('switches to representatives at exactly 181 files without losing a source', () => {
    const presentation = presentationFor(makeBuildings(181), { level: 'city', districtKey: null });
    const representedCount = presentation.items.reduce((sum, item) => (
      sum + (item.kind === 'building' ? 1 : item.count)
    ), 0);

    expect(presentation.items.length).toBeLessThan(181);
    expect(presentation.items.some((item) => item.kind === 'cluster')).toBe(true);
    expect(representedCount).toBe(181);
    expect(presentation.sourceCount).toBe(181);
  });

  test('caps representatives at 24 per district at the 600-file boundary', () => {
    const presentation = presentationFor(makeBuildings(600), { level: 'city', districtKey: null });

    expect(presentation.items.filter((item) => item.kind === 'building')).toHaveLength(24);
    expect(presentation.items.filter((item) => item.kind === 'cluster')).toHaveLength(1);
    expect(presentation.sourceCount).toBe(600);
  });

  test('aggregates every source by district identity, category and freshness above 600', () => {
    const buildings = makeBuildings(700, { districts: 4, categories: 2 });
    const presentation = presentationFor(buildings, { level: 'city', districtKey: null });
    const clusters = presentation.items.filter((item) => item.kind === 'cluster');

    expect(presentation.items.every((item) => item.kind === 'cluster')).toBe(true);
    expect(clusters).toHaveLength(12);
    expect(clusters.reduce((sum, cluster) => sum + cluster.count, 0)).toBe(700);
    expect(clusters.reduce((sum, cluster) => sum + cluster.totalBytes, 0)).toBe(
      buildings.reduce((sum, building) => sum + building.size, 0),
    );
  });

  test('keeps the exact source count at 1,000 files', () => {
    expect(presentationFor(
      makeBuildings(1_000, { districts: 6, categories: 6 }),
      { level: 'city', districtKey: null },
    ).sourceCount).toBe(1_000);
  });

  test('produces deterministic keys and groups independent of input order', () => {
    const buildings = makeBuildings(700, { districts: 4, categories: 2 });
    const first = presentationFor(buildings, { level: 'city', districtKey: null });
    const second = presentationFor([...buildings].reverse(), { level: 'city', districtKey: null });

    expect(second.items).toEqual(first.items);
    expect(second.districts).toEqual(first.districts);
  });

  test('keeps same-directory districts at different depths in separate clusters and drill targets', () => {
    const buildings = makeBuildings(601);
    buildings.forEach((building, index) => {
      building.firstLevelDirectory = 'shared';
      building.freshness = 'recent';
      building.relativePath = `z/${String(index).padStart(4, '0')}.txt`;
      building.districtKey = index % 2 === 0 ? 'document:shared:1' : 'document:shared:2';
    });
    buildings[600].relativePath = 'a/earliest.txt';
    buildings[600].districtKey = 'document:shared:2';

    const presentation = presentationFor(buildings, { level: 'city', districtKey: null });

    expect(presentation.items).toHaveLength(2);
    const clusters = presentation.items.filter((item) => item.kind === 'cluster');
    expect(new Set(clusters.map((item) => item.districtKey))).toEqual(new Set([
      'document:shared:1',
      'document:shared:2',
    ]));
    for (const cluster of clusters) {
      const drill = presentationFor(buildings, { level: 'district', districtKey: cluster.districtKey });
      expect(drill.items.every((item) => item.kind === 'building' && item.building.districtKey === cluster.districtKey)).toBe(true);
    }
  });

  test('compacts a 700-file single-district city independently of its huge source layout', () => {
    const buildings = makeBuildings(700);
    buildings.forEach((building, index) => {
      building.x = index * 50_000;
      building.y = index * 30_000;
    });

    const city = presentationFor(buildings, { level: 'city', districtKey: null });
    const district = city.districts[0];
    expect(district.bounds.maxY - district.bounds.minY).toBeLessThan(600);
    expect(district.bounds.maxX - district.bounds.minX).toBeLessThan(900);
    expect(city.items.every((item) => item.bounds.maxX < 1_000 && item.bounds.maxY < 1_000)).toBe(true);

    const drill = presentationFor(buildings, { level: 'district', districtKey: district.key });
    expect(drill.contentBounds!.maxX).toBeGreaterThan(1_000_000);
  });
});

describe('district and building levels', () => {
  test.each(['district', 'building'] as const)('%s level shows every exact source in the requested district', (level) => {
    const buildings = makeBuildings(40, { districts: 2, categories: 2 });
    const districtKey = buildings[1].districtKey;
    const expected = buildings.filter((building) => building.districtKey === districtKey);
    const presentation = presentationFor(buildings, { level, districtKey });

    expect(presentation.items).toHaveLength(expected.length);
    expect(presentation.items.every((item) => item.kind === 'building')).toBe(true);
    expect(presentation.items.map((item) => item.kind === 'building' && item.building.relativePath))
      .toEqual(expected.map((building) => building.relativePath));
    expect(presentation.sourceCount).toBe(expected.length);
    expect(presentation.contentBounds).not.toBeNull();
  });

  test.each([null, 'missing:district:1'])('returns an empty presentation for a null or unknown district key', (districtKey) => {
    const presentation = presentationFor(makeBuildings(20), { level: 'district', districtKey });

    expect(presentation.items).toEqual([]);
    expect(presentation.sourceCount).toBe(0);
    expect(presentation.contentBounds).toBeNull();
  });

  test('returns an empty building-level presentation for an unknown district key', () => {
    const presentation = presentationFor(makeBuildings(20), {
      level: 'building',
      districtKey: 'missing:building:1',
    });

    expect(presentation).toMatchObject({ items: [], contentBounds: null, sourceCount: 0 });
  });
});

describe('visual bounds', () => {
  test('widens a compact district so its title and count badge remain inside the fitted bounds', () => {
    const building = makeBuildings(1)[0];
    building.districtLabel = '代码街区 · exceptionally-long-source-directory · 深度 1';
    const presentation = presentationFor([building], { level: 'city', districtKey: null });
    const district = presentation.districts[0];

    expect(district.bounds.maxX - district.bounds.minX).toBeGreaterThanOrEqual(430);
    expect(presentation.contentBounds).toEqual(district.bounds);
  });

  test('includes roof, shadow and title extents in content bounds', () => {
    const building = makeBuildings(1)[0];
    building.x = 100;
    building.y = 200;
    building.width = 54;
    building.height = 40;
    const presentation = presentationFor([building], { level: 'city', districtKey: null });
    const item = presentation.items[0];

    expect(item.kind).toBe('building');
    if (item.kind !== 'building') throw new Error('Expected a building item.');
    expect(item.bounds).toEqual({ minX: 42, minY: 82, maxX: 108, maxY: 144 });
    expect(item.displayBuilding).toMatchObject({ x: 42, y: 92, width: 54, height: 40 });
    expect(presentation.districts[0].bounds).toEqual({ minX: 18, minY: 24, maxX: 280, maxY: 168 });
    expect(presentation.contentBounds).toEqual(presentation.districts[0].bounds);
  });

  test('filters by an exact 12% overscanned view without mutating presentation totals', () => {
    const buildings = makeBuildings(2);
    buildings[0].x = 0;
    buildings[0].y = 0;
    buildings[1].x = 150;
    buildings[1].y = 0;
    const presentation = presentationFor(buildings, { level: 'city', districtKey: null });
    const originalItems = [...presentation.items];
    const visible = itemsIntersectingViewBox(
      presentation.items,
      { x: 0, y: -20, width: 100, height: 100 },
      0.12,
    );

    expect(visible.map((item) => item.key)).toEqual([buildings[0].relativePath]);
    expect(presentation.items).toEqual(originalItems);
    expect(presentation.sourceCount).toBe(2);
  });
});
