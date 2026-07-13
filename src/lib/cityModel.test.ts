import { describe, expect, test } from 'vitest';
import {
  buildCity,
  classifyFile,
  freshnessFor,
  heightForBytes,
  storyFor,
  summarize,
} from './cityModel';

const now = new Date('2026-07-13T00:00:00Z');

describe('classifyFile', () => {
  test.each([
    ['report.PDF', 'document'],
    ['design.png', 'image'],
    ['recording.MP4', 'media'],
    ['app.tsx', 'code'],
    ['backup.tar', 'archive'],
    ['README', 'other'],
    ['.env', 'code'],
  ] as const)('classifies %s as %s', (name, category) => {
    expect(classifyFile(name)).toBe(category);
  });
});

test('scales file sizes with the specified clamped logarithmic formula', () => {
  expect(heightForBytes(0)).toBe(24);
  expect(heightForBytes(1024 ** 3)).toBe(180);
  expect(heightForBytes(1024 ** 4)).toBe(180);
  expect(heightForBytes(-1)).toBe(24);
});

test('classifies file freshness from whole-day age boundaries', () => {
  expect(freshnessFor(new Date('2026-07-06T00:00:00Z'), now)).toBe('recent');
  expect(freshnessFor(new Date('2026-07-05T00:00:00Z'), now)).toBe('current');
  expect(freshnessFor(new Date('2026-04-14T00:00:00Z'), now)).toBe('current');
  expect(freshnessFor(new Date('2026-04-13T00:00:00Z'), now)).toBe('aged');
});

test('builds a path-sorted, category-grid city with stable labels and positions', () => {
  const buildings = buildCity(
    [
      { name: 'z.png', relativePath: 'z.png', size: 1024 ** 3, lastModified: now, type: 'image/png' },
      { name: 'a.txt', relativePath: 'a/a.txt', size: 0, lastModified: new Date('2026-07-06T00:00:00Z'), type: 'text/plain' },
      { name: 'b.pdf', relativePath: 'a/b.pdf', size: 100, lastModified: now, type: 'application/pdf' },
      { name: 'c.md', relativePath: 'a/c.md', size: 100, lastModified: now, type: 'text/markdown' },
      { name: 'd.csv', relativePath: 'a/d.csv', size: 100, lastModified: now, type: 'text/csv' },
      { name: 'e.docx', relativePath: 'a/e.docx', size: 100, lastModified: now, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { name: 'f.xlsx', relativePath: 'a/f.xlsx', size: 100, lastModified: now, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      { name: 'g.pptx', relativePath: 'a/g.pptx', size: 100, lastModified: now, type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
    ],
    now,
  );

  expect(buildings.map(({ relativePath }) => relativePath)).toEqual([
    'a/a.txt',
    'a/b.pdf',
    'a/c.md',
    'a/d.csv',
    'a/e.docx',
    'a/f.xlsx',
    'a/g.pptx',
    'z.png',
  ]);
  expect(buildings[0]).toMatchObject({
    category: 'document',
    districtLabel: '文档街区 · a · 深度 1',
    x: 72,
    y: 276,
    width: 54,
  });
  expect(buildings[6]).toMatchObject({
    category: 'document',
    x: 72,
    y: 461,
    width: 54,
  });
  expect(buildings[7]).toMatchObject({
    category: 'image',
    districtLabel: '图像街区 · 根目录 · 深度 0',
    x: 572,
    y: 120,
    width: 54,
  });
});

test('uses code-unit relative-path order for repeatable building coordinates', () => {
  const entries = [
    { name: 'Z.txt', relativePath: 'Z.txt', size: 0, lastModified: now, type: 'text/plain' },
    { name: 'a.txt', relativePath: 'a.txt', size: 0, lastModified: now, type: 'text/plain' },
    { name: 'á.txt', relativePath: 'á.txt', size: 0, lastModified: now, type: 'text/plain' },
  ];

  const firstBuild = buildCity(entries, now);
  const secondBuild = buildCity(entries, now);

  expect(firstBuild.map(({ relativePath }) => relativePath)).toEqual(['Z.txt', 'a.txt', 'á.txt']);
  expect(firstBuild.map(({ relativePath, x, y }) => ({ relativePath, x, y }))).toEqual([
    { relativePath: 'Z.txt', x: 72, y: 276 },
    { relativePath: 'a.txt', x: 144, y: 276 },
    { relativePath: 'á.txt', x: 216, y: 276 },
  ]);
  expect(secondBuild).toEqual(firstBuild);
});

test('partitions each category by first-level directory and directory depth deterministically', () => {
  const entries = [
    { name: 'root.txt', relativePath: 'root.txt', size: 1, lastModified: now, type: 'text/plain' },
    { name: 'guide.txt', relativePath: 'docs/guide.txt', size: 1, lastModified: now, type: 'text/plain' },
    { name: 'plan.txt', relativePath: 'docs/plans/plan.txt', size: 1, lastModified: now, type: 'text/plain' },
    { name: 'notes.txt', relativePath: 'notes/notes.txt', size: 1, lastModified: now, type: 'text/plain' },
  ];

  const firstBuild = buildCity(entries, now);
  const secondBuild = buildCity([...entries].reverse(), now);
  const root = firstBuild.find((building) => building.relativePath === 'root.txt')!;
  const guide = firstBuild.find((building) => building.relativePath === 'docs/guide.txt')!;
  const plan = firstBuild.find((building) => building.relativePath === 'docs/plans/plan.txt')!;
  const notes = firstBuild.find((building) => building.relativePath === 'notes/notes.txt')!;

  expect(root).toMatchObject({ firstLevelDirectory: '根目录', directoryDepth: 0, districtLabel: '文档街区 · 根目录 · 深度 0' });
  expect(guide).toMatchObject({ firstLevelDirectory: 'docs', directoryDepth: 1, districtLabel: '文档街区 · docs · 深度 1' });
  expect(plan).toMatchObject({ firstLevelDirectory: 'docs', directoryDepth: 2, districtLabel: '文档街区 · docs · 深度 2' });
  expect(notes).toMatchObject({ firstLevelDirectory: 'notes', directoryDepth: 1 });
  expect(new Set([root.districtKey, guide.districtKey, plan.districtKey, notes.districtKey])).toHaveLength(4);
  expect(guide.y).not.toBe(notes.y);
  expect(firstBuild.map(({ relativePath, x, y, districtKey }) => ({ relativePath, x, y, districtKey })))
    .toEqual(secondBuild.map(({ relativePath, x, y, districtKey }) => ({ relativePath, x, y, districtKey })));
});

test('uses code-unit order for directory district positions', () => {
  const [zDistrict, accentDistrict] = buildCity([
    { name: 'z.txt', relativePath: 'z/z.txt', size: 1, lastModified: now, type: 'text/plain' },
    { name: 'accent.txt', relativePath: 'á/accent.txt', size: 1, lastModified: now, type: 'text/plain' },
  ], now);

  expect(zDistrict.relativePath).toBe('z/z.txt');
  expect(zDistrict.y).toBeLessThan(accentDistrict.y);
});

test('creates a readable story with metadata and summarizes buildings', () => {
  const [building] = buildCity([
    { name: 'design.png', relativePath: 'assets/design.png', size: 2_516_582, lastModified: new Date('2026-07-01T00:00:00Z'), type: 'image/png' },
  ], now);

  expect(storyFor(building)).toContain('design.png');
  expect(storyFor(building)).toContain('图像街区');
  expect(storyFor(building)).toContain('2026-07-01');
  expect(storyFor(building)).toContain('2.4 MB');
  expect(summarize([building])).toEqual({
    fileCount: 1,
    totalBytes: 2_516_582,
    largestFile: building,
    categoryCounts: {
      document: 0,
      image: 1,
      media: 0,
      code: 0,
      archive: 0,
      other: 0,
    },
  });
});
