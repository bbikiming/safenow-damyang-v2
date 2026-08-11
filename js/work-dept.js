/* =========================================================================
 * work-dept.js — 부서 업무함 (전역 WKDEPT) · WRK02-L
 * -------------------------------------------------------------------------
 * 부서장·사업소장·읍면장 관점. 2탭 — 배정 · 팀원별 현황.
 *   · 배정 권한은 DYROLE.assignKind 한 곳에서만 판정(§14-7)
 *   · 배정 UI 는 WKASSIGN 공유 — 여기서 또 그리지 않는다
 *   · 조회 범위 밖 부서는 표에서 지우고 진입 함수에도 가드를 둔다(§12)
 *   · [열기] 는 담당자 화면으로 보낸다 — **대신 처리하지 않는다**
 * ========================================================================= */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var W = function () { return global.DYWORK; };
    var R = function () { return global.DYROLE; };
    var A = function () { return global.WKASSIGN; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }
    function chip(l, t) { return '<span class="chip-status ' + (t || V().toneOf(l)) + '">' + esc(l) + '</span>'; }

    var state = { mount: null, deptId: '', tab: 'assign' };

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        var p = R().current();
        var q = new URLSearchParams(location.search).get('dept');
        var scope = R().scope();
        state.deptId = (q && R().inScope(q)) ? q
                     : (p && p.deptId) ? p.deptId
                     : (scope === 'all' ? (V().orgDepts()[0] || {}).id : scope);
        render();
    }
    function setDept(id) { if (!R().inScope(id)) { toast('조회 범위 밖 부서입니다'); return; } state.deptId = id; render(); }
    function setTab(t) { state.tab = t; render(); }

    function render() {
        if (!state.mount) return;
        var did = state.deptId;
        if (!R().inScope(did)) { state.mount.innerHTML = '<div class="v2-empty">조회 범위 밖 부서입니다.</div>'; return; }
        var tasks = W().deptTasks(did).filter(function (t) { return t.issue.status === W().IST.OPEN; });
        /* 배정 대기 = 담당자가 없고 **아직 할 일이 남은** 건. 전용 화면에서 이미
           처리된 업무를 배정하라고 하면 부서장에게 없는 일을 만든다. */
        var wait = tasks.filter(function (t) { return t.unassigned && !t.done; });
        var late = wait.filter(function (t) { return t.assignLate; });
        var over = tasks.filter(function (t) { return !t.unassigned && t.overdue; });
        var closedPct = closedRate(did);

        var picker = (R().scope() === 'all')
            ? '<div class="wk-head-right"><span class="wk-deptlabel">부서</span>' +
              '<select class="form-select" onchange="WKDEPT.setDept(this.value)">' +
              V().orgDepts().filter(function (d) { return R().inScope(d.id); }).map(function (d) {
                  return '<option value="' + esc(d.id) + '"' + (d.id === did ? ' selected' : '') + '>' + esc(d.name) + '</option>';
              }).join('') + '</select></div>'
            : '';
        var note = (R().assignKind(did) === '')
            ? '<div class="dy-readonly" role="note"><b>배정 권한 없음</b> — ' + A().whoCanNote(did) + '</div>'
            : '';
        var lead = R().leadOf(did);
        var leadNote = lead ? '' :
            '<p class="wk-note" style="color:var(--status-warning-fg);"><b>' + esc(W().deptName(did)) +
            '</b> 부서장이 시스템에 등록돼 있지 않습니다 — 미배정 업무의 책임자를 지목할 수 없습니다. 재난안전과 확인 필요.</p>';

        /* 부서명은 페이지 제목 줄로 올린다 — 카드 헤더에 또 쓰면 제목이 두 번 나온다.
           부서 선택기는 조회 범위가 전 부서인 사람에게만 필요하므로 그때만 바를 만든다. */
        setPageDept(did);
        state.mount.innerHTML =
            V().notice('work-dept',
                '재난안전과가 내려보낸 업무를 <b>부서 담당자에게 배정</b>합니다',
                '업무 처리(점검표 작성·교육 등록·첨부)는 담당자가 <b>내 할일</b>에서 하고, 여기서는 대신 처리하지 않습니다.') +
            (picker ? '<div class="wk-head">' + picker + '</div>' : '') +
            note + leadNote +
            '<div class="wk-kpis">' +
                kpi(wait.length, '배정 대기', wait.length ? 'warning' : 'neutral') +
                kpi(late.length, '미배정 지연', late.length ? 'danger' : 'neutral') +
                kpi(over.length, '기한 초과', over.length ? 'danger' : 'neutral') +
                kpi(closedPct + '%', '올해 회수율', 'info') +
            '</div>' +
            '<div class="tabs" style="margin-bottom:14px;">' +
                '<button type="button" class="tab' + (state.tab === 'assign' ? ' is-active' : '') +
                    '" onclick="WKDEPT.setTab(\'assign\')">배정 <span class="wk-tab-n">' + tasks.length + '</span></button>' +
                '<button type="button" class="tab' + (state.tab === 'member' ? ' is-active' : '') +
                    '" onclick="WKDEPT.setTab(\'member\')">팀원별 현황</button>' +
            '</div>' +
            (state.tab === 'member' ? viewMembers(did) : viewAssign(did, tasks));
    }
    /* 부서명을 페이지 제목에 반영 — 카드 헤더 중복을 없앤 자리를 여기가 받는다 */
    function setPageDept(did) {
        var h = document.querySelector('.dy-page-title h1, .dy-page-title');
        if (!h) return;
        var t = h.querySelector('h1') || h;
        var base = '부서 업무함';
        t.textContent = base + ' — ' + W().deptName(did);
    }

    function kpi(n, label, tone) {
        return '<div class="wk-kpi wk-kpi-' + tone + '"><div class="wk-kpi-num">' + esc(String(n)) + '</div>' +
               '<div class="wk-kpi-label">' + esc(label) + '</div></div>';
    }
    function closedRate(did) {
        var y = W().today().slice(0, 4);
        var all = W().deptTasks(did).filter(function (t) { return String(t.issue.periodKey).slice(0, 4) === y; });
        if (!all.length) return 0;
        return Math.round(all.filter(function (t) { return t.done; }).length / all.length * 100);
    }

    /* ── 배정 탭 — **표 하나**로 본다 ────────────────────────────────────
     * 종전에는 '배정 대기 / 배정 완료' 카드 두 덩어리로 나뉘어 있어서
     * "누가 맡았고 지금 어디까지 왔나"를 한눈에 못 봤다. 표 한 장에 담당자와
     * 상태를 나란히 두고, **행을 누르면 바로 조직도가 열린다**(별도 버튼을
     * 찾아 누르는 단계를 없앤다). 상태는 색만으로 말하지 않고 라벨을 함께 쓴다. */
    function viewAssign(did, tasks) {
        if (!tasks.length) {
            return '<div class="v2-empty">진행 중인 업무가 없습니다.<br>' +
                '<span style="color:var(--text-gray);">재난안전과가 업무를 발행하면 여기에 나타납니다.</span></div>';
        }
        var can = R().assignKind(did) !== '';
        var mt = (R().assignTeam && R().assignTeam()) || '';
        var rows = tasks.map(function (t) { return rowHtml(t, can, mt); }).join('');
        var hint = can
            ? '<p class="wk-note">행을 누르면 <b>조직도가 열립니다</b> — ' +
              (mt ? '<b>' + esc(mt) + '</b> 팀원 중에서 고릅니다.' : '부서 구성원 중에서 고릅니다.') + '</p>'
            : '';
        return hint +
            '<div class="wk-scroll"><table class="table-figma table-compact wk-rowtable"><thead><tr>' +
            '<th>업무</th><th class="wk-nowrap">기한</th><th>담당자</th><th class="wk-nowrap">상태</th><th class="wk-nowrap"></th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    /* 상태 한 칸 — '지금 어디까지 왔나'를 한 단어로. 색은 보조이고 라벨이 본체다. */
    function stateOf(t) {
        if (t.done) return { label: '완료', tone: 'success' };
        if (t.confirm.state === 'RETURNED') return { label: '반려', tone: 'danger' };
        if (t.status === W().TST.SUBMITTED) return { label: '제출', tone: 'info' };
        if (t.unassigned) return { label: t.assignLate ? '미배정 지연' : '미배정', tone: t.assignLate ? 'danger' : 'warning' };
        if (t.overdue) return { label: '기한초과', tone: 'danger' };
        return { label: '진행', tone: 'info' };
    }

    function rowHtml(t, can, mt) {
        var st = stateOf(t);
        var tpl = t.tpl || {};
        var clickable = can && !t.done;
        /* 팀장은 자기 팀 사람이 맡은 건만 조작한다 — 남의 팀 건은 조회만 */
        if (clickable && mt && t.assign.toTeam && t.assign.toTeam !== mt) clickable = false;
        var dday = t.dday == null ? '' :
            (t.dday < 0 ? 'D+' + (-t.dday) : (t.dday === 0 ? 'D-day' : 'D-' + t.dday));
        var ddayCls = t.dday == null ? '' : (t.dday < 0 ? ' is-over' : (t.dday <= 7 ? ' is-soon' : ''));
        /* 완료된 건의 '미지정'은 문제가 아니다 — 전용 화면에서 이미 처리된 경우다.
           주황으로 강조하면 손댈 게 있는 것처럼 읽혀 부서장이 헛걸음한다. */
        var owner = t.assign.toName
            ? '<b>' + esc(t.assign.toName) + '</b>' +
              (t.assign.toTeam ? '<div class="wk-sub">' + esc(t.assign.toTeam) + '</div>' : '')
            : (t.done ? '<span class="wk-sub">—</span>' : '<span class="wk-none">미지정</span>');
        return '<tr class="' + (clickable ? 'is-click' : '') + (t.done ? ' is-done' : '') + '"' +
            (clickable ? ' tabindex="0" role="button"' +
                ' aria-label="' + esc(t.name + ' 담당자 ' + (t.assign.toName || '미지정') + ' — 눌러서 지정') + '"' +
                ' onclick="WKDEPT.assign(\'' + esc(t.issueId) + '\')"' +
                ' onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();WKDEPT.assign(\'' + esc(t.issueId) + '\')}"' : '') +
            '>' +
            '<td><b>' + esc(t.name) + '</b><div class="wk-sub">' + esc(t.periodLabel) +
                ((tpl.slots || []).length ? ' · ' + esc(tpl.slots.map(function (x) { return x.key; }).join('+')) + ' 필요'
                                          : (tpl.destLabel ? ' · ' + esc(tpl.destLabel) + ' 화면' : '')) + '</div></td>' +
            '<td class="wk-nowrap"><span class="wk-dday' + ddayCls + '">' + esc(dday) + '</span>' +
                '<div class="wk-sub">' + esc(t.due) + '</div></td>' +
            '<td>' + owner + '</td>' +
            '<td class="wk-nowrap">' + chip(st.label, st.tone) + '</td>' +
            '<td class="wk-nowrap">' +
                (clickable ? '<span class="wk-rowcta">' + (t.unassigned ? '지정' : '변경') + ' ›</span>'
                           : '<a class="btn btn-sm btn-outline" href="my-work.html?dept=' + esc(t.deptId) + '">열기</a>') +
            '</td></tr>' +
            (t.confirm.state === 'RETURNED'
                ? '<tr class="wk-subrow"><td colspan="5"><div class="wk-card-ret"><b>반려</b> ' +
                  esc(t.confirm.at) + ' · ' + esc(t.confirm.reason) + '</div></td></tr>' : '');
    }

    /* ── 팀원별 현황 ── */
    function viewMembers(did) {
        var ms = V().orgMembers(did);
        var teams = V().orgTeams(did);
        var tasks = W().deptTasks(did).filter(function (t) { return t.issue.status === W().IST.OPEN; });
        var rows = ms.map(function (m) {
            var mine = tasks.filter(function (t) { return t.assign.to === m.uid; });
            var open = mine.filter(function (t) { return !t.done; });
            var late = open.filter(function (t) { return t.overdue; }).length;
            var week = open.filter(function (t) { return t.dday != null && t.dday >= 0 && t.dday <= 7; }).length;
            return '<tr>' +
                '<td><b>' + esc(m.name) + '</b>' + (m.lead ? ' ' + chip('부서장', 'info') : '') + '</td>' +
                '<td>' + esc(m.team || m.role) + '</td>' +
                '<td>' + open.length + '</td>' +
                '<td>' + (late ? '<b style="color:var(--status-danger-fg);">' + late + '</b>' : '0') + '</td>' +
                '<td>' + week + '</td>' +
                '<td>' + (mine.length - open.length) + '</td>' +
                '</tr>';
        }).join('');
        var teamNote = teams.length
            ? '<p class="wk-note">팀 정보는 조직도의 <b>표시용 이름</b>입니다 — 담양군 실제 팀 편제 자료를 받기 전이라 배정은 <b>부서 단위</b>로 합니다.</p>'
            : '<p class="wk-note" style="color:var(--status-warning-fg);"><b>팀 구조 미등록</b> — 부서 전체에서 담당자를 고릅니다.</p>';
        return teamNote +
            '<div class="wk-scroll"><table class="table-figma table-compact"><thead><tr>' +
            '<th>이름</th><th>팀 · 직위</th><th>진행</th><th>지연</th><th>이번주</th><th>완료</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
            '<p class="wk-note">건수만 사실대로 보여줍니다 — 업무마다 무게가 달라 임의 가중치로 부하 점수를 만들지 않습니다.</p>';
    }

    /* ── 진입 함수에도 가드 (렌더에서만 지우면 콘솔·URL 로 뚫린다) ── */
    function assign(issueId) {
        if (!R().inScope(state.deptId)) { toast('조회 범위 밖 부서입니다'); return; }
        A().open(issueId, state.deptId, render);
    }
    function claim(issueId) {
        if (!R().inScope(state.deptId)) { toast('조회 범위 밖 부서입니다'); return; }
        A().claimAt(issueId, state.deptId, render);
    }

    global.WKDEPT = { init: init, setDept: setDept, setTab: setTab, assign: assign, claim: claim, render: render };
})(window);
