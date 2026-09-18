#!/usr/bin/env python3
"""GIS건물통합정보 SHP → WGS84 GeoJSON/FlatGeobuf 전처리.

필요 패키지 (이 환경에는 설치되어 있지 않으며, 원자료 SHP도 없다.
실행 검증은 보류. npm test는 이 스크립트에 의존하지 않는다):

    pip install geopandas pyogrio shapely pyproj

예:

    python tools/prepare_buildings.py \\
      --input  data/raw/경기도_건물통합정보.shp \\
      --bbox   126.76,37.62,126.84,37.69 \\
      --out    public/data/buildings_goyang.fgb \\
      --columns config/building-columns.json
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def pick_column(columns: list[str], fieldnames: list[str]) -> str | None:
    upper = {name.upper(): name for name in fieldnames}
    for cand in columns:
        if cand in fieldnames:
            return cand
        if cand.upper() in upper:
            return upper[cand.upper()]
    return None


def estimate_height(floors: float, use_name: str | None, height_raw, cfg: dict):
    table = cfg["floorHeightM"]
    fh = table.get(use_name, table["_default"]) if use_name else table["_default"]
    floors = floors if floors and floors > 0 else 1
    h_est = fh * floors + cfg["parapetM"]
    try:
        h_raw = float(height_raw) if height_raw is not None else None
    except (TypeError, ValueError):
        h_raw = None
    if h_raw is not None and cfg["measuredMinM"] <= h_raw <= cfg["measuredMaxM"]:
        tol = max(cfg["measuredAbsTolM"], cfg["measuredRelTol"] * h_est)
        if abs(h_raw - h_est) <= tol:
            return h_raw, "measured"
    return h_est, "estimated"


def parse_bbox(text: str) -> tuple[float, float, float, float]:
    parts = [float(p.strip()) for p in text.split(",")]
    if len(parts) != 4:
        raise argparse.ArgumentTypeError("bbox must be minLon,minLat,maxLon,maxLat")
    return parts[0], parts[1], parts[2], parts[3]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--bbox", required=True, type=parse_bbox)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--columns", type=Path, default=Path("config/building-columns.json"))
    parser.add_argument("--height-config", type=Path, default=Path("config/building-height.json"))
    parser.add_argument("--spatial-config", type=Path, default=Path("config/spatial.json"))
    args = parser.parse_args(argv)

    try:
        import geopandas as gpd
        from shapely.geometry import MultiPolygon, Polygon
    except ImportError:
        print(
            "geopandas/shapely 가 없습니다. pip install geopandas pyogrio shapely pyproj",
            file=sys.stderr,
        )
        return 2

    columns = load_json(args.columns)
    height_cfg = load_json(args.height_config)
    spatial = load_json(args.spatial_config)

    gdf = gpd.read_file(args.input)
    src_crs = gdf.crs
    print(f"source CRS: {src_crs}")
    if src_crs is None:
        print(".prj/CRS 없음 — 추정하지 않고 중단합니다. -- 좌표를 확인하세요.", file=sys.stderr)
        return 3

    # 단순화는 미터 좌표계에서
    metric = src_crs
    if src_crs.is_geographic:
        metric = "EPSG:5186"
        gdf = gdf.to_crs(metric)
    gdf["geometry"] = gdf.geometry.simplify(0.3, preserve_topology=True)
    gdf = gdf.to_crs("EPSG:4326")

    min_lon, min_lat, max_lon, max_lat = args.bbox
    gdf = gdf.cx[min_lon:max_lon, min_lat:max_lat]
    print(f"clipped features: {len(gdf)}")

    fieldnames = list(gdf.columns)
    mapping = {key: pick_column(names, fieldnames) for key, names in columns.items()}
    print("column mapping:", mapping)

    rows = []
    measured = 0
    for _, row in gdf.iterrows():
        geom = row.geometry
        if geom is None or geom.is_empty:
            continue
        polys: list[Polygon]
        if isinstance(geom, Polygon):
            polys = [geom]
        elif isinstance(geom, MultiPolygon):
            polys = list(geom.geoms)
        else:
            continue
        floors_col = mapping.get("floors")
        use_col = mapping.get("useName")
        height_col = mapping.get("height")
        name_col = mapping.get("name")
        pnu_col = mapping.get("pnu")
        floors = row[floors_col] if floors_col else 1
        try:
            floors = float(floors)
        except (TypeError, ValueError):
            floors = 1
        use_name = str(row[use_col]) if use_col and row[use_col] is not None else None
        h_raw = row[height_col] if height_col else None
        height, source = estimate_height(floors, use_name, h_raw, height_cfg)
        if height < spatial["minHeightM"]:
            continue
        if source == "measured":
            measured += 1
        for i, poly in enumerate(polys):
            if poly.area <= 0:
                continue
            # 면적 필터는 미터 CRS에서 하는 것이 정확하나, 여기선 대략 위도 1도^2 환산 없이
            # shapely 면적이 도 단위이므로 투영 후 재계산한다.
            rows.append((poly, height, source, floors, use_name, row.get(name_col) if name_col else None, row.get(pnu_col) if pnu_col else None, i))

    import geopandas as gpd2

    if not rows:
        print("no features after filter", file=sys.stderr)
        return 4

    # 면적 필터: EPSG:5186
    geoms = [r[0] for r in rows]
    out = gpd2.GeoDataFrame(
        {
            "height": [r[1] for r in rows],
            "heightSource": [r[2] for r in rows],
            "floors": [r[3] for r in rows],
            "useName": [r[4] for r in rows],
            "name": [r[5] for r in rows],
            "pnu": [r[6] for r in rows],
            "part": [r[7] for r in rows],
        },
        geometry=geoms,
        crs="EPSG:4326",
    )
    metric_out = out.to_crs("EPSG:5186")
    keep = metric_out.geometry.area >= spatial["minAreaM2"]
    out = out.loc[keep.values].copy()
    print(f"kept {len(out)} polygons")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    suffix = args.out.suffix.lower()
    if suffix == ".fgb":
        out.to_file(args.out, driver="FlatGeobuf")
    else:
        out.to_file(args.out, driver="GeoJSON")

    measured_ratio = float((out["heightSource"] == "measured").mean()) if len(out) else 0.0
    meta = {
        "source": "국토교통부 GIS건물통합정보",
        "downloadedAt": date.today().isoformat(),
        "epsgOriginal": str(src_crs),
        "featureCount": int(len(out)),
        "heightMeasuredRatio": measured_ratio,
        "aoiBboxWgs84": [min_lon, min_lat, max_lon, max_lat],
        "bufferMeters": spatial.get("aoiBufferM", 300),
        "synthetic": False,
    }
    meta_path = args.out.with_suffix(".meta.json")
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {args.out} and {meta_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
