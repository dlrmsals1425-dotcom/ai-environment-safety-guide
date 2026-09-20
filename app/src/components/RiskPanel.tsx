import { useEffect, useRef, useState } from 'react';
import { parseRiskBundle, riskDisplayFeature } from '@/data/riskData';
import { useRiskStore } from '@/store/riskStore';
import { useAppStore } from '@/store/appStore';
import { combineLocalDateMinutes } from '@/solar/sunVector';
import { squareBboxAround } from '@/geo/aoi';

export function RiskPanel() {
  const bundle=useRiskStore(s=>s.bundle),setBundle=useRiskStore(s=>s.setBundle);
  const visible=useRiskStore(s=>s.visible),setVisible=useRiskStore(s=>s.setVisible);
  const date=useAppStore(s=>s.date),minutes=useAppStore(s=>s.timeMinutes);
  const flyTo=useAppStore(s=>s.flyTo),selectFeature=useAppStore(s=>s.selectFeature);
  const [error,setError]=useState('');
  const input=useRef<HTMLInputElement>(null);
  const loadSequence=useRef(0);
  useEffect(()=>()=>{loadSequence.current+=1;},[]);
  const features=bundle?.features.map(f=>riskDisplayFeature(f,combineLocalDateMinutes(date,minutes).getTime(),bundle.purpose==='test')) ?? [];
  async function load(file:File) {
    const sequence=++loadSequence.current;
    try {
      if (file.size>5*1024*1024) throw new Error('5MB 이하의 위험지점 JSON 파일을 선택하세요.');
      const content=await file.text();
      if (sequence!==loadSequence.current) return;
      const next=parseRiskBundle(JSON.parse(content));
      setBundle(next);selectFeature(null);setError('');
    } catch(e) {if(sequence===loadSequence.current) setError(`${e instanceof Error ? e.message : '자료를 읽지 못했습니다.'}${useRiskStore.getState().bundle ? ' 이전 자료를 유지합니다.' : ''}`);}
  }
  return <section className="risk-panel">
    <div className="section-heading"><div><span className="eyebrow">WINTER ROAD WATCH</span><h2>어디를 먼저 살펴볼까요?</h2></div><span className="status-pill">{bundle ? '파일 자료' : '자료 대기'}</span></div>
    <div className="weather-mini"><div><span>기온</span><strong>—<small>°C</small></strong></div><div><span>노면온도</span><strong>—<small>°C</small></strong></div><div><span>강수·적설</span><strong>—</strong></div></div>
    <p className="caption">기상청 자동 수집은 아직 연결되지 않았습니다.</p>
    {!bundle ? <div className="empty-risk"><span className="empty-risk-icon">❄</span><h3>위험을 판단할 자료가 필요해요</h3><p>그늘만으로 결빙을 확정할 수 없어요. 기상과 노면 자료가 연결되면 지점별 근거를 함께 살펴볼 수 있습니다.</p><span className="neutral-note">자료 없음은 ‘안전’이 아닙니다.</span></div> : <>
      {bundle.purpose==='test' && <p className="notice-warning">가상 테스트 자료입니다. 실제 위험 지점이 아닙니다.</p>}
      <div className="risk-counts"><div><b>{features.filter(f=>f.properties.level==='observed_ice').length}</b><span>결빙 확인 자료</span></div><div><b>{features.filter(f=>f.properties.level==='caution').length}</b><span>우려·추정</span></div><div><b>{features.filter(f=>f.properties.level==='insufficient').length}</b><span>판단 보류</span></div></div>
      <p className="caption">출처: {bundle.source}<br/>생성: {bundle.generatedAt} · 파일 전체 {features.length}지점</p>
      <label className="layer-item"><input type="checkbox" checked={visible} onChange={e=>setVisible(e.target.checked)}/>지도에 위험지점 표시</label>
      <ul className="risk-list">{features.slice(0,30).map(f=><li key={f.properties.id}><button onClick={()=>{const [lng,lat]=f.geometry.coordinates;const state=useAppStore.getState();state.confirmAoi(squareBboxAround({lon0:lng,lat0:lat},state.selectionSizeM));flyTo(lng,lat);selectFeature({kind:'risk',props:f.properties,lngLat:{lng,lat}});}}><span className={`risk-tag ${f.properties.level}`}>{f.properties.statusLabel}</span><small className="caption">{f.properties.inputKindLabel} · {f.properties.qualityLabel}</small><strong>{f.properties.name}</strong><span>{f.properties.reason}</span></button></li>)}</ul>
      {features.length===0 && <p className="panel-hint">자료에 지점이 없습니다. 안전 판정을 뜻하지 않습니다.</p>}
      {features.length>30 && <p className="caption">목록에는 처음 30개, 지도에는 전체 지점을 표시합니다.</p>}
      <button className="btn btn-ghost" onClick={()=>{loadSequence.current+=1;setBundle(null);selectFeature(null);setError('');}}>불러온 자료 지우기</button>
    </>}
    <div className="risk-key"><span><i className="dot danger"/>현장 확인 자료</span><span><i className="dot caution"/>모델의 우려 지점</span><span><i className="dot unknown"/>시간 불일치·자료 부족</span></div>
    <details className="detail-section"><summary>팀 자료 연결</summary><p className="panel-hint">서버에서 산출한 위험지점 파일을 검토할 수 있습니다. 이 브라우저에만 적용되며 서버에 업로드하지 않습니다. 날짜·시간은 자료의 유효기간에 맞춰 선택하세요.</p><input ref={input} type="file" accept=".json,.geojson,application/json" aria-label="위험지점 JSON 파일" onChange={e=>{const file=e.target.files?.[0];if(file) void load(file);e.target.value='';}}/><p><a href="/guides/risk-contract.md" target="_blank" rel="noreferrer">위험지점 파일 형식 보기 ↗</a></p></details>
    {error && <p className="notice-warning" role="alert">{error}</p>}
  </section>;
}
