import { ColumnLayer, PathLayer, ScatterplotLayer, SolidPolygonLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import { cctvDisplayPosition, cctvUsesLivePosition } from '@/data/geocodeQuery';
import { positionSourceColor } from '@/facility/positionSource';
import { metersPerDegree } from '@/geo/enu';
import type { CctvLiveChosen, CctvSite } from '@/types/facility';

export const CCTV_POLE_HEIGHT_M = 4.5;
export const HUD_DEPTH = {
  depthCompare: 'always' as const,
  depthWriteEnabled: false,
};

const PIN_ID = 'bitgil-cctv-pins';
const POLE_ID = 'bitgil-cctv-poles';
const ARM_ID = 'bitgil-cctv-arms';
const BODY_ID = 'bitgil-cctv-housings';
const LENS_ID = 'bitgil-cctv-lenses';
const BELL_ID = 'bitgil-cctv-bells';

type LngLatZ = [number, number, number];

function offsetLngLat(
  lng: number,
  lat: number,
  eastM: number,
  northM: number,
  upM: number,
): LngLatZ {
  const { mPerDegLat, mPerDegLon } = metersPerDegree(lat);
  return [lng + eastM / mPerDegLon, lat + northM / mPerDegLat, upM];
}

const LIVE_FILL: [number, number, number, number] = [46, 168, 132, 240];

function poleColor(site: CctvSite, live: boolean): [number, number, number, number] {
  if (live) return LIVE_FILL;
  return positionSourceColor(site);
}

export function cameraOffsets(count: number, radiusM = 0.45): { east: number; north: number }[] {
  const n = Math.max(0, count);
  const out: { east: number; north: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI * 2;
    out.push({ east: Math.cos(a) * radiusM, north: Math.sin(a) * radiusM });
  }
  return out;
}

function closedQuad(a: LngLatZ, b: LngLatZ, c: LngLatZ, d: LngLatZ): LngLatZ[] {
  return [a, b, c, d, a];
}

export type CameraParts = {
  arm: LngLatZ[];
  housing: LngLatZ[][];
  lens: LngLatZ[];
};

/** 짧은 암 + 직육면체 하우징 + 전면 렌즈. 표시용 상징. */
export function cameraParts(
  lng: number,
  lat: number,
  east: number,
  north: number,
): CameraParts {
  const len = Math.hypot(east, north) || 1;
  const ue = east / len;
  const un = north / len;
  const re = -un;
  const rn = ue;
  const z = 4.22;
  const arm0 = offsetLngLat(lng, lat, ue * 0.12, un * 0.12, z);
  const arm1 = offsetLngLat(lng, lat, ue * 0.42, un * 0.42, z);
  const ce = ue * 0.55;
  const cn = un * 0.55;
  const hl = 0.13;
  const hw = 0.075;
  const hh = 0.06;
  const p = (sL: number, sW: number, sH: number): LngLatZ =>
    offsetLngLat(lng, lat, ce + ue * sL * hl + re * sW * hw, cn + un * sL * hl + rn * sW * hw, z + sH * hh);
  const housing = [
    closedQuad(p(1, 1, 1), p(1, -1, 1), p(1, -1, -1), p(1, 1, -1)),
    closedQuad(p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1), p(-1, -1, -1)),
    closedQuad(p(-1, -1, 1), p(-1, 1, 1), p(1, 1, 1), p(1, -1, 1)),
    closedQuad(p(-1, 1, -1), p(-1, -1, -1), p(1, -1, -1), p(1, 1, -1)),
    closedQuad(p(-1, 1, 1), p(-1, 1, -1), p(1, 1, -1), p(1, 1, 1)),
    closedQuad(p(-1, -1, -1), p(-1, -1, 1), p(1, -1, 1), p(1, -1, -1)),
  ];
  const lf = 0.14;
  const lw = 0.04;
  const lh = 0.035;
  const q = (sW: number, sH: number): LngLatZ =>
    offsetLngLat(lng, lat, ce + ue * lf + re * sW * lw, cn + un * lf + rn * sW * lw, z + sH * lh);
  return {
    arm: [arm0, arm1],
    housing,
    lens: closedQuad(q(1, 1), q(-1, 1), q(-1, -1), q(1, -1)),
  };
}

const noShadow = { shadowEnabled: false } as Record<string, unknown>;

export function makeCctvLayers(opts: {
  sites: CctvSite[];
  visible: boolean;
  showRemoved: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  castShadow?: boolean;
  liveChosen?: CctvLiveChosen | null;
}): Layer[] {
  const modelShadow = { shadowEnabled: opts.castShadow === true } as Record<string, unknown>;
  const live = opts.liveChosen ?? null;
  const mapped = opts.visible
    ? opts.sites.filter((s) => {
        if (!opts.showRemoved && s.status === 'removed') return false;
        return cctvDisplayPosition(s, live) !== null;
      })
    : [];
  const selected = mapped.filter((s) => s.stableId === opts.selectedId);

  const arms: { path: LngLatZ[]; removed: boolean }[] = [];
  const housings: { polygon: LngLatZ[]; removed: boolean }[] = [];
  const lenses: { polygon: LngLatZ[]; removed: boolean }[] = [];
  for (const site of mapped) {
    const pos = cctvDisplayPosition(site, live)!;
    const [lng, lat] = pos;
    const removed = site.status === 'removed';
    for (const off of cameraOffsets(site.cameraCount ?? 0)) {
      const parts = cameraParts(lng, lat, off.east, off.north);
      arms.push({ path: parts.arm, removed });
      for (const polygon of parts.housing) housings.push({ polygon, removed });
      lenses.push({ polygon: parts.lens, removed });
    }
  }
  const bells = mapped.filter((s) => s.hasEmergencyBell === true);

  const poles = new ColumnLayer<CctvSite>({
    id: POLE_ID,
    data: mapped,
    pickable: false,
    diskResolution: 10,
    radius: 0.12,
    extruded: true,
    getPosition: (d) => {
      const p = cctvDisplayPosition(d, live)!;
      return [p[0], p[1], 0];
    },
    getElevation: CCTV_POLE_HEIGHT_M,
    getFillColor: (d) => poleColor(d, cctvUsesLivePosition(d, live)),
    material: { ambient: 0.45, diffuse: 0.6, shininess: 12 },
    ...modelShadow,
  });

  const armLayer = new PathLayer<(typeof arms)[number]>({
    id: ARM_ID,
    data: arms,
    pickable: false,
    widthUnits: 'meters',
    getPath: (d) => d.path,
    getColor: (d) => (d.removed ? [160, 160, 160, 90] : [70, 76, 84, 240]),
    getWidth: 0.05,
    widthMinPixels: 1,
    ...modelShadow,
  });

  const bodyLayer = new SolidPolygonLayer<(typeof housings)[number]>({
    id: BODY_ID,
    data: housings,
    pickable: false,
    extruded: false,
    filled: true,
    _full3d: true,
    getPolygon: (d) => d.polygon,
    getFillColor: (d) => (d.removed ? [160, 160, 160, 90] : [48, 52, 58, 240]),
    ...modelShadow,
  });

  const lensLayer = new SolidPolygonLayer<(typeof lenses)[number]>({
    id: LENS_ID,
    data: lenses,
    pickable: false,
    extruded: false,
    filled: true,
    _full3d: true,
    getPolygon: (d) => d.polygon,
    getFillColor: (d) => (d.removed ? [80, 80, 80, 90] : [12, 12, 16, 255]),
    ...modelShadow,
  });

  const bellLayer = new ColumnLayer<CctvSite>({
    id: BELL_ID,
    data: bells,
    pickable: false,
    diskResolution: 8,
    radius: 0.18,
    extruded: true,
    getPosition: (d) => {
      const p = cctvDisplayPosition(d, live)!;
      return [p[0], p[1], 2.1];
    },
    getElevation: 0.22,
    getFillColor: [210, 48, 48, 240],
    ...modelShadow,
  });

  const pins = new ScatterplotLayer<CctvSite>({
    id: PIN_ID,
    data: mapped,
    pickable: true,
    billboard: true,
    radiusUnits: 'pixels',
    stroked: true,
    filled: true,
    getPosition: (d) => {
      const p = cctvDisplayPosition(d, live)!;
      return [p[0], p[1], 0];
    },
    getRadius: (d) => (d.stableId === opts.selectedId ? 14 : 8),
    getFillColor: (d) => {
      if (cctvUsesLivePosition(d, live)) {
        return d.stableId === opts.selectedId ? [90, 220, 180, 255] : LIVE_FILL;
      }
      const [r, g, b, a] = positionSourceColor(d);
      if (d.stableId !== opts.selectedId) return [r, g, b, a];
      const lift = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.45));
      return [lift(r), lift(g), lift(b), 255];
    },
    getLineColor: (d) =>
      d.stableId === opts.selectedId ? [255, 255, 255, 255] : [40, 32, 8, 220],
    lineWidthMinPixels: 2,
    parameters: HUD_DEPTH,
    onClick: ({ object }) => {
      if (object) opts.onSelect(object.stableId);
    },
    ...noShadow,
  });

  const highlight = new ScatterplotLayer<CctvSite>({
    id: `${PIN_ID}-sel`,
    data: selected,
    pickable: false,
    billboard: true,
    radiusUnits: 'pixels',
    filled: false,
    stroked: true,
    getPosition: (d) => {
      const p = cctvDisplayPosition(d, live)!;
      return [p[0], p[1], 0];
    },
    getRadius: 20,
    getLineColor: [255, 240, 140, 255],
    lineWidthMinPixels: 3,
    parameters: HUD_DEPTH,
    ...noShadow,
  });

  return [poles, bellLayer, armLayer, bodyLayer, lensLayer, pins, highlight];
}
