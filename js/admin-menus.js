/* =========================================================================
 * 담양군 중대재해예방 통합관리시스템 v2 — 메뉴 관리 (ADM01-S)
 *   좌: 메뉴 트리(DYLayout.NAV 단일 출처) / 우: 접근 권한 설정 패널
 *   데이터·조직도·픽커·실효권한은 DYADM(js/adm-perm.js) 공용 코어 사용.
 *   전역 네임스페이스: DYADMENU (onclick 핸들러 노출)
 * ========================================================================= */
(function () {
    'use strict';
    const app = document.getElementById('adm-menus-app');
    if (!app || !window.DYADM) return;

    const A = window.DYADM;
    const V = () => window.DYV2;
    const esc = s => (window.DYV2 && DYV2.esc) ? DYV2.esc(s) : String(s == null ? '' : s);

    const MUI = { sel: null, addMode: 'role', draft: null, dirty: false, collapsed: {}, expanded: {}, query: '' };

    function clone(list) { return (list || []).map(a => Object.assign({}, a)); }
    function isUnset(id) { return A.getAssignments(id).length === 0; }   /* 지정 0건 = 미설정(기본 차단) */

    /* ── 좌측 트리 ── */
    function statusBadge(menuId) {
        const s = A.menuStatus(menuId);
        if (s.kind === 'admin') return '<span class="chip-mini wt-program">관리자 전용</span>';
        if (s.kind === 'disabled') return '<span class="chip-mini wt">사용 안 함</span>';
        if (s.kind === 'unset') return '<span class="chip-mini st-todo">미설정</span>';
        return '<span class="chip-mini st-done">설정 ' + s.count + '건</span>';
    }
    function renderTree() {
        const q = (MUI.query || '').trim();
        const html = A.groups().map(g => {
            const collapsed = !!MUI.collapsed[g.id];
            let items = g.items || [];
            if (q) items = items.filter(it => it.label.indexOf(q) !== -1 || g.label.indexOf(q) !== -1);
            if (q && !items.length && g.label.indexOf(q) === -1) return '';
            const gSel = MUI.sel && MUI.sel.type === 'group' && MUI.sel.id === g.id;
            const open = q ? true : !collapsed;
            const rows = open ? items.map(it => {
                const sel = MUI.sel && MUI.sel.type === 'menu' && MUI.sel.id === it.id;
                return '<button type="button" class="admm-menu' + (sel ? ' is-sel' : '') + '" onclick="DYADMENU.selMenu(\'' + it.id + '\')">' +
                    '<span class="admm-menu-label">' + esc(it.label) + '</span>' + statusBadge(it.id) + '</button>';
            }).join('') : '';
            return '<div class="admm-group">' +
                '<div class="admm-ghead' + (gSel ? ' is-sel' : '') + '">' +
                    '<button type="button" class="admm-gtoggle" onclick="DYADMENU.toggleGroup(\'' + g.id + '\')">' + (open ? '▾' : '▸') + '</button>' +
                    '<button type="button" class="admm-glabel" onclick="DYADMENU.selGroup(\'' + g.id + '\')">' + esc(g.label) + '</button>' +
                '</div>' +
                '<div class="admm-menus">' + rows + '</div>' +
            '</div>';
        }).join('');
        const tree = document.getElementById('admm-tree');
        if (tree) tree.innerHTML = html || '<div class="v2-empty" style="padding:20px;">검색 결과가 없습니다.</div>';
    }

    /* ── dirty 가드 ── */
    function guard() {
        if (MUI.dirty) return confirm('저장하지 않은 변경사항이 있습니다. 이동하면 변경 내용이 사라집니다. 계속하시겠습니까?');
        return true;
    }

    function selMenu(id) {
        if (MUI.sel && MUI.sel.type === 'menu' && MUI.sel.id === id) return;
        if (!guard()) return;
        MUI.sel = { type: 'menu', id: id };
        MUI.draft = clone(A.getAssignments(id));
        MUI.dirty = false; MUI.addMode = 'role'; MUI.expanded = {};
        renderTree(); renderPanel();
    }
    function selGroup(id) {
        if (!guard()) return;
        MUI.sel = { type: 'group', id: id };
        MUI.draft = null; MUI.dirty = false;
        renderTree(); renderPanel();
    }
    function toggleGroup(id) { MUI.collapsed[id] = !MUI.collapsed[id]; renderTree(); }
    function search(v) { MUI.query = v || ''; renderTree(); }

    /* ── 우측 패널 ── */
    function renderPanel() {
        const el = document.getElementById('admm-panel');
        if (!el) return;
        if (!MUI.sel) { el.innerHTML = '<div class="card"><div class="card-body"><div class="v2-empty">좌측에서 메뉴를 선택하면 접근 권한을 설정할 수 있습니다.</div></div></div>'; return; }
        if (MUI.sel.type === 'group') { el.innerHTML = groupPanel(MUI.sel.id); return; }
        el.innerHTML = menuPanel(MUI.sel.id);
    }

    /* 대메뉴(그룹) 요약 패널 */
    function groupPanel(gid) {
        const g = A.groups().find(x => x.id === gid);
        if (!g) return '';
        const isAdmin = gid === 'admin';
        const rows = (g.items || []).map(it => {
            const sm = A.assignmentSummary(it.id);
            const st = A.menuStatus(it.id);
            const cnt = st.kind === 'admin' ? '<span class="chip-mini wt">관리자 전용</span>'
                : ('권한등급 ' + sm.role + ' · 부서 ' + sm.dept + ' · 개인 ' + sm.user);
            return '<tr onclick="DYADMENU.selMenu(\'' + it.id + '\')">' +
                '<td style="font-weight:600;">' + esc(it.label) + '</td>' +
                '<td>' + statusBadge(it.id) + '</td>' +
                '<td>' + cnt + '</td>' +
                '<td>' + (A.getUsage(it.id) ? '<span class="chip-mini st-done">사용</span>' : '<span class="chip-mini wt">사용 안 함</span>') + '</td>' +
                '</tr>';
        }).join('');
        const bulk = isAdmin
            ? '<div class="admm-note">시스템 관리 하위 메뉴는 전체 권한 등급(시스템 관리자)만 접근합니다. 메뉴별 지정 대상이 아닙니다.</div>'
            : '<div class="admm-bulk">' +
                '<span class="admm-bulk-lab">하위 메뉴 일괄 적용</span>' +
                '<select class="select" id="admm-bulk-src"><option value="">기준 메뉴 선택</option>' +
                    (g.items || []).map(it => '<option value="' + it.id + '">' + esc(it.label) + (isUnset(it.id) ? ' (미설정)' : '') + '</option>').join('') +
                '</select>' +
                '<button class="btn btn-outline btn-sm" onclick="DYADMENU.bulkApply(\'' + gid + '\')">하위 전체에 복사</button>' +
              '</div>';
        return '<div class="card"><div class="card-header"><span class="card-title">' + esc(g.label) + ' — 하위 메뉴 권한 요약</span></div>' +
            '<div class="card-body">' + bulk +
                '<div style="overflow-x:auto; margin-top:12px;"><table class="table-figma">' +
                    '<thead><tr><th>메뉴명</th><th>상태</th><th>등급·부서·개인 수</th><th>사용 여부</th></tr></thead>' +
                    '<tbody>' + rows + '</tbody></table></div>' +
            '</div></div>';
    }

    /* 중메뉴 설정 패널 */
    function menuPanel(id) {
        const m = A.menuById(id);
        if (!m) return '';
        const usage = A.getUsage(id);
        const info = '<div class="card" style="margin-bottom:16px;"><div class="card-header"><span class="card-title">기본 정보</span></div>' +
            '<div class="card-body"><div class="admm-info">' +
                infoRow('메뉴명', esc(m.label)) +
                infoRow('대메뉴', esc(m.groupLabel)) +
                infoRow('경로', '<code>' + esc(m.href || '-') + '</code>') +
                infoRow('연결 화면 코드', m.screen ? '<span class="chip-mini wt">' + esc(m.screen) + '</span>' : '-') +
                '<span class="admm-info-k">사용 여부</span><span class="admm-info-v">' +
                    '<label class="toggle-switch"><input type="checkbox"' + (usage ? ' checked' : '') + ' onchange="DYADMENU.toggleUsage(\'' + id + '\',this.checked)"><span class="toggle-switch-slider"></span></label>' +
                    ' <span class="admm-usage-txt">' + (usage ? '사용' : '사용 안 함 (메뉴 숨김 대상 — 프로토타입은 표시만)') + '</span>' +
                '</span>' +
            '</div></div></div>';

        if (m.groupId === 'admin') {
            return info + '<div class="card"><div class="card-header"><span class="card-title">접근 권한</span></div>' +
                '<div class="card-body"><div class="admm-note">시스템 관리 메뉴는 <b>전체 권한 등급(시스템 관리자)</b>만 접근·수정합니다. 별도의 메뉴별 지정 대상이 아닙니다. (권한 관리에서 시스템 관리자 등급 구성원을 관리)</div></div></div>';
        }

        const draft = MUI.draft || [];
        /* 추가 속성창 */
        const usedRoleIds = draft.filter(a => a.kind === 'role').map(a => a.id);
        const roleOpts = A.roles().filter(r => !r.fullAccess && usedRoleIds.indexOf(r.id) === -1)
            .map(r => '<option value="' + r.id + '">' + esc(r.name) + ' (' + A.roleMemberCountLabel(r) + ')</option>').join('');
        const addPanel = MUI.addMode === 'role'
            ? '<div class="admm-add"><select class="select" id="admm-role-sel">' +
                  (roleOpts || '<option value="">추가할 등급 없음</option>') + '</select>' +
                  '<button class="btn btn-outline btn-sm" onclick="DYADMENU.addRole()">추가</button></div>'
            : '<div class="admm-add"><button class="btn btn-outline btn-sm" onclick="DYADMENU.pickDirect()">조직도에서 선택</button>' +
                  '<span class="admm-add-hint">부서 또는 사용자를 복수 선택해 추가합니다.</span></div>';

        const list = draft.length ? draft.map((a, i) => assignRow(a, i)).join('')
            : '<tr><td colspan="5"><div class="v2-empty" style="padding:20px;">지정된 권한이 없습니다. 등급을 불러오거나 조직도에서 직접 지정하세요. <b>(미설정 = 기본 차단, 시스템 관리자 제외)</b></div></td></tr>';

        const sm = { role: draft.filter(a => a.kind === 'role').length, dept: draft.filter(a => a.kind === 'dept').length, user: draft.filter(a => a.kind === 'user').length };

        return info +
            '<div class="card"><div class="card-header"><span class="card-title">접근 권한</span>' +
                (MUI.dirty ? '<span class="chip-mini st-doing">저장 필요</span>' : '') + '</div>' +
            '<div class="card-body">' +
                '<div class="admm-auto">전체 권한 등급 1개(<b>시스템 관리자</b>)는 항상 접근·수정 가능합니다. 아래 목록과 무관하게 자동 적용됩니다.</div>' +
                '<div class="reg-radios" style="margin:14px 0 4px;">' +
                    '<label class="reg-radio' + (MUI.addMode === 'role' ? ' on' : '') + '" onclick="DYADMENU.setMode(\'role\')"><span class="rdot"></span> 권한 등급 불러오기</label>' +
                    '<label class="reg-radio' + (MUI.addMode === 'direct' ? ' on' : '') + '" onclick="DYADMENU.setMode(\'direct\')"><span class="rdot"></span> 부서·사용자 직접 지정</label>' +
                '</div>' +
                addPanel +
                '<div style="overflow-x:auto; margin-top:14px;"><table class="table-figma admm-perm-table">' +
                    '<thead><tr><th>유형</th><th>대상</th><th style="width:70px;">보기</th><th style="width:70px;">수정</th><th style="width:64px;">관리</th></tr></thead>' +
                    '<tbody>' + list + '</tbody></table></div>' +
                '<p class="admm-editnote">‘수정’은 등록·수정·삭제·상신을 포함합니다. 수정 체크 시 보기는 자동 포함됩니다.</p>' +
                '<div class="admm-summary">' +
                    '<span class="admm-sum-txt">권한등급 <b>' + sm.role + '</b> · 부서 <b>' + sm.dept + '</b> · 개인 <b>' + sm.user + '</b>명</span>' +
                    '<span class="spacer" style="flex:1;"></span>' +
                    '<button class="btn btn-outline btn-sm" onclick="DYADMENU.openCopy(\'' + id + '\')">다른 메뉴 설정 복사</button>' +
                    '<button class="btn btn-secondary btn-sm" onclick="DYADMENU.resetDraft()">초기화</button>' +
                    '<button class="btn btn-primary btn-sm" onclick="DYADMENU.saveDraft()">저장</button>' +
                '</div>' +
            '</div></div>';
    }
    function infoRow(k, v) { return '<span class="admm-info-k">' + k + '</span><span class="admm-info-v">' + v + '</span>'; }

    function assignRow(a, i) {
        const badge = a.kind === 'role' ? '<span class="chip-mini wt-program">권한등급</span>'
            : a.kind === 'dept' ? '<span class="chip-mini wt-elec">부서</span>' : '<span class="chip-mini pdca">사용자</span>';
        let target = '', extra = '';
        if (a.kind === 'role') {
            const r = A.roleById(a.id);
            const key = 'role:' + a.id;
            const open = !!MUI.expanded[key];
            target = '<button type="button" class="admm-exp" onclick="DYADMENU.togglePrev(\'' + esc(key) + '\')">' + (open ? '▾' : '▸') + '</button>' +
                '<b>' + esc(r ? r.name : a.id) + '</b> <span class="admm-mc">' + (r ? A.roleMemberCountLabel(r) : '') + '</span>';
            if (open) extra = '<tr class="admm-prev-row"><td colspan="5">' + rolePreview(r) + '</td></tr>';
        } else if (a.kind === 'dept') {
            const n = A.nodeById(a.id);
            target = '<b>' + esc(n ? n.name : a.id) + '</b>' + (a.includeSub ? ' <span class="chip-mini pdca">하위 포함</span>' : ' <span class="chip-mini wt">직속만</span>');
        } else {
            const p = A.personByUid(a.id);
            target = '<b>' + esc(p ? p.name : a.id) + '</b>' + (p ? ' <span class="admm-mc">' + esc(p.deptName + ' · ' + p.role) + '</span>' : '');
        }
        const noPerm = !a.view && !a.edit;
        const viewDis = a.edit ? ' disabled' : '';
        const row = '<tr' + (noPerm ? ' class="admm-noperm-row"' : '') + '>' +
            '<td>' + badge + '</td>' +
            '<td>' + target + (noPerm ? ' <span class="chip-mini st-todo">권한 없음 — 저장 시 제거</span>' : '') + '</td>' +
            '<td style="text-align:center;"><input type="checkbox"' + (a.view ? ' checked' : '') + viewDis + ' onchange="DYADMENU.chk(' + i + ',\'view\',this.checked)"></td>' +
            '<td style="text-align:center;"><input type="checkbox"' + (a.edit ? ' checked' : '') + ' onchange="DYADMENU.chk(' + i + ',\'edit\',this.checked)"></td>' +
            '<td style="text-align:center;"><button type="button" class="btn btn-sm btn-outline" onclick="DYADMENU.removeAssign(' + i + ')">제거</button></td>' +
        '</tr>';
        return row + extra;
    }
    function rolePreview(r) {
        if (!r) return '<div class="admm-prev">구성원 정보를 찾을 수 없습니다.</div>';
        if (r.autoAll) return '<div class="admm-prev">SSO 로그인 사용자 전원이 자동 포함됩니다.</div>';
        const parts = (r.members || []).map(mm => {
            if (mm.kind === 'dept') { const n = A.nodeById(mm.id); return '<span class="admm-prev-chip">부서 · ' + esc(n ? n.name : mm.id) + (mm.includeSub ? ' (하위 포함)' : '') + '</span>'; }
            const p = A.personByUid(mm.id); return '<span class="admm-prev-chip">' + esc(p ? p.name + ' (' + p.deptName + '·' + p.role + ')' : mm.id) + '</span>';
        }).join('');
        return '<div class="admm-prev"><span class="admm-prev-h">구성원 미리보기 (' + A.roleMemberCountLabel(r) + ')</span>' + (parts || '<span class="admm-prev-chip">구성원 없음</span>') + '</div>';
    }

    /* ── 상호작용 ── */
    function setMode(mode) { MUI.addMode = mode; renderPanel(); }
    function togglePrev(key) { MUI.expanded[key] = !MUI.expanded[key]; renderPanel(); }
    function addRole() {
        const sel = document.getElementById('admm-role-sel');
        const id = sel && sel.value;
        if (!id) { V().toast('추가할 등급을 선택하세요.'); return; }
        MUI.draft.push({ kind: 'role', id: id, view: true, edit: false });
        MUI.dirty = true; renderPanel();
    }
    function pickDirect() {
        const existing = MUI.draft.filter(a => a.kind !== 'role').map(a => ({ kind: a.kind, id: a.id }));
        const menu = A.menuById(MUI.sel.id);
        A.openOrgPicker({
            title: '직접 지정 — ' + (menu ? menu.label : '메뉴'), existing: existing,
            onApply: function (items) {
                let added = 0, skipped = 0;
                items.forEach(it => {
                    if (MUI.draft.some(a => a.kind === it.kind && a.id === it.id)) { skipped++; return; }
                    MUI.draft.push({ kind: it.kind, id: it.id, includeSub: !!it.includeSub, view: true, edit: false });
                    added++;
                });
                if (added) { MUI.dirty = true; renderPanel(); }
                V().toast(added + '건 추가' + (skipped ? ' · ' + skipped + '건 중복 제외' : ''));
            },
        });
    }
    function chk(i, field, checked) {
        const a = MUI.draft[i]; if (!a) return;
        if (field === 'edit') { a.edit = checked; if (checked) a.view = true; }
        else { a.view = checked; }
        MUI.dirty = true; renderPanel();
    }
    function removeAssign(i) { MUI.draft.splice(i, 1); MUI.dirty = true; renderPanel(); }
    function resetDraft() { MUI.draft = clone(A.getAssignments(MUI.sel.id)); MUI.dirty = false; MUI.expanded = {}; renderPanel(); V().toast('변경 내용을 되돌렸습니다.'); }
    function saveDraft() {
        const removed = MUI.draft.filter(a => !a.view && !a.edit).length;
        if (removed) MUI.draft = MUI.draft.filter(a => a.view || a.edit);
        A.setAssignments(MUI.sel.id, MUI.draft);
        MUI.dirty = false; renderTree(); renderPanel();
        V().toast(removed ? '저장되었습니다. 보기·수정이 모두 없는 지정 ' + removed + '건을 제거했습니다.' : '저장되었습니다.');
    }
    function toggleUsage(id, on) {
        A.setUsage(id, on); renderTree(); renderPanel();
        V().toast(on ? '메뉴 사용으로 설정되었습니다.' : '메뉴 사용 안 함으로 설정되었습니다. (프로토타입 — 실제 내비게이션에는 영향 없음)');
    }

    /* 다른 메뉴 설정 복사 (단일 모달) */
    function openCopy(id) {
        const opts = A.middleMenus().filter(m => m.id !== id && m.groupId !== 'admin')
            .map(m => '<option value="' + m.id + '">' + esc(m.groupLabel + ' > ' + m.label) + (isUnset(m.id) ? ' (미설정)' : '') + '</option>').join('');
        V().openModal('다른 메뉴 설정 복사',
            '<p style="font-size:13px; color:var(--text-gray); margin-bottom:12px;">선택한 메뉴의 접근 권한 설정을 현재 목록으로 <b>대체</b>합니다. 저장 전이므로 되돌릴 수 있습니다.</p>' +
            '<select class="select" id="admm-copy-src" style="width:100%;"><option value="">복사할 메뉴 선택</option>' + opts + '</select>',
            '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" onclick="DYADMENU.doCopy(\'' + id + '\')">현재 목록 대체</button>');
    }
    function doCopy(id) {
        const sel = document.getElementById('admm-copy-src');
        const src = sel && sel.value;
        if (!src) { V().toast('복사할 메뉴를 선택하세요.'); return; }
        if (isUnset(src) && !confirm('기준 메뉴가 미설정이므로 대상 메뉴의 기존 지정이 모두 제거되어 미설정(기본 차단) 상태가 됩니다. 계속하시겠습니까?')) return;
        MUI.draft = clone(A.getAssignments(src));
        MUI.dirty = true; MUI.expanded = {};
        V().closeModal(); renderPanel();
        V().toast('설정을 불러왔습니다 — 저장해야 반영됩니다.');
    }

    /* 하위 메뉴 일괄 적용 */
    function bulkApply(gid) {
        const sel = document.getElementById('admm-bulk-src');
        const src = sel && sel.value;
        if (!src) { V().toast('기준 메뉴를 선택하세요.'); return; }
        const g = A.groups().find(x => x.id === gid);
        const targets = (g.items || []).filter(it => it.id !== src);
        const unsetWarn = isUnset(src) ? ' 기준 메뉴가 미설정이므로 대상 메뉴의 기존 지정이 모두 제거되어 미설정(기본 차단) 상태가 됩니다.' : '';
        if (!confirm('‘' + A.menuById(src).label + '’의 설정을 ' + g.label + ' 하위 ' + targets.length + '개 메뉴에 복사합니다. 각 메뉴의 기존 설정은 대체됩니다.' + unsetWarn + ' 계속하시겠습니까?')) return;
        const base = A.getAssignments(src);
        targets.forEach(it => A.setAssignments(it.id, clone(base)));
        renderTree(); renderPanel();
        V().toast(targets.length + '개 메뉴에 설정을 복사했습니다.');
    }

    /* 데모 초기화 */
    function resetDemo() {
        if (!confirm('메뉴·권한 데모 데이터를 초기 시드로 되돌립니다. 이 화면에서 변경한 내용이 모두 사라집니다. 계속하시겠습니까?')) return;
        A.resetDemo();
        MUI.sel = null; MUI.draft = null; MUI.dirty = false; MUI.expanded = {};
        renderTree(); renderPanel();
        V().toast('데모 데이터를 초기화했습니다.');
    }

    window.DYADMENU = {
        selMenu, selGroup, toggleGroup, search, setMode, togglePrev, addRole, pickDirect,
        chk, removeAssign, resetDraft, saveDraft, toggleUsage, openCopy, doCopy, bulkApply, resetDemo,
    };

    renderTree(); renderPanel();
})();
