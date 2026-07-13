/* =====================================================================
   rsk-imp-detail.js · 개선조치 상세·조치 (IMP01-D)
   · 출처·유해위험요인·조치전 사진 · 조치내용+조치후 사진 → [완료 처리]
   · risk_assessment 출처면 해당 공정 '재평가 대기' 연동 안내
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYRSK; };
    var KO = function () { return global.DYRSK.KOSHA; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }

    var state = { id: null, mount: null };

    function srcBadge(t) { var m = D().SRC_META[t] || D().SRC_META.manual; return '<span class="src-badge ' + (m.tone === 'info' ? 'info' : 'neutral') + '">' + esc(m.label) + '</span>'; }

    function render() {
        var m = D().improvementOf(state.id);
        if (!m) { state.mount.innerHTML = '<div class="v2-empty">개선조치를 찾을 수 없습니다.</div>'; return; }
        var t = KO().targetOf(m.target_id);
        var isRA = m.source_type === 'risk_assessment';
        var isDone = m.status === 'DONE';

        var head =
            '<div class="id-card">' +
                '<div class="id-title">' + srcBadge(m.source_type) + ' ' + esc(m.description) + '</div>' +
                '<div class="id-meta">' +
                    '<span>관리대상 <b>' + esc(t ? t.name : '-') + '</b></span>' +
                    (isRA && m.hazard_risk_factor ? '<span>유해위험요인 <b>' + esc(m.hazard_risk_factor) + '</b></span>' : '') +
                    '<span>담당자 <b>' + esc(m.assigned_to || '미지정') + '</b></span>' +
                    '<span>기한 <b>' + esc(m.due_date || '-') + '</b></span>' +
                    (isRA ? '<span>평가 <b><a href="rsk-detail.html?id=' + esc(m.assessment_id) + '" style="color:var(--main-dark);">' + esc(m.assessment_id) + '</a></b></span>' : '') +
                '</div>' +

                '<div class="id-sec"><div class="id-sec-title">대책 내용 (조치 전)</div>' +
                    '<div class="id-desc">' + esc(m.description) + '</div>' +
                    '<div style="margin-top:8px;"><span class="id-photo">' + (m.before_photo ? '조치 전 사진' : '사진 없음') + '</span></div></div>' +

                (isDone
                    ? '<div class="id-sec"><div class="id-sec-title">조치 결과 (완료)</div>' +
                        '<div class="id-desc">' + esc(m.action_content || '조치 완료') + '</div>' +
                        '<div style="margin-top:8px;"><span class="id-photo">조치 후 사진</span></div>' +
                        '<div class="id-done-note" style="margin-top:12px;">조치 완료' + (isRA ? ' · 해당 공정이 <b>재평가 대기</b>로 전환되었습니다. 위험성 추정 화면에서 [재평가]로 허용 여부를 재확인하세요.' : '') + '</div></div>'
                    : '<div class="id-sec"><div class="id-sec-title">조치 실시</div>' +
                        '<div class="id-frow"><label class="form-label">조치 내용 <span style="color:var(--status-danger-fg)">*</span></label>' +
                            '<textarea class="form-textarea" id="id-action" rows="3" placeholder="실제 조치한 내용을 입력하세요"></textarea></div>' +
                        '<div class="id-frow"><label class="form-label">조치 후 사진</label>' +
                            '<button type="button" class="btn btn-outline btn-sm" onclick="DYV2.toast(\'프로토타입: 업로드 생략\')">사진 업로드</button></div>' +
                        '<div class="id-foot"><button type="button" class="btn btn-primary" onclick="RSKIMPD.complete()">완료 처리</button></div></div>') +
            '</div>';

        state.mount.innerHTML = head;
    }

    function complete() {
        var action = (document.getElementById('id-action').value || '').trim();
        if (!action) { toast('조치 내용을 입력하세요.'); return; }
        var m = D().completeImprovement(state.id, action);
        render();
        toast('조치 완료 처리' + (m.source_type === 'risk_assessment' ? ' · 공정 재평가 대기 전환' : ''));
    }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        state.id = new URLSearchParams(location.search).get('id');
        render();
    }

    global.RSKIMPD = { init: init, complete: complete };
})(window);
