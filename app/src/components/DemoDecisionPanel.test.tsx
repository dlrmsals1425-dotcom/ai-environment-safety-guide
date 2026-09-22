import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act,cleanup,fireEvent,render,screen } from '@testing-library/react';
import { afterEach,beforeEach,describe,expect,it } from 'vitest';
import { DemoDecisionPanel } from './DemoDecisionPanel';
import { DemoBanner } from './DemoBanner';
import { useDemoStore } from '@/store/demoStore';
import { useAppStore } from '@/store/appStore';
import { useMunicipalStore } from '@/store/municipalStore';
import { useRiskStore } from '@/store/riskStore';
const districts=JSON.parse(readFileSync(resolve('public/overlays/districts.geojson'),'utf8')).features;
describe('synthetic decision UI',()=>{
  beforeEach(()=>{
    useDemoStore.getState().reset();useDemoStore.setState({enabled:true});
    useAppStore.setState({selectedDistrictCode:'11440',date:new Date(2026,11,21),timeMinutes:720,aoi:null,origin:null});
    useMunicipalStore.setState({districts,districtReady:true,districtError:null});
  });
  afterEach(cleanup);
  it('changes weather and solar time together with clearly fictional presets',()=>{
    render(<DemoDecisionPanel/>);
    expect(screen.getByText(/실제 위험·예보·출동 지시가 아닙니다/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'☀ 맑은 오후'}));
    expect(useDemoStore.getState().weather).toMatchObject({temperature:3,cloud:10,snow:2});
    expect(useAppStore.getState().timeMinutes).toBe(780);
    fireEvent.change(screen.getByLabelText('가상 구름량'),{target:{value:'100'}});
    expect(useDemoStore.getState().weather.cloud).toBe(100);
  });
  it('shows reasoning, applies only the selected simulated treatment, and bounds the plan',()=>{
    render(<DemoDecisionPanel/>);
    fireEvent.click(screen.getByRole('button',{name:'마포구 가상 구역 A 판단 근거'}));
    expect(screen.getByLabelText('가상 구역 판단 근거')).toHaveTextContent('잔설 가정');
    fireEvent.change(screen.getByLabelText('선택 구역 제설 상태'),{target:{value:'done'}});
    expect(useDemoStore.getState().treatments).toEqual({'demo-11440-0':'done'});
    fireEvent.change(screen.getByLabelText('가상 작업 한도'),{target:{value:'2'}});
    fireEvent.click(screen.getByRole('button',{name:'상위 2곳으로 계획 교체'}));
    expect(useDemoStore.getState().plan.length).toBeLessThanOrEqual(2);
    expect(useDemoStore.getState().plan.length).toBeGreaterThan(0);
  });
  it('clears cross-district plans and leaves imported real results untouched when ending demo',()=>{
    const bundle={type:'FeatureCollection' as const,schemaVersion:1 as const,purpose:'operational' as const,generatedAt:'2026-09-23T00:00:00+09:00',source:'test',features:[]};
    useRiskStore.setState({bundle});render(<DemoBanner/>);
    act(()=>{useDemoStore.getState().setPlan(['demo-11440-0']);useAppStore.getState().selectDistrict('11650');});
    expect(useDemoStore.getState().plan).toEqual([]);
    fireEvent.click(screen.getByRole('button',{name:'시연 종료 · 실자료 보기'}));
    expect(useDemoStore.getState().enabled).toBe(false);
    expect(useAppStore.getState().timeMinutes).toBe(720);
    expect(useAppStore.getState().selectedDistrictCode).toBe('11440');
    expect(useRiskStore.getState().bundle).toBe(bundle);
  });
});
