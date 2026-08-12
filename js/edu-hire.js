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

    var state = { mount: null, tab: 'all', fDept: '', fEmp: '', fQ: '', fYear: '', fDone: '', groupBy: 'dept', checked: {} };
    /* tab: 'all' 전체 | 'undone' 미이수 | 'done' 이수
     *   ※ 구 '교육 건' 탭은 2026-07-30 회의에서 제거 확정 — 발주처: "이 교육 건 지워버리고
     *      미이수랑 이수만 나오게끔… 전체가 200명, 미이수 50명, 이수 150명 그런 식으로".
     *      다시 만들지 말 것. 채용시교육의 공문은 **이수 처리된 교육 건 단위**로 기안한다(SCR-EDU-002 §6).
     * groupBy: 'dept' 부서별 | 'hire' 채용일(월)별 | 'none' 안 묶기 */
    var B = null; /* 일괄 이수처리 폼 */
    var A = null; /* 채용시 교육 추가 폼 (자체교육과 동일 구성 · EDUFORM) */

    /* 탭 필터만 적용한 원본 (연도 옵션 파생용) */
    function tabRows() {
        var arr = E().workers().filter(function (w) { return w.category !== 'SUPERVISOR'; }).map(function (w) {
            return { w: w, hs: E().hireStatus(w.id) };
        });
        if (state.tab === 'all') return arr;
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

        /* 전체 / 미이수 / 이수 — 세 숫자를 그대로 보여주는 것이 요구사항이다
         * (발주처: "전체가 200명, 미이수 50명, 이수 150명 그런 식으로 숫자를 이렇게 표현") */
        var tabs =
            '<div class="sub-tabs" style="margin-bottom:12px;">' +
                ['all:전체', 'undone:미이수', 'done:이수'].map(function (o) {
                    var k = o.split(':')[0], lb = o.split(':')[1];
                    return '<button type="button" class="sub-tab' + (state.tab === k ? ' active' : '') +
                        '" onclick="EDUH.setTab(\'' + k + '\')">' + lb +
                        ' <span class="count">' + tabCount(k) + '</span></button>';
                }).join('') +
            '</div>';

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
                (state.tab === 'undone' ? '조건에 맞는 미이수자가 없습니다.'
                    : state.tab === 'done' ? '조건에 맞는 이수 이력이 없습니다.'
                    : '조건에 맞는 대상자가 없습니다.') +
              '</div></td></tr>';

        state.mount.innerHTML = tabs + filters + groupBar +
            '<div class="edu-card"><div class="edu-scroll"><table class="table-figma table-compact"><thead><tr>' +
                headerCk +
                '<th>이름</th><th>부서</th><th>고용형태</th><th>채용일</th><th>필요시간</th><th>이수일</th><th>상태</th><th></th>' +
            '</tr></thead><tbody>' + body + '</tbody></table></div></div>';
    }

    /* courseWorkers — 이수 수정·회수 시 "그 교육 건에 다른 대상자가 남아 있는지" 판정에 쓴다.
     * (구 '교육 건' 탭과 그 필터·카드 렌더러는 2026-07-30 회의 지시로 제거됨 — 부활 금지) */
    function courseWorkers(c) {
        var ids = {};
        E().enrolls(c.id).forEach(function (e) { (e.workerIds || []).forEach(function (w) { ids[w] = true; }); });
        E().records().forEach(function (r) { if (r.courseId === c.id) ids[r.workerId] = true; });
        return Object.keys(ids).map(function (id) { return E().workerOf(id); }).filter(Boolean);
    }

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
        var arr = E().workers().filter(function (w) { return w.category !== 'SUPERVISOR'; });
        if (tab === 'all') return arr.length;
        return arr.filter(function (w) {
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
            '<td class="col-action">' + (hs.status !== 'NONE' ? editBtnHtml(w) + ' ' + docBtnHtml(w) : '') + '</td>' +
        '</tr>';
    }
    /* 이수 기록 손보기 — '취소'가 아니라 '수정'이다.
     * 발주처: "왜 취소는 왜 할 필요가 왜 있는지 모르겠네. 수정을 차라리 수정 버튼을 누르는 게 낫지"
     * 결재가 올라간 뒤에는 잠긴다(EDUDOC.lockOf 단일 판정). */
    function lockOf(workerId) {
        /* 잠금은 그 사람이 이수한 **교육 건**의 공문이 건다 — 개인 단위 결재는 없다.
           판정은 EDUDOC.lockOf 한 곳이고 여기서는 결과만 쓴다. */
        if (!global.EDUDOC || !global.EDUDOC.lockOf) return null;
        var recs = E().records().filter(function (r) { return r.workerId === workerId && r.kind === 'HIRE'; });
        for (var i = 0; i < recs.length; i++) {
            var lk = global.EDUDOC.lockOf(recs[i].courseId);
            if (lk) return lk;
        }
        return null;
    }
    /* 공문 — 채용시교육은 사람 행 화면이라 교육 카드가 없다. 그 사람이 이수한
       **교육 건**의 공문으로 연결한다(단위는 교육 1건, SCR-EDU-002 §6).
       한 건에 여러 명이 묶인 경우 같은 공문을 공유한다 — 건이 하나이기 때문이다. */
    function docCourseOf(workerId) {
        var recs = E().records().filter(function (r) { return r.workerId === workerId && r.kind === 'HIRE'; });
        return recs.length ? recs[recs.length - 1].courseId : '';
    }
    function docBtnHtml(w) {
        if (!global.EDUDOC) return '';
        var cid = docCourseOf(w.id);
        if (!cid) return '';
        return '<span class="edu-doc-slot">' + global.EDUDOC.control(cid) + '</span>';
    }
    function editBtnHtml(w) {
        var lock = lockOf(w.id);
        if (lock) {
            return '<button type="button" class="btn btn-outline btn-sm" disabled title="결재 ' + esc(lock) +
                ' — 공문 기록이 남아 수정할 수 없습니다">🔒 ' + esc(lock) + '</button>';
        }
        return '<button type="button" class="btn btn-outline btn-sm" onclick="EDUH.openEditDone(\'' + w.id + '\')">이수 수정</button>';
    }

    /* =============== 이수 수정 =============== */
    /* 이수일을 고치는 것이 기본 경로이고, 기록 자체를 물릴 때만 아래 회수 경로로 내려간다.
     * (회수 경로 자체는 CLAUDE.md §4 'CRUD 는 회수 경로까지 갖춘다' 때문에 남긴다 —
     *  시연을 반복하면 데이터가 쌓여 발표가 망가지므로 지울 수단이 반드시 있어야 한다.
     *  다만 전면에 노출하는 라벨은 발주처 지시대로 '수정'이다.) */
    function openEditDone(workerId) {
        var w = E().workerOf(workerId); if (!w) return;
        var lock = lockOf(workerId);
        if (lock) { toast('결재 ' + lock + ' 상태라 수정할 수 없습니다 — 반려 후 다시 시도하세요.'); return; }
        var hs = E().hireStatus(workerId);
        var recs = E().records().filter(function (r) { return r.workerId === workerId && r.kind === 'HIRE'; });
        V().openModal('채용시교육 이수 수정',
            '<p style="font-size:var(--fs-13);"><b>' + esc(w.name) + '</b> (' + esc(E().deptName(w.deptId)) + ') · 채용일 ' + esc(w.hireDate || '-') + '</p>' +
            '<div class="edu-modal-row"><label class="form-label" for="eh-ed-date">이수일</label>' +
                '<input type="date" class="form-input" id="eh-ed-date" value="' + esc(hs.lastDate || '') + '"></div>' +
            '<div class="edu-modal-row"><label class="form-label">인정 시간</label>' +
                '<p style="font-size:var(--fs-13);margin:0;"><b>' + hs.done + 'h</b> / 필요 ' + hs.need + 'h ' +
                '<span style="color:var(--text-gray);">(이수기록 ' + recs.length + '건 · 시간은 교육 건의 회차에서 파생됩니다)</span></p></div>' +
            '<div class="check-notice" style="margin-top:10px;">결재 상신 후에는 공문 기록이 남아 <b>수정할 수 없습니다</b>. 상신 전에 확정하세요.</div>',
            '<button type="button" class="btn btn-outline" style="border-color:var(--status-danger-border);color:var(--status-danger-fg);margin-right:auto;" onclick="EDUH.confirmUndo(\'' + workerId + '\')">이수 기록 삭제</button>' +
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUH.saveEditDone(\'' + workerId + '\')">저장</button>');
    }
    function saveEditDone(workerId) {
        var el = document.getElementById('eh-ed-date');
        var d = el ? el.value : '';
        if (!d) { toast('이수일을 입력하세요.'); if (el) el.focus(); return; }
        E().records().forEach(function (r) {
            if (r.workerId === workerId && r.kind === 'HIRE') r.date = d;
        });
        E().save();
        V().closeModal();
        toast('이수일을 ' + d + ' 로 수정했습니다.');
        render();
    }

    /* --- 회수(삭제) 경로 — '이수 수정' 모달 안에서만 들어온다 --- */
    /* 그 근로자의 채용시교육 이수기록만 회수해 '미이수'로 되돌린다.
     * 묶인 교육 건(일괄 이수처리 '한 건으로 묶기')은 통째로 지우면 다른 대상자의 이수까지
     * 사라지므로, DYEDU.removeWorkerFromCourse 로 본인 몫만 빼고 남은 대상자가 없을 때만 건을 회수한다. */
    function coursesOfWorker(workerId) {
        return E().courses({ kind: ['HIRE'] }).filter(function (c) {
            var inEnroll = E().enrolls(c.id).some(function (e) { return (e.workerIds || []).indexOf(workerId) !== -1; });
            var inRecord = E().records().some(function (r) { return r.courseId === c.id && r.workerId === workerId; });
            return inEnroll || inRecord;
        });
    }
    function confirmUndo(workerId) {
        var w = E().workerOf(workerId); if (!w) return;
        var mine = coursesOfWorker(workerId);
        if (!mine.length) { toast('되돌릴 채용시교육 이수 건이 없습니다.'); return; }
        /* 본인 외 대상자가 남는 교육 건(묶인 건)은 삭제되지 않고 유지됨을 명시한다 */
        var shared = mine.filter(function (c) {
            return courseWorkers(c).filter(function (x) { return x.id !== workerId; }).length > 0;
        }).length;
        var hours = E().records().filter(function (r) {
            return r.workerId === workerId && r.kind === 'HIRE';
        }).reduce(function (n, r) { return n + (r.hours || 0); }, 0);
        V().openModal('채용시교육 이수 취소',
            '<p style="font-size:var(--fs-13);"><b>' + esc(w.name) + '</b> (' + esc(E().deptName(w.deptId)) + ')</p>' +
            '<div class="check-notice" style="margin-top:10px;">교육 <b>' + mine.length + '건</b>에서 이 대상자의 이수기록(<b>' + hours + 'h</b>)만 회수되어 <b>미이수</b> 상태로 돌아갑니다.' +
                (shared ? ' 다른 대상자가 함께 묶인 <b>' + shared + '건</b>은 삭제되지 않고 유지됩니다.' : ' 대상자가 본인뿐인 교육 건은 함께 삭제됩니다.') +
            '</div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUH.doUndo(\'' + workerId + '\')">이수 취소</button>');
    }
    function doUndo(workerId) {
        var mine = coursesOfWorker(workerId);
        var recs = 0, removed = 0;
        mine.forEach(function (c) {
            var res = E().removeWorkerFromCourse(c.id, workerId);
            recs += res.records;
            if (res.courseRemoved) removed++;
        });
        V().closeModal();
        toast('이수기록 ' + recs + '건 회수 · 미이수로 되돌렸습니다' + (removed ? ' (빈 교육 건 ' + removed + '건 삭제)' : ''));
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
            /* merge — 교육 건 생성 방식. false=근로자별 개별 건(기본) · true=한 건으로 묶기.
             * 묶으려면 이수일이 하나여야 하므로 '일괄 이수일 지정'과 함께만 성립한다. */
            merge: false,
            date: E().today(), time: '09:00',
            instructor: '외부위탁',
            desc: '채용시 안전보건교육 (일괄 이수처리)'
        };
        renderBulk();
    }
    /* 묶기 시 생성 단위 — 필요시간(1h·4h·8h)이 다르면 법정 교육시간이 다른 별개 과정이므로 건을 나눈다 */
    function bulkGroups() {
        var map = {};
        B.ids.forEach(function (id) {
            var w = E().workerOf(id); if (!w) return;
            var h = E().hireHours(w);
            (map[h] = map[h] || []).push(id);
        });
        return Object.keys(map).map(Number).sort(function (a, b) { return b - a; })
            .map(function (h) { return { hours: h, ids: map[h] }; });
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
            /* 교육 건 생성 방식 — 개별/묶기. 묶기는 이수일이 하나여야 성립하므로 일괄 이수일과 함께 쓴다. */
            '<div class="edu-modal-row"><label class="form-label">교육 건 생성 방식</label>' +
                '<label style="display:flex;align-items:center;gap:6px;font-size:var(--fs-12);padding:4px 0;">' +
                    '<input type="radio" name="eh-merge"' + (!B.merge ? ' checked' : '') + ' onchange="EDUH.setBulkMerge(false)"> ' +
                    '<b>근로자별 개별 건</b> (기본 · 1명당 교육 건 1개)' +
                '</label>' +
                '<label style="display:flex;align-items:center;gap:6px;font-size:var(--fs-12);padding:4px 0;">' +
                    '<input type="radio" name="eh-merge"' + (B.merge ? ' checked' : '') + ' onchange="EDUH.setBulkMerge(true)"> ' +
                    '<b>한 건으로 묶기</b> <span style="color:var(--text-gray);">(선택 시 일괄 이수일로 전환됩니다)</span>' +
                '</label>' +
                (B.merge
                    ? '<div class="check-notice" style="margin-top:6px;">필요시간(1h·4h·8h)이 다른 인원은 <b>법정 교육시간이 다른 별개 과정</b>이라 건이 나뉩니다. ' +
                        '<b>예상 생성 ' + bulkGroups().length + '건</b> — ' +
                        bulkGroups().map(function (g) { return g.hours + 'h ' + g.ids.length + '명'; }).join(' · ') + '</div>'
                    : '') +
            '</div>' +
            '<div class="edu-modal-row"><label class="form-label" for="eh-b-inst">강사·주관</label>' +
                '<input type="text" class="form-input" id="eh-b-inst" value="' + esc(B.instructor) + '"></div>' +
            '<div class="edu-modal-row"><label class="form-label" for="eh-b-desc">내용</label>' +
                '<textarea class="form-textarea" id="eh-b-desc" rows="2">' + esc(B.desc) + '</textarea></div>';
        V().openModal('선택 이수처리 · ' + B.ids.length + '명', body,
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUH.doBulk()">이수 처리</button>');
    }
    /* 각자 채용일로 되돌리면 이수일이 사람마다 달라지므로 묶기는 자동 해제된다 */
    function setBulkMode(useHire) { captureBulk(); B.useHireDate = useHire; if (useHire) B.merge = false; renderBulk(); }
    /* 묶기를 켜면 이수일이 하나여야 하므로 일괄 이수일 모드로 전환한다 */
    function setBulkMerge(on) { captureBulk(); B.merge = on; if (on) B.useHireDate = false; renderBulk(); }
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
        var count = 0, made = 0;

        if (B.merge) {
            /* 한 건으로 묶기 — 필요시간이 같은 인원끼리 교육 건 1개.
             * 여러 부서가 섞이므로 deptId 는 비우고(집합교육과 동일) 부서별 신청 행으로 나눈다. */
            bulkGroups().forEach(function (g) {
                var c = E().addCourse({
                    kind: 'HIRE', deptId: '', date: B.date, time: B.time, hours: g.hours,
                    instructor: B.instructor, place: '',
                    desc: B.desc + ' (' + g.hours + 'h · ' + g.ids.length + '명)',
                    status: 'DONE', createdBy: '재난안전과 (일괄)'
                });
                var byDept = {};
                g.ids.forEach(function (id) {
                    var w = E().workerOf(id); if (!w) return;
                    (byDept[w.deptId] = byDept[w.deptId] || []).push(id);
                });
                Object.keys(byDept).forEach(function (d) {
                    E().addEnroll({ courseId: c.id, deptId: d, workerIds: byDept[d], at: B.date });
                });
                g.ids.forEach(function (id) {
                    E().addRecord({ workerId: id, courseId: c.id, kind: 'HIRE', hours: g.hours, date: B.date });
                    count++;
                });
                made++;
            });
        } else {
            B.ids.forEach(function (id) {
                var w = E().workerOf(id); if (!w) return;
                var hours = E().hireHours(w);
                var date = B.useHireDate ? w.hireDate : B.date;
                var time = B.useHireDate ? '' : B.time; /* 각자 채용일 처리 시 시간 정보 없음 */
                /* 근로자별 개별 course (묶기를 끄면 종전 동작) */
                var c = E().addCourse({
                    kind: 'HIRE', deptId: w.deptId, date: date, time: time, hours: hours,
                    instructor: B.instructor, place: '', desc: B.desc + ' · ' + w.name,
                    status: 'DONE', createdBy: '재난안전과 (일괄)'
                });
                E().addEnroll({ courseId: c.id, deptId: w.deptId, workerIds: [id], at: date });
                E().addRecord({ workerId: id, courseId: c.id, kind: 'HIRE', hours: hours, date: date });
                count++; made++;
            });
        }
        V().closeModal();
        toast(count + '명 채용시교육 이수 처리 완료 · 교육 건 ' + made + '건 생성');
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
        }).join('') : '<div style="color:var(--text-gray);font-size:var(--fs-12);padding:8px;">미이수 대상자가 없습니다.</div>';

        return '<div class="edu-modal-row"><label class="form-label">교육 대상자 (미이수) <span style="color:var(--status-danger-fg)">*</span> ' +
                '<span style="color:var(--text-gray);font-weight:var(--fw-regular);">(' + selCnt + '명 선택)</span></label>' +
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
            EDUFORM.renderAttach(A, 'EDUH', 'done');
        V().openModal('채용시 교육 추가', body,
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUH.doAdd()">등록 · 이수 처리</button>');
    }
    /* 회차·첨부 위임 래퍼 (EDUFORM 공용) */
    function sessTab(i) { captureAdd(); A.sIdx = i; renderAdd(); }
    function sessAdd() { captureAdd(); if (!EDUFORM.sessAdd(A)) toast('교육 일자는 최대 ' + EDUFORM.MAX_SESSIONS + '일까지 추가할 수 있습니다.'); renderAdd(); }
    function sessDel(i) { captureAdd(); EDUFORM.sessDel(A, i); renderAdd(); }
    function sessSync() { captureAdd(); renderAdd(); }
    function addFile(slot) { captureAdd(); EDUFORM.addFile(A, slot); renderAdd(); }
    function delFile(i) { captureAdd(); EDUFORM.delFile(A, i); renderAdd(); }
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
        if (global.EDUDOC) global.EDUDOC.registerRefresh(render);
        render();
    }
    global.EDUH = {
        init: init, setTab: setTab, setF: setF, resetF: resetF,
        toggle: toggle, toggleAll: toggleAll,
        setGroupBy: setGroupBy, toggleGroup: toggleGroup,
        openBulk: openBulk, setBulkMode: setBulkMode, setBulkMerge: setBulkMerge, doBulk: doBulk,
        /* 이수 수정(기본) → 그 안에서만 회수(삭제)로 내려간다 */
        openEditDone: openEditDone, saveEditDone: saveEditDone,
        confirmUndo: confirmUndo, doUndo: doUndo,
        /* 채용시 교육 추가 (EDUFORM 공용 구성) */
        openAdd: openAdd, doAdd: doAdd, aToggle: aToggle, aToggleDept: aToggleDept, aDept: aDept,
        sessTab: sessTab, sessAdd: sessAdd, sessDel: sessDel, sessSync: sessSync,
        addFile: addFile, delFile: delFile
    };
})(window);
