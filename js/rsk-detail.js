/* =====================================================================
   rsk-detail.js · 위험성평가 상세 (RSK02-D)
   · 공정별 진행 표(담당·평가·감소대책·재평가) · 완료 통제(전공정완료+전대책완료+재평가허용)
   · 공정 행 → rsk-exec.html
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYRSK; };
    var KO = function () { return global.DYRSK.KOSHA; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }

    var state = { aid: null, mount: null };

    function estChip(st) {
        var m = { DONE: ['완료', 'st-done'], DOING: ['진행중', 'st-doing'], TODO: ['진행전', 'st-todo'] }[st] || ['진행전', 'st-todo'];
        return '<span class="chip-mini ' + m[1] + '">' + m[0] + '</span>';
    }

    function render() {
        var a = D().assessmentOf(state.aid);
        if (!a) { state.mount.innerHTML = '<div class="v2-empty">평가를 찾을 수 없습니다.</div>'; return; }
        var t = KO().targetOf(a.targetId);
        var procs = D().assessmentProcesses(a);
        var typeBadge = a.type === 'REGULAR' ? '<span class="type-badge reg">정기</span>' : '<span class="type-badge occ">수시</span>';
        var statusChip = V().statusChip ? '' : '';
        var gate = D().completionGate(a.id);

        var head =
            '<div class="rd-head"><div class="rd-head-top">' +
                '<div class="rd-title">' + typeBadge + a.year + ' ' + esc(a.title) + ' — ' + esc(t ? t.name : '') +
                    ' <span class="chip-mini ' + (a.status === 'COMPLETED' ? 'st-done' : 'st-doing') + '">' + (a.status === 'COMPLETED' ? '완료' : '진행중') + '</span></div>' +
            '</div>' +
            '<div class="rd-meta">' +
                '<span>추정 기법 <b>' + esc(D().methodLabel(a.method)) + '</b></span>' +
                '<span>평가팀 <b>' + (a.team && a.team.length ? esc(a.team.join(', ')) : '미구성') + '</b></span>' +
                '<span>근로자 참여 <b>' + (a.worker_participation ? '반영' : '미기록') + '</b></span>' +
                (a.type === 'OCCASIONAL' && a.change_reason ? '<span>변경 사유 <b>' + esc(a.change_reason) + '</b></span>' : '') +
            '</div></div>';

        var rows = procs.length ? procs.map(function (p) {
            var st = D().procEstStatus(a.id, p.id);
            var ms = D().measuresOf(a.id).filter(function (m) { return m.process_id === p.id; });
            var msDone = ms.filter(function (m) { return m.status === 'DONE'; }).length;
            var msTxt = ms.length ? (msDone === ms.length ? '완료 ' + ms.length : msDone + '/' + ms.length + ' 조치중') : '-';
            var reTxt = '-';
            if (ms.length) {
                var reOk = ms.filter(function (m) { return m.status === 'DONE' && m.reassessed; }).length;
                reTxt = (msDone === 0) ? '대기' : (reOk === ms.length ? '허용' : '대기');
            }
            return '<tr onclick="RSKDETAIL.exec(\'' + p.id + '\')">' +
                '<td class="rd-proc-name">' + esc(p.name) + '</td>' +
                '<td>' + (p.evaluator ? esc(p.evaluator) : '<span style="color:var(--status-danger-fg)">미지정</span>') + '</td>' +
                '<td>' + estChip(st) + '</td>' +
                '<td>' + esc(msTxt) + '</td>' +
                '<td>' + reTxt + '</td></tr>';
        }).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text-lightgray);">대상 공정이 없습니다.</td></tr>';

        var table =
            '<table class="rd-table"><thead><tr>' +
                '<th>공정</th><th>담당 평가자</th><th>평가</th><th>감소대책</th><th>재평가</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table>';

        function grow(label, cond) {
            return '<div class="rd-gate-row"><span class="chip-mini ' + (cond.ok ? 'st-done' : 'st-todo') + '">' + (cond.ok ? '충족' : '미충족') + '</span>' +
                label + ' <b>(' + cond.done + '/' + cond.total + ')</b></div>';
        }
        var gateCard =
            '<div class="rd-gate"><div class="rd-gate-title">완료 조건</div>' +
                grow('전 공정 평가 완료', gate.eval) +
                grow('전 감소대책 조치 완료', gate.measure) +
                grow('조치 후 재평가 완료(허용)', gate.reassess) +
                '<div class="rd-gate-foot">' +
                    '<button type="button" class="btn ' + (gate.pass ? 'btn-primary' : 'btn-secondary') + '"' +
                        (gate.pass ? '' : ' disabled') + ' onclick="RSKDETAIL.complete()">완료·보고서·결재</button>' +
                '</div>' +
                (gate.pass ? '' : '<p style="font-size:12px;color:var(--text-gray);text-align:right;margin-top:6px;">조건 충족 시 활성화됩니다.</p>') +
            '</div>';

        state.mount.innerHTML = head + table + gateCard;
    }

    function exec(pid) { location.href = 'rsk-exec.html?id=' + state.aid + '&pid=' + pid; }
    function complete() {
        V().openModal('완료·보고서·결재 (RSK05-D)',
            '<p>완료 조건을 충족했습니다. 법정 보고서 생성·온나라 결재(RSK05-D)는 <b>후속 단계</b>에서 제공됩니다.</p>',
            '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal()">확인</button>');
    }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        state.aid = new URLSearchParams(location.search).get('id');
        render();
    }

    global.RSKDETAIL = { init: init, exec: exec, complete: complete };
})(window);
