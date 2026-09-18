import { DATE_PRESET_LABELS } from '@/lib/datePresets';
import {
  formatMinutes,
  SLIDER_MAX_MINUTES,
  SLIDER_MIN_MINUTES,
} from '@/lib/time';
import { useAppStore } from '@/store/appStore';

export function TimeSlider() {
  const timeMinutes = useAppStore((s) => s.timeMinutes);
  const setTimeMinutes = useAppStore((s) => s.setTimeMinutes);
  const date = useAppStore((s) => s.date);
  const setDatePreset = useAppStore((s) => s.setDatePreset);

  const sliderValue = Math.min(
    SLIDER_MAX_MINUTES,
    Math.max(SLIDER_MIN_MINUTES, timeMinutes),
  );

  const dateLabel = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  return (
    <footer className="timebar">
      <div className="timebar-clock" aria-live="polite">
        <span className="timebar-hm">{formatMinutes(timeMinutes)}</span>
        <span className="timebar-date">{dateLabel}</span>
      </div>

      <div className="timebar-slider">
        <span className="tick">06:00</span>
        <input
          type="range"
          min={SLIDER_MIN_MINUTES}
          max={SLIDER_MAX_MINUTES}
          step={1}
          value={sliderValue}
          aria-label="시각"
          data-testid="time-slider"
          onChange={(e) => setTimeMinutes(Number(e.target.value))}
        />
        <span className="tick">20:00</span>
      </div>

      <div className="timebar-presets" role="group" aria-label="날짜 프리셋">
        {DATE_PRESET_LABELS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className="btn btn-preset"
            data-testid={`preset-${id}`}
            onClick={() => setDatePreset(id)}
          >
            {label}
          </button>
        ))}
      </div>
    </footer>
  );
}
