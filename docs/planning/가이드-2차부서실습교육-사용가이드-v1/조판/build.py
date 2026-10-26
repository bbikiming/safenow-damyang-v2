"""1권 부서 담당자 가이드 — 원고(마크다운) → A4 인쇄용 HTML.
원고가 정본이다. 이 스크립트는 모양만 입힌다: 단계 카드, 그림 자르기(확대), 편집 메모 상자."""
import os, re, sys, glob, unicodedata, html as H
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
BOOK = sys.argv[1] if len(sys.argv) > 1 else '1'
RELEASE = len(sys.argv) > 2 and sys.argv[2] == 'release'   # 배포본: 편집 메모·빈 그림 자리를 뺀다
_NAME = {'1': '프로그램업무가이드_원고_v2.md', '2': '과장팀장가이드_원고_v2.md', 'faq': '자주묻는질문_원고_v2.md', 'doc': '문서업무가이드_원고_v1.md'}[BOOK]
# 원고는 조판 폴더 옆(작업 폴더) 또는 ../원고(저장소 정리본)에 있다
SRC = next(p for p in (os.path.join(HERE, '..', _NAME), os.path.join(HERE, '..', '원고', _NAME)) if os.path.exists(p))
FOOT = {'1': '부서 담당자 · 프로그램 업무 가이드', '2': '과장·팀장 가이드', 'faq': '자주 묻는 질문 · 공통', 'doc': '부서 담당자 · 문서 업무 가이드'}[BOOK] + ('' if RELEASE else ' · 초안')
EDITION = ('1판' if RELEASE else '1판 초안')
VOL = {'1': '부서 담당자용', '2': '과장·팀장용', 'faq': '공통', 'doc': '부서 담당자용'}[BOOK]
IMGDIRS = ([os.path.join(HERE, '..', 'cap3'), os.path.join(HERE, '..', 'cap2'), os.path.join(HERE, '..', '그림', '새캡처')]
           + glob.glob(os.path.join(HERE, '..', 'pkg', 'images', '0*')) + glob.glob(os.path.join(HERE, '..', '그림', 'pkg', '0*')))
OUT = os.path.join(HERE, 'img'); os.makedirs(OUT, exist_ok=True)

def find(code):
    for d in IMGDIRS:
        for p in glob.glob(os.path.join(d, '*.jpg')):
            n = unicodedata.normalize('NFC', os.path.basename(p))
            if n.startswith(code + '_') and '원본실명' not in n:
                return p
    return None

# 확대 그림 자르기 상자 (가로·세로 비율). 단계마다 다르게 쓰려면 '코드@키'
CROP = {
 'C01': (.70, 0, 1, .09), 'C03': (.38, .08, 1, .52),
 'N1-01': (.22, .35, 1, .47), 'N1-01@card': (.22, .63, 1, .93), 'N1-01@sync': (.22, .24, .62, .32),
 'N2-01': (.22, .28, .62, .62), 'N0-03@count': (.22, .30, 1, .42), 'N0-03@road': (.22, .63, 1, .94),
 'R01': (.24, .10, 1, .34), 'R03': (.24, .22, .76, .66), 'R04': (.24, .55, .80, .97), 'R05': (.24, .50, .86, .80),
 'R06': (.30, .72, 1, .96), 'R08': (.24, .32, .78, .97), 'R09': (.24, .34, .78, .93), 'R10': (.30, .68, 1, .96),
 'R11': (.24, .05, .78, .97), 'R12': (.24, .05, .78, .97), 'R13': (.24, .05, .86, .97), 'R15': (.30, .33, 1, .66),
 'R17': (.30, .60, 1, .97), 'R18': (.24, .05, .78, .97), 'R19': (.24, .05, .86, .97), 'R20': (.38, 0, 1, .32),
 'N3-01': (.22, .44, .98, .70), 'N3-02': (.31, .14, .69, .86), 'N3-03': (.31, .05, .69, .95), 'N3-04': (.31, .05, .69, .95),
 'E01': (.18, .48, .96, .74), 'E02': (.24, .05, .76, .97), 'E03': (.24, .05, .76, .97), 'E05': (.14, .28, 1, .66),
 'N5-01': (.33, .14, .67, .86), 'N5-02': (.22, .28, 1, .73), 'N5-03': (.31, .04, .69, .96), 'N5-04': (.22, .28, 1, .62), 'N5-05': (.31, .04, .69, .96),
 'P01': (.30, .48, .76, .70), 'P05': (.27, .03, .73, .96), 'P06': (.27, .03, .73, .96), 'P07': (.27, .03, .73, .96), 'P10': (.27, .03, .73, .96),
 'D01': (.24, .50, 1, .66), 'D02': (.28, .32, 1, .70), 'D03': (.24, .28, 1, .86), 'D05': (.23, .10, .77, .97), 'D06': (.23, .14, .77, .86),
 'D07': (.23, .14, .77, .86), 'D08': (.29, .24, .71, .76),
 'N8-01': (.33, .16, .67, .84), 'N8-02': (.33, .16, .67, .84), 'N10-01': (.22, .26, 1, 1),
}

MODAL = set('R03 R04 R07 R08 R09 R11 R12 R13 R18 R19 E02 E03 P04 P05 P06 P07 P10 D04 D05 D06 D07 D08 N3-02 N3-03 N3-04 N5-01 N5-03 N5-05 N8-01 N8-02'.split())

def modal_box(im):
    """어둡게 깔린 배경 위의 흰 창을 찾는다: 밝은 픽셀이 절반 넘는 열·행의 범위."""
    g = im.convert('L'); w, h = g.size; px = g.load()
    def bright(x, y): return px[x, y] > 238
    cols = [x for x in range(0, w, 2) if sum(bright(x, y) for y in range(0, h, 4)) > (h / 4) * 0.45]
    if not cols: return None
    x0, x1 = min(cols), max(cols)
    rows = [y for y in range(0, h, 2) if sum(bright(x, y) for x in range(x0, x1, 4)) > ((x1 - x0) / 4) * 0.55]
    if not rows: return None
    y0, y1 = min(rows), max(rows)
    if (x1 - x0) < w * 0.25: return None
    return (max(0, x0 - 4), max(0, y0 - 4), min(w, x1 + 4), min(h, y1 + 4))

def img_full(code):
    p = find(code)
    if not p: return None
    dst = os.path.join(OUT, code + '_full.jpg')
    if not os.path.exists(dst):
        Image.open(p).convert('RGB').save(dst, quality=92)
    return 'img/' + os.path.basename(dst)

def img_crop(code, key=None):
    p = find(code)
    if not p: return None
    box = CROP.get(f'{code}@{key}') or CROP.get(code)
    tag = f'{code}_{key or "z"}'
    dst = os.path.join(OUT, tag + '.jpg')
    im = Image.open(p).convert('RGB')
    mb = modal_box(im) if code in MODAL and not CROP.get(f'{code}@{key}') else None
    if mb:
        im = im.crop(mb)
    elif box:
        w, h = im.size
        im = im.crop((int(box[0]*w), int(box[1]*h), int(box[2]*w), int(box[3]*h)))
    im.save(dst, quality=92)
    return 'img/' + os.path.basename(dst), im.size

def inline(s):
    s = re.sub(r'\s*\((?:[CRPED]\d{2}|N\d+-\d+)[^)]*\)', '', s)
    s = H.escape(s, quote=False)
    s = re.sub(r'`([^`]+)`', r'<code>\1</code>', s)
    s = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', s)
    s = s.replace('🟩', '<span class="tag dept">우리 부서</span>').replace('🟦', '<span class="tag dsp">재난안전과</span>').replace('⚙️', '<span class="tag sys">시스템</span>')
    return s

CODE = re.compile(r'\b(N\d+-\d+|[CRPED]\d{2})\b')

def figure_line(text, stepkey):
    """'그림:' 줄 → 그림 칸 HTML. [전체] 뒤 코드는 작게, [확대] 뒤 코드는 잘라서."""
    global EXLABEL
    EXLABEL = '예시 화면 · 연습 계정'
    if '담당자 화면 예시' in text: EXLABEL = '부서 담당자 화면 예시 · 과장 화면에는 버튼이 없을 수 있음'
    if '재난안전과 계정 예시' in text: EXLABEL = '재난안전과 계정 예시 · 과장·팀장 화면과 다를 수 있음'
    text = re.sub(r'`\[(담당자 화면 예시|재난안전과 계정 예시)\]`', '', text)
    parts = re.split(r'(`\[전체\]`|`\[확대\]`)', text)
    mode = '확대'; out = []; caps = []
    for seg in parts:
        if seg == '`[전체]`': mode = '전체'; continue
        if seg == '`[확대]`': mode = '확대'; continue
        for ph in re.finditer(r'새 캡처 ([0-9K]+-\d+)\s*\(([^)]*)\)', seg):
            if not RELEASE: out.append(f'<div class="ph">그림 준비 중 — {H.escape(ph.group(2))}</div>')
        seg = re.sub(r'새 캡처 [0-9K]+-\d+\s*\([^)]*\)', '', seg)
        for m in CODE.finditer(seg):
            code = m.group(1)
            key = None
            if code == 'N1-01':
                key = 'card' if '카드' in stepkey else ('sync' if '동기화' in stepkey else None)
            if code == 'N0-03':
                key = 'count' if '숫자' in stepkey else ('road' if '로드맵' in stepkey else None)
            if mode == '전체':
                src = img_full(code)
                if src: out.append(f'<figure class="full"><img src="{src}" alt=""><figcaption>전체 화면 — 위치</figcaption></figure>')
            else:
                r = img_crop(code, key)
                if r:
                    src, (w, h) = r
                    cls = 'zoom wide' if w > h * 1.6 else 'zoom'
                    out.append(f'<figure class="{cls}"><img src="{src}" alt=""><figcaption><span class="ex">{EXLABEL}</span></figcaption></figure>')
        rest = CODE.sub('', seg).strip(' ·,()')
        if rest and '새 캡처' not in rest: caps.append(rest)
    cap = ('<p class="figcap">' + inline(' '.join(caps)) + '</p>') if caps else ''
    return '<div class="figs">' + ''.join(out) + '</div>' + cap

LABELS = {'확인 사항': 'act', '점검 사항': 'ng', '처리되지 않을 때': 'ng', '처리': 'act', '완료 확인': 'ok', '유의 사항': 'note', '잘못 등록한 경우': 'ng', '여러 명이면': 'note'}

def render(md):
    lines = md.split('\n')
    # 편집용 머리말(원고 읽는 법)과 촬영 현황은 인쇄하지 않는다
    body = []; skip = True
    for l in lines:
        if l.startswith('## 표지'): skip = False
        if l.startswith('## 그림 촬영 현황') or l.startswith('## 그림 목록'): skip = True
        if not skip: body.append(l)
    lines = body
    out = []; i = 0; in_step = False; chapter_open = False; part_open = False

    def close_step():
        nonlocal in_step
        if in_step: out.append('</div></section>'); in_step = False

    while i < len(lines):
        l = lines[i]
        if l.startswith('## '):
            close_step()
            title = l[3:].strip()
            if title == '표지':
                items = []
                i += 1
                while i < len(lines) and not lines[i].startswith('## '):
                    if lines[i].startswith('- '): items.append(lines[i][2:].strip())
                    i += 1
                title = re.sub(r'\*\*', '', items[1]).replace(' 가이드', '<br>가이드')
                out.append(f'<section class="cover"><div class="cv-top">{inline(items[0])}</div><h1>{title}</h1><p class="cv-sub">{inline(items[2])}</p><div class="cv-foot"><span>{inline(items[3])}</span><span>{VOL} · {EDITION}</span></div></section>')
                continue
            pm = re.match(r'(\d)부\s*·\s*(.+)', title)
            if pm:
                out.append(f'<h2 class="part"><span class="partno">{pm.group(1)}부</span>{inline(pm.group(2))}</h2>')
                part_open = True
                i += 1; continue
            m = re.match(r'(\d+|부록)\s*·\s*(.+)', title)
            no, name = (m.group(1), m.group(2)) if m else ('', title)
            nb = ' nb' if part_open else ''
            part_open = False
            out.append(f'<h2 class="ch{nb}" data-no="{H.escape(no)}"><span class="chno">{H.escape(no)}</span>{inline(name)}</h2>')
            i += 1; continue
        if l.startswith('### '):
            close_step(); out.append(f'<h3>{inline(l[4:])}</h3>'); i += 1; continue
        m = re.match(r'\*\*단계 (\d+) · (.+)\*\*\s*$', l)
        if m:
            close_step(); in_step = True
            stepkey = m.group(2)
            ttl = m.group(2); tb = ''
            if ttl[:1] in '①②③':
                tb = f'<span class="tb">{ttl[0]}</span>'; ttl = ttl[1:].strip()
            out.append(f'<section class="step"><div class="sh"><span class="sn">{m.group(1)}</span>{tb}<span class="st">{inline(ttl)}</span></div><div class="sb">')
            figs=[]; rowsx=[]
            i += 1
            while i < len(lines) and (lines[i].startswith('- ') or lines[i].startswith('  ')):
                b = lines[i]
                if b.startswith('- 그림:'):
                    figs.append(figure_line(b[len('- 그림:'):].strip(), stepkey)); i += 1; continue
                elif b.startswith('  '):
                    out.append(f'<div class="sub">{inline(b.strip())}</div>')
                else:
                    txt = b[2:].strip()
                    if txt.startswith('⚠') or txt.startswith('📝'):
                        out.append(f'<div class="edit">{inline(txt)}</div>')
                    else:
                        lab = next((k for k in LABELS if txt.startswith(k + ':') or txt.startswith(k + ' ')), None)
                        if lab:
                            rest = txt[len(lab):].lstrip(': ')
                            out.append(f'<div class="row {LABELS[lab]}"><span class="lb">{lab}</span><span>{inline(rest)}</span></div>')
                        else:
                            out.append(f'<div class="row"><span class="lb"></span><span>{inline(txt)}</span></div>')
                i += 1
            # 그림과 글을 나눠 담는다
            k = len(out) - 1
            while k >= 0 and not out[k].startswith('<section class="step">'): k -= 1
            rows_html = out[k+1:]; del out[k+1:]
            wide = any('zoom wide' in f for f in figs)
            figs = [f for f in figs if '<figure' in f or 'class="ph"' in f]
            if figs:
                lay = 'stack' if wide else 'side'
                out.append(f'<div class="lay {lay}"><div class="fcol">' + ''.join(figs) + '</div><div class="tcol">' + ''.join(rows_html) + '</div></div>')
            else:
                out.extend(rows_html)
            close_step(); continue
        if l.startswith('|'):
            close_step()
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                cells = [c.strip() for c in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-{2,}:?', c) or c == '' for c in cells): rows.append(cells)
                i += 1
            head = rows[0]; body = rows[1:]
            th = '' if not any(head) else '<thead><tr>' + ''.join(f'<th>{inline(c)}</th>' for c in head) + '</tr></thead>'
            tb = ''.join('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in r) + '</tr>' for r in body)
            out.append(f'<table>{th}<tbody>{tb}</tbody></table>'); continue
        if l.startswith('- ') or re.match(r'\d+\. ', l):
            close_step()
            items = []
            while i < len(lines) and (lines[i].startswith('- ') or re.match(r'\d+\. ', lines[i]) or lines[i].startswith('  ')):
                items.append(re.sub(r'^(- |\d+\. )', '', lines[i].strip())); i += 1
            if len(items)==1 and items[0].startswith('그림:'):
                out.append(figure_line(items[0][3:].replace('`[전체]`','`[확대]`'), '')); continue
            lis = []
            for it in items:
                cls = ' class="edit"' if it.startswith('⚠') or it.startswith('📝') else ''
                lis.append(f'<li{cls}>{inline(it)}</li>')
            out.append('<ul>' + ''.join(lis) + '</ul>'); continue
        if l.startswith('> '):
            close_step(); out.append(f'<p class="quote">{inline(l[2:])}</p>'); i += 1; continue
        if l.strip() == '---' or not l.strip():
            i += 1; continue
        close_step()
        txt = l.strip()
        if txt.startswith('⚠') or txt.startswith('📝'):
            out.append(f'<div class="edit">{inline(txt)}</div>')
        else:
            m2 = re.match(r'\*\*([^*]+)\*\*\s*(.*)', txt)
            if m2 and m2.group(1) in ('업무 개요', '업무 유형', '업무 흐름', '사전 준비', '문제 해결', '참고(정상 표시)', '이후 절차', '유의 사항', '잘못 등록한 경우', '사용하지 않는 버튼', '해당 사항이 없는 경우', '회신서 «자체 점검» 3칸', '대상'):
                cls = {'참고(정상 표시)': 'okbox', '문제 해결': 'warnbox', '사용하지 않는 버튼': 'warnbox', '잘못 등록한 경우': 'warnbox'}.get(m2.group(1), 'infobox')
                out.append(f'<div class="box {cls}"><b>{H.escape(m2.group(1))}</b> {inline(m2.group(2))}</div>')
            else:
                out.append(f'<p>{inline(txt)}</p>')
        i += 1
    close_step()
    return '\n'.join(out)

md = open(SRC, encoding='utf-8').read()
css = open(os.path.join(HERE, 'guide.css'), encoding='utf-8').read().replace('부서 담당자 가이드 · 1권 · 초안', FOOT)
doc = f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>{FOOT}</title><style>{css}</style></head><body>{render(md)}</body></html>'
if RELEASE:
    doc = re.sub(r'<div class="edit">.*?</div>', '', doc, flags=re.S)
    doc = re.sub(r'<li class="edit">.*?</li>', '', doc, flags=re.S)
    doc = re.sub(r'<div class="ph">.*?</div>', '', doc, flags=re.S)
    doc = re.sub(r'\s*·?\s*⚠ 확인 필요(\([^)]*\))?', '', doc)
    doc = doc.replace('<ul></ul>', '').replace('<div class="figs"></div>', '')
    assert '⚠' not in doc and '📝' not in doc and '편집 메모' not in doc.replace('.edit::before { content: "편집 메모 · 인쇄본에서 뺌 — "; font-weight: 700; }', ''), 'release has edit marks'
open(os.path.join(HERE, f'guide{BOOK}{"_rel" if RELEASE else ""}.html'), 'w', encoding='utf-8').write(doc)
print('ok', len(doc))
