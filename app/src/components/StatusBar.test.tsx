import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StatusBar } from '@/components/StatusBar';
import { useAppStore } from '@/store/appStore';
import { emptyDatasetState } from '@/types/seoul';
import type { SeoulBuildingFeature } from '@/types/seoul';

const feature = (id: string, height: number): SeoulBuildingFeature => ({
  type: 'Feature',
  properties: {
    id,
    sourceId: null,
    pnu: null,
    name: null,
    address: null,
    useName: null,
    floors: null,
    height,
    heightSource: height > 0 ? 'measured' : 'unknown',
    heightRaw: null,
    sourceDate: '2026-09-09',
  },
  geometry: { type: 'Polygon', coordinates: [[[127, 37.5], [127.001, 37.5], [127.001, 37.501], [127, 37.5]]] },
});

describe('StatusBar', () => {
  beforeEach(() => {
    useAppStore.setState({

      buildings: [
        {
          id: 'a',
          ring: new Float64Array(8),
          baseZ: 0,
          height: 15.75,
          heightSource: 'measured',
          minX: 0,
          minY: 0,
          maxX: 1,
          maxY: 1,
          lngLatPolygon: [],
        },
      ],
      buildingsUnknownHeight: 1,
      seoulBuildings: {
        ...emptyDatasetState<SeoulBuildingFeature>(),
        status: 'ready',
        features: [feature('a', 15.75), feature('b', 0)],
        meta: {
          source: 'GIS건물통합정보',
          synthetic: false,
          featureCount: 2,
          tileCount: 1,
          downloadedAt: '2026-09-18',
          dataDate: '2026-09-09',
          warning: null,
          preparationCounts: null,
          heightMeasuredRatio: 0.439456,
        },
      },
      seoulTrees: { ...emptyDatasetState(), status: 'ready', features: [] },
    });
  });
  afterEach(cleanup);

  it('separates displayed buildings from the analysis subset and shows the source date', () => {
    render(<StatusBar />);
    const status = screen.getByTestId('building-status');
    expect(status).toHaveTextContent('건물 2동');
    expect(status).toHaveTextContent('분석 대상 1동');
    expect(status).toHaveTextContent('높이 미상 1동 제외');
    expect(status).toHaveTextContent('대장높이 채택 43.9%');
    expect(status).toHaveTextContent('기준일 2026-09-09');
  });

  it('states the estimated-ground limits in the integrated view', () => {
    render(<StatusBar />);
    expect(screen.getByTestId('building-status')).toHaveTextContent('정밀 DTM 아님');
  });
});
