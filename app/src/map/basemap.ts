import type { BasemapId } from '@/types/seoul';

export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';
export const BASEMAP_LAYER_ID = 'basemap';
export const BACKGROUND_LAYER_ID = 'empty-background';

/**
 * 배경지도는 공개 OSM 타일 하나뿐이라 스타일을 통째로 갈아끼우지 않는다.
 * 배경 없음은 OSM 레이어의 visibility만 끈다(스타일 재로딩으로 소스·지형·deck가
 * 떨어져 나가는 문제를 피한다).
 * 유료 키가 필요한 서비스(VWorld·Naver·Google)는 이 프로토타입에서 호출하지 않는다.
 */
export function createBasemapStyle(basemap: BasemapId = 'osm') {
  return {
    style: {
      version: 8 as const,
      sources: {
        basemap: {
          type: 'raster',
          tiles: [OSM_TILE_URL],
          tileSize: 256,
          attribution: OSM_ATTRIBUTION,
          maxzoom: 19,
        },
      } as Record<string, unknown>,
      layers: [
        {
          id: BACKGROUND_LAYER_ID,
          type: 'background' as const,
          paint: { 'background-color': '#11161b' },
        },
        {
          id: BASEMAP_LAYER_ID,
          type: 'raster' as const,
          source: 'basemap',
          layout: { visibility: basemap === 'none' ? ('none' as const) : ('visible' as const) },
        },
      ],
    },
  };
}
