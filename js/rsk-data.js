/* =====================================================================
   rsk-data.js · 위험성평가 도메인 데이터·세션 스토어 (DYRSK)
   ---------------------------------------------------------------------
   백엔드 없는 정적 프로토타입 — sessionStorage 로 화면 간 상태 유지.
   (작업공정 → 평가목록 → 평가상세 → 위험성추정 → 개선조치 → 재평가 연동)
   확정(baseline) 개념 없음: 정기평가는 현재 공정 전체를 읽는다.
   전역: DYRSK.*  (js/rsk-kosha.js · js/common.js · js/edoc.js 뒤에 로드)
   ===================================================================== */
(function (global) {
    'use strict';

    var K = function () { return global.DYRSK.KOSHA; };
    var SKEY = 'damyangRskV2';

    /* ================= 스토어 ================= */
    var db = null;

    function seed() {
        return {
            seqProc: 2, seqHrf: 20, seqAsmt: 2, seqImp: 0,
            /* 공정 (확정 없음) */
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
            /* 위험성평가 (연도별·정기/수시) */
            assessments: [
                { id: 'RA-2025-01', targetId: 'f_jns', year: 2025, type: 'REGULAR', scope: 'ALL', title: '정기 위험성평가',
                  method: '4x4', team: ['물순환사업소장 오순환', '시설담당 서담당', '안전담당 김안전'], worker_participation: true,
                  status: 'COMPLETED', change_reason: '', changed_processes: [], completed_at: '2025-03-20', approval: '승인' },
                { id: 'RA-2026-01', targetId: 'f_jns', year: 2026, type: 'REGULAR', scope: 'ALL', title: '정기 위험성평가',
                  method: '4x4', team: ['물순환사업소장 오순환', '시설담당 서담당', '안전담당 김안전'], worker_participation: true,
                  status: 'IN_PROGRESS', change_reason: '', changed_processes: [], completed_at: '', approval: '' }
            ],
            /* 위험성 추정 : key = assessmentId|processId  → { done, method, rows:[{hrfId,name,freq,severity}] } */
            estimations: {
                'RA-2026-01|PRC-001': { done: true, method: '4x4', rows: [
                    { hrfId: 'h1', name: '유해물질 누출에 의한 중독·질식', freq: 2, severity: 3 },
                    { hrfId: 'h2', name: '밀폐공간 진입 중 산소결핍·질식', freq: 2, severity: 2 }
                ] }
            },
            /* 개선조치(=감소대책) 정본 — source_type 다원 */
            improvements: [
                { id: 'IMP-201', source_type: 'risk_assessment', assessment_id: 'RA-2026-01', target_id: 'f_jns',
                  process_id: 'PRC-001', hazard_risk_factor: '유해물질 누출에 의한 중독·질식',
                  description: '봄베 연결부 누출 감지기 증설 · 비상세안설비 점검 주기 단축', assigned_to: '시설담당 서담당',
                  due_date: '2026-08-20', before_photo: true, after_photo: false, action_content: '', status: 'IN_PROGRESS', created: '2026-06-30' }
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

    /* ================= 공정 ================= */
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

    /* 병렬 합집합 자동매핑 — 공정 ∪ 설비 ∪ 유해인자 (레퍼런스 §5) */
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

    /* ================= 위험성평가 ================= */
    function assessments(targetId) {
        var d = load();
        return d.assessments.filter(function (a) { return !targetId || a.targetId === targetId; })
            .sort(function (a, b) { return b.year - a.year; });
    }
    function assessmentOf(id) { var d = load(); for (var i = 0; i < d.assessments.length; i++) if (d.assessments[i].id === id) return d.assessments[i]; return null; }
    function addAssessment(o) {
        var d = load(); d.seqAsmt++;
        var a = { id: 'RA-' + o.year + '-' + String(10 + d.seqAsmt).slice(-2), targetId: o.targetId, year: o.year,
            type: o.type, scope: o.scope || (o.type === 'OCCASIONAL' ? 'CHANGES_ONLY' : 'ALL'),
            title: o.title || (o.type === 'OCCASIONAL' ? '수시 위험성평가' : '정기 위험성평가'),
            method: o.method || '4x4', team: o.team || [], worker_participation: !!o.worker_participation,
            status: 'IN_PROGRESS', change_reason: o.change_reason || '', changed_processes: o.changed_processes || [],
            completed_at: '', approval: '' };
        d.assessments.push(a); save(); return a;
    }
    /* 평가가 다루는 공정 목록 (정기=전체, 수시=변경분만) */
    function assessmentProcesses(a) {
        var all = processes(a.targetId);
        if (a.type === 'OCCASIONAL' && a.scope === 'CHANGES_ONLY' && a.changed_processes && a.changed_processes.length) {
            return all.filter(function (p) { return a.changed_processes.indexOf(p.id) !== -1; });
        }
        return all;
    }

    /* ================= 추정(estimation) ================= */
    function estKey(aid, pid) { return aid + '|' + pid; }
    function estimation(aid, pid) { var d = load(); return d.estimations[estKey(aid, pid)] || null; }
    function saveEstimation(aid, pid, obj) { var d = load(); d.estimations[estKey(aid, pid)] = obj; save(); }
    function setEstDone(aid, pid, done) {
        var d = load(), k = estKey(aid, pid);
        if (!d.estimations[k]) d.estimations[k] = { done: false, method: '4x4', rows: [] };
        d.estimations[k].done = done; save();
    }
    /* 공정 평가 상태: 'DONE' | 'DOING' | 'TODO' */
    function procEstStatus(aid, pid) {
        var e = estimation(aid, pid);
        if (!e) return 'TODO';
        if (e.done) return 'DONE';
        return (e.rows && e.rows.some(function (r) { return r.freq && r.severity; })) ? 'DOING' : 'TODO';
    }

    /* ================= 등급·허용 산정 (기법별) ================= */
    var METHODS = {
        '4x4':      { label: '빈도·강도(4×4)', fMax: 4, sMax: 4 },
        '3step':    { label: '3단계 판단법',    fMax: 3, sMax: 3 },
        'checklist':{ label: '체크리스트법',    fMax: 1, sMax: 1 }
    };
    function methodLabel(m) { return (METHODS[m] || METHODS['4x4']).label; }
    /* 등급: {score, grade('minimal'|'low'|'medium'|'high'|'critical'), label, acceptable} */
    function gradeOf(method, freq, severity) {
        if (!freq || !severity) return { score: 0, grade: '', label: '-', acceptable: null };
        if (method === 'checklist') {
            // freq 를 O(1=적합)/X(2=부적합) 신호로 사용
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

    /* ================= 진행·완료 게이트 ================= */
    function assessmentProgress(aid) {
        var a = assessmentOf(aid); if (!a) return { total: 0, done: 0, doing: 0, todo: 0 };
        var procs = assessmentProcesses(a), done = 0, doing = 0, todo = 0;
        procs.forEach(function (p) {
            var s = procEstStatus(aid, p.id);
            if (s === 'DONE') done++; else if (s === 'DOING') doing++; else todo++;
        });
        return { total: procs.length, done: done, doing: doing, todo: todo };
    }
    /* 감소대책(개선조치) : 이 평가 출처 */
    function measuresOf(aid) {
        return improvements().filter(function (m) { return m.source_type === 'risk_assessment' && m.assessment_id === aid; });
    }
    /* 완료 게이트: (a) 전 공정 평가완료 (b) 전 대책 조치완료 (c) 재평가 허용 */
    function completionGate(aid) {
        var prog = assessmentProgress(aid);
        var ms = measuresOf(aid);
        var doneMeasures = ms.filter(function (m) { return m.status === 'DONE'; });
        var a = assessmentProcedureReassess(aid);
        var evalDone = prog.total > 0 && prog.done === prog.total;
        var measureDone = ms.length === 0 || doneMeasures.length === ms.length;
        return {
            eval: { ok: evalDone, done: prog.done, total: prog.total },
            measure: { ok: measureDone, done: doneMeasures.length, total: ms.length },
            reassess: { ok: a.ok, done: a.done, total: a.total },
            pass: evalDone && measureDone && a.ok
        };
    }
    /* 조치 후 재평가: 완료된 대책(개선조치) 중 재평가(허용) 확인 비율 */
    function assessmentProcedureReassess(aid) {
        var ms = measuresOf(aid).filter(function (m) { return m.status === 'DONE'; });
        var reassessed = ms.filter(function (m) { return m.reassessed === true; });
        return { ok: ms.length === 0 || reassessed.length === ms.length, done: reassessed.length, total: ms.length };
    }

    /* ================= 개선조치(개선조치=감소대책) ================= */
    function improvements() { return load().improvements; }
    function improvementOf(id) { var d = load(); for (var i = 0; i < d.improvements.length; i++) if (d.improvements[i].id === id) return d.improvements[i]; return null; }
    function addImprovement(o) {
        var d = load(); d.seqImp++;
        var m = { id: 'IMP-' + String(300 + d.seqImp), source_type: o.source_type || 'manual',
            assessment_id: o.assessment_id || '', target_id: o.target_id || '', process_id: o.process_id || '',
            hazard_risk_factor: o.hazard_risk_factor || '', description: o.description || '',
            assigned_to: o.assigned_to || '', due_date: o.due_date || '', before_photo: !!o.before_photo,
            after_photo: false, action_content: '', status: 'PENDING', reassessed: false, created: o.created || '오늘' };
        d.improvements.push(m); save();
        /* 레거시 개선조치 메뉴(edoc)와 best-effort 미러링 */
        try {
            if (global.EDOC && global.EDOC.addImprovement) {
                global.EDOC.addImprovement({ title: m.description, sourceMenu: '위험성평가', sourceDoc: (assessmentOf(m.assessment_id) || {}).title || '감소대책', due: m.due_date });
            }
        } catch (e) {}
        return m;
    }
    function saveImprovement() { save(); }
    /* 조치 완료 처리 → risk_assessment 출처면 해당 공정 '재평가 대기' 표시 */
    function completeImprovement(id, actionContent) {
        var m = improvementOf(id); if (!m) return;
        m.action_content = actionContent || m.action_content; m.after_photo = true; m.status = 'DONE';
        save(); return m;
    }
    function markReassessed(id) { var m = improvementOf(id); if (m) { m.reassessed = true; save(); } return m; }

    var SRC_META = {
        risk_assessment: { label: '위험성평가', tone: 'info' },
        inspection:      { label: '안전점검',   tone: 'purple' },
        opinion:         { label: '의견청취',   tone: 'warning' },
        policy_check:    { label: '경영방침 점검', tone: 'info' },
        incident:        { label: '사고(재발방지)', tone: 'danger' },
        manual:          { label: '수동',       tone: 'neutral' }
    };
    var STATUS_META = {
        PENDING:     { label: '예정',   tone: 'neutral' },
        IN_PROGRESS: { label: '진행중', tone: 'warning' },
        DONE:        { label: '완료',   tone: 'success' }
    };

    global.DYRSK = global.DYRSK || {};
    var api = {
        reset: reset,
        processes: processes, processOf: processOf, addProcess: addProcess, saveProcess: saveProcess,
        deleteProcess: deleteProcess, nextHrfId: nextHrfId, autoMapHRF: autoMapHRF,
        assessments: assessments, assessmentOf: assessmentOf, addAssessment: addAssessment, assessmentProcesses: assessmentProcesses,
        estimation: estimation, saveEstimation: saveEstimation, setEstDone: setEstDone, procEstStatus: procEstStatus,
        METHODS: METHODS, methodLabel: methodLabel, gradeOf: gradeOf, acceptableOf: acceptableOf,
        assessmentProgress: assessmentProgress, measuresOf: measuresOf, completionGate: completionGate,
        improvements: improvements, improvementOf: improvementOf, addImprovement: addImprovement,
        saveImprovement: saveImprovement, completeImprovement: completeImprovement, markReassessed: markReassessed,
        SRC_META: SRC_META, STATUS_META: STATUS_META
    };
    Object.keys(api).forEach(function (k) { global.DYRSK[k] = api[k]; });
})(window);
