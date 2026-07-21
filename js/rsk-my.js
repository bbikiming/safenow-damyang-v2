/* =====================================================================
   rsk-my.js · 내 할일 (RSK04-L, 신규 · 부서 담당자 관점)
   · 상단 부서 셀렉트 (프로토타입 관점 전환)
   · 점검 예정 카드 · 조치할 사항 카드(N/M · 완료 처리)
   · 재촉받은 건 강조 → 인라인 폼(사유 + 처리기한 수정) → history 기록
   · 수시평가 등록 진입 버튼 (부서 프리필 → rsk-occ)
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYRSK; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }

    var state = { mount: null, deptId: '', openInline: {} };
    /* openInline: { [impId]: { reason:'', due:'' } } — 어떤 개선조치의 재촉 응답 폼이 펼쳐져 있는지 */

    function candidateDeptsWithWork() {
        /* 시연을 위해 improvements 또는 assessments.depts 에 등장한 부서 우선 정렬 */
        var seen = {};
        D().assessments().forEach(function (a) {
            (a.depts || []).forEach(function (dp) { seen[dp.deptId] = (seen[dp.deptId] || 0) + 1; });
        });
        D().improvements().forEach(function (m) { if (m.dept_id) seen[m.dept_id] = (seen[m.dept_id] || 0) + 5; });
        var all = D().deptCandidates();
        all.sort(function (a, b) { return (seen[b.id] || 0) - (seen[a.id] || 0); });
        return all;
    }

    function render() {
        if (!state.mount) return;
        var depts = candidateDeptsWithWork();
        if (!state.deptId) state.deptId = depts[0] && depts[0].id;

        var opts = depts.map(function (d) {
            return '<option value="' + d.id + '"' + (d.id === state.deptId ? ' selected' : '') + '>' + esc(d.name) + '</option>';
        }).join('');
        var head =
            '<div class="my-toolbar">' +
                '<div class="my-tb-left">' +
                    '<label class="my-tb-label">부서 (관점 전환)</label>' +
                    '<select class="form-select" onchange="RSKMY.setDept(this.value)">' + opts + '</select>' +
                '</div>' +
                '<div>' +
                    '<a class="btn btn-outline btn-sm" href="rsk-occ.html?new=1&dept=' + esc(state.deptId) + '">＋ 수시평가 등록</a>' +
                '</div>' +
            '</div>';

        state.mount.innerHTML = head + renderInspectCard() + renderImpCard();
    }

    /* 점검 예정 카드 — 이 부서가 배정된 진행중 정기평가에서 점검일이 미래이거나 최근 */
    function renderInspectCard() {
        var items = [];
        D().assessments().forEach(function (a) {
            if (a.status === 'COMPLETED') return;
            (a.depts || []).forEach(function (dp) {
                if (dp.deptId !== state.deptId) return;
                items.push({ a: a, dp: dp });
            });
        });
        var body;
        if (!items.length) {
            body = '<div class="my-empty">예정된 정기평가 점검이 없습니다.</div>';
        } else {
            body = items.map(function (x) {
                var f = x.dp.surveyFile || (x.a.files && x.a.files.surveyAll) || '';
                return '<div class="my-item">' +
                    '<div class="my-item-head">' +
                        '<div><div class="my-item-title">' + esc(x.a.title) + '</div>' +
                            '<div class="my-item-sub">점검일 <b style="color:var(--text-black);">' + esc(x.dp.inspectDate || '-') + '</b>' +
                                (x.dp.deliveredAt ? ' · 전달 완료 (' + esc(x.dp.deliveredAt) + ')' : ' · 전달 대기') +
                            '</div>' +
                        '</div>' +
                        '<div class="my-item-actions">' +
                            (f ? '<button type="button" class="btn btn-outline btn-sm" onclick="DYV2.toast(\'설문지 다운로드: ' + esc(f) + ' (프로토타입)\')">📥 점검설문지 다운로드</button>' : '<span style="font-size:12px;color:var(--text-lightgray);">설문지 없음</span>') +
                        '</div>' +
                    '</div>' +
                '</div>';
            }).join('');
        }
        return '<div class="my-card"><div class="my-card-title">점검 예정 <span class="my-count">' + items.length + '</span></div>' + body + '</div>';
    }

    /* 조치할 사항 카드 */
    function renderImpCard() {
        var ms = D().improvements().filter(function (m) { return m.dept_id === state.deptId; });
        var openCount = ms.filter(function (m) { return m.status !== 'DONE'; }).length;
        var doneCount = ms.filter(function (m) { return m.status === 'DONE'; }).length;
        var remindCount = ms.filter(function (m) {
            return (m.history || []).some(function (h) { return h.type === 'REMIND'; }) && m.status !== 'DONE';
        }).length;

        var body;
        if (!ms.length) {
            body = '<div class="my-empty">전달받은 개선조치가 없습니다.</div>';
        } else {
            /* 재촉받은 것 위로 */
            ms.sort(function (a, b) {
                var ar = (a.history || []).some(function (h) { return h.type === 'REMIND'; }) && a.status !== 'DONE' ? 1 : 0;
                var br = (b.history || []).some(function (h) { return h.type === 'REMIND'; }) && b.status !== 'DONE' ? 1 : 0;
                if (ar !== br) return br - ar;
                var aDone = a.status === 'DONE' ? 1 : 0, bDone = b.status === 'DONE' ? 1 : 0;
                if (aDone !== bDone) return aDone - bDone;
                return (a.due || a.due_date || '').localeCompare(b.due || b.due_date || '');
            });
            body = ms.map(itemHtml).join('');
        }
        var summary = '<span class="my-count">' + doneCount + ' / ' + ms.length + '</span>' +
            (remindCount ? ' <span class="my-count warn">재촉 ' + remindCount + '건</span>' : '');
        return '<div class="my-card"><div class="my-card-title">조치할 사항 ' + summary + '</div>' + body + '</div>';
    }

    function itemHtml(m) {
        var isRemind = (m.history || []).some(function (h) { return h.type === 'REMIND'; }) && m.status !== 'DONE';
        var overdue = D().isOverdue(m);
        var stChip = m.status === 'DONE'
            ? '<span class="chip-mini st-done">완료</span>'
            : (m.status === 'IN_PROGRESS' ? '<span class="chip-mini st-doing">진행중</span>' : '<span class="chip-mini st-todo">예정</span>');
        var due = m.due || m.due_date || '-';
        var dueTxt = overdue ? '<span class="my-overdue">' + esc(due) + ' (기한초과)</span>' : esc(due);
        var actions = '';
        if (m.status !== 'DONE') {
            if (isRemind) {
                actions += '<button type="button" class="btn btn-outline btn-sm" onclick="RSKMY.toggleRespond(\'' + m.id + '\')">' +
                    (state.openInline[m.id] ? '재촉 응답 닫기' : '재촉 응답 (사유·기한)') + '</button>';
            }
            actions += '<button type="button" class="btn btn-primary btn-sm" onclick="RSKMY.complete(\'' + m.id + '\')">완료 처리</button>';
        }
        var head =
            '<div class="my-item-head">' +
                '<div>' +
                    (isRemind ? '<span class="my-remind-tag">🔔 재촉</span> ' : '') +
                    '<span class="my-item-title">' + esc((m.hazard && m.hazard.name) || m.hazard_risk_factor || '개선조치') + '</span>' +
                    '<div class="my-item-sub">' + esc(m.description || m.action || '') + '</div>' +
                    '<div class="my-item-sub">기한 ' + dueTxt +
                        (m.assessment_id ? ' · 평가 <a href="rsk-detail.html?id=' + esc(m.assessment_id) + '" style="color:var(--main-dark);">' + esc(m.assessment_id) + '</a>' : '') +
                        ' · ' + stChip + '</div>' +
                '</div>' +
                '<div class="my-item-actions">' + actions + '</div>' +
            '</div>';
        var inline = '';
        if (state.openInline[m.id]) {
            var val = state.openInline[m.id];
            inline = '<div class="my-inline">' +
                '<div class="my-inline-row"><label>재촉 응답 사유 <span style="color:var(--status-danger-fg)">*</span></label>' +
                    '<textarea rows="2" onchange="RSKMY.setRespReason(\'' + m.id + '\', this.value)" placeholder="지연 사유·현장 상황 등">' + esc(val.reason) + '</textarea></div>' +
                '<div class="my-inline-row"><label>수정 처리기한 <span style="color:var(--status-danger-fg)">*</span></label>' +
                    '<input type="date" value="' + esc(val.due) + '" onchange="RSKMY.setRespDue(\'' + m.id + '\', this.value)"></div>' +
                '<div class="my-inline-foot">' +
                    '<button type="button" class="btn btn-secondary btn-sm" onclick="RSKMY.toggleRespond(\'' + m.id + '\')">취소</button>' +
                    '<button type="button" class="btn btn-primary btn-sm" onclick="RSKMY.submitRespond(\'' + m.id + '\')">응답 제출</button>' +
                '</div>' +
            '</div>';
        }
        return '<div class="my-item' + (isRemind ? ' remind' : '') + '">' + head + inline + '</div>';
    }

    function setDept(id) { state.deptId = id; state.openInline = {}; render(); }
    function toggleRespond(id) {
        if (state.openInline[id]) delete state.openInline[id];
        else {
            var m = D().improvementOf(id);
            state.openInline[id] = { reason: '', due: m ? (m.due || m.due_date || '') : '' };
        }
        render();
    }
    function setRespReason(id, v) { if (state.openInline[id]) state.openInline[id].reason = v; }
    function setRespDue(id, v) { if (state.openInline[id]) state.openInline[id].due = v; }
    function submitRespond(id) {
        var v = state.openInline[id]; if (!v) return;
        if (!v.reason.trim()) { toast('사유를 입력하세요.'); return; }
        if (!v.due) { toast('수정 처리기한을 선택하세요.'); return; }
        var m = D().improvementOf(id); if (!m) return;
        var who = D().deptName(state.deptId) + ' 담당자';
        var oldDue = m.due || m.due_date;
        D().pushImpHistory(id, { type: 'REASON', by: who, memo: '지연 사유: ' + v.reason.trim() });
        if (v.due !== oldDue) {
            m.due = v.due; m.due_date = v.due; D().saveImprovement();
            D().pushImpHistory(id, { type: 'DUE_CHANGE', by: who, memo: '기한 변경 ' + oldDue + ' → ' + v.due });
            /* 평가 이력에도 반영 */
            D().pushHistory(m.assessment_id, { type: 'DUE_CHANGE', by: who, memo: (m.hazard && m.hazard.name || '') + ' 기한 ' + oldDue + ' → ' + v.due });
        }
        D().pushHistory(m.assessment_id, { type: 'REASON', by: who, memo: (m.hazard && m.hazard.name || '') + ' 사유: ' + v.reason.trim() });
        delete state.openInline[id];
        toast('재촉 응답 제출 완료'); render();
    }
    function complete(id) {
        var m = D().improvementOf(id); if (!m) return;
        V().openModal('개선조치 완료 처리',
            '<div style="font-size:13px;">' +
                '<p><b>' + esc((m.hazard && m.hazard.name) || m.hazard_risk_factor || '') + '</b></p>' +
                '<p style="color:var(--text-gray);margin:6px 0 14px;">' + esc(m.description || m.action || '') + '</p>' +
                '<label style="font-size:12px;font-weight:700;color:var(--text-gray);display:block;margin-bottom:5px;">조치 내용 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<textarea class="form-textarea" id="my-cmpl-desc" rows="3" placeholder="실제 조치한 내용을 입력하세요"></textarea>' +
            '</div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="RSKMY.doComplete(\'' + id + '\')">완료 처리</button>');
    }
    function doComplete(id) {
        var t = document.getElementById('my-cmpl-desc');
        var v = (t && t.value || '').trim();
        if (!v) { toast('조치 내용을 입력하세요.'); return; }
        var m = D().completeImprovement(id, v, D().deptName(state.deptId) + ' 담당자');
        V().closeModal(); toast('완료 처리 · 평가 상세에 반영'); render();
    }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        var q = new URLSearchParams(location.search);
        var pre = q.get('dept'); if (pre) state.deptId = pre;
        render();
    }

    global.RSKMY = {
        init: init, setDept: setDept,
        toggleRespond: toggleRespond, setRespReason: setRespReason, setRespDue: setRespDue, submitRespond: submitRespond,
        complete: complete, doComplete: doComplete
    };
})(window);
