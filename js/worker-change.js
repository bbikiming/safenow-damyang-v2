/* =====================================================================
   worker-change.js · 현업근로자 관리 › 작업내용 변경 이력 (전역 WKCHG)
   ---------------------------------------------------------------------
   2026-11-16 임영준 주무관 2차 통화 — «작업내용 변경되는 거까지 여기서 등록을 시켜야지만이 기타 교육
   등록할 때 대상자가 뜨거든요». 현업근로자 명단에서 현업업무를 바꾸면(변경일 필수) 여기 한 줄이 남고,
   그 변경일 이후 «작업내용 변경 시 교육» 기록이 법정 최소 시간(별표4)을 채웠으면 이수다 — 기록은 있는데 시간이 모자라면
   «시간 미달»(기타교육 카드의 «법정 최소 미달»과 같은 판정). 판정은 DYEDU(dutyChanges · changeEduRecord) 한 곳.
   이 화면은 기록을 만들지 않는다 — 변경은 명단에서, 교육은 기타교육에서 한다(같은 입력을 두 곳에 두지 않는다).
   조회 범위: 부서 담당자는 자기 부서, 재난안전과·군수는 전 부서(DYROLE.inScope).
   근거 문서: docs/planning/기획-안전보건교육-채용시·기타검토전용·현업근로자관리-2차통화-20261116-v1.md §4-3
   ===================================================================== */
(function (global) {
    'use strict';
    var V = function () { return global.DYV2; };
    var E = function () { return global.DYEDU; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    var state = { mount: null, q: '', dept: '', edu: '' };

    function inScope(deptId) { var R = global.DYROLE; return !R || !R.inScope || R.inScope(deptId); }
    function chips(list) {
        return (list || []).map(function (n) {
            var d = E().dutyOf(n);
            return d ? '<span class="chip-status chip-sm info" title="' + esc(d.no + '. ' + d.text) + '">' + esc(d.short) + '</span>' : '';
        }).join(' ') || '<span class="file-hint">없음</span>';
    }
    /* 이수 = 법정 최소 시간까지 채운 기록이 있음(시간 미달 기록은 미이수 쪽) */
    function done(x) { return !!(x.edu && x.edu.ok); }
    function render() {
        if (!state.mount) return;
        var all = E().dutyChanges().filter(function (x) { return inScope(x.worker.deptId); });
        var list = all.filter(function (x) {
            if (state.dept && x.worker.deptId !== state.dept) return false;
            if (state.edu === 'done' && !done(x)) return false;
            if (state.edu === 'todo' && done(x)) return false;
            return EDUFILTER.match(state.q, [x.worker.name, E().deptName(x.worker.deptId)]);
        });
        var todo = all.filter(function (x) { return !done(x); }).length;
        var depts = {}; all.forEach(function (x) { depts[x.worker.deptId] = 1; });
        var deptIds = Object.keys(depts);
        var head = EDUFILTER.bar([
            { type: 'search', id: 'wc-q', value: state.q, placeholder: '이름·부서 검색', on: "WKCHG.setF('q', this.value)" },
            /* 고를 부서가 하나뿐이면 두지 않는다(§12 — 부서 담당자 화면) */
            deptIds.length > 1 ? { type: 'select', id: 'wc-dept', value: state.dept, label: '부서',
              options: [['', '부서 전체']].concat(deptIds.map(function (d) { return [d, E().deptName(d)]; })),
              on: "WKCHG.setF('dept', this.value)" } : null,
            { type: 'select', id: 'wc-edu', value: state.edu, label: '교육',
              options: [['', '교육 전체'], ['todo', '교육 미이수'], ['done', '교육 이수']], on: "WKCHG.setF('edu', this.value)" }
        ], { count: list.length, unit: '건', reset: 'WKCHG.resetF()' });
        /* 0건이면 요약 줄을 두지 않는다 — 빈 표가 같은 말을 한다(2차 통화 검토 C-8) */
        var sum = all.length ? '<p class="file-hint edu-duty-sum">작업내용 변경 <b>' + all.length + '</b>건 · ' +
            '<button type="button" class="edu-cancel-link" onclick="WKCHG.setF(\'edu\', \'todo\')">작업내용 변경 시 교육 미이수 <b>' + todo + '</b>건</button>' +
            ' — 현업업무는 현업근로자 명단에서 바꿉니다.</p>' : '';
        var rows = list.length ? list.map(function (x) {
            var w = x.worker, l = x.log;
            var supMode = w.category === 'SUPERVISOR';
            var canReg = E().canActOwnDept(w.deptId);
            var regBtn = canReg ? ' <a class="btn btn-primary btn-sm" href="' + (supMode ? 'edu-sup-etc.html' : 'edu-etc.html') + '?type=change&worker=' + encodeURIComponent(w.id) + '">기타 교육 등록</a>' : '';
            var edu = done(x)
                ? '<span class="chip-status chip-sm ' + V().toneOf('완료') + '">이수</span> <span class="file-hint">' + esc(x.edu.date) + '</span>'
                : x.edu
                ? '<span class="chip-status chip-sm ' + V().toneOf('미제출') + '" title="' + esc(x.edu.date + ' 교육 ' + x.edu.got + 'h — 법정 최소 ' + x.edu.need + 'h') + '">시간 미달</span>' +
                  ' <span class="file-hint">' + x.edu.got + ' / ' + x.edu.need + 'h</span>' + regBtn
                : '<span class="chip-status chip-sm ' + V().toneOf('미제출') + '">미이수</span>' + regBtn;
            return '<tr>' +
                '<td>' + esc(l.at) + '</td>' +
                '<td>' + esc(E().deptName(w.deptId)) + '</td>' +
                '<td class="edu-name">' + esc(E().personLabel(w.id)) + '</td>' +
                '<td>' + esc(E().empLabel(w.empType)) + '</td>' +
                '<td>' + chips(l.from) + ' → ' + chips(l.to) + '</td>' +
                '<td>' + edu + '</td>' +
                '<td class="file-hint">' + esc(l.by || '') + '</td>' +
            '</tr>';
        }).join('') : '<tr><td colspan="7"><div class="v2-empty">' + (all.length ? '조건에 맞는 변경 기록이 없습니다.' : '아직 작업내용 변경 기록이 없습니다 — 현업근로자 명단에서 현업업무를 바꾸면 여기 남습니다.') + '</div></td></tr>';
        state.mount.innerHTML = head + sum +
            '<div class="edu-card"><div class="edu-scroll"><table class="table-figma table-compact"><thead><tr>' +
                '<th>변경일</th><th>부서</th><th>성명</th><th>고용형태</th><th>현업업무 변경</th><th>작업내용 변경 시 교육</th><th>등록자</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }
    function setF(k, v) { state[k] = v; EDUFILTER.rerender(render); }
    function resetF() { state.q = ''; state.dept = ''; state.edu = ''; render(); }
    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        render();
    }
    global.WKCHG = { init: init, setF: setF, resetF: resetF };
})(window);
