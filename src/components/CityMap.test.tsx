import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState, type ComponentProps } from 'react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { CityMap } from './CityMap';
import type { CityBuilding } from '../types';

class TestResizeObserver implements ResizeObserver {
  static instances: TestResizeObserver[] = [];

  readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    TestResizeObserver.instances.push(this);
  }

  observe(target: Element) {
    this.callback([{
      target,
      contentRect: {
        width: 1_200,
        height: 700,
        x: 0,
        y: 0,
        top: 0,
        right: 1_200,
        bottom: 700,
        left: 0,
        toJSON: () => ({}),
      },
      borderBoxSize: [],
      contentBoxSize: [],
      devicePixelContentBoxSize: [],
    }], this);
  }

  disconnect() {}
  unobserve() {}
}

vi.stubGlobal('ResizeObserver', TestResizeObserver);

class TestPointerEvent extends MouseEvent {
  pointerId: number;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}

const buildings: CityBuilding[] = [
  {
    name: 'plan.pdf',
    relativePath: 'docs/plan.pdf',
    size: 4_096,
    lastModified: new Date('2026-07-10T00:00:00Z'),
    type: 'application/pdf',
    category: 'document',
    freshness: 'recent',
    districtKey: 'document:docs:1',
    firstLevelDirectory: 'docs',
    directoryDepth: 1,
    height: 72,
    x: 72,
    y: 228,
    width: 54,
    districtLabel: '文档街区',
  },
  {
    name: 'photo.jpg',
    relativePath: 'images/photo.jpg',
    size: 8_192,
    lastModified: new Date('2026-01-01T00:00:00Z'),
    type: 'image/jpeg',
    category: 'image',
    freshness: 'aged',
    districtKey: 'image:images:1',
    firstLevelDirectory: 'images',
    directoryDepth: 1,
    height: 96,
    x: 144,
    y: 204,
    width: 54,
    districtLabel: '图像街区',
  },
];

function renderMap(overrides: Partial<ComponentProps<typeof CityMap>> = {}) {
  const onSelect = vi.fn();
  const onClearSelection = vi.fn();
  render(
    <CityMap
      buildings={buildings}
      selectedPath={null}
      activeDistrictKey={null}
      onDistrictChange={vi.fn()}
      onSelect={onSelect}
      onClearSelection={onClearSelection}
      {...overrides}
    />,
  );
  return { onSelect, onClearSelection };
}

test('renders every file as a named SVG button', () => {
  renderMap();

  expect(screen.getByRole('button', { name: /plan\.pdf/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /photo\.jpg/ })).toBeInTheDocument();
});

test('renders visible category and district labels plus an explanatory type legend', () => {
  renderMap();

  expect(screen.getAllByText('文档街区')[0]).toBeVisible();
  expect(screen.getAllByText('图像街区')[0]).toBeVisible();
  expect(screen.getByText('docs · 深度 1')).toBeVisible();
  expect(screen.getByLabelText('类型图例')).toHaveTextContent('文档');
  expect(screen.getByLabelText('类型图例')).toHaveTextContent('颜色表示文件类型；明暗与纹理表示新旧');
});

test('selects a building with Enter and Space', async () => {
  const user = userEvent.setup();
  const { onSelect } = renderMap();
  const plan = screen.getByRole('button', { name: /plan\.pdf/ });
  const photo = screen.getByRole('button', { name: /photo\.jpg/ });

  plan.focus();
  await user.keyboard('{Enter}');
  photo.focus();
  await user.keyboard(' ');

  expect(onSelect).toHaveBeenNthCalledWith(1, buildings[0]);
  expect(onSelect).toHaveBeenNthCalledWith(2, buildings[1]);
});

test('clears the selection from the SVG background and Escape', async () => {
  const user = userEvent.setup();
  const { onClearSelection } = renderMap();
  const map = screen.getByLabelText('文件夹城市地图');

  await user.click(map);
  fireEvent.keyDown(map, { key: 'Escape' });

  expect(onClearSelection).toHaveBeenCalledTimes(2);
});

test('auto-fits all district and title bounds to the measured viewport', async () => {
  renderMap();
  const map = screen.getByLabelText('文件夹城市地图');

  await waitFor(() => expect(map).not.toHaveAttribute('viewBox', '0 0 960 640'));
  const [x, y, width, height] = map.getAttribute('viewBox')!.split(' ').map(Number);
  for (const plate of document.querySelectorAll('[data-district-plate]')) {
    const plateX = Number(plate.getAttribute('x'));
    const plateY = Number(plate.getAttribute('y'));
    const plateWidth = Number(plate.getAttribute('width'));
    const plateHeight = Number(plate.getAttribute('height'));
    expect(plateX).toBeGreaterThanOrEqual(x);
    expect(plateY).toBeGreaterThanOrEqual(y);
    expect(plateX + plateWidth).toBeLessThanOrEqual(x + width);
    expect(plateY + plateHeight).toBeLessThanOrEqual(y + height);
  }
  for (const title of document.querySelectorAll('.district-layer__title')) {
    expect(Number(title.getAttribute('x'))).toBeGreaterThanOrEqual(x);
    expect(Number(title.getAttribute('y'))).toBeGreaterThanOrEqual(y);
    expect(Number(title.getAttribute('x'))).toBeLessThanOrEqual(x + width);
    expect(Number(title.getAttribute('y'))).toBeLessThanOrEqual(y + height);
  }
});

test('measures with a window resize fallback when ResizeObserver is unavailable', async () => {
  const originalResizeObserver = globalThis.ResizeObserver;
  const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 900,
    height: 600,
    x: 0,
    y: 0,
    top: 0,
    right: 900,
    bottom: 600,
    left: 0,
    toJSON: () => ({}),
  });
  const addEventListener = vi.spyOn(window, 'addEventListener');
  vi.stubGlobal('ResizeObserver', undefined);

  try {
    renderMap();
    await waitFor(() => expect(screen.getByLabelText('文件夹城市地图')).not.toHaveAttribute('viewBox', '0 0 960 640'));
    expect(addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
  } finally {
    vi.stubGlobal('ResizeObserver', originalResizeObserver);
    bounds.mockRestore();
    addEventListener.mockRestore();
  }
});

test('uses fit flight only when reduced motion is not requested', async () => {
  const originalMatchMedia = window.matchMedia;
  const matchMedia = vi.fn().mockReturnValue({ matches: false });
  vi.stubGlobal('matchMedia', matchMedia);

  try {
    const { unmount } = render(
      <CityMap
        buildings={buildings}
        selectedPath={null}
        activeDistrictKey={null}
        onDistrictChange={vi.fn()}
        onSelect={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByLabelText('文件夹城市地图')).toHaveClass('city-map__viewport--flight'));
    unmount();

    matchMedia.mockReturnValue({ matches: true });
    renderMap();
    await waitFor(() => expect(screen.getByLabelText('文件夹城市地图')).not.toHaveAttribute('viewBox', '0 0 960 640'));
    expect(screen.getByLabelText('文件夹城市地图')).not.toHaveClass('city-map__viewport--flight');
  } finally {
    vi.stubGlobal('matchMedia', originalMatchMedia);
  }
});

test('zooms the map from its calculated initial viewBox', async () => {
  renderMap();
  const map = screen.getByLabelText('文件夹城市地图');

  await waitFor(() => expect(map).not.toHaveAttribute('viewBox', '0 0 960 640'));
  const fittedViewBox = map.getAttribute('viewBox');
  fireEvent.wheel(map, { deltaY: -1 });

  expect(map).not.toHaveAttribute('viewBox', fittedViewBox);
});

test('clamps wheel zoom to the supported viewBox range', async () => {
  renderMap();
  const map = screen.getByLabelText('文件夹城市地图');

  await waitFor(() => expect(map).not.toHaveAttribute('viewBox', '0 0 960 640'));

  for (let index = 0; index < 20; index += 1) {
    fireEvent.wheel(map, { deltaY: -1 });
  }
  expect(map).toHaveAttribute('viewBox', expect.stringMatching(/ 320 186\.66666666666669$/));

  for (let index = 0; index < 30; index += 1) {
    fireEvent.wheel(map, { deltaY: 1 });
  }
  const [, , maximumWidth, maximumHeight] = map.getAttribute('viewBox')!.split(' ').map(Number);
  expect(maximumWidth).toBe(1_920);
  expect(maximumHeight).toBeCloseTo(1_120);
});

test('reports selected state through aria-pressed', () => {
  renderMap({ selectedPath: 'images/photo.jpg' });

  expect(screen.getByRole('button', { name: /plan\.pdf/ })).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByRole('button', { name: /photo\.jpg/ })).toHaveAttribute('aria-pressed', 'true');
});

test('registers its wheel listener as non-passive so the page does not scroll while zooming', () => {
  const addEventListener = vi.spyOn(SVGSVGElement.prototype, 'addEventListener');

  renderMap();

  expect(addEventListener).toHaveBeenCalledWith('wheel', expect.any(Function), { passive: false });
  addEventListener.mockRestore();
});

test('pans by the pointer delta and keeps the manual view when selecting a building', async () => {
  renderMap();
  const map = screen.getByLabelText('文件夹城市地图');
  const plan = screen.getByRole('button', { name: /plan\.pdf/ });

  await waitFor(() => expect(map).not.toHaveAttribute('viewBox', '0 0 960 640'));

  fireEvent(map, new TestPointerEvent('pointerdown', {
    bubbles: true, pointerId: 1, clientX: 100, clientY: 100,
  }));
  fireEvent(map, new TestPointerEvent('pointermove', {
    bubbles: true, pointerId: 1, clientX: 140, clientY: 125,
  }));
  fireEvent(map, new TestPointerEvent('pointerup', { bubbles: true, pointerId: 1 }));

  const pannedViewBox = map.getAttribute('viewBox');
  fireEvent.click(plan);
  expect(map).toHaveAttribute('viewBox', pannedViewBox);
});

function ControlledMap({ selectedPath = null }: { selectedPath?: string | null }) {
  const [activeDistrictKey, setActiveDistrictKey] = useState<string | null>(null);
  return (
    <CityMap
      buildings={buildings}
      selectedPath={selectedPath}
      activeDistrictKey={activeDistrictKey}
      onDistrictChange={setActiveDistrictKey}
      onSelect={vi.fn()}
      onClearSelection={vi.fn()}
    />
  );
}

test('drills into a district and returns to the full city', async () => {
  const user = userEvent.setup();
  render(<ControlledMap />);

  await user.click(screen.getByRole('button', { name: /文档街区，共 1 个文件/ }));
  expect(screen.getByLabelText('城市地图控制')).toHaveTextContent('街区级');
  await user.click(screen.getByRole('button', { name: '返回全城' }));
  expect(screen.getByLabelText('城市地图控制')).toHaveTextContent('全城级');
});

test('Escape clears selection before exiting the active district', () => {
  const onClearSelection = vi.fn();
  const onDistrictChange = vi.fn();
  renderMap({
    selectedPath: buildings[0].relativePath,
    activeDistrictKey: buildings[0].districtKey,
    onClearSelection,
    onDistrictChange,
  });
  const map = screen.getByLabelText('文件夹城市地图');

  fireEvent.keyDown(map, { key: 'Escape' });
  expect(onClearSelection).toHaveBeenCalledOnce();
  expect(onDistrictChange).not.toHaveBeenCalled();

  renderMap({
    selectedPath: null,
    activeDistrictKey: buildings[0].districtKey,
    onClearSelection,
    onDistrictChange,
  });
  fireEvent.keyDown(screen.getAllByLabelText('文件夹城市地图')[1], { key: 'Escape' });
  expect(onDistrictChange).toHaveBeenCalledWith(null);
});

function manyBuildings(count: number): CityBuilding[] {
  return Array.from({ length: count }, (_, index) => ({
    ...buildings[0],
    name: `file-${index}.pdf`,
    relativePath: `docs/file-${index}.pdf`,
    x: index * 80,
  }));
}

test('virtualizes oversized district items while retaining exact totals', async () => {
  const oversizedDistrict = manyBuildings(700);
  renderMap({ buildings: oversizedDistrict, activeDistrictKey: oversizedDistrict[0].districtKey });
  const map = screen.getByLabelText('文件夹城市地图');

  expect(screen.getByRole('button', { name: /文档街区，共 700 个文件/ })).toBeInTheDocument();
  await waitFor(() => expect(map).not.toHaveAttribute('viewBox', '0 0 960 640'));
  for (let index = 0; index < 18; index += 1) {
    fireEvent.wheel(map, { deltaY: -1 });
  }
  const before = new Set([...document.querySelectorAll('[data-glyph="file"]')].map((node) => node.getAttribute('aria-label')));
  expect(before.size).toBeGreaterThan(0);
  expect(before.size).toBeLessThan(700);

  fireEvent(map, new TestPointerEvent('pointerdown', {
    bubbles: true, pointerId: 2, clientX: 500, clientY: 100,
  }));
  fireEvent(map, new TestPointerEvent('pointermove', {
    bubbles: true, pointerId: 2, clientX: -500, clientY: 100,
  }));
  fireEvent(map, new TestPointerEvent('pointerup', { bubbles: true, pointerId: 2 }));

  const after = new Set([...document.querySelectorAll('[data-glyph="file"]')].map((node) => node.getAttribute('aria-label')));
  expect(after).not.toEqual(before);
  expect(screen.getByRole('button', { name: /文档街区，共 700 个文件/ })).toBeInTheDocument();
});
