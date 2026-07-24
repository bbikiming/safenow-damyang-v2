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

    var state = { mount: null, tab: 'undone', fDept: '', fEmp: '', fQ: '', fYear: '', fDone: '', groupBy: 'dept', checked: {},
                  cQ: '', cDept: '', cYear: '' };
    /* tab: 'undone' 미이수 | 'done' 이수 | 'courses' 교육 건(실시한 채용시 교육 목록 · 교육별 결재 상신)
     * groupBy: 'dept' 부서별 | 'hire' 채용일(월)별 | 'none' 안 묶기
     * c* — '교육 건' 탭 전용 필터(근로자 필터와 의미가 달라 별도 상태로 둔다) */
    var B = null; /* 일괄 이수처리 폼 */
    var A = null; /* 채용시 교육 추가 폼 (자체교육과 동일 구성 · EDUFORM) */

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

        var tabs =
            '<div class="sub-tabs" style="margin-bottom:12px;">' +
                '<button type="button" class="sub-tab' + (state.tab === 'undone' ? ' active' : '') + '" onclick="EDUH.setTab(\'undone\')">미이수 <span class="count">' + tabCount('undone') + '</span></button>' +
                '<button type="button" class="sub-tab' + (state.tab === 'done' ? ' active' : '') + '" onclick="EDUH.setTab(\'done\')">이수 <span class="count">' + tabCount('done') + '</span></button>' +
                '<button type="button" class="sub-tab' + (state.tab === 'courses' ? ' active' : '') + '" onclick="EDUH.setTab(\'courses\')">교육 건 <span class="count">' + hireCourses().length + '</span></button>' +
            '</div>';

        /* '교육 건' 탭 — 실시한 채용시 교육을 건 단위로 보고 교육별 결재 상신(Type 2)을 건다 */
        if (state.tab === 'courses') { state.mount.innerHTML = tabs + renderCourses(); return; }

        var all = tabRows();
        var list = rowsForTab();

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
        var actions = '<button type="button" class="btn btn-primary" onclick="EDUH.openAdd()">＋ 채용시 교육 추가</button>' +
            (state.tab === 'undone'
                ? ' <button type="button" class="btn btn-outline" onclick="EDUH.openBulk()">선택 이수처리 (' + selectedCount() + ')</button>'
                : '');
        var filters = EDUFILTER.bar(fields, { count: list.length, unit: '명', reset: 'EDUH.resetF()', actions: actions });

        /* 묶어보기 — 부서별 / 채용일별 / 안 묶기 */
        var groupBar =
            '<div class="edu-toolbar" style="margin-bottom:10px;">' +
                '<span style="font-size:var(--fs-12);color:var(--text-gray);font-weight:var(--fw-bold);">묶어보기</span>' +
                '<div class="edu-groupby" role="group" aria-label="목록 묶음 기준">' +
                    ['dept:부서별', 'hire:채용일별', 'none:안 묶기'].map(function (o) {
                        var k = o.split(':')[0], lb = o.split(':')[1];
                        return '<button type="button" class="' + (state.groupBy === k ? 'active' : '') + '"' +
                            ' aria-pressed="' + (state.groupBy === k ? 'true' : 'false') + '"' +
                            ' onclick="EDUH.setGroupBy(\'' + k + '\')">' + lb + '</button>';
                    }).join('') +
                '</div>' +
            '</div>';

        var allIds = list.map(function (r) { return r.w.id; });
        var allChecked = allIds.length && allIds.every(function (id) { return state.checked[id]; });
        var headerCk = state.tab === 'undone'
            ? '<th style="width:44px;text-align:center;"><input type="checkbox"' + (allChecked ? ' checked' : '') +
                ' onchange="EDUH.toggleAll(this.checked)" title="필터 결과 전체선택/해제" aria-label="필터 결과 전체선택"></th>'
            : '<th style="width:44px;"></th>';

        var body = list.length
            ? groupsOf(list).map(function (g) {
                return (state.groupBy === 'none' ? '' : groupHeadRow(g)) + g.rows.map(rowHtml).join('');
            }).join('')
            : '<tr><td colspan="9"><div class="v2-empty">' +
                (state.tab === 'undone' ? '조건에 맞는 미이수자가 없습니다.' : '조건에 맞는 이수 이력이 없습니다.') +
              '</div></td></tr>';

        state.mount.innerHTML = tabs + filters + groupBar +
            '<div class="edu-card"><div class="edu-scroll"><table class="table-figma table-compact"><thead><tr>' +
                headerCk +
                '<th>이름</th><th>부서</th><th>고용형태</th><th>채용일</th><th>필요시간</th><th>이수일</th><th>상태</th><th></th>' +
            '</tr></thead><tbody>' + body + '</tbody></table></div></div>';
    }

    /* ===== '교육 건' 탭 — 채용시 교육 목록 + 교육별 결재 상신 =====
     * 채용시교육은 근로자 단위 화면이라 그동안 교육 건 목록이 없었고, 그래서 교육별 상신(Type 2)을
     * 걸 자리도 없었다. 실제로는 HIRE 교육 건이 존재하므로(일괄 이수처리=근로자별 1건,
     * 교육 추가=다수 대상 1건) 이 탭에서 건 단위로 노출하고 다른 교육 화면과 같은 컨트롤을 쓴다. */
    function hireCourses() { return E().courses({ kind: ['HIRE'] }); }
    function courseWorkers(c) {
        var ids = {};
        E().enrolls(c.id).forEach(function (e) { (e.workerIds || []).forEach(function (w) { ids[w] = true; }); });
        E().records().forEach(function (r) { if (r.courseId === c.id) ids[r.workerId] = true; });
        return Object.keys(ids).map(function (id) { return E().workerOf(id); }).filter(Boolean);
    }
    function renderCourses() {
        var all = hireCourses();
        var list = all.filter(function (c) {
            if (state.cDept && c.deptId !== state.cDept) return false;
            if (state.cYear && String(c.date || '').slice(0, 4) !== state.cYear) return false;
            return EDUFILTER.match(state.cQ, [c.desc, c.instructor, E().deptName(c.deptId)]);
        });
        var head = EDUFILTER.bar([
            { type: 'search', id: 'eh-c-q', value: state.cQ, placeholder: '교육명·강사 검색', on: "EDUH.setCF('Q', this.value)" },
            { type: 'select', id: 'eh-c-dept', value: state.cDept, label: '부서',
              options: [['', '부서 전체']].concat(E().deptCandidates().map(function (d) { return [d.id, d.name]; })),
              on: "EDUH.setCF('Dept', this.value)" },
            { type: 'select', id: 'eh-c-year', value: state.cYear, label: '연도',
              options: EDUFILTER.yearOptions(all.map(function (c) { return c.date; })),
              on: "EDUH.setCF('Year', this.value)" }
        ], {
            count: list.length, unit: '건', reset: 'EDUH.resetCF()',
            actions: '<button type="button" class="btn btn-primary" onclick="EDUH.openAdd()">＋ 채용시 교육 추가</button>'
        });
        var cards = list.length ? list.map(courseCardHtml).join('')
            : '<div class="edu-card"><div class="v2-empty">' +
                (all.length ? '조건에 맞는 채용시 교육이 없습니다.' : '실시한 채용시 교육이 없습니다. 미이수 탭에서 이수 처리하면 교육 건이 만들어집니다.') +
              '</div></div>';
        return head +
            '<div class="check-notice" style="margin-bottom:12px;">채용시 교육을 <b>건 단위</b>로 보고, 건별로 <b>온나라 결재 상신</b>합니다. ' +
            '대상자 이수 취소는 <b>이수</b> 탭에서 처리합니다.</div>' + cards;
    }
    function courseCardHtml(c) {
        var stChip = '<span class="chip-status chip-sm ' + V().toneOf(c.status === 'DONE' ? '완료' : '진행중') + '">' +
            (c.status === 'DONE' ? '완료' : '진행중') + '</span>';
        var deptChip = c.deptId ? '<span class="chip-status chip-sm neutral" style="margin-right:6px;">' + esc(E().deptName(c.deptId)) + '</span>' : '';
        var ws = courseWorkers(c);
        var names = ws.map(function (w) { return w.name; });
        var apv = global.EDUAPV ? '<span class="edu-apv-slot">' + global.EDUAPV.courseControl(c.id) + '</span>' : '';
        return '<div class="edu-course-card" data-course-id="' + esc(c.id) + '">' +
            '<div class="edu-course-head">' +
                '<div class="edu-course-title">' + deptChip + esc(c.desc) + ' ' + stChip + '</div>' +
                '<div class="edu-course-actions">' + apv + '</div>' +
            '</div>' +
            '<div class="edu-course-meta">' +
                '<span>일시 <b>' + esc(E().courseDateTime(c) || '-') + '</b></span>' +
                '<span>시간 <b>' + c.hours + 'h</b></span>' +
                '<span>강사 <b>' + esc(c.instructor || '-') + '</b></span>' +
                '<span>대상자 <b>' + ws.length + '명</b>' +
                    (names.length ? ' <span style="color:var(--text-gray);">' +
                        esc(names.length > 5 ? names.slice(0, 5).join(', ') + ' 외 ' + (names.length - 5) : names.join(', ')) + '</span>' : '') +
                '</span>' +
            '</div>' +
        '</div>';
    }
    function setCF(k, v) { state['c' + k] = v; EDUFILTER.rerender(render); }
    function resetCF() { state.cQ = ''; state.cDept = ''; state.cYear = ''; render(); }

    /* ===== 묶어보기(그룹) ===== */
    function groupKeyOf(r) {
        return state.groupBy === 'dept' ? r.w.deptId : String(r.w.hireDate || '').slice(0, 7);
    }
    function ymLabel(ym) { var p = String(ym).split('-'); return p.length === 2 ? p[0] + '년 ' + (+p[1]) + '월' : (ym || '채용일 미상'); }
    function groupsOf(list) {
        if (state.groupBy === 'none') return [{ key: '', label: '', rows: list }];
        var map = {};
        list.forEach(function (r) { var k = groupKeyOf(r); (map[k] = map[k] || []).push(r); });
        var keys = Object.keys(map);
        if (state.groupBy === 'dept') keys.sort(function (a, b) { return E().deptName(a).localeCompare(E().deptName(b)); });
        else keys.sort().reverse();
        return keys.map(function (k) {
            return { key: k, label: state.groupBy === 'dept' ? E().deptName(k) : ymLabel(k), rows: map[k] };
        });
    }
    function groupHeadRow(g) {
        var ids = g.rows.map(function (r) { return r.w.id; });
        var allck = (state.tab === 'undone')
            ? '<label class="edu-group-allck"><input type="checkbox"' +
                (ids.length && ids.every(function (id) { return state.checked[id]; }) ? ' checked' : '') +
                ' onchange="EDUH.toggleGroup(\'' + esc(g.key) + '\', this.checked)" aria-label="' + esc(g.label) + ' 그룹 전체선택"> 이 그룹 선택</label>'
            : '';
        return '<tr class="edu-group-row"><td colspan="9"><div class="edu-group-head">' +
            '<span class="edu-group-name">' + esc(g.label) + '</span>' +
            '<span class="edu-group-count">' + g.rows.length + '명</span>' + allck +
        '</div></td></tr>';
    }
    function setGroupBy(g) { state.groupBy = g; render(); }
    function toggleGroup(key, on) {
        rowsForTab().forEach(function (r) {
            if (groupKeyOf(r) !== key) return;
            if (on) state.checked[r.w.id] = true; else delete state.checked[r.w.id];
        });
        render();
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

    /* =============== 채용시 교육 추가 (자체교육과 동일 구성 · EDUFORM) ===============
     * 대상자 = 아직 채용시교육 미이수(hireStatus NONE)인 현업근로자.
     * 이수 시간은 대상자 고용형태별 '필요시간'으로 인정한다(일용 1h · 1주~1개월 4h · 그 밖 8h). */
    function addPool() {
        return E().workers().filter(function (w) { return w.category !== 'SUPERVISOR'; })
            .filter(function (w) { return E().hireStatus(w.id).status === 'NONE'; });
    }
    function openAdd() {
        A = {
            sessions: [EDUFORM.newSession({ start: '09:00', end: '13:00' })], sIdx: 0,
            instructor: '외부위탁', place: '', desc: '채용시 안전보건교육',
            files: [], photos: [], workerIds: {}, deptFilter: ''
        };
        renderAdd();
    }
    function captureAdd() {
        var el = function (id) { return document.getElementById(id); };
        EDUFORM.captureSessions(A);
        if (el('eh-a-inst')) A.instructor = el('eh-a-inst').value.trim();
        if (el('eh-a-place')) A.place = el('eh-a-place').value.trim();
        if (el('eh-a-desc')) A.desc = el('eh-a-desc').value.trim();
    }
    function renderAddTargets() {
        var pool = addPool();
        var deptIds = {};
        pool.forEach(function (w) { deptIds[w.deptId] = true; });
        var deptOpts = ['<option value="">부서 전체 (' + pool.length + '명)</option>'].concat(
            Object.keys(deptIds).sort(function (a, b) { return E().deptName(a).localeCompare(E().deptName(b)); })
                .map(function (d) {
                    var n = pool.filter(function (w) { return w.deptId === d; }).length;
                    return '<option value="' + esc(d) + '"' + (A.deptFilter === d ? ' selected' : '') + '>' + esc(E().deptName(d)) + ' (' + n + '명)</option>';
                })).join('');
        var shown = A.deptFilter ? pool.filter(function (w) { return w.deptId === A.deptFilter; }) : pool;
        var selCnt = Object.keys(A.workerIds).filter(function (k) { return A.workerIds[k]; }).length;

        /* 부서별로 묶어 소제목 + 부서 전체선택 + 멤버 체크박스 (요구3의 부서 묶음 UX를 등록 폼에도 적용) */
        var byDept = {};
        shown.forEach(function (w) { (byDept[w.deptId] = byDept[w.deptId] || []).push(w); });
        var groups = Object.keys(byDept).sort(function (a, b) { return E().deptName(a).localeCompare(E().deptName(b)); });
        var listHtml = shown.length ? groups.map(function (dId) {
            var ws = byDept[dId];
            var allOn = ws.every(function (w) { return A.workerIds[w.id]; });
            var head = '<div class="edu-tg-dept">' +
                '<label class="edu-tg-dept-ck"><input type="checkbox"' + (allOn ? ' checked' : '') +
                    ' onchange="EDUH.aToggleDept(\'' + esc(dId) + '\', this.checked)"> <b>' + esc(E().deptName(dId)) + '</b> <span>(' + ws.length + '명)</span></label>' +
                '</div>';
            var members = ws.map(function (w) {
                var ck = A.workerIds[w.id] ? ' checked' : '';
                var empLabel = E().empLabel(w.empType) + (w.contractMonths ? '[' + w.contractMonths + '개월]' : '');
                return '<label class="edu-tg-member"><input type="checkbox"' + ck +
                    ' onchange="EDUH.aToggle(\'' + w.id + '\', this.checked)">' +
                    '<span>' + esc(w.name) + '</span>' +
                    '<span style="color:var(--text-gray);font-size:var(--fs-12);">' + esc(empLabel) + ' · 채용 ' + esc(w.hireDate) + ' · 필요 ' + E().hireHours(w) + 'h</span>' +
                '</label>';
            }).join('');
            return head + members;
        }).join('') : '<div style="color:var(--text-lightgray);font-size:var(--fs-12);padding:8px;">미이수 대상자가 없습니다.</div>';

        return '<div class="edu-modal-row"><label class="form-label">교육 대상자 (미이수) <span style="color:var(--status-danger-fg)">*</span> ' +
                '<span style="color:var(--text-lightgray);font-weight:var(--fw-regular);">(' + selCnt + '명 선택)</span></label>' +
            '<select class="form-select" style="margin-bottom:8px;" aria-label="대상자 부서 필터" onchange="EDUH.aDept(this.value)">' + deptOpts + '</select>' +
            '<div class="edu-tg-body" style="max-height:220px;">' + listHtml + '</div>' +
        '</div>';
    }
    function renderAdd() {
        var body =
            EDUFORM.renderSessions(A, 'EDUH', { totalCaption: '행사 진행 시간' }) +
            '<div class="check-notice" style="margin-bottom:12px;">이수 시간은 대상자 <b>고용형태별 필요시간</b>으로 인정됩니다 ' +
                '(일용 <b>1h</b> · 1주 초과~1개월 <b>4h</b> · 그 밖 <b>8h</b>). 채용일 이후 이수 시 <b>지연</b>으로 표시됩니다.</div>' +
            '<div class="edu-modal-row"><label class="form-label" for="eh-a-inst">강사·주관</label>' +
                '<input type="text" class="form-input" id="eh-a-inst" value="' + esc(A.instructor) + '"></div>' +
            '<div class="edu-modal-row"><label class="form-label" for="eh-a-place">장소</label>' +
                '<input type="text" class="form-input" id="eh-a-place" value="' + esc(A.place) + '"></div>' +
            '<div class="edu-modal-row"><label class="form-label" for="eh-a-desc">내용 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<textarea class="form-textarea" id="eh-a-desc" rows="2">' + esc(A.desc) + '</textarea></div>' +
            renderAddTargets() +
            EDUFORM.renderAttach(A, 'EDUH');
        V().openModal('채용시 교육 추가', body,
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUH.doAdd()">등록 · 이수 처리</button>');
    }
    /* 회차·첨부 위임 래퍼 (EDUFORM 공용) */
    function sessTab(i) { captureAdd(); A.sIdx = i; renderAdd(); }
    function sessAdd() { captureAdd(); if (!EDUFORM.sessAdd(A)) toast('교육 일자는 최대 ' + EDUFORM.MAX_SESSIONS + '일까지 추가할 수 있습니다.'); renderAdd(); }
    function sessDel(i) { captureAdd(); EDUFORM.sessDel(A, i); renderAdd(); }
    function sessSync() { captureAdd(); renderAdd(); }
    function addFile() { captureAdd(); EDUFORM.addFile(A); renderAdd(); }
    function delFile(i) { captureAdd(); EDUFORM.delFile(A, i); renderAdd(); }
    function addPhoto() { captureAdd(); EDUFORM.addPhoto(A); renderAdd(); }
    function delPhoto(i) { captureAdd(); EDUFORM.delPhoto(A, i); renderAdd(); }
    function aToggle(id, on) { captureAdd(); if (on) A.workerIds[id] = true; else delete A.workerIds[id]; renderAdd(); }
    function aToggleDept(deptId, on) {
        captureAdd();
        addPool().filter(function (w) { return w.deptId === deptId; }).forEach(function (w) {
            if (on) A.workerIds[w.id] = true; else delete A.workerIds[w.id];
        });
        renderAdd();
    }
    function aDept(v) { captureAdd(); A.deptFilter = v; renderAdd(); }
    function doAdd() {
        captureAdd();
        if (!A.desc) { toast('교육 내용을 입력하세요.'); return; }
        var pr = EDUFORM.sessionPayload(A);
        if (!pr.ok) { A.sIdx = pr.badIdx; renderAdd(); toast(pr.msg); return; }
        var S = pr.payload;
        var ids = Object.keys(A.workerIds).filter(function (k) { return A.workerIds[k]; });
        if (!ids.length) { toast('교육 대상자를 1명 이상 선택하세요.'); return; }
        var count = 0, late = 0;
        ids.forEach(function (id) {
            var w = E().workerOf(id); if (!w) return;
            var hours = E().hireHours(w);           /* 인정 = 고용형태별 필요시간 */
            var eventDate = S.date;
            /* 근로자별 개별 course — 이수 취소(removeCourse)가 다른 대상자를 건드리지 않도록 (bulk 패턴과 동일) */
            var c = E().addCourse({
                kind: 'HIRE', deptId: w.deptId, date: eventDate, time: S.time, endTime: S.endTime,
                sessions: S.sessions, hours: hours,
                instructor: A.instructor, place: A.place, desc: A.desc + ' · ' + w.name,
                files: A.files, photos: A.photos, status: 'DONE', createdBy: '재난안전과'
            });
            E().addEnroll({ courseId: c.id, deptId: w.deptId, workerIds: [id], at: eventDate });
            E().addRecord({ workerId: id, courseId: c.id, kind: 'HIRE', hours: hours, date: eventDate });
            if (eventDate > w.hireDate) late++;
            count++;
        });
        V().closeModal();
        toast(count + '명 채용시 교육 등록 · 이수 처리 완료' + (late ? ' · 지연 ' + late + '명' : ''));
        state.tab = 'done'; state.checked = {}; render();
    }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        if (global.EDUAPV) global.EDUAPV.registerRefresh(render);
        render();
    }
    global.EDUH = {
        init: init, setTab: setTab, setF: setF, resetF: resetF,
        /* '교육 건' 탭 — 교육별 결재 상신 */
        setCF: setCF, resetCF: resetCF,
        toggle: toggle, toggleAll: toggleAll,
        setGroupBy: setGroupBy, toggleGroup: toggleGroup,
        openBulk: openBulk, setBulkMode: setBulkMode, doBulk: doBulk,
        confirmUndo: confirmUndo, doUndo: doUndo,
        /* 채용시 교육 추가 (EDUFORM 공용 구성) */
        openAdd: openAdd, doAdd: doAdd, aToggle: aToggle, aToggleDept: aToggleDept, aDept: aDept,
        sessTab: sessTab, sessAdd: sessAdd, sessDel: sessDel, sessSync: sessSync,
        addFile: addFile, delFile: delFile, addPhoto: addPhoto, delPhoto: delPhoto
    };
})(window);
