import { useEffect, useMemo, useState } from 'react';

import { CityMap } from './components/CityMap';
import { CityNavigation } from './components/CityNavigation';
import { Controls, type CityFilters } from './components/Controls';
import { DetailsPanel } from './components/DetailsPanel';
import { StatsBar } from './components/StatsBar';
import { useFolderScan } from './hooks/useFolderScan';
import { isDirectoryPickerSupported } from './lib/fileSystem';
import { buildCity, summarize } from './lib/cityModel';

const INITIAL_FILTERS: CityFilters = { category: 'all', freshness: 'all' };

interface CitySandboxProps {
  buildings: ReturnType<typeof buildCity>;
  selectedPath: string | null;
  activeDistrictKey: string | null;
  onSelectBuilding: (relativePath: string) => void;
  onClearSelection: () => void;
  onDistrictChange: (districtKey: string | null) => void;
}

function useNarrowSandbox(): boolean {
  const query = '(max-width: 900px)';
  const read = () => (
    typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : window.innerWidth <= 900
  );
  const [narrow, setNarrow] = useState(read);

  useEffect(() => {
    if (typeof window.matchMedia === 'function') {
      const media = window.matchMedia(query);
      const update = () => setNarrow(media.matches);
      media.addEventListener('change', update);
      update();
      return () => media.removeEventListener('change', update);
    }

    const update = () => setNarrow(read());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return narrow;
}

function CitySandbox({
  buildings,
  selectedPath,
  activeDistrictKey,
  onSelectBuilding,
  onClearSelection,
  onDistrictChange,
}: CitySandboxProps) {
  const narrow = useNarrowSandbox();
  const selectedBuilding = buildings.find((building) => building.relativePath === selectedPath) ?? null;
  const detailsLayout = narrow ? 'drawer' : 'sidebar';

  return (
    <section className="city-sandbox" aria-label="城市工作台">
      {narrow ? (
        <CityNavigation city={buildings} activeDistrictKey={activeDistrictKey}
          onSelectDistrict={onDistrictChange} onShowCity={() => onDistrictChange(null)} compact />
      ) : (
        <CityNavigation city={buildings} activeDistrictKey={activeDistrictKey}
          onSelectDistrict={onDistrictChange} onShowCity={() => onDistrictChange(null)} />
      )}
      <section className="city-sandbox__map" aria-label="城市沙盘">
        {buildings.length === 0 ? (
          <p className="filtered-empty" aria-live="polite">没有建筑符合当前筛选条件。</p>
        ) : (
          <CityMap
            buildings={buildings}
            selectedPath={selectedPath}
            activeDistrictKey={activeDistrictKey}
            onDistrictChange={onDistrictChange}
            onSelect={(building) => onSelectBuilding(building.relativePath)}
            onClearSelection={onClearSelection}
          />
        )}
      </section>
      <aside
        className={`city-sandbox__info city-sandbox__info--${detailsLayout}${selectedBuilding === null ? ' city-sandbox__info--empty' : ''}`}
        aria-label="信息面板"
      >
        {selectedBuilding === null && !narrow ? (
          <div className="city-sandbox__info-placeholder">
            <p className="eyebrow">BUILDING FILE</p>
            <h2>选择一栋建筑</h2>
            <p>文件的路径、类型与城市故事会显示在这里。</p>
          </div>
        ) : null}
        <DetailsPanel
          building={selectedBuilding}
          layout={detailsLayout}
          onClose={onClearSelection}
        />
      </aside>
    </section>
  );
}

function AppHeader() {
  return (
    <header className="app-header">
      <p className="eyebrow">LOCAL-ONLY EXPLORER</p>
      <h1>文件夹城市</h1>
      <p>把文件夹的名称、路径、大小和修改时间，变成一座可以探索的二维城市。</p>
    </header>
  );
}

export default function App() {
  const { status, result, error, scannedCount, pickFolder, reset } = useFolderScan();
  const [filters, setFilters] = useState<CityFilters>(INITIAL_FILTERS);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [activeDistrictKey, setActiveDistrictKey] = useState<string | null>(null);
  const directoryPickerSupported = isDirectoryPickerSupported();
  const city = useMemo(
    () => result === null ? [] : buildCity(result.entries, result.scannedAt),
    [result],
  );
  const buildings = useMemo(
    () => city.filter((building) => (
      (filters.category === 'all' || building.category === filters.category)
      && (filters.freshness === 'all' || building.freshness === filters.freshness)
    )),
    [city, filters],
  );
  const selectedBuilding = buildings.find((building) => building.relativePath === selectedPath) ?? null;
  const summary = useMemo(() => summarize(buildings), [buildings]);

  useEffect(() => {
    if (selectedPath !== null && selectedBuilding === null) {
      setSelectedPath(null);
    }
  }, [selectedBuilding, selectedPath]);

  useEffect(() => {
    if (
      activeDistrictKey !== null
      && !buildings.some((building) => building.districtKey === activeDistrictKey)
    ) {
      setActiveDistrictKey(null);
    }
  }, [activeDistrictKey, buildings]);

  function handleReset() {
    reset();
    setFilters(INITIAL_FILTERS);
    setSelectedPath(null);
    setActiveDistrictKey(null);
  }

  function renderControls() {
    return (
      <Controls
        filters={filters}
        onChange={setFilters}
        onPickFolder={() => { void pickFolder(); }}
        onReset={handleReset}
      />
    );
  }

  if (!directoryPickerSupported) {
    return (
      <main className="folder-city">
        <AppHeader />
        <section className="state-card" aria-live="polite">
          <h2>当前浏览器不支持选择文件夹</h2>
          <p>请使用支持 File System Access API 的 Chromium 系浏览器后重试。</p>
          <p>本应用不会上传或保存任何文件内容。</p>
        </section>
      </main>
    );
  }

  if (status === 'idle') {
    return (
      <main className="folder-city">
        <AppHeader />
        <section className="state-card state-card--intro">
          <h2>从一个文件夹开始建造</h2>
          <p>选择文件夹后，文件会按类型成为街区，按大小成为建筑，按修改时间呈现新旧。</p>
          {renderControls()}
        </section>
      </main>
    );
  }

  if (status === 'scanning') {
    return (
      <main className="folder-city">
        <AppHeader />
        <section className="state-card" aria-live="polite">
          <h2>正在读取文件夹元数据</h2>
          <p>正在扫描，已检查 {scannedCount} 项。</p>
          <p>取消文件夹选择不会读取任何数据。</p>
        </section>
        <StatsBar
          summary={summary}
          status={status}
          scannedCount={scannedCount}
          skippedCount={0}
          wasTruncated={false}
        />
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="folder-city">
        <AppHeader />
        <section className="state-card state-card--error" aria-live="assertive">
          <h2>{error === '未选择文件夹，未读取任何数据。' ? '未选择文件夹' : '文件夹读取失败'}</h2>
          <p>{error ?? '读取文件夹失败，请检查权限后重试。'}</p>
          {renderControls()}
        </section>
      </main>
    );
  }

  if (result === null || city.length === 0) {
    return (
      <main className="folder-city">
        <AppHeader />
        <section className="state-card state-card--empty" aria-live="polite">
          <h2>这个文件夹还没有可建造的文件。</h2>
          <p>请选择另一个包含文件的文件夹。</p>
          {renderControls()}
        </section>
        <StatsBar
          summary={summary}
          status={status}
          scannedCount={scannedCount}
          skippedCount={result?.skippedCount ?? 0}
          wasTruncated={result?.wasTruncated ?? false}
        />
      </main>
    );
  }

  return (
    <main className="folder-city">
      <AppHeader />
      <section className="city-toolbar">
        {renderControls()}
        <StatsBar
          summary={summary}
          status={status}
          scannedCount={scannedCount}
          skippedCount={result.skippedCount}
          wasTruncated={result.wasTruncated}
        />
      </section>
      <CitySandbox
        buildings={buildings}
        selectedPath={selectedPath}
        activeDistrictKey={activeDistrictKey}
        onSelectBuilding={setSelectedPath}
        onClearSelection={() => setSelectedPath(null)}
        onDistrictChange={(districtKey) => {
          setActiveDistrictKey(districtKey);
          setSelectedPath(null);
        }}
      />
    </main>
  );
}
