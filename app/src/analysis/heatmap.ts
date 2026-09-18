import analysisConfig from '../../config/analysis.json';
import type { GridSpec } from '@/analysis/grid';
import type { BBox } from '@/geo/aoi';

/** 0h 남색 → maxH 금색. 명도 단조 증가. */
export function sunHoursToRgba(
  hours: Float32Array,
  spec: GridSpec,
  maxH = analysisConfig.sunHoursMaxH,
  northUp = false,
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(spec.nx * spec.ny * 4);
  const navy = [20, 48, 96];
  const gold = [232, 184, 74];
  for (let iy = 0; iy < spec.ny; iy++) {
    const row = northUp ? spec.ny - 1 - iy : iy;
    for (let ix = 0; ix < spec.nx; ix++) {
      const src = iy * spec.nx + ix;
      const t = Math.max(0, Math.min(1, hours[src] / maxH));
      const o = (row * spec.nx + ix) * 4;
      rgba[o] = Math.round(navy[0] + (gold[0] - navy[0]) * t);
      rgba[o + 1] = Math.round(navy[1] + (gold[1] - navy[1]) * t);
      rgba[o + 2] = Math.round(navy[2] + (gold[2] - navy[2]) * t);
      rgba[o + 3] = 180;
    }
  }
  return rgba;
}

export function sunHoursCanvas(
  hours: Float32Array,
  spec: GridSpec,
  maxH = analysisConfig.sunHoursMaxH,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = spec.nx;
  canvas.height = spec.ny;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(spec.nx, spec.ny);
  img.data.set(sunHoursToRgba(hours, spec, maxH, true));
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** MapLibre image source: 북서 → 북동 → 남동 → 남서 (이미지 상단 = 북쪽). */
export function sunHoursImageCoordinates(
  bounds: BBox,
): [[number, number], [number, number], [number, number], [number, number]] {
  const [west, south, east, north] = bounds;
  return [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ];
}
