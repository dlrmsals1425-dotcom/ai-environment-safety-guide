import { describe, expect, it } from 'vitest';
import { MAX_SNOW_BOX_MODELS, prepareSnowBoxVisuals, snowBoxSymbolScale, SNOW_BOX_BODY, SNOW_BOX_LID, SNOW_BOX_MARK, SNOW_BOX_TRIM, type SnowBoxView } from './snowBoxModels';
import type { SnowBoxFeature } from '@/data/municipal';
const ground={width:2,height:2,west:126,north:38,step:1,values:new Float32Array([20,20,20,20])};
const view:SnowBoxView={zoom:18,latitude:37.5,bounds:[126.4,37.4,126.6,37.6]};
const feature=(id:string,x=126.5):SnowBoxFeature=>({type:'Feature',properties:{id,boxId:id,agency:'test',address:'test',districtCode:null,districtName:null,coordinateStatus:'inferred-projection',sourceRow:2},geometry:{type:'Point',coordinates:[x,37.5]}});
describe('snow box 3D location symbols',()=>{
  it('only models close-up viewport points and anchors their feet on ground',()=>{
    expect(prepareSnowBoxVisuals([feature('a')],ground,{...view,zoom:12})).toEqual([]);
    const result=prepareSnowBoxVisuals([feature('a'),feature('outside',126.9)],ground,view);
    expect(result).toHaveLength(1);expect(result[0].position[2]).toBeCloseTo(20.08);
    expect(prepareSnowBoxVisuals([feature('a')],null,view)).toEqual([]);
  });
  it('caps dense views while preserving stable source IDs for picking',()=>{
    const result=prepareSnowBoxVisuals(Array.from({length:MAX_SNOW_BOX_MODELS+20},(_,i)=>feature(String(i))),ground,view);
    expect(result).toHaveLength(MAX_SNOW_BOX_MODELS);expect(result[0].feature.properties.id).toBe('0');
  });
  it('uses smaller world-space symbols when zoomed in, with finite closed meshes',()=>{
    expect(snowBoxSymbolScale({...view,zoom:18})).toBeLessThan(snowBoxSymbolScale({...view,zoom:16}));
    for(const mesh of [SNOW_BOX_BODY,SNOW_BOX_LID,SNOW_BOX_TRIM,SNOW_BOX_MARK]) {
      const {POSITION,NORMAL}=mesh.attributes;
      expect(POSITION.value.length%9).toBe(0);expect(POSITION.value.length).toBe(NORMAL.value.length);
      expect([...POSITION.value,...NORMAL.value].every(Number.isFinite)).toBe(true);
      for(let i=0;i<NORMAL.value.length;i+=3) expect(Math.hypot(...NORMAL.value.slice(i,i+3))).toBeCloseTo(1);
    }
  });
});
