import { useAppStore } from '@/store/appStore';

function value(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}

const BUILDING_FIELDS: [string, string][] = [
  ['name', '이름'],
  ['useName', '용도'],
  ['address', '주소'],
  ['floors', '층수'],
  ['height', '사용 높이(m)'],
  ['heightSource', '높이 출처'],
  ['heightRaw', '원천 높이값'],
  ['pnu', 'PNU'],
  ['sourceId', '원천 ID'],
  ['sourceDate', '자료 기준일'],
];

const TREE_FIELDS: [string, string][] = [
  ['dataset', '자료 구분'],
  ['species', '수종'],
  ['gu', '자치구'],
  ['heightM', '수고(m)'],
  ['crownWidthM', '수관폭(m)'],
  ['rawHeight', '원천 수고값'],
  ['rawCrownWidth', '원천 수관값'],
  ['quality', '범위검사'],
  ['sourceYear', '자료 연도'],
];

const SNOW_FIELDS: [string, string][] = [
  ['agency', '관리기관'],
  ['baseId', '관리번호'],
  ['kind', '구분'],
  ['location', '상세위치'],
  ['coordinateStatus', '좌표 상태'],
];

const KIND_LABEL: Record<string, string> = {
  building: '건물',
  tree: '수목',
  snowBase: '제설전진기지',
};

function fieldValue(key: string, v: unknown): string {
  const labels: Record<string, Record<string, string>> = {
    heightSource: { measured: '대장값(현장 미검증)', estimated: '층수 기반 추정', unknown: '높이 미상' },
    dataset: { street: '가로수', 'park-private': '공원·사유지 수목', protected: '보호수·노거수' },
    quality: { valid: '범위검사 통과', review: '자료값 검토 필요' },
    coordinateStatus: { 'inferred-projection': '좌표 변환 기준 검토 필요' },
  };
  return typeof v === 'string' && labels[key]?.[v] ? labels[key][v] : value(v);
}

export function FeatureInfoPanel() {
  const selected = useAppStore((s) => s.selectedFeature);
  const clear = useAppStore((s) => s.selectFeature);

  if (!selected) {
    return (
      <div className="card card-empty" data-testid="feature-info">
        <p className="muted">
          지도에서 건물 윤곽이나 3D 나무를 클릭하면 원천 속성을 보여줍니다.
        </p>
      </div>
    );
  }

  const fields =
    selected.kind === 'building'
      ? BUILDING_FIELDS
      : selected.kind === 'snowBase'
        ? SNOW_FIELDS
        : TREE_FIELDS;
  const heightSource = selected.props.heightSource;

  return (
    <div className="card" data-testid="feature-info">
      <div className="card-kicker">
        {KIND_LABEL[selected.kind]}
      </div>
      <dl className="kv">
        {fields.map(([key, label]) => (
          <div key={key} className="kv-row">
            <dt>{label}</dt>
            <dd>{fieldValue(key, selected.props[key])}</dd>
          </div>
        ))}
        <div className="kv-row">
          <dt>선택 좌표</dt>
          <dd>
            {selected.lngLat.lat.toFixed(5)}, {selected.lngLat.lng.toFixed(5)}
          </dd>
        </div>
      </dl>
      {selected.kind === 'building' && heightSource === 'unknown' && (
        <p className="muted">높이 미상이라 일조 계산에서 제외됩니다(추정하지 않음).</p>
      )}
      {selected.kind === 'snowBase' && (
        <p className="muted">
          제설 시설의 위치 참고 자료입니다. 눈·결빙 위험 자료가 아니며 위험도 계산에
          쓰지 않습니다.
        </p>
      )}
      {selected.kind === 'tree' && (
        <p className="muted">
          2013년 공개본의 자료값입니다. 수고·수관폭이 있으면 그 크기의 간략 3D 모형,
          없으면 크기를 뜻하지 않는 황갈색 나무 기호로 표시합니다. 줄기 굵기와 수관 형태는
          복원값이 아닙니다. 현재 현장 상태는 미검증이며 수목 차폐 계산은 아직 반영하지 않습니다.
        </p>
      )}
      <button type="button" className="btn btn-ghost" onClick={() => clear(null)}>
        선택 해제
      </button>
    </div>
  );
}
