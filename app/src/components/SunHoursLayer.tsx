/** 배치 위치(적용 시): cpted-sunmap/src/components/SunHoursLayer.tsx (전체 교체) */
import type { Map as MapLibreMap } from 'maplibre-gl';
import { useEffect } from 'react';
import { gridWgsBounds } from '@/analysis/grid';
import { sunHoursCanvas, sunHoursImageCoordinates } from '@/analysis/heatmap';
import { useAppStore } from '@/store/appStore';

const SRC_ID = 'bitgil-sunhours';
const LAYER_ID = 'bitgil-sunhours';

/**
 * 지도가 아직 스타일을 갖고 있는지 공개 API로 확인한다.
 *
 * MapLibre 의 `Map.remove()` 는 내부적으로 `setStyle(null)` 을 거쳐 스타일 참조를 지운다.
 * 그 뒤 `getStyle()` 은 예외를 던지지 않고 `undefined` 를 반환하지만,
 * `getLayer()` / `getSource()` 는 스타일에 바로 접근하므로 TypeError 가 난다.
 * HMR 로 지도가 먼저 제거된 뒤 이 컴포넌트의 cleanup 이 도는 순서에서 실제로 발생했다.
 *
 * 무조건 try/catch 로 덮지 않는다. 스타일이 살아 있는데 나는 오류는 그대로 드러나야 한다.
 */
function hasLiveStyle(map: MapLibreMap): boolean {
  return Boolean(map.getStyle());
}

function removeSunHours(map: MapLibreMap): void {
  if (!hasLiveStyle(map)) return; // 지도가 이미 제거됨 — 정리할 대상이 없다
  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
  if (map.getSource(SRC_ID)) map.removeSource(SRC_ID);
}

export function SunHoursLayer({ map }: { map: MapLibreMap }) {
  const hours = useAppStore((s) => s.sunHours);
  const spec = useAppStore((s) => s.sunHoursSpec);
  const origin = useAppStore((s) => s.origin);
  const visible = useAppStore((s) => s.layers.sunHours);

  useEffect(() => {
    // 지도가 제거되면 더 이상 정리하지 않는다. (MapLibre 공개 이벤트)
    let mapRemoved = false;
    const onRemove = () => {
      mapRemoved = true;
    };
    map.on('remove', onRemove);

    const apply = () => {
      if (mapRemoved || !hasLiveStyle(map)) return;
      if (!hours || !spec || !origin || !visible) {
        removeSunHours(map);
        return;
      }
      const bounds = gridWgsBounds(spec, origin);
      const image = sunHoursCanvas(hours, spec);
      const coordinates = sunHoursImageCoordinates(bounds);
      const url = image.toDataURL();
      const existing = map.getSource(SRC_ID) as
        | { updateImage?: (opts: { url: string; coordinates: number[][] }) => void }
        | undefined;
      if (existing?.updateImage && map.getLayer(LAYER_ID)) {
        existing.updateImage({ url, coordinates });
        return;
      }
      removeSunHours(map);
      map.addSource(SRC_ID, {
        type: 'image',
        url,
        coordinates,
      });
      const before = map.getLayer('aoi-line') ? 'aoi-line' : undefined;
      map.addLayer(
        {
          id: LAYER_ID,
          type: 'raster',
          source: SRC_ID,
          paint: {
            'raster-opacity': 0.85,
            'raster-fade-duration': 0,
          },
        },
        before,
      );
    };

    if (map.loaded() || map.isStyleLoaded()) apply();
    else map.once('load', apply);

    return () => {
      map.off('load', apply);
      map.off('remove', onRemove);
      if (mapRemoved) return;
      removeSunHours(map);
    };
  }, [map, hours, spec, origin, visible]);

  return null;
}
