#!/usr/bin/env python3
"""
빛길(BITGIL) — 공공 CCTV 표준데이터 좌표 연결 importer (v2).

배치 위치(적용 시): cpted-sunmap/tools/import_public_cctv_coords.py
v1 대비: kind 필터 선행, 2단계 매칭(원문→정규화), 대수·연도 유일분리,
타 구 완전 불변, 미해결 사유 레코드 기록, meta 갱신, 보류 사유 확장.

설계 원칙
- 원본 1800행을 잃지 않는다. **대상 구(덕양구) 외 레코드는 키 하나도 추가하지 않는다.**
- 후보 선택은 (1) kind 필터 → (2) 원문 전체 일치 → (3) 느슨한 정규화 →
  (4) 카메라 대수·설치연도 유일 분리 순서로만. **행 순서로 배정하지 않는다.**
- 거리 판정 기준은 항상 pnuPosition → 재실행해도 판정이 흔들리지 않는다.
- 보류 지정 건은 --apply-large-shift 로도 승인되지 않는다.
- 공공 좌표라도 실측 정확성이 검증된 것은 아니다.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

SOURCE_NAME = "전국 CCTV 표준데이터 (행정안전부 / 지자체 제공)"
CATALOG_URL = "https://www.data.go.kr/data/15013094/standard.do"
DOWNLOAD_URL = "https://file.localdata.go.kr/file/cctv_info/info"
TARGET_GU = "덕양구"

# 원본 표 종류 → 공공 '설치목적구분'. kind 필터를 가장 먼저 적용한다.
# 교통단속은 이번 원본과 다른 유형이므로 어느 쪽에도 넣지 않는다.
PURPOSES_BY_KIND: dict[str, set[str]] = {
    "general": {"생활방범", "다목적"},
    "plate": {"차량방범"},
}
ACCEPT_PURPOSES = set().union(*PURPOSES_BY_KIND.values())

LARGE_SHIFT_M = 500.0

# 종전 기준점과 극단적 차이. --apply-large-shift 로도 승인되지 않는다.
STRONG_ANOMALY_IDS = {"S-5K05", "S-5B05", "S-5111", "S-5403", "S-5H04"}

# 종전 좌표가 없어도 법정동 건물군과 동떨어져 추가 검토가 필요한 건.
# 값은 근거 문구. 오좌표 확정이 아니라 '검토 필요' 표시다.
SOURCE_LOCATION_CONFLICT: dict[str, str] = {
    "S-5K11": "향동 법정동 건물군에서 약 14.2km 떨어짐 — 추가 검토 필요",
    "S-5K09": "향동 법정동 건물군에서 약 8.3km 떨어짐 — 추가 검토 필요",
    "S-5137": "주교 법정동 건물군에서 약 4.8km 떨어짐 — 추가 검토 필요",
    "S-5104": "주교 법정동 건물군에서 약 1.45km 떨어짐 — 추가 검토 필요",
    "S-5735": "삼송 법정동 건물군에서 약 1.37km 떨어짐 — 추가 검토 필요",
    "SP-5806": "용두 법정동 건물군에서 약 765m 떨어짐 — 추가 검토 필요",
    "S-5723": "원본 주소의 토당로와 오금동 표기가 상충(공공좌표는 능곡지역) — 추가 검토 필요",
}

# 주소 표기 차이가 확인되어 연결 자체를 확정하지 않고 미해결로 남기는 건.
MANUAL_UNRESOLVED: dict[str, str] = {
    "plate-004": "공공 후보 800004 주소가 화정동 188-63 로 원본 성사동 826 과 불일치",
    "plate-005": "공공 후보 800005 주소에 양주시 장흥면 북한산로 778-6 이 부가됨",
}

# 자동 적용을 절대 허용하지 않는 사유 (강제 옵션으로도 승인 불가)
NEVER_AUTO_APPLY = {"strong-anomaly", "attribute-mismatch", "source-location-conflict"}

_ADMIN_PREFIX = re.compile(r"(경기도|경기|고양시|덕양구|일산동구|일산서구)")
_REMOVED_MARK = re.compile(r"철거\s*(예정)?")
_BRACKET_SYM = re.compile(r"[()\[\]{}<>·ㆍ,'\"`~!?*/\\|]")
_WS = re.compile(r"\s+")


def strip_ws(raw) -> str:
    return _WS.sub("", unicodedata.normalize("NFKC", str(raw))).strip() if raw else ""


def strip_admin(raw) -> str:
    """행정구 접두사만 제거. 원문 전체 일치 비교용(괄호·설명 보존)."""
    return _ADMIN_PREFIX.sub("", strip_ws(raw))


def normalize_address(raw) -> str:
    """접두사·띄어쓰기·괄호기호·철거표기 정리. 설명 내용과 숫자-하이픈은 보존."""
    if not raw:
        return ""
    s = unicodedata.normalize("NFKC", str(raw))
    s = _REMOVED_MARK.sub("", s)
    s = _ADMIN_PREFIX.sub("", s)
    s = _BRACKET_SYM.sub("", s)
    return _WS.sub("", s).strip("-")


def haversine_m(a, b) -> float:
    r = 6371008.8
    lon1, lat1 = math.radians(a[0]), math.radians(a[1])
    lon2, lat2 = math.radians(b[0]), math.radians(b[1])
    h = (math.sin((lat2 - lat1) / 2) ** 2
         + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2)
    return 2 * r * math.asin(math.sqrt(h))


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def to_int(v):
    try:
        return int(str(v).strip().split(".")[0])
    except (ValueError, AttributeError):
        return None


def year_of(v):
    if not v:
        return None
    m = re.search(r"(19|20)\d{2}", str(v))
    return int(m.group(0)) if m else None


def load_public_rows(csv_path: Path) -> list[dict]:
    rows: list[dict] = []
    for enc in ("cp949", "utf-8-sig", "utf-8"):
        try:
            with csv_path.open(encoding=enc, newline="") as f:
                rows = list(csv.DictReader(f))
            break
        except UnicodeDecodeError:
            rows = []
    if not rows:
        sys.exit(f"[오류] 공공 CSV를 읽지 못했습니다: {csv_path}")

    out = []
    for r in rows:
        try:
            lat_f, lng_f = float(r.get("WGS84위도")), float(r.get("WGS84경도"))
        except (TypeError, ValueError):
            lat_f = lng_f = None
        # 국내 범위 밖 좌표는 채택하지 않는다 (가짜 좌표 유입 차단)
        if lat_f is None or not (33 <= lat_f <= 39) or not (124 <= lng_f <= 132):
            lat_f = lng_f = None
        out.append({
            "manageNo": (r.get("관리번호") or "").strip(),
            "roadAddress": (r.get("소재지도로명주소") or "").strip(),
            "jibunAddress": (r.get("소재지지번주소") or "").strip(),
            "purpose": (r.get("설치목적구분") or "").strip(),
            "cameraCount": to_int(r.get("카메라대수")),
            "installYear": year_of(r.get("설치연월")),
            "baseDate": (r.get("데이터기준일자") or "").strip(),
            "lng": lng_f, "lat": lat_f,
        })
    return out


def build_indexes(public_rows):
    """kind → tier('exact'|'normalized') → key → 공공행 목록."""
    idx = {k: {"exact": defaultdict(list), "normalized": defaultdict(list)}
           for k in PURPOSES_BY_KIND}
    for p in public_rows:
        if p["lat"] is None:
            continue
        for kind, purposes in PURPOSES_BY_KIND.items():
            if p["purpose"] not in purposes:
                continue
            for addr in (p["jibunAddress"], p["roadAddress"]):
                if not addr:
                    continue
                for tier, key in (("exact", strip_admin(addr)),
                                  ("normalized", normalize_address(addr))):
                    if key and p not in idx[kind][tier][key]:
                        idx[kind][tier][key].append(p)
    return idx


def pick_candidate(site, cands):
    """후보 확정. 행 순서로 고르지 않는다. (선택, 근거, 후보ID목록)"""
    ids = [c["manageNo"] for c in cands]
    if not cands:
        return None, "no-candidate", ids
    if len(cands) == 1:
        return cands[0], "unique", ids
    # 관리번호 출처를 정확히 하기 위해 대수·연도 분리를 먼저 시도한다.
    sc, sy = site.get("cameraCount"), site.get("installYear")
    if sc is not None and sy is not None:
        narrowed = [c for c in cands if c["cameraCount"] == sc and c["installYear"] == sy]
        if len(narrowed) == 1:
            return narrowed[0], "count-year-unique", ids
    # 그래도 남으면, 좌표가 완전히 같은 경우에 한해 어느 쪽을 골라도 결과가 같다.
    if len({(round(c["lng"], 7), round(c["lat"], 7)) for c in cands}) == 1:
        return cands[0], "identical-coords", ids
    return None, "ambiguous-duplicate", ids


def match_sites(sites, idx):
    decisions, unresolved = [], []
    for s in sites:
        if s.get("gu") != TARGET_GU:
            continue

        if s["sourceId"] in MANUAL_UNRESOLVED:
            unresolved.append({
                "stableId": s["stableId"], "sourceId": s["sourceId"],
                "placeText": s.get("placeText"), "candidateCount": 0, "candidateIds": [],
                "reason": "manual-address-mismatch",
                "evidence": MANUAL_UNRESOLVED[s["sourceId"]],
            })
            continue

        tables = idx.get(s.get("tableType") or "general", {"exact": {}, "normalized": {}})
        chosen, reason, ids, tier_used = None, "", [], ""
        for tier, key in (("exact", strip_admin(s.get("placeText"))),
                          ("normalized", normalize_address(s.get("placeText")))):
            cands = tables[tier].get(key, [])
            if not cands:
                continue
            chosen, reason, ids = pick_candidate(s, cands)
            tier_used = tier
            break  # 같은 단계에서 모호하면 다음 단계로 내려가 흔들지 않는다

        if not chosen:
            unresolved.append({
                "stableId": s["stableId"], "sourceId": s["sourceId"],
                "placeText": s.get("placeText"), "candidateCount": len(ids),
                "candidateIds": ids, "reason": reason or "no-candidate", "evidence": None,
            })
            continue

        p = chosen
        count_ok = (s.get("cameraCount") is None or p["cameraCount"] is None
                    or s["cameraCount"] == p["cameraCount"])
        year_ok = (s.get("installYear") is None or p["installYear"] is None
                   or s["installYear"] == p["installYear"])

        ref = s.get("pnuPosition") or (
            s.get("position") if s.get("positionBasis") == "matchedBuildingCentroid" else None)
        dist = haversine_m(tuple(ref), (p["lng"], p["lat"])) if ref else None

        evidence = None
        if s["sourceId"] in STRONG_ANOMALY_IDS:
            flag = "strong-anomaly"
            evidence = (f"종전 건물 기준점과 약 {dist:,.0f}m 차이" if dist is not None
                        else "독립 검수에서 위치 상충 확인")
        elif s["sourceId"] in SOURCE_LOCATION_CONFLICT:
            flag = "source-location-conflict"
            evidence = SOURCE_LOCATION_CONFLICT[s["sourceId"]]
        elif not count_ok or not year_ok:
            flag = "attribute-mismatch"
            evidence = (f"원본 {s.get('cameraCount')}대/{s.get('installYear')} vs "
                        f"공공 {p['cameraCount']}대/{p['installYear']}")
        elif dist is not None and dist > LARGE_SHIFT_M:
            flag = "large-shift"
            evidence = f"종전 건물 기준점과 약 {dist:,.0f}m 차이 (기준 {LARGE_SHIFT_M:.0f}m)"
        else:
            flag = None

        decisions.append({
            "stableId": s["stableId"], "sourceId": s["sourceId"], "publicId": p["manageNo"],
            "matchTier": tier_used, "pickReason": reason, "placeText": s.get("placeText"),
            "publicAddress": p["jibunAddress"] or p["roadAddress"],
            "position": [p["lng"], p["lat"]], "referencePosition": ref,
            "distanceM": round(dist, 1) if dist is not None else None,
            "sourceCameras": s.get("cameraCount"), "publicCameras": p["cameraCount"],
            "sourceYear": s.get("installYear"), "publicYear": p["installYear"],
            "countMatches": count_ok, "yearMatches": year_ok, "baseDate": p["baseDate"],
            "removed": s.get("status") == "removed", "candidateIds": ids,
            "reviewFlag": flag, "reviewEvidence": evidence,
        })
    return decisions, unresolved


def _revert_to_reference(s) -> None:
    """공공좌표를 적용하지 않기로 한 건은 종전 기준점 상태로 되돌린다.
    이전 실행에서 적용된 좌표가 남아 잘못된 위치가 유지되는 것을 막는다."""
    ref = s.get("pnuPosition")
    s["position"] = list(ref) if ref else None
    s["positionBasis"] = "matchedBuildingCentroid" if ref else None
    s["locationGrade"] = "matched" if ref else "unmatched"


def apply_decisions(sites, decisions, unresolved, file_hash, apply_large_shift):
    """대상 구 레코드만 갱신. 타 구 객체는 키 하나도 건드리지 않는다."""
    by_id = {d["stableId"]: d for d in decisions}
    unres_by_id = {u["stableId"]: u for u in unresolved}
    applied = held = 0

    for s in sites:
        if s.get("gu") != TARGET_GU:
            continue  # ★ 타 구 완전 불변

        if "pnuPosition" not in s:
            s["pnuPosition"] = (s.get("position")
                                if s.get("positionBasis") == "matchedBuildingCentroid" else None)
        for k in ("publicRef", "reviewFlag", "reviewDistanceM",
                  "reviewCandidateIds", "reviewEvidence"):
            s.setdefault(k, None)

        u = unres_by_id.get(s["stableId"])
        if u:
            s["reviewFlag"] = ("unresolved-ambiguous" if u["reason"] == "ambiguous-duplicate"
                               else "unresolved-no-candidate")
            s["reviewCandidateIds"] = u["candidateIds"] or None
            s["reviewEvidence"] = u.get("evidence") or (
                f"후보 {u['candidateCount']}건 — 행 순서로 배정하지 않음"
                if u["candidateCount"] else "주소 일치 후보 없음")
            s["publicRef"] = None           # 미해결은 공공행 근거가 없다
            s["reviewDistanceM"] = None
            _revert_to_reference(s)
            continue

        d = by_id.get(s["stableId"])
        if not d:
            continue

        s["reviewFlag"] = d["reviewFlag"]
        s["reviewDistanceM"] = d["distanceM"]
        s["reviewEvidence"] = d["reviewEvidence"]
        s["reviewCandidateIds"] = d["candidateIds"] if len(d["candidateIds"]) > 1 else None
        s["publicRef"] = {
            "manageNo": d["publicId"], "address": d["publicAddress"], "baseDate": d["baseDate"],
            "source": SOURCE_NAME, "catalogUrl": CATALOG_URL, "fileSha256": file_hash,
            "matchTier": d["matchTier"],
        }

        blocked = (d["reviewFlag"] in NEVER_AUTO_APPLY
                   or (d["reviewFlag"] == "large-shift" and not apply_large_shift))
        if blocked:
            held += 1
            _revert_to_reference(s)   # 이전 실행의 적용분이 남지 않게 되돌린다
            continue

        s["position"] = d["position"]
        s["positionBasis"] = "publicDatasetCoordinate"
        s["locationGrade"] = "matched"
        s["matchRule"] = f"public-standard-dataset:{d['matchTier']}:{d['pickReason']}"
        applied += 1

    return {"applied": applied, "heldForReview": held}


def update_meta(meta, sites, decisions, unresolved, stats, public_path, file_hash, public_rows):
    deog = [s for s in sites if s.get("gu") == TARGET_GU]
    meta["positionSources"] = {
        "publicDatasetCoordinate": sum(1 for s in deog
                                       if s.get("positionBasis") == "publicDatasetCoordinate"),
        "matchedBuildingCentroid": sum(1 for s in deog
                                       if s.get("positionBasis") == "matchedBuildingCentroid"
                                       and s.get("position")),
        "none": sum(1 for s in deog if not s.get("position")),
        "needsReview": sum(1 for s in deog if s.get("reviewFlag")),
    }
    meta["hasCoordinates"] = meta["positionSources"]["publicDatasetCoordinate"] > 0

    # 공공좌표 연결 이전의 PNU 지번 매칭 집계는 보존하고, match 는 현재 좌표 보유 실태로 갱신한다.
    if "match" in meta and "legacyPnuMatch" not in meta:
        meta["legacyPnuMatch"] = {**meta["match"],
                                  "note": "공공좌표 연결 이전 PNU 지번 매칭 집계(보존용)"}
    reasons = Counter(s["reviewFlag"] for s in deog
                      if not s.get("position") and s.get("reviewFlag"))
    meta["match"] = {
        "simpleParseCandidates": meta.get("legacyPnuMatch", {}).get("simpleParseCandidates", 0),
        "matched": sum(1 for s in deog if s.get("position")),
        "unmatched": sum(1 for s in deog if not s.get("position")),
        "unmatchedReasons": dict(reasons),
        "note": "현재 좌표 보유 실태. 출처별 내역은 positionSources 를 본다.",
    }
    meta["publicSource"] = {
        "name": SOURCE_NAME, "catalogUrl": CATALOG_URL, "downloadUrl": DOWNLOAD_URL,
        "file": public_path.name, "fileSha256": file_hash, "publicRows": public_rows,
        "acceptPurposes": sorted(ACCEPT_PURPOSES), "linked": len(decisions),
        "applied": stats["applied"], "heldForReview": stats["heldForReview"],
        "unresolved": len(unresolved),
        "byTier": dict(Counter(d["matchTier"] for d in decisions)),
        "pickReasons": dict(Counter(d["pickReason"] for d in decisions)),
        "reviewCounts": dict(Counter(s["reviewFlag"] for s in deog if s.get("reviewFlag"))),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "note": "공공 제공 좌표이며 현장 대조를 하지 않았다. 실측 정확성이 검증된 것은 아니다.",
    }
    meta["warning"] = (
        "좌표 출처가 섞여 있습니다. 공공 표준데이터 제공 좌표와 PNU 건물 기준점(참고)을 "
        "화면에서 구분해 확인하십시오. 공공 좌표도 현장 대조로 검증하지 않았습니다. "
        "설치높이·방향·화각 정보는 원천에 없습니다."
    )
    return meta


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sites", required=True, type=Path)
    ap.add_argument("--meta", type=Path)
    ap.add_argument("--public", required=True, type=Path)
    ap.add_argument("--out-dir", required=True, type=Path)
    ap.add_argument("--audit", type=Path)
    ap.add_argument("--apply-large-shift", action="store_true",
                    help="500m 초과 건 적용. 보류 지정 건은 이 옵션으로도 승인되지 않는다.")
    args = ap.parse_args()

    sites = json.loads(args.sites.read_text(encoding="utf-8"))
    before = len(sites)
    other_before = json.dumps([s for s in sites if s.get("gu") != TARGET_GU],
                              ensure_ascii=False, sort_keys=True)

    public_rows = load_public_rows(args.public)
    file_hash = sha256_of(args.public)
    decisions, unresolved = match_sites(sites, build_indexes(public_rows))
    stats = apply_decisions(sites, decisions, unresolved, file_hash, args.apply_large_shift)

    assert len(sites) == before, "레코드 수가 변했습니다 — 원본 손실"
    assert other_before == json.dumps([s for s in sites if s.get("gu") != TARGET_GU],
                                      ensure_ascii=False, sort_keys=True), \
        "타 구 레코드가 변경되었습니다"

    args.out_dir.mkdir(parents=True, exist_ok=True)
    (args.out_dir / "cctv_sites.json").write_text(
        json.dumps(sites, ensure_ascii=False, indent=1), encoding="utf-8")

    review = {
        "strongAnomaly": [d for d in decisions if d["reviewFlag"] == "strong-anomaly"],
        "sourceLocationConflict": [d for d in decisions
                                   if d["reviewFlag"] == "source-location-conflict"],
        "largeShift": [d for d in decisions if d["reviewFlag"] == "large-shift"],
        "attributeMismatch": [d for d in decisions if d["reviewFlag"] == "attribute-mismatch"],
        "unresolved": unresolved,
    }
    (args.out_dir / "review-queue.json").write_text(
        json.dumps(review, ensure_ascii=False, indent=1), encoding="utf-8")

    meta = json.loads(args.meta.read_text(encoding="utf-8")) if args.meta and args.meta.exists() else {}
    meta = update_meta(meta, sites, decisions, unresolved, stats,
                       args.public, file_hash, len(public_rows))
    (args.out_dir / "cctv_sites.meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    summary = {
        "generatedAt": meta["publicSource"]["generatedAt"], "sitesTotal": before,
        "deogyangSites": len([s for s in sites if s.get("gu") == TARGET_GU]),
        "linked": len(decisions), "applied": stats["applied"],
        "heldForReview": stats["heldForReview"], "unresolved": len(unresolved),
        "byTier": meta["publicSource"]["byTier"],
        "pickReasons": meta["publicSource"]["pickReasons"],
        "reviewCounts": {k: len(v) for k, v in review.items()},
        "positionSources": meta["positionSources"], "publicFileSha256": file_hash,
    }
    if args.audit and args.audit.exists():
        a = json.loads(args.audit.read_text(encoding="utf-8"))
        mine = {d["stableId"]: d["publicId"] for d in decisions}
        theirs = {m["stableId"]: m["publicId"] for m in a.get("matches", [])}
        summary["auditCrossCheck"] = {
            "auditMatched": len(theirs), "importerMatched": len(mine),
            "agree": sum(1 for k, v in mine.items() if theirs.get(k) == v),
            "onlyInImporter": sorted(set(mine) - set(theirs))[:20],
            "onlyInAudit": sorted(set(theirs) - set(mine))[:20],
            "differentPublicId": sorted(k for k in set(mine) & set(theirs)
                                        if mine[k] != theirs[k])[:20],
        }
    (args.out_dir / "import-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
