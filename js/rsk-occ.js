/* =====================================================================
   rsk-occ.js · 수시 위험성평가 (RSK03-L, 신규)
   · 연도 셀렉트 + 사유 필터 (ACCIDENT · EQUIP_CHANGE · OTHER)
   · [+등록] 모달: 부서·사유·발생일·내용·첨부 → 상태 REGISTERED + 알림
   · [검토완료] → REVIEWED. history 기록.
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYRSK; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }

    var state = { mount: null, year: 2026, fReason: '' };
    var F = null; /* 등록 폼 상태 */

    function render() {
        if (!state.mount) return;
        var years = D().occasionalYears();
        if (years.indexOf(state.year) === -1) years.unshift(state.year);
        years.sort(function (a, b) { return b - a; });

        var list = D().occasionals(state.year).filter(function (o) {
            return !state.fReason || o.reason === state.fReason;
        });

        var head =
            '<div class="roc-toolbar">' +
                '<div class="roc-tb-left">' +
                    '<label class="roc-tb-label">연도</label>' +
                    '<select class="form-select" onchange="RSKOCC.setYear(+this.value)">' +
                        years.map(function (y) { return '<option value="' + y + '"' + (y === state.year ? ' selected' : '') + '>' + y + '년</option>'; }).join('') +
                    '</select>' +
                    '<label class="roc-tb-label" style="margin-left:12px;">사유</label>' +
                    '<select class="form-select" onchange="RSKOCC.setReason(this.value)">' +
                        '<option value="">전체</option>' +
                        Object.keys(D().OCC_REASONS).map(function (k) {
                            return '<option value="' + k + '"' + (state.fReason === k ? ' selected' : '') + '>' + esc(D().OCC_REASONS[k].label) + '</option>';
                        }).join('') +
                    '</select>' +
                '</div>' +
                '<div>' +
                    '<button type="button" class="btn btn-primary" onclick="RSKOCC.openRegister()">＋ 수시평가 등록</button>' +
                '</div>' +
            '</div>';

        var rows = list.length ? list.map(rowHtml).join('') :
            '<tr><td colspan="6" style="text-align:center;color:var(--text-lightgray);padding:24px;">' + state.year + '년 수시 위험성평가가 없습니다.</td></tr>';
        var table =
            '<table class="roc-table"><thead><tr>' +
                '<th style="width:110px;">발생일</th><th style="width:130px;">사유</th>' +
                '<th style="width:180px;">부서</th><th>내용 / 첨부</th>' +
                '<th style="width:110px;">상태</th><th style="width:170px;">관리</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table>';

        state.mount.innerHTML = head + table;
    }

    function rowHtml(o) {
        var rMeta = D().OCC_REASONS[o.reason] || { label: o.reason };
        var stChip = o.status === 'REVIEWED'
            ? '<span class="chip-mini st-done">검토완료</span>'
            : '<span class="chip-mini st-doing">등록됨</span>';
        var files = (o.files || []).map(function (f) { return f.name; }).join(', ');
        var actBtn = o.status === 'REVIEWED'
            ? '<button type="button" class="btn btn-outline btn-sm" onclick="RSKOCC.openView(\'' + o.id + '\')">이력</button>'
            : '<button type="button" class="btn btn-outline btn-sm" onclick="RSKOCC.openView(\'' + o.id + '\')">이력</button>' +
              ' <button type="button" class="btn btn-primary btn-sm" onclick="RSKOCC.review(\'' + o.id + '\')">검토완료</button>';
        return '<tr>' +
            '<td>' + esc(o.date || '-') + '</td>' +
            '<td><span class="roc-reason ' + o.reason + '">' + esc(rMeta.label) + '</span></td>' +
            '<td>' + esc(D().deptName(o.deptId)) + '</td>' +
            '<td><div>' + esc(o.desc || '-') + '</div>' +
                (files ? '<div class="roc-files">첨부 ' + esc(files) + '</div>' : '') + '</td>' +
            '<td>' + stChip + (o.status === 'REVIEWED' && o.reviewedAt ? '<div style="font-size:11px;color:var(--text-lightgray);margin-top:3px;">' + esc(o.reviewedAt) + '</div>' : '') + '</td>' +
            '<td>' + actBtn + '</td>' +
        '</tr>';
    }

    function setYear(y) { state.year = y; render(); }
    function setReason(r) { state.fReason = r; render(); }

    /* =============== 등록 =============== */
    function openRegister(prefillDeptId) {
        var depts = D().deptCandidates();
        F = {
            deptId: prefillDeptId || (depts[0] && depts[0].id) || '',
            reason: 'ACCIDENT', date: D().today(), desc: '', files: []
        };
        renderRegister();
    }
    function renderRegister() {
        var reasonOpts = Object.keys(D().OCC_REASONS).map(function (k) {
            return '<option value="' + k + '"' + (F.reason === k ? ' selected' : '') + '>' + esc(D().OCC_REASONS[k].label) + '</option>';
        }).join('');
        var fileList = F.files.length
            ? F.files.map(function (f, i) { return '<div style="font-size:12px;padding:3px 0;">' + esc(f.name) + ' <button type="button" style="border:none;background:none;color:var(--status-danger-fg);cursor:pointer;" onclick="RSKOCC.regDelFile(' + i + ')">×</button></div>'; }).join('')
            : '<div style="font-size:12px;color:var(--text-lightgray);">첨부 파일 없음</div>';
        var body =
            /* 부서 — 공용 인라인 조직도(ORGPICK)에서 선택 (단일 모달 규칙: 별도 모달 없이 입력 아래 펼침) */
            '<div class="roc-modal-row"><label class="form-label" for="roc-r-deptname">부서 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<div class="orgpick-field" id="roc-r-deptfield"><div style="display:flex;gap:8px;">' +
                    '<input type="text" class="form-input" id="roc-r-deptname" readonly placeholder="조직도에서 부서 선택" style="flex:1;" value="' + esc(F.deptId ? D().deptName(F.deptId) : '') + '">' +
                    '<button type="button" class="btn btn-outline" onclick="ORGPICK.toggle(\'roc-r-deptfield\',\'deptId\',\'RSKOCC.pickDept\')">조직도</button>' +
                '</div></div></div>' +
            '<div class="roc-modal-row"><label class="form-label">사유 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<select class="form-select" id="roc-r-reason">' + reasonOpts + '</select></div>' +
            '<div class="roc-modal-row"><label class="form-label">발생일 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="date" class="form-input" id="roc-r-date" value="' + esc(F.date) + '" style="max-width:200px;"></div>' +
            '<div class="roc-modal-row"><label class="form-label">내용 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<textarea class="form-textarea" id="roc-r-desc" rows="3" placeholder="사고·변경 사항의 경위와 필요한 위험성 재평가 요청 사항">' + esc(F.desc) + '</textarea></div>' +
            '<div class="roc-modal-row"><label class="form-label">첨부파일</label>' +
                '<div>' + fileList + '</div>' +
                '<button type="button" class="btn btn-outline btn-sm" style="margin-top:6px;" onclick="RSKOCC.regAddFile()">＋ 파일 첨부 (프로토타입)</button>' +
                V().fileHint() +
            '</div>';
        V().openModal('수시 위험성평가 등록', body,
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="RSKOCC.doRegister()">등록</button>');
    }
    function regAddFile() {
        F.files.push({ name: '첨부_' + (F.files.length + 1) + '.pdf' });
        toast('파일 첨부 (프로토타입)'); renderRegister();
    }
    function regDelFile(i) { F.files.splice(i, 1); renderRegister(); }
    /* 조직도(ORGPICK 'deptId' 모드)에서 호출 — 표시는 부서명, 저장은 deptId */
    function pickDept(id, name) {
        F.deptId = id;
        var inp = document.getElementById('roc-r-deptname'); if (inp) inp.value = name;
    }
    function captureRegister() {
        /* 부서는 조직도 선택 시 F.deptId 에 이미 반영되어 있다(읽기전용 입력이라 DOM 에서 읽지 않는다) */
        F.reason = document.getElementById('roc-r-reason').value;
        F.date = document.getElementById('roc-r-date').value;
        F.desc = (document.getElementById('roc-r-desc').value || '').trim();
    }
    function doRegister() {
        captureRegister();
        if (!F.deptId || !F.reason || !F.date || !F.desc) { toast('부서·사유·발생일·내용을 모두 입력하세요.'); return; }
        var it = D().addOccasional({
            year: state.year, deptId: F.deptId, reason: F.reason,
            date: F.date, desc: F.desc, files: F.files
        });
        V().closeModal(); toast('수시평가 등록 · 재난안전과 알림 (프로토타입)'); render();
    }

    /* =============== 검토완료 =============== */
    function review(id) {
        V().openModal('수시평가 검토완료',
            '<p style="font-size:13px;">이 수시평가를 <b>검토완료</b>로 처리하시겠습니까?<br>이후 후속 개선조치는 개선조치 메뉴에서 관리합니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="RSKOCC.doReview(\'' + id + '\')">검토완료</button>');
    }
    function doReview(id) {
        D().reviewOccasional(id, '재난안전과');
        V().closeModal(); toast('검토완료 처리'); render();
    }

    /* =============== 이력 =============== */
    function openView(id) {
        var o = D().occasionalOf(id); if (!o) return;
        var LABELS = { REGISTER:'등록', REVIEW:'검토', NOTIFY:'알림', STATUS:'상태변경' };
        var rows = (o.history || []).map(function (h) {
            return '<div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px dashed var(--card-line);font-size:13px;">' +
                '<span style="width:130px;font-size:12px;color:var(--text-lightgray);">' + esc(h.at) + '</span>' +
                '<span class="chip-mini st-doing" style="flex:none;">' + esc(LABELS[h.type] || h.type) + '</span>' +
                '<span style="flex:1;">' + esc(h.memo) + (h.by ? '<span style="font-size:11px;color:var(--text-lightgray);margin-left:6px;">— ' + esc(h.by) + '</span>' : '') + '</span>' +
            '</div>';
        }).join('');
        V().openModal(esc(o.id) + ' 이력',
            '<div style="font-size:13px;color:var(--text-gray);margin-bottom:10px;">' +
                '부서 <b style="color:var(--text-black);">' + esc(D().deptName(o.deptId)) + '</b> · ' +
                '사유 <b style="color:var(--text-black);">' + esc((D().OCC_REASONS[o.reason] || {}).label || o.reason) + '</b> · ' +
                '발생일 <b style="color:var(--text-black);">' + esc(o.date) + '</b>' +
            '</div>' +
            '<div>' + rows + '</div>',
            '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal()">닫기</button>');
    }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        var q = new URLSearchParams(location.search);
        var yr = q.get('year'); if (yr) state.year = +yr;
        render();
        /* rsk-my에서 진입한 프리필 부서 */
        var pre = q.get('dept');
        if (q.get('new') === '1') openRegister(pre || '');
    }

    global.RSKOCC = {
        init: init, setYear: setYear, setReason: setReason,
        openRegister: openRegister, pickDept: pickDept, regAddFile: regAddFile, regDelFile: regDelFile, doRegister: doRegister,
        review: review, doReview: doReview, openView: openView
    };
})(window);
