/* =====================================================================
   edu-data.js · 안전보건교육 도메인 데이터·세션 스토어 (DYEDU)
   ---------------------------------------------------------------------
   docs/planning/기획-안전보건교육-재설계-v1.md §9 스키마 반영.
   순수 계산 함수(cycleOf/requiredHours/hireHours)를 분리해 법 해석 변경 시
   함수만 교체 가능하도록 구성. 기준일은 DYV2.today()(CLAUDE.md §11).
   예시 자료는 «2026-11-13 까지 운영한 시스템» 모양이다 — 1~10월 집합교육 완료·공문 회신,
   11월 교육(C-M11) 등록부 받는 중, 12월 교육(C-M12) 교육 전.
   근로자 조직은 DYV2.ORG 파생 + 계약직/일용 목업 시드.

   전역: DYEDU.*  (js/common.js 뒤에 로드)
   ===================================================================== */
(function (global) {
    'use strict';

    /* r5 — 2026-07-30 회의: 기타교육 분류를 법정 3유형으로 재정의(구 5종 폐지) ·
     * 첨부 슬롯(file.slot) 도입. 구 etcType 이 남으면 필터·표시가 어긋나므로 버전 범프. */
    var SKEY = 'damyangEduV1r14';  /* r14 — 주기 전환을 2027-01-01 로 미룸(답신 3-2): 2026 은 개인별 주기 · 독촉 이력(사람·메모)·재난안전과 현업 시드를 그 기준으로 맞춤 (2026-11-13) */
    /* r13 — 정기교육 주기를 달력 반기(관리감독자 달력 연도)로 · 독촉 이력을 그 기준에 맞춤 · 예정 교육 안내 (2026-11-13 X-1·X-2) */
    /* r12 — 등록부 사람별 참석시간(hoursBy) · 공문 붙임 5개 이내 · 재난안전과 현업 미이수 1명 · 이력 시각 정리 (2026-11-13) */
    /* r11 */  /* r10 — 예시 자료를 «11월 13일까지 운영한 시스템»으로 다시 짰다 (2026-11-13) */
    /* r9 — 시드 이력 문구 «신청» 걷기 (2026-11-12) */
    /* r8 — 참석자 등록부는 교육이 끝난 뒤(등록 기한) · 끝난 접수 중 교육 시드 1건 (2026-11-12) */
    /* 오늘 기준 — DYV2.today() 단일 출처. TODAY 는 하위호환 게터(DYEDU.TODAY)로 유지. */
    function today() { return (global.DYV2 && global.DYV2.today) ? global.DYV2.today() : realToday(); }
    function realToday() {
        var t = new Date(); var mm = t.getMonth() + 1, dd = t.getDate();
        return t.getFullYear() + '-' + (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd;
    }
    /* 지역변수 today 가 섀도잉하는 함수 안에서 쓰는 별칭 */
    function todayIso() { return today(); }

    /* ================= 계산 함수 (설계서 §2) ================= */

    /* ===== 정기교육 주기 — 2026년까지 개인별 · 2027-01-01부터 달력 반기 (2026-11-13 답신 3-2) =====
     * 별표4(`oshr-t4`) 제1호가목은 근로자 정기교육을 «매반기», 제1호의2가목은 관리감독자 정기교육을
     * «연간»으로 정한다. 주기를 세는 방식이 기준일에 따라 둘이다 —
     *   · 기준일 < CYCLE_SWITCH (지금 운영 규칙): 현업근로자 = 채용일부터 6개월씩 · 관리감독자 = 지정일부터 12개월씩
     *   · 기준일 ≥ CYCLE_SWITCH: 현업근로자 = 상반기 1/1~6/30 · 하반기 7/1~12/31 · 관리감독자 = 1/1~12/31
     * 전환 시점은 기획 답신(2026-11-13, «답신-개발-위험성평가·교육-확인요청» 3-2)이 정했다 — 2026 하반기는
     * 지금 주기 그대로 마친다(반기 중간에 바꾸면 이미 들은 시간이 이수로 인정되지 않는 사람이 생긴다).
     * 달력 반기 쪽:
     * · 기간 중간에 채용·지정된 사람도 **그 기간의 시간 전체**를 채운다 — 별표4 에 비례 감면 규정이 없다
     *   (채용 첫 기간을 따로 빼지 않는다. 담양군이 달리 정하면 여기만 고친다).
     * · 관리감독자는 지정일이 있어야 판정한다(X-4 · EXT-12) — 없으면 «지정일 미등록»(판정 불가).
     *   지정일·채용일이 기준일보다 뒤면 아직 대상이 아니다(판정 불가).
     * 이수현황·독촉·D-day·내 할일 독촉 카드·대시보드가 모두 이 함수 하나를 본다. */
    var CYCLE_SWITCH = '2027-01-01';
    function fmtDate(d) {
        var y = d.getFullYear(), m = d.getMonth() + 1, dd = d.getDate();
        return y + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
    }
    function addMonths(d, months) {
        return new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
    }
    function isoDays(a, b) {   /* b - a (일) — 둘 다 'YYYY-MM-DD' */
        return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
    }
    /* 지금 운영 규칙 — 채용일(관리감독자는 지정일)부터 개인별 6·12개월 (2026-11-13 이전 구현 그대로) */
    function personalCycleOf(worker, dateISO) {
        var anchorISO = worker.category === 'SUPERVISOR' ? worker.designatedAt : worker.hireDate;
        if (!anchorISO) return { valid: false, reason: worker.category === 'SUPERVISOR' ? '지정일 미등록' : '채용일 미등록', start: '', end: '', label: '', index: 0, months: 0, daysToEnd: null };
        var hire = new Date(anchorISO);
        if (isNaN(hire.getTime())) return { valid: false, reason: '기준일 오류', start: '', end: '', label: '', index: 0, months: 0, daysToEnd: null };
        var today = new Date(dateISO || todayIso());
        var cycleMonths = worker.category === 'SUPERVISOR' ? 12 : 6;
        var months = (today.getFullYear() - hire.getFullYear()) * 12 + (today.getMonth() - hire.getMonth());
        if (today.getDate() < hire.getDate()) months--;
        if (months < 0) months = 0;
        var cycleIndex = Math.floor(months / cycleMonths);
        var start = addMonths(hire, cycleIndex * cycleMonths);
        var endExclusive = addMonths(hire, (cycleIndex + 1) * cycleMonths);
        var end = new Date(endExclusive.getTime() - 86400000);
        var dToEnd = Math.round((end - today) / 86400000);
        return { valid: true, reason: '', start: fmtDate(start), end: fmtDate(end), label: '', index: cycleIndex, months: cycleMonths, daysToEnd: dToEnd };
    }
    /* 2027-01-01부터 — 달력 반기(현업근로자) · 달력 연도(관리감독자) */
    function calendarCycleOf(worker, day) {
        var sup = worker.category === 'SUPERVISOR';
        var bad = function (why) { return { valid: false, reason: why, start: '', end: '', label: '', index: 0, months: 0, daysToEnd: null }; };
        if (sup && !worker.designatedAt) return bad('지정일 미등록');
        var anchor = sup ? worker.designatedAt : (worker.hireDate || '');
        if (anchor && !/^\d{4}-\d{2}-\d{2}$/.test(anchor)) return bad('기준일 오류');
        if (anchor && anchor > day) return bad(sup ? '지정 전' : '채용 전');
        var y = day.slice(0, 4), first = +day.slice(5, 7) <= 6;
        var start = sup ? y + '-01-01' : (first ? y + '-01-01' : y + '-07-01');
        var end = sup ? y + '-12-31' : (first ? y + '-06-30' : y + '-12-31');
        var label = sup ? y + '년' : y + (first ? ' 상반기' : ' 하반기');
        return { valid: true, reason: '', start: start, end: end, label: label,
                 index: sup ? 0 : (first ? 1 : 2), months: sup ? 12 : 6, daysToEnd: isoDays(day, end) };
    }
    function cycleOf(worker, dateISO) {
        var day = String(dateISO || todayIso()).slice(0, 10);
        return day < CYCLE_SWITCH ? personalCycleOf(worker, day) : calendarCycleOf(worker, day);
    }
    /* 정기교육 필요시간 — 한 주기(현업근로자 반기 · 관리감독자 연간)에 채울 시간 (별표4) */
    function requiredHours(worker /*, dateISO */) {
        if (!worker) return 0;
        if (worker.category === 'SUPERVISOR') return 16;
        if (worker.category === 'OFFICE' || worker.category === 'SALES') return 6;
        return 12; /* FIELD (비사무직/현업) */
    }
    /* 채용시교육 필요시간 (고용형태·계약기간별) */
    function hireHours(worker) {
        if (!worker) return 0;
        /* 관리감독자는 별표4 **제1호의2 나목**이 8시간 단일로 정한다 — 제1호(근로자)의
           고용형태 갈래(1·4·8h)를 타지 않는다. 담양군 관리감독자는 전원 공무원이라
           아래 폴백으로도 8이 나오지만, 근거가 다른 조문이므로 갈래를 명시한다. */
        if (worker.category === 'SUPERVISOR') return 8;
        if (worker.empType === 'DAILY') return 1;
        if (worker.empType === 'CONTRACT') {
            var m = worker.contractMonths || 0;
            if (m <= 0.25) return 1; /* 1주 이하 */
            if (m <= 1) return 4;    /* 1주 초과 ~ 1개월 */
        }
        return 8;
    }
    /* 인정시간: records를 kind로 필터 후 hours 단순 합산.
       정기교육 인정은 현재 주기(cycleOf — 2026년까지 개인별 · 2027년부터 달력 반기·연도) 안에서 완료된 REG만. */
    function acknowledgedRegHours(workerId, dateISO) {
        var w = workerOf(workerId); if (!w) return 0;
        var c = cycleOf(w, dateISO);
        if (!c.valid) return 0;
        var rec = records().filter(function (r) {
            return r.workerId === workerId && r.kind === 'REG'
                && r.date >= c.start && r.date <= c.end;
        });
        return rec.reduce(function (n, r) { return n + (r.hours || 0); }, 0);
    }
    /* 채용시교육 상태: 이수일 vs 채용일 */
    /* 채용 시 교육의 **기준일**.
     *
     * 근로자는 채용일이다. 관리감독자는 **채용일과 지정일 중 늦은 쪽**을 쓴다 —
     * 담양군은 기존 공무원 중에서 관리감독자를 지정하므로, 채용일을 기준으로 삼으면
     * *그 시점에 관리감독자가 아니었던 사람*을 채용 시 교육 미이수로 찍게 된다.
     * 별표4 제1호의2 나목의 취지는 「그 지위에서 일하기 전에 교육」이므로 지위에 오른
     * 날을 기준으로 본다.
     *
     * 지정일이 없으면 **판정하지 않는다**('' 반환). 없는 기준일을 채용일로 대신하면
     * 위 오판정이 그대로 돌아온다 — 모르는 것을 근거로 미이수를 찍지 않는다.
     * (담양군 관리감독자 지정일은 현재 전원 미등록이며 발주처 자료 대기다.) */
    function hireAnchor(worker) {
        if (!worker) return '';
        if (worker.category !== 'SUPERVISOR') return worker.hireDate || '';
        if (!worker.designatedAt) return '';
        return worker.designatedAt > (worker.hireDate || '') ? worker.designatedAt : worker.hireDate;
    }
    /* 특별교육 이수로 채용 시 교육을 갈음한다 — 산안법 시행규칙 제26조제1항 후단(`oshr-26`):
     *   «사업주가 … 특별교육을 실시한 때에는 해당 근로자에 대하여 … 채용 시 교육 … 을 실시한
     *    것으로 본다.»
     * 종전에는 채용시 이수기록만 세어, 특별교육을 받은 사람이 채용시교육 «미이수»로 찍혔다 —
     * 법이 한 것으로 보는 교육을 안 했다고 말한 셈이다(기획확인 4차 C-27 검토, 2026-10-06).
     * · 같은 모집단의 특별교육만 센다 — 근로자는 기타교육(ETC), 관리감독자는 관리감독자
     *   기타교육(SUP_ETC). 남의 표의 교육으로 갈음하지 않는다.
     * · 시간은 보지 않는다 — 조문에 시간 요건이 없고, 특별교육은 분할·단기간 단서 때문에 이
     *   시스템이 한 건으로 시간을 판정하지 않는다(ETC_TYPE_INFO perCourseCheck:false).
     * · **정기교육으로는 갈음하지 않는다** — 그런 규정이 없다. */
    function specialAsHire(w) {
        var want = w.category === 'SUPERVISOR' ? 'SUP_ETC' : 'ETC';
        /* 채용일 전의 교육은 이 채용의 교육이 아니다 — 근무하기 전 날짜의 기록은 갈음에 쓰지 않는다
           (관리감독자는 채용 뒤·지정 전에 받은 관리감독자 특별교육이면 «그 지위 전에 받은» 것이라 센다) */
        var since = w.hireDate || '';
        return records().filter(function (r) {
            if (r.workerId !== w.id || r.kind !== 'ETC') return false;
            if (since && r.date < since) return false;
            var c = courseOf(r.courseId);
            return !!c && c.kind === want && c.etcType === '특별교육';
        }).sort(function (a, b) { return a.date.localeCompare(b.date); });
    }
    function hireStatus(workerId) {
        var w = workerOf(workerId); if (!w) return null;
        var need = hireHours(w);
        var anchor = hireAnchor(w);
        var rec = records().filter(function (r) { return r.workerId === workerId && r.kind === 'HIRE'; });
        var doneHours = rec.reduce(function (n, r) { return n + (r.hours || 0); }, 0);
        var lastDate = rec.length ? rec.sort(function (a, b) { return b.date.localeCompare(a.date); })[0].date : '';
        /* 채용시 기록으로 채워지지 않았을 때만 특별교육 갈음을 본다 — 둘 다 있으면 채용시 기록이 정본이다 */
        var sp = doneHours >= need ? [] : specialAsHire(w);
        var via = '', viaCourseId = '';
        if (sp.length) { via = '특별교육'; viaCourseId = sp[0].courseId; lastDate = sp[0].date; }
        var met = doneHours >= need || !!via;
        var status;
        if (!anchor) {
            /* 기준일이 없으면 이수·미이수를 말할 수 없다. 이수 기록이 있으면 그 사실만 남긴다. */
            status = met ? 'UNKNOWN_DONE' : 'UNKNOWN';
        } else if (met) {
            /* 기준일 이전~당일이면 정상, 이후면 지연 */
            status = lastDate <= anchor ? 'BEFORE' : 'LATE_DONE';
        } else {
            status = 'NONE';
        }
        return { need: need, done: doneHours, lastDate: lastDate, status: status, anchor: anchor,
                 anchorKind: w.category === 'SUPERVISOR' ? '지정일' : '채용일',
                 /* via — '' 채용시 이수기록 · '특별교육' 시행규칙 §26① 갈음. 갈음 건에는 채용시
                    이수기록이 없으므로 화면이 «이수 수정»·공문 진입을 내지 않는다. */
                 via: via, viaCourseId: viaCourseId, hireRecords: rec.length };
    }

    /* ================= 스토어 ================= */
    var db = null;

    /* HR 연동분: DYV2.ORG members를 CIVIL 근로자로 변환 */
    function orgWorkers() {
        var out = [];
        if (!global.DYV2 || !global.DYV2.orgWalk) return out;
        var isDeptLike = function (n) { return n.type === 'dept' || n.type === 'office' || n.type === 'town'; };
        function collect(n, deptId, deptName) {
            (n.members || []).forEach(function (m) {
                /* '재난안전과장·팀장·사업소장·담양읍장' 등을 SUPERVISOR로 지정.
                 *
                 * ⚠ **이것은 개발자가 고른 폴백이지 담양군이 정한 명단이 아니다.**
                 * 산안법 §16①은 관리감독자를 "소속 직원을 직접 지휘·감독하는 직위"로
                 * 정의하므로 팀장이야말로 전형적 관리감독자다. 그래서 `lead:true`
                 * (부서당 1명)로 갈아타면 안 된다 — 국장·팀장이 통째로 빠진다.
                 * 2026-08-13 `읍장|면장` 추가 — 담양읍장이 현업 부서장인데 이 규칙에
                 * 걸리지 않아 사무직 6시간으로 집계되고 있었다.
                 * 실제 명단(성명·부서·직위·지정일)은 발주처 자료 대기 — 받으면 이
                 * 정규식을 지우고 명시 플래그로 바꾼다(99_미결사항 EXT). */
                var isSup = /(과장|팀장|소장|실장|국장|읍장|면장)/.test(m.role || '');
                out.push({
                    id: 'w_' + m.uid, name: m.name, deptId: deptId, deptName: deptName,
                    category: isSup ? 'SUPERVISOR' : 'OFFICE',
                    empType: 'CIVIL', hireDate: HR_HIRE[m.uid] || HR_HIRE_DEFAULT, designatedAt: '', contractMonths: 0,
                    active: true, source: 'HR', role: m.role || ''
                });
            });
            (n.children || []).forEach(function (c) {
                if (c.type === 'team') collect(c, deptId, deptName);
            });
        }
        global.DYV2.orgWalk(function (n) {
            if (isDeptLike(n)) collect(n, n.id, n.name);
        });
        return out;
    }

    /* 인사 연동분의 임용일 — 사람마다 다르다(예시 값). 종전에는 전원 '2020-03-02' 한 값이라
       정기교육 사이클이 모두 같은 날 시작하고 끝나 이수현황이 한 덩어리로만 움직였다.
       목록에 없는 사람은 HR_HIRE_DEFAULT 를 쓴다. */
    var HR_HIRE_DEFAULT = '2020-03-02';
    var HR_HIRE = {
        u_plan1: '2004-03-02', u_plan2: '2016-07-01',
        u_safe1: '2003-09-01', u_safe2: '2012-09-03', u_jjt1: '2008-03-03', u_jjt2: '2019-03-04', u_jjt3: '2023-07-03',
        u_acct1: '2005-03-02', u_acct2: '2018-01-02',
        u_env1: '2002-09-02', u_env2: '2017-03-02', u_env3: '2021-09-01', u_env6: '2009-03-02', u_env4: '2022-01-03', u_env5: '2024-07-01',
        u_cul1: '2015-03-02', u_cul2: '2020-09-01',
        u_fin1: '2013-01-02', u_fin2: '2019-07-01',
        u_hlth1: '2001-03-02', u_hlth2: '2014-03-03', u_hlth3: '2018-09-03', u_hlth4: '2021-03-02', u_hlth5: '2025-01-02',
        u_con1: '2003-03-03', u_con2: '2016-09-01', u_con6: '2010-03-02', u_con3: '2020-03-02', u_con4: '2023-01-02', u_con5: '2025-07-01',
        u_fac1: '2004-09-01', u_fac2: '2011-03-02', u_fac3: '2019-09-02', u_fac4: '2022-07-01',
        u_wat1: '2002-03-04', u_wat2: '2010-09-01', u_wat5: '2007-09-03', u_wat3: '2018-03-02', u_wat6: '2024-01-02',
        u_wat7: '2009-09-01', u_wat4: '2017-07-03',
        u_twn1: '2001-09-03', u_twn2: '2015-09-01'
    };

    /* 부서별 계약직·일용 (현업 부서에 집중) — 예시 명단 */
    function seedContractWorkers() {
        var seed = [];
        var mk = function (id, name, deptId, cat, emp, hire, contract, source) {
            seed.push({ id: id, name: name, deptId: deptId, category: cat, empType: emp,
                hireDate: hire, contractMonths: contract || 0, active: true, source: source || 'MANUAL', role: '' });
        };
        /* 환경과 — 자원순환·환경지도 현업 */
        mk('w_env_c1', '박수완', 'env', 'FIELD', 'CONTRACT', '2025-03-02', 12, 'HR');
        mk('w_env_c2', '이수영', 'env', 'FIELD', 'CONTRACT', '2025-09-01', 12, 'HR');
        mk('w_env_c3', '조민서', 'env', 'FIELD', 'CONTRACT', '2026-02-01', 12, 'MANUAL');
        mk('w_env_c4', '한도영', 'env', 'FIELD', 'DAILY',    '2026-07-10', 0.1, 'MANUAL'); /* 채용시교육 지연 이수 */
        mk('w_env_c5', '차이수', 'env', 'FIELD', 'CONTRACT', '2026-06-15', 6, 'EXCEL');
        /* 물순환사업소 — 정수·수질 현업 */
        mk('w_wat_c1', '한지훈', 'water', 'FIELD', 'CONTRACT', '2025-03-01', 12, 'HR');
        mk('w_wat_c2', '오태섭', 'water', 'FIELD', 'CONTRACT', '2025-11-01', 12, 'HR');
        mk('w_wat_c3', '박정민', 'water', 'FIELD', 'CONTRACT', '2026-01-15', 12, 'MANUAL');
        mk('w_wat_c4', '김수빈', 'water', 'FIELD', 'CONTRACT', '2026-05-10', 6, 'EXCEL');
        mk('w_wat_c5', '이서준', 'water', 'FIELD', 'DAILY',    '2026-11-10', 0.1, 'MANUAL'); /* 최근 채용 — 채용시교육 전 */
        /* 공공시설사업소 — 시설운영·환경시설 */
        mk('w_fac_c1', '정민수', 'facility', 'FIELD', 'CONTRACT', '2024-08-01', 24, 'HR');
        mk('w_fac_c2', '박현우', 'facility', 'FIELD', 'CONTRACT', '2025-08-01', 12, 'HR');
        mk('w_fac_c3', '이도현', 'facility', 'FIELD', 'CONTRACT', '2026-02-20', 12, 'MANUAL');
        mk('w_fac_c4', '오세훈', 'facility', 'FIELD', 'DAILY',    '2026-10-27', 0.2, 'EXCEL');
        /* 건설과 — 도로·안전관리 현업 */
        mk('w_con_c1', '최준영', 'construct', 'FIELD', 'CONTRACT', '2025-03-15', 12, 'HR');
        mk('w_con_c2', '강태우', 'construct', 'FIELD', 'CONTRACT', '2025-10-01', 12, 'HR');
        mk('w_con_c3', '한지원', 'construct', 'FIELD', 'CONTRACT', '2026-03-01', 12, 'MANUAL');
        mk('w_con_c4', '박서연', 'construct', 'FIELD', 'CONTRACT', '2026-09-14', 6, 'EXCEL');
        /* 재난안전과 */
        mk('w_safety_c1', '조안나', 'safety', 'OFFICE', 'CONTRACT', '2025-04-01', 12, 'HR');
        /* 재난안전과 현업 — 새 주기(채용일 기준 11-12~)가 막 시작해 미이수다. 실습으로 집합교육 한 건(3h)을 이수해도 12h 에 못 미쳐
           과장·팀장의 «재난안전과 미이수자 독촉»(ES-14) 실습 대상이 남는다 */
        mk('w_safety_c2', '송민재', 'safety', 'FIELD', 'CONTRACT', '2025-05-12', 12, 'HR');
        /* 문화체육과 — 체육·문화시설 */
        mk('w_cul_c1', '이하영', 'culture', 'FIELD', 'CONTRACT', '2025-05-01', 12, 'HR');
        mk('w_cul_c2', '박진호', 'culture', 'FIELD', 'CONTRACT', '2026-11-09', 4, 'MANUAL'); /* 최근 채용 — 채용시교육 전 */
        /* 보건소 */
        mk('w_hlth_c1', '윤소민', 'health', 'FIELD', 'CONTRACT', '2025-04-15', 12, 'HR');
        mk('w_hlth_c2', '김하늘', 'health', 'FIELD', 'DAILY',    '2026-11-02', 0.1, 'MANUAL'); /* 채용 11일째 — 채용시교육 미이수 */
        /* 담양읍 */
        mk('w_twn_c1', '최민석', 'town_damyang', 'FIELD', 'CONTRACT', '2025-06-01', 12, 'HR');   /* 채용시교육 기록 없음 */
        return seed;
    }

    /* ── 예시 자료 생성 도우미 ─────────────────────────────────────────────── */
    /* 같은 입력이면 늘 같은 값 — 새로 고칠 때마다 참석자가 바뀌지 않게 한다 */
    function hash01(key) {
        var h = 2166136261;
        for (var i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
        return (h % 1000) / 1000;
    }
    function addDays(iso, n) {
        var t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n);
        return t.toISOString().slice(0, 10);
    }
    function endOf(start, hours) {
        var t = start.split(':'), m = (+t[0]) * 60 + (+t[1]) + Math.round(hours * 60);
        return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2);
    }
    /* 실제 처리한 사람(DYV2.ORG) — 이력·등록부의 «누가» */
    var SAFETY = '재난안전과 박안전';
    var DEPT_STAFF = {
        safety: '박안전', plan: '한열람', acct: '최회계', env: '정환경', culture: '한지훈', finance: '최재무',
        health: '이보건', construct: '박현장', facility: '한담당', water: '하정수', town_damyang: '배주민'
    };
    var STAFF_UID = { '박안전': 'u_jjt2', '정환경': 'u_env2', '하정수': 'u_wat3', '한담당': 'u_fac2', '박현장': 'u_con2', '이보건': 'u_hlth2' };
    function staffOf(deptId) { return DEPT_STAFF[deptId] || '박안전'; }
    /* 교육 첨부 칸 이름 — 저장 코드(file.slot)를 화면·공문 붙임 후보에 그대로 내지 않는다(§15).
       등록 폼의 칸 이름(EDUFORM.ATTACH_SLOTS)과 같은 말이다 */
    var SLOT_LABEL = { roster: '참석자 명단 (서명 포함)', material: '교육 자료', log: '교육일지 및 교육사진 등' };
    function slotLabel(slot) { return SLOT_LABEL[slot] || '교육 첨부'; }

    function seed() {
        var workers = orgWorkers().concat(seedContractWorkers());
        var wById = {}; workers.forEach(function (w) { wById[w.id] = w; });
        var courses = [], enrolls = [], records = [], docSeed = [];
        function dn(id) { return deptName(id); }
        function hist(c, at, by, memo, type) { c.history.push({ type: type || 'STATUS', at: at, by: by, memo: memo }); }
        /* 공문 예시 — 화면 흐름(기안 → 미리보기 → 온나라로 보내기)을 거친 결과의 모양 그대로.
           상태는 온나라 연계 회신으로 바뀐 값이다(보낸 직후 «기안함 전송» → 상신 «결재중» → «결재완료/반려»). */
        function doc(c, at, by, status, extra) {
            var dept = (by === '박안전') ? '재난안전과' : dn(c.deptId || 'safety');
            var att = (c.files || []).map(function (f) { return { label: f.name, meta: slotLabel(f.slot), on: true }; });
            var seen = {};
            enrolls.forEach(function (e) {
                if (e.courseId !== c.id || !e.signFile || seen[e.signFile]) return;
                seen[e.signFile] = 1;
                att.push({ label: e.signFile, meta: e.bulk ? '일괄 등록 참석자 서명부' : dn(e.deptId) + ' 참석자 서명부', on: true });
            });
            /* 온나라 붙임 한도(별지 포함 5개 — DYDOC ATTACH_LIMIT)를 예시 공문도 지킨다. 이수자 명단 별지가 한 자리를
               쓰므로 파일은 4개까지 — 교육 첨부 → 일괄 등록 서명부 → 부서 서명부 순으로 싣는다.
               (화면이 6개째를 막는데 예시 공문에 10개가 붙어 있으면 실습하는 사람이 무엇이 맞는지 모른다) */
            att = att.slice(0, 4);
            var recs = records.filter(function (r) { return r.courseId === c.id; });
            var depts = {}; recs.forEach(function (r) { depts[(wById[r.workerId] || {}).deptId] = 1; });
            var d = {
                courseId: c.id, at: at, status: status, docType: '내부결재',
                title: c.date.slice(0, 4) + '년 안전보건교육 실시 결과 보고 — ' + c.desc, to: '',
                /* 관련 근거는 본문에 쓰지 않는다 — 고른 근거(basis)를 지면의 «근거» 줄이 싣는다(DYDOC) */
                body: '1. ' + c.desc + (global.DYV2 && global.DYV2.josa ? global.DYV2.josa(c.desc, '을', '를') : '을(를)') + ' 아래와 같이 실시하였기에 그 결과를 보고합니다.\n' +
                      '  가. 일시: ' + (c.sessions && c.sessions.length > 1 ? c.sessions[0].date + ' 외 ' + (c.sessions.length - 1) + '일' : c.date + ' ' + c.time + '~' + (c.endTime || endOf(c.time, c.hours))) + ' (' + c.hours + '시간)\n' +
                      '  나. 장소: ' + (c.place || '-') + '\n' +
                      '  다. 강사: ' + (c.instructor || '-') + '\n' +
                      '  라. 실시 결과: ' + Object.keys(depts).length + '개 부서 ' + recs.length + '명 이수\n' +
                      '2. 미참석자는 다음 교육 또는 부서 자체교육으로 보충하겠습니다.',
                attach: att, annex: true, basis: ['osh-29'], line: [], lineText: '',
                by: by, byUid: STAFF_UID[by] || '', dept: dept
            };
            Object.keys(extra || {}).forEach(function (k) { d[k] = extra[k]; });
            docSeed.push(d);
            return d;
        }

        /* ───────── 1. 현업근로자 정기교육(집합) — 매월 1회, 재난안전과 박안전 운영 ─────────
         * 1~10월은 끝났다: 교육 뒤 부서가 등록부를 올리고(일부는 재난안전과 일괄 등록)
         * → 등록 기한 무렵 종료 처리 → 실시 결과 공문을 온나라로 보냈다.
         * 11월(11-11)은 등록부를 받는 중이고 12월은 교육 전이다. */
        var MONTHLY = [
            { m: '01', date: '2026-01-16', h: 2, topic: '동절기 한랭질환·빙판길 넘어짐 예방', inst: '안전보건공단 광주광역본부 위촉강사', place: '군청 대회의실' },
            { m: '02', date: '2026-02-13', h: 2, topic: '산업안전보건법·중대재해처벌법 주요 내용', inst: '재난안전과 안전관리자 김안전', place: '군청 대회의실' },
            { m: '03', date: '2026-03-13', h: 3, topic: '해빙기 작업장 위험요인과 위험성평가 참여', inst: '안전보건공단 광주광역본부 위촉강사', place: '군청 대회의실' },
            { m: '04', date: '2026-04-17', h: 2, topic: '보호구 착용과 밀폐공간 질식재해 예방', inst: '대한산업안전협회 전남지회 강사', place: '군청 대회의실' },
            { m: '05', date: '2026-05-15', h: 3, topic: '근골격계질환 예방과 직무스트레스 관리', inst: '환경과 보건관리자 최보건', place: '담양문화회관 소공연장' },
            { m: '06', date: '2026-06-12', h: 2, topic: '폭염 대비 온열질환 예방', inst: '안전보건공단 광주광역본부 위촉강사', place: '군청 대회의실' },
            { m: '07', date: '2026-07-10', h: 3, topic: '집중호우·감전 재해 예방', inst: '한국전기안전공사 담양지사 강사', place: '군청 대회의실' },
            { m: '08', date: '2026-08-14', h: 2, topic: '응급처치와 심폐소생술 실습', inst: '담양소방서 구급대', place: '담양문화회관 소공연장' },
            { m: '09', date: '2026-09-11', h: 3, topic: '추락·끼임 사고 사례와 예방', inst: '대한산업안전협회 전남지회 강사', place: '군청 대회의실' },
            { m: '10', date: '2026-10-16', h: 3, topic: '화재 예방과 소화기 사용·대피 요령', inst: '담양소방서 예방안전과', place: '군청 대회의실' },
            { m: '11', date: '2026-11-11', h: 3, topic: '동절기 안전수칙과 화학물질(MSDS) 취급', inst: '안전보건공단 광주광역본부 위촉강사', place: '군청 대회의실' },
            { m: '12', date: '2026-12-11', h: 2, topic: '2026년 안전보건 이행 결과 공유와 2027년 계획', inst: '재난안전과 안전관리자 김안전', place: '군청 대회의실' }
        ];
        /* 부서별 참석률(예시) — 현업 부서는 높고 사무 부서는 낮다 */
        var RATE = { safety: 0.95, env: 0.9, water: 0.86, facility: 0.9, construct: 0.85, culture: 0.86,
                     finance: 0.7, health: 0.86, town_damyang: 0.85, plan: 0.9, acct: 0.7 };
        /* 재난안전과가 한 장 서명부로 일괄 등록한 부서(본청 사무 부서) */
        var BULK_DEPTS = { safety: 1, plan: 1, acct: 1, finance: 1, culture: 1 };
        var DEPT_ORDER = ['safety', 'plan', 'acct', 'finance', 'culture', 'env', 'health', 'construct', 'facility', 'water', 'town_damyang'];
        /* 매달 빠짐없이 참석한 사람 — 운영 담당(박안전)과 부서 교육 담당 */
        var ALWAYS = { w_u_jjt2: 1, w_u_plan2: 1 };
        var fieldPool = workers.filter(function (w) { return w.category !== 'SUPERVISOR'; });

        MONTHLY.forEach(function (mm) {
            var cid = 'C-M' + mm.m;
            var mNo = +mm.m;
            var future = mm.date > '2026-11-13';
            /* 등록일은 교육 24일 전 — 단 앞날 교육은 기준일(11-13)을 넘지 않게 그 전날 등록으로 둔다(앞날 이력 금지) */
            var created = addDays(mm.date, -24);
            if (created > '2026-11-12') created = '2026-11-12';
            var c = {
                id: cid, kind: 'REG_GROUP', date: mm.date, time: '14:00', endTime: endOf('14:00', mm.h), hours: mm.h, enrollDays: 7,
                instructor: mm.inst, place: mm.place,
                desc: '2026년 ' + mNo + '월 정기 안전보건교육 — ' + mm.topic,
                files: [{ name: '2026_' + mm.m + '월_참석자명단.hwpx', slot: 'roster' },
                        { name: '2026_' + mm.m + '월_교육자료.pdf', slot: 'material' }],
                status: 'OPEN', createdBy: '재난안전과', history: []
            };
            hist(c, created + ' 10:12', SAFETY, '정기교육(집합) 등록', 'CREATE');
            courses.push(c);
            if (future) return;                                     /* 12월 — 교육 전 */
            var due = addDays(mm.date, 7);
            var open = mm.m === '11';                               /* 11월 — 등록부 받는 중 */
            /* 11월은 아직 몇 부서만 올렸다 — 오늘(11-13)까지 올린 부서 */
            var NOV_DONE = { env: '2026-11-12', safety: '2026-11-12', plan: '2026-11-12', acct: '2026-11-12', finance: '2026-11-12', construct: '2026-11-12' };
            var bulkFile = '2026_' + mm.m + '월_집합교육_서명부.pdf';
            var bulkRows = [];
            DEPT_ORDER.forEach(function (dept, di) {
                if (open && !NOV_DONE[dept]) return;
                /* 가끔 등록부를 올리지 않은 달이 있다(그 부서는 그 달 이수 0) */
                if (!open && dept !== 'safety' && dept !== 'env' && hash01(cid + dept + 'skip') < 0.1) return;
                var ids = fieldPool.filter(function (w) {
                    return w.deptId === dept && w.hireDate <= mm.date && (ALWAYS[w.id] || hash01(cid + w.id) < (RATE[dept] || 0.6));
                }).map(function (w) { return w.id; });
                if (!ids.length) return;
                var bulk = !!BULK_DEPTS[dept];
                var at = open ? NOV_DONE[dept] : addDays(mm.date, bulk ? 1 : 1 + Math.floor(hash01(cid + dept + 'at') * 5));
                /* 일찍 나간 사람이 있던 부서는 실제 참석시간을 줄여 적었다 */
                var short = !bulk && hash01(cid + dept + 'hrs') < 0.12;
                var actual = short ? Math.max(1, mm.h - 1) : mm.h;
                var by = bulk ? '박안전' : staffOf(dept);
                var e = { courseId: cid, deptId: dept, workerIds: ids, actualHours: actual, status: 'ACTIVE', at: at,
                          by: by, proxy: bulk && dept !== 'safety', bulk: bulk,
                          signFile: bulk ? bulkFile : dn(dept) + '_' + mm.m + '월_참석자서명부.pdf' };
                enrolls.push(e);
                if (bulk) bulkRows.push(e);
                else hist(c, at + ' ' + ('0' + (9 + (di % 8))).slice(-2) + ':' + (10 + di * 3), dn(dept), '참석자 등록부 등록 · ' + ids.length + '명 · 실제 참석 ' + actual + 'h · 서명부 첨부');
            });
            if (bulkRows.length) {
                var n = bulkRows.reduce(function (s, e) { return s + e.workerIds.length; }, 0);
                hist(c, bulkRows[0].at + ' 16:40', SAFETY + '(일괄 등록)', '참석자 일괄 등록 · ' + bulkRows.length + '개 부서 ' + n + '명 · 실제 참석 ' + mm.h + 'h · 서명부 ' + bulkFile);
            }
            c.history.sort(function (a, b) { return a.at.localeCompare(b.at); });
            if (open) return;
            /* 종료 처리 — 등록 기한 다음 근무일 무렵 */
            var closeAt = addDays(due, 1);
            var total = 0;
            enrolls.forEach(function (e) {
                if (e.courseId !== cid) return;
                e.workerIds.forEach(function (wid) { records.push({ workerId: wid, courseId: cid, kind: 'REG', hours: e.actualHours, date: mm.date }); total++; });
            });
            c.status = 'DONE';
            hist(c, closeAt + ' 17:05', SAFETY, '교육 종료 처리 · 등록 ' + total + '명 실제 참석시간 카운트');
        });

        /* ───────── 2. 부서 자체교육(정기) — 현업 부서가 실시하고 바로 완료 처리 ───────── */
        function selfCourse(id, dept, date, start, hours, desc, inst, place, ids, by) {
            var c = { id: id, kind: 'REG_SELF', deptId: dept, date: date, time: start, endTime: endOf(start, hours), hours: hours,
                      instructor: inst, place: place, desc: desc,
                      files: [{ name: dn(dept) + '_자체교육_' + date.replace(/-/g, '') + '_교육일지_사진.pdf', slot: 'log' }],
                      status: 'DONE', createdBy: dn(dept), history: [] };
            hist(c, date + ' 17:20', dn(dept) + ' ' + by, '정기교육(자체) 등록', 'CREATE');
            hist(c, date + ' 17:21', dn(dept), '자체교육 즉시 완료 · 1일 ' + hours + 'h · 대상자 ' + ids.length + '명 카운트');
            courses.push(c);
            enrolls.push({ courseId: id, deptId: dept, workerIds: ids, status: 'ACTIVE', at: date, by: by, proxy: false, bulk: false, signFile: '', actualHours: null });
            ids.forEach(function (wid) { records.push({ workerId: wid, courseId: id, kind: 'REG', hours: hours, date: date }); });
            return c;
        }
        var sCul = selfCourse('C-SELF-CULTU', 'culture', '2026-06-17', '10:00', 4, '체육시설 운영 현장 안전교육 (상반기)', '문화체육과 체육시설팀 한지훈', '담양종합체육관 회의실', ['w_cul_c1'], '한지훈');
        var sEnv = selfCourse('C-SELF-ENV', 'env', '2026-09-24', '09:00', 6, '하반기 자원순환 현장 안전교육 (수거·선별 작업)', '환경과 보건관리자 최보건', '환경과 회의실', ['w_env_c1', 'w_env_c2', 'w_env_c3', 'w_env_c4', 'w_env_c5'], '정환경');
        var sFac = selfCourse('C-SELF-FACIL', 'facility', '2026-10-08', '09:00', 6, '환경시설 운영 현장 안전교육 (하반기)', '공공시설사업소 시설안전 담당 한담당', '공공시설사업소 교육장', ['w_fac_c1', 'w_fac_c2', 'w_fac_c3'], '한담당');
        var sWat = selfCourse('C-SELF-WATER', 'water', '2026-10-21', '09:00', 6, '정수장 약품 취급·밀폐공간 현장 안전교육 (하반기)', '물순환사업소 정수팀장 문정수', '물순환사업소 교육장', ['w_wat_c1', 'w_wat_c2', 'w_wat_c3', 'w_wat_c4'], '하정수');
        var sCon = selfCourse('C-SELF-CONST', 'construct', '2026-11-04', '09:00', 6, '동절기 도로 보수·제설 작업 안전교육', '건설과 안전관리팀장 정안전', '건설과 회의실', ['w_con_c1', 'w_con_c2', 'w_con_c3', 'w_con_c4'], '박현장');

        /* ───────── 3. 관리감독자 정기교육 — 상·하반기 각 8h(외부 위탁) ───────── */
        function supCourse(id, date, desc, created, regs, closeAt, status) {
            var c = { id: id, kind: 'SUP_REG', date: date, time: '09:30', endTime: '18:30', hours: 8, enrollDays: 7,
                      instructor: '대한산업안전협회 전남지회 (위탁)', place: '담양문화회관 세미나실', desc: desc,
                      files: [{ name: date.replace(/-/g, '') + '_관리감독자_참석자명단.hwpx', slot: 'roster' }, { name: date.replace(/-/g, '') + '_관리감독자교육_교재.pdf', slot: 'material' }],
                      status: status, createdBy: '재난안전과', history: [] };
            hist(c, created + ' 11:00', SAFETY, '관리감독자 정기교육 등록', 'CREATE');
            courses.push(c);
            var total = 0;
            regs.forEach(function (g) {
                enrolls.push({ courseId: id, deptId: g.dept, workerIds: g.ids, actualHours: 8, status: 'ACTIVE', at: g.at,
                               by: staffOf(g.dept), proxy: false, bulk: false, signFile: dn(g.dept) + '_' + date.replace(/-/g, '') + '_감독자_서명부.pdf' });
                hist(c, g.at + ' 10:30', dn(g.dept), '참석자 등록부 등록 · ' + g.ids.length + '명 · 실제 참석 8h · 서명부 첨부');
                total += g.ids.length;
            });
            if (status === 'DONE') {
                regs.forEach(function (g) { g.ids.forEach(function (wid) { records.push({ workerId: wid, courseId: id, kind: 'REG', hours: 8, date: date }); }); });
                hist(c, closeAt + ' 16:50', SAFETY, '교육 종료 처리 · 등록 ' + total + '명 실제 참석시간 카운트');
            }
            return c;
        }
        var sr1 = supCourse('C-SR1', '2026-03-20', '2026 관리감독자 정기교육 1차 (상반기 8h)', '2026-02-24', [
            { dept: 'safety', ids: ['w_u_safe1', 'w_u_jjt1'], at: '2026-03-23' },
            { dept: 'env', ids: ['w_u_env1', 'w_u_env6'], at: '2026-03-23' },
            { dept: 'water', ids: ['w_u_wat1', 'w_u_wat5', 'w_u_wat7'], at: '2026-03-24' },
            { dept: 'facility', ids: ['w_u_fac1'], at: '2026-03-24' },
            { dept: 'construct', ids: ['w_u_con1', 'w_u_con6'], at: '2026-03-25' },
            { dept: 'health', ids: ['w_u_hlth1'], at: '2026-03-25' },
            { dept: 'town_damyang', ids: ['w_u_twn1'], at: '2026-03-26' }
        ], '2026-03-30', 'DONE');
        var sr2 = supCourse('C-SR2', '2026-10-23', '2026 관리감독자 정기교육 2차 (하반기 8h)', '2026-09-28', [
            { dept: 'safety', ids: ['w_u_safe1', 'w_u_jjt1'], at: '2026-10-26' },
            { dept: 'plan', ids: ['w_u_plan1'], at: '2026-10-26' },
            { dept: 'env', ids: ['w_u_env1'], at: '2026-10-27' },
            { dept: 'water', ids: ['w_u_wat1', 'w_u_wat5', 'w_u_wat7'], at: '2026-10-27' },
            { dept: 'facility', ids: ['w_u_fac1'], at: '2026-10-28' },
            { dept: 'construct', ids: ['w_u_con6'], at: '2026-10-29' },
            { dept: 'health', ids: ['w_u_hlth1'], at: '2026-10-29' }
        ], '2026-11-02', 'DONE');
        /* 상·하반기 미참석자 보충 — 12월, 교육 전 */
        supCourse('C-SR3', '2026-12-04', '2026 관리감독자 정기교육 보충 (상·하반기 미참석자 8h)', '2026-11-06', [], '', 'OPEN');

        /* ───────── 4. 채용시교육 ─────────
         * 시스템 도입(2026-01) 전에 채용된 사람의 이수 기록은 인사기록에서 한 건으로 옮겨 실었다.
         * 2026년 채용자는 부서가 채용 때마다 등록했다. 최근 채용자 몇 명은 아직 교육 전이다. */
        var preIds = [], preRecs = [];
        workers.forEach(function (w) {
            if (w.category === 'SUPERVISOR' || !(w.hireDate < '2026-01-01')) return;
            if (w.id === 'w_fac_c1' || w.id === 'w_fac_c2' || w.id === 'w_twn_c1') return;   /* 따로 기록 · 기록 없음 */
            var late = w.id === 'w_con_c2';                                  /* 채용 뒤에 받은 사람 — 지연 이수 */
            preIds.push(w);
            preRecs.push({ workerId: w.id, courseId: 'C-H0', kind: 'HIRE', hours: hireHours(w), date: late ? addDays(w.hireDate, 14) : w.hireDate });
        });
        var h0 = { id: 'C-H0', kind: 'HIRE', deptId: '', date: '2026-01-09', time: '09:00', endTime: '17:00', hours: 8,
                   instructor: '각 부서 (인사기록 기준)', place: '-', desc: '2025년 이전 채용자 채용시교육 이수 기록 (인사기록 이관)',
                   files: [{ name: '채용시교육_이수기록_인사기록발췌_2025이전.xlsx', slot: 'log' }],
                   status: 'DONE', createdBy: '재난안전과', imported: true, history: [] };
        hist(h0, '2026-01-09 15:30', SAFETY, '채용시교육 등록', 'CREATE');
        hist(h0, '2026-01-09 15:32', '재난안전과', '인사기록 이관 · ' + preIds.length + '명 이수 기록 등록');
        courses.push(h0);
        var preBy = {};
        preIds.forEach(function (w) { (preBy[w.deptId] = preBy[w.deptId] || []).push(w.id); });
        Object.keys(preBy).forEach(function (d) { enrolls.push({ courseId: 'C-H0', deptId: d, workerIds: preBy[d], status: 'ACTIVE', at: '2026-01-09', by: '박안전', proxy: d !== 'safety', bulk: false, signFile: '', actualHours: null }); });
        records = records.concat(preRecs);

        function hireCourse(id, dept, date, wid, inst, by) {
            var w = wById[wid], hrs = hireHours(w);
            var c = { id: id, kind: 'HIRE', deptId: dept, date: date, time: '09:00', endTime: endOf('09:00', hrs), hours: hrs,
                      instructor: inst, place: dn(dept) + ' 회의실', desc: '채용시 안전보건교육 · ' + w.name,
                      files: [{ name: dn(dept) + '_채용시교육_' + w.name + '_' + date.replace(/-/g, '') + '.pdf', slot: 'log' }],
                      status: 'DONE', createdBy: dn(dept), history: [] };
            hist(c, date + ' 17:40', dn(dept) + ' ' + by, '채용시교육 등록', 'CREATE');
            hist(c, date + ' 17:41', dn(dept), '채용시교육 이수 처리 · ' + w.name + ' ' + hrs + 'h');
            courses.push(c);
            enrolls.push({ courseId: id, deptId: dept, workerIds: [wid], status: 'ACTIVE', at: date, by: by, proxy: false, bulk: false, signFile: '', actualHours: null });
            records.push({ workerId: wid, courseId: id, kind: 'HIRE', hours: hrs, date: date });
            return c;
        }
        /* C-H1·C-H2 — 공공시설사업소 기존 기록(시스템 도입 전 부서가 따로 관리하던 것) */
        hireCourse('C-H1', 'facility', '2024-07-25', 'w_fac_c1', '안전보건공단 위탁', '한담당');
        hireCourse('C-H2', 'facility', '2025-07-30', 'w_fac_c2', '안전보건공단 위탁', '한담당');
        var hWat3 = hireCourse('C-H3', 'water', '2026-01-15', 'w_wat_c3', '물순환사업소 정수팀장 문정수', '하정수');
        var hEnv3 = hireCourse('C-H4', 'env', '2026-01-29', 'w_env_c3', '환경과 보건관리자 최보건', '정환경');
        hireCourse('C-H5', 'facility', '2026-02-20', 'w_fac_c3', '공공시설사업소 시설안전 담당 한담당', '한담당');
        hireCourse('C-H6', 'construct', '2026-02-27', 'w_con_c3', '건설과 안전관리팀장 정안전', '박현장');
        hireCourse('C-H7', 'water', '2026-05-08', 'w_wat_c4', '물순환사업소 정수팀장 문정수', '하정수');
        hireCourse('C-H8', 'env', '2026-06-15', 'w_env_c5', '환경과 보건관리자 최보건', '정환경');
        hireCourse('C-H9', 'env', '2026-07-14', 'w_env_c4', '환경과 환경지도팀장 조환경', '정환경');   /* 채용 나흘 뒤 — 지연 이수 */
        var hCon4 = hireCourse('C-H10', 'construct', '2026-09-14', 'w_con_c4', '건설과 안전관리팀장 정안전', '박현장');
        hireCourse('C-H11', 'facility', '2026-10-27', 'w_fac_c4', '공공시설사업소 시설안전 담당 한담당', '한담당');

        /* ───────── 5. 기타 교육(법정 3유형) — 작업내용 변경 시 · 특별교육 ─────────
         * C-E2 는 판정 가능한 유형에서 **의도적으로 미달**인 건이다 — 같은 한 건인데 정규 현업(2h 필요)
         * 에게는 미달이고 일용(1h 필요)에게는 충족이라 최소시간이 사람마다 다르다는 사실이 드러난다.
         * 특별교육은 분할·단기간 단서가 있어 한 건만으로 판정하지 않는다(etcShortfall). */
        function etcCourse(o) {
            var c = { id: o.id, kind: o.kind || 'ETC', etcType: o.type, deptId: o.dept, date: o.date, time: o.start,
                      endTime: o.sessions ? '' : endOf(o.start, o.hours), hours: o.hours,
                      instructor: o.inst, place: o.place, desc: o.desc,
                      specialWorkNos: o.works || [], specialWorkOtherReason: '',
                      files: [{ name: o.file, slot: 'log' }], status: 'DONE', createdBy: o.by === '박안전' ? '재난안전과' : dn(o.dept), history: [] };
            if (o.sessions) c.sessions = o.sessions;
            /* 관리감독자 기타교육은 재난안전과가 등록한다(운영가이드 §7-1) — 부서는 대상 부서일 뿐이다 */
            var regBy = o.by === '박안전' ? SAFETY : dn(o.dept) + ' ' + o.by;
            hist(c, o.date + ' 17:30', regBy, (c.kind === 'SUP_ETC' ? '관리감독자 기타 교육' : '기타 교육') + ' 등록', 'CREATE');
            hist(c, o.date + ' 17:31', o.by === '박안전' ? SAFETY : dn(o.dept), o.type + ' 진행 처리 · ' + o.ids.length + '명 카운트');
            courses.push(c);
            enrolls.push({ courseId: o.id, deptId: o.dept, workerIds: o.ids, status: 'ACTIVE', at: o.date, by: o.by, proxy: false, bulk: false, signFile: '', actualHours: null });
            o.ids.forEach(function (wid) { records.push({ workerId: wid, courseId: o.id, kind: 'ETC', hours: o.hours, date: (o.sessions ? o.sessions[o.sessions.length - 1].date : o.date) }); });
            return c;
        }
        var e5 = etcCourse({ id: 'C-E5', type: '작업내용 변경 시 교육', dept: 'env', date: '2026-03-18', start: '14:00', hours: 2,
            inst: '환경과 환경지도팀장 조환경', place: '환경과 회의실', by: '정환경', ids: ['w_env_c1', 'w_env_c2'],
            desc: '자원순환팀 → 환경지도팀 배치 전환에 따른 작업내용 변경 교육', file: '작업변경교육_일지_20260318.pdf' });
        var e1 = etcCourse({ id: 'C-E1', type: '작업내용 변경 시 교육', dept: 'water', date: '2026-04-08', start: '10:00', hours: 2,
            inst: '물순환사업소장 오순환', place: '물순환사업소 교육장', by: '하정수', ids: ['w_wat_c1', 'w_wat_c2'],
            desc: '정수장 → 하수처리장 배치 전환에 따른 작업내용 변경 교육', file: '작업변경교육_일지_20260408.pdf' });
        var e3 = etcCourse({ id: 'C-E3', type: '특별교육', dept: 'water', date: '2026-05-21', start: '09:00', hours: 4, works: [34],
            inst: '한국안전기술원 (위탁)', place: '정수장 현장', by: '하정수', ids: ['w_wat_c1', 'w_wat_c3', 'w_wat_c4'],
            desc: '밀폐공간(정수장 침전지·맨홀) 작업 특별교육 — 최초 작업 전 4시간', file: '특별교육_일지_20260521.pdf' });
        etcCourse({ id: 'C-E4', type: '특별교육', dept: 'water', date: '2026-07-15', start: '09:00', hours: 12, works: [34],
            sessions: [{ date: '2026-07-15', start: '09:00', end: '15:00' }, { date: '2026-07-16', start: '09:00', end: '15:00' }],
            inst: '한국안전기술원 (위탁)', place: '물순환사업소 교육장', by: '하정수', ids: ['w_wat_c1', 'w_wat_c3', 'w_wat_c4'],
            desc: '밀폐공간 작업 특별교육 — 나머지 12시간 (3개월 내 분할 실시)', file: '특별교육_일지_20260715_16.pdf' });
        var e6 = etcCourse({ id: 'C-E6', type: '특별교육', dept: 'health', date: '2026-09-09', start: '13:00', hours: 4, works: [35],
            inst: '보건소 보건담당 윤담당', place: '보건소 교육실', by: '이보건', ids: ['w_hlth_c1'],
            desc: '방역 소독약품(관리대상 유해물질) 취급 작업 특별교육 — 최초 4시간', file: '특별교육_일지_20260909.pdf' });
        etcCourse({ id: 'C-E2', type: '작업내용 변경 시 교육', dept: 'facility', date: '2026-10-29', start: '15:00', hours: 1.5,
            inst: '공공시설사업소장 임시설', place: '공공시설사업소', by: '한담당', ids: ['w_fac_c1', 'w_fac_c4'],
            desc: '환경시설 점검 업무 전환 교육 — 계약직·일용 혼재', file: '작업변경교육_일지_20261029.pdf' });
        /* 관리감독자 기타교육 — 같은 모듈을 supMode 로 재사용하는 화면이라 대상이 없으면 화면이 빈다 */
        var se1 = etcCourse({ id: 'C-SE1', kind: 'SUP_ETC', type: '작업내용 변경 시 교육', dept: 'construct', date: '2026-04-23', start: '14:00', hours: 2,
            inst: '대한산업안전협회 전남지회 (위탁)', place: '건설과 회의실', by: '박안전', ids: ['w_u_con1', 'w_u_con6'],
            desc: '도로보수 → 교량점검 감독 업무 전환에 따른 교육', file: '감독자_작업변경교육_20260423.pdf' });
        etcCourse({ id: 'C-SE2', kind: 'SUP_ETC', type: '특별교육', dept: 'water', date: '2026-08-20', start: '09:00', hours: 4, works: [34],
            inst: '한국안전기술원 (위탁)', place: '물순환사업소 교육장', by: '박안전', ids: ['w_u_wat5', 'w_u_wat7'],
            desc: '밀폐공간 작업 감독자 특별교육 — 최초 4시간', file: '감독자_특별교육_20260820.pdf' });

        /* ───────── 6. 실시 결과 공문 — 온나라로 보낸 기록 ─────────
         * 상태는 연계 회신으로 바뀐 값이다. 6월은 한 번 반려돼(붙임 누락) 고쳐 다시 보냈다.
         * 공공시설사업소 자체교육은 반려된 채 다시 보내기 전이다(잠금 풀림). 11월 4일 이후 끝난 교육은 아직 기안 전이다.
         * 기안은 전부 재난안전과 박안전이다 — 부서가 등록한 자체·채용시·기타 교육도 실시 결과 공문은 재난안전과가 쓴다
         * (2026-11-13 기획 답신 3-3 «지금대로»). */
        var C = {}; courses.forEach(function (c) { C[c.id] = c; });
        var MDOC = {
            '01': ['2026-01-27', '결재완료'], '02': ['2026-02-24', '결재완료'], '03': ['2026-03-24', '결재완료'],
            '04': ['2026-04-28', '결재완료'], '05': ['2026-05-26', '결재완료'], '06': ['2026-06-23', '반려'],
            '07': ['2026-07-21', '결재완료'], '08': ['2026-08-25', '결재완료'], '09': ['2026-09-22', '결재완료'],
            '10': ['2026-10-27', '결재중']
        };
        var pend = [];
        Object.keys(MDOC).forEach(function (m) { pend.push({ c: C['C-M' + m], at: MDOC[m][0], by: '박안전', st: MDOC[m][1] }); });
        pend.push({ c: C['C-M06'], at: '2026-06-26', by: '박안전', st: '결재완료' });     /* 반려 뒤 다시 보냄 */
        pend.push({ c: sr1, at: '2026-04-02', by: '박안전', st: '결재완료' });
        pend.push({ c: sr2, at: '2026-11-05', by: '박안전', st: '기안함 전송' });
        pend.push({ c: e5, at: '2026-03-20', by: '박안전', st: '결재완료' });
        pend.push({ c: e1, at: '2026-04-10', by: '박안전', st: '결재완료' });
        pend.push({ c: e3, at: '2026-05-26', by: '박안전', st: '결재완료' });
        pend.push({ c: se1, at: '2026-04-27', by: '박안전', st: '결재완료' });     /* 관리감독자 기타교육 — 재난안전과가 등록·기안 */
        pend.push({ c: e6, at: '2026-09-14', by: '박안전', st: '결재완료' });
        pend.push({ c: hWat3, at: '2026-01-20', by: '박안전', st: '결재완료' });
        pend.push({ c: hEnv3, at: '2026-02-03', by: '박안전', st: '결재완료' });
        pend.push({ c: hCon4, at: '2026-09-17', by: '박안전', st: '결재완료' });
        pend.push({ c: sCul, at: '2026-06-22', by: '박안전', st: '결재완료' });
        pend.push({ c: sEnv, at: '2026-09-29', by: '박안전', st: '결재완료' });
        pend.push({ c: sFac, at: '2026-10-13', by: '박안전', st: '반려' });
        pend.push({ c: sWat, at: '2026-10-26', by: '박안전', st: '결재중' });
        pend.sort(function (a, b) { return a.at.localeCompare(b.at); });
        var seq = 2600;
        pend.forEach(function (p) {
            seq++;
            var dept = p.by === '박안전' ? '재난안전과' : dn(p.c.deptId);
            var no = dept + '-' + seq;
            var extra = { no: no, sid: no + '-' + docSeed.filter(function (d) { return d.courseId === p.c.id; }).length };
            if (p.st === '결재완료') { extra.doneAt = addDays(p.at, 2 + (seq % 4)); extra.regNo = dept + '-' + (seq * 3 + 1100); }
            /* 반려 사유는 그 공문에 실제로 빠진 것과 맞아야 한다 — 다시 기안하는 사람이 사유대로 고칠 수 있게 */
            if (p.st === '반려') {
                extra.rejectAt = addDays(p.at, 1);
                if (p.c.kind === 'REG_SELF') {
                    extra.attach = [];          /* 올려 둔 교육일지·사진 파일을 붙이지 않고 보냈다 */
                    extra.rejectReason = '교육일지·교육사진 붙임 누락 — 올려 둔 교육일지·사진 파일을 붙여 다시 올릴 것';
                } else {
                    extra.annex = false;        /* 이수자 명단 별지를 빼고 보냈다 */
                    extra.rejectReason = '이수자 명단(붙임 별지) 누락 — 별지를 붙여 다시 올릴 것';
                }
            }
            doc(p.c, p.at, p.by, p.st, extra);
            hist(p.c, p.at + ' 15:20', dept + ' ' + p.by, '공문 온나라로 보냄 — ' + p.c.date.slice(0, 4) + '년 안전보건교육 실시 결과 보고 — ' + p.c.desc + ' (' + no + ')');
            if (p.st === '반려') hist(p.c, extra.rejectAt + ' 10:05', '온나라 연계', '공문 반려 — ' + extra.rejectReason);
        });

        /* ───────── 7. 미이수 독촉 이력(9~11월) — 재난안전과 박안전이 보냈다 ───────── */
        var reminders = [
            { at: '2026-09-15 10:05', by: SAFETY, deptId: 'culture', workerIds: ['w_u_cul2'], memo: '정기교육 6시간 중 3시간 · 10월 집합교육(10-16) 참석 요청' },
            { at: '2026-09-25 10:20', by: SAFETY, deptId: 'town_damyang', workerIds: ['w_twn_c1'], memo: '11월 말 주기 종료 예정 · 정기교육 보충 요청' },
            { at: '2026-10-19 14:05', by: SAFETY, deptId: 'facility', workerIds: ['w_fac_c1', 'w_u_fac3'], memo: '정기교육 미달 · 11월 집합교육 참석 요청' },
            { at: '2026-10-30 09:40', by: SAFETY, deptId: 'health', workerIds: ['w_hlth_c1'], memo: '정기교육 12시간 중 3시간 · 부서 자체교육 계획 회신 요청' },
            { at: '2026-11-06 16:15', by: SAFETY, deptId: 'construct', workerIds: ['w_con_c1', 'w_con_c2'], memo: '12시간 중 9시간 · 11월 집합교육(11-11) 참석 요청' }
        ];
        return {
            seqW: 100, seqC: 30, seqR: 30,
            workers: workers, courses: courses, enrolls: enrolls, records: records,
            reminders: reminders, docSeed: docSeed, docSeq: seq
        };
    }

    function load() {
        if (db) return db;
        try { var raw = global.sessionStorage.getItem(SKEY); db = raw ? JSON.parse(raw) : seed(); }
        catch (e) { db = seed(); }
        return db;
    }
    function save() { try { global.sessionStorage.setItem(SKEY, JSON.stringify(db)); } catch (e) {} }
    function reset() {
        db = seed(); save();
        /* 이 업무가 만든 헤더 알림(예정 교육 안내)도 함께 걷는다 — 지운 교육을 가리키는 알림이 남지 않게(C-5) */
        try {
            var NK = 'dy-ntf-dyn-v1', dyn = JSON.parse(global.sessionStorage.getItem(NK) || '[]');
            global.sessionStorage.setItem(NK, JSON.stringify(dyn.filter(function (n) { return !/^edu-/.test(n.href || ''); })));
        } catch (e) {}
        return db;
    }

    /* ================= CRUD ================= */
    function workers() { return load().workers.filter(function (w) { return w.active; }); }
    function workerOf(id) { var arr = load().workers; for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }
    /* ── 다른 부서 사람의 이름·서명파일 — 조회 범위 밖이면 가린다 (2026-11-05 운영 P05) ──
     * 교육 상세·기타교육 상세는 전 부서 신청을 한 표로 보여 준다. 부서 담당자에게 남의 부서
     * 신청자 이름과 서명등록부(이름·서명이 있다)가 열리면 근로자 명단 화면이 범위를 좁힌
     * 의미가 없어진다(채용시교육 목록 = 근로자 명단 조회 범위와 같은 근거, CLAUDE.md §4).
     * 판정은 DYROLE.inScope 한 곳이다 — 주관부서·총괄 책임자는 전 부서, 그 밖은 자기 부서.
     * 가린 이름은 «#번호»다. 번호는 명단 등록 순서라 화면마다 같은 사람이 같은 번호다. */
    function canSeePerson(deptId) {
        var R = global.DYROLE;
        return !R || !R.inScope || R.inScope(deptId);
    }
    function personLabel(id) {
        var arr = load().workers;
        for (var i = 0; i < arr.length; i++) {
            if (arr[i].id !== id) continue;
            return canSeePerson(arr[i].deptId) ? arr[i].name : '#' + (i + 1);
        }
        return id;
    }
    function personLabels(ids) { return (ids || []).map(personLabel).join(', '); }
    /* 계약기간 필수 판정 — **데이터 계층에 둔다** (2026-09-01)
     * 종전 가드는 근로자 명단 화면의 저장 함수에만 있었다. 그런데 쓰기 경로가 넷이고
     * (등록·수정·지정일·엑셀) 그중 엑셀은 화면 가드를 지나지 않는다. 지금은 그 경로가
     * 계약기간을 12 로 박아 두어 드러나지 않을 뿐, 실제 엑셀 값을 읽도록 바꾸는 순간
     * 같은 결함이 조용히 돌아온다.
     * 값이 0 이면 hireHours 의 `<= 0.25`(1주 이하) 갈래에 걸려 **채용시교육 필요시간이
     * 8h 가 아니라 1h** 가 되고, 그 값이 이수 판정의 분모라 부서별 완료율까지 부푼다.
     * 「화면에서 검사하지 말고 데이터 계층에서 막는다」(CLAUDE.md §4 addEnroll 선례).
     * 화면 가드는 그대로 둔다 — 사용자에게 사유를 말해 주는 것은 화면의 몫이다. */
    function needsContractMonths(empType) { return empType === 'CONTRACT' || empType === 'DAILY'; }
    function contractOk(empType, months) {
        return !needsContractMonths(empType) || (+months > 0);
    }

    function addWorker(o) {
        /* 저장하지 않고 null 을 돌려준다 — addEnroll 이 중복에서 false 를 주는 것과 같은 형태다 */
        if (!contractOk(o.empType || 'CONTRACT', o.contractMonths)) return null;
        var d = load(); d.seqW++;
        var w = {
            id: 'w_m_' + d.seqW,
            name: o.name, deptId: o.deptId,
            category: o.category || 'FIELD',
            empType: o.empType || 'CONTRACT',
            hireDate: o.hireDate,
            designatedAt: o.designatedAt || '',
            contractMonths: o.contractMonths || 0,
            active: true, source: o.source || 'MANUAL', role: o.role || ''
        };
        d.workers.push(w); save(); return w;
    }
    /* 거절된 건은 배열에서 빠진다 — 호출부가 «몇 건이 들어갔나»를 셀 수 있어야 한다 */
    function bulkAddWorkers(list) {
        return (list || []).map(addWorker).filter(Boolean);
    }
    function updateWorker(id, patch) {
        var w = workerOf(id); if (!w) return null;
        /* 수정도 같은 검사를 지난다 — 고용형태만 바꾸고 계약기간을 두고 가면
           그 순간 0 이 판정에 쓰인다. 바꾸지 않은 값은 기존 값으로 본다. */
        var emp = ('empType' in (patch || {})) ? patch.empType : w.empType;
        var mon = ('contractMonths' in (patch || {})) ? patch.contractMonths : w.contractMonths;
        if (!contractOk(emp, mon)) return null;
        Object.keys(patch || {}).forEach(function (k) { w[k] = patch[k]; });
        save(); return w;
    }
    function removeWorker(id) {
        var w = workerOf(id); if (w) { w.active = false; save(); }
    }

    function courses(filter) {
        var arr = load().courses;
        if (filter && filter.kind) arr = arr.filter(function (c) { return c.kind === filter.kind || (Array.isArray(filter.kind) && filter.kind.indexOf(c.kind) !== -1); });
        if (filter && filter.status) arr = arr.filter(function (c) { return c.status === filter.status; });
        return arr.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    }
    function courseOf(id) { var arr = load().courses; for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }
    function addCourse(o) {
        var d = load(); d.seqC++;
        var c = {
            id: 'C-' + String(2100 + d.seqC),
            kind: o.kind, etcType: o.etcType || '',
            deptId: o.deptId || '',
            /* date·time·hours 는 회차(sessions)에서 파생된 대표값 — 기존 화면·집계 호환용 단일 창구.
             * sessions 가 있으면 date=1회차 일자, time=1회차 시작, hours=전 회차 합계다. */
            date: o.date, time: o.time || '', endTime: o.endTime || '', hours: o.hours || 0,
            sessions: (o.sessions || []).map(function (s) { return { date: s.date, start: s.start, end: s.end }; }),
            instructor: o.instructor || '', place: o.place || '', desc: o.desc || '',
            specialWorkNos: (o.specialWorkNos || []).slice(),
            specialWorkOtherReason: o.specialWorkOtherReason || '',
            files: o.files || [], photos: o.photos || [], status: o.status || 'OPEN',
            createdBy: o.createdBy || '', history: o.history || []
        };
        /* 집합교육 등록 기한 — 마지막 회차 뒤 N일(기본 7) */
        if (o.enrollDays != null && o.enrollDays !== '') c.enrollDays = +o.enrollDays;
        d.courses.push(c);
        /* 누가 등록했는지 — 부서만이 아니라 사람까지(다른 이력 줄과 같은 «부서 이름» 꼴) */
        var R = global.DYROLE;
        var who = R && R.actorLabel && R.current && R.current() ? R.actorLabel() : (o.createdBy || '');
        c.history.push({ type: 'CREATE', at: nowTs(), by: who, memo: kindLabel(c.kind) + ' 등록' });
        save(); return c;
    }
    /* ===== 교육 회차(sessions) — 일자 + 시작~종료 시각 =====
     * 시드·구 데이터에는 sessions 가 없으므로 대표값(date·time·endTime)에서 1회차를 파생한다.
     * 교육 시간은 여기서만 계산한다(화면에서 직접 빼기 금지) — 단일 출처. */
    function courseSessions(c) {
        if (!c) return [];
        if (c.sessions && c.sessions.length) return c.sessions;
        if (!c.date) return [];
        /* 회차 도입 전 시드는 시작 시각과 시간(h)만 있고 종료 시각이 없다 — 비워 두면 수정 창의
           종료 칸이 빈 채 열려 아무것도 안 바꿔도 «종료가 시작보다 뒤여야» 로 저장이 막혔다.
           시작 + 시간으로 종료를 파생한다(없는 값을 지어내는 것이 아니라 저장된 두 값의 합이다). */
        var end = c.endTime || '';
        if (!end && c.time && c.hours > 0) {
            var t = String(c.time).split(':'), m = (+t[0] || 0) * 60 + (+t[1] || 0) + Math.round(c.hours * 60);
            if (m < 24 * 60) end = ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2);
        }
        return [{ date: c.date, start: c.time || '', end: end }];
    }
    /* 회차 1건의 시간(h) — 0.1h 단위 반올림. 종료 ≤ 시작이면 0(입력 오류) */
    function sessionHours(s) {
        if (!s || !s.start || !s.end) return 0;
        var a = String(s.start).split(':'), b = String(s.end).split(':');
        var mins = ((+b[0] || 0) * 60 + (+b[1] || 0)) - ((+a[0] || 0) * 60 + (+a[1] || 0));
        if (!(mins > 0)) return 0;
        return Math.round(mins / 6) / 10;
    }
    /* 전 회차 합계(h) — 등록 폼의 '교육 시간'은 이 값으로 자동 산출된다 */
    function sumSessionHours(list) {
        var total = (list || []).reduce(function (n, s) { return n + sessionHours(s); }, 0);
        return Math.round(total * 10) / 10;
    }
    /* ── 기타교육 법정 최소 교육시간 (산안법 시행규칙 별표4) ─────────────────────
     * 같은 교육 한 건이라도 **사람마다 최소가 다르다** — 별표4가 '일용·1주 이하 기간제'와
     * '그 밖의 근로자'를 나눠 놓았기 때문이다. 그래서 건 단위가 아니라 대상자 단위로 센다.
     * 구분 축은 채용시교육의 hireHours() 와 같다(같은 별표의 같은 갈래).
     *
     * **판정만 하고 저장을 막지 않는다.** 법정 미달로 실시된 교육도 기록은 남아야 한다 —
     * 막으면 아예 안 남기고, 안 남으면 미달이었다는 사실 자체가 사라진다. 사유도 받지
     * 않는다. 사유를 강제하면 담당자가 시간을 부풀려 적을 유인이 생겨 더 나빠진다.
     * 대신 입력할 때 알리고 목록·상세에 **계속 드러낸다** — 시스템이 아는 사실을 감추지
     * 않는 것이 요점이다. (부서 이행 체크의 '해당 없음' 사유 강제와는 이유가 다르다 —
     * 저기는 빠져나가는 수단이라 막아야 했고 여기는 사실 기록이다.) */
    function isShortTermWorker(w) {
        if (!w) return false;
        if (w.empType === 'DAILY') return true;
        return w.empType === 'CONTRACT' && (w.contractMonths || 0) <= 0.25;   /* 1주 이하 */
    }
    function etcMinHours(etcType, worker, supMode) {
        var info = etcTypeInfo(etcType, supMode);
        if (!info || !info.hours || !info.hours.length) return 0;   /* 그 모집단에 없는 유형 */
        /* 갈래가 하나인 경우 — 건설업 기초(건설 일용근로자)와 관리감독자 전 유형.
           별표4 제1호의2 에는 교육대상 열 자체가 없어 고용형태로 갈리지 않는다. */
        if (info.hours.length === 1) return info.hours[0].h;
        return isShortTermWorker(worker) ? info.hours[0].h : info.hours[info.hours.length - 1].h;
    }
    /* 그 교육 건에서 법정 최소에 못 미친 대상자 — [{ worker, need, got }]
     *
     * **한 건만 보고 판정해도 되는 유형에만 한다**(ETC_TYPE_INFO 의 perCourseCheck).
     * 별표4를 열어 보면 특별교육에는 다른 두 유형에 없는 단서가 붙어 있다 —
     *   "16시간 이상(최초 작업 종사 전 4시간 이상, 12시간은 3개월 이내 분할 가능
     *    / 단기간·간헐적 작업은 2시간 이상)"
     * 즉 4시간짜리 한 건은 적법한 첫 회차일 수 있고, 단기간 작업이면 2시간으로 끝난다.
     * 그런데 이 시스템은 ① 어느 대상 작업에 대한 특별교육인지 ② 분할 이력 ③ 단기간·간헐
     * 여부를 받지 않는다. 받지 않기로 한 것은 의도된 결정이다(대상 작업을 등록 항목으로
     * 만들면 목록에 없는 사례를 등록 불가로 만든다). 모르는 것을 근거로 '미달'이라 찍으면
     * 적법한 교육에 위법 표시가 붙는다 — 그래서 특별교육은 판정하지 않고 규정을 안내한다.
     * 최소시간만 보고 판정했다면 이 단서를 놓쳤을 것이다. */
    function etcShortfall(course) {
        if (!course || (course.kind !== 'ETC' && course.kind !== 'SUP_ETC')) return [];
        var sup = course.kind === 'SUP_ETC';
        var info = etcTypeInfo(course.etcType, sup);
        if (!info || info.perCourseCheck === false) return [];
        var got = course.hours || 0, out = [];
        /* recordsFor(workerId) 는 사람 축이다 — 여기선 그 교육 건의 이수기록이 필요하다 */
        records().forEach(function (r) {
            if (r.courseId !== course.id) return;
            var w = workerOf(r.workerId); if (!w) return;
            var need = etcMinHours(course.etcType, w, sup);
            if (need > 0 && got < need) out.push({ worker: w, need: need, got: got });
        });
        return out;
    }
    /* 교육 일시 표시 헬퍼 — 'YYYY-MM-DD HH:MM~HH:MM' (다회차면 '외 N일') */
    function courseDateTime(c) {
        if (!c || !c.date) return '';
        var ss = courseSessions(c);
        var s0 = ss[0] || { date: c.date, start: c.time || '', end: '' };
        var txt = s0.date + (s0.start ? ' ' + s0.start : '') + (s0.start && s0.end ? '~' + s0.end : '');
        return txt + (ss.length > 1 ? ' 외 ' + (ss.length - 1) + '일' : '');
    }
    function updateCourse(id, patch) {
        var c = courseOf(id); if (!c) return null;
        Object.keys(patch || {}).forEach(function (k) { c[k] = patch[k]; });
        save(); return c;
    }
    function pushCourseHistory(id, entry) {
        var c = courseOf(id); if (!c) return;
        c.history = c.history || [];
        c.history.push({ type: entry.type, at: entry.at || nowTs(), by: entry.by || '', memo: entry.memo || '' });
        save();
    }
    /* 교육 삭제 — 신청(enroll)·이수기록(record)까지 연쇄 회수한다.
     * 완료된 교육을 지우면 그 교육으로 쌓인 이수시간도 함께 사라지므로,
     * 호출측은 반환된 건수를 확인 문구에 노출해야 한다. */
    function removeCourse(id) {
        var d = load();
        var ci = -1;
        for (var i = 0; i < d.courses.length; i++) if (d.courses[i].id === id) { ci = i; break; }
        if (ci < 0) return null;
        var enrollCnt = d.enrolls.filter(function (e) { return e.courseId === id; }).length;
        var recordCnt = d.records.filter(function (r) { return r.courseId === id; }).length;
        d.courses.splice(ci, 1);
        d.enrolls = d.enrolls.filter(function (e) { return e.courseId !== id; });
        d.records = d.records.filter(function (r) { return r.courseId !== id; });
        save();
        return { enrolls: enrollCnt, records: recordCnt };
    }
    /* 근로자 1명만 교육에서 회수 — 한 교육 건에 여러 명이 묶인 경우(채용시 일괄 이수처리 '묶기')
     * 교육 건을 통째로 지우면 다른 대상자의 이수기록까지 사라지므로, 그 사람의 신청·이수기록만 뺀다.
     * 남은 대상자가 없으면 빈 교육 건은 함께 회수한다.
     * 반환 = { records: 회수된 이수기록 수, courseRemoved: 교육 건까지 삭제됐는지 } */
    function removeWorkerFromCourse(courseId, workerId) {
        var d = load(), recCnt = 0;
        d.records = d.records.filter(function (r) {
            if (r.courseId === courseId && r.workerId === workerId) { recCnt++; return false; }
            return true;
        });
        d.enrolls.forEach(function (e) {
            if (e.courseId !== courseId) return;
            e.workerIds = (e.workerIds || []).filter(function (w) { return w !== workerId; });
        });
        /* 대상자가 모두 빠진 신청 행은 제거 */
        d.enrolls = d.enrolls.filter(function (e) { return e.courseId !== courseId || (e.workerIds || []).length; });
        var left = d.enrolls.filter(function (e) { return e.courseId === courseId; })
                .reduce(function (n, e) { return n + (e.workerIds || []).length; }, 0) +
            d.records.filter(function (r) { return r.courseId === courseId; }).length;
        var courseRemoved = false;
        if (!left) {
            d.courses = d.courses.filter(function (c) {
                if (c.id === courseId) { courseRemoved = true; return false; }
                return true;
            });
        }
        save();
        return { records: recCnt, courseRemoved: courseRemoved };
    }
    /* 참석자 등록부 등록 취소 — 교육이 이미 종료(DONE)된 뒤라면 해당 부서 근로자의 이수기록도 회수 */
    function removeEnroll(courseId, deptId) {
        var d = load();
        var target = d.enrolls.filter(function (e) { return e.courseId === courseId && e.deptId === deptId; });
        if (!target.length) return null;
        var wids = {};
        target.forEach(function (e) { (e.workerIds || []).forEach(function (w) { wids[w] = true; }); });
        var recordCnt = d.records.filter(function (r) { return r.courseId === courseId && wids[r.workerId]; }).length;
        d.enrolls = d.enrolls.filter(function (e) { return !(e.courseId === courseId && e.deptId === deptId); });
        d.records = d.records.filter(function (r) { return !(r.courseId === courseId && wids[r.workerId]); });
        save();
        return { workers: Object.keys(wids).length, records: recordCnt };
    }

    function allEnrolls(courseId) { return load().enrolls.filter(function (e) { return !courseId || e.courseId === courseId; }); }
    function enrolls(courseId) { return allEnrolls(courseId).filter(function (e) { return e.status !== 'CANCELLED'; }); }
    /* 그 교육에 이 부서가 이미 등록했는가 — 화면이 저장 전에 미리 묻는 창구 */
    function hasEnroll(courseId, deptId) {
        /* 등록 취소(정정)된 등록부는 세지 않는다 — 세면 정정 뒤 같은 부서를 다시 등록할 수 없다.
           SCR-EDU-004 §4-3 «같은 부서를 다시 등록할 수 있다»와 addEnroll 의 판정이 이미 그렇다(2026-10-06 검토). */
        return enrolls(courseId).some(function (e) { return e.deptId === deptId; });
    }
    /* 참석자 등록부 등록.
     *
     * **한 교육에 같은 부서를 두 번 담지 않는다 (2026-08-13 신설).** 종전에는 무조건
     * push 라 같은 부서가 다시 등록하면 행이 하나 더 쌓였고, 그 행마다 이수기록이
     * 새로 붙어 **한 사람이 같은 교육을 두 번 이수한 것**이 됐다. 이수 판정(완료율)과
     * 공문 붙임 별지의 인원 수가 함께 부풀고, 신청 취소는 부서 단위라 한 번에 두 행이
     * 지워져 단위까지 어긋났다.
     * 인원·서명파일을 고치는 경로는 **신청 취소 후 재등록**이다 — 대상자 변경을
     * '취소 → 재신청'으로 확정한 것과 같은 규칙이다(CLAUDE.md §4).
     * 데이터 계층에서 막는 이유는 호출부가 7곳이고 그중 넷이 채용시교육 자동 생성
     * 경로라, 화면마다 검사를 두면 반드시 빠뜨리는 곳이 생기기 때문이다.
     * 반환 — 저장했으면 true, 중복이라 거절했으면 false. */
    /* ── 교육의 모집단 — 현업근로자 교육과 관리감독자 교육은 대상이 갈린다 (2026-11-05 운영 E19) ──
     * 운영 서버에서 현업근로자 집합교육 등록부 후보에 관리감독자가 섞여 나왔다. 관리감독자
     * 정기교육은 별도 교육(관리감독자 › 정기교육)이라 섞이면 같은 사람이 두 정기교육에
     * 이수기록을 갖고, 현업근로자 이수율의 분모·분자가 함께 틀어진다.
     * 화면 후보만 거르면 전역 호출로 뚫리므로 **저장 경로(addEnroll)에서 같은 판정**을 한다.
     * 채용시교육(HIRE)은 근로자·관리감독자가 같은 kind 를 쓰므로 여기서 가르지 않는다. */
    function populationOfKind(kind) {
        if (kind === 'SUP_REG' || kind === 'SUP_ETC') return 'SUP';
        if (kind === 'REG_GROUP' || kind === 'REG_SELF' || kind === 'ETC') return 'FIELD';
        return '';
    }
    function populationIssue(kind, workerIds) {
        var pop = populationOfKind(kind);
        if (!pop) return '';
        var bad = (workerIds || []).filter(function (id) {
            var w = workerOf(id);
            if (!w) return false;
            return pop === 'SUP' ? w.category !== 'SUPERVISOR' : w.category === 'SUPERVISOR';
        });
        if (!bad.length) return '';
        return pop === 'SUP'
            ? '관리감독자 교육에는 관리감독자만 등록할 수 있습니다.'
            : '현업근로자 교육에는 관리감독자를 등록할 수 없습니다 — 관리감독자는 관리감독자 교육에 등록합니다.';
    }
    /* ── 실제 참석시간 — 등록부 한 줄의 공통값(actualHours) + 사람별 예외(hoursBy) ──
     * 집합교육 인정시간은 등록부의 실제 참석시간이고(§4 · SCR-EDU-004 §6) 사람마다 다를 수 있다
     * (일찍 나간 사람). 공통값이 비어 있으면(null) 전 회차 참석 = 교육 합계다. 사람별 값이 있으면 그 값이 이긴다.
     * 이수기록·시간 동기화·합계 축소 검사가 모두 이 한 함수로 사람의 시간을 읽는다. */
    function enrollHours(e, workerId, courseHours) {
        if (e && e.hoursBy && e.hoursBy[workerId] != null) return +e.hoursBy[workerId];
        if (e && e.actualHours != null) return +e.actualHours;
        return courseHours;
    }
    /* 0 보다 크고 교육 합계 이하 — 공통값·사람별 값 모두. 화면 두 곳(목록·상세)과 일괄 등록이 같은 검사를 지난다 */
    function enrollHoursIssue(o) {
        var c = courseOf(o.courseId);
        if (!c || !isGroupCourse(c)) return '';
        var max = +c.hours || 0;
        var bad = function (h) { return h != null && h !== '' && !(+h > 0 && +h <= max); };
        if (bad(o.actualHours)) return '실제 참석시간은 0보다 크고 교육 시간(' + max + 'h) 이하로 적습니다.';
        var hb = o.hoursBy || {};
        if (Object.keys(hb).some(function (k) { return bad(hb[k]); })) return '사람별 실제 참석시간은 0보다 크고 교육 시간(' + max + 'h) 이하로 적습니다.';
        return '';
    }
    /* 등록부를 저장할 수 없는 이유 — 화면이 addEnroll 의 false 를 사유로 바꿔 말할 때 쓴다 */
    function enrollDenyReason(o) {
        var c = courseOf(o.courseId);
        var pop = c ? populationIssue(c.kind, o.workerIds) : '';
        if (pop) return pop;
        var hi = enrollHoursIssue(o);
        if (hi) return hi;
        if (hasEnroll(o.courseId, o.deptId)) return deptName(o.deptId) + (global.DYV2 && global.DYV2.josa ? global.DYV2.josa(deptName(o.deptId), '은', '는') : '은(는)') + ' 이미 등록된 부서입니다 — 등록 취소 후 다시 등록하세요.';
        if (c && c.status === 'OPEN' && isGroupCourse(c) && !enrollOpen(c)) return '교육이 끝난 뒤(' + lastSessionDate(c) + '부터) 참석자 등록부를 올립니다.';
        return '';
    }
    function addEnroll(o) {
        var d = load();
        if (d.enrolls.some(function (e) { return e.courseId === o.courseId && e.deptId === o.deptId && e.status !== 'CANCELLED'; })) return false;
        /* 모집단이 맞지 않는 사람이 섞이면 저장하지 않는다(E19) */
        var oc = courseOf(o.courseId);
        if (oc && populationIssue(oc.kind, o.workerIds)) return false;
        /* 집합교육 등록부는 교육이 끝난 뒤에만 받는다 — 화면 두 곳(목록·상세)이 같은 판정을 지난다 */
        if (oc && oc.status === 'OPEN' && isGroupCourse(oc) && !enrollOpen(oc)) return false;
        /* 실제 참석시간 — 0 < h ≤ 교육 합계(공통값·사람별 모두). 화면이 검사를 빠뜨려도 여기서 막는다 */
        if (enrollHoursIssue(o)) return false;
        var wids = (o.workerIds || []).slice();
        var hoursBy = null;
        Object.keys(o.hoursBy || {}).forEach(function (k) {
            if (wids.indexOf(k) === -1 || o.hoursBy[k] == null || o.hoursBy[k] === '') return;
            (hoursBy = hoursBy || {})[k] = +o.hoursBy[k];
        });
        d.enrolls.push({
            courseId: o.courseId, deptId: o.deptId,
            workerIds: wids,
            signFile: o.signFile || '', actualHours: o.actualHours == null || o.actualHours === '' ? null : +o.actualHours,
            /* 사람별 실제 참석시간 — 공통값과 다른 사람만(없으면 키 자체가 없다) */
            hoursBy: hoursBy || undefined,
            status: 'ACTIVE', at: o.at || today(),
            /* 누가 올렸는지 — 재난안전과가 다른 부서 몫을 대신 올리면 proxy(대리 등록) */
            by: o.by || '', proxy: !!o.proxy,
            /* bulk — 재난안전과 일괄 등록(여러 부서 · 서명부 한 파일, 2026-11-11). 올린 쪽이 고친다:
               이 줄은 그 부서가 [등록 취소] 하지 못하고 재난안전과 담당자만 정정한다 */
            bulk: !!o.bulk
        });
        save();
        return true;
    }

    /* 완료 교육의 등록부 정정 — 원행을 지우지 않고 취소 상태·사유를 보존한다.
     * 이수 집계에서는 연결 기록만 제외하고, 취소된 등록부는 감사 이력으로 남는다. */
    function cancelCompletedEnroll(courseId, deptId, reason, by) {
        var d = load();
        var target = d.enrolls.filter(function (e) {
            return e.courseId === courseId && e.deptId === deptId && e.status !== 'CANCELLED';
        });
        if (!target.length) return null;
        var wids = {};
        target.forEach(function (e) {
            (e.workerIds || []).forEach(function (w) { wids[w] = true; });
            e.status = 'CANCELLED'; e.cancelReason = reason || ''; e.cancelledBy = by || ''; e.cancelledAt = nowTs();
        });
        var recordCnt = 0;
        d.records = d.records.filter(function (r) {
            if (r.courseId === courseId && wids[r.workerId]) { recordCnt++; return false; }
            return true;
        });
        save();
        return { workers: Object.keys(wids).length, records: recordCnt };
    }

    function records() { return load().records; }
    function recordsFor(workerId, kind) {
        return records().filter(function (r) {
            if (workerId && r.workerId !== workerId) return false;
            if (kind && r.kind !== kind) return false;
            return true;
        });
    }
    function addRecord(o) {
        var d = load();
        d.records.push({
            workerId: o.workerId, courseId: o.courseId || '',
            kind: o.kind, hours: o.hours || 0, date: o.date || today()
        });
        save();
    }
    function recordCourseCompletion(courseId, workerIds, hours, dateISO) {
        (workerIds || []).forEach(function (wid) {
            addRecord({ workerId: wid, courseId: courseId, kind: recordKindForCourse(courseId), hours: hours, date: dateISO || today() });
        });
    }
    /* 등록부 한 줄을 이수기록으로 — 사람마다 그 사람의 실제 참석시간(enrollHours)으로 남긴다.
       종료 처리와 종료 뒤 정정 등록부가 같은 함수를 지난다 */
    function recordEnrollCompletion(e, dateISO) {
        var c = e ? courseOf(e.courseId) : null; if (!c) return 0;
        (e.workerIds || []).forEach(function (wid) {
            addRecord({ workerId: wid, courseId: e.courseId, kind: recordKindForCourse(e.courseId), hours: enrollHours(e, wid, c.hours), date: dateISO || c.date });
        });
        return (e.workerIds || []).length;
    }
    /* 교육 정보 수정으로 시간·일자가 바뀌면 이미 쌓인 이수기록도 맞춘다.
     * (안 맞추면 교육 카드의 'Nh'와 이수현황의 '인정 Nh'가 조용히 어긋난다)
     * 반환 = 갱신된 기록 건수 */
    /* 집합교육인가 — 인정시간이 교육 합계가 아니라 **등록부 실제 참석시간**인 교육 */
    function isGroupCourse(c) { return !!c && (c.kind === 'REG_GROUP' || c.kind === 'SUP_REG'); }
    /* 그 근로자가 속한 (취소되지 않은) 등록부 */
    function enrollOfWorker(courseId, workerId) {
        return enrolls(courseId).filter(function (e) { return (e.workerIds || []).indexOf(workerId) !== -1; })[0] || null;
    }
    function syncCourseRecordHours(courseId, hours, dateISO) {
        var d = load(), n = 0;
        /* 집합교육은 등록부 참석시간이 정본이다(SCR-EDU-004 §6, 기획확인 4차 3차 1-1 · 2026-10-06).
           회차를 고쳐도 **적어 둔 참석시간은 바꾸지 않는다** — 하루만 온 사람에게 전체 시간을 주면
           하지 않은 교육을 했다고 기록하게 된다. 참석시간을 따로 적지 않은 등록부(= 전 회차 참석)만
           새 합계를 따른다. 이수일은 교육 일자를 따른다. 종전에는 강사·장소만 고쳐도 전원을 합계로
           덮어써 등록부 참석시간이 조용히 사라졌다. */
        var group = isGroupCourse(courseOf(courseId));
        d.records.forEach(function (r) {
            if (r.courseId !== courseId) return;
            var nh = hours;
            if (group) {
                var en = enrollOfWorker(courseId, r.workerId);
                nh = en ? enrollHours(en, r.workerId, hours) : hours;
            }
            if (r.hours === nh && (!dateISO || r.date === dateISO)) return;
            r.hours = nh;
            if (dateISO) r.date = dateISO;
            n++;
        });
        if (n) save();
        return n;
    }
    /* 집합교육 합계를 줄일 때 — 적어 둔 참석시간이 새 합계보다 큰 등록부. 있으면 저장을 막는다:
       참석시간이 교육 합계를 넘을 수는 없고, 참석시간을 시스템이 줄이면 기록을 고친 것이 된다.
       그 부서 등록부를 먼저 정정(등록 취소 후 재등록)한다. */
    function groupHoursConflicts(courseId, newHours) {
        if (!isGroupCourse(courseOf(courseId))) return [];
        /* 공통값과 사람별 값 가운데 가장 큰 것으로 본다 — 한 사람이라도 새 합계를 넘으면 그 등록부부터 정정한다 */
        return enrolls(courseId).map(function (e) {
            var hs = [];
            if (e.actualHours != null) hs.push(+e.actualHours);
            Object.keys(e.hoursBy || {}).forEach(function (k) { hs.push(+e.hoursBy[k]); });
            return { e: e, max: hs.length ? Math.max.apply(null, hs) : null };
        }).filter(function (x) { return x.max != null && x.max > newHours; })
          .map(function (x) { return { deptId: x.e.deptId, deptName: deptName(x.e.deptId), actualHours: x.max }; });
    }
    function recordKindForCourse(courseId) {
        var c = courseOf(courseId); if (!c) return 'ETC';
        if (c.kind === 'HIRE') return 'HIRE';
        if (c.kind === 'ETC' || c.kind === 'SUP_ETC') return 'ETC';
        return 'REG'; /* REG_GROUP, REG_SELF, SUP_REG */
    }

    function reminders() { return load().reminders; }
    /* 부서의 교육 «할 일» — 내 할일과 대시보드가 **같은 목록을 센다**(기획확인 4차 회신, 2026-10-06).
     *   apply  — 접수 중인 집합교육에 그 부서 참석자 등록부가 아직 없다
     *   remind — 독촉받은 미이수자(현재 주기 미완료)
     * 이수율 같은 현황은 할 일이 아니라 넣지 않는다. 종전에는 내 할일만 이 두 가지를 세고 대시보드는
     * 예시 숫자를 써서, 같은 부서의 교육 할 일이 두 화면에서 다르게 보였다. 판정을 한 곳에 둔다. */
    /* ===== 참석자 등록부를 받는 때 (2026-11-12) =====
     * 서명은 참석 사실의 증빙이고 실제 참석시간은 교육이 끝나야 정해진다 — 그래서 등록부는
     * **마지막 회차가 끝난 날부터** 받는다(교육 전 등록 금지). 사전 신청·불참자 처리는 두지 않는다
     * (2026-07-16 «한 단계» 결정 유지). 등록 기한 = 마지막 회차 + enrollDays(기본 7일). */
    function lastSessionDate(c) {
        var ss = courseSessions(c);
        return ss.length ? ss.map(function (x) { return x.date || ''; }).sort().pop() : (c && c.date) || '';
    }
    function enrollDays(c) { return c && c.enrollDays != null && c.enrollDays !== '' ? +c.enrollDays : 7; }
    function enrollDue(c) {
        var d = lastSessionDate(c); if (!d) return '';
        var t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + enrollDays(c));
        return t.toISOString().slice(0, 10);
    }
    /* 등록부를 지금 받는가 — 접수 중이고 교육이 끝났을 때 */
    function enrollOpen(c) {
        if (!c || c.status !== 'OPEN') return false;
        if (!isGroupCourse(c)) return true;
        var d = lastSessionDate(c);
        return !d || today() >= d;
    }
    function deptTodos(deptId) {
        var out = [];
        if (!deptId) return out;
        var en = enrolls();
        courses({ status: 'OPEN' }).forEach(function (c) {
            if (c.kind !== 'REG_GROUP' && c.kind !== 'SUP_REG') return;
            /* 교육이 끝나기 전에는 할 일이 아니다 — 끝난 날 생기고 등록 기한을 단다 */
            if (!enrollOpen(c)) return;
            if (en.some(function (e) { return e.courseId === c.id && e.deptId === deptId; })) return;
            out.push({ kind: 'apply', course: c, due: enrollDue(c) });
        });
        reminders().forEach(function (r) {
            if (r.deptId !== deptId) return;
            (r.workerIds || []).forEach(function (wid) {
                var w = workerOf(wid); if (!w) return;
                var sr = statusRow(w, today());
                if (sr.complete) return;
                out.push({ kind: 'remind', worker: w, row: sr, reminder: r });
            });
        });
        return out;
    }
    /* ===== 예정 교육 — 교육 전인 집합교육을 대상 부서에 미리 알린다 (2026-11-13 X-1 확정) =====
     * 할 일이 아니다 — deptTodos 에 넣지 않는다. 내 할일은 «예정 교육» 묶음으로 따로 보이고
     * 지연·이번주·전체 수와 대시보드 부서 할 일 수에 들어가지 않는다. 교육이 끝나는 날(마지막 회차)
     * 사라지고, 그날부터 «참석자 등록부 등록» 할 일이 생긴다(enrollOpen). 참석 안내 자체는 지금처럼
     * 바깥 공문으로 한다 — 이 알림은 일시·장소를 미리 보이는 것뿐이다.
     * 대상 부서 = 그 교육의 모집단(현업근로자 교육 = 관리감독자 아닌 사람 · 관리감독자 교육 = 관리감독자)이
     * 있는 부서. 등록부 모집단 판정(populationOfKind)과 같은 갈래다. */
    function courseTargetDepts(c) {
        if (!isGroupCourse(c)) return [];
        var pop = populationOfKind(c.kind), seen = {}, out = [];
        workers().forEach(function (w) {
            var inPop = pop === 'SUP' ? w.category === 'SUPERVISOR' : w.category !== 'SUPERVISOR';
            if (!inPop || !w.deptId || seen[w.deptId]) return;
            seen[w.deptId] = 1; out.push(w.deptId);
        });
        return out;
    }
    /* 교육 전 — 접수 중이고 마지막 회차 날이 아직 오지 않았다(그날부터는 등록부를 받는다) */
    function isUpcoming(c) { return !!c && isGroupCourse(c) && c.status === 'OPEN' && !enrollOpen(c); }
    /* «MM-DD HH:MM» (다회차면 «외 N일») · 장소 — 카드·알림이 같은 말을 쓴다 */
    function upcomingWhen(c) {
        var ss = courseSessions(c), s0 = ss[0] || { date: c.date, start: c.time || '' };
        return String(s0.date || '').slice(5) + (s0.start ? ' ' + s0.start : '') + (ss.length > 1 ? ' 외 ' + (ss.length - 1) + '일' : '');
    }
    function upcomingTitle(c) {
        return '예정 교육 — ' + (c.desc || kindLabel(c.kind)) + ' · ' + upcomingWhen(c) + (c.place ? ' · ' + c.place : '');
    }
    function deptUpcoming(deptId) {
        if (!deptId) return [];
        return courses({ status: 'OPEN' }).filter(function (c) {
            return isUpcoming(c) && courseTargetDepts(c).indexOf(deptId) !== -1;
        }).sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); });
    }
    /* 등록 직후 대상 부서 알림함에 «집합교육 예정 안내» — 받는 부서 사람에게만 보인다(toDept).
     * 오늘이 마지막 회차 날이면 보내지 않는다(이미 등록부를 받는 중이라 «예정»이 아니다). 보낸 부서 수를 돌려준다. */
    function notifyUpcoming(courseId) {
        var c = courseOf(courseId), L = global.DYLayout;
        if (!isUpcoming(c) || !L || !L.ntfPush) return 0;
        var depts = courseTargetDepts(c);
        depts.forEach(function (deptId) {
            try {
                L.ntfPush({ cat: 'compliance', catLabel: '이행', toDept: deptId,
                    title: '집합교육 예정 안내 — ' + (c.desc || kindLabel(c.kind)) + ' · ' + upcomingWhen(c) + (c.place ? ' · ' + c.place : ''),
                    href: 'edu-reg-detail.html?id=' + encodeURIComponent(c.id), work: 'my-work.html', basis: 'osh-29' });
            } catch (e) {}
        });
        return depts.length;
    }
    function addReminder(o) {
        var d = load();
        d.reminders.push({
            at: nowTs(), by: o.by || '재난안전과',
            deptId: o.deptId || '', workerIds: (o.workerIds || []).slice(),
            memo: o.memo || ''
        });
        save();
    }

    /* ================= 헬퍼 ================= */
    /* today()/realToday() 는 파일 상단에 정의 — 오늘 기준 단일 출처(DYV2.today()) */
    /* 날짜는 기준일(DYV2.today) · 시각만 실제 시계 — rsk-data.js 와 같은 이유(§11) */
    function nowTs() {
        var t = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
        return today() + ' ' + pad(t.getHours()) + ':' + pad(t.getMinutes());
    }
    function deptName(id) {
        try { var n = global.DYV2 && global.DYV2.orgNode ? global.DYV2.orgNode(id) : null; return n ? n.name : id; }
        catch (e) { return id; }
    }
    function deptCandidates() {
        var out = [];
        if (!global.DYV2 || !global.DYV2.orgWalk) return out;
        global.DYV2.orgWalk(function (n) {
            if (n.type === 'dept' || n.type === 'office' || n.type === 'town') out.push({ id: n.id, name: n.name });
        });
        return out;
    }

    /* ================= 조작 권한 — DYROLE.canAct 파생 (CLAUDE.md §12) =================
     * 판정은 DYROLE.canAct 단일 출처이고, 교육 도메인이 더하는 것은 «그 건이 어느 부서
     * 소관인가» 하나다. 부서가 비어 있는 교육 — 집합교육·여러 부서를 묶은 채용시교육 — 은
     * 주관부서(재난안전과)가 연 건이므로 주관부서 소관으로 본다(등록 주체 = 기안 주체,
     * SCR-EDU-001 §6 「여러 부서를 묶은 건은 주관부서 담당자만 기안한다」).
     * 빈 값을 그대로 canAct('') 에 넘기면 «부서 없는 전사 항목»으로 읽혀 담당자 전원이
     * 통과한다 — 부서 담당자가 재난안전과 집합교육을 수정·삭제·종료하고 공문까지 기안하던
     * 결함이 그것이었다(2026-09-28 권한별 QA).
     * 화면은 아래 함수만 본다. 버튼만 감추면 전역 호출로 뚫리므로 진입·저장 양쪽에 건다. */
    function role() { return global.DYROLE; }
    function ownerDept() { return (role() && role().OWNER_DEPT) || 'safety'; }
    function myDept() { var r = role(); return r && r.deptId ? r.deptId() : ''; }
    /* 교육 건의 소관 부서 */
    function courseDeptOf(c) { return (c && c.deptId) || ownerDept(); }
    /* 이 부서 건을 등록·수정·삭제할 수 있는가 */
    function canActDept(deptId) {
        var r = role();
        if (!r || !r.canAct) return true;               /* 롤 스위처 없는 환경은 종전대로 */
        return r.canAct(deptId || ownerDept());
    }
    function canActCourse(c) { return canActDept(courseDeptOf(c)); }
    /* 등록 수단을 낼지 — 자기 부서 건이라도 등록할 수 있는 사람인가(관리·감독 계층은 조회만) */
    function canRegister() { return canActDept(myDept() || ownerDept()); }
    /* 부서를 고를 수 있는가 — 전 부서 건을 처리하는 주관부서 담당자만. 그 밖의 담당자는
       소속 부서로 고정한다(남의 부서 명의로 저장되면 조회 범위 밖이라 본인 목록에서도 사라진다) */
    function canPickDept() { return canActDept(ownerDept()); }
    /* 등록 폼의 부서 기본값 — 로그인한 사람의 소속(후보에 있을 때). 목록 첫 부서를 기본으로
       두면 부서 담당자가 눈치채지 못한 채 기획예산실 명의로 저장한다(수시평가 등록과 같은 규칙) */
    function defaultDeptId() {
        var mine = myDept(), c = deptCandidates();
        if (mine && c.some(function (d) { return d.id === mine; })) return mine;
        return c.length ? c[0].id : '';
    }
    /* 거절 사유 — 누가 하는지를 밝힌다. «권한이 없습니다»로 뭉뚱그리면 다음에 누구를
       찾아가야 할지 모른다 */
    function denyMsg(deptId) {
        var r = role(), p = r && r.current ? r.current() : null;
        if (p && p.tier !== 'staff') return '관리·감독 계층은 조회만 합니다 — 등록·수정은 담당자가 합니다.';
        var d = deptId || ownerDept();
        return d === ownerDept()
            ? '재난안전과 소관이라 재난안전과 담당자가 처리합니다.'
            : deptName(d) + ' 소관이라 그 부서 담당자 또는 재난안전과 담당자가 처리합니다.';
    }

    /* ================= 메타 라벨 ================= */
    var KIND_LABEL = {
        REG_GROUP: '정기교육(집합)', REG_SELF: '정기교육(자체)',
        HIRE: '채용시교육', ETC: '기타 교육',
        SUP_REG: '관리감독자 정기교육', SUP_ETC: '관리감독자 기타 교육'
    };
    function kindLabel(k) { return KIND_LABEL[k] || k; }
    var CAT_LABEL = { OFFICE: '사무직', FIELD: '비사무직(현업)', SALES: '판매', SUPERVISOR: '관리감독자' };
    function catLabel(c) { return CAT_LABEL[c] || c; }
    var EMP_LABEL = { CIVIL: '공무원', PUBLIC: '공무직', CONTRACT: '기간제', DAILY: '일용' };
    function empLabel(e) { return EMP_LABEL[e] || e; }
    var SRC_LABEL = { HR: '인사연동', MANUAL: '직접등록', EXCEL: '엑셀업로드' };
    function srcLabel(s) { return SRC_LABEL[s] || s; }
    /* ===== 기타교육 유형 — 2026-07-30 회의 확정 3종 =====
     * 발주처: "작업 내용 변경 시 교육 특별 교육 건설 기초 안전 보건 교육 이 세 가지죠."
     *   ※ 구 5종(MSDS·직무교육·자체·기타)은 법정 교육구분이 아니어서 폐지 — 되살리지 말 것.
     *   ※ '정기교육'을 여기 넣지 않은 이유: 담양군은 현업 판매직이 없고 사무직 위주라
     *      정기교육은 일반사항으로 별도 화면(edu-reg)에서 다룬다(발주처 설명, 녹취 1165~1167).
     *
     * hours — 산업안전보건법 시행규칙 **별표4**(DYLAW 'oshr-t4')가 정한 법정 최소 교육시간.
     *   발주처: "여기에 목록에 대한 시간도 적어주셔야 되는 거 잊지 마시고"
     *   채용시교육 필요시간(hireHours)과 같은 방식으로 여기에 둔다. 값을 고칠 일이 생기면
     *   화면이 아니라 **별표4 조문을 먼저 열어보고** 바꾼다(CLAUDE.md §10 검증 6문 #1).
     * works — 그 유형의 대상 작업 목록. 특별교육 대상 작업(39종)은 별표4가 아니라
     *   **시행규칙 별표5 제1호라목**이 정한다(2026-08-11 수집, DYLAW 'oshr-t5').
     *   목록을 여기 복사해 두지 않고 `DYLAW.specialEduWorks()` 로 조문에서 파생한다 —
     *   복사본을 두면 조문 개정 때 화면만 옛 목록으로 남는다(CLAUDE.md §10).
     *
     * ── 모집단마다 유형이 다르다 (2026-08-13 정정) ────────────────────────────
     * 별표4는 **제1호(근로자)와 제1호의2(관리감독자)를 다른 표로** 두고 있고,
     * 두 표의 내용이 실제로 다르다. 종전에는 `ETC_TYPES` 배열 하나를 두 화면이
     * 공유해 관리감독자 화면이 **법에 없는 의무를 있다고 표시**하고 있었다.
     *
     *   | | 근로자(제1호) | 관리감독자(제1호의2) |
     *   |---|---|---|
     *   | 작업내용 변경 시 | 일용·1주 이하 1h / 그 밖 2h | **2h 단일** |
     *   | 특별교육 | 일용·1주 이하 2h(별표5 라목39호 8h) / 그 밖 16h | **16h 단일** |
     *   | 건설업 기초 | 건설 일용근로자 4h | **없음** |
     *   | 채용 시 | 채용시교육 화면(edu-hire) | 8h — **현행 화면 범위 밖** |
     *
     * 관리감독자 표에 **일용 갈래가 없는 것**은 오탈자가 아니다. 제1호의2 는
     * 교육대상 열 자체가 없고 교육과정별 시간 하나만 정한다.
     * 건설업 기초가 없는 근거는 별표4만이 아니라 **산안법 §31①**(`osh-31`)이다 —
     * 의무 주체를 「건설업의 사업주」가 「건설 일용근로자를 채용할 때」로 한정한다.
     * ⚠ "관리감독자는 일용근로자가 아니다"라는 논거를 쓰지 말 것 — 산안법 §16①은
     *   관리감독자를 **직위**로 정의하고 시행규칙 §27③도 "관리감독자의 **지위에
     *   있는 사람**"이라 쓴다. 별도 신분이 아니다.
     * ------------------------------------------------------------------------- */
    var ETC_TYPES = ['작업내용 변경 시 교육', '특별교육', '건설업 기초안전보건교육'];
    var SUP_ETC_TYPES = ['작업내용 변경 시 교육', '특별교육'];
    /* 그 화면에서 고를 수 있는 유형 — 화면이 배열을 직접 참조하지 않고 이 창구를 쓴다 */
    function etcTypes(supMode) { return (supMode ? SUP_ETC_TYPES : ETC_TYPES).slice(); }
    var ETC_TYPE_INFO = {
        /* perCourseCheck — 한 건의 교육시간만 보고 법정 최소 미달을 판정해도 되는가.
           별표4에 분할·예외 단서가 붙은 유형은 false 다(아래 특별교육 참고).
           sup — 관리감독자 화면에서 덮어쓸 값(별표4 제1호의2). 없으면 그 유형은
           관리감독자에게 적용되지 않는다는 뜻이고, SUP_ETC_TYPES 가 그것을 막는다. */
        '작업내용 변경 시 교육': {
            basis: 'oshr-t4', perCourseCheck: true,
            hours: [{ who: '일용·1주 이하 기간제', h: 1 }, { who: '그 밖의 근로자', h: 2 }],
            guide: '작업 내용을 바꿔 새로운 유해·위험에 노출될 때 실시합니다.',
            sup: {
                hours: [{ who: '관리감독자', h: 2 }],
                guide: '지휘·감독하는 작업의 내용이 바뀔 때 실시합니다.'
            }
        },
        '특별교육': {
            basis: 'oshr-t4',
            /* 한 건만 보고 미달을 판정하지 않는다 — 별표4에 분할·예외 단서가 붙어 있고
               이 시스템은 분할 이력·최초 작업일·단기간 여부를 받지 않는다(etcShortfall 참고).
               대상 작업은 등록 폼에서 복수 선택으로 **받는다**(js/edu-etc.js) — 판정에
               쓰지 않을 뿐이다. */
            perCourseCheck: false,
            /* 화면 문구는 담당자가 알 것만 — 시스템이 무엇을 받지 않는지는 위 주석에만 둔다(운영 T28) */
            checkNote: '특별교육은 나눠 실시할 수 있어 한 건만으로 미달을 표시하지 않습니다.',
            hours: [
                { who: '일용·1주 이하 기간제', h: 2, note: '별표5 제1호라목 제39호는 8시간' },
                { who: '그 밖의 근로자', h: 16, note: '최초 작업 전 4시간 + 12시간은 3개월 내 분할 / 단기간·간헐 작업은 2시간' }
            ],
            guide: '시행규칙 별표5 제1호라목의 대상 작업에 종사할 때 실시합니다.',
            worksSource: '산업안전보건법 시행규칙 별표5 제1호라목',
            worksBasis: 'oshr-t5',
            /* 목록은 조문 파생 — 이 배열을 손으로 채우지 말 것 */
            get works() {
                return (global.DYLAW && global.DYLAW.specialEduWorks)
                    ? global.DYLAW.specialEduWorks() : [];
            },
            sup: {
                hours: [{ who: '관리감독자', h: 16, note: '최초 작업 전 4시간 + 12시간은 3개월 내 분할 / 단기간·간헐 작업은 2시간' }]
            }
        },
        '건설업 기초안전보건교육': {
            basis: 'oshr-t4', basisAlso: 'osh-31', perCourseCheck: true,
            hours: [{ who: '건설 일용근로자', h: 4 }],
            guide: '건설 일용근로자가 최초로 취업할 때 실시합니다.'
            /* sup 없음 — 별표4 제1호의2 에 이 과정이 없다 */
        }
    };
    /* 유형 정보. supMode 면 제1호의2 값으로 덮어쓴 뷰를 준다.
       그 모집단에 없는 유형이면 **null** — 없는 의무의 시간을 돌려주지 않는다.
       Object.create 로 덮는 이유는 특별교육의 `works` 가 조문 파생 getter라
       Object.assign 으로 복사하면 그 자리에서 평가돼 조문 개정을 못 따라가기 때문이다. */
    function etcTypeInfo(label, supMode) {
        var base = ETC_TYPE_INFO[label];
        if (!base) return null;
        if (!supMode) return base;
        if (SUP_ETC_TYPES.indexOf(label) < 0) return null;
        if (!base.sup) return base;
        var view = Object.create(base);
        Object.keys(base.sup).forEach(function (k) { view[k] = base.sup[k]; });
        return view;
    }

    /* ================= 이수현황 요약 (설계서 §8) ================= */
    /* 현업(현업/사무직/판매) 정기교육 이수 여부 — 미달자 도출 */
    function fieldWorkers() {
        return workers().filter(function (w) { return w.category !== 'SUPERVISOR'; });
    }
    function supervisorWorkers() {
        return workers().filter(function (w) { return w.category === 'SUPERVISOR'; });
    }
    function statusRow(worker, dateISO) {
        var c = cycleOf(worker, dateISO);
        var need = requiredHours(worker);
        var done = acknowledgedRegHours(worker.id, dateISO);
        var hs = hireStatus(worker.id);
        return {
            worker: worker, cycle: c, need: need, done: done,
            short: c.valid ? Math.max(0, need - done) : 0,
            complete: c.valid && done >= need,
            assessable: !!c.valid,
            hire: hs
        };
    }
    /* 부서별 완료율 — filterFn 을 주면 그 모집단(구분·고용형태·채용연도…)만으로 다시 집계한다.
     * 예: 관리감독자만 본 부서별 완료율. 화면에서 자체 집계하지 않고 이 창구를 쓴다. */
    /* opts.keepEmpty — 필터로 인원이 0명이 된 부서도 행으로 남긴다.
     * 기본값(끔)을 유지하는 이유는 소비처가 넷이고(대시보드·업무발행·결재문서·이수현황)
     * 없던 행이 생기면 그쪽 집계가 조용히 달라지기 때문이다. 이수현황 요약만 켠다 —
     * 거기서는 부서가 표에서 사라지면 "대상이 없어서"인지 "빠뜨렸는지" 구분되지 않는다. */
    function deptSummary(dateISO, filterFn, opts) {
        var byDept = {};
        if (opts && opts.keepEmpty) {
            workers().forEach(function (w) {
                byDept[w.deptId] = byDept[w.deptId] ||
                    { deptId: w.deptId, name: deptName(w.deptId), total: 0, assessable: 0, unassessable: 0, done: 0 };
            });
        }
        workers().filter(function (w) { return filterFn ? filterFn(w) : true; }).forEach(function (w) {
            var d = byDept[w.deptId] = byDept[w.deptId] || { deptId: w.deptId, name: deptName(w.deptId), total: 0, assessable: 0, unassessable: 0, done: 0 };
            d.total++;
            var s = statusRow(w, dateISO);
            if (!s.assessable) d.unassessable++;
            else { d.assessable++; if (s.complete) d.done++; }
        });
        return Object.keys(byDept).map(function (k) {
            var r = byDept[k];
            r.pct = r.assessable ? Math.round(r.done / r.assessable * 100) : null;
            return r;
        }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    }

    global.DYEDU = {
        /* 스토어 */
        reset: reset, load: load, save: save, today: today, nowTs: nowTs, TODAY: today(),
        /* 근로자 */
        workers: workers, workerOf: workerOf, addWorker: addWorker, bulkAddWorkers: bulkAddWorkers,
        updateWorker: updateWorker, removeWorker: removeWorker,
        fieldWorkers: fieldWorkers, supervisorWorkers: supervisorWorkers,
        /* 교육 */
        courses: courses, courseOf: courseOf, addCourse: addCourse, updateCourse: updateCourse,
        removeCourse: removeCourse,
        pushCourseHistory: pushCourseHistory, courseDateTime: courseDateTime,
        courseSessions: courseSessions, sessionHours: sessionHours, sumSessionHours: sumSessionHours,
        /* 신청·이수 */
        enrolls: enrolls, allEnrolls: allEnrolls, addEnroll: addEnroll, hasEnroll: hasEnroll, removeEnroll: removeEnroll,
        enrollDenyReason: enrollDenyReason, populationIssue: populationIssue,
        canSeePerson: canSeePerson, personLabel: personLabel, personLabels: personLabels,
        enrollHours: enrollHours, enrollHoursIssue: enrollHoursIssue, recordEnrollCompletion: recordEnrollCompletion,
        slotLabel: slotLabel, SLOT_LABEL: SLOT_LABEL,
        cancelCompletedEnroll: cancelCompletedEnroll,
        removeWorkerFromCourse: removeWorkerFromCourse,
        records: records, recordsFor: recordsFor, addRecord: addRecord,
        recordCourseCompletion: recordCourseCompletion, recordKindForCourse: recordKindForCourse,
        syncCourseRecordHours: syncCourseRecordHours,
        /* 독촉 */
        reminders: reminders, addReminder: addReminder, deptTodos: deptTodos,
        deptUpcoming: deptUpcoming, courseTargetDepts: courseTargetDepts, isUpcoming: isUpcoming,
        upcomingWhen: upcomingWhen, upcomingTitle: upcomingTitle, notifyUpcoming: notifyUpcoming,
        /* 실시 결과 공문 예시 — 교육 공문 저장소(EDUDOC)가 비어 있을 때 처음 채우는 값.
           교육 예시와 같은 곳에서 만들어야 이력·잠금·붙임이 서로 맞는다 */
        seedDocs: function () { var d = load(); return { docs: (d.docSeed || []).slice(), seq: d.docSeq || 2600 }; },
        lastSessionDate: lastSessionDate, enrollDue: enrollDue, enrollOpen: enrollOpen, enrollDays: enrollDays,
        groupHoursConflicts: groupHoursConflicts,
        /* 계산 */
        cycleOf: cycleOf, CYCLE_SWITCH: CYCLE_SWITCH, requiredHours: requiredHours, hireHours: hireHours, hireAnchor: hireAnchor,
        etcMinHours: etcMinHours, etcShortfall: etcShortfall, isShortTermWorker: isShortTermWorker,
        acknowledgedRegHours: acknowledgedRegHours, hireStatus: hireStatus,
        statusRow: statusRow, deptSummary: deptSummary,
        /* 메타 */
        KIND_LABEL: KIND_LABEL, CAT_LABEL: CAT_LABEL, EMP_LABEL: EMP_LABEL, SRC_LABEL: SRC_LABEL,
        ETC_TYPES: ETC_TYPES, SUP_ETC_TYPES: SUP_ETC_TYPES, etcTypes: etcTypes,
        ETC_TYPE_INFO: ETC_TYPE_INFO, etcTypeInfo: etcTypeInfo,
        kindLabel: kindLabel, catLabel: catLabel, empLabel: empLabel, srcLabel: srcLabel,
        deptName: deptName, deptCandidates: deptCandidates,
        /* 조작 권한 — DYROLE.canAct 파생 (부서 없는 건 = 주관부서 소관) */
        courseDeptOf: courseDeptOf, canActDept: canActDept, canActCourse: canActCourse,
        canRegister: canRegister, canPickDept: canPickDept, defaultDeptId: defaultDeptId, denyMsg: denyMsg
    };
})(window);
