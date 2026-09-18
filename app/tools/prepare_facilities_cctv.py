#!/usr/bin/env python3
"""방범용 CCTV·비상벨 엑셀 → 가공 JSON. 원본 xlsx와 buildings.geojson은 읽기만 한다."""

from __future__ import annotations

import argparse
import json
import math
import os
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPLICIT_JIBUN_RE = re.compile(
    r"(?P<dong>[가-힣]+(?:동|리))\s*(?P<san>산\s*)?(?P<bun>\d{1,4})(?:\s*-\s*(?P<ho>\d{1,4}))?"
)
# 지번 직후 또 다른 필지 형태. 5동·7호·1단지·피크닉장1 등 설명 숫자는 제외.
IMMEDIATE_PARCEL_RE = re.compile(
    r"^[\s,./·~～및과와\-–]+(?:산\s*)?\d{1,4}(?:\s*-\s*\d{1,4})?(?!\s*(?:동|호|층|단지|번길|길|번|통|교))"
)
ROAD_HINT_RE = re.compile(r"(?:로|길|대로|번길)\s*\d+|정류소번호|정류장")


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def ring_area_m2(ring: list[list[float]]) -> float:
    if len(ring) < 4:
        return 0.0
    lat0 = ring[0][1]
    m_lat = 111132.92
    m_lon = 111412.84 * math.cos(math.radians(lat0))
    pts = [((p[0] - ring[0][0]) * m_lon, (p[1] - ring[0][1]) * m_lat) for p in ring[:-1]]
    area = 0.0
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        area += x1 * y2 - x2 * y1
    return abs(area) * 0.5


def centroid_lnglat(ring: list[list[float]]) -> list[float] | None:
    if len(ring) < 4:
        return None
    lat0 = ring[0][1]
    m_lat = 111132.92
    m_lon = 111412.84 * math.cos(math.radians(lat0))
    pts = [((p[0] - ring[0][0]) * m_lon, (p[1] - ring[0][1]) * m_lat) for p in ring[:-1]]
    area2 = 0.0
    cx = 0.0
    cy = 0.0
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        cross = x1 * y2 - x2 * y1
        area2 += cross
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    if abs(area2) < 1e-9:
        xs = [p[0] for p in ring[:-1]]
        ys = [p[1] for p in ring[:-1]]
        return [sum(xs) / len(xs), sum(ys) / len(ys)]
    cx /= 3 * area2
    cy /= 3 * area2
    return [ring[0][0] + cx / m_lon, ring[0][1] + cy / m_lat]


def parse_pnu(pnu: str) -> tuple[str, str, bool, int, int] | None:
    if not (len(pnu) == 19 and pnu.isdigit()):
        return None
    return pnu[:5], pnu[5:10], pnu[10] == "2", int(pnu[11:15]), int(pnu[15:19])


def extract_jibun(place: str, dong_col: str | None = None) -> tuple[dict | None, str | None]:
    del dong_col  # 행정동을 법정동으로 쓰지 않는다.
    text = str(place or "").strip()
    if not text:
        return None, "empty-address"
    matches = list(EXPLICIT_JIBUN_RE.finditer(text))
    if not matches:
        if ROAD_HINT_RE.search(text):
            return None, "road-address"
        return None, "no-explicit-jibun"
    if len(matches) > 1:
        return None, "ambiguous-jibun"
    m = matches[0]
    rest = re.sub(r"\([^)]*\)", " ", text[m.end() :])
    if EXPLICIT_JIBUN_RE.search(rest):
        return None, "ambiguous-jibun"
    if IMMEDIATE_PARCEL_RE.search(rest):
        return None, "ambiguous-jibun"
    return {
        "dong": m.group("dong"),
        "san": bool(m.group("san")),
        "bun": int(m.group("bun")),
        "ho": int(m.group("ho") or 0),
    }, None


def simple_address_key(value: str):
    m = re.search(r"([가-힣]+(?:동|리))\s*(산\s*)?(\d+)(?:\s*-\s*(\d+))?", str(value or ""))
    if not m:
        return None
    return m.group(1), bool(m.group(2)), int(m.group(3)), int(m.group(4) or 0)


def parse_bell(value) -> bool | None:
    if value is None or str(value).strip() == "":
        return None
    t = str(value).strip().upper()
    if t in ("O", "○", "Y", "YES", "유", "있음"):
        return True
    if t in ("X", "×", "N", "NO", "무", "없음"):
        return False
    return None


def parse_year(value) -> int | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        n = int(float(value))
    except (TypeError, ValueError):
        return None
    return n if 1990 <= n <= 2100 else None


def parse_cameras(value) -> int | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        n = int(float(value))
    except (TypeError, ValueError):
        return None
    return n if n >= 0 else None


def build_lookup(features: list[dict]):
    by_key = defaultdict(list)
    dong_codes: dict[str, str] = {}
    for feat in features:
        props = feat.get("properties") or {}
        pnu = str(props.get("pnu") or "")
        parsed = parse_pnu(pnu)
        if not parsed:
            continue
        sigungu, dong_code, san, bun, ho = parsed
        name = str(props.get("name") or "")
        dong = name.split()[-1] if name else ""
        geom = feat.get("geometry") or {}
        coords = geom.get("coordinates") or []
        ring = coords[0] if coords else []
        area = ring_area_m2(ring) if ring else 0.0
        center = centroid_lnglat(ring) if ring else None
        rec = {
            "id": props.get("id") or feat.get("id"),
            "pnu": pnu,
            "sigungu": sigungu,
            "dong": dong,
            "area": area,
            "center": center,
        }
        if dong:
            dong_codes[dong] = dong_code
            by_key[(dong, san, bun, ho)].append(rec)
    return by_key, dong_codes


def parse_workbook(path: Path) -> list[dict]:
    import openpyxl

    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    table = "general"
    out: list[dict] = []
    for i, row in enumerate(ws.iter_rows(values_only=True), 1):
        cells = list(row) + [None] * 12
        text = " ".join(str(v) for v in cells if v is not None)
        if "설치장소" in text or "카메라수량" in text:
            if "차량번호" in text or "카메라수량" in text:
                table = "plate"
            elif "일반방범" in text:
                table = "general"
            continue
        serial = cells[1]
        if not isinstance(serial, (int, float)):
            continue
        place = cells[5]
        if place is None or str(place).strip() == "":
            continue
        serial_i = int(serial)
        if table == "plate":
            source_id = f"plate-{serial_i:03d}"
            cameras = parse_cameras(cells[8])
            year = parse_year(cells[6])
            bell = None
        else:
            source_id = str(cells[2]).strip() if cells[2] is not None else f"row-{i}"
            cameras = parse_cameras(cells[6])
            bell = parse_bell(cells[7])
            year = parse_year(cells[8])
        status = "removed" if "철거" in str(place) else "active"
        out.append(
            {
                "stableId": f"{source_id}#r{i}",
                "sourceId": source_id,
                "sourceRow": i,
                "tableType": table,
                "gu": str(cells[3]).strip() if cells[3] else None,
                "dong": str(cells[4]).strip() if cells[4] else None,
                "placeText": str(place).strip(),
                "cameraCount": cameras,
                "hasEmergencyBell": bell,
                "installYear": year,
                "status": status,
            }
        )
    return out


def match_site(site: dict, lookup, dong_codes: dict[str, str]) -> dict:
    parsed, reason = extract_jibun(site["placeText"], site.get("dong"))
    base = {
        "locationGrade": "unmatched",
        "position": None,
        "positionBasis": None,
        "matchRule": None,
        "matchedPnu": None,
        "matchedBuildingId": None,
        "matchNote": None,
    }
    if parsed is None:
        base["matchNote"] = reason
        return base
    dong = parsed["dong"]
    if dong not in dong_codes:
        base["matchNote"] = "unknown-dong"
        return {**base, "matchRule": "jibun→pnu"}
    cands = lookup.get((dong, parsed["san"], parsed["bun"], parsed["ho"]), [])
    if not cands:
        base["matchNote"] = "no-building"
        return {**base, "matchRule": "jibun→pnu"}
    cands = sorted(cands, key=lambda b: b["area"], reverse=True)
    chosen = cands[0]
    note = f"동일 지번 복수 건물 {len(cands)}" if len(cands) > 1 else None
    return {
        "locationGrade": "matched",
        "position": chosen["center"],
        "positionBasis": "matchedBuildingCentroid",
        "matchRule": "jibun→pnu",
        "matchedPnu": chosen["pnu"],
        "matchedBuildingId": chosen["id"],
        "matchNote": note,
    }


def convert(xlsx: Path, buildings_path: Path, out_path: Path) -> dict:
    sites = parse_workbook(xlsx)
    features = load_json(buildings_path)["features"]
    lookup, dong_codes = build_lookup(features)
    deog_rows = [s for s in sites if s.get("gu") == "덕양구"]
    simple_keys = 0
    for s in deog_rows:
        k = simple_address_key(s["placeText"])
        if k and k in lookup:
            simple_keys += 1
    for s in sites:
        s.update(match_site(s, lookup, dong_codes))

    def cam_sum(rows):
        return sum(s["cameraCount"] or 0 for s in rows)

    general = [s for s in sites if s["tableType"] == "general"]
    plate = [s for s in sites if s["tableType"] == "plate"]
    deog = [s for s in sites if s.get("gu") == "덕양구"]
    deog_g = [s for s in deog if s["tableType"] == "general"]
    deog_p = [s for s in deog if s["tableType"] == "plate"]
    matched = [s for s in deog if s["locationGrade"] == "matched"]
    unmatched = [s for s in deog if s["locationGrade"] != "matched"]
    reasons = Counter(s.get("matchNote") or "unspecified" for s in unmatched if not str(s.get("matchNote") or "").startswith("동일"))
    bells = Counter()
    for s in deog:
        if s["hasEmergencyBell"] is True:
            bells["yes"] += 1
        elif s["hasEmergencyBell"] is False:
            bells["no"] += 1
        else:
            bells["unknown"] += 1
    removed = [s for s in deog if s["status"] == "removed"]
    meta = {
        "source": "고양시 방범용 CCTV 및 비상벨 설치 현황 (2026년 1월)",
        "sourceFile": xlsx.name,
        "hasCoordinates": False,
        "totalSites": len(sites),
        "totalCameras": cam_sum(sites),
        "byTable": {
            "general": {"sites": len(general), "cameras": cam_sum(general)},
            "plate": {"sites": len(plate), "cameras": cam_sum(plate)},
        },
        "filtered": {
            "gu": "덕양구",
            "sites": len(deog),
            "cameras": cam_sum(deog),
            "general": {"sites": len(deog_g), "cameras": cam_sum(deog_g)},
            "plate": {"sites": len(deog_p), "cameras": cam_sum(deog_p)},
        },
        "bell": {"yes": bells["yes"], "no": bells["no"], "unknown": bells["unknown"]},
        "removed": len(removed),
        "match": {
            "simpleParseCandidates": simple_keys,
            "matched": len(matched),
            "unmatched": len(unmatched),
            "unmatchedReasons": dict(reasons),
            "note": "437은 단순 첫 지번 파싱 후보. 다중지번 등은 unmatched로 두고 강제 매칭하지 않음.",
        },
        "duplicateSourceIds": [
            sid for sid, n in Counter(s["sourceId"] for s in sites).items() if n > 1
        ],
        "warning": "원천 자료에 좌표·설치높이·방향·화각이 없습니다. 지도상 위치는 PNU 지번 매칭으로 찾은 건물의 중심점이며 실제 카메라 설치 지점이 아닙니다.",
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    staging = ROOT / "data" / "staging"
    staging.mkdir(parents=True, exist_ok=True)
    tmp_json = staging / f"{out_path.name}.part"
    tmp_meta = staging / f"{out_path.with_suffix('').name}.meta.json.part"
    meta_path = out_path.with_name("cctv_sites.meta.json")
    tmp_json.write_text(json.dumps(sites, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp_meta.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp_json, out_path)
    os.replace(tmp_meta, meta_path)
    print(json.dumps(meta["filtered"], ensure_ascii=False))
    print(json.dumps(meta["match"], ensure_ascii=False))
    print("wrote", out_path, "sites", len(sites))
    return meta


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--input",
        type=Path,
        default=Path(r"C:\Users\이근민\Downloads\방범용 CCTV 및 비상벨 설치 현황_2026년 1월.xlsx"),
    )
    p.add_argument(
        "--buildings",
        type=Path,
        default=ROOT / "public" / "data" / "buildings.geojson",
    )
    p.add_argument(
        "--out",
        type=Path,
        default=ROOT / "public" / "data" / "facilities" / "cctv_sites.json",
    )
    args = p.parse_args()
    if not args.input.exists():
        print("xlsx not found", args.input)
        return 1
    convert(args.input, args.buildings, args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
