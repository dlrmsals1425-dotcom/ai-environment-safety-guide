import { groundCovers } from '@/data/ground';
import analysisConfig from '../../config/analysis.json';
import { analysisWorkerCount, sunHoursPoolSize } from '@/analysis/pool';
import { analysisBlockReason } from '@/analysis/gating';
import { useSunHours } from '@/analysis/useSunHours';
import { FeatureInfoPanel } from '@/components/FeatureInfoPanel';
import { useAppStore } from '@/store/appStore';

export function AnalysisPanel() {
  const { run, cancel } = useSunHours();
  const running = useAppStore((s) => s.sunHoursRunning);
  const progress = useAppStore((s) => s.sunHoursProgress);
  const error = useAppStore((s) => s.sunHoursError);
  const spec = useAppStore((s) => s.sunHoursSpec);
  const meta = useAppStore((s) => s.sunHoursMeta);
  const aoi = useAppStore((s) => s.aoi);
  const ground = useAppStore((s) => s.ground);
  const groundError = useAppStore((s) => s.groundError);
  const seoulBuildings = useAppStore((s) => s.seoulBuildings);
  const unknownHeight = useAppStore((s) => s.buildingsUnknownHeight);
  const workerCount = sunHoursPoolSize() || analysisWorkerCount();

  const blocked = analysisBlockReason({

    groundReady: !!aoi && groundCovers(ground, aoi.bbox),
    aoiPresent: aoi != null,
    buildings: seoulBuildings,
  });

  return (
    <aside className="panel panel-right" aria-label="분석">
      <h2 className="panel-title">지형·건물 일조 분석</h2>
      <div className="card">
        <p className="panel-hint">
          격자 {analysisConfig.cellSizeM}m · {analysisConfig.stepMinutes}분 간격 · 지면 위{' '}
          {analysisConfig.z0}m · 워커 {workerCount}개. 건물과 추정 지형의 차폐를 함께 계산합니다. 지형은 주변 3km를 15m 간격으로 검사하며, 건물은 관심구역 주변 300m까지 반영합니다.
        </p>
        <p className="panel-hint">정밀 DTM이 아닌 DSM 유래 추정 지면입니다. 결과는 지면의 기하학적 일조 가능시간이며, 옥상·벽면 일조 및 수목·구름 차폐는 계산하지 않습니다. 일조시간 계산 후에도 시간 슬라이더를 움직이면 선택 시각의 바닥 그늘로 돌아갑니다.</p>
        {groundError && <p role="alert">{groundError}</p>}
        {unknownHeight > 0 && (
          <p className="panel-hint" data-testid="unknown-height-note">
            높이 미상 {unknownHeight.toLocaleString('ko-KR')}동은 계산에서 제외했습니다
            (층수로 추정하지 않음).
          </p>
        )}
        <div className="header-actions">
          <button
            type="button"
            className="btn"
            onClick={() => void run()}
            disabled={running || blocked !== null}
          >
            일조시간 계산
          </button>
          {running && (
            <button type="button" className="btn btn-ghost" onClick={cancel}>
              취소
            </button>
          )}
        </div>
        {blocked && (
          <p className="panel-hint" data-testid="analysis-blocked" role="status">
            계산할 수 없음: {blocked}
          </p>
        )}
        {running && (
          <p className="muted" data-testid="sunhours-progress">
            진행 {Math.round(progress * 100)}%
          </p>
        )}
        {error && (
          <p className="map-warning" role="alert">
            {error}
          </p>
        )}
        {(meta || spec) && (
          <p className="muted" data-testid="sunhours-meta">
            {meta
              ? `${Math.round(meta.aoiWidthM)}m × ${Math.round(meta.aoiHeightM)}m · 격자 ${meta.nx} × ${meta.ny} · 셀 ${meta.cellSize}m · ${meta.stepMinutes}분 · 건물 ${meta.buildingCount}동 · 워커 ${meta.workerCount}개 · ${meta.timeSteps}스텝 · ${(meta.elapsedMs / 1000).toFixed(2)}s`
              : `격자 ${spec!.nx} × ${spec!.ny} · 셀 ${spec!.cellSize}m`}
          </p>
        )}
        <div className="sunhours-legend" aria-hidden="true">
          <span>0h</span>
          <span className="sunhours-legend-bar" />
          <span>{analysisConfig.sunHoursMaxH}h</span>
        </div>
      </div>

      <h2 className="panel-title">선택 정보</h2>
      <FeatureInfoPanel />

      <h2 className="panel-title">미연동</h2>
      <div className="card card-empty">
        <p className="muted">
          기상(기온·강수·일사) 자료와 수목 차폐 엔진은 아직 연결하지 않았습니다.
          위험도·안전 등급을 만들지 않습니다.
        </p>
      </div>
    </aside>
  );
}
