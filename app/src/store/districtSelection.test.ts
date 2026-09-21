import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './appStore';
import { emptyDatasetState } from '@/types/seoul';
import { squareBboxAround } from '@/geo/aoi';
describe('area changes discard old scenes',()=>{
  beforeEach(()=>useAppStore.setState({selectedDistrictCode:null,districtView:null,aoi:null,origin:null,buildings:[],seoulBuildingSeq:0,seoulTreeSeq:0}));
  it('invalidates old load sequences immediately before the new load effect begins',()=>{
    const old=useAppStore.getState().beginSeoulBuildingLoad();
    useAppStore.setState({buildings:[{} as never],seoulBuildings:{...emptyDatasetState(),status:'ready',features:[{} as never]},seoulTrees:{...emptyDatasetState(),features:[{} as never]}});
    useAppStore.getState().confirmAoi(squareBboxAround({lat0:37.55,lon0:127.03},500));
    expect(useAppStore.getState().buildings).toHaveLength(0);
    expect(useAppStore.getState().seoulBuildings.features).toHaveLength(0);
    expect(useAppStore.getState().seoulTrees.features).toHaveLength(0);
    expect(useAppStore.getState().applySeoulBuildings(old,{...emptyDatasetState(),status:'ready'},0,[{} as never])).toBe(false);
  });
  it('changing districts clears AOI, analysis and selection without using district bounds as a huge analysis rectangle',()=>{
    useAppStore.getState().confirmAoi(squareBboxAround({lat0:37.55,lon0:127.03},500));
    useAppStore.setState({sunHours:new Float32Array([2]),selectedFeature:{kind:'snowBox',props:{},lngLat:{lng:127,lat:37.5}}});
    useAppStore.getState().selectDistrict('11650');
    expect(useAppStore.getState()).toMatchObject({selectedDistrictCode:'11650',aoi:null,origin:null,sunHours:null,selectedFeature:null});
    expect(useAppStore.getState().districtView?.bbox).toHaveLength(4);
    useAppStore.getState().setDistrictBoundariesVisible(false);
    expect(useAppStore.getState().selectedDistrictCode).toBe('11650');
  });
});
