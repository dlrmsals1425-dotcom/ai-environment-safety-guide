import { useEffect, useMemo, useState } from 'react';
import { Marker, type Map as MapLibreMap, type GeoJSONSource } from 'maplibre-gl';
import { useAppStore } from '@/store/appStore';
import { useMunicipalStore } from '@/store/municipalStore';
import { DISTRICTS, filterSnowBoxes } from '@/data/municipal';

export const DISTRICT_FILL='seoul-district-fill';
export const DISTRICT_LINE='seoul-district-line';
export const BOX_LAYER='seoul-snow-boxes';
const DISTRICT_SOURCE='seoul-districts';

export function MunicipalMapLayer({map}:{map:MapLibreMap}) {
  const districts=useMunicipalStore(s=>s.districts),boxes=useMunicipalStore(s=>s.snowBoxes),query=useMunicipalStore(s=>s.snowBoxQuery);
  const modelIds=useMunicipalStore(s=>s.snowBoxModelIds);
  const code=useAppStore(s=>s.selectedDistrictCode),boundaries=useAppStore(s=>s.districtBoundariesVisible),showBoxes=useAppStore(s=>s.layers.snowBoxes);
  const shown=useMemo(()=>filterSnowBoxes(boxes,code,query),[boxes,code,query]);
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    const apply=()=>{
      if(!active || !map.getStyle()) return;
      if(!map.isStyleLoaded()) {map.off('idle',apply);map.once('idle',apply);return;}
      try {
        if(!map.getSource(DISTRICT_SOURCE)) map.addSource(DISTRICT_SOURCE,{type:'geojson',data:{type:'FeatureCollection',features:districts},attribution:'자치구 경계·제설함 © 서울특별시 (공공누리 1유형)'});
        if(!map.getLayer(DISTRICT_FILL)) map.addLayer({id:DISTRICT_FILL,type:'fill',source:DISTRICT_SOURCE,paint:{'fill-color':'#2782d5','fill-opacity':0.025}},map.getLayer('aoi-fill') ? 'aoi-fill' : undefined);
        if(!map.getLayer(DISTRICT_LINE)) map.addLayer({id:DISTRICT_LINE,type:'line',source:DISTRICT_SOURCE,paint:{'line-color':'#2878bd','line-width':1.5}});
        (map.getSource(DISTRICT_SOURCE) as GeoJSONSource).setData({type:'FeatureCollection',features:districts});
        map.setPaintProperty(DISTRICT_FILL,'fill-opacity',['case',['==',['get','code'],code ?? ''],0.12,0.018]);
        map.setPaintProperty(DISTRICT_LINE,'line-width',['case',['==',['get','code'],code ?? ''],3,1.3]);
        map.setPaintProperty(DISTRICT_LINE,'line-color',['case',['==',['get','code'],code ?? ''],'#075bb1','#6a94b8']);
        for(const id of [DISTRICT_FILL,DISTRICT_LINE]) map.setLayoutProperty(id,'visibility',boundaries ? 'visible':'none');
        if(!map.getSource(BOX_LAYER)) map.addSource(BOX_LAYER,{type:'geojson',data:{type:'FeatureCollection',features:[]},attribution:'제설함 © 서울특별시 (공공누리 1유형)'});
        if(!map.getLayer(BOX_LAYER)) map.addLayer({id:BOX_LAYER,type:'circle',source:BOX_LAYER,paint:{
          'circle-radius':['interpolate',['linear'],['zoom'],10,2,14,4,17,6],
          'circle-color':'#dc741b','circle-stroke-color':'#fff5e7','circle-stroke-width':1.2,'circle-opacity':0.9}},map.getLayer('seonje-risk-points') ? 'seonje-risk-points' : undefined);
        (map.getSource(BOX_LAYER) as GeoJSONSource).setData({type:'FeatureCollection',features:shown});
        map.setFilter(BOX_LAYER,modelIds.length ? ['!', ['in',['get','id'],['literal',modelIds]]] : null);
        map.setLayoutProperty(BOX_LAYER,'visibility',showBoxes ? 'visible':'none');
        setError('');
      } catch(e) {setError(`구 경계·제설함 표시 오류: ${e instanceof Error ? e.message : String(e)}`);}
    };
    map.on('style.load',apply);apply();
    return ()=>{active=false;map.off('idle',apply);map.off('style.load',apply);};
  },[map,districts,shown,code,boundaries,showBoxes,modelIds]);
  useEffect(()=>{
    if(!boundaries || !districts.length) return;
    const labels=DISTRICTS.map(d=>{
      const button=document.createElement('button');button.type='button';
      button.className=`district-map-label${code===d.code ? ' selected':''}`;
      button.textContent=d.name;button.setAttribute('aria-label',`${d.name} 선택`);
      button.setAttribute('aria-pressed',String(code===d.code));
      button.addEventListener('click',e=>{e.stopPropagation();useAppStore.getState().selectDistrict(d.code);});
      return new Marker({element:button,anchor:'center',opacityWhenCovered:'0.8'}).setLngLat(d.label).addTo(map);
    });
    return ()=>labels.forEach(label=>label.remove());
  },[map,boundaries,code,districts]);
  useEffect(()=>()=>{
    if(!map.getStyle()) return;
    for(const id of [BOX_LAYER,DISTRICT_LINE,DISTRICT_FILL]) if(map.getLayer(id)) map.removeLayer(id);
    for(const id of [BOX_LAYER,DISTRICT_SOURCE]) if(map.getSource(id)) map.removeSource(id);
  },[map]);
  return error ? <div className="map-warning" role="alert">{error}</div> : null;
}
