import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TimeSlider } from '@/components/TimeSlider';
import { useAppStore } from '@/store/appStore';

describe('TimeSlider', () => {
  beforeEach(() => {
    useAppStore.setState({
      date: new Date(2026, 8, 16),
      timeMinutes: 720,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('updates store timeMinutes when the slider is moved', () => {
    render(<TimeSlider />);
    const slider = screen.getByTestId('time-slider');
    fireEvent.change(slider, { target: { value: '600' } });
    expect(useAppStore.getState().timeMinutes).toBe(600);
  });

  it('sets the requested calendar date without needing a season preset', () => {
    render(<TimeSlider />);
    fireEvent.change(screen.getByLabelText('분석 날짜'), {target:{value:'2026-12-21'}});
    const d = useAppStore.getState().date;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(21);
    expect(screen.getByText(/2026-12-21/)).toBeInTheDocument();
  });
});
