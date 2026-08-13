/* =========================================================================
 * 업무 업로드 마법사 + 전년도 프리셋 (전역 DOCUP)
 *   기획: docs/planning/기획-업무문서-이행목록-업무목록-UX설계-v1.md §8 (UF-02·05·06)
 *
 *   [단일 모달 불변식] 모달 위에 모달을 띄우지 않는다(CLAUDE.md §1).
 *   STEP 전환·프리셋 선택·단계 다중선택 모두 **같은 모달 본문을 교체**한다.
 *
 *   [순서를 뒤집지 말 것] STEP1 문서·파일 → STEP2 업무단계 선택 → STEP3 확인·저장.
 *   저장 직후 선택한 단계는 반드시 **진행중**이고, 담당자에게 완료 처리 수단이 없다.
 *   완료는 주관부서 담당자가 이행 목록의 [증빙 확인]에서만 준다(D-01).
 * ========================================================================= */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYDOCS; };
    var F = function () { return global.EDUFILTER; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }

    /* ── 마법사 상태 ─────────────────────────────────────────────────────── */
    var W = null;
    /* 보고일자 기본값 — 기준연도가 올해가 아니면 오늘 날짜를 쓸 수 없다.
       2025년 화면에서 업로드를 열었는데 보고일이 2026-07-16 으로 채워지면
       저장되는 순간 연도와 날짜가 어긋난 문서가 된다(실제로 냈던 결함). */
    function defaultDate(year) {
        var t = D().today();
        if (+year === +t.slice(0, 4)) return t;
        return '';                       /* 다른 연도면 비워 두고 사용자가 고르게 한다 */
    }
    function blankW(year) {
        year = year || D().defaultYear();
        return {
            step: 1, year: year,
            files: [],
            title: '', date: defaultDate(year), sr: '', dept: '', assignee: '', assigneeUid: '', src: 'upload', note: '',
            dupWith: null,          /* 중복 후보 문서 id */
            dupMode: '',            /* 'append' 기존 문서에 파일 추가 | 'new' 새 문서 */
            stageIds: [],
            /* STEP2 조회 조건 */
            q: '', cycle: '', collect: '', target: '',
            open: {},               /* 아코디언 펼침 */
            err: '', fieldErr: {},  /* 배너 + **필드 단위** 오류 (aria-invalid 연결) */
        };
    }

    /* ── 프리셋 상태 ─────────────────────────────────────────────────────── */
    var P = null;
    /* 원본연도 → 대상연도는 **기준연도에서 파생**한다. BASE_YEAR→DEFAULT_YEAR 로
       고정하면 2025년 화면에서 "2025년 것을 2026년으로" 라는 엉뚱한 안내가 나온다. */
    function blankP(toYear) {
        var to = toYear || (W ? W.year : D().defaultYear());
        return {
            from: D().presetSourceYear(to) || (to - 1), to: to,
            q: '', item: '', cycle: '', sr: '', month: '',
            page: 1, size: 20,
            sel: {},                /* docId → {titleMode, title, dept, assignee, files:{fileKey:'keep'|'replace'}} */
            onlySel: false,
            bulk: { titleMode: 'year', dept: '', assignee: '', fileMode: 'keep' },
            expand: {},             /* docId → 개별 설정 펼침 */
            err: '',
        };
    }

    /* =========================================================================
     * 공통 — 입력값 보존 (재렌더 전에 반드시 부른다)
     * ========================================================================= */
    function val(id) { var el = document.getElementById(id); return el ? el.value : null; }
    function captureStep1() {
        if (!W) return;
        var m = { 'du-title': 'title', 'du-date': 'date', 'du-sr': 'sr', 'du-note': 'note' };
        Object.keys(m).forEach(function (id) { var v = val(id); if (v != null) W[m[id]] = v; });
        var s = val('du-src'); if (s != null) W.src = s;
    }

    /* =========================================================================
     * 진입
     * ========================================================================= */
    function open(year) {
        if (!D().canUpload()) { V().toast(denyNote()); return; }
        W = blankW(year);
        armGuard();
        renderW();
    }
    /* 닫는 길이 넷(취소·X·백드롭·Esc)인데 확인이 하나에만 있으면 확인이 아니다.
       가드를 걸어 두면 어느 길로 닫아도 같은 확인을 받는다(DYV2.setModalGuard). */
    function armGuard() {
        V().setModalGuard(function () {
            if (!dirty()) return true;
            return global.confirm('작성 중인 내용이 사라집니다. 닫을까요?');
        });
    }
    function dirty() {
        if (W) { captureStep1(); return !!(W.files.length || String(W.title).trim() || W.stageIds.length); }
        if (P) return Object.keys(P.sel).length > 0;
        return false;
    }
    function denyNote() {
        var R = global.DYROLE;
        if (R && R.readOnlyNote) {
            var n = R.readOnlyNote('업무 업로드');
            if (n) return '조회 전용 — 업무 업로드는 부서 담당자가 수행합니다.';
        }
        return '업무 업로드 권한이 없습니다.';
    }

    /* =========================================================================
     * 마법사 렌더
     * ========================================================================= */
    function renderW() {
        var title = '업무 업로드 · ' + W.year + '년 <span class="du-step">STEP ' + W.step + ' / 3</span>';
        var body, foot;
        if (W.step === 1) { body = step1(); foot = foot1(); }
        else if (W.step === 2) { body = step2(); foot = foot2(); }
        else { body = step3(); foot = foot3(); }
        V().openModal(title, '<div class="du-wrap">' + stepBar() + errBox(W.err) + body + '</div>', foot);
    }
    function stepBar() {
        var names = ['문서·파일', '업무단계 선택', '확인'];
        return '<ol class="du-steps">' + names.map(function (n, i) {
            var k = i + 1;
            return '<li class="' + (k === W.step ? 'is-on' : (k < W.step ? 'is-done' : '')) + '">' +
                '<span class="du-step-n">' + k + '</span>' + esc(n) + '</li>';
        }).join('') + '</ol>';
    }
    function errBox(msg) {
        return msg ? '<div class="du-err form-field-error" role="alert">' + esc(msg) + '</div>' : '';
    }

    /* ── STEP 1 ── */
    function step1() {
        var dup = W.dupWith ? D().docById(W.dupWith) : null;
        return '<div class="form-section">' +
            V().uploadDrop('업무 증빙 파일을 끌어다 놓거나 클릭하여 업로드', null,
                { pick: 'DOCUP.addFiles', multiple: true, hint: true }) +
            fileList() +
            '<div class="du-grid">' +
                field('문서명', true, 'du-title',
                    '<input type="text" class="form-input" id="du-title" value="' + esc(W.title) + '" ' +
                    inv('du-title') + ' oninput="DOCUP.onTitle(this.value)" placeholder="첫 파일명에서 자동으로 채워집니다">') +
                field('보고일자', true, 'du-date',
                    '<input type="date" class="form-input" id="du-date" value="' + esc(W.date) + '" ' + inv('du-date') +
                    ' min="' + W.year + '-01-01" max="' + W.year + '-12-31">',
                    W.year + '년 업무이므로 ' + W.year + '년 안의 날짜만 받습니다') +
                field('수발신자', false, 'du-sr',
                    '<input type="text" class="form-input" id="du-sr" value="' + esc(W.sr) + '" placeholder="예: 전라남도 안전정책과">') +
                field('문서 출처', false, 'du-src',
                    '<select class="form-select" id="du-src">' +
                        D().SRC_ORDER.filter(function (k) { return k !== 'program'; }).map(function (k) {
                            return '<option value="' + k + '"' + (W.src === k ? ' selected' : '') + '>' + esc(D().SRC[k].label) + '</option>';
                        }).join('') +
                    '</select>') +
            '</div>' +
            ownerField() +
            field('비고', false, 'du-note', '<textarea class="form-input" id="du-note" rows="2">' + esc(W.note) + '</textarea>') +
            (dup ? dupBox(dup) : '') +
            (prevYear()
                ? '<p class="du-hint">' + prevYear() + '년에 낸 문서를 그대로 쓰려면 ' +
                    '<button type="button" class="du-link" onclick="DOCUP.openPreset()">' + prevYear() + '년 문서에서 가져오기</button>' +
                  '</p>'
                : '') +
        '</div>';
    }
    /* 프리셋의 원본연도는 '기준연도 직전 연도'다 — 2025 로 하드코딩하면 2025년
       화면에서 "2025년 문서에서 가져오기"라는 말이 안 되는 안내가 나온다. */
    function prevYear() { return D().presetSourceYear(W ? W.year : D().defaultYear()); }

    /* 담당부서·담당자 — 공용 인라인 조직도로만 받는다(CLAUDE.md §3).
     * rootId 로 **고를 수 있는 범위 자체를 좁힌다** — 조회 범위 밖 사람 이름을
     * 목록에 띄우는 것 자체가 위반이다(§14-7 assignCandidates 선례).
     * uid 로 저장해 동명이인·개명에 견딘다. 판정은 저장 계층이 다시 한다. */
    function ownerField() {
        var root = D().ownerRootId();
        var scopeNote = root
            ? '소속 부서 담당자만 지정할 수 있습니다'
            : '주관부서 담당자는 전 부서를 지정할 수 있습니다';
        return '<div class="form-field du-owner' + (W.fieldErr['du-org'] ? ' has-err' : '') + '">' +
            '<label class="form-label" id="du-org-l">담당부서 · 담당자 <span class="du-req">*</span></label>' +
            '<div class="orgpick-field" id="du-org">' +
                '<button type="button" class="form-input du-orgbtn" aria-labelledby="du-org-l"' +
                    (W.fieldErr['du-org'] ? ' aria-invalid="true" aria-describedby="du-org-e"' : '') +
                    ' onclick="ORGPICK.toggle(\'du-org\',\'memberUid\',\'DOCUP.pickOwner\'' +
                        (root ? ', {rootId:\'' + esc(root) + '\'}' : '') + ')">' +
                    (W.assignee ? esc(W.dept + ' / ' + W.assignee) : '<span class="du-ph">조직도에서 선택</span>') +
                '</button>' +
            '</div>' +
            (W.fieldErr['du-org']
                ? '<p class="form-field-error" id="du-org-e">' + esc(W.fieldErr['du-org']) + '</p>'
                : '<p class="form-field-help">' + esc(scopeNote) + '</p>') +
        '</div>';
    }
    /* 필드 단위 오류 — 배너만 띄우면 어느 칸이 문제인지 알 수 없다 */
    function inv(id) {
        return W.fieldErr[id] ? 'aria-invalid="true" aria-describedby="' + id + '-e"' : '';
    }
    function field(label, req, id, inner, help) {
        return '<div class="form-field' + (W.fieldErr[id] ? ' has-err' : '') + '">' +
            '<label class="form-label" for="' + id + '">' + esc(label) +
            (req ? ' <span class="du-req">*</span>' : '') + '</label>' + inner +
            (W.fieldErr[id] ? '<p class="form-field-error" id="' + id + '-e">' + esc(W.fieldErr[id]) + '</p>'
                : (help ? '<p class="form-field-help">' + esc(help) + '</p>' : '')) +
        '</div>';
    }
    function fileList() {
        if (!W.files.length) return '';
        return '<ul class="du-files">' + W.files.map(function (f, i) {
            return '<li><span class="du-fname">' + esc(f.name) + '</span>' +
                '<span class="du-fsize">' + kb(f.size) + '</span>' +
                '<button type="button" class="du-fdel" aria-label="' + esc(f.name) + ' 제거" onclick="DOCUP.delFile(' + i + ')">×</button></li>';
        }).join('') + '</ul>';
    }
    function kb(n) { return n ? Math.max(1, Math.round(n / 1024)) + ' KB' : '—'; }

    /* 중복은 차단하지 않고 선택지를 준다 — 같은 제목이 다른 날짜로 반복되는 자료다 */
    function dupBox(d) {
        return '<div class="du-dup" role="alert">' +
            '<b>같은 제목·수발신자·보고일자의 문서가 이미 있습니다.</b>' +
            '<p class="du-dup-t">' + esc(d.title) + ' <span class="du-dim">' + esc(d.date) + (d.sr ? ' · ' + esc(d.sr) : '') + '</span></p>' +
            '<div class="du-dup-act">' +
                '<label><input type="radio" name="du-dup" value="append"' + (W.dupMode === 'append' ? ' checked' : '') +
                    ' onchange="DOCUP.setDup(\'append\')"> 기존 문서에 파일을 추가한다</label>' +
                '<label><input type="radio" name="du-dup" value="new"' + (W.dupMode === 'new' ? ' checked' : '') +
                    ' onchange="DOCUP.setDup(\'new\')"> 다른 문서다 — 새로 만든다</label>' +
            '</div>' +
        '</div>';
    }
    function foot1() {
        return '<button class="btn btn-outline" onclick="DOCUP.cancel()">취소</button>' +
            '<button class="btn btn-primary" onclick="DOCUP.next()">다음 — 업무단계 선택 →</button>';
    }

    /* ── STEP 2 — 168단계 다중 선택 ──────────────────────────────────────
     * 하나의 긴 체크박스 목록이나 select multiple 로 만들지 않는다(§6-3).
     * 이행항목별 아코디언 + 통합검색 + 하단 고정 선택 요약. */
    function step2() {
        var groups = stageGroups();
        var hit = groups.reduce(function (a, g) { return a + g.stages.length; }, 0);
        return '<div class="du-pick">' +
            '<div class="du-pick-bar">' +
                '<input type="search" class="form-input du-pick-q" id="du-q" value="' + esc(W.q) + '"' +
                    ' placeholder="이행항목·업무단계·코드·법령 검색" aria-label="업무단계 검색"' +
                    ' oninput="DOCUP.setPF(\'q\', this.value)">' +
                sel('du-cy', W.cycle, cycleOpts(), "DOCUP.setPF('cycle', this.value)", '운영주기') +
                sel('du-co', W.collect, collectOpts(), "DOCUP.setPF('collect', this.value)", '취합상태') +
                sel('du-tg', W.target, targetOpts(), "DOCUP.setPF('target', this.value)", '적용대상') +
                '<span class="dy-count">' + groups.length + '개 항목 · ' + hit + '개 단계</span>' +
            '</div>' +
            '<div class="du-pick-body">' +
                (groups.length ? groups.map(accordion).join('')
                    : '<div class="v2-empty"><b>조건에 맞는 업무단계가 없습니다.</b><br>검색어나 조건을 지워보세요.</div>') +
            '</div>' +
            selSummary() +
        '</div>';
    }
    function sel(id, v, opts, on, label) {
        return '<select class="form-select" id="' + id + '" aria-label="' + esc(label) + '" onchange="' + on + '">' +
            F().optionsHtml(opts, v) + '</select>';
    }
    function cycleOpts() {
        var seen = {};
        D().stages().forEach(function (s) { if (s.opCycle) seen[s.opCycle] = 1; });
        return [['', '운영주기 전체']].concat(Object.keys(seen).sort().map(function (c) { return [c, c]; }));
    }
    function collectOpts() {
        var seen = {};
        D().stages().forEach(function (s) { if (s.collect) seen[s.collect] = 1; });
        return [['', '취합상태 전체']].concat(Object.keys(seen).sort().map(function (c) { return [c, c]; }));
    }
    function targetOpts() {
        var seen = {};
        D().stages().forEach(function (s) { if (s.target) seen[s.target] = 1; });
        return [['', '적용대상 전체']].concat(Object.keys(seen).sort().map(function (c) { return [c, c]; }));
    }
    function stageGroups() {
        var out = [];
        D().items().forEach(function (it) {
            var hit = D().stagesOfItem(it.id).filter(function (s) {
                if (W.cycle && s.opCycle !== W.cycle) return false;
                if (W.collect && s.collect !== W.collect) return false;
                if (W.target && s.target !== W.target) return false;
                if (W.q && !F().match(W.q, [s.id, s.name, s.law, it.id, it.name])) return false;
                return true;
            });
            if (hit.length) out.push({ item: it, stages: hit });
        });
        return out;
    }
    function accordion(g) {
        var it = g.item;
        /* 검색 중이면 자동으로 펼친다 — 찾아 놓고 또 눌러야 하면 검색이 아니다 */
        var openNow = !!W.open[it.id] || !!(W.q || W.cycle || W.collect || W.target);
        var picked = g.stages.filter(function (s) { return W.stageIds.indexOf(s.id) >= 0; }).length;
        var allOn = picked === g.stages.length && picked > 0;
        return '<section class="du-acc' + (openNow ? ' is-open' : '') + '">' +
            '<h4 class="du-acc-h">' +
                '<button type="button" class="du-acc-btn" aria-expanded="' + (openNow ? 'true' : 'false') +
                    '" onclick="DOCUP.toggleAcc(\'' + esc(it.id) + '\')">' +
                    '<span class="du-acc-code">' + esc(it.id) + '</span>' +
                    '<span class="du-acc-name">' + esc(it.name) + '</span>' +
                    '<span class="du-acc-n">' + g.stages.length + '개' +
                        (picked ? ' <b>· 선택 ' + picked + '</b>' : '') + '</span>' +
                    '<span class="du-acc-car" aria-hidden="true">' + (openNow ? '▴' : '▾') + '</span>' +
                '</button>' +
            '</h4>' +
            (openNow
                ? '<div class="du-acc-body">' +
                    '<label class="du-all"><input type="checkbox"' + (allOn ? ' checked' : '') +
                        ' onchange="DOCUP.pickGroup(\'' + esc(it.id) + '\', this.checked)"> 이 항목의 ' + g.stages.length + '개 단계 전체 선택</label>' +
                    g.stages.map(pickRow).join('') +
                  '</div>'
                : '') +
        '</section>';
    }
    function pickRow(s) {
        var on = W.stageIds.indexOf(s.id) >= 0;
        var cur = D().statusOfStage(s.id, W.year);
        var id = 'du-s-' + s.id;
        return '<label class="du-srow' + (on ? ' is-on' : '') + '" for="' + id + '">' +
            '<input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') +
                ' onchange="DOCUP.pickStage(\'' + esc(s.id) + '\', this.checked)">' +
            '<span class="du-srow-main">' +
                '<span class="du-srow-code">' + esc(s.id) + '</span>' +
                '<span class="du-srow-name">' + esc(s.name) + '</span>' +
                '<span class="du-srow-sub">' + esc(s.opCycle || s.timing || '주기·시점 미지정') + '</span>' +
            '</span>' +
            '<span class="chip-status chip-sm ' + V().toneOf(D().statusLabel(cur)) + '">' + esc(D().statusLabel(cur)) + '</span>' +
        '</label>';
    }
    /* 선택 요약은 하단에 고정 — 긴 이름을 툴팁에 숨기지 않고 줄바꿈한다 */
    function selSummary() {
        var items = {};
        W.stageIds.forEach(function (sid) { var s = D().stage(sid); if (s) items[s.itemId] = 1; });
        return '<div class="du-sel">' +
            '<div class="du-sel-head">' +
                '<b>선택 ' + W.stageIds.length + '개 단계</b> · 이행항목 ' + Object.keys(items).length + '개' +
                (W.stageIds.length ? '<button type="button" class="du-link" onclick="DOCUP.clearStages()">전체 해제</button>' : '') +
            '</div>' +
            (W.stageIds.length
                ? '<ul class="du-sel-list">' + W.stageIds.map(function (sid) {
                    var s = D().stage(sid); if (!s) return '';
                    return '<li><span>' + esc(s.id) + ' ' + esc(s.name) + '</span>' +
                        '<button type="button" aria-label="' + esc(s.name) + ' 선택 해제" onclick="DOCUP.pickStage(\'' + esc(sid) + '\', false)">×</button></li>';
                  }).join('') + '</ul>'
                : '<p class="du-sel-none">아직 선택한 업무단계가 없습니다. 이 문서가 증빙하는 단계를 하나 이상 고르세요.</p>') +
        '</div>';
    }
    function foot2() {
        return '<button class="btn btn-outline" onclick="DOCUP.prev()">← 이전</button>' +
            '<button class="btn btn-primary" onclick="DOCUP.next()">다음 — 확인 →</button>';
    }

    /* ── STEP 3 ── */
    function step3() {
        var items = {};
        W.stageIds.forEach(function (sid) { var s = D().stage(sid); if (s) (items[s.itemId] = items[s.itemId] || []).push(s); });
        var reverting = D().completedAmong(W.stageIds, W.year);
        return '<div class="du-conf">' +
            '<dl class="du-conf-meta">' +
                row('문서명', W.title) +
                row('파일', W.files.map(function (f) { return f.name; }).join(', ') || '—') +
                row('보고일자', W.date) +
                row('수발신자', W.sr || '—') +
                row('담당부서 · 담당자', W.dept + ' / ' + W.assignee) +
                row('문서 출처', D().SRC[W.src] ? D().SRC[W.src].label : W.src) +
                row('기준연도', W.year + '년') +
            '</dl>' +
            (reverting.length
                ? '<div class="du-dup" role="alert"><b>완료된 단계 ' + reverting.length + '개가 진행중으로 되돌아갑니다.</b>' +
                  '<p class="du-dim">증빙이 바뀌었으므로 주관부서의 재확인을 다시 받습니다.</p></div>'
                : '') +
            '<h4 class="du-conf-sub">이행항목 ' + Object.keys(items).length + '개 · 업무단계 ' + W.stageIds.length + '개</h4>' +
            '<table class="table-figma table-compact du-conf-tbl"><thead><tr>' +
                '<th>이행항목 / 업무단계</th><th>변경 전</th><th>저장 후</th>' +
            '</tr></thead><tbody>' +
            Object.keys(items).map(function (iid) {
                var it = D().item(iid);
                return '<tr class="du-conf-item"><td colspan="3">' + esc(it.id) + ' · ' + esc(it.name) + '</td></tr>' +
                    items[iid].map(function (s) {
                        var from = D().statusOfStage(s.id, W.year);
                        return '<tr><td class="du-conf-st">' + esc(s.id) + ' ' + esc(s.name) + '</td>' +
                            '<td><span class="chip-status chip-sm ' + V().toneOf(D().statusLabel(from)) + '">' + esc(D().statusLabel(from)) + '</span></td>' +
                            '<td><span class="chip-status chip-sm info">진행중</span></td></tr>';
                    }).join('');
            }).join('') +
            '</tbody></table>' +
            '<p class="du-hint">저장하면 선택한 단계는 <b>진행중</b>이 됩니다. ' +
                '<b>완료</b>는 주관부서(재난안전과) 담당자가 증빙을 확인한 뒤에만 부여됩니다.</p>' +
        '</div>';
    }
    function row(k, v) { return '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>'; }
    function foot3() {
        return '<button class="btn btn-outline" onclick="DOCUP.prev()">← 이전</button>' +
            '<button class="btn btn-primary" onclick="DOCUP.submit()">등록</button>';
    }

    /* =========================================================================
     * 마법사 동작
     * ========================================================================= */
    function addFiles(items) {
        (items || []).forEach(function (f) {
            if (W.files.length >= V().FILE_LIMITS.maxCount) return;
            W.files.push({ name: f.name, size: f.size, type: f.type });
        });
        captureStep1();
        if (!W.title && W.files.length) W.title = W.files[0].name.replace(/\.[^.]+$/, '');
        checkDup();
        renderW();
    }
    function delFile(i) { captureStep1(); W.files.splice(i, 1); renderW(); }
    function onTitle(v) { W.title = v; }
    /* ORGPICK memberUid 모드 콜백 — (uid, name, role, team). 부서는 uid 에서 파생한다
       (문자열 파싱으로 부서를 뽑으면 '·' 가 든 부서명에서 깨진다). */
    function pickOwner(uid, name) {
        captureStep1();
        var m = null;
        (V().orgDepts ? V().orgDepts() : []).some(function (d) {
            var hit = V().orgMembers(d.id).filter(function (x) { return x.uid === uid; })[0];
            if (hit) { m = hit; return true; }
            return false;
        });
        if (!m) { V().toast('담당자를 찾을 수 없습니다.'); return; }
        /* 화면을 우회해도 같은 판정으로 걸린다 */
        var own = D().assertOwn(m.deptName);
        if (!own.ok) { W.fieldErr['du-org'] = own.reason; renderW(); return; }
        W.assigneeUid = m.uid;
        W.dept = m.deptName;
        W.assignee = name || m.name;
        delete W.fieldErr['du-org'];
        checkDup();
        renderW();
    }
    function setDup(mode) { W.dupMode = mode; }
    function checkDup() {
        W.dupWith = null;
        if (!W.title || !W.date) return;
        var hit = D().allDocs().filter(function (d) {
            return d.title === W.title && (d.sr || '') === (W.sr || '') && d.date === W.date;
        })[0];
        if (hit) { W.dupWith = hit.id; if (!W.dupMode) W.dupMode = 'new'; }
    }

    function setPF(k, v) { W[k] = v; F().rerender(renderW); }
    function toggleAcc(id) { W.open[id] = !W.open[id]; renderW(); }
    function pickStage(sid, on) {
        var i = W.stageIds.indexOf(sid);
        if (on && i < 0) W.stageIds.push(sid);
        if (!on && i >= 0) W.stageIds.splice(i, 1);
        F().rerender(renderW);
    }
    function pickGroup(itemId, on) {
        D().stagesOfItem(itemId).forEach(function (s) {
            var i = W.stageIds.indexOf(s.id);
            if (on && i < 0) W.stageIds.push(s.id);
            if (!on && i >= 0) W.stageIds.splice(i, 1);
        });
        F().rerender(renderW);
    }
    function clearStages() { W.stageIds = []; F().rerender(renderW); }

    function next() {
        W.err = ''; W.fieldErr = {};
        if (W.step === 1) {
            captureStep1();
            checkDup();
            var miss = [];
            if (!W.files.length) { W.fieldErr['du-drop'] = '증빙 파일을 1개 이상 첨부해야 합니다.'; miss.push('첨부 파일'); }
            if (!String(W.title).trim()) { W.fieldErr['du-title'] = '문서명을 입력하세요.'; miss.push('문서명'); }
            if (!W.date) { W.fieldErr['du-date'] = W.year + '년 안의 보고일자를 고르세요.'; miss.push('보고일자'); }
            else if (String(W.date).slice(0, 4) !== String(W.year)) {
                W.fieldErr['du-date'] = '기준연도(' + W.year + '년)와 보고일자의 연도가 다릅니다.'; miss.push('보고일자');
            }
            if (!W.assignee) { W.fieldErr['du-org'] = '담당부서·담당자를 조직도에서 고르세요.'; miss.push('담당부서·담당자'); }
            else {
                var own = D().assertOwn(W.dept);
                if (!own.ok) { W.fieldErr['du-org'] = own.reason; miss.push('담당부서·담당자'); }
            }
            if (miss.length) {
                var last = miss[miss.length - 1];
                W.err = miss.join(' · ') + V().josa(last, '을', '를') + ' 확인해 주세요.';
                renderW(); focusFirstError(); return;
            }
            if (W.dupWith && !W.dupMode) { W.err = '같은 문서가 있습니다 — 기존에 추가할지 새로 만들지 골라 주세요.'; renderW(); return; }
            W.step = 2; renderW(); focusBody(); return;
        }
        if (W.step === 2) {
            if (!W.stageIds.length) { W.err = '이 문서가 증빙하는 업무단계를 하나 이상 선택해야 합니다.'; renderW(); return; }
            W.step = 3; renderW(); focusBody(); return;
        }
    }
    /* 오류가 난 첫 칸으로 초점을 옮긴다 — 배너만 띄우면 어디를 고쳐야 할지 모른다 */
    function focusFirstError() {
        var order = ['du-drop', 'du-title', 'du-date', 'du-org'];
        for (var i = 0; i < order.length; i++) {
            if (!W.fieldErr[order[i]]) continue;
            var el = order[i] === 'du-org' ? document.querySelector('#du-org .du-orgbtn')
                   : order[i] === 'du-drop' ? document.querySelector('.upload-drop')
                   : document.getElementById(order[i]);
            if (el) { try { el.focus(); el.scrollIntoView({ block: 'center' }); } catch (e) {} return; }
        }
    }
    /* STEP 전환 시 본문으로 초점을 보낸다 — 모달 밖 버튼에 초점이 남아 있으면
       키보드 사용자는 방금 바뀐 화면을 지나쳐 버린다. */
    function focusBody() {
        var el = document.querySelector('#v2-modal .modal-body');
        if (!el) return;
        el.setAttribute('tabindex', '-1');
        try { el.focus(); } catch (e) {}
    }
    function prev() { W.err = ''; W.fieldErr = {}; if (W.step > 1) { W.step--; renderW(); focusBody(); } }
    function cancel() {
        /* 확인은 가드가 한 번만 낸다 — 여기서 또 물으면 두 번 묻는다 */
        if (V().closeModal() !== false) W = null;
    }

    function submit() {
        var doc, extra = '';
        if (W.dupWith && W.dupMode === 'append') {
            var base = D().docById(W.dupWith);
            var merged = (base.stageIds || []).slice();
            W.stageIds.forEach(function (s) { if (merged.indexOf(s) < 0) merged.push(s); });
            var r = D().updateDocument(W.dupWith, {
                stageIds: merged,
                files: (base.files || []).concat(W.files),
                note: W.note || base.note,
            });
            if (r.ok) { doc = r.doc; }
            else {
                /* 원장 문서이거나 남의 부서 문서라 덧붙일 수 없다 — 새 문서로 만들고
                   왜 그렇게 됐는지 사실대로 알린다(조용히 다른 짓을 하지 않는다). */
                var a = D().addDocument(payload());
                if (!a.ok) { W.err = a.reason; renderW(); return; }
                doc = a.doc; extra = r.reason + ' 새 문서로 등록했습니다.';
            }
        } else {
            var res = D().addDocument(payload());
            if (!res.ok) { W.err = res.reason; W.fieldErr['du-org'] = res.reason; renderW(); focusFirstError(); return; }
            doc = res.doc;
        }
        V().clearModalGuard();
        V().closeModal(true);
        afterSave(doc, extra);
    }
    function payload() {
        return {
            title: String(W.title).trim(), sr: W.sr, date: W.date, year: W.year,
            stageIds: W.stageIds.slice(), src: W.src,
            dept: W.dept, assignee: W.assignee, assigneeUid: W.assigneeUid, note: W.note,
            files: W.files.map(function (f) { return { id: fileId(), name: f.name, size: f.size, at: D().today() }; }),
        };
    }
    var _fseq = 0;
    function fileId() { return 'FILE-' + D().DEFAULT_YEAR + '-' + (++_fseq) + '-' + Math.abs(hash(String(_fseq) + D().today())); }
    function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return h; }

    function afterSave(doc, extra) {
        W = null;
        if (global.DOCEXEC && global.DOCEXEC.render) global.DOCEXEC.render();
        if (global.DOCLIST && global.DOCLIST.render) global.DOCLIST.render();
        V().toast((extra ? extra + ' ' : '') + '업무 등록 완료 — 업무단계 ' + doc.stageIds.length + '개가 진행중이 되었습니다.');
    }

    /* =========================================================================
     * 전년도 프리셋 — 단건·다건을 **하나의 선택 화면**에서 처리 (D-03)
     * ========================================================================= */
    function openPreset(toYear) {
        if (!D().canUpload()) { V().toast(denyNote()); return; }
        P = blankP(toYear);
        W = null;                     /* 마법사에서 넘어온 경우 그 입력은 여기서 끝난다 */
        armGuard();
        renderP();
    }
    function renderP() {
        var res = presetView();
        var n = Object.keys(P.sel).length;
        var body =
            '<div class="du-pre">' +
                errBox(P.err) +
                '<p class="du-pre-lead"><b>' + P.from + '년</b> 문서의 업무단계 선택값을 <b>' + P.to + '년</b>으로 가져옵니다. ' +
                    '전년도 <b>진행상태·결재상태·보고일자·문서번호는 복제하지 않습니다.</b></p>' +
                presetBar(res) +
                presetTable(res) +
                presetPager(res) +
                (n ? presetFoot() : '') +
            '</div>';
        var foot =
            '<button class="btn btn-outline" onclick="DOCUP.closePreset()">닫기</button>' +
            (n === 1 ? '<button class="btn btn-primary" onclick="DOCUP.runPreset()">1건 가져오기</button>'
             : n > 1 ? '<button class="btn btn-primary" onclick="DOCUP.runPreset()">' + n + '건 가져오기</button>'
             : '<button class="btn btn-primary" disabled>문서를 선택하세요</button>');
        V().openModal('전년도 프리셋 불러오기 <span class="du-step">' + P.from + ' → ' + P.to + '</span>', body, foot);
    }
    function presetView() {
        var all = D().allDocs().filter(function (d) { return d.year === P.from; });
        var list = all.filter(function (d) {
            if (P.onlySel && !P.sel[d.id]) return false;
            if (P.item && d.stageIds.every(function (s) { var st = D().stage(s); return !st || st.itemId !== P.item; })) return false;
            if (P.cycle && d.cycle !== P.cycle) return false;
            if (P.sr && (d.sr || '') !== P.sr) return false;
            if (P.month && String(d.date || '').slice(5, 7) !== P.month) return false;
            if (P.q && !F().match(P.q, [d.title, d.sr, d.date].concat(
                d.stageIds.map(function (s) { var st = D().stage(s); return st ? st.name : ''; })))) return false;
            return true;
        });
        var total = list.length;
        var pages = Math.max(1, Math.ceil(total / P.size));
        if (P.page > pages) P.page = pages;
        return { list: list, total: total, pages: pages, rows: list.slice((P.page - 1) * P.size, P.page * P.size) };
    }
    function presetBar(res) {
        var items = [['', '이행항목 전체']].concat(D().items().map(function (i) { return [i.id, i.id + ' ' + i.name]; }));
        var cy = {}; D().allDocs().forEach(function (d) { if (d.year === P.from && d.cycle) cy[d.cycle] = 1; });
        var months = [['', '보고월 전체']].concat('01,02,03,04,05,06,07,08,09,10,11,12'.split(',').map(function (m) { return [m, +m + '월']; }));
        return '<div class="dy-toolbar dy-filterbar du-pre-bar">' +
            '<div class="dy-filterbar-fields">' +
                '<input type="search" class="form-input dy-f-search" id="dp-q" value="' + esc(P.q) + '"' +
                    ' placeholder="문서명·수발신자·업무단계" aria-label="문서 검색" oninput="DOCUP.setPreF(\'q\', this.value)">' +
                sel('dp-it', P.item, items, "DOCUP.setPreF('item', this.value)", '이행항목') +
                sel('dp-cy', P.cycle, [['', '주기 전체']].concat(Object.keys(cy).sort().map(function (c) { return [c, c]; })), "DOCUP.setPreF('cycle', this.value)", '주기') +
                sel('dp-mo', P.month, months, "DOCUP.setPreF('month', this.value)", '보고월') +
                '<label class="edu-short-ck"><input type="checkbox"' + (P.onlySel ? ' checked' : '') +
                    ' onchange="DOCUP.setPreF(\'onlySel\', this.checked)"> 선택한 항목만 보기</label>' +
            '</div>' +
            '<div class="dy-filterbar-tail">' +
                '<span class="dy-count">' + res.total + '건</span>' +
                '<span class="du-pre-sel"><b>선택 ' + Object.keys(P.sel).length + '건</b></span>' +
                '<button type="button" class="btn btn-outline btn-sm" onclick="DOCUP.resetPreF()">필터 초기화</button>' +
            '</div>' +
        '</div>';
    }
    function presetTable(res) {
        if (!res.total) {
            return '<div class="v2-empty"><b>조건에 맞는 ' + P.from + '년 문서가 없습니다.</b><br>' +
                '검색어나 조건을 지워보세요.</div>';
        }
        return '<div class="du-pre-tbl"><table class="table-figma table-compact"><thead><tr>' +
            '<th class="du-pre-ck"><span class="sr-only">선택</span></th>' +
            '<th>문서명</th><th>보고일자</th><th>수발신자</th><th>업무단계</th>' +
        '</tr></thead><tbody>' +
        res.rows.map(function (d) {
            var on = !!P.sel[d.id];
            return '<tr class="' + (on ? 'is-sel' : '') + '">' +
                '<td class="du-pre-ck"><input type="checkbox" id="dp-' + esc(d.id) + '"' + (on ? ' checked' : '') +
                    ' aria-label="' + esc(d.title) + ' 선택" onchange="DOCUP.selDoc(\'' + esc(d.id) + '\', this.checked)"></td>' +
                '<td class="du-pre-t"><label for="dp-' + esc(d.id) + '">' + esc(d.title) + '</label>' +
                    (on ? oneRow(d) : '') + '</td>' +
                '<td>' + esc(d.date) + '</td>' +
                '<td>' + esc(d.sr || '—') + '</td>' +
                '<td>' + (d.stageIds.length ? d.stageIds.length + '개 단계' : '<span class="dx-nodoc">미분류</span>') + '</td>' +
            '</tr>';
        }).join('') + '</tbody></table></div>';
    }
    /* 선택한 문서만 개별 설정을 펼친다 — 전부 펼치면 긴 화면이 된다(§7-3) */
    function oneRow(d) {
        var n = Object.keys(P.sel).length;
        if (n > 1 && !P.expand[d.id]) {
            return '<button type="button" class="du-link" onclick="DOCUP.expand(\'' + esc(d.id) + '\')">개별 설정 ▾</button>';
        }
        var c = P.sel[d.id];
        return '<div class="du-pre-one">' +
            '<label>문서명 ' +
                '<select class="form-select" onchange="DOCUP.setOne(\'' + esc(d.id) + '\',\'titleMode\',this.value)">' +
                    F().optionsHtml([['keep', '그대로'], ['year', '연도 치환 (' + P.from + '→' + P.to + ')'], ['edit', '직접 수정']], c.titleMode) +
                '</select></label>' +
            (c.titleMode === 'edit'
                ? '<input type="text" class="form-input" value="' + esc(c.title || d.title) + '" ' +
                  'oninput="DOCUP.setOne(\'' + esc(d.id) + '\',\'title\',this.value)">' : '') +
            '<label>첨부 ' +
                '<select class="form-select" onchange="DOCUP.setOne(\'' + esc(d.id) + '\',\'fileMode\',this.value)">' +
                    F().optionsHtml([['keep', '그대로 사용 (새 파일 ID 발급)'], ['replace', '파일 교체']], c.fileMode) +
                '</select></label>' +
            (c.fileMode === 'keep'
                ? '<p class="du-dim">' + P.from + '년 첨부 파일을 ' + P.to + '년 저장소로 복사하고 새 파일 ID 를 발급합니다. 원본은 바뀌지 않습니다.</p>'
                : '<p class="du-dim">등록 후 문서 상세에서 새 파일을 올립니다.</p>') +
            (n > 1 ? '<button type="button" class="du-link" onclick="DOCUP.expand(\'' + esc(d.id) + '\')">접기 ▴</button>' : '') +
        '</div>';
    }
    function presetPager(res) {
        if (res.pages <= 1) return '';
        return '<div class="du-pre-pager">' +
            '<button class="btn btn-sm btn-outline"' + (P.page <= 1 ? ' disabled' : '') + ' onclick="DOCUP.prePage(' + (P.page - 1) + ')">← 이전</button>' +
            '<span>' + P.page + ' / ' + res.pages + '</span>' +
            '<button class="btn btn-sm btn-outline"' + (P.page >= res.pages ? ' disabled' : '') + ' onclick="DOCUP.prePage(' + (P.page + 1) + ')">다음 →</button>' +
        '</div>';
    }
    /* 2건 이상이면 일괄 설정 막대 — 공통 옵션을 먼저 적용하고 예외만 개별 수정(D-03) */
    function presetFoot() {
        var n = Object.keys(P.sel).length;
        if (n < 2) return '';
        return '<div class="du-pre-bulk">' +
            '<b>' + n + '건 일괄 설정</b>' +
            '<label>문서명 <select class="form-select" onchange="DOCUP.setBulk(\'titleMode\', this.value)">' +
                F().optionsHtml([['keep', '그대로'], ['year', '연도 치환'], ['edit', '개별 수정']], P.bulk.titleMode) + '</select></label>' +
            '<label>첨부 <select class="form-select" onchange="DOCUP.setBulk(\'fileMode\', this.value)">' +
                F().optionsHtml([['keep', '모두 그대로 사용'], ['replace', '모두 교체']], P.bulk.fileMode) + '</select></label>' +
            '<button type="button" class="du-link" onclick="DOCUP.clearSel()">전체 해제</button>' +
        '</div>';
    }

    /* 접속자 본인 — 프리셋으로 만든 문서의 담당자 */
    function me() {
        var R = global.DYROLE, p = R && R.current ? R.current() : null;
        if (!p) return { dept: '', name: '', uid: '' };
        var dn = '';
        (V().orgDepts ? V().orgDepts() : []).some(function (d) {
            if (d.id === p.deptId) { dn = d.name; return true; }
            return false;
        });
        return { dept: dn || p.deptName || '', name: p.name || '', uid: p.uid || '' };
    }
    function setPreF(k, v) { P[k] = v; P.page = 1; F().rerender(renderP); }
    function resetPreF() { P.q = ''; P.item = ''; P.cycle = ''; P.sr = ''; P.month = ''; P.onlySel = false; P.page = 1; F().rerender(renderP); }
    function prePage(n) { P.page = n; renderP(); }
    function selDoc(id, on) {
        if (on) P.sel[id] = { titleMode: P.bulk.titleMode, title: '', fileMode: P.bulk.fileMode };
        else { delete P.sel[id]; delete P.expand[id]; }
        F().rerender(renderP);
    }
    function clearSel() { P.sel = {}; P.expand = {}; F().rerender(renderP); }
    function expand(id) { P.expand[id] = !P.expand[id]; renderP(); }
    function setOne(id, k, v) {
        if (!P.sel[id]) return;
        P.sel[id][k] = v;
        F().rerender(renderP);
    }
    function setBulk(k, v) {
        P.bulk[k] = v;
        Object.keys(P.sel).forEach(function (id) { P.sel[id][k] = v; });
        F().rerender(renderP);
    }
    function closePreset() { if (V().closeModal() !== false) P = null; }
    /* 저장 뒤에는 확인 없이 닫는다 */
    function closePresetDone() { V().clearModalGuard(); V().closeModal(true); P = null; }

    function runPreset() {
        var ids = Object.keys(P.sel);
        if (!ids.length) return;
        /* closePreset() 이 P 를 비우므로 뒤에서 쓸 값은 **미리** 꺼내 둔다 —
           종전에는 성공 토스트가 P.to 를 읽어 예외가 났고, 가져오기는 됐는데
           아무 피드백도 안 뜨는 상태가 됐다. */
        var FROM = P.from, TO = P.to;
        /* 같은 원본 → 같은 대상연도 재실행은 조용히 중복을 쌓지 않는다(§7-4) */
        var dup = ids.filter(function (id) {
            return D().store().presets.some(function (p) { return p.sourceDocumentId === id && p.targetYear === TO; });
        });
        if (dup.length && !global.confirm(dup.length + '건은 이미 ' + TO + '년으로 가져온 적이 있습니다. 그래도 다시 만들까요?')) return;

        /* 가져온 문서의 담당자는 **가져온 사람 본인**이다 — 전년도 담당자를 그대로
           복제하면 남의 이름으로 새 연도 문서를 만드는 것이 된다(소유권 규칙). */
        var OWNER = me();
        var made = 0, missing = 0, denied = 0;
        ids.forEach(function (id) {
            var src = D().docById(id); if (!src) return;
            var c = P.sel[id];
            var title = c.titleMode === 'edit' ? (c.title || src.title)
                      : c.titleMode === 'year' ? String(src.title).split(FROM).join(TO)
                      : src.title;
            /* 첨부 '그대로 사용' = 원본 파일 ID 참조가 아니라 **새 파일 ID 발급**(D-04).
               프로토타입엔 바이너리가 없으므로 메타데이터 이력만 재현하고,
               원본 파일 정보가 없으면 깨진 링크를 만들지 않고 사실을 남긴다. */
            var files = [];
            if (c.fileMode === 'keep') {
                var srcFiles = src.files || [];
                if (!srcFiles.length) { missing++; }
                srcFiles.forEach(function (f) {
                    files.push({ id: fileId(), name: f.name, size: f.size, at: D().today(),
                                 copiedFromFileId: f.id, sourceYear: FROM, targetYear: TO });
                });
            }
            var res = D().addDocument({
                title: title, sr: '', date: '', year: TO,   /* 보고일자·문서번호는 복제하지 않는다 */
                stageIds: src.stageIds.slice(),
                src: 'upload', dept: OWNER.dept, assignee: OWNER.name, assigneeUid: OWNER.uid,
                files: files, presetOf: id,
                note: FROM + '년 «' + src.title + '» 에서 가져옴',
            });
            if (!res.ok) { denied++; return; }
            var doc = res.doc;
            D().store().presets.push({
                id: 'PRESET-' + FROM + '-' + id, sourceYear: FROM, targetYear: TO,
                sourceDocumentId: id, newDocumentId: doc.id, stageIds: src.stageIds.slice(),
                attachmentMode: c.fileMode, createdAt: D().today(), createdBy: D().actor(),
            });
            made++;
        });
        D().saveStore();
        closePresetDone();
        if (global.DOCEXEC && global.DOCEXEC.render) global.DOCEXEC.render();
        if (global.DOCLIST && global.DOCLIST.render) global.DOCLIST.render();
        V().toast(made + '건을 ' + TO + '년으로 가져왔습니다.' +
            (missing ? ' ' + missing + '건은 원본 첨부가 없어 «원본 파일 확인 필요»로 남았습니다.' : '') +
            (denied ? ' ' + denied + '건은 소유권 검증에 걸려 만들지 않았습니다.' : ''));
    }

    global.DOCUP = {
        open: open, cancel: cancel, next: next, prev: prev, submit: submit,
        addFiles: addFiles, delFile: delFile, onTitle: onTitle, pickOwner: pickOwner, setDup: setDup,
        setPF: setPF, toggleAcc: toggleAcc, pickStage: pickStage, pickGroup: pickGroup, clearStages: clearStages,
        openPreset: openPreset, closePreset: closePreset, runPreset: runPreset, dirty: dirty,
        setPreF: setPreF, resetPreF: resetPreF, prePage: prePage,
        selDoc: selDoc, clearSel: clearSel, expand: expand, setOne: setOne, setBulk: setBulk,
    };
}(window));
