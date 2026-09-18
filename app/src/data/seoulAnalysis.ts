import { toEnu, type EnuOrigin } from '@/geo/enu';
import type { Building } from '@/types/building';
import type { SeoulBuildingFeature } from '@/types/seoul';
import { groundAt, type GroundGrid } from '@/data/ground';

function closeRing(coords: number[][]): number[][] {
  if (coords.length === 0) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return coords;
  return [...coords, [first[0], first[1]]];
}

function ringToEnu(coords: number[][], origin: EnuOrigin) {
  const closed = closeRing(coords);
  const n = Math.max(0, closed.length - 1);
  const ring = new Float64Array(n * 2);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const { x, y } = toEnu(closed[i][0], closed[i][1], origin);
    ring[i * 2] = x;
    ring[i * 2 + 1] = y;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { ring, minX, minY, maxX, maxY, lngLat: closed };
}

function polygonsOf(feature: SeoulBuildingFeature): number[][][][] {
  if (feature.geometry.type === 'Polygon') return [feature.geometry.coordinates];
  return feature.geometry.coordinates;
}

export interface AnalysisBuildingsResult {
  buildings: Building[];
  /** 높이 미상(0)이라 일조 계산에서 제외한 건물 수. 추정으로 채우지 않는다. */
  excludedUnknownHeight: number;
}

/**
 * 서울 건물 피처를 일조 계산용 Building[]으로 바꾼다.
 * 높이가 0(미상)인 건물은 **추정하지 않고 계산에서 제외**하며 그 수를 돌려준다.
 */
export function toAnalysisBuildings(
  features: SeoulBuildingFeature[],
  origin: EnuOrigin,
  ground?: GroundGrid,
): AnalysisBuildingsResult {
  const buildings: Building[] = [];
  let excludedUnknownHeight = 0;

  for (const feature of features) {
    const { height, heightSource, id } = feature.properties;
    if (!(height > 0)) {
      excludedUnknownHeight += 1;
      continue;
    }
    const polygons = polygonsOf(feature);
    polygons.forEach((poly, pi) => {
      const outer = poly[0];
      if (!outer || outer.length < 3) return;
      const metrics = ringToEnu(outer, origin);
      // One planar foundation per prism. Use footprint vertex mean consistently
      // for both rendering and analysis; this is an estimated foundation, not surveyed.
      const heights = metrics.lngLat.slice(0, -1).map(([lon, lat]) => ground ? groundAt(ground, lon, lat) : 0);
      const baseZ = heights.reduce((sum, h) => sum+h, 0)/heights.length;
      if (!Number.isFinite(baseZ)) throw new Error('건물 위치의 추정 지면 고도가 없습니다.');
      const holes =
        poly.length > 1 ? poly.slice(1).map((h) => ringToEnu(h, origin).ring) : undefined;
      buildings.push({
        id: polygons.length > 1 ? `${id}-${pi}` : id,
        ring: metrics.ring,
        holes,
        baseZ,
        height,
        heightSource: heightSource === 'measured' ? 'measured' : 'estimated',
        minX: metrics.minX,
        minY: metrics.minY,
        maxX: metrics.maxX,
        maxY: metrics.maxY,
        lngLatPolygon: [metrics.lngLat, ...poly.slice(1).map((h) => closeRing(h))]
          .map((ring) => ring.map(([lon, lat]) => [lon, lat, baseZ])),
      });
    });
  }

  return { buildings, excludedUnknownHeight };
}

/** 표시용 GeoJSON. 원천 속성을 그대로 유지해 상세 조회에서 원천값을 보여준다. */
export function toFeatureCollection<T extends { type: 'Feature' }>(features: T[]) {
  return { type: 'FeatureCollection' as const, features };
}
