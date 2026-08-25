/* =========================================================================
 * 담양군 중대재해예방 통합관리시스템 v2 — 공통 헬퍼
 * 문서 3축 모델(data.js) 조회·집계 + 칩/뱃지/모달 렌더 유틸.
 * ========================================================================= */
(function () {
    'use strict';

    /* =========================================================================
     * ★ 기준일 (DEMO_TODAY) — **시연 당일에 이 한 줄만 바꾼다** ★
     * -------------------------------------------------------------------------
     * 프로토타입은 시드 날짜가 고정이라 '오늘'도 고정해야 D-day·기한초과·이수 판정이
     * 서로 맞는다. 종전에는 하드코딩 4곳(2026-07-16 ×3 · 2026-07-14 ×1)과
     * 실제 시스템 날짜 2곳이 섞여 있어 **한 화면 안에서 오늘이 두 개**였다
     * (대시보드는 6월을 '오늘'로, 내 할일은 7-16 기준으로 D-day 를 계산).
     *
     * 이제 전 모듈이 DYV2.today() 하나만 본다 —
     *   dashboard.TODAY · edu-data.TODAY/today() · my-work.TODAY_ISO ·
     *   rsk-data.today()/isOverdue
     *
     * '' (빈 문자열)로 두면 실제 시스템 날짜를 쓴다(실 개발 전환 시).
     * ========================================================================= */
    const DEMO_TODAY = '2026-07-16';

    function realToday() {
        const t = new Date(), mm = t.getMonth() + 1, dd = t.getDate();
        return t.getFullYear() + '-' + (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd;
    }
    /* 전 모듈의 '오늘' 단일 출처 */
    function today() { return DEMO_TODAY || realToday(); }
    /* 두 ISO 날짜의 일수 차 (미래 +, 과거 −) — D-day 계산도 한 곳에서 */
    function daysTo(iso, from) {
        if (!iso) return null;
        const a = new Date(from || today()), b = new Date(iso);
        if (isNaN(a) || isNaN(b)) return null;
        return Math.round((b - a) / 86400000);
    }

    /* 안전보건관리체계 9개 대메뉴 메타 (재구축 프롬프트 §3 — 명칭 문자열 고정)
     * href — 대메뉴 진입 화면. 위험성평가·유해·위험요인 관리는 기존 전용 화면 직결. */
    const MENUS = {
        policy:   { label: '경영방침',           sfr: 'SFR-005',          dept: '재난안전과 중대재해팀', href: 'menu.html?m=policy' },
        org:      { label: '조직',               sfr: 'SFR-006·009·010',  dept: '행정과·재난안전과',     href: 'menu.html?m=org' },
        risk:     { label: '위험성평가',         sfr: 'SFR-007',          dept: '재난안전과 중대재해팀', href: 'rsk-list.html' },
        hazard:   { label: '작업공정 관리',      sfr: 'SFR-007·019',      dept: '재난안전과·환경과',     href: 'rsk-proc.html' },
        edu:      { label: '안전보건교육',       sfr: 'SFR-004·010',      dept: '재난안전과·각 부서',    href: 'edu.html' },  /* edu.html 은 edu-status.html 리다이렉트 스텁 */
        opinion:  { label: '의견청취',           sfr: 'SFR-011',          dept: '재난안전과 중대재해팀', href: 'menu.html?m=opinion' },
        contract: { label: '도급관리',           sfr: 'SFR-013',          dept: '회계과·각 발주부서',    href: 'menu.html?m=contract' },
        improve:  { label: '개선조치',           sfr: 'SFR-003',          dept: '재난안전과 중대재해팀', href: 'rsk-imp.html' },
        /* 2026-07-30 회의 — '이행관리' → '중대산업·시민재해 의무 이행점검'. 부서별 이행 여부 점검이 본질이다. */
        comply:   { label: '이행점검',           sfr: 'SFR-008·014',      dept: '재난안전과·기획예산실', href: 'menu.html?m=comply' },
    };

    /* =========================================================================
     * 조직도 — 단일 출처 (DYV2.ORG)
     *   전 화면의 조직도(경영방침 점검자·의견청취 위원·인력평가 평가자·권한 관리·
     *   조직 요약·예산 기관 등)가 바라보는 유일한 캐노니컬 데이터.
     *   화면별 조직도는 이 트리의 파생 뷰(orgFlat 등)만 사용하고 자체 데이터를 만들지 않는다.
     *   노드 { id, name, type('root'|'post'|'bureau'|'dept'|'team'|'office'|'town'),
     *          members:[{uid, name, role, team?}], children:[...] }
     *   기존 권한 시드가 uid 를 참조하므로 uid 는 절대 변경 금지.
     * ========================================================================= */
    const ORG = {
        id: 'gov', name: '담양군청', type: 'root', members: [], children: [
            { id: 'n_mayor', name: '군수', type: 'post', members: [{ uid: 'u_mayor', name: '김담양', role: '군수' }], children: [
                { id: 'n_vice', name: '부군수', type: 'post', members: [{ uid: 'u_vice', name: '이부군', role: '부군수' }], children: [
                    { id: 'plan', name: '기획예산실', type: 'dept', attrs: {}, members: [
                        { uid: 'u_plan1', name: '서기획', role: '기획예산실장', lead: true },
                        { uid: 'u_plan2', name: '한열람', role: '예산 담당 주무관' },
                    ], children: [] },
                    { id: 'bureau_adm', name: '행정복지국', type: 'bureau', members: [{ uid: 'u_badm', name: '박행정', role: '행정복지국장' }], children: [
                        { id: 'safety', name: '재난안전과', type: 'dept', attrs: {}, members: [
                            { uid: 'u_safe1', name: '홍길동', role: '재난안전과장', lead: true },
                            { uid: 'u_safe2', name: '박담당', role: '안전관리담당' },
                        ], children: [
                            { id: 'jjt', name: '중대재해팀', type: 'team', members: [
                                { uid: 'u_jjt1', name: '김중대', role: '중대재해팀장' },
                                { uid: 'u_jjt2', name: '박안전', role: '안전관리 주무관' },
                                { uid: 'u_jjt3', name: '김안전', role: '안전관리자' },
                            ], children: [] },
                        ] },
                        { id: 'acct', name: '회계과', type: 'dept', attrs: {}, members: [
                            { uid: 'u_acct1', name: '조회계', role: '회계과장', lead: true },
                            { uid: 'u_acct2', name: '최회계', role: '계약·도급 담당 주무관' },
                        ], children: [] },
                        { id: 'env', name: '환경과', type: 'dept', attrs: { fieldWorker: true, publicFacility: true, chemical: true, hazard: true, riskSite: true }, members: [
                            { uid: 'u_env1', name: '차환경', role: '환경과장', lead: true },
                            { uid: 'u_env2', name: '정환경', role: '유해·위험요인 담당 주무관' },
                            { uid: 'u_env3', name: '최보건', role: '보건관리자' },
                            { uid: 'u_env6', name: '조환경', role: '환경지도팀장', team: '환경지도팀', teamLead: true },
                            { uid: 'u_env4', name: '김지도', role: '주무관', team: '환경지도팀' },
                            { uid: 'u_env5', name: '정수빈', role: '주무관', team: '자원순환팀' },
                        ], children: [] },
                        { id: 'culture', name: '문화체육과', type: 'dept', attrs: { fieldWorker: true, publicFacility: true, chemical: true, riskSite: true }, members: [
                            { uid: 'u_cul1', name: '한지훈', role: '주무관', team: '체육시설팀' },
                            { uid: 'u_cul2', name: '오세영', role: '주무관', team: '문화시설팀' },
                        ], children: [] },
                        { id: 'finance', name: '재무과', type: 'dept', attrs: { fieldWorker: true, publicFacility: true, chemical: true, riskSite: true }, members: [
                            { uid: 'u_fin1', name: '최재무', role: '주무관', team: '회계팀' },
                            { uid: 'u_fin2', name: '강세무', role: '주무관', team: '세정팀' },
                        ], children: [] },
                        { id: 'health', name: '보건소', type: 'dept', attrs: { fieldWorker: true, chemical: true, hazard: true }, members: [
                            { uid: 'u_hlth1', name: '강보건', role: '보건소장', lead: true },
                            { uid: 'u_hlth2', name: '이보건', role: '보건행정 주무관' },
                            { uid: 'u_hlth3', name: '윤담당', role: '보건담당' },
                            { uid: 'u_hlth4', name: '백지영', role: '주무관', team: '보건행정과' },
                            { uid: 'u_hlth5', name: '곽문석', role: '주무관', team: '건강증진과' },
                        ], children: [] },
                    ] },
                    { id: 'bureau_ind', name: '산업건설국', type: 'bureau', members: [{ uid: 'u_bind', name: '정산업', role: '산업건설국장' }], children: [
                        { id: 'construct', name: '건설과', type: 'dept', attrs: { fieldWorker: true, publicFacility: true, chemical: true, hazard: true }, members: [
                            { uid: 'u_con1', name: '이건설', role: '건설과장', lead: true },
                            { uid: 'u_con2', name: '박현장', role: '현장안전 담당 주무관' },
                            { uid: 'u_con6', name: '정안전', role: '안전관리팀장', team: '안전관리팀', teamLead: true },
                            { uid: 'u_con3', name: '김도현', role: '주무관', team: '안전관리팀' },
                            { uid: 'u_con4', name: '박서준', role: '주무관', team: '시설관리팀' },
                            { uid: 'u_con5', name: '이준호', role: '주무관', team: '도로관리팀' },
                        ], children: [] },
                        { id: 'facility', name: '공공시설사업소', type: 'office', attrs: { fieldWorker: true, publicFacility: true, chemical: true, hazard: true, riskSite: true }, members: [
                            { uid: 'u_fac1', name: '임시설', role: '공공시설사업소장', lead: true },
                            { uid: 'u_fac2', name: '한담당', role: '시설안전 담당' },
                            { uid: 'u_fac3', name: '한운영', role: '주무관', team: '시설운영팀' },
                            { uid: 'u_fac4', name: '민설비', role: '주무관', team: '환경시설팀' },
                        ], children: [] },
                        { id: 'water', name: '물순환사업소', type: 'office', attrs: { fieldWorker: true, publicFacility: true, chemical: true, hazard: true, riskSite: true }, members: [
                            { uid: 'u_wat1', name: '오순환', role: '물순환사업소장', lead: true },
                            { uid: 'u_wat2', name: '서담당', role: '시설 담당' },
                            /* 팀장 — **예시 자료**다(2026-08-11). 담양군 실제 팀 편제 자료를
                               받으면 통째로 교체한다. teamLead:true 인 사람만 그 팀 배정 권한을
                               갖는다(DYROLE.assignKind → 'team'). */
                            { uid: 'u_wat5', name: '문정수', role: '정수팀장', team: '정수팀', teamLead: true },
                            { uid: 'u_wat3', name: '하정수', role: '주무관', team: '정수팀' },
                            { uid: 'u_wat6', name: '서한별', role: '주무관', team: '정수팀' },
                            { uid: 'u_wat7', name: '남수질', role: '수질관리팀장', team: '수질관리팀', teamLead: true },
                            { uid: 'u_wat4', name: '오수질', role: '주무관', team: '수질관리팀' },
                        ], children: [] },
                    ] },
                    { id: 'town_damyang', name: '담양읍', type: 'town', attrs: { fieldWorker: true, chemical: true, riskSite: true }, members: [
                        { uid: 'u_twn1', name: '노읍장', role: '담양읍장', lead: true },
                        { uid: 'u_twn2', name: '배주민', role: '주민복지 담당' },
                    ], children: [] },
                ] },
            ] },
        ],
    };

    function orgWalk(fn, node) { node = node || ORG; fn(node); (node.children || []).forEach(c => orgWalk(fn, c)); }
    function orgNode(id) { let found = null; orgWalk(n => { if (n.id === id) found = n; }); return found; }
    /* 노드 하위 구성원 수 (includeSub=true 면 하위 부서까지 포함) */
    function orgCount(id, includeSub) {
        const n = orgNode(id); if (!n) return 0; let c = 0;
        (function w(nd, deep) {
            c += (nd.members || []).length;
            if (deep) (nd.children || []).forEach(x => w(x, true));
            else (nd.children || []).forEach(x => { if (x.type === 'team') w(x, false); });
        })(n, !!includeSub);
        return c;
    }
    function orgTotal() { let c = 0; orgWalk(n => { c += (n.members || []).length; }); return c; }
    const isDeptLike = n => n.type === 'dept' || n.type === 'office' || n.type === 'town';
    /* 부서형 노드(dept·office·town) 이름 목록 — 사업장 마스터·작업환경측정 등 부서 선택 공용 파생 */
    function deptNames() { const out = []; orgWalk(n => { if (isDeptLike(n)) out.push(n.name); }); return out; }
    /* 부서형 노드 [{id, name, count}] — deptId 로 저장하는 도메인(위험성평가·안전보건교육)의 부서 선택 공용 파생.
     * orgFlat() 은 EDOC 호환을 위해 id 를 버리고 부서명만 투영하므로 id 기준 화면에서는 이 헬퍼를 쓴다. */
    /* 부서 **이름 → id**. 부서를 이름으로 저장하는 도메인(작업환경측정·건강검진)이
       조회 범위(DYROLE.inScope)를 물어보려면 id 가 필요하다(§3 dept/deptId 이원화).
       못 찾으면 '' 를 돌려주고, inScope('') 는 전사 항목으로 보아 통과시킨다. */
    function deptIdOf(name) {
        var n = String(name == null ? '' : name).trim();
        if (!n) return '';
        var found = '';
        orgWalk(function (x) {
            if (found) return;
            if (['dept', 'office', 'town'].indexOf(x.type) >= 0 && x.name === n) found = x.id;
        });
        return found;
    }
    function orgDepts() {
        const out = [];
        orgWalk(n => { if (isDeptLike(n)) out.push({ id: n.id, name: n.name, count: orgCount(n.id) }); });
        return out;
    }
    /* =========================================================================
     * uid 를 살린 구성원 파생 — orgFlat() 은 EDOC 호환을 위해 uid·team 을 버린다.
     * 업무 배정(assign.to)은 이름이 아니라 **uid** 로 저장해야 동명이인·개명에
     * 견딘다. ORG 원본은 건드리지 않는 순수 파생이다(CLAUDE.md §3).
     *   orgMembers(deptId)  → [{uid, name, role, team, deptId, deptName, lead}]
     *   팀 노드(children.type==='team') 구성원은 team 이름을 달고 함께 나온다.
     * ========================================================================= */
    function orgMembers(deptId) {
        const n = orgNode(deptId);
        if (!n) return [];
        const out = [];
        (function collect(nd, teamName) {
            (nd.members || []).forEach(m => out.push({
                uid: m.uid, name: m.name, role: m.role,
                team: m.team || teamName || '', deptId: n.id, deptName: n.name,
                lead: !!m.lead, teamLead: !!m.teamLead,
            }));
            (nd.children || []).forEach(c => { if (c.type === 'team') collect(c, c.name); });
        })(n, '');
        return out;
    }
    /* 팀 투영 — 노드형(type:'team')과 문자열형(members[].team)을 한 형태로 합친다.
       담양군 실제 팀 편제 미확보 상태라 source 로 근거를 밝힌다(지어내지 않는다). */
    function orgTeams(deptId) {
        const ms = orgMembers(deptId);
        const map = new Map();
        ms.forEach(m => {
            const key = m.team || '';
            if (!map.has(key)) map.set(key, { name: key, source: key ? 'label' : '', members: [] });
            map.get(key).members.push(m);
        });
        const n = orgNode(deptId);
        (n && n.children || []).forEach(c => {
            if (c.type === 'team' && map.has(c.name)) map.get(c.name).source = 'node';
        });
        return Array.from(map.values()).filter(t => t.name);
    }
    /* 부서 속성 — 자동발행 대상 부서 산정의 단일 출처. 없으면 빈 객체(속성 미확인) */
    function orgAttrs(deptId) { const n = orgNode(deptId); return (n && n.attrs) || {}; }
    function orgHasAttr(deptId, attr) { return !!orgAttrs(deptId)[attr]; }

    /* EDOC 호환 평면 투영: [{dept, members:[[role,name],...]}]
     *   부서형 노드(dept·office·town) 단위 그룹핑, 팀 노드 구성원은 소속 과에 합산.
     *   기본적으로 지휘부(post·bureau 직속: 군수·부군수·국장)는 제외. */
    function orgFlat(opts) {
        opts = opts || {};
        const out = [];
        const isDeptLike = n => n.type === 'dept' || n.type === 'office' || n.type === 'town';
        function collect(n, acc) {
            (n.members || []).forEach(m => acc.push([m.role, m.name]));
            (n.children || []).forEach(c => { if (c.type === 'team') collect(c, acc); });
        }
        (function walk(n) {
            if (isDeptLike(n)) {
                const acc = []; collect(n, acc);
                out.push({ dept: n.name, members: acc });
                (n.children || []).forEach(c => { if (c.type !== 'team') walk(c); });
            } else {
                if (opts.includeLeadership && (n.type === 'post' || n.type === 'bureau') && (n.members || []).length) {
                    out.push({ dept: n.name, members: n.members.map(m => [m.role, m.name]) });
                }
                (n.children || []).forEach(walk);
            }
        })(ORG);
        return out;
    }

    const docs = () => window.DY_DOCS || [];

    /* =========================================================================
     * 브레이크포인트 — 단일 출처 (DYV2.BP)
     *   CSS 토큰 --bp-*(css/style.css :root)와 같은 값. JS 의 matchMedia 는
     *   1023 같은 리터럴을 쓰지 말고 이 상수를 참조한다.
     *   DYV2.below(k) → 해당 단계 "미만" 여부(예: below('lg') = 1023px 이하).
     * ========================================================================= */
    const BP = { xl: 1280, lg: 1024, md: 768, sm: 560 };
    function below(key) {
        return window.matchMedia('(max-width: ' + (BP[key] - 1) + 'px)').matches;
    }

    /* =========================================================================
     * 상태 라벨 → tone 매핑 — 단일 출처 (DYV2.STATUS_TONE)
     *   전 화면의 상태 배지는 이 표만 바라본다. 새 상태 어휘가 필요하면 여기에
     *   추가하고, 화면에서 색(tone)을 직접 고르지 않는다.
     *   tone 6종은 style.css --status-{tone}-bg/border/fg 페어와 1:1 대응.
     * ========================================================================= */
    const STATUS_TONE = {
        '완료': 'success', '적합': 'success', '승인': 'success', '이행': 'success',
        '진행': 'info', '진행중': 'info', '검토중': 'info', '접수': 'info',
        '미착수': 'neutral', '미완료': 'neutral', '해당없음': 'neutral', '대기': 'neutral',
        /* 마감이 아직 남은 법정 의무 — 대시보드 법정 의무 캘린더·로드맵 어휘 */
        '예정': 'info',
        /* 부서 전수 이행 체크리스트 (dept-check.js) — 미이행·미게시는 조치 대상이라 danger */
        '게시': 'success', '미이행': 'danger', '미게시': 'danger',
        '지연': 'warning', '보완필요': 'warning', '보완 필요': 'warning', '주의': 'warning',
        '기한초과': 'danger', '기한 초과': 'danger', '부적합': 'danger', '반려': 'danger',
        '수시': 'purple', '임시저장': 'purple',
        /* 업무 관리 이행 판정 — 분류기준 v3.3 「단계별현황」 시트의 어휘 그대로다.
           조건부 항목이 0건인 것은 «안 한 것»이 아니라 «조건이 없었던 것»이라
           미이행(danger)과 다른 색이어야 한다. */
        '사유 미발생': 'info', '대상 미발생': 'info', '산출 불가': 'neutral',
        /* 안전보건교육 (edu-*) — 이수 상태·명단 출처 */
        '미이수': 'neutral', '정상 이수': 'success', '지연 이수': 'warning',
        '인사연동': 'info', '직접등록': 'neutral', '엑셀업로드': 'purple',
        /* 안전보건교육 — 온나라 결재 상태 (미상신→결재중→결재완료 / 반려) */
        '미상신': 'neutral', '상신': 'info', '결재중': 'info', '결재완료': 'success',
        /* 경영방침 버전 — 현행이 아닌 것은 '아직 결재 못 받은 신규본'과 '지나간 이력'으로 갈린다.
           둘을 같은 색으로 두면 방금 만든 방침이 과거 것으로 읽힌다. */
        '결재 대기': 'warning', '이력': 'neutral',
        /* 법령 관리 (admin-law·admin-law-map) — 조문 생애주기·수집·매핑 판정.
         * 수집 결과 검토의 짝은 '승인'·'보류' 지만 **'승인' 은 맨 위 공통 어휘에만 둔다** —
         * 업무 발행 확인(work-admin)·위험성평가 이력(rsk-data)도 같은 말을 쓰므로 도메인
         * 구획에 두면 그 도메인 전용 어휘로 읽힌다. 종전에는 위와 여기 두 번 선언돼
         * 있었고 값이 같아 증상이 없었을 뿐이다 — 한쪽만 고치면 **뒤에 선언된 쪽이
         * 조용히 이기고** 앞의 주석 맥락은 그대로 남아 다음 사람이 안 먹는 줄을 고친다. */
        '현행': 'success', '보관': 'neutral', '대체됨': 'purple', '시행 전': 'info',
        '신규': 'purple', '내용 변경': 'warning', '시행일 변경': 'warning', '변경 없음': 'neutral',
        '수집 실패': 'danger', '보류': 'warning',
        '근거 있음': 'success', '근거 없음(확정)': 'neutral', '미판단': 'warning',
        '반영 안 됨': 'danger', '개발 수정 필요': 'danger',
        '법령 매핑 대기': 'warning', '검증 기록 없음': 'warning',
        '재검토 요청': 'warning', '의무 근거': 'neutral', '주기·기준 근거': 'info',
        '산업재해 축': 'neutral', '시민재해 축': 'info', '정상': 'success',
        '일치': 'success', '불일치': 'danger',
        /* 업무 자동발행 (work-*) — 배정 축은 '아직 안 한 것'과 '아무도 안 맡은 것'을
         * 구분해야 부서장이 놓치지 않는다. '접수'(info)는 원자료 문서구분 어휘로
         * 예약돼 있어 재사용하지 않고 '제출'을 따로 둔다. */
        '미배정': 'warning', '미배정 지연': 'danger', '미제출': 'danger',
        '제출': 'info', '반송': 'warning', '후보': 'purple', '종결': 'success', '취소': 'neutral',
        /* 업무문서 (docs-exec·docs-preset) — 문서 출처 4종.
         * 판정이 아니라 **분류**라서 색은 구분용이다(명단 출처 '인사연동/직접등록/
         * 엑셀업로드' 와 같은 용법). 라벨을 항상 함께 쓴다. */
        '온나라': 'info', '전자문서': 'purple', '직접 첨부': 'neutral', '프로그램': 'success',
        /* 업무문서 — 출처별 업무 흐름 상태. 서로 다른 출처의 상태를 하나의 거짓된
         * 공통 단계로 환산하지 않는다(UX설계 §5-3). */
        '작성중': 'info', '등록완료': 'success', '확정': 'success',
        '검토대기': 'warning', '확인완료': 'success', '미시행': 'neutral',
        /* 업무문서 — 증빙 축 보조 어휘 */
        '재확인 필요': 'warning', '중복 의심': 'warning', '미분류': 'warning', '분류완료': 'success',
        /* 업무 관리(신) — 이행 관리·문서 목록(cmp-status·cmp-docs, DYCMP.judge).
         * '진행중·지연·미이행'은 위 어휘를 그대로 쓰고 둘만 새로 든다.
         *  · 충족  = 도래 회차를 전부 채웠다('완료'와 다르다 — 완료는 재난안전과 확인까지 끝난 것)
         *  · 비해당 = 저장값은 DYDOCS 의 '해당없음'이고 화면 표기만 비해당이다 */
        '충족': 'success', '비해당': 'neutral',
        /* 연계 관리 (admin-integration) — 연계 실행 결과와, 결과를 낼 수 없는 상태.
         * '성공'은 위 '정상'(success)과, '실패'는 '수집 실패'(danger)와 같은 축이다.
         *  · 지연·주의 = 예정 주기를 넘겼으나 실패는 아니다 → warning. 카드 단계상태
         *               (정상 → 지연·주의 → 실패 → 점검 필요) 중 **유일한 경고 단계**다.
         *               위에 '지연'·'주의' 가 따로 있어도 이 라벨은 걸리지 않는다 —
         *               합성어가 아니라 한 어휘이고 이 표는 정확 일치로만 찾는다.
         *               빠뜨리면 neutral 로 떨어져 «예정 주기를 넘긴 연계»와 «연계 이력
         *               미구현» 카드가 픽셀 단위로 같아지고, 경고 단계가 화면에서 사라진다.
         *  · 부분 실패 = 일부 건만 실패했다. 전건 실패와 같은 색으로 두면 담당자가
         *               이미 넘어간 성공분까지 다시 보낸다 → warning.
         *               ※ 지금 이 라벨을 만드는 코드는 없다(연계 로그는 성공·실패·수집
         *                 실패만 낸다). 정의서가 약속한 로그 상태라 자리를 비워 두지
         *                 않을 뿐이니, **있는 상태로 오해하지 말 것.**
         *  · 점검 필요 = 세 번 연속 실패라 재시도로 풀리지 않는다. 사람이 원인을
         *               없애야 하므로 warning 이 아니라 danger 다.
         * 아래 셋은 비슷해 보이지만 «아직 없는 것»과 «잘못된 것»으로 갈린다 — 합치지 말 것.
         * 셋을 한 색으로 뭉치면 화면이 정상 상태를 장애로, 장애를 정상으로 말하게 된다.
         *  · 연계 이력 미구현 = 상태를 파생할 원본(연계 기록) 자체가 없다 → neutral
         *  · 수신 기록 없음   = 연계는 붙었는데 아직 한 건도 안 받았다   → neutral
         *  · 자료 미확보     = 판단할 자료를 못 불러왔다 — 뭔가 잘못됐다 → warning */
        '성공': 'success', '지연·주의': 'warning', '실패': 'danger',
        '부분 실패': 'warning', '점검 필요': 'danger',
        '연계 이력 미구현': 'neutral', '수신 기록 없음': 'neutral', '자료 미확보': 'warning',
        /*  · 확인 중      = 화면이 아직 그리기 전의 초기 표시값 — 판정 전이라 중립
         *  · 0000 성공    = 시설물 전송이 남기는 원본 응답값(응답코드 + 결과). 화면이
         *                   '성공'으로 각색하면 기록을 왜곡하므로 원본대로 두고 여기서 색을 준다
         *  · 재시도 요청  = 사람이 재시도를 누른 사실. 성공도 실패도 아니라 중립 */
        '확인 중': 'neutral', '0000 성공': 'success', '재시도 요청': 'neutral',
        /* 선임계 첨부 여부(조직 화면) — 선임 완료와 서류 완비는 다른 문제라 어휘를 나눈다.
           같은 '완료'로 쓰면 표에서 두 열이 같은 말을 해 서류 공백이 눈에 안 띈다. */
        '첨부': 'success', '미첨부': 'warning',
    };
    /* 매핑에 없는 라벨은 neutral 로 수렴(색을 임의로 만들지 않는다). */
    function toneOf(label) { return STATUS_TONE[String(label || '').trim()] || 'neutral'; }

    /* ── 첨부파일 업로드 제약 (지원 형식·용량·개수) — 단일 출처 ── */
    const FILE_LIMITS = {
        formats: 'HWP · HWPX · PDF · DOC(X) · XLS(X) · PPT(X) · JPG · PNG · ZIP',
        /* formats 의 기계 판독용 대응쌍 — 실제 input accept·확장자 검증에 사용 */
        extensions: ['hwp', 'hwpx', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'zip'],
        maxMB: 20, maxCount: 10,
    };
    /* 업로드 영역 하단에 붙이는 안내 문구 HTML */
    function fileHint() {
        return '<p class="file-hint"><b>지원 형식</b> ' + FILE_LIMITS.formats +
            ' <span class="fh-sep">·</span> <b>파일당 최대</b> ' + FILE_LIMITS.maxMB + 'MB' +
            ' <span class="fh-sep">·</span> <b>최대</b> ' + FILE_LIMITS.maxCount + '개</p>';
    }

    /* ── 접근성 업로드 드롭존 — 단일 출처 (fileHint 와 동일한 §2 원칙) ──
     * .upload-drop 은 cursor:pointer·hover 강조로 "클릭하여 업로드" 어포던스를 약속하므로,
     * 마우스뿐 아니라 키보드 활성화까지 반드시 배선한다(WCAG 2.1.1/4.1.2). 새 업로드 UI 는
     * 드롭존을 직접 쓰지 말고 이 헬퍼를 재사용한다.
     *   labelHtml : 드롭존 내부 표시(HTML 허용).
     *   onAct     : 활성화 시 실행할 인라인 JS 표현식(기존 onclick 관례대로 작은따옴표 문자열).
     *               생략 시 프로토타입 토스트. 실제 등록/제출은 모달 하단 [등록]·[제출] 버튼이 담당.
     *   opts.hint : true → fileHint() 를 함께 렌더하고 aria-describedby 로 제약 문구를 연결.
     *   opts.style: 드롭존에 덧붙일 인라인 style 문자열.
     *   opts.pick : **실제 파일 선택**을 붙인다. 값은 선택 결과를 받을 전역 함수 경로 문자열이며
     *               fn(files) 형태로 [{name, size, type}] 배열을 받는다. onAct 는 무시된다.
     *               지정하면 숨은 <input type="file"> 을 함께 렌더하고 클릭·키보드·**끌어놓기**를
     *               모두 이 입력으로 연결한다. accept 는 FILE_LIMITS.extensions 파생.
     *   opts.multiple : opts.pick 과 함께 쓰면 다중 선택 허용.
     *
     *   ※ 종전에는 실제 input 을 붙이려면 화면이 드롭존 마크업을 직접 써야 해서 §2 의 예외로
     *      남아 있었다. 이 헬퍼가 실제 입력까지 감당하므로 새 화면은 예외 없이 여기만 쓰면 된다. */
    let _dropSeq = 0;
    function dropKey(e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();          /* Space 스크롤 방지 + 클릭으로 활성화 경로 단일화 */
            e.currentTarget.click();
        }
    }
    /* 전역 함수 경로 문자열('RSKLIST.onPickSurvey')을 실제 함수로 해석 */
    function _resolveFn(path) {
        return String(path || '').split('.').reduce(function (o, k) { return o ? o[k] : null; }, window);
    }
    /* 선택·드롭된 파일을 검증해 소비처로 넘긴다 — 형식·용량·개수 규칙은 FILE_LIMITS 단일 출처.
     * 검증을 화면마다 다시 쓰면 어떤 경로는 20MB 초과 파일을 그대로 통과시키게 된다. */
    function acceptFiles(fileList, path, multiple) {
        const all = Array.prototype.slice.call(fileList || []);
        if (!all.length) return;
        const ok = [], bad = [];
        all.forEach(function (f) {
            const ext = (f.name.split('.').pop() || '').toLowerCase();
            if (FILE_LIMITS.extensions.indexOf(ext) === -1) { bad.push(f.name + ' — 지원하지 않는 형식'); return; }
            if (f.size > FILE_LIMITS.maxMB * 1024 * 1024) { bad.push(f.name + ' — ' + FILE_LIMITS.maxMB + 'MB 초과'); return; }
            ok.push({ name: f.name, size: f.size, type: f.type, _f: f });
        });
        if (bad.length) toast('첨부할 수 없는 파일 ' + bad.length + '건 — ' + bad[0]);
        if (!ok.length) return;
        const use = multiple ? ok.slice(0, FILE_LIMITS.maxCount) : ok.slice(0, 1);
        const fn = _resolveFn(path);
        if (typeof fn !== 'function') return;
        /* 이미지면 썸네일을 만들어 붙인 뒤 넘긴다 — 소비처가 각자 캔버스를 돌리면
           축소 규격이 화면마다 갈린다. 비이미지는 그대로 즉시 전달. */
        withThumbs(use, function (items) { fn(items); });
    }

    /* ── 이미지 썸네일 ───────────────────────────────────────────────
     * 원본 dataURL 을 저장소에 넣으면 sessionStorage 용량(약 5MB)이 사진 몇 장에
     * 바로 잠식된다. 그래서 **저장은 축소 썸네일(THUMB_MAX)만** 하고, 원본은
     * 메모리 objectURL(`url`)로만 들고 있다가 미리보기에서 쓴다. 새로고침하면
     * objectURL 은 죽으므로 미리보기는 썸네일로 자동 폴백해야 한다. */
    const THUMB_MAX = 480, THUMB_Q = 0.7;
    const IMG_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    function isImageFile(f) {
        if (!f) return false;
        if (f.thumb) return true;
        const ext = (String(f.name || '').split('.').pop() || '').toLowerCase();
        return IMG_EXT.indexOf(ext) !== -1;
    }
    function withThumbs(items, cb) {
        const targets = items.filter(function (it) { return it._f && isImageFile(it); });
        let left = targets.length;
        const finish = function () {
            items.forEach(function (it) { delete it._f; });   /* File 은 직렬화되지 않는다 — 저장 전에 뗀다 */
            cb(items);
        };
        if (!left) return finish();
        targets.forEach(function (it) {
            const done = function () { if (--left === 0) finish(); };
            try { it.url = URL.createObjectURL(it._f); } catch (e) { /* 미리보기는 썸네일로 폴백 */ }
            const reader = new FileReader();
            reader.onload = function () {
                const img = new Image();
                img.onload = function () {
                    try {
                        const s = Math.min(1, THUMB_MAX / Math.max(img.width, img.height));
                        const c = document.createElement('canvas');
                        c.width = Math.max(1, Math.round(img.width * s));
                        c.height = Math.max(1, Math.round(img.height * s));
                        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                        it.thumb = c.toDataURL('image/jpeg', THUMB_Q);
                        it.w = img.width; it.h = img.height;
                    } catch (e) { /* 썸네일 없이도 파일명으로는 동작한다 */ }
                    done();
                };
                img.onerror = done;
                img.src = reader.result;
            };
            reader.onerror = done;
            reader.readAsDataURL(it._f);
        });
    }
    function dropFiles(e, path, multiple) {
        e.preventDefault(); e.stopPropagation();
        e.currentTarget.classList.remove('is-dragover');
        acceptFiles(e.dataTransfer && e.dataTransfer.files, path, multiple);
    }
    function dropOver(e, on) {
        e.preventDefault(); e.stopPropagation();
        e.currentTarget.classList.toggle('is-dragover', !!on);
    }
    function uploadDrop(labelHtml, onAct, opts) {
        opts = opts || {};
        const style = opts.style ? ' style="' + opts.style + '"' : '';
        let desc = '', hint = '', input = '', act = onAct || "DYV2.notReady('파일 선택', '문서관리 연계')";
        let dnd = '';
        if (opts.pick) {
            const fid = 'updrop-file-' + (++_dropSeq);
            const accept = FILE_LIMITS.extensions.map(function (x) { return '.' + x; }).join(',');
            const p = esc(opts.pick), m = opts.multiple ? 'true' : 'false';
            act = "document.getElementById('" + fid + "').click()";
            input = '<input type="file" id="' + fid + '" accept="' + accept + '"' +
                (opts.multiple ? ' multiple' : '') + ' style="display:none"' +
                ' onchange="DYV2.acceptFiles(this.files, \'' + p + '\', ' + m + '); this.value=\'\';">';
            /* 드롭존이 "끌어다 놓기"를 문구로 약속하므로 실제로 받는다 */
            dnd = ' ondragover="DYV2.dropOver(event, true)" ondragleave="DYV2.dropOver(event, false)"' +
                ' ondrop="DYV2.dropFiles(event, \'' + p + '\', ' + m + ')"';
        }
        if (opts.hint) {
            const hid = 'updrop-hint-' + (++_dropSeq);
            desc = ' aria-describedby="' + hid + '"';
            hint = fileHint().replace('class="file-hint"', 'class="file-hint" id="' + hid + '"');
        }
        return '<div class="upload-drop" role="button" tabindex="0"' + style +
            ' onclick="' + act + '" onkeydown="DYV2.dropKey(event)"' + dnd + desc + '>' +
            labelHtml + '</div>' + input + hint;
    }

    function byMenu(key) { return docs().filter(d => d.menuKey === key); }

    /* 이행률: 대메뉴 내 이행+프로그램 문서 중 status=완료 비율 */
    function complianceRate(key) {
        const target = byMenu(key).filter(d => d.workType !== '첨부');
        if (!target.length) return 0;
        return Math.round(target.filter(d => d.status === '완료').length / target.length * 100);
    }

    /* 시기도래: due가 있고 미완료인 문서 수 (대메뉴 단위) */
    function dueCount(key) {
        return byMenu(key).filter(d => d.due && d.status !== '완료').length;
    }

    /* ── 렌더 유틸 ── */
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

    function statusChip(st) {
        const cls = st === '완료' ? 'st-done' : st === '진행' ? 'st-doing' : 'st-todo';
        return '<span class="chip-mini ' + cls + '">' + esc(st) + '</span>';
    }
    function workTypeChip(wt) {
        const cls = wt === '프로그램' ? 'wt-program' : wt === '이행' ? 'wt-elec' : 'wt-attach';
        return '<span class="chip-mini ' + cls + '">' + esc(wt) + '</span>';
    }
    function processTypeChip(pt) {
        const cls = pt === '프로그램' ? 'wt-program' : pt === '전자문서' ? 'wt-elec' : 'wt-attach';
        return '<span class="chip-mini ' + cls + '">' + esc(pt) + '</span>';
    }
    function pdcaChip(p) {
        if (!p) return '';
        return '<span class="chip-mini pdca">' + esc(p) + '</span>';
    }
    function lawChip(law) {
        return '<span class="chip-mini wt">' + esc(law || '-') + '</span>';
    }
    function unassignedBadge() { return '<span class="badge-unassigned">분류 미확정</span>'; }
    function secondReviewBadge() { return '<span class="badge-second-review">안전점검 계열</span>'; }

    /* ── 모달 (페이지에 #v2-modal 컨테이너 없으면 동적 생성) ──
     * opts.variant — 크기·크롬 변형. 문서 미리보기·라이트박스도 자작 오버레이를 만들지 말고
     *   이 경로를 쓴다(단일 모달 불변식이 openModal→closeModal 에서 자동 유지됨).
     *     'wide'     : 문서(PDF) 전체화면 미리보기 — 96vw × 92vh
     *     'lightbox' : 이미지 확대 — 크롬 없이 어두운 스크림 위 이미지만
     * opts.headHtml — 헤더 제목 우측에 끼울 도구 버튼(예: [PDF 다운로드]). */
    function openModal(title, bodyHtml, footHtml, opts) {
        /* 본문 교체(마법사 STEP 전환)도 이 경로를 지난다 — 여기서 닫기 가드를 태우면
           재렌더가 막혀 모달이 두 겹으로 쌓인다. 레이어만 걷어내고 가드는 유지한다. */
        removeLayers();
        opts = opts || {};
        const wrap = document.createElement('div');
        /* opts.chrome — 셸(헤더) 크롬 모달임을 표시한다. 업무 흐름의 일부가 아니므로
           단계별 안내가 여기에 '입력 도움말' 안내를 주입하지 않는다(DYTOUR.syncModalState).
           표시가 없으면 투어가 떠 있을 때 자료 준비 모달 위에 엉뚱한 단계 안내가 붙었다. */
        wrap.className = 'modal' + (opts.variant ? ' modal-' + opts.variant : '') +
            (opts.chrome ? ' dy-modal-chrome' : '');
        wrap.id = 'v2-modal';
        wrap.innerHTML =
            '<div class="modal-backdrop" onclick="DYV2.closeModal()"></div>' +
            '<div class="modal-content" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
              '<div class="modal-header">' +
                '<span class="modal-title">' + title + '</span>' +
                '<span class="modal-head-tools">' + (opts.headHtml || '') +
                  '<button class="modal-close" type="button" aria-label="닫기" onclick="DYV2.closeModal()">&times;</button>' +
                '</span>' +
              '</div>' +
              '<div class="modal-body">' + bodyHtml + '</div>' +
              (footHtml ? '<div class="modal-footer">' + footHtml + '</div>' : '') +
            '</div>';
        document.body.appendChild(wrap);
        document.addEventListener('keydown', escClose);
    }
    function escClose(e) { if (e.key === 'Escape') closeModal(); }

    /* ── 닫기 가드 — 입력 중인 모달이 조용히 버려지지 않게 ──────────────────
     * 종전에는 취소 버튼에만 폐기 확인을 걸 수 있었고 X · 백드롭 · Esc 는 곧장
     * closeModal() 로 빠져 3단계 마법사의 입력이 아무 말 없이 사라졌다. 닫는 길이
     * 넷인데 확인은 하나에만 있으면 그건 확인이 아니다.
     *   setModalGuard(fn) — fn() 이 false 를 돌려주면 닫지 않는다.
     *   모달을 실제로 닫을 때(또는 가드가 필요 없어질 때) 반드시 해제한다.
     * 가드는 openModal 이 본문을 갈아끼울 때는 유지된다(같은 흐름의 STEP 전환). */
    let _modalGuard = null;
    function setModalGuard(fn) { _modalGuard = typeof fn === 'function' ? fn : null; }
    function clearModalGuard() { _modalGuard = null; }
    /* 단일 모달 규칙(UI-RULE: 한 시점에 모달은 1개) — 본 모달과 함께 부수 오버레이도 제거해 잔류 레이어 방지.
     * 규칙 전문은 프로젝트 루트 CLAUDE.md 참고. */
    /* DOM 레이어만 제거 — 가드는 건드리지 않는다(재렌더용) */
    function removeLayers() {
        const m = document.getElementById('v2-modal');
        if (m) m.remove();
        ['org-tree-overlay', 'reg-owner-overlay', 'stack-overlay'].forEach(id => {
            const o = document.getElementById(id); if (o) o.remove();
        });
        document.removeEventListener('keydown', escClose);
    }
    /* 실제 '닫기' — 가드가 막으면 false 를 돌려주고 아무것도 지우지 않는다.
       force 는 소비처가 이미 확인을 받았거나 저장을 마친 뒤 부르는 길이다. */
    function closeModal(force) {
        if (!force && _modalGuard) { try { if (_modalGuard() === false) return false; } catch (e) {} }
        _modalGuard = null;
        removeLayers();
        return true;
    }

    function toast(msg) {
        let t = document.getElementById('toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'toast';
            t.className = 'toast';
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.classList.add('show');
        clearTimeout(window.__toastTimer);
        window.__toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
    }

    /* ── 문서 카드 클릭 공통 액션 ──
     * processType=전자문서 → 프리셋 등록폼 모달 / 첨부파일 → 업로드 모달 / 프로그램 → [이동]
     */
    function openDoc(docId) {
        const d = docs().find(x => x.id === docId);
        if (!d) return;
        if (d.processType === '프로그램') {
            const m = MENUS[d.menuKey];
            window.location.href = m ? m.href : 'docs-archive.html';
            return;
        }
        if (d.processType === '전자문서') {
            /* 전자문서 → e-Doc 엔진 표준 폼에서 값 입력 (작성중→등록완료→확정·온나라 상신) */
            if (window.EDOC) { window.EDOC.openForDoc(d.id); return; }
        }
        /* 첨부파일 */
        openModal('기준문서 업로드',
            '<div style="margin-bottom:14px;">' + processTypeChip(d.processType) + ' ' + lawChip(d.law) +
              ' <span class="chip-mini wt">' + esc(d.version) + '</span></div>' +
            '<p style="font-size:13px; font-weight:600; margin-bottom:12px;">' + esc(d.name) + '</p>' +
            uploadDrop('파일을 끌어다 놓거나 클릭하여 업로드<br><span style="font-size:12px;">다중 첨부 가능 · 업로드 시 버전 이력이 자동 기록됩니다</span>', null, { hint: true }),
            '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" onclick="DYV2.closeModal(); DYV2.notReady(\'파일 업로드\', \'문서관리 연계\')">업로드</button>'
        );
    }

    /* =========================================================================
     * 접을 수 있는 화면 안내 (DYV2.notice) — 첫 방문엔 필요하고 매일은 소음이다.
     * -------------------------------------------------------------------------
     * 실측(2026-08-11): 안내 문구가 화면 글자수의 15~26% 를 차지하고 있었다.
     * 내 할일은 803자 중 206자가 안내였다. 처음 한 번은 읽어야 하지만 매일
     * 여는 사람에게는 **첫 데이터까지의 거리**만 늘린다.
     *   · 기본은 펼침 — 처음 오는 사람이 못 읽고 지나치면 안 된다.
     *   · 닫으면 localStorage 에 기억한다(화면별 id).
     *   · 접힌 상태에서도 **첫 문장은 남긴다** — 통째로 사라지면 무슨 화면인지
     *     모르게 된다. 여는 버튼만 남기는 것과 다르다.
     * ========================================================================= */
    const NOTICE_KEY = 'dy-notice-closed-v1';
    function noticeClosed() {
        try { return JSON.parse(localStorage.getItem(NOTICE_KEY) || '{}'); } catch (e) { return {}; }
    }
    function noticeToggle(id) {
        const m = noticeClosed();
        /* 지금 화면 상태를 보고 뒤집는다 — 저장값이 없을 수도(기본 접힘) 있으므로
           !m[id] 로 뒤집으면 첫 클릭이 먹지 않는다. */
        const el0 = document.getElementById('dyn-' + id);
        const nowFolded = el0 ? el0.classList.contains('is-folded') : !!m[id];
        m[id] = !nowFolded;
        try { localStorage.setItem(NOTICE_KEY, JSON.stringify(m)); } catch (e) {}
        const el = document.getElementById('dyn-' + id);
        if (el) el.classList.toggle('is-folded', !!m[id]);
        const btn = el && el.querySelector('.dy-notice-btn');
        if (btn) {
            btn.setAttribute('aria-expanded', m[id] ? 'false' : 'true');
            btn.textContent = m[id] ? '자세히 ▾' : '접기 ▴';
        }
    }
    /* lead: 접혔을 때도 남는 한 줄 · rest: 접히는 본문
     * opts.foldedByDefault — 사용자가 한 번도 손대지 않았을 때의 기본을 '접힘'으로.
     *   §14-12 의 "기본은 펼침(처음 오는 사람이 놓치면 안 된다)" 은 그 화면에 **다른
     *   안내 장치가 없을 때**의 규칙이다. 단계별 안내 바가 흐름을 이미 설명하는
     *   화면에서는 안내가 같은 말을 반복하며 목록만 아래로 민다.
     *   한 번이라도 여닫으면 그 선택을 따른다(노출/접힘 둘 다 명시 저장). */
    function notice(id, lead, rest, opts) {
        const m = noticeClosed();
        const folded = (m[id] === undefined)
            ? !!(opts && opts.foldedByDefault)
            : !!m[id];
        return '<div class="check-notice dy-notice' + (folded ? ' is-folded' : '') + '" id="dyn-' + esc(id) + '">' +
            /* lead 는 텍스트 노드로 시작할 수 있다 — span 으로 감싸야 flex 가 먹는다
               (안 감싸면 첫 <b> 만 flex 아이템이 되어 뒷말이 버튼 쪽으로 밀린다) */
            '<div class="dy-notice-lead"><span class="dy-notice-text">' + lead + '</span>' +
                (rest ? '<button type="button" class="dy-notice-btn" aria-expanded="' + (folded ? 'false' : 'true') +
                    '" aria-controls="dyn-' + esc(id) + '-body" onclick="DYV2.noticeToggle(\'' + esc(id) + '\')">' +
                    (folded ? '자세히 ▾' : '접기 ▴') + '</button>' : '') +
            '</div>' +
            (rest ? '<div class="dy-notice-body" id="dyn-' + esc(id) + '-body">' + rest + '</div>' : '') +
        '</div>';
    }

    /* 조사 — 받침 유무로 은/는·이/가·으로/로 를 고른다.
       "게시으로 등록하려면" 처럼 어긋난 조사가 화면에 나가지 않게 한 곳에 둔다.
       종전에는 rsk-list.js·tour-core.js 가 같은 함수를 각자 갖고 있었다. */
    function josa(word, withJong, withoutJong) {
        var t = String(word == null ? '' : word).trim();
        if (!t) return withJong;
        var c = t.charCodeAt(t.length - 1);
        var has = (c >= 0xac00 && c <= 0xd7a3) ? ((c - 0xac00) % 28) > 0 : false;
        return has ? withJong : withoutJong;
    }

    /* =========================================================================
     * 표 내려받기 (DYV2.tableFile) — 화면에서 보고 있는 표를 파일로
     * -------------------------------------------------------------------------
     * [형식이 CSV 인 이유] 이 프로토타입은 빌드도 외부 라이브러리도 없다.
     * 진짜 .xlsx 는 ZIP 컨테이너라 라이브러리 없이 만들 수 없다. 그래서 UTF-8
     * BOM 을 붙인 CSV 로 낸다 — 엑셀이 바로 열고 한글이 깨지지 않는다.
     *   · BOM 이 없으면 엑셀(Windows)이 CP949 로 읽어 전부 깨진다. 빼지 말 것.
     *   · 버튼 라벨에 «엑셀»만 쓰고 CSV 를 주면 거짓말이 된다. 라벨은 호출부가
     *     «엑셀 내려받기»로 쓰되 확장자와 형식을 화면 문구로 함께 밝힌다.
     *
     * [수식 인젝션 방어 (MUST)] = + - @ 로 시작하는 값은 엑셀이 **수식으로 실행**
     * 한다. 문서 제목에 그런 글자가 들어오면 남의 파일에서 코드가 도는 셈이라,
     * 앞에 작은따옴표를 붙여 문자열로 고정한다(CSV Injection).
     *
     * [앞자리 0] 문서번호·전화번호가 «0123» 이면 엑셀이 123 으로 바꾼다. 숫자만
     * 으로 이루어졌고 0 으로 시작하면 따옴표로 감싸도 소용없어 = 수식 표기를
     * 쓴다 — 여기서는 값 앞에 작은따옴표를 붙이는 같은 방법으로 처리한다.
     * ========================================================================= */
    function csvCell(v) {
        var t = (v == null) ? '' : String(v);
        t = t.replace(/\r\n|\r|\n/g, ' ');                  /* 줄바꿈은 칸을 깨뜨린다 */
        if (/^[=+@\t]/.test(t)) t = "'" + t;                  /* 수식 인젝션 차단 */
        else if (/^-/.test(t) && !/^-?\d+(\.\d+)?$/.test(t)) t = "'" + t;
        else if (/^0\d+$/.test(t)) t = "'" + t;               /* 앞자리 0 보존 */
        return /[",;]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
    }
    /* head: ['열1','열2'] · rows: [['a','b'], ...] */
    function csvText(head, rows) {
        var lines = [];
        if (head && head.length) lines.push(head.map(csvCell).join(','));
        (rows || []).forEach(function (r) { lines.push((r || []).map(csvCell).join(',')); });
        return '\uFEFF' + lines.join('\r\n') + '\r\n';     /* BOM + CRLF */
    }
    /* 파일명 — 공백·경로문자를 지우고 날짜를 붙인다. 같은 표를 두 번 받아도
       어느 시점 것인지 파일명만으로 구분된다. */
    function fileStamp(parts) {
        var t = (parts || []).filter(Boolean).join('_')
            .replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '');
        return t + '_' + today().replace(/-/g, '') + '.csv';
    }
    function download(filename, blob) {
        var a = document.createElement('a');
        var url = URL.createObjectURL(blob);
        a.href = url; a.download = filename; a.style.display = 'none';
        document.body.appendChild(a); a.click();
        setTimeout(function () {
            try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch (e) {}
        }, 100);
    }
    /* 화면이 부르는 단 하나의 창구. 0건이면 내보내지 않고 그 사실을 말한다 —
       빈 파일을 주면 «받았는데 비었다»를 사용자가 열어 본 뒤에야 안다. */
    function tableFile(nameParts, head, rows, note) {
        if (!rows || !rows.length) { toast('내보낼 자료가 없습니다 — 조건에 맞는 행이 0건입니다.'); return false; }
        var name = fileStamp(nameParts);
        var text = csvText(head, rows);
        /* 꼬리말 — 파일 한 장만 봐도 «무엇을 언제 어떤 조건으로 뽑았는지»가 남는다.
           표에서 두 줄 떨어뜨려 붙이므로 엑셀에서 표 영역과 섞이지 않는다.
           note: [['항목','값'], ...] */
        if (note && note.length) {
            text += '\r\n' + csvText(null, [['— 내려받기 정보 —']].concat(note))
                .replace(/^\uFEFF/, '');
        }
        download(name, new Blob([text], { type: 'text/csv;charset=utf-8' }));
        toast(name + ' 내려받기 (' + rows.length + '행)');
        return true;
    }


    /* =========================================================================
     * 아직 동작하지 않는 것 — 성공한 것처럼 말하지 않는다 (DYV2.notReady)
     * -------------------------------------------------------------------------
     * 파일 실물·외부 연계가 없어 누르면 아무 일도 일어나지 않는 자리가 있다.
     * 「저장했습니다」라고 말하면 저장하지 않고 저장했다고 하는 것이고,
     * 문구를 자리마다 손으로 쓰면 표현이 갈린다. 창구를 하나로 둔다.
     *   notReady('문서 뷰어')                → 문서 뷰어는 전자문서 연계 적용 후 제공됩니다
     *   notReady('서식 내려받기', '파일 등록') → …는 파일 등록 후 제공됩니다
     * ========================================================================= */
    function notReady(what, after) {
        toast(String(what) + josa(what, '은', '는') + ' ' + (after || '연계 적용') + ' 후 제공됩니다');
    }

    /* 예시 자료 칩 — 실제 기록이 아닌 값에 붙인다(§ 자료 출처 표기 단일 출처).
       칩을 지우는 것이 아니라 어휘만 바꾼 것이다 — 없애면 실적으로 읽힌다. */
    function sampleChip(note) {
        return '<span class="chip-mini wt" title="' +
            esc(note || '실제 제출·접수 기록이 아닌 예시 자료입니다.') + '">예시 자료</span>';
    }

    window.DYV2 = {
        MENUS, byMenu, complianceRate, dueCount,
        esc, josa, statusChip, workTypeChip, processTypeChip, pdcaChip, lawChip,
        unassignedBadge, secondReviewBadge,
        openModal, closeModal, setModalGuard, clearModalGuard, toast, openDoc,
        docs, FILE_LIMITS, fileHint, uploadDrop, dropKey,
        /* 실제 파일 선택·끌어놓기 (uploadDrop opts.pick 이 인라인으로 호출) */
        TODAY: DEMO_TODAY, today, daysTo, realToday,
        acceptFiles, dropFiles, dropOver, isImageFile,
        BP, below, STATUS_TONE, toneOf,
        notice, noticeToggle, notReady, sampleChip,
        /* 표 내려받기 — 엑셀이 여는 UTF-8 BOM CSV (§7 단일 창구) */
        tableFile, csvText, csvCell, fileStamp, download,
        ORG, orgFlat, orgNode, orgCount, orgTotal, orgWalk, deptNames, orgDepts, deptIdOf,
        /* 업무 배정용 파생 — uid 를 살린다(orgFlat 은 EDOC 호환으로 uid 를 버린다) */
        orgMembers, orgTeams, orgAttrs, orgHasAttr,
    };
})();
