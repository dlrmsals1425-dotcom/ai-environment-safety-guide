import { describe, expect, it } from 'vitest';
import {
  cctvDisplayPosition,
  defaultGeocodeQuery,
  isGoyangDeogyangAddress,
} from '@/data/geocodeQuery';
import type { CctvSite } from '@/types/facility';

const base = {
  sourceId: 'S',
  sourceRow: 1,
  tableType: 'general' as const,
  gu: '덕양구',
  dong: '주교동',
  cameraCount: 1,
  hasEmergencyBell: false,
  installYear: 2010,
  status: 'active' as const,
  positionBasis: null,
  matchRule: null,
  matchedPnu: null,
  matchedBuildingId: null,
  matchNote: null,
};

describe('defaultGeocodeQuery', () => {
  it('prefixes a single jibun with 경기도 고양시 덕양구', () => {
    expect(defaultGeocodeQuery('지축동765-159')).toBe('경기도 고양시 덕양구 지축동 765-159');
  });

  it('prefixes a single road name and building number after dropping parentheses', () => {
    expect(defaultGeocodeQuery('세솔로73 (설명)')).toBe('경기도 고양시 덕양구 세솔로 73');
    expect(defaultGeocodeQuery('덕양구 고골길 238 고골인근')).toBe(
      '경기도 고양시 덕양구 고골길 238',
    );
    expect(defaultGeocodeQuery('토당로67번길52')).toBe('경기도 고양시 덕양구 토당로67번길 52');
    expect(defaultGeocodeQuery('토당로 67번길 52')).toBe('경기도 고양시 덕양구 토당로 67번길 52');
  });

  it('does not treat 번길 digits as a building number', () => {
    const raw = '토당로 67번길 (능곡초등학교 정문앞,오금동307-4)';
    expect(defaultGeocodeQuery(raw, 'road-address')).toBe(raw);
  });

  it('keeps ambiguous-jibun source text so the user can edit it', () => {
    expect(defaultGeocodeQuery('주교동 630 578-2 복권방 앞 삼거리', 'ambiguous-jibun')).toBe(
      '주교동 630 578-2 복권방 앞 삼거리',
    );
  });
});

describe('isGoyangDeogyangAddress', () => {
  it('requires both 고양시 and 덕양구', () => {
    expect(isGoyangDeogyangAddress('경기도 고양시 덕양구 주교동 598')).toBe(true);
    expect(isGoyangDeogyangAddress('경기도 고양시 일산동구 장항동 1')).toBe(false);
    expect(isGoyangDeogyangAddress('덕양구 주교동')).toBe(false);
  });
});

describe('cctvDisplayPosition', () => {
  it('uses live coords without writing the original position', () => {
    const site: CctvSite = {
      ...base,
      stableId: 'S-1#r1',
      placeText: '고골길 238',
      locationGrade: 'unmatched',
      position: null,
    };
    const live = { siteId: 'S-1#r1', lng: 126.83, lat: 37.65, label: '임시' };
    expect(cctvDisplayPosition(site, live)).toEqual([126.83, 37.65]);
    expect(site.position).toBeNull();
  });
});
