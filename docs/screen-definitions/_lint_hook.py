#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PostToolUse 훅 래퍼 — Write/Edit 대상이 화면 정의서(SCR-*.md)면 _lint.py로 검사.
위반 시 stderr에 사유 출력 + 종료코드 2(→ Claude에게 피드백되어 수정 유도).
대상 외 파일/내부 오류는 종료코드 0(작업 비차단).

stdin: Claude Code 훅 입력 JSON ({ tool_name, tool_input:{ file_path }, ... })
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0

    ti = data.get("tool_input") or {}
    fp = ti.get("file_path") or ti.get("filePath") or ""
    if not fp:
        return 0
    norm = fp.replace("\\", "/")
    base = os.path.basename(norm)

    # 대상: docs/screen-definitions/SCR-*.md 만
    if not (base.startswith("SCR-") and base.endswith(".md")):
        return 0
    if "docs/screen-definitions" not in norm:
        return 0
    if not os.path.exists(fp):
        return 0

    # _lint.py 로드 후 검사 (린터 자체 오류는 작업을 막지 않음)
    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location("_screendef_lint", os.path.join(HERE, "_lint.py"))
        lint = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(lint)
        viols = lint.check(open(fp, encoding="utf-8").read())
    except Exception:
        return 0

    if not viols:
        return 0

    out = ["[화면 정의서 규칙 위반] %s — v6 기획 규칙을 위반했습니다. 아래를 수정하세요:" % base]
    for code, msg in viols:
        out.append("  · [%s] %s" % (code, msg))
    out.append("규칙: 코드 수준 내용 금지(함수·DOM·CSS·수식·내부데이터·라인참조·보안분석), "
               "7섹션 구조 유지, [확인필요]는 §7 미결사항에 집결(기한 포함). "
               "상세: docs/screen-definitions/_규칙.md")
    sys.stderr.write("\n".join(out) + "\n")
    return 2


if __name__ == "__main__":
    sys.exit(main())
