import { create } from 'zustand';
import { useEffect } from 'react';
import { fetchJson } from '@/data/seoulData';
import { parseMunicipalCollection, type DistrictFeature, type SnowBoxFeature, type SnowBoxMeta } from '@/data/municipal';

interface MunicipalState {
  districts:DistrictFeature[];snowBoxes:SnowBoxFeature[];snowBoxMeta:SnowBoxMeta|null;
  districtError:string|null;snowBoxError:string|null;districtReady:boolean;snowBoxReady:boolean;
  snowBoxQuery:string;setSnowBoxQuery:(query:string)=>void;
}
export const useMunicipalStore=create<MunicipalState>(set=>({districts:[],snowBoxes:[],snowBoxMeta:null,
  districtError:null,snowBoxError:null,districtReady:false,snowBoxReady:false,snowBoxQuery:'',
  setSnowBoxQuery:query=>set({snowBoxQuery:query})}));

export function useMunicipalData() {
  useEffect(()=>{
    const ac=new AbortController();
    fetchJson('/overlays/districts.geojson',ac.signal).then(raw=>{
      if(!ac.signal.aborted) useMunicipalStore.setState({districts:parseMunicipalCollection<DistrictFeature>(raw,'districts').features,districtReady:true,districtError:null});
    }).catch(e=>{if(!ac.signal.aborted) useMunicipalStore.setState({districtError:String(e)});});
    Promise.all([fetchJson('/overlays/snow-boxes.geojson',ac.signal),fetchJson('/overlays/snow-boxes.meta.json',ac.signal)]).then(([raw,meta])=>{
      if(ac.signal.aborted) return;
      const features=parseMunicipalCollection<SnowBoxFeature>(raw,'snowBoxes').features;
      const m=meta as SnowBoxMeta;
      if(m.mappedRows!==features.length || m.totalRows!==m.mappedRows+m.unmappedRows || m.unassignedRows!==features.filter(f=>f.properties.districtCode===null).length) throw new Error('제설함 행 수 검증 실패');
      useMunicipalStore.setState({snowBoxes:features,snowBoxMeta:m,snowBoxReady:true,snowBoxError:null});
    }).catch(e=>{if(!ac.signal.aborted) useMunicipalStore.setState({snowBoxError:String(e)});});
    return ()=>ac.abort();
  },[]);
}
