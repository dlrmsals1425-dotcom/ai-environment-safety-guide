import { useEffect } from 'react';
import { loadGround } from '@/data/ground';
import seoulConfig from '../../config/seoul.json';
import spatialConfig from '../../config/spatial.json';
import {
  bboxCenter,
  bufferBboxMeters,
  squareBboxAround,
  type BBox,
} from '@/geo/aoi';
import {
  capFeatures,
  featureIntersectsBbox,
  fetchJson,
  loadTileFeatures,
  MissingDataError,
  normalizeBuildingFeature,
  normalizeSnowBaseFeature,
  normalizeTreeFeature,
  parseFeatureCollection,
  parseSnowBaseMeta,
  SchemaError,
} from '@/data/seoulData';
import {
  isOutsideBounds,
  hasCompleteCoverage,
  parseDatasetMeta,
  parseTileIndex,
  resolveMetaUrl,
  selectTiles,
  tileIdsOf,
} from '@/data/tileIndex';
import { toAnalysisBuildings } from '@/data/seoulAnalysis';
import { parseTerrainMeta } from '@/map/terrain';
import { useAppStore } from '@/store/appStore';
import {
  emptyDatasetState,
  type DatasetMeta,
  type DatasetState,
  type SeoulBuildingFeature,
  type SeoulTreeFeature,
  type SnowBaseFeature,
  type TileIndex,
} from '@/types/seoul';
import { bboxIntersects } from '@/geo/aoi';

const DATA = seoulConfig.data;
const LIMITS = seoulConfig.limits;

function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

interface IndexBundle {
  index: TileIndex;
  meta: DatasetMeta | null;
}

/**
 * 인덱스는 호출자의 AbortSignal과 무관하게 받아온다.
 * (StrictMode 이중 마운트나 빠른 화면 전환에서 취소된 요청이 캐시에 남으면
 *  이후 로드가 영구히 '불러오는 중'에 머문다.)
 * 성공한 값만 캐시하고, 진행 중 요청은 중복 호출만 합친다.
 */
const indexValueCache = new Map<string, IndexBundle>();
const indexInflight = new Map<string, Promise<IndexBundle>>();

async function loadIndexBundle(url: string): Promise<IndexBundle> {
  const cached = indexValueCache.get(url);
  if (cached) return cached;
  const running = indexInflight.get(url);
  if (running) return running;

  const task = (async () => {
    const index = parseTileIndex(await fetchJson(url));
    if (index.tiles.length === 0) {
      throw new SchemaError(url, 'tiles 목록이 비어 있습니다');
    }
    let meta: DatasetMeta | null = null;
    try {
      meta = parseDatasetMeta(await fetchJson(resolveMetaUrl(url, index.metaUrl)));
    } catch (err) {
      if (!(err instanceof MissingDataError)) throw err;
    }
    const bundle: IndexBundle = { index, meta };
    indexValueCache.set(url, bundle);
    return bundle;
  })().finally(() => {
    indexInflight.delete(url);
  });

  indexInflight.set(url, task);
  return task;
}

/** 테스트·개발에서 인덱스 캐시를 비운다. */
export function clearSeoulIndexCache(): void {
  indexValueCache.clear();
  indexInflight.clear();
}

function viewBboxFor(): { bbox: BBox; origin: { lat0: number; lon0: number } } {
  const st = useAppStore.getState();
  const bbox =
    st.aoi?.bbox ??
    squareBboxAround(
      { lat0: st.viewCenter.lat, lon0: st.viewCenter.lon },
      LIMITS.viewAreaM,
    );
  return { bbox, origin: st.origin ?? bboxCenter(bbox) };
}

function failureState<T>(err: unknown, tileIds: string[]): DatasetState<T> {
  const base = emptyDatasetState<T>();
  if (err instanceof MissingDataError) {
    return { ...base, status: 'missing', tileIds, error: null };
  }
  return { ...base, status: 'error', tileIds, error: errorMessage(err) };
}

export function useSeoulData(): void {
  const ground = useAppStore((s) => s.ground);
  useEffect(() => {
    let active = true;
    loadGround().then((ground) => {
      if (active) useAppStore.setState({ground, groundError: null});
    }).catch((err) => {
      if (active) useAppStore.setState({groundError: errorMessage(err)});
    });
    return () => { active = false; };
  }, []);
  const aoi = useAppStore((s) => s.aoi);
  const viewCenter = useAppStore((s) => s.viewCenter);
  // AOI가 있으면 화면 이동만으로 다시 읽지 않는다(팬할 때마다 일조 결과가 사라지는 문제).
  const loadKey = aoi
    ? `aoi:${aoi.bbox.join(',')}`
    : `view:${viewCenter.lat.toFixed(4)},${viewCenter.lon.toFixed(4)}`;

  // 지형 meta는 한 번만 읽는다.
  useEffect(() => {
    const ac = new AbortController();
    const { setTerrain } = useAppStore.getState();
    setTerrain('checking', null);
    fetchJson(DATA.terrainMetaUrl, ac.signal)
      .then((raw) => {
        const meta = parseTerrainMeta(raw);
        if (!meta) {
          setTerrain('missing', null, null);
          return;
        }
        setTerrain('ready', meta, null);
      })
      .catch((err: unknown) => {
        if (isAbort(err)) return;
        if (err instanceof MissingDataError) setTerrain('missing', null, null);
        else setTerrain('error', null, errorMessage(err));
      });
    return () => ac.abort();
  }, []);

  // 제설전진기지: 86행 규모의 단일 파일이라 한 번만 읽는다(시설 위치 참고 자료).
  useEffect(() => {
    const ac = new AbortController();
    const { setSnowBases } = useAppStore.getState();
    setSnowBases({ ...emptyDatasetState<SnowBaseFeature>(), status: 'loading' }, null);

    (async () => {
      const raw = await fetchJson(DATA.snowBasesUrl, ac.signal);
      const { features, skipped } = parseFeatureCollection(
        raw,
        normalizeSnowBaseFeature,
        DATA.snowBasesUrl,
      );
      let meta = null;
      try {
        meta = parseSnowBaseMeta(await fetchJson(DATA.snowBasesMetaUrl, ac.signal));
      } catch (err) {
        if (!(err instanceof MissingDataError)) throw err;
      }
      return {
        state: {
          status: features.length === 0 ? ('empty' as const) : ('ready' as const),
          features,
          index: null,
          meta: null,
          tileIds: [],
          error: null,
          capped: false,
          tilesTruncated: false,
          skipped,
          loadedAt: new Date().toISOString(),
        },
        meta,
      };
    })()
      .then(({ state, meta }) => {
        useAppStore.getState().setSnowBases(state, meta);
      })
      .catch((err: unknown) => {
        if (isAbort(err)) return;
        useAppStore.getState().setSnowBases(failureState<SnowBaseFeature>(err, []), null);
      });

    return () => ac.abort();
  }, []);

  // 건물: AOI(+버퍼) 전체를 확보해야 분석이 가능하다. 표시 상한을 쓰지 않는다.
  useEffect(() => {
    const ac = new AbortController();
    const seq = useAppStore.getState().beginSeoulBuildingLoad();
    const { bbox, origin } = viewBboxFor();
    const needBbox = bufferBboxMeters(bbox, spatialConfig.aoiBufferM);

    (async () => {
      const { index, meta } = await loadIndexBundle(DATA.buildingsIndexUrl);
      if (!hasCompleteCoverage(index,needBbox)) throw new Error('팀 공유 샘플 범위 밖입니다. 서울숲·남산·여의도 프리셋을 선택하거나 서울 전체 데이터를 설치하세요.');
      if (isOutsideBounds(index.bounds, needBbox)) {
        return {
          state: {
            ...emptyDatasetState<SeoulBuildingFeature>(),
            status: 'empty' as const,
            index,
            meta,
          },
          unknown: 0,
          buildings: [],
        };
      }
      const hit = index.tiles.filter((t) => bboxIntersects(t.bbox, needBbox));
      const chosen = selectTiles(index.tiles, needBbox, LIMITS.maxTilesPerLoad);
      const tilesTruncated = hit.length > chosen.length;
      const { features: tileFeatures, skipped } = await loadTileFeatures(
        chosen,
        normalizeBuildingFeature,
        ac.signal,
      );
      const features = tileFeatures.filter((f) => featureIntersectsBbox(f, needBbox));
      const analysis = ground ? toAnalysisBuildings(features, origin, ground)
        : {buildings: [], excludedUnknownHeight: features.filter((f) => !(f.properties.height > 0)).length};
      return {
        state: {
          status: features.length === 0 ? ('empty' as const) : ('ready' as const),
          features,
          index,
          meta,
          tileIds: tileIdsOf(chosen),
          error: null,
          capped: false,
          tilesTruncated,
          skipped,
          loadedAt: new Date().toISOString(),
        },
        unknown: analysis.excludedUnknownHeight,
        buildings: analysis.buildings,
      };
    })()
      .then(({ state, unknown, buildings }) => {
        useAppStore.getState().applySeoulBuildings(seq, state, unknown, buildings);
      })
      .catch((err: unknown) => {
        if (isAbort(err)) return;
        useAppStore
          .getState()
          .applySeoulBuildings(seq, failureState<SeoulBuildingFeature>(err, []), 0, []);
      });

    return () => ac.abort();
  }, [loadKey, ground]);

  // 수목: 표시 참고용이라 렌더 상한을 둔다(차폐 계산에는 쓰지 않는다).
  useEffect(() => {
    const ac = new AbortController();
    const seq = useAppStore.getState().beginSeoulTreeLoad();
    const { bbox: area } = viewBboxFor();
    const bbox = bufferBboxMeters(area, spatialConfig.aoiBufferM);

    (async () => {
      const { index, meta } = await loadIndexBundle(DATA.treesIndexUrl);
      if (!hasCompleteCoverage(index,bbox)) throw new Error('팀 공유 샘플 범위 밖입니다. 서울숲·남산·여의도 프리셋을 선택하세요.');
      if (isOutsideBounds(index.bounds, bbox)) {
        return {
          ...emptyDatasetState<SeoulTreeFeature>(),
          status: 'empty' as const,
          index,
          meta,
        };
      }
      const hit = index.tiles.filter((t) => bboxIntersects(t.bbox, bbox));
      const chosen = selectTiles(index.tiles, bbox, LIMITS.maxTilesPerLoad);
      const { features, skipped } = await loadTileFeatures(
        chosen,
        normalizeTreeFeature,
        ac.signal,
      );
      const localFeatures = features.filter((f) => featureIntersectsBbox(f, bbox));
      const { shown, capped } = capFeatures(localFeatures, LIMITS.treeRenderCap);
      return {
        status: shown.length === 0 ? ('empty' as const) : ('ready' as const),
        features: shown,
        index,
        meta,
        tileIds: tileIdsOf(chosen),
        error: null,
        capped,
        tilesTruncated: hit.length > chosen.length,
        skipped,
        loadedAt: new Date().toISOString(),
      };
    })()
      .then((state) => {
        useAppStore.getState().applySeoulTrees(seq, state);
      })
      .catch((err: unknown) => {
        if (isAbort(err)) return;
        useAppStore.getState().applySeoulTrees(seq, failureState<SeoulTreeFeature>(err, []));
      });

    return () => ac.abort();
  }, [loadKey]);
}
