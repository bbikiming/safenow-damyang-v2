#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
업무문서 시드 생성기 — 담양군 원자료 CSV 2종 → js/doc-taxonomy-data.js · js/doc-history-data.js

  근거: docs/planning/프롬프트-업무문서-이행목록-업무목록-리뉴얼-v2.md §9

사용법 (개인 경로를 코드에 박지 않는다 — 인자로 받는다):

    python3 tools/build-docs-seed.py \
        --taxonomy ~/Downloads/담양군_안전보건_문서분류기준_v2.csv \
        --history  ~/Downloads/2025년_재난안전과_문서목록.csv \
        --outdir   js

생성물은 **생성물이다** — 손으로 고치지 않는다(법령 스냅샷 js/law-map.js 와 같은 원칙).
내용이 틀렸으면 원본 CSV 를 고치고 이 스크립트를 다시 돌린다.

검증값(§9-3)이 하나라도 어긋나면 파일을 쓰지 않고 종료한다.
"""

import argparse
import csv
import io
import json
import os
import re
import sys
from collections import Counter, OrderedDict, defaultdict

# ── §9-3 변환 검증값 — 이 값이 안 나오면 조용히 진행하지 않는다 ──────────────
# 2026-08-18 갱신 — 분류기준 CSV v2 반영(78→80 항목 / 168→177 단계).
#   종전 값은 v2 이전 CSV 기준이라 **FAC-15(공중이용시설 개별 안전 관계 법령) 4단계 ·
#   FAC-16(유해화학물질 취급시설 안전관리) 4단계 · OSH-11-03(MSDS) 1단계**가 통째로
#   빠져 있었다. 하필 이 9개가 5개 부서 분류 1차 결과에서 «문서 0건 불이행 의심»·
#   «근거 취약»으로 지목된 항목이라, 화면에 존재하지 않아 누락 점검에 뜨지 않았다.
#   문서 원장 쪽 검증값 6종(history_rows·docs·dup_rows·multi_stage_docs·max_stages·
#   unmapped_rows)은 **변화 없음** — 분류 축만 넓어진 안전한 확장이다.
#   stages_no_doc 33→42 는 새로 들어온 9단계가 전부 2025 문서 0건이기 때문이다.
EXPECT = {
    'items': 80,            # 법정 이행항목
    'stages': 177,          # 하위 업무단계
    'history_rows': 4082,   # 2025 원본 매핑 행
    'docs': 3830,           # 복합키 기준 문서 엔터티
    'dup_rows': 24,         # 완전 중복 매핑 행
    'multi_stage_docs': 210,  # 여러 업무단계에 연결된 문서
    'max_stages': 11,       # 문서 1건의 최대 업무단계 수
    'unmapped_rows': 35,    # 이행항목·업무단계가 빈 원본 행
    'stages_no_doc': 42,    # 2025 문서가 확인되지 않은 업무단계
}

# 취합상태 → 2025년 업무단계 진행상태.
#   시연값 합성이 아니라 원자료 `취합상태` 컬럼의 투영이다. 실제로 이 파생은
#   문서 존재 여부와 정합한다 — 확인됨119+보완필요16 = 2025 확인단계 135,
#   취합대상26+조건부7 = 2025 문서없는 단계 33 (build 시 assert 로 검증).
COLLECT_TO_STATUS = {
    '확인됨': 'complete',
    '보완필요(3건 이하)': 'in_progress',
    '취합대상(문서 미확인)': 'not_started',
    '조건부(해당 시 취합)': 'na',
}

# 시연 문서 출처 — §9-4. 문서 ID 해시로 **결정적** 배정한다(Math.random 금지).
DEMO_SOURCES = ['onnara', 'electronic', 'upload']
# 출처별 허용 상태 (§8-7). 서로 다른 출처의 상태를 공통 단계로 환산하지 않는다.
DEMO_STATUS = {
    'onnara': ['결재중', '결재완료', '반려'],
    'electronic': ['작성중', '등록완료', '확정'],
    'upload': ['검토대기', '확인완료'],
}


def norm(s):
    """공백·개행 정규화. None·빈 문자열은 ''."""
    if s is None:
        return ''
    return re.sub(r'\s+', ' ', str(s)).strip()


def parse_paths(raw):
    """수행경로 문자열 → [{'type':..,'code':..}]. 빈 값이면 []."""
    out = []
    for tok in [t.strip() for t in norm(raw).split('|') if t.strip()]:
        if ':' in tok:
            t, c = tok.split(':', 1)
        else:
            t, c = tok, ''
        t = t.strip().upper()
        if t not in ('PROGRAM', 'ELECTRONIC_DOC', 'ATTACHMENT'):
            continue
        out.append({'type': t, 'code': c.strip()})
    return out


def parse_done(raw):
    """완료판정 문자열 → {'kind':..,'key':..}. 빈 값이면 DOC_COUNT."""
    v = norm(raw)
    if not v:
        return {'kind': 'DOC_COUNT', 'key': ''}
    if ':' in v:
        k, key = v.split(':', 1)
        return {'kind': k.strip().upper(), 'key': key.strip()}
    return {'kind': v.upper(), 'key': ''}


def stage_type_fields(r):
    """v3 추가 8열 → JS 필드. 열 자체가 없는 구버전 CSV 도 그대로 통과한다."""
    g = lambda k: norm(r.get(k, ''))
    paths = parse_paths(g('수행경로'))
    conf = (g('분류확신도') or 'UNKNOWN').upper()
    lvl = g('적용수준').upper()
    dept = g('대상부서규칙')
    out = {
        'paths': paths,
        'taskType': paths[0]['type'] if paths else 'UNKNOWN',
        'doneRule': parse_done(g('완료판정')),
        'typeConf': conf if conf in ('CONFIRMED', 'DRAFT', 'UNKNOWN') else 'UNKNOWN',
        'typeNote': g('확인필요사유'),
    }
    # ② 증빙 필수 여부는 **받은 값만** 싣는다.
    #    종전에는 `!= 'N'` 이라 **빈값이 True** 가 됐다 — 177행 전부 빈 CSV 에서
    #    «전건 증빙 필수»가 만들어진다. 같은 함수의 다른 세 열(적용수준·대상부서
    #    규칙·주기적용시작연도)은 «없으면 필드를 안 만든다»로 처리하는데 이것만
    #    비대칭이었다. 받지 않은 값을 단정하지 않는다.
    ev = g('증빙필수여부').upper()
    if ev in ('Y', 'N'):
        out['evidenceRequired'] = (ev == 'Y')
    if lvl in ('L1', 'L2', 'L3'):
        out['levelSrc'] = lvl
    if dept:
        k, _, key = dept.partition(':')
        out['deptRule'] = {'kind': k.strip().upper(), 'key': key.strip()}
    y = g('주기적용시작연도')
    if y.isdigit():
        out['cycleFrom'] = int(y)
    return out



def norm_date(s):
    """'2025.02.12' · '2025-02-12' · '2025/02/12' → '2025-02-12'. 판독 불가는 원문 유지."""
    s = norm(s)
    m = re.match(r'^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\.?$', s)
    if not m:
        return s
    return '%04d-%02d-%02d' % (int(m.group(1)), int(m.group(2)), int(m.group(3)))


def split_multi(s):
    """'산업안전보건법 제36조, 중대재해처벌법 시행령 제4조제3호' → 목록. 조문 안의
    쉼표까지 쪼개면 근거가 망가지므로 '법/령/규칙' 이름이 다시 시작하는 지점에서만 나눈다."""
    s = norm(s)
    if not s:
        return []
    parts = re.split(r',\s*(?=[가-힣]{2,}(?:법|령|규칙|기준|고시|조례)\b|「)', s)
    return [p.strip(' ,') for p in parts if p.strip(' ,')]


def fnv1a(s):
    """FNV-1a 32bit — 결정적 해시. 파이썬 hash() 는 실행마다 시드가 달라 못 쓴다."""
    h = 0x811c9dc5
    for b in s.encode('utf-8'):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def read_csv(path):
    with io.open(path, 'r', encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


# ─────────────────────────────────────────────────────────────────────────────
def build_taxonomy(rows, report):
    """분류 기준 CSV → 이행항목 78 · 업무단계 168"""
    items = OrderedDict()
    stages = []
    seen_stage = set()

    for r in rows:
        iid = norm(r['이행항목코드'])
        sid = norm(r['업무단계코드'])
        if sid in seen_stage:
            report.append('업무단계코드 중복: %s' % sid)
        seen_stage.add(sid)

        law = norm(r['법령근거'])
        op = norm(r['재난안전과 운영주기(참고)'])
        collect = norm(r['취합상태'])

        if iid not in items:
            items[iid] = {
                'id': iid,
                'name': norm(r['법정 이행항목명']),
                'stageIds': [],
                'lawBases': [],
                'targets': [],
                'actors': [],
                'hasCycle': False,
            }
        it = items[iid]
        it['stageIds'].append(sid)
        for lb in split_multi(law):
            if lb not in it['lawBases']:
                it['lawBases'].append(lb)
        tgt = norm(r['적용대상'])
        if tgt and tgt not in it['targets']:
            it['targets'].append(tgt)
        act = norm(r['이행주체'])
        if act and act not in it['actors']:
            it['actors'].append(act)
        if op:
            it['hasCycle'] = True

        if collect not in COLLECT_TO_STATUS:
            report.append('알 수 없는 취합상태: %r (%s)' % (collect, sid))

        stages.append({
            'id': sid,
            'itemId': iid,
            'name': norm(r['하위 업무단계명']),
            'law': law,
            'legalCycle': norm(r['법정주기']),
            'opCycle': op,
            'timing': norm(r['수행시점조건']),
            # ── 업무유형 축(v3 추가 8열) — 전부 **override** 다. 비어 있으면 현행 동작 그대로.
            #    근거: docs/planning/기획-업무유형-완료판정-그릇설계-v1.md
            #    · paths[]  : 수행경로. 첫 토큰이 주 CTA. 빈 값이면 taskType='UNKNOWN'
            #    · doneRule : 완료판정 키. 빈 값이면 DOC_COUNT(현행 문서수 판정)
            #    · typeConf : CONFIRMED(발주처 확정) / DRAFT(개발측 초안) / UNKNOWN
            #    · levelSrc : 적용수준이 채워지면 문자열 파생(levelOf) 대신 이 값을 쓴다
            **stage_type_fields(r),
            'target': tgt,
            'actor': act,
            'ex': norm(r['증빙문서 예시(2025년 실제 문서명)']),
            'docs2025': int(norm(r['2025년 재난안전과 확인문서수']) or 0),
            'collect': collect,
            # 2025년 진행상태 — 취합상태의 투영(합성 아님)
            'st2025': COLLECT_TO_STATUS.get(collect, 'not_started'),
        })

    return list(items.values()), stages


# ─────────────────────────────────────────────────────────────────────────────
def build_history(rows, items, stages, report):
    """2025 문서 CSV → 문서 엔터티 3,830 + 문서↔업무단계 매핑"""
    by_name = {s['name']: s for s in stages}
    item_of_stage = {s['name']: s['itemId'] for s in stages}
    items_name = {it['id']: it['name'] for it in items}

    # 완전 중복 매핑 행 제거(§9-2 9) — 다중 업무단계 매핑은 보존.
    #   ※ 판정은 **원문 strip 만** 한다. 내부 공백까지 접으면(norm) 제목의 이중
    #     공백이 다른 문서를 합쳐 §9-3 검증값(4,082→3,830·중복24)이 어긋난다.
    seen_rows = set()
    dup_rows = 0
    kept = []
    for r in rows:
        sig = tuple((r.get(c) or '').strip() for c in
                    ('법정 이행항목명', '업무단계명', '현재주기', '문서명', '수발신자', '보고일자'))
        if sig in seen_rows:
            dup_rows += 1
            continue
        seen_rows.add(sig)
        kept.append(r)

    # 복합키 `문서명|수발신자|보고일자` 로 문서 엔터티 생성 (strip 만 — 위와 같은 이유).
    # 보고일자는 원본이 전부 'YYYY.MM.DD' 10자로 균일해 ISO 변환이 무손실이다.
    groups = defaultdict(list)
    for r in kept:
        k = ((r['문서명'] or '').strip(), (r['수발신자'] or '').strip(), norm_date(r['보고일자']))
        groups[k].append(r)

    # 근사 중복 — 제목의 내부 공백만 다른 별개 엔터티. 지어낸 중복이 아니라 원자료가
    # 실제로 가진 오염이고, 관리자 '중복 교정' 흐름(FT-09)의 대상이 된다.
    near = defaultdict(list)
    for k in groups:
        near[(norm(k[0]), norm(k[1]), k[2])].append(k)
    near_dup = {k: ks for ks in near.values() if len(ks) > 1 for k in ks}

    # 안정적 ID — 정렬된 복합키 기준(§2-3). 재생성해도 같은 문서는 같은 ID.
    keys = sorted(groups.keys(), key=lambda k: (k[2], k[0], k[1]))

    # 근사 중복 그룹 → 대표 문서 ID 를 서로 가리키게 하려면 ID 부여 후 다시 훑는다
    id_of = {k: 'DOC-2025-%04d' % i for i, k in enumerate(keys, 1)}

    docs = []
    unmapped_rows = 0
    for k in keys:
        title, sr, date = k
        rs = groups[k]
        stage_ids = []
        for r in rs:
            sn = norm(r['업무단계명'])
            if not sn or not norm(r['법정 이행항목명']):
                unmapped_rows += 1
                continue
            st = by_name.get(sn)
            if st is None:
                report.append('분류 기준에 없는 업무단계명: %r' % sn)
                continue
            # 원본 이행항목명이 분류 기준과 어긋나면 분류 기준을 정본으로 삼고 보고
            want = item_of_stage.get(sn)
            if want and norm(r['법정 이행항목명']) != items_name.get(want, ''):
                report.append('항목-단계 불일치(분류 기준 우선): %r ← %r' % (sn, norm(r['법정 이행항목명'])))
            if st['id'] not in stage_ids:
                stage_ids.append(st['id'])

        cycles = [norm(r['현재주기']) for r in rs if norm(r['현재주기'])]
        d = {
            'id': id_of[k],
            'title': title,
            'sr': sr,                      # 수발신자 — 대부분 외부 발신기관이다
            'date': date,
            'stageIds': stage_ids,
            'cycle': cycles[0] if cycles else '',
            'mapped': bool(stage_ids),
        }
        # 근사 중복이면 같은 그룹의 다른 문서 ID 를 남긴다(관리자 교정 대상)
        if k in near_dup:
            d['nearDup'] = [id_of[o] for o in near_dup[k] if o != k]
        docs.append(d)

    # §2-2·§9-3 의 '미분류 35행'은 **원본 행** 기준이다. 위 unmapped_rows 는 완전중복
    # 제거 뒤 남은 수(34)이고, 차이 1행은 미분류 행이면서 동시에 완전중복이었다.
    unmapped_raw = sum(1 for r in rows
                       if not (r['법정 이행항목명'] or '').strip() or not (r['업무단계명'] or '').strip())
    if unmapped_raw != unmapped_rows:
        report.append('미분류 원본 %d행 중 %d행이 완전중복이라 제거됨(엔터티 %d건 유지)'
                      % (unmapped_raw, unmapped_raw - unmapped_rows,
                         sum(1 for d in docs if not d['mapped'])))
    return docs, dup_rows, unmapped_raw


def enrich_demo(docs):
    """§9-4 시연 보강 — 문서 ID 해시로 출처·상태를 **고정** 배정.
    원본 CSV 필드(title/sr/date/stageIds)는 건드리지 않고 별도 필드로만 얹는다.
    dataMode·statusSource 는 3,830건 전부 같은 값이라 파일에 반복해 쓰지 않고
    생성물 말미의 로더가 레코드마다 찍는다(§9-4-3 계약은 런타임에서 그대로 성립)."""
    for d in docs:
        h = fnv1a(d['id'])
        src = DEMO_SOURCES[h % len(DEMO_SOURCES)]
        pool = DEMO_STATUS[src]
        d['src'] = src
        d['st'] = pool[(h >> 8) % len(pool)]
    return docs


def compact(d):
    """빈 값·파생 가능한 필드를 빼고 직렬화 — 3,830건이라 필드 하나가 수십 KB다.
    로더가 기본값을 되채운다."""
    o = OrderedDict()
    o['id'] = d['id']
    o['title'] = d['title']
    if d['sr']:
        o['sr'] = d['sr']
    o['date'] = d['date']
    if d['stageIds']:
        o['stageIds'] = d['stageIds']      # 없으면 미분류 — 로더가 [] 로 채운다
    if d['cycle']:
        o['cycle'] = d['cycle']
    if d.get('nearDup'):
        o['nearDup'] = d['nearDup']
    o['src'] = d['src']
    o['st'] = d['st']
    return o


# ─────────────────────────────────────────────────────────────────────────────
JS_HEAD = '''/* =========================================================================
 * %(title)s
 *   ※ 생성물 — 손으로 고치지 말 것. 원본 CSV 를 고치고 재생성한다.
 *      생성기: tools/build-docs-seed.py
 *      원본:   %(src)s
 *      기획:   docs/planning/프롬프트-업무문서-이행목록-업무목록-리뉴얼-v2.md §9
 *
%(note)s * ========================================================================= */
'''


def write_js(path, title, src, note, body):
    head = JS_HEAD % {'title': title, 'src': src,
                      'note': ''.join(' *   %s\n' % l for l in note)}
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(head)
        f.write(body)
    return os.path.getsize(path)


def dumps(o, indent=None):
    return json.dumps(o, ensure_ascii=False, separators=(',', ':'), indent=indent)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--taxonomy', required=True, help='담양군_안전보건_문서분류기준_v2.csv')
    ap.add_argument('--history', required=True, help='2025년_재난안전과_문서목록.csv')
    ap.add_argument('--outdir', default='js')
    ap.add_argument('--funcs', help='업무기능코드표 CSV(선택) — 없으면 수행경로의 기능코드를 그대로 둔다')
    ap.add_argument('--force', action='store_true', help='검증값 불일치여도 기록')
    a = ap.parse_args()

    report = []
    trows = read_csv(a.taxonomy)
    hrows = read_csv(a.history)

    items, stages = build_taxonomy(trows, report)
    docs, dup_rows, unmapped_rows = build_history(hrows, items, stages, report)

    stage_ids_with_doc = set()
    for d in docs:
        for s in d['stageIds']:
            stage_ids_with_doc.add(s)

    got = {
        'items': len(items),
        'stages': len(stages),
        'history_rows': len(hrows),
        'docs': len(docs),
        'dup_rows': dup_rows,
        'multi_stage_docs': sum(1 for d in docs if len(d['stageIds']) > 1),
        'max_stages': max(len(d['stageIds']) for d in docs),
        'unmapped_rows': unmapped_rows,
        'stages_no_doc': sum(1 for s in stages if s['id'] not in stage_ids_with_doc),
    }

    print('── §9-3 변환 검증값 ' + '─' * 40)
    bad = []
    for k in EXPECT:
        ok = got[k] == EXPECT[k]
        if not ok:
            bad.append(k)
        print('  %-18s 기대 %-6s 실제 %-6s %s' % (k, EXPECT[k], got[k], 'OK' if ok else '### 불일치'))

    # 취합상태 파생이 문서 존재와 정합한지 — 파생이 임의값이 아님의 증거
    st_by_collect = Counter(s['st2025'] for s in stages)
    nodoc_status = Counter(s['st2025'] for s in stages if s['id'] not in stage_ids_with_doc)
    print('  2025 파생 상태     %s' % dict(st_by_collect))
    print('  문서없는 단계 상태 %s' % dict(nodoc_status))
    if set(nodoc_status) - {'not_started', 'na'}:
        report.append('문서가 없는 단계에 완료/진행중 상태가 붙었다 — 파생 규칙 재검토')

    for m in report:
        print('  [보고] %s' % m)

    if bad and not a.force:
        print('\n검증값 %s 불일치 — 파일을 쓰지 않고 종료합니다(§9-3).' % ', '.join(bad))
        return 1

    enrich_demo(docs)

    os.makedirs(a.outdir, exist_ok=True)

    # ── 1) 분류 (이행항목 78 · 업무단계 168) ──
    tax_body = (
        'window.DYDOCT = {\n'
        '  META: %s,\n'
        '  ITEMS: %s,\n'
        '  STAGES: %s\n'
        '};\n' % (
            dumps({'source': os.path.basename(a.taxonomy), 'items': len(items),
                   'stages': len(stages), 'statusFrom': '취합상태'}, indent=2),
            '[\n' + ',\n'.join('    ' + dumps(x) for x in items) + '\n  ]',
            '[\n' + ',\n'.join('    ' + dumps(x) for x in stages) + '\n  ]',
        ))
    n1 = write_js(os.path.join(a.outdir, 'doc-taxonomy-data.js'),
                  '업무문서 분류 — 법정 이행항목 78 · 하위 업무단계 168 (DYDOCT)',
                  os.path.basename(a.taxonomy),
                  ['ITEMS[].hasCycle : 재난안전과 운영주기가 있는 업무단계를 하나라도 가졌는가',
                   '                   — 이행항목 진행률 바의 **노출 조건**으로만 쓴다(D-02).',
                   'STAGES[].st2025  : 2025년 진행상태. 원자료 `취합상태` 의 투영이며 합성이 아니다.',
                   '                   확인됨→완료 / 보완필요→진행중 / 취합대상→미이행 / 조건부→해당없음.'],
                  tax_body)

    # ── 2) 2025 문서 원장 + 매핑 ──
    hist_body = (
        'window.DYDOCH = {\n'
        '  META: %s,\n'
        '  DOCS: [\n%s\n  ]\n'
        '};\n'
        '/* 로더 — 빈 값으로 생략된 필드와 시연 메타를 레코드마다 되채운다(§9-4-3). */\n'
        '(function (L) {\n'
        '  for (var i = 0; i < L.length; i++) {\n'
        '    var d = L[i];\n'
        '    if (!d.sr) d.sr = "";\n'
        '    if (!d.stageIds) d.stageIds = [];\n'
        '    if (!d.cycle) d.cycle = "";\n'
        '    d.mapped = d.stageIds.length > 0;\n'
        '    d.year = 2025;\n'
        '    d.dataMode = "demo";\n'
        '    d.statusSource = "demo-seed";\n'
        '  }\n'
        '}(window.DYDOCH.DOCS));\n' % (
            dumps({'source': os.path.basename(a.history), 'year': 2025,
                   'rows': len(hrows), 'docs': len(docs), 'dupRowsRemoved': dup_rows,
                   'unmappedRows': unmapped_rows,
                   'unmappedDocs': sum(1 for d in docs if not d['mapped']),
                   'nearDupDocs': sum(1 for d in docs if d.get('nearDup')),
                   'demoSources': DEMO_SOURCES, 'demoStatus': DEMO_STATUS,
                   'hash': 'FNV-1a 32bit(문서 ID)'}, indent=2),
            ',\n'.join('    ' + dumps(compact(x)) for x in docs),
        ))
    n2 = write_js(os.path.join(a.outdir, 'doc-history-data.js'),
                  '2025년 재난안전과 문서 원장 — 문서 엔터티 3,830 + 업무단계 매핑 (DYDOCH)',
                  os.path.basename(a.history),
                  ['DOCS[].stageIds : 문서↔업무단계 다대다 매핑. 문서 1건이 최대 11개 단계에 걸린다.',
                   '                  빈 배열 = 원본에 분류가 없던 건(미분류) — 지우지 않는다.',
                   'DOCS[].sr       : 수발신자. 상위 값이 전라남도 자연재난과·사회재난과로',
                   '                  **외부 발신기관**이지 담당자가 아니다. 부서 축으로 쓰지 말 것.',
                   'DOCS[].src/st   : 시연 보강값(§9-4). dataMode:"demo" 로 원자료와 구분한다.',
                   '                  문서 ID FNV-1a 해시 기반이라 새로고침해도 바뀌지 않는다.',
                   '실서비스에서는 온나라·전자문서·파일관리 어댑터의 원천 상태로 대체한다.'],
                  hist_body)

    print('\n생성: %s/doc-taxonomy-data.js (%.0f KB)' % (a.outdir, n1 / 1024))
    print('생성: %s/doc-history-data.js  (%.0f KB)' % (a.outdir, n2 / 1024))
    print('시연 출처 분포: %s' % dict(Counter(d['src'] for d in docs)))
    print('시연 상태 분포: %s' % dict(Counter(d['st'] for d in docs)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
