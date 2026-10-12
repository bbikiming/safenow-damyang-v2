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
    /* ===== 조치 실시 — 이 화면에서는 하지 않는다 (2026-08-14 발주처 지시) =====
     * 개선조치는 독립 메뉴가 아니고, 조치 실시(완료 처리)의 창구는 **둘뿐**이다:
     *   ① 위험성평가 화면 안의 조치 상세 카드   ② 내 할일
     * 종전에는 이 화면에도 같은 입력 폼과 [완료 처리]가 있어 **세 번째 창구**가 됐다 —
     * 같은 일을 세 곳에서 할 수 있으면 개발자가 어디를 정본으로 볼지 알 수 없고,
     * 정의서도 "이 화면은 조회용"과 "여기서 완료 처리"를 동시에 적게 된다.
     * 조회는 막지 않고, **어디서 처리하는지**를 대신 밝힌다(막다른 길로 두지 않는다). */
    function actionSecHtml(m) {
        var isRA = m.source_type === 'risk_assessment';
        var backHref = isRA ? 'rsk-list.html' : 'rsk-occ.html';
        var backLabel = isRA ? '정기 위험성평가' : '수시 위험성평가';
        return '<div class="id-sec"><div class="id-sec-title">조치 실시</div>' +
            '<div class="id-meta" style="margin-bottom:10px;">' +
                '<span>조치 요구일 <b>' + esc(m.due_date || m.due || '-') + '</b></span>' +
                '<span>담당자 <b>' + esc(m.assigned_to || '미지정') + '</b></span>' +
                '<span>담당 부서 <b>' + esc(D().deptName(m.dept_id) || '-') + '</b></span>' +
            '</div>' +
            '<div class="mw-readonly" role="note" style="margin:0;">' +
                '<span><b>조회 전용</b> — 이 화면은 조치 내용을 <b>확인</b>하는 자리입니다. ' +
                '조치 결과 등록(조치 내용·완료일·개선 후 사진·전자서명)은 <b>내 할일</b> 또는 ' +
                '<b>' + esc(backLabel) + '</b> 화면의 <b>조치 상세 카드</b>에서 그 부서 담당자가 수행합니다.</span>' +
            '</div>' +
            '<div class="id-foot">' +
                '<a class="btn btn-primary btn-sm" href="my-work.html">내 할일에서 완료 처리</a> ' +
                '<a class="btn btn-outline btn-sm" href="' + backHref + '">' + esc(backLabel) + ' 열기</a>' +
            '</div></div>';
    }

    function capture() {
        var el = function (id) { return document.getElementById(id); };
        if (el('id-action')) state.action = el('id-action').value;
        if (el('id-done-date')) state.doneDate = el('id-done-date').value;
        if (el('id-sign')) state.sign = el('id-sign').value;
    }
    /* 실제 파일을 고른다 — 이 사진 한 장이 조치 완료의 증빙이라 파일명만 지어내면 소명할 수 없다.
       ※ 이 화면이 조회 전용이 된 뒤로는 호출되지 않는다(입력란 자체가 없다). 두 창구
         (내 할일 · 위험성평가 조치 카드)가 같은 일을 하며, 여기 남긴 것은 이 주소로
         들어온 옛 링크가 터지지 않게 하기 위한 것이다. */
    function onPickPhoto(files) {
        capture();
        var f = files && files[0]; if (!f) return;
        state.photoFile = f; state.photo = f.name;
        render();
        toast('개선 후 사진 첨부');
    }
    function clearPhoto() { capture(); state.photo = ''; state.photoFile = null; render(); }
    /* 예시 사진 — 무대에서 OS 파일 대화상자를 여는 건 느리고 위험하다(발표자의 개인
       파일 목록이 그대로 노출된다). 시드가 이미 쓰는 썸네일을 그대로 넣어 증빙 화면까지
       보여준다. 단계별 안내 6단계의 [예시 사진 넣기] 가 부른다 — 실제 입력란은 그대로
       남으므로 증빙 요건을 낮추는 것이 아니다(my-work pickAfterDemo 와 같은 원칙). */
    function pickAfterDemo() {
        var m = D().improvementOf(state.id) || {};
        var thumb = D().demoShot ? D().demoShot('after') : '';
        var nm = ((m.hazard && m.hazard.name) || '개선조치').replace(/\s+/g, '_').slice(0, 20);
        onPickPhoto([{ name: nm + '_개선후.jpg', size: 184320, type: 'image/jpeg', w: 1600, h: 1200, thumb: thumb }]);
    }

    /* 완료 처리는 이 화면의 기능이 아니다 (2026-08-14) — 버튼을 지우는 것만으로는
       전역 호출(RSKIMPD.complete)로 뚫린다. 저장 경로에서 막고 **어디서 하는지** 알린다.
       증빙 요건(조치 내용·완료일·개선 후 사진·전자서명)의 검증은 두 창구가 각자 갖고
       있으므로 여기서 중복해 두지 않는다 — 두 벌이면 한쪽만 고쳐지는 날이 온다. */
    function complete() {
        toast('완료 처리는 내 할일 또는 위험성평가 화면의 조치 상세 카드에서 수행합니다.');
    }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        state.id = new URLSearchParams(location.search).get('id');
        render();
    }

    global.RSKIMPD = { init: init, complete: complete, onPickPhoto: onPickPhoto, clearPhoto: clearPhoto, pickAfterDemo: pickAfterDemo };
})(window);
