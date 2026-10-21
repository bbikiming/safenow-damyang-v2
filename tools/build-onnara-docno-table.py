# -*- coding: utf-8 -*-
"""
온나라 문서번호 대조표 — 확정문서목록 문서마다 담양군 문서등록대장 원본의 문서번호를 찾아 붙인다.

  왜 만드나
  ─────────
  개발이 온나라 문서를 찾을 «번호 단서»가 필요하다. 전달본 README가 말한 «부서별 확인목록 CSV»는
  기획 쪽에서 찾지 못했다(2026-10-21). 대신 기획이 이미 받아 둔 담양군 문서등록대장 원본으로
  확정문서목록 7,612건을 맞춰 대조표를 만든다. 원본이 없는 부서·연도는 «원본 없음»으로 남긴다.

  원본 (인자로 받는다)
  ────────────────
  --confirmed  확정문서목록 xlsx (data/담양군_안전보건_확정문서목록_연도별_260918.xlsx)
  --export     260808_담양군청_업무문서_목록 폴더 — 부서/기간.csv (5개 부서 · 2021.07~2026.06)
  --ds2025     (작업중) 2025_재난안전과 문서분류(5.8.)_수정.xlsx — 재난안전과 2025(안전문서·작업중·미해당)
               와 «○○ 문서등록대장 목록» 시트(건설과·물순환사업소·산림정원과 2025)

  대조 규칙 (엄격 → 완화, 앞 단계에서 정해지면 끝)
  ─────────────────────────────────────────
  1. 부서 + 보고일자 + 제목 + 수발신자 (공백 제거 후 같음)        → 한 건이면 «일치», 여럿이면 «후보 여럿»
  2. 부서 + 보고일자 + 제목 (수발신자 표기만 다름)               → 한 건이면 «일치(수발신자 표기 다름)»
  3. 부서 + 제목 + 수발신자, 보고일자 ±3일                       → 한 건이면 «일치(보고일자 N일 차이)»
  ※ 모든 단계에서 원본 문서구분(생산/접수)이 확정목록 발신구분과 같은 행만 후보로 본다 — 같은 날 같은 제목의
     요청(접수)과 회신(생산)이 흔해, 구분을 안 보면 엉뚱한 쪽에 붙는다(실측: 완화 단계 83건이 그랬다)
  그 밖                                                          → «못 찾음»
  부서·연도 원본이 없으면                                        → «원본 없음»

  원본 칸의 뜻 (원본 실측 — 2026-10-21)
  ─────────────────────────────────
  · 문서번호: 처리과의 등록 일련번호. 생산문서는 «생산등록번호» 칸 끝자리와 126,539건 전부 같다.
  · 생산등록번호 칸: 생산문서는 담양군 번호(처리과-문서번호). **접수문서는 보낸 기관의 번호**다
    (끝자리가 문서번호와 같은 접수 행은 303,550건 중 51건).
  · 부서 + 연도 + 문서번호는 유일하지 않다(조직개편 때 번호가 다시 시작 — 16,578개 키가 겹침).
    부서 + 보고일자 + 문서번호는 430,089행 중 25개 키만 겹친다.

  실행: /opt/homebrew/bin/python3 tools/build-onnara-docno-table.py --confirmed … --export … --ds2025 … --out …
"""
import argparse
import collections
import csv
import datetime
import glob
import os
import re
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import confirmed_list as CL  # noqa: E402


def N(s):
    return unicodedata.normalize('NFC', '' if s is None else str(s)).strip()


def T(s):
    return re.sub(r'\s+', '', N(s))


def d8(s):
    return CL.norm_date(N(s))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--confirmed', required=True)
    ap.add_argument('--export', required=True)
    ap.add_argument('--ds2025', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()

    recs = []          # (dept, date, title, sr, no, kind, prodno, src)
    have = set()       # (dept, year) 원본이 있는 부서·연도

    for p in sorted(glob.glob(os.path.join(a.export, '*', '*.csv'))):
        dept = N(os.path.basename(os.path.dirname(p)))
        if '5년' in dept:
            continue  # 환경과 5년 = 같은 부서의 다른 내려받기본(중복)
        src = '260808_담양군청_업무문서_목록/%s/%s' % (dept, N(os.path.basename(p)))
        with open(p, encoding='utf-8-sig', newline='') as f:
            for r in csv.DictReader(f):
                recs.append((dept, d8(r['보고일자']), r['제목'], r['수(발)신자'], N(r['문서번호']),
                             N(r['문서구분']), N(r['생산등록번호']), src))

    import openpyxl
    wb = openpyxl.load_workbook(a.ds2025, read_only=True, data_only=True)
    base = N(os.path.basename(a.ds2025))
    for ws in wb.worksheets:
        t = N(ws.title)
        if t in ('안전문서', '작업중', '미해당'):
            dept = '재난안전과'
        elif '문서등록대장' in t:
            dept = t.split(' 문서등록대장')[0]
        else:
            continue
        hdr = None
        for r in ws.iter_rows(values_only=True):
            c = [N(x) for x in r]
            if hdr is None:
                if '문서번호' in c and '제목' in c:
                    hdr = {h: i for i, h in enumerate(c) if h}
                continue
            g = (lambda k: c[hdr[k]] if k in hdr and hdr[k] < len(c) else '')
            if not g('제목') or not g('문서번호'):
                continue
            recs.append((dept, d8(g('보고일자')), g('제목'), g('수(발)신자'), g('문서번호'),
                         g('문서구분'), g('생산등록번호'), '%s/%s' % (base, t)))

    # 같은 문서가 두 원본에 다 있으면(건설과·물순환 2025) 하나로 — 부서+보고일자+문서번호
    uniq = collections.OrderedDict()
    for r in recs:
        k = (r[0], r[1], r[4])
        if k not in uniq:
            uniq[k] = r
    recs = list(uniq.values())
    for r in recs:
        have.add((r[0], r[1][:4]))

    i4 = collections.defaultdict(list)
    i3 = collections.defaultdict(list)
    i3s = collections.defaultdict(list)
    for r in recs:
        i4[(r[0], r[1], T(r[2]), T(r[3]))].append(r)
        i3[(r[0], r[1], T(r[2]))].append(r)
        i3s[(r[0], T(r[2]), T(r[3]))].append(r)

    years, _ = CL.load(a.confirmed)
    out = []
    stat = collections.Counter()
    for y, Y in years.items():
        for k, doc in Y['docs'].items():
            dept, date, title, sr = (N(x) for x in k)
            dd = d8(date)
            row = doc['row']
            res, hits = None, []
            want = '생산' if N(row.get('발신구분')) == '생산' else '접수'
            K = (lambda lst: [r for r in lst if not r[5] or r[5] == want])
            if (dept, dd[:4]) not in have:
                res = '원본 없음'
            else:
                c = K(i4.get((dept, dd, T(title), T(sr)), []))
                if len(c) == 1:
                    res, hits = '일치', c
                elif len(c) > 1:
                    res, hits = '후보 여럿', c
                else:
                    c = K(i3.get((dept, dd, T(title)), []))
                    if len(c) == 1:
                        res, hits = '일치(수발신자 표기 다름)', c
                    else:
                        try:
                            base_d = datetime.date.fromisoformat(dd)
                            near = [r for r in K(i3s.get((dept, T(title), T(sr)), []))
                                    if abs((datetime.date.fromisoformat(r[1]) - base_d).days) <= 3]
                        except ValueError:
                            near = []
                        if len(near) == 1:
                            gap = abs((datetime.date.fromisoformat(near[0][1]) - base_d).days)
                            res, hits = '일치(보고일자 %d일 차이)' % gap, near
                        else:
                            res = '못 찾음'
            stat[res.split('(')[0] if res.startswith('일치(') else res] += 1
            stat['__' + res] += 1
            kinds = ';'.join(h[5] for h in hits)
            out.append([
                y, dept, dd, N(row.get('문서명')), N(row.get('수발신자')), N(row.get('발신구분')), res,
                ';'.join(h[4] for h in hits),
                ';'.join(h[1] for h in hits),
                kinds,
                ';'.join(h[6] if h[5] == '생산' else '' for h in hits),
                ';'.join(h[6] for h in hits),
                ';'.join(sorted(set(h[7] for h in hits))),
            ])

    total = len(out)
    if total != sum(len(Y['docs']) for Y in years.values()):
        sys.exit('행 수가 확정목록 문서 수와 다르다 — 파일을 쓰지 않는다')

    hdr = ['기준연도', '부서', '보고일자', '문서명', '수발신자', '발신구분', '대조 결과',
           '원본 문서번호', '원본 보고일자', '원본 문서구분', '담양군 생산등록번호(생산문서만)',
           '원본 생산등록번호 칸 그대로(접수문서는 보낸 기관 번호)', '원본 파일']
    with open(a.out, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f, lineterminator='\r\n')
        w.writerow(hdr)
        w.writerows(out)

    print('대조표: %s — %d행' % (a.out, total))
    for k in ('일치', '후보 여럿', '못 찾음', '원본 없음'):
        print('  %-8s %5d' % (k, stat[k]))
    for k in sorted(s for s in stat if s.startswith('__일치(')):
        print('    %s %d' % (k[2:], stat[k]))
    miss = collections.Counter((y, r[1]) for r in out for y in [r[0]] if r[6] == '원본 없음')
    print('  원본 없는 부서·연도:', ', '.join('%s %s %d' % (y, d, n) for (y, d), n in sorted(miss.items())))


if __name__ == '__main__':
    main()
