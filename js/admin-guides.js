/* =====================================================================
   admin-guides.js · 가이드 관리 (전역 DYADMGUIDE) — 2026-11-05 운영 반영
   · 헤더 [가이드 다운로드]에 보일 자료(파일·영상 주소)를 등록·수정·순서·사용·삭제한다.
   · 목록의 정본은 js/layout.js(DYLayout.guides) 한 곳이다 — 헤더 모달은 모든 화면에서
     열리므로 이 화면 전용 파일에 두면 다른 화면이 읽지 못한다. 이 화면은 그 API 만 쓴다.
   · 헤더 모달에는 «사용»이고 자료(파일·주소)가 있는 항목만 순서대로 나간다 — 누르면
     오류가 나는 버튼을 두지 않는다(전달-개발-가이드다운로드 §5).
   · 용량은 파일에서 잰다 — 손으로 적지 않는다. 쪽수·기준일은 파일에서 안정적으로
     뽑기 어려워 함께 적는다(같은 지시 §4).
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var G = function () { return global.DYLayout.guides; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }

    var S = { root: null, draft: null, editId: null };
    var TITLE_MAX = 60, DESC_MAX = 80;

    function canManage() {
        var R = global.DYROLE;
        if (!R || !R.hidden) return true;
        return R.hidden().indexOf('admin') < 0;
    }
    function gate() {
        if (canManage()) return true;
        V().toast('가이드는 시스템 관리자가 관리합니다.');
        return false;
    }

    function init(id) { S.root = document.getElementById(id); injectHead(); render(); }

    function injectHead() {
        var host = document.querySelector('.dy-page-title');
        if (!host) return;
        var old = host.querySelector('.page-head-action');
        if (old) old.remove();
        var wrap = document.createElement('div');
        wrap.className = 'page-head-action';
        wrap.innerHTML =
            '<button type="button" class="btn btn-outline btn-sm" onclick="DYLayout.openGuides()">헤더 목록 미리보기</button> ' +
            (canManage() ? '<button type="button" class="btn btn-primary btn-sm" onclick="DYADMGUIDE.openNew()">＋ 자료 등록</button>' : '');
        host.appendChild(wrap);
    }

    function render() {
        if (!S.root) return;
        var list = G().list();
        var shown = list.filter(G().shown).length;
        var body = list.length
            ? '<div class="adml-tablewrap"><table class="table-figma bd-table bd-table-wide">' +
                '<thead><tr><th scope="col">순서</th><th scope="col">자료</th><th scope="col">형식·분량</th>' +
                '<th scope="col">파일·주소</th><th scope="col">헤더</th><th scope="col">관리</th></tr></thead>' +
                '<tbody>' + list.map(function (g, i) { return rowHtml(g, i, list.length); }).join('') + '</tbody></table></div>'
            : '<div class="v2-empty">등록된 가이드가 없습니다. [＋ 자료 등록]으로 올립니다.</div>';
        S.root.innerHTML =
            '<p class="bd-lead">헤더 <b>[가이드 다운로드]</b>에 보일 자료를 정합니다 — 지금 <b>' + shown + '</b>건이 이 순서대로 보입니다.</p>' +
            '<div class="card"><div class="card-body">' + body + '</div></div>';
    }

    function where(g) {
        if (g.kind === 'link') return g.url ? '<span class="bd-src">' + esc(g.url) + '</span>' : '<span class="bd-note">주소 없음</span>';
        if (!g.file) return '<span class="bd-note">파일 없음</span>';
        return '<span class="bd-src">' + esc(g.file) + '</span>';
    }
    function stateChip(g) {
        if (g.use === false) return '<span class="chip-status neutral">사용 안 함</span>';
        if (!G().shown(g)) return '<span class="chip-status warning">자료 없음</span>';
        return '<span class="chip-status success">보임</span>';
    }
    function rowHtml(g, i, n) {
        var can = canManage();
        var id = esc(g.id);
        var order = can
            ? '<span class="bd-order">' +
                '<button type="button" class="btn btn-sm btn-outline" aria-label="' + esc(g.title) + ' 위로"' + (i === 0 ? ' disabled' : '') +
                    ' onclick="DYADMGUIDE.move(\'' + id + '\', -1)">↑</button>' +
                '<button type="button" class="btn btn-sm btn-outline" aria-label="' + esc(g.title) + ' 아래로"' + (i === n - 1 ? ' disabled' : '') +
                    ' onclick="DYADMGUIDE.move(\'' + id + '\', 1)">↓</button></span>'
            : String(i + 1);
        var acts = can
            ? '<button type="button" class="btn btn-sm btn-outline" onclick="DYADMGUIDE.openEdit(\'' + id + '\')">수정</button> ' +
              (g.use !== false
                ? '<button type="button" class="btn btn-sm btn-outline" onclick="DYADMGUIDE.setUse(\'' + id + '\', false)">사용 끄기</button>'
                : '<button type="button" class="btn btn-sm btn-outline" onclick="DYADMGUIDE.setUse(\'' + id + '\', true)">사용 켜기</button>') +
              ' <button type="button" class="btn btn-sm btn-outline" onclick="DYADMGUIDE.askRemove(\'' + id + '\')">삭제</button>'
            : '';
        return '<tr>' +
            '<td>' + order + '</td>' +
            '<td><b>' + esc(g.title) + '</b><div class="bd-note">' + esc(g.desc) + '</div></td>' +
            '<td>' + esc(G().meta(g) || '-') + '</td>' +
            '<td>' + where(g) + '</td>' +
            '<td>' + stateChip(g) + '</td>' +
            '<td class="col-action">' + acts + '</td>' +
        '</tr>';
    }

    /* ── 등록·수정 ── */
    function blank() { return { kind: 'file', title: '', desc: '', fmt: '', pages: '', bytes: 0, note: '', file: '', src: '', url: '', use: true }; }
    function openNew() {
        if (!gate()) return;
        S.editId = null;
        S.draft = blank();
        drawForm();
    }
    function openEdit(id) {
        if (!gate()) return;
        var g = G().list().filter(function (x) { return x.id === id; })[0];
        if (!g) return;
        S.editId = id;
        S.draft = JSON.parse(JSON.stringify(g));
        drawForm();
    }
    function capture() {
        var d = S.draft; if (!d) return;
        var g = function (id) { var el = document.getElementById(id); return el ? el.value : null; };
        ['title', 'desc', 'pages', 'note', 'url', 'fmt'].forEach(function (k) {
            var v = g('ag-' + k); if (v != null) d[k] = v;
        });
        var u = document.getElementById('ag-use'); if (u) d.use = !!u.checked;
    }
    function drawForm() {
        var d = S.draft;
        var req = ' <span style="color:var(--status-danger-fg)">*</span>';
        var row = function (inner) { return '<div style="margin-bottom:var(--sp-3);">' + inner + '</div>'; };
        var kind = '<fieldset style="margin-bottom:var(--sp-3);"><legend class="form-label">종류' + req + '</legend>' +
            '<label class="bd-radio"><input type="radio" name="ag-kind" value="file"' + (d.kind !== 'link' ? ' checked' : '') +
                ' onchange="DYADMGUIDE.setKind(\'file\')"> 파일(내려받기)</label>' +
            '<label class="bd-radio"><input type="radio" name="ag-kind" value="link"' + (d.kind === 'link' ? ' checked' : '') +
                ' onchange="DYADMGUIDE.setKind(\'link\')"> 영상·주소(새 탭으로 열기)</label></fieldset>';
        var html = kind +
            row('<label class="form-label" for="ag-title">제목' + req + '</label>' +
                '<input type="text" class="form-input" id="ag-title" maxlength="' + TITLE_MAX + '" value="' + esc(d.title) + '" placeholder="자료 표지의 제목과 같게">') +
            row('<label class="form-label" for="ag-desc">설명' + req + '</label>' +
                '<input type="text" class="form-input" id="ag-desc" maxlength="' + DESC_MAX + '" value="' + esc(d.desc) + '" placeholder="언제 보는 자료인지 한 줄">');
        if (d.kind === 'link') {
            html += row('<label class="form-label" for="ag-url">주소' + req + '</label>' +
                    '<input type="url" class="form-input" id="ag-url" value="' + esc(d.url) + '" placeholder="https://">') +
                row('<label class="form-label" for="ag-fmt">형식</label>' +
                    '<input type="text" class="form-input" id="ag-fmt" maxlength="10" value="' + esc(d.fmt || '영상') + '" placeholder="예: 영상">');
        } else {
            html += '<div class="form-label">파일</div>' +
                V().uploadDrop('파일을 끌어다 놓거나 클릭해 고르세요', null, { pick: 'DYADMGUIDE.onFile', hint: true, profile: 'guide' }) +
                '<p class="bd-note" id="ag-file" style="margin:var(--sp-2) 0 var(--sp-3);">' + fileLine() + '</p>' +
                row('<label class="form-label" for="ag-pages">쪽수</label>' +
                    '<input type="number" class="form-input" id="ag-pages" min="1" max="9999" value="' + esc(d.pages || '') + '" placeholder="예: 5">');
        }
        html += row('<label class="form-label" for="ag-note">기준일·비고</label>' +
                '<input type="text" class="form-input" id="ag-note" maxlength="30" value="' + esc(d.note || '') + '" placeholder="예: 2026.10.13 기준">') +
            '<label class="bd-radio"><input type="checkbox" id="ag-use"' + (d.use !== false ? ' checked' : '') + '> 헤더 [가이드 다운로드]에 보이기</label>';
        V().openModal(S.editId ? '가이드 수정' : '가이드 등록', html,
            '<button type="button" class="btn btn-outline" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="DYADMGUIDE.save()">' + (S.editId ? '저장' : '등록') + '</button>');
    }
    function fileLine() {
        var d = S.draft;
        if (!d.file) return '고른 파일 없음 — 파일이 없으면 헤더에 보이지 않습니다.';
        return '파일: ' + esc(d.file) + (d.bytes ? ' (' + esc(G().mb(d.bytes)) + ')' : '');
    }
    function setKind(k) { capture(); S.draft.kind = k; drawForm(); }
    function onFile(items) {
        if (!S.draft || !items || !items.length) return;
        var f = items[0];
        var ext = (String(f.name).split('.').pop() || '').toUpperCase();
        S.draft.file = f.name;
        S.draft.bytes = f.size || 0;
        S.draft.fmt = ext === 'JPEG' ? 'JPG' : ext;
        S.draft.src = 'upload';
        var el = document.getElementById('ag-file');
        if (el) el.innerHTML = fileLine();
    }
    function save() {
        if (!gate()) return;
        capture();
        var d = S.draft;
        d.title = String(d.title || '').trim();
        d.desc = String(d.desc || '').trim();
        d.note = String(d.note || '').trim();
        if (!d.title) { V().toast('제목을 입력하세요.'); return; }
        if (!d.desc) { V().toast('설명을 입력하세요.'); return; }
        if (d.kind === 'link') {
            d.url = String(d.url || '').trim();
            if (!/^https:\/\/[^\s]+$/.test(d.url)) { V().toast('주소는 https:// 로 시작해야 합니다.'); return; }
            d.fmt = String(d.fmt || '').trim() || '영상';
            d.file = ''; d.bytes = 0; d.pages = ''; d.src = '';
        } else {
            var pg = String(d.pages || '').trim();
            if (pg && !/^\d{1,4}$/.test(pg)) { V().toast('쪽수는 숫자로 입력하세요.'); return; }
            d.pages = pg ? Number(pg) : '';
            d.url = '';
        }
        var list = G().list();
        if (S.editId) {
            list = list.map(function (x) { return x.id === S.editId ? d : x; });
        } else {
            d.id = 'g' + Date.now().toString(36);
            list.push(d);
        }
        if (!G().saveAll(list)) { V().toast('저장하지 못했습니다.'); return; }
        V().closeModal(true);
        render();
        var shown = G().shown(d);
        V().toast('«' + d.title + '»' + V().josa(d.title, '을', '를') + (S.editId ? ' 저장했습니다' : ' 등록했습니다') +
            (shown ? '.' : ' — ' + (d.use === false ? '사용을 꺼 두어' : '자료가 없어') + ' 헤더에는 보이지 않습니다.'));
        S.draft = null; S.editId = null;
    }

    function move(id, dir) {
        if (!gate()) return;
        var list = G().list();
        var i = list.findIndex(function (g) { return g.id === id; });
        var j = i + (dir < 0 ? -1 : 1);
        if (i < 0 || j < 0 || j >= list.length) return;
        var t = list[i]; list[i] = list[j]; list[j] = t;
        G().saveAll(list);
        render();
    }
    function setUse(id, on) {
        if (!gate()) return;
        var list = G().list();
        var g = list.filter(function (x) { return x.id === id; })[0];
        if (!g) return;
        g.use = !!on;
        G().saveAll(list);
        render();
        V().toast('«' + g.title + '»' + V().josa(g.title, '을', '를') + (on ? ' 헤더 목록에 다시 보입니다.' : ' 헤더 목록에서 내렸습니다.'));
    }
    /* 삭제 확인은 같은 창 안에서(§1). 무엇이 사라지는지 말한다. */
    function askRemove(id) {
        if (!gate()) return;
        var g = G().list().filter(function (x) { return x.id === id; })[0];
        if (!g) return;
        V().openModal('가이드 삭제',
            '<p>«' + esc(g.title) + '»' + esc(V().josa(g.title, '을', '를')) + ' 목록에서 지웁니다. ' +
            (G().shown(g) ? '헤더 [가이드 다운로드]에서 바로 사라집니다. ' : '') +
            '다시 보이게 하려면 새로 등록해야 합니다 — 잠시 내리려면 [사용 끄기]를 쓰세요.</p>',
            '<button type="button" class="btn btn-outline" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="DYADMGUIDE.remove(\'' + esc(id) + '\')">삭제</button>');
    }
    function remove(id) {
        if (!gate()) return;
        G().saveAll(G().list().filter(function (g) { return g.id !== id; }));
        V().closeModal(true);
        render();
        V().toast('가이드를 지웠습니다.');
    }

    global.DYADMGUIDE = {
        init: init, openNew: openNew, openEdit: openEdit, setKind: setKind, onFile: onFile, save: save,
        move: move, setUse: setUse, askRemove: askRemove, remove: remove
    };
})(window);
