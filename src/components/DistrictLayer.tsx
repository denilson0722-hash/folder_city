import type { KeyboardEvent, MouseEvent } from 'react';

import type { CityDistrict } from '../types';

interface DistrictLayerProps {
  district: CityDistrict;
  active: boolean;
  onActivate: (district: CityDistrict) => void;
}
export function DistrictLayer({ district, active, onActivate }: DistrictLayerProps) {
  const { minX, minY, maxX, maxY } = district.bounds;
  const width = maxX - minX;
  const height = maxY - minY;
  const accessibleName = `${district.label}，共 ${district.count} 个文件`;

  function activate(event: MouseEvent<SVGGElement>) {
    event.stopPropagation();
    onActivate(district);
  }

  function activateFromKeyboard(event: KeyboardEvent<SVGGElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      onActivate(district);
    }
  }

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={accessibleName}
      aria-pressed={active}
      className={`district-layer district-layer--${district.category}${active ? ' district-layer--active' : ''}`}
      onClick={activate}
      onKeyDown={activateFromKeyboard}
    >
      <title>{accessibleName}</title>
      <rect
        data-district-plate
        className="district-layer__plate"
        x={minX}
        y={minY}
        width={width}
        height={height}
        rx="16"
      />
      <text className="district-layer__title" x={minX + 14} y={minY + 26}>{district.label}</text>
      <g className="district-layer__badge" aria-hidden="true">
        <rect x={maxX - 50} y={minY + 10} width="36" height="24" rx="12" />
        <text x={maxX - 32} y={minY + 27} textAnchor="middle">{district.count}</text>
      </g>
    </g>
  );
}
