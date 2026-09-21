import type { Map as MapLibreMap } from 'maplibre-gl';
import type {
  SeoulBuildingFeature,
  SeoulTreeFeature,
  SnowBaseFeature,
} from '@/types/seoul';

export const BUILDING_SOURCE = 'seoul-buildings';
export const TREE_SOURCE = 'seoul-trees';
export const BUILDING_FILL_LAYER = 'seoul-building-fill';
export const BUILDING_LINE_LAYER = 'seoul-building-line';
export const TREE_CIRCLE_LAYER = 'seoul-tree-circle';
export const SNOW_SOURCE = 'seoul-snow-bases';
export const SNOW_CIRCLE_LAYER = 'seoul-snow-base-circle';

export const PICKABLE_LAYERS = [
  'seonje-risk-points',
  'seoul-snow-boxes',
  SNOW_CIRCLE_LAYER,
  TREE_CIRCLE_LAYER,
  BUILDING_FILL_LAYER,
] as const;

const EMPTY = { type: 'FeatureCollection' as const, features: [] as unknown[] };

/** 높이 출처별 색. unknown은 회색으로 두어 "높이 미상"이 눈에 보이게 한다. */
export function buildingFillLayerSpec() {
  return {
    id: BUILDING_FILL_LAYER,
    type: 'fill' as const,
    source: BUILDING_SOURCE,
    paint: {
      'fill-color': [
        'match',
        ['get', 'heightSource'],
        'measured',
        '#8fa6bd',
        'estimated',
        '#c9a25a',
        '#6d737a',
      ],
      'fill-opacity': 0.55,
    },
  };
}

export function buildingLineLayerSpec() {
  return {
    id: BUILDING_LINE_LAYER,
    type: 'line' as const,
    source: BUILDING_SOURCE,
    paint: {
      'line-color': '#2b3238',
      'line-width': 0.6,
      'line-opacity': 0.8,
    },
  };
}

/** 수목은 점 표시만 한다. 수관 크기를 그대로 그리면 검증되지 않은 차폐로 오해된다. */
export function treeCircleLayerSpec() {
  return {
    id: TREE_CIRCLE_LAYER,
    type: 'circle' as const,
    source: TREE_SOURCE,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 1.5, 15, 3, 18, 5],
      'circle-color': [
        'match',
        ['get', 'quality'],
        'valid',
        '#4f9a5e',
        '#9a7f4f',
      ],
      'circle-opacity': 0.85,
      'circle-stroke-width': 0.4,
      'circle-stroke-color': '#1c2226',
    },
  };
}

/** 제설전진기지는 시설 위치 참고 표시다. 눈·결빙 위험을 뜻하지 않는다. */
export function snowBaseLayerSpec() {
  return {
    id: SNOW_CIRCLE_LAYER,
    type: 'circle' as const,
    source: SNOW_SOURCE,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 14, 6, 18, 9],
      'circle-color': [
        'match',
        ['get', 'kind'],
        '전진',
        '#4f86c6',
        '발진',
        '#7f6ac6',
        '이동식',
        '#d39543',
        '#708390',
      ],
      'circle-opacity': 0.9,
      'circle-stroke-width': 1.2,
      'circle-stroke-color': '#e7eef5',
    },
  };
}

function setVisibility(map: MapLibreMap, layerId: string, visible: boolean): void {
  if (!map.getLayer(layerId)) return;
  map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
}

/**
 * 서울 건물 윤곽·수목 점을 MapLibre 네이티브 레이어로 유지한다.
 * 지형 보기에서 지형 위에 그대로 씌워지며(drape), 두 모드 모두에서 클릭 조회가 된다.
 */
export function syncSeoulLayers(
  map: MapLibreMap,
  input: {
    buildings: SeoulBuildingFeature[];
    trees: SeoulTreeFeature[];
    snowBases: SnowBaseFeature[];
    buildingsVisible: boolean;
    treesVisible: boolean;
    snowBasesVisible: boolean;
  },
): void {
  if (!map.getSource(BUILDING_SOURCE)) {
    map.addSource(BUILDING_SOURCE, { type: 'geojson', data: EMPTY as never });
    map.addLayer(buildingFillLayerSpec() as never);
    map.addLayer(buildingLineLayerSpec() as never);
  }
  if (!map.getSource(TREE_SOURCE)) {
    map.addSource(TREE_SOURCE, { type: 'geojson', data: EMPTY as never });
    map.addLayer(treeCircleLayerSpec() as never);
  }

  const buildingSource = map.getSource(BUILDING_SOURCE) as {
    setData?: (d: unknown) => void;
  };
  buildingSource.setData?.({
    type: 'FeatureCollection',
    features: input.buildings,
  });

  if (!map.getSource(SNOW_SOURCE)) {
    map.addSource(SNOW_SOURCE, { type: 'geojson', data: EMPTY as never });
    map.addLayer(snowBaseLayerSpec() as never);
  }

  const treeSource = map.getSource(TREE_SOURCE) as { setData?: (d: unknown) => void };
  treeSource.setData?.({ type: 'FeatureCollection', features: input.trees });

  const snowSource = map.getSource(SNOW_SOURCE) as { setData?: (d: unknown) => void };
  snowSource.setData?.({ type: 'FeatureCollection', features: input.snowBases });

  setVisibility(map, BUILDING_FILL_LAYER, input.buildingsVisible);
  setVisibility(map, BUILDING_LINE_LAYER, input.buildingsVisible);
  setVisibility(map, TREE_CIRCLE_LAYER, input.treesVisible);
  setVisibility(map, SNOW_CIRCLE_LAYER, input.snowBasesVisible);
}

export interface PickedFeature {
  kind: 'building' | 'tree' | 'snowBase' | 'snowBox' | 'risk';
  props: Record<string, unknown>;
}

/** 클릭 지점에서 수목을 건물보다 먼저 집는다(점이 더 작아 놓치기 쉬움). */
export function pickFeature(
  features: { layer?: { id?: string }; properties?: Record<string, unknown> | null }[],
): PickedFeature | null {
  const risk = features.find(f=>f.layer?.id==='seonje-risk-points');
  if (risk) return {kind:'risk',props:risk.properties ?? {}};
  const box=features.find(f=>f.layer?.id==='seoul-snow-boxes');
  if(box) return {kind:'snowBox',props:box.properties ?? {}};
  const snow = features.find((f) => f.layer?.id === SNOW_CIRCLE_LAYER);
  if (snow) return { kind: 'snowBase', props: snow.properties ?? {} };
  const tree = features.find((f) => f.layer?.id === TREE_CIRCLE_LAYER);
  if (tree) return { kind: 'tree', props: tree.properties ?? {} };
  const building = features.find((f) => f.layer?.id === BUILDING_FILL_LAYER);
  if (building) return { kind: 'building', props: building.properties ?? {} };
  return null;
}
