import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe,it,expect } from 'vitest';
import { createDemoAreas, DEMO_DEFAULT, evaluateDemoArea, demoFeature } from './demoDecision';
import { pointInDistrict, type DistrictFeature } from './municipal';
import { useDemoStore } from '@/store/demoStore';
const districts=JSON.parse(readFileSync(resolve('public/overlays/districts.geojson'),'utf8')).features as DistrictFeature[];
describe('explicit synthetic decision scenarios',()=>{
  it('creates six stable hypothetical squares fully within every district',()=>{
    const areas=createDemoAreas(districts,null);
    expect(areas).toHaveLength(150);expect(new Set(areas.map(a=>a.id)).size).toBe(150);
    for(const area of areas) {
      const district=districts.find(d=>d.properties.code===area.districtCode)!;
      expect(area.geometry.coordinates[0].every(p=>pointInDistrict(p,district))).toBe(true);
      expect(area.name).toContain('가상 구역');
    }
    expect(createDemoAreas(districts,'11440')).toHaveLength(6);
    expect(createDemoAreas(districts,'invalid')).toEqual([]);
  });
  it('produces finite bounded scores and explicit synthetic GeoJSON',()=>{
    for(const area of createDemoAreas(districts,'11440'))for(const altitude of [-20,0,30,80]) {
      const r=evaluateDemoArea(area,DEMO_DEFAULT,altitude,'pending');
      expect(Number.isFinite(r.risk)&&Number.isFinite(r.priority)).toBe(true);
      expect(r.risk).toBeGreaterThanOrEqual(0);expect(r.priority).toBeLessThanOrEqual(100);
      expect(demoFeature(r,false,false).properties?.purpose).toBe('synthetic-demo');
    }
  });
  it('does not treat cold alone as ice and removes solar contribution at night',()=>{
    const area=createDemoAreas(districts,'11440')[0];
    expect(evaluateDemoArea(area,{...DEMO_DEFAULT,snow:0,wetness:0},-20,'pending').risk).toBe(0);
    expect(evaluateDemoArea(area,{...DEMO_DEFAULT,cloud:0,sun:100},-20,'pending').sunlight).toBe(0);
    const open=createDemoAreas(districts,'11440')[2];
    expect(evaluateDemoArea(open,{...DEMO_DEFAULT,cloud:0,sun:100},60,'pending').risk).toBeLessThan(evaluateDemoArea(open,{...DEMO_DEFAULT,cloud:100,sun:100},60,'pending').risk);
  });
  it('reduces snow after simulated treatment without declaring freezing conditions safe',()=>{
    const area=createDemoAreas(districts,'11440')[0];
    const before=evaluateDemoArea(area,DEMO_DEFAULT,-10,'pending'),after=evaluateDemoArea(area,DEMO_DEFAULT,-10,'done');
    expect(after.remaining).toBeLessThan(before.remaining);expect(after.risk).toBeLessThan(before.risk);expect(after.risk).toBeGreaterThan(0);
    expect(after.action).not.toBe('안전');
  });
  it('enforces resource capacity, supports removing choices, and keeps treatment local to its ID',()=>{
    const s=useDemoStore.getState();s.reset();s.setCapacity(2);s.setPlan(['a','b','c']);
    expect(useDemoStore.getState().plan).toEqual(['a','b']);s.togglePlan('c');expect(useDemoStore.getState().plan).toHaveLength(2);
    s.togglePlan('a');s.togglePlan('c');expect(useDemoStore.getState().plan).toEqual(['b','c']);
    s.setTreatment('b','done');expect(useDemoStore.getState().treatments).toEqual({b:'done'});
    s.setCapacity(1);expect(useDemoStore.getState().plan).toHaveLength(1);s.reset();
  });
});
