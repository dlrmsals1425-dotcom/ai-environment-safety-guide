import { useCallback } from 'react';
import { cropGround, groundCovers } from '@/data/ground';
import { analysisBlockReason } from '@/analysis/gating';
import {
  computeSunHoursDistributed,
  terminateSunHoursPool,
} from '@/analysis/pool';
import { useAppStore } from '@/store/appStore';

export function useSunHours() {
  const run = useCallback(async () => {
    const state = useAppStore.getState();
    const blocked = analysisBlockReason({aoiPresent: !!state.aoi,
      buildings: state.seoulBuildings, groundReady: !!state.aoi && groundCovers(state.ground, state.aoi.bbox)});
    if (blocked) { state.setSunHoursError(blocked); return; }
    if (!state.aoi || !state.origin) {
      state.setSunHoursError('관심구역을 먼저 지정하세요.');
      return;
    }
    if (state.buildings.length === 0) {
      state.setSunHoursError('건물 데이터가 없습니다.');
      return;
    }
    const seq = state.beginSunHoursLoad();
    try {
      const result = await computeSunHoursDistributed(
        {
          buildings: state.buildings,
          ground: cropGround(state.ground!, state.aoi.bbox, state.origin),
          aoi: state.aoi.bbox,
          origin: state.origin,
          dateParts: {
            year: state.date.getFullYear(),
            month: state.date.getMonth(),
            day: state.date.getDate(),
          },
        },
        (ratio) => {
          useAppStore.getState().applySunHoursProgress(seq, ratio);
        },
      );
      useAppStore
        .getState()
        .applySunHoursResult(seq, result.hours, result.spec, result.meta);
    } catch (err) {
      if (seq !== useAppStore.getState().sunHoursSeq) return;
      const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : '';
      if (name === 'AbortError') {
        useAppStore.getState().applySunHoursError(seq, null);
        return;
      }
      useAppStore.getState().applySunHoursError(
        seq,
        err instanceof Error ? err.message : String(err),
      );
    }
  }, []);

  const cancel = useCallback(() => {
    terminateSunHoursPool();
    useAppStore.getState().invalidateSunHours();
  }, []);

  return { run, cancel };
}
