/* =====================================================================
   rsk-exec.js · 위험성 추정 (RSK03-EXEC) — 기존 3화면(4M·체크리스트·게이트) 통합
   · 확정본 유해위험요인 자동 호출 · 기법 셀렉터(4×4/3단계/체크리스트)
   · 빈도×강도 → 등급/허용 색상 · 허용초과 → 인라인 감소대책 패널 → 개선조치(IMP) 생성
   · [이 공정 평가 완료] 잠금 · 재평가 모드
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYRSK; };
    var KO = function () { return global.DYRSK.KOSHA; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }

    var state = { aid: null, pid: null, mount: null, method: '4x4', rows: [], done: false, panel: null, reassess: false };

    function managers() {
        var re = /(과장|팀장|소장|실장|담당|관리자)/, out = [];
        (V().orgFlat() || []).forEach(function (d) { d.members.forEach(function (m) { if (re.test(m[0])) out.push(d.dept + ' · ' + m[0] + ' / ' + m[1]); }); });
        return out;
    }

    function load() {
        var p = D().processOf(state.pid);
        var e = D().estimation(state.aid, state.pid);
        if (e) {
            state.method = e.method || 'method' in e ? e.method : '4x4';
            state.done = !!e.done;
            state.rows = (e.rows || []).map(function (r) { return { hrfId: r.hrfId, name: r.name, basis: r.basis || '', freq: r.freq || 0, severity: r.severity || 0 }; });
        }
        if (!state.rows.length && p) {
            state.rows = (p.hrf || []).map(function (h) { return { hrfId: h.id, name: h.name, basis: h.legal_status === 'MAPPED' ? h.basis : '(법령 매핑 대기)', freq: 0, severity: 0 }; });
        }
        // 재평가 모드
        if (new URLSearchParams(location.search).get('mode') === 'reassess') { state.reassess = true; state.done = false; }
    }

    function persist() { D().saveEstimation(state.aid, state.pid, { done: state.done, method: state.method, rows: state.rows }); }

    function measureFor(rowName) {
        return D().measuresOf(state.aid).filter(function (m) { return m.process_id === state.pid && m.hazard_risk_factor === rowName; })[0] || null;
    }

    function render() {
        var a = D().assessmentOf(state.aid), p = D().processOf(state.pid);
        if (!a || !p) { state.mount.innerHTML = '<div class="v2-empty">대상을 찾을 수 없습니다.</div>'; return; }
        document.getElementById('re-back').href = 'rsk-detail.html?id=' + state.aid;

        var m = D().METHODS[state.method];
        var isCheck = state.method === 'checklist';
        var editable = !state.done;

        var head =
            '<div class="re-head"><div class="re-head-main">' +
                '<div class="re-title">' + esc(p.name) + (state.reassess ? ' · 재평가' : '') + '</div>' +
                '<div class="re-sub">담당 평가자 ' + esc(p.evaluator || '미지정') + ' · ' + a.year + ' ' + esc(a.title) + '</div>' +
            '</div>' +
            '<div class="re-method"><label>추정 기법</label>' +
                '<select class="form-select" ' + (editable ? '' : 'disabled') + ' onchange="RSKEXEC.setMethod(this.value)">' +
                    Object.keys(D().METHODS).map(function (k) { return '<option value="' + k + '"' + (k === state.method ? ' selected' : '') + '>' + esc(D().METHODS[k].label) + '</option>'; }).join('') +
                '</select></div></div>';

        var doneNote = state.done ? '<div class="re-done-note">이 공정 평가가 완료되어 잠금(보기 모드)입니다. 조치 완료 후 [재평가]로 재추정할 수 있습니다.</div>' : '';

        var rows = state.rows.map(function (r, i) {
            var g = D().gradeOf(state.method, r.freq, r.severity);
            var freqCell, sevCell;
            if (isCheck) {
                freqCell = '<select class="re-sel" ' + (editable ? '' : 'disabled') + ' onchange="RSKEXEC.setF(' + i + ',this.value)">' +
                    '<option value="0"' + (!r.freq ? ' selected' : '') + '>-</option>' +
                    '<option value="1"' + (r.freq === 1 ? ' selected' : '') + '>적합(O)</option>' +
                    '<option value="2"' + (r.freq === 2 ? ' selected' : '') + '>부적합(X)</option></select>';
                sevCell = '<span style="color:var(--text-lightgray)">—</span>';
            } else {
                freqCell = scaleSel(i, 'F', r.freq, m.fMax, editable);
                sevCell = scaleSel(i, 'S', r.severity, m.sMax, editable);
            }
            var gradeCell = g.grade ? '<span class="re-grade g-' + g.grade + '">' + esc(g.label) + (isCheck ? '' : ' ' + g.score) + '</span>' : '<span style="color:var(--text-lightgray)">-</span>';
            var accCell = g.acceptable == null ? '-' : (g.acceptable ? '<span class="re-accept ok">허용</span>' : '<span class="re-accept no">허용초과</span>');
            var measure = measureFor(r.name);
            var measureCell = '-';
            if (g.acceptable === false) {
                measureCell = measure
                    ? '<span class="re-measure-has">대책 ' + (measure.status === 'DONE' ? '조치완료' : '등록') + '</span>'
                    : (editable ? '<button type="button" class="re-measure-btn" onclick="RSKEXEC.openMeasure(' + i + ')">대책 입력</button>' : '미입력');
            }
            var panelHtml = (state.panel && state.panel.row === i) ? renderPanel(i, r) : '';
            return '<tr>' +
                '<td><div class="re-hrf-name">' + esc(r.name) + '</div><div class="re-hrf-basis">근거 ' + esc(r.basis) + '</div>' + panelHtml + '</td>' +
                '<td>' + freqCell + '</td><td>' + sevCell + '</td><td>' + gradeCell + '</td><td>' + accCell + '</td><td>' + measureCell + '</td>' +
            '</tr>';
        }).join('');

        var table = '<table class="re-table"><thead><tr>' +
            '<th>유해위험요인</th><th>' + (isCheck ? '판정' : '빈도') + '</th><th>' + (isCheck ? '' : '강도') + '</th><th>위험성</th><th>허용여부</th><th>감소대책</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table>';

        var actions = editable
            ? '<div class="re-actions">' +
                '<button type="button" class="btn btn-outline" onclick="RSKEXEC.saveTemp()">임시저장</button>' +
                '<button type="button" class="btn btn-primary" onclick="RSKEXEC.complete()">이 공정 평가 완료</button></div>'
            : '<div class="re-actions"><button type="button" class="btn btn-primary" onclick="RSKEXEC.reassessMode()">재평가</button></div>';

        state.mount.innerHTML = head + doneNote + table + actions;
    }

    function scaleSel(i, axis, val, max, editable) {
        var opts = '<option value="0"' + (!val ? ' selected' : '') + '>-</option>';
        for (var v = 1; v <= max; v++) opts += '<option value="' + v + '"' + (val === v ? ' selected' : '') + '>' + v + '</option>';
        return '<select class="re-sel" ' + (editable ? '' : 'disabled') + ' onchange="RSKEXEC.set' + axis + '(' + i + ',this.value)">' + opts + '</select>';
    }

    function renderPanel(i, r) {
        var mgrs = managers();
        var std = '표준 감소대책: ' + esc(r.name) + ' — 방호·보호구·작업허가 등 위험성 저감';
        return '<div class="re-panel">' +
            '<div class="re-prow"><label class="form-label">대책 내용</label>' +
                '<textarea class="form-textarea" id="re-desc" rows="2">' + esc(std) + '</textarea></div>' +
            '<div class="re-grid2">' +
                '<div class="re-prow"><label class="form-label">담당자</label>' +
                    '<select class="form-select" id="re-owner"><option value="">-- 선택 --</option>' +
                        mgrs.map(function (mm) { return '<option>' + esc(mm) + '</option>'; }).join('') + '</select></div>' +
                '<div class="re-prow"><label class="form-label">조치 기한</label>' +
                    '<input type="date" class="form-input" id="re-due" value="2026-09-30"></div>' +
            '</div>' +
            '<div class="re-prow"><label class="form-label">조치 전 사진</label>' +
                '<button type="button" class="btn btn-outline btn-sm" onclick="DYV2.toast(\'프로토타입: 업로드 생략\')">사진 업로드</button>' +
                '<div class="re-uploadhint">' + (V().fileHint ? V().fileHint() : '') + '</div></div>' +
            '<div class="re-foot"><button type="button" class="btn btn-secondary btn-sm" onclick="RSKEXEC.closeMeasure()">취소</button>' +
                '<button type="button" class="btn btn-primary btn-sm" onclick="RSKEXEC.saveMeasure(' + i + ')">개선조치 생성</button></div>' +
        '</div>';
    }

    function setMethod(v) { state.method = v; render(); }
    function setF(i, v) { state.rows[i].freq = parseInt(v, 10) || 0; render(); }
    function setS(i, v) { state.rows[i].severity = parseInt(v, 10) || 0; render(); }

    function openMeasure(i) { state.panel = { row: i }; render(); }
    function closeMeasure() { state.panel = null; render(); }
    function saveMeasure(i) {
        var r = state.rows[i];
        var desc = (document.getElementById('re-desc').value || '').trim();
        var owner = document.getElementById('re-owner').value;
        var due = document.getElementById('re-due').value;
        if (!owner) { toast('담당자를 선택하세요.'); return; }
        D().addImprovement({ source_type: 'risk_assessment', assessment_id: state.aid, target_id: D().assessmentOf(state.aid).targetId,
            process_id: state.pid, hazard_risk_factor: r.name, description: desc, assigned_to: owner, due_date: due, before_photo: true });
        state.panel = null; persist(); render();
        toast('감소대책 → 개선조치(IMP) 생성 · 담당자 배정');
    }

    function saveTemp() { persist(); toast('임시저장되었습니다.'); }
    function complete() {
        var incomplete = state.rows.filter(function (r) { return !r.freq || (state.method !== 'checklist' && !r.severity); });
        if (incomplete.length) { toast('모든 유해위험요인의 추정을 입력하세요. (' + incomplete.length + '건 미입력)'); return; }
        var overNoMeasure = state.rows.filter(function (r) {
            var g = D().gradeOf(state.method, r.freq, r.severity);
            return g.acceptable === false && !measureFor(r.name);
        });
        if (overNoMeasure.length) { toast('허용초과 항목의 감소대책을 입력하세요. (' + overNoMeasure.length + '건)'); return; }
        state.done = true; persist();
        if (state.reassess) {
            // 재평가 완료 → 이 공정의 조치완료 감소대책을 '재평가됨(허용 재확인)'으로 표시
            D().measuresOf(state.aid).filter(function (mm) { return mm.process_id === state.pid && mm.status === 'DONE'; })
                .forEach(function (mm) { D().markReassessed(mm.id); });
        }
        render();
        toast(state.reassess ? '재평가 완료 · 허용 재확인' : '이 공정 평가가 완료되었습니다.');
    }
    function reassessMode() { location.href = 'rsk-exec.html?id=' + state.aid + '&pid=' + state.pid + '&mode=reassess'; }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        var q = new URLSearchParams(location.search);
        state.aid = q.get('id'); state.pid = q.get('pid');
        load(); render();
    }

    global.RSKEXEC = {
        init: init, setMethod: setMethod, setF: setF, setS: setS,
        openMeasure: openMeasure, closeMeasure: closeMeasure, saveMeasure: saveMeasure,
        saveTemp: saveTemp, complete: complete, reassessMode: reassessMode
    };
})(window);
