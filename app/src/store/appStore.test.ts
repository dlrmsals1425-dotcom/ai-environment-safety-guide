import { beforeEach, describe, expect, it } from 'vitest';
import { squareBboxAround } from '@/geo/aoi';
import { useAppStore } from '@/store/appStore';

const ILSAN = { lat: 37.658, lon: 126.832 };

function resetStore() {
  useAppStore.setState({
    aoi: null,
    origin: null,
    date: new Date(2026, 8, 16),
    timeMinutes: 720,
    aoiDrawMode: false,
    aoiWarning: null,
    viewCenter: { ...ILSAN },
    buildings: [],
    buildingMeta: null,
    dataIsSynthetic: false,
    buildingLoadSeq: 0,
    sunHours: null,
    sunHoursSpec: null,
    sunHoursMeta: null,
    sunHoursProgress: 0,
    sunHoursRunning: false,
    sunHoursError: null,
    sunHoursSeq: 0,
  });
}

function seedSunHours() {
  const spec = { originX: 0, originY: 0, cellSize: 4, nx: 126, ny: 126 };
  const hours = new Float32Array(126 * 126);
  hours[0] = 3.5;
  useAppStore.getState().applySunHoursResult(useAppStore.getState().sunHoursSeq, hours, spec, {
    elapsedMs: 1200,
    workerCount: 1,
    timeSteps: 40,
    cellSize: 4,
    stepMinutes: 10,
    z0: 0,
    minAltDeg: 0,
    nx: 126,
    ny: 126,
    buildingCount: 43,
    aoiWidthM: 500,
    aoiHeightM: 500,
  });
}

describe('appStore', () => {
  beforeEach(resetStore);

  it('switches daily results to ground shadows when the time slider moves, preserving the result', () => {
    seedSunHours();
    const hours = useAppStore.getState().sunHours;
    expect(useAppStore.getState().layers.sunHours).toBe(true);
    expect(useAppStore.getState().layers.realtimeShadow).toBe(false);
    useAppStore.getState().setTimeMinutes(850);
    expect(useAppStore.getState().layers.sunHours).toBe(false);
    expect(useAppStore.getState().layers.realtimeShadow).toBe(true);
    expect(useAppStore.getState().sunHours).toBe(hours);
  });

  it('never shows a checked ground-shadow control while daily hours hide that layer', () => {
    useAppStore.getState().setLayerVisible('sunHours', true);
    expect(useAppStore.getState().layers.realtimeShadow).toBe(false);
    useAppStore.getState().setLayerVisible('realtimeShadow', true);
    expect(useAppStore.getState().layers.sunHours).toBe(false);
    useAppStore.getState().setLayerVisible('sunHours', true);
    useAppStore.getState().setLayerVisible('sunHours', false);
    expect(useAppStore.getState().layers.realtimeShadow).toBe(true);
  });

  it('setTimeMinutes updates 0–1439', () => {
    useAppStore.getState().setTimeMinutes(600);
    expect(useAppStore.getState().timeMinutes).toBe(600);
    useAppStore.getState().setTimeMinutes(-10);
    expect(useAppStore.getState().timeMinutes).toBe(0);
    useAppStore.getState().setTimeMinutes(2000);
    expect(useAppStore.getState().timeMinutes).toBe(1439);
  });

  it('date presets keep year and change month/day', () => {
    useAppStore.getState().setDatePreset('dongji');
    let d = useAppStore.getState().date;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(21);

    useAppStore.getState().setDatePreset('chunbun');
    d = useAppStore.getState().date;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(20);

    useAppStore.getState().setDatePreset('haji');
    d = useAppStore.getState().date;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(21);

    useAppStore.getState().setDatePreset('chubun');
    d = useAppStore.getState().date;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(22);
  });

  it('confirmAoi writes bbox and origin as bbox center', () => {
    const bbox = squareBboxAround(
      { lat0: ILSAN.lat, lon0: ILSAN.lon },
      500,
    );
    const ok = useAppStore.getState().confirmAoi(bbox);
    expect(ok).toBe(true);
    const { aoi, origin, aoiWarning } = useAppStore.getState();
    expect(aoi?.bbox).toEqual(bbox);
    expect(origin).not.toBeNull();
    expect(origin!.lat0).toBeCloseTo((bbox[1] + bbox[3]) / 2, 10);
    expect(origin!.lon0).toBeCloseTo((bbox[0] + bbox[2]) / 2, 10);
    expect(origin!.lat0).toBeCloseTo(ILSAN.lat, 10);
    expect(origin!.lon0).toBeCloseTo(ILSAN.lon, 10);
    expect(aoiWarning).toBeNull();
  });

  it('oversized AOI sets a warning and does not replace bbox/origin', () => {
    const good = squareBboxAround({ lat0: ILSAN.lat, lon0: ILSAN.lon }, 500);
    useAppStore.getState().confirmAoi(good);

    const over = squareBboxAround({ lat0: ILSAN.lat, lon0: ILSAN.lon }, 1600);
    const ok = useAppStore.getState().confirmAoi(over);
    expect(ok).toBe(false);
    const { aoi, origin, aoiWarning } = useAppStore.getState();
    expect(aoi?.bbox).toEqual(good);
    expect(origin!.lat0).toBeCloseTo(ILSAN.lat, 10);
    expect(aoiWarning).toMatch(/1,500m|1500m/);
  });

  it('placeDefaultAoi uses viewCenter as origin (not a stale map default)', () => {
    useAppStore.getState().setViewCenter({ lat: 37.66, lon: 126.84 });
    const ok = useAppStore.getState().placeDefaultAoi();
    expect(ok).toBe(true);
    const { origin, aoi } = useAppStore.getState();
    expect(origin!.lat0).toBeCloseTo(37.66, 8);
    expect(origin!.lon0).toBeCloseTo(126.84, 8);
    expect(aoi).not.toBeNull();
  });

  it('maps meta.synthetic onto dataIsSynthetic', () => {
    const seq = useAppStore.getState().beginBuildingLoad();
    const ok = useAppStore.getState().applyBuildingLoad(seq, {
      buildings: [],
      meta: {
        source: '합성 데모 데이터',
        synthetic: true,
        downloadedAt: null,
        featureCount: 0,
      },
    });
    expect(ok).toBe(true);
    expect(useAppStore.getState().dataIsSynthetic).toBe(true);
  });

  it('ignores stale building loads after a newer AOI request', () => {
    const first = useAppStore.getState().beginBuildingLoad();
    const second = useAppStore.getState().beginBuildingLoad();
    const stale = useAppStore.getState().applyBuildingLoad(first, {
      buildings: [
        {
          id: 'old',
          ring: new Float64Array(8),
          baseZ: 0,
          height: 10,
          heightSource: 'synthetic',
          minX: 0,
          minY: 0,
          maxX: 1,
          maxY: 1,
          lngLatPolygon: [],
        },
      ],
      meta: {
        source: 'stale',
        synthetic: true,
        downloadedAt: null,
        featureCount: 1,
      },
    });
    const fresh = useAppStore.getState().applyBuildingLoad(second, {
      buildings: [],
      meta: {
        source: 'fresh',
        synthetic: false,
        downloadedAt: null,
        featureCount: 0,
      },
    });
    expect(stale).toBe(false);
    expect(fresh).toBe(true);
    expect(useAppStore.getState().buildings).toEqual([]);
    expect(useAppStore.getState().dataIsSynthetic).toBe(false);
    expect(useAppStore.getState().buildingMeta?.source).toBe('fresh');
  });

  it('clears sun hours when date, AOI, or buildings change', () => {
    seedSunHours();
    expect(useAppStore.getState().sunHours).not.toBeNull();
    useAppStore.getState().setDatePreset('dongji');
    expect(useAppStore.getState().sunHours).toBeNull();
    expect(useAppStore.getState().sunHoursSpec).toBeNull();
    expect(useAppStore.getState().layers.sunHours).toBe(false);

    seedSunHours();
    const bbox = squareBboxAround({ lat0: ILSAN.lat, lon0: ILSAN.lon }, 500);
    useAppStore.getState().confirmAoi(bbox);
    expect(useAppStore.getState().sunHours).toBeNull();

    seedSunHours();
    useAppStore.getState().clearAoi();
    expect(useAppStore.getState().sunHours).toBeNull();

    seedSunHours();
    const seq = useAppStore.getState().beginBuildingLoad();
    useAppStore.getState().applyBuildingLoad(seq, {
      buildings: [],
      meta: {
        source: 'x',
        synthetic: true,
        downloadedAt: null,
        featureCount: 0,
      },
    });
    expect(useAppStore.getState().sunHours).toBeNull();
  });

  it('does not clear sun hours on oversized AOI reject', () => {
    const good = squareBboxAround({ lat0: ILSAN.lat, lon0: ILSAN.lon }, 500);
    useAppStore.getState().confirmAoi(good);
    seedSunHours();
    const over = squareBboxAround({ lat0: ILSAN.lat, lon0: ILSAN.lon }, 1600);
    expect(useAppStore.getState().confirmAoi(over)).toBe(false);
    expect(useAppStore.getState().sunHours).not.toBeNull();
  });

  it('ignores stale sun-hours progress and results', () => {
    const first = useAppStore.getState().beginSunHoursLoad();
    const second = useAppStore.getState().beginSunHoursLoad();
    const spec = { originX: 0, originY: 0, cellSize: 4, nx: 2, ny: 2 };
    expect(useAppStore.getState().applySunHoursProgress(first, 0.9)).toBe(false);
    expect(
      useAppStore.getState().applySunHoursResult(first, new Float32Array(4), spec, {
        elapsedMs: 9,
        workerCount: 1,
        timeSteps: 1,
        cellSize: 4,
        stepMinutes: 10,
        z0: 0,
        minAltDeg: 0,
        nx: 2,
        ny: 2,
        buildingCount: 1,
        aoiWidthM: 80,
        aoiHeightM: 80,
      }),
    ).toBe(false);
    expect(useAppStore.getState().sunHours).toBeNull();
    expect(
      useAppStore.getState().applySunHoursResult(second, new Float32Array([1, 0, 0, 0]), spec, {
        elapsedMs: 50,
        workerCount: 2,
        timeSteps: 8,
        cellSize: 4,
        stepMinutes: 10,
        z0: 0,
        minAltDeg: 0,
        nx: 2,
        ny: 2,
        buildingCount: 1,
        aoiWidthM: 80,
        aoiHeightM: 80,
      }),
    ).toBe(true);
    expect(useAppStore.getState().sunHours?.[0]).toBe(1);
    expect(useAppStore.getState().sunHoursMeta?.workerCount).toBe(2);
  });

  it('discards a late geocode result after A→B→A selection', () => {
    useAppStore.setState({
      cctvSites: [
        {
          stableId: 'A#r1',
          sourceId: 'A',
          sourceRow: 1,
          tableType: 'general',
          gu: '덕양구',
          dong: '주교동',
          placeText: '주교동 1',
          cameraCount: 1,
          hasEmergencyBell: false,
          installYear: 2010,
          status: 'active',
          locationGrade: 'unmatched',
          position: null,
          positionBasis: null,
          matchRule: null,
          matchedPnu: null,
          matchedBuildingId: null,
          matchNote: null,
        },
        {
          stableId: 'B#r2',
          sourceId: 'B',
          sourceRow: 2,
          tableType: 'general',
          gu: '덕양구',
          dong: '주교동',
          placeText: '주교동 2',
          cameraCount: 1,
          hasEmergencyBell: false,
          installYear: 2010,
          status: 'active',
          locationGrade: 'unmatched',
          position: null,
          positionBasis: null,
          matchRule: null,
          matchedPnu: null,
          matchedBuildingId: null,
          matchNote: null,
        },
      ],
    });
    useAppStore.getState().selectCctv('A#r1');
    const first = useAppStore.getState().beginCctvLiveLookup();
    useAppStore.getState().selectCctv('B#r2');
    useAppStore.getState().selectCctv('A#r1');
    expect(
      useAppStore.getState().applyCctvLiveResult(first, [
        {
          roadAddress: '경기도 고양시 덕양구 주교동 1',
          jibunAddress: '',
          lng: 126.83,
          lat: 37.65,
          inDeogyang: true,
        },
      ]),
    ).toBe(false);
    expect(useAppStore.getState().cctvLiveCandidates).toEqual([]);
    expect(
      useAppStore.getState().chooseCctvLiveCandidate({
        roadAddress: '경기도 고양시 일산동구 장항동 1',
        jibunAddress: '',
        lng: 126.77,
        lat: 37.66,
        inDeogyang: false,
      }),
    ).toBe(false);
  });

  it('requestViewAround sets 500m AOI and fly target', () => {
    const ok = useAppStore.getState().requestViewAround(126.84, 37.66);
    expect(ok).toBe(true);
    const { viewAround, aoi } = useAppStore.getState();
    expect(viewAround?.lng).toBe(126.84);
    expect(viewAround?.lat).toBe(37.66);
    expect(aoi).not.toBeNull();
  });
});
