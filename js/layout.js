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
     * 권한 전환 (DYROLE) — 중대재해처벌법 책임체계 3계층 롤 스위처
     *   군수(총괄 책임자) – 실과장·사업소장·읍면장(관리감독자) – 업무담당자(실무 수행자)
     *   우측 상단 사용자 칩 클릭 → 페르소나 전환 → 전 화면(헤더·GNB·대시보드)이
     *   선택한 직위 관점으로 다시 렌더된다. 저장: localStorage(dy-role-sim-v1).
     *   페르소나 uid/deptId 는 DYV2.ORG(js/common.js) 조직도와 동일 값 — 변경 금지.
     * ========================================================================= */
    const ROLE_KEY = 'dy-role-sim-v1';
    const ROLE_TIERS = {
        head:  { label: '총괄 책임자', tone: 'purple',  who: '군수',
                 law: '중대재해처벌법 §4 — 안전보건 확보의무 총괄',
                 /* 종전 값은 ['docs','admin'] 이었다 — 'docs'(업무문서)는 2026-08-28
                  * 재편에서 그룹째 사라졌고(→ cmp 로 흡수), 없는 그룹 id 를 계속
                  * 적어 두면 다음 사람이 "군수에게 감추는 메뉴가 있다"고 오독한다.
                  * 흡수처인 '업무 관리'(cmp)는 감추지 않는다 — 전 부서 이행 현황은
                  * 총괄 책임자가 봐야 하는 축이고, 조작은 canAct 가 이미 막는다(§12). */
                 hideNav: ['admin'] },
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
        /* 검토자 관점 — 공문 결재선의 **검토 단계**를 맡는 사람. 종전에는 이 자리에
           페르소나가 없어서, 기본 기안자(박안전)의 결재선이 「검토 김중대 → 결재 홍길동」
           인데도 **검토자 계정으로는 로그인할 수 없었다.** 상신은 결재선 전체를 한 번에
           보내고 기안·검토·결재가 서로 다른 계정이어야 하므로, 세 자리가 다 계정으로
           존재해야 흐름을 끝까지 확인할 수 있다(3계정 = 박안전 → 김중대 → 홍길동).
           uid·부서는 DYV2.ORG 값과 동일해야 한다(§3).
           ※ SUPER_SEED 추가는 필요 없다 — deptId 가 'safety' 라 기존 시드를 쓴다.
           teamLead 를 다는 이유는 문정수(정수팀장) 선례와 같다 — 팀장은 자기 팀 안에서만
           배정한다. 빼면 assignKind 가 'dept' 로 떨어져 부서 전체 배정 권한을 갖는다. */
        { id: 'jjtlead', tier: 'super', uid: 'u_jjt1', name: '김중대', role: '중대재해팀장',
          org: '담양군청 · 재난안전과 중대재해팀', deptId: 'safety', deptName: '재난안전과',
          teamLead: true, team: '중대재해팀',
          desc: '팀장 — 공문 결재선의 검토 단계 · 중대재해팀 업무 배정·감독' },
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

    /* =========================================================================
     * 결재 권한 (DYROLE.canApprove) — '이 문서를 **결재할** 사람인가'
     * -------------------------------------------------------------------------
     * 조회(scope)·조작(canAct)·배정(assignKind)에 이은 **네 번째 축**이다.
     * 판정 기준은 계층(tier)이 아니라 **결재선에 내 uid 가 있는가** 하나다.
     *
     * canAct 로 판정하면 안 되는 이유 — canAct 는 `tier !== 'staff'` 를 전부 막는데
     * 결재자는 정확히 과장·소장(super)·군수(head)다. 그리고 canAct 가 막는 근거는
     * "담당자 이름으로 대신 등록·서명하면 문서 위조"인데, 결재는 대신 하는 것이 아니라
     * **자기 이름으로 하는 결재**라 그 근거가 걸리지 않는다. 배정을 세 번째 축으로 연
     * 것과 같은 논리다(§14-7).
     *
     * ※ 이 시스템에는 **결재함(승인·반려 처리 화면)이 없고 만들지 않는다** — 승인·반려는
     *   온나라에서 일어난다. 이 축이 여는 것은 «내가 결재선에 있다»는 표시와, 아래
     *   inScopeDoc 의 조회 예외 둘뿐이다. 결재를 요청받고 그 문서를 볼 수 없으면
     *   그건 결재선이 아니다.
     * ========================================================================= */
    function roleApprovalStep(line) {
        const p = rolePersona();
        if (!p || !p.uid || !Array.isArray(line)) return '';
        const i = line.findIndex(s => s && s.uid === p.uid);
        if (i < 0) return '';
        return (window.DYDOC && DYDOC.stepLabel) ? DYDOC.stepLabel(i, line.length) : (i === line.length - 1 ? '결재' : '검토');
    }
    function roleCanApprove(line) { return !!roleApprovalStep(line); }
    /* 문서 단위 조회 범위 — 소속 부서이거나, **내가 그 문서의 결재선에 있으면** 보인다.
       결재선에는 타 부서 사람(부군수·군수)이 서므로 부서만으로 거르면 결재자가
       자기가 결재할 문서를 못 본다. */
    function roleInScopeDoc(deptId, line) { return roleInScope(deptId) || roleCanApprove(line); }

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
    /* 헤더 드롭다운이 열리면 단계별 안내 패널을 접는다 — 패널은 --z-fab(90),
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


    /* =========================================================================
     * 네비게이션 데이터 (v2) — 1뎁스(GNB) / 2뎁스(SNB 섹션) / 3뎁스(SNB 항목)
     * -------------------------------------------------------------------------
     * [축은 제안요청서(RFP) §2 「기능 모듈 기준 분류」다]
     *   ① 현황·통계·대시보드·출력 (SFR-018·020·021)
     *   ② 대상/시설 정보 관리      (SFR-002·016)
     *   ③ 계획·방침·의무 이행       (SFR-004·005·014)
     *   ④ 위험성평가·유해위험요인   (SFR-003·007·019)
     *   ⑤ 조직·인력·예산·평가       (SFR-006·008·009·010)
     *   ⑥ 종사자·도급·매뉴얼        (SFR-011·012·013)
     *   ⑦ 공통 기반                 (SFR-001·015·016·017)
     * 재구축 프롬프트 §3 이 약속한 값도 「GNB 6개, 최대 3뎁스」였다. 그 뒤 회의마다
     * 대메뉴가 하나씩 늘어 **16개**가 되면서 GNB 가 가로로 넘쳐 스크롤됐고,
     * 1뎁스에 항목 1개짜리 그룹(작업환경측정·특수건강검진)까지 생겼다.
     * 아래는 **화면을 하나도 지우지 않고** 위 7축으로 1뎁스를 접은 결과다(16 → 11).
     *
     * [뎁스 계약]
     *   1뎁스 = 이 배열의 그룹      → 헤더 GNB 한 줄
     *   2뎁스 = item.section        → 사이드바 섹션 헤더(비클릭). 값이 바뀌면 헤더 삽입
     *   3뎁스 = item               → 사이드바 링크. section 이 있으면 is-nested 들여쓰기
     *   · 항목이 4개 미만이고 축이 하나면 섹션을 두지 않는다 — 항목 2개짜리 표에
     *     머리글을 다는 셈이라 깊이만 늘고 정보가 늘지 않는다.
     *   · hidden:true — GNB/사이드바에 그리지 않지만 **그룹 소속은 유지**한다.
     *     딥링크로 들어온 화면이 엉뚱한 그룹의 사이드바를 달고 뜨는 것을 막는다.
     *
     * [id 는 계약이다 — 바꾸지 말 것]
     *   item.id 는 body[data-dy-page]·DYLAW.MAP(법령 근거)·DYHELP(도움말)·
     *   adm-perm(메뉴 권한 시드)의 키다. 그래서 이번 재편은 **그룹의 소속과 라벨만**
     *   바꾸고 item.id 는 한 글자도 건드리지 않았다(sbm-workenv 가 workenv 그룹에
     *   있는 것도 같은 이유 — CLAUDE.md §10).
     *   그룹 id 도 없애는 대신 **흡수하는 쪽 id 를 재사용**한다
     *   (facil→base · health→workenv · budget→eval · docs/work→cmp).
     *   DYLayout.NAV 는 메뉴 관리·권한 관리·법령 관리의 단일 출처라 여기만 고치면
     *   세 관리 화면이 함께 따라온다.
     * ========================================================================= */
    const NAV = [
        /* ① 대시보드 — RFP 현황·통계·대시보드 (SFR-020·017)
         *   NAV[0] 은 findGroup() 의 폴백이다. 첫 자리를 비우지 말 것. */
        { id: 'dashboard', label: '대시보드', icon: 'grid', items: [
            { id: 'index',   label: '통합 현황', icon: 'grid',  href: 'index.html',   screen: 'SFR-020' },
            { id: 'my-work', label: '내 할일',   icon: 'check', href: 'my-work.html', screen: 'MYW01-V' },
        ]},

        /* ② 기본정보 — RFP 대상/시설 정보 관리 (SFR-002·016)
         *   구 'facil'(시설물 안전관리) 그룹을 2뎁스 섹션으로 흡수했다.
         *   RFP SFR-002 가 「관리대상 현황 + 시설물안전법 1·2·3종 FMS 연계·현행화」를
         *   **한 요구사항**으로 묶고 있어, 둘을 형제 대메뉴로 세우면 같은 요구사항이
         *   1뎁스에 두 번 선다. 시설물 4개 화면은 그대로 살아 있고 경로만 한 단 내려왔다. */
        { id: 'base', label: '기본정보', icon: 'building', items: [
            { id: 'base-targets', section: '관리대상',        label: '관리대상 현황',   icon: 'building', href: 'base-targets.html', screen: 'SFR-002' },
            { id: 'base-bulk',    section: '관리대상',        label: '데이터 일괄등록', icon: 'file',     href: 'base-bulk.html',    screen: 'SFR-016' },
            { id: 'fac-list',     section: '시설물 (FMS 연계)', label: '시설물 대장',   icon: 'list',     href: 'fac-list.html',     screen: 'FAC01-V / SFR-002' },
            { id: 'fac-risk',     section: '시설물 (FMS 연계)', label: '시설물 위험도', icon: 'alert',    href: 'fac-risk.html',     screen: 'FAC03-V / SFR-002' },
            { id: 'fac-sync',     section: '시설물 (FMS 연계)', label: 'FMS 연계',      icon: 'external', href: 'fac-sync.html',     screen: 'FAC04-S / SFR-002' },
            { id: 'fac-settings', section: '시설물 (FMS 연계)', label: '연계 설정',     icon: 'cog',      href: 'fac-settings.html', screen: 'FAC05-S / SFR-002' },
        ]},

        /* ③ 안전보건관리체계 — RFP 계획·방침·의무 이행 (SFR-005·006·013·014)
         *   ※ 2026-07-30 회의 확정 구조 그대로다 — **2카테고리를 더 쪼개지 말 것**
         *     (발주처: "이 두 개만 만들어 주시면 돼요"). 이번 재편에서도 의견청취·
         *     인력·예산을 여기 섹션으로 넣지 않은 이유가 이 지시다.
         *   ※ 도급관리는 직속(section 없음) 유지 — 재무과 계약자료 회신 대기 중이라
         *     두 카테고리 어느 쪽에도 넣지 않고 남겨 둔 자리다. */
        { id: 'sbm', label: '안전보건관리체계', icon: 'shield', items: [
            { id: 'sbm-policy',   section: '중대산업·시민재해 계획',        label: '경영방침', icon: 'shield', href: 'menu.html?m=policy', screen: 'SFR-005' },
            { id: 'sbm-org',      section: '중대산업·시민재해 계획',        label: '조직',     icon: 'users',  href: 'menu.html?m=org',    screen: 'SFR-006·009·010' },
            { id: 'sbm-comply',   section: '중대산업·시민재해 의무 이행점검', label: '이행점검', icon: 'check',  href: 'menu.html?m=comply', screen: 'SFR-008·014' },
            /* 직속 (section 없음) */
            { id: 'sbm-contract', label: '도급관리', icon: 'building', href: 'menu.html?m=contract', screen: 'SFR-013' },
        ]},

        /* ④ 위험성평가 — RFP 위험성평가·유해위험요인·재발방지 (SFR-003·007·019)
         *   개선조치(rsk-imp)는 2026-07-30 회의에서 독립 메뉴 제외 확정 — 정기평가
         *   상세 안에서 부서별로 처리한다. 화면·딥링크는 살아 있으므로 hidden 으로
         *   그룹 소속만 유지한다. 메뉴로 되살리지 말 것. */
        { id: 'risk', label: '위험성평가', icon: 'alert', items: [
            { id: 'rsk-list', label: '정기 위험성평가', icon: 'alert', href: 'rsk-list.html', screen: 'RSK01-L / SFR-007' },
            { id: 'rsk-occ',  label: '수시 위험성평가', icon: 'alert', href: 'rsk-occ.html',  screen: 'RSK03-L / SFR-007' },
            /* 폐지 화면 — 메뉴에 없지만 소속 축은 남긴다. 주소로 열렸을 때
               엉뚱한 그룹(대시보드) 사이드바가 붙는 것을 막는다(SCR-COM-003 §6). */
            { id: 'rsk-proc',       hidden: true, label: '작업공정 관리 (폐지)', icon: 'list',  href: 'rsk-proc.html',       screen: 'SCR-PRC-001' },
            { id: 'rsk-exec',       hidden: true, label: '위험성 추정 (폐지)',   icon: 'alert', href: 'rsk-exec.html',       screen: 'SCR-RISK-003' },
            { id: 'rsk-imp',        hidden: true, label: '개선조치',      icon: 'check', href: 'rsk-imp.html',        screen: 'IMP01-L / SFR-003' },
            { id: 'rsk-imp-detail', hidden: true, label: '개선조치 상세', icon: 'check', href: 'rsk-imp-detail.html', screen: 'IMP01-D / SFR-003' },
        ]},

        /* ⑤ 안전보건교육 — RFP 안전계획·의무이행 점검 (SFR-004·010)
         *   3뎁스 구조는 재설계 v1 §8.5 그대로. 종전에 직속으로 흩어져 있던 뒤쪽 3개
         *   (이수현황·근로자 명단·결재 이력)에 2뎁스 이름을 줬다 — 앞 6개가 섹션을
         *   갖는데 뒤 3개만 구분선 아래 떠 있으면 같은 깊이인지 아닌지 읽히지 않는다. */
        { id: 'edu', label: '안전보건교육', icon: 'user', items: [
            { id: 'edu-reg',      section: '현업근로자',    label: '정기교육',        icon: 'user',  href: 'edu-reg.html',      screen: 'EDU-REG / SFR-004·010' },
            { id: 'edu-hire',     section: '현업근로자',    label: '채용시교육',      icon: 'user',  href: 'edu-hire.html',     screen: 'EDU-HIRE / SFR-004' },
            { id: 'edu-etc',      section: '현업근로자',    label: '기타 교육',       icon: 'user',  href: 'edu-etc.html',      screen: 'EDU-ETC / SFR-004' },
            { id: 'edu-sup',      section: '관리감독자',    label: '정기교육',        icon: 'user',  href: 'edu-sup.html',      screen: 'EDU-SUP / SFR-004' },
            { id: 'edu-sup-hire', section: '관리감독자',    label: '채용시교육',      icon: 'user',  href: 'edu-sup-hire.html', screen: 'EDU-SUP-HIRE / SFR-004' },
            { id: 'edu-sup-etc',  section: '관리감독자',    label: '기타 교육',       icon: 'user',  href: 'edu-sup-etc.html',  screen: 'EDU-SUP-ETC / SFR-004' },
            { id: 'edu-status',   section: '교육 현황·관리', label: '이수현황',        icon: 'chart', href: 'edu-status.html',   screen: 'EDU-STATUS / SFR-004·010' },
            { id: 'edu-workers',  section: '교육 현황·관리', label: '근로자 명단 관리', icon: 'users', href: 'edu-workers.html',  screen: 'EDU-WORKERS / SFR-004' },
            { id: 'edu-approval', section: '교육 현황·관리', label: '결재 이력',       icon: 'file',  href: 'edu-approval.html', screen: 'EDU-APV-LOG / SFR-004' },
        ]},

        /* ⑥ 작업환경·건강 — RFP 안전·보건관리 인력/보건조치 (SFR-010)
         *   2026-07-30 회의에서 안전보건관리체계 하위에서 **대메뉴로 승격**된 두 화면이다
         *   (발주처: "작업 환경 측정 그리고 특수 건강 검진 … 일단 빼주시고").
         *   그 지시는 「안전보건관리체계 밑에 묻지 말라」는 뜻이므로 1뎁스 자리는 지키되,
         *   **항목 1개짜리 GNB 그룹 두 개**로 두지 않고 한 그룹의 형제 항목으로 세웠다.
         *   둘 다 GNB 한 번 클릭으로 사이드바에 함께 보이므로 노출 깊이는 그대로다.
         *   ※ 그룹 id 는 흡수하는 쪽(workenv)을 재사용한다. page id 는 sbm-* 유지 —
         *     DYLAW.MAP 이 이 키에 묶여 있다(CLAUDE.md §10). */
        { id: 'workenv', label: '작업환경·건강', icon: 'gauge', items: [
            { id: 'sbm-workenv', label: '작업환경측정',        icon: 'gauge',    href: 'work-env.html',   screen: 'WEM01-L / SFR-010' },
            { id: 'sbm-health',  label: '건강검진 (일반·특수)', icon: 'activity', href: 'health-exam.html', screen: 'HEX01-L / SFR-010' },
        ]},

        /* ⑦ 의견청취 — RFP 종사자 의견청취 (SFR-011)
         *   안전보건관리체계로 접지 않는다 — 위 ③의 「2카테고리 유지」가 발주처 지시라
         *   세 번째 카테고리를 만들 수 없다. */
        { id: 'opinion', label: '의견청취', icon: 'bell', items: [
            { id: 'opn-voice',     label: '의견청취·건의함',   icon: 'bell',  href: 'menu.html?m=opinion&sub=voice',     screen: 'SFR-011' },
            { id: 'opn-committee', label: '산업안전보건위원회', icon: 'users', href: 'menu.html?m=opinion&sub=committee', screen: 'SFR-011' },
            { id: 'opn-council',   label: '협의체·점검표',     icon: 'check', href: 'menu.html?m=opinion&sub=council',   screen: 'SFR-011' },
        ]},

        /* ⑧ 인력·예산 — RFP 조직·인력·예산·평가 (SFR-008·009)
         *   구 'budget'(예산관리) 그룹을 2뎁스 섹션으로 흡수했다. RFP 는 SFR-008 을
         *   「인력, 예산 편성 및 집행 관리」 **한 요구사항**으로 묶고, 중처법 시행령
         *   §4 도 인력·예산·평가를 같은 호 계열로 둔다. 실제로 두 화면은 같은 사람이
         *   같은 반기에 연다. */
        { id: 'eval', label: '인력·예산', icon: 'coins', items: [
            { id: 'evl-eval',     section: '인력 평가', label: '인력 평가',      icon: 'user',  href: 'evl-eval.html',     screen: 'EVL02-E / SFR-009' },
            { id: 'evl-status',   section: '인력 평가', label: '평가 현황',      icon: 'chart', href: 'evl-list.html',     screen: 'EVL01-V / SFR-009' },
            { id: 'evl-settings', section: '인력 평가', label: '평가 설정',      icon: 'cog',   href: 'evl-settings.html', screen: 'EVL03-S / SFR-009' },
            { id: 'bgt-main',     section: '예산 관리', label: '예산 총괄표',    icon: 'chart', href: 'bgt-main.html',     screen: 'BGT01-V / SFR-008' },
            { id: 'bgt-settings', section: '예산 관리', label: '예산 기준 설정', icon: 'cog',   href: 'bgt-settings.html', screen: 'BGT02-S / SFR-008' },
        ]},

        /* ⑨ 업무 관리 — RFP 안전계획·의무이행 점검 / 관계법령 점검 (SFR-004·012·014)
         *   [구버전 2개 그룹을 여기로 접었다 — 2026-08-28 사용자 지시]
         *   · 구 'docs'(업무문서: 업무 목록·이행 목록) — 신버전 이행 관리·문서 목록이
         *     같은 데이터를 같은 목적으로 다시 그린다. 비교 시연이 끝나 **메뉴에서 뺀다**.
         *   · 구 'work'((구)업무관리: 업무 발행 관리·부서 업무함) — 라벨부터 (구)였다.
         *   지우지 않고 hidden 으로 남기는 이유는 rsk-imp 선례와 같다 — 내 할일·통계·
         *   프리셋 양식 관리 등에서 들어오는 딥링크가 살아 있어서, 그룹 소속까지 없애면
         *   그 화면들이 '대시보드' 사이드바를 달고 뜬다(findGroup 폴백).
         *   ※ 기준문서함(docs-archive)은 구버전이 아니라 **제정·개정 원문 문서함**이라
         *     신버전에 대응 화면이 없다. 그래서 그룹만 옮겨 정식 항목으로 살린다 —
         *     같이 지우면 내 할일의 '분류하러 가기'가 메뉴 없는 화면으로 떨어진다. */
        { id: 'cmp', label: '업무 관리', icon: 'check', items: [
            { id: 'cmp-status',   label: '이행 관리',  icon: 'grid', href: 'cmp-status.html', screen: 'CMP01-T / CMP02-D / CMP04-V' },
            { id: 'cmp-docs',     label: '문서 목록',  icon: 'list', href: 'cmp-docs.html',   screen: 'DOC01-L / DOC02-D' },
            { id: 'docs-archive', label: '기준문서함', icon: 'file', href: 'docs-archive.html', screen: 'SCR-EDOC-010' },
            /* hidden — 메뉴에서 뺀 구버전. 딥링크 호환용이며 **되살리지 말 것**. */
            { id: 'docs-preset', hidden: true, label: '업무 목록 (구)',      icon: 'list',  href: 'docs-preset.html' },
            { id: 'docs-exec',   hidden: true, label: '이행 목록 (구)',      icon: 'grid',  href: 'docs-exec.html' },
            { id: 'work-admin',  hidden: true, label: '업무 발행 관리 (구)', icon: 'list',  href: 'work-admin.html', screen: 'WRK01-L' },
            { id: 'work-dept',   hidden: true, label: '부서 업무함 (구)',    icon: 'users', href: 'work-dept.html',  screen: 'WRK02-L' },
        ]},

        /* ⑩ 통계·보고 — RFP 현황·통계·제증명 (SFR-018·021) */
        { id: 'stats', label: '통계·보고', icon: 'chart', items: [
            { id: 'stats',       label: '현황 통계',     icon: 'chart', href: 'stats.html',       screen: 'SFR-018' },
            { id: 'reports',     label: '보고서·제증명', icon: 'file',  href: 'reports.html',     screen: 'SFR-021' },
            { id: 'info-center', label: '정보센터',      icon: 'list',  href: 'info-center.html' },
        ]},

        /* ⑪ 시스템 관리 — RFP 공통 기반 (SFR-001·015·016·017)
         *   8개가 한 줄로 늘어서 있어 무엇이 '사람'이고 무엇이 '기준값'이고 무엇이
         *   '바깥과 주고받는 설정'인지 읽히지 않았다. 3뎁스로 나눈다. */
        { id: 'admin', label: '시스템 관리', icon: 'cog', items: [
            { id: 'admin-users',       section: '사용자·권한', label: '사용자 관리',      icon: 'users',    href: 'admin-users.html',       screen: 'SFR-015' },
            { id: 'admin-roles',       section: '사용자·권한', label: '권한 관리',        icon: 'cog',      href: 'admin-roles.html',       screen: 'ADM02-S' },
            { id: 'admin-menus',       section: '사용자·권한', label: '메뉴 관리',        icon: 'list',     href: 'admin-menus.html',       screen: 'ADM01-S' },
            { id: 'admin-sites',       section: '기준정보',    label: '사업장 관리',      icon: 'building', href: 'admin-sites.html',       screen: 'ADM03-S' },
            { id: 'admin-presets',     section: '기준정보',    label: '프리셋 양식 관리', icon: 'cog',      href: 'admin-presets.html' },
            /* 법령 관리 — 법령·조문 / 메뉴 근거 매핑 / 변경 이력 3탭 단일 화면
             * (2026-07-30 통합. admin-law-map.html 은 매핑 탭 리다이렉트 스텁) */
            { id: 'admin-law',         section: '기준정보',    label: '법령 관리',        icon: 'file',     href: 'admin-law.html',         screen: 'ADM04-S' },
            { id: 'admin-integration', section: '연계·알림',   label: '연계 관리',        icon: 'external', href: 'admin-integration.html', screen: 'SIR-001' },
            { id: 'admin-notify',      section: '연계·알림',   label: '알림 관리',        icon: 'bell',     href: 'admin-notify.html',      screen: 'SFR-017' },
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
                </div>
                <div class="dy-header-actions" style="display:flex; align-items:center; gap:6px;">
                    <button class="dy-help-btn" id="dy-help-btn" type="button" hidden
                            aria-label="도움말" title="이 화면 사용법">?</button>
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
                    aria-haspopup="dialog" aria-expanded="false" aria-label="사용자 메뉴 — 권한 전환">
                <span class="dy-user-avatar">${p.name.charAt(0)}</span>
                <span class="dy-user-text">
                    <span class="dy-user-name">${p.name} 님 <span class="dy-user-tier">${t.label}</span></span>
                    <span class="dy-user-org">${p.org} · ${p.role}</span>
                </span>
                ${ICON.chevron}
            </button>
        `;
    }

    /* 권한 전환 드롭다운 — 책임체계 3계층 · 페르소나 10인(정본은 ROLE_PERSONAS) */
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
                    <span class="dy-role-drop-title">권한 전환</span>
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
                    /* aria-current — 지금 어느 1뎁스에 있는지는 색(pill)만으로 말하지 않는다.
                       색 단독 의미 금지(§7)와 같은 근거이고, 스크린리더가 GNB 를 훑을 때
                       현재 위치를 알 수 있는 유일한 단서다. */
                    const cur = g.id === activeGroupId;
                    return html`<a class="dy-gnb-item ${cur ? 'is-active' : ''}" href="${href}" ${cur ? 'aria-current="page"' : ''} ${onclick}>${g.label}</a>`;
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
            /* 2뎁스 이름을 링크의 접근성 이름에 붙인다 — 섹션 헤더는 <div> 라 스크린리더가
               링크만 훑을 때는 읽히지 않는다. 안전보건교육에는 '정기교육'·'채용시교육'·
               '기타 교육'이 현업근로자/관리감독자 두 벌씩 있어, 이름이 같은 링크 6개가
               구분 없이 나열된다. 눈으로는 섹션 헤더가 갈라 주지만 소리로는 갈라지지 않는다. */
            const aria = curSection
                ? ` aria-label="${curSection} ${it.label}"` : '';
            const cur = isActive ? ' aria-current="page"' : '';
            return `${prefix}<a class="dy-sidebar-item ${isActive ? 'is-active' : ''} ${it.external ? 'is-external' : ''} ${nestedCls}" href="${href}"${aria}${cur} ${onclick}>
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

            /* 도움말 버튼 — DYHELP.MAP 에 있는 화면에서만 낸다(자체 <main> 을 쓰는
               화면도 있으므로 본문 분기 밖에서 배선한다). 열어 봐야 "준비 중"이라고
               말하는 버튼은 도달할 수 없는 수단이므로 매핑이 없으면 아예 숨긴다. */
            const hb = document.getElementById('dy-help-btn');
            if (hb && window.DYHELP && window.DYHELP.has()) {
                hb.hidden = false;
                hb.addEventListener('click', function () { window.DYHELP.open(); });
            }
            wireGnbOverflow();
            /* 외부 자료·연계 준비사항 — 헤더 칩 카운트 동기화 (DYPOLICY / js/policy-open.js).
               칩이 DOM 에 붙은 **뒤** 불러야 한다. 이 화면 관련 항목이 있으면 칩이 강조된다. */


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

    /* 제목 점 — 정의서로 가는 링크. 뷰어 자신에서는 링크로 만들지 않는다
       (자기 자신으로 가는 링크는 눌러도 아무 일이 없다). */
    function defDotHtml() {
        const base = (location.pathname.split('/').pop() || '').toLowerCase();
        if (base === 'screen-definitions.html' || !base) return '<span class="dy-page-dot"></span>';
        const from = base + (location.search || '');
        return '<a class="dy-page-dot dy-page-dot-link"' +
            ' href="screen-definitions.html?from=' + encodeURIComponent(from) + '"' +
            ' target="_blank" rel="noopener"' +
            ' title="이 화면의 화면 정의서 열기 (새 탭)"' +
            ' aria-label="이 화면의 화면 정의서 열기, 새 탭에서 열립니다"></a>';
    }

        if (title) {
            const titleEl = document.createElement('div');
            titleEl.className = 'dy-page-title';
            /* 제목 앞의 점은 **그 화면의 정의서로 가는 길**이다.
               새 진입점을 만드는 대신 이미 있던 장식에 목적지를 준다 — 업무 화면에
               제작용 버튼을 상시 노출하지 않는다는 규칙(§15)을 지키면서, 검토하는
               사람이 지금 보는 화면의 정의서를 그 자리에서 열 수 있게 한다.
               목적지는 정의서 진입 버튼과 **같은 방식**(현재 파일+쿼리를 넘기면
               뷰어가 해당 화면을 골라 연다)이라 규칙이 한 곳에만 있다.
               새 탭으로 연다 — 보던 화면을 잃지 않고 대조할 수 있어야 한다. */
            titleEl.innerHTML = defDotHtml() + '<h1>' + title + '</h1>';
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

    /* 외부 노출 */
    window.DYLayout = {
        mount,
        _soon: showComingSoon,
        renderPagination,
        renderFilterRow,
        NAV,
        /* 알림 내부 핸들러 (인라인 onclick 용) */
        _ntfFilter: ntfSetFilter,
        _ntfReadAll: ntfMarkAllRead,
        _ntfRead: ntfMarkRead,
    };

    /* 권한 API — 대시보드(js/dashboard.js) 등 화면 모듈이 참조 */
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
        /* 결재 축 — 결재선에 내 uid 가 있는가 (CLAUDE.md §7-1) */
        canApprove: roleCanApprove,
        approvalStep: roleApprovalStep,
        inScopeDoc: roleInScopeDoc,
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
 * 화면 정의서 빠른 진입 — 기획자용 플로팅 버튼. **기본 숨김**(?screendef=on 으로 노출).
 *   · URL 수정 없이 각 페이지에서 바로 그 화면의 정의서를 새 탭으로 연다.
 *   · 클릭 → screen-definitions.html?from=<현재파일+쿼리> (현재 화면 자동 선택).
 *   · 표시: ?screendef=on (이후 유지) / 다시 숨기기: ?screendef=off
 *   · 뷰어(screen-definitions.html) 자신에는 표시하지 않음. 기존 기능에는 영향 없음.
 * ========================================================================= */
(function () {
    'use strict';
    try {
        var p = new URLSearchParams(location.search);
        if (p.get('screendef') === 'on') { try { localStorage.setItem('dy-screendef-show', '1'); } catch (e) {} }
        if (p.get('screendef') === 'off') { try { localStorage.removeItem('dy-screendef-show'); } catch (e) {} }
        /* 기본 숨김 — 업무 화면에 제작용 진입점을 상시 노출하지 않는다.
           기획자는 아무 화면에서 ?screendef=on 을 한 번 붙이면 그 브라우저에서 계속 보인다.
           정의서 문서·뷰어(screen-definitions.html)는 그대로이며 직접 열면 동작한다. */
        var shown = false; try { shown = localStorage.getItem('dy-screendef-show') === '1'; } catch (e) {}
        if (!shown) return;

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
