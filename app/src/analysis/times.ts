import {
  combineLocalDateMinutes,
  sunTimes,
  sunVector,
  type SunVector,
} from '@/solar/sunVector';

export function daylightSunSamples(
  date: Date,
  lat: number,
  lon: number,
  stepMinutes: number,
): SunVector[] {
  const times = sunTimes(date, lat, lon);
  const rise = times.sunrise.getHours() * 60 + times.sunrise.getMinutes();
  const set = times.sunset.getHours() * 60 + times.sunset.getMinutes();
  const out: SunVector[] = [];
  const start = Math.floor(rise / stepMinutes) * stepMinutes;
  for (let m = start; m <= set; m += stepMinutes) {
    out.push(sunVector(combineLocalDateMinutes(date, m), lat, lon));
  }
  return out;
}
