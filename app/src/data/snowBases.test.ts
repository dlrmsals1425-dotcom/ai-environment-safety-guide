import { describe, expect, it } from 'vitest';
import { filterSnowBases, snowBaseKinds } from '@/data/snowBases';
import type { SnowBaseFeature } from '@/types/seoul';

function base(
  id: string,
  agency: string,
  kind: string,
  location: string,
): SnowBaseFeature {
  return {
    type: 'Feature',
    properties: { id, agency, baseId: `B-${id}`, kind, location, coordinateStatus: 'ok' },
    geometry: { type: 'Point', coordinates: [127, 37.5] },
  };
}

const features = [
  base('1', '성동구청', '전진기지', '왕십리로'),
  base('2', '강남구청', '발진기지', '테헤란로'),
  base('3', '성동구청', '발진기지', '성수대교'),
];

describe('filterSnowBases', () => {
  it('filters by kind', () => {
    expect(filterSnowBases(features, { kind: '전진기지' }).map((f) => f.properties.id)).toEqual(['1']);
  });

  it('searches agency, location and base id', () => {
    expect(filterSnowBases(features, { query: '성동' }).map((f) => f.properties.id)).toEqual(['1', '3']);
    expect(filterSnowBases(features, { query: '테헤란' }).map((f) => f.properties.id)).toEqual(['2']);
    expect(filterSnowBases(features, { query: 'B-3' }).map((f) => f.properties.id)).toEqual(['3']);
  });

  it('combines kind and query, and returns everything with no filter', () => {
    expect(
      filterSnowBases(features, { kind: '발진기지', query: '성동' }).map((f) => f.properties.id),
    ).toEqual(['3']);
    expect(filterSnowBases(features, {})).toHaveLength(3);
  });
});

describe('snowBaseKinds', () => {
  it('lists the distinct kinds present in the data', () => {
    expect(snowBaseKinds(features)).toEqual(['발진기지', '전진기지']);
  });
});
