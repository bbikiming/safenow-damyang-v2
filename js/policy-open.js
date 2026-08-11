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
        /* ── 업무 자동발행 (2026-08-10 신설) ──────────────────────────────
           now 는 **구현 후 실제 상태**를 쓴다 — 화면이 이미 하고 있는 걸
           '안 합니다'라고 쓰면 시연 중 그 자리에서 들킨다. */
        {
            id: 'work-assign-who', kind: 'scope', menu: '업무 관리',
            title: '업무 담당자, 누가 정하나요?',
            now: '지금은 그 부서의 과장·소장과 그 부서 담당자가 정할 수 있습니다. 재난안전과는 부서까지만 정해 내려보냅니다.',
            options: [
                { k: 'lead', label: '과장·소장만' },
                { k: 'both', label: '과장·소장과 부서 담당자 모두(지금)' },
                { k: 'team', label: '팀장이 정함' },
                { k: 'self', label: '담당자가 스스로만 가져감' }
            ]
        },
        {
            id: 'work-org-source', kind: 'integration', menu: '업무 관리',
            title: '담당자 배정할 때 쓰는 조직도, 어디 것을 가져올까요?',
            now: '지금은 시스템에 등록된 11개 부서 명단으로 고릅니다. 연계 관리 화면에는 조직도가 행정포털(SSO) 소관으로 잡혀 있습니다.',
            options: [
                { k: 'portal', label: '행정포털 조직도(지금 설계)' },
                { k: 'onnara', label: '온나라 조직도' },
                { k: 'hr', label: '인사시스템 조직도' }
            ]
        },
        {
            id: 'work-due', kind: 'data', menu: '업무 관리',
            title: '제출 기한, 언제까지로 할까요?',
            now: '지금은 이행점검·산안위는 회차 말일, 나머지는 지난 5년 실제 소요일의 상위 25% 지점입니다. 공문에 적힌 기한은 자료에 없습니다.',
            options: [
                { k: 'keep', label: '지금대로' },
                { k: 'period', label: '전부 분기·반기 말일로' },
                { k: 'manual', label: '실제 공문 기한을 사람이 입력' }
            ]
        },
        {
            id: 'work-auto-fire', kind: 'scope', menu: '업무 관리',
            title: '정해진 날이 되면 바로 각 부서에 내보낼까요?',
            now: '지금은 8종만 발행일이 실측으로 안정돼 자동 대상이고, 나머지 18종은 담당자가 확인하고 내보냅니다.',
            options: [
                { k: 'keep', label: '지금대로 8종만 자동' },
                { k: 'manual', label: '전부 확인 후 발행' },
                { k: 'all', label: '전부 자동' }
            ]
        },
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
            /* 화면에 [수정] 버튼은 없다 — [상세] 13개 + [＋ 등록] 2개뿐. '수정'을 쓰면 없는 걸 말한다 */
            now: '지금은 누구나 등록할 수 있습니다. 엑셀 일괄등록도 막혀 있지 않습니다.',
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
            /* 익명 축은 코드에 없다 — 시드 24건 전원 실명이라 '익명 건만 제한'은 없는 걸 가리켰다 */
            now: '지금은 모든 부서가 봅니다. 낸 사람 이름도 그대로 보입니다.',
            options: [
                { k: 'all', label: '모든 부서' },
                { k: 'related', label: '해당 부서 + 재난안전과' },
                { k: 'anon', label: '낸 사람 이름은 가림' }
            ]
        },
        {
            id: 'eval-scope', kind: 'scope', menu: '인력 평가',
            title: '평가 결과, 누가 보나요? (개인정보)',
            now: '지금은 전 부서 평가 결과가 다 보이고 평가 등록도 누구나 됩니다.',
            /* 정리본은 고른 라벨 한 줄만 찍는다 — '위 + …' 는 회의록에서 뜻이 안 선다 */
            options: [
                { k: 'evaluator', label: '평가한 사람 + 재난안전과' },
                { k: 'self', label: '평가한 사람 + 재난안전과 + 본인 것은 본인도' },
                { k: 'dept', label: '평가한 사람 + 재난안전과 + 본인 + 소속 부서장' }
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
            /* 위험성평가만의 문제가 아니다 — 예산·인력평가도 온나라 결재 회신을 시연한다 */
            id: 'onnara', kind: 'integration', menu: '온나라 연동',
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
            title: '특별교육 대상 작업 39종, 고르게 할까요?',
            /* 2026-08-11 별표5 제1호라목 수집 완료 — 목록은 이제 화면에 있다.
             * 남은 선택은 '보여주기'와 '고르게 하기' 사이다. */
            now: '39종 목록을 판단 기준에 펼쳐 보여 주고, 어디에 해당하는지는 등록자가 판단합니다. 교육 건에 작업 번호를 남기지는 않습니다.',
            options: [
                { k: 'show', label: '지금처럼 참고 목록으로만 보여주기' },
                { k: 'pick', label: '등록할 때 해당 작업을 골라 기록에 남기기' }
            ]
        },
        {
            /* 우리가 개인정보보호법 원칙으로 좁혀 두고 확인받는 항목이다 —
               담양군 개인정보 처리방침에 이미 기준이 있으면 그것이 우선이다.
               부서별 완료율을 전 부서에 공개한 것은 법이 아니라 우리 판단이라 함께 묻는다. */
            id: 'edu-privacy', kind: 'scope', menu: '안전보건교육',
            title: '교육 이수 기록, 이 범위가 맞습니까?',
            now: '개인별 시간은 본인·소속 부서·재난안전과·군수만 봅니다. 부서별 완료율은 전 부서가 봅니다.',
            options: [
                { k: 'ok', label: '이대로' },
                { k: 'noboss', label: '부서장은 빼기' },
                { k: 'norate', label: '부서별 완료율도 우리 부서만' },
                { k: 'policy', label: '군 개인정보 처리방침을 따름 (자료 주심)' }
            ]
        },
        {
            id: 'hr-sync', kind: 'integration', menu: '안전보건교육',
            title: '근로자 명단을 인사시스템에서 받아올 수 있나요?',
            now: '지금은 엑셀 업로드와 수기 등록만 있습니다.',
            options: [
                { k: 'api', label: '연동 가능' },
                { k: 'excel', label: '엑셀만' },
                { k: 'tbd', label: '실 개발 때 협의' }
            ]
        },
        {
            id: 'doc-retain', kind: 'data', menu: '업무문서',
            title: '문서 보존연한 기준과 문서대장 5년치를 주실 수 있나요?',
            /* 등록 폼에 이미 보존연한 select 가 있다 — '표시하지 않습니다'는 거짓이었다 */
            now: '지금은 등록할 때 3·5·10년·영구 중에서 고릅니다. 저희가 임의로 넣은 값입니다.',
            options: [{ k: 'given', label: '자료 주심' }, { k: 'later', label: '실 개발 때' }]
        }
    ];

    /* page id → 항목 id (DYLAW.MAP 과 같은 방식). 없는 화면은 생략한다. */
    var MAP = {
        'fac-list': ['facil-scope'], 'fac-risk': ['facil-scope'], 'fac-sync': ['facil-scope'],
        /* base-bulk 는 엑셀로 관리대상을 대량 등록하는 화면이라 '누가 등록하나요'가 더 크게 걸린다 */
        'base-targets': ['target-scope'], 'base-bulk': ['target-scope'],
        'bgt-main': ['budget-scope', 'onnara'], 'bgt-settings': ['budget-scope'],
        'opn-voice': ['opinion-scope'], 'opn-committee': ['opinion-scope'], 'opn-council': ['opinion-scope'],
        'evl-eval': ['eval-scope', 'onnara'], 'evl-status': ['eval-scope'], 'evl-settings': ['eval-scope'],
        'rsk-list': ['doc-org', 'onnara'],
        'admin-integration': ['onnara'],
        /* 경영방침은 menu.html?m=policy → 'sbm-policy' 로 환원된다(DYLAW.MENU_ALIAS).
           'safety-policy' 라고 적으면 어디에도 도달하지 못한다 — 실제로 냈던 결함. */
        'sbm-comply': ['dept-list'], 'sbm-policy': ['dept-list'],
        /* 배정 질문은 배정하는 화면(work-dept)과 담당자 화면(my-work)에도 붙인다 —
           정의만 하고 매핑을 빠뜨리면 그 화면에서만 조용히 안 뜬다. */
        'work-admin': ['work-auto-fire', 'work-due', 'dept-list', 'onnara'],
        'work-dept': ['work-assign-who', 'work-org-source', 'work-due'],
        'my-work': ['work-assign-who'],
        'edu-etc': ['edu-annex5'], 'edu-sup-etc': ['edu-annex5'],
        'edu-status': ['edu-privacy'], 'edu-workers': ['edu-privacy', 'hr-sync'],
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
            '<button type="button" class="btn btn-primary" onclick="DYPOLICY.summary()">정리본 보기</button>',
            { chrome: true });
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
            '<button type="button" class="btn btn-primary" onclick="DYPOLICY.copy()">복사</button>',
            { chrome: true });
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
            '<button type="button" class="btn btn-primary" onclick="DYPOLICY.doReset()">지우기</button>',
            { chrome: true });
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

    /* MAP 키가 실제 page id 인지 자기 점검 — 오타는 "그 화면에서 영영 안 뜸"으로만
       드러나 눈치채기 어렵다('safety-policy' 오타를 실제로 냈다). DYLAW.MAP 이
       page id 전수 목록이므로 그것과 대조한다. */
    function selfCheck() {
        var L = global.DYLAW && global.DYLAW.MAP;
        if (!L) return;
        var bad = Object.keys(MAP).filter(function (k) { return !(k in L); });
        if (bad.length && global.console) {
            console.warn('[DYPOLICY] 존재하지 않는 page id 매핑 — 이 화면에서는 항목이 뜨지 않습니다: ' + bad.join(', '));
        }
        var unknown = [];
        Object.keys(MAP).forEach(function (k) {
            (MAP[k] || []).forEach(function (id) {
                if (!ITEMS.some(function (x) { return x.id === id; }) && unknown.indexOf(id) < 0) unknown.push(id);
            });
        });
        if (unknown.length && global.console) console.warn('[DYPOLICY] 없는 항목 id: ' + unknown.join(', '));
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', selfCheck);
    else selfCheck();

    global.DYPOLICY = {
        ITEMS: ITEMS, MAP: MAP, selfCheck: selfCheck,
        open: open, summary: summary, copy: copy,
        decide: decide, confirmReset: confirmReset, doReset: doReset,
        itemsForPage: itemsForPage, decidedCount: decidedCount, syncChip: syncChip,
        summaryText: summaryText
    };
})(window);
