import { SimpleMeshLayer } from '@deck.gl/mesh-layers';
import { IconLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import { CROWN_MESH, TRUNK_MESH, CONIFER_MESH, type TreeVisual } from '@/map/treeModels';

export const TREE_DECK_IDS = ['seoul-tree-trunks','seoul-tree-crowns','seoul-tree-conifers','seoul-tree-unsized'];
export function makeTreeLayers(trees:TreeVisual[],visible:boolean): Layer[] {
  if (!visible || !trees.length) return [];
  const modeled=trees.filter(t=>t.modeled);
  const material={ambient:0.55,diffuse:0.7,shininess:4,specularColor:[25,30,20] as [number,number,number]};
  const common={pickable:true,shadowEnabled:false,material};
  return [
    new SimpleMeshLayer<TreeVisual>({...common,id:TREE_DECK_IDS[0],data:modeled,mesh:TRUNK_MESH,
      getPosition:t=>t.position,getColor:[112,78,48,255],
      getScale:t=>[Math.min(.45,Math.max(.1,t.width!*.045)),Math.min(.45,Math.max(.1,t.width!*.045)),t.height!*.42]}),
    new SimpleMeshLayer<TreeVisual>({...common,id:TREE_DECK_IDS[1],data:modeled.filter(t=>!t.conifer),mesh:CROWN_MESH,
      getPosition:t=>[t.position[0],t.position[1],t.position[2]+t.height!*.64],
      getScale:t=>[t.width!/2,t.width!/2,t.height!*.36],getColor:t=>t.color}),
    new SimpleMeshLayer<TreeVisual>({...common,id:TREE_DECK_IDS[2],data:modeled.filter(t=>t.conifer),mesh:CONIFER_MESH,
      getPosition:t=>[t.position[0],t.position[1],t.position[2]+t.height!*.25],
      getScale:t=>[t.width!/2,t.width!/2,t.height!*.75],getColor:t=>t.color}),
    new IconLayer<TreeVisual>({id:TREE_DECK_IDS[3],data:trees.filter(t=>!t.modeled),pickable:true,
      getPosition:t=>t.position,getIcon:()=>({url:'/tree-unsized.svg',width:48,height:64,anchorY:64}),
      getSize:26,sizeUnits:'pixels',billboard:true}),
  ];
}
