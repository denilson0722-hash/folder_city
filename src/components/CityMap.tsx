import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

import { FILE_CATEGORIES, type CityBuilding, type FileCategory, type Freshness } from '../types';

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

const CATEGORY_LABELS: Record<FileCategory, string> = {
  document: '文档街区',
  image: '图像街区',
  media: '媒体街区',
  code: '代码街区',
  archive: '压缩街区',
  other: '其他街区',
};

const FRESHNESS_STYLES: Record<Freshness, { brightness: number; patternId: string; stroke: string }> = {
  recent: { brightness: 1.16, patternId: 'freshness-recent', stroke: '#edf7ff' },
  current: { brightness: 0.9, patternId: 'freshness-current', stroke: '#d7e3f9' },
  aged: { brightness: 0.68, patternId: 'freshness-aged', stroke: '#a7b6d3' },
};

interface District {
  key: string;
  category: FileCategory;
  label: string;
  firstLevelDirectory: string;
  directoryDepth: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function viewBoxValue({ x, y, width, height }: ViewBox): string {
  return `${x} ${y} ${width} ${height}`;
}

function districtsFor(buildings: readonly CityBuilding[]): District[] {
  const groups = new Map<string, CityBuilding[]>();
  for (const building of buildings) {
    const district = groups.get(building.districtKey) ?? [];
    district.push(building);
    groups.set(building.districtKey, district);
  }

  return [...groups.entries()].map(([key, districtBuildings]) => {
    const first = districtBuildings[0];
    const minimumX = Math.min(...districtBuildings.map((building) => building.x));
    const minimumY = Math.min(...districtBuildings.map((building) => building.y));
    const maximumX = Math.max(...districtBuildings.map((building) => building.x + building.width));
    const maximumY = Math.max(...districtBuildings.map((building) => building.y + building.height));
    return {
      key,
      category: first.category,
      label: first.districtLabel,
      firstLevelDirectory: first.firstLevelDirectory,
      directoryDepth: first.directoryDepth,
      x: minimumX - 24,
      y: minimumY - 68,
      width: maximumX - minimumX + 48,
      height: maximumY - minimumY + 92,
    };
  });
}

export function CityMap({ buildings, selectedPath, onSelect, onClearSelection }: CityMapProps) {
  const [viewBox, setViewBox] = useState(INITIAL_VIEW_BOX);
  const mapRef = useRef<SVGSVGElement>(null);
  const activePointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const districts = districtsFor(buildings);
  const categories = FILE_CATEGORIES.filter((category) => buildings.some((building) => building.category === category));

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
    <section className="city-map">
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
        <defs>
          <pattern id="freshness-recent" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M 0 0 L 0 8" stroke="#ffffff" strokeWidth="2" />
          </pattern>
          <pattern id="freshness-current" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 0 4 L 8 4" stroke="#ffffff" strokeWidth="2" />
          </pattern>
          <pattern id="freshness-aged" width="8" height="8" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="#ffffff" />
            <circle cx="6" cy="6" r="1.5" fill="#ffffff" />
          </pattern>
        </defs>
        <g aria-hidden="true" className="city-districts">
          {districts.map((district) => (
            <g key={district.key} className={`city-district city-district--${district.category}`}>
              <rect x={district.x} y={district.y} width={district.width} height={district.height} rx="16" />
              <text x={district.x + 12} y={district.y + 24}>{district.firstLevelDirectory} · 深度 {district.directoryDepth}</text>
            </g>
          ))}
          {categories.map((category) => {
            const categoryDistricts = districts.filter((district) => district.category === category);
            const categoryX = Math.min(...categoryDistricts.map((district) => district.x));
            const categoryY = Math.min(...categoryDistricts.map((district) => district.y));
            return <text key={category} className="city-category-label" x={categoryX} y={categoryY - 16}>{CATEGORY_LABELS[category]}</text>;
          })}
        </g>
      {buildings.map((building) => {
        const isSelected = building.relativePath === selectedPath;
        const freshnessStyle = FRESHNESS_STYLES[building.freshness];
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
              style={{ filter: `brightness(${freshnessStyle.brightness})` }}
              stroke={isSelected ? '#ffffff' : freshnessStyle.stroke}
              strokeWidth={isSelected ? 3 : 1.5}
            />
            <rect
              data-freshness-texture
              x={building.x}
              y={building.y}
              width={building.width}
              height={building.height}
              fill={`url(#${freshnessStyle.patternId})`}
              pointerEvents="none"
            />
          </g>
        );
      })}
      </svg>
      <aside className="city-map__legend" aria-label="类型图例">
        <strong>类型图例</strong>
        <ul>
          {FILE_CATEGORIES.map((category) => (
            <li key={category}><span className="city-map__swatch" style={{ backgroundColor: CATEGORY_COLORS[category] }} />{CATEGORY_LABELS[category]}</li>
          ))}
        </ul>
        <p>颜色表示文件类型；明暗与纹理表示新旧：近期较亮斜线、常用中等亮度横线、较旧较暗点纹。</p>
      </aside>
    </section>
  );
}
