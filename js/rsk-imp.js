/* =====================================================================
   rsk-imp.js · 개선조치 목록 (IMP01-L · 정본)
   · 출처 배지·필터 · 위험성평가 출처 유해위험요인 링크 · 기한 색상
   · 행 → rsk-imp-detail · [+ 수동 등록] · 담당자 지정
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYRSK; };
    var KO = function () { return global.DYRSK.KOSHA; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }

    var state = { mount: null, fSource: '', fStatus: '' };

    function srcBadge(t) { var m = D().SRC_META[t] || D().SRC_META.manual; return '<span class="src-badge ' + m.tone + '">' + esc(m.label) + '</span>'; }
    function stChip(t) { var m = D().STATUS_META[t] || D().STATUS_META.PENDING; return '<span class="chip-mini ' + (t === 'DONE' ? 'st-done' : (t === 'IN_PROGRESS' ? 'st-doing' : 'st-todo')) + '">' + esc(m.label) + '</span>'; }
    function dueClass(due, status) {
        if (status === 'DONE' || !due) return '';
        // 정적 프로토타입 기준일 2026-07-13
        var today = new Date('2026-07-13'), d = new Date(due);
        var diff = Math.round((d - today) / 86400000);
        if (diff < 0) return 'over';
        if (diff <= 14) return 'soon';
        return '';
    }

    function render() {
        var list = D().improvements().filter(function (m) {
            return (!state.fSource || m.source_type === state.fSource) && (!state.fStatus || m.status === state.fStatus);
        });
        var head =
            '<div class="ri-toolbar"><div class="ri-filters">' +
                '<select class="form-select" onchange="RSKIMP.setSource(this.value)"><option value="">출처 전체</option>' +
                    Object.keys(D().SRC_META).map(function (k) { return '<option value="' + k + '"' + (state.fSource === k ? ' selected' : '') + '>' + esc(D().SRC_META[k].label) + '</option>'; }).join('') +
                '</select>' +
                '<select class="form-select" onchange="RSKIMP.setStatus(this.value)"><option value="">상태 전체</option>' +
                    '<option value="PENDING"' + (state.fStatus === 'PENDING' ? ' selected' : '') + '>예정</option>' +
                    '<option value="IN_PROGRESS"' + (state.fStatus === 'IN_PROGRESS' ? ' selected' : '') + '>진행중</option>' +
                    '<option value="DONE"' + (state.fStatus === 'DONE' ? ' selected' : '') + '>완료</option></select>' +
            '</div>' +
            '<button type="button" class="btn btn-primary" onclick="RSKIMP.openManual()">＋ 개선조치 등록</button></div>';

        var rows = list.length ? list.map(function (m) {
            var t = KO().targetOf(m.target_id);
            var scope = m.dept_id ? D().deptName(m.dept_id) : (t ? t.name : '-');
            var hazardName = (m.hazard && m.hazard.name) || m.hazard_risk_factor || '';
            var titleCell = esc(m.description) +
                (hazardName ? '<div class="ri-hrf">' + esc(hazardName) +
                    (m.hazard && m.hazard.category ? ' <span class="chip-mini wt" style="margin-left:4px;">' + esc(m.hazard.category) + '</span>' : '') +
                '</div>' : '');
            var owner = m.assigned_to ? esc(m.assigned_to) : '<a href="#" onclick="RSKIMP.assign(\'' + m.id + '\');return false;" style="color:var(--main-dark);">지정</a>';
            var due = m.due || m.due_date || '';
            return '<tr onclick="RSKIMP.detail(\'' + m.id + '\')">' +
                '<td>' + srcBadge(m.source_type) + '</td>' +
                '<td>' + esc(scope) + '</td>' +
                '<td>' + titleCell + '</td>' +
                '<td onclick="event.stopPropagation()">' + owner + '</td>' +
                '<td class="ri-due ' + dueClass(due, m.status) + '">' + esc(due || '-') + '</td>' +
                '<td>' + stChip(m.status) + '</td></tr>';
        }).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--text-lightgray);padding:24px;">조건에 맞는 개선조치가 없습니다.</td></tr>';

        state.mount.innerHTML = head +
            '<table class="ri-table"><thead><tr>' +
                '<th>출처</th><th>부서 / 관리대상</th><th>제목 / 유해위험요인</th><th>담당자</th><th>기한</th><th>상태</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table>';
    }

    function setSource(v) { state.fSource = v; render(); }
    function setStatus(v) { state.fStatus = v; render(); }
    function detail(id) { location.href = 'rsk-imp-detail.html?id=' + id; }

    function assign(id) {
        var m = D().improvementOf(id);
        var re = /(과장|팀장|소장|실장|담당|관리자)/, opts = [];
        (V().orgFlat() || []).forEach(function (d) { d.members.forEach(function (mm) { if (re.test(mm[0])) opts.push(d.dept + ' · ' + mm[0] + ' / ' + mm[1]); }); });
        V().openModal('담당자 지정',
            '<div class="ri-modal-row"><label class="form-label">담당자</label>' +
                '<select class="form-select" id="ri-assignee"><option value="">-- 선택 --</option>' +
                    opts.map(function (o) { return '<option>' + esc(o) + '</option>'; }).join('') + '</select></div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="RSKIMP.saveAssign(\'' + id + '\')">지정</button>');
    }
    function saveAssign(id) {
        var v = document.getElementById('ri-assignee').value;
        if (!v) { toast('담당자를 선택하세요.'); return; }
        var m = D().improvementOf(id); m.assigned_to = v; if (m.status === 'PENDING') m.status = 'IN_PROGRESS'; D().saveImprovement();
        V().closeModal(); render(); toast('담당자를 지정했습니다.');
    }

    function openManual() {
        V().openModal('개선조치 등록 (수동)',
            '<div class="ri-modal-row"><label class="form-label">관리대상</label>' +
                '<select class="form-select" id="ri-m-target">' + KO().TARGETS.map(function (x) { return '<option value="' + x.id + '">' + esc(x.name) + '</option>'; }).join('') + '</select></div>' +
            '<div class="ri-modal-row"><label class="form-label">제목·내용 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<textarea class="form-textarea" id="ri-m-desc" rows="2"></textarea></div>' +
            '<div class="ri-modal-row"><label class="form-label">기한 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="date" class="form-input" id="ri-m-due" value="2026-09-30"></div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="RSKIMP.saveManual()">등록</button>');
    }
    function saveManual() {
        var desc = (document.getElementById('ri-m-desc').value || '').trim();
        var due = document.getElementById('ri-m-due').value;
        if (!desc) { toast('제목·내용을 입력하세요.'); return; }
        D().addImprovement({ source_type: 'manual', target_id: document.getElementById('ri-m-target').value, description: desc, due_date: due });
        V().closeModal(); render(); toast('개선조치가 등록되었습니다.');
    }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        var q = new URLSearchParams(location.search);
        if (q.get('source')) state.fSource = q.get('source');
        render();
    }

    global.RSKIMP = { init: init, setSource: setSource, setStatus: setStatus, detail: detail, assign: assign, saveAssign: saveAssign, openManual: openManual, saveManual: saveManual };
})(window);
