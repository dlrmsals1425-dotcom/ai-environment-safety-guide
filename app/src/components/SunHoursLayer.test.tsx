/** 배치 위치(적용 시): cpted-sunmap/src/components/SunHoursLayer.test.tsx (전체 교체) */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LAYERS } from '@/types/layers';
import { useAppStore } from '@/store/appStore';

vi.mock('@/analysis/heatmap', () => ({
  sunHoursCanvas: () => ({
    toDataURL: () => 'data:image/png;base64,sunhours',
  }),
  sunHoursImageCoordinates: (bounds: number[]) => [
    [bounds[0], bounds[3]],
    [bounds[2], bounds[3]],
    [bounds[2], bounds[1]],
    [bounds[0], bounds[1]],
  ],
}));

import { SunHoursLayer } from '@/components/SunHoursLayer';

const spec = { originX: 0, originY: 0, cellSize: 4, nx: 2, ny: 2 };
const origin = { lat0: 37.658, lon0: 126.832 };

/**
 * MapLibre 지도 스텁.
 * `destroy()` 는 실제 `Map.remove()` 의 관찰 가능한 상태를 흉내낸다 —
 * 'remove' 이벤트를 쏘고, 스타일 참조가 사라져 getStyle() 은 undefined,
 * getLayer()/getSource() 는 TypeError 를 던진다.
 */
function mockMap() {
  const layers = new Set<string>();
  const sources = new Map<string, { updateImage?: ReturnType<typeof vi.fn> }>();
  const handlers = new Map<string, Set<(...a: unknown[]) => void>>();
  let style: object | undefined = { layers: [], sources: {} };
  const requireStyle = (fn: string) => {
    if (!style) {
      throw new TypeError(`Cannot read properties of undefined (reading '${fn}')`);
    }
  };

  const map = {
    loaded: () => true,
    isStyleLoaded: () => true,
    getStyle: () => style,
    on: vi.fn((ev: string, fn: (...a: unknown[]) => void) => {
      if (!handlers.has(ev)) handlers.set(ev, new Set());
      handlers.get(ev)!.add(fn);
      return map;
    }),
    once: vi.fn(),
    off: vi.fn((ev: string, fn: (...a: unknown[]) => void) => {
      handlers.get(ev)?.delete(fn);
      return map;
    }),
    getLayer: vi.fn((id: string) => {
      requireStyle('getLayer');
      return layers.has(id) ? { id } : undefined;
    }),
    getSource: vi.fn((id: string) => {
      requireStyle('getSource');
      return sources.get(id);
    }),
    addSource: vi.fn((id: string) => {
      sources.set(id, { updateImage: vi.fn() });
    }),
    addLayer: vi.fn((layer: { id: string }) => {
      layers.add(layer.id);
    }),
    removeLayer: vi.fn((id: string) => {
      layers.delete(id);
    }),
    removeSource: vi.fn((id: string) => {
      sources.delete(id);
    }),
    /** 실제 Map.remove() 처럼 'remove' 를 쏘고 스타일을 지운다. */
    _destroy(fireRemoveEvent = true) {
      if (fireRemoveEvent) handlers.get('remove')?.forEach((fn) => fn());
      style = undefined;
    },
    _layers: layers,
    _sources: sources,
  };
  return map;
}

/** 렌더 직후 호출 횟수를 기준선으로 잡는다. effect 가 이미 한 번 돌기 때문이다. */
function baseline(map: ReturnType<typeof mockMap>) {
  return {
    getLayer: map.getLayer.mock.calls.length,
    removeLayer: map.removeLayer.mock.calls.length,
    removeSource: map.removeSource.mock.calls.length,
  };
}

describe('SunHoursLayer', () => {
  beforeEach(() => {
    useAppStore.setState({
      origin,
      sunHours: new Float32Array([1, 2, 3, 8]),
      sunHoursSpec: spec,
      layers: { ...DEFAULT_LAYERS, sunHours: true },
    });
  });
  afterEach(cleanup);

  it('adds a MapLibre image layer so the heatmap stays when 3D buildings and shadows are off', () => {
    const map = mockMap();
    render(<SunHoursLayer map={map as never} />);
    expect(map.addSource).toHaveBeenCalledWith(
      'bitgil-sunhours',
      expect.objectContaining({
        type: 'image',
        url: 'data:image/png;base64,sunhours',
      }),
    );
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'bitgil-sunhours', type: 'raster' }),
      undefined,
    );
  });

  it('removes the image layer when the heatmap is toggled off', () => {
    const map = mockMap();
    render(<SunHoursLayer map={map as never} />);
    act(() => {
      useAppStore.getState().setLayerVisible('sunHours', false);
    });
    expect(map.removeLayer).toHaveBeenCalledWith('bitgil-sunhours');
    expect(map.removeSource).toHaveBeenCalledWith('bitgil-sunhours');
  });
});

describe('SunHoursLayer cleanup', () => {
  beforeEach(() => {
    useAppStore.setState({
      origin,
      sunHours: new Float32Array([1, 2, 3, 8]),
      sunHoursSpec: spec,
      layers: { ...DEFAULT_LAYERS, sunHours: true },
    });
  });
  afterEach(cleanup);

  it('cleans up normally while the map is alive', () => {
    const map = mockMap();
    const view = render(<SunHoursLayer map={map as never} />);
    const base = baseline(map);

    view.unmount();

    expect(map.removeLayer.mock.calls.length - base.removeLayer).toBe(1);
    expect(map.removeSource.mock.calls.length - base.removeSource).toBe(1);
    expect(map._layers.has('bitgil-sunhours')).toBe(false);
  });

  it('does not touch a destroyed map on unmount (HMR 순서 회귀)', () => {
    const map = mockMap();
    const view = render(<SunHoursLayer map={map as never} />);
    const base = baseline(map);

    map._destroy(); // 지도가 먼저 제거된 뒤 컴포넌트 cleanup 이 도는 상황

    expect(() => view.unmount()).not.toThrow();
    expect(map.getLayer.mock.calls.length).toBe(base.getLayer);
    expect(map.removeLayer.mock.calls.length).toBe(base.removeLayer);
    expect(map.removeSource.mock.calls.length).toBe(base.removeSource);
  });

  it('guards by style presence even if the remove event was missed', () => {
    const map = mockMap();
    const view = render(<SunHoursLayer map={map as never} />);
    const base = baseline(map);

    map._destroy(false); // 이벤트 없이 스타일만 사라진 경우

    expect(() => view.unmount()).not.toThrow();
    expect(map.removeLayer.mock.calls.length).toBe(base.removeLayer);
  });

  it('does not swallow errors raised while the style is alive', () => {
    const map = mockMap();
    const view = render(<SunHoursLayer map={map as never} />);
    // 렌더가 끝난 뒤에 실패를 주입한다. 렌더 단계에서 터지면 검증하려는 경로가 아니다.
    const boom = new Error('removeLayer failed');
    map.removeLayer.mockImplementationOnce(() => {
      throw boom;
    });

    expect(() => view.unmount()).toThrow(boom);
  });
});
