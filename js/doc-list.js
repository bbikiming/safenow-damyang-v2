/* =========================================================================
 * 업무 목록 (docs-preset.html) — 평면 문서 검색 (전역 DOCLIST)
 *   기획: docs/planning/기획-업무문서-이행목록-업무목록-UX설계-v1.md §8 (UF-07·08)
 *
 *   목록 1행 = 문서 1건. 카드형·세트형·PDCA 그룹형을 쓰지 않는다.
 *   모집단 4,256 = 2025 원장 3,830 + 현행 업무문서 426 + 사용자 등록분.
 *
 *   [성능] 매 키 입력마다 4,256행을 DOM 에 만들지 않는다 — 검색은 미리 만든
 *   소문자 blob 을 훑고, 그리는 것은 현재 페이지(20/50/100행)뿐이다.
 *
 *   [상태는 상세필터에만] 출처에 따라 상태 도메인이 달라지므로 빠른필터에 둘 수
 *   없다. 같은 축을 두 컨트롤로 물으면 어느 쪽이 적용된 건지 알 수 없다(§14-12).
 * ========================================================================= */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYDOCS; };
    var F = function () { return global.EDUFILTER; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }

    var S = {
        mount: null,
        q: '', year: '', src: '', from: '', to: '',
        item: '', stage: '', law: '', cycle: '', collect: '', target: '', actor: '',
        dept: '', assignee: '', sr: '', hasFile: '', hasPdf: '', mapping: '', menu: '',
        status: '',
        adv: false,
        sort: 'date-desc', page: 1, size: 20,
        expand: {},          /* docId → 업무단계 전체 펼침 */
    };

    /* 상세필터 정의 — 칩 라벨·해제를 한 곳에서 만든다(개별 해제 누락 방지) */
    var CHIPS = [
        ['q', '검색어'], ['year', '연도'], ['src', '출처'], ['status', '상태'],
        ['from', '보고일 시작'], ['to', '보고일 끝'],
        ['item', '어떤 의무'], ['stage', '무슨 일'], ['law', '법 조문'],
        ['cycle', '주기'], ['collect', '2025년 취합'], ['target', '적용대상'], ['actor', '담당 주체'],
        ['dept', '담당부서'], ['assignee', '담당자'], ['sr', '상대 기관'],
        ['hasFile', '첨부'], ['hasPdf', '공문 지면'], ['mapping', '의무 연결'], ['menu', '분야'],
    ];

    /* =========================================================================
     * 검색 인덱스 — 문서마다 한 번만 만든다
     * ========================================================================= */
    var _idx = null;
    function idx() {
        if (_idx) return _idx;
        _idx = D().allDocs().map(function (d) {
            var st = d.stageIds.map(D().stage).filter(Boolean);
            var items = {}, laws = [], cycles = [], collects = [], targets = [], actors = [];
            st.forEach(function (s) {
                items[s.itemId] = 1;
                if (s.law) laws.push(s.law);
                if (s.opCycle) cycles.push(s.opCycle);
                if (s.collect) collects.push(s.collect);
                if (s.target) targets.push(s.target);
                if (s.actor) actors.push(s.actor);
            });
            var itemIds = Object.keys(items);
            var itemNames = itemIds.map(function (i) { var it = D().item(i); return it ? it.name : ''; });
            return {
                d: d, stages: st, itemIds: itemIds,
                laws: laws, cycles: cycles, collects: collects, targets: targets, actors: actors,
                blob: [d.title, d.sr, d.assignee, d.dept, d.id]
                    .concat(itemNames).concat(st.map(function (s) { return s.name + ' ' + s.id; }))
                    .join(' ').toLowerCase(),
            };
        });
        return _idx;
    }
    function dropIdx() { _idx = null; }

    /* =========================================================================
     * URL 상태
     * ========================================================================= */
    var URLK = ['q', 'year', 'src', 'status', 'from', 'to', 'item', 'stage', 'law', 'cycle',
                'collect', 'target', 'actor', 'dept', 'assignee', 'sr', 'hasFile', 'hasPdf',
                'mapping', 'menu', 'sort', 'size'];
    function readURL() {
        var p = new URLSearchParams(location.search);
        /* 먼저 비운다 — URL 에 없는 키를 그대로 두면 재진입 때 옛 조건이 쌓여
           "링크로 들어왔는데 엉뚱한 필터가 걸려 있다"가 된다. */
        CHIPS.forEach(function (c) { S[c[0]] = ''; });
        S.adv = false; S.page = 1; S.expand = {};
        URLK.forEach(function (k) { var v = p.get(k); if (v != null) S[k] = v; });
        S.size = +S.size || 20;
        S.page = +p.get('page') || 1;
        /* 구 딥링크 ?ver= 는 분류 버전 토글이 폐기돼 뜻이 없다 — 조용히 무시한다.
           ?menu= 는 현행 업무문서 426건이 menuKey 를 그대로 갖고 있으므로 살린다
           (stats.html 의 9개 대메뉴 링크가 전부 같은 목록으로 떨어지지 않게). */
        if (S.stage && !D().stage(S.stage)) S.stage = '';
        if (S.item && !D().item(S.item)) S.item = '';
        if (S.stage) { var st = D().stage(S.stage); if (st) S.item = st.itemId; }
        if (S.law || S.cycle || S.collect || S.target || S.actor || S.dept ||
            S.assignee || S.sr || S.hasFile || S.hasPdf || S.mapping || S.item) S.adv = true;
    }
    function syncURL() {
        var p = new URLSearchParams();
        URLK.forEach(function (k) { if (S[k] && !(k === 'sort' && S[k] === 'date-desc') && !(k === 'size' && +S[k] === 20)) p.set(k, S[k]); });
        if (S.page > 1) p.set('page', S.page);
        var qs = p.toString();
        try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '')); } catch (e) {}
    }

    /* =========================================================================
     * 조회
     * ========================================================================= */
    function match(r) {
        var d = r.d;
        if (S.q && r.blob.indexOf(S.q.toLowerCase()) < 0) return false;
        if (S.year && d.year !== +S.year) return false;
        if (S.src && d.src !== S.src) return false;
        if (S.status && d.status !== S.status) return false;
        if (S.from && (!d.date || d.date < S.from)) return false;
        if (S.to && (!d.date || d.date > S.to)) return false;
        if (S.menu && d.menuKey !== S.menu) return false;
        if (S.item && r.itemIds.indexOf(S.item) < 0) return false;
        if (S.stage && d.stageIds.indexOf(S.stage) < 0) return false;
        if (S.law && r.laws.every(function (l) { return l.indexOf(S.law) < 0; })) return false;
        if (S.cycle && r.cycles.indexOf(S.cycle) < 0) return false;
        if (S.collect && r.collects.indexOf(S.collect) < 0) return false;
        if (S.target && r.targets.indexOf(S.target) < 0) return false;
        if (S.actor && r.actors.indexOf(S.actor) < 0) return false;
        if (S.dept && d.dept !== S.dept) return false;
        if (S.assignee && d.assignee !== S.assignee) return false;
        if (S.sr && (d.sr || '') !== S.sr) return false;
        if (S.hasFile === 'y' && !(d.files || []).length) return false;
        if (S.hasFile === 'n' && (d.files || []).length) return false;
        if (S.hasPdf === 'y' && !pdfOf(d)) return false;
        if (S.hasPdf === 'n' && pdfOf(d)) return false;
        /* '미분류'는 **원장에서 분류가 빠진 34건**이지, 이행항목 축이 애초에 없는
           현행 업무문서 426건이 아니다. 둘을 합치면 이행 목록의 '미분류 34건'
           링크가 460건으로 열려 교정 대상이 무엇인지 알 수 없게 된다. */
        if (S.mapping === 'mapped' && !d.mapped) return false;
        if (S.mapping === 'unmapped' && !(d.origin === 'ledger' && !d.mapped)) return false;
        if (S.mapping === 'noaxis' && d.origin !== 'v2') return false;
        return true;
    }
    function view() {
        var list = idx().filter(match);
        var dir = S.sort.indexOf('-desc') > 0 ? -1 : 1;
        var key = S.sort.split('-')[0];
        list.sort(function (a, b) {
            var x = key === 'title' ? a.d.title : a.d.date || '';
            var y = key === 'title' ? b.d.title : b.d.date || '';
            return x < y ? -dir : x > y ? dir : 0;
        });
        var pages = Math.max(1, Math.ceil(list.length / S.size));
        if (S.page > pages) S.page = pages;
        return { list: list, total: list.length, pages: pages,
                 rows: list.slice((S.page - 1) * S.size, S.page * S.size) };
    }

    /* 온나라 PDF — 실제 상신 산출물이 있을 때만 연다.
     * 시연 상태가 '온나라'라는 이유만으로 가짜 링크를 만들지 않는다(§8-8). */
    function pdfOf(d) {
        if (d.src !== 'onnara') return null;
        if (d.onnaraSid) return d.onnaraSid;                 /* 사용자 상신분 */
        return null;
    }

    /* =========================================================================
     * 렌더
     * ========================================================================= */
    function render() {
        if (!S.mount) return;
        syncURL();
        injectHeadActions();
        var res = view();
        S.mount.innerHTML = notice() + quickBar(res) + advPanel() + chipRow() + toolRow(res) + table(res) + pager(res);
    }
    function rerender() { F().rerender(render); }

    function notice() {
        var docs = D().allDocs();
        var led = docs.filter(function (d) { return d.origin === 'ledger'; }).length;
        var v2 = docs.filter(function (d) { return d.origin === 'v2'; }).length;
        var user = docs.length - led - v2;
        var lead = '<b>문서 ' + docs.length.toLocaleString() + '건</b> · 2025 원장 ' + led.toLocaleString() +
            ' · 현행 업무문서 ' + v2 + (user ? ' · 등록분 ' + user : '');
        var rest =
            '<p><b>문서를 찾는 화면</b>입니다. 온나라·전자문서·직접 첨부·전용 화면 업무를 한곳에서 봅니다. ' +
            '어느 의무가 아직 안 됐는지는 <a href="docs-exec.html">이행 목록</a>에서 봅니다.</p>' +
            '<p class="dx-note-gap">2025년 자료는 <b>재난안전과가 주고받은 공문 기록</b>이라 담당자 칸이 비어 있고, ' +
            '수발신자는 전라남도 같은 <b>상대 기관</b>입니다. 출처·상태는 <b>시연용 값</b>입니다.</p>';
        return V().notice('docs-preset', lead, rest);
    }

    /* 빠른필터 — 연도·출처·기간. 상태는 여기 두지 않는다(출처 종속) */
    function quickBar(res) {
        return F().bar([
            { type: 'search', id: 'dl-q', value: S.q, placeholder: '문서명·수발신자·담당자·이행항목·업무단계', on: "DOCLIST.setF('q', this.value)" },
            { type: 'select', id: 'dl-year', value: S.year, label: '기준연도', options: yearOpts(), on: "DOCLIST.setF('year', this.value)" },
            { type: 'select', id: 'dl-src', value: S.src, label: '문서 출처', options: srcOpts(), on: "DOCLIST.setF('src', this.value)" },
        ], {
            count: res.total.toLocaleString(), unit: '건',
            reset: 'DOCLIST.resetF()',
            actions: '<button type="button" class="btn btn-outline btn-sm" aria-expanded="' + (S.adv ? 'true' : 'false') +
                '" aria-controls="dl-adv" onclick="DOCLIST.toggleAdv()">상세 조건 ' + (S.adv ? '▴' : '▾') + '</button>',
        });
    }
    function yearOpts() {
        var seen = {};
        D().allDocs().forEach(function (d) { if (d.year) seen[d.year] = 1; });
        return [['', '연도 전체']].concat(Object.keys(seen).sort().reverse().map(function (y) { return [y, y + '년']; }));
    }
    function srcOpts() {
        return [['', '출처 전체']].concat(D().SRC_ORDER.map(function (k) { return [k, D().SRC[k].label]; }));
    }
    /* 상태 옵션은 선택한 출처에 따라 바뀐다 — 서로 다른 출처의 상태를 하나의
       거짓된 공통 단계로 환산하지 않는다(§8-7). */
    function statusOpts() {
        if (S.src) return [['', '상태 전체']].concat(D().SRC[S.src].status.map(function (s) { return [s, s]; }));
        var all = [];
        D().SRC_ORDER.forEach(function (k) {
            D().SRC[k].status.forEach(function (s) { if (all.indexOf(s) < 0) all.push(s); });
        });
        return [['', '상태 전체 — 출처를 고르면 그것만']].concat(all.map(function (s) { return [s, s]; }));
    }

    /* 상세필터는 모달이 아니라 **페이지 안에서** 펼친다(§8-5) */
    function advPanel() {
        if (!S.adv) return '';
        /* 이행항목 78 · 업무단계 168 은 드롭다운으로 고를 양이 아니다.
           채용 사이트의 직무 선택처럼 2단 트리 + 칸별 검색으로 낸다(DYPICK). */
        var tree =
            '<div class="dl-adv-tree">' +
                '<div class="dl-adv-tree-h">어떤 법정 의무의 문서인가요' +
                    (S.item || S.stage ? '<button type="button" class="du-link" onclick="DOCLIST.clearTree()">고른 것 지우기</button>' : '') +
                '</div>' +
                global.DYPICK.render({
                    ns: 'DOCLIST.onTree', multi: false,
                    item: S.item, stages: S.stage ? [S.stage] : [], height: 200,
                }) +
            '</div>';
        return '<div class="dl-adv" id="dl-adv">' + tree +
            '<div class="dl-adv-grid">' +
                f('상태', selHtml('dl-status', S.status, statusOpts(), "DOCLIST.setF('status', this.value)")) +
                f('법정 의무 연결', selHtml('dl-mapping', S.mapping, [['', '전체'], ['mapped', '연결됨'],
                    ['unmapped', '연결 안 됨 — 지정 필요'], ['noaxis', '이 목록 밖 문서']],
                    "DOCLIST.setF('mapping', this.value)")) +
                f('담당부서', selHtml('dl-dept', S.dept, docOpts('dept', '담당부서 전체'), "DOCLIST.setF('dept', this.value)")) +
                f('첨부', selHtml('dl-hasFile', S.hasFile, [['', '전체'], ['y', '있음'], ['n', '없음']], "DOCLIST.setF('hasFile', this.value)")) +
                f('보고일 시작', '<input type="date" class="form-input" value="' + esc(S.from) + '" onchange="DOCLIST.setF(\'from\', this.value)">') +
                f('보고일 끝', '<input type="date" class="form-input" value="' + esc(S.to) + '" onchange="DOCLIST.setF(\'to\', this.value)">') +
            '</div>' +
            /* 나머지는 한 겹 더 접는다 — 14개를 한 번에 늘어놓으면 벽이 된다.
               값이 걸려 있으면 자동으로 펼쳐 숨은 조건 때문에 결과가 이상해 보이는 일을 막는다. */
            moreBlock() +
            '<p class="dl-adv-note">담당 칸은 <b>새로 올린 문서</b>에만 값이 있습니다.</p>' +
        '</div>';
    }
    function moreOn() { return !!(S.law || S.cycle || S.collect || S.target || S.actor || S.sr || S.hasPdf || S.assignee); }
    function moreBlock() {
        var open = S.more || moreOn();
        var n = [S.law, S.cycle, S.collect, S.target, S.actor, S.sr, S.hasPdf, S.assignee].filter(Boolean).length;
        return '<button type="button" class="dl-more-btn" aria-expanded="' + (open ? 'true' : 'false') +
                '" aria-controls="dl-more" onclick="DOCLIST.toggleMore()">그 밖의 조건 ' + (open ? '▴' : '▾') +
                (n ? ' <b>' + n + '</b>' : '') + '</button>' +
            (open
                ? '<div class="dl-adv-grid" id="dl-more">' +
                    f('담당자', selHtml('dl-assignee', S.assignee, docOpts('assignee', '담당자 전체'), "DOCLIST.setF('assignee', this.value)")) +
                    f('상대 기관 <span class="dl-f-n">325</span>', combo('dl-sr', S.sr, docOpts('sr', '').map(function (o) { return [o[0], o[0] || '']; }), 'sr', '기관 이름으로 찾기')) +
                    f('법 조문', combo('dl-law', S.law, uniqOpts('laws', '').map(function (o) { return [o[0], o[0] || '']; }), 'law', '법 이름으로 찾기')) +
                    f('얼마나 자주', selHtml('dl-cycle', S.cycle, uniqOpts('cycles', '주기 전체'), "DOCLIST.setF('cycle', this.value)")) +
                    f('2025년 취합', selHtml('dl-collect', S.collect, uniqOpts('collects', '취합 전체'), "DOCLIST.setF('collect', this.value)")) +
                    f('어디에 적용', selHtml('dl-target', S.target, uniqOpts('targets', '적용대상 전체'), "DOCLIST.setF('target', this.value)")) +
                    f('누가 하나', selHtml('dl-actor', S.actor, uniqOpts('actors', '담당 주체 전체'), "DOCLIST.setF('actor', this.value)")) +
                    f('공문 지면', selHtml('dl-hasPdf', S.hasPdf, [['', '전체'], ['y', '있음'], ['n', '없음']], "DOCLIST.setF('hasPdf', this.value)")) +
                  '</div>'
                : '');
    }
    /* label 은 신뢰된 내부 문자열이다(옵션 개수 배지 때문에 HTML 을 받는다) */
    function f(label, inner) { return '<label class="dl-f"><span>' + label + '</span>' + inner + '</label>'; }
    function selHtml(id, v, opts, on, disabled) {
        return '<select class="form-select" id="' + id + '"' + (disabled ? ' disabled' : '') +
            ' onchange="' + on + '">' + F().optionsHtml(opts, v) + '</select>';
    }
    /* 옵션이 많은 축(이행항목 78 · 법령근거 118 · 수발신자 326)은 <select> 로 두면
       스크롤로 찾으라는 말이 된다. 타이핑으로 좁히는 콤보박스(input+datalist)로 낸다.
       값은 라벨이 아니라 **키**로 저장하므로 라벨→키 역인덱스를 함께 만든다. */
    function comboHtml(id, v, opts, setter, placeholder) {
        var cur = '';
        opts.forEach(function (o) { if (String(o[0]) === String(v)) cur = o[1]; });
        return '<input type="text" class="form-input" id="' + id + '" list="' + id + '-dl"' +
            ' value="' + esc(cur) + '" placeholder="' + esc(placeholder || '입력해 좁히기') + '"' +
            ' autocomplete="off" onchange="DOCLIST.pickCombo(\'' + id + '\',\'' + setter + '\', this.value)">' +
            '<datalist id="' + id + '-dl">' +
                opts.filter(function (o) { return o[0] !== ''; })
                    .map(function (o) { return '<option value="' + esc(o[1]) + '"></option>'; }).join('') +
            '</datalist>';
    }
    /* 라벨로 고른 값을 키로 되돌린다 — 빈 문자열이면 조건 해제 */
    var _comboOpts = {};
    function pickCombo(id, key, label) {
        var opts = _comboOpts[id] || [];
        if (!String(label).trim()) { setF(key, ''); return; }
        var hit = opts.filter(function (o) { return o[1] === label; })[0];
        if (!hit) { V().toast('목록에 없는 값입니다 — 입력하면 후보가 좁혀집니다.'); return; }
        setF(key, hit[0]);
    }
    function combo(id, v, opts, setter, placeholder) {
        _comboOpts[id] = opts;
        return comboHtml(id, v, opts, setter, placeholder);
    }
    function uniqOpts(key, all) {
        var seen = {};
        idx().forEach(function (r) { r[key].forEach(function (v) { if (v) seen[v] = 1; }); });
        return [['', all]].concat(Object.keys(seen).sort().map(function (v) { return [v, v]; }));
    }
    function docOpts(key, all) {
        var seen = {};
        D().allDocs().forEach(function (d) { if (d[key]) seen[d[key]] = 1; });
        return [['', all]].concat(Object.keys(seen).sort().map(function (v) { return [v, v]; }));
    }

    /* 적용 중인 조건 칩 — 패널을 접어도 보이고 개별 해제할 수 있어야 한다 */
    function chipRow() {
        var on = CHIPS.filter(function (c) { return S[c[0]]; });
        if (!on.length) return '';
        return '<div class="dl-chips">' +
            on.map(function (c) {
                return '<span class="dl-chip">' + esc(c[1]) + ' <b>' + esc(chipVal(c[0])) + '</b>' +
                    '<button type="button" aria-label="' + esc(c[1]) + ' 조건 해제" onclick="DOCLIST.setF(\'' + c[0] + '\',\'\')">×</button></span>';
            }).join('') +
            '<button type="button" class="du-link" onclick="DOCLIST.resetF()">전체 초기화</button>' +
        '</div>';
    }
    function chipVal(k) {
        var v = S[k];
        if (k === 'src') return D().SRC[v] ? D().SRC[v].label : v;
        if (k === 'item') { var i = D().item(v); return i ? i.name : v; }
        if (k === 'stage') { var s = D().stage(v); return s ? s.name : v; }
        if (k === 'mapping') return v === 'mapped' ? '연결됨' : v === 'noaxis' ? '이 목록 밖' : '연결 안 됨';
        if (k === 'hasFile' || k === 'hasPdf') return v === 'y' ? '있음' : '없음';
        if (k === 'menu') { var m = (global.DY_MENUS_V2 || {})[v]; return m ? m.label : v; }
        return v;
    }

    function toolRow(res) {
        return '<div class="dl-tools">' +
            '<span class="dy-count">' + res.total.toLocaleString() + '건' +
                (res.pages > 1 ? ' <span class="dl-dim">· ' + res.pages + '페이지</span>' : '') + '</span>' +
            '<label class="dl-sort"><span>정렬</span>' +
                selHtml('dl-sort', S.sort, [
                    ['date-desc', '보고일자 최신순'], ['date-asc', '보고일자 오래된순'],
                    ['title-asc', '문서명 가나다순'], ['title-desc', '문서명 역순'],
                ], "DOCLIST.setF('sort', this.value)") + '</label>' +
            '<label class="dl-size"><span>한 쪽에</span>' +
                selHtml('dl-size', S.size, [[20, '20건'], [50, '50건'], [100, '100건']], "DOCLIST.setF('size', this.value)") + '</label>' +
        '</div>';
    }

    function table(res) {
        if (!res.total) {
            return '<div class="v2-empty"><b>조건에 맞는 문서가 없습니다.</b><br>' +
                '조건을 지우면 ' + D().allDocs().length.toLocaleString() + '건이 모두 나옵니다.' +
                '<div style="margin-top:10px;"><button class="btn btn-outline btn-sm" onclick="DOCLIST.resetF()">조건 초기화</button></div>' +
            '</div>';
        }
        /* 가로 스크롤 래퍼는 화면별 클래스가 관례다(.sh-wrap·.edu-scroll·.wk-scroll…).
           공용 .table-scroll 은 존재하지 않으므로 만들어 쓰지 않는다. */
        /* 10열이면 1280px 본문(961px)에서 220px 가 가려지고, 하필 가장 오른쪽이
           [관리] 액션이었다. 정보를 버리지 않고 **합친다** —
             · 수발신자 → 문서명 아래 줄
             · 이행항목 + 업무단계 → 한 칸(단계가 항목을 함축한다)
           8열이 되어 가로 스크롤 없이 들어온다. */
        return '<div class="dl-wrap"><table class="table-figma table-compact dl-table"><thead><tr>' +
            '<th>문서명 / 상대 기관</th><th>출처</th><th>상태</th><th>어떤 의무 · 무슨 일</th>' +
            '<th>담당</th><th>보고일자</th><th>첨부</th>' +
            '<th class="col-action">관리</th>' +
        '</tr></thead><tbody>' + res.rows.map(row).join('') + '</tbody></table></div>';
    }

    function row(r) {
        var d = r.d;
        var items = r.itemIds.map(D().item).filter(Boolean);
        var pdf = pdfOf(d);
        var files = (d.files || []).length;
        return '<tr id="dl-' + esc(d.id) + '">' +
            '<td class="dl-c-title"><a href="doc-detail.html?id=' + esc(d.id) + '&back=' + encodeURIComponent(location.search) + '">' +
                esc(d.title) + '</a>' +
                (d.nearDup ? ' <span class="chip-status chip-sm warning">중복 의심</span>' : '') +
                /* 현행 업무문서(v2)는 세트 축이라 이행항목 매핑이 애초에 없다 —
                   '미분류' 배지를 붙이면 교정해야 할 것처럼 읽힌다 */
                (d.origin === 'ledger' && !d.mapped ? ' <span class="chip-status chip-sm warning">의무 연결 필요</span>' : '') +
                '<span class="dl-sr">' + (d.sr ? esc(d.sr) : '<span class="dx-nodoc">상대 기관 미기재</span>') + '</span>' +
            '</td>' +
            '<td><span class="chip-status chip-sm ' + V().toneOf(D().SRC[d.src] ? D().SRC[d.src].label : '') + '">' +
                esc(D().SRC[d.src] ? D().SRC[d.src].label : d.src) + '</span></td>' +
            '<td><span class="chip-status chip-sm ' + V().toneOf(d.status) + '">' + esc(d.status) + '</span></td>' +
            '<td class="dl-c-stage">' +
                (items.length
                    ? '<span class="dl-item-name">' + esc(items[0].name) +
                      (items.length > 1 ? ' <span class="dl-more-n">외 ' + (items.length - 1) + '개</span>' : '') + '</span>'
                    : '') +
                stageCell(r) +
            '</td>' +
            '<td>' + (d.dept ? esc(d.dept) + (d.assignee ? ' / ' + esc(d.assignee) : '')
                : '<span class="dx-nodoc">기록 없음</span>') + '</td>' +
            '<td class="dl-c-date">' + esc(d.date || '—') + '</td>' +
            '<td class="dl-c-file">' +
                (files ? '<span class="dl-att">첨부 ' + files + '</span>' : '<span class="dx-nodoc">—</span>') +
                (pdf ? ' <span class="dl-att">PDF</span>' : '') +
            '</td>' +
            '<td class="col-action">' + actionBtn(d, pdf) + fixBtn(d) + '</td>' +
        '</tr>';
    }
    /* 여러 단계면 대표 1개 + 외 N개, 클릭 시 그 행 안에서 인라인 펼침 */
    function stageCell(r) {
        if (!r.stages.length) {
            return r.d.origin === 'v2'
                ? '<span class="dx-nodoc">' + esc((global.DY_MENUS_V2 || {})[r.d.menuKey] ? global.DY_MENUS_V2[r.d.menuKey].label + ' 분야' : '—') + '</span>'
                : '<span class="dx-nodoc">연결 안 됨</span>';
        }
        if (r.stages.length === 1) return esc(r.stages[0].name);
        if (S.expand[r.d.id]) {
            return '<ul class="dl-stages">' + r.stages.map(function (s) {
                return '<li><a href="docs-exec.html?stage=' + esc(s.id) + '&year=' + r.d.year + '">' + esc(s.id) + ' ' + esc(s.name) + '</a></li>';
            }).join('') + '</ul>' +
            '<button type="button" class="du-link" onclick="DOCLIST.toggle(\'' + esc(r.d.id) + '\')">접기 ▴</button>';
        }
        return esc(r.stages[0].name) +
            ' <button type="button" class="dl-more" onclick="DOCLIST.toggle(\'' + esc(r.d.id) + '\')">외 ' +
            (r.stages.length - 1) + '개 ▾</button>';
    }
    /* 출처마다 다음 행동이 다르다 — 라벨을 '확인'으로 뭉뚱그리지 않는다 */
    function actionBtn(d, pdf) {
        var href = 'doc-detail.html?id=' + esc(d.id) + '&back=' + encodeURIComponent(location.search);
        if (d.src === 'onnara') {
            return pdf
                ? '<a class="btn btn-sm btn-outline" href="' + href + '&pdf=1">PDF 보기</a>'
                : '<button class="btn btn-sm btn-outline" disabled title="온나라 연동 후 제공됩니다">PDF 없음</button>';
        }
        if (d.src === 'electronic') return '<a class="btn btn-sm btn-outline" href="' + href + '">문서 보기</a>';
        if (d.src === 'program') return '<a class="btn btn-sm btn-outline" href="' + href + '">화면 이동</a>';
        return '<a class="btn btn-sm btn-outline" href="' + href + '">미리보기</a>';
    }

    /* 표시만 하고 끝내지 않는다 — 교정 대상에는 손댈 수단을 함께 둔다 */
    function fixBtn(d) {
        if (!D().isManager()) return '';
        if (d.origin === 'ledger' && !d.mapped) {
            return ' <button class="btn btn-sm btn-secondary" onclick="DOCLIST.openRemap(\'' + esc(d.id) + '\')">단계 지정</button>';
        }
        if (d.nearDup) {
            return ' <button class="btn btn-sm btn-secondary" onclick="DOCLIST.mergeDup(\'' + esc(d.id) + '\')">중복 정리</button>';
        }
        return '';
    }

    function pager(res) {
        if (res.pages <= 1) return '';
        var cur = S.page, out = [];
        function btn(n, label, dis) {
            return '<button type="button" class="dl-pg' + (n === cur ? ' is-on' : '') + '"' +
                (dis ? ' disabled' : '') + ' onclick="DOCLIST.go(' + n + ')"' +
                (n === cur ? ' aria-current="page"' : '') + '>' + (label || n) + '</button>';
        }
        out.push(btn(cur - 1, '← 이전', cur <= 1));
        var s = Math.max(1, cur - 2), e = Math.min(res.pages, s + 4);
        s = Math.max(1, e - 4);
        if (s > 1) { out.push(btn(1)); if (s > 2) out.push('<span class="dl-pg-gap">…</span>'); }
        for (var i = s; i <= e; i++) out.push(btn(i));
        if (e < res.pages) { if (e < res.pages - 1) out.push('<span class="dl-pg-gap">…</span>'); out.push(btn(res.pages)); }
        out.push(btn(cur + 1, '다음 →', cur >= res.pages));
        return '<nav class="dl-pager" aria-label="문서 목록 페이지">' + out.join('') + '</nav>';
    }

    function injectHeadActions() {
        var host = document.querySelector('.dy-page-title');
        if (!host) return;
        var old = host.querySelector('.page-head-action');
        if (old) old.remove();
        if (!D().canUpload()) return;
        var wrap = document.createElement('div');
        wrap.className = 'page-head-action dx-headact';
        wrap.innerHTML = '<button class="btn btn-primary btn-sm" onclick="DOCUP.open()">＋ 업무 업로드</button>';
        host.appendChild(wrap);
    }

    /* ── 전역 진입점 ── */
    function setF(k, v) {
        S[k] = v;
        if (k === 'item') S.stage = '';           /* 종속 필터 초기화 */
        if (k === 'src') S.status = '';           /* 상태 도메인이 바뀐다 */
        if (k === 'size') S.size = +v || 20;
        if (k !== 'sort' && k !== 'size') S.page = 1;
        rerender();
    }
    function resetF() {
        CHIPS.forEach(function (c) { S[c[0]] = ''; });
        S.page = 1;
        rerender();
    }
    function toggleAdv() { S.adv = !S.adv; render(); }
    function toggleMore() { S.more = !(S.more || moreOn()); if (!S.more) { S.law=''; S.cycle=''; S.collect=''; S.target=''; S.actor=''; S.sr=''; S.hasPdf=''; S.assignee=''; } render(); }
    /* DYPICK 콜백 — 선택값은 이 화면이 들고 있고 선택기는 그리기만 한다 */
    function onTree(kind, a, b) {
        if (kind === 'item') { S.item = a; S.stage = ''; S.page = 1; }
        else if (kind === 'stage') { S.stage = b === false ? '' : a; S.page = 1; }
        else if (kind === 'clear') { S.item = ''; S.stage = ''; S.page = 1; }
        rerender();
    }
    function clearTree() { global.DYPICK.reset(''); S.item = ''; S.stage = ''; S.page = 1; render(); }
    function toggle(id) { S.expand[id] = !S.expand[id]; render(); }
    function go(n) { S.page = n; render(); try { window.scrollTo(0, 0); } catch (e) {} }

    /* =========================================================================
     * 미분류 교정 · 중복 병합 (관리자) — UF-09
     * -------------------------------------------------------------------------
     * "미분류 34건 · 중복 의심 4건"을 표시해 놓고 고칠 수단이 없으면, 화면이
     * 도달할 수 없는 행동을 약속한 것이다(CLAUDE.md §14-12). 조회만 만들고
     * '미구현'으로 넘기지 않는다.
     * ========================================================================= */
    var RM = null;                     /* {docId, stageIds[], q} */
    function openRemap(docId) {
        if (!D().isManager()) { V().toast('미분류 교정은 주관부서(재난안전과) 담당자만 할 수 있습니다.'); return; }
        var d = D().docById(docId); if (!d) return;
        RM = { docId: docId, stageIds: d.stageIds.slice(), q: '' };
        renderRemap();
    }
    function renderRemap() {
        var d = D().docById(RM.docId);
        var groups = [];
        D().items().forEach(function (it) {
            var hit = D().stagesOfItem(it.id).filter(function (s) {
                return !RM.q || F().match(RM.q, [s.id, s.name, it.id, it.name, s.law]);
            });
            if (hit.length) groups.push({ item: it, stages: hit });
        });
        var body =
            '<div class="dl-remap">' +
                '<p class="dl-remap-t"><b>' + esc(d.title) + '</b>' +
                    '<span class="dx-nodoc"> ' + esc(d.date || '') + (d.sr ? ' · ' + esc(d.sr) : '') + '</span></p>' +
                '<p class="dl-remap-help">원자료에 분류가 비어 있던 문서입니다. 이 문서가 증빙하는 업무단계를 고르면 ' +
                    '해당 단계가 <b>진행중</b>이 되고 이행 목록에 반영됩니다.</p>' +
                '<input type="search" class="form-input" id="dl-rm-q" value="' + esc(RM.q) + '"' +
                    ' placeholder="이행항목·업무단계·코드 검색" aria-label="업무단계 검색"' +
                    ' oninput="DOCLIST.setRemapQ(this.value)">' +
                '<p class="dl-remap-n">선택 <b>' + RM.stageIds.length + '</b>개</p>' +
                '<div class="dl-remap-body">' +
                    (groups.length ? groups.map(function (g) {
                        return '<div class="dl-rm-grp"><h5>' + esc(g.item.id) + ' · ' + esc(g.item.name) + '</h5>' +
                            g.stages.map(function (s) {
                                var on = RM.stageIds.indexOf(s.id) >= 0;
                                return '<label class="dl-rm-row' + (on ? ' is-on' : '') + '">' +
                                    '<input type="checkbox"' + (on ? ' checked' : '') +
                                    ' onchange="DOCLIST.toggleRemapStage(\'' + esc(s.id) + '\', this.checked)"> ' +
                                    '<span>' + esc(s.id) + ' ' + esc(s.name) + '</span></label>';
                            }).join('') + '</div>';
                    }).join('') : '<div class="v2-empty">조건에 맞는 업무단계가 없습니다.</div>') +
                '</div>' +
            '</div>';
        V().openModal('업무단계 지정 · 미분류 교정', body,
            '<button class="btn btn-outline" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" onclick="DOCLIST.saveRemap()">저장</button>');
    }
    function setRemapQ(v) { RM.q = v; F().rerender(renderRemap); }
    function toggleRemapStage(sid, on) {
        var i = RM.stageIds.indexOf(sid);
        if (on && i < 0) RM.stageIds.push(sid);
        if (!on && i >= 0) RM.stageIds.splice(i, 1);
        F().rerender(renderRemap);
    }
    function saveRemap() {
        if (!RM.stageIds.length) { V().toast('업무단계를 하나 이상 선택해야 저장됩니다.'); return; }
        var r = D().remapLedger(RM.docId, RM.stageIds);
        if (!r.ok) { V().toast(r.reason); return; }
        V().closeModal(true);
        RM = null;
        DOCLIST.render();
        V().toast('업무단계 ' + r.doc.stageIds.length + '개를 지정했습니다 — 해당 단계가 진행중이 되었습니다.');
    }

    /* 근사 중복 — 같은 문서로 볼지 다른 문서로 둘지는 사람이 정한다 */
    function mergeDup(docId) {
        if (!D().isManager()) { V().toast('중복 정리는 주관부서(재난안전과) 담당자만 할 수 있습니다.'); return; }
        var d = D().docById(docId); if (!d || !d.nearDup) return;
        var others = d.nearDup.map(D().docById).filter(Boolean);
        V().openModal('중복 의심 문서 정리',
            '<div class="dl-merge">' +
                '<p class="dl-remap-help">제목의 <b>공백만 다른</b> 문서입니다. 원자료가 그렇게 들어와 있어 ' +
                    '시스템이 자동으로 합치지 않았습니다 — 같은 문서인지 사람이 정합니다.</p>' +
                '<ul class="dl-merge-list">' +
                    [d].concat(others).map(function (o) {
                        return '<li><code>' + esc(o.id) + '</code> ' + esc(o.title) +
                            '<span class="dx-nodoc"> ' + esc(o.date) + ' · 업무단계 ' + o.stageIds.length + '개</span></li>';
                    }).join('') +
                '</ul>' +
                '<p class="dd-del-warn">합치면 업무단계 매핑이 <b>' + esc(d.id) + '</b> 로 모이고 나머지는 ' +
                    '<b>중복으로 표시</b>됩니다. 원자료는 지우지 않습니다.</p>' +
            '</div>',
            '<button class="btn btn-outline" onclick="DYV2.closeModal()">다른 문서다 — 그대로 둔다</button>' +
            '<button class="btn btn-primary" onclick="DOCLIST.doMerge(\'' + esc(docId) + '\')">같은 문서로 합치기</button>');
    }
    function doMerge(docId) {
        var r = D().mergeNearDup(docId);
        V().closeModal(true);
        if (!r.ok) { V().toast(r.reason); return; }
        DOCLIST.render();
        V().toast('중복 ' + r.merged + '건을 정리했습니다.');
    }

    function init(mount) {
        S.mount = mount;
        dropIdx();
        readURL();
        render();
    }

    global.DOCLIST = {
        init: init, render: function () { dropIdx(); render(); },
        setF: setF, resetF: resetF, toggleAdv: toggleAdv, toggle: toggle, go: go, pickCombo: pickCombo, setRemapQ: setRemapQ,
        onTree: onTree, clearTree: clearTree, toggleMore: toggleMore,
        openRemap: openRemap, saveRemap: saveRemap, toggleRemapStage: toggleRemapStage, mergeDup: mergeDup, doMerge: doMerge,
        state: S,
    };
}(window));
