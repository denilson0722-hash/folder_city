import { render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';

import App from './App';

const { mockUseFolderScan } = vi.hoisted(() => ({
  mockUseFolderScan: vi.fn(),
}));

vi.mock('./hooks/useFolderScan', () => ({
  useFolderScan: mockUseFolderScan,
}));

beforeEach(() => {
  mockUseFolderScan.mockReturnValue({
    status: 'idle',
    result: null,
    error: null,
    scannedCount: 0,
    pickFolder: vi.fn(),
    reset: vi.fn(),
  });
});

test('shows the Folder City title', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: '文件夹城市' })).toBeInTheDocument();
});

test('explains the metadata-only privacy boundary before scanning', () => {
  render(<App />);

  expect(screen.getByText('不会上传或保存任何文件内容。')).toBeInTheDocument();
});

test('explains when a successfully scanned folder has no files to build', () => {
  mockUseFolderScan.mockReturnValue({
    status: 'success',
    result: {
      entries: [],
      skippedCount: 0,
      wasTruncated: false,
      scannedAt: new Date('2026-07-13T00:00:00Z'),
    },
    error: null,
    scannedCount: 0,
    pickFolder: vi.fn(),
    reset: vi.fn(),
  });

  render(<App />);

  expect(screen.getByText('这个文件夹还没有可建造的文件。')).toBeInTheDocument();
});
