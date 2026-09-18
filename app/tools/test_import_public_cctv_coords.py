#!/usr/bin/env python3
"""
import_public_cctv_coords.py 회귀 테스트.
배치 위치(적용 시): cpted-sunmap/tools/test_import_public_cctv_coords.py
실행: python tools/test_import_public_cctv_coords.py   (또는 pytest)

원본 엑셀·공공 CSV 없이 픽스처만으로 돌아야 한다.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from import_public_cctv_coords import (  # noqa: E402
    ACCEPT_PURPOSES,
    LARGE_SHIFT_M,
    NEVER_AUTO_APPLY,
    PURPOSES_BY_KIND,
    SOURCE_LOCATION_CONFLICT,
    STRONG_ANOMALY_IDS,
    apply_decisions,
    build_indexes,
    haversine_m,
    match_sites,
    normalize_address,
    pick_candidate,
    strip_admin,
    update_meta,
    year_of,
)


def _pub(no, jibun, purpose="생활방범", cams=1, year=2016, lng=126.83, lat=37.65):
    return {"manageNo": no, "roadAddress": "", "jibunAddress": jibun, "purpose": purpose,
            "cameraCount": cams, "installYear": year, "baseDate": "2026-01-22",
            "lng": lng, "lat": lat}


def _site(sid, place, pos=None, cams=1, year=2016, gu="덕양구", kind="general", status="active"):
    return {"stableId": f"{sid}#r1", "sourceId": sid, "sourceRow": 1, "tableType": kind,
            "gu": gu, "dong": None, "placeText": place, "cameraCount": cams,
            "hasEmergencyBell": None, "installYear": year, "status": status,
            "locationGrade": "matched" if pos else "unmatched", "position": pos,
            "positionBasis": "matchedBuildingCentroid" if pos else None,
            "matchRule": None, "matchedPnu": None, "matchedBuildingId": None, "matchNote": None}


def _run(sites, public, force=False):
    dec, unres = match_sites(sites, build_indexes(public))
    stats = apply_decisions(sites, dec, unres, "hash", force)
    return dec, unres, stats


# ── 정규화 ───────────────────────────────────────────────────────────────────

def test_normalize_strips_admin_and_brackets_keeps_content():
    a = normalize_address("경기도 고양시 덕양구 주교동 557-5 (주교2호 어린이공원,우일시장)")
    b = normalize_address("주교동 557-5 (주교2호 어린이공원,우일시장)(철거)")
    assert a == b and "557-5" in a and "어린이공원" in a


def test_normalize_handles_gyeonggi_without_do():
    """S-5750 유형: '경기' 와 '경기도' 접두사 차이를 흡수해야 한다."""
    assert normalize_address("경기 고양시 덕양구 삼송동 396-10") == \
           normalize_address("경기도 고양시 덕양구 삼송동 396-10")


def test_normalize_keeps_distinct_jibun_distinct():
    assert normalize_address("삼송동 391") != normalize_address("삼송동 391-1")


def test_strip_admin_preserves_brackets():
    assert "(" in strip_admin("경기도 고양시 덕양구 주교동 1 (공원)")


def test_year_of():
    assert year_of("2009-11") == 2009 and year_of("2016.03") == 2016 and year_of("") is None


# ── kind / 목적 필터 ─────────────────────────────────────────────────────────

def test_kind_filter_separates_general_and_plate():
    assert PURPOSES_BY_KIND["general"] == {"생활방범", "다목적"}
    assert PURPOSES_BY_KIND["plate"] == {"차량방범"}
    assert "교통단속" not in ACCEPT_PURPOSES


def test_traffic_enforcement_never_linked():
    """성사동 826 교통단속 레코드가 plate-004 에 연결되면 안 된다."""
    idx = build_indexes([_pub("T1", "성사동 826", purpose="교통단속")])
    assert idx["general"]["exact"] == {} and idx["plate"]["exact"] == {}


def test_plate_site_does_not_match_general_row():
    idx = build_indexes([_pub("G1", "고양동 1074", purpose="생활방범")])
    dec, unres, _ = _run([_site("X", "고양동 1074", kind="plate")], [])
    assert dec == []
    dec2, unres2 = match_sites([_site("X", "고양동 1074", kind="plate")], idx)
    assert dec2 == [] and unres2[0]["reason"] == "no-candidate"


def test_rows_without_valid_coords_excluded():
    bad = _pub("X1", "주교동 1")
    bad["lat"] = None
    assert build_indexes([bad])["general"]["exact"] == {}


# ── 후보 선택 ────────────────────────────────────────────────────────────────

def test_count_year_narrowing_runs_before_identical_coords():
    """관리번호 출처를 정확히 하려면 대수·연도 분리가 먼저다."""
    cands = [_pub("A", "삼송동 391", cams=5, year=2016),
             _pub("B", "삼송동 391", cams=3, year=2016)]
    chosen, reason, ids = pick_candidate({"cameraCount": 3, "installYear": 2016}, cands)
    assert chosen["manageNo"] == "B" and reason == "count-year-unique"
    assert ids == ["A", "B"], "후보 목록은 보존되어야 한다"


def test_identical_coords_fallback_keeps_candidate_ids():
    cands = [_pub("A", "지축동 1", cams=1), _pub("B", "지축동 1", cams=1)]
    chosen, reason, ids = pick_candidate({"cameraCount": None, "installYear": None}, cands)
    assert reason == "identical-coords" and ids == ["A", "B"]


def test_duplicate_with_different_coords_and_same_attrs_is_unresolved():
    """S-5214/5215, B-5L03/04 유형: 행 순서로 배정하지 않는다."""
    idx = build_indexes([_pub("800102", "신원동 678", cams=4, lng=126.90, lat=37.70),
                         _pub("800103", "신원동 678", cams=4, lng=126.91, lat=37.71)])
    dec, unres = match_sites([_site("S-5214", "신원동 678", cams=4)], idx)
    assert dec == [] and unres[0]["reason"] == "ambiguous-duplicate"
    assert unres[0]["candidateIds"] == ["800102", "800103"]


def test_no_candidate_is_unresolved_not_invented():
    dec, unres, _ = _run([_site("S-Y", "없는동 999")], [])
    assert dec == [] and unres[0]["reason"] == "no-candidate"


# ── 적용 / 보류 ──────────────────────────────────────────────────────────────

def test_other_gu_records_get_no_new_keys():
    other = _site("S-Z", "주교동 1", gu="일산동구")
    keys_before = set(other)
    _run([other], [_pub("B1", "주교동 1")])
    assert set(other) == keys_before, "타 구 레코드에 키가 추가되면 안 된다"


def test_never_auto_apply_set():
    assert NEVER_AUTO_APPLY == {"strong-anomaly", "attribute-mismatch",
                                "source-location-conflict"}
    assert "S-5H04" in STRONG_ANOMALY_IDS
    assert len(SOURCE_LOCATION_CONFLICT) == 7


def test_strong_anomaly_blocked_even_with_force():
    sites = [_site("S-5K05", "향동동 130-12", pos=[126.83, 37.65])]
    dec, _, stats = _run(sites, [_pub("D1", "향동동 130-12", lng=127.05, lat=37.75)], force=True)
    assert dec[0]["reviewFlag"] == "strong-anomaly"
    assert stats["applied"] == 0 and sites[0]["position"] == [126.83, 37.65]
    assert sites[0]["publicRef"]["manageNo"] == "D1"  # 근거는 남긴다
    assert sites[0]["reviewEvidence"]


def test_source_location_conflict_blocked_even_without_previous_position():
    """종전 좌표가 null 이어도 보류해야 한다."""
    sites = [_site("S-5K11", "향동동 1", pos=None)]
    dec, _, stats = _run(sites, [_pub("E1", "향동동 1")], force=True)
    assert dec[0]["reviewFlag"] == "source-location-conflict"
    assert stats["applied"] == 0 and sites[0]["position"] is None
    assert sites[0]["reviewEvidence"] == SOURCE_LOCATION_CONFLICT["S-5K11"]


def test_large_shift_held_by_default_applied_when_opted_in():
    far = _pub("F1", "주교동 3", lng=126.8400, lat=37.6600)
    base = [126.83, 37.65]
    assert haversine_m(tuple(base), (126.84, 37.66)) > LARGE_SHIFT_M

    s1 = [_site("S-LS", "주교동 3", pos=base)]
    _, _, st1 = _run(s1, [far])
    assert st1["applied"] == 0 and s1[0]["position"] == base

    s2 = [_site("S-LS", "주교동 3", pos=base)]
    _, _, st2 = _run(s2, [far], force=True)
    assert st2["applied"] == 1 and s2[0]["positionBasis"] == "publicDatasetCoordinate"


def test_held_site_reverts_previously_applied_public_coordinate():
    """★ 이전 실행에서 적용된 좌표가 보류 전환 후에도 남으면 안 된다."""
    far = _pub("G1", "주교동 3", lng=126.8400, lat=37.6600)
    base = [126.83, 37.65]
    sites = [_site("S-LS", "주교동 3", pos=base)]
    _run(sites, [far], force=True)
    assert sites[0]["positionBasis"] == "publicDatasetCoordinate"

    _run(sites, [far], force=False)  # 강제 옵션 없이 재실행 → 보류로 전환
    assert sites[0]["position"] == base, "종전 기준점으로 되돌아야 한다"
    assert sites[0]["positionBasis"] == "matchedBuildingCentroid"
    assert sites[0]["locationGrade"] == "matched"


def test_unresolved_clears_stale_public_ref_and_position():
    far = _pub("H1", "주교동 9", lng=126.8301, lat=37.6501)
    base = [126.83, 37.65]
    sites = [_site("S-U", "주교동 9", pos=base)]
    _run(sites, [far])
    assert sites[0]["positionBasis"] == "publicDatasetCoordinate"

    _run(sites, [])  # 후보가 사라진 상황
    assert sites[0]["publicRef"] is None and sites[0]["reviewDistanceM"] is None
    assert sites[0]["position"] == base
    assert sites[0]["reviewFlag"] == "unresolved-no-candidate"


def test_applied_site_preserves_pnu_position_and_provenance():
    sites = [_site("S-OK", "주교동 4", pos=[126.83, 37.65])]
    _run(sites, [_pub("I1", "주교동 4", lng=126.8301, lat=37.6501)])
    s = sites[0]
    assert s["positionBasis"] == "publicDatasetCoordinate"
    assert s["pnuPosition"] == [126.83, 37.65]
    assert s["publicRef"]["fileSha256"] == "hash"
    assert s["matchRule"].startswith("public-standard-dataset:")


def test_unmatched_site_never_gets_a_position():
    sites = [_site("S-NP", "없는동 1")]
    _run(sites, [], force=True)
    assert sites[0]["position"] is None and sites[0]["publicRef"] is None


def test_rerun_is_stable():
    """재실행해도 pnuPosition·position·reviewFlag 가 흔들리지 않는다."""
    pub = [_pub("J1", "주교동 5", lng=126.8301, lat=37.6501)]
    sites = [_site("S-R", "주교동 5", pos=[126.83, 37.65])]
    _run(sites, pub)
    snap = json.dumps(sites, ensure_ascii=False, sort_keys=True)
    _run(sites, pub)
    assert json.dumps(sites, ensure_ascii=False, sort_keys=True) == snap


def test_record_count_preserved():
    sites = [_site(f"S-{i}", f"주교동 {i}") for i in range(10)]
    _run(sites, [])
    assert len(sites) == 10


# ── 메타 ─────────────────────────────────────────────────────────────────────

def test_meta_preserves_legacy_pnu_match_and_refreshes_counts():
    legacy = {"simpleParseCandidates": 437, "matched": 424, "unmatched": 495,
              "unmatchedReasons": {}, "note": "old"}
    meta = {"match": dict(legacy)}
    sites = [_site("S-A", "주교동 6", pos=[126.83, 37.65]), _site("S-B", "없는동 1")]
    dec, unres, stats = _run(sites, [_pub("K1", "주교동 6", lng=126.8301, lat=37.6501)])
    out = update_meta(meta, sites, dec, unres, stats, Path("f.csv"), "h", 10)

    assert out["legacyPnuMatch"]["matched"] == 424, "원래 PNU 집계는 보존"
    assert out["match"]["matched"] == 1 and out["match"]["unmatched"] == 1, "현재 실태로 갱신"
    assert out["positionSources"]["publicDatasetCoordinate"] == 1
    assert "현장 대조로 검증하지 않았습니다" in out["warning"]
    assert "어느 쪽도 실측 설치 지점이 아니" not in out["warning"]


if __name__ == "__main__":
    failed = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"  PASS {name}")
            except AssertionError as e:
                failed += 1
                print(f"  FAIL {name}: {e}")
    print(f"\n{'FAILED ' + str(failed) if failed else 'ALL PASSED'}")
    sys.exit(1 if failed else 0)
