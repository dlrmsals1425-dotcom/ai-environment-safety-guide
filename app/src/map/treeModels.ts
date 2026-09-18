import { groundAt, type GroundGrid } from '@/data/ground';
import type { SeoulTreeFeature } from '@/types/seoul';

export interface TreeVisual {
  feature: SeoulTreeFeature;
  position: [number, number, number];
  height: number | null;
  width: number | null;
  modeled: boolean;
  conifer: boolean;
  color: [number, number, number, number];
}

export function prepareTreeVisuals(features: SeoulTreeFeature[], ground: GroundGrid | null): TreeVisual[] {
  if (!ground) return [];
  return features.flatMap((feature) => {
    const [lon, lat] = feature.geometry.coordinates;
    const base = groundAt(ground, lon, lat);
    if (!Number.isFinite(base)) return [];
    const {heightM, crownWidthM, species, id} = feature.properties;
    const height = heightM != null && heightM >= 1 && heightM <= 60 ? heightM : null;
    const width = crownWidthM != null && crownWidthM >= 0.2 && crownWidthM <= 40 ? crownWidthM : null;
    const conifer = /소나무|잣나무|향나무|측백|전나무|가문비|삼나무|주목|메타세쿼이아/.test(species ?? '');
    const variation = [...id].reduce((sum,c) => sum+c.charCodeAt(0),0)%22;
    return [{feature,position:[lon,lat,base] as [number,number,number],height,width,
      modeled:height !== null && width !== null,conifer,
      color:(conifer ? [40,94+variation,68,255] : [65+variation,126+variation,66,255]) as [number,number,number,number]}];
  });
}

/** Reusable, faceted surfaces of revolution, metres after per-instance scaling. */
export function revolveMesh(profile: [number,number][], segments=12) {
  const positions:number[] = [], normals:number[] = [];
  function triangle(a:number[],b:number[],c:number[]) {
    const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const length=Math.hypot(...n);
    if (length < 1e-9) return;
    for (const p of [a,b,c]) { positions.push(...p); normals.push(...n.map(x=>x/length)); }
  }
  for (let j=0;j<profile.length-1;j++) {
    const [r0,z0]=profile[j], [r1,z1]=profile[j+1];
    for (let i=0;i<segments;i++) {
      const a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments;
      const p=[r0*Math.cos(a),r0*Math.sin(a),z0],q=[r0*Math.cos(b),r0*Math.sin(b),z0];
      const r=[r1*Math.cos(a),r1*Math.sin(a),z1],s=[r1*Math.cos(b),r1*Math.sin(b),z1];
      triangle(p,q,r); triangle(q,s,r);
    }
  }
  return {attributes:{POSITION:{value:new Float32Array(positions),size:3},NORMAL:{value:new Float32Array(normals),size:3}}};
}

export const TRUNK_MESH = revolveMesh([[1,0],[0.65,1]],8);
export const CONIFER_MESH = revolveMesh([[0,0],[1,0],[0,1]],12);
export const CROWN_MESH = revolveMesh(Array.from({length:9},(_,i) => {
  const angle=-Math.PI/2+i*Math.PI/8;
  return [Math.cos(angle),Math.sin(angle)] as [number,number];
}),12);
