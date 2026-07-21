/* =====================================================================
   edu-hire.js · 채용시교육 (EDU-HIRE, v1.1 §8.5)
   ---------------------------------------------------------------------
   · 근로자 신규 등록/엑셀 시 채용시교육 항목이 자동으로 '미이수' 상태로 표시(별도 DB 스키마 없이 hireStatus 파생).
   · 탭: 미이수 / 이수 (.sub-tabs + .count)
   · 필터: 부서 · 고용형태 (가로 배치 — 조회 조건이므로 select 유지)
   · 미이수 탭: 필터 결과 헤더 체크박스로 전체선택 + [선택 이수처리] → 이수일 입력 후 일괄 완료
   표준: 배지 chip-status+DYV2.toneOf · 표 .table-figma(.table-compact) · 빈상태 .v2-empty
   ===================================================================== */
(function (global) {
    'use strict';
    var V = function () { return global.DYV2; };
    var E = function () { return global.DYEDU; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }

    var state = { mount: null, tab: 'undone', fDept: '', fEmp: '', fQ: '', fYear: '', fDone: '', checked: {} };
    var B = null; /* 일괄 이수처리 폼 */

    /* 탭 필터만 적용한 원본 (연도 옵션 파생용) */
    function tabRows() {
        var arr = E().workers().filter(function (w) { return w.category !== 'SUPERVISOR'; }).map(function (w) {
            return { w: w, hs: E().hireStatus(w.id) };
        });
        return state.tab === 'undone'
            ? arr.filter(function (r) { return r.hs.status === 'NONE'; })
            : arr.filter(function (r) { return r.hs.status !== 'NONE'; });
    }
    function rowsForTab() {
        var arr = tabRows().filter(function (r) {
            if (state.fDept && r.w.deptId !== state.fDept) return false;
            if (state.fEmp && r.w.empType !== state.fEmp) return false;
            if (state.fYear && String(r.w.hireDate || '').slice(0, 4) !== state.fYear) return false;
            /* 이수 탭 전용 — 정상 이수(BEFORE) / 지연 이수(LATE_DONE) */
            if (state.tab === 'done' && state.fDone && r.hs.status !== state.fDone) return false;
            return EDUFILTER.match(state.fQ, [r.w.name, E().deptName(r.w.deptId)]);
        });
        arr.sort(function (a, b) { return (b.w.hireDate || '').localeCompare(a.w.hireDate || ''); });
        return arr;
    }

    function render() {
        if (!state.mount) return;
        var all = tabRows();
        var list = rowsForTab();

        var tabs =
            '<div class="sub-tabs" style="margin-bottom:12px;">' +
                '<button type="button" class="sub-tab' + (state.tab === 'undone' ? ' active' : '') + '" onclick="EDUH.setTab(\'undone\')">미이수 <span class="count">' + tabCount('undone') + '</span></button>' +
                '<button type="button" class="sub-tab' + (state.tab === 'done' ? ' active' : '') + '" onclick="EDUH.setTab(\'done\')">이수 <span class="count">' + tabCount('done') + '</span></button>' +
            '</div>';

        var fields = [
            { type: 'search', id: 'eh-q', value: state.fQ, placeholder: '이름·부서 검색', on: "EDUH.setF('Q', this.value)" },
            { type: 'select', id: 'eh-dept', value: state.fDept, label: '부서',
              options: [['', '부서 전체']].concat(E().deptCandidates().map(function (d) { return [d.id, d.name]; })),
              on: "EDUH.setF('Dept', this.value)" },
            { type: 'select', id: 'eh-emp', value: state.fEmp, label: '고용형태',
              options: [['', '고용형태 전체']].concat(Object.keys(E().EMP_LABEL).map(function (k) { return [k, E().EMP_LABEL[k]]; })),
              on: "EDUH.setF('Emp', this.value)" },
            { type: 'select', id: 'eh-year', value: state.fYear, label: '채용연도',
              options: EDUFILTER.yearOptions(all.map(function (r) { return r.w.hireDate; }), '채용연도 전체'),
              on: "EDUH.setF('Year', this.value)" }
        ];
        if (state.tab === 'done') {
            fields.push({ type: 'select', id: 'eh-done', value: state.fDone, label: '이수 구분',
                options: [['', '이수 구분 전체'], ['BEFORE', '정상 이수'], ['LATE_DONE', '지연 이수']],
                on: "EDUH.setF('Done', this.value)" });
        }
        var filters = EDUFILTER.bar(fields, {
            count: list.length, unit: '명', reset: 'EDUH.resetF()',
            actions: state.tab === 'undone'
                ? '<button type="button" class="btn btn-primary" onclick="EDUH.openBulk()">선택 이수처리 (' + selectedCount() + ')</button>'
                : ''
        });

        var allIds = list.map(function (r) { return r.w.id; });
        var allChecked = allIds.length && allIds.every(function (id) { return state.checked[id]; });
        var headerCk = state.tab === 'undone'
            ? '<th style="width:44px;text-align:center;"><input type="checkbox"' + (allChecked ? ' checked' : '') +
                ' onchange="EDUH.toggleAll(this.checked)" title="필터 결과 전체선택/해제" aria-label="필터 결과 전체선택"></th>'
            : '<th style="width:44px;"></th>';

        var body = list.length ? list.map(rowHtml).join('') :
            '<tr><td colspan="9"><div class="v2-empty">' +
                (state.tab === 'undone' ? '조건에 맞는 미이수자가 없습니다.' : '조건에 맞는 이수 이력이 없습니다.') +
            '</div></td></tr>';

        state.mount.innerHTML = tabs + filters +
            '<div class="edu-card"><div class="edu-scroll"><table class="table-figma table-compact"><thead><tr>' +
                headerCk +
                '<th>이름</th><th>부서</th><th>고용형태</th><th>채용일</th><th>필요시간</th><th>이수일</th><th>상태</th><th></th>' +
            '</tr></thead><tbody>' + body + '</tbody></table></div></div>';
    }
    function tabCount(tab) {
        return E().workers().filter(function (w) { return w.category !== 'SUPERVISOR'; })
            .filter(function (w) {
                var s = E().hireStatus(w.id);
                return tab === 'undone' ? s.status === 'NONE' : s.status !== 'NONE';
            }).length;
    }
    function selectedCount() { return Object.keys(state.checked).filter(function (k) { return state.checked[k]; }).length; }

    function rowHtml(r) {
        var w = r.w, hs = r.hs;
        var stLabel = hs.status === 'BEFORE' ? '정상 이수' : (hs.status === 'LATE_DONE' ? '지연 이수' : '미이수');
        var empLabel = E().empLabel(w.empType) + (w.contractMonths ? '[' + w.contractMonths + '개월]' : '');
        var ck = state.tab === 'undone'
            ? '<input type="checkbox"' + (state.checked[w.id] ? ' checked' : '') +
                ' onchange="EDUH.toggle(\'' + w.id + '\', this.checked)" aria-label="' + esc(w.name) + ' 선택">'
            : '';
        return '<tr>' +
            '<td style="text-align:center;">' + ck + '</td>' +
            '<td class="edu-name">' + esc(w.name) + '</td>' +
            '<td>' + esc(E().deptName(w.deptId)) + '</td>' +
            '<td>' + esc(empLabel) + '</td>' +
            '<td>' + esc(w.hireDate) + '</td>' +
            '<td>' + hs.need + 'h</td>' +
            '<td>' + esc(hs.lastDate || '-') + '</td>' +
            '<td><span class="chip-status chip-sm ' + V().toneOf(stLabel) + '">' + esc(stLabel) + '</span></td>' +
            '<td class="col-action">' + (state.tab === 'done'
                ? '<button type="button" class="btn btn-outline btn-sm" style="border-color:var(--status-danger-border);color:var(--status-danger-fg);" onclick="EDUH.confirmUndo(\'' + w.id + '\')">이수 취소</button>'
                : '') + '</td>' +
        '</tr>';
    }

    /* =============== 이수 취소 =============== */
    /* 일괄 처리로 만들어진 근로자별 HIRE 교육 건을 지워 '미이수'로 되돌린다.
     * 잘못 처리했을 때 전체 초기화 말고는 복구 수단이 없어 시연 사고에 취약했다. */
    function confirmUndo(workerId) {
        var w = E().workerOf(workerId); if (!w) return;
        var mine = E().courses({ kind: ['HIRE'] }).filter(function (c) {
            return E().enrolls(c.id).some(function (e) { return (e.workerIds || []).indexOf(workerId) !== -1; });
        });
        if (!mine.length) { toast('되돌릴 채용시교육 이수 건이 없습니다.'); return; }
        V().openModal('채용시교육 이수 취소',
            '<p style="font-size:var(--fs-13);"><b>' + esc(w.name) + '</b> (' + esc(E().deptName(w.deptId)) + ')</p>' +
            '<div class="check-notice" style="margin-top:10px;">이수 처리된 <b>' + mine.length + '건</b>과 반영된 이수시간이 함께 회수되어 <b>미이수</b> 상태로 돌아갑니다.</div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUH.doUndo(\'' + workerId + '\')">이수 취소</button>');
    }
    function doUndo(workerId) {
        var mine = E().courses({ kind: ['HIRE'] }).filter(function (c) {
            return E().enrolls(c.id).some(function (e) { return (e.workerIds || []).indexOf(workerId) !== -1; });
        });
        mine.forEach(function (c) { E().removeCourse(c.id); });
        V().closeModal();
        toast(mine.length + '건 이수 취소 · 미이수로 되돌렸습니다.');
        render();
    }

    function setTab(t) { state.tab = t; state.checked = {}; state.fDone = ''; render(); }
    function setF(k, v) { state['f' + k] = v; state.checked = {}; EDUFILTER.rerender(render); }
    function resetF() {
        state.fDept = ''; state.fEmp = ''; state.fQ = ''; state.fYear = ''; state.fDone = '';
        state.checked = {}; render();
    }
    function toggle(id, on) { if (on) state.checked[id] = true; else delete state.checked[id]; render(); }
    function toggleAll(on) {
        state.checked = {};
        if (on) rowsForTab().forEach(function (r) { state.checked[r.w.id] = true; });
        render();
    }

    /* =============== 일괄 이수처리 =============== */
    function openBulk() {
        var ids = Object.keys(state.checked).filter(function (k) { return state.checked[k]; });
        if (!ids.length) { toast('미이수자를 1명 이상 선택하세요.'); return; }
        B = {
            ids: ids,
            /* 기본값: 각자 채용일 처리(정상 이수). 해제 시 일괄 이수일 지정. */
            useHireDate: true,
            date: E().today(), time: '09:00',
            instructor: '외부위탁',
            desc: '채용시 안전보건교육 (일괄 이수처리)'
        };
        renderBulk();
    }
    function captureBulk() {
        var el = function (id) { return document.getElementById(id); };
        if (el('eh-b-date')) B.date = el('eh-b-date').value || B.date;
        if (el('eh-b-time')) B.time = el('eh-b-time').value || B.time;
        if (el('eh-b-inst')) B.instructor = el('eh-b-inst').value.trim();
        if (el('eh-b-desc')) B.desc = el('eh-b-desc').value.trim();
    }
    function renderBulk() {
        var names = B.ids.map(function (id) { var w = E().workerOf(id); return w ? w.name : id; }).join(', ');
        var body =
            '<p style="font-size:var(--fs-13);">선택한 <b>' + B.ids.length + '명</b>의 채용시교육을 이수 처리합니다.</p>' +
            '<div style="max-height:80px;overflow-y:auto;font-size:var(--fs-12);color:var(--text-gray);background:var(--gray-50);padding:8px 10px;border-radius:var(--radius-md);margin-bottom:12px;">' + esc(names) + '</div>' +
            '<div class="edu-modal-row"><label class="form-label">이수일 처리 방식</label>' +
                '<label style="display:flex;align-items:center;gap:6px;font-size:var(--fs-12);padding:4px 0;">' +
                    '<input type="radio" name="eh-mode"' + (B.useHireDate ? ' checked' : '') + ' onchange="EDUH.setBulkMode(true)"> ' +
                    '<b>각자 채용일</b>로 처리 (권장 · 정상 이수 처리)' +
                '</label>' +
                '<label style="display:flex;align-items:center;gap:6px;font-size:var(--fs-12);padding:4px 0;">' +
                    '<input type="radio" name="eh-mode"' + (!B.useHireDate ? ' checked' : '') + ' onchange="EDUH.setBulkMode(false)"> ' +
                    '<b>일괄 이수일</b> 지정 (채용일보다 늦으면 지연 이수)' +
                '</label>' +
            '</div>' +
            (!B.useHireDate
                ? '<div class="edu-modal-row-2">' +
                    '<div><label class="form-label" for="eh-b-date">일괄 이수일 <span style="color:var(--status-danger-fg)">*</span></label>' +
                      '<input type="date" class="form-input" id="eh-b-date" value="' + esc(B.date) + '"></div>' +
                    '<div><label class="form-label" for="eh-b-time">시작 시각</label>' +
                      '<input type="time" class="form-input" id="eh-b-time" value="' + esc(B.time) + '"></div>' +
                  '</div>'
                : '') +
            '<div class="edu-modal-row"><label class="form-label" for="eh-b-inst">강사·주관</label>' +
                '<input type="text" class="form-input" id="eh-b-inst" value="' + esc(B.instructor) + '"></div>' +
            '<div class="edu-modal-row"><label class="form-label" for="eh-b-desc">내용</label>' +
                '<textarea class="form-textarea" id="eh-b-desc" rows="2">' + esc(B.desc) + '</textarea></div>';
        V().openModal('선택 이수처리 · ' + B.ids.length + '명', body,
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUH.doBulk()">이수 처리</button>');
    }
    function setBulkMode(useHire) { captureBulk(); B.useHireDate = useHire; renderBulk(); }
    function doBulk() {
        if (!B.useHireDate) {
            var d = document.getElementById('eh-b-date').value;
            if (!d) { toast('일괄 이수일을 입력하세요.'); return; }
            B.date = d;
            var t = document.getElementById('eh-b-time');
            if (t) B.time = t.value || B.time;
        }
        B.instructor = document.getElementById('eh-b-inst').value.trim();
        B.desc = document.getElementById('eh-b-desc').value.trim() || '채용시 안전보건교육';
        var count = 0;
        B.ids.forEach(function (id) {
            var w = E().workerOf(id); if (!w) return;
            var hours = E().hireHours(w);
            var date = B.useHireDate ? w.hireDate : B.date;
            var time = B.useHireDate ? '' : B.time; /* 각자 채용일 처리 시 시간 정보 없음 */
            /* 부서별로 course를 새로 만들면 지나치게 늘어나므로 근로자별 개별 course. */
            var c = E().addCourse({
                kind: 'HIRE', deptId: w.deptId, date: date, time: time, hours: hours,
                instructor: B.instructor, place: '', desc: B.desc + ' · ' + w.name,
                status: 'DONE', createdBy: '재난안전과 (일괄)'
            });
            E().addEnroll({ courseId: c.id, deptId: w.deptId, workerIds: [id], at: date });
            E().addRecord({ workerId: id, courseId: c.id, kind: 'HIRE', hours: hours, date: date });
            count++;
        });
        V().closeModal();
        toast(count + '명 채용시교육 이수 처리 완료');
        state.checked = {};
        render();
    }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        render();
    }
    global.EDUH = {
        init: init, setTab: setTab, setF: setF, resetF: resetF,
        toggle: toggle, toggleAll: toggleAll,
        openBulk: openBulk, setBulkMode: setBulkMode, doBulk: doBulk,
        confirmUndo: confirmUndo, doUndo: doUndo
    };
})(window);
