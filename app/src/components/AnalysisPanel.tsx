import { DemoDecisionPanel } from '@/components/DemoDecisionPanel';
import { useDemoStore } from '@/store/demoStore';
import { useState } from 'react';
import { groundCovers } from '@/data/ground';
import analysisConfig from '../../config/analysis.json';
import { analysisWorkerCount, sunHoursPoolSize } from '@/analysis/pool';
import { analysisBlockReason } from '@/analysis/gating';
import { useSunHours } from '@/analysis/useSunHours';
import { FeatureInfoPanel } from '@/components/FeatureInfoPanel';
import { RiskPanel } from '@/components/RiskPanel';
import { WeatherPanel } from '@/components/WeatherPanel';
import { useAppStore } from '@/store/appStore';

function SunAnalysisCard() {
  const {run,cancel}=useSunHours();
  const running=useAppStore(s=>s.sunHoursRunning),progress=useAppStore(s=>s.sunHoursProgress);
  const error=useAppStore(s=>s.sunHoursError),meta=useAppStore(s=>s.sunHoursMeta);
  const aoi=useAppStore(s=>s.aoi),ground=useAppStore(s=>s.ground),groundError=useAppStore(s=>s.groundError);
  const buildings=useAppStore(s=>s.seoulBuildings),unknown=useAppStore(s=>s.buildingsUnknownHeight);
  const blocked=analysisBlockReason({aoiPresent:!!aoi,groundReady:!!aoi && groundCovers(ground,aoi.bbox),buildings});
  return <section><span className="eyebrow">SHADE & SUNLIGHT</span><h2>햇빛이 닿는 시간을 살펴봐요</h2><p className="intro-copy">하루 중 햇빛을 받을 수 있는 시간을 계산합니다. 아래 시간 막대를 움직이면 해당 시각의 그늘로 돌아갑니다.</p>
    <div className="sun-action-card"><span className="sun-card-icon">☀</span><h3>선택한 지역의 하루 일조</h3><p>{aoi ? '선택한 범위를 기준으로 계산합니다.' : '위의 ‘이 주변 분석하기’로 지역부터 선택하세요.'}</p><button type="button" className="btn btn-primary" onClick={()=>void run()} disabled={running || !!blocked}>{running ? '계산하고 있어요…' : '일조시간 계산'}</button>{running && <button className="btn btn-ghost" onClick={cancel}>취소</button>}</div>
    {blocked && <p className="panel-hint" data-testid="analysis-blocked">{blocked}</p>}
    {running && <div className="progress-wrap" data-testid="sunhours-progress"><progress max={1} value={progress}/><span>{Math.round(progress*100)}%</span></div>}
    {(error || groundError) && <p className="notice-warning" role="alert">{error || groundError}</p>}
    {meta && <p className="result-summary" data-testid="sunhours-meta">{Math.round(meta.aoiWidthM)}m × {Math.round(meta.aoiHeightM)}m · 계산 완료 {(meta.elapsedMs/1000).toFixed(2)}초</p>}
    <div className="sunhours-legend"><span>햇빛 적음</span><span className="sunhours-legend-bar"/><span>많음 · {analysisConfig.sunHoursMaxH}h</span></div>
    <p className="neutral-note">그늘이 길다고 곧바로 결빙 위험 지역인 것은 아닙니다.</p>
    <details className="detail-section"><summary>계산 기준과 자료 한계</summary><p className="panel-hint">지형·건물의 차폐를 계산합니다. 수목·구름 차폐, 노면 상태와 제설 작업은 아직 반영하지 않습니다. 지면은 약 30m급 자료의 추정값입니다.</p><p className="panel-hint">격자 {analysisConfig.cellSizeM}m · {analysisConfig.stepMinutes}분 간격 · 지형 주변 3km · 건물 주변 300m · 워커 {sunHoursPoolSize() || analysisWorkerCount()}개</p>{unknown>0 && <p className="panel-hint" data-testid="unknown-height-note">높이 미상 {unknown.toLocaleString('ko-KR')}동은 계산에서 제외합니다.</p>}</details>
  </section>;
}

export function AnalysisPanel() {
  const demo=useDemoStore(s=>s.enabled);
  const [tab,setTab]=useState<'risk'|'sun'|'weather'>('risk');
  const selected=useAppStore(s=>s.selectedFeature);
  return <aside className="panel panel-right" aria-label="분석">
    <div className="results-tabs" role="tablist" aria-label="분석 정보">{([['risk',demo?'제설 의사결정':'위험 살펴보기'],['sun','그늘·일조'],['weather','기상 연계']] as const).map(([id,label])=><button key={id} id={`tab-${id}`} role="tab" aria-controls="result-tab-content" aria-selected={tab===id} onClick={()=>setTab(id)}>{label}</button>)}</div>
    <div id="result-tab-content" role="tabpanel" aria-labelledby={`tab-${tab}`}>{tab==='risk' ? (demo?<DemoDecisionPanel/>:<RiskPanel/>) : tab==='sun' ? <SunAnalysisCard/> : <WeatherPanel/>}</div>
    <details className="detail-section selected-detail" open={selected!==null}><summary>{selected?.kind==='risk' ? '선택한 위험지점의 근거' : '선택한 지도 정보'}</summary><FeatureInfoPanel/></details>
  </aside>;
}
