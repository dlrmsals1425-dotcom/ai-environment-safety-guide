import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '@/store/appStore';
import { emptyDatasetState, type TerrainMeta } from '@/types/seoul';

const { mockMap } = vi.hoisted(() => {
  const mockMap = {
    on: vi.fn(),
    once: vi.fn(),
    addControl: vi.fn(),
    removeControl: vi.fn(),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    getSource: vi.fn(),
    getLayer: vi.fn(),
    setLayoutProperty: vi.fn(),
    setStyle: vi.fn(),
    getStyle: vi.fn(() => ({})),
    isStyleLoaded: vi.fn(() => true),
    queryRenderedFeatures: vi.fn(() => []),
    setTerrain: vi.fn(),
    getTerrain: vi.fn(() => null),
    getCenter: vi.fn(() => ({ lng: 127.0374, lat: 37.5445 })),
    getCanvas: vi.fn(() => ({
      style: { cursor: '' },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    })),
    unproject: vi.fn(() => ({ lng: 0, lat: 0 })),
    remove: vi.fn(),
    dragRotate: { enable: vi.fn() },
    touchPitch: { enable: vi.fn() },
    boxZoom: { disable: vi.fn() },
    dragPan: { enable: vi.fn(), disable: vi.fn() },
    flyTo: vi.fn(),
    project: vi.fn(() => ({ x: 0, y: 0 })),
    off: vi.fn(),
  };
  return { mockMap };
});

vi.mock('maplibre-gl', () => ({
    Map: vi.fn(function() { return mockMap; }),
    NavigationControl: vi.fn(),
    Marker: vi.fn(function() { return {
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      getElement: () => document.createElement('div'),
      remove: vi.fn(),
    }; }),
}));

vi.mock('@/components/BuildingLayer', () => ({ BuildingLayer: () => null }));
vi.mock('@/components/TerrainShadowLayer', () => ({ TerrainShadowLayer: () => null }));
vi.mock('@/components/SunHoursLayer', () => ({ SunHoursLayer: () => null }));

import * as maplibregl from 'maplibre-gl';
import { MapView } from '@/components/MapView';

const terrainMeta: TerrainMeta = {
  tiles: ['/data/seoul/terrain/{z}/{x}/{y}.png'],
  bounds: [126.5, 37.2, 127.4, 37.85],
  minzoom: 8,
  maxzoom: 12,
  tileSize: 256,
  encoding: 'mapbox',
  exaggeration: 1,
  nominalResolutionM: 30,
  attribution: 'Copernicus DEM',
};

function resetStore() {
  useAppStore.setState({
    aoi: null,
    origin: null,
    date: new Date(2026, 8, 16),
    timeMinutes: 720,
    aoiDrawMode: false,
    aoiWarning: null,
    viewCenter: { lat: 37.5445, lon: 127.0374 },
    viewAround: null,

    basemap: 'osm',
    seoulBuildings: emptyDatasetState(),
    seoulTrees: emptyDatasetState(),
    snowBases: emptyDatasetState(),
    selectedFeature: null,
    terrainStatus: 'idle',
    terrainMeta: null,
  });
}

function fireLoad() {
  const load = mockMap.on.mock.calls.find((c) => c[0] === 'load')?.[1] as
    | (() => void)
    | undefined;
  load?.();
}

describe('MapView render smoke', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    mockMap.isStyleLoaded.mockReturnValue(true);
    mockMap.getTerrain.mockReturnValue(null);
    mockMap.queryRenderedFeatures.mockReturnValue([]);
    mockMap.getSource.mockReturnValue(undefined);
    mockMap.getLayer.mockReturnValue(undefined);
  });

  afterEach(cleanup);

  it('constructs maplibregl.Map with the OSM basemap and the Seoul initial view', () => {
    render(<MapView />);
    expect(maplibregl.Map).toHaveBeenCalledTimes(1);
    expect(maplibregl.Map).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [127.0374, 37.5445],
        zoom: 16,
        style: expect.objectContaining({
          version: 8,
          sources: expect.objectContaining({
            basemap: expect.objectContaining({
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            }),
          }),
        }),
      }),
    );
    expect(mockMap.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockMap.on).toHaveBeenCalledWith('load', expect.any(Function));
  });

  it('on load adds AOI geojson source and aoi-fill/aoi-line layers', () => {
    render(<MapView />);
    fireLoad();
    expect(mockMap.addSource).toHaveBeenCalledWith(
      'aoi',
      expect.objectContaining({ type: 'geojson' }),
    );
    expect(mockMap.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'aoi-fill', type: 'fill', source: 'aoi' }),
    );
    expect(mockMap.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'aoi-line', type: 'line', source: 'aoi' }),
    );
  });

  it('surfaces MapLibre errors in dev via the error handler', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<MapView />);
    const onError = mockMap.on.mock.calls.find((c) => c[0] === 'error')?.[1] as
      | ((e: { error: Error }) => void)
      | undefined;
    act(() => {
      onError?.({ error: new Error('style load failed') });
    });
    expect(errSpy).toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('style load failed');
    errSpy.mockRestore();
  });

  it('after load, store AOI is written to the aoi geojson source', () => {
    const setData = vi.fn();
    mockMap.getSource.mockReturnValue({ setData });
    render(<MapView />);
    fireLoad();
    act(() => {
      useAppStore.getState().placeDefaultAoi();
    });
    const data = setData.mock.calls.at(-1)?.[0] as {
      type: string;
      features: { geometry: { type: string } }[];
    };
    expect(data.type).toBe('FeatureCollection');
    expect(data.features[0]?.geometry.type).toBe('Polygon');
  });

  it('selects a clicked building from the native layers', () => {
    mockMap.getLayer.mockReturnValue({});
    mockMap.queryRenderedFeatures.mockReturnValue([
      {
        layer: { id: 'seoul-building-fill' },
        properties: { id: 'b1', heightSource: 'measured', height: 12 },
      },
    ] as never);
    render(<MapView />);
    const click = mockMap.on.mock.calls.find((c) => c[0] === 'click')?.[1] as
      | ((e: { point: { x: number; y: number }; lngLat: { lng: number; lat: number } }) => void)
      | undefined;
    act(() => {
      click?.({ point: { x: 10, y: 10 }, lngLat: { lng: 127.0374, lat: 37.5445 } });
    });
    const selected = useAppStore.getState().selectedFeature;
    expect(selected?.kind).toBe('building');
    expect(selected?.props.id).toBe('b1');
  });

  it('prefers a snow base over a building at the same click point', () => {
    mockMap.getLayer.mockReturnValue({});
    mockMap.queryRenderedFeatures.mockReturnValue([
      { layer: { id: 'seoul-building-fill' }, properties: { id: 'b1' } },
      { layer: { id: 'seoul-snow-base-circle' }, properties: { id: 's1', agency: '성동구청' } },
    ] as never);
    render(<MapView />);
    const click = mockMap.on.mock.calls.find((c) => c[0] === 'click')?.[1] as
      | ((e: { point: { x: number; y: number }; lngLat: { lng: number; lat: number } }) => void)
      | undefined;
    act(() => {
      click?.({ point: { x: 10, y: 10 }, lngLat: { lng: 127.0374, lat: 37.5445 } });
    });
    expect(useAppStore.getState().selectedFeature?.kind).toBe('snowBase');
  });

  it('does not select while drawing an AOI', () => {
    useAppStore.setState({ aoiDrawMode: true });
    mockMap.getLayer.mockReturnValue({});
    mockMap.queryRenderedFeatures.mockReturnValue([
      { layer: { id: 'seoul-building-fill' }, properties: { id: 'b1' } },
    ] as never);
    render(<MapView />);
    const click = mockMap.on.mock.calls.find((c) => c[0] === 'click')?.[1] as
      | ((e: { point: { x: number; y: number }; lngLat: { lng: number; lat: number } }) => void)
      | undefined;
    act(() => {
      click?.({ point: { x: 10, y: 10 }, lngLat: { lng: 127.0374, lat: 37.5445 } });
    });
    expect(useAppStore.getState().selectedFeature).toBeNull();
  });

  it('enables terrain together with building analysis, with exaggeration 1 and bounded tiles', () => {
    render(<MapView />);
    fireLoad();
    act(() => {
      useAppStore.getState().setTerrain('ready', terrainMeta);
    });
    expect(mockMap.addSource).toHaveBeenCalledWith(
      'seoul-surface-dem',
      expect.objectContaining({
        type: 'raster-dem',
        encoding: 'mapbox',
        tileSize: 256,
        bounds: [126.5, 37.2, 127.4, 37.85],
      }),
    );
    expect(mockMap.setTerrain).toHaveBeenCalledWith({
      source: 'seoul-surface-dem',
      exaggeration: 1,
    });
  });

  it('flies to a requested location without changing the AOI', () => {
    render(<MapView />);
    fireLoad();
    act(() => {
      useAppStore.getState().flyTo(127.02, 37.55);
    });
    expect(mockMap.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [127.02, 37.55] }),
    );
    expect(useAppStore.getState().aoi).toBeNull();
  });
});
