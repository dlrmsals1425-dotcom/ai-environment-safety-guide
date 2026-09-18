/**
 * 배치 위치(적용 시): cpted-sunmap/src/facility/positionSource.ts  (신규 파일)
 *
 * 좌표 출처와 검토 상태를 한 곳에서 판정한다.
 * 패널·레이어·테스트가 모두 이 모듈만 참조해 표기가 어긋나지 않게 한다.
 *
 * 원칙: 공공 제공 좌표와 건물 기준점(참고)을 절대 같은 것처럼 보이게 하지 않는다.
 *       어느 쪽도 현장 대조로 검증하지 않았다.
 */
import type { CctvReviewFlag, CctvSite } from '@/types/facility';

export type PositionSourceKind =
  | 'public' // 공공 표준데이터 제공 좌표
  | 'building' // PNU 지번으로 찾은 건물 기준점(참고)
  | 'none'; // 좌표 없음

export type PositionBadge = {
  kind: PositionSourceKind;
  needsReview: boolean;
  label: string;
  className: string;
};

/** 좌표 출처. reviewFlag 와 무관하게 '지금 position 이 무엇인가'만 본다. */
export function positionSourceKind(site: CctvSite): PositionSourceKind {
  if (!site.position) return 'none';
  return site.positionBasis === 'publicDatasetCoordinate' ? 'public' : 'building';
}

export function needsReview(site: CctvSite): boolean {
  return site.reviewFlag != null;
}

/** 목록 배지. 검토 필요는 출처보다 우선해 표시한다. */
export function positionBadge(site: CctvSite): PositionBadge {
  const kind = positionSourceKind(site);
  const review = needsReview(site);
  if (review) {
    return { kind, needsReview: true, label: '검토필요', className: 'badge-review' };
  }
  if (kind === 'public') {
    return { kind, needsReview: false, label: '공공좌표', className: 'badge-public' };
  }
  if (kind === 'building') {
    return { kind, needsReview: false, label: '건물참고', className: 'badge-matched' };
  }
  return { kind, needsReview: false, label: '위치없음', className: 'badge-unmatched' };
}

export function positionSourceLabel(site: CctvSite): string {
  switch (positionSourceKind(site)) {
    case 'public':
      return '전국 CCTV 표준데이터 제공 좌표';
    case 'building':
      return 'PNU 지번 매칭 건물 기준점(참고 위치)';
    default:
      return '없음';
  }
}

export function reviewFlagLabel(flag: NonNullable<CctvReviewFlag>): string {
  switch (flag) {
    case 'strong-anomaly':
      return '위치 이상 — 자동 적용 금지';
    case 'source-location-conflict':
      return '원본 주소와 공공좌표 위치 상충';
    case 'large-shift':
      return '종전 기준점과 500m 초과 차이';
    case 'attribute-mismatch':
      return '카메라 대수·설치연도 불일치';
    case 'unresolved-ambiguous':
      return '후보 복수 — 행 순서로 배정하지 않음';
    case 'unresolved-no-candidate':
      return '주소 일치 후보 없음';
  }
}

/** 검토 사유 + 근거 + 거리. 근거가 없으면 만들어내지 않는다. */
export function reviewSummary(site: CctvSite): string | null {
  if (!site.reviewFlag) return null;
  const parts = [reviewFlagLabel(site.reviewFlag)];
  if (site.reviewEvidence) parts.push(site.reviewEvidence);
  else if (site.reviewDistanceM != null) {
    parts.push(`종전 기준점과 ${Math.round(site.reviewDistanceM).toLocaleString('ko-KR')}m`);
  }
  return parts.join(' · ');
}

/** 3D 폴·핀 색상. 출처가 화면에서 구분되어야 한다. */
export function positionSourceColor(
  site: CctvSite,
): [number, number, number, number] {
  if (site.status === 'removed') return [140, 140, 140, 90];
  if (needsReview(site)) return [206, 128, 46, 235]; // 검토필요 — 주황
  if (positionSourceKind(site) === 'public') {
    return site.tableType === 'plate' ? [120, 180, 96, 235] : [64, 176, 128, 235]; // 공공 — 녹
  }
  if (site.tableType === 'plate') return [196, 148, 52, 230];
  return [72, 158, 196, 230]; // 건물 참고 — 청
}

export type PositionSourceCounts = {
  public: number;
  building: number;
  none: number;
  needsReview: number;
};

/** 화면 집계. meta.positionSources 와 반드시 일치해야 한다. */
export function countPositionSources(sites: CctvSite[]): PositionSourceCounts {
  const out: PositionSourceCounts = { public: 0, building: 0, none: 0, needsReview: 0 };
  for (const s of sites) {
    const kind = positionSourceKind(s);
    if (kind === 'public') out.public += 1;
    else if (kind === 'building') out.building += 1;
    else out.none += 1;
    if (needsReview(s)) out.needsReview += 1;
  }
  return out;
}
