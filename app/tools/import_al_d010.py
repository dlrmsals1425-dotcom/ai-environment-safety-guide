#!/usr/bin/env python3
"""경기도 GIS건물통합정보(AL_D010) ZIP → 행정구 필터 WGS84 GeoJSON.

geopandas 없이 zip에서 SHP/DBF를 스트리밍한다.
필드: A26 지상층수, A9 주용도, A16 높이(m), A2 PNU, A1 UFID, A23 시군구, A4 주소.
기본 필터는 고양시 덕양구(41281).
"""

from __future__ import annotations

import argparse
import json
import os
import struct
import zipfile
from datetime import date
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import MultiPolygon, Polygon

ROOT = Path(__file__).resolve().parents[1]


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def decode_cp949(raw: bytes) -> str:
    return raw.decode("cp949", errors="replace").strip().strip("\x00")


def parse_dbf_fields(header_rest: bytes) -> list[tuple[str, str, int, int]]:
    fields: list[tuple[str, str, int, int]] = []
    for i in range(0, len(header_rest) - 1, 32):
        chunk = header_rest[i : i + 32]
        if not chunk or chunk[0] == 0x0D:
            break
        name = chunk[0:11].split(b"\x00", 1)[0].decode("ascii", "replace")
        fields.append((name, chr(chunk[11]), chunk[16], chunk[17]))
    return fields


def read_dbf_record(buf: bytes, fields: list[tuple[str, str, int, int]]) -> dict[str, str] | None:
    if not buf or buf[0:1] == b"*":
        return None
    pos = 1
    out: dict[str, str] = {}
    for name, _typ, size, _dec in fields:
        out[name] = decode_cp949(buf[pos : pos + size])
        pos += size
    return out


def parse_polygon(data: bytes) -> tuple[tuple[float, float, float, float], list[list[tuple[float, float]]]] | None:
    if len(data) < 44:
        return None
    st = struct.unpack_from("<i", data, 0)[0]
    if st == 0:
        return None
    if st not in (5, 15, 25):
        return None
    xmin, ymin, xmax, ymax = struct.unpack_from("<4d", data, 4)
    nparts, npts = struct.unpack_from("<2i", data, 36)
    off = 44
    need = off + 4 * nparts + 16 * npts
    if nparts <= 0 or npts < 4 or len(data) < need:
        return None
    parts = struct.unpack_from(f"<{nparts}i", data, off)
    off += 4 * nparts
    coords: list[tuple[float, float]] = []
    for _i in range(npts):
        x, y = struct.unpack_from("<2d", data, off)
        off += 16
        coords.append((x, y))
    rings: list[list[tuple[float, float]]] = []
    for i, start in enumerate(parts):
        end = parts[i + 1] if i + 1 < nparts else npts
        ring = coords[start:end]
        if len(ring) >= 4:
            rings.append(ring)
    if not rings:
        return None
    return (xmin, ymin, xmax, ymax), rings


def to_polygons(rings: list[list[tuple[float, float]]]) -> list[Polygon]:
    geoms: list[Polygon] = []
    try:
        poly = Polygon(rings[0], rings[1:] if len(rings) > 1 else None)
    except Exception:
        return []
    if not poly.is_valid:
        poly = poly.buffer(0)
    if poly.is_empty:
        return []
    if isinstance(poly, Polygon):
        geoms = [poly]
    elif isinstance(poly, MultiPolygon):
        geoms = [g for g in poly.geoms if isinstance(g, Polygon)]
    return geoms


def to_float(text: str | None) -> float | None:
    if not text:
        return None
    try:
        n = float(text)
    except ValueError:
        return None
    if n != n:  # NaN
        return None
    return n


def normalize_use(name: str | None, keys: list[str]) -> str | None:
    if not name:
        return None
    cleaned = name.replace(".", "")
    for key in keys:
        if key != "_default" and (cleaned == key or cleaned.startswith(key)):
            return key
    return name


def estimate_height(floors: float, use_name: str | None, height_raw: float | None, cfg: dict) -> tuple[float, str]:
    table: dict = cfg["floorHeightM"]
    fh = table.get(use_name, table["_default"]) if use_name else table["_default"]
    floors = floors if floors and floors > 0 else 1
    h_est = round(fh * floors + cfg["parapetM"], 2)
    raw = height_raw
    if raw is not None and cfg["measuredMinM"] <= raw <= cfg["measuredMaxM"]:
        tol = max(cfg["measuredAbsTolM"], cfg["measuredRelTol"] * h_est)
        if abs(raw - h_est) <= tol:
            return round(raw, 2), "measured"
    return h_est, "estimated"


def ring_wgs(poly: Polygon, to_ll: Transformer) -> list[list[float]]:
    coords = []
    for x, y in poly.exterior.coords:
        lon, lat = to_ll.transform(x, y)
        coords.append([round(lon, 7), round(lat, 7)])
    if coords[0] != coords[-1]:
        coords.append(coords[0])
    holes = []
    for interior in poly.interiors:
        hole = []
        for x, y in interior.coords:
            lon, lat = to_ll.transform(x, y)
            hole.append([round(lon, 7), round(lat, 7)])
        if hole[0] != hole[-1]:
            hole.append(hole[0])
        if len(hole) >= 4:
            holes.append(hole)
    return [coords, *holes]


def iter_zip_parts(z: zipfile.ZipFile):
    names = z.namelist()
    shps = sorted(n for n in names if n.lower().endswith(".shp"))
    for shp_name in shps:
        dbf_name = shp_name[:-4] + ".dbf"
        if dbf_name not in names:
            print("skip, no dbf", shp_name)
            continue
        yield shp_name, dbf_name


def in_region(rec: dict[str, str], sigungu: str | None, contains: str | None) -> bool:
    if not sigungu and not contains:
        return True
    code = (rec.get("A23") or "").strip()
    pnu = (rec.get("A2") or "").strip()
    addr = rec.get("A4") or ""
    if sigungu and (code.startswith(sigungu) or pnu.startswith(sigungu)):
        return True
    if contains and contains in addr:
        return True
    return False


def convert(
    zip_path: Path,
    out_path: Path,
    half_m: float,
    sigungu: str | None,
    contains: str | None,
) -> int:
    height_cfg = load_json(ROOT / "config" / "building-height.json")
    spatial = load_json(ROOT / "config" / "spatial.json")
    map_cfg = load_json(ROOT / "config" / "map.json")
    lon0 = map_cfg["initialView"]["lon"]
    lat0 = map_cfg["initialView"]["lat"]
    to_m = Transformer.from_crs("EPSG:4326", "EPSG:5186", always_xy=True)
    to_ll = Transformer.from_crs("EPSG:5186", "EPSG:4326", always_xy=True)
    cx, cy = to_m.transform(lon0, lat0)
    use_bbox = half_m > 0
    minx = miny = maxx = maxy = 0.0
    if use_bbox:
        minx, miny, maxx, maxy = cx - half_m, cy - half_m, cx + half_m, cy + half_m
    use_keys = list(height_cfg["floorHeightM"].keys())

    features: list[dict] = []
    scanned = 0
    kept = 0
    measured = 0

    with zipfile.ZipFile(zip_path) as z:
        for shp_name, dbf_name in iter_zip_parts(z):
            print("part", shp_name)
            shp = z.open(shp_name)
            dbf = z.open(dbf_name)
            shp.read(100)
            dbf_hdr = dbf.read(32)
            nrec, hlen, rlen = struct.unpack_from("<IHH", dbf_hdr, 4)
            fields = parse_dbf_fields(dbf.read(hlen - 32))
            print(" records", nrec, "fields", [f[0] for f in fields])
            for _i in range(nrec):
                rec_hdr = shp.read(8)
                if len(rec_hdr) < 8:
                    break
                _recno, clen = struct.unpack(">2i", rec_hdr)
                data = shp.read(clen * 2)
                dbf_rec = dbf.read(rlen)
                scanned += 1
                rec = read_dbf_record(dbf_rec, fields)
                if rec is None:
                    continue
                if not in_region(rec, sigungu, contains):
                    continue
                parsed = parse_polygon(data)
                if parsed is None:
                    continue
                (_xmin, _ymin, _xmax, _ymax), rings = parsed
                if use_bbox and (
                    _xmax < minx or _xmin > maxx or _ymax < miny or _ymin > maxy
                ):
                    continue
                floors = to_float(rec.get("A26")) or 0
                height_raw = to_float(rec.get("A16"))
                use_name = normalize_use(rec.get("A9"), use_keys)
                height, source = estimate_height(floors, use_name, height_raw, height_cfg)
                if height < spatial["minHeightM"]:
                    continue
                for pi, poly in enumerate(to_polygons(rings)):
                    poly = poly.simplify(0.3, preserve_topology=True)
                    if poly.is_empty or poly.area < spatial["minAreaM2"]:
                        continue
                    coords = ring_wgs(poly, to_ll)
                    if len(coords[0]) < 4:
                        continue
                    ufid = rec.get("A1") or f"b{scanned}"
                    fid = ufid if pi == 0 else f"{ufid}-{pi}"
                    geom = (
                        {"type": "Polygon", "coordinates": coords}
                        if len(coords) >= 1
                        else None
                    )
                    if geom is None:
                        continue
                    features.append(
                        {
                            "type": "Feature",
                            "id": fid,
                            "properties": {
                                "id": fid,
                                "pnu": rec.get("A2") or None,
                                "floors": floors if floors > 0 else 1,
                                "useName": use_name,
                                "height": height,
                                "heightSource": source,
                                "name": rec.get("A4") or None,
                            },
                            "geometry": geom,
                        }
                    )
                    kept += 1
                    if source == "measured":
                        measured += 1
                if scanned % 200000 == 0:
                    print(" scanned", scanned, "kept", kept)
            shp.close()
            dbf.close()

    min_lon = min_lat = 180.0
    max_lon = max_lat = -180.0
    for feat in features:
        for ring in feat["geometry"]["coordinates"]:
            for lon, lat in ring:
                if lon < min_lon:
                    min_lon = lon
                if lat < min_lat:
                    min_lat = lat
                if lon > max_lon:
                    max_lon = lon
                if lat > max_lat:
                    max_lat = lat
    bbox = (
        [round(min_lon, 6), round(min_lat, 6), round(max_lon, 6), round(max_lat, 6)]
        if features
        else []
    )
    fc = {"type": "FeatureCollection", "features": features}
    region = contains or sigungu or "clip"
    meta = {
        "source": "국토교통부 GIS건물통합정보 경기도 AL_D010_41_20260909",
        "synthetic": False,
        "downloadedAt": "2026-09-09",
        "preparedAt": date.today().isoformat(),
        "epsgOriginal": "EPSG:5186",
        "featureCount": kept,
        "heightMeasuredRatio": round(measured / kept, 4) if kept else 0.0,
        "aoiBboxWgs84": bbox,
        "bufferMeters": spatial.get("aoiBufferM", 300),
        "sigungu": sigungu,
        "contains": contains,
        "clipHalfM": half_m if use_bbox else None,
        "warning": f"{region}만 사용. 층수는 대장 지상층수, 높이는 대장 높이가 추정과 맞으면 실측·아니면 층고 추정.",
    }
    meta_path = out_path.with_name("buildings.meta.json")
    staging_dir = ROOT / "data" / "staging"
    staging_dir.mkdir(parents=True, exist_ok=True)
    tmp_geo = staging_dir / f"{out_path.name}.part"
    tmp_meta = staging_dir / f"{meta_path.name}.part"
    tmp_geo.write_text(json.dumps(fc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp_meta.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    os.replace(tmp_geo, out_path)
    os.replace(tmp_meta, meta_path)
    print("scanned", scanned, "kept", kept, "measured", measured)
    print("wrote", out_path, "bytes", out_path.stat().st_size)
    print("wrote", meta_path)
    return 0 if kept else 4


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--zip",
        type=Path,
        default=Path(r"C:\Users\이근민\Downloads\AL_D010_41_20260909.zip"),
    )
    parser.add_argument("--out", type=Path, default=ROOT / "public" / "data" / "buildings.geojson")
    parser.add_argument(
        "--half-m",
        type=float,
        default=0,
        help="지도 중심에서 자를 반경(m). 0이면 행정구 필터만 사용",
    )
    parser.add_argument("--sigungu", default="41281", help="시군구코드. 덕양구=41281")
    parser.add_argument("--contains", default="고양시 덕양구", help="주소 부분일치")
    args = parser.parse_args()
    if not args.zip.exists():
        print("zip not found", args.zip)
        return 1
    return convert(
        args.zip,
        args.out,
        args.half_m,
        args.sigungu or None,
        args.contains or None,
    )


if __name__ == "__main__":
    raise SystemExit(main())
