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
    function josa(word, withJong, withoutJong) {
        var s = String(word == null ? '' : word).trim();
        if (!s) return withJong;
        var c = s.charCodeAt(s.length - 1);
        var has = (c >= 0xac00 && c <= 0xd7a3) ? ((c - 0xac00) % 28) > 0 : false;
        return has ? withJong : withoutJong;
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
        function safeDone(s) { return !!safeCall(s.done, false); }
        function safeNote(s) { return s.note ? String(safeCall(s.note, '') || '') : ''; }
        function personaId(s) { return safeCall(s.persona, '') || ''; }
        function currentIdx() {
            for (var i = 0; i < STEPS.length; i++) { if (!safeDone(STEPS[i])) return i; }
            return STEPS.length;
        }
        function doneCount() { var n = 0; STEPS.forEach(function (s) { if (safeDone(s)) n++; }); return n; }

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
            var want = personaId(s);
            if (curPersonaId() !== want) {
                var wl = personaLabel(want);
                return '지금 관점(' + personaLabel(curPersonaId()) + ')에는 이 버튼이 없습니다 — ' +
                    wl + josa(wl, '으로', '로') + ' 바꾸세요.';
            }
            if (safeDone(s)) return '이미 끝난 단계라 그 버튼은 화면에서 사라졌습니다.';
            if (!onStepPage(s)) return '이 단계는 다른 화면(' + s.page + ')에 있습니다.';
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
            if (!el) { if (why) { why.hidden = false; why.innerHTML = '⚠ ' + esc(whyMissing(s, idx)); } return; }
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

            var actionBtn;
            if (wrongWho) {
                actionBtn = '<button class="btn btn-primary dy-tour-action" type="button" onclick="' + NS + '.go(' + idx + ')">' +
                    esc(personaLabel(want)) + ' 관점으로 전환 →</button>';
            } else if (!onPage) {
                actionBtn = '<button class="btn btn-primary dy-tour-action" type="button" onclick="' + NS + '.go(' + idx + ')">이 단계 화면으로 이동 →</button>';
            } else {
                actionBtn = '<button class="btn btn-primary dy-tour-action" type="button" onclick="' + NS + '.action()">' +
                    esc(s.actionLabel) + '</button>';
            }

            panel.innerHTML =
                '<div class="dy-tour-head"><div class="dy-tour-head-main">' +
                    '<div class="dy-tour-kicker">' + esc(safeCall(cfg.kicker, '') || '') + ' · ' + doneCount() + ' / ' + STEPS.length + '단계' +
                        (done ? ' · <b>이 단계 완료</b>' : '') + '</div>' +
                    '<div class="dy-tour-title" id="' + TITLE_ID + '" tabindex="-1">' + (idx + 1) + '. ' + esc(s.title) + '</div></div>' +
                    '<button class="dy-tour-close" type="button" onclick="' + NS + '.stop()">가이드 종료</button></div>' +
                '<div class="dy-tour-steps' + (cfg.stepsClass ? ' ' + cfg.stepsClass : '') + '" aria-label="시연 단계">' + STEPS.map(function (x, i) {
                    return '<button type="button" class="dy-tour-step' + (safeDone(x) ? ' done' : '') + (i === idx ? ' active' : '') + '"' +
                        (i === idx ? ' aria-current="step"' : '') +
                        ' title="' + esc((i + 1) + '. ' + x.title) + '" onclick="' + NS + '.go(' + i + ')">' + esc(x.label) + '</button>';
                }).join('') + '</div>' +
                '<div class="dy-tour-who' + (wrongWho ? ' is-warn' : '') + '">' + (wrongWho
                    ? '지금은 <b>' + esc(personaLabel(want)) + '</b> 차례입니다 — 아래 버튼을 누르면 관점을 바꿔 이어서 진행합니다.'
                    : '<b>' + esc(personaLabel(want)) + '</b> 관점 · ' + esc(safeNote(s))) + '</div>' +
                '<div class="dy-tour-where">여기를 누르세요 — ' + s.where + '</div>' +
                '<ol class="dy-tour-path">' + (s.clickPath || []).map(function (c) {
                    return '<li>' + esc(c) + '</li>';
                }).join('') + '</ol>' +
                '<div class="dy-tour-desc" id="' + DESC_ID + '">' + esc(s.desc) + '</div>' +
                '<div class="dy-tour-why" id="' + WHY_ID + '" hidden></div>' +
                '<div class="dy-tour-script"><b>시연 멘트</b>' + esc(s.script) + '</div>' +
                actionBtn +
                '<div class="dy-tour-foot"><span class="dy-tour-progress">' + (idx + 1) + ' / ' + STEPS.length + '</span>' +
                    '<button class="btn btn-secondary btn-sm" type="button" onclick="' + NS + '.openFlow()">전체 흐름</button>' +
                    (idx ? '<button class="btn btn-secondary btn-sm" type="button" onclick="' + NS + '.prev()">이전</button>' : '') +
                    '<button class="btn btn-secondary btn-sm" type="button" onclick="' +
                        (idx === STEPS.length - 1 ? NS + '.stop()' : NS + '.next()') + '">' +
                        (idx === STEPS.length - 1 ? '마치기' : '다음') + '</button></div>';
            document.body.appendChild(panel);
            applyFocus();
            scrollToTarget();
            syncModalState();
            setTimeout(function () {
                var el = document.getElementById(TITLE_ID);
                if (el && !document.getElementById('v2-modal')) el.focus({ preventScroll: true });
            }, 0);
        }

        /* 모달이 뜨면 패널을 숨기고, 모달 본문 맨 위에 그 단계의 시연 포인트를 넣는다 (§1) */
        function syncModalState() {
            var panel = document.getElementById(PANEL_ID);
            var modal = document.getElementById('v2-modal');
            if (panel) {
                panel.hidden = !!modal;
                if (modal) panel.setAttribute('aria-hidden', 'true'); else panel.removeAttribute('aria-hidden');
            }
            if (modal && active()) {
                var s = STEPS[stateIdx()];
                var body = modal.querySelector('.modal-body');
                /* 흐름 보드 자신에게는 넣지 않는다 — 보드는 전체 지도이지 특정 단계의
                   작업 모달이 아니다. 넣으면 엉뚱한 단계의 안내가 보드 위에 뜬다. */
                if (body && body.querySelector('.dy-tour-flow')) return;
                if (s && s.modalGuide && body && !body.querySelector('.dy-tour-inline')) {
                    var g = document.createElement('div');
                    g.className = 'dy-tour-inline';
                    g.innerHTML = '<b>시연 포인트</b>' + s.modalGuide +
                        (s.modalAction
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
                /* 모달이 떠 있으면 사용자가 아직 입력 중이다 — 밀지 않는다 */
                if (!document.getElementById('v2-modal') && safeDone(STEPS[i]) && i + 1 < STEPS.length) {
                    /* 저장 토스트가 보이도록 잠깐 두고 넘어간다 */
                    setTimeout(function () { if (active() && stateIdx() === i) go(i + 1); }, 700);
                    return;
                }
                renderStep();
            });
        }).observe(document.body, { childList: true, subtree: true });

        /* ── 전체 흐름 보드 ──
           단계 목록은 이미 있는 .rl-my-step 계열을 그대로 쓴다(§7). */
        function openFlow() {
            var cur = currentIdx();
            var rows = STEPS.map(function (s, i) {
                var d = safeDone(s);
                var now = !d && i === cur;
                return '<li class="rl-my-step' + (d ? ' is-done' : '') + (now ? ' is-now' : '') + '">' +
                    '<span class="rl-my-no">' + (d ? '✓' : (i + 1)) + '</span>' +
                    '<span class="rl-my-body">' +
                        '<b>' + esc(s.title) + '</b>' +
                        '<span class="rl-my-who">' + esc(personaLabel(personaId(s))) + '</span>' +
                        '<span class="rl-my-note">' + esc(safeNote(s)) + '</span>' +
                    '</span>' +
                    '<span class="rl-my-act">' +
                        '<button type="button" class="btn btn-outline btn-sm" onclick="' + NS + '.goFromFlow(' + i + ')">' +
                            (d ? '다시 보기' : (now ? '여기서 시작 →' : '이 단계로')) + '</button>' +
                    '</span>' +
                '</li>';
            }).join('');

            var n = doneCount();
            var pct = Math.round(n / STEPS.length * 100);
            V().openModal(safeCall(cfg.flowTitle, '전체 흐름') || '전체 흐름',
                '<div class="dy-tour-flow">' +
                    '<p class="dy-tour-flow-lead">체크는 <b>실제 데이터로 판정</b>합니다 — 가이드를 껐다 켜도, 손으로 먼저 처리해도 그대로 맞습니다.</p>' +
                    '<div class="progress" role="img" aria-label="진행 ' + pct + '퍼센트">' +
                        '<div class="progress-bar green" style="width:' + pct + '%;"></div></div>' +
                    '<p class="dy-tour-flow-lead"><b>' + n + ' / ' + STEPS.length + '단계</b> 완료' +
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
            setIdx(i);
            var s = STEPS[i];
            var switched = applyPersona(s);
            if (!onStepPage(s) || switched) { location.href = s.href(); return; }
            renderStep();
        }
        function next() { if (active()) go(stateIdx() + 1); }
        function prev() { if (active()) go(stateIdx() - 1); }
        function action() {
            var s = STEPS[stateIdx()];
            if (s && typeof s.action === 'function') s.action();
        }
        function stop() {
            clearIdx();
            lastSig = '';
            removePanel();
            document.querySelectorAll('.dy-tour-focus').forEach(function (el) { el.classList.remove('dy-tour-focus'); });
        }
        /* 전 과정이 끝나 있으면 처음부터 — 반복 시연의 기본 동작 */
        function start() { V().closeModal(); var c = currentIdx(); go(c >= STEPS.length ? 0 : c); }

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
                    '<strong>' + esc(safeCall(cfg.barTitle, '') || '') + ' (현재 ' + doneCount() + '/' + STEPS.length + ')</strong>' +
                    '<span>' + (safeCall(cfg.barDesc, '') || '') + '</span>' +
                '</div>' +
                '<div class="dy-demo-actions">' +
                    '<button class="btn btn-primary" type="button" onclick="' + NS + '.start()">시연 가이드 시작</button>' +
                    '<button class="btn btn-outline" type="button" onclick="' + NS + '.openFlow()">전체 흐름 보기</button>' +
                    /* 시연 데이터를 되돌릴 수단이 있는 도메인만 (교육) */
                    (cfg.resetLabel
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
            renderStep();
        }

        var inst = {
            boot: boot, start: start, stop: stop, openFlow: openFlow, goFromFlow: goFromFlow,
            go: go, next: next, prev: prev, action: action,
            active: active, STEPS: STEPS
        };
        REG.push(inst);
        return inst;
    }

    global.DYTOUR = { define: define, josa: josa, personaLabel: personaLabel, curPersonaId: curPersonaId };
})(window);
