/* =====================================================================
   tour-core.js · 시연 투어 공용 엔진 (전역 DYTOUR)

   위험성평가 정기(RSKTOUR)·수시(OCCTOUR) 두 투어가 같은 엔진을 쓴다.
   화면·단계만 다르고 동작은 같으므로 엔진을 두 번 쓰지 않는다.

   제공하는 것
     ① 전체 흐름 보드 — 단계별 완료 여부를 **실제 데이터로 판정**해 보여준다.
        진행 상태를 저장하지 않으므로 껐다 켜도·손으로 먼저 처리해도 체크가 맞는다.
     ② 단계별 가이드 — 지금 화면에서 무엇을 어디서 누르는지 말하고, 그 버튼을
        강조하고, 없으면 왜 없는지까지 밝힌다. 요구 페르소나가 다르면 전환한다.

   DYTOUR.define(cfg) → 인스턴스. cfg:
     ns        전역 이름 문자열 ('RSKTOUR') — 인라인 onclick 이 부를 이름
     skey      sessionStorage 커서 키
     steps     STEPS[] (아래 스키마)
     barTitle(), barDesc()      진입 바 문구 (함수)
     flowTitle(), flowNote()    흐름 보드 제목·꼬리말 (함수)
     kicker()                   패널 상단 한 줄 (함수)

   STEPS[] 스키마
     key, label, title
     page          'rsk-list.html'  — 이 화면에서만 액션 버튼이 뜬다
     href()        이동 URL
     persona()     요구 페르소나 id ('staff'|'wat'|'envst')
     scopeDept()   조회 범위 판정용 deptId (선택)
     selector      '[data-tour="..."]'
     where         "어디를 누르는지" 한 문장 (HTML 허용)
     clickPath[]   클릭 순서 문장 배열
     desc, script  설명 · 발표자 멘트
     actionLabel, action()
     done()        ★ 완료 판정 — 반드시 실데이터 파생
     note()        그 단계의 실수치 문구
     modalGuide?   모달 안 인라인 안내
     modalAction?  { label, fn } 모달 안 도우미 버튼

   CSS 는 교육 투어(EDUTOUR)와 공유한다 — css/v2.css 의 .dy-tour-* / .dy-demo-*
   는 .edu-tour-* / .edu-demo-* 규칙에 병기된 중립 이름이다 (CLAUDE.md §7).
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var R = function () { return global.DYROLE; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }

    var ROLE_KEY = 'dy-role-sim-v1';          /* js/layout.js ROLE_KEY 와 같은 값 */

    /* 받침에 맞는 조사만 돌려준다 — '주무관로'/'소장로' 같은 오식을 막는다 */
    /* 조사 — 공용 DYV2.josa 로 수렴(2026-08-12). 같은 함수를 두 모듈이 각자 갖고
       있어 한쪽만 고치면 어긋난다. DYV2 부재 시에만 자체 계산으로 떨어진다. */
    function josa(word, withJong, withoutJong) {
        var V0 = global.DYV2 || window.DYV2;
        if (V0 && V0.josa) return V0.josa(word, withJong, withoutJong);
        var t = String(word == null ? '' : word).trim(); if (!t) return withJong;
        var c = t.charCodeAt(t.length - 1);
        return ((c >= 0xac00 && c <= 0xd7a3) ? ((c - 0xac00) % 28) > 0 : false) ? withJong : withoutJong;
    }
    function personaOf(id) {
        var list = (R() && R().PERSONAS) || [];
        for (var i = 0; i < list.length; i++) { if (list[i].id === id) return list[i]; }
        return null;
    }
    function personaLabel(id) { var p = personaOf(id); return p ? (p.name + ' ' + p.role) : String(id || ''); }
    function curPersonaId() { var p = R() && R().current ? R().current() : null; return p ? p.id : ''; }
    function pageFile() { return (location.pathname.split('/').pop() || 'index.html'); }

    /* 등록된 투어들 — my-work 처럼 두 투어가 함께 로드되는 화면에서
       패널이 겹치지 않도록 한 번에 하나만 켜지게 한다. */
    var REG = [];
    function stopOthers(self) {
        REG.forEach(function (t) { if (t !== self && t.active()) t.stop(); });
    }

    function define(cfg) {
        var NS = cfg.ns;
        var SKEY = cfg.skey;
        var STEPS = cfg.steps;
        var PANEL_ID = 'dytour-panel-' + cfg.key;
        var BAR_ID = 'dytour-bar-' + cfg.key;
        var WHY_ID = 'dytour-why-' + cfg.key;
        var TITLE_ID = 'dytour-title-' + cfg.key;
        var DESC_ID = 'dytour-desc-' + cfg.key;

        /* ── 상태 (커서만 저장한다 — 완료 여부는 저장하지 않는다) ── */
        function stateIdx() {
            try {
                var raw = sessionStorage.getItem(SKEY);
                if (raw == null) return -1;
                var i = parseInt(raw, 10);
                return (i >= 0 && i < STEPS.length) ? i : -1;
            } catch (e) { return -1; }
        }
        function setIdx(i) { try { sessionStorage.setItem(SKEY, String(i)); } catch (e) {} }
        function clearIdx() { try { sessionStorage.removeItem(SKEY); } catch (e) {} }
        function active() { return stateIdx() >= 0; }
        function onStepPage(s) { return pageFile() === s.page; }
        function safeCall(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }
        /* s 가 없을 수 있다 — 커서가 범위를 벗어난 상태(다른 탭에서 초기화했거나
           옛 세션 값)에서 STEPS[i] 가 undefined 로 들어온다. */
        function safeDone(s) { return !!(s && safeCall(s.done, false)); }
        /* note() 는 그 단계의 실수치를 보여준다. 다만 **조회 범위 밖(§12) 데이터는
           내보내지 않는다** — 화면에서는 안 보이는 남의 부서 건을 패널이 문서번호까지
           읊으면 그게 곧 범위 위반이다. (실제로 공공시설사업소장에게 환경과
           OCC-2026-02 내용이 노출됐다.) */
        function safeNote(s) {
            if (!s.note) return '';
            if (s.scopeDept && R() && R().inScope) {
                var d = safeCall(s.scopeDept, '');
                if (d && !R().inScope(d)) return '조회 범위 밖 부서입니다';
            }
            return String(safeCall(s.note, '') || '');
        }
        function personaId(s) { return safeCall(s.persona, '') || ''; }
        function doneCount() { var n = 0; STEPS.forEach(function (s) { if (safeDone(s)) n++; }); return n; }

        /* =================== 관점(뷰) ===================
           "각 권한으로 접속했을 때 그 권한의 흐름만" — 단계마다 persona() 가 이미
           선언돼 있으므로 그 축으로 거른다.
             all   전체 흐름 — 발표자 1인이 양쪽을 운전한다(페르소나 자동 전환)
             mine  내 역할  — 내 단계만 커서가 머문다. 남의 단계는 **지우지 않고**
                             흐린 칩으로 남긴다 — 지우면 전체 그림과 '내가 왜
                             기다리는지'를 잃는다.
             read  조회 전용 — 조작 권한이 없는 계층(군수·과장·소장)
           기본값은 로그인 페르소나에서 정하고, 패널에서 바꿀 수 있다. */
        var VKEY = SKEY + ':view';
        function personaSet() {
            var m = {}; STEPS.forEach(function (s) { var p = personaId(s); if (p) m[p] = 1; });
            return Object.keys(m);
        }
        /* 주체가 하나뿐인 투어(교육)는 '내 역할'이 전체와 같아 토글이 의미 없다 */
        function multiPersona() { return personaSet().length > 1; }
        function defaultView() {
            var p = R() && R().current ? R().current() : null;
            if (!p) return 'all';
            if (p.tier !== 'staff') return 'read';           /* 조작 권한이 없는 계층 */
            /* 이 투어를 운전하는 주관부서 담당자면 전체 흐름이 기본 — 발표자 자리다 */
            if (p.id === cfg.ownerPersona) return 'all';
            if (personaSet().indexOf(p.id) >= 0) return 'mine';
            return 'read';                                   /* 이 흐름에 등장하지 않는 담당자 */
        }
        function viewMode() {
            /* 조작 권한이 없는 계층에게는 저장된 관점이 무의미하다 — 'all'·'mine' 은
               직접 수행하는 사람의 관점이기 때문이다. 저장값을 그대로 두면
               발표자가 전체 흐름을 돌린 뒤(go() 가 VKEY='all' 을 고정) 권한 전환을
               보여줄 때 **군수·과장 화면에 "박안전 관점으로 전환" 버튼이 뜬다** —
               조회 전용이라고 해 놓고 전환을 권하는 모순이다(§4-3). */
            var cp = R() && R().current ? R().current() : null;
            if (cp && cp.tier !== 'staff') return 'read';
            var v = null;
            try { v = sessionStorage.getItem(VKEY); } catch (e) {}
            if (v === 'all' || v === 'mine' || v === 'read') {
                /* 주체가 하나뿐이면 mine 은 all 과 같다 — 굳이 다르게 두지 않는다 */
                if (v === 'mine' && !multiPersona()) return 'all';
                return v;
            }
            return defaultView();
        }
        function setView(v) {
            try { sessionStorage.setItem(VKEY, v); } catch (e) {}
            var order = stepOrder();
            /* 관점을 바꾸면 커서가 그 관점 밖일 수 있다 — 가장 가까운 단계로 당긴다 */
            if (active() && order.indexOf(stateIdx()) < 0) {
                setIdx(order.length ? order[0] : 0);
            }
            renderStep();
        }
        function isMine(s) { return personaId(s) === curPersonaId(); }
        /* 커서가 돌아다닐 수 있는 단계 인덱스 — 'mine' 에서는 내 단계만 */
        function stepOrder() {
            var all = STEPS.map(function (_, i) { return i; });
            if (viewMode() !== 'mine') return all;
            var mine = all.filter(function (i) { return isMine(STEPS[i]); });
            return mine.length ? mine : all;
        }
        /* 지금 해야 할 단계 — 관점 안에서 처음으로 안 끝난 것 */
        function currentIdx() {
            var order = stepOrder();
            for (var k = 0; k < order.length; k++) { if (!safeDone(STEPS[order[k]])) return order[k]; }
            return STEPS.length;
        }
        /* 이 단계를 막고 있는 앞 단계들 (관점 무관 — 실제 선행이다) */
        function blockedBy(i) {
            var out = [];
            for (var j = 0; j < i; j++) { if (!safeDone(STEPS[j])) out.push(j); }
            return out;
        }

        /* 전환이 필요하면 localStorage 만 바꾸고 true 를 돌려준다 — 이동은 호출자가 한다.
           DYROLE.set() 을 쓰지 않는 이유: 그쪽은 자체 reload/index 이동으로
           투어가 가려는 화면을 덮어쓴다. */
        function applyPersona(s) {
            var want = personaId(s);
            if (!want || curPersonaId() === want) return false;
            try { localStorage.setItem(ROLE_KEY, want); } catch (e) {}
            return true;
        }

        /* ── 대상 요소가 없을 때 왜 없는지 ──
           아무 데도 안 가리키는 투어는 안내가 아니라 소음이다. */
        function whyMissing(s, i) {
            /* **아직 만들지 않은 단계**는 관점·선행 탓으로 돌리지 않는다 — 관점을 바꿔도,
               앞 단계를 끝내도 그 버튼은 나타나지 않는다. 그렇게 안내하면 시연자가
               없는 것을 찾아 헤맨다. 흐름에 단계를 두는 것과 그 화면이 있는 것은 다르다. */
            if (s.planned) return '이 단계는 기획만 끝났고 화면은 아직 없습니다 — 흐름에서 어디에 오는지만 보여 줍니다.';
            var want = personaId(s);
            if (curPersonaId() !== want) {
                var wl = personaLabel(want);
                return '지금 관점(' + personaLabel(curPersonaId()) + ')에는 이 버튼이 없습니다 — ' +
                    wl + josa(wl, '으로', '로') + ' 바꾸세요.';
            }
            if (safeDone(s)) return '이미 끝난 단계라 그 버튼은 화면에서 사라졌습니다.';
            /* **사용자에게 파일명을 보여주지 않는다** — pageLabel() 로 사람이 읽는 이름을 낸다
               (같은 파일의 toast 는 이미 그렇게 하고 있었다). */
            if (!onStepPage(s)) return '이 단계는 ' + pageLabel(s.page) + ' 화면에 있습니다.';
            if (s.scopeDept && R() && R().inScope && !R().inScope(safeCall(s.scopeDept, ''))) {
                return '조회 범위 밖 부서라 화면에 표시되지 않습니다.';
            }
            if (i > 0 && !safeDone(STEPS[i - 1])) return '앞 단계 「' + STEPS[i - 1].title + '」가 끝나야 나타납니다.';
            return '화면을 다시 그리는 중이거나, 이 화면에 아직 없는 요소입니다.';
        }

        /* idempotent — 몇 번 불려도 결과가 같다. DOM 참조를 보관하지 않고 매번 새로 조회한다.
           화면 모듈이 innerHTML 을 통째로 갈아끼우므로 참조를 들면 반드시 끊긴다. */
        function applyFocus() {
            document.querySelectorAll('.dy-tour-focus').forEach(function (el) {
                el.classList.remove('dy-tour-focus');
                if (el.getAttribute('aria-describedby') === DESC_ID) el.removeAttribute('aria-describedby');
            });
            var why = document.getElementById(WHY_ID);
            var idx = stateIdx();
            var s = STEPS[idx];
            if (!s || document.getElementById('v2-modal')) return;
            var el = (onStepPage(s) && curPersonaId() === personaId(s)) ? document.querySelector(s.selector) : null;
            if (!el) {
                /* 조회 전용·대기 상태에서는 '왜 버튼이 없나'를 띄우지 않는다 —
                   조회하라고 해 놓고 "관점을 바꾸세요"라고 하면 모순이다.
                   그 상황의 설명은 이미 액션 자리(.dy-tour-wait)가 하고 있다. */
                var vm = viewMode();
                /* 미구현 단계의 안내는 **관점과 무관한 사실**이라 조회 뷰에서도 낸다 —
                   여기서 숨기면 "왜 아무 일도 안 일어나지"만 남는다. */
                var quiet = !s.planned && (vm === 'read' || (vm === 'mine' && blockedBy(idx).length > 0));
                if (why) { why.hidden = quiet; if (!quiet) why.innerHTML = '⚠ ' + esc(whyMissing(s, idx)); }
                return;
            }
            if (why) why.hidden = true;
            el.classList.add('dy-tour-focus');
            el.setAttribute('aria-describedby', DESC_ID);
        }
        function scrollToTarget() {
            var s = STEPS[stateIdx()]; if (!s) return;
            var el = document.querySelector(s.selector); if (!el) return;
            var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
        }

        /* ── 패널 ── */
        function removePanel() { var o = document.getElementById(PANEL_ID); if (o) o.remove(); }

        function renderStep() {
            lastSig = doneSig();   /* 첫 렌더가 곧바로 자동 진행을 부르지 않도록 기준을 맞춘다 */
            removePanel();
            var idx = stateIdx();
            var s = STEPS[idx];
            if (!s) return;
            var want = personaId(s);
            var wrongWho = curPersonaId() !== want;
            var onPage = onStepPage(s);
            var done = safeDone(s);

            var panel = document.createElement('aside');
            panel.id = PANEL_ID;
            panel.className = 'dy-tour-panel';
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-modal', 'false');   /* 모달이 아니다 — §1 위반이 아니다 */
            panel.setAttribute('aria-labelledby', TITLE_ID);
            panel.setAttribute('aria-describedby', DESC_ID);
            /* 대상이 오른쪽에 있으면 패널을 왼쪽으로 — 폭 기준은 §8 표준(md) */
            var t = onPage ? document.querySelector(s.selector) : null;
            if (t && !V().below('md')) {
                var r = t.getBoundingClientRect();
                if (r.left + r.width / 2 > window.innerWidth / 2) panel.classList.add('is-left');
            }

            var view = viewMode();
            var order = stepOrder();
            var pos = order.indexOf(idx);                    /* 관점 안에서의 위치 */
            var last = pos === order.length - 1;
            var blocks = blockedBy(idx);
            /* '내 역할' 뷰에서 선행이 안 끝났으면 **아직 내 차례가 아니다**.
               실제 업무 감각이 그렇다 — 부서는 주관부서가 내려보낼 때까지 기다린다. */
            var waiting = view === 'mine' && !done && blocks.length > 0;
            var readOnly = view === 'read';

            var actionBtn;
            if (readOnly) {
                actionBtn = '<div class="dy-tour-wait">' + esc(personaLabel(curPersonaId())) +
                    ' 관점은 <b>조회 전용</b>입니다 — 이 흐름은 담당자가 수행합니다.</div>';
            } else if (waiting) {
                actionBtn = '<div class="dy-tour-wait"><b>아직 내 차례가 아닙니다.</b><br>' +
                    blocks.map(function (j) {
                        return '⏳ ' + (j + 1) + '. ' + esc(STEPS[j].title) + ' <em>(' + esc(personaLabel(personaId(STEPS[j]))) + ')</em>';
                    }).join('<br>') +
                    '<br>끝나면 <b>내 할일</b>에 뜹니다.</div>' +
                    '<button class="btn btn-secondary dy-tour-action" type="button" onclick="' + NS + '.openFlow()">진행 상황 보기</button>';
            } else if (wrongWho) {
                actionBtn = '<button class="btn btn-primary dy-tour-action" type="button" onclick="' + NS + '.go(' + idx + ')">' +
                    esc(personaLabel(want)) + ' 관점으로 전환 →</button>';
            } else if (!onPage) {
                actionBtn = '<button class="btn btn-primary dy-tour-action" type="button" onclick="' + NS + '.go(' + idx + ')">이 단계 화면으로 이동 →</button>';
            } else if (s.planned || !s.actionLabel) {
                /* 누를 것이 없는데 버튼을 내면 그게 거짓말이다(§ 도달 가능한 행동만 약속한다) */
                actionBtn = '';
            } else {
                actionBtn = '<button class="btn btn-primary dy-tour-action" type="button" onclick="' + NS + '.action()">' +
                    esc(s.actionLabel) + '</button>';
            }

            /* 관점 토글 — 주체가 둘 이상인 투어에서만 의미가 있다 */
            var viewSwitch = multiPersona()
                ? '<div class="dy-tour-view" role="group" aria-label="시연 관점">' +
                    ['mine', 'all'].map(function (v) {
                        return '<button type="button" class="dy-tour-viewbtn' + (view === v ? ' on' : '') + '"' +
                            (view === v ? ' aria-pressed="true"' : ' aria-pressed="false"') +
                            ' onclick="' + NS + '.setView(\'' + v + '\')">' +
                            (v === 'mine' ? '내 역할' : '전체 흐름') + '</button>';
                    }).join('') +
                    (view === 'read' ? '<span class="dy-tour-viewnote">조회 전용</span>' : '') +
                  '</div>'
                : '';

            /* 진행 표기 — '내 역할' 에서는 내 단계 기준으로 센다 */
            var myDone = order.filter(function (i) { return safeDone(STEPS[i]); }).length;
            var scopeLabel = view === 'mine' ? '내 역할' : (view === 'read' ? '조회' : '전체');

            panel.innerHTML =
                '<div class="dy-tour-head"><div class="dy-tour-head-main">' +
                    '<div class="dy-tour-kicker">' + esc(safeCall(cfg.kicker, '') || '') + ' · ' + esc(scopeLabel) + ' ' +
                        myDone + ' / ' + order.length + '단계' + (done ? ' · <b>이 단계 완료</b>' : '') + '</div>' +
                    '<div class="dy-tour-title" id="' + TITLE_ID + '" tabindex="-1">' + (idx + 1) + '. ' + esc(s.title) + '</div></div>' +
                    '<button class="dy-tour-close" type="button" onclick="' + NS + '.stop()">가이드 종료</button></div>' +
                viewSwitch +
                /* 남의 단계도 **지우지 않고** 흐린 칩으로 남긴다 — 지우면 전체 그림과
                   '내가 왜 기다리는지'를 잃는다. 다만 커서는 옮기지 않는다. */
                '<div class="dy-tour-steps' + (cfg.stepsClass ? ' ' + cfg.stepsClass : '') + '" aria-label="시연 단계">' + STEPS.map(function (x, i) {
                    var out = order.indexOf(i) < 0;
                    return '<button type="button" class="dy-tour-step' + (safeDone(x) ? ' done' : '') +
                        (i === idx ? ' active' : '') + (out ? ' other' : '') + (x.planned ? ' planned' : '') + '"' +
                        (out ? ' disabled' : '') + (i === idx ? ' aria-current="step"' : '') +
                        ' title="' + esc((i + 1) + '. ' + x.title + (x.planned ? ' — 기획 완료 · 화면 미구현' : (out ? ' — ' + personaLabel(personaId(x)) + ' 몫' : ''))) + '"' +
                        (out ? '' : ' onclick="' + NS + '.go(' + i + ')"') + '>' + esc(x.label) + '</button>';
                }).join('') + '</div>' +
                '<div class="dy-tour-who' + (wrongWho && !readOnly && !waiting ? ' is-warn' : '') + '">' +
                    (readOnly
                        ? '<b>' + esc(personaLabel(want)) + '</b>' + josa(personaLabel(want), '이', '가') + ' 수행하는 단계입니다 · ' + esc(safeNote(s))
                        : wrongWho
                            ? '지금은 <b>' + esc(personaLabel(want)) + '</b> 차례입니다 — 아래 버튼을 누르면 관점을 바꿔 이어서 진행합니다.'
                            : '<b>' + esc(personaLabel(want)) + '</b> 관점 · ' + esc(safeNote(s))) + '</div>' +
                (waiting || readOnly ? '' : '<div class="dy-tour-where">여기를 누르세요 — ' + s.where + '</div>') +
                (waiting ? '' : '<ol class="dy-tour-path">' + (s.clickPath || []).map(function (c) {
                    return '<li>' + esc(c) + '</li>';
                }).join('') + '</ol>') +
                '<div class="dy-tour-desc" id="' + DESC_ID + '">' + esc(s.desc) + '</div>' +
                '<div class="dy-tour-why" id="' + WHY_ID + '" hidden></div>' +
                '<div class="dy-tour-script"><b>시연 멘트</b>' + esc(s.script) + '</div>' +
                actionBtn +
                '<div class="dy-tour-foot"><span class="dy-tour-progress">' + (pos + 1) + ' / ' + order.length + '</span>' +
                    '<button class="btn btn-secondary btn-sm" type="button" onclick="' + NS + '.openFlow()">전체 흐름</button>' +
                    (pos > 0 ? '<button class="btn btn-secondary btn-sm" type="button" onclick="' + NS + '.prev()">이전</button>' : '') +
                    '<button class="btn btn-secondary btn-sm" type="button" onclick="' +
                        (last ? NS + '.stop()' : NS + '.next()') + '">' +
                        (last ? '마치기' : '다음') + '</button></div>';
            document.body.appendChild(panel);
            applyFocus();
            scrollToTarget();
            syncModalState();
            setTimeout(function () {
                var el = document.getElementById(TITLE_ID);
                if (el && !document.getElementById('v2-modal')) el.focus({ preventScroll: true });
            }, 0);
        }

        /* 모달이 뜨면 패널을 숨기고, 모달 본문 맨 위에 그 단계의 시연 포인트를 넣는다 (§1)

           헤더 드롭다운(알림·권한 전환)도 같이 본다 — 패널은 --z-fab(90),
           드롭다운은 --z-nav+2(32) 라 패널이 위에 있고, 실제로 알림 목록의
           오른쪽을 가렸다. 레이어를 뒤집는 대신 **셸 크롬이 뜨면 투어 패널이
           접힌다**는 모달과 같은 규칙으로 맞춘다. */
        function chromeOpen() {
            return !!document.querySelector('.dy-ntf-dropdown.is-open, .dy-role-dropdown.is-open');
        }
        function syncModalState() {
            var panel = document.getElementById(PANEL_ID);
            var modal = document.getElementById('v2-modal');
            var hide = !!modal || chromeOpen();
            if (panel) {
                panel.hidden = hide;
                if (hide) panel.setAttribute('aria-hidden', 'true'); else panel.removeAttribute('aria-hidden');
            }
            if (modal && active()) {
                var s = STEPS[stateIdx()];
                var body = modal.querySelector('.modal-body');
                /* 셸 크롬 모달(자료 준비·검토 전 안내)은 업무 흐름이 아니다 —
                   투어가 떠 있다고 해서 '파일을 제출하세요' 같은 단계 안내를 얹으면
                   전혀 다른 맥락의 지시가 된다. openModal(..., {chrome:true}) 로 표시한다. */
                if (modal.classList.contains('dy-modal-chrome')) return;
                /* 흐름 보드 자신에게는 넣지 않는다 — 보드는 전체 지도이지 특정 단계의
                   작업 모달이 아니다. 넣으면 엉뚱한 단계의 안내가 보드 위에 뜬다. */
                if (body && body.querySelector('.dy-tour-flow')) return;
                if (s && s.modalGuide && body && !body.querySelector('.dy-tour-inline')) {
                    var g = document.createElement('div');
                    g.className = 'dy-tour-inline';
                    g.innerHTML = '<b>시연 포인트</b>' + s.modalGuide +
                        /* modalAction.when — 그 필드가 있는 모달에서만 버튼을 낸다.
                           한 단계가 모달을 두 번 여는 흐름(카드 → 완료 처리)에서, 대상 행이
                           정해지기 전 모달에 시연 버튼을 내면 어느 건에 넣는지 알 수 없다. */
                        (s.modalAction && (!s.modalAction.when || body.querySelector(s.modalAction.when))
                            ? '<button type="button" class="btn btn-outline btn-sm dy-tour-inline-act" onclick="' +
                              s.modalAction.fn + '">' + esc(s.modalAction.label) + '</button>'
                            : '');
                    body.insertBefore(g, body.firstChild);
                }
            }
        }

        /* 재렌더·자동 진행 대응 —
           화면 모듈이 `onEvent()` 훅을 부르는 방식(EDUTOUR)은 저장 경로가 화면마다
           갈려 있어 반드시 새는 곳이 생긴다. 그래서 **완료 판정 자체의 변화**를
           감지한다 — 어느 경로로 저장했든, 가이드를 끄고 손으로 처리해도 잡힌다.

           childList+subtree 만 보고 attributes 는 안 보므로 classList.add 가 관찰자를
           다시 깨우지 않는다. renderStep() 이 패널을 append 하면 한 번 더 돌지만
           그때는 signature 가 같아 applyFocus() 만 하고 끝난다 — 무한 루프 불가. */
        function doneSig() { return STEPS.map(function (s) { return safeDone(s) ? '1' : '0'; }).join(''); }
        var lastSig = '';
        var raf = 0;
        new MutationObserver(function () {
            if (!active() || raf) return;
            raf = requestAnimationFrame(function () {
                raf = 0;
                syncModalState();
                var sg = doneSig();
                if (sg === lastSig) { applyFocus(); return; }
                lastSig = sg;
                var i = stateIdx();
                var ord = stepOrder(), ps = ord.indexOf(i);
                /* 모달이 떠 있으면 사용자가 아직 입력 중이다 — 밀지 않는다 */
                /* STEPS[i] 가 없을 수 있다 — 커서가 범위를 벗어난 상태(다른 탭에서
                   초기화했거나 옛 세션 값)에서 safeDone(undefined) 이 죽는다. */
                if (!document.getElementById('v2-modal') && STEPS[i] && safeDone(STEPS[i]) && ps >= 0 && ps + 1 < ord.length) {
                    /* 저장 토스트가 보이도록 잠깐 두고 넘어간다 */
                    var nxt = ord[ps + 1];
                    setTimeout(function () { if (active() && stateIdx() === i) go(nxt); }, 700);
                    return;
                }
                renderStep();
            });
        }).observe(document.body, { childList: true, subtree: true });

        /* ── 전체 흐름 보드 ──
           단계 목록은 이미 있는 .rl-my-step 계열을 그대로 쓴다(§7). */
        function openFlow() {
            var cur = currentIdx();
            var vorder = stepOrder();
            var vmode = viewMode();
            var rows = STEPS.map(function (s, i) {
                var d = safeDone(s);
                var now = !d && i === cur;
                var out = vorder.indexOf(i) < 0;      /* 이 관점에서 남의 몫 */
                /* 미구현 단계는 '아직 안 한 것'이 아니라 '아직 없는 것'이다 — 번호를 매기면
                   순서만 기다리면 되는 것처럼 읽힌다. */
                return '<li class="rl-my-step' + (d ? ' is-done' : '') + (now ? ' is-now' : '') + (out ? ' is-other' : '') +
                    (s.planned ? ' is-planned' : '') + '">' +
                    '<span class="rl-my-no">' + (s.planned ? '◌' : (d ? '✓' : (out ? '⏳' : (i + 1)))) + '</span>' +
                    '<span class="rl-my-body">' +
                        '<b>' + esc(s.title) + '</b>' +
                        '<span class="rl-my-who">' + esc(personaLabel(personaId(s))) + '</span>' +
                        '<span class="rl-my-note">' + esc(safeNote(s)) + '</span>' +
                    '</span>' +
                    '<span class="rl-my-act">' + (out
                        ? '<span class="dy-tour-otherlabel">상대 몫</span>'
                        : '<button type="button" class="btn btn-outline btn-sm" onclick="' + NS + '.goFromFlow(' + i + ')">' +
                            (d ? '다시 보기' : (now ? '여기서 시작 →' : '이 단계로')) + '</button>') +
                    '</span>' +
                '</li>';
            }).join('');

            var n = vorder.filter(function (i) { return safeDone(STEPS[i]); }).length;
            var pct = Math.round(n / vorder.length * 100);
            var scope = vmode === 'mine' ? '내 역할 ' : (vmode === 'read' ? '조회 ' : '');
            V().openModal(safeCall(cfg.flowTitle, '전체 흐름') || '전체 흐름',
                '<div class="dy-tour-flow">' +
                    '<p class="dy-tour-flow-lead">체크는 <b>실제 데이터로 판정</b>합니다 — 가이드를 껐다 켜도, 손으로 먼저 처리해도 그대로 맞습니다.</p>' +
                    '<div class="progress" role="img" aria-label="진행 ' + pct + '퍼센트">' +
                        '<div class="progress-bar green" style="width:' + pct + '%;"></div></div>' +
                    '<p class="dy-tour-flow-lead"><b>' + esc(scope) + n + ' / ' + vorder.length + '단계</b> 완료' +
                        (cur >= STEPS.length
                            ? ' — 전 과정이 끝났습니다.'
                            : ' · 다음 차례는 <b>' + esc(personaLabel(personaId(STEPS[cur]))) + '</b>') + '</p>' +
                    '<ol class="rl-my-steps">' + rows + '</ol>' +
                    '<p class="dy-tour-flow-note">' + (safeCall(cfg.flowNote, '') || '') + '</p>' +
                '</div>',
                '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
                '<button type="button" class="btn btn-primary" onclick="' + NS + '.goFromFlow(' +
                    (cur >= STEPS.length ? 0 : cur) + ')">' +
                    (cur >= STEPS.length ? '처음부터 다시 →' : (active() ? '이어서 진행 →' : '가이드 시작 →')) + '</button>');
        }
        function goFromFlow(i) { V().closeModal(); go(i); }

        /* ── 진행 제어 ── */
        function go(i) {
            if (i < 0 || i >= STEPS.length) { stop(); return; }
            stopOthers(inst);          /* 다른 투어가 켜져 있으면 끈다 — 패널은 한 번에 하나 */
            var order = stepOrder();
            /* 관점 밖 단계로는 커서를 두지 않는다 — 가장 가까운 뒤쪽 내 단계로 당긴다 */
            if (order.indexOf(i) < 0) {
                var near = order.filter(function (k) { return k >= i; });
                i = near.length ? near[0] : order[order.length - 1];
            }
            setIdx(i);
            var s = STEPS[i];
            /* '내 역할'·'조회' 관점에서는 페르소나를 바꾸지 않는다 —
               바꾸면 그 순간 '내 역할'이 아니게 된다. */
            var isAll = viewMode() === 'all';
            /* 전체 흐름 중 페르소나를 바꾸기 **전에** 관점을 고정한다 (MUST).
               defaultView() 는 로그인 페르소나에서 파생하므로, 3단계에서 부서
               담당자로 바꾸는 순간 관점이 조용히 'mine' 으로 뒤집혀 그 뒤 4·5·7·8·9
               단계(주관부서 몫)를 건너뛴다 — 발표용 9단계 시연이 3단계에서 끊겼다. */
            if (isAll) { try { sessionStorage.setItem(VKEY, 'all'); } catch (e) {} }
            var switched = isAll && applyPersona(s);
            if (!onStepPage(s) || switched) { location.href = s.href(); return; }
            renderStep();
        }
        function step(delta) {
            if (!active()) return;
            var order = stepOrder(), pos = order.indexOf(stateIdx());
            if (pos < 0) { go(order[0]); return; }
            var nx = pos + delta;
            if (nx < 0 || nx >= order.length) { stop(); return; }
            go(order[nx]);
        }
        function next() { step(1); }
        function prev() { step(-1); }
        function action() {
            var s = STEPS[stateIdx()];
            if (!s || typeof s.action !== 'function') return;
            /* 그 단계의 화면이 아니면 먼저 옮긴다 — 단계 action 은 화면 모듈
               (RSKLIST·MYWORK·RSKOCC…)의 전역을 부르는데, 이동이 끝나기 전에 눌리면
               그 전역이 아직 없어 TypeError 로 죽는다. 시연 중 빠르게 누르면 실제로 난다. */
            if (!onStepPage(s)) { location.href = s.href(); return; }
            try { s.action(); }
            catch (e) {
                /* 죽은 채로 두면 발표자는 '버튼이 안 먹는다'로만 본다 — 왜인지 말해 준다 */
                V().toast('이 단계는 ' + pageLabel(s.page) + ' 화면에서 실행합니다.');
                if (global.console) console.warn('[DYTOUR] action 실패', e);
            }
        }
        function stop() {
            clearIdx();
            /* 고정해 둔 관점도 함께 푼다 — 다음 시연은 그때의 로그인 페르소나에서
               다시 파생해야 한다("로그인 페르소나가 기본값을 정한다"). */
            try { sessionStorage.removeItem(VKEY); } catch (e) {}
            lastSig = '';
            removePanel();
            document.querySelectorAll('.dy-tour-focus').forEach(function (el) { el.classList.remove('dy-tour-focus'); });
        }
        /* 전 과정이 끝나 있으면 처음부터 — 반복 시연의 기본 동작 */
        function start() {
            V().closeModal();
            /* 새 시연은 지금 접속한 페르소나 기준으로 관점을 다시 정한다 —
               지난 run 이 고정해 둔 값을 물려받으면 부서 담당자에게 9단계가 뜬다. */
            try { sessionStorage.removeItem(VKEY); } catch (e) {}
            var c = currentIdx();
            go(c >= STEPS.length ? 0 : c);
        }

        /* 진입 바 문구를 관점에 맞춘다 — 부서 담당자에게 '9단계'라고 하면
           자기가 9번 뭘 해야 하는 줄 안다. 실제로 하는 건 2단계다. */
        function scopeSuffix() {
            var order = stepOrder(), n = order.filter(function (i) { return safeDone(STEPS[i]); }).length;
            var vm = viewMode();
            if (vm === 'mine') return ' · 내 역할 ' + order.length + '단계 (현재 ' + n + '/' + order.length + ')';
            if (vm === 'read') return ' · 조회 (현재 ' + n + '/' + order.length + ')';
            return ' (현재 ' + n + '/' + order.length + ')';
        }
        /* 화면 이름 — 사용자에게 'my-work.html' 같은 파일명을 보여주지 않는다 */
        function pageLabel(file) {
            var m = cfg.pageLabels || {};
            return m[file] || '다른 화면';
        }
        function scopeHint() {
            var vm = viewMode();
            if (vm === 'mine') {
                var order = stepOrder();
                var pages = {}; order.forEach(function (i) { pages[STEPS[i].page] = 1; });
                var keys = Object.keys(pages);
                var here = keys.length === 1 && pages[pageFile()];
                return ' <b>' + esc(personaLabel(curPersonaId())) + '</b> 관점에서 하는 일은 <b>' +
                    order.length + '단계</b>입니다' +
                    (here ? '.' : ' — 시작하면 <b>' + esc(keys.map(pageLabel).join(' · ')) + '</b> 화면으로 이동합니다.');
            }
            if (vm === 'read') return ' 이 관점은 <b>조회 전용</b>입니다 — 진행은 담당자가 합니다.';
            /* all — 관점 전환은 이 관점에서만 일어난다 */
            return multiPersona() ? ' 담당자 차례가 오면 <b>관점도 알아서 바꿔</b> 줍니다.' : '';
        }

        /* ── 진입 바 ── */
        function insertBar() {
            if (document.getElementById(BAR_ID)) return;
            var main = document.querySelector('main');
            if (!main) return;
            var bar = document.createElement('div');
            bar.className = 'dy-demo-bar';
            bar.id = BAR_ID;
            bar.innerHTML =
                '<div class="dy-demo-copy">' +
                    '<strong>' + esc(safeCall(cfg.barTitle, '') || '') + scopeSuffix() + '</strong>' +
                    '<span>' + (safeCall(cfg.barDesc, '') || '') + scopeHint() + '</span>' +
                '</div>' +
                '<div class="dy-demo-actions">' +
                    '<button class="btn btn-primary" type="button" onclick="' + NS + '.start()">' +
                        (viewMode() === 'read' ? '흐름 따라보기' : '시연 가이드 시작') + '</button>' +
                    '<button class="btn btn-outline" type="button" onclick="' + NS + '.openFlow()">전체 흐름 보기</button>' +
                    /* 시연 데이터를 되돌릴 수단이 있는 도메인만 (교육).
                       조회 전용 계층에는 내지 않는다 — '조회만 합니다'라고 해 놓고
                       전 부서 데이터를 날리는 버튼을 남기면 그 안내가 거짓이 된다
                       (rsk-list 의 [↺ 시연 초기화] 를 canManage() 로 막은 것과 같은 원칙). */
                    (cfg.resetLabel && viewMode() !== 'read'
                        ? '<button class="btn btn-secondary" type="button" onclick="' + NS + '.resetDemo()">' +
                          esc(cfg.resetLabel) + '</button>'
                        : '') +
                '</div>';
            main.insertBefore(bar, main.firstChild);
        }

        /* ── 키보드 ── */
        document.addEventListener('keydown', function (e) {
            if (!active() || document.getElementById('v2-modal')) return;
            var tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '';
            if (['input', 'textarea', 'select'].indexOf(tag) >= 0) return;
            if (e.key === 'Escape') stop();
            if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
        });

        /* opts.bar — 진입 바를 그릴지. 그 도메인의 대표 화면에서만 true.
           my-work 처럼 여러 도메인이 모이는 화면에는 바를 넣지 않고,
           가이드가 진행 중일 때만 패널이 뜬다. */
        function boot(opts) {
            opts = opts || {};
            if (opts.bar) insertBar();
            if (!active()) return;
            stopOthers(inst);
            /* 페르소나가 바뀌면 관점도 바뀌어 커서가 그 관점 밖에 남을 수 있다.
               그대로 두면 '내 역할' 인데 "관점을 바꿔 진행합니다"가 떠서 모순이 된다. */
            var order = stepOrder();
            if (order.indexOf(stateIdx()) < 0) setIdx(order.length ? order[0] : 0);
            renderStep();
        }

        var inst = {
            boot: boot, start: start, stop: stop, openFlow: openFlow, goFromFlow: goFromFlow,
            go: go, next: next, prev: prev, action: action,
            setView: setView, view: viewMode,
            active: active, STEPS: STEPS,
            /* 셸(layout.js)이 드롭다운을 여닫을 때 부른다 — 드롭다운은 class 토글이라
               MutationObserver(childList only)가 못 잡는다. attributes 를 관찰하면
               classList.add 가 관찰자를 다시 깨워 루프 위험이 생기므로 명시 호출로 둔다. */
            _syncChrome: syncModalState
        };
        REG.push(inst);
        return inst;
    }

    /* 셸이 부르는 훅 — 열려 있는 투어가 있으면 패널 노출 상태를 다시 맞춘다 */
    function syncChrome() { REG.forEach(function (t) { if (t.active()) t._syncChrome(); }); }

    global.DYTOUR = {
        define: define, josa: josa, personaLabel: personaLabel, curPersonaId: curPersonaId,
        syncChrome: syncChrome
    };
})(window);
