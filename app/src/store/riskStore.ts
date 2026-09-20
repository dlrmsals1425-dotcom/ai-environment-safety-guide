import { create } from 'zustand';
import type { RiskBundle } from '@/data/riskData';
export const useRiskStore=create<{bundle:RiskBundle|null;visible:boolean;setBundle:(bundle:RiskBundle|null)=>void;setVisible:(v:boolean)=>void}>((set)=>({
  bundle:null,visible:true,setBundle:bundle=>set({bundle}),setVisible:visible=>set({visible}),
}));
