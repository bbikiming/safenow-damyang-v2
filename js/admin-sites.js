/* =====================================================================
   admin-sites.js · 사업장 관리 (ADM03-S)
   · 담양군 사업장 마스터(DYSITE) 조회·등록·편집·비활성화
   · 부서(조직도 DYV2 파생) 필터 · 유형/유해인자/측정대상 판정 관리
   · 작업환경측정 계획 등록의 '사업장' 드롭다운이 이 마스터를 참조
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var M = function () { return global.DYSITE; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }

    var state = { mount: null, dept: '' };

    function typeTag(t) {
        var spec = /폐기물|하수|정수/.test(t);
        return '<span class="sh-tag' + (spec ? ' spec' : '') + '">' + esc(t) + '</span>';
    }
    function targetTag(t) {
        var tone = t === '대상' ? 'success' : (t === '비대상' ? 'neutral' : 'warning');
        return '<span class="chip-status ' + tone + '">' + esc(t || '검토 중') + '</span>';
    }

    function render() {
        if (!state.mount) return;
        var list = M().sites().filter(function (s) { return !state.dept || s.dept === state.dept; });
        var deptOpts = ['<option value="">부서 전체</option>'].concat(
            uniq(M().sites().map(function (s) { return s.dept; })).map(function (d) {
                return '<option value="' + esc(d) + '"' + (state.dept === d ? ' selected' : '') + '>' + esc(d) + '</option>';
            })).join('');

        var notice =
            '<div class="sh-linkbar">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22V12h6v10"/></svg>' +
                '<div><b>사업장(작업장)</b>은 부서(조직)와 별개인 물리적 작업장입니다. 여기 등록된 사업장이 ' +
                '<b>작업환경측정 계획 등록</b>의 <b>사업장 드롭다운</b>(부서 선택 후)에 표시됩니다. ' +
                '<a href="work-env.html">작업환경측정으로 이동 →</a></div>' +
            '</div>';

        var toolbar =
            '<div class="sh-toolbar"><div class="sh-filters">' +
                '<span class="sh-fl">관할 부서</span>' +
                '<select class="form-select" aria-label="관할 부서" onchange="DYADMSITE.setDept(this.value)">' + deptOpts + '</select>' +
                '<span style="font-size:12px;color:var(--text-gray);">총 <b>' + M().sites().length + '</b>개 사업장</span>' +
            '</div>' +
            '<button type="button" class="btn btn-primary" onclick="DYADMSITE.openNew()">＋ 사업장 등록</button></div>';

        var rows = list.length ? list.map(rowHtml).join('') :
            '<tr><td colspan="8" class="sh-empty">조건에 맞는 사업장이 없습니다.</td></tr>';

        state.mount.innerHTML = notice + toolbar +
            '<div class="sh-wrap"><table class="sh-table"><thead><tr>' +
                '<th>관할 부서</th><th>사업장명</th><th>유형</th><th>주요 유해인자</th><th>측정대상</th><th>판정근거</th><th>사용상태</th><th>관리</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    function rowHtml(s) {
        return '<tr>' +
            '<td>' + esc(s.dept) + '</td>' +
            '<td><b>' + esc(s.name) + '</b></td>' +
            '<td>' + typeTag(s.type) + '</td>' +
            '<td>' + esc(s.hazards || '-') + '</td>' +
            '<td>' + targetTag(s.targetState) + '</td>' +
            '<td>' + (s.targetBasis ? esc(s.targetBasis) : '<span style="color:var(--text-gray)">미등록</span>') + '</td>' +
            '<td>' + (s.active === false ? '<span class="chip-status neutral">비활성</span>' : '<span class="chip-status success">활성</span>') + '</td>' +
            '<td><button type="button" class="btn btn-sm btn-outline" onclick="DYADMSITE.openEdit(\'' + s.id + '\')">편집</button> ' +
                (s.active === false
                    ? '<button type="button" class="btn btn-sm btn-outline" onclick="DYADMSITE.reactivate(\'' + s.id + '\')">재활성</button>'
                    : '<button type="button" class="btn btn-sm btn-outline" onclick="DYADMSITE.confirmRemove(\'' + s.id + '\')">사용 중지</button>') + '</td>' +
        '</tr>';
    }

    function uniq(a) { var s = {}, o = []; a.forEach(function (x) { if (!s[x]) { s[x] = 1; o.push(x); } }); return o; }
    function setDept(v) { state.dept = v; render(); }

    function formBody(s) {
        s = s || {};
        var deptOpts = V().deptNames().map(function (d) {
            return '<option' + (s.dept === d ? ' selected' : '') + '>' + esc(d) + '</option>';
        }).join('');
        var typeOpts = M().TYPES.map(function (t) {
            return '<option' + (s.type === t ? ' selected' : '') + '>' + esc(t) + '</option>';
        }).join('');
        var targetOpts = M().TARGET_STATES.map(function (t) {
            return '<option' + ((s.targetState || '검토 중') === t ? ' selected' : '') + '>' + esc(t) + '</option>';
        }).join('');
        return '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="as-dept">관할 부서 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<select class="form-select" id="as-dept">' + deptOpts + '</select></div>' +
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="as-name">사업장명 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="text" class="form-input" id="as-name" value="' + esc(s.name || '') + '" placeholder="예: 담양정수장"></div>' +
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="as-type">유형</label>' +
                '<select class="form-select" id="as-type">' + typeOpts + '</select></div>' +
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="as-haz">주요 유해인자</label>' +
                '<input type="text" class="form-input" id="as-haz" value="' + esc(s.hazards || '') + '" placeholder="예: 염소·분진·소음"></div>' +
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="as-target">작업환경측정 대상 판정 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<select class="form-select" id="as-target">' + targetOpts + '</select></div>' +
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="as-basis">판정근거</label>' +
                '<textarea class="form-textarea" id="as-basis" rows="2" placeholder="대상·비대상 판정의 유해인자·공정·근거자료">' + esc(s.targetBasis || '') + '</textarea></div>' +
            '<div class="ri-modal-row"><label class="form-label" for="as-note">비고</label>' +
                '<input type="text" class="form-input" id="as-note" value="' + esc(s.note || '') + '" placeholder="예: 측정 대상 여부·특이사항"></div>';
    }

    function openNew() {
        V().openModal('사업장 등록', formBody(null),
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="DYADMSITE.save(null)">등록</button>');
    }
    function openEdit(id) {
        var s = M().siteOf(id); if (!s) return;
        V().openModal('사업장 편집', formBody(s),
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="DYADMSITE.save(\'' + id + '\')">저장</button>');
    }
    function save(id) {
        var o = {
            dept: document.getElementById('as-dept').value,
            name: (document.getElementById('as-name').value || '').trim(),
            type: document.getElementById('as-type').value,
            hazards: (document.getElementById('as-haz').value || '').trim(),
            targetState: document.getElementById('as-target').value,
            targetBasis: (document.getElementById('as-basis').value || '').trim(),
            note: (document.getElementById('as-note').value || '').trim()
        };
        if (!o.name) { V().toast('사업장명을 입력하세요.'); return; }
        if (o.targetState !== '검토 중' && !o.targetBasis) { V().toast('대상·비대상 판정근거를 입력하세요.'); return; }
        if (M().duplicateOf(o.dept, o.name, id || '')) { V().toast('같은 부서에 같은 이름의 사업장이 이미 있습니다.'); return; }
        if (id) M().updateSite(id, o); else M().addSite(o);
        V().closeModal(); render(); V().toast(id ? '사업장이 저장되었습니다.' : '사업장이 등록되었습니다.');
    }
    function confirmRemove(id) {
        var s = M().siteOf(id); if (!s) return;
        var used = M().isUsed(id);
        V().openModal(used ? '사업장 비활성화' : '사업장 사용 중지',
            '<p style="font-size:13px;line-height:1.6;"><b>' + esc(s.name) + '</b>(' + esc(s.dept) + ')을 신규 측정계획 선택에서 제외합니다.<br>' +
            '<span style="color:var(--text-gray);">' + (used ? '기존 측정계획이 참조하므로 삭제하지 않고 비활성화합니다.' : '참조 이력이 없어 비활성화 후 오등록이면 별도 삭제할 수 있습니다.') + '</span></p>' +
            '<label class="form-label" for="as-inactive-reason">사용 중지 사유 <span style="color:var(--status-danger-fg)">*</span></label>' +
            '<textarea class="form-textarea" id="as-inactive-reason" rows="2" placeholder="폐쇄·통합·오등록 등"></textarea>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="DYADMSITE.doRemove(\'' + id + '\')">사용 중지</button>');
    }
    function doRemove(id) {
        var reason = (document.getElementById('as-inactive-reason').value || '').trim();
        if (!reason) { V().toast('사용 중지 사유를 입력하세요.'); return; }
        M().setActive(id, false, reason); V().closeModal(); render(); V().toast('사업장이 비활성화되었습니다.');
    }
    function reactivate(id) { M().setActive(id, true, ''); render(); V().toast('사업장이 다시 활성화되었습니다.'); }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        var q = new URLSearchParams(location.search);
        if (q.get('dept')) state.dept = q.get('dept');
        render();
    }

    global.DYADMSITE = { init: init, setDept: setDept, openNew: openNew, openEdit: openEdit,
        save: save, confirmRemove: confirmRemove, doRemove: doRemove, reactivate: reactivate };
})(window);
