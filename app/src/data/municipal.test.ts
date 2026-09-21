import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DISTRICTS, filterSnowBoxes, parseMunicipalCollection, pointInDistrict, type DistrictFeature, type SnowBoxFeature } from './municipal';
const read=(name:string)=>JSON.parse(readFileSync(resolve('public/overlays',name),'utf8'));
describe('public Seoul municipal data',()=>{
  it('has 25 complete district polygons and representative labels inside each district',()=>{
    const fc=parseMunicipalCollection<DistrictFeature>(read('districts.geojson'),'districts');
    expect(fc.features).toHaveLength(25);
    for(const d of DISTRICTS) expect(pointInDistrict(d.label,fc.features.find(f=>f.properties.code===d.code)!)).toBe(true);
  });
  it('accounts for every supplied snow-box row and retains 10 unassigned positions',()=>{
    const fc=parseMunicipalCollection<SnowBoxFeature>(read('snow-boxes.geojson'),'snowBoxes');
    const meta=read('snow-boxes.meta.json');
    expect(fc.features).toHaveLength(10435);
    expect(meta.totalRows).toBe(meta.mappedRows+meta.unmappedRows);
    expect(fc.features.filter(f=>f.properties.districtCode===null)).toHaveLength(10);
    expect(Object.values(meta.districtCounts).reduce((a:any,b:any)=>a+b,0)).toBe(10435);
    const first=fc.features[0];
    expect(first.properties.boxId).toBe('서초4-006');
    expect(first.geometry.coordinates[0]).toBeGreaterThan(127);
    expect(first.geometry.coordinates[1]).toBeGreaterThan(37.49);
    expect(first.geometry.coordinates[1]).toBeLessThan(37.51);
  });
  it('filters by geographic district independently of managing agency, then address/number',()=>{
    const features=parseMunicipalCollection<SnowBoxFeature>(read('snow-boxes.geojson'),'snowBoxes').features;
    expect(filterSnowBoxes(features,'11650','')).toHaveLength(505);
    expect(filterSnowBoxes(features,'11650','서초4-006')).toHaveLength(1);
    expect(filterSnowBoxes(features,'11680','서초4-006')).toHaveLength(0);
    expect(filterSnowBoxes(features,null,'')).toHaveLength(10435);
  });
  it('matches every prepared district assignment against the shipped boundary geometry',()=>{
    const districts=parseMunicipalCollection<DistrictFeature>(read('districts.geojson'),'districts').features;
    const features=parseMunicipalCollection<SnowBoxFeature>(read('snow-boxes.geojson'),'snowBoxes').features;
    const mismatches=features.filter(f=>{
      const [x,y]=f.geometry.coordinates;
      const candidates=DISTRICTS.filter(d=>x>=d.bbox[0] && x<=d.bbox[2] && y>=d.bbox[1] && y<=d.bbox[3]);
      const hits=candidates.filter(d=>pointInDistrict([x,y],districts.find(p=>p.properties.code===d.code)!));
      return f.properties.districtCode===null ? hits.length===1 : !hits.some(d=>d.code===f.properties.districtCode);
    });
    expect(mismatches.map(f=>f.properties.id)).toEqual([]);
  });
  it('excludes holes and includes disconnected polygon pieces',()=>{
    const d:DistrictFeature={type:'Feature',properties:{code:'test',name:'test'},geometry:{type:'MultiPolygon',coordinates:[
      [[[0,0],[4,0],[4,4],[0,4],[0,0]],[[1,1],[2,1],[2,2],[1,2],[1,1]]],
      [[[8,8],[9,8],[9,9],[8,9],[8,8]]]]}};
    expect(pointInDistrict([.5,.5],d)).toBe(true);expect(pointInDistrict([1.5,1.5],d)).toBe(false);
    expect(pointInDistrict([8.5,8.5],d)).toBe(true);expect(pointInDistrict([5,5],d)).toBe(false);
  });
});
