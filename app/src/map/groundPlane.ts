import mapConfig from '../../config/map.json';
import analysisConfig from '../../config/analysis.json';
import { fromEnu, type EnuOrigin } from '@/geo/enu';

export function groundLngLatRing(
  origin: EnuOrigin | null,
  sizeM = analysisConfig.groundPlaneM,
): number[][] {
  const o = origin ?? {
    lat0: mapConfig.initialView.lat,
    lon0: mapConfig.initialView.lon,
  };
  const h = sizeM / 2;
  const sw = fromEnu(-h, -h, o);
  const se = fromEnu(h, -h, o);
  const ne = fromEnu(h, h, o);
  const nw = fromEnu(-h, h, o);
  return [
    [sw.lon, sw.lat],
    [se.lon, se.lat],
    [ne.lon, ne.lat],
    [nw.lon, nw.lat],
    [sw.lon, sw.lat],
  ];
}
