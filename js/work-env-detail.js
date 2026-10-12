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
    /* 사업장 마스터의 대상 판정 스냅샷 — 값이 없는 옛 건은 '기록 없음' 으로 드러낸다 */
    function targetChip(r) {
        var v = r.siteTargetState || '';
        if (!v) return '<span class="sh-res none">기록 없음</span>';
        var tone = v === '대상' ? 'ok' : (v === '비대상' ? 'none' : 'warn');
        var note = v === '검토 중'
            ? ' <span style="color:var(--text-gray);font-size:var(--fs-12);">— 법정 측정대상으로 확정되지 않았습니다(사업장 관리에서 판정)</span>' : '';
        return '<span class="sh-res ' + tone + '">' + esc(v) + '</span>' + note;
    }
    /* ===== 권한 (CLAUDE.md §12) — 목록과 같은 단일 출처 =====
     * 목록에서 지운 행은 **주소로도 못 연다**. 렌더에서만 지우면 URL·콘솔로 뚫린다.
     * 종전에는 이 상세에 게이트가 하나도 없어, 조회 전용 계층(과장·소장)이
     * 남의 부서 건을 주소로 열고 상태까지 바꿀 수 있었다(실측 재현).
     * 부서를 **이름**으로 저장하는 도메인이라 DYV2.deptIdOf() 로 id 를 얻는다(§3). */
    function R() { return global.DYROLE; }
    function did(r) { return V().deptIdOf(r && r.dept ? r.dept : ''); }
    function inScope(r) { return !R() || R().inScope(did(r)); }
    function canAct(r) { return !R() || R().canAct(did(r)); }
    function roNote(r) { return R() ? R().readOnlyNote('측정 계획 등록·결과 첨부', did(r)) : ''; }
    /* 조회 범위 밖 — 내용을 한 글자도 내지 않는다(어느 부서 건인지도 밝히지 않는다) */
    function outOfScope() {
        return '<div class="v2-empty">조회 범위 밖입니다 — 소속 부서 건만 볼 수 있습니다.' +
            '<div style="margin-top:10px;"><a class="btn btn-outline" href="work-env.html">‹ 작업환경측정 목록</a></div></div>';
    }
    /* 조작 차단 — 버튼을 숨기는 것만으로는 전역 호출로 뚫린다 */
    function deny(r, what) {
        if (canAct(r)) return false;
        toast(what + V().josa(what, '은', '는') + ' 해당 부서 담당자가 수행합니다.');
        return true;
    }


    function render() {
        var r = S().workEnvOf(state.id);
        if (!r) { state.mount.innerHTML = '<div class="sh-empty">해당 작업환경측정 건을 찾을 수 없습니다.</div>'; return; }
        if (!inScope(r)) { state.mount.innerHTML = outOfScope(); return; }
        var measured = S().weMeasured(r), needImp = S().weNeedsImprove(r);
        var may = canAct(r);

        /* 상단 액션 바 — 상태별 컨텍스트 액션(점진적 공개). 현 상태에 무의미한 버튼은 렌더하지 않음 */
        var acts = '';
        if (!may) acts = '';
        else {
            if (!measured) acts += '<button type="button" class="btn btn-primary" onclick="WENVD.complete()">측정 완료 처리</button>';
            else if (needImp) acts += '<button type="button" class="btn btn-primary" onclick="WENVD.improveDone()">개선조치 완료</button>';
            else acts += '<span class="sh-st success" style="align-self:center;">완료 처리됨</span>';
            /* 첨부 용도는 상태가 정한다(기획확인 4차 3-1) — 측정 전은 결과보고서, 개선 필요는 개선 증빙.
               끝난 건(측정 완료·적정 / 개선 완료)에는 올리지 않는다(3차 회신 A-1 연번 4). */
            if (!measured) acts += '<button type="button" class="btn btn-outline" onclick="WENVD.evidence(\'결과보고서\')">결과보고서 등록</button>';
            else if (needImp) acts += '<button type="button" class="btn btn-outline" onclick="WENVD.evidence(\'개선 증빙\')">개선 증빙 등록</button>';
            if (!measured || needImp) acts += '<button type="button" class="btn btn-outline" onclick="WENVD.resetDue()">기한 재설정</button>';
            if (!measured) acts += '<button type="button" class="btn btn-outline" onclick="WENVD.reason()">미완료 사유 입력</button>';
            acts += '<button type="button" class="btn btn-outline" onclick="WENVD.notify()">알림 발송</button>';
        }
        var actions = acts ? '<div class="sh-actions" style="margin-bottom:14px;">' + acts + '</div>' : roNote(r);

        /* 개요 */
        var overview =
            '<div class="sh-card"><div class="sh-card-h">개요 <span>' + stChip(r) + '</span></div>' +
            '<dl class="sh-kv">' +
                '<dt>대상 부서 / 사업장</dt><dd><b>' + esc(r.dept) + '</b> · ' + esc(r.site) + '</dd>' +
                /* 사업장의 측정대상 판정 — 계획 생성 시점 스냅샷(SCR-WEM-001 §4-3).
                   저장만 하고 어디에도 보여주지 않으면 「전 사업장이 검토 중」이라는
                   사실이 화면에서 사라진다(§14-12 — 미확정 갭은 드러낸다).
                   '대상' 확정 전에는 법정 대상으로 단정하지 않는다는 것도 함께 밝힌다. */
                '<dt>사업장 측정대상 판정</dt><dd>' + targetChip(r) + '</dd>' +
                '<dt>측정 대상(유해인자)</dt><dd>' + esc(r.subject) + '</dd>' +
                '<dt>위탁업체</dt><dd>' + esc(r.vendor) + '</dd>' +
                '<dt>기준연도 · 반기</dt><dd>' + esc(r.year) + '년 · ' + (r.half === 'H2' ? '하반기' : '상반기') + '</dd>' +
                '<dt>측정 예정일</dt><dd>' + esc(r.planned || '-') + '</dd>' +
                '<dt>측정 실시일</dt><dd>' + (r.done ? esc(r.done) : '<span style="color:var(--text-gray)">미실시</span>') + '</dd>' +
                '<dt>담당자</dt><dd>' + esc(r.owner) + '</dd>' +
                '<dt>대상 근거</dt><dd>' + esc(r.targetBasis || '현업 종사자 · 유해인자 노출') + '</dd>' +
                '<dt>결과 보존연한</dt><dd><b>' + S().retentionOf(r) + '년</b>' +
                    (r.carcinogen ? ' <span style="color:var(--status-warning-fg)">(고시 대상 물질)</span>' : '') + '</dd>' +
            '</dl></div>';

        /* 결과보고서 */
        var report =
            '<div class="sh-card"><div class="sh-card-h">용역 결과보고서 <span class="sub">위탁업체 제출 · 증빙</span></div>' +
            (r.report
                ? '<div class="sh-photos"><div class="sh-photo has">' + S().icon('file', 26) + '<span>결과보고서.pdf' +
                    (r.reportVersions > 1 ? ' · 제' + r.reportVersions + '판' : '') + '</span></div>' +
                  '<div style="align-self:center;font-size:13px;color:var(--text-gray);">위탁업체 결과보고서가 등록되어 있습니다.</div></div>'
                : '<div class="sh-req">아직 결과보고서가 등록되지 않았습니다. 위탁업체 제출 후 <b>[결과보고서 등록]</b>으로 첨부하세요.</div>') +
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

    /* ── 증빙 등록 — 용도별(결과보고서 / 개선 증빙) ──
     * 어느 용도를 받을지는 상태가 정한다: 측정 전 = 결과보고서, 개선 필요 = 개선 증빙, 끝난 건 = 받지 않음
     * (3차 회신 A-1 연번 4 · 기획확인 4차 3-1). 여는 쪽과 저장 쪽이 같은 판정을 쓴다. */
    var EV_PURPOSE = '결과보고서';
    function evidenceAllowed(r, purpose) {
        if (!r) return false;
        var measured = S().weMeasured(r), needImp = S().weNeedsImprove(r);
        return purpose === '개선 증빙' ? (measured && needImp) : !measured;
    }
    function evidence(purpose) {
        purpose = purpose === '개선 증빙' ? '개선 증빙' : '결과보고서';
        var r = S().workEnvOf(state.id);
        if (deny(r, purpose + ' 등록')) return;
        if (!evidenceAllowed(r, purpose)) { toast('끝난 건에는 증빙을 올리지 않습니다 — 최초 결과와 증빙을 그대로 보존합니다.'); return; }
        EV_PURPOSE = purpose;
        V().openModal(purpose + ' 등록',
            '<p style="font-size:13px;margin-bottom:10px;color:var(--text-gray);">' +
                (purpose === '개선 증빙'
                    ? '개선조치를 마친 뒤의 증빙(조치 후 사진·확인서 등)을 첨부합니다. 개선 완료 판정의 근거가 됩니다.'
                    : '위탁업체가 제출한 작업환경측정 결과보고서를 첨부합니다. 다시 올리면 이전 판은 지우지 않고 남습니다.') + '</p>' +
            V().uploadDrop('파일을 끌어다 놓거나 클릭하여 업로드<br><span style="font-size:12px;">업로드 시 이력이 자동 기록됩니다</span>', null, { hint: true }),
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="WENVD.saveEvidence()">등록</button>');
    }
    function saveEvidence() {
        var r = S().workEnvOf(state.id);
        if (deny(r, EV_PURPOSE + ' 등록')) return;
        if (!evidenceAllowed(r, EV_PURPOSE)) { V().closeModal(); toast('끝난 건에는 증빙을 올리지 않습니다.'); return; }
        S().attachEvidence('we', state.id, EV_PURPOSE); V().closeModal(); render();
        toast(EV_PURPOSE + (EV_PURPOSE === '개선 증빙' ? '이' : '가') + ' 등록되었습니다.');
    }

    /* ── 미완료 사유 ── */
    function reason() {
        if (deny(S().workEnvOf(state.id), '미완료 사유 입력')) return;
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
        if (deny(S().workEnvOf(state.id), '미완료 사유 입력')) return;
        var v = (document.getElementById('wd-reason').value || '').trim();
        if (!v) { toast('사유를 입력하세요.'); return; }
        S().setReason('we', state.id, v, document.getElementById('wd-exp').value);
        V().closeModal(); render(); toast('미완료 사유가 저장되었습니다.');
    }

    /* ── 기한 재설정 ── */
    function resetDue() {
        if (deny(S().workEnvOf(state.id), '기한 재설정')) return;
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
        if (deny(S().workEnvOf(state.id), '기한 재설정')) return;
        var v = document.getElementById('wd-due').value;
        if (!v) { toast('날짜를 선택하세요.'); return; }
        S().resetDue('we', state.id, field, v);
        V().closeModal(); render(); toast('기한이 재설정되었습니다.');
    }

    /* ── 알림 발송 ── */
    function notify() {
        if (deny(S().workEnvOf(state.id), '알림 발송')) return;
        var r = S().workEnvOf(state.id);
        V().openModal('알림 발송',
            '<div style="margin-bottom:12px;"><label class="form-label" for="wd-nt-to">수신자 <span style="font-weight:400;color:var(--text-gray)">(조직도에서 선택)</span></label>' +
                '<div class="orgpick-field" id="wd-nt-tofield"><div style="display:flex;gap:8px;">' +
                    '<input type="text" class="form-input" id="wd-nt-to" style="flex:1;" value="' + esc(r.owner) + '">' +
                    '<button type="button" class="btn btn-outline" onclick="ORGPICK.toggle(\'wd-nt-tofield\',\'member\',\'WENVD.pickRecipient\')">조직도</button>' +
                '</div></div></div>' +
            '<div style="margin-bottom:12px;"><label class="form-label" for="wd-nt-msg">알림 내용</label>' +
                '<textarea class="form-textarea" id="wd-nt-msg" rows="2">[작업환경측정] ' + esc(r.dept) + ' ' + esc(r.site) + ' 측정/개선 진행 요청</textarea></div>' +
            '<div class="sh-req" style="font-size:12px;line-height:1.5;">본 알림은 수신자의 <b>새올행정시스템 포틀릿(알림)</b>으로 발송됩니다. <span style="color:var(--text-gray)">(연계 적용 후 실제 전송)</span></div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="WENVD.sendNotify()">발송</button>');
    }
    function pickRecipient(val) { var inp = document.getElementById('wd-nt-to'); if (inp) inp.value = val; }
    function sendNotify() {
        if (deny(S().workEnvOf(state.id), '알림 발송')) return;
        var to = (document.getElementById('wd-nt-to').value || '').trim();
        S().notify('we', state.id, to);
        V().closeModal(); render(); toast('새올 포틀릿으로 알림을 발송했습니다.');
    }

    /* ── 완료 처리 ── */
    /* 측정 미실시 → 결과 입력 모달(실시일=오늘·결과=적정 기본으로 최소 입력) */
    function complete() {
        if (deny(S().workEnvOf(state.id), '측정 완료 처리')) return;
        var r = S().workEnvOf(state.id);
        if (!r.report) { toast('결과보고서를 먼저 등록하세요.'); return; }
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
        if (deny(S().workEnvOf(state.id), '측정 완료 처리')) return;
        var result = document.getElementById('wd-c-result').value;
        var doneDate = document.getElementById('wd-c-date').value;
        if (!doneDate) { toast('측정 실시일을 선택하세요.'); return; }
        if (doneDate > S().TODAY) { toast('측정 실시일은 오늘 이후일 수 없습니다.'); return; }
        var opts = { doneDate: doneDate, result: result };
        if (result === '개선 필요') {
            opts.improveReq = (document.getElementById('wd-c-req').value || '').trim();
            opts.improveDue = document.getElementById('wd-c-due').value;
            if (!opts.improveReq) { toast('개선 요구사항을 입력하세요.'); return; }
            if (!opts.improveDue || opts.improveDue <= doneDate) { toast('개선조치 기한은 측정 실시일 이후로 선택하세요.'); return; }
            var legalDue = S().addDays(doneDate, 60);
            if (opts.improveDue > legalDue) { toast('개선조치 기한은 법정 제출기한(' + legalDue + ') 이내로 선택하세요.'); return; }
        }
        S().completeWorkEnv(state.id, opts);
        V().closeModal(); render();
        toast(result === '적정' ? '측정 완료 · 결과 「적정」' : '측정 완료 · 「개선 필요」 등록');
    }
    function improveDone() {
        if (deny(S().workEnvOf(state.id), '개선조치 완료')) return;
        V().openModal('개선조치 완료',
            '<div style="margin-bottom:12px;"><label class="form-label" for="wd-i-date">개선 완료일 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="date" class="form-input" id="wd-i-date" value="' + esc(S().TODAY) + '"></div>' +
            '<div style="margin-bottom:12px;"><label class="form-label" for="wd-i-result">개선 결과 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<textarea class="form-textarea" id="wd-i-result" rows="3" placeholder="실제 조치 내용과 확인 결과"></textarea></div>' +
            '<label class="form-label">조치 후 증빙 <span style="color:var(--status-danger-fg)">*</span></label>' +
                V().uploadDrop('조치 후 사진·증빙을 등록하세요', null, { hint: true }),
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="WENVD.saveImproveDone()">완료 처리</button>');
    }
    function saveImproveDone() {
        if (deny(S().workEnvOf(state.id), '개선조치 완료')) return;
        var date = document.getElementById('wd-i-date').value;
        var result = (document.getElementById('wd-i-result').value || '').trim();
        if (!date || date > S().TODAY) { toast('개선 완료일을 확인하세요.'); return; }
        if (!result) { toast('개선 결과를 입력하세요.'); return; }
        S().completeWorkEnv(state.id, { improveDoneAt: date, improveResult: result });
        V().closeModal(); render(); toast('개선조치 완료와 조치 후 증빙이 기록되었습니다.');
    }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        state.id = new URLSearchParams(location.search).get('id');
        render();
    }

    global.WENVD = { init: init, evidence: evidence, saveEvidence: saveEvidence, reason: reason, saveReason: saveReason,
        resetDue: resetDue, saveDue: saveDue, notify: notify, pickRecipient: pickRecipient, sendNotify: sendNotify,
        complete: complete, toggleImprove: toggleImprove, saveComplete: saveComplete,
        improveDone: improveDone, saveImproveDone: saveImproveDone };
})(window);
