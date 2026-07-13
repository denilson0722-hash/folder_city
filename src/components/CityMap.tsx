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
  const selectedBuilding = selectedPath === null
    ? undefined
    : buildings.find((building) => building.relativePath === selectedPath);
  const level: CityLevel = activeDistrictKey === null
    ? 'city'
    : selectedBuilding?.districtKey === activeDistrictKey ? 'building' : 'district';
  const presentationLevel: CityLevel = level === 'building' ? 'district' : level;
  const [viewBox, setViewBox] = useState<ViewBox>(INITIAL_VIEW_BOX);
  const [viewportSize, setViewportSize] = useState<ViewportSize>(EMPTY_VIEWPORT);
  const [manualView, setManualView] = useState(false);
  const [flight, setFlight] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const containerRef = useRef<HTMLElement>(null);
  const mapRef = useRef<SVGSVGElement>(null);
  const activePointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const viewBoxRef = useRef<ViewBox>(INITIAL_VIEW_BOX);
  const animationFrame = useRef<number | null>(null);

  const presentationResult = useMemo(() => {
    try {
      return {
        presentation: presentationFor(buildings, {
          level: presentationLevel,
          districtKey: activeDistrictKey,
        }),
        error: null,
      };
    } catch {
      return {
        presentation: { items: [], districts: [], contentBounds: null, sourceCount: 0 },
        error: '城市视图暂时无法计算，请检查文件元数据后重试。',
      };
    }
  },
    [activeDistrictKey, buildings, presentationLevel],
  );
  const presentation = presentationResult.presentation;

  const applyViewBox = useCallback((next: ViewBox) => {
    viewBoxRef.current = next;
    setViewBox(next);
  }, []);

  const stopFlight = useCallback(() => {
    if (animationFrame.current !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
    setFlight(false);
  }, []);

  const flyTo = useCallback((target: ViewBox) => {
    if (animationFrame.current !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
    if (reducedMotionPreferred() || typeof requestAnimationFrame !== 'function') {
      applyViewBox(target);
      setFlight(false);
      return;
    }

    const start = viewBoxRef.current;
    let startTime: number | null = null;
    setFlight(true);
    const step = (timestamp: number) => {
      startTime ??= timestamp;
      const progress = Math.min(1, (timestamp - startTime) / 180);
      const next: ViewBox = {
        x: start.x + (target.x - start.x) * progress,
        y: start.y + (target.y - start.y) * progress,
        width: start.width + (target.width - start.width) * progress,
        height: start.height + (target.height - start.height) * progress,
      };
      applyViewBox(next);
      if (progress < 1) animationFrame.current = requestAnimationFrame(step);
      else {
        animationFrame.current = null;
        setFlight(false);
      }
    };
    animationFrame.current = requestAnimationFrame(step);
  }, [applyViewBox]);

  const fitPresentation = useCallback(() => {
    if (presentation.contentBounds === null || viewportSize.width <= 0 || viewportSize.height <= 0) {
      return;
    }
    try {
      const fitted = fitBounds(presentation.contentBounds, viewportSize);
      setViewError(null);
      flyTo(fitted);
      setManualView(false);
    } catch {
      applyViewBox(INITIAL_VIEW_BOX);
      setFlight(false);
      setViewError('城市视图暂时无法计算，请检查文件元数据后重试。');
    }
  }, [applyViewBox, flyTo, presentation.contentBounds, viewportSize]);

  useEffect(() => () => {
    if (animationFrame.current !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(animationFrame.current);
    }
  }, []);

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
      stopFlight();
      const current = viewBoxRef.current;
      applyViewBox(clampZoom(
        current,
        event.deltaY < 0 ? 0.9 : 1.1,
        viewportCenter(current),
      ));
    };

    map.addEventListener('wheel', handleWheel, { passive: false });
    return () => map.removeEventListener('wheel', handleWheel);
  }, [applyViewBox, stopFlight]);

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
    stopFlight();
    const current = viewBoxRef.current;
    applyViewBox({ ...current, x: current.x - deltaX, y: current.y - deltaY });
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
    stopFlight();
    const current = viewBoxRef.current;
    applyViewBox(clampZoom(current, scale, viewportCenter(current)));
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
        <defs aria-hidden="true">
          <pattern id="freshness-recent" width="12" height="12" patternUnits="userSpaceOnUse">
            <path d="M0 11 L11 0" stroke="rgba(255,255,255,.34)" strokeWidth="1" />
          </pattern>
          <pattern id="freshness-current" width="10" height="10" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.2" fill="rgba(255,255,255,.34)" />
          </pattern>
          <pattern id="freshness-aged" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M0 4 H8" stroke="rgba(255,255,255,.28)" strokeWidth="1" />
          </pattern>
        </defs>
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
        {presentationResult.error !== null || viewError !== null ? (
          <g role="alert" aria-label="城市视图错误">
            <rect x="120" y="260" width="720" height="120" rx="16" className="city-map__error-bg" />
            <text x="480" y="325" textAnchor="middle" className="city-map__error-text">
              {presentationResult.error ?? viewError}
            </text>
          </g>
        ) : null}
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
