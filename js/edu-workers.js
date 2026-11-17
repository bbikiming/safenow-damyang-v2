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
    /* 계약기간을 받아야 하는 고용형태 — 채용시교육 필요시간 판정에 쓰인다 */
    function needsContract(emp) { return emp === 'CONTRACT' || emp === 'DAILY'; }
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }

    var state = { mount: null, fDept: '', fCat: '', fEmp: '', fSrc: '', fQ: '', fYear: '', fDuty: '' };
    var F = null;
    var X = null; /* 엑셀 업로드 폼 */

    /* 조회 범위 — 이 화면은 근로자 **개인 정보**(이름·채용일·고용형태·계약기간)를 다룬다.
       종전에는 누구로 접속해도 전 부서 명단이 보였다. 판정은 DYROLE.inScope 한 곳이고
       화면이 p.deptId 로 직접 거르지 않는다(CLAUDE.md §12). 부서별 인원 집계는 이수현황이
       맡으므로 여기서 범위를 좁혀도 총괄 관리가 막히지 않는다. */
    function inScope(deptId) {
        var R = global.DYROLE;
        return !R || !R.inScope || R.inScope(deptId);
    }
    /* ===== 조작 권한 — 판정은 DYEDU(DYROLE.canAct 파생) 한 곳이다 =====
     * 명단 등록·수정·삭제는 그 부서 담당자(주관부서 담당자는 전 부서)가 한다. 관리·감독 계층은
     * 조회만 한다. **관리감독자 지정일은 재난안전과 확인값**이라(SCR-EDU-006 §6) 주관부서
     * 담당자만 넣거나 바꾼다 — 그 날짜가 법정 교육 의무의 기산점이다.
     * 버튼만 감추면 전역 호출로 뚫리므로 진입·저장 함수에도 같은 판정을 건다. */
    function deny(deptId) { toast(E().denyMsg(deptId)); }
    function canDesignate() { return E().canActDept(''); }   /* 빈 부서 = 주관부서 소관 */
    var DESIGNATE_DENY = '관리감독자 지정일은 재난안전과가 지정 사실을 확인해 등록합니다.';
    function render() {
        if (!state.mount) return;
        var all = E().workers().filter(function (w) { return inScope(w.deptId); });
        var list = all.filter(function (w) {
            if (state.fDept && w.deptId !== state.fDept) return false;
            if (state.fCat && w.category !== state.fCat) return false;
            if (state.fEmp && w.empType !== state.fEmp) return false;
            if (state.fSrc && w.source !== state.fSrc) return false;
            if (state.fYear && String(w.hireDate || '').slice(0, 4) !== state.fYear) return false;
            if (state.fDuty === 'any' && !E().isDutyWorker(w)) return false;
            if (state.fDuty === 'none' && !E().dutyMissing(w)) return false;
            if (state.fDuty === 'other' && (E().isDutyWorker(w) || E().dutyMissing(w))) return false;
            if (/^[1-6]$/.test(state.fDuty || '') && (w.duties || []).indexOf(+state.fDuty) === -1) return false;
            return EDUFILTER.match(state.fQ, [w.name, E().deptName(w.deptId)]);
        });

        /* 부서 조건도 조회 범위를 따르고, 고를 부서가 하나뿐이면 두지 않는다(§12 — 2차 통화 검토 C-4) */
        var scopedDepts = E().deptCandidates().filter(function (d) { return inScope(d.id); });
        var head = EDUFILTER.bar([
            { type: 'search', id: 'ew-q', value: state.fQ, placeholder: '이름·부서 검색', on: "EDUW.setF('q', this.value)" },
            scopedDepts.length > 1 ? { type: 'select', id: 'ew-f-dept', value: state.fDept, label: '부서',
              options: [['', '부서 전체']].concat(scopedDepts.map(function (d) { return [d.id, d.name]; })),
              on: "EDUW.setF('dept', this.value)" } : null,
            /* 현업업무(고시 제2020-62호 별표 1) — 업무별 · 종사자만 · 업무 미지정 */
            { type: 'select', id: 'ew-f-duty', value: state.fDuty, label: '현업업무',
              options: [['', '현업업무 전체'], ['any', '현업업무 종사자만'], ['none', '업무 미지정(비사무직)']]
                  .concat(E().DUTY_TYPES.map(function (d) { return [String(d.no), d.short]; })),
              on: "EDUW.setF('duty', this.value)" },
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
            actions: E().canRegister()
                ? '<button type="button" class="btn btn-outline btn-sm" onclick="EDUW.openExcel()">📥 엑셀 업로드</button>' +
                    '<button type="button" class="btn btn-primary" onclick="EDUW.openAdd()">＋ 직접 등록</button>'
                : '<span class="file-hint">명단 등록은 각 부서 담당자가 합니다</span>'
        });

        var rows = list.length ? list.map(rowHtml).join('')
            : '<tr><td colspan="8"><div class="v2-empty">조건에 맞는 근로자가 없습니다.</div></td></tr>';
        /* 명단 이름은 «현업근로자»인데 인사 연동 사무직 공무원도 함께 있다 — 맨 위 한 줄로 나눠 밝힌다(각 수를 누르면 그 필터) */
        var st = E().dutyStats(all);
        var sum = '<p class="file-hint edu-duty-sum">' +
            '<button type="button" class="edu-cancel-link" onclick="EDUW.setF(\'duty\', \'any\')">현업업무 종사자 <b>' + st.duty + '</b>명</button> · ' +
            '<button type="button" class="edu-cancel-link" onclick="EDUW.setF(\'duty\', \'none\')">업무 미지정(비사무직) <b>' + st.missing + '</b>명</button> · ' +
            '<button type="button" class="edu-cancel-link" onclick="EDUW.setF(\'duty\', \'other\')">사무직 등 <b>' + st.other + '</b>명</button>' +
            ' <span>— 현업업무 기준: ' + esc(E().DUTY_SOURCE) + '</span></p>';
        var table =
            '<div class="edu-card"><div class="edu-scroll"><table class="table-figma table-compact"><thead><tr>' +
                '<th>이름</th><th>부서</th><th>구분</th><th>현업업무</th><th>고용형태</th><th>채용일</th><th>관리감독자 지정일</th><th></th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
        /* 관리·감독 계층에는 등록·수정 수단 대신 누가 하는지를 밝힌다(담당자에게는 '') */
        var ro = global.DYROLE && global.DYROLE.readOnlyNote ? global.DYROLE.readOnlyNote('현업근로자 명단 등록·수정') : '';
        state.mount.innerHTML = ro + head + sum + table;
    }
    function rowHtml(w) {
        /* v1.1 §8.5: 자물쇠 제거 · 이름 옆 출처 칩 · 고용형태에 계약기간 병합 */
        var srcLabel = E().srcLabel(w.source);
        var srcChip = '<span class="chip-status chip-sm ' + V().toneOf(srcLabel) + '" style="margin-right:5px;"' +
            (w.source === 'HR' ? ' title="인사정보는 읽기 전용 — 현업업무만 고릅니다"' : '') + '>' + esc(srcLabel) + '</span>';
        var empLabel = E().empLabel(w.empType) + (w.contractMonths ? '[' + w.contractMonths + '개월]' : '');
        var designation = w.category === 'SUPERVISOR'
            ? (w.designatedAt ? esc(w.designatedAt) : '<span class="chip-status chip-sm warning" title="지정일은 재난안전과가 확인해 등록합니다">미등록</span>')
            : '<span style="color:var(--text-gray);font-size:var(--fs-12);">해당 없음</span>';
        /* 지정일 등록은 재난안전과 확인값이라 주관부서 담당자에게만 낸다. 다른 사람에게는 버튼
           대신 누가 등록하는지를 밝힌다(미등록일 때만 — 등록돼 있으면 밝힐 일이 없다) */
        var desig = w.category !== 'SUPERVISOR' ? ''
            : canDesignate()
                ? '<button type="button" class="btn btn-outline btn-sm" onclick="EDUW.openDesignation(\'' + w.id + '\')">지정일 등록</button> '
                : '';   /* 누가 등록하는지는 «미등록» 칩의 title 이 말한다 — 줄마다 같은 문구를 쓰지 않는다 */
        /* 인사 연동분은 인사정보가 읽기 전용이지만 현업업무는 인사 자료에 없어 부서 담당자가 고른다(2차 통화 · 검수 M-4) */
        /* 현업업무는 **그 부서 담당자**가 고른다 — 재난안전과도 남의 부서 사람 업무는 바꾸지 않는다(2차 통화 · 기획 §4) */
        var dutyBtn = E().canActOwnDept(w.deptId)
            ? '<button type="button" class="btn btn-outline btn-sm" onclick="EDUW.openDuty(\'' + w.id + '\')">현업업무</button> ' : '';
        var act = w.source === 'HR'
            /* «인사정보 읽기 전용»을 줄마다 쓰지 않는다 — 이름 옆 출처 칩이 말한다(줄마다 반복된 문구가 1280px 에서 이름·부서를 꺾었다, C-6) */
            ? desig + dutyBtn
            : !E().canActDept(w.deptId) ? ''
            : '<button type="button" class="btn btn-outline btn-sm" onclick="EDUW.openEdit(\'' + w.id + '\')">수정</button>' +
              ' <button type="button" class="btn btn-outline btn-sm" style="border-color:var(--status-danger-border);color:var(--status-danger-fg);" onclick="EDUW.remove(\'' + w.id + '\')">삭제</button>';
        return '<tr>' +
            /* 이름·부서·채용일은 짧은 값이라 꺾지 않는다 — 1280px 에서 2~3줄로 꺾여 표가 길어졌다(C-6) */
            '<td class="edu-name" style="white-space:nowrap;">' + srcChip + esc(w.name) + '</td>' +
            '<td style="white-space:nowrap;">' + esc(E().deptName(w.deptId)) + '</td>' +
            '<td>' + esc(E().catLabel(w.category)) + '</td>' +
            '<td>' + dutyChips(w) + '</td>' +
            '<td>' + esc(empLabel) + '</td>' +
            '<td style="white-space:nowrap;">' + esc(w.hireDate) + '</td>' +
            '<td>' + designation + '</td>' +
            '<td class="col-action">' + act + '</td>' +
        '</tr>';
    }
    /* 현업업무 칩 — 번호만 쓰지 않고 짧은 이름, 고시 문구 전문은 마우스를 올리면(검수 U-1) */
    function dutyChips(w) {
        var ds = w.duties || [];
        if (!ds.length) return w.category === 'FIELD' ? '<span class="chip-status chip-sm warning">업무 미지정</span>' : '<span style="color:var(--text-gray);font-size:var(--fs-12);">—</span>';
        return ds.map(function (n) { var d = E().dutyOf(n); return d ? '<span class="chip-status chip-sm info" title="' + esc(d.no + '. ' + d.text) + '">' + esc(d.short) + '</span>' : ''; }).join(' ');
    }
    /* 등록 창의 현업업무 — 짧은 이름 굵게 + 고시 문구 작게 */
    function dutyFieldHtml(duties, changeAt, needChange, readOnly) {
        return '<div class="edu-modal-row"><label class="form-label">현업업무 ' +
                '<span style="color:var(--text-gray);font-weight:var(--fw-regular);">— ' + esc(E().DUTY_SOURCE) + ' · 구분이 비사무직(현업)이면 1개 이상</span></label>' +
            (readOnly ? '<p class="file-hint" style="margin:0 0 4px;">현업업무는 그 부서 담당자가 고릅니다.</p>' : '') +
            E().DUTY_TYPES.map(function (d) {
                return '<label class="edu-tg-member"><input type="checkbox"' + (duties[d.no] ? ' checked' : '') + (readOnly ? ' disabled' : '') +
                    ' onchange="EDUW.toggleDuty(' + d.no + ', this.checked)"><span><b>' + esc(d.short) + '</b> ' +
                    '<span style="color:var(--text-gray);font-size:var(--fs-12);">' + esc(d.text) + '</span></span></label>';
            }).join('') + '</div>' +
            (needChange
                ? '<div class="edu-modal-row"><label class="form-label" for="ew-dutyat">작업내용 변경일 <span style="color:var(--status-danger-fg)">*</span></label>' +
                    '<input type="date" class="form-input" id="ew-dutyat" value="' + esc(changeAt || '') + '">' +
                    '<p class="file-hint">현업업무를 바꾸면 «변경 전 → 변경 후»가 작업내용 변경 이력에 남고, 기타교육 «작업내용 변경 시 교육» 대상자로 올라옵니다.</p></div>'
                : '');
    }
    function dutyList(map) { return Object.keys(map || {}).filter(function (k) { return map[k]; }).map(Number).sort(); }
    function dutyChanged() { return F && F.origDuties && F.origDuties.length && JSON.stringify(F.origDuties) !== JSON.stringify(dutyList(F.duties)); }
    function toggleDuty(no, on) {
        if (F && F.dutyOnly) { captureDuty(); } else { captureForm(); }
        F.duties[no] = !!on;
        if (F.dutyOnly) renderDuty(); else renderForm();
    }
    function captureDuty() { var el = document.getElementById('ew-dutyat'); if (el) F.dutyChangedAt = el.value; }
    /* 저장이 거절된 이유 — 화면이 아는 이유를 차례로 말한다(«저장하지 못했습니다»로만 끝내지 않는다) */
    function dutyMsg(w, list) {
        if (dutyChanged() && !F.dutyChangedAt) return '현업업무를 바꿨습니다 — 작업내용 변경일을 입력하세요.';
        var why = E().dutyIssue(w.category, list, 'MANUAL');
        if (why) return why;
        return '저장하지 못했습니다 — 계약기간을 확인하세요.';
    }
    function dutyDeny(deptId) { toast('현업업무는 ' + E().deptName(deptId) + ' 담당자가 고릅니다.'); }
    /* 인사 연동 근로자 — 현업업무만 고른다(인사정보는 읽기 전용) */
    function openDuty(id) {
        var w = E().workerOf(id); if (!w) return;
        if (!E().canActOwnDept(w.deptId)) { dutyDeny(w.deptId); return; }
        var map = {}; (w.duties || []).forEach(function (n) { map[n] = true; });
        F = { dutyOnly: true, id: id, name: w.name, deptId: w.deptId, duties: map, origDuties: (w.duties || []).slice(), dutyChangedAt: E().today() };
        renderDuty();
    }
    function renderDuty() {
        V().openModal('현업업무 — ' + esc(F.name),
            '<p class="file-hint" style="margin:0 0 8px;">' + esc(E().deptName(F.deptId)) + ' · 인사정보는 읽기 전용이고 현업업무만 여기서 고릅니다.</p>' +
            dutyFieldHtml(F.duties, F.dutyChangedAt, dutyChanged()),
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUW.saveDuty()">저장</button>');
    }
    function saveDuty() {
        captureDuty();
        var w = E().workerOf(F.id); if (!w) { V().closeModal(); return; }
        if (!E().canActOwnDept(w.deptId)) { V().closeModal(); dutyDeny(w.deptId); return; }
        if (dutyChanged() && !F.dutyChangedAt) { toast('작업내용 변경일을 입력하세요.'); return; }
        var pr = global.DYROLE && global.DYROLE.actorLabel ? global.DYROLE.actorLabel() : '';
        if (!E().updateWorker(F.id, { duties: dutyList(F.duties), dutyChangedAt: F.dutyChangedAt, dutyBy: pr })) { toast(dutyMsg(w, dutyList(F.duties))); return; }
        V().closeModal(); toast('현업업무를 저장했습니다.'); render();
    }
    function setF(k, v) { state['f' + k[0].toUpperCase() + k.slice(1)] = v; EDUFILTER.rerender(render); }
    function resetF() {
        state.fDept = ''; state.fCat = ''; state.fEmp = ''; state.fSrc = ''; state.fQ = ''; state.fYear = ''; state.fDuty = '';
        render();
    }

    /* =============== 등록/수정 모달 =============== */
    function openAdd() {
        if (!E().canRegister()) { deny(E().defaultDeptId()); return; }
        /* 기본 부서는 로그인한 사람의 소속 — 목록 첫 부서를 기본으로 두면 남의 부서 명단에 들어가고,
           조회 범위 밖이라 등록한 본인 목록에서도 사라진다 */
        F = { mode: 'add', name: '', deptId: E().defaultDeptId(), category: 'FIELD', empType: 'CONTRACT', hireDate: E().today(), designatedAt: '', origDesignatedAt: '', contractMonths: 12, duties: {}, origDuties: [], dutyChangedAt: '' };
        renderForm();
    }
    function openEdit(id) {
        var w = E().workerOf(id); if (!w || w.source === 'HR') { toast('인사연동 근로자는 수정할 수 없습니다.'); return; }
        if (!E().canActDept(w.deptId)) { deny(w.deptId); return; }
        var dmap = {}; (w.duties || []).forEach(function (n) { dmap[n] = true; });
        F = { mode: 'edit', id: id, origDeptId: w.deptId, name: w.name, deptId: w.deptId, category: w.category, empType: w.empType, hireDate: w.hireDate, designatedAt: w.designatedAt || '', origDesignatedAt: w.designatedAt || '', contractMonths: w.contractMonths || 0, duties: dmap, origDuties: (w.duties || []).slice(), dutyChangedAt: E().today() };
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
                    /* 부서는 주관부서 담당자만 고른다 — 그 밖의 담당자는 소속 부서로 고정 */
                    (E().canPickDept() ? '<button type="button" class="btn btn-sm btn-outline" onclick="ORGPICK.toggle(\'ew-deptfield\',\'deptId\',\'EDUW.pickDept\')">조직도</button>' : '') +
                '</div>' +
                (E().canPickDept() ? '' : '<p class="file-hint">소속 부서 명단에 등록합니다.</p>') +
                '</div></div>' +
            '<div class="edu-modal-row"><label class="form-label" for="ew-cat">구분</label>' +
                '<select class="form-select" id="ew-cat">' + catOpts + '</select></div>' +
            dutyFieldHtml(F.duties, F.dutyChangedAt, dutyChanged(), F.mode === 'edit' && !E().canActOwnDept(F.origDeptId)) +
            '<div class="edu-modal-row"><label class="form-label" for="ew-emp">고용형태</label>' +
                '<select class="form-select" id="ew-emp" onchange="EDUW.setEmp(this.value)">' + empOpts + '</select></div>' +
            '<div class="edu-modal-row"><label class="form-label" for="ew-hire">채용일 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="date" class="form-input" id="ew-hire" value="' + esc(F.hireDate) + '"></div>' +
            '<div class="edu-modal-row"><label class="form-label" for="ew-designated">관리감독자 지정일</label>' +
                /* 재난안전과 확인값 — 주관부서 담당자가 아니면 입력을 막고 누가 넣는지를 밝힌다 */
                '<input type="date" class="form-input" id="ew-designated" value="' + esc(F.designatedAt || '') + '"' + (canDesignate() ? '' : ' disabled') + '>' +
                '<div style="font-size:var(--fs-12);color:var(--text-gray);margin-top:4px;">' +
                    (canDesignate()
                        ? '구분이 관리감독자이면 필수이며, 재난안전과가 지정 사실을 확인해 등록합니다.'
                        : '재난안전과가 지정 사실을 확인해 등록합니다 — 관리감독자 등록은 재난안전과 담당자에게 요청하세요.') +
                '</div></div>' +
            /* 계약기간은 **기간제·일용일 때만** 받는다 — 공무원·공무직에게 계약기간을 물으면
               뜻이 없는 값이 저장되고, 그 값이 채용시교육 필요시간(1/4/8h) 판정에 쓰인다.
               고용형태를 바꾸면 그 값은 저장되지 않는다(doSave 에서 함께 비운다). */
            (needsContract(F.empType)
                ? '<div class="edu-modal-row"><label class="form-label" for="ew-cm">계약기간 (개월) <span style="color:var(--status-danger-fg)">*</span></label>' +
                    '<input type="number" step="0.1" min="0" class="form-input" id="ew-cm" value="' + esc(F.contractMonths) + '">' +
                    '<div style="font-size:var(--fs-12);color:var(--text-gray);margin-top:4px;">채용시교육 필요시간이 갈립니다 — 1주 이하 1h · 1개월 이하 4h · 그 밖 8h</div></div>'
                : '');
        V().openModal(F.mode === 'add' ? '현업근로자 직접 등록' : '현업근로자 정보 수정', body,
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
        if (el('ew-designated') && !el('ew-designated').disabled) F.designatedAt = el('ew-designated').value;
        if (el('ew-cm')) F.contractMonths = parseFloat(el('ew-cm').value) || 0;
        if (el('ew-dutyat')) F.dutyChangedAt = el('ew-dutyat').value;
    }
    function pickDept(id, name) {
        if (!E().canActDept(id)) { deny(id); return; }
        captureForm(); F.deptId = id; renderForm();
    }
    /* 고용형태를 바꾸면 입력칸 구성이 달라지므로 다시 그린다. 다른 칸의 입력값은
       capture 로 보존한다(모달 재렌더 전 capture — 이 코드베이스 관례).
       계약기간을 받지 않는 형태로 바꾸면 **그 값은 버린다** — 남겨 두면 공무원인데
       계약기간이 붙은 레코드가 저장되고, 그 값이 채용시교육 필요시간 판정에 쓰인다. */
    function setEmp(v) {
        captureForm();
        F.empType = v;
        if (!needsContract(v)) F.contractMonths = '';
        renderForm();
    }
    function doSave() {
        captureForm();
        /* 저장 경로에도 같은 판정 — 수정이면 원래 부서와 바꾼 부서 둘 다 내 소관이어야 한다 */
        if (F.mode === 'edit' && !E().canActDept(F.origDeptId)) { deny(F.origDeptId); return; }
        if (!E().canActDept(F.deptId)) { deny(F.deptId); return; }
        if (!F.name) { toast('이름을 입력하세요.'); return; }
        if (!F.hireDate) { toast('채용일을 입력하세요.'); return; }
        /* 지정일을 새로 넣거나 바꾸는 것은 재난안전과 담당자만 — 바꾸지 않은 값은 기존 값으로 본다
           (이름만 고치는 수정까지 막지 않는다). 관리감독자 구분이면 지정일이 필수이므로 결국
           관리감독자 신규 등록은 재난안전과 담당자에게 넘어간다 */
        var desigAfter = F.category === 'SUPERVISOR' ? (F.designatedAt || '') : '';
        if (!canDesignate() && desigAfter !== (F.origDesignatedAt || '')) {
            toast(DESIGNATE_DENY + (F.category === 'SUPERVISOR' ? ' 관리감독자 등록은 재난안전과 담당자에게 요청하세요.' : ''));
            return;
        }
        if (F.category === 'SUPERVISOR' && !F.designatedAt) {
            toast(canDesignate() ? '관리감독자 지정일을 입력하세요.' : DESIGNATE_DENY + ' 관리감독자 등록은 재난안전과 담당자에게 요청하세요.');
            return;
        }
        if (F.category === 'SUPERVISOR' && F.designatedAt > E().today()) { toast('관리감독자 지정일은 미래일 수 없습니다.'); return; }
        if (F.category !== 'SUPERVISOR') F.designatedAt = '';
        /* 계약기간은 **필수 표시(*)만 있고 검증이 없었다**(2026-09-01). 비운 채 저장하면
           captureForm 의 `parseFloat(...) || 0` 이 **0** 을 넣고, 그 0 이 hireHours 의
           `contractMonths <= 0.25`(1주 이하) 갈래에 걸려 **채용시교육 필요시간이 8h 가
           아니라 1h** 가 된다. 그 사람만 틀리는 것이 아니라 이수 판정과 부서별 완료율이
           함께 어긋난다. 화면정의서 SCR-EDU-006 §5 가 「기간제·일용 시 0보다 큰 기간」을
           필수로 규정하므로 정의서가 맞고 구현이 빠져 있던 것이다.
           일용(DAILY)은 hireHours 가 계약기간을 보지 않지만 정의서가 둘 다 요구하므로
           함께 막는다 — 기록으로서의 값이 있고, 고용형태를 기간제로 바꾸는 순간 판정에 쓰인다. */
        if (needsContract(F.empType) && !(F.contractMonths > 0)) {
            toast('계약기간을 0보다 크게 입력하세요 — 채용시교육 필요시간(1·4·8h)이 이 값으로 갈립니다.');
            return;
        }
        /* 현업업무 — 판정은 DYEDU.dutyIssue 한 곳(직접 등록·수정·엑셀이 같은 검사) */
        if (F.mode === 'edit' && dutyChanged() && !E().canActOwnDept(F.origDeptId)) { dutyDeny(F.origDeptId); return; }
        var dWhy = E().dutyIssue(F.category, dutyList(F.duties), 'MANUAL');
        if (dWhy) { toast(dWhy); return; }
        if (dutyChanged() && !F.dutyChangedAt) { toast('현업업무를 바꿨습니다 — 작업내용 변경일을 입력하세요.'); return; }
        var actorNm = global.DYROLE && global.DYROLE.actorLabel ? global.DYROLE.actorLabel() : '';
        if (F.mode === 'add') {
            /* 데이터 계층이 거절하면 저장되지 않는다 — 반환값을 보지 않으면
               «완료» 토스트만 뜨고 명단에는 없는 상태가 된다(화면이 거짓말을 한다). */
            if (!E().addWorker({ name: F.name, deptId: F.deptId, category: F.category, empType: F.empType, hireDate: F.hireDate, designatedAt: F.designatedAt, contractMonths: F.contractMonths, source: 'MANUAL', duties: dutyList(F.duties) })) {
                toast('저장하지 못했습니다 — 계약기간·현업업무를 확인하세요.'); return;
            }
            toast(F.name + ' 근로자 등록 완료');
        } else {
            if (!E().updateWorker(F.id, { name: F.name, deptId: F.deptId, category: F.category, empType: F.empType, hireDate: F.hireDate, designatedAt: F.designatedAt, contractMonths: F.contractMonths, duties: dutyList(F.duties), dutyChangedAt: F.dutyChangedAt, dutyBy: actorNm })) {
                toast('저장하지 못했습니다 — 계약기간·현업업무·변경일을 확인하세요.'); return;
            }
            toast('근로자 정보 저장');
        }
        V().closeModal(); render();
    }
    function remove(id) {
        var w = E().workerOf(id); if (!w) return;
        if (!E().canActDept(w.deptId)) { deny(w.deptId); return; }
        V().openModal('근로자 삭제',
            '<p style="font-size:var(--fs-13);"><b>' + esc(w.name) + '</b> 근로자를 명단에서 제외합니다. 이력은 보존됩니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUW.doRemove(\'' + id + '\')">삭제</button>');
    }
    function doRemove(id) {
        var w = E().workerOf(id);
        if (w && !E().canActDept(w.deptId)) { V().closeModal(); deny(w.deptId); return; }
        E().removeWorker(id);
        V().closeModal();
        toast('근로자를 명단에서 제외했습니다.');
        render();
    }

    function openDesignation(id) {
        var w = E().workerOf(id);
        if (!canDesignate()) { toast(DESIGNATE_DENY); return; }
        if (!w || w.category !== 'SUPERVISOR') { toast('관리감독자 대상이 아닙니다.'); return; }
        V().openModal('관리감독자 지정일 등록',
            '<p style="font-size:var(--fs-13);margin-bottom:10px;"><b>' + esc(w.name) + '</b> · ' + esc(E().deptName(w.deptId)) + '</p>' +
            '<label class="form-label" for="ew-designation-date">지정일 <span style="color:var(--status-danger-fg)">*</span></label>' +
            '<input type="date" class="form-input" id="ew-designation-date" value="' + esc(w.designatedAt || '') + '">' +
            '<p style="font-size:var(--fs-12);color:var(--text-gray);margin-top:6px;">인사 기본정보는 바꾸지 않고 재난안전과 확인값만 저장합니다. 이 날짜부터 12개월마다 정기교육 16시간 이수 여부를 판정합니다. 2027년 1월 1일부터는 해마다(1~12월) 단위로 바뀝니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUW.saveDesignation(\'' + id + '\')">저장</button>');
    }
    function saveDesignation(id) {
        if (!canDesignate()) { V().closeModal(); toast(DESIGNATE_DENY); return; }
        var el = document.getElementById('ew-designation-date');
        var value = el ? el.value : '';
        if (!value) { toast('관리감독자 지정일을 입력하세요.'); return; }
        if (value > E().today()) { toast('관리감독자 지정일은 미래일 수 없습니다.'); return; }
        if (!E().updateWorker(id, { designatedAt: value })) { toast('저장하지 못했습니다.'); return; }
        V().closeModal(); toast('관리감독자 지정일을 저장했습니다.'); render();
    }

    /* =============== 엑셀 업로드 (목업) =============== */
    function openExcel() {
        if (!E().canRegister()) { deny(E().defaultDeptId()); return; }
        X = { deptId: E().defaultDeptId() };
        renderExcel();
    }
    function renderExcel() {
        /* §15 — 화면에 «목업»을 쓰지 않는다. 대신 무엇이 들어가는지 사실대로 밝힌다. */
        V().openModal('엑셀 업로드',
            '<div style="font-size:var(--fs-13);">엑셀 파일 읽기는 파일관리 연계 후 제공됩니다. 지금은 해당 부서에 <b>예시 계약직 근로자 4명</b>을 추가합니다.</div>' +
            '<div class="edu-modal-row" style="margin-top:12px;"><label class="form-label">대상 부서</label>' +
                '<div class="orgpick-field" id="ew-xls-deptfield"><div style="display:flex;gap:8px;align-items:center;">' +
                    '<input type="text" class="form-input" value="' + esc(E().deptName(X.deptId)) + '" readonly aria-label="대상 부서" style="flex:1;background:var(--gray-50);">' +
                    (E().canPickDept() ? '<button type="button" class="btn btn-sm btn-outline" onclick="ORGPICK.toggle(\'ew-xls-deptfield\',\'deptId\',\'EDUW.pickExcelDept\')">조직도</button>' : '') +
                '</div>' +
                (E().canPickDept() ? '' : '<p class="file-hint">소속 부서 명단에 추가합니다.</p>') +
                '</div></div>' +
            /* 업로드 칸은 전 화면 공용 모양 하나(uploadDrop) — 한 개만 받는 자리도 같은 칸이고
               안내만 일괄등록 프로필(xlsx 1개 · 20MB)로 바뀐다(기획확인 4차 D-1, 2026-10-06). */
            '<div class="edu-modal-row"><label class="form-label">파일</label><div>' +
                V().uploadDrop('<b>엑셀 파일을 끌어다 놓거나 눌러서 선택</b>',
                    "DYV2.notReady('엑셀 파일 읽기', '파일관리 연계')", { hint: true, profile: 'bulk' }) +
            '</div></div>' +
            /* 서식에는 부서 열이 없다 — 부서는 위에서 한 번 고른다(기획확인 4차 C-4 · SCR-EDU-006 §5).
               행마다 부서를 적게 하면 조직도와 표기가 어긋난 행이 생기고, 부서 담당자가 남의 부서
               명단을 넣는 경로가 된다. */
            '<p class="file-hint"><b>서식 열</b> 이름 · 구분 · 고용형태 · 채용일 · 계약기간(기간제·일용) · <b>현업업무</b>(1~6 번호, 쉼표로 · 비사무직은 필수) · 관리감독자 지정일(관리감독자) — ' +
                '부서 열은 없습니다. 형식이 맞지 않는 행은 행 번호와 사유를 보여 주고 나머지 행만 반영합니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUW.doExcel()">업로드</button>');
    }
    function pickExcelDept(id, name) {
        if (!E().canActDept(id)) { deny(id); return; }
        X.deptId = id; renderExcel();
    }
    function doExcel() {
        var deptId = X.deptId;
        if (!E().canActDept(deptId)) { V().closeModal(); deny(deptId); return; }
        var sample = ['김대현', '이수정', '박준서', '최은지'].map(function (nm) {
            return {
                name: nm, deptId: deptId, category: 'FIELD', empType: 'CONTRACT',
                hireDate: E().today(), contractMonths: 12, source: 'EXCEL', duties: [1]
            };
        });
        /* 거절된 건은 배열에서 빠지므로 «몇 건이 들어갔나»를 세어 말한다 —
           4건이라고 적어 두면 데이터 계층이 거절해도 4건이라고 말하게 된다 */
        var added = E().bulkAddWorkers(sample);
        var skipped = sample.length - added.length;
        V().closeModal();
        toast(E().deptName(deptId) + ' 부서에 ' + added.length + '명 엑셀 업로드 완료' +
            (skipped ? ' · 제외 ' + skipped + '명(형식 오류)' : ''));
        render();
    }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        /* ?duty=none — 이수현황 «현업업무 미지정 n명»에서 바로 그 사람들로 */
        var qd = new URLSearchParams(location.search).get('duty');
        if (qd) state.fDuty = qd;
        render();
    }
    global.EDUW = {
        setEmp: setEmp,
        init: init, setF: setF, resetF: resetF,
        openAdd: openAdd, openEdit: openEdit, pickDept: pickDept, doSave: doSave, remove: remove, doRemove: doRemove,
        openDesignation: openDesignation, saveDesignation: saveDesignation,
        toggleDuty: toggleDuty, openDuty: openDuty, saveDuty: saveDuty,
        openExcel: openExcel, pickExcelDept: pickExcelDept, doExcel: doExcel
    };
})(window);
