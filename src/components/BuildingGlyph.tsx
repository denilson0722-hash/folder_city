import type { KeyboardEvent, MouseEvent } from 'react';

import type { CityBuilding, CityVisualItem } from '../types';

interface BuildingGlyphProps {
  item: CityVisualItem;
  selected: boolean;
  onSelect: (item: CityVisualItem) => void;
}
interface BuildingShapeProps {
  building: CityBuilding;
  offsetX?: number;
  offsetY?: number;
  cluster?: boolean;
  windows?: boolean;
}

function points(values: ReadonlyArray<readonly [number, number]>): string {
  return values.map(([x, y]) => `${x},${y}`).join(' ');
}

function Windows({ building, offsetX = 0, offsetY = 0 }: BuildingShapeProps) {
  if (building.height < 44) {
    return null;
  }

  const x = building.x + offsetX;
  const y = building.y + offsetY;
  const windowWidth = Math.max(5, (building.width - 18) / 2);
  const rows = Math.max(1, Math.min(4, Math.floor((building.height - 14) / 18)));

  return (
    <g data-windows aria-hidden="true" className="building-glyph__windows">
      {Array.from({ length: rows }, (_, row) => {
        const windowY = y + 10 + row * 17;
        return (
          <g key={row}>
            <rect x={x + 6} y={windowY} width={windowWidth} height="7" rx="1" />
            <rect x={x + building.width - windowWidth - 6} y={windowY} width={windowWidth} height="7" rx="1" />
          </g>
        );
      })}
    </g>
  );
}

function BuildingShape({
  building,
  offsetX = 0,
  offsetY = 0,
  cluster = false,
  windows = true,
}: BuildingShapeProps) {
  const x = building.x + offsetX;
  const y = building.y + offsetY;
  const { width, height } = building;

  return (
    <g data-cluster-building={cluster ? '' : undefined}>
      <rect
        data-face="front"
        className="building-glyph__front"
        x={x}
        y={y}
        width={width}
        height={height}
      />
      <rect
        data-texture={`freshness-${building.freshness}`}
        className="building-glyph__texture"
        x={x}
        y={y}
        width={width}
        height={height}
        fill={`url(#freshness-${building.freshness})`}
        aria-hidden="true"
      />
      <polygon
        data-face="roof"
        className="building-glyph__roof"
        points={points([
          [x, y],
          [x + 10, y - 10],
          [x + width + 10, y - 10],
          [x + width, y],
        ])}
      />
      <polygon
        data-face="side"
        className="building-glyph__side"
        points={points([
          [x + width, y],
          [x + width + 10, y - 10],
          [x + width + 10, y + height - 10],
          [x + width, y + height],
        ])}
      />
      {windows ? <Windows building={building} offsetX={offsetX} offsetY={offsetY} /> : null}
    </g>
  );
}

function ClusterShape({ item }: { item: Extract<CityVisualItem, { kind: 'cluster' }> }) {
  const { representative } = item;
  const badgeX = representative.x + representative.width + 4;
  const badgeY = representative.y - 20;

  return (
    <g data-glyph="cluster">
      <BuildingShape building={representative} offsetX={-12} offsetY={-12} cluster windows={false} />
      <BuildingShape building={representative} offsetX={-6} offsetY={-6} cluster windows={false} />
      <BuildingShape building={representative} cluster />
      <g className="building-glyph__badge" aria-hidden="true">
        <rect x={badgeX} y={badgeY} width="32" height="24" rx="12" />
        <text x={badgeX + 16} y={badgeY + 16} textAnchor="middle">{item.count}</text>
      </g>
    </g>
  );
}

export function BuildingGlyph({ item, selected, onSelect }: BuildingGlyphProps) {
  const building = item.displayBuilding
    ?? (item.kind === 'building' ? item.building : item.representative);
  const accessibleName = item.kind === 'building'
    ? `${building.name}，${building.districtLabel}`
    : `${item.label}，共 ${item.count} 个文件`;

  function select(event: MouseEvent<SVGGElement>) {
    event.stopPropagation();
    onSelect(item);
  }

  function selectFromKeyboard(event: KeyboardEvent<SVGGElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      onSelect(item);
    }
  }

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={accessibleName}
      aria-pressed={selected}
      data-glyph={item.kind === 'building' ? 'file' : undefined}
      className={`building-glyph building-glyph--${item.kind} building-glyph--${building.category} building-glyph--${building.freshness}${selected ? ' building-glyph--selected' : ''}`}
      onClick={select}
      onKeyDown={selectFromKeyboard}
    >
      <title>{accessibleName}</title>
      {item.kind === 'building'
        ? <BuildingShape building={building} />
        : <ClusterShape item={item} />}
    </g>
  );
}
