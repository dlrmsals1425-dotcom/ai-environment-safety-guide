import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SunStatus } from '@/components/SunStatus';
import { useAppStore } from '@/store/appStore';

describe('SunStatus', () => {
  beforeEach(() => {
    useAppStore.setState({
      date: new Date(2026, 5, 21),
      timeMinutes: 12 * 60 + 30,
    });
  });
  afterEach(cleanup);

  it('shows altitude, azimuth and sunrise/sunset', () => {
    render(<SunStatus />);
    const el = screen.getByTestId('sun-status');
    expect(el.textContent).toMatch(/태양고도 /);
    expect(el.textContent).toMatch(/방위 /);
    expect(el.textContent).toMatch(/일출 /);
    expect(el.textContent).toMatch(/일몰 /);
  });
});
