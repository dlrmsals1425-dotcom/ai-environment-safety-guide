import type { Feature, Polygon } from 'geojson';
import { DISTRICTS, pointInDistrict, type DistrictFeature } from './municipal';
export type DemoTreatment='pending'|'working'|'done';
export interface DemoWeather {temperature:number;cloud:number;sun:number;snow:number;wetness:number}
export const DEMO_DEFAULT:DemoWeather={temperature:-4,cloud:80,sun:65,snow:5,wetness:75};
export const DEMO_PROFILES=[
  {name:'그늘 많은 경사 구간 가정',shade:.9,slope:10,demand:85,accumulation:1.15},
  {name:'보행 수요 높은 구간 가정',shade:.55,slope:3,demand:100,accumulation:1},
  {name:'햇빛 드는 평지 가정',shade:.1,slope:1,demand:55,accumulation:.7},
  {name:'습기가 남는 구간 가정',shade:.75,slope:4,demand:65,accumulation:.95},
  {name:'그늘 적은 경사 구간 가정',shade:.25,slope:12,demand:70,accumulation:.8},
  {name:'통행 적은 구간 가정',shade:.45,slope:2,demand:25,accumulation:1.05},
];
export interface DemoArea {id:string;districtCode:string;districtName:string;name:string;position:[number,number];geometry:Polygon;profile:typeof DEMO_PROFILES[number]}
const areaCache=new WeakMap<DistrictFeature,DemoArea[]>();
/** Synthetic 180m squares, fully within the reference district; never actual road classifications. */
export function createDemoAreas(districts:DistrictFeature[],code:string|null):DemoArea[] {
  return districts.filter(d=>!code||d.properties.code===code).flatMap(d=>{
    const cached=areaCache.get(d);if(cached)return cached;
    const info=DISTRICTS.find(x=>x.code===d.properties.code);if(!info) return [];
    const [w,s,e,n]=info.bbox,dx=90/(111320*Math.cos(info.label[1]*Math.PI/180)),dy=90/111320;
    const candidates:{position:[number,number];geometry:Polygon}[]=[];
    for(let row=1;row<12;row++) for(let col=1;col<12;col++) {
      const x=w+(e-w)*col/12,y=s+(n-s)*row/12;
      const ring=[[x-dx,y-dy],[x+dx,y-dy],[x+dx,y+dy],[x-dx,y+dy],[x-dx,y-dy]];
      if(ring.every(p=>pointInDistrict(p,d))) candidates.push({position:[x,y],geometry:{type:'Polygon',coordinates:[ring]}});
    }
    const count=Math.min(DEMO_PROFILES.length,candidates.length);
    const areas=DEMO_PROFILES.slice(0,count).map((profile,i)=>({
      ...candidates[Math.floor((i+.5)*candidates.length/count)],profile,
      id:`demo-${info.code}-${i}`,districtCode:info.code,districtName:info.name,
      name:`${info.name} 가상 구역 ${String.fromCharCode(65+i)}`,
    }));
    areaCache.set(d,areas);return areas;
  });
}
const clamp=(n:number,min=0,max=100)=>Math.min(max,Math.max(min,n));
export function evaluateDemoArea(area:DemoArea,w:DemoWeather,altitude:number,treatment:DemoTreatment) {
  const p=area.profile;
  const remaining=w.snow*p.accumulation*(treatment==='done'?.25:treatment==='working'?.65:1);
  const sunlight=clamp(Math.sin(Math.max(0,altitude)*Math.PI/180),0,1)*(w.sun/100)*(1-w.cloud/100)*(1-p.shade);
  const cold=clamp((1-w.temperature)*4,0,30)*(w.wetness/100);
  const snow=clamp(remaining*7,0,35);
  const shade=p.shade*12*(w.wetness/100)*(w.temperature<2?1:.25);
  const slope=remaining>0 || (w.wetness>30 && w.temperature<2) ? Math.min(10,p.slope):0;
  const sunBenefit=sunlight*12;
  const risk=Math.round(clamp(cold+snow+shade+slope-sunBenefit));
  const priority=Math.round(clamp(risk*.8+(risk>0?p.demand*.15+(treatment==='pending'?7:0):0)));
  const action=priority>=60 && remaining>=1 ? '제설 우선 검토' : risk>=30 ? '결빙 우려 확인' : '모니터링';
  const reasons=[`기온 가정 ${w.temperature}℃ · 습윤도 가정 ${w.wetness}%`,
    `잔설 가정 ${remaining.toFixed(1)}cm · ${treatment==='done'?'처리 완료 가정':treatment==='working'?'작업 중 가정':'미처리 가정'}`,
    `그늘 노출 가정 ${Math.round(p.shade*100)}% · 경사 가정 ${p.slope}°`,
    `${altitude<=0?'야간으로 일사 기여 0':`구름 ${w.cloud}% · 햇빛 기여 ${(sunlight*100).toFixed(0)}% (시연식)`}`];
  return {...area,risk,priority,remaining,sunlight,treatment,action,reasons,
    contributions:{cold:Math.round(cold),snow:Math.round(snow),shade:Math.round(shade),slope,sunBenefit:Math.round(sunBenefit)}};
}
export type DemoResult=ReturnType<typeof evaluateDemoArea>;
export function demoFeature(result:DemoResult,planned:boolean,selected:boolean):Feature<Polygon> {
  return {type:'Feature',geometry:result.geometry,properties:{id:result.id,name:result.name,priority:result.priority,
    risk:result.risk,action:result.action,planned,selected,purpose:'synthetic-demo',
    color:result.action==='제설 우선 검토'?'#c64275':result.action==='결빙 우려 확인'?'#cb8936':'#767dab'}};
}
