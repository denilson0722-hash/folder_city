import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react';

import { itemsIntersectingViewBox, presentationFor } from '../lib/cityPresentation';
import { clampZoom, fitBounds } from '../lib/cityViewport';
import {
  FILE_CATEGORIES,
  type CityBuilding,
  type CityLevel,
  type CityVisualItem,
  type FileCategory,
  type ViewBox,
  type ViewportSize,
} from '../types';
import { BuildingGlyph } from './BuildingGlyph';
import { CityControls } from './CityControls';
import { DistrictLayer } from './DistrictLayer';

interface CityMapProps {
  buildings: readonly CityBuilding[];
  selectedPath: string | null;
  onSelect: (building: CityBuilding) => void;
  onClearSelection: () => void;
  activeDistrictKey: string | null;
  onDistrictChange: (districtKey: string | null) => void;
}

const INITIAL_VIEW_BOX: ViewBox = { x: 0, y: 0, width: 960, height: 640 };
const EMPTY_VIEWPORT: ViewportSize = { width: 0, height: 0 };
const LARGE_DISTRICT_THRESHOLD = 600;

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

function viewBoxValue({ x, y, width, height }: ViewBox): string {
  return `${x} ${y} ${width} ${height}`;
}

function viewportCenter(viewBox: ViewBox): { x: number; y: number } {
  return {
    x: viewBox.x + viewBox.width / 2,
    y: viewBox.y + viewBox.height / 2,
  };
}

function reducedMotionPreferred(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function CityMap({
  buildings,
  selectedPath,
  onSelect,
  onClearSelection,
  activeDistrictKey,
  onDistrictChange,
}: CityMapProps) {
  const [level, setLevel] = useState<CityLevel>(activeDistrictKey === null ? 'city' : 'district');
  const [viewBox, setViewBox] = useState<ViewBox>(INITIAL_VIEW_BOX);
  const [viewportSize, setViewportSize] = useState<ViewportSize>(EMPTY_VIEWPORT);
  const [manualView, setManualView] = useState(false);
  const [flight, setFlight] = useState(false);
  const containerRef = useRef<HTMLElement>(null);
  const mapRef = useRef<SVGSVGElement>(null);
  const activePointer = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    setLevel(activeDistrictKey === null ? 'city' : 'district');
  }, [activeDistrictKey]);

  const presentation = useMemo(
    () => presentationFor(buildings, { level, districtKey: activeDistrictKey }),
    [activeDistrictKey, buildings, level],
  );

  const fitPresentation = useCallback(() => {
    if (presentation.contentBounds === null || viewportSize.width <= 0 || viewportSize.height <= 0) {
      return;
    }
    setViewBox(fitBounds(presentation.contentBounds, viewportSize));
    setManualView(false);
    setFlight(!reducedMotionPreferred());
  }, [presentation.contentBounds, viewportSize]);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return undefined;
    }

    const measure = (width: number, height: number) => {
      if (width > 0 && height > 0) {
        setViewportSize((current) => (
          current.width === width && current.height === height ? current : { width, height }
        ));
      }
    };
    const measureContainer = () => {
      const bounds = container.getBoundingClientRect();
      measure(bounds.width, bounds.height);
    };

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(([entry]) => {
        if (entry !== undefined) {
          measure(entry.contentRect.width, entry.contentRect.height);
        }
      });
      observer.observe(container);
      return () => observer.disconnect();
    }

    measureContainer();
    window.addEventListener('resize', measureContainer);
    return () => window.removeEventListener('resize', measureContainer);
  }, []);

  useEffect(() => {
    fitPresentation();
  }, [fitPresentation]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null) {
      return undefined;
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      setManualView(true);
      setFlight(false);
      setViewBox((current) => clampZoom(
        current,
        event.deltaY < 0 ? 0.9 : 1.1,
        viewportCenter(current),
      ));
    };

    map.addEventListener('wheel', handleWheel, { passive: false });
    return () => map.removeEventListener('wheel', handleWheel);
  }, []);

  const renderedItems = level === 'district' && presentation.sourceCount > LARGE_DISTRICT_THRESHOLD
    ? itemsIntersectingViewBox(presentation.items, viewBox)
    : presentation.items;

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
    setManualView(true);
    setFlight(false);
    setViewBox((current) => ({ ...current, x: current.x - deltaX, y: current.y - deltaY }));
  }

  function handlePointerEnd(event: PointerEvent<SVGSVGElement>) {
    if (activePointer.current?.id === event.pointerId) {
      activePointer.current = null;
    }
  }

  function selectItem(item: CityVisualItem) {
    if (item.kind === 'building') {
      onSelect(item.building);
      return;
    }
    onDistrictChange(item.districtKey);
  }

  function changeZoom(scale: number) {
    setManualView(true);
    setFlight(false);
    setViewBox((current) => clampZoom(current, scale, viewportCenter(current)));
  }

  return (
    <section ref={containerRef} className="city-map" data-manual-view={manualView || undefined}>
      <CityControls
        level={level}
        onZoomIn={() => changeZoom(0.9)}
        onZoomOut={() => changeZoom(1.1)}
        onFit={fitPresentation}
        onBackToCity={() => onDistrictChange(null)}
      />
      <svg
        ref={mapRef}
        aria-label="文件夹城市地图"
        viewBox={viewBoxValue(viewBox)}
        className={flight ? 'city-map__viewport city-map__viewport--flight' : 'city-map__viewport'}
        onAnimationEnd={() => setFlight(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onClearSelection();
          }
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') {
            return;
          }
          if (selectedPath !== null || activeDistrictKey === null) {
            onClearSelection();
          } else if (activeDistrictKey !== null) {
            onDistrictChange(null);
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        {presentation.districts.map((district) => (
          <g key={district.key}>
            <DistrictLayer
              district={district}
              active={district.key === activeDistrictKey}
              onActivate={(candidate) => onDistrictChange(candidate.key)}
            />
            <text
              className="district-layer__meta"
              x={district.bounds.minX + 14}
              y={district.bounds.minY + 48}
            >
              {district.firstLevelDirectory} · 深度 {district.directoryDepth}
            </text>
          </g>
        ))}
        {renderedItems.map((item) => (
          <BuildingGlyph
            key={item.key}
            item={item}
            selected={item.kind === 'building' && item.building.relativePath === selectedPath}
            onSelect={selectItem}
          />
        ))}
      </svg>
      <aside className="city-map__legend" aria-label="类型图例">
        <strong>类型图例</strong>
        <ul>
          {FILE_CATEGORIES.map((category) => (
            <li key={category}>
              <span className="city-map__swatch" style={{ backgroundColor: CATEGORY_COLORS[category] }} />
              {CATEGORY_LABELS[category]}
            </li>
          ))}
        </ul>
        <p>颜色表示文件类型；明暗与纹理表示新旧：近期较亮、常用中等亮度、较旧较暗。</p>
      </aside>
    </section>
  );
}
