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

  v5.1 + 확정문서목록 (2026-09-28) — 이행 판정의 정본이 바뀌었다
  ───────────────────────────────────────────────────────
  2025 이행 판정은 이제 「문서목록」의 업무단계 열이 아니라 **확정문서목록 2025
  시트**가 정한다(사용자 확정). 확정문서목록은 원문 확인까지 거쳐 «안전보건 이행
  증빙으로 확정된 문서만» 실은 목록이다.
    · 확정 목록에 있는 문서 → 그 목록의 단계코드(여러 개일 수 있다)가 붙는다
    · 문서목록에서는 단계가 붙었는데 확정 목록에 없는 문서 → **부서 확인 필요**.
      단계를 붙이지 않고(판정에서 빠진다) 문서목록이 적었던 단계를 후보로만 남긴다
    · 확정 목록에만 있고 문서목록에 없는 문서 → 확정 목록의 값으로 싣는다(지우면
      확정된 증빙이 사라진다). confirmedOnly 로 표시한다

  문서의 정체도 확정 목록과 맞췄다 — 부서+보고일자+문서명+수발신자 한 벌이 문서
  하나이고, 여러 단계의 증빙이면 stageIds 가 여럿이다. 종전에는 단계까지 키에
  넣어 한 문서가 단계 수만큼 레코드로 갈렸다(«문서 N건»이 부풀었다).

  실행: python3 tools/build-ledger-2025.py --xlsx <대시보드> --confirmed <확정문서목록>
"""

import argparse
import json
import os
import re
import sys
from collections import Counter, OrderedDict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import confirmed_list as CL  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'js', 'doc-history-data.js')

YEAR = 2025
DIR_OF = {'접수(외부)': 'in', '생산': 'out', '접수(내부)': 'internal'}
CONF_OF = {'확실': 'sure', '애매': 'weak', '모호': 'vague'}
# 문서의 정체 — 확정문서목록과 같은 키(위 «v5.1 + 확정문서목록» 참고).
# 단계는 키가 아니라 그 문서에 붙는 값이다.
DUP_KEY = CL.KEY
STAGE_COL = '업무단계명 (수정 가능)'


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
    ap.add_argument('--xlsx', required=True, help='문서분류 대시보드(「문서목록」 시트)')
    ap.add_argument('--confirmed', required=True, help='확정문서목록 연도별(2025 시트가 판정 정본)')
    a = ap.parse_args()

    rows = load(a.xlsx)
    smap = load_stage_map()
    sids = set(smap.values())
    print('문서목록 %d행 · 분류기준 단계명 %d종' % (len(rows), len(smap)))

    years, summary = CL.load(a.confirmed)
    bad, warn = CL.verify(years, summary, sids)
    if bad:
        CL.fail(bad, '확정문서목록')
    CL.report(warn)
    if YEAR not in years:
        CL.fail(['확정문서목록에 %d 시트가 없습니다' % YEAR], '확정문서목록')
    conf = years[YEAR]['docs']
    print('확정문서목록 %s — 문서 %d · 문서×단계 %d행 · 「요약」 행·문서·부서 재현 ✓' % (
        years[YEAR]['label'], len(conf), len(years[YEAR]['rows'])))

    # ── 문서목록을 문서 단위로 묶는다 (같은 키의 행은 값이 전부 같다 — 실측 불일치 0) ──
    groups = OrderedDict()
    for r in rows:
        groups.setdefault(CL.key_of(r), []).append(r)
    dup = len(rows) - len(groups)

    docs = []
    dept_check = 0
    for k, rs in groups.items():
        r = rs[0]
        led_names = []
        for x in rs:
            if x[STAGE_COL] and x[STAGE_COL] not in led_names:
                led_names.append(x[STAGE_COL])
        c = conf.get(k)
        if c:
            stages, cand, cf = list(c['stages']), None, 'sure'
        else:
            # 분류확인(확실·애매)은 **단계 연결의 확신**이다. 확정 목록이 연결을 정하므로
            # 연결이 없는 문서에 그 값을 남기면 «분류 확인 N건»이 연결 없는 문서로 부푼다.
            stages, cf = [], ''
            # 문서목록은 단계를 붙였는데 확정 목록에 없다 → 부서 확인 필요.
            # 후보는 코드로 남기고, 분류기준에 없는 이름(범위 밖 단계)은 이름 그대로 둔다.
            cand = tuple(smap.get(n, n) for n in led_names) if led_names else None
            if cand:
                dept_check += 1
        docs.append({
            'dept': r['부서'], 'date': CL.norm_date(r['보고일자']), 'title': r['문서명'], 'sr': r['수발신자'],
            'stages': stages, 'dir': DIR_OF.get(r['발신구분'], ''), 'conf': cf,
            'excl': '' if c else r.get('제외사유', ''),
            # 원문확인 3열 — 유형이 비면 나머지 둘도 싣지 않는다(유형 없는 행에 값이 있는 경우는 0건 실측)
            'review': (r.get('원문 확인 필요', ''), r.get('원문에서 확인할 것', ''),
                       r.get('해당 시 업무단계 (후보)', '')) if r.get('원문 확인 필요') else None,
            'cand': cand, 'only': 0,
        })

    # 확정 목록에만 있는 문서 — 확정된 증빙이므로 싣는다
    only = [k for k in conf if k not in groups]
    for k in only:
        r = conf[k]['row']
        docs.append({
            'dept': r['부서'], 'date': CL.norm_date(r['보고일자']), 'title': r['문서명'], 'sr': r['수발신자'],
            'stages': list(conf[k]['stages']), 'dir': DIR_OF.get(r['발신구분'], ''), 'conf': 'sure',
            'excl': '', 'review': None, 'cand': None, 'only': 1,
        })

    # ── 검증: 판정에 들어가는 문서가 확정 목록과 **정확히** 같아야 한다 ─────────────
    mapped_keys = {(d['dept'], d['date'], d['title'], d['sr']) for d in docs if d['stages']}
    conf_keys = {(k[0], CL.norm_date(k[1]), k[2], k[3]) for k in conf}
    pairs = sum(len(d['stages']) for d in docs)
    conf_pairs = sum(len(v['stages']) for v in conf.values())
    bad = []
    if mapped_keys != conf_keys:
        bad.append('판정 문서 %d ≠ 확정 목록 문서 %d' % (len(mapped_keys), len(conf_keys)))
    if pairs != conf_pairs:
        bad.append('문서×단계 %d ≠ 확정 목록 %d' % (pairs, conf_pairs))
    if any(s not in sids for d in docs for s in d['stages']):
        bad.append('분류기준에 없는 단계코드가 붙었습니다')
    if any(d['excl'] and d['stages'] for d in docs):
        bad.append('제외사유가 있는 문서에 단계가 붙었습니다')
    if bad:
        CL.fail(bad, '2025 원장')

    print('문서목록 %d행 → 문서 %d건 (같은 문서의 단계별 행 %d 병합) + 확정 목록에만 있는 문서 %d건' % (
        len(rows), len(groups), dup, len(only)))
    mapped = sum(1 for d in docs if d['stages'])
    print('  판정 문서(확정) %d · 문서×단계 %d · 부서 확인 필요 %d · 미분류 %d' % (
        mapped, pairs, dept_check,
        sum(1 for d in docs if not d['stages'] and not d['excl'] and not d['cand'])))
    print('  방향 :', dict(Counter(d['dir'] or '(빈)' for d in docs)))
    print('  분류확인 :', dict(Counter(d['conf'] or '(빈)' for d in docs)))
    print('  제외사유 :', dict(Counter(d['excl'] for d in docs if d['excl'])))
    print('  부서 %d개' % len({d['dept'] for d in docs}))
    rv = [d for d in docs if d['review']]
    print('  원문 확인 필요 %d건 · 유형 %d종 (단계 있음 %d · 미연결 %d · 제외 %d)' % (
        len(rv), len({d['review'][0] for d in rv}),
        sum(1 for d in rv if d['stages']), sum(1 for d in rv if not d['stages'] and not d['excl']),
        sum(1 for d in rv if d['excl'])))

    # ── 사전 + 배열 ────────────────────────────────────────────────────────
    depts = sorted({d['dept'] for d in docs})
    srs = sorted({d['sr'] for d in docs})
    stgs = sorted({s for d in docs for s in d['stages']})
    excs = sorted({d['excl'] for d in docs if d['excl']})
    revs = sorted({d['review'] for d in docs if d['review']})
    cands = sorted({d['cand'] for d in docs if d['cand']})
    di = {v: i for i, v in enumerate(depts)}
    si = {v: i for i, v in enumerate(srs)}
    gi = {v: i for i, v in enumerate(stgs)}
    ei = {v: i for i, v in enumerate(excs)}
    vi = {v: i for i, v in enumerate(revs)}
    ki = {v: i for i, v in enumerate(cands)}
    DIRI = {'in': 0, 'out': 1, 'internal': 2}
    CONFI = {'sure': 0, 'weak': 1, 'vague': 2}
    rec = []
    for d in docs:
        x = [d['title'], di[d['dept']], d['date'][5:].replace('-', ''),
             si[d['sr']], DIRI.get(d['dir'], -1),
             [gi[s] for s in d['stages']], CONFI.get(d['conf'], -1),
             ei.get(d['excl'], -1), vi.get(d['review'], -1)]
        if d['cand'] or d['only']:
            x += [ki[d['cand']] if d['cand'] else -1]
        if d['only']:
            x += [1]
        rec.append(x)

    meta = {
        'source': os.path.basename(a.xlsx), 'sheet': '문서목록', 'year': YEAR,
        'confirmed': os.path.basename(a.confirmed), 'confirmedSheet': years[YEAR]['sheet'],
        'rows': len(rows), 'docs': len(docs), 'dupRowsMerged': dup,
        'depts': len(depts), 'mapped': mapped, 'unmapped': len(docs) - mapped,
        'stagePairs': pairs, 'stagesLinked': len(stgs),
        'deptCheck': dept_check, 'confirmedOnly': len(only),
        'dupKey': ' + '.join(DUP_KEY),
        'excluded': sum(1 for d in docs if d['excl']),
        'excludedKinds': excs,
        'reviewDocs': len(rv),
        'reviewKinds': len({d['review'][0] for d in rv}),
    }
    hdr = '''/* =========================================================================
 * 2025년 업무문서 원장 — 20개 부서 %s건 (DYDOCH)
 *   ※ 생성물 — 손으로 고치지 말 것. 원본 엑셀을 고치고 재생성한다.
 *      생성기: tools/build-ledger-2025.py
 *      원본:   %s 「문서목록」 + %s 「%s」
 *
 *   [이행 판정의 정본] 확정문서목록 2025 시트다. 거기 있는 문서 %s건에만 단계가
 *   붙는다(문서×단계 %s · 연결 단계 %d개). 문서목록은 단계를 붙였는데 확정 목록에
 *   없는 문서 %s건은 **부서 확인 필요** — 단계 없이 후보(K)로만 남는다.
 *   확정 목록에만 있고 문서목록에 없는 문서 %s건은 확정 목록 값으로 싣는다.
 *
 *   [문서의 정체] 부서+보고일자+문서명+수발신자. 여러 단계의 증빙이면 단계가
 *   여럿 붙는다(확정문서목록 「요약」의 문서 수와 같은 키).
 *
 *   [제외사유 %s건 · %s] 단계가 애초에 안 붙어 있어 이행 판정에는 안 들어가지만,
 *   지우지 않고 실어 문서 목록에서는 보이게 한다.
 *
 *   [원문 확인 필요 %s건 · %d유형] 제목만으로 판정할 수 없어 원문을 열어 볼 문서.
 *
 *   [저장 형태] 사전(D 부서 · S 수발신자 · G 단계코드 · E 제외사유 · V 원문확인 ·
 *   K 부서 확인 후보) + 배열. R 한 줄 = [제목, 부서i, MMDD, 수발신자i, 방향i,
 *   [단계i…], 확신i, 제외i, 원문확인i, (후보i), (확정 목록에만 있음 1)].
 *   말미 로더가 레코드 객체로 되돌린다 — 화면은 종전과 같은 모양을 본다.
 * ========================================================================= */
''' % ('{:,}'.format(len(docs)), os.path.basename(a.xlsx), os.path.basename(a.confirmed), years[YEAR]['sheet'],
       '{:,}'.format(mapped), '{:,}'.format(pairs), len(stgs), '{:,}'.format(dept_check), '{:,}'.format(len(only)),
       '{:,}'.format(sum(1 for d in docs if d['excl'])), ' · '.join(excs),
       '{:,}'.format(len(rv)), len({d['review'][0] for d in rv}))

    body = 'window.DYDOCH = {\n  META: ' + json.dumps(meta, ensure_ascii=False, indent=2) + ',\n'
    for name, arr in (('D', depts), ('S', srs), ('G', stgs), ('E', excs)):
        body += '  %s: %s,\n' % (name, json.dumps(arr, ensure_ascii=False, separators=(',', ':')))
    # 원문확인 사전 — [유형, 원문에서 확인할 것, 해당 시 업무단계(후보)]. 한 줄에 하나(사람이 훑어볼 값이다)
    body += '  V: [\n' + ',\n'.join('    ' + json.dumps(list(v), ensure_ascii=False, separators=(',', ':')) for v in revs) + '\n  ],\n'
    # 부서 확인 후보 — 문서목록이 적었던 단계(코드, 분류기준에 없으면 이름 그대로)
    body += '  K: ' + json.dumps([list(v) for v in cands], ensure_ascii=False, separators=(',', ':')) + ',\n'
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
      stageIds: r[5].map(function (g) { return H.G[g]; }),
      mapConf: CONFS[r[6]] || '',
      excluded: r[7] >= 0 ? H.E[r[7]] : '',
      /* 원문 확인 필요 — {type 유형, what 원문에서 확인할 것, cand 해당 시 업무단계(후보)}. 없으면 null */
      review: r[8] >= 0 ? { type: H.V[r[8]][0], what: H.V[r[8]][1], cand: H.V[r[8]][2] } : null,
      /* 부서 확인 필요 — 문서목록은 단계를 붙였는데 확정 목록에 없다. 판정에서 빠지고
         후보만 남는다({cand:[단계코드 또는 이름]}). 없으면 null */
      deptCheck: r.length > 9 && r[9] >= 0 ? { cand: H.K[r[9]].slice() } : null,
      /* 확정 목록에만 있고 문서목록에는 없는 문서 */
      confirmedOnly: r[10] === 1,
      year: 2025,
      mapped: r[5].length > 0,
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
