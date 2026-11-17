/* =====================================================================
   edu-hire.js · 채용시교육 (EDU-HIRE, v1.1 §8.5)
   ---------------------------------------------------------------------
   · 근로자 신규 등록/엑셀 시 채용시교육 항목이 자동으로 '미이수' 상태로 표시(별도 DB 스키마 없이 hireStatus 파생).
   · 탭: 전체 / 미이수 / 이수 (.sub-tabs + .count) — 2026-07-30 회의
   · 필터: 부서 · 고용형태 (가로 배치 — 조회 조건이므로 select 유지)
   · 미이수 탭: 필터 결과 헤더 체크박스로 전체선택 + [선택 교육기록 등록] → 실제 교육일·시간·증빙 등록
   표준: 배지 chip-status+DYV2.toneOf · 표 .table-figma(.table-compact) · 빈상태 .v2-empty
   ===================================================================== */
(function (global) {
    'use strict';
    var V = function () { return global.DYV2; };
    var E = function () { return global.DYEDU; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }

    /* 모집단 플래그 — 관리감독자 채용시교육(edu-sup-hire)이 같은 모듈을 재사용한다.
       별표4 제1호(근로자)와 제1호의2(관리감독자)가 다른 표라 필요시간·기준일이 갈린다.
       화면을 새로 만들지 않고 정기·기타 교육과 같은 방식으로 플래그만 얹는다(CLAUDE.md §4). */
    var SUP_MODE = false;
    /* 조회 범위 — 이 화면은 이름·채용일·고용형태를 사람 단위로 보여 준다. 같은 개인정보를
       다루는 근로자 명단 관리가 소속 부서로 좁혀져 있는데 여기만 전 부서가 보이면 두 화면이
       어긋나고 범위 제한이 무의미해진다(2026-09-28 권한별 QA). 판정은 DYROLE.inScope 한 곳이고
       탭 건수·추가 대상자·일괄 대상이 전부 이 모집단에서 파생되므로 여기 한 곳만 거른다. */
    function inScope(deptId) {
        var R = global.DYROLE;
        return !R || !R.inScope || R.inScope(deptId);
    }
    function pool() {
        return E().workers().filter(function (w) {
            if (!inScope(w.deptId)) return false;
            return SUP_MODE ? w.category === 'SUPERVISOR' : w.category !== 'SUPERVISOR';
        });
    }
    /* ===== 조작 권한 — 판정은 DYEDU(DYROLE.canAct 파생) 한 곳이다 =====
     * 이수 기록의 등록·수정·회수는 그 사람이 속한 부서의 담당자(주관부서 담당자는 전 부서)가
     * 한다. 관리·감독 계층은 조회만 한다. 진입·저장 양쪽에 같은 판정을 건다. */
    function deny(deptId) { toast(E().denyMsg(deptId)); }
    /* 채용시교육 기록은 그 사람 **소속 부서 담당자**가 올리고 고친다 — 재난안전과도 남의 부서 기록은 올리지 않는다.
       기록은 그 부서가 실시 결과 보고 공문으로 보내기 때문이다(2026-11-16 · 기획 v2 §10 N) */
    function canActWorker(workerId) { var w = E().workerOf(workerId); return !!w && E().canActOwnDept(w.deptId); }
    /* 기록의 등록 주체 표기 — '재난안전과'로 박으면 부서 담당자가 올린 기록도 재난안전과가 올린 것이 된다 */
    function actorDept() {
        var p = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        return (p && p.deptName) || '재난안전과';
    }
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
        var arr = pool().map(function (w) {
            return { w: w, hs: E().hireStatus(w.id) };
        });
        if (state.tab === 'all') return arr;
        /* **판정 불가(기준일 미등록)는 두 탭 어디에도 넣지 않는다.** 이수로 넣으면 하지
           않은 교육을 했다고 하는 것이고, 미이수로 넣으면 대상인지도 모르는 사람에게
           의무를 지우는 것이다. 전체 탭에서만 보이고 그 사실이 상태 배지에 드러난다. */
        return state.tab === 'undone'
            ? arr.filter(function (r) { return r.hs.status === 'NONE'; })
            : arr.filter(function (r) { return r.hs.status === 'BEFORE' || r.hs.status === 'LATE_DONE' || r.hs.status === 'UNKNOWN_DONE'; });
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

        var scopedDepts = E().deptCandidates().filter(function (d) { return inScope(d.id); });
        var fields = [
            { type: 'search', id: 'eh-q', value: state.fQ, placeholder: '이름·부서 검색', on: "EDUH.setF('Q', this.value)" },
            /* 필터도 조회 범위를 따른다 — 목록에서 지워 놓고 드롭다운에 남기면 "있는데 안 보여준다"로 읽힌다.
               고를 부서가 하나뿐이면 드롭다운을 두지 않는다(§12) */
            scopedDepts.length > 1 ? { type: 'select', id: 'eh-dept', value: state.fDept, label: '부서',
              options: [['', '부서 전체']].concat(scopedDepts.map(function (d) { return [d.id, d.name]; })),
              on: "EDUH.setF('Dept', this.value)" } : null,
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
        /* 재난안전과 담당자 화면에는 [채용시 교육 추가]가 없다 — «재난안전과 담당자는 결과만 볼 수 있게»(2차 통화 00:24).
           재난안전과 소속 직원 몫만 «우리 부서»로 올린다(D-4) — 그런 사람이 없으면 버튼 자체가 없다 */
        var owner = E().isOwnerStaff();
        var canAdd = E().canRegister() && (!owner || addPool().length > 0);
        var actions = (canAdd
            ? '<button type="button" class="btn btn-primary" onclick="EDUH.openAdd()">＋ ' + (owner ? '우리 부서 채용시 교육 추가' : '채용시 교육 추가') + '</button>' +
                (state.tab === 'undone' && selectablePool() > 0
                    ? ' <button type="button" class="btn btn-outline" onclick="EDUH.openBulk()">선택 교육기록 등록 (' + selectedCount() + ')</button>'
                    : '')
            : '');
        /* 재난안전과에는 한 줄만 — 필터 줄 안에 두면 필터가 세 줄로 밀리고, 조회 계층에는 readOnlyNote 가 같은 말을 한다(2차 통화 검토 C-2) */
        var ownerNote = owner ? '<p class="file-hint" style="margin:0 0 10px;">채용시교육은 각 부서 담당자가 등록하고 실시 결과 보고 공문을 보냅니다. 재난안전과는 결과를 봅니다.</p>' : '';
        var filters = EDUFILTER.bar(fields, { count: list.length, unit: '명', reset: 'EDUH.resetF()', actions: actions });

        /* 묶어보기 — 부서별 / 채용일별 / 안 묶기. 보이는 부서가 하나면 «부서별»은 묶음이 하나뿐이라 뺀다 */
        var oneDept = scopedDepts.length <= 1;
        if (oneDept && state.groupBy === 'dept') state.groupBy = 'hire';
        var groupBar =
            '<div class="edu-toolbar" style="margin-bottom:10px;">' +
                '<span style="font-size:var(--fs-12);color:var(--text-gray);font-weight:var(--fw-bold);">묶어보기</span>' +
                '<div class="edu-groupby" role="group" aria-label="목록 묶음 기준">' +
                    (oneDept ? ['hire:채용일별', 'none:안 묶기'] : ['dept:부서별', 'hire:채용일별', 'none:안 묶기']).map(function (o) {
                        var k = o.split(':')[0], lb = o.split(':')[1];
                        return '<button type="button" class="' + (state.groupBy === k ? 'active' : '') + '"' +
                            ' aria-pressed="' + (state.groupBy === k ? 'true' : 'false') + '"' +
                            ' onclick="EDUH.setGroupBy(\'' + k + '\')">' + lb + '</button>';
                    }).join('') +
                '</div>' +
            '</div>';

        var allIds = list.filter(function (r) { return canPick(r.w); }).map(function (r) { return r.w.id; });
        var allChecked = allIds.length && allIds.every(function (id) { return state.checked[id]; });
        var headerCk = selectable()
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

        /* 관리·감독 계층에는 등록·수정 수단 대신 누가 하는지를 밝힌다(담당자에게는 '') */
        var ro = global.DYROLE && global.DYROLE.readOnlyNote ? global.DYROLE.readOnlyNote('채용시교육 기록 등록·수정') : '';
        var unk = unknownCount();
        var unkNote = unk
            ? '<p class="file-hint" style="margin:0 0 10px;">' +
                (SUP_MODE ? '관리감독자 지정일' : '채용일') + '이 없는 <b>' + unk + '명</b>은 「판정 불가」로 표시됩니다. ' +
                (SUP_MODE ? '지정일' : '채용일') + '은 <b>현업근로자 관리 › 현업근로자 명단</b>에서 등록합니다.</p>'
            : '';
        state.mount.innerHTML = ro + tabs + unkNote + ownerNote + filters + groupBar +
            '<div class="edu-card"><div class="edu-scroll"><table class="table-figma table-compact"><thead><tr>' +
                headerCk +
                '<th>이름</th><th>부서</th><th>고용형태</th><th>채용일</th><th>필요시간</th><th>이수일</th><th>상태</th><th></th>' +
            '</tr></thead><tbody>' + body + '</tbody></table></div></div>';
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
    /* 선택 체크는 [선택 교육기록 등록]을 위한 것이라 **내 부서 사람 줄에만** 낸다 — 재난안전과 화면의 다른 부서 줄에
       체크를 두면 누를 버튼이 없는 선택이 된다(2차 통화 검토 · 재난안전과는 검토만) */
    function selectable() { return state.tab === 'undone' && selectablePool() > 0; }
    function canPick(w) { return selectable() && canActWorker(w.id); }
    function groupHeadRow(g) {
        var ids = g.rows.filter(function (r) { return canPick(r.w); }).map(function (r) { return r.w.id; });
        var allck = ids.length
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
            if (groupKeyOf(r) !== key || !canPick(r.w)) return;
            if (on) state.checked[r.w.id] = true; else delete state.checked[r.w.id];
        });
        render();
    }
    function tabCount(tab) {
        var arr = pool();
        if (tab === 'all') return arr.length;
        return arr.filter(function (w) {
            var s = E().hireStatus(w.id).status;
            return tab === 'undone' ? s === 'NONE'
                : (s === 'BEFORE' || s === 'LATE_DONE' || s === 'UNKNOWN_DONE');
        }).length;
    }
    /* 전체 = 미이수 + 이수 + 판정 불가. 세 번째가 0이 아니면 몇 명이고 **무엇을 하면
       풀리는지**만 밝힌다(운영 T12 — 탭 합이 안 맞는 이유 같은 설명은 쓰지 않는다). */
    function unknownCount() {
        return pool().filter(function (w) {
            var s = E().hireStatus(w.id).status;
            return s === 'UNKNOWN' || s === 'UNKNOWN_DONE';
        }).length;
    }
    function selectedCount() { return Object.keys(state.checked).filter(function (k) { return state.checked[k]; }).length; }

    function rowHtml(r) {
        var w = r.w, hs = r.hs;
        /* 기준일이 없으면 이수·미이수를 말할 수 없다 — 없는 기준으로 미이수를 찍지 않는다 */
        var stLabel = hs.status === 'BEFORE' ? '정상 이수'
            : hs.status === 'LATE_DONE' ? '지연 이수'
            : hs.status === 'UNKNOWN_DONE' ? '이수 (시점 판정 불가)'
            : hs.status === 'UNKNOWN' ? '판정 불가 — ' + hs.anchorKind + ' 미등록'
            : '미이수';
        var empLabel = E().empLabel(w.empType) + (w.contractMonths ? '[' + w.contractMonths + '개월]' : '');
        var ck = canPick(w)
            ? '<input type="checkbox"' + (state.checked[w.id] ? ' checked' : '') +
                ' onchange="EDUH.toggle(\'' + w.id + '\', this.checked)" aria-label="' + esc(w.name) + ' 선택">'
            : '';
        /* 수정·공문은 **이수 기록이 있을 때만** 낸다 — 종전에는 «미이수가 아니면» 냈는데,
           지정일이 없어 판정 불가(UNKNOWN)인 사람은 기록이 없어도 미이수가 아니라서 빈 이수일로
           수정 창이 열리고 저장이 «이수일을 입력하세요»로 거절됐다. */
        return '<tr>' +
            '<td style="text-align:center;">' + ck + '</td>' +
            '<td class="edu-name">' + esc(w.name) + '</td>' +
            '<td>' + esc(E().deptName(w.deptId)) + '</td>' +
            '<td>' + esc(empLabel) + '</td>' +
            '<td>' + esc(hs.anchor || (SUP_MODE ? '지정일 미등록' : w.hireDate)) + '</td>' +
            '<td>' + hs.need + 'h</td>' +
            '<td>' + esc(hs.lastDate || '-') + '</td>' +
            '<td><span class="chip-status chip-sm ' + V().toneOf(stLabel) + '">' + esc(stLabel) + '</span>' +
                /* 특별교육으로 갈음한 건 — 무엇으로 이수가 됐는지와 근거를 함께 보인다(시행규칙 §26①).
                   근거 표기는 DYLAW 파생이다(조문 문자열을 화면이 조립하지 않는다 — CLAUDE.md §10). */
                (hs.via === '특별교육'
                    ? '<div class="edu-hire-via">특별교육 이수로 갈음' +
                        (global.DYLAW && DYLAW.basisLine ? ' ' + DYLAW.basisLine('oshr-26', { compact: true }) : '') + '</div>'
                    : '') + '</td>' +
            /* 갈음 건에는 채용시 이수기록이 없다 — 고칠 기록도, 이 화면에서 올릴 공문도 없다
               (특별교육의 수정·공문은 기타교육 화면 소관이다) */
            /* [결재 상태 칩] [공문 보기] 둘만(2차 통화) — [이수 수정]·행의 [공문 기안]·자물쇠 버튼은 걷었다.
               특별교육으로 갈음한 줄은 그 특별교육(기타교육) 공문을 보인다 — 채용시교육 공문은 없다 */
            '<td class="col-action">' + (hs.via === '특별교육' && hs.viaCourseId
                    ? (global.EDUDOC ? global.EDUDOC.runCtl(E().courseOf(hs.viaCourseId), { dash: true }) : '') + ' <span class="file-hint">기타교육으로 등록</span>'
                    : (hs.lastDate && hs.hireRecords ? docBtnHtml(w) : '')) + '</td>' +
        '</tr>';
    }
    /* 공문 — 채용시교육은 사람 행 화면이라 교육 카드가 없다. 그 사람이 이수한
       **교육 건**의 공문으로 연결한다(단위는 교육 1건, SCR-EDU-002 §6).
       한 건에 여러 명이 묶인 경우 같은 공문을 공유한다 — 건이 하나이기 때문이다. */
    function docCourseOf(workerId) {
        /* 가장 최근 교육일의 기록 — 배열 순서가 아니라 날짜로 고른다(여러 묶음에 걸친 사람에게 엉뚱한 공문이 보이지 않게) */
        var recs = E().records().filter(function (r) { return r.workerId === workerId && r.kind === 'HIRE'; })
            .sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); });
        return recs.length ? recs[recs.length - 1].courseId : '';
    }
    function docBtnHtml(w) {
        if (!global.EDUDOC) return '';
        var cid = docCourseOf(w.id);
        if (!cid) return '';
        /* 그 교육 건(등록 묶음)의 실시 결과 보고 공문 — 옛 기록은 실시 결과 공문 또는 «이전 방식» */
        return global.EDUDOC.runCtl(E().courseOf(cid), { dash: true });
    }
    /* [이수 수정]·이수 기록 삭제는 걷었다(2차 통화 «공문으로 남는데 수정은 어차피 불가능 — 필요 없다»).
       고치는 길은 공문 전·반려 때 [공문 보기] 창의 «등록 취소»(묶음 전체) 하나다 — 한 사람만 빼면
       아직 보내지 않은 묶음 공문의 대상이 조용히 줄어든다. 되살리지 말 것. */

    function setTab(t) { state.tab = t; state.checked = {}; state.fDone = ''; render(); }
    function setF(k, v) { state['f' + k] = v; state.checked = {}; EDUFILTER.rerender(render); }
    function resetF() {
        state.fDept = ''; state.fEmp = ''; state.fQ = ''; state.fYear = ''; state.fDone = '';
        state.checked = {}; render();
    }
    function toggle(id, on) { if (on) state.checked[id] = true; else delete state.checked[id]; render(); }
    function toggleAll(on) {
        state.checked = {};
        if (on) rowsForTab().forEach(function (r) { if (canPick(r.w)) state.checked[r.w.id] = true; });
        render();
    }

    /* =============== 일괄 이수처리 =============== */
    function openBulk() {
        if (!E().canRegister()) { deny(''); return; }
        /* 선택은 전역 호출(EDUH.toggle)로도 쌓을 수 있다 — 내 소관 부서 사람만 남긴다 */
        var ids = Object.keys(state.checked).filter(function (k) { return state.checked[k] && canActWorker(k); });
        if (!ids.length) { toast('미이수자를 1명 이상 선택하세요.'); return; }
        B = {
            ids: ids,
            /* 소급 등록도 실제 교육일·시간·증빙을 받는다. 채용일 자동 대입은 정상 실시로
             * 오인되므로 더 이상 제공하지 않는다. */
            useHireDate: false,
            /* merge — 교육 건 생성 방식. false=근로자별 개별 건(기본) · true=한 건으로 묶기.
             * 묶으려면 이수일이 하나여야 하므로 '일괄 이수일 지정'과 함께만 성립한다. */
            merge: false,
            date: E().today(), time: '09:00', end: '18:00', evidenceName: '',
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
        if (el('eh-b-end')) B.end = el('eh-b-end').value || B.end;
        if (el('eh-b-inst')) B.instructor = el('eh-b-inst').value.trim();
        if (el('eh-b-desc')) B.desc = el('eh-b-desc').value.trim();
    }
    /* 공용 업로드 칸의 선택 결과 — 형식·용량 검사를 마친 파일만 넘어온다(DYV2.acceptFiles) */
    function pickEvidence(files) {
        if (!files || !files.length) return;
        captureBulk();
        B.evidenceName = files[0].name;
        renderBulk();
    }
    function renderBulk() {
        var names = B.ids.map(function (id) { var w = E().workerOf(id); return w ? w.name : id; }).join(', ');
        var body =
            '<p style="font-size:var(--fs-13);">선택한 <b>' + B.ids.length + '명</b>의 채용시교육 기록을 등록합니다.</p>' +
            '<div style="max-height:80px;overflow-y:auto;font-size:var(--fs-12);color:var(--text-gray);background:var(--gray-50);padding:8px 10px;border-radius:var(--radius-md);margin-bottom:12px;">' + esc(names) + '</div>' +
            '<div class="check-notice" style="margin-bottom:10px;"><b>소급 등록</b> — 채용일을 이수일로 자동 대입하지 않습니다. 실제 교육일·시간과 교육일지 증빙을 남기며, 실제 시간만 인정합니다.</div>' +
            '<div class="edu-modal-row-2">' +
                '<div><label class="form-label" for="eh-b-date">실제 교육일 <span style="color:var(--status-danger-fg)">*</span></label>' +
                  '<input type="date" class="form-input" id="eh-b-date" value="' + esc(B.date) + '"></div>' +
                '<div><label class="form-label" for="eh-b-time">시작 시각 <span style="color:var(--status-danger-fg)">*</span></label>' +
                  '<input type="time" class="form-input" id="eh-b-time" value="' + esc(B.time) + '"></div>' +
                '<div><label class="form-label" for="eh-b-end">종료 시각 <span style="color:var(--status-danger-fg)">*</span></label>' +
                  '<input type="time" class="form-input" id="eh-b-end" value="' + esc(B.end) + '"></div>' +
            '</div>' +
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
            '<div class="edu-modal-row"><label class="form-label" for="eh-b-desc">제목</label>' +
                '<input type="text" class="form-input" id="eh-b-desc" value="' + esc(B.desc) + '"></div>' +
            /* 업로드 칸은 전 화면 공용 모양 하나(uploadDrop) — 종전의 브라우저 기본 파일 입력은 형식·용량
               검사(FILE_LIMITS)를 지나지 않았다(기획확인 4차 D-1, 2026-10-06). */
            '<div class="edu-modal-row"><label class="form-label">교육일지·서명부 증빙 <span style="color:var(--status-danger-fg)">*</span></label>' +
                V().uploadDrop('<b>증빙 파일을 끌어다 놓거나 눌러서 선택</b>', '', { hint: true, pick: 'EDUH.pickEvidence' }) +
                (B.evidenceName ? '<p style="font-size:var(--fs-12);color:var(--text-gray);margin:4px 0 0;">선택됨: ' + esc(B.evidenceName) + '</p>' : '') + '</div>';
        V().openModal('선택 교육기록 등록 · ' + B.ids.length + '명', body,
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUH.doBulk()">저장하고 공문 작성 →</button>');
    }
    /* 각자 채용일로 되돌리면 이수일이 사람마다 달라지므로 묶기는 자동 해제된다 */
    function setBulkMode(useHire) { captureBulk(); B.useHireDate = useHire; if (useHire) B.merge = false; renderBulk(); }
    /* 묶기를 켜면 이수일이 하나여야 하므로 일괄 이수일 모드로 전환한다 */
    function setBulkMerge(on) { captureBulk(); B.merge = on; if (on) B.useHireDate = false; renderBulk(); }
    function doBulk() {
        captureBulk();
        if (!E().canRegister()) { V().closeModal(); deny(''); return; }
        B.ids = B.ids.filter(canActWorker);
        if (!B.ids.length) { V().closeModal(); toast('등록할 수 있는 대상자가 없습니다 — 소속 부서 사람만 등록합니다.'); return; }
        var d = document.getElementById('eh-b-date').value;
        if (!d) { toast('실제 교육일을 입력하세요.'); return; }
        B.date = d;
        var actualHours = E().sessionHours({ start: B.time, end: B.end });
        if (!(actualHours > 0)) { toast('시작·종료 시각을 확인하세요.'); return; }
        if (!B.evidenceName) { toast('교육일지·서명부 증빙을 선택하세요.'); return; }
        B.instructor = document.getElementById('eh-b-inst').value.trim();
        B.desc = document.getElementById('eh-b-desc').value.trim() || '채용시 안전보건교육';
        var count = 0, made = 0, completed = 0, lastMade = null;
        /* 등록 묶음 — 이번 저장으로 생기는 교육 건 전부가 공문 하나(2차 통화 R-1) */
        var batch = 'B' + Date.now().toString(36);

        if (B.merge) {
            /* 한 건으로 묶기 — 필요시간이 같은 인원끼리 교육 건 1개.
             * 여러 부서가 섞이면 deptId 는 비우고(집합교육과 동일 — 주관부서 소관) 부서별 신청 행으로
             * 나눈다. **한 부서뿐이면 그 부서 건이다** — 비우면 주관부서 소관으로 읽혀, 자기 부서
             * 사람만 묶은 부서 담당자가 자기 건을 고치지도 공문을 기안하지도 못한다. */
            bulkGroups().forEach(function (g) {
                var gDepts = {};
                g.ids.forEach(function (id) { var w = E().workerOf(id); if (w) gDepts[w.deptId] = true; });
                var gKeys = Object.keys(gDepts);
                var c = lastMade = E().addCourse({
                    kind: 'HIRE', deptId: gKeys.length === 1 ? gKeys[0] : '', date: B.date, time: B.time, endTime: B.end, hours: actualHours,
                    sessions: [{ date: B.date, start: B.time, end: B.end }], files: [{ name: B.evidenceName, slot: 'evidence' }],
                    instructor: B.instructor, place: '',
                    desc: B.desc + ' (' + g.hours + 'h · ' + g.ids.length + '명)',
                    status: 'DONE', createdBy: actorDept() + ' (일괄)', batchId: batch, batchTitle: B.desc
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
                    var recognized = Math.min(g.hours, actualHours);
                    E().addRecord({ workerId: id, courseId: c.id, kind: 'HIRE', hours: recognized, date: B.date });
                    if (recognized >= g.hours) completed++;
                    count++;
                });
                made++;
            });
        } else {
            B.ids.forEach(function (id) {
                var w = E().workerOf(id); if (!w) return;
                var hours = E().hireHours(w);
                var date = B.date;
                var time = B.time;
                /* 근로자별 개별 course (묶기를 끄면 종전 동작) */
                var c = lastMade = E().addCourse({
                    kind: 'HIRE', deptId: w.deptId, date: date, time: time, endTime: B.end, hours: actualHours,
                    sessions: [{ date: date, start: time, end: B.end }], files: [{ name: B.evidenceName, slot: 'evidence' }],
                    instructor: B.instructor, place: '', desc: B.desc + ' · ' + w.name,
                    status: 'DONE', createdBy: actorDept() + ' (일괄)', batchId: batch, batchTitle: B.desc
                });
                E().addEnroll({ courseId: c.id, deptId: w.deptId, workerIds: [id], at: date });
                var recognized = Math.min(hours, actualHours);
                E().addRecord({ workerId: id, courseId: c.id, kind: 'HIRE', hours: recognized, date: date });
                if (recognized >= hours) completed++;
                count++; made++;
            });
        }
        state.checked = {};
        render();
        reportDone(count + '명 교육기록 등록 · 이수 완료 ' + completed + '명', lastMade, batch);
    }

    /* =============== 채용시 교육 추가 (자체교육과 동일 구성 · EDUFORM) ===============
     * 대상자 = 아직 채용시교육 미이수(hireStatus NONE)인 현업근로자.
     * 이수 시간은 대상자 고용형태별 '필요시간'으로 인정한다(일용 1h · 1주~1개월 4h · 그 밖 8h). */
    function addPool() {
        /* 추가 대상은 내가 기록을 올릴 수 있는 부서 사람만 — 주관부서 담당자는 전 부서 */
        return pool().filter(function (w) { return E().hireStatus(w.id).status === 'NONE' && E().canActOwnDept(w.deptId); });
    }
    function openAdd() {
        if (!E().canRegister()) { deny(''); return; }
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
            /* 부서가 하나면 고를 것이 없다 — 아래 부서 묶음 머리가 전체 선택을 맡는다 */
            (Object.keys(deptIds).length > 1 ? '<select class="form-select" style="margin-bottom:8px;" aria-label="대상자 부서 필터" onchange="EDUH.aDept(this.value)">' + deptOpts + '</select>' : '') +
            '<div class="edu-tg-body" style="max-height:220px;">' + listHtml + '</div>' +
        '</div>';
    }
    function renderAdd() {
        var body =
            EDUFORM.renderSessions(A, 'EDUH', { totalCaption: '행사 진행 시간' }) +
            '<div class="check-notice" style="margin-bottom:12px;">실제 회차 합계시간과 대상자별 법정 필요시간 중 <b>작은 값만 인정</b>합니다 ' +
                '(일용 필요 <b>1h</b> · 1주 초과~1개월 <b>4h</b> · 그 밖 <b>8h</b>). 필요시간에 못 미치면 교육기록은 남지만 미이수 상태를 유지합니다.</div>' +
            '<div class="edu-modal-row"><label class="form-label" for="eh-a-inst">강사·주관</label>' +
                '<input type="text" class="form-input" id="eh-a-inst" value="' + esc(A.instructor) + '"></div>' +
            '<div class="edu-modal-row"><label class="form-label" for="eh-a-place">장소</label>' +
                '<input type="text" class="form-input" id="eh-a-place" value="' + esc(A.place) + '"></div>' +
            '<div class="edu-modal-row"><label class="form-label" for="eh-a-desc">제목 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="text" class="form-input" id="eh-a-desc" value="' + esc(A.desc) + '"></div>' +
            renderAddTargets() +
            EDUFORM.renderAttach(A, 'EDUH', 'done');
        V().openModal('채용시 교육 추가', body,
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUH.doAdd()">저장하고 공문 작성 →</button>');
    }
    /* 회차·첨부 위임 래퍼 (EDUFORM 공용) */
    function sessTab(i) { captureAdd(); A.sIdx = i; renderAdd(); }
    function sessAdd() { captureAdd(); if (!EDUFORM.sessAdd(A)) toast('교육 일자는 최대 ' + EDUFORM.MAX_SESSIONS + '일까지 추가할 수 있습니다.'); renderAdd(); }
    function sessDel(i) { captureAdd(); EDUFORM.sessDel(A, i); renderAdd(); }
    function sessSync() { captureAdd(); renderAdd(); }
    function addFile(slot) { captureAdd(); EDUFORM.addFile(A, slot); renderAdd(); }
    function delFile(i) { captureAdd(); EDUFORM.delFile(A, i); renderAdd(); }
    function aToggle(id, on) {
        if (on && !canActWorker(id)) { deny((E().workerOf(id) || {}).deptId); return; }
        captureAdd(); if (on) A.workerIds[id] = true; else delete A.workerIds[id]; renderAdd();
    }
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
        if (!A.desc) { toast('교육 제목을 입력하세요.'); return; }
        var pr = EDUFORM.sessionPayload(A);
        if (!pr.ok) { A.sIdx = pr.badIdx; renderAdd(); toast(pr.msg); return; }
        var S = pr.payload;
        if (!E().canRegister()) { V().closeModal(); deny(''); return; }
        /* 선택은 전역 호출(EDUH.aToggle)로도 쌓을 수 있다 — 내 소관 부서 사람만 남긴다 */
        var ids = Object.keys(A.workerIds).filter(function (k) { return A.workerIds[k] && canActWorker(k); });
        if (!ids.length) { toast('교육 대상자를 1명 이상 선택하세요.'); return; }
        if (!A.files.length) { toast('교육일지 및 교육사진 등 증빙을 첨부하세요.'); return; }
        var count = 0, completed = 0, late = 0, lastMade = null;
        var batch = 'B' + Date.now().toString(36);
        ids.forEach(function (id) {
            var w = E().workerOf(id); if (!w) return;
            var need = E().hireHours(w);
            var hours = Math.min(need, S.hours);     /* 인정 = 실제 실시시간과 법정 필요시간 중 작은 값 */
            var eventDate = S.date;
            /* 근로자별 개별 course — 이수 취소(removeCourse)가 다른 대상자를 건드리지 않도록 (bulk 패턴과 동일) */
            var c = lastMade = E().addCourse({
                kind: 'HIRE', deptId: w.deptId, date: eventDate, time: S.time, endTime: S.endTime,
                sessions: S.sessions, hours: S.hours,
                instructor: A.instructor, place: A.place, desc: A.desc + ' · ' + w.name,
                files: A.files, photos: A.photos, status: 'DONE', createdBy: actorDept(), batchId: batch, batchTitle: A.desc
            });
            E().addEnroll({ courseId: c.id, deptId: w.deptId, workerIds: [id], at: eventDate });
            E().addRecord({ workerId: id, courseId: c.id, kind: 'HIRE', hours: hours, date: eventDate });
            if (hours >= need) completed++;
            if (eventDate > w.hireDate) late++;
            count++;
        });
        state.tab = completed === count ? 'done' : 'all'; state.checked = {}; render();
        reportDone(count + '명 교육기록 등록 · 이수 완료 ' + completed + '명' + (late ? ' · 지연 ' + late + '명' : ''), lastMade, batch);
    }

        /* 저장하고 바로 실시 결과 보고 공문(등록 한 번 = 공문 한 번 — 2차 통화 «추가 버튼 누를 때 무조건 연계»).
       닫아도 기록·이수는 남고 공문만 «미기안» */
    function reportDone(msg, c, batch) {
        toast(msg);
        if (c && global.EDUDOC) { global.EDUDOC.open(E().keyRun(batch || E().batchOf(c))); return; }
        V().closeModal();
    }
    /* 미이수 탭에서 고를 수 있는 사람 — 내 부서 사람만(재난안전과도 자기 부서 몫만) */
    function selectablePool() { return pool().filter(function (w) { return canActWorker(w.id); }).length; }
    function init(mountId, opts) {
        SUP_MODE = !!(opts && opts.supMode);
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        if (global.EDUDOC) global.EDUDOC.registerRefresh(render);
        render();
        /* ?doc=R|묶음 — 내 할일 «공문 보내기» 카드에서 그 공문 창을 바로 연다 */
        if (global.EDUDOC && global.EDUDOC.openFromQuery) global.EDUDOC.openFromQuery();
    }
    global.EDUH = {
        init: init, setTab: setTab, setF: setF, resetF: resetF,
        toggle: toggle, toggleAll: toggleAll,
        setGroupBy: setGroupBy, toggleGroup: toggleGroup,
        openBulk: openBulk, setBulkMode: setBulkMode, setBulkMerge: setBulkMerge, doBulk: doBulk, pickEvidence: pickEvidence,
        /* 채용시 교육 추가 (EDUFORM 공용 구성) */
        openAdd: openAdd, doAdd: doAdd, aToggle: aToggle, aToggleDept: aToggleDept, aDept: aDept,
        sessTab: sessTab, sessAdd: sessAdd, sessDel: sessDel, sessSync: sessSync,
        addFile: addFile, delFile: delFile
    };
})(window);
