import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { Controls } from './Controls';

test('calls the folder picker when its button is clicked', async () => {
  const user = userEvent.setup();
  const onPickFolder = vi.fn();

  render(
    <Controls
      filters={{ category: 'all', freshness: 'all' }}
      onChange={vi.fn()}
      onPickFolder={onPickFolder}
      onReset={vi.fn()}
    />,
  );

  await user.click(screen.getByRole('button', { name: '选择文件夹' }));

  expect(onPickFolder).toHaveBeenCalledOnce();
});

test('reports an updated controlled type filter', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();

  render(
    <Controls
      filters={{ category: 'all', freshness: 'all' }}
      onChange={onChange}
      onPickFolder={vi.fn()}
      onReset={vi.fn()}
    />,
  );

  await user.selectOptions(screen.getByLabelText('文件类型'), 'image');

  expect(onChange).toHaveBeenCalledWith({ category: 'image', freshness: 'all' });
});
