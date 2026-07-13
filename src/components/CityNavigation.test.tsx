import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { buildCity } from '../lib/cityModel';
import type { FileEntry } from '../types';
import { CityNavigation } from './CityNavigation';

const entries: FileEntry[] = [
  {
    name: 'guide.pdf',
    relativePath: 'docs/guide.pdf',
    size: 4_096,
    lastModified: new Date('2026-07-12T00:00:00Z'),
    type: 'application/pdf',
  },
  {
    name: 'index.ts',
    relativePath: 'src/index.ts',
    size: 8_192,
    lastModified: new Date('2026-07-11T00:00:00Z'),
    type: 'text/typescript',
  },
];

const city = buildCity(entries, new Date('2026-07-13T00:00:00Z'));

test('lists the full city and every district with exact file counts', () => {
  render(
    <CityNavigation
      city={city}
      activeDistrictKey={null}
      onSelectDistrict={vi.fn()}
      onShowCity={vi.fn()}
    />,
  );

  expect(screen.getByRole('navigation', { name: '城市导航' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '全城概览，共 2 个文件' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('button', { name: /代码街区 · src · 深度 1，共 1 个文件/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /文档街区 · docs · 深度 1，共 1 个文件/ })).toBeInTheDocument();
});

test('emits district and full-city navigation without owning selection state', async () => {
  const user = userEvent.setup();
  const onSelectDistrict = vi.fn();
  const onShowCity = vi.fn();
  const codeDistrict = city.find((building) => building.category === 'code')!;

  render(
    <CityNavigation
      city={city}
      activeDistrictKey={codeDistrict.districtKey}
      onSelectDistrict={onSelectDistrict}
      onShowCity={onShowCity}
    />,
  );

  const activeDistrict = screen.getByRole('button', { name: /代码街区 · src · 深度 1，共 1 个文件/ });
  expect(activeDistrict).toHaveAttribute('aria-current', 'page');
  await user.click(screen.getByRole('button', { name: /文档街区 · docs · 深度 1，共 1 个文件/ }));
  await user.click(screen.getByRole('button', { name: '全城概览，共 2 个文件' }));

  expect(onSelectDistrict).toHaveBeenCalledWith(city.find((building) => building.category === 'document')!.districtKey);
  expect(onShowCity).toHaveBeenCalledOnce();
});
