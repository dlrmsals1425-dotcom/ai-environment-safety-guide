export type HeightSource = 'measured' | 'estimated' | 'synthetic';

/** 명세 §3 건물 모델. 기하 계산은 ENU(m). 렌더는 WGS84 폴리곤을 별도 보관. */
export interface Building {
  id: string;
  ring: Float64Array;
  holes?: Float64Array[];
  baseZ: number;
  height: number;
  heightSource: HeightSource;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  lngLatPolygon: number[][][];
}

export interface BuildingMeta {
  source: string;
  synthetic: boolean;
  downloadedAt: string | null;
  featureCount: number;
  aoiBboxWgs84?: number[];
  warning?: string;
  heightMeasuredRatio?: number;
  bufferMeters?: number;
}

export interface BuildingSource {
  type: 'geojson' | 'flatgeobuf';
  url: string;
  metaUrl?: string;
}

export interface BuildingSourceConfig {
  buildings: BuildingSource;
  /** 있으면 이 파일을 먼저 쓰고, 없을 때만 buildings(데모)로 폴백. */
  buildingsRealCandidates?: BuildingSource[];
}

export interface LoadBuildingsResult {
  buildings: Building[];
  meta: BuildingMeta;
}
