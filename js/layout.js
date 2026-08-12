/* =========================================================================
 * 담양군 중대재해예방 통합관리시스템 v2 — 공통 레이아웃 (IA: v2 재구축 프롬프트 §3)
 * design/0_디자인시스템.md 의 §5 (레이아웃) / §6.1~6.3 (헤더·GNB·사이드바) 구현.
 *
 * 사용법:
 *   <body data-dy-page="safety-policy">  <!-- 활성 페이지 ID -->
 *     <main class="dy-main"> ...본문... </main>
 *     <script src="./js/layout.js"></script>
 *   </body>
 * ========================================================================= */
(function () {
    'use strict';

    /* =========================================================================
     * ★ 검토 전 표시 (PRE_REVIEW) — **검토가 끝나면 이 한 줄만 false 로 바꾼다** ★
     * -------------------------------------------------------------------------
     * 배포 링크를 받아 여는 사람에게는 이 화면이 완성본으로 보인다. README·배포 안내에
     * 적어 둔 "검토 전" 고지는 저장소를 여는 사람만 보므로, 화면 자체에도 표시한다.
     * 헤더 셸 한 곳에서 렌더하므로 전 화면(54개)에 한 번에 붙고 한 번에 걷힌다
     * (js/edu-approval.js 의 SUBMIT_ENABLED 와 같은 스위치 방식).
     * 걷어낼 때 함께 정리할 것 — README.md 상단 안내 블록 · 배포본의 배포-안내.md
     * ========================================================================= */
    const PRE_REVIEW = true;

    /* --- 아이콘 (Lucide 스타일, stroke 1.75) --- */
    const ICON = {
        shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
        pocket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3h16a2 2 0 0 1 2 2v6a10 10 0 0 1-20 0V5a2 2 0 0 1 2-2z"/><polyline points="8 10 12 14 16 10"/></svg>',
        grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
        building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22V12h6v10"/><path d="M8 6h.01M12 6h.01M16 6h.01M8 10h.01M16 10h.01"/></svg>',
        alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m10.29 3.86-8.4 14.74A2 2 0 0 0 3.62 22h16.76a2 2 0 0 0 1.73-3.4L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>',
        cog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
        chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
        bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
        menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
        chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
        user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
        list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
        file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
        calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
        coins: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>',
        dot: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="3"/></svg>',
        external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>',
        gauge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>',
        activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    };

    /* =========================================================================
     * 권한 시연 (DYROLE) — 중대재해처벌법 책임체계 3계층 롤 스위처
     *   군수(총괄 책임자) – 실과장·사업소장·읍면장(관리감독자) – 업무담당자(실무 수행자)
     *   우측 상단 사용자 칩 클릭 → 페르소나 전환 → 전 화면(헤더·GNB·대시보드)이
     *   선택한 직위 관점으로 다시 렌더된다. 저장: localStorage(dy-role-sim-v1).
     *   페르소나 uid/deptId 는 DYV2.ORG(js/common.js) 조직도와 동일 값 — 변경 금지.
     * ========================================================================= */
    const ROLE_KEY = 'dy-role-sim-v1';
    const ROLE_TIERS = {
        head:  { label: '총괄 책임자', tone: 'purple',  who: '군수',
                 law: '중대재해처벌법 §4 — 안전보건 확보의무 총괄',
                 hideNav: ['docs', 'admin'] },
        super: { label: '관리감독자', tone: 'info',     who: '실과장·사업소장·읍면장',
                 law: '산업안전보건법 §16 — 소속 부서 관리·감독',
                 hideNav: ['admin'] },
        /* 업무담당자는 '가장 낮은 권한'이다 — 종전에는 hideNav 가 비어 있어서
         * 물순환사업소 주무관이 사용자·권한 관리까지 볼 수 있었다(계층 역전).
         * 시스템 관리는 페르소나의 sysAdmin 플래그로만 열린다. */
        staff: { label: '업무담당자', tone: 'success',  who: '실무 수행자',
                 law: '부서 안전보건 업무 실무 수행·기록',
                 hideNav: ['admin'] },
    };
    const ROLE_PERSONAS = [
        { id: 'mayor',  tier: 'head',  uid: 'u_mayor', name: '김담양', role: '군수',
          org: '담양군청', desc: '경영책임자 — 군 전체 안전보건 총괄' },
        { id: 'safety', tier: 'super', uid: 'u_safe1', name: '홍길동', role: '재난안전과장',
          org: '담양군청 · 재난안전과', deptId: 'safety', deptName: '재난안전과', desc: '실과장 — 재난안전과 관리·감독' },
        { id: 'fac',    tier: 'super', uid: 'u_fac1',  name: '임시설', role: '공공시설사업소장',
          org: '공공시설사업소', deptId: 'facility', deptName: '공공시설사업소', desc: '사업소장 — 공공시설사업소 관리·감독' },
        { id: 'town',   tier: 'super', uid: 'u_twn1',  name: '노읍장', role: '담양읍장',
          org: '담양읍', deptId: 'town_damyang', deptName: '담양읍', desc: '읍면장 — 담양읍 관리·감독' },
        { id: 'staff',  tier: 'staff', uid: 'u_jjt2',  name: '박안전', role: '안전관리 주무관',
          org: '담양군청 · 재난안전과', deptId: 'safety', deptName: '재난안전과',
          /* 주관부서 실무자는 시스템 관리(메뉴·권한·법령)를 겸한다 — 이 프로토타입에서
             유일하게 admin 그룹을 보는 사람이다. */
          sysAdmin: true,
          desc: '주관부서(재난안전과) 실무 · 시스템 관리 — 전 부서 취합·점검' },
        /* 업무를 '배정받는' 쪽 관점 — 주관부서 실무자(박안전)와 성격이 다르다.
           이 사람들은 자기 부서 일만 보고, 위험성평가를 직접 실시해 개선조치를 끝낸다.
           uid·deptId 는 DYV2.ORG 값과 동일해야 한다(CLAUDE.md §3). */
        /* 배정하는 쪽 관점 — 부서장. ORG 에 u_wat1(오순환)이 이미 있는데 페르소나만
           없어서 '과장이 팀원에게 배정' 장면이 시연되지 않았다.
           ※ dashboard.js SUPER_SEED.water 신설이 **필수 동반**이다 — 없으면
             superView() 가 SUPER_SEED.safety 로 폴백해 물순환사업소장 첫 화면에
             재난안전과 업무와 담당자 실명이 뜬다(조회 범위 위반). */
        { id: 'watlead', tier: 'super', uid: 'u_wat1', name: '오순환', role: '물순환사업소장',
          org: '물순환사업소', deptId: 'water', deptName: '물순환사업소',
          desc: '사업소장 — 부서 업무 배정·감독' },
        /* 팀장 — 자기 **팀 안에서만** 배정한다(assignKind → 'team').
           과장·소장은 부서 전체, 팀장은 자기 팀. 조회 범위는 둘 다 소속 부서다. */
        { id: 'watteam', tier: 'super', uid: 'u_wat5', name: '문정수', role: '정수팀장',
          org: '물순환사업소 · 정수팀', deptId: 'water', deptName: '물순환사업소',
          teamLead: true, team: '정수팀',
          desc: '팀장 — 정수팀 업무 배정·감독' },
        { id: 'wat',    tier: 'staff', uid: 'u_wat3',  name: '하정수', role: '주무관',
          org: '물순환사업소 · 정수팀', deptId: 'water', deptName: '물순환사업소',
          desc: '배정 부서 담당자 — 물순환사업소 실무' },
        { id: 'envst',  tier: 'staff', uid: 'u_env2',  name: '정환경', role: '유해·위험요인 담당 주무관',
          org: '담양군청 · 환경과', deptId: 'env', deptName: '환경과',
          desc: '배정 부서 담당자 — 환경과 실무' },
    ];
    function rolePersona() {
        let id = null;
        try { id = localStorage.getItem(ROLE_KEY); } catch (e) {}
        return ROLE_PERSONAS.find(p => p.id === id) || ROLE_PERSONAS.find(p => p.id === 'staff');
    }
    function roleTier(p) { return ROLE_TIERS[(p || rolePersona()).tier]; }

    /* =========================================================================
     * 조회 범위 (DYROLE.scope) — '무엇이 보이는가'의 단일 출처
     * -------------------------------------------------------------------------
     * 'all' 이면 전 부서, 그 밖에는 그 deptId 소관만 본다.
     *   · 군수(head)      — 총괄이므로 전 부서
     *   · 재난안전과(주관) — 과장·주무관 모두 전 부서(전 부서를 봐야 총괄 업무가 된다)
     *   · 그 밖의 실과장·사업소장·읍면장·주무관 — **소속 부서만**
     *
     * 조작 권한(rsk-list canManage / my-work canAct)과는 **다른 축**이다.
     * 그쪽은 '무엇을 바꿀 수 있는가'이고 이건 '무엇이 보이는가'다.
     * 화면마다 `p.deptId` 로 직접 판정하지 말고 이 함수만 볼 것 —
     * 종전에는 위험성평가·개선조치·수시평가·내 할일 4개 화면이 각자 달랐다
     * (물순환사업소 주무관이 재난안전과 개선조치를 열람하고 등록까지 할 수 있었다).
     * ========================================================================= */
    const OWNER_DEPT = 'safety';                     /* 주관부서 = 재난안전과 */
    function roleScope(p) {
        p = p || rolePersona();
        if (!p || p.tier === 'head') return 'all';
        if (p.deptId === OWNER_DEPT) return 'all';
        return p.deptId || 'all';
    }
    /* 이 레코드가 지금 사람의 조회 범위 안인가 (deptId 없는 전사 항목은 항상 보인다) */
    function roleInScope(deptId) {
        const s = roleScope();
        return s === 'all' || !deptId || deptId === s;
    }

    /* =========================================================================
     * 조작 권한 (DYROLE.canAct) — '무엇을 **바꿀** 수 있는가'
     * -------------------------------------------------------------------------
     * 조회 범위(scope)와 **다른 축**이다. 조회가 'all' 이어도 조작은 담당자만인
     * 경우가 정상이다(재난안전과장).
     *   · 관리·감독(head/super)은 조회만 한다 — 담당자 이름으로 대신 등록·서명하면
     *     그건 문서 위조다(§4-3 완료확인 규칙과 같은 근거).
     *   · 담당자(staff)는 자기 부서 건만. 주관부서(재난안전과) 담당자는 전 부서.
     * 화면마다 tier·deptId 로 직접 판정하지 말고 이 함수만 볼 것.
     * ========================================================================= */
    function roleCanAct(deptId) {
        const p = rolePersona();
        if (!p) return true;                       /* 롤 스위처가 없는 환경은 종전대로 */
        if (p.tier !== 'staff') return false;      /* 총괄·관리감독자는 조회 전용 */
        if (p.deptId === OWNER_DEPT) return true;  /* 주관부서 담당자 */
        return !deptId || deptId === p.deptId;     /* 그 밖에는 자기 부서 건만 */
    }
    /* 조회 전용 안내 — 화면마다 다른 말을 하지 않도록 문구도 한 곳에서 낸다.
       what: '작업환경측정 계획 등록·결과 첨부' 처럼 그 화면이 막는 행위 */
    function roleReadOnlyNote(what, deptId) {
        const p = rolePersona();
        if (!p || roleCanAct(deptId)) return '';
        const esc = (s) => (window.DYV2 ? window.DYV2.esc(String(s == null ? '' : s)) : s);
        let why;
        if (p.tier === 'head') why = '총괄 책임자는 <b>전 부서</b> 진행 상황을 조회합니다. 처리는 각 부서 담당자가 수행합니다.';
        else if (p.tier === 'super') why = '관리감독자는 소속 부서 진행 상황을 <b>조회</b>합니다. ' + esc(what) + '은(는) <b>담당자 본인</b>이 수행합니다.';
        else why = '<b>' + esc(p.deptName || '') + '</b> 소관 건만 처리할 수 있습니다 — ' + esc(what) + '은(는) 그 부서 담당자가 수행합니다.';
        return '<div class="dy-readonly" role="note"><b>조회 전용</b> — ' + why + '</div>';
    }
    /* =========================================================================
     * 배정 권한 (DYROLE.assignKind) — '누가 할지 **정할** 수 있는가'
     * -------------------------------------------------------------------------
     * 조회(scope)·조작(canAct)과 **다른 세 번째 축**이다. canAct 가 막는 것은
     * "담당자 이름으로 대신 등록·서명하는 것 = 문서 위조"이고, 배정은 저작이
     * 아니라 **지휘**다. 기록에 남는 이름은 배정한 본인이므로 그 근거가 걸리지
     * 않는다. 같은 선례가 이미 있다 — rsk-list 는 감독 관점에 '기한초과 재촉'을
     * 주며 "감독자의 행동은 대신 처리가 아니라 재촉(산안법 §16 지휘·감독)"이라
     * 적었다. 거꾸로 배정을 막으면 ROLE_TIERS.super.law 에 적힌 법정 직무를
     * 시스템이 뺏는다.
     *
     *   'dept' — 그 부서 super(과장·소장·읍면장) **및** 그 부서 staff
     *   'team' — 팀장 (팀 편제 미확보로 1단계 미사용 — 자리만 확보)
     *   ''     — 군수(head) · 다른 부서 사람 · **주관부서가 남의 부서를 볼 때**
     *
     * 주관부서(재난안전과)는 남의 부서에 배정하지 못한다 — commit e9a3244 가
     * 이미 월권으로 지적했다("재난안전과는 부서까지 정해 내려보내고, 담당자는
     * 그 부서가 정한다"). 군수도 배정하지 않는다(지휘계통을 건너뛴다).
     * 그 부서 staff 를 포함하는 이유는 IMPCARD.amendKind 가 이미 그렇게 하기
     * 때문이다 — 빼면 같은 제품에 '담당자 지정' 규칙이 두 벌 생긴다.
     * ========================================================================= */
    function roleAssignKind(deptId) {
        const p = rolePersona();
        if (!p) return 'dept';                       /* 롤 스위처 없는 환경 */
        if (p.tier === 'head') return '';            /* 군수는 지휘계통을 건너뛰지 않는다 */
        if (!deptId || !p.deptId) return '';
        if (deptId !== p.deptId) return '';          /* 남의 부서는 주관부서라도 불가 */
        /* **배정은 중간 관리자가 한다** (화면정의서 정책 확정) — 과장·소장·읍면장.
         * 담당자(staff)는 남에게 배정하지 못하고 **자기가 맡는 것(claim)만** 할 수
         * 있다. 부서장이 부재해도 일이 멈추지 않게 하는 안전판이고, 이건 '남을
         * 지정하는 행위'가 아니라 '내가 하겠다'는 표시라 지휘계통을 건너뛰지 않는다.
         * 판정은 canClaim() 이 따로 한다. */
        if (p.tier !== 'super') return '';
        if (p.teamLead) return 'team';
        return 'dept';
    }
    /* 대상 부서 조정 (DYROLE.canScopeDept) — 주관부서(재난안전과) **담당자**만.
     * 자동 발행이 대상 부서까지 정해서 내보내지만 그 파생이 늘 맞지는 않는다
     * (회계과는 2026년 폐지 · 작업환경측정은 속성 8곳 vs 실제 4곳). 그래서
     * 재난안전과가 **조직도에서 부서를 빼거나 더한다**. 담당자를 지정하는 것이
     * 아니라 **어느 부서 소관인지**만 정한다 — commit e9a3244 의 경계 그대로다. */
    function roleCanScopeDept() {
        const p = rolePersona();
        if (!p) return true;
        return p.tier === 'staff' && p.deptId === OWNER_DEPT;
    }

    /* 자임 — 그 부서 담당자가 본인을 담당자로 세운다(남에게 배정하는 것이 아니다) */
    function roleCanClaim(deptId) {
        const p = rolePersona();
        if (!p) return true;
        return p.tier === 'staff' && !!deptId && deptId === p.deptId;
    }
    /* 배정 후보 — 그 부서 구성원. 범위 밖이면 **빈 배열**(이름조차 넘기지 않는다) */
    function roleAssignCandidates(deptId) {
        if (!deptId || !roleInScope(deptId)) return [];
        /* 배정 권한이 없으면 후보 명단 자체를 주지 않는다 — 조회 범위가 'all' 인
           주관부서 담당자도 남의 부서 **사람 이름**을 받을 이유가 없다.
           범위(scope)와 권한(assignKind)은 다른 축이고, 후보는 권한 쪽 개념이다. */
        if (roleAssignKind(deptId) === '') return [];
        const ms = (window.DYV2 && window.DYV2.orgMembers) ? window.DYV2.orgMembers(deptId) : [];
        const p = rolePersona();
        /* 팀장은 **자기 팀 사람만** 고를 수 있다. 부서 전체를 보여주면 남의 팀
           팀원에게 배정할 수 있게 되어 지휘계통이 깨진다. */
        if (p && p.teamLead && p.team) return ms.filter(m => m.team === p.team);
        return ms;
    }
    /* 배정 후보를 좁힐 팀 이름 — ORGPICK 이 트리를 그릴 때 쓴다('' 면 부서 전체) */
    function roleAssignTeam() {
        const p = rolePersona();
        return (p && p.teamLead && p.team) ? p.team : '';
    }
    /* 배정 책임자 — 미배정 업무의 책임을 지목한다. 정규식(과장|팀장|소장)으로
       뽑지 않는다: adm-perm.js 의 그 정규식은 기획예산실장·담양읍장을 놓친다.
       ORG 의 lead:true 만 본다. 없으면 null → 화면이 '부서장 미등록'을 드러낸다. */
    function roleLeadOf(deptId) {
        const ms = (window.DYV2 && window.DYV2.orgMembers) ? window.DYV2.orgMembers(deptId) : [];
        return ms.filter(m => m.lead)[0] || null;
    }
    /* 이력·재촉의 발신자 — 'by: 재난안전과' 하드코딩이면 담양읍장이 눌러도
       재난안전과가 보낸 것으로 남는다(실제 고친 결함). */
    function roleActorLabel() {
        const p = rolePersona();
        if (!p) return '시스템';
        return (p.deptName ? p.deptName + ' ' : '') + p.name;
    }
    /* 재촉 권한 — 주관부서 담당자(전 부서) + 그 부서 관리·감독. 조회 전용이어도
       재촉은 할 수 있다(감독자의 행동은 대신 처리가 아니라 재촉이다). */
    function roleCanRemind(deptId) {
        const p = rolePersona();
        if (!p) return true;
        if (p.tier === 'head') return false;
        if (p.deptId === OWNER_DEPT) return true;
        return !!deptId && deptId === p.deptId;
    }

    /* 실제로 가릴 GNB 그룹 — 계층 기본값에 페르소나 예외(sysAdmin)를 얹는다 */
    function roleHidden(p) {
        p = p || rolePersona();
        const base = ROLE_TIERS[p.tier].hideNav.slice();
        if (p.sysAdmin) {
            const i = base.indexOf('admin');
            if (i >= 0) base.splice(i, 1);
        }
        return base;
    }
    function roleSet(id) {
        const p = ROLE_PERSONAS.find(x => x.id === id);
        if (!p || p.id === rolePersona().id) { roleClose(); return; }
        try {
            localStorage.setItem(ROLE_KEY, id);
            sessionStorage.setItem('dy-role-switched',
                ROLE_TIERS[p.tier].label + ' — ' + p.name + ' ' + p.role + ' 관점으로 전환되었습니다');
        } catch (e) {}
        /* 새 권한에서 숨겨지는 GNB 그룹의 화면이면 대시보드로, 아니면 현재 화면 유지 */
        const pageId = document.body.getAttribute('data-dy-page') || 'index';
        const group = findGroup(pageId);
        if (roleHidden(p).indexOf(group.id) >= 0) {
            window.location.href = 'index.html';
        } else {
            window.location.reload();
        }
    }
    /* 헤더 드롭다운이 열리면 시연 투어 패널을 접는다 — 패널은 --z-fab(90),
       드롭다운은 --z-nav+2(32) 라 패널이 알림 목록의 오른쪽을 가렸다.
       레이어를 뒤집는 대신 '셸 크롬이 뜨면 패널이 접힌다'는 모달과 같은 규칙을 쓴다.
       class 토글이라 투어의 MutationObserver(childList only)가 못 잡으므로 명시 호출. */
    function chromeSync() { if (window.DYTOUR && window.DYTOUR.syncChrome) window.DYTOUR.syncChrome(); }

    function roleOpen() {
        const d = document.getElementById('dy-role-dropdown');
        const btn = document.getElementById('dy-role-btn');
        if (!d) return;
        const ntf = document.getElementById('dy-ntf-dropdown');
        if (ntf) { ntf.classList.remove('is-open'); ntf.setAttribute('aria-hidden', 'true'); }
        d.classList.add('is-open');
        d.setAttribute('aria-hidden', 'false');
        if (btn) btn.setAttribute('aria-expanded', 'true');
        chromeSync();
    }
    function roleClose() {
        const d = document.getElementById('dy-role-dropdown');
        const btn = document.getElementById('dy-role-btn');
        if (!d) return;
        d.classList.remove('is-open');
        d.setAttribute('aria-hidden', 'true');
        if (btn) btn.setAttribute('aria-expanded', 'false');
        chromeSync();
    }

    /* =========================================================================
     * 알림 (헤더 드롭다운) — 데이터 구동 + 읽음 상태 (UX 개편 2026-07-21)
     *   · 항목 데이터 NTF_ITEMS 단일 배열 → 배지·"안 읽음 N건"·목록이 전부 여기서 파생
     *   · 읽음 상태: sessionStorage(dy-ntf-read-v1) — 클릭/모두 읽음 시 저장
     *   · 카테고리 칩 필터 · 항목 클릭 = 내 할일(work)로 이동해 그 자리에서 처리,
     *     원 처리 화면(href)은 보조 링크 "해당 화면 바로 열기"로 노출 (2026-07-21)
     * ========================================================================= */
    /* basis — 이 업무를 왜 하는지 알려주는 근거 조문(법령 근거 매핑의 조문 키).
       담당자가 알림을 받은 그 자리에서 이유를 알 수 있어야 한다. 근거가 없으면 비운다. */
    const NTF_ITEMS = [
        { id: 'n1', cat: 'approval',   catLabel: '결재',       time: '14:23',
          title: '안전·보건 목표와 경영방침 결재 요청 (온나라)', href: 'menu.html?m=policy',
          work: 'my-work.html?cat=approval', basis: 'cse-4-1' },
        { id: 'n2', cat: 'assignment', catLabel: '지정',       time: '09:15',
          title: '군청 청사 관리책임자로 자동 지정', href: 'base-targets.html',
          work: 'my-work.html', basis: 'osh-15' },
        { id: 'n3', cat: 'compliance', catLabel: '이행',       time: '08:00',
          title: '의무이행 점검표 반기 마감 기한 초과 (D+8)', href: 'menu.html?m=comply',
          work: 'my-work.html?cat=comply', basis: 'cse-5' },
        { id: 'n4', cat: 'inspection', catLabel: '점검',       time: '어제 18:00',
          title: '기준문서함 안전점검 계열 16건 분류 확인 요청', href: 'docs-archive.html',
          work: 'my-work.html?cat=inspection', basis: 'cse-5' },
        { id: 'n5', cat: 'risk',       catLabel: '위험성평가', time: '어제 14:30',
          title: '물순환사업소 개선조치 기한초과 재촉', href: 'my-work.html?dept=water&cat=improve',
          work: 'my-work.html?dept=water&cat=improve', basis: 'cse-4-3' },
    ];
    const NTF_DEFAULT_UNREAD = ['n1', 'n2', 'n3'];
    const NTF_READ_KEY = 'dy-ntf-read-v1';
    let ntfFilter = '';

    function ntfReadSet() {
        try { return new Set(JSON.parse(sessionStorage.getItem(NTF_READ_KEY) || '[]')); }
        catch (e) { return new Set(); }
    }
    function ntfSaveRead(set) {
        try { sessionStorage.setItem(NTF_READ_KEY, JSON.stringify(Array.from(set))); } catch (e) {}
    }
    function ntfIsUnread(id, readSet) {
        return NTF_DEFAULT_UNREAD.indexOf(id) >= 0 && !readSet.has(id);
    }
    function ntfUnreadCount() {
        const rs = ntfReadSet();
        return NTF_ITEMS.filter(n => ntfIsUnread(n.id, rs)).length;
    }
    function ntfMarkRead(id) {
        const rs = ntfReadSet(); rs.add(id); ntfSaveRead(rs);
        ntfSyncBadge();
    }
    function ntfMarkAllRead() {
        const rs = ntfReadSet();
        NTF_DEFAULT_UNREAD.forEach(id => rs.add(id));
        ntfSaveRead(rs);
        ntfRenderList();
        ntfSyncBadge();
        if (window.DYV2 && window.DYV2.toast) window.DYV2.toast('알림을 모두 읽음 처리했습니다.');
    }
    function ntfSyncBadge() {
        const n = ntfUnreadCount();
        const badge = document.getElementById('dy-ntf-badge');
        if (badge) { badge.textContent = n > 0 ? String(n) : ''; badge.setAttribute('data-count', String(n)); }
        const cnt = document.getElementById('dy-ntf-count');
        if (cnt) cnt.textContent = n > 0 ? '(안 읽음 ' + n + '건)' : '(모두 읽음)';
        const readAllBtn = document.getElementById('dy-ntf-read-all');
        if (readAllBtn) readAllBtn.disabled = n === 0;
    }
    function ntfSetFilter(cat) {
        ntfFilter = cat;
        ntfRenderList();
        const chips = document.querySelectorAll('.dy-ntf-chip');
        chips.forEach(c => {
            const on = (c.getAttribute('data-cat') || '') === cat;
            c.classList.toggle('active', on);
            c.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
    }
    function ntfItemHtml(n, readSet) {
        const unread = ntfIsUnread(n.id, readSet);
        /* 항목 클릭 = 내 할일로 이동 (거기서 첨부 팝업·메뉴 이동으로 이어짐).
           원 처리 화면은 보조 링크로 바로 열 수 있게 유지. */
        const workHref = n.work || 'my-work.html';
        const workLink = (n.href && n.href !== workHref)
            ? '<a class="dy-ntf-worklink" href="' + n.href + '" onclick="event.stopPropagation();DYLayout._ntfRead(\'' + n.id + '\')">해당 화면 바로 열기 →</a>'
            : '';
        /* 근거는 비대화형 한 줄 — 항목 전체가 링크라 여기에 클릭 대상을 더 두지 않는다.
           원문까지 보려면 내 할일·해당 화면으로 넘어간다. */
        const basisLine = (window.DYLAW && n.basis) ? DYLAW.basisLine(n.basis, { compact: true }) : '';
        const basisRead = (window.DYLAW && n.basis)
            ? ' 근거 ' + DYLAW.shortRef(DYLAW.resolveBasis(n.basis)) + ' ' + DYLAW.basisTitle(n.basis, { short: true }) + '.' : '';
        return '<div class="dy-ntf-item' + (unread ? ' is-unread' : '') + '" role="link" tabindex="0"' +
            ' data-id="' + n.id + '" data-href="' + workHref + '" aria-label="' + n.catLabel + ' 알림: ' + n.title + '.' + basisRead + ' 내 할일에서 처리">' +
            '<span class="dy-ntf-dot ' + n.cat + '"></span>' +
            '<div class="dy-ntf-item-body">' +
                '<div class="dy-ntf-item-head"><span class="dy-ntf-item-cat ' + n.cat + '">' + n.catLabel + '</span></div>' +
                '<div class="dy-ntf-item-title">' + n.title + '</div>' +
                basisLine +
                workLink +
                '<div class="dy-ntf-item-time">' + n.time + '</div>' +
            '</div>' +
        '</div>';
    }
    function ntfRenderList() {
        const listEl = document.getElementById('dy-ntf-list');
        if (!listEl) return;
        const rs = ntfReadSet();
        const items = NTF_ITEMS.filter(n => !ntfFilter || n.cat === ntfFilter);
        listEl.innerHTML = items.length
            ? items.map(n => ntfItemHtml(n, rs)).join('')
            : '<div class="dy-ntf-empty">이 분류의 알림이 없습니다.</div>';
        /* 항목 클릭/Enter → 읽음 처리 후 이동 */
        listEl.querySelectorAll('.dy-ntf-item').forEach(item => {
            const go = () => {
                ntfMarkRead(item.getAttribute('data-id'));
                window.location.href = item.getAttribute('data-href');
            };
            item.addEventListener('click', go);
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
            });
        });
    }
    function renderNtfDropdown() {
        const cats = [['', '전체'], ['approval', '결재'], ['assignment', '지정'], ['compliance', '이행'], ['inspection', '점검'], ['risk', '위험']];
        const chips = cats.map(c =>
            '<button type="button" class="dy-ntf-chip' + (c[0] === '' ? ' active' : '') + '" data-cat="' + c[0] + '"' +
            ' aria-pressed="' + (c[0] === '' ? 'true' : 'false') + '" onclick="DYLayout._ntfFilter(\'' + c[0] + '\')">' + c[1] + '</button>').join('');
        return html`
            <div class="dy-ntf-dropdown" id="dy-ntf-dropdown" role="dialog" aria-hidden="true" aria-label="알림">
                <div class="dy-ntf-dropdown-head">
                    <span class="dy-ntf-dropdown-title">알림 <span class="dy-ntf-count" id="dy-ntf-count"></span></span>
                    <button class="dy-ntf-read-all" id="dy-ntf-read-all" type="button" onclick="DYLayout._ntfReadAll()">모두 읽음</button>
                </div>
                <div class="dy-ntf-chips" role="group" aria-label="알림 분류 필터">${chips}</div>
                <div class="dy-ntf-dropdown-list" id="dy-ntf-list"></div>
                <div class="dy-ntf-dropdown-foot2">
                    <a href="my-work.html">내 할일 열기</a>
                    <a href="admin-notify.html">알림 전체 보기 (42건)</a>
                </div>
            </div>
        `;
    }

    /* --- 네비게이션 데이터 (v2) ---
     *   담양군_프로토타입_v2_재구축_프롬프트.md §3 IA 기준 — GNB 6개, 최대 3뎁스.
     *   안전보건관리체계 9개 대메뉴는 공통 레이아웃 1개(menu.html)에 데이터 주입 (?m= 파라미터).
     *   각 아이템: id — body[data-dy-page]와 매칭되면 활성 표시 / sfr — 제안요청서 매핑(참고)
     */
    const NAV = [
        // GNB 1. 대시보드 (SFR-020·017)
        { id: 'dashboard', label: '대시보드', icon: 'grid', items: [
            { id: 'index',   label: '통합 현황', icon: 'grid',  href: 'index.html',   screen: 'SFR-020' },
            { id: 'my-work', label: '내 할일',   icon: 'check', href: 'my-work.html', screen: 'MYW01-V' },  // v1.1 §6.2 전 업무 통합 내 할일
        ]},

        // GNB. 업무 관리 (WORK) — 부서별 반복 업무 자동발행 · 배정 · 회수
        //   근거: docs/planning/기획-업무자동발행-v1.md (담양군 5개 부서 5개년 문서 430,089행 실측)
        //   위치 — 대시보드 **바로 뒤**. '내 할일'(수신측)과 '업무 관리'(발행측)는
        //   같은 데이터의 양면이라 인접해야 관계가 읽힌다. 도메인 그룹(위험성평가·
        //   교육) 사이에 끼우면 '또 하나의 도메인'으로 오독된다 — 업무 관리는
        //   도메인 **위를 가로지르는 축**이다.
        //   ※ docs 그룹에 넣지 않는다 — 군수의 hideNav:['docs','admin'] 때문에
        //     상위 권한용 메뉴를 최상위 권한이 못 보게 된다.
        { id: 'work', label: '업무 관리', icon: 'check', items: [
            { id: 'work-admin', label: '업무 발행 관리', icon: 'list',  href: 'work-admin.html', screen: 'WRK01-L' },
            { id: 'work-dept',  label: '부서 업무함',   icon: 'users', href: 'work-dept.html',  screen: 'WRK02-L' },
        ]},

        // GNB 2. 기본정보 (SFR-002·016)
        { id: 'base', label: '기본정보', icon: 'building', items: [
            { id: 'base-targets', label: '관리대상 현황', icon: 'building', href: 'base-targets.html', screen: 'SFR-002' },
            { id: 'base-bulk',    label: '데이터 일괄등록', icon: 'file',   href: 'base-bulk.html',    screen: 'SFR-016' },
        ]},

        // GNB 3. 시설물 안전관리 (FAC) — FMS 시설물관리대장 연계. 기본정보→시설물대장→위험성평가 흐름 (기획-시설물관리-FMS연계-PRD-v1.md)
        { id: 'facil', label: '시설물 안전관리', icon: 'building', items: [
            { id: 'fac-list',     label: '시설물 대장',   icon: 'list',     href: 'fac-list.html',     screen: 'FAC01-V' },
            { id: 'fac-risk',     label: '시설물 위험도', icon: 'alert',    href: 'fac-risk.html',     screen: 'FAC03-V' },
            { id: 'fac-sync',     label: 'FMS 연계',     icon: 'external',  href: 'fac-sync.html',     screen: 'FAC04-S' },
            { id: 'fac-settings', label: '연계 설정',     icon: 'cog',      href: 'fac-settings.html', screen: 'FAC05-S' },
        ]},

        // GNB. 위험성평가 — 재설계 v1 (docs/planning/기획-위험성평가-재설계-v1.md). 개선조치 원본은 rsk-imp.
        //    정기(RSK01-L, 목록·상세 통합) · 수시(RSK03-L) · 개선조치(IMP01-L).
        //    v1.1 §6.2: '내 할일'은 위험성평가 그룹에서 빠져 대시보드 그룹의 전역 메뉴로 이관 (my-work.html).
        //    작업공정 관리(rsk-proc) · 위험성 추정(rsk-exec)은 메뉴에서 제거하되 파일은 보존.
        //    ※ 개선조치(rsk-imp)는 2026-07-30 회의에서 **독립 메뉴 제외** 확정 — 정기평가 상세 안에서
        //       부서별로 처리한다("저기서 지금 개선 조치를 우리 이제 추가하기로 했잖아요. 그러니까
        //       개선 조치 저거는 이제 필요 없죠"). 프로세스가 없어진 게 아니라 화면이 합쳐진 것이므로
        //       rsk-imp.html·rsk-imp-detail.html 과 DYLAW 매핑은 **보존**한다(rsk-proc·rsk-exec 선례와 동일).
        //       딥링크(dashboard·my-work·menu)는 그대로 동작한다. 메뉴로 되살리지 말 것.
        { id: 'risk', label: '위험성평가', icon: 'alert', items: [
            { id: 'rsk-list', label: '정기 위험성평가', icon: 'alert', href: 'rsk-list.html', screen: 'RSK01-L / SFR-007' },
            { id: 'rsk-occ',  label: '수시 위험성평가', icon: 'alert', href: 'rsk-occ.html',  screen: 'RSK03-L / SFR-007' },
            /* hidden — 사이드바에는 안 뜨지만 그룹 소속은 유지한다. 딥링크(내 할일·대시보드)로
             * 들어온 개선조치 화면이 엉뚱하게 '대시보드' SNB 를 달고 뜨는 것을 막는다. */
            { id: 'rsk-imp',        hidden: true, label: '개선조치',      icon: 'check', href: 'rsk-imp.html',        screen: 'IMP01-L / SFR-003' },
            { id: 'rsk-imp-detail', hidden: true, label: '개선조치 상세', icon: 'check', href: 'rsk-imp-detail.html', screen: 'IMP01-D / SFR-003' },
        ]},

        // GNB 4. 안전보건관리체계 — 2026-07-30 회의로 **2카테고리**로 재편.
        //    발주처: "안전 보건 관리 체계는 두 카테고리로 해주세요. 첫 번째 중대 산업 시민 재해 계획 …
        //             두 번째 … 중대 산업 시민재해 의무 이행 점검 이 두 개만 만들어 주시면 돼요."
        //    ※ 하위 점검항목·계획 서식은 화면 정의서와 전자문서 양식 정의서가 계약한다.
        //       메뉴는 업무 단계가 아니라 사용 목적 기준의 2카테고리를 유지한다 — 트리를 더 쪼개지 말 것.
        //    ※ 작업환경측정·특수건강검진은 같은 회의에서 **대메뉴로 분리**되어 아래로 빠졌다.
        //    ※ 도급관리는 재무과 계약자료 회신·컨설팅 자문 대기 중이라 직속으로 남긴다(삭제 아님).
        { id: 'sbm', label: '안전보건관리체계', icon: 'shield', items: [
            { id: 'sbm-policy',   section: '중대산업·시민재해 계획',      label: '경영방침', icon: 'shield', href: 'menu.html?m=policy', screen: 'SFR-005' },
            { id: 'sbm-org',      section: '중대산업·시민재해 계획',      label: '조직',     icon: 'users',  href: 'menu.html?m=org',    screen: 'SFR-006·009·010' },
            { id: 'sbm-comply',   section: '중대산업·시민재해 의무 이행점검', label: '이행점검', icon: 'check', href: 'menu.html?m=comply', screen: 'SFR-008·014' },
            /* 직속 (section 없음) */
            { id: 'sbm-contract', label: '도급관리', icon: 'building', href: 'menu.html?m=contract', screen: 'SFR-013' },
        ]},

        // GNB. 안전보건교육 — 재설계 v1 §8.5 (SNB 3뎁스, 2026-07-20 적용)
        //   item.section 값이 바뀌면 헤더 삽입, undefined 면 직속(top-level) — renderSidebar 참고.
        //   대표 진입: edu-status.html(이수현황) — edu.html 은 리다이렉트 스텁. 시연 투어는 js/edu-tour.js(EDUTOUR).
        { id: 'edu', label: '안전보건교육', icon: 'user', items: [
            /* 현업근로자 3종 */
            { id: 'edu-reg',     section: '현업근로자',  label: '정기교육',   icon: 'user',  href: 'edu-reg.html',     screen: 'EDU-REG / SFR-004·010' },
            { id: 'edu-hire',    section: '현업근로자',  label: '채용시교육', icon: 'user',  href: 'edu-hire.html',    screen: 'EDU-HIRE / SFR-004' },
            { id: 'edu-etc',     section: '현업근로자',  label: '기타 교육',  icon: 'user',  href: 'edu-etc.html',     screen: 'EDU-ETC / SFR-004' },
            /* 관리감독자 2종 */
            { id: 'edu-sup',     section: '관리감독자',  label: '정기교육',  icon: 'user',  href: 'edu-sup.html',     screen: 'EDU-SUP / SFR-004' },
            { id: 'edu-sup-etc', section: '관리감독자',  label: '기타 교육', icon: 'user',  href: 'edu-sup-etc.html', screen: 'EDU-SUP-ETC / SFR-004' },
            /* 직속 (section 없음) */
            { id: 'edu-status',  label: '이수현황',           icon: 'chart', href: 'edu-status.html',  screen: 'EDU-STATUS / SFR-004·010' },
            { id: 'edu-workers', label: '근로자 명단 관리',    icon: 'users', href: 'edu-workers.html', screen: 'EDU-WORKERS / SFR-004' },
            /* 온나라 결재 상신 이력 통합 조회 (총괄·교육별·개인별) — js/edu-apv-log.js */
            { id: 'edu-approval', label: '결재 이력',          icon: 'file',  href: 'edu-approval.html', screen: 'EDU-APV-LOG / SFR-004' },
        ]},

        // GNB. 작업환경측정 · 특수건강검진 — 2026-07-30 회의에서 안전보건관리체계 하위에서 **대메뉴로 승격**.
        //   근거: 매년 반복 수행하고 예산 과목이 직접 편성되는 업무라 첫 화면에서 바로 보여야 한다
        //         (발주처: "작업 환경 측정 그리고 특수 건강 검진 이 항목은 예산 과목에 들어 있어요" /
        //          개발측 "일단 이 두 개만 대메뉴를 빼는 걸로 할게요" → 발주처 "예. 일단 빼주시고").
        //   ※ page id 는 sbm-* 를 그대로 둔다 — DYLAW.MAP(law-map.js)·역참조 표가 이 키에 묶여 있고
        //     law-map.js 는 법제처 스냅샷 생성물이라 손으로 키를 고칠 수 없다(CLAUDE.md §10).
        //   ※ 2026-08-12 화면 계약 확정 — 작업환경측정·건강검진은 독립 대메뉴이며,
        //      사업장/대상 판정·실시·결과문서·개선/사후관리 상태를 각각 분리해 관리한다.
        { id: 'workenv', label: '작업환경측정', icon: 'gauge', items: [
            { id: 'sbm-workenv', label: '작업환경측정', icon: 'gauge', href: 'work-env.html', screen: 'WEM01-L' },
        ]},
        { id: 'health', label: '특수건강검진', icon: 'activity', items: [
            /* 화면은 일반·특수를 함께 다룬다(무수정) — SNB 라벨로 그 범위를 밝힌다 */
            { id: 'sbm-health', label: '건강검진 (일반·특수)', icon: 'activity', href: 'health-exam.html', screen: 'HEX01-L' },
        ]},

        // GNB 4. 의견청취 (SFR-011) — 대메뉴 승격. 화면 내부 3탭을 SNB 3메뉴로 분리 (menu.html?m=opinion&sub=)
        { id: 'opinion', label: '의견청취', icon: 'bell', items: [
            { id: 'opn-voice',     label: '의견청취·건의함',   icon: 'bell',  href: 'menu.html?m=opinion&sub=voice',     screen: 'SFR-011' },
            { id: 'opn-committee', label: '산업안전보건위원회', icon: 'users', href: 'menu.html?m=opinion&sub=committee', screen: 'SFR-011' },
            { id: 'opn-council',   label: '협의체·점검표',     icon: 'check', href: 'menu.html?m=opinion&sub=council',   screen: 'SFR-011' },
        ]},

        // GNB 4. 인력 평가 (EVL / SFR-009) — 안전보건관리책임자·관리감독자 업무수행평가 (중처법 시행령 §4①5호 반기 1회 · 산안법 §15·§16)
        { id: 'eval', label: '인력 평가', icon: 'user', items: [
            { id: 'evl-eval',     label: '인력 평가', icon: 'user',  href: 'evl-eval.html',     screen: 'EVL02-E / SFR-009' },
            { id: 'evl-status',   label: '평가 현황', icon: 'chart', href: 'evl-list.html',     screen: 'EVL01-V / SFR-009' },
            { id: 'evl-settings', label: '평가 설정', icon: 'cog',   href: 'evl-settings.html', screen: 'EVL03-S / SFR-009' },
        ]},

        // GNB 5. 예산관리 (BGT) — 안전보건 예산 편성·집행 총괄표 + 점검표 (중처법 시행령 §4①4호 예산)
        { id: 'budget', label: '예산관리', icon: 'coins', items: [
            { id: 'bgt-main',     label: '예산 총괄표',   icon: 'chart', href: 'bgt-main.html',     screen: 'BGT01-V' },
            { id: 'bgt-settings', label: '예산 기준 설정', icon: 'cog',   href: 'bgt-settings.html', screen: 'BGT02-S' },
        ]},

        // GNB 5. 업무문서 — 공통 메커니즘 2종 (기준문서함 + 프리셋 등록폼)
        //    ※ 안전점검: 별도 대메뉴를 만들지 않음 — 점검 계열 문서는 기준문서함 "안전점검 계열" 뱃지
        { id: 'docs', label: '업무문서', icon: 'file', items: [
            { id: 'docs-archive', label: '기준문서함',          icon: 'file', href: 'docs-archive.html' },
            { id: 'docs-preset',  label: '업무 목록',           icon: 'list', href: 'docs-preset.html' },
            { id: 'docs-exec',    label: '이행 목록',           icon: 'grid', href: 'docs-exec.html' },   // 같은 데이터 — 격자 카드형 보기
        ]},

        // GNB 6. 통계·보고 (SFR-018·021)
        { id: 'stats', label: '통계·보고', icon: 'chart', items: [
            { id: 'stats',       label: '현황 통계',     icon: 'chart', href: 'stats.html',       screen: 'SFR-018' },
            { id: 'reports',     label: '보고서·제증명', icon: 'file',  href: 'reports.html',     screen: 'SFR-021' },
            { id: 'info-center', label: '정보센터',      icon: 'list',  href: 'info-center.html' },
        ]},

        // GNB 7. 시스템 관리 (관리자 전용) — 프리셋 양식 관리가 v2 차별 포인트
        { id: 'admin', label: '시스템 관리', icon: 'cog', items: [
            { id: 'admin-users',       label: '사용자 관리',      icon: 'users',    href: 'admin-users.html',       screen: 'SFR-015' },
            { id: 'admin-sites',       label: '사업장 관리',      icon: 'building', href: 'admin-sites.html',       screen: 'ADM03-S' },
            { id: 'admin-menus',       label: '메뉴 관리',        icon: 'list',  href: 'admin-menus.html',       screen: 'ADM01-S' },
            { id: 'admin-roles',       label: '권한 관리',        icon: 'cog',   href: 'admin-roles.html',       screen: 'ADM02-S' },
            { id: 'admin-notify',      label: '알림 관리',        icon: 'bell',  href: 'admin-notify.html',      screen: 'SFR-017' },
            { id: 'admin-presets',     label: '프리셋 양식 관리', icon: 'cog',   href: 'admin-presets.html' },
            { id: 'admin-integration', label: '연계 관리',        icon: 'cog',   href: 'admin-integration.html', screen: 'SIR-001' },
            /* 법령 관리 — 법령·조문 / 메뉴 근거 매핑 / 변경 이력 3탭 단일 화면
             * (2026-07-30 통합, 구 ADM05 메뉴 근거 매핑 흡수. admin-law-map.html 은
             *  매핑 탭으로 가는 리다이렉트 스텁). 조문(사실)과 매핑(판단)의 파괴
             *  성격 차이는 탭 분리로 유지된다. */
            { id: 'admin-law',         label: '법령 관리',        icon: 'file',  href: 'admin-law.html',         screen: 'ADM04-S' },
        ]},
    ];

    /* sidebar item id → GNB group 매핑 (자동 생성) */
    function findGroup(pageId) {
        for (const g of NAV) {
            if (g.items.some(it => it.id === pageId)) return g;
        }
        return NAV[0];
    }

    function html(strings, ...values) {
        // 단순 템플릿 (escape 없음 — 내부 정적 데이터만 사용)
        return strings.reduce((out, s, i) => out + s + (values[i] == null ? '' : values[i]), '');
    }

    function renderHeader() {
        return html`
            <header class="dy-header">
                <div style="display:flex;align-items:center;">
                    <button class="dy-mobile-menu" id="dy-mobile-menu-btn" aria-label="메뉴">${ICON.menu}</button>
                    <a class="dy-brand" href="index.html">
                        <span class="dy-brand-icon">${ICON.pocket}</span>
                        <span class="dy-brand-name"><strong>담양군</strong><span>중대재해예방 시스템</span></span>
                    </a>
                    ${PRE_REVIEW ? `<button type="button" class="dy-prereview" onclick="window.DYLayout.preReviewInfo()"
                        title="담양군 주무관님 검토 전 시연본입니다 — 눌러서 상세 보기">검토 전<span> 시연본</span></button>` : ''}
                    ${PRE_REVIEW ? `<button type="button" class="dy-prereview is-policy" id="dy-policy-chip"
                        onclick="window.DYPOLICY && window.DYPOLICY.open()"
                        title="외부 자료·연계 준비사항">자료 준비 <span class="dy-policy-n">·</span></button>` : ''}
                </div>
                <div class="dy-header-actions" style="display:flex; align-items:center; gap:6px;">
                    <div class="dy-ntf-wrap" id="dy-ntf-wrap" style="position:relative;">
                        <button class="dy-ntf-btn" id="dy-ntf-btn" type="button" aria-label="알림">
                            ${ICON.bell}
                            <span class="dy-ntf-badge" id="dy-ntf-badge"></span>
                        </button>
                        ${renderNtfDropdown()}
                    </div>
                    <div class="dy-role-wrap" id="dy-role-wrap" style="position:relative;">
                        ${renderRolePill()}
                        ${renderRoleDropdown()}
                    </div>
                </div>
            </header>
        `;
    }

    /* 우측 상단 사용자 칩 — 현재 페르소나 + 권한 계층 배지 */
    function renderRolePill() {
        const p = rolePersona();
        const t = roleTier(p);
        return html`
            <button class="dy-user-pill" id="dy-role-btn" type="button"
                    aria-haspopup="dialog" aria-expanded="false" aria-label="사용자 메뉴 — 권한 전환 (시연)">
                <span class="dy-user-avatar">${p.name.charAt(0)}</span>
                <span class="dy-user-text">
                    <span class="dy-user-name">${p.name} 님 <span class="dy-user-tier">${t.label}</span></span>
                    <span class="dy-user-org">${p.org} · ${p.role}</span>
                </span>
                ${ICON.chevron}
            </button>
        `;
    }

    /* 권한 전환 드롭다운 — 책임체계 3계층 · 페르소나 5인 */
    function renderRoleDropdown() {
        const cur = rolePersona();
        const tierOrder = ['head', 'super', 'staff'];
        const groups = tierOrder.map(tid => {
            const t = ROLE_TIERS[tid];
            const items = ROLE_PERSONAS.filter(p => p.tier === tid).map(p => {
                const isCur = p.id === cur.id;
                return html`
                    <button class="dy-role-item ${isCur ? 'is-current' : ''}" type="button"
                            onclick="DYROLE.set('${p.id}')" ${isCur ? 'aria-current="true"' : ''}>
                        <span class="dy-role-avatar tier-${tid}">${p.name.charAt(0)}</span>
                        <span class="dy-role-item-body">
                            <span class="dy-role-item-name">${p.name} <em>${p.role}</em></span>
                            <span class="dy-role-item-desc">${p.desc}</span>
                        </span>
                        ${isCur ? '<span class="dy-role-current-mark">현재</span>' : ''}
                    </button>
                `;
            }).join('');
            return html`
                <div class="dy-role-tiergroup">
                    <div class="dy-role-tier-label tier-${tid}">
                        <span class="dy-role-tier-badge">${t.label}</span>
                        <span class="dy-role-tier-who">${t.who}</span>
                    </div>
                    ${items}
                </div>
            `;
        }).join('');
        return html`
            <div class="dy-role-dropdown" id="dy-role-dropdown" role="dialog" aria-hidden="true" aria-label="권한 전환">
                <div class="dy-role-drop-head">
                    <span class="dy-role-drop-title">권한 전환 <span class="dy-role-drop-demo">시연</span></span>
                    <p class="dy-role-drop-sub">선택한 직위 관점으로 대시보드·메뉴가 전환됩니다</p>
                </div>
                <div class="dy-role-drop-list">${groups}</div>
                <div class="dy-role-drop-foot">책임체계 — 군수(총괄) → 실과장·사업소장·읍면장(관리감독) → 업무담당자(실무)</div>
            </div>
        `;
    }

    function wireRoleSwitcher() {
        const wrap = document.getElementById('dy-role-wrap');
        const btn = document.getElementById('dy-role-btn');
        const dropdown = document.getElementById('dy-role-dropdown');
        if (!wrap || !btn || !dropdown) return;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.contains('is-open') ? roleClose() : roleOpen();
        });
        document.addEventListener('click', (e) => {
            if (!wrap.contains(e.target)) roleClose();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') roleClose();
        });
    }

    /* GNB 가로 넘침 처리 (2026-07-30 회의로 그룹 14개)
     *   · 실제로 넘칠 때만 우측 페이드(.is-scrollable)를 붙인다 — 안 넘치는데 붙이면
     *     마지막 항목만 괜히 흐려 보인다.
     *   · 활성 항목이 잘려 있으면 화면 안으로 끌어온다. 지금 어느 메뉴에 있는지 안 보이면
     *     스크롤이 있다는 사실 자체를 눈치채지 못한다.
     *   · PC(≥1024px)에서는 알림·사용자 칩이 GNB 라인 위로 겹쳐 오므로(compact 상단)
     *     그만큼 오른쪽 여백을 확보해 마지막 항목이 칩 밑에 깔리지 않게 한다. */
    function wireGnbOverflow() {
        const gnb = document.querySelector('.dy-gnb');
        if (!gnb) return;
        const sync = () => {
            gnb.style.paddingRight = '';
            gnb.style.removeProperty('--gnb-fade');
            const actions = document.querySelector('.dy-header-actions');
            const gr0 = gnb.getBoundingClientRect();
            if (actions) {
                const ar0 = actions.getBoundingClientRect();
                /* 브레이크포인트 상수 대신 실제 겹침으로 판정한다 — compact 상단(PC)에서만
                   칩이 GNB 라인 위로 내려오므로, 세로로 겹칠 때만 오른쪽을 비운다.
                   padding 은 스크롤 끝을 늘려 마지막 항목까지 끌어올 수 있게 하고,
                   mask 는 칩 밑으로 들어간 부분을 지워 글자가 겹쳐 보이지 않게 한다. */
                const vOverlap = Math.min(gr0.bottom, ar0.bottom) - Math.max(gr0.top, ar0.top) > 0;
                if (vOverlap && ar0.left < gr0.right) {
                    const reserve = gr0.right - ar0.left + 16;
                    gnb.style.paddingRight = reserve + 'px';
                    gnb.style.setProperty('--gnb-fade', reserve + 'px');
                }
            }
            gnb.classList.toggle('is-scrollable', gnb.scrollWidth > gnb.clientWidth + 1);
            const active = gnb.querySelector('.dy-gnb-item.is-active');
            if (active) {
                const ar = active.getBoundingClientRect(), gr = gnb.getBoundingClientRect();
                if (ar.left < gr.left || ar.right > gr.right) {
                    gnb.scrollLeft += (ar.left - gr.left) - (gnb.clientWidth - ar.width) / 2;
                }
            }
        };
        /* 왼쪽으로 스크롤된 상태에서는 왼쪽에도 페이드를 줘 "더 있다"를 알린다 */
        const syncLeft = () => {
            gnb.style.setProperty('--gnb-fade-l', gnb.scrollLeft > 4 ? '24px' : '0px');
        };
        const all = () => { sync(); syncLeft(); };
        all();
        gnb.addEventListener('scroll', syncLeft, { passive: true });
        window.addEventListener('resize', all);
    }

    function renderGnb(activeGroupId) {
        /* 권한 계층별 GNB 차등 노출 — hideNav 그룹은 렌더하지 않음 (DYROLE) */
        const hidden = roleHidden();
        return html`
            <nav class="dy-gnb">
                ${NAV.filter(g => hidden.indexOf(g.id) < 0).map(g => {
                    const first = g.items[0];
                    const href = first.href || '#';
                    const onclick = first.soon
                        ? `onclick="return window.DYLayout._soon(event, '${first.soon}')"`
                        : '';
                    return html`<a class="dy-gnb-item ${g.id === activeGroupId ? 'is-active' : ''}" href="${href}" ${onclick}>${g.label}</a>`;
                }).join('')}
            </nav>
        `;
    }

    function renderSidebar(activeGroup, activePageId) {
        /* SNB 3뎁스 렌더 (§8.5 v1.1)
         *   item.section 값이 바뀌면 섹션 헤더 삽입, 섹션→비섹션 전환 시 구분선.
         *   섹션 소속 아이템은 is-nested 클래스로 들여쓰기. */
        let prevSection = null;
        /* hidden 항목은 그룹 소속만 유지하고 사이드바에는 그리지 않는다 */
        const parts = activeGroup.items.filter(it => !it.hidden).map((it, idx) => {
            let prefix = '';
            const curSection = it.section || null;
            if (curSection !== prevSection) {
                if (curSection) {
                    if (idx > 0) prefix += '<div class="dy-sidebar-sep"></div>';
                    prefix += `<div class="dy-sidebar-section">${curSection}</div>`;
                } else {
                    /* 섹션 → 비섹션(직속) 전환: 구분선만 */
                    prefix += '<div class="dy-sidebar-sep"></div>';
                }
                prevSection = curSection;
            }
            const isActive = it.id === activePageId;
            const href = it.href || '#';
            const onclick = it.soon
                ? `onclick="return window.DYLayout._soon(event, '${it.soon}')"`
                : '';
            const externalIcon = it.external
                ? `<span class="dy-sidebar-item-external" aria-label="다른 메뉴로 이동" title="다른 GNB로 이동">${ICON.external}</span>`
                : '';
            const nestedCls = curSection ? 'is-nested' : '';
            return `${prefix}<a class="dy-sidebar-item ${isActive ? 'is-active' : ''} ${it.external ? 'is-external' : ''} ${nestedCls}" href="${href}" ${onclick}>
                <span class="dy-sidebar-item-icon">${ICON[it.icon] || ICON.dot}</span>
                <span>${it.label}</span>
                ${externalIcon}
            </a>`;
        }).join('');
        return html`
            <aside class="dy-sidebar" id="dy-sidebar">
                <div class="dy-sidebar-inner">
                    <div class="dy-sidebar-title">${activeGroup.label}</div>
                    <nav class="dy-sidebar-nav">${parts}</nav>
                </div>
            </aside>
            <div class="dy-sidebar-backdrop" id="dy-sidebar-backdrop"></div>
        `;
    }

    function mount() {
        try {
            const pageId = document.body.getAttribute('data-dy-page') || 'index';
            const group = findGroup(pageId);

            /* 기존 레거시 chrome 제거 */
            const legacyAside = document.getElementById('sidebar');
            if (legacyAside) legacyAside.remove();
            const legacyHeader = document.querySelector('header.header');
            if (legacyHeader) legacyHeader.remove();

            /* 기존 outer wrapper(<div class="flex h-screen overflow-hidden">) → .dy-layout 로 변환 */
            const outer = document.querySelector('body > div.flex.h-screen.overflow-hidden');
            const main = document.querySelector('main');

            const layout = document.createElement('div');
            layout.className = 'dy-layout';
            layout.innerHTML = renderHeader() + renderGnb(group.id) +
                '<div class="dy-body">' + renderSidebar(group, pageId) + '</div>';

            const bodyGrid = layout.querySelector('.dy-body');
            if (main) {
                main.classList.add('dy-main');
                // 기존 main 의 flex/scroll 유틸리티 제거 (.dy-main 이 담당)
                main.classList.remove('flex-1', 'overflow-y-auto', 'p-6', 'p-4', 'space-y-6');

                // body[data-page-title]/[data-page-subtitle] 가 있으면 페이지 헤더 자동 주입
                injectPageTitle(main);

                // 화면별 법령 근거 칩 주입 (DYLAW / js/law-map.js) — 매핑 없으면 무동작
                // id 는 DYLAW 가 직접 해석한다 (menu.html 의 ?m=·?sub= 까지 반영)
                if (window.DYLAW) window.DYLAW.inject(main);

                // [data-pagination] 마커 자동 렌더
                renderPaginationMarkers(main);

                bodyGrid.appendChild(main);
            } else {
                const ph = document.createElement('main');
                ph.className = 'dy-main';
                injectPageTitle(ph);
                bodyGrid.appendChild(ph);
            }

            if (outer) {
                outer.replaceWith(layout);
            } else {
                document.body.insertBefore(layout, document.body.firstChild);
            }

            wireMobileMenu();
            wireNotification();
            wireRoleSwitcher();
            wireGnbOverflow();
            /* 외부 자료·연계 준비사항 — 헤더 칩 카운트 동기화 (DYPOLICY / js/policy-open.js).
               칩이 DOM 에 붙은 **뒤** 불러야 한다. 이 화면 관련 항목이 있으면 칩이 강조된다. */
            if (window.DYPOLICY) window.DYPOLICY.syncChip();


            /* 권한 전환 직후 도착 토스트 (DYROLE) */
            try {
                const msg = sessionStorage.getItem('dy-role-switched');
                if (msg) {
                    sessionStorage.removeItem('dy-role-switched');
                    if (window.DYV2 && window.DYV2.toast) window.DYV2.toast(msg);
                    else showComingSoon && (function () {
                        const t = document.getElementById('toast');
                        if (t) { t.textContent = msg; t.classList.add('show');
                            setTimeout(() => t.classList.remove('show'), 2200); }
                    })();
                }
            } catch (e) {}
        } finally {
            // 마운트 성공/실패와 무관하게 화면 표시 — visibility:hidden 잠금 해제
            document.body.classList.add('dy-mounted');
        }
    }

    /* 안전장치: mount()가 어떤 이유로 호출되지 않더라도 1초 후엔 강제로 본문 표시
     *   (CSS의 body:not(.dy-mounted) > main { display: none } 잠금을 해제)
     */
    setTimeout(() => {
        if (!document.body.classList.contains('dy-mounted')) {
            document.body.classList.add('dy-mounted');
        }
    }, 1000);

    /* body[data-page-title]/[data-page-subtitle]가 있으면 main 시작 부분에 페이지 헤더 자동 주입
     *  - 페이지에 이미 .dy-page-title 마크업이 있으면 건너뜀
     *  - data-back-href 가 있으면 백 링크도 함께 주입
     */
    function injectPageTitle(mainEl) {
        if (!mainEl || mainEl.querySelector('.dy-page-title')) return;
        const title = document.body.getAttribute('data-page-title');
        const subtitle = document.body.getAttribute('data-page-subtitle');
        const backHref = document.body.getAttribute('data-back-href');
        const backLabel = document.body.getAttribute('data-back-label') || '목록';
        if (!title && !backHref) return;

        const frag = document.createDocumentFragment();

        if (backHref) {
            const topbar = document.createElement('div');
            topbar.className = 'detail-topbar';
            topbar.innerHTML =
                '<a class="detail-back-link" href="' + backHref + '">' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
                  backLabel +
                '</a>';
            frag.appendChild(topbar);
        }

        if (title) {
            const titleEl = document.createElement('div');
            titleEl.className = 'dy-page-title';
            titleEl.innerHTML = '<span class="dy-page-dot"></span><h1>' + title + '</h1>';
            frag.appendChild(titleEl);
            if (subtitle) {
                const sub = document.createElement('div');
                sub.className = 'dy-page-subtitle';
                sub.textContent = subtitle;
                frag.appendChild(sub);
            }
        }

        mainEl.insertBefore(frag, mainEl.firstChild);
    }

    /* ※ 3자 책임 라인 푸터(컨설팅 안전일터관리원 · 구축 ㈜다온플레이스 · 발주 담양군청)는
     *    2026-07-30 회의에서 전체 영역 삭제가 확정되어 제거했다. 다시 만들지 말 것.
     *    (발주처: "컨설팅 이거 업체 아예 날려버리고" / "이거는 다른 회사거든요")
     */

    /* main 안의 [data-pagination] 마커를 renderPagination 결과로 자동 교체
     *   <div data-pagination data-current="1" data-total="4"></div>
     */
    function renderPaginationMarkers(mainEl) {
        if (!mainEl) return;
        mainEl.querySelectorAll('[data-pagination]').forEach(el => {
            const current = parseInt(el.getAttribute('data-current'), 10) || 1;
            const total = parseInt(el.getAttribute('data-total'), 10) || 1;
            const html = renderPagination({ current, total });
            if (!html) {
                el.remove();
                return;
            }
            const temp = document.createElement('div');
            temp.innerHTML = html;
            el.replaceWith(temp.firstElementChild);
        });
    }

    function wireNotification() {
        const wrap = document.getElementById('dy-ntf-wrap');
        const btn = document.getElementById('dy-ntf-btn');
        const dropdown = document.getElementById('dy-ntf-dropdown');
        if (!wrap || !btn || !dropdown) return;

        const close = () => {
            dropdown.classList.remove('is-open');
            dropdown.setAttribute('aria-hidden', 'true');
            chromeSync();
        };
        const open = () => {
            roleClose();  /* 헤더 드롭다운은 한 시점에 1개만 */
            dropdown.classList.add('is-open');
            dropdown.setAttribute('aria-hidden', 'false');
            chromeSync();
        };

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.contains('is-open') ? close() : open();
        });

        document.addEventListener('click', (e) => {
            if (!wrap.contains(e.target)) close();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') close();
        });

        /* 목록·배지 최초 렌더 (데이터 구동) */
        ntfRenderList();
        ntfSyncBadge();
    }

    function wireMobileMenu() {
        const btn = document.getElementById('dy-mobile-menu-btn');
        const sidebar = document.getElementById('dy-sidebar');
        const backdrop = document.getElementById('dy-sidebar-backdrop');
        if (!btn || !sidebar || !backdrop) return;

        const isMobile = () => window.matchMedia('(max-width: 1023px)').matches;
        const open = () => {
            sidebar.classList.add('is-open');
            backdrop.classList.add('is-open');
        };
        const close = () => {
            sidebar.classList.remove('is-open');
            backdrop.classList.remove('is-open');
        };
        btn.addEventListener('click', () => {
            sidebar.classList.contains('is-open') ? close() : open();
        });
        backdrop.addEventListener('click', close);

        /* GNB 클릭(모바일): 다음 페이지로 이동하기 전에 "도착 후 드로어 열기" 플래그를 세팅.
           새 페이지 mount() 시 플래그를 보고 드로어를 열어줘서 사용자가 LNB를 즉시 발견할 수 있게 한다.
           일반 href 동작은 그대로 두어 데스크탑/단축키(Ctrl·Cmd 클릭) 동작을 깨지 않는다. */
        document.querySelectorAll('.dy-gnb-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!isMobile()) return;
                if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
                try { sessionStorage.setItem('dy-open-lnb-on-load', '1'); } catch (_) {}
            });
        });

        /* 도착 후 플래그가 있으면 드로어 자동 오픈 */
        try {
            if (isMobile() && sessionStorage.getItem('dy-open-lnb-on-load') === '1') {
                sessionStorage.removeItem('dy-open-lnb-on-load');
                open();
            }
        } catch (_) {}

        /* LNB 아이템 클릭 시 드로어를 즉시 닫아 페이지 전환을 시각적으로 명확하게.
           soon 토스트(href='#')인 경우엔 닫지 않아 토스트가 보이도록. */
        sidebar.querySelectorAll('.dy-sidebar-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!isMobile()) return;
                const href = item.getAttribute('href');
                if (href && href !== '#') {
                    close();
                }
            });
        });

        /* viewport가 데스크탑 폭으로 늘어나면 드로어 상태를 정리 */
        window.addEventListener('resize', () => {
            if (!isMobile() && sidebar.classList.contains('is-open')) close();
        });
    }

    /* 비활성 메뉴 클릭 시 토스트 (#toast 가 페이지에 있으면 사용) */
    function showComingSoon(e, label) {
        if (e) e.preventDefault();
        const t = document.getElementById('toast');
        if (!t) { alert((label ? '[' + label + '] ' : '') + '준비 중인 기능입니다.'); return false; }
        t.textContent = (label ? '[' + label + '] ' : '') + '준비 중인 기능입니다.';
        t.classList.add('show');
        clearTimeout(window.__toastTimer);
        window.__toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
        return false;
    }

    /* =========================================
     * 마크업 헬퍼 — 페이지에서 반복되는 보일러플레이트를 줄임
     * ========================================= */

    /* 페이지네이션 HTML 생성
     *   opts: { current, total, onPage (optional — JS handler name) }
     *   total ≤ 1 이면 빈 문자열 반환.
     */
    function renderPagination(opts) {
        opts = opts || {};
        const current = opts.current || 1;
        const total = opts.total || 1;
        if (total <= 1) return '';
        const prev = current > 1 ? current - 1 : null;
        const next = current < total ? current + 1 : null;
        const onclick = opts.onPage || "window.DYLayout._soon(event, '페이지 이동')";

        let html = '<div class="pagination">';
        // prev
        html += '<a class="pagination-item' + (prev ? '' : ' is-disabled') + '" href="#" aria-label="이전"' +
                (prev ? ' onclick="' + onclick.replace('event', 'event, ' + prev) + '"' : '') +
                '><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></a>';
        // pages
        for (let p = 1; p <= total; p++) {
            const isActive = p === current;
            html += '<a class="pagination-item' + (isActive ? ' is-active' : '') + '" href="#"' +
                    (isActive ? '' : ' onclick="' + onclick.replace('event', 'event, ' + p) + '"') +
                    '>' + p + '</a>';
        }
        // next
        html += '<a class="pagination-item' + (next ? '' : ' is-disabled') + '" href="#" aria-label="다음"' +
                (next ? ' onclick="' + onclick.replace('event', 'event, ' + next) + '"' : '') +
                '><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></a>';
        html += '</div>';
        return html;
    }

    /* 필터 행 HTML 생성
     *   filters: [{label, options:[string,...]}, ...]
     *   search:  { placeholder } (optional) — 합본 검색 바
     *   clear:   boolean — '초기화' 텍스트 버튼 표시 여부
     */
    function renderFilterRow(filters, options) {
        options = options || {};
        let html = '<div class="rsk-filter-row">';
        (filters || []).forEach(f => {
            html += '<div class="form-group">' +
                      '<span class="form-label-inline">' + f.label + '</span>' +
                      '<select class="select">' +
                        (f.options || []).map(o => '<option>' + o + '</option>').join('') +
                      '</select>' +
                    '</div>';
        });
        if (options.search) {
            const ph = options.search.placeholder || '검색';
            html += '<div class="search-bar">' +
                      '<input class="search-input" type="text" placeholder="' + ph + '">' +
                      '<button class="search-submit" type="button">' +
                        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
                        '검색' +
                      '</button>' +
                    '</div>';
        }
        if (options.clear !== false) {
            html += '<button class="clear-filters" type="button" onclick="window.DYLayout._soon(event, \'필터 초기화\')">초기화</button>';
        }
        html += '</div>';
        return html;
    }

    /* 검토 전 칩 클릭 — 무엇이 내부 검토 전이고 무엇이 외부 자료 대기인지 밝힌다.
       칩만 띄우고 설명이 없으면 "왜 검토 전인지"를 아무도 알 수 없다.
       모달은 공용 헬퍼만 쓴다 (CLAUDE.md §1). */
    function preReviewInfo() {
        const V = window.DYV2;
        if (!V || !V.openModal) return;
        V.openModal('검토 전 시연본입니다',   /* 셸 크롬 — 투어 안내 주입 대상 아님({chrome:true}) */
            '<div class="dy-prereview-doc">' +
              '<p><b>이 화면은 담양군 주무관님 최종 검토 전 상태입니다.</b> 자체 기획으로 결정 가능한 기능·UX는 화면 정의서에서 확정해 개발할 수 있습니다. ' +
                '외부 자료가 들어오면 실제 기관정보·명단·연계값만 교체합니다.</p>' +
              '<h4>검토 대기 중인 변경</h4>' +
              '<ul>' +
                '<li>2026-07-30 회의 반영 — 안전보건교육 첨부·탭 구성, 이행관리 → <b>이행점검</b> 개칭과 부서 전수 체크리스트, 경영방침 게시 현황</li>' +
                '<li>개선조치 완료 확인 → <b>공문 기안</b> → 온나라 이관 (신설)</li>' +
                '<li>권한 계층별 초기 조작 권한·조회 범위 확정 — 운영 변경은 시스템 관리에서 처리</li>' +
              '</ul>' +
              '<h4>담양군·외부기관 자료가 필요한 항목</h4>' +
              '<p class="dy-prereview-note">아래는 화면에서 <b>“미등록”</b>으로 드러나며, 미수신 대체 동작도 정의돼 있습니다.</p>' +
              '<ul>' +
                '<li>공문 기관정보 — 처리과 기호·주소·전화·팩스·전자우편·공개구분·관인</li>' +
                '<li>부서 명단 — 현재 11개 등록 / 회의에서 확인된 대상 39개</li>' +
                '<li>문서대장 5년치 · 담양군 적용 관계 법령 목록 · 기록관리 기준</li>' +
                '<li>온나라·FMS·행정포털·인사 실연계 규격</li>' +
              '</ul>' +
              '<p class="dy-prereview-note">시연 기준일은 <b>2026-07-16</b>으로 고정되어 있습니다.</p>' +
            '</div>',
            '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal()">확인</button>',
            { chrome: true });
    }

    /* 외부 노출 */
    window.DYLayout = {
        mount,
        PRE_REVIEW,
        preReviewInfo,
        _soon: showComingSoon,
        renderPagination,
        renderFilterRow,
        NAV,
        /* 알림 내부 핸들러 (인라인 onclick 용) */
        _ntfFilter: ntfSetFilter,
        _ntfReadAll: ntfMarkAllRead,
        _ntfRead: ntfMarkRead,
    };

    /* 권한 시연 API — 대시보드(js/dashboard.js) 등 화면 모듈이 참조 */
    /* 로그인한 사람의 소속 부서 — 화면이 '내 부서 관점'의 기본값으로 쓴다.
       군수·주관부서처럼 전 부서를 보는 자리는 부서가 없으므로 '' 를 돌려준다. */
    function roleDeptId() { const p = rolePersona(); return p && p.deptId ? p.deptId : ''; }
    window.DYROLE = {
        TIERS: ROLE_TIERS,
        PERSONAS: ROLE_PERSONAS,
        current: rolePersona,
        deptId: roleDeptId,
        hidden: roleHidden,
        tier: roleTier,
        OWNER_DEPT: OWNER_DEPT,
        scope: roleScope,
        inScope: roleInScope,
        canAct: roleCanAct,
        /* 배정 축 — 조회·조작과 다른 세 번째 축 (CLAUDE.md §14-7) */
        assignKind: roleAssignKind,
        canClaim: roleCanClaim,
        canScopeDept: roleCanScopeDept,
        assignCandidates: roleAssignCandidates,
        assignTeam: roleAssignTeam,
        leadOf: roleLeadOf,
        actorLabel: roleActorLabel,
        canRemind: roleCanRemind,
        readOnlyNote: roleReadOnlyNote,
        set: roleSet,
        open: roleOpen,
        close: roleClose,
    };

    /* 호환: 기존 페이지의 inline showComingSoon() 콜백 유지 */
    if (typeof window.showComingSoon !== 'function') {
        window.showComingSoon = showComingSoon;
    }

    /* DOM ready 후 자동 mount */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }
})();

/* =========================================================================
 * 화면 정의서 빠른 진입 — 모든 페이지 우측 하단에 항상 표시되는 플로팅 버튼.
 *   · URL 수정 없이 각 페이지에서 바로 그 화면의 정의서를 새 탭으로 연다.
 *   · 클릭 → screen-definitions.html?from=<현재파일+쿼리> (현재 화면 자동 선택).
 *   · 숨기기: ?screendef=off (이후 유지) / 다시 표시: ?screendef=on
 *   · 뷰어(screen-definitions.html) 자신에는 표시하지 않음. 기존 기능에는 영향 없음.
 * ========================================================================= */
(function () {
    'use strict';
    try {
        var p = new URLSearchParams(location.search);
        if (p.get('screendef') === 'off') { try { localStorage.setItem('dy-screendef-hide', '1'); } catch (e) {} }
        if (p.get('screendef') === 'on') { try { localStorage.removeItem('dy-screendef-hide'); } catch (e) {} }
        var hidden = false; try { hidden = localStorage.getItem('dy-screendef-hide') === '1'; } catch (e) {}
        if (hidden) return;

        var base = (location.pathname.split('/').pop() || '').toLowerCase();
        if (base === 'screen-definitions.html') return; /* 뷰어 자신에는 표시 안 함 */

        function inject() {
            if (document.getElementById('dy-screendef-fab')) return;
            var from = base + (location.search || '');
            var wrap = document.createElement('div');
            wrap.id = 'dy-screendef-fab';
            wrap.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:var(--z-fab);font-size:var(--fs-12);';
            wrap.innerHTML =
                '<a href="screen-definitions.html?from=' + encodeURIComponent(from) + '" target="_blank" rel="noopener" ' +
                'title="이 화면의 화면 정의서 보기 (새 탭)" ' +
                'style="display:inline-flex;align-items:center;gap:6px;background:var(--main-dark);color:var(--surface);' +
                'padding:9px 14px;border-radius:var(--radius-pill);box-shadow:var(--shadow-md);' +
                'text-decoration:none;font-weight:700;opacity:.92;transition:opacity .15s,transform .15s;" ' +
                'onmouseover="this.style.opacity=1;this.style.transform=\'translateY(-1px)\';" ' +
                'onmouseout="this.style.opacity=.92;this.style.transform=\'none\';">' +
                '화면 정의서</a>';
            document.body.appendChild(wrap);
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', inject);
        } else { inject(); }
    } catch (e) {}
})();
