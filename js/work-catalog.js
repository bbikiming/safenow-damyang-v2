/* =========================================================================
 * work-catalog.js — 업무 자동발행 카탈로그 (전역 DYWORKT)
 * -------------------------------------------------------------------------
 * 담양군 5개 부서 5개년 문서목록 **430,089행** 실측에서 복원한 반복 업무 템플릿.
 *   근거: docs/planning/기획-업무자동발행-v1.md
 *         docs/planning/분석-업무문서-5개년-실측-v1.md   (숫자의 출처)
 *         docs/planning/기획-업무자동발행-법령세트매핑-v1.md (setRef 귀속)
 *
 * ★ 이 파일은 **사람 판단의 기록**이다(law-admin-seed.js 와 같은 성격).
 *   발행 시점·기한·대상 속성은 실측에서 뽑았지만 그 해석은 사람이 했다.
 *   숫자를 고칠 때는 화면이 아니라 **실측 문서를 먼저 열어본다.**
 *
 * ── 발행 방식은 근거 신뢰도가 정한다 ────────────────────────────────────
 *   **주기와 발행 시점이 실측으로 안정된 8종만 자동 발행**한다.
 *   주기는 있으나 시점 편차가 크거나 표본이 얇은 업무는 달력에 후보로 표시하고
 *   재난안전과가 근거·기한을 확인한 뒤 발행한다(MANUAL_REVIEW).
 *   외부 문서·점검 결과가 들어와야 생기는 업무는 발생 시 수동 생성한다.
 *
 * ── 카탈로그는 발행 규칙만 갖는다 ────────────────────────────────────────
 *   점검표 작성·교육 등록·검진 결과는 전부 기존 전용 화면이 한다(§14-1).
 *   profile:'menu' 는 그 화면으로 보내고, 완료는 doneProbe 로 **읽어온다**.
 *   자체 완료 상태를 저장하지 않는다 — 저장하면 화면과 조용히 어긋난다.
 * ========================================================================= */
(function (global) {
    'use strict';

    /* 주기 5종. ADHOC 은 달력으로 예측할 수 없는 외부 사건에만 쓴다. */
    var CYCLE_LABEL = { MONTH: '월', QUARTER: '분기', HALF: '반기', YEAR: '연', ADHOC: '발생시' };
    var MODE_LABEL = {
        SCHEDULED: '정기 자동발행',
        MANUAL_REVIEW: '담당자 확인 후 발행',
        DOCUMENT_TRIGGERED: '발생 시 수동 생성',
        NOT_APPLICABLE: '자동발행 안 함',
    };
    /* 부서 속성 — DYV2.ORG 노드의 attrs 와 1:1. [] 는 전 부서. */
    var ATTR_LABEL = {
        fieldWorker: '현업근로자 보유',
        publicFacility: '공중이용시설 관리',
        chemical: '화학물질 취급',
        hazard: '유해인자 노출',
        riskSite: '위험성평가 대상지',
    };

    /* ─────────────────────────────────────────────────────────────────────
     * 템플릿 정의
     *   schedule.periods[].issueMD — 발행 기준일(MM-DD). 실측 발행일의 최근값.
     *   dueAnchor 'PERIOD_END' — 회차 마지막 날이 기한(실측 월 피크가 반기말)
     *             'RELATIVE'   — issueDate + dueDays (**중앙값 아닌 p75**)
     *   dueBasis  — 그 값이 어디서 나왔는지. 화면이 그대로 노출한다.
     *   evidence  — 실측 근거. 화면의 [ⓘ] 펼침이 읽는다.
     * ───────────────────────────────────────────────────────────────────── */
    var TEMPLATES = [
    /* ══════════ ① SCHEDULED 8종 — 발행일이 실측으로 안정된 것만 ══════════ */
    {
        id: 'W-CMP-IND', name: '중대산업재해 의무이행 자체점검', family: 'F01',
        axis: 'IND', cat: 'comply', issueMode: 'SCHEDULED', profile: 'menu',
        schedule: { kind: 'HALF', periods: [
            { key: 'H1', label: '상반기', issueMD: '05-14' },
            { key: 'H2', label: '하반기', issueMD: '11-21' },
        ] },
        dueAnchor: 'PERIOD_END',
        dueBasis: { metric: '반기 말일', n: 24, years: '2022~2026', note: '실측 월 피크가 6월(37건)·12월(36건)' },
        scopeAttr: [],
        href: 'menu.html?m=comply', destLabel: '이행점검',
        doneProbe: 'DEPTCHK:comply-industrial',
        slots: [], setRef: ['C10'],
        confidence: { cycle: 'High', timing: 'High' },
        evidence: { years: 5, docs: 378, deptCount: 40,
            note: '통보일 05.31→05.27→05.21→05.14 로 매년 앞당겨짐. 하반기 11.21~12.02.' },
        remindAdvice: { after: 28 },
        active: true,
    },
    {
        id: 'W-CMP-CIV', name: '중대시민재해 의무이행 자체점검', family: 'F10',
        axis: 'CIV', cat: 'comply', issueMode: 'SCHEDULED', profile: 'menu',
        schedule: { kind: 'HALF', periods: [
            { key: 'H1', label: '상반기', issueMD: '05-15' },
            { key: 'H2', label: '하반기', issueMD: '11-23' },
        ] },
        dueAnchor: 'PERIOD_END',
        dueBasis: { metric: '반기 말일', n: 22, years: '2022~2026' },
        scopeAttr: ['publicFacility'],
        href: 'menu.html?m=comply', destLabel: '이행점검',
        doneProbe: 'DEPTCHK:comply-citizen',
        slots: [], setRef: [],
        setNote: '세트 미귀속 — 법령 PDCA 세트 490문서에 중대시민재해 축이 없다(매핑 v1 §3)',
        confidence: { cycle: 'High', timing: 'High' },
        evidence: { years: 5, docs: 176, deptCount: 11,
            note: '산업 축과 하루 차이로 별도 공문. 대상은 시설 보유 부서 11곳.' },
        remindAdvice: { after: 28 },
        active: true,
    },
    {
        id: 'W-EDU-MON', name: '현업근로자 월 정기 안전보건교육', family: 'F04',
        axis: 'OSH', cat: 'edu', issueMode: 'SCHEDULED', profile: 'menu',
        schedule: { kind: 'MONTH', issueDay: 14 },
        dueAnchor: 'PERIOD_END',
        dueBasis: { metric: '당월 말일', n: 47, years: '2026', note: '2026년 매월 12~19일 발행' },
        scopeAttr: ['fieldWorker'],
        /* 대상은 근로자 명단(DYEDU)이 정한다 — 속성은 폴백 */
        deptSource: 'EDU',
        href: 'edu-reg.html', destLabel: '정기교육',
        doneProbe: 'EDU:month',
        slots: [], setRef: ['E2'],
        confidence: { cycle: 'Med', timing: 'High' },
        evidence: { years: 6, docs: 956, deptCount: 29,
            note: '월 리듬은 2026년에 확립. 2025년까지는 분기 중심이었다.' },
        remindAdvice: { after: 21 },
        active: true,
    },
    {
        id: 'W-EDU-QTR', name: '분기 안전보건교육 실시 결과 제출', family: 'F04',
        axis: 'OSH', cat: 'edu', issueMode: 'SCHEDULED', profile: 'menu',
        schedule: { kind: 'QUARTER', periods: [
            { key: 'Q1', label: '1분기', issueMD: '04-01' },
            { key: 'Q2', label: '2분기', issueMD: '07-01' },
            { key: 'Q3', label: '3분기', issueMD: '10-01' },
            { key: 'Q4', label: '4분기', issueMD: '11-19' },
        ] },
        /* 기한 앵커 정정(2026-08-11) — 종전 D+28(익월)은 **실측과 반대**였다.
         * 환경과 접수함 기준 실제 제출 월: 2분기 6월 57건(90%) · 4분기 12월 67건(80%) ·
         * 1분기 3월 64/4월 41. 즉 부서는 **분기 말일에 맞춰 낸다**.
         * 익월로 기한을 주면 실측보다 한 달 늦은 기한을 시스템이 승인하는 셈이 된다. */
        dueAnchor: 'PERIOD_END',
        dueBasis: { metric: '분기 말일', n: 255, years: '2021~2026',
                    note: '실제 제출 월 분포로 확정 — 2분기 90%·4분기 80%가 분기 말월' },
        scopeAttr: ['fieldWorker'],
        /* 대상은 근로자 명단(DYEDU)이 정한다 — 속성은 폴백 */
        deptSource: 'EDU',
        href: 'edu-status.html', destLabel: '이수현황',
        doneProbe: 'EDU:quarter',
        slots: [], setRef: ['E2', 'E5'],
        confidence: { cycle: 'High', timing: 'Med' },
        evidence: { years: 6, docs: 440, deptCount: 34,
            note: '분기 리듬은 확실. 발행 일자는 분기 익월 초~중순으로 편차.' },
        remindAdvice: { after: 21 },
        active: true,
    },
    {
        id: 'W-CMT-QTR', name: '산업안전보건위원회 분기 정기회의', family: 'F09',
        axis: 'OSH', cat: 'opinion', issueMode: 'SCHEDULED', profile: 'attach',
        schedule: { kind: 'QUARTER', periods: [
            { key: 'Q1', label: '1분기', issueMD: '03-11' },
            { key: 'Q2', label: '2분기', issueMD: '06-12' },
            { key: 'Q3', label: '3분기', issueMD: '09-16' },
            { key: 'Q4', label: '4분기', issueMD: '12-15' },
        ] },
        dueAnchor: 'PERIOD_END',
        dueBasis: { metric: '분기 말일', n: 0, years: '2022~2026', note: '개최는 분기 중순, 결과 안내는 분기말' },
        scopeAttr: [],
        href: 'menu.html?m=opinion&sub=committee', destLabel: '산업안전보건위원회',
        slots: [{ key: '회의록', required: true }, { key: '참석자 명단', required: false }],
        setRef: ['D2'],
        setNote: '회의록 원본은 의견청취 화면에 있으나 sessionStorage 저장이 없어 완료 파생 불가 — 첨부로 받는다',
        confidence: { cycle: 'High', timing: 'High' },
        evidence: { years: 5, docs: 168, deptCount: 5,
            note: '분기 개최 + 분기말 결과 안내가 5개년 안정.' },
        remindAdvice: { after: 14 },
        active: true,
    },
    {
        id: 'W-SUP-ASG', name: '산업안전보건 관리감독자 지정·재지정', family: 'F05',
        axis: 'OSH', cat: 'comply', issueMode: 'SCHEDULED', profile: 'attach',
        schedule: { kind: 'HALF', periods: [
            { key: 'H1', label: '상반기', issueMD: '01-06' },
            { key: 'H2', label: '하반기', issueMD: '07-03' },
        ] },
        dueAnchor: 'RELATIVE', dueDays: 14,
        dueBasis: { metric: '운영 기본값', n: 0, years: '-', note: '지정·재지정 회신 기한 D+14 적용' },
        scopeAttr: [],
        href: 'menu.html?m=org', destLabel: '조직',
        slots: [{ key: '관리감독자 지정서', required: true }],
        setRef: ['A3'],
        confidence: { cycle: 'High', timing: 'Med' },
        evidence: { years: 5, docs: 204, deptCount: 35,
            note: '반기 지정이 5개년 확인. 상반기 발행일은 01.06~02.13 로 편차.' },
        remindAdvice: { after: 14 },
        active: true,
    },
    {
        id: 'W-HLT-EXE', name: '근로자 특수건강검진 실시', family: 'F07',
        axis: 'OSH', cat: 'inspection', issueMode: 'SCHEDULED', profile: 'attach',
        /* 업무 계약 확정(2026-08-12)
         * 검진 자체는 검진기관이 수행하고, 부서가 이 업무함에서 완료할 대상은
         * '검진 결과 통보서 제출'이다. 건강검진 화면의 수검 완료·미검진 해소·
         * 사후관리 완료와 문서 제출은 서로 다른 상태이므로 attach 프로필을 유지한다.
         * 완료 판정은 필수 슬롯의 제출 이력이며, 이 판정이 건강검진 실시 완료를
         * 대신하거나 자동으로 바꾸지 않는다. */
        schedule: { kind: 'YEAR', periods: [{ key: 'Y', label: '연간', issueMD: '11-04' }] },
        dueAnchor: 'RELATIVE', dueDays: 45,
        dueBasis: { metric: '운영 기본값', n: 3, years: '2023~2025', note: '검진기관 일정 미등록 시 D+45, 확정 일정 연계 시 그 날짜로 대체' },
        scopeAttr: ['hazard'],
        href: 'health-exam.html', destLabel: '건강검진',
        slots: [{ key: '검진 결과 통보서', required: true }], setRef: ['C1'],
        confidence: { cycle: 'High', timing: 'High' },
        evidence: { years: 3, docs: 84, deptCount: 8,
            note: '실시 안내 11.08 / 10.28 / 11.04 — 3개년 ±1주. 업무함 완료물은 검진 결과 통보서로 확정하며 수검 완료 상태와 분리한다.' },
        remindAdvice: { after: 30 },
        active: true,
    },
    {
        id: 'W-PLN-ANN', name: '중대재해 예방 안전계획 수립', family: 'F02',
        axis: 'COM', cat: 'comply', issueMode: 'SCHEDULED', profile: 'attach',
        schedule: { kind: 'YEAR', periods: [{ key: 'Y', label: '연간', issueMD: '02-04' }] },
        dueAnchor: 'RELATIVE', dueDays: 33,
        dueBasis: { metric: 'p75', n: 7, years: '2022~2026', note: '표본 7건 — 근거가 두껍지 않다' },
        scopeAttr: [],
        href: '', destLabel: '',
        slots: [{ key: '안전계획서', required: true }],
        setRef: ['E1'],
        confidence: { cycle: 'Med', timing: 'Med' },
        evidence: { years: 4, docs: 110, deptCount: 37,
            note: '2024년 결측. 2025·2026 은 2월 초로 수렴(02.13 → 02.04). 실측 촉구 사례 있음(발행+35일).' },
        remindAdvice: { after: 35 },
        active: true,
    },

    /* ══════════ ② MANUAL_REVIEW — 발행일이 아직 안 잡힌 것 ══════════ */
    {
        id: 'W-EDU-HLF', name: '반기 현업근로자 안전보건교육', family: 'F04',
        axis: 'OSH', cat: 'edu', issueMode: 'MANUAL_REVIEW', profile: 'menu',
        schedule: { kind: 'HALF', periods: [
            { key: 'H1', label: '상반기', issueMD: '01-28' },
            { key: 'H2', label: '하반기', issueMD: '11-13' },
        ] },
        dueAnchor: 'RELATIVE', dueDays: 28,
        dueBasis: { metric: 'p75', n: 47, years: '2022~2026' },
        scopeAttr: ['fieldWorker'],
        /* 대상은 근로자 명단(DYEDU)이 정한다 — 속성은 폴백 */
        deptSource: 'EDU',
        href: 'edu-reg.html', destLabel: '정기교육',
        doneProbe: 'EDU:half',
        slots: [], setRef: ['E2'],
        confidence: { cycle: 'Med', timing: 'Med' },
        evidence: { years: 3, docs: 0, deptCount: 34, note: '월·분기 리듬과 겹친다 — 중복 발행 위험이 있어 수동.' },
        active: true,
    },
    {
        id: 'W-EDU-CHK', name: '분기 교육 미이수 조치', family: 'F04',
        axis: 'OSH', cat: 'edu', issueMode: 'MANUAL_REVIEW', profile: 'menu',
        schedule: { kind: 'QUARTER', periods: [
            { key: 'Q1', label: '1분기', issueMD: '04-28' }, { key: 'Q2', label: '2분기', issueMD: '07-28' },
            { key: 'Q3', label: '3분기', issueMD: '10-28' }, { key: 'Q4', label: '4분기', issueMD: '12-20' },
        ] },
        dueAnchor: 'RELATIVE', dueDays: 14,
        dueBasis: { metric: '운영 기본값', n: 0, years: '-', note: '공문 기한이 있으면 그 날짜로 대체' },
        scopeAttr: ['fieldWorker'],
        /* 대상은 근로자 명단(DYEDU)이 정한다 — 속성은 폴백 */
        deptSource: 'EDU',
        href: 'edu-status.html', destLabel: '이수현황',
        doneProbe: 'EDU:complete',
        slots: [], setRef: ['E5'],
        confidence: { cycle: 'Med', timing: 'Med' },
        evidence: { years: 1, docs: 49, deptCount: 0, note: '2026년 신설(이수현황 점검 결과 통보). 미이수자가 있을 때만 의미.' },
        active: true,
    },
    {
        id: 'W-RSK-SVY', name: '위험성평가 유해위험요인 조사', family: 'F06',
        axis: 'COM', cat: 'risk', issueMode: 'MANUAL_REVIEW', profile: 'menu',
        schedule: { kind: 'YEAR', periods: [{ key: 'Y', label: '연간', issueMD: '04-10' }] },
        dueAnchor: 'RELATIVE', dueDays: 19,
        dueBasis: { metric: 'p75', n: 23, years: '2021~2026', note: '중앙값 9일' },
        scopeAttr: ['riskSite'],
        /* 대상은 그 해 정기평가의 a.depts 를 따른다 — 속성 파생은 폴백이다 */
        deptSource: 'RSK',
        href: 'rsk-list.html', destLabel: '정기 위험성평가',
        doneProbe: 'RSK:survey',
        slots: [], setRef: ['B2', 'B4'],
        confidence: { cycle: 'High', timing: 'Med' },
        evidence: { years: 6, docs: 225, deptCount: 14,
            note: '발행 04.10~05.31 편차. 용역 발주 일정에 종속. 실측 촉구 사례(발행+49일).' },
        active: true,
    },
    {
        id: 'W-RSK-ACT', name: '위험성평가 결과 조치사항 이행', family: 'F06',
        axis: 'COM', cat: 'improve', issueMode: 'DOCUMENT_TRIGGERED', profile: 'menu',
        /* 발생시 — 외부 용역 결과가 들어와야 조치할 것이 생긴다. 실측 입고 시점이
         * 03·06·08·11월로 흩어져 달력으로 예측할 수 없다. 수동 생성만 허용. */
        schedule: { kind: 'ADHOC' },
        dueAnchor: 'RELATIVE', dueDays: 60,
        dueBasis: { metric: '운영 기본값', n: 0, years: '-', note: '결과 문서 기한이 있으면 그 날짜로 대체' },
        scopeAttr: ['riskSite'],
        /* 대상은 그 해 정기평가의 a.depts 를 따른다 — 속성 파생은 폴백이다 */
        deptSource: 'RSK',
        /* 개선조치는 독립 메뉴가 아니다 — 정기평가 화면 안에서 처리한다(2026-08-14) */
        href: 'rsk-list.html', destLabel: '정기 위험성평가',
        doneProbe: 'RSK:improve',
        slots: [], setRef: ['B1', 'B4'],
        confidence: { cycle: 'High', timing: 'Low' },
        evidence: { years: 4, docs: 0, deptCount: 14,
            note: '용역 결과 입고 시점 종속 — 03·06·08·11월로 흩어진다. 정기화 불가.' },
        active: true,
    },
    {
        id: 'W-HLT-TGT', name: '특수건강검진 대상자 사전 조사', family: 'F07',
        axis: 'OSH', cat: 'inspection', issueMode: 'MANUAL_REVIEW', profile: 'attach',
        schedule: { kind: 'YEAR', periods: [{ key: 'Y', label: '연간', issueMD: '04-07' }] },
        dueAnchor: 'RELATIVE', dueDays: 9,
        dueBasis: { metric: 'p75', n: 3, years: '2026', note: '표본 3건 — 근거 매우 얇다' },
        scopeAttr: ['hazard'],
        href: 'health-exam.html', destLabel: '건강검진',
        slots: [{ key: '대상자 명단', required: true }], setRef: ['C1'],
        confidence: { cycle: 'Med', timing: 'Med' },
        evidence: { years: 1, docs: 84, deptCount: 8, note: '2026년 신설(04-07). 이전엔 실시 안내에 포함.' },
        active: true,
    },
    {
        id: 'W-ENV-MSD', name: '작업환경측정·특수건강진단 대상조사(MSDS)', family: 'F08',
        axis: 'OSH', cat: 'inspection', issueMode: 'MANUAL_REVIEW', profile: 'attach',
        schedule: { kind: 'YEAR', periods: [{ key: 'Y', label: '연간', issueMD: '02-20' }] },
        dueAnchor: 'RELATIVE', dueDays: 9,
        dueBasis: { metric: 'p75', n: 9, years: '2021~2026' },
        scopeAttr: ['chemical'],
        href: '', destLabel: '',
        slots: [{ key: 'MSDS 자료', required: true }, { key: '화학물질 현황', required: false }],
        setRef: ['C3', 'C2'],
        confidence: { cycle: 'Med', timing: 'Low' },
        evidence: { years: 3, docs: 92, deptCount: 17, note: '발행 2~5월 산포(3개년). 시점 근거 약함.' },
        active: true,
    },
    {
        id: 'W-ENV-MEA', name: '작업환경측정 실시', family: 'F08',
        axis: 'OSH', cat: 'inspection', issueMode: 'MANUAL_REVIEW', profile: 'menu',
        schedule: { kind: 'HALF', periods: [
            { key: 'H1', label: '상반기', issueMD: '04-09' }, { key: 'H2', label: '하반기', issueMD: '08-25' },
        ] },
        dueAnchor: 'PERIOD_END',
        dueBasis: { metric: '반기 말일', n: 0, years: '-', note: '측정기관 일정이 확정되면 담당자가 발행일을 확인' },
        scopeAttr: ['chemical'],
        href: 'work-env.html', destLabel: '작업환경측정',
        doneProbe: 'SH:workenv',
        slots: [], setRef: ['C2'],
        confidence: { cycle: 'Med', timing: 'Med' },
        evidence: { years: 3, docs: 92, deptCount: 17, note: '산안법 시행규칙 §190 반기 1회.' },
        active: true,
    },
    {
        id: 'W-SUP-EDU', name: '관리감독자 안전보건교육', family: 'F05',
        axis: 'OSH', cat: 'edu', issueMode: 'MANUAL_REVIEW', profile: 'menu',
        schedule: { kind: 'YEAR', periods: [{ key: 'Y', label: '연간', issueMD: '10-16' }] },
        dueAnchor: 'RELATIVE', dueDays: 30,
        dueBasis: { metric: '운영 기본값', n: 0, years: '-', note: '교육 일정 확정 시 담당자가 기한 확인' },
        scopeAttr: [],
        href: 'edu-sup.html', destLabel: '관리감독자 정기교육',
        doneProbe: 'EDU:supervisor',
        slots: [], setRef: ['E3'],
        confidence: { cycle: 'High', timing: 'Low' },
        evidence: { years: 4, docs: 204, deptCount: 35,
            note: '발행 09.06 / 11.01 / 10.08 / 10.16 — **편차 2개월**. 2026년 상반기에 중간관리자 교육이 신규 등장해 반기화 여부 불명.' },
        active: true,
    },
    {
        id: 'W-WKR-CEN', name: '종사자·현업근로자 현황 조사', family: 'F03',
        axis: 'COM', cat: 'edu', issueMode: 'MANUAL_REVIEW', profile: 'attach',
        schedule: { kind: 'YEAR', periods: [{ key: 'Y', label: '연간', issueMD: '01-23' }] },
        dueAnchor: 'RELATIVE', dueDays: 6,
        dueBasis: { metric: 'p75', n: 4, years: '2026', note: '표본 4건 — 근거 얇다' },
        scopeAttr: ['fieldWorker'],
        href: 'edu-workers.html', destLabel: '근로자 명단 관리',
        slots: [{ key: '종사자 현황표', required: true }],
        setRef: ['A3', 'E2'],
        setNote: "'종사자' ⊃ '현업근로자' — 명단 화면 갱신으로 갈음하면 공무원 축이 빠진다",
        confidence: { cycle: 'Med', timing: 'Med' },
        evidence: { years: 1, docs: 91, deptCount: 34, note: '2026년 신설(01-23 + 03-26 재조사).' },
        active: true,
    },
    {
        id: 'W-CIV-FAC', name: '중대시민재해 대상시설물 현황 조사', family: 'F10',
        axis: 'CIV', cat: 'inspection', issueMode: 'MANUAL_REVIEW', profile: 'attach',
        schedule: { kind: 'YEAR', periods: [{ key: 'Y', label: '연간', issueMD: '01-29' }] },
        dueAnchor: 'RELATIVE', dueDays: 28,
        dueBasis: { metric: 'p75', n: 22, years: '2022~2026' },
        scopeAttr: ['publicFacility'],
        /* 강등 — facil-data.js 는 FMS 시드(DY_FACIL_SEED)일 뿐 **부서별 조사 완료 상태가 없다**.
           시설물 대장에 부서 확인 축이 생기면 'menu' + doneProbe 로 되돌린다. */
        href: 'fac-list.html', destLabel: '시설물 대장',
        slots: [{ key: '대상시설물 조사표', required: true }], setRef: [],
        setNote: '세트 미귀속 — 시민재해 축(매핑 v1 §3)',
        confidence: { cycle: 'Med', timing: 'Med' },
        evidence: { years: 2, docs: 176, deptCount: 11, note: '2022·2026 확인. 중간 연도 결측.' },
        active: true,
    },
    {
        id: 'W-FLD-ACT', name: '안전·보건관리자 현장점검 조치결과 제출', family: 'F11',
        axis: 'OSH', cat: 'improve', issueMode: 'DOCUMENT_TRIGGERED', profile: 'attach',
        /* 발생시 — 위탁 안전관리자가 순회점검하고 지적사항을 보내야 생긴다.
         * 실측 월 20~30건 상시. 수동 생성만 허용. */
        schedule: { kind: 'ADHOC' },
        dueAnchor: 'RELATIVE', dueDays: 14,
        dueBasis: { metric: '운영 기본값', n: 0, years: '-', note: '점검 결과 접수일 D+14 적용' },
        scopeAttr: [],
        href: '', destLabel: '',
        slots: [{ key: '조치결과', required: true }, { key: '조치 사진', required: false }],
        setRef: ['F3', 'B1'],
        confidence: { cycle: 'Med', timing: 'Low' },
        evidence: { years: 5, docs: 273, deptCount: 0,
            note: '월 20~30건 상시. 점검 조치사항 공문이 올 때마다 발생 — 정기 아님.' },
        active: true,
    },
    {
        id: 'W-HEAT-SUM', name: '여름철 폭염 대비 안전관리 점검', family: 'F13',
        axis: 'OSH', cat: 'inspection', issueMode: 'MANUAL_REVIEW', profile: 'attach',
        schedule: { kind: 'YEAR', periods: [{ key: 'Y', label: '연간', issueMD: '06-04' }] },
        dueAnchor: 'RELATIVE', dueDays: 14,
        dueBasis: { metric: '운영 기본값', n: 0, years: '-', note: '폭염 대응계획 일정 확정 시 담당자가 기한 확인' },
        scopeAttr: ['fieldWorker'],
        href: '', destLabel: '',
        slots: [{ key: '점검 결과', required: true }],
        setRef: [],
        setNote: '세트 미귀속 — 계절 대응은 법령 PDCA 세트 체계에 없다',
        confidence: { cycle: 'Med', timing: 'Med' },
        evidence: { years: 5, docs: 1898, deptCount: 34,
            note: '폭염 문서 1,898건 중 실제 제출 요구는 일부. 연 1건만 남긴다.' },
        active: true,
    },

    /* ══════════ ③ 세트 매핑에서 추가된 신규 6종 (전부 MANUAL_REVIEW) ══════════
     * 법령 세트가 요구하는데 담양군 발행 리듬이 비어 있던 자리.
     * 1년 운영해 발행일이 수렴하면 SCHEDULED 로 승격한다. */
    {
        id: 'W-EVL-HLF', name: '안전보건관리책임자등 업무수행 평가', family: '-',
        axis: 'COM', cat: 'eval', issueMode: 'MANUAL_REVIEW', profile: 'attach',
        schedule: { kind: 'HALF', periods: [
            { key: 'H1', label: '상반기', issueMD: '06-01' }, { key: 'H2', label: '하반기', issueMD: '12-01' },
        ] },
        dueAnchor: 'PERIOD_END',
        dueBasis: { metric: '반기 말일', n: 0, years: '-', note: '법정 주기는 명확, 실측 흔적은 4건' },
        scopeAttr: [],
        /* 강등 — DYEVL 은 평가 **항목 정의**(items·criteria)만 내보내고 평가 실적이 없다.
           평가 결과 스토어가 생기면 'menu' + doneProbe 로 되돌린다. */
        href: 'evl-eval.html', destLabel: '인력 평가',
        slots: [{ key: '평가표', required: true }], setRef: ['A5'],
        confidence: { cycle: 'High', timing: 'Low' },
        evidence: { years: 3, docs: 4, deptCount: 2,
            note: '중처법 시행령 §4①5호 반기 1회. 실측 흔적이 얇은 것이 오히려 발행 필요의 근거.' },
        active: true,
    },
    {
        id: 'W-OPN-HLF', name: '종사자 의견청취 실시', family: '-',
        axis: 'COM', cat: 'opinion', issueMode: 'MANUAL_REVIEW', profile: 'attach',
        schedule: { kind: 'HALF', periods: [
            { key: 'H1', label: '상반기', issueMD: '05-01' }, { key: 'H2', label: '하반기', issueMD: '11-01' },
        ] },
        dueAnchor: 'PERIOD_END',
        dueBasis: { metric: '반기 말일', n: 0, years: '-', note: '회차 내 실시일을 담당자가 확인해 발행' },
        scopeAttr: [],
        /* 강등 — OPINION_STATE 는 화면 진입 함수 안에서 만들어지는 in-memory 객체이고
           sessionStorage 저장이 없다(매핑 v1 §6 D2 주1과 같은 사유). 승격은 스토어부터. */
        href: 'menu.html?m=opinion&sub=voice', destLabel: '의견청취·건의함',
        slots: [{ key: '의견청취 결과', required: true }], setRef: ['D1'],
        confidence: { cycle: 'High', timing: 'Low' },
        evidence: { years: 6, docs: 182, deptCount: 5, note: '중처법 시행령 §4①7호 반기 1회.' },
        active: true,
    },
    {
        id: 'W-POL-ANN', name: '안전·보건 목표와 경영방침 수립·공유', family: '-',
        axis: 'COM', cat: 'approval', issueMode: 'MANUAL_REVIEW', profile: 'menu',
        schedule: { kind: 'YEAR', periods: [{ key: 'Y', label: '연간', issueMD: '01-10' }] },
        dueAnchor: 'RELATIVE', dueDays: 30,
        dueBasis: { metric: '운영 기본값', n: 0, years: '-', note: '연도별 방침 확정 일정에 맞춰 담당자가 발행' },
        scopeAttr: [],
        href: 'menu.html?m=policy', destLabel: '경영방침',
        /* 게시 확인은 DEPTCHK 게시 탭이 이미 부서별로 한다 — 회차는 연 단위 */
        doneProbe: 'DEPTCHK:policy-post',
        slots: [], setRef: ['A1'],
        confidence: { cycle: 'Med', timing: 'Low' },
        evidence: { years: 2, docs: 23, deptCount: 5, note: '게시 확인은 이행점검 화면(DEPTCHK 게시 탭)이 이미 한다.' },
        active: true,
    },
    {
        id: 'W-BGT-ANN', name: '안전보건 예산 편성 요구', family: '-',
        axis: 'COM', cat: 'approval', issueMode: 'MANUAL_REVIEW', profile: 'attach',
        schedule: { kind: 'YEAR', periods: [{ key: 'Y', label: '연간', issueMD: '08-20' }] },
        dueAnchor: 'RELATIVE', dueDays: 21,
        dueBasis: { metric: '운영 기본값', n: 0, years: '-', note: '해당 연도 예산편성 일정 확정 후 담당자가 발행' },
        scopeAttr: [],
        /* 강등 — DYBGT.targets.org 는 재난안전과·환경과 2곳뿐이라 전 부서 축이 아니다.
           기관 축이 전 부서로 확장되면 'menu' + doneProbe 로 되돌린다. */
        href: 'bgt-main.html', destLabel: '예산 총괄표',
        slots: [{ key: '예산 요구서', required: true }], setRef: ['A4'],
        confidence: { cycle: 'Med', timing: 'Low' },
        evidence: { years: 4, docs: 49, deptCount: 5, note: '「중대재해 예방 안전보건 예산」 편성 철저 요청 4개년.' },
        active: true,
    },
    {
        id: 'W-STF-ASG', name: '안전·보건관리자 선임 현황 제출', family: '-',
        axis: 'OSH', cat: 'comply', issueMode: 'MANUAL_REVIEW', profile: 'attach',
        schedule: { kind: 'YEAR', periods: [{ key: 'Y', label: '연간', issueMD: '01-15' }] },
        dueAnchor: 'RELATIVE', dueDays: 14,
        dueBasis: { metric: '운영 기본값', n: 0, years: '-', note: '인사·선임 변동 확인 후 담당자가 발행' },
        scopeAttr: [],
        href: 'menu.html?m=org', destLabel: '조직',
        slots: [{ key: '선임 현황', required: true }], setRef: ['A3'],
        confidence: { cycle: 'Med', timing: 'Low' },
        evidence: { years: 6, docs: 99, deptCount: 5, note: 'A3 세트 전체 실측 99건.' },
        active: true,
    },
    {
        id: 'W-EDU-JOB', name: '안전보건 담당인력 직무교육 이수', family: '-',
        axis: 'OSH', cat: 'edu', issueMode: 'MANUAL_REVIEW', profile: 'attach',
        schedule: { kind: 'YEAR', periods: [{ key: 'Y', label: '연간', issueMD: '03-01' }] },
        dueAnchor: 'RELATIVE', dueDays: 30,
        dueBasis: { metric: '운영 기본값', n: 0, years: '-', note: '교육기관 과정 일정 확인 후 담당자가 발행' },
        scopeAttr: [],
        href: '', destLabel: '',
        slots: [{ key: '수료증', required: true }], setRef: ['E4'],
        confidence: { cycle: 'Med', timing: 'Low' },
        evidence: { years: 6, docs: 75, deptCount: 5,
            note: '법령 세트 E4 는 있는데 edu-* 5화면 어디에도 없다(매핑 v1 갭A).' },
        active: true,
    },
    ];

    /* ── 조회 ── */
    function all() { return TEMPLATES.slice(); }
    function active() { return TEMPLATES.filter(function (t) { return t.active !== false; }); }
    function byId(id) { return TEMPLATES.filter(function (t) { return t.id === id; })[0] || null; }
    function scheduled() { return active().filter(function (t) { return t.issueMode === 'SCHEDULED'; }); }
    function cycleLabel(t) { return CYCLE_LABEL[t.schedule.kind] || ''; }
    function modeLabel(t) { return MODE_LABEL[t.issueMode] || t.issueMode; }
    function attrLabel(a) { return ATTR_LABEL[a] || a; }
    /* 대상 부서 설명 — 화면이 '전 부서'와 속성 축을 같은 말로 쓰지 않게 한다 */
    function scopeLabel(t) {
        if (!t.scopeAttr || !t.scopeAttr.length) return '전 부서';
        return t.scopeAttr.map(attrLabel).join(' · ');
    }
    /* 세트 역인덱스 — 세트마다 커버 상태를 저장하지 않는다(파생) */
    function coverOf(setId) {
        return active().filter(function (t) { return (t.setRef || []).indexOf(setId) >= 0; });
    }

    global.DYWORKT = {
        TEMPLATES: TEMPLATES,
        CYCLE_LABEL: CYCLE_LABEL, MODE_LABEL: MODE_LABEL, ATTR_LABEL: ATTR_LABEL,
        all: all, active: active, byId: byId, scheduled: scheduled,
        cycleLabel: cycleLabel, modeLabel: modeLabel, attrLabel: attrLabel,
        scopeLabel: scopeLabel, coverOf: coverOf,
    };
})(window);
