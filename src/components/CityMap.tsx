import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

import type { CityBuilding, FileCategory, Freshness } from '../types';

interface CityMapProps {
  buildings: readonly CityBuilding[];
  selectedPath: string | null;
  onSelect: (building: CityBuilding) => void;
  onClearSelection: () => void;
}

interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const INITIAL_VIEW_BOX: ViewBox = { x: 0, y: 0, width: 960, height: 640 };
const MIN_VIEW_BOX_WIDTH = 320;
const MAX_VIEW_BOX_WIDTH = 1_920;
const VIEW_BOX_ASPECT_RATIO = INITIAL_VIEW_BOX.width / INITIAL_VIEW_BOX.height;

const CATEGORY_COLORS: Record<FileCategory, string> = {
  document: '#58a6ff',
  image: '#d2a8ff',
  media: '#f2cc60',
  code: '#3fb950',
  archive: '#ff7b72',
  other: '#8b949e',
};

const FRESHNESS_OPACITY: Record<Freshness, number> = {
  recent: 1,
  current: 0.72,
  aged: 0.42,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function viewBoxValue({ x, y, width, height }: ViewBox): string {
  return `${x} ${y} ${width} ${height}`;
}

export function CityMap({ buildings, selectedPath, onSelect, onClearSelection }: CityMapProps) {
  const [viewBox, setViewBox] = useState(INITIAL_VIEW_BOX);
  const mapRef = useRef<SVGSVGElement>(null);
  const activePointer = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null) {
      return undefined;
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const scale = event.deltaY < 0 ? 0.9 : 1.1;

      setViewBox((current) => {
        const width = clamp(current.width * scale, MIN_VIEW_BOX_WIDTH, MAX_VIEW_BOX_WIDTH);
        const height = width / VIEW_BOX_ASPECT_RATIO;
        const x = current.x + (current.width - width) / 2;
        const y = current.y + (current.height - height) / 2;
        return { x, y, width, height };
      });
    };

    map.addEventListener('wheel', handleWheel, { passive: false });
    return () => map.removeEventListener('wheel', handleWheel);
  }, []);

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) {
      return;
    }

    activePointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const pointer = activePointer.current;
    if (pointer === null || pointer.id !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - pointer.x;
    const deltaY = event.clientY - pointer.y;
    activePointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    setViewBox((current) => ({ ...current, x: current.x - deltaX, y: current.y - deltaY }));
  }

  function handlePointerEnd(event: PointerEvent<SVGSVGElement>) {
    if (activePointer.current?.id === event.pointerId) {
      activePointer.current = null;
    }
  }

  function handleBuildingKeyDown(event: KeyboardEvent<SVGGElement>, building: CityBuilding) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(building);
    }
  }

  return (
    <svg
      ref={mapRef}
      aria-label="文件夹城市地图"
      viewBox={viewBoxValue(viewBox)}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClearSelection();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onClearSelection();
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      {buildings.map((building) => {
        const isSelected = building.relativePath === selectedPath;
        return (
          <g
            key={building.relativePath}
            role="button"
            tabIndex={0}
            aria-label={`${building.name}，${building.districtLabel}`}
            aria-pressed={isSelected}
            className={`city-building city-building--${building.category} city-building--${building.freshness}`}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(building);
            }}
            onKeyDown={(event) => handleBuildingKeyDown(event, building)}
          >
            <title>{building.name}</title>
            <rect
              x={building.x}
              y={building.y}
              width={building.width}
              height={building.height}
              fill={CATEGORY_COLORS[building.category]}
              opacity={FRESHNESS_OPACITY[building.freshness]}
              stroke={isSelected ? '#ffffff' : 'transparent'}
              strokeWidth={isSelected ? 3 : 0}
            />
          </g>
        );
      })}
    </svg>
  );
}
