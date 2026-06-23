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

    /* ── ① 요약 바 ── */
    (function renderSummary() {
        const rate = V.complianceRate(KEY);
        const due = V.dueCount(KEY);
        const barCls = rate >= 70 ? 'green' : rate >= 40 ? 'warning' : 'danger';
        document.getElementById('sbm-summary').innerHTML =
            '<div class="sbm-summary-item sbm-summary-rate">' +
                '<span class="sbm-summary-label">이행률</span>' +
                '<div class="progress"><div class="progress-bar ' + barCls + '" style="width:' + rate + '%"></div></div>' +
                '<span class="sbm-summary-value">' + rate + '%</span></div>' +
            '<div class="sbm-summary-divider"></div>' +
            '<div class="sbm-summary-item"><span class="sbm-summary-label">시기도래</span>' +
                (due > 0 ? '<span class="sbm-due-badge">● ' + due + '건</span>' : '<span class="sbm-due-badge none">없음</span>') + '</div>' +
            '<div class="sbm-summary-divider"></div>' +
            '<div class="sbm-summary-item"><span class="sbm-summary-label">담당부서</span>' +
                '<span class="sbm-summary-value" style="font-size:13px;">' + META.dept + '</span></div>';
    })();

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
        /* ── 경영방침 [SFR-005]: 목표·방침 설정(+가이드) → 근거법령·고려사항 관리 → 점검표 관리(O/X·텍스트·근거 직접등록) → 점검자 지정·반기 점검(F5) → 온나라 결재 → X→개선조치 ── */
        policy() {
            /* 근거법령 ↔ 세부내용 매칭 (마스터) */
            const LAWS = [
                ['중대재해처벌법 시행령', '제4조 1호', '안전보건 목표·경영방침 수립'],
                ['산업안전보건법', '제14조', '안전보건경영방침 설정·게시·주지'],
                ['산업안전보건법', '제15조', '안전보건관리책임자 지정'],
                ['산업안전보건법', '제24조', '산업안전보건위원회 운영'],
                ['산업안전보건법', '제36조', '위험성평가 시행'],
            ];
            /* 설정·점검 고려사항 (마스터) */
            const CONSIDER = [
                ['설정 시', '조직 규모·업종 특성에 맞는 목표 수준 설정'],
                ['설정 시', '전년도 재해·점검 결과를 목표에 반영'],
                ['공통', '종사자 의견을 수렴하여 목표·방침에 반영'],
                ['점검 시', '목표 대비 달성도와 미달 원인 분석'],
                ['점검 시', '법령 개정사항이 방침에 반영되었는지 확인'],
            ];
            /* 점검표 항목 (마스터) — 결과유형 O/X·텍스트, 관련 근거 직접등록 */
            const CHK = [
                ['목표·KPI', 'KPI 목표값 대비 달성 여부', 'O / X', '중처법 시행령 §4-1'],
                ['목표·KPI', '미달 KPI 원인 분석 수행', '텍스트', '중처법 시행령 §4-1'],
                ['조직·인력', '안전관리자 법정 인원 충족', 'O / X', '산안법 §17·§18'],
                ['위험성평가', '정기 위험성평가 시행률', 'O / X', '산안법 §36'],
                ['도급·협력', '도급업체 평가 적격률', 'O / X', '중처법 시행령 §4-9'],
                ['의견청취', '종사자 의견청취 정기 실시', 'O / X', '중처법 시행령 §4-7'],
            ];
            const subT = t => '<p style="font-size:12.5px; font-weight:700; color:var(--main-dark2); margin:0 0 8px;">' + t + '</p>';
            const delBtn = '<button class="btn btn-sm btn-outline" onclick="this.closest(\'tr\').remove(); DYV2.toast(\'삭제되었습니다\')">삭제</button>';

            /* 설정 가이드 모달 */
            const GUIDE = [
                ['1', '경영방침 작성 원칙', '최고경영자(군수)의 안전보건 의지 표현 · 법규 준수·지속 개선 · 조직 특성 반영 · 전 종사자 이해 가능', '산업안전보건법 §14 · 중처법 시행령 §4-1'],
                ['2', '목표(KPI) 설정', '측정 가능·달성 가능(SMART) · 전년 재해·점검 결과 반영 · 산출식·집계주기·책임부서 명시', '중처법 시행령 §4-1'],
                ['3', '게시·주지 의무', '확정 후 전 종사자 게시·공지 · 도급·용역·위탁 종사자 주지 · 사업장 게시', '산업안전보건법 §14'],
                ['4', '점검·환류', '반기 1회 이상 적정성 점검 · 보완 시 개선조치 · 법령개정·조직변경 시 갱신 · 결과를 차기 목표 반영', '중처법 시행령 §4-1'],
            ];
            PG.policyGuide = () => V.openModal('목표·경영방침 설정 가이드',
                '<div style="font-size:13px; line-height:1.7;">' + GUIDE.map(s =>
                    '<div style="display:flex; gap:10px; padding:10px 0; border-bottom:1px solid var(--card-line);">' +
                    '<span style="flex-shrink:0; width:24px; height:24px; border-radius:6px; background:var(--main); color:#fff; font-weight:700; display:flex; align-items:center; justify-content:center;">' + s[0] + '</span>' +
                    '<div><div style="font-weight:700; color:var(--main-dark2);">' + s[1] + '</div>' +
                    '<div style="color:var(--text-black);">' + s[2] + '</div>' +
                    '<div style="font-size:11px; color:var(--main); font-weight:600; margin-top:2px;">근거: ' + s[3] + '</div></div></div>').join('') + '</div>',
                '<button class="btn btn-primary" onclick="DYV2.closeModal()">확인</button>');

            /* 근거·고려사항 관리 모달 (등록·수정·삭제·조회 — 프로토타입) */
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

            /* 점검표 관리 모달 — 결과유형 O/X·텍스트, 관련근거 직접등록 */
            PG.policyChecklist = () => V.openModal('경영방침 점검표 관리',
                subT('점검 항목 · 결과유형(O/X·텍스트) · 관련 근거를 직접 등록합니다.') +
                '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>영역</th><th>점검 항목</th><th>결과유형</th><th>관련 근거</th><th></th></tr></thead><tbody id="policy-chk-tbody">' +
                CHK.map(r => '<tr><td><input value="' + r[0] + '" style="width:100%"></td><td><input value="' + r[1] + '" style="width:100%"></td><td><select><option' + (r[2] === 'O / X' ? ' selected' : '') + '>O / X</option><option' + (r[2] === '텍스트' ? ' selected' : '') + '>텍스트</option></select></td><td><input value="' + r[3] + '" style="width:100%"></td><td>' + delBtn + '</td></tr>').join('') +
                '</tbody></table></div>' +
                '<button class="btn btn-sm btn-outline" style="margin-top:8px;" onclick="PG.policyChkItemAdd()">+ 점검 항목 추가</button>' +
                '<p style="font-size:11.5px; color:var(--text-gray); margin-top:10px;">저장한 항목은 [이행점검 작성] 점검표에 사용됩니다. X 판정 항목은 확정 시 개선조치로 자동 등록됩니다.</p>',
                '<button class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
                '<button class="btn btn-primary" onclick="DYV2.closeModal(); DYV2.toast(\'점검표가 저장되었습니다\')">저장</button>');

            /* ── 관리 모달 '추가' 등록 팝업 (상위 모달 위 적층 오버레이) ── */
            PG._stackOpen = (title, body, foot) => {
                PG._stackClose();
                const ov = document.createElement('div');
                ov.id = 'stack-overlay'; ov.className = 'org-tree-overlay';
                ov.innerHTML = '<div class="org-tree-backdrop" onclick="PG._stackClose()"></div>' +
                    '<div class="org-tree-panel" role="dialog" aria-modal="true" style="max-width:460px;">' +
                    '<div class="org-tree-head"><span>' + title + '</span><button type="button" class="modal-close" onclick="PG._stackClose()" aria-label="닫기">&times;</button></div>' +
                    '<div class="org-tree-body" style="padding:18px 20px;">' + body + '</div>' +
                    '<div class="modal-footer">' + foot + '</div></div>';
                document.body.appendChild(ov);
            };
            PG._stackClose = () => { const o = document.getElementById('stack-overlay'); if (o) o.remove(); };
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
                '<span class="k">관련 근거</span><input id="chk-add-basis" type="text" placeholder="예: 중대재해처벌법 시행령 제4조제1호">' +
                '</div>',
                '<button class="btn btn-secondary" onclick="PG._stackClose()">취소</button>' +
                '<button class="btn btn-primary" onclick="PG.policyChkItemAddSave()">등록</button>');
            PG.policyChkItemAddSave = () => {
                const ar = (document.getElementById('chk-add-area') || {}).value || '';
                const it = (document.getElementById('chk-add-item') || {}).value || '';
                const ty = (document.getElementById('chk-add-type') || {}).value || 'O / X';
                const ba = (document.getElementById('chk-add-basis') || {}).value || '';
                const tb = document.getElementById('policy-chk-tbody');
                if (tb) { const tr = document.createElement('tr'); const s = '<select><option' + (ty === 'O / X' ? ' selected' : '') + '>O / X</option><option' + (ty === '텍스트' ? ' selected' : '') + '>텍스트</option></select>'; tr.innerHTML = '<td><input value="' + V.esc(ar) + '" style="width:100%"></td><td><input value="' + V.esc(it) + '" style="width:100%"></td><td>' + s + '</td><td><input value="' + V.esc(ba) + '" style="width:100%"></td><td>' + delBtn + '</td>'; tb.appendChild(tr); }
                PG._stackClose(); V.toast('점검 항목이 추가되었습니다');
            };
            PG.policyPublish = () => E.notify('경영방침 공표 — 전 종사자 612명 (게시판 + 문자)', '문자');

            /* ── 4.1 적용 대상 구분(담양군 전체·사업·사업장) → 대상 선택 enable/전환 ── */
            PG.policyScope = (el) => {
                el.parentElement.querySelectorAll('button').forEach(b => { b.className = 'btn btn-sm btn-outline'; });
                el.className = 'btn btn-sm btn-primary';
                const scope = el.getAttribute('data-scope');
                const sel = document.getElementById('policy-target');
                const pick = document.getElementById('policy-target-pick');
                const isAll = scope === '전체';
                if (sel) {
                    sel.disabled = isAll;
                    sel.innerHTML = '<option>사업 또는 사업장을 선택하세요</option>';
                }
                if (pick) pick.disabled = isAll;
            };
            PG.policyTargetPick = () => {
                const active = document.querySelector('[data-scope].btn-primary');
                const scope = active ? active.getAttribute('data-scope') : '사업';
                const rows = scope === '사업장'
                    ? [['사업장', '재난안전과', '담양군청 본청'], ['사업장', '공공시설사업소', '공공시설사업소'], ['사업장', '물순환사업소', '물순환사업소'], ['사업장', '보건소', '담양군 보건소'], ['사업장', '농업기술센터', '농업기술센터']]
                    : [['사업', '재난안전과', '2026 중대재해예방 종합계획'], ['사업', '재난안전과', '안전보건관리체계 구축 사업'], ['사업', '건설과', '산업재해예방계획 추진'], ['사업', '환경과', '공공시설 안전관리 사업']];
                V.openModal('적용 대상 선택',
                    '<div class="preset-form-grid"><span class="k">대상 구분</span><div><span class="chip-mini wt">' + scope + '</span></div></div>' +
                    '<div style="overflow-x:auto; margin-top:12px;"><table class="table-figma"><thead><tr><th>대상 구분</th><th>소관 부서</th><th>사업·사업장명</th><th></th></tr></thead><tbody>' +
                    rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td><button type="button" class="btn btn-sm btn-primary" onclick="PG.policyTargetChoose(\'' + r[2] + '\',\'' + r[1] + '\')">선택</button></td></tr>').join('') +
                    '</tbody></table></div>',
                    '<button class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>');
            };
            PG.policyTargetChoose = (name, dept) => {
                const sel = document.getElementById('policy-target');
                if (sel) { sel.disabled = false; sel.innerHTML = '<option>' + name + ' (' + dept + ')</option>'; }
                V.closeModal(); V.toast('적용 대상 선택: ' + name + ' · 소관 ' + dept);
            };

            /* ── 4.2 조직도 기반 점검자 선택 ── */
            PG.policyOrgPick = () => {
                const ORG = [['재난안전과', '재난안전과장', '홍길동'], ['재난안전과', '중대재해팀장', '김안전'], ['회계과', '계약담당자', '이담당'], ['건설과', '안전관리자', '박현장'], ['환경과', '보건관리자', '최보건']];
                V.openModal('조직도에서 점검자 선택',
                    '<div class="preset-form-grid"><span class="k">부서 검색</span><input type="text" placeholder="부서명을 입력하세요"></div>' +
                    '<div style="overflow-x:auto; margin-top:12px;"><table class="table-figma"><thead><tr><th>부서</th><th>직위·역할</th><th>성명</th><th></th></tr></thead><tbody>' +
                    ORG.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td><button type="button" class="btn btn-sm btn-primary" onclick="PG.policyOrgChoose(\'' + r[0] + '\',\'' + r[1] + '\',\'' + r[2] + '\')">선택</button></td></tr>').join('') +
                    '</tbody></table></div>',
                    '<button class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>');
            };
            PG.policyOrgChoose = (dept, role, name) => {
                const inp = document.getElementById('policy-inspector');
                if (inp) inp.value = dept + ' · ' + role + ' / ' + name;
                V.closeModal(); V.toast('점검자 선택: ' + dept + ' ' + role + ' ' + name);
            };

            /* ── 4.3 등록 알림 대상 설정 + 버튼(임시저장·등록) ── */
            PG.policyNotifySet = () => V.openModal('등록 알림 대상 설정',
                '<div class="notify-modal">' +
                '<div class="nm-title">알림 대상 구분</div>' +
                '<label class="nm-chk"><input type="checkbox" checked> 경영방침 담당자</label>' +
                '<label class="nm-chk"><input type="checkbox" checked> 점검자</label>' +
                '<label class="nm-chk"><input type="checkbox" checked> 소관 부서 담당자</label>' +
                '<label class="nm-chk"><input type="checkbox"> 부서장</label>' +
                '<div class="nm-title" style="margin-top:14px;">알림 채널</div>' +
                '<label class="nm-chk"><input type="checkbox" checked> 시스템 알림</label>' +
                '<label class="nm-chk"><input type="checkbox" checked> 새올 알림</label>' +
                '<label class="nm-chk"><input type="checkbox"> 문자</label>' +
                '<label class="nm-chk"><input type="checkbox"> 이메일</label>' +
                '<p style="font-size:11.5px; color:var(--text-gray); margin-top:12px;">등록 완료 시 선택된 담당자에게 자동으로 알림을 발송합니다.</p></div>',
                '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
                '<button class="btn btn-primary" onclick="DYV2.closeModal(); DYV2.toast(\'알림 대상이 설정되었습니다\')">저장</button>');
            PG.policyTempSave = () => V.toast('임시저장되었습니다 — 작성중 상태로 유지');
            PG.policyRegister = () => V.openModal('등록 완료',
                '<div style="text-align:center; padding:8px 4px 4px;"><div style="font-size:38px; margin-bottom:8px;">✅</div>' +
                '<p style="font-weight:700; margin-bottom:6px;">경영방침이 등록되었습니다.</p>' +
                '<p style="font-size:13px; color:var(--text-gray);">관련 담당자 4명에게 알림을 발송했습니다.</p></div>',
                '<button class="btn btn-primary" onclick="DYV2.closeModal()">확인</button>');

            /* ── 4.4 증빙 파일 목록·설명 관리 ── */
            let _editCell = null;
            PG.policyFileAdd = () => V.openModal('첨부파일 추가',
                '<div class="preset-form-grid"><span class="k">첨부파일</span><div class="upload-drop" style="padding:14px;" onclick="DYV2.toast(\'파일 선택 (프로토타입)\')">파일을 선택하세요</div>' +
                '<span class="k">파일 설명</span><input id="policy-file-newdesc" type="text" placeholder="첨부파일에 대한 설명을 입력하세요"></div>',
                '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
                '<button class="btn btn-primary" onclick="PG.policyFileAddSave()">등록</button>');
            PG.policyFileAddSave = () => {
                const d = document.getElementById('policy-file-newdesc');
                const tb = document.getElementById('policy-file-tbody');
                if (tb) {
                    const tr = document.createElement('tr');
                    tr.innerHTML = '<td>첨부_' + (tb.children.length + 1) + '.pdf</td><td>' + (d && d.value ? V.esc(d.value) : '(설명 없음)') + '</td><td>2026-06-22</td>' +
                        '<td><button type="button" class="btn btn-sm btn-outline" onclick="PG.policyFileEdit(this)">설명 수정</button> <button type="button" class="btn btn-sm btn-outline" onclick="PG.policyFileDel(this)">삭제</button></td>';
                    tb.appendChild(tr);
                }
                V.closeModal(); V.toast('첨부파일이 등록되었습니다');
            };
            PG.policyFileDel = (btn) => { const tr = btn.closest('tr'); if (tr) tr.remove(); V.toast('첨부파일이 삭제되었습니다'); };
            PG.policyFileEdit = (btn) => {
                const tr = btn.closest('tr'); _editCell = tr.children[1];
                V.openModal('파일 설명 수정',
                    '<div class="preset-form-grid"><span class="k">파일명</span><input type="text" value="' + tr.children[0].textContent + '" readonly>' +
                    '<span class="k">파일 설명</span><input id="policy-file-desc" type="text" value="' + _editCell.textContent + '"></div>',
                    '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
                    '<button class="btn btn-primary" onclick="PG.policyFileEditSave()">수정</button>');
            };
            PG.policyFileEditSave = () => { const inp = document.getElementById('policy-file-desc'); if (_editCell && inp) _editCell.textContent = inp.value; V.closeModal(); V.toast('파일 설명이 수정되었습니다'); };
            const fileRows = [
                ['경영방침_2026.pdf', '군수 승인 경영방침 원본', '2026-06-22'],
                ['의견수렴결과.xlsx', '부서별 의견수렴 결과 자료', '2026-06-21'],
            ];
            const fileListHtml = '<div class="attach-list"><div class="attach-list-head">첨부파일 목록</div>' +
                '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>파일명</th><th>파일 설명</th><th>등록일</th><th>관리</th></tr></thead><tbody id="policy-file-tbody">' +
                fileRows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td><button type="button" class="btn btn-sm btn-outline" onclick="PG.policyFileEdit(this)">설명 수정</button> <button type="button" class="btn btn-sm btn-outline" onclick="PG.policyFileDel(this)">삭제</button></td></tr>').join('') +
                '</tbody></table></div>' +
                '<button type="button" class="btn btn-sm btn-outline" style="margin-top:8px;" onclick="PG.policyFileAdd()">+ 파일 추가</button></div>';

            /* ── 4.6 온나라 결재 상태(미상신·결재중·승인완료·반려) + 이력 ── */
            const APPR = {
                '미상신':   { c: 'neutral', rows: [['온나라 문서번호', '-'], ['상신일시', '-'], ['현재 결재자', '-'], ['결재 결과', '-']] },
                '결재중':   { c: 'info',    rows: [['온나라 문서번호', '온나라-2026-3174'], ['상신일시', '2026-06-22 16:20'], ['결재선', '팀장 → 과장 → 부군수'], ['현재 결재자', '재난안전과장']] },
                '승인완료': { c: 'success', rows: [['온나라 문서번호', '온나라-2026-3174'], ['승인일시', '2026-06-23 10:12'], ['최종 승인자', '부군수'], ['공표 가능 여부', '공표 가능']] },
                '반려':     { c: 'danger', reject: true, rows: [['반려일시', '2026-06-23 09:30'], ['반려자', '재난안전과장'], ['반려 사유', '적용 대상 사업장을 구체적으로 지정해 주세요.']] },
            };
            const renderAppr = (st) => {
                const a = APPR[st] || APPR['미상신'];
                return '<div class="approval-box">' +
                    '<div class="approval-top"><span>온나라 결재 상태</span><span class="chip-status ' + a.c + '">' + st + '</span></div>' +
                    '<div class="approval-kv">' + a.rows.map(r => '<span class="ak">' + r[0] + '</span><span class="av">' + r[1] + '</span>').join('') + '</div>' +
                    (a.reject ? '<div class="approval-actions"><button type="button" class="btn btn-sm btn-outline" onclick="DYV2.toast(\'내용 수정 (프로토타입)\')">내용 수정</button><button type="button" class="btn btn-sm btn-primary" onclick="PG.policyApprSet(\'결재중\')">재상신</button></div>' : '') +
                    '<div class="approval-demo"><span>데모 전환</span>' +
                    '<button type="button" class="btn btn-sm btn-outline" onclick="PG.policyApprSet(\'결재중\')">결재중</button>' +
                    '<button type="button" class="btn btn-sm btn-outline" onclick="PG.policyApprSet(\'승인완료\')">승인완료</button>' +
                    '<button type="button" class="btn btn-sm btn-outline" onclick="PG.policyApprSet(\'반려\')">반려</button>' +
                    '<button type="button" class="btn btn-sm btn-outline" onclick="PG.policyApprSet(\'미상신\')">초기화</button>' +
                    '<button type="button" class="btn btn-sm btn-outline" onclick="PG.policyApprHistory()">결재 이력</button>' +
                    '</div></div>';
            };
            /* 결재 상태 전환 → 상태 스트립 갱신(render) */
            PG.policyApprSet = (st) => { window.__policyApproval = st; render(); V.toast('결재 상태: ' + st); };
            PG.policyApprHistory = () => V.openModal('온나라 결재 이력',
                '<div class="approval-kv" style="margin-bottom:14px;">' + (APPR[window.__policyApproval || '미상신'] || APPR['미상신']).rows.map(r => '<span class="ak">' + r[0] + '</span><span class="av">' + r[1] + '</span>').join('') + '</div>' +
                '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>일시</th><th>처리</th><th>처리자</th><th>비고</th></tr></thead><tbody>' +
                [['2026-06-22 16:20', '결재 상신', '김담당', '-'], ['2026-06-22 17:05', '팀장 승인', '이팀장', '-'], ['2026-06-23 09:30', '과장 반려', '박과장', '적용 대상 보완 필요']].map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td></tr>').join('') +
                '</tbody></table></div>',
                '<button class="btn btn-primary" onclick="DYV2.closeModal()">확인</button>');
            /* 상신 → 결재중 (상신을 즉시 승인/확정으로 표시하지 않음) */
            PG.policyOnnara = () => { window.__policyApproval = '결재중'; render(); E.onnaraPopup('2026년 안전·보건 목표와 경영방침'); };

            /* 뷰/편집 분리 — [수정] 토글 (평소 읽기, 클릭 시 편집폼 펼침) */
            PG.policyEdit = () => {
                const ed = document.getElementById('policy-edit');
                const btn = document.getElementById('policy-edit-btn');
                if (!ed) return;
                const open = ed.style.display === 'none';
                ed.style.display = open ? 'block' : 'none';
                if (btn) btn.textContent = open ? '편집 닫기' : '수정';
                if (open) ed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            };

            /* 게시·주지 비포/애프터 게시판 (산안법 §14) — 위치는 사용자 커스터마이징(추가·삭제) */
            const POSTINGS = [
                { loc: '군청 본관 1층 게시판', before: '구 방침 v2.5 게시', after: '신 방침 v3.0 게시', date: '2026-02-05', st: '게시완료', c: 'success' },
                { loc: '내부망(새올) 전자게시', before: '게시 전', after: '전 직원 612명 공지', date: '2026-02-03', st: '게시완료', c: 'success' },
                { loc: '공공시설사업소 게시판', before: '구 방침 v2.5 게시', after: '미게시', date: '-', st: '미게시', c: 'neutral' },
            ];
            const DEPTS = ['재난안전과', '건설과', '환경과', '보건소', '공공시설사업소', '물순환사업소', '농업기술센터'];

            /* 내부 서브탭 전환 (경영방침 · 이행 점검 · 게시·주지 현황) */
            PG.policyTab = (name) => {
                window.__policyTab = name;
                ['main', 'check', 'board'].forEach(k => { const el = document.getElementById('policy-tab-' + k); if (el) el.style.display = k === name ? '' : 'none'; });
                document.querySelectorAll('.psub-tab').forEach(t => t.classList.toggle('is-active', t.getAttribute('data-tab') === name));
            };

            /* 게시 등록 — 위치 입력 + 비포/애프터 + 알림 발송(선택) + 부서/전체 */
            PG.policyPostAdd = () => V.openModal('게시·주지 등록 (비포 / 애프터)',
                '<div class="preset-form-grid">' +
                '<span class="k">게시 위치</span><input id="post-loc" type="text" placeholder="예: 군청 본관 1층 게시판">' +
                '<span class="k">게시 전 (Before)</span><div class="upload-drop" style="padding:14px;" onclick="DYV2.toast(\'게시 전 사진 선택 (프로토타입)\')">게시 전 사진 첨부</div>' +
                '<span class="k">게시 후 (After)</span><div class="upload-drop" style="padding:14px;" onclick="DYV2.toast(\'게시 후 사진 선택 (프로토타입)\')">게시 후 사진 첨부</div>' +
                '<span class="k">게시일</span><input id="post-date" type="date" value="2026-02-05">' +
                '<span class="k">알림 발송</span>' +
                '<div>' +
                '<label class="nm-chk" style="padding:0;"><input type="checkbox" id="post-notify" checked onchange="document.getElementById(\'post-notify-opts\').style.display=this.checked?\'flex\':\'none\'"> 등록 시 알림 발송 <span style="color:var(--text-lightgray);">(선택)</span></label>' +
                '<div id="post-notify-opts" style="display:flex; gap:14px; align-items:center; flex-wrap:wrap; margin-top:8px;">' +
                '<label class="nm-chk" style="padding:0;"><input type="radio" name="post-scope" value="전체" checked onclick="document.getElementById(\'post-dept\').disabled=true"> 전체</label>' +
                '<label class="nm-chk" style="padding:0;"><input type="radio" name="post-scope" value="부서" onclick="document.getElementById(\'post-dept\').disabled=false"> 부서</label>' +
                '<select id="post-dept" disabled>' + DEPTS.map(d => '<option>' + d + '</option>').join('') + '</select>' +
                '</div>' +
                '</div>' +
                '</div>',
                '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
                '<button class="btn btn-primary" onclick="PG.policyPostSave()">등록</button>');
            PG.policyPostSave = () => {
                const loc = ((document.getElementById('post-loc') || {}).value || '').trim() || '새 게시 위치';
                const date = (document.getElementById('post-date') || {}).value || '-';
                const notify = (document.getElementById('post-notify') || {}).checked;
                const scopeEl = document.querySelector('input[name="post-scope"]:checked');
                const scope = scopeEl ? scopeEl.value : '전체';
                const dept = (document.getElementById('post-dept') || {}).value || '';
                const list = document.getElementById('policy-board-list');
                if (list) {
                    const card = document.createElement('div');
                    card.className = 'ba-card';
                    card.innerHTML = '<div class="ba-card-loc"><span>' + V.esc(loc) + '</span>' +
                        '<span style="display:flex; gap:6px; align-items:center;"><span class="chip-status info">게시중</span>' +
                        '<button type="button" class="ba-del" onclick="PG.policyPostDel(this)" aria-label="삭제">×</button></span></div>' +
                        '<div class="ba-pair"><div class="ba-slot"><span class="ba-tag before">BEFORE</span><div class="ba-ph">게시 전 사진</div></div>' +
                        '<div class="ba-arrow">→</div>' +
                        '<div class="ba-slot"><span class="ba-tag after">AFTER</span><div class="ba-ph">게시 후 사진</div></div></div>' +
                        '<div class="ba-date">게시일 ' + V.esc(date) + '</div>';
                    list.appendChild(card);
                }
                V.closeModal();
                if (notify) V.toast('게시 등록 완료 — ' + (scope === '부서' ? (dept || '선택 부서') : '전 직원') + '에 알림 발송');
                else V.toast('게시 등록 완료 (알림 미발송)');
            };
            PG.policyPostDel = (btn) => { const c = btn.closest('.ba-card'); if (c) c.remove(); V.toast('게시 항목이 삭제되었습니다'); };

            /* ── 반기 점검 (F5) — 점검표 객체·증빙 파일목록 주입 ── */
            PG.policyCheck = () => E.openForm({
                id: 'EDOC-경영방침점검-2026H1', title: '2026 상반기 경영방침 수립·이행 점검표', form: 'F5',
                ctx: { menuLabel: '경영방침 · 반기', checklist: T.CHECKLIST_PRESETS.policy, attachList: [
                    { name: '반기점검_현장사진.jpg', desc: '점검 현장 사진', date: '2026-06-22' },
                    { name: '점검회의록.pdf', desc: '점검 회의 결과', date: '2026-06-21' },
                ] },
                fields: { owner: '재난안전과 · 재난안전과장 / 홍길동' },
                onChange: render,
            });
            const apprNow = window.__policyApproval || '미상신';
            const apprColor = (APPR[apprNow] || APPR['미상신']).c;
            const todo = { '미상신': '경영방침을 작성하고 온나라 결재를 상신하세요.', '결재중': '온나라 결재 진행 중입니다 — 승인을 기다립니다.', '승인완료': '승인 완료 — 전 직원에 게시·주지하세요.', '반려': '반려되었습니다 — 사유 확인 후 수정·재상신하세요.' }[apprNow];
            const stepHtml = (label, state, cls, onclick) => '<div class="pstrip-step' + (onclick ? ' is-link' : '') + '"' + (onclick ? ' onclick="' + onclick + '"' : '') + '><div class="pstrip-lab">' + label + '</div><span class="chip-status ' + cls + '">' + state + '</span></div>';
            const ptab = window.__policyTab || 'main';

            return (
                /* ── 내부 서브탭: 경영방침 / 게시·주지 현황 ── */
                '<div class="psub-tabs">' +
                '<button type="button" data-tab="main" class="psub-tab' + (ptab === 'main' ? ' is-active' : '') + '" onclick="PG.policyTab(\'main\')">경영방침</button>' +
                '<button type="button" data-tab="check" class="psub-tab' + (ptab === 'check' ? ' is-active' : '') + '" onclick="PG.policyTab(\'check\')">이행 점검</button>' +
                '<button type="button" data-tab="board" class="psub-tab' + (ptab === 'board' ? ' is-active' : '') + '" onclick="PG.policyTab(\'board\')">게시 현황</button>' +
                '</div>' +
                '<div id="policy-tab-main"' + (ptab === 'board' ? ' style="display:none;"' : '') + '>' +
                /* ── 진행 상태 스트립 + '지금 할 일' (gov.uk Task list + Krug) ── */
                '<div class="pstrip">' +
                '<div class="pstrip-steps">' +
                stepHtml('① 목표·방침', '등록완료', 'success') +
                stepHtml('② 온나라 결재', apprNow, apprColor) +
                stepHtml('③ 게시', '게시중', 'info', "PG.policyTab('board')") +
                stepHtml('④ 반기 점검', 'D-12 예정', 'warning', "PG.policyTab('check')") +
                '</div>' +
                '<div class="pstrip-todo"><b>지금 할 일</b> · ' + todo + '</div>' +
                '<div class="pstrip-demo"><span>데모 상태</span>' +
                ['미상신', '결재중', '승인완료', '반려'].map(s => '<button type="button" class="btn btn-sm ' + (s === apprNow ? 'btn-primary' : 'btn-outline') + '" onclick="PG.policyApprSet(\'' + s + '\')">' + s + '</button>').join('') +
                '<button type="button" class="btn btn-sm btn-outline" onclick="PG.policyApprHistory()">결재 이력</button></div>' +
                '</div>' +

                /* ── 카드 A: 경영방침 (현황 읽기 + [수정] 편집 분리) ── */
                sectionCard('경영방침 현황 ' + docStChip('EDOC-경영방침-2026'),
                    /* 읽기 뷰 (평소) */
                    '<div id="policy-read">' +
                    '<div class="pol-read-head"><span class="chip-mini wt">v3.0</span><span class="chip-status success">시행중 (2026-02-03~)</span></div>' +
                    '<p class="pol-read-policy">군민과 종사자의 생명·안전을 최우선으로 하는 안전 담양</p>' +
                    '<div class="pol-read-goal">1. 중대산업재해·중대시민재해 ZERO · 2. 위험성평가 이행률 100% · 3. 안전보건교육 이수율 95% 이상</div>' +
                    '<div class="pol-read-meta">적용대상 <b>전 39부서(산업) + 10부서(시민)</b> · 점검자 <b>재난안전과장 / 홍길동</b> · 증빙 <b>2건</b></div>' +
                    '<div class="pol-badges">' +
                    '<button type="button" class="pol-badge" onclick="PG.policyBasis()">근거법령 ' + LAWS.length + ' ›</button>' +
                    '<button type="button" class="pol-badge" onclick="PG.policyChecklist()">점검항목 ' + CHK.length + ' ›</button>' +
                    '<button type="button" class="pol-badge" onclick="PG.policyBasis()">고려사항 ' + CONSIDER.length + ' ›</button>' +
                    '</div>' +
                    '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:14px;">' +
                    '<button id="policy-edit-btn" class="btn btn-sm btn-primary" onclick="PG.policyEdit()">수정</button>' +
                    '<button class="btn btn-sm btn-outline" onclick="PG.policyGuide()">ⓘ 작성 가이드</button>' +
                    '<button class="btn btn-sm btn-outline" onclick="DYV2.toast(\'방침 본문 PDF 출력 (프로토타입)\')">PDF</button>' +
                    '</div>' +
                    '</div>' +
                    /* 편집 뷰 (숨김 — [수정] 클릭 시) */
                    '<div id="policy-edit" style="display:none; margin-top:16px; border-top:1px solid var(--card-line); padding-top:16px;">' +
                    '<div class="pf-sec-title" style="margin-top:0;">기본 정보</div>' +
                    '<div class="preset-form-grid">' +
                    '<span class="k">적용 대상 구분</span>' +
                    '<div style="display:flex; gap:6px; flex-wrap:wrap;">' +
                    '<button type="button" class="btn btn-sm btn-primary" data-scope="전체" onclick="PG.policyScope(this)">담양군 전체</button>' +
                    '<button type="button" class="btn btn-sm btn-outline" data-scope="사업" onclick="PG.policyScope(this)">사업</button>' +
                    '<button type="button" class="btn btn-sm btn-outline" data-scope="사업장" onclick="PG.policyScope(this)">사업장</button>' +
                    '</div>' +
                    '<span class="k">대상 선택</span>' +
                    '<div style="display:flex; gap:8px; align-items:center;">' +
                    '<select id="policy-target" disabled style="flex:1;"><option>사업 또는 사업장을 선택하세요</option></select>' +
                    '<button type="button" id="policy-target-pick" class="btn btn-sm btn-outline" disabled onclick="PG.policyTargetPick()">선택</button>' +
                    '</div>' +
                    '<span class="k">경영방침</span><input type="text" value="군민과 종사자의 생명·안전을 최우선으로 하는 안전 담양">' +
                    '<span class="k">안전보건 목표</span><textarea>1. 중대산업재해·중대시민재해 ZERO\n2. 위험성평가 이행률 100%\n3. 안전보건교육 이수율 95% 이상</textarea>' +
                    '<span class="k">점검자 지정</span>' +
                    '<div style="display:flex; gap:8px; align-items:center;">' +
                    '<input id="policy-inspector" type="text" value="재난안전과 · 재난안전과장 / 홍길동" readonly style="flex:1;">' +
                    '<button type="button" class="btn btn-sm btn-outline" onclick="EDOC.openOrgTree(\'policy-inspector\')">조직도</button>' +
                    '</div>' +
                    '<span class="k">등록 알림</span>' +
                    '<div style="display:flex; gap:8px; align-items:center;">' +
                    '<span style="flex:1;">재난안전과 중대재해팀 외 3명</span>' +
                    '<button type="button" class="btn btn-sm btn-outline" onclick="PG.policyNotifySet()">설정</button>' +
                    '</div>' +
                    '</div>' +
                    '<div class="pf-sec-title">증빙자료</div>' +
                    '<div class="upload-drop" style="padding:12px;" onclick="DYV2.toast(\'방침 본문·의견수렴 결과 등 다중 첨부 (프로토타입)\')">방침 본문·의견수렴 결과 등 다중 첨부 (최대 10개)</div>' +
                    fileListHtml +
                    '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:16px;">' +
                    '<button class="btn btn-sm btn-secondary" onclick="PG.policyTempSave()">임시저장</button>' +
                    '<button class="btn btn-sm btn-secondary" onclick="PG.policyRegister()">등록</button>' +
                    '<button class="btn btn-sm btn-primary" onclick="PG.policyOnnara()">온나라 결재 상신</button>' +
                    '</div>' +
                    '</div>',
                    '') +

                '</div>' +

                /* ── 이행 점검 탭 ── */
                '<div id="policy-tab-check"' + (ptab !== 'check' ? ' style="display:none;"' : '') + '>' +
                sectionCard('2026 상반기 점검 <span class="chip-status warning" style="margin-left:6px;">D-12 예정</span> ' + docStChip('EDOC-경영방침점검-2026H1'),
                    '<p style="font-size:12.5px; color:var(--text-gray);">점검자 지정 후 반기 1회 점검표를 작성합니다. <b>O/X·텍스트로 결과 입력</b>, <b>X 판정은 개선조치 자동 등록</b> 후 온나라 결재 상신.</p>',
                    '<button class="btn btn-sm btn-primary" onclick="PG.policyCheck()">이행점검 작성</button>') +
                '</div>' +

                /* ── 게시·주지 현황 탭 (비포/애프터 게시판, 위치 커스터마이징) ── */
                '<div id="policy-tab-board"' + (ptab !== 'board' ? ' style="display:none;"' : '') + '>' +
                sectionCard('게시 현황 <span class="chip-mini wt" style="margin-left:6px; font-weight:600;">산안법 §14</span>',
                    '<p style="font-size:12px; color:var(--text-gray); margin:0 0 12px;">게시 위치를 자유롭게 추가·삭제할 수 있습니다. 각 위치의 <b>게시 전(Before) → 게시 후(After)</b>로 게시·주지 이행을 증빙합니다.</p>' +
                    '<div class="ba-board" id="policy-board-list">' +
                    POSTINGS.map(p => '<div class="ba-card">' +
                        '<div class="ba-card-loc"><span>' + p.loc + '</span><span style="display:flex; gap:6px; align-items:center;"><span class="chip-status ' + p.c + '">' + p.st + '</span><button type="button" class="ba-del" onclick="PG.policyPostDel(this)" aria-label="삭제">×</button></span></div>' +
                        '<div class="ba-pair">' +
                        '<div class="ba-slot"><span class="ba-tag before">BEFORE</span><div class="ba-ph">' + p.before + '</div></div>' +
                        '<div class="ba-arrow">→</div>' +
                        '<div class="ba-slot"><span class="ba-tag after">AFTER</span><div class="ba-ph">' + p.after + '</div></div>' +
                        '</div>' +
                        '<div class="ba-date">게시일 ' + p.date + '</div>' +
                        '</div>').join('') +
                    '</div>',
                    '<button class="btn btn-sm btn-primary" onclick="PG.policyPostAdd()">+ 게시 위치 추가</button>') +
                '</div>'
            );
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
            const team = (name, n) => '<div style="border:1px solid var(--card-line); border-radius:var(--radius-md); padding:10px 14px; text-align:center; background:#fff;"><div style="font-size:12.5px; font-weight:700;">' + name + '</div><div style="font-size:11px; color:var(--text-gray);">' + n + '명</div></div>';
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
                '<p style="font-size:12.5px; color:var(--text-gray);">경영책임자가 안전보건관리책임자등의 업무 수행을 반기 1회 평가하고, 미흡 판정은 후속 조치(포상·인사)로 이어집니다.</p>',
                '<div style="display:flex; gap:6px;">' +
                '<button class="btn btn-sm btn-primary" onclick="PG.orgEval()">수행평가 작성</button>' +
                '<button class="btn btn-sm btn-outline" onclick="PG.orgFollow()">후속조치 등록</button></div>');
        },

        /* ── 의견청취 [SFR-011]: 안전나우 패턴 — 스테퍼·조치방법 분기·연동 카드·결과 회신 ── */
        opinion() {
            const FLOW = ['접수대기', '점검중', '개선조치중', '완료'];
            function db() {
                try { const s = JSON.parse(localStorage.getItem('dy-opn-v1')); if (s) return s; } catch (e) {}
                return [
                    { id: 'OPN-21', title: '제설 작업 시 2인 1조 의무화 요청', via: '온라인', date: '2026-06-08', status: '점검중', owner: '재난안전과', link: '' },
                    { id: 'OPN-20', title: '노후 사다리 교체 요청', via: '오프라인', date: '2026-05-28', status: '완료', owner: '행정과', link: 'IMP-기존' },
                    { id: 'OPN-19', title: '청사 주차장 야간 조명 보강', via: 'QR', date: '2026-05-20', status: '접수대기', owner: '', link: '' },
                ];
            }
            let OPN = db();
            const persist = () => { try { localStorage.setItem('dy-opn-v1', JSON.stringify(OPN)); } catch (e) {} };

            PG.opnAdd = () => {
                V.openModal('의견 등록 (근로자 QR·온라인 / 담당자 대리 입력)',
                    '<div class="preset-form-grid">' +
                    '<span class="k">제목</span><input type="text" id="op-title" placeholder="예: ○○ 작업 안전 개선 요청">' +
                    '<span class="k">접수 경로</span><select id="op-via"><option>온라인</option><option>QR</option><option>오프라인</option><option>위원회</option></select>' +
                    '<span class="k">내용</span><textarea placeholder="의견 내용을 입력하세요"></textarea>' +
                    '<span class="k">사진 첨부</span><div class="upload-drop" style="padding:14px;">현장 사진 첨부 (선택)</div></div>',
                    '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
                    '<button class="btn btn-primary" id="op-submit">접수</button>');
                document.getElementById('op-submit').addEventListener('click', () => {
                    const t = document.getElementById('op-title').value || '제목 없는 의견';
                    OPN.unshift({ id: 'OPN-' + (22 + OPN.length), title: t, via: document.getElementById('op-via').value, date: '2026-06-11', status: '접수대기', owner: '', link: '' });
                    persist(); V.closeModal(); render();
                    E.notify('의견 접수 알림 — "' + t + '" (의견청취 담당)', '문자');
                });
            };

            PG.opnProcess = id => {
                const o = OPN.find(x => x.id === id);
                V.openModal('의견 처리 — ' + esc(o.title),
                    '<div style="margin-bottom:12px;">' + stepper(FLOW, o.status, o.status === '반려') + '</div>' +
                    (o.link ? '<div class="edoc-linkcard">🔗 연동 정보 — 개선조치 ' + esc(o.link) + ' 자동 생성됨</div>' : '') +
                    '<div class="preset-form-grid">' +
                    '<span class="k">담당 배정</span><select id="op-owner"><option' + (o.owner === '재난안전과' ? ' selected' : '') + '>재난안전과</option><option>행정과</option><option>환경과</option><option>도시과</option></select>' +
                    '<span class="k">조치 방법 선택</span><div style="display:flex; flex-direction:column; gap:6px;">' +
                        '<label style="font-size:12.5px;"><input type="radio" name="op-act" value="inspect" checked> 현장점검 실시 — 점검 후 조치 판단</label>' +
                        '<label style="font-size:12.5px;"><input type="radio" name="op-act" value="improve"> 개선조치 바로 생성 — 위험 명확</label>' +
                        '<label style="font-size:12.5px;"><input type="radio" name="op-act" value="reject"> 반려 — 사유가 작성자에게 알림 발송</label></div>' +
                    '<span class="k">처리 의견·사유</span><textarea id="op-note" placeholder="점검 계획 / 조치 내용 / 반려 사유"></textarea></div>',
                    '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
                    '<button class="btn btn-primary" id="op-save">저장</button>');
                document.getElementById('op-save').addEventListener('click', () => {
                    const act = document.querySelector('input[name=op-act]:checked').value;
                    o.owner = document.getElementById('op-owner').value;
                    if (act === 'inspect') { o.status = '점검중'; V.toast('현장점검이 등록되었습니다 — 점검 결과에 따라 개선조치로 전환'); }
                    if (act === 'improve') {
                        const imp = E.addImprovement({ title: o.title, sourceMenu: '의견청취', sourceDoc: o.id, owner: o.owner, due: '2026-07-15' });
                        o.status = '개선조치중'; o.link = imp.id;
                        V.toast('개선조치 ' + imp.id + ' 자동 생성 — 개선조치 메뉴에 집계됩니다');
                    }
                    if (act === 'reject') { o.status = '반려'; E.notify('의견 반려 안내 — 사유가 작성자에게 발송되었습니다', '문자'); }
                    persist(); V.closeModal(); render();
                });
            };

            PG.opnDone = id => {
                const o = OPN.find(x => x.id === id);
                o.status = '완료'; persist(); render();
                E.notify('의견 처리 결과 회신 — "' + o.title + '" 조치 완료', '문자');
            };

            PG.opnMeeting = kind => E.openForm({
                id: 'EDOC-' + kind + '-2026Q2', title: '2026 2분기 ' + kind + ' 회의록', form: 'F3',
                ctx: { menuLabel: '의견청취 · ' + (kind === '산업안전보건위원회' ? '분기' : '월간') }, onChange: render,
            });
            PG.opnShare = () => { E.notify('위원회 결과 공유 — 전 부서 게시 + 메일', '메일'); setTimeout(() => V.toast('"실시 결과 공유 실적" 문서가 자동 기록되었습니다'), 1200); };

            const rows = OPN.map(o => [
                '<b>' + esc(o.title) + '</b>' + (o.link ? ' <span class="chip-mini wt-elec">🔗 ' + esc(o.link) + '</span>' : ''),
                '<span class="chip-mini ' + (o.via === '온라인' || o.via === 'QR' ? 'wt-elec' : 'wt') + '">' + esc(o.via) + '</span>',
                o.date, o.owner || '-',
                stepper(FLOW, o.status, o.status === '반려'),
                o.status === '개선조치중'
                    ? '<button class="btn btn-sm btn-primary" onclick="PG.opnDone(\'' + o.id + '\')">조치 결과 입력</button>'
                    : (o.status === '완료' || o.status === '반려')
                        ? '<button class="btn btn-sm btn-outline" onclick="PG.opnProcess(\'' + o.id + '\')">보기</button>'
                        : '<button class="btn btn-sm btn-primary" onclick="PG.opnProcess(\'' + o.id + '\')">처리</button>',
            ]);
            const cnt = s => OPN.filter(o => o.status === s).length;
            return statboxes([['info', cnt('접수대기'), '접수대기'], ['warning', cnt('점검중'), '점검중'], ['danger', cnt('개선조치중'), '개선조치중'], ['success', cnt('완료'), '완료']]) +
            sectionCard('의견 접수·처리 (' + OPN.length + '건)',
                tbl(['의견', '경로', '접수일', '담당', '처리 단계', ''], rows) +
                '<p style="font-size:11.5px; color:var(--text-gray); margin-top:8px;">처리 플로우: 접수 → 담당 배정 → <b>조치 방법 선택</b>(현장점검 / 개선조치 생성 / 반려) → 조치 → 결과 회신 알림</p>',
                '<button class="btn btn-sm btn-primary" onclick="PG.opnAdd()">+ 의견 등록</button>') +
            sectionCard('위원회·협의체 (회차 자동 생성)',
                tbl(['구분', '주기', '이번 회차', '회의록', ''], [
                    ['산업안전보건위원회', '분기', '2026 2분기 (기한 06-30)', docStChip('EDOC-산업안전보건위원회-2026Q2'),
                     '<button class="btn btn-sm btn-primary" onclick="PG.opnMeeting(\'산업안전보건위원회\')">회의록 작성</button>'],
                    ['안전 및 보건에 관한 협의체', '월간', '2026년 6월 (기한 06-30)', docStChip('EDOC-안전 및 보건에 관한 협의체-2026Q2'),
                     '<button class="btn btn-sm btn-primary" onclick="PG.opnMeeting(\'안전 및 보건에 관한 협의체\')">회의록 작성</button>'],
                ]) ,
                '<button class="btn btn-sm btn-outline" onclick="PG.opnShare()">결과 공유 (게시+알림)</button>');
        },

        /* ── 도급관리 [SFR-013]: e호조 불러오기 → 적격 평가 → 점검표 → 수급인 평가 ── */
        contract() {
            PG.conAdd = () => {
                V.openModal('도급·용역·위탁 사업 등록',
                    '<div class="edoc-linkcard">🔗 차세대 e호조 연계 — 계약 정보를 불러오면 항목이 자동 입력됩니다 (연계 61건)</div>' +
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
                '<p style="font-size:11.5px; color:var(--text-gray); margin-top:8px;">유입 경로: 위험성평가 부적정(X) · 각 메뉴 점검표 X 항목 · 의견청취/신고 "개선조치 생성" 분기 · 수행평가 미흡</p>',
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
                '<p style="font-size:12.5px; color:var(--text-gray);">중처법 시행령 §4·§5 항목별 이행 여부를 점검합니다. 각 항목에는 해당 메뉴의 실데이터가 근거로 연결되며, <b>X(미이행) 항목은 확정 시 개선조치로 자동 등록</b>됩니다.</p>' +
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
        window.DYSETLIST.render(pane, { menuKey: KEY, hideTabs: true });
        pane.insertAdjacentHTML('beforeend',
            '<p style="font-size:11.5px; color:var(--text-gray); margin-top:4px;">' +
                '전 메뉴 통합 보기는 <a href="docs-preset.html?menu=' + KEY + '" style="color:var(--main); font-weight:700;">업무문서 &gt; 업무 목록</a>에서.' +
            '</p>');
    })();

    function render() {
        const pane = document.getElementById('pane-program');
        pane.innerHTML = PROGRAM[KEY] ? PROGRAM[KEY]() : '<div class="v2-empty">전용 기능 정의 없음</div>';
    }
    render();
})();
