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
  const selected=results.find(r=>r.id===demo.selectedId),planned=results.filter(r=>demo.plan.includes(r.id));
  const scope=DISTRICTS.find(d=>d.code===code)?.name ?? '서울시 전체';
  const preset=(name:'snow'|'thaw'|'night')=>{
    const values=name==='snow'?{temperature:-5,cloud:95,sun:25,snow:7,wetness:80}:name==='thaw'?{temperature:3,cloud:10,sun:95,snow:2,wetness:65}:{temperature:-7,cloud:20,sun:65,snow:3,wetness:85};
    for(const key of Object.keys(values) as (keyof DemoWeather)[])demo.setWeather(key,values[key]);
    useAppStore.getState().setTimeMinutes(name==='night'?1200:name==='thaw'?780:480);
  };
  return <section className="demo-decision">
    <span className="eyebrow">가상 데이터 · 의사결정 연습</span><h2>{scope} 제설 우선순위</h2>
    <p className="demo-note">실제 위험·예보·출동 지시가 아닙니다. 표시 구역의 도로·경사·그늘·통행 조건도 모두 가정입니다.</p>
    <div className="demo-presets"><button className="btn" onClick={()=>preset('snow')}>☁ 강설 아침</button><button className="btn" onClick={()=>preset('thaw')}>☀ 맑은 오후</button><button className="btn" onClick={()=>preset('night')}>☾ 재결빙 밤</button></div>
    <p className="demo-weather-strip">가정: {demo.weather.temperature}℃ · ☁ {demo.weather.cloud}% · ❄ {demo.weather.snow}cm</p>
    <details className="detail-section"><summary>1. 가상 기상 조건 조절</summary>
      {controls.map(c=><label className="demo-control" key={c.key}><span>{c.label}<strong>{demo.weather[c.key]}{c.unit}</strong></span><input type="range" min={c.min} max={c.max} step={1} aria-label={c.label} value={demo.weather[c.key]} onChange={e=>demo.setWeather(c.key,Number(e.target.value))}/></label>)}
      <p className="caption">태양 위치는 아래 날짜·시각으로 계산합니다. 일사 강도와 구름·구역별 그늘 노출은 가정이며, 실제 건물 그늘 분석 결과와 연결하지 않았습니다. 야간 일사 기여는 0입니다.</p>
    </details>
    {error && <p className="notice-warning" role="alert">구 경계 로딩 오류로 시연을 보류합니다. {error}</p>}
    {!ready && !error && <p role="status">구 경계 준비 중…</p>}
    {ready && <><div className="risk-counts"><div><b>{results.filter(r=>r.action==='제설 우선 검토').length}</b><span>가상 제설 우선</span></div><div><b>{results.filter(r=>r.risk>=50).length}</b><span>가상 위험 후보</span></div><div><b>{planned.length}</b><span>계획에 담은 곳</span></div></div>
      <p className="caption">구별 6개 가상 구역으로 동작을 설명합니다. 두 집계는 중복될 수 있으며 구 전체를 분석한 결과가 아닙니다.</p>
      <h3>2. 근거를 보고 대상 선택</h3>
      {selected && <div className="demo-evidence" aria-label="가상 구역 판단 근거"><h3>{selected.name}</h3><p><strong>위험 시연점수 {selected.risk} / 우선순위 {selected.priority}</strong></p><ul>{selected.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul><p className="caption">통행 수요 가정 {selected.profile.demand}/100도 우선순위에 반영합니다.</p><label>제설 작업 가정<select aria-label="선택 구역 제설 상태" value={selected.treatment} onChange={e=>demo.setTreatment(selected.id,e.target.value as DemoTreatment)}><option value="pending">미처리</option><option value="working">작업 중</option><option value="done">처리 완료</option></select></label><p className="caption">완료 가정은 잔설을 줄이지만 결빙 가능성을 0으로 만들지 않습니다. 실제 작업을 기록하거나 지시하지 않습니다.</p></div>}
      <ul className="demo-ranking">{results.slice(0,code?6:12).map((r,i)=><li key={r.id} className={selected?.id===r.id?'selected':''}>
        <button className="demo-row" aria-label={`${r.name} 판단 근거`} onClick={()=>{demo.select(r.id);useAppStore.getState().selectFeature(null);useAppStore.getState().flyTo(...r.position);}}><b className="demo-rank">{i+1}</b><span><strong>{r.name}</strong><small>{r.profile.name}</small><em>{r.action} · 우선순위 {r.priority}점</em></span></button>
        <label className="demo-plan-check"><input type="checkbox" checked={demo.plan.includes(r.id)} disabled={!demo.plan.includes(r.id)&&demo.plan.length>=demo.capacity} onChange={()=>demo.togglePlan(r.id)} aria-label={`${r.name} 가상 계획에 담기`}/>가상 계획에 담기</label>
      </li>)}</ul>
      {!code && <p className="caption">서울 전체에서는 상위 12곳을 보여줍니다. 담당 구를 선택하면 그 구의 6개 시연 구역을 확인할 수 있습니다.</p>}

      <h3>3. 가상 작업계획 비교</h3><label className="demo-capacity">한 번에 검토할 구역<select aria-label="가상 작업 한도" value={demo.capacity} onChange={e=>{const n=Number(e.target.value);demo.setCapacity(n);demo.setPlan(planned.slice(0,n).map(r=>r.id));}}>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}곳</option>)}</select></label>
      <button className="btn btn-primary" onClick={()=>demo.setPlan(results.filter(r=>r.action!=='모니터링').slice(0,demo.capacity).map(r=>r.id))}>상위 {demo.capacity}곳으로 계획 교체</button>
      <div className="demo-plan"><strong>가상 작업계획 · {planned.length}/{demo.capacity}곳</strong>{planned.length?<ol>{planned.map(r=><li key={r.id}>{r.name} — {r.action} ({r.priority}점)</li>)}</ol>:<p>후보를 선택하면 계획을 비교할 수 있습니다.</p>}<p className="caption">계획의 점수·순위는 현재 조건으로 재평가됩니다. 담아 둔 구역은 유지하며, 한도를 줄이면 현재 점수가 높은 선택부터 남깁니다. 구 변경 시 계획을 비웁니다. 실제 배차·최적 경로는 아닙니다.</p><button className="btn btn-ghost" onClick={()=>demo.setPlan([])}>계획 비우기</button></div>
    </>}
    <details className="detail-section"><summary>시연 점수의 계산 규칙</summary><p className="caption">검증되지 않은 예시 규칙입니다. 저온×습윤(최대 30), 잔설(최대 35), 그늘×습윤(최대 12), 경사(최대 10)를 더하고 낮의 햇빛 기여(최대 12)를 뺍니다. 우선순위에는 통행 수요와 미처리 여부도 반영합니다. 확률이나 공인 등급이 아니며 구름의 야간 복사 효과·제설제·포장 열수지는 계산하지 않습니다.</p></details>
    <button className="btn btn-ghost" onClick={()=>demo.reset()}>가상 조건 초기화</button>
  </section>;
}
