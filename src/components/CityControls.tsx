import type { CityLevel } from '../types';

interface CityControlsProps {
  level: CityLevel;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onBackToCity: () => void;
}

const LEVEL_LABELS: Record<CityLevel, string> = {
  city: '全城级',
  district: '街区级',
  building: '建筑级',
};

export function CityControls({
  level,
  onZoomIn,
  onZoomOut,
  onFit,
  onBackToCity,
}: CityControlsProps) {
  return (
    <nav className="city-controls" aria-label="城市地图控制">
      <span className="city-controls__level" aria-live="polite">{LEVEL_LABELS[level]}</span>
      <button type="button" aria-label="放大" onClick={onZoomIn}>＋</button>
      <button type="button" aria-label="缩小" onClick={onZoomOut}>－</button>
      <button type="button" onClick={onFit}>适应视图</button>
      {level !== 'city'
        ? <button type="button" onClick={onBackToCity}>返回全城</button>
        : null}
    </nav>
  );
}
