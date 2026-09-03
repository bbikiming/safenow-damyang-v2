#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""QA 검수 시나리오 → 노션 임포트 세트 생성기.

  실행: python3 tools/build-qa-notion.py            (원본 자동 탐색)
        python3 tools/build-qa-notion.py --ids SMK-003,SMK-022
        python3 tools/build-qa-notion.py --since <git-ref>
        python3 tools/build-qa-notion.py --check     (쓰지 않고 대조만)

[왜 있는가]
`docs/planning/노션임포트-QA-*/` 의 3개 파일은 원본 QA 문서에서 **기계적으로 나오는
생성물**인데 손으로 유지되고 있었다. 2026-09-03 실측으로 두 가지가 드러났다.

  · **드리프트** — 원본을 고친 뒤 세트를 안 고쳐, 어긋난 문장이 본문 6행·CSV 4행에
    그대로 남아 있었다(검수자는 그 사본을 보고 검수한다).
  · **암묵 규칙 2개가 코드 어디에도 없었다** — ① CSV 의 `결과 = N/T` 는 **원본에 없는**
    임포트 기본값이라 순진하게 다시 만들면 전건에서 사라진다 ② 셀에서 `**` 와 백틱을
    걷는 규칙은 구본과 바이트 대조를 해서야 찾았다.

이 스크립트가 그 둘을 코드로 적어 둔다.

[검사와는 다른 일이다]
`tools/check-screendefs.py` 는 **내용이 맞는지**(은퇴 화면을 가리키지 않는지) 보고,
이 스크립트는 **원본과 사본이 같은지**를 보장한다. 검사는 원본과 세트가 똑같이 낡아도
통과한다.

[무엇을 만드나]
  1_QA시나리오-본문.md  원본 − TC 표. 표 자리마다 「이 절의 테스트 케이스 N건은 …」 한 줄
  2_QA-테스트케이스.csv  TC 표 전건 → CSV (아래 변환 3종)
  2b_…-추가분.csv       그중 지난 커밋 이후 바뀐 TC 만 (이미 임포트한 사람의 Merge 용)
  0_임포트-안내.md      건수 문구 갱신

  ※ 3_QA-결함기록.csv 는 헤더뿐이라 파생물이 아니다 — 건드리지 않는다.

[CSV 변환 3종]
  ① `구분` 열 삽입 — TC ID 접두어에서 파생 (원본에 없는 열)
  ② `**` 와 백틱 제거 — 노션 셀에서는 글자 그대로 보인다
  ③ 꼬리 4열에 임포트 기본값 — 실제 결과·테스터·이슈번호는 비우고 `결과 = N/T`

[안 고치는 것] 원본은 읽기만 한다. 원본의 총계 표가 실제 행 수와 다르면 **쓰지 않고
멈춘다** — 조용히 고치면 어느 쪽이 정본인지 알 수 없어진다.
"""
import io, os, re, csv, sys, glob, subprocess

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
PLAN = os.path.join(ROOT, "docs", "planning")

KIND = {"RISK": "위험성평가", "EDU": "안전보건교육", "COM": "공통 UX", "SMK": "기타 모듈 Smoke"}
HEAD = ["TC ID", "구분", "우선순위", "화면·영역", "테스트 시나리오", "사전조건",
        "수행 절차", "기대 결과", "실제 결과", "결과", "테스터", "이슈번호"]
TC_RE = re.compile(r"^\|\s*((RISK|EDU|COM|SMK)-\d{3})\s*\|")
DEFAULT_RESULT = "N/T"          # 노션 임포트 기본값 — 원본에 없다(위 [왜 있는가] ①)

def die(msg):
    print("✖ " + msg); sys.exit(1)

def cell(x):
    """노션 셀 정규화 — 마크다운 강조와 코드 표기를 걷는다(위 변환 ②)."""
    return x.strip().replace("**", "").replace("`", "")

# ── 원본·대상 찾기 ──────────────────────────────────────────────────────────
srcs = sorted(glob.glob(os.path.join(PLAN, "검수-QA시나리오-*.md")))
if len(srcs) != 1:
    die("원본 QA 문서가 %d개다 — 하나여야 한다: %s" % (len(srcs), [os.path.basename(s) for s in srcs]))
SRC = srcs[0]
dsts = sorted(d for d in glob.glob(os.path.join(PLAN, "노션임포트-QA-*")) if os.path.isdir(d))
if len(dsts) != 1:
    die("노션 세트 폴더가 %d개다 — 하나여야 한다" % len(dsts))
DST = dsts[0]

args = sys.argv[1:]
CHECK = "--check" in args
def opt(name, default=None):
    return args[args.index(name) + 1] if name in args and args.index(name) + 1 < len(args) else default
SINCE = opt("--since", "HEAD")
IDS = [x.strip() for x in opt("--ids", "").split(",") if x.strip()]

# ── ① 원본 파싱 ────────────────────────────────────────────────────────────
lines = io.open(SRC, encoding="utf-8").read().split("\n")
recs, seen = [], set()
for i, l in enumerate(lines, 1):
    m = TC_RE.match(l)
    if not m:
        continue
    c = [cell(x) for x in l.strip().strip("|").split("|")]
    if len(c) != 11:
        die("%s:%d — TC 표 셀이 %d개다(11이어야 한다). 셀 안에 «|» 가 있으면 이렇게 된다.\n   %s"
            % (os.path.basename(SRC), i, len(c), l.strip()[:90]))
    if c[0] in seen:
        die("%s:%d — TC ID 중복: %s" % (os.path.basename(SRC), i, c[0]))
    seen.add(c[0])
    #        TC ID  구분              우선순위~기대결과   실제  결과            테스터 이슈
    recs.append([c[0], KIND[m.group(2)], *c[1:7], "", DEFAULT_RESULT, "", ""])
    assert len(recs[-1]) == len(HEAD)
if not recs:
    die("원본에서 TC 를 한 건도 찾지 못했다 — 표 형식이 바뀌었는지 본다")

by_kind = {}
for r in recs:
    by_kind[r[1]] = by_kind.get(r[1], 0) + 1

# ── ② 원본의 총계 표와 대조 (틀리면 쓰지 않는다) ────────────────────────────
src_txt = "\n".join(lines)
m = re.search(r"\|\s*\*\*총계\*\*\s*\|\s*\*\*(\d+)\*\*", src_txt)
if not m:
    die("원본 §13 총계 표를 찾지 못했다 — 앵커가 바뀌었다")
if int(m.group(1)) != len(recs):
    die("원본 총계 표가 **%s**건인데 실제 TC 는 %d건이다. 원본을 먼저 고친다." % (m.group(1), len(recs)))
for k, n in by_kind.items():
    mm = re.search(r"^\|\s*%s\s*\|\s*(\d+)\s*\|" % re.escape(k), src_txt, re.M)
    if not mm:
        die("총계 표에 «%s» 행이 없다" % k)
    if int(mm.group(1)) != n:
        die("총계 표의 «%s» 가 %s건인데 실제는 %d건이다. 원본을 먼저 고친다." % (k, mm.group(1), n))

# ── ③ 추가분(2b) 대상 고르기 — 지난 커밋 이후 바뀐 TC ──────────────────────
CSV2 = os.path.join(DST, "2_QA-테스트케이스.csv")
CSV2B = os.path.join(DST, "2b_QA-테스트케이스-추가분.csv")
def rel(p):
    return os.path.relpath(p, ROOT)
if IDS:
    delta, newly = [r for r in recs if r[0] in IDS], set()
    miss = set(IDS) - {r[0] for r in recs}
    if miss:
        die("--ids 에 원본에 없는 TC 가 있다: " + ", ".join(sorted(miss)))
else:
    try:
        old = subprocess.check_output(["git", "show", "%s:%s" % (SINCE, rel(CSV2))],
                                      cwd=ROOT, stderr=subprocess.DEVNULL).decode("utf-8")
        prev = {r[0]: r for r in csv.reader(io.StringIO(old)) if r and r[0] != "TC ID"}
    except subprocess.CalledProcessError:
        prev = {}
    delta = [r for r in recs if prev.get(r[0]) != r]
    newly = {r[0] for r in delta if r[0] not in prev}

# ── ④ 쓰기 ────────────────────────────────────────────────────────────────
def write_csv(path, rows):
    buf = io.StringIO()
    csv.writer(buf).writerow(HEAD); csv.writer(buf).writerows(rows)
    return path, buf.getvalue()

def build_body():
    """원본 − TC 표. 표 블록마다 안내 한 줄로 바꾼다."""
    out, i, done = [], 0, {}
    while i < len(lines):
        sep = i + 1 < len(lines) and set(lines[i + 1].replace("|", "").replace(" ", "")) <= {"-"}
        if lines[i].startswith("| TC ID |") and sep:
            j, ks = i + 2, []
            while j < len(lines) and TC_RE.match(lines[j]):
                ks.append(KIND[TC_RE.match(lines[j]).group(2)]); j += 1
            if not ks:
                die("TC 표 머리는 있는데 행이 없다(원본 %d행)" % (i + 1))
            k = ks[0]
            if len(set(ks)) != 1:
                die("한 표에 구분이 섞여 있다(원본 %d행): %s" % (i + 1, sorted(set(ks))))
            done[k] = done.get(k, 0) + len(ks)
            out.append("> **이 절의 테스트 케이스 %d건은 별도 데이터베이스에 있다** — 「QA 테스트 "
                       "케이스」 데이터베이스에서 `구분 = %s` 로 거른다. (원본: `2_QA-테스트케이스.csv`)"
                       % (len(ks), k))
            i = j; continue
        out.append(lines[i]); i += 1
    if done != by_kind:
        die("절별 TC 수가 총계와 다르다 — 표가 절 밖에 흩어져 있다: %s ≠ %s" % (done, by_kind))
    return os.path.join(DST, "1_QA시나리오-본문.md"), "\n".join(out)

def build_guide():
    p = os.path.join(DST, "0_임포트-안내.md")
    s = io.open(p, encoding="utf-8").read()
    o = re.search(r"(데이터베이스 «QA 테스트 케이스» — )(\d+)건", s)
    if not o:
        die("안내문에서 건수 앵커를 찾지 못했다")
    s = s[:o.start(2)] + str(len(recs)) + s[o.end(2):]
    row = re.search(r"^\| `2b_QA-테스트케이스-추가분\.csv` \|.*$", s, re.M)
    if not row:
        die("안내문에서 2b 설명 행을 찾지 못했다")
    # 추가분이 없으면 2b 설명도 건드리지 않는다 — 지난 회차 안내가 그대로 유효하다.
    # 「0건」으로 덮으면 이미 임포트한 사람에게 «Merge 할 것이 없다»고 잘못 말한다.
    if not delta:
        return p, s
    rw = [i for i in delta if i[0] not in newly]
    nw = [i for i in delta if i[0] in newly]
    txt = ("| `2b_QA-테스트케이스-추가분.csv` | **이미 %d행을 넣은 뒤**라면 이것만 Merge — **%d건**"
           % (len(recs) - len(nw), len(delta)))
    if rw:
        txt += "(재작성 " + "·".join(i[0] for i in rw) + ("  / 신규 " + "·".join(i[0] for i in nw) if nw else "") + ")"
    elif nw:
        txt += "(신규 " + "·".join(i[0] for i in nw) + ")"
    txt += ". 재작성분은 **같은 TC ID 로 덮어쓴다** |"
    return p, s[:row.start()] + txt + s[row.end():]

plan = [write_csv(CSV2, recs), write_csv(CSV2B, delta), build_body(), build_guide()]

print("QA 노션 세트 생성 — 원본 %s" % os.path.basename(SRC))
print("  TC %d건 %s" % (len(recs), by_kind))
print("  추가분 %d건%s" % (len(delta), (" (신규 %d)" % len(newly)) if newly else ""))
if not delta:
    print("  ⚠ 추가분이 0건이다 — 2b 를 비우지 않고 그대로 둔다(지난 회차 것이 남는다)")
    plan = [x for x in plan if x[0] != CSV2B]

changed = 0
for path, text in plan:
    cur = io.open(path, encoding="utf-8", newline="").read() if os.path.exists(path) else None
    if cur == text:
        continue
    changed += 1
    print("  %s %s" % ("≠" if CHECK else "→", os.path.relpath(path, ROOT)))
    if not CHECK:
        io.open(path, "w", encoding="utf-8", newline="").write(text)
if CHECK:
    if changed:
        print("\n✖ 세트가 원본과 %d개 파일에서 어긋난다 — `python3 tools/build-qa-notion.py` 로 다시 만든다" % changed)
        sys.exit(1)
    print("\n✔ 세트가 원본과 일치한다")
else:
    print("\n✔ %d개 파일 갱신 (변경 없으면 건드리지 않는다)" % changed)
