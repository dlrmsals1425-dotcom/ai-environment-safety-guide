/** 배치 위치(적용 시): cpted-sunmap/src/components/FacilitiesPanel.tsx (전체 교체) */
import { useEffect, useRef } from 'react';
import { deogyangSites, matchNoteLabel, visibleCctvSites } from '@/data/facilityLoader';
import { cctvDisplayPosition } from '@/data/geocodeQuery';
import {
  countPositionSources,
  positionBadge,
  positionSourceLabel,
  reviewSummary,
} from '@/facility/positionSource';
import { CCTV_POLE_HEIGHT_M } from '@/map/facilityLayers';
import { useAppStore } from '@/store/appStore';
import type { GeocodeCandidate } from '@/types/facility';

function bellLabel(v: boolean | null): string {
  if (v === true) return '있음';
  if (v === false) return '없음';
  return '미확인';
}

function statusLabel(status: 'active' | 'removed'): string {
  return status === 'removed' ? '철거' : '철거표시없음';
}

export function FacilitiesPanel() {
  const sites = useAppStore((s) => s.cctvSites);
  const meta = useAppStore((s) => s.cctvMeta);
  const visible = useAppStore((s) => s.cctvVisible);
  const showRemoved = useAppStore((s) => s.cctvShowRemoved);
  const query = useAppStore((s) => s.cctvQuery);
  const selectedId = useAppStore((s) => s.cctvSelectedId);
  const liveQuery = useAppStore((s) => s.cctvLiveQuery);
  const liveStatus = useAppStore((s) => s.cctvLiveStatus);
  const liveError = useAppStore((s) => s.cctvLiveError);
  const liveCandidates = useAppStore((s) => s.cctvLiveCandidates);
  const liveChosen = useAppStore((s) => s.cctvLiveChosen);
  const setCctvVisible = useAppStore((s) => s.setCctvVisible);
  const setCctvShowRemoved = useAppStore((s) => s.setCctvShowRemoved);
  const setCctvQuery = useAppStore((s) => s.setCctvQuery);
  const selectCctv = useAppStore((s) => s.selectCctv);
  const setCctvLiveQuery = useAppStore((s) => s.setCctvLiveQuery);
  const beginCctvLiveLookup = useAppStore((s) => s.beginCctvLiveLookup);
  const applyCctvLiveResult = useAppStore((s) => s.applyCctvLiveResult);
  const applyCctvLiveError = useAppStore((s) => s.applyCctvLiveError);
  const chooseCctvLiveCandidate = useAppStore((s) => s.chooseCctvLiveCandidate);
  const requestViewAround = useAppStore((s) => s.requestViewAround);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, [selectedId, liveQuery]);

  const listed = visibleCctvSites(sites, { showRemoved, query });
  const selected = sites.find((s) => s.stableId === selectedId) ?? null;
  const matchReason = selected ? matchNoteLabel(selected.matchNote) : null;
  const displayPos = selected ? cctvDisplayPosition(selected, liveChosen) : null;
  const selectedReview = selected ? reviewSummary(selected) : null;
  const deog = deogyangSites(sites);
  const counts = countPositionSources(deog);
  const onMap = deog.filter((s) => {
    if (!showRemoved && s.status === 'removed') return false;
    return cctvDisplayPosition(s, liveChosen) !== null;
  }).length;
  const liveOnMap =
    liveChosen &&
    selected &&
    liveChosen.siteId === selected.stableId &&
    (showRemoved || selected.status !== 'removed')
      ? 1
      : 0;
  const hiddenRemoved = meta && !showRemoved ? meta.removed : 0;

  async function lookup() {
    if (!selected) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const reqId = beginCctvLiveLookup();
    try {
      const res = await fetch('/api/naver-geocode', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify({ query: liveQuery, siteId: selected.stableId }),
        signal: ac.signal,
      });
      const data = (await res.json()) as { error?: string; candidates?: GeocodeCandidate[] };
      if (!res.ok) {
        applyCctvLiveError(reqId, data.error ?? '주소 조회에 실패했습니다.');
        return;
      }
      applyCctvLiveResult(reqId, data.candidates ?? []);
    } catch (err) {
      const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : '';
      if (name === 'AbortError') return;
      applyCctvLiveError(reqId, '주소 조회에 실패했습니다.');
    }
  }

  return (
    <section className="facilities" aria-label="CCTV 시설물">
      <h2 className="panel-title">시설물</h2>
      <label className="layer-item">
        <input
          type="checkbox"
          checked={visible}
          onChange={(e) => setCctvVisible(e.target.checked)}
        />
        <span>CCTV·비상벨</span>
      </label>
      <label className="layer-item">
        <input
          type="checkbox"
          checked={showRemoved}
          onChange={(e) => setCctvShowRemoved(e.target.checked)}
        />
        <span>철거 포함</span>
      </label>
      {visible && (
        <p className="facility-warn" role="status">
          ⚠ 기둥·카메라 암/하우징은 4.5m 상징 3D 모형입니다. 높이·방향·카메라 배치는 표시용이며
          카메라 대수만 원본 값입니다. 좌표는 <b>녹색=공공 표준데이터 제공</b>,
          <b> 청색=PNU 건물 기준점(참고)</b>, <b>주황=검토 필요</b>로 구분합니다.
          공공 좌표도 현장 대조로 검증하지 않았습니다. 청록 핀은 네이버 주소 조회 임시 위치입니다.
        </p>
      )}
      {meta && (
        <div className="panel-hint" data-testid="cctv-stats">
          <p>2026.01 설치현황 자료 기준. 실시간 운영 상태가 아닙니다.</p>
          <p>
            덕양구 {meta.filtered.sites.toLocaleString('ko-KR')}개소 / 카메라{' '}
            {meta.filtered.cameras.toLocaleString('ko-KR')}대
          </p>
          <p data-testid="cctv-position-sources">
            공공좌표 {counts.public.toLocaleString('ko-KR')} · 건물참고{' '}
            {counts.building.toLocaleString('ko-KR')} · 위치없음{' '}
            {counts.none.toLocaleString('ko-KR')}
          </p>
          <p data-testid="cctv-needs-review">
            (위 집계에 걸쳐 검토필요 {counts.needsReview.toLocaleString('ko-KR')}개소)
          </p>
          <p>
            지도 표시 {onMap.toLocaleString('ko-KR')}개소
            {liveOnMap ? ` · 네이버 임시 조회 ${liveOnMap}개소` : ''}
            {hiddenRemoved ? ` (철거 ${hiddenRemoved}개소 숨김)` : ''}
          </p>
          {meta.publicSource && (
            <p>
              좌표 출처 {meta.publicSource.name} · 연결{' '}
              {meta.publicSource.linked.toLocaleString('ko-KR')} · 적용{' '}
              {meta.publicSource.applied.toLocaleString('ko-KR')} · 보류{' '}
              {meta.publicSource.heldForReview.toLocaleString('ko-KR')} · 미해결{' '}
              {meta.publicSource.unresolved.toLocaleString('ko-KR')}
            </p>
          )}
          <p>검색 결과 {listed.length.toLocaleString('ko-KR')}건</p>
        </div>
      )}
      <input
        className="facility-search"
        type="search"
        placeholder="동·주소·ID 검색"
        value={query}
        onChange={(e) => setCctvQuery(e.target.value)}
        aria-label="CCTV 검색"
      />
      <ul className="facility-list">
        {listed.slice(0, 80).map((s) => {
          const badge = positionBadge(s);
          return (
            <li key={s.stableId}>
              <button
                type="button"
                className={
                  s.stableId === selectedId ? 'facility-item facility-item-on' : 'facility-item'
                }
                onClick={() => selectCctv(s.stableId)}
              >
                <span>{s.sourceId}</span>
                <span className={badge.className}>{badge.label}</span>
                {s.status === 'removed' && <span className="badge-unmatched">철거</span>}
                <span className="facility-item-place">{s.placeText}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {listed.length > 80 && (
        <p className="panel-hint">검색 결과 {listed.length}건 중 80건만 표시</p>
      )}
      {selected && (
        <div className="facility-detail" data-testid="cctv-detail">
          <p className="card-kicker">
            {selected.tableType === 'plate' ? '차량번호인식' : '일반방범'} · {selected.dong ?? '동 미상'}
          </p>
          <p>{selected.placeText}</p>
          <ul className="stat-list">
            <li>카메라 {selected.cameraCount ?? '정보 없음'}대</li>
            <li>비상벨 {bellLabel(selected.hasEmergencyBell)}</li>
            <li>설치연도 {selected.installYear ?? '정보 없음'}</li>
            <li>상태 {statusLabel(selected.status)}</li>
            <li data-testid="cctv-position-source">좌표 출처 {positionSourceLabel(selected)}</li>
            {selected.publicRef && (
              <li>
                공공 관리번호 {selected.publicRef.manageNo} · 기준일{' '}
                {selected.publicRef.baseDate} · 매칭{' '}
                {selected.publicRef.matchTier === 'exact' ? '원문 일치' : '정규화 일치'}
              </li>
            )}
            {selectedReview && (
              <li className="warn" data-testid="cctv-review">
                검토 필요 — {selectedReview}
                {selected.publicRef ? ' (공공좌표를 자동 적용하지 않았습니다)' : ''}
              </li>
            )}
            {selected.reviewCandidateIds && selected.reviewCandidateIds.length > 1 && (
              <li>후보 관리번호 {selected.reviewCandidateIds.join(', ')}</li>
            )}
            {selected.pnuPosition && selected.positionBasis === 'publicDatasetCoordinate' && (
              <li>종전 건물 기준점 보존됨</li>
            )}
            <li>화면 핀 선택용 심볼 (건물 가림 없음)</li>
            <li>3D 폴 높이 {CCTV_POLE_HEIGHT_M}m (표시용 규격)</li>
            <li>방향 정보 없음</li>
            {selected.matchedPnu && <li>종전 건물 매칭: PNU(참고) {selected.matchedPnu}</li>}
            {matchReason && <li>종전 건물 매칭: {matchReason}</li>}
            {liveChosen && liveChosen.siteId === selected.stableId && (
              <li>네이버 주소 조회 위치(임시) {liveChosen.label}</li>
            )}
          </ul>
          <label className="facility-geocode">
            <span>주소 조회</span>
            <input
              type="text"
              value={liveQuery}
              onChange={(e) => setCctvLiveQuery(e.target.value)}
              aria-label="네이버 주소 검색어"
            />
          </label>
          <button
            type="button"
            className="btn"
            disabled={liveStatus === 'loading' || !liveQuery.trim()}
            onClick={() => void lookup()}
          >
            네이버 주소 조회
          </button>
          <p className="panel-hint">
            조회 결과는 주소 대표점이며 실제 CCTV 설치 좌표가 아닙니다. 저장하지 않습니다.
          </p>
          {liveStatus === 'loading' && <p className="panel-hint">조회 중…</p>}
          {liveStatus === 'error' && liveError && <p className="panel-hint">{liveError}</p>}
          {liveStatus === 'results' && liveCandidates.length === 0 && (
            <p className="panel-hint">검색 결과가 없습니다.</p>
          )}
          {liveCandidates.length > 0 && (
            <ul className="facility-candidates" data-testid="geocode-candidates">
              {liveCandidates.map((c, i) => (
                <li key={`${c.lng},${c.lat},${i}`}>
                  <p>{c.roadAddress || c.jibunAddress}</p>
                  {c.roadAddress && c.jibunAddress && c.roadAddress !== c.jibunAddress && (
                    <p className="panel-hint">{c.jibunAddress}</p>
                  )}
                  <button
                    type="button"
                    className="btn"
                    disabled={!c.inDeogyang}
                    onClick={() => chooseCctvLiveCandidate(c)}
                  >
                    이 주소로 보기
                  </button>
                  {!c.inDeogyang && <p className="panel-hint">덕양구가 아니라 선택할 수 없습니다.</p>}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="btn"
            disabled={!displayPos}
            onClick={() => {
              if (displayPos) requestViewAround(displayPos[0], displayPos[1]);
            }}
          >
            주변 500m 보기
          </button>
          {!displayPos && <p className="panel-hint">좌표가 없어 이동할 수 없습니다.</p>}
        </div>
      )}
    </section>
  );
}
