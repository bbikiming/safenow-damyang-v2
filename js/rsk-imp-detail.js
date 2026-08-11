/* =====================================================================
   rsk-imp-detail.js · 개선조치 상세·조치 (IMP01-D)
   · 출처·유해위험요인·조치전 사진 · 조치내용+조치후 사진 → [완료 처리]
   · risk_assessment 출처면 완료 시 정기평가 완료율(N/M)에 자동 반영
     (재평가·위험성 추정 단계는 재설계 v1에서 폐지)
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYRSK; };
    var KO = function () { return global.DYRSK.KOSHA; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    /* 유해위험요인의 법령 근거 — DYLAW 칩(CLAUDE.md §10). 근거는 선택 항목이라 없으면 그리지 않는다. */
    function basisHtml(h) {
        var b = h && h.basis;
        if (!b) return '';   /* 근거는 선택 항목 — 없으면 자리 자체를 만들지 않는다 */
        return window.DYLAW ? DYLAW.basisChip(b) : '<span class="law-basis-plain">' + esc(b) + '</span>';
    }

    function toast(m) { V().toast(m); }

    var state = { id: null, mount: null, action: '', doneDate: '', photo: '', photoFile: null, sign: '' };

    function srcBadge(t) { var m = D().SRC_META[t] || D().SRC_META.manual; return '<span class="src-badge ' + (m.tone === 'info' ? 'info' : 'neutral') + '">' + esc(m.label) + '</span>'; }

    function render() {
        var m = D().improvementOf(state.id);
        if (!m) { state.mount.innerHTML = '<div class="v2-empty">개선조치를 찾을 수 없습니다.</div>'; return; }
        var t = KO().targetOf(m.target_id);
        var isRA = m.source_type === 'risk_assessment';
        /* 수시평가에서 나온 조치도 유해위험요인·근거를 그대로 갖는다 — 출처만 다르다.
           평가 링크(rsk-detail)는 정기평가에만 있으므로 isRA 로 남긴다. */
        var hasHz = !!(m.hazard && m.hazard.name);
        /* 확인 반려 건은 완료 상태여도 담당자가 다시 제출해야 한다(DYRSK.needsAction 단일 판정) */
        var cf = D().confirmOf ? D().confirmOf(m) : { state: 'WAIT', round: 1 };
        var returned = D().confirmState ? D().confirmState(m) === 'RETURNED' : false;
        var isDone = m.status === 'DONE' && !returned;

        var head =
            '<div class="id-card">' +
                '<div class="id-title">' + srcBadge(m.source_type) + ' ' + esc(m.description) + '</div>' +
                '<div class="id-meta">' +
                    '<span>관리대상 <b>' + esc(t ? t.name : '-') + '</b></span>' +
                    (hasHz && m.hazard_risk_factor ? '<span>유해위험요인 <b>' + esc(m.hazard_risk_factor) + '</b></span>' : '') +
                    /* 시설물 — 위험성평가 검수에서 지정한 대상(미지정이면 줄 자체를 내지 않는다) */
                    (D().facilLabel && D().facilLabel(m) ? '<span>시설물 <b>' + esc(D().facilLabel(m)) + '</b></span>' : '') +
                    (hasHz && m.hazard && m.hazard.basis ? '<span>법령 근거 ' + basisHtml(m.hazard) + '</span>' : '') +
                    (m.occ_id ? '<span>수시평가 <b>' + esc(m.occ_id) + '</b></span>' : '') +
                    '<span>담당자 <b>' + esc(m.assigned_to || '미지정') + '</b></span>' +
                    '<span>기한 <b>' + esc(m.due_date || '-') + '</b></span>' +
                    (isRA ? '<span>평가 <b><a href="rsk-detail.html?id=' + esc(m.assessment_id) + '" style="color:var(--main-dark);">' + esc(m.assessment_id) + '</a></b></span>' : '') +
                '</div>' +

                '<div class="id-sec"><div class="id-sec-title">대책 내용 (조치 전)</div>' +
                    '<div class="id-desc">' + esc(m.description) + '</div>' +
                    '<div style="margin-top:8px;"><span class="id-photo">' + (m.before_photo ? '조치 전 사진' : '사진 없음') + '</span></div></div>' +

                (returned
                    ? '<div class="mw-returned" role="note"><b>재난안전과 반려</b> · ' + esc(cf.at || '') + ' · ' + esc(cf.by || '') +
                      ((cf.round || 1) > 1 ? ' <span class="mw-returned-r">' + cf.round + '회차 제출</span>' : '') +
                      '<p>' + esc(cf.reason || '') + '</p>' +
                      '<span class="mw-returned-how">증빙을 보완해 <b>재제출</b>하면 확인 대기로 돌아갑니다.</span></div>'
                    : '') +
                (isDone ? doneSecHtml(m, isRA) : actionSecHtml(m)) +
            '</div>';

        state.mount.innerHTML = head;
    }

    /* 완료 결과 — 완료일과 전자서명(누가 언제 확인했는지)까지 남겨야 증빙이 된다 (2026-07-30 회의) */
    function doneSecHtml(m, isRA) {
        var sig = m.signature || {};
        return '<div class="id-sec"><div class="id-sec-title">조치 결과 (완료)</div>' +
            '<div class="id-desc">' + esc(m.action_content || '조치 완료') + '</div>' +
            '<div class="id-meta" style="margin-top:8px;">' +
                '<span>조치 요구일 <b>' + esc(m.due_date || m.due || '-') + '</b></span>' +
                '<span>완료일 <b>' + esc(m.completed_date || '-') + '</b></span>' +
                '<span>완료 확인 <b>' + (sig.by ? esc(sig.by) + ' (전자서명 ' + esc(sig.at || '-') + ')' : '-') + '</b></span>' +
            '</div>' +
            '<div style="margin-top:8px;"><span class="id-photo">' +
                esc(typeof m.after_photo === 'string' ? m.after_photo : '개선 후 사진') + '</span></div>' +
            '<div class="id-done-note" style="margin-top:12px;">조치 완료' +
                (isRA ? ' · 정기 위험성평가 완료율에 반영되었습니다.' : '') + '</div></div>';
    }
    /* 조치 실시 — 개선 후 사진은 필수 증빙이다("이 개선 후를 사진을 올리기만 하면 돼요") */
    function actionSecHtml(m) {
        var photo = state.photo;
        return '<div class="id-sec"><div class="id-sec-title">조치 실시</div>' +
            '<div class="id-meta" style="margin-bottom:10px;">' +
                '<span>조치 요구일 <b>' + esc(m.due_date || m.due || '-') + '</b></span>' +
                '<span>담당자 <b>' + esc(m.assigned_to || '미지정') + '</b></span>' +
            '</div>' +
            '<div class="id-frow"><label class="form-label" for="id-action">조치 내용 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<textarea class="form-textarea" id="id-action" rows="3" placeholder="실제 조치한 내용을 입력하세요">' + esc(state.action || '') + '</textarea></div>' +
            '<div class="id-frow"><label class="form-label" for="id-done-date">완료일 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="date" class="form-input" id="id-done-date" value="' + esc(state.doneDate || D().today()) + '" style="max-width:180px;"></div>' +
            '<div class="id-frow"><label class="form-label">개선 후 사진 <span style="color:var(--status-danger-fg)">*</span></label>' +
                (photo
                    ? '<span class="id-photo">' + esc(photo) + '</span>' +
                      ' <button type="button" class="btn btn-outline btn-sm" onclick="RSKIMPD.clearPhoto()">×</button>'
                    : V().uploadDrop('<b>개선 후 사진</b> <span style="font-size:var(--fs-12);color:var(--text-gray);">클릭 또는 끌어놓기</span>',
                        null, { pick: 'RSKIMPD.onPickPhoto', style: 'padding:12px;' })) +
                '</div>' +
            '<div class="id-frow"><label class="form-label" for="id-sign">완료 확인 (전자서명) <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="text" class="form-input" id="id-sign" value="' + esc(state.sign || signerDefault()) + '" placeholder="확인자 이름" style="max-width:220px;">' +
                '<p class="file-hint">이름을 입력하면 완료일자와 함께 전자서명으로 기록됩니다.</p></div>' +
            '<div class="id-foot">' + (canAct(m)
                ? '<button type="button" class="btn btn-primary" onclick="RSKIMPD.complete()">' +
                  (D().confirmState && D().confirmState(m) === 'RETURNED' ? '재제출' : '완료 처리') + '</button>'
                : '<span class="mw-readonly" style="margin:0;">' +
                  '<span><b>조회 전용</b> — 완료 처리·전자서명은 <b>담당 부서 본인</b>이 수행합니다.</span></span>') +
            '</div></div>';
    }
    function signerDefault() {
        var p = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        return p ? p.name : '';
    }

    function capture() {
        var el = function (id) { return document.getElementById(id); };
        if (el('id-action')) state.action = el('id-action').value;
        if (el('id-done-date')) state.doneDate = el('id-done-date').value;
        if (el('id-sign')) state.sign = el('id-sign').value;
    }
    /* 실제 파일을 고른다 — 이 사진 한 장이 조치 완료의 증빙이라 파일명만 지어내면 소명할 수 없다 */
    function onPickPhoto(files) {
        capture();
        var f = files && files[0]; if (!f) return;
        state.photoFile = f; state.photo = f.name;
        render();
        toast('개선 후 사진 첨부');
    }
    function clearPhoto() { capture(); state.photo = ''; state.photoFile = null; render(); }

    /* 완료 처리는 **그 부서 담당자 본인**만 — 군수·과장이 담당자 이름으로 서명하면 문서 위조다 */
    function canAct(m) {
        var p = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        if (!p) return true;
        if (p.tier !== 'staff') return false;
        return !!p.deptId && p.deptId === (m && m.dept_id);
    }
    function complete() {
        var mm = D().improvementOf(state.id);
        if (!canAct(mm)) { toast('이 부서의 담당자만 완료 처리할 수 있습니다.'); return; }
        capture();
        var action = (state.action || '').trim();
        if (!action) { toast('조치 내용을 입력하세요.'); var a = document.getElementById('id-action'); if (a) a.focus(); return; }
        if (!state.doneDate) { toast('완료일을 입력하세요.'); return; }
        /* 개선 후 사진은 법적 증빙이라 없으면 완료로 넘기지 않는다 */
        if (!state.photo) { toast('개선 후 사진을 첨부하세요 — 조치 완료의 증빙입니다.'); return; }
        var sign = (state.sign || '').trim();
        if (!sign) { toast('완료 확인 서명(이름)을 입력하세요.'); var s = document.getElementById('id-sign'); if (s) s.focus(); return; }
        D().completeImprovement(state.id, {
            action: action, by: sign, signedBy: sign,
            completedDate: state.doneDate, afterPhoto: state.photo,
            afterPhotos: state.photoFile ? [state.photoFile] : []
        });
        state.action = ''; state.photo = ''; state.photoFile = null; state.sign = ''; state.doneDate = '';
        render();
        toast('조치 완료 처리 · 전자서명 기록');
    }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        state.id = new URLSearchParams(location.search).get('id');
        render();
    }

    global.RSKIMPD = { init: init, complete: complete, onPickPhoto: onPickPhoto, clearPhoto: clearPhoto };
})(window);
