/* =====================================================================
   edu-tour.js · 안전보건교육 시연 투어 (전역 EDUTOUR)

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

    /* ── 시연 대상 집합교육 ──
       시연 중 만든 교육은 addCourse 가 'C-2101' 처럼 **숫자 id** 를 준다.
       시드는 'C-M08' 형태라 둘을 구분할 수 있다. 시연 중 만든 것이 있으면
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
        return list[0] || null;
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
        return c.id + ' · ' + (c.date || '') + ' · ' + (c.status === 'OPEN' ? '접수 중' : '종료');
    }

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
                '강사·장소·내용을 채우고 참석자 명단·교육 자료를 붙인 뒤 [등록]'
            ],
            desc: '과정 일정·시간·강사·장소·내용과 첨부를 한 건으로 등록하면 참석자 등록부 접수가 시작됩니다.',
            script: '엑셀로 나눠 관리하던 월별 교육 일정·계획 문서를 하나의 교육 건으로 등록합니다.',
            modalGuide: '등록 즉시 참석자 등록부 접수가 시작됩니다. 일자·시간·내용을 확인하고 <b>[등록]</b>을 누르세요.',
            actionLabel: '집합교육 등록 열기',
            action: function () { global.EDUR.openCreate('group'); },
            done: function () { return !!demoCourse(); },
            note: function () { return courseLabel(); }
        },
        {
            key: 'apply', label: '신청', page: 'edu-reg.html',
            persona: ownerP, href: function () { return 'edu-reg.html'; },
            /* 접수 중 집합교육이 여러 건이면 [data-tour="apply"] 가 카드마다 붙고
               (edu-reg.js) 목록이 일자 내림차순이라 시드 8월 교육이 먼저 걸린다.
               방금 만든 교육이 아니라 남의 카드를 가리키면, 안내대로 눌러도
               done() 은 계속 false 라 시연이 2단계에서 멈춘다.
               엔진이 selector 를 매번 새로 읽으므로 getter 로 추적 대상만 좁힌다. */
            get selector() {
                var id = courseId();
                return id ? '.edu-course-card[data-course-id="' + id + '"] [data-tour="apply"]'
                          : '[data-tour="apply"]';
            },
            title: '부서가 대상자를 골라 등록부 제출',
            where: '그 교육 카드의 <b>[＋ 참석자 등록부 등록]</b>',
            clickPath: [
                '교육 카드의 [＋ 참석자 등록부 등록]',
                '조직도에서 부서를 고르고 근로자를 체크합니다',
                '서명파일을 첨부해야 [신청 완료]가 열립니다'
            ],
            desc: '부서 담당자가 근로자 명단에서 대상자를 체크하고 서명파일을 올려 신청합니다.',
            script: '서명파일은 신청 시점에 올립니다. 정원·마감·불참 개념 없이 신청 명단이 곧 카운트 대상입니다.',
            modalGuide: '부서를 조직도에서 고르고 근로자를 선택한 뒤 <b>서명파일</b>을 첨부해야 [신청 완료] 조건이 채워집니다.',
            actionLabel: '참석자 등록부 등록 열기',
            action: function () {
                var id = courseId();
                if (!id) { toast('먼저 1단계에서 집합교육을 등록하세요.'); return; }
                global.EDUR.openApply(id);
            },
            done: function () { return enrollCount().depts > 0; },
            note: function () {
                if (!demoCourse()) return '교육 등록 후';
                var e = enrollCount();
                return e.depts ? '신청 ' + e.depts + '개 부서 · ' + e.people + '명' : '신청 없음';
            }
        },
        {
            key: 'close', label: '종료', page: 'edu-reg-detail.html',
            persona: ownerP,
            href: function () { return 'edu-reg-detail.html?id=' + encodeURIComponent(courseId() || 'C-M08'); },
            selector: '[data-tour="close"]',
            title: '교육 종료 처리로 이수시간 카운트',
            where: '상세 화면 오른쪽 위 <b>[교육 종료 처리]</b>',
            clickPath: [
                '신청 현황(부서·인원)을 마지막으로 확인합니다',
                '[교육 종료 처리] → [종료 처리]',
                '이 시점에 신청자 전원에게 교육시간이 반영됩니다 — 되돌릴 수 없습니다'
            ],
            desc: '상세 화면에서 신청 현황 전체를 확인하고 종료 처리하면 신청자 전원에게 교육시간이 반영됩니다.',
            script: '종료 처리 한 번으로 신청자 전원의 이수시간이 자동 반영됩니다 — 사람별 엑셀 합산이 사라집니다.',
            modalGuide: '신청 부서·인원을 마지막으로 확인하고 <b>[종료 처리]</b>를 누르면 전원에게 시간이 카운트됩니다.',
            actionLabel: '교육 종료 처리 열기',
            action: function () { global.EDURD.closeCourse(); },
            done: function () { var c = demoCourse(); return !!c && c.status === 'DONE'; },
            note: function () {
                var c = demoCourse(); if (!c) return '교육 등록 후';
                return c.status === 'DONE' ? '종료 처리됨' : '접수 중 — 종료 전';
            }
        },
        {
            key: 'status', label: '이수', page: 'edu-status.html',
            persona: ownerP, href: function () { return 'edu-status.html'; },
            selector: '[data-tour="status-summary"]',
            title: '이수현황에 반영된 결과 확인',
            where: '<b>부서별 이수 현황</b> 카드 — 완료율이 갱신돼 있습니다',
            clickPath: [
                '부서별 완료율이 방금 카운트한 만큼 올라간 것을 확인합니다',
                '[대상자별 상세]로 넘어가 사이클·필요·인정·미달을 봅니다',
                '미이수자는 같은 화면에서 독촉합니다'
            ],
            desc: '부서별 완료율과 대상자별 사이클·필요·인정·미달이 갱신됩니다. 미이수자는 같은 화면에서 독촉합니다.',
            script: '방금 종료 처리한 인원의 인정시간이 부서별 요약과 대상자별 상세에 바로 반영됩니다.',
            actionLabel: '대상자별 상세 보기',
            action: function () { global.EDUS.setView('detail'); },
            done: function () { var c = demoCourse(); return !!c && c.status === 'DONE' && recCount() > 0; },
            note: function () {
                var c = demoCourse(); if (!c) return '교육 등록 후';
                var n = recCount();
                return n ? '이수기록 ' + n + '건 반영됨' : (c.status === 'DONE' ? '반영 대기' : '종료 처리 후');
            }
        },
        /* ── 5단계 · 공문 기안 → 상신 ─────────────────────────────────────────
         * **아직 구현되지 않은 단계다.** 기획만 끝났고(기획-안전보건교육-온나라결재상신 v1.2 ·
         * SCR-EDU-001 §4-6 · SCR-EDU-004 §4-5) 화면은 없다.
         *
         * 그런데도 흐름 보드에 넣는 이유는, 빼 두면 **교육 업무가 이수현황에서 끝나는 것처럼**
         * 보이기 때문이다. 실제 업무는 거기서 끝나지 않는다 — 실시 결과를 공문으로 올려야 끝난다.
         * "미구현 갭은 그럴듯하게 채우지 말고 화면에 드러낸다"(CLAUDE.md)를 따라, 단계는 두되
         * **없다는 사실과 왜 없는지를 그 자리에서 말한다**. done() 은 영영 false 이고
         * action 은 두지 않는다 — 누를 것이 없는데 버튼을 내면 그게 거짓말이다. */
        {
            key: 'doc', label: '공문', page: 'edu-reg.html',
            persona: ownerP, href: function () { return 'edu-reg.html'; },
            selector: '[data-tour="edu-doc"]',
            planned: true,
            title: '실시 결과를 공문으로 기안 → 온나라 상신',
            where: '교육 카드의 <b>[공문 기안]</b> <span class="chip-status chip-sm warning">기획 완료 · 화면 미구현</span>',
            clickPath: [
                '종료 처리된 교육에서 [공문 기안] → 공문 본문을 직접 씁니다',
                '붙임은 이미 올려 둔 파일에서 고릅니다 — 교육일지·교육사진·부서별 서명파일',
                '이수자 명단은 별지로 붙습니다',
                '[문서 미리보기 →] → [온나라로 결재 상신] → 상신 확인'
            ],
            desc: '교육을 끝냈다고 업무가 끝나는 것이 아니라, 실시 결과를 공문으로 올려야 끝납니다. ' +
                  '본문은 담당자가 직접 쓰고 시스템은 붙임을 엮어 건넵니다. ' +
                  '이 단계는 아직 화면이 없습니다 — 기획만 끝났습니다.',
            script: '지금은 여기서 멈춥니다. 결재 상신을 먼저 붙였다가 “공문 작성 단계 없이 결재만 올라간다”는 지적을 받아 껐고, ' +
                    '공문 작성 화면을 만든 뒤에 다시 엽니다.',
            note: function () {
                var on = global.EDUAPV && global.EDUAPV.submitEnabled && global.EDUAPV.submitEnabled();
                return on ? '상신 열림' : '화면 미구현 — 기획 완료';
            },
            done: function () { return false; }
        }
    ];

    var T = global.DYTOUR.define({
        key: 'edu', ns: 'EDUTOUR', skey: 'dy-edu-tour-v1', steps: STEPS, ownerPersona: 'staff', pageLabels: { 'edu-reg.html': '정기교육', 'edu-reg-detail.html': '정기교육 상세', 'edu-status.html': '이수현황' },
        stepsClass: '',                /* 5단계가 되어 4열 고정을 푼다(위험성평가와 같은 유연 배치) */
        resetLabel: '시연 초기화',
        kicker: function () { return '안전보건교육 시연'; },
        flowTitle: function () { return '안전보건교육 핵심 업무 — 전체 흐름 ' + STEPS.length + '단계'; },
        flowNote: function () {
            return '추적 중인 교육: <b>' + V().esc(courseLabel()) + '</b>' +
                ' — 새로 등록하면 그 교육을 따라갑니다.<br>' +
                '교육은 재난안전과 담당자가 전 과정을 운전합니다 — 부서 신청도 조직도에서 부서를 골라 이 화면에서 시연합니다.';
        },
        barTitle: function () { return '안전보건교육 핵심 업무 시연 — ' + STEPS.length + '단계'; },
        barDesc: function () {
            return '집합교육 등록 → 참석자 등록부 등록(서명 업로드) → 교육 종료 처리 → 이수현황 반영까지 ' +
                '실제 화면 흐름으로 시연합니다. 가이드가 <b>어디를 누를지</b> 짚어 줍니다.';
        }
    });

    /* ── 계약 보존 ──
       edu 화면 HTML 9곳이 `EDUTOUR.boot()` 를 **인자 없이** 부른다. 종전 boot() 는
       무조건 시연 바를 그렸으므로 기본값을 { bar: true } 로 맞춘다.
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
            V().openModal('시연 데이터 준비',
                '<p style="font-size:var(--fs-13);line-height:1.65;">이전 시연에서 접수 중인 집합교육이 모두 종료되었습니다. ' +
                '교육 시연 데이터를 처음 상태로 복원한 뒤 시작합니다.</p>',
                '<button class="btn btn-secondary" type="button" onclick="DYV2.closeModal()">취소</button>' +
                '<button class="btn btn-primary" type="button" onclick="EDUTOUR.restoreAndStart()">복원 후 시연 시작</button>');
            return;
        }
        /* 종전과 같이 **항상 1단계부터** 시작한다 — 발표자가 아는 흐름을 바꾸지 않는다.
           중간부터 잇고 싶으면 [전체 흐름 보기]에서 그 단계를 고른다. */
        T.go(0);
    };
    T.restoreAndStart = function () {
        E().reset();
        V().closeModal();
        T.go(0);
    };
    T.resetDemo = function () {
        /* 버튼을 숨기는 것만으로는 전역 호출로 뚫린다 (§12 와 같은 원칙) */
        if (T.view() === 'read') { toast('조회 전용 관점에서는 시연 데이터를 초기화할 수 없습니다.'); return; }
        T.stop();
        V().openModal('시연 상태 초기화',
            '<p style="font-size:var(--fs-13);line-height:1.6;">교육 등록·신청·종료 처리와 근로자 명단·독촉 이력 데이터를 처음 상태로 되돌립니다.</p>',
            '<button class="btn btn-secondary" type="button" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" type="button" onclick="EDUTOUR.confirmReset()">초기화</button>');
    };
    T.confirmReset = function () {
        if (T.view() === 'read') { toast('조회 전용 관점에서는 시연 데이터를 초기화할 수 없습니다.'); return; }
        E().reset();
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
