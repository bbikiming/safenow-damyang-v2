/* =============================================================================
 *  admin-law-map.js — 법령 관리 > 메뉴 근거 매핑 탭 (전역 DYADMLAWMAP)
 * -----------------------------------------------------------------------------
 *  2026-07-30 통합 — 별도 메뉴(구 ADM05, admin-law-map.html)에서 법령 관리
 *  화면(admin-law.html)의 **탭 2**로 흡수됐다. 셸은 LAWTABS(admin-law.js),
 *  이 모듈은 탭 본문만 그린다. 구 주소는 리다이렉트 스텁이 승계한다.
 *
 *  화면별 근거 조문을 붙이고 떼는 탭. 조문(사실) 탭과 나눠 두는 이유는
 *  파괴 성격이 다르기 때문이다 — 조문 쪽 사고는 "참조가 조용히 끊김",
 *  매핑 쪽 사고는 **"그럴듯한 오답"**이다. 하루 감사에서 나온 결함 5종이 전부 후자였다.
 *  미저장 변경(draft)은 탭 전환에도 confirm 가드가 걸린다(LAWTABS).
 *
 *  ■ 붙이기와 떼기는 비대칭이다
 *    떼기는 과잉 주장을 줄이는 방향이라 사유 1줄이면 된다.
 *    붙이기는 결함이 나온 방향이라 **검증 6문을 통과해야** 저장된다.
 *
 *  ■ 저장 전에 반드시 보여주는 것
 *    ① 이 근거가 적용되는 HTML 목록(1:N 관계가 실재한다)
 *    ② 화면 상단에 실제로 어떻게 보이는지 미리보기
 *    ③ 칩이 표시되지 않는 화면이면 그 사실
 *
 *  단일 모달 규칙(§1): 근거 추가는 패널 안 인라인 단계로 진행하고 모달을 띄우지 않는다.
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
        open: null,         /* 대메뉴 접힘 상태 { groupId: true } — null 이면 최초 1회 자동 세팅 */
        draft: null         /* { mode, items:[{key,role}], reason } */
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
        var c = { basis: 0, none: 0, unset: 0, unreach: L().unreachableMapKeys().length };
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
                '근거 있음 <b>' + c.basis + '</b> · 근거 없음(확정) <b>' + c.none + '</b> · 미판단 <b>' + c.unset + '</b> · 반영 안 됨 <b>' + c.unreach + '</b>' +
                '<br><b>진척률은 표시하지 않습니다</b> — 근거는 채울수록 좋은 것이 아니라 <b>맞아야</b> 하는 것이고, ' +
                '과잉으로 붙여서 생긴 결함이 실제로 있었습니다.' +
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

        /* 반영 안 되는 매핑 — 편집 잠금 */
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
        return '<button type="button" class="adml-row admlm-item-row d' + depth + (on ? ' is-on' : '') + '" ' +
            'onclick="DYADMLAWMAP.sel(\'' + r.id + '\')">' +
            '<span class="adml-row-main">' + esc(r.label) +
                (r.chipBlocked.length ? ' <span class="adml-art-t">표시 불가</span>' : '') +
            '</span>' + chip(A().statusOf(r)) + '</button>';
    }

    /* ── 우측 ── */
    function panel() {
        if (!state.sel) {
            return '<div class="card"><div class="card-body"><div class="v2-empty">' +
                '<div class="v2-empty-title">좌측에서 화면을 선택하세요</div>' +
                '<div class="v2-empty-sub">화면마다 어떤 조문을 근거로 삼을지 지정합니다.<br>' +
                '근거를 붙일 때는 <b>검증 6문</b>을 통과해야 저장됩니다.</div></div></div></div>';
        }
        var r = A().pageRows().filter(function (x) { return x.id === state.sel; })[0];
        if (!r) return '';
        var d = state.draft || { mode: r.eff.mode === 'unset' ? 'none' : r.eff.mode, items: r.eff.items.slice(), reason: r.eff.reason || '' };
        var dirty = !!state.draft;

        return '<div class="card">' +
            '<div class="card-header"><span class="card-title">' + esc(A().labelOf(r.id)) + '</span>' +
                (dirty ? '<span class="chip-status warning">저장 필요</span>' : '') + '</div>' +
            '<div class="card-body">' +

            /* 적용 범위 — 1:N 이 실재하므로 저장 전에 반드시 보여준다 */
            '<div class="adml-formrow"><label class="form-label">화면 식별자</label>' +
                '<span class="adml-hint"><code>' + esc(r.id) + '</code></span></div>' +
            '<div class="adml-formrow"><label class="form-label">적용 화면</label>' +
                '<span class="adml-hint">' +
                /* 실제 화면으로 이동하는 링크 — 새 탭으로 열어 편집 중인 draft 를 잃지 않는다 */
                r.files.map(function (f) {
                    return '<a class="adml-jump" href="' + esc(f) + '" target="_blank" rel="noopener noreferrer">' + esc(f) + ' ↗</a>';
                }).join(' · ') +
                (r.files.length > 1 ? ' <b>— ' + r.files.length + '개 화면이 이 근거를 공유합니다</b>' : '') + '</span></div>' +
            (r.chipBlocked.length
                ? '<div class="admlm-warn">이 화면에는 제목 영역이 없어 <b>근거를 지정해도 칩이 표시되지 않습니다</b> (' +
                  esc(r.chipBlocked.join(', ')) + '). 표시하려면 화면에 제목 영역을 추가해야 합니다 — 개발 수정 필요.</div>'
                : '') +

            /* 판정 */
            '<div class="adml-block-head">근거 판정</div>' +
            '<div class="adml-formrow">' +
                ['basis', 'none'].map(function (m) {
                    return '<label class="adml-hint" style="display:flex;align-items:center;gap:5px;">' +
                        '<input type="radio" name="admlm-mode" value="' + m + '"' + (d.mode === m ? ' checked' : '') +
                        ' onchange="DYADMLAWMAP.setMode(\'' + m + '\')"> ' +
                        (m === 'basis' ? '근거 있음' : '근거 없음(확정)') + '</label>';
                }).join('') +
            '</div>' +

            (d.mode === 'basis' ? itemsBlock(d, r) : noneBlock(d, r)) +

            /* 미리보기 — 저장 전 실제 렌더 모양을 보는 것 자체가 오배정 방지책이다 */
            (d.mode === 'basis' && d.items.length ? previewBlock(d) : '') +

            '<div class="adml-formrow" style="margin-top:16px;gap:6px;">' +
                '<button type="button" class="btn btn-primary btn-sm" onclick="DYADMLAWMAP.save()">저장</button>' +
                (dirty ? '<button type="button" class="btn btn-outline btn-sm" onclick="DYADMLAWMAP.discard()">되돌리기</button>' : '') +
                '<span class="adml-hint">검증 기록 ' + r.verified + '건</span>' +
            '</div>' +
        '</div></div>';
    }

    function itemsBlock(d, r) {
        var body = d.items.length
            ? d.items.map(function (it, i) {
                var a = L().ARTICLES[it.key];
                return '<div class="admlm-item">' +
                    '<div class="admlm-order">' +
                        '<button type="button" class="admlm-obtn" onclick="DYADMLAWMAP.move(' + i + ',-1)" aria-label="위로">▲</button>' +
                        '<button type="button" class="admlm-obtn" onclick="DYADMLAWMAP.move(' + i + ',1)" aria-label="아래로">▼</button>' +
                    '</div>' +
                    '<span class="admlm-item-main"><b>' + esc(L().shortRef(it.key)) + '</b> ' +
                        '<span class="adml-art-t">' + esc(a ? a.title : '(수록되지 않은 조문)') + '</span> ' +
                        (a ? '<button type="button" class="adml-jump" onclick="LAWTABS.openArticle(\'' + esc(it.key) + '\')">원문 보기</button>' : '') +
                    '</span>' +
                    '<select class="form-select" onchange="DYADMLAWMAP.setRole(' + i + ',this.value)" style="max-width:110px;">' +
                        '<option value="duty"' + (it.role === 'duty' ? ' selected' : '') + '>의무 근거</option>' +
                        '<option value="cycle"' + (it.role === 'cycle' ? ' selected' : '') + '>주기 근거</option>' +
                    '</select>' +
                    '<button type="button" class="btn btn-sm btn-outline" onclick="DYADMLAWMAP.remove(' + i + ')">제거</button>' +
                '</div>';
              }).join('')
            : '<div class="adml-empty-note">지정된 근거가 없습니다.</div>';
        return '<div class="adml-block-head">근거 조문 <span class="adml-sub">순서가 칩 표시 순서입니다</span></div>' +
            body +
            '<div class="adml-notice">' +
                '근거 조문은 <b>안전보건 법령이 정한 것</b>이며 이 화면에서 새로 지정하지 않습니다. ' +
                '여기서는 지정된 근거가 <b>맞는지 검토</b>하고, 틀렸으면 제거하거나 판정을 바꿉니다.<br>' +
                '<b>주기 근거</b>는 "왜 이 주기인가"의 답을 담은 조문입니다 — 법률은 대개 위임만 하고 주기는 시행령·시행규칙에 있습니다.' +
            '</div>';
    }

    function noneBlock(d, r) {
        return '<div class="adml-block-head">근거 없음 사유</div>' +
            '<textarea class="form-textarea" rows="2" placeholder="예: 법령이 정한 의무가 아니라 시스템 운영 기능이다" ' +
                'oninput="DYADMLAWMAP.setReason(this.value)">' + esc(d.reason || '') + '</textarea>' +
            '<div class="adml-hint" style="margin-top:6px;">' +
                '근거가 없는 것도 정보입니다. <b>억지로 조문을 붙이지 않습니다.</b> 사유를 남겨야 다음 담당자가 재검토하지 않습니다.' +
            '</div>';
    }

    function previewBlock(d) {
        /* 실제 렌더 함수를 draft 값으로 호출한다 — 화면과 다른 모양을 그리면 의미가 없다 */
        var chips = d.items.map(function (it) {
            return '<span class="law-basis-chip" style="cursor:default;">' + esc(L().shortRef(it.key)) +
                   '<span class="law-basis-i" aria-hidden="true">ⓘ</span></span>';
        }).join('');
        return '<div class="admlm-preview">' +
            '<div class="admlm-preview-lab">미리보기 — 이 화면 상단에 이렇게 표시됩니다</div>' +
            '<div class="law-basis-row"><span class="law-basis-lead">법령 근거</span>' + chips + '</div>' +
        '</div>';
    }

    /* =============== 액션 =============== */
    function ensureDraft() {
        if (state.draft) return state.draft;
        var r = A().pageRows().filter(function (x) { return x.id === state.sel; })[0];
        var e = r ? r.eff : { mode: 'none', items: [], reason: '' };
        state.draft = { mode: e.mode === 'unset' ? 'none' : e.mode, items: e.items.slice(), reason: e.reason || '' };
        return state.draft;
    }
    function sel(id) {
        if (state.draft && !confirm('저장하지 않은 변경이 있습니다. 이동하면 사라집니다.')) return;
        state.sel = id; state.draft = null; render();
        focusPanel();
    }
    /* lg 미만에서는 2단이 세로로 쌓여 편집 패널이 트리 아래(뷰포트 밖)에 있다.
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
    function setMode(m) {
        var d = ensureDraft();
        if (d.mode !== m) {
            /* 판정을 바꾸면 직전 판정에 딸린 값은 비운다.
             * 안 비우면 '근거 없음' 사유가 '근거 있음' 매핑에 그대로 붙어 저장된다. */
            d.reason = '';
            if (m === 'none') d.items = [];
        }
        d.mode = m;
        render();
    }
    function setReason(v) { ensureDraft().reason = v; }
    function setRole(i, v) { ensureDraft().items[i].role = v; }
    function move(i, dir) {
        var d = ensureDraft(), j = i + dir;
        if (j < 0 || j >= d.items.length) return;
        var t = d.items[i]; d.items[i] = d.items[j]; d.items[j] = t;
        render();
    }
    function remove(i) {
        var d = ensureDraft();
        d.items.splice(i, 1); render();
    }
    function discard() { state.draft = null; render(); toast('변경 내용을 되돌렸습니다.'); }


    function save() {
        var d = state.draft;
        if (!d) { toast('변경 내용이 없습니다.'); return; }
        if (d.mode === 'none' && !(d.reason || '').trim()) { toast('근거 없음 사유를 적어주세요.'); return; }
        if (d.mode === 'basis' && !d.items.length) { toast('근거 조문이 없습니다. 근거 없음으로 확정하거나 조문을 추가하세요.'); return; }
        var r = A().pageRows().filter(function (x) { return x.id === state.sel; })[0];
        A().saveMapping(state.sel, d.mode, d.items, d.reason);
        state.draft = null; render();
        toast('저장되었습니다 — ' + A().labelOf(state.sel) + ' 에 적용됩니다. 근거 칩은 해당 화면을 새로 열 때 반영됩니다.');
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
        setMode: setMode, setReason: setReason, setRole: setRole, move: move, remove: remove,
        discard: discard, save: save,
        /* 탭 셸(LAWTABS)의 전환 가드용 — draft 유무와 무언 폐기 */
        isDirty: function () { return !!state.draft; },
        dropDraft: function () { state.draft = null; render(); }
    };
})(window);
