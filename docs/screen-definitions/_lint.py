#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
화면 정의서(v6 · 기획 관점) 규칙 린터 — 규칙의 단일 출처(SSOT).

검사 대상: docs/screen-definitions/SCR-*.md
사용법:
  python3 _lint.py [파일.md ...]     # 인자 없으면 SCR-*.md 전체
종료코드: 위반 있으면 1, 없으면 0.

규칙(요약):
  - 7섹션 구조(순서 고정)
  - 코드 수준 내용 금지(함수·DOM·CSS·수식·내부 데이터·라인참조·보안/코드품질)
  - [확인필요]는 §7 미결사항에만(본문 산재 금지)
  - §7 미결사항이 있으면 '기한' 컬럼 + 항목 행 존재, 없으면 '없음' 명시
"""
import os, re, sys, glob

HERE = os.path.dirname(os.path.abspath(__file__))

REQUIRED_SECTIONS = [
    "## 1. 화면 정보",
    "## 2. 권한 정보",
    "## 3. 진입 / 이탈 경로 및 사용자 시나리오",
    "## 4. 화면 구성별 정리",
    "## 5. 유효성 검사",
    "## 6. 정책",
    "## 7. 미결사항",
]

# 코드 수준 토큰(기획 문서 금지) — (정규식, 설명)
FORBIDDEN = [
    (r'\b(?:PG|EDOC|EDOC_T|DYV2|DYLAYOUT|DYSETLIST|E|V)\.[a-zA-Z_]\w*\s*\(', '코드 함수/메서드 호출'),
    (r'\b(?:renderBody|renderSidebar|onnaraPopup|addImprovement|statusOf|openForm|complianceRate|byMenu|statusChip|openModal|renderInline)\s*\(', '내부 함수명'),
    (r'__[a-z]+[A-Z]\w*', '내부 전역 변수(__camelCase)'),
    (r'\b(?:DY_DOCS|DY_SETS|DY_DOC_SET|MENU_ORDER|MENU_ORDER_V2|DY_MENUS_V2|CHECKLIST_PRESETS|PDCA_ORDER|MENU_KEYS|fileRows|POSTINGS|LAWS|CONSIDER|GUIDE|APPR)\b', '내부 데이터 구조명'),
    (r'#[a-z][a-z0-9]*-[a-z0-9-]+', 'DOM 요소 ID(#xxx-yyy)'),
    (r'\b(?:localStorage|sessionStorage)\b', '스토리지 API'),
    (r'\bdy-(?:edoc|ntf|screendef)[a-z0-9-]*', '스토리지/내부 키(dy-...)'),
    (r'\b(?:chip-mini|col-action|sl-[a-z][a-z-]+|v2-empty|v2-todo|st-(?:done|doing|todo)|upload-drop|sl-valbanner)\b', 'CSS 클래스명'),
    (r'===|!==|\|\||&&', '코드 비교/논리 연산자'),
    (r'\.(?:indexOf|filter|map|replace|split|slice|push|forEach|toLowerCase)\s*\(', '코드 메서드 체이닝'),
    (r'%\s*\d{3,}|×\s*\d{2,}|\bMath\.\w+', '코드 수식'),
    (r'\b\w+\.js\s+L\d+|(?<![A-Za-z])L\d{2,}\b', '소스 파일:라인 참조'),
    (r'\bscrollIntoView\b|display\s*:\s*none|\breadonly\b|\bdata-(?:pane|scope|mk|v)\b', 'DOM/속성 디테일'),
    (r'XSS|런타임 에러|데드코드|\bstale\b|try-catch|이스케이프', '보안/코드품질 분석'),
]


def check(content):
    """본문(str) → 위반 목록 [(code, message), ...]"""
    viols = []
    lines = content.split('\n')

    # R1/R2 구조: 7섹션 존재 + 순서
    last = -1
    for sec in REQUIRED_SECTIONS:
        pos = content.find(sec)
        if pos < 0:
            viols.append(("STRUCT", "필수 섹션 누락: %s" % sec))
        elif pos < last:
            viols.append(("ORDER", "섹션 순서 오류: %s" % sec))
        else:
            last = pos

    # R3 코드 수준 토큰
    for i, line in enumerate(lines):
        for pat, desc in FORBIDDEN:
            m = re.search(pat, line)
            if m:
                viols.append(("CODE", "L%d %s: '%s' — 코드 수준 내용은 기획 문서에서 제외" % (i + 1, desc, m.group(0).strip())))

    # R4/R5 §7 미결사항
    sec7 = content.find("## 7. 미결사항")
    if sec7 >= 0:
        body7 = content[sec7:]
        no_open_item = bool(re.search(r'(?:미결사항\s*)?없음\s*[.。]?', body7[:500]))
        if not no_open_item:
            if '기한' not in body7:
                viols.append(("MIGYEOL", "§7 미결사항 표에 '기한' 컬럼이 없음"))
            if not re.search(r'\|\s*[A-Z]{2,}-\d+\s*\|', body7):
                viols.append(("MIGYEOL", "§7 미결사항에 항목 행(예: TBD-001)이 없음"))
        before7 = content[:sec7]
        n = before7.count('[확인필요]')
        if n:
            viols.append(("MIGYEOL", "[확인필요]가 §7 외 본문에 %d곳 — 미결사항(§7)으로 모을 것" % n))
    # (sec7 < 0 인 경우는 R1에서 이미 STRUCT 위반으로 보고됨)

    return viols


def is_target(path):
    b = os.path.basename(path)
    return b.startswith("SCR-") and b.endswith(".md")


def check_inventory_drift():
    """00_화면목록.md §3 표가 정본(_inventory_rows.json)과 같은지 본다.

    표 머리에 «정본에서 생성한 표»라고 적혀 있었지만 생성기가 없어 손으로 유지돼 왔고,
    2026-09-03 점검에서 **31행이 어긋나 있었다**(SFR 23행 · 표기 8행). 어긋남의 증상이
    조용해서(문법 오류도 콘솔 경고도 없다) 검사가 없으면 다시 벌어진다.
    고치는 방법은 손이 아니라 `python3 docs/screen-definitions/_build-data.py` 다.
    """
    import json as _json, re as _re
    fn = os.path.join(HERE, "00_화면목록.md")
    jf = os.path.join(HERE, "_inventory_rows.json")
    if not (os.path.exists(fn) and os.path.exists(jf)):
        return []
    rows = _json.load(open(jf, encoding="utf-8"))
    md = open(fn, encoding="utf-8").read()
    def cell(v):
        return str(v or "").replace("|", "\\|").strip()
    def route(r):
        rt = cell(r.get("route"))
        return rt if rt.startswith("전역 —") else "`" + rt + "`"
    want = ["| " + " | ".join([cell(r.get("scrId")), cell(r.get("daemenu")), cell(r.get("jungmenu")),
            cell(r.get("name")), cell(r.get("type")), route(r), cell(r.get("components")),
            cell(r.get("existingSfr")), cell(r.get("defFile"))]) + " |" for r in rows]
    got = [l for l in md.split("\n") if _re.match(r"^\| SCR-[A-Z]+-\d+ \|", l)]
    bad = []
    if len(want) != len(got):
        bad.append(("INV-ROWS", "표 %d행 ≠ 정본 %d행" % (len(got), len(want))))
    for w, g in zip(want, got):
        if w != g:
            bad.append(("INV-DIFF", g.split("|")[1].strip() + " — 표가 정본과 다르다"))
    return bad


def main(argv):
    files = argv[1:] or sorted(glob.glob(os.path.join(HERE, "SCR-*.md")))
    targets = [f for f in files if is_target(f)]
    if not targets:
        print("검사 대상(SCR-*.md) 없음")
        return 0
    total = 0
    for f in targets:
        if not os.path.exists(f):
            continue
        v = check(open(f, encoding="utf-8").read())
        if v:
            total += len(v)
            print("✗ %s — 위반 %d건" % (os.path.basename(f), len(v)))
            for code, msg in v:
                print("   [%s] %s" % (code, msg))
        else:
            print("✓ %s — 규칙 통과" % os.path.basename(f))
    drift = check_inventory_drift()
    if drift:
        total += len(drift)
        print("✗ 00_화면목록.md §3 표 — 정본과 어긋남 %d건 (고치려면 _build-data.py 를 다시 돌린다)" % len(drift))
        for code, msg in drift[:10]:
            print("   [%s] %s" % (code, msg))
        if len(drift) > 10:
            print("   … 외 %d건" % (len(drift) - 10))
    else:
        print("✓ 00_화면목록.md §3 표 — 정본과 일치")
    print("\n합계 위반 %d건 / 대상 %d개" % (total, len(targets)))
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
