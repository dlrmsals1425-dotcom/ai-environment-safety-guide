import SunCalc from 'suncalc';

export type Vec3 = { x: number; y: number; z: number };

export type SunVector = {
  alt: number;
  azimuthNorthDeg: number;
  S: Vec3;
};

export function wrapDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** 명세 §2 기본형: A = suncalcAzimuth + π (북 기준 시계방향). */
export function sunVectorFromSouthAzimuth(alt: number, azimuthSouth: number): Vec3 {
  const A = azimuthSouth + Math.PI;
  return {
    x: Math.sin(A) * Math.cos(alt),
    y: Math.cos(A) * Math.cos(alt),
    z: Math.sin(alt),
  };
}

/** 명세 §2 동치형. */
export function sunVectorEquivalent(alt: number, azimuthSouth: number): Vec3 {
  return {
    x: -Math.sin(azimuthSouth) * Math.cos(alt),
    y: -Math.cos(azimuthSouth) * Math.cos(alt),
    z: Math.sin(alt),
  };
}

export function sunVector(date: Date, lat: number, lon: number): SunVector {
  const p = SunCalc.getPosition(date, lat, lon);
  const S = sunVectorFromSouthAzimuth(p.altitude, p.azimuth);
  const A = p.azimuth + Math.PI;
  return {
    alt: p.altitude,
    azimuthNorthDeg: wrapDeg((A * 180) / Math.PI),
    S,
  };
}

/** 그림자 방위: 태양 반대 수평 방향, 북 기준 시계방향. */
export function shadowAzimuthNorthDeg(S: Vec3): number {
  return wrapDeg((Math.atan2(-S.x, -S.y) * 180) / Math.PI);
}

export function combineLocalDateMinutes(date: Date, timeMinutes: number): Date {
  const minutes = Math.max(0, Math.min(1439, Math.round(timeMinutes)));
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    Math.floor(minutes / 60),
    minutes % 60,
    0,
    0,
  );
}

export function findSolarNoon(
  date: Date,
  lat: number,
  lon: number,
): { minutes: number; sun: SunVector } {
  let bestMinutes = 12 * 60;
  let best = sunVector(combineLocalDateMinutes(date, bestMinutes), lat, lon);
  for (let m = 11 * 60; m <= 14 * 60; m++) {
    const s = sunVector(combineLocalDateMinutes(date, m), lat, lon);
    if (s.alt > best.alt) {
      best = s;
      bestMinutes = m;
    }
  }
  return { minutes: bestMinutes, sun: best };
}

export function sunTimes(date: Date, lat: number, lon: number) {
  return SunCalc.getTimes(date, lat, lon);
}
