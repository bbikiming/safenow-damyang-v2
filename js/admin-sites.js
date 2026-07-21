/* =====================================================================
   admin-sites.js · 사업장 관리 (ADM03-S)
   · 담양군 사업장 마스터(DYSITE) 조회·등록·편집·삭제
   · 부서(조직도 DYV2 파생) 필터 · 유형/유해인자 관리
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
            '<tr><td colspan="6" class="sh-empty">조건에 맞는 사업장이 없습니다.</td></tr>';

        state.mount.innerHTML = notice + toolbar +
            '<div class="sh-wrap"><table class="sh-table"><thead><tr>' +
                '<th>관할 부서</th><th>사업장명</th><th>유형</th><th>주요 유해인자</th><th>비고</th><th>관리</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    function rowHtml(s) {
        return '<tr>' +
            '<td>' + esc(s.dept) + '</td>' +
            '<td><b>' + esc(s.name) + '</b></td>' +
            '<td>' + typeTag(s.type) + '</td>' +
            '<td>' + esc(s.hazards || '-') + '</td>' +
            '<td>' + (s.note ? esc(s.note) : '<span style="color:var(--text-lightgray)">-</span>') + '</td>' +
            '<td><button type="button" class="btn btn-sm btn-outline" onclick="DYADMSITE.openEdit(\'' + s.id + '\')">편집</button> ' +
                '<button type="button" class="btn btn-sm btn-outline" onclick="DYADMSITE.confirmRemove(\'' + s.id + '\')">삭제</button></td>' +
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
        return '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="as-dept">관할 부서 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<select class="form-select" id="as-dept">' + deptOpts + '</select></div>' +
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="as-name">사업장명 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="text" class="form-input" id="as-name" value="' + esc(s.name || '') + '" placeholder="예: 담양정수장"></div>' +
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="as-type">유형</label>' +
                '<select class="form-select" id="as-type">' + typeOpts + '</select></div>' +
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="as-haz">주요 유해인자</label>' +
                '<input type="text" class="form-input" id="as-haz" value="' + esc(s.hazards || '') + '" placeholder="예: 염소·분진·소음"></div>' +
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
            note: (document.getElementById('as-note').value || '').trim()
        };
        if (!o.name) { V().toast('사업장명을 입력하세요.'); return; }
        if (id) M().updateSite(id, o); else M().addSite(o);
        V().closeModal(); render(); V().toast(id ? '사업장이 저장되었습니다.' : '사업장이 등록되었습니다.');
    }
    function confirmRemove(id) {
        var s = M().siteOf(id); if (!s) return;
        V().openModal('사업장 삭제',
            '<p style="font-size:13px;line-height:1.6;"><b>' + esc(s.name) + '</b>(' + esc(s.dept) + ') 사업장을 삭제할까요?<br>' +
            '<span style="color:var(--text-gray);">작업환경측정 계획의 사업장 드롭다운에서 더 이상 선택할 수 없게 됩니다.</span></p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" style="background:var(--status-danger-fg);border-color:var(--status-danger-fg);" onclick="DYADMSITE.doRemove(\'' + id + '\')">삭제</button>');
    }
    function doRemove(id) { M().removeSite(id); V().closeModal(); render(); V().toast('사업장이 삭제되었습니다.'); }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        var q = new URLSearchParams(location.search);
        if (q.get('dept')) state.dept = q.get('dept');
        render();
    }

    global.DYADMSITE = { init: init, setDept: setDept, openNew: openNew, openEdit: openEdit,
        save: save, confirmRemove: confirmRemove, doRemove: doRemove };
})(window);
