/**
 * risk-tour.js
 * 위험성평가 순차 이행 튜토리얼 (페이지 횡단 product tour)
 *
 * 목표: 팀장님 플로우대로 "뭘 누르고 어디로 이동할지" 단계별 안내
 * 플로우: 유해·위험요인관리 → 정기평가 생성 → 유해·위험요인별 작성 → 순환 반영
 *
 * 동작: localStorage로 전역 진행(idx) 추적. 페이지 이동 후 자동 재개.
 * 의존성 없음(바닐라). 디자인 토큰(var(--*)) 사용.
 */
(function () {
    'use strict';

    var KEY = 'rskTourState';

    // ─── 전역 단계 정의 (8단계 시연 시나리오) ───
    var STEPS = [
        {
            page: 'proc-list.html',
            target: '.table-figma tbody tr:first-child',
            badge: 'STEP 1 / 8 · 유해·위험요인 관리',
            title: '① 유해·위험요인이 이미 등록되어 있습니다',
            body: '위험성평가의 기준정보입니다. <b>유해·위험요인 ▸ 작업 ▸ 설비·유해위험요인</b>이 미리 등록돼 있어요.<br>유해·위험요인을 클릭해 구조를 봅니다.'
        },
        {
            page: 'proc-detail.html',
            target: '.proc-work',
            badge: 'STEP 1 / 8 · 유해·위험요인 구조',
            title: '① 작업 ▸ 설비 · 유해위험요인',
            body: '유해·위험요인 하위 <b>작업</b>마다 사용하는 <b>설비·시설</b>과 예상 <b>유해위험요인</b>이 묶여 등록됩니다.'
        },
        {
            page: 'risk-list.html',
            target: '#tour-create',
            badge: 'STEP 2 / 8 · 평가 생성',
            title: '② 정기 위험성평가 생성',
            body: '이 버튼을 눌러 정기 위험성평가 생성을 시작합니다.'
        },
        {
            page: 'risk-create.html',
            target: '#rc-method-section',
            badge: 'STEP 2 / 8 · 평가 방법',
            title: '② 평가 방법 선택 — 체크리스트법',
            body: '평가 방법을 고릅니다. <b>체크리스트법</b>이 구현되어 기본 선택돼 있어요. (O/X/해당없음 점검 방식)'
        },
        {
            page: 'risk-create.html',
            target: '#rc-proc-list',
            badge: 'STEP 3 / 8 · 대상 유해·위험요인',
            title: '③ 유해·위험요인 목록 자동 표출',
            body: '활성 유해·위험요인이 <b>체크박스로 자동 선택</b>됩니다. 이번 평가에서 <b>제외할 유해·위험요인은 체크를 해제</b>하세요.'
        },
        {
            page: 'risk-create.html',
            target: '#rc-create',
            badge: 'STEP 4 / 8 · 생성 완료',
            title: '④ 저장 → 위험성평가 생성',
            body: '<b>[정기평가 생성]</b>을 누르면 유해·위험요인별 평가가 자동 생성되고 평가 상세로 이동합니다.'
        },
        {
            page: 'risk-regular.html',
            target: '.table-figma tbody tr:first-child',
            badge: 'STEP 5 / 8 · 담당자 확인',
            title: '⑤ 유해·위험요인별 담당자 배정 확인',
            body: '평가 상세입니다. 유해·위험요인마다 <b>담당자가 자동 배정</b>됐는지 목록으로 확인할 수 있어요.'
        },
        {
            page: 'risk-regular.html',
            target: '.table-figma tbody tr:first-child .btn',
            badge: 'STEP 6 / 8 · 유해·위험요인 선택',
            title: '⑥ 유해·위험요인을 누르면 위험요인이 나옵니다',
            body: '<b>[작성]</b>을 누르면 그 유해·위험요인의 위험요인 목록이 표출됩니다. 첫 유해·위험요인으로 들어가 봅니다.'
        },
        {
            page: 'risk-process-eval.html',
            target: '.pe-row[data-row="f1"] .pe-judge',
            badge: 'STEP 6 / 8 · 위험요인 점검',
            title: '⑥ 위험요인 목록 · 제외 가능',
            body: '자동 생성된 위험요인입니다. <b>왼쪽 체크 해제로 제외</b>할 수 있고, 각 항목을 <b>O · X · 해당없음</b>으로 점검합니다.'
        },
        {
            page: 'risk-process-eval.html',
            target: '.pe-row[data-row="f1"] .pe-judge-btn[data-j="X"]',
            badge: 'STEP 7 / 8 · 개선조치',
            title: '⑦ X를 누르면 개선조치 팝업',
            body: '부적정(<b>X</b>)으로 판정하면 <b>개선조치 입력 팝업</b>이 떠서 대책·담당자·예정일을 입력합니다.'
        },
        {
            page: 'risk-process-eval.html',
            target: '#pe-submit',
            badge: 'STEP 8 / 8 · 제출',
            title: '⑧ 제출 · 결재요청',
            body: '모든 항목 점검(+X 개선조치 입력)이 끝나면 <b>[제출 · 결재요청]</b>이 활성화됩니다. 결재가 요청됩니다. 🎉'
        }
    ];

    // ─── 상태 ───
    function getState() {
        try { return JSON.parse(localStorage.getItem(KEY)) || { active: false, idx: 0 }; }
        catch (e) { return { active: false, idx: 0 }; }
    }
    function setState(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
    function curPage() { return (location.pathname.split('/').pop() || 'index.html'); }

    // ─── 스타일 주입 ───
    function injectStyle() {
        if (document.getElementById('rsk-tour-style')) return;
        var css = '' +
        '.rtour-fab{position:fixed;right:22px;bottom:22px;z-index:99990;display:inline-flex;align-items:center;gap:8px;padding:12px 18px;background:var(--main);color:#fff;border:none;border-radius:var(--radius-full);font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(32,159,132,.4);}' +
        '.rtour-fab:hover{background:var(--main-dark);transform:translateY(-1px);}' +
        '.rtour-backdrop{position:fixed;inset:0;z-index:99995;background:transparent;cursor:default;}' +
        '.rtour-spot{position:fixed;z-index:99996;border-radius:8px;box-shadow:0 0 0 9999px rgba(0,0,0,.55);pointer-events:none;transition:all .25s cubic-bezier(.4,0,.2,1);border:2px solid var(--main);}' +
        '.rtour-spot.pulse{animation:rtourPulse 1.4s ease-out infinite;}' +
        '@keyframes rtourPulse{0%{box-shadow:0 0 0 9999px rgba(0,0,0,.55),0 0 0 0 rgba(32,159,132,.5);}70%{box-shadow:0 0 0 9999px rgba(0,0,0,.55),0 0 0 10px rgba(32,159,132,0);}100%{box-shadow:0 0 0 9999px rgba(0,0,0,.55),0 0 0 0 rgba(32,159,132,0);}}' +
        '.rtour-pop{position:fixed;z-index:99997;max-width:340px;background:#fff;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.28);padding:0;overflow:hidden;transition:all .25s cubic-bezier(.4,0,.2,1);}' +
        '.rtour-pop-badge{display:inline-block;margin:14px 16px 0;padding:3px 10px;background:var(--status-success-bg);color:var(--main);border-radius:var(--radius-full);font-size:11px;font-weight:700;}' +
        '.rtour-pop-title{font-size:15px;font-weight:800;color:var(--text-black);padding:8px 16px 0;line-height:1.4;}' +
        '.rtour-pop-body{font-size:13px;color:var(--text-black);line-height:1.65;padding:8px 16px 14px;}' +
        '.rtour-pop-body b{color:var(--main-dark);}' +
        '.rtour-pop-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 16px;border-top:1px solid var(--card-line);background:#fafafa;}' +
        '.rtour-dots{display:flex;gap:4px;}' +
        '.rtour-dot{width:6px;height:6px;border-radius:50%;background:var(--card-line);}' +
        '.rtour-dot.on{background:var(--main);width:18px;border-radius:3px;}' +
        '.rtour-btns{display:flex;gap:6px;}' +
        '.rtour-btn{padding:7px 14px;border-radius:var(--radius-md);font-size:13px;font-weight:600;cursor:pointer;border:1px solid var(--card-line);background:#fff;color:var(--text-gray);}' +
        '.rtour-btn:hover{background:var(--gray-100);}' +
        '.rtour-btn.primary{background:var(--main);color:#fff;border-color:var(--main);}' +
        '.rtour-btn.primary:hover{background:var(--main-dark);}' +
        '.rtour-pop-arrow{position:absolute;width:14px;height:14px;background:#fff;transform:rotate(45deg);}' +
        '@media(max-width:600px){.rtour-pop{max-width:88vw;left:6vw !important;right:6vw;}}';
        var st = document.createElement('style');
        st.id = 'rsk-tour-style';
        st.textContent = css;
        document.head.appendChild(st);
    }

    // ─── FAB (시작 버튼) ───
    function injectFab() {
        if (document.getElementById('rtour-fab')) return;
        var b = document.createElement('button');
        b.id = 'rtour-fab';
        b.className = 'rtour-fab';
        b.type = 'button';
        b.innerHTML = '🎓 진행 가이드';
        b.addEventListener('click', start);
        document.body.appendChild(b);
    }
    function showFab(show) {
        var f = document.getElementById('rtour-fab');
        if (f) f.style.display = show ? 'inline-flex' : 'none';
    }

    // ─── 오버레이 요소 ───
    var spotEl, popEl, backdropEl;
    function ensureEls() {
        if (!backdropEl) {
            backdropEl = document.createElement('div');
            backdropEl.className = 'rtour-backdrop';
            // 뒤 요소 오작동 방지 — 클릭/스크롤 차단(말풍선 버튼으로만 진행)
            backdropEl.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); });
            backdropEl.addEventListener('wheel', function (e) { /* 스크롤은 허용 */ }, { passive: true });
            document.body.appendChild(backdropEl);
        }
        if (!spotEl) { spotEl = document.createElement('div'); spotEl.className = 'rtour-spot pulse'; document.body.appendChild(spotEl); }
        if (!popEl) { popEl = document.createElement('div'); popEl.className = 'rtour-pop'; document.body.appendChild(popEl); }
    }
    function clearEls() {
        if (backdropEl) { backdropEl.remove(); backdropEl = null; }
        if (spotEl) { spotEl.remove(); spotEl = null; }
        if (popEl) { popEl.remove(); popEl = null; }
    }

    // ─── 단계 표시 ───
    var curIdx = -1;
    function show(idx) {
        var step = STEPS[idx];
        if (!step) { finish(); return; }
        if (step.page !== curPage()) { location.href = step.page; return; }
        curIdx = idx;
        showFab(false);
        injectStyle();
        ensureEls();

        var target = step.target ? document.querySelector(step.target) : null;
        if (target) {
            var big0 = target.getBoundingClientRect().height > window.innerHeight * 0.6;
            target.scrollIntoView({ behavior: 'smooth', block: big0 ? 'start' : 'center', inline: 'center' });
            setTimeout(function () {
                if (big0) {  // 큰 타겟: 고정 헤더에 상단이 가리지 않도록 보정
                    var sr = target.getBoundingClientRect();
                    if (sr.top < 100) window.scrollBy(0, sr.top - 100);
                }
                position(target, step, idx);
            }, 340);
        } else {
            // 타겟 없으면 화면 중앙 말풍선만
            spotEl.style.display = 'none';
            renderPop(step, idx);
            popEl.style.left = '50%'; popEl.style.top = '50%';
            popEl.style.transform = 'translate(-50%,-50%)';
        }
    }

    function position(target, step, idx) {
        var r = target.getBoundingClientRect();
        var pad = 6;
        spotEl.style.display = 'block';
        spotEl.style.left = (r.left - pad) + 'px';
        spotEl.style.top = (r.top - pad) + 'px';
        spotEl.style.width = (r.width + pad * 2) + 'px';
        spotEl.style.height = (r.height + pad * 2) + 'px';

        renderPop(step, idx);

        // 말풍선 위치: 타겟 아래 우선, 공간 없으면 위
        var pr = popEl.getBoundingClientRect();
        var vh = window.innerHeight, vw = window.innerWidth;
        var big = r.height > vh * 0.6;
        var top, left;
        if (big) {
            // 큰 타겟(긴 리스트 등): 말풍선을 화면 하단 중앙 고정 → 타겟 상단 가리지 않음
            left = vw / 2 - pr.width / 2;
            top = vh - pr.height - 16;
        } else {
            var below = (r.bottom + 14 + pr.height < vh);
            if (below) top = r.bottom + 14; else top = r.top - pr.height - 14;
            if (top < 12) top = 12;
            left = r.left + r.width / 2 - pr.width / 2;
        }
        if (left < 12) left = 12;
        if (left + pr.width > vw - 12) left = vw - pr.width - 12;
        popEl.style.left = left + 'px';
        popEl.style.top = top + 'px';
        popEl.style.transform = 'none';
    }

    function renderPop(step, idx) {
        var isLast = idx === STEPS.length - 1;
        var nextIsNav = !isLast && STEPS[idx + 1].page !== step.page;
        var nextLabel = isLast ? '완료 🎉' : (nextIsNav ? '다음 화면 →' : '다음 →');
        var dots = STEPS.map(function (_, i) {
            return '<span class="rtour-dot' + (i === idx ? ' on' : '') + '"></span>';
        }).join('');
        popEl.innerHTML =
            '<span class="rtour-pop-badge">' + step.badge + '</span>' +
            '<div class="rtour-pop-title">' + step.title + '</div>' +
            '<div class="rtour-pop-body">' + step.body + '</div>' +
            '<div class="rtour-pop-foot">' +
                '<div class="rtour-dots">' + dots + '</div>' +
                '<div class="rtour-btns">' +
                    '<button class="rtour-btn" type="button" id="rtour-skip">종료</button>' +
                    (idx > 0 ? '<button class="rtour-btn" type="button" id="rtour-prev">이전</button>' : '') +
                    '<button class="rtour-btn primary" type="button" id="rtour-next">' + nextLabel + '</button>' +
                '</div>' +
            '</div>';
        byId('rtour-skip').addEventListener('click', finish);
        byId('rtour-next').addEventListener('click', next);
        var prev = byId('rtour-prev');
        if (prev) prev.addEventListener('click', back);
    }

    function next() {
        var s = getState();
        s.idx = (curIdx >= 0 ? curIdx : s.idx) + 1;
        s.active = true;
        setState(s);
        if (s.idx >= STEPS.length) { finish(); return; }
        var step = STEPS[s.idx];
        if (step.page !== curPage()) { location.href = step.page; }  // 이동 후 자동 재개
        else show(s.idx);
    }
    function back() {
        var s = getState();
        s.idx = (curIdx >= 0 ? curIdx : s.idx) - 1;
        if (s.idx < 0) s.idx = 0;
        setState(s);
        var step = STEPS[s.idx];
        if (step.page !== curPage()) { location.href = step.page; }
        else show(s.idx);
    }
    function start() {
        setState({ active: true, idx: 0 });
        var step = STEPS[0];
        if (step.page !== curPage()) location.href = step.page;
        else show(0);
    }
    function finish() {
        setState({ active: false, idx: 0 });
        clearEls();
        curIdx = -1;
        showFab(true);
    }

    function byId(id) { return document.getElementById(id); }

    // ─── 재배치 (스크롤/리사이즈) ───
    function reposition() {
        if (curIdx < 0 || !spotEl) return;
        var step = STEPS[curIdx];
        var target = step && step.target ? document.querySelector(step.target) : null;
        if (target) position(target, step, curIdx);
    }

    // ─── 초기화 ───
    function init() {
        injectStyle();
        injectFab();
        var s = getState();
        if (s.active) {
            var step = STEPS[s.idx];
            if (step && step.page === curPage()) {
                setTimeout(function () { show(s.idx); }, 400);  // layout mount 대기
            }
        }
        window.addEventListener('resize', reposition);
        window.addEventListener('scroll', reposition, true);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.RskTour = { start: start, finish: finish };
})();
