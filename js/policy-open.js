/* =====================================================================
   policy-open.js · 발주처 확정 대기 항목 (전역 DYPOLICY)

   시연 중 주무관님께 **그 자리에서 여쭐 것**을 화면에 띄우는 창구다.
   프로토타입이 임의로 정하지 않고 비워 둔 자리를 모아, 지금 보고 있는 화면의
   것부터 보여준다. 답을 들으면 그 자리에서 골라 두고, 마지막에 정리본을
   복사해 회의록·전달 문서로 넘긴다.

   ── 왜 화면 안에 두는가 ─────────────────────────────────────────────
   "미구현 갭은 그럴듯하게 채우지 말고 화면에 드러낸다"(CLAUDE.md)를
   한 걸음 더 민 것이다. 화면마다 '미등록'으로 흩어 놓으면 시연 중 그걸 모아
   질문으로 만들기 어렵다. 여기서 한 번에 묻고, 답을 그 자리에 남긴다.

   ── 항목은 짧게 (MUST) ─────────────────────────────────────────────
   한 항목은 **질문 한 줄 + 지금 상태 한 줄 + 선택지**가 전부다.
   시연 중 소리 내어 읽고 바로 답을 받을 분량이어야 한다. 배경 설명·영향
   분석을 붙이면 읽다가 질문 타이밍을 놓친다(초판이 그 오류를 냈다).
   · 질문은 그대로 여쭐 수 있는 말로 쓴다 — 화면 용어·조문 번호를 넣지 않는다.
   · "지금"이 없으면 답할 수 없다 — 무엇을 바꾸는 결정인지 모르기 때문이다.

   ── 단일 출처 규칙 ─────────────────────────────────────────────────
   · 항목은 이 파일에만 정의한다. 화면이 자체 '확정 필요' UI 를 그리지 않는다.
   · MAP 은 page id → 항목 id (DYLAW.MAP 과 같은 방식). 화면이 없으면 생략.
   · 결정 기록은 localStorage('dy-policy-v1') 에만 쌓이고 항목 정의를 덮지 않는다.
   · 항목을 지우지 말고 결정되면 decided 로 남긴다 — 왜 그렇게 정했는지가 근거다.
   ===================================================================== */
(function (global) {
    'use strict';

    var SKEY = 'dy-policy-v1';
    function V() { return global.DYV2; }
    function esc(s) { return V() ? V().esc(String(s == null ? '' : s)) : String(s == null ? '' : s); }

    /* kind — scope 공개 범위 / data 자료 필요 / integration 연동 */
    var ITEMS = [
        {
            id: 'facil-scope', kind: 'scope', menu: '시설물 안전관리',
            title: '시설물 목록, 누가 보나요?',
            now: '지금은 모든 부서가 80건을 다 봅니다.',
            options: [
                { k: 'all', label: '모든 부서' },
                { k: 'dept', label: '맡은 부서만' },
                { k: 'mixed', label: '보기는 전체 · 고치는 건 맡은 부서만' }
            ]
        },
        {
            id: 'target-scope', kind: 'scope', menu: '기본정보',
            title: '관리대상, 누가 등록하나요?',
            now: '지금은 누구나 등록·수정할 수 있습니다.',
            options: [
                { k: 'all', label: '누구나' },
                { k: 'read-all', label: '보기는 전체 · 등록은 재난안전과' },
                { k: 'dept', label: '맡은 부서만' }
            ]
        },
        {
            id: 'budget-scope', kind: 'scope', menu: '예산관리',
            title: '다른 부서 예산도 보이게 할까요?',
            now: '지금은 전 부서 예산이 다 보입니다.',
            options: [
                { k: 'all', label: '다 공개' },
                { k: 'own', label: '우리 부서 + 재난안전과' },
                { k: 'summary', label: '총액만 공개' }
            ]
        },
        {
            id: 'opinion-scope', kind: 'scope', menu: '의견청취',
            title: '접수된 의견, 누가 보나요?',
            now: '지금은 모든 부서가 봅니다. 익명으로 낸 사람이 드러날 수 있습니다.',
            options: [
                { k: 'all', label: '모든 부서' },
                { k: 'related', label: '해당 부서 + 재난안전과' },
                { k: 'anon', label: '익명 건만 제한' }
            ]
        },
        {
            id: 'eval-scope', kind: 'scope', menu: '인력 평가',
            title: '평가 결과, 누가 보나요? (개인정보)',
            now: '지금은 전 부서 평가 결과가 다 보이고 평가 등록도 누구나 됩니다.',
            options: [
                { k: 'evaluator', label: '평가한 사람 + 재난안전과' },
                { k: 'self', label: '위 + 본인 것만' },
                { k: 'dept', label: '위 + 소속 부서장' }
            ]
        },
        {
            id: 'doc-org', kind: 'data', menu: '위험성평가 (공문)',
            title: '공문에 넣을 기관정보를 주실 수 있나요?',
            now: '처리과 기호·주소·전화·팩스·관인 자리를 비워 뒀습니다.',
            options: [{ k: 'given', label: '자료 주심' }, { k: 'later', label: '실 개발 때' }]
        },
        {
            id: 'dept-list', kind: 'data', menu: '이행점검 · 경영방침',
            title: '부서 명단 39개를 주실 수 있나요?',
            now: '지금은 11개 부서만 등록돼 있습니다.',
            options: [{ k: 'given', label: '명단 주심' }, { k: 'partial', label: '대상 부서만 우선' }]
        },
        {
            id: 'onnara', kind: 'integration', menu: '위험성평가 (온나라)',
            title: '온나라에 어떻게 넘기나요?',
            now: '지금은 시연용 흉내입니다. 결재 결과도 실제로 받아오지 않습니다.',
            options: [
                { k: 'api', label: '연계 규격 있음' },
                { k: 'file', label: '파일로 내려받아 직접 상신' },
                { k: 'tbd', label: '실 개발 때 협의' }
            ]
        },
        {
            id: 'edu-annex5', kind: 'data', menu: '안전보건교육',
            title: '특별교육 대상 작업 목록을 넣을까요?',
            now: '법에 정해진 목록을 못 받아 화면에 ‘목록 미등록’으로 뒀습니다.',
            options: [{ k: 'add', label: '목록 넣기' }, { k: 'manual', label: '담당자가 직접 입력' }]
        },
        {
            id: 'doc-retain', kind: 'data', menu: '업무문서',
            title: '문서 보존연한 기준을 주실 수 있나요?',
            now: '기준을 못 받아 보존연한을 표시하지 않습니다. 문서대장 5년치도 필요합니다.',
            options: [{ k: 'given', label: '자료 주심' }, { k: 'later', label: '실 개발 때' }]
        }
    ];

    /* page id → 항목 id (DYLAW.MAP 과 같은 방식). 없는 화면은 생략한다. */
    var MAP = {
        'fac-list': ['facil-scope'], 'fac-risk': ['facil-scope'], 'fac-sync': ['facil-scope'],
        'base-targets': ['target-scope'],
        'bgt-main': ['budget-scope'], 'bgt-settings': ['budget-scope'],
        'opn-voice': ['opinion-scope'], 'opn-committee': ['opinion-scope'], 'opn-council': ['opinion-scope'],
        'evl-eval': ['eval-scope'], 'evl-status': ['eval-scope'], 'evl-settings': ['eval-scope'],
        'rsk-list': ['doc-org', 'onnara'],
        'sbm-comply': ['dept-list'], 'safety-policy': ['dept-list'],
        'edu-etc': ['edu-annex5'], 'edu-sup-etc': ['edu-annex5'],
        'docs-archive': ['doc-retain'], 'docs-preset': ['doc-retain'], 'docs-exec': ['doc-retain']
    };

    var KIND = {
        scope: { label: '공개 범위', tone: 'info' },
        data: { label: '자료 필요', tone: 'warning' },
        integration: { label: '연동', tone: 'purple' }
    };

    /* ── 결정 기록 (localStorage) ── */
    function load() {
        try { return JSON.parse(global.localStorage.getItem(SKEY) || '{}') || {}; } catch (e) { return {}; }
    }
    function save(d) { try { global.localStorage.setItem(SKEY, JSON.stringify(d)); } catch (e) {} }
    function decisionOf(id) { return load()[id] || null; }
    function decide(id, k) {
        var d = load();
        if (d[id] && d[id].k === k) delete d[id];          /* 다시 누르면 해제 */
        else d[id] = { k: k, at: (V() ? V().today() : '') };
        save(d); render();
    }
    function resetAll() { save({}); render(); }
    function decidedCount() { var d = load(); return ITEMS.filter(function (x) { return d[x.id]; }).length; }

    /* ── 현재 화면의 항목 ── */
    function pageId() {
        if (global.DYLAW && global.DYLAW.pageId) return global.DYLAW.pageId();
        return (document.body && document.body.getAttribute('data-dy-page')) || 'index';
    }
    function itemsForPage() {
        var ids = MAP[pageId()] || [];
        return ITEMS.filter(function (x) { return ids.indexOf(x.id) >= 0; });
    }

    /* ── 렌더 ── */
    function itemHtml(x, here) {
        var dec = decisionOf(x.id);
        var kind = KIND[x.kind] || KIND.scope;
        var opts = (x.options || []).map(function (o) {
            return '<button type="button" class="pol-opt' + (dec && dec.k === o.k ? ' on' : '') + '"' +
                ' aria-pressed="' + (dec && dec.k === o.k ? 'true' : 'false') + '"' +
                ' onclick="DYPOLICY.decide(\'' + x.id + '\',\'' + o.k + '\')">' + esc(o.label) + '</button>';
        }).join('');
        return '<li class="pol-item' + (dec ? ' is-decided' : '') + (here ? ' is-here' : '') + '">' +
            '<div class="pol-head">' +
                '<span class="chip-status ' + kind.tone + ' chip-sm">' + esc(kind.label) + '</span>' +
                '<span class="pol-menu">' + esc(x.menu) + '</span>' +
                (here ? '<span class="chip-status success chip-sm">이 화면</span>' : '') +
                (dec ? '<span class="chip-status success chip-sm">정함</span>' : '') +
            '</div>' +
            '<p class="pol-q">' + esc(x.title) + '</p>' +
            '<p class="pol-now">' + esc(x.now) + '</p>' +
            '<div class="pol-opts">' + opts + '</div>' +
        '</li>';
    }

    function listHtml() {
        var here = itemsForPage(), hereIds = here.map(function (x) { return x.id; });
        var rest = ITEMS.filter(function (x) { return hereIds.indexOf(x.id) < 0; });
        return here.concat(rest).map(function (x) {
            return itemHtml(x, hereIds.indexOf(x.id) >= 0);
        }).join('');
    }

    function open() {
        var here = itemsForPage();
        V().openModal('정해 주셔야 할 것 — ' + ITEMS.length + '건',
            '<div class="pol-wrap">' +
                '<p class="pol-lead">저희가 <b>임의로 정하지 않고 비워 둔 자리</b>입니다. 답을 들으면 아래에서 눌러 두세요.</p>' +
                '<div class="pol-sum">' +
                    '<span><b>' + decidedCount() + ' / ' + ITEMS.length + '</b> 정함</span>' +
                    (here.length ? '<span class="pol-here-note">이 화면 <b>' + here.length + '건</b>이 맨 위에 있습니다</span>' : '') +
                '</div>' +
                '<ol class="pol-list">' + listHtml() + '</ol>' +
            '</div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
            '<button type="button" class="btn btn-outline" onclick="DYPOLICY.confirmReset()">기록 지우기</button>' +
            '<button type="button" class="btn btn-primary" onclick="DYPOLICY.summary()">정리본 보기</button>');
    }
    /* 열려 있는 모달을 제자리에서 다시 그린다 — openModal 을 다시 부르면 스크롤이 날아간다 */
    function render() {
        var wrap = document.querySelector('.pol-wrap');
        if (!wrap) return;
        var sc = wrap.closest('.modal-body');
        var top = sc ? sc.scrollTop : 0;
        var ol = wrap.querySelector('.pol-list');
        if (ol) ol.innerHTML = listHtml();
        var sum = wrap.querySelector('.pol-sum b');
        if (sum) sum.textContent = decidedCount() + ' / ' + ITEMS.length;
        if (sc) sc.scrollTop = top;
        syncChip();
    }

    /* 정리본 — 회의록에 그대로 옮길 수 있는 텍스트 */
    function summaryText() {
        var d = load();
        var lines = ['담양군 중대재해 통합관리 시스템 — 정해 주셔야 할 것',
                     (V() ? V().today() : '') + ' · 총 ' + ITEMS.length + '건 · 정함 ' + decidedCount() + '건', ''];
        ITEMS.forEach(function (x, i) {
            var dec = d[x.id];
            var opt = dec && (x.options || []).filter(function (o) { return o.k === dec.k; })[0];
            lines.push((i + 1) + '. [' + (KIND[x.kind] || {}).label + '] ' + x.title + '  (' + x.menu + ')');
            lines.push('   → ' + (opt ? opt.label : '미정'));
        });
        return lines.join('\n');
    }
    function summary() {
        V().openModal('정리본 — 회의록용',
            '<div class="pol-wrap">' +
                '<p class="pol-lead">그대로 복사해 회의록에 붙이세요.</p>' +
                '<textarea class="form-textarea pol-sumtext" rows="16" readonly>' + esc(summaryText()) + '</textarea>' +
            '</div>',
            '<button type="button" class="btn btn-secondary" onclick="DYPOLICY.open()">← 목록으로</button>' +
            '<button type="button" class="btn btn-primary" onclick="DYPOLICY.copy()">복사</button>');
        setTimeout(function () { var t = document.querySelector('.pol-sumtext'); if (t) { t.focus(); t.select(); } }, 0);
    }
    function copy() {
        var t = document.querySelector('.pol-sumtext');
        if (!t) return;
        t.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) {}
        V().toast(ok ? '정리본을 복사했습니다.' : '복사가 막혀 있습니다 — 선택된 텍스트를 직접 복사하세요.');
    }
    function confirmReset() {
        V().openModal('기록 지우기',
            '<p class="pol-lead">골라 둔 답을 모두 지웁니다. 항목은 그대로 남습니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYPOLICY.open()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="DYPOLICY.doReset()">지우기</button>');
    }
    function doReset() { resetAll(); open(); }

    /* ── 헤더 칩 카운트 동기화 (layout.js 가 그린 칩) ── */
    function syncChip() {
        var el = document.getElementById('dy-policy-chip');
        if (!el) return;
        var here = itemsForPage().length;
        var n = ITEMS.length - decidedCount();
        el.querySelector('.dy-policy-n').textContent = here ? here : n;
        el.classList.toggle('is-here', here > 0);
        el.setAttribute('title', here
            ? '이 화면에서 정해 주셔야 할 것 ' + here + '건 — 눌러서 바로 여쭤보세요'
            : '정해 주셔야 할 것 ' + n + '건 남음');
    }

    global.DYPOLICY = {
        ITEMS: ITEMS, MAP: MAP,
        open: open, summary: summary, copy: copy,
        decide: decide, confirmReset: confirmReset, doReset: doReset,
        itemsForPage: itemsForPage, decidedCount: decidedCount, syncChip: syncChip,
        summaryText: summaryText
    };
})(window);
