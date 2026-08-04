/* =====================================================================
   my-work.js · 내 할일 (전역, v1.1 §6.2 · UX 개편 2026-07-21)
   ---------------------------------------------------------------------
   부서 담당자 관점의 전 업무 통합 내 할일. 위험성평가 전용이었던 rsk-my를
   승격해 결재·위험·개선·점검·의견·이행·도급·평가·교육 도메인을 한 화면에.
   레퍼런스: v1 프로토타입 myw01-v.

   [화면 구조]
   · 상단: "내 할일" · 최종 동기화 시각 · [동기화]
   · KPI 칩 5개(클릭=필터): 지연 / 오늘 마감 / 이번주 / 결재 대기 / 전체
   · 뷰 탭 3개:
       - 마감 할일   : 기한 중심 그룹(지연/이번주/예정/기타) — 미완료만
       - 발행된 업무 : 업무 목록(DY_DOCS_V2)에서 이 부서로 발행된 담당 문서
       - 완료한 업무 : 완료된 마감 할일 + 완료된 발행 업무. 첨부형은 여기서
                       [첨부 재등록]으로 추후 수정 가능 (2026-07-21 UX 개편)
   · 처리 유형(atype)별 액션 — "지금 할 수 있는 건 여기서 끝낸다":
       attach   → 팝업(단일 모달 DYV2.openModal)에서 파일 첨부 후 완료
       menu     → 해당 메뉴로 딥링크 (처리 위치 라벨 함께 표기)
       download → 설문조사표 등 즉시 다운로드 (프로토타입 토스트)
       inline   → 재촉 응답·완료 처리 등 기존 인라인 폼/모달
   · 카드 자체 클릭 = 대표 액션 실행 (menu형 이동 / attach형 첨부 팝업) —
     알림에서 넘어와 "누르면 바로 진행"되는 흐름 (버튼·링크 클릭은 제외)
   · 발행된 업무의 처리유형 매핑: 첨부파일=attach / 전자문서·프로그램=menu
   · 위험성평가·안전보건교육 실데이터 편입 + 타 카테고리 목업 시드
   · 상단 부서 셀렉트로 관점 전환 (프로토타입용) — DYV2.ORG 파생
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYRSK; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }

    /* SVG 아이콘 (Lucide 계열 stroke 2 — 이모지 구조 아이콘 금지) */
    var ICO = {
        sync: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg>',
        bell: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
        clip: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
        arrow: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
        download: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
        check: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
        pin: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/></svg>',
        eye: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
        fileText: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'
    };
    function groupDot(tone) {
        return '<span class="mw-group-dot" style="background:var(--status-' + tone + '-fg);"></span>';
    }

    /* 오늘 기준 — DYV2.today() 단일 출처 (시연일 변경은 common.js DEMO_TODAY 한 줄) */
    function todayIso() { return DYV2.today(); }
    function daysBetween(dueIso) { return DYV2.daysTo(dueIso); }
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

    /* 발행된 업무(프로그램형) menuKey → 실제 화면 딥링크 (DY_MENUS_V2 키 기준) */
    var MENU_HREF_V2 = {
        safety: 'menu.html?m=policy', risk: 'rsk-list.html', law: 'menu.html?m=comply',
        opinion: 'menu.html?m=opinion&sub=voice', edu: 'edu-status.html',
        contract: 'menu.html?m=contract', order: 'menu.html?m=contract',
        emergency: 'docs-archive.html', incident: 'docs-archive.html'
    };

    /* 타 도메인 목업 시드 — atype: 처리 유형 / destLabel: 이동 목적지 라벨 */
    function otherSeeds() {
        return [
            /* 결재 — 메뉴 이동형 */
            { id: 'A-01', cat: 'approval',   title: '안전·보건 목표와 경영방침 결재 요청 (온나라 상신)',
              due: '2026-07-18', dept: 'safety', dept_label: '재난안전과',
              atype: 'menu', href: 'menu.html?m=policy', action: '검토하러 가기', destLabel: '경영방침' },
            { id: 'A-02', cat: 'approval',   title: '2026 하반기 안전보건 예산 편성안 결재',
              due: '2026-07-22', dept: 'plan', dept_label: '기획예산실',
              atype: 'menu', href: 'bgt-main.html', action: '결재하러 가기', destLabel: '예산 총괄표' },
            /* 점검 */
            { id: 'I-01', cat: 'inspection', title: '기준문서함 2차 검토 대상 16건 분류 확인',
              due: '2026-07-19', dept: 'safety', dept_label: '재난안전과',
              atype: 'menu', href: 'docs-archive.html', action: '분류하러 가기', destLabel: '기준문서함' },
            { id: 'I-02', cat: 'inspection', title: '공중이용시설 안전점검 결과 정리 (담양읍 문화의전당)',
              due: '2026-07-17', dept: 'culture', dept_label: '문화체육과',
              atype: 'menu', href: 'fac-list.html', action: '처리하러 가기', destLabel: '시설물 대장' },
            /* 의견 — 파일 첨부형 (회의록 첨부로 완료) */
            { id: 'O-01', cat: 'opinion',    title: '산업안전보건위원회 반기 회의록 등록',
              sub: '서명된 회의록 스캔본을 첨부하면 완료됩니다',
              due: '2026-07-15', dept: 'safety', dept_label: '재난안전과',
              atype: 'attach', href: 'menu.html?m=opinion&sub=committee', destLabel: '산업안전보건위원회' },
            /* 이행 */
            { id: 'C-01', cat: 'comply',     title: '의무이행 점검표 반기 마감 (D+8 기한초과)',
              due: '2026-07-08', dept: 'safety', dept_label: '재난안전과',
              atype: 'menu', href: 'menu.html?m=comply', action: '점검표 작성', destLabel: '이행점검' },
            { id: 'C-02', cat: 'comply',     title: '안전보건교육 상반기 실시 결과 정리',
              due: '2026-07-25', dept: 'safety', dept_label: '재난안전과',
              atype: 'menu', href: 'edu-status.html', action: '보러 가기', destLabel: '이수현황' },
            /* 도급 — 파일 첨부형 (점검표 첨부로 완료) */
            { id: 'K-01', cat: 'contract',   title: '도급사업 안전보건 점검표 제출 (군도 5호선)',
              sub: '현장 점검표(서명본)를 첨부하면 완료됩니다',
              due: '2026-07-30', dept: 'construct', dept_label: '건설과',
              atype: 'attach', href: 'menu.html?m=contract', destLabel: '도급관리' },
            { id: 'K-02', cat: 'contract',   title: '용역계약 재해예방 조치 검토',
              due: '2026-08-05', dept: 'acct', dept_label: '회계과',
              atype: 'menu', href: 'menu.html?m=contract', action: '검토하러 가기', destLabel: '도급관리' },
            /* 평가 */
            { id: 'E-01', cat: 'eval',       title: '2026년 반기 인력평가 응답 (안전보건관리책임자)',
              due: '2026-07-31', dept: 'safety', dept_label: '재난안전과',
              atype: 'menu', href: 'evl-eval.html', action: '평가하러 가기', destLabel: '인력 평가' }
        ];
    }

    var state = {
        mount: null, deptId: '',
        view: 'due',                    /* 'due' 마감 할일 | 'pub' 발행된 업무 | 'done' 완료한 업무 */
        doneMore: false,                /* 완료한 발행 업무 전체 펼침 여부 */
        fStatus: '', fCat: '', sort: 'due',
        openInline: {},                 /* {impId: {reason, due}} 재촉 응답 */
        attachCtx: null,                /* {id, kind:'seed'|'pub', redo} 열려있는 첨부 팝업 */
        attachFiles: {},                /* {itemId: [파일명,...]} 선택된 모의 파일 */
        doneSeeds: {},                  /* {seedId: {at, files}} 첨부로 완료한 시드 */
        pubFiles: {},                   /* {docId: [파일명,...]} 발행 업무 첨부 완료본 (재등록용) */
        pubType: '', pubStatus: 'open', /* 발행 업무 필터 (open=미시행+진행) */
        /* 개선조치 완료 모달 입력 보존 — cmplPhotos 는 썸네일을 가진 파일 객체 배열 */
        cmplId: null, cmplDesc: '', cmplPhoto: '', cmplPhotos: [], cmplSign: '', cmplDate: '',
        syncedAt: '2026-07-16 09:15'
    };

    /* ================= 아이템 수집 (마감 할일) ================= */
    function collectItems() {
        var out = [];
        /* 위험성평가 실데이터 — 점검예정 (카테고리 '위험') */
        try {
            (D().assessments() || []).forEach(function (a) {
                var closed = a.status === 'COMPLETED';
                (a.depts || []).forEach(function (dp) {
                    if (dp.deptId !== state.deptId) return;
                    /* 끝난 평가는 할 일이 아니다 — 다만 **제출한 기록**은 완료한 업무 탭에
                       남아야 한다. 끝났다고 지우면 소명할 자료가 사라진다. */
                    if (closed && !dp.reportFile) return;
                    var f = dp.surveyFile || (a.files && a.files.surveyAll) || '';
                    /* 부서가 정기평가에서 실제로 하는 일은 '점검일에 참여'가 아니라
                     * **설문조사표를 작성해 제출**하는 것이다. 종전에는 양식 다운로드만 있고
                     * 제출 경로가 주관부서 화면에만 있어, 담당자가 자기 화면에서 끝낼 수 없었다. */
                    var done = !!dp.reportFile;
                    out.push({
                        id: 'RSK-' + a.id + '-' + dp.deptId + '-report',
                        cat: 'risk',
                        title: a.title + ' — 유해위험요인 설문조사표 작성·제출',
                        sub: (dp.inspectDate ? '점검일 ' + dp.inspectDate + ' · ' : '') +
                             '양식 ' + (f || '미배포') +
                             (done ? ' · 제출 ' + esc(dp.reportFile) : ''),
                        due: dp.inspectDate || '',
                        status: done ? 'DONE' : 'IN_PROGRESS',
                        dept: dp.deptId, dept_label: D().deptName(dp.deptId),
                        href: 'rsk-list.html?year=' + a.year,
                        atype: 'rskreport',
                        rsk: { aid: a.id, deptId: dp.deptId, form: f, file: dp.reportFile || '' },
                        doneDate: dp.reportAt || '',
                        doneBy: dp.reportBy || '',
                        doneText: done ? '제출본 ' + dp.reportFile : '',
                        destLabel: '정기 위험성평가',
                        remind: false
                    });
                });
            });
        } catch (e) {}
        /* 위험성평가 실데이터 — 전달받은 개선조치 (카테고리 '개선') */
        try {
            D().improvements().filter(function (m) { return m.dept_id === state.deptId; }).forEach(function (m) {
                var isRemind = (m.history || []).some(function (h) { return h.type === 'REMIND'; }) && m.status !== 'DONE';
                /* 확인 반려 건은 status 가 DONE 이어도 담당자가 **다시 제출해야 한다**.
                 * 판정은 DYRSK.needsAction 한 곳에서만 한다(화면이 재구현하지 않는다). */
                var cf = D().confirmOf(m);
                var returned = D().confirmState(m) === 'RETURNED';
                var act = D().needsAction(m);
                out.push({
                    id: 'IMP-' + m.id,
                    cat: 'improve',
                    title: (m.hazard && m.hazard.name) || m.hazard_risk_factor || '개선조치',
                    sub: m.description || m.action || '',
                    due: m.due || m.due_date || '',
                    /* 반려 건은 '할 일'로 되돌린다 — 완료 탭에 묻히면 담당자가 영원히 못 본다 */
                    status: act ? 'IN_PROGRESS' : 'DONE',
                    returned: returned, returnReason: cf.reason || '', returnBy: cf.by || '', returnAt: cf.at || '',
                    round: cf.round || 1,
                    basis: (m.hazard && m.hazard.basis) || '',
                    dept: m.dept_id, dept_label: D().deptName(m.dept_id),
                    href: 'rsk-list.html' + (m.assessment_id ? '?year=' + (m.assessment_id.match(/RA-(\d{4})/) || [])[1] : ''),
                    atype: 'inline',
                    action: returned ? '재제출' : (act ? (isRemind ? '재촉 응답' : '완료 처리') : '보기'),
                    remind: isRemind,
                    impId: m.id,
                    /* 완료 사실 — '완료했다'만으로는 소명이 안 된다. 언제·누가·무엇을 했고
                       증빙이 무엇인지가 함께 있어야 완료한 업무 탭이 기록으로 쓸모가 있다. */
                    doneDate: m.completed_date || '',
                    doneBy: (m.signature && m.signature.by) || '',
                    doneText: m.action_content || '',
                    shots: (global.IMPCARD ? IMPCARD.photoItems(m, 'after') : (m.after_photos || []))
                });
            });
        } catch (e) {}
        /* 안전보건교육 실데이터 — 집합교육 신청 가능 · 독촉받은 미이수 */
        try {
            var Edu = global.DYEDU;
            if (Edu) {
                var enrolls = Edu.enrolls();
                Edu.courses({ status: 'OPEN' }).forEach(function (c) {
                    if (c.kind !== 'REG_GROUP' && c.kind !== 'SUP_REG') return;
                    var applied = enrolls.some(function (e) { return e.courseId === c.id && e.deptId === state.deptId; });
                    if (applied) return;
                    out.push({
                        id: 'EDU-APPLY-' + c.id,
                        cat: 'edu',
                        title: c.desc + ' — 참석자 등록부 등록 필요',
                        sub: '일정 ' + c.date + ' · ' + c.hours + 'h · ' + (c.instructor || ''),
                        due: c.date,
                        status: 'IN_PROGRESS',
                        dept: state.deptId, dept_label: Edu.deptName(state.deptId),
                        href: 'edu-reg.html',
                        atype: 'menu', action: '신청하러 가기', destLabel: '정기교육', remind: false
                    });
                });
                Edu.reminders().forEach(function (r) {
                    if (r.deptId !== state.deptId) return;
                    (r.workerIds || []).forEach(function (wid) {
                        var w = Edu.workerOf(wid); if (!w) return;
                        var sr = Edu.statusRow(w, Edu.TODAY);
                        if (sr.complete) return;
                        out.push({
                            id: 'EDU-REMIND-' + wid + '-' + r.at,
                            cat: 'edu',
                            title: w.name + ' — 안전보건교육 미이수 (독촉)',
                            sub: '필요 ' + sr.need + 'h · 인정 ' + sr.done + 'h · 미달 ' + sr.short + 'h · ' + r.memo,
                            due: sr.cycle.end,
                            status: 'IN_PROGRESS',
                            dept: state.deptId, dept_label: Edu.deptName(state.deptId),
                            href: 'edu-reg.html',
                            atype: 'menu', action: '자체교육 진행', destLabel: '정기교육', remind: true
                        });
                    });
                });
            }
        } catch (e) {}
        /* 타 도메인 목업 시드 — 첨부 완료한 시드는 DONE 으로 표시 */
        otherSeeds().forEach(function (s) {
            if (s.dept !== state.deptId) return;
            var doneRec = state.doneSeeds[s.id];
            out.push({
                id: s.id, cat: s.cat, title: s.title,
                sub: doneRec ? ('첨부 완료 · ' + doneRec.files.join(', ')) : (s.sub || ''),
                due: s.due,
                status: doneRec ? 'DONE' : 'IN_PROGRESS',
                dept: s.dept, dept_label: s.dept_label,
                href: s.href, atype: s.atype, action: s.action, destLabel: s.destLabel,
                remind: false
            });
        });
        return out;
    }

    /* ================= 발행된 업무 (DY_DOCS_V2) ================= */
    function pubDocs() {
        var deptName = '';
        try { deptName = D().deptName(state.deptId) || ''; } catch (e) {}
        var all = global.DY_DOCS_V2 || [];
        return all.filter(function (d) { return d.dept === deptName; });
    }
    function pubFiltered(docs) {
        var arr = docs.filter(function (d) {
            if (state.pubType && d.processType !== state.pubType) return false;
            if (state.pubStatus === 'open' && d.status === '완료') return false;
            if (state.pubStatus && state.pubStatus !== 'open' && d.status !== state.pubStatus) return false;
            return true;
        });
        var rank = { '미시행': 0, '진행': 1, '완료': 2 };
        arr.sort(function (a, b) {
            var r = (rank[a.status] || 0) - (rank[b.status] || 0);
            if (r !== 0) return r;
            return (b.updated || '').localeCompare(a.updated || '');
        });
        return arr;
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

    /* ================= 필터·정렬 (마감 할일) ================= */
    function filterAndSort(items) {
        var arr = items.filter(function (it) {
            if (state.fStatus) {
                var d = daysBetween(it.due);
                if (state.fStatus === 'overdue' && !(d != null && d < 0 && it.status !== 'DONE')) return false;
                if (state.fStatus === 'today' && !(d === 0 && it.status !== 'DONE')) return false;
                if (state.fStatus === 'week' && !(d != null && d >= 0 && d <= 7 && it.status !== 'DONE')) return false;
                if (state.fStatus === 'progress' && it.status !== 'IN_PROGRESS') return false;
                if (state.fStatus === 'plan' && !(d != null && d > 7)) return false;
            }
            if (state.fCat && it.cat !== state.fCat) return false;
            return true;
        });
        arr.sort(function (a, b) {
            if (state.sort === 'category') {
                if (a.cat !== b.cat) return (CATS[a.cat] ? CATS[a.cat].label : '').localeCompare(CATS[b.cat] ? CATS[b.cat].label : '');
                return (a.due || '').localeCompare(b.due || '');
            }
            var da = daysBetween(a.due), db = daysBetween(b.due);
            if (da == null && db == null) return 0;
            if (da == null) return 1;
            if (db == null) return -1;
            return da - db;
        });
        return arr;
    }

    /* ================= 그룹 — DONE 은 '완료한 업무' 탭으로 분리 ================= */
    var GROUPS = [
        { key: 'overdue', label: '지연',   tone: 'danger'  },
        { key: 'week',    label: '이번주', tone: 'warning' },
        { key: 'plan',    label: '예정',   tone: 'success' },
        { key: 'other',   label: '기타',   tone: 'neutral' }
    ];

    /* ================= 렌더 ================= */
    /* ===== 처리 권한 =====
     * 이 화면의 처리 액션(완료 처리·전자서명·제출·첨부)은 **그 부서 담당자 본인**만 한다.
     *   · 군수·실과장이 담당자 이름으로 완료 서명하면 그건 문서 위조다.
     *   · 담당자라도 **다른 부서**를 골라 보는 중이면 처리는 막는다.
     * 조회는 막지 않는다 — 진행 상황을 보는 것은 총괄·감독의 정당한 권한이다. */
    function canAct() {
        var p = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        if (!p) return true;                        /* 롤 스위처가 없는 환경은 종전대로 */
        if (p.tier !== 'staff') return false;       /* 총괄·관리감독자는 조회 전용 */
        return !!p.deptId && p.deptId === state.deptId;
    }
    function readOnlyNote() {
        var p = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        if (!p || canAct()) return '';
        var why = p.tier === 'head'
            ? '총괄 책임자는 전 부서 진행 상황을 <b>조회</b>합니다. 처리는 각 부서 담당자가 수행합니다.'
            : (p.tier === 'super'
                ? '관리감독자는 소속 부서 진행 상황을 <b>조회</b>합니다. 완료 처리·전자서명은 <b>담당자 본인</b>이 수행합니다.'
                : '지금 보고 있는 부서는 <b>' + esc(D().deptName(state.deptId) || '') + '</b>입니다 — ' +
                  '내 소속(<b>' + esc(p.deptName || '') + '</b>)이 아니라 조회만 됩니다.');
        return '<div class="mw-readonly" role="note">' + ICO.eye + ' <span><b>조회 전용</b> — ' + why + '</span></div>';
    }

    /* 기본 부서는 '목록 첫 번째'가 아니라 **로그인한 사람의 소속 부서**다.
       권한 전환으로 부서 담당자가 되면 자기 부서 일이 바로 보여야 한다(?dept= 가 있으면 그게 우선). */
    function defaultDeptId(depts) {
        var mine = global.DYROLE && global.DYROLE.deptId ? global.DYROLE.deptId() : '';
        if (mine && depts.some(function (d) { return d.id === mine; })) return mine;
        return depts[0] && depts[0].id;
    }
    /* 관점 전환으로 갈 수 있는 부서 — **조회 범위 안**으로만 좁힌다(DYROLE.scope, layout.js).
       종전에는 11개 부서가 전원에게 열려 있어 물순환사업소 주무관이 재난안전과 할 일을
       열람할 수 있었다. 군수·재난안전과는 전 부서를 봐야 하므로 그대로 둔다. */
    function scopedDepts(depts) {
        var R = global.DYROLE;
        if (!R || !R.scope) return depts;
        var s = R.scope();
        if (s === 'all') return depts;
        var only = depts.filter(function (d) { return d.id === s; });
        /* 소속 부서가 후보에 없으면(데이터 0건) 이름만이라도 만들어 준다 — 빈 select 는 고장으로 읽힌다 */
        if (!only.length) {
            var n = V().orgNode(s);
            if (n) only = [{ id: s, name: n.name }];
        }
        return only.length ? only : depts;
    }
    function render() {
        if (!state.mount) return;
        var depts = scopedDepts(candidateDepts());
        /* 범위 밖 부서가 이미 물려 있으면(딥링크·이전 세션) 소속으로 되돌린다 */
        if (!state.deptId || !depts.some(function (d) { return d.id === state.deptId; })) {
            state.deptId = defaultDeptId(depts);
        }

        var items = collectItems();
        var k = kpis(items);
        var pubs = pubDocs();
        var pubOpenN = pubs.filter(function (d) { return d.status !== '완료'; }).length;

        var deptOpts = depts.map(function (d) { return '<option value="' + d.id + '"' + (d.id === state.deptId ? ' selected' : '') + '>' + esc(d.name) + '</option>'; }).join('');

        var head =
            '<div class="mw-head">' +
                '<div class="mw-head-left">' +
                    '<h2 class="mw-title">내 할일</h2>' +
                    '<span class="mw-synced">최종 동기화 <b>' + esc(state.syncedAt) + '</b></span>' +
                    '<button type="button" class="btn btn-outline btn-sm" onclick="MYWORK.sync()">' + ICO.sync + ' 동기화</button>' +
                '</div>' +
                '<div class="mw-head-right">' +
                    /* 고를 수 있는 부서가 하나뿐이면 select 를 띄우지 않는다 —
                       선택지가 1개인 드롭다운은 '더 있는데 안 나온다'로 읽힌다 */
                    (depts.length > 1
                        ? '<label class="mw-deptlabel" for="mw-dept-sel">부서 (관점 전환)</label>' +
                          '<select id="mw-dept-sel" class="form-select" onchange="MYWORK.setDept(this.value)">' + deptOpts + '</select>'
                        : '<span class="mw-deptlabel">부서</span>' +
                          '<b class="mw-deptfixed">' + esc((depts[0] && depts[0].name) || '') + '</b>') +
                '</div>' +
            '</div>';

        var kpi =
            '<div class="mw-kpis">' +
                kpiChip('danger',  '지연',      k.overdue, 'overdue') +
                kpiChip('warning', '오늘 마감', k.today,   'today') +
                kpiChip('info',    '이번주',    k.week,    'week') +
                kpiChip('purple',  '결재 대기', k.approval, 'approval') +
                kpiChip('neutral', '전체',      k.total,   '') +
            '</div>';

        var doneN = items.filter(function (i) { return i.status === 'DONE'; }).length +
                    pubs.filter(function (d) { return d.status === '완료'; }).length;
        var tabs =
            '<div class="tabs mw-tabs">' +
                '<button type="button" class="tab' + (state.view === 'due' ? ' active' : '') + '" onclick="MYWORK.setView(\'due\')">마감 할일 <span class="mw-tab-n">' + items.filter(function (i) { return i.status !== 'DONE'; }).length + '</span></button>' +
                '<button type="button" class="tab' + (state.view === 'pub' ? ' active' : '') + '" onclick="MYWORK.setView(\'pub\')">발행된 업무 <span class="mw-tab-n">' + pubOpenN + '</span></button>' +
                '<button type="button" class="tab' + (state.view === 'done' ? ' active' : '') + '" onclick="MYWORK.setView(\'done\')">완료한 업무 <span class="mw-tab-n">' + doneN + '</span></button>' +
            '</div>';

        var body = state.view === 'pub' ? renderPub(pubs)
                 : state.view === 'done' ? renderDone(items, pubs)
                 : renderDue(items);

        state.mount.innerHTML = head + readOnlyNote() + kpi + tabs + body;
    }

    /* ---- 마감 할일 뷰 (미완료만 — 완료는 '완료한 업무' 탭) ---- */
    function renderDue(items) {
        items = items.filter(function (i) { return i.status !== 'DONE'; });
        var view = filterAndSort(items);

        var catOpts = '<option value="">전체 카테고리</option>' +
            Object.keys(CATS).map(function (k2) { return '<option value="' + k2 + '"' + (state.fCat === k2 ? ' selected' : '') + '>' + esc(CATS[k2].label) + '</option>'; }).join('');
        var filters =
            '<div class="mw-filters">' +
                '<select class="form-select" aria-label="상태 필터" onchange="MYWORK.setStatus(this.value)">' +
                    '<option value="">상태 전체</option>' +
                    '<option value="overdue"'  + (state.fStatus === 'overdue'  ? ' selected' : '') + '>지연</option>' +
                    '<option value="today"'    + (state.fStatus === 'today'    ? ' selected' : '') + '>오늘 마감</option>' +
                    '<option value="week"'     + (state.fStatus === 'week'     ? ' selected' : '') + '>이번주</option>' +
                    '<option value="progress"' + (state.fStatus === 'progress' ? ' selected' : '') + '>진행</option>' +
                    '<option value="plan"'     + (state.fStatus === 'plan'     ? ' selected' : '') + '>예정</option>' +
                '</select>' +
                '<select class="form-select" aria-label="카테고리 필터" onchange="MYWORK.setCat(this.value)">' + catOpts + '</select>' +
                '<select class="form-select" aria-label="정렬" onchange="MYWORK.setSort(this.value)">' +
                    '<option value="due"'      + (state.sort === 'due'      ? ' selected' : '') + '>마감 임박순</option>' +
                    '<option value="category"' + (state.sort === 'category' ? ' selected' : '') + '>카테고리순</option>' +
                '</select>' +
                ((state.fStatus || state.fCat)
                    ? '<button type="button" class="btn btn-sm btn-outline" onclick="MYWORK.kpiFilter(\'\')">필터 해제</button>' : '') +
                (view.length !== items.length
                    ? '<span class="mw-filter-count">' + view.length + ' / ' + items.length + '건 표시</span>'
                    : '<span class="mw-filter-count">' + items.length + '건</span>') +
            '</div>';

        var groupHtml = '';
        var grouped = {};
        GROUPS.forEach(function (g) { grouped[g.key] = []; });
        view.forEach(function (it) { (grouped[bucket(it.due, it.status)] || grouped.other).push(it); });

        GROUPS.forEach(function (g) {
            var list = grouped[g.key];
            if (!list.length) return;
            groupHtml += '<div class="mw-group mw-g-' + g.tone + (g.key === 'done' ? ' mw-g-done' : '') + '">' +
                '<div class="mw-group-head">' + groupDot(g.tone) +
                    '<span class="mw-group-label">' + g.label + '</span>' +
                    '<span class="mw-group-count">' + list.length + '건</span>' +
                '</div>' +
                '<div class="mw-group-body">' +
                    list.map(itemHtml).join('') +
                '</div>' +
            '</div>';
        });
        if (!view.length) {
            groupHtml = '<div class="mw-empty">조건에 맞는 할일이 없습니다.' +
                ((state.fStatus || state.fCat) ? ' <button type="button" class="btn btn-sm btn-outline" onclick="MYWORK.kpiFilter(\'\')">필터 해제</button>' : '') +
                '</div>';
        }
        return filters + groupHtml;
    }

    function kpiChip(tone, label, num, filterKey) {
        var active = filterKey ? (filterKey === 'approval' ? state.fCat === 'approval' : state.fStatus === filterKey)
                               : (!state.fStatus && !state.fCat);
        return '<button type="button" class="mw-kpi mw-kpi-' + tone + (active ? ' active' : '') + '"' +
            ' onclick="MYWORK.kpiFilter(\'' + filterKey + '\')" aria-pressed="' + (active ? 'true' : 'false') + '"' +
            ' title="클릭하면 해당 조건으로 필터링합니다">' +
            '<span class="mw-kpi-num">' + num + '</span><span class="mw-kpi-label">' + label + '</span></button>';
    }

    /* ---- 마감 할일 아이템 ---- */
    function itemHtml(it) {
        var meta = CATS[it.cat] || { label: it.cat, color: 'var(--text-gray)', bg: 'var(--gray-200)' };
        var dTxt = dDayText(it.due, it.status);
        var dCls = 'mw-dday';
        var dNum = daysBetween(it.due);
        if (it.status === 'DONE') dCls += ' done';
        else if (dNum != null && dNum < 0) dCls += ' over';
        else if (dNum != null && dNum <= 3) dCls += ' soon';

        var actionBtn = actionButtons(it);
        var subLine = it.sub ? '<div class="mw-item-sub">' + esc(it.sub) + '</div>' : '';
        /* 법령 근거 — 카드 자체가 대표 액션을 실행하므로 칩은 전파를 끊는다(원문만 펼침).
           조문 번호만으로는 이유를 알 수 없어 조문 제목을 함께 보여준다. */
        var basisRow = '';
        if (it.basis && window.DYLAW) {
            basisRow = '<div class="mw-item-basis">' +
                '<span class="mw-item-basis-lead">근거</span>' +
                DYLAW.basisChip(it.basis, { withTitle: true }) +
            '</div>';
        }
        var remindTag = it.remind ? '<span class="mw-remind-tag">' + ICO.bell + ' 재촉</span> ' : '';
        var catBadge = '<span class="mw-cat" style="color:' + meta.color + ';background:' + meta.bg + ';">' + esc(meta.label) + '</span>';
        var destChip = (it.atype === 'menu' && it.destLabel)
            ? '<span class="mw-dest">' + ICO.arrow + ' ' + esc(it.destLabel) + '에서 진행</span>' : '';

        var head =
            '<div class="mw-item-head">' +
                '<div class="mw-item-main">' +
                    catBadge + ' ' + remindTag +
                    '<span class="mw-item-title">' + esc(it.title) + '</span>' +
                    subLine +
                    basisRow +
                    '<div class="mw-item-meta">' +
                        '<span class="' + dCls + '">' + esc(dTxt) + '</span>' +
                        (it.due ? '<span class="mw-item-due">' + esc(it.due) + '</span>' : '') +
                        (it.dept_label ? '<span class="mw-item-dept">' + esc(it.dept_label) + '</span>' : '') +
                        destChip +
                    '</div>' +
                '</div>' +
                '<div class="mw-item-actions">' + actionBtn + '</div>' +
            '</div>';

        var inline = '';
        /* 확인 반려 — 무엇을 왜 다시 해야 하는지가 담당자 화면에 도착해야 반려가 작동한다 */
        if (it.returned) {
            inline += '<div class="mw-returned" role="note">' +
                '<b>재난안전과 반려</b> · ' + esc(it.returnAt) + ' · ' + esc(it.returnBy) +
                (it.round > 1 ? ' <span class="mw-returned-r">' + it.round + '회차 제출</span>' : '') +
                '<p>' + esc(it.returnReason) + '</p>' +
                '<span class="mw-returned-how">증빙을 보완해 <b>재제출</b>하면 확인 대기로 돌아갑니다.</span>' +
            '</div>';
        }
        /* 재촉 응답 인라인 폼 */
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
        /* 카드 자체 클릭 = 대표 액션 (menu형 이동 · attach형 첨부 팝업) */
        var cardAct = '';
        if (it.status !== 'DONE' && canAct()) {
            if (it.atype === 'rskreport') cardAct = ' onclick="MYWORK.openReport(\'' + it.rsk.aid + '\',\'' + it.rsk.deptId + '\',event)"';
            else if (it.atype === 'attach') cardAct = ' onclick="MYWORK.cardAttach(\'' + it.id + '\',\'seed\',event)"';
            else if (it.atype === 'menu' && it.href) cardAct = ' onclick="MYWORK.go(\'' + esc(it.href) + '\',event)"';
        }

        return '<div class="mw-item' + (it.remind ? ' remind' : '') + (it.status === 'DONE' ? ' is-done' : '') +
            (cardAct ? ' mw-click' : '') + '"' + cardAct + '>' + head + inline + '</div>';
    }

    function actionButtons(it) {
        /* 처리 권한이 없으면 액션 대신 '보기' 만 — 눌러도 막힐 버튼을 띄우지 않는다
           (없는 권한을 시각적으로 약속하지 않는다) */
        if (!canAct()) {
            if (it.impId) {
                return '<button type="button" class="btn btn-outline btn-sm" onclick="MYWORK.openDone(\'' + it.impId + '\')">상세 보기</button>';
            }
            return it.href
                ? '<a class="btn btn-outline btn-sm" href="' + esc(it.href) + '">보기 ' + ICO.arrow + '</a>'
                : '';
        }
        /* 개선조치 (인라인 폼/모달) */
        if (it.impId && it.remind) {
            return '<button type="button" class="btn btn-outline btn-sm" onclick="MYWORK.toggleRespond(\'' + it.impId + '\')">' +
                (state.openInline[it.impId] ? '응답 닫기' : '재촉 응답') + '</button>' +
                ' <button type="button" class="btn btn-primary btn-sm" onclick="MYWORK.complete(\'' + it.impId + '\')">완료 처리</button>';
        }
        if (it.impId && it.status !== 'DONE') {
            return '<button type="button" class="btn btn-primary btn-sm" data-tour="mw-improve" onclick="MYWORK.complete(\'' + it.impId + '\')">' +
                (it.returned ? '재제출' : '완료 처리') + '</button>';
        }
        if (it.impId) {
            return '<a class="btn btn-outline btn-sm" href="' + esc(it.href) + '">보기</a>';
        }
        /* 정기평가 설문조사표 — 양식 받기 + 작성본 제출(실제 파일)을 이 자리에서 끝낸다 */
        if (it.atype === 'rskreport') {
            var call = "MYWORK.openReport('" + it.rsk.aid + "','" + it.rsk.deptId + "',event)";
            if (it.status === 'DONE') {
                return '<span class="mw-done-mark">' + ICO.check + ' 제출 완료</span>' +
                    ' <button type="button" class="btn btn-outline btn-sm" onclick="' + call + '">' +
                    ICO.clip + ' 교체</button>';
            }
            return '<button type="button" class="btn btn-primary btn-sm" data-tour="mw-rskreport" onclick="' + call + '">' +
                ICO.clip + ' 작성본 제출</button>';
        }
        /* 파일 첨부형 — 팝업(모달)에서 첨부해 완료 · 완료 후엔 재등록 가능 */
        if (it.atype === 'attach') {
            if (it.status === 'DONE') {
                return '<span class="mw-done-mark">' + ICO.check + ' 첨부 완료</span>' +
                    ' <button type="button" class="btn btn-outline btn-sm" onclick="MYWORK.openAttach(\'' + it.id + '\',\'seed\',true)">' +
                    ICO.clip + ' 첨부 재등록</button>';
            }
            return '<button type="button" class="btn btn-primary btn-sm" onclick="MYWORK.openAttach(\'' + it.id + '\',\'seed\')">' +
                ICO.clip + ' 파일 첨부</button>';
        }
        /* 다운로드형 */
        if (it.atype === 'download' && it.onclick) {
            return '<button type="button" class="btn btn-outline btn-sm" onclick="' + it.onclick + '">' + ICO.download + ' ' + esc(it.action || '다운로드') + '</button>';
        }
        /* 메뉴 이동형 */
        if (it.href) {
            return '<a class="btn btn-outline btn-sm" href="' + esc(it.href) + '">' + esc(it.action || '보기') + ' ' + ICO.arrow + '</a>';
        }
        return '';
    }

    /* ---- 파일 첨부 팝업 (단일 모달 DYV2.openModal — 마감 할일 시드 · 발행 업무 공용) ----
       kind: 'seed' → doneSeeds 완료 / 'pub' → DY_DOCS_V2 status 갱신
       redo: true → 완료 건 첨부 재등록 (기존 파일을 새 첨부로 교체) */
    function attachItemTitle(ctx) {
        if (ctx.kind === 'pub') {
            var d = (global.DY_DOCS_V2 || []).find(function (x) { return x.id === ctx.id; });
            return d ? d.name : '';
        }
        var s = otherSeeds().filter(function (x) { return x.id === ctx.id; })[0];
        return s ? s.title : '';
    }
    function attachBodyHtml() {
        var ctx = state.attachCtx; if (!ctx) return '';
        var files = state.attachFiles[ctx.id] || [];
        var filePills = files.map(function (f, i) {
            return '<span class="mw-file-pill">' + ICO.fileText + ' ' + esc(f) +
                '<button type="button" class="mw-file-x" aria-label="' + esc(f) + ' 제거" onclick="MYWORK.removeFile(\'' + ctx.id + '\',' + i + ')">&times;</button></span>';
        }).join('');
        return '<div class="mw-attach">' +
            '<p class="mw-attach-target">' + esc(attachItemTitle(ctx)) + '</p>' +
            (ctx.redo ? '<p class="mw-attach-note">첨부 완료를 유지한 채 파일만 교체합니다. [재등록 완료]를 누르면 아래 목록이 새 첨부본으로 저장됩니다.</p>' : '') +
            V().uploadDrop('파일을 끌어다 놓거나 클릭하여 선택',
                "MYWORK.pickFile('" + ctx.id + "')", { hint: true }) +
            (files.length ? '<div class="mw-file-list">' + filePills + '</div>' : '') +
            '<div class="mw-inline-foot" style="margin-top:12px;">' +
                '<button type="button" class="btn btn-secondary btn-sm" onclick="DYV2.closeModal()">취소</button>' +
                '<button type="button" class="btn btn-primary btn-sm"' + (files.length ? '' : ' disabled') +
                    ' onclick="MYWORK.submitAttach()">' +
                    ICO.check + ' ' + (ctx.redo ? '재등록 완료' : '첨부 완료') + (files.length ? ' (' + files.length + ')' : '') + '</button>' +
            '</div>' +
        '</div>';
    }
    function renderAttachModal() {
        var el = document.getElementById('mw-attach-body');
        if (el) el.innerHTML = attachBodyHtml();
    }
    function openAttach(id, kind, redo) {
        redo = !!redo;
        if (redo) {
            var existing = kind === 'pub' ? state.pubFiles[id]
                : (state.doneSeeds[id] && state.doneSeeds[id].files);
            state.attachFiles[id] = (existing || []).slice();
        } else {
            state.attachFiles[id] = state.attachFiles[id] || [];
        }
        state.attachCtx = { id: id, kind: kind, redo: redo };
        V().openModal(redo ? '첨부파일 재등록' : '파일 첨부',
            '<div id="mw-attach-body">' + attachBodyHtml() + '</div>');
    }
    /* 카드 자체 클릭 핸들러 — 내부 버튼·링크 클릭은 그대로 통과 */
    function go(href, ev) {
        if (ev && ev.target.closest('a,button,input,textarea,label,.mw-inline')) return;
        window.location.href = href;
    }
    function cardAttach(id, kind, ev) {
        if (ev && ev.target.closest('a,button,input,textarea,label,.mw-inline')) return;
        openAttach(id, kind, false);
    }

    /* ---- 발행된 업무 뷰 ---- */
    function renderPub(pubs) {
        var deptName = '';
        try { deptName = D().deptName(state.deptId) || ''; } catch (e) {}
        if (!pubs.length) {
            return '<div class="mw-empty"><b>' + esc(deptName) + '</b> 부서로 발행된 업무가 없습니다.<br>' +
                '<span style="color:var(--text-gray);">업무 목록에서 세트를 발행하면 담당 부서의 내 할일에 나타납니다.</span><br><br>' +
                '<a class="btn btn-sm btn-outline" href="docs-preset.html">업무 목록 열기 ' + ICO.arrow + '</a></div>';
        }
        var counts = { all: 0, '첨부파일': 0, '전자문서': 0, '프로그램': 0 };
        pubs.forEach(function (d) { if (d.status !== '완료') { counts.all++; counts[d.processType] = (counts[d.processType] || 0) + 1; } });

        var typeChip = function (t, label, n) {
            return '<button type="button" class="mw-pub-chip' + (state.pubType === t ? ' active' : '') + '"' +
                ' onclick="MYWORK.setPubType(\'' + t + '\')" aria-pressed="' + (state.pubType === t ? 'true' : 'false') + '">' +
                label + ' <b>' + n + '</b></button>';
        };
        var filters =
            '<div class="mw-filters">' +
                '<div class="mw-pub-chips" role="group" aria-label="처리유형 필터">' +
                    typeChip('', '전체', counts.all) +
                    typeChip('첨부파일', '바로 첨부', counts['첨부파일']) +
                    typeChip('전자문서', '양식 작성', counts['전자문서']) +
                    typeChip('프로그램', '메뉴 진행', counts['프로그램']) +
                '</div>' +
                '<select class="form-select" aria-label="상태 필터" onchange="MYWORK.setPubStatus(this.value)">' +
                    '<option value="open"' + (state.pubStatus === 'open' ? ' selected' : '') + '>미완료만</option>' +
                    '<option value="미시행"' + (state.pubStatus === '미시행' ? ' selected' : '') + '>미시행</option>' +
                    '<option value="진행"'   + (state.pubStatus === '진행' ? ' selected' : '') + '>진행</option>' +
                    '<option value=""'       + (state.pubStatus === '' ? ' selected' : '') + '>완료 포함 전체</option>' +
                '</select>' +
                '<a class="btn btn-sm btn-outline" href="docs-preset.html" style="margin-left:auto;">업무 목록 ' + ICO.arrow + '</a>' +
            '</div>';

        var view = pubFiltered(pubs);
        var rows = view.map(pubItemHtml).join('');
        if (!view.length) rows = '<div class="mw-empty">조건에 맞는 발행 업무가 없습니다.</div>';

        var note =
            '<div class="mw-pub-note">업무 목록에서 <b>' + esc(deptName) + '</b>로 발행된 담당 문서입니다. ' +
            '<b>바로 첨부</b>형은 여기서 파일을 올리면 끝나고, <b>양식 작성</b>·<b>메뉴 진행</b>형은 해당 화면으로 이동해 처리합니다.</div>';

        return note + filters + '<div class="mw-group"><div class="mw-group-body">' + rows + '</div></div>';
    }

    function pubItemHtml(d) {
        var tone = d.status === '완료' ? 'success' : d.status === '진행' ? 'info' : 'neutral';
        var stChip = '<span class="chip-status chip-sm ' + tone + '">' + esc(d.status) + '</span>';
        var typeChip = V().processTypeChip(d.processType);
        var pdca = d.pdca ? '<span class="chip-mini pdca">' + esc(d.pdca) + '</span>' : '';

        var action = '', destChip = '', cardAct = '';
        if (d.status === '완료') {
            action = '<span class="mw-done-mark">' + ICO.check + ' 완료</span>' +
                (d.processType === '첨부파일'
                    ? ' <button type="button" class="btn btn-outline btn-sm" onclick="MYWORK.openAttach(\'' + d.id + '\',\'pub\',true)">' + ICO.clip + ' 첨부 재등록</button>'
                    : '');
        } else if (d.processType === '첨부파일') {
            action = '<button type="button" class="btn btn-primary btn-sm" onclick="MYWORK.openAttach(\'' + d.id + '\',\'pub\')">' +
                ICO.clip + ' 파일 첨부</button>';
            cardAct = ' onclick="MYWORK.cardAttach(\'' + d.id + '\',\'pub\',event)"';
        } else if (d.processType === '전자문서') {
            destChip = '<span class="mw-dest">' + ICO.arrow + ' 업무 목록에서 작성</span>';
            action = '<a class="btn btn-outline btn-sm" href="docs-preset.html">양식 작성 ' + ICO.arrow + '</a>';
            cardAct = ' onclick="MYWORK.go(\'docs-preset.html\',event)"';
        } else {
            var menu = (global.DY_MENUS_V2 || {})[d.menuKey];
            var label = menu ? menu.label : '업무 목록';
            var href = MENU_HREF_V2[d.menuKey] || 'docs-preset.html';
            destChip = '<span class="mw-dest">' + ICO.arrow + ' ' + esc(label) + '에서 진행</span>';
            action = '<a class="btn btn-outline btn-sm" href="' + esc(href) + '">진행하러 가기 ' + ICO.arrow + '</a>';
            cardAct = ' onclick="MYWORK.go(\'' + esc(href) + '\',event)"';
        }

        var inline = '';

        return '<div class="mw-item' + (d.status === '완료' ? ' is-done' : '') +
            (cardAct ? ' mw-click' : '') + '"' + cardAct + '>' +
            '<div class="mw-item-head">' +
                '<div class="mw-item-main">' +
                    typeChip + ' ' + pdca +
                    '<span class="mw-item-title">' + esc(d.name) + '</span>' +
                    '<div class="mw-item-sub">' + esc(d.theme || '') + (d.cycle ? ' · 주기 ' + esc(d.cycle) : '') + (d.setId ? ' · 세트 ' + esc(d.setId) : '') + '</div>' +
                    '<div class="mw-item-meta">' +
                        stChip +
                        (d.assignee ? '<span class="mw-item-dept">담당 ' + esc(d.assignee) + '</span>' : '') +
                        (d.updated ? '<span class="mw-item-due">수정 ' + esc(d.updated) + '</span>' : '') +
                        destChip +
                    '</div>' +
                '</div>' +
                '<div class="mw-item-actions">' + action + '</div>' +
            '</div>' + inline +
        '</div>';
    }

    /* ---- 완료한 업무 뷰 ------------------------------------------------
     * 설계 의도: '완료했다'는 사실만 남기면 목록이 쓸모가 없다. 이 탭을 여는 이유는
     * (a) 내가 뭘 끝냈는지 되짚거나 (b) 감사·소명에 쓸 기록을 찾는 것이다. 그래서
     *   · 날짜는 기한이 아니라 **완료일** — 종전에는 기한을 '완료 2026-10-31'로 찍어
     *     완료일인 것처럼 보였다(실제 완료일은 2026-07-31이었다).
     *   · 개선조치는 **개선 후 사진 썸네일**을 카드에 바로 붙이고, 누르면 전·후 대조
     *     상세(IMPCARD)로 들어간다 — 정기·수시 상세와 같은 화면.
     *   · **완료일 기준 시간 그룹**(이번 주 / 이번 달 / 이전) — 회고는 시간순이 자연스럽다.
     *   · 지연 완료는 감추지 않는다. 기한을 넘겨 끝낸 것도 사실이다.
     * -------------------------------------------------------------------- */
    function doneStamp(it) {
        return it.doneDate || it.due || '';
    }
    /* 완료일이 오늘로부터 며칠 전인지 — 그룹 배정용 */
    function doneAgo(it) {
        var s = doneStamp(it);
        if (!s) return 9999;
        var d = daysBetween(s);
        return d == null ? 9999 : -d;   /* daysBetween 은 미래가 +, 과거가 - 다 */
    }
    var DONE_BUCKETS = [
        { id: 'w', label: '최근 7일', tone: 'success', max: 7 },
        { id: 'm', label: '최근 30일', tone: 'neutral', max: 30 },
        { id: 'o', label: '그 이전', tone: 'neutral', max: Infinity }
    ];
    /* 기한을 넘겨 끝낸 건 — 사실이므로 배지로 드러낸다 */
    function lateDone(it) {
        if (!it.doneDate || !it.due) return false;
        return it.doneDate > it.due;
    }
    function doneShots(it) {
        var arr = it.shots || [];
        if (!arr.length) return '';
        var cells = arr.slice(0, 3).map(function (f) {
            var src = f.thumb || f.url;
            return '<span class="mw-done-shot">' +
                (src ? '<img src="' + esc(src) + '" alt="">' : '<span class="mw-done-shot-x">파일</span>') +
                '</span>';
        }).join('');
        return '<span class="mw-done-shots" aria-label="증빙 사진 ' + arr.length + '장">' + cells +
            (arr.length > 3 ? '<span class="mw-done-more">+' + (arr.length - 3) + '</span>' : '') + '</span>';
    }
    function doneItemHtml(it) {
        var meta = CATS[it.cat] || { label: it.cat, color: 'var(--text-gray)', bg: 'var(--gray-200)' };
        var late = lateDone(it);
        var facts = [];
        if (it.doneBy) facts.push('<span>확인 <b>' + esc(it.doneBy) + '</b></span>');
        if (it.due) facts.push('<span>기한 ' + esc(it.due) + '</span>');
        if (it.dept_label) facts.push('<span>' + esc(it.dept_label) + '</span>');
        var act = it.impId
            ? '<button type="button" class="btn btn-outline btn-sm" onclick="MYWORK.openDone(\'' + it.impId + '\')">조치 상세</button>'
            : (it.atype === 'rskreport'
                ? '<button type="button" class="btn btn-outline btn-sm" onclick="MYWORK.openReport(\'' + it.rsk.aid + '\',\'' + it.rsk.deptId + '\',event)">제출본 교체</button>'
                : (it.atype === 'attach'
                    ? '<button type="button" class="btn btn-outline btn-sm" onclick="MYWORK.openAttach(\'' + it.id + '\',\'seed\',true)">첨부 재등록</button>'
                    : (it.href ? '<a class="btn btn-outline btn-sm" href="' + esc(it.href) + '">보기</a>' : '')));
        return '<div class="mw-done-item">' +
            '<span class="mw-done-check" aria-hidden="true">' + ICO.check + '</span>' +
            '<div class="mw-done-body">' +
                '<div class="mw-done-top">' +
                    '<span class="mw-cat" style="color:' + meta.color + ';background:' + meta.bg + ';">' + esc(meta.label) + '</span>' +
                    '<span class="mw-done-title">' + esc(it.title) + '</span>' +
                    (late ? '<span class="chip-status warning chip-sm">기한 후 완료</span>' : '') +
                '</div>' +
                (it.doneText ? '<p class="mw-done-text">' + esc(it.doneText) + '</p>'
                             : (it.sub ? '<p class="mw-done-text is-sub">' + esc(it.sub) + '</p>' : '')) +
                '<div class="mw-done-facts">' +
                    '<span class="mw-done-date">완료 <b>' + esc(doneStamp(it) || '-') + '</b></span>' +
                    facts.join('') +
                '</div>' +
            '</div>' +
            doneShots(it) +
            (act ? '<div class="mw-done-act">' + act + '</div>' : '') +
        '</div>';
    }

    function renderDone(items, pubs) {
        var dueDone = items.filter(function (i) { return i.status === 'DONE'; });
        var pubDone = pubs.filter(function (d) { return d.status === '완료'; });
        if (!dueDone.length && !pubDone.length) {
            return '<div class="mw-empty">아직 완료한 업무가 없습니다.<br>' +
                '<span style="color:var(--text-gray);">마감 할일이나 발행된 업무를 처리하면 여기에 모입니다.</span></div>';
        }
        /* 카테고리 필터는 마감 할일 탭과 같은 상태(state.fCat)를 쓴다 — 탭을 옮겨도 관점이 유지된다 */
        var cats = {};
        dueDone.forEach(function (i) { cats[i.cat] = (cats[i.cat] || 0) + 1; });
        var withShots = dueDone.filter(function (i) { return (i.shots || []).length; }).length;
        var lates = dueDone.filter(lateDone).length;

        var sum =
            '<div class="mw-done-sum">' +
                '<span class="mw-done-sum-n"><b>' + (dueDone.length + pubDone.length) + '</b>건 완료</span>' +
                (withShots ? '<span class="mw-done-sum-i">' + ICO.check + ' 증빙 사진 ' + withShots + '건</span>' : '') +
                (lates ? '<span class="mw-done-sum-l">기한 후 완료 ' + lates + '건</span>' : '') +
            '</div>';

        var chips = Object.keys(cats).length > 1
            ? '<div class="mw-done-filters" role="group" aria-label="완료 업무 분류 필터">' +
                  '<button type="button" class="mw-done-fchip' + (state.fCat ? '' : ' is-on') +
                      '" onclick="MYWORK.setCat(\'\')"' + (state.fCat ? '' : ' aria-current="true"') +
                      '>전체 <b>' + dueDone.length + '</b></button>' +
                  Object.keys(cats).map(function (c) {
                      var m = CATS[c] || { label: c };
                      return '<button type="button" class="mw-done-fchip' + (state.fCat === c ? ' is-on' : '') +
                          '" onclick="MYWORK.setCat(\'' + c + '\')"' + (state.fCat === c ? ' aria-current="true"' : '') +
                          '>' + esc(m.label) + ' <b>' + cats[c] + '</b></button>';
                  }).join('') +
              '</div>'
            : '';

        var shown = state.fCat ? dueDone.filter(function (i) { return i.cat === state.fCat; }) : dueDone;
        /* 최근 완료가 위로 */
        shown = shown.slice().sort(function (a, b) { return doneAgo(a) - doneAgo(b); });

        var html = sum + chips;
        if (!shown.length && !pubDone.length) {
            html += '<div class="mw-empty">이 분류로 완료한 업무가 없습니다. ' +
                '<button type="button" class="btn btn-sm btn-outline" onclick="MYWORK.setCat(\'\')">필터 해제</button></div>';
        }
        DONE_BUCKETS.forEach(function (b, bi) {
            var min = bi === 0 ? -Infinity : DONE_BUCKETS[bi - 1].max;
            var list = shown.filter(function (i) { var d = doneAgo(i); return d > min && d <= b.max; });
            if (!list.length) return;
            html += '<div class="mw-group mw-g-done">' +
                '<div class="mw-group-head">' + groupDot(b.tone) +
                    '<span class="mw-group-label">' + b.label + '</span>' +
                    '<span class="mw-group-count">' + list.length + '건</span>' +
                '</div>' +
                '<div class="mw-group-body mw-done-list">' + list.map(doneItemHtml).join('') + '</div>' +
            '</div>';
        });
        if (pubDone.length) {
            /* 발행 업무는 수십 건까지 쌓인다 — 한 번에 다 펼치면 마감 할일 완료분이
               스크롤 아래로 밀려 보이지 않는다. 처음엔 접고 필요할 때 펼친다. */
            var CAP = 10;
            var capped = state.doneMore ? pubDone : pubDone.slice(0, CAP);
            html += '<div class="mw-group mw-g-done">' +
                '<div class="mw-group-head">' + groupDot('neutral') +
                    '<span class="mw-group-label">완료한 발행 업무</span>' +
                    '<span class="mw-group-count">' + pubDone.length + '건</span>' +
                '</div>' +
                '<div class="mw-group-body">' + capped.map(pubItemHtml).join('') +
                    (pubDone.length > CAP
                        ? '<div class="mw-done-more-row">' +
                              '<button type="button" class="btn btn-outline btn-sm" onclick="MYWORK.toggleDoneMore()"' +
                              ' aria-expanded="' + (state.doneMore ? 'true' : 'false') + '">' +
                              (state.doneMore ? '접기' : '나머지 ' + (pubDone.length - CAP) + '건 더 보기') +
                              '</button></div>'
                        : '') +
                '</div>' +
            '</div>';
        }
        html += '<p class="mw-done-note">완료 기록은 되돌릴 수 없습니다 — 증빙이 붙은 기록을 지우면 소명 자료가 사라집니다. ' +
            '내용을 고쳐야 하면 <b>제출본 교체</b>·<b>첨부 재등록</b>으로 파일만 바꾸세요.</p>';
        return html;
    }

    /* 완료한 개선조치 상세 — 정기·수시와 같은 카드 화면(IMPCARD)을 그대로 쓴다 */
    function openDone(impId) {
        var m = D().improvementOf(impId); if (!m) return;
        if (!global.IMPCARD) { toast('개선조치 상세 모듈을 불러오지 못했습니다.'); return; }
        IMPCARD.open({
            key: 'mywork:' + impId,
            title: '완료한 개선조치 — ' + D().deptName(m.dept_id),
            metaHtml:
                '<span>출처 <b>' + esc((D().SRC_META[m.source_type] || {}).label || '-') + '</b></span>' +
                (m.assessment_id ? '<span>평가 <b>' + esc(m.assessment_id) + '</b></span>' : '') +
                (m.occ_id ? '<span>수시평가 <b>' + esc(m.occ_id) + '</b></span>' : '') +
                '<span>조치기한 <b>' + esc(m.due || m.due_date || '-') + '</b></span>',
            noteHtml: '개선 전·후 사진을 눌러 크게 볼 수 있습니다.',
            items: function () { var x = D().improvementOf(impId); return x ? [x] : []; },
            canRemind: false
        });
    }

    /* ================= 부서 후보 (DYV2.ORG 파생) ================= */
    function candidateDepts() {
        var seen = {};
        try { D().assessments().forEach(function (a) { (a.depts || []).forEach(function (dp) { seen[dp.deptId] = (seen[dp.deptId] || 0) + 1; }); }); } catch (e) {}
        try { D().improvements().forEach(function (m) { if (m.dept_id) seen[m.dept_id] = (seen[m.dept_id] || 0) + 5; }); } catch (e) {}
        otherSeeds().forEach(function (s) { seen[s.dept] = (seen[s.dept] || 0) + 3; });
        var all = D().deptCandidates();
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
    function setDept(id) {
        /* URL(?dept=)·직접 호출로도 범위를 벗어나지 못하게 한다 */
        var R = global.DYROLE, s = R && R.scope ? R.scope() : 'all';
        if (s !== 'all' && id !== s) { V().toast('소속 부서만 조회할 수 있습니다.'); return; }
        state.deptId = id; state.openInline = {}; state.attachCtx = null; render();
    }
    function setView(v) { state.view = v; render(); }
    function toggleDoneMore() { state.doneMore = !state.doneMore; render(); }
    function setStatus(v) { state.fStatus = v; render(); }
    function setCat(v) { state.fCat = v; render(); }
    function setSort(v) { state.sort = v; render(); }
    function setPubType(v) { state.pubType = v; render(); }
    function setPubStatus(v) { state.pubStatus = v; render(); }
    /* KPI 칩 클릭 → 필터 (전체=해제, 결재=카테고리) */
    function kpiFilter(key) {
        state.view = 'due';
        if (!key) { state.fStatus = ''; state.fCat = ''; }
        else if (key === 'approval') { state.fCat = 'approval'; state.fStatus = ''; }
        else { state.fStatus = key; state.fCat = ''; }
        render();
    }
    function sync() {
        var t = new Date();
        var pad = function (n) { return (n < 10 ? '0' : '') + n; };
        state.syncedAt = t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()) + ' ' + pad(t.getHours()) + ':' + pad(t.getMinutes());
        toast('내 할일 목록을 새로고침했습니다.');
        render();
    }

    /* ---- 파일 첨부 (프로토타입 모의 흐름 — 팝업 안에서만 갱신) ---- */
    var MOCK_FILES = ['스캔본_서명완료.pdf', '현장사진.jpg', '점검결과.hwp', '증빙자료.zip'];
    function pickFile(id) {
        var files = state.attachFiles[id] = state.attachFiles[id] || [];
        if (files.length >= V().FILE_LIMITS.maxCount) { toast('최대 ' + V().FILE_LIMITS.maxCount + '개까지 첨부할 수 있습니다.'); return; }
        files.push(MOCK_FILES[files.length % MOCK_FILES.length]);
        renderAttachModal();
    }
    function removeFile(id, idx) {
        var files = state.attachFiles[id];
        if (files) files.splice(idx, 1);
        renderAttachModal();
    }
    function submitAttach() {
        var ctx = state.attachCtx; if (!ctx) return;
        var files = state.attachFiles[ctx.id] || [];
        if (!files.length) { toast('첨부할 파일을 선택하세요.'); return; }
        if (ctx.kind === 'pub') {
            var d = (global.DY_DOCS_V2 || []).find(function (x) { return x.id === ctx.id; });
            if (d) { d.status = '완료'; d.updated = todayIso(); }
            state.pubFiles[ctx.id] = files.slice();
            toast(ctx.redo ? '첨부 재등록 완료 — 새 파일로 교체되었습니다.'
                : '첨부 완료 — 업무 목록' + (d && d.setId ? ' (세트 ' + d.setId + ')' : '') + '에 반영되었습니다.');
        } else {
            state.doneSeeds[ctx.id] = { at: todayIso(), files: files.slice() };
            toast(ctx.redo ? '첨부 재등록 완료 — 새 파일로 교체되었습니다.'
                : '첨부 완료 — 완료한 업무 탭으로 이동했습니다.');
        }
        delete state.attachFiles[ctx.id];
        state.attachCtx = null;
        V().closeModal();
        render();
    }

    /* ---- 재촉 응답 인라인 폼 ---- */
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
    /* ---- 완료 처리 (단일 모달) ---- */
    /* 완료 요건(조치내용·완료일·개선 후 사진·서명)은 DYRSK.completeImprovement 가 강제한다.
     * 화면은 입력만 받고, 통과 여부는 데이터 계층 판정을 그대로 따른다 — 화면마다 규칙을
     * 다시 쓰면 어느 한 경로가 빠져나가 증빙 없는 완료가 기록된다. */
    function signerDefault() {
        var p = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        return p ? p.name : '';
    }
    function captureCmpl() {
        var el = function (x) { return document.getElementById(x); };
        if (el('mw-cmpl-desc')) state.cmplDesc = el('mw-cmpl-desc').value;
        if (el('mw-cmpl-sign')) state.cmplSign = el('mw-cmpl-sign').value;
        if (el('mw-cmpl-date')) state.cmplDate = el('mw-cmpl-date').value;
    }
    /* 개선 후 사진은 실제 파일을 고른다 — 이 사진 한 장이 조치 완료의 증빙이라
       파일명만 지어내면 담당자가 끝냈다는 사실을 소명할 수 없다. */
    function onPickAfter(files) {
        captureCmpl();
        state.cmplPhotos = (state.cmplPhotos || []).concat(files).slice(0, V().FILE_LIMITS.maxCount);
        state.cmplPhoto = state.cmplPhotos.map(function (f) { return f.name; }).join(', ');
        complete(state.cmplId);
        V().toast('개선 후 사진 ' + files.length + '건 첨부');
    }
    function delAfter(n) {
        captureCmpl();
        (state.cmplPhotos || []).splice(n, 1);
        state.cmplPhoto = (state.cmplPhotos || []).map(function (f) { return f.name; }).join(', ');
        complete(state.cmplId);
    }
    function afterShotsHtml() {
        var arr = state.cmplPhotos || [];
        if (!arr.length) return '';
        return '<div class="mw-cmpl-shots">' + arr.map(function (f, n) {
            var src = f.thumb || f.url;
            return '<span class="mw-cmpl-shot">' +
                (src ? '<img src="' + esc(src) + '" alt="">' : '<span class="mw-cmpl-shot-x">파일</span>') +
                '<button type="button" class="mw-cmpl-shot-del" aria-label="' + esc(f.name) + ' 삭제"' +
                ' onclick="MYWORK.delAfter(' + n + ')">×</button></span>';
        }).join('') + '</div>';
    }

    function complete(id) {
        if (!canAct()) { toast('이 부서의 담당자만 완료 처리할 수 있습니다.'); return; }
        var m = D().improvementOf(id); if (!m) return;
        state.cmplId = id;
        V().openModal('개선조치 완료 처리',
            '<div style="font-size:var(--fs-13);">' +
                '<p><b>' + esc((m.hazard && m.hazard.name) || m.hazard_risk_factor || '') + '</b></p>' +
                '<p style="color:var(--text-gray);margin:6px 0 14px;">' + esc(m.description || m.action || '') + '</p>' +
                '<label style="font-size:var(--fs-12);font-weight:700;color:var(--text-gray);display:block;margin-bottom:5px;">조치 내용 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<textarea class="form-textarea" id="mw-cmpl-desc" rows="3" placeholder="실제 조치한 내용을 입력하세요">' + esc(state.cmplDesc || '') + '</textarea>' +
                '<label style="font-size:var(--fs-12);font-weight:700;color:var(--text-gray);display:block;margin:14px 0 5px;">완료일 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="date" class="form-input" id="mw-cmpl-date" value="' + esc(state.cmplDate || D().today()) + '" style="max-width:180px;">' +
                '<label style="font-size:var(--fs-12);font-weight:700;color:var(--text-gray);display:block;margin:14px 0 5px;">개선 후 사진 <span style="color:var(--status-danger-fg)">*</span></label>' +
                afterShotsHtml() +
                V().uploadDrop('<b>개선 후 사진</b> <span style="font-size:var(--fs-12);color:var(--text-gray);">클릭 또는 끌어놓기</span>',
                    null, { pick: 'MYWORK.onPickAfter', multiple: true, style: 'padding:12px;' }) +
                '<p class="file-hint">개선 후 사진은 조치 완료의 증빙입니다. 없으면 완료 처리되지 않습니다.</p>' +
                '<label style="font-size:var(--fs-12);font-weight:700;color:var(--text-gray);display:block;margin:14px 0 5px;">완료 확인 (전자서명) <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="text" class="form-input" id="mw-cmpl-sign" value="' + esc(state.cmplSign || signerDefault()) + '" placeholder="확인자 이름" style="max-width:220px;">' +
            '</div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="MYWORK.doComplete(\'' + id + '\')">완료 처리</button>');
    }
    function doComplete(id) {
        var el = function (x) { return document.getElementById(x); };
        var payload = {
            action: (el('mw-cmpl-desc') && el('mw-cmpl-desc').value || '').trim(),
            completedDate: el('mw-cmpl-date') && el('mw-cmpl-date').value,
            afterPhoto: state.cmplPhoto,
            afterPhotos: state.cmplPhotos || [],
            by: (el('mw-cmpl-sign') && el('mw-cmpl-sign').value || '').trim(),
            signedBy: (el('mw-cmpl-sign') && el('mw-cmpl-sign').value || '').trim()
        };
        var err = D().completionError(payload);
        if (err) { toast(err); return; }
        D().completeImprovement(id, payload);
        state.cmplPhoto = ''; state.cmplPhotos = []; state.cmplDesc = ''; state.cmplSign = '';
        state.cmplDate = ''; state.cmplId = null;
        V().closeModal(); toast('완료 처리 · 전자서명 기록 · 평가 상세에 반영'); render();
    }

    /* ===== 정기평가 — 유해위험요인 설문조사표 작성본 제출 =====
     * 부서가 정기평가에서 지는 몫이 여기서 끝난다. 제출하면 주관부서 화면
     * (rsk-list 부서별 보고서)에 그대로 뜨고, 이력에 '누가 언제' 가 남는다. */
    var RPT = null;   /* {aid, deptId, files:[]} */
    function openReport(aid, deptId, ev) {
        if (ev) { ev.preventDefault(); ev.stopPropagation(); }
        if (!canAct()) { toast('이 부서의 담당자만 제출할 수 있습니다.'); return; }
        var a = D().assessmentOf(aid); if (!a) return;
        var dp = (a.depts || []).filter(function (x) { return x.deptId === deptId; })[0];
        if (!dp) return;
        if (!RPT || RPT.aid !== aid || RPT.deptId !== deptId) RPT = { aid: aid, deptId: deptId, files: [] };
        renderReport();
    }
    function renderReport() {
        var a = D().assessmentOf(RPT.aid); if (!a) return;
        var dp = (a.depts || []).filter(function (x) { return x.deptId === RPT.deptId; })[0];
        var form = dp.surveyFile || (a.files && a.files.surveyAll) || '';
        var picked = RPT.files.map(function (f, n) {
            return '<li><span class="mw-rpt-name">' + esc(f.name) + '</span>' +
                '<button type="button" class="mw-rpt-del" aria-label="' + esc(f.name) + ' 제외"' +
                ' onclick="MYWORK.delReport(' + n + ')">×</button></li>';
        }).join('');
        V().openModal('유해위험요인 설문조사표 제출 — ' + esc(D().deptName(RPT.deptId)),
            '<p class="mw-rpt-lead">' + esc(a.title) +
                (dp.inspectDate ? ' · 점검일 <b>' + esc(dp.inspectDate) + '</b>' : '') + '</p>' +
            '<div class="mw-rpt-step"><span class="mw-rpt-no">1</span>' +
                '<div><b>양식 받기</b>' +
                    (form
                        ? '<div><button type="button" class="btn btn-outline btn-sm" onclick="MYWORK.dlForm(\'' +
                              esc(form).replace(/'/g, "&#39;") + '\')">📥 ' + esc(form) + '</button></div>'
                        : '<p class="file-hint">배포된 양식이 없습니다 — 재난안전과에 문의하세요.</p>') +
                '</div></div>' +
            '<div class="mw-rpt-step"><span class="mw-rpt-no">2</span>' +
                '<div style="flex:1;min-width:0;"><b>작성본 제출</b>' +
                    (picked ? '<ul class="mw-rpt-list">' + picked + '</ul>' : '') +
                    V().uploadDrop('<b>작성한 설문조사표</b> <span style="font-size:var(--fs-12);color:var(--text-gray);">클릭 또는 끌어놓기</span>',
                        null, { pick: 'MYWORK.onPickReport', hint: true, style: 'padding:12px;' }) +
                    (dp.reportFile ? '<p class="file-hint">현재 제출본 <b>' + esc(dp.reportFile) + '</b>' +
                        (dp.reportAt ? ' (' + esc(dp.reportAt) + (dp.reportBy ? ' · ' + esc(dp.reportBy) : '') + ')' : '') +
                        ' — 새 파일을 올리면 교체됩니다.</p>' : '') +
                '</div></div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="MYWORK.doReport()">제출</button>');
    }
    function dlForm(name) { toast('설문조사표 다운로드: ' + name + ' (프로토타입 — 실제 파일은 미연결)'); }
    function onPickReport(files) { RPT.files = files.slice(0, 1); renderReport(); }
    function delReport(n) { RPT.files.splice(n, 1); renderReport(); }
    function doReport() {
        if (!RPT.files.length) { toast('작성한 설문조사표 파일을 선택하세요.'); return; }
        var p = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        var who = p ? (D().deptName(RPT.deptId) + ' · ' + p.name) : (D().deptName(RPT.deptId) + ' 담당자');
        D().setDeptReport(RPT.aid, RPT.deptId, RPT.files[0].name, who);
        RPT = null;
        V().closeModal(); toast('설문조사표 제출 · 재난안전과로 전달되었습니다'); render();
    }

    /* ================= init ================= */
    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        var q = new URLSearchParams(location.search);
        var pre = q.get('dept'); if (pre) state.deptId = pre;
        var fc = q.get('cat'); if (fc && CATS[fc]) state.fCat = fc;
        var dv = q.get('due');
        if (dv === 'over') state.fStatus = 'overdue';
        else if (dv === 'today') state.fStatus = 'today';
        else if (dv === 'week') state.fStatus = 'week';
        var vw = q.get('view');
        if (vw === 'pub' || vw === 'done') state.view = vw;
        render();
    }

    global.MYWORK = {
        onPickAfter: onPickAfter, delAfter: delAfter,
        openReport: openReport, onPickReport: onPickReport, delReport: delReport, doReport: doReport, dlForm: dlForm,
        openDone: openDone, toggleDoneMore: toggleDoneMore,
        init: init, setDept: setDept, setView: setView,
        setStatus: setStatus, setCat: setCat, setSort: setSort, sync: sync,
        setPubType: setPubType, setPubStatus: setPubStatus, kpiFilter: kpiFilter,
        go: go, cardAttach: cardAttach,
        openAttach: openAttach, pickFile: pickFile, removeFile: removeFile, submitAttach: submitAttach,
        toggleRespond: toggleRespond, setRespReason: setRespReason, setRespDue: setRespDue, submitRespond: submitRespond,
        complete: complete, doComplete: doComplete
    };
})(window);
