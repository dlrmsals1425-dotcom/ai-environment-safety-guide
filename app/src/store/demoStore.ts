import { create } from 'zustand';
import { DEMO_DEFAULT, type DemoWeather, type DemoTreatment } from '@/data/demoDecision';
interface DemoState {
  selectionSeq:number;
  enabled:boolean;weather:DemoWeather;treatments:Record<string,DemoTreatment>;selectedId:string|null;plan:string[];capacity:number;
  setEnabled:(enabled:boolean)=>void;setWeather:(key:keyof DemoWeather,value:number)=>void;
  setTreatment:(id:string,treatment:DemoTreatment)=>void;select:(id:string|null)=>void;
  setCapacity:(value:number)=>void;togglePlan:(id:string)=>void;setPlan:(ids:string[])=>void;reset:()=>void;
}
const limits:Record<keyof DemoWeather,[number,number]>={temperature:[-15,10],cloud:[0,100],sun:[0,100],snow:[0,15],wetness:[0,100]};
export const useDemoStore=create<DemoState>((set,get)=>({enabled:true,weather:{...DEMO_DEFAULT},treatments:{},selectedId:null,plan:[],capacity:3,
  selectionSeq:0,
  setEnabled:enabled=>set({enabled,selectedId:null}),
  setWeather:(key,value)=>{if(Number.isFinite(value)){const [min,max]=limits[key];set({weather:{...get().weather,[key]:Math.min(max,Math.max(min,value))}});}},
  setTreatment:(id,treatment)=>set({treatments:{...get().treatments,[id]:treatment}}),select:selectedId=>set({selectedId,selectionSeq:get().selectionSeq+1}),
  setCapacity:value=>{if([1,2,3,4,5,6].includes(value))set({capacity:value,plan:get().plan.slice(0,value)});},
  togglePlan:id=>set({plan:get().plan.includes(id)?get().plan.filter(x=>x!==id):get().plan.length<get().capacity?[...get().plan,id]:get().plan}),
  setPlan:ids=>set({plan:[...new Set(ids)].slice(0,get().capacity)}),
  reset:()=>set({weather:{...DEMO_DEFAULT},treatments:{},selectedId:null,plan:[],capacity:3}),
}));
