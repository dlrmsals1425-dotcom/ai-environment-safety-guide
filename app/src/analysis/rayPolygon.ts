/** 2D 레이-폴리곤 교차. ring은 ENU [x0,y0,...], 폐합 여부는 무관. */

export function pointInRing(px: number, py: number, ring: Float64Array): boolean {
  const n = Math.floor(ring.length / 2);
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i * 2];
    const yi = ring[i * 2 + 1];
    const xj = ring[j * 2];
    const yj = ring[j * 2 + 1];
    const hit =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi + 0.0) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

export function pointInSolid(
  px: number,
  py: number,
  ring: Float64Array,
  holes?: Float64Array[],
): boolean {
  if (!pointInRing(px, py, ring)) return false;
  if (!holes || holes.length === 0) return true;
  return holes.every((hole) => !pointInRing(px, py, hole));
}

const T_GROUP = 1e-8;
const PROBE = 1e-6;

/** 단위 방향 기준 교차 거리 t(m). 꼭짓점은 양 변에서 같은 t로 잡힐 수 있다. */
function raySegT(
  px: number,
  py: number,
  dx: number,
  dy: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number | null {
  const ex = bx - ax;
  const ey = by - ay;
  const det = dx * ey - dy * ex;
  if (Math.abs(det) < 1e-12) return null;
  const tx = ax - px;
  const ty = ay - py;
  const s = (tx * ey - ty * ex) / det;
  const u = (tx * dy - ty * dx) / det;
  if (u < -1e-10 || u > 1 + 1e-10) return null;
  if (s <= 1e-10) return null;
  return s;
}

function collectHitT(
  px: number,
  py: number,
  ux: number,
  uy: number,
  ring: Float64Array,
  hits: number[],
): void {
  const n = Math.floor(ring.length / 2);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const t = raySegT(
      px,
      py,
      ux,
      uy,
      ring[i * 2],
      ring[i * 2 + 1],
      ring[j * 2],
      ring[j * 2 + 1],
    );
    if (t != null) hits.push(t);
  }
}

/** 외곽 − holes 솔리드와의 첫 교차 구간. */
export function intersectRaySolid2D(
  px: number,
  py: number,
  dx: number,
  dy: number,
  ring: Float64Array,
  holes?: Float64Array[],
): { tIn: number; tOut: number } | null {
  const len = Math.hypot(dx, dy);
  if (len === 0) {
    return pointInSolid(px, py, ring, holes) ? { tIn: 0, tOut: 0 } : null;
  }
  const ux = dx / len;
  const uy = dy / len;
  const hits: number[] = [];
  collectHitT(px, py, ux, uy, ring, hits);
  holes?.forEach((hole) => collectHitT(px, py, ux, uy, hole, hits));
  hits.sort((a, b) => a - b);

  const solidAt = (t: number) =>
    pointInSolid(px + ux * t, py + uy * t, ring, holes);

  let tEnter: number | null = solidAt(0) ? 0 : null;
  let i = 0;
  while (i < hits.length) {
    const t = hits[i];
    let j = i + 1;
    while (j < hits.length && Math.abs(hits[j] - t) <= T_GROUP) j += 1;
    // 같은 t의 이중 교차는 토글하지 않고, 전후 실제 내부로 관통/접선을 가른다.
    const before = solidAt(t - PROBE);
    const after = solidAt(t + PROBE);
    if (tEnter == null && !before && after) tEnter = t;
    else if (tEnter != null && before && !after) {
      return { tIn: tEnter, tOut: t };
    }
    i = j;
  }
  if (tEnter != null) return { tIn: tEnter, tOut: Number.POSITIVE_INFINITY };
  return null;
}

export function intersectRayPolygon2D(
  px: number,
  py: number,
  dx: number,
  dy: number,
  ring: Float64Array,
  holes?: Float64Array[],
): { tIn: number; tOut: number } | null {
  return intersectRaySolid2D(px, py, dx, dy, ring, holes);
}
