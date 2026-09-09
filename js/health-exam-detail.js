/* =====================================================================
   health-exam-detail.js · 건강검진 상세·조치 (HEX01-D)
   · 검진 일정·대상자 현황(집계)·실시 증빙·미검진 사유·사후관리·이력
   · 개인별 검진 결과는 담지 않는다 — 민감정보(개보법 §23·산안법 §132)이고
     사업주가 받는 법정 문서도 집계형 결과표다. 이 화면의 인원 값은 대상자 수·수검자 수뿐이다.
   · 증빙 등록 / 미검진 사유 / 기한 재설정 / 알림 발송 / 완료·사후관리 처리
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var S = function () { return global.DYSH; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }

    var state = { id: null, mount: null };

    function stChip(r) { var st = S().effHealth(r); return '<span class="sh-st ' + st.tone + '">' + esc(st.label) + '</span>'; }
    function typeTag(t) { return '<span class="sh-tag' + (t === '특수건강진단' ? ' spec' : '') + '">' + esc(t) + '</span>'; }
    /* ===== 권한 (CLAUDE.md §12) — 목록과 같은 단일 출처 =====
     * 목록에서 지운 행은 **주소로도 못 연다**. 렌더에서만 지우면 URL·콘솔로 뚫린다.
     * 종전에는 이 상세에 게이트가 하나도 없어, 조회 전용 계층(과장·소장)이
     * 남의 부서 검진 건을 주소로 열고 완료 처리까지 할 수 있었다(실측 재현).
     * 건강검진은 대상·수검 인원이 실린 도메인이라 조회 범위가 특히 중요하다.
     * 부서를 **이름**으로 저장하는 도메인이라 DYV2.deptIdOf() 로 id 를 얻는다(§3). */
    function R() { return global.DYROLE; }
    function did(r) { return V().deptIdOf(r && r.dept ? r.dept : ''); }
    function inScope(r) { return !R() || R().inScope(did(r)); }
    function canAct(r) { return !R() || R().canAct(did(r)); }
    function roNote(r) { return R() ? R().readOnlyNote('검진 계획 등록·증빙 첨부', did(r)) : ''; }
    /* 조회 범위 밖 — 내용을 한 글자도 내지 않는다(어느 부서 건인지도 밝히지 않는다) */
    function outOfScope() {
        return '<div class="v2-empty">조회 범위 밖입니다 — 소속 부서 건만 볼 수 있습니다.' +
            '<div style="margin-top:10px;"><a class="btn btn-outline" href="health-exam.html">‹ 건강검진 목록</a></div></div>';
    }
    /* 조작 차단 — 버튼을 숨기는 것만으로는 전역 호출로 뚫린다 */
    function deny(r, what) {
        if (canAct(r)) return false;
        toast(what + V().josa(what, '은', '는') + ' 해당 부서 담당자가 수행합니다.');
        return true;
    }


    function render() {
        var r = S().healthOf(state.id);
        if (!r) { state.mount.innerHTML = '<div class="sh-empty">해당 건강검진 건을 찾을 수 없습니다.</div>'; return; }
        if (!inScope(r)) { state.mount.innerHTML = outOfScope(); return; }
        var may = canAct(r);
        var unex = S().hcUnexamined(r);
        var done = !!r.done;
        var rate = r.targetCount ? Math.round(r.examinedCount / r.targetCount * 100) : 0;
        var barTone = rate >= 100 ? '' : (rate >= 80 ? 'warn' : 'danger');

        /* 상단 액션 — 상태별 컨텍스트 액션(점진적 공개) */
        var acts = '';
        if (may) {
            if (!done) acts += '<button type="button" class="btn btn-primary" onclick="HEXD.complete()">검진 완료 처리</button>';
            else if (unex > 0) acts += '<button type="button" class="btn btn-primary" onclick="HEXD.complete()">추가검진 반영</button>';
            else if (S().hcFollowup(r)) acts += '<button type="button" class="btn btn-primary" onclick="HEXD.complete()">사후관리 완료</button>';
            else acts += '<span class="sh-st success" style="align-self:center;">완료 처리됨</span>';
            acts += '<button type="button" class="btn btn-outline" onclick="HEXD.evidence()">증빙 등록</button>';
            if (!done || unex > 0) acts += '<button type="button" class="btn btn-outline" onclick="HEXD.resetDue()">기한 재설정</button>';
            if (!done || unex > 0) acts += '<button type="button" class="btn btn-outline" onclick="HEXD.reason()">미검진 사유 입력</button>';
            acts += '<button type="button" class="btn btn-outline" onclick="HEXD.notify()">알림 발송</button>';
        }
        var actions = acts ? '<div class="sh-actions" style="margin-bottom:14px;">' + acts + '</div>' : roNote(r);

        var linknote =
            '<div class="sh-linkbar">' +
                S().icon('check', 18) +
                '<div>이 건이 <b>완료</b>되면 수검률·증빙이 <b>안전보건관리책임자 평가</b>의 「종사자의 건강진단 등 건강관리」 항목 참고지표에 반영됩니다. ' +
                '<a href="evl-eval.html">인력 평가에서 확인 →</a></div>' +
            '</div>';

        /* 개요 + 검진 일정 */
        var overview =
            '<div class="sh-card"><div class="sh-card-h">개요 <span>' + typeTag(r.type) + ' ' + stChip(r) + '</span></div>' +
            '<dl class="sh-kv">' +
                '<dt>대상 부서</dt><dd><b>' + esc(r.dept) + '</b></dd>' +
                '<dt>위탁 검진기관</dt><dd>' + esc(r.agency) + '</dd>' +
                '<dt>기준연도 · 반기</dt><dd>' + esc(r.year) + '년 · ' + S().halfLabel(r.planned) + '</dd>' +
                '<dt>검진 예정일</dt><dd>' + esc(r.planned || '-') + '</dd>' +
                '<dt>검진 실시일</dt><dd>' + (done ? esc(r.done) : '<span style="color:var(--text-gray)">미실시</span>') + '</dd>' +
                (r.extraExamDate ? '<dt>추가검진 예정일</dt><dd><b>' + esc(r.extraExamDate) + '</b></dd>' : '') +
                '<dt>담당자</dt><dd>' + esc(r.owner) + '</dd>' +
                '<dt>대상 근거</dt><dd>' + esc(r.targetBasis || '현업 종사자 · 유해인자 노출') + '</dd>' +
                '<dt>결과 보존연한</dt><dd><b>' + S().retentionOf(r) + '년</b>' +
                    (r.carcinogen ? ' <span style="color:var(--status-warning-fg)">(고시 대상 물질)</span>' : '') + '</dd>' +
            '</dl></div>';

        /* 대상자 현황 */
        var status =
            '<div class="sh-card"><div class="sh-card-h">대상자 현황 <span class="sub">수검률 ' + rate + '%</span></div>' +
            '<dl class="sh-kv">' +
                '<dt>대상자 수</dt><dd><b>' + r.targetCount + '</b> 명</dd>' +
                '<dt>수검자 수</dt><dd><b style="color:var(--status-success-fg)">' + r.examinedCount + '</b> 명</dd>' +
                '<dt>미검진자 수</dt><dd><b style="color:' + (unex > 0 ? 'var(--status-danger-fg)' : 'var(--text-gray)') + '">' + unex + '</b> 명</dd>' +
            '</dl>' +
            '<div class="sh-bar ' + barTone + '"><span style="width:' + rate + '%"></span></div></div>';

        /* 실시 증빙 */
        var evidence =
            '<div class="sh-card"><div class="sh-card-h">실시 증빙 <span class="sub">검진 실시확인서 · 집계 결과</span></div>' +
            (r.evidence
                ? '<div class="sh-photos"><div class="sh-photo has">' + S().icon('file', 26) + '<span>실시확인서.pdf</span></div>' +
                  '<div style="align-self:center;font-size:13px;color:var(--text-gray);">실시 증빙이 등록되어 있습니다.</div></div>'
                : '<div class="sh-req">아직 실시 증빙이 등록되지 않았습니다. 검진기관 실시확인서를 <b>[증빙 등록]</b>으로 첨부하세요.</div>') +
            '</div>';

        /* 사후관리 — 상세형: 계획/실적 / 단순형: 이행 여부만 */
        var fuFlag = r.followupNeeded ? (r.followupDone ? '<span class="sh-res ok">완료</span>' : '<span class="sh-res warn">대상</span>') : '<span class="sh-res none">해당없음</span>';
        var fuDue = S().legalSubmitDue('hc', r);
        var fuDueHtml = '';
        if (fuDue) {
            var fdl = S().daysLeft(fuDue.date);
            var fuTone = fdl == null ? '' : (fdl < 0 ? 'var(--status-danger-fg)' : (fdl <= 14 ? 'var(--status-warning-fg)' : ''));
            var fuTag = fdl == null ? '' : (fdl < 0 ? ' (' + (-fdl) + '일 초과)' : (fdl <= 14 ? ' (D-' + fdl + ')' : ''));
            fuDueHtml = '<dt>' + esc(fuDue.label) + '</dt><dd><b' + (fuTone ? ' style="color:' + fuTone + '"' : '') + '>' + esc(fuDue.date) + fuTag + '</b></dd>';
        }
        /* 사후관리 — 이행 여부와 법정 제출기한만 관리한다.
           유소견자 개인별 계획·실적은 민감정보라 이 시스템이 담지 않는다(§ 개인정보 최소수집). */
        var followup =
            '<div class="sh-card"><div class="sh-card-h">사후관리 <span>' + fuFlag + '</span></div>' +
            (r.followupNeeded
                ? '<dl class="sh-kv">' +
                    '<dt>조치 실적</dt><dd>' + (r.followupResult ? '<div class="sh-reasonbox">' + esc(r.followupResult) + '</div>' : '<span style="color:var(--text-gray)">미입력 — [사후관리 완료]에서 기록</span>') + '</dd>' +
                    fuDueHtml +
                  '</dl>' +
                  (fuDue ? '<div style="margin-top:10px;font-size:12px;color:var(--text-gray);">※ 유소견자 조치결과 30일 이내 제출</div>' : '') +
                  '<div style="margin-top:10px;font-size:12px;color:var(--text-gray);">개인별 유소견 내역은 검진기관·보건담당이 관리하며 이 시스템에 등록하지 않습니다. 여기에는 <b>부서 단위 조치 실적</b>만 기록합니다.</div>'
                : '<div style="font-size:13px;color:var(--text-gray);">유소견·업무제한 등 사후관리 대상이 없습니다.</div>') +
            '</div>';

        /* 미검진 사유 */
        var reasonCard = '';
        if (!done || unex > 0) {
            reasonCard =
                '<div class="sh-card"><div class="sh-card-h">미검진 사유 · 추가검진</div>' +
                '<dl class="sh-kv">' +
                    '<dt>미검진 사유</dt><dd>' + (r.reason ? '<div class="sh-reasonbox">' + esc(r.reason) + '</div>' : '<span style="color:var(--text-gray)">미입력</span>') + '</dd>' +
                    '<dt>추가검진 예정일</dt><dd>' + (r.extraExamDate ? '<b>' + esc(r.extraExamDate) + '</b>' : '<span style="color:var(--text-gray)">미정</span>') + '</dd>' +
                '</dl></div>';
        }

        /* 이력 */
        var histCard =
            '<div class="sh-card"><div class="sh-card-h">처리 · 변경 이력</div>' +
            '<ul class="sh-hist">' + (r.history || []).map(function (h) {
                return '<li><span class="sh-hist-at">' + esc(h.at) + '</span>' +
                    '<div class="sh-hist-ev">' + esc(h.event) + '</div>' +
                    '<span class="sh-hist-actor">' + esc(h.actor) + '</span></li>';
            }).join('') + '</ul></div>';

        state.mount.innerHTML = actions + linknote +
            '<div class="sh-detail">' + overview + status + evidence + followup + reasonCard + histCard + '</div>';
    }

    /* ── 증빙 등록 ── */
    function evidence() {
        if (deny(S().healthOf(state.id), '실시 증빙 등록')) return;
        V().openModal('실시 증빙 등록',
            '<p style="font-size:13px;margin-bottom:10px;color:var(--text-gray);">검진기관 실시확인서·집계 결과 통보서를 첨부합니다. 개인별 결과지는 첨부하지 않습니다.</p>' +
            V().uploadDrop('파일을 끌어다 놓거나 클릭하여 업로드<br><span style="font-size:12px;">업로드 시 이력이 자동 기록됩니다</span>', null, { hint: true }),
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="HEXD.saveEvidence()">등록</button>');
    }
    function saveEvidence() {
        if (deny(S().healthOf(state.id), '실시 증빙 등록')) return; S().attachEvidence('hc', state.id, '실시 증빙'); V().closeModal(); render(); toast('증빙이 등록되었습니다.'); }

    /* ── 미검진 사유 ── */
    function reason() {
        if (deny(S().healthOf(state.id), '미검진 사유 입력')) return;
        var r = S().healthOf(state.id);
        V().openModal('미검진 사유 입력',
            '<div style="margin-bottom:12px;"><label class="form-label">미검진 사유 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<textarea class="form-textarea" id="hd-reason" rows="3" placeholder="예: 교대근무자 일정 미조정 / 검진기관 예약 지연">' + esc(r.reason || '') + '</textarea></div>' +
            '<div><label class="form-label">추가검진 예정일</label>' +
                '<input type="date" class="form-input" id="hd-extra" value="' + esc(r.extraExamDate || '2026-08-31') + '"></div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="HEXD.saveReason()">저장</button>');
    }
    function saveReason() {
        if (deny(S().healthOf(state.id), '미검진 사유 입력')) return;
        var v = (document.getElementById('hd-reason').value || '').trim();
        if (!v) { toast('사유를 입력하세요.'); return; }
        S().setReason('hc', state.id, v, document.getElementById('hd-extra').value);
        V().closeModal(); render(); toast('미검진 사유가 저장되었습니다.');
    }

    /* ── 기한 재설정 ── */
    function resetDue() {
        if (deny(S().healthOf(state.id), '기한 재설정')) return;
        var r = S().healthOf(state.id);
        var useExtra = !!r.done;
        var field = useExtra ? 'extraExamDate' : 'planned';
        var cur = useExtra ? r.extraExamDate : r.planned;
        V().openModal('기한 재설정',
            '<p style="font-size:13px;margin-bottom:10px;">' + (useExtra ? '추가검진 예정일을 재설정합니다.' : '검진 예정일을 재설정합니다.') + '</p>' +
            '<label class="form-label">' + (useExtra ? '추가검진 예정일' : '검진 예정일') + '</label>' +
            '<input type="date" class="form-input" id="hd-due" value="' + esc(cur || '2026-08-31') + '">',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="HEXD.saveDue(\'' + field + '\')">저장</button>');
    }
    function saveDue(field) {
        if (deny(S().healthOf(state.id), '기한 재설정')) return;
        var v = document.getElementById('hd-due').value;
        if (!v) { toast('날짜를 선택하세요.'); return; }
        S().resetDue('hc', state.id, field, v);
        V().closeModal(); render(); toast('기한이 재설정되었습니다.');
    }

    /* ── 알림 발송 ── */
    function notify() {
        if (deny(S().healthOf(state.id), '알림 발송')) return;
        var r = S().healthOf(state.id);
        V().openModal('알림 발송',
            '<div style="margin-bottom:12px;"><label class="form-label" for="hd-nt-to">수신자 <span style="font-weight:400;color:var(--text-gray)">(조직도에서 선택)</span></label>' +
                '<div class="orgpick-field" id="hd-nt-tofield"><div style="display:flex;gap:8px;">' +
                    '<input type="text" class="form-input" id="hd-nt-to" style="flex:1;" value="' + esc(r.owner) + '">' +
                    '<button type="button" class="btn btn-outline" onclick="ORGPICK.toggle(\'hd-nt-tofield\',\'member\',\'HEXD.pickRecipient\')">조직도</button>' +
                '</div></div></div>' +
            '<div style="margin-bottom:12px;"><label class="form-label" for="hd-nt-msg">알림 내용</label>' +
                '<textarea class="form-textarea" id="hd-nt-msg" rows="2">[건강검진] ' + esc(r.dept) + ' ' + esc(r.type) + ' 미검진자 수검/사후관리 요청</textarea></div>' +
            '<div class="sh-req" style="font-size:12px;line-height:1.5;">본 알림은 수신자의 <b>새올행정시스템 포틀릿(알림)</b>으로 발송됩니다. <span style="color:var(--text-gray)">(연계 적용 후 실제 전송)</span></div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="HEXD.sendNotify()">발송</button>');
    }
    function pickRecipient(val) { var inp = document.getElementById('hd-nt-to'); if (inp) inp.value = val; }
    function sendNotify() {
        if (deny(S().healthOf(state.id), '알림 발송')) return;
        var to = (document.getElementById('hd-nt-to').value || '').trim();
        S().notify('hc', state.id, to);
        V().closeModal(); render(); toast('새올 포틀릿으로 알림을 발송했습니다.');
    }

    /* ── 완료 처리 ── */
    function complete() {
        if (deny(S().healthOf(state.id), '검진 완료 처리')) return;
        var r = S().healthOf(state.id);
        if (!r.done) {
            if (!r.evidence) { toast('실시 증빙을 먼저 등록하세요.'); return; }
            V().openModal('검진 완료 처리',
                '<div style="margin-bottom:12px;"><label class="form-label">검진 실시일</label>' +
                    '<input type="date" class="form-input" id="hd-c-date" value="' + esc(S().TODAY) + '"></div>' +
                '<div><label class="form-label">수검자 수 (대상 ' + r.targetCount + '명)</label>' +
                    '<input type="number" class="form-input" id="hd-c-ex" value="' + r.targetCount + '" min="0" max="' + r.targetCount + '"></div>',
                '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
                '<button type="button" class="btn btn-primary" onclick="HEXD.saveComplete()">완료 처리</button>');
        } else if (S().hcUnexamined(r) > 0) {
            V().openModal('추가검진 반영',
                '<p style="font-size:13px;margin-bottom:10px;">추가검진 결과를 반영하여 수검자 수를 갱신합니다. (대상 ' + r.targetCount + '명)</p>' +
                '<label class="form-label">누적 수검자 수</label>' +
                '<input type="number" class="form-input" id="hd-c-ex" value="' + r.targetCount + '" min="' + r.examinedCount + '" max="' + r.targetCount + '">',
                '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
                '<button type="button" class="btn btn-primary" onclick="HEXD.saveComplete()">반영</button>');
        } else if (S().hcFollowup(r)) {
            V().openModal('사후관리 완료',
                '<div><label class="form-label">사후관리 실적</label>' +
                    '<textarea class="form-textarea" id="hd-c-fu" rows="3" placeholder="예: 유소견자 2차검사 완료·정상 종결 / 업무전환 조치">' + esc(r.followupResult || '') + '</textarea></div>',
                '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
                '<button type="button" class="btn btn-primary" onclick="HEXD.saveFollowup()">사후관리 완료</button>');
        } else {
            toast('이미 완료된 건입니다.');
        }
    }
    function saveComplete() {
        if (deny(S().healthOf(state.id), '검진 완료 처리')) return;
        var ex = Number(document.getElementById('hd-c-ex').value);
        var dateEl = document.getElementById('hd-c-date');
        var r = S().healthOf(state.id);
        if (!Number.isInteger(ex) || ex < 0 || ex > r.targetCount) { toast('수검자 수는 0명 이상 대상자 수 이하로 입력하세요.'); return; }
        if (dateEl && (!dateEl.value || dateEl.value > S().TODAY)) { toast('검진 실시일을 확인하세요.'); return; }
        S().completeHealth(state.id, { doneDate: dateEl ? dateEl.value : undefined, examinedCount: isNaN(ex) ? undefined : ex });
        V().closeModal(); render(); toast('검진 실시가 반영되었습니다.');
    }
    function saveFollowup() {
        if (deny(S().healthOf(state.id), '사후관리 완료')) return;
        var v = (document.getElementById('hd-c-fu').value || '').trim();
        if (!v) { toast('사후관리 실적을 입력하세요.'); return; }
        S().completeHealth(state.id, { followupResult: v });
        V().closeModal(); render(); toast('사후관리 완료 처리되었습니다.');
    }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        state.id = new URLSearchParams(location.search).get('id');
        render();
    }

    global.HEXD = { init: init, evidence: evidence, saveEvidence: saveEvidence,
        reason: reason, saveReason: saveReason, resetDue: resetDue, saveDue: saveDue,
        notify: notify, pickRecipient: pickRecipient, sendNotify: sendNotify, complete: complete, saveComplete: saveComplete,
        saveFollowup: saveFollowup };
})(window);
