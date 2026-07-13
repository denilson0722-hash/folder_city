import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import type { CityBuilding, CityVisualItem } from '../types';
import { BuildingGlyph } from './BuildingGlyph';

const building: CityBuilding = {
  name: 'index.ts',
  relativePath: 'src/index.ts',
  size: 4_096,
  lastModified: new Date('2026-07-10T00:00:00Z'),
  type: 'text/typescript',
  category: 'code',
  freshness: 'recent',
  districtKey: 'code:src:1',
  firstLevelDirectory: 'src',
  directoryDepth: 1,
  height: 72,
  x: 80,
  y: 140,
  width: 54,
  districtLabel: '代码街区 · src · 深度 1',
};

const fileItem: CityVisualItem = {
  kind: 'building',
  key: building.relativePath,
  building,
  bounds: { minX: 80, minY: 130, maxX: 146, maxY: 224 },
};

const clusterItem: CityVisualItem = {
  kind: 'cluster',
  key: 'cluster:src:code',
  label: 'src 的代码建筑群',
  count: 37,
  totalBytes: 151_552,
  category: 'code',
  freshness: 'recent',
  firstLevelDirectory: 'src',
  districtKey: 'code:src:1',
  representative: building,
  bounds: { minX: 80, minY: 130, maxX: 146, maxY: 224 },
};

test('renders a file as the specified isometric faces with windows', () => {
  const { container } = render(
    <svg><BuildingGlyph item={fileItem} selected={false} onSelect={vi.fn()} /></svg>,
  );

  expect(container.querySelector('[data-face="front"]')).toHaveAttribute('x', '80');
  expect(container.querySelector('[data-face="front"]')).toHaveAttribute('y', '140');
  expect(container.querySelector('[data-face="roof"]')).toHaveAttribute('points', '80,140 90,130 144,130 134,140');
  expect(container.querySelector('[data-face="side"]')).toHaveAttribute('points', '134,140 144,130 144,202 134,212');
  expect(container.querySelector('[data-windows]')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'index.ts，代码街区 · src · 深度 1' })).toBeInTheDocument();
});
test('renders a cluster as a distinct three-building stack with its file count', () => {
  const { container } = render(
    <svg><BuildingGlyph item={clusterItem} selected={false} onSelect={vi.fn()} /></svg>,
  );

  expect(screen.getByRole('button', { name: 'src 的代码建筑群，共 37 个文件' })).toBeInTheDocument();
  expect(screen.getByText('37')).toBeVisible();
  expect(container.querySelectorAll('[data-cluster-building]')).toHaveLength(3);
  expect(container.querySelector('[data-glyph="cluster"]')).toBeInTheDocument();
});

test('uses compact display coordinates for every cluster face, roof and badge', () => {
  const compactBuilding = { ...building, x: 20, y: 40 };
  const compactCluster: CityVisualItem = {
    ...clusterItem,
    representative: { ...building, x: 8_000, y: 9_000 },
    displayBuilding: compactBuilding,
    bounds: { minX: 8, minY: 18, maxX: 110, maxY: 124 },
  };
  const { container } = render(
    <svg><BuildingGlyph item={compactCluster} selected={false} onSelect={vi.fn()} /></svg>,
  );

  const fronts = [...container.querySelectorAll<SVGRectElement>('[data-face="front"]')];
  expect(fronts.map((face) => [face.getAttribute('x'), face.getAttribute('y')])).toEqual([
    ['8', '28'],
    ['14', '34'],
    ['20', '40'],
  ]);
  expect(container.querySelectorAll('[data-face="roof"]')).toHaveLength(3);
  expect(container.querySelector('.building-glyph__badge rect')).toHaveAttribute('x', '78');
  expect(container.querySelector('.building-glyph__badge rect')).toHaveAttribute('y', '20');

  for (const rect of container.querySelectorAll<SVGRectElement>('[data-face="front"], .building-glyph__badge rect')) {
    const x = Number(rect.getAttribute('x'));
    const y = Number(rect.getAttribute('y'));
    expect(x).toBeGreaterThanOrEqual(compactCluster.bounds.minX);
    expect(y).toBeGreaterThanOrEqual(compactCluster.bounds.minY);
    expect(x + Number(rect.getAttribute('width'))).toBeLessThanOrEqual(compactCluster.bounds.maxX);
    expect(y + Number(rect.getAttribute('height'))).toBeLessThanOrEqual(compactCluster.bounds.maxY);
  }
  for (const polygon of container.querySelectorAll<SVGPolygonElement>('[data-face="roof"], [data-face="side"]')) {
    const coordinates = polygon.getAttribute('points')!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    const xs = coordinates.filter((_, index) => index % 2 === 0);
    const ys = coordinates.filter((_, index) => index % 2 === 1);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(compactCluster.bounds.minX);
    expect(Math.max(...xs)).toBeLessThanOrEqual(compactCluster.bounds.maxX);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(compactCluster.bounds.minY);
    expect(Math.max(...ys)).toBeLessThanOrEqual(compactCluster.bounds.maxY);
  }
  const badgeText = container.querySelector('.building-glyph__badge text')!;
  expect(Number(badgeText.getAttribute('x'))).toBeLessThanOrEqual(compactCluster.bounds.maxX);
  expect(Number(badgeText.getAttribute('y'))).toBeLessThanOrEqual(compactCluster.bounds.maxY);
});

test('selects a glyph with pointer, Enter and Space and reports selected state', async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  render(<svg><BuildingGlyph item={fileItem} selected onSelect={onSelect} /></svg>);
  const glyph = screen.getByRole('button', { name: /index\.ts/ });

  expect(glyph).toHaveAttribute('aria-pressed', 'true');
  await user.click(glyph);
  glyph.focus();
  await user.keyboard('{Enter} ');

  expect(onSelect).toHaveBeenCalledTimes(3);
  expect(onSelect).toHaveBeenNthCalledWith(1, fileItem);
});

test.each([
  { height: 43, expected: false },
  { height: 44, expected: true },
] as const)('renders windows=$expected at the $height-pixel height boundary', ({ height, expected }) => {
  const boundaryBuilding = { ...building, height };
  const boundaryItem: CityVisualItem = { ...fileItem, building: boundaryBuilding };
  const { container } = render(
    <svg><BuildingGlyph item={boundaryItem} selected={false} onSelect={vi.fn()} /></svg>,
  );

  expect(container.querySelector('[data-windows]') !== null).toBe(expected);
});

test.each(['recent', 'current', 'aged'] as const)('renders a non-color %s freshness texture', (freshness) => {
  const texturedBuilding = { ...building, freshness };
  const texturedItem: CityVisualItem = { ...fileItem, building: texturedBuilding };
  const { container } = render(
    <svg><BuildingGlyph item={texturedItem} selected={false} onSelect={vi.fn()} /></svg>,
  );

  expect(container.querySelector(`[data-texture="freshness-${freshness}"]`)).toHaveAttribute(
    'fill',
    `url(#freshness-${freshness})`,
  );
});
