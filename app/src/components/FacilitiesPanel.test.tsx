/** 배치 위치(적용 시): cpted-sunmap/src/components/FacilitiesPanel.test.tsx (전체 교체) */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FacilitiesPanel } from '@/components/FacilitiesPanel';
import { useAppStore } from '@/store/appStore';
import type { CctvMeta, CctvSite } from '@/types/facility';

const sites: CctvSite[] = [
  {
    stableId: 'S-5615#r1',
    sourceId: 'S-5615',
    sourceRow: 1,
    tableType: 'general',
    gu: '덕양구',
    dong: '지축동',
    placeText: '지축동765-159',
    cameraCount: 3,
    hasEmergencyBell: true,
    installYear: 2020,
    status: 'active',
    locationGrade: 'matched',
    position: [126.82, 37.66],
    positionBasis: 'matchedBuildingCentroid',
    pnuPosition: [126.82, 37.66],
    matchRule: 'jibun→pnu',
    matchedPnu: '4128110900107650159',
    matchedBuildingId: 'b1',
    matchNote: null,
  },
  {
    stableId: 'S-5945#r2',
    sourceId: 'S-5945',
    sourceRow: 2,
    tableType: 'general',
    gu: '덕양구',
    dong: '고양동',
    placeText: '덕양구 고골길 238 고골인근',
    cameraCount: 1,
    hasEmergencyBell: false,
    installYear: 2018,
    status: 'active',
    locationGrade: 'unmatched',
    position: null,
    positionBasis: null,
    pnuPosition: null,
    matchRule: null,
    matchedPnu: null,
    matchedBuildingId: null,
    matchNote: 'road-address',
  },
  {
    stableId: 'S-5101#r3',
    sourceId: 'S-5101',
    sourceRow: 3,
    tableType: 'general',
    gu: '덕양구',
    dong: '주교동',
    placeText: '주교동 1 (철거)',
    cameraCount: 1,
    hasEmergencyBell: false,
    installYear: 2015,
    status: 'removed',
    locationGrade: 'matched',
    position: [126.83, 37.65],
    positionBasis: 'matchedBuildingCentroid',
    pnuPosition: [126.83, 37.65],
    matchRule: 'jibun→pnu',
    matchedPnu: 'p',
    matchedBuildingId: 'b2',
    matchNote: null,
  },
  // 공공 표준데이터 좌표가 적용된 시설
  {
    stableId: 'S-5800#r4',
    sourceId: 'S-5800',
    sourceRow: 4,
    tableType: 'general',
    gu: '덕양구',
    dong: '행신동',
    placeText: '행신동 100',
    cameraCount: 2,
    hasEmergencyBell: true,
    installYear: 2019,
    status: 'active',
    locationGrade: 'matched',
    position: [126.84, 37.62],
    positionBasis: 'publicDatasetCoordinate',
    pnuPosition: [126.8401, 37.6201],
    publicRef: {
      manageNo: '202639400000800048',
      address: '경기도 고양시 덕양구 행신동 100',
      baseDate: '2026-01-22',
      source: '전국 CCTV 표준데이터',
      catalogUrl: 'https://www.data.go.kr/data/15013094/standard.do',
      fileSha256: 'abc',
      matchTier: 'exact',
    },
    reviewFlag: null,
    reviewDistanceM: 12.3,
    matchRule: 'public-standard-dataset:exact:unique',
    matchedPnu: null,
    matchedBuildingId: null,
    matchNote: null,
  },
  // 공공행과 연결됐으나 자동 적용하지 않고 종전 기준점을 유지하는 시설
  {
    stableId: 'S-5K05#r5',
    sourceId: 'S-5K05',
    sourceRow: 5,
    tableType: 'general',
    gu: '덕양구',
    dong: '향동동',
    placeText: '향동동 130-12',
    cameraCount: 1,
    hasEmergencyBell: false,
    installYear: 2021,
    status: 'active',
    locationGrade: 'matched',
    position: [126.88, 37.6],
    positionBasis: 'matchedBuildingCentroid',
    pnuPosition: [126.88, 37.6],
    publicRef: {
      manageNo: '202639400000800999',
      address: '경기도 고양시 덕양구 향동동 130-12',
      baseDate: '2026-01-22',
      source: '전국 CCTV 표준데이터',
      catalogUrl: 'https://www.data.go.kr/data/15013094/standard.do',
      fileSha256: 'abc',
      matchTier: 'exact',
    },
    reviewFlag: 'strong-anomaly',
    reviewDistanceM: 12924,
    reviewEvidence: '종전 건물 기준점과 약 12,924m 차이',
    matchRule: 'jibun→pnu',
    matchedPnu: 'p5',
    matchedBuildingId: 'b5',
    matchNote: null,
  },
];

const meta: CctvMeta = {
  source: '고양시 방범용 CCTV 및 비상벨 설치 현황 (2026년 1월)',
  sourceFile: 'x.xlsx',
  hasCoordinates: true,
  totalSites: 1800,
  totalCameras: 7549,
  byTable: { general: { sites: 1753, cameras: 7487 }, plate: { sites: 47, cameras: 62 } },
  filtered: {
    gu: '덕양구',
    sites: 919,
    cameras: 3713,
    general: { sites: 887, cameras: 3669 },
    plate: { sites: 32, cameras: 44 },
  },
  bell: { yes: 871, no: 16, unknown: 32 },
  removed: 5,
  match: {
    simpleParseCandidates: 437,
    matched: 907,
    unmatched: 12,
    unmatchedReasons: {},
    note: '',
  },
  legacyPnuMatch: {
    simpleParseCandidates: 437,
    matched: 424,
    unmatched: 495,
    unmatchedReasons: {},
    note: '공공좌표 연결 이전 PNU 지번 매칭 집계(보존용)',
  },
  positionSources: {
    publicDatasetCoordinate: 895,
    matchedBuildingCentroid: 12,
    none: 12,
    needsReview: 24,
  },
  publicSource: {
    name: '전국 CCTV 표준데이터 (행정안전부 / 지자체 제공)',
    catalogUrl: 'https://www.data.go.kr/data/15013094/standard.do',
    downloadUrl: 'https://file.localdata.go.kr/file/cctv_info/info',
    file: 'public-cctv-goyang-20260917.csv',
    fileSha256: 'abc',
    publicRows: 2356,
    acceptPurposes: ['다목적', '생활방범', '차량방범'],
    linked: 913,
    applied: 895,
    heldForReview: 18,
    unresolved: 6,
    byTier: { exact: 904, normalized: 9 },
    pickReasons: { unique: 905, 'count-year-unique': 8 },
    reviewCounts: { 'strong-anomaly': 5 },
    generatedAt: '2026-09-17T00:00:00Z',
    note: '',
  },
  duplicateSourceIds: [],
  warning: '',
};

describe('FacilitiesPanel', () => {
  beforeEach(() => {
    useAppStore.setState({
      cctvSites: sites,
      cctvMeta: meta,
      cctvVisible: true,
      cctvShowRemoved: false,
      cctvQuery: '',
      cctvSelectedId: null,
      cctvLiveQuery: '',
      cctvLiveStatus: 'idle',
      cctvLiveError: null,
      cctvLiveCandidates: [],
      cctvLiveChosen: null,
    });
  });
  afterEach(cleanup);

  it('separates map totals from search hits and shows 2026.01 basis', () => {
    render(<FacilitiesPanel />);
    const stats = screen.getByTestId('cctv-stats');
    expect(stats).toHaveTextContent('2026.01 설치현황 자료 기준');
    expect(stats).toHaveTextContent('실시간 운영 상태가 아닙니다');
    expect(stats).toHaveTextContent('지도 표시 3개소');
    expect(stats).toHaveTextContent('검색 결과 4건');
    fireEvent.change(screen.getByRole('searchbox', { name: 'CCTV 검색' }), {
      target: { value: '지축' },
    });
    expect(screen.getByTestId('cctv-stats')).toHaveTextContent('검색 결과 1건');
  });

  it('breaks the site count down by coordinate source', () => {
    render(<FacilitiesPanel />);
    const sources = screen.getByTestId('cctv-position-sources');
    expect(sources).toHaveTextContent('공공좌표 1');
    expect(sources).toHaveTextContent('건물참고 3');
    expect(sources).toHaveTextContent('위치없음 1');
  });

  it('reports review-needed separately because it cuts across the source buckets', () => {
    render(<FacilitiesPanel />);
    expect(screen.getByTestId('cctv-needs-review')).toHaveTextContent(
      '위 집계에 걸쳐 검토필요 1개소',
    );
  });

  it('shows the public dataset provenance summary from meta', () => {
    render(<FacilitiesPanel />);
    const stats = screen.getByTestId('cctv-stats');
    expect(stats).toHaveTextContent('전국 CCTV 표준데이터');
    expect(stats).toHaveTextContent('연결 913');
    expect(stats).toHaveTextContent('적용 895');
    expect(stats).toHaveTextContent('보류 18');
    expect(stats).toHaveTextContent('미해결 6');
  });

  it('selects a site and shows symbolic height, no direction, 철거표시없음', () => {
    render(<FacilitiesPanel />);
    fireEvent.click(screen.getByRole('button', { name: /S-5615/ }));
    const detail = screen.getByTestId('cctv-detail');
    expect(detail).toHaveTextContent('상태 철거표시없음');
    expect(detail).toHaveTextContent('3D 폴 높이 4.5m');
    expect(detail).toHaveTextContent('방향 정보 없음');
    expect(detail).toHaveTextContent('지축동765-159');
  });

  it('labels removed status as 철거', () => {
    useAppStore.setState({ cctvShowRemoved: true });
    render(<FacilitiesPanel />);
    fireEvent.click(screen.getByRole('button', { name: /S-5101/ }));
    expect(screen.getByTestId('cctv-detail')).toHaveTextContent('상태 철거');
  });

  it('shows Korean match reasons and display-only camera placement copy', () => {
    render(<FacilitiesPanel />);
    expect(screen.getByRole('status')).toHaveTextContent('높이·방향·카메라 배치는 표시용');
    expect(screen.getByRole('status')).toHaveTextContent('카메라 대수만 원본 값');
    expect(screen.getByRole('status')).toHaveTextContent('현장 대조로 검증하지 않았습니다');
    fireEvent.click(screen.getByRole('button', { name: /S-5945/ }));
    const detail = screen.getByTestId('cctv-detail');
    expect(detail).toHaveTextContent('도로명·정류소번호(지번 아님)');
    expect(detail).not.toHaveTextContent('road-address');
    expect(detail).toHaveTextContent('좌표 출처 없음');
  });

  it('marks legacy building-match reasons so they are not read as the current source', () => {
    render(<FacilitiesPanel />);
    fireEvent.click(screen.getByRole('button', { name: /S-5945/ }));
    expect(screen.getByTestId('cctv-detail')).toHaveTextContent(
      '종전 건물 매칭: 도로명·정류소번호(지번 아님)',
    );
  });

  it('names the public dataset as the source when its coordinate is applied', () => {
    render(<FacilitiesPanel />);
    fireEvent.click(screen.getByRole('button', { name: /S-5800/ }));
    const detail = screen.getByTestId('cctv-detail');
    expect(screen.getByTestId('cctv-position-source')).toHaveTextContent(
      '좌표 출처 전국 CCTV 표준데이터 제공 좌표',
    );
    expect(detail).toHaveTextContent('공공 관리번호 202639400000800048');
    expect(detail).toHaveTextContent('기준일 2026-01-22');
    expect(detail).toHaveTextContent('매칭 원문 일치');
    expect(detail).toHaveTextContent('종전 건물 기준점 보존됨');
    expect(screen.queryByTestId('cctv-review')).toBeNull();
  });

  it('explains why a held site kept the building reference point', () => {
    render(<FacilitiesPanel />);
    fireEvent.click(screen.getByRole('button', { name: /S-5K05/ }));
    const review = screen.getByTestId('cctv-review');
    expect(review).toHaveTextContent('위치 이상 — 자동 적용 금지');
    expect(review).toHaveTextContent('약 12,924m 차이');
    expect(review).toHaveTextContent('공공좌표를 자동 적용하지 않았습니다');
    expect(screen.getByTestId('cctv-position-source')).toHaveTextContent('참고 위치');
  });

  it('badges each list row by coordinate source with review taking priority', () => {
    render(<FacilitiesPanel />);
    expect(screen.getByRole('button', { name: /S-5800/ })).toHaveTextContent('공공좌표');
    expect(screen.getByRole('button', { name: /S-5615/ })).toHaveTextContent('건물참고');
    expect(screen.getByRole('button', { name: /S-5945/ })).toHaveTextContent('위치없음');
    expect(screen.getByRole('button', { name: /S-5K05/ })).toHaveTextContent('검토필요');
    expect(screen.getByRole('button', { name: /S-5K05/ })).not.toHaveTextContent('건물참고');
  });

  it('counts live display positions separately from stored coordinates', () => {
    render(<FacilitiesPanel />);
    expect(screen.getByRole('status')).toHaveTextContent('청록 핀은 네이버 주소 조회');
    fireEvent.click(screen.getByRole('button', { name: /S-5945/ }));
    act(() => {
      useAppStore.getState().chooseCctvLiveCandidate({
        roadAddress: '경기도 고양시 덕양구 고골길 238',
        jibunAddress: '',
        lng: 126.83,
        lat: 37.65,
        inDeogyang: true,
      });
    });
    const stats = screen.getByTestId('cctv-stats');
    expect(stats).toHaveTextContent('지도 표시 4개소');
    expect(stats).toHaveTextContent('네이버 임시 조회 1개소');
    expect(screen.getByTestId('cctv-position-sources')).toHaveTextContent('위치없음 1');
    expect(sites.find((s) => s.sourceId === 'S-5945')?.position).toBeNull();
  });
});
