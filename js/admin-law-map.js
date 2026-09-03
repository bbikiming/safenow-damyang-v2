/* =============================================================================
 *  admin-law-map.js — 법령 관리 > 메뉴 근거 매핑 탭 (전역 DYADMLAWMAP)
 * -----------------------------------------------------------------------------
 *  2026-07-30 통합 — 별도 메뉴(구 ADM05)에서 법령 관리 화면(admin-law.html)의
 *  **탭 2**로 흡수됐다. 셸은 LAWTABS(admin-law.js), 이 모듈은 탭 본문만 그린다.
 *
 *  ■ 이 탭은 **검토 대장**이다 — 편집 화면이 아니다 (2026-07-30 사용자 결정)
 *    근거 조문은 안전보건 법령이 정한 것이고, 화면별 매핑은 전수 검토
 *    (2026-08-12 현행, 검증 기록 84건)로 확정된 초기 DB다. 조문(원문)과 같은 논리로
 *    매핑도 화면에서 고치지 않는다 — 저장·제거·순서·역할 편집 조작을 두지 않는다.
 *
 *    · 근거 추가 UI 제거(af303ba) → 저장·제거·순서·역할까지 제거(이번)로 완결.
 *      하루 감사에서 나온 결함 5종이 전부 "즉석 판단으로 붙인" 방향이었다 —
 *      즉석 판단으로 떼는 것도 같은 종류의 사고를 만든다.
 *    · 역할(의무/주기·기준)은 편집값이 아니라 조문 속성(ARTICLES[].cycle) 파생이다.
 *      편집 select 시절에는 기본값 때문에 주기 조문(§190 등)이 전부 "의무 근거"로
 *      잘못 표시됐다 — 파생 표기로 정정.
 *    · 이견은 **[매핑 재검토 요청]** 으로 기록만 남긴다(비파괴). 요청은 정비 큐와
 *      변경 이력에 나타나고, 실제 변경은 law-map.js 재생성(개발·배치)으로만 반영된다.
 * ========================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var L = function () { return global.DYLAW; };
    var A = function () { return global.LAWADM; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }
    function chip(label) { return '<span class="chip-status ' + V().toneOf(label) + '">' + esc(label) + '</span>'; }

    var state = {
        mount: null, sel: '', q: '', filter: '',
        open: null          /* 대메뉴 접힘 상태 { groupId: true } — null 이면 최초 1회 자동 세팅 */
    };

    /* =============== 렌더 =============== */
    function render() {
        if (!state.mount) return;
        state.mount.innerHTML =
            topbar() +
            '<div class="admp-2col">' +
                '<div class="admp-listcard card">' + leftCard() + '</div>' +
                '<div class="admp-panel">' + panel() + '</div>' +
            '</div>';
    }

    function counts() {
        var rows = A().pageRows();
        var c = { basis: 0, none: 0, unset: 0, unreach: L().unreachableMapKeys().length, review: A().reviewAll().length };
        rows.forEach(function (r) {
            var s = A().statusOf(r);
            if (s === '근거 있음') c.basis++;
            else if (s === '근거 없음(확정)') c.none++;
            else c.unset++;
        });
        return c;
    }

    function topbar() {
        var c = counts();
        return '<div class="admp-topbar">' +
            '<span class="admp-topbar-hint">' +
                '근거 있음 <b>' + c.basis + '</b> · 근거 없음(확정) <b>' + c.none + '</b> · 미판단 <b>' + c.unset + '</b>' +
                (c.unreach ? ' · 반영 안 됨 <b>' + c.unreach + '</b>' : '') +
                (c.review ? ' · 재검토 요청 <b>' + c.review + '</b>' : '') +
                '<br>이 탭은 <b>검토 대장</b>입니다 — 근거는 안전보건 법령과 전수 검토(2026-07-30)로 확정되어 ' +
                '화면에서 고치지 않습니다. 이견은 <b>재검토 요청</b>으로 남기고, 변경은 법령 데이터 재생성으로만 반영됩니다.' +
            '</span>' +
            '<span style="flex:1;"></span>' +
        '</div>';
    }

    /* ── 좌측 — 대메뉴 › 중메뉴 트리 ──────────────────────────────────
     *  화면 식별자가 아니라 **담당자가 실제로 보는 메뉴명**으로 보여준다.
     *  메뉴명·구조는 NAV 파생이라 메뉴가 개편되면 이 화면도 함께 따라간다.
     * ------------------------------------------------------------------- */
    function leftCard() {
        var tree = A().menuTree();
        if (state.open === null) {
            /* 최초 진입은 전부 펼침 — 담당자가 전체 구조를 한 번 보고 시작해야 한다 */
            state.open = {};
            tree.groups.forEach(function (g) { state.open[g.id] = true; });
            state.open.__orphan = true;
        }
        return '<div class="card-header"><span class="card-title">관리 대상 화면</span></div>' +
            '<div class="admm-search">' +
                '<input id="admlm-q" type="text" placeholder="메뉴명 검색 — 위험성평가 · 정기교육" value="' + esc(state.q) + '" ' +
                    'oninput="DYADMLAWMAP.search(this.value)">' +
            '</div>' +
            '<div class="adml-sec" style="padding-top:8px;">' +
                '<div class="adml-sec-head">상태 필터</div>' +
                '<div style="padding:0 14px 4px;display:flex;gap:4px;flex-wrap:wrap;">' +
                    ['', '근거 있음', '근거 없음(확정)', '미판단'].map(function (f) {
                        return '<button type="button" class="btn btn-sm ' + (state.filter === f ? 'btn-primary' : 'btn-outline') + '" ' +
                            'onclick="DYADMLAWMAP.setFilter(\'' + f + '\')">' + (f || '전체') + '</button>';
                    }).join('') +
                '</div>' +
            '</div>' +
            '<div class="admm-tree-body">' + treeBody(tree) + '</div>';
    }

    /* 검색·필터를 통과하는가 — 메뉴명(한글)·구분·식별자·파일명 모두로 찾는다 */
    function hit(r) {
        if (state.filter && A().statusOf(r) !== state.filter) return false;
        if (!state.q) return true;
        var hay = [r.group, r.section, r.label, r.id].concat(r.files).join(' ');
        return L().normalize(hay).indexOf(L().normalize(state.q)) >= 0;
    }

    function treeBody(tree) {
        var searching = !!(state.q || state.filter);
        var html = '';
        var shown = 0;

        tree.groups.forEach(function (g) {
            /* 노드를 순서대로 훑으며 통과한 항목만 남긴다.
             * 구분 헤더는 그 아래 살아남은 항목이 있을 때만 그린다. */
            var out = [], pendingSec = null, n = 0;
            g.nodes.forEach(function (nd) {
                if (nd.type === 'section') { pendingSec = nd.name; return; }
                if (!hit(nd.row)) return;
                if (pendingSec) { out.push('<div class="admlm-section">' + esc(pendingSec) + '</div>'); pendingSec = null; }
                out.push(itemRow(nd.row, nd.depth));
                n++;
            });
            if (!n) return;
            shown += n;
            /* 검색 중에는 결과를 감추지 않는다 */
            var isOpen = searching ? true : !!state.open[g.id];
            html += '<div class="adml-law">' +
                '<button type="button" class="adml-row adml-law-head" onclick="DYADMLAWMAP.toggle(\'' + g.id + '\')">' +
                    '<span class="adml-caret">' + (isOpen ? '▾' : '▸') + '</span>' +
                    '<span class="adml-row-main">' + esc(g.label) + '</span>' +
                    summaryChips(g.summary) +
                '</button>' +
                (isOpen ? out.join('') : '') +
            '</div>';
        });


        /* NAV 에 없는 관리 대상 — 메뉴에서 제외됐으나 파일이 살아 있다 */
        var orph = tree.orphan.filter(hit);
        if (orph.length) {
            var oOpen = searching ? true : !!state.open.__orphan;
            shown += orph.length;
            html += '<div class="adml-law">' +
                '<button type="button" class="adml-row adml-law-head" onclick="DYADMLAWMAP.toggle(\'__orphan\')">' +
                    '<span class="adml-caret">' + (oOpen ? '▾' : '▸') + '</span>' +
                    '<span class="adml-row-main">메뉴 미등록 화면</span>' +
                    '<span class="adml-count">' + orph.length + '</span>' +
                '</button>' +
                (oOpen ? orph.map(function (r) { return itemRow(r, 1); }).join('') +
                    '<div class="adml-empty-note">메뉴에서 제외됐지만 파일이 살아 있어 직접 주소로 열립니다. ' +
                    '트리에서 빼면 <b>관리 화면이 관리하지 못하는 근거</b>가 생깁니다.</div>' : '') +
            '</div>';
        }

        /* 반영 안 되는 매핑 — 코드 정리 대상 */
        var unreach = L().unreachableMapKeys();
        if (unreach.length && !state.q && !state.filter) {
            html += '<div class="adml-sec">' +
                '<div class="adml-sec-head">반영 안 됨 <span class="adml-count">' + unreach.length + '</span></div>' +
                unreach.map(function (k) {
                    return '<div class="adml-row" style="cursor:default;">' +
                        '<span class="adml-row-main">' + esc(k) + '</span>' + chip('개발 수정 필요') + '</div>';
                }).join('') +
                '<div class="adml-empty-note">매핑은 있으나 <b>어떤 화면도 이 식별자를 쓰지 않습니다.</b> ' +
                '화면에서 고칠 수 없고 코드 정리가 필요합니다.</div>' +
            '</div>';
        }

        if (!shown) {
            html = '<div class="adml-empty-note">조건에 맞는 화면이 없습니다' +
                (state.q ? ' — <b>' + esc(state.q) + '</b>' : '') +
                '<br><button type="button" class="btn btn-sm btn-outline" onclick="DYADMLAWMAP.clearFind()">조건 초기화</button></div>';
        }
        return html;
    }

    /* 대메뉴 요약 — 진척률이 아니라 판정 분포다 */
    function summaryChips(c) {
        var out = '';
        if (c.basis) out += '<span class="admlm-mini success">' + c.basis + '</span>';
        if (c.none) out += '<span class="admlm-mini neutral">' + c.none + '</span>';
        if (c.unset) out += '<span class="admlm-mini warning">' + c.unset + '</span>';
        return '<span class="admlm-minis">' + out + '</span>';
    }

    function itemRow(r, depth) {
        var on = state.sel === r.id;
        var review = A().reviewOf(r.id);
        return '<button type="button" class="adml-row admlm-item-row d' + depth + (on ? ' is-on' : '') + '" ' +
            'onclick="DYADMLAWMAP.sel(\'' + r.id + '\')">' +
            '<span class="adml-row-main">' + esc(r.label) +
                (r.hidden ? ' <span class="chip-mini wt">메뉴 제외</span>' : '') +
                (r.chipBlocked.length ? ' <span class="adml-art-t">표시 불가</span>' : '') +
            '</span>' + (review ? chip('재검토 요청') : chip(A().statusOf(r))) + '</button>';
    }

    /* ── 우측 — 읽기 전용 검토 패널 ── */
    function panel() {
        if (!state.sel) {
            return '<div class="card"><div class="card-body"><div class="v2-empty">' +
                '<div class="v2-empty-title">좌측에서 화면을 선택하세요</div>' +
                '<div class="v2-empty-sub">화면마다 어떤 조문이 근거인지, 왜 그렇게 판정했는지(검토 논거)를 확인합니다.<br>' +
                '매핑이 틀렸다고 판단되면 <b>재검토 요청</b>으로 기록을 남깁니다.</div></div></div></div>';
        }
        var r = A().pageRows().filter(function (x) { return x.id === state.sel; })[0];
        if (!r) return '';
        var eff = r.eff;
        var review = A().reviewOf(r.id);

        return '<div class="card">' +
            '<div class="card-header"><span class="card-title">' + esc(A().labelOf(r.id)) + '</span>' +
                (review ? chip('재검토 요청') : chip(A().statusOf(r))) + '</div>' +
            '<div class="card-body">' +

            /* 적용 범위 — 1:N 이 실재하므로 반드시 보여준다 */
            '<div class="adml-formrow"><label class="form-label">화면 식별자</label>' +
                '<span class="adml-hint"><code>' + esc(r.id) + '</code></span></div>' +
            '<div class="adml-formrow"><label class="form-label">적용 화면</label>' +
                '<span class="adml-hint">' +
                r.files.map(function (f) {
                    return '<a class="adml-jump" href="' + esc(f) + '" target="_blank" rel="noopener noreferrer">' + esc(f) + ' ↗</a>';
                }).join(' · ') +
                (r.files.length > 1 ? ' <b>— ' + r.files.length + '개 화면이 이 근거를 공유합니다</b>' : '') + '</span></div>' +
            (r.chipBlocked.length
                ? '<div class="admlm-warn">이 화면에는 제목 영역이 없어 <b>근거가 있어도 칩이 표시되지 않습니다</b> (' +
                  esc(r.chipBlocked.join(', ')) + '). 표시하려면 화면에 제목 영역을 추가해야 합니다 — 개발 수정 필요.</div>'
                : '') +

            (eff.mode === 'basis' ? itemsBlock(eff, r) : noneBlock(eff)) +

            /* 미리보기 — 대상 화면 상단의 실제 렌더 모양 */
            (eff.mode === 'basis' && eff.items.length ? previewBlock(eff) : '') +

            /* 재검토 요청 — 편집을 대신하는 유일한 조작(비파괴) */
            '<div class="adml-block-head">재검토</div>' +
            (review
                ? '<div class="admlm-warn">재검토 요청 중 — ' + esc(review.reason || '(사유 없음)') +
                  '<div class="adml-imp-detail">' + esc(review.at) + ' · ' + esc(review.by) + '</div></div>' +
                  '<div class="adml-formrow" style="margin-top:8px;">' +
                      '<button type="button" class="btn btn-sm btn-outline" onclick="DYADMLAWMAP.withdraw()">요청 철회</button>' +
                  '</div>'
                : '<div class="adml-formrow">' +
                      '<button type="button" class="btn btn-sm btn-outline" onclick="DYADMLAWMAP.askReview()">매핑 재검토 요청</button>' +
                      '<span class="adml-hint">틀렸다고 판단되면 사유를 남기세요 — 정비 큐와 변경 이력에 올라갑니다.</span>' +
                  '</div>') +
            '<div class="adml-hint" style="margin-top:10px;">' +
                '매핑 변경은 이 화면이 아니라 <b>법령 데이터 재생성</b>(law-map.js·조문과 같은 경로)으로만 반영됩니다. ' +
                '검증 기록 ' + r.verified + '건.' +
            '</div>' +
        '</div></div>';
    }

    /* 근거 조문 목록 — 조문 + 역할(파생) + 전수 검토 논거. 편집 컨트롤이 없다 */
    function itemsBlock(eff, r) {
        /* 조문키 → 최신 검증 기록(전수 검토 논거) */
        var recs = {};
        A().verifyList(r.id).forEach(function (v) {
            if (v.articleKey && !recs[v.articleKey]) recs[v.articleKey] = v;
        });
        var body = eff.items.map(function (it) {
            var a = L().ARTICLES[it.key];
            var rec = recs[it.key];
            return '<div class="admlm-item">' +
                '<span class="admlm-item-main"><b>' + esc(L().shortRef(it.key)) + '</b> ' +
                    '<span class="adml-art-t">' + esc(a ? a.title : '(수록되지 않은 조문)') + '</span> ' +
                    (a ? '<button type="button" class="adml-jump" onclick="LAWTABS.openArticle(\'' + esc(it.key) + '\')">원문 보기</button>' : '') +
                    (rec ? '<div class="adml-imp-detail">검토 논거 — ' + esc(rec.reason) +
                           ' <span>(' + esc(rec.at.split(' ')[0]) + ' · ' + esc(rec.by) + ')</span></div>' : '') +
                '</span>' +
                chip(it.role === 'cycle' ? '주기·기준 근거' : '의무 근거') +
            '</div>';
        }).join('');
        return '<div class="adml-block-head">근거 조문 <span class="adml-sub">순서가 칩 표시 순서입니다 · 역할은 조문 성격에서 파생됩니다</span></div>' +
            body +
            '<div class="adml-notice">' +
                '근거 조문은 <b>안전보건 법령이 정한 것</b>이며 이 화면에서 지정·수정하지 않습니다. ' +
                '<b>주기·기준 근거</b>는 "왜 이 주기·시간인가"의 답을 담은 조문입니다 — 법률은 대개 위임만 하고 주기는 시행령·시행규칙·별표·고시에 있습니다.' +
            '</div>';
    }

    function noneBlock(eff) {
        return '<div class="adml-block-head">근거 없음 사유</div>' +
            '<div class="adml-notice">' + esc(eff.reason || '판정 사유 미기록') + '</div>' +
            '<div class="adml-hint" style="margin-top:6px;">' +
                '근거가 없는 것도 정보입니다. <b>억지로 조문을 붙이지 않습니다.</b>' +
            '</div>';
    }

    function previewBlock(eff) {
        var chips = eff.items.map(function (it) {
            return '<span class="law-basis-chip" style="cursor:default;">' + esc(L().shortRef(it.key)) +
                   '<span class="law-basis-i" aria-hidden="true">ⓘ</span></span>';
        }).join('');
        return '<div class="admlm-preview">' +
            '<div class="admlm-preview-lab">미리보기 — 이 화면 상단에 이렇게 표시됩니다</div>' +
            '<div class="law-basis-row"><span class="law-basis-lead">법령 근거</span>' + chips + '</div>' +
        '</div>';
    }

    /* =============== 액션 =============== */
    function sel(id) {
        state.sel = id; render();
        focusPanel();
    }
    /* lg 미만에서는 2단이 세로로 쌓여 검토 패널이 트리 아래(뷰포트 밖)에 있다.
     * 스크롤해 주지 않으면 "눌러도 아무 일도 안 일어난다"로 보인다.
     * innerHTML 교체 직후의 동기 smooth 스크롤은 브라우저가 취소하므로
     * rAF 로 렌더 정착 뒤에 실행한다. */
    function focusPanel() {
        if (!V().below('lg')) return;
        requestAnimationFrame(function () {
            var p = state.mount && state.mount.querySelector('.admp-panel');
            if (p) p.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }
    function search(v) {
        state.q = v;
        var host = state.mount.querySelector('.admm-tree-body');
        if (host) {
            var tmp = document.createElement('div');
            tmp.innerHTML = leftCard();
            host.innerHTML = tmp.querySelector('.admm-tree-body').innerHTML;
        } else render();
    }
    function setFilter(f) { state.filter = f; render(); }
    function toggle(gid) { state.open[gid] = !state.open[gid]; render(); }
    function clearFind() { state.q = ''; state.filter = ''; render(); }

    /* 재검토 요청 — 단일 모달 규칙(§1): 이 시점에 열린 모달이 없어 적층이 아니다 */
    function askReview() {
        if (!state.sel) return;
        V().openModal('매핑 재검토 요청 — ' + A().labelOf(state.sel),
            '<p style="font-size:13px;line-height:1.7;">이 화면의 근거 매핑이 틀렸다고 판단한 이유를 남겨주세요.<br>' +
            '요청은 <b>정비 큐와 변경 이력</b>에 올라가며, 매핑 자체는 바뀌지 않습니다 — ' +
            '검토 후 법령 데이터 재생성으로 반영됩니다.</p>' +
            '<textarea id="admlm-review-reason" class="form-textarea" rows="3" ' +
                'placeholder="예: 이 화면은 결과 보관만 하므로 §OO 은 직접 이행 수단이 아니다"></textarea>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="DYADMLAWMAP.doReview()">요청</button>');
        var el = document.getElementById('admlm-review-reason');
        if (el) el.focus();
    }
    function doReview() {
        var el = document.getElementById('admlm-review-reason');
        var reason = (el && el.value || '').trim();
        if (!reason) { toast('재검토 사유를 적어주세요.'); return; }
        A().requestReview(state.sel, reason);
        V().closeModal();
        toast('재검토 요청을 남겼습니다 — 정비 큐와 변경 이력에서 확인할 수 있습니다.');
        render();
    }
    function withdraw() {
        if (!state.sel) return;
        A().withdrawReview(state.sel);
        toast('재검토 요청을 철회했습니다.');
        render();
    }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        var q = new URLSearchParams(location.search).get('page');
        if (q) state.sel = q;
        render();
    }

    global.DYADMLAWMAP = {
        init: init, sel: sel, search: search, setFilter: setFilter, toggle: toggle, clearFind: clearFind,
        askReview: askReview, doReview: doReview, withdraw: withdraw
    };
})(window);
