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

    var SKEY = 'damyangEduV1r4'; /* 독촉 이력 시드 추가 */
    var TODAY = '2026-07-16';

    /* ================= 계산 함수 (설계서 §2) ================= */

    /* 사이클: 채용일 기준 6개월(관리감독자 12개월) 단위. */
    function fmtDate(d) {
        var y = d.getFullYear(), m = d.getMonth() + 1, dd = d.getDate();
        return y + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
    }
    function addMonths(d, months) {
        return new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
    }
    function cycleOf(worker, dateISO) {
        var hire = new Date(worker.hireDate);
        var today = new Date(dateISO || TODAY);
        var cycleMonths = worker.category === 'SUPERVISOR' ? 12 : 6;
        var months = (today.getFullYear() - hire.getFullYear()) * 12 + (today.getMonth() - hire.getMonth());
        if (today.getDate() < hire.getDate()) months--;
        if (months < 0) months = 0;
        var cycleIndex = Math.floor(months / cycleMonths);
        var start = addMonths(hire, cycleIndex * cycleMonths);
        var endExclusive = addMonths(hire, (cycleIndex + 1) * cycleMonths);
        var end = new Date(endExclusive.getTime() - 86400000);
        var dToEnd = Math.round((end - today) / 86400000);
        return { start: fmtDate(start), end: fmtDate(end), index: cycleIndex, months: cycleMonths, daysToEnd: dToEnd };
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
                    empType: 'CIVIL', hireDate: '2020-03-02', contractMonths: 0,
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
            files: o.files || [], status: o.status || 'OPEN',
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
    /* 부서 신청 취소 — 교육이 이미 종료(DONE)된 뒤라면 해당 부서 근로자의 이수기록도 회수 */
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
    function today() {
        var t = new Date(); var mm = t.getMonth() + 1, dd = t.getDate();
        return t.getFullYear() + '-' + (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd;
    }
    function nowTs() {
        var t = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
        return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()) +
            ' ' + pad(t.getHours()) + ':' + pad(t.getMinutes());
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
    var ETC_TYPES = ['특별교육', '작업내용 변경 시', 'MSDS', '직무교육', '자체·기타'];

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
            short: Math.max(0, need - done),
            complete: done >= need,
            hire: hs
        };
    }
    /* 부서별 완료율 — filterFn 을 주면 그 모집단(구분·고용형태·채용연도…)만으로 다시 집계한다.
     * 예: 관리감독자만 본 부서별 완료율. 화면에서 자체 집계하지 않고 이 창구를 쓴다. */
    function deptSummary(dateISO, filterFn) {
        var byDept = {};
        workers().filter(function (w) { return filterFn ? filterFn(w) : true; }).forEach(function (w) {
            var d = byDept[w.deptId] = byDept[w.deptId] || { deptId: w.deptId, name: deptName(w.deptId), total: 0, done: 0 };
            d.total++;
            var s = statusRow(w, dateISO);
            if (s.complete) d.done++;
        });
        return Object.keys(byDept).map(function (k) {
            var r = byDept[k];
            r.pct = r.total ? Math.round(r.done / r.total * 100) : 0;
            return r;
        }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    }

    global.DYEDU = {
        /* 스토어 */
        reset: reset, load: load, save: save, today: today, nowTs: nowTs, TODAY: TODAY,
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
        records: records, recordsFor: recordsFor, addRecord: addRecord,
        recordCourseCompletion: recordCourseCompletion, recordKindForCourse: recordKindForCourse,
        syncCourseRecordHours: syncCourseRecordHours,
        /* 독촉 */
        reminders: reminders, addReminder: addReminder,
        /* 계산 */
        cycleOf: cycleOf, requiredHours: requiredHours, hireHours: hireHours,
        acknowledgedRegHours: acknowledgedRegHours, hireStatus: hireStatus,
        statusRow: statusRow, deptSummary: deptSummary,
        /* 메타 */
        KIND_LABEL: KIND_LABEL, CAT_LABEL: CAT_LABEL, EMP_LABEL: EMP_LABEL, SRC_LABEL: SRC_LABEL,
        ETC_TYPES: ETC_TYPES,
        kindLabel: kindLabel, catLabel: catLabel, empLabel: empLabel, srcLabel: srcLabel,
        deptName: deptName, deptCandidates: deptCandidates
    };
})(window);
