/** 배치 위치(적용 시): cpted-sunmap/src/data/facilityLoader.test.ts (전체 교체) */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  deogyangSites,
  mapVisibleCctvPins,
  matchNoteLabel,
  nearestCctvPin,
  visibleCctvSites,
} from '@/data/facilityLoader';
import type { CctvMeta, CctvSite } from '@/types/facility';

// Optional legacy Deogyang data is deliberately not distributed with the Seoul repo.
// Run these source-data regressions locally only when both original outputs exist.
const legacyDataAvailable = existsSync('public/data/facilities/cctv_sites.json')
  && existsSync('public/data/facilities/cctv_sites.meta.json');
const sites = legacyDataAvailable ? JSON.parse(
  readFileSync('public/data/facilities/cctv_sites.json', 'utf8'),
) as CctvSite[] : [];
const meta = legacyDataAvailable ? JSON.parse(
  readFileSync('public/data/facilities/cctv_sites.meta.json', 'utf8'),
) as CctvMeta : {} as CctvMeta;

/** 공공좌표를 자동 적용해서는 안 되는 사유. importer 의 NEVER_AUTO_APPLY 와 같아야 한다. */
const NEVER_AUTO_APPLY = new Set([
  'strong-anomaly',
  'attribute-mismatch',
  'source-location-conflict',
]);

describe.skipIf(!legacyDataAvailable)('cctv generated data (optional legacy dataset)', () => {
  it('matches GPT totals and plate year/camera columns', () => {
    expect(sites).toHaveLength(1800);
    expect(meta.totalCameras).toBe(7549);
    expect(meta.byTable.general).toEqual({ sites: 1753, cameras: 7487 });
    expect(meta.byTable.plate).toEqual({ sites: 47, cameras: 62 });
    expect(meta.filtered.sites).toBe(919);
    expect(meta.filtered.cameras).toBe(3713);
    expect(meta.bell).toEqual({ yes: 871, no: 16, unknown: 32 });
    expect(meta.removed).toBe(5);
    const plate = sites.find((s) => s.sourceId === 'plate-001');
    expect(plate?.tableType).toBe('plate');
    expect(plate?.cameraCount).toBe(2);
    expect(plate?.installYear).toBe(2010);
    expect(plate?.hasEmergencyBell).toBeNull();
  });

  it('keeps duplicate sourceId rows via stableId', () => {
    const dups = sites.filter((s) => s.sourceId === 'SB-6A0');
    expect(dups.length).toBeGreaterThan(1);
    expect(new Set(dups.map((s) => s.stableId)).size).toBe(dups.length);
  });

  it('does not treat road names or stop numbers as jibun', () => {
    // 공공 표준데이터 좌표가 붙은 뒤에도 'PNU 지번 매칭은 실패했다'는 사실이 남아야 한다.
    // 좌표가 생겼다고 해서 지번 매칭이 성공한 것처럼 보이면 안 된다.
    const road = sites.find((s) => s.sourceId === 'S-5945');
    const stop = sites.find((s) => s.sourceId === 'S-5K97');
    for (const s of [road, stop]) {
      expect(s).toBeDefined();
      expect(s?.matchNote).toBe('road-address');
      expect(s?.matchedPnu).toBeNull();
      expect(s?.matchedBuildingId).toBeNull();
      expect(s?.pnuPosition ?? null).toBeNull();
      expect(s?.positionBasis).not.toBe('matchedBuildingCentroid');
    }
  });

  it('attributes road/stop coordinates to the public dataset, not to jibun matching', () => {
    const road = sites.find((s) => s.sourceId === 'S-5945')!;
    const stop = sites.find((s) => s.sourceId === 'S-5K97')!;
    for (const s of [road, stop]) {
      expect(s.position, s.sourceId).not.toBeNull();
      expect(s.positionBasis, s.sourceId).toBe('publicDatasetCoordinate');
      expect(s.locationGrade, s.sourceId).toBe('matched');
      expect(s.publicRef?.manageNo, s.sourceId).toBeTruthy();
      expect(s.publicRef?.baseDate, s.sourceId).toBeTruthy();
      expect(s.matchRule, s.sourceId).toMatch(/^public-standard-dataset:/);
    }
  });

  it('matches large bun-ho parcels and ignores description numbers', () => {
    const a = sites.find((s) => s.sourceId === 'S-5615');
    expect(a?.locationGrade).toBe('matched');
    expect(a?.matchedPnu).toBe('4128110900107650159');
    const desc = sites.find((s) => s.sourceId === 'S-5124');
    expect(desc?.locationGrade).toBe('matched');
    expect(desc?.matchedPnu?.endsWith('05510018')).toBe(true);
  });

  it('translates internal match notes for the UI', () => {
    expect(matchNoteLabel('no-building')).toBe('해당 지번에 건물 자료 없음');
    expect(matchNoteLabel('road-address')).toBe('도로명·정류소번호(지번 아님)');
    expect(matchNoteLabel('동일 지번 복수 건물 12')).toBe('동일 지번 복수 건물 12');
  });

  it('picks the nearest mapped pin within 12px and respects removed filter', () => {
    const a = sites.find((s) => s.sourceId === 'S-5615')!;
    const b = {
      ...a,
      stableId: 'other#r9',
      position: [a.position![0] + 0.01, a.position![1]] as [number, number],
    };
    const removed = { ...a, stableId: 'gone#r1', status: 'removed' as const, position: a.position };
    const project = (ll: [number, number]) =>
      ll[0] === a.position![0] ? { x: 10, y: 10 } : { x: 40, y: 10 };
    expect(nearestCctvPin({ x: 12, y: 10 }, [a, b], project)).toBe(a.stableId);
    expect(nearestCctvPin({ x: 80, y: 10 }, [a, b], project)).toBeNull();
    expect(mapVisibleCctvPins([removed], { showRemoved: false })).toHaveLength(0);
    expect(mapVisibleCctvPins([removed], { showRemoved: true })).toHaveLength(1);
  });

  it('hides removed sites unless asked', () => {
    const deog = deogyangSites(sites);
    const hidden = visibleCctvSites(deog, { showRemoved: false, query: '' });
    const shown = visibleCctvSites(deog, { showRemoved: true, query: '' });
    expect(shown.length - hidden.length).toBe(5);
    expect(hidden.every((s) => s.status !== 'removed')).toBe(true);
  });
});

describe.skipIf(!legacyDataAvailable)('public dataset coordinates (optional legacy dataset)', () => {
  const deog = deogyangSites(sites);

  it('keeps meta.positionSources consistent with the actual records', () => {
    expect(meta.positionSources).toBeDefined();
    const actual = {
      publicDatasetCoordinate: deog.filter(
        (s) => s.positionBasis === 'publicDatasetCoordinate',
      ).length,
      matchedBuildingCentroid: deog.filter(
        (s) => s.positionBasis === 'matchedBuildingCentroid' && s.position,
      ).length,
      none: deog.filter((s) => !s.position).length,
      needsReview: deog.filter((s) => s.reviewFlag).length,
    };
    expect(actual).toEqual(meta.positionSources);
    expect(actual.publicDatasetCoordinate + actual.matchedBuildingCentroid + actual.none).toBe(
      deog.length,
    );
  });

  it('agrees with the importer summary recorded in meta', () => {
    const ps = meta.publicSource!;
    expect(ps).toBeDefined();
    expect(ps.catalogUrl).toBe('https://www.data.go.kr/data/15013094/standard.do');
    expect(ps.fileSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(ps.acceptPurposes).not.toContain('교통단속');
    expect(ps.applied).toBe(meta.positionSources!.publicDatasetCoordinate);
    expect(ps.linked + ps.unresolved).toBe(meta.filtered.sites);
    expect(ps.applied + ps.heldForReview).toBe(ps.linked);
  });

  it('never auto-applies a coordinate that was held for review', () => {
    const wrong = deog.filter(
      (s) => s.reviewFlag && NEVER_AUTO_APPLY.has(s.reviewFlag) &&
        s.positionBasis === 'publicDatasetCoordinate',
    );
    expect(wrong.map((s) => s.sourceId)).toEqual([]);
  });

  it('holds the four strong anomalies and S-5H04 at their building reference point', () => {
    for (const id of ['S-5K05', 'S-5B05', 'S-5111', 'S-5403', 'S-5H04']) {
      const s = deog.find((x) => x.sourceId === id);
      expect(s, id).toBeDefined();
      expect(s!.reviewFlag, id).toBe('strong-anomaly');
      expect(s!.positionBasis, id).not.toBe('publicDatasetCoordinate');
      expect(s!.reviewEvidence, id).toBeTruthy();
    }
  });

  it('flags the seven source-location conflicts even when they had no previous coordinate', () => {
    const ids = ['S-5K11', 'S-5K09', 'S-5137', 'S-5104', 'S-5735', 'SP-5806', 'S-5723'];
    for (const id of ids) {
      const s = deog.find((x) => x.sourceId === id);
      expect(s, id).toBeDefined();
      expect(s!.reviewFlag, id).toBe('source-location-conflict');
      expect(s!.positionBasis, id).not.toBe('publicDatasetCoordinate');
      expect(s!.reviewEvidence, id).toBeTruthy();
    }
  });

  it('leaves ambiguous duplicates unresolved instead of assigning by row order', () => {
    for (const id of ['S-5214', 'S-5215', 'B-5L03', 'B-5L04']) {
      const s = deog.find((x) => x.sourceId === id);
      expect(s, id).toBeDefined();
      expect(s!.reviewFlag, id).toBe('unresolved-ambiguous');
      expect(s!.publicRef ?? null, id).toBeNull();
      expect((s!.reviewCandidateIds ?? []).length, id).toBeGreaterThan(1);
    }
  });

  it('preserves the building reference point wherever a public coordinate was applied', () => {
    const applied = deog.filter((s) => s.positionBasis === 'publicDatasetCoordinate');
    expect(applied.length).toBeGreaterThan(0);
    for (const s of applied) {
      expect(s.publicRef?.manageNo).toBeTruthy();
      expect(s.publicRef?.matchTier === 'exact' || s.publicRef?.matchTier === 'normalized').toBe(
        true,
      );
      // pnuPosition 은 null 일 수 있으나(원래 미매칭), 키 자체는 기록되어 추적이 가능해야 한다.
      expect('pnuPosition' in s).toBe(true);
    }
  });

  it('never invents a coordinate for an unresolved site', () => {
    const invented = deog.filter(
      (s) => s.reviewFlag?.startsWith('unresolved') && s.positionBasis === 'publicDatasetCoordinate',
    );
    expect(invented.map((s) => s.sourceId)).toEqual([]);
  });

  it('leaves other districts untouched by the importer', () => {
    const others = sites.filter((s) => s.gu !== '덕양구');
    expect(others.length).toBeGreaterThan(0);
    for (const s of others) {
      expect('publicRef' in s).toBe(false);
      expect('reviewFlag' in s).toBe(false);
      expect('pnuPosition' in s).toBe(false);
    }
  });

  it('keeps the pre-import PNU aggregate for comparison', () => {
    expect(meta.legacyPnuMatch?.matched).toBe(424);
    expect(meta.legacyPnuMatch?.unmatched).toBe(495);
    expect(meta.match.matched).toBeGreaterThan(meta.legacyPnuMatch!.matched);
  });

  it('states in meta that the coordinates were not field-verified', () => {
    // 부정문(\"검증된 것은 아니다\")까지 금지하면 안 된다. 미검증 사실이 적혀 있는지를 본다.
    const note = meta.publicSource!.note;
    expect(note).toContain('현장 대조');
    expect(note).toMatch(/검증(된 것은 아니|하지 않)/);
    expect(meta.warning).toContain('현장 대조로 검증하지 않았습니다');
  });
});
