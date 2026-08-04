/* =====================================================================
   occ-tour.js · 수시 위험성평가 시연 투어 (전역 OCCTOUR)

   엔진은 js/tour-core.js(DYTOUR) 와 공유한다 — 이 파일은 **단계 정의**만 한다.

   수시평가가 정기와 다른 점 — 흐름의 방향이 반대다.
     · 정기: 주관부서가 열고 부서에 내려보낸다
     · 수시: **부서가 사유가 생겨 올리고**, 주관부서가 안전관리자 검토를 붙인다
   그래서 1단계 주체가 부서 담당자다.

   추적 대상은 **그 부서의 가장 최근 수시평가 1건**이다. 정기(연 1건)와 달리
   수시는 여러 건이 쌓이므로, 어느 건을 따라가는지 화면에 밝힌다.
   투어가 대상 id 를 저장하지 않는 이유는 정기와 같다 — 저장하면 초기화·재시연
   때 옛 id 를 가리킨 채 멈춘다.

   로드 순서: layout.js → common.js → rsk-data.js → rsk-occ.js → tour-core.js → occ-tour.js
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYRSK; };
    function toast(m) { V().toast(m); }

    var OWNER_P = 'staff';                    /* 박안전 — 재난안전과 담당자(주관부서) */
    var DEPT_PERSONA = { water: 'wat', env: 'envst', safety: 'staff' };
    /* 시연 선호 부서 — 부서 담당자 페르소나가 있어야 등록·완료를 실제로 눌러볼 수 있다.
       환경과를 먼저 두는 이유: 시드에 '검토 대기' 상태의 실제 건(OCC-2026-02)이 있어
       가이드를 켜자마자 살아 있는 다음 할 일을 가리킬 수 있다. */
    var PREF_DEPT = ['env', 'water'];

    function year() { return +String(V().today()).slice(0, 4); }

    /* 시연 대상 부서 — 지금 관점이 부서 담당자면 그 부서를 따른다.
       (수시평가는 부서가 올리는 것이므로 보고 있는 사람의 부서가 자연스럽다) */
    function demoDept() {
        var p = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        if (p && p.tier === 'staff' && p.deptId && DEPT_PERSONA[p.deptId] && p.deptId !== 'safety') return p.deptId;
        return PREF_DEPT[0];
    }
    function deptPersona() { return DEPT_PERSONA[demoDept()] || OWNER_P; }
    function deptNm() { return D().deptName(demoDept()); }
    function ownerP() { return OWNER_P; }

    /* 추적 대상 — 그 부서의 **가장 최근** 수시평가.
       occasionals() 는 date 내림차순이므로 같은 날짜면 나중에 만든 것(id 큰 것)을 고른다. */
    function O() {
        var list = (D().occasionals(year()) || []).filter(function (o) { return o.deptId === demoDept(); });
        if (!list.length) return null;
        return list.slice().sort(function (a, b) {
            var d = String(b.date || '').localeCompare(String(a.date || ''));
            return d !== 0 ? d : String(b.id).localeCompare(String(a.id));
        })[0];
    }
    function occId() { var o = O(); return o ? o.id : ''; }
    function impCount() { var o = O(); return o ? D().occImpCount(o.id) : { total: 0, done: 0 }; }
    function occLabel() {
        var o = O();
        if (!o) return deptNm() + ' — 등록된 건 없음';
        var r = (D().OCC_REASONS[o.reason] || {}).label || o.reason;
        return o.id + ' · ' + o.date + ' · ' + r;
    }

    var STEPS = [
        {
            key: 'reason', label: '사유·등록', page: 'rsk-occ.html',
            persona: deptPersona, scopeDept: demoDept,
            href: function () { return 'rsk-occ.html'; },
            selector: '[data-tour="occ-create"]',
            title: '실시 사유를 고르고 수시평가 등록',
            where: '화면 오른쪽 위 <b>[＋ 수시평가 등록]</b>',
            clickPath: [
                '[＋ 수시평가 등록] — 먼저 실시 사유를 고르는 창이 뜹니다',
                '고시 §15② 가 정한 6가지 중 해당 사유 선택',
                '발생일·내용을 적고, 아래 표에 유해위험요인과 감소대책을 적습니다',
                '조치기한을 정하고 [등록]'
            ],
            desc: '수시평가는 아무 때나 하는 게 아니라 법이 정한 6가지 사유가 생겼을 때 합니다. 그래서 빈 폼으로 바로 가지 않고 사유부터 고릅니다.',
            script: '설비를 새로 들이거나 재해가 나면 그 자리에서 부서가 올립니다 — 공문을 기다리지 않습니다. 사유를 지어낼 수 없게 법정 6종에서 고르게 했습니다.',
            modalGuide: '해당 사유를 고르면 그 사유가 채워진 등록 폼으로 넘어갑니다. 등록 폼 아래쪽 <b>유해위험요인·감소대책</b>을 반드시 한 줄 이상 적으세요 — 그 줄이 곧 개선조치가 됩니다.',
            actionLabel: '실시 사유 선택 열기',
            action: function () { global.RSKOCC.openReasonGate(); },
            done: function () { return !!O(); },
            note: function () { return O() ? occLabel() : deptNm() + ' — 등록된 건 없음'; }
        },
        {
            key: 'measure', label: '감소대책', page: 'rsk-occ.html',
            persona: deptPersona, scopeDept: demoDept,
            href: function () { return 'rsk-occ.html'; },
            selector: '[data-tour="occ-imp"]',
            title: '감소대책이 개선조치로 배분됐는지 확인',
            where: '표의 <b>개선조치</b> 칸에 있는 <b>[조치 상세]</b>',
            clickPath: [
                '해당 행의 [조치 상세] — 등록 때 적은 감소대책이 그대로 보입니다',
                '담당자·기한·개선 전 사진을 확인합니다'
            ],
            desc: '등록 폼에서 적은 유해위험요인이 그 자리에서 개선조치가 됩니다. 별도로 옮겨 적지 않습니다.',
            script: '수시평가는 “실시했다”로 끝나지 않습니다 — 위험성 감소대책을 세우고 실행해야 완결입니다(산안법 §36①). 등록과 동시에 부서 할 일로 꽂힙니다.',
            actionLabel: '조치 상세 열기',
            action: function () {
                var id = occId(); if (!id) { toast('먼저 1단계에서 수시평가를 등록하세요.'); return; }
                global.RSKOCC.openImp(id);
            },
            done: function () { return impCount().total > 0; },
            note: function () {
                var o = O(); if (!o) return '등록 후';
                var c = impCount();
                return c.total ? '감소대책 ' + c.total + '건 배분됨' : '감소대책 없음 — 등록 시 유해위험요인을 적어야 합니다';
            }
        },
        {
            key: 'review', label: '검토', page: 'rsk-occ.html',
            persona: ownerP,
            href: function () { return 'rsk-occ.html'; },
            selector: '[data-tour="occ-review"]',
            title: '안전관리자 검토파일 등록',
            where: '표의 <b>안전관리자 검토</b> 칸에 있는 <b>[＋ 검토파일 등록]</b>',
            clickPath: [
                '[＋ 검토파일 등록]',
                '안전관리자가 서명한 파일을 올리고 검토자 이름을 적습니다',
                '[등록] — 이 시점에 상태가 검토완료로 바뀝니다'
            ],
            desc: '담양군은 상시근로자 300명 미만이라 안전관리자를 외부 용역에 맡깁니다. 외부인이 로그인해 결재하는 경로가 없어, 서명한 파일을 담당자가 올리는 시점이 검토 완료입니다.',
            script: '외부 안전관리자에게 계정을 줄 수 없다는 현실을 그대로 반영했습니다 — 서명 파일이 곧 검토 기록입니다.',
            modalGuide: '파일명을 그대로 두고 검토자 이름을 채운 뒤 <b>[등록]</b>을 누르면 검토완료로 바뀝니다.',
            actionLabel: '검토파일 등록 열기',
            action: function () {
                var id = occId(); if (!id) { toast('먼저 1단계에서 수시평가를 등록하세요.'); return; }
                global.RSKOCC.openReviewFile(id);
            },
            done: function () { var o = O(); return !!(o && o.reviewFile); },
            note: function () {
                var o = O(); if (!o) return '등록 후';
                return o.reviewFile ? '검토완료 · ' + (o.reviewer || '안전관리자') : '검토 대기';
            }
        },
        {
            key: 'complete', label: '조치완료', page: 'my-work.html',
            persona: deptPersona, scopeDept: demoDept,
            href: function () { return 'my-work.html?dept=' + demoDept() + '&cat=improve'; },
            selector: '[data-tour="mw-improve"]',
            title: '부서가 감소대책을 완료',
            where: '<b>내 할일</b>의 개선조치 카드에서 <b>[완료 처리]</b>',
            clickPath: [
                '개선조치 카드의 [완료 처리]',
                '조치 내용·완료일을 적고 개선 후 사진을 올립니다',
                '담당자 전자서명까지 채워야 저장됩니다'
            ],
            desc: '정기평가에서 내려온 개선조치와 같은 화면·같은 방식으로 마무리합니다. 출처만 다를 뿐 처리는 하나로 모입니다.',
            script: '부서 담당자는 정기든 수시든 내 할일 한 곳에서 끝냅니다 — 어디서 온 일인지 찾아다닐 필요가 없습니다.',
            modalGuide: '개선 후 사진과 서명이 모두 있어야 저장됩니다.',
            actionLabel: '내 할일에서 개선조치 보기',
            action: function () { location.href = 'my-work.html?dept=' + demoDept() + '&cat=improve'; },
            done: function () { var c = impCount(); return c.total > 0 && c.done === c.total; },
            note: function () {
                var c = impCount();
                if (!c.total) return '감소대책 없음';
                return deptNm() + ' ' + c.done + ' / ' + c.total + '건 완료';
            }
        },
        {
            key: 'result', label: '결과확인', page: 'rsk-occ.html',
            persona: ownerP,
            href: function () { return 'rsk-occ.html'; },
            selector: '[data-tour="occ-imp"]',
            title: '조치 결과와 증빙 확인 · 완결',
            where: '표의 <b>[조치 상세]</b> — 개선 전·후 사진이 나란히 보입니다',
            clickPath: [
                '[조치 상세] — 무엇을 어떻게 고쳤는지 사진으로 확인합니다',
                '옆의 [이력]으로 등록 → 검토 → 조치까지 전 과정을 봅니다'
            ],
            desc: '검토가 끝나고 감소대책이 모두 완료되면 그 수시평가는 완결입니다. 정기평가와 달리 별도 완료 확인·공문 단계가 없습니다.',
            script: '수시평가는 사유가 생겼을 때 빠르게 돌리는 흐름이라 여기서 끝납니다. 공문·온나라 이관은 연 1회 정기평가 결과를 통보할 때 씁니다.',
            actionLabel: '조치 상세 열기',
            action: function () {
                var id = occId(); if (!id) { toast('먼저 1단계에서 수시평가를 등록하세요.'); return; }
                global.RSKOCC.openImp(id);
            },
            done: function () {
                var o = O(); if (!o || !o.reviewFile) return false;
                var c = impCount();
                return c.total > 0 && c.done === c.total;
            },
            note: function () {
                var o = O(); if (!o) return '등록 후';
                var c = impCount();
                return (o.reviewFile ? '검토완료' : '검토 대기') + ' · 조치 ' + c.done + ' / ' + c.total;
            }
        }
    ];

    var T = global.DYTOUR.define({
        key: 'occ', ns: 'OCCTOUR', skey: 'dy-tour-occ-v1', steps: STEPS,
        kicker: function () { return year() + ' 수시 위험성평가'; },
        flowTitle: function () { return year() + '년 수시 위험성평가 — 전체 흐름 ' + STEPS.length + '단계'; },
        flowNote: function () {
            var o = O();
            return '추적 중인 건: <b>' + V().esc(occLabel()) + '</b>' +
                (o ? ' — 새로 등록하면 그 건을 따라갑니다.' : ' — 1단계에서 등록하면 그 건을 따라갑니다.') +
                '<br>수시평가는 <b>부서가 사유가 생겨 올리는</b> 흐름이라 1단계 주체가 부서 담당자입니다.';
        },
        barTitle: function () { return '수시 위험성평가 흐름 시연 — ' + STEPS.length + '단계'; },
        barDesc: function () {
            return '실시 사유 선택·등록 → 감소대책 배분 → 안전관리자 검토 → 부서 조치 완료 → 결과 확인. ' +
                '정기평가와 반대로 <b>부서가 올리고 주관부서가 검토</b>합니다. ' +
                '가이드가 어디를 누를지 짚어 주고 관점도 알아서 바꿔 줍니다.';
        }
    });

    global.OCCTOUR = T;
})(window);
