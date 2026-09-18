import { create } from 'zustand';
import type { GroundGrid } from '@/data/ground';
import mapConfig from '../../config/map.json';
import {
  bboxCenter,
  bboxSizeMeters,
  isAoiOversized,
  squareBboxAround,
  MAX_AOI_SIZE_M,
  DEFAULT_AOI_SIZE_M,
  type BBox,
} from '@/geo/aoi';
import type { EnuOrigin } from '@/geo/enu';
import { applyDatePreset, type DatePreset } from '@/lib/datePresets';
import { clampTimeMinutes } from '@/lib/time';
import type { GridSpec } from '@/analysis/grid';
import { terminateSunHoursPool } from '@/analysis/pool';
import type { SunHoursRunMeta } from '@/analysis/pool';
import type { Building, BuildingMeta, LoadBuildingsResult } from '@/types/building';
import { defaultGeocodeQuery } from '@/data/geocodeQuery';
import type {
  CctvLiveChosen,
  CctvLiveStatus,
  CctvMeta,
  CctvSite,
  GeocodeCandidate,
} from '@/types/facility';
import { DEFAULT_LAYERS, type LayerId } from '@/types/layers';
import seoulConfig from '../../config/seoul.json';
import {
  emptyDatasetState,
  type BasemapId,
  type DatasetState,
  type SeoulBuildingFeature,
  type SeoulPreset,
  type SeoulTreeFeature,
  type SelectedFeature,
  type SnowBaseFeature,
  type SnowBaseMeta,
  type TerrainMeta,
  type TerrainStatus,
} from '@/types/seoul';

export type { DatePreset, LayerId };

export const SEOUL_PRESETS = seoulConfig.presets as SeoulPreset[];

function startOfLocalDay(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export interface AppState {
  ground: GroundGrid | null;
  groundError: string | null;
  aoi: { bbox: BBox } | null;
  date: Date;
  timeMinutes: number;
  layers: Record<LayerId, boolean>;
  origin: EnuOrigin | null;
  viewCenter: { lat: number; lon: number };
  aoiDrawMode: boolean;
  aoiWarning: string | null;
  buildings: Building[];
  buildingMeta: BuildingMeta | null;
  dataIsSynthetic: boolean;
  buildingLoadSeq: number;
  sunHours: Float32Array | null;
  sunHoursSpec: GridSpec | null;
  sunHoursProgress: number;
  sunHoursRunning: boolean;
  sunHoursError: string | null;
  sunHoursSeq: number;
  sunHoursMeta: SunHoursRunMeta | null;
  cctvSites: CctvSite[];
  cctvMeta: CctvMeta | null;
  cctvVisible: boolean;
  cctvShowRemoved: boolean;
  cctvQuery: string;
  cctvSelectedId: string | null;
  cctvLiveQuery: string;
  cctvLiveStatus: CctvLiveStatus;
  cctvLiveError: string | null;
  cctvLiveCandidates: GeocodeCandidate[];
  cctvLiveChosen: CctvLiveChosen | null;
  cctvLiveRequestId: number;
  viewAround: { lng: number; lat: number; seq: number } | null;
  /** 서울 프로토타입 상태 */
  basemap: BasemapId;
  presetId: string | null;
  seoulBuildings: DatasetState<SeoulBuildingFeature>;
  seoulTrees: DatasetState<SeoulTreeFeature>;
  snowBases: DatasetState<SnowBaseFeature>;
  snowBaseMeta: SnowBaseMeta | null;
  snowBaseKind: string | null;
  snowBaseQuery: string;
  buildingsUnknownHeight: number;
  terrainStatus: TerrainStatus;
  terrainMeta: TerrainMeta | null;
  terrainError: string | null;
  selectedFeature: SelectedFeature | null;
  seoulBuildingSeq: number;
  seoulTreeSeq: number;
  setBasemap: (id: BasemapId) => void;
  applyPreset: (presetId: string) => boolean;
  beginSeoulBuildingLoad: () => number;
  applySeoulBuildings: (
    seq: number,
    state: DatasetState<SeoulBuildingFeature>,
    unknownHeight: number,
    buildings: Building[],
  ) => boolean;
  setSnowBases: (state: DatasetState<SnowBaseFeature>, meta: SnowBaseMeta | null) => void;
  setSnowBaseKind: (kind: string | null) => void;
  setSnowBaseQuery: (q: string) => void;
  beginSeoulTreeLoad: () => number;
  applySeoulTrees: (seq: number, state: DatasetState<SeoulTreeFeature>) => boolean;
  setTerrain: (
    status: TerrainStatus,
    meta: TerrainMeta | null,
    error?: string | null,
  ) => void;
  selectFeature: (feature: SelectedFeature | null) => void;
  /** AOI를 바꾸지 않고 화면만 이동한다(목록에서 이동할 때 사용). */
  flyTo: (lng: number, lat: number) => void;
  setTimeMinutes: (minutes: number) => void;
  setDatePreset: (preset: DatePreset) => void;
  setLayerVisible: (id: LayerId, visible: boolean) => void;
  setViewCenter: (center: { lat: number; lon: number }) => void;
  setAoiDrawMode: (on: boolean) => void;
  confirmAoi: (bbox: BBox) => boolean;
  placeDefaultAoi: () => boolean;
  clearAoi: () => void;
  beginBuildingLoad: () => number;
  applyBuildingLoad: (seq: number, result: LoadBuildingsResult) => boolean;
  setSunHoursProgress: (ratio: number) => void;
  setSunHoursResult: (hours: Float32Array, spec: GridSpec) => void;
  setSunHoursError: (message: string | null) => void;
  setSunHoursRunning: (on: boolean) => void;
  clearSunHours: () => void;
  invalidateSunHours: () => number;
  beginSunHoursLoad: () => number;
  applySunHoursProgress: (seq: number, ratio: number) => boolean;
  applySunHoursResult: (
    seq: number,
    hours: Float32Array,
    spec: GridSpec,
    meta: SunHoursRunMeta,
  ) => boolean;
  applySunHoursError: (seq: number, message: string | null) => boolean;
  setCctvSites: (sites: CctvSite[], meta: CctvMeta) => void;
  setCctvVisible: (on: boolean) => void;
  setCctvShowRemoved: (on: boolean) => void;
  setCctvQuery: (q: string) => void;
  selectCctv: (id: string | null) => void;
  setCctvLiveQuery: (q: string) => void;
  beginCctvLiveLookup: () => number;
  applyCctvLiveResult: (requestId: number, candidates: GeocodeCandidate[]) => boolean;
  applyCctvLiveError: (requestId: number, message: string) => boolean;
  chooseCctvLiveCandidate: (candidate: GeocodeCandidate) => boolean;
  requestViewAround: (lng: number, lat: number) => boolean;
}

export const useAppStore = create<AppState>((set, get) => ({
  ground: null,
  groundError: null,
  aoi: null,
  date: startOfLocalDay(),
  timeMinutes: 720,
  layers: { ...DEFAULT_LAYERS },
  origin: null,
  viewCenter: {
    lat: mapConfig.initialView.lat,
    lon: mapConfig.initialView.lon,
  },
  aoiDrawMode: false,
  aoiWarning: null,
  buildings: [],
  buildingMeta: null,
  dataIsSynthetic: false,
  buildingLoadSeq: 0,
  sunHours: null,
  sunHoursSpec: null,
  sunHoursProgress: 0,
  sunHoursRunning: false,
  sunHoursError: null,
  sunHoursSeq: 0,
  sunHoursMeta: null,
  cctvSites: [],
  cctvMeta: null,
  cctvVisible: true,
  cctvShowRemoved: false,
  cctvQuery: '',
  cctvSelectedId: null,
  cctvLiveQuery: '',
  cctvLiveStatus: 'idle',
  cctvLiveError: null,
  cctvLiveCandidates: [],
  cctvLiveChosen: null,
  cctvLiveRequestId: 0,
  viewAround: null,

  basemap: 'osm',
  presetId: null,
  seoulBuildings: emptyDatasetState<SeoulBuildingFeature>(),
  seoulTrees: emptyDatasetState<SeoulTreeFeature>(),
  snowBases: emptyDatasetState<SnowBaseFeature>(),
  snowBaseMeta: null,
  snowBaseKind: null,
  snowBaseQuery: '',
  buildingsUnknownHeight: 0,
  terrainStatus: 'idle',
  terrainMeta: null,
  terrainError: null,
  selectedFeature: null,
  seoulBuildingSeq: 0,
  seoulTreeSeq: 0,

  setBasemap: (id) => set({ basemap: id }),

  applyPreset: (presetId) => {
    const preset = SEOUL_PRESETS.find((p) => p.id === presetId);
    if (!preset) return false;
    set({ presetId, viewCenter: { lat: preset.lat, lon: preset.lon } });
    get().requestViewAround(preset.lon, preset.lat);
    return true;
  },

  beginSeoulBuildingLoad: () => {
    const next = get().seoulBuildingSeq + 1;
    set({
      seoulBuildingSeq: next,
      seoulBuildings: { ...get().seoulBuildings, status: 'loading', error: null },
    });
    return next;
  },

  applySeoulBuildings: (seq, state, unknownHeight, buildings) => {
    if (seq !== get().seoulBuildingSeq) return false;
    get().invalidateSunHours();
    set({
      seoulBuildings: state,
      buildingsUnknownHeight: unknownHeight,
      buildings,
      buildingMeta: {
        source: state.meta?.source ?? '서울 건물(준비 데이터)',
        synthetic: state.meta?.synthetic === true,
        downloadedAt: state.meta?.dataDate ?? state.meta?.downloadedAt ?? null,
        featureCount: state.features.length,
        heightMeasuredRatio: state.meta?.heightMeasuredRatio,
      },
      dataIsSynthetic: state.meta?.synthetic === true,
    });
    return true;
  },

  setSnowBases: (state, meta) => set({ snowBases: state, snowBaseMeta: meta }),
  setSnowBaseKind: (kind) => set({ snowBaseKind: kind }),
  setSnowBaseQuery: (q) => set({ snowBaseQuery: q }),

  beginSeoulTreeLoad: () => {
    const next = get().seoulTreeSeq + 1;
    set({
      seoulTreeSeq: next,
      seoulTrees: { ...get().seoulTrees, status: 'loading', error: null },
    });
    return next;
  },

  applySeoulTrees: (seq, state) => {
    if (seq !== get().seoulTreeSeq) return false;
    set({ seoulTrees: state });
    return true;
  },

  setTerrain: (status, meta, error = null) =>
    set({ terrainStatus: status, terrainMeta: meta, terrainError: error }),

  selectFeature: (feature) => set({ selectedFeature: feature }),

  flyTo: (lng, lat) =>
    set({ viewAround: { lng, lat, seq: (get().viewAround?.seq ?? 0) + 1 } }),

  setTimeMinutes: (minutes) => set({
    timeMinutes: clampTimeMinutes(minutes),
    // Moving the time control means inspecting this instant, not the daily sum.
    // Keep the calculated hours available, but never leave a checked shadow hidden.
    layers: { ...get().layers, realtimeShadow: true, sunHours: false },
  }),

  setDatePreset: (preset) => {
    get().invalidateSunHours();
    set({ date: applyDatePreset(get().date, preset),
      layers: { ...get().layers, realtimeShadow: true, sunHours: false } });
  },

  setLayerVisible: (id, visible) => {
    const layers = { ...get().layers, [id]: visible };
    if (id === 'sunHours') layers.realtimeShadow = !visible;
    if (id === 'realtimeShadow' && visible) layers.sunHours = false;
    set({ layers });
  },

  setViewCenter: (center) => set({ viewCenter: center }),

  setAoiDrawMode: (on) =>
    set({ aoiDrawMode: on, aoiWarning: on ? null : get().aoiWarning }),

  confirmAoi: (bbox) => {
    if (isAoiOversized(bbox)) {
      const { width, height } = bboxSizeMeters(bbox);
      set({
        aoiWarning: `관심구역이 최대 크기(${MAX_AOI_SIZE_M}m × ${MAX_AOI_SIZE_M}m)를 초과합니다. (${Math.round(width)}m × ${Math.round(height)}m)`,
      });
      return false;
    }
    const origin = bboxCenter(bbox);
    get().invalidateSunHours();
    set({
      aoi: { bbox },
      origin,
      aoiWarning: null,
      aoiDrawMode: false,
    });
    return true;
  },

  placeDefaultAoi: () => {
    const { viewCenter, confirmAoi } = get();
    const bbox = squareBboxAround(
      { lat0: viewCenter.lat, lon0: viewCenter.lon },
      DEFAULT_AOI_SIZE_M,
    );
    return confirmAoi(bbox);
  },

  clearAoi: () => {
    get().invalidateSunHours();
    set({ aoi: null, origin: null, aoiWarning: null });
  },

  beginBuildingLoad: () => {
    const next = get().buildingLoadSeq + 1;
    set({ buildingLoadSeq: next });
    return next;
  },

  applyBuildingLoad: (seq, result) => {
    if (seq !== get().buildingLoadSeq) return false;
    get().invalidateSunHours();
    set({
      buildings: result.buildings,
      buildingMeta: result.meta,
      dataIsSynthetic: result.meta.synthetic === true,
    });
    return true;
  },

  setSunHoursProgress: (ratio) => set({ sunHoursProgress: ratio }),
  setSunHoursResult: (hours, spec) =>
    get().applySunHoursResult(get().sunHoursSeq, hours, spec, {
      elapsedMs: 0,
      workerCount: 0,
      timeSteps: 0,
      cellSize: spec.cellSize,
      stepMinutes: 0,
      z0: 0,
      minAltDeg: 0,
      nx: spec.nx,
      ny: spec.ny,
      buildingCount: 0,
      aoiWidthM: 0,
      aoiHeightM: 0,
    }),
  setSunHoursError: (message) =>
    get().applySunHoursError(get().sunHoursSeq, message),
  setSunHoursRunning: (on) =>
    set({
      sunHoursRunning: on,
      sunHoursError: on ? null : get().sunHoursError,
      sunHoursProgress: on ? 0 : get().sunHoursProgress,
    }),
  clearSunHours: () => {
    get().invalidateSunHours();
  },
  invalidateSunHours: () => {
    terminateSunHoursPool();
    const next = get().sunHoursSeq + 1;
    set({
      sunHoursSeq: next,
      sunHours: null,
      sunHoursSpec: null,
      sunHoursMeta: null,
      sunHoursProgress: 0,
      sunHoursRunning: false,
      sunHoursError: null,
      layers: { ...get().layers, sunHours: false },
    });
    return next;
  },
  beginSunHoursLoad: () => {
    terminateSunHoursPool();
    const next = get().sunHoursSeq + 1;
    set({
      sunHoursSeq: next,
      sunHours: null,
      sunHoursSpec: null,
      sunHoursMeta: null,
      sunHoursProgress: 0,
      sunHoursRunning: true,
      sunHoursError: null,
    });
    return next;
  },
  applySunHoursProgress: (seq, ratio) => {
    if (seq !== get().sunHoursSeq) return false;
    set({ sunHoursProgress: ratio });
    return true;
  },
  applySunHoursResult: (seq, hours, spec, meta) => {
    if (seq !== get().sunHoursSeq) return false;
    set({
      sunHours: hours,
      sunHoursSpec: spec,
      sunHoursMeta: meta,
      sunHoursRunning: false,
      sunHoursProgress: 1,
      sunHoursError: null,
      layers: { ...get().layers, sunHours: true, realtimeShadow: false },
    });
    return true;
  },
  applySunHoursError: (seq, message) => {
    if (seq !== get().sunHoursSeq) return false;
    set({ sunHoursError: message, sunHoursRunning: false });
    return true;
  },
  setCctvSites: (sites, meta) => set({ cctvSites: sites, cctvMeta: meta }),
  setCctvVisible: (on) => set({ cctvVisible: on }),
  setCctvShowRemoved: (on) => set({ cctvShowRemoved: on }),
  setCctvQuery: (q) => set({ cctvQuery: q }),
  selectCctv: (id) => {
    if (id === get().cctvSelectedId) {
      set({ cctvSelectedId: id });
      return;
    }
    const site = id ? get().cctvSites.find((s) => s.stableId === id) : null;
    set({
      cctvSelectedId: id,
      cctvLiveQuery: site ? defaultGeocodeQuery(site.placeText, site.matchNote) : '',
      cctvLiveStatus: 'idle',
      cctvLiveError: null,
      cctvLiveCandidates: [],
      cctvLiveChosen: null,
      cctvLiveRequestId: get().cctvLiveRequestId + 1,
    });
  },
  setCctvLiveQuery: (q) => {
    const cur = get().cctvLiveQuery;
    if (q === cur) return;
    set({
      cctvLiveQuery: q,
      cctvLiveStatus: 'idle',
      cctvLiveError: null,
      cctvLiveCandidates: [],
      cctvLiveChosen: null,
      cctvLiveRequestId: get().cctvLiveRequestId + 1,
    });
  },
  beginCctvLiveLookup: () => {
    const next = get().cctvLiveRequestId + 1;
    set({
      cctvLiveRequestId: next,
      cctvLiveStatus: 'loading',
      cctvLiveError: null,
      cctvLiveCandidates: [],
      cctvLiveChosen: null,
    });
    return next;
  },
  applyCctvLiveResult: (requestId, candidates) => {
    if (requestId !== get().cctvLiveRequestId) return false;
    set({
      cctvLiveStatus: 'results',
      cctvLiveError: null,
      cctvLiveCandidates: candidates.slice(0, 5),
    });
    return true;
  },
  applyCctvLiveError: (requestId, message) => {
    if (requestId !== get().cctvLiveRequestId) return false;
    set({
      cctvLiveStatus: 'error',
      cctvLiveError: message,
      cctvLiveCandidates: [],
    });
    return true;
  },
  chooseCctvLiveCandidate: (candidate) => {
    const id = get().cctvSelectedId;
    if (!id || !candidate.inDeogyang) return false;
    set({
      cctvLiveChosen: {
        siteId: id,
        lng: candidate.lng,
        lat: candidate.lat,
        label: candidate.roadAddress || candidate.jibunAddress,
      },
    });
    return true;
  },
  requestViewAround: (lng, lat) => {
    const bbox = squareBboxAround({ lat0: lat, lon0: lng }, 500);
    const ok = get().confirmAoi(bbox);
    if (!ok) return false;
    set({
      viewAround: { lng, lat, seq: (get().viewAround?.seq ?? 0) + 1 },
    });
    return true;
  },
}));
