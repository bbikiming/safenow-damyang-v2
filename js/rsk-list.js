/* =====================================================================
   rsk-list.js · 정기 위험성평가 목록·상세 통합 (RSK01-L, 재설계 v1.1 §6.1)
   ---------------------------------------------------------------------
   · 연도 셀렉트 + 전체 완료율 요약 (정기평가는 연 1건 원칙 → 목록·상세 통합)
   · 해당 연도 평가 존재 시:
       - 상단: 요약 카드(대상 부서·개선 N/M·완료율) + 이력 탭
       - 보고서 업로드 → 자동 파싱(목업) → 인라인 검수 모드 → 조치기한 설정 → 부서 전달
       - 부서별 조치 테이블: 재촉 · 부서 상세 (전달완료 부서는 개선조치 목록만 표시)
   · 해당 연도 평가 없음 시:
       - 빈 상태 + [+정기평가 생성] 3-STEP 마법사 (부서 선정 → 점검일자 → 설문지)
   · 단일 모달 규칙 준수 — DYV2.openModal/closeModal 만 사용, 인라인 패널로 검수/부서 관리
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYRSK; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }

    var state = {
        mount: null, year: 2026, tab: 'depts',
        reviewOpen: {}, /* 검수 화면 부서별 접힘 상태 { deptId: true } */
    };
    var W = null; /* 생성 마법사 상태 */

    /* =============== 최상위 렌더 =============== */
    function render() {
        if (!state.mount) return;
        var years = D().assessmentYears();
        if (years.indexOf(state.year) === -1) years.unshift(state.year);
        years.sort(function (a, b) { return b - a; });

        var a = (D().assessments(state.year) || [])[0];

        var head = renderToolbar(years, a);

        if (!a) {
            state.mount.innerHTML = head +
                '<div class="v2-empty rl-empty">' +
                    '<div class="rl-empty-icon">📄</div>' +
                    '<div class="rl-empty-title">' + state.year + '년 정기 위험성평가가 등록되지 않았습니다</div>' +
                    '<div class="rl-empty-steps">' +
                        '<span class="rl-empty-step">① 대상 부서 선정</span>' +
                        '<span class="rl-empty-arrow">→</span>' +
                        '<span class="rl-empty-step">② 점검일자 지정</span>' +
                    '</div>' +
                    '<div class="rl-empty-sub">생성 시 <b>대상 부서에 점검예정일이 통보</b>됩니다. ' +
                        '점검설문지는 생성 후 목록에서 공통 또는 부서별로 첨부합니다.</div>' +
                    '<button type="button" class="btn btn-primary" onclick="RSKLIST.openWizard()">＋ 정기평가 생성</button>' +
                '</div>';
            return;
        }

        D().refreshAssessmentStatus(a.id);
        a = D().assessmentOf(a.id);

        var summary = renderSummary(a);
        var tabs =
            '<div class="rl-tabs">' +
                '<button class="rl-tab ' + (state.tab === 'depts' ? 'on' : '') + '" onclick="RSKLIST.setTab(\'depts\')">부서별 조치</button>' +
                '<button class="rl-tab ' + (state.tab === 'history' ? 'on' : '') + '" onclick="RSKLIST.setTab(\'history\')">이력</button>' +
            '</div>';

        var body = state.tab === 'depts' ? renderDepts(a) : renderHistory(a);
        state.mount.innerHTML = head + summary + tabs + body;
    }

    function renderToolbar(years, a) {
        var right = '';
        if (!a) {
            right = '<button type="button" class="btn btn-primary" onclick="RSKLIST.openWizard()">＋ 정기평가 생성</button>';
        } else if (a.status !== 'COMPLETED') {
            right = '<span style="font-size:12px;color:var(--text-lightgray);">정기평가는 연 1회 등록 원칙</span>';
        } else {
            right = '<span class="chip-mini st-done">' + esc(a.year) + '년 평가 완료 (' + esc(a.completed_at || '') + ')</span>';
        }
        /* 시연 리셋 — 세션 데이터 초기화 후 빈 상태로 복귀 (DYRSK.reset 재활용) */
        var resetBtn = '<button type="button" class="btn btn-outline btn-sm rl-reset-btn" ' +
            'title="시연용 세션 데이터 초기화" onclick="RSKLIST.resetDemo()">↺ 시연 초기화</button>';
        return '<div class="rl-toolbar">' +
                '<div class="rl-tb-left">' +
                    '<label class="rl-tb-label">연도</label>' +
                    '<select class="form-select" onchange="RSKLIST.setYear(+this.value)">' +
                        years.map(function (y) { return '<option value="' + y + '"' + (y === state.year ? ' selected' : '') + '>' + y + '년</option>'; }).join('') +
                    '</select>' +
                '</div>' +
                '<div class="rl-tb-right">' + right + resetBtn + '</div>' +
            '</div>';
    }

    /* 시연 리셋 — 확인 후 sessionStorage 위험성평가 데이터 초기화 */
    function resetDemo() {
        V().openModal('시연 데이터 초기화',
            '<p style="font-size:13px;">위험성평가 세션 데이터를 초기화합니다.<br>' +
            '2026년 생성/업로드/전달·개선조치 진행 내역이 모두 사라지고 <b>초기 시연 상태</b>(2026 미등록 · 2025 완료)로 복귀합니다.</p>' +
            '<p style="font-size:12px;color:var(--text-gray);margin-top:8px;">2025년 참고 데이터는 유지됩니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="RSKLIST.doResetDemo()">초기화</button>');
    }
    function doResetDemo() {
        D().reset();
        V().closeModal();
        state.tab = 'depts';
        state.reviewOpen = {};
        state.year = 2026;
        toast('시연 데이터 초기화 완료 · 2026년 미등록 상태로 복귀');
        render();
    }

    function renderSummary(a) {
        var prog = D().assessmentProgress(a.id);
        var stChip = a.status === 'COMPLETED'
            ? '<span class="chip-mini st-done">완료</span>'
            : '<span class="chip-mini st-doing">진행중</span>';
        var allDepts = a.depts || [];
        var anyDelivered = allDepts.some(function (dp) { return !!dp.deliveredAt; });
        /* 전달 후: 개선건이 있는 부서(actionable)만 요약·완료율에 포함, 0건 부서는 제외 */
        var scoped = anyDelivered
            ? allDepts.filter(function (dp) { return D().deptImpCount(a.id, dp.deptId).total > 0; })
            : allDepts;
        var deptCnt = scoped.length;
        var doneDept = scoped.filter(function (dp) {
            var c = D().deptImpCount(a.id, dp.deptId);
            return c.total > 0 && c.done === c.total;
        }).length;

        return '<div class="rl-summary"><div class="rl-summary-head">' +
                '<div class="rl-summary-title"><span class="type-badge">정기</span>' + esc(a.title) + ' ' + stChip + '</div>' +
                '<div class="rl-summary-meta">' +
                    '<span>대상 부서 <b>' + deptCnt + '개</b> (완료 ' + doneDept + '개)</span>' +
                    surveySummaryCell(a) +
                    '<span>보고서 <b>' + (a.files && a.files.report ? esc(a.files.report) : '미첨부') + '</b></span>' +
                    (a.status === 'COMPLETED' ? '<span>완료일 <b>' + esc(a.completed_at) + '</b></span>' : '') +
                '</div>' +
            '</div>' +
            '<div class="rl-progress">' +
                '<div class="rl-progress-bar"><div class="rl-progress-fill" style="width:' + prog.pct + '%"></div></div>' +
                '<div class="rl-progress-txt">개선 <b>' + prog.done + ' / ' + prog.total + '</b> (' + prog.pct + '%)</div>' +
            '</div></div>';
    }

    /* =============== 점검설문지 첨부 (등록 이후) ===============
     * 생성 마법사에서 설문지 단계를 뺐으므로, 여기가 유일한 첨부 경로다.
     *   · 공통본  — 요약 카드에서 첨부 → 부서별본이 없는 모든 부서에 적용
     *   · 부서별본 — 부서 행에서 첨부 → 그 부서만 공통본 대신 사용
     * 완료된 평가는 첨부를 잠근다(이력 왜곡 방지). */
    function surveySummaryCell(a) {
        var p = D().surveyProgress(a.id);
        var locked = a.status === 'COMPLETED';
        var txt = p.all
            ? '<b>' + esc(p.all) + '</b>'
            : '<b class="rl-survey-none">미첨부</b>';
        var btns = locked ? '' :
            ' <button type="button" class="rl-file-btn" onclick="RSKLIST.openSurveyAll()">' +
                (p.all ? '변경' : '＋ 첨부') + '</button>' +
            (p.all ? ' <button type="button" class="rl-file-btn" onclick="RSKLIST.clearSurveyAll()">삭제</button>' : '');
        return '<span>공통 설문지 ' + txt + btns +
            '<span class="rl-survey-prog">부서 적용 ' + p.done + '/' + p.total + '</span></span>';
    }
    /* 첨부 모달 — 드롭존은 반드시 DYV2.uploadDrop 으로만 렌더 (CLAUDE.md §2) */
    function surveyModal(title, noticeHtml, defName, confirmCall) {
        V().openModal(title,
            noticeHtml +
            V().uploadDrop(
                '<div style="font-weight:700;">클릭하여 점검설문지 선택</div>' +
                '<div style="font-size:12px;color:var(--text-gray);margin-top:4px;">또는 파일을 이 영역에 끌어다 놓으세요 (프로토타입)</div>',
                "RSKLIST.pickSurveyFile()", { hint: true }) +
            '<div class="rl-modal-row" style="margin-top:10px;">' +
                '<label class="form-label" for="rl-survey-name">첨부 파일명</label>' +
                '<input type="text" class="form-input" id="rl-survey-name" value="' + esc(defName) + '">' +
            '</div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="' + confirmCall + '">첨부</button>');
    }
    /* 프로토타입 파일 선택 — 실제 input 대신 파일명 필드에 포커스를 준다 */
    function pickSurveyFile() {
        var el = document.getElementById('rl-survey-name');
        if (el) { el.focus(); el.select(); }
        toast('파일 선택 (프로토타입) · 아래 파일명을 확인하세요');
    }
    function surveyNameInput(fallback) {
        var el = document.getElementById('rl-survey-name');
        return ((el && el.value) || fallback || '').trim();
    }
    function openSurveyAll() {
        var a = current(); if (!a) return;
        surveyModal('공통 점검설문지 첨부',
            '<p style="font-size:13px;">선정된 <b>' + (a.depts || []).length + '개 부서</b>에 일괄 적용됩니다. ' +
            '부서별로 다른 설문지가 필요하면 부서 행에서 개별 첨부하세요.</p>',
            a.year + '_정기평가_공통설문지.hwpx', 'RSKLIST.doSurveyAll()');
    }
    function doSurveyAll() {
        var a = current(); if (!a) return;
        var name = surveyNameInput(a.year + '_정기평가_공통설문지.hwpx');
        if (!name) { toast('파일명을 입력하세요.'); return; }
        D().setSurveyAll(a.id, name);
        V().closeModal();
        toast('공통 점검설문지 첨부 · 부서에 발송 (프로토타입)');
        render();
    }
    function clearSurveyAll() {
        var a = current(); if (!a) return;
        var p = D().surveyProgress(a.id);
        var onlyCommon = (a.depts || []).filter(function (dp) { return !dp.surveyFile; }).length;
        V().openModal('공통 설문지 삭제',
            '<p style="font-size:13px;">공통 점검설문지 <b>' + esc(p.all) + '</b> 를 삭제합니다.<br>' +
            '부서별 설문지가 없는 <b>' + onlyCommon + '개 부서</b>가 <b>설문지 미첨부</b> 상태가 됩니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="RSKLIST.doClearSurveyAll()">삭제</button>');
    }
    function doClearSurveyAll() {
        var a = current(); if (!a) return;
        D().setSurveyAll(a.id, '');
        V().closeModal(); toast('공통 점검설문지 삭제'); render();
    }
    function openDeptSurvey(deptId) {
        var a = current(); if (!a) return;
        var name = D().deptName(deptId);
        var all = (a.files && a.files.surveyAll) || '';
        surveyModal(name + ' — 부서 설문지 첨부',
            '<p style="font-size:13px;">이 부서만 <b>공통본 대신</b> 사용할 설문지를 첨부합니다.' +
            (all ? '<br><span style="color:var(--text-gray);">현재 적용 중인 공통본: ' + esc(all) + '</span>' : '') + '</p>',
            a.year + '_' + name + '_설문지.hwpx', "RSKLIST.doDeptSurvey('" + deptId + "')");
    }
    function doDeptSurvey(deptId) {
        var a = current(); if (!a) return;
        var name = surveyNameInput(a.year + '_' + D().deptName(deptId) + '_설문지.hwpx');
        if (!name) { toast('파일명을 입력하세요.'); return; }
        D().setDeptSurvey(a.id, deptId, name);
        V().closeModal();
        toast(D().deptName(deptId) + ' 부서 설문지 첨부');
        render();
    }
    function clearDeptSurvey(deptId) {
        var a = current(); if (!a) return;
        D().setDeptSurvey(a.id, deptId, '');
        toast(D().deptName(deptId) + ' 부서 설문지 삭제 · 공통본 적용');
        render();
    }
    /* 현재 연도의 평가 (설문지 핸들러 공통 진입점) */
    function current() { return (D().assessments(state.year) || [])[0]; }

    /* ===== 보고서 첨부·교체 (개선 건수 확인 단계) — 재파싱 없이 파일만 갱신 ===== */
    function openReportAttach() {
        var a = current(); if (!a) return;
        var existing = (a.files && a.files.report) || '';
        surveyModal('용역업체 보고서 첨부',
            '<p style="font-size:13px;">개선 건수 확인 단계에서 <b>보고서(최종본·보완본)를 첨부·교체</b>합니다. ' +
            '이미 추출·전달된 <b>개선 건수와 조치 내역은 그대로 유지</b>됩니다.' +
            (existing ? '<br><span style="color:var(--text-gray);">현재 보고서: ' + esc(existing) + '</span>' : '') + '</p>',
            a.year + '_정기평가_보고서_최종.hwpx', 'RSKLIST.doReportAttach()');
    }
    function doReportAttach() {
        var a = current(); if (!a) return;
        var name = surveyNameInput(a.year + '_정기평가_보고서.hwpx');
        if (!name) { toast('파일명을 입력하세요.'); return; }
        D().setReportFile(a.id, name);
        V().closeModal();
        toast('보고서 첨부 완료 · 개선 건수·조치 내역은 유지됩니다');
        render();
    }

    /* =============== 부서별 조치 탭 =============== */
    function renderDepts(a) {
        var review = a.review || { stage: 'NONE' };
        var reportBlock = renderReportBlock(a, review);

        /* 검수 중이면 검수 인라인 패널을 부서 테이블 대신 표시 */
        if (review.stage === 'REVIEW') {
            return reportBlock + renderReviewPanel(a);
        }

        var allDepts = a.depts || [];
        var anyDelivered = allDepts.some(function (dp) { return !!dp.deliveredAt; });
        /* 전달 이후에는 개선건 0건 부서(지적사항 없음)를 목록에서 제외.
           보고서 업로드 전에는 전체 노출 유지. */
        var visible = anyDelivered
            ? allDepts.filter(function (dp) { return D().deptImpCount(a.id, dp.deptId).total > 0; })
            : allDepts;
        var excluded = allDepts.length - visible.length;

        var rows = visible.map(function (dp) { return deptRow(a, dp); }).join('');
        if (!rows) rows = '<tr><td colspan="7" style="text-align:center;color:var(--text-lightgray);padding:24px;">' +
            (allDepts.length ? '조치 대상 부서가 없습니다. 지적사항이 있는 부서가 발견되지 않았습니다.' : '선정된 부서가 없습니다.') + '</td></tr>';

        var excludedNote = excluded > 0
            ? '<div class="rl-dept-excluded">지적사항 없는 부서 <b>' + excluded + '개</b> 제외 · ' +
                allDepts.filter(function (dp) { return dp.deliveredAt && !D().deptImpCount(a.id, dp.deptId).total; })
                    .map(function (dp) { return D().deptName(dp.deptId); }).join(', ') +
              '</div>'
            : '';

        var deptTable =
            '<div class="rl-card"><div class="rl-card-title">부서별 조치</div>' +
                '<div class="rl-table-scroll"><table class="rl-dept-table"><thead><tr>' +
                    '<th>부서</th><th>점검일</th><th>설문지</th><th>개선건수</th><th>조치기한</th><th>상태</th><th>관리</th>' +
                '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
                excludedNote +
            '</div>';

        return reportBlock + deptTable;
    }

    function deptRow(a, dp) {
        var name = D().deptName(dp.deptId);
        var c = D().deptImpCount(a.id, dp.deptId);
        var overdue = D().improvementsFor(a.id, dp.deptId).some(function (m) { return D().isOverdue(m); });
        var deliveredNo = !dp.deliveredAt;
        var stCls = dp.status === 'DONE' ? 'st-done' : 'st-todo';
        var stLbl = dp.status === 'DONE' ? '조치완료' : '조치전';
        var reviewStage = (a.review && a.review.stage) || 'NONE';

        var mngBtn;
        if (a.status === 'COMPLETED') {
            mngBtn = '<button type="button" class="btn btn-outline btn-sm" onclick="RSKLIST.openDept(\'' + dp.deptId + '\')">보기</button>';
        } else if (deliveredNo) {
            mngBtn = reviewStage === 'NONE'
                ? '<span style="font-size:12px;color:var(--text-lightgray);">보고서 대기</span>'
                : '<button type="button" class="btn btn-outline btn-sm" onclick="RSKLIST.openDept(\'' + dp.deptId + '\')">검수 진행</button>';
        } else {
            mngBtn = '<button type="button" class="btn btn-primary btn-sm" onclick="RSKLIST.openDept(\'' + dp.deptId + '\')">관리</button>';
        }
        var remindBtn = (overdue && a.status !== 'COMPLETED')
            ? ' <button type="button" class="btn btn-outline btn-sm" style="border-color:var(--status-warning-border);color:var(--status-warning-fg);" onclick="RSKLIST.remindDept(\'' + dp.deptId + '\')">재촉</button>'
            : '';
        /* 설문지 — 부서별본 > 공통본 순으로 적용. 완료 전에는 행에서 바로 첨부·교체할 수 있다. */
        var locked = a.status === 'COMPLETED';
        var commonFile = (a.files && a.files.surveyAll) || '';
        var surveyCell;
        if (dp.surveyFile) {
            surveyCell = '<span class="rl-tiny-file">' + esc(dp.surveyFile) + '</span>' +
                (locked ? '' : ' <button type="button" class="rl-file-btn" onclick="RSKLIST.openDeptSurvey(\'' + dp.deptId + '\')">교체</button>' +
                    ' <button type="button" class="rl-file-btn" onclick="RSKLIST.clearDeptSurvey(\'' + dp.deptId + '\')">×</button>');
        } else if (commonFile) {
            surveyCell = '<span class="rl-tiny-file">' + esc(commonFile) + '</span>' +
                '<span class="rl-survey-tag">공통</span>' +
                (locked ? '' : ' <button type="button" class="rl-file-btn" onclick="RSKLIST.openDeptSurvey(\'' + dp.deptId + '\')">부서별</button>');
        } else {
            surveyCell = locked
                ? '<span style="color:var(--text-lightgray);">-</span>'
                : '<button type="button" class="rl-file-btn" onclick="RSKLIST.openDeptSurvey(\'' + dp.deptId + '\')">＋ 설문지 첨부</button>';
        }
        var impCell = c.total ? c.done + ' / ' + c.total : '<span style="color:var(--text-lightgray);">-</span>';
        var dueCell = dp.dueDate
            ? '<span class="' + (overdue ? 'rl-overdue' : '') + '">' + esc(dp.dueDate) + '</span>'
            : '<span style="color:var(--text-lightgray);">-</span>';

        return '<tr>' +
            '<td class="rl-dept-name">' + esc(name) + '</td>' +
            '<td>' + esc(dp.inspectDate || '-') + '</td>' +
            '<td>' + surveyCell + '</td>' +
            '<td>' + impCell + '</td>' +
            '<td>' + dueCell + '</td>' +
            '<td><span class="chip-mini ' + stCls + '">' + stLbl + '</span>' +
                (dp.deliveredAt ? '<div style="font-size:11px;color:var(--text-lightgray);margin-top:3px;">전달 ' + esc(dp.deliveredAt) + '</div>' : '') + '</td>' +
            '<td>' + mngBtn + remindBtn + '</td>' +
        '</tr>';
    }

    /* =============== 보고서 업로드 블록 =============== */
    function renderReportBlock(a, review) {
        var stage = review.stage || 'NONE';
        if (a.status === 'COMPLETED') {
            return '<div class="rl-card"><div class="rl-card-title">용역업체 보고서 (HWPX)</div>' +
                '<div class="rl-report-row">' +
                    (a.files && a.files.report
                        ? '<span class="rl-report-file">📄 ' + esc(a.files.report) + '</span>' +
                          '<span style="font-size:12px;color:var(--text-gray);margin-left:auto;">' + esc(a.completed_at || '') + ' 승인 완료</span>'
                        : '<span style="font-size:12px;color:var(--text-lightgray);">보고서 미첨부</span>') +
                '</div></div>';
        }
        var body;
        if (stage === 'NONE') {
            body = '<button type="button" class="rl-file-btn" onclick="RSKLIST.uploadReport()">＋ 보고서 업로드 (hwpx)</button>' +
                '<span style="font-size:12px;color:var(--text-gray);">용역업체가 제출한 위험성평가 보고서(hwpx)를 첨부하면 부서별 유해위험요인·개선조치가 자동 추출됩니다.</span>';
        } else if (stage === 'REVIEW') {
            var pd0 = (review.parsedDepts || {});
            var totalRows = 0;
            Object.keys(pd0).forEach(function (k) { totalRows += (pd0[k] || []).length; });
            body = '<span class="rl-report-file">📄 ' + esc(a.files.report) + '</span>' +
                '<span class="chip-mini st-doing" style="margin-left:6px;">검수 중</span>' +
                '<span style="font-size:12px;color:var(--text-gray);margin-left:auto;">추출 <b>' + totalRows + '</b>건 · 아래에서 내용 검수 후 조치기한을 설정하세요</span>' +
                '<button type="button" class="rl-file-btn" onclick="RSKLIST.clearReport()">보고서 취소</button>';
        } else {
            /* DELIVERED = 개선 건수 확인 단계. 보고서(최종본·보완본)를 첨부·교체할 수 있다(재파싱 없음). */
            body = (a.files && a.files.report
                    ? '<span class="rl-report-file">📄 ' + esc(a.files.report) + '</span>'
                    : '<span style="font-size:12px;color:var(--status-warning-fg);">보고서 미첨부</span>') +
                '<span class="chip-mini st-done" style="margin-left:6px;">전달 완료</span>' +
                '<span style="font-size:12px;color:var(--text-gray);margin-left:auto;">' + esc(review.extractedAt || '') + '에 파싱·검수 완료</span>' +
                '<button type="button" class="rl-file-btn" onclick="RSKLIST.openReportAttach()">' +
                    (a.files && a.files.report ? '보고서 교체' : '＋ 보고서 첨부') + '</button>';
        }
        return '<div class="rl-card"><div class="rl-card-title">용역업체 보고서 (HWPX)</div>' +
            '<div class="rl-report-row">' + body + '</div></div>';
    }

    /* =============== 파싱 검수 인라인 패널 ===============
       검수 단계에서는 유해위험요인·분류·원인·개선조치 내용만 확인·수정·삭제·추가한다.
       조치기한은 이 화면이 아닌 다음 단계 [조치기한 설정] 모달에서 일괄+부서별로 지정한다. */
    function renderReviewPanel(a) {
        var pd = (a.review && a.review.parsedDepts) || {};
        var totalRows = 0;
        var deptIds = (a.depts || []).map(function (dp) { return dp.deptId; });
        var deptBlocks = deptIds.map(function (deptId) {
            var rows = pd[deptId] || [];
            totalRows += rows.length;
            var name = D().deptName(deptId);
            var open = state.reviewOpen[deptId] !== false;
            var head =
                '<div class="rl-rv-dept-head" onclick="RSKLIST.reviewToggleDept(\'' + deptId + '\')">' +
                    '<span class="rl-rv-arrow ' + (open ? 'open' : '') + '">▶</span>' +
                    '<span class="rl-rv-dept-name">' + esc(name) + '</span>' +
                    '<span class="chip-mini ' + (rows.length ? 'st-doing' : 'st-todo') + '" style="margin-left:auto;">' +
                        (rows.length ? rows.length + '건 추출' : '추출 항목 없음') + '</span>' +
                '</div>';
            var body = '';
            if (open) {
                var tbody = rows.map(function (r, i) { return reviewRow(a.id, deptId, i, r); }).join('');
                if (!rows.length) tbody = '<tr><td colspan="5" style="text-align:center;color:var(--text-lightgray);padding:14px;">추출된 항목이 없습니다. 필요 시 [＋행 추가]로 직접 입력하세요.</td></tr>';
                body = '<div class="rl-rv-dept-body">' +
                    '<table class="rl-rv-table"><thead><tr>' +
                        '<th style="width:24%;">유해위험요인</th><th style="width:12%;">분류</th>' +
                        '<th style="width:20%;">원인</th><th>개선조치</th>' +
                        '<th style="width:34px;"></th>' +
                    '</tr></thead><tbody>' + tbody + '</tbody></table>' +
                    '<button type="button" class="btn btn-outline btn-sm" onclick="RSKLIST.reviewAdd(\'' + deptId + '\')">＋ 행 추가</button>' +
                '</div>';
            }
            return '<div class="rl-rv-dept">' + head + body + '</div>';
        }).join('');

        var hasRows = totalRows > 0;
        var footNote = hasRows
            ? '<span style="color:var(--text-gray);">항목을 확인·수정·삭제하고 [＋행 추가]로 누락 항목을 보완한 뒤 <b>[검토완료 · 조치기한 설정]</b>으로 진행하세요.</span>'
            : '<span style="color:var(--status-warning-fg);font-weight:700;">추출된 항목이 없습니다. [＋행 추가]로 최소 1건을 입력해야 검토완료로 진행할 수 있습니다.</span>';

        return '<div class="rl-card rl-rv-card">' +
            '<div class="rl-card-title" style="justify-content:space-between;">' +
                '<span>보고서 파싱 결과 검수 <span class="chip-mini st-doing" style="margin-left:6px;">REVIEW</span></span>' +
                '<span style="font-size:12px;color:var(--text-gray);font-weight:400;">추출 시각 ' + esc(a.review.extractedAt || '') + ' · 총 ' + totalRows + '건</span>' +
            '</div>' +
            '<p style="font-size:12px;color:var(--text-gray);margin-bottom:12px;">' +
                '보고서에서 <b>' + totalRows + '건</b> 항목이 부서별로 추출되었습니다. 유해위험요인·분류·원인·개선조치 <b>내용</b>만 이 화면에서 다듬고, ' +
                '조치기한은 다음 단계 [조치기한 설정] 모달에서 <b>일괄·부서별</b>로 지정합니다.' +
            '</p>' +
            deptBlocks +
            '<div class="rl-rv-foot">' +
                '<div class="rl-rv-foot-note">' + footNote + '</div>' +
                '<div class="rl-rv-foot-actions">' +
                    '<button type="button" class="btn btn-secondary" onclick="RSKLIST.clearReport()">보고서 취소·재업로드</button>' +
                    '<button type="button" class="btn btn-primary"' + (hasRows ? '' : ' disabled style="opacity:.5;cursor:not-allowed;"') +
                        ' onclick="RSKLIST.openDueSet()">검토완료 · 조치기한 설정 →</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    }
    function reviewRow(aid, deptId, i, r) {
        var cats = ['', '기계적', '화학적', '작업특성', '전기', '고소작업', '보건', '기타'];
        return '<tr>' +
            '<td><input type="text" value="' + esc(r.name) + '" placeholder="유해위험요인" onchange="RSKLIST.reviewSet(\'' + deptId + '\',' + i + ',\'name\',this.value)"></td>' +
            '<td><select onchange="RSKLIST.reviewSet(\'' + deptId + '\',' + i + ',\'category\',this.value)">' +
                cats.map(function (c) { return '<option value="' + c + '"' + (r.category === c ? ' selected' : '') + '>' + (c || '분류') + '</option>'; }).join('') +
            '</select></td>' +
            '<td><input type="text" value="' + esc(r.cause) + '" placeholder="원인" onchange="RSKLIST.reviewSet(\'' + deptId + '\',' + i + ',\'cause\',this.value)"></td>' +
            '<td><textarea rows="2" placeholder="개선조치" onchange="RSKLIST.reviewSet(\'' + deptId + '\',' + i + ',\'action\',this.value)">' + esc(r.action) + '</textarea></td>' +
            '<td style="text-align:center;"><button type="button" class="rl-rv-del" onclick="RSKLIST.reviewDel(\'' + deptId + '\',' + i + ')" title="삭제">×</button></td>' +
        '</tr>';
    }

    /* =============== 이력 탭 =============== */
    function renderHistory(a) {
        var items = [].concat(a.history || []);
        D().improvementsFor(a.id).forEach(function (m) {
            (m.history || []).forEach(function (h) {
                if (h.type === 'NOTIFY') return;
                items.push({
                    type: h.type, at: h.at, by: h.by,
                    memo: D().deptName(m.dept_id) + ' · ' + (m.hazard && m.hazard.name ? m.hazard.name + ' — ' : '') + h.memo
                });
            });
        });
        items.sort(function (x, y) { return (x.at || '').localeCompare(y.at || ''); });
        if (!items.length) return '<div class="rl-card"><div class="v2-empty">이력이 없습니다.</div></div>';

        var LABELS = { CREATE:'생성', NOTIFY:'알림', DELIVER:'전달', REMIND:'재촉', REASON:'사유', DUE_CHANGE:'기한변경', STATUS:'상태변경', COMPLETE:'완료', REVIEW:'검토', REGISTER:'등록', FILE:'첨부' };
        var rows = items.map(function (h) {
            return '<div class="rl-hist-row">' +
                '<span class="rl-hist-at">' + esc(h.at || '') + '</span>' +
                '<span class="rl-hist-type ' + (h.type || '') + '">' + esc(LABELS[h.type] || h.type || '기타') + '</span>' +
                '<span class="rl-hist-body">' + esc(h.memo || '') +
                    (h.by ? '<span class="rl-hist-by">— ' + esc(h.by) + '</span>' : '') +
                '</span>' +
            '</div>';
        }).join('');
        return '<div class="rl-card"><div class="rl-card-title">이력 타임라인</div><div class="rl-history">' + rows + '</div></div>';
    }

    function setTab(t) { state.tab = t; render(); }
    function setYear(y) { state.year = y; state.tab = 'depts'; state.reviewOpen = {}; render(); }

    /* =============== 보고서 업로드·취소·검수 상호작용 =============== */
    function uploadReport() {
        var a = (D().assessments(state.year) || [])[0]; if (!a) return;
        var r = D().uploadReport(a.id);
        if (!r) return;
        state.reviewOpen = {};
        toast('보고서에서 ' + r.deptCount + '개 부서 ' + r.totalCount + '건 항목을 추출했습니다. 항목을 검수하세요.');
        render();
    }
    function clearReport() {
        var a = (D().assessments(state.year) || [])[0]; if (!a) return;
        V().openModal('보고서 취소',
            '<p style="font-size:13px;">보고서 첨부와 검수 결과를 모두 초기화합니다. 계속하시겠습니까?</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="RSKLIST.doClearReport(\'' + a.id + '\')">초기화</button>');
    }
    function doClearReport(aid) {
        D().clearReport(aid);
        V().closeModal();
        state.reviewOpen = {};
        toast('보고서·검수 결과 초기화');
        render();
    }
    function reviewToggleDept(deptId) {
        state.reviewOpen[deptId] = state.reviewOpen[deptId] === false;
        render();
    }
    function reviewSet(deptId, i, k, v) {
        var a = (D().assessments(state.year) || [])[0]; if (!a) return;
        D().reviewSet(a.id, deptId, i, k, v);
    }
    function reviewDel(deptId, i) {
        var a = (D().assessments(state.year) || [])[0]; if (!a) return;
        D().reviewDel(a.id, deptId, i);
        render();
    }
    function reviewAdd(deptId) {
        var a = (D().assessments(state.year) || [])[0]; if (!a) return;
        D().reviewAdd(a.id, deptId);
        state.reviewOpen[deptId] = true;
        render();
    }

    /* =============== 조치기한 설정 모달 (단일 모달 · 인라인 부서별 조정)
       검수 화면에서 유효 내용(요인명·조치)이 채워진 행이 있는 부서만 대상. */
    var DUE = null;
    function openDueSet() {
        var a = (D().assessments(state.year) || [])[0]; if (!a) return;
        var pd = (a.review && a.review.parsedDepts) || {};
        var deptDues = {};
        (a.depts || []).forEach(function (dp) {
            var validRows = (pd[dp.deptId] || []).filter(function (r) {
                return !r.deleted && (r.name || '').trim() && (r.action || '').trim();
            });
            if (validRows.length) deptDues[dp.deptId] = '';
        });
        if (!Object.keys(deptDues).length) {
            toast('유효한 항목이 있는 부서가 없습니다. 요인명·개선조치를 채워주세요.');
            return;
        }
        DUE = { aid: a.id, bulkDue: '', deptDues: deptDues };
        renderDueModal();
    }
    function renderDueModal() {
        var a = D().assessmentOf(DUE.aid);
        var pd = (a.review && a.review.parsedDepts) || {};
        var rows = Object.keys(DUE.deptDues).map(function (deptId) {
            var name = D().deptName(deptId);
            var validCnt = (pd[deptId] || []).filter(function (r) {
                return !r.deleted && (r.name || '').trim() && (r.action || '').trim();
            }).length;
            return '<tr><td>' + esc(name) + '</td><td>' + validCnt + '건</td>' +
                '<td><input type="date" class="form-input" value="' + esc(DUE.deptDues[deptId] || '') +
                    '" onchange="RSKLIST.dueSetDept(\'' + deptId + '\', this.value)"></td></tr>';
        }).join('');
        var body =
            '<div class="rl-modal-row">' +
                '<label class="form-label">일괄 조치기한 (전 부서에 적용)</label>' +
                '<div class="rl-bulk">' +
                    '<input type="date" class="form-input" id="rl-due-bulk" value="' + esc(DUE.bulkDue) + '" style="max-width:200px;">' +
                    '<button type="button" class="btn btn-outline btn-sm" onclick="RSKLIST.dueApplyBulk()">일괄 적용</button>' +
                    '<span style="font-size:12px;color:var(--text-gray);">부서별 조정은 아래 표에서 수정하세요.</span>' +
                '</div>' +
            '</div>' +
            '<div class="rl-modal-row">' +
                '<label class="form-label">부서별 조치기한</label>' +
                '<table class="rl-dates-table"><thead><tr><th>부서</th><th>추출 건수</th><th>조치기한</th></tr></thead>' +
                    '<tbody>' + rows + '</tbody></table>' +
                '<p style="font-size:12px;color:var(--text-gray);margin-top:8px;">검토완료 시 부서별로 개선조치가 자동 전달되고 알림이 발송됩니다. 이후 부서 담당자는 <b>내 할일</b>에서 응답합니다.</p>' +
            '</div>';
        V().openModal('조치기한 설정 · 부서 전달', body,
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="RSKLIST.dueDeliver()">전달 실행</button>');
    }
    function dueApplyBulk() {
        var v = document.getElementById('rl-due-bulk').value;
        if (!v) { toast('일괄 적용할 일자를 선택하세요.'); return; }
        DUE.bulkDue = v;
        Object.keys(DUE.deptDues).forEach(function (k) { DUE.deptDues[k] = v; });
        renderDueModal();
    }
    function dueSetDept(deptId, v) { DUE.deptDues[deptId] = v; }
    function dueDeliver() {
        var bulk = document.getElementById('rl-due-bulk');
        if (bulk) DUE.bulkDue = bulk.value || DUE.bulkDue;
        var missing = Object.keys(DUE.deptDues).filter(function (k) { return !DUE.deptDues[k] && !DUE.bulkDue; });
        if (missing.length) { toast('일괄 기한 또는 부서별 기한을 지정하세요 (' + missing.length + '개 부서 미지정).'); return; }
        var r = D().deliverFromReview(DUE.aid, { bulkDue: DUE.bulkDue, deptDues: DUE.deptDues });
        V().closeModal();
        var msg = r.deptsTouched + '개 부서에 개선조치 ' + r.total + '건 전달 · 알림 발송 (프로토타입)';
        if (r.deptsExcluded) msg += ' · 지적사항 없는 ' + r.deptsExcluded + '개 부서는 조치 대상 제외';
        toast(msg);
        state.reviewOpen = {};
        render();
    }

    /* =============== 부서 상세(전달 완료 후) — 단일 모달 =============== */
    function openDept(deptId) {
        var a = (D().assessments(state.year) || [])[0]; if (!a) return;
        var dp = (a.depts || []).find(function (x) { return x.deptId === deptId; });
        if (!dp) return;
        var name = D().deptName(deptId);
        var ms = D().improvementsFor(a.id, deptId);
        var rows = ms.map(function (m) {
            var overdue = D().isOverdue(m);
            var stCls = m.status === 'DONE' ? 'st-done' : (m.status === 'IN_PROGRESS' ? 'st-doing' : 'st-todo');
            var stLbl = m.status === 'DONE' ? '완료' : (m.status === 'IN_PROGRESS' ? '진행중' : '예정');
            var remindBtn = overdue && a.status !== 'COMPLETED'
                ? '<button type="button" class="btn btn-outline btn-sm" style="border-color:var(--status-warning-border);color:var(--status-warning-fg);" onclick="RSKLIST.remindOne(\'' + m.id + '\')">재촉</button>'
                : '';
            return '<tr>' +
                '<td>' + esc((m.hazard && m.hazard.name) || m.hazard_risk_factor || '-') + '</td>' +
                '<td>' + esc((m.hazard && m.hazard.category) || '-') + '</td>' +
                '<td>' + esc(m.description || m.action || '-') + '</td>' +
                '<td class="' + (overdue ? 'rl-overdue' : '') + '">' + esc(m.due || m.due_date || '-') + '</td>' +
                '<td><span class="chip-mini ' + stCls + '">' + stLbl + '</span></td>' +
                '<td>' + remindBtn + '</td>' +
            '</tr>';
        }).join('');
        if (!rows) rows = '<tr><td colspan="6" style="text-align:center;color:var(--text-lightgray);padding:18px;">전달된 개선조치가 없습니다.</td></tr>';
        var meta =
            '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--text-gray);margin-bottom:10px;">' +
                '<span>점검일자 <b>' + esc(dp.inspectDate || '-') + '</b></span>' +
                '<span>설문지 <b>' + esc(dp.surveyFile || (a.files && a.files.surveyAll) || '-') + '</b></span>' +
                (dp.deliveredAt ? '<span>전달일 <b>' + esc(dp.deliveredAt) + '</b></span>' : '') +
                (dp.dueDate ? '<span>조치기한 <b>' + esc(dp.dueDate) + '</b></span>' : '') +
            '</div>';
        var body = meta +
            '<label class="form-label">전달된 개선조치 (' + ms.length + '건)</label>' +
            '<table class="rl-dept-modal-table"><thead><tr>' +
                '<th style="width:24%;">요인명</th><th style="width:10%;">분류</th>' +
                '<th style="width:30%;">개선조치</th><th style="width:14%;">기한</th>' +
                '<th style="width:10%;">상태</th><th style="width:12%;"></th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table>' +
            '<p style="font-size:12px;color:var(--text-gray);margin-top:6px;">개선조치는 <b>개선조치 메뉴(rsk-imp)</b>가 원본입니다. 부서 담당자는 <b>내 할일(my-work)</b>에서 완료 처리·재촉 응답을 수행합니다.</p>';
        V().openModal(name + ' — 개선조치 상세', body,
            '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal()">닫기</button>');
    }

    /* =============== 재촉 =============== */
    function remindDept(deptId) {
        var a = (D().assessments(state.year) || [])[0]; if (!a) return;
        var ms = D().improvementsFor(a.id, deptId).filter(function (m) { return D().isOverdue(m); });
        if (!ms.length) { toast('기한초과 항목이 없습니다.'); return; }
        ms.forEach(function (m) {
            D().pushImpHistory(m.id, { type: 'REMIND', by: '재난안전과', memo: '기한초과 재촉 (기한 ' + (m.due || m.due_date) + ')' });
        });
        D().pushHistory(a.id, { type: 'REMIND', by: '재난안전과', memo: D().deptName(deptId) + ' 기한초과 ' + ms.length + '건 재촉' });
        toast(D().deptName(deptId) + ' 재촉 알림 발송 (' + ms.length + '건)'); render();
    }
    function remindOne(impId) {
        var m = D().improvementOf(impId); if (!m) return;
        D().pushImpHistory(m.id, { type: 'REMIND', by: '재난안전과', memo: '기한초과 재촉 (기한 ' + (m.due || m.due_date) + ')' });
        D().pushHistory(m.assessment_id, { type: 'REMIND', by: '재난안전과', memo: D().deptName(m.dept_id) + ' · ' + (m.hazard && m.hazard.name || '') + ' 재촉' });
        toast('재촉 알림 발송 (프로토타입)');
        V().closeModal();
        render();
    }

    /* =============== 생성 마법사 (단일 모달, STEP 교체) =============== */
    function openWizard() {
        var year = state.year;
        var dup = D().assessments(year);
        if (dup.length) {
            V().openModal(year + '년 정기평가 이미 존재',
                '<p style="font-size:13px;">이미 <b>' + year + '년 정기 위험성평가</b>가 등록되어 있습니다.<br>다른 연도로 셀렉트를 바꿔서 생성하세요.</p>',
                '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal()">확인</button>');
            return;
        }
        var depts = D().deptCandidates();
        /* v1.1 §6.4: STEP1 부서 선정 기본값 전체선택 (인사정보시스템에서 조직 목록 로드 목업) */
        var deptSel = {};
        depts.forEach(function (d) { deptSel[d.id] = true; });
        /* 설문지 단계는 마법사에서 제외 — 생성 후 목록에서 공통/부서별로 첨부한다.
         * (설문지 확정이 늦어져 부서 선정·점검일자 통보까지 막히던 문제를 끊는다) */
        W = {
            step: 1, year: year,
            deptSel: deptSel,     /* {deptId: true} — 기본값 전체선택 */
            deptDates: {},        /* {deptId: 'YYYY-MM-DD'} */
            bulkDate: '',
            candidates: depts
        };
        renderWizard();
    }
    function renderWizard() {
        V().openModal(W.year + '년 정기평가 생성 마법사', wizardBody(), wizardFoot());
    }
    function wizardBody() {
        var stepBar =
            '<div class="rl-wiz-step">' +
                ['1. 부서 선정', '2. 점검일자'].map(function (s, i) {
                    var n = i + 1;
                    var cls = W.step === n ? 'on' : (W.step > n ? 'done' : '');
                    return '<span class="wz ' + cls + '">' + (W.step > n ? '✓ ' : '') + s + '</span>';
                }).join('') +
            '</div>';
        if (W.step === 1) return stepBar + wizStep1();
        return stepBar + wizStep2();
    }
    function wizardFoot() {
        var back = W.step > 1
            ? '<button type="button" class="btn btn-secondary" onclick="RSKLIST.wizBack()">← 이전</button>'
            : '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>';
        var nextLabel = W.step < 2 ? '다음 →' : '생성';
        var next = '<button type="button" class="btn btn-primary" onclick="RSKLIST.wizNext()">' + nextLabel + '</button>';
        return back + next;
    }
    function wizStep1() {
        var total = W.candidates.length;
        var cnt = Object.keys(W.deptSel).filter(function (k) { return W.deptSel[k]; }).length;
        var allOn = cnt === total && total > 0;
        return '<div class="rl-modal-row">' +
            '<div class="rl-hr-badge">' +
                '<span class="rl-hr-chip">🔗 인사정보시스템 연동</span>' +
                '<span style="font-size:12px;color:var(--text-gray);">조직(부서) 목록을 불러왔습니다 (프로토타입 · 실제는 <code>DYV2.ORG</code> 파생).</span>' +
                '<span style="font-size:12px;color:var(--text-black);font-weight:700;margin-left:auto;">선정 <b id="rl-w-cnt">' + cnt + '</b> / ' + total + '개 부서</span>' +
            '</div>' +
            '<label class="form-label" style="margin-top:10px;">평가 대상 부서 선택 <span style="color:var(--status-danger-fg)">*</span> ' +
                '<span style="color:var(--text-lightgray);font-weight:400;">(기본 전체선택 · 필요 시 해제)</span></label>' +
            '<div class="rl-dept-toolbar">' +
                '<label class="rl-dept-allck"><input type="checkbox" id="rl-w-allck"' + (allOn ? ' checked' : '') +
                    ' onchange="RSKLIST.wizToggleAllDepts(this.checked)"> 전체선택/해제</label>' +
            '</div>' +
            /* 공용 인라인 조직도(ORGPICK) 다중 선택 — 전 화면 공통 트리·검색·스크롤 재사용 */
            ORGPICK.deptsPanel('rl-w-orgtree', {
                selectedPath: 'RSKLIST.wizSelDepts',
                onToggle: 'RSKLIST.wizToggleDept',
                countId: 'rl-w-cnt',
                allckId: 'rl-w-allck',
            }) +
            '<p style="font-size:12px;color:var(--text-gray);margin-top:8px;">재난안전과 담당자와 용역업체가 논의한 결과를 반영합니다. 조직도는 <code>DYV2.ORG</code> 단일 출처.</p>' +
        '</div>';
    }
    /* ORGPICK 이 현재 선택 상태를 읽어가는 창구 */
    function wizSelDepts() { return W ? W.deptSel : {}; }
    /* 체크 토글은 상태만 갱신한다 — 마법사를 다시 그리면(openModal) 조직도 검색어·스크롤이 날아가므로
     * 선택 개수·전체선택 배지 동기화는 ORGPICK 이 인플레이스로 처리한다. */
    function wizToggleDept(id, on) {
        if (on) W.deptSel[id] = true; else delete W.deptSel[id];
    }
    function wizToggleAllDepts(on) {
        W.deptSel = {};
        if (on) W.candidates.forEach(function (d) { W.deptSel[d.id] = true; });
        ORGPICK.refreshDepts('rl-w-orgtree');   /* 체크 상태만 다시 맞춤 (검색어·스크롤 보존) */
    }
    function wizStep2() {
        var selIds = Object.keys(W.deptSel).filter(function (k) { return W.deptSel[k]; });
        var rows = selIds.map(function (id) {
            var name = D().deptName(id);
            var v = W.deptDates[id] || '';
            return '<tr><td>' + esc(name) + '</td><td><input type="date" class="form-input" value="' + esc(v) +
                '" onchange="RSKLIST.wizSetDate(\'' + id + '\', this.value)"></td></tr>';
        }).join('');
        return '<div class="rl-modal-row">' +
            '<label class="form-label">일괄 점검일자 (선택 부서 전체에 적용)</label>' +
            '<div class="rl-bulk">' +
                '<input type="date" class="form-input" id="rl-w-bulkdate" value="' + esc(W.bulkDate) + '" style="max-width:180px;">' +
                '<button type="button" class="btn btn-outline btn-sm" onclick="RSKLIST.wizApplyBulkDate()">일괄 적용</button>' +
                '<span style="font-size:12px;color:var(--text-gray);">건별 조정은 아래 표에서 수정하세요.</span>' +
            '</div>' +
            '<table class="rl-dates-table"><thead><tr><th>부서</th><th>점검일자</th></tr></thead>' +
                '<tbody>' + rows + '</tbody></table>' +
            '<p style="font-size:12px;color:var(--text-gray);margin-top:10px;">' +
                '점검설문지는 생성 후 <b>부서별 조치 목록</b>에서 공통본 또는 부서별로 첨부합니다 — 설문지 없이 먼저 일정을 통보할 수 있습니다.</p>' +
        '</div>';
    }
    function wizApplyBulkDate() {
        var v = document.getElementById('rl-w-bulkdate').value;
        if (!v) { toast('일괄 적용할 일자를 선택하세요.'); return; }
        W.bulkDate = v;
        Object.keys(W.deptSel).forEach(function (id) { if (W.deptSel[id]) W.deptDates[id] = v; });
        renderWizard();
    }
    function wizSetDate(id, v) { W.deptDates[id] = v; }

    function wizBack() { if (W.step > 1) { W.step--; renderWizard(); } }
    function wizNext() {
        var selIds = Object.keys(W.deptSel).filter(function (k) { return W.deptSel[k]; });
        if (W.step === 1) {
            if (!selIds.length) { toast('1개 이상 부서를 선택하세요.'); return; }
        }
        if (W.step === 2) {
            var missing = selIds.filter(function (id) { return !W.deptDates[id]; });
            if (missing.length) { toast('점검일자가 비어있는 부서가 있습니다 (' + missing.length + '개).'); return; }
            doCreate();
            return;
        }
        W.step++;
        renderWizard();
    }
    function doCreate() {
        var selIds = Object.keys(W.deptSel).filter(function (k) { return W.deptSel[k]; });
        /* 설문지는 비운 채 생성 — 목록에서 첨부한다 */
        var deptsPayload = selIds.map(function (id) {
            return { deptId: id, inspectDate: W.deptDates[id] || '', surveyFile: '' };
        });
        var a = D().addRegular({ year: W.year, depts: deptsPayload, surveyAll: '' });
        V().closeModal();
        toast('정기평가 생성 · ' + selIds.length + '개 부서에 점검예정일 통보 · 설문지는 목록에서 첨부');
        state.tab = 'depts';
        state.reviewOpen = {};
        render();
    }

    /* =============== init =============== */
    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        var q = new URLSearchParams(location.search);
        var yr = q.get('year');
        if (yr) state.year = +yr;
        render();
    }

    global.RSKLIST = {
        init: init, setYear: setYear, setTab: setTab,
        resetDemo: resetDemo, doResetDemo: doResetDemo,
        /* 보고서·검수 (검수 화면에서는 확인 체크박스·행별 기한이 없다 — 조치기한은 다음 단계 모달에서만) */
        uploadReport: uploadReport, clearReport: clearReport, doClearReport: doClearReport,
        reviewToggleDept: reviewToggleDept, reviewSet: reviewSet,
        reviewDel: reviewDel, reviewAdd: reviewAdd,
        openDueSet: openDueSet, dueApplyBulk: dueApplyBulk, dueSetDept: dueSetDept, dueDeliver: dueDeliver,
        /* 부서 상세·재촉 */
        openDept: openDept, remindDept: remindDept, remindOne: remindOne,
        /* 생성 마법사 (2-STEP: 부서→일자) — "대상자 = 대상 부서" (v1.1 §6.4)
         * 설문지는 마법사 단계가 아니라 생성 후 목록에서 첨부한다 */
        openWizard: openWizard, wizBack: wizBack, wizNext: wizNext,
        wizToggleDept: wizToggleDept, wizToggleAllDepts: wizToggleAllDepts, wizSelDepts: wizSelDepts,
        wizApplyBulkDate: wizApplyBulkDate, wizSetDate: wizSetDate,
        /* 점검설문지 첨부 (등록 이후) */
        openSurveyAll: openSurveyAll, doSurveyAll: doSurveyAll,
        clearSurveyAll: clearSurveyAll, doClearSurveyAll: doClearSurveyAll,
        openDeptSurvey: openDeptSurvey, doDeptSurvey: doDeptSurvey, clearDeptSurvey: clearDeptSurvey,
        pickSurveyFile: pickSurveyFile,
        /* 보고서 첨부·교체 (개선 건수 확인 단계) */
        openReportAttach: openReportAttach, doReportAttach: doReportAttach
    };
})(window);
