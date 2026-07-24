/* =====================================================================
   edu-status.js · 이수현황 (EDU-STATUS)
   ---------------------------------------------------------------------
   docs/planning/기획-안전보건교육-재설계-v1.md §8.
   · 뷰 전환: 부서별 요약 ↔ 대상자별 상세 (기본 = 부서별 요약, v1.1 §8.5)
   · 대상자별: 사이클(기간·D-day) · 필요 · 인정 · 미달 · 완료
   · 미이수자 개별/일괄 독촉 → 부서 담당자 알림 목업 + reminders 기록
   · 독촉 이력 열람 · 딥링크 ?dept={deptId}&short=1
   표준: 탭 .sub-tab · 배지 chip-status · 표 .table-figma · 게이지 .progress
   ===================================================================== */
(function (global) {
    'use strict';
    var V = function () { return global.DYV2; };
    var E = function () { return global.DYEDU; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }

    var state = { mount: null, view: 'summary', fDept: '', fCat: '', fEmp: '', fQ: '', fStatus: '', fPct: '', fHire: '', fSrc: '', checked: {} };
    /* view: 'summary' | 'detail'
     * 모집단 필터(요약·상세 공통) — fCat 구분(현업·관리감독자·사무·판매) · fEmp 고용형태(공무원·공무직·기간제·일용)
     *                              · fHire 채용연도 · fSrc 명단 출처
     * fStatus(상세 전용): '' 전체 | 'done' 완료 | 'short' 미달(미이수) | 'over' 기한초과 | 'soon' 마감임박(D-30)
     * fPct(요약 전용): '' 전체 | '100' 완료 | 'mid' 70% 이상 | 'low' 70% 미만
     * ※ 모집단 필터는 요약 완료율에도 적용된다 — '관리감독자만 본 부서별 완료율'이 성립해야 하므로
     *   DYEDU.deptSummary(date, filterFn) 에 같은 조건을 넘겨 다시 집계한다. */

    /* 모집단 판정 — 요약·상세가 반드시 같은 사람 집합을 본다 (단일 출처) */
    function inPopulation(w) {
        if (state.fCat && w.category !== state.fCat) return false;
        if (state.fEmp && w.empType !== state.fEmp) return false;
        if (state.fHire && String(w.hireDate || '').slice(0, 4) !== state.fHire) return false;
        if (state.fSrc && (w.source || '') !== state.fSrc) return false;
        return true;
    }
    /* 적용된 모집단 조건을 사람이 읽는 문장으로 — 필터를 걸고도 전체 수치로 오독하는 것을 막는다 */
    function populationLabel() {
        var parts = [];
        if (state.fCat) parts.push(E().CAT_LABEL[state.fCat]);
        if (state.fEmp) parts.push(E().EMP_LABEL[state.fEmp]);
        if (state.fHire) parts.push(state.fHire + '년 채용');
        if (state.fSrc) parts.push(E().SRC_LABEL[state.fSrc]);
        return parts.length ? parts.join(' · ') : '전체 대상자';
    }
    /* 모집단 필터 3종 — 두 뷰가 같은 필드를 공유한다 */
    function populationFields() {
        var hireYears = EDUFILTER.yearOptions(E().workers().map(function (w) { return w.hireDate; }), '채용연도 전체');
        return [
            { type: 'select', id: 'es-cat', value: state.fCat, label: '구분',
              options: [['', '구분 전체']].concat(Object.keys(E().CAT_LABEL).map(function (k) { return [k, E().CAT_LABEL[k]]; })),
              on: "EDUS.setF('Cat', this.value)" },
            { type: 'select', id: 'es-emp', value: state.fEmp, label: '고용형태',
              options: [['', '고용형태 전체']].concat(Object.keys(E().EMP_LABEL).map(function (k) { return [k, E().EMP_LABEL[k]]; })),
              on: "EDUS.setF('Emp', this.value)" },
            { type: 'select', id: 'es-hire', value: state.fHire, label: '채용연도',
              options: hireYears, on: "EDUS.setF('Hire', this.value)" }
        ];
    }

    function render() {
        if (!state.mount) return;
        var tabs =
            '<div class="sub-tabs" style="margin-bottom:12px;">' +
                '<button type="button" class="sub-tab' + (state.view === 'summary' ? ' active' : '') + '" onclick="EDUS.setView(\'summary\')">부서별 요약</button>' +
                '<button type="button" class="sub-tab' + (state.view === 'detail' ? ' active' : '') + '" onclick="EDUS.setView(\'detail\')">대상자별 상세</button>' +
            '</div>';
        state.mount.innerHTML = tabs + (state.view === 'summary' ? renderSummary() : renderDetail());
    }
    function selectedCount() { return Object.keys(state.checked).filter(function (k) { return state.checked[k]; }).length; }
    function setView(v) { state.view = v; state.checked = {}; render(); }
    function setF(k, v) { state['f' + k] = v; state.checked = {}; EDUFILTER.rerender(render); }
    function resetF() {
        state.fDept = ''; state.fCat = ''; state.fEmp = ''; state.fQ = ''; state.fStatus = ''; state.fPct = '';
        state.fHire = ''; state.fSrc = '';
        state.checked = {}; render();
    }

    function renderSummary() {
        /* 완료율은 선택된 모집단(구분·고용형태·채용연도) 기준으로 다시 계산한다 */
        var all = E().deptSummary(E().TODAY, inPopulation);
        var arr = all.filter(function (d) {
            if (state.fPct === '100' && d.pct !== 100) return false;
            if (state.fPct === 'mid' && !(d.pct >= 70 && d.pct < 100)) return false;
            if (state.fPct === 'low' && d.pct >= 70) return false;
            return EDUFILTER.match(state.fQ, [d.name]);
        });
        var bar = EDUFILTER.bar([
            { type: 'search', id: 'es-q', value: state.fQ, placeholder: '부서명 검색', on: "EDUS.setF('Q', this.value)" }
        ].concat(populationFields()).concat([
            { type: 'select', id: 'es-pct', value: state.fPct, label: '완료율',
              options: [['', '완료율 전체'], ['100', '100% 완료'], ['mid', '70% 이상'], ['low', '70% 미만']],
              on: "EDUS.setF('Pct', this.value)" }
        ]), {
            count: arr.length, unit: '개 부서', reset: 'EDUS.resetF()',
            actions: '<button type="button" class="btn btn-outline btn-sm" onclick="EDUS.openReminders()">📜 독촉 이력</button>'
        });
        var rows = arr.length ? arr.map(function (d) {
            var barCls = d.pct === 100 ? 'green' : (d.pct >= 70 ? 'warning' : 'danger');
            return '<tr>' +
                '<td class="edu-name">' + esc(d.name) + '</td>' +
                '<td>' + d.total + '명</td>' +
                '<td>' + d.done + '명</td>' +
                '<td><div class="progress edu-gauge"><div class="progress-bar ' + barCls + '" style="width:' + d.pct + '%"></div></div>' +
                    '<span class="edu-bar-txt">' + d.pct + '%</span></td>' +
                '<td><button type="button" class="btn btn-outline btn-sm" onclick="EDUS.viewDept(\'' + d.deptId + '\')">상세</button></td>' +
            '</tr>';
        }).join('') : '<tr><td colspan="5"><div class="v2-empty">' +
            (all.length ? '조건에 맞는 부서가 없습니다.' : '데이터가 없습니다.') + '</div></td></tr>';

        /* 배지는 '집계 모집단'(populationLabel = 구분·고용형태·채용연도·출처)의 전체 수치를 보여준다.
         * 완료율 밴드·부서명 검색은 표시할 부서 행만 좁히는 뷰 필터이므로 모집단 합계(all)로 집계해야
         * 라벨(모집단)과 수치의 범위가 일치한다. 좁혀진 부서 수는 필터 바의 결과 건수가 담당한다. */
        var popTotal = all.reduce(function (n, d) { return n + d.total; }, 0);
        var popDone = all.reduce(function (n, d) { return n + d.done; }, 0);
        return bar +
            '<div class="edu-card" data-tour="status-summary"><div class="edu-card-title">부서별 이수 현황 ' +
                '<span style="font-size:var(--fs-12);color:var(--text-gray);font-weight:var(--fw-regular);">(기준일 ' + E().TODAY + ')</span>' +
                '<span class="edu-pop-note">집계 대상 <b>' + esc(populationLabel()) + '</b> · ' + popTotal + '명 중 완료 ' + popDone + '명</span>' +
            '</div>' +
            '<div class="edu-scroll"><table class="table-figma table-compact"><thead><tr>' +
                '<th>부서</th><th>대상 인원</th><th>완료 인원</th><th>완료율</th><th></th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '</div>';
    }

    function viewDept(deptId) { state.view = 'detail'; state.fDept = deptId; state.checked = {}; render(); }

    function renderDetail() {
        var all = E().workers().filter(function (w) {
            if (state.fDept && w.deptId !== state.fDept) return false;
            if (!inPopulation(w)) return false;
            return EDUFILTER.match(state.fQ, [w.name, E().deptName(w.deptId), E().catLabel(w.category), E().empLabel(w.empType)]);
        }).map(function (w) { return E().statusRow(w, E().TODAY); });
        var list = all.filter(function (r) {
            if (state.fStatus === 'done') return r.complete;
            if (state.fStatus === 'short') return !r.complete;
            if (state.fStatus === 'over') return !r.complete && r.cycle.daysToEnd < 0;
            if (state.fStatus === 'soon') return !r.complete && r.cycle.daysToEnd >= 0 && r.cycle.daysToEnd <= 30;
            return true;
        });
        list.sort(function (a, b) {
            /* 미달자 먼저, 그다음 D-day 임박순 */
            if (a.complete !== b.complete) return a.complete ? 1 : -1;
            return (a.cycle.daysToEnd || 0) - (b.cycle.daysToEnd || 0);
        });

        var rows = list.length ? list.map(function (r) {
            var w = r.worker;
            var cyc = r.cycle;
            /* D-day 배지 tone — 완료 success · 기한초과 danger · 30일 이내 warning · 그 외 neutral */
            var dTone = r.complete ? V().toneOf('완료') : (cyc.daysToEnd < 0 ? V().toneOf('기한초과') : (cyc.daysToEnd <= 30 ? V().toneOf('지연') : 'neutral'));
            var dTxt = r.complete ? '완료' : (cyc.daysToEnd < 0 ? '기한초과 D+' + Math.abs(cyc.daysToEnd) : 'D-' + cyc.daysToEnd);
            var ck = state.checked[w.id] ? ' checked' : '';
            var canRemind = !r.complete;
            var ckEl = canRemind
                ? '<input type="checkbox"' + ck + ' onchange="EDUS.toggleCheck(\'' + w.id + '\', this.checked)" aria-label="' + esc(w.name) + ' 선택">'
                : '';
            var empLabel = E().empLabel(w.empType) + (w.contractMonths ? '[' + w.contractMonths + '개월]' : '');
            return '<tr' + (r.complete ? '' : ' class="row-short"') + '>' +
                '<td style="text-align:center;">' + ckEl + '</td>' +
                '<td class="edu-name">' + esc(w.name) + '</td>' +
                '<td>' + esc(E().deptName(w.deptId)) + '</td>' +
                '<td>' + esc(E().catLabel(w.category)) + '</td>' +
                '<td>' + esc(empLabel) + '</td>' +
                '<td>' + esc(w.hireDate) + '</td>' +
                '<td>' + esc(cyc.start) + '<br><span style="font-size:var(--fs-12);color:var(--text-lightgray);">~ ' + esc(cyc.end) + '</span></td>' +
                '<td><span class="chip-status chip-sm ' + dTone + '">' + dTxt + '</span></td>' +
                '<td>' + r.need + 'h</td>' +
                '<td>' + r.done + 'h</td>' +
                '<td>' + (r.short ? '<span class="edu-short">' + r.short + 'h</span>' : '0h') + '</td>' +
                '<td>' + (r.complete
                    ? '<span class="chip-status chip-sm ' + V().toneOf('완료') + '">완료</span>'
                    : '<span class="chip-status chip-sm ' + V().toneOf('미이수') + '">미이수</span>') + '</td>' +
                '<td class="edu-apv-cell">' + (global.EDUAPV ? global.EDUAPV.personControl(w.id) : '') + '</td>' +
            '</tr>';
        }).join('') : '<tr><td colspan="13"><div class="v2-empty">조건에 맞는 대상자가 없습니다.</div></td></tr>';

        var bar = EDUFILTER.bar([
            { type: 'search', id: 'es-q', value: state.fQ, placeholder: '이름·부서·구분 검색', on: "EDUS.setF('Q', this.value)" },
            { type: 'select', id: 'es-dept', value: state.fDept, label: '부서',
              options: [['', '부서 전체']].concat(E().deptCandidates().map(function (d) { return [d.id, d.name]; })),
              on: "EDUS.setF('Dept', this.value)" }
        ].concat(populationFields()).concat([
            { type: 'select', id: 'es-src', value: state.fSrc, label: '명단 출처',
              options: [['', '출처 전체']].concat(Object.keys(E().SRC_LABEL).map(function (k) { return [k, E().SRC_LABEL[k]]; })),
              on: "EDUS.setF('Src', this.value)" },
            { type: 'select', id: 'es-status', value: state.fStatus, label: '이수 상태',
              options: [['', '이수 상태 전체'], ['short', '미이수(미달)'], ['over', '기한초과'], ['soon', '마감 임박 (D-30)'], ['done', '완료']],
              on: "EDUS.setF('Status', this.value)" }
        ]), {
            count: list.length, unit: '명', reset: 'EDUS.resetF()',
            actions: '<button type="button" class="btn btn-primary btn-sm" id="edus-bulk-btn" onclick="EDUS.remindBulk()">일괄 독촉 (' + selectedCount() + ')</button>' +
                '<button type="button" class="btn btn-outline btn-sm" onclick="EDUS.openReminders()">📜 독촉 이력</button>'
        });

        return bar +
            '<div class="edu-card"><div class="edu-card-title">대상자별 상세 ' +
                '<span style="font-size:var(--fs-12);color:var(--text-gray);font-weight:var(--fw-regular);">(기준일 ' + E().TODAY + ' · ' + list.length + '명)</span>' +
                '<span class="edu-pop-note">조회 대상 <b>' + esc(populationLabel()) + '</b> · 미이수 ' +
                    list.filter(function (r) { return !r.complete; }).length + '명</span>' +
            '</div>' +
            '<div class="edu-scroll">' +
            '<table class="table-figma table-compact table-nowrap"><thead><tr>' +
                '<th style="width:44px;"></th><th>이름</th><th>부서</th><th>구분</th><th>고용형태</th>' +
                '<th>채용일</th><th>현재 사이클</th><th>종료 D-day</th>' +
                '<th>필요</th><th>인정</th><th>미달</th><th>정기</th><th>개인 결재</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table>' +
            '</div>' +
        '</div>';
    }

    function toggleCheck(id, on) {
        if (on) state.checked[id] = true; else delete state.checked[id];
        /* 전체 재렌더 대신 툴바 카운트만 인플레이스 갱신 — 표 스크롤 보존 (이식 시 보완) */
        var btn = document.getElementById('edus-bulk-btn');
        if (btn) btn.textContent = '일괄 독촉 (' + selectedCount() + ')';
    }

    /* =============== 독촉 =============== */
    function remindBulk() {
        var ids = Object.keys(state.checked).filter(function (k) { return state.checked[k]; });
        if (!ids.length) { toast('미이수자를 1명 이상 선택하세요.'); return; }
        /* 부서별로 묶기 */
        var byDept = {};
        ids.forEach(function (wid) {
            var w = E().workerOf(wid); if (!w) return;
            (byDept[w.deptId] = byDept[w.deptId] || []).push(wid);
        });
        var body = '<p style="font-size:var(--fs-13);">선택한 <b>' + ids.length + '명</b>의 미이수 상태를 부서 담당자에게 알림 발송합니다.</p>' +
            '<div style="max-height:200px;overflow-y:auto;margin-top:8px;">' +
            Object.keys(byDept).map(function (dId) {
                var names = byDept[dId].map(function (wid) { return E().workerOf(wid).name; }).join(', ');
                return '<div style="padding:6px 10px;background:var(--gray-50);border-radius:var(--radius-md);margin-bottom:4px;font-size:var(--fs-12);">' +
                    '<b>' + esc(E().deptName(dId)) + '</b> · ' + byDept[dId].length + '명 <span style="color:var(--text-gray);">(' + esc(names) + ')</span>' +
                    '</div>';
            }).join('') + '</div>' +
            '<div class="edu-modal-row" style="margin-top:8px;"><label class="form-label" for="edus-memo">추가 메모 (선택)</label>' +
            '<textarea class="form-textarea" id="edus-memo" rows="2" placeholder="예: 8월 마감 전 이수 필수"></textarea></div>';
        V().openModal('미이수자 일괄 독촉',
            body,
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUS.doRemind()">독촉 발송</button>');
    }
    function doRemind() {
        var ids = Object.keys(state.checked).filter(function (k) { return state.checked[k]; });
        var memo = (document.getElementById('edus-memo').value || '').trim();
        var byDept = {};
        ids.forEach(function (wid) {
            var w = E().workerOf(wid); if (!w) return;
            (byDept[w.deptId] = byDept[w.deptId] || []).push(wid);
        });
        Object.keys(byDept).forEach(function (dId) {
            E().addReminder({ by: '재난안전과', deptId: dId, workerIds: byDept[dId], memo: memo || '미이수 안전보건교육 이수 요청' });
        });
        V().closeModal();
        toast(Object.keys(byDept).length + '개 부서, ' + ids.length + '명 독촉 발송 완료');
        state.checked = {};
        render();
    }

    /* =============== 독촉 이력 =============== */
    function openReminders() {
        var arr = E().reminders().slice().sort(function (a, b) { return (b.at || '').localeCompare(a.at || ''); });
        var rows = arr.length ? arr.map(function (r) {
            var names = (r.workerIds || []).map(function (wid) { var w = E().workerOf(wid); return w ? w.name : wid; }).join(', ');
            return '<tr>' +
                '<td>' + esc(r.at) + '</td>' +
                '<td>' + esc(E().deptName(r.deptId)) + '</td>' +
                '<td>' + (r.workerIds || []).length + '명</td>' +
                '<td style="font-size:var(--fs-12);color:var(--text-gray);">' + esc(names) + '</td>' +
                '<td>' + esc(r.memo || '') + '</td>' +
                '<td>' + esc(r.by || '') + '</td>' +
            '</tr>';
        }).join('') : '<tr><td colspan="6"><div class="v2-empty">독촉 이력이 없습니다.</div></td></tr>';
        V().openModal('독촉 이력 (' + arr.length + '건)',
            '<div class="edu-scroll" style="max-height:400px;overflow-y:auto;">' +
            '<table class="table-figma table-compact"><thead><tr>' +
                '<th>일시</th><th>부서</th><th>인원</th><th>대상자</th><th>메모</th><th>발신</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>',
            '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal()">닫기</button>');
    }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        var q = new URLSearchParams(location.search);
        if (q.get('dept')) { state.fDept = q.get('dept'); state.view = 'detail'; }
        /* 모집단 딥링크 — 예: ?cat=SUPERVISOR (관리감독자만) · ?emp=CIVIL&status=short */
        if (q.get('cat') && E().CAT_LABEL[q.get('cat')]) { state.fCat = q.get('cat'); state.view = 'detail'; }
        if (q.get('emp') && E().EMP_LABEL[q.get('emp')]) { state.fEmp = q.get('emp'); state.view = 'detail'; }
        /* 하위호환 — 기존 딥링크 ?short=1 은 새 '이수 상태' 필터의 미달 값으로 매핑 */
        if (q.get('short') === '1') { state.fStatus = 'short'; state.view = 'detail'; }
        if (q.get('status')) { state.fStatus = q.get('status'); state.view = 'detail'; }
        if (global.EDUAPV) global.EDUAPV.registerRefresh(render);
        render();
    }
    global.EDUS = {
        init: init, setView: setView, setF: setF, resetF: resetF, viewDept: viewDept,
        toggleCheck: toggleCheck, remindBulk: remindBulk, doRemind: doRemind,
        openReminders: openReminders
    };
})(window);
