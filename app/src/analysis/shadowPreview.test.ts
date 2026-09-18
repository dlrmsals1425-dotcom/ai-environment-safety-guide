import { describe, expect, it } from 'vitest';
import { shadowPreviewCellSize } from '@/analysis/shadowPreview';
import { squareBboxAround, bboxSizeMeters } from '@/geo/aoi';
import { terrainSunHours, refineShadowEdges } from '@/analysis/terrainShadow';
import { SpatialIndex } from '@/geo/spatialIndex';
import type { Building } from '@/types/building';

describe('ground-shadow preview sampling', () => {
  const origin={lat0:37.5264,lon0:126.925};
  it('uses 2m rays for the normal AOI plus buffer and bounds work for large areas', () => {
    expect(shadowPreviewCellSize(squareBboxAround(origin,1100))).toBe(2);
    const large=squareBboxAround(origin,2600), cell=shadowPreviewCellSize(large);
    const {width,height}=bboxSizeMeters(large);
    expect(cell).toBeGreaterThan(2);
    expect(Math.ceil(width/cell)*Math.ceil(height/cell)).toBeLessThanOrEqual(400_000);
  });
  it('matches a 20m prism casting a 20m shadow at 45 degrees on flat ground', () => {
    const b:Building={id:'reference',ring:new Float64Array([20,-10,30,-10,30,10,20,10]),
      baseZ:100,height:20,heightSource:'synthetic',minX:20,maxX:30,minY:-10,maxY:10,lngLatPolygon:[]};
    const spec={originX:-30,originY:0,cellSize:2,nx:40,ny:1};
    const ground={width:81,height:81,x0:-600,y0:600,dx:15,dy:-15,values:new Float32Array(81*81).fill(100)};
    const hours=terrainSunHours({buildings:[b],index:new SpatialIndex([b]),spec,
      times:[{S:{x:1,y:0,z:1},alt:Math.PI/4}],z0:0,minAltDeg:0,stepMinutes:60},ground);
    // The shadow runs west from x=20 to x=0. The solid footprint occupies x=20..30.
    for (let i=0;i<spec.nx;i++) {
      const x=spec.originX+(i+.5)*spec.cellSize;
      expect(hours[i],`x=${x}`).toBe(x>0 && x<30 ? 0 : 1);
    }
  });

  it('re-traces a fractional boundary to match a full 0.5m reference instead of blurring old cells',()=>{
    const b:Building={id:'fractional',ring:new Float64Array([20.35,-10.25,30.35,-10.25,30.35,10.25,20.35,10.25]),
      baseZ:100,height:20.75,heightSource:'synthetic',minX:20.35,maxX:30.35,minY:-10.25,maxY:10.25,lngLatPolygon:[]};
    const ground={width:81,height:81,x0:-600,y0:600,dx:15,dy:-15,values:new Float32Array(81*81).fill(100)};
    const params={buildings:[b],index:new SpatialIndex([b]),spec:{originX:-30,originY:-16,cellSize:2,nx:40,ny:16},
      times:[{S:{x:1,y:0,z:1},alt:Math.PI/4}],z0:0,minAltDeg:0,stepMinutes:60};
    const base=terrainSunHours(params,ground);
    const refined=refineShadowEdges(base,params,ground);
    const reference=terrainSunHours({...params,spec:refined.spec},ground);
    expect(refined.spec.cellSize).toBe(.5);
    expect(refined.hours).toEqual(reference);
    expect(refined.refinedCells).toBeGreaterThan(0);
    expect(refined.refinedCells).toBeLessThan(reference.length);
  });
});
