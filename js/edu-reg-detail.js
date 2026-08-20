/* =====================================================================
   edu-reg-detail.js · 정기교육 상세 (EDU-REG-DETAIL, v1.1 §8.5)
   ---------------------------------------------------------------------
   집합교육 상세를 모달 대신 별도 화면으로. ?id=course_id 로 진입.
   · 교육 정보(일정·시간·강사·장소·내용·첨부)
   · 신청현황 테이블: 부서 · 신청자 명단 · 인원 · 서명파일 · 신청일 (전체 노출)
   · [참석자 등록부 등록] · [교육 종료 처리] · 이력
   표준: 배지 chip-status+DYV2.toneOf · 표 .table-figma · 부서 선택 ORGPICK ·
        안내 훅 EDUTOUR.onEvent('applied'|'closed')
   ===================================================================== */
(function (global) {
    'use strict';
    var V = function () { return global.DYV2; };
    var E = function () { return global.DYEDU; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }
    function tourEvt(e) { if (global.EDUTOUR) global.EDUTOUR.onEvent(e); }

    var state = { mount: null, courseId: null };
    var G = null; /* 참석자 등록부 등록 폼 */

    function render() {
        if (!state.mount) return;
        var c = E().courseOf(state.courseId);
        if (!c) {
            state.mount.innerHTML = '<div class="edu-card"><div class="v2-empty">교육을 찾을 수 없습니다.</div></div>';
            return;
        }
        var stChip = c.status === 'DONE'
            ? '<span class="chip-status chip-sm ' + V().toneOf('완료') + '">완료</span>'
            : '<span class="chip-status chip-sm ' + V().toneOf('진행중') + '">진행중 · 신청 접수</span>';
        var enrolls = E().enrolls(c.id);
        var allEnrolls = E().allEnrolls ? E().allEnrolls(c.id) : enrolls;
        var enrolledCnt = enrolls.reduce(function (n, e) { return n + (e.workerIds || []).length; }, 0);
        /* '개 부서'는 행 수가 아니라 **서로 다른 부서 수**다. 데이터 계층이 부서 중복
           등록을 막은 뒤로는 둘이 같지만, 그 전에 저장된 데이터가 브라우저에 남아
           있을 수 있어 세는 축을 표기와 맞춰 둔다. */
        var deptCnt = Object.keys(enrolls.reduce(function (m, e) { m[e.deptId] = 1; return m; }, {})).length;

        var actions = '';
        if (c.status === 'OPEN') {
            actions =
                '<button type="button" class="btn btn-outline" onclick="EDURD.openApply()">＋ 참석자 등록부 등록</button>' +
                '<button type="button" class="btn btn-primary" data-tour="close" onclick="EDURD.closeCourse()">교육 종료 처리</button>';
        } else if (!lockOf(c.id)) {
            actions = '<button type="button" class="btn btn-outline" onclick="EDURD.openApply()">＋ 정정 등록부 추가</button>';
        }

        var sessions = E().courseSessions(c);
        /* 온나라 결재 상태 칩/상신 버튼 (교육별 = Type 2) */
        /* 공문 기안 — 종료 처리된 교육에만 나타난다(SCR-EDU-004 §4-5).
           상신은 이 자리가 아니라 문서 미리보기에만 있다. */
        var docCtl = global.EDUDOC ? '<span class="edu-doc-slot">' + global.EDUDOC.control(c.id) + '</span>' : '';
        var summary =
            '<div class="edu-detail-head">' +
                '<div class="edu-detail-title">' + esc(c.desc) + ' ' + stChip + ' ' + docCtl + '</div>' +
                '<div class="edu-detail-meta">' +
                    '<span>구분 <b>' + esc(E().kindLabel(c.kind)) + '</b></span>' +
                    '<span>일정 <b>' + esc(E().courseDateTime(c)) + '</b></span>' +
                    '<span>시간 <b>' + c.hours + 'h</b>' + (sessions.length > 1 ? ' (' + sessions.length + '일 합계)' : '') + '</span>' +
                    '<span>강사 <b>' + esc(c.instructor || '-') + '</b></span>' +
                    '<span>장소 <b>' + esc(c.place || '-') + '</b></span>' +
                    '<span>신청 <b>' + deptCnt + '개 부서 · ' + enrolledCnt + '명</b></span>' +
                '</div>' +
                /* 다회차 교육은 회차별 일자·시간을 펼쳐 보여준다 (합계만 보이면 일정 확인이 불가) */
                (sessions.length > 1
                    ? '<div class="edu-detail-files" style="color:var(--text-gray);">🗓 ' +
                        sessions.map(function (s, i) {
                            return (i + 1) + '회차 ' + esc(s.date) + ' ' + esc(s.start || '') +
                                (s.end ? '~' + esc(s.end) : '') + ' (' + E().sessionHours(s) + 'h)';
                        }).join(' · ') + '</div>'
                    : '') +
                (c.files && c.files.length ? '<div class="edu-detail-files">📎 ' + c.files.map(function (f) { return esc(f.name); }).join(' · ') + '</div>' : '') +
                (c.photos && c.photos.length ? '<div class="edu-detail-files">📷 교육 사진 ' + c.photos.length + '장 · ' + c.photos.map(function (p) { return esc(p.name); }).join(' · ') + '</div>' : '') +
                (actions ? '<div class="edu-detail-actions">' + actions + '</div>' : '') +
            '</div>';

        /* 신청현황 테이블 — 상신 뒤에는 취소 수단 자체를 내지 않는다.
         * 누르면 거절하는 버튼을 남겨 두면 담당자가 왜 안 되는지 모른 채 두 번 누른다. */
        var enrollLock = lockOf(state.courseId);
        var rows = allEnrolls.length ? allEnrolls.map(function (e) {
            var names = (e.workerIds || []).map(function (wid) { var w = E().workerOf(wid); return w ? w.name : wid; }).join(', ');
            var cancelled = e.status === 'CANCELLED';
            return '<tr>' +
                '<td class="edu-name">' + esc(E().deptName(e.deptId)) + (cancelled ? ' <span class="chip-status chip-sm danger">등록취소</span>' : '') + '</td>' +
                '<td>' + esc(names) + '</td>' +
                '<td>' + (e.workerIds || []).length + '명</td>' +
                '<td>' + (e.actualHours == null ? c.hours : e.actualHours) + 'h</td>' +
                '<td>' + (e.signFile ? '<span style="color:var(--main-dark);font-size:var(--fs-12);">📎 ' + esc(e.signFile) + '</span>' : '<span style="color:var(--text-gray);">-</span>') + '</td>' +
                '<td>' + esc(e.at) + '</td>' +
                '<td class="col-action">' + (cancelled
                    ? '<span style="font-size:var(--fs-12);color:var(--text-gray);">' + esc(e.cancelReason || '취소 사유 미기재') + '<br>' + esc(e.cancelledAt || '') + '</span>'
                    : enrollLock
                    ? '<button type="button" class="btn btn-outline btn-sm" disabled title="결재 ' + esc(enrollLock) +
                      ' — 공문에 이수자 명단이 실려 나가 취소할 수 없습니다">🔒 ' + esc(enrollLock) + '</button>'
                    : '<button type="button" class="btn btn-outline btn-sm" style="border-color:var(--status-danger-border);color:var(--status-danger-fg);" onclick="EDURD.confirmCancel(\'' + esc(e.deptId) + '\')">' + (c.status === 'DONE' ? '완료기록 정정' : '신청 취소') + '</button>') + '</td>' +
            '</tr>';
        }).join('') : '<tr><td colspan="7"><div class="v2-empty">아직 신청이 없습니다.</div></td></tr>';
        var enrollTable =
            '<div class="edu-card"><div class="edu-card-title">신청현황 (' + deptCnt + '개 부서 · ' + enrolledCnt + '명)</div>' +
                (enrollLock ? '<div class="check-notice">결재 <b>' + esc(enrollLock) + '</b> — 이 교육의 이수자 명단이 공문 붙임으로 올라가 있어 신청을 취소할 수 없습니다. 정정하려면 반려 후 다시 시도하세요.</div>' : '') +
                '<div class="edu-scroll"><table class="table-figma table-compact"><thead><tr>' +
                    '<th style="width:18%;">부서</th><th>신청자 명단</th><th style="width:9%;">인원</th><th style="width:10%;">실제 참석</th><th style="width:20%;">서명파일</th><th style="width:12%;">신청일</th><th></th>' +
                '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
            '</div>';

        /* 이력 */
        var hist = (c.history || []).length ? (c.history || []).map(function (h) {
            return '<div class="edu-hist-row">' +
                '<span class="edu-hist-at">' + esc(h.at || '') + '</span>' +
                '<span class="edu-hist-type">' + esc(h.type || '') + '</span>' +
                '<span class="edu-hist-body">' + esc(h.memo || '') +
                    (h.by ? '<span class="edu-hist-by">— ' + esc(h.by) + '</span>' : '') +
                '</span>' +
            '</div>';
        }).join('') : '<div style="color:var(--text-gray);font-size:var(--fs-12);padding:12px;">이력이 없습니다.</div>';
        var histCard = '<div class="edu-card"><div class="edu-card-title">이력</div><div class="edu-hist">' + hist + '</div></div>';

        state.mount.innerHTML = summary + enrollTable + histCard;
    }

    /* =============== 참석자 등록부 등록 =============== */
    function openApply() {
        var depts = E().deptCandidates();
        var c = E().courseOf(state.courseId);
        G = { deptId: depts[0].id, workerIds: {}, signFile: '', actualHours: c ? c.hours : 0 };
        renderApply();
    }
    function targetWorkers(deptId) {
        var c = E().courseOf(state.courseId);
        var isSup = c && (c.kind === 'SUP_REG' || c.kind === 'SUP_ETC');
        var arr = isSup ? E().supervisorWorkers() : E().fieldWorkers();
        return deptId ? arr.filter(function (w) { return w.deptId === deptId; }) : arr;
    }
    function renderApply() {
        var c = E().courseOf(state.courseId);
        var ws = targetWorkers(G.deptId);
        var selCnt = Object.keys(G.workerIds).filter(function (k) { return G.workerIds[k]; }).length;
        var rows = ws.length ? ws.map(function (w) {
            var ck = G.workerIds[w.id] ? ' checked' : '';
            return '<label class="edu-tg-member"><input type="checkbox"' + ck +
                ' onchange="EDURD.applyToggle(\'' + w.id + '\', this.checked)">' +
                '<span>' + esc(w.name) + '</span>' +
                '<span style="color:var(--text-gray);font-size:var(--fs-12);">' + esc(E().catLabel(w.category)) + '</span>' +
            '</label>';
        }).join('') : '<div style="color:var(--text-gray);font-size:var(--fs-12);padding:8px;">이 부서에 대상자가 없습니다.</div>';
        var body =
            '<div style="font-size:var(--fs-12);color:var(--text-gray);margin-bottom:10px;">' +
                '<b>' + esc(c.desc) + '</b> · 일정 ' + esc(E().courseDateTime(c)) + ' · ' + c.hours + 'h' +
            '</div>' +
            '<div class="edu-modal-row"><label class="form-label">부서 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<div class="orgpick-field" id="erd-applydept"><div style="display:flex;gap:8px;align-items:center;">' +
                    '<input type="text" class="form-input" value="' + esc(E().deptName(G.deptId)) + '" readonly aria-label="부서" style="flex:1;background:var(--gray-50);">' +
                    '<button type="button" class="btn btn-sm btn-outline" onclick="ORGPICK.toggle(\'erd-applydept\',\'deptId\',\'EDURD.applyPickDept\')">조직도</button>' +
                '</div></div></div>' +
            '<div class="edu-modal-row"><label class="form-label">근로자 선택 <span style="color:var(--status-danger-fg)">*</span> ' +
                '<span style="color:var(--text-gray);font-weight:var(--fw-regular);">(' + selCnt + ' / ' + ws.length + '명)</span></label>' +
                '<div class="edu-tg-body" style="max-height:240px;">' + rows + '</div>' +
            '</div>' +
            '<div class="edu-modal-row"><label class="form-label" for="erd-actual-hours">실제 참석시간 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="number" class="form-input" id="erd-actual-hours" min="0.1" max="' + c.hours + '" step="0.1" value="' + esc(G.actualHours) + '">' +
                '<p style="font-size:var(--fs-12);color:var(--text-gray);margin:4px 0 0;">선택 대상자에게 공통 적용됩니다. 교육 예정시간 ' + c.hours + 'h를 넘길 수 없습니다.</p></div>' +
            '<div class="edu-modal-row"><label class="form-label">서명파일 업로드 <span style="color:var(--status-danger-fg)">*</span></label>' +
                (G.signFile
                    ? '<span style="color:var(--main-dark);font-weight:var(--fw-bold);font-size:var(--fs-12);">' + esc(G.signFile) + '</span> ' +
                      '<button type="button" class="btn btn-sm btn-outline" onclick="EDURD.applyClearSign()">×</button>'
                    : '<button type="button" class="btn btn-sm btn-outline" onclick="EDURD.applyAttachSign()">＋ 서명파일 첨부</button>') +
                V().fileHint() +
            '</div>';
        V().openModal('참석자 등록부 등록 · ' + esc(E().deptName(G.deptId)), body,
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDURD.doApply()">신청 완료</button>');
    }
    function captureApply() {
        var el = document.getElementById('erd-actual-hours');
        if (el && el.value !== '') G.actualHours = +el.value;
    }
    function applyPickDept(id, name) { captureApply(); G.deptId = id; G.workerIds = {}; renderApply(); }
    function applyToggle(id, on) { captureApply(); if (on) G.workerIds[id] = true; else delete G.workerIds[id]; renderApply(); }
    function applyAttachSign() { captureApply(); G.signFile = E().deptName(G.deptId) + '_서명_' + state.courseId + '.pdf'; renderApply(); }
    function applyClearSign() { captureApply(); G.signFile = ''; renderApply(); }
    function doApply() {
        var ids = Object.keys(G.workerIds).filter(function (k) { return G.workerIds[k]; });
        if (!ids.length) { toast('근로자를 1명 이상 선택하세요.'); return; }
        if (!G.signFile) { toast('서명파일을 업로드하세요 (필수).'); return; }
        var c = E().courseOf(state.courseId);
        var actualHours = +(document.getElementById('erd-actual-hours') || {}).value;
        if (!(actualHours > 0) || actualHours > c.hours) { toast('실제 참석시간을 0보다 크고 교육 예정시간 이하로 입력하세요.'); return; }
        /* 같은 부서가 두 번 쌓이면 이수기록이 이중으로 붙어 이수 판정과 공문 수치가
           함께 틀어진다. 인원·서명파일 정정은 신청 취소 후 재등록 경로다. */
        if (E().hasEnroll(state.courseId, G.deptId)) {
            toast(E().deptName(G.deptId) + '은(는) 이미 등록된 부서입니다 — 신청 취소 후 다시 등록하세요.');
            return;
        }
        E().addEnroll({ courseId: state.courseId, deptId: G.deptId, workerIds: ids, signFile: G.signFile, actualHours: actualHours, at: E().today() });
        if (c.status === 'DONE') E().recordCourseCompletion(state.courseId, ids, actualHours, c.date);
        E().pushCourseHistory(state.courseId, { type: 'STATUS', by: E().deptName(G.deptId), memo: '참석자 등록부 등록 · ' + ids.length + '명 · 실제 참석 ' + actualHours + 'h · 서명파일 첨부' });
        V().closeModal();
        toast(E().deptName(G.deptId) + ' · ' + ids.length + '명 신청 완료');
        render();
        tourEvt('applied');
    }

    /* =============== 참석자 등록부 등록 취소 =============== */
    /* 잘못 신청한 부서를 되돌린다. 이미 종료 처리된 교육이면 그 부서 몫의
     * 이수기록까지 회수되므로 확인 문구에 명시한다.
     *
     * **결재가 올라간 뒤에는 잠근다.** 공문의 이수자 명단(붙임 별지)은 저장된 사본이
     * 아니라 **열 때마다 현재 이수기록에서 다시 파생**된다(js/doc-flow.js). 그래서
     * 상신 뒤에 신청을 취소하면 이미 결재선을 타고 올라간 문서의 명단이 사후에 줄어든다.
     * 판정은 EDUDOC.lockOf 한 곳에서만 한다(CLAUDE.md §4 — 화면이 재구현하지 말 것). */
    function lockOf(courseId) {
        return global.EDUDOC && global.EDUDOC.lockOf ? global.EDUDOC.lockOf(courseId) : null;
    }
    function confirmCancel(deptId) {
        var c = E().courseOf(state.courseId); if (!c) return;
        /* 버튼을 감추는 것만으로는 부족하다 — 전역 호출(EDURD.confirmCancel)로 뚫린다 */
        var lock = lockOf(state.courseId);
        if (lock) { toast('결재 ' + lock + ' 상태라 신청을 취소할 수 없습니다 — 반려 후 다시 시도하세요.'); return; }
        var mine = E().enrolls(state.courseId).filter(function (e) { return e.deptId === deptId; });
        var cnt = mine.reduce(function (n, e) { return n + (e.workerIds || []).length; }, 0);
        V().openModal(c.status === 'DONE' ? '완료 교육기록 정정' : '참석자 등록부 등록 취소',
            '<p style="font-size:var(--fs-13);"><b>' + esc(E().deptName(deptId)) + '</b> · 신청 ' + cnt + '명</p>' +
            (c.status === 'DONE'
                ? '<div class="check-notice" style="margin-top:10px;"><b>원 등록부는 삭제되지 않고 등록취소 이력으로 보존</b>됩니다. 연결 이수시간만 집계에서 제외한 뒤 정정 등록부를 다시 등록하세요.</div>' +
                  '<div class="edu-modal-row"><label class="form-label" for="erd-cancel-reason">정정 사유 <span style="color:var(--status-danger-fg)">*</span></label><textarea class="form-textarea" id="erd-cancel-reason" rows="2"></textarea></div>'
                : '<p style="font-size:var(--fs-12);color:var(--text-gray);margin-top:8px;">신청 내역과 서명파일이 삭제됩니다.</p>'),
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDURD.doCancel(\'' + esc(deptId) + '\')">' + (c.status === 'DONE' ? '취소이력 남기기' : '신청 취소') + '</button>');
    }
    function doCancel(deptId) {
        var lock = lockOf(state.courseId);
        if (lock) { V().closeModal(); toast('결재 ' + lock + ' 상태라 신청을 취소할 수 없습니다 — 반려 후 다시 시도하세요.'); return; }
        var c = E().courseOf(state.courseId);
        var reason = c && c.status === 'DONE' ? ((document.getElementById('erd-cancel-reason') || {}).value || '').trim() : '';
        if (c && c.status === 'DONE' && !reason) { toast('정정 사유를 입력하세요.'); return; }
        var r = c && c.status === 'DONE'
            ? E().cancelCompletedEnroll(state.courseId, deptId, reason, '재난안전과')
            : E().removeEnroll(state.courseId, deptId);
        if (r) {
            E().pushCourseHistory(state.courseId, {
                type: 'STATUS', by: E().deptName(deptId),
                memo: (c && c.status === 'DONE' ? '완료 교육기록 정정(등록취소) · 사유 ' + reason : '참석자 등록부 등록 취소') + ' · ' + r.workers + '명' + (r.records ? ' · 이수기록 ' + r.records + '건 집계 제외' : '')
            });
        }
        V().closeModal();
        toast(r ? (c && c.status === 'DONE' ? E().deptName(deptId) + ' 원 기록을 보존하고 취소이력을 남겼습니다.' : E().deptName(deptId) + ' 신청을 취소했습니다.') : '신청 내역이 없습니다.');
        render();
    }

    /* =============== 교육 종료 처리 =============== */
    function closeCourse() {
        var c = E().courseOf(state.courseId); if (!c) return;
        var enrolls = E().enrolls(state.courseId);
        var totalCnt = enrolls.reduce(function (n, e) { return n + (e.workerIds || []).length; }, 0);
        V().openModal('교육 종료 처리',
            '<p style="font-size:var(--fs-13);"><b>' + esc(c.desc) + '</b><br>신청 <b>' + enrolls.length + '개 부서 · ' + totalCnt + '명</b>에게 등록부별 실제 참석시간을 카운트합니다.</p>' +
            '<p style="font-size:var(--fs-12);color:var(--text-gray);margin-top:6px;">종료 후 원 기록은 고치거나 지우지 않습니다. 정정은 취소이력 후 재등록합니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDURD.doClose()">종료 처리</button>');
    }
    function doClose() {
        var c = E().courseOf(state.courseId); if (!c) return;
        var enrolls = E().enrolls(state.courseId);
        var total = 0;
        enrolls.forEach(function (e) {
            E().recordCourseCompletion(state.courseId, e.workerIds, e.actualHours == null ? c.hours : e.actualHours, c.date);
            total += (e.workerIds || []).length;
        });
        E().updateCourse(state.courseId, { status: 'DONE' });
        E().pushCourseHistory(state.courseId, { type: 'STATUS', by: '재난안전과', memo: '교육 종료 처리 · 신청자 ' + total + '명 실제 참석시간 카운트' });
        V().closeModal();
        toast('교육 종료 · ' + total + '명 카운트 완료');
        render();
        tourEvt('closed');
    }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        state.courseId = new URLSearchParams(location.search).get('id');
        if (global.EDUDOC) global.EDUDOC.registerRefresh(render);
        render();
    }
    global.EDURD = {
        init: init, openApply: openApply, applyPickDept: applyPickDept, applyToggle: applyToggle,
        applyAttachSign: applyAttachSign, applyClearSign: applyClearSign, doApply: doApply,
        confirmCancel: confirmCancel, doCancel: doCancel,
        closeCourse: closeCourse, doClose: doClose
    };
})(window);
