/* =====================================================================
   doc-tour.js · 업무문서 단계별 안내 (전역 DOCTOUR)

   교육(EDUTOUR)·위험성평가(RSKTOUR·OCCTOUR)와 **같은 엔진**(DYTOUR) 위에
   단계 정의만 얹는다. 네 번째 투어라고 엔진을 복제하지 않는다(CLAUDE.md §4-3).

   왜 필요한가 — 이 화면은 78개 카드가 늘어선 목록이라 처음 온 사람은
   "그래서 내가 뭘 하지"에서 멈춘다. 교육·위험성평가에는 있고 여기만 없었다.

   4단계: 아직 서류 없는 일 찾기 → 서류 올리고 할 일 연결 →
          재난안전과가 확인해 완료 → 문서 목록에서 그 문서 찾기

   ※ 2026-09-01 이관 — 종전에는 은퇴한 docs-exec/docs-preset 에 실려 있어
     대메뉴 재편(16→11) 뒤 **메뉴로는 이 안내에 닿을 수 없었다**. 신버전
     이행 관리·문서 목록으로 옮겼다. ③단계가 가리키던 «완료 처리»도 그때
     은퇴 화면에만 있었으므로 cmp-status 에 함께 구현했다.

   완료 판정은 전부 DYDOCS 파생이다 — 커서로 판정하면 뒤로 갈 때 체크가 풀리고,
   가이드를 끄고 손으로 처리한 건이 안 잡힌다.
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYDOCS; };

    var OWNER_P = 'staff';                    /* 재난안전과 주무관 (박안전) */
    /* 부서 담당자 페르소나 — 서류를 올리는 쪽이다 */
    var DEPT_PERSONA = { water: 'wat', env: 'envst', safety: 'staff' };
    var PREF_DEPT = ['water', 'env'];

    function year() { return D().defaultYear(); }

    /* 시연 대상 부서 — 지금 접속자가 부서 담당자면 그 부서를 따른다.
       (자기 부서가 아닌 곳을 가리키면 "내 일"로 안 읽힌다) */
    function demoDept() {
        var p = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        if (p && p.tier === 'staff' && p.deptId && DEPT_PERSONA[p.deptId] && p.deptId !== 'safety') return p.deptId;
        return PREF_DEPT[0];
    }
    function deptPersona() { return DEPT_PERSONA[demoDept()] || OWNER_P; }
    function deptNm() {
        var n = '';
        (V().orgDepts ? V().orgDepts() : []).some(function (d) {
            if (d.id === demoDept()) { n = d.name; return true; }
            return false;
        });
        return n || demoDept();
    }

    /* ── 추적 대상 ────────────────────────────────────────────────────────
     * 그 해에 **이 투어로 올린 가장 최근 문서**. 저장하지 않고 매번 데이터에서
     * 고른다 — id 를 저장하면 초기화·재시연 때 옛 id 를 가리킨 채 멈춘다. */
    function myDoc() {
        var list = D().store().docs.filter(function (d) {
            return d.year === year() && d.stageIds.length;
        });
        if (!list.length) return null;
        return list[list.length - 1];
    }
    /* 아직 서류가 없는 할 일 — 1단계에서 가리킬 대상 */
    function openStage() {
        var st = D().stages().filter(function (s) {
            return D().statusOfStage(s.id, year()) === D().ST.NONE;
        });
        return st.length ? st[0] : null;
    }
    function docStages() {
        var d = myDoc(); return d ? d.stageIds : [];
    }
    function doneCount() {
        return docStages().filter(function (s) {
            return D().statusOfStage(s, year()) === D().ST.DONE;
        }).length;
    }
    function wipCount() {
        return docStages().filter(function (s) {
            return D().statusOfStage(s, year()) === D().ST.WIP;
        }).length;
    }

    /* 화면 경로를 문구에 그대로 쓴다 — "지금 어디에 있고 다음에 어디로 가는지"를
       말해 주지 않으면 가이드를 따라가면서도 길을 잃는다. */
    var HERE_EXEC = '업무 관리 › 이행 관리';
    var HERE_LIST = '업무 관리 › 문서 목록';
    /* 흐름 보드는 제목·사람·실수치 세 줄이라 "어느 화면에서 하는 일인지"가 빠진다.
       실수치 앞에 화면 이름을 붙여 한 줄만 봐도 이동 경로가 읽히게 한다. */
    function at(screen, text) { return '［' + screen + '］ ' + text; }

    var STEPS = [
        {
            key: 'find', label: '① 할 일 찾기', page: 'cmp-status.html',
            persona: deptPersona, scopeDept: demoDept,
            href: function () { return 'cmp-status.html'; },
            selector: '[data-tour="doc-open"]',
            title: '내가 채워야 할 일이 무엇인지 찾기',
            where: '요약 카드 줄의 <b>[미이행]</b> 카드 — 누르면 누락 점검으로 넘어갑니다',
            clickPath: [
                '지금 보는 곳은 ' + HERE_EXEC + ' 입니다',
'맨 위 요약 카드 넉 장 중 [미이행] 카드에 «정기·상시 항목인데 서류 0건» 이라고 적혀 있습니다',
                '그 카드를 누릅니다 — «누락 점검» 으로 넘어갑니다',
                '→ 서류가 하나도 안 올라온 일만 남습니다. 이게 오늘 채워야 할 목록입니다',
                '부서·분야로 더 좁히려면 그 위 조회 조건을 씁니다'
            ],
            desc: '법으로 해야 하는 일이 ' + ((global.DYDOCT && global.DYDOCT.STAGES) ? global.DYDOCT.STAGES.length : '많이') + '개나 됩니다. 다 볼 필요 없습니다. ' +
                  '«내 부서 관련» 과 «미이행» 으로 거르면 지금 손댈 것만 남습니다. ' +
                  '카드 한 장이 법정 의무 한 가지, 그 안의 한 줄이 실제로 해야 할 일 하나입니다.',
            script: '이 화면은 "법으로 해야 할 일이 서류로 갖춰졌나"를 보는 곳입니다. ' +
                    '숫자를 누르면 그 상태인 것만 남고, 부서 담당자는 내 부서 관련 미이행만 보면 됩니다.',
            actionLabel: '누락 점검 열기',
            action: function () {
                /* 초록 줄 단추와 같은 동작 — 미이행 + 내 부서를 한 번에 건다(IMP-02) */
                if (global.CMPST) global.CMPST.setTab('gap');
            },
            done: function () { return !!myDoc(); },
            note: function () {
                var s = D().summary(year());
                var st = openStage();
                return at('이행 관리', '아직 서류 없는 일 ' + s.counts.not_started + '건' + (st ? ' · 예를 들면 «' + st.name + '»' : ''));
            }
        },
        {
            key: 'upload', label: '② 서류 올리기', page: 'cmp-status.html',
            persona: deptPersona, scopeDept: demoDept,
            href: function () { return 'cmp-status.html'; },
            selector: '[data-tour="doc-upload"]',
            title: '서류를 올리고 «무슨 일» 인지 표시하기',
            where: '화면 제목 오른쪽 <b>[＋ 서류 올리기]</b> 단추',
            clickPath: [
                '같은 화면(' + HERE_EXEC + ')에서 제목 오른쪽 [＋ 서류 올리기]를 누릅니다',
                '1단계 — 파일을 고르고, 문서 이름·보고일자·담당을 채웁니다',
                '2단계 — 왼쪽에서 «어떤 의무» 를 고르면 오른쪽에 «무슨 일» 이 나옵니다. 해당하는 것을 체크합니다',
                '3단계 — 무엇이 어떻게 바뀌는지 확인하고 [이대로 등록]',
                '→ 창이 닫히고, 고른 일이 «진행중» 으로 바뀝니다'
            ],
            desc: '그냥 파일만 올리는 게 아닙니다. 이 서류가 «어떤 의무의 무슨 일» 을 했다는 증거인지 ' +
                  '함께 표시해 줍니다. 그래야 이행 현황에 반영됩니다. ' +
                  '서류 한 장이 여러 일의 증거일 수 있어서 여러 개 고를 수 있습니다.',
            script: '여기가 핵심입니다. 파일과 «무슨 일» 을 이어 주는 것. ' +
                    '고르는 방식은 채용 사이트에서 직무 고르는 것과 같습니다 — 왼쪽 큰 분류, 오른쪽 세부, 칸마다 검색창.',
            modalGuide: '<b>2단계</b>에서 왼쪽 «어떤 의무인가요» 목록에서 하나를 고르면, ' +
                        '오른쪽에 그 의무의 «무슨 일인가요» 가 나옵니다. 여러 개 체크할 수 있고 ' +
                        '고른 것은 아래에 모입니다. 칸마다 있는 검색창에 이름 일부만 쳐도 좁혀집니다.',
            actionLabel: '서류 올리기 창 열기',
            action: function () { if (global.DOCUP) global.DOCUP.open(year()); },
            done: function () { return wipCount() > 0 || doneCount() > 0; },
            note: function () {
                var d = myDoc();
                if (!d) return at('이행 관리', '여기서 [＋ 서류 올리기] — 아직 올린 서류가 없습니다');
                return at('이행 관리', '«' + d.title.slice(0, 20) + '» · 일 ' + d.stageIds.length + '개 진행중');
            }
        },
        {
            key: 'confirm', label: '③ 확인·완료', page: 'cmp-status.html',
            persona: function () { return OWNER_P; },
            href: function () { return 'cmp-status.html'; },
            selector: '[data-tour="doc-confirm"]',
            title: '재난안전과가 서류를 보고 «완료» 도장을 찍기',
            where: '할 일 <b>상세 안</b>의 <b>[확인하기]</b> — 재난안전과 담당자에게만 보입니다',
            clickPath: [
                '여기서 사람이 바뀝니다 — 올린 사람(부서)이 아니라 재난안전과 차례입니다',
'같은 화면(' + HERE_EXEC + ')에서 그 일을 눌러 상세를 엽니다',
                '올라온 서류 목록이 상세 안에 나옵니다. 이름을 누르면 문서 화면으로 들어갑니다',
                '목록 아래 [확인하기]를 누릅니다',
                '내용이 맞으면 [완료 처리] — 안 맞으면 [확인 반려] 로 사유를 적습니다',
                '→ 완료가 되면 그때 카드의 진행률이 올라갑니다'
            ],
            desc: '올린 사람이 스스로 «완료» 로 만들 수 없습니다. 재난안전과가 서류를 보고 확인해야 합니다. ' +
                  '그래서 올린 직후에는 «진행중» 이고, 진행률(%)에도 아직 들어가지 않습니다. ' +
                  '완료로 바꾸면 누가 언제 확인했는지 기록에 남습니다.',
            script: '부서가 올리고 주관부서가 확인하는 두 단계입니다. ' +
                    '올린 사람이 곧바로 완료로 만들 수 있으면 확인이라는 절차가 뜻을 잃습니다. ' +
                    '반대로 완료된 걸 나중에 고치면 다시 «진행중» 으로 돌아가 재확인을 받습니다.',
            actionLabel: '올라온 서류 확인하기',
            action: function () {
                var d = myDoc();
                if (!d || !d.stageIds.length) { V().toast('먼저 ② 단계에서 서류를 올려 주세요.'); return; }
                if (global.CMPST) global.CMPST.openDetail(d.stageIds[0]);
            },
            done: function () { return doneCount() > 0; },
            note: function () {
                var d = myDoc();
                if (!d) return at('이행 관리', '같은 화면에서 재난안전과가 확인 — 아직 올라온 서류가 없습니다');
                return at('이행 관리', '완료 ' + doneCount() + '건 · 확인 기다리는 중 ' + wipCount() + '건');
            }
        },
        {
            key: 'trace', label: '④ 문서 찾기', page: 'cmp-docs.html',
            persona: function () { return OWNER_P; },
            href: function () { return 'cmp-docs.html'; },
            selector: '#cd-q',
            title: '나중에 그 서류를 다시 찾아보기',
            where: '맨 위 <b>[문서명으로 찾기]</b> 검색창 — 이름 일부만 쳐도 됩니다',
            clickPath: [
                '화면이 바뀝니다 — ' + HERE_EXEC + ' 에서 ' + HERE_LIST + ' 로 넘어갑니다',
                '맨 위 검색창에 문서 이름 일부를 칩니다',
                '더 좁히려면 조회 조건을 씁니다 — 분야·부서·연도로도 좁힐 수 있습니다',
                '문서 이름을 누르면 그 문서 화면으로 들어갑니다',
                '→ 돌아오면 검색어와 쪽이 그대로 남아 있습니다'
            ],
            desc: '두 화면이 같은 문서를 보지만 묻는 것이 다릅니다. ' +
                  '«이행 목록» 은 «해야 할 일이 채워졌나», «업무 목록» 은 «그 문서가 어디 있나» 입니다. ' +
                  '나중에 감사나 보고로 문서를 찾을 때는 업무 목록으로 옵니다.',
            script: '한 바퀴 돌았습니다. 부서가 올리고 → 재난안전과가 확인하고 → ' +
                    '나중에 업무 목록에서 다시 찾는다. 이 세 걸음이 업무문서 메뉴의 전부입니다.',
            actionLabel: '업무 목록에서 찾아보기',
            action: function () {
                var d = myDoc();
                location.href = 'cmp-docs.html' + (d ? '?q=' + encodeURIComponent(d.title.slice(0, 12)) : '');
            },
            done: function () { return doneCount() > 0; },
            note: function () {
                var d = myDoc();
                return at('문서 목록', d ? '여기로 넘어와 «' + d.title.slice(0, 20) + '» 찾기' : '여기로 넘어옵니다 — 아직 올린 서류가 없습니다');
            }
        }
    ];

    var T = global.DYTOUR.define({
        key: 'doc', ns: 'DOCTOUR', skey: 'dy-tour-doc-v1', steps: STEPS,
        ownerPersona: OWNER_P,
        pageLabels: { 'cmp-status.html': '이행 관리', 'cmp-docs.html': '문서 목록' },
        kicker: function () { return year() + '년 업무문서'; },
        flowTitle: function () { return '업무문서는 이렇게 씁니다 — ' + STEPS.length + '걸음'; },
        flowNote: function () {
            var d = myDoc();
            return '<b>업무 관리 메뉴에서 두 화면을 오갑니다.</b><br>' +
                '· <b>' + HERE_EXEC + '</b> — 법으로 해야 할 일이 <b>서류로 갖춰졌는지</b> 봅니다. ' +
                    '①②③ 걸음이 여기서 일어납니다.<br>' +
                '· <b>' + HERE_LIST + '</b> — 그 <b>문서를 나중에 찾는</b> 곳입니다. ④ 걸음입니다.<br><br>' +
                '<b>사람은 둘입니다.</b> 부서 담당자가 서류를 올리고(①②), 재난안전과가 보고 완료를 줍니다(③). ' +
                '올린 사람이 스스로 완료로 만들 수는 없습니다.<br><br>' +
                '지금 따라가는 서류: <b>' + V().esc(d ? d.title : '아직 없음') + '</b>' +
                (d ? ' — 새로 올리면 그 서류로 바뀝니다.' : ' — ② 걸음에서 올리면 그 서류를 따라갑니다.');
        },
        barTitle: function () { return '처음이신가요? 업무문서 사용법 ' + STEPS.length + '걸음'; },
        /* 바는 진입점이지 설명서가 아니다 — 길게 쓰면 세 줄이 되어 목록이 아래로
           밀린다(실측 91→109px). 흐름 화살표만 남기고 자세한 설명은 보드에 둔다. */
        barDesc: function () {
            return '① 내가 채울 일 찾기 → ② 서류 올리고 «무슨 일» 표시 → ③ 재난안전과가 확인 → ④ 나중에 다시 찾기';
        }
    });

    /* edu 화면들이 EDUTOUR.boot() 를 인자 없이 부르는 것과 같은 관례 —
       이 도메인의 두 화면에서는 진입 바를 띄운다. */
    var boot0 = T.boot;
    T.boot = function (opt) { return boot0(opt || { bar: true }); };

    global.DOCTOUR = T;
}(window));
