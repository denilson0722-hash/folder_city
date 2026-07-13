import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import type { CityDistrict } from '../types';
import { DistrictLayer } from './DistrictLayer';

const district: CityDistrict = {
  key: 'code:src:1',
  label: '代码街区 · src · 深度 1',
  category: 'code',
  firstLevelDirectory: 'src',
  directoryDepth: 1,
  count: 37,
  totalBytes: 151_552,
  bounds: { minX: 40, minY: 60, maxX: 240, maxY: 280 },
};

test('renders a named district button with plate, title and count', () => {
  const { container } = render(
    <svg><DistrictLayer district={district} active={false} onActivate={vi.fn()} /></svg>,
  );

  expect(screen.getByRole('button', { name: '代码街区 · src · 深度 1，共 37 个文件' })).toBeInTheDocument();
  expect(screen.getByText('代码街区 · src · 深度 1')).toBeVisible();
  expect(screen.getByText('37')).toBeVisible();
  expect(container.querySelector('[data-district-plate]')).toHaveAttribute('width', '200');
  expect(container.querySelector('[data-district-plate]')).toHaveAttribute('height', '220');
});
test('activates with Enter and Space and reports the active state', async () => {
  const user = userEvent.setup();
  const onActivate = vi.fn();
  render(<svg><DistrictLayer district={district} active onActivate={onActivate} /></svg>);
  const layer = screen.getByRole('button', { name: /代码街区/ });

  expect(layer).toHaveAttribute('aria-pressed', 'true');
  layer.focus();
  await user.keyboard('{Enter} ');

  expect(onActivate).toHaveBeenCalledTimes(2);
  expect(onActivate).toHaveBeenNthCalledWith(1, district);
});
