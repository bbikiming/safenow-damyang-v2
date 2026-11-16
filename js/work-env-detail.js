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


    /* 주관부서 담당자 — 노동관서 제출일 기록(시행규칙 §188③ 제출은 사업주 = 재난안전과 몫) */
    function canOwner() { return !R() || R().canAct(R().OWNER_DEPT); }
    /* 결과 안내 공문을 보낸 행 — 결과·결과보고서를 잠근다(판정은 DYSH.weLockOf 한 곳) */
    function lockOf(r) { return r ? S().weLockOf(r.id) : null; }
    function lockDeny(r, what) {
        var d = lockOf(r); if (!d) return false;
        toast('결과 안내 공문(' + d.at + ')을 보낸 건이라 ' + what + V().josa(what, '을', '를') + ' 할 수 없습니다.');
        return true;
    }

    function render() {
        var r = S().workEnvOf(state.id);
        if (!r) { state.mount.innerHTML = '<div class="sh-empty">해당 작업환경측정 건을 찾을 수 없습니다.</div>'; return; }
        if (!inScope(r)) { state.mount.innerHTML = outOfScope(); return; }
        var measured = S().weMeasured(r), needImp = S().weNeedsImprove(r);
        var may = canAct(r), lk = lockOf(r);

        /* ===== 진행 순서 · «지금 할 일» (2026-11-16) =====
         * 단계는 저장값에서 파생한다. 누가 하는 단계인지(who)와 지금 접속한 사람이 그 사람인지(mine)를
         * 함께 넘겨, 내 차례일 때만 그 버튼을 강조하고 아니면 누구를 기다리는지 말한다. */
        var p = R() && R().current ? R().current() : null;
        var staff = !p || p.tier === 'staff';
        var meOwner = staff && canOwner();
        var meDept = staff && !!p && !!p.deptId && p.deptId === did(r);
        var own = S().regByOf(r) === 'owner';
        var fine = measured && r.result === '적정';
        var doer = own ? '재난안전과' : r.dept;
        var mineDoer = own ? meOwner : meDept;   /* 강조는 그 단계를 하는 사람에게만 — 버튼은 권한대로 남긴다 */
        /* 해당하는 단계만 보인다 — 적정이면 «결과 등록 → 결과 안내 공문» 두 줄로 끝난다(2026-11-16 «2단계로») */
        var steps = [
            { key: 'result', lab: '결과 등록', who: doer, mine: mineDoer, done: measured,
              note: measured ? r.result + (r.exceed ? ' · 노출기준 초과' : '') + ' · ' + S().reportFiles(r).map(function (f) { return f.name; }).join(', ')
                  : '결과보고서 파일 · 측정(시료채취) 완료일 · 적정/개선 필요' },
            { key: 'notice', lab: '결과 안내 공문 보내기', who: '재난안전과', mine: meOwner, done: !!lk, skip: !own,
              note: lk ? lk.status + ' ' + lk.at + ' — 검토·결재는 온나라에서 합니다' : '부서장에게 결과를 알립니다 · 검토·결재는 온나라에서' },
            { key: 'improve', lab: '개선조치 완료', who: r.dept, mine: meDept, done: !!r.improveDone, skip: !measured || fine,
              note: r.improveDone ? '완료 ' + (r.improveDoneAt || '') : (r.improveDue ? '기한 ' + r.improveDue + ' · 조치 후 증빙을 함께 올립니다' : '') },
            { key: 'labor', lab: '노동관서 제출 기록', who: '재난안전과', mine: meOwner, done: !!r.laborSubmittedAt, skip: !r.exceed,
              note: r.laborSubmittedAt ? r.laborSubmittedAt + ' 제출' : (r.exceed && r.done ? '노출기준 초과 — ' + S().addDays(r.done, 60) + '까지' : '') }
        ];
        var cur = S().flowCur(steps), cs = cur >= 0 ? steps[cur] : null;
        var nowKey = cs && cs.mine && may ? cs.key : '';
        /* 노동관서 제출은 부서 개선조치와 나란히 간다 — 재난안전과에게는 공문을 보낸 뒤 바로 자기 차례다 */
        if (!nowKey && meOwner && r.exceed && !r.laborSubmittedAt && (lk || !own) && measured) nowKey = 'labor';

        /* 버튼은 단계 순서대로 늘어놓는다 — 보조 처리(결과 수정·기한·사유·알림)는 뒤에 */
        var B = function (key, label, fn) { return '<button type="button" class="btn btn-outline" data-step="' + key + '" onclick="' + fn + '">' + label + '</button>'; };
        var acts = '';
        if (may) {
            if (!measured) acts += B('result', '결과 등록', 'WENVD.complete()');
            if (own && measured && !lk && meOwner) acts += '<a class="btn btn-outline" data-step="notice" href="work-env.html?year=' + r.year + '&half=' + r.half + '">결과 안내 공문 보내러 가기</a>';
            if (needImp) acts += B('improve', '개선조치 완료', 'WENVD.improveDone()');
            if (r.exceed && !r.laborSubmittedAt && meOwner) acts += B('labor', '노동관서 제출일 기록', 'WENVD.laborSubmit()');
            if (measured && !lk) acts += '<button type="button" class="btn btn-outline" onclick="WENVD.editResult()">결과 수정</button>';
            if (!measured || needImp) acts += '<button type="button" class="btn btn-outline" onclick="WENVD.resetDue()">기한 재설정</button>';
            if (!measured) acts += '<button type="button" class="btn btn-outline" onclick="WENVD.reason()">미완료 사유 입력</button>';
            acts += '<button type="button" class="btn btn-outline" onclick="WENVD.notify()">알림 발송</button>';
        }
        var actions = S().flowHtml('진행 순서', steps, nowKey) +
            (acts ? '<div class="sh-actions" style="margin-bottom:14px;">' + acts + '</div>' : roNote(r));

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
                '<dt>측정(시료채취) 완료일</dt><dd>' + (r.done ? esc(r.done) : '<span style="color:var(--text-gray)">미실시</span>') + '</dd>' +
                /* 결과 안내 공문 — 재난안전과 위탁 측정만 싣는다. 부서가 직접 맡긴 측정은 결과 첨부로 끝난다 */
                '<dt>결과 안내 공문</dt><dd>' + (lk
                    ? '<span class="chip-status ' + V().toneOf(lk.status) + ' chip-sm">' + esc(lk.status) + '</span> ' + esc(lk.at) + ' · ' + esc(lk.title)
                    : (S().regByOf(r) === 'dept' ? '<span style="color:var(--text-gray)">부서 자체 측정 — 공문 없음</span>'
                        : '<span style="color:var(--text-gray)">보내기 전</span>')) + '</dd>' +
                '<dt>담당자</dt><dd>' + esc(r.owner) + '</dd>' +
                '<dt>대상 근거</dt><dd>' + esc(r.targetBasis || '현업 종사자 · 유해인자 노출') + '</dd>' +
                '<dt>결과 보존연한</dt><dd><b>' + S().retentionOf(r) + '년</b>' +
                    (r.carcinogen ? ' <span style="color:var(--status-warning-fg)">(고시 대상 물질)</span>' : '') + '</dd>' +
            '</dl></div>';

        /* 결과보고서 */
        var report =
            '<div class="sh-card"><div class="sh-card-h">용역 결과보고서 <span class="sub">위탁업체 제출 · 증빙</span></div>' +
            (r.report
                ? '<div class="sh-photos">' + S().reportFiles(r).map(function (f) {
                        return '<div class="sh-photo has">' + S().icon('file', 26) + '<span>' + esc(f.name) + '</span></div>';
                    }).join('') +
                  (r.reportVersions > 1 ? '<div style="align-self:center;font-size:13px;color:var(--text-gray);">제' + r.reportVersions + '판 · 이전 판은 보존됩니다.</div>' : '') +
                  (S().reportFiles(r).some(function (f) { return f.sample; }) ? '<div style="align-self:center;">' + V().sampleChip('파일 이름은 예시 자료입니다.') + '</div>' : '') +
                  '</div>'
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
                    (r.result === '개선 필요' ? '<dt>노출기준 초과</dt><dd>' + (r.exceed ? '<b style="color:var(--status-danger-fg)">초과</b>' : '아니오') + '</dd>' : '') +
                    dueRow +
                    (r.exceed ? '<dt>노동관서 제출</dt><dd>' + (r.laborSubmittedAt
                        ? esc(r.laborSubmittedAt) + ' 제출'
                        : (canOwner() ? '<button type="button" class="btn btn-sm btn-outline" onclick="WENVD.laborSubmit()">제출일 기록</button>'
                            : '<span style="color:var(--text-gray)">미제출 — 재난안전과가 제출합니다</span>')) + '</dd>' +
                      '<dt>다음 측정 기한</dt><dd><b>' + esc(S().remeasureDue(r)) + '</b> <span style="color:var(--text-gray);font-size:var(--fs-12);">노출기준 초과 — 측정일부터 3개월 이내</span></dd>' : '') +
                '</dl>' +
                (r.result === '개선 필요'
                    ? '<div style="margin-top:12px;"><div class="sh-card-h" style="margin-bottom:8px;">개선 요구사항</div>' +
                      '<div class="sh-req">' + esc(r.improveReq || '개선 요구사항 미입력') + '</div>' +
                      '<div class="sh-card-h" style="margin:14px 0 8px;">개선 전 · 후 사진</div>' +
                      '<div class="sh-photos">' +
                        '<div class="sh-photo' + (r.beforePhoto ? ' has' : '') + '">' + (r.beforePhoto ? S().icon('image', 26) + '<span>개선 전</span>' : '개선 전<br>사진 없음') + '</div>' +
                        '<div class="sh-photo' + (r.afterPhoto ? ' has' : '') + '">' + (r.afterPhoto ? S().icon('image', 26) + '<span>개선 후</span>' : '개선 후<br>미등록') + '</div>' +
                      '</div>' +
                      (r.exceed ? '<div style="margin-top:10px;font-size:12px;color:var(--text-gray);">노출기준 초과 — 시료채취를 마친 날부터 60일 이내에 개선 증명 서류 또는 개선 계획을 관할 지방고용노동관서에 제출합니다.</div>' : '') +
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

        /* 인력평가 연계 안내는 걷었다(운영 T13, 2026-11-04) — 사용자가 몰라도 되는 연계 설명이다 */
        var linknote = '';

        state.mount.innerHTML = actions + linknote +
            '<div class="sh-detail">' + overview + report + resultCard + pendingCard + histCard + '</div>';
        S().markNow(state.mount, nowKey);
    }

    /* ── 증빙 등록 — 용도별(결과보고서 / 개선 증빙) ──
     * 어느 용도를 받을지는 상태가 정한다: 측정 전 = 결과보고서, 개선 필요 = 개선 증빙, 끝난 건 = 받지 않음
     * (3차 회신 A-1 연번 4 · 기획확인 4차 3-1). 여는 쪽과 저장 쪽이 같은 판정을 쓴다. */
    var EV_PURPOSE = '결과보고서', EV_FILE = null, EV_WHICH = '개선 증빙';
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
        if (purpose === '결과보고서' && lockDeny(r, '결과보고서 등록')) return;
        EV_PURPOSE = purpose; EV_FILE = null; EV_WHICH = '개선 증빙';
        renderEvidence();
    }
    function renderEvidence() {
        var imp = EV_PURPOSE === '개선 증빙';
        V().openModal(EV_PURPOSE + ' 등록',
            '<p style="font-size:13px;margin-bottom:10px;color:var(--text-gray);">' +
                (imp ? '개선조치 전·후의 사진이나 확인서를 첨부합니다.'
                     : '측정기관이 보낸 작업환경측정 결과보고서를 첨부합니다. 다시 올리면 이전 판은 지우지 않고 남습니다.') + '</p>' +
            (imp ? '<div class="ri-modal-row" style="margin-bottom:10px;display:flex;gap:16px;">' +
                    ['개선 전 사진', '개선 증빙'].map(function (k) {
                        return '<label><input type="radio" name="wd-ev-which" value="' + k + '"' + (EV_WHICH === k ? ' checked' : '') +
                            ' onchange="WENVD.setWhich(this.value)"> ' + (k === '개선 증빙' ? '개선 후 · 조치 증빙' : '개선 전 사진') + '</label>';
                    }).join('') + '</div>' : '') +
            (EV_FILE ? '<p style="margin-bottom:8px;">' + S().icon('file') + ' <b>' + esc(EV_FILE.name) + '</b></p>' : '') +
            V().uploadDrop('파일을 끌어다 놓거나 클릭하여 업로드', null, { hint: true, pick: 'WENVD.onPick' }),
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="WENVD.saveEvidence()">등록</button>');
    }
    function onPick(items) { EV_FILE = items && items[0] ? { name: items[0].name, size: items[0].size } : null; renderEvidence(); }
    function setWhich(v) { EV_WHICH = v === '개선 전 사진' ? '개선 전 사진' : '개선 증빙'; }
    function saveEvidence() {
        var r = S().workEnvOf(state.id);
        if (deny(r, EV_PURPOSE + ' 등록')) return;
        if (!evidenceAllowed(r, EV_PURPOSE)) { V().closeModal(); toast('끝난 건에는 증빙을 올리지 않습니다.'); return; }
        if (!EV_FILE) { toast('파일을 고르세요.'); return; }
        var label = EV_PURPOSE === '개선 증빙' ? EV_WHICH : '결과보고서';
        if (!S().attachEvidence('we', state.id, label, EV_FILE.name)) { V().closeModal(); lockDeny(r, '결과보고서 등록'); return; }
        V().closeModal(); render();
        toast(label + (label === '결과보고서' ? '가' : '이') + ' 등록되었습니다.');
    }

    /* ── 미완료 사유 ── */
    function reason() {
        if (deny(S().workEnvOf(state.id), '미완료 사유 입력')) return;
        var r = S().workEnvOf(state.id);
        V().openModal('미완료 사유 입력',
            '<div style="margin-bottom:12px;"><label class="form-label">미완료(미실시) 사유 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<textarea class="form-textarea" id="wd-reason" rows="3" placeholder="예: 위탁업체 일정 지연 / 현장 여건">' + esc(r.reason || '') + '</textarea></div>' +
            '<div><label class="form-label">예상 완료일</label>' +
                '<input type="date" class="form-input" id="wd-exp" value="' + esc(r.expectedDone || S().addDays(S().TODAY, 30)) + '"></div>',
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
            '<input type="date" class="form-input" id="wd-due" value="' + esc(cur || S().addDays(S().TODAY, 30)) + '">',
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
        V().closeModal(); render(); toast('알림을 기록했습니다 — 수신자 전송은 새올 연계 후 이루어집니다.');
    }

    /* ── 완료 처리 ── */
    /* 측정 미실시 → 결과 입력 모달(실시일=오늘·결과=적정 기본으로 최소 입력) */
    var EDIT = false;
    function complete() {
        if (deny(S().workEnvOf(state.id), '결과 등록')) return;
        var r = S().workEnvOf(state.id);
        if (r.done) { toast('이미 결과를 등록한 건입니다 — 고치려면 [결과 수정]을 누르세요.'); return; }
        EDIT = false; EV_FILE = null; resultModal(r);
    }
    function editResult() {
        var r = S().workEnvOf(state.id);
        if (deny(r, '결과 수정')) return;
        if (!r.done) { toast('아직 결과를 등록하지 않았습니다.'); return; }
        if (lockDeny(r, '결과 수정')) return;
        EDIT = true; resultModal(r);
    }
    function resultModal(r) {
        var imp = EDIT && r.result === '개선 필요';
        var needFile = !EDIT && !r.report;
        V().openModal(EDIT ? '결과 수정' : '결과 등록',
            (EDIT ? '<p class="file-hint" style="margin-bottom:10px;">결과 안내 공문을 보내기 전까지 고칠 수 있습니다. 고친 내용은 이력에 남습니다.</p>' : '') +
            /* 결과보고서는 이 창에서 함께 받는다 — 첨부와 결과 입력을 두 번 나누지 않는다 */
            (needFile ? '<div style="margin-bottom:12px;"><label class="form-label">결과보고서 <span style="color:var(--status-danger-fg)">*</span></label>' +
                (EV_FILE ? '<p style="margin-bottom:8px;">' + S().icon('file') + ' <b>' + esc(EV_FILE.name) + '</b></p>' : '') +
                V().uploadDrop('측정기관이 보낸 결과보고서를 끌어다 놓거나 클릭하여 업로드', null, { hint: true, pick: 'WENVD.onPickResult' }) + '</div>' : '') +
            '<div style="margin-bottom:12px;"><label class="form-label" for="wd-c-date">측정(시료채취) 완료일</label>' +
                '<input type="date" class="form-input" id="wd-c-date" value="' + esc(EDIT ? r.done : S().TODAY) + '"></div>' +
            '<div style="margin-bottom:12px;"><label class="form-label" for="wd-c-result">측정 결과</label>' +
                '<select class="form-select" id="wd-c-result" onchange="WENVD.toggleImprove()">' +
                    '<option value="적정"' + (imp ? '' : ' selected') + '>적정</option><option value="개선 필요"' + (imp ? ' selected' : '') + '>개선 필요</option></select></div>' +
            '<div id="wd-c-imp" style="display:' + (imp ? '' : 'none') + ';">' +
                '<div style="margin-bottom:12px;"><label class="form-label" for="wd-c-req">개선 요구사항</label>' +
                    '<textarea class="form-textarea" id="wd-c-req" rows="2" placeholder="개선이 필요한 항목·개선 방향">' + esc(imp ? r.improveReq : '') + '</textarea></div>' +
                /* 시행규칙 §188③·§190① 단서 — 노출기준 초과만 60일 제출 기한과 3개월 재측정이 걸린다 */
                '<div style="margin-bottom:12px;"><label><input type="checkbox" id="wd-c-exceed"' + (imp && r.exceed ? ' checked' : '') + '> 노출기준 초과</label>' +
                    '<p class="file-hint">초과면 시료채취를 마친 날부터 60일 안에 개선 서류·계획을 노동관서에 내고, 3개월 안에 다시 측정합니다.</p></div>' +
                '<div><label class="form-label" for="wd-c-due">개선조치 기한</label>' +
                    '<input type="date" class="form-input" id="wd-c-due" value="' + esc(imp && r.improveDue ? r.improveDue : S().addDays(S().TODAY, 60)) + '"></div>' +
            '</div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="WENVD.saveComplete()">' + (EDIT ? '저장' : '등록') + '</button>');
    }
    /* 결과 창에서 파일을 고르면 입력값을 지키며 창을 다시 그린다 */
    function onPickResult(items) {
        var keep = {};
        ['wd-c-date', 'wd-c-result', 'wd-c-req', 'wd-c-due'].forEach(function (id) { var el = document.getElementById(id); if (el) keep[id] = el.value; });
        var ex = document.getElementById('wd-c-exceed'); keep.ex = ex ? ex.checked : false;
        EV_FILE = items && items[0] ? { name: items[0].name, size: items[0].size } : null;
        resultModal(S().workEnvOf(state.id));
        Object.keys(keep).forEach(function (id) { var el = document.getElementById(id); if (el && id !== 'ex') el.value = keep[id]; });
        if (document.getElementById('wd-c-exceed')) document.getElementById('wd-c-exceed').checked = keep.ex;
        toggleImprove();
    }
    function toggleImprove() {
        var sel = document.getElementById('wd-c-result').value;
        document.getElementById('wd-c-imp').style.display = (sel === '개선 필요') ? '' : 'none';
    }
    function saveComplete() {
        if (deny(S().workEnvOf(state.id), '결과 등록')) return;
        var result = document.getElementById('wd-c-result').value;
        var doneDate = document.getElementById('wd-c-date').value;
        if (!doneDate) { toast('측정 실시일을 선택하세요.'); return; }
        if (doneDate > S().TODAY) { toast('측정(시료채취) 완료일은 오늘 이후일 수 없습니다.'); return; }
        var opts = { doneDate: doneDate, result: result };
        if (result === '개선 필요') {
            opts.improveReq = (document.getElementById('wd-c-req').value || '').trim();
            opts.improveDue = document.getElementById('wd-c-due').value;
            opts.exceed = !!(document.getElementById('wd-c-exceed') || {}).checked;
            if (!opts.improveReq) { toast('개선 요구사항을 입력하세요.'); return; }
            if (!opts.improveDue || opts.improveDue <= doneDate) { toast('개선조치 기한은 측정(시료채취) 완료일 이후로 선택하세요.'); return; }
            if (opts.improveDue < S().TODAY) { toast('개선조치 기한은 오늘 이후로 선택하세요.'); return; }
            /* 60일 검사는 노출기준 초과 건만 — 법정 기한은 초과 공정에만 걸린다(시행규칙 §188③) */
            var legalDue = S().addDays(doneDate, 60);
            if (opts.exceed && opts.improveDue > legalDue) { toast('노출기준 초과 건의 개선조치 기한은 법정 제출기한(' + legalDue + ') 이내로 선택하세요.'); return; }
        }
        if (EDIT) {
            if (lockDeny(S().workEnvOf(state.id), '결과 수정')) { V().closeModal(); return; }
            if (!S().editWorkEnvResult(state.id, opts)) { toast('결과를 고치지 못했습니다.'); return; }
            V().closeModal(); render(); toast('결과를 고쳤습니다.'); return;
        }
        var rr = S().workEnvOf(state.id);
        if (!rr.report) {
            if (!EV_FILE) { toast('결과보고서 파일을 올리세요.'); return; }
            if (!S().attachEvidence('we', state.id, '결과보고서', EV_FILE.name)) { V().closeModal(); lockDeny(rr, '결과 등록'); return; }
        }
        if (!S().completeWorkEnv(state.id, opts)) { V().closeModal(); toast('이미 결과를 등록한 건입니다 — 고치려면 [결과 수정]을 누르세요.'); return; }
        V().closeModal(); render();
        toast(result === '적정' ? '측정 완료 · 결과 「적정」' : '측정 완료 · 「개선 필요」 등록');
    }
    function onPickImprove(items) {
        EV_FILE = items && items[0] ? { name: items[0].name, size: items[0].size } : null;
        var box = document.getElementById('wd-i-file');
        if (box) box.innerHTML = EV_FILE ? '<p style="margin-bottom:8px;">' + S().icon('file') + ' <b>' + esc(EV_FILE.name) + '</b></p>' : '';
    }
    function improveDone() {
        if (deny(S().workEnvOf(state.id), '개선조치 완료')) return;
        EV_FILE = null;
        V().openModal('개선조치 완료',
            '<div style="margin-bottom:12px;"><label class="form-label" for="wd-i-date">개선 완료일 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="date" class="form-input" id="wd-i-date" value="' + esc(S().TODAY) + '"></div>' +
            '<div style="margin-bottom:12px;"><label class="form-label" for="wd-i-result">개선 결과 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<textarea class="form-textarea" id="wd-i-result" rows="3" placeholder="실제 조치 내용과 확인 결과"></textarea></div>' +
            '<label class="form-label">조치 후 증빙 <span style="color:var(--status-danger-fg)">*</span> <span class="file-hint">사진·확인서 — 개선 전 사진이 있으면 함께</span></label>' +
                '<div id="wd-i-file">' + (EV_FILE ? '<p style="margin-bottom:8px;">' + S().icon('file') + ' <b>' + esc(EV_FILE.name) + '</b></p>' : '') + '</div>' +
                V().uploadDrop('조치 후 사진·증빙을 끌어다 놓거나 클릭하여 업로드', null, { hint: true, pick: 'WENVD.onPickImprove' }),
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="WENVD.saveImproveDone()">완료 처리</button>');
    }
    function saveImproveDone() {
        if (deny(S().workEnvOf(state.id), '개선조치 완료')) return;
        var date = document.getElementById('wd-i-date').value;
        var result = (document.getElementById('wd-i-result').value || '').trim();
        if (!date || date > S().TODAY) { toast('개선 완료일을 확인하세요.'); return; }
        if (!result) { toast('개선 결과를 입력하세요.'); return; }
        if (!EV_FILE) { toast('조치 후 증빙 파일을 올리세요.'); return; }
        S().attachEvidence('we', state.id, '개선 증빙', EV_FILE.name);
        S().completeWorkEnv(state.id, { improveDoneAt: date, improveResult: result });
        V().closeModal(); render(); toast('개선조치 완료와 조치 후 증빙이 기록되었습니다.');
    }

    /* 노출기준 초과 건 노동관서 제출일 — 재난안전과 담당자(시행규칙 §188③) */
    function laborSubmit() {
        var r = S().workEnvOf(state.id);
        if (!canOwner()) { toast('노동관서 제출은 재난안전과 담당자가 기록합니다.'); return; }
        if (!r || !r.exceed) return;
        V().openModal('노동관서 제출일 기록',
            '<p class="file-hint" style="margin-bottom:10px;">개선 증명 서류 또는 개선 계획을 관할 지방고용노동관서에 낸 날을 적습니다. 기한: ' + esc(S().addDays(r.done, 60)) + '</p>' +
            '<label class="form-label" for="wd-l-date">제출일</label><input type="date" class="form-input" id="wd-l-date" value="' + esc(S().TODAY) + '">',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="WENVD.saveLabor()">저장</button>');
    }
    function saveLabor() {
        if (!canOwner()) { toast('노동관서 제출은 재난안전과 담당자가 기록합니다.'); return; }
        var r = S().workEnvOf(state.id), v = (document.getElementById('wd-l-date') || {}).value;
        if (!v || v > S().TODAY) { toast('제출일을 확인하세요.'); return; }
        if (r && v < r.done) { toast('제출일은 측정(시료채취) 완료일 이후입니다.'); return; }
        if (!S().setLaborSubmit(state.id, v)) { toast('노출기준 초과 건만 기록합니다.'); return; }
        V().closeModal(); render(); toast('노동관서 제출일을 기록했습니다.');
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
        improveDone: improveDone, saveImproveDone: saveImproveDone,
        editResult: editResult, onPick: onPick, onPickResult: onPickResult, onPickImprove: onPickImprove, setWhich: setWhich, laborSubmit: laborSubmit, saveLabor: saveLabor };
})(window);
