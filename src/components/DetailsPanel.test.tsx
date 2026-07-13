import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { DetailsPanel } from './DetailsPanel';
import type { CityBuilding } from '../types';

const imageBuilding: CityBuilding = {
  name: 'design.png',
  relativePath: 'assets/design.png',
  size: 2_516_582,
  lastModified: new Date('2026-07-01T00:00:00Z'),
  type: 'image/png',
  category: 'image',
  freshness: 'recent',
  districtKey: 'image:assets:1',
  firstLevelDirectory: 'assets',
  directoryDepth: 1,
  height: 120,
  x: 72,
  y: 180,
  width: 54,
  districtLabel: '图像街区',
};

test('shows the selected image path and story, then closes', async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();

  render(<DetailsPanel building={imageBuilding} onClose={onClose} />);

  expect(screen.getByLabelText('文件详情')).toHaveTextContent('assets/design.png');
  expect(screen.getByLabelText('文件详情')).toHaveTextContent('“design.png”属于图像街区');

  await user.click(screen.getByRole('button', { name: '关闭详情' }));

  expect(onClose).toHaveBeenCalledOnce();
});
