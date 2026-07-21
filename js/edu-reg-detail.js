/* =====================================================================
   edu-reg-detail.js · 정기교육 상세 (EDU-REG-DETAIL, v1.1 §8.5)
   ---------------------------------------------------------------------
   집합교육 상세를 모달 대신 별도 화면으로. ?id=course_id 로 진입.
   · 교육 정보(일정·시간·강사·장소·내용·첨부)
   · 신청현황 테이블: 부서 · 신청자 명단 · 인원 · 서명파일 · 신청일 (전체 노출)
   · [부서 신청] · [교육 종료 처리] · 이력
   표준: 배지 chip-status+DYV2.toneOf · 표 .table-figma · 부서 선택 ORGPICK ·
        시연 훅 EDUTOUR.onEvent('applied'|'closed')
   ===================================================================== */
(function (global) {
    'use strict';
    var V = function () { return global.DYV2; };
    var E = function () { return global.DYEDU; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }
    function tourEvt(e) { if (global.EDUTOUR) global.EDUTOUR.onEvent(e); }

    var state = { mount: null, courseId: null };
    var G = null; /* 부서 신청 폼 */

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
        var enrolledCnt = enrolls.reduce(function (n, e) { return n + (e.workerIds || []).length; }, 0);

        var actions = '';
        if (c.status === 'OPEN') {
            actions =
                '<button type="button" class="btn btn-outline" onclick="EDURD.openApply()">＋ 부서 신청</button>' +
                '<button type="button" class="btn btn-primary" data-tour="close" onclick="EDURD.closeCourse()">교육 종료 처리</button>';
        }

        var sessions = E().courseSessions(c);
        var summary =
            '<div class="edu-detail-head">' +
                '<div class="edu-detail-title">' + esc(c.desc) + ' ' + stChip + '</div>' +
                '<div class="edu-detail-meta">' +
                    '<span>구분 <b>' + esc(E().kindLabel(c.kind)) + '</b></span>' +
                    '<span>일정 <b>' + esc(E().courseDateTime(c)) + '</b></span>' +
                    '<span>시간 <b>' + c.hours + 'h</b>' + (sessions.length > 1 ? ' (' + sessions.length + '일 합계)' : '') + '</span>' +
                    '<span>강사 <b>' + esc(c.instructor || '-') + '</b></span>' +
                    '<span>장소 <b>' + esc(c.place || '-') + '</b></span>' +
                    '<span>신청 <b>' + enrolls.length + '개 부서 · ' + enrolledCnt + '명</b></span>' +
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

        /* 신청현황 테이블 */
        var rows = enrolls.length ? enrolls.map(function (e) {
            var names = (e.workerIds || []).map(function (wid) { var w = E().workerOf(wid); return w ? w.name : wid; }).join(', ');
            return '<tr>' +
                '<td class="edu-name">' + esc(E().deptName(e.deptId)) + '</td>' +
                '<td>' + esc(names) + '</td>' +
                '<td>' + (e.workerIds || []).length + '명</td>' +
                '<td>' + (e.signFile ? '<span style="color:var(--main-dark);font-size:var(--fs-12);">📎 ' + esc(e.signFile) + '</span>' : '<span style="color:var(--text-lightgray);">-</span>') + '</td>' +
                '<td>' + esc(e.at) + '</td>' +
                '<td class="col-action"><button type="button" class="btn btn-outline btn-sm" style="border-color:var(--status-danger-border);color:var(--status-danger-fg);" onclick="EDURD.confirmCancel(\'' + esc(e.deptId) + '\')">신청 취소</button></td>' +
            '</tr>';
        }).join('') : '<tr><td colspan="6"><div class="v2-empty">아직 신청이 없습니다.</div></td></tr>';
        var enrollTable =
            '<div class="edu-card"><div class="edu-card-title">신청현황 (' + enrolls.length + '개 부서 · ' + enrolledCnt + '명)</div>' +
                '<div class="edu-scroll"><table class="table-figma table-compact"><thead><tr>' +
                    '<th style="width:20%;">부서</th><th>신청자 명단</th><th style="width:10%;">인원</th><th style="width:22%;">서명파일</th><th style="width:12%;">신청일</th><th></th>' +
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
        }).join('') : '<div style="color:var(--text-lightgray);font-size:var(--fs-12);padding:12px;">이력이 없습니다.</div>';
        var histCard = '<div class="edu-card"><div class="edu-card-title">이력</div><div class="edu-hist">' + hist + '</div></div>';

        state.mount.innerHTML = summary + enrollTable + histCard;
    }

    /* =============== 부서 신청 =============== */
    function openApply() {
        var depts = E().deptCandidates();
        G = { deptId: depts[0].id, workerIds: {}, signFile: '' };
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
        }).join('') : '<div style="color:var(--text-lightgray);font-size:var(--fs-12);padding:8px;">이 부서에 대상자가 없습니다.</div>';
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
                '<span style="color:var(--text-lightgray);font-weight:var(--fw-regular);">(' + selCnt + ' / ' + ws.length + '명)</span></label>' +
                '<div class="edu-tg-body" style="max-height:240px;">' + rows + '</div>' +
            '</div>' +
            '<div class="edu-modal-row"><label class="form-label">서명파일 업로드 <span style="color:var(--status-danger-fg)">*</span></label>' +
                (G.signFile
                    ? '<span style="color:var(--main-dark);font-weight:var(--fw-bold);font-size:var(--fs-12);">' + esc(G.signFile) + '</span> ' +
                      '<button type="button" class="btn btn-sm btn-outline" onclick="EDURD.applyClearSign()">×</button>'
                    : '<button type="button" class="btn btn-sm btn-outline" onclick="EDURD.applyAttachSign()">＋ 서명파일 첨부 (프로토타입)</button>') +
                V().fileHint() +
            '</div>';
        V().openModal('부서 신청 · ' + esc(E().deptName(G.deptId)), body,
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDURD.doApply()">신청 완료</button>');
    }
    function applyPickDept(id, name) { G.deptId = id; G.workerIds = {}; renderApply(); }
    function applyToggle(id, on) { if (on) G.workerIds[id] = true; else delete G.workerIds[id]; renderApply(); }
    function applyAttachSign() { G.signFile = E().deptName(G.deptId) + '_서명_' + state.courseId + '.pdf'; renderApply(); }
    function applyClearSign() { G.signFile = ''; renderApply(); }
    function doApply() {
        var ids = Object.keys(G.workerIds).filter(function (k) { return G.workerIds[k]; });
        if (!ids.length) { toast('근로자를 1명 이상 선택하세요.'); return; }
        if (!G.signFile) { toast('서명파일을 업로드하세요 (필수).'); return; }
        E().addEnroll({ courseId: state.courseId, deptId: G.deptId, workerIds: ids, signFile: G.signFile, at: E().today() });
        E().pushCourseHistory(state.courseId, { type: 'STATUS', by: E().deptName(G.deptId), memo: '부서 신청 · ' + ids.length + '명 · 서명파일 첨부' });
        V().closeModal();
        toast(E().deptName(G.deptId) + ' · ' + ids.length + '명 신청 완료');
        render();
        tourEvt('applied');
    }

    /* =============== 부서 신청 취소 =============== */
    /* 잘못 신청한 부서를 되돌린다. 이미 종료 처리된 교육이면 그 부서 몫의
     * 이수기록까지 회수되므로 확인 문구에 명시한다. */
    function confirmCancel(deptId) {
        var c = E().courseOf(state.courseId); if (!c) return;
        var mine = E().enrolls(state.courseId).filter(function (e) { return e.deptId === deptId; });
        var cnt = mine.reduce(function (n, e) { return n + (e.workerIds || []).length; }, 0);
        V().openModal('부서 신청 취소',
            '<p style="font-size:var(--fs-13);"><b>' + esc(E().deptName(deptId)) + '</b> · 신청 ' + cnt + '명</p>' +
            (c.status === 'DONE'
                ? '<div class="check-notice" style="margin-top:10px;">이미 종료 처리된 교육이라 <b>반영된 이수시간 ' + c.hours + 'h 도 함께 회수</b>됩니다.</div>'
                : '<p style="font-size:var(--fs-12);color:var(--text-gray);margin-top:8px;">신청 내역과 서명파일이 삭제됩니다.</p>'),
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDURD.doCancel(\'' + esc(deptId) + '\')">신청 취소</button>');
    }
    function doCancel(deptId) {
        var r = E().removeEnroll(state.courseId, deptId);
        if (r) {
            E().pushCourseHistory(state.courseId, {
                type: 'STATUS', by: E().deptName(deptId),
                memo: '부서 신청 취소 · ' + r.workers + '명' + (r.records ? ' · 이수기록 ' + r.records + '건 회수' : '')
            });
        }
        V().closeModal();
        toast(r ? E().deptName(deptId) + ' 신청을 취소했습니다.' : '신청 내역이 없습니다.');
        render();
    }

    /* =============== 교육 종료 처리 =============== */
    function closeCourse() {
        var c = E().courseOf(state.courseId); if (!c) return;
        var enrolls = E().enrolls(state.courseId);
        var totalCnt = enrolls.reduce(function (n, e) { return n + (e.workerIds || []).length; }, 0);
        V().openModal('교육 종료 처리',
            '<p style="font-size:var(--fs-13);"><b>' + esc(c.desc) + '</b><br>신청 <b>' + enrolls.length + '개 부서 · ' + totalCnt + '명</b>에게 교육시간 ' + c.hours + 'h 를 카운트합니다.</p>' +
            '<p style="font-size:var(--fs-12);color:var(--text-gray);margin-top:6px;">종료 후에는 되돌릴 수 없습니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDURD.doClose()">종료 처리</button>');
    }
    function doClose() {
        var c = E().courseOf(state.courseId); if (!c) return;
        var enrolls = E().enrolls(state.courseId);
        var total = 0;
        enrolls.forEach(function (e) {
            E().recordCourseCompletion(state.courseId, e.workerIds, c.hours, c.date);
            total += (e.workerIds || []).length;
        });
        E().updateCourse(state.courseId, { status: 'DONE' });
        E().pushCourseHistory(state.courseId, { type: 'STATUS', by: '재난안전과', memo: '교육 종료 처리 · 신청자 ' + total + '명 카운트' });
        V().closeModal();
        toast('교육 종료 · ' + total + '명 카운트 완료');
        render();
        tourEvt('closed');
    }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        state.courseId = new URLSearchParams(location.search).get('id');
        render();
    }
    global.EDURD = {
        init: init, openApply: openApply, applyPickDept: applyPickDept, applyToggle: applyToggle,
        applyAttachSign: applyAttachSign, applyClearSign: applyClearSign, doApply: doApply,
        confirmCancel: confirmCancel, doCancel: doCancel,
        closeCourse: closeCourse, doClose: doClose
    };
})(window);
