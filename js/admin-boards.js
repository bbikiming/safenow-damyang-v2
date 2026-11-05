/* =====================================================================
   admin-boards.js · 게시판 관리 (전역 DYADMBOARD) — 2026-11-05 운영 반영
   · 정보센터 탭의 정본 — 게시판 만들기·이름·유형·쓰기 권한·순서·사용 여부.
   · 판정·저장은 DYBOARD(js/board-data.js) 한 곳이고 이 화면은 그리기만 한다.
   · 삭제는 글이 0건일 때만. 글이 있으면 «사용 끄기» — 정보센터에서 내려가고
     글은 남는다(언제 무엇을 알렸는지가 남아야 한다).
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var B = function () { return global.DYBOARD; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }

    var S = { root: null };

    function init(id) { S.root = document.getElementById(id); injectHead(); render(); }

    function injectHead() {
        var host = document.querySelector('.dy-page-title');
        if (!host) return;
        var old = host.querySelector('.page-head-action');
        if (old) old.remove();
        if (!B().canManage()) return;
        var wrap = document.createElement('div');
        wrap.className = 'page-head-action';
        wrap.innerHTML = '<button type="button" class="btn btn-primary btn-sm" onclick="DYADMBOARD.openNew()">＋ 게시판 만들기</button>';
        host.appendChild(wrap);
    }

    function render() {
        if (!S.root) return;
        var list = B().boards();
        var on = list.filter(function (b) { return b.use !== false; }).length;
        var body = list.length
            ? '<div class="adml-tablewrap"><table class="table-figma bd-table bd-table-wide">' +
                '<thead><tr><th scope="col">순서</th><th scope="col">게시판</th><th scope="col">유형</th>' +
                '<th scope="col">글을 올리는 사람</th><th scope="col">글</th><th scope="col">정보센터</th><th scope="col">관리</th></tr></thead>' +
                '<tbody>' + list.map(function (b, i) { return rowHtml(b, i, list.length); }).join('') + '</tbody></table></div>'
            : '<div class="v2-empty">만든 게시판이 없습니다. [＋ 게시판 만들기]로 만듭니다.</div>';
        S.root.innerHTML =
            '<p class="bd-lead">정보센터에 보일 게시판을 정합니다 — 사용 중인 게시판 <b>' + on + '</b>개가 이 순서대로 정보센터 탭이 됩니다.</p>' +
            '<div class="card"><div class="card-body">' + body + '</div></div>';
    }

    function rowHtml(b, i, n) {
        var can = B().canManage();
        var cnt = B().postCount(b.id);
        var id = esc(b.id);
        var order = can
            ? '<span class="bd-order">' +
                '<button type="button" class="btn btn-sm btn-outline" aria-label="' + esc(b.name) + ' 위로"' + (i === 0 ? ' disabled' : '') +
                    ' onclick="DYADMBOARD.move(\'' + id + '\', -1)">↑</button>' +
                '<button type="button" class="btn btn-sm btn-outline" aria-label="' + esc(b.name) + ' 아래로"' + (i === n - 1 ? ' disabled' : '') +
                    ' onclick="DYADMBOARD.move(\'' + id + '\', 1)">↓</button></span>'
            : String(i + 1);
        var use = b.use !== false
            ? '<span class="chip-status success">보임</span>'
            : '<span class="chip-status neutral">사용 안 함</span>';
        var acts = can
            ? '<button type="button" class="btn btn-sm btn-outline" onclick="DYADMBOARD.openEdit(\'' + id + '\')">수정</button> ' +
              (b.use !== false
                ? '<button type="button" class="btn btn-sm btn-outline" onclick="DYADMBOARD.setUse(\'' + id + '\', false)">사용 끄기</button>'
                : '<button type="button" class="btn btn-sm btn-outline" onclick="DYADMBOARD.setUse(\'' + id + '\', true)">사용 켜기</button>') +
              (cnt === 0 ? ' <button type="button" class="btn btn-sm btn-outline" onclick="DYADMBOARD.askRemove(\'' + id + '\')">삭제</button>' : '')
            : '';
        return '<tr>' +
            '<td>' + order + '</td>' +
            '<td><b>' + esc(b.name) + '</b></td>' +
            '<td>' + esc(B().KINDS[b.kind] ? B().KINDS[b.kind].label : '-') + '</td>' +
            '<td>' + esc(B().WRITES[b.write] || '-') + '</td>' +
            '<td>' + cnt + '건</td>' +
            '<td>' + use + '</td>' +
            '<td class="col-action">' + acts + '</td>' +
        '</tr>';
    }

    /* ── 만들기·수정 ── */
    function form(b) {
        b = b || { name: '', kind: 'notice', write: 'owner', use: true };
        var locked = b.id && B().postCount(b.id) > 0;
        var req = ' <span style="color:var(--status-danger-fg)">*</span>';
        var kinds = Object.keys(B().KINDS).map(function (k) {
            return '<option value="' + k + '"' + (b.kind === k ? ' selected' : '') + '>' +
                esc(B().KINDS[k].label + ' — ' + B().KINDS[k].cols.join('·')) + '</option>';
        }).join('');
        var writes = Object.keys(B().WRITES).map(function (k) {
            return '<label class="bd-radio"><input type="radio" name="bd-write" value="' + k + '"' + (b.write === k ? ' checked' : '') + '> ' +
                esc(B().WRITES[k]) + '</label>';
        }).join('');
        return '<div style="margin-bottom:var(--sp-3);"><label class="form-label" for="bd-name">게시판 이름' + req + '</label>' +
                '<input type="text" class="form-input" id="bd-name" maxlength="' + B().NAME_MAX + '" value="' + esc(b.name) + '" placeholder="예: 공지사항"></div>' +
            '<div style="margin-bottom:var(--sp-3);"><label class="form-label" for="bd-kind">유형' + req + '</label>' +
                '<select class="form-select" id="bd-kind"' + (locked ? ' disabled' : '') + '>' + kinds + '</select>' +
                (locked ? '<p class="bd-note">글이 있는 게시판은 유형을 바꿀 수 없습니다.</p>' : '') + '</div>' +
            '<fieldset style="margin-bottom:var(--sp-3);"><legend class="form-label">글을 올리는 사람' + req + '</legend>' + writes + '</fieldset>' +
            '<label class="bd-radio"><input type="checkbox" id="bd-use"' + (b.use !== false ? ' checked' : '') + '> 정보센터에 보이기</label>';
    }
    function val() {
        var w = document.querySelector('input[name="bd-write"]:checked');
        return {
            name: (document.getElementById('bd-name') || {}).value,
            kind: (document.getElementById('bd-kind') || {}).value,
            write: w ? w.value : '',
            use: !!(document.getElementById('bd-use') || {}).checked
        };
    }
    function gate() {
        if (B().canManage()) return true;
        V().toast('게시판은 시스템 관리자가 관리합니다.');
        return false;
    }
    function openNew() {
        if (!gate()) return;
        V().openModal('게시판 만들기', form(null),
            '<button type="button" class="btn btn-outline" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="DYADMBOARD.save(null)">만들기</button>');
    }
    function openEdit(id) {
        if (!gate()) return;
        var b = B().board(id); if (!b) return;
        V().openModal('게시판 수정', form(b),
            '<button type="button" class="btn btn-outline" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="DYADMBOARD.save(\'' + esc(id) + '\')">저장</button>');
    }
    function save(id) {
        if (!gate()) return;
        var o = val();
        var r = id ? B().updateBoard(id, o) : B().createBoard(o);
        if (!r.ok) { V().toast(r.msg); return; }
        V().closeModal(true);
        render();
        V().toast('«' + r.board.name + '» 게시판을 ' + (id ? '저장했습니다.' : '만들었습니다.'));
    }
    function move(id, dir) { if (!gate()) return; if (B().moveBoard(id, dir)) render(); }
    function setUse(id, on) {
        if (!gate()) return;
        if (!B().setUse(id, on)) return;
        render();
        var b = B().board(id);
        var j = V().josa(b.name, '을', '를');
        V().toast('«' + b.name + '»' + j + (on ? ' 정보센터에 다시 보입니다.' : ' 정보센터에서 내렸습니다 — 글은 그대로 남습니다.'));
    }
    function askRemove(id) {
        if (!gate()) return;
        var b = B().board(id); if (!b) return;
        var n = B().postCount(id);
        if (n > 0) { V().toast('글이 ' + n + '건 있어 지울 수 없습니다 — 사용을 끄면 정보센터에서 내려갑니다.'); return; }
        V().openModal('게시판 삭제',
            '<p>«' + esc(b.name) + '» 게시판을 지웁니다. 글이 없는 게시판이라 정보센터에서 탭 하나가 사라집니다.</p>',
            '<button type="button" class="btn btn-outline" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="DYADMBOARD.remove(\'' + esc(id) + '\')">삭제</button>');
    }
    function remove(id) {
        if (!gate()) return;
        var r = B().removeBoard(id);
        if (!r.ok) { V().toast(r.msg); return; }
        V().closeModal(true);
        render();
        V().toast('게시판을 지웠습니다.');
    }

    global.DYADMBOARD = { init: init, openNew: openNew, openEdit: openEdit, save: save, move: move, setUse: setUse, askRemove: askRemove, remove: remove };
})(window);
