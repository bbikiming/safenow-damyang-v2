/* =====================================================================
   policy-open.js · 외부 자료·연계 준비사항 (전역 DYPOLICY)

   법령·업무 논리로 자체 확정할 수 있는 정책 질문은 화면 정의서 §6에서
   모두 끝낸다. 이 창구에는 담양군 제공 자료와 타 기관 연계 규격처럼
   시스템이 스스로 만들 수 없는 입력만 남긴다. 각 항목에는 미수신 상태의
   대체 동작을 함께 적어, 자료가 늦어도 개발을 막거나 성공을 가장하지 않는다.
   ===================================================================== */
(function (global) {
    'use strict';

    var SKEY = 'dy-external-readiness-v1';
    function V() { return global.DYV2; }
    function esc(s) { return V() ? V().esc(String(s == null ? '' : s)) : String(s == null ? '' : s); }

    var ITEMS = [
        {
            id: 'doc-org', kind: 'data', menu: '공문·보고서',
            title: '담양군 기관정보·관인 자료',
            now: '처리과 기호·주소·전화·팩스·관인이 아직 없습니다. 미수신 동안 지면의 그 칸을 미등록으로 표시하고 문서번호에 임시 채번임을 밝힙니다. 상신 자체를 막지는 않습니다 — 막으면 공문 흐름을 시연할 수 없고, 무엇이 비었는지는 지면이 드러냅니다.',
            options: [{ k: 'waiting', label: '자료 대기' }, { k: 'received', label: '수신 완료' }]
        },
        {
            id: 'dept-list', kind: 'data', menu: '조직·업무 발행',
            title: '담양군 전체 부서·인원 명단',
            now: '현재 일부 시연 명단만 있습니다. 행정포털 조직도를 단일 출처로 쓰고, 미수신 부서는 미등록으로 표시하며 없는 부서로 업무를 자동 발행하지 않습니다.',
            options: [{ k: 'partial', label: '부분 자료' }, { k: 'received', label: '전체 수신' }]
        },
        {
            id: 'onnara', kind: 'integration', menu: '온나라 연동',
            title: '온나라 연계 규격·접속정보',
            now: '실연계가 없어 상신은 시뮬레이션입니다. 상신하면 화면에 결재중으로만 남고 결재완료·반려는 만들지 않습니다 — 그 두 상태는 온나라 회신으로만 생깁니다. 묶음 내려받기·수동 결과 기록 경로는 아직 없습니다.',
            options: [{ k: 'waiting', label: '규격 대기' }, { k: 'received', label: '규격 수신' }]
        },
        {
            id: 'fms-data', kind: 'integration', menu: '시설물 안전관리',
            title: 'FMS 실데이터·코드·연계 규격',
            now: '실데이터가 없습니다. 수신 전에는 시연 자료임을 표시하고 동기화 성공으로 기록하지 않으며, 시설물번호를 기준으로 한 검증용 파일 반입만 허용합니다.',
            options: [{ k: 'waiting', label: '자료 대기' }, { k: 'received', label: '수신 완료' }]
        },
        {
            id: 'hr-sync', kind: 'integration', menu: '조직·안전보건교육',
            title: '행정포털·인사 연계 규격',
            now: '연계 전에는 엑셀 반입과 직접 등록을 사용하고 출처를 구분합니다. 관리감독자 지정일은 재난안전과가 별도로 등록하며 인사 기본정보와 섞지 않습니다.',
            options: [{ k: 'waiting', label: '규격 대기' }, { k: 'received', label: '규격 수신' }]
        },
        {
            id: 'official-letter', kind: 'data', menu: '위험성평가·안전보건교육',
            title: '담양군 공문 샘플',
            now: '샘플은 나중에 받습니다. 그전에는 표준 별지 제1호서식 지면으로 초안을 만들되 공식 문서번호·관인·서식 적합 판정은 하지 않습니다. 두 도메인이 같은 공용 골격(DYDOC)을 쓰므로 샘플이 오면 본문 문구만 맞춥니다.',
            options: [{ k: 'later', label: '추후 제공' }, { k: 'received', label: '수신 완료' }]
        },
        {
            id: 'doc-retain', kind: 'data', menu: '업무문서',
            title: '담양군 기록관리 기준·기존 문서대장',
            now: '기관 기준 수신 전에는 법령상 개별 최소기간과 임시 분류값을 함께 표시하고, 임의 폐기는 금지합니다. 기존 문서대장은 별도 반입 검증을 거칩니다.',
            options: [{ k: 'waiting', label: '자료 대기' }, { k: 'received', label: '수신 완료' }]
        },
        {
            id: 'law-list', kind: 'data', menu: '법령·이행점검',
            title: '담양군 적용 관계 법령 목록',
            now: '법이 적용 법령을 기관별로 열거하지 않아 담양군 확인이 필요합니다. 수신 전에는 이미 근거가 확인된 법령만 표시하고 목록이 완결되지 않았음을 알리며, 근거 미지정 업무의 저장은 허용하되 전달 전에 경고합니다.',
            options: [{ k: 'waiting', label: '목록 대기' }, { k: 'received', label: '수신 완료' }]
        },
        {
            id: 'public-transport', kind: 'data', menu: '관리대상 현황',
            title: '담양군 공중교통수단 운영·관리 대상 자료',
            now: '대상 유무를 확인할 자료가 없습니다. 수신 전에는 0건으로 단정하거나 빈 탭을 만들지 않고 대상 자료 미수신으로 표시합니다. 대상이 확인되면 시설물과 같은 판정·점검 구조를 적용합니다.',
            options: [{ k: 'waiting', label: '자료 대기' }, { k: 'received', label: '수신 완료' }]
        },
        {
            id: 'material-scope', kind: 'data', menu: '관리대상 현황',
            title: '담양군 원료·제조물 생산·판매·유통·관리 실태와 적용 대상 품목 목록',
            now: '실목록 수신 전에는 등록된 시연자료를 확인 전 자료로 표시하고 현재 건수를 법정 적용 대상 수로 사용하지 않습니다. 0건도 해당 없음으로 단정하지 않으며 개별 등록만 허용합니다.',
            options: [{ k: 'waiting', label: '자료 대기' }, { k: 'received', label: '수신 완료' }]
        }
    ];

    var MAP = {
        'rsk-list': ['doc-org', 'onnara', 'official-letter'],
        'rsk-occ': ['doc-org', 'onnara', 'official-letter'],
        'rsk-imp': ['doc-org', 'onnara', 'official-letter'],
        'reports': ['doc-org', 'onnara'],
        'admin-integration': ['onnara', 'fms-data', 'hr-sync'],
        'fac-list': ['fms-data'], 'fac-risk': ['fms-data'], 'fac-sync': ['fms-data'], 'fac-settings': ['fms-data'],
        'base-targets': ['fms-data', 'public-transport', 'material-scope'],
        'sbm-org': ['dept-list', 'hr-sync'], 'sbm-comply': ['dept-list', 'law-list'], 'sbm-policy': ['dept-list'],
        'work-admin': ['dept-list', 'onnara'], 'work-dept': ['dept-list', 'hr-sync'], 'my-work': ['dept-list'],
        /* 공문을 쓰는 교육 화면은 위험성평가와 같은 외부 의존을 진다 —
           기관정보·관인(doc-org) · 온나라 연계(onnara) · 공문 샘플(official-letter).
           갭이 그 화면에서 안 보이면 시연 중에 처음 발견된다.
           ※ 'edu-reg-detail' 을 넣지 않는 이유 — 그 화면은 data-dy-page 가 'edu-reg' 라
             별도 page id 가 아니고, DYLAW.MAP 에도 키가 없어 selfCheck() 가 경고를 낸다. */
        'edu-reg': ['hr-sync', 'doc-org', 'onnara', 'official-letter'],
        'edu-etc': ['hr-sync', 'doc-org', 'onnara', 'official-letter'],
        'edu-hire': ['hr-sync', 'doc-org', 'onnara', 'official-letter'],
        'edu-sup': ['hr-sync', 'doc-org', 'onnara', 'official-letter'],
        'edu-sup-hire': ['hr-sync', 'doc-org', 'onnara', 'official-letter'],
        'edu-sup-etc': ['hr-sync', 'doc-org', 'onnara', 'official-letter'],
        'edu-approval': ['doc-org', 'onnara', 'official-letter'],
        'edu-workers': ['hr-sync'], 'edu-status': ['hr-sync'],
        'admin-law': ['law-list'],
        'docs-archive': ['doc-retain'], 'docs-preset': ['doc-retain'], 'docs-exec': ['doc-retain']
    };

    var KIND = {
        data: { label: '자료', tone: 'warning' },
        integration: { label: '연계', tone: 'purple' }
    };

    function load() {
        try { return JSON.parse(global.localStorage.getItem(SKEY) || '{}') || {}; } catch (e) { return {}; }
    }
    function save(d) { try { global.localStorage.setItem(SKEY, JSON.stringify(d)); } catch (e) {} }
    function decisionOf(id) { return load()[id] || null; }
    function decide(id, k) {
        var d = load();
        d[id] = { k: k, at: (V() ? V().today() : '') };
        save(d);
        render();
    }
    function resetAll() { save({}); render(); }
    function readyCount() {
        var d = load();
        return ITEMS.filter(function (x) { return d[x.id] && d[x.id].k === 'received'; }).length;
    }

    function pageId() {
        if (global.DYLAW && global.DYLAW.pageId) return global.DYLAW.pageId();
        return (document.body && document.body.getAttribute('data-dy-page')) || 'index';
    }
    function itemsForPage() {
        var ids = MAP[pageId()] || [];
        return ITEMS.filter(function (x) { return ids.indexOf(x.id) >= 0; });
    }

    function itemHtml(x, here) {
        var dec = decisionOf(x.id);
        var kind = KIND[x.kind] || KIND.data;
        var received = dec && dec.k === 'received';
        var opts = x.options.map(function (o) {
            return '<button type="button" class="pol-opt' + (dec && dec.k === o.k ? ' on' : '') + '"' +
                ' aria-pressed="' + (dec && dec.k === o.k ? 'true' : 'false') + '"' +
                ' onclick="DYPOLICY.decide(\'' + x.id + '\',\'' + o.k + '\')">' + esc(o.label) + '</button>';
        }).join('');
        return '<li class="pol-item' + (received ? ' is-decided' : '') + (here ? ' is-here' : '') + '">' +
            '<div class="pol-head"><span class="chip-status ' + kind.tone + ' chip-sm">' + esc(kind.label) + '</span>' +
            '<span class="pol-menu">' + esc(x.menu) + '</span>' +
            (here ? '<span class="chip-status success chip-sm">이 화면</span>' : '') +
            (received ? '<span class="chip-status success chip-sm">수신 완료</span>' : '') + '</div>' +
            '<p class="pol-q">' + esc(x.title) + '</p><p class="pol-now">' + esc(x.now) + '</p>' +
            '<div class="pol-opts">' + opts + '</div></li>';
    }
    function listHtml() {
        var here = itemsForPage(), ids = here.map(function (x) { return x.id; });
        return here.concat(ITEMS.filter(function (x) { return ids.indexOf(x.id) < 0; })).map(function (x) {
            return itemHtml(x, ids.indexOf(x.id) >= 0);
        }).join('');
    }

    function open() {
        var here = itemsForPage();
        V().openModal('외부 자료·연계 준비 — ' + ITEMS.length + '건',
            '<div class="pol-wrap"><p class="pol-lead">자체 기획 결정은 모두 끝냈습니다. 아래는 <b>담양군 또는 외부 기관이 제공해야 하는 입력</b>이며, 미수신 대체 동작까지 확정돼 개발을 막지 않습니다.</p>' +
            '<div class="pol-sum"><span><b>' + readyCount() + ' / ' + ITEMS.length + '</b> 수신 완료</span>' +
            (here.length ? '<span class="pol-here-note">이 화면 관련 <b>' + here.length + '건</b>이 맨 위에 있습니다</span>' : '') +
            '</div><ol class="pol-list">' + listHtml() + '</ol></div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
            '<button type="button" class="btn btn-outline" onclick="DYPOLICY.confirmReset()">상태 초기화</button>' +
            '<button type="button" class="btn btn-primary" onclick="DYPOLICY.summary()">준비 목록 보기</button>',
            { chrome: true });
    }
    function render() {
        var wrap = document.querySelector('.pol-wrap');
        if (!wrap) return;
        var sc = wrap.closest('.modal-body'), top = sc ? sc.scrollTop : 0;
        var ol = wrap.querySelector('.pol-list');
        if (ol) ol.innerHTML = listHtml();
        var sum = wrap.querySelector('.pol-sum b');
        if (sum) sum.textContent = readyCount() + ' / ' + ITEMS.length;
        if (sc) sc.scrollTop = top;
        syncChip();
    }
    function summaryText() {
        var d = load();
        var lines = ['담양군 중대재해 통합관리 시스템 — 외부 자료·연계 준비 목록',
            (V() ? V().today() : '') + ' · 총 ' + ITEMS.length + '건 · 수신 완료 ' + readyCount() + '건', ''];
        ITEMS.forEach(function (x, i) {
            var dec = d[x.id];
            var opt = dec && x.options.filter(function (o) { return o.k === dec.k; })[0];
            lines.push((i + 1) + '. [' + KIND[x.kind].label + '] ' + x.title + ' (' + x.menu + ')');
            lines.push('   상태: ' + (opt ? opt.label : '미확인'));
            lines.push('   미수신 시: ' + x.now);
        });
        return lines.join('\n');
    }
    function summary() {
        V().openModal('외부 준비 목록 — 전달용',
            '<div class="pol-wrap"><p class="pol-lead">담양군·연계기관에 요청할 자료 목록입니다.</p>' +
            '<textarea class="form-textarea pol-sumtext" rows="18" readonly>' + esc(summaryText()) + '</textarea></div>',
            '<button type="button" class="btn btn-secondary" onclick="DYPOLICY.open()">← 목록으로</button>' +
            '<button type="button" class="btn btn-primary" onclick="DYPOLICY.copy()">복사</button>', { chrome: true });
        setTimeout(function () { var t = document.querySelector('.pol-sumtext'); if (t) { t.focus(); t.select(); } }, 0);
    }
    function copy() {
        var t = document.querySelector('.pol-sumtext');
        if (!t) return;
        t.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) {}
        V().toast(ok ? '준비 목록을 복사했습니다.' : '복사가 막혀 있습니다 — 선택된 텍스트를 직접 복사하세요.');
    }
    function confirmReset() {
        V().openModal('준비 상태 초기화', '<p class="pol-lead">자료 수신 상태만 초기화합니다. 준비 항목과 대체 동작은 유지됩니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYPOLICY.open()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="DYPOLICY.doReset()">초기화</button>', { chrome: true });
    }
    function doReset() { resetAll(); open(); }

    function syncChip() {
        var el = document.getElementById('dy-policy-chip');
        if (!el) return;
        var here = itemsForPage().filter(function (x) { var d = decisionOf(x.id); return !d || d.k !== 'received'; }).length;
        var n = ITEMS.length - readyCount();
        var num = el.querySelector('.dy-policy-n');
        if (num) num.textContent = here ? here : n;
        el.classList.toggle('is-here', here > 0);
        el.setAttribute('title', here ? '이 화면의 미수신 자료·연계 ' + here + '건' : '전체 미수신 자료·연계 ' + n + '건');
    }

    function selfCheck() {
        var L = global.DYLAW && global.DYLAW.MAP;
        if (!L) return;
        var bad = Object.keys(MAP).filter(function (k) { return !(k in L); });
        if (bad.length && global.console) console.warn('[DYPOLICY] 존재하지 않는 화면 매핑: ' + bad.join(', '));
        var ids = ITEMS.map(function (x) { return x.id; }), unknown = [];
        Object.keys(MAP).forEach(function (k) {
            MAP[k].forEach(function (id) { if (ids.indexOf(id) < 0 && unknown.indexOf(id) < 0) unknown.push(id); });
        });
        if (unknown.length && global.console) console.warn('[DYPOLICY] 없는 준비 항목: ' + unknown.join(', '));
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', selfCheck);
    else selfCheck();

    global.DYPOLICY = {
        ITEMS: ITEMS, MAP: MAP, selfCheck: selfCheck, open: open, summary: summary, copy: copy,
        decide: decide, confirmReset: confirmReset, doReset: doReset, itemsForPage: itemsForPage,
        decidedCount: readyCount, syncChip: syncChip, summaryText: summaryText
    };
})(window);
