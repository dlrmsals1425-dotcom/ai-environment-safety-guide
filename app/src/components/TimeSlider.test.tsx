import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimeSlider, PLAYBACK_INTERVAL_MS } from '@/components/TimeSlider';
import { useAppStore } from '@/store/appStore';

describe('TimeSlider', () => {
  beforeEach(() => {
    useAppStore.setState({
      date: new Date(2026, 8, 16),
      timeMinutes: 720,
      shadowBusy:false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('plays in ten-minute steps and pauses for manual slider changes',()=>{
    vi.useFakeTimers();render(<TimeSlider/>);
    fireEvent.click(screen.getByRole('button',{name:'10분 간격 재생'}));
    act(()=>{vi.advanceTimersByTime(PLAYBACK_INTERVAL_MS*2);});
    expect(useAppStore.getState().timeMinutes).toBe(740);
    fireEvent.change(screen.getByLabelText('시각'),{target:{value:'800'}});
    act(()=>{vi.advanceTimersByTime(PLAYBACK_INTERVAL_MS*2);});
    expect(useAppStore.getState().timeMinutes).toBe(800);
    expect(screen.getByRole('button',{name:'10분 간격 재생'})).toHaveAttribute('aria-pressed','false');
  });
  it('stops at the end of the selected day and explicitly restarts from midnight',()=>{
    vi.useFakeTimers();useAppStore.setState({timeMinutes:1430});render(<TimeSlider/>);
    fireEvent.click(screen.getByRole('button',{name:'10분 간격 재생'}));
    act(()=>{vi.advanceTimersByTime(PLAYBACK_INTERVAL_MS);});
    expect(useAppStore.getState().timeMinutes).toBe(1439);
    expect(screen.getByRole('button',{name:'처음부터 10분 간격 재생'})).toHaveAttribute('aria-pressed','false');
    fireEvent.click(screen.getByRole('button',{name:'처음부터 10분 간격 재생'}));
    expect(useAppStore.getState().timeMinutes).toBe(0);
  });
  it('waits for the shadow frame instead of racing ahead of the map',()=>{
    vi.useFakeTimers();useAppStore.setState({shadowBusy:true});render(<TimeSlider/>);
    fireEvent.click(screen.getByRole('button',{name:'10분 간격 재생'}));
    act(()=>{vi.advanceTimersByTime(PLAYBACK_INTERVAL_MS*3);});
    expect(useAppStore.getState().timeMinutes).toBe(720);
    act(()=>{useAppStore.setState({shadowBusy:false});vi.advanceTimersByTime(PLAYBACK_INTERVAL_MS);});
    expect(useAppStore.getState().timeMinutes).toBe(730);
  });
  it('stops playback when the date or area changes and removes its timer on unmount',()=>{
    vi.useFakeTimers();const {unmount}=render(<TimeSlider/>);
    const play=()=>fireEvent.click(screen.getByRole('button',{name:'10분 간격 재생'}));
    play();act(()=>{useAppStore.getState().selectDistrict('11650');});
    act(()=>{vi.advanceTimersByTime(PLAYBACK_INTERVAL_MS);});
    expect(useAppStore.getState().timeMinutes).toBe(720);
    play();fireEvent.change(screen.getByLabelText('분석 날짜'),{target:{value:'2026-12-21'}});
    act(()=>{vi.advanceTimersByTime(PLAYBACK_INTERVAL_MS);});
    expect(useAppStore.getState().timeMinutes).toBe(720);
    play();unmount();act(()=>{vi.advanceTimersByTime(PLAYBACK_INTERVAL_MS);});
    expect(useAppStore.getState().timeMinutes).toBe(720);
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
