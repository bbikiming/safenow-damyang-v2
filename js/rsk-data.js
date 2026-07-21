/* =====================================================================
   rsk-data.js · 위험성평가 도메인 데이터·세션 스토어 (DYRSK)
   ---------------------------------------------------------------------
   재설계 v1 (2026-07-14, docs/planning/기획-위험성평가-재설계-v1.md) 반영.
   · 정기평가(regular): 연도 단위, 부서별 점검일자·설문지·조치기한·상태.
   · 수시평가(occasional): 사유별 등록·검토 흐름.
   · 개선조치(improvement): 부서 단위 조치, 평가·부서와 링크.
   부서는 DYV2.ORG deptId 를 참조 (자체 조직 데이터 금지).
   레거시(rsk-proc·rsk-exec·rsk-imp-detail·rsk-kosha) 호환을 위해 processes·
   estimations·hazard_risk_factor·due_date·assessmentProcesses 등은 잔류.
   전역: DYRSK.*  (js/rsk-kosha.js · js/common.js 뒤에 로드)
   ===================================================================== */
(function (global) {
    'use strict';

    var K = function () { return global.DYRSK.KOSHA; };
    /* v1.1 §6.3 (2026-07-16): 스키마에 review·reportParseMock 추가 · improvements 초기 비움
     *   · r3 (검수 화면 정리): 행별 confirmed·due 필드 제거, 조치기한은 부서 단위 모달에서만.
     *   · r5 (§6.4 정정): "대상자 = 대상 부서" — 직원 단위 targets 필드/시드 되돌림.
     *   · r6 (라이브 시연 모드): 2026 시드 제거 → 미등록 상태에서 마법사로 직접 생성.
     *     reportParseMock 을 연도 키로 전환하여 신규 생성 ID(RA-2026-16 등)도 매치.
     *   · r7 (0건 부서 처리): deliverFromReview에서 지적사항 없는 부서는 DONE로 처리·이력 기록,
     *     refreshAssessmentStatus는 개선건 있는 부서 기준으로 완료 판정.
     * → 이전 세션 캐시와 충돌하지 않도록 스토리지 키 버전 갱신. */
    var SKEY = 'damyangRskV2r7';

    /* ================= 스토어 ================= */
    var db = null;

    /* 부서(=DYV2.ORG deptId) 시연 시드 */
    function deptName(deptId) {
        try {
            var n = global.DYV2 && global.DYV2.orgNode ? global.DYV2.orgNode(deptId) : null;
            return n ? n.name : deptId;
        } catch (e) { return deptId; }
    }
    /* 정기평가·수시평가 대상 후보 부서 (dept/office/town 노드) */
    function deptCandidates() {
        var out = [];
        try {
            if (!global.DYV2 || !global.DYV2.orgWalk) return out;
            global.DYV2.orgWalk(function (n) {
                if (n.type === 'dept' || n.type === 'office' || n.type === 'town') {
                    out.push({ id: n.id, name: n.name });
                }
            });
        } catch (e) {}
        return out;
    }

    function seed() {
        return {
            /* --- 레거시(작업공정·4×4 화면) --- */
            seqProc: 2, seqHrf: 20,
            processes: [
                {
                    id: 'PRC-001', targetId: 'f_jns', name: '약품 투입', desc: '염소·응집제 투입 · 약품탱크 취급',
                    evaluator: '물순환사업소 · 시설 담당 / 서담당', source: 'STD', revision_no: 1, seq: 1,
                    equip: ['cl2_bombe', 'pac_pump', 'chem_tank'], hf: ['cl2', 'pac', 'conf'],
                    hrf: [
                        { id: 'h1', name: '유해물질 누출에 의한 중독·질식', category: '화학적', basis: '산업안전보건기준규칙 §420 관리대상 유해물질', source: 'STD', legal_status: 'MAPPED' },
                        { id: 'h2', name: '밀폐공간 진입 중 산소결핍·질식', category: '작업특성', basis: '산업안전보건기준규칙 §619 밀폐공간 작업허가', source: 'STD', legal_status: 'MAPPED' }
                    ]
                },
                {
                    id: 'PRC-002', targetId: 'f_jns', name: '설비 정비', desc: '펌프·배관·밸브 정비 · 밀폐공간 진입',
                    evaluator: '물순환사업소 · 물순환사업소장 / 오순환', source: 'STD', revision_no: 1, seq: 2,
                    equip: ['pump_motor', 'valve_pit'], hf: ['elec', 'rot', 'conf'],
                    hrf: [
                        { id: 'h3', name: '활선 근접작업 감전', category: '전기', basis: '산업안전보건기준규칙 §310 정전작업', source: 'STD', legal_status: 'MAPPED' },
                        { id: 'h4', name: '회전체 접촉 끼임', category: '기계적', basis: '산업안전보건기준규칙 §87 원동기·회전축 방호', source: 'STD', legal_status: 'MAPPED' }
                    ]
                }
            ],
            estimations: {
                'RA-2026-01|PRC-001': { done: true, method: '4x4', rows: [
                    { hrfId: 'h1', name: '유해물질 누출에 의한 중독·질식', freq: 2, severity: 3 },
                    { hrfId: 'h2', name: '밀폐공간 진입 중 산소결핍·질식', freq: 2, severity: 2 }
                ] }
            },

            /* --- 재설계 v1 스키마 --- */
            seqAsmt: 5, seqImp: 200, seqOcc: 2,

            /* 정기 위험성평가: 연도별 1건 원칙, 부서별 조치 상태·기한 관리
             * 2026: 시연 시작점 — **미등록 상태** (사용자가 마법사로 직접 생성해 라이브 시연)
             * 2025: 전 부서 조치완료 · 승인 완료 (참고용) */
            assessments: [
                {
                    id: 'RA-2025-01', year: 2025, type: 'REGULAR', status: 'COMPLETED',
                    title: '2025년 정기 위험성평가', createdAt: '2025-04-01',
                    targetId: 'f_jns', scope: 'ALL', method: '4x4', team: [], worker_participation: false,
                    change_reason: '', changed_processes: [], completed_at: '2025-11-20', approval: '승인',
                    files: { surveyAll: '2025_정기평가_공통설문지.hwpx', report: '2025_정기평가_보고서.hwpx' },
                    review: { stage: 'DELIVERED', extractedAt: '2025-05-15', parsedDepts: {} },
                    depts: [
                        { deptId: 'safety', inspectDate: '2025-05-08', surveyFile: '', status: 'DONE', deliveredAt: '2025-05-20', dueDate: '2025-07-31', hazards: [] },
                        { deptId: 'env',    inspectDate: '2025-05-10', surveyFile: '', status: 'DONE', deliveredAt: '2025-05-20', dueDate: '2025-08-15', hazards: [] },
                        { deptId: 'water',  inspectDate: '2025-05-14', surveyFile: '', status: 'DONE', deliveredAt: '2025-05-25', dueDate: '2025-09-30', hazards: [] }
                    ],
                    history: [
                        { type: 'CREATE',    at: '2025-04-01', by: '재난안전과 홍길동', memo: '2025 정기평가 생성 · 3개 부서 선정' },
                        { type: 'DELIVER',   at: '2025-05-20', by: '재난안전과 홍길동', memo: '전 부서 개선조치 전달 (총 8건)' },
                        { type: 'COMPLETE',  at: '2025-11-20', by: '재난안전과 홍길동', memo: '전 부서 조치완료 · 보고서 승인' }
                    ]
                }
            ],

            /* 보고서(hwpx) 파싱 목업 — 부서별 유해위험요인·개선조치사항 추출 결과.
             * 실제로는 hwpx 파서가 반환할 결과. 검수 화면(rsk-list)의 데모 소스.
             * 키: year → { deptId → [{name, category, cause, action}] }
             *   ─ 2026 assessment는 시연 중 마법사로 생성되므로 ID가 유동적이라 연도 키로 조회. */
            reportParseMock: {
                2026: {
                    safety: [
                        { name: '중대재해팀 사무실 소화설비 미점검',    category: '기타',       cause: '점검 주기 미준수',        action: '월 1회 소화기 압력·유효기한 점검 체계 수립' },
                        { name: '옥상 옥외기 점검 시 추락 위험',        category: '고소작업',   cause: '안전난간·안전대 미비',    action: '옥상 안전난간 보강 및 작업 시 안전대 부착 의무화' }
                    ],
                    env: [
                        { name: '폐기물 상하차 시 지게차 협착 위험',    category: '기계적',     cause: '유도자 부재',              action: '유도자 배치·후진 경보기 설치' },
                        { name: '수집 차량 도로 진출입 접촉사고',       category: '작업특성',   cause: '시야 확보 불량',           action: '반사경 설치 및 진출입 통제 인원 배치' },
                        { name: '자원순환팀 신규 압축기 협착',          category: '기계적',     cause: '안전문 인터록 미설치',    action: '압축기 안전문 인터록 설치 및 작업표준서 재정비' }
                    ],
                    water: [
                        { name: '약품 투입실 염소 누출 위험',           category: '화학적',     cause: '누출감지기 노후화',        action: '누출감지기 교체 · 비상세안설비 점검 주기 단축' },
                        { name: '밀폐공간(밸브실) 산소결핍',            category: '작업특성',   cause: '환기 미확보',              action: '작업허가제 도입 및 산소농도계 상시 비치' },
                        { name: '정수팀 약품 이송 배관 파손 위험',      category: '화학적',     cause: '배관 부식 상태 미점검',    action: '배관 두께 측정 정기 점검(연 2회) 실시' }
                    ],
                    facility: [
                        { name: '환경시설팀 지붕 방수공사 시 추락',     category: '고소작업',   cause: '작업발판 부실',            action: '표준 작업발판 설치 후 작업 · 안전대 필수 착용' },
                        { name: '시설운영팀 전동공구 감전',             category: '전기',       cause: '누전차단기 미설치',        action: '작업구역 이동식 누전차단기 배치' }
                    ],
                    construct: [
                        { name: '도로관리팀 절단기 작업 시 절창',       category: '기계적',     cause: '보호구 착용 미흡',         action: '방호장갑 · 보안면 지급 및 착용 점검' },
                        { name: '시설관리팀 도로 야간작업 교통사고',    category: '작업특성',   cause: '반사조끼·경광등 미비',    action: '야간작업 반사조끼·경광등 지급 · 신호수 배치' }
                    ]
                }
            },

            /* 개선조치 (부서 단위) — 2026 정기평가는 초기에 없음 (파싱 검수 후 생성).
             * 2025 완료 평가의 개선조치 이력은 별도로 남기지 않음. */
            improvements: [],

            /* 수시 위험성평가 (사유별 등록·검토) */
            occasionals: [
                {
                    id: 'OCC-2026-01', year: 2026, deptId: 'water', reason: 'ACCIDENT',
                    date: '2026-05-20', desc: '정수장 밸브실 작업 중 밸브 파손으로 수증기 분출 · 경상 1명',
                    files: [{ name: '재해_현장_사진.zip' }, { name: '경위서.hwpx' }],
                    status: 'REVIEWED', reviewedAt: '2026-05-25',
                    history: [
                        { type: 'REGISTER', at: '2026-05-21', by: '물순환사업소 서담당',   memo: '수시평가 등록 (사유: 재해사고 발생)' },
                        { type: 'REVIEW',   at: '2026-05-25', by: '재난안전과 홍길동',       memo: '검토 완료 · 후속 개선조치 지정' }
                    ]
                },
                {
                    id: 'OCC-2026-02', year: 2026, deptId: 'env', reason: 'EQUIP_CHANGE',
                    date: '2026-06-15', desc: '자원순환팀 신규 압축기 도입 · 위험성 재평가 필요',
                    files: [{ name: '설비사양서.pdf' }],
                    status: 'REGISTERED',
                    history: [
                        { type: 'REGISTER', at: '2026-06-16', by: '환경과 정수빈', memo: '수시평가 등록 (사유: 설비·물질 변경)' }
                    ]
                }
            ]
        };
    }

    function load() {
        if (db) return db;
        try {
            var raw = global.sessionStorage.getItem(SKEY);
            db = raw ? JSON.parse(raw) : seed();
        } catch (e) { db = seed(); }
        return db;
    }
    function save() { try { global.sessionStorage.setItem(SKEY, JSON.stringify(db)); } catch (e) {} }
    function reset() { db = seed(); save(); return db; }

    /* ================= 레거시 공정(processes) — 유지 ================= */
    function processes(targetId) {
        var d = load();
        return d.processes.filter(function (p) { return !targetId || p.targetId === targetId; })
            .sort(function (a, b) { return (a.seq || 0) - (b.seq || 0); });
    }
    function processOf(id) { var d = load(); for (var i = 0; i < d.processes.length; i++) if (d.processes[i].id === id) return d.processes[i]; return null; }
    function addProcess(o) {
        var d = load(); d.seqProc++;
        var p = { id: 'PRC-' + String(1000 + d.seqProc).slice(-3), targetId: o.targetId, name: o.name, desc: o.desc || '',
            evaluator: o.evaluator || '', source: o.source || 'MANUAL', revision_no: 1, seq: o.seq || (processes(o.targetId).length + 1),
            equip: o.equip || [], hf: o.hf || [], hrf: o.hrf || [] };
        d.processes.push(p); save(); return p;
    }
    function saveProcess(p) { save(); return p; }
    function deleteProcess(id) { var d = load(); d.processes = d.processes.filter(function (p) { return p.id !== id; }); save(); }
    function nextHrfId() { var d = load(); d.seqHrf++; return 'h' + d.seqHrf; }
    function autoMapHRF(targetId, procName, equipIds, hfIds) {
        var ko = K(), ids = {};
        ko.lookupProcess(targetId, procName).forEach(function (id) { ids[id] = true; });
        (equipIds || []).forEach(function (eq) { (ko.LOOKUP_EQUIP[eq] || []).forEach(function (id) { ids[id] = true; }); });
        (hfIds || []).forEach(function (hf) { ko.lookupFactor(hf).forEach(function (id) { ids[id] = true; }); });
        return Object.keys(ids).map(function (id) {
            var s = ko.stdHrf(id);
            return { name: s.name, category: s.category, basis: s.basis, source: 'STD', legal_status: 'PENDING' };
        });
    }

    /* ================= 위험성평가 (정기) ================= */
    function assessments(year) {
        var d = load();
        return d.assessments.filter(function (a) { return a.type === 'REGULAR' && (!year || a.year === year); })
            .sort(function (a, b) { return b.year - a.year || (a.id < b.id ? 1 : -1); });
    }
    function assessmentOf(id) { var d = load(); for (var i = 0; i < d.assessments.length; i++) if (d.assessments[i].id === id) return d.assessments[i]; return null; }
    function assessmentYears() {
        var d = load(), s = {};
        d.assessments.forEach(function (a) { s[a.year] = true; });
        return Object.keys(s).map(Number).sort(function (a, b) { return b - a; });
    }
    /* 새 정기평가 생성 (마법사 결과 반영)
     *   o.depts:[{deptId, inspectDate, surveyFile}]  — "대상자 = 대상 부서" (v1.1 §6.4) */
    function addRegular(o) {
        var d = load(); d.seqAsmt++;
        var deptPayload = (o.depts || []).map(function (x) {
            return {
                deptId: x.deptId, inspectDate: x.inspectDate || '',
                surveyFile: x.surveyFile || '',
                status: 'BEFORE', deliveredAt: '', dueDate: '', hazards: []
            };
        });
        var deptCount = deptPayload.length;
        var a = {
            id: 'RA-' + o.year + '-' + String(10 + d.seqAsmt).slice(-2),
            year: o.year, type: 'REGULAR', status: 'IN_PROGRESS',
            title: o.year + '년 정기 위험성평가', createdAt: today(),
            targetId: '', scope: 'ALL', method: '4x4', team: [], worker_participation: false,
            change_reason: '', changed_processes: [], completed_at: '', approval: '',
            files: { surveyAll: o.surveyAll || '', report: '' },
            review: { stage: 'NONE', extractedAt: '', parsedDepts: {} },
            depts: deptPayload,
            history: [
                { type: 'CREATE', at: today(), by: '재난안전과',
                  memo: '정기평가 생성 · ' + deptCount + '개 부서 선정' },
                /* 설문지는 생성 이후 목록에서 첨부하므로, 생성 시 통보는 점검예정일까지다 */
                { type: 'NOTIFY', at: today(), by: '재난안전과',
                  memo: deptCount + '개 부서에 점검예정일 통보' }
            ]
        };
        d.assessments.push(a); save(); return a;
    }
    function saveAssessment() { save(); }

    /* ===== 점검설문지 첨부 (등록 이후 목록에서 첨부) =====
     * 생성 마법사에서 설문지 단계를 뺐으므로, 설문지는 평가가 만들어진 뒤
     * 목록에서 공통본(surveyAll) 또는 부서별본(dept.surveyFile)으로 붙인다.
     * 부서별본이 있으면 그것이 공통본을 대신한다(표시 규칙은 deptRow 참조). */
    function setSurveyAll(aid, fileName) {
        var a = assessmentOf(aid); if (!a) return null;
        a.files = a.files || {};
        a.files.surveyAll = fileName || '';
        pushHistory(aid, { type: 'FILE', by: '재난안전과',
            memo: fileName ? '공통 점검설문지 첨부 · ' + fileName : '공통 점검설문지 삭제' });
        save(); return a;
    }
    function setDeptSurvey(aid, deptId, fileName) {
        var a = assessmentOf(aid); if (!a) return null;
        var dp = (a.depts || []).filter(function (x) { return x.deptId === deptId; })[0];
        if (!dp) return null;
        dp.surveyFile = fileName || '';
        pushHistory(aid, { type: 'FILE', by: '재난안전과',
            memo: deptName(deptId) + (fileName ? ' 부서 설문지 첨부 · ' + fileName : ' 부서 설문지 삭제(공통본 적용)') });
        save(); return dp;
    }
    /* 설문지 첨부 진행률 — 부서별본 또는 공통본이 걸린 부서 수 */
    function surveyProgress(aid) {
        var a = assessmentOf(aid); if (!a) return { done: 0, total: 0, all: '' };
        var all = (a.files && a.files.surveyAll) || '';
        var depts = a.depts || [];
        var done = depts.filter(function (dp) { return dp.surveyFile || all; }).length;
        return { done: done, total: depts.length, all: all };
    }

    function today() {
        var t = new Date(); var mm = t.getMonth() + 1, dd = t.getDate();
        return t.getFullYear() + '-' + (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd;
    }
    function nowTs() {
        var t = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
        return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()) +
            ' ' + pad(t.getHours()) + ':' + pad(t.getMinutes());
    }

    /* 평가 전체 진행률 (개선조치 완료건/총 개선조치건) */
    function assessmentProgress(aid) {
        var ms = improvementsFor(aid);
        var done = ms.filter(function (m) { return m.status === 'DONE'; }).length;
        return { total: ms.length, done: done, pct: ms.length ? Math.round(done / ms.length * 100) : 0 };
    }
    /* 부서 단위 개선건수 N/M */
    function deptImpCount(aid, deptId) {
        var ms = improvementsFor(aid).filter(function (m) { return m.dept_id === deptId; });
        var done = ms.filter(function (m) { return m.status === 'DONE'; }).length;
        return { total: ms.length, done: done };
    }
    /* 전 부서 조치완료 시 평가 상태 자동 완료
     * 부서 status 규칙:
     *   - 전달 전(deliveredAt 없음) → BEFORE
     *   - 전달됨·개선건 0건(지적사항 없음) → DONE (deliverFromReview에서 이미 설정, 재확인)
     *   - 전달됨·전 개선조치 완료 → DONE
     *   - 전달됨·남은 미완료 있음 → BEFORE
     * 완료 판정: 개선건이 있는 부서(actionable) 기준으로만 판단.
     *   → 지적사항 없는 부서(c.total===0)는 완료 판정·집계에서 제외. */
    function refreshAssessmentStatus(aid) {
        var a = assessmentOf(aid); if (!a) return;
        if (a.status === 'COMPLETED') return;
        if (!a.depts || !a.depts.length) return;
        a.depts.forEach(function (dp) {
            var c = deptImpCount(aid, dp.deptId);
            if (!dp.deliveredAt) { dp.status = 'BEFORE'; return; }
            dp.status = (c.total === 0 || c.done === c.total) ? 'DONE' : 'BEFORE';
        });
        var actionable = a.depts.filter(function (dp) {
            return deptImpCount(aid, dp.deptId).total > 0;
        });
        var allDone = actionable.length > 0 && actionable.every(function (dp) { return dp.status === 'DONE'; });
        if (allDone) {
            a.status = 'COMPLETED';
            a.completed_at = today();
            a.history = a.history || [];
            a.history.push({ type: 'COMPLETE', at: nowTs(), by: '시스템', memo: '전 부서 조치완료 · 평가 자동 완료' });
        }
        save();
    }

    /* 이력 append */
    function pushHistory(aid, entry) {
        var a = assessmentOf(aid); if (!a) return;
        a.history = a.history || [];
        a.history.push({ type: entry.type, at: entry.at || nowTs(), by: entry.by || '', memo: entry.memo || '' });
        save();
    }

    /* ================= 보고서 파싱·검수 (v1.1 §6.3) ================= */
    /* 보고서(hwpx) 업로드 → 파싱 목업 실행: assessment.review = { stage:'REVIEW', parsedDepts:{deptId:[...]} }
     *   검수 화면은 내용(name·category·cause·action)만 다루고, 기한은 다음 단계 모달에서 부서 단위로 지정. */
    function uploadReport(aid, fileName) {
        var a = assessmentOf(aid); if (!a) return null;
        a.files = a.files || {}; a.files.report = fileName || (a.year + '_정기평가_보고서.hwpx');
        var d = load();
        /* 파싱 목업은 연도 키로 조회 (신규 생성 assessment id도 매치되도록) */
        var seed = (d.reportParseMock && (d.reportParseMock[a.year] || d.reportParseMock[aid])) || {};
        var parsed = {};
        (a.depts || []).forEach(function (dp) {
            var seedRows = seed[dp.deptId] || [];
            parsed[dp.deptId] = seedRows.map(function (r) {
                return {
                    name: r.name || '', category: r.category || '', cause: r.cause || '',
                    action: r.action || '', deleted: false
                };
            });
        });
        a.review = { stage: 'REVIEW', extractedAt: nowTs(), parsedDepts: parsed };
        a.history = a.history || [];
        var totalCount = 0, deptCount = 0;
        Object.keys(parsed).forEach(function (k) { if (parsed[k].length) { deptCount++; totalCount += parsed[k].length; } });
        a.history.push({ type: 'STATUS', at: nowTs(), by: '재난안전과',
            memo: '보고서 업로드 · 파싱 완료 (' + deptCount + '개 부서 · ' + totalCount + '건 추출)' });
        save();
        return { deptCount: deptCount, totalCount: totalCount };
    }
    function clearReport(aid) {
        var a = assessmentOf(aid); if (!a) return;
        if (a.files) a.files.report = '';
        a.review = { stage: 'NONE', extractedAt: '', parsedDepts: {} };
        save();
    }
    /* 검수 화면 편집 헬퍼 — 내용만 수정·삭제·추가 */
    function reviewSet(aid, deptId, idx, key, val) {
        var a = assessmentOf(aid); if (!a || !a.review) return;
        var rows = (a.review.parsedDepts || {})[deptId] || [];
        if (!rows[idx]) return;
        rows[idx][key] = val;
        save();
    }
    function reviewDel(aid, deptId, idx) {
        var a = assessmentOf(aid); if (!a || !a.review) return;
        var rows = (a.review.parsedDepts || {})[deptId] || [];
        rows.splice(idx, 1);
        save();
    }
    function reviewAdd(aid, deptId) {
        var a = assessmentOf(aid); if (!a || !a.review) return;
        a.review.parsedDepts = a.review.parsedDepts || {};
        a.review.parsedDepts[deptId] = a.review.parsedDepts[deptId] || [];
        a.review.parsedDepts[deptId].push({ name: '', category: '', cause: '', action: '', deleted: false });
        save();
    }
    /* 검토완료 → 조치기한 적용 → improvements 전달 (부서별 자동 배분)
     *   조치기한은 부서 단위(deptDues[deptId] 또는 bulkDue)로만 결정. 행별 due 는 사용하지 않는다.
     *   개선건 0건 부서는 "지적사항 없음(조치 대상 제외)"로 처리:
     *     deliveredAt = today, status = DONE, hazards = [], history에 REVIEW 기록. */
    function deliverFromReview(aid, opts) {
        opts = opts || {};
        var a = assessmentOf(aid); if (!a || !a.review) return null;
        var bulkDue = opts.bulkDue || '';
        var deptDues = opts.deptDues || {};
        var pd = a.review.parsedDepts || {};
        var total = 0, deptsTouched = 0, deptsExcluded = 0;
        (a.depts || []).forEach(function (dp) {
            var deptId = dp.deptId;
            var rows = ((pd[deptId] || [])).filter(function (r) { return !r.deleted && (r.name || '').trim() && (r.action || '').trim(); });
            var deptNm = deptName(deptId);
            if (!rows.length) {
                /* 0건 부서 — 지적사항 없음으로 조치 대상 제외, DONE 처리 */
                dp.hazards = [];
                dp.dueDate = '';
                dp.deliveredAt = today();
                dp.status = 'DONE';
                pushHistory(aid, { type: 'REVIEW', by: '재난안전과',
                    memo: deptNm + ' — 지적사항 없음(조치 대상 제외)' });
                deptsExcluded++;
                return;
            }
            var deptDue = deptDues[deptId] || bulkDue;
            if (!deptDue) return;
            dp.hazards = rows.map(function (r) { return { name: r.name.trim(), category: r.category || '', cause: r.cause || '', action: r.action.trim() }; });
            dp.dueDate = deptDue;
            dp.deliveredAt = today();
            dp.status = 'BEFORE';
            rows.forEach(function (r) {
                addImprovement({
                    source_type: 'risk_assessment',
                    assessment_id: aid, dept_id: deptId,
                    hazard: { name: r.name.trim(), category: r.category || '', cause: r.cause || '' },
                    description: r.action.trim(), action: r.action.trim(),
                    due: deptDue, due_date: deptDue,
                    assigned_to: deptNm + ' 담당자',
                    status: 'IN_PROGRESS', created: today(),
                    history: [{ type: 'NOTIFY', at: nowTs(), by: '재난안전과', memo: '개선조치 전달 (기한 ' + deptDue + ')' }]
                });
                total++;
            });
            deptsTouched++;
        });
        a.review.stage = 'DELIVERED';
        var deliverMemo = deptsTouched + '개 부서에 개선조치 ' + total + '건 자동 전달 (일괄 기한 ' + (bulkDue || '개별') + ')';
        if (deptsExcluded) deliverMemo += ' · 지적사항 없는 ' + deptsExcluded + '개 부서는 조치 대상 제외';
        pushHistory(aid, { type: 'DELIVER', by: '재난안전과', memo: deliverMemo });
        refreshAssessmentStatus(aid);
        return { total: total, deptsTouched: deptsTouched, deptsExcluded: deptsExcluded };
    }

    /* ================= 개선조치 (부서·평가 링크) ================= */
    function improvements() { return load().improvements; }
    function improvementOf(id) { var d = load(); for (var i = 0; i < d.improvements.length; i++) if (d.improvements[i].id === id) return d.improvements[i]; return null; }
    function improvementsFor(aid, deptId) {
        return improvements().filter(function (m) {
            if (m.assessment_id !== aid) return false;
            if (deptId && m.dept_id !== deptId) return false;
            return true;
        });
    }
    function nextImpId() {
        var d = load(); d.seqImp++;
        return 'IMP-' + String(300 + d.seqImp);
    }
    /* 개선조치 생성 */
    function addImprovement(o) {
        var d = load(); d.seqImp++;
        var m = {
            id: 'IMP-' + String(300 + d.seqImp),
            source_type: o.source_type || 'manual',
            assessment_id: o.assessment_id || '',
            dept_id: o.dept_id || '',
            target_id: o.target_id || '', process_id: o.process_id || '',
            hazard: o.hazard || { name: '', category: '', cause: '' },
            hazard_risk_factor: (o.hazard && o.hazard.name) || o.hazard_risk_factor || '',
            description: o.description || (o.hazard && o.hazard.action) || '',
            action: o.action || o.description || '',
            assigned_to: o.assigned_to || '', due: o.due || o.due_date || '', due_date: o.due_date || o.due || '',
            before_photo: !!o.before_photo, after_photo: false, action_content: '',
            status: o.status || 'PENDING', reassessed: false, created: o.created || today(),
            history: o.history || []
        };
        d.improvements.push(m); save();
        try {
            if (global.EDOC && global.EDOC.addImprovement) {
                global.EDOC.addImprovement({
                    title: m.description, sourceMenu: '위험성평가',
                    sourceDoc: (assessmentOf(m.assessment_id) || {}).title || '정기 위험성평가',
                    due: m.due || m.due_date
                });
            }
        } catch (e) {}
        return m;
    }
    function saveImprovement() { save(); }
    /* 조치 완료 처리 */
    function completeImprovement(id, actionContent, by) {
        var m = improvementOf(id); if (!m) return;
        m.action_content = actionContent || m.action_content;
        m.after_photo = true; m.status = 'DONE'; m.reassessed = true;
        m.history = m.history || [];
        m.history.push({ type: 'STATUS', at: nowTs(), by: by || '부서 담당자', memo: '완료 처리' });
        save();
        if (m.assessment_id) refreshAssessmentStatus(m.assessment_id);
        return m;
    }
    function markReassessed(id) { var m = improvementOf(id); if (m) { m.reassessed = true; save(); } return m; }
    /* 이력 append (개선조치 단위) */
    function pushImpHistory(id, entry) {
        var m = improvementOf(id); if (!m) return;
        m.history = m.history || [];
        m.history.push({ type: entry.type, at: entry.at || nowTs(), by: entry.by || '', memo: entry.memo || '' });
        save();
    }
    /* 기한초과 여부 (오늘 = 2026-07-14 기준) */
    function isOverdue(m) {
        if (!m || m.status === 'DONE' || !(m.due || m.due_date)) return false;
        var t = new Date('2026-07-14'), d = new Date(m.due || m.due_date);
        return d < t;
    }

    /* ================= 수시 위험성평가 ================= */
    var OCC_REASONS = {
        ACCIDENT:     { label: '재해사고 발생',     tone: 'danger'  },
        EQUIP_CHANGE: { label: '설비·물질 변경',   tone: 'warning' },
        OTHER:        { label: '기타',              tone: 'neutral' }
    };
    function occasionals(year) {
        var d = load();
        return d.occasionals.filter(function (o) { return !year || o.year === year; })
            .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    }
    function occasionalOf(id) { var d = load(); for (var i = 0; i < d.occasionals.length; i++) if (d.occasionals[i].id === id) return d.occasionals[i]; return null; }
    function occasionalYears() {
        var d = load(), s = {};
        d.occasionals.forEach(function (o) { s[o.year] = true; });
        var arr = Object.keys(s).map(Number);
        if (arr.indexOf(new Date().getFullYear()) === -1) arr.push(2026);
        return arr.sort(function (a, b) { return b - a; });
    }
    function addOccasional(o) {
        var d = load(); d.seqOcc++;
        var it = {
            id: 'OCC-' + o.year + '-' + String(10 + d.seqOcc).slice(-2),
            year: o.year, deptId: o.deptId, reason: o.reason,
            date: o.date, desc: o.desc || '',
            files: o.files || [], status: 'REGISTERED',
            history: [{ type: 'REGISTER', at: nowTs(), by: deptName(o.deptId), memo: '수시평가 등록 (사유: ' + (OCC_REASONS[o.reason] || {}).label + ')' }]
        };
        d.occasionals.push(it); save(); return it;
    }
    function reviewOccasional(id, by) {
        var it = occasionalOf(id); if (!it) return;
        it.status = 'REVIEWED'; it.reviewedAt = today();
        it.history.push({ type: 'REVIEW', at: nowTs(), by: by || '재난안전과', memo: '검토 완료' });
        save(); return it;
    }

    /* ================= 메타 ================= */
    var SRC_META = {
        risk_assessment: { label: '위험성평가',   tone: 'info'    },
        inspection:      { label: '안전점검',     tone: 'purple'  },
        opinion:         { label: '의견청취',     tone: 'warning' },
        policy_check:    { label: '경영방침 점검', tone: 'info'    },
        incident:        { label: '사고(재발방지)', tone: 'danger' },
        manual:          { label: '수동',         tone: 'neutral' }
    };
    var STATUS_META = {
        PENDING:     { label: '예정',   tone: 'neutral' },
        IN_PROGRESS: { label: '진행중', tone: 'warning' },
        DONE:        { label: '완료',   tone: 'success' }
    };

    /* ---- 레거시(rsk-detail 구·rsk-exec) 호환 스텁 ---- */
    function estKey(aid, pid) { return aid + '|' + pid; }
    function estimation(aid, pid) { var d = load(); return d.estimations[estKey(aid, pid)] || null; }
    function saveEstimation(aid, pid, obj) { var d = load(); d.estimations[estKey(aid, pid)] = obj; save(); }
    function setEstDone(aid, pid, done) {
        var d = load(), k = estKey(aid, pid);
        if (!d.estimations[k]) d.estimations[k] = { done: false, method: '4x4', rows: [] };
        d.estimations[k].done = done; save();
    }
    function procEstStatus(aid, pid) {
        var e = estimation(aid, pid);
        if (!e) return 'TODO';
        if (e.done) return 'DONE';
        return (e.rows && e.rows.some(function (r) { return r.freq && r.severity; })) ? 'DOING' : 'TODO';
    }
    var METHODS = {
        '4x4':      { label: '빈도·강도(4×4)', fMax: 4, sMax: 4 },
        '3step':    { label: '3단계 판단법',    fMax: 3, sMax: 3 },
        'checklist':{ label: '체크리스트법',    fMax: 1, sMax: 1 }
    };
    function methodLabel(m) { return (METHODS[m] || METHODS['4x4']).label; }
    function gradeOf(method, freq, severity) {
        if (!freq || !severity) return { score: 0, grade: '', label: '-', acceptable: null };
        if (method === 'checklist') {
            var ok = freq === 1;
            return { score: ok ? 1 : 9, grade: ok ? 'low' : 'high', label: ok ? '적합(허용)' : '부적합(허용초과)', acceptable: ok };
        }
        var score = freq * severity;
        var g, label;
        var max = method === '3step' ? 9 : 16;
        var ratio = score / max;
        if (ratio >= 0.75) { g = 'critical'; label = '매우높음'; }
        else if (ratio >= 0.5) { g = 'high'; label = '높음'; }
        else if (ratio >= 0.3) { g = 'medium'; label = '보통'; }
        else if (ratio > 0.12) { g = 'low'; label = '낮음'; }
        else { g = 'minimal'; label = '매우낮음'; }
        var acceptable = (g === 'minimal' || g === 'low' || g === 'medium');
        return { score: score, grade: g, label: label, acceptable: acceptable };
    }
    function acceptableOf(method, freq, severity) { return gradeOf(method, freq, severity).acceptable === true; }
    function assessmentProcesses(a) {
        var all = processes(a && a.targetId ? a.targetId : null);
        if (a && a.type === 'OCCASIONAL' && a.scope === 'CHANGES_ONLY' && a.changed_processes && a.changed_processes.length) {
            return all.filter(function (p) { return a.changed_processes.indexOf(p.id) !== -1; });
        }
        return all;
    }
    function measuresOf(aid) {
        return improvements().filter(function (m) { return m.source_type === 'risk_assessment' && m.assessment_id === aid; });
    }
    function completionGate(aid) {
        var ms = measuresOf(aid);
        var doneMeasures = ms.filter(function (m) { return m.status === 'DONE'; });
        var evalDone = true; /* 재설계 후 공정 평가 개념 폐지 */
        var measureDone = ms.length === 0 || doneMeasures.length === ms.length;
        return {
            eval: { ok: evalDone, done: ms.length, total: ms.length },
            measure: { ok: measureDone, done: doneMeasures.length, total: ms.length },
            reassess: { ok: true, done: doneMeasures.length, total: ms.length },
            pass: evalDone && measureDone
        };
    }
    function addAssessment(o) { /* 레거시: 정기 생성 위임 */ return addRegular({ year: o.year, depts: [], surveyAll: '' }); }

    global.DYRSK = global.DYRSK || {};
    var api = {
        /* 스토어 */
        reset: reset, load: load, save: save, today: today, nowTs: nowTs,
        /* 부서 */
        deptName: deptName, deptCandidates: deptCandidates,
        /* 정기 평가 */
        assessments: assessments, assessmentOf: assessmentOf, assessmentYears: assessmentYears,
        addRegular: addRegular, addAssessment: addAssessment, saveAssessment: saveAssessment,
        assessmentProgress: assessmentProgress, deptImpCount: deptImpCount,
        refreshAssessmentStatus: refreshAssessmentStatus, pushHistory: pushHistory,
        /* 점검설문지 — 등록 이후 목록에서 첨부 (생성 마법사 STEP 아님) */
        setSurveyAll: setSurveyAll, setDeptSurvey: setDeptSurvey, surveyProgress: surveyProgress,
        /* 보고서 파싱·검수 (검수 단계에서는 내용만 편집, 기한은 다음 단계 모달에서 부서 단위 지정) */
        uploadReport: uploadReport, clearReport: clearReport,
        reviewSet: reviewSet, reviewDel: reviewDel, reviewAdd: reviewAdd,
        deliverFromReview: deliverFromReview,
        /* 개선조치 */
        improvements: improvements, improvementOf: improvementOf, improvementsFor: improvementsFor,
        addImprovement: addImprovement, saveImprovement: saveImprovement,
        completeImprovement: completeImprovement, markReassessed: markReassessed,
        pushImpHistory: pushImpHistory, isOverdue: isOverdue, nextImpId: nextImpId,
        /* 수시 평가 */
        occasionals: occasionals, occasionalOf: occasionalOf, occasionalYears: occasionalYears,
        addOccasional: addOccasional, reviewOccasional: reviewOccasional, OCC_REASONS: OCC_REASONS,
        /* 메타 */
        SRC_META: SRC_META, STATUS_META: STATUS_META,
        /* 레거시 호환 */
        processes: processes, processOf: processOf, addProcess: addProcess, saveProcess: saveProcess,
        deleteProcess: deleteProcess, nextHrfId: nextHrfId, autoMapHRF: autoMapHRF,
        assessmentProcesses: assessmentProcesses, measuresOf: measuresOf, completionGate: completionGate,
        estimation: estimation, saveEstimation: saveEstimation, setEstDone: setEstDone, procEstStatus: procEstStatus,
        METHODS: METHODS, methodLabel: methodLabel, gradeOf: gradeOf, acceptableOf: acceptableOf
    };
    Object.keys(api).forEach(function (k) { global.DYRSK[k] = api[k]; });
})(window);
