/* =====================================================================
   edu-workers.js · 근로자 명단 관리 (EDU-WORKERS)
   ---------------------------------------------------------------------
   docs/planning/기획-안전보건교육-재설계-v1.md §3.
   · 인사연동분(source='HR'): 읽기 전용 · 이름 옆 [인사연동] 출처 칩 (v1.1 §8.5)
   · 계약직: 부서 담당자 직접 등록 · 엑셀 업로드(목업)
   · 필터: 부서 · 구분 · 고용형태 · 출처 (조회 조건이므로 select 유지, 퇴직자는 숨김)
   표준: 배지 chip-status+DYV2.toneOf · 표 .table-figma · 등록 폼 부서는 ORGPICK('deptId')
   ===================================================================== */
(function (global) {
    'use strict';
    var V = function () { return global.DYV2; };
    var E = function () { return global.DYEDU; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }

    var state = { mount: null, fDept: '', fCat: '', fEmp: '', fSrc: '', fQ: '', fYear: '' };
    var F = null;
    var X = null; /* 엑셀 업로드 폼 */

    function render() {
        if (!state.mount) return;
        var all = E().workers();
        var list = all.filter(function (w) {
            if (state.fDept && w.deptId !== state.fDept) return false;
            if (state.fCat && w.category !== state.fCat) return false;
            if (state.fEmp && w.empType !== state.fEmp) return false;
            if (state.fSrc && w.source !== state.fSrc) return false;
            if (state.fYear && String(w.hireDate || '').slice(0, 4) !== state.fYear) return false;
            return EDUFILTER.match(state.fQ, [w.name, E().deptName(w.deptId)]);
        });

        var head = EDUFILTER.bar([
            { type: 'search', id: 'ew-q', value: state.fQ, placeholder: '이름·부서 검색', on: "EDUW.setF('q', this.value)" },
            { type: 'select', id: 'ew-f-dept', value: state.fDept, label: '부서',
              options: [['', '부서 전체']].concat(E().deptCandidates().map(function (d) { return [d.id, d.name]; })),
              on: "EDUW.setF('dept', this.value)" },
            { type: 'select', id: 'ew-f-cat', value: state.fCat, label: '구분',
              options: [['', '구분 전체']].concat(Object.keys(E().CAT_LABEL).map(function (k) { return [k, E().CAT_LABEL[k]]; })),
              on: "EDUW.setF('cat', this.value)" },
            { type: 'select', id: 'ew-f-emp', value: state.fEmp, label: '고용형태',
              options: [['', '고용형태 전체']].concat(Object.keys(E().EMP_LABEL).map(function (k) { return [k, E().EMP_LABEL[k]]; })),
              on: "EDUW.setF('emp', this.value)" },
            { type: 'select', id: 'ew-f-src', value: state.fSrc, label: '명단 출처',
              options: [['', '출처 전체']].concat(Object.keys(E().SRC_LABEL).map(function (k) { return [k, E().SRC_LABEL[k]]; })),
              on: "EDUW.setF('src', this.value)" },
            { type: 'select', id: 'ew-f-year', value: state.fYear, label: '채용연도',
              options: EDUFILTER.yearOptions(all.map(function (w) { return w.hireDate; }), '채용연도 전체'),
              on: "EDUW.setF('year', this.value)" }
        ], {
            count: list.length + ' / ' + all.length, unit: '명', reset: 'EDUW.resetF()',
            actions: '<button type="button" class="btn btn-outline btn-sm" onclick="EDUW.openExcel()">📥 엑셀 업로드</button>' +
                '<button type="button" class="btn btn-primary" onclick="EDUW.openAdd()">＋ 직접 등록</button>'
        });

        var rows = list.length ? list.map(rowHtml).join('')
            : '<tr><td colspan="6"><div class="v2-empty">조건에 맞는 근로자가 없습니다.</div></td></tr>';
        var table =
            '<div class="edu-card"><div class="edu-scroll"><table class="table-figma table-compact"><thead><tr>' +
                '<th>이름</th><th>부서</th><th>구분</th><th>고용형태</th><th>채용일</th><th></th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
        state.mount.innerHTML = head + table;
    }
    function rowHtml(w) {
        /* v1.1 §8.5: 자물쇠 제거 · 이름 옆 출처 칩 · 고용형태에 계약기간 병합 */
        var srcLabel = E().srcLabel(w.source);
        var srcChip = '<span class="chip-status chip-sm ' + V().toneOf(srcLabel) + '" style="margin-right:5px;">' + esc(srcLabel) + '</span>';
        var empLabel = E().empLabel(w.empType) + (w.contractMonths ? '[' + w.contractMonths + '개월]' : '');
        var act = w.source === 'HR'
            ? '<span style="color:var(--text-lightgray);font-size:var(--fs-12);">읽기 전용</span>'
            : '<button type="button" class="btn btn-outline btn-sm" onclick="EDUW.openEdit(\'' + w.id + '\')">수정</button>' +
              ' <button type="button" class="btn btn-outline btn-sm" style="border-color:var(--status-danger-border);color:var(--status-danger-fg);" onclick="EDUW.remove(\'' + w.id + '\')">삭제</button>';
        return '<tr>' +
            '<td class="edu-name">' + srcChip + esc(w.name) + '</td>' +
            '<td>' + esc(E().deptName(w.deptId)) + '</td>' +
            '<td>' + esc(E().catLabel(w.category)) + '</td>' +
            '<td>' + esc(empLabel) + '</td>' +
            '<td>' + esc(w.hireDate) + '</td>' +
            '<td class="col-action">' + act + '</td>' +
        '</tr>';
    }
    function setF(k, v) { state['f' + k[0].toUpperCase() + k.slice(1)] = v; EDUFILTER.rerender(render); }
    function resetF() {
        state.fDept = ''; state.fCat = ''; state.fEmp = ''; state.fSrc = ''; state.fQ = ''; state.fYear = '';
        render();
    }

    /* =============== 등록/수정 모달 =============== */
    function openAdd() {
        F = { mode: 'add', name: '', deptId: E().deptCandidates()[0].id, category: 'FIELD', empType: 'CONTRACT', hireDate: E().today(), contractMonths: 12 };
        renderForm();
    }
    function openEdit(id) {
        var w = E().workerOf(id); if (!w || w.source === 'HR') { toast('인사연동 근로자는 수정할 수 없습니다.'); return; }
        F = { mode: 'edit', id: id, name: w.name, deptId: w.deptId, category: w.category, empType: w.empType, hireDate: w.hireDate, contractMonths: w.contractMonths || 0 };
        renderForm();
    }
    function renderForm() {
        var catOpts = Object.keys(E().CAT_LABEL).map(function (k) { return '<option value="' + k + '"' + (k === F.category ? ' selected' : '') + '>' + esc(E().CAT_LABEL[k]) + '</option>'; }).join('');
        var empOpts = Object.keys(E().EMP_LABEL).map(function (k) { return '<option value="' + k + '"' + (k === F.empType ? ' selected' : '') + '>' + esc(E().EMP_LABEL[k]) + '</option>'; }).join('');
        var body =
            '<div class="edu-modal-row"><label class="form-label" for="ew-name">이름 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="text" class="form-input" id="ew-name" value="' + esc(F.name) + '"></div>' +
            '<div class="edu-modal-row"><label class="form-label">부서 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<div class="orgpick-field" id="ew-deptfield"><div style="display:flex;gap:8px;align-items:center;">' +
                    '<input type="text" class="form-input" value="' + esc(E().deptName(F.deptId)) + '" readonly aria-label="부서" style="flex:1;background:var(--gray-50);">' +
                    '<button type="button" class="btn btn-sm btn-outline" onclick="ORGPICK.toggle(\'ew-deptfield\',\'deptId\',\'EDUW.pickDept\')">조직도</button>' +
                '</div></div></div>' +
            '<div class="edu-modal-row"><label class="form-label" for="ew-cat">구분</label>' +
                '<select class="form-select" id="ew-cat">' + catOpts + '</select></div>' +
            '<div class="edu-modal-row"><label class="form-label" for="ew-emp">고용형태</label>' +
                '<select class="form-select" id="ew-emp">' + empOpts + '</select></div>' +
            '<div class="edu-modal-row"><label class="form-label" for="ew-hire">채용일 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="date" class="form-input" id="ew-hire" value="' + esc(F.hireDate) + '"></div>' +
            '<div class="edu-modal-row"><label class="form-label" for="ew-cm">계약기간 (개월, 기간제만)</label>' +
                '<input type="number" step="0.1" class="form-input" id="ew-cm" value="' + esc(F.contractMonths) + '"></div>';
        V().openModal(F.mode === 'add' ? '근로자 직접 등록' : '근로자 정보 수정', body,
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUW.doSave()">' + (F.mode === 'add' ? '등록' : '저장') + '</button>');
    }
    /* 재렌더 전 입력값 보존 (부서 선택 시 타이핑 값 유실 방지) */
    function captureForm() {
        var el = function (id) { return document.getElementById(id); };
        if (el('ew-name')) F.name = el('ew-name').value.trim();
        if (el('ew-cat')) F.category = el('ew-cat').value;
        if (el('ew-emp')) F.empType = el('ew-emp').value;
        if (el('ew-hire')) F.hireDate = el('ew-hire').value;
        if (el('ew-cm')) F.contractMonths = parseFloat(el('ew-cm').value) || 0;
    }
    function pickDept(id, name) { captureForm(); F.deptId = id; renderForm(); }
    function doSave() {
        captureForm();
        if (!F.name) { toast('이름을 입력하세요.'); return; }
        if (!F.hireDate) { toast('채용일을 입력하세요.'); return; }
        if (F.mode === 'add') {
            E().addWorker({ name: F.name, deptId: F.deptId, category: F.category, empType: F.empType, hireDate: F.hireDate, contractMonths: F.contractMonths, source: 'MANUAL' });
            toast(F.name + ' 근로자 등록 완료');
        } else {
            E().updateWorker(F.id, { name: F.name, deptId: F.deptId, category: F.category, empType: F.empType, hireDate: F.hireDate, contractMonths: F.contractMonths });
            toast('근로자 정보 저장');
        }
        V().closeModal(); render();
    }
    function remove(id) {
        var w = E().workerOf(id); if (!w) return;
        V().openModal('근로자 삭제',
            '<p style="font-size:var(--fs-13);"><b>' + esc(w.name) + '</b> 근로자를 명단에서 제외합니다. 이력은 보존됩니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUW.doRemove(\'' + id + '\')">삭제</button>');
    }
    function doRemove(id) {
        E().removeWorker(id);
        V().closeModal();
        toast('근로자를 명단에서 제외했습니다.');
        render();
    }

    /* =============== 엑셀 업로드 (목업) =============== */
    function openExcel() {
        X = { deptId: E().deptCandidates()[0].id };
        renderExcel();
    }
    function renderExcel() {
        V().openModal('엑셀 업로드 (목업)',
            '<div style="font-size:var(--fs-13);">엑셀 템플릿을 업로드하면 해당 부서에 <b>4명</b>의 계약직 샘플 근로자를 추가합니다.</div>' +
            '<div class="edu-modal-row" style="margin-top:12px;"><label class="form-label">대상 부서</label>' +
                '<div class="orgpick-field" id="ew-xls-deptfield"><div style="display:flex;gap:8px;align-items:center;">' +
                    '<input type="text" class="form-input" value="' + esc(E().deptName(X.deptId)) + '" readonly aria-label="대상 부서" style="flex:1;background:var(--gray-50);">' +
                    '<button type="button" class="btn btn-sm btn-outline" onclick="ORGPICK.toggle(\'ew-xls-deptfield\',\'deptId\',\'EDUW.pickExcelDept\')">조직도</button>' +
                '</div></div></div>' +
            '<div class="edu-modal-row"><label class="form-label">파일</label>' +
                '<button type="button" class="btn btn-sm btn-outline" onclick="DYV2.toast(\'엑셀 첨부됨 (프로토타입)\')">＋ 파일 선택</button></div>' +
            V().fileHint(),
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUW.doExcel()">업로드</button>');
    }
    function pickExcelDept(id, name) { X.deptId = id; renderExcel(); }
    function doExcel() {
        var deptId = X.deptId;
        var sample = ['김대현', '이수정', '박준서', '최은지'].map(function (nm) {
            return {
                name: nm, deptId: deptId, category: 'FIELD', empType: 'CONTRACT',
                hireDate: E().today(), contractMonths: 12, source: 'EXCEL'
            };
        });
        E().bulkAddWorkers(sample);
        V().closeModal();
        toast(E().deptName(deptId) + ' 부서에 4명 엑셀 업로드 완료');
        render();
    }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        render();
    }
    global.EDUW = {
        init: init, setF: setF, resetF: resetF,
        openAdd: openAdd, openEdit: openEdit, pickDept: pickDept, doSave: doSave, remove: remove, doRemove: doRemove,
        openExcel: openExcel, pickExcelDept: pickExcelDept, doExcel: doExcel
    };
})(window);
