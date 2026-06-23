/**
 * risk-assessment.js
 * 위험성평가 모달 로직 — SIF 추천·매트릭스 점수·감소대책 → IMP 연결
 *
 * 의존성: risk-sif-data.js (window.RskSifData)
 * 적용 페이지: risk-detail.html
 *
 * PRD 근거: PRD-위험성평가-v0.1.md
 *   §7 SIF 활용 전략 · §9 핵심 화면 명세 · §5.3 빈도×강도 매트릭스
 */
(function() {
    'use strict';

    // ─── 위험성 매트릭스 계산 ───
    var LEVELS = [
        { min: 16, max: 25, key: 'critical', label: '매우높음', cls: 'high',
          color: 'var(--status-danger-fg)', bg: 'var(--status-danger-bg)', due: 30, banner: '⚠ 매우높음 — 작업 중지 검토, 30일 이내 개선조치 필요' },
        { min: 12, max: 15, key: 'high',     label: '높음',     cls: 'high',
          color: 'var(--status-warning-fg)', bg: 'var(--status-warning-bg)', due: 60, banner: '🔶 높음 — 대책 수립 후 작업, 60일 이내 개선조치' },
        { min: 8,  max: 11, key: 'medium',   label: '보통',     cls: 'mid',
          color: 'var(--status-info-fg)', bg: 'var(--status-info-bg)', due: 90, banner: '🔵 보통 — 단계적 개선, 90일 이내 조치' },
        { min: 4,  max: 7,  key: 'low',      label: '낮음',     cls: 'low',
          color: 'var(--status-success-fg)', bg: 'var(--status-success-bg)', due: 180, banner: '🟢 낮음 — 모니터링 (선택적 개선)' },
        { min: 1,  max: 3,  key: 'minimal',  label: '매우낮음', cls: 'low',
          color: 'var(--text-gray)', bg: '#f5f5f5', due: null, banner: '⚪ 매우낮음 — 허용 가능 (기록 보관)' }
    ];

    function calcLevel(frequency, severity) {
        var score = (frequency || 0) * (severity || 0);
        for (var i = 0; i < LEVELS.length; i++) {
            if (score >= LEVELS[i].min && score <= LEVELS[i].max) {
                return Object.assign({}, LEVELS[i], { score: score, frequency: frequency, severity: severity });
            }
        }
        return { score: 0, label: '미입력', cls: '', color: 'var(--text-lightgray)', frequency: 0, severity: 0 };
    }

    // ─── 채택된 SIF·자체 위험요인 풀 (세션 메모리) ───
    var adoptedFactors = [];   // [{ source: 'SIF'|'CUSTOM', scenario: {...}, frequency, severity, action_text, ... }]

    // ─── 모달 컨트롤 ───
    function openModal(id) {
        var el = document.getElementById(id);
        if (el) el.classList.add('is-open');
        document.body.style.overflow = 'hidden';
    }
    function closeModal(id) {
        var el = document.getElementById(id);
        if (el) el.classList.remove('is-open');
        document.body.style.overflow = '';
    }

    // ─── ① SIF 추천 모달 렌더 ───
    function renderSifGrid(scenarios) {
        var grid = document.getElementById('rsk-sif-grid');
        if (!grid) return;

        if (!scenarios || scenarios.length === 0) {
            grid.innerHTML = '<div class="rsk-sif-empty">조건에 맞는 시나리오가 없습니다. 키워드를 조정하거나 [자체 위험요인 추가]로 입력하세요.</div>';
            updateSifCounter();
            return;
        }

        var html = scenarios.map(function(s) {
            var adopted = adoptedFactors.find(function(f) { return f.source === 'SIF' && f.scenario.id === s.id; });
            var state = adopted ? adopted.review_state : null;   // adopt | review | reject | null
            return '' +
            '<div class="rsk-sif-card ' + (state ? 'state-' + state : '') + '" data-sif-id="' + s.id + '">' +
              '<div class="rsk-sif-card-header">' +
                '<span class="rsk-sif-id">' + s.id + '</span>' +
                (s.severity_hint >= 5 ? '<span class="rsk-sif-badge danger">사망사례</span>' :
                 s.severity_hint >= 4 ? '<span class="rsk-sif-badge warning">중대재해</span>' :
                                         '<span class="rsk-sif-badge info">부상사례</span>') +
              '</div>' +
              '<div class="rsk-sif-card-title">' + escapeHtml(s.high_risk_situation) + '</div>' +
              '<div class="rsk-sif-card-summary">' + escapeHtml(truncate(s.incident_summary, 110)) + '</div>' +
              '<div class="rsk-sif-card-meta">' +
                '<span class="rsk-sif-tag">🛠 ' + escapeHtml(s.causing_object) + '</span>' +
                '<span class="rsk-sif-tag">📂 ' + escapeHtml(s.work_category) + '</span>' +
              '</div>' +
              '<div class="rsk-sif-card-actions">' +
                '<button class="rsk-sif-btn rsk-sif-btn-adopt"  data-state="adopt"  type="button">해당함</button>' +
                '<button class="rsk-sif-btn rsk-sif-btn-review" data-state="review" type="button">검토중</button>' +
                '<button class="rsk-sif-btn rsk-sif-btn-reject" data-state="reject" type="button">해당없음</button>' +
              '</div>' +
            '</div>';
        }).join('');

        grid.innerHTML = html;

        // 버튼 이벤트 바인딩
        grid.querySelectorAll('.rsk-sif-card').forEach(function(card) {
            var sifId = card.dataset.sifId;
            card.querySelectorAll('.rsk-sif-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    setSifState(sifId, btn.dataset.state);
                    renderSifGrid(currentSifList);
                });
            });
        });

        updateSifCounter();
    }

    function setSifState(sifId, state) {
        var scenario = window.RskSifData.getById(sifId);
        if (!scenario) return;

        var existing = adoptedFactors.findIndex(function(f) { return f.source === 'SIF' && f.scenario.id === sifId; });

        if (existing >= 0) {
            if (state === 'reject') {
                // 해당없음 = 풀에서 제거
                adoptedFactors.splice(existing, 1);
            } else {
                adoptedFactors[existing].review_state = state;
            }
        } else if (state !== 'reject') {
            adoptedFactors.push({
                source: 'SIF',
                review_state: state,
                scenario: scenario,
                frequency: null,
                severity: null,
                action_text: '',
                action_selected: []
            });
        }
    }

    function updateSifCounter() {
        var adopt = adoptedFactors.filter(function(f) { return f.source === 'SIF' && f.review_state === 'adopt'; }).length;
        var review = adoptedFactors.filter(function(f) { return f.source === 'SIF' && f.review_state === 'review'; }).length;
        var custom = adoptedFactors.filter(function(f) { return f.source === 'CUSTOM'; }).length;
        var el = document.getElementById('rsk-sif-counter');
        if (el) {
            el.innerHTML =
              '<strong>해당함 ' + adopt + '</strong> · 검토중 ' + review + ' · 자체추가 ' + custom +
              ' · 총 위험요인 풀 <strong>' + (adopt + review + custom) + '</strong>건';
        }
    }

    // ─── 검색·필터 ───
    var currentSifList = [];

    function applySifFilter() {
        var q = (document.getElementById('rsk-sif-search') || {}).value || '';
        var dept = (document.getElementById('rsk-sif-dept') || {}).value || '';

        var list = q ?
            window.RskSifData.search(q) :
            window.RskSifData.recommend({ dept: dept, targetType: '시설' });
        currentSifList = list;
        renderSifGrid(list);
    }

    // ─── ② 매트릭스 모달 ───
    function openMatrixForFactor(factorIdx) {
        var factor = adoptedFactors[factorIdx];
        if (!factor) return;

        var modal = document.getElementById('rsk-matrix-modal');
        modal.dataset.factorIdx = factorIdx;

        var title = factor.source === 'SIF' ? factor.scenario.high_risk_situation : factor.custom_title;
        document.getElementById('rsk-matrix-target').textContent = title;

        // 라디오 설정
        ['frequency', 'severity'].forEach(function(field) {
            var val = factor[field];
            modal.querySelectorAll('input[name="m-' + field + '"]').forEach(function(r) {
                r.checked = (val !== null && parseInt(r.value, 10) === val);
            });
        });

        updateMatrixPreview();
        openModal('rsk-matrix-modal');
    }

    function updateMatrixPreview() {
        var modal = document.getElementById('rsk-matrix-modal');
        var f = parseInt((modal.querySelector('input[name="m-frequency"]:checked') || {}).value || 0, 10);
        var s = parseInt((modal.querySelector('input[name="m-severity"]:checked') || {}).value || 0, 10);
        var result = calcLevel(f, s);

        var preview = document.getElementById('rsk-matrix-result');
        if (!preview) return;

        if (result.score === 0) {
            preview.innerHTML = '<div class="rsk-matrix-preview-empty">빈도와 강도를 모두 선택하세요.</div>';
            return;
        }

        preview.innerHTML =
          '<div class="rsk-matrix-result-card" style="background:' + result.bg + '; border-color:' + result.color + ';">' +
            '<div class="rsk-matrix-score-row">' +
              '<span class="rsk-matrix-formula">' + f + ' × ' + s + ' =</span>' +
              '<span class="rsk-matrix-score" style="color:' + result.color + ';">' + result.score + '</span>' +
              '<span class="rsk-matrix-level" style="background:' + result.color + ';">' + result.label + '</span>' +
            '</div>' +
            '<div class="rsk-matrix-banner">' + result.banner + '</div>' +
            (result.due ? '<div class="rsk-matrix-due">→ 개선조치 권장 기한: <strong>' + result.due + '일 이내</strong></div>' : '') +
          '</div>';
    }

    function saveMatrix() {
        var modal = document.getElementById('rsk-matrix-modal');
        var idx = parseInt(modal.dataset.factorIdx, 10);
        var f = parseInt((modal.querySelector('input[name="m-frequency"]:checked') || {}).value || 0, 10);
        var s = parseInt((modal.querySelector('input[name="m-severity"]:checked') || {}).value || 0, 10);

        if (!f || !s) {
            toast('빈도와 강도를 모두 선택하세요.');
            return;
        }

        adoptedFactors[idx].frequency = f;
        adoptedFactors[idx].severity = s;
        closeModal('rsk-matrix-modal');
        renderFactorPool();
        toast('점수가 저장되었습니다. (' + f + ' × ' + s + ' = ' + (f * s) + ')');
    }

    // ─── ③ 위험요인 풀 테이블 렌더링 ───
    function renderFactorPool() {
        var tbody = document.getElementById('rsk-factor-pool-body');
        if (!tbody) return;

        if (adoptedFactors.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="rsk-pool-empty">아직 채택된 위험요인이 없습니다. 상단 [+ 위험요인 추가]를 눌러 SIF에서 추천받거나 자체로 작성하세요.</td></tr>';
            return;
        }

        tbody.innerHTML = adoptedFactors.map(function(f, idx) {
            var title = f.source === 'SIF' ? f.scenario.high_risk_situation : (f.custom_title || '제목 미입력');
            var origin = f.source === 'SIF'
                ? '<span class="rsk-pool-origin sif">SIF · ' + f.scenario.id + '</span>'
                : '<span class="rsk-pool-origin custom">자체</span>';

            var scoreCell;
            if (f.frequency && f.severity) {
                var lv = calcLevel(f.frequency, f.severity);
                scoreCell =
                  '<button class="rsk-pool-score-btn" type="button" style="background:' + lv.bg + '; color:' + lv.color + '; border-color:' + lv.color + ';" onclick="window.RskAssessment.openMatrix(' + idx + ')">' +
                    '<strong>' + lv.score + '</strong> ' + lv.label +
                  '</button>';
            } else {
                scoreCell = '<button class="rsk-pool-score-btn empty" type="button" onclick="window.RskAssessment.openMatrix(' + idx + ')">점수 입력</button>';
            }

            var actionCell;
            if (f.action_selected && f.action_selected.length > 0) {
                actionCell =
                  '<div class="rsk-pool-action-summary">' +
                    '<span>' + f.action_selected.length + '건 채택' + (f.action_text ? ' + 자체' : '') + '</span>' +
                    '<button class="rsk-link-btn" type="button" onclick="window.RskAssessment.openActions(' + idx + ')">수정</button>' +
                  '</div>';
            } else if (f.frequency && f.severity) {
                var dueText = calcLevel(f.frequency, f.severity).due;
                actionCell = '<button class="rsk-link-btn warning" type="button" onclick="window.RskAssessment.openActions(' + idx + ')">감소대책 수립' + (dueText ? ' (' + dueText + '일 권장)' : '') + '</button>';
            } else {
                actionCell = '<span class="rsk-pool-disabled">먼저 점수를 입력하세요</span>';
            }

            return '' +
            '<tr>' +
              '<td class="center">' + (idx + 1) + '</td>' +
              '<td>' + origin + '<div class="rsk-pool-title">' + escapeHtml(title) + '</div></td>' +
              '<td>' + (f.source === 'SIF' ? escapeHtml(f.scenario.causing_object) : '—') + '</td>' +
              '<td>' + scoreCell + '</td>' +
              '<td>' + actionCell + '</td>' +
              '<td class="center"><button class="rsk-pool-del" type="button" onclick="window.RskAssessment.removeFactor(' + idx + ')" aria-label="삭제">✕</button></td>' +
            '</tr>';
        }).join('');
    }

    // ─── ④ 감소대책 모달 ───
    function openActionsForFactor(factorIdx) {
        var f = adoptedFactors[factorIdx];
        if (!f) return;

        if (!f.frequency || !f.severity) {
            toast('먼저 빈도·강도 점수를 입력하세요.');
            return;
        }

        var modal = document.getElementById('rsk-actions-modal');
        modal.dataset.factorIdx = factorIdx;

        var title = f.source === 'SIF' ? f.scenario.high_risk_situation : f.custom_title;
        var lv = calcLevel(f.frequency, f.severity);
        document.getElementById('rsk-actions-target').textContent = title;
        document.getElementById('rsk-actions-level').innerHTML =
          '<span class="rsk-pool-score-btn" style="background:' + lv.bg + '; color:' + lv.color + '; border-color:' + lv.color + ';">' +
            '<strong>' + lv.score + '</strong> ' + lv.label +
          '</span>' +
          (lv.due ? ' · 권장 기한 <strong>' + lv.due + '일 이내</strong>' : '');

        // KOSHA 권장대책 체크박스
        var list = document.getElementById('rsk-actions-kosha-list');
        if (f.source === 'SIF' && f.scenario.countermeasures) {
            list.innerHTML = f.scenario.countermeasures.map(function(c, i) {
                var checked = (f.action_selected || []).indexOf(i) >= 0 ? 'checked' : '';
                return '<label class="rsk-action-check"><input type="checkbox" data-idx="' + i + '" ' + checked + '> <span>' + escapeHtml(c) + '</span></label>';
            }).join('');
        } else {
            list.innerHTML = '<div class="rsk-action-empty">자체 위험요인은 KOSHA 권장대책이 없습니다. 아래 자체 대책란에 직접 작성하세요.</div>';
        }

        document.getElementById('rsk-actions-custom').value = f.action_text || '';
        openModal('rsk-actions-modal');
    }

    function saveActions(generateImp) {
        var modal = document.getElementById('rsk-actions-modal');
        var idx = parseInt(modal.dataset.factorIdx, 10);
        var f = adoptedFactors[idx];

        var selected = [];
        modal.querySelectorAll('#rsk-actions-kosha-list input[type="checkbox"]:checked').forEach(function(cb) {
            selected.push(parseInt(cb.dataset.idx, 10));
        });
        var customText = (document.getElementById('rsk-actions-custom').value || '').trim();

        if (selected.length === 0 && !customText) {
            toast('KOSHA 권장대책에서 1개 이상 선택하거나 자체 대책을 작성하세요.');
            return;
        }

        f.action_selected = selected;
        f.action_text = customText;

        if (generateImp) {
            // IMP 모듈로 라우팅 (실제로는 menu.html?m=improve_assessment&risk_factor_id=…)
            var lv = calcLevel(f.frequency, f.severity);
            var dueDate = '';
            if (lv.due) {
                var d = new Date();
                d.setDate(d.getDate() + lv.due);
                dueDate = d.toISOString().slice(0, 10);
            }
            f.imp_generated = true;
            f.imp_due = dueDate;
            toast('개선조치(IMP)가 생성되었습니다.' + (dueDate ? ' 기한: ' + dueDate : ''));
        } else {
            toast('감소대책이 저장되었습니다.');
        }

        closeModal('rsk-actions-modal');
        renderFactorPool();
    }

    // ─── ⑤ 자체 위험요인 추가 ───
    function addCustomFactor() {
        var input = document.getElementById('rsk-sif-custom-input');
        var title = (input.value || '').trim();
        if (!title) {
            toast('위험요인 제목을 입력하세요.');
            return;
        }
        adoptedFactors.push({
            source: 'CUSTOM',
            custom_title: title,
            frequency: null,
            severity: null,
            action_text: '',
            action_selected: []
        });
        input.value = '';
        updateSifCounter();
        toast('자체 위험요인이 추가되었습니다.');
    }

    function removeFactor(idx) {
        if (!confirm('이 위험요인을 풀에서 제거할까요? (삭제는 평가 종료 전까지 복구 가능)')) return;
        adoptedFactors.splice(idx, 1);
        renderFactorPool();
        updateSifCounter();
    }

    function commitFactors() {
        var pending = adoptedFactors.filter(function(f) { return !f.frequency || !f.severity; });
        if (pending.length > 0) {
            if (!confirm(pending.length + '건의 위험요인이 점수 미입력입니다. 그래도 계속하시겠습니까?')) return;
        }
        var critical = adoptedFactors.filter(function(f) {
            if (!f.frequency || !f.severity) return false;
            var lv = calcLevel(f.frequency, f.severity);
            return (lv.key === 'critical' || lv.key === 'high') && (!f.action_selected || f.action_selected.length === 0) && !f.action_text;
        });
        if (critical.length > 0) {
            // PRD 수정 — 차단 → 경고 (이슈 4 반영)
            if (!confirm('⚠ 매우높음·높음 등급 ' + critical.length + '건에 감소대책이 없습니다.\n\n결재 상신 시 KOSHA 가이드 위반으로 판단될 수 있습니다. 그래도 계속하시겠습니까?')) return;
        }
        toast('위험요인 풀이 평가에 반영되었습니다. (' + adoptedFactors.length + '건)');
        closeModal('rsk-sif-modal');
    }

    // ─── 유틸 ───
    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, function(c) {
            return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
        });
    }
    function truncate(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }
    function toast(msg) {
        var t = document.getElementById('toast');
        if (!t) { alert(msg); return; }
        t.textContent = msg;
        t.classList.add('show');
        setTimeout(function() { t.classList.remove('show'); }, 2400);
    }

    // ─── 초기화 ───
    function init() {
        if (!document.getElementById('rsk-sif-modal')) return;   // risk-detail.html 외 페이지에서는 비활성

        // "위험요인 추가" 버튼 (기존 _soon 토스트 → SIF 모달 오픈으로 교체)
        document.querySelectorAll('[data-rsk-add-factor]').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                applySifFilter();
                openModal('rsk-sif-modal');
            });
        });

        // 모달 닫기
        document.querySelectorAll('[data-rsk-modal-close]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                closeModal(btn.dataset.rskModalClose);
            });
        });

        // SIF 검색·필터
        var search = document.getElementById('rsk-sif-search');
        if (search) search.addEventListener('input', debounce(applySifFilter, 250));
        var dept = document.getElementById('rsk-sif-dept');
        if (dept) dept.addEventListener('change', applySifFilter);

        // 자체 추가
        var addBtn = document.getElementById('rsk-sif-custom-add');
        if (addBtn) addBtn.addEventListener('click', addCustomFactor);

        // 위험요인 풀 반영 버튼
        var commitBtn = document.getElementById('rsk-sif-commit');
        if (commitBtn) commitBtn.addEventListener('click', commitFactors);

        // 매트릭스 라디오 변경 → preview
        document.querySelectorAll('#rsk-matrix-modal input[type="radio"]').forEach(function(r) {
            r.addEventListener('change', updateMatrixPreview);
        });

        // 매트릭스 저장
        var saveMx = document.getElementById('rsk-matrix-save');
        if (saveMx) saveMx.addEventListener('click', saveMatrix);

        // 감소대책 저장
        var saveAct = document.getElementById('rsk-actions-save');
        if (saveAct) saveAct.addEventListener('click', function() { saveActions(false); });
        var saveActImp = document.getElementById('rsk-actions-save-imp');
        if (saveActImp) saveActImp.addEventListener('click', function() { saveActions(true); });

        // 초기 풀 렌더
        renderFactorPool();
    }

    function debounce(fn, ms) {
        var t;
        return function() {
            var args = arguments;
            clearTimeout(t);
            t = setTimeout(function() { fn.apply(null, args); }, ms);
        };
    }

    // 공개 API
    window.RskAssessment = {
        init: init,
        openMatrix: openMatrixForFactor,
        openActions: openActionsForFactor,
        removeFactor: removeFactor,
        calcLevel: calcLevel
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
