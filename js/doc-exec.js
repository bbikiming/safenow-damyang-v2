/* =========================================================================
 * 이행 목록 (docs-exec.html) — 법정 이행항목 카드 (전역 DOCEXEC)
 *   기획: docs/planning/기획-업무문서-이행목록-업무목록-UX설계-v1.md §6·§8
 *
 *   기본 단위 = 법정 이행항목 1개(78). 카드 안 1행 = 하위 업무단계(168).
 *   판정·전이는 전부 DYDOCS 에 있다 — 이 파일은 그리기만 한다.
 *
 *   [폐기] 세트 · PDCA 도트/라벨 · PDCA 검증 배너 · 분류 버전 토글(?ver=)
 *          → menu.js [문서] 탭이 DYSETLIST 로 계속 쓰므로 파일은 지우지 않는다.
 * ========================================================================= */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYDOCS; };
    var F = function () { return global.EDUFILTER; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }

    var S = {
        mount: null,
        year: 0,
        q: '', status: '', cycle: '', collect: '', target: '',
        returned: '',    /* '1' 이면 확인 반려된 단계만 (IMP-01) */
        mine: '',        /* '1' 이면 내 부서 관련(추정)만 (IMP-02) */
        open: {},        /* itemId → 단계 전부 펼침 */
        law: {},         /* itemId → 법령 근거 펼침 */
    };
    var PREVIEW = 5;     /* 카드에 먼저 보여주는 단계 수 */

    /* ── 접속자 부서 ──────────────────────────────────────────────────────
     * '내 부서 관련만' 토글은 **제한이 아니라 편의 필터**다. 이 화면에는 조회
     * 범위(scope)를 걸지 않는다(CLAUDE.md §5 — 원자료가 재난안전과 원장이라
     * 걸면 그 밖 부서에 0건이 된다). 그래서 기본값은 꺼짐이고 전체가 보인다.
     *
     * 노출 조건 — 부서 소속이면서 주관부서(재난안전과)가 아닐 때만.
     *   · 재난안전과: 78항목 전부가 제 일이라 '내 부서'가 필터로 뜻이 없다
     *   · 군수: 부서가 없다(전 부서 총괄)
     *   · 과장·소장·읍면장: 자기 부서 조회를 돕기 위해 노출한다 */
    function me() {
        var R = global.DYROLE;
        return R && R.current ? R.current() : null;
    }
    function myDept() { var p = me(); return (p && p.deptName) || ''; }
    function mineAvail() {
        var p = me(), R = global.DYROLE;
        return !!(p && p.deptId && R && p.deptId !== R.OWNER_DEPT);
    }

    /* ── URL 상태 ─────────────────────────────────────────────────────────
     * ?year= ?item= ?stage= ?status= ?q= ?returned=1 ?mine=1 을 지원한다.
     * 구 쿼리 ?ver=·?menu= 는 새 화면에서 뜻이 없으므로 조용히 무시하되
     * 콘솔 오류를 내지 않는다. */
    function readURL() {
        var p = new URLSearchParams(location.search);
        /* 기본 기준연도는 하드코딩하지 않는다 — 데이터가 있는 최신 연도(§UX설계 C-05).
           2026 고정이면 시연 첫 화면이 78개 카드 전부 0% 라 '고장난 화면'으로 읽힌다. */
        S.year = +p.get('year') || D().defaultYear();
        S.q = p.get('q') || '';
        S.status = p.get('status') || '';
        S.cycle = p.get('cycle') || '';
        S.collect = p.get('collect') || '';
        S.target = p.get('target') || '';
        S.returned = p.get('returned') === '1' ? '1' : '';
        /* 토글이 없는 사람의 ?mine=1 은 조용히 무시한다 — 켤 수단이 없는 조건이
           걸린 채로 목록이 줄면 "왜 이것만 나오지"가 된다 */
        S.mine = (mineAvail() && p.get('mine') === '1') ? '1' : '';
        var it = p.get('item'), st = p.get('stage');
        if (st) { var s = D().stage(st); if (s) { S.open[s.itemId] = true; it = it || s.itemId; } }
        if (it) S.open[it] = true;
        S._focus = st || it || '';
    }
    function syncURL() {
        var p = new URLSearchParams();
        if (S.year !== D().defaultYear()) p.set('year', S.year);
        if (S.q) p.set('q', S.q);
        if (S.status) p.set('status', S.status);
        if (S.cycle) p.set('cycle', S.cycle);
        if (S.collect) p.set('collect', S.collect);
        if (S.target) p.set('target', S.target);
        if (S.returned) p.set('returned', '1');
        if (S.mine) p.set('mine', '1');
        var qs = p.toString();
        try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '')); } catch (e) {}
    }

    /* ── 조회 ─────────────────────────────────────────────────────────────
     * 필터는 **업무단계**에 걸고, 걸린 단계를 가진 이행항목만 카드로 낸다.
     * 그래야 '미이행 단계 찾기'(UF-01)가 카드 단위 필터로 뭉개지지 않는다. */
    function stageMatch(s) {
        if (S.status && D().statusOfStage(s.id, S.year) !== S.status) return false;
        if (S.returned && !D().isReturned(s.id, S.year)) return false;
        /* 부서 매칭은 화면이 하지 않는다 — DYDOCS.stageDeptHit 한 곳(CLAUDE.md §5) */
        if (S.mine && !D().stageDeptHit(s, myDept())) return false;
        if (S.cycle === '__none') { if (s.opCycle) return false; }
        else if (S.cycle && s.opCycle !== S.cycle) return false;
        if (S.collect && s.collect !== S.collect) return false;
        if (S.target && s.target !== S.target) return false;
        if (S.q) {
            var it = D().item(s.itemId) || {};
            if (!F().match(S.q, [s.id, s.name, s.law, it.id, it.name, s.actor, s.target])) return false;
        }
        return true;
    }
    function view() {
        var out = [];
        D().items().forEach(function (it) {
            var all = D().stagesOfItem(it.id);
            var hit = all.filter(stageMatch);
            if (hit.length) out.push({ item: it, stages: hit, total: all.length });
        });
        return out;
    }
    function filtering() { return !!(S.q || S.status || S.cycle || S.collect || S.target || S.returned || S.mine); }
    /* 내 부서 관련(추정) 중 아직 서류가 없는 일 — nextStep 문구가 쓴다 */
    function mineCount(status) {
        var dept = myDept();
        return D().stages().filter(function (s) {
            if (!D().stageDeptHit(s, dept)) return false;
            return !status || D().statusOfStage(s.id, S.year) === status;
        }).length;
    }

    /* ── 옵션 ── */
    function cycleOptions() {
        var seen = {};
        D().stages().forEach(function (s) { if (s.opCycle) seen[s.opCycle] = 1; });
        return [['', '운영주기 전체']].concat(Object.keys(seen).sort().map(function (c) { return [c, c]; }))
            .concat([['__none', '주기 없음']]);
    }
    /* 취합상태는 **2025 원자료의 투영**이다(CLAUDE.md §5). 2026년 화면에서 '취합상태'
       라고만 쓰면 현재 축으로 읽힌다 — 업무 목록이 이미 쓰는 '2025년 취합' 으로
       통일한다. 같은 값을 두 이름으로 부르지 않는다(IMP-08). */
    function collectOptions() {
        var seen = {};
        D().stages().forEach(function (s) { if (s.collect) seen[s.collect] = 1; });
        return [['', '2025년 취합 전체']].concat(Object.keys(seen).sort().map(function (c) { return [c, c]; }));
    }
    function targetOptions() {
        var seen = {};
        D().stages().forEach(function (s) { if (s.target) seen[s.target] = 1; });
        return [['', '적용대상 전체']].concat(Object.keys(seen).sort().map(function (c) { return [c, c]; }));
    }
    function yearOptions() {
        var ys = D().yearsWithData().slice();
        if (ys.indexOf(S.year) < 0) ys.push(S.year);
        return ys.sort().map(function (y) { return [y, y + '년']; });
    }

    /* =========================================================================
     * 렌더
     * ========================================================================= */
    function render() {
        if (!S.mount) return;
        syncURL();
        injectHeadActions();
        var list = view();
        S.mount.innerHTML = notice() + summaryBar() + filterBar(list) + grid(list);
        focusTarget();
    }
    function rerender() { F().rerender(render); }

    /* 안내 — 접혀도 남는 한 줄은 설명이 아니라 **지금 상태**여야 매일 봐도 값이 있다
       (CLAUDE.md §14-12). 세 축이 같은 단어를 쓰므로 관계도 여기서 밝힌다(UX설계 §4). */
    function notice() {
        /* 접혀도 남는 한 줄은 **지금 할 일**이다. 종전에는 여기에 완료·진행중·미이행
           숫자를 넣었는데 바로 아래 요약 칩이 같은 숫자를 또 보여줬다 —
           띠가 하나 늘고 첫 카드가 600px 밖으로 밀렸다(§14-12). */
        var lead = nextStep();
        /* 흐름 설명(올리면 진행중 → 확인해야 완료)은 위 시연 바가 이미 한다.
           같은 말을 두 번 하면 띠만 늘고 목록이 밀린다. 여기는 **다른 화면과의
           구분**만 맡는다 — 시연 바에 없는 정보다. */
        var rest =
            '<p class="dx-note-rel">비슷해 보이는 다른 메뉴 — 부서별 반기 점검은 ' +
            '<a href="menu.html?m=comply">이행점검</a>, 업무 배정은 ' +
            '<a href="work-admin.html">업무 관리</a>에서 봅니다. 여기는 <b>서류</b>를 봅니다.</p>';
        /* 시연 바가 흐름을 설명하므로 안내는 기본 접힘 — 접혀도 '지금 할 일'은 남는다 */
        return V().notice('docs-exec', lead, rest, { foldedByDefault: true });
    }

    /* ── 다음에 할 일 ────────────────────────────────────────────────────
     * 78개 카드를 늘어놓기만 하면 처음 온 사람은 "그래서 뭘 하지"에서 멈춘다.
     * 숫자를 보여주는 것과 **무엇부터 하라고 말하는 것**은 다르다.
     * 지금 상태에서 가장 먼저 할 한 가지를 골라 버튼과 함께 낸다. */
    function nextStep() {
        var s = D().summary(S.year);
        var mine = D().canUpload(), mgr = D().canConfirm();
        var t, act = '';
        /* 반려된 서류는 담당자가 다시 올려야 끝난다 — 무엇보다 먼저 말한다(IMP-01).
           주관부서 담당자에게는 '확인할 것'이 본 루프이고, 반려 건은 요약 줄의
           «반려 N» 칩으로 따로 집을 수 있으므로 여기서 앞세우지 않는다. */
        if (mine && !mgr && s.returned > 0) {
            t = '반려된 서류가 <b>' + s.returned + '건</b> 있습니다. 사유를 확인하고 다시 올리면 됩니다.';
            act = '<button type="button" class="btn btn-primary btn-sm" onclick="DOCEXEC.setF(\'returned\',\'1\')">반려된 것 보기</button>';
        } else if (mgr && s.counts.in_progress > 0) {
            t = '<b>' + s.counts.in_progress + '건</b>의 서류가 올라와 확인을 기다립니다.';
            act = '<button type="button" class="btn btn-primary btn-sm" onclick="DOCEXEC.setF(\'status\',\'' + D().ST.WIP + '\')">확인할 것 보기</button>';
        } else if (mine && s.counts.not_started > 0) {
            /* 부서 담당자에게 전체 26건을 "여기부터 채우면 됩니다"라고 말하면
               대부분 남의 부서 일을 내 일이라고 하는 것이 된다(IMP-02). */
            if (mineAvail()) {
                var n = mineCount(D().ST.NONE);
                if (n > 0) {
                    t = '내 부서 관련(추정) 아직 서류 없는 일이 <b>' + n + '건</b> 있습니다. ' +
                        '<span class="dx-next-dim">전체는 ' + s.counts.not_started + '건입니다.</span>';
                    act = '<button type="button" class="btn btn-primary btn-sm" onclick="DOCEXEC.mineTodo()">내 부서 미이행 먼저 보기</button>';
                } else {
                    t = '아직 서류가 없는 일이 <b>' + s.counts.not_started + '건</b> 있습니다. ' +
                        '<span class="dx-next-dim">' + esc(myDept()) + ' 관련으로 추린 결과는 0건입니다.</span>';
                    act = '<button type="button" class="btn btn-primary btn-sm" onclick="DOCEXEC.setF(\'status\',\'' + D().ST.NONE + '\')">' +
                          D().statusLabel(D().ST.NONE) + ' 먼저 보기</button>';
                }
            } else {
                t = '아직 서류가 없는 일이 <b>' + s.counts.not_started + '건</b> 있습니다. 여기부터 채우면 됩니다.';
                act = '<button type="button" class="btn btn-primary btn-sm" onclick="DOCEXEC.setF(\'status\',\'' + D().ST.NONE + '\')">' +
                      D().statusLabel(D().ST.NONE) + ' 먼저 보기</button>';
            }
        } else if (mine) {
            t = '이 해에 해야 할 일은 모두 서류가 올라와 있습니다.';
        } else {
            t = '<b>' + s.year + '년</b> 이행 현황입니다. 조회 전용 화면입니다.';
        }
        return '<span class="dx-next-t">' + t + '</span>' + act;
    }

    /* 요약 — 카드 4장이 아니라 한 줄 칩. 첫 데이터까지의 거리를 지킨다(§14-12) */
    function summaryBar() {
        var s = D().summary(S.year);
        function chip(key, n, tone) {
            var label = D().statusLabel(key);
            var on = S.status === key;
            return '<button type="button" data-tour="doc-open" class="dx-sum' + (on ? ' is-on' : '') + '"' +
                ' aria-pressed="' + (on ? 'true' : 'false') + '"' +
                ' onclick="DOCEXEC.setF(\'status\',\'' + (on ? '' : key) + '\')">' +
                '<span class="chip-status chip-sm ' + tone + '">' + esc(label) + '</span>' +
                '<b>' + n + '</b></button>';
        }
        /* 반려는 status 축이 아니라 **보조 축**이다(진행중 안에 들어 있다).
           4종 칩과 나란히 두면 합이 168 을 넘어 읽는 사람이 헷갈리므로, 건수가
           있을 때만 구분선을 두고 뒤에 붙인다(IMP-01). */
        function retChip() {
            if (!s.returned) return '';
            var on = S.returned === '1';
            return '<button type="button" class="dx-sum dx-sum-ret' + (on ? ' is-on' : '') + '"' +
                ' aria-pressed="' + (on ? 'true' : 'false') + '"' +
                ' onclick="DOCEXEC.setF(\'returned\',\'' + (on ? '' : '1') + '\')">' +
                '<span class="chip-status chip-sm warning">반려됨</span><b>' + s.returned + '</b></button>';
        }
        return '<div class="dx-summary" role="group" aria-label="' + S.year + '년 이행 현황 요약">' +
            '<span class="dx-sum-static">법정 의무 <b>' + s.items + '</b>가지 · 할 일 <b>' + s.stages + '</b>개</span>' +
            chip(D().ST.DONE, s.counts.complete, 'success') +
            chip(D().ST.WIP, s.counts.in_progress, 'info') +
            chip(D().ST.NONE, s.counts.not_started, 'danger') +
            chip(D().ST.NA, s.counts.na, 'neutral') +
            retChip() +
            /* 교정 대상 안내는 고칠 수 있는 사람에게만 — 못 고치는 사람에겐 잡음이다 */
            (D().isManager()
                ? '<a class="dx-sum-link" href="docs-preset.html?mapping=unmapped">정리할 문서 ' + s.unmapped + '건 →</a>'
                : '') +
        '</div>';
    }

    /* 조회 조건 — 상시 2개 + 접이식 3개.
     * 6개를 한 줄에 늘어놓으면 1280px 에서 두 줄이 되고 첫 카드가 밀린다(§14-12).
     * 기준연도는 **조회 조건이 아니라 화면 전체의 맥락**이라 제목 줄로 올렸다 —
     * 필터 바에 두면 항상 값이 있어 '필터 초기화 (1)' 이 영원히 켜져 있게 된다. */
    /* 진행상태 <select> 는 두지 않는다 — 요약 칩 4종이 이미 클릭 필터이고, 같은
       축을 두 컨트롤로 물으면 어느 쪽이 적용된 건지 알 수 없다(CLAUDE.md §14-12,
       내 할일 선례). ?status= URL 계약은 그대로이고 칩이 눌린 상태로 반영한다(IMP-06). */
    function filterBar(list) {
        var stages = list.reduce(function (a, g) { return a + g.stages.length; }, 0);
        var adv = !!(S.cycle || S.collect || S.target);
        var fields = [
            { type: 'search', id: 'dx-q', value: S.q, placeholder: '의무·할 일·법 이름으로 찾기', on: "DOCEXEC.setF('q', this.value)" },
        ];
        if (mineAvail()) {
            fields.push({ type: 'check', id: 'dx-mine', value: S.mine, label: '내 부서 관련만',
                on: "DOCEXEC.setF('mine', this.checked ? '1' : '')" });
        }
        fields.push(
            { type: 'select', id: 'dx-cy', value: S.cycle, label: '운영주기', options: cycleOptions(), on: "DOCEXEC.setF('cycle', this.value)", hidden: !S.adv && !adv },
            { type: 'select', id: 'dx-co', value: S.collect, label: '2025년 취합', options: collectOptions(), on: "DOCEXEC.setF('collect', this.value)", hidden: !S.adv && !adv },
            { type: 'select', id: 'dx-tg', value: S.target, label: '적용대상', options: targetOptions(), on: "DOCEXEC.setF('target', this.value)", hidden: !S.adv && !adv }
        );
        var bar = F().bar(fields.filter(function (f) { return !f.hidden; }), {
            count: list.length + '가지 의무 · ' + stages, unit: '개 할 일',
            reset: 'DOCEXEC.resetF()',
            /* 상태·반려는 칩으로 걸리므로 필드 배열에 없다 — 그대로 두면 칩만 켠
               상태에서 [필터 초기화] 가 비활성이 된다(끌 수단이 사라진다). */
            extraActive: [S.status, S.returned].filter(Boolean).length,
            actions: '<button type="button" class="btn btn-outline btn-sm" aria-expanded="' + (S.adv || adv ? 'true' : 'false') +
                '" onclick="DOCEXEC.toggleAdv()">상세 조건 ' + (S.adv || adv ? '▴' : '▾') +
                (adv ? ' <b>' + [S.cycle, S.collect, S.target].filter(Boolean).length + '</b>' : '') + '</button>',
        });
        return bar + mineNote();
    }

    /* 파생 필터임을 감추지 않는다 — 지어낸 확정 매핑처럼 보이면 담당자가 이 목록을
       담당부서 대장으로 읽는다(CLAUDE.md §14-12 갭 노출). 확정 연계는 DYPOLICY
       'doc-dept-src'(새올·온나라 담당부서) 수신 대상이다. */
    function mineNote() {
        if (!S.mine) return '';
        return '<p class="dx-mine-note"><b>' + esc(myDept()) + ' 관련(추정)</b> — 적용대상 문구에서 부서 이름을 찾아 고른 목록이라 ' +
            '빠지거나 더 잡히는 건이 있습니다. 담당부서 연계(새올·온나라) 수신 전까지의 대체 동작입니다.' +
            '<button type="button" class="du-link" onclick="DOCEXEC.setF(\'mine\',\'\')">전체 보기</button></p>';
    }

    /* ── 카드 ─────────────────────────────────────────────────────────────
     * 데스크톱 2열. 3열은 긴 업무단계명과 우측 상태 태그를 함께 담지 못한다
     * (현행 3열에서 실제로 잘렸다 — UX설계 §2-1). */
    function grid(list) {
        if (!list.length) {
            return '<div class="v2-empty"><b>조건에 맞는 이행항목이 없습니다.</b><br>' +
                '조회 조건을 지우면 ' + D().items().length + '개 이행항목이 모두 나옵니다.' +
                (filtering() ? '<div style="margin-top:10px;"><button class="btn btn-outline btn-sm" onclick="DOCEXEC.resetF()">조건 초기화</button></div>' : '') +
                '</div>';
        }
        return '<div class="dx-grid">' + list.map(card).join('') + '</div>';
    }

    function card(g) {
        var it = g.item, pr = D().progressOfItem(it.id, S.year);
        var showAll = !!S.open[it.id] || filtering();
        var rows = showAll ? g.stages : g.stages.slice(0, PREVIEW);
        var more = g.stages.length - rows.length;
        return '<section class="card dx-card" id="dx-item-' + esc(it.id) + '">' +
            '<header class="card-header dx-head">' +
                /* 이름이 먼저다 — IND-01 같은 코드는 담당자에게 뜻이 없는데
                   매번 첫 시선을 가져갔다. 뒤로 보내고 흐리게 둔다. */
                '<div class="dx-head-top">' +
                    '<h2 class="dx-title">' + esc(it.name) + '</h2>' +
                    '<span class="dx-code" title="법정 이행항목 번호">' + esc(it.id) + '</span>' +
                '</div>' +
                '<div class="dx-head-meta">' +
                    '<span class="dx-meta">할 일 ' + g.total + '개' +
                        (g.stages.length !== g.total ? ' <em>· 조건 맞음 ' + g.stages.length + '</em>' : '') + '</span>' +
                    lawToggle(it) +
                '</div>' +
                lawPanel(it) +
            '</header>' +
            '<div class="card-body dx-body">' +
                progressBlock(it, pr) +
                (pr.error
                    ? '<div class="v2-empty dx-err"><b>자료 오류 — ' + esc(pr.error) + '</b></div>'
                    : '<table class="table-figma table-compact dx-table"><tbody>' + rows.map(stageRow).join('') + '</tbody></table>') +
                (more > 0
                    ? '<button type="button" class="dx-more" onclick="DOCEXEC.toggleItem(\'' + esc(it.id) + '\')">' +
                        '할 일 ' + g.stages.length + '개 모두 보기 <span aria-hidden="true">▾</span></button>'
                    : (showAll && g.stages.length > PREVIEW && !filtering()
                        ? '<button type="button" class="dx-more" onclick="DOCEXEC.toggleItem(\'' + esc(it.id) + '\')">접기 <span aria-hidden="true">▴</span></button>'
                        : '')) +
            '</div>' +
        '</section>';
    }

    function lawToggle(it) {
        var n = (it.lawBases || []).length;
        if (!n) return '<span class="dx-meta">근거 법 미등록</span>';
        var L = global.DYLAW;
        var linked = L && L.resolveBasis
            ? (it.lawBases || []).filter(function (l) { return !!L.resolveBasis(l); }).length : 0;
        return '<button type="button" class="dx-law-btn" aria-expanded="' + (S.law[it.id] ? 'true' : 'false') +
            '" onclick="DOCEXEC.toggleLaw(\'' + esc(it.id) + '\')">근거 법 ' + n + '건' + (linked && linked < n ? ' <em class="dx-law-part">' + linked + '건 원문</em>' : '') + ' <span aria-hidden="true">' +
            (S.law[it.id] ? '▴' : '▾') + '</span></button>';
    }
    /* 조문 펼침은 인라인 — 모달을 띄우지 않는다(CLAUDE.md §1·§10).
     * 원자료의 근거 문자열을 그대로 뿌리지 않고 **DYLAW 조문으로 해석**해 원문을
     * 펼칠 수 있게 한다(§10 단일 출처). 해석되지 않는 표기는 지어내지 않고
     * 원문 그대로 두되 '조문 미연결'로 밝힌다 — 스냅샷에 없는 조문이 있다. */
    function lawPanel(it) {
        if (!S.law[it.id]) return '';
        var L = global.DYLAW;
        return '<ul class="lawinfo-inline dx-law">' +
            (it.lawBases || []).map(function (l) {
                if (L && L.resolveBasis && L.basisChip) {
                    var key = L.resolveBasis(l);
                    if (key) return '<li>' + L.basisChip(key, { withTitle: true }) + '</li>';
                }
                return '<li>' + esc(l) + ' <span class="dx-law-un">조문 미연결</span></li>';
            }).join('') +
        '</ul>';
    }

    /* 진행률 — 주기가 있는 이행항목에만 바를 그린다(D-02).
     * 없는 31개 항목은 **바를 그리지 않되 침묵하지도 않는다** — 아무 설명이 없으면
     * 담당자가 "왜 이 카드만"을 묻는다(UX설계 §6-1). */
    function progressBlock(it, pr) {
        if (!pr.visible) {
            return '<div class="dx-prog dx-prog-none">' +
                '<span class="dx-nocycle">' + esc(D().noCycleNote()) + '</span>' +
                '<span class="dx-prog-cnt">완료 ' + pr.completed + ' / 전체 ' + pr.total + '개</span>' +
            '</div>';
        }
        return '<div class="dx-prog">' +
            '<div class="progress" role="progressbar" aria-valuenow="' + pr.percentage + '" aria-valuemin="0" aria-valuemax="100"' +
                ' aria-label="' + esc(it.name) + ' 이행률">' +
                '<div class="progress-bar" style="width:' + pr.percentage + '%;"></div>' +
            '</div>' +
            '<span class="dx-prog-pct">' + pr.percentage + '%</span>' +
            (pr.completed === 0 && D().itemCounts(it.id, S.year).in_progress > 0
                ? '<span class="dx-prog-why">서류는 올라왔지만 재난안전과 확인 전이라 0%입니다</span>' : '') +
            '<span class="dx-prog-cnt">완료 ' + pr.completed + ' / 전체 ' + pr.total + '개' +
                /* 노출 조건(주기 보유)과 분모(전체 단계)의 축이 다르다는 걸 밝힌다 */
                (pr.cycleStages < pr.total ? ' <em>· 이 중 정기 ' + pr.cycleStages + '개</em>' : '') +
            '</span>' +
        '</div>';
    }

    /* 2열 카드 안에서 코드·이름·주기·문서수·상태·버튼 6가지를 6열로 늘어놓으면
     * 업무단계명이 세 줄로 접힌다(실측). 이름에 폭을 몰아주고 나머지는 아래 줄로 내린다. */
    function stageRow(s) {
        var code = D().statusOfStage(s.id, S.year);
        var rec = D().stageRecord(s.id, S.year);
        var docs = D().documentIdsOfStage(s.id, S.year);
        var when = s.opCycle || s.timing || '수시';
        var href = 'docs-preset.html?stage=' + encodeURIComponent(s.id) + '&year=' + S.year;
        return '<tr class="dx-row' + (rec.needsRecheck ? ' is-recheck' : '') + (rec.returned ? ' is-returned' : '') +
                '" id="dx-stage-' + esc(s.id) + '">' +
            '<td class="dx-c-main">' +
                '<a class="dx-stage-link" href="' + href + '">' +
                    '<span class="dx-sname">' + esc(s.name) + '</span>' +
                '</a>' +
                '<span class="dx-swhen"><span class="dx-scode">' + esc(s.id) + '</span>' + esc(when) + '<span class="dx-sep">·</span>' +
                    (docs.length
                        ? '<a class="dx-doclink" href="' + href + '">서류 ' + docs.length + '건</a>'
                        : '<span class="dx-nodoc">서류 없음</span>') +
                '</span>' +
                /* 반려 사유는 접지 않는다 — 반려의 존재 이유가 이 한 줄이다(IMP-01).
                   숨겨 두면 담당자가 무엇을 다시 해야 하는지 모른 채 또 올린다. */
                (rec.returned
                    ? '<span class="dx-ret">반려 사유 — ' + esc(rec.returned.reason) +
                        '<span class="dx-ret-by">' + esc(rec.returned.by) + ' · ' + esc(rec.returned.at) +
                        (rec.returnRound > 1 ? ' · ' + rec.returnRound + '회째' : '') + '</span></span>'
                    : '') +
            '</td>' +
            '<td class="dx-c-side">' +
                '<span class="chip-status chip-sm ' + V().toneOf(D().statusLabel(code)) + '">' +
                    esc(D().statusLabel(code)) + '</span>' +
                (rec.returned ? '<span class="chip-status chip-sm warning">반려됨</span>' : '') +
                (rec.needsRecheck ? '<span class="chip-status chip-sm warning">재확인 필요</span>' : '') +
                (code === D().ST.NA && !rec.naReason ? '<span class="chip-status chip-sm warning">사유 미기재</span>' : '') +
                (D().canConfirm()
                    ? '<button type="button" class="btn btn-sm btn-outline dx-conf" data-tour="doc-confirm" onclick="DOCEXEC.openStage(\'' + esc(s.id) + '\')">확인하기</button>'
                    : '') +
            '</td>' +
        '</tr>';
    }

    /* =========================================================================
     * 증빙 확인 모달 (관리자 전용) — 단일 모달 규칙(CLAUDE.md §1)
     * ========================================================================= */
    function openStage(stageId) {
        if (!D().canConfirm()) { V().toast(readOnlyWhy()); return; }
        var s = D().stage(stageId);
        if (!s) return;
        var rec = D().stageRecord(stageId, S.year);
        var docs = D().documentIdsOfStage(stageId, S.year).map(D().docById).filter(Boolean);
        var it = D().item(s.itemId) || {};

        var body =
            '<div class="dx-mod">' +
                '<p class="dx-mod-path">' + esc(it.id) + ' · ' + esc(it.name) + '</p>' +
                '<h3 class="dx-mod-title">' + esc(s.name) + '</h3>' +
                '<dl class="dx-mod-meta">' +
                    '<div><dt>번호</dt><dd>' + esc(s.id) + '</dd></div>' +
                    '<div><dt>주기</dt><dd>' + esc(s.opCycle || s.timing || '수시') + '</dd></div>' +
                    '<div><dt>근거 법</dt><dd>' + lawCell(s.law) + '</dd></div>' +
                    '<div><dt>현재 상태</dt><dd><span class="chip-status chip-sm ' +
                        V().toneOf(D().statusLabel(rec.status)) + '">' + esc(D().statusLabel(rec.status)) + '</span>' +
                        (rec.returned ? ' <span class="chip-status chip-sm warning">반려됨</span>' : '') +
                        (rec.confirmedBy ? ' <span class="dx-mod-dim">' + esc(rec.confirmedBy) + ' · ' + esc(rec.confirmedAt) + '</span>' : '') +
                        /* 자기가 반려해 둔 건인지 알아야 같은 서류를 두 번 반려하지 않는다(IMP-01) */
                        (rec.returnRound
                            ? '<span class="dx-mod-ret">반려 ' + rec.returnRound + '회' +
                                (rec.returned
                                    ? ' · 마지막 사유 «' + esc(rec.returned.reason) + '» ' +
                                      '<span class="dx-mod-dim">' + esc(rec.returned.by) + ' · ' + esc(rec.returned.at) + '</span>'
                                    : ' · 반려 뒤 서류가 다시 올라왔습니다') + '</span>'
                            : '') +
                    '</dd></div>' +
                '</dl>' +
                '<h4 class="dx-mod-sub">올라온 서류 ' + docs.length + '건</h4>' +
                /* 서류를 열면 확인 맥락(모달)이 사라지던 자리 — 새 탭으로 연다(IMP-05).
                   본문 목록의 «서류 N건» 링크는 화면 전환이 맞는 동선이라 그대로 둔다. */
                (docs.length
                    ? '<ul class="dx-mod-docs">' + docs.map(function (d) {
                        return '<li><a href="doc-detail.html?id=' + esc(d.id) + '" target="_blank" rel="noopener"' +
                            ' aria-label="' + esc(d.title) + ' — 새 탭에서 열기">' + esc(d.title) +
                            '<span class="dx-mod-new" aria-hidden="true">↗</span></a>' +
                            '<span class="dx-mod-dim">' + esc(d.date || '') + (d.sr ? ' · ' + esc(d.sr) : '') + '</span></li>';
                      }).join('') + '<li class="dx-mod-hint">서류는 <b>새 탭</b>에서 열립니다 — 이 확인 창은 그대로 남습니다.</li></ul>'
                    : '<div class="v2-empty">아직 올라온 서류가 없습니다.</div>') +
                '<div class="form-field dx-mod-reason">' +
                    '<label class="form-label" for="dx-reason">사유 <span class="dx-mod-dim">— 반려·해당없음은 사유가 있어야 저장됩니다</span></label>' +
                    '<input type="text" class="form-input" id="dx-reason" placeholder="예: 2분기 실시 결과가 빠져 있습니다">' +
                '</div>' +
            '</div>';

        var can = rec.status !== D().ST.DONE;
        var foot =
            (can && docs.length
                ? '<button class="btn btn-primary" onclick="DOCEXEC.confirmStage(\'' + esc(stageId) + '\')">완료 처리</button>'
                : '') +
            (rec.status === D().ST.WIP
                ? '<button class="btn btn-secondary" onclick="DOCEXEC.rejectStage(\'' + esc(stageId) + '\')">확인 반려</button>'
                : '') +
            (rec.status !== D().ST.NA
                ? '<button class="btn btn-secondary" onclick="DOCEXEC.naStage(\'' + esc(stageId) + '\')">해당없음</button>'
                : '<button class="btn btn-secondary" onclick="DOCEXEC.clearNA(\'' + esc(stageId) + '\')">해당없음 해제</button>') +
            '<button class="btn btn-outline" onclick="DYV2.closeModal()">닫기</button>';

        V().openModal('서류 확인 · ' + S.year + '년', body, foot);
    }

    /* 모달 안 근거도 조문으로 — 화면마다 다른 표기를 만들지 않는다 */
    function lawCell(raw) {
        if (!raw) return '<span class="dx-nodoc">미등록</span>';
        var L = global.DYLAW;
        return String(raw).split(',').map(function (t) {
            var one = t.trim(); if (!one) return '';
            var key = L && L.resolveBasis ? L.resolveBasis(one) : '';
            return key && L.basisChip ? L.basisChip(key, { withTitle: true })
                                      : esc(one) + ' <span class="dx-law-un">조문 미연결</span>';
        }).filter(Boolean).join(' ');
    }

    function reasonVal() {
        var el = document.getElementById('dx-reason');
        return el ? el.value.trim() : '';
    }
    function apply(stageId, to, reason, kind) {
        var r = D().transition(stageId, S.year, to, { reason: reason, kind: kind });
        if (!r.ok) { V().toast(r.reason); return; }
        V().closeModal();
        render();
        /* 반려는 '진행중 처리'가 아니다 — 같은 문구를 쓰면 관리자가 무엇을 했는지
           오해한다. 사유가 담당자에게 보인다는 사실까지 알린다(IMP-01). */
        V().toast(kind === 'reject'
            ? D().stage(stageId).name + ' — 확인 반려했습니다. 사유가 담당자 화면에 표시됩니다.'
            : D().stage(stageId).name + ' — ' + D().statusLabel(to) + ' 처리했습니다.');
    }
    function confirmStage(id) { apply(id, D().ST.DONE, reasonVal()); }
    /* 사유 검사는 데이터 계층(DYDOCS.transition)이 한다 — 여기서 또 하면 판정이
       두 곳이 되고, 전역 호출은 화면 검사를 지나쳐 버린다. */
    function rejectStage(id) { apply(id, D().ST.WIP, reasonVal(), 'reject'); }
    function naStage(id) {
        var why = reasonVal();
        if (!why) { V().toast('해당없음 사유를 입력해야 저장됩니다.'); return; }
        apply(id, D().ST.NA, why);
    }
    function clearNA(id) { apply(id, D().ST.NONE, ''); }

    /* 차단 문구는 한 곳에서만 — 14곳에 흩어 놓으면 재난안전과장 본인에게 거짓말이
       된다(CLAUDE.md §4-3 denyToast 선례). */
    function readOnlyWhy() {
        var R = global.DYROLE, p = R && R.current ? R.current() : null;
        if (p && p.tier !== 'staff') return '관리·감독 계층은 조회만 합니다 — 서류 확인은 담당자 본인이 합니다.';
        return '서류 확인·완료 처리는 재난안전과 담당자만 할 수 있습니다.';
    }

    /* ── 페이지 제목 줄 액션 ── */
    function injectHeadActions() {
        var host = document.querySelector('.dy-page-title');
        if (!host) return;
        var old = host.querySelector('.page-head-action');
        if (old) old.remove();
        if (!D().canUpload()) {
            var note = document.createElement('div');
            note.className = 'page-head-action dx-ro';
            note.textContent = '조회 전용';
            host.appendChild(note);
            return;
        }
        var wrap = document.createElement('div');
        wrap.className = 'page-head-action dx-headact';
        wrap.innerHTML =
            '<label class="dx-yr"><span>기준연도</span>' +
                '<select class="form-select" aria-label="기준연도" onchange="DOCEXEC.setF(\'year\', this.value)">' +
                    F().optionsHtml(yearOptions(), S.year) + '</select></label>' +
            /* 가져올 전년도가 실제로 있을 때만 낸다 — 없는데 버튼을 두면 0건 목록이 열린다 */
            (D().presetSourceYear(S.year)
                ? '<button class="btn btn-outline btn-sm" onclick="DOCUP.openPreset(' + S.year + ')">' +
                  D().presetSourceYear(S.year) + '년 프리셋 불러오기</button>'
                : '') +
            '<button class="btn btn-primary btn-sm" data-tour="doc-upload" onclick="DOCUP.open(' + S.year + ')">＋ 서류 올리기</button>';
        host.appendChild(wrap);
    }

    /* 딥링크로 들어온 항목·단계로 스크롤 */
    function focusTarget() {
        if (!S._focus) return;
        var el = document.getElementById('dx-stage-' + S._focus) || document.getElementById('dx-item-' + S._focus);
        S._focus = '';
        if (!el) return;
        try { el.scrollIntoView({ block: 'center' }); } catch (e) {}
        el.classList.add('is-focus');
        setTimeout(function () { el.classList.remove('is-focus'); }, 2000);
    }

    /* ── 전역 진입점 ── */
    function setF(k, v) {
        if (k === 'year') S.year = +v || D().defaultYear();
        else if (k === 'mine') S.mine = (v && mineAvail()) ? '1' : '';
        else S[k] = v;
        rerender();
    }
    /* 미이행 + 내 부서를 한 번에 건다 — 두 컨트롤을 차례로 누르게 하지 않는다(IMP-02) */
    function mineTodo() {
        S.status = D().ST.NONE;
        S.mine = mineAvail() ? '1' : '';
        S.returned = '';
        rerender();
    }
    function resetF() {
        S.q = ''; S.status = ''; S.cycle = ''; S.collect = ''; S.target = '';
        S.returned = ''; S.mine = '';
        rerender();
    }
    function toggleItem(id) { S.open[id] = !S.open[id]; render(); }
    function toggleLaw(id) { S.law[id] = !S.law[id]; render(); }
    function toggleAdv() { S.adv = !(S.adv || S.cycle || S.collect || S.target); if (!S.adv) { S.cycle = ''; S.collect = ''; S.target = ''; } render(); }

    function init(mount) {
        S.mount = mount;
        readURL();
        render();
    }

    global.DOCEXEC = {
        init: init, render: render,
        setF: setF, resetF: resetF, mineTodo: mineTodo,
        toggleItem: toggleItem, toggleLaw: toggleLaw, toggleAdv: toggleAdv,
        openStage: openStage, confirmStage: confirmStage, rejectStage: rejectStage,
        naStage: naStage, clearNA: clearNA,
        state: S,
    };
}(window));
