#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
화면 정의서 뷰어 데이터 생성기
  docs/screen-definitions/ 의 .md 파일 + _inventory_rows.json 을 읽어
  js/screen-defs-data.js (전역 window.SCREEN_DEFS) 를 재생성한다.

사용법:
  1) 새 화면 정의서 .md 를 docs/screen-definitions/ 에 추가/수정한다.
     (파일명은 _inventory_rows.json 의 defFile 과 일치해야 목록에 연결된다)
  2) python3 docs/screen-definitions/_build-data.py
  3) screen-definitions.html 새로고침 → 자동 반영.

빌드/번들러 없이 file:// 에서도 동작하도록, 마크다운을 JS 전역 객체에 임베드한다
(기존 js/data.js · js/sets-data.js 패턴과 동일).
"""
import json, os, datetime, re

def count_unresolved(md):
    """작성된 정의서의 §7 미결사항 항목(예: TBD-001, REG-01) 행 수를 센다. 없으면 None."""
    i = md.find("## 7. 미결사항")
    if i < 0:
        return None
    return len(re.findall(r"\|\s*[A-Z]{2,}-\d+\s*\|", md[i:]))

HERE = os.path.dirname(os.path.abspath(__file__))            # docs/screen-definitions
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))        # 프로젝트 루트
OUT = os.path.join(ROOT, "js", "screen-defs-data.js")

def read(fn):
    p = os.path.join(HERE, fn)
    return open(p, encoding="utf-8").read() if os.path.exists(p) else None

rows = json.load(open(os.path.join(HERE, "_inventory_rows.json"), encoding="utf-8"))

# ---------------------------------------------------------------------------
# 00_화면목록.md §3 표를 정본에서 다시 만든다 (2026-09-03 신설)
#
# 표 머리에 "정본에서 생성한 표 — 손으로 고치지 말 것"이라고 적혀 있었지만 실제로는
# 생성기가 없어 손으로 유지돼 왔고, 그 결과 **31행이 정본과 어긋나 있었다**(SFR 칸 23행 ·
# 백틱 표기 8행). 어긋난 값 중에는 tools/sfr-verify.py 의 판정과 반대인 것도 있었다
# (예: 대시보드 SFR-020·017 — 검증 결과는 SFR-020 하나다).
# 이제 이 스크립트가 표와 건수 문구를 함께 다시 쓴다. 정본은 _inventory_rows.json 이다.
# ---------------------------------------------------------------------------
def _cell(v):
    """표 칸 이스케이프 — 파이프는 표를 깨뜨린다."""
    return str(v or "").replace("|", "\\|").strip()

def _route(r):
    """URL 칸 표기 — 실제 경로·호출식은 코드로 감싸고 «전역 —» 서술은 평문으로 둔다."""
    rt = _cell(r.get("route"))
    return rt if rt.startswith("전역 —") else "`" + rt + "`"

def _row_line(r):
    return "| " + " | ".join([
        _cell(r.get("scrId")), _cell(r.get("daemenu")), _cell(r.get("jungmenu")),
        _cell(r.get("name")), _cell(r.get("type")), _route(r),
        _cell(r.get("components")), _cell(r.get("existingSfr")), _cell(r.get("defFile")),
    ]) + " |"

def rebuild_inventory_md(rows):
    fn = os.path.join(HERE, "00_화면목록.md")
    md = open(fn, encoding="utf-8").read()
    head = ("| 화면 ID | 대메뉴 | 중메뉴 | 화면명 | 화면 유형 | URL | 관련 컴포넌트 "
            "| 기존 SFR | 정의서 파일 |")
    i = md.find(head)
    if i < 0:
        raise SystemExit("[중단] 00_화면목록.md 에서 표 머리글을 찾지 못했다 — 형식이 바뀌었는지 확인하라.")
    sep = md.index("\n", i) + 1                      # 구분선 줄
    end = md.index("\n", sep)                        # 구분선 끝
    body_start = end + 1
    body_end = body_start
    while body_end < len(md) and md[body_end] == "|":
        body_end = md.index("\n", body_end) + 1
    new_body = "\n".join(_row_line(r) for r in rows) + "\n"
    old_body = md[body_start:body_end]
    md = md[:body_start] + new_body + md[body_end:]

    # 건수 문구도 세어서 쓴다 — 문장에 박으면 행이 늘 때마다 문서만 옛 수치로 남는다
    docs_n = len({r.get("defFile") for r in rows if r.get("defFile")})
    todo_n = sum(1 for r in rows if not r.get("defFile"))
    note = ("> 총 **%d개** 화면 · 정의서가 덮는 화면 **%d개**(문서 **%d건** — 의견청취·인력평가와 "
            "교육 변형 URL은 공통 정의서를 함께 쓴다) · 미작성 **%d개**."
            % (len(rows), len(rows) - todo_n, docs_n, todo_n))
    # 치환이 «조용히 빗나가는» 것이 이 문서가 어긋난 원인이었다. 앵커를 못 찾으면 멈춘다.
    def sub1(pat, rep, text, what):
        text2, n = re.subn(pat, rep, text, count=1, flags=re.M)
        if n != 1:
            raise SystemExit("[중단] 00_화면목록.md 의 «%s» 문구를 찾지 못했다 — 문장이 바뀌었으면 "
                             "_build-data.py 의 앵커도 함께 고쳐라." % what)
        return text2
    md = sub1(r"^> 총 \*\*\d+개\*\* 화면 .*$", note.replace("\\", "\\\\"), md, "§3 총계 줄")
    md = sub1(r"(머신 인벤토리\(`_inventory_rows\.json`\) 기준 \*\*)\d+(개\*\*다)",
              r"\g<1>%d\g<2>" % len(rows), md, "§4 총 화면 수")
    md = sub1(r"(화면 \*\*)\d+(개를 문서 )\d+(건\*\*이 전부 덮는다)",
              r"\g<1>%d\g<2>%d\g<3>" % (len(rows), docs_n), md, "§4 정의서 작성 현황")
    md = sub1(r"(\*\*미작성 화면 )\d+(개\*\*다)", r"\g<1>%d\g<2>" % todo_n, md, "§4 미작성 화면 수")

    open(fn, "w", encoding="utf-8").write(md)
    changed = sum(1 for a, b in zip(old_body.split("\n"), new_body.split("\n")) if a != b)
    n_old = len([l for l in old_body.split("\n") if l.strip()])
    print("  00_화면목록.md §3 표 재생성 — %d행 (변경 %d행%s)"
          % (len(rows), changed, "" if n_old == len(rows) else " · 행 수 %d→%d" % (n_old, len(rows))))

rebuild_inventory_md(rows)

# 공통 문서 3종 (목록 / 권한 / 미결)
common_specs = [
    ("inventory",  "화면 목록",      "00_화면목록.md"),
    ("permission", "공통 권한 정의",  "_공통_권한정의.md"),
    ("missing",    "미결사항 목록",   "99_미결사항목록.md"),
    ("opn-plan",   "의견청취 3탭 기획", "../planning/의견청취_3탭개편_기획-v0.1.md"),
]
commonDocs = []
for key, title, fn in common_specs:
    c = read(fn)
    if c is not None:
        commonDocs.append({"key": key, "title": title, "fileName": fn, "rawMarkdown": c})

# 화면별 정의서 — 작성된 것만 docs 맵에 임베드
docs, manifest = {}, []
for r in rows:
    deffile = r.get("defFile", "")
    content = read(deffile) if deffile else None
    has = content is not None
    # 미결 건수 현행화: 작성된 정의서는 §7 실제 행 수, 미작성은 인벤토리 추정치
    unresolved = r.get("unresolvedCount", 0)
    if has:
        docs[deffile] = content
        c = count_unresolved(content)
        if c is not None:
            unresolved = c
    manifest.append({
        "scrId": r.get("scrId", ""), "daemenu": r.get("daemenu", ""), "jungmenu": r.get("jungmenu", ""),
        "name": r.get("name", ""), "type": r.get("type", ""), "route": r.get("route", ""),
        "file": os.path.basename(r.get("file", "")) if r.get("file") else "",
        "components": r.get("components", ""), "existingSfr": r.get("existingSfr", ""),
        "defFile": deffile, "unresolvedCount": unresolved, "hasDoc": has,
        "unresolvedEstimated": (not has),
    })

obj = {
    "generatedAt": datetime.date.today().isoformat(),
    "totalScreens": len(manifest), "writtenCount": len(docs),
    "manifest": manifest, "commonDocs": commonDocs, "docs": docs,
}

with open(OUT, "w", encoding="utf-8") as f:
    f.write("/* 자동 생성 파일 — docs/screen-definitions 기반. 직접 편집하지 말 것.\n")
    f.write("   재생성: python3 docs/screen-definitions/_build-data.py */\n")
    f.write("window.SCREEN_DEFS = ")
    f.write(json.dumps(obj, ensure_ascii=False, indent=1))
    f.write(";\n")

print("생성:", OUT)
print("총 화면:", len(manifest), "| 작성된 정의서:", len(docs), "| 공통문서:", len(commonDocs))

# 규칙 검증(v6 기획 규칙) — 작성된 SCR 문서 대상. 비차단 요약(레거시 표본도 함께 노출).
try:
    import importlib.util as _ilu
    _spec = _ilu.spec_from_file_location("_screendef_lint", os.path.join(HERE, "_lint.py"))
    _lint = _ilu.module_from_spec(_spec); _spec.loader.exec_module(_lint)
    print("\n[규칙 검증] v6 기획 규칙:")
    _bad = 0
    for r in rows:
        df = r.get("defFile", "")
        p = os.path.join(HERE, df)
        if not (df and os.path.exists(p)):
            continue
        v = _lint.check(open(p, encoding="utf-8").read())
        if v:
            _bad += 1
            print("  ✗ %s — 위반 %d건" % (df, len(v)))
        else:
            print("  ✓ %s" % df)
    if _bad:
        print("  ※ 위반 %d개 문서 — 'python3 docs/screen-definitions/_lint.py' 로 상세 확인(레거시 표본 포함 가능)" % _bad)
except Exception as _e:
    print("[규칙 검증] 건너뜀:", _e)
