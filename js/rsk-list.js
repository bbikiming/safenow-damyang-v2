/* =====================================================================
   rsk-list.js · 위험성평가 목록 (RSK01-L)
   · 연도별 정기/수시 목록 · 공정 진행 집계 · [＋정기][＋수시] 생성
   · 수시 = 변경분만(scope=CHANGES_ONLY) · [상세] → rsk-detail.html
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYRSK; };
    var KO = function () { return global.DYRSK.KOSHA; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }

    var state = { targetId: 'f_jns', mount: null, fType: '', fStatus: '', occSel: {} };

    function statusChip(st) {
        var map = { IN_PROGRESS: ['진행중', 'st-doing'], COMPLETED: ['완료', 'st-done'], TODO: ['진행전', 'st-todo'] };
        var m = map[st] || ['진행전', 'st-todo'];
        return '<span class="chip-mini ' + m[1] + '">' + m[0] + '</span>';
    }

    function render() {
        if (!state.mount) return;
        var t = KO().targetOf(state.targetId);
        var list = D().assessments(state.targetId).filter(function (a) {
            return (!state.fType || a.type === state.fType) && (!state.fStatus || a.status === state.fStatus);
        });

        var head =
            '<div class="rl-toolbar">' +
                '<div class="rl-tb-left"><label class="rl-tb-label">관리대상</label>' +
                    '<select class="form-select" id="rl-target" onchange="RSKLIST.setTarget(this.value)">' +
                        KO().TARGETS.map(function (x) { return '<option value="' + x.id + '"' + (x.id === state.targetId ? ' selected' : '') + '>' + esc(x.name) + ' · ' + esc(x.dept) + '</option>'; }).join('') +
                    '</select>' +
                    '<span class="rl-tb-label" style="color:var(--text-lightgray);font-weight:400;">업종 ' + esc(t ? t.industry : '-') + '</span></div>' +
                '<div class="rl-tb-right">' +
                    '<button type="button" class="btn btn-outline" onclick="RSKLIST.newRegular()">＋ 정기 평가</button>' +
                    '<button type="button" class="btn btn-primary" onclick="RSKLIST.openOccasional()">＋ 수시 평가</button>' +
                '</div>' +
            '</div>' +
            '<div class="rl-filters">' +
                '<select class="form-select" onchange="RSKLIST.setFType(this.value)"><option value="">유형 전체</option>' +
                    '<option value="REGULAR"' + (state.fType === 'REGULAR' ? ' selected' : '') + '>정기</option>' +
                    '<option value="OCCASIONAL"' + (state.fType === 'OCCASIONAL' ? ' selected' : '') + '>수시</option></select>' +
                '<select class="form-select" onchange="RSKLIST.setFStatus(this.value)"><option value="">상태 전체</option>' +
                    '<option value="IN_PROGRESS"' + (state.fStatus === 'IN_PROGRESS' ? ' selected' : '') + '>진행중</option>' +
                    '<option value="COMPLETED"' + (state.fStatus === 'COMPLETED' ? ' selected' : '') + '>완료</option></select>' +
            '</div>';

        var body = '';
        if (!list.length) {
            body = '<div class="v2-empty">등록된 위험성평가가 없습니다. [＋정기 평가]로 시작하세요.</div>';
        } else {
            var years = {};
            list.forEach(function (a) { (years[a.year] = years[a.year] || []).push(a); });
            Object.keys(years).sort(function (a, b) { return b - a; }).forEach(function (y) {
                body += '<div class="rl-yeargrp"><span class="rl-year">' + y + '</span>' + years[y].map(rowHtml).join('') + '</div>';
            });
        }
        state.mount.innerHTML = head + body;
    }

    function rowHtml(a) {
        var prog = D().assessmentProgress(a.id);
        var typeBadge = a.type === 'REGULAR' ? '<span class="type-badge reg">정기</span>' : '<span class="type-badge occ">수시</span>';
        var sub;
        if (a.status === 'COMPLETED') {
            sub = '완료일 ' + esc(a.completed_at) + ' · ' + esc(a.approval || '승인');
        } else {
            sub = '<span class="rl-prog">공정 <b>' + prog.total + '</b> (완료 ' + prog.done + ' / 진행 ' + prog.doing + ' / 전 ' + prog.todo + ')</span>';
        }
        var title = a.title + (a.type === 'OCCASIONAL' && a.change_reason ? ' — ' + a.change_reason : '');
        var actBtn = a.status === 'COMPLETED'
            ? '<button type="button" class="btn btn-outline btn-sm" onclick="RSKLIST.report(\'' + a.id + '\')">보고서</button>'
            : '<button type="button" class="btn btn-primary btn-sm" onclick="RSKLIST.detail(\'' + a.id + '\')">상세</button>';
        return '<div class="rl-row"><div class="rl-row-main">' +
            '<div class="rl-row-title">' + typeBadge + esc(title) + ' ' + statusChip(a.status) + '</div>' +
            '<div class="rl-row-sub">' + esc(D().methodLabel(a.method)) + ' · ' + sub + '</div>' +
        '</div><div class="rl-row-act">' + actBtn + '</div></div>';
    }

    function setTarget(id) { state.targetId = id; render(); }
    function setFType(v) { state.fType = v; render(); }
    function setFStatus(v) { state.fStatus = v; render(); }
    function detail(id) { location.href = 'rsk-detail.html?id=' + id; }
    function report(id) {
        V().openModal('완료 보고서 · 결재 (RSK05-D)',
            '<p>완료 보고서·온나라 결재(RSK05-D)는 <b>후속 단계</b>에서 제공됩니다. 이번 범위(핵심 흐름)에는 포함되지 않습니다.</p>',
            '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal()">확인</button>');
    }

    /* ＋정기 : 현재 공정 전체 대상 */
    function newRegular() {
        var procs = D().processes(state.targetId);
        if (!procs.length) { toast('작업공정을 먼저 등록하세요. (작업공정 관리)'); return; }
        var year = 2026;
        var dup = D().assessments(state.targetId).filter(function (a) { return a.type === 'REGULAR' && a.year === year; });
        if (dup.length) {
            V().openModal('정기 평가 생성',
                '<p>' + year + '년 정기 위험성평가가 이미 있습니다. 그래도 새로 생성하시겠습니까?</p>',
                '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
                '<button type="button" class="btn btn-primary" onclick="RSKLIST.doRegular()">생성</button>');
            return;
        }
        doRegular();
    }
    function doRegular() {
        V().closeModal();
        var a = D().addAssessment({ targetId: state.targetId, year: 2026, type: 'REGULAR', scope: 'ALL',
            method: '4x4', team: [], worker_participation: false });
        toast('정기 위험성평가 생성 · 현재 공정 전체를 대상으로 읽습니다.');
        location.href = 'rsk-detail.html?id=' + a.id;
    }

    /* ＋수시 : 변경 공정 선택 → CHANGES_ONLY */
    function openOccasional() {
        var procs = D().processes(state.targetId);
        if (!procs.length) { toast('작업공정을 먼저 등록하세요.'); return; }
        state.occSel = {};
        var body =
            '<div class="rl-modal-row"><label class="form-label">변경 사유 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="text" class="form-input" id="rl-occ-reason" placeholder="예: 신규 설비 도입 / 작업방법 변경 / 사고 발생"></div>' +
            '<div class="rl-modal-row"><label class="form-label">변경 공정 선택 (변경분만 평가)</label>' +
                '<div class="rl-chk-list">' +
                    procs.map(function (p) { return '<label class="rl-chk"><input type="checkbox" onchange="RSKLIST.occToggle(\'' + p.id + '\',this.checked)"> ' + esc(p.name) + '</label>'; }).join('') +
                '</div><p style="font-size:12px;color:var(--text-gray);margin-top:6px;">전체 재평가가 필요하면 정기 평가로 생성하세요.</p></div>';
        V().openModal('수시 위험성평가 생성 (변경분만)', body,
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="RSKLIST.doOccasional()">생성</button>');
    }
    function occToggle(pid, on) { if (on) state.occSel[pid] = true; else delete state.occSel[pid]; }
    function doOccasional() {
        var reason = (document.getElementById('rl-occ-reason').value || '').trim();
        var sel = Object.keys(state.occSel).filter(function (k) { return state.occSel[k]; });
        if (!reason) { toast('변경 사유를 입력하세요.'); return; }
        if (!sel.length) { toast('변경 공정을 1건 이상 선택하세요.'); return; }
        V().closeModal();
        var a = D().addAssessment({ targetId: state.targetId, year: 2026, type: 'OCCASIONAL', scope: 'CHANGES_ONLY',
            title: '수시 위험성평가', change_reason: reason, changed_processes: sel, method: '4x4', team: [], worker_participation: false });
        toast('수시 위험성평가 생성 · 변경 공정 ' + sel.length + '건 대상');
        location.href = 'rsk-detail.html?id=' + a.id;
    }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        var q = new URLSearchParams(location.search);
        if (q.get('target')) state.targetId = q.get('target');
        render();
    }

    global.RSKLIST = {
        init: init, setTarget: setTarget, setFType: setFType, setFStatus: setFStatus,
        detail: detail, report: report,
        newRegular: newRegular, doRegular: doRegular,
        openOccasional: openOccasional, occToggle: occToggle, doOccasional: doOccasional
    };
})(window);
