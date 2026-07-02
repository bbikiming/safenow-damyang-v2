/* =========================================================================
 * 안전보건관리체계 — 공통 대메뉴 화면 (v2.2 — 기획 v1 컨펌 반영: 버튼 실동작)
 *   탭: [업무 기능](기본) · [문서]
 *   모든 등록·점검·평가 버튼은 e-Doc 엔진(표준 폼 7종)을 호출한다.
 *   확정 시 온나라 결재 요청 팝업 1회 · 점검 X 항목 → 개선조치 자동 등록.
 *   위험성평가·유해·위험요인·안전보건교육은 전용 화면으로 리다이렉트.
 * ========================================================================= */
(function () {
    'use strict';
    const V = window.DYV2, E = window.EDOC, T = window.EDOC_T;
    const params = new URLSearchParams(location.search);
    const KEY = V.MENUS[params.get('m')] ? params.get('m') : 'policy';

    if (KEY === 'risk' || KEY === 'hazard' || KEY === 'edu') {
        location.replace(V.MENUS[KEY].href);
        return;
    }

    const META = V.MENUS[KEY];
    const MY_DOCS = V.byMenu(KEY);
    const esc = V.esc;
    const ST = V.statusChip;

    /* ── 헤더 ── */
    document.title = META.label + ' - 담양군 중대재해예방통합관리시스템 v2';
    document.getElementById('sbm-title').textContent = META.label;
    document.getElementById('sbm-subtitle').textContent =
        '안전보건관리체계 > ' + META.label + ' · ' + META.sfr + ' · 문서 ' + MY_DOCS.length + '건';

    /* ── 의견청취: 대메뉴 승격 — sub 파라미터로 3개 SNB 페이지 분기(voice/committee/council) ── */
    const OPN_SUB_MAP = { voice: '의견청취·건의함', committee: '산업안전보건위원회', council: '협의체·점검표' };
    let OPN_SUB = null;
    if (KEY === 'opinion') {
        OPN_SUB = params.get('sub');
        if (!OPN_SUB_MAP[OPN_SUB]) OPN_SUB = 'voice';
        const subLabel = OPN_SUB_MAP[OPN_SUB];
        document.title = subLabel + ' - 담양군 중대재해예방통합관리시스템 v2';
        document.getElementById('sbm-title').textContent = subLabel;
        document.getElementById('sbm-subtitle').textContent = '의견청취 > ' + subLabel + ' · ' + META.sfr;
    }

    /* ── 탭 ── */
    const tabs = document.querySelectorAll('#sbm-tabs .tab');
    function showTab(name) {
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
        document.querySelectorAll('[data-pane]').forEach(p => { p.style.display = p.dataset.pane === name ? '' : 'none'; });
    }
    tabs.forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
    if (params.get('tab') === 'docs') showTab('docs');

    /* ── 마크업 헬퍼 ── */
    function statboxes(items) {
        return '<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px; margin-bottom:16px;">' +
            items.map(([cls, num, label]) =>
                '<div class="statbox ' + cls + '"><div class="statbox-num">' + num + '</div><div class="statbox-label">' + label + '</div></div>').join('') + '</div>';
    }
    function tbl(heads, rows) {
        return '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr>' +
            heads.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' +
            rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
    }
    function sectionCard(title, body, actionsHtml) {
        return '<div class="card" style="margin-bottom:16px;"><div class="card-header"><span class="card-title">' + title + '</span>' +
            (actionsHtml || '') + '</div><div class="card-body">' + body + '</div></div>';
    }
    /* 상태 스테퍼 (안전나우 U1) */
    function stepper(flow, cur, rejected) {
        if (rejected) return '<span class="flow-step rejected">반려</span>';
        const i = flow.indexOf(cur);
        return '<span class="flow-stepper">' + flow.map((s, j) =>
            '<span class="flow-step ' + (j < i ? 'done' : j === i ? 'cur' : '') + '">' + s + '</span>' +
            (j < flow.length - 1 ? '<span class="flow-arrow">›</span>' : '')).join('') + '</span>';
    }
    /* e-Doc 상태 칩 (저장된 인스턴스가 있으면 표시) */
    function docStChip(id) {
        const st = E.statusOf(id);
        return st ? (E.STCHIP[st] || '') : '<span class="chip-mini wt">미작성</span>';
    }

    /* =====================================================================
     * 메뉴별 업무 기능 — 모든 버튼이 실동작 (window.PG 핸들러)
     * ===================================================================== */
    const PG = window.PG = {};

    const PROGRAM = {
        /* ── 경영방침 [SFR-005] 전면 재개편: 버전 목록형 3탭(경영방침/이행점검/게시 현황) + 상세(PDF 미리보기) + 등록(최초/제정/개정). 마스터(근거법령·고려사항·점검표·가이드 CRUD)는 상세에서 모달로 진입(RFP 유지). ── */
        policy() {
            /* ===== 마스터 데이터 (RFP CRUD — 상세 배지→모달) ===== */
            const LAWS = [
                ['중대재해처벌법 시행령', '제4조 1호', '안전보건 목표·경영방침 수립'],
                ['산업안전보건법', '제14조', '안전보건경영방침 설정·게시·주지'],
                ['산업안전보건법', '제15조', '안전보건관리책임자 지정'],
                ['산업안전보건법', '제24조', '산업안전보건위원회 운영'],
                ['산업안전보건법', '제36조', '위험성평가 시행'],
            ];
            const CONSIDER = [
                ['설정 시', '조직 규모·업종 특성에 맞는 목표 수준 설정'],
                ['설정 시', '전년도 재해·점검 결과를 목표에 반영'],
                ['공통', '종사자 의견을 수렴하여 목표·방침에 반영'],
                ['점검 시', '목표 대비 달성도와 미달 원인 분석'],
                ['점검 시', '법령 개정사항이 방침에 반영되었는지 확인'],
            ];
            const CHK = [
                ['목표·KPI', 'KPI 목표값 대비 달성 여부', 'O / X', '중처법 시행령 §4-1'],
                ['목표·KPI', '미달 KPI 원인 분석 수행', '텍스트', '중처법 시행령 §4-1'],
                ['조직·인력', '안전관리자 법정 인원 충족', 'O / X', '산안법 §17·§18'],
                ['위험성평가', '정기 위험성평가 시행률', 'O / X', '산안법 §36'],
                ['도급·협력', '도급업체 평가 적격률', 'O / X', '중처법 시행령 §4-9'],
                ['의견청취', '종사자 의견청취 정기 실시', 'O / X', '중처법 시행령 §4-7'],
            ];
            const GUIDE = [
                ['1', '경영방침 작성 원칙', '최고경영자(군수)의 안전보건 의지 표현 · 법규 준수·지속 개선 · 조직 특성 반영 · 전 종사자 이해 가능', '산업안전보건법 §14 · 중처법 시행령 §4-1'],
                ['2', '목표(KPI) 설정', '측정 가능·달성 가능(SMART) · 전년 재해·점검 결과 반영 · 산출식·집계주기·책임부서 명시', '중처법 시행령 §4-1'],
                ['3', '게시·주지 의무', '확정 후 전 종사자 게시·공지 · 도급·용역·위탁 종사자 주지 · 사업장 게시', '산업안전보건법 §14'],
                ['4', '점검·환류', '반기 1회 이상 적정성 점검 · 보완 시 개선조치 · 법령개정·조직변경 시 갱신 · 결과를 차기 목표 반영', '중처법 시행령 §4-1'],
            ];
            const subT = t => '<p style="font-size:12px; font-weight:700; color:var(--main-dark2); margin:0 0 8px;">' + t + '</p>';
            const delBtn = '<button class="btn btn-sm btn-outline" onclick="this.closest(\'tr\').remove(); DYV2.toast(\'삭제되었습니다\')">삭제</button>';

            /* 설정 가이드 모달 */
            PG.policyGuide = () => V.openModal('목표·경영방침 설정 가이드',
                '<div style="font-size:13px; line-height:1.7;">' + GUIDE.map(s =>
                    '<div style="display:flex; gap:10px; padding:10px 0; border-bottom:1px solid var(--card-line);">' +
                    '<span style="flex-shrink:0; width:24px; height:24px; border-radius:6px; background:var(--main); color:#fff; font-weight:700; display:flex; align-items:center; justify-content:center;">' + s[0] + '</span>' +
                    '<div><div style="font-weight:700; color:var(--main-dark2);">' + s[1] + '</div>' +
                    '<div style="color:var(--text-black);">' + s[2] + '</div>' +
                    '<div style="font-size:12px; color:var(--main); font-weight:600; margin-top:2px;">근거: ' + s[3] + '</div></div></div>').join('') + '</div>',
                '<button class="btn btn-primary" onclick="DYV2.closeModal()">확인</button>');

            /* 근거·고려사항 관리 모달 (CRUD) */
            PG.policyBasis = () => V.openModal('근거법령·고려사항 관리',
                subT('관련 근거·법령 ↔ 세부내용 매칭') +
                '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>법령</th><th>조항</th><th>세부내용</th><th></th></tr></thead><tbody id="policy-law-tbody">' +
                LAWS.map(r => '<tr><td><input value="' + r[0] + '" style="width:100%"></td><td><input value="' + r[1] + '" style="width:100%"></td><td><input value="' + r[2] + '" style="width:100%"></td><td>' + delBtn + '</td></tr>').join('') +
                '</tbody></table></div>' +
                '<button class="btn btn-sm btn-outline" style="margin-top:8px;" onclick="PG.policyLawAdd()">+ 법령 추가</button>' +
                '<div style="margin-top:16px;"></div>' + subT('설정·점검 고려사항') +
                '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>구분</th><th>고려사항</th><th></th></tr></thead><tbody id="policy-consider-tbody">' +
                CONSIDER.map(r => '<tr><td><select><option' + (r[0] === '설정 시' ? ' selected' : '') + '>설정 시</option><option' + (r[0] === '점검 시' ? ' selected' : '') + '>점검 시</option><option' + (r[0] === '공통' ? ' selected' : '') + '>공통</option></select></td><td><input value="' + r[1] + '" style="width:100%"></td><td>' + delBtn + '</td></tr>').join('') +
                '</tbody></table></div>' +
                '<button class="btn btn-sm btn-outline" style="margin-top:8px;" onclick="PG.policyConsiderAdd()">+ 고려사항 추가</button>',
                '<button class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
                '<button class="btn btn-primary" onclick="DYV2.closeModal(); DYV2.toast(\'근거·고려사항이 저장되었습니다\')">저장</button>');

            /* 점검표 관리 모달 (CRUD) — 관련 근거는 근거법령 사전(LAW_DICT)에서 선택 인용 */
            PG.policyChecklist = () => {
                const lawOpts = Object.keys(T.LAW_DICT || {}).map(k => '<option value="' + V.esc(k) + '">').join('');
                V.openModal('경영방침 점검표 관리',
                    '<datalist id="pol-law-list">' + lawOpts + '</datalist>' +
                    subT('점검 항목 · 결과유형(O/X·텍스트) · 관련 근거는 근거법령 사전에서 선택 인용합니다.') +
                    '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>영역</th><th>점검 항목</th><th>결과유형</th><th>관련 근거</th><th></th></tr></thead><tbody id="policy-chk-tbody">' +
                    CHK.map(r => '<tr><td><input value="' + r[0] + '" style="width:100%"></td><td><input value="' + r[1] + '" style="width:100%"></td><td><select><option' + (r[2] === 'O / X' ? ' selected' : '') + '>O / X</option><option' + (r[2] === '텍스트' ? ' selected' : '') + '>텍스트</option></select></td><td><input value="' + r[3] + '" list="pol-law-list" style="width:100%"></td><td>' + delBtn + '</td></tr>').join('') +
                    '</tbody></table></div>' +
                    '<button class="btn btn-sm btn-outline" style="margin-top:8px;" onclick="PG.policyChkItemAdd()">+ 점검 항목 추가</button>' +
                    '<p style="font-size:12px; color:var(--text-gray); margin-top:10px;">저장한 항목은 [이행점검 작성] 점검표에 사용됩니다. 관련 근거는 사전에 등록된 법령에서 선택되며, X 판정 항목은 확정 시 개선조치로 자동 등록됩니다.</p>',
                    '<button class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
                    '<button class="btn btn-primary" onclick="DYV2.closeModal(); DYV2.toast(\'점검표가 저장되었습니다\')">저장</button>');
            };

            /* '추가' 폼 — 단일 모달 규칙: 모달이 열려 있으면 모달 본문 안 인라인(.stack-inline)으로,
               모달이 없으면(페이지 위) 단일 오버레이로 표시(적층 방지). */
            PG._stackOpen = (title, body, foot) => {
                PG._stackClose();
                const host = document.querySelector('#v2-modal .modal-body');
                if (host) {
                    const panel = document.createElement('div');
                    panel.id = 'stack-inline'; panel.className = 'stack-inline';
                    panel.innerHTML =
                        '<div class="stack-inline-head"><span>' + title + '</span>' +
                        '<button type="button" class="modal-close" onclick="PG._stackClose()" aria-label="닫기">&times;</button></div>' +
                        '<div class="stack-inline-body">' + body + '</div>' +
                        '<div class="stack-inline-foot">' + foot + '</div>';
                    host.appendChild(panel);
                    panel.scrollIntoView({ block: 'nearest' });
                    const first = panel.querySelector('input, select'); if (first) first.focus();
                } else {
                    const ov = document.createElement('div');
                    ov.id = 'stack-overlay'; ov.className = 'org-tree-overlay';
                    ov.innerHTML = '<div class="org-tree-backdrop" onclick="PG._stackClose()"></div>' +
                        '<div class="org-tree-panel" role="dialog" aria-modal="true" style="max-width:460px;">' +
                        '<div class="org-tree-head"><span>' + title + '</span><button type="button" class="modal-close" onclick="PG._stackClose()" aria-label="닫기">&times;</button></div>' +
                        '<div class="org-tree-body" style="padding:18px 20px;">' + body + '</div>' +
                        '<div class="modal-footer">' + foot + '</div></div>';
                    document.body.appendChild(ov);
                }
            };
            PG._stackClose = () => { ['stack-inline', 'stack-overlay'].forEach(id => { const o = document.getElementById(id); if (o) o.remove(); }); };
            PG.policyLawAdd = () => PG._stackOpen('근거 법령 추가',
                '<div class="preset-form-grid">' +
                '<span class="k">법령</span><input id="law-add-law" type="text" placeholder="예: 산업안전보건법">' +
                '<span class="k">조항</span><input id="law-add-art" type="text" placeholder="예: 제36조">' +
                '<span class="k">세부내용</span><input id="law-add-detail" type="text" placeholder="방침 적용 세부내용">' +
                '</div>',
                '<button class="btn btn-secondary" onclick="PG._stackClose()">취소</button>' +
                '<button class="btn btn-primary" onclick="PG.policyLawAddSave()">등록</button>');
            PG.policyLawAddSave = () => {
                const law = (document.getElementById('law-add-law') || {}).value || '';
                const art = (document.getElementById('law-add-art') || {}).value || '';
                const detail = (document.getElementById('law-add-detail') || {}).value || '';
                const tb = document.getElementById('policy-law-tbody');
                if (tb) { const tr = document.createElement('tr'); tr.innerHTML = '<td><input value="' + V.esc(law) + '" style="width:100%"></td><td><input value="' + V.esc(art) + '" style="width:100%"></td><td><input value="' + V.esc(detail) + '" style="width:100%"></td><td>' + delBtn + '</td>'; tb.appendChild(tr); }
                PG._stackClose(); V.toast('근거 법령이 추가되었습니다');
            };
            PG.policyConsiderAdd = () => PG._stackOpen('고려사항 추가',
                '<div class="preset-form-grid">' +
                '<span class="k">구분</span><select id="con-add-type"><option>설정 시</option><option>점검 시</option><option>공통</option></select>' +
                '<span class="k">고려사항</span><input id="con-add-text" type="text" placeholder="고려사항 내용을 입력하세요">' +
                '</div>',
                '<button class="btn btn-secondary" onclick="PG._stackClose()">취소</button>' +
                '<button class="btn btn-primary" onclick="PG.policyConsiderAddSave()">등록</button>');
            PG.policyConsiderAddSave = () => {
                const ty = (document.getElementById('con-add-type') || {}).value || '설정 시';
                const tx = (document.getElementById('con-add-text') || {}).value || '';
                const tb = document.getElementById('policy-consider-tbody');
                if (tb) { const tr = document.createElement('tr'); const s = '<select><option' + (ty === '설정 시' ? ' selected' : '') + '>설정 시</option><option' + (ty === '점검 시' ? ' selected' : '') + '>점검 시</option><option' + (ty === '공통' ? ' selected' : '') + '>공통</option></select>'; tr.innerHTML = '<td>' + s + '</td><td><input value="' + V.esc(tx) + '" style="width:100%"></td><td>' + delBtn + '</td>'; tb.appendChild(tr); }
                PG._stackClose(); V.toast('고려사항이 추가되었습니다');
            };
            PG.policyChkItemAdd = () => PG._stackOpen('점검 항목 추가',
                '<div class="preset-form-grid">' +
                '<span class="k">영역</span><input id="chk-add-area" type="text" placeholder="예: 목표·KPI">' +
                '<span class="k">점검 항목</span><input id="chk-add-item" type="text" placeholder="점검할 항목">' +
                '<span class="k">결과유형</span><select id="chk-add-type"><option>O / X</option><option>텍스트</option></select>' +
                '<span class="k">관련 근거</span><input id="chk-add-basis" list="pol-law-list" type="text" placeholder="근거법령 사전에서 선택 (예: 산업안전보건법 제36조)">' +
                '</div>',
                '<button class="btn btn-secondary" onclick="PG._stackClose()">취소</button>' +
                '<button class="btn btn-primary" onclick="PG.policyChkItemAddSave()">등록</button>');
            PG.policyChkItemAddSave = () => {
                const ar = (document.getElementById('chk-add-area') || {}).value || '';
                const it = (document.getElementById('chk-add-item') || {}).value || '';
                const ty = (document.getElementById('chk-add-type') || {}).value || 'O / X';
                const ba = (document.getElementById('chk-add-basis') || {}).value || '';
                const tb = document.getElementById('policy-chk-tbody');
                if (tb) { const tr = document.createElement('tr'); const s = '<select><option' + (ty === 'O / X' ? ' selected' : '') + '>O / X</option><option' + (ty === '텍스트' ? ' selected' : '') + '>텍스트</option></select>'; tr.innerHTML = '<td><input value="' + V.esc(ar) + '" style="width:100%"></td><td><input value="' + V.esc(it) + '" style="width:100%"></td><td>' + s + '</td><td><input value="' + V.esc(ba) + '" list="pol-law-list" style="width:100%"></td><td>' + delBtn + '</td>'; tb.appendChild(tr); }
                PG._stackClose(); V.toast('점검 항목이 추가되었습니다');
            };

            /* ===== 점검표 관련 근거 설정 (현행본 전용 CRUD) =====
               점검 항목별 '관련 근거(법령·조항)'를 등록·수정하고, 조문 상세를 LAW_DICT에 등록해
               점검표·점검표 뷰어의 근거 태그 호버 툴팁에 즉시 반영. 결재 승인완료된 현행본에서만 가능. */
            PG.polChkBasis = ver => {
                const v = S.VERSIONS.find(x => x.ver === ver) || POL.active(); if (!v) return;
                if (!POL.isActive(v)) { V.toast('현행(결재 승인완료) 방침에서만 점검표 근거를 등록·수정할 수 있습니다'); return; }
                const items = (T.CHECKLIST_PRESETS && T.CHECKLIST_PRESETS.policy) || [];
                const opts = Object.keys(T.LAW_DICT || {}).map(k => '<option value="' + V.esc(k) + '">').join('');
                /* 행 HTML 생성 — 영역·항목·유형·근거 모두 편집 가능(추가/삭제 지원) */
                const rowHtml = it => {
                    const has = !!(T.LAW_DICT || {})[it.basis];
                    const isText = it.type === '텍스트';
                    return '<tr>' +
                        '<td><input class="cb-area" value="' + V.esc(it.area || '') + '" style="width:100%" placeholder="영역"></td>' +
                        '<td style="min-width:150px;"><input class="cb-item" value="' + V.esc(it.item || '') + '" style="width:100%" placeholder="점검 항목"></td>' +
                        '<td><select class="cb-type"><option' + (isText ? '' : ' selected') + '>O / X</option><option' + (isText ? ' selected' : '') + '>텍스트</option></select></td>' +
                        '<td style="min-width:200px;"><input class="cb-basis" list="chkb-laws" value="' + V.esc(it.basis || '') + '" style="width:100%" placeholder="예: 산업안전보건법 제36조"></td>' +
                        '<td style="white-space:nowrap;"><span class="cb-stat chip-mini ' + (has ? 'st-done' : 'wt-attach') + '">' + (has ? '조문 등록됨' : '조문 미등록') + '</span></td>' +
                        '<td style="white-space:nowrap;"><button class="btn btn-sm btn-outline" onclick="PG.polChkLawDetail(this)">조문 상세</button> ' +
                        '<button class="btn btn-sm btn-outline" onclick="PG.polChkRowDel(this)" title="행 삭제">삭제</button></td>' +
                        '</tr>';
                };
                PG._chkbRowHtml = rowHtml;
                const rows = items.map(rowHtml).join('');
                V.openModal('점검표 관련 근거 설정 — 현행본 v' + v.ver,
                    '<datalist id="chkb-laws">' + opts + '</datalist>' +
                    '<p style="font-size:12px; color:var(--text-gray); margin:0 0 10px; line-height:1.6;">각 점검 항목의 <b>관련 근거(법령·조항)</b>를 등록·수정하고, 하단 [+ 점검 항목 추가]로 <b>행을 추가</b>하거나 [삭제]로 <b>제거</b>할 수 있습니다. [조문 상세]에서 조·항·내용을 등록하면 점검표·점검표 뷰어의 근거 태그에 <b>호버 툴팁</b>으로 표시됩니다. <b>결재 승인완료된 현행본에서만</b> 가능합니다.</p>' +
                    '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>영역</th><th>점검 항목</th><th>유형</th><th>관련 근거</th><th>조문</th><th></th></tr></thead><tbody id="pol-chkb-tbody">' + rows + '</tbody></table></div>' +
                    '<button class="btn btn-sm btn-outline" style="margin-top:8px;" onclick="PG.polChkRowAdd()">+ 점검 항목 추가</button>',
                    '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
                    '<button class="btn btn-primary" onclick="PG.polChkBasisSave()">저장</button>');
            };
            PG.polChkRowAdd = () => {
                const tb = document.getElementById('pol-chkb-tbody');
                if (!tb || !PG._chkbRowHtml) return;
                const tmp = document.createElement('tbody');
                tmp.innerHTML = PG._chkbRowHtml({ area: '', item: '', type: 'O / X', basis: '' });
                const tr = tmp.firstElementChild;
                tb.appendChild(tr);
                const f = tr.querySelector('.cb-area'); if (f) f.focus();
            };
            PG.polChkRowDel = btn => { const tr = btn.closest('tr'); if (tr) tr.remove(); };
            PG.polChkBasisSave = () => {
                const tb = document.getElementById('pol-chkb-tbody');
                if (!tb) { V.closeModal(); return; }
                const list = [];
                Array.prototype.slice.call(tb.querySelectorAll('tr')).forEach(tr => {
                    const area = ((tr.querySelector('.cb-area') || {}).value || '').trim();
                    const item = ((tr.querySelector('.cb-item') || {}).value || '').trim();
                    const type = ((tr.querySelector('.cb-type') || {}).value || 'O / X').trim();
                    const basis = ((tr.querySelector('.cb-basis') || {}).value || '').trim();
                    if (!area && !item) return; // 빈 행 제외
                    list.push({ area: area, item: item, type: type, basis: basis });
                });
                T.CHECKLIST_PRESETS = T.CHECKLIST_PRESETS || {};
                T.CHECKLIST_PRESETS.policy = list;
                V.closeModal(); render(); V.toast('점검표 관련 근거가 저장되었습니다');
            };
            PG.polChkLawDetail = btn => {
                const tr = btn.closest('tr'); if (!tr) return;
                PG._cldRow = tr;
                const key = ((tr.querySelector('.cb-basis') || {}).value || '').trim();
                const itemName = ((tr.querySelector('.cb-item') || {}).value || '').trim();
                const d = (T.LAW_DICT || {})[key] || {};
                PG._stackOpen('조문 상세 등록 · 점검 항목 「' + V.esc(itemName) + '」',
                    '<div class="preset-form-grid">' +
                    '<span class="k">근거 표기</span><input id="cld-key" type="text" value="' + V.esc(key) + '" placeholder="예: 산업안전보건법 제36조">' +
                    '<span class="k">법령</span><input id="cld-law" type="text" value="' + V.esc(d.law || '') + '" placeholder="예: 산업안전보건법">' +
                    '<span class="k">조항</span><input id="cld-art" type="text" value="' + V.esc(d.art || '') + '" placeholder="예: 제36조">' +
                    '<span class="k">호</span><input id="cld-clause" type="text" value="' + V.esc(d.clause || '') + '" placeholder="예: 제1호 (없으면 비움)">' +
                    '<span class="k">조문 제목</span><input id="cld-title" type="text" value="' + V.esc(d.title || '') + '" placeholder="예: 위험성평가의 실시">' +
                    '<span class="k">조문 내용</span><textarea id="cld-text" rows="3" style="width:100%; resize:vertical;" placeholder="조문 본문을 입력하세요">' + V.esc(d.text || '') + '</textarea>' +
                    '</div>',
                    '<button class="btn btn-secondary" onclick="PG._stackClose()">취소</button>' +
                    '<button class="btn btn-primary" onclick="PG.polChkLawDetailSave()">저장</button>');
            };
            PG.polChkLawDetailSave = () => {
                const key = ((document.getElementById('cld-key') || {}).value || '').trim();
                if (!key) { V.toast('근거 표기를 입력하세요'); return; }
                T.LAW_DICT = T.LAW_DICT || {};
                T.LAW_DICT[key] = {
                    law: ((document.getElementById('cld-law') || {}).value || '').trim(),
                    art: ((document.getElementById('cld-art') || {}).value || '').trim(),
                    clause: ((document.getElementById('cld-clause') || {}).value || '').trim(),
                    title: ((document.getElementById('cld-title') || {}).value || '').trim(),
                    text: ((document.getElementById('cld-text') || {}).value || '').trim(),
                };
                const tr = PG._cldRow;
                if (tr) {
                    const inp = tr.querySelector('.cb-basis'); if (inp) inp.value = key;
                    const stat = tr.querySelector('.cb-stat'); if (stat) { stat.className = 'cb-stat chip-mini st-done'; stat.textContent = '조문 등록됨'; }
                }
                PG._stackClose(); V.toast('조문 상세가 등록되었습니다 — 근거 태그 호버 시 표시됩니다');
            };

            /* ===== SSOT (window.POLICY_STATE) ===== */
            if (!window.POLICY_STATE) {
                window.POLICY_STATE = {
                    tab: 'policy', view: 'list', ver: null, draftType: null, draftVer: null,
                    VERSIONS: [
                        { ver: '2.0', type: '제정', title: '담양군 안전·보건 경영방침', goal: '군민과 종사자의 생명·안전을 최우선으로 하는 안전 담양',
                          details: ['중대산업재해·중대시민재해 ZERO', '정기 위험성평가 이행률 100%', '안전보건교육 이수율 95% 이상'],
                          inspector: '재난안전과 · 재난안전과장 / 홍길동', effDate: '2026-02-03', appr: '승인완료',
                          inspections: [{ half: '2026 상반기', date: '2026-06-22', result: '적합', inspector: '홍길동' }],
                          postings: [{ id: 'L1', loc: '군청 본관 1층 게시판', photo: '본관 1층 게시판 게시 사진', date: '2026-02-05', status: '게시완료' },
                                     { id: 'L2', loc: '내부망(새올) 전자게시', photo: '새올 전자게시 화면 캡처', date: '2026-02-03', status: '게시완료' }],
                          evidence: [{ id: 'E1', name: '경영방침_2026.pdf', kind: '본문' }, { id: 'E2', name: '의견수렴결과.xlsx', kind: '의견수렴' }],
                          postedDate: '2026-02-05', pdf: { docNo: '온나라-2026-3174', issued: '2026-02-03', signer: '담양군수 홍OO' } },
                        { ver: '1.1', type: '개정', title: '담양군 안전·보건 경영방침', goal: '안전한 일터, 건강한 담양',
                          details: ['중대재해 ZERO 유지', '위험성평가 이행률 100%', '안전보건교육 이수율 90% 이상'], inspector: '재난안전과 · 재난안전과장 / 홍길동',
                          effDate: '2025-07-01', appr: '승인완료', inspections: [{ half: '2025 하반기', date: '2025-12-10', result: '보완 필요', inspector: '홍길동' }],
                          postings: [{ id: 'L1', loc: '군청 본관 1층 게시판', photo: '본관 1층 게시판 게시 사진', date: '2025-07-03', status: '게시완료' }],
                          evidence: [{ id: 'E1', name: '개정_방침_v1.1.pdf', kind: '본문' }], postedDate: '2025-07-03',
                          pdf: { docNo: '온나라-2025-2210', issued: '2025-07-01', signer: '담양군수 홍OO' } },
                        { ver: '1.0', type: '최초', title: '담양군 안전·보건 경영방침', goal: '안전 담양 원년 — 중대재해 예방 체계 구축',
                          details: ['중대재해 예방 관리체계 구축', '위험성평가 도입'], inspector: '재난안전과 · 재난안전과장 / 홍길동',
                          effDate: '2024-03-01', appr: '승인완료', inspections: [], postings: [], evidence: [], postedDate: '',
                          pdf: { docNo: '온나라-2024-1102', issued: '2024-03-01', signer: '담양군수 홍OO' } },
                    ],
                };
            }
            const S = window.POLICY_STATE;
            S.VERSIONS.sort((a, b) => parseFloat(b.ver) - parseFloat(a.ver));
            const POL = {
                cur: () => S.VERSIONS.find(v => v.ver === S.ver) || S.VERSIONS[0] || null,
                lastInspection: v => (v && v.inspections && v.inspections.length) ? v.inspections[v.inspections.length - 1] : null,
                /* 현행본 = 결재 승인완료된 확정 문서 중 가장 최근 시행본 (버전 숫자 아님) */
                active: () => {
                    const ap = S.VERSIONS.filter(v => v.appr === '승인완료');
                    if (!ap.length) return null;
                    return ap.slice().sort((a, b) => (b.effDate || '').localeCompare(a.effDate || ''))[0];
                },
                isActive: v => { const a = POL.active && POL.active(); return !!a && !!v && a.ver === v.ver; },
                nextVer: type => {
                    if (!S.VERSIONS.length || type === '최초') return '1.0';
                    const c = parseFloat(S.VERSIONS[0].ver);
                    return type === '제정' ? (Math.floor(c) + 1) + '.0' : (Math.round((c + 0.1) * 10) / 10).toFixed(1);
                },
            };
            /* 칩 유틸 */
            const apprColor = a => ({ '미상신': 'neutral', '결재중': 'info', '승인완료': 'success', '반려': 'danger' }[a] || 'neutral');
            const apprChip = a => '<span class="chip-status ' + apprColor(a) + '">' + (a || '미상신') + '</span>';
            const checkChip = v => { const i = POL.lastInspection(v); return i ? '<span class="chip-status success">점검완료 · ' + i.date + '</span>' : '<span class="chip-status neutral">미점검</span>'; };
            const typeChip = t => '<span class="chip-mini ' + (t === '제정' ? 'wt-elec' : t === '개정' ? 'wt' : 'st-done') + '">' + t + '</span>';
            const stateChip = v => POL.isActive(v) ? '<span class="chip-status success">현행</span>' : '<span class="chip-status neutral">이력</span>';
            const resultChip = r => '<span class="chip-status ' + (r === '적합' ? 'success' : r === '부적합' ? 'danger' : 'warning') + '">' + r + '</span>';

            /* ===== 라우터 ===== */
            PG.go = (tab, view, ver) => { if (tab) S.tab = tab; if (view) S.view = view; if (ver !== undefined) S.ver = ver; render(); };
            PG.polTab = name => PG.go(name, 'list', null);
            PG.polOpen = ver => PG.go(S.tab, 'detail', ver);
            PG.polBack = () => PG.go(S.tab, 'list', null);

            /* 등록(최초/제정/개정) */
            PG.polNew = () => {
                if (!S.VERSIONS.length) { S.draftType = '최초'; S.draftVer = '1.0'; PG.go('policy', 'form'); return; }
                PG._stackOpen('경영방침 등록',
                    '<p style="font-size:13px; color:var(--text-gray); margin-bottom:14px;">현재 최신본 <b>v' + S.VERSIONS[0].ver + '</b> 기준으로 새 버전을 만듭니다. 구분을 선택하세요.</p>' +
                    '<div style="display:flex; gap:10px;">' +
                    '<button type="button" class="pol-kind-btn" onclick="PG.polNewKind(\'개정\')"><b>개정</b><span>v' + POL.nextVer('개정') + ' · +0.1</span><small>소폭 보완·갱신</small></button>' +
                    '<button type="button" class="pol-kind-btn" onclick="PG.polNewKind(\'제정\')"><b>제정</b><span>v' + POL.nextVer('제정') + ' · +1.0</span><small>전면 재수립</small></button>' +
                    '</div>',
                    '<button class="btn btn-secondary" onclick="PG._stackClose()">취소</button>');
            };
            PG.polNewKind = type => { S.draftType = type; S.draftVer = POL.nextVer(type); PG._stackClose(); PG.go('policy', 'form'); };
            const goalEditRow = val => '<div class="goal-row"><input type="text" value="' + V.esc(val) + '" placeholder="세부 방침을 입력하세요"><button type="button" class="goal-del" onclick="this.closest(\'.goal-row\').remove()" aria-label="삭제">×</button></div>';
            PG.polGoalAdd = () => { const l = document.getElementById('pol-form-goals'); if (!l) return; l.insertAdjacentHTML('beforeend', goalEditRow('')); const ii = l.querySelectorAll('input'); if (ii.length) ii[ii.length - 1].focus(); };
            PG.polPickInspector = () => E.openOrgTree('pol-form-inspector');
            PG.polSave = () => {
                const goal = ((document.getElementById('pol-form-goal') || {}).value || '').trim();
                if (!goal) { V.toast('목표를 입력하세요'); return; }
                const details = Array.from(document.querySelectorAll('#pol-form-goals input')).map(i => i.value.trim()).filter(Boolean);
                const inspector = (document.getElementById('pol-form-inspector') || {}).value || '';
                const v = { ver: S.draftVer, type: S.draftType, title: '담양군 안전·보건 경영방침', goal, details, inspector,
                    effDate: '2026-06-24', appr: '미상신', inspections: [], postings: [], evidence: [], postedDate: '',
                    pdf: { docNo: '(상신 전)', issued: '-', signer: '담양군수' } };
                S.VERSIONS.unshift(v); S.draftType = null; S.draftVer = null;
                PG.go('policy', 'detail', v.ver);
                V.toast('경영방침 v' + v.ver + ' (' + v.type + ') 등록 완료');
            };
            PG.polRevise = () => PG.polNewKind('개정');
            PG.polEnact = () => PG.polNewKind('제정');

            /* 온나라 결재 */
            PG.polApprSet = (ver, st) => { const v = S.VERSIONS.find(x => x.ver === ver); if (v) v.appr = st; render(); V.toast('결재 상태: ' + st); };
            PG.polOnnara = ver => { const v = S.VERSIONS.find(x => x.ver === ver); if (v) v.appr = '결재중'; E.onnaraPopup('경영방침 v' + ver); render(); };
            PG.polApprHistory = () => V.openModal('온나라 결재 이력',
                '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>일시</th><th>처리</th><th>처리자</th><th>비고</th></tr></thead><tbody>' +
                [['2026-06-22 16:20', '결재 상신', '김담당', '-'], ['2026-06-22 17:05', '팀장 승인', '이팀장', '-'], ['2026-06-23 10:12', '부군수 승인', '부군수', '승인 완료']].map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td></tr>').join('') +
                '</tbody></table></div>',
                '<button class="btn btn-primary" onclick="DYV2.closeModal()">확인</button>');

            /* PDF 미리보기 */
            const pdfPaper = v => '<div class="pdf-paper">' +
                '<div class="pdf-head"><span>' + (v.pdf.signer || '담양군') + '</span><span>문서번호 ' + (v.pdf.docNo || '-') + '</span></div>' +
                '<div class="pdf-title">' + V.esc(v.title) + ' <span class="pdf-ver">v' + v.ver + '</span></div>' +
                '<div class="pdf-slogan">' + V.esc(v.goal) + '</div>' +
                '<div class="pdf-sec">세부 방침</div><ol class="pdf-list">' + (v.details || []).map(d => '<li>' + V.esc(d) + '</li>').join('') + '</ol>' +
                '<div class="pdf-sign">시행일 ' + (v.effDate || '-') + '<br><br><b>' + (v.pdf.signer || '담양군수') + '</b> (직인)</div>' +
                '</div>';
            PG.polPdfDownload = () => V.toast('PDF 다운로드 (프로토타입)');
            PG.polPdfClose = () => { const o = document.getElementById('pdf-full-overlay'); if (o) o.remove(); };
            PG.polPdfFull = ver => {
                const v = S.VERSIONS.find(x => x.ver === ver) || POL.cur(); if (!v) return;
                PG.polPdfClose();
                const ov = document.createElement('div');
                ov.id = 'pdf-full-overlay'; ov.className = 'pdf-full-overlay';
                ov.innerHTML =
                    '<div class="pdf-full-backdrop" onclick="PG.polPdfClose()"></div>' +
                    '<div class="pdf-full-panel" role="dialog" aria-modal="true">' +
                    '<div class="pdf-full-head"><span>경영방침 v' + v.ver + ' 문서 미리보기</span>' +
                    '<span class="pdf-full-tools"><button class="btn btn-sm btn-outline" onclick="PG.polPdfDownload()">PDF 다운로드</button>' +
                    '<button type="button" class="modal-close" onclick="PG.polPdfClose()" aria-label="닫기">&times;</button></span></div>' +
                    '<div class="pdf-full-body">' + pdfPaper(v) + '</div></div>';
                document.body.appendChild(ov);
            };

            /* 게시(상세) — 좌측 사진(세로형) + 우측 정보(제목·게시일·내용), 사진 클릭 시 전체화면 */
            const baCard = (ver, p, editable) => {
                const thumb = p.photoSrc
                    ? '<button type="button" class="post-thumb" onclick="PG.boardPhotoView(\'' + ver + '\',\'' + p.id + '\')" aria-label="사진 확대 보기"><img src="' + p.photoSrc + '" alt="게시 사진"><span class="post-thumb-zoom">🔍 확대</span></button>'
                    : '<div class="post-thumb empty"><span class="pt-ic">🖼</span><span class="pt-tx">' + V.esc(p.photo || '게시 사진') + '</span></div>';
                return '<div class="ba-card"><div class="post-row">' + thumb +
                    '<div class="post-info">' +
                    '<div class="post-info-head"><span class="post-title">' + V.esc(p.loc) + '</span>' +
                    '<span style="display:flex; gap:6px; align-items:center;"><span class="chip-status ' + (p.status === '게시완료' ? 'success' : 'neutral') + '">' + p.status + '</span>' +
                    (editable ? '<button type="button" class="ba-del" onclick="PG.boardLocDel(\'' + ver + '\',\'' + p.id + '\')" aria-label="삭제">×</button>' : '') + '</span></div>' +
                    '<div class="post-meta"><span class="post-meta-k">게시일</span>' + (p.date || '-') + '</div>' +
                    '<div class="post-meta post-meta-note"><span class="post-meta-k">내용</span>' + (p.note ? V.esc(p.note) : '<span class="post-empty">-</span>') + '</div>' +
                    '</div></div></div>';
            };
            /* 게시 사진 전체화면 보기 (라이트박스) */
            PG.boardPhotoClose = () => { const o = document.getElementById('post-photo-overlay'); if (o) o.remove(); };
            PG.boardPhotoView = (ver, id) => {
                const v = S.VERSIONS.find(x => x.ver === ver); const p = v && (v.postings || []).find(x => x.id === id);
                if (!p || !p.photoSrc) return;
                PG.boardPhotoClose();
                const ov = document.createElement('div');
                ov.id = 'post-photo-overlay'; ov.className = 'post-photo-overlay';
                ov.innerHTML = '<div class="post-photo-backdrop" onclick="PG.boardPhotoClose()"></div>' +
                    '<div class="post-photo-stage"><button type="button" class="post-photo-x" onclick="PG.boardPhotoClose()" aria-label="닫기">&times;</button>' +
                    '<img src="' + p.photoSrc + '" alt="게시 사진 — ' + V.esc(p.loc) + '">' +
                    '<div class="post-photo-cap">' + V.esc(p.loc) + ' · 게시일 ' + (p.date || '-') + '</div></div>';
                document.body.appendChild(ov);
            };

            /* 사진 업로드 영역 — 빈 상태 / 미리보기 상태 */
            const boardPhotoEmpty = () =>
                '<div class="board-up-icon">📎</div>' +
                '<div class="board-up-title">게시된 경영방침 사진을 첨부하세요</div>' +
                '<div class="board-up-sub">이곳을 <b>클릭</b>하거나 파일을 <b>끌어다 놓으세요</b> · JPG · PNG</div>' +
                '<button type="button" class="btn btn-primary board-up-btn" onclick="event.stopPropagation(); PG.boardPhotoPick()">📎 사진 파일 첨부</button>';
            const boardPhotoPreview = p =>
                '<div class="board-up-preview"><img src="' + p.src + '" alt="게시 사진 미리보기"></div>' +
                '<div class="board-up-fname">🖼 ' + V.esc(p.name) + '</div>' +
                '<div class="board-up-actions"><button type="button" class="btn btn-sm btn-outline" onclick="event.stopPropagation(); PG.boardPhotoPick()">다시 선택</button>' +
                '<button type="button" class="btn btn-sm btn-outline" onclick="event.stopPropagation(); PG.boardPhotoClear()">제거</button></div>';
            PG._boardPhoto = null;
            PG.boardPhotoPick = () => { const i = document.getElementById('board-photo-input'); if (i) i.click(); };
            PG.boardPhotoFile = file => {
                if (!file) return;
                if (!/^image\//.test(file.type)) { V.toast('이미지 파일만 업로드할 수 있습니다'); return; }
                const reader = new FileReader();
                reader.onload = e => {
                    PG._boardPhoto = { name: file.name, src: e.target.result };
                    const z = document.getElementById('board-photo-zone');
                    if (z) { z.classList.add('has-photo'); z.innerHTML = boardPhotoPreview(PG._boardPhoto); }
                };
                reader.readAsDataURL(file);
            };
            PG.boardPhotoChange = inp => PG.boardPhotoFile(inp.files && inp.files[0]);
            PG.boardPhotoDrop = ev => { ev.preventDefault(); const z = document.getElementById('board-photo-zone'); if (z) z.classList.remove('drag'); PG.boardPhotoFile(ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0]); };
            PG.boardPhotoClear = () => { PG._boardPhoto = null; const z = document.getElementById('board-photo-zone'); if (z) { z.classList.remove('has-photo'); z.innerHTML = boardPhotoEmpty(); } };
            PG.boardLocAdd = ver => { PG._boardPhoto = null; PG._stackOpen('게시 등록',
                '<div class="board-up">' +
                '<input type="file" id="board-photo-input" accept="image/*" style="display:none" onchange="PG.boardPhotoChange(this)">' +
                '<div id="board-photo-zone" class="board-up-zone" onclick="PG.boardPhotoPick()" ondragover="event.preventDefault(); this.classList.add(\'drag\')" ondragleave="this.classList.remove(\'drag\')" ondrop="PG.boardPhotoDrop(event)">' + boardPhotoEmpty() + '</div>' +
                '</div>' +
                '<div class="preset-form-grid" style="margin-top:16px;">' +
                '<span class="k">게시 위치 <span class="req">필수</span></span><input id="board-add-loc" type="text" placeholder="예: 군청 본관 1층 게시판">' +
                '<span class="k">게시일 <span class="req">필수</span></span><input id="board-add-date" type="date">' +
                '<span class="k">게시 내용 <span class="opt">선택</span></span><textarea id="board-add-note" rows="2" style="width:100%; resize:vertical;" placeholder="게시 관련 메모 (선택)"></textarea>' +
                '</div>',
                '<button class="btn btn-secondary" onclick="PG._stackClose()">취소</button>' +
                '<button class="btn btn-primary" onclick="PG.boardLocSave(\'' + ver + '\')">등록</button>'); };
            PG.boardLocSave = ver => {
                const v = S.VERSIONS.find(x => x.ver === ver); if (!v) return;
                const locEl = document.getElementById('board-add-loc');
                const dateEl = document.getElementById('board-add-date');
                [locEl, dateEl].forEach(el => el && el.classList.remove('field-invalid'));
                const loc = ((locEl || {}).value || '').trim();
                const date = (dateEl || {}).value || '';
                if (!loc) { V.toast('게시 위치를 입력하세요'); if (locEl) { locEl.classList.add('field-invalid'); locEl.focus(); } return; }
                if (!date) { V.toast('게시일을 선택하세요'); if (dateEl) { dateEl.classList.add('field-invalid'); dateEl.focus(); } return; }
                const note = ((document.getElementById('board-add-note') || {}).value || '').trim();
                const ph = PG._boardPhoto;
                v.postings = v.postings || [];
                v.postings.push({ id: 'L' + (v.postings.length + 1) + '-' + v.postings.length, loc, photo: ph ? ph.name : '게시 사진', photoSrc: ph ? ph.src : '', note, date, status: '게시완료' });
                v.postedDate = date; PG._boardPhoto = null;
                PG._stackClose(); render(); V.toast('게시 항목이 등록되었습니다');
            };
            PG.boardLocDel = (ver, id) => { const v = S.VERSIONS.find(x => x.ver === ver); if (v) v.postings = (v.postings || []).filter(p => p.id !== id); render(); V.toast('게시 항목이 삭제되었습니다'); };
            PG.evidenceAdd = ver => PG._stackOpen('증빙 추가',
                '<div class="preset-form-grid">' +
                '<span class="k">구분</span><select id="evi-add-kind"><option>본문</option><option>의견수렴</option><option>기타</option></select>' +
                '<span class="k">파일</span><div class="upload-drop" style="padding:14px;" onclick="DYV2.toast(\'파일 선택 (프로토타입)\')">증빙 파일 첨부</div>' +
                '<span class="k">파일명</span><input id="evi-add-name" type="text" placeholder="예: 의견수렴결과.xlsx"></div>',
                '<button class="btn btn-secondary" onclick="PG._stackClose()">취소</button>' +
                '<button class="btn btn-primary" onclick="PG.evidenceSave(\'' + ver + '\')">등록</button>');
            PG.evidenceSave = ver => {
                const v = S.VERSIONS.find(x => x.ver === ver); if (!v) return;
                const kind = (document.getElementById('evi-add-kind') || {}).value || '기타';
                const name = ((document.getElementById('evi-add-name') || {}).value || '').trim() || '증빙_' + ((v.evidence || []).length + 1);
                v.evidence = v.evidence || [];
                v.evidence.push({ id: 'E' + (v.evidence.length + 1) + '-' + v.evidence.length, name, kind });
                PG._stackClose(); render(); V.toast('증빙이 추가되었습니다');
            };
            PG.evidenceDel = (ver, id) => { const v = S.VERSIONS.find(x => x.ver === ver); if (v) v.evidence = (v.evidence || []).filter(e => e.id !== id); render(); V.toast('증빙이 삭제되었습니다'); };

            /* 이행점검 (F5) */
            PG.polCheckWrite = ver => {
                const v = S.VERSIONS.find(x => x.ver === ver) || POL.active(); if (!v) return;
                if (!POL.isActive(v)) { V.toast('현행(결재 승인완료) 방침만 이행 점검을 작성할 수 있습니다'); return; }
                E.openForm({ id: 'EDOC-경영방침점검-' + v.ver, title: '경영방침 수립·이행 점검표 (v' + v.ver + ')', form: 'F5',
                    ctx: { menuLabel: '경영방침 · 반기', checklist: T.CHECKLIST_PRESETS.policy, attachList: [{ name: '반기점검_현장사진.jpg', desc: '점검 현장 사진', date: '2026-06-22' }] },
                    fields: { owner: v.inspector || '' }, onChange: render });
            };
            /* 완료된 이행 점검표 읽기 뷰어 (안전나우 패턴: 영역별 섹션 + 적합/부적합 요약 + 인쇄/PDF) */
            PG.checkSheet = (ver, idx) => {
                const v = S.VERSIONS.find(x => x.ver === ver); const ins = v && v.inspections && v.inspections[idx]; if (!ins) return;
                const items = (T.CHECKLIST_PRESETS && T.CHECKLIST_PRESETS.policy) || [];
                const xWant = ins.result === '부적합' ? 2 : ins.result === '보완 필요' ? 1 : 0;
                let xUsed = 0;
                const rows = items.map((it, i) => {
                    if (it.type === '텍스트') return { area: it.area, item: it.item, basis: it.basis, kind: 'text', text: (i % 2 ? '법령 개정사항을 방침에 반영 완료 — 추가 조치 없음.' : '안전점검 실시율 87%(목표 100%) 미달 — 미시행 부서 독려 필요.') };
                    let res = 'O';
                    if (xUsed < xWant) { res = 'X'; xUsed++; }
                    return { area: it.area, item: it.item, basis: it.basis, kind: 'ox', res };
                });
                const fit = rows.filter(r => r.kind === 'ox' && r.res === 'O').length;
                const unfit = rows.filter(r => r.kind === 'ox' && r.res === 'X').length;
                const txt = rows.filter(r => r.kind === 'text').length;
                const areas = [];
                rows.forEach(r => { let g = areas.find(a => a.area === r.area); if (!g) { g = { area: r.area, items: [] }; areas.push(g); } g.items.push(r); });
                const body =
                    '<div class="sheet-meta"><span>점검일 <b>' + ins.date + '</b></span><span>점검자 <b>' + (ins.inspector || '-') + '</b></span><span>종합 결과 ' + resultChip(ins.result) + '</span></div>' +
                    '<div class="sheet-summary"><span class="sheet-sum ok"><b>' + fit + '</b> 적합</span><span class="sheet-sum bad"><b>' + unfit + '</b> 부적합</span><span class="sheet-sum txt"><b>' + txt + '</b> 텍스트</span></div>' +
                    areas.map(g => '<div class="sheet-area"><div class="sheet-area-head">' + g.area + '</div>' +
                        g.items.map(r => '<div class="sheet-item">' +
                            '<div class="sheet-item-q"><span class="sheet-q-text">' + V.esc(r.item) + '</span>' +
                            EDOC.lawTag(r.basis) + '</div>' +
                            (r.kind === 'ox'
                                ? '<div class="sheet-item-r">' + (r.res === 'O' ? '<span class="chip-status success">O · 적합</span>' : '<span class="chip-status danger">X · 부적합</span>') + '</div>'
                                : '<div class="sheet-item-r"><span class="chip-mini wt-elec">텍스트</span><div class="sheet-text">' + V.esc(r.text) + '</div></div>') +
                            '</div>').join('') + '</div>').join('') +
                    (unfit ? '<p style="font-size:12px; color:var(--status-danger-fg); margin-top:12px;">부적합 ' + unfit + '건은 개선조치(IMP)로 자동 등록되었습니다.</p>' : '');
                V.openModal('이행 점검표 — v' + ver + ' · ' + ins.half, body,
                    '<button class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
                    '<button class="btn btn-outline" onclick="DYV2.toast(\'인쇄 (프로토타입)\')">인쇄</button>' +
                    '<button class="btn btn-primary" onclick="DYV2.toast(\'PDF 다운로드 (프로토타입)\')">PDF 다운로드</button>');
            };

            /* ===== 서브탭 바 ===== */
            const subtabs = '<div class="psub-tabs">' +
                [['policy', '경영방침'], ['check', '이행 점검'], ['board', '게시 현황']].map(t => '<button type="button" class="psub-tab' + (S.tab === t[0] ? ' is-active' : '') + '" onclick="PG.polTab(\'' + t[0] + '\')">' + t[1] + '</button>').join('') +
                '</div>';

            /* ===== 뷰 빌더 ===== */
            function renderListPolicy() {
                if (!S.VERSIONS.length) return subtabs + sectionCard('경영방침', '<div style="text-align:center; padding:44px 20px; color:var(--text-gray);">등록된 경영방침이 없습니다.<br><br><button class="btn btn-primary" onclick="PG.polNew()">최초 등록</button></div>', '');
                const body = '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>버전</th><th>방침명</th><th>반기 점검</th><th>온나라 결재 상태</th></tr></thead><tbody>' +
                    S.VERSIONS.map(v => '<tr style="cursor:pointer;" onclick="PG.polOpen(\'' + v.ver + '\')"><td><b>v' + v.ver + '</b> ' + typeChip(v.type) + '</td><td>' + V.esc(v.title) + '</td><td>' + checkChip(v) + '</td><td>' + apprChip(v.appr) + '</td></tr>').join('') +
                    '</tbody></table></div>';
                return subtabs + sectionCard('경영방침 (' + S.VERSIONS.length + '건)', body, '<button class="btn btn-sm btn-primary" onclick="PG.polNew()">+ 등록</button>');
            }
            function renderListCheck() {
                const act = POL.active();
                const notice = '<div class="check-notice">결재 승인완료된 <b>현행본만</b> 이행 점검을 작성할 수 있습니다. 이전 버전은 <b>점검 이력 열람만</b> 가능합니다.' +
                    (act ? ' 현행본: <b>v' + act.ver + '</b>' : ' (현행본 없음 — 결재 승인 후 점검 가능)') + '</div>';
                const body = notice + '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>버전</th><th>상태</th><th>방침명</th><th>점검 여부</th><th>점검일</th><th>점검 결과</th><th>점검표</th></tr></thead><tbody>' +
                    S.VERSIONS.map(v => {
                        const i = POL.lastInspection(v); const idx = i ? v.inspections.length - 1 : -1;
                        const isAct = POL.isActive(v);
                        const action = i
                            ? '<button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); PG.checkSheet(\'' + v.ver + '\',' + idx + ')">점검표 보기</button>'
                            : (isAct
                                ? '<button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); PG.polCheckWrite(\'' + v.ver + '\')">점검 작성</button>'
                                : '<span style="font-size:12px; color:var(--text-gray);">이력 없음</span>');
                        return '<tr style="cursor:pointer;" onclick="PG.polOpen(\'' + v.ver + '\')"><td><b>v' + v.ver + '</b></td><td>' + stateChip(v) + '</td><td>' + V.esc(v.title) + '</td><td>' + (i ? '<span class="chip-status success">완료</span>' : '<span class="chip-status neutral">미점검</span>') + '</td><td>' + (i ? i.date : '-') + '</td><td>' + (i ? resultChip(i.result) : '-') + '</td><td>' + action + '</td></tr>';
                    }).join('') +
                    '</tbody></table></div>';
                const foot = act ? '<button class="btn btn-sm btn-outline" onclick="PG.polChkBasis(\'' + act.ver + '\')">점검표 근거 설정</button><button class="btn btn-sm btn-primary" onclick="PG.polCheckWrite(\'' + act.ver + '\')">현행본 이행점검 작성</button>' : '';
                return subtabs + sectionCard('이행 점검 (반기)', body, foot);
            }
            function renderListBoard() {
                const body = '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>버전</th><th>방침명</th><th>게시 건수</th><th>최근 게시일</th><th>시행일</th></tr></thead><tbody>' +
                    S.VERSIONS.map(v => '<tr style="cursor:pointer;" onclick="PG.polOpen(\'' + v.ver + '\')"><td><b>v' + v.ver + '</b></td><td>' + V.esc(v.title) + '</td><td>' + (v.postings || []).length + '건</td><td>' + (v.postedDate || '-') + '</td><td>' + (v.effDate || '-') + '</td></tr>').join('') +
                    '</tbody></table></div>';
                return subtabs + sectionCard('게시 현황 <span class="chip-mini wt" style="margin-left:6px; font-weight:600;">산안법 §14</span>', body, '');
            }
            function renderDetail(v) {
                if (!v) return renderListPolicy();
                const editable = POL.isActive(v);
                const infoGrid = '<div class="preset-form-grid">' +
                    '<span class="k">버전</span><div><b>v' + v.ver + '</b> ' + typeChip(v.type) + ' ' + stateChip(v) + '</div>' +
                    '<span class="k">방침 제호</span><div>' + V.esc(v.title) + '</div>' +
                    '<span class="k">시행일</span><div>' + (v.effDate || '-') + '</div>' +
                    '<span class="k">목표</span><div style="font-weight:700; color:var(--main-dark2);">' + V.esc(v.goal) + '</div>' +
                    '<span class="k">세부 방침</span><ol style="margin:0; padding-left:18px;">' + (v.details || []).map(d => '<li>' + V.esc(d) + '</li>').join('') + '</ol>' +
                    '<span class="k">점검자</span><div>' + V.esc(v.inspector || '-') + '</div>' +
                    '<span class="k">반기 점검</span><div>' + checkChip(v) + '</div>' +
                    '<span class="k">온나라 결재</span><div style="display:flex; gap:8px; align-items:center;">' + apprChip(v.appr) + '<button class="btn btn-sm btn-outline" onclick="PG.polApprHistory()">이력</button></div>' +
                    '</div>' +
                    '<div class="pol-badges" style="margin-top:14px;">' +
                    '<button type="button" class="pol-badge" onclick="PG.policyGuide()">ⓘ 작성 가이드</button>' +
                    '</div>';
                const pdfPanel = '<div class="pol-pdf-wrap"><div class="pol-pdf-tools"><span style="font-size:12px; font-weight:700; color:var(--text-gray);">PDF 미리보기</span><span style="display:flex; gap:6px;"><button class="btn btn-sm btn-outline" onclick="PG.polPdfFull(\'' + v.ver + '\')">전체화면</button><button class="btn btn-sm btn-primary" onclick="PG.polPdfDownload()">PDF 다운로드</button></span></div>' + pdfPaper(v) + '</div>';
                const checkSec = sectionCard('반기 이행 점검 ' + (editable ? '' : '이력 (열람 전용)'),
                    (v.inspections && v.inspections.length ? '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>회차</th><th>점검일</th><th>점검자</th><th>결과</th><th></th></tr></thead><tbody>' + v.inspections.map((i, idx) => '<tr><td>' + i.half + '</td><td>' + i.date + '</td><td>' + (i.inspector || '-') + '</td><td>' + resultChip(i.result) + '</td><td><button class="btn btn-sm btn-outline" onclick="PG.checkSheet(\'' + v.ver + '\',' + idx + ')">점검표 보기</button></td></tr>').join('') + '</tbody></table></div>' : '<p style="color:var(--text-gray); font-size:13px;">점검 이력이 없습니다.</p>') +
                    (editable ? '' : '<p class="lock-note">🔒 이전 버전입니다. 점검 이력 열람만 가능하며 신규 점검 작성·수정은 현행본에서만 할 수 있습니다.</p>'),
                    editable ? '<button class="btn btn-sm btn-outline" onclick="PG.polChkBasis(\'' + v.ver + '\')">점검표 근거 설정</button><button class="btn btn-sm btn-primary" onclick="PG.polCheckWrite(\'' + v.ver + '\')">이행점검 작성</button>' : '');
                const boardSec = sectionCard('게시 현황 <span class="chip-mini wt" style="margin-left:6px;">산안법 §14</span>',
                    '<div class="ba-board">' + ((v.postings || []).length ? (v.postings || []).map(p => baCard(v.ver, p, editable)).join('') : '<p style="color:var(--text-gray); font-size:13px;">게시 이력이 없습니다.</p>') + '</div>' +
                    '<div class="attach-list" style="margin-top:16px;"><div class="attach-list-head">관련 증빙 (방침 본문·의견수렴 등)</div><div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>파일명</th><th>구분</th>' + (editable ? '<th></th>' : '') + '</tr></thead><tbody>' + (v.evidence || []).map(e => '<tr><td>' + V.esc(e.name) + '</td><td><span class="chip-mini wt">' + e.kind + '</span></td>' + (editable ? '<td><button class="btn btn-sm btn-outline" onclick="PG.evidenceDel(\'' + v.ver + '\',\'' + e.id + '\')">삭제</button></td>' : '') + '</tr>').join('') + '</tbody></table></div>' + (editable ? '<button class="btn btn-sm btn-outline" style="margin-top:8px;" onclick="PG.evidenceAdd(\'' + v.ver + '\')">+ 증빙 추가</button>' : '') + '</div>',
                    editable ? '<button class="btn btn-sm btn-primary" onclick="PG.boardLocAdd(\'' + v.ver + '\')">+ 게시 추가</button>' : '');
                const header = '<div class="pol-detail-top"><button class="btn btn-sm btn-outline" onclick="PG.polBack()">‹ 목록</button>' +
                    '<div class="pol-detail-actions"><button class="btn btn-sm btn-outline" onclick="PG.polRevise()">개정</button><button class="btn btn-sm btn-outline" onclick="PG.polEnact()">제정</button>' +
                    (v.appr === '미상신' || v.appr === '반려' ? '<button class="btn btn-sm btn-primary" onclick="PG.polOnnara(\'' + v.ver + '\')">온나라 결재 상신</button>' : '') + '</div></div>';
                const main = sectionCard('경영방침 v' + v.ver + ' 상세', '<div class="pol-detail-grid"><div class="pol-detail-info">' + infoGrid + '</div>' + pdfPanel + '</div>', '');
                return subtabs + header + main + checkSec + boardSec;
            }
            function renderForm() {
                const body = '<div class="pol-detail-top"><button class="btn btn-sm btn-outline" onclick="PG.polBack()">‹ 취소</button><div style="font-weight:700;">경영방침 ' + S.draftType + ' 등록 · <span class="chip-mini wt-elec">v' + S.draftVer + '</span></div></div>' +
                    '<div class="preset-form-grid" style="margin-top:8px;">' +
                    '<span class="k">목표</span><input id="pol-form-goal" type="text" placeholder="경영방침 목표(슬로건)를 입력하세요">' +
                    '<span class="k">세부 방침</span><div><div id="pol-form-goals" class="goal-list">' + goalEditRow('') + '</div><button type="button" class="btn btn-sm btn-outline" style="margin-top:8px;" onclick="PG.polGoalAdd()">+ 세부 방침 추가</button></div>' +
                    '<span class="k">점검자</span><div class="orgpick-field"><div style="display:flex; gap:8px; align-items:center;"><input id="pol-form-inspector" type="text" value="재난안전과 · 재난안전과장 / 홍길동" readonly style="flex:1;"><button type="button" class="btn btn-sm btn-outline" onclick="PG.polPickInspector()">조직도</button></div></div>' +
                    '</div>' +
                    '<div style="display:flex; justify-content:flex-end; gap:8px; margin-top:18px;"><button class="btn btn-outline" onclick="PG.polBack()">취소</button><button class="btn btn-primary" onclick="PG.polSave()">저장</button></div>';
                return subtabs + sectionCard('경영방침 등록', body, '');
            }

            /* ===== 디스패치 ===== */
            const cur = POL.cur();
            if (S.tab === 'policy') return S.view === 'form' ? renderForm() : S.view === 'detail' ? renderDetail(cur) : renderListPolicy();
            if (S.tab === 'check') return S.view === 'detail' ? renderDetail(cur) : renderListCheck();
            return S.view === 'detail' ? renderDetail(cur) : renderListBoard();
        },

        /* ── 조직 [SFR-006·009·010]: 선임 등록 → 수행평가(F6) → 후속조치(F7) ── */
        org() {
            PG.orgAppoint = () => {
                V.openModal('안전·보건관리자 선임 등록',
                    '<div class="preset-form-grid">' +
                    '<span class="k">구분</span><select><option>안전관리자</option><option>보건관리자</option><option>안전보건관리책임자</option><option>관리감독자</option></select>' +
                    '<span class="k">성명 (조직도 선택)</span><input type="text" placeholder="행정포털 조직도에서 선택">' +
                    '<span class="k">선임일</span><input type="date" value="2026-06-11">' +
                    '<span class="k">자격</span><input type="text" placeholder="예: 산업안전기사">' +
                    '<span class="k">선임계 첨부</span><div class="upload-drop" style="padding:14px;">선임 신고서·자격증 사본 첨부</div></div>',
                    '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
                    '<button class="btn btn-primary" onclick="DYV2.closeModal(); EDOC.notify(\'선임 등록 완료 — 고용노동부 선임 신고 안내\', \'메일\')">등록</button>');
            };
            PG.orgEval = () => E.openForm({
                id: 'EDOC-수행평가-2026H1', title: '2026 상반기 안전보건관리책임자등 수행평가', form: 'F6',
                ctx: { menuLabel: '조직 · 반기', scorelist: T.SCORE_PRESETS.org }, onChange: render,
            });
            PG.orgFollow = () => E.openForm({
                id: 'EDOC-후속조치-2026H1', title: '수행평가 후속 조치 (포상·인사 반영)', form: 'F7',
                ctx: { menuLabel: '조직' }, source: '2026 상반기 수행평가 — 판정 미흡 1건',
                fields: { source: '수행평가: 예산·인력 지원의 충분성 — 보완 판정' }, onChange: render,
            });
            const team = (name, n) => '<div style="border:1px solid var(--card-line); border-radius:var(--radius-md); padding:10px 14px; text-align:center; background:#fff;"><div style="font-size:12px; font-weight:700;">' + name + '</div><div style="font-size:12px; color:var(--text-gray);">' + n + '명</div></div>';
            return sectionCard('조직도 (행정포털 연계)',
                '<div style="display:flex; flex-direction:column; align-items:center; gap:10px;">' +
                team('군수 (경영책임자)', 1) +
                '<div style="width:1px; height:14px; background:var(--card-line);"></div>' +
                team('재난안전과 중대재해팀 (전담조직)', 4) +
                '<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:10px; width:100%; margin-top:4px;">' +
                [['행정과', 12], ['환경과', 9], ['도시과', 11], ['회계과', 7], ['보건소', 15]].map(t => team(t[0], t[1])).join('') + '</div></div>',
                '<button class="btn btn-sm btn-secondary" onclick="EDOC.notify(\'행정포털 조직도 동기화 완료 — 612명\', \'시스템\')">조직도 동기화</button>') +
            sectionCard('안전관리자·보건관리자 선임 현황',
                tbl(['구분', '성명', '선임일', '자격', '상태'], [
                    ['안전관리자', '김안전', '2025-03-02', '산업안전기사', ST('완료')],
                    ['보건관리자', '이보건', '2025-03-02', '간호사', ST('완료')],
                    ['안전보건관리책임자', '박과장', '2025-01-02', '재난안전과장', ST('완료')],
                    ['관리감독자 (도시과)', '<span class="badge-unassigned">미선임</span>', '-', '-', '<button class="btn btn-sm btn-primary" onclick="PG.orgAppoint()">선임 등록</button>'],
                ])) +
            sectionCard('수행평가 · 후속조치 (반기) ' + docStChip('EDOC-수행평가-2026H1'),
                '<p style="font-size:12px; color:var(--text-gray);">경영책임자가 안전보건관리책임자등의 업무 수행을 반기 1회 평가하고, 미흡 판정은 후속 조치(포상·인사)로 이어집니다.</p>',
                '<div style="display:flex; gap:6px;">' +
                '<button class="btn btn-sm btn-primary" onclick="PG.orgEval()">수행평가 작성</button>' +
                '<button class="btn btn-sm btn-outline" onclick="PG.orgFollow()">후속조치 등록</button></div>');
        },

        /* ── 의견청취 [SFR-011]: 1메뉴 3탭(의견청취·건의함 / 산업안전보건위원회 / 협의체·점검표) — 기획 v0.1 + RFP 보완(접수경로·부서별·안건이행·점검결과지 CRUD) ── */
        opinion() {
            /* ===== 프로토타입 시각/이력 헬퍼 ===== */
            const PROTO_TODAY = '2026-07-02';
            const pad2 = n => String(n).padStart(2, '0');
            const nowStamp = () => { const d = new Date(); return PROTO_TODAY + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
            const addDays = (dateStr, n) => { const dt = new Date((dateStr || PROTO_TODAY) + 'T00:00:00Z'); if (isNaN(dt.getTime())) return '2026-07-31'; dt.setUTCDate(dt.getUTCDate() + n); return dt.toISOString().slice(0, 10); };
            const pushHist = (o, stage, text) => { o.history = o.history || []; o.history.push({ stage: stage, actor: '박안전', text: text || '', at: nowStamp() }); };
            /* 레거시 레코드(status:'처리중', plan/progress/result) → 5단계 상태 + history[] 마이그레이션 (최초 1회) */
            function migrateVoice(o) {
                if (o.status === '처리중') o.status = o.link ? '개선조치중' : '점검중';
                if (!o.history) {
                    const h = [{ stage: '접수', actor: '박안전', text: '의견 접수 — ' + (o.via || '온라인') + ' 경로', at: (o.date || PROTO_TODAY) + ' 09:00' }];
                    if (o.plan) h.push({ stage: o.link ? '개선조치 생성' : '현장점검 생성', actor: '박안전', text: o.plan, at: (o.date || PROTO_TODAY) + ' 10:00' });
                    (o.progress || []).forEach(p => h.push({ stage: '경과', actor: '박안전', text: p.text, at: (p.date || o.date || PROTO_TODAY) + ' 11:00' }));
                    if (o.status === '완료' && o.result) h.push({ stage: '완료', actor: '박안전', text: o.result, at: (o.date || PROTO_TODAY) + ' 15:00' });
                    if (o.status === '반려' && o.rejectReason) h.push({ stage: '반려', actor: '박안전', text: o.rejectReason, at: (o.date || PROTO_TODAY) + ' 15:00' });
                    o.history = h;
                }
                if (o.inspectLink && !o.inspect) o.inspect = { kind: '특별점검', date: addDays(o.date, 3), owner: o.owner || '재난안전과' };
                if (o.status === '완료') { o.completedAt = o.completedAt || ((o.date || PROTO_TODAY) + ' 15:00'); o.completedBy = o.completedBy || '박안전'; }
            }
            /* ===== SSOT (window.OPINION_STATE) ===== */
            if (!window.OPINION_STATE) {
                const named = [
                    { id: 'OPN-24', cat: '아차사고', title: '지게차 후진 중 충돌 위험 상황 발생', author: '박작업', date: '2026-04-22', status: '접수대기', via: '온라인', location: '물류창고 하역장', content: '지게차 후진 시 후방 작업자와 충돌 위험. 후방 감지센서·유도자 배치 필요.', inspectLink: false, link: '', plan: '', progress: [], result: '' },
                    { id: 'OPN-23', cat: '안전제안', title: '용접작업장 환기시설 개선 제안', author: '이기술', date: '2026-04-21', status: '처리중', via: '온라인', location: '정비동 용접실', content: '용접 흄 배기 불량. 국소배기장치 증설 제안.', inspectLink: true, link: '', plan: '용접실 국소배기장치 현장 점검 예정', progress: [], result: '' },
                    { id: 'OPN-22', cat: '위험신고', title: '2층 계단 난간 흔들림 현상', author: '최안전', date: '2026-04-20', status: '처리중', via: '온라인', location: '본관 2층 계단', content: '난간 고정부 풀림으로 흔들림. 낙상 위험.', inspectLink: false, link: 'IMP-204', plan: '난간 고정부 전수 점검 및 재시공', progress: [{ date: '2026-04-22', text: '현장 점검 완료 — 3개소 고정부 풀림 확인' }], result: '' },
                    { id: 'OPN-21', cat: '청취조사', title: '야간작업 피로도 관련 의견', author: '정근로', date: '2026-04-19', status: '처리중', via: '오프라인', location: '-', content: '야간 연속작업 피로 누적. 교대 주기 단축 검토 요청.', inspectLink: true, link: '', plan: '', progress: [], result: '' },
                    { id: 'OPN-20', cat: '안전제안', title: '안전모 턱끈 자동잠금 장치 도입 제안', author: '한제안', date: '2026-04-18', status: '완료', via: '온라인', location: '전 현장', content: '턱끈 미체결 방지 자동잠금 버클 도입 제안.', inspectLink: false, link: '', plan: '시범 도입 후 확대', progress: [{ date: '2026-04-25', text: '시범 물량 20개 도입' }], result: '시범 운영 양호 — 전 현장 확대 적용 완료' },
                    { id: 'OPN-19', cat: '아차사고', title: '자재 낙하 위험 상황 (B구역)', author: '강현장', date: '2026-04-17', status: '완료', via: '오프라인', location: 'B구역 자재적치장', content: '적치 높이 초과로 낙하 위험. 적치 기준 재정비.', inspectLink: false, link: 'IMP-198', plan: '적치 높이 기준 표지 부착·재배치', progress: [{ date: '2026-04-19', text: '적치 재배치 완료' }], result: '적치 기준 표지 부착 및 일일 점검 체계 수립 완료' },
                    { id: 'OPN-18', cat: '위험신고', title: '전기배선 피복 손상 발견', author: '오전기', date: '2026-04-16', status: '완료', via: '오프라인', location: '기계실 분전반', content: '배선 피복 손상으로 감전 위험.', inspectLink: false, link: 'IMP-195', plan: '손상 배선 즉시 교체', progress: [{ date: '2026-04-16', text: '긴급 차단 후 교체' }], result: '손상 배선 전량 교체 완료' },
                    { id: 'OPN-17', cat: '청취조사', title: '보호구 착용 불편사항 의견', author: '윤작업', date: '2026-04-15', status: '반려', via: '온라인', location: '-', content: '보호장갑 사이즈 부족 의견.', inspectLink: false, link: '', plan: '', progress: [], result: '', rejectReason: '규격 보호구 비치 완료 — 기존 조치와 중복' },
                ];
                const fCat = ['안전제안', '위험신고', '아차사고', '청취조사'];
                const fSt = ['완료', '완료', '접수대기', '처리중'];
                const fDept = ['재난안전과', '행정과', '환경과', '도시과'];
                const fTitle = ['배수로 덮개 파손 신고', '휴게실 환기 개선 제안', '고소작업 안전대 부착설비 요청', '중장비 신호수 배치 건의', '소화기 비치 위치 의견', '미끄럼 방지 매트 설치 제안', '분진 마스크 지급 요청', '경고표지 추가 설치 신고'];
                const seed = named.slice();
                for (let k = 0; k < 16; k++) {
                    const n = 16 - k;
                    const mo = 3 - (k % 3);
                    const dy = 28 - k;
                    seed.push({ id: 'OPN-' + (n < 10 ? '0' + n : n), cat: fCat[k % 4], title: fTitle[k % 8], author: '종사자' + (k + 1), date: '2026-0' + mo + '-' + (dy < 10 ? '0' + dy : dy), status: fSt[k % 4], via: (k % 2 ? '온라인' : '오프라인'), location: '-', content: '(현장 종사자 등록 의견)', owner: (fSt[k % 4] === '접수대기' ? '' : fDept[k % 4]), inspectLink: (k % 3 === 0), link: (fSt[k % 4] === '완료' ? 'IMP-' + (180 + k) : ''), plan: '', progress: [], result: '' });
                }
                ['', '재난안전과', '도시과', '재난안전과', '행정과', '재난안전과', '도시과', '재난안전과'].forEach((d, i) => { if (named[i]) named[i].owner = d; });
                window.OPINION_STATE = {
                    tab: 'voice', view: 'list', id: null, page: 1, fcat: '', fstatus: '', fdept: '',
                    VOICES: seed,
                    COMMITTEE: {
                        members: [
                            { role: '위원장(사용자대표)', dept: '재난안전과', position: '과장', name: '홍길동' },
                            { role: '사용자위원', dept: '행정과', position: '과장', name: '김행정' },
                            { role: '근로자대표', dept: '환경과', position: '주무관', name: '이근로' },
                            { role: '근로자위원', dept: '도시과', position: '주무관', name: '박작업' },
                            { role: '간사', dept: '재난안전과', position: '중대재해팀장', name: '정안전' },
                        ],
                        meetings: [
                            { round: '2026 2분기', type: '정기', date: '2026-06-25', place: '군청 상황실', attendeeList: [{ dept: '재난안전과', position: '과장', name: '홍길동' }, { dept: '행정과', position: '과장', name: '김행정' }, { dept: '환경과', position: '주무관', name: '이근로' }, { dept: '도시과', position: '주무관', name: '박작업' }, { dept: '재난안전과', position: '중대재해팀장', name: '정안전' }], agenda: '위험성평가 결과 공유, 의견청취 처리 현황, 하반기 점검계획', decisions: ['하반기 정기 점검계획 확정', '의견청취 처리 지연 건 부서별 조치 지시', '위험성평가 미조치 항목 개선 요구'], status: '확정' },
                            { round: '2026 1분기', type: '정기', date: '2026-03-20', place: '군청 대회의실', attendeeList: [{ dept: '재난안전과', position: '과장', name: '홍길동' }, { dept: '행정과', position: '과장', name: '김행정' }, { dept: '환경과', position: '주무관', name: '이근로' }], agenda: '2026 안전보건 목표, 예산 심의', decisions: ['2026 안전보건 목표 승인', '안전보건 예산안 심의 통과'], status: '확정' },
                            { round: '2025 4분기', type: '정기', date: '2025-12-18', place: '군청 상황실', attendeeList: [{ dept: '재난안전과', position: '과장', name: '홍길동' }, { dept: '재난안전과', position: '중대재해팀장', name: '정안전' }], agenda: '연간 안전보건 실적 보고', decisions: ['연간 실적 보고 채택', '차년도 개선 방향 논의'], status: '확정' },
                        ],
                        agendaItems: [
                            { agenda: '위험성평가 미조치 항목 개선', dept: '도시과', due: '2026-07-15', status: '진행' },
                            { agenda: '의견청취 처리 지연 건 해소', dept: '재난안전과', due: '2026-06-30', status: '완료' },
                            { agenda: '노후 시설 안전점검 강화', dept: '행정과', due: '2026-07-31', status: '지연' },
                            { agenda: '하반기 안전보건교육 계획 수립', dept: '행정과', due: '2026-07-10', status: '진행' },
                        ],
                    },
                    COUNCIL: {
                        cycle: '월간',
                        members: [
                            { role: '협의체 의장', dept: '재난안전과', position: '중대재해팀장', name: '정안전' },
                            { role: '도급인 측', dept: '회계과', position: '주무관', name: '서회계' },
                            { role: '수급인 측', dept: '(주)안전건설', position: '현장소장', name: '강현장' },
                            { role: '수급인 측', dept: '(주)클린환경', position: '반장', name: '오환경' },
                        ],
                        results: [
                            { round: '2026-06', date: '2026-06-15', content: '5월 합동순회점검 결과 공유, 하절기 온열질환 예방대책 논의', result: '온열질환 예방 그늘막·아이스조끼 현장 배치 완료', status: '완료' },
                            { round: '2026-05', date: '2026-05-14', content: '4월 협의체 운영 결과 점검, 수급인 안전교육 이수 현황 점검', result: '미이수자 3명 추가 교육 실시 완료', status: '완료' },
                            { round: '2026-04', date: '2026-04-16', content: '신규 수급업체 (주)클린환경 합류 안내, 작업장 순회점검 주기 조정 논의', result: '순회점검 주기 월 2회로 조정 — 시행 여부 후속 확인 필요', status: '진행중' },
                        ],
                        checklists: [
                            { id: 'CHK-06', cat: '용역', date: '2026-06-20', inspector: '정안전', result: '미흡', appr: '미상신', items: [
                                { q: '도급 시 안전·보건 협의체를 구성·운영하였는가', r: '확인' },
                                { q: '작업장 합동 순회점검(2일 1회)을 실시하였는가', r: '미흡', note: '6월 1회 누락' },
                                { q: '수급인에게 안전·보건 정보를 사전 제공하였는가', r: '확인' },
                                { q: '종사자 의견청취를 실시하고 결과를 반영하였는가', r: '확인' },
                            ] },
                            { id: 'CHK-05', cat: '구매설치', date: '2026-06-18', inspector: '정안전', result: '적합', appr: '승인완료', items: [
                                { q: '설치 작업 위험성평가를 실시하였는가', r: '확인' },
                                { q: '안전작업 절차서를 공유하였는가', r: '확인' },
                            ] },
                            { id: 'CHK-04', cat: '위탁사업', date: '2026-05-30', inspector: '정안전', result: '적합', appr: '미상신', items: [
                                { q: '위탁 종사자 안전교육 이수를 확인하였는가', r: '확인' },
                            ] },
                            { id: 'CHK-03', cat: '기타', date: '2026-05-15', inspector: '정안전', result: '미흡', appr: '반려', items: [
                                { q: '안전보건 협의체 결과를 게시·공유하였는가', r: '미흡', note: '게시 누락' },
                            ] },
                        ],
                    },
                };
            }
            const S = window.OPINION_STATE;
            if (!S._migrated) { S.VOICES.forEach(migrateVoice); S._migrated = true; }
            /* SNB(sub 파라미터)가 곧 현재 탭 — 탭 간 이동은 SNB 페이지 이동으로 일어남 */
            if (OPN_SUB) S.tab = OPN_SUB;
            const PER = 8;
            const CATS = ['아차사고', '안전제안', '위험신고', '청취조사'];
            const DEPTS = ['재난안전과', '행정과', '환경과', '도시과', '미배정'];
            const CHK_CATS = ['용역', '구매설치', '위탁사업', '기타'];
            const CHK_QS = ['도급 시 안전·보건 협의체를 구성·운영하였는가', '작업장 합동 순회점검을 주기적으로 실시하였는가', '수급인에게 안전·보건 정보를 사전 제공하였는가', '종사자 의견청취를 실시하고 결과를 반영하였는가', '안전보건 협의체 결과를 게시·공유하였는가'];
            /* 5단계 상태 (DESIGN-TOKENS §5): 접수대기 → 점검중 | 개선조치중 → 완료 (+반려) */
            const ST_ORDER = ['접수대기', '점검중', '개선조치중', '완료', '반려'];
            const ST_COLOR = { '접수대기': 'neutral', '점검중': 'info', '개선조치중': 'warning', '완료': 'success', '반려': 'danger' };
            const catChip = c => '<span class="chip-status ' + ({ '아차사고': 'warning', '안전제안': 'info', '위험신고': 'purple', '청취조사': 'success' }[c] || 'neutral') + '">' + c + '</span>';
            const stChip = st => '<span class="chip-status ' + (ST_COLOR[st] || 'neutral') + '">' + st + '</span>';
            /* 개선조치중 의견: 연계된 개선조치가 종결되면 자동으로 완료 전이 (렌더 시점 동기화) */
            function syncAutoTransition() {
                const imps = E.improvements();
                S.VOICES.forEach(o => {
                    if (o.status === '개선조치중' && o.link) {
                        const imp = imps.find(x => x.id === o.link);
                        if (imp && imp.status === '종결') {
                            o.status = '완료';
                            o.completedAt = nowStamp(); o.completedBy = '박안전';
                            o.result = o.result || ('개선조치 ' + o.link + ' 종결 — 조치 완료');
                            pushHist(o, '완료', '개선조치 ' + o.link + ' 완료 — 자동 전이');
                        }
                    }
                });
            }
            syncAutoTransition();
            const apprColor = a => ({ '미상신': 'neutral', '결재중': 'info', '승인완료': 'success', '반려': 'danger' }[a] || 'neutral');
            const apprChip = a => '<span class="chip-status ' + apprColor(a) + '">' + (a || '미상신') + '</span>';
            const chkResultChip = r => (r === '미흡' ? '<span class="chip-status danger">미흡</span>' : '<span class="chip-status success">적합</span>');
            const chkItemChip = r => (r === '확인' ? '<span class="chip-status success">확인</span>' : r === '미흡' ? '<span class="chip-status danger">미흡</span>' : '<span class="chip-status neutral">해당없음</span>');
            const chkPdfPaper = c => '<div class="pdf-paper">' +
                '<div class="pdf-head"><span>담양군 의견청취·협의체 점검결과지</span><span>문서번호 ' + c.id + '</span></div>' +
                '<div class="pdf-title">' + V.esc(c.cat) + ' 점검결과지</div>' +
                '<div class="pdf-slogan">점검일 ' + c.date + ' · 점검자 ' + V.esc(c.inspector) + ' · 종합결과 ' + c.result + '</div>' +
                '<div class="pdf-sec">점검 항목</div><ol class="pdf-list">' + c.items.map(it => '<li>' + V.esc(it.q) + ' — <b>' + it.r + '</b>' + (it.note ? ' (' + V.esc(it.note) + ')' : '') + '</li>').join('') + '</ol>' +
                '<div class="pdf-sign">시행일 ' + c.date + '<br><br><b>담양군수</b> (직인)</div>' +
                '</div>';
            const linkChips = o => (o.inspectLink ? '<span class="chip-mini wt-elec"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:3px;" aria-hidden="true"><path d="M9 15a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M15 9a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/></svg>안전점검 연동</span> ' : '') + (o.link ? '<span class="chip-mini pdca"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:3px;" aria-hidden="true"><path d="M9 15a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M15 9a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/></svg>개선조치 연동</span>' : '');
            const find = id => S.VOICES.find(x => x.id === id);
            const nextNum = arr => { let m = 0; arr.forEach(x => { const g = /(\d+)$/.exec(x.id || ''); if (g && +g[1] > m) m = +g[1]; }); return m + 1; };

            /* ===== 라우터 ===== */
            PG.opnGo = (tab, view, id) => { if (tab) S.tab = tab; if (view) S.view = view; if (id !== undefined) S.id = id; render(); };
            PG.opnTab = name => PG.opnGo(name, 'list', null);
            PG.opnOpen = id => PG.opnGo(S.tab, 'detail', id);
            PG.opnBack = () => PG.opnGo(S.tab, 'list', null);
            PG.opnNew = () => PG.opnGo('voice', 'form', null);
            PG.opnPage = p => { S.page = p < 1 ? 1 : p; render(); };
            PG.opnSetKw = v => { S.fkw = v; S.page = 1; render(); };
            PG.opnSetCat = v => { S.fcat = v; S.page = 1; render(); };
            PG.opnSetStatus = v => { S.fstatus = v; S.page = 1; render(); };
            PG.opnSetDept = v => { S.fdept = v; S.page = 1; render(); };
            /* 화면 내 2차 탭 (위원회 3탭 / 협의체 2탭) — 탭 상태는 페이지 내 유지 */
            PG.opnCmtTab = t => { S.cmtTab = t; render(); };
            PG.opnCnlTab = t => { S.cnlTab = t; render(); };

            /* ===== 의견 등록 (온라인 / 오프라인 담당자 대리 입력) ===== */
            PG.opnSave = () => {
                const cat = (document.getElementById('opn-cat') || {}).value || '';
                const via = (document.getElementById('opn-via') || {}).value || '온라인';
                const author = ((document.getElementById('opn-author') || {}).value || '').trim();
                const title = ((document.getElementById('opn-title') || {}).value || '').trim();
                const loc = ((document.getElementById('opn-loc') || {}).value || '').trim();
                const content = ((document.getElementById('opn-content') || {}).value || '').trim();
                if (!cat) { V.toast('분류를 선택하세요'); return; }
                if (!title) { V.toast('제목을 입력하세요'); return; }
                if (!content) { V.toast('상세내용을 입력하세요'); return; }
                const writer = author || (via === '온라인' ? '김대표' : '(현장 종사자)');
                const rec = { id: 'OPN-' + nextNum(S.VOICES), cat: cat, title: title, location: loc || '-', content: content, author: writer, date: PROTO_TODAY, status: '접수대기', via: via, owner: '', inspectLink: false, inspect: null, link: '', result: '', history: [] };
                pushHist(rec, '접수', '의견 접수 — ' + via + ' 경로');
                S.VOICES.unshift(rec);
                S.page = 1; PG.opnGo('voice', 'list', null);
                E.notify('의견 접수 알림 — "' + title + '" (' + via + ' 접수, 의견청취 담당)', '문자');
                V.toast('의견이 등록되었습니다' + (via === '오프라인' ? ' (담당자 대리 등록)' : ''));
            };

            /* ===== 처리: 상세 화면 인라인 '처리 카드'에서 조치 방법 선택 → 상태 전이 ===== */
            const deptOf = s => (String(s || '').split(' · ')[0] || s || '').trim();
            const valOf = elId => ((document.getElementById(elId) || {}).value || '').trim();
            /* 라디오 선택 시: 카드 강조 토글 + 인라인 폼 펼침 + 저장 버튼 활성화 */
            PG.opnActSel = radio => {
                document.querySelectorAll('.opn-act-opt').forEach(opt => {
                    const on = opt.getAttribute('data-act') === radio.value;
                    opt.classList.toggle('on', on);
                    const form = opt.querySelector('.opn-act-form'); if (form) form.hidden = !on;
                });
                const btn = document.getElementById('opn-act-save'); if (btn) btn.disabled = false;
            };
            PG.opnActSave = id => {
                const o = find(id); if (!o) return;
                const act = (document.querySelector('input[name=opn-act]:checked') || {}).value;
                if (!act) { V.toast('조치 방법을 선택하세요'); return; }
                if (act === 'inspect') {
                    const kind = valOf('opn-i-kind') || '특별점검';
                    const date = valOf('opn-i-date') || addDays(PROTO_TODAY, 7);
                    const owner = valOf('opn-i-owner');
                    const note = valOf('opn-i-note');
                    o.status = '점검중'; o.inspectLink = true; o.owner = deptOf(owner) || o.owner;
                    o.inspect = { kind: kind, date: date, owner: owner };
                    pushHist(o, '현장점검 생성', '현장점검 생성 — ' + kind + ' · 담당 ' + owner + ' · 예정 ' + date + (note ? ' · 확인사항: ' + note : ''));
                    render(); V.toast('현장점검이 생성되었습니다 — 안전점검 연동');
                } else if (act === 'improve') {
                    const owner = valOf('opn-m-owner');
                    const due = valOf('opn-m-due') || addDays(PROTO_TODAY, 14);
                    const desc = valOf('opn-m-desc');
                    if (!desc) { V.toast('개선 내용을 입력하세요'); return; }
                    const imp = E.addImprovement({ title: desc.split('\n')[0], sourceMenu: '의견청취', sourceDoc: o.id, owner: owner, due: due });
                    o.status = '개선조치중'; o.link = imp.id; o.owner = deptOf(owner) || o.owner;
                    pushHist(o, '개선조치 생성', '개선조치 ' + imp.id + ' 생성 — 담당 ' + owner + ' · 예정 ' + due);
                    render(); V.toast('개선조치 ' + imp.id + ' 생성 — 개선조치 메뉴에 집계');
                } else if (act === 'reject') {
                    const reason = valOf('opn-r-reason');
                    if (!reason) { V.toast('반려 사유를 입력하세요'); return; }
                    if (!window.confirm('반려 처리하시겠습니까? 되돌리려면 재처리해야 합니다.')) return;
                    o.status = '반려'; o.rejectReason = reason;
                    pushHist(o, '반려', reason);
                    render(); V.toast('반려 처리되었습니다');
                }
            };
            /* 경과 추가 — 이력에만 기록 */
            PG.opnProgress = id => {
                const o = find(id); if (!o) return;
                V.openModal('경과 추가 — ' + V.esc(o.title),
                    '<div class="preset-form-grid"><span class="k">경과 내용</span><textarea id="opn-prog" placeholder="진행 상황을 입력하세요"></textarea></div>',
                    '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button><button class="btn btn-primary" id="opn-prog-save">추가</button>');
                document.getElementById('opn-prog-save').addEventListener('click', () => {
                    const t = ((document.getElementById('opn-prog') || {}).value || '').trim();
                    if (!t) { V.toast('경과 내용을 입력하세요'); return; }
                    pushHist(o, '경과', t);
                    V.closeModal(); render(); V.toast('경과가 추가되었습니다');
                });
            };
            /* 완료 처리 — 수동 완료(데모) */
            PG.opnComplete = id => {
                const o = find(id); if (!o) return;
                V.openModal('완료 처리 — ' + V.esc(o.title),
                    '<div class="preset-form-grid"><span class="k">처리 결과</span><textarea id="opn-result" placeholder="처리 결과를 입력하세요">' + V.esc(o.result || '') + '</textarea></div>',
                    '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button><button class="btn btn-primary" id="opn-done-save">완료 처리</button>');
                document.getElementById('opn-done-save').addEventListener('click', () => {
                    o.result = ((document.getElementById('opn-result') || {}).value || '').trim();
                    o.status = '완료'; o.completedAt = nowStamp(); o.completedBy = '박안전';
                    pushHist(o, '완료', o.result || '조치 완료');
                    V.closeModal(); render();
                    E.notify('의견 처리 결과 회신 — "' + o.title + '" 조치 완료', '문자');
                    V.toast('완료 처리되었습니다 — 작성자에게 결과 회신');
                });
            };
            /* 재처리 — 완료/반려를 접수대기로 되돌림 */
            PG.opnReopen = id => {
                const o = find(id); if (!o) return;
                if (!window.confirm('처리를 취소하고 접수대기 상태로 되돌리시겠습니까?')) return;
                o.status = '접수대기'; o.inspectLink = false; o.inspect = null; o.link = ''; o.rejectReason = ''; o.result = ''; o.completedAt = null; o.completedBy = null;
                pushHist(o, '재처리', '처리를 취소하고 접수대기로 되돌림');
                render(); V.toast('접수대기로 되돌렸습니다');
            };

            /* ===== 위원회 회의록 (목록 클릭 → 상세 페이지) / 협의체 공유 ===== */
            PG.opnMeetingOpen = round => PG.opnGo('committee', 'mdetail', round);
            /* 회의록 작성/편집 — 참석자는 작성 시에만 조직도에서 클릭 즉시 토글 */
            PG.opnMtgFormOpen = round => { S.mtgDraft = null; PG.opnGo('committee', 'mform', (round == null ? '__new__' : round)); };
            PG.opnMtgFormCancel = () => { S.mtgDraft = null; PG.opnGo('committee', 'list', null); };
            function attChipsHtml() {
                return (S.mtgDraft && S.mtgDraft.attendees.length) ? S.mtgDraft.attendees.map((a, ix) => '<span class="att-chip">' + V.esc(a.name) + ' <span class="att-sub">' + V.esc(a.dept) + (a.position ? (' ' + V.esc(a.position)) : '') + '</span><button type="button" class="att-chip-x" onclick="PG.opnMtgRemAtt(' + ix + ')" aria-label="참석자 제외">&times;</button></span>').join('') : '<span class="att-empty">아래 조직도에서 참석자를 클릭해 추가하세요.</span>';
            }
            function syncAtt() {
                const chips = document.getElementById('mtg-att-chips'); if (chips) chips.innerHTML = attChipsHtml();
                const cnt = document.getElementById('mtg-att-count'); if (cnt) cnt.textContent = (S.mtgDraft ? S.mtgDraft.attendees.length : 0);
                document.querySelectorAll('.org-inline .otr-member').forEach(b => b.classList.toggle('on', !!(S.mtgDraft && S.mtgDraft.attendees.some(a => a.dept === b.dataset.dept && a.name === b.dataset.name))));
            }
            PG.opnMtgTogAtt = (btn, dept, role, name) => {
                if (!S.mtgDraft) return;
                const i = S.mtgDraft.attendees.findIndex(a => a.dept === dept && a.name === name);
                if (i >= 0) S.mtgDraft.attendees.splice(i, 1); else S.mtgDraft.attendees.push({ dept: dept, position: role, name: name });
                syncAtt();
            };
            PG.opnMtgRemAtt = ix => { if (!S.mtgDraft) return; S.mtgDraft.attendees.splice(ix, 1); syncAtt(); };
            /* 의결사항 — 세부 방침(goalEditRow)과 동일한 행 추가/삭제 패턴, 저장 시점에 DOM에서 직접 수집 */
            const decisionRow = val => '<div class="goal-row"><input type="text" class="mf-decision" value="' + V.esc(val) + '" placeholder="의결사항을 입력하세요"><button type="button" class="goal-del" onclick="this.closest(\'.goal-row\').remove()" aria-label="삭제">×</button></div>';
            PG.opnMtgDecisionAdd = () => { const l = document.getElementById('mf-decisions'); if (!l) return; l.insertAdjacentHTML('beforeend', decisionRow('')); const ii = l.querySelectorAll('input'); if (ii.length) ii[ii.length - 1].focus(); };
            PG.opnMtgFormSave = () => {
                const round = ((document.getElementById('mf-round') || {}).value || '').trim();
                if (!round) { V.toast('회차를 입력하세요'); return; }
                const editing = S.mtgDraft && S.mtgDraft.key !== '__new__';
                const decisions = Array.prototype.slice.call(document.querySelectorAll('#mf-decisions .mf-decision')).map(i => i.value.trim()).filter(Boolean);
                const linkAgenda = !!(document.getElementById('mf-link-agenda') || {}).checked;
                const rec = { round: round, type: (document.getElementById('mf-type') || {}).value || '정기', date: (document.getElementById('mf-date') || {}).value || '-', place: ((document.getElementById('mf-place') || {}).value || '').trim() || '-', attendeeList: (S.mtgDraft ? S.mtgDraft.attendees.slice() : []), agenda: ((document.getElementById('mf-agenda') || {}).value || '').trim() || '-', decisions: decisions, status: '작성' };
                if (editing) { const ix = S.COMMITTEE.meetings.findIndex(x => x.round === S.mtgDraft.key); if (ix >= 0) { rec.status = S.COMMITTEE.meetings[ix].status || '작성'; S.COMMITTEE.meetings[ix] = rec; } else S.COMMITTEE.meetings.unshift(rec); }
                else { S.COMMITTEE.meetings.unshift(rec); }
                S.mtgDraft = null;
                if (linkAgenda && decisions.length) {
                    const due = addDays(rec.date, 30);
                    decisions.forEach(d => S.COMMITTEE.agendaItems.push({ agenda: d, dept: '재난안전과', due: due, status: '진행' }));
                }
                PG.opnGo('committee', 'mdetail', rec.round);
                V.toast('회의록이 ' + (editing ? '수정' : '작성') + '되었습니다' + (linkAgenda && decisions.length ? ' — 의결사항 ' + decisions.length + '건이 안건 부서이행 현황에 등록되었습니다' : ''));
            };
            PG.opnMtgConfirm = round => {
                const mt = (S.COMMITTEE.meetings || []).find(x => x.round === round); if (!mt) return;
                if (!window.confirm('이 회의록을 확정하시겠습니까? 확정 후에는 편집할 수 없습니다.')) return;
                mt.status = '확정'; render(); V.toast('회의록이 확정되었습니다');
            };

            /* ===== 위원 구성 / 안건 부서이행 / 협의체 운영 — 관리(CRUD) ===== */
            function memberModal(scope, i) {
                const isCouncil = scope === 'council';
                const list = isCouncil ? S.COUNCIL.members : S.COMMITTEE.members;
                const ex = i >= 0 ? list[i] : null;
                const roles = isCouncil ? ['협의체 의장', '도급인 측', '수급인 측', '근로자대표', '기타'] : ['위원장(사용자대표)', '사용자위원', '근로자대표', '근로자위원', '간사'];
                const roleOpts = roles.map(rr => '<option' + (ex && ex.role === rr ? ' selected' : '') + '>' + rr + '</option>').join('');
                const memOrgVal = ex ? (ex.dept + ' · ' + ex.position + ' / ' + ex.name) : '';
                V.openModal((ex ? '위원 수정' : '위원 추가') + ' — ' + (isCouncil ? '안전보건 협의체' : '산업안전보건위원회'),
                    '<div class="preset-form-grid">' +
                    '<span class="k">구분</span><select id="mem-role">' + roleOpts + '</select>' +
                    '<span class="k">위원(조직도)</span><div class="orgpick-field"><div style="display:flex; gap:8px; align-items:center;"><input id="mem-org" type="text" readonly value="' + V.esc(memOrgVal) + '" placeholder="조직도에서 위원을 선택하세요" style="flex:1;"><button type="button" class="btn btn-sm btn-outline" onclick="EDOC.openOrgTree(\'mem-org\')">조직도</button></div></div>' +
                    '</div>' +
                    '<p style="font-size:var(--fs-12); color:var(--text-gray); margin:10px 0 0;">조직도에서 위원을 선택하면 부서·직책·성명이 자동 입력됩니다.</p>',
                    '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button><button class="btn btn-primary" id="mem-save">저장</button>');
                document.getElementById('mem-save').addEventListener('click', () => {
                    const picked = ((document.getElementById('mem-org') || {}).value || '').trim();
                    if (!picked) { V.toast('조직도에서 위원을 선택하세요'); return; }
                    const parts = picked.split(' · ');
                    const rest = (parts[1] || '').split(' / ');
                    const dept = (parts[0] || '').trim() || '-';
                    const position = (rest[0] || '').trim() || '-';
                    const name = (rest[1] || '').trim();
                    if (!name) { V.toast('조직도에서 위원을 선택하세요'); return; }
                    const rec = { role: (document.getElementById('mem-role') || {}).value, dept: dept, position: position, name: name };
                    if (ex) list[i] = rec; else list.push(rec);
                    V.closeModal(); render(); V.toast('위원이 ' + (ex ? '수정' : '추가') + '되었습니다');
                    if (!isCouncil) { const emp = list.filter(m => /근로자/.test(m.role)).length, usr = list.filter(m => /사용자|위원장/.test(m.role)).length; if (emp !== usr) setTimeout(() => V.toast('참고: 근로자(' + emp + ')·사용자(' + usr + ') 위원 수가 다릅니다 (산안법 §24 노사 동수 권고)'), 900); }
                });
            }
            PG.opnMemberAdd = scope => memberModal(scope, -1);
            PG.opnMemberEdit = (scope, i) => memberModal(scope, i);
            PG.opnMemberDel = (scope, i) => { const list = scope === 'council' ? S.COUNCIL.members : S.COMMITTEE.members; if (!window.confirm('이 위원을 삭제하시겠습니까?')) return; list.splice(i, 1); render(); V.toast('위원이 삭제되었습니다'); };
            function agendaModal(i) {
                const list = S.COMMITTEE.agendaItems; const ex = i >= 0 ? list[i] : null;
                const stOpts = ['진행', '완료', '지연'].map(s => '<option' + (ex && ex.status === s ? ' selected' : '') + '>' + s + '</option>').join('');
                V.openModal((ex ? '안건 이행 수정' : '안건 추가') + ' — 산업안전보건위원회',
                    '<div class="preset-form-grid">' +
                    '<span class="k">의결 안건</span><input id="ag-agenda" type="text" value="' + V.esc(ex ? ex.agenda : '') + '" placeholder="위원회 의결 안건">' +
                    '<span class="k">담당부서(조직도)</span><div class="orgpick-field"><div style="display:flex; gap:8px; align-items:center;"><input id="ag-dept" type="text" readonly value="' + V.esc(ex ? ex.dept : '') + '" placeholder="조직도에서 담당부서를 선택하세요" style="flex:1;"><button type="button" class="btn btn-sm btn-outline" onclick="EDOC.openOrgTree(\'ag-dept\')">조직도</button></div></div>' +
                    '<span class="k">이행기한</span><input id="ag-due" type="date" value="' + (ex ? ex.due : '2026-07-31') + '">' +
                    '<span class="k">이행상태</span><select id="ag-status">' + stOpts + '</select></div>' +
                    '<p style="font-size:var(--fs-12); color:var(--text-gray); margin:10px 0 0;">조직도에서 담당자를 선택하면 소속 부서가 담당부서로 지정됩니다.</p>',
                    '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button><button class="btn btn-primary" id="ag-save">저장</button>');
                document.getElementById('ag-save').addEventListener('click', () => {
                    const agenda = ((document.getElementById('ag-agenda') || {}).value || '').trim();
                    if (!agenda) { V.toast('의결 안건을 입력하세요'); return; }
                    const deptRaw = ((document.getElementById('ag-dept') || {}).value || '').trim();
                    if (!deptRaw) { V.toast('조직도에서 담당부서를 선택하세요'); return; }
                    const dept = (deptRaw.split(' · ')[0] || deptRaw).trim();
                    const rec = { agenda: agenda, dept: dept, due: (document.getElementById('ag-due') || {}).value || '-', status: (document.getElementById('ag-status') || {}).value };
                    if (ex) list[i] = rec; else list.push(rec);
                    V.closeModal(); render(); V.toast('안건 이행 현황이 ' + (ex ? '수정' : '추가') + '되었습니다');
                });
            }
            PG.opnAgendaAdd = () => agendaModal(-1);
            PG.opnAgendaEdit = i => agendaModal(i);
            PG.opnAgendaDel = i => { if (!window.confirm('이 안건을 삭제하시겠습니까?')) return; S.COMMITTEE.agendaItems.splice(i, 1); render(); V.toast('안건이 삭제되었습니다'); };
            PG.opnCouncilCycle = () => {
                V.openModal('협의체 운영 주기 변경',
                    '<div class="preset-form-grid"><span class="k">운영 주기</span><select id="co-cycle">' + ['월간', '분기', '반기', '수시'].map(c => '<option' + (S.COUNCIL.cycle === c ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></div>',
                    '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button><button class="btn btn-primary" id="co-cycle-save">저장</button>');
                document.getElementById('co-cycle-save').addEventListener('click', () => { S.COUNCIL.cycle = (document.getElementById('co-cycle') || {}).value; V.closeModal(); render(); V.toast('운영 주기가 변경되었습니다'); });
            };

            /* ===== 협의체 운영 결과 기록 — 단일 모달 CRUD (라이트, 회의록만큼 무겁게 만들지 않음) ===== */
            function councilResultModal(i) {
                const list = S.COUNCIL.results || (S.COUNCIL.results = []);
                const ex = i >= 0 ? list[i] : null;
                const stOpts = ['진행중', '완료'].map(s => '<option' + (ex && ex.status === s ? ' selected' : '') + '>' + s + '</option>').join('');
                V.openModal((ex ? '운영 결과 수정' : '운영 결과 등록') + ' — 안전보건 협의체',
                    '<div class="preset-form-grid">' +
                    '<span class="k">회차</span><input id="cr-round" type="text" value="' + V.esc(ex ? ex.round : '') + '" placeholder="예: 2026-07">' +
                    '<span class="k">일자</span><input id="cr-date" type="date" value="' + (ex ? ex.date : '2026-06-30') + '">' +
                    '<span class="k">참석·논의 내용</span><textarea id="cr-content" placeholder="참석 현황 및 논의 내용을 입력하세요">' + V.esc(ex ? ex.content : '') + '</textarea>' +
                    '<span class="k">결과 요약</span><textarea id="cr-result" placeholder="협의 결과를 입력하세요">' + V.esc(ex ? ex.result : '') + '</textarea>' +
                    '<span class="k">상태</span><select id="cr-status">' + stOpts + '</select>' +
                    '</div>',
                    '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button><button class="btn btn-primary" id="cr-save">저장</button>');
                document.getElementById('cr-save').addEventListener('click', () => {
                    const round = ((document.getElementById('cr-round') || {}).value || '').trim();
                    if (!round) { V.toast('회차를 입력하세요'); return; }
                    const rec = { round: round, date: (document.getElementById('cr-date') || {}).value || '-', content: ((document.getElementById('cr-content') || {}).value || '').trim(), result: ((document.getElementById('cr-result') || {}).value || '').trim(), status: (document.getElementById('cr-status') || {}).value };
                    if (ex) list[i] = rec; else list.unshift(rec);
                    V.closeModal(); render(); V.toast('협의체 운영 결과가 ' + (ex ? '수정' : '등록') + '되었습니다');
                });
            }
            PG.opnResultAdd = () => councilResultModal(-1);
            PG.opnResultEdit = i => councilResultModal(i);
            PG.opnResultDel = i => { if (!window.confirm('이 운영 결과를 삭제하시겠습니까?')) return; S.COUNCIL.results.splice(i, 1); render(); V.toast('운영 결과가 삭제되었습니다'); };

            /* ===== 점검결과지 (협의체 점검표) — 생성·수정·조회(상세)·삭제 + 온나라 결재 + PDF ===== */
            function opnChkModal(ex) {
                const isEdit = !!ex;
                const DEPT4 = DEPTS.slice(0, 4);
                const catOpts = CHK_CATS.map(c => '<option' + (ex && ex.cat === c ? ' selected' : '') + '>' + c + '</option>').join('');
                const itemsHtml = CHK_QS.map((q, i) => {
                    const saved = (ex && ex.items[i]) ? ex.items[i].r : '확인';
                    const savedOwner = (ex && ex.items[i] && ex.items[i].owner) || DEPT4[0];
                    const savedDue = (ex && ex.items[i] && ex.items[i].due) || '2026-07-31';
                    return '<div class="opn-chk-row" style="flex-direction:column; align-items:stretch; gap:8px;">' +
                        '<div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">' +
                        '<div class="opn-chk-q">' + (i + 1) + '. ' + q + '</div><div class="opn-chk-opts">' +
                        ['확인', '미흡', '해당없음'].map(r => '<label><input type="radio" name="opn-chk-' + i + '" value="' + r + '" onchange="PG.opnChkToggleFix(' + i + ',this.value)"' + (r === saved ? ' checked' : '') + '> ' + r + '</label>').join('') + '</div></div>' +
                        '<div id="opn-chk-fix-' + i + '" style="display:' + (saved === '미흡' ? 'flex' : 'none') + '; align-items:center; gap:8px; padding-top:8px; border-top:1px dashed var(--gray-200); flex-wrap:wrap;">' +
                        '<span style="font-size:var(--fs-12); color:var(--text-gray);">담당부서</span>' +
                        '<select id="opn-chk-owner-' + i + '" class="opn-filter">' + DEPT4.map(d => '<option' + (savedOwner === d ? ' selected' : '') + '>' + d + '</option>').join('') + '</select>' +
                        '<span style="font-size:var(--fs-12); color:var(--text-gray);">기한</span>' +
                        '<input id="opn-chk-due-' + i + '" type="date" class="opn-filter" value="' + savedDue + '">' +
                        '</div>' +
                        '</div>';
                }).join('');
                V.openModal((isEdit ? '점검결과지 수정' : '점검결과지 생성') + ' — 의견청취·협의체 점검표',
                    '<div class="preset-form-grid"><span class="k">점검 구분</span><select id="opn-chk-cat">' + catOpts + '</select>' +
                    '<span class="k">점검일</span><input id="opn-chk-date" type="date" value="' + (ex ? ex.date : '2026-06-30') + '"></div>' +
                    '<div style="margin-top:12px; font-size:var(--fs-12); color:var(--text-gray);">문항별로 확인 / 미흡 / 해당없음을 선택하세요. 미흡 선택 시 담당부서·기한을 지정하며, 확정 시 개선조치로 자동 연계됩니다.</div>' +
                    '<div style="margin-top:10px; display:flex; flex-direction:column; gap:8px;">' + itemsHtml + '</div>',
                    '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button><button class="btn btn-primary" id="opn-chk-save">' + (isEdit ? '수정 저장' : '점검결과지 등록') + '</button>');
                document.getElementById('opn-chk-save').addEventListener('click', () => {
                    const cat = (document.getElementById('opn-chk-cat') || {}).value;
                    const date = (document.getElementById('opn-chk-date') || {}).value || '2026-06-30';
                    const newItems = CHK_QS.map((q, i) => {
                        const r = (document.querySelector('input[name=opn-chk-' + i + ']:checked') || {}).value || '확인';
                        const it = { q: q, r: r };
                        if (r === '미흡') {
                            it.owner = (document.getElementById('opn-chk-owner-' + i) || {}).value || DEPT4[0];
                            it.due = (document.getElementById('opn-chk-due-' + i) || {}).value || '2026-07-31';
                        }
                        return it;
                    });
                    const unfit = newItems.filter(x => x.r === '미흡').length;
                    if (isEdit) {
                        ex.cat = cat; ex.date = date; ex.items = newItems; ex.result = unfit ? '미흡' : '적합';
                        V.closeModal(); render(); V.toast('점검결과지가 수정되었습니다' + (unfit ? ' — 미흡 ' + unfit + '건' : ''));
                    } else {
                        S.COUNCIL.checklists.unshift({ id: 'CHK-' + String(nextNum(S.COUNCIL.checklists)).padStart(2, '0'), cat: cat, date: date, inspector: '정안전', result: unfit ? '미흡' : '적합', appr: '미상신', items: newItems });
                        if (unfit) { newItems.forEach(it => { if (it.r === '미흡') E.addImprovement({ title: '[협의체 점검 미흡] ' + it.q, sourceMenu: '의견청취·협의체', sourceDoc: cat + ' 점검표', owner: it.owner, due: it.due }); }); }
                        V.closeModal(); render(); V.toast('점검결과지가 등록되었습니다' + (unfit ? ' — 미흡 ' + unfit + '건 개선조치 연계' : ''));
                    }
                });
            }
            PG.opnChkToggleFix = (i, val) => { const el = document.getElementById('opn-chk-fix-' + i); if (el) el.style.display = val === '미흡' ? 'flex' : 'none'; };
            PG.opnChkNew = () => opnChkModal(null);
            PG.opnChkEdit = id => {
                const c = S.COUNCIL.checklists.find(x => x.id === id); if (!c) return;
                if (c.appr === '결재중' || c.appr === '승인완료') { V.toast('결재중·승인완료된 점검결과지는 수정할 수 없습니다'); return; }
                opnChkModal(c);
            };
            PG.opnChkOpen = id => PG.opnGo('council', 'cdetail', id);
            PG.opnChkDel = id => {
                const c = S.COUNCIL.checklists.find(x => x.id === id); if (!c) return;
                if (c.appr === '결재중' || c.appr === '승인완료') { V.toast('결재중·승인완료된 점검결과지는 삭제할 수 없습니다'); return; }
                if (!window.confirm('이 점검결과지를 삭제하시겠습니까? 삭제 후 되돌릴 수 없습니다.')) return;
                S.COUNCIL.checklists = S.COUNCIL.checklists.filter(x => x.id !== id); PG.opnGo('council', 'list', null); V.toast('점검결과지가 삭제되었습니다');
            };
            PG.opnChkOnnara = id => { const c = S.COUNCIL.checklists.find(x => x.id === id); if (c) c.appr = '결재중'; E.onnaraPopup('의견청취 점검결과지 ' + id); render(); };
            /* 결재 이력 — 문서의 실제 appr 상태에 따라 이력 행을 동적 생성(고정 3행 표시 금지) */
            PG.opnChkApprHistory = id => {
                const c = S.COUNCIL.checklists.find(x => x.id === id);
                const appr = c ? c.appr : '미상신';
                const inspector = (c && c.inspector) || '정안전';
                const d0 = (c && c.date) || '2026-06-28';
                const d1 = addDays(d0, 1);
                let rows = [];
                if (appr === '결재중') rows = [[d0 + ' 14:10', '결재 상신', inspector, '-']];
                else if (appr === '승인완료') rows = [[d0 + ' 14:10', '결재 상신', inspector, '-'], [d0 + ' 15:30', '팀장 승인', '중대재해팀장', '-'], [d1 + ' 09:40', '부군수 승인', '부군수', '승인 완료']];
                else if (appr === '반려') rows = [[d0 + ' 14:10', '결재 상신', inspector, '-'], [d0 + ' 15:30', '반려', '중대재해팀장', (c && c.rejectReason) || '보완 후 재상신 요망']];
                const body = rows.length
                    ? '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>일시</th><th>처리</th><th>처리자</th><th>비고</th></tr></thead><tbody>' +
                      rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td></tr>').join('') +
                      '</tbody></table></div>'
                    : '<p style="font-size:var(--fs-13); color:var(--text-gray); text-align:center; padding:20px 0;">결재 이력이 없습니다 — 상신 후 이력이 기록됩니다.</p>';
                V.openModal('온나라 결재 이력' + (c ? ' — ' + c.id : ''), body,
                    '<button class="btn btn-primary" onclick="DYV2.closeModal()">확인</button>');
            };
            PG.opnChkPdfDownload = () => V.toast('PDF 다운로드 (프로토타입)');
            PG.opnChkPdfClose = () => { const o = document.getElementById('opn-chk-pdf-overlay'); if (o) o.remove(); };
            PG.opnChkPdfFull = id => {
                const c = S.COUNCIL.checklists.find(x => x.id === id); if (!c) return;
                PG.opnChkPdfClose();
                const ov = document.createElement('div');
                ov.id = 'opn-chk-pdf-overlay'; ov.className = 'pdf-full-overlay';
                ov.innerHTML =
                    '<div class="pdf-full-backdrop" onclick="PG.opnChkPdfClose()"></div>' +
                    '<div class="pdf-full-panel" role="dialog" aria-modal="true">' +
                    '<div class="pdf-full-head"><span>점검결과지 ' + c.id + ' 문서 미리보기</span>' +
                    '<span class="pdf-full-tools"><button class="btn btn-sm btn-outline" onclick="PG.opnChkPdfDownload()">PDF 다운로드</button>' +
                    '<button type="button" class="modal-close" onclick="PG.opnChkPdfClose()" aria-label="닫기">&times;</button></span></div>' +
                    '<div class="pdf-full-body">' + chkPdfPaper(c) + '</div></div>';
                document.body.appendChild(ov);
            };

            /* ===== 페이지별 상단 통계 ===== */
            /* 탭① 의견청취·건의함 — 상태별 카운트 바 (클릭 시 목록 필터, 전체=해제) */
            function voiceCountBar() {
                const cnt = st => S.VOICES.filter(o => o.status === st).length;
                const segs = [
                    ['', '전체', S.VOICES.length],
                    ['접수대기', '접수대기', cnt('접수대기')],
                    ['점검중', '점검중', cnt('점검중')],
                    ['개선조치중', '개선조치중', cnt('개선조치중')],
                    ['완료', '완료', cnt('완료')],
                ];
                return '<div class="opn-countbar">' + segs.map(s =>
                    '<button type="button" class="opn-count' + (S.fstatus === s[0] ? ' is-active' : '') + '" onclick="PG.opnSetStatus(\'' + s[0] + '\')">' +
                    '<span class="opn-count-n">' + s[2] + '</span><span class="opn-count-l">' + s[1] + '</span></button>').join('') + '</div>';
            }
            /* 탭② 위원회 — 미니 지표 */
            function committeeStat() {
                const C = S.COMMITTEE;
                const meetN = (C.meetings || []).length;
                const ag = C.agendaItems || [];
                const agDone = ag.filter(a => a.status === '완료').length;
                const agLate = ag.filter(a => a.status === '지연').length;
                return statboxes([['info', meetN + '회', '올해 회의 개최'], ['success', agDone + '/' + ag.length + '건', '안건 이행'], ['danger', agLate + '건', '이행 지연']]);
            }
            /* 탭③ 협의체·점검표 — 미니 지표 */
            function councilStat() {
                const cl = S.COUNCIL.checklists || [];
                const unfit = cl.filter(c => c.result === '미흡').length;
                const wait = cl.filter(c => c.appr === '결재중').length;
                return statboxes([['info', cl.length + '건', '점검결과지'], ['danger', unfit + '건', '미흡'], ['warning', wait + '건', '결재 대기']]);
            }

            /* ===== 탭1: 의견청취·건의함 목록 ===== */
            function renderVoiceList() {
                let list = S.VOICES.slice();
                if (S.fkw && S.fkw.trim()) { const kw = S.fkw.trim(); list = list.filter(o => (o.title || '').indexOf(kw) !== -1 || (o.author || '').indexOf(kw) !== -1); }
                if (S.fcat) list = list.filter(o => o.cat === S.fcat);
                if (S.fstatus) list = list.filter(o => o.status === S.fstatus);
                if (S.fdept) list = list.filter(o => (o.owner || '미배정') === S.fdept);
                const tot = list.length;
                const pages = Math.max(1, Math.ceil(tot / PER));
                if (S.page > pages) S.page = pages;
                const start = (S.page - 1) * PER;
                const pageRows = list.slice(start, start + PER);
                const kwSearch = '<input type="text" class="opn-filter" style="width:170px;" placeholder="제목, 작성자 검색" value="' + V.esc(S.fkw || '') + '" onchange="PG.opnSetKw(this.value)" onkeydown="if(event.key===\'Enter\')PG.opnSetKw(this.value)">';
                const catFilter = '<select onchange="PG.opnSetCat(this.value)" class="opn-filter" style="margin-left:6px;"><option value="">전체 분류</option>' + CATS.map(c => '<option' + (S.fcat === c ? ' selected' : '') + '>' + c + '</option>').join('') + '</select>';
                const stFilter = '<select onchange="PG.opnSetStatus(this.value)" class="opn-filter" style="margin-left:6px;"><option value="">전체 상태</option>' + ['접수대기', '점검중', '개선조치중', '완료', '반려'].map(s => '<option' + (S.fstatus === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select>';
                const deptFilter = '<select onchange="PG.opnSetDept(this.value)" class="opn-filter" style="margin-left:6px;"><option value="">전체 부서</option>' + DEPTS.map(d => '<option' + (S.fdept === d ? ' selected' : '') + '>' + d + '</option>').join('') + '</select>';
                const body = pageRows.length ? pageRows.map(o => '<tr style="cursor:pointer;" onclick="PG.opnOpen(\'' + o.id + '\')"><td>' + catChip(o.cat) + '</td><td><b>' + V.esc(o.title) + '</b> ' + linkChips(o) + '</td><td>' + V.esc(o.author) + '</td><td class="opn-hide-sm">' + (o.owner ? V.esc(o.owner) : '<span class="opn-muted">미배정</span>') + '</td><td>' + o.date + '</td><td>' + stChip(o.status) + '</td></tr>').join('') : '<tr><td colspan="6" style="text-align:center; color:var(--text-gray); padding:30px;">해당 조건의 의견이 없습니다.</td></tr>';
                let pager = '';
                if (tot > 0) {
                    let btns = '';
                    for (let p = 1; p <= pages; p++) btns += '<button class="opn-page-btn' + (p === S.page ? ' is-active' : '') + '" onclick="PG.opnPage(' + p + ')">' + p + '</button>';
                    pager = '<div class="opn-pager"><span class="opn-pager-info">총 ' + tot + '건 중 ' + (start + 1) + '-' + (start + pageRows.length) + '건</span><span class="opn-pager-btns">' + (S.page > 1 ? '<button class="opn-page-btn" onclick="PG.opnPage(' + (S.page - 1) + ')">‹</button>' : '') + btns + (S.page < pages ? '<button class="opn-page-btn" onclick="PG.opnPage(' + (S.page + 1) + ')">›</button>' : '') + '</span></div>';
                }
                const actions = '<span style="display:flex; align-items:center; gap:0; flex-wrap:wrap;">' + kwSearch + catFilter + stFilter + deptFilter + '<button class="btn btn-sm btn-primary" style="margin-left:8px;" onclick="PG.opnNew()">+ 의견 등록</button></span>';
                return sectionCard('의견청취 · 건의함', '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>분류</th><th>제목</th><th>작성자</th><th class="opn-hide-sm">담당부서</th><th>등록일</th><th>상태</th></tr></thead><tbody>' + body + '</tbody></table></div>' + pager, actions);
            }

            /* ===== 탭1: 의견 등록 폼 (온·오프라인 병행) ===== */
            function renderVoiceForm() {
                const head = '<div class="opn-form-head"><button class="btn btn-sm btn-outline" onclick="PG.opnBack()">‹ 목록</button><h2>의견 등록</h2></div>';
                const writer = sectionCard('작성자 정보',
                    '<div class="opn-form-grid">' +
                    '<div class="opn-field"><label class="opn-flabel">작성자</label><div class="opn-readonly">김대표</div></div>' +
                    '<div class="opn-field"><label class="opn-flabel">부서명</label><div class="opn-readonly">재난안전과 중대재해팀</div></div>' +
                    '</div>', '');
                const info = sectionCard('의견 정보',
                    '<div class="opn-form-grid">' +
                    '<div class="opn-field"><label class="opn-flabel" for="opn-cat">분류 <span class="req">*</span></label><select id="opn-cat" class="opn-select"><option value="">선택하세요</option>' + CATS.map(c => '<option>' + c + '</option>').join('') + '</select></div>' +
                    '<div class="opn-field"><label class="opn-flabel" for="opn-via">접수경로</label><select id="opn-via" class="opn-select"><option>온라인</option><option>오프라인</option></select></div>' +
                    '<div class="opn-field"><label class="opn-flabel" for="opn-author">제출자</label><input id="opn-author" class="opn-input" type="text" placeholder="온라인은 자동 / 오프라인은 제출자명 대리 입력"></div>' +
                    '<div class="opn-field"><label class="opn-flabel" for="opn-loc">발생장소</label><input id="opn-loc" class="opn-input" type="text" maxlength="50" placeholder="발생 장소를 입력하세요" oninput="var c=document.getElementById(\'cnt-loc\');if(c)c.textContent=this.value.length+\'/50\';"><div class="opn-counter" id="cnt-loc">0/50</div></div>' +
                    '<div class="opn-field full"><label class="opn-flabel" for="opn-title">제목 <span class="req">*</span></label><input id="opn-title" class="opn-input" type="text" maxlength="50" placeholder="제목을 입력하세요" oninput="var c=document.getElementById(\'cnt-title\');if(c)c.textContent=this.value.length+\'/50\';"><div class="opn-counter" id="cnt-title">0/50</div></div>' +
                    '</div>', '');
                const detail = sectionCard('상세 내용 <span class="req">*</span>',
                    '<div class="opn-field"><textarea id="opn-content" class="opn-textarea" maxlength="500" placeholder="상세 내용을 입력하세요" oninput="var c=document.getElementById(\'cnt-content\');if(c)c.textContent=this.value.length+\'/500\';"></textarea><div class="opn-counter" id="cnt-content">0/500</div></div>' +
                    '<p style="font-size:var(--fs-12); color:var(--text-gray); margin:10px 0 0;">근로자는 온라인으로 직접 등록하며, 오프라인(서면·구두) 접수는 담당자가 대리 등록합니다.</p>', '');
                const CLOUD = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>';
                const photo = sectionCard('사진 첨부',
                    '<div class="opn-dropzone" onclick="DYV2.toast(\'사진 첨부 (프로토타입)\')">' + CLOUD +
                    '<div class="dz-title">첨부할 파일을 여기에 끌어다 놓거나 파일 선택 버튼을 클릭하세요</div>' +
                    '<button type="button" class="btn btn-sm btn-outline">파일 선택</button>' +
                    '<div class="dz-hint">JPG, PNG, GIF 파일만 업로드 가능합니다 (최대 10MB · 최대 5장)</div>' +
                    '</div>', '');
                const bar = '<div class="opn-formbar"><button class="btn btn-outline" onclick="PG.opnBack()">취소</button><button class="btn btn-primary" onclick="PG.opnSave()">등록하기</button></div>';
                return head + writer + info + detail + photo + bar;
            }

            /* ===== 탭1: 상세 — 2:1 레이아웃 + 상태별 처리 카드 (민원처리형) ===== */
            const OWNERS = ['재난안전과 · 홍길동', '재난안전과 · 김안전', '건설과 · 박현장', '환경과 · 최보건'];
            const INSPECT_KINDS = ['특별점검', '일상점검', '주간점검', '합동점검', '순회점검'];
            const ownerOpts = () => OWNERS.map(p => '<option>' + p + '</option>').join('');
            const HIST_DOT = { '접수': 'neutral', '현장점검 생성': 'info', '개선조치 생성': 'warning', '경과': 'info', '완료': 'success', '반려': 'danger', '재처리': 'neutral' };
            function renderVoiceDetail(o) {
                if (!o) return renderVoiceList();
                /* ① 의견 정보 */
                const infoCard = sectionCard(o.id + ' · 의견 상세',
                    '<div class="preset-form-grid">' +
                    '<span class="k">분류 / 상태</span><div style="display:flex; gap:6px; align-items:center;">' + catChip(o.cat) + stChip(o.status) + '</div>' +
                    '<span class="k">제목</span><div style="font-weight:var(--fw-bold);">' + V.esc(o.title) + '</div>' +
                    '<span class="k">작성자 / 경로</span><div>' + V.esc(o.author) + ' · ' + V.esc(o.via || '온라인') + '</div>' +
                    '<span class="k">작성일</span><div>' + o.date + '</div>' +
                    '<span class="k">담당부서</span><div>' + (o.owner ? V.esc(o.owner) : '<span class="opn-muted">미배정</span>') + '</div>' +
                    '<span class="k">발생장소</span><div>' + V.esc(o.location || '-') + '</div>' +
                    '<span class="k">상세내용</span><div>' + V.esc(o.content || '-') + '</div>' +
                    '<span class="k">첨부 사진</span><div><span class="opn-muted">첨부된 사진이 없습니다 (프로토타입)</span></div>' +
                    '</div>', '');
                /* ② 처리 카드 (상태별 5-view) */
                const procHead = '<div class="opn-proc-head"><span class="opn-proc-title">처리</span><span class="opn-proc-status">현재 상태 ' + stChip(o.status) + '</span></div>';
                let procBody;
                if (o.status === '접수대기') {
                    const opt = (val, name, desc, form) =>
                        '<div class="opn-act-opt" data-act="' + val + '">' +
                        '<label class="opn-act-head"><input type="radio" name="opn-act" value="' + val + '" onchange="PG.opnActSel(this)"><span class="opn-act-name">' + name + '</span><span class="opn-act-desc">' + desc + '</span></label>' +
                        '<div class="opn-act-form" id="opn-actf-' + val + '" hidden>' + form + '</div></div>';
                    const inspectForm = '<div class="opn-inl-grid">' +
                        '<label>점검 종류<select id="opn-i-kind">' + INSPECT_KINDS.map((k, ix) => '<option' + (ix === 0 ? ' selected' : '') + '>' + k + '</option>').join('') + '</select></label>' +
                        '<label>점검 예정일<input type="date" id="opn-i-date" value="' + addDays(PROTO_TODAY, 7) + '"></label>' +
                        '<label>담당자<select id="opn-i-owner">' + ownerOpts() + '</select></label></div>' +
                        '<label class="opn-inl-full">점검 시 확인사항<textarea id="opn-i-note">' + V.esc(o.content || '') + '</textarea></label>';
                    const improveForm = '<div class="opn-inl-grid">' +
                        '<label>담당자<select id="opn-m-owner">' + ownerOpts() + '</select></label>' +
                        '<label>완료 예정일<input type="date" id="opn-m-due" value="' + addDays(PROTO_TODAY, 14) + '"></label></div>' +
                        '<label class="opn-inl-full">개선 내용<textarea id="opn-m-desc">' + V.esc(o.title || '') + '</textarea></label>';
                    const rejectForm = '<label class="opn-inl-full">반려 사유<textarea id="opn-r-reason" placeholder="반려 사유를 입력하세요"></textarea></label>' +
                        '<div class="opn-banner danger" style="margin-top:8px;">반려 사유가 기록되며, 되돌리려면 재처리해야 합니다.</div>';
                    procBody = '<div class="opn-banner warn">접수 대기 중 — 의견을 검토하고 조치 방법을 선택하세요.</div>' +
                        '<div class="opn-act-list">' +
                        opt('inspect', '현장점검 실시', '안전점검이 자동 생성됩니다.', inspectForm) +
                        opt('improve', '개선조치 바로 생성', '개선조치 메뉴에 조치 항목이 자동 생성됩니다.', improveForm) +
                        opt('reject', '반려', '반려 사유를 기록하고 종결합니다.', rejectForm) +
                        '</div>' +
                        '<div class="opn-proc-foot"><button class="btn btn-primary" id="opn-act-save" disabled onclick="PG.opnActSave(\'' + o.id + '\')">저장</button></div>';
                } else if (o.status === '점검중') {
                    const ins = o.inspect || {};
                    procBody = '<div class="opn-banner info">현장점검 진행 중 — 점검이 완료되면 자동으로 상태가 변경됩니다.</div>' +
                        '<div class="opn-linkcard"><div class="opn-linkcard-badges"><span class="chip-mini wt-elec">안전점검 연동</span> <span class="chip-mini wt">점검예정</span></div>' +
                        '<div class="opn-linkcard-title">[의견청취] ' + V.esc(o.title) + '</div>' +
                        '<div class="opn-linkcard-meta">' + V.esc(ins.kind || '특별점검') + ' · 담당 ' + V.esc(ins.owner || o.owner || '-') + ' · 예정 ' + (ins.date || '-') + '</div>' +
                        '<button class="btn btn-sm btn-outline" onclick="DYV2.toast(\'안전점검 메뉴 연동 (프로토타입)\')">점검 상세 보기</button></div>' +
                        '<div class="opn-proc-foot"><button class="btn btn-outline" onclick="PG.opnProgress(\'' + o.id + '\')">경과 추가</button><button class="btn btn-primary" onclick="PG.opnComplete(\'' + o.id + '\')">완료 처리</button></div>';
                } else if (o.status === '개선조치중') {
                    const imp = E.improvements().find(x => x.id === o.link) || {};
                    procBody = '<div class="opn-banner warn">개선조치 진행 중 — 개선조치가 완료되면 자동으로 상태가 변경됩니다.</div>' +
                        '<div class="opn-linkcard"><div class="opn-linkcard-badges"><span class="chip-mini pdca">의견청취 연동</span> <span class="chip-mini wt-attach">' + (imp.status === '종결' ? '종결' : '조치중') + '</span></div>' +
                        '<div class="opn-linkcard-title">' + V.esc(imp.title || o.title) + '</div>' +
                        '<div class="opn-linkcard-meta">담당 ' + V.esc(imp.owner || o.owner || '-') + ' · 예정 ' + (imp.due || '-') + '</div>' +
                        '<button class="btn btn-sm btn-outline" onclick="location.href=\'menu.html?m=improve\'">개선조치 상세 보기</button></div>' +
                        '<div class="opn-proc-foot"><button class="btn btn-outline" onclick="PG.opnProgress(\'' + o.id + '\')">경과 추가</button><button class="btn btn-primary" onclick="PG.opnComplete(\'' + o.id + '\')">완료 처리</button></div>';
                } else if (o.status === '완료') {
                    procBody = '<div class="opn-banner success">처리 완료 — 의견 처리 및 조치가 완료되었습니다.</div>' +
                        '<div class="opn-done-summary"><div><span class="opn-done-k">처리 완료일</span><b>' + (o.completedAt || '-') + '</b></div><div><span class="opn-done-k">처리자</span><b>' + V.esc(o.completedBy || '-') + '</b></div></div>' +
                        (o.result ? '<div class="opn-proc-note">' + V.esc(o.result) + '</div>' : '') +
                        '<div class="opn-proc-foot"><button class="btn btn-outline" onclick="PG.opnReopen(\'' + o.id + '\')">재처리</button></div>';
                } else { /* 반려 */
                    procBody = '<div class="opn-banner danger">반려 처리됨 — 반려 사유가 기록되었습니다.</div>' +
                        '<div class="opn-proc-note">' + V.esc(o.rejectReason || '-') + '</div>' +
                        '<div class="opn-proc-foot"><button class="btn btn-outline" onclick="PG.opnReopen(\'' + o.id + '\')">재처리</button></div>';
                }
                const procCard = '<div class="card opn-proc-card"><div class="card-body">' + procHead + procBody + '</div></div>';
                /* ④ 처리 이력 */
                const hist = (o.history || []);
                const histCard = sectionCard('처리 이력',
                    hist.length
                        ? '<ul class="opn-hist">' + hist.map(h => '<li class="opn-hist-item"><span class="opn-hist-dot ' + (HIST_DOT[h.stage] || 'neutral') + '"></span><div class="opn-hist-body"><div class="opn-hist-head"><span class="opn-hist-stage">' + V.esc(h.stage) + '</span><span class="opn-hist-at">' + V.esc(h.at) + '</span></div>' + (h.text ? '<div class="opn-hist-text">' + V.esc(h.text) + '</div>' : '') + '<div class="opn-hist-actor">' + V.esc(h.actor) + '</div></div></li>').join('') + '</ul>'
                        : '<p class="opn-muted" style="font-size:var(--fs-13);">처리 이력이 없습니다.</p>', '');
                /* ⑤ 연동 정보 */
                let linkInner;
                if (!o.inspectLink && !o.link) {
                    linkInner = '<div class="opn-linkempty"><span class="opn-linkempty-ic">🔗</span><span>조치 선택 후 연동 정보가 표시됩니다</span></div>';
                } else {
                    linkInner = '';
                    if (o.inspectLink) { const ins = o.inspect || {}; linkInner += '<div class="opn-mini"><div class="opn-mini-badges"><span class="chip-mini wt-elec">안전점검</span> <span class="chip-mini wt">점검예정</span></div><div class="opn-mini-title">[의견청취] ' + V.esc(o.title) + '</div><div class="opn-mini-meta">담당 ' + V.esc(ins.owner || o.owner || '-') + ' · 예정 ' + (ins.date || '-') + '</div><button class="btn btn-sm btn-outline" onclick="DYV2.toast(\'안전점검 메뉴 연동 (프로토타입)\')">바로가기</button></div>'; }
                    if (o.link) { const imp = E.improvements().find(x => x.id === o.link) || {}; linkInner += '<div class="opn-mini"><div class="opn-mini-badges"><span class="chip-mini pdca">개선조치</span> <span class="chip-mini wt-attach">' + (imp.status === '종결' ? '종결' : '조치중') + '</span></div><div class="opn-mini-title">' + V.esc(imp.title || o.title) + '</div><div class="opn-mini-meta">' + V.esc(o.link) + ' · 예정 ' + (imp.due || '-') + '</div><button class="btn btn-sm btn-outline" onclick="location.href=\'menu.html?m=improve\'">바로가기</button></div>'; }
                }
                const linkCard = sectionCard('연동 정보', linkInner, '');
                const header = '<div class="pol-detail-top"><button class="btn btn-sm btn-outline" onclick="PG.opnBack()">‹ 목록</button></div>';
                return header + '<div class="opn-detail-grid"><div class="opn-detail-main">' + infoCard + procCard + '</div><div class="opn-detail-side">' + histCard + linkCard + '</div></div>';
            }

            /* ===== 탭2: 산업안전보건위원회 운영 ===== */
            function renderCommittee() {
                const C = S.COMMITTEE;
                const memRows = C.members.map((m, i) => '<tr><td>' + V.esc(m.role) + '</td><td>' + V.esc(m.dept) + '</td><td>' + V.esc(m.position) + '</td><td>' + V.esc(m.name) + '</td><td><button class="btn btn-sm btn-outline" onclick="PG.opnMemberEdit(\'committee\',' + i + ')">수정</button> <button class="btn btn-sm btn-outline" onclick="PG.opnMemberDel(\'committee\',' + i + ')">삭제</button></td></tr>').join('');
                const memCard = sectionCard('위원 구성 현황 <span class="chip-mini wt" style="margin-left:6px;">산안법 §24</span>',
                    '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>구분</th><th>부서</th><th>직책</th><th>성명</th><th>관리</th></tr></thead><tbody>' + memRows + '</tbody></table></div><p style="font-size:var(--fs-12); color:var(--text-gray); margin:8px 0 0;">근로자·사용자 대표 동수 구성 (산안법 §24)</p>',
                    '<button class="btn btn-sm btn-primary" onclick="PG.opnMemberAdd(\'committee\')">+ 위원 추가</button>');
                const agStChip = s => '<span class="chip-status ' + (s === '완료' ? 'success' : s === '지연' ? 'danger' : 'info') + '">' + s + '</span>';
                const agRows = (C.agendaItems || []).map((a, i) => '<tr><td>' + V.esc(a.agenda) + '</td><td>' + V.esc(a.dept) + '</td><td>' + a.due + '</td><td>' + agStChip(a.status) + '</td><td><button class="btn btn-sm btn-outline" onclick="PG.opnAgendaEdit(' + i + ')">수정</button> <button class="btn btn-sm btn-outline" onclick="PG.opnAgendaDel(' + i + ')">삭제</button></td></tr>').join('');
                const agendaCard = sectionCard('안건 부서이행 현황 <span class="chip-mini wt" style="margin-left:6px;">산안법 §24</span>',
                    '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>의결 안건</th><th>담당부서</th><th>이행기한</th><th>이행상태</th><th>관리</th></tr></thead><tbody>' + agRows + '</tbody></table></div>',
                    '<button class="btn btn-sm btn-primary" onclick="PG.opnAgendaAdd()">+ 안건 추가</button>');
                const meetHead = '<tr><th>회차</th><th>유형</th><th>일시</th><th>참석</th><th>주요 안건</th><th>상태</th></tr>';
                const meetBody = C.meetings.map(mt => '<tr style="cursor:pointer;" onclick="PG.opnMeetingOpen(\'' + mt.round + '\')"><td><b>' + mt.round + '</b></td><td><span class="chip-mini wt-elec">' + mt.type + '</span></td><td>' + mt.date + '</td><td>' + (mt.attendeeList || []).length + '명</td><td><span class="opn-agenda">' + V.esc(mt.agenda) + '</span></td><td><span class="chip-status ' + (mt.status === '확정' ? 'success' : 'info') + '">' + (mt.status || '작성') + '</span></td></tr>').join('');
                const meetCard = sectionCard('회의록 (정기·수시) <span class="opn-muted" style="font-size:var(--fs-12); font-weight:400;">— 행 클릭 시 상세 보기</span>', '<div style="overflow-x:auto;"><table class="table-figma"><thead>' + meetHead + '</thead><tbody>' + meetBody + '</tbody></table></div>', '<button class="btn btn-sm btn-primary" onclick="PG.opnMtgFormOpen(null)">회의록 작성</button>');
                const cmtTab = S.cmtTab || 'member';
                const tabBar = '<div class="psub-tabs opn-inpage-tabs">' + [['member', '위원 구성'], ['agenda', '안건 부서이행'], ['meeting', '회의록']].map(t => '<button type="button" class="psub-tab' + (cmtTab === t[0] ? ' is-active' : '') + '" onclick="PG.opnCmtTab(\'' + t[0] + '\')">' + t[1] + '</button>').join('') + '</div>';
                const pane = cmtTab === 'agenda' ? agendaCard : cmtTab === 'meeting' ? meetCard : memCard;
                return tabBar + pane;
            }

            /* ===== 탭2: 회의록 상세 보기 페이지 ===== */
            function renderMeetingDetail(round) {
                const mt = (S.COMMITTEE.meetings || []).find(x => x.round === round);
                if (!mt) return renderCommittee();
                const isFixed = mt.status === '확정';
                const info = '<div class="preset-form-grid">' +
                    '<span class="k">회차</span><div><b>' + mt.round + '</b> <span class="chip-mini wt-elec">' + mt.type + '</span></div>' +
                    '<span class="k">일시</span><div>' + mt.date + '</div>' +
                    '<span class="k">장소</span><div>' + V.esc(mt.place || '-') + '</div>' +
                    '<span class="k">참석자 (' + (mt.attendeeList || []).length + '명)</span><div class="att-list">' + ((mt.attendeeList || []).length ? (mt.attendeeList).map(a => '<span class="att-chip att-chip-ro">' + V.esc(a.name) + ' <span class="att-sub">' + V.esc(a.dept) + (a.position ? (' ' + V.esc(a.position)) : '') + '</span></span>').join('') : '<span class="att-empty">등록된 참석자가 없습니다.</span>') + '</div>' +
                    '<span class="k">주요 안건</span><div>' + V.esc(mt.agenda) + '</div>' +
                    '<span class="k">의결사항</span>' + ((mt.decisions && mt.decisions.length) ? '<ol style="margin:0; padding-left:18px;">' + mt.decisions.map(d => '<li>' + V.esc(d) + '</li>').join('') + '</ol>' : '<div class="opn-muted" style="font-size:var(--fs-13);">등록된 의결사항이 없습니다.</div>') +
                    '<span class="k">상태</span><div><span class="chip-status ' + (isFixed ? 'success' : 'info') + '">' + (mt.status || '작성') + '</span></div>' +
                    '</div>';
                const acts = isFixed
                    ? '<span class="opn-muted" style="font-size:var(--fs-12); align-self:center;">확정된 회의록입니다 — 편집할 수 없습니다.</span>'
                    : '<button class="btn btn-sm btn-outline" onclick="PG.opnMtgFormOpen(\'' + mt.round + '\')">편집</button>' +
                      '<button class="btn btn-sm btn-primary" onclick="PG.opnMtgConfirm(\'' + mt.round + '\')">확정 처리</button>';
                const header = '<div class="pol-detail-top"><button class="btn btn-sm btn-outline" onclick="PG.opnGo(\'committee\',\'list\',null)">‹ 목록</button>' +
                    '<div class="pol-detail-actions">' + acts + '</div></div>';
                return header + sectionCard(mt.round + ' 산업안전보건위원회 회의록', info, '');
            }

            /* ===== 탭2: 회의록 작성/편집 폼 — 참석자는 조직도 클릭 즉시 토글 ===== */
            function renderMeetingForm(round) {
                const editing = round != null && round !== '__new__';
                const mt = editing ? (S.COMMITTEE.meetings || []).find(x => x.round === round) : null;
                const dkey = editing ? round : '__new__';
                if (!S.mtgDraft || S.mtgDraft.key !== dkey) S.mtgDraft = { key: dkey, attendees: mt ? (mt.attendeeList || []).slice() : [] };
                const orgHtml = (window.EDOC.ORG_TREE || []).map(d => { const open = d.members.some(m => S.mtgDraft.attendees.some(a => a.dept === d.dept && a.name === m[1])); return '<div class="otr-dept" data-dept="' + V.esc(d.dept) + '"><button type="button" class="otr-deptbtn" onclick="EDOC._orgToggle(this)"><span class="otr-arrow">' + (open ? '▾' : '▸') + '</span> ' + V.esc(d.dept) + ' <span class="otr-count">' + d.members.length + '명</span></button><div class="otr-members" style="display:' + (open ? 'block' : 'none') + ';">' + d.members.map(m => { const on = S.mtgDraft.attendees.some(a => a.dept === d.dept && a.name === m[1]); return '<button type="button" class="otr-member' + (on ? ' on' : '') + '" data-dept="' + V.esc(d.dept) + '" data-name="' + V.esc(m[1]) + '" onclick="PG.opnMtgTogAtt(this,\'' + V.esc(d.dept) + '\',\'' + V.esc(m[0]) + '\',\'' + V.esc(m[1]) + '\')"><span class="otr-role">' + V.esc(m[0]) + '</span><span class="otr-name">' + V.esc(m[1]) + '</span></button>'; }).join('') + '</div></div>'; }).join('');
                const body =
                    '<div class="opn-form-grid">' +
                    '<div class="opn-field"><label class="opn-flabel" for="mf-round">회차 <span class="req">*</span></label><input id="mf-round" class="opn-input" type="text" value="' + V.esc(mt ? mt.round : '2026 3분기') + '" placeholder="예: 2026 3분기"></div>' +
                    '<div class="opn-field"><label class="opn-flabel" for="mf-type">유형</label><select id="mf-type" class="opn-select"><option' + (mt && mt.type === '정기' ? ' selected' : '') + '>정기</option><option' + (mt && mt.type === '수시' ? ' selected' : '') + '>수시</option></select></div>' +
                    '<div class="opn-field"><label class="opn-flabel" for="mf-date">일시</label><input id="mf-date" class="opn-input" type="date" value="' + (mt ? mt.date : '2026-06-30') + '"></div>' +
                    '<div class="opn-field"><label class="opn-flabel" for="mf-place">장소</label><input id="mf-place" class="opn-input" type="text" value="' + V.esc(mt ? mt.place : '') + '" placeholder="회의 장소"></div>' +
                    '<div class="opn-field full"><label class="opn-flabel" for="mf-agenda">주요 안건</label><input id="mf-agenda" class="opn-input" type="text" value="' + V.esc(mt ? mt.agenda : '') + '" placeholder="주요 안건"></div>' +
                    '</div>' +
                    '<div style="margin-top:16px;"><label class="opn-flabel">참석자 (<span id="mtg-att-count">' + S.mtgDraft.attendees.length + '</span>명)</label>' +
                    '<div id="mtg-att-chips" class="att-list" style="margin:8px 0;">' + attChipsHtml() + '</div>' +
                    '<div class="org-inline"><div class="org-inline-search"><input type="text" placeholder="부서·이름 검색" oninput="EDOC._orgFilter(this)"></div><div class="org-inline-body">' + orgHtml + '</div></div>' +
                    '<p style="font-size:var(--fs-12); color:var(--text-gray); margin:8px 0 0;">조직도에서 이름을 클릭하면 즉시 추가되고, 다시 누르거나 칩의 ×로 제외됩니다.</p></div>' +
                    '<div style="margin-top:16px;"><label class="opn-flabel">의결사항</label>' +
                    '<div id="mf-decisions" class="goal-list" style="margin-top:8px;">' + ((mt && mt.decisions && mt.decisions.length) ? mt.decisions.map(decisionRow).join('') : decisionRow('')) + '</div>' +
                    '<button type="button" class="btn btn-sm btn-outline" style="margin-top:8px;" onclick="PG.opnMtgDecisionAdd()">+ 의결사항 추가</button>' +
                    '<label style="display:flex; align-items:center; gap:8px; margin-top:14px; font-size:var(--fs-13); color:var(--text-black); cursor:pointer;"><input type="checkbox" id="mf-link-agenda"> 의결사항을 안건 부서이행 현황에 등록</label>' +
                    '</div>';
                const header = '<div class="opn-form-head"><button class="btn btn-sm btn-outline" onclick="PG.opnMtgFormCancel()">‹ 취소</button><h2>' + (editing ? '회의록 편집' : '회의록 작성') + '</h2></div>';
                const bar = '<div class="opn-formbar"><button class="btn btn-outline" onclick="PG.opnMtgFormCancel()">취소</button><button class="btn btn-primary" onclick="PG.opnMtgFormSave()">' + (editing ? '저장' : '작성 완료') + '</button></div>';
                return header + sectionCard(editing ? '회의록 편집' : '회의록 작성', body, '') + bar;
            }

            /* ===== 탭3: 안전보건 협의체 · 점검표 ===== */
            function renderCouncil() {
                const C = S.COUNCIL;
                const coRows = C.members.map((m, i) => '<tr><td>' + V.esc(m.role) + '</td><td>' + V.esc(m.dept) + '</td><td>' + V.esc(m.position) + '</td><td>' + V.esc(m.name) + '</td><td><button class="btn btn-sm btn-outline" onclick="PG.opnMemberEdit(\'council\',' + i + ')">수정</button> <button class="btn btn-sm btn-outline" onclick="PG.opnMemberDel(\'council\',' + i + ')">삭제</button></td></tr>').join('');
                const memCard = sectionCard('안전보건 협의체 운영 <span class="chip-mini wt" style="margin-left:6px;">산안법 §64</span>',
                    '<div class="preset-form-grid" style="margin-bottom:12px;"><span class="k">운영 주기</span><div style="display:flex; gap:8px; align-items:center;">' + C.cycle + ' <button class="btn btn-sm btn-outline" onclick="PG.opnCouncilCycle()">주기 변경</button></div></div>' +
                    '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>구분</th><th>부서/소속</th><th>직책</th><th>성명</th><th>관리</th></tr></thead><tbody>' + coRows + '</tbody></table></div>',
                    '<button class="btn btn-sm btn-primary" onclick="PG.opnMemberAdd(\'council\')">+ 위원 추가</button>');
                const resRows = (C.results || []).map((r, i) => '<tr><td>' + V.esc(r.round) + '</td><td>' + r.date + '</td><td>' + V.esc(r.content) + '</td><td>' + V.esc(r.result) + '</td><td><span class="chip-status ' + (r.status === '완료' ? 'success' : 'info') + '">' + r.status + '</span></td><td><button class="btn btn-sm btn-outline" onclick="PG.opnResultEdit(' + i + ')">수정</button> <button class="btn btn-sm btn-outline" onclick="PG.opnResultDel(' + i + ')">삭제</button></td></tr>').join('');
                const resultCard = sectionCard('협의체 운영 결과 <span class="chip-mini wt" style="margin-left:6px;">산안법 §64</span>',
                    '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>회차</th><th>일자</th><th>참석·논의 내용</th><th>결과 요약</th><th>상태</th><th>관리</th></tr></thead><tbody>' + (resRows || '<tr><td colspan="6" style="text-align:center; color:var(--text-gray); padding:20px;">등록된 운영 결과가 없습니다.</td></tr>') + '</tbody></table></div>',
                    '<button class="btn btn-sm btn-primary" onclick="PG.opnResultAdd()">+ 운영 결과 등록</button>');
                const chkRows = C.checklists.map(c => {
                    const editableRow = (c.appr === '미상신' || c.appr === '반려');
                    const acts = '<button class="btn btn-sm btn-outline" onclick="PG.opnChkOpen(\'' + c.id + '\')">조회</button>' +
                        (editableRow ? ' <button class="btn btn-sm btn-outline" onclick="PG.opnChkEdit(\'' + c.id + '\')">수정</button> <button class="btn btn-sm btn-outline" onclick="PG.opnChkDel(\'' + c.id + '\')">삭제</button>' : '');
                    return [c.cat, c.date, c.inspector, (c.result === '미흡' ? '<span class="chip-status danger">미흡 ' + c.items.filter(i => i.r === '미흡').length + '건</span>' : '<span class="chip-status success">적합</span>'), apprChip(c.appr), acts];
                });
                const chkCard = sectionCard('의견청취 점검표 <span class="chip-mini wt" style="margin-left:6px;">용역·구매설치·위탁사업·기타</span>', tbl(['점검 구분', '점검일', '점검자', '결과', '온나라 결재', ''], chkRows), '<button class="btn btn-sm btn-primary" onclick="PG.opnChkNew()">+ 점검결과지 생성</button>');
                const cnlTab = S.cnlTab || 'council';
                const tabBar = '<div class="psub-tabs opn-inpage-tabs">' + [['council', '협의체 운영'], ['check', '점검표']].map(t => '<button type="button" class="psub-tab' + (cnlTab === t[0] ? ' is-active' : '') + '" onclick="PG.opnCnlTab(\'' + t[0] + '\')">' + t[1] + '</button>').join('') + '</div>';
                const pane = cnlTab === 'check' ? chkCard : (memCard + resultCard);
                return tabBar + pane;
            }

            /* ===== 탭3: 점검결과지 상세 (온나라 결재 + PDF 미리보기) — 다른 메뉴와 동일 패턴 ===== */
            function renderCouncilDetail(id) {
                const c = S.COUNCIL.checklists.find(x => x.id === id);
                if (!c) return renderCouncil();
                const editable = (c.appr === '미상신' || c.appr === '반려');
                const info = '<div class="preset-form-grid">' +
                    '<span class="k">점검 구분</span><div><b>' + V.esc(c.cat) + '</b></div>' +
                    '<span class="k">점검일</span><div>' + c.date + '</div>' +
                    '<span class="k">점검자</span><div>' + V.esc(c.inspector) + '</div>' +
                    '<span class="k">종합 결과</span><div>' + chkResultChip(c.result) + '</div>' +
                    '<span class="k">온나라 결재</span><div style="display:flex; gap:8px; align-items:center;">' + apprChip(c.appr) + '<button class="btn btn-sm btn-outline" onclick="PG.opnChkApprHistory(\'' + c.id + '\')">이력</button></div>' +
                    '<span class="k">점검 항목</span><div>' + c.items.map((it, i) => '<div class="opn-chk-row" style="margin-bottom:6px;"><div class="opn-chk-q">' + (i + 1) + '. ' + V.esc(it.q) + (it.note ? ' <span style="color:var(--status-danger-fg); font-size:var(--fs-12);">(' + V.esc(it.note) + ')</span>' : '') + '</div><div>' + chkItemChip(it.r) + '</div></div>').join('') + '</div>' +
                    '</div>';
                const pdfPanel = '<div class="pol-pdf-wrap"><div class="pol-pdf-tools"><span style="font-size:var(--fs-12); font-weight:700; color:var(--text-gray);">PDF 미리보기</span><span style="display:flex; gap:6px;"><button class="btn btn-sm btn-outline" onclick="PG.opnChkPdfFull(\'' + c.id + '\')">전체화면</button><button class="btn btn-sm btn-primary" onclick="PG.opnChkPdfDownload()">PDF 다운로드</button></span></div>' + chkPdfPaper(c) + '</div>';
                let acts = '<div class="pol-detail-actions">';
                if (editable) {
                    acts += '<button class="btn btn-sm btn-outline" onclick="PG.opnChkEdit(\'' + c.id + '\')">수정</button>';
                    acts += '<button class="btn btn-sm btn-primary" onclick="PG.opnChkOnnara(\'' + c.id + '\')">온나라 결재 상신</button>';
                } else {
                    acts += '<span class="opn-muted" style="font-size:var(--fs-12); align-self:center;">' + (c.appr === '승인완료' ? '결재 승인 완료' : '결재 진행 중') + ' — 수정하려면 반려 후 진행하세요.</span>';
                }
                acts += '</div>';
                const header = '<div class="pol-detail-top"><button class="btn btn-sm btn-outline" onclick="PG.opnGo(\'council\',\'list\',null)">‹ 목록</button>' + acts + '</div>';
                const main = sectionCard('점검결과지 ' + c.id + ' · ' + V.esc(c.cat), '<div class="pol-detail-grid"><div class="pol-detail-info">' + info + '</div>' + pdfPanel + '</div>', '');
                return header + main;
            }

            /* ===== 디스패치 (탭 전환은 SNB 페이지 이동으로 일어남) ===== */
            if (S.tab === 'committee') return committeeStat() + (S.view === 'mform' ? renderMeetingForm(S.id) : S.view === 'mdetail' ? renderMeetingDetail(S.id) : renderCommittee());
            if (S.tab === 'council') return councilStat() + (S.view === 'cdetail' ? renderCouncilDetail(S.id) : renderCouncil());
            /* 기본: voice */
            if (S.view === 'form') return renderVoiceForm();
            if (S.view === 'detail') return renderVoiceDetail(find(S.id));
            return voiceCountBar() + renderVoiceList();
        },

        /* ── 도급관리 [SFR-013]: e호조 불러오기 → 적격 평가 → 점검표 → 수급인 평가 ── */
        contract() {
            PG.conAdd = () => {
                V.openModal('도급·용역·위탁 사업 등록',
                    '<div class="edoc-linkcard"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:3px;" aria-hidden="true"><path d="M9 15a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M15 9a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/></svg>차세대 e호조 연계 — 계약 정보를 불러오면 항목이 자동 입력됩니다 (연계 61건)</div>' +
                    '<div class="preset-form-grid">' +
                    '<span class="k">e호조 계약</span><div style="display:flex; gap:6px;"><input type="text" id="cn-no" placeholder="계약번호 검색" style="flex:1;"><button class="btn btn-sm btn-secondary" id="cn-load">불러오기</button></div>' +
                    '<span class="k">사업명</span><input type="text" id="cn-name">' +
                    '<span class="k">구분</span><select id="cn-cat"><option>공사</option><option>용역</option><option>구매설치</option><option>위탁</option><option>기타</option></select>' +
                    '<span class="k">수급업체</span><input type="text" id="cn-co">' +
                    '<span class="k">기간</span><input type="text" id="cn-period">' +
                    '<span class="k">계약금액</span><input type="text" id="cn-amt"></div>',
                    '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
                    '<button class="btn btn-primary" onclick="DYV2.closeModal(); DYV2.toast(\'사업이 등록되었습니다 — 적격 수급인 평가를 진행하세요\')">등록</button>');
                document.getElementById('cn-load').addEventListener('click', () => {
                    document.getElementById('cn-name').value = '농로 확포장 공사 (2026-공사-0142)';
                    document.getElementById('cn-co').value = '☆☆종합건설';
                    document.getElementById('cn-period').value = '2026-07-01 ~ 2026-12-20';
                    document.getElementById('cn-amt').value = '742,000천원';
                    V.toast('e호조에서 계약 정보를 불러왔습니다');
                });
            };
            PG.conCheck = name => E.openForm({
                id: 'EDOC-도급점검-' + name, title: '도급사업 안전보건 점검표 — ' + name, form: 'F5',
                ctx: { menuLabel: '도급관리 · 반기', checklist: T.CHECKLIST_PRESETS.contract }, onChange: render,
            });
            PG.conEval = co => E.openForm({
                id: 'EDOC-수급인평가-' + co, title: '수급인 안전보건 수준 평가 — ' + co, form: 'F6',
                ctx: { menuLabel: '도급관리', scorelist: T.SCORE_PRESETS.contract }, onChange: render,
            });
            PG.conPledge = () => V.openModal('안전보건 서약서 첨부',
                '<div class="upload-drop">서약서·계약서 사본을 첨부하세요 (다중 가능)</div>',
                '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
                '<button class="btn btn-primary" onclick="DYV2.closeModal(); DYV2.toast(\'서약서가 첨부되었습니다\')">업로드</button>');

            const cat = c => '<span class="chip-mini pdca">' + c + '</span>';
            const biz = [
                ['군도 5호선 포장공사', '공사', '○○건설', '2026-03 ~ 11'],
                ['청사 경비·미화 용역', '용역', '△△서비스', '2026-01 ~ 12'],
                ['CCTV 설치 (구매설치)', '구매설치', '□□시스템', '2026-05 ~ 07'],
                ['생활폐기물 수집·운반 위탁', '위탁', '◇◇환경', '2026-01 ~ 12'],
            ];
            return statboxes([['info', 12, '진행 사업'], ['success', 9, '평가 완료'], ['warning', 3, '점검 예정'], ['neutral', 41, '연간 누계']]) +
            sectionCard('도급·용역·위탁 사업 목록 (e호조 연계)',
                tbl(['사업명', '구분', '수급업체', '기간', '점검표', '서약서'],
                    biz.map(b => [
                        '<b>' + b[0] + '</b> ' + docStChip('EDOC-도급점검-' + b[0]), cat(b[1]), b[2], b[3],
                        '<button class="btn btn-sm btn-primary" onclick="PG.conCheck(\'' + b[0] + '\')">점검표 작성</button>',
                        '<button class="btn btn-sm btn-secondary" onclick="PG.conPledge()">첨부</button>',
                    ])),
                '<button class="btn btn-sm btn-primary" onclick="PG.conAdd()">+ 사업 등록 (e호조)</button>') +
            sectionCard('수급인 안전보건 수준 평가',
                tbl(['업체', '시점', '상태', ''], [
                    ['○○건설', '계약 전 적격심사 + 반기', docStChip('EDOC-수급인평가-○○건설'), '<button class="btn btn-sm btn-primary" onclick="PG.conEval(\'○○건설\')">평가 작성</button>'],
                    ['△△서비스', '계약 전 적격심사 + 반기', docStChip('EDOC-수급인평가-△△서비스'), '<button class="btn btn-sm btn-primary" onclick="PG.conEval(\'△△서비스\')">평가 작성</button>'],
                    ['☆☆종합건설', '계약 전 적격심사 (신규)', docStChip('EDOC-수급인평가-☆☆종합건설'), '<button class="btn btn-sm btn-primary" onclick="PG.conEval(\'☆☆종합건설\')">평가 작성</button>'],
                ]));
        },

        /* ── 개선조치 [SFR-003]: 전 메뉴 자동 유입 → 담당 지정 → 계획 → 완료 보고 → 확인 → 종결 ── */
        improve() {
            const dyn = E.improvements();
            const aDocs = V.docs().filter(d => d.pdca === 'A');

            PG.impNext = id => {
                const imp = E.improvements().find(x => x.id === id);
                if (!imp) return;
                if (imp.status === '접수') {
                    E.openForm({
                        id: 'EDOC-' + id, title: '조치 계획 — ' + imp.title, form: 'F7',
                        ctx: { menuLabel: '개선조치' }, source: '발생원: ' + imp.sourceMenu + (imp.sourceDoc ? ' · ' + imp.sourceDoc : ''),
                        fields: { source: imp.sourceMenu + ' — ' + imp.title, due: imp.due, owner: imp.owner },
                        onChange: () => { E.advanceImprovement(id); render(); },
                    });
                } else if (imp.status === '진행') {
                    V.openModal('조치 완료 보고 — ' + esc(imp.title),
                        '<div class="preset-form-grid">' +
                        '<span class="k">조치 결과</span><textarea placeholder="완료된 조치 내용"></textarea>' +
                        '<span class="k">완료 사진</span><div class="upload-drop" style="padding:14px;">조치 전·후 사진 첨부</div></div>',
                        '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
                        '<button class="btn btn-primary" onclick="DYV2.closeModal(); EDOC.advanceImprovement(\'' + id + '\'); PG._r(); DYV2.toast(\'완료 보고 — 확인자 검토 대기\')">완료 보고</button>');
                } else {
                    E.advanceImprovement(id); render();
                    if (E.improvements().find(x => x.id === id).status === '종결') E.notify('개선조치 종결 — ' + imp.title + ' (확인자 검토 완료)', '시스템');
                }
            };
            PG._r = render;
            PG.impPrevent = () => E.openForm({
                id: 'EDOC-재발방지-' + (dyn.length + 1), title: '재발방지대책 등록', form: 'F7',
                ctx: { menuLabel: '개선조치' }, onChange: render,
            });

            const NEXT_LABEL = { '접수': '조치 계획 등록', '계획': '진행 처리', '진행': '완료 보고', '완료확인': '확인·종결' };
            const dynRows = dyn.map(i => [
                '<b>' + esc(i.title) + '</b>',
                '<span class="chip-mini pdca">' + esc(i.sourceMenu) + '</span>',
                i.owner, i.due || '-',
                stepper(E.IMP_FLOW, i.status),
                i.status === '종결' ? '<span class="chip-mini st-done">종결</span>'
                    : '<button class="btn btn-sm btn-primary" onclick="PG.impNext(\'' + i.id + '\')">' + NEXT_LABEL[i.status] + '</button>',
            ]);
            return statboxes([
                ['danger', dyn.filter(i => i.status !== '종결').length, '처리 중 (실시간)'],
                ['success', dyn.filter(i => i.status === '종결').length, '종결 (실시간)'],
                ['neutral', aDocs.length, '조치 문서 마스터'],
                ['info', aDocs.filter(d => d.status === '완료').length, '마스터 완료'],
            ]) +
            sectionCard('개선조치 처리 목록 — 전 메뉴 자동 유입 (실시간)',
                (dynRows.length
                    ? tbl(['조치 사항', '발생원', '담당', '기한', '처리 단계', ''], dynRows)
                    : '<div class="v2-empty">아직 유입된 개선조치가 없습니다.<br><span style="font-size:12px;">위험성평가 X 판정 · 점검표 X 항목 · 의견청취 조치 분기에서 자동 생성됩니다 — 직접 만들어 보세요.</span></div>') +
                '<p style="font-size:12px; color:var(--text-gray); margin-top:8px;">유입 경로: 위험성평가 부적정(X) · 각 메뉴 점검표 X 항목 · 의견청취/신고 "개선조치 생성" 분기 · 수행평가 미흡</p>',
                '<button class="btn btn-sm btn-primary" onclick="PG.impPrevent()">+ 재발방지대책 등록</button>') +
            sectionCard('조치 문서 마스터 (엑셀 분류본 ' + aDocs.length + '건)',
                tbl(['문서명', '발생 메뉴', '주기', '상태'],
                    aDocs.slice(0, 8).map(d => [esc(d.name), d.daemenu === '확인필요' ? V.unassignedBadge() : '<span class="chip-mini pdca">' + esc(d.daemenu) + '</span>', esc(d.cycle), ST(d.status)])) +
                '<p style="font-size:12px; color:var(--text-gray); margin-top:8px;">외 ' + (aDocs.length - 8) + '건 — 업무문서 &gt; 이행문서에서 A 조치 필터로 전체 조회</p>');
        },

        /* ── 이행관리 [SFR-008·014]: 점검표(F5) → N→개선조치 → 마감(온나라) / 예산 e호조 ── */
        comply() {
            PG.cmpCheck = () => E.openForm({
                id: 'EDOC-의무이행점검-2026H1', title: '2026 상반기 의무이행 점검표 (중처법 시행령 §4·§5)', form: 'F5',
                ctx: { menuLabel: '이행관리 · 반기', checklist: T.CHECKLIST_PRESETS.comply }, onChange: render,
            });
            PG.cmpClose = () => E.onnaraPopup('2026 상반기 의무이행 점검 마감 보고');
            PG.cmpHojo = () => {
                V.openModal('e호조 집행 내역 조회 (연계 시뮬레이션)',
                    tbl(['집행일', '항목', '금액', '상태'], [
                        ['2026-06-05', '안전모·안전화 구입', '8,400천원', '<span class="chip-mini st-done">집행</span>'],
                        ['2026-06-02', '위험성평가 컨설팅 (2차)', '18,000천원', '<span class="chip-mini st-done">집행</span>'],
                        ['2026-05-28', '청사 비상유도등 교체', '12,600천원', '<span class="chip-mini st-done">집행</span>'],
                    ]),
                    '<button class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
                    '<button class="btn btn-primary" onclick="DYV2.closeModal(); DYV2.toast(\'e호조 집행 내역 3건이 반영되었습니다 — 집행률 재계산\')">집행 반영</button>');
            };
            const exec = p => '<div style="display:flex; align-items:center; gap:8px;"><div class="progress" style="width:90px;"><div class="progress-bar ' + (p >= 70 ? 'green' : 'warning') + '" style="width:' + p + '%"></div></div><b style="font-size:12px;">' + p + '%</b></div>';
            return sectionCard('의무이행 점검 (반기) ' + docStChip('EDOC-의무이행점검-2026H1'),
                '<p style="font-size:12px; color:var(--text-gray);">중처법 시행령 §4·§5 항목별 이행 여부를 점검합니다. 각 항목에는 해당 메뉴의 실데이터가 근거로 연결되며, <b>X(미이행) 항목은 확정 시 개선조치로 자동 등록</b>됩니다.</p>' +
                tbl(['항목', '근거 메뉴', '근거 현황'], [
                    ['§4-1 목표·경영방침 수립', '<a href="menu.html?m=policy" style="color:var(--main); font-weight:700;">경영방침</a>', '2026 방침 수립 · 점검 ' + (E.statusOf('EDOC-경영방침점검-2026H1') || '미작성')],
                    ['§4-3 유해·위험요인 확인·개선', '<a href="risk-list.html" style="color:var(--main); font-weight:700;">위험성평가</a>', '정기 1회 · 수시 2회 실시'],
                    ['§4-5 책임자 평가·관리', '<a href="menu.html?m=org" style="color:var(--main); font-weight:700;">조직</a>', '수행평가 ' + (E.statusOf('EDOC-수행평가-2026H1') || '미작성')],
                    ['§4-7 종사자 의견청취', '<a href="menu.html?m=opinion" style="color:var(--main); font-weight:700;">의견청취</a>', '접수·처리 운영 중'],
                ]),
                '<div style="display:flex; gap:6px;">' +
                '<button class="btn btn-sm btn-primary" onclick="PG.cmpCheck()">점검표 작성</button>' +
                '<button class="btn btn-sm btn-outline" onclick="PG.cmpClose()">반기 마감 · 온나라 상신</button></div>') +
            sectionCard('안전보건 예산 편성·집행 총괄 (2026)',
                tbl(['예산 항목', '편성액', '집행액', '집행률'], [
                    ['안전시설 개선', '480,000천원', '312,000천원', exec(65)],
                    ['보호구·장비 구입', '120,000천원', '96,000천원', exec(80)],
                    ['안전보건교육', '60,000천원', '21,000천원', exec(35)],
                    ['위험성평가·컨설팅', '90,000천원', '72,000천원', exec(80)],
                ]),
                '<button class="btn btn-sm btn-primary" onclick="PG.cmpHojo()">e호조 집행 내역 조회</button>');
        },
    };

    /* ── 문서 탭: 세트 단위 그룹 테이블 (setlist.js 공통 컴포넌트 · 해당 메뉴 고정) ── */
    (function renderDocs() {
        const pane = document.getElementById('pane-docs');
        if (!pane) return; /* 문서 탭 제거됨 — 업무문서 메뉴에서 통합 조회 */
        window.DYSETLIST.render(pane, { menuKey: KEY, hideTabs: true });
        pane.insertAdjacentHTML('beforeend',
            '<p style="font-size:12px; color:var(--text-gray); margin-top:4px;">' +
                '전 메뉴 통합 보기는 <a href="docs-preset.html?menu=' + KEY + '" style="color:var(--main); font-weight:700;">업무문서 &gt; 업무 목록</a>에서.' +
            '</p>');
    })();

    function render() {
        const pane = document.getElementById('pane-program');
        pane.innerHTML = PROGRAM[KEY] ? PROGRAM[KEY]() : '<div class="v2-empty">전용 기능 정의 없음</div>';
    }
    render();
})();
