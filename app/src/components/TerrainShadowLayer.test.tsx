import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TerrainShadowLayer } from '@/components/TerrainShadowLayer';
import { useAppStore } from '@/store/appStore';
import { emptyDatasetState } from '@/types/seoul';
import { DEFAULT_LAYERS } from '@/types/layers';
import { squareBboxAround } from '@/geo/aoi';

const api=vi.hoisted(()=>({initialize:vi.fn(),frame:vi.fn()}));
vi.mock('comlink',()=>({wrap:()=>api,proxy:(x:unknown)=>x}));
const terminate=vi.fn();
const WorkerMock=vi.fn(function(){return {terminate};});
const origin={lat0:37.5264,lon0:126.925};
function mapStub() {
  const sources=new Map<string,{updateImage:ReturnType<typeof vi.fn>}>(),layers=new Set<string>();
  return {sources,getStyle:()=>({}),isStyleLoaded:()=>true,on:vi.fn(),off:vi.fn(),
    getSource:(id:string)=>sources.get(id),getLayer:(id:string)=>layers.has(id),
    addSource:vi.fn((id:string)=>sources.set(id,{updateImage:vi.fn()})),
    addLayer:vi.fn((layer:{id:string})=>layers.add(layer.id)),
    removeLayer:vi.fn((id:string)=>layers.delete(id)),removeSource:vi.fn((id:string)=>sources.delete(id))};
}
describe('continuous ground shadow preview',()=>{
  beforeEach(()=>{
    vi.useFakeTimers();vi.stubGlobal('Worker',WorkerMock);vi.clearAllMocks();
    api.initialize.mockResolvedValue(undefined);
    api.frame.mockImplementation(async(_minutes:number,cellSize:number)=>({image:new Blob(),
      spec:{originX:0,originY:0,cellSize,nx:1,ny:1}}));
    vi.stubGlobal('URL',class extends URL {static createObjectURL=vi.fn(()=> 'blob:frame');static revokeObjectURL=vi.fn();});
    useAppStore.setState({aoi:{bbox:squareBboxAround(origin,500)},origin,date:new Date(2026,11,21),timeMinutes:720,
      buildings:[],seoulBuildings:{...emptyDatasetState(),status:'ready'},
      ground:{width:2,height:2,west:126,north:38,step:1,values:new Float32Array(4)},layers:{...DEFAULT_LAYERS}});
  });
  afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
  it('reuses worker/source when sliding, keeps the last frame, and refines after settling',async()=>{
    const map=mapStub();
    await act(async()=>{render(<TerrainShadowLayer map={map as never}/>);});
    expect(api.initialize).toHaveBeenCalledTimes(1);
    expect(map.addSource).toHaveBeenCalledTimes(1);
    await act(async()=>{useAppStore.getState().setTimeMinutes(840);});
    expect(WorkerMock).toHaveBeenCalledTimes(1);
    expect(api.initialize).toHaveBeenCalledTimes(1);
    expect(terminate).not.toHaveBeenCalled();
    expect(map.removeLayer).not.toHaveBeenCalled();expect(map.removeSource).not.toHaveBeenCalled();
    expect(map.sources.get('seoul-ground-shadow')?.updateImage).toHaveBeenCalled();
    await act(async()=>{vi.advanceTimersByTime(220);});
    expect(api.frame).toHaveBeenLastCalledWith(840,2,true);
    expect(screen.getByRole('status')).toHaveTextContent('14:00 바닥 그늘 · 기본 2m / 경계');
    await act(async()=>{useAppStore.getState().setLayerVisible('realtimeShadow',false);});
    expect(terminate).toHaveBeenCalledTimes(1);
    expect(map.removeLayer).toHaveBeenCalledTimes(1);
  });
});
