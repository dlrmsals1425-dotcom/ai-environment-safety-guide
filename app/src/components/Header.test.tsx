import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Header } from '@/components/Header';
import { useAppStore } from '@/store/appStore';

function resetStore() {
  useAppStore.setState({
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
    expect(screen.getByTestId('aoi-status')).toHaveTextContent('관심구역 미지정');
    fireEvent.click(screen.getByRole('button', { name: '500m 사각형' }));
    expect(screen.getByTestId('aoi-status')).toHaveTextContent('AOI 500m');
    expect(screen.getByTestId('aoi-status')).toHaveTextContent(
      '원점 37.65800, 126.83200',
    );
  });
});
