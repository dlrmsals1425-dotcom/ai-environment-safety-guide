import { filterSnowBases, snowBaseKinds } from '@/data/snowBases';
import { DistrictPanel } from '@/components/DistrictPanel';
import { useAppStore } from '@/store/appStore';
import { LAYER_IDS, LAYER_LABELS } from '@/types/layers';
import type { DatasetState } from '@/types/seoul';

const SNOW_LIST_LIMIT = 20;

function datasetLine(
  name: string,
  state: DatasetState<unknown>,
  extra?: string,
): { text: string; tone: 'ok' | 'warn' | 'error' } {
  if (state.status === 'loading' || state.status === 'idle') {
    return { text: `${name}: 불러오는 중…`, tone: 'warn' };
  }
  if (state.status === 'error') {
    return { text: `${name}: 로딩 오류 — ${state.error ?? '알 수 없음'}`, tone: 'error' };
  }
  if (state.status === 'missing') {
    return { text: `${name}: 준비된 데이터 파일이 없습니다(미연동)`, tone: 'warn' };
  }
  if (state.status === 'empty') {
    return { text: `${name}: 이 범위에 자료 없음`, tone: 'warn' };
  }
  const parts = [`${name}: ${state.features.length.toLocaleString('ko-KR')}건`];
  if (state.tileIds.length > 0) parts.push(`타일 ${state.tileIds.length}개`);
  if (state.skipped > 0) parts.push(`기하 불량 ${state.skipped}건 제외`);
  if (state.capped) parts.push('표시 상한으로 잘림');
  if (state.tilesTruncated) parts.push('타일 상한 초과(일부만 읽음)');
  if (extra) parts.push(extra);
  return {
    text: parts.join(' · '),
    tone: state.capped || state.tilesTruncated ? 'warn' : 'ok',
  };
}

export function LayerPanel() {
  const layers = useAppStore((s) => s.layers);
  const setLayerVisible = useAppStore((s) => s.setLayerVisible);
  const basemap = useAppStore((s) => s.basemap);
  const setBasemap = useAppStore((s) => s.setBasemap);
  const buildings = useAppStore((s) => s.seoulBuildings);
  const trees = useAppStore((s) => s.seoulTrees);
  const unknownHeight = useAppStore((s) => s.buildingsUnknownHeight);
  const snowBases = useAppStore((s) => s.snowBases);
  const snowBaseMeta = useAppStore((s) => s.snowBaseMeta);
  const snowKind = useAppStore((s) => s.snowBaseKind);
  const snowQuery = useAppStore((s) => s.snowBaseQuery);
  const setSnowBaseKind = useAppStore((s) => s.setSnowBaseKind);
  const setSnowBaseQuery = useAppStore((s) => s.setSnowBaseQuery);
  const flyTo = useAppStore((s) => s.flyTo);
  const selectFeature = useAppStore((s) => s.selectFeature);
  const terrainStatus = useAppStore((s) => s.terrainStatus);
  const terrainMeta = useAppStore((s) => s.terrainMeta);
  const terrainError = useAppStore((s) => s.terrainError);

  const buildingLine = datasetLine(
    '건물',
    buildings,
    unknownHeight > 0
      ? `높이 미상 ${unknownHeight.toLocaleString('ko-KR')}동 분석 제외`
      : undefined,
  );
  const treeLine = datasetLine('수목', trees);
  const kinds = snowBaseKinds(snowBases.features);
  const shownSnow = filterSnowBases(snowBases.features, {
    kind: snowKind,
    query: snowQuery,
  });
  const snowStatusText =
    snowBases.status === 'loading' || snowBases.status === 'idle'
      ? '불러오는 중…'
      : snowBases.status === 'error'
        ? `로딩 오류 — ${snowBases.error ?? '알 수 없음'}`
        : snowBases.status === 'missing'
          ? '준비된 데이터 파일이 없습니다(미연동)'
          : `표시 ${shownSnow.length}개 / 좌표 반영 ${
              snowBaseMeta?.mappedRows ?? snowBases.features.length
            }개` +
            (snowBaseMeta?.totalRows != null
              ? ` (원본 ${snowBaseMeta.totalRows}행${
                  snowBaseMeta.unmappedRows ? `, 미표시 ${snowBaseMeta.unmappedRows}행` : ''
                })`
              : '');

  return (
    <aside className="panel panel-left" aria-label="보기 설정">
      <DistrictPanel />

      <h2 className="panel-title">지도에 표시할 정보</h2>
      <ul className="layer-list">
        {LAYER_IDS.map((id) => {
          const disabled = false;
          return (
            <li key={id}>
              <label className={disabled ? 'layer-item layer-item-off' : 'layer-item'}>
                <input
                  type="checkbox"
                  checked={layers[id] && !disabled}
                  disabled={disabled}
                  onChange={(e) => setLayerVisible(id, e.target.checked)}
                />
                <span>{LAYER_LABELS[id]}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <p className="panel-hint" data-testid="shadow-display-mode" role="status">
        {layers.sunHours
          ? '현재 표시: 하루 누적 일조시간. 시간 슬라이더를 움직이면 바닥 그늘로 전환합니다.'
          : layers.realtimeShadow
            ? '현재 표시: 선택 시각의 바닥 그늘. 관심구역과 주변 300m까지 표시합니다. 바깥 경계는 외부 건물 누락으로 참고용입니다.'
            : '바닥 그늘 표시가 꺼져 있습니다.'}
      </p>
      <details className="detail-section"><summary>계산·표시의 한계</summary><p className="panel-hint">지면은 30m급 표면고도에서 추정했습니다. 그늘 경계의 0.5m는 실제 정확도가 아닙니다. 수목은 2013년 자료의 간략 모형이며 수목 차폐는 아직 계산하지 않습니다.</p></details>
      <details className="detail-section"><summary>제설 지원시설 찾기</summary>
      <h2 className="panel-title">제설전진기지</h2>
      <p className="panel-hint">
        시설 위치 참고 자료입니다. 눈·결빙 위험 자료가 아닙니다.
      </p>
      <div className="preset-buttons" role="group" aria-label="제설기지 구분">
        <button
          type="button"
          className={snowKind === null ? 'btn btn-active' : 'btn'}
          aria-pressed={snowKind === null}
          onClick={() => setSnowBaseKind(null)}
        >
          전체
        </button>
        {kinds.map((kind) => (
          <button
            key={kind}
            type="button"
            className={snowKind === kind ? 'btn btn-active' : 'btn'}
            aria-pressed={snowKind === kind}
            onClick={() => setSnowBaseKind(kind)}
          >
            {kind}
          </button>
        ))}
      </div>
      <label className="layer-item">
        <span className="sr-only">기관·위치 검색</span>
        <input
          type="search"
          className="text-input"
          placeholder="기관·위치 검색"
          aria-label="제설전진기지 기관·위치 검색"
          value={snowQuery}
          onChange={(e) => setSnowBaseQuery(e.target.value)}
        />
      </label>
      <p className="panel-hint" data-testid="snow-status">
        {snowStatusText}
      </p>
      {shownSnow.length > 0 && (
        <ul className="snow-list" data-testid="snow-list">
          {shownSnow.slice(0, SNOW_LIST_LIMIT).map((f) => (
            <li key={f.properties.id}>
              <button
                type="button"
                className="snow-list-item"
                onClick={() => {
                  const [lng, lat] = f.geometry.coordinates;
                  flyTo(lng, lat);
                  selectFeature({
                    kind: 'snowBase',
                    props: f.properties as unknown as Record<string, unknown>,
                    lngLat: { lng, lat },
                  });
                }}
              >
                <span>{f.properties.agency ?? '기관 미상'}</span>
                <span className="muted">
                  {f.properties.kind ?? '구분 미상'} · {f.properties.location ?? '위치 미상'}
                </span>
              </button>
            </li>
          ))}
          {shownSnow.length > SNOW_LIST_LIMIT && (
            <li className="muted">
              외 {shownSnow.length - SNOW_LIST_LIMIT}개 — 검색으로 좁히세요.
            </li>
          )}
        </ul>
      )}
      <p className="panel-hint">
        원본 좌표의 단위·투영법을 해석해 표시한 참고 위치입니다. 주소 표본과는
        일치하지만 현장 위치는 검증하지 않았습니다.
      </p>

      </details>
      <details className="detail-section"><summary>배경지도·데이터 출처</summary>
      <h2 className="panel-title">배경지도</h2>
      <div className="preset-buttons" role="group" aria-label="배경지도">
        <button
          type="button"
          className={basemap === 'osm' ? 'btn btn-active' : 'btn'}
          aria-pressed={basemap === 'osm'}
          onClick={() => setBasemap('osm')}
        >
          OSM
        </button>
        <button
          type="button"
          className={basemap === 'none' ? 'btn btn-active' : 'btn'}
          aria-pressed={basemap === 'none'}
          onClick={() => setBasemap('none')}
        >
          배경 없음
        </button>
      </div>

      <h2 className="panel-title">데이터 상태</h2>
      <p className="panel-hint">건물·수목은 분석 영역(미지정 시 지도 중심 500m)과 주변 300m 자료를 표시합니다.</p>
      <ul className="data-status" data-testid="data-status">
        <li className={`status-${buildingLine.tone}`}>{buildingLine.text}</li>
        <li className={`status-${treeLine.tone}`}>{treeLine.text}</li>
        <li className={terrainStatus === 'ready' ? 'status-ok' : 'status-warn'}>
          {terrainStatus === 'ready' && terrainMeta
            ? `추정 지면: 로컬 타일 z${terrainMeta.minzoom}–${terrainMeta.maxzoom}${
                terrainMeta.nominalResolutionM
                  ? ` · 약 ${terrainMeta.nominalResolutionM}m급`
                  : ''
              }`
            : terrainStatus === 'error'
              ? `추정 지면: 로딩 오류 — ${terrainError ?? '알 수 없음'}`
              : terrainStatus === 'checking'
                ? '추정 지면: 확인 중…'
                : '추정 지면: 준비된 타일이 없습니다(미연동)'}
        </li>
        <li className="status-warn">기상 자료: 미연동 — 위험도 지표를 만들지 않습니다.</li>
      </ul>

      <h2 className="panel-title">출처·한계</h2>
      <p className="panel-hint" data-testid="source-note">
        건물 {buildings.meta?.source ?? 'GIS건물통합정보'}
        {buildings.meta?.dataDate ? ` (기준일 ${buildings.meta.dataDate})` : ''} · 수목{' '}
        {trees.meta?.source ?? '서울 수목 공개자료'} (2013년 공개본, 가로수 자료에 종로구
        없음) · 지면은 30m급 DSM을 3×3 필터로 가공한 추정값입니다. 대형 건물·숲의 높이가 남거나 능선이 평활화될 수 있으며, 오차와 추정 실패율은 검증되지 않았습니다.
        수목은 위치 참고이며 차폐 계산에 반영하지 않습니다.
      </p>
      <a className="panel-hint" href="/data/seoul/ground/ATTRIBUTION.txt" target="_blank" rel="noreferrer">
        표면고도 자료 출처·변환 내역
      </a>
      </details>
    </aside>
  );
}
