/* =========================================================================
 * 담양군 중대재해예방 통합관리시스템 v2 — 권한 관리 (ADM02-S)
 *   좌: 권한 등급 목록 / 우: 등급 상세(기본 정보·구성원·적용 현황)
 *   보기·수정 권한 수준은 여기서 다루지 않음(메뉴 관리 소관, D1). 구성원만 관리.
 *   전역 네임스페이스: DYADROLE
 * ========================================================================= */
(function () {
    'use strict';
    const app = document.getElementById('adm-roles-app');
    if (!app || !window.DYADM) return;

    const A = window.DYADM;
    const V = () => window.DYV2;
    const esc = s => (window.DYV2 && DYV2.esc) ? DYV2.esc(s) : String(s == null ? '' : s);

    const RUI = { sel: null, draft: null, dirty: false };

    function cloneRole(r) { return JSON.parse(JSON.stringify(r)); }
    function blankRole() { return { id: null, name: '', desc: '', protected: false, fullAccess: false, autoAll: false, members: [] }; }

    /* ── 좌측 등급 목록 ── */
    function renderList() {
        const rows = A.roles().map(r => {
            const sel = RUI.sel === r.id;
            const ac = A.roleAppliedCount(r.id);
            const menuBadge = ac.all ? '<span class="chip-mini wt-program">전체 메뉴</span>' : '<span class="chip-mini wt">적용 ' + ac.n + '개</span>';
            return '<button type="button" class="admr-item' + (sel ? ' is-sel' : '') + '" onclick="DYADROLE.sel(\'' + r.id + '\')">' +
                '<div class="admr-item-top"><span class="admr-item-name">' + esc(r.name) + '</span>' +
                    (r.protected ? '<span class="chip-mini wt-program">보호</span>' : '') + '</div>' +
                '<div class="admr-item-sub"><span class="chip-mini wt">구성원 ' + A.roleMemberCountLabel(r) + '</span>' + menuBadge + '</div>' +
            '</button>';
        }).join('');
        const el = document.getElementById('admr-list');
        if (el) el.innerHTML = rows;
    }

    /* ── dirty 가드 ── */
    function guard() {
        if (RUI.dirty) return confirm('저장하지 않은 변경사항이 있습니다. 이동하면 변경 내용이 사라집니다. 계속하시겠습니까?');
        return true;
    }

    function sel(id) {
        if (RUI.sel === id && RUI.draft && RUI.draft.id === id) return;
        if (!guard()) return;
        const r = A.roleById(id);
        if (!r) return;
        RUI.sel = id; RUI.draft = cloneRole(r); RUI.dirty = false;
        renderList(); renderPanel();
    }
    function selNew() {
        if (!guard()) return;
        RUI.sel = '__new__'; RUI.draft = blankRole(); RUI.dirty = false;
        renderList(); renderPanel();
    }

    /* ── 우측 상세 ── */
    function renderPanel() {
        const el = document.getElementById('admr-panel');
        if (!el) return;
        if (!RUI.sel) { el.innerHTML = '<div class="card"><div class="card-body"><div class="v2-empty">좌측에서 등급을 선택하거나 [+ 등급 추가]로 새 등급을 만드세요.</div></div></div>'; return; }
        el.innerHTML = detailHtml();
    }

    function detailHtml() {
        const d = RUI.draft;
        const isNew = RUI.sel === '__new__';
        const locked = d.protected;

        /* 기본 정보 */
        const basic = '<div class="card" style="margin-bottom:16px;"><div class="card-header">' +
            '<span class="card-title">' + (isNew ? '새 등급' : '기본 정보') + '</span>' +
            (locked ? '<span class="chip-mini wt-program">보호 등급 · 속성 잠금</span>' : (RUI.dirty ? '<span class="chip-mini st-doing">저장 필요</span>' : '')) +
            '</div><div class="card-body">' +
            '<div class="admr-form">' +
                '<label class="admr-fl">등급명 <span style="color:var(--status-danger-fg);">*</span></label>' +
                '<input type="text" id="admr-name" value="' + esc(d.name) + '"' + (locked ? ' readonly' : '') + ' placeholder="예: 안전관리자" oninput="DYADROLE.field(\'name\',this.value)">' +
                '<label class="admr-fl">설명</label>' +
                '<textarea id="admr-desc" rows="2"' + (locked ? ' readonly' : '') + ' placeholder="등급의 용도를 설명하세요" oninput="DYADROLE.field(\'desc\',this.value)">' + esc(d.desc) + '</textarea>' +
            '</div>' +
            '<div class="admr-attrs">' +
                '<label class="admr-attr' + (locked ? ' is-lock' : '') + '"><input type="checkbox"' + (d.fullAccess ? ' checked' : '') + (locked ? ' disabled' : '') + ' onchange="DYADROLE.attr(\'fullAccess\',this.checked)"> 전체 권한</label>' +
                '<label class="admr-attr' + (locked ? ' is-lock' : '') + '"><input type="checkbox"' + (d.autoAll ? ' checked' : '') + (locked ? ' disabled' : '') + ' onchange="DYADROLE.attr(\'autoAll\',this.checked)"> 구성원 자동(전 직원)</label>' +
            '</div>' +
            (d.fullAccess && d.autoAll ? '<div class="admr-note warn">전 직원에게 모든 메뉴의 보기·수정 권한이 부여되는 조합입니다. 의도한 설정인지 확인하세요.</div>' : '') +
            (d.fullAccess ? '<div class="admr-note ok">전체 권한 — 메뉴별 설정 없이 모든 메뉴에 접근·수정합니다. (메뉴 관리의 개별 지정 대상에서 제외)</div>' : '') +
            (locked ? '<div class="admr-note">보호 등급입니다. 등급명·속성 변경과 삭제가 잠겨 있으며, 구성원은 최소 1명을 유지해야 합니다. (셀프 잠금 방지)</div>' : '') +
            '</div></div>';

        /* 구성원 */
        let members;
        if (d.autoAll) {
            members = '<div class="card" style="margin-bottom:16px;"><div class="card-header"><span class="card-title">구성원</span></div>' +
                '<div class="card-body"><div class="admr-note">SSO 로그인 사용자 전원이 자동 포함됩니다. 개별 구성원 지정은 사용하지 않습니다.</div></div></div>';
        } else {
            const rows = d.members.length ? d.members.map((m, i) => memberRow(m, i)).join('')
                : '<div class="v2-empty" style="padding:18px;">구성원이 없습니다. [+ 조직도에서 추가]로 부서·사용자를 선택하세요.</div>';
            members = '<div class="card" style="margin-bottom:16px;"><div class="card-header"><span class="card-title">구성원 <span class="chip-mini wt">' + A.roleMemberCountLabel(d) + '</span></span>' +
                '<button class="btn btn-outline btn-sm" onclick="DYADROLE.pickMembers()">+ 조직도에서 추가</button></div>' +
                '<div class="card-body"><div class="admr-mlist">' + rows + '</div></div></div>';
        }

        /* 적용 현황 (저장된 메뉴 지정 기준) */
        let applied;
        if (isNew) {
            applied = '<div class="card" style="margin-bottom:16px;"><div class="card-header"><span class="card-title">적용 현황</span></div>' +
                '<div class="card-body"><div class="admr-note">등급을 저장한 뒤 메뉴 관리에서 이 등급을 메뉴에 지정하면 여기에 표시됩니다.</div></div></div>';
        } else if (d.fullAccess) {
            applied = '<div class="card" style="margin-bottom:16px;"><div class="card-header"><span class="card-title">적용 현황</span></div>' +
                '<div class="card-body"><div class="admr-note ok">전체 권한 등급 — 전 메뉴(' + A.middleMenus().length + '개)에 자동 접근·수정합니다.</div></div></div>';
        } else {
            const am = A.roleAppliedMenus(RUI.sel);
            const list = am.length ? am.map(x =>
                '<tr><td>' + esc(x.menu.groupLabel) + '</td><td style="font-weight:600;">' + esc(x.menu.label) + '</td>' +
                '<td style="text-align:center;">' + (x.view ? '<b style="color:var(--main);">O</b>' : '<span style="color:var(--text-lightgray);">-</span>') + '</td>' +
                '<td style="text-align:center;">' + (x.edit ? '<b style="color:var(--main);">O</b>' : '<span style="color:var(--text-lightgray);">-</span>') + '</td></tr>').join('')
                : '<tr><td colspan="4"><div class="v2-empty" style="padding:16px;">아직 적용된 메뉴가 없습니다.</div></td></tr>';
            applied = '<div class="card" style="margin-bottom:16px;"><div class="card-header"><span class="card-title">적용 현황 <span class="chip-mini wt">메뉴 ' + am.length + '개</span></span></div>' +
                '<div class="card-body">' +
                    '<p class="admr-applied-note">보기·수정 권한은 <b>메뉴 관리</b>에서 메뉴별로 설정합니다. 아래는 읽기 전용 현황입니다.</p>' +
                    '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>대메뉴</th><th>중메뉴</th><th style="width:60px;">보기</th><th style="width:60px;">수정</th></tr></thead>' +
                    '<tbody>' + list + '</tbody></table></div>' +
                '</div></div>';
        }

        /* 액션 */
        const del = (!isNew && !d.protected)
            ? '<button class="btn btn-outline btn-sm admr-del" onclick="DYADROLE.remove()">등급 삭제</button>'
            : '';
        const foot = '<div class="admr-foot">' + del + '<span class="spacer" style="flex:1;"></span>' +
            '<button class="btn btn-secondary btn-sm" onclick="DYADROLE.reset()">초기화</button>' +
            '<button class="btn btn-primary btn-sm" onclick="DYADROLE.save()">저장</button></div>';

        return basic + members + applied + foot;
    }

    function memberRow(m, i) {
        let badge, target;
        if (m.kind === 'dept') {
            const n = A.nodeById(m.id);
            badge = '<span class="chip-mini wt-elec">부서</span>';
            target = '<b>' + esc(n ? n.name : m.id) + '</b>' + (m.includeSub ? ' <span class="chip-mini pdca">하위 포함</span>' : ' <span class="chip-mini wt">직속만</span>');
        } else {
            const p = A.personByUid(m.id);
            badge = '<span class="chip-mini pdca">사용자</span>';
            target = '<b>' + esc(p ? p.name : m.id) + '</b>' + (p ? ' <span class="admr-mc">' + esc(p.deptName + ' · ' + p.role) + '</span>' : '');
        }
        return '<div class="admr-mrow">' + badge + '<span class="admr-mtarget">' + target + '</span>' +
            '<button type="button" class="btn btn-sm btn-outline" onclick="DYADROLE.removeMember(' + i + ')">제거</button></div>';
    }

    /* ── 상호작용 ── */
    function field(k, v) { RUI.draft[k] = v; RUI.dirty = true; /* 입력 중 재렌더 안 함(포커스 유지) */ }
    function attr(k, checked) { RUI.draft[k] = checked; RUI.dirty = true; renderPanel(); }
    function pickMembers() {
        const existing = RUI.draft.members.map(m => ({ kind: m.kind, id: m.id }));
        const gradeName = (RUI.draft.name || '').trim() || (RUI.sel === '__new__' ? '새 등급' : '등급');
        A.openOrgPicker({
            title: '구성원 추가 — ' + gradeName, existing: existing,
            onApply: function (items) {
                let added = 0, skipped = 0, overlap = 0;
                items.forEach(it => {
                    if (RUI.draft.members.some(m => m.kind === it.kind && m.id === it.id)) { skipped++; return; }
                    RUI.draft.members.push({ kind: it.kind, id: it.id, includeSub: !!it.includeSub });
                    added++;
                });
                /* 부서 + 그 부서 소속 개인 동시 존재 감지 */
                overlap = detectOverlap(RUI.draft.members);
                if (added) { RUI.dirty = true; renderPanel(); }
                let msg = added + '건 추가' + (skipped ? ' · ' + skipped + '건 중복 제외' : '');
                if (overlap) msg += ' · 부서와 그 소속 개인이 중복 지정되어 있습니다(실효 권한은 합집합)';
                V().toast(msg);
            },
        });
    }
    function detectOverlap(members) {
        let cnt = 0;
        members.filter(m => m.kind === 'user').forEach(u => {
            members.filter(m => m.kind === 'dept').forEach(dp => {
                if (A.isUnder(u.id, dp.id, dp.includeSub)) cnt++;
            });
        });
        return cnt;
    }
    function removeMember(i) {
        if (RUI.draft.protected && RUI.draft.members.length <= 1) {
            V().toast('보호 등급은 구성원을 최소 1명 유지해야 합니다. (셀프 잠금 방지)');
            return;
        }
        RUI.draft.members.splice(i, 1); RUI.dirty = true; renderPanel();
    }
    function reset() {
        if (RUI.sel === '__new__') { RUI.draft = blankRole(); }
        else { const r = A.roleById(RUI.sel); RUI.draft = cloneRole(r); }
        RUI.dirty = false; renderPanel(); V().toast('변경 내용을 되돌렸습니다.');
    }
    function save() {
        const d = RUI.draft;
        const name = String(d.name || '').trim();
        if (!name) { V().toast('등급명을 입력하세요.'); return; }
        const dup = A.roles().some(r => r.name === name && r.id !== d.id);
        if (dup) { V().toast('이미 같은 이름의 등급이 있습니다.'); return; }
        if (RUI.sel === '__new__') {
            const res = A.addRole({ name: name, desc: d.desc, fullAccess: d.fullAccess, autoAll: d.autoAll, members: d.members });
            if (!res.ok) { V().toast(res.msg); return; }
            RUI.sel = res.id; RUI.draft = cloneRole(A.roleById(res.id)); RUI.dirty = false;
            renderList(); renderPanel(); V().toast('등급이 추가되었습니다.');
        } else {
            d.name = name;
            A.saveRole(d); RUI.dirty = false;
            renderList(); renderPanel(); V().toast('저장되었습니다.');
        }
    }
    function remove() {
        const d = RUI.draft;
        const ac = A.roleAppliedCount(d.id);
        const warn = ac.n ? ('이 등급은 ' + ac.n + '개 메뉴에 적용 중입니다. 삭제하면 해당 메뉴에서 지정이 제거됩니다.\n\n계속하시겠습니까?') : '이 등급을 삭제하시겠습니까?';
        if (!confirm(warn)) return;
        const res = A.removeRole(d.id);
        if (!res.ok) { V().toast(res.msg); return; }
        RUI.sel = null; RUI.draft = null; RUI.dirty = false;
        renderList(); renderPanel(); V().toast('등급이 삭제되었습니다.');
    }

    function resetDemo() {
        if (!confirm('권한 등급 데모 데이터를 초기 시드로 되돌립니다. 변경 내용이 모두 사라집니다. 계속하시겠습니까?')) return;
        A.resetDemo();
        RUI.sel = null; RUI.draft = null; RUI.dirty = false;
        renderList(); renderPanel(); V().toast('데모 데이터를 초기화했습니다.');
    }

    window.DYADROLE = {
        sel, selNew, field, attr, pickMembers, removeMember, reset, save, remove, resetDemo,
    };

    renderList(); renderPanel();
})();
