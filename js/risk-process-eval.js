/**
 * risk-process-eval.js
 * 유해·위험요인별 위험성평가 작성 — 체크리스트법 (O/X/해당없음)
 *
 * 적용 페이지: risk-process-eval.html
 * 시나리오 6~8단계:
 *   6) 위험요인 목록 자동 표출 + 체크 해제로 제외
 *   7) 체크리스트 X 선택 시 개선조치 입력 팝업
 *   8) 전부 입력 후 제출 → 결재요청
 *
 * UX: 현장점검 게이트(형식주의 차단), 진행률, X 미입력 차단, IMP 자동후보 안내
 */
(function () {
    'use strict';

    // ─── 유해·위험요인관리 마스터에서 자동 생성된 위험요인(점검항목) ───
    var FACTORS = [
        { id: 'f1', name: '질식 (염소 누출)', sub: '염소 봄베 교체 작업', level: 'high', src: 'sif',
          sugg: ['누출 감지기 상시 가동·점검', '방독마스크(산성가스용) 착용', '봄베 교체 시 환기팬 선가동'] },
        { id: 'f2', name: '질식 (밀폐공간)', sub: '약품 저장탱크 내부 청소', level: 'high', src: 'sif',
          sugg: ['진입 전 산소·유해가스 측정', '송기마스크·외부 감시자 배치', '밀폐공간 작업허가서 발급'] },
        { id: 'f3', name: '중독·화학 (PAC·차염 접촉)', sub: '응집제·차염 취급', level: 'mid', src: 'kosha',
          sugg: ['내화학 보호구 착용', '비상 세안설비 수압 점검·보강', 'MSDS 게시·교육'] },
        { id: 'f4', name: '화상·부식 (비산)', sub: '약품 투입 중 비산·튐', level: 'mid', src: 'own',
          sugg: ['보안경·안면보호구 착용', '정량펌프 자동화'] },
        { id: 'f5', name: '전도·미끄러짐', sub: '약품 누출로 바닥 미끄러움', level: 'low', src: 'own',
          sugg: ['미끄럼방지 바닥 처리', '누출 즉시 세척·경고표지'] }
    ];

    // 상태: { id: { included, judge('O'|'X'|'NA'|''), action:{text,owner,due} } }
    var state = {};
    FACTORS.forEach(function (f) { state[f.id] = { included: true, judge: '', action: null }; });

    var LV = { high: ['high', '높음'], mid: ['mid', '보통'], low: ['low', '낮음'] };
    var SRC = { sif: 'SIF', kosha: 'KOSHA', own: '자체' };

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function byId(id) { return document.getElementById(id); }
    function toast(m) { var t = byId('toast'); if (!t) return; t.textContent = m; t.classList.add('show'); setTimeout(function () { t.classList.remove('show'); }, 2600); }
    function gateOn() { var g = byId('pe-gate-input'); return g ? g.checked : true; }

    // ─── 행 렌더 ───
    function renderRows() {
        var wrap = byId('pe-rows');
        if (!wrap) return;
        wrap.innerHTML = FACTORS.map(function (f) {
            var s = state[f.id];
            var lv = LV[f.level];
            var judgeBtns =
                '<div class="pe-judge">' +
                  '<button class="pe-judge-btn' + (s.judge === 'O' ? ' on' : '') + '" data-j="O" data-id="' + f.id + '" type="button">O</button>' +
                  '<button class="pe-judge-btn' + (s.judge === 'X' ? ' on' : '') + '" data-j="X" data-id="' + f.id + '" type="button">X</button>' +
                  '<button class="pe-judge-btn' + (s.judge === 'NA' ? ' on' : '') + '" data-j="NA" data-id="' + f.id + '" type="button">해당없음</button>' +
                '</div>';

            var actionCell;
            if (s.judge === 'X') {
                if (s.action && s.action.text) {
                    actionCell = '<div class="pe-action-cell pe-action-done">✓ 입력됨<span class="txt">' + esc(s.action.text) + '</span>' +
                                 '<button class="pe-action-edit" data-edit="' + f.id + '" type="button">수정</button></div>';
                } else {
                    actionCell = '<div class="pe-action-cell pe-action-need">⚠ 개선조치 입력 필요 <button class="pe-action-edit" data-edit="' + f.id + '" type="button">입력</button></div>';
                }
            } else {
                actionCell = '<div class="pe-action-cell pe-action-empty">—</div>';
            }

            var statusBadge;
            if (!s.included) statusBadge = '<span class="chip-status neutral pe-status-badge">제외</span>';
            else if (s.judge === 'O') statusBadge = '<span class="chip-status success pe-status-badge">적정</span>';
            else if (s.judge === 'X') statusBadge = '<span class="chip-status danger pe-status-badge">부적정</span>';
            else if (s.judge === 'NA') statusBadge = '<span class="chip-status neutral pe-status-badge">해당없음</span>';
            else statusBadge = '<span class="chip-status info pe-status-badge">미점검</span>';

            return '<div class="pe-row' + (s.included ? '' : ' excluded') + '" data-row="' + f.id + '">' +
                '<div style="text-align:center;"><input type="checkbox" class="pe-inc-check" data-inc="' + f.id + '" ' + (s.included ? 'checked' : '') + '></div>' +
                '<div><span class="pe-item-name">' + esc(f.name) + '<span class="pe-src ' + f.src + '">' + SRC[f.src] + '</span><span class="lvl ' + lv[0] + '">' + lv[1] + '</span></span>' +
                  '<div class="pe-item-sub">' + esc(f.sub) + '</div></div>' +
                '<div class="pe-c-judge" style="text-align:center;">' + judgeBtns + '</div>' +
                '<div class="pe-c-action">' + actionCell + '</div>' +
                '<div class="pe-c-status" style="text-align:center;">' + statusBadge + '</div>' +
            '</div>';
        }).join('');
        bindRows();
        applyGate();
        recalc();
    }

    function bindRows() {
        document.querySelectorAll('.pe-inc-check').forEach(function (cb) {
            cb.addEventListener('change', function () {
                var id = cb.dataset.inc;
                state[id].included = cb.checked;
                if (!cb.checked) { state[id].judge = ''; state[id].action = null; }
                renderRows();
            });
        });
        document.querySelectorAll('.pe-judge-btn').forEach(function (b) {
            b.addEventListener('click', function () {
                if (!gateOn()) { toast('현장점검 확인 후 판정할 수 있습니다.'); return; }
                setJudge(b.dataset.id, b.dataset.j);
            });
        });
        document.querySelectorAll('[data-edit]').forEach(function (b) {
            b.addEventListener('click', function () { openAction(b.dataset.edit); });
        });
    }

    // ─── 판정 ───
    function setJudge(id, j) {
        var s = state[id];
        if (j === 'X') {
            s.judge = 'X';
            renderRows();
            openAction(id);      // X → 개선조치 팝업 (7단계)
            return;
        }
        s.judge = j;
        if (j !== 'X') s.action = null;
        renderRows();
    }

    // ─── 개선조치 모달 (7단계) ───
    var amTargetId = null;
    function openAction(id) {
        amTargetId = id;
        var f = FACTORS.filter(function (x) { return x.id === id; })[0];
        var s = state[id];
        byId('pe-am-target').textContent = f.name + ' — ' + f.sub;
        byId('pe-am-text').value = s.action ? s.action.text : '';
        byId('pe-am-owner').value = s.action ? s.action.owner : '이정비';
        byId('pe-am-due').value = s.action ? s.action.due : '2026-07-15';
        // 추천 개선대책 칩
        var sugg = byId('pe-am-sugg');
        sugg.innerHTML = (f.sugg || []).map(function (t) { return '<span class="pe-sugg-chip" data-sugg="' + esc(t) + '">+ ' + esc(t) + '</span>'; }).join('');
        sugg.querySelectorAll('.pe-sugg-chip').forEach(function (c) {
            c.addEventListener('click', function () {
                var ta = byId('pe-am-text');
                ta.value = (ta.value ? ta.value + '\n' : '') + c.dataset.sugg;
            });
        });
        byId('pe-action-modal').classList.add('is-open');
        document.body.style.overflow = 'hidden';
        setTimeout(function () { byId('pe-am-text').focus(); }, 50);
    }
    function closeAction(rollback) {
        byId('pe-action-modal').classList.remove('is-open');
        document.body.style.overflow = '';
        // 취소 시 개선조치 미입력이면 X 판정 롤백
        if (rollback && amTargetId) {
            var s = state[amTargetId];
            if (s.judge === 'X' && (!s.action || !s.action.text)) { s.judge = ''; }
        }
        amTargetId = null;
        renderRows();
    }
    function saveAction() {
        if (!amTargetId) return;
        var text = (byId('pe-am-text').value || '').trim();
        if (!text) { toast('개선 대책을 입력하세요.'); return; }
        state[amTargetId].action = { text: text, owner: byId('pe-am-owner').value, due: byId('pe-am-due').value };
        byId('pe-action-modal').classList.remove('is-open');
        document.body.style.overflow = '';
        var done = amTargetId; amTargetId = null;
        renderRows();
        toast('개선조치가 저장되었습니다. (개선조치 후보 자동 등록)');
    }

    // ─── 현장점검 게이트 ───
    function applyGate() {
        var on = gateOn();
        var gate = byId('pe-gate');
        if (gate) gate.classList.toggle('is-off', !on);
        document.querySelectorAll('.pe-row').forEach(function (r) { r.classList.toggle('pe-confirm-locked', !on); });
    }

    // ─── 집계 + 제출 조건 ───
    function recalc() {
        var inc = FACTORS.filter(function (f) { return state[f.id].included; });
        var o = 0, x = 0, na = 0, judged = 0, xNoAction = 0;
        inc.forEach(function (f) {
            var s = state[f.id];
            if (s.judge === 'O') o++;
            else if (s.judge === 'X') { x++; if (!s.action || !s.action.text) xNoAction++; }
            else if (s.judge === 'NA') na++;
            if (s.judge) judged++;
        });
        var ex = FACTORS.length - inc.length;
        set('pe-total', inc.length);
        set('pe-o', o); set('pe-x', x); set('pe-na', na); set('pe-ex', ex);
        var pct = inc.length ? Math.round(judged / inc.length * 100) : 0;
        var fill = byId('pe-prog-fill'); if (fill) fill.style.width = pct + '%';
        set('pe-prog-pct', pct + '%');

        var submit = byId('pe-submit');
        if (submit) {
            var ready = gateOn() && inc.length > 0 && judged === inc.length && xNoAction === 0;
            if (ready) { submit.removeAttribute('disabled'); submit.classList.remove('is-disabled'); submit.title = ''; }
            else {
                submit.setAttribute('disabled', ''); submit.classList.add('is-disabled');
                submit.title = !gateOn() ? '현장점검 확인 필요'
                    : (judged < inc.length ? '미점검 ' + (inc.length - judged) + '건'
                    : (xNoAction > 0 ? 'X 항목 개선조치 미입력 ' + xNoAction + '건' : ''));
            }
        }
        window.__peStats = { o: o, x: x, na: na, ex: ex, total: inc.length };
    }
    function set(id, v) { var e = byId(id); if (e) e.textContent = v; }

    // ─── 제출 (8단계) ───
    function submit() {
        if (!gateOn()) { toast('현장점검 확인 후 제출 가능합니다.'); byId('pe-gate').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
        var st = window.__peStats || {};
        var msg = '✓ 유해·위험요인별 평가를 제출하고 결재를 요청합니다.\n\n' +
                  '· 점검항목 ' + st.total + '건 (제외 ' + st.ex + '건)\n' +
                  '· O 적정 ' + st.o + ' · X 부적정 ' + st.x + ' · 해당없음 ' + st.na + '\n' +
                  (st.x > 0 ? '· X ' + st.x + '건 → 개선조치(IMP) 후보 자동 등록\n' : '') +
                  '\n총괄담당자(김안전)에게 결재 진행 요청이 전송됩니다.\n[확인] 시 정기평가 상세로 이동합니다.';
        alert(msg);
        window.location.href = 'risk-regular.html';
    }

    function init() {
        if (!byId('pe-rows')) return;
        renderRows();
        var gi = byId('pe-gate-input');
        if (gi) gi.addEventListener('change', function () { applyGate(); recalc(); });
        bind('pe-am-close', function () { closeAction(true); });
        bind('pe-am-cancel', function () { closeAction(true); });
        bind('pe-am-save', saveAction);
        bind('pe-submit', submit);
    }
    function bind(id, fn) { var e = byId(id); if (e) e.addEventListener('click', fn); }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.ProcEval = { state: state };
})();
