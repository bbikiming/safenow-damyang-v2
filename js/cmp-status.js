/* =========================================================================
 * 업무 관리(신) — 이행 관리 (cmp-status.html, 전역 CMPST)
 *   기획: docs/planning/기획-업무관리-신버전-이행관리-문서목록-v1.md §4
 *   구조: docs/planning/자료-업무관리-이행관리-와이어프레임-v1.html ①②③⑥
 *
 *   한 화면 안에 서브탭 2개 — 단계별 이행현황(①) · 누락 점검(⑥).
 *   단계 행을 누르면 같은 화면 본문이 이행 상세(②)로 바뀌고, 작년 문서
 *   불러오기(③)는 단일 모달로 뜬다.
 *
 *   [판정을 여기서 하지 않는다]
 *   계층·주기·이행상태는 전부 DYCMP 파생이고, 상태 전이·문서 등록은 DYDOCS 다.
 *   이 파일은 **그리기와 조회 조건**만 맡는다.
 *
 *   [권한 — 조회는 열고 조작만 막는다 (§6)]
 *   원자료가 재난안전과 문서 원장이라 조회 범위(scope)를 걸면 그 밖 부서 담당자
 *   에게 0건이 된다(기존 이행 목록과 같은 근거, CLAUDE.md §5). 대신 등록·비해당·
 *   불러오기는 DYDOCS 의 권한 판정(canUpload·canSetNA)을 그대로 쓴다.
 * ========================================================================= */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYDOCS; };
    var C = function () { return global.DYCMP; };
    var F = function () { return global.EDUFILTER; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }

    var S = {
        mount: null,
        tab: 'status',          /* status | gap */
        level: 'L1',
        seg2: 'dept',           /* L2 — dept | stage */
        seg3: 'fac',            /* L3 — fac | stage */
        year: 0,
        q: '', cycle: '', st: '', axis: '', dept: '', facCls: '', way: '',
        open: {},               /* itemId → 펼침 */
        law: {},                /* stageId → 법령 인라인 펼침 */
        detail: '',             /* 이행 상세 대상 stageId */
        dyear: 0,               /* 이행 상세의 연도 셀렉터 */
        gapSel: {},             /* 누락 점검 일괄 선택 */
    };

    /* ── 접속자 ──────────────────────────────────────────────────────────── */
    function me() { var R = global.DYROLE; return R && R.current ? R.current() : null; }
    function myDept() { var p = me(); return (p && p.deptName) || ''; }
    /* '과거 연도' 의 기준은 **화면의 기준연도**다(§4-2 — 이행 상세의 연도 셀렉터를
     * 과거로 바꾸면 등록 버튼이 사라진다).
     * 달력 연도(DYV2.today())로 잡지 않는 이유 — 기준연도 기본값은 데이터가 있는
     * 최신 연도(현재 2025)라, 달력 연도로 재면 **첫 화면이 통째로 조회 전용**이 된다.
     * 기존 이행 목록(docs-exec)도 기준연도에 서류를 올릴 수 있고 DOCUP 이 그 연도
     * 안의 날짜만 받는다 — 같은 제품에 규칙을 두 벌 두지 않는다. */
    function baseYear() { return S.year || D().defaultYear(); }

    /* =========================================================================
     * URL
     * ========================================================================= */
    function readURL() {
        var p = new URLSearchParams(location.search);
        S.year = +p.get('year') || D().defaultYear();
        S.tab = p.get('tab') === 'gap' ? 'gap' : 'status';
        var lv = p.get('level');
        if (lv === 'L1' || lv === 'L2' || lv === 'L3') S.level = lv;
        S.q = p.get('q') || '';
        S.axis = p.get('axis') || '';
        /* 부서 담당자는 자기 부서가 **기본 조회 조건**으로 걸린다 — 제한이 아니라
           프리셋이다(§6). 재난안전과·군수는 비워 둔다(전 부서가 제 일이다). */
        var R = global.DYROLE;
        var mine = (me() && me().deptId && R && me().deptId !== R.OWNER_DEPT) ? myDept() : '';
        S.dept = p.get('dept') != null ? p.get('dept') : mine;
        if (!p.get('level')) S.level = 'L1';   /* popstate 재진입 — URL 이 곧 상태다 */
        var st = p.get('stage');
        if (st && D().stage(st)) { S.detail = st; S.dyear = +p.get('dyear') || S.year; }
        else S.detail = '';                    /* 파라미터가 없으면 상세도 없다 — 남겨두면 뒤로가기가 닫히지 않는다 */
    }
    function urlOf() {
        var p = new URLSearchParams();
        if (S.year !== D().defaultYear()) p.set('year', S.year);
        if (S.tab !== 'status') p.set('tab', S.tab);
        if (S.level !== 'L1') p.set('level', S.level);
        if (S.detail) { p.set('stage', S.detail); if (S.dyear !== S.year) p.set('dyear', S.dyear); }
        if (S.q) p.set('q', S.q);
        if (S.axis) p.set('axis', S.axis);
        if (S.dept) p.set('dept', S.dept);
        var qs = p.toString();
        return location.pathname + (qs ? '?' + qs : '');
    }
    /* replace 는 history.state 를 보존한다 — null 로 덮으면 상세 진입 때 심어 둔
       {cmp:'detail'} 표식이 필터 한 번에 지워져 닫기가 뒤로가기를 못 쓰게 된다 */
    function syncURL() {
        try { history.replaceState(history.state, '', urlOf()); } catch (e) {}
    }

    /* =========================================================================
     * 조회
     * ========================================================================= */
    function levelStages() { return C().stagesOfLevel(S.level); }
    function stageMatch(s) {
        if (S.q && !F().match(S.q, [s.id, s.name, s.law, s.target, s.actor])) return false;
        if (S.cycle) {
            var cy = C().cycleOf(s);
            if (S.cycle === '__ev') { if (cy.need > 0) return false; }
            else if (cy.cc !== S.cycle) return false;
        }
        if (S.st) { var j = C().judge(s, S.year); if (!j || j.key !== S.st) return false; }
        if (S.way && (s.taskType || 'UNKNOWN') !== S.way) return false;
        if (S.axis) { if (C().axesOf(s.itemId).indexOf(S.axis) < 0) return false; }
        if (S.dept && !D().stageDeptHit(s, S.dept)) return false;
        return true;
    }
    function viewStages() { return levelStages().filter(stageMatch); }
    function filtering() { return !!(S.q || S.cycle || S.st || S.axis || S.dept || S.way); }

    /* =========================================================================
     * 렌더
     * ========================================================================= */
    function render() {
        if (!S.mount) return;
        syncURL();
        injectHead();
        if (S.detail) { S.mount.innerHTML = detailPane(); return; }
        S.mount.innerHTML =
            notice() +
            '<div class="cmp-tabbar">' + subTabs() + (S.tab === 'status' ? levelTabs() : '') + '</div>' +
            (S.tab === 'status' ? statusPane() : gapPane());
    }
    function rerender() { F().rerender(render); }

    /* 안내 — 접혀도 남는 한 줄은 설명이 아니라 **지금 상태**여야 한다(§14-12).
     * 와이어프레임의 스코프 바를 별도 띠로 두지 않고 이 lead 로 합쳤다 — 두 띠가
     * 각자 한 줄을 쓰면 첫 데이터 행이 656px 로 밀린다(실측). 합치면 계층을 바꿀
     * 때마다 이 줄이 따라 바뀌므로 정보는 그대로 남는다. */
    function notice() {
        var c = C().levelCounts();
        var un = C().unparsedStages().length;
        var lv = C().LEVELS.filter(function (l) { return l.id === S.level; })[0];
        var lead = (S.tab === 'status'
            ? '<b>' + esc(lv.label) + ' ' + c[S.level] + '개</b> — ' + esc(lv.note)
            : '<b>' + S.year + '년 미이행 ' + gapStages().length + '개</b> — 해당 연도에 서류가 한 건도 없는 할 일입니다.') +
            ' <span class="cmp-dim">전체 ' + D().summary(S.year).stages + '개 = 군 ' + c.L1 + ' · 부서 ' + c.L2 + ' · 관리대상 ' + c.L3 + '</span>';
        var rest =
            '<p>' + esc(lv.label) + ' — ' + esc(lv.note2) + '</p>' +
            '<p>계층(군/부서/관리대상)은 원자료의 <b>적용대상 문구에서 파생한 추정</b>입니다 — ' +
            c.byItemId + '개 단계는 문구에 시설 표현이 없어 이행항목 번호(FAC-*)로, ' +
            c.fallback + '개 단계는 어느 쪽으로도 가릴 수 없어 부서 단위로 수렴시켰습니다. 발주처 확정 대상입니다.</p>' +
            (un ? '<p>주기 문구를 회차로 옮기지 못한 단계 <b>' + un + '개</b>는 <b>상시</b>로 분류했습니다 — 없는 회차를 지어내지 않습니다.</p>' : '') +
            '<p>비슷해 보이는 다른 메뉴 — 같은 데이터를 종전 방식으로 보는 화면은 ' +
            '<a href="docs-exec.html">업무문서 &gt; 이행 목록</a>, 부서 반기 점검은 ' +
            '<a href="menu.html?m=comply">이행점검</a>입니다. 여기는 <b>서류</b>를 봅니다.</p>' +
            readOnlyNote();
        /* 기본 접힘 — §14-12 의 '기본은 펼침' 은 그 화면에 **다른 안내 장치가 없을 때**의
           규칙이다. 여기는 바로 아래 계층 탭과 스코프 한 줄이 그 역할을 하고, 안내를
           펼쳐 두면 첫 데이터 행이 900px 밖으로 밀린다(실측). 접혀도 남는 lead 는
           설명이 아니라 **지금 상태**(계층별 건수)라 매일 봐도 값이 있다. */
        return V().notice('cmp-status', lead, rest, { foldedByDefault: true });
    }
    function readOnlyNote() {
        var R = global.DYROLE;
        return (R && R.readOnlyNote) ? (R.readOnlyNote('문서 등록·비해당 처리') || '') : '';
    }

    function subTabs() {
        var gap = gapStages().length;
        function t(id, label, n) {
            return '<button type="button" class="sub-tab' + (S.tab === id ? ' active' : '') + '"' +
                ' aria-current="' + (S.tab === id ? 'page' : 'false') + '"' +
                ' onclick="CMPST.setTab(\'' + id + '\')">' + esc(label) +
                (n != null ? '<span class="count">' + n + '</span>' : '') + '</button>';
        }
        return '<div class="sub-tabs cmp-subtabs">' +
            t('status', '단계별 이행현황', null) + t('gap', '누락 점검', gap) + '</div>';
    }

    /* =========================================================================
     * ① 단계별 이행현황
     * ========================================================================= */
    function statusPane() {
        var list = viewStages();
        return kpis(list) + filterBar(list) + body(list) + legend();
    }

    function levelTabs() {
        var c = C().levelCounts();
        return '<div class="tabs cmp-lvtabs" role="tablist" aria-label="이행 계층">' +
            C().LEVELS.map(function (l) {
                var on = S.level === l.id;
                return '<button type="button" role="tab" aria-selected="' + (on ? 'true' : 'false') + '"' +
                    ' class="tab' + (on ? ' active' : '') + '" onclick="CMPST.setLevel(\'' + l.id + '\')">' +
                    esc(l.label) + ' <span class="chip-status chip-sm neutral">' + c[l.id] + '</span></button>';
            }).join('') +
        '</div>';
    }

    function kpis(list) {
        var k = C().kpiOf(list, S.year);
        /* act 가 있으면 카드 자체가 버튼이다 — 목적지가 하나로 정해지는 카드만
         * 누르게 한다(설계 §3-2). 이행률은 여러 상태의 합이라 링크를 만들지 않는다. */
        function card(title, value, unit, foot, tone, act, hint) {
            var inner =
                '<div class="kpi-card-label"><span class="kpi-card-title">' + esc(title) + '</span>' +
                    (hint ? '<span class="cmp-kpi-go">' + esc(hint) + ' →</span>' : '') + '</div>' +
                '<div class="kpi-card-value' + (tone ? ' ' + tone : '') + '">' + value +
                    (unit ? '<span class="unit">' + esc(unit) + '</span>' : '') + '</div>' +
                '<div class="kpi-card-foot">' + foot + '</div>';
            return act
                ? '<button type="button" class="kpi-card cmp-kpi-btn" onclick="' + act + '">' + inner + '</button>'
                : '<div class="kpi-card">' + inner + '</div>';
        }
        var gauge = '<div class="progress cmp-kpi-bar" role="progressbar" aria-valuenow="' + k.rate +
            '" aria-valuemin="0" aria-valuemax="100" aria-label="정기 이행률">' +
            '<div class="progress-bar green" style="width:' + k.rate + '%;"></div></div>';
        return '<div class="cmp-kpis">' +
            card('정기 이행률', k.rate, '%', '충족 ' + k.periodicOk + ' / 정기 ' + k.periodic + '개' +
                (k.na ? ' · 비해당 ' + k.na + '개 제외' : '') + gauge) +
            card('상시 이행 충족', k.eventOk, '/ ' + k.event, '미충족 ' + (k.event - k.eventOk) + '개') +
            card('미이행 단계', k.unmet, '', '이 중 기한 경과(지연) ' + k.late + '개', 'cmp-kpi-bad',
                "CMPST.setTab('gap')", '누락 점검') +
            card('연간 이행 회차', k.rounds, '회', roundsFoot()) +
        '</div>';
    }
    /* 회차 합계는 **단계 기준**이다. 부서·시설 배수를 곱해 적어 두면 근거 없는
       수치가 KPI 자리에 앉는다 — 곱할 수 없는 이유를 대신 밝힌다(§9). */
    /* 한 줄로 유지한다 — 두 줄이 되면 KPI 카드가 8px 커져 첫 데이터 행이 600px 를
       넘는다(§14-12, 실측). 뺀 설명은 표 아래 캡션이 이어받는다. */
    function roundsFoot() {
        if (S.level === 'L2') return '단계 기준 · 부서 배수 미취합';
        if (S.level === 'L3') return '단계 기준 · 시설 배수는 Phase 2';
        return '군 전체 · 정기 단계 기준';
    }

    function cycleOptions() {
        var seen = {};
        C().stagesOfLevel(S.level).forEach(function (s) { var cy = C().cycleOf(s); if (cy.need > 0) seen[cy.cc] = 1; });
        return [['', '주기 전체']].concat(Object.keys(seen).map(function (cc) { return [cc, C().ccLabel(cc)]; }))
            .concat([['__ev', '상시·수시']]);
    }
    function wayOptions() {
        var c = C().typeCounts();
        return [['', '수행 위치 전체'],
                ['PROGRAM', '전용 화면 ' + c.PROGRAM],
                ['ELECTRONIC_DOC', '공문·문서 ' + c.ELECTRONIC_DOC],
                ['ATTACHMENT', '결과 등록 ' + c.ATTACHMENT],
                ['UNKNOWN', '확인 필요 ' + c.UNKNOWN]];
    }
    function statusOptions() {
        var out = [['', '상태 전체']];
        ['ok', 'run', 'late', 'no', 'na'].forEach(function (k) {
            out.push([k, C().JUDGE[k].glyph + ' ' + C().JUDGE[k].label]);
        });
        return out;
    }
    function axisOptions() {
        return C().AXES.map(function (a) { return [a.id, a.id ? a.label : '법령 축 전체']; });
    }
    function deptOptions() {
        return [['', '부서 전체']].concat(V().orgDepts().map(function (d) { return [d.name, d.name]; }));
    }
    function facClsOptions() {
        var seen = {};
        facRecs().forEach(function (r) { if (r.gbnNm) seen[r.gbnNm] = 1; });
        return [['', '시설 분류 전체']].concat(Object.keys(seen).sort().map(function (c) { return [c, c]; }));
    }

    function filterBar(list) {
        /* L2 부서별 보기는 표의 단위가 '부서 행'이다 — 결과 건수도 같은 단위로
         * 센다(단계 수를 찍으면 필터가 표에 안 걸린 것처럼 읽힌다, 검수 C-1). */
        var deptSeg = (S.level === 'L2' && S.seg2 === 'dept');
        var facSeg = (S.level === 'L3' && S.seg3 === 'fac');
        /* 검색창 문구는 그 보기가 **실제로 검색하는 것**을 적는다 — 관리대상별 보기는
         * 시설명·분류·소재지를 찾는다(D-2). 화면이 하지 않는 일을 약속하지 않는다. */
        var ph = deptSeg ? '부서명으로 찾기'
               : facSeg ? '시설명·분류·소재지로 찾기'
               : '할 일·법령·수행 주체로 찾기';
        var fields = [{ type: 'search', id: 'cs-q', value: S.q, placeholder: ph, on: "CMPST.setF('q', this.value)" }];
        if (S.level === 'L1') {
            fields.push(
                { type: 'select', id: 'cs-ax', value: S.axis, label: '법령 축', options: axisOptions(), on: "CMPST.setF('axis', this.value)" },
                { type: 'select', id: 'cs-cy', value: S.cycle, label: '이행주기', options: cycleOptions(), on: "CMPST.setF('cycle', this.value)" },
                { type: 'select', id: 'cs-st', value: S.st, label: '이행상태', options: statusOptions(), on: "CMPST.setF('st', this.value)" },
                { type: 'select', id: 'cs-wy', value: S.way, label: '수행 위치', options: wayOptions(), on: "CMPST.setF('way', this.value)" }
            );
        } else if (S.level === 'L2') {
            fields.push({ type: 'select', id: 'cs-dp', value: S.dept, label: '부서', options: deptOptions(), on: "CMPST.setF('dept', this.value)" });
        } else {
            fields.push(
                { type: 'select', id: 'cs-fc', value: S.facCls, label: '시설 분류', options: facClsOptions(), on: "CMPST.setF('facCls', this.value)" },
                { type: 'select', id: 'cs-st', value: S.st, label: '이행상태', options: statusOptions(), on: "CMPST.setF('st', this.value)" }
            );
        }
        var seg = '';
        if (S.level === 'L2') seg = segment('seg2', [['dept', '부서별 보기'], ['stage', '단계별 보기']]);
        if (S.level === 'L3') seg = segment('seg3', [['fac', '관리대상별 보기'], ['stage', '단계별 보기']]);
        return F().bar(fields, {
            count: deptSeg ? deptRows().length : list.length,
            unit: deptSeg ? '개 부서' : '개 할 일',
            reset: 'CMPST.resetF()',
            actions: seg,
        });
    }
    function segment(key, opts) {
        return '<span class="cmp-seg" role="group" aria-label="보기 방식">' + opts.map(function (o) {
            var on = S[key] === o[0];
            return '<button type="button" class="cmp-seg-btn' + (on ? ' is-on' : '') + '"' +
                ' aria-pressed="' + (on ? 'true' : 'false') + '"' +
                ' onclick="CMPST.setSeg(\'' + key + '\',\'' + o[0] + '\')">' + esc(o[1]) + '</button>';
        }).join('') + '</span>';
    }

    function body(list) {
        if (S.level === 'L2' && S.seg2 === 'dept') return mini('dept') + deptTable();
        if (S.level === 'L2' && S.seg2 === 'stage') return mini('l2stage') + deptDotTable(list);
        if (S.level === 'L3' && S.seg3 === 'fac') return mini('fac') + facTable();
        return mini(S.level === 'L3' ? 'l3stage' : 'l1') + groupTable(list);
    }
    /* 표 위 한 줄 — 와이어프레임 `.mini`. 무엇을 보는 표인지와 **어디를 누르면
     * 되는지**를 그 자리에서 말한다(D-3). 보기를 전환했을 때 무엇이 달라졌는지가
     * 표 아래 캡션에 있으면 늦다. */
    var MINI = {
        l1: '이행항목을 누르면 하위 할 일이 펼쳐지고, 할 일 줄을 누르면 상세로 들어갑니다.',
        dept: '부서별 보기 — <b>부서 줄을 누르면 그 부서의 할 일 목록</b>으로 들어갑니다. 보유 업무문서 건수를 누르면 그 부서 문서를 봅니다.',
        l2stage: '단계별 보기 — 한 할 일을 부서들이 얼마나 이행했는지 봅니다. 할 일 줄을 누르면 상세로 들어갑니다.',
        fac: '관리대상별 보기 — 시설마다 적용 법령이 달라 적용 단계가 가변입니다. <b>적용 단계 칩을 누르면</b> 그 할 일 상세로 들어갑니다.',
        l3stage: '단계별 보기 — 시설·공사에 적용되는 할 일을 이행항목별로 봅니다.',
    };
    function mini(k) { return '<p class="cmp-mini">' + MINI[k] + '</p>'; }

    /* ── 이행항목 그룹 표 (①) ───────────────────────────────────────────────
     * 그룹 기본 펼침 = 그룹 안에 지연·미이행이 있을 때(와이어프레임 동작).
     * 사람이 접어 둔 것은 S.open 이 기억한다. */
    function groupTable(list) {
        if (!list.length) return emptyBox();
        var by = {}, order = [];
        list.forEach(function (s) {
            if (!by[s.itemId]) { by[s.itemId] = []; order.push(s.itemId); }
            by[s.itemId].push(s);
        });
        var rows = order.map(function (itemId) {
            var g = by[itemId], it = D().item(itemId) || { id: itemId, name: itemId };
            var js = g.map(function (s) { return C().judge(s, S.year); });
            var gap = js.some(function (j) { return j && (j.key === 'no' || j.key === 'late'); });
            var open = (S.open[itemId] === undefined) ? gap : !!S.open[itemId];
            var ok = js.filter(function (j) { return j && j.key === 'ok'; }).length;
            var docs = js.reduce(function (a, j) { return a + (j ? j.docs : 0); }, 0);
            /* 행 자체가 토글이다 — 마우스 전용으로 두면 키보드 사용자는 그룹을
               영영 못 연다. dropKey 가 Enter/Space 를 클릭으로 수렴시킨다. */
            var head = '<tr class="cmp-grp" role="button" tabindex="0" aria-expanded="' + (open ? 'true' : 'false') + '"' +
                ' onclick="CMPST.toggleItem(\'' + esc(itemId) + '\')" onkeydown="DYV2.dropKey(event)">' +
                '<td colspan="5"><span class="cmp-car" aria-hidden="true">' + (open ? '▾' : '▸') + '</span> ' +
                    esc(it.name) + ' <span class="cmp-gcode">' + esc(it.id) + '</span></td>' +
                '<td class="cmp-num cmp-gm">충족 ' + ok + '/' + g.length + '</td>' +
                '<td class="cmp-num cmp-gm">' + docs + '건</td>' +
                '<td></td>' +
            '</tr>';
            if (!open) return head;
            return head + g.map(stageRow).join('');
        }).join('');
        return '<div class="cmp-wrap"><table class="table-figma table-compact cmp-table"><thead><tr>' +
            '<th class="cmp-c-main">할 일(업무단계)</th><th class="cmp-c-cy">이행주기</th><th class="cmp-num cmp-c-rd">회차</th>' +
            '<th class="cmp-c-st">이행상태</th><th class="cmp-c-way">수행 위치</th><th class="cmp-c-ac">수행 주체</th>' +
            '<th class="cmp-num cmp-c-dc">문서</th><th class="cmp-c-law">법령</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>' + derivedCap();
    }

    function stageRow(s) {
        var j = C().judge(s, S.year);
        var cy = C().cycleOf(s);
        var lv = C().levelOf(s);
        /* 행 전체가 상세 진입 타깃이다(와이어프레임 tr.stg) — 안의 버튼·링크를
           눌렀을 때는 양보한다(rowOpen 이 가드). 키보드는 이름 버튼이 담당한다. */
        return '<tr class="cmp-stg cmp-rowlink" id="cmp-s-' + esc(s.id) + '" onclick="CMPST.rowOpen(event, \'' + esc(s.id) + '\')">' +
            '<td class="cmp-c-main"><button type="button" class="cmp-slink" onclick="CMPST.openDetail(\'' + esc(s.id) + '\')">' +
                esc(s.name) + '</button>' +
                '<span class="cmp-scode">' + esc(s.id) + (lv.derived ? ' · 계층 추정' : '') + '</span></td>' +
            '<td class="cmp-c-cy' + (cy.need ? '' : ' cmp-dim') + '">' + esc(cy.label) + '</td>' +
            '<td class="cmp-num">' + (j.round || '—') + '</td>' +
            '<td>' + chip(j) + '</td>' +
            '<td class="cmp-c-way">' + wayChip(s) + '</td>' +
            '<td class="cmp-c-ac">' + esc(String(s.actor || '—').split('·')[0].trim()) + '</td>' +
            '<td class="cmp-num' + (j.docs ? '' : ' cmp-dim') + '">' + j.docs + '건</td>' +
            '<td class="cmp-c-law">' + lawBtn(s) + '</td>' +
        '</tr>' + lawRow(s);
    }
    /* 수행 위치 칩 — 어디서 하는 일인지 목록에서 바로 읽힌다.
       초안(DRAFT)·미정(UNKNOWN)은 물음표를 달아 «확정 아님»을 숨기지 않는다. */
    function wayChip(s) {
        var t = C().typeOf(s), paths = C().pathsOf(s);
        if (!paths.length) {
            return '<span class="chip-status chip-sm warning" title="수행 위치가 아직 정해지지 않았습니다 — 발주처 확인 대상">확인 필요</span>';
        }
        var p = paths[0];
        var name = (p.type === 'PROGRAM' && p.func) ? p.func.name : p.meta.label;
        var more = paths.length > 1 ? ' <span class="cmp-dim">+' + (paths.length - 1) + '</span>' : '';
        return '<span class="chip-status chip-sm ' + p.meta.tone + '" title="' + esc(p.meta.label) + '">' + esc(name) + '</span>' + more +
               (C().needsConfirm(s) ? '<span class="cmp-draft" title="개발측 초안 — 발주처 확정 전">초안</span>' : '');
    }
    function chip(j) {
        if (!j) return '';
        return '<span class="chip-status chip-sm ' + j.tone + '">' + j.glyph + ' ' + esc(j.label) + '</span>';
    }
    /* 법령 ⓘ 는 hover 툴팁이 아니라 **행 아래 인라인 펼침**이다(§7 · CLAUDE.md §1) */
    function lawBtn(s) {
        var on = !!S.law[s.id];
        return '<button type="button" class="cmp-law-btn" aria-expanded="' + (on ? 'true' : 'false') +
            '" aria-label="' + esc(s.name) + ' 법령 근거" onclick="CMPST.toggleLaw(\'' + esc(s.id) + '\')">ⓘ</button>';
    }
    function lawRow(s) {
        if (!S.law[s.id]) return '';
        var cy = C().cycleOf(s);
        return '<tr class="cmp-lawrow"><td colspan="8">' +
            '<div class="lawinfo-inline">' +
                '<dl class="cmp-dl">' +
                    '<div><dt>법령근거</dt><dd>' + lawCell(s.law) + '</dd></div>' +
                    '<div><dt>법정주기</dt><dd>' + esc(s.legalCycle || '정기주기 없음') +
                        (s.opCycle ? ' <span class="cmp-dim">· 재난안전과 운영주기 ' + esc(s.opCycle) + '</span>' : '') + '</dd></div>' +
                    '<div><dt>수행시점조건</dt><dd>' + (s.timing ? esc(s.timing) : '<span class="cmp-dim">—</span>') + '</dd></div>' +
                '</dl>' +
                (cy.need > 0
                    ? '<p class="cmp-cap">회차 기한은 달력 말일 <b>추정</b>입니다 — 공문에 적힌 실제 기한이 아닙니다.</p>'
                    : '') +
            '</div>' +
        '</td></tr>';
    }
    /* 근거 표기는 화면이 조립하지 않는다 — DYLAW 로 해석하고, 스냅샷에 없는
       조문은 지어내지 않고 '조문 미연결'로 밝힌다(CLAUDE.md §10). */
    function lawCell(raw) {
        if (!raw) return '<span class="cmp-dim">미등록</span>';
        var L = global.DYLAW;
        return String(raw).split(',').map(function (t) {
            var one = t.trim(); if (!one) return '';
            var key = L && L.resolveBasis ? L.resolveBasis(one) : '';
            return (key && L.basisChip) ? L.basisChip(key, { withTitle: true })
                : esc(one) + ' <span class="cmp-dim">조문 미연결</span>';
        }).filter(Boolean).join(' ');
    }
    function derivedCap() {
        var c = C().levelCounts();
        return '<p class="cmp-cap">계층 분류는 적용대상 문자열 파생(<b>추정</b>)이며 발주처 확정 대상입니다 — ' +
            '문구만으로 못 가려 이행항목 번호·기본값으로 수렴시킨 ' + c.derived + '개 단계 포함(행에 «계층 추정» 표시).</p>';
    }
    function emptyBox() {
        return '<div class="v2-empty"><b>조건에 맞는 할 일이 없습니다.</b><br>조회 조건을 지우면 이 계층의 전체 목록이 나옵니다.' +
            (filtering() ? '<div class="cmp-empty-act"><button type="button" class="btn btn-outline btn-sm" onclick="CMPST.resetF()">조건 초기화</button></div>' : '') +
        '</div>';
    }

    /* ── L2 부서별 보기 ─────────────────────────────────────────────────────
     * 이행 판정을 지어내지 않는다 — 원장(DYDOCH)은 재난안전과 문서라 부서 귀속
     * 데이터가 없다(doc-history-data 헤더 주석: sr 은 수발신 기관이지 부서가
     * 아니다). 부서별로 낼 수 있는 것은 ① 적용 단계 수(추정) ② 그 부서가 보유한
     * 업무문서 수뿐이고, 이행 칸은 '자료 미취합'으로 드러낸다(§9-1). */
    /* 부서 문서 보유량 — 5개년 원장 실측(DYCMPDEPT)이 있으면 그것을, 없으면
     * 이 화면에서 등록한 문서만 센다.
     * ⚠ 두 수는 뜻이 다르다 — 실측은 «그 부서 문서 전체»(분류 이전 원장)이고
     *   등록분은 «이 시스템에 올린 증빙»이다. 화면이 어느 쪽인지 밝힌다. */
    function deptDocCount(name) {
        var m = C().deptDocs(name);
        if (m) return { n: m.total, real: true, byYear: m.byYear };
        return { n: D().allDocs().filter(function (d) { return d.dept === name; }).length, real: false };
    }
    /* 부서 필터·검색을 **표에도** 건다 — 필터 바에는 조건이 걸린 것으로 표시되는데
     * 표가 전 부서를 그대로 내면 "걸었는데 안 걸린다"가 된다(검수 C-1). 부서
     * 담당자의 자기 부서 프리셋(§6)도 이 표에서 비로소 1행이 된다. */
    function deptRows() {
        return V().orgDepts().filter(function (dp) {
            if (S.dept && dp.name !== S.dept) return false;
            if (S.q && !F().match(S.q, [dp.name])) return false;
            return true;
        });
    }
    /* 보유 문서 셀 — 실측(원장 집계)과 등록분을 구분해 보여준다.
       실측은 «분류 이전 원장 전체»라 이행 증빙 수가 아니다. */
    function docCell(name, d) {
        if (!d.n) return '<span class="cmp-dim">0건</span>';
        var yrs = d.byYear ? Object.keys(d.byYear).map(function (y) { return y + ' ' + d.byYear[y].toLocaleString(); }).join(' · ') : '';
        if (d.real) {
            return '<span class="cmp-real" title="5개년 원장 집계 — ' + esc(yrs) + '">' +
                   d.n.toLocaleString() + '건</span>' +
                   '<span class="cmp-dim cmp-real-tag">원장</span>';
        }
        return '<a href="cmp-docs.html?dept=' + encodeURIComponent(name) + '">' + d.n + '건</a>';
    }
    function deptTable() {
        var stages = levelStages();
        var depts = deptRows();
        if (!depts.length) return emptyBox();
        var rows = depts.map(function (dp) {
            var mine = stages.filter(function (s) { return D().stageDeptHit(s, dp.name); });
            var per = mine.filter(function (s) { return C().cycleOf(s).need > 0; }).length;
            var docs = deptDocCount(dp.name);
            /* 행 클릭 → 그 부서의 할 일 목록(D-1). 와이어프레임이 표 위에 명시한
               흐름이다. 적용 단계 N개를 보여주면서 그 N개를 못 여는 것이 막다른 길이었다. */
            return '<tr class="cmp-stg cmp-rowlink" onclick="CMPST.openDept(event, \'' + esc(dp.name) + '\')">' +
                '<td><button type="button" class="cmp-slink">' + esc(dp.name) + '</button></td>' +
                '<td class="cmp-num">' + mine.length + '개</td>' +
                '<td class="cmp-num">' + per + '개</td>' +
                '<td class="cmp-num">' + (mine.length - per) + '개</td>' +
                '<td><span class="chip-status chip-sm warning">자료 미취합</span></td>' +
                /* 보유 문서는 이 화면 밖(문서 목록)이 답이다(D-5) */
                '<td class="cmp-num">' + docCell(dp.name, docs) + '</td></tr>';
        }).join('');
        var reg = V().orgDepts().length;
        /* 명단 미확보 안내 행은 전체 보기에서만 — 한 부서로 거른 표 밑에 '나머지
           28개'가 붙으면 필터 결과가 29개처럼 읽힌다 */
        var missing = (S.dept || S.q) ? '' :
            '<tr class="cmp-missing"><td colspan="6">… 나머지 ' + (39 - reg) + '개 부서 — <b>명단 미확보</b> (대상 과·사업소 39개 중 ' + reg + '개 등록)</td></tr>';
        return '<div class="cmp-wrap"><table class="table-figma table-compact cmp-table"><thead><tr>' +
            '<th class="cmp-c-dept">부서</th><th class="cmp-num cmp-c-n">적용 단계(추정)</th><th class="cmp-num cmp-c-n">정기</th>' +
            '<th class="cmp-num cmp-c-n">상시</th><th class="cmp-c-rate">정기 이행률</th><th class="cmp-num cmp-c-n">보유 업무문서</th>' +
        '</tr></thead><tbody>' + rows + missing +
        '</tbody></table></div>' +
        deptDocsNote() +
        '<p class="cmp-cap"><b>부서별 이행 판정은 아직 낼 수 없습니다.</b> 2025년 문서 원장이 재난안전과 소관이라 ' +
            '문서에 <b>담당부서 값이 없습니다</b>(수발신 기관은 부서가 아닙니다). 적용 단계 수는 적용대상 문구에서 부서 이름을 찾은 <b>추정</b>이고, ' +
            '담당부서 연계(새올·온나라)를 받으면 이 표가 실측으로 바뀝니다.</p>';
    }
    /* 실측 시드가 실린 경우에만 그 출처와 한계를 밝힌다 — 수치만 크게 보여주면
       «이 부서는 이행을 많이 했다»로 읽힌다. */
    function deptDocsNote() {
        var m = C().deptDocsMeta();
        if (!m) return '';
        return '<p class="cmp-cap"><b>보유 업무문서는 5개년 원장 실측입니다</b>(' + esc(m.range) + ' · ' +
            m.total.toLocaleString() + '건 · ' + m.depts + '개 부서). ' +
            '다만 원장에 <b>업무단계 분류가 없어 이행 증빙 수가 아닙니다</b> — 그 부서에 문서가 몇 건 있는지까지만 말합니다. ' +
            (m.excluded && m.excluded.length
                ? '<b>' + esc(m.excluded.join('·')) + '</b>는 폴더 라벨과 실제 내용이 달라 <b>집계에서 뺐습니다</b>. ' : '') +
            '나머지 부서는 이 화면에서 등록한 문서만 셉니다.</p>';
    }
    /* ── L2 단계별 보기 — 부서 이행 도트 ─────────────────────────────────── */
    function deptDotTable(list) {
        if (!list.length) return emptyBox();
        var depts = V().orgDepts();
        var rows = list.map(function (s) {
            var cy = C().cycleOf(s);
            var hit = depts.filter(function (dp) { return D().stageDeptHit(s, dp.name); });
            /* 도트는 시각 요소다 — title 만 두면 스크린리더에 아무것도 읽히지 않는다(D-10).
               클릭 목적지는 두지 않는다(부서별 판정이 자료 미취합이라 갈 곳이 없다). */
            var dots = depts.map(function (dp) {
                var on = hit.indexOf(dp) >= 0;
                var lab = dp.name + (on ? ' — 적용(추정) · 자료 미취합' : ' — 적용 대상 아님(추정)');
                return '<i class="' + (on ? 'na' : '') + '" role="img" aria-label="' + esc(lab) + '" title="' + esc(lab) + '"></i>';
            }).join('');
            return '<tr class="cmp-stg cmp-rowlink" onclick="CMPST.rowOpen(event, \'' + esc(s.id) + '\')"><td class="cmp-c-main">' +
                    '<button type="button" class="cmp-slink" onclick="CMPST.openDetail(\'' + esc(s.id) + '\')">' + esc(s.name) + '</button>' +
                    '<span class="cmp-scode">' + esc(s.id) + '</span></td>' +
                '<td class="cmp-c-cy' + (cy.need ? '' : ' cmp-dim') + '">' + esc(cy.label) + '</td>' +
                '<td><div class="cmp-dots">' + dots + '</div></td>' +
                '<td class="cmp-num cmp-dim">— / 39</td>' +
                '<td class="cmp-c-law">' + lawBtn(s) + '</td></tr>' + lawRowSpan(s, 5);
        }).join('');
        return '<div class="cmp-wrap"><table class="table-figma table-compact cmp-table"><thead><tr>' +
            '<th class="cmp-c-main">할 일(업무단계)</th><th class="cmp-c-cy">이행주기</th><th class="cmp-c-dots-h">부서 이행 현황</th>' +
            '<th class="cmp-num cmp-c-n2">이행 부서</th><th class="cmp-c-law">법령</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<p class="cmp-legend cmp-cap"><span class="cmp-dot-k"><i class="ok"></i> 이행</span>' +
            '<span class="cmp-dot-k"><i></i> 적용 대상 아님(추정)</span>' +
            '<span class="cmp-dot-k"><i class="na"></i> 자료 미취합</span>' +
            ' 등록 부서 ' + V().orgDepts().length + ' / 39개 — 부서 귀속 자료가 없어 <b>이행 도트는 전부 미취합</b>입니다.</p>';
    }
    function lawRowSpan(s, span) {
        if (!S.law[s.id]) return '';
        return lawRow(s).replace('colspan="7"', 'colspan="' + span + '"');
    }

    /* ── L3 관리대상별 보기 ─────────────────────────────────────────────────
     * 시설 데이터는 FMS 연계 시드(DY_FACIL_SEED 80건). 시설↔단계 매핑은 시설
     * 분류에서 파생한 **추정**이고, 이행 칩은 그 업무단계의 **군 단위 판정**이다
     * (시설 건별 판정은 자료가 없다 — 지어내지 않는다). */
    function facRecs() {
        var seed = global.DY_FACIL_SEED;
        return (seed && seed.recs) ? seed.recs : [];
    }
    function facExt(no) {
        var seed = global.DY_FACIL_SEED;
        return (seed && seed.ext && seed.ext[no]) ? seed.ext[no] : null;
    }
    /* 분류 → 적용 이행항목(추정). 없는 매핑을 만들지 않는다 — 모르면 빈 배열. */
    var FAC_MAP = {
        '교량': ['FAC-01', 'FAC-02'],
        '하천': ['FAC-01', 'FAC-02'],
        '건축물': ['FAC-01', 'FAC-02', 'FAC-07', 'CIT-01'],
        '상하수도': ['FAC-01', 'FAC-02'],
        '기타': ['FAC-02'],
    };
    function facStages(rec) {
        var ids = FAC_MAP[rec.gbnNm] || [];
        var out = [];
        ids.forEach(function (id) {
            D().stagesOfItem(id).forEach(function (s) {
                if (C().levelOf(s).level === 'L3') out.push(s);
            });
        });
        return out;
    }
    function facTable() {
        var recs = facRecs().filter(function (r) { return !S.facCls || r.gbnNm === S.facCls; })
            .filter(function (r) { return !S.q || F().match(S.q, [r.facilNm, r.gbnNm, r.kindNm, r.addrDong]); });
        if (!recs.length) return emptyBox();
        var show = recs.slice(0, 25);
        var rows = show.map(function (r) {
            var ex = facExt(r.facilNo);
            var st = facStages(r);
            var ok = 0;
            /* 칩이 곧 진입점이다 — 상태만 보여주고 눌리지 않으면 L3 에서 그 단계의
               문서·상세로 가는 길이 없다(막다른 길) */
            var chips = st.map(function (s) {
                var j = C().judge(s, S.year);
                if (j.key === 'ok') ok++;
                return '<button type="button" class="chip-status chip-sm ' + j.tone + '" ' +
                    'title="' + esc(s.name) + ' 상세로" onclick="CMPST.openDetail(\'' + esc(s.id) + '\')">' +
                    j.glyph + ' ' + esc(s.name) + '</button>';
            }).join('');
            return '<tr class="cmp-stg"><td><b>' + esc(r.facilNm) + '</b><span class="cmp-scode">' + esc(r.facilNo) + '</span></td>' +
                '<td>' + (ex && ex.deptNm ? esc(ex.deptNm) : '<span class="chip-status chip-sm warning">소관부서 미등록</span>') + '</td>' +
                '<td class="cmp-dim">' + esc(r.gbnNm || '—') + (r.kindNm ? ' · ' + esc(r.kindNm) : '') + '</td>' +
                '<td class="cmp-fchips">' + (chips || '<span class="cmp-dim">적용 단계 매핑 없음</span>') + '</td>' +
                '<td class="cmp-num">' + (st.length ? ok + '/' + st.length : '—') + '</td></tr>';
        }).join('');
        return '<div class="cmp-wrap"><table class="table-figma table-compact cmp-table"><thead><tr>' +
            '<th class="cmp-c-fac">관리대상</th><th class="cmp-c-ac">소관부서</th><th class="cmp-c-cy">분류</th>' +
            '<th class="cmp-c-fchips-h">적용 단계 이행</th><th class="cmp-num cmp-c-n2">충족</th>' +
        '</tr></thead><tbody>' + rows +
            (recs.length > show.length
                ? '<tr class="cmp-missing"><td colspan="5">… 조건에 맞는 ' + recs.length + '개 중 ' + show.length + '개 표시 (FMS 연계 시드 ' + facRecs().length + '건)</td></tr>'
                : '') +
        '</tbody></table></div>' +
        '<p class="cmp-cap"><b>시설↔업무단계 매핑은 시설 분류에서 파생한 추정</b>이고, 이행 칩은 그 <b>업무단계 단위</b> 판정입니다 — ' +
            '시설 건별 회차 판정은 자료가 없습니다. 소관부서는 FMS 표준연계 규격에 없어 담양군 보완입력 대상이라 대부분 미등록입니다.</p>' +
        '<p class="cmp-cap"><b>관리대상 단위는 회차 전수 관리를 권하지 않습니다.</b> 승강기·어린이놀이시설 자체점검은 이미 ' +
            '승강기안전종합정보망·어린이놀이시설 안전관리시스템에 등록됩니다. 이 시스템은 <b>결과 보고 문서</b>를 관리하므로 ' +
            'Phase 1 은 연간 실적 등록 수준으로 두고 회차 단위 관리는 Phase 2 에서 확장합니다.</p>';
    }

    function legend() {
        return '<p class="cmp-legend">' + ['ok', 'run', 'late', 'no', 'na'].map(function (k) {
            var j = C().JUDGE[k];
            return '<span><span class="chip-status chip-sm ' + V().toneOf(j.label) + '">' + j.glyph + ' ' + esc(j.label) +
                '</span> ' + esc(j.desc) + '</span>';
        }).join('') + '</p>';
    }

    /* =========================================================================
     * ② 이행 상세
     * ========================================================================= */
    /* 상세는 '한 단계 들어간 곳'이라 브라우저 뒤로가기가 닫기여야 한다 — 히스토리
       항목을 하나 심고(pushState), 닫기 버튼도 가능하면 그 항목을 되돌린다(back).
       뒤로가기가 페이지를 통째로 이탈하면 목록 상태(필터·스크롤)를 잃는다. */
    function openDetail(stageId) {
        if (!D().stage(stageId)) return;
        S.detail = stageId;
        S.dyear = S.year;
        try { history.pushState({ cmp: 'detail' }, '', urlOf()); } catch (e) {}
        render();
        try { window.scrollTo(0, 0); } catch (e) {}
    }
    function closeDetail() {
        if (history.state && history.state.cmp === 'detail') { history.back(); return; }
        S.detail = '';                     /* URL 직접 진입 — 되돌릴 히스토리가 없다 */
        render();
    }

    function detailPane() {
        var s = D().stage(S.detail);
        if (!s) { S.detail = ''; return statusPane(); }
        var it = D().item(s.itemId) || {};
        var y = S.dyear || S.year;
        var j = C().judge(s, y);
        var cy = C().cycleOf(s);
        var lv = C().levelOf(s);
        var prev = D().presetSourceYear(y);
        var prevN = prev ? D().documentIdsOfStage(s.id, prev).length : 0;
        var docs = C().docsOfStage(s.id, y);
        /* 과거 연도에는 소급 등록하지 않는다 — 버튼을 아예 내지 않는다(§4-2) */
        var live = y >= baseYear();
        var canReg = live && D().canUpload();

        return '<p class="cmp-back"><button type="button" class="du-link" onclick="CMPST.closeDetail()">‹ 단계별 이행현황으로</button></p>' +
        '<div class="cmp-two">' +
            '<div class="cmp-two-l">' +
                '<p class="cmp-scode cmp-detail-code">' + esc(s.id) + ' · ' + esc(it.name || '') + '</p>' +
                '<h2 class="cmp-detail-h">' + esc(s.name) + '</h2>' +
                '<p class="cmp-cap">' + esc(C().LEVELS.filter(function (l) { return l.id === lv.level; })[0].label) +
                    (lv.derived ? ' <b>(문자열 파생 추정)</b>' : '') + '</p>' +
                '<dl class="cmp-dl">' +
                    '<div><dt>법령근거</dt><dd>' + lawCell(s.law) + '</dd></div>' +
                    '<div><dt>법정주기</dt><dd>' + esc(s.legalCycle || '정기주기 없음') + '</dd></div>' +
                    '<div><dt>운영주기(재난안전과)</dt><dd>' + (s.opCycle ? esc(s.opCycle) : '<span class="cmp-dim">미지정</span>') + '</dd></div>' +
                    '<div><dt>수행시점조건</dt><dd>' + (s.timing ? esc(s.timing) : '<span class="cmp-dim">—</span>') + '</dd></div>' +
                    '<div><dt>적용대상</dt><dd>' + esc(s.target || '—') + '</dd></div>' +
                    '<div><dt>이행주체</dt><dd>' + esc(s.actor || '—') + '</dd></div>' +
                '</dl>' +
                typeBlock(s) +
                '<div class="cmp-detail-sum">' +
                    '<dl class="cmp-dl">' +
                        '<div><dt>' + y + '년 이행상태</dt><dd>' + chip(j) +
                            (j.key === 'na' ? ' <span class="cmp-dim">' + (j.reason ? esc(j.reason) : '사유 미기재 — 확인 필요') + '</span>' : '') + '</dd></div>' +
                        '<div><dt>회차</dt><dd>' + (cy.need > 0
                            ? j.round + ' <span class="cmp-dim">(' + esc(cy.label) + ' · 기한은 달력 말일 추정)</span>'
                            : '<span class="cmp-dim">상시 — 정기 회차 없음</span>') + '</dd></div>' +
                        /* 숫자만 보여주고 못 열면 셀렉터를 찾아 다시 골라야 한다(D-8) */
                        (prev ? '<div><dt>' + prev + '년 실적</dt><dd>' + (prevN
                            ? '<button type="button" class="du-link" onclick="CMPST.setDetailYear(' + prev + ')">' + prevN + '건 보기 →</button>'
                            : '<span class="cmp-dim">0건</span>') + '</dd></div>' : '') +
                    '</dl>' +
                '</div>' +
            '</div>' +
            '<div class="cmp-two-r">' +
                '<div class="cmp-detail-bar">' +
                    '<h3 class="cmp-detail-h3">' + y + '년 등록 문서 <span class="cmp-dim">(' + docs.length + ')</span></h3>' +
                    '<span class="cmp-detail-act">' +
                        '<label class="cmp-yr"><span>연도</span><select class="form-select" aria-label="상세 연도"' +
                            ' onchange="CMPST.setDetailYear(this.value)">' +
                            F().optionsHtml(C().years().map(function (yy) { return [yy, yy + '년']; }), y) + '</select></label>' +
                        /* 전년 등록 0건이면 불러오기 버튼을 내지 않는다 — 눌러도 빈
                           목록뿐인 버튼은 없는 동작을 약속하는 것이다(검수 C-4) */
                        (canReg && prev && prevN > 0
                            ? '<button type="button" class="btn btn-outline btn-sm" onclick="CMPST.openPull()">📁 ' + prev + '년 문서 불러오기</button>'
                            : '') +
                        /* 유형별 CTA — 발주측 §6.1(모든 업무를 «새 문서 등록»으로
                           처리하지 않는다). 유형이 비어 있으면 종전 버튼 그대로다. */
                        (canReg ? ctaButtons(s, y) : '') +
                    '</span>' +
                '</div>' +
                (live ? '' : '<p class="cmp-cap"><b>' + y + '년은 지난 연도입니다.</b> 소급 등록을 막기 위해 등록 버튼을 내지 않습니다 — 조회만 됩니다.</p>') +
                (docs.length ? docTable(docs) : '<div class="v2-empty">이 연도에 등록된 문서가 없습니다.</div>') +
                gapBox(s, y, canReg, prev, prevN) +
                (prev
                    ? '<div class="cmp-detail-bar cmp-detail-prev">' +
                        '<h3 class="cmp-detail-h3">' + prev + '년 문서 <span class="cmp-dim">(' + prevN + ')</span></h3>' +
                        '<a class="btn btn-outline btn-sm" href="cmp-docs.html?stage=' + encodeURIComponent(s.id) + '&year=' + prev + '">지난연도 전체 보기</a>' +
                      '</div>'
                    : '') +
                naBox(s, y) +
            '</div>' +
        '</div>';
    }
    /* 유형별 수행 버튼 — 한 단계가 여러 경로를 가지면 **전부** 낸다(계획은 문서,
     * 실시는 전용화면). 주 경로가 primary, 나머지는 outline 이다.
     * 갈 수 없는 경로(메뉴 미구현·외부 시스템)는 버튼 대신 **어디서 하는지**를 밝힌다 —
     * 없는 화면으로 보내는 버튼은 눌러 본 사람에게 배신이다. */
    function ctaButtons(s, y) {
        var paths = C().pathsOf(s);
        if (!paths.length) {
            /* UNKNOWN — 수행 위치가 아직 정해지지 않았다. 종전 동작을 유지하되
               그 사실을 숨기지 않는다(§19: 임의로 정하지 않는다). */
            return '<button type="button" class="btn btn-primary btn-sm" onclick="CMPST.openReg(\'' + esc(s.id) + '\')">＋ 새 문서 등록</button>';
        }
        return paths.map(function (p, i) {
            var cls = 'btn btn-sm ' + (i === 0 ? 'btn-primary' : 'btn-outline');
            if (p.type === 'PROGRAM') {
                if (p.reachable) {
                    return '<a class="' + cls + '" href="' + esc(p.func.href) + '">' + esc(p.func.name) + ' 바로가기 →</a>';
                }
                return '<span class="cmp-cta-off" title="연결할 화면이 아직 없습니다">' +
                    esc((p.func && p.func.name) || '전용 화면') + ' — 연결 대기</span>';
            }
            if (p.type === 'ATTACHMENT') {
                return '<button type="button" class="' + cls + '" onclick="CMPST.openReg(\'' + esc(s.id) + '\')">＋ 결과 등록</button>';
            }
            return '<button type="button" class="' + cls + '" onclick="CMPST.openReg(\'' + esc(s.id) + '\')">＋ 업무문서 작성</button>';
        }).join(' ');
    }
    /* 상세 좌측에 붙는 «어디서 수행하나» 블록 — 유형·경로·확정 여부를 한자리에서.
       DRAFT/UNKNOWN 이면 «우리 초안이지 발주처 확정이 아니다»를 반드시 밝힌다. */
    function typeBlock(s) {
        var t = C().typeOf(s), paths = C().pathsOf(s), draft = C().needsConfirm(s);
        var where = paths.length
            ? paths.map(function (p) {
                var nm = p.func ? p.func.name : p.meta.label;
                var st = (p.func && p.func.state === 'PLANNED') ? ' <span class="cmp-dim">(완료 판정 준비 중)</span>'
                       : (p.func && p.func.state === 'NONE') ? ' <span class="cmp-dim">(연결 대기)</span>' : '';
                return '<span class="chip-status chip-sm ' + p.meta.tone + '">' + esc(p.meta.label) + '</span> ' + esc(nm) + st;
              }).join('<br>')
            : '<span class="chip-status chip-sm warning">' + esc(t.label) + '</span>';
        return '<div class="cmp-detail-sum">' +
            '<dl class="cmp-dl"><div><dt>어디서 수행하나</dt><dd>' + where + '</dd></div>' +
            (draft
                ? '<div><dt>분류 상태</dt><dd><span class="chip-status chip-sm warning">확인 필요</span> ' +
                  '<span class="cmp-dim">개발측이 메뉴를 대조해 만든 <b>초안</b>입니다 — 발주처 확정 전입니다.</span>' +
                  (s.typeNote ? '<p class="cmp-cap">' + esc(s.typeNote) + '</p>' : '') + '</dd></div>'
                : '') +
            '</dl></div>';
    }
    function docTable(docs) {
        return '<div class="cmp-wrap"><table class="table-figma table-compact cmp-table"><thead><tr>' +
            '<th>문서명</th><th class="cmp-c-cy">구분</th><th class="cmp-c-ac">수발신자</th>' +
            '<th class="cmp-num cmp-c-rd">보고일자</th><th class="cmp-c-st">결재상태</th>' +
        '</tr></thead><tbody>' + docs.map(function (d) {
            return '<tr class="cmp-stg"><td><a href="cmp-docs.html?doc=' + encodeURIComponent(d.id) + '">' + esc(d.title) + '</a></td>' +
                '<td class="cmp-dim">' + esc((D().SRC[d.src] || {}).label || d.src || '—') + '</td>' +
                '<td class="cmp-c-ac">' + (d.sr ? esc(d.sr) : '<span class="cmp-dim">—</span>') + '</td>' +
                '<td class="cmp-num">' + esc(d.date || '—') + '</td>' +
                '<td><span class="chip-status chip-sm ' + V().toneOf(d.status) + '">' + esc(d.status || '—') + '</span></td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    function gapBox(s, y, canReg, prev, prevN) {
        var g = C().nextGap(s, y);
        if (!g) return '';
        return '<div class="v2-empty cmp-gapbox"><b>' + g.round + '회차가 비어 있습니다 (' + g.round + ' / ' + g.need + ')</b>' +
            '<p>주기상 기한은 ' + esc(g.due) + ' 입니다 — 달력 말일 <b>추정</b>이고 공문에 적힌 실제 기한이 아닙니다.</p>' +
            (canReg
                ? '<div class="cmp-empty-act">' +
                    (prev && prevN > 0
                        ? '<button type="button" class="btn btn-outline btn-sm" onclick="CMPST.openPull()">📁 ' + prev + '년 문서 불러오기</button> '
                        : '') +
                    '<button type="button" class="btn btn-primary btn-sm" onclick="CMPST.openReg(\'' + esc(s.id) + '\')">＋ 새 문서 등록</button></div>'
                : '') +
        '</div>';
    }
    function naBox(s, y) {
        var rec = D().stageRecord(s.id, y);
        if (!D().canSetNA()) return '';
        if (y < baseYear()) return '';
        if (rec.status === D().ST.NA) {
            return '<p class="cmp-cap"><b>비해당 처리됨</b> — 사유: ' +
                (rec.naReason ? esc(rec.naReason) : '<b>미기재 (확인 필요)</b>') +
                ' <button type="button" class="du-link" onclick="CMPST.clearNA(\'' + esc(s.id) + '\')">비해당 해제</button></p>';
        }
        return '<p class="cmp-cap">이 해에 이 일이 해당되지 않는다면 ' +
            '<button type="button" class="du-link" onclick="CMPST.openNA(\'' + esc(s.id) + '\')">비해당 — 사유 기재</button> 로 남깁니다. ' +
            '사유 없이는 저장되지 않습니다.</p>';
    }

    /* =========================================================================
     * ③ 작년 문서 불러오기 — 단일 모달 (CLAUDE.md §1)
     * ========================================================================= */
    var P = null;   /* {stageId, from, to, q, sel:{docId:1}, fields:{title,sr,date}} */
    /* 같은 원본을 두 번 불러오지 않는다 — presetOf 를 저장만 하고 검사하지 않으면
     * 시연을 반복할수록 사본이 쌓인다(검수 C-2). 판정 근거는 그 저장값 하나다. */
    function pulledInto(srcId, toYear) {
        return D().allDocs().some(function (d) { return d.presetOf === srcId && +d.year === +toYear; });
    }
    function openPull() {
        if (!S.detail) return;
        var y = S.dyear || S.year;
        if (!D().canUpload()) { V().toast('문서 등록 권한이 없습니다 — 부서 담당자가 수행합니다.'); return; }
        var from = D().presetSourceYear(y);
        if (!from) { V().toast('가져올 지난연도 문서가 없습니다.'); return; }
        /* 버튼만 감추면 전역 호출로 뚫린다(검수 C-4) — 여기서도 막는다 */
        if (!D().documentIdsOfStage(S.detail, from).length) {
            V().toast(from + '년에 이 할 일로 등록된 문서가 없습니다.'); return;
        }
        /* 복사 범위는 **전부**다(발주처 결정 2026-08-18, 참고문서 §11 의 5개 검토 항목 확정).
           체크는 남겨 두되 기본값을 전부 켠다 — 끄고 싶은 담당자를 막을 이유는 없다.
           결재문서 복제는 온나라 미연동이라 항목 자체를 두지 않는다(없는 기능을 약속하지 않는다). */
        P = { stageId: S.detail, from: from, to: y, q: '', sel: {},
              fields: { title: true, sr: true, date: true, stages: true, files: true } };
        renderPull();
    }
    function pullList() {
        var docs = C().docsOfStage(P.stageId, P.from);
        if (!P.q) return docs;
        return docs.filter(function (d) { return F().match(P.q, [d.title, d.sr, d.id]); });
    }
    function renderPull() {
        var s = D().stage(P.stageId);
        var all = C().docsOfStage(P.stageId, P.from);
        var list = pullList();
        var n = Object.keys(P.sel).length;
        var body =
            '<div>' +
                '<div class="cmp-pull-h">' +
                    '<p class="cmp-scode">' + esc(s.id) + '</p>' +
                    '<p class="cmp-pull-t">' + esc(s.name) + '</p>' +
                    '<p class="cmp-dim">' + P.from + '년 이 단계에 등록된 문서 ' + all.length + '건</p>' +
                '</div>' +
                '<div class="cmp-pull-f">' +
                    '<input type="search" class="form-input" id="cmp-pull-q" value="' + esc(P.q) + '"' +
                        ' placeholder="문서명 검색" aria-label="문서명 검색" oninput="CMPST.pullQ(this.value)">' +
                    '<button type="button" class="btn btn-outline btn-sm" onclick="CMPST.pullAll()">전체 선택</button>' +
                    '<button type="button" class="btn btn-outline btn-sm" onclick="CMPST.pullNone()">선택 해제</button>' +
                '</div>' +
                '<div class="cmp-pull-b">' +
                    (list.length ? list.map(function (d) {
                        var dup = pulledInto(d.id, P.to);
                        return '<label class="cmp-pull-row' + (dup ? ' is-pulled' : '') + '">' +
                            '<input type="checkbox"' + (dup ? ' disabled' : (P.sel[d.id] ? ' checked' : '')) +
                                ' onchange="CMPST.pullSel(\'' + esc(d.id) + '\', this.checked)">' +
                            '<span><span class="cmp-pull-n">' + esc(d.title) +
                                (dup ? ' <span class="chip-status chip-sm neutral">이미 불러옴</span>' : '') + '</span>' +
                                '<span class="cmp-dim">' + esc((D().SRC[d.src] || {}).label || d.src || '') +
                                ' · ' + esc(d.date || '') + (d.sr ? ' · ' + esc(d.sr) : '') + '</span></span>' +
                        '</label>';
                    }).join('') : '<div class="v2-empty">조건에 맞는 문서가 없습니다.</div>') +
                '</div>' +
                '<p class="cmp-cap"><b>문서명·수발신자·보고일자·업무단계 매핑·첨부파일을 모두 복사합니다.</b> ' +
                    '다만 ' + P.from + '년 원장 문서는 <b>메타데이터만</b> 보유해(문서명·수발신자·보고일자·생산등록번호) 복사할 첨부가 없습니다. ' +
                    '<b>본문과 결재문서는 복제하지 않습니다</b> — 온나라 연동 전이라 원본 자체가 없고, 결재는 새로 받아야 합니다.</p>' +
            '</div>';
        var foot =
            '<span class="cmp-pull-fields">불러올 항목' +
                fieldCk('title', '문서명') + fieldCk('sr', '수발신자') + fieldCk('date', '보고일자') +
                fieldCk('stages', '업무단계 매핑') + fieldCk('files', '첨부파일') +
            '</span>' +
            '<button class="btn btn-outline" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary"' + (n ? '' : ' disabled') + ' onclick="CMPST.pullRun()">불러오기 (' + n + ')</button>';
        V().openModal(P.from + '년 문서 불러오기 · ' + P.to + '년으로', body, foot);
    }
    function fieldCk(k, label) {
        return '<label class="cmp-pull-ck"><input type="checkbox"' + (P.fields[k] ? ' checked' : '') +
            (k === 'title' ? ' disabled' : '') +
            ' onchange="CMPST.pullField(\'' + k + '\', this.checked)"> ' + esc(label) + '</label>';
    }
    function pullQ(v) { P.q = v; F().rerender(renderPull); }
    function pullSel(id, on) {
        if (pulledInto(id, P.to)) return;               /* 체크박스만 감추면 전역 호출로 뚫린다 */
        if (on) P.sel[id] = 1; else delete P.sel[id]; renderPull();
    }
    function pullAll() {
        pullList().forEach(function (d) { if (!pulledInto(d.id, P.to)) P.sel[d.id] = 1; });
        renderPull();
    }
    function pullNone() { P.sel = {}; renderPull(); }
    function pullField(k, on) { if (k === 'title') return; P.fields[k] = !!on; renderPull(); }
    function pullRun() {
        var ids = Object.keys(P.sel);
        if (!ids.length) { V().toast('불러올 문서를 하나 이상 고르세요.'); return; }
        var ok = 0, skip = 0, fail = '';
        ids.forEach(function (id) {
            var src = D().docById(id); if (!src) return;
            if (pulledInto(id, P.to)) { skip++; return; }   /* 저장 직전에 한 번 더 — 모달이 열린 사이 생겼을 수 있다 */
            var title = String(src.title || '').split(String(P.from)).join(String(P.to));
            /* 업무단계 매핑은 **원본이 걸려 있던 전부**를 물려받는다 — 한 문서가 여러
               할 일의 증빙인데 지금 보고 있는 단계 하나만 남기면 나머지 연결이 끊긴다.
               (참고문서 §7.3 «한 문서가 여러 업무단계에 해당하는 경우») */
            var stages = (P.fields.stages && (src.stageIds || []).length)
                ? src.stageIds.slice()
                : [P.stageId];
            if (stages.indexOf(P.stageId) < 0) stages.push(P.stageId);
            var files = (P.fields.files && (src.files || []).length) ? src.files.slice() : [];
            var r = D().addDocument({
                title: title,
                sr: P.fields.sr ? src.sr : '',
                date: P.fields.date && src.date ? String(src.date).replace(String(P.from), String(P.to)) : P.to + '-01-01',
                year: P.to,
                stageIds: stages,
                files: files,
                src: 'upload',
                dept: myDept(),
                note: P.from + '년 문서(' + id + ')를 불러와 만든 문서 — 업무단계 ' + stages.length + '개' +
                      (files.length ? ' · 첨부 ' + files.length + '건' : ' · 원본에 첨부 없음') +
                      '. 본문·결재문서는 복제하지 않습니다(온나라 연동 전).',
                presetOf: id,
            });
            if (r.ok) ok++; else fail = r.reason;
        });
        V().closeModal(true);
        P = null;
        render();
        var msg = ok ? ok + '건을 ' + S.dyear + '년 문서로 만들었습니다 (메타데이터만 복사).' : (fail || '만들지 못했습니다.');
        if (skip) msg += ' 이미 불러온 ' + skip + '건은 건너뛰었습니다.';
        V().toast(msg);
    }

    /* =========================================================================
     * 비해당 — 사유 없이 저장되지 않는다 (§4-4 · CLAUDE.md §4-2)
     *   최종 거부는 DYDOCS.transition 이 한다. 화면 검사는 사용자 안내용이다.
     * ========================================================================= */
    function openNA(stageId) {
        var s = D().stage(stageId);
        if (!s) return;
        if (!D().canSetNA()) { V().toast('비해당 처리는 주관부서(재난안전과) 담당자만 할 수 있습니다.'); return; }
        V().openModal('비해당 — 사유 기재',
            '<div class="cmp-na">' +
                '<p class="cmp-scode">' + esc(s.id) + '</p>' +
                '<p class="cmp-pull-t">' + esc(s.name) + '</p>' +
                '<div class="form-field">' +
                    '<label class="form-label" for="cmp-na-why">비해당 사유 <b>(필수)</b></label>' +
                    '<textarea class="form-input" id="cmp-na-why" rows="3" placeholder="예: 담양군에 해당 시설이 없어 ' + S.year + '년 적용 대상이 아님"></textarea>' +
                '</div>' +
                '<p class="cmp-cap">중대재해 대응에서는 “미이행”보다 <b>“적용 제외 근거 없음”</b>이 더 위험합니다. ' +
                    '비해당 이력은 기록에 남고 매년 재확인합니다.</p>' +
            '</div>',
            '<button class="btn btn-outline" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" onclick="CMPST.saveNA(\'' + esc(stageId) + '\')">비해당으로 저장</button>');
    }
    function saveNA(stageId) {
        var el = document.getElementById('cmp-na-why');
        var why = el ? el.value.trim() : '';
        if (!why) { V().toast('비해당 사유를 입력해야 저장됩니다.'); return; }
        var r = D().transition(stageId, S.year, D().ST.NA, { reason: why });
        if (!r.ok) { V().toast(r.reason); return; }
        V().closeModal(true);
        render();
        V().toast(D().stage(stageId).name + ' — 비해당으로 저장했습니다.');
    }
    function clearNA(stageId) {
        var r = D().transition(stageId, S.year, D().ST.NONE, {});
        if (!r.ok) { V().toast(r.reason); return; }
        render();
        V().toast('비해당을 해제했습니다.');
    }

    /* =========================================================================
     * ⑥ 누락 점검
     * ========================================================================= */
    /* 해당 연도 문서 0건인 단계 — 비해당은 이미 사유를 댄 것이므로 뺀다 */
    function gapStages() {
        return D().stages().filter(function (s) {
            var j = C().judge(s, S.year);
            return j && (j.key === 'no' || j.key === 'late');
        });
    }
    function gapPane() {
        var list = gapStages().filter(function (s) {
            if (S.axis && C().axesOf(s.itemId).indexOf(S.axis) < 0) return false;
            if (S.dept && !D().stageDeptHit(s, S.dept)) return false;
            if (S.q && !F().match(S.q, [s.id, s.name, s.law, s.target])) return false;
            return true;
        });
        var per = list.filter(function (s) { return C().cycleOf(s).need > 0; }).length;
        var prev = D().presetSourceYear(S.year);
        var twice = prev ? list.filter(function (s) { return D().documentIdsOfStage(s.id, prev).length === 0; }).length : 0;
        var selN = Object.keys(S.gapSel).length;

        var fields = [
            { type: 'search', id: 'cg-q', value: S.q, placeholder: '할 일·법령으로 찾기', on: "CMPST.setF('q', this.value)" },
            { type: 'select', id: 'cg-dp', value: S.dept, label: '부서', options: deptOptions(), on: "CMPST.setF('dept', this.value)" },
        ];
        var bar = F().bar(fields, {
            count: list.length, unit: '개 단계',
            reset: 'CMPST.resetF()',
            actions: axisSeg() +
                (D().canSetNA()
                    ? '<button type="button" class="btn btn-outline btn-sm"' + (selN ? '' : ' disabled') +
                      ' onclick="CMPST.openBulkNA()">일괄 비해당 처리' + (selN ? ' (' + selN + ')' : '') + '</button>'
                    : ''),
        });

        return bar +
            '<div class="cmp-gap-head">' +
                '<p class="cmp-gap-n">미이행 단계 <b>' + list.length + '개</b></p>' +
                '<p class="cmp-cap">정기 ' + per + ' + 상시 ' + (list.length - per) + ' · ' +
                    (prev ? prev + '년에도 문서가 없던 단계 <b>' + twice + '개</b>는 <b>2년 연속</b>으로 표시됩니다.'
                          : '지난연도 비교 자료가 없어 2년 연속 표시는 생략됩니다.') + '</p>' +
            '</div>' +
            (list.length ? gapGroups(list, prev) : '<div class="v2-empty"><b>조건에 맞는 미이행 단계가 없습니다.</b></div>') +
            '<p class="cmp-cap"><b>비해당 처리에는 사유가 반드시 필요합니다.</b> 중대재해 대응에서는 “미이행”보다 ' +
                '“적용 제외 근거 없음”이 더 위험합니다. 비해당 이력은 기록에 남고 매년 재확인합니다.</p>';
    }
    function axisSeg() {
        return '<span class="cmp-seg" role="group" aria-label="법령 축">' + C().AXES.map(function (a) {
            var on = S.axis === a.id;
            return '<button type="button" class="cmp-seg-btn' + (on ? ' is-on' : '') + '"' +
                ' aria-pressed="' + (on ? 'true' : 'false') + '"' +
                ' onclick="CMPST.setF(\'axis\',\'' + a.id + '\')">' + esc(a.label) + '</button>';
        }).join('') + '</span>';
    }
    function gapGroups(list, prev) {
        var by = {}, order = [];
        list.forEach(function (s) {
            if (!by[s.itemId]) { by[s.itemId] = []; order.push(s.itemId); }
            by[s.itemId].push(s);
        });
        return order.map(function (itemId) {
            var it = D().item(itemId) || { id: itemId, name: itemId };
            var g = by[itemId];
            /* 헤더 → 현황 탭의 그 이행항목(D-6). 누락만 보다가 그 항목의 전체 맥락
               (충족한 단계까지)으로 나가는 길이다. 축 칩은 **축 세그먼트와 같은 상태**를
               세팅한다 — 새 필터 축을 만들지 않는다(설계 §3-1). */
            return '<section class="cmp-gap-blk">' +
                '<h3 class="cmp-gap-h">' +
                    '<button type="button" class="cmp-gap-link" onclick="CMPST.openItem(\'' + esc(itemId) + '\')">' +
                        esc(it.name) + ' — ' + g.length + '개 단계 미이행' +
                        '<span class="cmp-gap-go">전체 보기 →</span></button>' +
                    '<span class="cmp-gap-ax">' + C().axesOf(itemId).map(function (a) {
                        return '<button type="button" class="chip-mini wt cmp-ax-btn"' +
                            ' title="' + esc(C().axisLabel(a)) + ' 축만 보기"' +
                            ' onclick="CMPST.setF(\'axis\',\'' + a + '\')">' + esc(C().axisLabel(a)) + '</button>';
                    }).join('') + '</span></h3>' +
                '<div class="cmp-wrap"><table class="table-figma table-compact cmp-table"><tbody>' +
                    g.map(function (s) { return gapRow(s, prev); }).join('') +
                '</tbody></table></div>' +
            '</section>';
        }).join('');
    }
    function gapRow(s, prev) {
        var cy = C().cycleOf(s);
        var j = C().judge(s, S.year);
        var prevN = prev ? D().documentIdsOfStage(s.id, prev).length : null;
        var twice = prev && prevN === 0;
        var can = D().canSetNA();
        return '<tr class="cmp-stg"><td class="cmp-c-ck">' +
                (can ? '<input type="checkbox" aria-label="' + esc(s.name) + ' 선택"' + (S.gapSel[s.id] ? ' checked' : '') +
                    ' onchange="CMPST.gapSel(\'' + esc(s.id) + '\', this.checked)">' : '') +
            '</td>' +
            '<td class="cmp-c-main"><button type="button" class="cmp-slink" onclick="CMPST.openDetail(\'' + esc(s.id) + '\')">' +
                    esc(s.name) + '</button>' +
                '<span class="cmp-scode">' + esc(s.law || '근거 미등록') + ' · ' + esc(cy.label) + '</span>' +
                '<span class="cmp-gap-yr">' + chip(j) +
                    (twice ? ' <span class="chip-status chip-sm danger">□ 2년 연속</span>' : '') +
                    (prev ? ' <span class="cmp-dim">' + prev + '년 ' + prevN + '건 · ' + S.year + '년 ' + j.docs + '건</span>'
                          : ' <span class="cmp-dim">' + S.year + '년 ' + j.docs + '건</span>') +
                '</span></td>' +
            '<td class="cmp-c-act">' +
                /* '해당'의 답은 문서다 — 상세를 거치지 않고 마법사를 바로 열되,
                   단계를 실어 보낸다(맥락은 행이 이미 보여주고 있다) */
                (D().canUpload() ? gapCta(s) + ' ' : '') +
                (can ? '<button type="button" class="btn btn-outline btn-sm" onclick="CMPST.openNA(\'' + esc(s.id) + '\')">비해당 — 사유 기재</button>' : '') +
            '</td></tr>';
    }
    /* 누락 점검 행의 «해당» 버튼 — 발주측 §12 는 [업무 수행]/[결과 등록]/[비해당]
       3종을 요구한다. 유형이 정해진 단계는 그 유형의 말로 부른다. */
    function gapCta(s) {
        var paths = C().pathsOf(s);
        var p = paths[0];
        if (p && p.type === 'PROGRAM' && p.reachable) {
            return '<a class="btn btn-primary btn-sm" href="' + esc(p.func.href) + '">해당 — ' + esc(p.func.name) + ' →</a>';
        }
        if (p && p.type === 'ATTACHMENT') {
            return '<button type="button" class="btn btn-primary btn-sm" onclick="CMPST.openReg(\'' + esc(s.id) + '\')">해당 — 결과 등록</button>';
        }
        if (p && p.type === 'ELECTRONIC_DOC') {
            return '<button type="button" class="btn btn-primary btn-sm" onclick="CMPST.openReg(\'' + esc(s.id) + '\')">해당 — 업무문서 작성</button>';
        }
        return '<button type="button" class="btn btn-primary btn-sm" onclick="CMPST.openReg(\'' + esc(s.id) + '\')">해당 — 문서 등록</button>';
    }
    function gapSel(id, on) { if (on) S.gapSel[id] = 1; else delete S.gapSel[id]; render(); }
    /* 일괄 처리는 **대상 목록과 건수를 반드시 명시**한다(CLAUDE.md §4 CRUD 기준) */
    function openBulkNA() {
        var ids = Object.keys(S.gapSel);
        if (!ids.length) { V().toast('비해당 처리할 단계를 먼저 고르세요.'); return; }
        if (!D().canSetNA()) { V().toast('비해당 처리는 주관부서(재난안전과) 담당자만 할 수 있습니다.'); return; }
        V().openModal('일괄 비해당 처리 · ' + ids.length + '개 단계',
            '<div class="cmp-na">' +
                '<p>아래 <b>' + ids.length + '개 단계</b>를 ' + S.year + '년 <b>비해당</b>으로 저장합니다. 공통 사유 하나가 모든 단계에 같이 기록됩니다.</p>' +
                '<ul class="cmp-bulk-list">' + ids.map(function (id) {
                    var s = D().stage(id); if (!s) return '';
                    return '<li><b>' + esc(s.name) + '</b><span class="cmp-dim">' + esc(s.id) + ' · ' + esc(s.law || '근거 미등록') + '</span></li>';
                }).join('') + '</ul>' +
                '<div class="form-field">' +
                    '<label class="form-label" for="cmp-na-why">공통 비해당 사유 <b>(필수)</b></label>' +
                    '<textarea class="form-input" id="cmp-na-why" rows="3" placeholder="예: 담양군 소관 시설이 없어 ' + S.year + '년 적용 대상 아님"></textarea>' +
                '</div>' +
                '<p class="cmp-cap">사유 없이는 한 건도 저장되지 않습니다. 저장 후에도 단계별로 해제할 수 있습니다.</p>' +
            '</div>',
            '<button class="btn btn-outline" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" onclick="CMPST.saveBulkNA()">' + ids.length + '개 비해당 저장</button>');
    }
    function saveBulkNA() {
        var el = document.getElementById('cmp-na-why');
        var why = el ? el.value.trim() : '';
        if (!why) { V().toast('공통 비해당 사유를 입력해야 저장됩니다.'); return; }
        var ids = Object.keys(S.gapSel), ok = 0, fail = '';
        ids.forEach(function (id) {
            var r = D().transition(id, S.year, D().ST.NA, { reason: why });
            if (r.ok) ok++; else fail = r.reason;
        });
        S.gapSel = {};
        V().closeModal(true);
        render();
        V().toast(ok ? ok + '개 단계를 비해당으로 저장했습니다.' : (fail || '저장하지 못했습니다.'));
    }

    /* =========================================================================
     * 페이지 제목 줄 — 기준연도는 조회 조건이 아니라 화면 전체의 맥락이다
     * ========================================================================= */
    function injectHead() {
        var host = document.querySelector('.dy-page-title');
        if (!host) return;
        var old = host.querySelector('.page-head-action');
        if (old) old.remove();
        var wrap = document.createElement('div');
        wrap.className = 'page-head-action cmp-headact';
        wrap.innerHTML =
            '<label class="cmp-yr"><span>기준연도</span>' +
                '<select class="form-select" aria-label="기준연도" onchange="CMPST.setF(\'year\', this.value)">' +
                    F().optionsHtml(C().years().map(function (y) { return [y, y + '년']; }), S.year) + '</select></label>' +
            (D().canUpload()
                ? '<button type="button" class="btn btn-primary btn-sm" onclick="DOCUP.open(' + S.year + ')">＋ 서류 올리기</button>'
                : '<span class="cmp-ro">조회 전용</span>');
        host.appendChild(wrap);
    }

    /* =========================================================================
     * 전역 진입점
     * ========================================================================= */
    function setF(k, v) {
        if (k === 'year') { S.year = +v || D().defaultYear(); S.dyear = S.year; }
        else S[k] = v;
        rerender();
    }
    function resetF() { S.q = ''; S.cycle = ''; S.st = ''; S.axis = ''; S.dept = ''; S.facCls = ''; S.way = ''; rerender(); }
    function setTab(t) { S.tab = t; S.detail = ''; render(); }
    function setLevel(l) { S.level = l; S.st = ''; S.q = ''; render(); }
    function setSeg(k, v) { S[k] = v; render(); }
    function toggleItem(id) {
        var cur = S.open[id];
        if (cur === undefined) {
            /* 기본값(지연·미이행 있으면 펼침)의 반대로 뒤집는다 — 저장값만 보면 첫 클릭이 먹지 않는다 */
            var g = D().stagesOfItem(id).filter(stageMatch);
            var open = g.some(function (s) { var j = C().judge(s, S.year); return j && (j.key === 'no' || j.key === 'late'); });
            S.open[id] = !open;
        } else S.open[id] = !cur;
        render();
    }
    function toggleLaw(id) { S.law[id] = !S.law[id]; render(); }
    function setDetailYear(y) { S.dyear = +y || S.year; render(); }
    /* 등록 마법사 — 단계 프리필. 연도는 지금 보고 있는 연도(상세면 상세 연도) */
    function openReg(stageId) {
        var y = S.detail ? (S.dyear || S.year) : S.year;
        global.DOCUP.open(y, { stageIds: [stageId] });
    }
    /* 행 클릭 — 행 안의 버튼·링크·체크박스가 눌린 것이면 양보한다 */
    function rowOpen(e, stageId) {
        if (e && e.target && e.target.closest && e.target.closest('a, input, label')) return;
        openDetail(stageId);
    }
    /* 부서 행 → 그 부서의 할 일 목록(D-1). 부서명 셀의 버튼은 행과 같은 동작이라
       양보하지 않는다(키보드 경로 역할) — 문서 건수 링크만 비켜 준다. */
    /* 누락 점검 그룹 헤더 → 현황 탭에서 그 이행항목의 **전체 단계**로(D-6).
     * 미이행만 보다가 충족한 것까지 함께 보는 맥락으로 나가는 길이다.
     *
     * 계층만 맞추면 안 된다 — L2·L3 는 보기(세그먼트)가 갈려 있어서 부서 표·시설
     * 표가 그려지면 단계가 한 줄도 안 보인다(구현 중 실제로 낸 결함). 그래서
     * ① 계층 ② 단계가 보이는 보기 ③ 그 항목만 남기는 조회 조건 셋을 함께 맞춘다.
     *
     * 조건은 **기존 검색창**에 항목 코드를 넣어 건다 — 새 필터 축을 만들지 않으면
     * '무엇이 걸렸나'가 검색창에서 읽히고 지우면 전체로 돌아온다(설계 §3-1). */
    function openItem(itemId) {
        var first = D().stagesOfItem(itemId)[0];
        var it = D().item(itemId) || { name: itemId };
        if (first) S.level = C().levelOf(first).level;
        S.tab = 'status';
        S.seg2 = 'stage'; S.seg3 = 'stage';
        S.open[itemId] = true;
        S.q = itemId; S.st = '';
        render();
        try { window.scrollTo(0, 0); } catch (e) {}
        V().toast(it.name + ' — 이 의무의 할 일 전체를 봅니다. 검색창을 비우면 전체 목록으로 돌아갑니다.');
    }
    function openDept(e, name) {
        if (e && e.target && e.target.closest && e.target.closest('a')) return;
        S.dept = name;
        S.seg2 = 'stage';
        S.q = '';
        render();
        try { window.scrollTo(0, 0); } catch (err) {}
        V().toast(name + ' — 그 부서에 적용되는 할 일 목록입니다.');
    }

    function init(mount) {
        S.mount = mount;
        readURL();
        if (!S.dyear) S.dyear = S.year;
        window.addEventListener('popstate', function () { readURL(); render(); });
        render();
    }

    global.CMPST = {
        init: init, render: render,
        setF: setF, resetF: resetF, setTab: setTab, setLevel: setLevel, setSeg: setSeg,
        toggleItem: toggleItem, toggleLaw: toggleLaw,
        openDetail: openDetail, closeDetail: closeDetail, setDetailYear: setDetailYear, rowOpen: rowOpen,
        openDept: openDept, openItem: openItem,
        openPull: openPull, pullQ: pullQ, pullSel: pullSel, pullAll: pullAll, pullNone: pullNone,
        pullField: pullField, pullRun: pullRun,
        openNA: openNA, saveNA: saveNA, clearNA: clearNA, openReg: openReg,
        gapSel: gapSel, openBulkNA: openBulkNA, saveBulkNA: saveBulkNA,
        state: S,
    };
}(window));
