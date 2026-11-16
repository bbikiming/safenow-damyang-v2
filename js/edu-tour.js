/* =====================================================================
   edu-tour.js · 안전보건교육 단계별 안내 (전역 EDUTOUR)

   ⚠ CLAUDE.md §4 — **발표용 핵심 자산 · 제거 금지.**
   2026-08-04 에 엔진을 js/tour-core.js(DYTOUR)로 이관했다. 이 파일은
   **단계 정의와 교육 고유 동작(데이터 복원)** 만 갖는다.

   **공개 API 12개는 계약이다** — edu 화면 HTML 9곳이 EDUTOUR.boot() 를 부르고,
   패널·바의 인라인 onclick 이 'EDUTOUR.xxx()' 문자열을 쓰며, edu-reg.js·
   edu-reg-detail.js 5곳이 EDUTOUR.onEvent() 를 부른다. 이름을 바꾸지 말 것.
     boot · start · stop · go · next · prev · action · onEvent
     restoreAndStart · resetDemo · confirmReset · active

   이관하며 달라진 것 (동작은 보존, 판정만 개선)
     · 진행 판정이 **커서 인덱스 → 실데이터 파생(done())** 로 바뀌었다.
       종전에는 뒤로 가면 완료 표시가 풀리고, 가이드를 끄고 손으로 처리한 건이
       안 잡혔다. 이제 DYEDU 를 그대로 읽는다.
     · onEvent() 는 **무동작**이다. 자동 진행을 done() 변화로 감지하므로 훅이
       필요 없다. 호출부 5곳은 계약이라 그대로 두고, 여기서 흡수한다.
     · 전체 흐름 보드(openFlow)·클릭 경로·요구 페르소나·앵커 미탐 사유가 생겼다.
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var E = function () { return global.DYEDU; };
    function toast(m) { V().toast(m); }

    /* 교육은 재난안전과 담당자(박안전)가 전 과정을 운전한다 —
       부서 신청도 이 화면에서 조직도로 부서를 골라 대신 등록하는 시연이라
       위험성평가처럼 페르소나를 오가지 않는다. */
    var OWNER_P = 'staff';
    function ownerP() { return OWNER_P; }
    /* 2단계(참석자 등록부)는 **부서의 일**이다 — 부서 담당자로 접속하면 그 사람의 단계로 본다.
       그러면 부서 담당자는 «조회 전용»이 아니라 «내 역할» 관점을 받는다(등록부만 커서가 머문다).
       재난안전과 담당자(발표자)에게는 종전과 같이 자기 단계라 페르소나를 오가지 않는다(대리·일괄 등록). */
    function curP() { var R = global.DYROLE; return R && R.current ? R.current() : null; }
    function deptP() {
        var p = curP();
        return (p && p.tier === 'staff' && p.id !== OWNER_P && p.deptId && p.deptId !== (global.DYROLE.OWNER_DEPT || 'safety')) ? p.id : OWNER_P;
    }
    function myDeptOnly() { return deptP() !== OWNER_P; }

    /* ── 시연 대상 집합교육 ──
       시연 중 만든 교육은 addCourse 가 'C-2101' 처럼 **숫자 id** 를 준다.
       시드는 'C-M11' 형태라 둘을 구분할 수 있다. 시연 중 만든 것이 있으면
       그것을, 없으면 시드의 접수 중(OPEN) 교육을 따라간다.
       (대상 id 를 저장하지 않는 이유는 진행 판정과 같다 — 저장하면 초기화·
        재시연 때 옛 id 를 가리킨 채 멈춘다.) */
    function demoCourse() {
        var list = E().courses({ kind: 'REG_GROUP' }) || [];
        var made = list.filter(function (c) { return /^C-\d+$/.test(c.id); });
        if (made.length) {
            return made.slice().sort(function (a, b) {
                return (parseInt(b.id.slice(2), 10) || 0) - (parseInt(a.id.slice(2), 10) || 0);
            })[0];
        }
        /* 폴백은 '접수 중'이 아니라 **가장 최근 집합교육**이다(courses() 는 date 내림차순).
           OPEN 만 보면 3단계에서 종료 처리하는 순간 추적 대상을 잃어 전 단계 체크가
           한꺼번에 풀린다 — 실제로 그 결함을 냈다. */
        /* 다만 아직 교육 전인 건(12월)은 등록부 단계를 돌 수 없으므로, 이미 끝난(일자가 오늘 이전인)
           가장 최근 교육을 먼저 본다 — 11월 교육(등록부 받는 중)이 따라갈 대상이 된다. */
        var today = V().today();
        return list.filter(function (c) { return (E().lastSessionDate(c) || c.date) <= today; })[0] || list[0] || null;
    }
    function courseId() { var c = demoCourse(); return c ? c.id : ''; }
    /* 종전 start() 가 쓰던 판정 — 접수 중 집합교육이 없으면 시연을 못 돈다 */
    function openCourse() {
        var list = E().courses({ kind: ['REG_GROUP'], status: 'OPEN' }) || [];
        return list.length ? list[0] : null;
    }
    function enrollCount() {
        var id = courseId(); if (!id) return { depts: 0, people: 0 };
        var es = E().enrolls(id) || [];
        var n = 0; es.forEach(function (e) { n += (e.workerIds || []).length; });
        return { depts: es.length, people: n };
    }
    function recCount() {
        var id = courseId(); if (!id) return 0;
        return (E().records() || []).filter(function (r) { return r.courseId === id; }).length;
    }
    function courseLabel() {
        var c = demoCourse();
        if (!c) return '접수 중인 집합교육 없음';
        return c.id + ' · ' + (c.date || '') + ' · ' + (c.status !== 'OPEN' ? '종료' : (E().enrollOpen && E().enrollOpen(c) ? '등록부 받는 중' : '교육 전'));
    }

    /* 과정별 공문 흐름(2026-11-16 임영준 주무관 통화) — 7걸음.
       진행 판정은 지금처럼 데이터 파생(공문 기록 존재)이다 — 손으로 처리해도 단계가 넘어간다. */
    function sent(key) { return E().docState && E().docState(key) === 'sent'; }
    function myDept() { var p = curP(); return p ? p.deptId : ''; }
    function qKey() { var d = myDeptOnly() ? myDept() : ((global.DYROLE && global.DYROLE.OWNER_DEPT) || 'safety'); var r = E().reportQuarterFor(d); return E().keyQuarter(d, r.q); }
    var STEPS = [
        {
            key: 'create', label: '등록', page: 'edu-reg.html',
            persona: ownerP, href: function () { return 'edu-reg.html'; },
            selector: '[data-tour="reg-create"]',
            title: '재난안전과가 집합교육을 등록',
            where: '목록 위 <b>[＋ 집합교육 등록]</b>',
            clickPath: [
                '[＋ 집합교육 등록]',
                '일자·시작~종료 시각을 회차 탭에 적습니다 — 교육 시간은 회차에서 자동 계산됩니다',
                '제목·강사·장소 · 등록부 기한을 채우고 참석자 명단·교육 자료를 붙인 뒤 [저장하고 안내 공문 작성 →]'
            ],
            desc: '교육을 저장하면 같은 창이 교육 안내 공문으로 바뀝니다.',
            script: '등록하고 바로 온나라 기안을 탑니다 — 과정마다 문서대장에 기록이 남습니다.',
            modalGuide: '<b>이어서 다음 단계를 시연하려면 교육 일자를 오늘 또는 지난 날짜로</b> 넣으세요. 제목·일자를 확인하고 <b>[저장하고 안내 공문 작성 →]</b>을 누르세요.',
            actionLabel: '집합교육 등록 열기',
            action: function () { global.EDUR.openCreate('group'); },
            done: function () { return !!demoCourse(); },
            note: function () { return courseLabel(); }
        },
        {
            key: 'notice', label: '안내 공문', page: 'edu-reg.html',
            persona: ownerP, href: function () { return 'edu-reg.html'; },
            selector: '[data-tour="edu-notice"], .edu-course-card [onclick*="EDUDOC.open(\'N|"]',
            title: '① 교육 안내 공문을 온나라로',
            where: '교육 카드의 <b>[안내 공문 작성]</b>',
            clickPath: ['수신은 대상 부서 전부로 정해져 있습니다', '본문은 조각(교육 개요·참석 대상·등록부 제출 안내)을 눌러 씁니다', '[문서 미리보기 →] → [온나라로 보내기] → [보내기]'],
            desc: '보내는 순간 대상 부서 내 할일에 예정 교육이 뜹니다. 보내기 전에는 부서에 교육이 보이지 않습니다.',
            script: '각 부서에 뿌리는 안내도 공문 연계기안으로 나갑니다.',
            actionLabel: '안내 공문 작성 열기',
            action: function () { var c = demoCourse(); if (c && global.EDUDOC) global.EDUDOC.open(E().keyNotice(c.id)); },
            done: function () { var c = demoCourse(); return !!c && E().noticeSent(c); },
            note: function () { var c = demoCourse(); if (!c) return '교육 등록 후'; return E().noticeSent(c) ? '안내 보냄' : '보내기 전'; }
        },
        {
            key: 'apply', label: '등록부', page: 'edu-reg-detail.html',
            persona: deptP, href: function () { return 'edu-reg-detail.html?id=' + encodeURIComponent(courseId() || 'C-M11'); },
            selector: '[data-tour="apply"], [data-tour="enroll-send"]',
            title: '② 부서가 참석자 등록부 → 제출 공문',
            where: '교육 상세의 <b>[＋ 참석자 등록부 등록]</b>',
            clickPath: [
                '부서는 우리 부서로 정해져 있습니다 — 실제 온 사람을 체크합니다',
                '서명부 — 재난안전과가 올린 서명부를 고르거나 직접 올립니다',
                '[저장하고 공문 작성 →] — 같은 창이 제출 공문으로 바뀝니다 → 미리보기 → [온나라로 보내기]',
                '아무도 참석하지 않았으면 [참석자 없음]'
            ],
            desc: '등록부를 저장하고 제출 공문을 보내야 부서 할 일이 끝납니다.',
            script: '서명부만 올리고 끝나는 것이 아니라 그 과정도 연계를 탑니다.',
            modalGuide: '근로자를 선택하고 서명부를 고른 뒤 <b>[저장하고 공문 작성 →]</b>을 누르세요.',
            actionLabel: '참석자 등록부 등록 열기',
            action: function () { if (global.EDURD) global.EDURD.openApply(); else if (global.EDUR) global.EDUR.openApply(courseId()); },
            done: function () {
                var id = courseId(); if (!id) return false;
                if (myDeptOnly()) return sent(E().keyEnroll(id, myDept())) || !!E().noAttendOf(id, myDept());
                return E().enrolls(id).some(function (e) { return e.flow !== 2 || sent(E().keyEnroll(id, e.deptId)); });
            },
            note: function () {
                var id = courseId(); if (!id) return '교육 등록 후';
                var e = enrollCount();
                return e.depts ? '등록 ' + e.depts + '개 부서 · ' + e.people + '명' : '등록 없음';
            }
        },
        {
            key: 'trip', label: '출장 결과', page: 'edu-reg-detail.html',
            persona: ownerP, href: function () { return 'edu-reg-detail.html?id=' + encodeURIComponent(courseId() || 'C-M11'); },
            selector: '[data-tour="edu-trip"]',
            title: '③ 재난안전과 출장 결과 보고서',
            where: '교육 상세의 <b>[출장 결과 보고서 작성]</b>(재난안전과에는 등록부 대신 이 버튼)',
            clickPath: ['교육 자료(등록 때 파일을 불러옵니다) · 교육 사진 · 참석 인원(대략)', '[저장하고 공문 작성 →] → 미리보기 → [온나라로 보내기]'],
            desc: '재난안전과는 참석자 등록부를 올리지 않고 출장 결과 보고서를 씁니다. 참석 인원은 보고용이고 이수는 부서 등록부로 셉니다.',
            script: '재난안전과 담당자 화면에는 [참석자 등록부 등록] 자리에 [출장 결과 보고서 작성]이 있습니다.',
            actionLabel: '출장 결과 보고서 열기',
            action: function () { if (global.EDURD) global.EDURD.openTrip(); },
            done: function () { var c = demoCourse(); return !!c && E().tripState(c) === 'sent'; },
            note: function () { var c = demoCourse(); if (!c) return '교육 등록 후'; var st = E().tripState(c); return st === 'sent' ? '보고 보냄' : c.trip ? '작성함 · 보내기 전' : '작성 전'; }
        },
        {
            key: 'close', label: '종료', page: 'edu-reg-detail.html',
            persona: ownerP,
            href: function () { return 'edu-reg-detail.html?id=' + encodeURIComponent(courseId() || 'C-M11'); },
            selector: '[data-tour="close"]',
            title: '교육 종료 처리로 이수시간 카운트',
            where: '상세 화면의 <b>[교육 종료 처리]</b>',
            clickPath: ['남은 것(미등록·미기안 부서 수 · 출장 결과 보고)을 확인합니다', '[교육 종료 처리] → [종료 처리]'],
            desc: '등록부에 오른 참석자 전원에게 실제 참석시간이 반영됩니다. 남은 공문은 종료 뒤에도 할 일로 남습니다.',
            script: '종료 처리 한 번으로 등록부에 오른 참석자 전원의 이수시간이 반영됩니다.',
            actionLabel: '교육 종료 처리 열기',
            action: function () { global.EDURD.closeCourse(); },
            done: function () { var c = demoCourse(); return !!c && c.status === 'DONE'; },
            note: function () { var c = demoCourse(); if (!c) return '교육 등록 후'; return c.status === 'DONE' ? '종료 처리됨' : '종료 전'; }
        },
        {
            key: 'status', label: '이수', page: 'edu-status.html',
            persona: ownerP, href: function () { return 'edu-status.html'; },
            selector: '[data-tour="status-summary"]',
            title: '이수현황에 반영된 결과 확인',
            where: '<b>부서별 이수 현황</b> 카드',
            clickPath: ['부서별 완료율이 올라간 것을 확인합니다', '[대상자별 상세]에서 주기·필요·인정·미달을 봅니다'],
            desc: '이수는 이수 기록으로 셉니다 — 공문과 별개입니다.',
            script: '종료 처리한 인원의 인정시간이 바로 반영됩니다.',
            actionLabel: '대상자별 상세 보기',
            action: function () { global.EDUS.setView('detail'); },
            done: function () { var c = demoCourse(); return !!c && c.status === 'DONE' && recCount() > 0; },
            note: function () { var n = recCount(); return n ? '이수기록 ' + n + '건 반영됨' : '종료 처리 후'; }
        },
        {
            key: 'report', label: '분기 보고', page: 'edu-reg.html',
            persona: deptP, href: function () { return 'edu-reg.html?tab=self'; },
            selector: '[data-tour="edu-report"]',
            title: '④ 부서 실시 교육 — 분기 실시 결과 보고 한 장',
            where: '자체교육 탭 위 <b>분기 실시 결과 보고</b> 띠',
            clickPath: ['자체·기타·채용시교육은 등록할 때 공문을 쓰지 않습니다 — 어느 분기 보고에 들어가는지만 보입니다', '[분기 결과 보고 작성] → 실적표·이수자 명단은 별지로 → [온나라로 보내기]'],
            desc: '부서가 분기에 한 장으로 재난안전과에 보냅니다(담양군이 하던 분기 실시 결과 제출과 같다).',
            script: '교육 건마다 공문을 쓰지 않고 분기에 한 장으로 모읍니다.',
            actionLabel: '분기 보고 화면으로',
            action: function () { location.href = 'edu-reg.html?tab=self'; },
            done: function () { return sent(qKey()); },
            note: function () { return sent(qKey()) ? '분기 보고 보냄' : '보내기 전'; }
        }
    ];

    var T = global.DYTOUR.define({
        key: 'edu', ns: 'EDUTOUR', skey: 'dy-edu-tour-v1', steps: STEPS, ownerPersona: 'staff', pageLabels: { 'edu-reg.html': '정기교육', 'edu-reg-detail.html': '정기교육 상세', 'edu-status.html': '이수현황' },
        stepsClass: '',                /* 5단계가 되어 4열 고정을 푼다(위험성평가와 같은 유연 배치) */
        
        kicker: function () { return '안전보건교육'; },
        flowTitle: function () { return '안전보건교육 — 전체 흐름 ' + STEPS.length + '걸음'; },
        flowNote: function () {
            return '추적 중인 교육: <b>' + V().esc(courseLabel()) + '</b>' +
                ' — 새로 등록하면 그 교육을 따라갑니다.<br>' +
                '재난안전과 담당자(안내 공문 · 출장 결과 보고 · 종료)와 부서 담당자(참석자 등록부 · 제출 공문 · 분기 보고)가 나눠 합니다 — 공문을 보내야 그 일이 끝납니다.';
        },
        barTitle: function () { return '안전보건교육 사용법 — ' + STEPS.length + '걸음'; },
        barDesc: function () {
            return '집합교육 등록·안내 공문 → 부서 등록부·제출 공문 → 출장 결과 보고 → 종료 처리 → 이수현황 → 분기 실시 결과 보고까지 ' +
                '실제 화면 흐름 그대로 안내합니다. <b>어디를 누를지</b> 짚어 드립니다.';
        }
    });

    /* ── 계약 보존 ──
       edu 화면 HTML 9곳이 `EDUTOUR.boot()` 를 **인자 없이** 부른다. 종전 boot() 는
       무조건 첫 방문 배너를 그렸으므로 기본값을 { bar: true } 로 맞춘다.
       (DYTOUR 기본은 바 없음 — my-work 처럼 남의 도메인 화면을 위한 값이다.) */
    var baseBoot = T.boot;
    T.boot = function (opts) { baseBoot(opts || { bar: true }); };

    /* ── 교육 고유 동작 — 데이터 복원 ──
       시연을 반복하면 접수 중 교육이 종료되어 2·3단계를 돌 수 없다.
       종전 start() 가 갖고 있던 게이트를 그대로 보존한다. */
    var baseStart = T.start;
    T.start = function () {
        V().closeModal();
        /* 접수 중 집합교육이 하나도 없으면 2·3단계를 돌 수 없다 — 종전 게이트 그대로 */
        if (!openCourse()) {
            V().openModal('예시 데이터 복원',
                '<p style="font-size:var(--fs-13);line-height:1.65;">등록부를 받는 집합교육이 모두 종료되어 등록 단계를 따라갈 수 없습니다. ' +
                '교육 예시 자료를 처음 상태로 복원한 뒤 시작합니다.</p>',
                '<button class="btn btn-secondary" type="button" onclick="DYV2.closeModal()">취소</button>' +
                '<button class="btn btn-primary" type="button" onclick="EDUTOUR.restoreAndStart()">복원 후 시작</button>');
            return;
        }
        /* 종전과 같이 **항상 1단계부터** 시작한다 — 발표자가 아는 흐름을 바꾸지 않는다.
           중간부터 잇고 싶으면 [전체 흐름 보기]에서 그 단계를 고른다. */
        T.go(0);
    };
    T.restoreAndStart = function () {
        E().reset();
        if (global.EDUDOC && global.EDUDOC.reset) global.EDUDOC.reset();   /* 공문도 함께 회수 — 안 지우면 재시연 때 잠긴 채 남는다 */
        V().closeModal();
        T.go(0);
    };
    T.resetDemo = function () {
        /* 버튼을 숨기는 것만으로는 전역 호출로 뚫린다 (§12 와 같은 원칙) */
        if (T.view() === 'read') { toast('조회 전용 관점에서는 예시 데이터를 되돌릴 수 없습니다.'); return; }
        T.stop();
        V().openModal('예시 데이터 되돌리기',
            '<p style="font-size:var(--fs-13);line-height:1.6;">교육 등록·참석자 등록부·종료 처리·실시 결과 공문(결재 이력)과 근로자 명단·독촉 이력 데이터를 처음 상태로 되돌립니다.</p>',
            '<button class="btn btn-secondary" type="button" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" type="button" onclick="EDUTOUR.confirmReset()">되돌리기</button>');
    };
    T.confirmReset = function () {
        if (T.view() === 'read') { toast('조회 전용 관점에서는 예시 데이터를 되돌릴 수 없습니다.'); return; }
        E().reset();
        /* 공문도 함께 되돌린다 — 교육만 되돌리면 지운 교육의 공문이 결재 이력에 남는다 */
        if (global.EDUDOC && global.EDUDOC.reset) global.EDUDOC.reset();
        T.stop();
        location.reload();
    };
    /* 계약 유지용 무동작 — 자동 진행은 done() 변화로 감지하므로 훅이 필요 없다.
       호출부(edu-reg.js 3곳 · edu-reg-detail.js 2곳)는 그대로 둔다. */
    T.onEvent = function () {};

    global.EDUTOUR = T;
    /* baseStart 는 쓰지 않지만 원본 진입점을 남겨 둔다(디버깅용) */
    T._baseStart = baseStart;
})(window);
