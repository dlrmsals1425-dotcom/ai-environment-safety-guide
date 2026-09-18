/** AOI 중심을 원점으로 하는 ENU 로컬 평면 (미터). 명세 §1.1 */

export type EnuOrigin = {
  lat0: number;
  lon0: number;
};

/** 위도별 미터/도 환산 계수 (Vincenty 근사 다항식). */
export function metersPerDegree(lat0Deg: number): {
  mPerDegLat: number;
  mPerDegLon: number;
} {
  const φ = (lat0Deg * Math.PI) / 180;
  const mPerDegLat = 111132.92 - 559.82 * Math.cos(2 * φ) + 1.175 * Math.cos(4 * φ);
  const mPerDegLon = 111412.84 * Math.cos(φ) - 93.5 * Math.cos(3 * φ);
  return { mPerDegLat, mPerDegLon };
}

/** WGS84 → ENU (x=동 m, y=북 m) */
export function toEnu(
  lon: number,
  lat: number,
  origin: EnuOrigin,
): { x: number; y: number } {
  const { mPerDegLat, mPerDegLon } = metersPerDegree(origin.lat0);
  return {
    x: (lon - origin.lon0) * mPerDegLon,
    y: (lat - origin.lat0) * mPerDegLat,
  };
}

/** ENU → WGS84 */
export function fromEnu(
  x: number,
  y: number,
  origin: EnuOrigin,
): { lon: number; lat: number } {
  const { mPerDegLat, mPerDegLon } = metersPerDegree(origin.lat0);
  return {
    lon: origin.lon0 + x / mPerDegLon,
    lat: origin.lat0 + y / mPerDegLat,
  };
}
