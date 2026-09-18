import { toEnu, fromEnu, type EnuOrigin } from '@/geo/enu';
import type { BBox } from '@/geo/aoi';

export type GridSpec = {
  originX: number;
  originY: number;
  cellSize: number;
  nx: number;
  ny: number;
};

export function gridFromAoi(
  bbox: BBox,
  origin: EnuOrigin,
  cellSize: number,
): GridSpec {
  const sw = toEnu(bbox[0], bbox[1], origin);
  const ne = toEnu(bbox[2], bbox[3], origin);
  const minX = Math.min(sw.x, ne.x);
  const minY = Math.min(sw.y, ne.y);
  const maxX = Math.max(sw.x, ne.x);
  const maxY = Math.max(sw.y, ne.y);
  const nx = Math.max(1, Math.ceil((maxX - minX) / cellSize));
  const ny = Math.max(1, Math.ceil((maxY - minY) / cellSize));
  return { originX: minX, originY: minY, cellSize, nx, ny };
}

export function cellCenter(spec: GridSpec, ix: number, iy: number): { x: number; y: number } {
  return {
    x: spec.originX + (ix + 0.5) * spec.cellSize,
    y: spec.originY + (iy + 0.5) * spec.cellSize,
  };
}

export function gridIndex(spec: GridSpec, ix: number, iy: number): number {
  return iy * spec.nx + ix;
}

export function gridWgsBounds(spec: GridSpec, origin: EnuOrigin): BBox {
  const sw = fromEnu(spec.originX, spec.originY, origin);
  const ne = fromEnu(
    spec.originX + spec.nx * spec.cellSize,
    spec.originY + spec.ny * spec.cellSize,
    origin,
  );
  return [sw.lon, sw.lat, ne.lon, ne.lat];
}
