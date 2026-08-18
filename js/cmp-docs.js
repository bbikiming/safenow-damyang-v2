/* =========================================================================
 * 업무 관리(신) — 문서 목록 (cmp-docs.html, 전역 CMPDOC)
 *   기획: docs/planning/기획-업무관리-신버전-이행관리-문서목록-v1.md §5
 *   구조: docs/planning/자료-업무관리-이행관리-와이어프레임-v1.html ④⑤
 *
 *   목록(④) → 행을 누르면 같은 화면 본문이 문서 상세(⑤)로 바뀐다.
 *   지난연도 문서 상세에는 **올해 이어받기** 카드가 붙고, 올해 문서에는 붙지 않는다.
 *
 *   [문서 축은 DYDOCS 하나뿐이다]
 *   원장 3,830 + 현행 업무문서 426 + 사용자 등록분을 DYDOCS.allDocs() 가 이미
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
    function esc(s) { return V().esc(String(s == null ? '' : s)); }

    var PAGE = 25;
    var S = {
        mount: null,
        q: '', sr: '', year: '', status: '',
        dept: '',            /* 이행 관리 L2 에서 넘어온 부서 조건 — 필터 UI 로는 내지 않는다(D-5) */
        stages: [],          /* 업무단계 다중 조건 (DYPICK) */
        page: 1,
        expand: {},          /* docId → 업무단계 칩 전부 펼침 */
        doc: '',             /* 문서 상세 */
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
        var st = p.get('stage');
        if (st && D().stage(st)) S.stages = [st];
        /* 기본 연도는 비워 두지 않는다 — 전체를 날짜 내림차순으로 보면 첫 페이지가
           2026년 현행 업무문서(이행항목 축이 없는 «이 목록 밖 문서»)로만 채워져,
           이 화면의 요점인 «어떤 할 일의 증빙인가»가 첫 화면에서 보이지 않는다.
           기준은 이행 관리 화면과 같은 DYDOCS.defaultYear()(데이터가 있는 최신 연도)다. */
        S.year = p.get('year') != null ? p.get('year') : String(D().defaultYear());
        S.q = p.get('q') || '';
        S.sr = p.get('sr') || '';
        S.status = p.get('status') || '';
        S.dept = p.get('dept') || '';
        /* 부서로 들어오면 연도 기본값을 풀어 준다 — 그 부서 문서를 보러 온 것이지
           특정 연도를 보러 온 것이 아니다(0건으로 맞이하지 않는다) */
        if (S.dept && p.get('year') == null) S.year = '';
        var doc = p.get('doc');
        S.doc = (doc && D().docById(doc)) ? doc : '';   /* 없으면 상세도 없다 — 뒤로가기 닫힘의 전제 */
    }
    function urlOf() {
        var p = new URLSearchParams();
        if (S.stages.length === 1) p.set('stage', S.stages[0]);
        if (S.year) p.set('year', S.year);
        if (S.q) p.set('q', S.q);
        if (S.sr) p.set('sr', S.sr);
        if (S.status) p.set('status', S.status);
        if (S.dept) p.set('dept', S.dept);
        if (S.doc) p.set('doc', S.doc);
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
        if (S.status && d.status !== S.status) return false;
        if (S.sr && !F().match(S.sr, [d.sr])) return false;
        if (S.stages.length) {
            var hit = (d.stageIds || []).some(function (sid) { return S.stages.indexOf(sid) >= 0; });
            if (!hit) return false;
        }
        if (S.q && !F().match(S.q, [d.title, d.id, d.sr])) return false;
        return true;
    }
    function view() {
        return D().allDocs().filter(match).sort(function (a, b) {
            return String(b.date || '').localeCompare(String(a.date || ''));
        });
    }
    function filtering() { return !!(S.q || S.sr || S.year || S.status || S.stages.length || S.dept); }

    function yearOptions() {
        return [['', '연도 전체']].concat(C().years().slice().reverse().map(function (y) { return [y, y + '년']; }));
    }
    function statusOptions() {
        var seen = {};
        D().allDocs().forEach(function (d) { if (d.status) seen[d.status] = 1; });
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

    function notice() {
        var all = D().allDocs();
        var lc = C().linkCounts(all);
        var lead = '업무문서 <b>' + all.length.toLocaleString() + '건</b> · 할 일 연결 <b>' + lc.links.toLocaleString() + '건</b>';
        var rest =
            '<p><b>한 문서가 여러 할 일에 연결되므로 이행현황의 문서 합계는 실제 문서 수보다 큽니다.</b> ' +
                '두 숫자를 함께 적어 오해를 막습니다 — 위 수치는 화면에서 센 값이지 고정값이 아닙니다.</p>' +
            '<p>결재 완료 PDF·본문은 아직 없습니다 — 온나라 연동 전이라 <b>문서명·수발신자·보고일자·생산등록번호</b>만 있습니다.</p>' +
            '<p>같은 문서를 종전 방식으로 찾는 화면은 <a href="docs-preset.html">업무문서 &gt; 업무 목록</a>입니다.</p>' +
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
                extraActive: advN + (S.stages.length ? 1 : 0) + (S.dept ? 1 : 0),
                actions: '<button type="button" class="btn btn-outline btn-sm" onclick="CMPDOC.openPick()">업무단계 고르기' +
                        (S.stages.length ? ' <b>' + S.stages.length + '</b>' : '') + '</button>' +
                    '<button type="button" class="btn btn-outline btn-sm" aria-expanded="' + (docAdvOpen() ? 'true' : 'false') +
                        '" aria-controls="cd-adv" onclick="CMPDOC.toggleAdv()">상세 조건 ' + (docAdvOpen() ? '▴' : '▾') +
                        (advN ? ' <b>' + advN + '</b>' : '') + '</button>',
            });
        bar += yearChips() + docAdvPanel();

        return notice() + bar + deptCond() + stageCond() +
            '<p class="cmp-cap">조건에 맞는 <b>문서 ' + list.length.toLocaleString() + '건</b> · 할 일 <b>연결 ' + lc.links.toLocaleString() + '건</b> — ' +
                '한 문서가 여러 할 일에 걸리므로 두 수는 다릅니다.</p>' +
            (rows.length ? table(rows) : emptyBox()) +
            pager(pages, list.length);
    }
    /* 부서 조건은 **셀렉트로 내지 않는다**(D-5) — 원장 문서에 담당부서 값이 없어
     * 드롭다운을 만들면 대부분 0건이 되고 "데이터가 없다"로 오독된다. 이행 관리에서
     * 넘어와 걸린 경우에만 칩으로 보이고, 그 사실(원장 미보유)을 함께 밝힌다. */
    function deptCond() {
        if (!S.dept) return '';
        var total = D().allDocs().filter(function (d) { return d.dept === S.dept; }).length;
        return '<p class="cmp-cond"><span class="chip-mini wt-elec">' + esc(S.dept) + ' 문서 ' + total + '건' +
            '<button type="button" class="cmp-cond-x" aria-label="부서 조건 해제" onclick="CMPDOC.setF(\'dept\',\'\')">×</button></span>' +
            '<span class="cmp-dim">담당부서 값이 있는 문서만 셉니다 — 2025년 원장은 재난안전과 소관이라 부서 값이 없습니다.</span></p>';
    }
    /* 연도 칩 — 값이 2~3개뿐이라 드롭다운은 과하다. 각 칩에 건수를 붙여
       고르기 전에 몇 건인지 보이게 한다. */
    function yearChips() {
        var all = D().allDocs();
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
    function docAdvCount() { return [S.status, S.sr].filter(Boolean).length; }
    function docAdvOpen() { return S.adv || docAdvCount() > 0; }
    function docAdvPanel() {
        if (!docAdvOpen()) return '';
        return '<div class="dl-adv cmp-adv" id="cd-adv"><div class="dl-adv-grid">' +
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
    function table(rows) {
        return '<div class="cmp-wrap"><table class="table-figma table-compact cmp-table"><thead><tr>' +
            '<th class="cmp-c-main">문서명</th><th class="cmp-c-stg">업무단계</th><th class="cmp-c-ac">수발신자</th>' +
            '<th class="cmp-num cmp-c-rd">보고일자</th><th class="cmp-c-st">결재상태</th>' +
        '</tr></thead><tbody>' + rows.map(row).join('') + '</tbody></table></div>';
    }
    function row(d) {
        /* 행 전체가 진입 타깃(와이어프레임 tr.stg) — 칩·버튼 클릭에는 양보한다 */
        return '<tr class="cmp-stg cmp-rowlink" onclick="CMPDOC.rowOpen(event, \'' + esc(d.id) + '\')"><td class="cmp-c-main">' +
                '<button type="button" class="cmp-slink" onclick="CMPDOC.openDoc(\'' + esc(d.id) + '\')">' + esc(d.title) + '</button>' +
                '<span class="cmp-scode">' + esc(d.id) + ' · ' + esc(d.year) + '년</span></td>' +
            '<td class="cmp-c-stg">' + stageChips(d) + '</td>' +
            '<td class="cmp-c-ac">' + (d.sr ? esc(d.sr) : '<span class="cmp-dim">—</span>') + '</td>' +
            '<td class="cmp-num">' + esc(d.date || '—') + '</td>' +
            '<td><span class="chip-status chip-sm ' + V().toneOf(d.status) + '">' + esc(d.status || '—') + '</span></td></tr>';
    }
    /* 2개 초과는 +N 으로 접고 **클릭하면 인라인으로 펼친다** — hover 툴팁은 쓰지
       않는다(터치에서 열 방법이 없고 스크린리더가 읽지 못한다, §7). */
    function stageChips(d) {
        var st = (d.stageIds || []).map(D().stage).filter(Boolean);
        /* 왜 비었는지 모르면 데이터 오류로 읽힌다 — 칩에 이유를 단다(D-11) */
        if (!st.length) {
            return d.origin === 'ledger'
                ? '<span class="chip-status chip-sm warning" title="2025년 원장에 분류가 빠진 문서입니다. 원장 교정은 업무문서 &gt; 이행 목록에서 합니다.">미분류</span>'
                : '<span class="chip-mini wt" title="이행항목 축이 없는 현행 업무문서입니다 — 전용 화면에서 관리하는 문서라 여기서는 연결된 할 일이 없습니다.">이 목록 밖 문서</span>';
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

        return '<p class="cmp-back"><button type="button" class="du-link" onclick="CMPDOC.closeDoc()">‹ 문서 목록으로</button></p>' +
        '<section class="card">' +
            '<header class="card-header cmp-doc-h">' +
                '<span class="chip-mini wt">' + esc(d.year) + '년 문서</span>' +
                '<h2 class="cmp-detail-h">' + esc(d.title) + '</h2>' +
                '<p class="cmp-dim">' + esc((D().SRC[d.src] || {}).label || d.src || '') +
                    ' · ' + esc(d.date || '일자 미기재') + ' · ' + esc(d.id) +
                    (d.sr ? ' · ' + esc(d.sr) : '') + '</p>' +
                '<p class="cmp-doc-tags">' +
                    (st.length
                        ? st.map(function (s) {
                            return '<a class="chip-mini wt-elec" href="cmp-status.html?stage=' + encodeURIComponent(s.id) + '&year=' + d.year + '">' + esc(s.name) + '</a>';
                          }).join(' ')
                        : '<span class="cmp-dim">연결된 할 일 없음</span>') +
                    ' ' + mapChip(d) +
                '</p>' +
            '</header>' +
            '<div class="card-body cmp-two cmp-two-doc">' +
                '<div class="cmp-two-l">' +
                    '<h3 class="cmp-detail-h3">결재 완료 문서</h3>' +
                    '<div class="v2-empty cmp-pdf"><b>PDF 미보유 (온나라 연동 전)</b>' +
                        '<p>이 시스템에는 문서명·수발신자·보고일자·생산등록번호만 있습니다. ' +
                        '결재 완료본을 여기서 보려면 온나라 연동이 필요합니다 — 그럴듯한 미리보기를 대신 그리지 않습니다.</p></div>' +
                '</div>' +
                '<div class="cmp-two-r">' +
                    (past ? carryCard(d) : '') +
                    thisYearCard(d, st) +
                    removeLine(d, st) +
                '</div>' +
            '</div>' +
        '</section>';
    }
    /* 회수 경로 — 등록만 있고 지울 수단이 없으면 시연을 반복할수록 데이터가 쌓인다
     * (CLAUDE.md §4 CRUD · 검수 C-3). 판정·삭제는 전부 DYDOCS 다 — 사용자 등록분만
     * 지울 수 있고(원장 불가) 권한은 canDelete()(재난안전과 담당자) 그대로다. */
    function removeLine(d, st) {
        if (d.dataMode !== 'user') return '';
        if (!D().canDelete()) return '';
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
    function mapChip(d) {
        if (d.origin === 'ledger') {
            return d.mapped
                ? '<span class="chip-status chip-sm success">분류완료</span>'
                : '<span class="chip-status chip-sm warning">미분류 — 원장 교정 대상</span>';
        }
        if (d.origin === 'v2') return '<span class="chip-mini wt">이 목록 밖 문서 — 할 일 축 없음</span>';
        return '<span class="chip-status chip-sm success">분류완료</span>';
    }
    /* 올해 이어받기 — 지난연도 문서에만 붙인다(올해 문서를 또 만들 이유가 없다) */
    function carryCard(d) {
        var y = liveYear();
        var can = D().canUpload();
        /* 이미 이어받은 원본이면 등록 버튼 대신 그 문서를 가리킨다(검수 C-2) */
        var dup = null;
        D().allDocs().some(function (x) { if (x.presetOf === d.id && +x.year === y) { dup = x; return true; } return false; });
        return '<div class="cmp-card">' +
            '<h3 class="cmp-detail-h3">올해 이어받기</h3>' +
            (dup
                ? '<p><span class="chip-status chip-sm success">이어받기 완료</span> 이 문서로 이미 <b>' + y + '년</b> 문서를 만들었습니다.</p>' +
                  '<button type="button" class="btn btn-outline" onclick="CMPDOC.openDoc(\'' + esc(dup.id) + '\')">만든 문서 보기</button>'
                : '<p>이 문서를 바탕으로 <b>' + y + '년</b> 문서를 만듭니다. 업무단계 ' +
                    ((d.stageIds || []).length || 0) + '개' + (d.sr ? '·수발신자' : '') +
                    (( d.files || []).length ? '·첨부 ' + d.files.length + '건' : '') +
                    '가 그대로 채워지고 제목의 연도가 ' + y + '으로 바뀝니다.</p>' +
                  '<p class="cmp-cap"><b>본문·결재문서는 복제하지 않습니다</b> — 온나라 연동 전이라 원본이 없고 결재는 새로 받습니다.' +
                    ((d.stageIds || []).length ? '' : ' 이 문서에는 연결된 할 일이 없어 등록 뒤 직접 골라야 합니다.') + '</p>' +
                  (can
                      ? '<button type="button" class="btn btn-primary" onclick="CMPDOC.carry(\'' + esc(d.id) + '\')">📄 올해 문서로 등록</button>'
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
        /* 같은 원본을 두 번 이어받지 않는다(검수 C-2) — 이미 만든 문서로 안내한다 */
        var dup = null;
        D().allDocs().some(function (d) { if (d.presetOf === id && +d.year === y) { dup = d; return true; } return false; });
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
        S.doc = r.doc.id;
        render();
        V().toast(y + '년 문서로 등록했습니다 — 제목·수발신자만 복사되었습니다.');
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
    function resetF() { S.q = ''; S.sr = ''; S.year = String(D().defaultYear()); S.status = ''; S.stages = []; S.dept = ''; S.page = 1; rerender(); }
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
        askRemove: askRemove, doRemove: doRemove,
        state: S,
    };
}(window));
