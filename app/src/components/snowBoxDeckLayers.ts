import { SimpleMeshLayer } from '@deck.gl/mesh-layers';
import type { Layer } from '@deck.gl/core';
import { SNOW_BOX_BODY, SNOW_BOX_LID, SNOW_BOX_TRIM, SNOW_BOX_MARK, type SnowBoxVisual } from '@/map/snowBoxModels';

export const SNOW_BOX_DECK_IDS=['seoul-box-body','seoul-box-lid','seoul-box-trim','seoul-box-mark'];
export function makeSnowBoxLayers(boxes:SnowBoxVisual[],visible:boolean,scale:number):Layer[] {
  if(!visible || !boxes.length) return [];
  const parts=[{mesh:SNOW_BOX_BODY,color:[234,134,35,255]},{mesh:SNOW_BOX_LID,color:[47,102,135,255]},
    {mesh:SNOW_BOX_TRIM,color:[54,64,69,255]},{mesh:SNOW_BOX_MARK,color:[248,249,242,255]}];
  return parts.map((p,i)=>new SimpleMeshLayer<SnowBoxVisual>({id:SNOW_BOX_DECK_IDS[i],data:boxes,mesh:p.mesh,
    getPosition:b=>b.position,getScale:[scale,scale,scale],getColor:p.color as [number,number,number,number],
    pickable:true,material:{ambient:.7,diffuse:.65,shininess:12,specularColor:[60,60,60]}}));
}
