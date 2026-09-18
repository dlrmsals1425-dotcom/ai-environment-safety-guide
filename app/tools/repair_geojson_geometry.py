#!/usr/bin/env python3
"""최종 WGS84 GeoJSON에서 자기교차 1건을 make_valid로 보정. ZIP 재추출 없음."""

from __future__ import annotations

import json
import os
from datetime import date
from pathlib import Path

from shapely.geometry import mapping, shape
from shapely.validation import explain_validity, make_valid

ROOT = Path(__file__).resolve().parents[1]
TARGET_ID = "2013194216044613693300000000"


def round_coords(geom: dict, ndigits: int = 7) -> dict:
    def rnd(obj):
        if isinstance(obj, (int, float)):
            return round(float(obj), ndigits)
        if isinstance(obj, list):
            return [rnd(x) for x in obj]
        return obj

    out = dict(geom)
    out["coordinates"] = rnd(geom["coordinates"])
    return out


def largest_polygon(geom):
    if geom.geom_type == "Polygon":
        return geom
    if geom.geom_type == "MultiPolygon":
        return max(geom.geoms, key=lambda g: g.area)
    if geom.geom_type == "GeometryCollection":
        polys = [g for g in geom.geoms if g.geom_type in ("Polygon", "MultiPolygon")]
        if not polys:
            return geom
        parts = []
        for g in polys:
            if g.geom_type == "Polygon":
                parts.append(g)
            else:
                parts.extend(list(g.geoms))
        return max(parts, key=lambda g: g.area) if parts else geom
    return geom


def main() -> int:
    geo_path = ROOT / "public" / "data" / "buildings.geojson"
    meta_path = ROOT / "public" / "data" / "buildings.meta.json"
    fc = json.loads(geo_path.read_text(encoding="utf-8"))
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    found = None
    for feat in fc["features"]:
        if str(feat.get("id") or feat.get("properties", {}).get("id")) == TARGET_ID:
            found = feat
            break
    if found is None:
        print("target not found", TARGET_ID)
        return 1
    raw = shape(found["geometry"])
    issue = explain_validity(raw)
    print("before", raw.is_valid, issue)
    fixed = largest_polygon(make_valid(raw))
    found["geometry"] = round_coords(mapping(fixed))
    after = shape(found["geometry"])
    print("after", after.is_valid, explain_validity(after), after.geom_type)
    meta["geometryRepair"] = {
        "id": TARGET_ID,
        "issue": issue,
        "method": "shapely.make_valid on final WGS84 (7dp), keep largest polygon",
        "count": 1,
        "validAfter": bool(after.is_valid),
        "repairedAt": date.today().isoformat(),
        "originalPreserved": True,
        "note": "원 ZIP 재추출 없음. 분석 엔진 미변경.",
    }
    staging = ROOT / "data" / "staging"
    staging.mkdir(parents=True, exist_ok=True)
    tmp_geo = staging / "buildings.geojson.part"
    tmp_meta = staging / "buildings.meta.json.part"
    tmp_geo.write_text(json.dumps(fc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp_meta.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp_geo, geo_path)
    os.replace(tmp_meta, meta_path)
    print("wrote", geo_path)
    return 0 if after.is_valid else 2


if __name__ == "__main__":
    raise SystemExit(main())
