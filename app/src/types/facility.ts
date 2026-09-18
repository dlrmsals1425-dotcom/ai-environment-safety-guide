/** 배치 위치(적용 시): cpted-sunmap/src/types/facility.ts (전체 교체 — 기존 필드 유지, 추가만) */
export type CctvTableType = 'general' | 'plate';
export type CctvStatus = 'active' | 'removed';
export type CctvLocationGrade = 'matched' | 'unmatched';

/** 좌표의 출처. 화면에서 반드시 구분해 표시한다. */
export type CctvPositionBasis =
  | 'matchedBuildingCentroid' // PNU 지번으로 찾은 건물 기준점(참고 위치)
  | 'publicDatasetCoordinate' // 전국 CCTV 표준데이터 제공 좌표
  | null;

/**
 * 검토가 필요한 사유. null 이면 검토 대상 아님.
 * 앞 4종은 공공행과 연결은 됐으나 좌표를 자동 적용하지 않은 경우,
 * 뒤 2종은 공공행 연결 자체가 확정되지 않은 경우다.
 */
export type CctvReviewFlag =
  | 'strong-anomaly' // 종전 기준점과 극단적 차이. 강제 옵션으로도 승인 불가
  | 'source-location-conflict' // 원본 주소와 공공좌표 위치 상충. 강제 옵션으로도 승인 불가
  | 'attribute-mismatch' // 카메라 대수·설치연도 불일치. 강제 옵션으로도 승인 불가
  | 'large-shift' // 종전 기준점과 500m 초과. 검토 후 --apply-large-shift 로만 적용
  | 'unresolved-ambiguous' // 후보 복수. 행 순서로 배정하지 않음
  | 'unresolved-no-candidate' // 후보 없음 또는 주소 표기 불일치
  | null;

/** 공공 표준데이터 추적 정보. 좌표가 있다고 실측 정확성이 검증된 것은 아니다. */
export type CctvPublicRef = {
  manageNo: string;
  address: string;
  baseDate: string;
  source: string;
  catalogUrl: string;
  fileSha256: string;
  /** 'exact' = 원문 전체 일치, 'normalized' = 느슨한 정규화 일치 */
  matchTier: 'exact' | 'normalized';
};

export type GeocodeCandidate = {
  roadAddress: string;
  jibunAddress: string;
  lng: number;
  lat: number;
  inDeogyang: boolean;
};

export type CctvLiveChosen = {
  siteId: string;
  lng: number;
  lat: number;
  label: string;
};

export type CctvLiveStatus = 'idle' | 'loading' | 'error' | 'results';

export type CctvSite = {
  stableId: string;
  sourceId: string;
  sourceRow: number;
  tableType: CctvTableType;
  gu: string | null;
  dong: string | null;
  placeText: string;
  cameraCount: number | null;
  hasEmergencyBell: boolean | null;
  installYear: number | null;
  status: CctvStatus;
  locationGrade: CctvLocationGrade;
  /** 화면에 쓰는 유효 좌표. 출처는 positionBasis 로 판별한다. */
  position: [number, number] | null;
  positionBasis: CctvPositionBasis;
  matchRule: string | null;
  matchedPnu: string | null;
  matchedBuildingId: string | null;
  matchNote: string | null;

  // ── 공공 표준데이터 연결로 추가되는 필드 ──
  // importer 가 대상 구(덕양구) 레코드에만 기록한다. 타 구 레코드에는 키 자체가 없으므로 optional.
  /** 종전 PNU 건물 기준점. 거리 판정의 기준이며 공공좌표 적용 후에도 보존된다. */
  pnuPosition?: [number, number] | null;
  publicRef?: CctvPublicRef | null;
  reviewFlag?: CctvReviewFlag;
  /** 공공좌표와 pnuPosition 의 거리(m). */
  reviewDistanceM?: number | null;
  /** 후보 복수일 때 공공 관리번호 목록. 어느 것도 채택하지 않았다. */
  reviewCandidateIds?: string[] | null;
  /** 검토 사유의 근거 문구. 없으면 만들어내지 않는다. */
  reviewEvidence?: string | null;
};

export type CctvPublicSourceMeta = {
  name: string;
  catalogUrl: string;
  downloadUrl: string;
  file: string;
  fileSha256: string;
  publicRows: number;
  acceptPurposes: string[];
  linked: number;
  applied: number;
  heldForReview: number;
  unresolved: number;
  byTier: Record<string, number>;
  pickReasons: Record<string, number>;
  reviewCounts: Record<string, number>;
  generatedAt: string;
  note: string;
};

export type CctvMatchStats = {
  simpleParseCandidates: number;
  matched: number;
  unmatched: number;
  unmatchedReasons: Record<string, number>;
  note: string;
};

export type CctvMeta = {
  source: string;
  sourceFile: string;
  /** 좌표 보유 여부이며 정확성 보증이 아니다. */
  hasCoordinates: boolean;
  totalSites: number;
  totalCameras: number;
  byTable: {
    general: { sites: number; cameras: number };
    plate: { sites: number; cameras: number };
  };
  filtered: {
    gu: string;
    sites: number;
    cameras: number;
    general: { sites: number; cameras: number };
    plate: { sites: number; cameras: number };
  };
  bell: { yes: number; no: number; unknown: number };
  removed: number;
  /** 현재 좌표 보유 실태. 출처별 내역은 positionSources 를 본다. */
  match: CctvMatchStats;
  /** 공공좌표 연결 이전의 PNU 지번 매칭 집계(보존용). */
  legacyPnuMatch?: CctvMatchStats & { note: string };
  /** 좌표 출처별 집계. UI 표기와 반드시 일치해야 한다. */
  positionSources?: {
    publicDatasetCoordinate: number;
    matchedBuildingCentroid: number;
    none: number;
    needsReview: number;
  };
  publicSource?: CctvPublicSourceMeta | null;
  duplicateSourceIds: string[];
  warning: string;
};
