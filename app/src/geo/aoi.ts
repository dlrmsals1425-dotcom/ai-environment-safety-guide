import aoiConfig from '../../config/aoi.json';
import { fromEnu, toEnu, type EnuOrigin } from '@/geo/enu';

export type BBox = [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]

export const DEFAULT_AOI_SIZE_M = aoiConfig.defaultSizeM;
export const MAX_AOI_SIZE_M = aoiConfig.maxSizeM;

export function normalizeBbox(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): BBox {
  return [
    Math.min(lon1, lon2),
    Math.min(lat1, lat2),
    Math.max(lon1, lon2),
    Math.max(lat1, lat2),
  ];
}

export function bboxCenter(bbox: BBox): EnuOrigin {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return {
    lon0: (minLon + maxLon) / 2,
    lat0: (minLat + maxLat) / 2,
  };
}

export function bboxSizeMeters(bbox: BBox): { width: number; height: number } {
  const origin = bboxCenter(bbox);
  const sw = toEnu(bbox[0], bbox[1], origin);
  const ne = toEnu(bbox[2], bbox[3], origin);
  return { width: ne.x - sw.x, height: ne.y - sw.y };
}

/** origin 중심의 sizeM × sizeM 사각형 bbox. */
export function squareBboxAround(origin: EnuOrigin, sizeM: number): BBox {
  const half = sizeM / 2;
  const sw = fromEnu(-half, -half, origin);
  const ne = fromEnu(half, half, origin);
  return [sw.lon, sw.lat, ne.lon, ne.lat];
}

export function isAoiOversized(bbox: BBox): boolean {
  const { width, height } = bboxSizeMeters(bbox);
  // ENU 왕복 부동소수점 오차(≪ 1mm)가 1500.0000002 처럼 나오는 것을 허용
  return width > MAX_AOI_SIZE_M + 0.01 || height > MAX_AOI_SIZE_M + 0.01;
}

/** AOI를 미터 버퍼로 확장. 경계 밖 건물 그림자가 들어오도록 한다. */
export function bufferBboxMeters(bbox: BBox, bufferM: number): BBox {
  const origin = bboxCenter(bbox);
  const sw = toEnu(bbox[0], bbox[1], origin);
  const ne = toEnu(bbox[2], bbox[3], origin);
  const sw2 = fromEnu(sw.x - bufferM, sw.y - bufferM, origin);
  const ne2 = fromEnu(ne.x + bufferM, ne.y + bufferM, origin);
  return [sw2.lon, sw2.lat, ne2.lon, ne2.lat];
}

export function bboxIntersects(a: BBox, b: BBox): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}
