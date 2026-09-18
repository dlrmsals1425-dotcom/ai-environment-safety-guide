import { expose } from 'comlink';
import { gridFromAoi, type GridSpec } from '@/analysis/grid';
import { terrainSunHours, refineShadowEdges } from '@/analysis/terrainShadow';
import { SpatialIndex } from '@/geo/spatialIndex';
import { sunVector } from '@/solar/sunVector';
import type { ComputeSunHoursInput } from '@/analysis/worker';

export type PreviewScene = Pick<ComputeSunHoursInput,'buildings'|'aoi'|'origin'|'dateParts'> & {
  ground: NonNullable<ComputeSunHoursInput['ground']>;
};
let scene:PreviewScene | null=null;
let index:SpatialIndex | null=null;
export type PreviewFrameResult={image:Blob;spec:GridSpec};
const api={
  initialize(input:PreviewScene) {
    scene=input;
    index=new SpatialIndex(input.buildings,50);
  },
  async frame(minutes:number,cellSize:number,refineEdges=false):Promise<PreviewFrameResult> {
    if (!scene || !index) throw new Error('그늘 계산 장면이 준비되지 않았습니다.');
    const {buildings,ground,aoi,origin,dateParts}=scene;
    const when=new Date(dateParts.year,dateParts.month,dateParts.day,0,minutes);
    const sun=sunVector(when,origin.lat0,origin.lon0);
    const spec=gridFromAoi(aoi,origin,cellSize);
    const params={buildings,index,spec,times:[{S:sun.S,alt:sun.alt}],z0:0,minAltDeg:0,stepMinutes:60};
    const base=terrainSunHours(params,ground);
    const result=refineEdges ? refineShadowEdges(base,params,ground) : {hours:base,spec};
    // Encoding multi-megapixel fine masks must not block the slider/UI thread.
    const canvas=new OffscreenCanvas(result.spec.nx,result.spec.ny);
    const context=canvas.getContext('2d')!;
    const pixels=context.createImageData(result.spec.nx,result.spec.ny);
    const {nx,ny}=result.spec;
    for (let i=0;i<result.hours.length;i++) {
      const j=((ny-1-Math.floor(i/nx))*nx+i%nx)*4;
      pixels.data[j]=18;pixels.data[j+1]=27;pixels.data[j+2]=50;
      pixels.data[j+3]=result.hours[i]===0 ? 140 : 0;
    }
    context.putImageData(pixels,0,0);
    return {image:await canvas.convertToBlob({type:'image/png'}),spec:result.spec};
  },
};
export type PreviewApi=typeof api;
expose(api);
