/* =====================================================================
   info-center.js · 정보센터 (전역 DYINFO) — 2026-11-05 운영 반영
   · 탭은 시스템 관리 > 게시판 관리의 «사용» 게시판을 그 순서대로 그린다(DYBOARD).
     화면이 탭을 따로 들고 있지 않는다 — 관리 화면에서 바꾼 것이 그대로 반영돼야 한다.
   · 검색은 지금 보이는 게시판들의 글(제목·내용·구분·부서·작성)을 실제로 거른다.
     없는 기능(전체 색인 검색)을 약속하는 입력은 두지 않는다.
   · 안내 문구는 «이 화면에서 무엇을 하면 되는지»만 — 게시판이 어떻게 만들어지는지
     같은 시스템 설명은 쓰지 않는다(운영 요청서 T18). 비어 있으면 «등록된 글이 없습니다.»
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var B = function () { return global.DYBOARD; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }

    var S = { root: null, tab: '', q: '', cat: '', draft: null };

    function boardsNow() { return B().activeBoards(); }
    function curBoard() {
        var list = boardsNow();
        var b = list.filter(function (x) { return x.id === S.tab; })[0];
        if (!b && list.length) { S.tab = list[0].id; b = list[0]; }
        return b || null;
    }

    function hit(p) {
        var q = S.q.trim().toLowerCase();
        if (!q) return true;
        return [p.title, p.body, p.cat, p.deptName, p.author].some(function (x) {
            return String(x || '').toLowerCase().indexOf(q) >= 0;
        });
    }
    function listOf(b) {
        return B().posts(b.id).filter(function (p) {
            if (b.kind === 'archive' && S.cat && p.cat !== S.cat) return false;
            return hit(p);
        });
    }

    /* ── 렌더 ── */
    function init(id) {
        S.root = document.getElementById(id);
        var t = new URLSearchParams(location.search).get('tab');
        if (t) S.tab = t;
        renderShell();
    }

    /* 검색칸은 다시 그리지 않는다 — 통째로 다시 그리면 입력 중에 포커스·캐럿이 날아간다. */
    function renderShell() {
        if (!S.root) return;
        if (!boardsNow().length) {
            S.root.innerHTML = '<div class="card"><div class="card-body"><div class="v2-empty">등록된 글이 없습니다.</div></div></div>';
            return;
        }
        S.root.innerHTML =
            '<div class="v2-toolbar">' +
                '<div class="search-bar" style="flex:1; max-width:520px;">' +
                    '<input class="search-input" id="ic-q" type="search" aria-label="글 검색" placeholder="제목·내용 검색" ' +
                        'value="' + esc(S.q) + '" oninput="DYINFO.setQ(this.value)">' +
                '</div>' +
                '<span class="spacer"></span>' +
                '<span id="ic-act"></span>' +
            '</div>' +
            '<div id="ic-body"></div>';
        render();
    }

    function render() {
        var host = document.getElementById('ic-body');
        if (!host) return;
        var list = boardsNow();
        var b = curBoard();
        var searching = !!S.q.trim();

        var tabs = '<div class="tabs" role="tablist" aria-label="게시판">' + list.map(function (x) {
            var on = x.id === b.id;
            var n = searching ? ' <span class="chip-status neutral chip-sm">' + B().posts(x.id).filter(hit).length + '</span>' : '';
            return '<button type="button" class="tab' + (on ? ' active' : '') + '" role="tab" aria-selected="' + on + '"' +
                ' onclick="DYINFO.setTab(\'' + esc(x.id) + '\')">' + esc(x.name) + n + '</button>';
        }).join('') + '</div>';

        var act = document.getElementById('ic-act');
        if (act) {
            act.innerHTML = B().canWrite(b)
                ? '<button type="button" class="btn btn-primary" onclick="DYINFO.openWrite()">＋ 글 등록</button>'
                : '';
        }

        var catBar = '';
        if (b.kind === 'archive') {
            var cats = [];
            B().posts(b.id).forEach(function (p) { if (p.cat && cats.indexOf(p.cat) < 0) cats.push(p.cat); });
            if (cats.length > 1) {
                catBar = '<div class="v2-toolbar bd-catbar">' +
                    '<select class="form-select" aria-label="구분" onchange="DYINFO.setCat(this.value)">' +
                        '<option value="">구분 전체</option>' +
                        cats.map(function (c) { return '<option' + (S.cat === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') +
                    '</select></div>';
            }
        }

        var all = B().posts(b.id);
        var rows = listOf(b);
        var body;
        if (!all.length) body = '<div class="v2-empty">등록된 글이 없습니다.</div>';
        else if (!rows.length) body = '<div class="v2-empty">조건에 맞는 글이 없습니다.</div>';
        else {
            var cols = B().KINDS[b.kind].cols;
            body = '<div class="adml-tablewrap"><table class="table-figma bd-table">' +
                '<thead><tr>' + cols.map(function (c) { return '<th scope="col">' + esc(c) + '</th>'; }).join('') + '</tr></thead>' +
                '<tbody>' + rows.map(function (p) { return rowHtml(b, p); }).join('') + '</tbody></table></div>';
        }
        host.innerHTML = tabs + catBar + '<div class="card" style="margin-top:var(--sp-3);"><div class="card-body">' + body + '</div></div>';
    }

    function rowHtml(b, p) {
        var title = '<button type="button" class="bd-title" onclick="DYINFO.open(\'' + esc(p.id) + '\')">' + esc(p.title) + '</button>' +
            (p.sample ? ' ' + V().sampleChip() : '');
        var c2, c4;
        if (b.kind === 'notice') { c2 = esc(p.author || '-'); c4 = String(p.views || 0); }
        else if (b.kind === 'archive') { c2 = esc(p.cat || '-'); c4 = (p.files && p.files.length) ? p.files.length + '건' : '-'; }
        else { c2 = esc(p.deptName || '-'); c4 = String(p.recs || 0); }
        return '<tr><td>' + title + '</td><td>' + c2 + '</td><td>' + esc(p.date) + '</td><td>' + c4 + '</td></tr>';
    }

    /* ── 조작 ── */
    function setTab(id) { S.tab = id; S.cat = ''; render(); }
    function setQ(v) { S.q = String(v || ''); render(); }
    function setCat(v) { S.cat = v; render(); }

    /* noView — 같은 창을 다시 그릴 때(추천 뒤·삭제 취소) 조회수를 또 올리지 않는다 */
    function open(id, noView) {
        var p = noView ? B().post(id) : B().view(id);
        if (!p) { V().toast('글을 찾을 수 없습니다.'); return; }
        var b = B().board(p.board) || { kind: 'notice', name: '' };
        var meta = b.kind === 'notice' ? [p.author, p.date, '조회 ' + (p.views || 0)]
            : b.kind === 'archive' ? [p.cat, p.author, p.date]
            : [p.deptName, p.date, '추천 ' + (p.recs || 0)];
        var files = (p.files || []).length
            ? '<ul class="bd-files">' + p.files.map(function (f) {
                return '<li><span>' + esc(f.name) + '</span>' +
                    '<button type="button" class="btn btn-sm btn-outline" onclick="DYV2.notReady(\'자료 내려받기\', \'파일 저장소 연계\')">다운로드</button></li>';
            }).join('') + '</ul>'
            : '';
        var foot = '';
        if (b.kind === 'case') foot += '<button type="button" class="btn btn-outline" onclick="DYINFO.recommend(\'' + esc(p.id) + '\')">추천</button>';
        if (B().canRemovePost(p)) foot += '<button type="button" class="btn btn-outline" onclick="DYINFO.askRemove(\'' + esc(p.id) + '\')">삭제</button>';
        foot += '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal()">닫기</button>';
        V().openModal(esc(p.title),
            '<p class="bd-meta">' + meta.filter(Boolean).map(esc).join(' · ') + (p.sample ? ' ' + V().sampleChip() : '') + '</p>' +
            (p.body ? '<div class="bd-body">' + esc(p.body) + '</div>' : '') + files,
            foot);
        render();
    }
    function recommend(id) {
        var r = B().recommend(id);
        V().toast(r.ok ? '추천했습니다.' : r.msg);
        if (r.ok) open(id, true);
    }
    /* 삭제 확인은 같은 창 안에서 — 모달 위에 모달을 띄우지 않는다(§1) */
    function askRemove(id) {
        var p = B().post(id);
        if (!p) return;
        if (!B().canRemovePost(p)) { V().toast('글은 쓴 사람과 주관부서 담당자가 지웁니다.'); return; }
        V().openModal('글 삭제',
            '<p>이 글을 지웁니다 — «' + esc(p.title) + '». 지운 글은 되돌릴 수 없습니다' +
            ((p.files || []).length ? ' — 첨부 ' + p.files.length + '건도 함께 지워집니다' : '') + '.</p>',
            '<button type="button" class="btn btn-outline" onclick="DYINFO.open(\'' + esc(id) + '\', true)">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="DYINFO.remove(\'' + esc(id) + '\')">삭제</button>');
    }
    function remove(id) {
        var r = B().removePost(id);
        V().toast(r.ok ? '글을 지웠습니다.' : r.msg);
        if (r.ok) { V().closeModal(true); render(); }
    }

    /* ── 글 등록 ── */
    function deptFixed() {
        var R = global.DYROLE;
        if (!R || !R.canAct) return '';
        if (R.canAct(R.OWNER_DEPT)) return '';            /* 주관부서 담당자는 조직도에서 고른다 */
        var p = R.current();
        return (p && p.deptName) || '';
    }
    function openWrite() {
        var b = curBoard();
        if (!b) return;
        if (!B().canWrite(b)) { V().toast(B().writeDenyNote(b)); return; }
        S.draft = { title: '', body: '', cat: '', dept: deptFixed(), files: [] };
        drawWrite();
    }
    function capture() {
        var d = S.draft; if (!d) return;
        var g = function (id) { var el = document.getElementById(id); return el ? el.value : null; };
        if (g('ic-w-title') != null) d.title = g('ic-w-title');
        if (g('ic-w-body') != null) d.body = g('ic-w-body');
        if (g('ic-w-cat') != null) d.cat = g('ic-w-cat');
        if (g('ic-w-dept') != null) d.dept = g('ic-w-dept');
    }
    function drawWrite() {
        var b = curBoard(), d = S.draft;
        var req = ' <span style="color:var(--status-danger-fg)">*</span>';
        var row = function (inner) { return '<div style="margin-bottom:var(--sp-3);">' + inner + '</div>'; };
        var html = row('<label class="form-label" for="ic-w-title">' + (b.kind === 'archive' ? '자료명' : b.kind === 'case' ? '사례' : '제목') + req + '</label>' +
            '<input type="text" class="form-input" id="ic-w-title" maxlength="100" value="' + esc(d.title) + '">');
        if (b.kind === 'archive') {
            html += row('<label class="form-label" for="ic-w-cat">구분' + req + '</label>' +
                '<select class="form-select" id="ic-w-cat"><option value="">구분 선택</option>' +
                B().CATS.map(function (c) { return '<option' + (d.cat === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') +
                '</select>');
        }
        if (b.kind === 'case') {
            var fixed = deptFixed();
            html += row('<label class="form-label" for="ic-w-dept">부서' + req + '</label>' +
                (fixed
                    ? '<input type="text" class="form-input" id="ic-w-dept" readonly value="' + esc(fixed) + '">'
                    : '<div class="orgpick-field" id="ic-w-dept-field"><div style="display:flex;gap:var(--sp-2);">' +
                        '<input type="text" class="form-input" id="ic-w-dept" readonly placeholder="조직도에서 부서 선택" style="flex:1;" value="' + esc(d.dept) + '">' +
                        '<button type="button" class="btn btn-outline" onclick="ORGPICK.toggle(\'ic-w-dept-field\',\'dept\',\'DYINFO.pickDept\')">조직도</button>' +
                      '</div></div>'));
        }
        html += row('<label class="form-label" for="ic-w-body">내용</label>' +
            '<textarea class="form-textarea" id="ic-w-body" rows="5">' + esc(d.body) + '</textarea>');
        html += '<div class="form-label">첨부</div>' +
            V().uploadDrop('파일을 끌어다 놓거나 클릭해 고르세요', null, { pick: 'DYINFO.onFiles', multiple: true, hint: true }) +
            '<ul class="bd-files" id="ic-w-files">' + fileItems() + '</ul>';
        V().openModal(esc(b.name) + ' — 글 등록', html,
            '<button type="button" class="btn btn-outline" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="DYINFO.save()">등록</button>');
    }
    function fileItems() {
        return (S.draft.files || []).map(function (f, i) {
            return '<li><span>' + esc(f.name) + '</span>' +
                '<button type="button" class="btn btn-sm btn-outline" onclick="DYINFO.dropFile(' + i + ')" aria-label="' + esc(f.name) + ' 빼기">빼기</button></li>';
        }).join('');
    }
    function onFiles(items) {
        if (!S.draft) return;
        var max = V().FILE_LIMITS.maxCount;
        items.forEach(function (f) { if (S.draft.files.length < max) S.draft.files.push({ name: f.name, size: f.size }); });
        var el = document.getElementById('ic-w-files');
        if (el) el.innerHTML = fileItems();
    }
    function dropFile(i) {
        if (!S.draft) return;
        S.draft.files.splice(i, 1);
        var el = document.getElementById('ic-w-files');
        if (el) el.innerHTML = fileItems();
    }
    function pickDept(name) { var el = document.getElementById('ic-w-dept'); if (el) el.value = name; }
    function save() {
        var b = curBoard();
        capture();
        var d = S.draft || {};
        var r = B().addPost(b.id, { title: d.title, body: d.body, cat: d.cat, deptName: d.dept, files: d.files });
        if (!r.ok) { V().toast(r.msg); return; }
        S.draft = null;
        V().closeModal(true);
        S.q = '';
        var q = document.getElementById('ic-q'); if (q) q.value = '';
        render();
        V().toast('«' + b.name + '»에 글을 등록했습니다' + (r.post.files.length ? ' — 첨부 파일은 파일 저장소 연계 후 내려받을 수 있습니다' : '') + '.');
    }

    global.DYINFO = {
        init: init, setTab: setTab, setQ: setQ, setCat: setCat,
        open: open, recommend: recommend, askRemove: askRemove, remove: remove,
        openWrite: openWrite, onFiles: onFiles, dropFile: dropFile, pickDept: pickDept, save: save
    };
})(window);
