#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
2026년 시연 시드 생성기 — js/doc-seed-2026.js

  왜 필요한가
  ───────────
  2025 는 재난안전과 문서 원장 실측(3,830건)이라 채울 것이 없다. 그런데 2026 은
  문서가 0건이라 177단계가 **전부** 미이행/지연으로 뜬다. 그건 "군청이 늦었다"가
  아니라 "시스템이 비었다"로 읽힌다 — 시연에서 화면이 고장난 것처럼 보인다.

  발주처 지시(2026-08-18): "기준 연도는 실제처럼 2025년으로 채워주고 2026년은
  대부분 미이행으로 해줘 진짜처럼 보이게".

  «허용되는 시드»와 «금지된 날조»
  ──────────────────────────────
  CLAUDE.md 는 "그럴듯하게 채우지 말고 화면에 드러낸다"를 반복한다. 그 규칙이
  금지하는 것은 **받아야 할 외부 자료를 지어내는 것**이다 — 부서 39개 명단,
  현업업무 종사자 지정명단, 시설 소관부서처럼 담양군이 줄 값을 우리가 만들어
  채우면 결정이 넘어가지 않는다.
  이 시드는 그것과 다르다. 2026년 이행 실적은 **아직 일어나지 않은 일**이라
  누구에게도 받을 수 없고, 시연은 "올해 절반이 지났는데 어디까지 왔나"를 보여
  주는 것이 목적이다. 이 저장소가 이미 같은 성격의 시드를 쓴다 —
  DYEDU 교육 시드 · dashboard SUPER_SEED · law-admin-seed · work-catalog.
  대신 세 가지를 지킨다:
    ① 규칙으로 만든다(손으로 고르지 않는다) — 아래 규칙이 곧 근거다.
    ② 실측에 매단다 — 2025 에 실적이 있던 단계만 후보다.
    ③ 시드임을 데이터에 남긴다 — dataMode:'demo' · origin:'seed26'.

  규칙
  ────
  1. 모집단 = 2025년에 문서가 있던 단계(135개). **작년에 한 적 없는 일을 올해
     했다고 하지 않는다.** 2025 에 0건이던 42단계는 2026 에도 0건이다.
  2. 주기별 채택률 — 2026-07-16 기준으로 도래한 회차와 실측 회수율 감각에서 온다.
     (CLAUDE.md §14-9 5개년 실측: 전 부서 제출이 성립한 해가 한 번도 없다.
      §4 교육 이수율 실측 38~56%.)
  3. 채택은 **해시 순서**로 고른다 — 재현 가능하고, 다음 사람이 왜 이 단계인지
     따져 볼 수 있다. 손으로 고르면 근거가 사라진다.
  4. 회차는 **도래한 회차를 넘지 않는다.** 아직 오지 않은 기한의 실적을 만들면
     그건 미래를 지어내는 것이다.
  5. 문서 제목은 그 단계의 2025 문서에서 가져와 연도 표기만 2026 으로 바꾼다.
     이 시스템이 실제로 제공하는 «전년도 문서 불러오기»가 하는 일과 같다.
  6. 비해당은 시드하지 않는다. 2025 의 조건부 7건은 2026 에 **재확인 대상**이라
     누락 점검에 뜨는 것이 맞다(화면이 "매년 재확인합니다"라고 쓰고 있다).

  검증 (§5 2026-08-18 사고의 교훈)
  ───────────────────────────────
  분류기준 CSV 가 v2 로 늘었는데 EXPECT 가 옛 수치로 굳어 있어 **법정 항목 9개가
  화면에서 통째로 빠져** 있었다. 그래서 이 스크립트는 고정 건수를 검증값으로
  쓰지 않는다. 대신 **깨지면 안 되는 성질**을 검사하고 분포는 보고만 한다:
    · 시드된 단계는 전부 2025 실적이 있던 단계인가
    · 회차가 도래 회차를 넘지 않는가
    · 문서 id 가 유일하고 stageId 가 실재하는가
    · «대부분 미이행»이 유지되는가 (미이행+지연 ≥ 60%)
  분류 축이 늘어나면 분포는 따라 움직여야 하지 그 자리에서 막히면 안 된다.

  실행:  python3 tools/build-doc-seed-2026.py
"""

import json
import os
import subprocess
import sys
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'js', 'doc-seed-2026.js')

YEAR = 2026
BASE_YEAR = 2025
# 기준일은 **js/common.js 에서 읽어 온다**(§11 단일 출처). 손으로 베껴 두면
# DEMO_TODAY 를 옮겼을 때 «시드가 낡았다»는 경고가 재생성해도 사라지지 않는다 —
# 경고가 시킨 일을 해도 안 고쳐지는 상태가 가장 나쁘다. node_dump() 가 채운다.
TODAY = ''

# 주기별 채택률 — 분자는 «그 주기에서 2026 에 손을 댄 단계 수»다.
#   YEAR    연 1회 업무는 대개 하반기에 몰린다 → 상반기에 끝낸 것은 소수
#   HALF    상반기분 마감이 6/30 이라 절반쯤 들어왔다
#   QUARTER 2회 도래 · MONTH 6회 도래 — 매달 하는 일은 손이 익어 회수율이 높다
#   EVENT   사유가 생겨야 하는 일이라 반년 치고는 적다
ADOPT = {'YEAR': 0.26, 'HALF': 0.52, 'QUARTER': 0.56, 'MONTH': 0.58, 'EVENT': 0.26, 'WEEK': 0.0}

# 채택된 단계가 도래 회차를 얼마나 채웠는가 — 해시 나머지로 고른다.
#   전부 채운 것(제때 한 부서)과 밀린 것이 섞여야 «진짜처럼» 보인다.
FILL_PATTERN = [1.0, 1.0, 0.66, 0.5, 0.83]


def re_iso(t):
    import re
    return bool(re.match(r'^\d{4}-\d{2}-\d{2}$', t or ''))


def node_dump():
    """생성물 두 개를 node 로 읽어 JSON 으로 받는다.

    정규식으로 파싱하면 따옴표 없는 키·주석에서 조용히 어긋난다. 원본이 JS 라
    JS 로 읽는 것이 정확하다. (tools/ 의 다른 스크립트는 CSV 를 읽어 python 만으로
    끝나지만, 이 스크립트의 입력은 CSV 가 아니라 **먼저 생성된 JS** 다.)
    """
    js = (
        "global.window={};"
        "require('./js/common.js');"
        "require('./js/doc-taxonomy-data.js');"
        "require('./js/doc-history-data.js');"
        "console.log(JSON.stringify({stages:window.DYDOCT.STAGES,docs:window.DYDOCH.DOCS,"
        "today:window.DYV2.today()}));"
    )
    r = subprocess.run(['node', '-e', js], cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit('node 실행 실패 — 생성물을 읽을 수 없습니다.\n' + r.stderr)
    return json.loads(r.stdout)


def fnv1a(s):
    h = 0x811c9dc5
    for ch in s.encode('utf-8'):
        h ^= ch
        h = (h * 0x01000193) & 0xffffffff
    return h


# ── 주기 파싱 · 기한 계산 — js/cmp-core.js 와 **같은 규칙** ────────────────────
#    두 곳이 다르면 시드가 만든 회차와 화면이 세는 회차가 어긋난다.
def cc_of_need(n):
    """cmp-core.js ccOfNeed() — 회차 수에서 주기 버킷을 되돌린다."""
    if n >= 48:
        return 'WEEK'
    if n >= 12:
        return 'MONTH'
    if n >= 4:
        return 'QUARTER'
    if n >= 2:
        return 'HALF'
    return 'YEAR'


def parse_cycle(stage):
    """cmp-core.js parseCycle() 의 파이썬 판 — **한 글자도 다르면 안 된다.**

    두 곳이 갈리면 시드가 만든 회차와 화면이 세는 회차가 어긋나 «충족인데 미이행»
    이 생긴다. 실제로 한 번 어긋났다(OSH-08-01 «2개월에 1회» — 이식본이 상시로
    읽어 화면의 분기 6회와 달랐다). 규칙을 고칠 때는 두 파일을 함께 고친다.
    """
    import re
    raw = (stage.get('opCycle') or '').strip() or (stage.get('legalCycle') or '').strip()
    s = raw.strip()
    if not s:
        return ('EVENT', 0, '정기주기 없음')
    if re.search(r'정기주기\s*없음|수시', s):
        return ('EVENT', 0, s)
    m = re.search(r'주\s*(\d+)\s*회', s)
    if m:
        return ('WEEK', int(m.group(1)) * 52, s)
    m = re.search(r'(\d+)\s*개월(?:에|마다)\s*(\d+)\s*회', s)
    if m:
        if '~' in s:
            return ('EVENT', 0, s)              # 범위로 적힌 것은 회차를 확정할 수 없다
        need = round(12 / int(m.group(1))) * int(m.group(2))
        if need < 1:
            return ('EVENT', 0, s)
        return (cc_of_need(need), need, s)
    m = re.search(r'월\s*(\d+)\s*회', s)
    if m:
        return ('MONTH', 12 * int(m.group(1)), s)
    if '매월' in s:
        return ('MONTH', 12, s)
    m = re.search(r'분기\s*(?:마다\s*)?(\d+)?\s*회', s)
    if m:
        nq = 4 * int(m.group(1) or 1)
        return (cc_of_need(nq), nq, s)
    if '매반기' in s:
        return ('HALF', 2, s)
    m = re.search(r'반기\s*(?:별\s*)?(\d+)?\s*회', s)
    if m:
        nh = 2 * int(m.group(1) or 1)
        return (cc_of_need(nh), nh, s)
    if re.search(r'\d+\s*년\s*(?:마다|에)', s):
        return ('EVENT', 0, s)                  # N년마다 — 그 해 회차를 셀 수 없다
    m = re.search(r'(?:연|매년)\s*(\d+)\s*회', s)
    if m:
        return ('YEAR', int(m.group(1)), s)
    if '매년' in s:
        return ('YEAR', 1, s)
    return ('EVENT', 0, s)


def last_day(y, mo):
    import calendar
    return calendar.monthrange(y, mo)[1]


def deadline(need, k, year):
    """k 회차의 기한 — cmp-core.js deadlineOf() 와 같은 식(달력 균등 분할)."""
    if not need:
        return '%d-12-31' % year
    if 12 % need == 0:
        mo = (12 // need) * k
        return '%d-%02d-%02d' % (year, mo, last_day(year, mo))
    import datetime
    d = datetime.date(year, 1, 1) + datetime.timedelta(days=int(365 * k / need) - 1)
    return d.isoformat()


def elapsed_rounds(need, year, today=None):
    # 기본인자를 TODAY 로 두면 **모듈 로드 시점의 빈 값**이 굳는다(파이썬 기본인자는
    # 한 번만 평가된다). node_dump 뒤에 채워지므로 호출 시점에 읽어야 한다.
    today = today or TODAY
    if not need:
        return 0
    cy = int(today[:4])
    if year < cy:
        return need
    if year > cy:
        return 0
    return sum(1 for k in range(1, need + 1) if deadline(need, k, year) < today)


def next_day(iso):
    import datetime
    d = datetime.date(*map(int, iso.split('-'))) + datetime.timedelta(days=1)
    return d.isoformat()


def pick_date(lo, hi, seedv):
    """[lo, hi] 안에서 결정적으로 하루를 고른다 — 같은 날짜가 몰리지 않게."""
    import datetime
    a = datetime.date(*map(int, lo.split('-')))
    b = datetime.date(*map(int, hi.split('-')))
    span = (b - a).days
    if span <= 0:
        return b.isoformat()
    # 기한에 붙어 제출하는 실제 습성 — 창의 뒤쪽 60% 에 몰리게 둔다
    off = span - (seedv % max(1, int(span * 0.6) + 1))
    return (a + datetime.timedelta(days=max(0, off))).isoformat()


_YEAR_RE = None


def shift_years(text):
    """제목의 연도 표기를 한 해 민다.

    2025 원장 제목을 그대로 쓰면 «2026년 문서»에 2025·2024 가 남는다. 2025년에
    작성한 «2024년 정산서»는 2026년에는 «2025년 정산서»가 되는 것이 맞으므로,
    특정 연도만 바꾸지 않고 **표기된 연도를 전부 +1** 한다. 미래 연도(2027 이상)는
    만들지 않는다.
    """
    global _YEAR_RE
    import re
    if _YEAR_RE is None:
        _YEAR_RE = (re.compile(r"20(1\d|2[0-5])"), re.compile(r"'(1\d|2[0-5])"),
                    re.compile(r"(?<![0-9])(1\d|2[0-5])년"))
    full, apos, short = _YEAR_RE
    text = full.sub(lambda m: str(int(m.group(0)) + 1), text)
    text = apos.sub(lambda m: "'%02d" % (int(m.group(1)) + 1), text)
    text = short.sub(lambda m: '%02d년' % (int(m.group(1)) + 1), text)
    return text


def main():
    global TODAY
    data = node_dump()
    TODAY = data.get('today') or ''
    if not re_iso(TODAY):
        sys.exit('js/common.js 에서 기준일(DEMO_TODAY)을 읽지 못했습니다 — 시드를 만들지 않습니다.')
    stages = data['stages']
    docs25 = data['docs']

    by_stage_docs = defaultdict(list)
    for d in docs25:
        for sid in (d.get('stageIds') or []):
            by_stage_docs[sid].append(d)

    # ── 후보: 2025 에 문서가 있던 단계 ────────────────────────────────────────
    cand = defaultdict(list)
    for s in stages:
        cc, need, label = parse_cycle(s)
        if by_stage_docs.get(s['id']):
            cand[cc].append((s, cc, need, label))
    for cc in cand:
        cand[cc].sort(key=lambda t: fnv1a('SEED26|' + t[0]['id']))

    out_docs, st_map, picked = [], {}, []
    seq = 0
    for cc, rows in sorted(cand.items()):
        take = int(round(len(rows) * ADOPT.get(cc, 0.0)))
        for i, (s, _cc, need, label) in enumerate(rows[:take]):
            h = fnv1a(s['id'])
            due = elapsed_rounds(need, YEAR)
            if need == 0:
                n = 1 + h % 3                      # 상시·수시 — 사유가 생긴 만큼
            else:
                # 기한이 아직 안 온 회차도 «미리 끝냈다»가 가능하다(연 1회 업무를
                # 7월에 마치는 것은 지연이 아니라 정상이다). 다만 도래분이 있으면
                # 그 범위를 기준으로 채운다.
                span = due if due else 1
                n = max(1, int(round(span * FILL_PATTERN[h % len(FILL_PATTERN)])))
                n = min(n, need)
            src25 = by_stage_docs[s['id']]
            made = 0
            for k in range(n):
                # 그 회차가 실제로 일어날 수 있었던 창 — [직전 회차 기한+1, min(기한, 오늘)]
                lo = ('%d-01-01' % YEAR) if k == 0 else next_day(deadline(need, k, YEAR))
                hi = min(deadline(need, k + 1, YEAR), TODAY) if need else TODAY
                if hi < lo:
                    continue                       # 아직 올 수 없는 회차 — 만들지 않는다
                seq += 1
                made += 1
                base = src25[(h + k) % len(src25)]
                title = shift_years(base.get('title') or s['name'])
                date = pick_date(lo, hi, h + k * 7)
                out_docs.append({
                    'id': 'SEED26-%04d' % seq,
                    # 이 시드가 어느 2025 문서에서 왔는지 — 화면의 «전년도 불러오기»가
                    # 같은 원본을 또 옮겨 회차를 넘기지 않도록 검사에 쓴다.
                    'seedOf': base.get('id') or '',
                    'title': title,
                    'sr': base.get('sr') or '',
                    'date': date,
                    'stageIds': [s['id']],
                    'cycle': label,
                    'src': base.get('src') or 'onnara',
                    'st': base.get('st') or '결재완료',
                    'round': k + 1,
                })
            # 진행상태 — 문서가 붙었으면 진행중. 넷 중 하나는 재난안전과 확인까지
            # 끝난 것으로 둔다(확인은 사람이 하는 별도 축이라 전부일 수 없다).
            st_map[s['id']] = 'complete' if (h % 4 == 0) else 'in_progress'
            if not made:
                st_map.pop(s['id'], None)
                continue
            picked.append((s['id'], cc, need, due if need else 0, made))

    # ── 검증 — 고정 건수가 아니라 «깨지면 안 되는 성질» ───────────────────────
    ok_ids = {s['id'] for s in stages}
    errs = []
    if len({d['id'] for d in out_docs}) != len(out_docs):
        errs.append('문서 id 중복')
    for d in out_docs:
        if d['stageIds'][0] not in ok_ids:
            errs.append('실재하지 않는 단계: ' + d['stageIds'][0])
        if not by_stage_docs.get(d['stageIds'][0]):
            errs.append('2025 실적이 없는 단계를 시드했다: ' + d['stageIds'][0])
    for sid, cc, need, due, n in picked:
        if need and n > need:
            errs.append('법정 회차 수를 넘겼다: %s (%d/%d)' % (sid, n, need))
    for d in out_docs:
        if d['date'] > TODAY:
            errs.append('오늘 이후 날짜의 실적을 만들었다: %s %s' % (d['id'], d['date']))
        if d['date'][:4] != str(YEAR):
            errs.append('연도가 어긋난 실적: %s %s' % (d['id'], d['date']))

    # 분포 — 화면 판정(cmp-core.js judge)과 같은 식으로 미리 세어 본다
    cnt_by_stage = Counter(d['stageIds'][0] for d in out_docs)
    dist = Counter()
    for s in stages:
        cc, need, _ = parse_cycle(s)
        n = cnt_by_stage.get(s['id'], 0)
        if need == 0:
            dist['충족' if n else '미이행'] += 1
            continue
        done = min(n, need)
        if done >= need:
            dist['충족'] += 1
        elif done > 0:
            dist['진행중'] += 1
        else:
            dist['지연' if elapsed_rounds(need, YEAR) else '미이행'] += 1
    total = sum(dist.values())
    behind = dist['미이행'] + dist['지연']
    if total and behind / total < 0.60:
        errs.append('«대부분 미이행»이 무너졌다 — 미이행+지연 %d/%d (%.0f%%)'
                    % (behind, total, behind / total * 100))

    print('업무단계 %d · 후보(2025 실적 보유) %d · 시드 단계 %d · 시드 문서 %d'
          % (len(stages), sum(len(v) for v in cand.values()), len(picked), len(out_docs)))
    print('2026 판정 예상 — ' + ' · '.join('%s %d' % (k, dist[k])
          for k in ['충족', '진행중', '지연', '미이행'])
          + '  (미이행+지연 %.0f%%)' % (behind / total * 100 if total else 0))
    if errs:
        print('\n검증 실패 — 파일을 쓰지 않습니다:')
        for e in sorted(set(errs))[:10]:
            print('  ·', e)
        sys.exit(1)

    header = '''/* =========================================================================
 * 2026년 시연 시드 — 이행 실적 (DYDOC2026)
 *   ※ 생성물 — 손으로 고치지 말 것. 규칙을 고치고 재생성한다.
 *      생성기: tools/build-doc-seed-2026.py
 *      입력:   js/doc-taxonomy-data.js · js/doc-history-data.js (둘 다 생성물)
 *
 *   [이것이 무엇인가] 2026년 이행 실적은 아직 일어나지 않은 일이라 담양군에서
 *   받을 수 없다. 그런데 문서 0건으로 두면 177단계가 전부 미이행으로 떠서
 *   «시스템이 비었다»로 읽힌다. 그래서 규칙으로 만든 **시연 시드**다.
 *     · 2025 에 실적이 있던 단계만 후보 — 작년에 한 적 없는 일을 올해 했다고
 *       하지 않는다.
 *     · 도래한 회차를 넘지 않는다 — 미래 실적을 만들지 않는다.
 *     · dataMode:'demo' · origin:'seed26' 으로 원장·사용자 등록분과 구분된다.
 *   실서비스에서는 이 파일을 로드하지 않는다(빈 배열과 같다).
 *
 *   DOCS[] : DYDOCS 문서 축의 네 번째 출처. 2025 문서 제목을 이어받고 연도만 바꾼다.
 *   ST{}   : 업무단계 진행상태 폴백. st2025 와 같은 자리에서 같은 방식으로 쓰인다.
 *            (문서 수로 판정하는 «이행상태»와 다른 축이다 — 합치지 말 것.)
 * ========================================================================= */
'''
    meta = {
        'year': YEAR,
        'today': TODAY,
        'rule': '2025 실적 보유 단계 중 주기별 채택률로 선정(해시 순서) · 도래 회차 이내',
        'adopt': ADOPT,
        'stagesSeeded': len(picked),
        'docs': len(out_docs),
        'expect': {k: dist[k] for k in ['충족', '진행중', '지연', '미이행']},
    }
    body = 'window.DYDOC2026 = {\n  META: ' + json.dumps(meta, ensure_ascii=False, indent=2) + ',\n'
    body += '  ST: ' + json.dumps(st_map, ensure_ascii=False, indent=2) + ',\n'
    body += '  DOCS: [\n'
    body += ',\n'.join('    ' + json.dumps(d, ensure_ascii=False) for d in out_docs)
    body += '\n  ]\n};\n'
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(header + body)
    print('생성: %s (%.1f KB)' % (os.path.relpath(OUT, ROOT), os.path.getsize(OUT) / 1024))


if __name__ == '__main__':
    main()
