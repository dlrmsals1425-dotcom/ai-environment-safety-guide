import { describe, expect, it } from 'vitest';
import { mergeHours, partitionItems } from '@/analysis/partition';

describe('partitionItems / mergeHours', () => {
  it('splits items across workers without dropping any', () => {
    const items = [0, 1, 2, 3, 4];
    const parts = partitionItems(items, 3);
    expect(parts.length).toBe(3);
    expect(parts.flat().sort()).toEqual(items);
  });

  it('does not create empty chunks', () => {
    expect(partitionItems([1], 8)).toEqual([[1]]);
  });

  it('adds hours chunks elementwise', () => {
    const a = new Float32Array([1, 2, 0]);
    const b = new Float32Array([0.5, 0, 3]);
    expect([...mergeHours([a, b])]).toEqual([1.5, 2, 3]);
  });
});
