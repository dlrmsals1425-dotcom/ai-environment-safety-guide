import { useEffect, useRef, useState } from 'react';
import { wrap } from 'comlink';
import type { Map as MapLibreMap, ImageSource } from 'maplibre-gl';
import type { PreviewApi, PreviewFrameResult } from '@/analysis/previewWorker';
import { LatestTask } from '@/analysis/latestTask';
import { cropGround, groundCovers } from '@/data/ground';
import { gridWgsBounds } from '@/analysis/grid';
import { sunHoursImageCoordinates } from '@/analysis/heatmap';
import { analysisBlockReason } from '@/analysis/gating';
import { useAppStore } from '@/store/appStore';
import { bufferBboxMeters } from '@/geo/aoi';
import { formatMinutes } from '@/lib/time';
import spatialConfig from '../../config/spatial.json';
import { shadowPreviewCellSize } from '@/analysis/shadowPreview';

const ID='seoul-ground-shadow';
const SETTLE_MS=220;
type FrameRequest={minutes:number;cellSize:number;fine:boolean};
type Controller={request:(minutes:number)=>void;stop:()=>void};

export function TerrainShadowLayer({map}:{map:MapLibreMap}) {
  const buildings=useAppStore(s=>s.buildings);
  const dataset=useAppStore(s=>s.seoulBuildings);
  const ground=useAppStore(s=>s.ground);
  const aoi=useAppStore(s=>s.aoi);
  const origin=useAppStore(s=>s.origin);
  const date=useAppStore(s=>s.date);
  const minutes=useAppStore(s=>s.timeMinutes);
  const visible=useAppStore(s=>s.layers.realtimeShadow && !s.layers.sunHours);
  const controller=useRef<Controller | null>(null);
  const [status,setStatus]=useState('');

  // Time changes never dispose the worker, scene input, or map layer.
  useEffect(()=>{
    let active=true;
    let settleTimer:number | undefined;
    let pendingApply:(()=>void) | null=null;
    let displayedUrl:string | null=null;
    let pendingUrl:string | null=null;
    const remove=()=>{
      if (!map.getStyle()) return;
      if (map.getLayer(ID)) map.removeLayer(ID);
      if (map.getSource(ID)) map.removeSource(ID);
    };
    setStatus('');
    if (!visible) {remove();return;}
    const bbox=aoi ? bufferBboxMeters(aoi.bbox,spatialConfig.aoiBufferM) : null;
    const blocked=analysisBlockReason({aoiPresent:!!aoi,buildings:dataset,
      groundReady:!!bbox && groundCovers(ground,bbox)});
    if (blocked || !bbox || !origin || !ground) {
      remove();setStatus(`바닥 그늘 대기: ${blocked ?? '고도 자료를 불러오는 중입니다.'}`);return;
    }
    const worker=new Worker(new URL('../analysis/previewWorker.ts',import.meta.url),{type:'module'});
    const api=wrap<PreviewApi>(worker);
    // Static geometry is sent once per scene, not once per slider event.
    const initialized=api.initialize({buildings,ground:cropGround(ground,bbox,origin),aoi:bbox,origin,
      dateParts:{year:date.getFullYear(),month:date.getMonth(),day:date.getDate()}});
    const fineCell=shadowPreviewCellSize(bbox);
    const previewCell=Math.max(4,fineCell);
    let displayed:string | null=null;
    let requestedMinutes=useAppStore.getState().timeMinutes;
    let previousRequest:number | null=null;
    const applyWhenReady=()=>{
      if (pendingApply && map.getStyle() && map.isStyleLoaded()) {
        const apply=pendingApply;pendingApply=null;apply();
      }
    };
    map.on('idle',applyWhenReady);
    const queue=new LatestTask<FrameRequest,PreviewFrameResult>(async request=>{
      await initialized;
      return api.frame(request.minutes,request.cellSize,request.fine);
    },({image,spec},request)=>{
      if (!active || !map.getStyle()) return;
      const coordinates=sunHoursImageCoordinates(gridWgsBounds(spec,origin));
      if (pendingUrl) URL.revokeObjectURL(pendingUrl);
      const url=URL.createObjectURL(image);
      pendingUrl=url;
      pendingApply=()=>{
        if (!active || !map.getStyle()) return;
        const source=map.getSource(ID) as ImageSource | undefined;
        if (source && map.getLayer(ID)) source.updateImage({url,coordinates});
        else {
          map.addSource(ID,{type:'image',url,coordinates});
          map.addLayer({id:ID,type:'raster',source:ID,paint:{'raster-fade-duration':0,'raster-resampling':'linear'}},
            map.getLayer('aoi-line') ? 'aoi-line' : undefined);
        }
        if (displayedUrl) URL.revokeObjectURL(displayedUrl);
        displayedUrl=url;pendingUrl=null;
        displayed=`${formatMinutes(request.minutes)} 바닥 그늘 · ${request.fine
          ? `기본 ${request.cellSize}m / 경계 ${spec.cellSize}m`
          : `${request.cellSize}m 조작 미리보기`}`;
        const pending=request.minutes!==requestedMinutes || !request.fine;
        setStatus(`${displayed}${pending ? ` · ${formatMinutes(requestedMinutes)} 보정 중…` : ' · 주변 300m 포함'}`);
      };
      applyWhenReady();
    },error=>{
      if (active) setStatus(`${displayed ? `${displayed} 유지 · ` : ''}그늘 계산 오류: ${error instanceof Error ? error.message : String(error)}`);
    });
    const control:Controller={
      request(next){
        if (previousRequest===next) return;
        previousRequest=next;requestedMinutes=next;
        window.clearTimeout(settleTimer);
        setStatus(displayed ? `${displayed} 유지 · ${formatMinutes(next)} 갱신 중…` : `${formatMinutes(next)} 바닥 그늘 계산 중…`);
        queue.submit({minutes:next,cellSize:previewCell,fine:false});
        settleTimer=window.setTimeout(()=>queue.submit({minutes:next,cellSize:fineCell,fine:true}),SETTLE_MS);
      },
      stop(){active=false;window.clearTimeout(settleTimer);queue.dispose();worker.terminate();},
    };
    controller.current=control;
    control.request(requestedMinutes);
    return ()=>{
      control.stop();controller.current=null;pendingApply=null;
      map.off('idle',applyWhenReady);remove();
      if (displayedUrl) URL.revokeObjectURL(displayedUrl);
      if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    };
  },[map,buildings,dataset,ground,aoi,origin,date,visible]);

  useEffect(()=>{controller.current?.request(minutes);},[minutes]);
  return status ? <div className="map-shadow-status" role="status">{status}</div> : null;
}
