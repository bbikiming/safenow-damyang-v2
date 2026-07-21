/* =====================================================================
   work-env-detail.js · 작업환경측정 상세·조치 (WEM01-D)
   · 용역 결과보고서·결과 요약·개선 요구·개선 전후 사진·미완료 사유·이력
   · 증빙 등록 / 미완료 사유 / 기한 재설정 / 알림 발송 / 완료 처리
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var S = function () { return global.DYSH; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }

    var state = { id: null, mount: null };

    function stChip(r) { var st = S().effWorkEnv(r); return '<span class="sh-st ' + st.tone + '">' + esc(st.label) + '</span>'; }

    function render() {
        var r = S().workEnvOf(state.id);
        if (!r) { state.mount.innerHTML = '<div class="sh-empty">해당 작업환경측정 건을 찾을 수 없습니다.</div>'; return; }
        var measured = S().weMeasured(r), needImp = S().weNeedsImprove(r);

        /* 상단 액션 바 — 상태별 컨텍스트 액션(점진적 공개). 현 상태에 무의미한 버튼은 렌더하지 않음 */
        var acts = '';
        if (!measured) acts += '<button type="button" class="btn btn-primary" onclick="WENVD.complete()">측정 완료 처리</button>';
        else if (needImp) acts += '<button type="button" class="btn btn-primary" onclick="WENVD.improveDone()">개선조치 완료</button>';
        else acts += '<span class="sh-st success" style="align-self:center;">완료 처리됨</span>';
        acts += '<button type="button" class="btn btn-outline" onclick="WENVD.evidence()">증빙 등록</button>';
        if (!measured || needImp) acts += '<button type="button" class="btn btn-outline" onclick="WENVD.resetDue()">기한 재설정</button>';
        if (!measured) acts += '<button type="button" class="btn btn-outline" onclick="WENVD.reason()">미완료 사유 입력</button>';
        acts += '<button type="button" class="btn btn-outline" onclick="WENVD.notify()">알림 발송</button>';
        var actions = '<div class="sh-actions" style="margin-bottom:14px;">' + acts + '</div>';

        /* 개요 */
        var overview =
            '<div class="sh-card"><div class="sh-card-h">개요 <span>' + stChip(r) + '</span></div>' +
            '<dl class="sh-kv">' +
                '<dt>대상 부서 / 사업장</dt><dd><b>' + esc(r.dept) + '</b> · ' + esc(r.site) + '</dd>' +
                '<dt>측정 대상(유해인자)</dt><dd>' + esc(r.subject) + '</dd>' +
                '<dt>위탁업체</dt><dd>' + esc(r.vendor) + '</dd>' +
                '<dt>기준연도 · 반기</dt><dd>' + esc(r.year) + '년 · ' + (r.half === 'H2' ? '하반기' : '상반기') + '</dd>' +
                '<dt>측정 예정일</dt><dd>' + esc(r.planned || '-') + '</dd>' +
                '<dt>측정 실시일</dt><dd>' + (r.done ? esc(r.done) : '<span style="color:var(--text-gray)">미실시</span>') + '</dd>' +
                '<dt>담당자</dt><dd>' + esc(r.owner) + '</dd>' +
                '<dt>대상 근거</dt><dd>' + esc(r.targetBasis || '현업 종사자 · 유해인자 노출') + '</dd>' +
                '<dt>결과 보존연한</dt><dd><b>' + S().retentionOf(r) + '년</b>' +
                    (r.carcinogen ? ' <span style="color:var(--status-warning-fg)">(발암성·특별관리물질)</span>' : '') + '</dd>' +
            '</dl></div>';

        /* 결과보고서 */
        var report =
            '<div class="sh-card"><div class="sh-card-h">용역 결과보고서 <span class="sub">위탁업체 제출 · 증빙</span></div>' +
            (r.report
                ? '<div class="sh-photos"><div class="sh-photo has">' + S().icon('file', 26) + '<span>결과보고서.pdf</span></div>' +
                  '<div style="align-self:center;font-size:13px;color:var(--text-gray);">위탁업체 결과보고서가 등록되어 있습니다.</div></div>'
                : '<div class="sh-req">아직 결과보고서(증빙)가 등록되지 않았습니다. 위탁업체 제출 후 <b>[증빙 등록]</b>으로 첨부하세요.</div>') +
            '</div>';

        /* 결과 요약 · 개선 요구 · 개선 전후 */
        var resultCard = '';
        if (measured) {
            var resBadge = r.result === '적정' ? '<span class="sh-res ok">적정</span>' : '<span class="sh-res warn">개선 필요</span>';
            var due = S().legalSubmitDue('we', r);
            var dueRow = '';
            if (due) {
                var dl = S().daysLeft(due.date);
                var dueTone = dl == null ? '' : (dl < 0 ? 'var(--status-danger-fg)' : (dl <= 14 ? 'var(--status-warning-fg)' : ''));
                var dueTag = dl == null ? '' : (dl < 0 ? ' (' + (-dl) + '일 초과)' : (dl <= 14 ? ' (D-' + dl + ')' : ''));
                dueRow = '<dt>' + esc(due.label) + '</dt><dd><b' + (dueTone ? ' style="color:' + dueTone + '"' : '') + '>' + esc(due.date) + dueTag + '</b></dd>';
            }
            resultCard =
                '<div class="sh-card"><div class="sh-card-h">결과 요약 <span>' + resBadge + '</span></div>' +
                '<dl class="sh-kv">' +
                    '<dt>측정 결과</dt><dd>' + esc(r.result) + '</dd>' +
                    (r.result === '개선 필요' ? '<dt>개선조치 기한</dt><dd><b>' + esc(r.improveDue || '-') + '</b>' + (r.improveDone ? ' · <span style="color:var(--status-success-fg);font-weight:700;">개선 완료</span>' : '') + '</dd>' : '') +
                    dueRow +
                '</dl>' +
                (r.result === '개선 필요'
                    ? '<div style="margin-top:12px;"><div class="sh-card-h" style="margin-bottom:8px;">개선 요구사항</div>' +
                      '<div class="sh-req">' + esc(r.improveReq || '개선 요구사항 미입력') + '</div>' +
                      '<div class="sh-card-h" style="margin:14px 0 8px;">개선 전 · 후 사진</div>' +
                      '<div class="sh-photos">' +
                        '<div class="sh-photo' + (r.beforePhoto ? ' has' : '') + '">' + (r.beforePhoto ? S().icon('image', 26) + '<span>개선 전</span>' : '개선 전<br>사진 없음') + '</div>' +
                        '<div class="sh-photo' + (r.afterPhoto ? ' has' : '') + '">' + (r.afterPhoto ? S().icon('image', 26) + '<span>개선 후</span>' : '개선 후<br>미등록') + '</div>' +
                      '</div>' +
                      (due ? '<div style="margin-top:10px;font-size:12px;color:var(--text-gray);">※ 노출기준 초과 시 시료채취일부터 60일 이내 지방고용노동관서 제출</div>' : '') +
                      '</div>'
                    : '<div style="margin-top:8px;font-size:13px;color:var(--text-gray);">노출기준 이내로 <b style="color:var(--status-success-fg)">적정</b> 판정되어 별도 개선조치가 필요하지 않습니다.</div>') +
                '</div>';
        }

        /* 미완료 / 사유 관리 */
        var pendingCard = '';
        if (!measured) {
            pendingCard =
                '<div class="sh-card"><div class="sh-card-h">미완료 관리</div>' +
                '<dl class="sh-kv">' +
                    '<dt>미완료 사유</dt><dd>' + (r.reason ? '<div class="sh-reasonbox">' + esc(r.reason) + '</div>' : '<span style="color:var(--text-gray)">미입력</span>') + '</dd>' +
                    '<dt>예상 완료일</dt><dd>' + (r.expectedDone ? '<b>' + esc(r.expectedDone) + '</b>' : '<span style="color:var(--text-gray)">미정</span>') + '</dd>' +
                '</dl></div>';
        }

        /* 이력 */
        var histCard =
            '<div class="sh-card"><div class="sh-card-h">요청 · 변경 이력</div>' +
            '<ul class="sh-hist">' + (r.history || []).map(function (h) {
                return '<li><span class="sh-hist-at">' + esc(h.at) + '</span>' +
                    '<div class="sh-hist-ev">' + esc(h.event) + '</div>' +
                    '<span class="sh-hist-actor">' + esc(h.actor) + '</span></li>';
            }).join('') + '</ul></div>';

        /* 인력평가 연계 안내 */
        var linknote =
            '<div class="sh-linkbar">' +
                S().icon('check', 18) +
                '<div>이 건이 <b>완료</b>되면 결과·증빙이 <b>안전보건관리책임자 평가</b>의 「작업환경측정 등 작업환경의 점검 및 개선」 항목 참고지표에 반영됩니다. ' +
                '<a href="evl-eval.html">인력 평가에서 확인 →</a></div>' +
            '</div>';

        state.mount.innerHTML = actions + linknote +
            '<div class="sh-detail">' + overview + report + resultCard + pendingCard + histCard + '</div>';
    }

    /* ── 증빙 등록 ── */
    function evidence() {
        V().openModal('결과보고서 · 증빙 등록',
            '<p style="font-size:13px;margin-bottom:10px;color:var(--text-gray);">위탁업체가 제출한 작업환경측정 결과보고서를 첨부합니다.</p>' +
            V().uploadDrop('파일을 끌어다 놓거나 클릭하여 업로드<br><span style="font-size:12px;">업로드 시 이력이 자동 기록됩니다</span>', null, { hint: true }),
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="WENVD.saveEvidence()">등록</button>');
    }
    function saveEvidence() { S().attachEvidence('we', state.id, '결과보고서'); V().closeModal(); render(); toast('증빙이 등록되었습니다.'); }

    /* ── 미완료 사유 ── */
    function reason() {
        var r = S().workEnvOf(state.id);
        V().openModal('미완료 사유 입력',
            '<div style="margin-bottom:12px;"><label class="form-label">미완료(미실시) 사유 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<textarea class="form-textarea" id="wd-reason" rows="3" placeholder="예: 위탁업체 일정 지연 / 현장 여건">' + esc(r.reason || '') + '</textarea></div>' +
            '<div><label class="form-label">예상 완료일</label>' +
                '<input type="date" class="form-input" id="wd-exp" value="' + esc(r.expectedDone || '2026-08-31') + '"></div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="WENVD.saveReason()">저장</button>');
    }
    function saveReason() {
        var v = (document.getElementById('wd-reason').value || '').trim();
        if (!v) { toast('사유를 입력하세요.'); return; }
        S().setReason('we', state.id, v, document.getElementById('wd-exp').value);
        V().closeModal(); render(); toast('미완료 사유가 저장되었습니다.');
    }

    /* ── 기한 재설정 ── */
    function resetDue() {
        var r = S().workEnvOf(state.id);
        var isImp = r.result === '개선 필요' && !r.improveDone;
        var field = isImp ? 'improveDue' : 'planned';
        var cur = isImp ? r.improveDue : r.planned;
        V().openModal('기한 재설정',
            '<p style="font-size:13px;margin-bottom:10px;">' + (isImp ? '개선조치 기한을 재설정합니다.' : '측정 예정일을 재설정합니다.') + '</p>' +
            '<label class="form-label">' + (isImp ? '개선조치 기한' : '측정 예정일') + '</label>' +
            '<input type="date" class="form-input" id="wd-due" value="' + esc(cur || '2026-08-31') + '">',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="WENVD.saveDue(\'' + field + '\')">저장</button>');
    }
    function saveDue(field) {
        var v = document.getElementById('wd-due').value;
        if (!v) { toast('날짜를 선택하세요.'); return; }
        S().resetDue('we', state.id, field, v);
        V().closeModal(); render(); toast('기한이 재설정되었습니다.');
    }

    /* ── 알림 발송 ── */
    function notify() {
        var r = S().workEnvOf(state.id);
        V().openModal('알림 발송',
            '<div style="margin-bottom:12px;"><label class="form-label" for="wd-nt-to">수신자 <span style="font-weight:400;color:var(--text-lightgray)">(조직도에서 선택)</span></label>' +
                '<div class="orgpick-field" id="wd-nt-tofield"><div style="display:flex;gap:8px;">' +
                    '<input type="text" class="form-input" id="wd-nt-to" style="flex:1;" value="' + esc(r.owner) + '">' +
                    '<button type="button" class="btn btn-outline" onclick="ORGPICK.toggle(\'wd-nt-tofield\',\'member\',\'WENVD.pickRecipient\')">조직도</button>' +
                '</div></div></div>' +
            '<div style="margin-bottom:12px;"><label class="form-label" for="wd-nt-msg">알림 내용</label>' +
                '<textarea class="form-textarea" id="wd-nt-msg" rows="2">[작업환경측정] ' + esc(r.dept) + ' ' + esc(r.site) + ' 측정/개선 진행 요청</textarea></div>' +
            '<div class="sh-req" style="font-size:12px;line-height:1.5;">본 알림은 수신자의 <b>새올행정시스템 포틀릿(알림)</b>으로 발송됩니다. <span style="color:var(--text-gray)">(프로토타입 — 실제 연계 시 새올 포틀릿으로 전송)</span></div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="WENVD.sendNotify()">발송</button>');
    }
    function pickRecipient(val) { var inp = document.getElementById('wd-nt-to'); if (inp) inp.value = val; }
    function sendNotify() {
        var to = (document.getElementById('wd-nt-to').value || '').trim();
        S().notify('we', state.id, to);
        V().closeModal(); render(); toast('새올 포틀릿으로 알림을 발송했습니다 (프로토타입).');
    }

    /* ── 완료 처리 ── */
    /* 측정 미실시 → 결과 입력 모달(실시일=오늘·결과=적정 기본으로 최소 입력) */
    function complete() {
        V().openModal('측정 완료 처리',
            '<div style="margin-bottom:12px;"><label class="form-label" for="wd-c-date">측정 실시일</label>' +
                '<input type="date" class="form-input" id="wd-c-date" value="' + esc(S().TODAY) + '"></div>' +
            '<div style="margin-bottom:12px;"><label class="form-label" for="wd-c-result">측정 결과</label>' +
                '<select class="form-select" id="wd-c-result" onchange="WENVD.toggleImprove()">' +
                    '<option value="적정">적정</option><option value="개선 필요">개선 필요</option></select></div>' +
            '<div id="wd-c-imp" style="display:none;">' +
                '<div style="margin-bottom:12px;"><label class="form-label" for="wd-c-req">개선 요구사항</label>' +
                    '<textarea class="form-textarea" id="wd-c-req" rows="2" placeholder="노출기준 초과 항목·개선 방향"></textarea></div>' +
                '<div><label class="form-label" for="wd-c-due">개선조치 기한</label>' +
                    '<input type="date" class="form-input" id="wd-c-due" value="2026-09-30"></div>' +
            '</div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="WENVD.saveComplete()">완료 처리</button>');
    }
    function toggleImprove() {
        var sel = document.getElementById('wd-c-result').value;
        document.getElementById('wd-c-imp').style.display = (sel === '개선 필요') ? '' : 'none';
    }
    function saveComplete() {
        var result = document.getElementById('wd-c-result').value;
        var opts = { doneDate: document.getElementById('wd-c-date').value, result: result };
        if (result === '개선 필요') {
            opts.improveReq = (document.getElementById('wd-c-req').value || '').trim();
            opts.improveDue = document.getElementById('wd-c-due').value;
        }
        S().completeWorkEnv(state.id, opts);
        V().closeModal(); render();
        toast(result === '적정' ? '측정 완료 · 결과 「적정」' : '측정 완료 · 「개선 필요」 등록');
    }
    /* 개선조치 완료 — 캡처할 입력이 없어 원클릭 처리(확인 모달 생략). 조치 후 증빙은 [증빙 등록]으로 별도 첨부 */
    function improveDone() {
        S().completeWorkEnv(state.id, {});
        render(); toast('개선조치 완료 처리되었습니다.');
    }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        state.id = new URLSearchParams(location.search).get('id');
        render();
    }

    global.WENVD = { init: init, evidence: evidence, saveEvidence: saveEvidence, reason: reason, saveReason: saveReason,
        resetDue: resetDue, saveDue: saveDue, notify: notify, pickRecipient: pickRecipient, sendNotify: sendNotify,
        complete: complete, toggleImprove: toggleImprove, saveComplete: saveComplete, improveDone: improveDone };
})(window);
