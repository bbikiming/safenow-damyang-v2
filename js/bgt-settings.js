/* =========================================================================
 * 담양군 중대재해예방 통합관리시스템 v2 — 예산 기준 설정 (BGT02-S)
 * 대메뉴: 예산관리 > 예산 기준 설정
 *   섹션 A (R1): 예산편성 및 관리 원칙·준수사항 수립 — 원칙 문서 등록·개정 이력 관리
 *   섹션 B (R3): 시설·장비·안전장구류 등 예방관련 예산 항목 설정 — depth 무제한 트리
 *   섹션 C (REQ-A, 3차): 점검 대상 관리 — 조직도(기관)·대상 관리(시설) 연계 선택 팝업
 * 데이터 레이어: window.DYBGT (js/bgt.js, 병렬 작업) — items/policies/targets CRUD 전담.
 * 전역 네임스페이스: DYBGTSET (onclick 핸들러 노출용)
 * ========================================================================= */
(function () {
    'use strict';

    const V = window.DYV2;
    const esc = V.esc;

    /* 인라인 트리 입력 상태 — 한 시점에 1개 인라인 입력만 열림 (모달 아님, 트리 노드 아래 펼침) */
    let openInline = null; // { mode: 'add-root' | 'add-child' | 'edit', parentId, itemId }

    /* 섹션 C 선택 팝업에서 체크된 이름 집합 — 팝업 열려있는 동안만 유지 (모달은 항상 1개, DYV2.openModal/closeModal) */
    let pickerChecked = null; // Set<string> | null

    /* ── 섹션 A: 편성·관리 원칙 및 준수사항 (R1) ── */

    function renderSectionA() {
        const list = window.DYBGT.listPolicies();
        const cur = list[0];
        const history = list.slice(1);

        const curCard = cur
            ? '<div class="bgt-cur-card">' +
                '<div class="bgt-cur-title">' + esc(cur.title) + '</div>' +
                '<div class="bgt-cur-meta">시행일 ' + esc(cur.effective || '-') + ' <span class="fh-sep">·</span> 등록(수정)일 ' + esc(cur.updated || '-') + '</div>' +
                (cur.files && cur.files.length
                    ? '<div class="bgt-file-chips">' + cur.files.map(f => '<span class="chip-mini wt">' + esc(f) + '</span>').join('') + '</div>'
                    : '') +
                '<div class="bgt-cur-body">' + esc(cur.body || '') + '</div>' +
            '</div>'
            : '<div class="v2-empty">등록된 원칙 문서가 없습니다.<br><span style="font-size:12px;">[원칙 등록·개정] 버튼으로 최초 문서를 등록하세요.</span></div>';

        const histRows = history.map(p =>
            '<tr>' +
                '<td>' + esc(p.title) + '</td>' +
                '<td>' + esc(p.effective || '-') + '</td>' +
                '<td>' + esc(p.updated || '-') + '</td>' +
                '<td>' +
                    '<button class="btn btn-sm btn-outline" onclick="DYBGTSET.openPolicyModal(\'' + esc(p.id) + '\')">수정</button> ' +
                    '<button class="btn btn-sm btn-outline" onclick="DYBGTSET.removePolicy(\'' + esc(p.id) + '\')">삭제</button>' +
                '</td>' +
            '</tr>').join('');

        return (
            '<div class="card" style="margin-bottom:18px;">' +
                '<div class="card-header">' +
                    '<span class="card-title">편성·관리 원칙 및 준수사항</span>' +
                    '<button class="btn btn-primary btn-sm" onclick="DYBGTSET.openPolicyModal()">원칙 등록·개정</button>' +
                '</div>' +
                '<div class="card-body">' +
                    curCard +
                    (cur && !history.length
                        ? '<p style="font-size:12px; color:var(--text-gray); margin-top:14px;">개정 이력이 없습니다. 최초 등록 문서가 현행본입니다.</p>'
                        : '') +
                    (history.length
                        ? '<div style="margin-top:18px;"><div style="font-size:13px; font-weight:700; color:var(--main-dark2); margin-bottom:8px;">개정 이력</div>' +
                          '<div style="overflow-x:auto;"><table class="table-figma">' +
                              '<thead><tr><th>제목</th><th>시행일</th><th>등록(수정)일</th><th>관리</th></tr></thead>' +
                              '<tbody>' + histRows + '</tbody>' +
                          '</table></div></div>'
                        : '') +
                    (!cur
                        ? '<div style="margin-top:14px;"><table class="table-figma"><thead><tr><th>제목</th><th>시행일</th><th>등록(수정)일</th><th>관리</th></tr></thead><tbody><tr><td colspan="4" style="text-align:center; color:var(--text-gray);">이력 없음</td></tr></tbody></table></div>'
                        : '') +
                '</div>' +
            '</div>'
        );
    }

    /* 원칙 등록·개정 모달 — 단일 모달 규칙: DYV2.openModal/closeModal만 사용 */
    function openPolicyModal(id) {
        const list = window.DYBGT.listPolicies();
        const editing = id ? list.find(p => p.id === id) : null;
        const title = editing ? editing.title : '';
        const effective = editing ? (editing.effective || '') : '';
        const body = editing ? (editing.body || '') : '';
        const files = editing && editing.files ? editing.files : [];

        const bodyHtml =
            '<div class="preset-form-grid">' +
                '<span class="k">제목<span style="color:var(--status-danger-fg);">*</span></span>' +
                '<input id="bgtp-title" type="text" value="' + esc(title) + '" placeholder="예: 2026년 안전보건 예산편성 및 관리 원칙">' +
                '<span class="k">시행일<span style="color:var(--status-danger-fg);">*</span></span>' +
                '<input id="bgtp-effective" type="date" value="' + esc(effective) + '">' +
                '<span class="k">주요 내용</span>' +
                '<textarea id="bgtp-body" rows="6" placeholder="예산편성 원칙·집행 준수사항 등을 입력하세요">' + esc(body) + '</textarea>' +
            '</div>' +
            '<div style="margin-top:14px;">' +
                '<div style="font-size:13px; font-weight:600; margin-bottom:6px;">첨부파일</div>' +
                '<div class="upload-drop" onclick="DYV2.toast(\'파일 첨부 (프로토타입)\')">파일을 끌어다 놓거나 클릭하여 업로드</div>' +
                V.fileHint() +
                (files.length ? '<div class="bgt-file-chips" style="margin-top:8px;">' + files.map(f => '<span class="chip-mini wt">' + esc(f) + '</span>').join('') + '</div>' : '') +
            '</div>';

        const footHtml =
            '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" onclick="DYBGTSET.savePolicy(' + (editing ? '\'' + esc(editing.id) + '\'' : 'null') + ')">저장</button>';

        V.openModal(editing ? '원칙 문서 수정' : '원칙 등록·개정', bodyHtml, footHtml);
    }

    function savePolicy(id) {
        const titleEl = document.getElementById('bgtp-title');
        const effEl = document.getElementById('bgtp-effective');
        const bodyEl = document.getElementById('bgtp-body');
        const title = (titleEl && titleEl.value || '').trim();
        const effective = (effEl && effEl.value || '').trim();
        const body = (bodyEl && bodyEl.value || '').trim();

        if (!title) { V.toast('제목을 입력하세요.'); return; }
        if (!effective) { V.toast('시행일을 입력하세요.'); return; }

        const existing = id ? window.DYBGT.listPolicies().find(p => p.id === id) : null;
        window.DYBGT.savePolicy({
            id: id || undefined,
            title, effective, body,
            files: existing ? existing.files : [],
        });
        V.closeModal();
        V.toast(id ? '원칙 문서가 수정되었습니다.' : '원칙 문서가 개정 등록되었습니다.');
        renderAll();
    }

    function removePolicy(id) {
        window.DYBGT.removePolicy(id);
        V.toast('원칙 문서가 삭제되었습니다. (프로토타입)');
        renderAll();
    }

    /* ── 섹션 B: 예방관련 예산 항목 설정 (R3) — depth 무제한 트리, 인라인 추가/수정 ── */

    function renderSectionB() {
        const roots = window.DYBGT.itemChildren(null);
        const groups = roots.map((it, i) =>
            '<div class="bgt-tree-group">' + renderNode(it, 0, [i === roots.length - 1]) + '</div>'
        ).join('');
        return (
            '<div class="card">' +
                '<div class="card-header">' +
                    '<span class="card-title">예방관련 예산 항목</span>' +
                    '<button class="btn btn-primary btn-sm" onclick="DYBGTSET.openInline(\'add-root\', null)">+ 대분류 추가</button>' +
                '</div>' +
                '<div class="card-body">' +
                    '<div class="bgt-note">' +
                        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
                        '<span>예방관련 예산 항목을 트리로 관리합니다. 하위 항목은 깊이 제한 없이 추가할 수 있으며, 점검표에서 사용 중인 항목은 삭제할 수 없습니다.</span>' +
                    '</div>' +
                    '<div class="bgt-tree" id="bgt-tree">' +
                        (openInline && openInline.mode === 'add-root' ? renderRootForm() : '') +
                        (roots.length ? groups : '<div class="v2-empty">등록된 항목이 없습니다. [+ 대분류 추가]로 시작하세요.</div>') +
                    '</div>' +
                '</div>' +
            '</div>'
        );
    }

    /* depth 만큼 가이드 셀(엘보 커넥터)을 렌더한다.
     * trail: 조상별 '마지막 자식 여부' 배열(현재 노드 포함, 길이 = depth+1).
     * 마지막 원소(자기 자신) → 엘보 셀, 그 앞 조상들 → 세로선(마지막 자식 아니면) 또는 빈 셀. */
    function guideCells(trail) {
        if (!trail.length) return '';
        let out = '';
        for (let i = 0; i < trail.length; i++) {
            const isSelfCell = i === trail.length - 1;
            if (isSelfCell) {
                out += '<span class="bgt-tg bgt-tg--elbow' + (trail[i] ? ' is-last' : '') + '"></span>';
            } else {
                /* 조상 세로선: 그 조상이 마지막 자식이 아니면 풀하이트 세로선 */
                out += '<span class="bgt-tg' + (trail[i] ? '' : ' bgt-tg--line') + '"></span>';
            }
        }
        return out;
    }

    /* 재귀 트리 노드 렌더 — depth 무제한. 엘보 커넥터 + 레벨 타이포.
     * trail: 조상별 isLast 배열(현재 노드 포함). depth 0 = 그룹 헤더 행(커넥터 없음). */
    function renderNode(item, depth, trail) {
        const children = window.DYBGT.itemChildren(item.id);
        const used = window.DYBGT.itemUsed(item.id);
        const isEditing = openInline && openInline.mode === 'edit' && openInline.itemId === item.id;
        const isAddingChild = openInline && openInline.mode === 'add-child' && openInline.parentId === item.id;
        const isRoot = depth === 0;
        const hasKids = children.length > 0;

        const nameCls = isRoot
            ? 'bgt-tname is-root-name'
            : ('bgt-tname' + (hasKids ? ' is-group' : ''));

        const row = isEditing
            ? renderInlineForm(depth, trail, item)
            : (
                '<div class="bgt-trow' + (isRoot ? ' is-root' : '') + '">' +
                    (isRoot ? '' : guideCells(trail)) +
                    '<div class="bgt-trow-main">' +
                        '<span class="' + nameCls + '">' + esc(item.name) + '</span>' +
                        (isRoot && hasKids ? '<span class="chip-mini wt bgt-count">하위 ' + children.length + '</span>' : '') +
                        (used ? '<span class="chip-mini st-doing">사용 중</span>' : '') +
                        '<span class="bgt-trow-actions">' +
                            '<button class="btn btn-sm btn-outline" onclick="DYBGTSET.openInline(\'add-child\', \'' + esc(item.id) + '\')">+ 하위</button>' +
                            '<button class="btn btn-sm btn-outline" onclick="DYBGTSET.openInline(\'edit\', null, \'' + esc(item.id) + '\')">수정</button>' +
                            '<button class="btn btn-sm btn-outline" onclick="DYBGTSET.removeItem(\'' + esc(item.id) + '\')">삭제</button>' +
                        '</span>' +
                    '</div>' +
                '</div>'
            );

        /* 하위 추가 폼: 새 자식은 항상 목록 끝에 붙으므로 마지막 자식(trail 끝 true)로 정렬 */
        const childForm = isAddingChild ? renderInlineForm(depth + 1, trail.concat(true)) : '';

        const kidsHtml = children.map((c, ci) =>
            renderNode(c, depth + 1, trail.concat(ci === children.length - 1))
        ).join('');

        return row + kidsHtml + childForm;
    }

    /* 인라인 추가/수정 입력 — 모달 금지. 트리 행과 동일 가이드 셀로 들여쓰기 정렬.
     * trail: 이 폼 위치의 조상 isLast 배열(현재 위치 포함). */
    function renderInlineForm(depth, trail, editingItem) {
        const val = editingItem ? esc(editingItem.name) : '';
        const placeholder = editingItem ? '' : (depth === 0 ? '대분류명 입력' : '하위 항목명 입력');
        return (
            '<div class="bgt-trow is-form">' +
                (depth === 0 ? '' : guideCells(trail)) +
                '<div class="bgt-trow-form">' +
                    '<input id="bgt-inline-input" type="text" value="' + val + '" placeholder="' + placeholder + '" onkeydown="if(event.key===\'Enter\')DYBGTSET.confirmInline(); if(event.key===\'Escape\')DYBGTSET.cancelInline();">' +
                    '<button class="btn btn-sm btn-primary" onclick="DYBGTSET.confirmInline()">확인</button>' +
                    '<button class="btn btn-sm btn-outline" onclick="DYBGTSET.cancelInline()">취소</button>' +
                '</div>' +
            '</div>'
        );
    }

    /* 대분류 추가 폼 — 그룹 박스 밖(트리 상단) 별도 박스. 커넥터 없음. */
    function renderRootForm() {
        return (
            '<div class="bgt-tree-rootform">' +
                '<input id="bgt-inline-input" type="text" placeholder="대분류명 입력" onkeydown="if(event.key===\'Enter\')DYBGTSET.confirmInline(); if(event.key===\'Escape\')DYBGTSET.cancelInline();">' +
                '<button class="btn btn-sm btn-primary" onclick="DYBGTSET.confirmInline()">확인</button>' +
                '<button class="btn btn-sm btn-outline" onclick="DYBGTSET.cancelInline()">취소</button>' +
            '</div>'
        );
    }

    function openInlineFn(mode, parentId, itemId) {
        openInline = { mode, parentId: parentId || null, itemId: itemId || null };
        renderAll();
        const input = document.getElementById('bgt-inline-input');
        if (input) { input.focus(); input.select(); }
    }

    function cancelInline() {
        openInline = null;
        renderAll();
    }

    function confirmInline() {
        const input = document.getElementById('bgt-inline-input');
        const name = (input && input.value || '').trim();
        if (!name) { V.toast('항목명을 입력하세요.'); return; }
        if (!openInline) return;

        let result;
        if (openInline.mode === 'edit') {
            result = window.DYBGT.renameItem(openInline.itemId, name);
        } else {
            result = window.DYBGT.addItem(openInline.parentId, name);
        }

        if (!result || result.ok === false) {
            V.toast((result && result.msg) || '처리할 수 없습니다.');
            return;
        }
        openInline = null;
        V.toast('저장되었습니다.');
        renderAll();
    }

    function removeItemFn(id) {
        const result = window.DYBGT.removeItem(id);
        if (!result || result.ok === false) {
            V.toast((result && result.msg) || '삭제할 수 없습니다.');
            return;
        }
        V.toast('항목이 삭제되었습니다.');
        renderAll();
    }

    /* REQ-A(3차): 점검 대상 — 조직도·대상 관리 연계 선택 */
    /* ── 섹션 C: 점검 대상 관리 — 기관(조직도)·시설(대상 관리) 연계 선택 팝업 ──
     * 데이터 계약(js/bgt.js, 병렬 작업):
     *   listSources(type) → 기관 [{name, meta:'구성원 N명'}] / 시설 [{name, cls, grade}]
     *   addTargetsFromSource(type, names[]) → { ok, added, skipped }
     *   listTargets(type) / removeTarget(type,id) / targetUsed(name) — 유지
     * 제거된 API(호출 금지): addTarget, syncFMS */

    function renderSectionC() {
        return (
            '<div class="card" style="margin-top:18px;">' +
                '<div class="card-header">' +
                    '<span class="card-title">점검 대상 관리</span>' +
                '</div>' +
                '<div class="card-body">' +
                    '<div class="bgt-note">' +
                        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
                        '<span>점검 대상은 조직도(기관)와 대상 관리(시설물)에서 선택해 추가합니다. 시설물 현황은 대상 관리 메뉴에서 FMS 연계로 자동 현행화되며, 점검표에서 사용 중인 대상은 삭제할 수 없습니다.</span>' +
                    '</div>' +
                    '<div class="bgt-target-grid">' +
                        renderTargetBlock('기관') +
                        renderTargetBlock('시설') +
                    '</div>' +
                '</div>' +
            '</div>'
        );
    }

    function renderTargetBlock(type) {
        const list = window.DYBGT.listTargets(type);
        const isFac = type === '시설';
        const headerLabel = isFac ? '대상 관리(FMS) 연계' : '조직도 연계';
        const addLabel = isFac ? '+ 시설 추가' : '+ 기관 추가';

        const rows = list.length
            ? list.map(t => renderTargetRow(type, t)).join('')
            : '<div class="v2-empty" style="padding:16px;">[+ 추가]로 ' + (isFac ? '대상 관리' : '조직도') + '에서 선택하세요.</div>';

        return (
            '<div class="bgt-target-block">' +
                '<div class="bgt-target-block-header">' +
                    '<span class="bgt-target-block-title">' + esc(type) + ' <span class="chip-mini wt">' + esc(headerLabel) + '</span></span>' +
                    '<div class="bgt-target-block-actions">' +
                        '<button class="btn btn-sm btn-primary" onclick="DYBGTSET.openTargetPicker(\'' + esc(type) + '\')">' + esc(addLabel) + '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="bgt-target-list">' +
                    rows +
                '</div>' +
            '</div>'
        );
    }

    function renderTargetRow(type, t) {
        const isFac = type === '시설';
        /* targetUsed는 id가 아닌 이름(name)으로 점검표 target 필드와 매칭한다 (js/bgt.js 데이터 계약) */
        const used = window.DYBGT.targetUsed ? window.DYBGT.targetUsed(t.name) : false;
        return (
            '<div class="bgt-target-row">' +
                '<span class="bgt-target-name">' + esc(t.name) + '</span>' +
                (isFac
                    ? '<span class="chip-mini wt">' + esc(t.cls || '-') + '</span><span class="chip-mini wt">' + esc(t.grade ? t.grade + '등급' : '-') + '</span>'
                    : '') +
                (used ? '<span class="chip-mini st-doing">사용 중</span>' : '') +
                '<span class="bgt-target-row-actions">' +
                    '<button class="btn btn-sm btn-outline" onclick="DYBGTSET.removeTarget(\'' + esc(type) + '\',\'' + esc(t.id) + '\')">삭제</button>' +
                '</span>' +
            '</div>'
        );
    }

    function removeTargetFn(type, id) {
        const result = window.DYBGT.removeTarget(type, id);
        if (!result || result.ok === false) {
            V.toast((result && result.msg) || '삭제할 수 없습니다.');
            return;
        }
        V.toast((result && result.msg) || '삭제되었습니다.');
        renderAll();
    }

    /* ── 선택 팝업 (단일 모달 — DYV2.openModal 1개, 기관·시설 공용 렌더) ── */

    function openTargetPicker(type) {
        if (!window.DYBGT.listSources) {
            V.toast('연계 원본을 아직 불러올 수 없습니다. (데이터 연계 준비 중)');
            return;
        }
        pickerChecked = new Set();
        const title = type === '시설' ? '시설물 선택 — 대상 관리 연계' : '기관 선택 — 조직도';
        const bodyHtml =
            '<div class="org-inline" id="bgt-picker-panel" data-type="' + esc(type) + '">' +
                '<div class="org-inline-search"><input type="text" placeholder="이름 검색" oninput="DYBGTSET.filterPicker(this)"></div>' +
                '<div class="org-inline-body" id="bgt-picker-body">' + renderPickerRows(type, '') + '</div>' +
            '</div>';
        const footHtml =
            '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" id="bgt-picker-confirm" onclick="DYBGTSET.confirmPicker()">선택 추가 (0건)</button>';
        V.openModal(title, bodyHtml, footHtml);
    }

    function renderPickerRows(type, query) {
        const sources = window.DYBGT.listSources(type) || [];
        const already = new Set(window.DYBGT.listTargets(type).map(t => t.name));
        const q = (query || '').trim().toLowerCase();
        const filtered = sources.filter(s => !q || String(s.name || '').toLowerCase().indexOf(q) !== -1);

        if (!filtered.length) {
            return '<div class="v2-empty" style="padding:16px;">검색 결과가 없습니다.</div>';
        }

        return filtered.map(s => {
            const registered = already.has(s.name);
            const checked = registered || (pickerChecked && pickerChecked.has(s.name));
            const meta = type === '시설'
                ? '<span class="chip-mini wt">' + esc(s.cls || '-') + '</span><span class="chip-mini wt">' + esc(s.grade ? s.grade + '등급' : '-') + '</span>'
                : '<span class="chip-mini wt">' + esc(s.meta || '') + '</span>';
            return (
                '<label class="bgt-picker-row' + (registered ? ' is-disabled' : '') + '">' +
                    '<input type="checkbox" value="' + esc(s.name) + '"' +
                        (checked ? ' checked' : '') + (registered ? ' disabled' : '') +
                        ' onchange="DYBGTSET.togglePicker(this)">' +
                    '<span class="bgt-picker-name">' + esc(s.name) + '</span>' +
                    meta +
                    (registered ? '<span class="chip-mini st-doing">등록됨</span>' : '') +
                '</label>'
            );
        }).join('');
    }

    function filterPicker(inputEl) {
        const panel = inputEl.closest('.org-inline');
        const type = panel.getAttribute('data-type');
        const body = document.getElementById('bgt-picker-body');
        if (body) body.innerHTML = renderPickerRows(type, inputEl.value);
    }

    function togglePicker(cbEl) {
        if (!pickerChecked) return;
        if (cbEl.checked) pickerChecked.add(cbEl.value);
        else pickerChecked.delete(cbEl.value);
        const btn = document.getElementById('bgt-picker-confirm');
        if (btn) btn.textContent = '선택 추가 (' + pickerChecked.size + '건)';
    }

    function confirmPicker() {
        const panel = document.getElementById('bgt-picker-panel');
        const type = panel ? panel.getAttribute('data-type') : null;
        if (!type || !pickerChecked || !pickerChecked.size) {
            V.toast('추가할 대상을 선택하세요.');
            return;
        }
        const names = Array.from(pickerChecked);
        const result = window.DYBGT.addTargetsFromSource(type, names);
        if (!result || result.ok === false) {
            V.toast((result && result.msg) || '추가할 수 없습니다.');
            return;
        }
        pickerChecked = null;
        V.closeModal();
        V.toast((result.added || 0) + '건이 추가되었습니다.');
        renderAll();
    }

    /* ── 전체 렌더 ──
     * 세 섹션을 독립적으로 try/catch — 데이터 레이어(js/bgt.js, 병렬 작업) API가 아직
     * 일부 미구현이어도 한쪽 섹션 렌더 실패가 다른 섹션까지 백지로 만들지 않도록 방어. */
    function renderAll() {
        const a = document.getElementById('bgt-section-a');
        const b = document.getElementById('bgt-section-b');
        const c = document.getElementById('bgt-section-c');
        if (a) {
            try { a.innerHTML = renderSectionA(); }
            catch (e) { a.innerHTML = '<div class="v2-empty">편성·관리 원칙 영역을 불러오지 못했습니다. (' + esc(e.message) + ')</div>'; }
        }
        if (b) {
            try { b.innerHTML = renderSectionB(); }
            catch (e) { b.innerHTML = '<div class="v2-empty">예방관련 예산 항목 영역을 불러오지 못했습니다. (' + esc(e.message) + ')</div>'; }
        }
        if (c) {
            try { c.innerHTML = renderSectionC(); }
            catch (e) { c.innerHTML = '<div class="v2-empty">점검 대상 관리 영역을 불러오지 못했습니다. (' + esc(e.message) + ')</div>'; }
        }
    }

    window.DYBGTSET = {
        openPolicyModal, savePolicy, removePolicy,
        openInline: openInlineFn, cancelInline, confirmInline, removeItem: removeItemFn,
        removeTarget: removeTargetFn,
        openTargetPicker, filterPicker, togglePicker, confirmPicker,
        render: renderAll,
    };

    document.addEventListener('DOMContentLoaded', renderAll);
    if (document.readyState === 'complete' || document.readyState === 'interactive') renderAll();
})();
