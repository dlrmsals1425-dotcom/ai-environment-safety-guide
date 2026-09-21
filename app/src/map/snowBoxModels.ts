import { groundAt, type GroundGrid } from '@/data/ground';
import type { SnowBoxFeature } from '@/data/municipal';
import type { BBox } from '@/geo/aoi';

export const SNOW_BOX_MODEL_ZOOM=15.5;
export const MAX_SNOW_BOX_MODELS=800;
export interface SnowBoxView {zoom:number;bounds:BBox;latitude:number}
export interface SnowBoxVisual {feature:SnowBoxFeature;position:[number,number,number]}

/** Readable map symbols, not surveyed dimensions or orientations. */
export function snowBoxSymbolScale(view:SnowBoxView):number {
  const metersPerPixel=78271.51696*Math.cos(view.latitude*Math.PI/180)/2**view.zoom;
  return Math.max(1,Math.min(28,metersPerPixel*34/1.5));
}
export function prepareSnowBoxVisuals(features:SnowBoxFeature[],ground:GroundGrid|null,view:SnowBoxView):SnowBoxVisual[] {
  if(!ground || view.zoom<SNOW_BOX_MODEL_ZOOM) return [];
  const [w,s,e,n]=view.bounds,center=[(w+e)/2,(s+n)/2];
  return features.filter(f=>{
    const [x,y]=f.geometry.coordinates;return x>=w && x<=e && y>=s && y<=n;
  }).sort((a,b)=>{
    const dist=(p:number[])=>((p[0]-center[0])*Math.cos(view.latitude*Math.PI/180))**2+(p[1]-center[1])**2;
    return dist(a.geometry.coordinates)-dist(b.geometry.coordinates);
  }).flatMap(feature=>{
    const [lon,lat]=feature.geometry.coordinates,z=groundAt(ground,lon,lat);
    return Number.isFinite(z) ? [{feature,position:[lon,lat,z+.08] as [number,number,number]}] : [];
  }).slice(0,MAX_SNOW_BOX_MODELS);
}

/** Low-poly closed prisms; shared geometry is instanced across all visible boxes. */
function meshFromBoxes(boxes:{x:number;y:number;z:number;w:number;d:number;h:number;rotation?:number}[]) {
  const positions:number[]=[],normals:number[]=[];
  const tri=(a:number[],b:number[],c:number[])=>{
    const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...n);
    for(const p of [a,b,c]){positions.push(...p);normals.push(...n.map(x=>x/length));}
  };
  for(const b of boxes) {
    const angle=b.rotation ?? 0;
    const p=[[-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([x,y,z])=>[b.x+x*b.w/2*Math.cos(angle)-y*b.d/2*Math.sin(angle),b.y+x*b.w/2*Math.sin(angle)+y*b.d/2*Math.cos(angle),b.z+z*b.h]);
    for(const [a,c,d,e] of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]) {tri(p[a],p[c],p[d]);tri(p[a],p[d],p[e]);}
  }
  return {attributes:{POSITION:{value:new Float32Array(positions),size:3},NORMAL:{value:new Float32Array(normals),size:3}}};
}
export const SNOW_BOX_BODY=meshFromBoxes([{x:0,y:0,z:.13,w:1.4,d:.82,h:.78}]);
export const SNOW_BOX_LID=meshFromBoxes([{x:0,y:0,z:.88,w:1.54,d:.94,h:.15}]);
export const SNOW_BOX_TRIM=meshFromBoxes([
  {x:-.48,y:0,z:0,w:.2,d:.7,h:.16},{x:.48,y:0,z:0,w:.2,d:.7,h:.16},
  {x:0,y:-.465,z:.82,w:.34,d:.08,h:.08}]);
// An eight-spoke snow symbol on the lid remains readable from directly overhead.
export const SNOW_BOX_MARK=meshFromBoxes([
  {x:0,y:-.425,z:.33,w:.76,d:.02,h:.33},
  ...[0,Math.PI/4,Math.PI/2,3*Math.PI/4].map(rotation=>({x:0,y:0,z:1.035,w:.5,d:.035,h:.015,rotation}))]);
