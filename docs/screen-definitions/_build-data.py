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
