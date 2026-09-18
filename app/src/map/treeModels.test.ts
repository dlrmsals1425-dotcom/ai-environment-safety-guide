import { describe, expect, it } from 'vitest';
import { prepareTreeVisuals, CROWN_MESH, CONIFER_MESH, TRUNK_MESH } from '@/map/treeModels';
import type { SeoulTreeFeature } from '@/types/seoul';

const ground={width:2,height:2,west:127,north:37.6,step:.1,values:new Float32Array([120,120,120,120])};
const tree:SeoulTreeFeature={type:'Feature',geometry:{type:'Point',coordinates:[127.05,37.55]},
  properties:{id:'tree-1',dataset:'street',gu:'성동구',species:'은행나무',heightM:12,crownWidthM:6,
    rawHeight:12,rawCrownWidth:6,quality:'valid',sourceYear:2013}};
describe('tree geometry data contract', () => {
  it('preserves source height/width and anchors at terrain, not sea level', () => {
    const [model]=prepareTreeVisuals([tree],ground);
    expect(model.position[2]).toBe(120);
    expect(model.height).toBe(12); expect(model.width).toBe(6);
    expect(model.modeled).toBe(true); expect(model.conifer).toBe(false);
    expect(prepareTreeVisuals([{...tree,properties:{...tree.properties,species:'소나무'}}],ground)[0].conifer).toBe(true);
  });
  it('does not manufacture dimensions for missing or out-of-range source values', () => {
    for (const heightM of [null,0,100]) {
      const [model]=prepareTreeVisuals([{...tree,properties:{...tree.properties,heightM}}],ground);
      expect(model.modeled).toBe(false); expect(model.height).toBeNull();
    }
    expect(prepareTreeVisuals([{...tree,properties:{...tree.properties,crownWidthM:null}}],ground)[0].modeled).toBe(false);
  });
  it('does not place trees at invented zero elevation while ground is unavailable', () => {
    expect(prepareTreeVisuals([tree],null)).toEqual([]);
    expect(prepareTreeVisuals([{...tree,geometry:{type:'Point',coordinates:[128,38]}}],ground)).toEqual([]);
  });
  it('meshes have finite normals and unit bounds so dimensions scale in metres', () => {
    for (const mesh of [CROWN_MESH,CONIFER_MESH,TRUNK_MESH]) {
      const p=mesh.attributes.POSITION.value,n=mesh.attributes.NORMAL.value;
      expect(p.length).toBe(n.length);
      expect(p.every(Number.isFinite)).toBe(true); expect(n.every(Number.isFinite)).toBe(true);
      expect(Math.max(...p)).toBeCloseTo(1); expect(Math.min(...p)).toBeGreaterThanOrEqual(-1);
    }
  });
});
