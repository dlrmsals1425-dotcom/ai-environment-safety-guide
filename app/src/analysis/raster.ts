import type { GridSpec } from '@/analysis/grid';
import { gridIndex } from '@/analysis/grid';
import { pointInSolid } from '@/analysis/rayPolygon';

function setCell(mask: Uint8Array, spec: GridSpec, ix: number, iy: number): void {
  if (ix < 0 || iy < 0 || ix >= spec.nx || iy >= spec.ny) return;
  mask[gridIndex(spec, ix, iy)] = 1;
}

/** 변 함수 삼각형 래스터. 좌표는 ENU m. */
export function rasterizeTriangle(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  mask: Uint8Array,
  spec: GridSpec,
): void {
  const toIx = (x: number) => Math.floor((x - spec.originX) / spec.cellSize);
  const toIy = (y: number) => Math.floor((y - spec.originY) / spec.cellSize);
  const minX = Math.min(ax, bx, cx);
  const minY = Math.min(ay, by, cy);
  const maxX = Math.max(ax, bx, cx);
  const maxY = Math.max(ay, by, cy);
  const ix0 = Math.max(0, toIx(minX));
  const iy0 = Math.max(0, toIy(minY));
  const ix1 = Math.min(spec.nx - 1, toIx(maxX));
  const iy1 = Math.min(spec.ny - 1, toIy(maxY));
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (Math.abs(area) < 1e-12) return;
  for (let iy = iy0; iy <= iy1; iy++) {
    for (let ix = ix0; ix <= ix1; ix++) {
      const px = spec.originX + (ix + 0.5) * spec.cellSize;
      const py = spec.originY + (iy + 0.5) * spec.cellSize;
      const w0 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
      const w1 = (cx - bx) * (py - by) - (cy - by) * (px - bx);
      const w2 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
      if (w0 >= 0 && w1 >= 0 && w2 >= 0) setCell(mask, spec, ix, iy);
      else if (w0 <= 0 && w1 <= 0 && w2 <= 0) setCell(mask, spec, ix, iy);
    }
  }
}

export function rasterizeQuad(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  mask: Uint8Array,
  spec: GridSpec,
): void {
  rasterizeTriangle(x0, y0, x1, y1, x2, y2, mask, spec);
  rasterizeTriangle(x0, y0, x2, y2, x3, y3, mask, spec);
}

export function rasterizeRing(
  ring: Float64Array,
  mask: Uint8Array,
  spec: GridSpec,
  holes?: Float64Array[],
): void {
  const n = Math.floor(ring.length / 2);
  if (n < 3) return;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = ring[i * 2];
    const y = ring[i * 2 + 1];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const ix0 = Math.max(0, Math.floor((minX - spec.originX) / spec.cellSize));
  const iy0 = Math.max(0, Math.floor((minY - spec.originY) / spec.cellSize));
  const ix1 = Math.min(spec.nx - 1, Math.floor((maxX - spec.originX) / spec.cellSize));
  const iy1 = Math.min(spec.ny - 1, Math.floor((maxY - spec.originY) / spec.cellSize));
  for (let iy = iy0; iy <= iy1; iy++) {
    for (let ix = ix0; ix <= ix1; ix++) {
      const px = spec.originX + (ix + 0.5) * spec.cellSize;
      const py = spec.originY + (iy + 0.5) * spec.cellSize;
      if (pointInSolid(px, py, ring, holes)) setCell(mask, spec, ix, iy);
    }
  }
}
