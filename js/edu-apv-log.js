/* =====================================================================
   edu-apv-log.js · 안전보건교육 결재 이력 (EDU-APV-LOG · 전역 EDUAPVLOG)
   ---------------------------------------------------------------------
   근거: docs/planning/기획-안전보건교육-온나라결재상신-v1.md §6·§7
   총괄·교육별·개인별로 흩어진 온나라 결재 상신 건을 한 화면에서 조회한다.
   · 데이터는 EDUDOC.submissions() 만 소비한다 — 스토어 구조·라벨을 화면이 직접 읽지 않는다.
   · 행 액션: [문서] 상신 당시 컨텍스트로 문서 다시 보기 · [상태] 그 상신 건의 상태 팝업.
   · 재상신으로 밀려난 과거 건은 '이전' 배지로 구분하고 상태 변경을 막는다(팝업에서 처리).
   표준: 통계 .statbox · 필터 EDUFILTER · 표 .table-figma(.table-compact·.table-nowrap)
        · 배지 chip-status + DYV2.toneOf · 빈상태 .v2-empty
   ===================================================================== */
(function (global) {
    'use strict';
    var V = function () { return global.DYV2; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }

    var state = { mount: null, fQ: '', fKind: '', fStatus: '', fYear: '' };

    /* 상신은 EDUDOC(공문)이 한다 — 이력도 거기서 읽는다. 상신 경로가 바뀌면
       이력 출처도 함께 옮긴다. 옛 경로만 읽으면 공문을 올려도 0건으로 남는다. */
    function all() { return (global.EDUDOC && global.EDUDOC.submissions) ? global.EDUDOC.submissions() : []; }
    function filtered(list) {
        return list.filter(function (s) {
            if (state.fKind && s.kind !== state.fKind) return false;
            if (state.fStatus && s.status !== state.fStatus) return false;
            if (state.fYear && String(s.at || '').slice(0, 4) !== state.fYear) return false;
            return EDUFILTER.match(state.fQ, [s.no, s.label, s.scope, s.line]);
        });
    }

    /* 상신 활성 여부 — 값이 아니라 함수로 묻는다(모듈 초기화 시점 스냅샷을 들면

    /* 상신 경로가 열려 있는가 — 공문 모듈이 있으면 열려 있다. 발주처가 요구한 순서
       (공문 작성 후 결재)가 갖춰진 상태이기 때문이다. */
    function apvOn() { return !!global.EDUDOC; }

    /* 차단 안내 — 꺼져 있을 때만 그린다. 정적 HTML 에 박아 두면 되살려도 남는다. */
    function renderBlocked() {
        var el = global.document.getElementById('eal-blocked');
        if (!el) return;
        el.innerHTML = apvOn() ? '' :
            '<div class="check-notice" style="border-color:var(--status-warning-border); background:var(--status-warning-bg);">' +
                '<b>현재 신규 상신은 막혀 있습니다.</b> 2026-07-30 회의에서 교육 화면의 <b>[결재 상신]</b> 버튼을 제거하기로 했습니다 — ' +
                '기능이 틀린 게 아니라 <b>공문 작성 단계 없이 결재만 올라가는 순서</b>가 틀렸기 때문입니다 ' +
                '(&ldquo;왜 갑자기 뜬금없이 결재 상신이 있지&rdquo;). ' +
                '결재 전에 <b>공문 작성 화면</b>이 먼저 뜨도록 만든 뒤 그 흐름에 다시 연결합니다. ' +
                '이 화면은 그때까지 <b>기존 이력 조회 전용</b>으로 유지합니다.' +
            '</div>';
    }

    function render() {
        if (!state.mount) return;
        renderBlocked();
        var list = all();
        var rows = filtered(list);
        var cnt = function (st) { return list.filter(function (s) { return s.status === st; }).length; };

        /* **도달할 수 없는 축을 지표로 두지 않는다** — 결재 완료·반려는 온나라가 회신해야
           생기는 상태이고 연동이 아직 없다. 칩으로 걸어 두면 영영 0 인 칸이 두 개 남아
           "우리가 못 하고 있다"로 오독된다. 회신이 붙으면 그때 축을 늘린다. */
        var done = cnt('결재완료'), rej = cnt('반려');
        var stats =
            '<div class="statbox-grid cols-4" style="margin-bottom:12px;">' +
                '<div class="statbox info"><div class="statbox-num">' + list.length + '</div><div class="statbox-label">상신한 공문 (건)</div></div>' +
                '<div class="statbox info"><div class="statbox-num">' + cnt('결재중') + '</div><div class="statbox-label">결재 진행 중</div></div>' +
                (done || rej
                    ? '<div class="statbox success"><div class="statbox-num">' + done + '</div><div class="statbox-label">결재완료</div></div>' +
                      '<div class="statbox ' + (rej ? 'danger' : 'neutral') + '"><div class="statbox-num">' + rej + '</div><div class="statbox-label">반려</div></div>'
                    : '<div class="statbox neutral" style="grid-column:span 2;"><div class="statbox-label" style="text-align:left;">' +
                      '<b>결재 완료·반려는 온나라 회신으로 채워집니다</b><br>연동 전에는 상신한 사실과 문서만 남습니다.</div></div>') +
            '</div>';

        var bar = EDUFILTER.bar([
            { type: 'search', id: 'eal-q', value: state.fQ, placeholder: '문서번호·문서명·대상 검색', on: "EDUAPVLOG.setF('Q', this.value)" },
            { type: 'select', id: 'eal-kind', value: state.fKind, label: '구분',
              options: [['', '구분 전체'], ['summary', '총괄'], ['course', '교육별'], ['person', '개인별']],
              on: "EDUAPVLOG.setF('Kind', this.value)" },
            { type: 'select', id: 'eal-status', value: state.fStatus, label: '상태',
              /* 목록에 실재하는 상태만 고르게 한다 — 없는 값을 두면 고를 때마다 0건이 된다 */
              options: [['', '상태 전체']].concat(
                  ['결재중', '결재완료', '반려'].filter(function (st) { return cnt(st) > 0; })
                      .map(function (st) { return [st, st]; })),
              on: "EDUAPVLOG.setF('Status', this.value)" },
            { type: 'select', id: 'eal-year', value: state.fYear, label: '상신연도',
              options: EDUFILTER.yearOptions(list.map(function (s) { return s.at; }), '상신연도 전체'),
              on: "EDUAPVLOG.setF('Year', this.value)" }
        ], { count: rows.length, unit: '건', reset: 'EDUAPVLOG.resetF()' });

        var body = rows.length ? rows.map(rowHtml).join('')
            : '<tr><td colspan="8"><div class="v2-empty">' +
                /* 빈 상태는 **도달 가능한 행동만** 약속한다 — 상신이 꺼져 있는 동안
                   "[총괄 결재 상신]에서 올리면 쌓입니다"라고 쓰면 바로 위 안내
                   ("현재 신규 상신은 막혀 있습니다")와 한 화면에서 서로 모순된다.
                   되살아나면 그때 원래 문구가 나온다. */
                (list.length ? '조건에 맞는 상신 이력이 없습니다.'
                             : (apvOn()
                                 ? '아직 상신한 결재 문서가 없습니다. 종료 처리된 교육의 <b>[공문 기안]</b>으로 공문을 써서 상신하면 여기에 쌓입니다.'
                                 : '상신한 결재 문서가 없습니다 — 신규 상신이 막혀 있는 동안에는 새로 쌓이지 않습니다. 공문 작성 단계가 붙으면 그때부터 이 표에 쌓입니다.')) +
              '</div></td></tr>';

        state.mount.innerHTML = stats + bar +
            '<div class="edu-card"><div class="edu-scroll">' +
            '<table class="table-figma table-compact table-nowrap"><thead><tr>' +
                '<th>문서번호</th><th>상신일</th><th>구분</th><th>문서명</th>' +
                '<th>대상</th><th>결재선</th><th>상태</th><th>관리</th>' +
            '</tr></thead><tbody>' + body + '</tbody></table>' +
            '</div></div>';
    }

    function rowHtml(s) {
        return '<tr>' +
            '<td class="edu-name">' + esc(s.no) + '</td>' +
            '<td>' + esc(s.at) + '</td>' +
            '<td><span class="chip-status chip-sm neutral">' + esc(s.kindLabel) + '</span></td>' +
            '<td style="white-space:normal;min-width:220px;">' + esc(s.label) + '</td>' +
            '<td>' + esc(s.scope) + '</td>' +
            '<td style="white-space:normal;min-width:200px;color:var(--text-gray);font-size:var(--fs-12);">' + esc(s.line) + '</td>' +
            '<td><span class="chip-status chip-sm ' + V().toneOf(s.status) + '">' + esc(s.status) + '</span>' +
                (s.latest ? '' : ' <span class="chip-status chip-sm neutral" title="이후 재상신되어 최신 건이 아닙니다">이전</span>') + '</td>' +
            '<td class="col-action">' +
                '<button type="button" class="btn btn-outline btn-sm" onclick="EDUAPVLOG.openDoc(\'' + esc(s.sid) + '\')">문서</button> ' +
            '</td>' +
        '</tr>';
    }

    function setF(k, v) { state['f' + k] = v; EDUFILTER.rerender(render); }
    function resetF() { state.fQ = ''; state.fKind = ''; state.fStatus = ''; state.fYear = ''; render(); }
    function openDoc(sid) { if (global.EDUDOC) global.EDUDOC.openDocSid(sid); }
    /* 결재 상태 회신(완료·반려)은 온나라 연동 몫이라 이 화면에서 만들지 않는다.
       연동 전에는 상신된 사실과 문서만 보여 준다 — 없는 기능을 버튼으로 약속하지 않는다. */

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        if (global.EDUDOC) global.EDUDOC.registerRefresh(render);
        render();
    }

    global.EDUAPVLOG = {
        init: init, setF: setF, resetF: resetF, openDoc: openDoc
    };
})(window);
