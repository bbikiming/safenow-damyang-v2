/* =============================================================================
 *  law-admin.js — 법령 관리 공용 코어 (전역 LAWADM)
 * -----------------------------------------------------------------------------
 *  시스템 관리 > 법령·조문(admin-law) / 메뉴 근거 매핑(admin-law-map) 두 화면이
 *  공유하는 데이터 계층. 화면 모듈은 여기만 바라보고 규칙을 자기 쪽에 복제하지 않는다.
 *
 *  ■ 경계 원칙 (MUST) — 사람은 판단만, 기계는 사실만 쓴다
 *    조문 사실(법령명·조·호·제목·본문·시행일)은 법제처 스냅샷의 생성물이고
 *    이 화면은 그것을 **읽기만** 한다(CLAUDE.md §10). 사람이 남기는 값은
 *    전부 override 네임스페이스에 따로 쌓여 조문 사실을 덮을 수 없다.
 *
 *      base(js/law-map.js)        override(localStorage)
 *      ├ LAWS      법령 메타       ├ articleAdmin  조문 운영 판단(축·생애주기·대체)
 *      ├ ARTICLES  조문 원문       ├ mapOverride   화면별 근거 매핑
 *      └ MAP       기본 매핑       ├ verify        검증 6문 기록
 *                                  ├ basisTriage   미연계 근거 표기 분류
 *                                  └ log           변경 이력(append-only)
 *
 *  ■ 삭제가 없다
 *    조문 물리 삭제·조문키 개명 기능을 두지 않는다. 조문키는 저장 스키마이고
 *    (유해위험요인 hazard.basis 등) 참조가 여러 소스에 흩어져 있어, 지우면
 *    조용히 끊긴다. 대신 `대체 지정 → 보관` 전이만 제공한다.
 *
 *  로드 순서: layout.js → law-map.js → common.js → law-admin.js → 화면 모듈
 * ========================================================================== */
(function (global) {
    'use strict';

    var L = function () { return global.DYLAW; };
    var V = function () { return global.DYV2; };
    function esc(x) { return V().esc(String(x == null ? '' : x)); }

    /* v2 — 스키마 변경 시 범프. 구 버전 스토어는 읽지 않고 시드로 되돌린다.
     * (v2: 2026-07-30 전수 검토 시드 도입 — 검증 기록·근거 없음 사유·표기 분류가
     *  초기 DB 로 실린다. v1 스토어는 시드 없는 빈 상태라 폐기하고 재시드.) */
    var SKEY = 'dy-lawadm-v2';
    var STAGE_KEY = 'dy-lawadm-stage-v1';
    var SVER = 2;
    var LOG_MAX = 200;

    /* ── 스토어 ────────────────────────────────────────────────────────────
     *  localStorage 를 쓴다 — 이웃 시스템 관리 화면(권한·연계 설정)과 같은 급의
     *  **설정 데이터**이기 때문이다. 탭을 닫았다고 검증 기록이 증발하면
     *  "저장했는데 없어졌다" 사고가 된다. 대신 [데모 데이터 초기화]를 반드시 둔다.
     *
     *  ■ 초기 DB 시드 (js/law-admin-seed.js, 전역 DYLAWADMSEED)
     *    2026-07-30 전수 검토의 검증 기록·판정 사유·표기 분류가 blank() 에서
     *    초기값으로 실린다. [데모 데이터 초기화]도 빈 상태가 아니라 이 시드로
     *    되돌아온다 — 검토가 끝난 상태가 이 화면의 영점(零點)이다.
     * ------------------------------------------------------------------- */
    function seed() { return global.DYLAWADMSEED || { verify: {}, noneReasons: {}, basisTriage: {} }; }
    function blank() {
        var S = seed();
        var d = {
            v: SVER, rev: 0,
            mapOverride: {},   /* pageId → { mode:'basis'|'none', items:[{key,role}], reason, at, by } */
            verify: {},        /* pageId|articleKey → [{answers, reason, at, by, againstTitle}] */
            articleAdmin: {},  /* articleKey → { axis, lifecycle, replacedBy, note, at, by } */
            basisTriage: {},   /* 원문표기 → { verdict, note, at, by } */
            log: []            /* append-only. 프로토타입 상한 LOG_MAX */
        };
        /* 검증 기록 시드 — answers(6문 전부 예)·검증 당시 조문 제목은 여기서 파생.
         * againstTitle 을 현재 조문 제목으로 굳혀 두면, 이후 재수집으로 제목이
         * 바뀐 조문의 매핑이 staleVerifies() 에 자동으로 걸린다. */
        Object.keys(S.verify || {}).forEach(function (pid) {
            d.verify[pid] = (S.verify[pid] || []).map(function (r) {
                var art = (L() && L().ARTICLES || {})[r.key] || {};
                return {
                    articleKey: r.key,
                    answers: { q1: true, q2: true, q3: true, q4: true, q5: true, q6: true },
                    reason: r.reason || '',
                    at: (S.reviewedAt || '2026-07-30') + ' 09:00',
                    by: S.reviewer || '전수 검토',
                    againstTitle: art.title || ''
                };
            });
        });
        /* 표기 분류 시드 — 검토-법적근거-정확성-v1 의 53종 판정 */
        Object.keys(S.basisTriage || {}).forEach(function (t) {
            var v = S.basisTriage[t] || {};
            d.basisTriage[t] = {
                verdict: v.verdict || '', note: v.note || '',
                at: (S.reviewedAt || '2026-07-30') + ' 09:00',
                by: S.reviewer || '전수 검토'
            };
        });
        return d;
    }
    var db = null;

    function load() {
        if (db) return db;
        try {
            var raw = global.localStorage.getItem(SKEY);
            var o = raw ? JSON.parse(raw) : null;
            db = (o && o.v === SVER) ? o : blank();
        } catch (e) { db = blank(); }
        return db;
    }
    function save() {
        db.rev = (db.rev || 0) + 1;
        try { global.localStorage.setItem(SKEY, JSON.stringify(db)); } catch (e) {}
    }
    function reset() {
        db = blank();
        try { global.localStorage.removeItem(SKEY); } catch (e) {}
        try { global.sessionStorage.removeItem(STAGE_KEY); } catch (e) {}
    }

    function today() { return '2026-07-30'; }
    function nowTs() { return today() + ' ' + new Date().toTimeString().slice(0, 5); }
    /* 프로토타입에 로그인이 없다. 실 개발에서 로그인 사용자로 대체된다. */
    function actor() { return '시연 계정'; }

    /* ── 이력 ─────────────────────────────────────────────────────────────
     *  전/후 값을 구조화해 남긴다. 없으면 되돌리기도 소명도 불가능하다.
     * ------------------------------------------------------------------- */
    function log(entry) {
        var d = load();
        d.log.unshift({
            at: nowTs(), by: actor(),
            layer: entry.layer || '매핑',      /* 법령 | 조문 | 매핑 | 별칭 | 수집 */
            target: entry.target || '',
            action: entry.action || '',
            before: entry.before == null ? '' : entry.before,
            after: entry.after == null ? '' : entry.after,
            impact: entry.impact || '',
            reason: entry.reason || ''
        });
        var truncated = false;
        if (d.log.length > LOG_MAX) { d.log.length = LOG_MAX; truncated = true; }
        save();
        return truncated;
    }
    function logs() { return load().log.slice(); }

    /* ── 실효 매핑 — base + override 병합 ─────────────────────────────────
     *  **병합은 반드시 이 함수 하나만 쓴다.** 화면이 각자 병합하면
     *  새 화면이 옛 스토어를 가진 브라우저에서만 다르게 보이는, 재현이 어려운
     *  사고가 난다(권한 관리에서 같은 취지의 주석이 이미 있다).
     * ------------------------------------------------------------------- */
    function effective(pageId) {
        var d = load();
        var ov = d.mapOverride[pageId];
        if (ov) return { mode: ov.mode, items: (ov.items || []).slice(), reason: ov.reason || '', source: 'override' };
        var base = (L().MAP || {})[pageId];
        /* MAP 에 키가 아예 없다 = 아직 판정하지 않았다 */
        if (!base) return { mode: 'unset', items: [], reason: '', source: 'none' };
        /* 빈 배열은 "근거 없음"을 **명시적으로 판정한 것**이다(억지 매핑 금지 원칙).
         * 판정 사유는 전수 검토 시드(noneReasons)에서 읽는다 — 없으면 그 사실을 밝힌다. */
        if (!base.length) {
            var why = (seed().noneReasons || {})[pageId] || '';
            return { mode: 'none', items: [], reason: why || '판정 사유 미기록', source: 'base', reasonSeeded: !!why };
        }
        return {
            mode: 'basis',
            items: base.map(function (k) { return { key: k, role: 'duty' }; }),
            reason: '', source: 'base'
        };
    }
    /* 매핑 편집 대상 모집단 — 실제 도달 가능한 페이지 전부 */
    function pageRows() {
        return L().reachablePages().map(function (id) {
            var eff = effective(id);
            var files = L().pagesOf(id);
            var noAnchor = files.filter(function (f) {
                return (L().NO_TITLE_ANCHOR || []).indexOf(f) >= 0;
            });
            return {
                id: id, files: files, eff: eff,
                verified: verifyCount(id),
                /* 근거를 지정해도 칩 앵커가 없어 표시되지 않는 화면 */
                chipBlocked: noAnchor
            };
        });
    }
    function statusOf(row) {
        if (row.eff.mode === 'basis') return '근거 있음';
        if (row.eff.mode === 'none') return '근거 없음(확정)';
        return '미판단';   /* MAP 키 자체가 없는 경우만 */
    }

    /* ── 메뉴 트리 ────────────────────────────────────────────────────────
     *  화면 식별자(rsk-list)는 담당자가 읽을 수 없다. 실제 메뉴명으로 보여준다.
     *  **메뉴명·구조는 NAV(js/layout.js)가 단일 출처**이므로 여기서 복제하지 않고
     *  파생만 한다 — 복제하면 메뉴가 개편될 때 이 화면만 옛 이름으로 남는다.
     *
     *  구조: 대메뉴(NAV 그룹) → [구분(section)] → 중메뉴(NAV 항목)
     *  안전보건교육은 '정기교육'이 현업근로자·관리감독자 양쪽에 있어
     *  section 을 빼면 두 화면을 구별할 수 없다.
     * ------------------------------------------------------------------- */
    function navIndex() {
        var NAV = (global.DYLayout && global.DYLayout.NAV) || [];
        var idx = {};
        NAV.forEach(function (g) {
            (g.items || []).forEach(function (it) {
                idx[it.id] = { group: g.label, groupId: g.id, section: it.section || '', label: it.label };
            });
        });
        return idx;
    }
    /* 한 화면의 사람이 읽는 이름 — '위험성평가 › 정기 위험성평가' */
    function labelOf(pageId) {
        var n = navIndex()[pageId];
        if (!n) return pageId;
        return n.group + ' › ' + (n.section ? n.section + ' ' : '') + n.label;
    }
    function menuTree() {
        var NAV = (global.DYLayout && global.DYLayout.NAV) || [];
        var rows = {}; pageRows().forEach(function (r) { rows[r.id] = r; });
        var used = {};
        var groups = [];

        NAV.forEach(function (g) {
            /* **NAV 정의 순서를 그대로 따른다.** 좌측 사이드바와 순서가 다르면
             * 담당자가 아는 위치에서 메뉴를 찾지 못한다. 구분(section)이 바뀌는
             * 지점에 헤더를 끼워 넣는 방식이라 순서가 보존된다. */
            var nodes = [], all = [], curSec = null;
            (g.items || []).forEach(function (it) {
                var r = rows[it.id];
                if (!r) return;                     /* 관리 대상이 아닌 메뉴는 건너뛴다 */
                used[it.id] = true;
                r.label = it.label; r.group = g.label; r.section = it.section || '';
                var sec = it.section || '';
                if (sec !== curSec) {
                    curSec = sec;
                    if (sec) nodes.push({ type: 'section', name: sec });
                }
                nodes.push({ type: 'item', row: r, depth: sec ? 2 : 1 });
                all.push(r);
            });
            if (!all.length) return;
            groups.push({ id: g.id, label: g.label, nodes: nodes, all: all, summary: summarize(all) });
        });

        /* NAV 에 없지만 관리 대상인 화면 — 메뉴에서 제외됐으나 파일이 살아 있다.
         * 트리에서 빠뜨리면 "관리 화면이 관리하지 못하는 근거"가 생긴다. */
        var orphan = Object.keys(rows).filter(function (id) { return !used[id]; })
            .map(function (id) { var r = rows[id]; r.label = id; r.group = '메뉴 미등록'; r.section = ''; return r; });

        return { groups: groups, orphan: orphan, orphanSummary: summarize(orphan) };
    }
    function summarize(list) {
        var c = { basis: 0, none: 0, unset: 0 };
        list.forEach(function (r) {
            var s = statusOf(r);
            if (s === '근거 있음') c.basis++;
            else if (s === '근거 없음(확정)') c.none++;
            else c.unset++;
        });
        return c;
    }

    /* ── 조문 선택기 ─────────────────────────────────────────────────────
     *  조문이 41건이고 앞으로 수백 건이 된다. 드롭다운으로는 고를 수 없어
     *  검색이 있는 선택 창을 쓴다.
     *
     *  단일 모달 규칙(§1) — 근거 추가 3단계는 인라인 패널이라 이 시점에 열린
     *  모달이 없다. 따라서 여기서 여는 모달 1개는 적층이 아니다.
     *
     *  법령 계열 필터는 **담당자가 부르는 이름**을 따른다 — 중처법 계열(법+시행령),
     *  산안법 계열(법+시행령+시행규칙+기준규칙).
     * ------------------------------------------------------------------- */
    var LAW_FAMILY = [
        { id: 'csa', label: '중대재해처벌법', laws: ['csa', 'cse'] },
        { id: 'osh', label: '산업안전보건법', laws: ['osh', 'oshe', 'oshr', 'oshs', 'rae'] }
    ];
    function familyOf(lawKey) {
        var f = LAW_FAMILY.filter(function (x) { return x.laws.indexOf(lawKey) >= 0; })[0];
        return f ? f.id : 'etc';
    }
    /* 선택기 상태는 모달이 열려 있는 동안만 산다 */
    var pick = null;

    function pickerCount(family, q) {
        return Object.keys(L().ARTICLES).filter(function (k) {
            return pickerHit(k, family, q);
        }).length;
    }
    function pickerHit(k, family, q) {
        var a = L().ARTICLES[k];
        if (!a) return false;
        if (family && familyOf(a.law) !== family) return false;
        if (!q) return true;
        var hay = [k, a.jo, a.clause || '', a.title, a.text, L().shortRef(k)].join(' ');
        return L().normalize(hay).indexOf(L().normalize(q)) >= 0;
    }

    /* 선택 목록만 그린다 — 검색어 입력 중 전체를 다시 그리면 한글 조합이 끊긴다 */
    function pickerListHtml() {
        var arts = L().ARTICLES, laws = L().LAWS;
        var byLaw = {};
        Object.keys(arts).forEach(function (k) {
            if (!pickerHit(k, pick.family, pick.q)) return;
            (byLaw[arts[k].law] = byLaw[arts[k].law] || []).push(k);
        });
        var n = Object.keys(byLaw).reduce(function (s, l) { return s + byLaw[l].length; }, 0);
        if (!n) {
            return '<div class="lawpick-empty">' +
                '조건에 맞는 조문이 없습니다' + (pick.q ? ' — <b>' + esc(pick.q) + '</b>' : '') +
                '<div class="lawpick-empty-sub">조문 번호(§43 · 제43조 · 43)나 제목·본문 낱말로 찾을 수 있습니다.</div>' +
                '<button type="button" class="btn btn-sm btn-outline" onclick="LAWADM.pickerReset()">조건 초기화</button>' +
            '</div>';
        }
        var body = Object.keys(laws).map(function (lk) {
            var list = byLaw[lk] || [];
            if (!list.length) return '';
            var Lw = laws[lk];
            return '<div class="lawpick-group">' +
                '<div class="lawpick-group-head">' +
                    '<span class="lawpick-law">' + esc(Lw.name) + '</span>' +
                    '<span class="lawpick-eff">시행 ' + esc(Lw.efYd) + '</span>' +
                    ((Lw.upcoming || []).length
                        ? '<span class="lawpick-soon">개정 시행예정 ' + Lw.upcoming.length + '건</span>' : '') +
                '</div>' +
                list.map(function (k) {
                    var a = arts[k];
                    var used = L().pagesUsing(k).length;
                    return '<button type="button" class="lawpick-item" onclick="LAWADM.pickerChoose(\'' + k + '\')">' +
                        '<span class="lawpick-ref">' + esc(L().shortRef(k)) + '</span>' +
                        '<span class="lawpick-body">' +
                            '<span class="lawpick-title">' + esc(a.title) + '</span>' +
                            '<span class="lawpick-snip">' + esc(a.text.replace(/\s+/g, ' ').slice(0, 70)) + '…</span>' +
                        '</span>' +
                        '<span class="lawpick-used">' + (used ? '화면 ' + used : '') + '</span>' +
                    '</button>';
                }).join('') +
            '</div>';
        }).join('');
        return body + '<div class="lawpick-count" aria-live="polite">' +
            n + '건 표시 · 전체 ' + Object.keys(arts).length + '건</div>';
    }

    function pickerFilterHtml() {
        var all = Object.keys(L().ARTICLES).length;
        var tabs = [{ id: '', label: '전체', n: pickerCount('', pick.q) }].concat(
            LAW_FAMILY.map(function (f) {
                return { id: f.id, label: f.label, n: pickerCount(f.id, pick.q) };
            }));
        return tabs.map(function (t) {
            return '<button type="button" class="btn btn-sm ' + (pick.family === t.id ? 'btn-primary' : 'btn-outline') + '" ' +
                'onclick="LAWADM.pickerFamily(\'' + t.id + '\')">' + esc(t.label) + ' ' + t.n + '</button>';
        }).join('');
    }

    /* onPick(articleKey) — 고르면 모달이 닫히고 콜백이 실행된다 */
    function openPicker(onPickPath) {
        pick = { q: '', family: '', onPick: onPickPath };
        var S = L().SNAPSHOT;
        V().openModal('조문 선택',
            '<div class="lawpick-src">' +
                '<b>' + esc(S.source) + '</b> 수집분 · 최종 업데이트 <b>' + esc(S.fetchedAt) + '</b>' +
                '<div class="lawpick-src-sub">수집일과 법령별 <b>시행일</b>은 다릅니다 — 시행일은 각 법령 머리에 표시됩니다. ' +
                '조문 본문은 이 화면에서 고칠 수 없고 재수집으로만 바뀝니다.</div>' +
            '</div>' +
            '<div class="lawpick-search">' +
                '<input id="lawpick-q" type="text" aria-label="조문 검색" ' +
                    'placeholder="조문 번호·제목·본문 검색 — §43 · 제43조 · 43 · 개구부" ' +
                    'oninput="LAWADM.pickerSearch(this.value)">' +
            '</div>' +
            '<div class="lawpick-tabs" id="lawpick-tabs">' + pickerFilterHtml() + '</div>' +
            '<div class="lawpick-list" id="lawpick-list">' + pickerListHtml() + '</div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>');
        var el = document.getElementById('lawpick-q');
        if (el) el.focus();
    }
    function pickerSearch(v) {
        if (!pick) return;
        pick.q = v;
        var list = document.getElementById('lawpick-list');
        var tabs = document.getElementById('lawpick-tabs');
        if (list) list.innerHTML = pickerListHtml();
        if (tabs) tabs.innerHTML = pickerFilterHtml();
    }
    function pickerFamily(f) {
        if (!pick) return;
        pick.family = f;
        pickerSearch(pick.q);
    }
    function pickerReset() {
        if (!pick) return;
        pick.q = ''; pick.family = '';
        var el = document.getElementById('lawpick-q');
        if (el) el.value = '';
        pickerSearch('');
    }
    function pickerChoose(k) {
        var cb = pick && pick.onPick;
        V().closeModal();
        pick = null;
        if (!cb) return;
        /* 전역 함수 경로 문자열로 받는다 — 이 코드베이스의 인라인 onclick 관례 */
        try {
            var fn = cb.split('.').reduce(function (o, p) { return o && o[p]; }, global);
            if (typeof fn === 'function') fn(k);
        } catch (e) {}
    }

    /* ── 검증 6문 (CLAUDE.md §10) ────────────────────────────────────────
     *  매핑을 붙일 때 판단 근거를 데이터로 남긴다. 하루 6회 감사에서 결함
     *  5종이 나온 뒤 규칙이 된 항목들이다.
     * ------------------------------------------------------------------- */
    var VERIFY_Q = [
        { id: 'q1', text: '조문 원문을 실제로 열어 확인했다', hint: '조문 번호만 보고 붙이지 않는다. (기준규칙 §132를 낙하물 방지로 붙였는데 실제로는 「양중기」였다)' },
        { id: 'q2', text: '"관련 있음"이 아니라 그 의무의 직접 이행 수단이다', hint: '데이터를 준비하거나 결과를 보관하는 화면은 관련은 있어도 이행 수단이 아니다' },
        { id: 'q3', text: '화면 근거가 맞다(항목 근거가 아니다)', hint: '여러 도메인 업무가 모이는 화면은 화면 근거가 성립하지 않는다' },
        { id: 'q4', text: '법률의 다른 축이 빠지지 않았다', hint: '중대산업재해(법 §4·§5)와 중대시민재해(법 §9, 시행령 §8·§10·§11) 두 축이다' },
        { id: 'q5', text: '주기를 표시한다면 주기를 정하는 조문을 함께 댔다', hint: '법률은 대개 "대통령령/고용노동부령으로 정한다"로 위임만 한다' },
        { id: 'q6', text: '화면이 하지 않는 일을 한다고 쓰지 않았다', hint: '조문의 점검 항목이 실제로 화면에 있는지 확인한다' }
    ];
    function verifyList(pageId) { return (load().verify[pageId] || []).slice(); }
    function verifyCount(pageId) { return (load().verify[pageId] || []).length; }
    function addVerify(pageId, rec) {
        var d = load();
        (d.verify[pageId] = d.verify[pageId] || []).unshift({
            articleKey: rec.articleKey || '',
            answers: rec.answers || {},
            reason: rec.reason || '',
            at: nowTs(), by: actor(),
            /* 어떤 문면을 보고 판단했는지 — 조문이 개정되면 재검증 대상이 된다 */
            againstTitle: rec.againstTitle || ''
        });
        save();
    }
    /* 조문 제목이 검증 당시와 달라진 매핑 — 재검증 대상 */
    function staleVerifies() {
        var d = load(), out = [];
        Object.keys(d.verify).forEach(function (pid) {
            (d.verify[pid] || []).forEach(function (r) {
                if (!r.articleKey || !r.againstTitle) return;
                var a = L().ARTICLES[r.articleKey];
                if (a && a.title !== r.againstTitle) out.push({ pageId: pid, key: r.articleKey, was: r.againstTitle, now: a.title });
            });
        });
        return out;
    }

    /* ── 영향 범위 역참조 ────────────────────────────────────────────────
     *  조문 하나를 건드리기 전에 무엇이 흔들리는지 알아야 한다.
     *  "화면 매핑 0곳 = 안 쓰는 조문"은 거짓이다 — 기준규칙 조문은 항목 근거로,
     *  주기 조문은 대시보드에서 쓰인다. 소스를 나눠 센다.
     * ------------------------------------------------------------------- */
    function impactOf(articleKey) {
        var src = [];
        /* ① 화면 매핑 (실효 = base+override) */
        var mapped = L().reachablePages().filter(function (id) {
            return effective(id).items.some(function (it) { return it.key === articleKey; });
        });
        src.push({ id: 'map', label: '화면 매핑', n: mapped.length, detail: mapped, fix: '이 화면에서 수정' });

        /* ② 레거시 별칭 */
        var alias = Object.keys(L().BASIS_ALIAS || {}).filter(function (k) {
            return L().BASIS_ALIAS[k] === articleKey;
        });
        src.push({ id: 'alias', label: '레거시 표기 별칭', n: alias.length, detail: alias, fix: '대체 지정 시 자동 승계' });

        /* ③ 위험성평가 저장 데이터 (유해위험요인·개선조치) */
        var rsk = { hazard: 0, imp: 0 };
        try {
            var D = global.DYRSK;
            if (D) {
                (D.improvements() || []).forEach(function (m) {
                    if (m.hazard && m.hazard.basis === articleKey) rsk.imp++;
                });
                (D.assessments() || []).forEach(function (a) {
                    (a.depts || []).forEach(function (dp) {
                        (dp.hazards || []).forEach(function (h) { if (h.basis === articleKey) rsk.hazard++; });
                    });
                });
            }
        } catch (e) {}
        src.push({
            id: 'rsk', label: '위험성평가 저장 데이터',
            n: rsk.hazard + rsk.imp,
            detail: ['유해위험요인 ' + rsk.hazard + '건', '개선조치 ' + rsk.imp + '건'],
            fix: '조문 대체 시 함께 이전'
        });

        /* ④ 코드 상수 — 화면에서 고칠 수 없다 */
        var codeN = 0, codeD = [];
        try {
            if (global.DYDSH && global.DYDSH.LAW_ITEM_KEYS) codeN = 0;
        } catch (e) {}
        /* 대시보드 법정 의무 캘린더·알림 시드는 JS 상수라 런타임 탐지가 불가능하다.
         * 정직하게 "탐지 불가"로 표기한다(추정 수치를 만들지 않는다). */
        src.push({ id: 'code', label: '코드 상수(캘린더·알림)', n: null, detail: ['런타임 탐지 불가'], fix: '개발 수정 필요' });

        var total = src.reduce(function (s, x) { return s + (x.n || 0); }, 0);
        return { key: articleKey, sources: src, total: total, archivable: total === 0 };
    }

    /* ── 미연계 근거 표기 ────────────────────────────────────────────────
     *  업무문서 429건이 legalBasis 문자열을 들고 있는데 DYLAW 로 해석되지 않는다.
     *  이 화면의 가장 큰 실제 일감이다.
     * ------------------------------------------------------------------- */
    var TRIAGE = [
        { id: 'map', label: '조문 매핑 가능', tone: 'success' },
        { id: 'range', label: '범위 표기 — 분해 필요', tone: 'warning' },
        { id: 'missing', label: '미수록 조문 — 수집 필요', tone: 'purple' },
        { id: 'fix', label: '오류 — 정정 필요', tone: 'danger' },
        { id: 'notlaw', label: '법령 아님(확정)', tone: 'neutral' }
    ];
    function unlinkedBasis() {
        var seen = {}, out = [];
        try {
            (global.DY_DOCS_V2 || []).forEach(function (d) {
                var b = d.legalBasis;
                if (!b) return;
                if (!seen[b]) { seen[b] = { text: b, n: 0, resolved: !!L().resolveBasis(b) }; out.push(seen[b]); }
                seen[b].n++;
            });
        } catch (e) {}
        var d2 = load();
        out.forEach(function (r) { r.triage = (d2.basisTriage[r.text] || {}).verdict || ''; });
        out.sort(function (a, b) { return b.n - a.n; });
        return out;
    }
    function setTriage(text, verdict, note) {
        var d = load();
        var before = (d.basisTriage[text] || {}).verdict || '';
        d.basisTriage[text] = { verdict: verdict, note: note || '', at: nowTs(), by: actor() };
        save();
        log({ layer: '별칭', target: text, action: '표기 분류', before: before, after: verdict, reason: note || '' });
    }

    /* ── 무결성 검사 ─────────────────────────────────────────────────────
     *  감지 없는 정합은 유지되지 않는다. 화면 없이도 이 검사가 먼저 돌아야 한다.
     * ------------------------------------------------------------------- */
    function integrity() {
        var out = [];
        /* 1. 끊어진 참조 — MAP 이 가리키는데 조문이 없음 */
        var dang = L().danglingKeys();
        out.push({ id: 'dangling', label: '끊어진 조문 참조', n: dang.length, detail: dang, severity: 'danger',
                   note: '매핑이 가리키는 조문이 수록되어 있지 않다' });

        /* 2. 화면에 반영되지 않는 매핑 키 */
        var unreach = L().unreachableMapKeys();
        out.push({ id: 'unreachable', label: '반영 안 되는 매핑', n: unreach.length, detail: unreach, severity: 'danger',
                   note: '어떤 화면도 이 페이지 id 를 쓰지 않아 근거가 표시되지 않는다 — 개발 수정 필요' });

        /* 3. 근거 칩 앵커가 없어 표시 불가한 화면 */
        var blocked = pageRows().filter(function (r) { return r.chipBlocked.length && r.eff.mode === 'basis'; });
        out.push({ id: 'noanchor', label: '근거를 지정했으나 표시 불가', n: blocked.length,
                   detail: blocked.map(function (r) { return r.id + ' (' + r.chipBlocked.join(',') + ')'; }),
                   severity: 'warning', note: '화면에 제목 영역이 없어 근거 칩이 뜨지 않는다' });

        /* 4. 판정되지 않은 화면 — MAP 에 키가 없는 것만.
         *    빈 배열은 "근거 없음"을 명시적으로 판정한 것이므로 여기 포함하지 않는다. */
        var un = pageRows().filter(function (r) { return r.eff.mode === 'unset'; });
        out.push({ id: 'unjudged', label: '미판단 화면', n: un.length, detail: un.map(function (r) { return r.id; }),
                   severity: 'warning', note: '근거가 있는지 없는지 아직 판정되지 않았다' });

        /* 4-b. 판정 사유가 데이터로 남지 않은 "근거 없음" — 화면에서 왜 없는지 읽을 수 없다.
         * 전수 검토 시드(noneReasons)가 사유를 채운 화면은 제외한다. */
        var noReason = pageRows().filter(function (r) {
            return r.eff.mode === 'none' && r.eff.source === 'base' && !r.eff.reasonSeeded;
        });
        out.push({ id: 'noreason', label: '근거 없음 — 사유 미기록', n: noReason.length,
                   detail: noReason.map(function (r) { return r.id; }), severity: 'warning',
                   note: '판정 사유가 코드 주석에만 있어 화면에서 읽을 수 없다' });

        /* 5. 검증 기록 없는 매핑 */
        var nover = pageRows().filter(function (r) { return r.eff.mode === 'basis' && r.verified === 0; });
        out.push({ id: 'noverify', label: '검증 기록 없는 매핑', n: nover.length,
                   detail: nover.map(function (r) { return r.id; }), severity: 'warning',
                   note: '검증 6문 기록이 없다 — 감사 시 판단 근거를 댈 수 없다' });

        /* 6. 조문이 바뀌어 재검증이 필요한 매핑 */
        var stale = staleVerifies();
        out.push({ id: 'stale', label: '재검증 필요', n: stale.length,
                   detail: stale.map(function (s) { return s.pageId + ' / ' + s.key; }), severity: 'warning',
                   note: '검증 당시와 조문 제목이 달라졌다' });

        return out;
    }
    function integrityBad() {
        return integrity().reduce(function (s, c) { return s + (c.n || 0); }, 0);
    }

    /* ── 수집 시뮬레이션 ─────────────────────────────────────────────────
     *  **실제 법제처 API 를 호출하지 않는다.** 방화벽 명세가 "배치 서버 단독
     *  아웃바운드"이므로 화면이 외부를 직접 부르면 심의 명세와 실물이 어긋난다.
     *  화면은 배치가 만들어 놓은 결과를 검토·승인하는 역할만 한다.
     * ------------------------------------------------------------------- */
    function stageLoad() {
        try { return JSON.parse(global.sessionStorage.getItem(STAGE_KEY) || 'null'); }
        catch (e) { return null; }
    }
    function stageSave(o) {
        try { global.sessionStorage.setItem(STAGE_KEY, JSON.stringify(o)); } catch (e) {}
    }
    function stageClear() { try { global.sessionStorage.removeItem(STAGE_KEY); } catch (e) {} }

    /* 시연용 수집 결과 — 시드는 js/law-sync-seed.js(생성물 아님)에서 온다 */
    function runSync() {
        var seed = global.DYLAWSYNC || { rows: [] };
        var rows = seed.rows.map(function (r) { return Object.assign({}, r, { decision: '' }); });
        var o = { runId: 'SYNC-' + today().replace(/-/g, ''), startedAt: nowTs(), rows: rows };
        stageSave(o);
        log({ layer: '수집', target: '전체', action: '수집 요청 등록(시뮬레이션)',
              after: rows.length + '건 검토 대기', impact: '실제 API 미호출' });
        return o;
    }
    function stageDecide(idx, decision) {
        var o = stageLoad(); if (!o || !o.rows[idx]) return null;
        o.rows[idx].decision = decision;
        stageSave(o);
        return o;
    }

    /* ── 내보내기 ────────────────────────────────────────────────────────
     *  브라우저 안에서만 사는 결정은 증발한다. law-map.js 재생성용으로 반출한다.
     * ------------------------------------------------------------------- */
    function exportJson() {
        var d = load();
        var map = {};
        L().reachablePages().forEach(function (id) {
            var e = effective(id);
            map[id] = { mode: e.mode, items: e.items, reason: e.reason, source: e.source };
        });
        return JSON.stringify({
            생성: nowTs(), 스냅샷: L().SNAPSHOT,
            안내: '이 파일은 law-map.js 재생성 입력이다. 조문 원문은 포함하지 않는다(법제처 수집분).',
            매핑: map,
            조문운영판단: d.articleAdmin,
            검증기록: d.verify,
            표기분류: d.basisTriage
        }, null, 2);
    }

    global.LAWADM = {
        VERIFY_Q, TRIAGE,
        load: load, save: save, reset: reset, today: today, nowTs: nowTs, actor: actor,
        log: log, logs: logs,
        effective: effective, pageRows: pageRows, statusOf: statusOf,
        menuTree: menuTree, labelOf: labelOf, navIndex: navIndex,
        LAW_FAMILY: LAW_FAMILY, openPicker: openPicker, pickerSearch: pickerSearch,
        pickerFamily: pickerFamily, pickerReset: pickerReset, pickerChoose: pickerChoose,
        verifyList: verifyList, verifyCount: verifyCount, addVerify: addVerify, staleVerifies: staleVerifies,
        impactOf: impactOf,
        unlinkedBasis: unlinkedBasis, setTriage: setTriage,
        integrity: integrity, integrityBad: integrityBad,
        stageLoad: stageLoad, stageClear: stageClear, runSync: runSync, stageDecide: stageDecide,
        exportJson: exportJson,
        /* 매핑 저장 — 화면 2가 쓴다 */
        saveMapping: function (pageId, mode, items, reason) {
            var d = load();
            var before = effective(pageId);
            d.mapOverride[pageId] = {
                mode: mode, items: items || [], reason: reason || '',
                at: nowTs(), by: actor()
            };
            save();
            log({
                layer: '매핑', target: pageId, action: '근거 저장',
                before: before.items.map(function (i) { return i.key; }).join(', ') || (before.mode === 'none' ? '근거 없음' : '미판단'),
                after: mode === 'none' ? '근거 없음(확정)' : (items || []).map(function (i) { return i.key; }).join(', '),
                impact: L().pagesOf(pageId).join(', '),
                reason: reason || ''
            });
        },
        clearMapping: function (pageId) {
            var d = load();
            delete d.mapOverride[pageId];
            save();
            log({ layer: '매핑', target: pageId, action: '기본값으로 되돌림' });
        }
    };
})(window);
