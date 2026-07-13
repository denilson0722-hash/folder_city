import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { CityMap } from './CityMap';
import type { CityBuilding } from '../types';

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

test('zooms the map from its exact initial viewBox', () => {
  renderMap();
  const map = screen.getByLabelText('文件夹城市地图');

  expect(map).toHaveAttribute('viewBox', '0 0 960 640');
  fireEvent.wheel(map, { deltaY: -1 });

  expect(map).not.toHaveAttribute('viewBox', '0 0 960 640');
});

test('pans by the pointer delta and exposes category and freshness visuals', () => {
  renderMap();
  const map = screen.getByLabelText('文件夹城市地图');
  const plan = screen.getByRole('button', { name: /plan\.pdf/ });
  const photo = screen.getByRole('button', { name: /photo\.jpg/ });

  fireEvent(map, new TestPointerEvent('pointerdown', {
    bubbles: true, pointerId: 1, clientX: 100, clientY: 100,
  }));
  fireEvent(map, new TestPointerEvent('pointermove', {
    bubbles: true, pointerId: 1, clientX: 140, clientY: 125,
  }));
  fireEvent(map, new TestPointerEvent('pointerup', { bubbles: true, pointerId: 1 }));

  expect(map).toHaveAttribute('viewBox', '-40 -25 960 640');
  expect(plan).toHaveClass('city-building--document', 'city-building--recent');
  expect(photo).toHaveClass('city-building--image', 'city-building--aged');
  expect(plan.querySelector('rect')).not.toHaveAttribute('fill', photo.querySelector('rect')?.getAttribute('fill'));
  expect(plan.querySelector('rect')).not.toHaveAttribute('opacity', photo.querySelector('rect')?.getAttribute('opacity'));
});
