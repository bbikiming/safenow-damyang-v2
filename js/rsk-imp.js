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
    /* 유해위험요인의 법령 근거 — DYLAW 칩(CLAUDE.md §10). 근거 없으면 '법령 매핑 대기'. */
    function basisHtml(h) {
        var b = h && h.basis;
        if (!b) return '';   /* 근거는 선택 항목 — 없으면 자리 자체를 만들지 않는다 */
        return window.DYLAW ? DYLAW.basisChip(b) : '<span class="law-basis-plain">' + esc(b) + '</span>';
    }

    function toast(m) { V().toast(m); }

    var state = { mount: null, fSource: '', fStatus: '' };

    /* ===== 조회 범위 · 조작 권한 =====
     * 개선조치 대장은 **주관부서(재난안전과)** 가 발행·배정한다. 배정받은 부서는
     * 자기 몫을 조회할 뿐, 남의 부서 개선조치를 열람하거나 새로 등록하지 않는다.
     * ※ **조치 실시(완료 처리)는 이 축에서 하지 않는다 (2026-08-14)** — 창구는
     *   내 할일과 위험성평가 화면의 조치 상세 카드 둘뿐이고, 이 목록·상세는 조회용이다. 종전에는 이 화면에 권한 판정이 전혀 없어서
     * 물순환사업소 주무관이 재난안전과 건까지 보고 [＋ 개선조치 등록]도 눌렀다.
     * 범위 판정은 DYROLE.scope() 단일 출처(layout.js). */
    function R() { return global.DYROLE; }
    function inScope(m) { return !R() || R().inScope(m.dept_id); }
    function canEdit() {
        if (!R()) return true;                       /* 롤 스위처 없는 환경은 종전대로 */
        var p = R().current();
        return !!p && p.tier === 'staff' && p.deptId === R().OWNER_DEPT;
    }
    /* 조회 전용/범위 안내 — 버튼과 행을 그냥 지우면 '왜 없지'가 된다 */
    function scopeNote() {
        if (!R()) return '';
        var p = R().current(), s = R().scope();
        if (canEdit()) return '';
        var why = p.tier === 'head'
            ? '총괄 책임자는 <b>전 부서</b> 개선조치를 조회합니다.'
            : (s === 'all'
                ? '주관부서 안에서도 발행·배정은 <b>담당자(주무관)</b>가 수행합니다.'
                : '<b>' + esc(p.deptName || '') + '</b> 소관 개선조치만 표시됩니다 — ' +
                  '발행·배정은 주관부서(<b>재난안전과</b>) 담당자가 수행하고, ' +
                  '내 몫의 완료 처리는 <b>내 할일</b> 또는 위험성평가 화면의 <b>조치 상세 카드</b>에서 수행합니다.');
        return '<div class="rl-ro" role="note"><b>조회 전용</b> — ' + why + '</div>';
    }

    function srcBadge(t) { var m = D().SRC_META[t] || D().SRC_META.manual; return '<span class="src-badge ' + m.tone + '">' + esc(m.label) + '</span>'; }
    function stChip(t) { var m = D().STATUS_META[t] || D().STATUS_META.PENDING; return '<span class="chip-mini ' + (t === 'DONE' ? 'st-done' : (t === 'IN_PROGRESS' ? 'st-doing' : 'st-todo')) + '">' + esc(m.label) + '</span>'; }
    function dueClass(due, status) {
        if (status === 'DONE' || !due) return '';
        /* 기준일은 DYV2.today() 단일 출처 (CLAUDE.md §11).
           종전에는 '2026-07-13' 이 따로 박혀 있어 이 표의 기한 색상만 사흘 어긋났다. */
        var diff = V().daysTo(due);
        if (diff == null) return '';
        if (diff < 0) return 'over';
        if (diff <= 14) return 'soon';
        return '';
    }

    function render() {
        var list = D().improvements().filter(function (m) {
            return inScope(m) &&
                (!state.fSource || m.source_type === state.fSource) && (!state.fStatus || m.status === state.fStatus);
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
            (canEdit()
                ? '<button type="button" class="btn btn-primary" onclick="RSKIMP.openManual()">＋ 개선조치 등록</button>'
                : '') + '</div>';

        var rows = list.length ? list.map(function (m) {
            var t = KO().targetOf(m.target_id);
            var scope = m.dept_id ? D().deptName(m.dept_id) : (t ? t.name : '-');
            var hazardName = (m.hazard && m.hazard.name) || m.hazard_risk_factor || '';
            /* 시설물 — 위험성평가 검수에서 지정한 대상. 세 상태 중 **미지정만** 줄을 만들지
               않는다(아직 아무도 판단하지 않은 상태라 말할 것이 없다). '해당 없음'은
               확인이 끝난 결과이므로 그대로 보여 준다 — 안 보여 주면 담당자가 앞 단계로
               되돌아가 같은 확인을 다시 한다. 판정은 D().facilLabel() 한 곳이다. */
            var facil = D().facilLabel ? D().facilLabel(m) : '';
            var titleCell = esc(m.description) +
                (hazardName ? '<div class="ri-hrf">' + esc(hazardName) +
                    (m.hazard && m.hazard.category ? ' <span class="chip-mini wt" style="margin-left:4px;">' + esc(m.hazard.category) + '</span>' : '') +
                    ' ' + basisHtml(m.hazard) +
                '</div>' : '') +
                (facil ? '<div class="ri-hrf"><span class="chip-mini wt-elec">시설물</span> ' + esc(facil) + '</div>' : '');
            var owner = m.assigned_to ? esc(m.assigned_to)
                : (canEdit()
                    ? '<a href="#" onclick="RSKIMP.assign(\'' + m.id + '\');return false;" style="color:var(--main-dark);">지정</a>'
                    : '<span style="color:var(--text-gray);">미지정</span>');
            var due = m.due || m.due_date || '';
            return '<tr onclick="RSKIMP.detail(\'' + m.id + '\')">' +
                '<td>' + srcBadge(m.source_type) + '</td>' +
                '<td>' + esc(scope) + '</td>' +
                '<td>' + titleCell + '</td>' +
                '<td onclick="event.stopPropagation()">' + owner + '</td>' +
                '<td class="ri-due ' + dueClass(due, m.status) + '">' + (due ? esc(due) : '<span style="color:var(--status-info-fg);">미지정</span>') + '</td>' +
                '<td>' + stChip(m.status) + '</td></tr>';
        }).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--text-gray);padding:24px;">조건에 맞는 개선조치가 없습니다.</td></tr>';

        state.mount.innerHTML = head + scopeNote() +
            '<table class="ri-table"><thead><tr>' +
                '<th>출처</th><th>부서 / 관리대상</th><th>제목 / 유해위험요인</th><th>담당자</th><th>기한</th><th>상태</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table>';
    }

    function setSource(v) { state.fSource = v; render(); }
    function setStatus(v) { state.fStatus = v; render(); }
    /* 상세는 조회이므로 막지 않는다 — 다만 범위 밖 건은 URL 로도 들어가지 못하게 한다 */
    function detail(id) {
        var m = D().improvementOf(id);
        if (m && !inScope(m)) { toast('소속 부서 소관이 아닙니다.'); return; }
        location.href = 'rsk-imp-detail.html?id=' + id;
    }

    function assign(id) {
        if (!canEdit()) { toast('배정은 주관부서(재난안전과) 담당자가 수행합니다.'); return; }
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
        if (!canEdit()) { toast('배정은 주관부서(재난안전과) 담당자가 수행합니다.'); return; }
        var v = document.getElementById('ri-assignee').value;
        if (!v) { toast('담당자를 선택하세요.'); return; }
        var m = D().improvementOf(id); m.assigned_to = v; if (m.status === 'PENDING') m.status = 'IN_PROGRESS'; D().saveImprovement();
        V().closeModal(); render(); toast('담당자를 지정했습니다.');
    }

    function openManual() {
        if (!canEdit()) { toast('개선조치 발행은 주관부서(재난안전과) 담당자가 수행합니다.'); return; }
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
        if (!canEdit()) { toast('개선조치 발행은 주관부서(재난안전과) 담당자가 수행합니다.'); return; }
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
