/**
 * risk-checklist.js
 * 체크리스트 위험성평가 컨트롤러
 *
 * 의존성: risk-checklist-data.js (RskChecklistData), risk-sif-data.js (RskSifData)
 * 적용 페이지: risk-checklist.html
 *
 * 기능:
 *   - 카테고리 탭 필터링
 *   - 4종 추가 모달 (표준/아차사고/SIF/직접)
 *   - 위험성 수준 라디오 (O/X/해당없음) + 통계
 *   - 정렬·삭제·임시저장·최종제출
 */
(function() {
    'use strict';

    // ─── 상태 ───
    /**
     * 체크리스트 항목 1건의 데이터 구조
     * { id, source, category, content, legal_ref, judgement, note, _selected }
     */
    var checklist = [];
    var activeCategory = 'all';
    var currentModalContext = null;   // 'STANDARD' | 'NEAR_MISS' | 'SIF'

    // ─── 초기 시드 (이미지처럼 폭염 10건 prefilled) ───
    function seedInitial() {
        if (!window.RskChecklistData) return;
        var heat = window.RskChecklistData.getStandardByCategory('heat');
        checklist = heat.slice(0, 10).map(function(item, idx) {
            return {
                id: 'CHK-' + Date.now() + '-' + idx,
                source: 'STANDARD',
                category: item.category,
                content: item.content,
                legal_ref: item.legal_ref,
                judgement: idx < 5 ? 'O' : '',   // 이미지처럼 위 5건은 O, 아래는 미판단
                note: '',
                _selected: false
            };
        });
    }

    // ─── 카테고리 탭 렌더 ───
    function renderTabs() {
        var bar = document.getElementById('chk-tab-bar');
        if (!bar) return;
        var cats = window.RskChecklistData.categories;

        // 전체 + 카테고리별 카운트
        var allCount = checklist.length;
        var html = '<div class="chk-tab ' + (activeCategory === 'all' ? 'is-active' : '') + '" data-cat="all">' +
                   '<span>📋 전체</span><span class="chk-tab-count">' + allCount + '</span></div>';

        Object.keys(cats).forEach(function(k) {
            var count = checklist.filter(function(c) { return c.category === k; }).length;
            if (count === 0) return;
            html += '<div class="chk-tab ' + (activeCategory === k ? 'is-active' : '') + '" data-cat="' + k + '">' +
                    '<span>' + cats[k].icon + ' ' + cats[k].name + '</span>' +
                    '<span class="chk-tab-count">' + count + '</span></div>';
        });

        bar.innerHTML = html;
        bar.querySelectorAll('.chk-tab').forEach(function(t) {
            t.addEventListener('click', function() {
                activeCategory = t.dataset.cat;
                renderTabs();
                renderTable();
            });
        });
    }

    // ─── 테이블 렌더 ───
    function renderTable() {
        var tbody = document.getElementById('chk-table-body');
        if (!tbody) return;

        var filtered = activeCategory === 'all' ?
            checklist :
            checklist.filter(function(c) { return c.category === activeCategory; });

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="padding:0;">' +
                '<div class="chk-empty">' +
                  '<div class="chk-empty-icon">📋</div>' +
                  '<div class="chk-empty-title">체크리스트 항목이 없습니다</div>' +
                  '<div class="chk-empty-desc">상단의 <strong>[표준모델 추가]</strong> · <strong>[아차사고 추가]</strong> · <strong>[사망사고 고위험요인 추가]</strong> · <strong>[직접추가]</strong> 버튼으로<br>위험성평가에 포함할 항목을 등록하세요.</div>' +
                '</div></td></tr>';
            updateStats();
            return;
        }

        tbody.innerHTML = filtered.map(function(c, displayIdx) {
            var realIdx = checklist.indexOf(c);
            return '' +
            '<tr class="' + (c._selected ? 'is-selected' : '') + '" data-id="' + c.id + '">' +
              '<td class="chk-col-check center"><input type="checkbox" data-chk-select="' + c.id + '" ' + (c._selected ? 'checked' : '') + '></td>' +
              '<td class="chk-col-no center">' + (displayIdx + 1) + '</td>' +
              '<td class="chk-col-content">' +
                '<div class="chk-content-text" contenteditable="' + (c.source === 'CUSTOM' ? 'true' : 'false') + '" data-chk-edit="content" data-id="' + c.id + '">' +
                  escapeHtml(c.content) +
                '</div>' +
              '</td>' +
              '<td class="chk-col-judge center">' +
                '<div class="chk-judge-group">' +
                  '<label class="chk-judge-label chk-O"><input type="radio" name="j-' + c.id + '" value="O"  ' + (c.judgement === 'O'  ? 'checked' : '') + ' data-chk-judge="' + c.id + '"><span>O</span></label>' +
                  '<label class="chk-judge-label chk-X"><input type="radio" name="j-' + c.id + '" value="X"  ' + (c.judgement === 'X'  ? 'checked' : '') + ' data-chk-judge="' + c.id + '"><span>X</span></label>' +
                  '<label class="chk-judge-label chk-NA"><input type="radio" name="j-' + c.id + '" value="NA" ' + (c.judgement === 'NA' ? 'checked' : '') + ' data-chk-judge="' + c.id + '"><span>해당없음</span></label>' +
                '</div>' +
              '</td>' +
              '<td class="chk-col-note">' +
                '<input type="text" class="chk-note-input" placeholder="비고 입력…" value="' + escapeAttr(c.note) + '" data-chk-note="' + c.id + '">' +
              '</td>' +
              '<td class="chk-col-order center">' +
                '<div class="chk-order-buttons">' +
                  '<button class="chk-order-btn" data-chk-move="up"   data-id="' + c.id + '" ' + (realIdx === 0 ? 'disabled' : '') + ' aria-label="위로">▲</button>' +
                  '<button class="chk-order-btn" data-chk-move="down" data-id="' + c.id + '" ' + (realIdx === checklist.length - 1 ? 'disabled' : '') + ' aria-label="아래로">▼</button>' +
                '</div>' +
              '</td>' +
              '<td class="chk-col-legal">' +
                '<div class="chk-legal-text">' + escapeHtml(c.legal_ref || '—') + '</div>' +
              '</td>' +
              '<td class="chk-col-source center">' +
                '<span class="chk-source-badge ' + c.source + '">' + sourceLabel(c.source) + '</span>' +
              '</td>' +
            '</tr>';
        }).join('');

        bindRowEvents();
        updateStats();
    }

    function sourceLabel(s) {
        return { STANDARD: '표준', NEAR_MISS: '아차', SIF: '사망', CUSTOM: '직접' }[s] || s;
    }

    function bindRowEvents() {
        // 체크박스 선택
        document.querySelectorAll('[data-chk-select]').forEach(function(cb) {
            cb.addEventListener('change', function() {
                var item = checklist.find(function(c) { return c.id === cb.dataset.chkSelect; });
                if (item) item._selected = cb.checked;
                renderTable();
                updateDeleteButton();
            });
        });

        // 위험성 수준 라디오
        document.querySelectorAll('[data-chk-judge]').forEach(function(r) {
            r.addEventListener('change', function() {
                var item = checklist.find(function(c) { return c.id === r.dataset.chkJudge; });
                if (item) item.judgement = r.value;
                updateStats();
            });
        });

        // 비고
        document.querySelectorAll('[data-chk-note]').forEach(function(i) {
            i.addEventListener('input', function() {
                var item = checklist.find(function(c) { return c.id === i.dataset.chkNote; });
                if (item) item.note = i.value;
            });
        });

        // 직접추가 항목 콘텐츠 편집
        document.querySelectorAll('[data-chk-edit="content"]').forEach(function(el) {
            el.addEventListener('blur', function() {
                var item = checklist.find(function(c) { return c.id === el.dataset.id; });
                if (item && item.source === 'CUSTOM') item.content = el.textContent.trim();
            });
        });

        // 정렬 위/아래
        document.querySelectorAll('[data-chk-move]').forEach(function(b) {
            b.addEventListener('click', function() {
                var dir = b.dataset.chkMove;
                var id = b.dataset.id;
                var idx = checklist.findIndex(function(c) { return c.id === id; });
                if (dir === 'up' && idx > 0) {
                    var t = checklist[idx]; checklist[idx] = checklist[idx - 1]; checklist[idx - 1] = t;
                } else if (dir === 'down' && idx < checklist.length - 1) {
                    var t2 = checklist[idx]; checklist[idx] = checklist[idx + 1]; checklist[idx + 1] = t2;
                }
                renderTable();
            });
        });
    }

    // ─── 통계 업데이트 ───
    function updateStats() {
        var total = checklist.length;
        var o  = checklist.filter(function(c) { return c.judgement === 'O';  }).length;
        var x  = checklist.filter(function(c) { return c.judgement === 'X';  }).length;
        var na = checklist.filter(function(c) { return c.judgement === 'NA'; }).length;
        var pending = total - o - x - na;
        var done = o + x + na;
        var percent = total === 0 ? 0 : Math.round((done / total) * 100);

        setText('chk-total-count', total + '건');
        setText('chk-done-count', done + '건');
        setText('chk-progress-percent', percent + '%');
        setText('chk-stat-o', o);
        setText('chk-stat-x', x);
        setText('chk-stat-na', na);
        setText('chk-stat-pending', pending);

        var fill = document.getElementById('chk-progress-fill');
        if (fill) fill.style.width = percent + '%';
    }

    function updateDeleteButton() {
        var selected = checklist.filter(function(c) { return c._selected; }).length;
        var btn = document.querySelector('[data-chk-action="delete"]');
        if (btn) btn.disabled = selected === 0;
    }

    // ─── 모달: 표준/아차/SIF 추가 ───
    function openAddModal(source) {
        currentModalContext = source;
        var modal = document.getElementById('chk-add-modal');
        var title = document.getElementById('chk-add-modal-title');
        var help = document.getElementById('chk-add-modal-help');

        var meta = {
            STANDARD: {
                title: '📦 표준모델 체크리스트 추가',
                help: 'KOSHA 산업안전포털 표준 체크리스트에서 항목을 선택합니다. 카테고리별로 산업안전보건기준에 관한 규칙 조항이 자동 매핑됩니다.'
            },
            NEAR_MISS: {
                title: '⚠ 아차사고(니어미스) 기반 체크리스트 추가',
                help: '담양군 내부에서 보고된 아차사고 사례에서 도출된 점검 항목입니다. "사고로 이어질 수 있었던 상황"을 사전에 차단합니다.'
            },
            SIF: {
                title: '🚨 사망사고 고위험요인(SIF) 기반 체크리스트 추가',
                help: 'KOSHA 산업재해 고위험요인(SIF) 4,432건에서 담양군 시설 관리에 적합한 시나리오 20건을 큐레이션. 각 시나리오는 실제 사망사례 기반입니다.'
            }
        };
        title.textContent = meta[source].title;
        help.textContent = meta[source].help;

        document.getElementById('chk-modal-search').value = '';
        renderModalFilter();
        renderModalList();
        modal.classList.add('is-open');
        document.body.style.overflow = 'hidden';
    }

    function closeModal(id) {
        document.getElementById(id).classList.remove('is-open');
        document.body.style.overflow = '';
    }

    var modalActiveCategory = 'all';

    function renderModalFilter() {
        var filterEl = document.getElementById('chk-modal-filter');
        var cats = window.RskChecklistData.categories;
        var chips = '<span class="chk-cat-chip ' + (modalActiveCategory === 'all' ? 'is-active' : '') + '" data-cat="all">전체</span>';
        Object.keys(cats).forEach(function(k) {
            chips += '<span class="chk-cat-chip ' + (modalActiveCategory === k ? 'is-active' : '') + '" data-cat="' + k + '">' + cats[k].icon + ' ' + cats[k].name + '</span>';
        });
        filterEl.innerHTML = chips;
        filterEl.querySelectorAll('.chk-cat-chip').forEach(function(c) {
            c.addEventListener('click', function() {
                modalActiveCategory = c.dataset.cat;
                renderModalFilter();
                renderModalList();
            });
        });
    }

    function renderModalList() {
        var listEl = document.getElementById('chk-modal-list');
        var q = (document.getElementById('chk-modal-search') || {}).value || '';

        var items;
        if (currentModalContext === 'STANDARD') {
            items = window.RskChecklistData.standardItems;
        } else if (currentModalContext === 'NEAR_MISS') {
            items = window.RskChecklistData.nearMissItems;
        } else if (currentModalContext === 'SIF') {
            items = (window.RskSifData ? window.RskSifData.scenarios : []);
        } else {
            items = [];
        }

        if (modalActiveCategory !== 'all' && currentModalContext !== 'SIF') {
            items = items.filter(function(i) { return i.category === modalActiveCategory; });
        }

        if (q) {
            items = items.filter(function(i) {
                var text = (i.content || i.risk_factor || i.high_risk_situation || '') + ' ' +
                           (i.legal_ref || '') + ' ' +
                           (i.incident_summary || '');
                return text.toLowerCase().indexOf(q.toLowerCase()) >= 0;
            });
        }

        if (items.length === 0) {
            listEl.innerHTML = '<div style="padding:32px; text-align:center; color:var(--text-gray); font-size:13px;">조건에 맞는 항목이 없습니다.</div>';
            return;
        }

        listEl.innerHTML = items.map(function(i, idx) {
            var content, meta;
            if (currentModalContext === 'SIF') {
                content = i.high_risk_situation;
                meta = 'SIF · ' + i.id + ' · ' + (i.causing_object || '') + (i.severity_hint >= 5 ? ' · 사망사례' : '');
            } else {
                content = i.content;
                meta = (i.legal_ref || '—') + (i.incident_date ? ' · ' + i.incident_date : '');
            }
            return '' +
            '<label class="chk-modal-item">' +
              '<input type="checkbox" data-modal-idx="' + idx + '" data-modal-id="' + i.id + '">' +
              '<div class="chk-modal-item-content">' +
                escapeHtml(content) +
                '<div class="chk-modal-item-meta">' + escapeHtml(meta) + '</div>' +
              '</div>' +
            '</label>';
        }).join('');

        // 체크박스 상태 토글
        listEl.querySelectorAll('.chk-modal-item').forEach(function(label) {
            var cb = label.querySelector('input');
            cb.addEventListener('change', function() {
                label.classList.toggle('is-checked', cb.checked);
            });
        });

        // 검색 디바운스
        var searchEl = document.getElementById('chk-modal-search');
        if (searchEl && !searchEl._bound) {
            searchEl._bound = true;
            searchEl.addEventListener('input', debounce(renderModalList, 200));
        }
    }

    function addSelectedFromModal() {
        var listEl = document.getElementById('chk-modal-list');
        var checked = listEl.querySelectorAll('input[type="checkbox"]:checked');
        if (checked.length === 0) {
            toast('추가할 항목을 선택하세요.');
            return;
        }

        var sourcePool;
        if (currentModalContext === 'STANDARD')  sourcePool = window.RskChecklistData.standardItems;
        else if (currentModalContext === 'NEAR_MISS') sourcePool = window.RskChecklistData.nearMissItems;
        else if (currentModalContext === 'SIF')   sourcePool = window.RskSifData.scenarios;

        var added = 0;
        checked.forEach(function(cb) {
            var id = cb.dataset.modalId;
            var item = sourcePool.find(function(i) { return i.id === id; });
            if (!item) return;
            // 중복 방지 (같은 원본 ID가 이미 있는지)
            if (checklist.some(function(c) { return c._origin_id === id; })) return;

            var newItem;
            if (currentModalContext === 'SIF') {
                newItem = {
                    id: 'CHK-' + Date.now() + '-' + added,
                    _origin_id: id,
                    source: 'SIF',
                    category: mapSifToCategory(item),
                    content: item.high_risk_situation + ' — 본 현장에서 해당 위험요인이 통제되고 있는가?',
                    legal_ref: 'KOSHA SIF ' + item.id + ' (사망사례 기반) · ' + (item.causing_object || ''),
                    judgement: '',
                    note: '',
                    _selected: false
                };
            } else {
                newItem = {
                    id: 'CHK-' + Date.now() + '-' + added,
                    _origin_id: id,
                    source: currentModalContext,
                    category: item.category,
                    content: item.content,
                    legal_ref: item.legal_ref,
                    judgement: '',
                    note: '',
                    _selected: false
                };
            }
            checklist.push(newItem);
            added++;
        });

        toast(added + '건의 체크리스트 항목이 추가되었습니다.');
        closeModal('chk-add-modal');
        renderTabs();
        renderTable();
    }

    // SIF의 tags·causing_object를 category로 매핑
    function mapSifToCategory(sif) {
        var t = (sif.tags || []).join(',');
        if (t.indexOf('추락') >= 0) return 'fall';
        if (t.indexOf('감전') >= 0) return 'electric';
        if (t.indexOf('화학') >= 0 || t.indexOf('가스누출') >= 0) return 'chemical';
        if (t.indexOf('밀폐') >= 0) return 'confined';
        if (t.indexOf('가스') >= 0 || t.indexOf('폭발') >= 0) return 'fire';
        if (t.indexOf('인양') >= 0 || t.indexOf('크레인') >= 0) return 'lift';
        if (t.indexOf('차량') >= 0) return 'vehicle';
        return 'fall';
    }

    // ─── 직접추가 모달 ───
    function openCustomModal() {
        document.getElementById('chk-custom-content').value = '';
        document.getElementById('chk-custom-legal').value = '';
        document.getElementById('chk-custom-modal').classList.add('is-open');
        document.body.style.overflow = 'hidden';
    }

    function saveCustom() {
        var content = document.getElementById('chk-custom-content').value.trim();
        var category = document.getElementById('chk-custom-category').value;
        var legal = document.getElementById('chk-custom-legal').value.trim();

        if (!content) {
            toast('체크리스트 항목을 입력하세요.');
            return;
        }

        checklist.push({
            id: 'CHK-' + Date.now(),
            source: 'CUSTOM',
            category: category,
            content: content,
            legal_ref: legal || '담양군 자체 점검 항목',
            judgement: '',
            note: '',
            _selected: false
        });

        toast('직접추가 항목이 등록되었습니다.');
        closeModal('chk-custom-modal');
        renderTabs();
        renderTable();
    }

    // ─── 삭제 ───
    function deleteSelected() {
        var selected = checklist.filter(function(c) { return c._selected; });
        if (selected.length === 0) return;
        if (!confirm(selected.length + '건의 체크리스트 항목을 삭제할까요?')) return;
        checklist = checklist.filter(function(c) { return !c._selected; });
        renderTabs();
        renderTable();
        updateDeleteButton();
        toast(selected.length + '건이 삭제되었습니다.');
    }

    // ─── 저장·제출 ───
    function saveTemp() {
        toast('💾 임시저장되었습니다. (' + checklist.length + '건 · ' + getDoneRatio() + '% 완료)');
    }

    function submitFinal() {
        var pending = checklist.filter(function(c) { return !c.judgement; }).length;
        var oCount  = checklist.filter(function(c) { return c.judgement === 'O';  }).length;
        var xCount  = checklist.filter(function(c) { return c.judgement === 'X';  }).length;
        var naCount = checklist.filter(function(c) { return c.judgement === 'NA'; }).length;

        if (checklist.length === 0) {
            toast('체크리스트 항목을 1건 이상 추가하세요.');
            return;
        }
        if (pending > 0) {
            if (!confirm('미판단 항목 ' + pending + '건이 있습니다.\n그래도 결재 상신하시겠습니까?')) return;
        }

        // ─── 평가 메타 수집 (body data-* 속성) ───
        var body = document.body;
        var meta = {
            id:               'RSK-' + Date.now(),
            title:            body.dataset.evalTitle      || '체크리스트 위험성평가',
            target:           body.dataset.evalTarget     || '신계 정수장',
            target_type:      body.dataset.evalTargetType || '시설',
            department:       body.dataset.evalDepartment || '물순환사업소 ★',
            owner:            body.dataset.evalOwner      || '김안전',
            period:           body.dataset.evalPeriod     || '2026-06-01 ~ 2026-07-31',
            category:         body.dataset.evalCategory       || 'regular',
            category_label:   body.dataset.evalCategoryLabel  || '정기',
            method:           body.dataset.evalMethod         || 'CHECKLIST',
            method_label:     body.dataset.evalMethodLabel    || '체크리스트법',
            status:           xCount > 0 ? 'in_progress' : 'done',
            status_label:     xCount > 0 ? '진행중' : '완료',
            approval:         'pending',
            approval_label:   '결재 진행중',
            total:            checklist.length,
            o_count:          oCount,
            x_count:          xCount,
            na_count:         naCount,
            pending_count:    pending,
            submitted_at:     formatNow(),
            is_new:           true
        };

        // ─── localStorage 누적 저장 (최근 10건) ───
        try {
            var existing = JSON.parse(localStorage.getItem('damyangRskSubmissions') || '[]');
            existing.unshift(meta);
            localStorage.setItem('damyangRskSubmissions', JSON.stringify(existing.slice(0, 10)));
        } catch (e) { /* localStorage 접근 실패 시 무시 (프로토타입) */ }

        // ─── 사용자 안내 ───
        var msg = '✓ 체크리스트 평가가 결재 상신되었습니다.\n\n' +
                  '총 ' + meta.total + '건\n' +
                  '• O (안전):     ' + oCount + '건\n' +
                  '• X (위험):     ' + xCount + '건' + (xCount > 0 ? ' → 개선조치(IMP) 자동 후보' : '') + '\n' +
                  '• 해당없음:   ' + naCount + '건';
        if (pending > 0) msg += '\n• 미판단:     ' + pending + '건';
        msg += '\n\n평가 상태: ' + meta.status_label + ' · ' + meta.approval_label + '\n\n[확인] 클릭 시 평가 목록으로 이동합니다.';
        alert(msg);

        // ─── 평가 목록으로 이동 ───
        window.location.href = 'risk-list.html?from=submit&id=' + encodeURIComponent(meta.id);
    }

    function formatNow() {
        var d = new Date();
        var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
               ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    function getDoneRatio() {
        if (checklist.length === 0) return 0;
        var done = checklist.filter(function(c) { return c.judgement; }).length;
        return Math.round((done / checklist.length) * 100);
    }

    // ─── 전체 선택 ───
    function bindSelectAll() {
        var el = document.getElementById('chk-select-all');
        if (!el) return;
        el.addEventListener('change', function() {
            var visible = activeCategory === 'all' ? checklist : checklist.filter(function(c) { return c.category === activeCategory; });
            visible.forEach(function(c) { c._selected = el.checked; });
            renderTable();
            updateDeleteButton();
        });
    }

    // ─── 액션 버튼 바인딩 ───
    function bindActions() {
        document.querySelectorAll('[data-chk-action]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var act = btn.dataset.chkAction;
                if (act === 'add-standard')  openAddModal('STANDARD');
                else if (act === 'add-nearmiss') openAddModal('NEAR_MISS');
                else if (act === 'add-sif')      openAddModal('SIF');
                else if (act === 'add-custom')   openCustomModal();
                else if (act === 'delete')       deleteSelected();
                else if (act === 'save-temp')    saveTemp();
                else if (act === 'submit')       submitFinal();
            });
        });

        document.querySelectorAll('[data-chk-modal-close]').forEach(function(b) {
            b.addEventListener('click', function() {
                closeModal('chk-add-modal');
                closeModal('chk-custom-modal');
            });
        });

        var addSelBtn = document.getElementById('chk-modal-add-selected');
        if (addSelBtn) addSelBtn.addEventListener('click', addSelectedFromModal);

        var saveCustomBtn = document.getElementById('chk-custom-save');
        if (saveCustomBtn) saveCustomBtn.addEventListener('click', saveCustom);
    }

    // ─── 유틸 ───
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
            return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
        });
    }
    function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }
    function setText(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
    function toast(msg) {
        var t = document.getElementById('toast');
        if (!t) { console.log(msg); return; }
        t.textContent = msg;
        t.classList.add('show');
        setTimeout(function() { t.classList.remove('show'); }, 2400);
    }
    function debounce(fn, ms) {
        var t;
        return function() {
            var args = arguments;
            clearTimeout(t);
            t = setTimeout(function() { fn.apply(null, args); }, ms);
        };
    }

    // ─── 초기화 ───
    function init() {
        if (!document.getElementById('chk-table-body')) return;
        seedInitial();
        renderTabs();
        renderTable();
        bindSelectAll();
        bindActions();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 공개 API
    window.RskChecklist = { init: init, getData: function() { return checklist; } };
})();
