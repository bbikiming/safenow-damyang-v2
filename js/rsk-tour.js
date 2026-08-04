/* =====================================================================
   rsk-tour.js · 정기 위험성평가 시연 투어 (전역 RSKTOUR)

   엔진은 js/tour-core.js(DYTOUR) 와 공유한다 — 이 파일은 **단계 정의**만 한다.
   생성부터 온나라 이관까지 9단계. 주관부서(박안전)와 부서 담당자를 오가는
   흐름이라 단계마다 요구 페르소나를 선언하고, 투어가 전환까지 처리한다.

   로드 순서: layout.js → common.js → rsk-data.js → 화면 모듈 → tour-core.js → rsk-tour.js
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYRSK; };
    function toast(m) { V().toast(m); }

    var OWNER_P = 'staff';                    /* 박안전 — 재난안전과 담당자(주관부서) */
    /* 부서 담당자 페르소나가 있는 부서만 시연 대상이 될 수 있다
       (관리감독자 페르소나는 canAct()=false 라 제출·완료를 못 한다) */
    var DEPT_PERSONA = { water: 'wat', env: 'envst', safety: 'staff' };
    var PREF_DEPT = ['water', 'env'];

    function year() { return +String(V().today()).slice(0, 4); }
    function A() { var l = D().assessments(year()) || []; return l[0] || null; }

    /* 시연 대상 부서 — 하드코딩하지 않고 **실제 대상 부서에서 고른다**.
       발표자가 마법사에서 물순환사업소를 안 골랐어도 투어가 죽지 않아야 한다.
       ★ 부서 담당자로 접속했으면 **그 사람의 부서를 먼저** 본다 —
         '내 역할' 관점에서 남의 부서를 따라가면 그건 내 역할이 아니다. */
    function demoDept() {
        var a = A();
        var me = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        var mine = (me && me.tier === 'staff' && me.deptId !== 'safety' && DEPT_PERSONA[me.deptId]) ? me.deptId : '';
        if (!a) return mine || 'water';
        var ids = (a.depts || []).map(function (d) { return d.deptId; });
        if (mine && ids.indexOf(mine) >= 0) return mine;
        if (mine) return mine;   /* 대상 부서가 아니어도 내 부서를 가리킨다 — 그래야 '대상 아님'을 정직하게 말한다 */
        for (var i = 0; i < PREF_DEPT.length; i++) { if (ids.indexOf(PREF_DEPT[i]) >= 0) return PREF_DEPT[i]; }
        for (var j = 0; j < ids.length; j++) { if (DEPT_PERSONA[ids[j]]) return ids[j]; }
        return ids[0] || 'water';
    }
    /* 내 부서가 그 해 평가 대상인가 — 아니면 3·6단계 자체가 없다 */
    function deptListed() {
        var a = A(); if (!a) return false;
        var id = demoDept();
        return (a.depts || []).some(function (x) { return x.deptId === id; });
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
    function ownerP() { return OWNER_P; }
    /* 받침에 맞는 조사 (DYTOUR 가 노출) */
    function jo(w, a, b) { return global.DYTOUR ? global.DYTOUR.josa(w, a, b) : a; }

    var STEPS = [
        {
            key: 'create', label: '생성', page: 'rsk-list.html',
            persona: ownerP, href: function () { return 'rsk-list.html'; },
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
            persona: ownerP, href: function () { return 'rsk-list.html'; },
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
            persona: deptPersona, scopeDept: demoDept,
            href: function () { return 'my-work.html?dept=' + demoDept() + '&cat=risk'; },
            selector: '[data-tour="mw-rskreport"]',
            title: '부서가 설문조사표를 작성해 제출',
            where: '<b>내 할일</b> 목록의 위험성평가 카드에 있는 <b>[작성본 제출]</b>',
            clickPath: [
                '카드의 [작성본 제출] — 제출 모달이 열립니다',
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
                if (!deptListed()) return deptNm() + jo(deptNm(), '은 ', '는 ') + a.year + '년 평가 대상 부서가 아닙니다';
                var p = D().deptReportProgress(a);
                var d = dp();
                return '제출 ' + p.done + ' / ' + p.total + (d && d.reportFile ? ' · ' + deptNm() + ' 제출 완료' : '');
            }
        },
        {
            key: 'review', label: '검수', page: 'rsk-list.html',
            persona: ownerP, href: function () { return 'rsk-list.html'; },
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
            persona: ownerP, href: function () { return 'rsk-list.html'; },
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
                var n = D().improvementsFor(a.id).length;
                return n ? '개선조치 ' + n + '건 전달됨' : '전달 전';
            }
        },
        {
            key: 'complete', label: '조치완료', page: 'my-work.html',
            persona: deptPersona, scopeDept: demoDept,
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
                var a = A();
                if (a && !deptListed()) return deptNm() + jo(deptNm(), '은 ', '는 ') + a.year + '년 평가 대상 부서가 아닙니다';
                var ms = imps();
                if (!ms.length) return '전달 대기';
                var n = ms.filter(function (m) { return m.status === 'DONE'; }).length;
                return deptNm() + ' ' + n + ' / ' + ms.length + '건 완료';
            }
        },
        {
            key: 'confirm', label: '완료확인', page: 'rsk-list.html',
            persona: ownerP, href: function () { return 'rsk-list.html'; },
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
            persona: ownerP, href: function () { return 'rsk-list.html'; },
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
            persona: ownerP, href: function () { return 'rsk-list.html'; },
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

    var T = global.DYTOUR.define({
        key: 'rsk', ns: 'RSKTOUR', skey: 'dy-tour-rsk-v1', steps: STEPS, ownerPersona: 'staff', pageLabels: { 'rsk-list.html': '정기 위험성평가', 'my-work.html': '내 할일' },
        kicker: function () { return year() + ' 정기 위험성평가'; },
        flowTitle: function () { return year() + '년 정기 위험성평가 — 전체 흐름 ' + STEPS.length + '단계'; },
        flowNote: function () {
            var R = global.DYROLE;
            if (R && R.inScope && !R.inScope(demoDept())) {
                return '시연 대상 부서가 <b>조회 범위 밖</b>이라 부서 단계의 진행은 표시하지 않습니다. ' +
                    '소속 부서 몫만 보려면 그 부서 담당자 관점으로 접속하세요.';
            }
            return '시연 대상 부서는 <b>' + V().esc(deptNm()) + '</b> 기준입니다. ' +
                '대상 부서가 많으면 공문 기안 조건(전 부서 확인 완료)을 채우느라 시연이 끝나지 않으니, ' +
                '생성 단계에서 한 곳만 고르세요.';
        },
        barTitle: function () { return '정기 위험성평가 흐름 시연 — ' + STEPS.length + '단계'; },
        barDesc: function () {
            return '생성 → 설문조사표 → 부서 제출 → 보고서 검수 → 전달 → 조치 완료 → 완료 확인 → 공문 기안 → 결재 회신. ' +
                '가이드가 <b>어디를 누를지</b> 짚어 줍니다.';
        }
    });

    /* 1단계 모달 도우미 — 마법사 부서 선택을 시연용으로 한 곳만 남긴다 */
    T.pickDemoDept = function () {
        var sel = global.RSKLIST && global.RSKLIST.wizSelDepts ? global.RSKLIST.wizSelDepts() : null;
        if (!sel) { toast('부서 선택 단계에서만 쓸 수 있습니다.'); return; }
        Object.keys(sel).forEach(function (k) { delete sel[k]; });
        sel.water = true;
        if (global.ORGPICK && global.ORGPICK.refreshDepts) global.ORGPICK.refreshDepts('rl-w-orgtree');
        toast(D().deptName('water') + ' 한 곳만 선택했습니다.');
    };

    global.RSKTOUR = T;
})(window);
