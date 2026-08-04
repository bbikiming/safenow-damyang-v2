/* =====================================================================
   rsk-tour.js · 정기 위험성평가 시연 투어 (전역 RSKTOUR)

   두 가지를 제공한다.
     ① 전체 흐름 보드 — RSKTOUR.openFlow()
        9단계가 지금 어디까지 왔는지 **실제 데이터로 판정**해 보여준다.
        투어가 자체 진행 플래그를 저장하지 않으므로, 껐다 켜도·손으로 먼저
        처리해도 체크가 그대로 맞는다. (EDUTOUR 는 커서 인덱스로만 판정해
        뒤로 가면 완료 표시가 풀린다 — 그 결함을 반복하지 않는다.)
     ② 단계별 시연 가이드 — RSKTOUR.start()
        지금 화면에서 **무엇을 어디서 몇 번 누르는지**(clickPath)를 말하고,
        그 버튼을 실제로 강조(.dy-tour-focus)한 뒤 바로 열어 준다.
        버튼이 화면에 없으면 **왜 없는지**(whyMissing)까지 밝힌다.

   교육 시연 투어(js/edu-tour.js EDUTOUR)와 **같은 CSS 계열**을 쓴다
   (css/v2.css 의 .dy-tour-* / .dy-demo-* = .edu-tour-* / .edu-demo-* 별칭, §7).
   JS 엔진은 분리한다 — EDUTOUR 는 CLAUDE.md §4 가 "발표용 핵심 자산 · 제거 금지"로
   못박은 자산이고, rsk 3화면과 edu 9화면은 교집합이 0이라 충돌이 없다.

   위험성평가가 교육과 다른 점 — **주관부서와 부서 담당자를 오간다.**
   그래서 EDUTOUR 에 없는 '요구 페르소나'와 자동 전환을 투어가 직접 처리한다.
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYRSK; };
    var R = function () { return global.DYROLE; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }

    var SKEY = 'dy-tour-rsk-v1';
    var ROLE_KEY = 'dy-role-sim-v1';          /* js/layout.js ROLE_KEY 와 같은 값 */
    var OWNER_P = 'staff';                    /* 박안전 — 재난안전과 담당자(주관부서) */

    /* 부서 담당자 페르소나가 있는 부서만 시연 대상이 될 수 있다.
       (관리감독자 페르소나는 canAct()=false 라 제출·완료를 못 한다) */
    var DEPT_PERSONA = { water: 'wat', env: 'envst', safety: 'staff' };
    var PREF_DEPT = ['water', 'env'];         /* 시연 선호 순서 */

    function year() { return +String(V().today()).slice(0, 4); }
    function A() { var l = D().assessments(year()) || []; return l[0] || null; }

    /* 시연 대상 부서 — 하드코딩하지 않고 **실제 대상 부서에서 고른다**.
       발표자가 마법사에서 물순환사업소를 안 골랐어도 투어가 죽지 않아야 한다. */
    function demoDept() {
        var a = A();
        if (!a) return 'water';
        var ids = (a.depts || []).map(function (d) { return d.deptId; });
        for (var i = 0; i < PREF_DEPT.length; i++) {
            if (ids.indexOf(PREF_DEPT[i]) >= 0) return PREF_DEPT[i];
        }
        for (var j = 0; j < ids.length; j++) { if (DEPT_PERSONA[ids[j]]) return ids[j]; }
        return ids[0] || 'water';
    }
    function deptPersona() { return DEPT_PERSONA[demoDept()] || OWNER_P; }
    function deptNm() { return D().deptName(demoDept()); }
    function dp() {
        var a = A(); if (!a) return null;
        var id = demoDept();
        return (a.depts || []).filter(function (x) { return x.deptId === id; })[0] || null;
    }
    function imps() { var a = A(); return a ? D().improvementsFor(a.id, demoDept()) : []; }
    function doc() { var a = A(); return a ? D().latestDoc('A|' + a.id) : null; }

    /* 검수 표에서 **실제로 개선조치가 될 행** 수.
       DYRSK.deliverFromReview 가 채택하는 조건과 같은 식이어야 한다 —
       다른 식을 쓰면 "4단계 완료"라 해 놓고 5단계에서 전 부서가
       '지적사항 없음'으로 빠지는 사고가 난다. */
    function validRows() {
        var a = A(); if (!a || !a.review) return 0;
        var pd = a.review.parsedDepts || {}, n = 0;
        Object.keys(pd).forEach(function (k) {
            n += (pd[k] || []).filter(function (r) {
                return !r.deleted && (r.name || '').trim() && (r.action || '').trim();
            }).length;
        });
        return n;
    }

    /* =================== 단계 정의 ===================
       done() 은 전부 DYRSK 파생이다. note() 는 그 단계의 실수치를 보여준다 —
       "몇 건 남았는지"가 안 보이면 체크리스트가 신뢰를 못 준다. */
    var STEPS = [
        {
            key: 'create', label: '생성', page: 'rsk-list.html',
            persona: function () { return OWNER_P; },
            href: function () { return 'rsk-list.html'; },
            selector: '[data-tour="rsk-create"]',
            title: '정기평가 생성',
            where: '화면 오른쪽 위 <b>[＋ 정기평가 생성]</b>',
            clickPath: [
                '[＋ 정기평가 생성] — 마법사가 열립니다',
                'STEP1 조직도에서 대상 부서 선택 — 시연은 한 곳만 남기세요',
                'STEP2 점검일자 [일괄 적용] → [생성]'
            ],
            desc: '대상 부서를 고르고 부서별 점검일자를 정하면, 그 부서들에 점검예정일이 통보됩니다.',
            script: '연 1회 정기 위험성평가를 시스템에서 한 건으로 엽니다. 종전에는 부서별로 공문과 엑셀을 따로 돌렸습니다.',
            modalGuide: '대상 부서가 많으면 뒤에서 <b>공문 기안 조건(전 부서 확인 완료)</b>을 채우느라 시연이 끝나지 않습니다. 한 곳만 남기세요.',
            modalAction: { label: '시연용으로 물순환사업소만 선택', fn: 'RSKTOUR.pickDemoDept()' },
            actionLabel: '정기평가 생성 열기',
            action: function () { global.RSKLIST.openWizard(); },
            done: function () { return !!A(); },
            note: function () { var a = A(); return a ? '대상 부서 ' + (a.depts || []).length + '개' : '미생성'; }
        },
        {
            key: 'survey', label: '설문', page: 'rsk-list.html',
            persona: function () { return OWNER_P; },
            href: function () { return 'rsk-list.html'; },
            selector: '[data-tour="rsk-survey"]',
            title: '유해위험요인 설문조사표 첨부',
            where: '요약 카드 안 <b>“공통 유해위험요인 설문조사표”</b> 줄의 <b>[＋ 첨부]</b>',
            clickPath: [
                '요약 카드의 [＋ 첨부]',
                '파일명을 그대로 두고 [첨부] — 프로토타입이라 실제 파일은 올라가지 않습니다'
            ],
            desc: '전 부서가 같은 서식을 쓰도록 공통본을 답니다. 부서별로 다른 서식이 필요하면 표에서 부서별로 덮어씁니다.',
            script: '서식을 시스템이 배포하므로 부서가 옛 버전을 쓰거나 서식을 찾아 헤매는 일이 없어집니다.',
            modalGuide: '설문조사표는 <b>보고서 등록 전까지만</b> 붙일 수 있습니다 — 그 뒤에는 잠깁니다.',
            actionLabel: '설문조사표 첨부 열기',
            action: function () { global.RSKLIST.openSurveyAll(); },
            done: function () {
                var a = A(); if (!a) return false;
                var p = D().surveyProgress(a.id);
                return p.total > 0 && p.done === p.total;
            },
            note: function () {
                var a = A(); if (!a) return '평가 생성 후';
                var p = D().surveyProgress(a.id);
                return '부서 적용 ' + p.done + ' / ' + p.total;
            }
        },
        {
            key: 'submit', label: '부서제출', page: 'my-work.html',
            persona: deptPersona,
            scopeDept: demoDept,
            href: function () { return 'my-work.html?dept=' + demoDept() + '&cat=risk'; },
            selector: '[data-tour="mw-rskreport"]',
            title: '부서가 설문조사표를 작성해 제출',
            where: '<b>내 할일</b> 목록의 위험성평가 카드에 있는 <b>[제출]</b>',
            clickPath: [
                '카드의 [제출] — 제출 모달이 열립니다',
                '[양식 받기]로 서식을 내려받고, 작성본을 올린 뒤 [제출]'
            ],
            desc: '점검일에 맞춰 부서가 작성본을 올립니다. 여기서부터 부서 담당자 관점입니다.',
            script: '부서는 공문을 기다리지 않고 내 할일에서 바로 처리합니다. 제출 시각과 제출자가 그대로 이력에 남습니다.',
            modalGuide: '파일을 고르거나 파일명을 그대로 두고 <b>[제출]</b>을 누르세요.',
            actionLabel: '설문조사표 제출 열기',
            action: function () {
                var a = A(); if (!a) { toast('먼저 1단계에서 정기평가를 생성하세요.'); return; }
                global.MYWORK.openReport(a.id, demoDept());
            },
            done: function () { var d = dp(); return !!(d && d.reportFile); },
            note: function () {
                var a = A(); if (!a) return '평가 생성 후';
                var p = D().deptReportProgress(a);
                var d = dp();
                return '제출 ' + p.done + ' / ' + p.total + (d && d.reportFile ? ' · ' + deptNm() + ' 제출 완료' : '');
            }
        },
        {
            key: 'review', label: '검수', page: 'rsk-list.html',
            persona: function () { return OWNER_P; },
            href: function () { return 'rsk-list.html'; },
            selector: '[data-tour="rsk-report"]',
            title: '통합 보고서 첨부 · 부서별 조치 작성',
            where: '<b>[＋ 통합 보고서 첨부]</b> → 열리는 작성표',
            clickPath: [
                '[＋ 통합 보고서 첨부] — 첨부하면 부서별 조치 작성표로 바뀝니다',
                '부서 블록에서 [＋ 행 추가]',
                '유해위험요인 이름과 개선조치를 적습니다 — 둘 다 있어야 개선조치가 됩니다'
            ],
            desc: '보고서를 보고 부서별 지적 항목을 적습니다. 시스템이 보고서 내용을 자동으로 옮기지 않습니다 — 담당자가 읽고 판단해 적습니다.',
            script: '여기가 핵심입니다. 보고서를 읽고 “무엇을 시킬지”만 적으면, 그 줄이 곧 부서의 개선조치가 됩니다.',
            modalGuide: '파일명을 그대로 두고 <b>[첨부]</b>를 누르면 작성표가 열립니다.',
            actionLabel: '통합 보고서 첨부 열기',
            action: function () { global.RSKLIST.uploadReport(); },
            done: function () {
                var a = A(); var st = a && a.review && a.review.stage;
                if (st === 'DELIVERED') return true;
                return st === 'REVIEW' && validRows() > 0;
            },
            note: function () {
                var a = A(); if (!a) return '평가 생성 후';
                var st = a.review && a.review.stage;
                if (st === 'DELIVERED') return '전달 완료';
                if (st === 'REVIEW') return '작성 ' + validRows() + '건 (이름·개선조치가 모두 있는 행)';
                return '보고서 미첨부';
            }
        },
        {
            key: 'deliver', label: '전달', page: 'rsk-list.html',
            persona: function () { return OWNER_P; },
            href: function () { return 'rsk-list.html'; },
            selector: '[data-tour="rsk-deliver"]',
            title: '조치기한 설정 · 부서 전달',
            where: '작성표 아래 <b>[작성완료 · 조치기한 설정 →]</b>',
            clickPath: [
                '[작성완료 · 조치기한 설정 →] — 작성 행이 0건이면 비활성입니다',
                '기한을 넣고 [일괄 적용] (부서별로 다르면 각 행에서 수정)',
                '[전달 실행] — 이 순간 개선조치가 부서 할 일로 배분됩니다'
            ],
            desc: '전달하는 순간 부서별 개선조치가 만들어지고 담당자의 내 할일에 꽂힙니다.',
            script: '공문으로 “조치하세요” 하고 끝나던 걸, 기한이 붙은 할 일로 각 부서에 배분합니다.',
            modalGuide: '<b>일괄 적용</b>으로 한 번에 기한을 넣고 <b>[전달 실행]</b>을 누르세요.',
            actionLabel: '조치기한 설정 열기',
            action: function () { global.RSKLIST.openDueSet(); },
            done: function () {
                var a = A();
                return !!(a && a.review && a.review.stage === 'DELIVERED') && imps().length > 0;
            },
            note: function () {
                var a = A(); if (!a) return '평가 생성 후';
                var n = a ? D().improvementsFor(a.id).length : 0;
                return n ? '개선조치 ' + n + '건 전달됨' : '전달 전';
            }
        },
        {
            key: 'complete', label: '조치완료', page: 'my-work.html',
            persona: deptPersona,
            scopeDept: demoDept,
            href: function () { return 'my-work.html?dept=' + demoDept() + '&cat=improve'; },
            selector: '[data-tour="mw-improve"]',
            title: '부서가 개선조치를 완료',
            where: '<b>내 할일</b>의 개선조치 카드에서 <b>[완료 처리]</b>',
            clickPath: [
                '개선조치 카드의 [완료 처리]',
                '조치 내용·완료일을 적고 개선 후 사진을 올립니다',
                '담당자 전자서명까지 채워야 [완료 처리]가 저장됩니다'
            ],
            desc: '개선 전·후 사진과 담당자 서명을 붙여야 완료가 됩니다. 사진 없이 “했다”만으로는 끝나지 않습니다.',
            script: '증빙이 붙은 완료만 인정합니다. 이 사진이 그대로 뒤에서 만들 공문의 근거가 됩니다.',
            modalGuide: '개선 후 사진과 서명이 모두 있어야 저장됩니다.',
            actionLabel: '내 할일에서 개선조치 보기',
            action: function () { location.href = 'my-work.html?dept=' + demoDept() + '&cat=improve'; },
            done: function () {
                var ms = imps();
                return ms.length > 0 && ms.every(function (m) { return m.status === 'DONE'; });
            },
            note: function () {
                var ms = imps();
                if (!ms.length) return '전달 대기';
                var n = ms.filter(function (m) { return m.status === 'DONE'; }).length;
                return deptNm() + ' ' + n + ' / ' + ms.length + '건 완료';
            }
        },
        {
            key: 'confirm', label: '완료확인', page: 'rsk-list.html',
            persona: function () { return OWNER_P; },
            href: function () { return 'rsk-list.html'; },
            selector: '[data-tour="rsk-confirm"]',
            title: '주관부서가 증빙을 열어 보고 확인',
            where: '표 위 노란 띠의 <b>[확인 대기 건만 보기 →]</b>',
            clickPath: [
                '[확인 대기 건만 보기 →]',
                '개선 전·후 사진을 열어 봅니다',
                '[열람했습니다] 체크 → [확인] (문제가 있으면 사유를 적어 [반려])'
            ],
            desc: '부서가 완료를 눌렀다고 끝이 아닙니다. 증빙을 확인해야 공문을 기안할 수 있습니다.',
            script: '여기가 종전에 비어 있던 자리입니다 — 아무도 확인하지 않고 평가가 끝나던 구멍을 메웠습니다.',
            modalGuide: '사진을 열어 본 뒤 <b>열람했습니다</b>를 체크해야 <b>[확인]</b>이 열립니다.',
            actionLabel: '확인 대기 건 열기',
            action: function () { global.RSKLIST.openConfirmQueue(); },
            done: function () { var a = A(); return !!a && D().docReady(a.id); },
            note: function () {
                var a = A(); if (!a) return '전달 후';
                var c = D().confirmCount(a.id);
                if (!c.total) return '전달된 개선조치 없음';
                return '확인 ' + c.ok + ' / ' + c.total +
                    (c.wait ? ' · 대기 ' + c.wait : '') + (c.returned ? ' · 반려 ' + c.returned : '');
            }
        },
        {
            key: 'draft', label: '공문', page: 'rsk-list.html',
            persona: function () { return OWNER_P; },
            href: function () { return 'rsk-list.html'; },
            selector: '[data-tour="rsk-doc"]',
            title: '공문 기안 → 미리보기 → 상신',
            where: '<b>온나라 이관</b> 띠의 <b>[공문 기안]</b>',
            clickPath: [
                '[공문 기안] — 전 건 확인이 끝나야 활성화됩니다',
                '제목·수신·본문을 직접 입력합니다 (자동 생성하지 않습니다)',
                '[문서 미리보기 →] 로 넘어가면 그 화면에 [상신]이 있습니다'
            ],
            desc: '표준 기안문 서식으로 본문을 쓰고, 확인된 조치 결과를 붙임으로 엮어 상신합니다.',
            script: '시스템이 하는 일은 여기까지입니다 — 양식을 갖추고 붙임을 엮어 온나라로 넘기는 것. 결재는 온나라에서 이뤄집니다.',
            modalGuide: '본문은 <b>직접 타이핑</b>합니다. 시스템은 붙임을 엮고 수치를 세어 ‘삽입’ 칩으로 건네줄 뿐입니다.',
            actionLabel: '공문 기안 열기',
            action: function () {
                var a = A(); if (!a) return;
                if (!D().docReady(a.id)) { toast('전 건 확인이 끝나야 기안할 수 있습니다 (7단계).'); return; }
                global.DYRSKDOC.open(a.id);
            },
            done: function () { return !!doc(); },
            note: function () { var d = doc(); return d ? d.no + ' · ' + d.status : '미기안'; }
        },
        {
            key: 'receive', label: '결재회신', page: 'rsk-list.html',
            persona: function () { return OWNER_P; },
            href: function () { return 'rsk-list.html'; },
            selector: '[data-tour="rsk-doc"]',
            title: '온나라 결재 결과 수신 (시연)',
            where: '<b>온나라 이관</b> 띠의 <b>[결재 상태]</b>',
            clickPath: [
                '[결재 상태]',
                '시연용 [결재 완료 회신] — 실제로는 온나라가 결과를 보내옵니다'
            ],
            desc: '우리 시스템은 온나라에 요청하고 결재값을 받아오기만 합니다. 반려되면 문서를 새로 만들어 다시 올립니다.',
            script: '온나라 연동은 아직 시연용 시뮬레이션입니다 — 실연동 방식은 발주처 확정 대기 항목입니다.',
            actionLabel: '결재 상태 열기',
            action: function () {
                var a = A(); if (!a) return;
                if (!doc()) { toast('먼저 8단계에서 공문을 기안·상신하세요.'); return; }
                global.DYRSKDOC.openStatus(a.id);
            },
            done: function () { var d = doc(); return !!d && d.status === '결재완료'; },
            note: function () { var d = doc(); return d ? '현재 ' + d.status : '기안 후'; }
        }
    ];

    /* =================== 상태 =================== */
    function stateIdx() {
        try {
            var raw = sessionStorage.getItem(SKEY);
            if (raw == null) return -1;
            var i = parseInt(raw, 10);
            return (i >= 0 && i < STEPS.length) ? i : -1;
        } catch (e) { return -1; }
    }
    function setIdx(i) { try { sessionStorage.setItem(SKEY, String(i)); } catch (e) {} }
    function clearIdx() { try { sessionStorage.removeItem(SKEY); } catch (e) {} }
    function active() { return stateIdx() >= 0; }
    function pageFile() { return (location.pathname.split('/').pop() || 'index.html'); }
    function onStepPage(s) { return pageFile() === s.page; }
    function safeDone(s) { try { return !!s.done(); } catch (e) { return false; } }
    function safeNote(s) { try { return s.note ? s.note() : ''; } catch (e) { return ''; } }
    function personaId(s) { try { return s.persona(); } catch (e) { return OWNER_P; } }
    /* 앞에서부터 처음으로 안 끝난 단계 */
    function currentIdx() {
        for (var i = 0; i < STEPS.length; i++) { if (!safeDone(STEPS[i])) return i; }
        return STEPS.length;
    }
    function doneCount() { var n = 0; STEPS.forEach(function (s) { if (safeDone(s)) n++; }); return n; }

    /* =================== 페르소나 =================== */
    function personaOf(id) {
        var list = (R() && R().PERSONAS) || [];
        for (var i = 0; i < list.length; i++) { if (list[i].id === id) return list[i]; }
        return null;
    }
    function personaLabel(id) { var p = personaOf(id); return p ? (p.name + ' ' + p.role) : id; }
    /* 받침에 맞는 조사만 돌려준다 — '주무관로'/'소장로' 같은 오식을 막는다 */
    function josa(word, withJong, withoutJong) {
        var s = String(word == null ? '' : word).trim();
        if (!s) return withJong;
        var c = s.charCodeAt(s.length - 1);
        var has = (c >= 0xac00 && c <= 0xd7a3) ? ((c - 0xac00) % 28) > 0 : false;
        return has ? withJong : withoutJong;
    }
    function curPersonaId() { var p = R() && R().current ? R().current() : null; return p ? p.id : ''; }
    /* 전환이 필요하면 localStorage 만 바꾸고 true 를 돌려준다 — 이동은 호출자가 한다.
       DYROLE.set() 을 쓰지 않는 이유: 그쪽은 자체적으로 reload/index 이동을 해서
       투어가 가려는 화면을 덮어쓴다. */
    function applyPersona(s) {
        var want = personaId(s);
        if (!want || curPersonaId() === want) return false;
        try { localStorage.setItem(ROLE_KEY, want); } catch (e) {}
        return true;
    }

    /* =================== 강조 =================== */
    /* 대상 요소가 없을 때 **왜 없는지**를 말한다.
       아무 데도 안 가리키는 투어는 안내가 아니라 소음이다. */
    function whyMissing(s, i) {
        var want = personaId(s);
        if (curPersonaId() !== want) {
            var wl = personaLabel(want);
            return '지금 관점(' + personaLabel(curPersonaId()) + ')에는 이 버튼이 없습니다 — ' +
                wl + josa(wl, '으로', '로') + ' 바꾸세요.';
        }
        if (safeDone(s)) return '이미 끝난 단계라 그 버튼은 화면에서 사라졌습니다.';
        if (!onStepPage(s)) return '이 단계는 다른 화면(' + s.page + ')에 있습니다.';
        if (s.scopeDept && R() && R().inScope && !R().inScope(s.scopeDept())) {
            return '조회 범위 밖 부서라 화면에 표시되지 않습니다.';
        }
        if (i > 0 && !safeDone(STEPS[i - 1])) return '앞 단계 「' + STEPS[i - 1].title + '」가 끝나야 나타납니다.';
        return '화면을 다시 그리는 중이거나, 이 화면에 아직 없는 요소입니다.';
    }

    /* idempotent — 몇 번 불려도 결과가 같다. DOM 참조를 보관하지 않고 매번 새로 조회한다.
       RSKLIST.render() 가 innerHTML 을 통째로 갈아끼우므로 참조를 들면 반드시 끊긴다. */
    function applyFocus() {
        document.querySelectorAll('.dy-tour-focus').forEach(function (el) {
            el.classList.remove('dy-tour-focus');
            if (el.getAttribute('aria-describedby') === 'rsk-tour-desc') el.removeAttribute('aria-describedby');
        });
        var why = document.getElementById('rsk-tour-why');
        var idx = stateIdx();
        var s = STEPS[idx];
        if (!s || document.getElementById('v2-modal')) return;
        var el = onStepPage(s) && curPersonaId() === personaId(s) ? document.querySelector(s.selector) : null;
        if (!el) { if (why) { why.hidden = false; why.innerHTML = '⚠ ' + esc(whyMissing(s, idx)); } return; }
        if (why) why.hidden = true;
        el.classList.add('dy-tour-focus');
        el.setAttribute('aria-describedby', 'rsk-tour-desc');
    }
    function scrollToTarget() {
        var s = STEPS[stateIdx()]; if (!s) return;
        var el = document.querySelector(s.selector); if (!el) return;
        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }

    /* =================== 패널 =================== */
    function removePanel() { var o = document.getElementById('rsk-tour-panel'); if (o) o.remove(); }

    function renderStep() {
        lastSig = doneSig();   /* 첫 렌더가 곧바로 자동 진행을 부르지 않도록 기준을 맞춘다 */
        removePanel();
        var idx = stateIdx();
        var s = STEPS[idx];
        if (!s) return;
        var want = personaId(s);
        var wrongWho = curPersonaId() !== want;
        var onPage = onStepPage(s);
        var done = safeDone(s);

        var panel = document.createElement('aside');
        panel.id = 'rsk-tour-panel';
        panel.className = 'dy-tour-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'false');       /* 모달이 아니다 — §1 위반이 아니다 */
        panel.setAttribute('aria-labelledby', 'rsk-tour-title');
        panel.setAttribute('aria-describedby', 'rsk-tour-desc');
        /* 대상이 오른쪽에 있으면 패널을 왼쪽으로 — 폭 기준은 §8 표준(md) */
        var t = onPage ? document.querySelector(s.selector) : null;
        if (t && !V().below('md')) {
            var r = t.getBoundingClientRect();
            if (r.left + r.width / 2 > window.innerWidth / 2) panel.classList.add('is-left');
        }

        var actionBtn;
        if (wrongWho) {
            actionBtn = '<button class="btn btn-primary dy-tour-action" type="button" onclick="RSKTOUR.go(' + idx + ')">' +
                esc(personaLabel(want)) + ' 관점으로 전환 →</button>';
        } else if (!onPage) {
            actionBtn = '<button class="btn btn-primary dy-tour-action" type="button" onclick="RSKTOUR.go(' + idx + ')">이 단계 화면으로 이동 →</button>';
        } else {
            actionBtn = '<button class="btn btn-primary dy-tour-action" type="button" onclick="RSKTOUR.action()">' +
                esc(s.actionLabel) + '</button>';
        }

        panel.innerHTML =
            '<div class="dy-tour-head"><div class="dy-tour-head-main">' +
                '<div class="dy-tour-kicker">' + year() + ' 정기 위험성평가 · ' + doneCount() + ' / ' + STEPS.length + '단계' +
                    (done ? ' · <b>이 단계 완료</b>' : '') + '</div>' +
                '<div class="dy-tour-title" id="rsk-tour-title" tabindex="-1">' + (idx + 1) + '. ' + esc(s.title) + '</div></div>' +
                '<button class="dy-tour-close" type="button" onclick="RSKTOUR.stop()">가이드 종료</button></div>' +
            '<div class="dy-tour-steps" aria-label="시연 단계">' + STEPS.map(function (x, i) {
                return '<button type="button" class="dy-tour-step' + (safeDone(x) ? ' done' : '') + (i === idx ? ' active' : '') + '"' +
                    (i === idx ? ' aria-current="step"' : '') +
                    ' title="' + esc((i + 1) + '. ' + x.title) + '" onclick="RSKTOUR.go(' + i + ')">' + esc(x.label) + '</button>';
            }).join('') + '</div>' +
            '<div class="dy-tour-who' + (wrongWho ? ' is-warn' : '') + '">' + (wrongWho
                ? '지금은 <b>' + esc(personaLabel(want)) + '</b> 차례입니다 — 아래 버튼을 누르면 관점을 바꿔 이어서 진행합니다.'
                : '<b>' + esc(personaLabel(want)) + '</b> 관점 · ' + esc(safeNote(s))) + '</div>' +
            '<div class="dy-tour-where">여기를 누르세요 — ' + s.where + '</div>' +
            '<ol class="dy-tour-path">' + (s.clickPath || []).map(function (c) {
                return '<li>' + esc(c) + '</li>';
            }).join('') + '</ol>' +
            '<div class="dy-tour-desc" id="rsk-tour-desc">' + esc(s.desc) + '</div>' +
            '<div class="dy-tour-why" id="rsk-tour-why" hidden></div>' +
            '<div class="dy-tour-script"><b>시연 멘트</b>' + esc(s.script) + '</div>' +
            actionBtn +
            '<div class="dy-tour-foot"><span class="dy-tour-progress">' + (idx + 1) + ' / ' + STEPS.length + '</span>' +
                '<button class="btn btn-secondary btn-sm" type="button" onclick="RSKTOUR.openFlow()">전체 흐름</button>' +
                (idx ? '<button class="btn btn-secondary btn-sm" type="button" onclick="RSKTOUR.prev()">이전</button>' : '') +
                '<button class="btn btn-secondary btn-sm" type="button" onclick="' +
                    (idx === STEPS.length - 1 ? 'RSKTOUR.stop()' : 'RSKTOUR.next()') + '">' +
                    (idx === STEPS.length - 1 ? '마치기' : '다음') + '</button></div>';
        document.body.appendChild(panel);
        applyFocus();
        scrollToTarget();
        syncModalState();
        setTimeout(function () {
            var el = document.getElementById('rsk-tour-title');
            if (el && !document.getElementById('v2-modal')) el.focus({ preventScroll: true });
        }, 0);
    }

    /* 모달이 뜨면 패널을 숨기고, 모달 본문 맨 위에 그 단계의 시연 포인트를 넣는다 (§1) */
    function syncModalState() {
        var panel = document.getElementById('rsk-tour-panel');
        var modal = document.getElementById('v2-modal');
        if (panel) {
            panel.hidden = !!modal;
            if (modal) panel.setAttribute('aria-hidden', 'true'); else panel.removeAttribute('aria-hidden');
        }
        if (modal && active()) {
            var s = STEPS[stateIdx()];
            var body = modal.querySelector('.modal-body');
            if (s && s.modalGuide && body && !body.querySelector('.dy-tour-inline')) {
                var g = document.createElement('div');
                g.className = 'dy-tour-inline';
                g.innerHTML = '<b>시연 포인트</b>' + s.modalGuide +
                    (s.modalAction
                        ? '<button type="button" class="btn btn-outline btn-sm dy-tour-inline-act" onclick="' +
                          s.modalAction.fn + '">' + esc(s.modalAction.label) + '</button>'
                        : '');
                body.insertBefore(g, body.firstChild);
            }
        }
    }

    /* 재렌더·자동 진행 대응 —
       RSKLIST.render() 는 20곳 이상에서 불려 innerHTML 을 갈아끼운다. 화면 모듈에
       `RSKTOUR.onEvent()` 훅을 심는 방식(EDUTOUR)은 저장 경로가 화면마다 갈려 있어
       (③은 my-work·rsk-list 2경로, ⑥은 my-work·rsk-imp-detail 2경로) 반드시 새는
       경로가 생긴다. 그래서 **완료 판정 자체의 변화를 감지**한다 — 어느 경로로
       저장했든, 심지어 가이드를 끄고 손으로 처리해도 똑같이 잡힌다.

       childList+subtree 만 보고 attributes 는 안 보므로 classList.add 가 관찰자를
       다시 깨우지 않는다. renderStep() 이 패널을 append 하면 관찰자가 한 번 더
       돌지만 그때는 signature 가 같아 applyFocus() 만 하고 끝난다 — 무한 루프가
       구조적으로 불가능하다. */
    function doneSig() { return STEPS.map(function (s) { return safeDone(s) ? '1' : '0'; }).join(''); }
    var lastSig = '';
    var raf = 0;
    new MutationObserver(function () {
        if (!active() || raf) return;
        raf = requestAnimationFrame(function () {
            raf = 0;
            syncModalState();
            var s = doneSig();
            if (s === lastSig) { applyFocus(); return; }
            lastSig = s;
            var i = stateIdx();
            /* 모달이 떠 있으면 사용자가 아직 입력 중이다 — 밀지 않는다 */
            if (!document.getElementById('v2-modal') && safeDone(STEPS[i]) && i + 1 < STEPS.length) {
                /* 저장 토스트가 보이도록 잠깐 두고 넘어간다 (EDUTOUR 와 같은 700ms) */
                setTimeout(function () { if (active() && stateIdx() === i) go(i + 1); }, 700);
                return;
            }
            renderStep();
        });
    }).observe(document.body, { childList: true, subtree: true });

    /* =================== 전체 흐름 보드 ===================
       "순차적으로 체크해 볼 수 있는" 화면. 단계 표시는 이미 있는 .rl-my-step 계열을
       그대로 쓴다 — 같은 요소를 새 계열로 다시 만들지 않는다(§7). */
    function openFlow() {
        var cur = currentIdx();
        var rows = STEPS.map(function (s, i) {
            var d = safeDone(s);
            var now = !d && i === cur;
            var locked = !d && i > cur;
            return '<li class="rl-my-step' + (d ? ' is-done' : '') + (now ? ' is-now' : '') + '">' +
                '<span class="rl-my-no">' + (d ? '✓' : (i + 1)) + '</span>' +
                '<span class="rl-my-body">' +
                    '<b>' + esc(s.title) + '</b>' +
                    '<span class="rl-my-who">' + esc(personaLabel(personaId(s))) + '</span>' +
                    '<span class="rl-my-note">' + esc(safeNote(s)) + '</span>' +
                '</span>' +
                '<span class="rl-my-act">' +
                    '<button type="button" class="btn btn-outline btn-sm" onclick="RSKTOUR.goFromFlow(' + i + ')">' +
                        (d ? '다시 보기' : (now ? '여기서 시작 →' : '이 단계로')) + '</button>' +
                '</span>' +
                (locked ? '' : '') +
            '</li>';
        }).join('');

        var n = doneCount();
        var pct = Math.round(n / STEPS.length * 100);
        V().openModal(year() + '년 정기 위험성평가 — 전체 흐름 ' + STEPS.length + '단계',
            '<div class="dy-tour-flow">' +
                '<p class="dy-tour-flow-lead">체크는 <b>실제 데이터로 판정</b>합니다 — 가이드를 껐다 켜도, 손으로 먼저 처리해도 그대로 맞습니다.</p>' +
                '<div class="progress" role="img" aria-label="진행 ' + pct + '퍼센트">' +
                    '<div class="progress-bar green" style="width:' + pct + '%;"></div></div>' +
                '<p class="dy-tour-flow-lead"><b>' + n + ' / ' + STEPS.length + '단계</b> 완료' +
                    (cur >= STEPS.length
                        ? ' — 전 과정이 끝났습니다.'
                        : ' · 다음 차례는 <b>' + esc(personaLabel(personaId(STEPS[cur]))) + '</b>') + '</p>' +
                '<ol class="rl-my-steps">' + rows + '</ol>' +
                '<p class="dy-tour-flow-note">시연 대상 부서는 <b>' + esc(deptNm()) + '</b> 기준입니다. ' +
                    '대상 부서가 많으면 공문 기안 조건(전 부서 확인 완료)을 채우느라 시연이 끝나지 않으니, ' +
                    '생성 단계에서 한 곳만 고르세요.</p>' +
            '</div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
            (cur < STEPS.length
                ? '<button type="button" class="btn btn-primary" onclick="RSKTOUR.goFromFlow(' + cur + ')">' +
                  (active() ? '이어서 진행 →' : '가이드 시작 →') + '</button>'
                : ''));
    }
    function goFromFlow(i) { V().closeModal(); go(i); }

    /* =================== 진행 제어 =================== */
    function go(i) {
        if (i < 0 || i >= STEPS.length) { stop(); return; }
        setIdx(i);
        var s = STEPS[i];
        var switched = applyPersona(s);
        if (!onStepPage(s) || switched) { location.href = s.href(); return; }
        renderStep();
    }
    function next() { if (active()) go(stateIdx() + 1); }
    function prev() { if (active()) go(stateIdx() - 1); }
    function action() {
        var s = STEPS[stateIdx()];
        if (s && typeof s.action === 'function') s.action();
    }
    function stop() {
        clearIdx();
        lastSig = '';
        removePanel();
        document.querySelectorAll('.dy-tour-focus').forEach(function (el) { el.classList.remove('dy-tour-focus'); });
    }
    function start() { V().closeModal(); go(Math.min(currentIdx(), STEPS.length - 1)); }

    /* 1단계 모달 도우미 — 마법사 부서 선택을 시연용으로 한 곳만 남긴다 */
    function pickDemoDept() {
        var sel = global.RSKLIST && global.RSKLIST.wizSelDepts ? global.RSKLIST.wizSelDepts() : null;
        if (!sel) { toast('부서 선택 단계에서만 쓸 수 있습니다.'); return; }
        var pick = 'water';
        Object.keys(sel).forEach(function (k) { delete sel[k]; });
        sel[pick] = true;
        if (global.ORGPICK && global.ORGPICK.refreshDepts) global.ORGPICK.refreshDepts('rl-w-orgtree');
        toast(D().deptName(pick) + ' 한 곳만 선택했습니다.');
    }

    /* =================== 진입 바 =================== */
    function insertBar() {
        if (document.getElementById('rsk-tour-bar')) return;
        var main = document.querySelector('main');
        if (!main) return;
        var n = doneCount();
        var bar = document.createElement('div');
        bar.className = 'dy-demo-bar';
        bar.id = 'rsk-tour-bar';
        bar.innerHTML =
            '<div class="dy-demo-copy">' +
                '<strong>정기 위험성평가 흐름 시연 — ' + STEPS.length + '단계 (현재 ' + n + '/' + STEPS.length + ')</strong>' +
                '<span>생성 → 설문조사표 → 부서 제출 → 보고서 검수 → 전달 → 조치 완료 → 완료 확인 → 공문 기안 → 결재 회신. ' +
                    '가이드가 <b>어디를 누를지</b> 짚어 주고, 부서 담당자 차례가 오면 관점도 알아서 바꿔 줍니다.</span>' +
            '</div>' +
            '<div class="dy-demo-actions">' +
                '<button class="btn btn-primary" type="button" onclick="RSKTOUR.start()">시연 가이드 시작</button>' +
                '<button class="btn btn-outline" type="button" onclick="RSKTOUR.openFlow()">전체 흐름 보기</button>' +
            '</div>';
        main.insertBefore(bar, main.firstChild);
    }

    /* =================== 키보드 =================== */
    document.addEventListener('keydown', function (e) {
        if (!active() || document.getElementById('v2-modal')) return;
        var tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '';
        if (['input', 'textarea', 'select'].indexOf(tag) >= 0) return;
        if (e.key === 'Escape') stop();
        if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    });

    /* =================== 부트 ===================
       opts.bar — 진입 바를 그릴지. 위험성평가 화면에서만 true.
       my-work 처럼 여러 도메인이 모이는 화면에는 바를 넣지 않고,
       가이드가 진행 중일 때만 패널이 뜬다. */
    function boot(opts) {
        opts = opts || {};
        if (opts.bar) insertBar();
        if (active()) renderStep();
    }

    global.RSKTOUR = {
        boot: boot, start: start, stop: stop, openFlow: openFlow, goFromFlow: goFromFlow,
        go: go, next: next, prev: prev, action: action,
        pickDemoDept: pickDemoDept, active: active, STEPS: STEPS
    };
})(window);
