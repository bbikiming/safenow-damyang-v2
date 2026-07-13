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
    };

    /* --- 네비게이션 데이터 (v2) ---
     *   담양군_프로토타입_v2_재구축_프롬프트.md §3 IA 기준 — GNB 6개, 최대 3뎁스.
     *   안전보건관리체계 9개 대메뉴는 공통 레이아웃 1개(menu.html)에 데이터 주입 (?m= 파라미터).
     *   각 아이템: id — body[data-dy-page]와 매칭되면 활성 표시 / sfr — 제안요청서 매핑(참고)
     */
    const NAV = [
        // GNB 1. 대시보드 (SFR-020·017)
        { id: 'dashboard', label: '대시보드', icon: 'grid', items: [
            { id: 'index', label: '통합 현황', icon: 'grid', href: 'index.html', screen: 'SFR-020' },
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

        // GNB. 위험성평가 — 레퍼런스 정합 재구현 (작업공정 → 평가 → 개선조치). 위험성평가 그룹이 개선조치 '정본'.
        //    작업공정관리(PRC01-L) · 위험성평가 목록(RSK01-L) · 개선조치(IMP01-L) — 독립 HTML, sub 화면은 부모 id 공유
        { id: 'risk', label: '위험성평가', icon: 'alert', items: [
            { id: 'rsk-proc', label: '작업공정 관리', icon: 'list',  href: 'rsk-proc.html', screen: 'PRC01-L / SFR-007' },
            { id: 'rsk-list', label: '위험성평가',    icon: 'alert', href: 'rsk-list.html', screen: 'RSK01-L / SFR-007' },
            { id: 'rsk-imp',  label: '개선조치',      icon: 'check', href: 'rsk-imp.html',  screen: 'IMP01-L / SFR-003' },
        ]},

        // GNB 4. 안전보건관리체계 — 핵심 대메뉴, 공통 레이아웃 menu.html 공유
        //    ※ 위험성평가·유해위험요인·개선조치는 위 '위험성평가' 그룹으로 이관(레퍼런스 정본). rsk-imp.html 등 스텁은 하위호환 유지.
        { id: 'sbm', label: '안전보건관리체계', icon: 'shield', items: [
            { id: 'sbm-policy',   label: '경영방침',           icon: 'shield',   href: 'menu.html?m=policy',   screen: 'SFR-005' },
            { id: 'sbm-org',      label: '조직',               icon: 'users',    href: 'menu.html?m=org',      screen: 'SFR-006·009·010' },
            { id: 'sbm-edu',      label: '안전보건교육',       icon: 'user',     href: 'edu.html',             screen: 'SFR-004·010' },  // 전용 화면 (기획 v1 §4)
            { id: 'sbm-contract', label: '도급관리',           icon: 'building', href: 'menu.html?m=contract', screen: 'SFR-013' },
            { id: 'sbm-comply',   label: '이행관리',           icon: 'coins',    href: 'menu.html?m=comply',   screen: 'SFR-008·014' },
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
        //    ※ (2차 검토) 안전점검: v2에서 메뉴를 만들지 않음 — 점검 계열 문서는 기준문서함 "2차 검토 대상" 뱃지
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
            { id: 'admin-users',       label: '사용자 관리',      icon: 'users', href: 'admin-users.html',       screen: 'SFR-015' },
            { id: 'admin-menus',       label: '메뉴 관리',        icon: 'list',  href: 'admin-menus.html',       screen: 'ADM01-S' },
            { id: 'admin-roles',       label: '권한 관리',        icon: 'cog',   href: 'admin-roles.html',       screen: 'ADM02-S' },
            { id: 'admin-notify',      label: '알림 관리',        icon: 'bell',  href: 'admin-notify.html',      screen: 'SFR-017' },
            { id: 'admin-presets',     label: '프리셋 양식 관리', icon: 'cog',   href: 'admin-presets.html' },
            { id: 'admin-integration', label: '연계 관리',        icon: 'cog',   href: 'admin-integration.html', screen: 'SIR-001' },
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
                    <div class="dy-ntf-wrap" id="dy-ntf-wrap" style="position:relative;">
                        <button class="dy-ntf-btn" id="dy-ntf-btn" type="button" aria-label="알림">
                            ${ICON.bell}
                            <span class="dy-ntf-badge" id="dy-ntf-badge">3</span>
                        </button>
                        <div class="dy-ntf-dropdown" id="dy-ntf-dropdown" role="dialog" aria-hidden="true">
                            <div class="dy-ntf-dropdown-head">
                                <span class="dy-ntf-dropdown-title">알림 <span class="dy-ntf-count">(안 읽음 3건)</span></span>
                                <button class="dy-ntf-read-all" type="button" onclick="window.DYLayout._soon(event, '모두 읽음 처리')">모두 읽음</button>
                            </div>
                            <div class="dy-ntf-dropdown-list">
                                <a class="dy-ntf-item is-unread" href="menu.html?m=policy">
                                    <span class="dy-ntf-dot approval"></span>
                                    <div class="dy-ntf-item-body">
                                        <div class="dy-ntf-item-head">
                                            <span class="dy-ntf-item-cat approval">결재</span>
                                        </div>
                                        <div class="dy-ntf-item-title">안전·보건 목표와 경영방침 결재 요청 (온나라)</div>
                                        <div class="dy-ntf-item-time">14:23</div>
                                    </div>
                                </a>
                                <a class="dy-ntf-item is-unread" href="base-targets.html">
                                    <span class="dy-ntf-dot assignment"></span>
                                    <div class="dy-ntf-item-body">
                                        <div class="dy-ntf-item-head">
                                            <span class="dy-ntf-item-cat assignment">지정</span>
                                        </div>
                                        <div class="dy-ntf-item-title">군청 청사 관리책임자로 자동 지정</div>
                                        <div class="dy-ntf-item-time">09:15</div>
                                    </div>
                                </a>
                                <a class="dy-ntf-item is-unread" href="menu.html?m=comply">
                                    <span class="dy-ntf-dot compliance"></span>
                                    <div class="dy-ntf-item-body">
                                        <div class="dy-ntf-item-head">
                                            <span class="dy-ntf-item-cat compliance">이행</span>
                                        </div>
                                        <div class="dy-ntf-item-title">의무이행 점검표 반기 마감 기한 초과 (D+8)</div>
                                        <div class="dy-ntf-item-time">08:00</div>
                                    </div>
                                </a>
                                <a class="dy-ntf-item" href="docs-archive.html">
                                    <span class="dy-ntf-dot inspection"></span>
                                    <div class="dy-ntf-item-body">
                                        <div class="dy-ntf-item-head">
                                            <span class="dy-ntf-item-cat inspection">점검</span>
                                        </div>
                                        <div class="dy-ntf-item-title">기준문서함 2차 검토 대상 16건 분류 확인 요청</div>
                                        <div class="dy-ntf-item-time">어제 18:00</div>
                                    </div>
                                </a>
                                <a class="dy-ntf-item" href="rsk-list.html">
                                    <span class="dy-ntf-dot risk"></span>
                                    <div class="dy-ntf-item-body">
                                        <div class="dy-ntf-item-head">
                                            <span class="dy-ntf-item-cat risk">위험성평가</span>
                                        </div>
                                        <div class="dy-ntf-item-title">2026 정기 위험성평가 평가자 지정</div>
                                        <div class="dy-ntf-item-time">어제 14:30</div>
                                    </div>
                                </a>
                            </div>
                            <a class="dy-ntf-dropdown-foot" href="admin-notify.html">전체 보기 (42건) →</a>
                        </div>
                    </div>
                    <button class="dy-user-pill" type="button" aria-label="사용자 메뉴">
                        <span class="dy-user-avatar">박</span>
                        <span class="dy-user-text">
                            <span class="dy-user-name">박안전 님</span>
                            <span class="dy-user-org">담양군청 · 안전건설과</span>
                        </span>
                        ${ICON.chevron}
                    </button>
                </div>
            </header>
        `;
    }

    function renderGnb(activeGroupId) {
        return html`
            <nav class="dy-gnb">
                ${NAV.map(g => {
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
        return html`
            <aside class="dy-sidebar" id="dy-sidebar">
                <div class="dy-sidebar-inner">
                    <div class="dy-sidebar-title">${activeGroup.label}</div>
                    <nav class="dy-sidebar-nav">
                        ${activeGroup.items.map(it => {
                            const isActive = it.id === activePageId;
                            const href = it.href || '#';
                            const onclick = it.soon
                                ? `onclick="return window.DYLayout._soon(event, '${it.soon}')"`
                                : '';
                            const externalIcon = it.external
                                ? `<span class="dy-sidebar-item-external" aria-label="다른 메뉴로 이동" title="다른 GNB로 이동">${ICON.external}</span>`
                                : '';
                            return html`
                                <a class="dy-sidebar-item ${isActive ? 'is-active' : ''} ${it.external ? 'is-external' : ''}" href="${href}" ${onclick}>
                                    <span class="dy-sidebar-item-icon">${ICON[it.icon] || ICON.dot}</span>
                                    <span>${it.label}</span>
                                    ${externalIcon}
                                </a>
                            `;
                        }).join('')}
                    </nav>
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

                // [data-pagination] 마커 자동 렌더
                renderPaginationMarkers(main);

                // 3자 책임 라인 푸터 자동 주입 (v0.2 LAW-PERM)
                injectThreePartyFooter(main);

                bodyGrid.appendChild(main);
            } else {
                const ph = document.createElement('main');
                ph.className = 'dy-main';
                injectPageTitle(ph);
                injectThreePartyFooter(ph);
                bodyGrid.appendChild(ph);
            }

            if (outer) {
                outer.replaceWith(layout);
            } else {
                document.body.insertBefore(layout, document.body.firstChild);
            }

            wireMobileMenu();
            wireNotification();
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

    /* 3자 책임 라인 푸터 자동 주입 (v0.2 LAW-PERM)
     *  - 컨설팅 안전일터관리원 · 구축 ㈜다온플레이스 · 발주 담양군청
     *  - 페이지 내 이미 .three-party-footer 가 있으면 건너뜀
     */
    function injectThreePartyFooter(mainEl) {
        if (!mainEl || mainEl.querySelector('.three-party-footer')) return;
        const footer = document.createElement('footer');
        footer.className = 'three-party-footer';
        footer.style.cssText = 'text-align:center; padding:12px; font-size:12px; color:#888; border-top:1px solid #eee; margin-top:24px;';
        footer.innerHTML = '컨설팅 <strong>안전일터관리원</strong> · 구축 <strong>㈜다온플레이스</strong> · 발주 <strong>담양군청 (재난안전과 중대재해팀)</strong>' +
            '<span style="margin-left:12px; opacity:0.7;">프로토타입 v2</span>';
        mainEl.appendChild(footer);
    }

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
        };
        const open = () => {
            dropdown.classList.add('is-open');
            dropdown.setAttribute('aria-hidden', 'false');
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

        /* 알림 아이템 클릭 시 드롭다운 닫기 (기본 링크 동작은 유지) */
        dropdown.querySelectorAll('.dy-ntf-item, .dy-ntf-dropdown-foot').forEach(item => {
            item.addEventListener('click', () => close());
        });
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
            wrap.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99999;font-size:12px;';
            wrap.innerHTML =
                '<a href="screen-definitions.html?from=' + encodeURIComponent(from) + '" target="_blank" rel="noopener" ' +
                'title="이 화면의 화면 정의서 보기 (새 탭)" ' +
                'style="display:inline-flex;align-items:center;gap:6px;background:#24785C;color:#fff;' +
                'padding:9px 14px;border-radius:22px;box-shadow:0 2px 10px rgba(0,0,0,.25);' +
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
