/* =====================================================================
   org-pick.js · 공용 인라인 조직도 선택기 (ORGPICK)
   ---------------------------------------------------------------------
   입력 필드 아래에 조직도(DYV2.ORG) 트리를 펼쳐 부서/담당자를 고른다.
   별도 모달을 띄우지 않고 현재 모달 본문 안 인라인 패널로 동작(CLAUDE.md §1 단일 모달).

   [토글형] 입력 필드 옆 [조직도] 버튼으로 펼침 — 고르면 패널이 닫힌다.
   · mode 'dept'   — 부서 선택, 부서'명' 반환   → onpick(부서명)
   · mode 'deptId' — 부서 선택, 부서'id' 반환   → onpick(deptId, 부서명)
   · mode 'member' — 담당자 선택               → onpick('부서 · 역할 / 이름')
   사용: ORGPICK.toggle(fieldElementId, mode, '전역함수경로')
        예) ORGPICK.toggle('we-n-deptfield', 'dept', 'WENV.pickDept')

   [상시 노출형] 트리 자체가 본문인 곳(마법사 STEP 등) — 부서 다중 선택.
   사용: ORGPICK.deptsPanel(panelId, opts) 로 HTML 을 얻어 본문에 심는다.
        예) ORGPICK.deptsPanel('rl-w-orgtree', { selectedPath:'RSKLIST.wizSelDepts',
              onToggle:'RSKLIST.wizToggleDept', countId:'rl-w-cnt', allckId:'rl-w-allck' })

   ※ 'dept'(이름 반환)와 'deptId'(id 반환)가 나뉜 이유 — 부서를 부서명으로 저장하는 도메인
     (작업환경측정·건강검진)과 deptId 로 저장하는 도메인(위험성평가·안전보건교육)이 공존한다.
     전자는 DYV2.orgFlat(), 후자는 DYV2.orgDepts() 파생을 쓴다(둘 다 DYV2.ORG 단일 출처).
   전역: ORGPICK.*  (js/common.js 뒤에 로드)
   ===================================================================== */
(function (global) {
    'use strict';

    function V() { return global.DYV2; }
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function resolve(path) { return String(path || '').split('.').reduce(function (o, k) { return o && o[k]; }, global); }

    /* 공통 조직도 트리(.otr-*) 마크업 재사용 — 전자문서 점검자·회의록 참석자 픽커와 동일 GUI.
       데이터는 공통 파생 DYV2.orgFlat() = [{dept, members:[[role,name],...]}]. */
    function emptyRow() { return '<div style="padding:10px;color:var(--text-lightgray);font-size:12px;">검색 결과 없음</div>'; }

    /* 부서 선택 — 공통 트리의 부서 노드(.otr-dept)를 그대로 쓰되 부서 헤더 클릭 = 선택(하위 미확장) */
    function deptTree(q) {
        q = (q || '').trim();
        var rows = V().orgFlat().filter(function (d) { return !q || d.dept.indexOf(q) !== -1; }).map(function (d) {
            return '<div class="otr-dept" data-dept="' + esc(d.dept) + '">' +
                '<button type="button" class="otr-deptbtn" onclick="ORGPICK._pick(this,\'' + esc(d.dept) + '\')">' +
                    esc(d.dept) + ' <span class="otr-count">' + d.members.length + '명</span></button>' +
                '</div>';
        }).join('');
        return '<div class="org-tree-root">담양군청</div>' + (rows || emptyRow());
    }

    /* 부서 선택(id 반환) — deptTree 와 동일 GUI, 콜백만 (id, name) */
    function deptIdTree(q) {
        q = (q || '').trim();
        var rows = V().orgDepts().filter(function (d) { return !q || d.name.indexOf(q) !== -1; }).map(function (d) {
            return '<div class="otr-dept" data-dept="' + esc(d.name) + '">' +
                '<button type="button" class="otr-deptbtn" onclick="ORGPICK._pickId(this,\'' + esc(d.id) + '\',\'' + esc(d.name) + '\')">' +
                    esc(d.name) + ' <span class="otr-count">' + d.count + '명</span></button>' +
                '</div>';
        }).join('');
        return '<div class="org-tree-root">담양군청</div>' + (rows || emptyRow());
    }

    /* 부서 다중 선택 — 같은 트리에 체크박스 행(.otr-ckrow). 선택해도 패널이 닫히지 않는다. */
    function deptsTree(q, selected) {
        q = (q || '').trim();
        selected = selected || {};
        var rows = V().orgDepts().filter(function (d) { return !q || d.name.indexOf(q) !== -1; }).map(function (d) {
            return '<div class="otr-dept" data-dept="' + esc(d.name) + '">' +
                '<label class="otr-ckrow">' +
                    '<input type="checkbox" data-deptid="' + esc(d.id) + '"' + (selected[d.id] ? ' checked' : '') +
                        ' onchange="ORGPICK._deptsCheck(this)">' +
                    '<span class="otr-ckname">' + esc(d.name) + '</span>' +
                    '<span class="otr-count">' + d.count + '명</span>' +
                '</label>' +
                '</div>';
        }).join('');
        return '<div class="org-tree-root">담양군청</div>' + (rows || emptyRow());
    }

    /* 담당자 선택 — 공통 트리와 동일(부서 접힘/펼침 → 구성원 선택) */
    function memberTree(q) {
        q = (q || '').trim();
        var out = V().orgFlat().map(function (d) {
            var mrows = d.members.filter(function (m) { return !q || d.dept.indexOf(q) !== -1 || (m[0] + m[1]).indexOf(q) !== -1; });
            if (q && !mrows.length) return '';
            var openStyle = q ? ' style="display:block;"' : '';
            var arrow = q ? '▾' : '▸';
            return '<div class="otr-dept" data-dept="' + esc(d.dept) + '">' +
                '<button type="button" class="otr-deptbtn" onclick="ORGPICK._toggle(this)"><span class="otr-arrow">' + arrow + '</span> ' +
                    esc(d.dept) + ' <span class="otr-count">' + d.members.length + '명</span></button>' +
                '<div class="otr-members"' + openStyle + '>' +
                mrows.map(function (m) {
                    var val = d.dept + ' · ' + m[0] + ' / ' + m[1];
                    return '<button type="button" class="otr-member" onclick="ORGPICK._pick(this,\'' + esc(val) + '\')">' +
                        '<span class="otr-role">' + esc(m[0]) + '</span><span class="otr-name">' + esc(m[1]) + '</span></button>';
                }).join('') +
                '</div></div>';
        }).join('');
        return '<div class="org-tree-root">담양군청</div>' + (out || emptyRow());
    }

    function body(mode, q) {
        if (mode === 'member') return memberTree(q);
        if (mode === 'deptId') return deptIdTree(q);
        return deptTree(q);
    }
    /* 공통 트리 접힘/펼침 토글(EDOC._orgToggle 와 동일 동작) */
    function _toggle(btn) {
        var m = btn.nextElementSibling; if (!m) return;
        var open = m.style.display === 'block';
        m.style.display = open ? 'none' : 'block';
        var ar = btn.querySelector('.otr-arrow'); if (ar) ar.textContent = open ? '▸' : '▾';
    }

    function toggle(fieldId, mode, onpick) {
        var field = document.getElementById(fieldId); if (!field) return;
        var existing = field.querySelector(':scope > .org-inline');
        if (existing) { existing.remove(); return; }
        var panel = document.createElement('div');
        panel.className = 'org-inline';
        panel.style.marginTop = '8px';
        panel.setAttribute('data-mode', mode || 'dept');
        panel.setAttribute('data-onpick', onpick || '');
        panel.innerHTML =
            '<div class="org-inline-search"><input type="text" placeholder="' + (mode === 'member' ? '이름·부서 검색' : '부서 검색') + '" oninput="ORGPICK._filter(this)"></div>' +
            '<div class="org-inline-body">' + body(mode || 'dept', '') + '</div>';
        field.appendChild(panel);
        panel.scrollIntoView({ block: 'nearest' });
    }

    /* ── 부서 다중 선택 패널 (상시 노출형) ──────────────────────────────
     * 토글형과 달리 항상 떠 있고 선택해도 닫히지 않는다(js/doc-register.js ownerBlock 과 같은 결).
     *   opts.selectedPath : 전역 함수 경로 — 호출 시 {deptId:true} 현재 선택 맵 반환
     *   opts.onToggle     : 전역 함수 경로 — fn(deptId, checked)
     *   opts.countId      : 선택 개수를 표시할 엘리먼트 id (체크 시 자동 갱신)
     *   opts.allckId      : 전체선택 체크박스 id (부분 선택 시 indeterminate 로 자동 동기화)
     * 호출측은 onToggle 에서 상태만 갱신하고 재렌더하지 않는다 — 패널을 다시 그리면
     * 검색어·스크롤 위치가 날아가므로 카운트/전체선택 동기화는 이 모듈이 인플레이스로 처리한다. */
    function deptsPanel(panelId, opts) {
        opts = opts || {};
        var sel = {};
        var fn = resolve(opts.selectedPath);
        if (typeof fn === 'function') sel = fn() || {};
        return '<div class="org-inline" id="' + panelId + '"' +
                ' data-selpath="' + esc(opts.selectedPath || '') + '"' +
                ' data-ontoggle="' + esc(opts.onToggle || '') + '"' +
                ' data-countid="' + esc(opts.countId || '') + '"' +
                ' data-allckid="' + esc(opts.allckId || '') + '">' +
            '<div class="org-inline-search"><input type="text" placeholder="부서 검색" oninput="ORGPICK._deptsFilter(this)"></div>' +
            '<div class="org-inline-body">' + deptsTree('', sel) + '</div>' +
        '</div>';
    }
    /* 선택 맵이 바깥에서 통째로 바뀐 뒤(전체선택/해제 등) 체크 상태만 다시 맞춘다 — 검색어·스크롤 보존 */
    function refreshDepts(panelId) {
        var panel = document.getElementById(panelId); if (!panel) return;
        var sel = {};
        var fn = resolve(panel.getAttribute('data-selpath'));
        if (typeof fn === 'function') sel = fn() || {};
        panel.querySelectorAll('input[data-deptid]').forEach(function (ck) {
            ck.checked = !!sel[ck.getAttribute('data-deptid')];
        });
        _syncDepts(panel, sel);
    }
    function _deptsFilter(inp) {
        var panel = inp.closest('.org-inline'); if (!panel) return;
        var sel = {};
        var fn = resolve(panel.getAttribute('data-selpath'));
        if (typeof fn === 'function') sel = fn() || {};
        var b = panel.querySelector('.org-inline-body');
        if (b) b.innerHTML = deptsTree(inp.value, sel);
    }
    function _deptsCheck(ck) {
        var panel = ck.closest('.org-inline'); if (!panel) return;
        var fn = resolve(panel.getAttribute('data-ontoggle'));
        if (typeof fn === 'function') fn(ck.getAttribute('data-deptid'), ck.checked);
        var sel = {};
        var sfn = resolve(panel.getAttribute('data-selpath'));
        if (typeof sfn === 'function') sel = sfn() || {};
        _syncDepts(panel, sel);
    }
    /* 선택 개수 배지 + 전체선택 체크박스(indeterminate) 동기화 — 검색으로 트리가 걸러져 있어도
     * 개수는 '검색 결과'가 아니라 전체 부서 기준이어야 하므로 selected 맵으로 센다. */
    function _syncDepts(panel, sel) {
        var total = V().orgDepts().length;
        var cnt = Object.keys(sel).filter(function (k) { return sel[k]; }).length;
        var cid = panel.getAttribute('data-countid');
        if (cid) { var cel = document.getElementById(cid); if (cel) cel.textContent = cnt; }
        var aid = panel.getAttribute('data-allckid');
        if (aid) {
            var ael = document.getElementById(aid);
            if (ael) { ael.checked = cnt === total && total > 0; ael.indeterminate = cnt > 0 && cnt < total; }
        }
    }
    function _filter(inp) {
        var panel = inp.closest('.org-inline'); if (!panel) return;
        var b = panel.querySelector('.org-inline-body');
        if (b) b.innerHTML = body(panel.getAttribute('data-mode'), inp.value);
    }
    function _pick(btn, value) {
        var panel = btn.closest('.org-inline'); if (!panel) return;
        var onpick = panel.getAttribute('data-onpick');
        panel.remove();
        var fn = resolve(onpick);
        if (typeof fn === 'function') fn(value);
    }
    function _pickId(btn, id, name) {
        var panel = btn.closest('.org-inline'); if (!panel) return;
        var onpick = panel.getAttribute('data-onpick');
        panel.remove();
        var fn = resolve(onpick);
        if (typeof fn === 'function') fn(id, name);
    }

    global.ORGPICK = {
        toggle: toggle, deptsPanel: deptsPanel, refreshDepts: refreshDepts,
        _filter: _filter, _pick: _pick, _pickId: _pickId, _toggle: _toggle,
        _deptsFilter: _deptsFilter, _deptsCheck: _deptsCheck,
        deptTree: deptTree, deptIdTree: deptIdTree, deptsTree: deptsTree, memberTree: memberTree,
    };
})(window);
