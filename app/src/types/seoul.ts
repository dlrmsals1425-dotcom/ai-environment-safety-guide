import type { BBox } from '@/geo/aoi';

/** GPT가 준비하는 app/public/data/seoul/** 데이터 계약(version 1). 앱은 이 형식만 읽는다. */

export interface TileEntry {
  id: string;
  url: string;
  /** [w, s, e, n] WGS84 */
  bbox: BBox;
  featureCount: number;
}

export interface TileIndex {
  coverageAreas?: BBox[];
  version: number;
  kind: string | null;
  metaUrl: string | null;
  featureCount: number | null;
  /** 데이터가 실제로 존재하는 범위. 화면이 벗어나면 "범위 밖"으로 안내한다. */
  bounds: BBox | null;
  tiles: TileEntry[];
}

export interface HeightCounts {
  measured: number;
  estimated: number;
  unknown: number;
}

/** index.json의 metaUrl이 가리키는 meta.json. */
export interface DatasetMeta {
  source: string | null;
  synthetic: boolean;
  featureCount: number | null;
  tileCount: number | null;
  downloadedAt: string | null;
  dataDate: string | null;
  warning: string | null;
  preparationCounts: Record<string, number> | null;
  /** 건물 전용 */
  heightMeasuredRatio?: number;
  heightCounts?: HeightCounts;
}

export type SeoulHeightSource = 'measured' | 'estimated' | 'unknown';

export interface SeoulBuildingProps {
  id: string;
  sourceId: string | null;
  pnu: string | null;
  name: string | null;
  address: string | null;
  useName: string | null;
  floors: number | null;
  /** m. 준비 단계에서 정제된 값. unknown이면 0이며 앱에서 재추정하지 않는다. */
  height: number;
  heightSource: SeoulHeightSource;
  /** 원천 그대로의 높이 값(정제 전). 상세 조회에서 보여준다. */
  heightRaw: number | null;
  sourceDate: string | null;
}

export interface SeoulBuildingFeature {
  type: 'Feature';
  properties: SeoulBuildingProps;
  geometry:
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] };
}

export type TreeDataset = 'street' | 'park-private' | 'protected';

export type TreeQuality = 'valid' | 'review';

export interface SeoulTreeProps {
  id: string;
  dataset: TreeDataset | string;
  gu: string | null;
  species: string | null;
  /** 범위 밖이면 null. 앱에서 보정하지 않는다. */
  heightM: number | null;
  crownWidthM: number | null;
  rawHeight: number | null;
  rawCrownWidth: number | null;
  /** valid는 범위 검사 통과일 뿐 현장 확인이 아니다. */
  quality: TreeQuality;
  sourceYear: number;
}

export interface SeoulTreeFeature {
  type: 'Feature';
  properties: SeoulTreeProps;
  geometry: { type: 'Point'; coordinates: number[] };
}

export type DatasetStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'missing';

export interface DatasetState<T> {
  status: DatasetStatus;
  features: T[];
  index: TileIndex | null;
  meta: DatasetMeta | null;
  tileIds: string[];
  /** status==='error'일 때만 채운다. 자료 없음(empty/missing)과 구분한다. */
  error: string | null;
  /** 표시 상한으로 잘렸는지(수목 전용). 건물은 자르지 않는다. */
  capped: boolean;
  /** 화면에 걸친 타일이 상한을 넘어 일부만 읽었는지. 분석을 막는 조건이다. */
  tilesTruncated: boolean;
  /** 기하 불량으로 건너뛴 피처 수. */
  skipped: number;
  loadedAt: string | null;
}

export function emptyDatasetState<T>(): DatasetState<T> {
  return {
    status: 'idle',
    features: [],
    index: null,
    meta: null,
    tileIds: [],
    error: null,
    capped: false,
    tilesTruncated: false,
    skipped: 0,
    loadedAt: null,
  };
}

/** 제설전진기지: 시설 위치 참고 자료이며 눈·기상 위험 자료가 아니다. */
export interface SnowBaseProps {
  id: string;
  agency: string | null;
  baseId: string | null;
  kind: string | null;
  location: string | null;
  coordinateStatus: string | null;
}

export interface SnowBaseFeature {
  type: 'Feature';
  properties: SnowBaseProps;
  geometry: { type: 'Point'; coordinates: number[] };
}

export interface SnowBaseMeta {
  source: string | null;
  totalRows: number | null;
  mappedRows: number | null;
  unmappedRows: number | null;
  warning: string | null;
}

export type TerrainStatus = 'idle' | 'checking' | 'ready' | 'missing' | 'error';

/** /data/seoul/terrain/meta.json */
export interface TerrainMeta {
  tiles: string[];
  bounds: BBox;
  minzoom: number;
  maxzoom: number;
  tileSize: number;
  encoding: 'mapbox' | 'terrarium';
  exaggeration: number;
  nominalResolutionM: number | null;
  attribution: string | null;
}

export interface SeoulPreset {
  id: string;
  label: string;
  lat: number;
  lon: number;
  zoom: number;
}


export type BasemapId = 'osm' | 'none';

export interface SelectedFeature {
  kind: 'building' | 'tree' | 'snowBase' | 'risk';
  props: Record<string, unknown>;
  lngLat: { lng: number; lat: number };
}
