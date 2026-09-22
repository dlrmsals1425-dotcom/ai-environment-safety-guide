import { useEffect, useMemo, useState } from 'react';
import { Marker, type Map as MapLibreMap, type GeoJSONSource } from 'maplibre-gl';
import { useAppStore } from '@/store/appStore';
import { useDemoDecision } from '@/data/useDemoDecision';
import { demoFeature } from '@/data/demoDecision';
import { useDemoStore } from '@/store/demoStore';
const SOURCE='synthetic-decision-areas';
export const DEMO_FILL='synthetic-decision-fill';
const LINE='synthetic-decision-line';
export function DemoMapLayer({map}:{map:MapLibreMap}) {
  const districtCode=useAppStore(s=>s.selectedDistrictCode);
  const {results}=useDemoDecision();const enabled=useDemoStore(s=>s.enabled),plan=useDemoStore(s=>s.plan),selected=useDemoStore(s=>s.selectedId);
  const [error,setError]=useState('');
  const features=useMemo(()=>results.map(r=>demoFeature(r,plan.includes(r.id),selected===r.id)),[results,plan,selected]);
  useEffect(()=>{
    let active=true;
    const apply=()=>{
      if(!active||!map.getStyle())return;
      if(!map.isStyleLoaded()){map.off('idle',apply);map.once('idle',apply);return;}
      try{
        if(!map.getSource(SOURCE))map.addSource(SOURCE,{type:'geojson',data:{type:'FeatureCollection',features:[]}});
        if(!map.getLayer(DEMO_FILL))map.addLayer({id:DEMO_FILL,type:'fill',source:SOURCE,paint:{'fill-color':['get','color'],'fill-opacity':.5}});
        if(!map.getLayer(LINE))map.addLayer({id:LINE,type:'line',source:SOURCE,paint:{'line-color':['case',['==',['get','selected'],true],'#ffffff',['==',['get','planned'],true],'#0e6c9b','#745da3'],'line-width':['case',['==',['get','planned'],true],4,2],'line-dasharray':[3,2]}});
        (map.getSource(SOURCE) as GeoJSONSource).setData({type:'FeatureCollection',features:enabled&&districtCode?features:[]});
        for(const id of [DEMO_FILL,LINE])map.setLayoutProperty(id,'visibility',enabled?'visible':'none');
        setError('');
      }catch(e){setError(`가상 지도 표시 실패: ${String(e)}`);}
    };
    map.on('style.load',apply);apply();return()=>{active=false;map.off('idle',apply);map.off('style.load',apply);};
  },[map,features,enabled,districtCode]);
  useEffect(()=>{
    if(!enabled || !districtCode)return;
    const markers=results.slice(0,12).map(r=>{
      const element=document.createElement('button');element.type='button';
      element.className=`demo-marker${selected===r.id?' selected':''}${plan.includes(r.id)?' planned':''}`;
      element.textContent=`가상 ${r.name.slice(-1)} · ${r.action==='제설 우선 검토'?'제설 검토':r.action==='결빙 우려 확인'?'결빙 우려':'경과 관찰'}`;
      element.setAttribute('aria-label',`${r.name} 지도에서 선택`);
      element.style.background=r.action==='제설 우선 검토'?'#a93568':r.action==='결빙 우려 확인'?'#986219':'#666a98';
      element.addEventListener('click',e=>{e.stopPropagation();useDemoStore.getState().select(r.id);useAppStore.getState().selectFeature(null);});
      return new Marker({element,anchor:'bottom',opacityWhenCovered:'0.8'}).setLngLat(r.position).addTo(map);
    });
    return()=>markers.forEach(marker=>marker.remove());
  },[map,enabled,results,selected,plan,districtCode]);
  useEffect(()=>()=>{if(!map.getStyle())return;for(const id of [LINE,DEMO_FILL])if(map.getLayer(id))map.removeLayer(id);if(map.getSource(SOURCE))map.removeSource(SOURCE);},[map]);
  return enabled?<div className="demo-map-legend"><strong>가상 시나리오 · 실제 위험 아님</strong><span>분홍: 제설 우선 검토 · 주황: 결빙 우려 확인</span><span>보라: 모니터링 · 청색 테두리: 계획에 담음</span><span>구 안의 가상 장소를 눌러 상세 확인</span><span>구 전체 위험 분석 결과 아님</span>{error&&<span role="alert">{error}</span>}</div>:null;
}
