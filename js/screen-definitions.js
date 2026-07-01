/* =========================================================================
 * 화면 정의서 뷰어 (개발용) — screen-definitions.html 전용
 *  - 데이터: window.SCREEN_DEFS (js/screen-defs-data.js, file:// 에서도 동작)
 *  - 기능: 목록/검색/필터 · 마크다운 미리보기/원문 · 복사 · 개별 MD 다운로드 · 전체 ZIP · 원본 화면 이동
 * ========================================================================= */
(function () {
    'use strict';

    var D = window.SCREEN_DEFS;
    if (!D) {
        document.getElementById('sd-content').innerHTML =
            '<div class="sd-pending">데이터(js/screen-defs-data.js)를 불러오지 못했습니다.</div>';
        return;
    }

    /* ── 선택 가능한 아이템(평면 리스트) 구성: 공통문서 + 화면 ── */
    var COMMON = (D.commonDocs || []).map(function (c) {
        return { kind: 'common', key: c.key, title: c.title, fileName: c.fileName, raw: c.rawMarkdown };
    });
    var SCREENS = (D.manifest || []).map(function (m) {
        return {
            kind: 'screen', scrId: m.scrId, name: m.name, daemenu: m.daemenu, jungmenu: m.jungmenu,
            type: m.type, route: m.route, file: m.file, components: m.components,
            existingSfr: m.existingSfr, defFile: m.defFile, unresolved: m.unresolvedCount,
            estimated: !!m.unresolvedEstimated, hasDoc: !!m.hasDoc
        };
    });

    var state = { tab: 'preview', q: '', menu: '', type: '', status: '', current: null, visible: [] };

    var $ = function (id) { return document.getElementById(id); };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    }); };

    /* ── 상단 메타 & 필터 옵션 ── */
    var writtenN = SCREENS.filter(function (s) { return s.hasDoc; }).length;
    $('sd-topmeta').textContent =
        '총 ' + SCREENS.length + '개 화면 · 작성 ' + writtenN + ' · 미작성 ' + (SCREENS.length - writtenN) + ' · 생성 ' + (D.generatedAt || '');

    (function fillFilters() {
        var menus = [], types = [];
        SCREENS.forEach(function (s) {
            if (s.daemenu && menus.indexOf(s.daemenu) < 0) menus.push(s.daemenu);
            if (s.type && types.indexOf(s.type) < 0) types.push(s.type);
        });
        var fm = $('sd-filter-menu'), ft = $('sd-filter-type');
        menus.forEach(function (m) { var o = document.createElement('option'); o.value = m; o.textContent = m; fm.appendChild(o); });
        types.forEach(function (t) { var o = document.createElement('option'); o.value = t; o.textContent = t; ft.appendChild(o); });
    })();

    /* ── raw 마크다운 얻기 ── */
    function rawOf(item) {
        if (!item) return null;
        if (item.kind === 'common') return item.raw || null;
        return item.hasDoc ? (D.docs[item.defFile] || null) : null;
    }
    function fileNameOf(item) {
        if (!item) return 'screen.md';
        return item.kind === 'common' ? item.fileName : item.defFile;
    }

    /* ── 원본 화면 URL 해석 — 모든 화면이 해당 메뉴 페이지로 이동하도록 보정 ──
     * 1) 라우트에 실제 .html 이 있으면 사용(문서상세 {id} 템플릿은 처리유형별 샘플 문서로 보정)
     * 2) .html 이 없는 팝업/공통/전역 화면은 scrId 보정 → 대메뉴 대표 페이지로 폴백 */
    var SAMPLE_DOC = {
        '첨부파일': 'doc-detail.html?id=V2-002&v=2',
        '전자문서': 'doc-detail.html?id=V2-013&v=2',
        '프로그램': 'doc-detail.html?id=V2-001&v=2',
    };
    var MENU_FALLBACK = {
        '대시보드': 'index.html', '기본정보': 'base-targets.html', '안전보건관리체계': 'risk-list.html',
        '업무문서': 'docs-preset.html', '통계·보고': 'stats.html', '시스템 관리': 'admin-users.html',
        '전자문서(공통)': 'docs-preset.html', '공통/전역': 'index.html',
    };
    var SCR_OVERRIDE = { 'SCR-EDOC-010': 'docs-archive.html', 'SCR-RISK-008': 'risk-list.html' };

    function resolveUrl(item) {
        var route = (item && item.route) || '';
        var m = route.match(/[\w\-]+\.html(\?[^\s)]*)?/);
        if (m) {
            var u = m[0];
            if (u.indexOf('{') >= 0) {
                if (u.indexOf('doc-detail') >= 0) {
                    var ptm = route.match(/processType=([^)\s]+)/);
                    var pt = ptm ? ptm[1] : '';
                    return SAMPLE_DOC[pt] || u.split('?')[0];
                }
                return u.split('?')[0];
            }
            return u;
        }
        return SCR_OVERRIDE[item.scrId] || MENU_FALLBACK[item.daemenu] || 'index.html';
    }

    /* ── 목록 렌더 ── */
    function matches(s) {
        if (state.menu && s.daemenu !== state.menu) return false;
        if (state.type && s.type !== state.type) return false;
        if (state.status === 'done' && !s.hasDoc) return false;
        if (state.status === 'todo' && s.hasDoc) return false;
        if (state.q) {
            var q = state.q.toLowerCase();
            if ((s.name || '').toLowerCase().indexOf(q) < 0 &&
                (s.scrId || '').toLowerCase().indexOf(q) < 0 &&
                (s.jungmenu || '').toLowerCase().indexOf(q) < 0) return false;
        }
        return true;
    }
    function commonMatches(c) {
        if (state.menu || state.type || state.status) return false; /* 메뉴/유형/작성상태 필터 시 공통문서 숨김 */
        if (state.q) return (c.title || '').toLowerCase().indexOf(state.q.toLowerCase()) >= 0;
        return true;
    }

    function renderList() {
        var list = $('sd-list');
        list.innerHTML = '';
        state.visible = [];

        var commons = COMMON.filter(commonMatches);
        var screens = SCREENS.filter(matches);

        if (!commons.length && !screens.length) {
            list.innerHTML = '<div class="sd-empty-list">검색 결과가 없습니다.</div>';
            return;
        }

        function addItem(item, label) {
            var idx = state.visible.length;
            state.visible.push(item);
            var el = document.createElement('div');
            el.className = 'sd-item' + (state.current === item ? ' active' : '');
            el.setAttribute('data-idx', idx);
            el.innerHTML = label;
            el.addEventListener('click', function () { select(item); });
            list.appendChild(el);
            return el;
        }

        if (commons.length) {
            var gt = document.createElement('div'); gt.className = 'sd-group-title'; gt.textContent = '공통 문서';
            list.appendChild(gt);
            commons.forEach(function (c) {
                addItem(c,
                    '<div class="sd-item-top"><span class="sd-name">' + esc(c.title) + '</span></div>' +
                    '<div class="sd-item-bot"><span class="sd-badge type">' + esc(c.fileName) + '</span></div>');
            });
        }

        /* 대메뉴별 그룹 */
        var lastMenu = null;
        screens.forEach(function (s) {
            if (s.daemenu !== lastMenu) {
                lastMenu = s.daemenu;
                var gt2 = document.createElement('div'); gt2.className = 'sd-group-title'; gt2.textContent = s.daemenu || '기타';
                list.appendChild(gt2);
            }
            var needCls = (s.unresolved > 0) ? 'need' : 'need zero';
            var statusBadge = s.hasDoc ? '<span class="sd-badge ready">작성됨</span>' : '<span class="sd-badge pending">미작성</span>';
            /* 미결 배지: 작성된 정의서는 실제 §7 건수, 미작성은 추정치임을 표시 */
            var needBadge = s.hasDoc
                ? '<span class="sd-badge ' + needCls + '">확인필요 ' + (s.unresolved || 0) + '</span>'
                : (s.unresolved > 0 ? '<span class="sd-badge need">확인필요(예상) ' + s.unresolved + '</span>' : '');
            var el = addItem(s,
                '<div class="sd-item-top"><span class="sd-id">' + esc(s.scrId) + '</span></div>' +
                '<div class="sd-item-top"><span class="sd-name">' + esc(s.name) + '</span></div>' +
                '<div class="sd-item-bot">' +
                    '<span class="sd-badge type">' + esc(s.type) + '</span>' +
                    statusBadge +
                    needBadge +
                '</div>');
            if (!s.hasDoc) el.classList.add('is-pending');
        });
    }

    /* ── 마크다운 → HTML (표 가로스크롤 래핑 + [확인필요] 강조) ── */
    function renderMarkdown(raw) {
        var html;
        if (window.marked && (window.marked.parse || typeof window.marked === 'function')) {
            html = (window.marked.parse ? window.marked.parse(raw) : window.marked(raw));
        } else {
            html = '<pre>' + esc(raw) + '</pre>';
        }
        html = html.replace(/<table>/g, '<div class="sd-tablewrap"><table>').replace(/<\/table>/g, '</table></div>');
        html = html.replace(/\[확인필요\]/g, '<mark class="sd-need">[확인필요]</mark>');
        return html;
    }

    /* ── 우측 헤더 ── */
    function renderHead(item) {
        var head = $('sd-head');
        if (!item) { head.innerHTML = ''; return; }
        var idx = state.visible.indexOf(item);
        var prevDis = idx <= 0 ? 'disabled' : '';
        var nextDis = (idx < 0 || idx >= state.visible.length - 1) ? 'disabled' : '';

        if (item.kind === 'common') {
            head.innerHTML =
                '<div class="sd-head-top">' +
                    '<h2 class="sd-h-name">' + esc(item.title) + '</h2>' +
                    '<div class="sd-h-actions">' +
                        '<div class="sd-navbtns"><button class="sd-btn" id="sd-prev" ' + prevDis + '>◀ 이전</button>' +
                        '<button class="sd-btn" id="sd-next" ' + nextDis + '>다음 ▶</button></div>' +
                    '</div>' +
                '</div>' +
                '<div class="sd-h-sub"><span>공통 문서</span><span class="sd-h-url"><code>' + esc(item.fileName) + '</code></span></div>';
        } else {
            var url = resolveUrl(item);
            /* 네이티브 앵커로 이동(팝업 차단 회피). 새 탭이 막히면 같은 탭으로라도 이동되도록 보조 핸들러 둠. */
            var openBtn = '<a class="sd-btn primary" id="sd-open" href="' + esc(url) + '" target="_blank" rel="noopener" style="text-decoration:none;" title="이 화면(또는 해당 메뉴 페이지)으로 이동 (새 탭)">↗ 원본 화면 보기</a>';
            head.innerHTML =
                '<div class="sd-head-top">' +
                    '<span class="sd-h-id">' + esc(item.scrId) + '</span>' +
                    '<h2 class="sd-h-name">' + esc(item.name) + '</h2>' +
                    '<span class="sd-badge type">' + esc(item.type) + '</span>' +
                    (item.unresolved > 0 ? '<span class="sd-badge need">확인필요 ' + item.unresolved + '</span>' : '<span class="sd-badge need zero">확인필요 0</span>') +
                    '<div class="sd-h-actions">' +
                        openBtn +
                        '<div class="sd-navbtns"><button class="sd-btn" id="sd-prev" ' + prevDis + '>◀ 이전</button>' +
                        '<button class="sd-btn" id="sd-next" ' + nextDis + '>다음 ▶</button></div>' +
                    '</div>' +
                '</div>' +
                '<div class="sd-h-sub">' +
                    '<span>' + esc(item.daemenu) + (item.jungmenu ? ' &rsaquo; ' + esc(item.jungmenu) : '') + '</span>' +
                    '<span class="sd-h-url">URL <code>' + esc(item.route) + '</code></span>' +
                    (item.existingSfr && item.existingSfr !== '없음' ? '<span>기존 ' + esc(item.existingSfr) + '</span>' : '') +
                '</div>';

            /* 이동은 앵커(href + target=_blank)가 직접 처리 — window.open 팝업 차단 회피 */
        }
        var pb = $('sd-prev'), nb = $('sd-next');
        if (pb) pb.addEventListener('click', function () { if (idx > 0) select(state.visible[idx - 1]); });
        if (nb) nb.addEventListener('click', function () { if (idx >= 0 && idx < state.visible.length - 1) select(state.visible[idx + 1]); });
    }

    /* ── 우측 본문 ── */
    function renderContent(item) {
        var box = $('sd-content');
        var raw = rawOf(item);
        if (!item) { box.innerHTML = '<div class="sd-pending">왼쪽 목록에서 화면을 선택하세요.</div>'; return; }
        if (raw == null) {
            box.innerHTML = '<div class="sd-pending"><b>미작성</b><br>이 화면(' + esc(item.scrId || '') +
                ')의 화면 정의서는 아직 작성되지 않았습니다.<br>좌측 상단 [작성 상태] 필터로 작성됨/미작성을 구분해 볼 수 있습니다.</div>';
            return;
        }
        if (state.tab === 'raw') {
            box.innerHTML = '<div class="sd-raw">' + esc(raw) + '</div>';
        } else {
            box.innerHTML = '<div class="sd-md">' + renderMarkdown(raw) + '</div>';
        }
    }

    /* ── 선택 ── */
    function select(item) {
        state.current = item;
        if (state.visible.indexOf(item) < 0) renderList(); /* 필터 밖이면 목록 갱신 */
        /* active 표시 갱신 */
        var items = document.querySelectorAll('.sd-item');
        items.forEach(function (el) { el.classList.remove('active'); });
        var vi = state.visible.indexOf(item);
        if (vi >= 0 && items[/* common group title 미포함 → data-idx 사용 */0]) {
            document.querySelectorAll('.sd-item[data-idx="' + vi + '"]').forEach(function (el) { el.classList.add('active'); });
        }
        renderHead(item);
        renderContent(item);
        /* 스크롤 상단 */
        $('sd-content').scrollTop = 0;
        /* 딥링크 갱신(공유 가능) */
        try {
            var u = new URL(location.href);
            u.searchParams.delete('from'); u.searchParams.delete('doc'); u.searchParams.delete('scr'); u.searchParams.delete('file');
            if (item.kind === 'common') u.searchParams.set('doc', item.key);
            else u.searchParams.set('scr', item.scrId);
            history.replaceState(null, '', u);
        } catch (e) {}
    }

    /* ── 탭 ── */
    document.querySelectorAll('.sd-tab').forEach(function (t) {
        t.addEventListener('click', function () {
            document.querySelectorAll('.sd-tab').forEach(function (x) { x.classList.remove('active'); });
            t.classList.add('active');
            state.tab = t.getAttribute('data-tab');
            renderContent(state.current);
        });
    });

    /* ── 토스트 ── */
    var toastTimer = null;
    function toast(msg, isErr) {
        var el = $('sd-toast');
        el.textContent = msg;
        el.className = 'sd-toast show' + (isErr ? ' err' : '');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { el.className = 'sd-toast'; }, 2200);
    }

    /* ── 복사 ── */
    function copyText(text, okMsg) {
        function fallback() {
            try {
                var ta = document.createElement('textarea');
                ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta); ta.focus(); ta.select();
                var ok = document.execCommand('copy');
                document.body.removeChild(ta);
                if (ok) toast(okMsg); else toast('복사하지 못했습니다. 원문 탭에서 직접 복사해 주세요.', true);
            } catch (e) { toast('복사하지 못했습니다. 원문 탭에서 직접 복사해 주세요.', true); }
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, fallback);
        } else { fallback(); }
    }
    $('sd-copy-btn').addEventListener('click', function () {
        var raw = rawOf(state.current);
        if (raw == null) { toast('복사할 정의서가 없습니다(준비중).', true); return; }
        copyText(raw, '화면 정의서 Markdown이 복사되었습니다.');
    });

    /* ── 다운로드(개별 MD) ── */
    function downloadBlob(filename, blob) {
        var a = document.createElement('a');
        var url = URL.createObjectURL(blob);
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    }
    $('sd-dl-btn').addEventListener('click', function () {
        var raw = rawOf(state.current);
        if (raw == null) { toast('다운로드할 정의서가 없습니다(준비중).', true); return; }
        downloadBlob(fileNameOf(state.current), new Blob([raw], { type: 'text/markdown;charset=utf-8' }));
        toast(fileNameOf(state.current) + ' 다운로드');
    });

    /* ── 전체 ZIP 다운로드(폴백: 통합 MD) ── */
    function collectAll() {
        var files = [];
        COMMON.forEach(function (c) { if (c.raw) files.push([c.fileName, c.raw]); });
        SCREENS.forEach(function (s) { if (s.hasDoc && D.docs[s.defFile]) files.push([s.defFile, D.docs[s.defFile]]); });
        return files;
    }
    $('sd-zip-btn').addEventListener('click', function () {
        var files = collectAll();
        if (!files.length) { toast('내보낼 문서가 없습니다.', true); return; }
        if (window.JSZip) {
            var zip = new window.JSZip();
            var folder = zip.folder('screen-definitions');
            files.forEach(function (f) { folder.file(f[0], f[1]); });
            toast('ZIP 생성 중…');
            zip.generateAsync({ type: 'blob' }).then(function (blob) {
                downloadBlob('담양군_중대재해_화면정의서.zip', blob);
                toast('전체 ' + files.length + '개 문서 ZIP 다운로드');
            }, function () { toast('ZIP 생성 실패 — 통합 MD로 대체합니다.', true); fallbackCombined(files); });
        } else {
            fallbackCombined(files);
        }
    });
    function fallbackCombined(files) {
        var parts = files.map(function (f) { return '\n\n<!-- ===== ' + f[0] + ' ===== -->\n\n' + f[1]; });
        downloadBlob('담양군_중대재해_화면정의서_통합.md', new Blob([parts.join('\n')], { type: 'text/markdown;charset=utf-8' }));
        toast('통합 Markdown으로 다운로드했습니다.');
    }

    /* ── 검색/필터 ── */
    $('sd-search').addEventListener('input', function () { state.q = this.value.trim(); renderList(); });
    $('sd-filter-menu').addEventListener('change', function () { state.menu = this.value; renderList(); });
    $('sd-filter-type').addEventListener('change', function () { state.type = this.value; renderList(); });
    $('sd-filter-status').addEventListener('change', function () { state.status = this.value; renderList(); });

    /* ── 딥링크 해석(?doc= / ?scr= / ?file= / ?from=파일+쿼리) ── */
    function resolveFrom(fromVal) {
        var base = fromVal.split('?')[0].toLowerCase();
        var qs = fromVal.indexOf('?') >= 0 ? fromVal.slice(fromVal.indexOf('?') + 1) : '';
        var p = new URLSearchParams(qs);
        var m = p.get('m'), tab = p.get('tab');
        var cand = SCREENS.filter(function (s) { return (s.file || '').toLowerCase() === base || (s.route || '').toLowerCase().indexOf(base) === 0; });
        if (!cand.length) return null;
        if (m) { var byM = cand.filter(function (s) { return (s.route || '').indexOf('m=' + m) >= 0; }); if (byM.length) return byM[0]; }
        if (tab) { var byT = cand.filter(function (s) { return (s.route || '').indexOf('tab=' + tab) >= 0; }); if (byT.length) return byT[0]; }
        return cand[0];
    }
    function initialSelection() {
        var p = new URLSearchParams(location.search);
        var item = null;
        if (p.get('doc')) item = COMMON.filter(function (c) { return c.key === p.get('doc'); })[0];
        if (!item && p.get('scr')) item = SCREENS.filter(function (s) { return s.scrId === p.get('scr'); })[0];
        if (!item && p.get('file')) item = SCREENS.filter(function (s) { return s.defFile === p.get('file'); })[0];
        if (!item && p.get('from')) item = resolveFrom(p.get('from'));
        return item || COMMON[0] || SCREENS[0] || null;
    }

    /* ── 시작 ── */
    renderList();
    select(initialSelection());
})();
