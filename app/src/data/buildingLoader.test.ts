import { afterEach, describe, expect, it, vi } from 'vitest';
import { squareBboxAround } from '@/geo/aoi';
import {
  buildingsFromGeoJson,
  bytesMatchSource,
  isHtmlContentType,
  isLoaderPublicUrl,
  loadBuildings,
  resolveBuildingSource,
  setFlatGeobufDeserialize,
  type GeoJsonFC,
} from '@/data/buildingLoader';

const FGB_MAGIC = new Uint8Array([0x66, 0x67, 0x62, 0x03, 0, 0, 0, 0]);
const JSON_HEAD = new TextEncoder().encode('{"type":"FeatureCollection"}');
const HTML_HEAD = new TextEncoder().encode('<!DOCTYPE html><html><body>spa</body></html>');

function mockRes(opts: {
  ok?: boolean;
  status?: number;
  contentType?: string | null;
  body?: Uint8Array;
}) {
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    headers: {
      get: (key: string) =>
        key.toLowerCase() === 'content-type' ? (opts.contentType ?? null) : null,
    },
    arrayBuffer: async () => (opts.body ?? new Uint8Array()).buffer,
  };
}

const ORIGIN = { lat0: 37.658, lon0: 126.832 };
const AOI = squareBboxAround(ORIGIN, 500);

function square(lon: number, lat: number, d = 0.00025): number[][][] {
  return [
    [
      [lon, lat],
      [lon + d, lat],
      [lon + d, lat + d],
      [lon, lat + d],
      [lon, lat],
    ],
  ];
}

describe('buildingLoader', () => {
  afterEach(() => {
    setFlatGeobufDeserialize(null);
  });

  it('converts GeoJSON to Building[] with ENU ring and AABB', () => {
    const fc: GeoJsonFC = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: 'a', GRND_FLR: 3, USE_NAME: '단독주택' },
          geometry: { type: 'Polygon', coordinates: square(126.832, 37.658) },
        },
      ],
    };
    const buildings = buildingsFromGeoJson(fc, ORIGIN, AOI);
    expect(buildings).toHaveLength(1);
    expect(buildings[0].ring).toBeInstanceOf(Float64Array);
    expect(buildings[0].ring.length).toBeGreaterThanOrEqual(8);
    expect(buildings[0].minX).toBeLessThan(buildings[0].maxX);
    expect(buildings[0].minY).toBeLessThan(buildings[0].maxY);
    expect(buildings[0].lngLatPolygon[0].length).toBeGreaterThanOrEqual(4);
  });

  it('honors GIS heightSource estimated vs measured from preprocessed GeoJSON', () => {
    const fc: GeoJsonFC = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            id: 'est',
            floors: 1,
            useName: '단독주택',
            height: 4.2,
            heightSource: 'estimated',
          },
          geometry: { type: 'Polygon', coordinates: square(126.832, 37.658) },
        },
        {
          type: 'Feature',
          properties: {
            id: 'meas',
            floors: 9,
            useName: '업무시설',
            height: 39.95,
            heightSource: 'measured',
          },
          geometry: { type: 'Polygon', coordinates: square(126.8322, 37.6582) },
        },
      ],
    };
    const buildings = buildingsFromGeoJson(fc, ORIGIN, AOI);
    const est = buildings.find((b) => b.id === 'est');
    const meas = buildings.find((b) => b.id === 'meas');
    expect(est?.heightSource).toBe('estimated');
    expect(est?.height).toBe(4.2);
    expect(meas?.heightSource).toBe('measured');
    expect(meas?.height).toBe(39.95);
  });

  it('5-storey 공동주택 with missing HEIGHT has height 15.75', () => {
    const fc: GeoJsonFC = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { GRND_FLR: 5, USE_NAME: '공동주택' },
          geometry: { type: 'Polygon', coordinates: square(126.832, 37.658) },
        },
      ],
    };
    const [b] = buildingsFromGeoJson(fc, ORIGIN, AOI);
    expect(b.height).toBe(15.75);
    expect(b.heightSource).toBe('estimated');
  });

  it('explodes MultiPolygon into one building per polygon', () => {
    const fc: GeoJsonFC = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: 'm', GRND_FLR: 4, USE_NAME: '단독주택' },
          geometry: {
            type: 'MultiPolygon',
            coordinates: [
              square(126.8318, 37.6578),
              square(126.8324, 37.6581),
            ],
          },
        },
      ],
    };
    const buildings = buildingsFromGeoJson(fc, ORIGIN, AOI);
    expect(buildings).toHaveLength(2);
    expect(buildings.map((b) => b.id).sort()).toEqual(['m-0', 'm-1']);
  });

  it('drops buildings outside AOI + 300m buffer', () => {
    const fc: GeoJsonFC = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: 'in', GRND_FLR: 4, USE_NAME: '단독주택' },
          geometry: { type: 'Polygon', coordinates: square(126.832, 37.658) },
        },
        {
          type: 'Feature',
          properties: { id: 'out', GRND_FLR: 8, USE_NAME: '업무시설' },
          geometry: { type: 'Polygon', coordinates: square(126.86, 37.69) },
        },
      ],
    };
    const buildings = buildingsFromGeoJson(fc, ORIGIN, AOI);
    expect(buildings.map((b) => b.id)).toEqual(['in']);
  });

  it('loadBuildings maps meta.synthetic and uses injected FlatGeobuf deserialize', async () => {
    const fc: GeoJsonFC = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            id: 's',
            floors: 4,
            useName: '단독주택',
            heightSource: 'synthetic',
            height: 13.8,
          },
          geometry: { type: 'Polygon', coordinates: square(126.832, 37.658) },
        },
      ],
    };
    setFlatGeobufDeserialize(async () => fc.features);
    const fetchMock = async (url: string) => {
      if (String(url).endsWith('.meta.json')) {
        return {
          ok: true,
          json: async () => ({
            source: '합성 데모 데이터',
            synthetic: true,
            downloadedAt: null,
            featureCount: 1,
          }),
        };
      }
      throw new Error(`unexpected ${url}`);
    };
    vi.stubGlobal('fetch', fetchMock);

    const result = await loadBuildings({
      source: {
        type: 'flatgeobuf',
        url: '/data/demo/fake.fgb',
        metaUrl: '/data/demo/fake.meta.json',
      },
      origin: ORIGIN,
      aoiBbox: AOI,
    });
    expect(result.meta.synthetic).toBe(true);
    expect(result.buildings).toHaveLength(1);
    expect(result.buildings[0].heightSource).toBe('synthetic');
    vi.unstubAllGlobals();
  });

  it('resolveBuildingSource prefers a real FGB/GeoJSON when the file exists', async () => {
    vi.stubGlobal(
      'fetch',
      async (url: string, init?: { method?: string }) => {
        const u = String(url);
        if (u.endsWith('/data/buildings.fgb')) {
          if (init?.method === 'HEAD') {
            return mockRes({ contentType: 'application/octet-stream' });
          }
          return mockRes({ contentType: 'application/octet-stream', body: FGB_MAGIC });
        }
        return { ok: false, status: 404, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) };
      },
    );
    const source = await resolveBuildingSource({
      buildings: {
        type: 'geojson',
        url: '/data/demo/buildings_demo.geojson',
      },
      buildingsRealCandidates: [
        { type: 'flatgeobuf', url: '/data/buildings.fgb' },
        { type: 'geojson', url: '/data/buildings.geojson' },
      ],
    });
    expect(source.url).toBe('/data/buildings.fgb');
    vi.unstubAllGlobals();
  });

  it('skips missing FGB when Vite SPA fallback returns 200 text/html and uses GeoJSON', async () => {
    expect(isHtmlContentType('text/html; charset=utf-8')).toBe(true);
    expect(bytesMatchSource(HTML_HEAD, 'flatgeobuf')).toBe(false);
    expect(bytesMatchSource(JSON_HEAD, 'geojson')).toBe(true);
    vi.stubGlobal(
      'fetch',
      async (url: string, init?: { method?: string }) => {
        const u = String(url);
        if (u.endsWith('/data/buildings.fgb')) {
          return mockRes({ contentType: 'text/html', body: HTML_HEAD });
        }
        if (u.endsWith('/data/buildings.geojson') || u.endsWith('/data/buildings.meta.json')) {
          if (init?.method === 'HEAD') {
            return mockRes({ contentType: 'application/json' });
          }
          return mockRes({ contentType: 'application/json', body: JSON_HEAD });
        }
        return { ok: false, status: 404, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) };
      },
    );
    const source = await resolveBuildingSource({
      buildings: {
        type: 'geojson',
        url: '/data/demo/buildings_demo.geojson',
      },
      buildingsRealCandidates: [
        { type: 'flatgeobuf', url: '/data/buildings.fgb', metaUrl: '/data/buildings.meta.json' },
        { type: 'geojson', url: '/data/buildings.geojson', metaUrl: '/data/buildings.meta.json' },
      ],
    });
    expect(source.type).toBe('geojson');
    expect(source.url).toBe('/data/buildings.geojson');
    vi.unstubAllGlobals();
  });

  it('rejects Range fallback that is HTML even when HEAD omitted a content-type', async () => {
    vi.stubGlobal(
      'fetch',
      async (_url: string, init?: { method?: string }) => {
        if (init?.method === 'HEAD') {
          return mockRes({ contentType: null });
        }
        return mockRes({ status: 206, ok: true, contentType: 'text/html', body: HTML_HEAD });
      },
    );
    const source = await resolveBuildingSource({
      buildings: { type: 'geojson', url: '/data/demo/buildings_demo.geojson' },
      buildingsRealCandidates: [{ type: 'flatgeobuf', url: '/data/buildings.fgb' }],
    });
    expect(source.url).toBe('/data/demo/buildings_demo.geojson');
    vi.unstubAllGlobals();
  });

  it('resolveBuildingSource falls back to the synthetic demo when no real file exists', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: false,
      status: 404,
      headers: { get: () => null },
      arrayBuffer: async () => new ArrayBuffer(0),
    }));
    const source = await resolveBuildingSource({
      buildings: {
        type: 'geojson',
        url: '/data/demo/buildings_demo.geojson',
        metaUrl: '/data/demo/buildings_demo.meta.json',
      },
      buildingsRealCandidates: [{ type: 'geojson', url: '/data/buildings.geojson' }],
    });
    expect(source.url).toBe('/data/demo/buildings_demo.geojson');
    vi.unstubAllGlobals();
  });

  it('does not use staging/partial files and requires meta before switching off demo', async () => {
    expect(isLoaderPublicUrl('/data/staging/buildings.geojson.part')).toBe(false);
    expect(isLoaderPublicUrl('/data/buildings.geojson')).toBe(true);
    vi.stubGlobal(
      'fetch',
      async (url: string) => {
        const u = String(url);
        if (u.includes('staging') || u.endsWith('.part')) {
          return mockRes({ contentType: 'application/json', body: JSON_HEAD });
        }
        if (u.endsWith('/data/buildings.geojson')) {
          return mockRes({ contentType: 'application/json', body: JSON_HEAD });
        }
        return { ok: false, status: 404, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) };
      },
    );
    const source = await resolveBuildingSource({
      buildings: {
        type: 'geojson',
        url: '/data/demo/buildings_demo.geojson',
      },
      buildingsRealCandidates: [
        { type: 'geojson', url: '/data/staging/buildings.geojson.part' },
        {
          type: 'geojson',
          url: '/data/buildings.geojson',
          metaUrl: '/data/buildings.meta.json',
        },
      ],
    });
    expect(source.url).toBe('/data/demo/buildings_demo.geojson');
    vi.unstubAllGlobals();
  });
});
