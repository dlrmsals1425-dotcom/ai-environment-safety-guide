import { useEffect, useMemo, useState } from 'react';
import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';
import { useRiskStore } from '@/store/riskStore';
import { useAppStore } from '@/store/appStore';
import { riskDisplayFeature } from '@/data/riskData';
import { combineLocalDateMinutes } from '@/solar/sunVector';
import { formatMinutes } from '@/lib/time';

export const RISK_LAYER='seonje-risk-points';
export function RiskMapLayer({map}:{map:MapLibreMap}) {
  const bundle=useRiskStore(s=>s.bundle),visible=useRiskStore(s=>s.visible);
  const date=useAppStore(s=>s.date),minutes=useAppStore(s=>s.timeMinutes);
  const [renderError,setRenderError]=useState('');
  const features=useMemo(()=>bundle?.features.map(f=>riskDisplayFeature(f,combineLocalDateMinutes(date,minutes).getTime(),bundle.purpose==='test')) ?? [],[bundle,date,minutes]);
  useEffect(()=>{
    const apply=()=>{
    if (!map.getStyle()) return;
    if (!map.isStyleLoaded()) {map.off('idle',apply);map.once('idle',apply);return;}
    map.off('idle',apply);
    try {
    if (!map.getSource(RISK_LAYER)) {
      map.addSource(RISK_LAYER,{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    }
    if (!map.getLayer(RISK_LAYER)) {
      map.addLayer({id:RISK_LAYER,type:'circle',source:RISK_LAYER,paint:{
        'circle-radius':9,'circle-color':['case',['all',['==',['get','isTest'],true],['!=',['get','level'],'insufficient']],'#8b70c5',['match',['get','level'],'observed_ice','#d94343','caution','#db8b14','#7c8da3']],
        'circle-stroke-color':['case',['==',['get','isTest'],true],'#ccb8f0','#ffffff'],'circle-stroke-width':3,'circle-opacity':0.95}});
    }
    if (!map.getLayer(RISK_LAYER) || !map.getSource(RISK_LAYER)) throw new Error('지도 레이어 연결 실패');
    (map.getSource(RISK_LAYER) as GeoJSONSource).setData({type:'FeatureCollection',features:features as never});
    map.setLayoutProperty(RISK_LAYER,'visibility',visible ? 'visible' : 'none');
    setRenderError('');
    } catch(e) {setRenderError(`위험지점 표시 실패 · 지도에 점이 없다고 안전한 것이 아닙니다. ${e instanceof Error ? e.message : ''}`);}
    };
    const lost=()=>setRenderError('지도 그래픽 연결이 끊겼습니다. 표시가 복구되기 전에는 지도를 위험 판단에 사용하지 마세요.');
    map.on('style.load',apply);map.on('webglcontextlost',lost);map.on('webglcontextrestored',apply);apply();
    return ()=>{map.off('idle',apply);map.off('style.load',apply);map.off('webglcontextlost',lost);map.off('webglcontextrestored',apply);};
  },[map,features,visible]);
  useEffect(()=>()=>{
    if (!map.getStyle()) return;
    if (map.getLayer(RISK_LAYER)) map.removeLayer(RISK_LAYER);
    if (map.getSource(RISK_LAYER)) map.removeSource(RISK_LAYER);
  },[map]);
  const difference=combineLocalDateMinutes(date,minutes).getTime()-Date.now();
  const context=difference< -600_000 ? '과거 시각 · 현재 상태 아님' : difference>600_000 ? '미래 시각 · 예보 근거 확인' : '선택시각 자료 · 자동 갱신 아님';
  if (renderError && bundle && visible) return <div className="risk-map-legend notice-warning" role="alert">{renderError}</div>;
  return bundle && visible ? <div className="risk-map-legend"><strong>{bundle.purpose==='test' ? '가상 테스트 · 실제 위험 아님' : '제공된 위험지점'}</strong><span>{date.getFullYear()}-{String(date.getMonth()+1).padStart(2,'0')}-{String(date.getDate()).padStart(2,'0')} {formatMinutes(minutes)} 한국시간</span><span>{context}</span>{bundle.purpose==='test' ? <span><i className="dot" style={{background:'#8b70c5'}}/>보라색 테두리: 테스트 지점</span> : <span><i className="dot danger"/>결빙 확인 <i className="dot caution"/>우려·추정 <i className="dot unknown"/>판단 보류</span>}<span>원은 위치 표시이며 영향 범위가 아닙니다.<br/>회색·자료 없음은 안전을 뜻하지 않습니다.</span></div> : null;
}
