/* =====================================================================
   edu-etc.js · 기타 교육 (EDU-ETC, EDU-SUP-ETC 공용)
   ---------------------------------------------------------------------
   docs/planning/기획-안전보건교육-재설계-v1.md §6.
   자체교육 형식 + 분류 셀렉트(특별교육/작업내용 변경 시/MSDS/직무교육/자체·기타).
   등록·진행 시 즉시 완료·카운트(참여자에 ETC 유형으로 기록).
   표준: 배지 chip-status+DYV2.toneOf · 빈상태 .v2-empty · 부서 선택 ORGPICK('deptId')
   ===================================================================== */
(function (global) {
    'use strict';
    var V = function () { return global.DYV2; };
    var E = function () { return global.DYEDU; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }

    var SUP_MODE = false;
    var state = { mount: null, fType: '', q: '', dept: '', year: '' };
    var F = null;

    function courseKind() { return SUP_MODE ? 'SUP_ETC' : 'ETC'; }
    function pickWorkers(deptId) {
        var arr = SUP_MODE ? E().supervisorWorkers() : E().fieldWorkers();
        return deptId ? arr.filter(function (w) { return w.deptId === deptId; }) : arr;
    }

    function render() {
        if (!state.mount) return;
        var all = E().courses({ kind: [courseKind()] });
        var list = all.filter(function (c) {
            if (state.fType && c.etcType !== state.fType) return false;
            if (state.dept && c.deptId !== state.dept) return false;
            if (state.year && String(c.date || '').slice(0, 4) !== state.year) return false;
            return EDUFILTER.match(state.q, [c.desc, c.instructor, c.place, c.etcType, E().deptName(c.deptId)]);
        });

        var head = EDUFILTER.bar([
            { type: 'search', id: 'ee-q', value: state.q, placeholder: '내용·강사·장소 검색', on: "EDUE.setF('q', this.value)" },
            { type: 'select', id: 'ee-f-type', value: state.fType, label: '교육 분류',
              options: [['', '분류 전체']].concat(E().ETC_TYPES.map(function (t) { return [t, t]; })), on: "EDUE.setF('fType', this.value)" },
            { type: 'select', id: 'ee-f-dept', value: state.dept, label: '부서',
              options: [['', '부서 전체']].concat(E().deptCandidates().map(function (d) { return [d.id, d.name]; })), on: "EDUE.setF('dept', this.value)" },
            { type: 'select', id: 'ee-f-year', value: state.year, label: '연도',
              options: EDUFILTER.yearOptions(all.map(function (c) { return c.date; })), on: "EDUE.setF('year', this.value)" }
        ], {
            count: list.length, unit: '건', reset: 'EDUE.resetF()',
            actions: '<button type="button" class="btn btn-primary" onclick="EDUE.openCreate()">＋ 기타 교육 등록·진행</button>'
        });

        var cards = list.length ? list.map(cardHtml).join('') :
            '<div class="edu-card"><div class="v2-empty">' +
                (all.length ? '조건에 맞는 기타 교육이 없습니다.' : '등록된 기타 교육이 없습니다.') + '</div></div>';
        state.mount.innerHTML = head + cards;
    }
    function cardHtml(c) {
        var stChip = c.status === 'DONE'
            ? '<span class="chip-status chip-sm ' + V().toneOf('완료') + '">완료</span>'
            : '<span class="chip-status chip-sm ' + V().toneOf('진행중') + '">진행중</span>';
        var typeBadge = c.etcType ? '<span class="chip-status chip-sm neutral" style="margin-right:6px;">' + esc(c.etcType) + '</span>' : '';
        var deptChip = c.deptId ? '<span class="chip-status chip-sm neutral" style="margin-right:6px;">' + esc(E().deptName(c.deptId)) + '</span>' : '';
        var enrolls = E().enrolls(c.id);
        var cnt = enrolls.reduce(function (n, e) { return n + (e.workerIds || []).length; }, 0);
        return '<div class="edu-course-card">' +
            '<div class="edu-course-head">' +
                '<div class="edu-course-title">' + typeBadge + deptChip + esc(c.desc) + ' ' + stChip + '</div>' +
                '<div class="edu-course-actions">' +
                    '<button type="button" class="btn btn-outline btn-sm" onclick="EDUE.viewDetail(\'' + c.id + '\')">상세</button>' +
                    '<button type="button" class="btn btn-outline btn-sm" onclick="EDUE.openEdit(\'' + c.id + '\')">수정</button>' +
                    '<button type="button" class="btn btn-outline btn-sm" style="border-color:var(--status-danger-border);color:var(--status-danger-fg);" onclick="EDUE.confirmRemove(\'' + c.id + '\')">삭제</button>' +
                '</div>' +
            '</div>' +
            '<div class="edu-course-meta">' +
                '<span>일정 <b>' + esc(E().courseDateTime(c)) + '</b></span>' +
                '<span>시간 <b>' + c.hours + 'h</b></span>' +
                '<span>강사 <b>' + esc(c.instructor || '-') + '</b></span>' +
                '<span>장소 <b>' + esc(c.place || '-') + '</b></span>' +
                '<span>대상자 <b>' + cnt + '명</b></span>' +
            '</div>' +
        '</div>';
    }
    function setF(k, v) { state[k] = v; EDUFILTER.rerender(render); }
    function resetF() { state.fType = ''; state.q = ''; state.dept = ''; state.year = ''; render(); }

    /* =============== 등록 · 수정 =============== */
    function openCreate() {
        var depts = E().deptCandidates();
        F = {
            edit: null,
            etcType: E().ETC_TYPES[0], deptId: depts[0].id,
            date: E().today(), time: '10:00', hours: 2, instructor: '', place: '', desc: '',
            files: [], workerIds: {}
        };
        renderCreate();
    }
    /* 수정 — 대상자는 이미 이수기록이 붙어 있어 여기서 바꾸지 않는다(삭제 후 재등록 경로) */
    function openEdit(courseId) {
        var c = E().courseOf(courseId); if (!c) return;
        F = {
            edit: courseId,
            etcType: c.etcType || E().ETC_TYPES[0], deptId: c.deptId || E().deptCandidates()[0].id,
            date: c.date, time: c.time || '', hours: c.hours,
            instructor: c.instructor || '', place: c.place || '', desc: c.desc || '',
            files: (c.files || []).slice(), workerIds: {}
        };
        renderCreate();
    }
    function renderCreate() {
        var typeOpts = E().ETC_TYPES.map(function (t) { return '<option value="' + esc(t) + '"' + (t === F.etcType ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('');
        var ws = pickWorkers(F.deptId);
        var selCnt = Object.keys(F.workerIds).filter(function (k) { return F.workerIds[k]; }).length;
        var rows = ws.length ? ws.map(function (w) {
            var ck = F.workerIds[w.id] ? ' checked' : '';
            return '<label class="edu-tg-member"><input type="checkbox"' + ck +
                ' onchange="EDUE.toggleTarget(\'' + w.id + '\', this.checked)">' +
                '<span>' + esc(w.name) + '</span>' +
                '<span style="color:var(--text-gray);font-size:var(--fs-12);">' + esc(E().catLabel(w.category)) + '</span>' +
            '</label>';
        }).join('') : '<div style="color:var(--text-lightgray);font-size:var(--fs-12);padding:8px;">이 부서에 대상자가 없습니다.</div>';

        var body =
            '<div class="edu-modal-row-2">' +
                '<div><label class="form-label" for="ee-type">교육 분류 <span style="color:var(--status-danger-fg)">*</span></label>' +
                    '<select class="form-select" id="ee-type">' + typeOpts + '</select></div>' +
                '<div><label class="form-label">부서 <span style="color:var(--status-danger-fg)">*</span></label>' +
                    '<div class="orgpick-field" id="ee-deptfield"><div style="display:flex;gap:8px;align-items:center;">' +
                        '<input type="text" class="form-input" value="' + esc(E().deptName(F.deptId)) + '" readonly aria-label="부서" style="flex:1;background:var(--gray-50);">' +
                        '<button type="button" class="btn btn-sm btn-outline" onclick="ORGPICK.toggle(\'ee-deptfield\',\'deptId\',\'EDUE.pickDept\')">조직도</button>' +
                    '</div></div></div>' +
            '</div>' +
            '<div class="edu-modal-row-2">' +
                '<div><label class="form-label" for="ee-date">일자 <span style="color:var(--status-danger-fg)">*</span></label>' +
                    '<input type="date" class="form-input" id="ee-date" value="' + esc(F.date) + '"></div>' +
                '<div><label class="form-label" for="ee-time">시작 시각 <span style="color:var(--status-danger-fg)">*</span></label>' +
                    '<input type="time" class="form-input" id="ee-time" value="' + esc(F.time) + '"></div>' +
            '</div>' +
            '<div class="edu-modal-row"><label class="form-label" for="ee-hours">교육 시간(h) <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="number" class="form-input" id="ee-hours" value="' + F.hours + '" style="max-width:120px;"></div>' +
            '<div class="edu-modal-row"><label class="form-label" for="ee-inst">강사</label>' +
                '<input type="text" class="form-input" id="ee-inst" value="' + esc(F.instructor) + '"></div>' +
            '<div class="edu-modal-row"><label class="form-label" for="ee-place">장소</label>' +
                '<input type="text" class="form-input" id="ee-place" value="' + esc(F.place) + '"></div>' +
            '<div class="edu-modal-row"><label class="form-label" for="ee-desc">내용 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<textarea class="form-textarea" id="ee-desc" rows="2">' + esc(F.desc) + '</textarea></div>' +
            (F.edit
                ? '<div class="check-notice">대상자는 이 화면에서 바꾸지 않습니다 — 이미 반영된 이수시간과 어긋나므로 <b>삭제 후 재등록</b>으로 처리합니다.</div>'
                : '<div class="edu-modal-row"><label class="form-label">대상자 <span style="color:var(--status-danger-fg)">*</span> ' +
                    '<span style="color:var(--text-lightgray);font-weight:var(--fw-regular);">(' + selCnt + ' / ' + ws.length + '명)</span></label>' +
                    '<div class="edu-tg-body" style="max-height:200px;">' + rows + '</div>' +
                  '</div>') +
            '<div class="edu-modal-row"><label class="form-label">증빙 첨부(서명 등)</label>' +
                '<button type="button" class="btn btn-sm btn-outline" onclick="EDUE.attachFile()">＋ 파일 첨부 (프로토타입)</button>' +
                (F.files.length ? '<div style="font-size:var(--fs-12);color:var(--main-dark);margin-top:6px;">' + F.files.map(function (f) { return esc(f.name); }).join(', ') + '</div>' : '') +
                V().fileHint() +
            '</div>';
        V().openModal((SUP_MODE ? '관리감독자 ' : '') + (F.edit ? '기타 교육 수정' : '기타 교육 등록·진행'), body,
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUE.doCreate()">' + (F.edit ? '저장' : '진행 처리') + '</button>');
    }
    /* 재렌더 전 입력값 보존 — 원본은 체크·부서 변경 시 타이핑 값이 유실됐다(이식 시 보완) */
    function captureCreate() {
        var el = function (id) { return document.getElementById(id); };
        if (el('ee-type')) F.etcType = el('ee-type').value;
        if (el('ee-date')) F.date = el('ee-date').value;
        if (el('ee-time')) F.time = el('ee-time').value;
        if (el('ee-hours')) F.hours = parseFloat(el('ee-hours').value) || 0;
        if (el('ee-inst')) F.instructor = el('ee-inst').value.trim();
        if (el('ee-place')) F.place = el('ee-place').value.trim();
        if (el('ee-desc')) F.desc = el('ee-desc').value.trim();
    }
    function pickDept(id, name) { captureCreate(); F.deptId = id; F.workerIds = {}; renderCreate(); }
    function toggleTarget(id, on) { captureCreate(); if (on) F.workerIds[id] = true; else delete F.workerIds[id]; renderCreate(); }
    function attachFile() { captureCreate(); F.files.push({ name: (F.etcType || '기타') + '_증빙.pdf' }); renderCreate(); }
    function doCreate() {
        captureCreate();
        if (!F.date || !F.time || !F.hours || !F.desc) { toast('일자·시각·시간·내용을 모두 입력하세요.'); return; }
        if (F.edit) {
            E().updateCourse(F.edit, {
                etcType: F.etcType, deptId: F.deptId, date: F.date, time: F.time, hours: F.hours,
                instructor: F.instructor, place: F.place, desc: F.desc, files: F.files
            });
            E().pushCourseHistory(F.edit, { type: 'STATUS', by: E().deptName(F.deptId), memo: '기타 교육 정보 수정' });
            V().closeModal();
            toast('기타 교육 정보를 저장했습니다.');
            render();
            return;
        }
        var ids = Object.keys(F.workerIds).filter(function (k) { return F.workerIds[k]; });
        if (!ids.length) { toast('대상자를 1명 이상 선택하세요.'); return; }
        var c = E().addCourse({
            kind: courseKind(), etcType: F.etcType, deptId: F.deptId,
            date: F.date, time: F.time, hours: F.hours, instructor: F.instructor, place: F.place, desc: F.desc,
            files: F.files, status: 'DONE', createdBy: E().deptName(F.deptId)
        });
        E().addEnroll({ courseId: c.id, deptId: F.deptId, workerIds: ids, at: F.date });
        E().recordCourseCompletion(c.id, ids, F.hours, F.date);
        E().pushCourseHistory(c.id, { type: 'STATUS', by: E().deptName(F.deptId), memo: F.etcType + ' 진행 처리 · ' + ids.length + '명 카운트' });
        V().closeModal();
        toast(F.etcType + ' 진행 완료 · ' + ids.length + '명 카운트');
        render();
    }

    function viewDetail(courseId) {
        var c = E().courseOf(courseId); if (!c) return;
        var enrolls = E().enrolls(courseId);
        var names = enrolls.map(function (e) {
            return (e.workerIds || []).map(function (id) { var w = E().workerOf(id); return w ? w.name : id; }).join(', ');
        }).join(' · ');
        var hist = (c.history || []).map(function (h) {
            return '<div style="padding:6px 0;border-bottom:1px dashed var(--card-line);font-size:var(--fs-12);">' +
                '<span style="color:var(--text-lightgray);margin-right:8px;">' + esc(h.at) + '</span>' +
                esc(h.memo) + (h.by ? '<span style="color:var(--text-lightgray);margin-left:6px;">— ' + esc(h.by) + '</span>' : '') +
            '</div>';
        }).join('');
        V().openModal((c.etcType || '기타 교육') + ' — 상세',
            '<div style="font-size:var(--fs-13);">' +
                '<div style="font-weight:var(--fw-bold);">' + esc(c.desc) + '</div>' +
                '<div style="color:var(--text-gray);margin-top:6px;">' +
                    (c.deptId ? esc(E().deptName(c.deptId)) + ' · ' : '') +
                    '일정 ' + esc(E().courseDateTime(c)) + ' · ' + c.hours + 'h · 강사 ' + esc(c.instructor || '-') + ' · 장소 ' + esc(c.place || '-') +
                '</div>' +
                '<div style="margin-top:10px;"><b>대상자:</b> ' + esc(names || '없음') + '</div>' +
            '</div>' +
            (hist ? '<label class="form-label" style="margin-top:12px;">이력</label><div>' + hist + '</div>' : ''),
            '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal()">닫기</button>');
    }

    /* =============== 삭제 =============== */
    function confirmRemove(courseId) {
        var c = E().courseOf(courseId); if (!c) return;
        var cnt = E().enrolls(courseId).reduce(function (n, e) { return n + (e.workerIds || []).length; }, 0);
        V().openModal('기타 교육 삭제',
            '<p style="font-size:var(--fs-13);"><b>' + esc(c.etcType || '기타 교육') + '</b> · ' + esc(c.desc) + '<br>' +
                esc(E().courseDateTime(c)) + ' · ' + c.hours + 'h</p>' +
            (cnt ? '<div class="check-notice" style="margin-top:10px;">대상자 <b>' + cnt + '명</b>에게 반영된 <b>이수시간 ' + c.hours + 'h 도 함께 회수</b>됩니다.</div>' : '') +
            '<p style="font-size:var(--fs-12);color:var(--text-gray);margin-top:8px;">삭제 후에는 되돌릴 수 없습니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUE.doRemove(\'' + courseId + '\')">삭제</button>');
    }
    function doRemove(courseId) {
        var r = E().removeCourse(courseId);
        V().closeModal();
        toast(r ? '기타 교육을 삭제했습니다 · 이수기록 ' + r.records + '건 회수' : '교육을 찾을 수 없습니다.');
        render();
    }

    function init(mountId, opts) {
        opts = opts || {};
        SUP_MODE = !!opts.supMode;
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        render();
    }
    global.EDUE = {
        init: init, setF: setF, resetF: resetF,
        openCreate: openCreate, openEdit: openEdit, pickDept: pickDept, toggleTarget: toggleTarget, attachFile: attachFile, doCreate: doCreate,
        confirmRemove: confirmRemove, doRemove: doRemove,
        viewDetail: viewDetail
    };
})(window);
