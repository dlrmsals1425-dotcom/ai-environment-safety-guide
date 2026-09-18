import { metersPerDegree, toEnu, type EnuOrigin } from '@/geo/enu';
import { bufferBboxMeters, type BBox } from '@/geo/aoi';

export interface GroundGrid {
  width: number; height: number; west: number; north: number; step: number;
  values: Float32Array;
}
export interface LocalGround {
  width: number; height: number; x0: number; y0: number; dx: number; dy: number;
  values: Float32Array;
}
export const TERRAIN_RADIUS_M = 3000;
export const TERRAIN_STEP_M = 15;

function interpolate(g: {width: number; height: number; values: Float32Array}, col: number, row: number): number {
  if (col < 0 || row < 0 || col > g.width-1 || row > g.height-1) return NaN;
  const c = Math.min(Math.floor(col), g.width-2), r = Math.min(Math.floor(row), g.height-2);
  const u = col-c, v = row-r, k = r*g.width+c;
  return (g.values[k]*(1-u)+g.values[k+1]*u)*(1-v)
    +(g.values[k+g.width]*(1-u)+g.values[k+g.width+1]*u)*v;
}
export function groundAt(g: GroundGrid, lon: number, lat: number): number {
  return interpolate(g, (lon-g.west)/g.step, (g.north-lat)/g.step);
}
export function localGroundAt(g: LocalGround, x: number, y: number): number {
  return interpolate(g, (x-g.x0)/g.dx, (y-g.y0)/g.dy);
}
export function groundCovers(g: GroundGrid | null, bbox: BBox, radius = TERRAIN_RADIUS_M): boolean {
  if (!g) return false;
  const b = bufferBboxMeters(bbox, radius+60);
  return b[0] >= g.west && b[2] <= g.west+(g.width-1)*g.step
    && b[3] <= g.north && b[1] >= g.north-(g.height-1)*g.step;
}
/** Crop before sending to workers: ~0.3 MB around a 500 m AOI, not the 30 MB city grid. */
export function cropGround(g: GroundGrid, bbox: BBox, origin: EnuOrigin): LocalGround {
  if (!groundCovers(g, bbox)) throw new Error('관심구역 주변 3km 지형 자료가 부족합니다.');
  const b = bufferBboxMeters(bbox, TERRAIN_RADIUS_M+60);
  const c0 = Math.floor((b[0]-g.west)/g.step), c1 = Math.ceil((b[2]-g.west)/g.step);
  const r0 = Math.floor((g.north-b[3])/g.step), r1 = Math.ceil((g.north-b[1])/g.step);
  const width = c1-c0+1, height = r1-r0+1;
  const values = new Float32Array(width*height);
  for (let r=0; r<height; r++) values.set(g.values.subarray((r0+r)*g.width+c0, (r0+r)*g.width+c1+1), r*width);
  const p = toEnu(g.west+c0*g.step, g.north-r0*g.step, origin);
  const m = metersPerDegree(origin.lat0);
  return {width, height, x0:p.x, y0:p.y, dx:g.step*m.mPerDegLon, dy:-g.step*m.mPerDegLat, values};
}
let cached: Promise<GroundGrid> | undefined;
export function loadGround(): Promise<GroundGrid> {
  return cached ??= (async () => {
    const response = await fetch('/data/seoul/ground/meta.json');
    if (!response.ok) throw new Error(`추정 지면 메타 로드 실패 (${response.status})`);
    const meta = await response.json();
    const grid = meta.grid;
    if (!grid || !Number.isInteger(grid.width) || !Number.isInteger(grid.height)
      || grid.width < 2 || grid.height < 2 || !(grid.step > 0)
      || !Number.isFinite(grid.west) || !Number.isFinite(grid.north)) throw new Error('추정 지면 격자 형식 오류');
    const binary = await fetch(grid.url);
    if (!binary.ok) throw new Error(`추정 지면 격자 로드 실패 (${binary.status})`);
    const bytes = await binary.arrayBuffer();
    if (bytes.byteLength !== grid.width*grid.height*4) throw new Error('추정 지면 격자 크기 불일치');
    const values = new Float32Array(bytes);
    if (!values.every(Number.isFinite)) throw new Error('추정 지면에 결측 고도가 있습니다.');
    return {...grid, values};
  })().catch((err) => { cached = undefined; throw err; });
}
