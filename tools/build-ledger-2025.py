#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
2025 업무문서 원장 생성기 — 대시보드.xlsx 「문서목록」 → js/doc-history-data.js

  무엇이 달라지나 (재난안전과 3,830 → 20개 부서 58,223)
  ─────────────────────────────────────────────────
  종전 원장은 **재난안전과 한 부서**의 문서 3,830건이었다. 그래서 화면이
  «부서별 이행 판정은 아직 낼 수 없습니다 — 원장이 재난안전과 소관이라
  담당부서 값이 없습니다» 라고 말해 왔다. 이 파일은 **20개 부서 58,223행**
  이라 그 제약이 풀린다. L2 부서 단위가 처음으로 실제 값을 갖는다.

  세 가지 결정 — 전부 실측으로 정했다
  ──────────────────────────────
  ① 중복 판정 키 = 부서 + 보고일자 + 문서명 + 수발신자 + 업무단계
     초과분이 키에 따라 크게 갈린다 — 7,113 / 5,807 / **458**.
     같은 부서가 같은 날 같은 제목을 여러 건 만드는 것은 실제로 있다(수신처가
     여럿이거나 여러 단계의 증빙이다). 단계까지 넣어야 «같은 증빙을 두 번
     세는 것»만 걸러진다. 앞 두 키는 **다른 단계의 증빙까지 지워** 이행 판정을
     떨어뜨린다.

  ② 제외사유가 있는 1,682건은 **단계가 애초에 붙어 있지 않다**(매핑 0건).
     타 기관 소관 1,671 · 의무아님(자치사무) 11. 지우지 않고 실어서 문서
     목록에서는 보이게 하되, 단계가 없으므로 이행 판정에는 들어가지 않는다.
     지우면 «우리 원장에 그 문서가 없다»가 되어 사실과 달라진다.

  ③ 분류확인은 **미매핑과 겹친다** — 모호 24,880 중 24,677이 미매핑이다.
     즉 «모호»는 사실상 «단계를 못 붙였다»는 뜻이고, 매핑된 33,546건은
     확실 25,909 + 애매 7,434 + 모호 203 이다. **애매 7,434건이 진짜 위험**
     이다 — 단계는 붙었는데 확신이 낮다. 화면이 그 사실을 드러내야 한다.

  용량 — 사전 + 배열로 3.4MB (원시 JSON 5.2MB)
  ───────────────────────────────────────
  부서 20 · 수발신자 5,542 · 단계명 179 를 사전으로 빼고 레코드를 배열로
  둔다. 로딩 성능은 문제가 아니다(58,223건 인덱스 구축 49ms 실측) — 파일
  크기가 문제라 거기를 줄인다. **분할하지 않는다** — 화면마다 다른 데이터를
  보면 «같은 데이터를 두 화면이 다르게 말한다»가 된다.

  발신구분이 우리 「수발신 방향」을 채운다
  ─────────────────────────────────
  접수(외부) → 받은 문서 · 생산 → 보낸 문서 · 접수(내부) → 내부 문서.
  세 값이 우리 dir 과 1:1 이라 58,223건 전부가 방향을 갖는다. 종전 원장의
  «노, 로, 도» 94건이 왜 생겼는지도 이걸로 설명된다 — 내부 문서의 수신처였다.

  v4.0 (2026-09-07) — 제외가 2종에서 5종으로, 원문확인 3열이 새로 생겼다
  ────────────────────────────────────────────────────────────────
  적용 법령이 중대재해처벌법·산업안전보건법 2종으로 좁혀지면서(분류기준 v4.0)
  재난안전법·개별 시설법 문서가 「적용 법령 밖」으로, 계약·재정 집행 절차가
  「집행 행정문서」로, 상급기관 시달·안내 접수가 「증빙 아님(참고수신)」으로 빠졌다.
  제외가 원장의 대부분을 차지하게 되지만 **지우지 않는다** — 문서 목록에서는
  보이되 단계가 없으므로 이행 판정에는 들어가지 않는다(종전과 같은 규칙).

  「원문 확인 필요」·「원문에서 확인할 것」·「해당 시 업무단계(후보)」 3열은 제목만으로
  판정할 수 없어 담양군 방문 시 원문을 열어 볼 문서를 표시한 것이다. 단계가 붙은
  문서에도 붙는다(예: 일반건강진단 갈음 요건) — 판정에는 들어가되 확인이 필요한
  문서라 화면이 드러내야 한다. 사전(V)으로 실어 review 필드로 편다.
  「검토 메모」는 검토자 내부 기록이라 싣지 않는다(2026-09-08 확정).

  실행: python3 tools/build-ledger-2025.py --xlsx <경로>
"""

import argparse
import json
import os
import re
import sys
from collections import Counter, OrderedDict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'js', 'doc-history-data.js')

YEAR = 2025
DIR_OF = {'접수(외부)': 'in', '생산': 'out', '접수(내부)': 'internal'}
CONF_OF = {'확실': 'sure', '애매': 'weak', '모호': 'vague'}
# 중복 판정 키 — 위 ① 참고. 단계까지 넣어야 «같은 증빙 두 번»만 걸린다.
DUP_KEY = ('부서', '보고일자', '문서명', '수발신자', '업무단계명 (수정 가능)')


def norm(v):
    return '' if v is None else str(v).strip()


def norm_date(s):
    """'2025.01.02' → '2025-01-02'. 판독 불가는 원문 유지."""
    s = norm(s)
    m = re.match(r'^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\.?$', s)
    return '%s-%02d-%02d' % (m.group(1), int(m.group(2)), int(m.group(3))) if m else s


def load(path):
    import openpyxl
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb['문서목록']
    hdr, rows = None, []
    for r in ws.iter_rows(min_row=4, values_only=True):
        if hdr is None:
            hdr = [norm(x) for x in r]
            continue
        if r[0] is None and r[1] is None:
            continue
        rows.append(r)
    i = {h: k for k, h in enumerate(hdr) if h}
    return [{h: norm(r[i[h]]) for h in i} for r in rows]


def load_stage_map():
    """단계명 → 코드. 이름은 바뀌므로 **코드로** 저장한다(v3.3 에서 13건, v4.0 에서 1건이 바뀌었다)."""
    import subprocess
    js = ("global.window={};require('./js/doc-taxonomy-data.js');"
          "console.log(JSON.stringify(window.DYDOCT.STAGES.map(function(s){return [s.name,s.id];})));")
    r = subprocess.run(['node', '-e', js], cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit('분류기준을 읽지 못했습니다 — 먼저 build-taxonomy.py 를 돌리세요.\n' + r.stderr)
    return dict(json.loads(r.stdout))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--xlsx', required=True)
    a = ap.parse_args()

    rows = load(a.xlsx)
    smap = load_stage_map()
    print('문서목록 %d행 · 분류기준 단계명 %d종' % (len(rows), len(smap)))

    # 이름→코드 미매칭은 **치명적**이다 — 조용히 넘기면 그 단계가 통째로 0건이 된다
    miss = sorted({r['업무단계명 (수정 가능)'] for r in rows
                   if r['업무단계명 (수정 가능)'] and r['업무단계명 (수정 가능)'] not in smap})
    if miss:
        print('\n단계명→코드 미매칭 %d종 — 파일을 쓰지 않습니다:' % len(miss))
        for m in miss[:10]:
            print('  ·', m)
        sys.exit(1)

    seen, docs, dup = {}, [], 0
    for r in rows:
        key = tuple(r.get(k, '') for k in DUP_KEY)
        if key in seen:
            dup += 1
            continue
        seen[key] = 1
        nm = r['업무단계명 (수정 가능)']
        docs.append({
            'dept': r['부서'],
            'date': norm_date(r['보고일자']),
            'title': r['문서명'],
            'sr': r['수발신자'],
            'stage': smap.get(nm, ''),
            'dir': DIR_OF.get(r['발신구분'], ''),
            'conf': CONF_OF.get(r['분류확인'], ''),
            'excl': r.get('제외사유', ''),
            # 원문확인 3열 — 유형이 비면 나머지 둘도 싣지 않는다(유형 없는 행에 값이 있는 경우는 0건 실측)
            'review': (r.get('원문 확인 필요', ''), r.get('원문에서 확인할 것', ''),
                       r.get('해당 시 업무단계 (후보)', '')) if r.get('원문 확인 필요') else None,
        })

    print('중복 제거 %d행 → 문서 %d건' % (dup, len(docs)))
    mapped = sum(1 for d in docs if d['stage'])
    print('  단계 매핑 %d (%d%%) · 미매핑 %d' % (mapped, round(mapped / len(docs) * 100), len(docs) - mapped))
    print('  방향 :', dict(Counter(d['dir'] or '(빈)' for d in docs)))
    print('  분류확인 :', dict(Counter(d['conf'] or '(빈)' for d in docs)))
    print('  제외사유 :', dict(Counter(d['excl'] for d in docs if d['excl'])))
    print('  부서 %d개' % len({d['dept'] for d in docs}))
    rv = [d for d in docs if d['review']]
    print('  원문 확인 필요 %d건 · 유형 %d종 (단계 있음 %d · 미연결 %d · 제외 %d)' % (
        len(rv), len({d['review'][0] for d in rv}),
        sum(1 for d in rv if d['stage']), sum(1 for d in rv if not d['stage'] and not d['excl']),
        sum(1 for d in rv if d['excl'])))

    # ── 사전 + 배열 ────────────────────────────────────────────────────────
    depts = sorted({d['dept'] for d in docs})
    srs = sorted({d['sr'] for d in docs})
    stgs = sorted({d['stage'] for d in docs if d['stage']})
    excs = sorted({d['excl'] for d in docs if d['excl']})
    revs = sorted({d['review'] for d in docs if d['review']})
    di = {v: i for i, v in enumerate(depts)}
    si = {v: i for i, v in enumerate(srs)}
    gi = {v: i for i, v in enumerate(stgs)}
    ei = {v: i for i, v in enumerate(excs)}
    vi = {v: i for i, v in enumerate(revs)}
    DIRI = {'in': 0, 'out': 1, 'internal': 2}
    CONFI = {'sure': 0, 'weak': 1, 'vague': 2}
    rec = [[d['title'], di[d['dept']], d['date'][5:].replace('-', ''),
            si[d['sr']], DIRI.get(d['dir'], -1),
            gi.get(d['stage'], -1), CONFI.get(d['conf'], -1),
            ei.get(d['excl'], -1), vi.get(d['review'], -1)] for d in docs]

    meta = {
        'source': os.path.basename(a.xlsx), 'sheet': '문서목록', 'year': YEAR,
        'rows': len(rows), 'docs': len(docs), 'dupRowsRemoved': dup,
        'depts': len(depts), 'mapped': mapped, 'unmapped': len(docs) - mapped,
        'dupKey': ' + '.join(DUP_KEY),
        'excluded': sum(1 for d in docs if d['excl']),
        'excludedKinds': excs,
        'reviewDocs': len(revs and [d for d in docs if d['review']]),
        'reviewKinds': len({d['review'][0] for d in docs if d['review']}),
    }
    hdr = '''/* =========================================================================
 * 2025년 업무문서 원장 — 20개 부서 %s건 (DYDOCH)
 *   ※ 생성물 — 손으로 고치지 말 것. 원본 엑셀을 고치고 재생성한다.
 *      생성기: tools/build-ledger-2025.py
 *      원본:   %s 「문서목록」
 *
 *   [종전과 다른 점] 재난안전과 3,830 → **20개 부서 %s**. 화면이 «부서별 이행
 *   판정은 아직 낼 수 없습니다» 라고 말해 온 근거가 사라진다 — L2 부서 단위가
 *   처음으로 실제 값을 갖는다.
 *
 *   [중복 판정] 부서+보고일자+문서명+수발신자+**업무단계**. 단계를 빼면 다른
 *   단계의 증빙까지 지워져 이행 판정이 떨어진다(초과분 7,113 vs 458).
 *
 *   [제외사유 %d건 · %s] 단계가 애초에 안 붙어 있어 이행 판정에는 안 들어가지만,
 *   지우지 않고 실어 문서 목록에서는 보이게 한다. v4.0 에서 적용 법령이 2종으로
 *   좁혀져 재난안전법·개별 시설법 문서가 「적용 법령 밖」으로 빠졌다.
 *
 *   [원문 확인 필요 %s건 · %d유형] 제목만으로 판정할 수 없어 원문을 열어 볼 문서.
 *   단계가 붙은 문서에도 붙는다 — 판정에는 들어가되 확인이 필요하다.
 *
 *   [분류확인] 확실 %s · 애매 %s · 모호 %s. **애매는 단계가 붙었는데 확신이
 *   낮은 것**이라 화면이 드러내야 한다(모호는 대개 미매핑과 겹친다).
 *
 *   [저장 형태] 사전(D 부서 · S 수발신자 · G 단계코드 · E 제외사유 · V 원문확인) + 배열.
 *   R 한 줄 = [제목, 부서i, MMDD, 수발신자i, 방향i, 단계i, 확신i, 제외i, 원문확인i].
 *   말미 로더가 레코드 객체로 되돌린다 — 화면은 종전과 같은 모양을 본다.
 * ========================================================================= */
''' % (('{:,}'.format(len(docs))), os.path.basename(a.xlsx), ('{:,}'.format(len(docs))),
       sum(1 for d in docs if d['excl']), ' · '.join(excs),
       '{:,}'.format(sum(1 for d in docs if d['review'])), len({d['review'][0] for d in docs if d['review']}),
       '{:,}'.format(sum(1 for d in docs if d['conf'] == 'sure')),
       '{:,}'.format(sum(1 for d in docs if d['conf'] == 'weak')),
       '{:,}'.format(sum(1 for d in docs if d['conf'] == 'vague')))

    body = 'window.DYDOCH = {\n  META: ' + json.dumps(meta, ensure_ascii=False, indent=2) + ',\n'
    for name, arr in (('D', depts), ('S', srs), ('G', stgs), ('E', excs)):
        body += '  %s: %s,\n' % (name, json.dumps(arr, ensure_ascii=False, separators=(',', ':')))
    # 원문확인 사전 — [유형, 원문에서 확인할 것, 해당 시 업무단계(후보)]. 한 줄에 하나(사람이 훑어볼 값이다)
    body += '  V: [\n' + ',\n'.join('    ' + json.dumps(list(v), ensure_ascii=False, separators=(',', ':')) for v in revs) + '\n  ],\n'
    # 한 줄에 20건씩 — 레코드마다 줄을 바꾸면 들여쓰기·줄바꿈만으로 3MB 가 더 붙는다
    # (실측 6.6MB → 3.5MB). 생성물이라 사람이 읽지 않지만, 한 줄에 전부 넣으면
    # diff 가 «1줄 변경»으로만 보여 무엇이 바뀌었는지 알 수 없다.
    body += '  R: [\n'
    chunks = []
    for k in range(0, len(rec), 20):
        chunks.append('    ' + ','.join(json.dumps(x, ensure_ascii=False, separators=(',', ':'))
                                        for x in rec[k:k + 20]))
    body += ',\n'.join(chunks)
    body += '\n  ]\n};\n'
    body += '''
/* 로더 — 사전을 펴서 종전과 같은 레코드 모양으로 되돌린다.
   화면(doc-progress.js build)은 이 DOCS 만 본다. */
(function (H) {
  var DIRS = ['in', 'out', 'internal'], CONFS = ['sure', 'weak', 'vague'];
  H.DOCS = H.R.map(function (r, i) {
    var mm = r[2];
    return {
      id: 'DOC-2025-' + ('000000' + (i + 1)).slice(-6),
      title: r[0],
      dept: H.D[r[1]] || '',
      date: '2025-' + mm.slice(0, 2) + '-' + mm.slice(2),
      sr: H.S[r[3]] || '',
      dir: DIRS[r[4]] || null,
      stageIds: r[5] >= 0 ? [H.G[r[5]]] : [],
      mapConf: CONFS[r[6]] || '',
      excluded: r[7] >= 0 ? H.E[r[7]] : '',
      /* 원문 확인 필요 — {type 유형, what 원문에서 확인할 것, cand 해당 시 업무단계(후보)}. 없으면 null */
      review: r[8] >= 0 ? { type: H.V[r[8]][0], what: H.V[r[8]][1], cand: H.V[r[8]][2] } : null,
      year: 2025,
      mapped: r[5] >= 0,
      src: 'onnara', st: '',
      assignee: '',
      dataMode: 'real', statusSource: 'ledger-2025'
    };
  });
}(window.DYDOCH));
'''
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(hdr + body)
    print('\n생성: %s (%.1f MB)' % (os.path.relpath(OUT, ROOT), os.path.getsize(OUT) / 1024 / 1024))


if __name__ == '__main__':
    main()
