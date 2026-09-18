import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LAYERS } from '@/types/layers';
import { useAppStore } from '@/store/appStore';
import type { Building } from '@/types/building';

const { MapLibreOverlay, PolygonLayer, SolidPolygonLayer, BitmapLayer } = vi.hoisted(() => {
  const overlayInstances: {
    setProps: ReturnType<typeof vi.fn>;
    finalize: ReturnType<typeof vi.fn>;
    props: unknown;
  }[] = [];
  const MapLibreOverlay = vi.fn().mockImplementation(function(props: { interleaved?: boolean }) {
    const inst = { props, setProps: vi.fn(), finalize: vi.fn() };
    overlayInstances.push(inst);
    return inst;
  });
  (MapLibreOverlay as typeof MapLibreOverlay & { instances: typeof overlayInstances }).instances =
    overlayInstances;
  const layer = () => vi.fn().mockImplementation(function(props: unknown) { return props; });
  return {
    MapLibreOverlay,
    PolygonLayer: layer(),
    SolidPolygonLayer: layer(),
    BitmapLayer: layer(),
  };
});

vi.mock('@deck.gl/maplibre', () => ({ MapLibreOverlay }));
vi.mock('@deck.gl/layers', () => ({ PolygonLayer, SolidPolygonLayer, BitmapLayer }));
vi.mock('@/analysis/heatmap', () => ({ sunHoursCanvas: () => ({ width: 2, height: 2 }) }));

import { BuildingLayer, buildDeckLayers } from '@/components/BuildingLayer';

const building: Building = {
  id: 'seoul-forest-1',
  ring: new Float64Array([0, 0, 10, 0, 10, 10, 0, 10]),
  baseZ: 0,
  height: 55,
  heightSource: 'measured',
  minX: 0,
  minY: 0,
  maxX: 10,
  maxY: 10,
  lngLatPolygon: [
    [
      [127.0374, 37.5445],
      [127.0376, 37.5445],
      [127.0376, 37.5447],
      [127.0374, 37.5447],
      [127.0374, 37.5445],
    ],
  ],
};

const spec = { originX: 0, originY: 0, cellSize: 4, nx: 2, ny: 2 };
const origin = { lat0: 37.5445, lon0: 127.0374 };

function layerIds(layers: { id?: string }[] | undefined): string[] {
  return (layers ?? []).map((l) => l.id).filter((id): id is string => Boolean(id));
}

function lastOverlay() {
  const instances = (
    MapLibreOverlay as typeof MapLibreOverlay & {
      instances: { setProps: ReturnType<typeof vi.fn>; props: { layers?: { id?: string }[] } }[];
    }
  ).instances;
  return instances.at(-1)!;
}

function mapStub() {
  return {
    addControl: vi.fn(),
    removeControl: vi.fn(),
    loaded: () => true,
    isStyleLoaded: () => true,
    once: vi.fn(),
    off: vi.fn(),
  };
}

describe('BuildingLayer (analysis mode 3D)', () => {
  beforeEach(() => {
    MapLibreOverlay.mockClear();
    PolygonLayer.mockClear();
    (MapLibreOverlay as typeof MapLibreOverlay & { instances: unknown[] }).instances.length = 0;
    useAppStore.setState({
      buildings: [building],
      layers: { ...DEFAULT_LAYERS, buildings: true },
      dataIsSynthetic: false,

      origin: null,
      sunHours: null,
      sunHoursSpec: null,
      date: new Date(2026, 8, 16),
      timeMinutes: 720,
    });
  });

  afterEach(cleanup);

  it('attaches MapLibreOverlay interleaved and extrudes height in meters', () => {
    const map = mapStub();
    render(<BuildingLayer map={map as never} />);
    expect(MapLibreOverlay).toHaveBeenCalledWith(expect.objectContaining({ interleaved: true }));
    expect(map.addControl).toHaveBeenCalled();
    const props = PolygonLayer.mock.calls.at(-1)?.[0] as {
      extruded: boolean;
      shadowEnabled: boolean;
      data: Building[];
      getElevation: (b: Building) => number;
      getPolygon: (b: Building) => number[][][];
    };
    expect(props.extruded).toBe(true);
    expect(props.shadowEnabled).toBe(false);
    expect(props.data).toHaveLength(1);
    expect(props.getElevation(building)).toBe(55);
    expect(props.getPolygon(building)[0][0][0]).toBeCloseTo(127.0374);
  });

  it('waits for map load before adding the overlay', () => {
    const once = vi.fn();
    const map = { ...mapStub(), loaded: () => false, isStyleLoaded: () => false, once };
    render(<BuildingLayer map={map as never} />);
    expect(map.addControl).not.toHaveBeenCalled();
    expect(once).toHaveBeenCalledWith('load', expect.any(Function));
    (once.mock.calls[0][1] as () => void)();
    expect(map.addControl).toHaveBeenCalled();
  });

  it('keeps only buildings in the deck overlay; terrain receives raster shadows', () => {
    render(<BuildingLayer map={mapStub() as never} />);
    act(() => {
      const hours = new Float32Array(4);
      hours[0] = 3;
      useAppStore.setState({
        origin,
        sunHours: hours,
        sunHoursSpec: spec,
        layers: { ...DEFAULT_LAYERS, buildings: true, sunHours: true },
      });
    });
    const after = lastOverlay().setProps.mock.calls.filter((c) => c[0].layers).at(-1)?.[0];
    expect(layerIds(after.layers)).toEqual(['seoul-buildings-3d']);

    const layerCalls = lastOverlay().setProps.mock.calls.filter((c) => c[0].layers).length;
    act(() => {
      useAppStore.getState().setTimeMinutes(800);
    });
    expect(lastOverlay().setProps.mock.calls.slice(-2).some((c) => c[0].effects && !c[0].layers)).toBe(
      true,
    );
    expect(lastOverlay().setProps.mock.calls.filter((c) => c[0].layers).length).toBe(layerCalls);
  });
});

describe('buildDeckLayers', () => {
  it('keeps the building layer present but empty when 3D buildings are hidden', () => {
    const layers = buildDeckLayers({
      buildings: [building],
      buildingsVisible: false,
      origin,
      shadowOn: true,
    });
    expect(layerIds(layers)).toEqual(['seoul-buildings-3d']);
    const buildingLayer = layers.find((l) => l.id === 'seoul-buildings-3d') as unknown as {
      data: Building[];
    };
    expect(buildingLayer.data).toEqual([]);
  });

  it('never emits CCTV layers in the Seoul prototype', () => {
    const layers = buildDeckLayers({
      buildings: [building],
      buildingsVisible: true,
      origin,
      shadowOn: true,
    });
    expect(layerIds(layers).some((id) => id.includes('cctv'))).toBe(false);
  });

  it('never creates a flat shadow receiver', () => {
    const layers = buildDeckLayers({
      buildings: [building],
      buildingsVisible: true,
      origin,
      shadowOn: false,
    });
    const ground = layers.find((l) => l.id === 'analysis-shadow-ground') as unknown as {
      data: unknown[];
    };
    expect(ground).toBeUndefined();
  });
});
