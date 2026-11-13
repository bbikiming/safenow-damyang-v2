/* =========================================================================
 * 담양군 중대재해예방 통합관리시스템 v2 — 통합 현황 대시보드 (DYDSH)
 *   권한 전환(DYROLE, js/layout.js) 3계층에 따라 서로 다른 대시보드를 렌더한다.
 *     head  — 군수(총괄 책임자): 군 전체 거버넌스 뷰 (종합 이행률·책임체계·결재 대기)
 *     super — 실과장·사업소장·읍면장(관리감독자): 소관 부서 스코프 뷰
 *     staff — 업무담당자(실무 수행자): 내 할일·시기도래 중심 실무 뷰
 *   컴포넌트는 표준 계열만 사용: card / statbox / table-figma / chip-status(+toneOf) /
 *   progress / dsh-* (css/v2.css). 우측 상단 사용자 칩으로 권한 전환.
 * ========================================================================= */
(function (global) {
    'use strict';

    /* 교육 주석은 교육 데이터에서 센다 — 고정 문구(«미달 2부서»·«대상 2명 미이수»)는 예시 데이터를 바꿀 때마다 어긋났다(2026-11-13) */
    function eduNotes() {
        const ED = window.DYEDU; let short = null, hireNone = null;
        try {
            if (ED && ED.deptSummary) short = ED.deptSummary(DYV2.today()).filter(r => r.assessable && r.pct < 100).length;
            if (ED && ED.hireStatus && ED.load) hireNone = (ED.load().workers || []).filter(w => { const h = ED.hireStatus(w.id); return h && h.status === 'NONE'; }).length;
        } catch (e) { /* 교육 데이터가 없는 화면 — 문구를 비운다 */ }
        return {
            short: short === null ? '' : (short ? '미달 ' + short + '부서' : '전 부서 완료'),
            hire: hireNone === null ? '' : (hireNone ? '대상 ' + hireNone + '명 미이수' : '미이수 없음')
        };
    }


    const E = s => global.DYV2 ? global.DYV2.esc(s) : String(s == null ? '' : s);
    const chip = label => '<span class="chip-status ' + global.DYV2.toneOf(label) + '">' + E(label) + '</span>';
    const barCls = r => r >= 70 ? 'green' : r >= 40 ? 'warning' : 'danger';

    /* ── 법정 의무 행 공용 ──
     *   중처법 시행령 §4·§5 의 "반기 1회 이상 점검" 의무와 산안법 주기 의무를
     *   근거 조문·주기·마감 D-day 와 함께 표기한다.
     *   기준일은 DYV2.today() 단일 출처 — 시연일 변경은 common.js DEMO_TODAY 한 줄. */
    function ddays(iso) { return DYV2.daysTo(iso); }
    /* 상태는 **기한에서 파생**한다 — 시드에 '진행'이라 적어 두면 오늘이 바뀔 때 조용히 어긋난다.
     * (실제 결함: 기한이 지난 3건이 '진행'으로 남아 상단 '기한 초과 0건'과 모순됐다.)
     * 시드는 여전히 시드다 — 바뀌는 건 표시 라벨뿐이고 집계 구조는 그대로다. */
    function dueSt(iso, fallback) {
        if (fallback === '완료') return fallback;
        const d = ddays(iso);
        if (d == null) return fallback || '진행';
        return d < 0 ? '기한초과' : d <= 7 ? '주의' : (fallback || '진행');
    }
    /* 미니 달력 — '오늘'이 든 달을 DYV2.today() 에서 그린다(§11).
     * 종전에는 6월 그리드가 통째로 하드코딩돼 있어 지난달 11일을 '오늘'로 표시했다.
     * 마크업·클래스(mini-cal / day / today / has-due / muted)는 그대로 쓴다. */
    function miniCal(dueIsoList) {
        const t = DYV2.today(), y = +t.slice(0, 4), m = +t.slice(5, 7), d = +t.slice(8, 10);
        const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();      /* 0=일 */
        const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
        const prevLast = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
        const due = {};
        (dueIsoList || []).forEach(iso => {
            if (String(iso).slice(0, 7) === t.slice(0, 7)) due[+String(iso).slice(8, 10)] = 1;
        });
        const cells = [];
        for (let i = first - 1; i >= 0; i--) cells.push({ n: prevLast - i, muted: true });
        for (let i = 1; i <= last; i++) cells.push({ n: i });
        let nx = 1;
        while (cells.length % 7) cells.push({ n: nx++, muted: true });
        let rows = '';
        for (let i = 0; i < cells.length; i += 7) {
            rows += '<tr>' + cells.slice(i, i + 7).map(c =>
                '<td><span class="day' + (c.muted ? ' muted' : '') +
                (!c.muted && c.n === d ? ' today' : '') +
                (!c.muted && due[c.n] ? ' has-due' : '') + '">' + c.n + '</span></td>').join('') + '</tr>';
        }
        return { title: y + '년 ' + m + '월', rows: rows, off: !Object.keys(due).length };
    }
    function dday(iso) {
        const d = ddays(iso);
        return d < 0 ? 'D+' + (-d) : d === 0 ? 'D-day' : 'D-' + d;
    }
    /* 근거 표기는 법령 근거 단일 출처(js/law-map.js)에서 파생한다 — 화면에 문자열을 직접 쓰지 않는다 */
    function lawRef(basis) {
        if (!basis) return '';
        var k = window.DYLAW && DYLAW.resolveBasis(basis);
        return k ? E(DYLAW.shortRef(k)) : E(basis);
    }
    /* 주기 근거 — 법률 조문은 "대통령령/고용노동부령으로 정한다"로 위임만 하므로,
       "왜 이 주기인가"의 답은 시행령·시행규칙에 있다. 그 출처를 함께 보여준다. */
    function cycleSrc(basis) {
        if (!basis) return '';
        var k = window.DYLAW && DYLAW.resolveBasis(basis);
        return k ? ' <span class="dsh-law-cyclesrc">주기 ' + E(DYLAW.shortRef(k)) + '</span>' : '';
    }

    function lawRow(x) {
        const d = x.due ? ddays(x.due) : null;
        const dCls = d == null ? '' : d < 0 ? ' over' : d <= 30 ? ' soon' : '';
        return '<a class="dsh-law-row" href="' + x.href + '">' +
            '<div class="dsh-law-main"><b>' + E(x.name) + '</b>' +
                '<span class="dsh-law-meta">' + lawRef(x.basis) + ' · ' + E(x.cycle) +
                    cycleSrc(x.cycleBasis === x.basis ? '' : x.cycleBasis) +
                    (x.note ? ' · ' + E(x.note) : '') + '</span></div>' +
            (x.due ? '<span class="dsh-law-dday' + dCls + '">' + dday(x.due) + '</span>' : '') +
            chip(x.st) +
        '</a>';
    }

    /* ── 시각화 공용 헬퍼 (css/v2.css .dsh-spark/.dsh-mbar/… 계열) ── */
    /* 스파크라인 — SVG polyline, 값 배열을 240×34 뷰박스에 정규화 */
    function sparkline(values, label) {
        const min = Math.min.apply(null, values), max = Math.max.apply(null, values);
        const span = (max - min) || 1;
        const pts = values.map((v, i) =>
            (i * (240 / (values.length - 1))).toFixed(1) + ',' +
            (30 - ((v - min) / span) * 26).toFixed(1)).join(' ');
        const last = pts.split(' ').pop().split(',');
        return '<div class="dsh-spark" role="img" aria-label="' + E(label) + ' — 최저 ' + min + ', 최고 ' + max + '">' +
            '<svg viewBox="0 0 240 34" preserveAspectRatio="none" aria-hidden="true">' +
                '<polyline points="' + pts + '" fill="none" stroke="var(--main)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
                '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="3" fill="var(--main)"/>' +
            '</svg>' +
            '<span class="dsh-spark-label">' + E(label) + '</span>' +
        '</div>';
    }
    /* 가로 막대 행 — 기존 .dsh-rate-row 계열 재사용 (값/최대값 스케일) */
    function hbarRow(label, val, max, cls, href, unit) {
        const w = Math.max(4, Math.round(val / (max || 1) * 100));
        const inner = '<span class="rate-label">' + E(label) + '</span>' +
            '<div class="progress"><div class="progress-bar ' + cls + '" style="width:' + w + '%"></div></div>' +
            '<span class="rate-num">' + val + (unit || '건') + '</span>';
        return href
            ? '<a class="dsh-rate-row" href="' + href + '" style="text-decoration:none;">' + inner + '</a>'
            : '<div class="dsh-rate-row">' + inner + '</div>';
    }

    /* ── 예시 자료 — 부서별 이행률 (head 뷰) · deptId 는 DYV2.ORG 와 동일 ──
     * 이행률(rate)만 예시 자료다. **기한 초과는 실집계**다 — 내 할일과 같은 원본(MYWORK.itemsFor,
     * 부서 관점)에서 센다(deptTasks). 아래 overdue 는 그 원본이 없는 화면에서만 쓰는 폴백이다.
     * 종전 SUPER_SEED(부서별 업무·제출 확인·위험요인·에이징 시드)는 걷었다(2026-11-13) — 같은 부서를
     * 담당자·부서장·군수가 서로 다른 숫자로 봤다(§4-3 «실집계와 시드를 같은 카드에 섞지 말 것»). */
    const DEPT_RATES = [
        { id: 'safety',       name: '재난안전과',     rate: 92, overdue: 0 },
        { id: 'env',          name: '환경과',         rate: 81, overdue: 0 },
        { id: 'construct',    name: '건설과',         rate: 74, overdue: 1 },
        { id: 'plan',         name: '기획예산실',     rate: 70, overdue: 0 },
        { id: 'acct',         name: '회계과',         rate: 68, overdue: 1 },
        { id: 'town_damyang', name: '담양읍',         rate: 66, overdue: 0 },
        { id: 'health',       name: '보건소',         rate: 63, overdue: 0 },
        { id: 'culture',      name: '문화체육과',     rate: 61, overdue: 0 },
        { id: 'facility',     name: '공공시설사업소', rate: 58, overdue: 0 },
        { id: 'finance',      name: '재무과',         rate: 55, overdue: 0 },
        { id: 'water',        name: '물순환사업소',   rate: 45, overdue: 1 },
    ];

    /* 부서 업무 — 내 할일(MYWORK.itemsFor)과 같은 원본. deptView 는 배정자와 무관하게 부서 전체를 센다.
       원본이 없으면 null(화면이 «집계할 수 없습니다»로 밝힌다). */
    function deptTasks(deptId) {
        const MW = global.MYWORK;
        if (!deptId || !MW || !MW.itemsFor) return null;
        return MW.itemsFor(deptId, { deptView: true }).filter(i => i.status !== 'DONE');
    }
    /* 내 할일(그 사람의 관점) — 카테고리별 잔여·시기도래가 그 사람의 내 할일과 같아야 한다 */
    function myTasks(deptId) {
        const MW = global.MYWORK;
        if (!deptId || !MW || !MW.itemsFor) return null;
        return MW.itemsFor(deptId).filter(i => i.status !== 'DONE');
    }
    function overdueOf(list) { return (list || []).filter(i => i.due && ddays(i.due) < 0).length; }
    function deptOverdue(d) { const t = deptTasks(d.id); return t ? overdueOf(t) : d.overdue; }
    function catLabel(cat) { const C = global.MYWORK && global.MYWORK.CATS; return (C && C[cat] && C[cat].label) || '기타'; }
    function byDue(a, b) { return (a.due || '9999').localeCompare(b.due || '9999'); }

    /* 예산 — 예산 총괄표(DYBGT) 2026 편성·집행과 같은 값(천원) */
    const BGT_SUM = { plan: 630000, exec: 502200 };
    const BGT_RATE = Math.round(BGT_SUM.exec / BGT_SUM.plan * 100);

    /* 이행점검 하반기 — DEPTCHK 배포 기록에서 파생한다(공개 API 만). 배포 전이면 부서 기한이 없다. */
    function complyH2() {
        const DC = global.DEPTCHK;
        if (!DC || !DC.flow || !DC.summary) return null;
        const y = +DYV2.today().slice(0, 4), per = y + '-H2';
        const c1 = DC.flow.closed(y + '-H1');
        const out = { per: per, h1Closed: c1 ? c1.at : '', dist: 0, due: '', total: 0, submitted: 0 };
        ['comply-industrial', 'comply-citizen'].forEach(ax => {
            const key = ax + '|' + per, d = DC.flow.dist(key);
            if (!d) return;
            const sm = DC.summary(key, { dist: d });
            out.dist++; out.total += sm.total; out.submitted += sm.submitted;
            if (d.due && (!out.due || d.due > out.due)) out.due = d.due;
        });
        return out;
    }
    function complyText(c) {
        if (!c) return '';
        const h1 = c.h1Closed ? '상반기 ' + c.h1Closed.slice(5) + ' 마감 보고' : '상반기 마감 보고 전';
        return c.dist
            ? h1 + ' · 하반기 배포됨 — 제출 기한 ' + c.due + ' · 제출 ' + c.submitted + '/' + c.total
            : h1 + ' · 하반기 점검 배포 전 (재난안전과 배포 예정)';
    }

    /* 부서 위험성평가 — 최근 정기평가(연도)와 올해 수시평가 수를 DYRSK 에서 센다 */
    function rskInfo(deptId) {
        const D = global.DYRSK, y = +DYV2.today().slice(0, 4);
        const o = { thisYear: false, lastYear: 0, lastDone: false, inLast: false, occ: 0 };
        if (!D) return o;
        try {
            const regs = (D.assessments() || []).filter(a => a.type === 'REGULAR');
            o.thisYear = regs.some(a => a.year === y);
            const withDept = regs.filter(a => (a.depts || []).some(dp => dp.deptId === deptId)).sort((a, b) => b.year - a.year);
            if (withDept[0]) { o.lastYear = withDept[0].year; o.inLast = true; o.lastDone = withDept[0].status === 'COMPLETED'; }
            o.occ = (D.occasionals ? D.occasionals() : []).filter(x => x.deptId === deptId && +x.year === y).length;
        } catch (e) {}
        return o;
    }
    function rskNote(r) {
        const y = DYV2.today().slice(0, 4);
        return (r.thisYear ? '' : y + ' 정기평가 미생성 · ') +
            (r.inLast ? r.lastYear + ' 정기평가 ' + (r.lastDone ? '완료' : '진행') : '최근 정기평가 대상 아님') +
            ' · ' + y + ' 수시 ' + r.occ + '건';
    }

    /* 알림 메시지 이력 — 받은 부서가 정해진 예시 자료. 재난안전과(조회 범위 전체)는 군 전체를 본다 */
    const MSG_LOG = [
        { at: '11-12 17:00', ch: '문자', text: '등록 기한 안내 — 11월 정기교육 참석자 등록부 (기한 11-18)', depts: ['culture', 'health', 'facility', 'water', 'town_damyang'] },
        { at: '11-12 14:30', ch: '문자', text: '개선조치 기한 초과 재촉 — 반응조 상부 점검발판 추락', depts: ['water'] },
        { at: '11-09 17:00', ch: '메일', text: '시기도래 주간 요약 (부서장)', depts: '*' },
        { at: '11-06 14:30', ch: '문자', text: '수시평가 개선조치 담당자 지정 통보 (2명)', depts: ['env'] },
    ];

    /* =====================================================================
     * head — 군수(총괄 책임자) 대시보드
     * ===================================================================== */
    function headView() {
        const supers = global.DYV2.orgDepts().length;                   /* 부서형 노드 수 = 관리감독자 */
        const staffN = global.DYV2.orgTotal() - supers - 4;             /* 군수·부군수·국장2 제외 실무 인원 */
        const live = !!(global.MYWORK && global.MYWORK.itemsFor);
        const rates = DEPT_RATES.map(d => Object.assign({}, d, { overdue: deptOverdue(d) }));
        const low = rates.filter(d => d.rate < 60);
        const totalOverdue = rates.reduce((a, d) => a + d.overdue, 0);

        const hero =
            '<div class="dsh-hero">' +
              '<div class="dsh-hero-main">' +
                '<div class="dsh-hero-label">담양군 전체 안전관리 이행률 <span class="dsh-seed-note">예시 자료</span></div>' +
                '<div class="dsh-hero-num">72<em>%</em></div>' +
                '<div class="progress"><div class="progress-bar" style="width:72%"></div></div>' +
                sparkline([58, 60, 61, 63, 64, 66, 68, 67, 69, 70, 68, 72], '최근 12개월 추이') +
                '<div class="dsh-hero-delta">전월 대비 +4%p · 이행률 미흡(60% 미만) 부서 ' + low.length + '곳</div>' +
              '</div>' +
              '<div class="dsh-hero-stats">' +
                /* «중대재해 발생»·«온나라 상신 중»은 집계 원본이 없는 고정값이었다(중대재해 대장 · 상신 경로
                   통합 집계 없음) — 운영 E05(2026-11-04)에 따라 집계가 생길 때까지 칸을 두지 않는다.
                   고정값 칸은 실제 결재중 0건인데 «2건 상신 중»이라고 말했다. */
                '<a class="dsh-hero-stat is-danger" href="my-work.html"><b>' + totalOverdue + '<em>건</em></b><span>기한 초과 업무</span></a>' +
                /* 2026-09-03 — 관리대상 현황(base-targets)은 메뉴에서 뺐다. 사업장 축을 여는
                   화면이 남아 있지 않으므로 «갈 곳 없는 링크»를 남기지 않고 수치만 낸다.
                   형제 3개는 링크라 태그를 <a> 로 두면 눌러도 아무 일이 없는 칸이 된다. */
                '<div class="dsh-hero-stat is-static"><b>23<em>개소</em></b><span>관리 사업장</span></div>' +
              '</div>' +
            '</div>';

        const chain =
            '<div class="card" style="margin-bottom:16px;">' +
              '<div class="card-header"><span class="card-title">책임체계 지정 현황 — 중대재해처벌법 관리체계</span>' +
                '<a class="btn btn-sm btn-secondary" href="menu.html?m=org">조직 관리</a></div>' +
              '<div class="card-body"><div class="dsh-chain">' +
                '<div class="dsh-chain-node tier-head"><span class="dsh-chain-tier">총괄 책임자</span>' +
                  '<b>군수 <em>1명</em></b><span class="dsh-chain-who">경영책임자 (중처법 §2)</span>' + chip('완료') + '</div>' +
                '<span class="dsh-chain-arrow" aria-hidden="true">→</span>' +
                '<div class="dsh-chain-node tier-super"><span class="dsh-chain-tier">부서 관리자 계층</span>' +
                  '<b>실과장·사업소장·읍면장 <em>' + supers + '명</em></b><span class="dsh-chain-who">조회·재촉 권한 계층 — 법정 관리감독자 지정과 다름</span>' + chip('완료') + '</div>' +
                '<span class="dsh-chain-arrow" aria-hidden="true">→</span>' +
                '<div class="dsh-chain-node tier-staff"><span class="dsh-chain-tier">업무담당자</span>' +
                  '<b>실무 수행자 <em>' + staffN + '명</em></b><span class="dsh-chain-who">부서 안전보건 업무 수행</span>' + chip('완료') + '</div>' +
              '</div></div>' +
            '</div>';

        /* 원료·제조물 개소 — 제안요청서 SFR-020 이 「시설 기본현황에 … 원료·제조물
           개소를 표시한다」로 요구한 값이다. 대장(DYMATERIAL)에서 센다 — index.html 이
           material-data.js 를 싣는 이유가 이것이고, 안 실으면 폴백이 하드코딩 수를
           돌려줘 화면이 조용히 거짓말을 한다(2026-09-03 실측으로 드러난 결함). */
        const matN = () => (window.DYMATERIAL && DYMATERIAL.list ? DYMATERIAL.list(true).length : null);

        const targetCard =
            '<div class="card" style="margin-bottom:16px;">' +
              '<div class="card-header"><span class="card-title">중대시민재해 관리대상 기본현황</span>' +
                '<a class="btn btn-sm btn-secondary" href="fac-list.html">시설물 대장</a></div>' +
              '<div class="card-body">' +
                '<div class="statbox-grid cols-3">' +
                  /* 2026-09-03 — 세 축의 목적지. 공중이용시설 판정 후보의 모집단은 FMS
                     대장이라 시설물 대장으로, 원료·제조물은 같은 날 되살린 대장으로 간다.
                     공중교통수단만 대장 화면이 없어 링크를 만들지 않는다 — 갈 곳 없는
                     링크를 남기지 않는다. 건수는 대장에서 세어 화면과 어긋나지 않게 한다. */
                  '<a class="statbox info" href="fac-list.html" style="text-decoration:none;"><div class="statbox-num" style="font-size:var(--fs-22);">판정 전</div><div class="statbox-label">공중이용시설 · FMS 후보</div></a>' +
                  /* 링크를 만들지 않는다 — 이 축의 대장은 메뉴에서 뺐다(대시보드 흡수).
                     개소를 세지 못하면 숫자를 지어내지 않고 «집계 불가»로 밝힌다. */
                  '<div class="statbox warning"><div class="statbox-num"' + (matN() === null ? ' style="font-size:var(--fs-22);"' : '') + '>' +
                    (matN() === null ? '집계 불가' : matN() + '<em style="font-size:var(--fs-12);">건</em>') +
                    '</div><div class="statbox-label">원료·제조물 · 확인 전 예시 자료</div></div>' +
                  '<div class="statbox neutral"><div class="statbox-num" style="font-size:var(--fs-22);">자료 미수신</div><div class="statbox-label">공중교통수단 · 0건으로 단정하지 않음</div></div>' +
                '</div>' +
                '<p style="font-size:var(--fs-12);color:var(--text-gray);margin-top:10px;">공중이용시설은 시설물 대장과 같은 모집단(FMS 수신분)을 셉니다. <b>원료·제조물·공중교통수단은 이 카드가 개소를 밝히는 유일한 자리입니다</b> — 제안요청서가 요구한 것이 개소 표시이고, 두 축은 전용 대장 화면을 두지 않았습니다. 확인 전 자료를 0개소로 표시하지 않습니다.</p>' +
              '</div>' +
            '</div>';

        const deptRows = rates.map(d =>
            '<tr' + (d.rate < 60 ? ' class="is-low"' : '') + '>' +
              '<td style="font-weight:600;">' + E(d.name) + '</td>' +
              '<td><div class="dsh-dept-bar"><div class="progress"><div class="progress-bar ' + barCls(d.rate) + '" style="width:' + d.rate + '%"></div></div>' +
                '<span class="dsh-dept-num">' + d.rate + '%</span></div></td>' +
              '<td style="text-align:center;">' + (d.overdue ? '<span class="chip-status danger chip-sm">' + d.overdue + '건</span>' : '<span style="color:var(--text-gray);">—</span>') + '</td>' +
              '<td>' + chip(d.rate >= 70 ? '이행' : d.rate >= 60 ? '주의' : '보완필요') + '</td>' +
            '</tr>').join('');
        const deptCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">부서별 안전관리 이행 현황</span>' +
                '<span class="dsh-seed-note">이행률은 예시 자료' + (live ? ' · 기한 초과 = 부서 할 일 실집계' : ' · 기한 초과도 예시 자료') + '</span>' +
                '<a class="btn btn-sm btn-secondary" href="stats.html">현황 통계</a></div>' +
              '<div class="card-body"><div style="overflow-x:auto;"><table class="table-figma">' +
                '<thead><tr><th>부서</th><th>이행률</th><th style="text-align:center;">기한 초과</th><th>상태</th></tr></thead>' +
                '<tbody>' + deptRows + '</tbody>' +
              '</table></div></div>' +
            '</div>';

        /* 중처법 시행령 §4 — 안전보건관리체계 구축·이행 9개 의무.
         *   3·5·7·8·9호는 "반기 1회 이상 점검" 명시 의무 → 하반기 점검 마감 D-day 표기. */
        const H2_DUE = '2026-12-31';
        const duties = [
            { name: '안전·보건 목표와 경영방침 설정',          basis: '시행령 §4 1호', cycle: '상시 게시',    st: '완료',   href: 'menu.html?m=policy' },
            { name: '안전보건 업무 전담조직 구성·운영',        basis: '시행령 §4 2호', cycle: '상시',         st: '완료',   href: 'menu.html?m=org' },
            { name: '유해·위험요인 확인·개선 (위험성평가)',    basis: '시행령 §4 3호', cycle: '반기 1회 점검', st: '진행',   href: 'rsk-list.html', due: H2_DUE },
            { name: '재해예방 예산 편성·집행',                 basis: '시행령 §4 4호', cycle: '연간·상시',    st: '진행',   href: 'bgt-main.html', note: '집행률 ' + BGT_RATE + '%' },
            { name: '안전보건관리책임자 등 권한 부여·평가',    basis: '시행령 §4 5호', cycle: '반기 1회 평가', st: '진행',   href: 'evl-eval.html', due: H2_DUE, note: '하반기 평가 진행 중' },
            { name: '안전관리자 등 전문인력 배치',             basis: '시행령 §4 6호', cycle: '상시',         st: '완료',   href: 'menu.html?m=org' },
            { name: '종사자 의견청취 절차 운영',               basis: '시행령 §4 7호', cycle: '반기 1회 점검', st: '완료',   href: 'menu.html?m=opinion', note: '산보위 갈음' },
            /* 2026-09-03 — 기준문서함(docs-archive)은 메뉴에서 뺐다. 매뉴얼 «점검»의
               회차별 증빙을 보는 자리는 이행 관리다. */
            /* 원료·제조물 건수는 대장에서 센다 — 하드코딩하면 등록·중지 후 화면과 어긋난다 */
            /* 이행 관리는 ?item= 으로 그 이행항목을 펼친 채 연다(운영 E12) — 조건 없이 보내면 첫 화면에 항목이 없다 */
            { name: '중대재해·급박한 위험 대비 매뉴얼 점검',   basis: '시행령 §4 8호', cycle: '반기 1회 점검', st: '진행',   href: 'cmp-status.html?item=IND-08', due: H2_DUE },
            { name: '도급·용역·위탁 시 기준·절차 확인',        basis: '시행령 §4 9호', cycle: '반기 1회 점검', st: '미착수', href: 'menu.html?m=contract', due: H2_DUE },
        ];
        const doneN = duties.filter(d => d.st === '완료').length;
        const dutyCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">안전보건관리체계 9개 의무 — 중처법 §4·시행령 §4</span>' +
                '<span class="chip-status warning chip-sm">하반기 점검 ' + dday(H2_DUE) + '</span></div>' +
              '<div class="card-body">' +
                '<div class="dsh-law-note">' + (complyText(complyH2()) ? E(complyText(complyH2())) + '. ' : '') + '3·5·7·8·9호는 <b>반기 1회 이상 점검</b>이 법정 의무입니다 (하반기 마감 12-31).</div>' +
                '<div class="dsh-duty-sum"><div class="progress"><div class="progress-bar green" style="width:' + Math.round(doneN / duties.length * 100) + '%"></div></div>' +
                  '<span>' + doneN + ' / ' + duties.length + ' 완료</span></div>' +
                duties.map(lawRow).join('') +
              '</div>' +
            '</div>';

        /* 중처법 시행령 §5 — 안전보건 관계 법령 의무이행에 필요한 관리상 조치 */
        const law5Card =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">관계 법령 이행 관리 — 시행령 §5</span>' +
                '<a class="btn btn-sm btn-secondary" href="menu.html?m=comply">이행관리</a></div>' +
              '<div class="card-body">' +
                lawRow({ name: '관계 법령 의무이행 반기 점검',       basis: '시행령 §5 2항 1호', cycle: '반기 1회', st: '진행', href: 'menu.html?m=comply', due: H2_DUE, note: '상반기 완료' }) +
                lawRow({ name: '미이행 사항 인력·예산 등 지원 조치', basis: '시행령 §5 2항 2호', cycle: '점검 후 즉시', st: '진행', href: 'rsk-list.html', note: '개선 2건' }) +
                lawRow({ name: '법정 교육 실시 확인·미실시 시 지시', basis: '시행령 §5 2항 3·4호', cycle: '반기 1회', st: '진행', href: 'edu-status.html', due: H2_DUE, note: eduNotes().short }) +
              '</div>' +
            '</div>';

        /* 재해·아차사고 월별 추이 — 중대재해 0건의 근거 (예방활동 작동 증빙) */
        const ACC = [2, 1, 3, 0, 2, 1, 1, null, null, null, null, null];  /* null = 미도래 월 */
        const accMax = Math.max.apply(null, ACC.filter(v => v != null));
        const accCols = ACC.map((v, i) => {
            const future = v == null;
            const h = future ? 4 : Math.max(4, Math.round(v / accMax * 52));
            return '<div class="dsh-mbar-col' + (v === 0 ? ' zero' : '') + (future ? ' future' : '') + '"' +
                ' title="' + (i + 1) + '월 ' + (future ? '미도래' : '아차사고·신고 ' + v + '건') + '">' +
                (future ? '' : '<span class="dsh-mbar-num">' + v + '</span>') +
                '<div class="dsh-mbar-bar" style="height:' + h + 'px;"></div>' +
                '<span class="dsh-mbar-lbl">' + (i + 1) + '</span></div>';
        }).join('');
        const accCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">재해·아차사고 추이 (월별)</span>' +
                '<span class="chip-status success chip-sm">중대재해 0건 지속</span></div>' +
              '<div class="card-body">' +
                '<div class="dsh-mbar" role="img" aria-label="월별 아차사고·신고 건수 — 1월 2건부터 7월 1건까지, 중대재해 0건 지속">' + accCols + '</div>' +
                '<div class="dsh-viz-legend"><span><i style="background:var(--status-info-fg);"></i>아차사고·종사자 신고</span>' +
                  '<span><i style="background:var(--gray-200);"></i>0건</span>' +
                  '<a href="rsk-occ.html" style="margin-left:auto; color:var(--main-dark); font-weight:700;">신고 현황 →</a></div>' +
              '</div>' +
            '</div>';

        /* «결재·보고 대기 2건 [결재]» 카드는 걷었다(운영 E05 와 같은 근거, 2026-11-05) — 상신 경로를 모은
           집계가 없어 고정값이었고, 승인·반려는 온나라 몫이라 이 시스템에 결재 버튼을 두지 않는다(CLAUDE.md §7-1). */

        /* 예산 집행 도넛 — 항목별 분해 (시행령 §4 4호 "편성·집행" 증빙 관점) */
        /* 예산 총괄표(DYBGT)와 같은 값이어야 한다 — 이 카드의 [예산 총괄표] 버튼이
           바로 그 화면을 연다. 종전 리터럴(편성 4.20억·집행률 64.5%)은 시드
           실집계와 어긋나, 시연 중
           버튼 한 번에 두 숫자가 나란히 드러났다. */
        const BGT = [
            { name: '시설(소방·안전난간)', amt: '3.07억', pct: 48.7, color: 'var(--main)' },
            { name: '장비',              amt: '1.09억', pct: 17.3, color: 'var(--status-info-fg)' },
            { name: '안전장구류',         amt: '0.87억', pct: 13.8, color: 'var(--status-warning-fg)' },
            { name: '미집행',            amt: '1.28억', pct: 20.3, color: 'var(--gray-200)' },
        ];
        let acc2 = 0;
        const donutStops = BGT.map(s => {
            const from = acc2; acc2 += s.pct;
            return s.color + ' ' + from + '% ' + acc2 + '%';
        }).join(', ');
        const donutLegend = BGT.map(s =>
            '<div class="dsh-legend-row"><i style="background:' + s.color + ';"></i>' +
            '<span>' + E(s.name) + '</span><b>' + E(s.amt) + '</b></div>').join('');
        const budgetCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">안전보건 예산 집행 — 시행령 §4 4호</span><span class="dsh-seed-note">예산 총괄표 시드 기준</span>' +
                '<a class="btn btn-sm btn-secondary" href="bgt-main.html">예산 총괄표</a></div>' +
              '<div class="card-body">' +
                '<div class="dsh-donut-wrap">' +
                  /* 2026 편성 630,000천원 · 집행 502,200천원 · 80% (DYBGT, 2026-11-13) */
                  '<div class="dsh-donut" data-center="' + BGT_RATE + '%" role="img"' +
                    ' aria-label="예산 집행률 ' + BGT_RATE + '% — 시설 3.07억(48.7%), 장비 1.09억(17.3%), 안전장구류 0.87억(13.8%), 미집행 1.28억(20.3%)"' +
                    ' style="background:conic-gradient(' + donutStops + ');"></div>' +
                  '<div class="dsh-donut-legend">' + donutLegend + '</div>' +
                '</div>' +
                '<div class="dsh-duty-row"><span>2026년 편성액</span><b>6.30억 원</b></div>' +
                '<div class="dsh-duty-row"><span>집행액</span><b>5.02억 원</b></div>' +
                '<div class="dsh-duty-row"><span>집행률 70% 미만 2건 (환경과 61% · 담양하수처리장 65%)</span>' + chip('주의') + '</div>' +
              '</div>' +
            '</div>';

        const feedCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">최근 예방활동 (군 전체)</span>' +
                '<span class="dsh-seed-note">위험성평가 기록 기준</span></div>' +
              '<div class="card-body">' + activityFeed() + '</div>' +
            '</div>';

        return hero + targetCard + chain +
            '<div class="dsh-grid">' +
              '<div style="display:flex; flex-direction:column; gap:16px;">' + deptCard + dutyCard + '</div>' +
              '<div style="display:flex; flex-direction:column; gap:16px;">' + law5Card + accCard + budgetCard + feedCard + '</div>' +
            '</div>';
    }

    /* =====================================================================
     * super — 실과장·사업소장·읍면장(관리감독자) 대시보드 (소관 부서 스코프)
     * ===================================================================== */
    /* 교육 이수율은 이수현황 화면과 같은 값이어야 한다 — 이 숫자를 누르면
       edu-status.html?dept=… 로 바로 넘어간다. 종전 시드(96/74/82)는 실집계와
       2~3배 어긋나, 눌러 보는 순간 드러났다. DYEDU 가 없으면 시드로 떨어진다. */
    function eduRate(deptId) {
        try {
            var ED = global.DYEDU;
            if (ED && ED.deptSummary) {
                var row = ED.deptSummary(global.DYV2.today()).filter(function (r) { return r.deptId === deptId; })[0];
                if (row) return row.pct;
            }
        } catch (e) {}
        return 0;
    }

    function superView(p) {
        const tasks = deptTasks(p.deptId);                 /* null = 원본 없음 */
        const list = (tasks || []).slice().sort(byDue);
        const overdueN = overdueOf(list);
        const c = staffCounts(p.deptId);                   /* 개선조치 실집계 — staffView 와 같은 원본 */
        const impOpen = c.total - c.done;
        const deptRow = DEPT_RATES.find(d => d.id === p.deptId) || { rate: 60 };
        const headcount = global.DYV2.orgCount(p.deptId, true);
        const ri = rskInfo(p.deptId);

        const hero =
            '<div class="dsh-hero is-dept">' +
              '<div class="dsh-hero-main">' +
                '<div class="dsh-hero-label">' + E(p.deptName) + ' 안전관리 이행률 <span class="dsh-seed-note">예시 자료</span></div>' +
                '<div class="dsh-hero-num">' + deptRow.rate + '<em>%</em></div>' +
                '<div class="progress"><div class="progress-bar ' + barCls(deptRow.rate) + '" style="width:' + deptRow.rate + '%"></div></div>' +
                '<div class="dsh-hero-delta">군 평균 72% ' + (deptRow.rate >= 72 ? '이상' : '미만') + ' · 소속 인원 ' + headcount + '명</div>' +
              '</div>' +
              '<div class="dsh-hero-stats">' +
                '<a class="dsh-hero-stat' + (overdueN ? ' is-danger' : '') + '" href="my-work.html?due=over&dept=' + E(p.deptId) + '"><b>' + (tasks ? overdueN : '-') + '<em>건</em></b><span>기한 초과</span></a>' +
                '<a class="dsh-hero-stat" href="my-work.html?dept=' + E(p.deptId) + '"><b>' + (tasks ? list.length : '-') + '<em>건</em></b><span>부서 할 일</span></a>' +
                '<a class="dsh-hero-stat" href="edu-status.html?dept=' + E(p.deptId) + '"><b>' + eduRate(p.deptId) + '<em>%</em></b><span>교육 이수율</span></a>' +
                '<a class="dsh-hero-stat" href="my-work.html?cat=improve&dept=' + E(p.deptId) + '"><b>' + impOpen + '<em>건</em></b><span>개선조치 미완료</span></a>' +
              '</div>' +
            '</div>';

        /* 부서 할 일 — 내 할일과 같은 원본(부서 전체). 여기에만 있는 업무를 그리지 않는다 */
        const taskRows = list.slice(0, 8).map(t =>
            '<tr><td style="font-weight:600;">' + E(t.title) + '</td>' +
            '<td><span class="chip-mini pdca">' + E(catLabel(t.cat)) + '</span></td>' +
            '<td>' + E(t.due || '-') + '</td>' +
            '<td>' + chip(t.due ? dueSt(t.due, '진행') : '진행') + '</td>' +
            '<td>' + (t.href ? '<a class="btn btn-sm btn-outline" href="' + E(t.href) + '">이동</a>' : '') + '</td></tr>').join('');
        const taskCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">우리 부서 할 일</span>' +
                '<a class="btn btn-sm btn-secondary" href="my-work.html?dept=' + E(p.deptId) + '">내 할일 전체</a></div>' +
              '<div class="card-body">' +
                (!tasks ? '<div class="v2-empty">부서 할 일을 집계할 수 없습니다.</div>'
                 : !list.length ? '<div class="v2-empty">진행 중인 부서 할 일이 없습니다.</div>'
                 : '<div style="overflow-x:auto;"><table class="table-figma">' +
                     '<thead><tr><th>업무</th><th>분류</th><th>기한</th><th>상태</th><th></th></tr></thead>' +
                     '<tbody>' + taskRows + '</tbody></table></div>' +
                   (list.length > 8 ? '<p style="font-size:var(--fs-12);color:var(--text-gray);margin-top:8px;">외 ' + (list.length - 8) + '건 — 내 할일에서 모두 봅니다.</p>' : '')) +
              '</div>' +
            '</div>';

        /* 관리감독자 본인 정기교육 — 이수현황과 같은 원본(DYEDU.statusRow) */
        let supNote = '', supSt = '진행';
        try {
            const ED = global.DYEDU, w = ED && ED.workerOf ? ED.workerOf('w_' + p.uid) : null;
            if (w && ED.statusRow) {
                const r = ED.statusRow(w, DYV2.today());
                supNote = r.done + '/' + r.need + 'h 인정'; supSt = r.complete ? '완료' : '진행';
            }
        } catch (e) {}
        const lawSupCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">관리감독자 법정 직무 — 산안법 §16 · 시행령 §15</span>' +
                '<span class="chip-status info chip-sm">' + E(p.deptName) + '</span></div>' +
              '<div class="card-body">' +
                '<div class="dsh-law-note">관리감독자는 소관 부서의 <b>생산과 관련되는 업무와 소속 직원을 직접 지휘·감독</b>하며 아래 직무를 수행합니다. 미이행 시 중처법 시행령 §4 5호 평가에 반영됩니다.</div>' +
                lawRow({ name: '기계·기구·설비 안전 점검, 이상 시 즉시 조치', basis: '시행령 §15 1호', cycle: '수시',
                         st: c.over ? '주의' : '진행', href: 'fac-list.html', note: c.over ? '개선 지연 ' + c.over + '건' : '' }) +
                lawRow({ name: '보호구·방호장치 점검과 착용·사용 교육·지도', basis: '시행령 §15 2호', cycle: '수시', st: '진행', href: 'edu-status.html?dept=' + E(p.deptId) }) +
                lawRow({ name: '산업재해 보고와 응급조치 (발생 시)',          basis: '시행령 §15 3호', cycle: '발생 즉시', st: '진행', href: 'rsk-occ.html' }) +
                lawRow({ name: '작업장 정리정돈·통로 확보 확인·감독',        basis: '시행령 §15 4호', cycle: '수시', st: '진행', href: 'fac-list.html' }) +
                lawRow({ name: '부서 위험성평가 참여 — 유해·위험요인 파악·개선', basis: '산안법 §36 · 시행령 §15', cycle: '정기 연 1회 + 수시',
                         st: ri.thisYear ? '진행' : '예정', href: 'rsk-occ.html', note: rskNote(ri) }) +
                lawRow({ name: '관리감독자 본인 정기교육 이수 (연 16h)',      basis: '산안법 §29 · 시행규칙 별표4', cycle: '연간', st: supSt, href: 'edu-sup.html', due: '2026-12-31', note: supNote }) +
              '</div>' +
            '</div>';

        /* 위험성평가 · 개선조치 — 전부 실집계(DYRSK) */
        const fnRows = [['개선 발행', c.total], ['개선 완료', c.done], ['진행 중', impOpen - c.over], ['기한 초과', c.over]];
        const fnMax = Math.max(1, c.total);
        const funnelHtml = c.total
            ? '<div class="dsh-funnel" role="img" aria-label="개선조치 — 발행 ' + c.total + '건, 완료 ' + c.done + '건, 진행 ' + (impOpen - c.over) + '건, 기한 초과 ' + c.over + '건">' +
                fnRows.map(s2 =>
                    '<div class="dsh-funnel-row"><span class="fn-label">' + s2[0] + '</span>' +
                    '<div class="dsh-funnel-bar" style="width:' + Math.max(12, Math.round(s2[1] / fnMax * 100)) + '%;">' + s2[1] + '</div></div>').join('') +
              '</div>'
            : '';
        const rskCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">위험성평가 · 개선조치</span>' +
                '<span class="dsh-seed-note">위험성평가 기록 기준</span>' +
                '<a class="btn btn-sm btn-secondary" href="rsk-occ.html">위험성평가</a></div>' +
              '<div class="card-body"><div class="statbox-grid cols-3">' +
                '<div class="statbox info"><div class="statbox-num" style="font-size:var(--fs-18);">' +
                    (ri.thisYear ? DYV2.today().slice(0, 4) + ' 진행' : DYV2.today().slice(0, 4) + ' 미생성') + '</div>' +
                    '<div class="statbox-label">정기평가' + (ri.inLast ? ' · 최근 ' + ri.lastYear + ' ' + (ri.lastDone ? '완료' : '진행') : '') + '</div></div>' +
                '<a class="statbox neutral" href="rsk-occ.html" style="text-decoration:none;"><div class="statbox-num">' + ri.occ + '</div><div class="statbox-label">' + DYV2.today().slice(0, 4) + ' 수시평가 (건)</div></a>' +
                '<a class="statbox ' + (c.over ? 'danger' : 'neutral') + '" href="my-work.html?cat=improve&due=over&dept=' + E(p.deptId) + '" style="text-decoration:none;">' +
                    '<div class="statbox-num">' + c.over + '</div><div class="statbox-label">개선조치 지연 (건)</div></a>' +
              '</div>' + funnelHtml + '</div>' +
            '</div>';

        /* 위험요인 유형 — 부서 개선조치의 위험 분류에서 센다 */
        const hz = {};
        try {
            (global.DYRSK ? global.DYRSK.improvements() : []).forEach(m => {
                if (m.dept_id !== p.deptId) return;
                const k = (m.hazard && m.hazard.category) || '기타';
                hz[k] = (hz[k] || 0) + 1;
            });
        } catch (e) {}
        const hzList = Object.keys(hz).map(k => [k, hz[k]]).sort((x, y) => y[1] - x[1]).slice(0, 5);
        const hzMax = Math.max.apply(null, hzList.map(h => h[1]).concat([1]));
        const hazardCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">부서 위험요인 유형' + (hzList.length ? ' TOP ' + hzList.length : '') + '</span>' +
                '<span class="dsh-seed-note">개선조치 위험 분류 기준</span></div>' +
              '<div class="card-body">' +
                (hzList.length ? hzList.map(h => hbarRow(h[0], h[1], hzMax, 'warning', 'my-work.html?cat=improve&dept=' + E(p.deptId))).join('')
                               : '<div class="v2-empty">기록된 위험요인이 없습니다.</div>') +
              '</div>' +
            '</div>';

        /* 개선조치 미완료 경과 — 전달된 날(첫 이력)부터 오늘까지 */
        const ag = [0, 0, 0];
        try {
            (global.DYRSK ? global.DYRSK.improvements() : []).forEach(m => {
                if (m.dept_id !== p.deptId || m.status === 'DONE') return;
                const h0 = (m.history || [])[0];
                const from = h0 && h0.at ? String(h0.at).slice(0, 10) : '';
                const days = from ? -ddays(from) : 0;
                ag[days < 7 ? 0 : days < 28 ? 1 : 2]++;
            });
        } catch (e) {}
        const agMax = Math.max.apply(null, ag.concat([1]));
        const agingCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">개선조치 미완료 ' + impOpen + '건 — 경과 기간</span>' +
                '<a class="btn btn-sm btn-secondary" href="my-work.html?cat=improve&dept=' + E(p.deptId) + '">개선조치</a></div>' +
              '<div class="card-body">' +
                (impOpen
                  ? hbarRow('1주 미만', ag[0], agMax, 'green', 'my-work.html?cat=improve&dept=' + E(p.deptId)) +
                    hbarRow('1~4주 경과', ag[1], agMax, 'warning', 'my-work.html?cat=improve&dept=' + E(p.deptId)) +
                    hbarRow('1개월 이상', ag[2], agMax, 'danger', 'my-work.html?cat=improve&dept=' + E(p.deptId)) +
                    (ag[2] ? '<div class="dsh-law-note" style="margin:8px 0 0;"><b>1개월 이상 ' + ag[2] + '건</b> — 재촉 또는 기한 협의가 필요합니다.</div>' : '')
                  : '<div class="v2-empty">미완료 개선조치가 없습니다.</div>') +
              '</div>' +
            '</div>';

        /* 최근 부서 활동 — 조회 범위 안(DYROLE.inScope)의 위험성평가 기록 */
        const actCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">최근 부서 활동</span></div>' +
              '<div class="card-body">' + activityFeed() + '</div>' +
            '</div>';

        /* 부서원 교육 이수 — 이수현황과 같은 원본(DYEDU.statusRow) */
        let eduRows = '', needSum = 0;
        try {
            const ED = global.DYEDU;
            const ws = ED && ED.workers ? ED.workers().filter(w => w.deptId === p.deptId) : [];
            const rows = ws.map(w => ({ w: w, r: ED.statusRow(w, DYV2.today()) })).filter(x => x.r && x.r.need);
            rows.forEach(x => { needSum += x.r.need; });
            eduRows = rows.slice(0, 5).map(x => {
                const pct = Math.min(100, Math.round(x.r.done / x.r.need * 100));
                return '<div class="dsh-rate-row"><span class="rate-label">' + E(x.w.name) + '</span>' +
                    '<div class="progress"><div class="progress-bar ' + barCls(pct) + '" style="width:' + pct + '%"></div></div>' +
                    '<span class="rate-num">' + pct + '%</span></div>';
            }).join('');
        } catch (e) {}
        const eduCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">부서원 교육 이수 현황</span>' +
                '<a class="btn btn-sm btn-secondary" href="edu-status.html?dept=' + E(p.deptId) + '">이수현황</a></div>' +
              '<div class="card-body">' +
                '<div class="dsh-duty-sum"><div class="progress"><div class="progress-bar ' + barCls(eduRate(p.deptId)) + '" style="width:' + eduRate(p.deptId) + '%"></div></div>' +
                  '<span>부서원 이수 완료 ' + eduRate(p.deptId) + '%' + (needSum ? ' · 필요 ' + needSum + 'h' : '') + '</span></div>' +
                (eduRows || '<div class="v2-empty">교육 대상자 명단이 없습니다.</div>') +
              '</div>' +
            '</div>';

        return hero +
            '<div class="dsh-grid">' +
              '<div style="display:flex; flex-direction:column; gap:16px;">' + taskCard + lawSupCard + rskCard + hazardCard + '</div>' +
              '<div style="display:flex; flex-direction:column; gap:16px;">' + actCard + agingCard + eduCard + '</div>' +
            '</div>';
    }

    /* =====================================================================
     * staff — 업무담당자(실무 수행자) 대시보드
     * ===================================================================== */
    /* 내 부서 개선조치 실집계 — 대시보드 숫자와 [내 할일] 숫자가 어긋나면
     * 링크를 눌러 확인한 사람이 시스템을 못 믿는다. 같은 원본(DYRSK)에서 센다. */
    function staffCounts(deptId) {
        const c = { over: 0, today: 0, week: 0, later: 0, done: 0, total: 0 };
        try {
            const D = global.DYRSK; if (!D) return c;
            const today = D.today();
            D.improvements().forEach(function (m) {
                if (deptId && m.dept_id !== deptId) return;
                c.total++;
                if (m.status === 'DONE') { c.done++; return; }
                const due = m.due || m.due_date || '';
                if (!due) { c.later++; return; }
                if (D.isOverdue(m)) c.over++;
                else if (due === today) c.today++;
                else {
                    const d = (new Date(due) - new Date(today)) / 86400000;
                    if (d > 0 && d <= 7) c.week++; else c.later++;
                }
            });
        } catch (e) {}
        return c;
    }
    /* 예방활동 요약 — 위험성평가 기록(DYRSK)에서 파생한다(운영 E13·P07, 2026-11-04).
     *   · 범위: 조회 범위 안 부서의 활동만(DYROLE.inScope). 종전 예시 목록은 부서 계정에도 다른 부서
     *     (하수처리장 · 재난안전과) 활동을 보여 줬다.
     *   · 주소: 줄마다 **그 활동이 일어난 평가(연도)·그 부서 개선조치**로 간다. 연도 없는 주소는
     *     기본 연도로 떨어져 다른 해 평가를 연다.
     *   · 평가 운영 기록(생성·전달·공문)은 주관부서의 활동이다 — 재난안전과가 아니면 범위 밖이라 빠진다. */
    const ACT_LABEL = {
        CREATE: '정기평가 생성', DELIVER: '개선조치 전달', DISPATCH: '공문 상신', RECEIVE: '결재 회신',
        COMPLETE: '평가 완료', NOTIFY: '개선조치 도착', STATUS: '개선조치 완료 처리', CONFIRM: '완료 확인',
        RETURN: '완료 확인 반려', AMEND: '담당자·기한 변경', REMIND: '재촉', REGISTER: '수시평가 등록',
        REVIEW: '안전관리자 검토', SUBMIT: '설문조사표 제출', OCC_STATUS: '위험성 감소대책 등록'
    };
    function activityFeed() {
        const D = global.DYRSK, R = global.DYROLE;
        if (!D) return '<div class="v2-empty">최근 활동이 없습니다.</div>';
        const inScope = id => !R || !R.inScope || R.inScope(id);
        const own = (R && R.OWNER_DEPT) || 'safety';
        const rows = [];
        const push = (at, deptId, type, subj, href) => {
            if (!at || !inScope(deptId)) return;
            rows.push({ at: String(at), deptId, type, subj: subj || '', href });
        };
        try {
            (D.assessments() || []).forEach(a => {
                const href = 'rsk-list.html?year=' + a.year;
                (a.history || []).forEach(h => push(h.at, own, h.type, a.year + '년 정기 위험성평가', href));
                (a.depts || []).forEach(dp => push(dp.reportAt, dp.deptId, 'SUBMIT', a.year + '년 정기 위험성평가',
                    href + '&dept=' + encodeURIComponent(dp.deptId)));
            });
            (D.improvements() || []).forEach(m => {
                let href;
                if (m.occ_id || m.source_type === 'occasional') {
                    const o = D.occasionalOf ? D.occasionalOf(m.occ_id) : null;
                    href = 'rsk-occ.html' + (o ? '?year=' + o.year : '');
                } else {
                    const a = D.assessmentOf ? D.assessmentOf(m.assessment_id) : null;
                    href = 'rsk-list.html' + (a ? '?year=' + a.year + '&dept=' + encodeURIComponent(m.dept_id) : '');
                }
                const subj = (m.hazard && m.hazard.name) || m.hazard_risk_factor || '개선조치';
                (m.history || []).forEach(h => push(h.at, m.dept_id, h.type, subj, href));
            });
            (D.occasionals ? D.occasionals() : []).forEach(o => {
                const href = 'rsk-occ.html?year=' + o.year;
                /* 수시평가의 STATUS 는 «감소대책 등록 → 개선조치 전환»이다 — 개선조치의 완료 처리와 다른 뜻 */
                (o.history || []).forEach(h => push(h.at, o.deptId, h.type === 'STATUS' ? 'OCC_STATUS' : h.type,
                    '수시 위험성평가 — ' + String(o.desc || '').split(' · ')[0], href));
            });
        } catch (e) {}
        rows.sort((x, y) => y.at.localeCompare(x.at));
        const top = rows.slice(0, 5);
        if (!top.length) return '<div class="v2-empty">최근 활동이 없습니다.</div>';
        return top.map(r =>
            '<div class="dsh-feed-item"><span class="dsh-feed-time">' + E(r.at.slice(0, 10)) + '</span><span>' +
              E(D.deptName(r.deptId)) + ' — ' + E(ACT_LABEL[r.type] || '기록') + ' · ' + E(r.subj) +
              (r.href ? ' <a href="' + E(r.href) + '" style="color:var(--main-dark); font-weight:700;">보기</a>' : '') +
            '</span></div>').join('');
    }
    function staffView(p) {
        p = p || (global.DYROLE && global.DYROLE.current());
        const deptId = (p && p.deptId) || '';
        const deptNm = deptId && global.DYV2.orgNode(deptId) ? global.DYV2.orgNode(deptId).name : '';
        const c = staffCounts(deptId);
        const dq = deptId ? '&dept=' + E(deptId) : '';
        /* 라벨을 '개선조치'로 좁힌다 — 내 할일 전체(교육·점검 포함)와 모수가 다르므로
           같은 이름을 쓰면 또 어긋나 보인다. 이 4칸이 세는 건 개선조치다. */
        const myWork =
            (deptNm ? '<p class="dsh-scope">' + E(deptNm) + ' — 내 부서 개선조치</p>' : '') +
            '<div class="statbox-grid cols-4" style="margin-bottom:16px;">' +
              '<a class="statbox danger" href="my-work.html?cat=improve&due=over' + dq + '" style="text-decoration:none;"><div class="statbox-num">' + c.over + '</div><div class="statbox-label">기한 초과 (건)</div></a>' +
              '<a class="statbox warning" href="my-work.html?cat=improve&due=today' + dq + '" style="text-decoration:none;"><div class="statbox-num">' + c.today + '</div><div class="statbox-label">오늘 마감 (건)</div></a>' +
              '<a class="statbox info" href="my-work.html?cat=improve&due=week' + dq + '" style="text-decoration:none;"><div class="statbox-num">' + c.week + '</div><div class="statbox-label">1주일 이내 (건)</div></a>' +
              '<a class="statbox neutral" href="my-work.html?view=done' + dq + '" style="text-decoration:none;"><div class="statbox-num">' + c.done + '</div><div class="statbox-label">완료 (건)</div></a>' +
            '</div>';

        /* D-day 구간 스트립 — 위 집계와 같은 원본. 0건 구간은 스트립에서 뺀다(폭 0은 안 읽힌다) */
        const dueSeg = [
            ['지연 ' + c.over,   c.over,  't-danger',  'my-work.html?cat=improve&due=over' + dq],
            ['오늘 ' + c.today,  c.today, 't-warning', 'my-work.html?cat=improve&due=today' + dq],
            ['이번주 ' + c.week, c.week,  't-info',    'my-work.html?cat=improve&due=week' + dq],
            ['예정 ' + c.later,  c.later, 't-neutral', 'my-work.html?cat=improve' + dq],
        ].filter(function (s) { return s[1] > 0; });
        const dueStrip = dueSeg.length
            ? '<div class="dsh-stack" role="group" aria-label="내 부서 개선조치 마감 분포 — ' +
                  dueSeg.map(s => s[0] + '건').join(', ') + '">' +
                dueSeg.map(s =>
                    '<a class="' + s[2] + '" href="' + s[3] + '" style="flex:' + s[1] + ' 1 0;"' +
                    ' title="' + s[0] + '건 — 클릭하면 내 할일에서 필터됩니다">' + s[0] + '</a>').join('') +
              '</div>'
            /* 0건을 빈 막대로 두면 '데이터가 안 나온다'로 읽힌다. 사실을 문장으로 말하고,
               할 일이 없는 담당자에게 **다음 행동**(직접 발굴 → 수시평가)을 준다. 빈 화면은
               막다른 길이 되기 쉽다. */
            : '<div class="dsh-empty-strip">' +
              '<b>진행 중인 개선조치가 없습니다.</b>' +
              '<div class="dsh-empty-acts">' +
                (c.done ? '<a class="btn btn-outline btn-sm" href="my-work.html?view=done' + dq + '">완료한 업무 ' + c.done + '건 보기</a>' : '') +
                '<a class="btn btn-outline btn-sm" href="rsk-occ.html">유해위험요인을 발견했다면 — 수시평가 등록</a>' +
              '</div></div>';

        /* 실무자 법정 의무 캘린더 — 이번 반기(2026 하반기) 기준.
         *   산안법 §29(정기교육)·§36(위험성평가)·§24(산보위)·§125(작업환경측정) +
         *   중처법 시행령 §5(의무이행 점검표). 마감 D-day 순으로 표기, 내 할일과 딥링크 연동. */
        const EDN = eduNotes();
        const CH2 = complyH2();
        const lawItems = [
            /* 하반기 점검 — 배포 여부·기한·제출 수는 DEPTCHK 배포 기록에서 파생한다 */
            Object.assign({ name: '하반기 의무이행 자체점검', basis: 'cse-5', cycleBasis: 'cse-5', cycle: '반기 1회',
              st: CH2 && CH2.dist ? '진행' : '예정', href: 'menu.html?m=comply', note: complyText(CH2) },
              CH2 && CH2.dist && CH2.due ? { due: CH2.due } : {}),
            { name: '산업안전보건위원회 정기회의',     basis: 'osh-24',  cycleBasis: 'oshe-37',  cycle: '분기 1회',    st: '예정',     href: 'menu.html?m=opinion&sub=committee', due: '2026-12-18', note: '4분기 회의' },
            { name: '수시 위험성평가 · 개선조치',      basis: 'osh-36',  cycle: '연 1회 + 수시', st: '진행',   href: 'rsk-occ.html', note: rskNote(rskInfo(deptId)) },
            { name: '근로자 정기 안전보건교육',        basis: 'osh-29',  cycle: '반기 6h/12h', st: '진행',     href: 'edu-status.html', due: '2026-12-31', note: EDN.short },
            { name: '채용 시 안전보건교육 (신규자)',   basis: 'osh-29',  cycle: '채용 즉시 8h', st: '주의',    href: 'edu-hire.html', note: EDN.hire },
            { name: '작업환경측정',                    basis: 'osh-125', cycleBasis: 'oshr-190', cycle: '반기 1회',    st: '진행',     href: 'work-env.html', due: '2026-12-31', note: '결과보고서 대기' },
        ];
        const lawCalCard =
            '<div class="card" style="margin-bottom:16px;">' +
              '<div class="card-header"><span class="card-title">법정 의무 캘린더 — 2026 하반기</span>' +
                '<a class="btn btn-sm btn-secondary" href="my-work.html">내 할일</a></div>' +
              '<div class="card-body">' +
                '<div class="dsh-law-note">담당 업무 중 <b>법령이 주기를 정한 의무</b>만 모았습니다. 기한초과·마감 임박 건부터 처리하세요 — 행을 누르면 처리 화면으로 이동합니다.</div>' +
                lawItems.map(lawRow).join('') +
              '</div>' +
            '</div>';

        /* 연간 법정 의무 로드맵 (미니 간트) — 어느 달에 의무가 몰리는지 부하 예측.
         *   셀 상태: done 완료 / due 예정 / over 기한초과 / always 상시 · 이번 달 = 외곽선(오늘에서 파생) */
        const NOW_M = +DYV2.today().slice(5, 7);  /* 로드맵 '이번 달' — 오늘 단일 출처 파생 */
        const roadRows = [
            { name: '의무이행 점검표',      basis: '시행령 §5 · 반기',  m: { 7: 'done', 12: 'due' } },
            { name: '산업안전보건위원회',   basis: '산안법 §24 · 분기', m: { 3: 'done', 6: 'done', 9: 'done', 12: 'due' } },
            { name: '수시 위험성평가',      basis: '산안법 §36 · 수시', always: true },
            { name: '근로자 정기교육',      basis: '산안법 §29 · 반기', m: { 6: 'done', 12: 'due' } },
            { name: '채용 시 교육',         basis: '산안법 §29 · 상시', always: true },
            { name: '작업환경측정',         basis: '산안법 §125 · 반기', m: { 6: 'done', 12: 'due' } },
        ];
        const roadHead = '<div class="dsh-road-head"><span></span>' +
            Array.from({ length: 12 }, (_, i) =>
                '<span' + (i + 1 === NOW_M ? ' class="now"' : '') + '>' + (i + 1) + '월</span>').join('') + '</div>';
        const roadBody = roadRows.map(r => {
            const cells = Array.from({ length: 12 }, (_, i) => {
                const mo = i + 1;
                const cls = r.always ? 'always' : (r.m[mo] || '');
                const stTxt = cls === 'done' ? '완료' : cls === 'due' ? '예정' : cls === 'over' ? '기한초과' : cls === 'always' ? '상시' : '';
                return '<span class="dsh-road-cell ' + cls + (mo === NOW_M ? ' now' : '') + '"' +
                    (stTxt ? ' title="' + E(r.name) + ' — ' + mo + '월 ' + stTxt + '"' : '') + '></span>';
            }).join('');
            return '<div class="dsh-road-row"><span class="dsh-road-label" title="' + E(r.basis) + '">' + E(r.name) + '</span>' + cells + '</div>';
        }).join('');
        /* 집중 마감 월은 roadRows 에서 센다 — 숫자를 손으로 적으면 행을 늘릴 때 어긋난다
           (실제로 '12월 4건'이라 적혀 있는데 행은 5개였고 같은 카드 aria-label 은 5를 말했다) */
        const decN = roadRows.filter(r => !r.always && r.m[12]).length;
        const roadCard =
            '<div class="card" style="margin-bottom:16px;">' +
              '<div class="card-header"><span class="card-title">연간 법정 의무 로드맵 (2026)</span>' +
                '<span class="chip-status info chip-sm">12월 마감 ' + decN + '건 집중</span></div>' +
              '<div class="card-body">' +
                '<div class="dsh-road-wrap"><div class="dsh-road" role="img" aria-label="연간 법정 의무 로드맵 — 12월에 점검표·산보위·정기교육·측정 마감이 집중됩니다">' +
                    roadHead + roadBody +
                '</div></div>' +
                '<div class="dsh-viz-legend">' +
                  '<span><i style="background:var(--status-success-bg);"></i>완료</span>' +
                  '<span><i style="background:var(--status-info-bg);"></i>예정</span>' +
                  '<span><i style="background:var(--status-danger-bg);"></i>기한초과</span>' +
                  '<span><i style="background:var(--brand-50);"></i>상시</span>' +
                  '<span style="margin-left:auto;">굵은 외곽선 = 이번 달 (' + NOW_M + '월)</span>' +
                '</div>' +
              '</div>' +
            '</div>';

        /* 시기도래 — 그 사람의 내 할일과 **같은 원본**(MYWORK.itemsFor)에서 기한이 있는 미완료 건만.
           조회 범위 밖 부서의 업무를 «담당 업무»로 그리지 않는다(DYROLE.inScope). */
        const MYT = myTasks(deptId);
        const inScope = id => !global.DYROLE || !global.DYROLE.inScope || global.DYROLE.inScope(id);
        const dueItems = (MYT || []).filter(i => i.due && inScope(i.dept)).sort(byDue).slice(0, 6).map(i => ({
            name: i.title, menu: catLabel(i.cat), due: i.due, href: i.href || 'my-work.html'
        }));
        const dueRows = dueItems.map(x =>
            '<tr><td style="font-weight:600;">' + E(x.name) + '</td>' +
            '<td><span class="chip-mini pdca">' + E(x.menu) + '</span></td>' +
            '<td>' + E(x.due) + '</td><td>' + chip(dueSt(x.due)) + '</td>' +
            '<td><a class="btn btn-sm btn-outline" href="' + E(x.href) + '">이동</a></td></tr>').join('');

        const cal = miniCal(dueItems.map(x => x.due));
        const dueCard =
            '<div class="card" style="margin-bottom:16px;">' +
              '<div class="card-header"><span class="card-title">시기도래 알림</span>' +
                '<div class="tabs" style="margin:0; border:none;">' +
                  '<button class="tab active" id="due-tab-list" onclick="DYDSH.toggleDue(\'list\')">목록</button>' +
                  '<button class="tab" id="due-tab-cal" onclick="DYDSH.toggleDue(\'cal\')">달력 보기</button>' +
                '</div></div>' +
              '<div class="card-body">' +
                '<div id="due-list">' +
                  '<div style="overflow-x:auto;"><table class="table-figma">' +
                    '<thead><tr><th>문서·업무</th><th>대메뉴</th><th>기한</th><th>상태</th><th></th></tr></thead>' +
                    '<tbody>' + (dueRows || '<tr><td colspan="5" style="color:var(--text-gray);">기한이 있는 할 일이 없습니다.</td></tr>') + '</tbody></table></div>' +
                '</div>' +
                '<div id="due-cal" style="display:none;">' +
                  '<p style="font-size:var(--fs-12); font-weight:700; margin-bottom:8px; text-align:center;">' + cal.title + '</p>' +
                  '<table class="mini-cal">' +
                    '<thead><tr><th>일</th><th>월</th><th>화</th><th>수</th><th>목</th><th>금</th><th>토</th></tr></thead>' +
                    '<tbody>' + cal.rows + '</tbody></table>' +
                  '<p style="font-size:var(--fs-12); color:var(--text-gray); text-align:center; margin-top:8px;">● 빨간 점 = 마감 도래 일자' +
                    (cal.off ? ' · 이번 달 마감 없음 — 위 목록에서 확인하세요' : '') + '</p>' +
                '</div>' +
              '</div>' +
            '</div>';

        const ratesRows = Object.keys(global.DYV2.MENUS).map(key => {
            const m = global.DYV2.MENUS[key];
            const r = global.DYV2.complianceRate(key);
            return '<a class="dsh-rate-row" href="' + m.href + '" style="text-decoration:none;">' +
                '<span class="rate-label">' + E(m.label) + '</span>' +
                '<div class="progress"><div class="progress-bar ' + barCls(r) + '" style="width:' + r + '%"></div></div>' +
                '<span class="rate-num">' + r + '%</span></a>';
        }).join('');
        const ratesCard =
            '<div class="card">' +
              /* 부서 화면 아래에 있지만 군 전체 수치다 — 제목에 밝힌다(운영 P07). 안 밝히면 우리 부서 수치로 읽힌다 */
              '<div class="card-header"><span class="card-title">업무문서 처리율 — 대메뉴별 (군 전체)</span>' +
                '<span class="dsh-seed-note">업무문서 처리 기록 기준</span></div>' +
              '<div class="card-body">' + ratesRows + '</div>' +
            '</div>';

        /* 카테고리별 잔여 업무 미니 바 — 내 할일 ?cat= 딥링크 연동
           교육은 내 할일과 **같은 함수**(DYEDU.deptTodos)로 센다(기획확인 4차, 2026-10-06) —
           종전에는 예시 숫자 2라, 같은 부서의 교육 할 일이 두 화면에서 다르게 보였다. */
        /* 카테고리별 잔여 — 그 사람의 내 할일(마감 할일 탭)과 같은 원본을 센다(2026-11-13) */
        const catCount = {};
        (MYT || []).forEach(i => { catCount[i.cat] = (catCount[i.cat] || 0) + 1; });
        const catSeed = Object.keys(catCount).map(k => [catLabel(k), k, catCount[k]]).sort((x, y) => y[2] - x[2]);
        const catMax = Math.max.apply(null, catSeed.map(c => c[2]).concat([1]));
        const catCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">카테고리별 잔여 업무</span>' +
                '<span class="dsh-seed-note">내 할일과 같은 기준 · 미완료 ' + (MYT ? MYT.length : 0) + '건</span>' +
                '<a class="btn btn-sm btn-secondary" href="my-work.html">내 할일</a></div>' +
              '<div class="card-body">' +
                (catSeed.length ? catSeed.map(c => hbarRow(c[0], c[2], catMax, 'blue', 'my-work.html?cat=' + c[1])).join('')
                                : '<div class="v2-empty">남은 할 일이 없습니다.</div>') +
              '</div>' +
            '</div>';

        /* 알림 메시지 이력 — 우리 부서가 받은 것만. 조회 범위가 전체인 재난안전과는 군 전체 */
        const allScope = !!(global.DYROLE && global.DYROLE.scope && global.DYROLE.scope() === 'all');
        const msgs = MSG_LOG.filter(m => allScope || m.depts === '*' || m.depts.indexOf(deptId) !== -1);
        const msgCard =
              '<div class="card">' +
                '<div class="card-header"><span class="card-title">알림 메시지 이력' + (allScope ? ' (군 전체)' : ' (우리 부서)') + '</span>' +
                  '<span class="dsh-seed-note">예시 자료</span></div>' +
                '<div class="card-body">' +
                  (msgs.length ? msgs.map(m =>
                    '<div class="dsh-feed-item"><span class="dsh-feed-time">' + E(m.at) + '</span><span><span class="chip-mini ' + (m.ch === '문자' ? 'wt-elec' : 'wt') + '">' + E(m.ch) + '</span> ' +
                      E(m.text) + (allScope && m.depts !== '*' ? ' · ' + m.depts.map(id => (DYV2.orgNode(id) || {}).name || id).join('·') : '') + '</span></div>').join('')
                    : '<div class="v2-empty">받은 알림 메시지가 없습니다.</div>') +
                '</div>' +
              '</div>';
        const feeds =
            '<div style="display:flex; flex-direction:column; gap:16px;">' +
              catCard +
              '<div class="card">' +
                '<div class="card-header"><span class="card-title">예방활동 요약</span></div>' +
                '<div class="card-body">' + activityFeed() + '</div>' +
              '</div>' +
              msgCard +
            '</div>';

        return myWork + dueStrip + lawCalCard + roadCard + dueCard +
            '<div class="dsh-grid">' + ratesCard + feeds + '</div>';
    }

    function toggleDue(mode) {
        const list = document.getElementById('due-list');
        const cal = document.getElementById('due-cal');
        if (!list || !cal) return;
        list.style.display = mode === 'list' ? '' : 'none';
        cal.style.display = mode === 'cal' ? '' : 'none';
        document.getElementById('due-tab-list').classList.toggle('active', mode === 'list');
        document.getElementById('due-tab-cal').classList.toggle('active', mode === 'cal');
    }

    function init() {
        const root = document.getElementById('dsh-root');
        if (!root || !global.DYROLE || !global.DYV2) return;
        const p = global.DYROLE.current();
        const body = p.tier === 'head' ? headView()
                   : p.tier === 'super' ? superView(p)
                   : staffView(p);
        root.innerHTML = body;
    }

    global.DYDSH = { init, toggleDue };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
