/* =====================================================================
   edu-apv-log.js · 안전보건교육 결재 이력 (EDU-APV-LOG · 전역 EDUAPVLOG)
   ---------------------------------------------------------------------
   근거: docs/planning/기획-안전보건교육-온나라결재상신-v1.md **v1.2**(2026-08-12)
   교육에서 온나라로 보낸 공문을 한 화면에서 조회한다. 공문은 과정마다 나간다(2026-11-16) — 교육 안내 ·
   참석자 등록부 제출 · 출장 결과 보고 · 부서 실시 결과 보고(등록 묶음) · 이전 방식 실시 결과.
   구 3종(총괄·교육별·개인별)과 분기 보고는 걷었다(되살리지 말 것 · CLAUDE.md §4).
   · 데이터는 EDUDOC.submissions() 만 소비한다 — 스토어 구조·라벨을 화면이 직접 읽지 않는다.
   · 보는 사람은 재난안전과 소속만(2026-11-13 답신 5장) — EDUDOC.canViewHistory 가 판정하고 그 밖에는 안내만 그린다.
   · 행 액션: [공문 보기] 상신 당시 컨텍스트로 문서 다시 보기. **[상태] 버튼은 두지 않는다** —
     결재 완료·반려 회신은 온나라 연동 몫이라 이 화면이 만들 수 있는 것이 없다.
   · 재상신으로 밀려난 과거 건은 '이전' 배지로 구분한다.
   표준: 통계 .statbox · 필터 EDUFILTER · 표 .table-figma(.table-compact·.table-nowrap)
        · 배지 chip-status + DYV2.toneOf · 빈상태 .v2-empty
   ===================================================================== */
(function (global) {
    'use strict';
    var V = function () { return global.DYV2; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }

    var state = { mount: null, fQ: '', fStatus: '', fYear: '', fKind: '', fDept: '' };

    /* 상신은 EDUDOC(공문)이 한다 — 이력도 거기서 읽는다. 상신 경로가 바뀌면
       이력 출처도 함께 옮긴다. 옛 경로만 읽으면 공문을 올려도 0건으로 남는다. */
    function all() { return (global.EDUDOC && global.EDUDOC.submissions) ? global.EDUDOC.submissions() : []; }
    /* 상태 어휘는 교육 전 화면 공통(EDUDOC 한 곳) — 결재 미완료(기안함 전송·결재중) / 결재 완료 / 반려 / 반송 · 등록 취소 */
    var WITHDRAWN = '등록 취소';
    function stOf(s) { return s.withdrawn ? WITHDRAWN : (global.EDUDOC && global.EDUDOC.stLabel ? global.EDUDOC.stLabel(s.status) : s.status); }
    function filtered(list) {
        return list.filter(function (s) {
            if (state.fStatus && stOf(s) !== state.fStatus) return false;
            if (state.fYear && String(s.at || '').slice(0, 4) !== state.fYear) return false;
            /* 공문 종류는 줄에 보이는 이름 그대로 거른다 — 필터와 줄의 이름이 갈리지 않게 */
            if (state.fKind && s.docKindLabel !== state.fKind) return false;
            if (state.fDept && s.fromDept !== state.fDept) return false;
            return EDUFILTER.match(state.fQ, [s.no, s.label, s.scope, s.line, s.docKindLabel]);
        });
    }

    /* 종전에는 '상신 차단 안내'를 조건부로 그리는 분기가 있었다. 공문 흐름(DYDOC/
       EDUDOC)이 갖춰진 2026-08-12 부터 그 조건은 **항상 거짓**이라 도달할 수 없는
       죽은 코드였다 — 지운다. 차단 국면은 더 이상 없고 이 화면의 국면은 하나다. */

    function render() {
        if (!state.mount) return;
        /* 보는 사람은 재난안전과만(답신 5장) — 판정은 EDUDOC.canViewHistory 한 곳 */
        if (global.EDUDOC && global.EDUDOC.canViewHistory && !global.EDUDOC.canViewHistory()) {
            state.mount.innerHTML = '<div class="edu-card"><div class="v2-empty">' + esc(global.EDUDOC.historyDenyNote()) +
                '<br>교육 실시 결과는 각 교육 화면의 이수 현황에서 확인합니다.</div></div>';
            return;
        }
        var list = all();
        var rows = filtered(list);
        /* 다시 보내 밀려난 이전 건(latest=false)은 상태 지표에서 뺀다 — 반려 뒤 재기안해 결재완료된 공문이 «반려»에 계속 남으면 지금 반려 상태인 공문 수가 부풀어 보인다(2026-11-13) */
        var cnt = function (lab) { return list.filter(function (s) { return stOf(s) === lab && s.latest !== false; }).length; };

        /* **도달할 수 없는 축을 지표로 두지 않는다** — 결재 완료·반려는 온나라가 회신해야
           생기는 상태이고 연동이 아직 없다. 칩으로 걸어 두면 영영 0 인 칸이 두 개 남아
           "우리가 못 하고 있다"로 오독된다. 회신이 붙으면 그때 축을 늘린다. */
        var done = cnt('결재 완료'), rej = cnt('반려');
        var stats =
            '<div class="statbox-grid cols-4" style="margin-bottom:12px;">' +
                '<div class="statbox info"><div class="statbox-num">' + list.length + '</div><div class="statbox-label">온나라로 보낸 공문 (건)</div></div>' +
                /* 보낸 직후는 «기안함 전송»(담당자가 온나라에서 상신 전), 연계가 상신을 알려 오면 «결재중» — 둘 다 진행 중이다 */
                '<div class="statbox info"><div class="statbox-num">' + cnt('결재 미완료') + '</div><div class="statbox-label">결재 미완료</div></div>' +
                (done || rej
                    ? '<div class="statbox success"><div class="statbox-num">' + done + '</div><div class="statbox-label">결재 완료</div></div>' +
                      '<div class="statbox ' + (rej ? 'danger' : 'neutral') + '"><div class="statbox-num">' + rej + '</div><div class="statbox-label">반려</div></div>'
                    : '<div class="statbox neutral" style="grid-column:span 2;"><div class="statbox-label" style="text-align:left;">' +
                      /* 개발 상태(연동 전)를 말하지 않고 할 일만 — 운영 문구 원칙(2026-11-05).
                         상신 직후에는 문서번호가 아직 없으므로 «문서번호로 확인»이라 쓰지 않는다(§7-1). */
                      '<b>결재 완료·반려는 온나라 회신으로 채워집니다</b><br>결재 진행은 온나라에서 확인합니다.</div></div>') +
            '</div>';

        var bar = EDUFILTER.bar([
            { type: 'search', id: 'eal-q', value: state.fQ, placeholder: '연계 번호·문서명 검색', on: "EDUAPVLOG.setF('Q', this.value)" },
            { type: 'select', id: 'eal-status', value: state.fStatus, label: '상태',
              /* 목록에 실재하는 상태만 고르게 한다 — 없는 값을 두면 고를 때마다 0건이 된다 */
              options: [['', '상태 전체']].concat(
                  ['결재 미완료', '결재 완료', '반려', '반송', WITHDRAWN].filter(function (lab) { return list.some(function (s) { return stOf(s) === lab; }); })
                      .map(function (lab) { return [lab, lab]; })),
              on: "EDUAPVLOG.setF('Status', this.value)" },
            /* 공문 종류 — 줄에 보이는 이름 그대로(교육 안내 · 참석자 등록부 제출 · 출장 결과 보고 · ○○ 실시 결과 · 이전 방식) */
            { type: 'select', id: 'eal-kind', value: state.fKind, label: '공문 종류',
              options: [['', '공문 종류 전체']].concat(list.map(function (s) { return s.docKindLabel; })
                  .filter(function (k, i, a) { return k && a.indexOf(k) === i; })
                  .map(function (k) { return [k, k]; })),
              on: "EDUAPVLOG.setF('Kind', this.value)" },
            /* 보낸 부서 — 부서 공문이 많아져 분기·부서별로 모아 보는 자리(2차 통화 검수 M-7) */
            { type: 'select', id: 'eal-dept', value: state.fDept, label: '보낸 부서',
              options: [['', '보낸 부서 전체']].concat(list.map(function (s) { return s.fromDept; }).filter(function (d, i, a) { return d && a.indexOf(d) === i; }).sort().map(function (d) { return [d, d]; })),
              on: "EDUAPVLOG.setF('Dept', this.value)" },
            { type: 'select', id: 'eal-year', value: state.fYear, label: '보낸 연도',
              options: EDUFILTER.yearOptions(list.map(function (s) { return s.at; }), '보낸 연도 전체'),
              on: "EDUAPVLOG.setF('Year', this.value)" }
        ], { count: rows.length, unit: '건', reset: 'EDUAPVLOG.resetF()' });

        var body = rows.length ? rows.map(rowHtml).join('')
            : '<tr><td colspan="7"><div class="v2-empty">' +
                /* 빈 상태는 **도달 가능한 행동만** 약속한다 — 공문은 각 교육 화면에서 과정마다 보낸다(2026-11-16) */
                (list.length ? '조건에 맞는 공문이 없습니다.'
                             : '아직 온나라로 보낸 공문이 없습니다. 교육 안내·참석자 등록부 제출·출장 결과 보고·실시 결과 보고 공문을 보내면 여기에 쌓입니다.') +
              '</div></td></tr>';

        state.mount.innerHTML = stats + bar +
            '<div class="edu-card"><div class="edu-scroll">' +
            '<table class="table-figma table-compact table-nowrap"><thead><tr>' +
                /* «대상» 열은 걷었다 — 문서명과 같은 글이 두 번 보였다(2차 통화 검토 C-3) */
                '<th>연계 번호</th><th>보낸 날</th><th>공문 종류</th><th>보낸 부서</th><th>문서명</th>' +
                '<th>상태</th><th>관리</th>' +
            '</tr></thead><tbody>' + body + '</tbody></table>' +
            '</div></div>';
    }

    function rowHtml(s) {
        return '<tr>' +
            '<td class="edu-name">' + esc(s.no) + '</td>' +
            '<td>' + esc(s.at) + '</td>' +
            '<td><span class="chip-status chip-sm neutral">' + esc(s.docKindLabel || s.kindLabel) + '</span></td>' +
            '<td>' + esc(s.fromDept || '-') + '</td>' +
            '<td style="white-space:normal;min-width:220px;">' + esc(s.label) + '</td>' +
            '<td>' + (s.withdrawn
                    ? '<span class="chip-status chip-sm neutral" title="' + esc('온나라 ' + s.status + ' 뒤 ' + String(s.withdrawn).slice(0, 10) + ' 등록 취소') + '">' + WITHDRAWN + '</span>'
                    : (global.EDUDOC && global.EDUDOC.chipHtml ? global.EDUDOC.chipHtml(s.status) : esc(s.status))) +
                (s.latest ? '' : ' <span class="chip-status chip-sm neutral" title="이후 다시 보내 최신 건이 아닙니다">이전</span>') + '</td>' +
            '<td class="col-action">' + (s.withdrawn
                ? '<span class="file-hint">온나라에서 봅니다</span>'
                : '<button type="button" class="btn btn-outline btn-sm" onclick="EDUAPVLOG.openDoc(\'' + esc(s.sid) + '\')">공문 보기</button>') +
            '</td>' +
        '</tr>';
    }

    function setF(k, v) { state['f' + k] = v; EDUFILTER.rerender(render); }
    function resetF() { state.fQ = ''; state.fStatus = ''; state.fYear = ''; state.fKind = ''; state.fDept = ''; render(); }
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
