#!/usr/bin/env python3
"""
황금 검증값(Golden Tests) 재현 스크립트 — 빛길(BITGIL)

docs/02-분석엔진-명세.md §9 의 기대값이 어디서 나왔는지 직접 계산해 보여준다.
그록의 구현이 이 값과 다르면 구현이 틀린 것이다.

    python tools/verify_golden_values.py
"""
import math
import datetime

LAT, LON = 37.658, 126.832          # 고양시 일산동구
STD_MERIDIAN = 135.0                # KST 표준자오선
BLD_H = 10.0                        # 검증용 건물 높이 (m)


def meters_per_degree(lat_deg: float):
    """docs/02 §1.1 — 위도별 미터 환산 계수"""
    phi = math.radians(lat_deg)
    m_lat = 111132.92 - 559.82 * math.cos(2 * phi) + 1.175 * math.cos(4 * phi)
    m_lon = 111412.84 * math.cos(phi) - 93.5 * math.cos(3 * phi)
    return m_lat, m_lon


def equation_of_time(day_of_year: int) -> float:
    """균시차 (분). 진태양시 − 평균태양시"""
    b = math.radians(360 / 365 * (day_of_year - 81))
    return 9.87 * math.sin(2 * b) - 7.53 * math.cos(b) - 1.5 * math.sin(b)


def illuminance(lumen: float, n: float, height: float, offset: float,
                maintenance: float = 1.0) -> tuple:
    """docs/02 §6.1 — 램버시안 배광 점광원의 수평면 조도"""
    i0 = lumen * (n + 1) / (2 * math.pi)          # cd
    d = math.hypot(height, offset)
    cos_gamma = height / d
    e = maintenance * i0 * cos_gamma ** (n + 1) / (d * d)
    return i0, d, e


def ppm_distance(w_px: int, hfov_deg: float, ppm: float) -> float:
    """docs/02 §7.1 — 목표 화소밀도를 만족하는 최대거리"""
    return w_px / (2 * ppm * math.tan(math.radians(hfov_deg / 2)))


def main():
    print(f"기준점: 고양시 일산동구 ({LAT}N, {LON}E), 검증 건물 높이 {BLD_H}m\n")

    m_lat, m_lon = meters_per_degree(LAT)
    print("[ENU 환산계수]")
    print(f"  mPerDegLat = {m_lat:10.1f}")
    print(f"  mPerDegLon = {m_lon:10.1f}\n")

    print("[GT-2 남중고도 / GT-3 그림자 길이]   남중고도 = 90 - 위도 + 적위")
    for label, decl in [("춘분/추분", 0.0), ("하지", 23.44), ("동지", -23.44)]:
        alt = 90 - LAT + decl
        shadow = BLD_H / math.tan(math.radians(alt))
        print(f"  {label:9s}  고도 {alt:6.2f}°   그림자 {shadow:6.3f} m")
    print()

    print("[GT-4 남중 시각 (KST)]   12:00 + 4×(135−경도) − 균시차")
    for label, d in [("춘분", datetime.date(2026, 3, 20)),
                     ("하지", datetime.date(2026, 6, 21)),
                     ("추분", datetime.date(2026, 9, 22)),
                     ("동지", datetime.date(2026, 12, 21))]:
        eot = equation_of_time(d.timetuple().tm_yday)
        noon = 12 * 60 + 4 * (STD_MERIDIAN - LON) - eot
        print(f"  {label}  {int(noon // 60):02d}:{int(noon % 60):02d}   (균시차 {eot:+.1f}분)")
    print("  → 허용 범위 12:20 ~ 12:45\n")

    print("[GT-6 조도]   Φ=4000lm, n=2, H=5m, M=1.0")
    for label, offset in [("GT-6a 직하", 0.0), ("GT-6b 수평 3m", 3.0)]:
        i0, d, e = illuminance(4000, 2, 5.0, offset)
        print(f"  {label:14s}  I0={i0:8.2f} cd   d={d:.3f} m   E={e:7.3f} lx")
    print()

    print("[GT-7 CCTV 유효거리]   1920px, HFOV 60°")
    for label, ppm in [("탐지 Detect", 25), ("관찰 Observe", 62),
                       ("인식 Recognize", 125), ("식별 Identify", 250)]:
        print(f"  {label:16s} {ppm:3d} PPM  →  {ppm_distance(1920, 60, ppm):6.2f} m")
    print()

    print("[Phase 1 높이 추정]   공동주택 층고 2.95m, 파라펫 1.0m")
    print(f"  5층 → {2.95 * 5 + 1.0:.2f} m")


if __name__ == "__main__":
    main()
