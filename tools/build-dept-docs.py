#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
부서별 문서 보유량 집계 시드 생성기 — 5개년 원장 ZIP → js/cmp-dept-docs.js

  원본: 260808_담양군청_업무문서_목록.zip (부서 폴더 × 반기 CSV, 온나라 원본 18열)
  용도: 이행 관리 L2 부서 표의 «보유 업무문서» 열을 실측으로 채운다.

  ⚠ 이 집계는 «문서가 몇 건 있다» 이지 «의무를 이행했다» 가 아니다.
     원본에 업무단계 분류 열이 없어 이행 판정에는 쓸 수 없다. 이행률 칸은
     그대로 «자료 미취합» 이며, 화면이 두 축을 섞지 않도록 밝힌다.

  제외: '환경과' 폴더 — 실제 내용이 재난안전과 문서라는 확인이 있어(2026-08-18)
        부서 라벨을 신뢰할 수 없다. 확실하지 않은 값을 넣지 않는다.

사용법:
    python3 tools/build-dept-docs.py \
        --zip "../업무 자동 발행/260808_담양군청_업무문서_목록.zip" \
        --out js/cmp-dept-docs.js
"""
import argparse, csv, io, json, os, sys, zipfile
from collections import defaultdict

EXCLUDE = {'환경과'}          # 위 주석 참조 — 라벨 미확인
def dec(n):
    for e in ('cp949', 'euc-kr', 'utf-8'):
        try:
            return n.encode('cp437').decode(e)
        except Exception:
            pass
    return n

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--zip', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()

    z = zipfile.ZipFile(a.zip)
    per_dept = defaultdict(lambda: defaultdict(int))   # dept → year → count
    kinds = defaultdict(lambda: defaultdict(int))      # dept → 문서구분 → count
    skipped = []
    for n in z.namelist():
        d = dec(n)
        if not d.endswith('.csv'):
            continue
        dept, fname = d.split('/')[0], d.split('/')[-1]
        if dept in EXCLUDE:
            skipped.append(d)
            continue
        year = fname.split()[0]
        raw = z.read(n)
        try:
            txt = raw.decode('utf-8-sig')
        except UnicodeDecodeError:
            txt = raw.decode('cp949', 'ignore')
        rows = list(csv.DictReader(io.StringIO(txt)))
        per_dept[dept][year] += len(rows)
        for r in rows:
            kinds[dept][(r.get('문서구분') or '').strip() or '미기재'] += 1

    depts = {}
    for dept, years in per_dept.items():
        depts[dept] = {
            'total': sum(years.values()),
            'byYear': {y: c for y, c in sorted(years.items())},
            'byKind': dict(sorted(kinds[dept].items(), key=lambda x: -x[1])),
        }
    meta = {
        'source': os.path.basename(a.zip),
        'range': '2021-07 ~ 2026-06',
        'depts': len(depts),
        'total': sum(v['total'] for v in depts.values()),
        'excluded': sorted(EXCLUDE),
        'note': '문서 보유량 집계일 뿐 이행 판정이 아니다 — 원본에 업무단계 분류 열이 없다',
    }
    body = (
        '/* =========================================================================\n'
        ' * 부서별 문서 보유량 — 5개년 원장 집계 (DYCMPDEPT)\n'
        ' *   ※ 생성물 — 손으로 고치지 말 것. tools/build-dept-docs.py 로 재생성한다.\n'
        ' *      원본: %s (%s)\n'
        ' *\n'
        ' *   [이행 판정이 아니다 (MUST)]\n'
        ' *   원본은 온나라 문서목록 그대로라 **업무단계 분류 열이 없다**. 그래서 이\n'
        ' *   수치는 «그 부서에 문서가 몇 건 있다» 까지만 말한다. 어느 문서가 어느\n'
        ' *   법정 의무의 증빙인지는 별도 분류 자료(부서별 문서분류)가 있어야 한다.\n'
        ' *   L2 부서 표의 이행률 칸은 그대로 «자료 미취합» 이다.\n'
        ' *\n'
        ' *   [제외된 부서]\n'
        ' *   %s — 폴더 라벨과 실제 내용이 다르다는 확인이 있어 뺐다(2026-08-18).\n'
        ' *   확실하지 않은 값을 넣지 않는다.\n'
        ' * ========================================================================= */\n'
        'window.DYCMPDEPT = {\n  META: %s,\n  DEPTS: %s\n};\n'
    ) % (meta['source'], meta['range'], ', '.join(meta['excluded']) or '없음',
         json.dumps(meta, ensure_ascii=False, indent=2),
         json.dumps(depts, ensure_ascii=False, indent=2))
    with io.open(a.out, 'w', encoding='utf-8') as f:
        f.write(body)
    print('생성: %s' % a.out)
    print('  부서 %d · 문서 %s건 · 제외 %d파일(%s)'
          % (meta['depts'], format(meta['total'], ','), len(skipped), ', '.join(sorted(EXCLUDE))))
    for d, v in sorted(depts.items(), key=lambda x: -x[1]['total']):
        print('   %-12s %8s건  %s' % (d, format(v['total'], ','), v['byYear']))

if __name__ == '__main__':
    main()
