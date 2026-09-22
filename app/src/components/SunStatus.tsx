import mapConfig from '../../config/map.json';
import { DISTRICTS } from '@/data/municipal';
import { formatMinutes, koreaClockMinutes } from '@/lib/time';
import {
  combineLocalDateMinutes,
  sunTimes,
  sunVector,
} from '@/solar/sunVector';
import { useAppStore } from '@/store/appStore';

function hm(d: Date): string {
  return formatMinutes(koreaClockMinutes(d));
}

export function SunStatus() {
  const date = useAppStore((s) => s.date);
  const timeMinutes = useAppStore((s) => s.timeMinutes);
  const origin = useAppStore((s) => s.origin);
  const districtCode=useAppStore(s=>s.selectedDistrictCode);
  const district=DISTRICTS.find(d=>d.code===districtCode);
  const loc = origin ?? (district ? {lon0:district.label[0],lat0:district.label[1]} : {
    lat0: mapConfig.initialView.lat,
    lon0: mapConfig.initialView.lon,
  });
  const when = combineLocalDateMinutes(date, timeMinutes);
  const sun = sunVector(when, loc.lat0, loc.lon0);
  const times = sunTimes(date, loc.lat0, loc.lon0);
  const night = sun.alt <= 0;
  const altDeg = ((sun.alt * 180) / Math.PI).toFixed(1);
  const az = sun.azimuthNorthDeg.toFixed(0);

  return (
    <div
      className={night ? 'sun-status sun-status-night' : 'sun-status'}
      data-testid="sun-status"
      title="태양의 방향·고도 계산입니다. 실측 일사량이나 노면온도가 아닙니다."
    >
      태양 위치(천문 계산) · 태양고도 {altDeg}° · 방위 {az}° · 일출 {hm(times.sunrise)} · 일몰 {hm(times.sunset)}
      {night ? ' · 야간' : ''}
    </div>
  );
}
