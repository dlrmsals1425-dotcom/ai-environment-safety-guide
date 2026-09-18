import type { GridSpec } from '@/analysis/grid';
import { cellCenter, gridIndex } from '@/analysis/grid';
import { rasterizeQuad, rasterizeRing } from '@/analysis/raster';
import { intersectRaySolid2D, pointInSolid } from '@/analysis/rayPolygon';
import { SpatialIndex } from '@/geo/spatialIndex';
import type { Vec3 } from '@/solar/sunVector';
import type { Building } from '@/types/building';

function horizUnit(S: Vec3): { ux: number; uy: number; hxy: number } {
  const hxy = Math.hypot(S.x, S.y);
  if (hxy < 1e-12) return { ux: 0, uy: 0, hxy: 0 };
  return { ux: S.x / hxy, uy: S.y / hxy, hxy };
}

export function isSunlit(
  P: { x: number; y: number; z: number },
  S: Vec3,
  buildings: Building[],
  index: SpatialIndex,
  maxRoof?: number,
): boolean {
  if (S.z <= 0) return false;
  const { ux, uy, hxy } = horizUnit(S);
  if (hxy === 0) {
    const here = index.queryBbox(P.x, P.y, P.x, P.y);
    for (const b of here) {
      if (P.z >= b.baseZ + b.height) continue;
      if (pointInSolid(P.x, P.y, b.ring, b.holes)) return false;
    }
    return true;
  }
  const tanAlt = S.z / hxy;
  let hMax = maxRoof ?? -Infinity;
  if (maxRoof === undefined) for (const b of buildings) hMax = Math.max(hMax, b.baseZ + b.height);
  const dMax = (hMax - P.z) / tanAlt;
  if (dMax <= 0) return true;

  const seen = new Set<string>();
  for (const cell of index.traverseRay({ x: P.x, y: P.y }, { x: ux, y: uy }, dMax)) {
    const bucket = index.queryBbox(
      index.originX + cell.ix * index.cellSize,
      index.originY + cell.iy * index.cellSize,
      index.originX + (cell.ix + 1) * index.cellSize,
      index.originY + (cell.iy + 1) * index.cellSize,
    );
    for (const b of bucket) {
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      if (b.baseZ + b.height <= P.z) continue;
      const hit = intersectRaySolid2D(P.x, P.y, ux, uy, b.ring, b.holes);
      if (!hit) continue;
      if (hit.tOut <= 0) continue;
      const tIn = Math.max(hit.tIn, 0);
      const zAtEntry = P.z + tIn * tanAlt;
      if (zAtEntry < b.baseZ + b.height) return false;
    }
  }
  return true;
}

export function rasterizeShadow(
  building: Building,
  S: Vec3,
  alt: number,
  z0: number,
  mask: Uint8Array,
  spec: GridSpec,
): void {
  const hEff = building.baseZ + building.height - z0;
  if (hEff <= 0) return;
  const holes = building.holes;
  if (alt <= 0) {
    rasterizeRing(building.ring, mask, spec, holes);
    return;
  }
  const tanAlt = Math.tan(alt);
  if (tanAlt <= 1e-8) {
    rasterizeRing(building.ring, mask, spec, holes);
    return;
  }
  const L = hEff / tanAlt;
  const { ux, uy, hxy } = horizUnit(S);
  if (hxy === 0) {
    rasterizeRing(building.ring, mask, spec, holes);
    return;
  }
  const dx = -ux * L;
  const dy = -uy * L;
  rasterizeRing(building.ring, mask, spec, holes);
  const rings = [building.ring, ...(holes ?? [])];
  for (const ring of rings) {
    const n = Math.floor(ring.length / 2);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const x0 = ring[i * 2];
      const y0 = ring[i * 2 + 1];
      const x1 = ring[j * 2];
      const y1 = ring[j * 2 + 1];
      rasterizeQuad(x0, y0, x1, y1, x1 + dx, y1 + dy, x0 + dx, y0 + dy, mask, spec);
    }
  }
}

export type SunHoursParams = {
  buildings: Building[];
  index: SpatialIndex;
  spec: GridSpec;
  times: { S: Vec3; alt: number }[];
  z0: number;
  minAltDeg: number;
  stepMinutes: number;
  onProgress?: (ratio: number) => void;
  shouldCancel?: () => boolean;
};

export function sunHoursGrid(params: SunHoursParams): Float32Array {
  const { buildings, spec, times, z0, minAltDeg, stepMinutes } = params;
  const n = spec.nx * spec.ny;
  const counts = new Uint16Array(n);
  const minAlt = (minAltDeg * Math.PI) / 180;
  let done = 0;
  for (const t of times) {
    if (params.shouldCancel?.()) throw new DOMException('Aborted', 'AbortError');
    if (t.alt >= minAlt && t.S.z > 0) {
      const mask = new Uint8Array(n);
      for (const b of buildings) rasterizeShadow(b, t.S, t.alt, z0, mask, spec);
      for (let i = 0; i < n; i++) {
        if (!mask[i]) counts[i] += 1;
      }
    }
    done += 1;
    params.onProgress?.(done / times.length);
  }
  const hours = new Float32Array(n);
  const dt = stepMinutes / 60;
  for (let i = 0; i < n; i++) hours[i] = counts[i] * dt;
  return hours;
}

export function shadowLengthNorthMeters(
  building: Building,
  S: Vec3,
  index: SpatialIndex,
  buildings: Building[],
  maxScanM = 80,
): number {
  let lastShade = 0;
  let n = Math.floor(building.ring.length / 2);
  let maxY = -Infinity;
  let midX = 0;
  for (let i = 0; i < n; i++) {
    maxY = Math.max(maxY, building.ring[i * 2 + 1]);
    midX += building.ring[i * 2];
  }
  midX /= n;
  const step = 0.1;
  for (let d = step; d <= maxScanM; d += step) {
    const lit = isSunlit(
      { x: midX, y: maxY + d, z: 0 },
      S,
      buildings,
      index,
    );
    if (!lit) lastShade = d;
    else if (lastShade > 0) break;
  }
  return lastShade;
}

export function sampleAgreement(
  hours: Float32Array,
  spec: GridSpec,
  buildings: Building[],
  index: SpatialIndex,
  times: { S: Vec3; alt: number }[],
  z0: number,
  minAltDeg: number,
  stepMinutes: number,
  sampleCount: number,
): number {
  const minAlt = (minAltDeg * Math.PI) / 180;
  let agree = 0;
  const n = Math.min(sampleCount, spec.nx * spec.ny);
  const stride = Math.max(1, Math.floor((spec.nx * spec.ny) / n));
  let used = 0;
  for (let i = 0; i < spec.nx * spec.ny && used < n; i += stride) {
    const ix = i % spec.nx;
    const iy = Math.floor(i / spec.nx);
    const c = cellCenter(spec, ix, iy);
    let count = 0;
    for (const t of times) {
      if (t.alt < minAlt || t.S.z <= 0) continue;
      if (isSunlit({ x: c.x, y: c.y, z: z0 }, t.S, buildings, index)) count += 1;
    }
    const b = count * (stepMinutes / 60);
    if (Math.abs(b - hours[gridIndex(spec, ix, iy)]) <= stepMinutes / 60 + 1e-6) agree += 1;
    used += 1;
  }
  return used === 0 ? 1 : agree / used;
}
