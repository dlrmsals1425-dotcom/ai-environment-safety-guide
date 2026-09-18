/** 배치 위치(적용 시): cpted-sunmap/src/facility/positionSource.test.ts (신규) */
import { describe, expect, it } from 'vitest';
import {
  countPositionSources,
  needsReview,
  positionBadge,
  positionSourceColor,
  positionSourceKind,
  positionSourceLabel,
  reviewFlagLabel,
  reviewSummary,
} from '@/facility/positionSource';
import type { CctvReviewFlag, CctvSite } from '@/types/facility';

function site(over: Partial<CctvSite> = {}): CctvSite {
  return {
    stableId: 'X#r1',
    sourceId: 'X',
    sourceRow: 1,
    tableType: 'general',
    gu: '덕양구',
    dong: '주교동',
    placeText: '주교동 1',
    cameraCount: 1,
    hasEmergencyBell: null,
    installYear: 2016,
    status: 'active',
    locationGrade: 'unmatched',
    position: null,
    positionBasis: null,
    matchRule: null,
    matchedPnu: null,
    matchedBuildingId: null,
    matchNote: null,
    ...over,
  };
}

const publicSite = site({
  locationGrade: 'matched',
  position: [126.83, 37.65],
  positionBasis: 'publicDatasetCoordinate',
});
const buildingSite = site({
  locationGrade: 'matched',
  position: [126.84, 37.66],
  positionBasis: 'matchedBuildingCentroid',
});

describe('positionSourceKind', () => {
  it('separates public dataset coordinates from building reference points', () => {
    expect(positionSourceKind(publicSite)).toBe('public');
    expect(positionSourceKind(buildingSite)).toBe('building');
    expect(positionSourceKind(site())).toBe('none');
  });

  it('treats a missing position as none even if basis is set', () => {
    expect(positionSourceKind(site({ positionBasis: 'publicDatasetCoordinate' }))).toBe('none');
  });
});

describe('positionBadge', () => {
  it('labels each source distinctly', () => {
    expect(positionBadge(publicSite).label).toBe('공공좌표');
    expect(positionBadge(buildingSite).label).toBe('건물참고');
    expect(positionBadge(site()).label).toBe('위치없음');
  });

  it('gives review priority over source so a held site never looks confirmed', () => {
    const held = { ...publicSite, reviewFlag: 'large-shift' as CctvReviewFlag };
    const badge = positionBadge(held);
    expect(badge.label).toBe('검토필요');
    expect(badge.className).toBe('badge-review');
    expect(badge.kind).toBe('public'); // 출처 자체는 보존
  });

  it('uses distinct class names per source', () => {
    expect(positionBadge(publicSite).className).toBe('badge-public');
    expect(positionBadge(buildingSite).className).toBe('badge-matched');
    expect(positionBadge(site()).className).toBe('badge-unmatched');
  });
});

describe('positionSourceLabel', () => {
  it('never presents either source as a surveyed installation point', () => {
    expect(positionSourceLabel(publicSite)).toBe('전국 CCTV 표준데이터 제공 좌표');
    expect(positionSourceLabel(buildingSite)).toContain('참고 위치');
    expect(positionSourceLabel(site())).toBe('없음');
  });
});

describe('reviewFlagLabel', () => {
  it('distinguishes every review reason', () => {
    const flags: NonNullable<CctvReviewFlag>[] = [
      'strong-anomaly',
      'source-location-conflict',
      'large-shift',
      'attribute-mismatch',
      'unresolved-ambiguous',
      'unresolved-no-candidate',
    ];
    const labels = flags.map(reviewFlagLabel);
    expect(new Set(labels).size).toBe(flags.length);
    expect(reviewFlagLabel('unresolved-ambiguous')).toContain('행 순서로 배정하지 않음');
  });
});

describe('reviewSummary', () => {
  it('returns null when no review is needed', () => {
    expect(reviewSummary(publicSite)).toBeNull();
    expect(needsReview(publicSite)).toBe(false);
  });

  it('prefers the stored evidence sentence', () => {
    const s = {
      ...publicSite,
      reviewFlag: 'source-location-conflict' as CctvReviewFlag,
      reviewEvidence: '향동 법정동 건물군에서 약 14.2km 떨어짐 — 추가 검토 필요',
    };
    expect(reviewSummary(s)).toContain('14.2km');
    expect(reviewSummary(s)).toContain('원본 주소와 공공좌표 위치 상충');
  });

  it('falls back to distance and never invents a reason', () => {
    const s = {
      ...publicSite,
      reviewFlag: 'large-shift' as CctvReviewFlag,
      reviewEvidence: null,
      reviewDistanceM: 806.4,
    };
    expect(reviewSummary(s)).toContain('806m');

    const bare = { ...publicSite, reviewFlag: 'large-shift' as CctvReviewFlag };
    expect(reviewSummary(bare)).toBe('종전 기준점과 500m 초과 차이');
  });
});

describe('positionSourceColor', () => {
  it('uses a different colour for each source so the legend is truthful', () => {
    expect(positionSourceColor(publicSite)).not.toEqual(positionSourceColor(buildingSite));
  });

  it('marks review-needed sites regardless of source', () => {
    const held = { ...publicSite, reviewFlag: 'strong-anomaly' as CctvReviewFlag };
    expect(positionSourceColor(held)).toEqual([206, 128, 46, 235]);
    expect(positionSourceColor(held)).not.toEqual(positionSourceColor(publicSite));
  });

  it('greys out removed sites first', () => {
    const removed = { ...publicSite, status: 'removed' as const };
    expect(positionSourceColor(removed)).toEqual([140, 140, 140, 90]);
  });

  it('distinguishes plate cameras within the same source', () => {
    const plate = { ...publicSite, tableType: 'plate' as const };
    expect(positionSourceColor(plate)).not.toEqual(positionSourceColor(publicSite));
  });
});

describe('countPositionSources', () => {
  it('keeps source buckets exclusive and counts review across them', () => {
    const counts = countPositionSources([
      publicSite,
      { ...publicSite, reviewFlag: 'large-shift' as CctvReviewFlag },
      buildingSite,
      site(),
      { ...site(), reviewFlag: 'unresolved-no-candidate' as CctvReviewFlag },
    ]);
    expect(counts.public).toBe(2);
    expect(counts.building).toBe(1);
    expect(counts.none).toBe(2);
    expect(counts.public + counts.building + counts.none).toBe(5);
    expect(counts.needsReview).toBe(2); // 배타적 버킷을 가로지른다
  });
});
