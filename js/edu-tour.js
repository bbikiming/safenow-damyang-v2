/* =====================================================================
   edu-tour.js · 안전보건교육 크로스 페이지 시연 투어 (EDUTOUR)
   ---------------------------------------------------------------------
   구 edu.html 3탭 시연 투어(발표용 핵심 자산)를 재설계 v1 다화면 구조로 포팅.
   실제 업무 플로우를 화면을 건너다니며 그대로 구동한다:
     1. 집합교육 등록 (edu-reg)  → 2. 부서 신청·서명 업로드 (edu-reg)
     → 3. 교육 종료 처리 (edu-reg-detail) → 4. 이수현황 반영 확인 (edu-status)
   · 단계 상태는 sessionStorage 로 페이지 간 유지, 각 화면 하단 고정 패널로 안내.
   · 시연 데이터 복원·초기화는 DYEDU.reset() (sessionStorage 시드 재생성).
   · 화면 모듈이 저장 성공 시 EDUTOUR.onEvent('created'|'applied'|'closed') 호출
     → 다음 단계로 자동 진행(필요 시 다음 화면으로 이동).
   전 edu-* 페이지가 로드하며, 각 페이지 init 후 EDUTOUR.boot() 호출.
   ===================================================================== */
(function (global) {
    'use strict';
    var V = function () { return global.DYV2; };
    var E = function () { return global.DYEDU; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }

    var SKEY = 'dy-edu-tour-v1';

    /* 시연 대상 집합교육 — 신청 접수 중(OPEN)인 정기(집합) 교육 1건 (시드 C-M08) */
    function openCourse() {
        var list = E().courses({ kind: ['REG_GROUP'], status: 'OPEN' });
        return list.length ? list[0] : null;
    }
    function openCourseId() {
        var c = openCourse();
        return c ? c.id : 'C-M08';
    }

    var STEPS = [
        {
            label: '등록', page: 'edu-reg.html',
            href: function () { return 'edu-reg.html'; },
            selector: '[data-tour="reg-create"]',
            title: '1. 재난안전과가 집합교육을 등록합니다',
            desc: '과정 일정·시간·강사·장소·내용과 계획서 첨부를 한 건으로 등록하면 부서 신청 접수가 시작됩니다.',
            script: '엑셀로 나눠 관리하던 월별 교육 일정·계획 문서를 하나의 교육 건으로 등록합니다.',
            actionLabel: '집합교육 등록 열기',
            action: function () { global.EDUR.openCreate('group'); },
            advanceOn: 'created',
            modalGuide: '등록 즉시 부서 신청 접수가 시작됩니다. 일자·시간·내용을 확인하고 [등록]을 누르세요.'
        },
        {
            label: '신청', page: 'edu-reg.html',
            href: function () { return 'edu-reg.html'; },
            selector: '[data-tour="apply"]',
            title: '2. 부서가 대상자를 선택해 신청합니다',
            desc: '부서 담당자가 근로자 명단에서 대상자를 체크하고 서명파일을 필수로 업로드해 신청합니다.',
            script: '서명파일은 신청 시점에 업로드합니다. 정원·마감·불참 개념 없이 신청 명단이 곧 카운트 대상입니다.',
            actionLabel: '부서 신청 열기',
            action: function () {
                var c = openCourse();
                if (!c) { V().toast('신청 접수 중인 집합교육이 없습니다. 시연을 다시 시작해 데이터를 복원하세요.'); return; }
                global.EDUR.openApply(c.id);
            },
            advanceOn: 'applied',
            modalGuide: '부서를 조직도에서 고르고 근로자를 선택한 뒤 서명파일을 첨부해야 [신청 완료]가 활성 조건을 채웁니다.'
        },
        {
            label: '종료', page: 'edu-reg-detail.html',
            href: function () { return 'edu-reg-detail.html?id=' + encodeURIComponent(openCourseId()); },
            selector: '[data-tour="close"]',
            title: '3. 교육 종료 처리로 이수시간을 카운트합니다',
            desc: '상세 화면에서 신청현황 전체를 확인하고 종료 처리하면 신청자 전원에게 교육시간이 반영됩니다.',
            script: '종료 처리 한 번으로 신청자 전원의 이수시간이 자동 반영됩니다 — 사람별 엑셀 합산이 사라집니다.',
            actionLabel: '교육 종료 처리 열기',
            action: function () { global.EDURD.closeCourse(); },
            advanceOn: 'closed',
            modalGuide: '신청 부서·인원을 마지막으로 확인하고 [종료 처리]를 누르면 전원에게 시간이 카운트됩니다.'
        },
        {
            label: '이수', page: 'edu-status.html',
            href: function () { return 'edu-status.html'; },
            selector: '[data-tour="status-summary"]',
            title: '4. 이수현황에서 반영 결과를 확인합니다',
            desc: '부서별 완료율과 대상자별 사이클·필요·인정·미달이 갱신됩니다. 미이수자는 같은 화면에서 독촉합니다.',
            script: '방금 종료 처리한 인원의 인정시간이 부서별 요약과 대상자별 상세에 바로 반영됩니다.',
            actionLabel: '대상자별 상세 보기',
            action: function () { global.EDUS.setView('detail'); setTimeout(renderStep, 0); }
        }
    ];

    /* ── 상태 ── */
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
    function pageFile() { return (location.pathname.split('/').pop() || 'index.html'); }
    function onStepPage(step) { return pageFile() === step.page; }

    var tourTarget = null;
    var tourTargetAria = null;

    /* ── 시연 안내 바 — 전 edu 화면 상단 공통 ── */
    function insertDemoBar() {
        if (document.getElementById('edu-demo-bar')) return;
        var main = document.querySelector('main');
        if (!main) return;
        var bar = document.createElement('div');
        bar.className = 'edu-demo-bar';
        bar.id = 'edu-demo-bar';
        bar.innerHTML =
            '<div class="edu-demo-copy">' +
                '<strong>안전보건교육 핵심 업무 시연</strong>' +
                '<span>집합교육 등록 → 부서 신청(서명 업로드) → 교육 종료 처리 → 이수현황 반영까지 실제 화면 흐름으로 시연합니다.</span>' +
            '</div>' +
            '<div class="edu-demo-actions">' +
                '<button class="btn btn-primary" type="button" onclick="EDUTOUR.start()">시연</button>' +
                '<button class="btn btn-secondary" type="button" onclick="EDUTOUR.resetDemo()">시연 초기화</button>' +
            '</div>';
        main.insertBefore(bar, main.firstChild);
    }

    /* ── 패널 렌더 ── */
    function clearFocus() {
        document.querySelectorAll('.edu-tour-focus').forEach(function (el) { el.classList.remove('edu-tour-focus'); });
        if (tourTarget) {
            if (tourTargetAria === null) tourTarget.removeAttribute('aria-describedby');
            else tourTarget.setAttribute('aria-describedby', tourTargetAria);
        }
        tourTarget = null;
        tourTargetAria = null;
    }
    function removePanel() {
        var old = document.getElementById('edu-tour-panel');
        if (old) old.remove();
    }
    function renderStep() {
        clearFocus();
        removePanel();
        var idx = stateIdx();
        var step = STEPS[idx];
        if (!step) return;
        var onPage = onStepPage(step);

        var target = (onPage && document.querySelector(step.selector)) || document.getElementById('edu-demo-bar');
        if (target) {
            tourTarget = target;
            tourTargetAria = target.hasAttribute('aria-describedby') ? target.getAttribute('aria-describedby') : null;
            target.classList.add('edu-tour-focus');
            target.setAttribute('aria-describedby', 'edu-tour-desc');
            var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        }

        var panel = document.createElement('aside');
        panel.id = 'edu-tour-panel';
        panel.className = 'edu-tour-panel';
        if (target) {
            var rect = target.getBoundingClientRect();
            if (rect.left + rect.width / 2 > window.innerWidth / 2 && window.innerWidth > 760) panel.classList.add('is-left');
        }
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'false');
        panel.setAttribute('aria-labelledby', 'edu-tour-title');
        panel.setAttribute('aria-describedby', 'edu-tour-desc');
        var last = idx === STEPS.length - 1;
        var actionBtn = onPage
            ? '<button class="btn btn-primary edu-tour-action" type="button" onclick="EDUTOUR.action()">' + esc(step.actionLabel) + '</button>'
            : '<button class="btn btn-primary edu-tour-action" type="button" onclick="EDUTOUR.go(' + idx + ')">이 단계 화면으로 이동 →</button>';
        panel.innerHTML =
            '<div class="edu-tour-head"><div class="edu-tour-head-main">' +
                '<div class="edu-tour-kicker">시연 · ' + esc(step.label) + '</div>' +
                '<div class="edu-tour-title" id="edu-tour-title" tabindex="-1">' + esc(step.title) + '</div></div>' +
                '<button class="edu-tour-close" type="button" onclick="EDUTOUR.stop()">시연 종료</button></div>' +
            '<div class="edu-tour-steps" aria-label="시연 단계">' + STEPS.map(function (item, i) {
                return '<button type="button" class="edu-tour-step' + (i < idx ? ' done' : '') + (i === idx ? ' active' : '') + '" onclick="EDUTOUR.go(' + i + ')"' +
                    (i === idx ? ' aria-current="step"' : '') + '>' + esc(item.label) + '</button>';
            }).join('') + '</div>' +
            '<div class="edu-tour-desc" id="edu-tour-desc">' + esc(step.desc) + '</div>' +
            '<div class="edu-tour-script"><b>시연 멘트</b>' + esc(step.script) + '</div>' +
            actionBtn +
            '<div class="edu-tour-foot"><span class="edu-tour-progress">' + (idx + 1) + ' / ' + STEPS.length + '</span>' +
                (idx ? '<button class="btn btn-secondary btn-sm" type="button" onclick="EDUTOUR.prev()">이전</button>' : '') +
                '<button class="btn btn-secondary btn-sm" type="button" onclick="' + (last ? 'EDUTOUR.stop()' : 'EDUTOUR.next()') + '">' + (last ? '시연 마치기' : '다음 단계') + '</button></div>';
        document.body.appendChild(panel);
        syncModalState();
        setTimeout(function () {
            var title = document.getElementById('edu-tour-title');
            if (title && !document.getElementById('v2-modal')) title.focus({ preventScroll: true });
        }, 0);
    }

    /* ── 모달과의 공존 — 모달이 떠 있는 동안 패널 숨김 + 모달 상단 시연 포인트 주입 ── */
    function syncModalState() {
        var panel = document.getElementById('edu-tour-panel');
        var modal = document.getElementById('v2-modal');
        if (panel) {
            var wasHidden = panel.hidden;
            panel.hidden = !!modal;
            if (modal) panel.setAttribute('aria-hidden', 'true');
            else panel.removeAttribute('aria-hidden');
            if (tourTarget) tourTarget.classList.toggle('edu-tour-focus', !modal);
            if (!modal && wasHidden) {
                setTimeout(function () {
                    var title = document.getElementById('edu-tour-title');
                    if (title && !document.getElementById('v2-modal')) title.focus({ preventScroll: true });
                }, 0);
            }
        }
        /* 시연 중 열린 모달에 단계별 안내 인라인 주입 */
        if (modal && active()) {
            var step = STEPS[stateIdx()];
            var body = modal.querySelector('.modal-body');
            if (step && step.modalGuide && body && !body.querySelector('.edu-tour-inline')) {
                var guide = document.createElement('div');
                guide.className = 'edu-tour-inline';
                guide.innerHTML = '<b>시연 포인트</b>' + esc(step.modalGuide);
                body.insertBefore(guide, body.firstChild);
            }
        }
    }
    var modalObserver = new MutationObserver(syncModalState);
    modalObserver.observe(document.body, { childList: true });

    /* ── 진행 제어 ── */
    function go(i) {
        if (i < 0 || i >= STEPS.length) { stop(); return; }
        setIdx(i);
        var step = STEPS[i];
        if (onStepPage(step)) renderStep();
        else location.href = step.href();
    }
    function next() { if (active()) go(stateIdx() + 1); }
    function prev() { if (active()) go(stateIdx() - 1); }
    function action() {
        var step = STEPS[stateIdx()];
        if (step && typeof step.action === 'function') step.action();
    }
    function onEvent(evt) {
        if (!active()) return;
        var idx = stateIdx();
        var step = STEPS[idx];
        if (!step || step.advanceOn !== evt) return;
        /* 저장 토스트가 보이도록 잠시 후 다음 단계로 */
        setTimeout(function () { go(idx + 1); }, 700);
    }
    function stop() {
        clearIdx();
        clearFocus();
        removePanel();
    }

    /* ── 시작·복원·초기화 ── */
    function start() {
        V().closeModal();
        if (!openCourse()) {
            V().openModal('시연 데이터 준비',
                '<p style="font-size:var(--fs-13);line-height:1.65;">이전 시연에서 신청 접수 중인 집합교육이 종료되었습니다. 교육 시연 데이터를 처음 상태로 복원한 뒤 시작합니다.</p>',
                '<button class="btn btn-secondary" type="button" onclick="DYV2.closeModal()">취소</button>' +
                '<button class="btn btn-primary" type="button" onclick="EDUTOUR.restoreAndStart()">복원 후 시연 시작</button>');
            return;
        }
        setIdx(0);
        if (onStepPage(STEPS[0])) renderStep();
        else location.href = STEPS[0].href();
    }
    function restoreAndStart() {
        E().reset();
        setIdx(0);
        location.href = STEPS[0].href();
    }
    function resetDemo() {
        stop();
        V().openModal('시연 상태 초기화',
            '<p style="font-size:var(--fs-13);line-height:1.6;">교육 등록·신청·종료 처리와 근로자 명단·독촉 이력 데이터를 처음 상태로 되돌립니다.</p>',
            '<button class="btn btn-secondary" type="button" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" type="button" onclick="EDUTOUR.confirmReset()">초기화</button>');
    }
    function confirmReset() {
        E().reset();
        clearIdx();
        location.reload();
    }

    /* ── 키보드 ── */
    document.addEventListener('keydown', function (event) {
        if (!active() || document.getElementById('v2-modal')) return;
        var tag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : '';
        var typing = ['input', 'textarea', 'select'].includes(tag);
        if (event.key === 'Escape') stop();
        if (!typing && event.key === 'ArrowRight') { event.preventDefault(); next(); }
        if (!typing && event.key === 'ArrowLeft') { event.preventDefault(); prev(); }
    });

    /* ── 부트 — 각 edu 화면의 모듈 init 이후 호출 ── */
    function boot() {
        insertDemoBar();
        if (active()) renderStep();
    }

    global.EDUTOUR = {
        boot: boot, start: start, stop: stop,
        go: go, next: next, prev: prev, action: action, onEvent: onEvent,
        restoreAndStart: restoreAndStart, resetDemo: resetDemo, confirmReset: confirmReset,
        active: active
    };
})(window);
