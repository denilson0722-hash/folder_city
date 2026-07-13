import type { CityBuilding } from '../types';

export interface CityNavigationProps {
  city: readonly CityBuilding[];
  activeDistrictKey: string | null;
  onSelectDistrict: (districtKey: string) => void;
  onShowCity: () => void;
  compact?: boolean;
}

interface DistrictLink {
  key: string;
  label: string;
  count: number;
}

function districtsFor(city: readonly CityBuilding[]): DistrictLink[] {
  const districts = new Map<string, DistrictLink>();

  for (const building of city) {
    const current = districts.get(building.districtKey);
    districts.set(building.districtKey, {
      key: building.districtKey,
      label: building.districtLabel,
      count: (current?.count ?? 0) + 1,
    });
  }

  return [...districts.values()].sort((left, right) => (
    left.label.localeCompare(right.label, 'zh-CN') || left.key.localeCompare(right.key)
  ));
}

export function CityNavigation({
  city,
  activeDistrictKey,
  onSelectDistrict,
  onShowCity,
  compact = false,
}: CityNavigationProps) {
  const districts = districtsFor(city);

  if (compact) {
    return (
      <label className="city-navigation-select">
        <span>街区导航</span>
        <select
          aria-label="街区导航"
          value={activeDistrictKey ?? '__city__'}
          onChange={(event) => {
            if (event.target.value === '__city__') onShowCity();
            else onSelectDistrict(event.target.value);
          }}
        >
          <option value="__city__">全城总览</option>
          {districts.map((district) => (
            <option key={district.key} value={district.key}>
              {district.label}（{district.count}）
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <nav className="city-navigation" aria-label="城市导航">
      <p className="city-navigation__eyebrow">CITY INDEX</p>
      <h2>街区索引</h2>
      <button
        type="button"
        className="city-navigation__city"
        aria-label={`全城概览，共 ${city.length} 个文件`}
        aria-current={activeDistrictKey === null ? 'page' : undefined}
        onClick={onShowCity}
      >
        <span>全城概览</span>
        <strong>{city.length}</strong>
      </button>
      <ul>
        {districts.map((district) => (
          <li key={district.key}>
            <button
              type="button"
              aria-label={`${district.label}，共 ${district.count} 个文件`}
              aria-current={district.key === activeDistrictKey ? 'page' : undefined}
              onClick={() => onSelectDistrict(district.key)}
            >
              <span>{district.label}</span>
              <strong>{district.count}</strong>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
