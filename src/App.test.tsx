import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

import App from './App';

const { mockIsDirectoryPickerSupported, mockUseFolderScan } = vi.hoisted(() => ({
  mockIsDirectoryPickerSupported: vi.fn(),
  mockUseFolderScan: vi.fn(),
}));

vi.mock('./hooks/useFolderScan', () => ({
  useFolderScan: mockUseFolderScan,
}));

vi.mock('./lib/fileSystem', async (importOriginal) => {
  const original = await importOriginal<typeof import('./lib/fileSystem')>();

  return {
    ...original,
    isDirectoryPickerSupported: mockIsDirectoryPickerSupported,
  };
});

beforeEach(() => {
  setViewport(1_440);
  mockIsDirectoryPickerSupported.mockReturnValue(true);
  mockUseFolderScan.mockReturnValue({
    status: 'idle',
    result: null,
    error: null,
    scannedCount: 0,
    pickFolder: vi.fn(),
    reset: vi.fn(),
  });
});

function setViewport(width: number) {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: query === '(max-width: 900px)' ? width <= 900 : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
}

function successfulEntries(entries: Array<{
  name: string;
  relativePath: string;
  type: string;
}>) {
  mockUseFolderScan.mockReturnValue({
    status: 'success',
    result: {
      entries: entries.map((entry, index) => ({
        ...entry,
        size: index + 1,
        lastModified: new Date('2026-07-13T00:00:00Z'),
      })),
      skippedCount: 0,
      wasTruncated: false,
      scannedAt: new Date('2026-07-13T00:00:00Z'),
    },
    error: null,
    scannedCount: entries.length,
    pickFolder: vi.fn(),
    reset: vi.fn(),
  });
}

function populateTwoDistricts() {
  successfulEntries([
    { name: 'guide.pdf', relativePath: 'docs/guide.pdf', type: 'application/pdf' },
    { name: 'index.ts', relativePath: 'src/index.ts', type: 'text/typescript' },
  ]);
}

test('shows the Folder City title', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: '文件夹城市' })).toBeInTheDocument();
});

test('shows the unsupported-browser state immediately when directory picking is unavailable', () => {
  mockIsDirectoryPickerSupported.mockReturnValue(false);

  render(<App />);

  expect(screen.getByRole('heading', { name: '当前浏览器不支持选择文件夹' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '选择文件夹' })).not.toBeInTheDocument();
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

test('updates the type distribution to match the active category filter', async () => {
  const user = userEvent.setup();
  mockUseFolderScan.mockReturnValue({
    status: 'success',
    result: {
      entries: [
        { name: 'guide.txt', relativePath: 'docs/guide.txt', size: 1, lastModified: new Date('2026-07-13T00:00:00Z'), type: 'text/plain' },
        { name: 'photo.jpg', relativePath: 'images/photo.jpg', size: 1, lastModified: new Date('2026-07-13T00:00:00Z'), type: 'image/jpeg' },
      ],
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
  await user.selectOptions(screen.getByLabelText('文件类型'), 'image');

  const distribution = screen.getByLabelText('当前筛选结果按类型分布');
  expect(distribution).toHaveTextContent('文档：0');
  expect(distribution).toHaveTextContent('图像：1');
});

test('composes populated desktop results as navigation, sandbox and information panels', () => {
  populateTwoDistricts();

  render(<App />);

  expect(screen.getByRole('navigation', { name: '城市导航' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: '城市沙盘' })).toBeInTheDocument();
  expect(screen.getByRole('complementary', { name: '信息面板' })).toBeInTheDocument();
});

test('keeps navigation and map on the same controlled active district', async () => {
  const user = userEvent.setup();
  populateTwoDistricts();
  render(<App />);

  const codeDistrict = within(screen.getByRole('navigation', { name: '城市导航' }))
    .getByRole('button', { name: /代码街区 · src · 深度 1，共 1 个文件/ });
  await user.click(codeDistrict);

  expect(codeDistrict).toHaveAttribute('aria-current', 'page');
  expect(screen.getByLabelText('城市地图控制')).toHaveTextContent('街区级');
});

test('returns to the full city when filtering removes the active district', async () => {
  const user = userEvent.setup();
  populateTwoDistricts();
  render(<App />);

  await user.click(within(screen.getByRole('navigation', { name: '城市导航' }))
    .getByRole('button', { name: /代码街区 · src · 深度 1，共 1 个文件/ }));
  await user.selectOptions(screen.getByLabelText('文件类型'), 'document');

  expect(screen.getByLabelText('城市地图控制')).toHaveTextContent('全城级');
  expect(screen.getByRole('button', { name: '全城概览，共 1 个文件' })).toHaveAttribute('aria-current', 'page');
});

test('uses a mobile drawer without changing the selected building story', async () => {
  const user = userEvent.setup();
  setViewport(390);
  populateTwoDistricts();
  render(<App />);

  await user.click(screen.getByRole('button', { name: /index\.ts/ }));

  const details = screen.getByLabelText('文件详情');
  expect(details).toHaveAttribute('data-layout', 'drawer');
  expect(details).toHaveTextContent('“index.ts”属于代码街区 · src · 深度 1');
});

test.each([
  { count: 20, strategy: 'exact' },
  { count: 200, strategy: 'representative' },
  { count: 700, strategy: 'aggregate' },
  { count: 1_000, strategy: 'aggregate' },
] as const)('keeps the exact $count-file source count with the $strategy city strategy', ({ count, strategy }) => {
  successfulEntries(Array.from({ length: count }, (_, index) => ({
    name: `file-${index}.txt`,
    relativePath: `docs/file-${String(index).padStart(4, '0')}.txt`,
    type: 'text/plain',
  })));

  const { container } = render(<App />);
  const fileGlyphs = container.querySelectorAll('[data-glyph="file"]');
  const clusters = container.querySelectorAll('[data-glyph="cluster"]');

  expect(screen.getByRole('button', { name: `全城概览，共 ${count} 个文件` })).toBeInTheDocument();
  if (strategy === 'exact') {
    expect(fileGlyphs).toHaveLength(count);
    expect(clusters).toHaveLength(0);
  } else if (strategy === 'representative') {
    expect(fileGlyphs.length).toBeGreaterThan(0);
    expect(fileGlyphs.length).toBeLessThan(count);
    expect(clusters.length).toBeGreaterThan(0);
  } else {
    expect(fileGlyphs).toHaveLength(0);
    expect(clusters.length).toBeGreaterThan(0);
  }
});
