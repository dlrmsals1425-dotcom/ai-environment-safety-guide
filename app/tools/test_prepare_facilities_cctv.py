"""지번 추출 회귀. 행정동 fallback·설명 숫자·도로명/정류소번호를 지번으로 쓰지 않는다."""

from prepare_facilities_cctv import extract_jibun


def expect(place, dong=None, bun=None, ho=0, san=False, reason=None):
    parsed, why = extract_jibun(place, "고양동")
    if reason:
        assert parsed is None and why == reason, (place, parsed, why)
        return
    assert parsed is not None, (place, why)
    assert parsed["dong"] == dong and parsed["bun"] == bun and parsed["ho"] == ho
    assert parsed["san"] is san


def main() -> None:
    expect("덕양구 고골길 238 고골인근", reason="road-address")
    expect("DMC해링턴플레이스_정류소번호 19-163", reason="road-address")
    expect("지축동765-159", dong="지축동", bun=765, ho=159)
    expect("지축동 766-131 숲속반디어린이집", dong="지축동", bun=766, ho=131)
    expect("삼송동 288-216", dong="삼송동", bun=288, ho=216)
    expect("주교동 551-18 임창타운 5동 옆 삼거리(철거)", dong="주교동", bun=551, ho=18)
    expect("덕양구 주교동 570-5 - 주교7호 어린이공원 주변", dong="주교동", bun=570, ho=5)
    expect("화정동 148-35 성라공원 피크닉장1", dong="화정동", bun=148, ho=35)
    expect("주교동 581 (원당초교 옆 놀이터 주변, 금강,백양)", dong="주교동", bun=581, ho=0)
    expect("주교동 630 578-2 복권방 앞 삼거리", reason="ambiguous-jibun")
    expect("주교동 561-562 (우인아파트 뒤편도로)", dong="주교동", bun=561, ho=562)
    print("ok")


if __name__ == "__main__":
    main()
