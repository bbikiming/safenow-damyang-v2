/* =========================================================================
 * 담양군 중대재해예방 통합관리시스템 v2 — 시스템 관리 공용 코어 (DYADM)
 *   메뉴 관리(ADM01-S) · 권한 관리(ADM02-S) 두 화면 공용.
 *   · 계층형 조직도 ORG — 단일 출처 DYV2.ORG(js/common.js) 참조 (자체 조직도 금지)
 *   · 6등급 시드 + 메뉴 권한 프리셋 시드 (localStorage 'dy-adm-perm-v2')
 *   · 공용 복수선택 조직도 모달 openOrgPicker (DYV2.openModal 1개 — 적층 금지)
 *   · 사용자 기준 실효 권한 계산(effectiveForUser) — 사용자 관리 역조회에서 사용
 *   · 데모 데이터 초기화(resetDemo)
 *
 * 결정 반영(docs/planning/기획-시스템관리-메뉴권한-검토-v1.md D1~D8):
 *   D1 보기/수정 체크는 메뉴 관리의 지정 행 · 권한 관리는 구성원만 · '전체 권한'은 등급 속성
 *   D2 등급/직접 지정 병존 → 통합 목록 · 중복 경로는 높은 권한 우선(합집합)
 *   D3 기본 6등급 · 부서별 담당자는 메뉴별 개별 지정
 *   D4 미설정 = 기본 차단(시스템 관리자 제외) · 트리 '미설정' 배지 (실제 GNB 숨김은 미구현)
 *   D5 '수정' = 등록·수정·삭제·상신 포함
 *   D8 복수 선택형 단일 모달
 * ========================================================================= */
(function () {
    'use strict';

    const KEY = 'dy-adm-perm-v2';   /* 조직도 단일 출처(DYV2.ORG) 통합 — 시드 버전 상향 */
    const esc = s => (window.DYV2 && DYV2.esc)
        ? DYV2.esc(s)
        : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const NAV = () => (window.DYLayout && DYLayout.NAV) || [];

    /* =====================================================================
     * 1. 계층형 조직도 ORG — 단일 출처 DYV2.ORG(js/common.js) 참조.
     *    원본 트리는 이 파일에서 정의하지 않는다(자체 조직도 금지). 인덱싱·시드·
     *    피커·실효 권한 계산은 모두 이 참조 트리를 기준으로 한다. common.js 는
     *    adm-perm.js 보다 먼저 로드된다(admin-menus.html·admin-users.html 검증).
     * ===================================================================== */
    const ORG = (window.DYV2 && window.DYV2.ORG) || { id: 'gov', name: '담양군청', type: 'root', members: [], children: [] };

    /* ── ORG 인덱스 (평탄화) ── */
    const NODE = {};          /* nodeId → node */
    const PARENT = {};        /* nodeId → parentId */
    const PEOPLE = [];        /* {uid, name, role, deptId, deptName} */
    const PERSON = {};        /* uid → person */
    const UID_BY_NAME = {};   /* name → uid */
    (function indexOrg(node, parentId) {
        NODE[node.id] = node;
        PARENT[node.id] = parentId || null;
        (node.members || []).forEach(m => {
            const p = { uid: m.uid, name: m.name, role: m.role, deptId: node.id, deptName: node.name };
            PEOPLE.push(p); PERSON[m.uid] = p; UID_BY_NAME[m.name] = m.uid;
        });
        (node.children || []).forEach(c => indexOrg(c, node.id));
    })(ORG, null);
    const ALL_UIDS = PEOPLE.map(p => p.uid);

    function nodeById(id) { return NODE[id] || null; }
    function personByUid(uid) { return PERSON[uid] || null; }
    function uidOf(name) { return UID_BY_NAME[name]; }

    /* 노드 하위 인원 uid 목록. includeSub=false → 직속 구성원만 / true → 하위 부서 포함 */
    function membersUnder(nodeId, includeSub) {
        const n = NODE[nodeId]; const out = [];
        (function walk(nd, deep) {
            if (!nd) return;
            (nd.members || []).forEach(m => out.push(m.uid));
            if (deep) (nd.children || []).forEach(c => walk(c, true));
        })(n, !!includeSub);
        return out;
    }
    function isUnder(uid, nodeId, includeSub) { return membersUnder(nodeId, includeSub).indexOf(uid) !== -1; }
    function nodeHasChildren(nodeId) { const n = NODE[nodeId]; return !!(n && n.children && n.children.length); }

    /* =====================================================================
     * 2. 메뉴(중메뉴) 목록 — DYLayout.NAV 단일 출처
     * ===================================================================== */
    function groups() { return NAV(); }
    function middleMenus() {
        const out = [];
        NAV().forEach(g => (g.items || []).forEach(it => out.push({
            id: it.id, label: it.label, href: it.href || '', screen: it.screen || '',
            groupId: g.id, groupLabel: g.label,
        })));
        return out;
    }
    function menuById(id) { return middleMenus().find(m => m.id === id) || null; }
    function isAdminMenu(id) { const m = menuById(id); return !!(m && m.groupId === 'admin'); }

    /* =====================================================================
     * 3. 스토어 + 시드
     * ===================================================================== */
    function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
    function persist(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }

    /* 메뉴 1건의 기본 권한 프리셋 — 최초 시드와 신규 메뉴 병합이 같은 규칙을 쓴다.
     *   시스템 관리자(fullAccess)는 개별 지정 없음(자동). 시스템 관리 하위 = 지정 없음(관리자 전용).
     *   base-bulk = 프리셋 제외(미설정 배지 시연).
     * 병합에서 이 함수를 쓰지 않으면 NAV 에 추가된 신규 메뉴가 권한 0건으로 들어가
     * 기존 스토어를 가진 브라우저에서만 '미설정'으로 보인다. */
    function defaultPerms(m) {
        if (m.groupId === 'admin') return [];
        if (m.id === 'base-bulk') return [];
        return [
            { kind: 'role', id: 'mayor', view: true, edit: false },
            { kind: 'role', id: 'exec', view: true, edit: false },
            { kind: 'role', id: 'manager', view: true, edit: false },
            { kind: 'role', id: 'team', view: true, edit: true },
            { kind: 'role', id: 'staff', view: true, edit: (m.id === 'opn-voice') },
        ];
    }

    function seed() {
        /* ── 6등급 ──
         *   members: [{kind:'user', id:uid}] 또는 [{kind:'dept', id:nodeId, includeSub}]
         *   fullAccess: 전체 권한 플래그 / autoAll: 구성원 자동(전 직원) / protected: 보호 등급 */
        const managerMembers = PEOPLE
            .filter(p => /(과장|팀장|소장)/.test(p.role))
            .map(p => ({ kind: 'user', id: p.uid }));

        const roles = [
            { id: 'sys', name: '시스템 관리자', desc: '메뉴·권한·프리셋·연계 등 시스템 관리 전체를 운영하는 관리자 등급.',
              protected: true, fullAccess: true, autoAll: false, members: [{ kind: 'user', id: uidOf('박안전') }] },
            { id: 'mayor', name: '군수', desc: '중대재해처벌법상 경영책임자 — 전 업무 메뉴 열람.',
              protected: false, fullAccess: false, autoAll: false, members: [{ kind: 'user', id: uidOf('김담양') }] },
            { id: 'exec', name: '부군수·국장', desc: '부군수 및 국장 — 전 업무 메뉴 열람.',
              protected: false, fullAccess: false, autoAll: false, members: [
                  { kind: 'user', id: uidOf('이부군') }, { kind: 'user', id: uidOf('박행정') }, { kind: 'user', id: uidOf('정산업') },
              ] },
            { id: 'manager', name: '과장·팀장', desc: '과장·팀장·소장 등 관리감독자 — 전 업무 메뉴 열람.',
              protected: false, fullAccess: false, autoAll: false, members: managerMembers },
            { id: 'team', name: '전담부서(중대재해 총괄)', desc: '재난안전과 중대재해팀 — 전 업무 메뉴 등록·수정 총괄.',
              protected: false, fullAccess: false, autoAll: false, members: [{ kind: 'dept', id: 'jjt', includeSub: true }] },
            { id: 'staff', name: '일반 공무원', desc: 'SSO 로그인 전 직원 — 대시보드·통계 등 열람 + 의견청취 등록.',
              protected: false, fullAccess: false, autoAll: true, members: [] },
        ];

        /* ── 메뉴 권한 프리셋 ──
         *   시스템 관리자(fullAccess)는 개별 지정 없음(자동). 시스템 관리 하위 6개 = 지정 없음(관리자 전용).
         *   base-bulk = 프리셋 제외(미설정 배지 시연). */
        const menuPerms = {};
        const menuUsage = {};
        middleMenus().forEach(m => {
            menuUsage[m.id] = true;
            menuPerms[m.id] = defaultPerms(m);
        });
        /* 개별 지정 3건 (부서 1 · 사용자 2) */
        /* 안전보건교육 재설계 v1(2026-07-20): sbm-edu → edu 그룹 분리, 대표 화면 edu-status 에 개별 권한 이관 */
        if (menuPerms['edu-status']) menuPerms['edu-status'].push({ kind: 'dept', id: 'health', includeSub: false, view: true, edit: true });
        if (menuPerms['sbm-hazard']) menuPerms['sbm-hazard'].push({ kind: 'user', id: uidOf('정환경'), view: true, edit: true });
        if (menuPerms['sbm-contract']) menuPerms['sbm-contract'].push({ kind: 'user', id: uidOf('최회계'), view: true, edit: true });

        const d = { roles, menuPerms, menuUsage, v: 1 };
        persist(d);
        return d;
    }

    let _data = load();
    if (!_data || !_data.roles || !_data.menuPerms || !_data.menuUsage) { _data = seed(); }
    else {
        /* 시드 병합: NAV에 있는데 스토어에 없는 메뉴 키 보강 (신규 메뉴 대비).
         * 최초 시드와 같은 defaultPerms 를 써야 신규 메뉴가 '권한 미설정'으로 보이지 않는다. */
        middleMenus().forEach(m => {
            if (!(m.id in _data.menuPerms)) _data.menuPerms[m.id] = defaultPerms(m);
            if (!(m.id in _data.menuUsage)) _data.menuUsage[m.id] = true;
        });
    }
    function data() { return _data; }
    function save() { persist(_data); }
    function resetDemo() { _data = seed(); return _data; }

    /* =====================================================================
     * 4. 등급 · 메뉴 권한 조회/변경
     * ===================================================================== */
    function roles() { return _data.roles; }
    function roleById(id) { return _data.roles.find(r => r.id === id) || null; }

    /* 등급 실효 구성원 uid 집합 */
    function roleMemberUids(role) {
        if (!role) return [];
        if (role.autoAll) return ALL_UIDS.slice();
        const set = {};
        (role.members || []).forEach(m => {
            if (m.kind === 'user') set[m.id] = 1;
            else if (m.kind === 'dept') membersUnder(m.id, m.includeSub).forEach(u => set[u] = 1);
        });
        return Object.keys(set);
    }
    function roleMemberCountLabel(role) {
        if (!role) return '0명';
        if (role.autoAll) return '자동(전 직원)';
        return roleMemberUids(role).length + '명';
    }
    function userInRole(uid, role) { return roleMemberUids(role).indexOf(uid) !== -1; }

    /* 메뉴 권한 배열 (참조) — 편집 시 controller가 clone 후 setAssignments 로 저장 */
    function getAssignments(menuId) { return (_data.menuPerms[menuId] || []).slice(); }
    function setAssignments(menuId, list) { _data.menuPerms[menuId] = (list || []).map(a => Object.assign({}, a)); save(); }
    function getUsage(menuId) { return _data.menuUsage[menuId] !== false; }
    function setUsage(menuId, on) { _data.menuUsage[menuId] = !!on; save(); }

    /* 메뉴 상태 (트리 배지용) */
    function menuStatus(menuId) {
        if (isAdminMenu(menuId)) return { kind: 'admin' };
        if (!getUsage(menuId)) return { kind: 'disabled' };
        const list = getAssignments(menuId);
        if (!list.length) return { kind: 'unset' };
        return { kind: 'set', count: list.length };
    }
    /* 권한등급 n · 부서 n · 개인 n */
    function assignmentSummary(menuId) {
        const list = getAssignments(menuId);
        return {
            role: list.filter(a => a.kind === 'role').length,
            dept: list.filter(a => a.kind === 'dept').length,
            user: list.filter(a => a.kind === 'user').length,
        };
    }

    /* 등급이 적용된 메뉴 목록 [{menu, view, edit}] (role kind 기준) */
    function roleAppliedMenus(roleId) {
        const out = [];
        middleMenus().forEach(m => {
            const a = (getAssignments(m.id)).find(x => x.kind === 'role' && x.id === roleId);
            if (a) out.push({ menu: m, view: a.view, edit: a.edit });
        });
        return out;
    }
    /* fullAccess 등급은 전 메뉴 자동 적용 → 카운트는 '전체' */
    function roleAppliedCount(roleId) {
        const r = roleById(roleId);
        if (r && r.fullAccess) return { all: true, n: middleMenus().length };
        return { all: false, n: roleAppliedMenus(roleId).length };
    }

    /* 등급 삭제 시 해당 등급의 메뉴 지정도 제거 */
    function removeRole(roleId) {
        const r = roleById(roleId);
        if (!r) return { ok: false, msg: '등급을 찾을 수 없습니다.' };
        if (r.protected) return { ok: false, msg: '보호 등급은 삭제할 수 없습니다.' };
        _data.roles = _data.roles.filter(x => x.id !== roleId);
        Object.keys(_data.menuPerms).forEach(mid => {
            _data.menuPerms[mid] = _data.menuPerms[mid].filter(a => !(a.kind === 'role' && a.id === roleId));
        });
        save();
        return { ok: true };
    }
    function saveRole(role) {
        const idx = _data.roles.findIndex(r => r.id === role.id);
        if (idx >= 0) _data.roles[idx] = role; else _data.roles.push(role);
        save();
    }
    function addRole(o) {
        const name = String(o.name || '').trim();
        if (!name) return { ok: false, msg: '등급명을 입력하세요.' };
        if (_data.roles.some(r => r.name === name)) return { ok: false, msg: '이미 같은 이름의 등급이 있습니다.' };
        const n = _data.roles.reduce((mx, r) => { const m = /^role-(\d+)$/.exec(r.id); return m ? Math.max(mx, +m[1]) : mx; }, 0) + 1;
        const role = {
            id: 'role-' + n, name, desc: String(o.desc || ''),
            protected: false, fullAccess: !!o.fullAccess, autoAll: !!o.autoAll,
            members: o.members || [],
        };
        _data.roles.push(role); save();
        return { ok: true, id: role.id };
    }

    /* =====================================================================
     * 5. 사용자 기준 실효 권한 (사용자 관리 역조회 — 합집합, 높은 권한 우선)
     * ===================================================================== */
    function assignLabel(a) {
        if (a.kind === 'role') { const r = roleById(a.id); return (r ? r.name : a.id) + ' 등급'; }
        if (a.kind === 'dept') { const n = nodeById(a.id); return '부서 ' + (n ? n.name : a.id) + (a.includeSub ? ' (하위 포함)' : ''); }
        return '개별 지정';
    }
    function effectiveForUser(uid) {
        const result = {};
        const fullRoles = _data.roles.filter(r => r.fullAccess && userInRole(uid, r));
        middleMenus().forEach(m => {
            let view = false, edit = false; const reasons = [];
            if (fullRoles.length) {
                view = true; edit = true;
                fullRoles.forEach(r => reasons.push({ via: r.name + ' (전체 권한)', view: true, edit: true }));
            }
            getAssignments(m.id).forEach(a => {
                let applies = false;
                if (a.kind === 'role') { const r = roleById(a.id); applies = !!(r && userInRole(uid, r)); }
                else if (a.kind === 'dept') applies = isUnder(uid, a.id, a.includeSub);
                else if (a.kind === 'user') applies = (a.id === uid);
                if (applies) {
                    if (a.view) view = true;
                    if (a.edit) { edit = true; view = true; }
                    reasons.push({ via: assignLabel(a), view: a.view, edit: a.edit });
                }
            });
            if (edit) view = true;
            result[m.id] = { view, edit, reasons };
        });
        return result;
    }
    /* 사용자 목록 '권한' 컬럼 산출값 — 대표 등급 1개 (없으면 메뉴별 지정 / 일반 공무원) */
    const PRIMARY_ORDER = ['sys', 'mayor', 'exec', 'team', 'manager'];
    function primaryRole(uid) {
        for (const id of PRIMARY_ORDER) { const r = roleById(id); if (r && userInRole(uid, r)) return r.name; }
        const hasDirect = middleMenus().some(m => getAssignments(m.id).some(a =>
            (a.kind === 'user' && a.id === uid) || (a.kind === 'dept' && isUnder(uid, a.id, a.includeSub))));
        return hasDirect ? '메뉴별 지정' : '일반 공무원';
    }

    /* =====================================================================
     * 6. 공용 복수선택 조직도 모달 (DYV2.openModal 1개 — 적층·오버레이 생성 금지)
     *    opts: { title, existing:[{kind,id}], onApply: fn(selected[]) }
     *    selected item: { kind:'dept'|'user', id, includeSub, name, meta }
     * ===================================================================== */
    let PICK = null;   /* { checked, sub, open, existing:Set, query, onApply } */

    function pickKey(kind, id) { return kind + ':' + id; }
    function personMeta(p) { return p.deptName + ' · ' + p.role; }
    function deptMemberCount(nodeId, includeSub) { return membersUnder(nodeId, !!includeSub).length; }
    function deptCountLabel(nodeId, includeSub) { const n = deptMemberCount(nodeId, includeSub); return n ? n + '명' : '부서'; }

    /* 겹침 차단(자동 체크+비활성) 계산 — 체크된 부서(세션 선택 + 기추가) 기준.
     *   covUsers[uid]  : 부서 체크로 자동 포함되는 개인 (직속: 그 부서 직속만 / 하위 포함: 하위 전체)
     *   covDepts[id]   : '하위 포함' 조상 아래 자동 포함되는 하위 부서 노드 (중복 선택 차단) */
    function computeCoverage() {
        const covUsers = {}, covDepts = {};
        if (!PICK) return { covUsers, covDepts };
        const sources = [];
        Object.keys(PICK.checked).forEach(k => {
            const it = PICK.checked[k];
            if (it.kind === 'dept') sources.push({ id: it.id, includeSub: !!it.includeSub });
        });
        (PICK.existingItems || []).forEach(e => {
            if (e.kind === 'dept') sources.push({ id: e.id, includeSub: !!e.includeSub });
        });
        sources.forEach(s => {
            const node = NODE[s.id];
            if (!node) return;
            (node.members || []).forEach(m => { covUsers[m.uid] = true; });   /* 직속 개인 */
            if (s.includeSub) (function walk(nd) {
                (nd.children || []).forEach(c => {
                    covDepts[c.id] = true;
                    (c.members || []).forEach(m => { covUsers[m.uid] = true; });
                    walk(c);
                });
            })(node);
        });
        return { covUsers, covDepts };
    }
    /* 자동 포함으로 덮인 개별 선택(개인·하위 부서)은 목록에서 제거 — 중복 방지 */
    function normalizeChecked() {
        if (!PICK) return;
        const cov = computeCoverage();
        Object.keys(PICK.checked).forEach(k => {
            const it = PICK.checked[k];
            if (it.kind === 'user' && cov.covUsers[it.id]) delete PICK.checked[k];
            else if (it.kind === 'dept' && cov.covDepts[it.id]) { delete PICK.checked[k]; PICK.sub[it.id] = false; }
        });
    }

    /* 검색 하이라이트 — esc 후 매칭 부분을 배경 강조 span 으로 감싼다(이모지·아이콘 없음) */
    function hl(text, q) {
        const t = esc(text);
        if (!q) return t;
        const eq = esc(q);
        if (!eq || t.indexOf(eq) === -1) return t;
        return t.split(eq).join('<span class="admp-hl">' + eq + '</span>');
    }

    /* 기본 펼침 상태(B): root(상시)·post·bureau 펼침. 이미 추가된 대상의 조상은 추가로 펼쳐 노출. */
    function openChain(open, nodeId, includeSelf) {
        if (includeSelf) open[nodeId] = true;
        let p = PARENT[nodeId];
        while (p) { open[p] = true; p = PARENT[p]; }
    }
    function defaultOpenState(existing) {
        const open = {};
        Object.keys(NODE).forEach(id => {
            const t = NODE[id].type;
            if (t === 'post' || t === 'bureau') open[id] = true;
        });
        (existing || []).forEach(e => {
            if (e.kind === 'user') { const p = PERSON[e.id]; if (p) openChain(open, p.deptId, true); }
            else if (e.kind === 'dept') openChain(open, e.id, false);
        });
        return open;
    }

    function openOrgPicker(opts) {
        opts = opts || {};
        const existingList = opts.existing || [];
        const existing = new Set(existingList.map(e => pickKey(e.kind, e.id)));
        PICK = {
            checked: {}, sub: {}, open: defaultOpenState(existingList),
            existing: existing, existingItems: existingList.slice(),
            query: '', onApply: opts.onApply || function () {},
        };
        const body =
            '<div class="admp-picker">' +
                '<div class="admp-pick-tree">' +
                    '<div class="admp-pick-toolbar">' +
                        '<input type="text" id="admp-pick-q" class="admp-pick-q" placeholder="부서·이름·직책 검색" oninput="DYADM._pickSearch(this.value)">' +
                        '<button type="button" class="admp-tool-btn" onclick="DYADM._pickExpandAll(true)">전체 펼치기</button>' +
                        '<button type="button" class="admp-tool-btn" onclick="DYADM._pickExpandAll(false)">전체 접기</button>' +
                    '</div>' +
                    '<div class="org-inline-body admp-tree" id="admp-pick-tree">' + pickTreeHtml() + '</div>' +
                '</div>' +
                '<div class="admp-pick-basket">' +
                    '<div class="admp-basket-head">선택 목록 <span class="chip-mini wt" id="admp-basket-count">0건</span></div>' +
                    '<div class="admp-basket-body" id="admp-pick-basket">' + pickBasketHtml() + '</div>' +
                '</div>' +
            '</div>';
        const foot =
            '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" id="admp-apply" disabled onclick="DYADM._pickApply()">적용</button>';
        DYV2.openModal(esc(opts.title || '조직도에서 선택'), body, foot);
    }

    function pickTreeHtml() {
        const q = (PICK.query || '').trim();
        const cov = computeCoverage();
        function nodeHtml(node, depth) {
            if (node.type === 'root') {
                const kids = (node.children || []).map(c => nodeHtml(c, 0)).join('');
                return '<div class="admp-root">' + esc(node.name) + '</div>' + kids;
            }
            const members = node.members || [];
            const children = node.children || [];
            /* 검색: 부서명·이름·직책 매칭 */
            const selfMatch = !q || node.name.indexOf(q) !== -1;
            const memMatch = members.filter(m => !q || selfMatch || m.name.indexOf(q) !== -1 || m.role.indexOf(q) !== -1);
            const kidsHtml = children.map(c => nodeHtml(c, depth + 1)).join('');
            if (q && !selfMatch && !memMatch.length && !kidsHtml) return '';   /* 매칭 없는 가지 숨김 */
            const showMembers = q ? memMatch : members;
            const isOpen = q ? true : !!PICK.open[node.id];   /* 검색 시 조상 자동 펼침 */
            const arrowBtn = '<button type="button" class="admp-arrow" onclick="DYADM._pickExpand(\'' + node.id + '\',this)">' + (isOpen ? '▾' : '▸') + '</button>';

            const memRows = showMembers.map(m => {
                const uk = pickKey('user', m.uid);
                const isExisting = PICK.existing.has(uk);
                const isCovered = !!cov.covUsers[m.uid];          /* 부서 체크로 자동 포함 */
                const on = !!PICK.checked[uk] || isExisting || isCovered;
                const dis = isExisting || isCovered;
                return '<label class="admp-mrow' + (dis ? ' is-dis' : '') + '">' +
                    '<input type="checkbox" ' + (on ? 'checked ' : '') + (dis ? 'disabled ' : '') +
                        'onchange="DYADM._pickToggle(\'user\',\'' + m.uid + '\',this.checked)">' +
                    '<span class="admp-mrole">' + hl(m.role, q) + '</span>' +
                    '<span class="admp-mname">' + hl(m.name, q) + '</span>' +
                    (isExisting ? '<span class="chip-mini wt">추가됨</span>' : '') +
                    '</label>';
            }).join('');
            const childrenBox = '<div class="admp-children"' + (isOpen ? '' : ' style="display:none;"') + '>' + memRows + kidsHtml + '</div>';

            /* D. post(군수·부군수)는 부서 체크·하위 포함 없음 — 개인 체크만 */
            if (node.type === 'post') {
                return '<div class="admp-node" data-depth="' + depth + '">' +
                    '<div class="admp-drow">' + arrowBtn +
                        '<span class="admp-postlabel"><span class="admp-dname">' + hl(node.name, q) + '</span>' +
                            '<span class="admp-dcount">' + (members.length ? members.length + '명' : '') + '</span></span>' +
                    '</div>' + childrenBox + '</div>';
            }

            const dk = pickKey('dept', node.id);
            const isExisting = PICK.existing.has(dk);
            const isCoveredDept = !!cov.covDepts[node.id];       /* 하위 포함 조상 아래 자동 포함 */
            const selfChecked = !!PICK.checked[dk];              /* 사용자가 직접 체크(직속) */
            const deptChecked = selfChecked || isExisting || isCoveredDept;
            const deptDis = isExisting || isCoveredDept;
            const hasKids = children.length > 0;
            const subOn = !!PICK.sub[node.id];
            /* 하위 포함: 부서 직접 체크 시에만 활성 · 미체크/자동포함/기추가 시 비활성(리셋) */
            const subEnabled = selfChecked && !isCoveredDept && !isExisting;
            const subShow = subEnabled ? subOn : (isExisting ? subOn : false);
            return '<div class="admp-node" data-depth="' + depth + '">' +
                '<div class="admp-drow">' + arrowBtn +
                    '<label class="admp-dcheck' + (deptDis ? ' is-dis' : '') + '">' +
                        '<input type="checkbox" ' + (deptChecked ? 'checked ' : '') + (deptDis ? 'disabled ' : '') +
                            'onchange="DYADM._pickToggle(\'dept\',\'' + node.id + '\',this.checked)">' +
                        '<span class="admp-dname">' + hl(node.name, q) + '</span>' +
                        '<span class="admp-dcount">' + deptCountLabel(node.id, subShow) + '</span>' +
                        (isExisting ? '<span class="chip-mini wt">추가됨</span>' : '') +
                    '</label>' +
                    (hasKids
                        ? '<label class="admp-subopt' + (subEnabled ? '' : ' is-dis') + '" title="하위 부서까지 포함"><input type="checkbox" ' +
                          (subShow ? 'checked ' : '') + (subEnabled ? '' : 'disabled ') +
                          'onchange="DYADM._pickSub(\'' + node.id + '\',this.checked)">하위 포함</label>'
                        : '') +
                '</div>' + childrenBox + '</div>';
        }
        const html = nodeHtml(ORG, -1);
        return html || '<div class="v2-empty" style="padding:16px;">검색 결과가 없습니다.</div>';
    }

    function pickBasketHtml() {
        const keys = Object.keys(PICK.checked);
        if (!keys.length) return '<div class="admp-basket-empty">좌측에서 부서·인원을 선택하세요.</div>';
        return keys.map(k => {
            const it = PICK.checked[k];
            const sub = it.kind === 'dept' && it.includeSub ? ' <span class="chip-mini pdca">하위 포함</span>' : '';
            const badge = it.kind === 'dept' ? '<span class="chip-mini wt-elec">부서</span>' : '<span class="chip-mini pdca">사용자</span>';
            return '<div class="admp-basket-item">' + badge +
                '<span class="admp-bi-name">' + esc(it.name) + '</span>' + sub +
                (it.meta ? '<span class="admp-bi-meta">' + esc(it.meta) + '</span>' : '') +
                '<button type="button" class="admp-bi-x" onclick="DYADM._pickRemove(\'' + esc(k) + '\')" aria-label="제거">&times;</button>' +
                '</div>';
        }).join('');
    }

    function refreshBasket() {
        const n = Object.keys(PICK.checked).length;
        const b = document.getElementById('admp-pick-basket');
        if (b) b.innerHTML = pickBasketHtml();
        const c = document.getElementById('admp-basket-count');
        if (c) c.textContent = n + '건';
        const apply = document.getElementById('admp-apply');
        if (apply) { apply.disabled = (n === 0); apply.textContent = n ? '적용 (' + n + '건)' : '적용'; }
    }
    function refreshTree() {
        const t = document.getElementById('admp-pick-tree');
        if (!t) return;
        const st = t.scrollTop;
        t.innerHTML = pickTreeHtml();
        t.scrollTop = st;
    }

    function pickToggle(kind, id, on) {
        if (!PICK) return;
        const key = pickKey(kind, id);
        if (PICK.existing.has(key)) return;
        if (on) {
            let item;
            if (kind === 'dept') {
                PICK.sub[id] = false;                 /* 부서 새로 체크 시 하위 포함은 항상 꺼진 상태로 시작 */
                const n = nodeById(id);
                item = { kind: 'dept', id: id, includeSub: false, name: n ? n.name : id, meta: deptMemberCount(id, false) + '명' };
            } else {
                const p = personByUid(id);
                item = { kind: 'user', id: id, includeSub: false, name: p ? p.name : id, meta: p ? personMeta(p) : '' };
            }
            PICK.checked[key] = item;
        } else {
            delete PICK.checked[key];
            if (kind === 'dept') PICK.sub[id] = false;   /* 부서 해제 시 하위 포함 리셋+비활성 */
        }
        normalizeChecked();
        refreshTree();      /* 부서 체크는 하위 개인·부서 체크박스 활성 상태를 바꾼다 */
        refreshBasket();
    }
    function pickSub(deptId, on) {
        if (!PICK) return;
        PICK.sub[deptId] = !!on;
        const key = pickKey('dept', deptId);
        if (PICK.checked[key]) {
            PICK.checked[key].includeSub = !!on;
            PICK.checked[key].meta = deptMemberCount(deptId, !!on) + '명';
        }
        normalizeChecked();   /* 하위 포함 켜면 하위 부서·개인 개별 선택은 흡수 */
        refreshTree();        /* 노드 라벨의 N명 실시간 갱신 + 하위 자동 체크 반영 */
        refreshBasket();
    }
    function pickExpand(nodeId, btn) {
        if (!PICK) return;
        PICK.open[nodeId] = !PICK.open[nodeId];
        const box = btn.closest('.admp-drow').nextElementSibling;
        if (box) box.style.display = PICK.open[nodeId] ? '' : 'none';
        btn.textContent = PICK.open[nodeId] ? '▾' : '▸';
    }
    function pickExpandAll(on) {
        if (!PICK) return;
        Object.keys(NODE).forEach(id => { if (NODE[id].type !== 'root') PICK.open[id] = !!on; });
        refreshTree();
    }
    function pickRemove(key) {
        if (!PICK || !PICK.checked[key]) return;
        delete PICK.checked[key];
        refreshBasket(); refreshTree();
    }
    let _pickSearchTimer = null;
    function pickSearch(v) {
        if (!PICK) return;
        PICK.query = v || '';
        clearTimeout(_pickSearchTimer);
        _pickSearchTimer = setTimeout(refreshTree, 120);
    }
    function pickApply() {
        if (!PICK) return;
        const list = Object.keys(PICK.checked).map(k => PICK.checked[k]);
        if (!list.length) return;
        const cb = PICK.onApply; PICK = null;
        DYV2.closeModal();
        cb(list);
    }

    /* =====================================================================
     * 공개 API
     * ===================================================================== */
    window.DYADM = {
        ORG, PEOPLE,
        nodeById, personByUid, uidOf, membersUnder, isUnder, nodeHasChildren,
        groups, middleMenus, menuById, isAdminMenu,
        data, save, resetDemo,
        roles, roleById, roleMemberUids, roleMemberCountLabel, userInRole,
        getAssignments, setAssignments, getUsage, setUsage,
        menuStatus, assignmentSummary, roleAppliedMenus, roleAppliedCount,
        removeRole, saveRole, addRole, assignLabel,
        effectiveForUser, primaryRole,
        openOrgPicker,
        /* 픽커 내부 핸들러(onclick 노출) */
        _pickToggle: pickToggle, _pickSub: pickSub, _pickExpand: pickExpand,
        _pickExpandAll: pickExpandAll, _pickRemove: pickRemove, _pickSearch: pickSearch, _pickApply: pickApply,
    };
})();
