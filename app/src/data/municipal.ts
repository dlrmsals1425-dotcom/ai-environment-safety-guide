import catalog from './districtCatalog.json';
import type { BBox } from '@/geo/aoi';
import type { Feature, FeatureCollection, Point, Polygon, MultiPolygon } from 'geojson';

export const DISTRICTS = catalog as {code:string;name:string;bbox:BBox;label:[number,number]}[];
export const SEOUL_BOUNDS: BBox = [Math.min(...DISTRICTS.map(d=>d.bbox[0])),Math.min(...DISTRICTS.map(d=>d.bbox[1])),Math.max(...DISTRICTS.map(d=>d.bbox[2])),Math.max(...DISTRICTS.map(d=>d.bbox[3]))];
export type DistrictFeature = Feature<Polygon|MultiPolygon,{code:string;name:string}>;
export type SnowBoxFeature = Feature<Point,{
  id:string;boxId:string;agency:string;address:string;districtCode:string|null;districtName:string|null;
  coordinateStatus:string;sourceRow:number;
}>;
export interface SnowBoxMeta {totalRows:number;mappedRows:number;unmappedRows:number;unassignedRows:number;warning:string}
export function filterSnowBoxes(features:SnowBoxFeature[],code:string|null,query:string) {
  const q=query.trim().toLocaleLowerCase();
  return features.filter(f=>(!code || f.properties.districtCode===code) && (!q ||
    [f.properties.boxId,f.properties.agency,f.properties.address,f.properties.districtName].join(' ').toLocaleLowerCase().includes(q)));
}
export function pointInDistrict(position:number[],district:DistrictFeature):boolean {
  const [x,y]=position;
  const ringContains=(ring:number[][])=>{
    let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
      const [xi,yi]=ring[i],[xj,yj]=ring[j];
      // Treat an outer boundary point as covered by each adjacent district.
      const dx=xj-xi,dy=yj-yi,len=Math.hypot(dx,dy);
      if(len>0 && Math.abs((x-xi)*dy-(y-yi)*dx)/len<1e-10 && x>=Math.min(xi,xj)-1e-10 && x<=Math.max(xi,xj)+1e-10 && y>=Math.min(yi,yj)-1e-10 && y<=Math.max(yi,yj)+1e-10) return true;
      if ((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
    }
    return inside;
  };
  const polygons=district.geometry.type==='Polygon' ? [district.geometry.coordinates] : district.geometry.coordinates;
  return polygons.some(rings=>ringContains(rings[0]) && !rings.slice(1).some(ringContains));
}
export function parseMunicipalCollection<T extends Feature>(raw:unknown,kind:'districts'|'snowBoxes'):FeatureCollection<T['geometry'],T['properties']> {
  const fc=raw as FeatureCollection;
  if(fc?.type!=='FeatureCollection' || !Array.isArray(fc.features)) throw new Error('지도자료 형식 오류');
  const ids=new Set<string>();
  for(const f of fc.features) {
    const id=kind==='districts' ? f.properties?.code : f.properties?.id;
    if(typeof id!=='string' || ids.has(id)) throw new Error('지도자료 식별자 오류');
    ids.add(id);
    if(kind==='districts') {
      if(!DISTRICTS.some(d=>d.code===id && d.name===f.properties?.name) || !['Polygon','MultiPolygon'].includes(f.geometry?.type)) throw new Error('구 경계 형식 오류');
    } else {
      if(f.geometry?.type!=='Point') throw new Error('제설함 좌표 형식 오류');
      const [x,y]=f.geometry.coordinates;
      if(!Number.isFinite(x)||!Number.isFinite(y)||x<126.5||x>127.4||y<37.2||y>37.85) throw new Error('제설함 좌표 범위 오류');
      if(f.properties?.districtCode!==null && !DISTRICTS.some(d=>d.code===f.properties?.districtCode && d.name===f.properties?.districtName)) throw new Error('제설함 자치구 코드 오류');
    }
  }
  if(kind==='districts' && fc.features.length!==25) throw new Error('서울 25개 구 경계가 모두 필요합니다');
  return fc as FeatureCollection<T['geometry'],T['properties']>;
}
