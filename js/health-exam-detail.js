/* =====================================================================
   health-exam-detail.js · 건강검진 상세·조치 (HEX01-D)
   · 검진 일정·대상자 현황·실시 증빙·미검진 사유·사후관리·이력
   · 개인별 상세는 보건담당 권한 사용자만 열람(권한 전환 데모)
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

    /* 관리 버전 탭 — 목록과 동일(상세에서도 전환 가능) */
    function vbar() {
        var v = S().healthView();
        function tab(key, label, rec) {
            return '<button type="button" class="sh-vtab' + (v === key ? ' is-active' : '') + '" role="tab" aria-selected="' + (v === key ? 'true' : 'false') + '" onclick="HEXD.setView(\'' + key + '\')">' + label + (rec ? ' <span class="rec">권장</span>' : '') + '</button>';
        }
        var note = v === 'simple'
            ? '<span class="sh-vnote"><b>단순 첨부형</b> — 집계·증빙 중심(개인별 미관리)</span>'
            : v === 'detail'
                ? '<span class="sh-vnote"><b>상세 관리형</b> — 개인별 수검 현황·사후관리 계획/실적 포함</span>'
                : '<span class="sh-vnote"><b>절차 진행형</b> — 대상자 선정 → 문진표 발송 → 결과 업로드 → 새올 알림</span>';
        return '<div class="sh-vbar"><div class="sh-vtabs" role="tablist" aria-label="건강검진 관리 버전">' +
            tab('simple', '단순 첨부형', true) + tab('detail', '상세 관리형', false) + tab('proc', '절차 진행형', false) + '</div>' + note + '</div>';
    }
    function setView(vv) { S().setHealthView(vv); render(); }

    function render() {
        var r = S().healthOf(state.id);
        if (!r) { state.mount.innerHTML = '<div class="sh-empty">해당 건강검진 건을 찾을 수 없습니다.</div>'; return; }
        var v = S().healthView();
        if (v === 'proc') { renderProc(r); return; }
        var unex = S().hcUnexamined(r);
        var done = !!r.done;
        var rate = r.targetCount ? Math.round(r.examinedCount / r.targetCount * 100) : 0;
        var barTone = rate >= 100 ? '' : (rate >= 80 ? 'warn' : 'danger');

        /* 상단 액션 — 상태별 컨텍스트 액션(점진적 공개) */
        var acts = '';
        if (!done) acts += '<button type="button" class="btn btn-primary" onclick="HEXD.complete()">검진 완료 처리</button>';
        else if (unex > 0) acts += '<button type="button" class="btn btn-primary" onclick="HEXD.complete()">추가검진 반영</button>';
        else if (S().hcFollowup(r)) acts += '<button type="button" class="btn btn-primary" onclick="HEXD.complete()">사후관리 완료</button>';
        else acts += '<span class="sh-st success" style="align-self:center;">완료 처리됨</span>';
        acts += '<button type="button" class="btn btn-outline" onclick="HEXD.evidence()">증빙 등록</button>';
        if (!done || unex > 0) acts += '<button type="button" class="btn btn-outline" onclick="HEXD.resetDue()">기한 재설정</button>';
        if (!done || unex > 0) acts += '<button type="button" class="btn btn-outline" onclick="HEXD.reason()">미검진 사유 입력</button>';
        acts += '<button type="button" class="btn btn-outline" onclick="HEXD.notify()">알림 발송</button>';
        var actions = '<div class="sh-actions" style="margin-bottom:14px;">' + acts + '</div>';

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
                    (r.carcinogen ? ' <span style="color:var(--status-warning-fg)">(발암성·특별관리물질)</span>' : '') + '</dd>' +
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
        var followup;
        if (v === 'detail') {
            followup =
                '<div class="sh-card"><div class="sh-card-h">사후관리 계획 · 실적 <span>' + fuFlag + '</span></div>' +
                (r.followupNeeded
                    ? '<dl class="sh-kv">' +
                        '<dt>사후관리 계획</dt><dd>' + (r.followupPlan ? '<div class="sh-reasonbox">' + esc(r.followupPlan) + '</div>' : '<span style="color:var(--text-gray)">미입력</span>') + '</dd>' +
                        '<dt>사후관리 실적</dt><dd>' + (r.followupResult ? '<div class="sh-reasonbox">' + esc(r.followupResult) + '</div>' : '<span style="color:var(--text-gray)">진행 중</span>') + '</dd>' +
                        fuDueHtml +
                      '</dl>' +
                      (fuDue ? '<div style="margin-top:10px;font-size:12px;color:var(--text-gray);">※ 유소견자 조치결과 30일 이내 제출</div>' : '')
                    : '<div style="font-size:13px;color:var(--text-gray);">유소견·업무제한 등 사후관리 대상이 없습니다.</div>') +
                '</div>';
        } else {
            followup =
                '<div class="sh-card"><div class="sh-card-h">사후관리 <span>' + fuFlag + '</span></div>' +
                '<div style="font-size:13px;color:var(--text-gray);">단순 첨부형은 사후관리 <b>이행 여부</b>만 관리합니다. 개인별 계획·실적은 <b>상세 관리형</b>에서 다룹니다.</div>' +
                (fuDue ? '<dl class="sh-kv" style="margin-top:10px;">' + fuDueHtml + '</dl><div style="margin-top:6px;font-size:12px;color:var(--text-gray);">※ 유소견자 조치결과 30일 이내 제출</div>' : '') +
                '</div>';
        }

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

        /* 개인별 수검 현황 — 상세 관리형에서만(단순 첨부형은 개인정보 미관리) */
        var personCard = (v === 'detail') ? renderPersons(r) : '';

        /* 이력 */
        var histCard =
            '<div class="sh-card"><div class="sh-card-h">처리 · 변경 이력</div>' +
            '<ul class="sh-hist">' + (r.history || []).map(function (h) {
                return '<li><span class="sh-hist-at">' + esc(h.at) + '</span>' +
                    '<div class="sh-hist-ev">' + esc(h.event) + '</div>' +
                    '<span class="sh-hist-actor">' + esc(h.actor) + '</span></li>';
            }).join('') + '</ul></div>';

        state.mount.innerHTML = vbar() + actions + linknote +
            '<div class="sh-detail">' + overview + status + evidence + followup + reasonCard + personCard + histCard + '</div>';
    }

    /* ══════════════ 절차 진행형(4단계 마법사) ══════════════ */
    function deptMembers(dept) {
        var g = (V().orgFlat() || []).filter(function (d) { return d.dept === dept; })[0];
        return g ? g.members.map(function (m) { return { role: m[0], name: m[1] }; }) : [];
    }
    function stepCard(num, title, doneStep, locked, sub, body) {
        var cls = locked ? ' locked' : (doneStep ? ' done-step' : '');
        var flag = doneStep ? '<span class="sh-res ok">완료</span>' : (locked ? '<span class="sh-res none">이전 단계 필요</span>' : '<span class="sh-res warn">진행</span>');
        return '<div class="sh-card' + cls + '"><div class="sh-card-h"><span><span class="sh-stepnum">' + (doneStep ? '✓' : num) + '</span>' + esc(title) + (sub ? ' <span class="sub">' + esc(sub) + '</span>' : '') + '</span>' + flag + '</div>' + body + '</div>';
    }

    function renderProc(r) {
        if (S().procRole() === 'dept') { renderProcDept(r); return; }
        var p = r.proc || { targets: [], qSent: false, notified: false };
        var step = S().procStep(r);          // 0~4 (완료된 단계 수)
        var STEPS = S().PROC_STEPS;

        /* 스텝퍼 헤더 */
        var stepper = '<div class="sh-steps">' + STEPS.map(function (lbl, i) {
            var cls = i < step ? 'done' : (i === step ? 'cur' : '');
            return '<div class="st ' + cls + '"><div class="n">' + (i < step ? '✓' : (i + 1)) + '</div><div class="lbl">' + esc(lbl) + '</div></div>';
        }).join('') + '</div>';

        var linknote =
            '<div class="sh-linkbar">' + S().icon('check', 18) +
            '<div><b>' + esc(r.dept) + ' · ' + esc(r.type) + '</b> — 4단계 절차로 검진을 진행합니다. 결과 문서 업로드·알림 발송이 끝나면 ' +
            '<b>안전보건관리책임자 평가</b>의 「종사자의 건강진단 등 건강관리」 항목에 <b>완료 지표로 자동 연계</b>됩니다. ' +
            '<a href="evl-eval.html">인력 평가에서 확인 →</a></div></div>';

        /* STEP 1 — 대상자 선정(부서 구성원 체크리스트) */
        var members = deptMembers(r.dept);
        var selNames = (p.targets || []).map(function (t) { return t.name; });
        var checklist = members.length
            ? '<div class="sh-checklist" id="proc-checklist">' + members.map(function (m) {
                var checked = selNames.indexOf(m.name) >= 0;
                return '<label class="sh-checkitem"><input type="checkbox" data-name="' + esc(m.name) + '" data-role="' + esc(m.role) + '"' + (checked ? ' checked' : '') + '> ' +
                    '<span>' + esc(m.name) + '</span><span class="role">' + esc(m.role) + '</span></label>';
            }).join('') + '</div>'
            : '<div class="sh-req">해당 부서의 조직도 구성원이 없습니다. 조직도(공통)를 확인하세요.</div>';
        var step1 = stepCard(1, '대상자 선정', step >= 1, false, r.dept + ' 구성원',
            '<div style="font-size:12.5px;color:var(--text-gray);margin-bottom:8px;">부서 <b>' + esc(r.dept) + '</b> 구성원 중 이번 검진 대상자를 선택하세요.</div>' +
            checklist +
            '<div class="sh-actions" style="margin-top:12px;">' +
                '<button type="button" class="btn btn-outline btn-sm" onclick="HEXD.procCheckAll(true)">전체 선택</button>' +
                '<button type="button" class="btn btn-outline btn-sm" onclick="HEXD.procCheckAll(false)">전체 해제</button>' +
                '<button type="button" class="btn btn-primary" onclick="HEXD.saveProcTargets()">대상자 확정' + (selNames.length ? ' (현재 ' + selNames.length + '명)' : '') + '</button>' +
            '</div>');

        /* STEP 2 — 문진표 발송 */
        var step2Body = p.qSent
            ? '<div class="sh-reasonbox">문진표 발송 완료 · <b>' + esc(p.qSentAt) + '</b> · 대상자 ' + (p.targets || []).length + '명 (새올 포틀릿)</div>'
            : '<div style="font-size:12.5px;color:var(--text-gray);margin-bottom:10px;">선정된 대상자 <b>' + (p.targets || []).length + '명</b>에게 <b>문진표(사전 설문)</b>를 새올 포틀릿으로 발송합니다.</div>' +
              '<button type="button" class="btn btn-primary" onclick="HEXD.sendQuestionnaire()">문진표 발송</button>';
        var step2 = stepCard(2, '문진표 발송', step >= 2, step < 1, '대상자 ' + (p.targets || []).length + '명', step2Body);

        /* STEP 3 — 결과 문서 업로드(담당부서 제출 · 필요 시 주관부서 대행) */
        var step3Body = r.resultBy
            ? '<div class="sh-reasonbox">결과 문서 제출 완료 · <b>' + esc(r.resultAt || '') + '</b> · ' + esc(r.resultBy) + '</div>' +
              '<div class="sh-photos" style="margin-top:8px;"><div class="sh-photo has">' + S().icon('file', 26) + '<span>검진결과.pdf</span></div></div>'
            : '<div style="font-size:12.5px;color:var(--text-gray);margin-bottom:10px;">결과 문서는 <b>담당부서(' + esc(r.dept) + ')</b>가 제출합니다. 아직 미제출 상태이며, 필요 시 재난안전과가 <b>대행 업로드</b>할 수 있습니다.</div>' +
              '<button type="button" class="btn btn-primary" onclick="HEXD.uploadResult()">대행 업로드</button>' + V().fileHint();
        var step3 = stepCard(3, '결과 문서 업로드', step >= 3, step < 2, '담당부서 제출', step3Body);

        /* STEP 4 — 대상자/부서 알림 발송(새올 포틀릿) */
        var step4Body = p.notified
            ? '<div class="sh-reasonbox">결과 알림 발송 완료 · <b>' + esc(p.notifiedAt) + '</b> · ' + esc(r.dept) + ' 대상자·대상부서 (새올 포틀릿)</div>'
            : '<div style="font-size:12.5px;color:var(--text-gray);margin-bottom:10px;">검진 결과·사후 안내를 <b>대상자와 대상부서(' + esc(r.dept) + ')</b>에 새올 포틀릿으로 발송합니다.</div>' +
              '<button type="button" class="btn btn-primary" onclick="HEXD.procNotify()">새올 포틀릿 알림 발송</button>';
        var step4 = stepCard(4, '대상자 · 대상부서 알림 발송', step >= 4, step < 3, '새올 포틀릿', step4Body);

        var histCard =
            '<div class="sh-card"><div class="sh-card-h">처리 · 변경 이력</div>' +
            '<ul class="sh-hist">' + (r.history || []).map(function (h) {
                return '<li><span class="sh-hist-at">' + esc(h.at) + '</span>' +
                    '<div class="sh-hist-ev">' + esc(h.event) + '</div>' +
                    '<span class="sh-hist-actor">' + esc(h.actor) + '</span></li>';
            }).join('') + '</ul></div>';

        state.mount.innerHTML = vbar() + linknote + stepper +
            '<div class="sh-detail">' + step1 + step2 + step3 + step4 + histCard + '</div>';
    }

    /* STEP 1 핸들러 */
    function procCheckAll(on) {
        var box = document.getElementById('proc-checklist'); if (!box) return;
        Array.prototype.forEach.call(box.querySelectorAll('input[type=checkbox]'), function (c) { c.checked = !!on; });
    }
    function saveProcTargets() {
        var box = document.getElementById('proc-checklist'); if (!box) return;
        var arr = Array.prototype.map.call(box.querySelectorAll('input[type=checkbox]:checked'), function (c) {
            return { name: c.getAttribute('data-name'), role: c.getAttribute('data-role') };
        });
        if (!arr.length) { toast('대상자를 1명 이상 선택하세요.'); return; }
        S().setProcTargets(state.id, arr); render(); toast('대상자 ' + arr.length + '명을 확정했습니다.');
    }
    /* STEP 2 핸들러 */
    function sendQuestionnaire() {
        S().sendQuestionnaire(state.id); render(); toast('문진표를 새올 포틀릿으로 발송했습니다 (프로토타입).');
    }
    /* STEP 3 핸들러 — 결과 문서 업로드 */
    function uploadResult() {
        V().openModal('검진 결과 문서 업로드',
            '<p style="font-size:13px;margin-bottom:10px;color:var(--text-gray);">검진기관에서 받은 결과 문서(통보서·집계표)를 첨부합니다.</p>' +
            V().uploadDrop('파일을 끌어다 놓거나 클릭하여 업로드<br><span style="font-size:12px;">업로드 시 이력이 자동 기록됩니다</span>', null, { hint: true }),
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="HEXD.saveProcResult()">업로드</button>');
    }
    function saveProcResult() { S().submitResult(state.id, '주관부서(재난안전과) 대행', '박안전'); V().closeModal(); render(); toast('결과 문서를 대행 업로드했습니다.'); }
    /* STEP 4 핸들러 — 새올 포틀릿 알림 */
    function procNotify() {
        var r = S().healthOf(state.id); var p = r.proc || { targets: [] };
        V().openModal('결과 알림 발송',
            '<div style="margin-bottom:10px;font-size:13px;">수신: <b>' + esc(r.dept) + ' 대상자 ' + (p.targets || []).length + '명 + 대상부서</b></div>' +
            '<div style="margin-bottom:12px;"><label class="form-label" for="hd-pn-msg">알림 내용</label>' +
                '<textarea class="form-textarea" id="hd-pn-msg" rows="2">[건강검진] ' + esc(r.type) + ' 결과 안내 및 사후 조치 협조 요청</textarea></div>' +
            '<div class="sh-req" style="font-size:12px;line-height:1.5;">본 알림은 대상자·대상부서의 <b>새올행정시스템 포틀릿(알림)</b>으로 발송됩니다. <span style="color:var(--text-gray)">(프로토타입)</span></div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="HEXD.sendProcNotify()">발송</button>');
    }
    function sendProcNotify() {
        var r = S().healthOf(state.id);
        S().procNotify(state.id, r.dept + ' 대상자·대상부서');
        V().closeModal(); render(); toast('새올 포틀릿으로 결과 알림을 발송했습니다 (프로토타입).');
    }

    /* ══════════════ 담당부서 관점 — 결과 제출 전용 화면 ══════════════ */
    function renderProcDept(r) {
        var p = r.proc || { targets: [], qSent: false, notified: false };
        var tCount = (p.targets || []).length;
        var requested = !!p.qSent;      // 재난안전과가 결과 제출을 요청(문진표 발송)했는가
        var submitted = !!r.resultBy;   // 결과 문서가 제출되었는가(proc 전용 마커)

        var ctx = '<div class="sh-persp"><div class="sh-persp-tabs">' +
            '<span class="sh-ptab is-active" style="cursor:default;">담당부서 관점 · ' + esc(r.dept) + '</span></div>' +
            '<span class="sh-persp-note">재난안전과가 요청한 검진의 <b>결과 문서를 제출</b>합니다.</span></div>';
        var linknote = '<div class="sh-linkbar">' + S().icon('check', 18) +
            '<div>결과 문서를 제출하면 <b>재난안전과</b>에 자동 통보되고, 완료 지표가 <b>안전보건관리책임자 평가</b>의 「종사자의 건강진단 등 건강관리」 항목에 반영됩니다.</div></div>';

        var overview = '<div class="sh-card"><div class="sh-card-h">검진 개요 <span>' + typeTag(r.type) + '</span></div>' +
            '<dl class="sh-kv">' +
                '<dt>대상 부서</dt><dd><b>' + esc(r.dept) + '</b></dd>' +
                '<dt>위탁 검진기관</dt><dd>' + esc(r.agency) + '</dd>' +
                '<dt>검진 예정일</dt><dd>' + esc(r.planned || '-') + '</dd>' +
                '<dt>대상자</dt><dd>' + (tCount ? '<b>' + tCount + '</b> 명' : '재난안전과 선정 대기') + '</dd>' +
                '<dt>재난안전과 요청일</dt><dd>' + esc((p.qSentAt) || '-') + '</dd>' +
            '</dl></div>';

        /* 결과 제출 카드(핵심 액션) — 제출완료 / 제출필요(요청됨) / 요청 전(잠금) 3-상태 */
        var stepFlag = submitted ? '<span class="sh-res ok">제출 완료</span>'
            : (requested ? '<span class="sh-res warn">제출 필요</span>' : '<span class="sh-res none">요청 전</span>');
        var submitBody = submitted
            ? '<div class="sh-reasonbox">제출 완료 · <b>' + esc(r.resultAt || '') + '</b> · ' + esc(r.resultBy) + '</div>' +
              '<div class="sh-photos" style="margin-top:8px;"><div class="sh-photo has">' + S().icon('file', 26) + '<span>검진결과.pdf</span></div></div>' +
              '<div class="sh-actions" style="margin-top:10px;"><button type="button" class="btn btn-outline" onclick="HEXD.uploadResultDept()">파일 다시 올리기</button></div>'
            : requested
                ? '<div style="font-size:12.5px;color:var(--text-gray);margin-bottom:10px;">검진기관에서 받은 <b>결과 문서</b>를 첨부파일로 업로드하면 제출이 완료됩니다.</div>' +
                  '<button type="button" class="btn btn-primary" onclick="HEXD.uploadResultDept()">결과 문서 업로드</button>' + V().fileHint()
                : '<div class="sh-req">아직 재난안전과가 결과 제출을 요청하지 않았습니다. 대상자 선정·문진표 발송이 끝나면 제출할 수 있습니다.</div>';
        var submitCard = '<div class="sh-card' + (submitted ? ' done-step' : (requested ? '' : ' locked')) + '"><div class="sh-card-h"><span><span class="sh-stepnum">' + (submitted ? '✓' : (requested ? '!' : '·')) + '</span>검진 결과 문서 제출</span>' + stepFlag + '</div>' + submitBody + '</div>';

        /* 주관부서 진행 상태(읽기전용) */
        var adminState = '<div class="sh-card"><div class="sh-card-h">재난안전과 진행 상태 <span class="sub">주관부서 처리</span></div>' +
            '<dl class="sh-kv">' +
                '<dt>대상자 선정</dt><dd>' + (tCount ? '<span class="sh-res ok">완료</span> ' + tCount + '명' : '<span class="sh-res none">대기</span>') + '</dd>' +
                '<dt>문진표 발송</dt><dd>' + (p.qSent ? '<span class="sh-res ok">완료</span> ' + esc(p.qSentAt || '') : '<span class="sh-res none">대기</span>') + '</dd>' +
                '<dt>결과 알림 발송</dt><dd>' + (p.notified ? '<span class="sh-res ok">완료</span> ' + esc(p.notifiedAt || '') : '<span class="sh-res none">결과 제출 후 진행</span>') + '</dd>' +
            '</dl></div>';

        var histCard = '<div class="sh-card"><div class="sh-card-h">처리 · 변경 이력</div>' +
            '<ul class="sh-hist">' + (r.history || []).map(function (h) {
                return '<li><span class="sh-hist-at">' + esc(h.at) + '</span><div class="sh-hist-ev">' + esc(h.event) + '</div><span class="sh-hist-actor">' + esc(h.actor) + '</span></li>';
            }).join('') + '</ul></div>';

        /* 담당부서 관점 상세도 관리버전 탭(vbar) 미노출 — 결과 제출에 집중 */
        state.mount.innerHTML = ctx + linknote +
            '<div class="sh-detail">' + overview + submitCard + adminState + histCard + '</div>';
    }
    function uploadResultDept() {
        var r = S().healthOf(state.id);
        V().openModal('검진 결과 문서 제출',
            '<p style="font-size:13px;margin-bottom:10px;color:var(--text-gray);"><b>' + esc(r.dept) + ' · ' + esc(r.type) + '</b> 검진기관 결과 문서를 제출합니다. 제출 시 <b>재난안전과</b>에 자동 통보됩니다.</p>' +
            V().uploadDrop('파일을 끌어다 놓거나 클릭하여 업로드<br><span style="font-size:12px;">업로드 시 이력이 자동 기록됩니다</span>', null, { hint: true }),
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="HEXD.saveResultDept()">제출</button>');
    }
    function saveResultDept() {
        var r = S().healthOf(state.id);
        S().submitResult(state.id, '담당부서', r ? r.dept : '담당부서');
        V().closeModal(); render(); toast('결과 문서를 제출했습니다. 재난안전과에 통보됩니다.');
    }

    function renderPersons(r) {
        var open = S().privacyOn();
        var badge = open
            ? '<span class="sh-priv-badge open">' + S().icon('unlock', 13) + ' 열람 권한 ON · 보건담당</span>'
            : '<span class="sh-priv-badge locked">' + S().icon('lock', 13) + ' 열람 제한</span>';
        var toggle = '<button type="button" class="btn btn-sm btn-outline" onclick="HEXD.togglePriv()">' + (open ? '열람 종료(마스킹)' : '권한 전환(열람)') + '</button>';
        var head = '<div class="sh-card-h">개인별 수검 현황 <span style="display:flex;gap:8px;align-items:center;">' + badge + toggle + '</span></div>';

        if (!open) {
            return '<div class="sh-card">' + head +
                '<div class="sh-priv-mask"><span class="lock-ic">' + S().icon('lock', 30) + '</span>' +
                '개인정보 보호를 위해 개인별 수검 결과는 <b>보건담당 권한</b> 사용자만 열람할 수 있습니다.<br>' +
                '목록·집계(인원수·수검률)만 열람 가능합니다. 열람이 필요하면 <b>[권한 전환]</b> 하세요. ' +
                '<span style="display:block;margin-top:6px;font-size:11px;color:var(--text-gray);">※ 프로토타입 권한 시연 — 실제로는 역할(보건담당) 기반 접근제어가 적용됩니다.</span></div></div>';
        }

        if (!r.persons || !r.persons.length) {
            return '<div class="sh-card">' + head +
                '<div style="font-size:13px;color:var(--text-gray);padding:6px 0;">이 건은 개인별 상세 데이터가 없어 집계(인원수·수검률)만 관리됩니다.</div></div>';
        }

        var rows = r.persons.map(function (p) {
            var resTone = /유소견/.test(p.result) ? 'style="color:var(--status-danger-fg);font-weight:700;"'
                : (/경계/.test(p.result) ? 'style="color:var(--status-warning-fg);font-weight:700;"'
                : (/미검진/.test(p.result) ? 'style="color:var(--text-gray);"' : ''));
            return '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.position) + '</td><td>' + esc(p.team || '-') + '</td>' +
                '<td>' + (p.examined ? esc(p.examined) : '<span style="color:var(--text-gray)">미수검</span>') + '</td>' +
                '<td ' + resTone + '>' + esc(p.result) + '</td></tr>';
        }).join('');
        return '<div class="sh-card">' + head +
            '<div style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--status-danger-fg);margin-bottom:8px;">' + S().icon('alert', 14) + ' 개인정보 열람 중 — 열람 사실이 기록됩니다. 목적 외 사용·유출 금지.</div>' +
            '<div class="sh-wrap"><table class="sh-ptable"><thead><tr><th>성명</th><th>직위</th><th>소속</th><th>수검일</th><th>결과</th></tr></thead>' +
            '<tbody>' + rows + '</tbody></table></div></div>';
    }

    function togglePriv() {
        var on = S().togglePrivacy();
        render();
        toast(on ? '개인정보 열람 권한으로 전환했습니다 (열람 기록됨).' : '열람을 종료하고 마스킹했습니다.');
    }

    /* ── 증빙 등록 ── */
    function evidence() {
        V().openModal('실시 증빙 등록',
            '<p style="font-size:13px;margin-bottom:10px;color:var(--text-gray);">검진기관 실시확인서·집계 결과 통보서를 첨부합니다. (개인별 결과는 권한 열람)</p>' +
            V().uploadDrop('파일을 끌어다 놓거나 클릭하여 업로드<br><span style="font-size:12px;">업로드 시 이력이 자동 기록됩니다</span>', null, { hint: true }),
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="HEXD.saveEvidence()">등록</button>');
    }
    function saveEvidence() { S().attachEvidence('hc', state.id, '실시 증빙'); V().closeModal(); render(); toast('증빙이 등록되었습니다.'); }

    /* ── 미검진 사유 ── */
    function reason() {
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
        var v = (document.getElementById('hd-reason').value || '').trim();
        if (!v) { toast('사유를 입력하세요.'); return; }
        S().setReason('hc', state.id, v, document.getElementById('hd-extra').value);
        V().closeModal(); render(); toast('미검진 사유가 저장되었습니다.');
    }

    /* ── 기한 재설정 ── */
    function resetDue() {
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
        var v = document.getElementById('hd-due').value;
        if (!v) { toast('날짜를 선택하세요.'); return; }
        S().resetDue('hc', state.id, field, v);
        V().closeModal(); render(); toast('기한이 재설정되었습니다.');
    }

    /* ── 알림 발송 ── */
    function notify() {
        var r = S().healthOf(state.id);
        V().openModal('알림 발송',
            '<div style="margin-bottom:12px;"><label class="form-label" for="hd-nt-to">수신자 <span style="font-weight:400;color:var(--text-lightgray)">(조직도에서 선택)</span></label>' +
                '<div class="orgpick-field" id="hd-nt-tofield"><div style="display:flex;gap:8px;">' +
                    '<input type="text" class="form-input" id="hd-nt-to" style="flex:1;" value="' + esc(r.owner) + '">' +
                    '<button type="button" class="btn btn-outline" onclick="ORGPICK.toggle(\'hd-nt-tofield\',\'member\',\'HEXD.pickRecipient\')">조직도</button>' +
                '</div></div></div>' +
            '<div style="margin-bottom:12px;"><label class="form-label" for="hd-nt-msg">알림 내용</label>' +
                '<textarea class="form-textarea" id="hd-nt-msg" rows="2">[건강검진] ' + esc(r.dept) + ' ' + esc(r.type) + ' 미검진자 수검/사후관리 요청</textarea></div>' +
            '<div class="sh-req" style="font-size:12px;line-height:1.5;">본 알림은 수신자의 <b>새올행정시스템 포틀릿(알림)</b>으로 발송됩니다. <span style="color:var(--text-gray)">(프로토타입 — 실제 연계 시 새올 포틀릿으로 전송)</span></div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="HEXD.sendNotify()">발송</button>');
    }
    function pickRecipient(val) { var inp = document.getElementById('hd-nt-to'); if (inp) inp.value = val; }
    function sendNotify() {
        var to = (document.getElementById('hd-nt-to').value || '').trim();
        S().notify('hc', state.id, to);
        V().closeModal(); render(); toast('새올 포틀릿으로 알림을 발송했습니다 (프로토타입).');
    }

    /* ── 완료 처리 ── */
    function complete() {
        var r = S().healthOf(state.id);
        if (!r.done) {
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
        var ex = Number(document.getElementById('hd-c-ex').value);
        var dateEl = document.getElementById('hd-c-date');
        S().completeHealth(state.id, { doneDate: dateEl ? dateEl.value : undefined, examinedCount: isNaN(ex) ? undefined : ex });
        V().closeModal(); render(); toast('검진 실시가 반영되었습니다.');
    }
    function saveFollowup() {
        var v = (document.getElementById('hd-c-fu').value || '').trim();
        S().completeHealth(state.id, { followupResult: v });
        V().closeModal(); render(); toast('사후관리 완료 처리되었습니다.');
    }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        state.id = new URLSearchParams(location.search).get('id');
        render();
    }

    global.HEXD = { init: init, setView: setView, togglePriv: togglePriv, evidence: evidence, saveEvidence: saveEvidence,
        reason: reason, saveReason: saveReason, resetDue: resetDue, saveDue: saveDue,
        notify: notify, pickRecipient: pickRecipient, sendNotify: sendNotify, complete: complete, saveComplete: saveComplete,
        saveFollowup: saveFollowup,
        procCheckAll: procCheckAll, saveProcTargets: saveProcTargets, sendQuestionnaire: sendQuestionnaire,
        uploadResult: uploadResult, saveProcResult: saveProcResult, procNotify: procNotify, sendProcNotify: sendProcNotify,
        uploadResultDept: uploadResultDept, saveResultDept: saveResultDept };
})(window);
