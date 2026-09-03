#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""화면정의서 정합 검사 — 정의서 ↔ 정본(_inventory_rows.json) ↔ 코드.

  실행: python3 tools/check-screendefs.py

[왜 필요한가]
`_lint.py` 는 정의서 **한 건의 형식**(절 구성·금지어)을 본다. 그런데 2026-09-03
점검에서 드러난 결함은 전부 «문서와 정본·코드가 서로 다른 말을 한다»는 종류였다.
형식은 통과하면서 내용이 어긋나므로 조용하다.

  · 시설물 대장 정의서가 **없앤 버튼**([FMS 연계])을 여전히 정의하고 있었다
  · 업무 업로드 정의서가 진입처를 **은퇴 화면 둘로만** 적고 있었다(실제로는 살아 있는
    이행 관리·문서 목록이 쓴다 — 정본의 route·중메뉴도 함께 틀려 있었다)
  · 경영방침 정의서가 은퇴한 업무 목록으로 안내하고 있었다
  · 메뉴에서 뺀 문서 상세 3건에 상태·대체 화면·진입 수단이 없었다

[무엇을 보는가]
  1. §1 상위 메뉴 ↔ 정본 대메뉴
  2. §1 URL 경로 ↔ 정본 route
  3. §1 화면명 ↔ 정본 name
  4. 실재하지 않는 SCR-ID 참조
  5. 없어진 대메뉴 이름
  6. 은퇴 화면 정의서의 필수 행(상태·대체 화면·진입 수단)
  7. 살아 있는 정의서가 은퇴 화면으로 안내하는가 — 파일명 기준
  8. 그리고 **화면 이름** 기준(«기준문서함으로 이동»처럼 파일명 없이 적은 것)
     — 둘 다 «메뉴 제외»라고 밝힌 서술은 사실 기술이므로 위반이 아니다
  9. 정의서가 적은 파일이 실재하는가

[은퇴 목록은 check-links.js 와 같은 곳을 본다] — 두 목록이 갈리면 한쪽만 통과한다.
"""
import json, re, io, os, glob, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
HERE = os.path.join(ROOT, "docs", "screen-definitions")

rows = json.load(open(os.path.join(HERE, "_inventory_rows.json"), encoding="utf-8"))
byDef = {}
for r in rows:
    byDef.setdefault(r["defFile"], []).append(r)
allIds = {r["scrId"] for r in rows}

# 은퇴 화면 — tools/check-links.js 의 RETIRED 를 그대로 읽는다(두 목록을 따로 두지 않는다)
cl = io.open(os.path.join(ROOT, "tools", "check-links.js"), encoding="utf-8").read()
blk = cl[cl.index("const RETIRED = new Set(["):]
RETIRED = set(re.findall(r"'([\w-]+\.html)'", blk[:blk.index("]);")]))
DEAD_MENU = ["기본정보 >", "업무문서 >", "시설물 안전관리", "예산관리 >", "(구)업무관리", "시설물 관리 >"]

# 메뉴에서 뺀 «화면 이름» — 파일명이 없어도 이름만 읽고 사용자는 메뉴에서 찾는다.
# 2026-09-03 실측: 정의서 7곳이 «기준문서함으로 이동»·«이행 목록으로 이동»처럼 적고
# 있었다(코드는 이미 신버전으로 고쳤는데 문서만 남았다). 파일명 기준 검사(SD-TORETIRED)로는
# 한 건도 잡히지 않았다.
GONE_SCREENS = ["관리대상 현황", "데이터 일괄등록", "FMS 연계", "연계 설정", "기준문서함",
                "업무 목록", "이행 목록", "업무 발행 관리", "부서 업무함"]
# «가는 곳»으로 읽히는 문맥에서만 잡는다 — 이름을 언급하는 것과 그리로 보내는 것은 다르다
GO_CTX = re.compile(r"(에서 (?:한다|합니다|본다|봅니다|확인|관리|조회|등록|처리|찾|받|올|넣|하세요|여세요)"
                    r"|으?로 (?:이동|간다|갑니다|유도|안내)|을 (?:여세요|열어|보세요)|바로가기|→)")
# 이 말이 같은 줄에 있으면 «없어졌다»를 밝히는 서술이다.
# ※ 좁게 유지한다 — 넓히면 «종전 방식대로 …에서 관리합니다» 같은 진짜 나쁜 문구가 통과한다.
GONE_OK = ("메뉴 제외", "이전 버전", "은퇴", "2026-09-03", "2026-08-28")

def field(md, k):
    m = re.search(r"^\|\s*" + k + r"\s*\|(.+?)\|\s*$", md, re.M)
    return m.group(1).strip() if m else None

bad = []
def flag(code, f, msg):
    bad.append((code, os.path.basename(f), msg))

# 공통 문서 3종도 본다 — 2026-09-03 실측: 99_미결사항목록이 담양군이 값을 넣을 자리로
# «관리대상 현황»을 지목하고 있었는데 그 화면은 메뉴에서 뺀 뒤였다. SCR-*.md 만 보면 놓친다.
COMMON = ["99_미결사항목록.md", "_공통_권한정의.md", "00_화면목록.md", "_규칙.md"]

# ── QA 검수 시나리오도 본다 (2026-09-03 신설) ────────────────────────────────
# 이 문서는 «검수자가 이 순서대로 눌러 본다»는 **실행 문서**라, 화면 목록과 어긋나면
# 그 자체가 결함이다. 실측: 관리대상 재편·기준문서함 은퇴 뒤에도 TC 3건(SMK-003·004·010)
# 이 은퇴 화면을 순회하라고 지시하고 있었다 — 검수자는 「화면이 없다」를 **시스템 결함**
# 으로 기록한다. 정의서 검사(SCR-*.md)도 링크 검사(코드)도 이 문서를 보지 않았다.
#
# ⚠ 무엇을 보는지 좁혀 둔다 — 이 문서에는 「옛 대메뉴 → 지금」 매핑표처럼 **없어진 이름을
#   적는 것이 옳은** 서술이 있다. 그래서 서술문은 보지 않고, 검수자가 실제로 **수행하는 행**
#   두 종류만 본다: TC 표 행(`| SMK-003 | …`)과 모듈 범위표 행(`| P1 | ② … |`).
QA_FILES = sorted(glob.glob(os.path.join(ROOT, "docs", "planning", "검수-QA시나리오-*.md"))) + \
           sorted(glob.glob(os.path.join(ROOT, "docs", "planning", "노션임포트-QA-*", "*.md"))) + \
           sorted(glob.glob(os.path.join(ROOT, "docs", "planning", "노션임포트-QA-*", "*.csv")))
QA_ROW = re.compile(r"^\|\s*(?:(?:RISK|EDU|COM|SMK)-\d{3}|P[012])\s*\|")
QA_CSV_ROW = re.compile(r"^(?:RISK|EDU|COM|SMK)-\d{3},")
# 「그 화면은 없다」를 확인시키는 행은 위반이 아니다 — 오히려 있어야 하는 TC 다
QA_OK = GONE_OK + ("FAIL", "없다", "보이지", "찾아본", "메뉴에 없", "없는 것")

# 면제는 **셀 단위**로 판정한다 (MUST) — 행 전체를 보면 「…이 보이면 FAIL」이 한 칸에만
# 있어도 다른 칸의 «기준문서함 진입 > 검색» 이 통째로 면제된다. 2026-09-03 변이 시험에서
# 실제로 그렇게 3건 중 2건을 놓쳤다. 한 칸 안에서 이름과 부정어가 함께 있어야 면제다.
def qa_cells(ln, is_csv):
    if is_csv:
        import csv as _csv
        try:
            return next(_csv.reader([ln]))
        except Exception:
            return [ln]
    return ln.strip().strip("|").split("|")

for f in QA_FILES:
    is_csv = f.endswith(".csv")
    for ln in io.open(f, encoding="utf-8"):
        if not (QA_CSV_ROW.match(ln) if is_csv else QA_ROW.match(ln)):
            continue
        for cell in qa_cells(ln, is_csv):
            if any(w in cell for w in QA_OK):
                continue
            hit = next((nm for nm in GONE_SCREENS if nm in cell), None)
            if hit:
                flag("QA-GONE", f, "검수 지시가 메뉴에 없는 화면 «%s» 을 가리킨다 — «%s»"
                     % (hit, cell.strip()[:70]))
                continue
            dm = next((d for d in DEAD_MENU if d in cell), None)
            if dm:
                flag("QA-DEADMENU", f, "검수 지시에 없어진 대메뉴 이름 — «%s»" % cell.strip()[:70])

for f in sorted(glob.glob(os.path.join(HERE, "SCR-*.md"))) + [os.path.join(HERE, c) for c in COMMON]:
    b, md = os.path.basename(f), io.open(f, encoding="utf-8").read()
    rs = byDef.get(b)
    if not rs:
        if b in COMMON:
            # 공통 문서 — §1 표가 없으므로 «없어진 이름을 쓰는가»만 본다.
            # 2026-09-03 실측: 대메뉴 이름 검사(DEAD_MENU)를 SCR-*.md 에만 걸고 있어
            # 00_화면목록·_공통_권한정의·99_미결이 옛 대메뉴 이름을 그대로 갖고 있었다.
            for ln in md.split("\n"):
                if any(w in ln for w in GONE_OK):
                    continue
                for nm in GONE_SCREENS:
                    if nm in ln and GO_CTX.search(ln):
                        flag("SD-GONENAME", f, "메뉴에서 뺀 화면 «%s» 을 가리킨다 — «%s»" % (nm, ln.strip()[:60]))
                        break
                for d in DEAD_MENU:
                    if d in ln:
                        flag("SD-DEADMENU", f, "없어진 대메뉴 이름: " + ln.strip()[:70])
                        break
            continue
        flag("SD-ORPHAN", f, "정본(_inventory_rows.json)에 이 정의서를 쓰는 행이 없다")
        continue
    r = rs[0]
    isRet = any(x["route"].split("?")[0].split(" ")[0] in RETIRED for x in rs)

    fm = field(md, "상위 메뉴") or ""
    if r["daemenu"] not in fm and not fm.startswith("별도 메뉴"):
        flag("SD-MENU", f, "§1 상위 메뉴 «%s» ≠ 정본 «%s > %s»" % (fm[:40], r["daemenu"], r["jungmenu"]))

    # 화면명 — 정본이 괄호 부연을 더 갖는 경우가 많아 «접두 호환»까지 허용한다.
    # 정의서 하나가 여러 행을 덮으면(교육 현업/관리감독자, 의견청취 3탭) 문서는 그 묶음의
    # 이름을 쓰므로 검사하지 않는다 — 1:N 매핑에서 이름이 같을 수 없다.
    fn = field(md, "화면명") or ""
    names = {x["name"] for x in rs}
    if fn and len(names) == 1:
        nm = list(names)[0]
        if not (fn == nm or nm.startswith(fn) or fn.startswith(nm)):
            flag("SD-NAME", f, "§1 화면명 «%s» ≠ 정본 «%s»" % (fn[:40], nm[:40]))

    fu = (field(md, "URL 경로") or "").replace("`", "").strip()
    routes = {x["route"].replace("`", "").strip() for x in rs}
    # 주소가 없는 화면(전역 크롬·공통 모듈 호출)은 서술로 적는다 — 문자열 대조 대상이 아니다
    urlish = any(".html" in rt for rt in routes)
    if fu and urlish and \
       not any(fu.split(" ")[0].split("·")[0].strip() in rt or rt.split(" ")[0] in fu for rt in routes):
        flag("SD-URL", f, "§1 URL «%s» ≠ 정본 «%s»" % (fu[:40], " / ".join(sorted(routes))[:40]))

    for sid in sorted(set(re.findall(r"SCR-[A-Z]+-\d{3}", md))):
        if sid not in allIds:
            flag("SD-REF", f, "실재하지 않는 화면 ID 참조: " + sid)

    for ln in md.split("\n"):
        if any(d in ln for d in DEAD_MENU) and not any(w in ln for w in ("메뉴 제외", "구 ", "종전", "2026-0")):
            flag("SD-DEADMENU", f, "없어진 대메뉴 이름: " + ln.strip()[:70]); break

    if isRet:
        miss = [k for k in ("상태", "대체 화면", "진입 수단") if field(md, k) is None]
        if miss:
            flag("SD-RETIRED", f, "메뉴 제외 화면인데 §1 에 %s 행이 없다" % "·".join(miss))
    else:
        for ln in md.split("\n"):
            hits = [h for h in set(re.findall(r"([\w-]+\.html)", ln)) if h in RETIRED]
            if hits and "메뉴 제외" not in ln:
                flag("SD-TORETIRED", f, "은퇴 화면으로 안내: %s — «%s»" % (", ".join(hits), ln.strip()[:60]))
            if any(w in ln for w in GONE_OK):
                continue
            for nm in GONE_SCREENS:
                if nm in ln and GO_CTX.search(ln):
                    flag("SD-GONENAME", f, "메뉴에서 뺀 화면 «%s» 으로 보낸다 — «%s»" % (nm, ln.strip()[:60]))
                    break

    for h in sorted(set(re.findall(r"([\w-]+\.html)", md))):
        if not os.path.exists(os.path.join(ROOT, h)):
            flag("SD-FILE", f, "실재하지 않는 파일 참조: " + h)

print("화면정의서 정합 검사 — 정의서 %d건 · 정본 %d행 · QA 문서 %d건\n"
      % (len(glob.glob(os.path.join(HERE, "SCR-*.md"))), len(rows), len(QA_FILES)))
if bad:
    for code, f, msg in bad:
        print("  ✗ [%s] %s — %s" % (code, f, msg))
    print("\n✖ 위반 %d건" % len(bad))
    sys.exit(1)
print("  ✓ §1 상위 메뉴·화면명·URL 이 정본과 일치")
print("  ✓ 실재하지 않는 화면 ID·파일 참조 없음")
print("  ✓ 없어진 대메뉴 이름 없음")
print("  ✓ 메뉴 제외 화면의 상태·대체 화면·진입 수단 명시")
print("  ✓ 살아 있는 정의서가 은퇴 화면으로 안내하지 않음 (파일명·화면 이름 둘 다)")
print("  ✓ QA 검수 지시가 메뉴에 없는 화면·대메뉴를 가리키지 않음")
print("\n✔ 화면정의서 정합 10종 전건 통과")
