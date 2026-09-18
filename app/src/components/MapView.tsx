import * as maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import mapConfig from '../../config/map.json';
import {
  DEFAULT_AOI_SIZE_M,
  MAX_AOI_SIZE_M,
  bboxSizeMeters,
  normalizeBbox,
  squareBboxAround,
  type BBox,
} from '@/geo/aoi';
import { TerrainShadowLayer } from '@/components/TerrainShadowLayer';
import { BuildingLayer, type TreePicker } from '@/components/BuildingLayer';
import { SunHoursLayer } from '@/components/SunHoursLayer';
import { BASEMAP_LAYER_ID, createBasemapStyle } from '@/map/basemap';
import {
  PICKABLE_LAYERS,
  pickFeature,
  syncSeoulLayers,
} from '@/map/seoulLayers';
import { TERRAIN_SOURCE_ID, terrainSourceSpec, terrainSpec } from '@/map/terrain';
import { filterSnowBases } from '@/data/snowBases';
import { useAppStore } from '@/store/appStore';

const CLICK_PX = 8;
const AOI_SOURCE = 'aoi';

function bboxPolygon(bbox: BBox) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'Polygon' as const,
          coordinates: [
            [
              [minLon, minLat],
              [maxLon, minLat],
              [maxLon, maxLat],
              [minLon, maxLat],
              [minLon, minLat],
            ],
          ],
        },
      },
    ],
  };
}

const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] };

function mapLibreErrorMessage(e: { error?: unknown }): string {
  const err = e.error;
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.trim()) return err;
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'MapLibre error';
}

function addAoiLayers(map: maplibregl.Map) {
  if (map.getSource(AOI_SOURCE)) return;
  const current = useAppStore.getState().aoi?.bbox ?? null;
  map.addSource(AOI_SOURCE, {
    type: 'geojson',
    data: current ? bboxPolygon(current) : EMPTY_FC,
  });
  map.addLayer({
    id: 'aoi-fill',
    type: 'fill',
    source: AOI_SOURCE,
    paint: { 'fill-color': '#e8b84a', 'fill-opacity': 0.12 },
  });
  map.addLayer({
    id: 'aoi-line',
    type: 'line',
    source: AOI_SOURCE,
    paint: { 'line-color': '#e8b84a', 'line-width': 2 },
  });
}

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const treePickerRef = useRef<TreePicker | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawingRef = useRef(false);
  const startLngLatRef = useRef<[number, number] | null>(null);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const drawModeRef = useRef(false);

  const aoi = useAppStore((s) => s.aoi);
  const aoiDrawMode = useAppStore((s) => s.aoiDrawMode);
  const aoiWarning = useAppStore((s) => s.aoiWarning);
  const confirmAoi = useAppStore((s) => s.confirmAoi);
  const setViewCenter = useAppStore((s) => s.setViewCenter);
  const setAoiDrawMode = useAppStore((s) => s.setAoiDrawMode);
  const viewAround = useAppStore((s) => s.viewAround);
  const basemap = useAppStore((s) => s.basemap);
  const terrainMeta = useAppStore((s) => s.terrainMeta);
  const terrainStatus = useAppStore((s) => s.terrainStatus);
  const buildingFeatures = useAppStore((s) => s.seoulBuildings.features);
  const treeFeatures = useAppStore((s) => s.seoulTrees.features);
  const showFootprints = useAppStore((s) => s.layers.footprints);
  const showTrees = useAppStore((s) => s.layers.trees);
  const showSnowBases = useAppStore((s) => s.layers.snowBases);
  const snowFeatures = useAppStore((s) => s.snowBases.features);
  const snowKind = useAppStore((s) => s.snowBaseKind);
  const snowQuery = useAppStore((s) => s.snowBaseQuery);
  const selectedFeature = useAppStore((s) => s.selectedFeature);

  const [previewBbox, setPreviewBbox] = useState<BBox | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapObj, setMapObj] = useState<maplibregl.Map | null>(null);
  const [styleReady, setStyleReady] = useState(false);

  drawModeRef.current = aoiDrawMode;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const { style } = createBasemapStyle(useAppStore.getState().basemap);
    const view = mapConfig.initialView;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: style as maplibregl.StyleSpecification,
      center: [view.lon, view.lat],
      zoom: view.zoom,
      pitch: view.pitch,
      bearing: view.bearing,
      maxPitch: 85,
    });

    map.on('error', (e) => {
      const message = mapLibreErrorMessage(e);
      console.error('[서울환경안내] MapLibre error', e.error ?? e);
      if (import.meta.env.DEV) setMapError(message);
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.dragRotate.enable();
    map.touchPitch.enable();
    map.boxZoom.disable();

    const syncCenter = () => {
      const c = map.getCenter();
      setViewCenter({ lat: c.lat, lon: c.lng });
    };

    // 스타일이 실제로 준비된 뒤에만 소스/레이어를 만진다.
    const onStyleReady = () => {
      addAoiLayers(map);
      setStyleReady(true);
      syncCenter();
    };

    map.on('load', onStyleReady);
    map.on('style.load', onStyleReady);
    map.on('moveend', syncCenter);

    const onMouseDown = (e: maplibregl.MapMouseEvent) => {
      if (!drawModeRef.current) return;
      if (e.originalEvent.button !== 0) return;
      e.preventDefault();
      drawingRef.current = true;
      startLngLatRef.current = [e.lngLat.lng, e.lngLat.lat];
      startPointRef.current = { x: e.point.x, y: e.point.y };
    };

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (!drawingRef.current || !startLngLatRef.current) return;
      const [lng0, lat0] = startLngLatRef.current;
      setPreviewBbox(normalizeBbox(lng0, lat0, e.lngLat.lng, e.lngLat.lat));
    };

    const finishDraw = (lng: number, lat: number, point: { x: number; y: number }) => {
      if (!drawingRef.current || !startLngLatRef.current || !startPointRef.current) return;
      drawingRef.current = false;
      const [lng0, lat0] = startLngLatRef.current;
      const startPt = startPointRef.current;
      startLngLatRef.current = null;
      startPointRef.current = null;

      const pixelDist = Math.hypot(point.x - startPt.x, point.y - startPt.y);
      const bbox =
        pixelDist < CLICK_PX
          ? squareBboxAround({ lat0: lat, lon0: lng }, DEFAULT_AOI_SIZE_M)
          : normalizeBbox(lng0, lat0, lng, lat);

      setPreviewBbox(null);
      confirmAoi(bbox);
    };

    const onMouseUp = (e: maplibregl.MapMouseEvent) => {
      finishDraw(e.lngLat.lng, e.lngLat.lat, { x: e.point.x, y: e.point.y });
    };

    // 건물·수목 상세 조회. 두 모드 모두에서 동작한다.
    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (drawModeRef.current) return;
      const layers = PICKABLE_LAYERS.filter((id) => map.getLayer(id));
      if (layers.length === 0) return;
      const hits = map.queryRenderedFeatures(
        [
          [e.point.x - 6, e.point.y - 6],
          [e.point.x + 6, e.point.y + 6],
        ],
        { layers: layers as string[] },
      );
      const picked = pickFeature(hits as never);
      const tree = picked?.kind !== 'snowBase' ? treePickerRef.current?.(e.point.x,e.point.y) : null;
      if (tree) {
        useAppStore.getState().selectFeature({kind:'tree',props:tree.properties as unknown as Record<string,unknown>,
          lngLat:{lng:tree.geometry.coordinates[0],lat:tree.geometry.coordinates[1]}});
        return;
      }
      useAppStore.getState().selectFeature(
        picked
          ? { kind: picked.kind, props: picked.props, lngLat: { lng: e.lngLat.lng, lat: e.lngLat.lat } }
          : null,
      );
    };

    map.on('mousedown', onMouseDown);
    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);
    map.on('click', onClick);

    const onWinMouseUp = (ev: MouseEvent) => {
      if (!drawingRef.current) return;
      const rect = map.getCanvas().getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      const ll = map.unproject([x, y]);
      finishDraw(ll.lng, ll.lat, { x, y });
    };
    window.addEventListener('mouseup', onWinMouseUp);

    mapRef.current = map;
    setMapObj(map);
    return () => {
      window.removeEventListener('mouseup', onWinMouseUp);
      map.off('click', onClick);
      setMapObj(null);
      setStyleReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, [confirmAoi, setViewCenter]);

  // 배경지도 전환: 스타일 교체 없이 OSM 레이어 표시만 끄고 켠다.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady || !map.getLayer(BASEMAP_LAYER_ID)) return;
    map.setLayoutProperty(
      BASEMAP_LAYER_ID,
      'visibility',
      basemap === 'none' ? 'none' : 'visible',
    );
  }, [basemap, styleReady]);

  // 서울 건물 윤곽·수목 점(네이티브 레이어). 지형 위에도 그대로 씌워진다.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    // HMR 등으로 스타일이 다시 로딩 중이면 소스 추가가 실패한다. 준비되면 다시 맞춘다.
    const sync = () => {
      try {
        applySync();
      } catch (err) {
        console.warn('[서울환경안내] 레이어 동기화 지연', err);
        map.once('idle', () => {
          try {
            applySync();
          } catch {
            /* 다음 변경에서 다시 시도 */
          }
        });
      }
    };
    const applySync = () =>
      syncSeoulLayers(map, {
      buildings: buildingFeatures,
      trees: treeFeatures,
      snowBases: filterSnowBases(snowFeatures, { kind: snowKind, query: snowQuery }),
      buildingsVisible: showFootprints,
      treesVisible: false, // Rendered and picked as 3D trees in the shared deck overlay.
      snowBasesVisible: showSnowBases,
    });
    sync();
  }, [
    styleReady,
    buildingFeatures,
    treeFeatures,
    snowFeatures,
    snowKind,
    snowQuery,
    showFootprints,
    showTrees,
    showSnowBases,
  ]);

  // 표면고도(DSM) 지형. 과장 1, 자료 범위 밖은 요청하지 않는다.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    const wantTerrain = terrainStatus === 'ready' && terrainMeta;
    if (!wantTerrain) {
      if (map.getTerrain?.()) map.setTerrain(null);
      return;
    }
    if (!map.getSource(TERRAIN_SOURCE_ID)) {
      map.addSource(TERRAIN_SOURCE_ID, terrainSourceSpec(terrainMeta) as never);
    }
    map.setTerrain(terrainSpec(terrainMeta) as never);
    return () => {
      if (map.getStyle() && map.getTerrain?.()) map.setTerrain(null);
    };
  }, [styleReady, terrainStatus, terrainMeta]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (aoiDrawMode) {
      map.dragPan.disable();
      map.getCanvas().style.cursor = 'crosshair';
    } else {
      map.dragPan.enable();
      map.getCanvas().style.cursor = '';
      drawingRef.current = false;
      setPreviewBbox(null);
    }
  }, [aoiDrawMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource(AOI_SOURCE)) return;
    const shown = previewBbox ?? aoi?.bbox ?? null;
    const src = map.getSource(AOI_SOURCE) as maplibregl.GeoJSONSource;
    src.setData(shown ? bboxPolygon(shown) : EMPTY_FC);
  }, [aoi, previewBbox, styleReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !viewAround) return;
    map.flyTo({ center: [viewAround.lng, viewAround.lat], zoom: 16, duration: 800 });
  }, [viewAround]);

  // A single selection pin stays legible over detailed terrain and map symbols.
  useEffect(() => {
    if (!mapObj || !showSnowBases || selectedFeature?.kind !== 'snowBase') return;
    const feature = filterSnowBases(snowFeatures, { kind: snowKind, query: snowQuery })
      .find((f) => f.properties.id === selectedFeature.props.id);
    if (!feature) return;
    const marker = new maplibregl.Marker({ color: '#f0bf58', opacityWhenCovered: '0.55' })
      .setLngLat([feature.geometry.coordinates[0], feature.geometry.coordinates[1]])
      .addTo(mapObj);
    marker.getElement().setAttribute('aria-label', '선택한 제설전진기지');
    return () => { marker.remove(); };
  }, [mapObj, selectedFeature, showSnowBases, snowFeatures, snowKind, snowQuery]);

  const live = previewBbox ? bboxSizeMeters(previewBbox) : null;

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="map-container" />
      {mapObj && styleReady && <BuildingLayer map={mapObj} treePickerRef={treePickerRef} />}
      {mapObj && styleReady && <SunHoursLayer map={mapObj} />}
      {mapObj && styleReady && <TerrainShadowLayer map={mapObj} />}
      <div className="map-badge" data-testid="map-mode-badge">
        추정 지면 + 건물 통합 일조 · 지형 과장 1배
      </div>
      {basemap === 'osm' && (
        <div className="osm-badge">배경지도: OpenStreetMap 공개 타일</div>
      )}
      {aoiDrawMode && (
        <div className="map-hint">
          드래그로 사각형을 지정하세요. 클릭만 하면 {DEFAULT_AOI_SIZE_M}m ×{' '}
          {DEFAULT_AOI_SIZE_M}m. 최대 {MAX_AOI_SIZE_M}m.
          {live && (
            <span>
              {' '}
              미리보기 {Math.round(live.width)}m × {Math.round(live.height)}m
            </span>
          )}
          <button
            type="button"
            className="btn btn-ghost map-hint-cancel"
            onClick={() => setAoiDrawMode(false)}
          >
            취소
          </button>
        </div>
      )}
      {aoiWarning && (
        <div className="map-warning" role="alert">
          {aoiWarning}
        </div>
      )}
      {import.meta.env.DEV && mapError && (
        <div className="map-warning" role="alert">
          MapLibre: {mapError}
        </div>
      )}
      <div className="map-help">Ctrl+드래그 또는 우클릭 드래그로 회전·기울기</div>
    </div>
  );
}
