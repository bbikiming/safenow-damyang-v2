/* =====================================================================
   rsk-detail.js · 정기 위험성평가 상세 (RSK02-D, 재설계 v1)
   · 상단: 연도·전체 완료율. 단계 프로그레스 없음.
   · 부서별 테이블 (부서·점검일·설문지·개선건수 N/M·조치기한·상태·관리)
   · 보고서(hwpx) 업로드 · 부서 편집 모달(하자드·개선조치 입력 → 검토완료·전달)
   · 재촉 · 이력 탭 (알림·전달·재촉·사유·기한변경·상태변경 타임라인)
   · 전 부서 조치완료 시 평가 상태 자동 완료 (DYRSK.refreshAssessmentStatus)
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYRSK; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }

    var state = { aid: null, mount: null, tab: 'depts' };

    function render() {
        var a = D().assessmentOf(state.aid);
        if (!a) { state.mount.innerHTML = '<div class="v2-empty">평가를 찾을 수 없습니다.</div>'; return; }
        D().refreshAssessmentStatus(a.id);
        a = D().assessmentOf(state.aid);

        var prog = D().assessmentProgress(a.id);
        var stChip = a.status === 'COMPLETED'
            ? '<span class="chip-mini st-done">완료</span>'
            : '<span class="chip-mini st-doing">진행중</span>';

        var head =
            '<div class="rd-head"><div class="rd-head-top">' +
                '<div class="rd-title"><span class="type-badge">정기</span>' + esc(a.title) + ' ' + stChip + '</div>' +
            '</div>' +
            '<div class="rd-meta">' +
                '<span>연도 <b>' + a.year + '</b></span>' +
                '<span>대상 부서 <b>' + (a.depts || []).length + '개</b></span>' +
                '<span>공통 설문지 <b>' + (a.files && a.files.surveyAll ? esc(a.files.surveyAll) : '미첨부') + '</b></span>' +
                (a.status === 'COMPLETED' ? '<span>완료일 <b>' + esc(a.completed_at) + '</b></span>' : '') +
            '</div>' +
            '<div class="rd-progress">' +
                '<div class="rd-progress-bar"><div class="rd-progress-fill" style="width:' + prog.pct + '%"></div></div>' +
                '<div class="rd-progress-txt">' + prog.done + ' / ' + prog.total + ' (' + prog.pct + '%)</div>' +
            '</div></div>';

        var tabs =
            '<div class="rd-tabs">' +
                '<button class="rd-tab ' + (state.tab === 'depts' ? 'on' : '') + '" onclick="RSKDETAIL.setTab(\'depts\')">부서별 조치</button>' +
                '<button class="rd-tab ' + (state.tab === 'history' ? 'on' : '') + '" onclick="RSKDETAIL.setTab(\'history\')">이력</button>' +
            '</div>';

        state.mount.innerHTML = head + tabs + (state.tab === 'depts' ? renderDeptsTab(a) : renderHistoryTab(a));
    }

    function renderDeptsTab(a) {
        var reportBlock =
            '<div class="rd-card"><div class="rd-card-title">용역업체 보고서 (HWPX)</div>' +
                '<div class="rd-report-row">' +
                    (a.files && a.files.report
                        ? '<span class="rd-report-file">' + esc(a.files.report) + '</span>' +
                          '<button type="button" class="rd-file-btn" onclick="RSKDETAIL.clearReport()">× 취소</button>'
                        : '<button type="button" class="rd-file-btn" onclick="RSKDETAIL.uploadReport()">＋ 보고서 업로드 (hwpx)</button>' +
                          '<span style="font-size:12px;color:var(--text-gray);">용역업체가 제출한 위험성평가 보고서(hwpx)를 첨부합니다.</span>') +
                '</div>' +
            '</div>';

        var rows = (a.depts || []).map(function (dp) {
            var name = D().deptName(dp.deptId);
            var c = D().deptImpCount(a.id, dp.deptId);
            var overdue = D().improvementsFor(a.id, dp.deptId).some(function (m) { return D().isOverdue(m); });
            var stCls = dp.status === 'DONE' ? 'st-done' : 'st-todo';
            var stLbl = dp.status === 'DONE' ? '조치완료' : '조치전';
            var mngBtn = a.status === 'COMPLETED'
                ? '<button type="button" class="btn btn-outline btn-sm" onclick="RSKDETAIL.openDept(\'' + dp.deptId + '\')">보기</button>'
                : '<button type="button" class="btn btn-primary btn-sm" onclick="RSKDETAIL.openDept(\'' + dp.deptId + '\')">' + (dp.deliveredAt ? '관리' : '작성·전달') + '</button>';
            var remindBtn = (overdue && a.status !== 'COMPLETED')
                ? ' <button type="button" class="btn btn-outline btn-sm" style="border-color:var(--status-warning-border);color:var(--status-warning-fg);" onclick="RSKDETAIL.remindDept(\'' + dp.deptId + '\')">재촉</button>'
                : '';
            var surveyCell = dp.surveyFile ? '<span class="rd-tiny-file">' + esc(dp.surveyFile) + '</span>' :
                (a.files && a.files.surveyAll ? '<span class="rd-tiny-file">' + esc(a.files.surveyAll) + '</span>' : '<span style="color:var(--text-lightgray);">-</span>');
            var impCell = c.total ? c.done + ' / ' + c.total : '<span style="color:var(--text-lightgray);">-</span>';
            var dueCell = dp.dueDate
                ? '<span class="' + (overdue ? 'rd-overdue' : '') + '">' + esc(dp.dueDate) + '</span>'
                : '<span style="color:var(--text-lightgray);">-</span>';
            return '<tr>' +
                '<td class="rd-dept-name">' + esc(name) + '</td>' +
                '<td>' + esc(dp.inspectDate || '-') + '</td>' +
                '<td>' + surveyCell + '</td>' +
                '<td>' + impCell + '</td>' +
                '<td>' + dueCell + '</td>' +
                '<td><span class="chip-mini ' + stCls + '">' + stLbl + '</span>' +
                    (dp.deliveredAt ? '<div style="font-size:11px;color:var(--text-lightgray);margin-top:3px;">전달 ' + esc(dp.deliveredAt) + '</div>' : '') + '</td>' +
                '<td>' + mngBtn + remindBtn + '</td>' +
                '</tr>';
        }).join('');
        if (!rows) rows = '<tr><td colspan="7" style="text-align:center;color:var(--text-lightgray);padding:24px;">선정된 부서가 없습니다.</td></tr>';

        var table =
            '<div class="rd-card"><div class="rd-card-title">부서별 조치</div>' +
                '<table class="rd-table"><thead><tr>' +
                    '<th>부서</th><th>점검일</th><th>설문지</th><th>개선건수</th><th>조치기한</th><th>상태</th><th>관리</th>' +
                '</tr></thead><tbody>' + rows + '</tbody></table>' +
            '</div>';

        return reportBlock + table;
    }

    function renderHistoryTab(a) {
        var items = [].concat(a.history || []);
        /* 개선조치 이력도 병합 (전달 후 재촉·사유·기한변경·상태변경) */
        D().improvementsFor(a.id).forEach(function (m) {
            (m.history || []).forEach(function (h) {
                if (h.type === 'NOTIFY') return; /* 전달 시점은 dept 단위 이력에 이미 있음 */
                items.push({
                    type: h.type, at: h.at, by: h.by,
                    memo: D().deptName(m.dept_id) + ' · ' + (m.hazard && m.hazard.name ? m.hazard.name + ' — ' : '') + h.memo
                });
            });
        });
        items.sort(function (x, y) { return (x.at || '').localeCompare(y.at || ''); });
        if (!items.length) {
            return '<div class="rd-card"><div class="v2-empty">이력이 없습니다.</div></div>';
        }
        var LABELS = { CREATE:'생성', NOTIFY:'알림', DELIVER:'전달', REMIND:'재촉', REASON:'사유', DUE_CHANGE:'기한변경', STATUS:'상태변경', COMPLETE:'완료', REVIEW:'검토', REGISTER:'등록' };
        var rows = items.map(function (h) {
            return '<div class="rd-hist-row">' +
                '<span class="rd-hist-at">' + esc(h.at || '') + '</span>' +
                '<span class="rd-hist-type ' + (h.type || '') + '">' + esc(LABELS[h.type] || h.type || '기타') + '</span>' +
                '<span class="rd-hist-body">' + esc(h.memo || '') +
                    (h.by ? '<span class="rd-hist-by">— ' + esc(h.by) + '</span>' : '') +
                '</span>' +
            '</div>';
        }).join('');
        return '<div class="rd-card"><div class="rd-card-title">이력 타임라인</div><div class="rd-history">' + rows + '</div></div>';
    }

    function setTab(t) { state.tab = t; render(); }

    /* =============== 보고서 업로드(목업) =============== */
    function uploadReport() {
        var a = D().assessmentOf(state.aid);
        a.files = a.files || {}; a.files.report = a.year + '_정기평가_보고서.hwpx';
        D().pushHistory(a.id, { type: 'STATUS', by: '재난안전과', memo: '용역업체 보고서 첨부 (' + a.files.report + ')' });
        toast('보고서 업로드 (프로토타입)'); render();
    }
    function clearReport() {
        var a = D().assessmentOf(state.aid);
        if (a.files) a.files.report = '';
        D().saveAssessment(); render();
    }

    /* =============== 부서 편집 모달 (하자드·개선조치 입력 → 검토완료 전달) =============== */
    var EM = null; /* { deptId, rows:[{name,category,cause,action,due}], bulkDue } */
    function openDept(deptId) {
        var a = D().assessmentOf(state.aid);
        var dp = (a.depts || []).find(function (x) { return x.deptId === deptId; });
        if (!dp) return;
        EM = {
            deptId: deptId, delivered: !!dp.deliveredAt, bulkDue: dp.dueDate || '',
            rows: (dp.hazards || []).map(function (h) {
                return { name: h.name || '', category: h.category || '', cause: h.cause || '', action: h.action || '', due: '' };
            })
        };
        if (!EM.rows.length) EM.rows.push({ name: '', category: '', cause: '', action: '', due: '' });
        renderDeptModal();
    }
    function renderDeptModal() {
        var a = D().assessmentOf(state.aid);
        var dp = (a.depts || []).find(function (x) { return x.deptId === EM.deptId; });
        var name = D().deptName(EM.deptId);
        var delivered = !!dp.deliveredAt;

        var body = '<div class="rd-em-row" style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--text-gray);">' +
                '<span>점검일자 <b>' + esc(dp.inspectDate || '-') + '</b></span>' +
                '<span>설문지 <b>' + esc(dp.surveyFile || (a.files && a.files.surveyAll) || '-') + '</b></span>' +
                (delivered ? '<span>전달일 <b>' + esc(dp.deliveredAt) + '</b></span>' : '') +
                (delivered ? '<span>조치기한 <b>' + esc(dp.dueDate || '-') + '</b></span>' : '') +
            '</div>';

        if (delivered) {
            body += renderDeliveredView(a, dp);
        } else {
            body += renderEditableView(a, dp);
        }

        var footer;
        if (delivered) {
            footer = '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal()">닫기</button>';
        } else {
            footer =
                '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
                '<button type="button" class="btn btn-outline" onclick="RSKDETAIL.saveDraft()">임시 저장</button>' +
                '<button type="button" class="btn btn-primary" onclick="RSKDETAIL.deliverDept()">검토완료 · 전달</button>';
        }
        V().openModal(name + ' — 유해위험요인 · 개선조치', body, footer);
    }
    function renderEditableView(a, dp) {
        var rows = EM.rows.map(function (r, i) {
            return '<tr>' +
                '<td><input type="text" value="' + esc(r.name) + '" onchange="RSKDETAIL.emSet(' + i + ',\'name\',this.value)" placeholder="유해위험요인 이름"></td>' +
                '<td><select onchange="RSKDETAIL.emSet(' + i + ',\'category\',this.value)">' +
                    ['', '기계적', '화학적', '작업특성', '전기', '고소작업', '보건', '기타'].map(function (c) {
                        return '<option value="' + c + '"' + (r.category === c ? ' selected' : '') + '>' + (c || '분류') + '</option>';
                    }).join('') + '</select></td>' +
                '<td><input type="text" value="' + esc(r.cause) + '" onchange="RSKDETAIL.emSet(' + i + ',\'cause\',this.value)" placeholder="원인"></td>' +
                '<td><textarea rows="2" onchange="RSKDETAIL.emSet(' + i + ',\'action\',this.value)" placeholder="개선조치 사항">' + esc(r.action) + '</textarea></td>' +
                '<td><input type="date" value="' + esc(r.due) + '" onchange="RSKDETAIL.emSet(' + i + ',\'due\',this.value)"></td>' +
                '<td class="rd-hz-delcell"><button type="button" class="rd-hz-del" onclick="RSKDETAIL.emDel(' + i + ')" title="삭제">×</button></td>' +
            '</tr>';
        }).join('');
        return '<div class="rd-em-row">' +
                '<label class="form-label">유해위험요인 · 개선조치 (행 단위 입력)</label>' +
                '<table class="rd-hz-table"><thead><tr>' +
                    '<th style="width:22%;">요인명</th><th style="width:12%;">분류</th><th style="width:18%;">원인</th>' +
                    '<th style="width:28%;">개선조치</th><th style="width:14%;">기한(개별)</th><th class="rd-hz-delcell"></th>' +
                '</tr></thead><tbody>' + rows + '</tbody></table>' +
                '<button type="button" class="btn btn-outline btn-sm" onclick="RSKDETAIL.emAdd()">＋ 행 추가</button>' +
            '</div>' +
            '<div class="rd-em-row">' +
                '<label class="form-label">부서 단위 일괄 조치기한 <span style="color:var(--text-lightgray);font-weight:400;">(개별 기한이 비어있으면 이 값 사용)</span></label>' +
                '<input type="date" class="form-input" value="' + esc(EM.bulkDue) + '" onchange="RSKDETAIL.emBulkDue(this.value)" style="max-width:200px;">' +
            '</div>';
    }
    function renderDeliveredView(a, dp) {
        var ms = D().improvementsFor(a.id, dp.deptId);
        var rows = ms.map(function (m) {
            var overdue = D().isOverdue(m);
            var stCls = m.status === 'DONE' ? 'st-done' : (m.status === 'IN_PROGRESS' ? 'st-doing' : 'st-todo');
            var stLbl = m.status === 'DONE' ? '완료' : (m.status === 'IN_PROGRESS' ? '진행중' : '예정');
            var remindBtn = overdue && a.status !== 'COMPLETED'
                ? '<button type="button" class="btn btn-outline btn-sm" style="border-color:var(--status-warning-border);color:var(--status-warning-fg);" onclick="RSKDETAIL.remindOne(\'' + m.id + '\')">재촉</button>'
                : '';
            return '<tr>' +
                '<td>' + esc((m.hazard && m.hazard.name) || m.hazard_risk_factor || '-') + '</td>' +
                '<td>' + esc((m.hazard && m.hazard.category) || '-') + '</td>' +
                '<td>' + esc(m.description || m.action || '-') + '</td>' +
                '<td class="' + (overdue ? 'rd-overdue' : '') + '">' + esc(m.due || m.due_date || '-') + '</td>' +
                '<td><span class="chip-mini ' + stCls + '">' + stLbl + '</span></td>' +
                '<td>' + remindBtn + '</td>' +
            '</tr>';
        }).join('');
        if (!rows) rows = '<tr><td colspan="6" style="text-align:center;color:var(--text-lightgray);padding:18px;">전달된 개선조치가 없습니다.</td></tr>';
        return '<div class="rd-em-row">' +
                '<label class="form-label">전달된 개선조치 (' + ms.length + '건)</label>' +
                '<table class="rd-hz-table"><thead><tr>' +
                    '<th style="width:26%;">요인명</th><th style="width:10%;">분류</th>' +
                    '<th style="width:30%;">개선조치</th><th style="width:14%;">기한</th>' +
                    '<th style="width:10%;">상태</th><th style="width:10%;"></th>' +
                '</tr></thead><tbody>' + rows + '</tbody></table>' +
                '<p style="font-size:12px;color:var(--text-gray);margin-top:6px;">개선조치는 <b>개선조치 메뉴(rsk-imp)</b>가 원본입니다. 부서 담당자는 <b>내 할일(rsk-my)</b>에서 완료 처리·재촉 응답을 수행합니다.</p>' +
            '</div>';
    }
    function emSet(i, k, v) { if (EM && EM.rows[i]) EM.rows[i][k] = v; }
    function emAdd() { EM.rows.push({ name: '', category: '', cause: '', action: '', due: '' }); renderDeptModal(); }
    function emDel(i) { EM.rows.splice(i, 1); if (!EM.rows.length) EM.rows.push({ name: '', category: '', cause: '', action: '', due: '' }); renderDeptModal(); }
    function emBulkDue(v) { EM.bulkDue = v; }

    /* 임시 저장 — 하자드만 dp.hazards 에 반영, 전달은 아님 */
    function saveDraft() {
        var a = D().assessmentOf(state.aid);
        var dp = (a.depts || []).find(function (x) { return x.deptId === EM.deptId; });
        var kept = EM.rows.filter(function (r) { return (r.name || '').trim(); });
        dp.hazards = kept.map(function (r) { return { name: r.name.trim(), category: r.category || '', cause: r.cause || '', action: r.action || '' }; });
        D().saveAssessment();
        V().closeModal(); toast('임시 저장됨 · ' + kept.length + '건'); render();
    }
    /* 검토완료 → 전달: improvements 생성 + dept.deliveredAt/dueDate 설정 + 알림·이력 */
    function deliverDept() {
        var a = D().assessmentOf(state.aid);
        var dp = (a.depts || []).find(function (x) { return x.deptId === EM.deptId; });
        var valid = EM.rows.filter(function (r) { return (r.name || '').trim() && (r.action || '').trim(); });
        if (!valid.length) { toast('요인명 · 개선조치가 모두 입력된 행이 없습니다.'); return; }
        var missingDue = valid.filter(function (r) { return !r.due && !EM.bulkDue; });
        if (missingDue.length) { toast('일괄 기한 또는 개별 기한을 지정하세요.'); return; }

        var deptNm = D().deptName(EM.deptId);
        dp.hazards = valid.map(function (r) { return { name: r.name.trim(), category: r.category || '', cause: r.cause || '', action: r.action.trim() }; });
        dp.dueDate = EM.bulkDue || '';
        dp.deliveredAt = D().today();
        dp.status = 'BEFORE';
        D().saveAssessment();

        valid.forEach(function (r) {
            var due = r.due || EM.bulkDue;
            var m = D().addImprovement({
                source_type: 'risk_assessment',
                assessment_id: a.id, dept_id: EM.deptId,
                hazard: { name: r.name.trim(), category: r.category || '', cause: r.cause || '' },
                description: r.action.trim(), action: r.action.trim(),
                due: due, due_date: due,
                assigned_to: deptNm + ' 담당자',
                status: 'IN_PROGRESS', created: D().today(),
                history: [{ type: 'NOTIFY', at: D().nowTs(), by: '재난안전과', memo: '개선조치 전달 (기한 ' + due + ')' }]
            });
        });
        D().pushHistory(a.id, { type: 'DELIVER', by: '재난안전과', memo: deptNm + ' 개선조치 ' + valid.length + '건 전달 (기한 ' + (EM.bulkDue || '개별') + ')' });
        D().refreshAssessmentStatus(a.id);

        V().closeModal(); toast(deptNm + ' 개선조치 ' + valid.length + '건 전달 · 부서 알림 (프로토타입)'); render();
    }

    /* =============== 재촉 =============== */
    function remindDept(deptId) {
        var a = D().assessmentOf(state.aid);
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
        toast('재촉 알림 발송 (프로토타입)'); renderDeptModal();
    }

    /* =============== init =============== */
    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        state.aid = new URLSearchParams(location.search).get('id');
        render();
    }

    global.RSKDETAIL = {
        init: init, setTab: setTab,
        uploadReport: uploadReport, clearReport: clearReport,
        openDept: openDept, emSet: emSet, emAdd: emAdd, emDel: emDel, emBulkDue: emBulkDue,
        saveDraft: saveDraft, deliverDept: deliverDept,
        remindDept: remindDept, remindOne: remindOne
    };
})(window);
