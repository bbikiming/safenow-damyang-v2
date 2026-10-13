#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
연도별 확정 업무문서 생성기 — 확정문서목록 → js/doc-confirmed-data.js (DYDOCC)

  무엇이 달라지나 (2026-09-28)
  ─────────────────────────
  종전 2026 실적은 **예시 자료**였다(tools/build-doc-seed-2026.py — 2025 실측에서
  규칙으로 만든 시드). 올해 일이 아직 일어나지 않아 어디서도 받을 수 없었기
  때문이다. 이제 담양군 온나라 원장(2021 하반기 ~ 2026 상반기)에서 확정한 실제
  문서가 왔으므로 **시드를 걷고 실측으로 바꾼다**(사용자 지시 — «첨부한 파일 이대로»).

  싣는 범위 — 연도마다 다르다. 화면이 이 사실을 말해야 한다
  ─────────────────────────────────────────────────
    · 2025 는 20개 부서 전체 — js/doc-history-data.js(DYDOCH)가 싣는다(원장 전체 +
      이 목록으로 판정). 여기서는 **수록 범위(COVER)만** 함께 적는다.
    · 2021 하반기 · 2022~2024 · 2026 상반기는 **6개 부서**(재난안전과·물순환사업소·
      건설과·공공시설사업소·환경과·공간재생과)의 확정 문서뿐이다. 나머지 부서의
      같은 해 문서는 이 파일에 없다 — 없는 것이 «안 했다»가 아니라 «수집 범위 밖»이다.
    · 2021 은 하반기(7~12월), 2026 은 상반기(1~6월)만 있다.

  이 파일에 없는 것
  ───────────────
  확정 목록은 «안전보건 이행 증빙으로 확정된 문서만» 싣는다. 그래서 2025 처럼
  분류 제외·미분류·원문 확인 문서가 없다(그 판단은 원장 쪽에서 끝났다). 부서 확인이
  필요한 문서도 이 목록 밖이다.

  검증 — tools/confirmed_list.py 가 「요약」 표(행·문서·부서)를 재현하지 못하면 멈춘다.

  실행: python3 tools/build-confirmed-docs.py --confirmed <확정문서목록>
        (분류기준을 먼저 만든다 — build-taxonomy.py → build-ledger-2025.py → 이 파일)
"""

import argparse
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import confirmed_list as CL  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'js', 'doc-confirmed-data.js')
LEDGER_YEAR = 2025          # 이 해는 DYDOCH 가 싣는다 — 여기서는 수록 범위만 적는다


def stage_ids():
    js = ("global.window={};require('./js/doc-taxonomy-data.js');"
          "console.log(JSON.stringify(window.DYDOCT.STAGES.map(function(s){return s.id;})));")
    r = subprocess.run(['node', '-e', js], cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit('분류기준을 읽지 못했습니다 — 먼저 build-taxonomy.py 를 돌리세요.\n' + r.stderr)
    return set(json.loads(r.stdout))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--confirmed', required=True)
    a = ap.parse_args()

    years, summary = CL.load(a.confirmed)
    bad, warn = CL.verify(years, summary, stage_ids())
    if bad:
        CL.fail(bad, '확정문서목록')
    CL.report(warn)

    # ── 수록 범위 — 6개 연도 전부(2025 포함). 화면의 연도별 안내가 이것 하나를 본다 ──
    cover = {}
    for y, Y in years.items():
        ds = sorted(CL.norm_date(k[1]) for k in Y['docs'])
        cover[str(y)] = {
            'label': Y['label'], 'period': Y['period'],
            'from': ds[0] if ds else '', 'to': ds[-1] if ds else '',
            'depts': sorted({k[0] for k in Y['docs']}),
            'docs': len(Y['docs']), 'rows': len(Y['rows']),
            'stagePairs': sum(len(d['stages']) for d in Y['docs'].values()),
            'stages': len({c for d in Y['docs'].values() for c in d['stages']}),
            'inLedger': y == LEDGER_YEAR,
        }

    # ── 문서 — 원장 연도(2025)를 뺀 나머지 ─────────────────────────────────────
    ys = [y for y in years if y != LEDGER_YEAR]
    depts = sorted({k[0] for y in ys for k in years[y]['docs']})
    srs = sorted({k[3] for y in ys for k in years[y]['docs']})
    stgs = sorted({c for y in ys for d in years[y]['docs'].values() for c in d['stages']})
    di = {v: i for i, v in enumerate(depts)}
    si = {v: i for i, v in enumerate(srs)}
    gi = {v: i for i, v in enumerate(stgs)}
    DIRI = {'in': 0, 'out': 1, 'internal': 2}

    recs = {}
    for y in ys:
        out = []
        for k, d in years[y]['docs'].items():
            date = CL.norm_date(k[1])
            if not date.startswith(str(y)):
                CL.fail(['%s 시트에 다른 해의 문서가 있습니다: %s %s' % (years[y]['label'], k[1], k[2])], '확정문서목록')
            out.append([k[2], di[k[0]], date[5:].replace('-', ''), si[k[3]],
                        DIRI.get(CL.DIR_OF.get(d['row']['발신구분'], ''), -1),
                        [gi[c] for c in d['stages']]])
        recs[str(y)] = out
        print('  %s — 문서 %d · 문서×단계 %d · 부서 %d · 단계 %d · %s ~ %s' % (
            years[y]['label'], len(out), cover[str(y)]['stagePairs'], len(cover[str(y)]['depts']),
            cover[str(y)]['stages'], cover[str(y)]['from'], cover[str(y)]['to']))

    meta = {
        'source': os.path.basename(a.confirmed),
        'sheets': [years[y]['sheet'] for y in years],
        'ledgerYear': LEDGER_YEAR,
        'years': [int(y) for y in recs],
        'docs': sum(len(v) for v in recs.values()),
    }
    hdr = '''/* =========================================================================
 * 연도별 확정 업무문서 — %s (DYDOCC)
 *   ※ 생성물 — 손으로 고치지 말 것. 원본 엑셀을 고치고 재생성한다.
 *      생성기: tools/build-confirmed-docs.py
 *      원본:   %s
 *
 *   [무엇인가] 담양군 온나라 원장에서 «안전보건 이행 증빙으로 확정된 문서»만 뽑은
 *   목록이다. 1행 = 문서 × 업무단계였던 것을 문서 하나에 단계 여럿으로 묶었다.
 *   종전 2026 예시 자료(규칙으로 만든 시드)를 대체한다 — 이제 전 연도가 실측이다.
 *
 *   [수록 범위 COVER] 연도마다 다르다 — 2025 는 20개 부서 전체(DYDOCH 가 싣는다),
 *   나머지 연도는 6개 부서뿐이고 2021 은 하반기·2026 은 상반기만 있다. 없는 문서는
 *   «안 했다»가 아니라 «수집 범위 밖»이다. 화면은 DYDOCS.coverage(year) 로 이것을 본다.
 *
 *   [저장 형태] 사전(D 부서 · S 수발신자 · G 단계코드) + 연도별 배열.
 *   Y[연도] 한 줄 = [제목, 부서i, MMDD, 수발신자i, 방향i, [단계i…]].
 * ========================================================================= */
''' % (' · '.join('%s %d건' % (years[int(y)]['label'], len(v)) for y, v in recs.items()),
       os.path.basename(a.confirmed))

    body = 'window.DYDOCC = {\n  META: ' + json.dumps(meta, ensure_ascii=False, indent=2) + ',\n'
    body += '  COVER: {\n' + ',\n'.join('    "%s": %s' % (y, json.dumps(c, ensure_ascii=False, separators=(',', ':')))
                                     for y, c in cover.items()) + '\n  },\n'
    for name, arr in (('D', depts), ('S', srs), ('G', stgs)):
        body += '  %s: %s,\n' % (name, json.dumps(arr, ensure_ascii=False, separators=(',', ':')))
    body += '  Y: {\n'
    blocks = []
    for y, out in recs.items():
        chunks = []
        for k in range(0, len(out), 20):
            chunks.append('      ' + ','.join(json.dumps(x, ensure_ascii=False, separators=(',', ':'))
                                              for x in out[k:k + 20]))
        blocks.append('    "%s": [\n%s\n    ]' % (y, ',\n'.join(chunks)))
    body += ',\n'.join(blocks) + '\n  }\n};\n'
    body += '''
/* 로더 — 원장(DYDOCH.DOCS)과 같은 레코드 모양으로 편다.
   화면(doc-progress.js build)은 이 DOCS 만 본다. */
(function (C) {
  var DIRS = ['in', 'out', 'internal'];
  C.DOCS = [];
  Object.keys(C.Y).forEach(function (y) {
    C.Y[y].forEach(function (r, i) {
      var mm = r[2];
      C.DOCS.push({
        id: 'DOC-' + y + '-' + ('000000' + (i + 1)).slice(-6),
        title: r[0],
        dept: C.D[r[1]] || '',
        date: y + '-' + mm.slice(0, 2) + '-' + mm.slice(2),
        sr: C.S[r[3]] || '',
        dir: DIRS[r[4]] || null,
        stageIds: r[5].map(function (g) { return C.G[g]; }),
        mapConf: 'sure', excluded: '', review: null, deptCheck: null,
        year: +y,
        mapped: r[5].length > 0,
        src: 'onnara', st: '',
        assignee: '',
        dataMode: 'real', statusSource: 'confirmed-list'
      });
    });
  });
}(window.DYDOCC));
'''
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(hdr + body)
    print('\n생성: %s (%.1f KB) — 문서 %d건' % (os.path.relpath(OUT, ROOT), os.path.getsize(OUT) / 1024, meta['docs']))


if __name__ == '__main__':
    main()
