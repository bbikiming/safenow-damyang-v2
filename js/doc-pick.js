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

    /* ── 왼쪽: 이행항목 78 ── */
    function colItems(sel) {
        var q = S.qL.trim();
        var list = D().items().filter(function (it) {
            return !q || (it.id + ' ' + it.name).indexOf(q) >= 0;
        });
        return '<div class="dyp-col">' +
            '<div class="dyp-col-h"><span>어떤 의무인가요</span>' +
                '<b class="dyp-n">' + list.length + '</b></div>' +
            '<div class="dyp-search">' +
                '<input type="search" class="form-input" value="' + esc(S.qL) + '"' +
                    ' placeholder="의무 이름·번호로 찾기" aria-label="이행항목 검색"' +
                    ' oninput="DYPICK._qL(this.value)">' +
            '</div>' +
            '<div class="dyp-list" role="listbox" aria-label="이행항목">' +
                (list.length ? list.map(function (it) {
                    var n = D().stagesOfItem(it.id).length;
                    var picked = D().stagesOfItem(it.id)
                        .filter(function (s) { return sel.indexOf(s.id) >= 0; }).length;
                    var on = S.item === it.id;
                    return '<button type="button" class="dyp-row' + (on ? ' is-on' : '') + '"' +
                        ' role="option" aria-selected="' + (on ? 'true' : 'false') + '"' +
                        ' onclick="DYPICK._item(\'' + esc(it.id) + '\')">' +
                        '<span class="dyp-row-t">' + esc(it.name) + '</span>' +
                        '<span class="dyp-row-n">' + n + (picked ? ' <b>· ' + picked + '</b>' : '') + '</span>' +
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
                    ' oninput="DYPICK._qR(this.value)">' +
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
        _qL: _qL, _qR: _qR, _item: _item, _stage: _stage, _all: _all, _clear: _clear,
    };
}(window));
