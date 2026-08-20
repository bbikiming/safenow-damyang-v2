/* =====================================================================
   help-center.js · 화면 도움말 (전역 DYHELP)
   ---------------------------------------------------------------------
   "이 화면에서 무엇을 하는가"를 한 자리에서 답한다. 종전에는 도메인마다
   화면 최상단에 상시 안내 바가 붙어 있었는데, 도움말은 **필요할 때 부르는
   것**이지 매일 보는 것이 아니다(CLAUDE.md §14-12 — 첫 데이터까지의 거리).

   진입점 3층
     ① 헤더 [?] 버튼            — 전 화면 상시 (layout.js 가 렌더)
     ② 첫 방문 배너             — 그 화면 최초 1회, 닫으면 기억
     ③ 화면 제목 줄 [사용법]    — 화면 모듈이 원할 때
   셋 다 이 파일의 open(pageId) 하나로 모인다.

   원칙
   · MAP 에 없는 화면에는 **버튼을 내지 않는다** — 열어 봐야 "준비 중"이라고
     말하는 버튼은 도달할 수 없는 수단이다.
   · 법령은 저장하지 않고 DYLAW.MAP 을 그 자리에서 읽는다 (근거 단일 출처 §10).
   · '자주 하는 일'의 바로가기는 **이미 있는 진입점**만 가리킨다. 도움말 때문에
     새 동작을 만들지 않는다.
   · 단계별 안내(DYTOUR)는 있으면 붙이고 없으면 자리 자체가 없다.

   로드 순서: layout.js → common.js → law-map.js → help-center.js → 화면 모듈
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var L = function () { return global.DYLAW; };
    function esc(s) { return V() ? V().esc(String(s == null ? '' : s)) : String(s == null ? '' : s); }

    var SEEN_KEY = 'dy-help-seen:';

    /* =====================================================================
       MAP — page id → 도움말.  key 는 DYLAW.pageId() 환원값이다
       (menu.html 계열은 ?m= 이 MENU_ALIAS 로 바뀐다 — 파일명이 아니다).
       도움말이 필요 없는 화면은 [] 로 명시한다 — selfCheck 가 오타를 잡는다.
       ===================================================================== */
    var MAP = {
        'index': {
            lead: '내 권한에서 지금 무엇이 밀려 있는지 한눈에 봅니다. 카드를 누르면 그 업무 화면으로 바로 갑니다.',
            tasks: [
                { t: '내가 할 일 확인하기', go: 'my-work.html' },
                { t: '부서별 이행 현황 보기', go: 'menu.html?m=comply' }
            ]
        },
        'my-work': {
            lead: '여러 업무에서 나에게 온 할 일이 한 곳에 모입니다. 처리 방식에 따라 이 화면에서 바로 끝내거나 담당 화면으로 이동합니다.',
            tasks: [{ t: '위험성평가 개선조치 처리', go: 'rsk-imp.html' }],
            tour: ['RSKTOUR', 'OCCTOUR']
        },
        'rsk-list': {
            lead: '연 1회 정기 위험성평가를 주관부서가 열고, 부서가 조사·보고서를 제출하면 확인해 공문으로 마무리합니다.',
            tasks: [
                { t: '올해 평가 생성하기', go: "RSKLIST && RSKLIST.openWizard && RSKLIST.openWizard()" },
                { t: '부서별 제출 현황 보기', go: 'rsk-imp.html' }
            ],
            tour: 'RSKTOUR', reset: 'RSKLIST'
        },
        'rsk-occ': {
            lead: '사고·설비 변경처럼 사유가 생겼을 때 부서가 올리는 수시 평가입니다. 주관부서가 안전관리자 검토를 붙입니다.',
            tasks: [{ t: '수시평가 등록하기', go: "RSKOCC && RSKOCC.openRegister && RSKOCC.openRegister()" }],
            tour: 'OCCTOUR', reset: 'RSKOCC'
        },
        'rsk-imp': {
            lead: '평가에서 나온 개선조치를 부서가 처리하고 주관부서가 완료를 확인합니다. 반려되면 사유와 함께 다시 올라옵니다.',
            tasks: []
        },
        'edu-reg': {
            lead: '현업근로자 정기교육을 등록하고 부서 신청을 받아 이수 결과를 기록합니다. 종료 처리한 교육은 실시 결과 공문을 기안할 수 있습니다.',
            tasks: [
                { t: '교육 등록하기', go: "EDUR && EDUR.openCreate && EDUR.openCreate()" },
                { t: '이수 현황 보기', go: 'edu-status.html' }
            ],
            tour: 'EDUTOUR', reset: 'EDUTOUR'
        },
        'edu-status': {
            lead: '부서별·개인별 이수 상태를 봅니다. 완료율이 낮은 부서를 눌러 미이수자 명단으로 바로 들어갑니다.',
            tasks: [{ t: '미달 부서만 보기', go: 'edu-status.html?short=1' }],
            tour: 'EDUTOUR'
        },
        'edu-workers': {
            lead: '교육 대상 근로자 명단을 관리합니다. 이 명단이 이수율의 분모가 됩니다.',
            tasks: [], tour: 'EDUTOUR'
        },
        'edu-hire': { lead: '채용 시 교육 대상자와 이수 상태를 봅니다. 기준일은 채용일과 지정일 중 늦은 쪽입니다.', tasks: [], tour: 'EDUTOUR' },
        'edu-etc':  { lead: '작업내용 변경 시·특별교육 등 그 밖의 법정 교육을 기록합니다.', tasks: [], tour: 'EDUTOUR' },
        'edu-approval': { lead: '교육 실시 결과 공문을 온나라로 올린 이력을 봅니다. 조회 전용입니다.', tasks: [], tour: 'EDUTOUR' },
        'docs-preset': {
            lead: '우리 부서가 주고받은 문서를 조건으로 좁혀 찾습니다. 어떤 의무의 증빙인지도 함께 봅니다.',
            tasks: [
                { t: '업무 올리기', go: "DOCUP && DOCUP.open && DOCUP.open()" },
                { t: '의무별로 보기', go: 'docs-exec.html' }
            ],
            tour: 'DOCTOUR'
        },
        'docs-exec': {
            lead: '법으로 해야 하는 일 하나하나에 증빙이 갖춰졌는지 봅니다. 비어 있는 칸이 곧 해야 할 일입니다.',
            tasks: [{ t: '문서로 찾기', go: 'docs-preset.html' }],
            tour: 'DOCTOUR'
        },
        'work-admin': {
            lead: '주기가 있는 업무는 시스템이 스스로 발행합니다. 대상 부서를 보정하고 회수율을 봅니다.',
            tasks: [], reset: 'WKADM'
        },
        'work-dept': { lead: '우리 부서로 발행된 업무를 담당자에게 배정하고 처리 상태를 봅니다.', tasks: [] },
        'sbm-comply': { lead: '반기마다 부서별 의무 이행 여부를 증빙과 함께 점검합니다.', tasks: [] },
        'sbm-policy': { lead: '안전보건 경영방침을 등록하고 부서별 게시 여부를 확인합니다.', tasks: [] },
        'admin-law': { lead: '화면에 붙는 법령 근거를 관리합니다. 조문 원문은 법제처 수집 결과이므로 이 화면에서 고치지 않습니다.', tasks: [] },
        'admin-integration': { lead: '외부 시스템 연계 상태와, 아직 받지 못한 자료·규격을 봅니다.', tasks: [] }
    };

    /* ── 현재 화면 ── */
    function pid() { return (L() && L().pageId) ? L().pageId() : (document.body.getAttribute('data-dy-page') || 'index'); }
    function entry(id) { var e = MAP[id || pid()]; return (e && e.lead) ? e : null; }
    function has(id) { return !!entry(id); }

    /* ── 투어 파사드 — 이름으로 찾는다(로드 안 된 화면도 있다) ── */
    function tourOf(e) {
        var names = !e.tour ? [] : (typeof e.tour === 'string' ? [e.tour] : e.tour);
        for (var i = 0; i < names.length; i++) { if (global[names[i]]) return { ns: names[i], api: global[names[i]] }; }
        return null;
    }
    /* 되돌리기 진입 — 모듈마다 이름이 다르다(resetDemo 가 확인 모달, WKADM 은 confirmReset).
       둘 다 없으면 자리 자체를 만들지 않는다. 권한 가드는 그 함수 안에 있다. */
    function resetOf(e) {
        var m = e.reset && global[e.reset]; if (!m) return '';
        if (typeof m.resetDemo === 'function') return e.reset + '.resetDemo()';
        if (typeof m.confirmReset === 'function') return e.reset + '.confirmReset()';
        return '';
    }

    /* ── 시트 ── */
    function open(id) {
        id = id || pid();
        var e = entry(id); if (!e || !V() || !V().openModal) return;
        var t = tourOf(e), rs = resetOf(e);
        var title = document.body.getAttribute('data-page-title') || document.title.split(' - ')[0];

        var tasks = (e.tasks || []).length
            ? '<h4 class="dy-help-h">자주 하는 일</h4><ul class="dy-help-tasks">' +
              e.tasks.map(function (x) {
                  var act = /^[a-z0-9-]+\.html/i.test(x.go)
                      ? "location.href='" + x.go + "'"
                      : x.go;
                  return '<li><span>' + esc(x.t) + '</span>' +
                      '<button type="button" class="btn btn-sm btn-outline" onclick="DYV2.closeModal(); ' +
                      esc(act).replace(/&#39;/g, "'") + ';">바로가기 →</button></li>';
              }).join('') + '</ul>'
            : '';

        var laws = '';
        if (L() && L().forPage) {
            var arts = L().forPage(id) || [];
            if (arts.length) {
                laws = '<h4 class="dy-help-h">관련 법령</h4><div class="dy-help-laws">' +
                    arts.map(function (a) { return '<span class="chip-mini wt">' + esc(L().shortRef(a.key)) + '</span>'; }).join(' ') +
                    '</div>';
            }
        }

        var reset = rs
            ? '<details class="dy-help-reset"><summary>예시 데이터 되돌리기</summary>' +
              '<p>이 화면의 예시 자료를 처음 상태로 되돌립니다. 실제 등록 자료가 있는 환경에서는 노출되지 않습니다.</p>' +
              '<button type="button" class="btn btn-sm btn-secondary" onclick="DYV2.closeModal(); ' + rs + ';">되돌리기</button>' +
              '</details>'
            : '';

        var foot = '';
        if (t) {
            var read = t.api.view && t.api.view() === 'read';
            foot = '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal(); ' + t.ns + '.start();">' +
                (read ? '흐름 따라보기 →' : '단계별 안내 시작 →') + '</button>';
        }
        foot += '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>';

        V().openModal('도움말 — ' + esc(title),
            '<div class="dy-help-sheet">' +
                '<h4 class="dy-help-h">이 화면에서 하는 일</h4><p class="dy-help-lead">' + e.lead + '</p>' +
                tasks + laws + reset +
            '</div>', foot, { chrome: true });
        markSeen(id);
    }

    /* ── ② 첫 방문 배너 ── */
    function seen(id) { try { return localStorage.getItem(SEEN_KEY + id) === '1'; } catch (x) { return true; } }
    function markSeen(id) { try { localStorage.setItem(SEEN_KEY + (id || pid()), '1'); } catch (x) {} }
    function dismiss() {
        markSeen();
        var el = document.getElementById('dy-help-banner');
        if (el && el.parentNode) el.parentNode.removeChild(el);
    }
    /* 화면 모듈이 render 뒤에 부른다. 두 번 불러도 안전하다(idempotent). */
    function banner(text) {
        var id = pid(); if (!has(id) || seen(id)) return;
        if (document.getElementById('dy-help-banner')) return;
        var main = document.querySelector('main'); if (!main) return;
        var b = document.createElement('div');
        b.className = 'dy-demo-bar';           /* 기존 계열 재사용 (§7 계열 신설 금지) */
        b.id = 'dy-help-banner';
        b.innerHTML =
            '<div class="dy-demo-copy"><strong>처음이신가요?</strong>' +
            '<span>' + (text || esc(MAP[id].lead)) + '</span></div>' +
            '<div class="dy-demo-actions">' +
                '<button class="btn btn-primary" type="button" onclick="DYHELP.open()">사용법 보기</button>' +
                '<button class="btn btn-outline" type="button" onclick="DYHELP.dismiss()">닫기</button>' +
            '</div>';
        main.insertBefore(b, main.firstChild);
    }

    /* ── ③ 제목 줄 링크 마크업 ── */
    function link() { return has() ? '<button type="button" class="btn btn-sm btn-outline" onclick="DYHELP.open()">사용법</button>' : ''; }

    /* ── 매핑 오타 검사 — 증상이 "그 화면에서만 조용히 없음"이라 사람이 못 잡는다 ── */
    function selfCheck() {
        var lm = L() && L().MAP; if (!lm || !global.console) return;
        var bad = Object.keys(MAP).filter(function (k) { return !(k in lm); });
        if (bad.length) console.warn('[DYHELP] 존재하지 않는 화면 매핑: ' + bad.join(', '));
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', selfCheck);
    else selfCheck();

    global.DYHELP = { MAP: MAP, open: open, has: has, banner: banner, dismiss: dismiss, link: link,
        pageId: pid, seen: seen, markSeen: markSeen, selfCheck: selfCheck };
})(window);
