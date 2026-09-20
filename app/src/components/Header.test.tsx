import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Header } from '@/components/Header';
import { useAppStore } from '@/store/appStore';

function resetStore() {
  useAppStore.setState({
    selectionSizeM: 500,
    aoi: null,
    origin: null,
    date: new Date(2026, 8, 16),
    timeMinutes: 720,
    aoiDrawMode: false,
    aoiWarning: null,
    viewCenter: { lat: 37.658, lon: 126.832 },
  });
}

describe('Header AOI smoke', () => {
  beforeEach(resetStore);
  afterEach(cleanup);

  it('500m 사각형 writes a 500m AOI at viewCenter', () => {
    render(<Header />);
    expect(screen.getByTestId('aoi-status')).toHaveTextContent('지도를 옮겨');
    fireEvent.click(screen.getByRole('button', { name: '이 주변 분석하기' }));
    expect(screen.getByTestId('aoi-status')).toHaveTextContent('500m × 500m 선택됨');
    expect(useAppStore.getState().origin).toEqual({lat0:37.658,lon0:126.832});
  });
});
