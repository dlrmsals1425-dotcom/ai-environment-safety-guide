export const LAYER_IDS = [
  'footprints',
  'trees',
  'snowBases',
  'buildings',
  'realtimeShadow',
  'sunHours',
] as const;

export type LayerId = (typeof LAYER_IDS)[number];

export const LAYER_LABELS: Record<LayerId, string> = {
  footprints: '건물 윤곽',
  trees: '3D 수목',
  snowBases: '제설전진기지',
  buildings: '3D 건물',
  realtimeShadow: '선택 시각 지면 그늘',
  sunHours: '일조시간 맵',
};

export const DEFAULT_LAYERS: Record<LayerId, boolean> = {
  footprints: true,
  trees: true,
  snowBases: true,
  buildings: true,
  realtimeShadow: true,
  sunHours: false,
};
