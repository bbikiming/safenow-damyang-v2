/* =====================================================================
   policy-open.js · 발주처 확정 대기 항목 (전역 DYPOLICY)

   시연 중 주무관님께 **그 자리에서 여쭐 것**을 화면에 띄우는 창구다.
   프로토타입이 임의로 정하지 않고 비워 둔 자리를 모아, 지금 보고 있는 화면의
   것부터 보여준다. 답을 들으면 그 자리에서 골라 기록하고, 마지막에 정리본을
   복사해 회의록·전달 문서로 넘긴다.

   ── 왜 화면 안에 두는가 ─────────────────────────────────────────────
   "미구현 갭은 그럴듯하게 채우지 말고 화면에 드러낸다"(CLAUDE.md)를
   한 걸음 더 민 것이다. 화면마다 '미등록'으로 흩어 놓으면 시연 중 그걸 모아
   질문으로 만들기 어렵다. 여기서 한 번에 묻고, 답을 그 자리에 남긴다.

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

    /* kind — scope 권한·공개 범위 / data 자료 미확보 / integration 연동 방식 */
    var ITEMS = [
        {
            id: 'facil-scope', kind: 'scope', menu: '시설물 안전관리',
            title: '시설물 대장·위험도를 전 부서가 보는가',
            question: '시설물 80건을 <b>전 부서가 모두</b> 보게 할까요, <b>소관 부서 것만</b> 보게 할까요?',
            now: '지금은 누구로 접속해도 전건(80건)이 보입니다.',
            why: '중대재해는 시설물 소관 부서가 관리 책임을 집니다. 남의 시설물이 섞이면 자기 책임 범위가 흐려지고, 반대로 너무 좁히면 인접 시설 위험을 못 봅니다.',
            options: [
                { k: 'all', label: '전 부서 공개 (지금 상태)' },
                { k: 'dept', label: '소관 부서만' },
                { k: 'mixed', label: '조회는 전체 · 수정은 소관 부서만' }
            ],
            impact: '‘소관 부서만’으로 정하면 목록·필터·상세 진입에 부서 스코프를 겁니다(§12). 시설물 데이터에 소관 부서 필드가 없으면 FMS 수신 항목에 추가가 필요합니다.'
        },
        {
            id: 'target-scope', kind: 'scope', menu: '기본정보',
            title: '관리대상 현황을 전 부서가 보는가',
            question: '공중이용시설·원료제조물 등 <b>관리대상 13건</b>을 전 부서가 보게 할까요?',
            now: '지금은 전건이 보이고 [＋ 등록]도 누구에게나 열려 있습니다.',
            why: '관리대상은 중처법 §9(중대시민재해)의 적용 단위라 총괄 부서는 전체를 봐야 하지만, 등록·수정까지 전 부서가 하면 대장이 흐트러집니다.',
            options: [
                { k: 'all', label: '조회 전체 · 등록도 전체 (지금 상태)' },
                { k: 'read-all', label: '조회 전체 · 등록은 주관부서만' },
                { k: 'dept', label: '소관 부서만' }
            ],
            impact: '관리대상 화면은 전용 모듈 없이 HTML 인라인이라, 정하면 구조를 함께 정리해야 합니다.'
        },
        {
            id: 'budget-scope', kind: 'scope', menu: '예산관리',
            title: '예산 총괄표를 전 부서가 보는가',
            question: '부서별 안전예산 편성·집행을 <b>다른 부서도</b> 보게 할까요?',
            now: '지금은 전 부서 예산이 모두 보입니다.',
            why: '예산은 총괄 성격이라 비교 공개가 자연스럽지만, 부서 간 편성액 비교가 민감할 수 있습니다.',
            options: [
                { k: 'all', label: '전 부서 공개 (지금 상태)' },
                { k: 'own', label: '소속 부서 + 총괄부서만' },
                { k: 'summary', label: '총액만 공개 · 세부는 소관 부서' }
            ],
            impact: '점검표 생성은 이미 담당자만 가능하도록 막아 두었습니다(1단계).'
        },
        {
            id: 'opinion-scope', kind: 'scope', menu: '의견청취',
            title: '접수된 의견을 전 부서가 보는가',
            question: '근로자·군민이 올린 의견을 <b>전 부서가 열람</b>하게 할까요, 해당 부서와 주관부서만 볼까요?',
            now: '지금은 전 부서가 모두 열람합니다.',
            why: '익명 제보가 섞이면 제보자가 특정될 수 있습니다. 반대로 너무 좁히면 유사 위험이 다른 부서에 공유되지 않습니다.',
            options: [
                { k: 'all', label: '전 부서 열람 (지금 상태)' },
                { k: 'related', label: '해당 부서 + 주관부서만' },
                { k: 'anon', label: '익명 건만 제한 · 실명 건은 공개' }
            ],
            impact: '제보 경로(익명/실명) 구분 필드가 필요합니다.'
        },
        {
            id: 'eval-scope', kind: 'scope', menu: '인력 평가',
            title: '인력 평가 결과를 누가 보는가 (개인정보)',
            question: '평가 결과를 <b>평가자만</b> 볼까요? <b>피평가자 본인</b>도 자기 것을 볼 수 있나요?',
            now: '지금은 누구로 접속해도 11개 부서 전원의 평가 대상·결과가 보이고 [평가등록]도 열려 있습니다.',
            why: '**개인정보라 이번 목록에서 가장 민감합니다.** 안전보건관리책임자 평가는 중처법 시행령 §4 5호의 평가 근거라 기록은 남겨야 하지만, 열람 범위는 별개 문제입니다.',
            options: [
                { k: 'evaluator', label: '평가자 + 총괄부서만' },
                { k: 'self', label: '평가자 + 총괄 + 본인(자기 것만)' },
                { k: 'dept', label: '위 + 소속 부서장' }
            ],
            impact: '인력 평가 화면은 전용 모듈 없이 HTML 인라인이라, 정하면 구조를 함께 정리해야 합니다. 개인정보 항목이라 우선순위가 높습니다.'
        },
        {
            id: 'doc-org', kind: 'data', menu: '위험성평가 (공문)',
            title: '공문 기관정보',
            question: '공문 서식에 들어갈 <b>처리과 기호·주소·전화·팩스·전자우편·공개구분·관인</b>을 받을 수 있을까요?',
            now: '지면에 ‘미등록’으로 비워 두었습니다. 서식(별지 제1호)은 전 행정기관 공통이라 틀은 맞춰 두었습니다.',
            why: '담양군 고유값이라 지어내면 실제 공문과 달라집니다.',
            options: [{ k: 'given', label: '자료 받기로 함' }, { k: 'later', label: '실 개발 단계에서' }],
            impact: '받으면 공문 미리보기가 실제 발송 가능한 형태가 됩니다.'
        },
        {
            id: 'dept-list', kind: 'data', menu: '이행점검 · 경영방침',
            title: '부서 명단 39개',
            question: '과·사업소 <b>39개 전체 명단</b>을 주실 수 있을까요? 지금은 11개만 등록돼 있습니다.',
            now: '화면에 ‘11 / 39개 등록 · 나머지 28개 명단 미확보’로 드러내고 있습니다.',
            why: '전수 점검표인데 28개가 빠져 있으면 ‘전수’가 성립하지 않습니다.',
            options: [{ k: 'given', label: '명단 받기로 함' }, { k: 'partial', label: '대상 부서만 우선' }],
            impact: '`DYV2.ORG` 한 곳만 늘리면 이행점검·경영방침 두 화면이 자동으로 따라옵니다(§3).'
        },
        {
            id: 'onnara', kind: 'integration', menu: '위험성평가 (온나라)',
            title: '온나라 연동 방식',
            question: '온나라에 <b>어떤 방식</b>으로 넘길까요? 결재 결과는 어떻게 받아오나요?',
            now: '기안·상신은 시연용 시뮬레이션이고, 반려 시 문서를 새로 만들어 다시 올리는 흐름까지만 구현했습니다.',
            why: '요청과 결재값 수신만 가능하다고 들었습니다 — 그 범위가 맞는지, 연계 규격이 있는지 확인이 필요합니다.',
            options: [
                { k: 'api', label: '연계 API 있음 (규격 제공)' },
                { k: 'file', label: '파일 반출 후 수기 상신' },
                { k: 'tbd', label: '실 개발 단계에서 협의' }
            ],
            impact: '방식에 따라 문서번호 채번·첨부 반출 형태가 달라집니다.'
        },
        {
            id: 'edu-annex5', kind: 'data', menu: '안전보건교육',
            title: '특별교육 대상 작업 목록 (별표5)',
            question: '산업안전보건법 시행규칙 <b>별표5 제1호라목</b>(특별교육 대상 작업)을 수록할까요?',
            now: '법령 스냅샷에 미수록이라 화면에 ‘목록 미등록’으로 드러내고 있습니다. 지어내지 않았습니다.',
            why: '특별교육은 대상 작업이 정해져 있어야 담당자가 고를 수 있습니다.',
            options: [{ k: 'add', label: '수록하기로 함' }, { k: 'manual', label: '담당자 직접 입력 유지' }],
            impact: '수록하면 기타교육 등록에서 작업을 고르는 방식으로 바뀝니다.'
        },
        {
            id: 'doc-retain', kind: 'data', menu: '업무문서',
            title: '법정 기록·보존 항목 (시행규칙 §37) · 문서대장 5년치',
            question: '보존 대상·연한 기준과 <b>문서대장 5년치</b> 자료를 받을 수 있을까요?',
            now: '시행규칙 §37 미수집이라 ‘법정 기록·보존 항목’이라고 쓰지 않았습니다.',
            why: '보존연한을 임의로 적으면 실제 기록관리 규정과 어긋납니다.',
            options: [{ k: 'given', label: '자료 받기로 함' }, { k: 'later', label: '실 개발 단계에서' }],
            impact: '받으면 문서함에 보존연한·폐기 예정이 실제 기준으로 표시됩니다.'
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
        scope: { label: '권한·공개 범위', tone: 'info' },
        data: { label: '자료 미확보', tone: 'warning' },
        integration: { label: '연동 방식', tone: 'purple' }
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
    function note(id, text) {
        var d = load();
        d[id] = d[id] || { k: '', at: (V() ? V().today() : '') };
        d[id].memo = text;
        save(d);
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
    function itemOf(id) { for (var i = 0; i < ITEMS.length; i++) { if (ITEMS[i].id === id) return ITEMS[i]; } return null; }

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
                '<b class="pol-title">' + esc(x.title) + '</b>' +
                '<span class="pol-menu">' + esc(x.menu) + '</span>' +
                (here ? '<span class="chip-status success chip-sm">이 화면</span>' : '') +
                (dec ? '<span class="chip-status success chip-sm">결정됨</span>' : '') +
            '</div>' +
            '<p class="pol-q">' + x.question + '</p>' +
            '<p class="pol-now"><b>지금</b> ' + esc(x.now) + '</p>' +
            '<p class="pol-why"><b>왜 정해야 하나</b> ' + x.why + '</p>' +
            '<div class="pol-opts">' + opts + '</div>' +
            '<label class="pol-memo"><span>메모</span>' +
                '<input type="text" class="form-input" value="' + esc(dec && dec.memo || '') + '"' +
                ' placeholder="답변·단서를 그대로 적어 두세요"' +
                ' onchange="DYPOLICY.note(\'' + x.id + '\', this.value)"></label>' +
            '<p class="pol-impact"><b>정하면</b> ' + esc(x.impact) + '</p>' +
        '</li>';
    }

    function open(only) {
        var here = itemsForPage();
        var hereIds = here.map(function (x) { return x.id; });
        var list = only === 'here' ? here
            : here.concat(ITEMS.filter(function (x) { return hereIds.indexOf(x.id) < 0; }));
        var n = decidedCount();
        V().openModal('발주처 확정 필요 — ' + ITEMS.length + '건',
            '<div class="pol-wrap">' +
                '<p class="pol-lead">프로토타입이 <b>임의로 정하지 않고 비워 둔 자리</b>입니다. ' +
                    '시연 중 답을 들으면 그 자리에서 골라 두세요 — 아래 <b>[정리본 보기]</b>로 회의록에 옮길 수 있습니다.</p>' +
                '<div class="pol-sum">' +
                    '<span><b>' + n + ' / ' + ITEMS.length + '</b> 결정됨</span>' +
                    (here.length ? '<span class="pol-here-note">이 화면 관련 <b>' + here.length + '건</b>을 맨 위에 두었습니다</span>' : '') +
                '</div>' +
                '<ol class="pol-list">' +
                    list.map(function (x) { return itemHtml(x, hereIds.indexOf(x.id) >= 0); }).join('') +
                '</ol>' +
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
        var here = itemsForPage(), hereIds = here.map(function (x) { return x.id; });
        var list = here.concat(ITEMS.filter(function (x) { return hereIds.indexOf(x.id) < 0; }));
        var ol = wrap.querySelector('.pol-list');
        if (ol) ol.innerHTML = list.map(function (x) { return itemHtml(x, hereIds.indexOf(x.id) >= 0); }).join('');
        var sum = wrap.querySelector('.pol-sum b');
        if (sum) sum.textContent = decidedCount() + ' / ' + ITEMS.length;
        if (sc) sc.scrollTop = top;
        syncChip();
    }

    /* 정리본 — 회의록에 그대로 옮길 수 있는 텍스트 */
    function summaryText() {
        var d = load();
        var lines = ['담양군 중대재해 통합관리 시스템 — 발주처 확정 필요 항목',
                     '기준일 ' + (V() ? V().today() : '') + ' · 총 ' + ITEMS.length + '건 · 결정 ' + decidedCount() + '건', ''];
        ITEMS.forEach(function (x, i) {
            var dec = d[x.id];
            var opt = dec && (x.options || []).filter(function (o) { return o.k === dec.k; })[0];
            lines.push((i + 1) + '. [' + (KIND[x.kind] || {}).label + '] ' + x.title + '  (' + x.menu + ')');
            lines.push('   질문: ' + x.question.replace(/<[^>]+>/g, ''));
            lines.push('   결정: ' + (opt ? opt.label : '— 미정 —') + (dec && dec.memo ? '  / 메모: ' + dec.memo : ''));
            lines.push('');
        });
        return lines.join('\n');
    }
    function summary() {
        V().openModal('정리본 — 회의록용',
            '<div class="pol-wrap">' +
                '<p class="pol-lead">아래 내용을 그대로 복사해 회의록·전달 문서에 붙이세요.</p>' +
                '<textarea class="form-textarea pol-sumtext" rows="18" readonly>' + esc(summaryText()) + '</textarea>' +
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
        V().openModal('결정 기록 지우기',
            '<p style="font-size:var(--fs-13);line-height:1.6;">시연 중 골라 둔 결정과 메모를 모두 지웁니다. 항목 자체는 남습니다.</p>',
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
            ? '이 화면과 관련된 확정 필요 항목 ' + here + '건 — 눌러서 바로 질문하세요'
            : '발주처 확정 필요 항목 ' + n + '건 남음');
    }

    global.DYPOLICY = {
        ITEMS: ITEMS, MAP: MAP,
        open: open, summary: summary, copy: copy,
        decide: decide, note: note, confirmReset: confirmReset, doReset: doReset,
        itemsForPage: itemsForPage, decidedCount: decidedCount, syncChip: syncChip,
        summaryText: summaryText
    };
})(window);
