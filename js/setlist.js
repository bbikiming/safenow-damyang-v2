/* =========================================================================
 * 업무 목록 — 세트 단위 그룹 테이블 컴포넌트 (목업 Variant 1 구조 차용, v2 디자인 토큰 유지)
 *   세트 카드 헤더([대메뉴 칩] 세트명 · n건·완료 m · 선행 칩) + 하위 PDCA 단계 rowspan 테이블.
 *   세트 마스터: sets-data.js (49세트 · 선행관계) / 문서 배정: DY_DOC_SET (휴리스틱 — TODO 정식 매핑 교체)
 *   사용처: docs-preset.html(전체, 대메뉴 탭 포함) · menu.js [문서] 탭(menuKey 고정, 탭 숨김)
 *
 *   DYSETLIST.render(el, { menuKey: null|'policy'…, hideTabs: false })
 * ========================================================================= */
(function () {
    'use strict';

    const PDCA_ORDER = ['P', 'D', 'C', 'A', 'REVIEW', ''];
    const PDCA_LABEL = { P: 'P 계획', D: 'D 실행', C: 'C 점검', A: 'A 조치', REVIEW: '미확정', '': '단계 없음' };
    const MENU_ORDER = ['policy', 'org', 'risk', 'hazard', 'edu', 'opinion', 'contract', 'improve', 'comply'];

    /* 세트 테이블 컬럼 헤더 (docRow 7열과 1:1 정렬) */
    const SL_HEAD = '<thead class="sl-thead"><tr>' +
        '<th class="sl-th-pdca">PDCA 단계</th>' +
        '<th>문서명</th>' +
        '<th>담당자</th>' +
        '<th>담당부서</th>' +
        '<th>수정일</th>' +
        '<th>상태</th>' +
        '<th class="col-action">관리</th>' +
        '</tr></thead>';

    function render(el, opts) {
        const V = window.DYV2, E = window.EDOC;
        const esc = V.esc;
        opts = opts || {};
        const fixedMenu = opts.menuKey || null;

        /* 버전: v1(기존 51세트) / v2(법적의무 재분류 53세트). 기본 v1 — 페이지에서 명시적으로 v2 지정 */
        const ver = opts.version === 'v2' ? 'v2' : 'v1';
        const isV2 = ver === 'v2';

        /* 세트에 표시할 문서·세트·메뉴 메타 — 버전별 데이터 소스 선택 */
        const HAS_REG = isV2 && window.DYREG;
        const SETS = isV2 ? window.DY_SETS_V2 : window.DY_SETS;
        const DOC_SET = isV2 ? window.DY_DOC_SET_V2 : window.DY_DOC_SET;
        /* v2는 DYREG.allDocs()로 시드+사용자 등록 문서를 합쳐 조회 (등록·삭제 후 즉시 반영) */
        function getAll() { return HAS_REG ? window.DYREG.allDocs() : (isV2 ? (window.DY_DOCS_V2 || []) : V.docs().filter(d => d.menuKey !== 'unassigned')); }
        function setIdOf(d) { return HAS_REG ? window.DYREG.setIdOf(d) : DOC_SET[d.id]; }
        const MENU_META = isV2 ? window.DY_MENUS_V2 : V.MENUS;
        const MENU_KEYS = isV2 ? window.MENU_ORDER_V2 : MENU_ORDER;

        let tab = fixedMenu || '';        // '' = 전체
        let q = '', stFilter = '', pdcaFilter = '', onlyFlagged = false;

        /* ── 문서 행 클릭 → 상세 페이지 (첨부=미리보기 / 전자문서=입력폼 / 프로그램=이동 안내) ── */
        const detailHref = d => 'doc-detail.html?id=' + d.id + (isV2 ? '&v=2' : '');
        const ACT_LABEL = { 전자문서: '입력', 첨부파일: '미리보기', 프로그램: '이동' };
        function actionBtn(d) {
            return '<a class="btn btn-sm btn-outline" href="' + detailHref(d) + '">' + (ACT_LABEL[d.processType] || '상세') + ' →</a>';
        }
        /* 사용자 등록 문서만 행에서 편집·삭제 (시드 문서는 조회만) */
        function userActions(d) {
            if (!HAS_REG || !window.DYREG.isUser(d.id)) return '';
            return ' <button class="btn btn-sm btn-secondary" data-edit="' + d.id + '">편집</button>' +
                ' <button class="btn btn-sm btn-secondary" data-del="' + d.id + '">삭제</button>';
        }
        function stChip(d) {
            const st = E.statusOf(d.id);
            return st ? (E.STCHIP[st] || '') : V.statusChip(d.status);
        }
        /* ── PDCA 무결성 검증 배지 (v2 — sets-data-v2.js의 valid/validMsg) ── */
        function validBadge(s) {
            if (!isV2 || !s || !s.valid || s.valid === 'ok') return '';
            const cls = s.valid === 'error' ? 'sl-vbadge err' : 'sl-vbadge warn';
            return '<span class="' + cls + '" title="' + esc(s.validMsg || '') + '">' + esc(s.validMsg || '검토 필요') + '</span>';
        }
        function flowBadge(s) {
            if (!isV2 || !s || !s.pdcaFlow) return '';
            return '<span class="sl-flow" title="이 세트의 PDCA 단계 구성">' + s.pdcaFlow.split('').join('·') + '</span>';
        }

        function docRow(d, pdcaCell) {
            return '<tr>' + pdcaCell +
                '<td class="sl-name"><a href="' + detailHref(d) + '" class="sl-name-link">' + esc(d.name) + '</a></td>' +
                '<td class="sl-dim">' + esc(d.assignee || '-') + '</td>' +
                '<td class="sl-dim">' + esc(d.dept) + '</td>' +
                '<td class="sl-dim">' + esc(d.updated) + '</td>' +
                '<td>' + stChip(d) + '</td>' +
                '<td class="col-action">' + actionBtn(d) + userActions(d) + '</td></tr>';
        }

        /* ── 세트 카드 1장 (V1: PDCA rowspan 테이블) ── */
        function setCard(s, docs) {
            const done = docs.filter(d => (E.statusOf(d.id) === '확정') || (!E.statusOf(d.id) && d.status === '완료')).length;
            const isBase = s.order === 0;
            let body = '';
            PDCA_ORDER.forEach(step => {
                const sd = docs.filter(d => (d.pdca || '') === step);
                if (!sd.length) return;   // 해당 문서가 있는 단계만 행 생성 — 빈 단계 강제 없음
                sd.forEach((d, i) => {
                    const cell = i === 0
                        ? '<td class="sl-pdca' + (step === 'REVIEW' ? ' rev' : '') + '" rowspan="' + sd.length + '">' + PDCA_LABEL[step] + '</td>'
                        : '';
                    body += docRow(d, cell);
                });
            });
            return '<div class="set-card">' +
                '<div class="set-card-head">' +
                    '<span class="chip-mini pdca">' + esc(s.menu) + '</span>' +
                    '<b class="sl-set-name">' + esc(s.name) + '</b>' +
                    (isBase ? '<span class="chip-mini wt-attach">기준문서</span>' : '') +
                    '<span class="sl-count">' + docs.length + '건 · 완료 ' + done + '</span>' +
                    flowBadge(s) + validBadge(s) +
                    (s.pre ? '<span class="sl-pre" title="세트 간 선행관계">선행: ' + esc(s.pre) + '</span>' : '') +
                    (s.note ? '<span class="sl-pre" style="opacity:.7;">' + esc(s.note) + '</span>' : '') +
                '</div>' +
                '<div class="sl-scroll"><table class="sl-table">' + SL_HEAD + '<tbody>' + body + '</tbody></table></div>' +
            '</div>';
        }

        /* ── 격자 카드형 (이행 목록 — 목업 격자 카드 레이아웃 차용) ──
         * 카드: 헤더(세트명·마감 칩·진행률 바) + 본문(PDCA 단계 도트 + 문서 행) + 푸터(담당자·대메뉴 칩) */
        function docRowAction(d) {
            return "location.href='" + detailHref(d) + "'";   // 카드 문서 행 클릭 → 상세 페이지
        }
        function gridCard(s, docs, isUnassigned) {
            const done = docs.filter(d => (E.statusOf(d.id) === '확정') || (!E.statusOf(d.id) && d.status === '완료')).length;
            const pct = Math.round(done / docs.length * 100);
            const barCls = pct >= 100 ? 'green' : pct >= 40 ? 'green' : 'warning';
            const dues = docs.map(d => d.due).filter(Boolean).sort();
            const due = dues.length ? dues[dues.length - 1].slice(2) : '-';
            const rep = docs[0];
            let body = '';
            PDCA_ORDER.forEach(step => {
                const sd = docs.filter(d => (d.pdca || '') === step);
                if (!sd.length) return;
                body += '<div class="slg-stage"><span class="slg-dot' + (step === 'REVIEW' ? ' rev' : '') + '"></span>' + PDCA_LABEL[step] + '</div>' +
                    sd.map(d =>
                        '<div class="slg-doc" onclick="' + docRowAction(d) + '" title="' + esc(d.name) + '">' +
                        '<span class="slg-doc-name">' + esc(d.name) + '</span>' + stChip(d) + '</div>'
                    ).join('');
            });
            return '<div class="slg-card"' + (isUnassigned ? ' style="border-style:dashed;"' : '') + '>' +
                '<div class="slg-head">' +
                    '<div class="slg-head-top">' +
                        '<b class="slg-title">' + esc(s.name) + '</b>' +
                        (validBadge(s) || '<span class="slg-due">' + (s.pdcaFlow ? s.pdcaFlow.split('').join('·') : '마감: ' + due) + '</span>') +
                    '</div>' +
                    '<div class="slg-progress"><div class="progress"><div class="progress-bar ' + barCls + '" style="width:' + pct + '%"></div></div>' +
                    '<b style="font-size:12px; color:var(--main-dark);">' + pct + '%</b></div>' +
                '</div>' +
                '<div class="slg-body">' + body + '</div>' +
                '<div class="slg-foot">' +
                    '<span class="slg-owner">' + esc(rep.assignee || '-') + ' (' + esc(rep.dept) + ')</span>' +
                    (isUnassigned ? '<span class="v2-todo" style="padding:2px 8px;">TODO 미지정</span>' : '<span class="chip-mini pdca">' + esc(s.menu) + '</span>') +
                '</div>' +
            '</div>';
        }

        /* ── 미지정 그룹 (휴리스틱 미배정 — TODO) ── */
        function unassignedCard(menuLabel, docs) {
            let body = '';
            docs.forEach((d, i) => {
                const cell = i === 0 ? '<td class="sl-pdca" rowspan="' + docs.length + '">-</td>' : '';
                body += docRow(d, cell);
            });
            return '<div class="set-card" style="border-style:dashed;">' +
                '<div class="set-card-head">' +
                    '<span class="chip-mini pdca">' + esc(menuLabel) + '</span>' +
                    '<b class="sl-set-name">세트 미지정</b>' +
                    '<span class="v2-todo">TODO 정식 매핑 시트 수령 후 배정</span>' +
                    '<span class="sl-count">' + docs.length + '건</span>' +
                '</div>' +
                '<div class="sl-scroll"><table class="sl-table">' + SL_HEAD + '<tbody>' + body + '</tbody></table></div>' +
            '</div>';
        }

        function filtered() {
            return getAll().filter(d =>
                (!tab || d.menuKey === tab) &&
                (!stFilter || d.status === stFilter) &&
                (!pdcaFilter || (d.pdca || '') === pdcaFilter) &&
                (!q || d.name.indexOf(q) >= 0 || (d.assignee || '').indexOf(q) >= 0));
        }

        function renderBody() {
            const list = filtered();
            const menus = tab ? [tab] : MENU_KEYS;
            const grid = opts.layout === 'grid';
            let html = '';
            let setCount = 0;
            menus.forEach(mk => {
                const menuDocs = list.filter(d => d.menuKey === mk);
                if (!menuDocs.length) return;
                SETS.filter(s => s.menuKey === mk).sort((a, b) => a.order - b.order).forEach(s => {
                    if (onlyFlagged && (!s.valid || s.valid === 'ok')) return;   // 검증 주의/오류 세트만 보기
                    const docs = menuDocs.filter(d => setIdOf(d) === s.id);
                    if (!docs.length) return;
                    html += grid ? gridCard(s, docs, false) : setCard(s, docs);
                    setCount++;
                });
                const un = menuDocs.filter(d => !setIdOf(d));
                if (un.length && !onlyFlagged) {
                    html += grid
                        ? gridCard({ name: '세트 미지정', menu: MENU_META[mk].label }, un, true)
                        : unassignedCard(MENU_META[mk].label, un);
                }
            });
            if (grid && html) html = '<div class="sl-grid">' + html + '</div>';
            el.querySelector('#sl-body').innerHTML = html ||
                '<div class="card"><div class="card-body"><div class="v2-empty">조건에 맞는 문서가 없습니다.</div></div></div>';
            el.querySelector('#sl-summary').textContent =
                '세트 ' + setCount + '개 · 문서 ' + list.length + '건' + (tab ? '' : ' · ' + MENU_KEYS.length + '개 대메뉴');
        }

        /* ── 버전 토글 (기존 v1 ↔ 법적의무 재분류 v2) — 전체 목록 화면에서만 ── */
        const verToggle = opts.hideTabs ? '' :
            '<div class="sl-vertoggle">' +
                '<span class="sl-vt-label">분류 버전</span>' +
                '<button class="' + (!isV2 ? 'on' : '') + '" data-ver="v1">기존 분류 (51세트)</button>' +
                '<button class="' + (isV2 ? 'on' : '') + '" data-ver="v2">법적의무 재분류 v2 (53세트)</button>' +
            '</div>';

        /* ── PDCA 검증 배너 (v2 — 세트별 무결성: sets-data-v2.js valid) ── */
        let validBanner = '';
        if (isV2 && !opts.hideTabs) {
            const ok = SETS.filter(s => s.valid === 'ok').length;
            const warn = SETS.filter(s => s.valid === 'warn');
            const err = SETS.filter(s => s.valid === 'error');
            const allClear = !warn.length && !err.length;
            validBanner =
                '<div class="sl-valbanner ' + (allClear ? 'ok' : 'warn') + '">' +
                    '<span class="sl-vb-ico">' + (allClear ? '✓' : '✕') + '</span>' +
                    '<span class="sl-vb-text"><b>PDCA 규칙 검증</b> — ' +
                        (allClear
                            ? '전체 ' + SETS.length + '개 세트 모두 정상입니다 (오류 없음).'
                            : '정상 ' + ok + ' · 주의 ' + warn.length + ' · 오류 ' + err.length +
                              ' &nbsp;(' + warn.concat(err).map(s => s.id).join(', ') + ')') +
                    '</span>' +
                    (allClear ? '' :
                        '<button class="sl-vb-btn ' + (onlyFlagged ? 'on' : '') + '" id="sl-vb-filter">' +
                        (onlyFlagged ? '전체 보기' : '검토 대상만 보기') + '</button>') +
                '</div>';
        }

        /* ── 셸 (버전토글 + 탭 + 툴바 + 본문) ── */
        const tabsHtml = opts.hideTabs ? '' :
            '<div class="sl-tabs" id="sl-tabs">' +
                '<button data-mk="" class="' + (!tab ? 'on' : '') + '">전체</button>' +
                MENU_KEYS.map(mk =>
                    '<button data-mk="' + mk + '" class="' + (tab === mk ? 'on' : '') + '">' + MENU_META[mk].label + '</button>').join('') +
            '</div>';

        el.innerHTML =
            verToggle +
            validBanner +
            tabsHtml +
            '<div class="v2-toolbar">' +
                '<div class="search-bar"><input class="search-input" id="sl-q" type="text" placeholder="문서명·담당자 검색"><button class="search-submit" type="button">검색</button></div>' +
                '<select class="select" id="sl-st"><option value="">상태 전체</option><option>완료</option><option>진행</option><option>미시행</option></select>' +
                '<div class="pdca-filter" id="sl-pdca">' +
                    '<button data-v="" class="on">전체</button><button data-v="P">P 계획</button><button data-v="D">D 실행</button>' +
                    '<button data-v="C">C 점검</button><button data-v="A">A 조치</button><button data-v="REVIEW">미확정</button>' +
                '</div>' +
                '<span class="spacer"></span>' +
                '<span id="sl-summary" style="font-size:12px; color:var(--text-gray); font-weight:600;"></span>' +
                (isV2 ? '<button class="btn btn-sm btn-primary" id="sl-add">+ 업무 등록</button>' : '') +
                '<button class="btn btn-sm btn-secondary" onclick="DYV2.toast(\'목록 다운로드 — 업무목록_2026-06-11.xlsx (프로토타입)\')">목록 다운로드</button>' +
            '</div>' +
            '<div id="sl-body"></div>';

        /* 이벤트 */
        if (!opts.hideTabs) {
            el.querySelector('.sl-vertoggle').addEventListener('click', e => {
                const b = e.target.closest('button'); if (!b) return;
                const newVer = b.dataset.ver;
                if (newVer === ver) return;
                render(el, Object.assign({}, opts, { version: newVer, menuKey: null }));
            });
            el.querySelector('#sl-tabs').addEventListener('click', e => {
                const b = e.target.closest('button'); if (!b) return;
                tab = b.dataset.mk;
                el.querySelectorAll('#sl-tabs button').forEach(x => x.classList.toggle('on', x === b));
                renderBody();
            });
            const vbBtn = el.querySelector('#sl-vb-filter');
            if (vbBtn) vbBtn.addEventListener('click', () => {
                onlyFlagged = !onlyFlagged;
                vbBtn.classList.toggle('on', onlyFlagged);
                vbBtn.textContent = onlyFlagged ? '전체 보기' : '검토 대상만 보기';
                renderBody();
            });
        }
        el.querySelector('#sl-q').addEventListener('input', function () { q = this.value.trim(); renderBody(); });
        el.querySelector('#sl-st').addEventListener('change', function () { stFilter = this.value; renderBody(); });
        el.querySelector('#sl-pdca').addEventListener('click', e => {
            const b = e.target.closest('button'); if (!b) return;
            pdcaFilter = b.dataset.v;
            el.querySelectorAll('#sl-pdca button').forEach(x => x.classList.toggle('on', x === b));
            renderBody();
        });

        /* ── 업무 등록(C) · 행 편집(U)·삭제(D) — v2 + DYREG 로드 시 ── */
        const addBtn = el.querySelector('#sl-add');
        if (addBtn && HAS_REG) addBtn.addEventListener('click', () =>
            window.DYREG.openCreate({ menuKey: tab || undefined, onDone: renderBody }));
        if (HAS_REG) el.querySelector('#sl-body').addEventListener('click', e => {
            const ed = e.target.closest('[data-edit]');
            const dl = e.target.closest('[data-del]');
            if (ed) { e.preventDefault(); window.DYREG.openEdit(ed.dataset.edit, { onDone: renderBody }); }
            else if (dl) { e.preventDefault(); window.DYREG.remove(dl.dataset.del, { onDone: renderBody }); }
        });

        renderBody();
        return { refresh: renderBody };
    }

    window.DYSETLIST = { render };
})();
