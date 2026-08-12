/* =====================================================================
   edu-data.js · 안전보건교육 도메인 데이터·세션 스토어 (DYEDU)
   ---------------------------------------------------------------------
   docs/planning/기획-안전보건교육-재설계-v1.md §9 스키마 반영.
   순수 계산 함수(cycleOf/requiredHours/hireHours)를 분리해 법 해석 변경 시
   함수만 교체 가능하도록 구성. 기준일 2026-07-16(CLAUDE.md currentDate).
   근로자 조직은 DYV2.ORG 파생 + 계약직/일용 목업 시드.

   전역: DYEDU.*  (js/common.js 뒤에 로드)
   ===================================================================== */
(function (global) {
    'use strict';

    /* r5 — 2026-07-30 회의: 기타교육 분류를 법정 3유형으로 재정의(구 5종 폐지) ·
     * 첨부 슬롯(file.slot) 도입. 구 etcType 이 남으면 필터·표시가 어긋나므로 버전 범프. */
    var SKEY = 'damyangEduV1r7';   /* r7 — 관리감독자 지정일 기준 연간 사이클 · 미등록 판정 분리 */
    /* 오늘 기준 — DYV2.today() 단일 출처. TODAY 는 하위호환 게터(DYEDU.TODAY)로 유지. */
    function today() { return (global.DYV2 && global.DYV2.today) ? global.DYV2.today() : realToday(); }
    function realToday() {
        var t = new Date(); var mm = t.getMonth() + 1, dd = t.getDate();
        return t.getFullYear() + '-' + (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd;
    }
    /* 지역변수 today 가 섀도잉하는 함수 안에서 쓰는 별칭 */
    function todayIso() { return today(); }

    /* ================= 계산 함수 (설계서 §2) ================= */

    /* 사이클: 현업은 채용일 기준 6개월, 관리감독자는 지정일 기준 12개월. */
    function fmtDate(d) {
        var y = d.getFullYear(), m = d.getMonth() + 1, dd = d.getDate();
        return y + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
    }
    function addMonths(d, months) {
        return new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
    }
    function cycleOf(worker, dateISO) {
        var anchorISO = worker.category === 'SUPERVISOR' ? worker.designatedAt : worker.hireDate;
        if (!anchorISO) return { valid: false, reason: worker.category === 'SUPERVISOR' ? '지정일 미등록' : '채용일 미등록', start: '', end: '', index: 0, months: 0, daysToEnd: null };
        var hire = new Date(anchorISO);
        if (isNaN(hire.getTime())) return { valid: false, reason: '기준일 오류', start: '', end: '', index: 0, months: 0, daysToEnd: null };
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
        return { valid: true, reason: '', start: fmtDate(start), end: fmtDate(end), index: cycleIndex, months: cycleMonths, daysToEnd: dToEnd };
    }
    /* 정기교육 필요시간/사이클 */
    function requiredHours(worker /*, dateISO */) {
        if (!worker) return 0;
        if (worker.category === 'SUPERVISOR') return 16;
        if (worker.category === 'OFFICE' || worker.category === 'SALES') return 6;
        return 12; /* FIELD (비사무직/현업) */
    }
    /* 채용시교육 필요시간 (고용형태·계약기간별) */
    function hireHours(worker) {
        if (!worker) return 0;
        if (worker.empType === 'DAILY') return 1;
        if (worker.empType === 'CONTRACT') {
            var m = worker.contractMonths || 0;
            if (m <= 0.25) return 1; /* 1주 이하 */
            if (m <= 1) return 4;    /* 1주 초과 ~ 1개월 */
        }
        return 8;
    }
    /* 인정시간: records를 kind로 필터 후 hours 단순 합산.
       정기교육 인정은 현재 사이클(cycleOf) 내에서 완료된 REG만. */
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
    function hireStatus(workerId) {
        var w = workerOf(workerId); if (!w) return null;
        var need = hireHours(w);
        var rec = records().filter(function (r) { return r.workerId === workerId && r.kind === 'HIRE'; });
        var doneHours = rec.reduce(function (n, r) { return n + (r.hours || 0); }, 0);
        var lastDate = rec.length ? rec.sort(function (a, b) { return b.date.localeCompare(a.date); })[0].date : '';
        var status;
        if (doneHours >= need) {
            /* 채용일 이전~당일이면 OK, 이후면 지연 */
            status = lastDate <= w.hireDate ? 'BEFORE' : 'LATE_DONE';
        } else {
            status = 'NONE';
        }
        return { need: need, done: doneHours, lastDate: lastDate, status: status };
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
                /* '재난안전과장·팀장·사업소장' 등을 SUPERVISOR로 지정 */
                var isSup = /(과장|팀장|소장|실장|국장)/.test(m.role || '');
                out.push({
                    id: 'w_' + m.uid, name: m.name, deptId: deptId, deptName: deptName,
                    category: isSup ? 'SUPERVISOR' : 'OFFICE',
                    empType: 'CIVIL', hireDate: '2020-03-02', designatedAt: '', contractMonths: 0,
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

    /* 부서별 계약직·일용 목업 (몇 개 부서에 집중) */
    function seedContractWorkers() {
        var seed = [];
        var mk = function (id, name, deptId, cat, emp, hire, contract, source) {
            seed.push({ id: id, name: name, deptId: deptId, category: cat, empType: emp,
                hireDate: hire, contractMonths: contract || 0, active: true, source: source || 'MANUAL', role: '' });
        };
        /* 환경과 — 자원순환·환경지도 현업 */
        mk('w_env_c1', '박수완', 'env', 'FIELD', 'CONTRACT', '2025-03-02', 12, 'HR');
        mk('w_env_c2', '이수영', 'env', 'FIELD', 'CONTRACT', '2025-09-01', 12, 'HR');
        mk('w_env_c3', '조민서', 'env', 'FIELD', 'CONTRACT', '2026-02-01', 12, 'MANUAL'); /* 정기 미달 시나리오 */
        mk('w_env_c4', '한도영', 'env', 'FIELD', 'DAILY',    '2026-07-10', 0.1, 'MANUAL'); /* 채용시 지연 시나리오 */
        mk('w_env_c5', '차이수', 'env', 'FIELD', 'CONTRACT', '2026-06-15', 3, 'EXCEL');
        /* 물순환사업소 — 정수·수질 현업 */
        mk('w_wat_c1', '한지훈', 'water', 'FIELD', 'CONTRACT', '2025-03-01', 12, 'HR');
        mk('w_wat_c2', '오태섭', 'water', 'FIELD', 'CONTRACT', '2025-11-01', 12, 'HR');
        mk('w_wat_c3', '박정민', 'water', 'FIELD', 'CONTRACT', '2026-01-15', 12, 'MANUAL'); /* 정기 미달 */
        mk('w_wat_c4', '김수빈', 'water', 'FIELD', 'CONTRACT', '2026-05-10', 6, 'EXCEL');
        mk('w_wat_c5', '이서준', 'water', 'FIELD', 'DAILY',    '2026-07-05', 0.1, 'MANUAL'); /* 채용시 지연 시나리오 */
        /* 공공시설사업소 — 시설운영·환경시설 */
        mk('w_fac_c1', '정민수', 'facility', 'FIELD', 'CONTRACT', '2024-08-01', 24, 'HR');
        mk('w_fac_c2', '박현우', 'facility', 'FIELD', 'CONTRACT', '2025-08-01', 12, 'HR');
        mk('w_fac_c3', '이도현', 'facility', 'FIELD', 'CONTRACT', '2026-02-20', 12, 'MANUAL'); /* 정기 미달 */
        mk('w_fac_c4', '오세훈', 'facility', 'FIELD', 'DAILY',    '2026-06-25', 0.2, 'EXCEL');
        /* 건설과 — 도로·안전관리 현업 */
        mk('w_con_c1', '최준영', 'construct', 'FIELD', 'CONTRACT', '2025-03-15', 12, 'HR');
        mk('w_con_c2', '강태우', 'construct', 'FIELD', 'CONTRACT', '2025-10-01', 12, 'HR');
        mk('w_con_c3', '한지원', 'construct', 'FIELD', 'CONTRACT', '2026-03-01', 12, 'MANUAL'); /* 정기 미달 */
        mk('w_con_c4', '박서연', 'construct', 'FIELD', 'CONTRACT', '2026-04-10', 6, 'EXCEL');
        /* 재난안전과 — 조회만(정보) */
        mk('w_safety_c1', '조안나', 'safety', 'OFFICE', 'CONTRACT', '2025-04-01', 12, 'HR');
        /* 문화체육과 — 체육·문화시설 */
        mk('w_cul_c1', '이하영', 'culture', 'FIELD', 'CONTRACT', '2025-05-01', 12, 'HR');
        mk('w_cul_c2', '박진호', 'culture', 'FIELD', 'CONTRACT', '2026-01-05', 12, 'MANUAL'); /* 정기 미달 */
        /* 보건소 */
        mk('w_hlth_c1', '윤소민', 'health', 'FIELD', 'CONTRACT', '2025-04-15', 12, 'HR');
        mk('w_hlth_c2', '김하늘', 'health', 'FIELD', 'DAILY',    '2026-07-01', 0.1, 'MANUAL'); /* 채용시 지연 */
        /* 담양읍 */
        mk('w_twn_c1', '최민석', 'town_damyang', 'FIELD', 'CONTRACT', '2025-06-01', 12, 'HR');
        return seed;
    }

    function seed() {
        var workers = orgWorkers().concat(seedContractWorkers());
        /* v1.1 §8.5: 월별 집합교육 시드 — 2026 1~7월 완료 1건씩 · 8월 예정 1건.
           각 월 3h · 부서별 신청·서명·records까지 정합. 채용시교육 시드는 없음(근로자 등록 시 자동 미이수). */
        var months = [
            { m: '01', date: '2026-01-16', desc: '2026년 1월 정기 안전보건교육 (전체 부서 대상)', inst: '한국산업안전보건공단 김강사' },
            { m: '02', date: '2026-02-13', desc: '2026년 2월 정기 안전보건교육 (전체 부서 대상)', inst: '한국산업안전보건공단 이강사' },
            { m: '03', date: '2026-03-13', desc: '2026년 3월 정기 안전보건교육 (전체 부서 대상)', inst: '외부 강사 (안전보건연구원)' },
            { m: '04', date: '2026-04-17', desc: '2026년 4월 정기 안전보건교육 (전체 부서 대상)', inst: '한국산업안전보건공단 김강사' },
            { m: '05', date: '2026-05-15', desc: '2026년 5월 정기 안전보건교육 (전체 부서 대상)', inst: '한국산업안전보건공단 이강사' },
            { m: '06', date: '2026-06-12', desc: '2026년 6월 정기 안전보건교육 (전체 부서 대상)', inst: '외부 강사 (안전보건연구원)' },
            { m: '07', date: '2026-07-10', desc: '2026년 7월 정기 안전보건교육 (전체 부서 대상)', inst: '한국산업안전보건공단 김강사' }
        ];
        /* 이수 완료율 60~70% 목표: 대다수 FIELD 근로자를 대상으로 반복 신청 */
        var completedWorkers = {
            /* 6~7월 집합교육에 참여하여 12h 이상 확보 (현 사이클 완료) */
            env: ['w_u_env1', 'w_u_env2', 'w_u_env3', 'w_env_c1', 'w_env_c2', 'w_env_c5'],
            water: ['w_u_wat1', 'w_u_wat2', 'w_wat_c1', 'w_wat_c2', 'w_wat_c4'],
            facility: ['w_fac_c1', 'w_fac_c2', 'w_fac_c4'],
            construct: ['w_u_con1', 'w_u_con2', 'w_con_c1', 'w_con_c2', 'w_con_c4'],
            culture: ['w_cul_c1'],
            health: ['w_u_hlth1', 'w_hlth_c1'],
            town_damyang: ['w_twn_c1'],
            safety: ['w_u_safe1', 'w_u_safe2'],
            plan: [],
            acct: []
        };
        var courses = [];
        var enrolls = [];
        var records = [];
        months.forEach(function (mm, idx) {
            var cid = 'C-M' + mm.m;
            /* 첫 3개월 이후부터(4·5·6·7월) 각 부서별 4명씩 신청. 각 3h. */
            var reportedMonths = idx >= 3; /* 4월 이후에 records 발생 (사이클 안에 포함되도록) */
            courses.push({
                id: cid, kind: 'REG_GROUP', date: mm.date, time: '14:00', hours: 3,
                instructor: mm.inst, place: '군청 대회의실',
                desc: mm.desc, files: [{ name: '2026_' + mm.m + '월_교육계획서.hwpx' }],
                status: 'DONE', createdBy: '재난안전과',
                history: [
                    { type: 'CREATE', at: mm.date, by: '재난안전과', memo: '월별 집합교육 등록' },
                    { type: 'STATUS', at: mm.date, by: '재난안전과', memo: '교육 종료 처리 · 신청자 카운트' }
                ]
            });
            Object.keys(completedWorkers).forEach(function (dept) {
                var ids = completedWorkers[dept];
                if (!ids.length) return;
                enrolls.push({ courseId: cid, deptId: dept, workerIds: ids,
                    signFile: dept + '_' + mm.m + '월_서명.pdf', at: mm.date });
                if (reportedMonths) {
                    ids.forEach(function (wid) {
                        records.push({ workerId: wid, courseId: cid, kind: 'REG', hours: 3, date: mm.date });
                    });
                }
            });
        });
        /* 8월 예정(OPEN) — 아직 신청 접수 중 */
        courses.push({
            id: 'C-M08', kind: 'REG_GROUP', date: '2026-08-14', time: '14:00', hours: 3,
            instructor: '한국산업안전보건공단 이강사', place: '군청 대회의실',
            desc: '2026년 8월 정기 안전보건교육 (전체 부서 대상) — 신청 접수 중',
            files: [{ name: '2026_08월_교육계획서.hwpx' }],
            status: 'OPEN', createdBy: '재난안전과',
            history: [{ type: 'CREATE', at: '2026-07-14', by: '재난안전과', memo: '집합교육 등록 · 신청 접수 개시' }]
        });
        /* 부서별 자체 보강교육 (7월) — 후기 채용자·미이수자 대상 · 12h 채워 60~70% 이수율 목표 달성 */
        var boostSeed = {
            env: ['w_env_c5'], water: ['w_wat_c4'], facility: ['w_fac_c4'], culture: ['w_cul_c1']
        };
        Object.keys(boostSeed).forEach(function (dept) {
            var ids = boostSeed[dept];
            if (!ids.length) return;
            var cid = 'C-SELF-' + dept.toUpperCase().slice(0, 5);
            courses.push({
                id: cid, kind: 'REG_SELF', deptId: dept, date: '2026-07-14', time: '10:00', hours: 12,
                instructor: deptName(dept) + ' 부서장',
                place: deptName(dept) + ' 회의실', desc: '2026 하반기 자체 보강 안전교육 (후기 채용자 대상)',
                files: [], status: 'DONE', createdBy: deptName(dept) + ' 담당자',
                history: [{ type: 'STATUS', at: '2026-07-14', by: '부서 담당자', memo: '자체 보강교육 즉시완료' }]
            });
            enrolls.push({ courseId: cid, deptId: dept, workerIds: ids, at: '2026-07-14' });
            ids.forEach(function (wid) {
                records.push({ workerId: wid, courseId: cid, kind: 'REG', hours: 12, date: '2026-07-14' });
            });
        });
        /* 관리감독자 정기교육 — 12개월 사이클 16h. 상반기·하반기 반씩 진행. */
        courses.push({
            id: 'C-SR1', kind: 'SUP_REG', date: '2026-03-20', time: '13:30', hours: 8,
            instructor: '노동안전연구원', place: '외부 위탁', desc: '2026 관리감독자 정기교육 1차 (상반기 8h)',
            files: [], status: 'DONE', createdBy: '재난안전과',
            history: [{ type: 'CREATE', at: '2026-03-01', by: '재난안전과', memo: '관리감독자 정기교육 등록' },
                      { type: 'STATUS', at: '2026-03-20', by: '재난안전과', memo: '종료 처리' }]
        });
        courses.push({
            id: 'C-SR2', kind: 'SUP_REG', date: '2026-09-18', time: '13:30', hours: 8,
            instructor: '노동안전연구원', place: '외부 위탁', desc: '2026 관리감독자 정기교육 2차 (하반기 8h) — 예정',
            files: [], status: 'OPEN', createdBy: '재난안전과',
            history: [{ type: 'CREATE', at: '2026-07-10', by: '재난안전과', memo: '관리감독자 정기교육 등록 · 신청 접수 개시' }]
        });
        /* 관리감독자 정기 1차 참석자 */
        var supAttended = ['w_u_safe1', 'w_u_env1', 'w_u_wat1', 'w_u_fac1', 'w_u_con1', 'w_u_hlth1'];
        enrolls.push({ courseId: 'C-SR1', deptId: 'safety',    workerIds: ['w_u_safe1'], signFile: '재난안전_감독자_서명.pdf', at: '2026-03-15' });
        enrolls.push({ courseId: 'C-SR1', deptId: 'env',       workerIds: ['w_u_env1'],  signFile: '환경과_감독자_서명.pdf',   at: '2026-03-15' });
        enrolls.push({ courseId: 'C-SR1', deptId: 'water',     workerIds: ['w_u_wat1'],  signFile: '물순환_감독자_서명.pdf',  at: '2026-03-15' });
        enrolls.push({ courseId: 'C-SR1', deptId: 'facility',  workerIds: ['w_u_fac1'],  signFile: '공공시설_감독자_서명.pdf', at: '2026-03-15' });
        enrolls.push({ courseId: 'C-SR1', deptId: 'construct', workerIds: ['w_u_con1'],  signFile: '건설과_감독자_서명.pdf',  at: '2026-03-15' });
        enrolls.push({ courseId: 'C-SR1', deptId: 'health',    workerIds: ['w_u_hlth1'], signFile: '보건소_감독자_서명.pdf',  at: '2026-03-15' });
        supAttended.forEach(function (wid) {
            records.push({ workerId: wid, courseId: 'C-SR1', kind: 'REG', hours: 8, date: '2026-03-20' });
        });
        /* 채용시교육 기존 이수 시드 (w_fac_c1: 채용일 이전 이수 — 정상) */
        courses.push({
            id: 'C-H1', kind: 'HIRE', deptId: 'facility', date: '2024-07-25', time: '09:00', hours: 8,
            instructor: '외부위탁', place: '공공시설사업소', desc: '채용시 안전보건교육 · 임시설·정민수 등',
            files: [], status: 'DONE', createdBy: '공공시설사업소',
            history: [{ type: 'CREATE', at: '2024-07-25', by: '공공시설사업소', memo: '채용시 교육 이수' }]
        });
        enrolls.push({ courseId: 'C-H1', deptId: 'facility', workerIds: ['w_fac_c1'], at: '2024-07-25' });
        records.push({ workerId: 'w_fac_c1', courseId: 'C-H1', kind: 'HIRE', hours: 8, date: '2024-07-25' });
        /* w_fac_c2 (2025-08-01 채용 · 8h 필요) 채용일 당일 이수 */
        courses.push({
            id: 'C-H2', kind: 'HIRE', deptId: 'facility', date: '2025-07-30', time: '09:00', hours: 8,
            instructor: '외부위탁', place: '공공시설사업소', desc: '채용시 안전보건교육 · 박현우',
            files: [], status: 'DONE', createdBy: '공공시설사업소',
            history: [{ type: 'CREATE', at: '2025-07-30', by: '공공시설사업소', memo: '채용시 교육 이수' }]
        });
        enrolls.push({ courseId: 'C-H2', deptId: 'facility', workerIds: ['w_fac_c2'], at: '2025-07-30' });
        records.push({ workerId: 'w_fac_c2', courseId: 'C-H2', kind: 'HIRE', hours: 8, date: '2025-07-30' });
        /* ── 기타교육 (법정 3유형) ────────────────────────────────────────────
         * 세 유형이 화면에 모두 나와야 분류 필터·법정 최소 안내·미달 표시를 확인할 수 있다.
         * C-E2 는 **판정 가능한 유형에서 의도적으로 미달**인 건이다 — 같은 한 건인데
         * 정규 현업(2h 필요)에게는 미달이고 일용(1h 필요)에게는 충족이라, 최소시간이
         * 사람마다 다르다는 사실이 화면에 드러난다. 특별교육(C-E3)은 분할·단기간 단서가
         * 있어 한 건만으로 판정하지 않는다(etcShortfall 참고). */
        courses.push({
            id: 'C-E1', kind: 'ETC', etcType: '작업내용 변경 시 교육', deptId: 'water',
            date: '2026-04-08', time: '10:00', hours: 2,
            instructor: '오순환(자체)', place: '물순환사업소 교육장',
            desc: '정수장 → 하수처리장 배치 전환에 따른 작업내용 변경 교육',
            files: [{ name: '작업변경교육_일지_20260408.pdf', slot: '교육일지 및 교육사진 등' }],
            status: 'DONE', createdBy: '물순환사업소',
            history: [{ type: 'CREATE', at: '2026-04-08', by: '물순환사업소', memo: '기타교육 등록 · 작업내용 변경 시 교육' }]
        });
        enrolls.push({ courseId: 'C-E1', deptId: 'water', workerIds: ['w_wat_c1', 'w_wat_c2'], at: '2026-04-08' });
        ['w_wat_c1', 'w_wat_c2'].forEach(function (wid) {
            records.push({ workerId: wid, courseId: 'C-E1', kind: 'ETC', hours: 2, date: '2026-04-08' });
        });

        courses.push({
            id: 'C-E2', kind: 'ETC', etcType: '작업내용 변경 시 교육', deptId: 'facility',
            date: '2026-06-11', time: '15:00', hours: 1.5,
            instructor: '임시설(자체)', place: '공공시설사업소',
            desc: '환경시설 점검 업무 전환 교육 — 계약직·일용 혼재',
            files: [{ name: '작업변경교육_일지_20260611.pdf', slot: '교육일지 및 교육사진 등' }],
            status: 'DONE', createdBy: '공공시설사업소',
            history: [{ type: 'CREATE', at: '2026-06-11', by: '공공시설사업소', memo: '기타교육 등록 · 작업내용 변경 시 교육' }]
        });
        enrolls.push({ courseId: 'C-E2', deptId: 'facility', workerIds: ['w_fac_c1', 'w_fac_c4'], at: '2026-06-11' });
        ['w_fac_c1', 'w_fac_c4'].forEach(function (wid) {
            records.push({ workerId: wid, courseId: 'C-E2', kind: 'ETC', hours: 1.5, date: '2026-06-11' });
        });

        courses.push({
            id: 'C-E3', kind: 'ETC', etcType: '특별교육', deptId: 'water',
            date: '2026-05-21', time: '09:00', hours: 4,
            instructor: '한국안전기술원', place: '정수장 현장',
            desc: '밀폐공간(정수장 침전지·맨홀) 작업 특별교육 — 최초 4시간분',
            files: [{ name: '특별교육_일지_20260521.pdf', slot: '교육일지 및 교육사진 등' }],
            status: 'DONE', createdBy: '물순환사업소',
            history: [{ type: 'CREATE', at: '2026-05-21', by: '물순환사업소', memo: '기타교육 등록 · 특별교육' }]
        });
        enrolls.push({ courseId: 'C-E3', deptId: 'water', workerIds: ['w_wat_c1', 'w_wat_c3', 'w_wat_c5'], at: '2026-05-21' });
        ['w_wat_c1', 'w_wat_c3', 'w_wat_c5'].forEach(function (wid) {
            records.push({ workerId: wid, courseId: 'C-E3', kind: 'ETC', hours: 4, date: '2026-05-21' });
        });

        /* 관리감독자 기타교육 — 같은 모듈을 supMode 플래그로 재사용하는 화면이라
           대상이 없으면 그 화면이 통째로 빈다(edu-sup-etc.html). */
        courses.push({
            id: 'C-SE1', kind: 'SUP_ETC', etcType: '작업내용 변경 시 교육', deptId: 'construct',
            date: '2026-04-23', time: '14:00', hours: 2,
            instructor: '외부위탁', place: '건설과 회의실',
            desc: '도로보수 → 교량점검 감독 업무 전환에 따른 교육',
            files: [{ name: '감독자_작업변경교육_20260423.pdf', slot: '교육일지 및 교육사진 등' }],
            status: 'DONE', createdBy: '건설과',
            history: [{ type: 'CREATE', at: '2026-04-23', by: '건설과', memo: '관리감독자 기타교육 등록' }]
        });
        enrolls.push({ courseId: 'C-SE1', deptId: 'construct', workerIds: ['w_u_con1', 'w_u_con6'], at: '2026-04-23' });
        ['w_u_con1', 'w_u_con6'].forEach(function (wid) {
            records.push({ workerId: wid, courseId: 'C-SE1', kind: 'ETC', hours: 2, date: '2026-04-23' });
        });

        var reminders = [
            { at: '2026-07-15 09:20', by: '재난안전과', deptId: 'env',
              workerIds: ['w_env_c3'], memo: '7월 말 사이클 종료 예정 · 정기교육 보강 요청' },
            { at: '2026-07-14 14:10', by: '재난안전과', deptId: 'facility',
              workerIds: ['w_fac_c3'], memo: '8월 집합교육 신청 및 서명 증빙 제출 요청' },
            { at: '2026-07-11 10:35', by: '재난안전과', deptId: 'construct',
              workerIds: ['w_con_c3'], memo: '미이수 12시간 확인 · 부서 자체교육 계획 회신 요청' }
        ];
        return {
            seqW: 100, seqC: 30, seqR: 30,
            workers: workers, courses: courses, enrolls: enrolls, records: records,
            reminders: reminders
        };
    }

    function load() {
        if (db) return db;
        try { var raw = global.sessionStorage.getItem(SKEY); db = raw ? JSON.parse(raw) : seed(); }
        catch (e) { db = seed(); }
        return db;
    }
    function save() { try { global.sessionStorage.setItem(SKEY, JSON.stringify(db)); } catch (e) {} }
    function reset() { db = seed(); save(); return db; }

    /* ================= CRUD ================= */
    function workers() { return load().workers.filter(function (w) { return w.active; }); }
    function workerOf(id) { var arr = load().workers; for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }
    function addWorker(o) {
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
    function bulkAddWorkers(list) {
        return (list || []).map(addWorker);
    }
    function updateWorker(id, patch) {
        var w = workerOf(id); if (!w) return null;
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
        d.courses.push(c);
        c.history.push({ type: 'CREATE', at: nowTs(), by: o.createdBy || '', memo: kindLabel(c.kind) + ' 등록' });
        save(); return c;
    }
    /* ===== 교육 회차(sessions) — 일자 + 시작~종료 시각 =====
     * 시드·구 데이터에는 sessions 가 없으므로 대표값(date·time·endTime)에서 1회차를 파생한다.
     * 교육 시간은 여기서만 계산한다(화면에서 직접 빼기 금지) — 단일 출처. */
    function courseSessions(c) {
        if (!c) return [];
        if (c.sessions && c.sessions.length) return c.sessions;
        if (!c.date) return [];
        return [{ date: c.date, start: c.time || '', end: c.endTime || '' }];
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
    function etcMinHours(etcType, worker) {
        var info = ETC_TYPE_INFO[etcType];
        if (!info || !info.hours || !info.hours.length) return 0;
        if (info.hours.length === 1) return info.hours[0].h;   /* 건설업 기초 — 갈래가 하나다 */
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
        var info = ETC_TYPE_INFO[course.etcType];
        if (!info || info.perCourseCheck === false) return [];
        var got = course.hours || 0, out = [];
        /* recordsFor(workerId) 는 사람 축이다 — 여기선 그 교육 건의 이수기록이 필요하다 */
        records().forEach(function (r) {
            if (r.courseId !== course.id) return;
            var w = workerOf(r.workerId); if (!w) return;
            var need = etcMinHours(course.etcType, w);
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

    function enrolls(courseId) { return load().enrolls.filter(function (e) { return !courseId || e.courseId === courseId; }); }
    function addEnroll(o) {
        var d = load();
        d.enrolls.push({
            courseId: o.courseId, deptId: o.deptId,
            workerIds: (o.workerIds || []).slice(),
            signFile: o.signFile || '', at: o.at || today()
        });
        save();
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
    /* 교육 정보 수정으로 시간·일자가 바뀌면 이미 쌓인 이수기록도 맞춘다.
     * (안 맞추면 교육 카드의 'Nh'와 이수현황의 '인정 Nh'가 조용히 어긋난다)
     * 반환 = 갱신된 기록 건수 */
    function syncCourseRecordHours(courseId, hours, dateISO) {
        var d = load(), n = 0;
        d.records.forEach(function (r) {
            if (r.courseId !== courseId) return;
            if (r.hours === hours && (!dateISO || r.date === dateISO)) return;
            r.hours = hours;
            if (dateISO) r.date = dateISO;
            n++;
        });
        if (n) save();
        return n;
    }
    function recordKindForCourse(courseId) {
        var c = courseOf(courseId); if (!c) return 'ETC';
        if (c.kind === 'HIRE') return 'HIRE';
        if (c.kind === 'ETC' || c.kind === 'SUP_ETC') return 'ETC';
        return 'REG'; /* REG_GROUP, REG_SELF, SUP_REG */
    }

    function reminders() { return load().reminders; }
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
    /* 날짜는 시연 기준일(DYV2.today) · 시각만 실제 시계 — rsk-data.js 와 같은 이유(§11) */
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
     *   복사본을 두면 조문 개정 때 화면만 옛 목록으로 남는다(CLAUDE.md §10). */
    var ETC_TYPES = ['작업내용 변경 시 교육', '특별교육', '건설업 기초안전보건교육'];
    var ETC_TYPE_INFO = {
        /* perCourseCheck — 한 건의 교육시간만 보고 법정 최소 미달을 판정해도 되는가.
           별표4에 분할·예외 단서가 붙은 유형은 false 다(아래 특별교육 참고). */
        '작업내용 변경 시 교육': {
            basis: 'oshr-t4', perCourseCheck: true,
            hours: [{ who: '일용·1주 이하 기간제', h: 1 }, { who: '그 밖의 근로자', h: 2 }],
            guide: '작업 내용을 바꿔 새로운 유해·위험에 노출될 때 실시합니다.'
        },
        '특별교육': {
            basis: 'oshr-t4',
            /* 한 건만 보고 미달을 판정하지 않는다 — 별표4에 분할·예외 단서가 붙어 있고
               이 시스템은 대상 작업·분할 이력·단기간 여부를 받지 않는다(etcShortfall 참고) */
            perCourseCheck: false,
            checkNote: '16시간은 최초 작업 전 4시간을 하고 나머지 12시간을 3개월 이내에 나눠 할 수 있으며, 단기간·간헐적 작업은 2시간입니다. 이 화면은 대상 작업과 분할 이력을 받지 않으므로 한 건만 보고 미달 여부를 판정하지 않습니다.',
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
            }
        },
        '건설업 기초안전보건교육': {
            basis: 'oshr-t4', perCourseCheck: true,
            hours: [{ who: '건설 일용근로자', h: 4 }],
            guide: '건설 일용근로자가 최초로 취업할 때 실시합니다.'
        }
    };
    function etcTypeInfo(label) { return ETC_TYPE_INFO[label] || null; }

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
        enrolls: enrolls, addEnroll: addEnroll, removeEnroll: removeEnroll,
        removeWorkerFromCourse: removeWorkerFromCourse,
        records: records, recordsFor: recordsFor, addRecord: addRecord,
        recordCourseCompletion: recordCourseCompletion, recordKindForCourse: recordKindForCourse,
        syncCourseRecordHours: syncCourseRecordHours,
        /* 독촉 */
        reminders: reminders, addReminder: addReminder,
        /* 계산 */
        cycleOf: cycleOf, requiredHours: requiredHours, hireHours: hireHours,
        etcMinHours: etcMinHours, etcShortfall: etcShortfall, isShortTermWorker: isShortTermWorker,
        acknowledgedRegHours: acknowledgedRegHours, hireStatus: hireStatus,
        statusRow: statusRow, deptSummary: deptSummary,
        /* 메타 */
        KIND_LABEL: KIND_LABEL, CAT_LABEL: CAT_LABEL, EMP_LABEL: EMP_LABEL, SRC_LABEL: SRC_LABEL,
        ETC_TYPES: ETC_TYPES, ETC_TYPE_INFO: ETC_TYPE_INFO, etcTypeInfo: etcTypeInfo,
        kindLabel: kindLabel, catLabel: catLabel, empLabel: empLabel, srcLabel: srcLabel,
        deptName: deptName, deptCandidates: deptCandidates
    };
})(window);
