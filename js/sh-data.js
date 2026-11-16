/* =====================================================================
   sh-data.js · 산업보건관리 도메인 데이터·세션 스토어 (DYSH)
   ---------------------------------------------------------------------
   안전보건관리책임자 법정 직무(산안법 §15) 중 위탁용역으로 수행되는
   ① 작업환경측정  ② 건강검진(일반·특수) 의 계획·실시·증빙·후속조치를 관리.
   완료 결과·증빙은 인력평가(안전보건관리책임자 평가) 항목에 자동 연계된다.

   · 백엔드 없는 정적 구성 — sessionStorage 로 화면 간 상태 유지.
   · 공용 상태 모델: 완료 / 미완료 / 보완 필요 / 기한 초과 (effWorkEnv·effHealth)
   · 전역: DYSH.*  (js/common.js 뒤에 로드 — DYV2.ORG 파생 부서 사용)
   ===================================================================== */
(function (global) {
    'use strict';

    /* v5 — 예시 자료를 2026-11-13 기준 운영 상태로 다시 깔았다(2026 상반기 측정·개선 완료 · 하반기 9~10월
            측정, 개선 진행 1건 · 11월 예정 · 이력은 최신이 위). id 를 WE/HC-2026-10 까지 늘렸다.
       v4 — 작업환경측정 시드를 사업장 관리(DYSITE) 식별값에 연결(siteId·마스터 이름·판정 상태).
            WE-2026-02(하수처리장)의 소관을 물순환사업소로 바로잡았다.
       v3 — 관리 버전 3종(단순/상세/절차)을 단순 첨부형 하나로 확정하면서
            개인별 결과(persons)·절차 진행 상태(proc)·열람권한(privacy) 시드를 걷어냈다.
       시드 스키마·값이 바뀌면 키를 올린다 — 안 올리면 옛 브라우저의 스토어가 살아남아
       화면과 시드가 조용히 갈린다. */
    /* v6 — 결과 안내 공문(weDocs)·노출기준 초과(exceed)·노동관서 제출일·결과보고서 파일 이름(reportFiles)·
            등록 주체(regBy)를 더했다(기획-작업환경측정-첨부·공문흐름-20261116-v2). */
    /* v7 — 건강검진도 결과 안내 공문(hcDocs)·결과보고서 파일 이름(reportFiles)·등록 주체(regBy)를 더했다
            (작업환경측정과 같은 «결과 등록 → 결과 안내 공문» 2단계, 2026-11-16). */
    var SKEY = 'damyangShV7';
    /* 기준일·기준연도 — DYV2.today() 단일 출처 (시연일 변경은 common.js DEMO_TODAY 한 줄) */
    var TODAY = (global.DYV2 && global.DYV2.today) ? global.DYV2.today() : '2026-11-13';
    var CURYEAR = Number(TODAY.slice(0, 4));

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
        /* 작업환경측정 — 사업장은 사업장 관리(DYSITE)의 식별값(siteId)으로 참조한다.
           이름(site)·판정 상태는 계획 생성 시점 스냅샷이라 함께 보존한다(SCR-WEM-001 §4-2).
           구체 작업 위치(약품동·탈수기실·기계실)는 targetBasis 가 갖는다.
           siteId 가 없으면 중복 계획 검사와 사업장 사용중 판정이 이름 대조로 떨어져
           마스터와 한 글자만 달라도 조용히 어긋난다. */
        /* 이력(history)은 **최신이 위**다 — 화면 처리(pushHist)가 unshift 로 쌓으므로 시드도 같은 순서로 둔다.
           예시 자료 기간: 2025 상·하반기(지난 기록) → 2026 상반기(측정·개선 완료) → 2026 하반기(9~10월 측정,
           개선 진행 1건 · 11월 예정 2건). 담당자는 조직도(DYV2.ORG) 실인물만 쓴다. */
        var workenv = [
            /* ── 2026 상반기 ── */
            { id: 'WE-2026-01', year: 2026, half: 'H1', dept: '물순환사업소',
              siteId: 'S01', site: '담양정수장', siteTargetState: '검토 중',
              subject: '소음·분진·염소가스 등 12종', vendor: '(주)한국산업보건환경연구원',
              planned: '2026-05-20', done: '2026-05-22', report: true,
              result: '적정', improveReq: '', improveDue: '', improveDone: false,
              beforePhoto: false, afterPhoto: false, owner: '물순환사업소 · 서담당',
              reason: '', expectedDone: '',
              carcinogen: false, targetBasis: '현업 종사자 · 유해인자 노출(정수처리 약품동)',
              history: [
                { at: '2026-06-10', actor: '서담당', event: '결과보고서 접수 · 결과 「적정」 확인' },
                { at: '2026-05-22', actor: '(주)한국산업보건환경연구원', event: '측정 실시 완료' },
                { at: '2026-04-30', actor: '서담당', event: '측정 계획 수립 · 위탁계약 체결' }
              ] },
            { id: 'WE-2026-02', year: 2026, half: 'H1', dept: '물순환사업소',
              siteId: 'S02', site: '담양하수처리장', siteTargetState: '검토 중',
              subject: '황화수소·분진·소음 등 9종', vendor: '(주)그린환경보건원',
              planned: '2026-05-18', done: '2026-05-25', report: true,
              result: '개선 필요', improveReq: '탈수기실 국소배기장치 성능 저하 — 후드 풍속 기준 미달, 배기설비 보수 및 재측정 필요',
              improveDue: '2026-07-24', improveDone: true,
              improveDoneAt: '2026-07-17', improveResult: '탈수기실 후드 교체·배기덕트 보수 후 재측정 — 후드 풍속 기준 충족',
              beforePhoto: true, afterPhoto: true, owner: '물순환사업소 · 서담당',
              reason: '', expectedDone: '',
              carcinogen: false, targetBasis: '현업 종사자 · 유해인자 노출(하수처리 탈수기실)',
              history: [
                { at: '2026-07-17', actor: '서담당', event: '개선조치 완료 · 탈수기실 후드 교체·배기덕트 보수 후 재측정 기준 충족 · 조치 후 증빙 등록' },
                { at: '2026-07-02', actor: '서담당', event: '국소배기장치 보수 착공(후드·덕트)' },
                { at: '2026-06-05', actor: '서담당', event: '결과보고서 접수 · 결과 「개선 필요」 · 개선기한 2026-07-24 설정' },
                { at: '2026-05-25', actor: '(주)그린환경보건원', event: '측정 실시 완료' },
                { at: '2026-04-28', actor: '서담당', event: '측정 계획 수립 · 위탁계약 체결' }
              ] },
            { id: 'WE-2026-03', year: 2026, half: 'H1', dept: '환경과',
              siteId: 'S07', site: '자원순환센터(재활용선별)', siteTargetState: '검토 중',
              subject: '분진·악취·중금속 등 8종', vendor: '(주)한국산업보건환경연구원',
              planned: '2026-06-16', done: '2026-06-18', report: true,
              result: '적정', improveReq: '', improveDue: '', improveDone: false,
              beforePhoto: false, afterPhoto: false, owner: '환경과 · 정환경',
              reason: '', expectedDone: '',
              carcinogen: true, targetBasis: '현업 종사자 · 발암성 유해인자(결정질 실리카 분진) 노출',
              history: [
                { at: '2026-07-03', actor: '정환경', event: '결과보고서 접수 · 결과 「적정」(분진 노출기준 근접 — 하반기 재확인)' },
                { at: '2026-06-18', actor: '(주)한국산업보건환경연구원', event: '측정 실시 완료' },
                { at: '2026-05-20', actor: '정환경', event: '측정 계획 수립 · 위탁계약 체결(예정일 2026-06-16)' }
              ] },
            { id: 'WE-2026-04', year: 2026, half: 'H1', dept: '건설과',
              siteId: 'S09', site: '도로보수 작업현장(직영보수반)', siteTargetState: '검토 중',
              subject: '소음·진동·분진 등 6종', vendor: '(주)그린환경보건원',
              planned: '2026-06-05', done: '2026-06-26', report: true,
              result: '적정', improveReq: '', improveDue: '', improveDone: false,
              beforePhoto: false, afterPhoto: false, owner: '건설과 · 박현장',
              reason: '위탁업체 일정 지연 및 현장 우천으로 예정일 내 미실시',
              expectedDone: '2026-06-30',
              carcinogen: false, targetBasis: '현업 종사자 · 유해인자 노출(도로보수 현장)',
              history: [
                { at: '2026-07-10', actor: '박현장', event: '결과보고서 접수 · 결과 「적정」 확인' },
                { at: '2026-06-26', actor: '(주)그린환경보건원', event: '측정 실시 완료' },
                { at: '2026-06-08', actor: '박현장', event: '미완료 사유 등록 · 예상완료일 2026-06-30' },
                { at: '2026-05-10', actor: '박현장', event: '측정 계획 수립 · 위탁계약 체결(예정일 2026-06-05)' }
              ] },
            { id: 'WE-2026-05', year: 2026, half: 'H1', dept: '공공시설사업소',
              siteId: 'S04', site: '담양국민체육센터(실내수영장)', siteTargetState: '검토 중',
              subject: '염소가스·습도·소음 등 5종', vendor: '(주)한국산업보건환경연구원',
              planned: '2026-06-10', done: '2026-06-12', report: true,
              result: '개선 필요', improveReq: '염소가스 농도 노출기준 초과 — 자동염소주입기 밀폐 및 배기 개선 필요',
              improveDue: '2026-08-10', improveDone: true, exceed: true, laborSubmittedAt: '2026-08-05',
              improveDoneAt: '2026-07-29', improveResult: '기계실 자동염소주입기 밀폐커버 설치·배기팬 증설 후 재측정 — 노출기준 이내',
              beforePhoto: true, afterPhoto: true, owner: '공공시설사업소 · 한담당',
              reason: '', expectedDone: '',
              carcinogen: false, targetBasis: '현업 종사자 · 유해인자 노출(실내수영장 염소가스)',
              history: [
                { at: '2026-07-29', actor: '한담당', event: '개선조치 완료 · 염소주입기 밀폐커버 설치·배기팬 증설 후 재측정 노출기준 이내 · 조치 후 증빙 등록' },
                { at: '2026-06-18', actor: '한담당', event: '결과보고서 접수 · 결과 「개선 필요」 · 개선기한 2026-08-10 설정' },
                { at: '2026-06-12', actor: '(주)한국산업보건환경연구원', event: '측정 실시 완료' },
                { at: '2026-05-15', actor: '한담당', event: '측정 계획 수립 · 위탁계약 체결' }
              ] },
            /* ── 2026 하반기 ── */
            { id: 'WE-2026-06', year: 2026, half: 'H2', dept: '물순환사업소',
              siteId: 'S01', site: '담양정수장', siteTargetState: '검토 중',
              subject: '소음·분진·염소가스 등 12종', vendor: '(주)한국산업보건환경연구원',
              planned: '2026-09-15', done: '2026-09-16', report: true,
              result: '적정', improveReq: '', improveDue: '', improveDone: false,
              beforePhoto: false, afterPhoto: false, owner: '물순환사업소 · 서담당',
              reason: '', expectedDone: '',
              carcinogen: false, targetBasis: '현업 종사자 · 유해인자 노출(정수처리 약품동)',
              history: [
                { at: '2026-10-02', actor: '서담당', event: '결과보고서 접수 · 결과 「적정」 확인' },
                { at: '2026-09-16', actor: '(주)한국산업보건환경연구원', event: '측정 실시 완료' },
                { at: '2026-08-20', actor: '서담당', event: '측정 계획 수립 · 위탁계약 체결(예정일 2026-09-15)' }
              ] },
            { id: 'WE-2026-07', year: 2026, half: 'H2', dept: '물순환사업소',
              siteId: 'S02', site: '담양하수처리장', siteTargetState: '검토 중',
              subject: '황화수소·분진·소음 등 9종', vendor: '(주)그린환경보건원',
              planned: '2026-09-22', done: '2026-09-23', report: true,
              result: '적정', improveReq: '', improveDue: '', improveDone: false,
              beforePhoto: false, afterPhoto: false, owner: '물순환사업소 · 서담당',
              reason: '', expectedDone: '',
              carcinogen: false, targetBasis: '현업 종사자 · 유해인자 노출(하수처리 탈수기실)',
              history: [
                { at: '2026-10-08', actor: '서담당', event: '결과보고서 접수 · 결과 「적정」(상반기 개선 후 탈수기실 기준 충족 유지)' },
                { at: '2026-09-23', actor: '(주)그린환경보건원', event: '측정 실시 완료' },
                { at: '2026-08-21', actor: '서담당', event: '측정 계획 수립 · 위탁계약 체결(예정일 2026-09-22)' }
              ] },
            { id: 'WE-2026-08', year: 2026, half: 'H2', dept: '환경과',
              siteId: 'S07', site: '자원순환센터(재활용선별)', siteTargetState: '검토 중',
              subject: '분진·악취·중금속 등 8종', vendor: '(주)한국산업보건환경연구원',
              planned: '2026-10-13', done: '2026-10-14', report: true,
              result: '개선 필요', improveReq: '선별라인 투입구 분진(결정질 실리카) 노출기준 초과 — 집진기 필터 교체 및 투입구 국소배기 보강 필요',
              improveDue: '2026-12-11', improveDone: false, exceed: true,
              beforePhoto: true, afterPhoto: false, owner: '환경과 · 정환경',
              reason: '', expectedDone: '',
              carcinogen: true, targetBasis: '현업 종사자 · 발암성 유해인자(결정질 실리카 분진) 노출',
              history: [
                { at: '2026-11-09', actor: '정환경', event: '집진기 필터 교체 완료 · 투입구 국소배기 보강 공사 발주(11월 말 준공 예정)' },
                { at: '2026-10-28', actor: '정환경', event: '결과보고서 접수 · 결과 「개선 필요」 · 개선기한 2026-12-11 설정 · 조치 전 사진 등록' },
                { at: '2026-10-14', actor: '(주)한국산업보건환경연구원', event: '측정 실시 완료' },
                { at: '2026-09-10', actor: '정환경', event: '측정 계획 수립 · 위탁계약 체결(예정일 2026-10-13)' }
              ] },
            { id: 'WE-2026-09', year: 2026, half: 'H2', dept: '공공시설사업소',
              siteId: 'S04', site: '담양국민체육센터(실내수영장)', siteTargetState: '검토 중',
              subject: '염소가스·습도·소음 등 5종', vendor: '(주)한국산업보건환경연구원',
              planned: '2026-11-18', done: '', report: false,
              result: null, improveReq: '', improveDue: '', improveDone: false,
              beforePhoto: false, afterPhoto: false, owner: '공공시설사업소 · 한담당',
              reason: '', expectedDone: '',
              carcinogen: false, targetBasis: '현업 종사자 · 유해인자 노출(실내수영장 염소가스)',
              history: [
                { at: '2026-10-21', actor: '한담당', event: '측정 계획 수립 · 위탁계약 체결(예정일 2026-11-18 — 수영장 정기휴관일)' }
              ] },
            { id: 'WE-2026-10', year: 2026, half: 'H2', dept: '건설과',
              siteId: 'S09', site: '도로보수 작업현장(직영보수반)', siteTargetState: '검토 중',
              subject: '소음·진동·분진 등 6종', vendor: '(주)그린환경보건원',
              planned: '2026-11-25', done: '', report: false,
              result: null, improveReq: '', improveDue: '', improveDone: false,
              beforePhoto: false, afterPhoto: false, owner: '건설과 · 박현장',
              reason: '', expectedDone: '',
              carcinogen: false, targetBasis: '현업 종사자 · 유해인자 노출(도로보수 현장)',
              history: [
                { at: '2026-11-02', actor: '박현장', event: '측정 계획 수립 · 위탁계약 체결(예정일 2026-11-25)' }
              ] },
            /* ── 2025 (지난 기록) ── */
            { id: 'WE-2025-01', year: 2025, half: 'H2', dept: '물순환사업소',
              siteId: 'S01', site: '담양정수장', siteTargetState: '검토 중',
              subject: '소음·분진·염소가스 등 12종', vendor: '(주)한국산업보건환경연구원',
              planned: '2025-11-18', done: '2025-11-20', report: true,
              result: '적정', improveReq: '', improveDue: '', improveDone: false,
              beforePhoto: false, afterPhoto: false, owner: '물순환사업소 · 서담당',
              reason: '', expectedDone: '',
              carcinogen: false, targetBasis: '현업 종사자 · 유해인자 노출(정수처리 약품동)',
              history: [
                { at: '2025-12-05', actor: '서담당', event: '결과보고서 접수 · 결과 「적정」' },
                { at: '2025-11-20', actor: '(주)한국산업보건환경연구원', event: '측정 실시 완료' }
              ] },
            { id: 'WE-2025-02', year: 2025, half: 'H2', dept: '공공시설사업소',
              siteId: 'S04', site: '담양국민체육센터(실내수영장)', siteTargetState: '검토 중',
              subject: '염소가스·습도·소음 등 5종', vendor: '(주)한국산업보건환경연구원',
              planned: '2025-11-11', done: '2025-11-12', report: true,
              result: '개선 필요', improveReq: '기계실 염소가스 농도 노출기준 근접·환기 부족 — 기계실 급배기 개선 필요',
              improveDue: '2026-01-09', improveDone: true,
              improveDoneAt: '2025-12-30', improveResult: '기계실 급기구 신설·배기팬 교체 — 재측정 노출기준 이내',
              beforePhoto: true, afterPhoto: true, owner: '공공시설사업소 · 한담당',
              reason: '', expectedDone: '',
              carcinogen: false, targetBasis: '현업 종사자 · 유해인자 노출(실내수영장 염소가스)',
              history: [
                { at: '2025-12-30', actor: '한담당', event: '개선조치 완료 · 기계실 급기구 신설·배기팬 교체 · 조치 후 증빙 등록' },
                { at: '2025-11-26', actor: '한담당', event: '결과보고서 접수 · 결과 「개선 필요」 · 개선기한 2026-01-09 설정' },
                { at: '2025-11-12', actor: '(주)한국산업보건환경연구원', event: '측정 실시 완료' }
              ] },
            { id: 'WE-2025-03', year: 2025, half: 'H1', dept: '물순환사업소',
              siteId: 'S02', site: '담양하수처리장', siteTargetState: '검토 중',
              subject: '황화수소·분진·소음 등 9종', vendor: '(주)그린환경보건원',
              planned: '2025-05-21', done: '2025-05-21', report: true,
              result: '적정', improveReq: '', improveDue: '', improveDone: false,
              beforePhoto: false, afterPhoto: false, owner: '물순환사업소 · 서담당',
              reason: '', expectedDone: '',
              carcinogen: false, targetBasis: '현업 종사자 · 유해인자 노출(하수처리 탈수기실)',
              history: [
                { at: '2025-06-09', actor: '서담당', event: '결과보고서 접수 · 결과 「적정」' },
                { at: '2025-05-21', actor: '(주)그린환경보건원', event: '측정 실시 완료' }
              ] }
        ];

        /* 건강검진 — 일반건강검진(연1회 전 직원)·특수건강진단(반기, 유해인자 노출자).
           개인별 검진 결과는 담지 않는다 — 건강진단 결과는 민감정보(개보법 §23·산안법 §132)이고
           사업주가 실제로 받는 법정 문서도 개인 임상기록이 아니라 집계형 결과표다.
           이 스토어가 가진 개인 단위 값은 대상자 수·수검자 수뿐이다. */
        var health = [
            { id: 'HC-2026-01', year: 2026, type: '일반건강검진', dept: '건설과',
              agency: '담양군보건소', planned: '2026-04-10', done: '2026-04-15',
              targetCount: 24, examinedCount: 24, evidence: true,
              followupNeeded: true, followupDone: true, followupResult: '유소견 1명 2차검사 실시 — 정상 종결(2026-05-12)',
              owner: '건설과 · 박현장', reason: '', extraExamDate: '2026-05-08',
              carcinogen: false, targetBasis: '일반건강검진(상시근로자 대상)',
              history: [
                { at: '2026-05-12', actor: '박현장', event: '사후관리 완료 · 유소견 1명 2차검사 정상 종결' },
                { at: '2026-05-08', actor: '박현장', event: '추가검진 반영 (수검 24/24)' },
                { at: '2026-04-30', actor: '박현장', event: '실시 증빙 등록 · 사후관리 대상 확인(유소견 1) · 미수검 2명 추가검진 2026-05-08 예정' },
                { at: '2026-04-15', actor: '담양군보건소', event: '단체검진 실시(수검 22/24)' },
                { at: '2026-03-20', actor: '박현장', event: '검진 계획 수립 · 담양군보건소 위탁' }
              ] },
            { id: 'HC-2026-02', year: 2026, type: '일반건강검진', dept: '환경과',
              agency: '국민건강보험공단(지정검진기관)', planned: '2026-03-18', done: '2026-03-22',
              targetCount: 18, examinedCount: 18, evidence: true,
              followupNeeded: false, followupDone: false, followupResult: '',
              owner: '환경과 · 최보건', reason: '', extraExamDate: '',
              carcinogen: false, targetBasis: '일반건강검진(상시근로자 대상)',
              history: [
                { at: '2026-04-05', actor: '최보건', event: '실시 증빙 등록 · 사후관리 대상 없음' },
                { at: '2026-03-22', actor: '지정검진기관', event: '검진 실시(수검 18/18)' },
                { at: '2026-02-25', actor: '최보건', event: '검진 계획 수립' }
              ] },
            { id: 'HC-2026-03', year: 2026, type: '특수건강진단', dept: '물순환사업소',
              agency: '(주)녹십자헬스케어 특수검진센터', planned: '2026-05-10', done: '2026-05-14',
              targetCount: 12, examinedCount: 12, evidence: true,
              followupNeeded: true, followupDone: true,
              followupResult: '소음성 난청 요관찰 2명 — 청력보호구 지급·청력 재검(8월) 결과 변화 없음, 관찰 유지',
              owner: '물순환사업소 · 서담당', reason: '교대근무자 3명 일정 미조정',
              extraExamDate: '2026-06-03',
              carcinogen: false, targetBasis: '특수건강진단 대상(염소·소음 노출자)',
              history: [
                { at: '2026-08-20', actor: '서담당', event: '사후관리 완료 · 요관찰 2명 청력 재검 결과 변화 없음(관찰 유지)' },
                { at: '2026-06-03', actor: '서담당', event: '추가검진 반영 (수검 12/12)' },
                { at: '2026-05-28', actor: '서담당', event: '미수검 3명 추가검진 2026-06-03 예정 등록 · 실시 증빙 등록' },
                { at: '2026-05-14', actor: '(주)녹십자헬스케어', event: '특수검진 실시(수검 9/12)' },
                { at: '2026-04-15', actor: '서담당', event: '특수검진 대상자 선정(염소·소음 노출 12명)' }
              ] },
            { id: 'HC-2026-04', year: 2026, type: '특수건강진단', dept: '공공시설사업소',
              agency: '(주)녹십자헬스케어 특수검진센터', planned: '2026-06-05', done: '2026-07-08',
              targetCount: 15, examinedCount: 15, evidence: true,
              followupNeeded: true, followupDone: true, followupResult: '염소 노출 유소견 1명 — 직업환경의학 상담·호흡보호구 지급, 8월 재검 정상',
              owner: '공공시설사업소 · 한담당',
              reason: '위탁 검진기관 예약 지연 — 재예약 진행', extraExamDate: '',
              carcinogen: false, targetBasis: '특수건강진단 대상(유해인자 노출자)',
              history: [
                { at: '2026-08-04', actor: '한담당', event: '사후관리 완료 · 유소견 1명 상담·보호구 지급 후 재검 정상' },
                { at: '2026-07-20', actor: '한담당', event: '실시 증빙 등록 · 사후관리 대상 확인(유소견 1)' },
                { at: '2026-07-08', actor: '(주)녹십자헬스케어', event: '특수검진 실시(수검 15/15)' },
                { at: '2026-06-08', actor: '한담당', event: '미완료 사유 등록(검진기관 예약 지연) · 2026-07-08 재예약' },
                { at: '2026-05-01', actor: '한담당', event: '특수검진 대상자 선정(15명) · 예정일 2026-06-05' }
              ] },
            { id: 'HC-2026-05', year: 2026, type: '일반건강검진', dept: '문화체육과',
              agency: '국민건강보험공단(지정검진기관)', planned: '2026-07-30', done: '2026-07-30',
              targetCount: 9, examinedCount: 9, evidence: true,
              followupNeeded: false, followupDone: false, followupResult: '',
              owner: '문화체육과 · 오세영', reason: '', extraExamDate: '',
              carcinogen: false, targetBasis: '일반건강검진(상시근로자 대상)',
              history: [
                { at: '2026-08-12', actor: '오세영', event: '실시 증빙 등록 · 사후관리 대상 없음' },
                { at: '2026-07-30', actor: '지정검진기관', event: '검진 실시(수검 9/9)' },
                { at: '2026-06-25', actor: '오세영', event: '검진 계획 수립 · 개인별 검진 안내(예정일 2026-07-30)' }
              ] },
            { id: 'HC-2026-06', year: 2026, type: '특수건강진단', dept: '건설과',
              agency: '(주)녹십자헬스케어 특수검진센터', planned: '2026-05-25', done: '2026-05-28',
              targetCount: 8, examinedCount: 8, evidence: true,
              followupNeeded: false, followupDone: false, followupResult: '',
              owner: '건설과 · 박현장', reason: '', extraExamDate: '',
              carcinogen: true, targetBasis: '특수건강진단 대상(발암성 분진 노출자)',
              history: [
                { at: '2026-06-05', actor: '박현장', event: '실시 증빙 등록' },
                { at: '2026-05-28', actor: '(주)녹십자헬스케어', event: '특수검진 실시(수검 8/8) · 사후관리 대상 없음' },
                { at: '2026-04-30', actor: '박현장', event: '특수검진 대상자 선정(분진·소음 노출 8명)' }
              ] },
            { id: 'HC-2026-07', year: 2026, type: '일반건강검진', dept: '담양읍',
              agency: '국민건강보험공단(지정검진기관)', planned: '2026-09-09', done: '2026-09-10',
              targetCount: 5, examinedCount: 5, evidence: true,
              followupNeeded: false, followupDone: false, followupResult: '',
              owner: '담양읍 · 배주민', reason: '', extraExamDate: '',
              carcinogen: false, targetBasis: '일반건강검진(상시근로자 대상)',
              history: [
                { at: '2026-09-24', actor: '배주민', event: '실시 증빙 등록 · 사후관리 대상 없음' },
                { at: '2026-09-10', actor: '지정검진기관', event: '검진 실시(수검 5/5)' },
                { at: '2026-08-14', actor: '배주민', event: '검진 계획 수립(예정일 2026-09-09)' }
              ] },
            { id: 'HC-2026-08', year: 2026, type: '일반건강검진', dept: '보건소',
              agency: '담양군보건소', planned: '2026-10-14', done: '2026-10-16',
              targetCount: 11, examinedCount: 10, evidence: true,
              followupNeeded: false, followupDone: false, followupResult: '',
              owner: '보건소 · 윤담당', reason: '1명 병가 중 — 복귀 후 추가검진', extraExamDate: '2026-11-27',
              carcinogen: false, targetBasis: '일반건강검진(상시근로자 대상 · 방역·소독반 포함)',
              history: [
                { at: '2026-10-30', actor: '윤담당', event: '실시 증빙 등록 · 미수검 1명 추가검진 2026-11-27 예정 등록' },
                { at: '2026-10-16', actor: '담양군보건소', event: '단체검진 실시(수검 10/11)' },
                { at: '2026-09-22', actor: '윤담당', event: '검진 계획 수립(예정일 2026-10-14)' }
              ] },
            { id: 'HC-2026-09', year: 2026, type: '특수건강진단', dept: '환경과',
              agency: '(주)녹십자헬스케어 특수검진센터', planned: '2026-10-27', done: '2026-10-29',
              targetCount: 6, examinedCount: 6, evidence: true,
              followupNeeded: true, followupDone: false, followupResult: '',
              owner: '환경과 · 최보건', reason: '', extraExamDate: '',
              carcinogen: true, targetBasis: '특수건강진단 대상(자원순환센터 결정질 실리카 분진 노출자)',
              history: [
                { at: '2026-11-10', actor: '최보건', event: '실시 증빙 등록 · 사후관리 대상 확인(흉부 요관찰 1명) · 2차검사 예약 2026-11-20' },
                { at: '2026-10-29', actor: '(주)녹십자헬스케어', event: '특수검진 실시(수검 6/6)' },
                { at: '2026-10-05', actor: '최보건', event: '특수검진 대상자 선정(선별라인 분진 노출 6명)' }
              ] },
            { id: 'HC-2026-10', year: 2026, type: '일반건강검진', dept: '물순환사업소',
              agency: '국민건강보험공단(지정검진기관)', planned: '2026-11-24', done: '',
              targetCount: 7, examinedCount: 0, evidence: false,   /* 미실시(예정 미래) → 수검 0 (done=''↔examinedCount=0 불변식) */
              followupNeeded: false, followupDone: false, followupResult: '',
              owner: '물순환사업소 · 서담당', reason: '', extraExamDate: '',
              carcinogen: false, targetBasis: '일반건강검진(상시근로자 대상)',
              history: [
                { at: '2026-10-26', actor: '서담당', event: '검진 계획 수립 · 개인별 검진 안내(예정일 2026-11-24)' }
              ] },
            /* ── 2025 (지난 기록) ── */
            { id: 'HC-2025-01', year: 2025, type: '일반건강검진', dept: '건설과',
              agency: '담양군보건소', planned: '2025-04-12', done: '2025-04-16',
              targetCount: 22, examinedCount: 22, evidence: true,
              followupNeeded: true, followupDone: true,
              followupResult: '2차검사 정상 종결', owner: '건설과 · 박현장', reason: '', extraExamDate: '2025-05-07',
              carcinogen: false, targetBasis: '일반건강검진(상시근로자 대상)',
              history: [
                { at: '2025-06-10', actor: '박현장', event: '사후관리 완료(2차검사 정상)' },
                { at: '2025-05-07', actor: '박현장', event: '추가검진 반영 (수검 22/22)' },
                { at: '2025-04-16', actor: '담양군보건소', event: '단체검진 실시(수검 21/22)' }
              ] },
            { id: 'HC-2025-02', year: 2025, type: '특수건강진단', dept: '물순환사업소',
              agency: '(주)녹십자헬스케어 특수검진센터', planned: '2025-05-20', done: '2025-05-22',
              targetCount: 12, examinedCount: 12, evidence: true,
              followupNeeded: true, followupDone: true, followupResult: '소음 요관찰 1명 — 청력보호구 지급·관찰 유지',
              owner: '물순환사업소 · 서담당', reason: '', extraExamDate: '',
              carcinogen: false, targetBasis: '특수건강진단 대상(염소·소음 노출자)',
              history: [
                { at: '2025-06-19', actor: '서담당', event: '사후관리 완료 · 요관찰 1명 청력보호구 지급' },
                { at: '2025-05-22', actor: '(주)녹십자헬스케어', event: '특수검진 실시(수검 12/12)' }
              ] },
            { id: 'HC-2025-03', year: 2025, type: '특수건강진단', dept: '공공시설사업소',
              agency: '(주)녹십자헬스케어 특수검진센터', planned: '2025-06-11', done: '2025-06-12',
              targetCount: 14, examinedCount: 14, evidence: true,
              followupNeeded: false, followupDone: false, followupResult: '',
              owner: '공공시설사업소 · 한담당', reason: '', extraExamDate: '',
              carcinogen: false, targetBasis: '특수건강진단 대상(유해인자 노출자)',
              history: [
                { at: '2025-06-26', actor: '한담당', event: '실시 증빙 등록 · 사후관리 대상 없음' },
                { at: '2025-06-12', actor: '(주)녹십자헬스케어', event: '특수검진 실시(수검 14/14)' }
              ] }
        ];

        /* 결과 안내 공문 — 재난안전과가 온나라로 보낸 기록(예시 자료). 2026 하반기는 1차(측정 끝난 3곳)만
           보냈고, 11월 측정 2곳은 결과가 들어오면 2차로 보낸다(실습 자리). 원장 제목과 같은 이름을 쓴다. */
        function deptIds(names) {
            var V = global.DYV2, seen = {}, out = [];
            names.forEach(function (n) { var id = V && V.deptIdOf ? V.deptIdOf(n) : n; if (id && !seen[id]) { seen[id] = 1; out.push(id); } });
            return out;
        }
        function sdoc(sid, year, half, at, rowIds, status) {
            var rows = workenv.filter(function (r) { return rowIds.indexOf(r.id) >= 0; });
            var hl = half === 'H2' ? '하반기' : '상반기';
            return { sid: sid, no: '재난안전과-' + sid.slice(-4), at: at, status: status, year: year, half: half, rowIds: rowIds,
                docType: '외부발송', title: year + '년 ' + hl + ' 작업환경측정 결과 안내', to: '수신자 참조',
                body: '1. ' + year + '년 ' + hl + ' 작업환경측정 결과를 붙임과 같이 알려 드립니다.\n2. 해당 작업장 근로자에게 측정 결과를 알려 주시기 바랍니다.',
                attach: [], annex: true, basis: [], recipients: deptIds(rows.map(function (r) { return r.dept; })),
                by: '박안전', byUid: 'u_jjt2', dept: '재난안전과', sample: true };
        }
        var weDocs = [
            sdoc('WEN-2025-0001', 2025, 'H1', '2025-06-12', ['WE-2025-03'], '결재완료'),
            sdoc('WEN-2025-0002', 2025, 'H2', '2025-11-28', ['WE-2025-01', 'WE-2025-02'], '결재완료'),
            sdoc('WEN-2026-0001', 2026, 'H1', '2026-07-14', ['WE-2026-01', 'WE-2026-02', 'WE-2026-03', 'WE-2026-04', 'WE-2026-05'], '결재완료'),
            sdoc('WEN-2026-0002', 2026, 'H2', '2026-10-30', ['WE-2026-06', 'WE-2026-07', 'WE-2026-08'], '결재완료')
        ];

        /* 건강검진 결과 안내 공문 — 재난안전과가 부서장에게 보낸 기록(예시 자료). 별지는 부서별 집계만 싣는다
           (대상·수검·미검진·사후관리 대상 유무) — 개인별 결과는 싣지 않는다(산안법 §132②·③). */
        function hdoc(sid, year, at, rowIds, n) {
            var rows = health.filter(function (r) { return rowIds.indexOf(r.id) >= 0; });
            return { sid: sid, no: '재난안전과-' + sid.slice(-4), at: at, status: '결재완료', year: year, rowIds: rowIds,
                docType: '외부발송', title: year + '년 건강검진 결과 안내' + (n > 1 ? '(' + n + '차)' : ''), to: '수신자 참조',
                body: '1. ' + year + '년 건강검진 실시 결과를 붙임과 같이 알려 드립니다.\n2. 개인별 결과는 검진기관이 본인에게 통보합니다. 사후관리 대상이 있는 부서는 조치하여 주시기 바랍니다.',
                attach: [], annex: true, basis: [], recipients: deptIds(rows.map(function (r) { return r.dept; })),
                by: '박안전', byUid: 'u_jjt2', dept: '재난안전과', sample: true };
        }
        var hcDocs = [
            hdoc('HCN-2025-0001', 2025, '2025-12-10', ['HC-2025-01', 'HC-2025-02', 'HC-2025-03'], 1),
            hdoc('HCN-2026-0001', 2026, '2026-07-03', ['HC-2026-01', 'HC-2026-02', 'HC-2026-03', 'HC-2026-06'], 1),
            hdoc('HCN-2026-0002', 2026, '2026-08-07', ['HC-2026-04', 'HC-2026-05'], 2),
            hdoc('HCN-2026-0003', 2026, '2026-11-05', ['HC-2026-07', 'HC-2026-08', 'HC-2026-09'], 3)
        ];

        return { workenv: workenv, health: health, weDocs: weDocs, hcDocs: hcDocs, seqWE: 13, seqHC: 13, seqWEN: 2, seqHCN: 3 };
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

    /* 기록에 남는 이름은 화면이 조립하지 않는다 — DYROLE.actorLabel() 단일 출처
       (doc-progress.js·work-data.js 선례). 특정인 이름을 박아 두면 소관이 부서별로
       갈린 뒤 물순환사업소 담당자가 등록해도 재난안전과가 한 것으로 남는다 —
       rsk-list 의 remindBy() 가 같은 이유로 하드코딩을 걷어낸 자리다(§4-3). */
    function actorNow() {
        var R = global.DYROLE;
        return (R && R.actorLabel) ? R.actorLabel() : '시스템';
    }
    function pushHist(rec, event, actor) {
        (rec.history = rec.history || []).unshift({ at: TODAY, actor: actor || actorNow(), event: event });
    }

    function halfOf(planned) { return (planned && Number(planned.slice(5, 7)) >= 7) ? 'H2' : 'H1'; }
    function yearOf(planned) { return planned ? Number(planned.slice(0, 4)) : CURYEAR; }
    function halfLabel(planned) { return halfOf(planned) === 'H2' ? '하반기' : '상반기'; }

    /* ================= 보존연한·법정 제출기한 헬퍼 ================= */
    /* 결과 보존연한 — 고용노동부 고시 대상 물질 기록은 30년, 그 외 5년 */
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
            /* 시행규칙 §188③ — **노출기준 초과** 공정만 시료채취를 마친 날부터 60일 이내에 개선 증명 서류
               또는 개선 계획을 관할 지방고용노동관서에 낸다. 종전에는 «개선 필요» 전부에 걸어 초과가 아닌
               개선(후드 풍속 미달 등)에도 법정 기한을 붙였고, 정작 제출 여부는 기록하지 않았다. */
            if (rec.exceed && rec.done && !rec.laborSubmittedAt) {
                return { label: '노동관서 제출기한', date: addDays(rec.done, 60) };
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
            dept: o.dept || '', siteId: o.siteId || '', site: o.site || o.dept || '',
            siteTargetState: o.siteTargetState || '검토 중', subject: o.subject || '', vendor: o.vendor || '미지정',
            planned: o.planned || '', done: '', report: false, result: null, improveReq: '', improveDue: '',
            improveDone: false, beforePhoto: false, afterPhoto: false, owner: (o.dept || '') + ' · 담당자',
            reason: '', expectedDone: '', carcinogen: !!o.carcinogen,
            /* 등록 주체 — 재난안전과 담당자가 등록하면 'owner'(위탁 측정 → 결과 안내 공문 대상),
               부서 담당자가 등록하면 'dept'(자체 측정 → 공문 없이 결과 첨부로 끝). 화면이 정하지 않고 접속자로 판정한다. */
            regBy: (global.DYROLE && global.DYROLE.canAct && global.DYROLE.canAct(global.DYROLE.OWNER_DEPT)) ? 'owner' : 'dept',
            reportFiles: [],
            targetBasis: o.targetBasis || '현업 종사자 · 유해인자 노출(' + (o.dept || '해당 부서') + ')',
            history: [{ at: TODAY, actor: actorNow(), event: '측정 계획 등록 (예정일 ' + (o.planned || '-') + ')' }] };
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

    /* ================= 결과 안내 공문 · 잠금 (2026-11-16 v2) =================
     * 결과 안내 공문은 «재난안전과가 위탁한 측정»(regBy 'owner')의 **결과가 들어온 행**을 싣는다.
     * 반기 전체를 기다리지 않는다 — 노출기준 초과 건은 60일 법정 기한이 있어 늦게 알릴 수 없다.
     * 같은 반기에 측정이 나뉘면 2차·3차 공문이 된다. 부서가 직접 등록한 측정(regBy 'dept')은 자체 측정이라
     * 공문에 싣지 않는다(온나라 원장: 농업기술센터는 내부결재로 끝낸다). */
    var LOCKED = { '기안함 전송': 1, '결재중': 1, '결재완료': 1 };
    function regByOf(r) { return (r && r.regBy) || 'owner'; }
    function weDocs() { var d = load(); return d.weDocs || (d.weDocs = []); }
    /* 그 행을 실은 공문 중 효력이 있는 것(반려·반송 제외) — 잠금 판정은 이 함수 한 곳에서만 한다 */
    function weLockOf(rowId) {
        var list = weDocs();
        for (var i = list.length - 1; i >= 0; i--) {
            var d = list[i];
            if ((d.rowIds || []).indexOf(rowId) >= 0 && LOCKED[d.status]) return d;
        }
        return null;
    }
    function halfRows(year, half) {
        return workEnv().filter(function (r) { return String(r.year) === String(year) && r.half === half; });
    }
    /* 이번 공문에 실을 행 — 재난안전과 위탁 · 결과 입력 · 아직 효력 있는 공문에 없음 */
    function noticeRows(year, half) {
        return halfRows(year, half).filter(function (r) { return regByOf(r) === 'owner' && !!r.done && !weLockOf(r.id); });
    }
    function halfStat(year, half) {
        var own = halfRows(year, half).filter(function (r) { return regByOf(r) === 'owner'; });
        return {
            total: own.length,
            done: own.filter(function (r) { return !!r.done; }).length,
            pending: own.filter(function (r) { return !r.done; }),
            notice: noticeRows(year, half),
            sent: own.filter(function (r) { return !!weLockOf(r.id); }).length,
            docs: weDocs().filter(function (d) { return String(d.year) === String(year) && d.half === half; })
        };
    }
    /* 결과보고서 파일 — 이름이 있어야 공문 붙임 후보가 된다. 이름 없이 «첨부됨»만 남은 옛 예시 행은
       위탁업체·반기로 이름을 지어 보인다(같은 업체·반기는 같은 이름 → 공문 붙임에서 한 번만 나온다). */
    function reportFiles(r) {
        if (!r) return [];
        if (r.reportFiles && r.reportFiles.length) return r.reportFiles;
        return r.report ? [{ name: r.vendor + ' 작업환경측정 결과보고서(' + r.year + ' ' + (r.half === 'H2' ? '하반기' : '상반기') + ').pdf', sample: true }] : [];
    }
    function saveNotice(year, half, doc, rowIds) {
        var d = load(); d.seqWEN = (d.seqWEN || 0) + 1;
        doc.year = Number(year); doc.half = half; doc.rowIds = rowIds.slice();
        weDocs().push(doc);
        rowIds.forEach(function (id) { var r = workEnvOf(id); if (r) pushHist(r, '결과 안내 공문 온나라 전송 · ' + (doc.title || '')); });
        save(); return doc;
    }
    function nextNoticeNo() { var d = load(); return '재난안전과-' + String(9000 + (d.seqWEN || 0) + 1); }
    /* 시행규칙 §190① 단서 — 노출기준 초과 시 그 측정일부터 3개월에 1회 이상(화학적 인자 · 고시 물질 기준) */
    function addMonths(dateStr, n) {
        if (!dateStr) return '';
        var d = new Date(dateStr); if (isNaN(d.getTime())) return '';
        d.setUTCMonth(d.getUTCMonth() + n);
        return d.toISOString().slice(0, 10);
    }
    function remeasureDue(r) { return r && r.exceed && r.done ? addMonths(r.done, 3) : ''; }
    /* 노출기준 초과 건 노동관서 제출일(재난안전과) */
    function setLaborSubmit(id, date) {
        var r = workEnvOf(id); if (!r || !r.exceed || !r.done || !date) return null;
        r.laborSubmittedAt = date;
        pushHist(r, '노동관서 제출 기록 · ' + date + ' (개선 증명 서류 또는 개선 계획)');
        save(); return r;
    }
    /* 결과 수정 — 결과 안내 공문을 보내기 전까지만 */
    function editWorkEnvResult(id, opts) {
        var r = workEnvOf(id); if (!r || !r.done || weLockOf(id)) return null;
        opts = opts || {};
        var before = r.result;
        r.done = opts.doneDate || r.done;
        r.result = opts.result || r.result;
        if (r.result === '개선 필요') {
            r.improveReq = opts.improveReq || ''; r.improveDue = opts.improveDue || '';
            r.exceed = !!opts.exceed;
        } else {
            r.improveReq = ''; r.improveDue = ''; r.exceed = false; r.laborSubmittedAt = '';
        }
        pushHist(r, '결과 수정 · 「' + before + '」 → 「' + r.result + '」' + (r.exceed ? ' · 노출기준 초과' : ''));
        save(); return r;
    }
    /* 할 일 — 내 할일이 이 함수 한 곳에서 센다.
     *   improve — 개선 필요 · 미완료이고 부서에 알려진 것(결과 안내 공문을 보냈거나, 부서가 직접 맡긴 측정)
     *   notice  — (주관부서) 결과가 들어왔는데 아직 공문에 싣지 않은 행이 있는 반기
     *   labor   — (주관부서) 노출기준 초과 건의 노동관서 제출 기한 */
    function weTodos(deptId) {
        var V = global.DYV2, R = global.DYROLE, out = [];
        var owner = R && R.OWNER_DEPT ? R.OWNER_DEPT : 'safety';
        workEnv().forEach(function (r) {
            var did = V && V.deptIdOf ? V.deptIdOf(r.dept) : r.dept;
            if (did === deptId && weNeedsImprove(r) && (weLockOf(r.id) || regByOf(r) === 'dept')) {
                out.push({ kind: 'improve', row: r, due: r.improveDue });
            }
        });
        if (deptId === owner) {
            var halves = {};
            workEnv().forEach(function (r) { halves[r.year + '|' + r.half] = { year: r.year, half: r.half }; });
            Object.keys(halves).sort().forEach(function (k) {
                var h = halves[k], rows = noticeRows(h.year, h.half);
                if (rows.length) out.push({ kind: 'notice', year: h.year, half: h.half, rows: rows });
            });
            workEnv().forEach(function (r) {
                var due = legalSubmitDue('we', r);
                if (due) out.push({ kind: 'labor', row: r, due: due.date });
            });
        }
        return out;
    }

    /* ================= 진행 순서 · «지금 할 일» (2026-11-16) =================
     * 작업환경측정·건강검진 상세가 함께 쓰는 순서 목록. 위험성평가 «내 부서 진행 상황»(.rl-my-steps)과
     * «지금 할 일» 강조(.dy-now)를 그대로 쓴다 — 새 계열을 만들지 않는다(CLAUDE.md §7).
     *   steps[] = { key, lab, who, done, skip, note, mine }
     *     mine — 지금 접속한 사람이 이 단계를 하는 사람인가(화면이 판정해 넘긴다)
     *   지금 단계 = 끝나지 않았고 건너뛰지 않는 첫 단계. 그 단계가 내 것이면 그 버튼(data-step=key)에
     *   강조를 걸고, 아니면 «기다리는 중 — 누가 무엇을»을 말한다. 단계는 저장하지 않고 매번 파생한다. */
    function flowCur(steps) {
        for (var i = 0; i < steps.length; i++) if (!steps[i].done && !steps[i].skip) return i;
        return -1;
    }
    function flowHtml(title, steps, nowKey) {
        var esc = (global.DYV2 && global.DYV2.esc) ? global.DYV2.esc : function (x) { return String(x == null ? '' : x); };
        var cur = flowCur(steps), c = cur >= 0 ? steps[cur] : null;
        var n = 0;
        var items = steps.filter(function (s) { return !s.skip; }).map(function (s) {
            n++;
            var now = c && s.key === c.key;
            return '<li class="rl-my-step' + (s.done ? ' is-done' : (now ? ' is-now' : '')) + (s.mine ? ' is-mine' : '') + '">' +
                '<span class="rl-my-no">' + (s.done ? '✓' : n) + '</span>' +
                '<span class="rl-my-body"><b>' + esc(s.lab) + '</b>' +
                    '<span class="rl-my-who">' + esc(s.who) + '</span>' +
                    (s.note ? '<span class="rl-my-note">' + esc(s.note) + '</span>' : '') +
                '</span></li>';
        }).join('');
        var bar;
        if (!c) bar = '<div class="dy-now-bar is-wait" role="status"><span class="dy-now-bar-k">완료</span><span class="dy-now-bar-t">모든 단계가 끝났습니다.</span></div>';
        else if (nowKey) bar = '<div class="dy-now-bar" role="status"><span class="dy-now-bar-k">지금 할 일</span><span class="dy-now-bar-t">' +
            esc((steps.filter(function (s) { return s.key === nowKey; })[0] || c).lab) + ' — 아래 강조된 버튼을 누릅니다.</span></div>';
        else bar = '<div class="dy-now-bar is-wait" role="status"><span class="dy-now-bar-k">기다리는 중</span><span class="dy-now-bar-t">' +
            esc(c.who) + V_josa(c.who) + ' ' + esc(c.lab) + V_eul(c.lab) + ' 합니다.</span></div>';
        return '<section class="rl-my card" aria-label="' + esc(title) + '">' +
            '<div class="rl-my-head"><b>' + esc(title) + '</b></div>' +
            '<ol class="rl-my-steps">' + items + '</ol></section>' + bar;
    }
    function V_josa(w) { return (global.DYV2 && global.DYV2.josa) ? global.DYV2.josa(w, '이', '가') : '이(가)'; }
    function V_eul(w) { return (global.DYV2 && global.DYV2.josa) ? global.DYV2.josa(w, '을', '를') : '을(를)'; }
    /* 지금 할 일 버튼에 강조 — 화면이 innerHTML 을 그린 뒤 부른다(DOM 참조를 들고 있지 않는다) */
    function markNow(root, key) {
        if (!root || !key) return;
        var el = root.querySelector('[data-step="' + key + '"]'); if (!el) return;
        el.classList.add('dy-now', 'dy-now-pulse');
        el.setAttribute('aria-describedby', 'dy-now-tag');
        el.insertAdjacentHTML('afterend', '<span class="dy-now-tag" id="dy-now-tag">지금 할 일</span>');
    }

    /* ================= 건강검진 ================= */
    function health() { return load().health; }
    function addHealth(o) {
        var d = load(); d.seqHC++; o = o || {};
        var rec = { id: 'HC-' + yearOf(o.planned) + '-N' + d.seqHC, year: yearOf(o.planned), type: o.type || '일반건강검진',
            dept: o.dept || '', agency: o.agency || '미지정', planned: o.planned || '', done: '',
            targetCount: o.targetCount || 0, examinedCount: 0, evidence: false, followupNeeded: false, followupDone: false,
            followupResult: '', owner: (o.dept || '') + ' · 담당자', reason: '', extraExamDate: '',
            regBy: (global.DYROLE && global.DYROLE.canAct && global.DYROLE.canAct(global.DYROLE.OWNER_DEPT)) ? 'owner' : 'dept',
            reportFiles: [],
            carcinogen: !!o.carcinogen,
            targetBasis: o.targetBasis || ((o.type || '일반건강검진') === '특수건강진단' ? '특수건강진단 대상(유해인자 노출자)' : '일반건강검진(상시근로자 대상)'),
            history: [{ at: TODAY, actor: actorNow(), event: (o.type || '일반건강검진') + ' 계획 등록 (예정일 ' + (o.planned || '-') + ')' }] };
        d.health.push(rec); save(); return rec;
    }
    function healthOf(id) { var a = health(); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }

    /* «기한 초과»는 예정일이 지났고 실시일이 없을 때(미실시) · 추가검진 예정일이 지났을 때 ·
       유소견 조치결과 제출기한이 지났을 때뿐이다(운영 E04 ③). 실시일이 없으면 수검률은 «-»다(hcRate). */
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
    /* 수검률 — 실시일이 없으면 null(화면은 «-»). 목록·상세가 같은 값을 쓴다(운영 E04 ②) */
    function hcRate(r) {
        if (!r || !r.done || !r.targetCount) return null;
        return Math.round((r.examinedCount || 0) / r.targetCount * 100);
    }
    function hcFollowup(r) { return !!r.followupNeeded && !r.followupDone; }

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

    /* ================= 건강검진 결과 안내 공문 · 잠금 (2026-11-16 — 작업환경측정과 같은 구조) =================
     * 단위는 연도다(검진은 연 1회 · 부서·유형별로 나뉘어 실시된다). 결과가 들어온 건부터 보내고, 나뉘면 2차·3차다.
     * 부서가 직접 등록한 검진(regBy 'dept')은 공문에 싣지 않는다. 별지는 부서별 집계뿐이다(개인 결과 없음). */
    function hcDocs() { var d = load(); return d.hcDocs || (d.hcDocs = []); }
    function hcLockOf(rowId) {
        var list = hcDocs();
        for (var i = list.length - 1; i >= 0; i--) {
            var d = list[i];
            if ((d.rowIds || []).indexOf(rowId) >= 0 && LOCKED[d.status]) return d;
        }
        return null;
    }
    function hcYearRows(year) { return health().filter(function (r) { return String(r.year) === String(year); }); }
    function hcNoticeRows(year) {
        return hcYearRows(year).filter(function (r) { return regByOf(r) === 'owner' && !!r.done && !hcLockOf(r.id); });
    }
    function hcYearStat(year) {
        var own = hcYearRows(year).filter(function (r) { return regByOf(r) === 'owner'; });
        return {
            total: own.length,
            done: own.filter(function (r) { return !!r.done; }).length,
            pending: own.filter(function (r) { return !r.done; }),
            notice: hcNoticeRows(year),
            sent: own.filter(function (r) { return !!hcLockOf(r.id); }).length,
            docs: hcDocs().filter(function (d) { return String(d.year) === String(year); })
        };
    }
    function hcReportFiles(r) {
        if (!r) return [];
        if (r.reportFiles && r.reportFiles.length) return r.reportFiles;
        return r.evidence ? [{ name: (r.agency || '검진기관') + ' ' + r.type + ' 결과 통보서(' + r.year + ').pdf', sample: true }] : [];
    }
    function saveHcNotice(year, doc, rowIds) {
        var d = load(); d.seqHCN = (d.seqHCN || 0) + 1;
        doc.year = Number(year); doc.rowIds = rowIds.slice();
        hcDocs().push(doc);
        rowIds.forEach(function (id) { var r = healthOf(id); if (r) pushHist(r, '결과 안내 공문 온나라 전송 · ' + (doc.title || '')); });
        save(); return doc;
    }
    function nextHcNoticeNo() { var d = load(); return '재난안전과-' + String(9500 + (d.seqHCN || 0) + 1); }
    /* 결과 수정 — 결과 안내 공문을 보내기 전까지만 */
    function editHealthResult(id, opts) {
        var r = healthOf(id); if (!r || !r.done || hcLockOf(id)) return null;
        opts = opts || {};
        var before = r.examinedCount + '/' + r.targetCount + (r.followupNeeded ? ' · 사후관리 대상' : '');
        if (opts.doneDate) r.done = opts.doneDate;
        if (opts.examinedCount != null) r.examinedCount = Math.min(r.targetCount || 0, opts.examinedCount);
        if (opts.followupNeeded != null) { r.followupNeeded = !!opts.followupNeeded; if (!r.followupNeeded) { r.followupDone = false; r.followupResult = ''; } }
        pushHist(r, '결과 수정 · ' + before + ' → ' + r.examinedCount + '/' + r.targetCount + (r.followupNeeded ? ' · 사후관리 대상' : ''));
        save(); return r;
    }
    /* 할 일 — 부서: 결과 안내 공문으로 알려진(또는 부서 자체 검진) 건의 미검진자 추가검진 · 사후관리
     *          재난안전과: 결과가 들어왔는데 공문에 싣지 않은 연도 */
    function hcTodos(deptId) {
        var V = global.DYV2, R = global.DYROLE, out = [];
        var owner = R && R.OWNER_DEPT ? R.OWNER_DEPT : 'safety';
        health().forEach(function (r) {
            var did = V && V.deptIdOf ? V.deptIdOf(r.dept) : r.dept;
            if (did !== deptId || !r.done || !(hcLockOf(r.id) || regByOf(r) === 'dept')) return;
            if (hcUnexamined(r) > 0) out.push({ kind: 'extra', row: r, due: r.extraExamDate || '' });
            else if (hcFollowup(r)) out.push({ kind: 'followup', row: r, due: addDays(r.done, 30) });
        });
        if (deptId === owner) {
            var years = {};
            health().forEach(function (r) { years[r.year] = 1; });
            Object.keys(years).sort().forEach(function (y) {
                var rows = hcNoticeRows(y);
                if (rows.length) out.push({ kind: 'notice', year: Number(y), rows: rows });
            });
        }
        return out;
    }

    /* ================= 공용 처리 액션(양 모듈 공유) ================= */
    /* 증빙/결과보고서 등록
     * 작업환경측정 첨부는 **용도가 둘**이다(기획확인 4차 3-1, 2026-10-06):
     *   '결과보고서' — 측정 완료 판정의 근거. 다시 올리면 이전 판을 지우지 않고 판 번호를 올린다
     *                 (측정 결과 서류 보존 — 산안법 시행규칙 §241① 5년, 고시 물질 30년)
     *   '개선 증빙'  — 개선 완료 판정의 근거(조치 후 증빙)
     * 종전에는 어느 버튼으로 올려도 결과보고서로 저장돼, 개선 증빙을 올리면 «보고서가 있다»가 됐다. */
    function attachEvidence(kind, id, label, fileName) {
        var r = (kind === 'we') ? workEnvOf(id) : healthOf(id);
        if (!r) return null;
        if (kind === 'we') {
            if (label === '개선 전 사진') {
                r.beforePhoto = true;
                pushHist(r, '개선 전 사진 등록' + (fileName ? ' · ' + fileName : ''));
            } else if (label === '개선 증빙') {
                r.afterPhoto = true;
                pushHist(r, '개선 증빙 등록' + (fileName ? ' · ' + fileName : ''));
            } else {
                /* 결과 안내 공문을 보낸 뒤에는 결과보고서를 바꾸지 않는다 — 공문 붙임과 시스템 기록이 갈린다 */
                if (weLockOf(r.id)) return null;
                r.reportVersions = (r.reportVersions || (r.report ? 1 : 0)) + 1;
                r.report = true;
                if (fileName) (r.reportFiles = r.reportFiles || []).push({ name: fileName, at: TODAY, by: actorNow() });
                pushHist(r, '결과보고서 등록' + (fileName ? ' · ' + fileName : '') + (r.reportVersions > 1 ? ' · 제' + r.reportVersions + '판(이전 판 보존)' : ''));
            }
        } else {
            /* 결과보고서(실시 증빙)는 실시일이 있어야 붙는다(운영 E04, 2026-11-04) —
               «미실시인데 결과보고서 첨부됨»이 생기면 상태(기한 초과)와 증빙이 서로 다른 말을 한다.
               화면 두 곳(목록·상세)이 같은 판정을 보도록 저장 계층에서 막는다. */
            if (!r.done) return null;
            /* 결과 안내 공문을 보낸 뒤에는 결과보고서를 바꾸지 않는다 — 작업환경측정과 같은 잠금 */
            if (hcLockOf(r.id)) return null;
            r.evidence = true;
            if (fileName) (r.reportFiles = r.reportFiles || []).push({ name: fileName, at: TODAY, by: actorNow() });
            pushHist(r, (label || '증빙파일') + ' 등록' + (fileName ? ' · ' + fileName : ''));
        }
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
    /* 알림 — 시스템 안 «내 할일» 알림이다(문자·메일 없음). 새올 포틀릿에는 내 할일 대기 건수가 보인다 */
    function notify(kind, id, to) {
        var r = (kind === 'we') ? workEnvOf(id) : healthOf(id);
        if (!r) return null;
        pushHist(r, '내 할일 알림 → ' + (to || r.owner), actorNow());
        save(); return r;
    }
    /* 완료 처리 — 작업환경: 측정 실시 확정 or 개선조치 완료 / 건강: 검진 완료 or 사후관리 완료 */
    function completeWorkEnv(id, opts) {
        var r = workEnvOf(id); if (!r) return null;
        opts = opts || {};
        if (!r.done) {
            r.done = opts.doneDate || TODAY;
            r.result = opts.result || '적정';
            if (r.result === '개선 필요') {
                r.improveReq = opts.improveReq || r.improveReq; r.improveDue = opts.improveDue || r.improveDue;
                r.exceed = !!opts.exceed;
            }
            pushHist(r, '측정 실시 완료 · 결과 「' + r.result + '」' + (r.exceed ? ' · 노출기준 초과' : ''));
        } else if (opts.doneDate) {
            /* 이미 완료한 건에 측정 완료를 다시 저장하지 않는다 — 고치려면 [결과 수정](공문 전까지) */
            return null;
        } else if (weNeedsImprove(r)) {
            r.improveDone = true; r.afterPhoto = true;
            r.improveDoneAt = opts.improveDoneAt || TODAY;
            r.improveResult = opts.improveResult || r.improveResult || '';
            pushHist(r, '개선조치 완료 · ' + r.improveResult + ' · 조치 후 증빙 등록');
        }
        save(); return r;
    }
    function completeHealth(id, opts) {
        var r = healthOf(id); if (!r) return null;
        opts = opts || {};
        if (!r.done) {
            r.done = opts.doneDate || TODAY;
            if (opts.examinedCount != null) r.examinedCount = Math.min(r.targetCount || 0, opts.examinedCount);   // 수검자 ≤ 대상자 상한
            /* 사후관리 대상 여부는 결과 통보서를 받는 이 시점에만 정해진다.
               종전에는 시드 밖에서 이 값을 true 로 만드는 코드가 없어, 새로 등록한
               검진은 유소견자가 나와도 사후관리 축이 영영 열리지 않았다(완료 버튼이
               hcFollowup 을 보고 나오는데 그 값이 늘 false 였다). */
            if (opts.followupNeeded != null) r.followupNeeded = !!opts.followupNeeded;
            pushHist(r, '검진 실시 완료 (수검 ' + r.examinedCount + '/' + r.targetCount + ')'
                + (r.followupNeeded ? ' · 사후관리 대상' : ''));
        } else if (hcUnexamined(r) > 0 && opts.examinedCount != null) {
            r.examinedCount = Math.min(r.targetCount, opts.examinedCount);
            pushHist(r, '추가검진 반영 (수검 ' + r.examinedCount + '/' + r.targetCount + ')');
        } else if (hcFollowup(r)) {
            r.followupDone = true;
            r.followupResult = opts.followupResult || r.followupResult || '';
            pushHist(r, '사후관리 완료 · ' + r.followupResult);
        }
        save(); return r;
    }

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
        regByOf: regByOf, weDocs: weDocs, weLockOf: weLockOf, halfRows: halfRows, noticeRows: noticeRows,
        halfStat: halfStat, reportFiles: reportFiles, saveNotice: saveNotice, nextNoticeNo: nextNoticeNo,
        flowCur: flowCur, flowHtml: flowHtml, markNow: markNow,
        remeasureDue: remeasureDue, setLaborSubmit: setLaborSubmit, editWorkEnvResult: editWorkEnvResult, weTodos: weTodos,
        /* 건강검진 */
        health: health, healthOf: healthOf, addHealth: addHealth, effHealth: effHealth, hcRate: hcRate,
        hcUnexamined: hcUnexamined, hcFollowup: hcFollowup,
        hcDocs: hcDocs, hcLockOf: hcLockOf, hcYearRows: hcYearRows, hcNoticeRows: hcNoticeRows, hcYearStat: hcYearStat,
        hcReportFiles: hcReportFiles, saveHcNotice: saveHcNotice, nextHcNoticeNo: nextHcNoticeNo,
        editHealthResult: editHealthResult, hcTodos: hcTodos,
        healthSummary: healthSummary, healthLink: healthLink,
        /* 공용 처리 */
        attachEvidence: attachEvidence, setReason: setReason, resetDue: resetDue,
        notify: notify, completeWorkEnv: completeWorkEnv, completeHealth: completeHealth
    };
    global.DYSH = global.DYSH || {};
    Object.keys(api).forEach(function (k) { global.DYSH[k] = api[k]; });
})(window);
