import spatialConfig from '../../config/spatial.json';
import type { Building } from '@/types/building';

export type CellCoord = { ix: number; iy: number };

export class SpatialIndex {
  readonly cellSize: number;
  readonly originX: number;
  readonly originY: number;
  readonly nx: number;
  readonly ny: number;
  private readonly cells: Building[][];

  constructor(buildings: Building[], cellSize = spatialConfig.cellSizeM) {
    this.cellSize = cellSize;
    if (buildings.length === 0) {
      this.originX = 0;
      this.originY = 0;
      this.nx = 0;
      this.ny = 0;
      this.cells = [];
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const b of buildings) {
      if (b.minX < minX) minX = b.minX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.maxY > maxY) maxY = b.maxY;
    }

    this.originX = Math.floor(minX / cellSize) * cellSize;
    this.originY = Math.floor(minY / cellSize) * cellSize;
    const maxIx = Math.floor(maxX / cellSize);
    const maxIy = Math.floor(maxY / cellSize);
    const minIx = Math.floor(this.originX / cellSize);
    const minIy = Math.floor(this.originY / cellSize);
    this.nx = maxIx - minIx + 1;
    this.ny = maxIy - minIy + 1;
    this.cells = Array.from({ length: this.nx * this.ny }, () => []);

    for (const b of buildings) {
      const x0 = Math.max(0, Math.floor((b.minX - this.originX) / cellSize));
      const y0 = Math.max(0, Math.floor((b.minY - this.originY) / cellSize));
      const x1 = Math.min(this.nx - 1, Math.floor((b.maxX - this.originX) / cellSize));
      const y1 = Math.min(this.ny - 1, Math.floor((b.maxY - this.originY) / cellSize));
      for (let iy = y0; iy <= y1; iy++) {
        for (let ix = x0; ix <= x1; ix++) {
          this.cells[iy * this.nx + ix].push(b);
        }
      }
    }
  }

  inGrid(ix: number, iy: number): boolean {
    return ix >= 0 && iy >= 0 && ix < this.nx && iy < this.ny;
  }

  worldToCell(x: number, y: number): CellCoord {
    return {
      ix: Math.floor((x - this.originX) / this.cellSize),
      iy: Math.floor((y - this.originY) / this.cellSize),
    };
  }

  queryBbox(minX: number, minY: number, maxX: number, maxY: number): Building[] {
    if (this.nx === 0 || this.ny === 0) return [];
    const x0 = Math.max(0, Math.floor((minX - this.originX) / this.cellSize));
    const y0 = Math.max(0, Math.floor((minY - this.originY) / this.cellSize));
    const x1 = Math.min(this.nx - 1, Math.floor((maxX - this.originX) / this.cellSize));
    const y1 = Math.min(this.ny - 1, Math.floor((maxY - this.originY) / this.cellSize));
    const seen = new Set<string>();
    const out: Building[] = [];
    for (let iy = y0; iy <= y1; iy++) {
      for (let ix = x0; ix <= x1; ix++) {
        for (const b of this.cells[iy * this.nx + ix]) {
          if (seen.has(b.id)) continue;
          if (b.maxX < minX || b.minX > maxX || b.maxY < minY || b.minY > maxY) continue;
          seen.add(b.id);
          out.push(b);
        }
      }
    }
    return out;
  }

  /**
   * Amanatides–Woo DDA. dir은 방향 벡터(정규화 불필요).
   * (0,0) 방향은 시작 셀만 한 번 yield하고 종료한다.
   */
  *traverseRay(
    origin: { x: number; y: number },
    dir: { x: number; y: number },
    maxDist: number,
  ): Generator<CellCoord> {
    if (!(maxDist > 0) || this.nx === 0 || this.ny === 0) return;

    const len = Math.hypot(dir.x, dir.y);
    if (len === 0) {
      const c = this.worldToCell(origin.x, origin.y);
      if (this.inGrid(c.ix, c.iy)) yield c;
      return;
    }

    const dx = dir.x / len;
    const dy = dir.y / len;
    let ix = Math.floor((origin.x - this.originX) / this.cellSize);
    let iy = Math.floor((origin.y - this.originY) / this.cellSize);
    const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
    const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
    const tDeltaX = stepX === 0 ? Infinity : this.cellSize / Math.abs(dx);
    const tDeltaY = stepY === 0 ? Infinity : this.cellSize / Math.abs(dy);

    const firstBoundaryX =
      stepX > 0
        ? this.originX + (ix + 1) * this.cellSize
        : stepX < 0
          ? this.originX + ix * this.cellSize
          : Infinity;
    const firstBoundaryY =
      stepY > 0
        ? this.originY + (iy + 1) * this.cellSize
        : stepY < 0
          ? this.originY + iy * this.cellSize
          : Infinity;

    let tMaxX = stepX === 0 ? Infinity : (firstBoundaryX - origin.x) / dx;
    let tMaxY = stepY === 0 ? Infinity : (firstBoundaryY - origin.y) / dy;
    if (tMaxX < 0) tMaxX = 0;
    if (tMaxY < 0) tMaxY = 0;

    const seen = new Set<string>();
    const maxSteps = this.nx * this.ny + 4;
    let steps = 0;
    let t = 0;

    while (t <= maxDist && steps < maxSteps) {
      steps += 1;
      const key = `${ix},${iy}`;
      if (this.inGrid(ix, iy) && !seen.has(key)) {
        seen.add(key);
        yield { ix, iy };
      }

      if (tMaxX === Infinity && tMaxY === Infinity) break;

      if (tMaxX < tMaxY) {
        t = tMaxX;
        if (t > maxDist) break;
        ix += stepX;
        tMaxX += tDeltaX;
      } else if (tMaxY < tMaxX) {
        t = tMaxY;
        if (t > maxDist) break;
        iy += stepY;
        tMaxY += tDeltaY;
      } else {
        t = tMaxX;
        if (t > maxDist) break;
        ix += stepX;
        iy += stepY;
        tMaxX += tDeltaX;
        tMaxY += tDeltaY;
      }
    }
  }
}

export function buildSpatialIndex(
  buildings: Building[],
  cellSize = spatialConfig.cellSizeM,
): SpatialIndex {
  return new SpatialIndex(buildings, cellSize);
}
