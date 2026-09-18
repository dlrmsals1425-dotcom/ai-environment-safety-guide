import { cellCenter } from '@/analysis/grid';
import { isSunlit, type SunHoursParams } from '@/analysis/shadow';
import { localGroundAt, TERRAIN_RADIUS_M, TERRAIN_STEP_M, type LocalGround } from '@/data/ground';
import type { Vec3 } from '@/solar/sunVector';

/** Geometric sunlight at the ground, not irradiance or roof/facade illumination. */
export function terrainSunlit(g: LocalGround, x: number, y: number, z: number, s: Vec3, maxHeight: number): boolean {
  if (s.z <= 0) return false;
  const h = Math.hypot(s.x, s.y);
  if (h < 1e-12) return true;
  const ux = s.x/h, uy = s.y/h, slope = s.z/h;
  const limit = Math.min(TERRAIN_RADIUS_M, Math.max(0, (maxHeight-z)/slope));
  for (let d=TERRAIN_STEP_M; d<=limit; d+=TERRAIN_STEP_M) {
    const height = localGroundAt(g, x+ux*d, y+uy*d);
    if (!Number.isFinite(height)) throw new Error('지형 광선이 고도 자료 범위를 벗어났습니다.');
    if (height > z+d*slope+0.05) return false;
  }
  return true;
}

export function terrainSunHours(params: SunHoursParams, ground: LocalGround): Float32Array {
  const {buildings, index, spec, times, z0, minAltDeg, stepMinutes} = params;
  const n = spec.nx*spec.ny, hours = new Float32Array(n), elevations = new Float32Array(n);
  let maxGround = -Infinity, maxRoof = -Infinity;
  for (const h of ground.values) maxGround = Math.max(maxGround, h);
  for (const b of buildings) maxRoof = Math.max(maxRoof, b.baseZ+b.height);
  for (let i=0; i<n; i++) {
    const p = cellCenter(spec, i%spec.nx, Math.floor(i/spec.nx));
    elevations[i] = localGroundAt(ground, p.x, p.y)+z0;
    if (!Number.isFinite(elevations[i])) throw new Error('분석 영역의 고도가 없습니다.');
  }
  times.forEach((time, t) => {
    if (params.shouldCancel?.()) throw new DOMException('Aborted', 'AbortError');
    if (time.alt >= minAltDeg*Math.PI/180 && time.S.z > 0) {
      for (let i=0; i<n; i++) {
        const p = cellCenter(spec, i%spec.nx, Math.floor(i/spec.nx));
        const z = elevations[i];
        if (terrainSunlit(ground, p.x, p.y, z, time.S, maxGround)
          && isSunlit({...p, z}, time.S, buildings, index, maxRoof)) hours[i] += stepMinutes/60;
      }
    }
    params.onProgress?.((t+1)/times.length);
  });
  return hours;
}

/** Re-trace mixed light/shadow boundary cells at sub-cell resolution.
 * Uniform interiors reuse the coarse result. This is boundary refinement, not
 * an assertion that every point/very narrow missed feature was traced at 0.5m.
 */
export function refineShadowEdges(base:Float32Array, params:SunHoursParams, ground:LocalGround, factor=4) {
  const {spec,buildings,index,z0,times}=params;
  if (times.length!==1 || !Number.isInteger(factor) || factor<1 || factor>4) {
    throw new Error('경계 보정은 단일 시각과 1–4배 세분화를 사용합니다.');
  }
  const fineSpec={...spec,cellSize:spec.cellSize/factor,nx:spec.nx*factor,ny:spec.ny*factor};
  const hours=new Float32Array(fineSpec.nx*fineSpec.ny);
  let maxGround=-Infinity,maxRoof=-Infinity,refinedCells=0;
  for (const h of ground.values) maxGround=Math.max(maxGround,h);
  for (const b of buildings) maxRoof=Math.max(maxRoof,b.baseZ+b.height);
  const time=times[0];
  for (let y=0;y<spec.ny;y++) {
    if (params.shouldCancel?.()) throw new DOMException('Aborted','AbortError');
    for (let x=0;x<spec.nx;x++) {
      const value=base[y*spec.nx+x];
      let boundary=false;
      for (let dy=-1;dy<=1 && !boundary;dy++) for (let dx=-1;dx<=1;dx++) {
        const xx=x+dx,yy=y+dy;
        if (xx>=0 && yy>=0 && xx<spec.nx && yy<spec.ny && base[yy*spec.nx+xx]!==value) {boundary=true;break;}
      }
      for (let sy=0;sy<factor;sy++) {
        const start=(y*factor+sy)*fineSpec.nx+x*factor;
        if (!boundary) {hours.fill(value,start,start+factor);continue;}
        for (let sx=0;sx<factor;sx++) {
          const p=cellCenter(fineSpec,x*factor+sx,y*factor+sy);
          const z=localGroundAt(ground,p.x,p.y)+z0;
          if (!Number.isFinite(z)) throw new Error('경계 보정 지점의 고도가 없습니다.');
          const lit=time.alt>=params.minAltDeg*Math.PI/180 && time.S.z>0
            && terrainSunlit(ground,p.x,p.y,z,time.S,maxGround)
            && isSunlit({...p,z},time.S,buildings,index,maxRoof);
          hours[start+sx]=lit ? params.stepMinutes/60 : 0;
          refinedCells++;
        }
      }
    }
  }
  return {hours,spec:fineSpec,refinedCells};
}
