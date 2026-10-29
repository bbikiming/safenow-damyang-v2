/* =========================================================================
 * 업무 관리(신) — 문서 목록 (cmp-docs.html, 전역 CMPDOC)
 *   기획: docs/planning/기획-업무관리-신버전-이행관리-문서목록-v1.md §5
 *   구조: docs/planning/자료-업무관리-이행관리-와이어프레임-v1.html ④⑤
 *
 *   목록(④) → 행을 누르면 같은 화면 본문이 문서 상세(⑤)로 바뀐다.
 *   지난연도 문서 상세에는 **올해 이어받기** 카드가 붙고, 올해 문서에는 붙지 않는다.
 *
 *   [문서 축은 DYDOCS 하나뿐이다]
 *   원장(20개 부서) + 현행 업무문서 426 + 사용자 등록분을 DYDOCS.allDocs() 가 이미
 *   합쳐 준다. 이 파일은 거르고 그릴 뿐 자체 문서 배열을 만들지 않는다.
 *
 *   [딥링크]
 *   ?stage={stageId}&year={y}  — 이행 관리 상세의 '지난연도 전체 보기' 수신
 *   ?doc={docId}               — 문서 상세로 바로 진입
 * ========================================================================= */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYDOCS; };
    var C = function () { return global.DYCMP; };
    var F = function () { return global.EDUFILTER; };
    var T = function () { return global.DYDOCT || { STAGES: [] }; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }

    var PAGE = 25;
    var S = {
        mount: null,
        q: '', sr: '', year: '', status: '',
        dept: '',            /* 이행 관리 L2 에서 넘어온 부서 조건 — 필터 UI 로는 내지 않는다(D-5) */
        menu: '',            /* 분야(구 대메뉴) 조건 — 현황 통계·경영방침이 넘겨 준다. 필터 UI 로는 내지 않는다 */
        stages: [],          /* 업무단계 다중 조건 (DYPICK) */
        page: 1,
        expand: {},          /* docId → 업무단계 칩 전부 펼침 */
        doc: '',             /* 문서 상세 */
        back: '',            /* 왔던 화면 — 다른 메뉴에서 문서를 열러 온 경우 */
        pickTmp: null,       /* 선택기 모달 임시값 */
        adv: false,          /* 상세 조건 펼침 — 값이 걸리면 자동 true */
    };

    function me() { var R = global.DYROLE; return R && R.current ? R.current() : null; }
    function myDept() { var p = me(); return (p && p.deptName) || ''; }
    function liveYear() { return +String(V().today()).slice(0, 4); }

    /* =========================================================================
     * URL
     * ========================================================================= */
    function readURL() {
        var p = new URLSearchParams(location.search);
        /* 할 일 조건은 여러 개일 수 있다 — 쉼표로 이어 싣는다. 종전에는 1개일 때만
           주소에 남아, 2개 이상 고르면 새로고침·주소 공유에서 조건이 조용히 풀렸다
           («주소는 지금 상태를 담는다», SCR-CMP-002 §3-0). 없는 코드는 버린다. */
        S.stages = String(p.get('stage') || '').split(',').filter(function (id) { return !!D().stage(id); });
        /* 기본 연도는 비워 두지 않는다 — 전체를 날짜 내림차순으로 보면 첫 페이지가
           2026년 현행 업무문서(이행항목 축이 없는 «이 목록 밖 문서»)로만 채워져,
           이 화면의 요점인 «어떤 할 일의 증빙인가»가 첫 화면에서 보이지 않는다.
           기준은 이행 관리 화면과 같은 DYDOCS.defaultYear()(데이터가 있는 최신 연도)다. */
        S.year = p.get('year') != null ? p.get('year') : String(D().defaultYear());
        S.q = p.get('q') || '';
        S.sr = p.get('sr') || '';
        S.status = p.get('status') || '';
        S.dept = p.get('dept') || '';
        /* 분야 조건 — 현황 통계·경영방침이 «분야별 문서»로 보낸다.
           그 두 화면은 현행 업무문서 426건을 분야(구 대메뉴)로 세는데, 조건 없이 보내면
           9개 링크가 전부 같은 전체 목록으로 떨어져 누른 의미가 사라진다.
           연도 기본값도 함께 푼다 — 분야를 보러 온 것이지 특정 연도를 보러 온 것이 아니다. */
        S.menu = p.get('menu') || '';
        if (S.menu && p.get('year') == null) S.year = '';
        /* 부서로 들어오면 연도 기본값을 풀어 준다 — 그 부서 문서를 보러 온 것이지
           특정 연도를 보러 온 것이 아니다(0건으로 맞이하지 않는다) */
        if (S.dept && p.get('year') == null) S.year = '';
        var doc = p.get('doc');
        S.doc = (doc && D().docById(doc)) ? doc : '';   /* 없으면 상세도 없다 — 뒤로가기 닫힘의 전제 */
        /* 다른 화면(이행 관리 등)에서 문서를 열러 왔다면 그 화면으로 돌아갈 수
           있어야 한다 — 없으면 GNB 로 다시 들어가야 하고 보고 있던 자리를 잃는다.
           허용 목록은 DOCUP 단일 출처다(외부 URL 주입 차단). */
        S.back = p.get('back') || '';
    }
    function urlOf() {
        var p = new URLSearchParams();
        if (S.stages.length) p.set('stage', S.stages.join(','));
        if (S.year) p.set('year', S.year);
        if (S.q) p.set('q', S.q);
        if (S.sr) p.set('sr', S.sr);
        if (S.status) p.set('status', S.status);
        if (S.dept) p.set('dept', S.dept);
        if (S.menu) p.set('menu', S.menu);
        if (S.doc) p.set('doc', S.doc);
        if (S.back) p.set('back', S.back);
        var qs = p.toString();
        return location.pathname + (qs ? '?' + qs : '');
    }
    /* history.state 보존 — cmp-status 와 같은 이유(상세 표식이 필터 갱신에 지워지면 안 된다) */
    function syncURL() {
        try { history.replaceState(history.state, '', urlOf()); } catch (e) {}
    }

    /* =========================================================================
     * 조회
     * ========================================================================= */
    function match(d) {
        if (S.year && String(d.year) !== String(S.year)) return false;
        if (S.dept && d.dept !== S.dept) return false;
        if (S.menu && d.menuKey !== S.menu) return false;
        if (S.status && d.status !== S.status) return false;
        if (S.sr && !F().match(S.sr, [d.sr])) return false;
        if (S.stages.length) {
            var hit = (d.stageIds || []).some(function (sid) { return S.stages.indexOf(sid) >= 0; });
            if (!hit) return false;
        }
        if (S.q && !F().match(S.q, [d.title, d.id, d.sr])) return false;
        return true;
    }
    /* 이 화면이 싣는 문서 — **이행 증빙 문서만**(2026-10-12 사용성 검토).
       원장 5만여 건의 대부분은 어느 할 일에도 연결되지 않은 일반 행정문서(재난 알림·
       물품 집행 등)라, 전부 실으면 증빙을 찾으러 온 담당자가 첫 화면부터 «연결된 할 일
       없음» 수십 줄을 지나야 했다. 연결 여부는 업무목록 엑셀이 정한다(§5).
       예외 — 분야 조건(?menu=)은 현행 업무문서(할 일 축 없음)를 보러 오는 경로라 그 문서를
       함께 싣는다. 문서를 주소(?doc=)로 직접 열면 연결이 없어도 상세는 열린다. */
    function evidence(d) {
        return (d.stageIds || []).some(function (sid) { return !!D().stage(sid); });
    }
    function pool() {
        return D().allDocs().filter(function (d) {
            return evidence(d) || (S.menu && d.origin === 'v2' && d.menuKey === S.menu);
        });
    }
    function view() {
        return pool().filter(match).sort(function (a, b) {
            return String(b.date || '').localeCompare(String(a.date || ''));
        });
    }
    function filtering() { return !!(S.q || S.sr || S.year || S.status || S.stages.length || S.dept || S.menu); }

    function yearOptions() {
        return [['', '연도 전체']].concat(C().years().slice().reverse().map(function (y) { return [y, y + '년']; }));
    }
    function statusOptions() {
        var seen = {};
        pool().forEach(function (d) { if (d.status) seen[d.status] = 1; });
        return [['', '결재상태 전체']].concat(Object.keys(seen).sort().map(function (s) { return [s, s]; }));
    }

    /* =========================================================================
     * 렌더
     * ========================================================================= */
    function render() {
        if (!S.mount) return;
        syncURL();
        injectHead();
        S.mount.innerHTML = S.doc ? detailPane() : listPane();
    }
    function rerender() { F().rerender(render); }

    /* 연도별 수록 범위 — 2025 만 20개 부서 전체이고 나머지 연도는 6개 부서의 확정 문서뿐이다.
       연도 조건을 걸었을 때만 그 해를 말한다(전체 연도에서는 연도별로 다르다는 사실만). */
    function coverNote() {
        var cv = S.year && D().coverage ? D().coverage(S.year) : null;
        if (cv) {
            return cv.partial
                ? '<p><b>' + esc(cv.label) + V().josa(cv.label, '은', '는') + ' 일부만 수록돼 있습니다</b> — ' +
                  (cv.periodText ? cv.periodText + ' · ' : '') + cv.deptCount + '개 부서(' + esc(cv.depts.join('·')) + ')의 ' +
                  '확정 문서 ' + cv.docs.toLocaleString() + '건입니다. 그 밖의 부서·기간 서류는 수집 범위 밖입니다.</p>'
                : '';
        }
        return D().coverage && D().coverage(D().BASE_YEAR)
            ? '<p>연도마다 수록 범위가 다릅니다 — <b>' + D().BASE_YEAR + '년은 20개 부서 원장 전체</b>이고, ' +
              '2021년 하반기~2024년·2026년 상반기는 6개 부서의 확정 문서만 있습니다.</p>'
            : '';
    }
    function notice() {
        var all = pool();
        var lc = C().linkCounts(all);
        var led = D().allDocs().filter(function (d) { return d.origin === 'ledger'; });
        /* 접어도 남는 한 줄은 «설명»이 아니라 «지금 상태»여야 한다(§14-12) */
        var lead = '이행 증빙 문서 <b>' + all.length.toLocaleString() + '건</b> · 할 일 연결 <b>' + lc.links.toLocaleString() + '건</b>';
        var rest =
            '<p><b>한 문서가 여러 할 일에 연결되므로 이행현황의 문서 합계는 실제 문서 수보다 큽니다.</b> ' +
                '두 숫자를 함께 적어 오해를 막습니다 — 위 수치는 화면에서 센 값이지 고정값이 아닙니다.</p>' +
            '<p>결재 완료 원본 파일은 이 시스템에 보관하지 않습니다. 원장 문서는 <b>그 부서 담당자가 상세에서 온나라 원본과 이을 수 있고</b>, ' +
                '이어진 문서의 결재 경로·붙임 목록은 그 부서 사람에게만 보입니다. 온나라 연결은 원본을 찾아가는 길이고 이행 판정과 무관합니다.</p>' +
            '<p>문서 원장 ' + led.length.toLocaleString() + '건 중 <b>할 일에 연결된 문서만</b> 싣습니다 — 연결되지 않은 일반 행정문서는 이행 판정과 무관해 이 목록에 넣지 않습니다.</p>' +
            coverNote() +
            '<p>할 일 하나하나에 증빙이 갖춰졌는지는 <a href="cmp-status.html">업무 관리 &gt; 이행 관리</a>에서 봅니다. 여기는 <b>문서 1건</b>을 찾습니다.</p>' +
            ((global.DYROLE && global.DYROLE.readOnlyNote) ? (global.DYROLE.readOnlyNote('문서 등록') || '') : '');
        return V().notice('cmp-docs', lead, rest);
    }

    /* ── ④ 목록 ── */
    function listPane() {
        var list = view();
        var lc = C().linkCounts(list);
        var pages = Math.max(1, Math.ceil(list.length / PAGE));
        if (S.page > pages) S.page = pages;
        var rows = list.slice((S.page - 1) * PAGE, S.page * PAGE);

        /* 필터 3단 — 설계 §8. 연도는 값이 2~3개뿐이라 칩이 드롭다운보다 빠르고,
           결재상태·수발신처처럼 값이 많거나 덜 쓰는 축은 상세 조건 안에 둔다. */
        var advN = docAdvCount();
        var bar = F().bar(
            [{ type: 'search', id: 'cd-q', value: S.q, placeholder: '문서명으로 찾기', on: "CMPDOC.setF('q', this.value)" }],
            {
                count: list.length.toLocaleString(), unit: '건',
                reset: 'CMPDOC.resetF()',
                /* 주소로 걸려 온 조건(분야)도 센다 — 안 세면 [필터 초기화]가 비활성이라
                   칩의 ×로만 풀 수 있었다(«초기화도 그 조건을 함께 푼다», CLAUDE.md §17). */
                extraActive: advN + (S.stages.length ? 1 : 0) + (S.menu ? 1 : 0),
                actions: '<button type="button" class="btn btn-outline btn-sm" onclick="CMPDOC.openPick()">업무단계 고르기' +
                        (S.stages.length ? ' <b>' + S.stages.length + '</b>' : '') + '</button>' +
                    '<button type="button" class="btn btn-outline btn-sm" aria-expanded="' + (docAdvOpen() ? 'true' : 'false') +
                        '" aria-controls="cd-adv" onclick="CMPDOC.toggleAdv()">상세 조건 ' + (docAdvOpen() ? '▴' : '▾') +
                        (advN ? ' <b>' + advN + '</b>' : '') + '</button>',
            });
        bar += yearChips() + docAdvPanel();

        return notice() + bar + deptCond() + menuCond() + stageCond() +
            '<p class="cmp-cap">조건에 맞는 <b>문서 ' + list.length.toLocaleString() + '건</b> · 할 일 <b>연결 ' + lc.links.toLocaleString() + '건</b> — ' +
                '한 문서가 여러 할 일에 걸리므로 두 수는 다릅니다.</p>' +
            (rows.length ? table(rows, hasStatus(list)) : emptyBox()) +
            pager(pages, list.length);
    }
    /* 부서 조건 — 2025 원장이 20개 부서를 갖게 되면서 **드롭다운이 성립한다.**
     * 종전에는 원장이 재난안전과 한 부서뿐이라 «만들면 대부분 0건이 되어 자료가
     * 없다로 오독된다»는 이유로 칩만 두었다. 그 전제가 사라졌으므로 셀렉트로
     * 올린다. 옵션은 **실제로 문서가 있는 부서만**이고 건수를 함께 찍는다 —
     * 고르기 전에 몇 건인지 보이면 0건짜리를 고르는 헛걸음이 없다. */
    function deptOptions() {
        var by = {};
        pool().forEach(function (d) { if (d.dept) by[d.dept] = (by[d.dept] || 0) + 1; });
        var names = Object.keys(by).sort();
        return [['', '부서 전체']].concat(names.map(function (n) {
            return [n, n + ' (' + by[n].toLocaleString() + ')'];
        }));
    }
    function deptCond() {
        if (!S.dept) return '';
        var total = pool().filter(function (d) { return d.dept === S.dept; }).length;
        return '<p class="cmp-cond"><span class="chip-mini wt-elec">' + esc(S.dept) + ' 문서 ' + total.toLocaleString() + '건' +
            '<button type="button" class="cmp-cond-x" aria-label="부서 조건 해제" onclick="CMPDOC.setF(\'dept\',\'\')">×</button></span></p>';
    }
    /* 분야 조건 칩 — 부서 조건과 같은 형태다. 조건이 걸린 줄 모르고 «왜 47건뿐이지»
       하지 않도록 무엇으로 좁혔는지 보이고, 그 자리에서 풀 수 있어야 한다. */
    function menuCond() {
        if (!S.menu) return '';
        var M = (global.DY_MENUS_V2 || {})[S.menu];
        var label = (M && M.label) || S.menu;
        var total = pool().filter(function (d) { return d.menuKey === S.menu; }).length;
        return '<p class="cmp-cond"><span class="chip-mini wt-elec">분야 ' + esc(label) + ' 문서 ' + total.toLocaleString() + '건' +
            '<button type="button" class="cmp-cond-x" aria-label="분야 조건 해제" onclick="CMPDOC.setF(\'menu\',\'\')">×</button></span></p>';
    }
    /* 연도 칩 — 값이 2~3개뿐이라 드롭다운은 과하다. 각 칩에 건수를 붙여
       고르기 전에 몇 건인지 보이게 한다. */
    function yearChips() {
        var all = pool();
        var byYear = {};
        all.forEach(function (d) { if (d.year) byYear[d.year] = (byYear[d.year] || 0) + 1; });
        var years = Object.keys(byYear).map(Number).sort(function (a, b) { return b - a; });
        function chip(val, label, n) {
            var on = String(S.year) === String(val);
            return '<button type="button" role="radio" aria-checked="' + (on ? 'true' : 'false') + '"' +
                ' class="cmp-fchip' + (on ? ' is-on' : '') + '" onclick="CMPDOC.setF(\'year\', \'' + val + '\')">' +
                esc(label) + '<span class="cmp-fchip-n">' + n.toLocaleString() + '</span></button>';
        }
        var out = chip('', '전체', all.length);
        years.forEach(function (y) { out += chip(y, y + '년', byYear[y]); });
        return '<div class="cmp-fchips" role="radiogroup" aria-label="연도로 거르기">' + out + '</div>';
    }
    function docAdvCount() { return [S.status, S.sr, S.dept].filter(Boolean).length; }
    function docAdvOpen() { return S.adv || docAdvCount() > 0; }
    function docAdvPanel() {
        if (!docAdvOpen()) return '';
        return '<div class="dl-adv cmp-adv" id="cd-adv"><div class="dl-adv-grid">' +
            '<label class="dl-f"><span>부서</span>' +
                '<select class="form-select" id="cd-dept" onchange="CMPDOC.setF(\'dept\', this.value)">' +
                F().optionsHtml(deptOptions(), S.dept) + '</select></label>' +
            '<label class="dl-f"><span>결재상태</span>' +
                '<select class="form-select" id="cd-st" onchange="CMPDOC.setF(\'status\', this.value)">' +
                F().optionsHtml(statusOptions(), S.status) + '</select></label>' +
            '<label class="dl-f"><span>수발신처</span>' +
                '<input type="search" class="form-input" id="cd-sr" value="' + esc(S.sr) + '"' +
                ' placeholder="기관 이름으로 찾기" oninput="CMPDOC.setF(\'sr\', this.value)"></label>' +
        '</div></div>';
    }
    function stageCond() {
        if (!S.stages.length) return '';
        return '<p class="cmp-cond">고른 할 일 ' + S.stages.length + '개 — ' +
            S.stages.map(function (sid) {
                var s = D().stage(sid); if (!s) return '';
                return '<span class="chip-mini wt">' + esc(s.name) +
                    '<button type="button" class="cmp-cond-x" aria-label="' + esc(s.name) + ' 해제"' +
                    ' onclick="CMPDOC.dropStage(\'' + esc(sid) + '\')">×</button></span>';
            }).join('') +
            ' <button type="button" class="du-link" onclick="CMPDOC.clearStages()">모두 지우기</button></p>';
    }
    /* 결재상태 열은 **값이 있는 문서가 하나라도 있을 때만** 둔다 — 원장 문서는 결재상태를
       갖고 있지 않아(온나라 연동 전) 열 전체가 «—» 로 찼다. 빈 열은 정보 없이 폭만 쓴다.
       판정은 지금 조건의 전건으로 한다 — 쪽마다 열이 생겼다 사라지면 안 된다. */
    function hasStatus(list) { return list.some(function (d) { return !!d.status; }); }
    function table(rows, showSt) {
        return '<div class="cmp-wrap"><table class="table-figma table-compact cmp-table"><thead><tr>' +
            '<th class="cmp-c-main">문서명</th><th class="cmp-c-stg">업무단계</th><th class="cmp-c-dept2">부서</th>' +
            '<th class="cmp-c-ac">수발신자</th>' +
            '<th class="cmp-num cmp-c-rd">보고일자</th>' + (showSt ? '<th class="cmp-c-st">결재상태</th>' : '') +
        '</tr></thead><tbody>' + rows.map(function (d) { return row(d, showSt); }).join('') + '</tbody></table></div>';
    }
    function row(d, showSt) {
        /* 행 전체가 진입 타깃(와이어프레임 tr.stg) — 칩·버튼 클릭에는 양보한다 */
        return '<tr class="cmp-stg cmp-rowlink" onclick="CMPDOC.rowOpen(event, \'' + esc(d.id) + '\')"><td class="cmp-c-main">' +
                '<button type="button" class="cmp-slink" onclick="CMPDOC.openDoc(\'' + esc(d.id) + '\')">' + esc(d.title) + '</button>' +
                '<span class="cmp-scode">' + esc(d.id) + ' · ' + esc(d.year) + '년</span></td>' +
            '<td class="cmp-c-stg">' + stageChips(d) + '</td>' +
            '<td class="cmp-c-dept2">' + (d.dept ? esc(d.dept) : '<span class="cmp-dim">—</span>') + '</td>' +
            /* 목록은 방향 접두를 붙이지 않는다 — 이 열이 159px 이라 «받음 · »가
               붙으면 기관명이 잘린다. 내부 문서만 그 사실을 낸다(값이 비므로). */
            '<td class="cmp-c-ac">' + (D().srText(d) ? esc(D().srText(d)) : '<span class="cmp-dim">—</span>') + '</td>' +
            '<td class="cmp-num">' + esc(d.date || '—') + '</td>' +
            (showSt ? '<td><span class="chip-status chip-sm ' + V().toneOf(d.status) + '">' + esc(d.status || '—') + '</span></td>' : '') +
            '</tr>';
    }
    /* 2개 초과는 +N 으로 접고 **클릭하면 인라인으로 펼친다** — hover 툴팁은 쓰지
       않는다(터치에서 열 방법이 없고 스크린리더가 읽지 못한다, §7). */
    function stageChips(d) {
        var st = (d.stageIds || []).map(D().stage).filter(Boolean);
        /* 왜 비었는지 모르면 데이터 오류로 읽힌다 — 칩에 이유를 단다(D-11) */
        if (!st.length) {
            if (d.origin === 'v2') {
                return '<span class="chip-mini wt" title="이행항목 축이 없는 현행 업무문서입니다 — 전용 화면에서 관리하는 문서라 여기서는 연결된 할 일이 없습니다.">이 목록 밖 문서</span>';
            }
            /* 이 시스템에서 올린 문서인데 할 일이 없는 경우 — 저장 계층이 이제 만들지
               않지만(addDocument), 종전 경로로 이미 생긴 것을 «이 목록 밖 문서»(현행
               업무문서)로 잘못 부르지 않는다. */
            if (d.origin !== 'ledger') {
                return '<span class="chip-status chip-sm warning" title="이 시스템에서 등록한 문서인데 연결된 할 일이 없습니다 — 어느 의무의 증빙도 아닙니다.">할 일 미지정</span>';
            }
            /* 원장 문서에 할 일이 없으면 사실만 적는다 — 미분류·분류 제외·부서 확인 같은
               분류 작업 상태는 화면에 내지 않는다(2026-10-12, 분류는 업무목록 엑셀이 정한다). */
            return '<span class="cmp-dim">연결된 할 일 없음</span>';
        }
        var open = !!S.expand[d.id];
        var show = open ? st : st.slice(0, 2);
        var more = st.length - show.length;
        /* 목록의 칩도 상세와 같이 눌린다(D-7) — 같은 칩이 자리에 따라 다르게 동작하면 안 된다 */
        return show.map(function (s) {
            return '<a class="chip-mini wt-elec" title="' + esc(s.name) + ' 이행 상세로"' +
                ' href="cmp-status.html?stage=' + encodeURIComponent(s.id) + '&year=' + d.year + '">' + esc(s.name) + '</a>';
        }).join(' ') +
            (more > 0
                ? ' <button type="button" class="chip-mini wt cmp-more" onclick="CMPDOC.expand(\'' + esc(d.id) + '\')" aria-expanded="false">+' + more + '</button>'
                : (open && st.length > 2
                    ? ' <button type="button" class="chip-mini wt cmp-more" onclick="CMPDOC.expand(\'' + esc(d.id) + '\')" aria-expanded="true">접기</button>'
                    : ''));
    }
    function emptyBox() {
        return '<div class="v2-empty"><b>조건에 맞는 문서가 없습니다.</b><br>조회 조건을 지우면 전체 목록이 나옵니다.' +
            (filtering() ? '<div class="cmp-empty-act"><button type="button" class="btn btn-outline btn-sm" onclick="CMPDOC.resetF()">조건 초기화</button></div>' : '') +
        '</div>';
    }
    function pager(pages, total) {
        if (pages <= 1) return '';
        var out = [], s = Math.max(1, S.page - 2), e = Math.min(pages, s + 4);
        for (var i = s; i <= e; i++) {
            out.push('<button type="button" class="cmp-pg' + (i === S.page ? ' is-on' : '') + '"' +
                ' aria-current="' + (i === S.page ? 'page' : 'false') + '" onclick="CMPDOC.go(' + i + ')">' + i + '</button>');
        }
        return '<nav class="cmp-pager" aria-label="문서 목록 페이지">' +
            '<button type="button" class="cmp-pg" onclick="CMPDOC.go(' + Math.max(1, S.page - 1) + ')" aria-label="이전 페이지">‹</button>' +
            out.join('') +
            '<button type="button" class="cmp-pg" onclick="CMPDOC.go(' + Math.min(pages, S.page + 1) + ')" aria-label="다음 페이지">›</button>' +
            '<span class="cmp-dim">' + S.page + ' / ' + pages + ' 쪽 · 전체 ' + total.toLocaleString() + '건</span>' +
        '</nav>';
    }

    /* =========================================================================
     * 업무단계 선택기 — DYPICK 2단 (78개 드롭다운 금지, CLAUDE.md §5)
     * ========================================================================= */
    function openPick() {
        S.pickTmp = S.stages.slice();
        global.DYPICK.reset('');
        renderPick();
    }
    function renderPick() {
        V().openModal('업무단계 고르기',
            '<div class="cmp-pick">' +
                global.DYPICK.render({ ns: 'CMPDOC.pick', multi: true, stages: S.pickTmp, height: 260 }) +
                '<p class="cmp-cap">고른 할 일 중 <b>하나라도</b> 연결된 문서를 보여줍니다.</p>' +
            '</div>',
            '<button class="btn btn-outline" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" onclick="CMPDOC.applyPick()">적용 (' + S.pickTmp.length + ')</button>');
    }
    function pick(kind, a, b) {
        if (kind === 'stage') {
            var i = S.pickTmp.indexOf(a);
            if (b && i < 0) S.pickTmp.push(a);
            if (!b && i >= 0) S.pickTmp.splice(i, 1);
        } else if (kind === 'all') {
            (a || []).forEach(function (id) {
                var j = S.pickTmp.indexOf(id);
                if (b && j < 0) S.pickTmp.push(id);
                if (!b && j >= 0) S.pickTmp.splice(j, 1);
            });
        } else if (kind === 'clear') {
            S.pickTmp = [];
        }
        F().rerender(renderPick);
    }
    function applyPick() {
        S.stages = S.pickTmp.slice();
        S.page = 1;
        V().closeModal(true);
        render();
    }
    function dropStage(id) {
        var i = S.stages.indexOf(id);
        if (i >= 0) S.stages.splice(i, 1);
        S.page = 1;
        render();
    }
    function clearStages() { S.stages = []; S.page = 1; render(); }

    /* 미분류 교정(«분류 붙이기»)·원문 확인·부서 확인 카드는 2026-10-12 사용자 지시로 걷었다 —
       문서와 할 일의 연결은 업무목록 엑셀이 정하고, 이 시스템에서 분류하지 않는다.
       저장 계층(DYDOCS.remapLedger)은 그대로 둔다. 되살리지 말 것. */
    /* =========================================================================
     * ⑤ 문서 상세
     * ========================================================================= */
    /* 브라우저 뒤로가기 = 상세 닫기 (cmp-status openDetail 과 같은 패턴) */
    function openDoc(id) {
        if (!D().docById(id)) return;
        S.doc = id;
        try { history.pushState({ cmp: 'doc' }, '', urlOf()); } catch (e) {}
        render();
        try { window.scrollTo(0, 0); } catch (e) {}
    }
    function closeDoc() {
        if (history.state && history.state.cmp === 'doc') { history.back(); return; }
        S.doc = '';
        render();
    }
    function rowOpen(e, id) {
        if (e && e.target && e.target.closest && e.target.closest('button, a, input, label')) return;
        openDoc(id);
    }

    function detailPane() {
        var d = D().docById(S.doc);
        if (!d) { S.doc = ''; return listPane(); }
        var past = d.year < liveYear();
        var st = (d.stageIds || []).map(D().stage).filter(Boolean);

        return backLine() +
        '<section class="card">' +
            '<header class="card-header cmp-doc-h">' +
                '<span class="chip-mini wt">' + esc(d.year) + '년 문서</span>' +
                '<h2 class="cmp-detail-h">' + esc(d.title) +
                    /* 제목 수정은 DOCUP 이 그린다 — 업무문서 상세와 같은 모달·검사·
                       권한을 쓴다(§7). 권한이 없으면 아무것도 나오지 않는다. */
                    ((global.DOCUP && global.DOCUP.titleEditBtn) ? global.DOCUP.titleEditBtn(d, 'CMPDOC') : '') +
                '</h2>' +
                '<p class="cmp-dim">' + esc((D().SRC[d.src] || {}).label || d.src || '') +
                    ' · ' + esc(d.date || '일자 미기재') + ' · ' + esc(d.id) +
                    (D().srText(d, true) ? ' · ' + esc(D().srText(d, true)) : '') + '</p>' +
                '<p class="cmp-doc-tags">' +
                    (st.length
                        ? st.map(function (s) {
                            return '<a class="chip-mini wt-elec" href="cmp-status.html?stage=' + encodeURIComponent(s.id) + '&year=' + d.year + '">' + esc(s.name) + '</a>';
                          }).join(' ')
                        : '<span class="cmp-dim">연결된 할 일 없음</span>') +
                '</p>' +
            '</header>' +
            /* 문서 정보는 **열에 가두지 않는다** — 문서 전체에 대한 값이라 한쪽 열에
               넣으면 좌우가 갈린다(실측 왼쪽 704 / 오른쪽 148). 2열 위에 전폭으로
               두고, 항목이 많지 않으므로 가로로 흐르게 한다. */
            '<div class="card-body cmp-meta-wrap">' + metaBlock(d) + '</div>' +
            '<div class="card-body cmp-two cmp-two-doc">' +
                '<div class="cmp-two-l">' + leftPane(d) + '</div>' +
                '<div class="cmp-two-r">' +
                    (past ? carryCard(d) : '') +
                    thisYearCard(d, st) +
                    removeLine(d, st) +
                '</div>' +
            '</div>' +
        '</section>';
    }
    /* 문서 정보 — 종전에는 헤더 한 줄에 압축돼 있어 **담당부서·데이터 구분이
     * 보이지 않았고**, 그걸 보려면 업무문서 쪽 상세로 넘어가야 했다. 업무관리에서
     * 시작한 사람이 다른 메뉴로 튕기지 않도록 여기서 끝낸다. */
    function metaBlock(d) {
        function row(k, v) { return '<div><dt>' + esc(k) + '</dt><dd>' + v + '</dd></div>'; }
        /* 온나라 값은 «이어진 우리 부서 문서»에만 더한다(SCR-CMP-002 §4-4 · P19).
           다른 부서·연결 전 문서에는 행 자체를 그리지 않는다 — 비어 있는 칸이 남으면
           «값이 없다»로 읽힌다. 일련번호 표기는 DOC-08 답 전 기본값(«처리과 일련번호»). */
        function onnMetaRows(doc) {
            var on = onnOf(doc);
            if (!on.linked || !on.same) return '';
            var n = on.links.length;
            return row(O().noLabel(), esc(O().noText(on.link)) + (n > 1 ? ' ' + dim('외 ' + (n - 1) + '건') : '')) +
                (on.det && on.det.state ? row('결재 상태', esc(on.det.state) + (on.det.doneAt ? ' ' + dim('· ' + on.det.doneAt) : '')) : '') +
                (on.det ? row('문서 구분', esc(on.det.kind)) : '');
        }
        /* 담당자 — 원장은 부서까지만 갖는다. 이어진 문서는 기안자가 실제로 있으므로
           우리 부서에는 기안자를, 다른 부서에는 «담당 부서에서 봅니다»를 쓴다(P6) —
           있는 값을 «기록 없음»이라고 하면 사실과 다르다. */
        function assigneeNote(doc) {
            var on = doc.origin === 'ledger' ? onnOf(doc) : { linked: false };
            if (on.linked && on.same && on.det && on.det.drafter) return '/ 기안 ' + esc(on.det.drafter);
            if (on.linked && !on.same) return dim('/ 담당자는 담당 부서에서 봅니다');
            return dim('/ 담당자는 기록 없음 — 문서 원장이 부서까지만 갖고 있습니다');
        }
        var dim = function (t) { return '<span class="cmp-dim">' + esc(t) + '</span>'; };
        return '<h3 class="cmp-detail-h3 cmp-meta-h">문서 정보</h3>' +
            '<dl class="cmp-dl">' +
                (d.origin === 'ledger' ? onnMetaRows(d) : row('등록번호', dim('(온나라에서 부여)'))) +
                row('보고일자', d.date ? esc(d.date) : dim('미기재')) +
                row('수발신', D().srText(d, true) ? esc(D().srText(d, true)) : dim('미기재')) +
                row('담당부서 · 담당자', d.dept
                    ? esc(d.dept) + (d.assignee ? ' / ' + esc(d.assignee) : ' ' + assigneeNote(d))
                    : dim('기록 없음')) +
                row('기준연도', esc(d.year) + '년') +
                /* 출처를 틀리게 말하면 그 자체가 거짓 자료가 된다(원장 실측 5만여 건이
                   «사용자 등록»으로 뜨던 결함). 좁은 것부터 판정한다. */
                row('데이터 구분', d.dataMode === 'real'
                    ? '<b>문서 원장 실측</b> ' + dim('— ' + d.year + '년 담양군 문서 원장에서 그대로 가져온 실제 기록입니다.')
                    : d.dataMode === 'demo' ? '예시 값'
                    : '사용자 등록') +
                (d.presetOf ? row('가져온 원본', presetLink(d)) : '') +
                (d.note ? row('비고', esc(d.note)) : '') +
            '</dl>';
    }
    /* =========================================================================
     * 상세 왼쪽 열 — 출처마다 다르다 (SCR-CMP-002 §4-4, 2026-10-28)
     *   원장 문서      → 온나라 원본 문서 (세 상태: 연결 전 / 이어짐·내 부서 / 이어짐·다른 부서)
     *   이 시스템 등록 → 첨부 파일 (종전에는 저장만 하고 다시 볼 길이 없었다)
     *   현행 업무문서  → 종전 안내 그대로 (전용 화면이 관리하는 이 목록 밖 문서)
     * 판정·저장은 DYONNARA 한 곳이다 — 화면은 그 값을 그릴 뿐이다.
     * ========================================================================= */
    var O = function () { return global.DYONNARA; };
    function onnOf(d) {
        if (!O()) return { linked: false, same: false, links: [] };
        var links = O().linksOf(d.id);
        var same = O().sameDept(d);
        S.onnSel = S.onnSel || {};
        var sel = links.filter(function (l) { return l.oid === S.onnSel[d.id]; })[0] || links[0] || null;
        return {
            linked: links.length > 0, same: same, links: links, link: sel,
            det: (sel && same) ? O().detail(d.id, sel.oid) : null,
        };
    }
    function fmtSize(b) {
        b = +b || 0;
        return b >= 1048576 ? (b / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(b / 1024)) + 'KB';
    }
    function leftPane(d) {
        if (d.origin === 'user') return userFiles(d);
        if (d.origin === 'ledger' && O()) return onnPanel(d);
        return '<h3 class="cmp-detail-h3">결재 완료 문서</h3>' +
            '<div class="v2-empty cmp-pdf"><b>원본 파일 미보유</b>' +
                '<p>전용 화면이 관리하는 문서입니다. 결재 완료본은 이 시스템에 보관하지 않습니다 — 그럴듯한 미리보기를 대신 그리지 않습니다.</p></div>';
    }
    function userFiles(d) {
        var fs = d.files || [];
        return '<h3 class="cmp-detail-h3">첨부 파일</h3>' +
            (fs.length
                ? '<ul class="cmp-onn-list">' + fs.map(function (f) {
                    return '<li><span class="cmp-onn-fname" title="' + esc(f.name) + '">' + esc(f.name) + '</span>' +
                        '<span class="cmp-dim">' + fmtSize(f.size) + (f.at ? ' · ' + esc(f.at) : '') + '</span></li>';
                  }).join('') + '</ul>'
                : '<p class="cmp-dim cmp-onn-empty">첨부된 파일이 없습니다.</p>') +
            '<p class="cmp-cap">이 시스템에서 올린 파일입니다. 파일을 여는 기능은 파일 저장 적용 후 제공됩니다.</p>';
    }
    /* «연결은 원본을 찾아가는 길 · 판정과 무관»은 목록 상단 안내가 한 번 말한다 — 패널마다 되풀이하지 않는다 */
    function onnPanel(d) {
        var on = onnOf(d);
        var can = O().canLink(d);
        var id = esc(d.id);
        var head = '<h3 class="cmp-detail-h3">온나라 원본 문서</h3>';

        /* ① 연결 전 */
        if (!on.linked) {
            return head + '<div class="cmp-onn-box"><b>아직 온나라 문서와 이어지지 않았습니다</b>' +
                (can
                    ? '<button type="button" class="btn btn-primary btn-sm" onclick="CMPDOC.onnFind(\'' + id + '\')">온나라에서 찾아 잇기</button>'
                    : '<p>' + (on.same ? esc(O().denyNote(d)) : '잇는 일은 담당 부서(' + esc(d.dept || '—') + ')가 합니다.') + '</p>') +
                '</div>';
        }
        /* ③ 이어짐 · 다른 부서 — 이유를 가르지 않는 한 줄(P18) */
        if (!on.same) {
            return head + '<div class="cmp-onn-box"><span class="chip-status chip-sm success">온나라 연결됨</span>' +
                '<p>원본 정보는 담당 부서에서 봅니다.</p></div>';
        }
        /* ② 이어짐 · 내 부서 */
        var l = on.link, det = on.det || {};
        var tabs = on.links.length > 1
            ? '<div class="cmp-onn-tabs" role="group" aria-label="이어진 온나라 문서">' + on.links.map(function (x) {
                var cur = x.oid === l.oid;
                return '<button type="button" class="cmp-onn-tab' + (cur ? ' is-on' : '') + '" aria-pressed="' + cur + '"' +
                    ' onclick="CMPDOC.onnSel(\'' + id + '\',\'' + esc(x.oid) + '\')">' + esc(O().noText(x)) + '</button>';
              }).join('') + '</div>'
            : '';
        var no = O().noText(l);
        var path = (det.path || []).length
            ? '<h4 class="cmp-onn-h">결재 경로</h4><ol class="cmp-onn-list cmp-onn-path">' + det.path.map(function (s) {
                return '<li><span class="cmp-onn-act">' + esc(s.act) + '</span><span>' + esc(s.name) + ' <span class="cmp-dim">' + esc(s.duty) + '</span></span>' +
                    '<span class="cmp-dim">' + esc(s.at) + '</span></li>';
              }).join('') + '</ol>'
            : '';
        var send = det.send
            ? '<h4 class="cmp-onn-h">발신</h4><p class="cmp-onn-p">보낸 곳 ' + esc(det.send.org) + ' <span class="cmp-dim">· ' + esc(det.send.at) + '</span></p>'
            : '';
        var recv = (det.recv || []).length
            ? '<h4 class="cmp-onn-h">온나라 수신처</h4><ul class="cmp-onn-list">' + det.recv.map(function (r) {
                return '<li><span>[' + esc(r.type) + '] ' + esc(r.name) + '</span><span class="cmp-dim">' + esc(r.status) + ' ' + esc(r.at) + '</span></li>';
              }).join('') + '</ul>'
            : '';
        var files = l.paper
            ? '<p class="cmp-dim cmp-onn-empty">종이문서라 파일 목록이 없습니다.</p>'
            : '<ul class="cmp-onn-list">' + (l.files || []).map(function (f) {
                return '<li><span class="chip-mini">' + esc(f.kind) + '</span><span class="cmp-onn-fname" title="' + esc(f.name) + '">' + esc(f.name) + '</span>' +
                    '<span class="cmp-dim">' + fmtSize(f.size) + '</span></li>';
              }).join('') + '</ul>';
        var acts = can
            ? '<div class="cmp-onn-acts">' +
                (l.paper ? '' : '<button type="button" class="btn btn-outline btn-sm" onclick="CMPDOC.onnRefresh(\'' + id + '\',\'' + esc(l.oid) + '\')">붙임 목록 갱신</button>') +
                '<button type="button" class="btn btn-outline btn-sm" onclick="CMPDOC.onnAskUnlink(\'' + id + '\',\'' + esc(l.oid) + '\')">연결 해제</button>' +
                '<button type="button" class="du-link" onclick="CMPDOC.onnFind(\'' + id + '\')">온나라 문서 더 잇기</button>' +
              '</div>'
            : '<p class="cmp-cap">' + esc(O().denyNote(d)) + '</p>';
        return head + tabs +
            '<div class="cmp-onn-card">' +
                '<p class="cmp-onn-meta">' + V().sampleChip('온나라 연계 전이라 원장 값과 조직도로 만든 예시 자료입니다.') +
                    '<span>온나라 기준 ' + esc(det.fetchedAt || '') + ' 조회</span></p>' +
                '<p class="cmp-onn-no"><b>' + esc(O().noLabel()) + ' ' + esc(no) + '</b>' +
                    '<button type="button" class="du-link" onclick="CMPDOC.onnCopy(\'' + esc(String(l.seq)) + '\')">번호 복사</button></p>' +
                path + send + recv +
                '<h4 class="cmp-onn-h">본문 · 붙임</h4>' + files +
                /* 받기 수단은 운영에서 조건이 풀릴 때까지 내지 않는다(P23 · DOC-07) — 안내 문구도 두지 않고 번호 복사가 그 길을 맡는다 */
                acts +
            '</div>';
    }
    /* 찾기 창 — 단계는 같은 모달 안에서 본문을 바꾼다(§1 단일 모달) */
    function onnFind(id) {
        var d = D().docById(id);
        var r = O() ? O().search(id) : { ok: false, reason: '온나라 연결을 불러오지 못했습니다.' };
        if (!r.ok) { V().toast(r.reason); return; }
        S.onnCands = { id: id, list: r.cands };
        var p = me();
        V().openModal('온나라에서 찾아 잇기',
            '<div class="cmp-na">' +
                '<p class="cmp-onn-meta">' + V().sampleChip('온나라 연계 전이라 원장 값으로 만든 예시 후보입니다.') + '</p>' +
                '<p><b>원장 값으로 찾았습니다</b> — ' + esc(d.year) + '년 · ' + esc(d.dept || '') + ' · «' + esc(d.title) + '»</p>' +
                '<p class="cmp-dim">' + esc(p ? p.name : '') + ' 님의 온나라 계정으로 조회합니다. 다른 부서 문서는 나오지 않습니다.</p>' +
                (r.cands.length
                    ? '<ul class="cmp-onn-cands">' + r.cands.map(function (c, i) {
                        return '<li><button type="button" class="cmp-onn-cand" onclick="CMPDOC.onnPick(\'' + esc(id) + '\',' + i + ')">' +
                            '<b>' + esc(c.title) + '</b>' +
                            '<span class="cmp-dim">' + esc(O().noLabel()) + ' ' + esc(O().noText(c)) + ' · ' + esc(c.date) + ' · ' + esc(c.deptName) + '</span></button></li>';
                      }).join('') + '</ul>'
                    : '<div class="v2-empty"><b>더 이을 온나라 문서가 없습니다</b><p>후보를 이미 모두 이었습니다.</p></div>') +
            '</div>',
            '<button class="btn btn-outline" onclick="DYV2.closeModal()">닫기</button>');
    }
    function onnPick(id, i) {
        var d = D().docById(id);
        var c = S.onnCands && S.onnCands.id === id ? S.onnCands.list[i] : null;
        if (!d || !c) { V().toast('후보를 다시 고르세요.'); return; }
        var df = O().diffs(d, c);
        function tr(k, a, b) {
            var bad = df.indexOf(k) >= 0;
            return '<tr' + (bad ? ' class="cmp-onn-diff"' : '') + '><th scope="row">' + esc(k) + (bad ? ' <span class="chip-status chip-sm warning">다름</span>' : '') + '</th>' +
                '<td>' + esc(a) + '</td><td>' + esc(b) + '</td></tr>';
        }
        var last = df[df.length - 1] || '';
        V().openModal('온나라에서 찾아 잇기 — 확인',
            '<div class="cmp-na">' +
                '<p>원장 값과 온나라 값을 비교하고, 같은 문서이면 잇습니다.</p>' +
                (df.length
                    ? '<p class="cmp-onn-warn">' + esc(df.join('·')) + V().josa(last, '이', '가') + ' 다릅니다. 같은 문서인지 확인하고 이으세요 — 판단은 담당자가 합니다.</p>'
                    : '') +
                '<div class="cmp-wrap"><table class="table-figma table-compact"><thead><tr><th scope="col">항목</th><th scope="col">원장</th><th scope="col">온나라</th></tr></thead><tbody>' +
                    tr('제목', d.title, c.title) + tr('보고일자', d.date || '—', c.date || '—') + tr('부서', d.dept || '—', c.deptName || '—') +
                    '<tr><th scope="row">' + esc(O().noLabel()) + '</th><td class="cmp-dim">—</td><td>' + esc(O().noText(c)) + '</td></tr>' +
                '</tbody></table></div>' +
            '</div>',
            '<button class="btn btn-outline" onclick="CMPDOC.onnFind(\'' + esc(id) + '\')">‹ 다시 고르기</button>' +
            '<button class="btn btn-primary" onclick="CMPDOC.onnLink(\'' + esc(id) + '\',' + i + ')">이 문서와 잇기</button>');
    }
    function onnLink(id, i) {
        var c = S.onnCands && S.onnCands.id === id ? S.onnCands.list[i] : null;
        var r = O().link(id, c);
        if (!r.ok) { V().toast(r.reason); return; }
        S.onnSel = S.onnSel || {};
        S.onnSel[id] = r.link.oid;
        V().closeModal(true);
        render();
        V().toast('온나라 문서와 이었습니다 — 결재 경로와 붙임 목록이 보입니다.');
    }
    function onnAskUnlink(id, oid) {
        var l = O().linksOf(id).filter(function (x) { return x.oid === oid; })[0];
        if (!l) return;
        V().openModal('온나라 연결 해제',
            '<div class="cmp-na">' +
                '<p><b>' + esc(O().noLabel()) + ' ' + esc(O().noText(l)) + '</b>와의 연결을 끊습니다.</p>' +
                '<p>끊어도 원장 문서와 이행 판정은 그대로입니다. 누가 언제 끊었는지 기록에 남습니다. 잘못 이었다면 끊은 뒤 다시 찾아 이으세요.</p>' +
            '</div>',
            '<button class="btn btn-outline" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" onclick="CMPDOC.onnUnlink(\'' + esc(id) + '\',\'' + esc(oid) + '\')">연결 해제</button>');
    }
    function onnUnlink(id, oid) {
        var r = O().unlink(id, oid);
        if (!r.ok) { V().toast(r.reason); return; }
        V().closeModal(true);
        render();
        V().toast(r.left ? '연결을 끊었습니다 — 이어진 온나라 문서가 ' + r.left + '건 남았습니다.' : '연결을 끊었습니다 — 이 문서는 다시 «연결 전»입니다.');
    }
    function onnRefresh(id, oid) {
        var r = O().refresh(id, oid);
        if (!r.ok) { V().toast(r.reason); return; }
        render();
        V().toast('붙임 목록을 온나라에서 다시 받았습니다.');
    }
    function onnSel(id, oid) { S.onnSel = S.onnSel || {}; S.onnSel[id] = oid; render(); }
    function onnCopy(text) {
        function done() { V().toast('번호 ' + text + '를 복사했습니다 — 온나라에서 이 번호로 찾아보십시오.'); }
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () { V().toast('복사하지 못했습니다 — 번호: ' + text); }); return; }
        } catch (e) {}
        V().toast('번호: ' + text);
    }

    /* 어느 문서에서 가져왔는지 — 되돌아가 볼 수 있어야 «제목이 왜 이런지»를 안다 */
    function presetLink(d) {
        var src = D().docById(d.presetOf);
        if (!src) return '<span class="cmp-dim">' + esc(d.presetOf) + ' (원본을 찾을 수 없음)</span>';
        /* 제목이 길면 세 줄로 접혀 dl 이 흐트러진다 — 한 줄로 자르고 전체는
           title 로 남긴다(§6 truncation-strategy — 자를 때는 전체를 볼 수단을 준다). */
        return '<button type="button" class="du-link cmp-preset-link"' +
            ' title="' + esc(src.year) + '년 ' + esc(src.title) + '"' +
            ' onclick="CMPDOC.openDoc(\'' + esc(src.id) + '\')">' +
            esc(src.year) + '년 ' + esc(src.title) + '</button>';
    }

    /* 회수 경로 — 등록만 있고 지울 수단이 없으면 시연을 반복할수록 데이터가 쌓인다
     * (CLAUDE.md §4 CRUD · 검수 C-3). 판정·삭제는 전부 DYDOCS 다 — 사용자 등록분만
     * 지울 수 있고(원장 불가) 권한은 canDelete()(재난안전과 담당자) 그대로다. */
    /* 지울 수 없는 문서에는 수단 대신 **사유**를 낸다(SCR-CMP-002 §3 예외·P11) —
       종전에는 빈 문자열이라 부서 담당자가 자기가 올린 문서를 열어도 삭제에 대해
       아무 말이 없어 «왜 지우는 버튼이 없지»가 됐다. */
    function removeLine(d, st) {
        if (d.dataMode !== 'user') {
            var from = d.origin === 'v2' ? '현행 업무문서라'
                     : '문서 원장의 실측 문서라';
            return '<p class="cmp-cap cmp-remove">' + from + ' 이 화면에서 지우지 않습니다.</p>';
        }
        if (!D().canDelete()) {
            return '<p class="cmp-cap cmp-remove">이 화면에서 등록한 문서입니다. 잘못 만들었다면 ' +
                '<b>재난안전과 담당자</b>가 지웁니다 — 등록 직후에는 등록 결과 창의 «되돌리기»로 직접 물릴 수 있습니다.</p>';
        }
        return '<p class="cmp-cap cmp-remove">이 문서는 이 화면에서 등록한 것입니다. 잘못 만들었다면 ' +
            '<button type="button" class="du-link" onclick="CMPDOC.askRemove(\'' + esc(d.id) + '\')">문서 삭제</button> 로 되돌립니다.</p>';
    }
    function askRemove(id) {
        var d = D().docById(id);
        if (!d) return;
        var st = (d.stageIds || []).map(D().stage).filter(Boolean);
        V().openModal('문서 삭제 · 회수 내역 확인',
            '<div class="cmp-na">' +
                '<p><b>' + esc(d.title) + '</b><span class="cmp-scode">' + esc(d.id) + ' · ' + esc(d.year) + '년</span></p>' +
                '<p>삭제하면 <b>문서 1건</b>과 <b>할 일 연결 ' + st.length + '건</b>이 회수되고, ' +
                    '증빙이 사라진 할 일은 다시 판정됩니다(남은 문서가 없으면 미이행).</p>' +
                (st.length ? '<ul class="cmp-bulk-list">' + st.map(function (s) {
                    return '<li><b>' + esc(s.name) + '</b><span class="cmp-dim">' + esc(s.id) + '</span></li>';
                }).join('') + '</ul>' : '') +
            '</div>',
            '<button class="btn btn-outline" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" onclick="CMPDOC.doRemove(\'' + esc(id) + '\')">삭제</button>');
    }
    function doRemove(id) {
        var r = D().removeDocument(id);
        if (!r.ok) { V().toast(r.reason); return; }
        V().closeModal(true);
        S.doc = '';
        render();
        V().toast('문서를 삭제했습니다 — 할 일 연결 ' + r.doc.stageIds.length + '건이 함께 회수되었습니다.');
    }
    /* 돌아가는 줄 — 두 목적지가 **한 줄에** 온다.
     *   ‹ 문서 목록으로   : 이 화면 안에서 상세를 닫는다(늘 있다)
     *   ‹ 이행 관리로     : 왔던 화면으로 나간다(다른 메뉴에서 온 경우만)
     * 세로로 쌓으면 둘 다 «‹»로 시작해 어느 쪽이 어디로 가는지 헷갈리고 제목이
     * 아래로 밀린다. 한 줄에 두고 구분자로 갈라 «지금 어디서 왔는지»를 보인다.
     * 조사는 josa() 가 붙인다 — 「이행 관리(으)로」 같은 표기를 내지 않는다. */
    function backLine() {
        var close = '<button type="button" class="du-link" onclick="CMPDOC.closeDoc()">‹ 문서 목록으로</button>';
        var out = '';
        if (S.back) {
            var U = global.DOCUP;
            var t = (U && U.backTarget) ? U.backTarget(S.back) : null;
            if (t) {
                out = '<a class="du-link" href="' + esc(t.href) + '">‹ ' + esc(t.label) +
                    V().josa(t.label, '으로', '로') + ' 돌아가기</a>' +
                    '<span class="cmp-back-sep" aria-hidden="true">·</span>';
            }
        }
        return '<p class="cmp-back">' + out + close + '</p>';
    }
    /* 올해 이어받기 — 지난연도 문서에만 붙인다(올해 문서를 또 만들 이유가 없다) */
    function carryCard(d) {
        var y = liveYear();
        var can = D().canUpload();
        /* 할 일이 붙지 않은 문서는 이어받지 않는다 — 이어받기는 «할 일 연결과 첨부를
           함께 가져와» 올해 증빙을 만드는 일인데(SCR-CMP-002 §3-2), 가져올 연결이 없으면
           어느 의무의 증빙도 아닌 사본이 생긴다. 종전에는 버튼을 내고 «등록 뒤 직접
           골라야 합니다»라고 약속했지만 사용자 등록 문서에는 할 일을 붙이는 수단이 없어
           그 사본은 «연결된 할 일 없음 · 분류완료»로 영영 남았다. 수단 대신 사유를 낸다. */
        if (!(d.stageIds || []).some(function (s) { return !!D().stage(s); })) {
            return '<div class="cmp-card">' +
                '<h3 class="cmp-detail-h3">올해 이어받기</h3>' +
                '<p>연결된 할 일이 없는 문서라 올해 이행 증빙으로 이어받지 않습니다.</p>' +
            '</div>';
        }
        /* 이미 이어받은 원본이면 등록 버튼 대신 그 문서를 가리킨다(검수 C-2) */
        var dup = D().carriedInto(d.id, y);   /* 세 경로 공용 판정 */
        return '<div class="cmp-card">' +
            '<h3 class="cmp-detail-h3">올해 이어받기</h3>' +
            (dup
                ? '<p><span class="chip-status chip-sm success">이어받기 완료</span> 이 문서로 이미 <b>' + y + '년</b> 문서를 만들었습니다.</p>' +
                  '<button type="button" class="btn btn-outline" onclick="CMPDOC.openDoc(\'' + esc(dup.id) + '\')">만든 문서 보기</button>'
                : '<p>이 문서를 바탕으로 <b>' + y + '년</b> 문서를 만듭니다. 업무단계 ' +
                    ((d.stageIds || []).length || 0) + '개' + (d.sr ? '·수발신자' : '') +
                    (( d.files || []).length ? '·첨부 ' + d.files.length + '건' : '') +
                    '가 그대로 채워지고 제목의 연도가 ' + y + '으로 바뀝니다.</p>' +
                  '<p class="cmp-cap"><b>본문·결재문서는 복제하지 않습니다</b> — 원본은 온나라에 있고 결재는 새로 받습니다.' +
                    ((d.stageIds || []).length ? '' : ' 이 문서에는 연결된 할 일이 없어 등록 뒤 직접 골라야 합니다.') + '</p>' +
                  (can
                      ? '<button type="button" class="btn btn-primary" onclick="CMPDOC.carry(\'' + esc(d.id) + '\')">올해 문서로 등록</button>'
                      : '<p class="cmp-cap"><b>조회 전용</b> — 문서 등록은 부서 담당자가 수행합니다.</p>')) +
        '</div>';
    }
    /* 올해 동일 단계 현황 — 판정은 DYCMP.judge 하나만 쓴다 */
    function thisYearCard(d, st) {
        var y = liveYear();
        if (!st.length) return '';
        return '<div class="cmp-card">' +
            '<h3 class="cmp-detail-h3">' + y + '년 동일 단계 현황</h3>' +
            '<ul class="cmp-yrlist">' + st.map(function (s) {
                var j = C().judge(s, y);
                var g = C().nextGap(s, y);
                return '<li><a href="cmp-status.html?stage=' + encodeURIComponent(s.id) + '&year=' + y + '">' + esc(s.name) + '</a> ' +
                    '<span class="chip-status chip-sm ' + j.tone + '">' + j.glyph + ' ' + esc(j.label) + '</span>' +
                    '<span class="cmp-dim">' + (j.need > 0 ? '회차 ' + j.round : '상시') +
                        (g ? ' · 다음 회차 기한 ' + esc(g.due) + ' (말일 추정)' : '') + '</span></li>';
            }).join('') + '</ul>' +
        '</div>';
    }
    function carry(id) {
        var src = D().docById(id);
        if (!src) return;
        var y = liveYear();
        /* 카드가 버튼을 내지 않는 경우를 전역 호출로도 막는다 — 권한(canUpload)과
           소유권·할 일 없음은 저장 계층(addDocument)이 다시 판정한다. */
        if (!D().canUpload()) { V().toast('조회 전용입니다 — 문서 등록은 부서 담당자가 수행합니다.'); return; }
        if (+src.year >= y) { V().toast('지난 연도 문서만 올해로 이어받습니다.'); return; }
        /* 같은 원본을 두 번 이어받지 않는다(검수 C-2) — 이미 만든 문서로 안내한다 */
        var dup = D().carriedInto(id, y);
        if (dup) {
            S.doc = dup.id;
            render();
            V().toast('이미 ' + y + '년으로 이어받은 문서가 있어 그 문서로 이동했습니다.');
            return;
        }
        var title = String(src.title || '').split(String(src.year)).join(String(y));
        /* 복사 범위는 «전부»다(발주처 결정 2026-08-18) — 제목·수발신자·업무단계 매핑·첨부.
           본문·결재문서는 온나라 연동 전이라 원본이 없고, 결재는 새로 받아야 한다. */
        var files = (src.files || []).slice();
        var stages = (src.stageIds || []).slice();
        var r = D().addDocument({
            title: title,
            sr: src.sr || '',
            date: y + '-' + String(V().today()).slice(5),
            year: y,
            stageIds: stages,
            files: files,
            src: 'upload',
            dept: myDept(),
            note: src.year + '년 문서(' + src.id + ')를 이어받아 만든 문서 — 업무단계 ' + stages.length + '개' +
                  (files.length ? ' · 첨부 ' + files.length + '건' : ' · 원본에 첨부 없음') +
                  '. 본문·결재문서는 복제하지 않습니다(온나라 연동 전).',
            presetOf: src.id,
        });
        if (!r.ok) { V().toast(r.reason); return; }
        /* 이 화면은 상세가 안에 있으므로 **그 자리에서 새 문서로 바꾼다** — 다른
           경로(불러오기·프리셋)가 결과 화면을 띄우는 것과 목적지는 같다. */
        S.doc = r.doc.id;
        render();
        /* 문구가 실제 복사 범위와 달랐다 — 제목·수발신자뿐 아니라 업무단계와
           첨부까지 가져온다(위 주석 «복사 범위는 전부»). 무엇이 딸려왔는지
           모르면 담당자가 첨부를 또 올린다. */
        /* «할 일 1개 · 원본에 첨부 없음을 함께 가져왔습니다»로 읽혀 «없음»을 가져온
           꼴이었다 — 가져온 것과 없는 것을 나눠 말한다. */
        V().toast(y + '년 문서로 등록했습니다 — 할 일 ' + stages.length + '개' +
            (files.length ? '와 첨부 ' + files.length + '건을 함께 가져왔습니다.'
                          : '를 함께 가져왔습니다. 원본에는 첨부가 없습니다.'));
    }

    /* ── 페이지 제목 줄 ── */
    function injectHead() {
        var host = document.querySelector('.dy-page-title');
        if (!host) return;
        var old = host.querySelector('.page-head-action');
        if (old) old.remove();
        var wrap = document.createElement('div');
        wrap.className = 'page-head-action cmp-headact';
        wrap.innerHTML = D().canUpload()
            ? '<button type="button" class="btn btn-primary btn-sm" onclick="DOCUP.open(' + liveYear() + ')">＋ 문서 등록</button>'
            : '<span class="cmp-ro">조회 전용</span>';
        host.appendChild(wrap);
    }

    /* ── 전역 진입점 ── */
    function setF(k, v) { S[k] = v; S.page = 1; rerender(); }
    /* 초기화는 '연도 전체'가 아니라 **기본 연도**로 돌아간다 — 읽는 사람이 기대하는
       초기 상태가 처음 열었을 때의 화면이다. */
    function resetF() { S.q = ''; S.sr = ''; S.year = String(D().defaultYear()); S.status = ''; S.stages = []; S.dept = ''; S.menu = ''; S.page = 1; rerender(); }
    function expand(id) { S.expand[id] = !S.expand[id]; render(); }
    function toggleAdv() { S.adv = !docAdvOpen(); render(); }
    function go(n) { S.page = n; render(); try { window.scrollTo(0, 0); } catch (e) {} }

    function init(mount) {
        S.mount = mount;
        readURL();
        window.addEventListener('popstate', function () { readURL(); render(); });
        render();
    }

    global.CMPDOC = {
        init: init, render: render,
        setF: setF, resetF: resetF, expand: expand, go: go, toggleAdv: toggleAdv,
        openPick: openPick, pick: pick, applyPick: applyPick, dropStage: dropStage, clearStages: clearStages,
        openDoc: openDoc, closeDoc: closeDoc, carry: carry, rowOpen: rowOpen,
        /* 제목 수정은 DOCUP 단일 출처 — 저장 뒤 이 화면만 다시 그린다 */
        editTitle: function (id) {
            if (!global.DOCUP || !global.DOCUP.editTitle) { V().toast('제목 수정을 불러오지 못했습니다.'); return; }
            global.DOCUP.editTitle(id, function () { render(); });
        },
        askRemove: askRemove, doRemove: doRemove,
        /* 온나라 원본 문서 — 판정·저장은 DYONNARA (SCR-CMP-002 §3-3 · P17~P23) */
        onnFind: onnFind, onnPick: onnPick, onnLink: onnLink,
        onnAskUnlink: onnAskUnlink, onnUnlink: onnUnlink, onnRefresh: onnRefresh,
        onnSel: onnSel, onnCopy: onnCopy,
        state: S,
    };
}(window));
