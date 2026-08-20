/* =====================================================================
   rsk-my.js · 내 할일 (RSK04-L, 신규 · 부서 담당자 관점)
   · 상단 부서 셀렉트 (관점 전환)
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

    var state = { mount: null, deptId: '', openInline: {}, cmplId: null, cmplDesc: '', cmplPhoto: '', cmplSign: '' };
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

    /* 기본 부서는 '목록 첫 번째'가 아니라 **로그인한 사람의 소속 부서**다.
       권한 전환으로 부서 담당자가 되면 자기 부서 일이 바로 보여야 한다(?dept= 가 있으면 그게 우선). */
    function defaultDeptId(depts) {
        var mine = global.DYROLE && global.DYROLE.deptId ? global.DYROLE.deptId() : '';
        if (mine && depts.some(function (d) { return d.id === mine; })) return mine;
        return depts[0] && depts[0].id;
    }
    function render() {
        if (!state.mount) return;
        var depts = candidateDeptsWithWork();
        if (!state.deptId) state.deptId = defaultDeptId(depts);

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
                            (f ? '<button type="button" class="btn btn-outline btn-sm" onclick="DYV2.toast(\'설문조사표 내려받기\', \'서식 파일 등록\')">📥 유해위험요인 설문조사표 다운로드</button>' : '<span style="font-size:12px;color:var(--text-gray);">설문조사표 없음</span>') +
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
        var stChip = returned
            ? '<span class="chip-status danger chip-sm">확인 반려</span>'
            : m.status === 'DONE'
            ? '<span class="chip-mini st-done">완료</span>'
            : (m.status === 'IN_PROGRESS' ? '<span class="chip-mini st-doing">진행중</span>' : '<span class="chip-mini st-todo">예정</span>');
        var due = m.due || m.due_date || '-';
        var dueTxt = overdue ? '<span class="my-overdue">' + esc(due) + ' (기한초과)</span>' : esc(due);
        /* 확인 반려 건은 status 가 DONE 이어도 담당자가 다시 제출해야 한다(DYRSK.needsAction) */
        var cf = D().confirmOf(m);
        var returned = D().confirmState(m) === 'RETURNED';
        var act = D().needsAction(m);
        var returnBanner = returned
            ? '<div class="mw-returned" role="note"><b>재난안전과 반려</b> · ' + esc(cf.at || '') + ' · ' + esc(cf.by || '') +
              ((cf.round || 1) > 1 ? ' <span class="mw-returned-r">' + cf.round + '회차 제출</span>' : '') +
              '<p>' + esc(cf.reason || '') + '</p>' +
              '<span class="mw-returned-how">증빙을 보완해 <b>재제출</b>하면 확인 대기로 돌아갑니다.</span></div>'
            : '';
        var actions = '';
        if (act) {
            if (isRemind) {
                actions += '<button type="button" class="btn btn-outline btn-sm" onclick="RSKMY.toggleRespond(\'' + m.id + '\')">' +
                    (state.openInline[m.id] ? '재촉 응답 닫기' : '재촉 응답 (사유·기한)') + '</button>';
            }
            actions += '<button type="button" class="btn btn-primary btn-sm" onclick="RSKMY.complete(\'' + m.id + '\')">' +
                (returned ? '재제출' : '완료 처리') + '</button>';
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
        return '<div class="my-item' + (isRemind ? ' remind' : '') + '">' + head + returnBanner + inline + '</div>';
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
    /* 완료 요건(조치내용·완료일·개선 후 사진·서명)은 DYRSK.completeImprovement 가 강제한다.
     * 화면은 입력만 받고, 통과 여부는 데이터 계층 판정을 그대로 따른다 — 화면마다 규칙을
     * 다시 쓰면 어느 한 경로가 빠져나가 증빙 없는 완료가 기록된다. */
    function signerDefault() {
        var p = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        return p ? p.name : '';
    }
    function pickPhoto() {
        state.cmplPhoto = '개선후_' + (state.cmplId || 'IMP') + '.jpg';
        var d = document.getElementById('my-cmpl-desc'); if (d) state.cmplDesc = d.value;
        var s = document.getElementById('my-cmpl-sign'); if (s) state.cmplSign = s.value;
        complete(state.cmplId);
        V().toast('목록에 추가했습니다 — 파일 저장은 문서관리 연계 후 적용됩니다');
    }

    function complete(id) {
        var m = D().improvementOf(id); if (!m) return;
        state.cmplId = id;
        V().openModal('개선조치 완료 처리',
            '<div style="font-size:13px;">' +
                '<p><b>' + esc((m.hazard && m.hazard.name) || m.hazard_risk_factor || '') + '</b></p>' +
                '<p style="color:var(--text-gray);margin:6px 0 14px;">' + esc(m.description || m.action || '') + '</p>' +
                '<label style="font-size:12px;font-weight:700;color:var(--text-gray);display:block;margin-bottom:5px;">조치 내용 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<textarea class="form-textarea" id="my-cmpl-desc" rows="3" placeholder="실제 조치한 내용을 입력하세요">' + esc(state.cmplDesc || '') + '</textarea>' +
                '<label style="font-size:var(--fs-12);font-weight:700;color:var(--text-gray);display:block;margin:14px 0 5px;">완료일 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="date" class="form-input" id="my-cmpl-date" value="' + esc(D().today()) + '" style="max-width:180px;">' +
                '<label style="font-size:var(--fs-12);font-weight:700;color:var(--text-gray);display:block;margin:14px 0 5px;">개선 후 사진 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<button type="button" class="btn btn-outline btn-sm" onclick="RSKMY.pickPhoto()">＋ 사진 첨부</button>' +
                (state.cmplPhoto ? ' <span class="chip-status chip-sm success" style="margin-left:8px;">' + esc(state.cmplPhoto) + '</span>' : '') +
                '<p class="file-hint">개선 후 사진은 조치 완료의 증빙입니다. 없으면 완료 처리되지 않습니다.</p>' +
                '<label style="font-size:var(--fs-12);font-weight:700;color:var(--text-gray);display:block;margin:14px 0 5px;">완료 확인 (전자서명) <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="text" class="form-input" id="my-cmpl-sign" value="' + esc(state.cmplSign || signerDefault()) + '" placeholder="확인자 이름" style="max-width:220px;">' +
            '</div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="RSKMY.doComplete(\'' + id + '\')">완료 처리</button>');
    }
    function doComplete(id) {
        var el = function (x) { return document.getElementById(x); };
        var payload = {
            action: (el('my-cmpl-desc') && el('my-cmpl-desc').value || '').trim(),
            completedDate: el('my-cmpl-date') && el('my-cmpl-date').value,
            afterPhoto: state.cmplPhoto,
            by: (el('my-cmpl-sign') && el('my-cmpl-sign').value || '').trim(),
            signedBy: (el('my-cmpl-sign') && el('my-cmpl-sign').value || '').trim()
        };
        var err = D().completionError(payload);
        if (err) { toast(err); return; }
        D().completeImprovement(id, payload);
        state.cmplPhoto = ''; state.cmplDesc = ''; state.cmplSign = ''; state.cmplId = null;
        V().closeModal(); toast('완료 처리 · 전자서명 기록 · 평가 상세에 반영'); render();
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
        complete: complete, doComplete: doComplete, pickPhoto: pickPhoto
    };
})(window);
