import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { CityControls } from './CityControls';

test('reports the city level and emits viewport actions', async () => {
  const user = userEvent.setup();
  const onZoomIn = vi.fn();
  const onZoomOut = vi.fn();
  const onFit = vi.fn();

  render(
    <CityControls
      level="city"
      onZoomIn={onZoomIn}
      onZoomOut={onZoomOut}
      onFit={onFit}
      onBackToCity={vi.fn()}
    />,
  );

  expect(screen.getByLabelText('城市地图控制')).toHaveTextContent('全城级');
  await user.click(screen.getByRole('button', { name: '放大' }));
  await user.click(screen.getByRole('button', { name: '缩小' }));
  await user.click(screen.getByRole('button', { name: '适应视图' }));

  expect(onZoomIn).toHaveBeenCalledOnce();
  expect(onZoomOut).toHaveBeenCalledOnce();
  expect(onFit).toHaveBeenCalledOnce();
  expect(screen.queryByRole('button', { name: '返回全城' })).not.toBeInTheDocument();
});

test('offers a return action at district level', async () => {
  const user = userEvent.setup();
  const onBackToCity = vi.fn();

  render(
    <CityControls
      level="district"
      onZoomIn={vi.fn()}
      onZoomOut={vi.fn()}
      onFit={vi.fn()}
      onBackToCity={onBackToCity}
    />,
  );

  expect(screen.getByLabelText('城市地图控制')).toHaveTextContent('街区级');
  await user.click(screen.getByRole('button', { name: '返回全城' }));
  expect(onBackToCity).toHaveBeenCalledOnce();
});
