/* =====================================================================
   sh-data.js · 산업보건관리 도메인 데이터·세션 스토어 (DYSH)
   ---------------------------------------------------------------------
   안전보건관리책임자 법정 직무(산안법 §15) 중 위탁용역으로 수행되는
   ① 작업환경측정  ② 건강검진(일반·특수) 의 계획·실시·증빙·후속조치를 관리.
   완료 결과·증빙은 인력평가(안전보건관리책임자 평가) 항목에 자동 연계된다.

   · 백엔드 없는 정적 프로토타입 — sessionStorage 로 화면 간 상태 유지.
   · 공용 상태 모델: 완료 / 미완료 / 보완 필요 / 기한 초과 (effWorkEnv·effHealth)
   · 전역: DYSH.*  (js/common.js 뒤에 로드 — DYV2.ORG 파생 부서 사용)
   ===================================================================== */
(function (global) {
    'use strict';

    var SKEY = 'damyangShV2';
    var TODAY = '2026-07-14';   /* 정적 프로토타입 기준일 */
    var CURYEAR = 2026;

    /* ================= 공용 상태 메타 ================= */
    /* 4개 공용 상태 — 목록/요약/칩에서 동일하게 사용 */
    var STATUS = {
        DONE:       { key: 'DONE',       label: '완료',      tone: 'success' },
        PENDING:    { key: 'PENDING',    label: '미완료',    tone: 'neutral' },
        SUPPLEMENT: { key: 'SUPPLEMENT', label: '보완 필요', tone: 'warning' },
        OVERDUE:    { key: 'OVERDUE',    label: '기한 초과', tone: 'danger' }
    };

    /* ── 공용 인라인 아이콘 (하우스 Lucide 세트 · currentColor · stroke 1.75) ──
       이모지 대신 SVG로 단일 아이콘 세트를 유지한다(layout.js ICON 과 동일 스타일). */
    var ICON_PATHS = {
        file:   '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
        image:  '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
        lock:   '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
        unlock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
        link:   '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
        alert:  '<path d="m10.29 3.86-8.4 14.74A2 2 0 0 0 3.62 22h16.76a2 2 0 0 0 1.73-3.4L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
        check:  '<path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/>'
    };
    function icon(name, size) {
        size = size || 14;
        return '<svg class="sh-ic" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" ' +
            'stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ' +
            'aria-hidden="true" focusable="false" style="vertical-align:-0.15em;flex:0 0 auto;">' + (ICON_PATHS[name] || '') + '</svg>';
    }

    function daysLeft(dateStr) {
        if (!dateStr) return null;
        return Math.round((new Date(dateStr) - new Date(TODAY)) / 86400000);
    }
    function isPast(dateStr) { var d = daysLeft(dateStr); return d != null && d < 0; }

    /* ================= 스토어 ================= */
    var db = null;

    function seed() {
        /* 작업환경측정 — 반기 1회(년·반기). 대상: 유해인자 노출 사업장/현장.
           result: '적정' | '개선 필요' | null(미측정) */
        var workenv = [
            { id: 'WE-2026-01', year: 2026, half: 'H1', dept: '물순환사업소', site: '정수장 약품동',
              subject: '소음·분진·염소가스 등 12종', vendor: '(주)한국산업보건환경연구원',
              planned: '2026-05-20', done: '2026-05-22', report: true,
              result: '적정', improveReq: '', improveDue: '', improveDone: false,
              beforePhoto: false, afterPhoto: false, owner: '물순환사업소 · 서담당',
              reason: '', expectedDone: '',
              carcinogen: false, targetBasis: '현업 종사자 · 유해인자 노출(정수처리 약품동)',
              history: [
                { at: '2026-04-30', actor: '서담당', event: '측정 계획 수립 · 위탁계약 체결' },
                { at: '2026-05-22', actor: '(주)한국산업보건환경연구원', event: '측정 실시 완료' },
                { at: '2026-06-10', actor: '서담당', event: '결과보고서 접수 · 결과 「적정」 확인' }
              ] },
            { id: 'WE-2026-02', year: 2026, half: 'H1', dept: '공공시설사업소', site: '하수처리시설',
              subject: '황화수소·분진·소음 등 9종', vendor: '(주)그린환경보건원',
              planned: '2026-05-18', done: '2026-05-25', report: true,
              result: '개선 필요', improveReq: '탈수기실 국소배기장치 성능 저하 — 후드 풍속 기준 미달, 배기설비 보수 및 재측정 필요',
              improveDue: '2026-08-31', improveDone: false,
              beforePhoto: true, afterPhoto: false, owner: '공공시설사업소 · 한담당',
              reason: '', expectedDone: '',
              carcinogen: false, targetBasis: '현업 종사자 · 유해인자 노출(하수처리 탈수기실)',
              history: [
                { at: '2026-04-28', actor: '한담당', event: '측정 계획 수립 · 위탁계약 체결' },
                { at: '2026-05-25', actor: '(주)그린환경보건원', event: '측정 실시 완료' },
                { at: '2026-06-05', actor: '한담당', event: '결과보고서 접수 · 결과 「개선 필요」 · 개선기한 2026-08-31 설정' }
              ] },
            { id: 'WE-2026-03', year: 2026, half: 'H1', dept: '환경과', site: '자원순환센터',
              subject: '분진·악취·중금속 등 8종', vendor: '(주)한국산업보건환경연구원',
              planned: '2026-07-28', done: '', report: false,
              result: null, improveReq: '', improveDue: '', improveDone: false,
              beforePhoto: false, afterPhoto: false, owner: '환경과 · 정환경',
              reason: '', expectedDone: '',
              carcinogen: true, targetBasis: '현업 종사자 · 발암성 유해인자(결정질 실리카 분진) 노출',
              history: [
                { at: '2026-06-20', actor: '정환경', event: '측정 계획 수립 · 위탁계약 체결(예정일 2026-07-28)' }
              ] },
            { id: 'WE-2026-04', year: 2026, half: 'H1', dept: '건설과', site: '도로보수 작업현장',
              subject: '소음·진동·분진 등 6종', vendor: '(주)그린환경보건원',
              planned: '2026-06-05', done: '', report: false,
              result: null, improveReq: '', improveDue: '', improveDone: false,
              beforePhoto: false, afterPhoto: false, owner: '건설과 · 박현장',
              reason: '위탁업체 일정 지연 및 현장 우천으로 예정일 내 미실시',
              expectedDone: '2026-07-25',
              carcinogen: false, targetBasis: '현업 종사자 · 유해인자 노출(도로보수 현장)',
              history: [
                { at: '2026-05-10', actor: '박현장', event: '측정 계획 수립 · 위탁계약 체결(예정일 2026-06-05)' },
                { at: '2026-06-06', actor: '박현장', event: '미실시 사유 등록 · 예상 완료일 2026-07-25' }
              ] },
            { id: 'WE-2026-05', year: 2026, half: 'H1', dept: '공공시설사업소', site: '실내수영장 기계실',
              subject: '염소가스·습도·소음 등 5종', vendor: '(주)한국산업보건환경연구원',
              planned: '2026-06-10', done: '2026-06-12', report: true,
              result: '개선 필요', improveReq: '염소가스 농도 노출기준 초과 — 자동염소주입기 밀폐 및 배기 개선 필요',
              improveDue: '2026-06-30', improveDone: false,
              beforePhoto: true, afterPhoto: false, owner: '공공시설사업소 · 한담당',
              reason: '', expectedDone: '',
              carcinogen: false, targetBasis: '현업 종사자 · 유해인자 노출(실내수영장 염소가스)',
              history: [
                { at: '2026-05-15', actor: '한담당', event: '측정 계획 수립 · 위탁계약 체결' },
                { at: '2026-06-12', actor: '(주)한국산업보건환경연구원', event: '측정 실시 완료' },
                { at: '2026-06-18', actor: '한담당', event: '결과보고서 접수 · 결과 「개선 필요」 · 개선기한 2026-06-30 설정' }
              ] },
            /* 전년도(2025 하반기) — 연도 필터 시연용 */
            { id: 'WE-2025-01', year: 2025, half: 'H2', dept: '물순환사업소', site: '정수장 약품동',
              subject: '소음·분진·염소가스 등 12종', vendor: '(주)한국산업보건환경연구원',
              planned: '2025-11-18', done: '2025-11-20', report: true,
              result: '적정', improveReq: '', improveDue: '', improveDone: false,
              beforePhoto: false, afterPhoto: false, owner: '물순환사업소 · 서담당',
              reason: '', expectedDone: '',
              carcinogen: false, targetBasis: '현업 종사자 · 유해인자 노출(정수처리 약품동)',
              history: [
                { at: '2025-11-20', actor: '(주)한국산업보건환경연구원', event: '측정 실시 완료' },
                { at: '2025-12-05', actor: '서담당', event: '결과보고서 접수 · 결과 「적정」' }
              ] }
        ];

        /* 건강검진 — 일반건강검진(연1회 전 직원)·특수건강진단(반기, 유해인자 노출자).
           개인별 상세(persons)는 권한 사용자만 열람(개인정보 보호). */
        var health = [
            { id: 'HC-2026-01', year: 2026, type: '일반건강검진', dept: '건설과',
              agency: '담양군보건소', planned: '2026-04-10', done: '2026-04-15',
              targetCount: 24, examinedCount: 22, evidence: true,
              followupNeeded: true, followupDone: false,
              followupPlan: '유소견자 1명 2차 정밀검사 안내 · 고혈압 관리대상 3명 보건상담',
              followupResult: '', owner: '건설과 · 박현장', reason: '', extraExamDate: '',
              carcinogen: false, targetBasis: '일반건강검진(상시근로자 대상)',
              persons: [
                { name: '이건설', position: '건설과장', team: '부서장', examined: '2026-04-15', result: '정상' },
                { name: '박현장', position: '주무관', team: '안전관리팀', examined: '2026-04-15', result: '경계(고혈압)' },
                { name: '김도현', position: '주무관', team: '안전관리팀', examined: '2026-04-12', result: '정상' },
                { name: '이준호', position: '주무관', team: '도로관리팀', examined: '', result: '미검진' },
                { name: '박서준', position: '주무관', team: '시설관리팀', examined: '2026-04-15', result: '유소견(2차 필요)' }
              ],
              history: [
                { at: '2026-03-20', actor: '박현장', event: '검진 계획 수립 · 담양군보건소 위탁' },
                { at: '2026-04-15', actor: '담양군보건소', event: '단체검진 실시(수검 22/24)' },
                { at: '2026-04-30', actor: '박현장', event: '실시 증빙 등록 · 사후관리 대상 확인(유소견 1)' }
              ] },
            { id: 'HC-2026-02', year: 2026, type: '일반건강검진', dept: '환경과',
              agency: '국민건강보험공단(지정검진기관)', planned: '2026-03-18', done: '2026-03-22',
              targetCount: 18, examinedCount: 18, evidence: true,
              followupNeeded: false, followupDone: false, followupPlan: '', followupResult: '',
              owner: '환경과 · 최보건', reason: '', extraExamDate: '', persons: [],
              carcinogen: false, targetBasis: '일반건강검진(상시근로자 대상)',
              history: [
                { at: '2026-02-25', actor: '최보건', event: '검진 계획 수립' },
                { at: '2026-03-22', actor: '지정검진기관', event: '검진 실시(수검 18/18)' },
                { at: '2026-04-05', actor: '최보건', event: '실시 증빙 등록 · 사후관리 대상 없음' }
              ] },
            { id: 'HC-2026-03', year: 2026, type: '특수건강진단', dept: '물순환사업소',
              agency: '(주)녹십자헬스케어 특수검진센터', planned: '2026-05-10', done: '2026-05-14',
              targetCount: 12, examinedCount: 9, evidence: true,
              followupNeeded: true, followupDone: false,
              followupPlan: '염소·소음 노출 유소견자 2명 업무전환 검토 · 미수검 3명 추가검진',
              followupResult: '', owner: '물순환사업소 · 서담당', reason: '교대근무자 3명 일정 미조정',
              extraExamDate: '2026-08-05', persons: [],
              carcinogen: false, targetBasis: '특수건강진단 대상(염소·소음 노출자)',
              history: [
                { at: '2026-04-15', actor: '서담당', event: '특수검진 대상자 선정(염소·소음 노출 12명)' },
                { at: '2026-05-14', actor: '(주)녹십자헬스케어', event: '특수검진 실시(수검 9/12)' },
                { at: '2026-05-28', actor: '서담당', event: '미수검 3명 추가검진 2026-08-05 예정 등록' }
              ] },
            { id: 'HC-2026-04', year: 2026, type: '특수건강진단', dept: '공공시설사업소',
              agency: '(주)녹십자헬스케어 특수검진센터', planned: '2026-06-05', done: '',
              targetCount: 15, examinedCount: 0, evidence: false,
              followupNeeded: false, followupDone: false, followupPlan: '', followupResult: '',
              owner: '공공시설사업소 · 한담당',
              reason: '위탁 검진기관 예약 지연 — 재예약 진행 중', extraExamDate: '',
              persons: [],
              carcinogen: false, targetBasis: '특수건강진단 대상(유해인자 노출자)',
              history: [
                { at: '2026-05-01', actor: '한담당', event: '특수검진 대상자 선정(15명) · 예정일 2026-06-05' },
                { at: '2026-06-08', actor: '한담당', event: '미실시 사유 등록(검진기관 예약 지연)' }
              ] },
            { id: 'HC-2026-05', year: 2026, type: '일반건강검진', dept: '문화체육과',
              agency: '국민건강보험공단(지정검진기관)', planned: '2026-07-30', done: '',
              targetCount: 9, examinedCount: 0, evidence: false,   /* 미실시(예정 미래) → 수검 0 (done=''↔examinedCount=0 불변식) */
              followupNeeded: false, followupDone: false, followupPlan: '', followupResult: '',
              owner: '문화체육과 · 오세영', reason: '', extraExamDate: '', persons: [],
              carcinogen: false, targetBasis: '일반건강검진(상시근로자 대상)',
              history: [
                { at: '2026-06-25', actor: '오세영', event: '검진 계획 수립 · 개인별 검진 안내(예정일 2026-07-30)' }
              ] },
            { id: 'HC-2026-06', year: 2026, type: '특수건강진단', dept: '건설과',
              agency: '(주)녹십자헬스케어 특수검진센터', planned: '2026-05-25', done: '2026-05-28',
              targetCount: 8, examinedCount: 8, evidence: true,
              followupNeeded: false, followupDone: false, followupPlan: '', followupResult: '',
              owner: '건설과 · 박현장', reason: '', extraExamDate: '', persons: [],
              carcinogen: true, targetBasis: '특수건강진단 대상(발암성 분진 노출자)',
              history: [
                { at: '2026-04-30', actor: '박현장', event: '특수검진 대상자 선정(분진·소음 노출 8명)' },
                { at: '2026-05-28', actor: '(주)녹십자헬스케어', event: '특수검진 실시(수검 8/8) · 사후관리 대상 없음' },
                { at: '2026-06-05', actor: '박현장', event: '실시 증빙 등록' }
              ] },
            /* 전년도(2025) — 연도 필터 시연용 */
            { id: 'HC-2025-01', year: 2025, type: '일반건강검진', dept: '건설과',
              agency: '담양군보건소', planned: '2025-04-12', done: '2025-04-16',
              targetCount: 22, examinedCount: 21, evidence: true,
              followupNeeded: false, followupDone: true, followupPlan: '유소견 1명 2차검사 완료',
              followupResult: '2차검사 정상 종결', owner: '건설과 · 박현장', reason: '', extraExamDate: '',
              carcinogen: false, targetBasis: '일반건강검진(상시근로자 대상)',
              persons: [], history: [
                { at: '2025-04-16', actor: '담양군보건소', event: '단체검진 실시(수검 21/22)' },
                { at: '2025-06-10', actor: '박현장', event: '사후관리 완료(2차검사 정상)' }
              ] }
        ];

        /* ── 절차 진행형 데모 시드 — 주관부서(재난안전과)↔담당부서 결과제출 핸드오프 상태 예시 ──
           procStep: 대상자선정(1) → 문진표발송(2) → 결과업로드=evidence(3) → 알림(4)
           resultBy/resultAt: 결과 문서를 올린 주체·일자(담당부서 제출 vs 주관부서 대행) */
        var names = function (arr) { return arr.map(function (n) { return { name: n }; }); };
        var procSeed = {
            /* 건설과 — 요청·제출·알림까지 완료(4/4). 담당부서 제출함: 제출 완료 */
            'HC-2026-01': { targets: names(['이건설', '박현장', '김도현', '박서준', '이준호']), qSent: true, qSentAt: '2026-04-01', notified: true, notifiedAt: '2026-05-02', resultBy: '담당부서', resultAt: '2026-04-16' },
            /* 환경과 — 완료(4/4) */
            'HC-2026-02': { targets: names(['정환경', '최보건', '김지도', '정수빈']), qSent: true, qSentAt: '2026-03-01', notified: true, notifiedAt: '2026-04-06', resultBy: '담당부서', resultAt: '2026-03-24' },
            /* 물순환사업소 — 결과 제출됨·알림 대기(3/4). 담당부서 제출함: 제출 완료 */
            'HC-2026-03': { targets: names(['서담당', '하정수', '오수질']), qSent: true, qSentAt: '2026-04-20', notified: false, notifiedAt: '', resultBy: '담당부서', resultAt: '2026-05-16' },
            /* 공공시설사업소 — 문진표 발송됨·결과 미제출(2/4). 담당부서 제출함: ★제출 대기(핵심 액션) */
            'HC-2026-04': { targets: names(['한담당', '한운영', '민설비']), qSent: true, qSentAt: '2026-06-20', notified: false, notifiedAt: '' },
            /* 문화체육과 — 문진표 발송됨·결과 미제출(2/4). 담당부서 제출함: 제출 대기 */
            'HC-2026-05': { targets: names(['한지훈', '오세영']), qSent: true, qSentAt: '2026-07-05', notified: false, notifiedAt: '' },
            /* 건설과 특수 — 결과 제출됨·알림 대기(3/4). 담당부서 제출함: 제출 완료 */
            'HC-2026-06': { targets: names(['박현장', '김도현', '박서준']), qSent: true, qSentAt: '2026-05-01', notified: false, notifiedAt: '', resultBy: '담당부서', resultAt: '2026-05-29' }
        };
        health.forEach(function (r) {
            var p = procSeed[r.id]; if (!p) return;
            r.proc = { targets: p.targets, qSent: p.qSent, qSentAt: p.qSentAt, notified: p.notified, notifiedAt: p.notifiedAt };
            if (p.resultBy) { r.resultBy = p.resultBy; r.resultAt = p.resultAt; }
        });

        return { workenv: workenv, health: health, privacy: false, seqWE: 5, seqHC: 6 };
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

    function pushHist(rec, event, actor) {
        (rec.history = rec.history || []).unshift({ at: TODAY, actor: actor || '박안전', event: event });
    }

    function halfOf(planned) { return (planned && Number(planned.slice(5, 7)) >= 7) ? 'H2' : 'H1'; }
    function yearOf(planned) { return planned ? Number(planned.slice(0, 4)) : CURYEAR; }
    function halfLabel(planned) { return halfOf(planned) === 'H2' ? '하반기' : '상반기'; }

    /* ================= 보존연한·법정 제출기한 헬퍼 ================= */
    /* 결과 보존연한 — 발암성/특별관리물질 노출 건은 30년, 그 외 5년 (방어적 기본값: false→5년) */
    function retentionOf(rec) { return rec && rec.carcinogen ? 30 : 5; }
    /* dateStr('YYYY-MM-DD')에 n일을 더한 날짜 문자열 반환 */
    function addDays(dateStr, n) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        d.setUTCDate(d.getUTCDate() + Number(n || 0));   // 'YYYY-MM-DD'는 UTC 자정 파싱 → UTC 접근자로 통일(시간대 하루 어긋남 방지)
        var y = d.getUTCFullYear();
        var m = String(d.getUTCMonth() + 1).padStart(2, '0');
        var day = String(d.getUTCDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
    }
    /* 법정 제출기한 — we: 노출기준 초과 시 측정일부터 60일 / hc: 유소견자 조치결과 30일 */
    function legalSubmitDue(kind, rec) {
        if (!rec) return null;
        if (kind === 'we') {
            if (rec.result === '개선 필요' && !rec.improveDone && rec.done) {
                return { label: '개선증빙 제출기한', date: addDays(rec.done, 60) };
            }
            return null;
        }
        if (kind === 'hc') {
            if (rec.followupNeeded && !rec.followupDone && rec.done) {
                return { label: '조치결과 제출기한', date: addDays(rec.done, 30) };
            }
            return null;
        }
        return null;
    }

    /* ================= 작업환경측정 ================= */
    function workEnv() { return load().workenv; }
    function addWorkEnv(o) {
        var d = load(); d.seqWE++; o = o || {};
        var rec = { id: 'WE-' + yearOf(o.planned) + '-N' + d.seqWE, year: yearOf(o.planned), half: halfOf(o.planned),
            dept: o.dept || '', site: o.site || o.dept || '', subject: o.subject || '', vendor: o.vendor || '미지정',
            planned: o.planned || '', done: '', report: false, result: null, improveReq: '', improveDue: '',
            improveDone: false, beforePhoto: false, afterPhoto: false, owner: (o.dept || '') + ' · 담당자',
            reason: '', expectedDone: '', carcinogen: !!o.carcinogen,
            targetBasis: o.targetBasis || '현업 종사자 · 유해인자 노출(' + (o.dept || '해당 부서') + ')',
            history: [{ at: TODAY, actor: '박안전', event: '측정 계획 등록 (예정일 ' + (o.planned || '-') + ')' }] };
        d.workenv.push(rec); save(); return rec;
    }
    function workEnvOf(id) { var a = workEnv(); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }

    /* 공용 상태 산출 — 완료/미완료/보완 필요/기한 초과 */
    function effWorkEnv(r) {
        if (!r.done) {
            return isPast(r.planned) ? STATUS.OVERDUE : STATUS.PENDING;
        }
        if (r.result === '개선 필요' && !r.improveDone) {
            return isPast(r.improveDue) ? STATUS.OVERDUE : STATUS.SUPPLEMENT;
        }
        return STATUS.DONE;
    }
    function weMeasured(r) { return !!r.done; }
    function weNeedsImprove(r) { return r.result === '개선 필요' && !r.improveDone; }

    /* 요약 집계 (필터된 목록 기준) */
    function workEnvSummary(rows) {
        rows = rows || workEnv();
        var s = { total: rows.length, measured: 0, unmeasured: 0, improve: 0, overdue: 0 };
        rows.forEach(function (r) {
            if (weMeasured(r)) s.measured++; else s.unmeasured++;
            if (weNeedsImprove(r)) s.improve++;
            if (effWorkEnv(r).key === 'OVERDUE') s.overdue++;
        });
        return s;
    }

    /* 인력평가 연계 지표 — 부서 스코프(당해연도) */
    function workEnvLink(dept) {
        var rows = workEnv().filter(function (r) { return r.year === CURYEAR && (!dept || r.dept === dept); });
        var s = workEnvSummary(rows);
        s.rate = s.total ? Math.round(s.measured / s.total * 100) : null;
        s.done = 0;
        rows.forEach(function (r) { if (effWorkEnv(r).key === 'DONE') s.done++; });
        s.completeRate = s.total ? Math.round(s.done / s.total * 100) : null;
        return s;
    }

    /* ================= 건강검진 ================= */
    function health() { return load().health; }
    function addHealth(o) {
        var d = load(); d.seqHC++; o = o || {};
        var rec = { id: 'HC-' + yearOf(o.planned) + '-N' + d.seqHC, year: yearOf(o.planned), type: o.type || '일반건강검진',
            dept: o.dept || '', agency: o.agency || '미지정', planned: o.planned || '', done: '',
            targetCount: o.targetCount || 0, examinedCount: 0, evidence: false, followupNeeded: false, followupDone: false,
            followupPlan: '', followupResult: '', owner: (o.dept || '') + ' · 담당자', reason: '', extraExamDate: '',
            carcinogen: !!o.carcinogen,
            targetBasis: o.targetBasis || ((o.type || '일반건강검진') === '특수건강진단' ? '특수건강진단 대상(유해인자 노출자)' : '일반건강검진(상시근로자 대상)'),
            persons: [], history: [{ at: TODAY, actor: '박안전', event: (o.type || '일반건강검진') + ' 계획 등록 (예정일 ' + (o.planned || '-') + ')' }] };
        d.health.push(rec); save(); return rec;
    }
    function healthOf(id) { var a = health(); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }

    function effHealth(r) {
        if (!r.done) {
            return isPast(r.planned) ? STATUS.OVERDUE : STATUS.PENDING;
        }
        var unexamined = Math.max(0, (r.targetCount || 0) - (r.examinedCount || 0));
        if (unexamined > 0) {
            return isPast(r.extraExamDate) && r.extraExamDate ? STATUS.OVERDUE : STATUS.SUPPLEMENT;
        }
        if (r.followupNeeded && !r.followupDone) {
            /* 유소견자 조치결과 30일 제출기한 초과 시 '기한 초과'(작업환경측정 개선기한과 대칭) */
            var fdue = r.done ? addDays(r.done, 30) : '';
            return (fdue && isPast(fdue)) ? STATUS.OVERDUE : STATUS.SUPPLEMENT;
        }
        return STATUS.DONE;
    }
    function hcUnexamined(r) { return Math.max(0, (r.targetCount || 0) - (r.examinedCount || 0)); }
    function hcFollowup(r) { return !!r.followupNeeded && !r.followupDone; }

    /* ── 절차 진행형(3번째 탭): 대상자 선정 → 문진표 발송 → 결과 업로드 → 알림 발송 ── */
    var PROC_STEPS = ['대상자 선정', '문진표 발송', '결과 업로드', '알림 발송'];
    function ensureProc(r) {
        if (!r.proc) r.proc = { targets: [], qSent: false, qSentAt: '', notified: false, notifiedAt: '' };
        return r.proc;
    }
    /* 완료된 연속 단계 수(0~4) — 3단계(결과 업로드)는 proc 전용 마커 resultBy 로 판정
       (단순/상세뷰 실시증빙 evidence·검진완료가 절차뷰 단계를 오염시키지 않도록 분리) */
    function procStep(r) {
        var p = r.proc || {};
        var n = 0;
        if (p.targets && p.targets.length) n = 1; else return 0;
        if (p.qSent) n = 2; else return 1;
        if (r.resultBy) n = 3; else return 2;
        if (p.notified) n = 4; else return 3;
        return n;
    }
    function setProcTargets(id, arr) {
        var r = healthOf(id); if (!r) return null;
        ensureProc(r).targets = (arr || []).slice();
        pushHist(r, '대상자 ' + r.proc.targets.length + '명 선정');
        save(); return r;
    }
    function sendQuestionnaire(id) {
        var r = healthOf(id); if (!r) return null;
        var p = ensureProc(r);
        p.qSent = true; p.qSentAt = TODAY;
        pushHist(r, '문진표 발송 → 대상자 ' + p.targets.length + '명 (새올 포틀릿)');
        save(); return r;
    }
    function procNotify(id, to) {
        var r = healthOf(id); if (!r) return null;
        ensureProc(r).notified = true; r.proc.notifiedAt = TODAY;
        pushHist(r, '결과 알림 발송 → ' + (to || (r.dept + ' 대상자')) + ' (새올 포틀릿)', '시스템');
        save(); return r;
    }
    /* 결과 문서 업로드(제출) — 담당부서 제출 / 주관부서 대행 구분 기록.
       resultBy 는 '결과 제출'만의 전용 마커(단순/상세뷰 실시증빙 evidence 와 분리).
       간소 모델: 결과 문서 제출 = 검진 완료 → 완료 축(done·examinedCount)도 함께 반영해
       상태(effHealth)·수검률·인력평가 연계 지표가 제출을 반영하도록 한다(뷰 간 모순 제거). */
    function submitResult(id, by, actor) {
        var r = healthOf(id); if (!r) return null;
        ensureProc(r);
        r.evidence = true;
        r.resultBy = by || '담당부서';
        r.resultAt = TODAY;
        if (!r.done) r.done = r.resultAt;
        if (!r.examinedCount) r.examinedCount = r.targetCount || 0;
        pushHist(r, '검진 결과 문서 업로드 (' + r.resultBy + ')', actor || (by === '담당부서' ? r.dept : '박안전'));
        save(); return r;
    }
    /* 담당부서 결과제출함 — 절차가 시작(문진표 발송)되어 결과 제출이 요청된 건 */
    function deptInbox(dept) {
        return health().filter(function (r) { return r.dept === dept && r.proc && r.proc.qSent; });
    }
    function deptInboxSummary(dept) {
        var rows = deptInbox(dept);
        var s = { total: rows.length, done: 0, pending: 0 };
        rows.forEach(function (r) { if (r.resultBy) s.done++; else s.pending++; });
        return s;
    }
    /* 결과 제출이 요청된 부서 목록(중복 제거, 조직도 순) — 담당부서 드롭다운 소스 */
    function inboxDepts() {
        var seen = {}, out = [];
        health().forEach(function (r) { if (r.proc && r.proc.qSent && !seen[r.dept]) { seen[r.dept] = 1; out.push(r.dept); } });
        return out;
    }

    function healthSummary(rows) {
        rows = rows || health();
        var s = { rows: rows.length, target: 0, examined: 0, unexamined: 0, followup: 0, overdue: 0 };
        rows.forEach(function (r) {
            s.target += (r.targetCount || 0);
            s.examined += (r.examinedCount || 0);
            s.unexamined += hcUnexamined(r);
            if (hcFollowup(r)) s.followup++;
            if (effHealth(r).key === 'OVERDUE') s.overdue++;
        });
        return s;
    }

    /* 인력평가 연계 지표 — 부서 스코프(당해연도) */
    function healthLink(dept) {
        var rows = health().filter(function (r) { return r.year === CURYEAR && (!dept || r.dept === dept); });
        var s = healthSummary(rows);
        s.rate = s.target ? Math.round(s.examined / s.target * 100) : null;
        return s;
    }

    /* ================= 공용 처리 액션(양 모듈 공유) ================= */
    /* 증빙/결과보고서 등록 */
    function attachEvidence(kind, id, label) {
        var r = (kind === 'we') ? workEnvOf(id) : healthOf(id);
        if (!r) return null;
        if (kind === 'we') r.report = true; else r.evidence = true;
        pushHist(r, (label || '증빙파일') + ' 등록');
        save(); return r;
    }
    /* 미완료(미실시) 사유 입력 */
    function setReason(kind, id, reason, expectedDone) {
        var r = (kind === 'we') ? workEnvOf(id) : healthOf(id);
        if (!r) return null;
        r.reason = reason || '';
        if (kind === 'we' && expectedDone != null) r.expectedDone = expectedDone;
        if (kind === 'hc' && expectedDone != null) r.extraExamDate = expectedDone;
        pushHist(r, '미완료 사유 등록' + (expectedDone ? ' · 예상완료일 ' + expectedDone : ''));
        save(); return r;
    }
    /* 기한 재설정 (작업환경=개선기한/예정일, 건강=예정일/추가검진일) */
    function resetDue(kind, id, field, value) {
        var r = (kind === 'we') ? workEnvOf(id) : healthOf(id);
        if (!r) return null;
        var old = r[field] || '-';
        r[field] = value;
        pushHist(r, '기한 재설정 (' + field + ') ' + old + ' → ' + value);
        save(); return r;
    }
    /* 알림 발송 (프로토타입 — 이력 기록) */
    function notify(kind, id, to) {
        var r = (kind === 'we') ? workEnvOf(id) : healthOf(id);
        if (!r) return null;
        pushHist(r, '알림 발송 → ' + (to || r.owner), '시스템');
        save(); return r;
    }
    /* 완료 처리 — 작업환경: 측정 실시 확정 or 개선조치 완료 / 건강: 검진 완료 or 사후관리 완료 */
    function completeWorkEnv(id, opts) {
        var r = workEnvOf(id); if (!r) return null;
        opts = opts || {};
        if (!r.done) {
            r.done = opts.doneDate || TODAY;
            r.result = opts.result || '적정';
            r.report = true;
            if (r.result === '개선 필요') { r.improveReq = opts.improveReq || r.improveReq; r.improveDue = opts.improveDue || r.improveDue; }
            pushHist(r, '측정 실시 완료 · 결과 「' + r.result + '」');
        } else if (weNeedsImprove(r)) {
            r.improveDone = true; r.afterPhoto = true;
            pushHist(r, '개선조치 완료 · 조치 후 사진 등록');
        }
        save(); return r;
    }
    function completeHealth(id, opts) {
        var r = healthOf(id); if (!r) return null;
        opts = opts || {};
        if (!r.done) {
            r.done = opts.doneDate || TODAY;
            if (opts.examinedCount != null) r.examinedCount = Math.min(r.targetCount || 0, opts.examinedCount);   // 수검자 ≤ 대상자 상한
            r.evidence = true;
            pushHist(r, '검진 실시 완료 (수검 ' + r.examinedCount + '/' + r.targetCount + ')');
        } else if (hcUnexamined(r) > 0 && opts.examinedCount != null) {
            r.examinedCount = Math.min(r.targetCount, opts.examinedCount);
            pushHist(r, '추가검진 반영 (수검 ' + r.examinedCount + '/' + r.targetCount + ')');
        } else if (hcFollowup(r)) {
            r.followupDone = true;
            r.followupResult = opts.followupResult || r.followupResult || '사후관리 완료';
            pushHist(r, '사후관리 완료 · ' + r.followupResult);
        }
        save(); return r;
    }

    /* ================= 개인정보 열람 권한(데모 토글) ================= */
    function privacyOn() { return !!load().privacy; }
    function togglePrivacy() { var d = load(); d.privacy = !d.privacy; save(); return d.privacy; }

    /* ================= 건강검진 관리 버전(목록·상세 공유) =================
       'simple'(단순 집계·첨부형, 지자체 권장) | 'detail'(상세 관리형, 보건인력 배치 사업장)
       근거: 건강검진 결과=민감정보(개보법 §23·산안법 §132) → 지자체는 집계·증빙 중심이 법·실무상 적합 */
    var HVIEW_KEY = 'damyangHexView';
    function healthView() { try { return global.sessionStorage.getItem(HVIEW_KEY) || 'simple'; } catch (e) { return 'simple'; } }
    function setHealthView(v) { try { global.sessionStorage.setItem(HVIEW_KEY, v); } catch (e) {} return v; }

    /* ================= 절차 진행형 관점(주관부서↔담당부서) =================
       'admin'(주관부서=재난안전과 중대재해팀 · 계획·대상자·문진표·알림 관리) |
       'dept'(담당부서=대상 부서 · 결과 문서 제출) — 데모용 관점 전환(권한 기반 접근제어 시연) */
    var PERSP_KEY = 'damyangHexPersp', PDEPT_KEY = 'damyangHexPerspDept';
    function procRole() { try { return global.sessionStorage.getItem(PERSP_KEY) || 'admin'; } catch (e) { return 'admin'; } }
    function setProcRole(v) { try { global.sessionStorage.setItem(PERSP_KEY, v); } catch (e) {} return v; }
    /* 담당부서 관점의 선택 부서 — 미설정 시 '제출 대기'가 있는 첫 부서, 없으면 요청된 첫 부서 */
    function procDept() {
        var saved; try { saved = global.sessionStorage.getItem(PDEPT_KEY); } catch (e) {}
        var reqDepts = inboxDepts();
        if (saved && reqDepts.indexOf(saved) !== -1) return saved;
        var pending = reqDepts.filter(function (d) { return deptInboxSummary(d).pending > 0; });
        return pending[0] || reqDepts[0] || (health()[0] && health()[0].dept) || '';
    }
    function setProcDept(v) { try { global.sessionStorage.setItem(PDEPT_KEY, v); } catch (e) {} return v; }

    /* ================= 부서 목록(조직도 파생) ================= */
    function depts() {
        var out = [];
        if (global.DYV2 && DYV2.orgWalk) {
            DYV2.orgWalk(function (n) {
                if (n.type === 'dept' || n.type === 'office' || n.type === 'town') out.push(n.name);
            });
        }
        return out;
    }

    var api = {
        TODAY: TODAY, CURYEAR: CURYEAR, STATUS: STATUS, icon: icon,
        daysLeft: daysLeft, isPast: isPast, reset: reset, depts: depts,
        retentionOf: retentionOf, addDays: addDays, legalSubmitDue: legalSubmitDue, halfLabel: halfLabel,
        /* 작업환경측정 */
        workEnv: workEnv, workEnvOf: workEnvOf, addWorkEnv: addWorkEnv, effWorkEnv: effWorkEnv,
        weMeasured: weMeasured, weNeedsImprove: weNeedsImprove,
        workEnvSummary: workEnvSummary, workEnvLink: workEnvLink,
        /* 건강검진 */
        health: health, healthOf: healthOf, addHealth: addHealth, effHealth: effHealth,
        hcUnexamined: hcUnexamined, hcFollowup: hcFollowup,
        healthSummary: healthSummary, healthLink: healthLink,
        /* 절차 진행형 */
        PROC_STEPS: PROC_STEPS, procStep: procStep, setProcTargets: setProcTargets,
        sendQuestionnaire: sendQuestionnaire, procNotify: procNotify, submitResult: submitResult,
        deptInbox: deptInbox, deptInboxSummary: deptInboxSummary, inboxDepts: inboxDepts,
        procRole: procRole, setProcRole: setProcRole, procDept: procDept, setProcDept: setProcDept,
        /* 공용 처리 */
        attachEvidence: attachEvidence, setReason: setReason, resetDue: resetDue,
        notify: notify, completeWorkEnv: completeWorkEnv, completeHealth: completeHealth,
        /* 개인정보 권한 */
        privacyOn: privacyOn, togglePrivacy: togglePrivacy,
        /* 건강검진 관리 버전 */
        healthView: healthView, setHealthView: setHealthView
    };
    global.DYSH = global.DYSH || {};
    Object.keys(api).forEach(function (k) { global.DYSH[k] = api[k]; });
})(window);
