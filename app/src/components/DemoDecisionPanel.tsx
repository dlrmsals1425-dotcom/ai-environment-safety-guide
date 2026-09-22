import { useState, useEffect, useMemo, useRef } from 'react';
import { useMunicipalStore } from '@/store/municipalStore';
import { summarizeDistrict } from '@/data/districtDecisionSummary';
import { formatMinutes } from '@/lib/time';
import { useDemoStore } from '@/store/demoStore';
import { useAppStore } from '@/store/appStore';
import { useDemoDecision } from '@/data/useDemoDecision';
import { DISTRICTS } from '@/data/municipal';
import type { DemoWeather, DemoTreatment } from '@/data/demoDecision';
const controls:{key:keyof DemoWeather;label:string;min:number;max:number;unit:string}[]=[
  {key:'temperature',label:'가상 기온',min:-15,max:10,unit:'℃'},
  {key:'cloud',label:'가상 구름량',min:0,max:100,unit:'%'},
  {key:'sun',label:'가상 일사 강도',min:0,max:100,unit:'%'},
  {key:'snow',label:'가상 적설',min:0,max:15,unit:'cm'},
  {key:'wetness',label:'가상 습윤도',min:0,max:100,unit:'%'},
];
export function DemoDecisionPanel() {
  const {results,ready,error}=useDemoDecision();
  const demo=useDemoStore(),code=useAppStore(s=>s.selectedDistrictCode);
  const minutes=useAppStore(s=>s.timeMinutes),date=useAppStore(s=>s.date);
  const boxes=useMunicipalStore(s=>s.snowBoxes),boxesReady=useMunicipalStore(s=>s.snowBoxReady);
  const boxCount=useMemo(()=>boxes.filter(f=>!code||f.properties.districtCode===code).length,[boxes,code]);
  const [showAll,setShowAll]=useState(false);
  const detailRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(demo.selectedId)detailRef.current?.scrollIntoView?.({block:'nearest',behavior:'smooth'});},[demo.selectedId,demo.selectionSeq]);
  useEffect(()=>{setShowAll(false);},[code]);
  const selected=results.find(r=>r.id===demo.selectedId),planned=results.filter(r=>demo.plan.includes(r.id));
  const scope=DISTRICTS.find(d=>d.code===code)?.name ?? '서울시 전체';
  const summary=summarizeDistrict(results);
  const preset=(name:'snow'|'thaw'|'night')=>{
    const values=name==='snow'?{temperature:-5,cloud:95,sun:25,snow:7,wetness:80}:name==='thaw'?{temperature:3,cloud:10,sun:95,snow:2,wetness:65}:{temperature:-7,cloud:20,sun:65,snow:3,wetness:85};
    for(const key of Object.keys(values) as (keyof DemoWeather)[])demo.setWeather(key,values[key]);
    useAppStore.getState().setTimeMinutes(name==='night'?1200:name==='thaw'?780:480);
  };
  if(!code) return <section className="district-city-summary"><span className="eyebrow">서울시 전체 · 가상 시연</span><h2>담당 구를 선택하세요</h2><p className="caption">구를 누르면 지도 전체 범위와 그 구의 판단 요약을 함께 보여줍니다. 아래 판단은 구별 가상 장소 6곳 기준입니다.</p>{error?<p role="alert">{error}</p>:!ready?<p role="status">구 자료 준비 중…</p>:<div className="district-choice-list">{DISTRICTS.map(d=>{const s=summarizeDistrict(results.filter(r=>r.districtCode===d.code));return <button className="btn" key={d.code} onClick={()=>useAppStore.getState().selectDistrict(d.code)}><strong>{d.name}</strong><span>가상 {s.total}곳 중 제설 검토 {s.urgent}곳</span></button>;})}</div>}</section>;
  return <section className="demo-decision district-report" aria-label={`${scope} 판단 요약`}>
    <span className="eyebrow">선택한 구 · 가상 시연</span><h2>{scope} 제설 판단 (가상)</h2>
    <p className="district-report-time">{date.getFullYear()}.{date.getMonth()+1}.{date.getDate()} {formatMinutes(minutes)} 기준 · 가상 조건</p>
    {error?<p className="notice-warning" role="alert">구 자료를 확인할 수 없어 판단을 보류합니다. {error}</p>:!ready?<p role="status">선택한 구의 자료 준비 중…</p>:<>
      <div className={`district-verdict ${summary.urgent?'urgent':summary.inspect?'inspect':'monitor'}`}>
        <span>현재 판단 · 시연</span><strong>{summary.title}</strong><p>{summary.reason}</p>
      </div>
      <p className="caption">가상 장소 {summary.total}곳의 검토 현황</p><div className="district-counts"><div><b>{summary.urgent}</b><span>제설 검토</span></div><div><b>{summary.inspect}</b><span>결빙 확인 필요</span></div><div><b>{summary.monitor}</b><span>경과 관찰</span></div></div>
      <p className="district-sample-note">가상 장소 {summary.total}곳의 요약입니다. 실제 구 전체 위험·도로 분석이나 제설 지시가 아닙니다.</p>
      <div className="district-weather-summary"><span>기온 가정 <b>{demo.weather.temperature}℃</b></span><span>적설 가정 <b>{demo.weather.snow}cm</b></span><span>구름 가정 <b>{demo.weather.cloud}%</b></span></div>
      {selected ? <div ref={detailRef} className="demo-evidence" aria-label="가상 구역 판단 근거">
        <div className="evidence-heading"><span>선택 장소 {selected.name.slice(-1)} · 가상</span><button className="btn btn-ghost" onClick={()=>demo.select(null)}>상세 닫기</button></div>
        <h3>{selected.profile.name.replace(' 가정','')}</h3><strong>{selected.action}</strong>
        <ul>{selected.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>
        <div className="district-detail-actions"><button className="btn" onClick={()=>useAppStore.getState().flyTo(...selected.position)}>이 장소 확대</button><button className="btn" onClick={()=>useAppStore.getState().selectDistrict(code)}>구 전체 보기</button></div>
        <label className="demo-plan-check"><input type="checkbox" checked={demo.plan.includes(selected.id)} disabled={!demo.plan.includes(selected.id)&&demo.plan.length>=demo.capacity} onChange={()=>demo.togglePlan(selected.id)} aria-label={`${selected.name} 가상 계획에 담기`}/>이 장소를 가상 계획에 담기</label>
        <details className="detail-section"><summary>제설 상태·점수 확인</summary><label>이 장소의 제설 상태(가정)<select aria-label="선택 구역 제설 상태" value={selected.treatment} onChange={e=>demo.setTreatment(selected.id,e.target.value as DemoTreatment)}><option value="pending">미처리</option><option value="working">작업 중</option><option value="done">처리 완료</option></select></label><p className="caption">위험 시연점수 {selected.risk} · 우선순위 {selected.priority} · 통행 수요 가정 {selected.profile.demand}/100. 확률이 아니며 처리 완료도 안전을 보장하지 않습니다.</p></details>
      </div>:null}
      <h3 className="district-list-heading">{summary.urgent||summary.inspect?'먼저 확인할 장소':'계속 살펴볼 장소'}</h3>
      <p className="caption">장소를 눌러도 구 전체 지도는 유지됩니다.</p>
      <ul className="demo-ranking">{results.slice(0,showAll?results.length:3).map((r,i)=><li key={r.id} className={selected?.id===r.id?'selected':''}>
        <button className="demo-row" aria-label={`${r.name} 판단 근거`} onClick={()=>{demo.select(r.id);useAppStore.getState().selectFeature(null);}}><b className="demo-rank">{i+1}</b><span><strong>{r.profile.name.replace(' 가정','')}</strong><small>가상 장소 {r.name.slice(-1)}{demo.plan.includes(r.id)?' · 계획에 담음':''}</small><em>{r.action}</em></span></button>
      </li>)}</ul>
      {results.length>3 && <button className="btn district-more" onClick={()=>setShowAll(!showAll)}>{showAll?'주요 3곳만 보기':`가상 장소 ${results.length}곳 모두 보기`}</button>}
    </>}
    <details className="detail-section"><summary>가상 날씨 바꾸기</summary>
      <div className="demo-presets"><button className="btn" onClick={()=>preset('snow')}>☁ 강설 아침</button><button className="btn" onClick={()=>preset('thaw')}>☀ 맑은 오후</button><button className="btn" onClick={()=>preset('night')}>☾ 재결빙 밤</button></div>
      {controls.map(c=><label className="demo-control" key={c.key}><span>{c.label}<strong>{demo.weather[c.key]}{c.unit}</strong></span><input type="range" min={c.min} max={c.max} step={1} aria-label={c.label} value={demo.weather[c.key]} onChange={e=>demo.setWeather(c.key,Number(e.target.value))}/></label>)}
      <p className="caption">기상·그늘 노출은 가정입니다. 실제 건물 그늘 분석과 연결하지 않았으며 야간에는 일사 기여가 0입니다.</p><button className="btn btn-ghost" onClick={()=>demo.reset()}>가상 조건 초기화</button>
    </details>
    <details className="detail-section"><summary>가상 작업계획 ({planned.length}/{demo.capacity}곳)</summary>
      <label className="demo-capacity">한 번에 검토할 구역<select aria-label="가상 작업 한도" value={demo.capacity} onChange={e=>{const n=Number(e.target.value);demo.setCapacity(n);demo.setPlan(planned.slice(0,n).map(r=>r.id));}}>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}곳</option>)}</select></label>
      <button className="btn btn-primary" disabled={!ready||!!error} onClick={()=>demo.setPlan(results.filter(r=>r.action!=='모니터링').slice(0,demo.capacity).map(r=>r.id))}>상위 {demo.capacity}곳으로 계획 교체</button>
      <div className="demo-plan">{planned.length?<ol>{planned.map(r=><li key={r.id}>가상 장소 {r.name.slice(-1)} — {r.action}</li>)}</ol>:<p>담아 둔 장소가 없습니다.</p>}<p className="caption">현재 조건으로 재평가합니다. 한도 감소 시 높은 우선순위부터 남기고, 구를 바꾸면 비웁니다. 실제 배차·작업 명령은 아닙니다.</p><button className="btn btn-ghost" onClick={()=>demo.setPlan([])}>계획 비우기</button></div>
    </details>
    <details className="detail-section"><summary>참고 시설·자료의 신뢰도</summary><p className="caption">선택 구의 공개 제설함: {boxesReady?`${boxCount.toLocaleString('ko-KR')}개`:'자료 준비 중'}. 위치 참고이며 재고·운영 상태는 확인되지 않았습니다.</p><p className="caption"><strong>태양 위치:</strong> 날짜·좌표에 따른 천문 계산. <strong>그늘·일조:</strong> 건물·추정 지면에 따른 모델 결과로 실측 일사량이 아니며 현장 미검증. <strong>현재 제설 판단:</strong> 가정으로 만든 시연 규칙. 제설 결정의 실제 근거로 사용하지 않습니다.</p><p className="caption">저온×습윤, 잔설, 그늘 노출, 경사에 햇빛 가정을 결합한 예시 규칙입니다. 실제 노면온도·제설 이력·현장 검증 자료를 연결한 후 평가해야 합니다.</p></details>
  </section>;
}
