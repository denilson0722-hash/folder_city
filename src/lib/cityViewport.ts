import type { Bounds, ViewBox, ViewportSize } from '../types';

const MIN_VIEW_BOX_WIDTH = 320;
const MAX_VIEW_BOX_WIDTH = 1_920;

export class InvalidCityBoundsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCityBoundsError';
  }
}

function assertFiniteBounds(bounds: Bounds): void {
  if (![bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(Number.isFinite)) {
    throw new InvalidCityBoundsError('City bounds must contain only finite values.');
  }
}

export function unionBounds(bounds: readonly Bounds[]): Bounds | null {
  if (bounds.length === 0) {
    return null;
  }

  bounds.forEach(assertFiniteBounds);
  return bounds.slice(1).reduce<Bounds>((union, current) => ({
    minX: Math.min(union.minX, current.minX),
    minY: Math.min(union.minY, current.minY),
    maxX: Math.max(union.maxX, current.maxX),
    maxY: Math.max(union.maxY, current.maxY),
  }), { ...bounds[0] });
}

export function paddedBounds(bounds: Bounds, ratio = 0.06): Bounds {
  assertFiniteBounds(bounds);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  return {
    minX: bounds.minX - width * ratio,
    minY: bounds.minY - height * ratio,
    maxX: bounds.maxX + width * ratio,
    maxY: bounds.maxY + height * ratio,
  };
}

export function fitBounds(
  bounds: Bounds,
  viewport: ViewportSize,
  ratio = 0.06,
): ViewBox {
  if (!Number.isFinite(viewport.width)
    || !Number.isFinite(viewport.height)
    || viewport.width <= 0
    || viewport.height <= 0) {
    throw new InvalidCityBoundsError('Viewport dimensions must be finite and greater than zero.');
  }

  const padded = paddedBounds(bounds, ratio);
  let width = padded.maxX - padded.minX;
  let height = padded.maxY - padded.minY;
  const targetAspectRatio = viewport.width / viewport.height;

  if (width / height > targetAspectRatio) {
    height = width / targetAspectRatio;
  } else {
    width = height * targetAspectRatio;
  }

  const centerX = (padded.minX + padded.maxX) / 2;
  const centerY = (padded.minY + padded.maxY) / 2;
  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  };
}

export function clampZoom(
  viewBox: ViewBox,
  scale: number,
  anchor: { x: number; y: number },
): ViewBox {
  const width = Math.min(
    MAX_VIEW_BOX_WIDTH,
    Math.max(MIN_VIEW_BOX_WIDTH, viewBox.width * scale),
  );
  const appliedScale = width / viewBox.width;
  const height = width / (viewBox.width / viewBox.height);

  return {
    x: anchor.x - (anchor.x - viewBox.x) * appliedScale,
    y: anchor.y - (anchor.y - viewBox.y) * appliedScale,
    width,
    height,
  };
}
