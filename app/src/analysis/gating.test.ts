import { describe, expect, it } from 'vitest';
import { analysisBlockReason } from '@/analysis/gating';
import { emptyDatasetState, type DatasetState } from '@/types/seoul';

function ready(over: Partial<DatasetState<unknown>> = {}): DatasetState<unknown> {
  return { ...emptyDatasetState<unknown>(), status: 'ready', ...over };
}

describe('analysisBlockReason', () => {
  it('allows the run when the AOI buildings are fully loaded in analysis mode', () => {
    expect(
      analysisBlockReason({ groundReady: true, aoiPresent: true, buildings: ready() }),
    ).toBeNull();
  });

  it('blocks when the shared ground is not ready', () => {
    expect(
      analysisBlockReason({ groundReady: false, aoiPresent: true, buildings: ready() }),
    ).toContain('추정 지면');
  });

  it('blocks while loading, on error, and when data is missing', () => {
    expect(
      analysisBlockReason({

        groundReady: true, aoiPresent: true,
        buildings: { ...emptyDatasetState(), status: 'loading' },
      }),
    ).toContain('불러오는 중');
    expect(
      analysisBlockReason({

        groundReady: true, aoiPresent: true,
        buildings: { ...emptyDatasetState(), status: 'error', error: 'HTTP 500' },
      }),
    ).toContain('HTTP 500');
    expect(
      analysisBlockReason({

        groundReady: true, aoiPresent: true,
        buildings: { ...emptyDatasetState(), status: 'missing' },
      }),
    ).toContain('건물 데이터가 없습니다');
  });

  it('blocks when only part of the buildings were read', () => {
    expect(
      analysisBlockReason({

        groundReady: true, aoiPresent: true,
        buildings: ready({ tilesTruncated: true }),
      }),
    ).toContain('일부만');
    expect(
      analysisBlockReason({

        groundReady: true, aoiPresent: true,
        buildings: ready({ capped: true }),
      }),
    ).toContain('상한');
  });

  it('requires an AOI', () => {
    expect(
      analysisBlockReason({ groundReady: true, aoiPresent: false, buildings: ready() }),
    ).toContain('관심구역');
  });

  it('does not silently analyse a dataset with unreadable building geometry', () => {
    expect(analysisBlockReason({ groundReady: true, aoiPresent: true, buildings: ready({ skipped: 1 }) }))
      .toContain('읽지 못한 건물');
  });
});
