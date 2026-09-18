import { useEffect } from 'react';
import dataSources from '../../config/data-sources.json';
import {
  DEFAULT_AOI_SIZE_M,
  bboxCenter,
  squareBboxAround,
} from '@/geo/aoi';
import { loadBuildings, resolveBuildingSource } from '@/data/buildingLoader';
import { useAppStore } from '@/store/appStore';
import type { BuildingSourceConfig } from '@/types/building';

const SOURCE_CONFIG = dataSources as BuildingSourceConfig;

export function useBuildingsLoader(): void {
  const aoi = useAppStore((s) => s.aoi);
  const origin = useAppStore((s) => s.origin);
  const beginBuildingLoad = useAppStore((s) => s.beginBuildingLoad);
  const applyBuildingLoad = useAppStore((s) => s.applyBuildingLoad);

  useEffect(() => {
    const ac = new AbortController();
    const seq = beginBuildingLoad();
    const viewCenter = useAppStore.getState().viewCenter;
    const bbox =
      aoi?.bbox ??
      squareBboxAround(
        { lat0: viewCenter.lat, lon0: viewCenter.lon },
        DEFAULT_AOI_SIZE_M,
      );
    const ori = origin ?? bboxCenter(bbox);

    resolveBuildingSource(SOURCE_CONFIG, ac.signal)
      .then((source) =>
        loadBuildings({
          source,
          origin: ori,
          aoiBbox: bbox,
          signal: ac.signal,
        }),
      )
      .then((result) => {
        applyBuildingLoad(seq, result);
      })
      .catch((err: unknown) => {
        const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : '';
        if (name === 'AbortError') return;
        console.error('[BITGIL] building load failed', err);
      });

    return () => ac.abort();
  }, [aoi, origin, beginBuildingLoad, applyBuildingLoad]);
}
