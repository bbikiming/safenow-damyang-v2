/* =========================================================================
 * 이행항목 · 업무단계 2단 선택기 (전역 DYPICK)
 *   기획: docs/planning/기획-업무문서-이행목록-업무목록-UX설계-v1.md
 *
 *   [왜 2단 트리인가]
 *   고를 것이 이행항목 78개 · 업무단계 168개다. 드롭다운은 스크롤로 찾으라는 말이고,
 *   78개를 접었다 펴는 아코디언은 원하는 것을 만나기까지 계속 굴려야 한다.
 *   채용 사이트(사람인·잡코리아)의 직무·지역 선택이 오래전에 답을 냈다 —
 *   **왼쪽 대분류 / 오른쪽 소분류, 각 칸이 따로 스크롤되고, 각 칸 위에 검색창,
 *   아래에 고른 것 칩.** 같은 구조를 쓴다.
 *
 *   [한 곳에서만 만든다]
 *   업무 목록의 상세 조건과 업무 업로드의 단계 선택이 같은 것을 고른다.
 *   서로 다르게 생기면 담당자가 두 번 배운다(CLAUDE.md §7 계열 신설 금지).
 *
 *   선택값은 **소비처가 들고 있고** 이 모듈은 그리기와 검색어만 맡는다 —
 *   상태를 둘로 두면 어느 쪽이 진짜인지 알 수 없어진다.
 * ========================================================================= */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYDOCS; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }

    /* 검색어와 펼친 이행항목만 여기서 들고 있다(선택값은 소비처 것) */
    var S = { qL: '', qR: '', item: '', cfg: null };

    /**
     * cfg = {
     *   ns:        전역 콜백 경로 접두 (예: 'DOCLIST.pick')
     *   multi:     true 면 업무단계 다중 선택
     *   stages:    현재 고른 업무단계 id 배열
     *   item:      현재 고른 이행항목 id ('' 가능)
     *   itemOnly:  true 면 이행항목만 고르고 업무단계 칸을 쓰지 않는다
     *   height:    목록 높이 (기본 240px)
     * }
     */
    function render(cfg) {
        S.cfg = cfg = cfg || {};
        if (cfg.item !== undefined && !S.item) S.item = cfg.item || '';
        var sel = cfg.stages || [];
        var h = cfg.height || 240;

        return '<div class="dyp" style="--dyp-h:' + h + 'px;">' +
            '<div class="dyp-cols">' +
                colItems(sel) +
                (cfg.itemOnly ? '' : colStages(sel)) +
            '</div>' +
            selBar(sel) +
        '</div>';
    }

    /* ── 왼쪽: 이행항목 78 ──────────────────────────────────────────────────
     * 담당자는 의무명("종사자 안전보건교육 실시")보다 실제 일 이름("특별교육")으로
     * 기억한다. 의무명만 맞춰 보면 "특별교육"에 0건이 나와 찾을 길이 없다 —
     * 그 의무의 **단계명까지** 훑는다(IMP-07). 단계명으로 걸린 항목은 '왜 나왔는지'를
     * 배지 옆에 짧게 밝힌다. 우측 검색어(qR) 자동 주입은 하지 않는다 — 항목을 고르면
     * 오른쪽이 어차피 그 의무의 전체 목록이라 훑을 수 있다(과잉 동작). */
    function colItems(sel) {
        var q = S.qL.trim();
        var byStage = {};
        var list = D().items().filter(function (it) {
            if (!q) return true;
            if ((it.id + ' ' + it.name).indexOf(q) >= 0) return true;
            var hit = D().stagesOfItem(it.id).some(function (s) { return (s.id + ' ' + s.name).indexOf(q) >= 0; });
            if (hit) byStage[it.id] = 1;
            return hit;
        });
        return '<div class="dyp-col">' +
            '<div class="dyp-col-h"><span>어떤 의무인가요</span>' +
                '<b class="dyp-n">' + list.length + '</b></div>' +
            '<div class="dyp-search">' +
                '<input type="search" class="form-input" value="' + esc(S.qL) + '"' +
                    ' placeholder="의무 이름·번호로 찾기" aria-label="이행항목 검색"' +
                    ' oninput="DYPICK._qL(this.value)" onkeydown="DYPICK._toList(event)">' +
            '</div>' +
            '<div class="dyp-list" role="listbox" aria-label="이행항목">' +
                (list.length ? list.map(function (it, i) {
                    var n = D().stagesOfItem(it.id).length;
                    var picked = D().stagesOfItem(it.id)
                        .filter(function (s) { return sel.indexOf(s.id) >= 0; }).length;
                    var on = S.item === it.id;
                    /* roving tabindex — 목록 전체가 Tab 1회다. 78개를 모두 Tab 으로
                       지나야 오른쪽 칸에 닿으면 키보드 사용자에게는 못 쓰는 화면이다
                       (실측 Tab 78회). 화살표로 항목을 옮기고 Tab 은 칸을 넘긴다. */
                    var roving = (S.item ? on : i === 0) ? '0' : '-1';
                    return '<button type="button" class="dyp-row' + (on ? ' is-on' : '') + '"' +
                        ' role="option" aria-selected="' + (on ? 'true' : 'false') + '"' +
                        ' tabindex="' + roving + '" onkeydown="DYPICK._key(event)"' +
                        ' onclick="DYPICK._item(\'' + esc(it.id) + '\')">' +
                        '<span class="dyp-row-t">' + esc(it.name) + '</span>' +
                        '<span class="dyp-row-n">' +
                            (byStage[it.id] ? '<em class="dyp-hit">할 일 일치</em>' : '') +
                            n + (picked ? ' <b>· ' + picked + '</b>' : '') +
                        '</span>' +
                    '</button>';
                }).join('') : '<p class="dyp-empty">찾는 의무가 없습니다.</p>') +
            '</div>' +
        '</div>';
    }

    /* ── 오른쪽: 그 의무의 업무단계 ── */
    function colStages(sel) {
        if (!S.item) {
            return '<div class="dyp-col">' +
                '<div class="dyp-col-h"><span>무슨 일인가요</span></div>' +
                '<div class="dyp-list dyp-wait"><p class="dyp-empty">왼쪽에서 의무를 먼저 고르세요.</p></div>' +
            '</div>';
        }
        var it = D().item(S.item) || {};
        var q = S.qR.trim();
        var all = D().stagesOfItem(S.item);
        var list = all.filter(function (s) { return !q || (s.id + ' ' + s.name).indexOf(q) >= 0; });
        var onAll = all.length && all.every(function (s) { return sel.indexOf(s.id) >= 0; });
        var multi = !!S.cfg.multi;
        return '<div class="dyp-col">' +
            '<div class="dyp-col-h"><span>무슨 일인가요</span>' +
                '<b class="dyp-n">' + list.length + '</b></div>' +
            '<div class="dyp-search">' +
                '<input type="search" class="form-input" value="' + esc(S.qR) + '"' +
                    ' placeholder="할 일 이름으로 찾기" aria-label="업무단계 검색"' +
                    ' oninput="DYPICK._qR(this.value)" onkeydown="DYPICK._toList(event)">' +
            '</div>' +
            (multi
                ? '<label class="dyp-all"><input type="checkbox"' + (onAll ? ' checked' : '') +
                  ' onchange="DYPICK._all(this.checked)"> 이 의무의 ' + all.length + '개 모두</label>'
                : '') +
            '<div class="dyp-list" role="listbox" aria-label="' + esc(it.name) + ' 업무단계">' +
                (list.length ? list.map(function (s) {
                    var on = sel.indexOf(s.id) >= 0;
                    var when = s.opCycle || s.timing || '';
                    if (multi) {
                        return '<label class="dyp-row dyp-row-ck' + (on ? ' is-on' : '') + '">' +
                            '<input type="checkbox"' + (on ? ' checked' : '') +
                                ' onkeydown="DYPICK._key(event)"' +
                                ' onchange="DYPICK._stage(\'' + esc(s.id) + '\', this.checked)">' +
                            '<span class="dyp-row-t">' + esc(s.name) +
                                (when ? '<span class="dyp-row-s">' + esc(when) + '</span>' : '') + '</span>' +
                        '</label>';
                    }
                    return '<button type="button" class="dyp-row' + (on ? ' is-on' : '') + '"' +
                        ' role="option" aria-selected="' + (on ? 'true' : 'false') + '"' +
                        ' onclick="DYPICK._stage(\'' + esc(s.id) + '\', true)">' +
                        '<span class="dyp-row-t">' + esc(s.name) +
                            (when ? '<span class="dyp-row-s">' + esc(when) + '</span>' : '') + '</span>' +
                    '</button>';
                }).join('') : '<p class="dyp-empty">찾는 할 일이 없습니다.</p>') +
            '</div>' +
        '</div>';
    }

    /* ── 아래: 고른 것 ── */
    function selBar(sel) {
        if (S.cfg.itemOnly) {
            var it = S.item ? D().item(S.item) : null;
            return '<div class="dyp-sel">' +
                (it ? '<span class="dyp-chip">' + esc(it.name) +
                        '<button type="button" aria-label="선택 해제" onclick="DYPICK._item(\'\')">×</button></span>'
                    : '<span class="dyp-sel-none">아직 고른 의무가 없습니다.</span>') +
            '</div>';
        }
        if (!sel.length) {
            return '<div class="dyp-sel"><span class="dyp-sel-none">아직 고른 할 일이 없습니다.</span></div>';
        }
        return '<div class="dyp-sel">' +
            '<b class="dyp-sel-n">고른 할 일 ' + sel.length + '개</b>' +
            sel.map(function (sid) {
                var s = D().stage(sid); if (!s) return '';
                return '<span class="dyp-chip">' + esc(s.name) +
                    '<button type="button" aria-label="' + esc(s.name) + ' 해제"' +
                    ' onclick="DYPICK._stage(\'' + esc(sid) + '\', false)">×</button></span>';
            }).join('') +
            '<button type="button" class="du-link" onclick="DYPICK._clear()">모두 지우기</button>' +
        '</div>';
    }

    /* ── 콜백 ── */
    function fire(kind, a, b) {
        var fn = resolve(S.cfg.ns);
        if (typeof fn === 'function') fn(kind, a, b);
    }
    function resolve(path) {
        if (!path) return null;
        var parts = String(path).split('.'), o = global;
        for (var i = 0; i < parts.length; i++) { o = o && o[parts[i]]; }
        return o;
    }

    /* 화살표로 목록 안을 옮긴다. Home/End 로 처음·끝. 좌 목록에서 →(오른쪽)를
       누르면 오른쪽 칸으로 건너간다 — 마우스 없이도 2단 구조를 그대로 쓴다. */
    function _key(e) {
        var k = e.key;
        var row = e.target.closest ? e.target.closest('.dyp-row') : null;
        var col = row && row.closest ? row.closest('.dyp-col') : null;
        if (!col) return;
        var rows = [].slice.call(col.querySelectorAll('.dyp-row'));
        var focusables = rows.map(function (r) {
            return r.tagName === 'LABEL' ? r.querySelector('input') : r;
        });
        var cur = focusables.indexOf(e.target);
        if (cur < 0) cur = rows.indexOf(row);
        var to = -1;
        if (k === 'ArrowDown') to = Math.min(focusables.length - 1, cur + 1);
        else if (k === 'ArrowUp') to = Math.max(0, cur - 1);
        else if (k === 'Home') to = 0;
        else if (k === 'End') to = focusables.length - 1;
        else if (k === 'ArrowRight' && col.nextElementSibling) {
            var nxt = col.nextElementSibling.querySelector('.dyp-search input, .dyp-row');
            if (nxt) { e.preventDefault(); nxt.focus(); }
            return;
        } else if (k === 'ArrowLeft' && col.previousElementSibling) {
            var prv = col.previousElementSibling.querySelector('.dyp-row[tabindex="0"], .dyp-row');
            if (prv) { e.preventDefault(); prv.focus(); }
            return;
        } else return;
        if (to >= 0 && focusables[to]) {
            e.preventDefault();
            rows.forEach(function (r) { if (r.tagName !== 'LABEL') r.setAttribute('tabindex', '-1'); });
            if (focusables[to].tagName !== 'INPUT') focusables[to].setAttribute('tabindex', '0');
            focusables[to].focus();
        }
    }

    /* 검색창에서 ↓ 를 누르면 바로 목록으로 — 검색하고 손을 옮기는 동선이다 */
    function _toList(e) {
        if (e.key !== 'ArrowDown') return;
        var col = e.target.closest('.dyp-col'); if (!col) return;
        var first = col.querySelector('.dyp-row');
        if (!first) return;
        e.preventDefault();
        (first.tagName === 'LABEL' ? first.querySelector('input') : first).focus();
    }

    function _qL(v) { S.qL = v; fire('redraw'); }
    function _qR(v) { S.qR = v; fire('redraw'); }
    function _item(id) {
        S.item = (S.item === id) ? '' : id;
        S.qR = '';
        fire('item', S.item);
    }
    function _stage(id, on) { fire('stage', id, on); }
    function _all(on) {
        var ids = D().stagesOfItem(S.item).map(function (s) { return s.id; });
        fire('all', ids, on);
    }
    function _clear() { fire('clear'); }

    /* 소비처가 밖에서 상태를 바꿨을 때(초기화 등) 맞춰 준다 */
    function reset(itemId) { S.qL = ''; S.qR = ''; S.item = itemId || ''; }
    function currentItem() { return S.item; }

    global.DYPICK = {
        render: render, reset: reset, currentItem: currentItem,
        _qL: _qL, _qR: _qR, _item: _item, _stage: _stage, _all: _all, _clear: _clear, _key: _key, _toList: _toList,
    };
}(window));
