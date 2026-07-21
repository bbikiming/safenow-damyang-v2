/* =====================================================================
   my-work.js · 내 할일 (전역, v1.1 §6.2)
   ---------------------------------------------------------------------
   부서 담당자 관점의 전 업무 통합 내 할일. 위험성평가 전용이었던 rsk-my를
   승격해 결재·위험·개선·점검·의견·이행·도급·평가·인력 도메인을 한 화면에.
   레퍼런스: v1 프로토타입 myw01-v.
   · 상단: "내 할일" · 최종 동기화 시각 · [↻ 동기화]
   · KPI 칩 5개: 지연 / 오늘 마감 / 이번주 / 결재 대기 / 전체
   · 필터: 상태(전체/지연/진행/예정) · 카테고리 · 정렬(마감 임박순/카테고리)
   · 그룹 리스트: 🔴 지연 / 🟡 이번주 / 🟢 예정 / 📌 기타
   · 위험성평가 실데이터 편입:
       - 점검예정(설문지 다운로드) = 카테고리 '위험'
       - 전달받은 개선조치(N/M·완료 처리) = 카테고리 '개선'
       - 재촉받은 건은 지연 그룹 강조 + 인라인 폼(사유 입력 + 처리기한 수정)
   · 타 카테고리는 정적 목업 시드 (결재·점검·의견·이행·도급·평가)
   · 상단 부서 셀렉트로 관점 전환 (프로토타입용) — DYV2.ORG 파생
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYRSK; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }

    /* 오늘 기준 (프로토타입 정적 기준일 2026-07-16, CLAUDE.md currentDate) */
    var TODAY_ISO = '2026-07-16';
    function daysBetween(dueIso) {
        if (!dueIso) return null;
        var t = new Date(TODAY_ISO), d = new Date(dueIso);
        return Math.round((d - t) / 86400000);
    }
    function bucket(dueIso, status) {
        if (status === 'DONE') return 'done';
        var d = daysBetween(dueIso);
        if (d == null) return 'other';
        if (d < 0) return 'overdue';
        if (d <= 7) return 'week';
        return 'plan';
    }
    function dDayText(dueIso, status) {
        if (status === 'DONE') return '완료';
        var d = daysBetween(dueIso);
        if (d == null) return '';
        if (d < 0) return 'D+' + Math.abs(d);
        if (d === 0) return 'D-day';
        return 'D-' + d;
    }

    /* 카테고리 메타 */
    var CATS = {
        approval:   { label: '결재',       color: 'var(--cat-approval-fg)',   bg: 'var(--cat-approval-bg)' },
        risk:       { label: '위험',       color: 'var(--cat-risk-fg)',       bg: 'var(--cat-risk-bg)' },
        improve:    { label: '개선',       color: 'var(--cat-improve-fg)',    bg: 'var(--cat-improve-bg)' },
        inspection: { label: '점검',       color: 'var(--cat-inspection-fg)', bg: 'var(--cat-inspection-bg)' },
        opinion:    { label: '의견',       color: 'var(--cat-opinion-fg)',    bg: 'var(--cat-opinion-bg)' },
        comply:     { label: '이행',       color: 'var(--cat-comply-fg)',     bg: 'var(--cat-comply-bg)' },
        contract:   { label: '도급',       color: 'var(--cat-contract-fg)',   bg: 'var(--cat-contract-bg)' },
        eval:       { label: '평가',       color: 'var(--cat-eval-fg)',       bg: 'var(--cat-eval-bg)' },
        edu:        { label: '교육',       color: 'var(--cat-edu-fg)',        bg: 'var(--cat-edu-bg)' }
    };

    /* 타 도메인 목업 시드 (10건 내외) — 부서별로 필터되도록 dept 배열로 표시 */
    function otherSeeds() {
        return [
            /* 결재 */
            { id: 'A-01', cat: 'approval',   title: '안전·보건 목표와 경영방침 결재 요청 (온나라 상신)',
              due: '2026-07-18', status: 'IN_PROGRESS', dept: 'safety',   dept_label: '재난안전과',
              href: 'menu.html?m=policy', action: '검토' },
            { id: 'A-02', cat: 'approval',   title: '2026 하반기 안전보건 예산 편성안 결재',
              due: '2026-07-22', status: 'IN_PROGRESS', dept: 'plan',     dept_label: '기획예산실',
              href: 'bgt-main.html', action: '결재' },
            /* 점검 */
            { id: 'I-01', cat: 'inspection', title: '기준문서함 2차 검토 대상 16건 분류 확인',
              due: '2026-07-19', status: 'IN_PROGRESS', dept: 'safety',   dept_label: '재난안전과',
              href: 'docs-archive.html', action: '보기' },
            { id: 'I-02', cat: 'inspection', title: '공중이용시설 안전점검 결과 정리 (담양읍 문화의전당)',
              due: '2026-07-17', status: 'IN_PROGRESS', dept: 'culture',  dept_label: '문화체육과',
              href: 'fac-list.html', action: '처리' },
            /* 의견 */
            { id: 'O-01', cat: 'opinion',    title: '산업안전보건위원회 반기 회의록 등록',
              due: '2026-07-15', status: 'IN_PROGRESS', dept: 'safety',   dept_label: '재난안전과',
              href: 'menu.html?m=opinion&sub=committee', action: '등록' },
            /* 이행 */
            { id: 'C-01', cat: 'comply',     title: '의무이행 점검표 반기 마감 (D+8 기한초과)',
              due: '2026-07-08', status: 'IN_PROGRESS', dept: 'safety',   dept_label: '재난안전과',
              href: 'menu.html?m=comply', action: '처리' },
            { id: 'C-02', cat: 'comply',     title: '안전보건교육 상반기 실시 결과 정리',
              due: '2026-07-25', status: 'IN_PROGRESS', dept: 'safety',   dept_label: '재난안전과',
              href: 'edu.html', action: '보기' },
            /* 도급 */
            { id: 'K-01', cat: 'contract',   title: '도급사업 안전보건 점검 (군도 5호선)',
              due: '2026-07-30', status: 'IN_PROGRESS', dept: 'construct', dept_label: '건설과',
              href: 'menu.html?m=contract', action: '보기' },
            { id: 'K-02', cat: 'contract',   title: '용역계약 재해예방 조치 검토',
              due: '2026-08-05', status: 'IN_PROGRESS', dept: 'acct',     dept_label: '회계과',
              href: 'menu.html?m=contract', action: '검토' },
            /* 평가 */
            { id: 'E-01', cat: 'eval',       title: '2026년 반기 인력평가 응답 (안전보건관리책임자)',
              due: '2026-07-31', status: 'IN_PROGRESS', dept: 'safety',   dept_label: '재난안전과',
              href: 'evl-eval.html', action: '평가' }
        ];
    }

    var state = {
        mount: null, deptId: '',
        fStatus: '', fCat: '', sort: 'due',
        openInline: {}, /* {impId: {reason, due}} */
        syncedAt: '2026-07-16 09:15'
    };

    /* ================= 아이템 수집 ================= */
    function collectItems() {
        var out = [];
        /* 위험성평가 실데이터 — 점검예정 (카테고리 '위험') */
        try {
            (D().assessments() || []).forEach(function (a) {
                if (a.status === 'COMPLETED') return;
                (a.depts || []).forEach(function (dp) {
                    if (dp.deptId !== state.deptId) return;
                    var f = dp.surveyFile || (a.files && a.files.surveyAll) || '';
                    var due = dp.inspectDate || '';
                    out.push({
                        id: 'RSK-' + a.id + '-' + dp.deptId + '-inspect',
                        cat: 'risk',
                        title: a.title + ' — 점검일 참여',
                        sub: '설문지: ' + (f || '없음'),
                        due: due,
                        status: dp.deliveredAt ? 'IN_PROGRESS' : 'IN_PROGRESS',
                        dept: dp.deptId, dept_label: D().deptName(dp.deptId),
                        href: 'rsk-list.html?year=' + a.year,
                        action: f ? '설문지 다운' : '보기',
                        onclick: f ? "DYV2.toast('설문지 다운로드: " + f.replace(/'/g, "&#39;") + " (프로토타입)')" : null,
                        remind: false
                    });
                });
            });
        } catch (e) {}
        /* 위험성평가 실데이터 — 전달받은 개선조치 (카테고리 '개선') */
        try {
            var ms = D().improvements().filter(function (m) { return m.dept_id === state.deptId; });
            ms.forEach(function (m) {
                var isRemind = (m.history || []).some(function (h) { return h.type === 'REMIND'; }) && m.status !== 'DONE';
                var title = (m.hazard && m.hazard.name) || m.hazard_risk_factor || '개선조치';
                var due = m.due || m.due_date || '';
                out.push({
                    id: 'IMP-' + m.id,
                    cat: 'improve',
                    title: title,
                    sub: m.description || m.action || '',
                    due: due,
                    status: m.status || 'IN_PROGRESS',
                    dept: m.dept_id, dept_label: D().deptName(m.dept_id),
                    href: 'rsk-list.html' + (m.assessment_id ? '?year=' + (m.assessment_id.match(/RA-(\d{4})/) || [])[1] : ''),
                    action: m.status === 'DONE' ? '보기' : (isRemind ? '재촉 응답' : '완료 처리'),
                    remind: isRemind,
                    impId: m.id
                });
            });
        } catch (e) {}
        /* 안전보건교육 실데이터 — 집합교육 신청 가능 · 자체교육 진행 · 독촉받은 미이수 */
        try {
            var Edu = global.DYEDU;
            if (Edu) {
                /* 신청 가능한 집합교육(OPEN) — 부서에 미신청분 */
                var enrolls = Edu.enrolls();
                Edu.courses({ status: 'OPEN' }).forEach(function (c) {
                    if (c.kind !== 'REG_GROUP' && c.kind !== 'SUP_REG') return;
                    var applied = enrolls.some(function (e) { return e.courseId === c.id && e.deptId === state.deptId; });
                    if (applied) return;
                    out.push({
                        id: 'EDU-APPLY-' + c.id,
                        cat: 'edu',
                        title: c.desc + ' — 부서 신청 필요',
                        sub: '일정 ' + c.date + ' · ' + c.hours + 'h · ' + (c.instructor || ''),
                        due: c.date,
                        status: 'IN_PROGRESS',
                        dept: state.deptId, dept_label: Edu.deptName(state.deptId),
                        href: 'edu-reg.html',
                        action: '신청 →', remind: false
                    });
                });
                /* 독촉받은 미이수: 최근 reminders 중 이 부서 소속 항목 */
                Edu.reminders().forEach(function (r) {
                    if (r.deptId !== state.deptId) return;
                    (r.workerIds || []).forEach(function (wid) {
                        var w = Edu.workerOf(wid); if (!w) return;
                        var sr = Edu.statusRow(w, Edu.TODAY);
                        if (sr.complete) return; /* 이미 완료 */
                        out.push({
                            id: 'EDU-REMIND-' + wid + '-' + r.at,
                            cat: 'edu',
                            title: w.name + ' — 안전보건교육 미이수 (독촉)',
                            sub: '필요 ' + sr.need + 'h · 인정 ' + sr.done + 'h · 미달 ' + sr.short + 'h · ' + r.memo,
                            due: sr.cycle.end,
                            status: 'IN_PROGRESS',
                            dept: state.deptId, dept_label: Edu.deptName(state.deptId),
                            href: 'edu-reg.html',
                            action: '자체교육 진행 →', remind: true
                        });
                    });
                });
            }
        } catch (e) {}
        /* 타 도메인 목업 시드 */
        otherSeeds().forEach(function (s) {
            if (s.dept !== state.deptId) return;
            out.push({
                id: s.id, cat: s.cat, title: s.title, sub: '', due: s.due,
                status: s.status, dept: s.dept, dept_label: s.dept_label,
                href: s.href, action: s.action, remind: false
            });
        });
        return out;
    }

    /* ================= KPI ================= */
    function kpis(items) {
        var overdue = 0, today = 0, week = 0, approval = 0;
        items.forEach(function (it) {
            if (it.status === 'DONE') return;
            var d = daysBetween(it.due);
            if (d != null) {
                if (d < 0) overdue++;
                else if (d === 0) today++;
                else if (d <= 7) week++;
            }
            if (it.cat === 'approval') approval++;
        });
        return { overdue: overdue, today: today, week: week, approval: approval, total: items.length };
    }

    /* ================= 필터·정렬 ================= */
    function filterAndSort(items) {
        var arr = items.filter(function (it) {
            if (state.fStatus) {
                if (state.fStatus === 'overdue' && daysBetween(it.due) >= 0) return false;
                if (state.fStatus === 'progress' && it.status !== 'IN_PROGRESS') return false;
                if (state.fStatus === 'plan') {
                    var d = daysBetween(it.due);
                    if (!(d != null && d > 7)) return false;
                }
            }
            if (state.fCat && it.cat !== state.fCat) return false;
            return true;
        });
        arr.sort(function (a, b) {
            if (state.sort === 'category') {
                if (a.cat !== b.cat) return (CATS[a.cat] ? CATS[a.cat].label : '').localeCompare(CATS[b.cat] ? CATS[b.cat].label : '');
                return (a.due || '').localeCompare(b.due || '');
            }
            /* due (default) — 지연은 먼저, 그다음 임박순, 기한 없는 것은 뒤 */
            var da = daysBetween(a.due), db = daysBetween(b.due);
            if (da == null && db == null) return 0;
            if (da == null) return 1;
            if (db == null) return -1;
            return da - db;
        });
        return arr;
    }

    /* ================= 그룹 ================= */
    var GROUPS = [
        { key: 'overdue', label: '지연',    icon: '🔴', tone: 'danger'  },
        { key: 'week',    label: '이번주',   icon: '🟡', tone: 'warning' },
        { key: 'plan',    label: '예정',    icon: '🟢', tone: 'success' },
        { key: 'other',   label: '기타',    icon: '📌', tone: 'neutral' }
    ];

    /* ================= 렌더 ================= */
    function render() {
        if (!state.mount) return;
        var depts = candidateDepts();
        if (!state.deptId) state.deptId = depts[0] && depts[0].id;

        var items = collectItems();
        var k = kpis(items);
        var view = filterAndSort(items);

        var deptOpts = depts.map(function (d) { return '<option value="' + d.id + '"' + (d.id === state.deptId ? ' selected' : '') + '>' + esc(d.name) + '</option>'; }).join('');

        var head =
            '<div class="mw-head">' +
                '<div class="mw-head-left">' +
                    '<h2 class="mw-title">내 할일</h2>' +
                    '<span class="mw-synced">최종 동기화 <b>' + esc(state.syncedAt) + '</b></span>' +
                    '<button type="button" class="btn btn-outline btn-sm" onclick="MYWORK.sync()">↻ 동기화</button>' +
                '</div>' +
                '<div class="mw-head-right">' +
                    '<label class="mw-deptlabel">부서 (관점 전환)</label>' +
                    '<select class="form-select" onchange="MYWORK.setDept(this.value)">' + deptOpts + '</select>' +
                '</div>' +
            '</div>';

        var kpi =
            '<div class="mw-kpis">' +
                kpiChip('danger',  '지연',     k.overdue) +
                kpiChip('warning', '오늘 마감', k.today) +
                kpiChip('info',    '이번주',   k.week) +
                kpiChip('purple',  '결재 대기', k.approval) +
                kpiChip('neutral', '전체',     k.total) +
            '</div>';

        var catOpts = '<option value="">전체 카테고리</option>' +
            Object.keys(CATS).map(function (k2) { return '<option value="' + k2 + '"' + (state.fCat === k2 ? ' selected' : '') + '>' + esc(CATS[k2].label) + '</option>'; }).join('');
        var filters =
            '<div class="mw-filters">' +
                '<select class="form-select" onchange="MYWORK.setStatus(this.value)">' +
                    '<option value="">상태 전체</option>' +
                    '<option value="overdue"'  + (state.fStatus === 'overdue'  ? ' selected' : '') + '>지연</option>' +
                    '<option value="progress"' + (state.fStatus === 'progress' ? ' selected' : '') + '>진행</option>' +
                    '<option value="plan"'     + (state.fStatus === 'plan'     ? ' selected' : '') + '>예정</option>' +
                '</select>' +
                '<select class="form-select" onchange="MYWORK.setCat(this.value)">' + catOpts + '</select>' +
                '<select class="form-select" onchange="MYWORK.setSort(this.value)">' +
                    '<option value="due"'      + (state.sort === 'due'      ? ' selected' : '') + '>마감 임박순</option>' +
                    '<option value="category"' + (state.sort === 'category' ? ' selected' : '') + '>카테고리순</option>' +
                '</select>' +
                (view.length !== items.length
                    ? '<span class="mw-filter-count">' + view.length + ' / ' + items.length + '건 표시</span>'
                    : '<span class="mw-filter-count">' + items.length + '건</span>') +
            '</div>';

        var groupHtml = '';
        var grouped = {};
        GROUPS.forEach(function (g) { grouped[g.key] = []; });
        view.forEach(function (it) { grouped[bucket(it.due, it.status)].push(it); });

        GROUPS.forEach(function (g) {
            var list = grouped[g.key];
            if (!list.length) return;
            groupHtml += '<div class="mw-group mw-g-' + g.tone + '">' +
                '<div class="mw-group-head"><span class="mw-group-icon">' + g.icon + '</span>' +
                    '<span class="mw-group-label">' + g.label + '</span>' +
                    '<span class="mw-group-count">' + list.length + '건</span>' +
                '</div>' +
                '<div class="mw-group-body">' +
                    list.map(itemHtml).join('') +
                '</div>' +
            '</div>';
        });
        if (!view.length) {
            groupHtml = '<div class="mw-empty">조건에 맞는 할일이 없습니다.</div>';
        }

        state.mount.innerHTML = head + kpi + filters + groupHtml;
    }

    function kpiChip(tone, label, num) {
        return '<div class="mw-kpi mw-kpi-' + tone + '"><span class="mw-kpi-num">' + num + '</span><span class="mw-kpi-label">' + label + '</span></div>';
    }

    function itemHtml(it) {
        var meta = CATS[it.cat] || { label: it.cat, color: 'var(--text-gray)', bg: 'var(--gray-200)' };
        var dTxt = dDayText(it.due, it.status);
        var dCls = 'mw-dday';
        var dNum = daysBetween(it.due);
        if (it.status === 'DONE') dCls += ' done';
        else if (dNum != null && dNum < 0) dCls += ' over';
        else if (dNum != null && dNum <= 3) dCls += ' soon';

        var actionBtn = '';
        if (it.impId && it.remind) {
            actionBtn = '<button type="button" class="btn btn-outline btn-sm" onclick="MYWORK.toggleRespond(\'' + it.impId + '\')">' +
                (state.openInline[it.impId] ? '재촉 응답 닫기' : '재촉 응답 →') + '</button>' +
                ' <button type="button" class="btn btn-primary btn-sm" onclick="MYWORK.complete(\'' + it.impId + '\')">완료 처리</button>';
        } else if (it.impId && it.status !== 'DONE') {
            actionBtn = '<button type="button" class="btn btn-primary btn-sm" onclick="MYWORK.complete(\'' + it.impId + '\')">완료 처리</button>';
        } else if (it.impId && it.status === 'DONE') {
            actionBtn = '<a class="btn btn-outline btn-sm" href="' + esc(it.href) + '">보기</a>';
        } else if (it.onclick) {
            actionBtn = '<button type="button" class="btn btn-outline btn-sm" onclick="' + it.onclick + '">' + esc(it.action || '보기') + '</button>';
        } else if (it.href) {
            actionBtn = '<a class="btn btn-outline btn-sm" href="' + esc(it.href) + '">' + esc(it.action || '보기') + ' →</a>';
        }

        var subLine = it.sub ? '<div class="mw-item-sub">' + esc(it.sub) + '</div>' : '';
        var remindTag = it.remind ? '<span class="mw-remind-tag">🔔 재촉</span> ' : '';
        var catBadge = '<span class="mw-cat" style="color:' + meta.color + ';background:' + meta.bg + ';">' + esc(meta.label) + '</span>';

        var head =
            '<div class="mw-item-head">' +
                '<div class="mw-item-main">' +
                    catBadge + ' ' + remindTag +
                    '<span class="mw-item-title">' + esc(it.title) + '</span>' +
                    subLine +
                    '<div class="mw-item-meta">' +
                        '<span class="' + dCls + '">' + esc(dTxt) + '</span>' +
                        (it.due ? '<span class="mw-item-due">' + esc(it.due) + '</span>' : '') +
                        (it.dept_label ? '<span class="mw-item-dept">' + esc(it.dept_label) + '</span>' : '') +
                    '</div>' +
                '</div>' +
                '<div class="mw-item-actions">' + actionBtn + '</div>' +
            '</div>';

        var inline = '';
        if (it.impId && state.openInline[it.impId]) {
            var v = state.openInline[it.impId];
            inline = '<div class="mw-inline">' +
                '<div class="mw-inline-row"><label>재촉 응답 사유 <span style="color:var(--status-danger-fg)">*</span></label>' +
                    '<textarea rows="2" onchange="MYWORK.setRespReason(\'' + it.impId + '\', this.value)" placeholder="지연 사유·현장 상황">' + esc(v.reason) + '</textarea></div>' +
                '<div class="mw-inline-row"><label>수정 처리기한 <span style="color:var(--status-danger-fg)">*</span></label>' +
                    '<input type="date" value="' + esc(v.due) + '" onchange="MYWORK.setRespDue(\'' + it.impId + '\', this.value)"></div>' +
                '<div class="mw-inline-foot">' +
                    '<button type="button" class="btn btn-secondary btn-sm" onclick="MYWORK.toggleRespond(\'' + it.impId + '\')">취소</button>' +
                    '<button type="button" class="btn btn-primary btn-sm" onclick="MYWORK.submitRespond(\'' + it.impId + '\')">응답 제출</button>' +
                '</div>' +
            '</div>';
        }

        return '<div class="mw-item' + (it.remind ? ' remind' : '') + '">' + head + inline + '</div>';
    }

    /* ================= 부서 후보 (DYV2.ORG 파생) ================= */
    function candidateDepts() {
        var seen = {};
        try { D().assessments().forEach(function (a) { (a.depts || []).forEach(function (dp) { seen[dp.deptId] = (seen[dp.deptId] || 0) + 1; }); }); } catch (e) {}
        try { D().improvements().forEach(function (m) { if (m.dept_id) seen[m.dept_id] = (seen[m.dept_id] || 0) + 5; }); } catch (e) {}
        otherSeeds().forEach(function (s) { seen[s.dept] = (seen[s.dept] || 0) + 3; });
        var all = D().deptCandidates();
        /* plan(기획예산실)은 dept 후보에 없을 수 있어 강제로 추가 */
        var haveIds = {};
        all.forEach(function (x) { haveIds[x.id] = true; });
        Object.keys(seen).forEach(function (id) {
            if (!haveIds[id]) {
                var n = V().orgNode(id);
                if (n) all.push({ id: id, name: n.name });
            }
        });
        all.sort(function (a, b) { return (seen[b.id] || 0) - (seen[a.id] || 0); });
        return all;
    }

    /* ================= 액션 ================= */
    function setDept(id) { state.deptId = id; state.openInline = {}; render(); }
    function setStatus(v) { state.fStatus = v; render(); }
    function setCat(v) { state.fCat = v; render(); }
    function setSort(v) { state.sort = v; render(); }
    function sync() {
        var t = new Date();
        var pad = function (n) { return (n < 10 ? '0' : '') + n; };
        state.syncedAt = t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()) + ' ' + pad(t.getHours()) + ':' + pad(t.getMinutes());
        toast('내 할일 목록을 새로고침했습니다.');
        render();
    }

    /* 재촉 응답 인라인 폼 */
    function toggleRespond(id) {
        if (state.openInline[id]) delete state.openInline[id];
        else {
            var m = D().improvementOf(id);
            state.openInline[id] = { reason: '', due: m ? (m.due || m.due_date || '') : '' };
        }
        render();
    }
    function setRespReason(id, v) { if (state.openInline[id]) state.openInline[id].reason = v; }
    function setRespDue(id, v) { if (state.openInline[id]) state.openInline[id].due = v; }
    function submitRespond(id) {
        var v = state.openInline[id]; if (!v) return;
        if (!v.reason.trim()) { toast('사유를 입력하세요.'); return; }
        if (!v.due) { toast('수정 처리기한을 선택하세요.'); return; }
        var m = D().improvementOf(id); if (!m) return;
        var who = D().deptName(state.deptId) + ' 담당자';
        var oldDue = m.due || m.due_date;
        D().pushImpHistory(id, { type: 'REASON', by: who, memo: '지연 사유: ' + v.reason.trim() });
        if (v.due !== oldDue) {
            m.due = v.due; m.due_date = v.due; D().saveImprovement();
            D().pushImpHistory(id, { type: 'DUE_CHANGE', by: who, memo: '기한 변경 ' + oldDue + ' → ' + v.due });
            D().pushHistory(m.assessment_id, { type: 'DUE_CHANGE', by: who, memo: (m.hazard && m.hazard.name || '') + ' 기한 ' + oldDue + ' → ' + v.due });
        }
        D().pushHistory(m.assessment_id, { type: 'REASON', by: who, memo: (m.hazard && m.hazard.name || '') + ' 사유: ' + v.reason.trim() });
        delete state.openInline[id];
        toast('재촉 응답 제출 완료'); render();
    }
    /* 완료 처리 (단일 모달) */
    function complete(id) {
        var m = D().improvementOf(id); if (!m) return;
        V().openModal('개선조치 완료 처리',
            '<div style="font-size:13px;">' +
                '<p><b>' + esc((m.hazard && m.hazard.name) || m.hazard_risk_factor || '') + '</b></p>' +
                '<p style="color:var(--text-gray);margin:6px 0 14px;">' + esc(m.description || m.action || '') + '</p>' +
                '<label style="font-size:12px;font-weight:700;color:var(--text-gray);display:block;margin-bottom:5px;">조치 내용 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<textarea class="form-textarea" id="mw-cmpl-desc" rows="3" placeholder="실제 조치한 내용을 입력하세요"></textarea>' +
            '</div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="MYWORK.doComplete(\'' + id + '\')">완료 처리</button>');
    }
    function doComplete(id) {
        var t = document.getElementById('mw-cmpl-desc');
        var v = (t && t.value || '').trim();
        if (!v) { toast('조치 내용을 입력하세요.'); return; }
        D().completeImprovement(id, v, D().deptName(state.deptId) + ' 담당자');
        V().closeModal(); toast('완료 처리 · 평가 상세에 반영'); render();
    }

    /* ================= init ================= */
    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        var q = new URLSearchParams(location.search);
        var pre = q.get('dept'); if (pre) state.deptId = pre;
        var fc = q.get('cat'); if (fc && CATS[fc]) state.fCat = fc;
        render();
    }

    global.MYWORK = {
        init: init, setDept: setDept, setStatus: setStatus, setCat: setCat, setSort: setSort, sync: sync,
        toggleRespond: toggleRespond, setRespReason: setRespReason, setRespDue: setRespDue, submitRespond: submitRespond,
        complete: complete, doComplete: doComplete
    };
})(window);
