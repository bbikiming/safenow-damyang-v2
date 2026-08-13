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
        open: {},        /* itemId → 단계 전부 펼침 */
        law: {},         /* itemId → 법령 근거 펼침 */
    };
    var PREVIEW = 5;     /* 카드에 먼저 보여주는 단계 수 */

    /* ── URL 상태 ─────────────────────────────────────────────────────────
     * ?year= ?item= ?stage= ?status= ?q= 를 지원한다. 구 쿼리 ?ver=·?menu= 는
     * 새 화면에서 뜻이 없으므로 조용히 무시하되 콘솔 오류를 내지 않는다. */
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
        var qs = p.toString();
        try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '')); } catch (e) {}
    }

    /* ── 조회 ─────────────────────────────────────────────────────────────
     * 필터는 **업무단계**에 걸고, 걸린 단계를 가진 이행항목만 카드로 낸다.
     * 그래야 '미이행 단계 찾기'(UF-01)가 카드 단위 필터로 뭉개지지 않는다. */
    function stageMatch(s) {
        if (S.status && D().statusOfStage(s.id, S.year) !== S.status) return false;
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
    function filtering() { return !!(S.q || S.status || S.cycle || S.collect || S.target); }

    /* ── 옵션 ── */
    function cycleOptions() {
        var seen = {};
        D().stages().forEach(function (s) { if (s.opCycle) seen[s.opCycle] = 1; });
        return [['', '운영주기 전체']].concat(Object.keys(seen).sort().map(function (c) { return [c, c]; }))
            .concat([['__none', '주기 없음']]);
    }
    function collectOptions() {
        var seen = {};
        D().stages().forEach(function (s) { if (s.collect) seen[s.collect] = 1; });
        return [['', '취합상태 전체']].concat(Object.keys(seen).sort().map(function (c) { return [c, c]; }));
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
        var s = D().summary(S.year);
        var lead = '<b>' + S.year + '년</b> · 완료 ' + s.counts.complete + ' · 진행중 ' + s.counts.in_progress +
            ' · 미이행 ' + s.counts.not_started + ' <span class="dx-lead-dim">/ 업무단계 ' + s.stages + '개</span>';
        var rest =
            '<p><b>법으로 해야 하는 일이 서류로 갖춰졌는지</b> 보는 화면입니다. ' +
            '서류를 올리면 <b>진행중</b>이 되고, 재난안전과가 확인해야 <b>완료</b>가 됩니다.</p>' +
            '<p class="dx-note-rel">부서별 반기 점검은 <a href="menu.html?m=comply">이행점검</a>, ' +
            '업무 배정은 <a href="work-admin.html">업무 관리</a>에서 봅니다.</p>';
        return V().notice('docs-exec', lead, rest);
    }

    /* 요약 — 카드 4장이 아니라 한 줄 칩. 첫 데이터까지의 거리를 지킨다(§14-12) */
    function summaryBar() {
        var s = D().summary(S.year);
        function chip(key, label, n, tone) {
            var on = S.status === key;
            return '<button type="button" class="dx-sum' + (on ? ' is-on' : '') + '"' +
                ' aria-pressed="' + (on ? 'true' : 'false') + '"' +
                ' onclick="DOCEXEC.setF(\'status\',\'' + (on ? '' : key) + '\')">' +
                '<span class="chip-status chip-sm ' + tone + '">' + esc(label) + '</span>' +
                '<b>' + n + '</b></button>';
        }
        return '<div class="dx-summary" role="group" aria-label="' + S.year + '년 이행 현황 요약">' +
            '<span class="dx-sum-static">법정 의무 <b>' + s.items + '</b>가지 · 할 일 <b>' + s.stages + '</b>개</span>' +
            chip(D().ST.DONE, '완료', s.counts.complete, 'success') +
            chip(D().ST.WIP, '진행중', s.counts.in_progress, 'info') +
            chip(D().ST.NONE, '미이행', s.counts.not_started, 'danger') +
            chip(D().ST.NA, '해당없음', s.counts.na, 'neutral') +
            '<a class="dx-sum-link" href="docs-preset.html?mapping=unmapped">의무 연결이 안 된 문서 ' + s.unmapped + '건 →</a>' +
        '</div>';
    }

    /* 조회 조건 — 상시 2개 + 접이식 3개.
     * 6개를 한 줄에 늘어놓으면 1280px 에서 두 줄이 되고 첫 카드가 밀린다(§14-12).
     * 기준연도는 **조회 조건이 아니라 화면 전체의 맥락**이라 제목 줄로 올렸다 —
     * 필터 바에 두면 항상 값이 있어 '필터 초기화 (1)' 이 영원히 켜져 있게 된다. */
    function filterBar(list) {
        var stages = list.reduce(function (a, g) { return a + g.stages.length; }, 0);
        var adv = !!(S.cycle || S.collect || S.target);
        var bar = F().bar([
            { type: 'search', id: 'dx-q', value: S.q, placeholder: '의무·할 일·법 이름으로 찾기', on: "DOCEXEC.setF('q', this.value)" },
            { type: 'select', id: 'dx-st', value: S.status, label: '진행상태', options: [['', '진행상태 전체'], [D().ST.NONE, '아직'], [D().ST.WIP, '진행중'], [D().ST.DONE, '완료'], [D().ST.NA, '해당없음']], on: "DOCEXEC.setF('status', this.value)" },
            { type: 'select', id: 'dx-cy', value: S.cycle, label: '운영주기', options: cycleOptions(), on: "DOCEXEC.setF('cycle', this.value)", hidden: !S.adv && !adv },
            { type: 'select', id: 'dx-co', value: S.collect, label: '취합상태', options: collectOptions(), on: "DOCEXEC.setF('collect', this.value)", hidden: !S.adv && !adv },
            { type: 'select', id: 'dx-tg', value: S.target, label: '적용대상', options: targetOptions(), on: "DOCEXEC.setF('target', this.value)", hidden: !S.adv && !adv },
        ].filter(function (f) { return !f.hidden; }), {
            count: list.length + '가지 의무 · ' + stages, unit: '개 할 일',
            reset: 'DOCEXEC.resetF()',
            actions: '<button type="button" class="btn btn-outline btn-sm" aria-expanded="' + (S.adv || adv ? 'true' : 'false') +
                '" onclick="DOCEXEC.toggleAdv()">상세 조건 ' + (S.adv || adv ? '▴' : '▾') +
                (adv ? ' <b>' + [S.cycle, S.collect, S.target].filter(Boolean).length + '</b>' : '') + '</button>',
        });
        return bar;
    }

    /* ── 카드 ─────────────────────────────────────────────────────────────
     * 데스크톱 2열. 3열은 긴 업무단계명과 우측 상태 태그를 함께 담지 못한다
     * (현행 3열에서 실제로 잘렸다 — UX설계 §2-1). */
    function grid(list) {
        if (!list.length) {
            return '<div class="v2-empty"><b>조건에 맞는 이행항목이 없습니다.</b><br>' +
                '조회 조건을 지우면 78개 이행항목이 모두 나옵니다.' +
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
                '<div class="dx-head-top">' +
                    '<span class="dx-code">' + esc(it.id) + '</span>' +
                    '<h2 class="dx-title">' + esc(it.name) + '</h2>' +
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
        return '<button type="button" class="dx-law-btn" aria-expanded="' + (S.law[it.id] ? 'true' : 'false') +
            '" onclick="DOCEXEC.toggleLaw(\'' + esc(it.id) + '\')">근거 법 ' + n + '건 <span aria-hidden="true">' +
            (S.law[it.id] ? '▴' : '▾') + '</span></button>';
    }
    /* 조문 펼침은 인라인 — 모달을 띄우지 않는다(CLAUDE.md §1·§10) */
    function lawPanel(it) {
        if (!S.law[it.id]) return '';
        return '<ul class="lawinfo-inline dx-law">' +
            (it.lawBases || []).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') +
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
        return '<tr class="dx-row' + (rec.needsRecheck ? ' is-recheck' : '') + '" id="dx-stage-' + esc(s.id) + '">' +
            '<td class="dx-c-main">' +
                '<a class="dx-stage-link" href="' + href + '">' +
                    '<span class="dx-scode">' + esc(s.id) + '</span>' +
                    '<span class="dx-sname">' + esc(s.name) + '</span>' +
                '</a>' +
                '<span class="dx-swhen">' + esc(when) + '<span class="dx-sep">·</span>' +
                    (docs.length
                        ? '<a class="dx-doclink" href="' + href + '">서류 ' + docs.length + '건</a>'
                        : '<span class="dx-nodoc">서류 없음</span>') +
                '</span>' +
            '</td>' +
            '<td class="dx-c-side">' +
                '<span class="chip-status chip-sm ' + V().toneOf(D().statusLabel(code)) + '">' +
                    esc(D().statusLabel(code)) + '</span>' +
                (rec.needsRecheck ? '<span class="chip-status chip-sm warning">재확인 필요</span>' : '') +
                (code === D().ST.NA && !rec.naReason ? '<span class="chip-status chip-sm warning">사유 미기재</span>' : '') +
                (D().canConfirm()
                    ? '<button type="button" class="btn btn-sm btn-outline dx-conf" onclick="DOCEXEC.openStage(\'' + esc(s.id) + '\')">서류 확인</button>'
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
                    '<div><dt>근거 법</dt><dd>' + esc(s.law || '미등록') + '</dd></div>' +
                    '<div><dt>현재 상태</dt><dd><span class="chip-status chip-sm ' +
                        V().toneOf(D().statusLabel(rec.status)) + '">' + esc(D().statusLabel(rec.status)) + '</span>' +
                        (rec.confirmedBy ? ' <span class="dx-mod-dim">' + esc(rec.confirmedBy) + ' · ' + esc(rec.confirmedAt) + '</span>' : '') +
                    '</dd></div>' +
                '</dl>' +
                '<h4 class="dx-mod-sub">올라온 서류 ' + docs.length + '건</h4>' +
                (docs.length
                    ? '<ul class="dx-mod-docs">' + docs.map(function (d) {
                        return '<li><a href="doc-detail.html?id=' + esc(d.id) + '">' + esc(d.title) + '</a>' +
                            '<span class="dx-mod-dim">' + esc(d.date || '') + (d.sr ? ' · ' + esc(d.sr) : '') + '</span></li>';
                      }).join('') + '</ul>'
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

    function reasonVal() {
        var el = document.getElementById('dx-reason');
        return el ? el.value.trim() : '';
    }
    function apply(stageId, to, reason) {
        var r = D().transition(stageId, S.year, to, { reason: reason });
        if (!r.ok) { V().toast(r.reason); return; }
        V().closeModal();
        render();
        V().toast(D().stage(stageId).name + ' — ' + D().statusLabel(to) + ' 처리했습니다.');
    }
    function confirmStage(id) { apply(id, D().ST.DONE, reasonVal()); }
    function rejectStage(id) {
        var why = reasonVal();
        if (!why) { V().toast('반려 사유를 입력해야 합니다 — 담당자가 무엇을 다시 해야 하는지 알 수 없습니다.'); return; }
        apply(id, D().ST.WIP, why);
    }
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
            '<button class="btn btn-primary btn-sm" onclick="DOCUP.open(' + S.year + ')">＋ 업무 업로드</button>';
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
        else S[k] = v;
        rerender();
    }
    function resetF() {
        S.q = ''; S.status = ''; S.cycle = ''; S.collect = ''; S.target = '';
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
        setF: setF, resetF: resetF, toggleItem: toggleItem, toggleLaw: toggleLaw, toggleAdv: toggleAdv,
        openStage: openStage, confirmStage: confirmStage, rejectStage: rejectStage,
        naStage: naStage, clearNA: clearNA,
        state: S,
    };
}(window));
