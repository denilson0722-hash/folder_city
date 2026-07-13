import { describe, expect, test } from 'vitest';

import {
  InvalidCityBoundsError,
  clampZoom,
  fitBounds,
  paddedBounds,
  unionBounds,
} from './cityViewport';

describe('unionBounds', () => {
  test('returns the smallest bounds containing every input', () => {
    expect(unionBounds([
      { minX: 20, minY: 10, maxX: 120, maxY: 90 },
      { minX: -10, minY: 30, maxX: 40, maxY: 150 },
    ])).toEqual({ minX: -10, minY: 10, maxX: 120, maxY: 150 });
  });

  test('returns null for empty input', () => {
    expect(unionBounds([])).toBeNull();
  });

  test('rejects non-finite bounds', () => {
    expect(() => unionBounds([
      { minX: 0, minY: 0, maxX: Number.POSITIVE_INFINITY, maxY: 10 },
    ])).toThrow(InvalidCityBoundsError);
  });
});

describe('paddedBounds', () => {
  test('pads each axis by the requested ratio', () => {
    expect(paddedBounds(
      { minX: 0, minY: 20, maxX: 100, maxY: 70 },
      0.1,
    )).toEqual({ minX: -10, minY: 15, maxX: 110, maxY: 75 });
  });
});

describe('fitBounds', () => {
  test('contains padded landscape content at the container aspect ratio', () => {
    const fitted = fitBounds(
      { minX: 0, minY: 0, maxX: 1000, maxY: 400 },
      { width: 1000, height: 700 },
      0.06,
    );

    expect(fitted.x).toBeLessThanOrEqual(-60);
    expect(fitted.x + fitted.width).toBeGreaterThanOrEqual(1060);
    expect(fitted.y).toBeLessThanOrEqual(-24);
    expect(fitted.y + fitted.height).toBeGreaterThanOrEqual(424);
    expect(fitted.width / fitted.height).toBeCloseTo(1000 / 700);
  });

  test('contains all padded content in a portrait container', () => {
    const source = { minX: 10, minY: 20, maxX: 410, maxY: 220 };
    const padded = paddedBounds(source, 0.06);
    const fitted = fitBounds(source, { width: 400, height: 800 }, 0.06);

    expect(fitted.x).toBeLessThanOrEqual(padded.minX);
    expect(fitted.y).toBeLessThanOrEqual(padded.minY);
    expect(fitted.x + fitted.width).toBeGreaterThanOrEqual(padded.maxX);
    expect(fitted.y + fitted.height).toBeGreaterThanOrEqual(padded.maxY);
    expect(fitted.width / fitted.height).toBeCloseTo(0.5);
  });

  test.each([
    [{ width: 0, height: 700 }],
    [{ width: 1000, height: Number.NaN }],
  ])('rejects a zero or non-finite container size', (viewport) => {
    expect(() => fitBounds(
      { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      viewport,
    )).toThrow(InvalidCityBoundsError);
  });
});

describe('clampZoom', () => {
  test('clamps zoom-in width to 320 while preserving aspect ratio and anchor', () => {
    expect(clampZoom(
      { x: 0, y: 0, width: 960, height: 640 },
      0.01,
      { x: 240, y: 160 },
    )).toEqual({
      x: 160,
      y: 106.66666666666667,
      width: 320,
      height: 213.33333333333334,
    });
  });

  test('clamps zoom-out width to 1,920 while preserving aspect ratio and anchor', () => {
    expect(clampZoom(
      { x: 100, y: 50, width: 960, height: 640 },
      10,
      { x: 580, y: 370 },
    )).toEqual({ x: -380, y: -270, width: 1920, height: 1280 });
  });
});
