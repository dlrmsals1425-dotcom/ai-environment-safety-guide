import { describe, expect, it } from 'vitest';
import { terrainSunHours, terrainSunlit } from '@/analysis/terrainShadow';
import { groundAt, groundCovers, cropGround, localGroundAt, type LocalGround, type GroundGrid } from '@/data/ground';
import { SpatialIndex } from '@/geo/spatialIndex';
import type { Building } from '@/types/building';

function terrain(offset=0): LocalGround {
  return {width:401,height:401,x0:-3000,y0:3000,dx:15,dy:-15,values:new Float32Array(401*401).fill(offset)};
}
function building(baseZ=0): Building {
  return {id:'wall',baseZ,height:20,minX:20,maxX:30,minY:-20,maxY:20,
    ring:new Float64Array([20,-20,30,-20,30,20,20,20]),lngLatPolygon:[],heightSource:'measured'};
}
const east = {x:1,y:0,z:0.2};
describe('integrated ground sunlight', () => {
  it('a ridge blocks low sun while flat ground does not, and high sun clears it', () => {
    const g=terrain();
    expect(terrainSunlit(g,0,0,0,east,0)).toBe(true);
    for (let r=0;r<g.height;r++) g.values[r*g.width+210]=60; // 150 m east
    expect(terrainSunlit(g,0,0,0,east,60)).toBe(false);
    expect(terrainSunlit(g,0,0,0,{x:1,y:0,z:1},60)).toBe(true);
    expect(terrainSunlit(g,0,0,0,{x:-1,y:0,z:0.2},60)).toBe(true);
  });
  it('combines building and terrain occlusion and is invariant to a common vertical datum shift', () => {
    const run=(offset:number,withBuilding:boolean) => {
      const buildings=withBuilding ? [building(offset)] : [];
      return terrainSunHours({buildings,index:new SpatialIndex(buildings,50),
        spec:{originX:-2,originY:-2,nx:1,ny:1,cellSize:4},
        times:[{S:east,alt:Math.atan(0.2)},{S:{x:-1,y:0,z:0.2},alt:Math.atan(0.2)}],
        z0:0,minAltDeg:0,stepMinutes:60},terrain(offset))[0];
    };
    expect(run(0,false)).toBe(2);
    expect(run(0,true)).toBe(1);
    expect(run(250,true)).toBe(1);
    expect(run(-20,true)).toBe(1);
  });
  it('refuses missing terrain instead of silently treating the edge as unoccluded', () => {
    const g=terrain();
    expect(() => terrainSunlit(g,2990,0,0,east,100)).toThrow('범위');
  });
  it('bilinear WGS sampling and cropped ENU sampling have the same height', () => {
    const g:GroundGrid={width:101,height:101,west:126.95,north:37.60,step:.001,
      values:Float32Array.from({length:10201},(_,i)=>(i%101)*2+Math.floor(i/101)*3)};
    const aoi:[number,number,number,number]=[126.998,37.548,127.002,37.552];
    expect(groundCovers(g,aoi)).toBe(true);
    const local=cropGround(g,aoi,{lon0:127,lat0:37.55});
    expect(localGroundAt(local,0,0)).toBeCloseTo(groundAt(g,127,37.55),5);
    expect(groundCovers(g,[126.951,37.548,126.952,37.552])).toBe(false);
    expect(Number.isNaN(groundAt(g,126,37))).toBe(true);
  });
});
