/* =========================================================================
 * 업무 등록 마법사 + CRUD (DYREG) — 업무 목록(docs-preset) · 이행 목록(docs-exec)
 *   기획: 기획-업무등록-CRUD-상세설계-v1.md
 *   STEP1 분류(대메뉴 탭 · 세트 · PDCA 라디오) → STEP2 처리유형 → STEP3 처리유형별 분기 폼 → STEP4 확인
 *   저장: localStorage 'dy-userdocs-v2' (시드 DY_DOCS_V2 원본은 불변, 사용자 등록분만 수정·삭제)
 *   조회: allDocs() = 시드 + 사용자 / setIdOf(doc) = 문서의 세트 (setlist.js·doc-detail.js가 사용)
 * ========================================================================= */
(function () {
    'use strict';
    const V = () => window.DYV2;
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const today = () => new Date().toISOString().slice(0, 10);

    /* ── 마스터 데이터 ── */
    const MENUS = () => window.DY_MENUS_V2 || {};
    const MENU_KEYS = () => window.MENU_ORDER_V2 || Object.keys(MENUS());
    const SETS = () => window.DY_SETS_V2 || [];
    const setsForMenu = mk => SETS().filter(s => s.menuKey === mk).sort((a, b) => a.order - b.order);

    const PDCA = [['P', 'P 계획'], ['D', 'D 실행'], ['C', 'C 점검'], ['A', 'A 조치']];
    const PROC_TYPES = [
        ['첨부파일', '문서', '한글·PDF 등 완성 문서를 올려 보관'],
        ['전자문서', '양식', '시스템 양식에 값을 입력해 작성'],
        ['프로그램', '화면', '전용 화면에서 입력·평가·이력 관리'],
    ];
    const CYCLES = ['연간', '반기', '분기', '월', '수시', '발생시', '상시'];
    const DOC_ROLES = ['기준/절차', '계획', '실행/실적', '점검', '조치', '기타'];

    /* 첨부파일 업로드 제약 안내 — DYV2.fileHint() 단일 출처 재사용 */
    const fileHintHtml = () => (V() && V().fileHint ? V().fileHint() : '');
    const DEPTS = ['재난안전과', '건설과', '환경과', '보건소', '공공시설사업소', '물순환사업소', '행정과', '회계과', '도시과', '기획예산실'];

    /* 전자문서 양식: 표준 폼 7종(EDOC_T.FORMS) + 빌더 프리셋 — formId는 인라인 렌더용 표준폼 매핑 */
    function formOptions() {
        const T = window.EDOC_T || { FORMS: {} };
        const std = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7']
            .filter(id => T.FORMS[id])
            .map(id => ({ kind: 'standard', formId: id, label: id + ' ' + T.FORMS[id].name }));
        const preset = [
            { kind: 'preset', formId: 'F1', label: '[프리셋] 계획·실적 공통 양식' },
            { kind: 'preset', formId: 'F3', label: '[프리셋] 회의록 양식 (위원회·협의체)' },
            { kind: 'preset', formId: 'F5', label: '[프리셋] 점검표 양식 (O/X·텍스트)' },
            { kind: 'preset', formId: 'F4', label: '[프리셋] 교육 결과 양식' },
            { kind: 'preset', formId: 'F6', label: '[프리셋] 평가·후속조치 양식' },
        ];
        return std.concat(preset);
    }
    function formLabel(ref) {
        if (!ref) return '-';
        const hit = formOptions().find(f => f.kind === ref.kind && f.formId === ref.formId && f.label === ref.label);
        return (hit || ref).label || ref.formId;
    }

    /* 프로그램 연결 가능 화면 */
    const LINK_TARGETS = [
        { v: 'risk', label: '위험성평가', href: 'rsk-list.html' },
        { v: 'hazard', label: '유해·위험요인 관리', href: 'rsk-proc.html' },
        { v: 'edu', label: '안전보건교육', href: 'edu.html' },
        { v: 'improve', label: '개선조치', href: 'rsk-imp.html' },
        { v: 'policy', label: '경영방침', href: 'menu.html?m=policy' },
        { v: 'org', label: '조직', href: 'menu.html?m=org' },
        { v: 'opinion', label: '의견청취', href: 'menu.html?m=opinion' },
        { v: 'contract', label: '도급관리', href: 'menu.html?m=contract' },
        { v: 'comply', label: '이행관리', href: 'menu.html?m=comply' },
    ];
    const linkTarget = v => LINK_TARGETS.find(t => t.v === v) || null;

    /* 프로그램 연결: 메뉴(GNB) → 뎁스(화면) 2단계 */
    const NAV_TREE = [
        { menu: '대시보드', depths: [{ label: '대시보드', href: 'index.html' }] },
        { menu: '기본정보', depths: [{ label: '평가대상 관리', href: 'base-targets.html' }, { label: '일괄 등록', href: 'base-bulk.html' }] },
        { menu: '안전보건관리체계', depths: [
            { label: '위험성평가', href: 'rsk-list.html' },
            { label: '유해·위험요인 관리', href: 'rsk-proc.html' },
            { label: '경영방침', href: 'menu.html?m=policy' },
            { label: '조직', href: 'menu.html?m=org' },
            { label: '안전보건교육', href: 'edu.html' },
            { label: '의견청취', href: 'menu.html?m=opinion' },
            { label: '도급관리', href: 'menu.html?m=contract' },
            { label: '개선조치', href: 'rsk-imp.html' },
            { label: '이행관리', href: 'menu.html?m=comply' },
        ] },
        { menu: '업무문서', depths: [
            { label: '기준문서함', href: 'docs-archive.html' },
            { label: '업무 목록', href: 'docs-preset.html' },
            { label: '이행 목록', href: 'docs-exec.html' },
        ] },
        { menu: '통계·보고', depths: [
            { label: '통계', href: 'stats.html' },
            { label: '보고서', href: 'reports.html' },
            { label: '정보센터', href: 'info-center.html' },
        ] },
        { menu: '시스템 관리', depths: [
            { label: '사용자 관리', href: 'admin-users.html' },
            { label: '알림 설정', href: 'admin-notify.html' },
            { label: '프리셋 양식 관리', href: 'admin-presets.html' },
            { label: '연계 관리', href: 'admin-integration.html' },
        ] },
    ];
    const NAV_DEFAULT = 2; /* 안전보건관리체계 */
    function findNav(href) {
        for (let mi = 0; mi < NAV_TREE.length; mi++) {
            const di = NAV_TREE[mi].depths.findIndex(d => d.href === href);
            if (di >= 0) return { mi, di };
        }
        return { mi: NAV_DEFAULT, di: 0 };
    }

    /* ── 스토어 (사용자 등록 문서) ── */
    function userDocs() { try { return JSON.parse(localStorage.getItem('dy-userdocs-v2')) || []; } catch (e) { return []; } }
    function saveUserDocs(list) { try { localStorage.setItem('dy-userdocs-v2', JSON.stringify(list)); } catch (e) {} }

    function allDocs() { return (window.DY_DOCS_V2 || []).concat(userDocs()); }
    function getDoc(id) { return allDocs().find(d => d.id === id) || null; }
    function isUser(id) { return userDocs().some(d => d.id === id); }
    function setIdOf(doc) {
        if (!doc) return null;
        if (doc.setId != null) return doc.setId;
        return (window.DY_DOC_SET_V2 || {})[doc.id] || null;
    }
    function nextId() {
        let max = 0;
        userDocs().forEach(d => { const m = /^U2-(\d+)$/.exec(d.id || ''); if (m) max = Math.max(max, +m[1]); });
        return 'U2-' + String(max + 1).padStart(4, '0');
    }

    /* ── 마법사 상태 ── */
    let S = null;
    function freshState() {
        const mk = MENU_KEYS()[0];
        const firstSet = (setsForMenu(mk)[0] || {}).id || '';
        return {
            mode: 'create', step: 0, id: nextId(), onDone: null,
            menu: mk, set: firstSet, pdca: 'P', pt: '첨부파일',
            f: { name: '', dept: '', assignee: '', cycle: '연간', applyCond: '상시', legalBasis: '', docRole: '계획', version: 'v1.0', note: '', status: '미시행' },
            formRef: formOptions()[0],
            navMenuIdx: NAV_DEFAULT, navDepthIdx: 0,
            files: [], retention: '5년',
        };
    }

    /* ── STEP 렌더 ── */
    function stepIndicator() {
        const names = ['분류', '처리유형', '상세입력', '확인'];
        return '<div class="reg-steps">' + names.map((n, i) =>
            '<div class="reg-step ' + (i === S.step ? 'on' : i < S.step ? 'done' : '') + '">' +
            '<span class="n">' + (i < S.step ? '✓' : (i + 1)) + '</span>' + n + '</div>').join('') + '</div>';
    }

    function step1() {
        const sets = setsForMenu(S.menu);
        const curSet = sets.find(s => s.id === S.set);
        return '<p class="reg-lab">법령 분류 (대메뉴) <span class="reg-req">*</span></p>' +
            '<div class="reg-tabs" id="reg-menu">' + MENU_KEYS().map(mk =>
                '<button type="button" data-k="' + mk + '" class="' + (S.menu === mk ? 'on' : '') + '">' + esc(MENUS()[mk].label) + '</button>').join('') + '</div>' +
            '<p class="reg-lab">세트 (업무 묶음)</p>' +
            '<select id="reg-set">' +
                sets.map(s => '<option value="' + s.id + '"' + (s.id === S.set ? ' selected' : '') + '>' + esc(s.id + ' · ' + s.name) + '</option>').join('') +
                '<option value=""' + (!S.set ? ' selected' : '') + '>세트 미지정</option>' +
            '</select>' +
            (curSet && curSet.pdcaFlow ? '<p class="reg-sub">이 세트의 PDCA 구성: ' + esc(curSet.pdcaFlow.split('').join('·')) + '</p>' : '') +
            '<p class="reg-lab">PDCA 단계 <span class="reg-req">*</span></p>' +
            '<div class="reg-radios" id="reg-pdca">' + PDCA.map(p =>
                '<label class="reg-radio ' + (S.pdca === p[0] ? 'on' : '') + '" data-k="' + p[0] + '"><span class="rdot"></span>' + p[1] + '</label>').join('') + '</div>';
    }

    function step2() {
        return '<p class="reg-lab">처리유형 <span class="reg-req">*</span> <span style="font-weight:400; color:var(--text-lightgray);">— 선택에 따라 다음 단계 입력 폼이 달라집니다</span></p>' +
            '<div class="reg-pcards" id="reg-pt">' + PROC_TYPES.map(p =>
                '<div class="reg-pcard ' + (S.pt === p[0] ? 'on' : '') + '" data-k="' + p[0] + '">' +
                '<span class="ic">' + p[1] + '</span><b>' + p[0] + '</b><span>' + p[2] + '</span></div>').join('') + '</div>';
    }

    /* STEP3 — 처리유형별로 완전히 다른 입력 폼 (기획 v1 §5 + 2026-06-23 수정) */
    function step3() {
        if (S.pt === '전자문서') return step3Edoc();
        if (S.pt === '프로그램') return step3Program();
        return step3Attach();
    }

    /* 담당 블록 — 3종 공통. 별도 모달 없이, 모달 안에서 트리형 조직도를 스크롤하여 담당자 선택. */
    function ownerSel() {
        return S.f.assignee
            ? '<b class="reg-owner-name">' + esc(S.f.dept || '-') + ' · ' + esc(S.f.assignee) + '</b>'
            : '<span class="reg-owner-none">선택된 담당자가 없습니다 — 아래 조직도에서 선택하세요</span>';
    }
    function ownerBlock() {
        const tree = (window.EDOC && window.EDOC.ORG_TREE) || [];
        return '<p class="reg-lab">담당자 지정 <span class="reg-req">*</span></p>' +
            '<div class="reg-owner-sel"><span id="reg-owner-cur">' + ownerSel() + '</span></div>' +
            '<div class="org-inline" id="reg-orgtree">' +
                '<div class="org-inline-search"><input type="text" id="reg-org-q" placeholder="부서·이름 검색"></div>' +
                '<div class="org-inline-body" id="reg-orgtree-body">' +
                    '<div class="org-tree-root">담양군청</div>' +
                    tree.map((d, di) =>
                        '<div class="otr-dept" data-dept="' + esc(d.dept) + '">' +
                        '<button type="button" class="otr-deptbtn" data-di="' + di + '"><span class="otr-arrow">▸</span> ' + esc(d.dept) + ' <span class="otr-count">' + d.members.length + '명</span></button>' +
                        '<div class="otr-members">' +
                        d.members.map((m, mi) => '<button type="button" class="otr-member' + (S.f.assignee === m[1] && S.f.dept === d.dept ? ' on' : '') + '" data-di="' + di + '" data-mi="' + mi + '"><span class="otr-role">' + esc(m[0]) + '</span><span class="otr-name">' + esc(m[1]) + '</span></button>').join('') +
                        '</div></div>').join('') +
                '</div>' +
            '</div>';
    }

    /* 첨부파일 목록 (추가/삭제 가능) */
    function fileListHtml() {
        if (!S.files || !S.files.length) return '<p class="reg-sub" style="margin-top:10px;">첨부된 파일이 없습니다.</p>';
        return '<div class="attach-list" style="margin-top:10px;"><div class="attach-list-head">첨부파일 목록 (' + S.files.length + '건)</div>' +
            '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>파일명</th><th>설명</th><th>관리</th></tr></thead><tbody>' +
            S.files.map((f, i) => '<tr><td>' + esc(f.name) + '</td><td>' + esc(f.desc || '') + '</td>' +
                '<td><button type="button" class="btn btn-sm btn-outline" onclick="DYREG._delFile(' + i + ')">삭제</button></td></tr>').join('') +
            '</tbody></table></div></div>';
    }
    function addFile() {
        const n = document.getElementById('reg-fname'), d = document.getElementById('reg-fdesc');
        const name = ((n && n.value) || '').trim();
        if (!name) { V().toast('파일명을 입력하세요'); return; }
        S.files.push({ name: name, desc: ((d && d.value) || '').trim(), date: today() });
        if (n) n.value = ''; if (d) d.value = '';
        const list = document.getElementById('reg-filelist'); if (list) list.innerHTML = fileListHtml();
        V().toast('파일이 추가되었습니다 — 총 ' + S.files.length + '건');
    }
    function delFile(i) {
        S.files.splice(i, 1);
        const list = document.getElementById('reg-filelist'); if (list) list.innerHTML = fileListHtml();
    }

    /* 첨부파일: 문서명 + 담당(조직도) + 주기 + 법적 근거 + 파일(추가·목록) */
    function step3Attach() {
        return '<p class="reg-lab">문서명 <span class="reg-req">*</span></p>' +
            '<input type="text" data-k="name" value="' + esc(S.f.name) + '" placeholder="문서명을 입력하세요">' +
            ownerBlock() +
            '<p class="reg-lab">주기</p>' +
            '<select data-k="cycle">' + CYCLES.map(c => '<option' + (c === S.f.cycle ? ' selected' : '') + '>' + c + '</option>').join('') + '</select>' +
            '<p class="reg-lab">법적 근거</p>' +
            '<input type="text" data-k="legalBasis" value="' + esc(S.f.legalBasis) + '" placeholder="예: 중처법 시행령 제4조제1호">' +
            '<div class="reg-branch"><p class="bh">파일 첨부</p>' +
                '<div class="upload-drop" style="padding:14px;" onclick="DYV2.toast(\'파일 선택 (프로토타입) — 아래에 파일명·설명을 입력하고 [파일 추가]를 누르세요\')">파일을 끌어다 놓거나 클릭하여 선택</div>' +
                fileHintHtml() +
                '<div class="reg-grid2" style="margin-top:10px;">' +
                    '<div><input type="text" id="reg-fname" placeholder="파일명 (예: 경영방침_2026.pdf)"></div>' +
                    '<div><input type="text" id="reg-fdesc" placeholder="파일 설명 (선택)"></div>' +
                '</div>' +
                '<button type="button" class="btn btn-sm btn-outline" style="margin-top:8px;" onclick="DYREG._addFile()">＋ 파일 추가</button>' +
                '<div id="reg-filelist">' + fileListHtml() + '</div>' +
                '<p class="reg-lab">보존 연한</p><select id="reg-reten">' + ['3년', '5년', '10년', '영구'].map(o =>
                    '<option' + (o === S.retention ? ' selected' : '') + '>' + o + '</option>').join('') + '</select>' +
            '</div>';
    }

    /* 전자문서: 문서명 + 담당 + 연계 양식 (나머지 항목은 전자문서 양식 안에서 입력) */
    function step3Edoc() {
        const opts = formOptions();
        const curIdx = Math.max(0, opts.findIndex(o => S.formRef && o.kind === S.formRef.kind && o.formId === S.formRef.formId && o.label === S.formRef.label));
        const T = window.EDOC_T || { FORMS: {} };
        const fdef = T.FORMS[(S.formRef || opts[0]).formId];
        const preview = fdef ? fdef.fields.map(x => x.label).join(' · ') : '';
        return '<p class="reg-lab">문서명 <span class="reg-req">*</span></p>' +
            '<input type="text" data-k="name" value="' + esc(S.f.name) + '" placeholder="문서명을 입력하세요">' +
            ownerBlock() +
            '<div class="reg-branch"><p class="bh">전자문서 — 빌더 양식 연계 <span class="reg-req">*</span></p>' +
                '<p class="reg-lab">연계 양식</p>' +
                '<select id="reg-form">' + opts.map((o, i) =>
                    '<option value="' + i + '"' + (i === curIdx ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') + '</select>' +
                '<p class="reg-sub" id="reg-form-preview"><b>미리보기 필드</b> — ' + esc(preview) + '</p>' +
                '<a class="reg-link" href="admin-presets.html" target="_blank" rel="noopener">＋ 새 양식 만들기 (전자문서 빌더로 이동) ↗</a>' +
            '</div>' +
            '<p class="reg-sub" style="margin-top:10px;">주기·법적 근거 등 나머지 항목은 선택한 전자문서 양식 안에서 입력합니다.</p>';
    }

    /* 프로그램: 담당 + 어떤 메뉴의 어떤 뎁스로 넘길지 선택 (문서명은 화면 이름으로 자동) */
    function step3Program() {
        const depths = NAV_TREE[S.navMenuIdx].depths;
        return '<p class="reg-lab">연결 메뉴 <span class="reg-req">*</span></p>' +
            '<select id="reg-navmenu">' + NAV_TREE.map((n, i) =>
                '<option value="' + i + '"' + (i === S.navMenuIdx ? ' selected' : '') + '>' + esc(n.menu) + '</option>').join('') + '</select>' +
            '<p class="reg-lab">연결 뎁스(화면) <span class="reg-req">*</span></p>' +
            '<select id="reg-navdepth">' + depths.map((d, i) =>
                '<option value="' + i + '"' + (i === S.navDepthIdx ? ' selected' : '') + '>' + esc(d.label) + '</option>').join('') + '</select>' +
            ownerBlock() +
            '<p class="reg-sub" style="margin-top:10px;">선택한 화면으로 이동하는 버튼이 문서 상세에 표시됩니다. 문서명은 선택한 화면 이름으로 자동 설정됩니다.</p>';
    }

    /* ── 인라인 조직도 트리 (모달 내 스크롤 선택 — 별도 모달 없음, EDOC.ORG_TREE 재사용) ── */
    function openDept(deptEl) {
        if (!deptEl) return;
        const m = deptEl.querySelector('.otr-members'); if (m) m.style.display = 'block';
        const ar = deptEl.querySelector('.otr-arrow'); if (ar) ar.textContent = '▾';
    }
    function wireOwnerTree(root) {
        const box = root.querySelector('#reg-orgtree');
        if (!box) return;
        const tree = (window.EDOC && window.EDOC.ORG_TREE) || [];
        const body = box.querySelector('#reg-orgtree-body');

        /* 현재 선택된 부서(없으면 첫 부서)를 펼친 상태로 시작 */
        const cur = body.querySelector('.otr-member.on');
        openDept(cur ? cur.closest('.otr-dept') : body.querySelector('.otr-dept'));

        box.addEventListener('click', e => {
            const db = e.target.closest('.otr-deptbtn');
            if (db) {
                const m = db.nextElementSibling; const open = m.style.display === 'block';
                m.style.display = open ? 'none' : 'block';
                const ar = db.querySelector('.otr-arrow'); if (ar) ar.textContent = open ? '▸' : '▾';
                return;
            }
            const mb = e.target.closest('.otr-member');
            if (mb) {
                const d = tree[+mb.dataset.di], mem = d.members[+mb.dataset.mi];
                S.f.dept = d.dept; S.f.assignee = mem[1];
                body.querySelectorAll('.otr-member').forEach(x => x.classList.toggle('on', x === mb));
                const disp = root.querySelector('#reg-owner-cur'); if (disp) disp.innerHTML = ownerSel();
                V().toast('담당자 지정: ' + d.dept + ' ' + mem[1]);
            }
        });

        const q = box.querySelector('#reg-org-q');
        if (q) q.addEventListener('input', function () {
            const v = this.value.trim();
            body.querySelectorAll('.otr-dept').forEach(dept => {
                const dn = dept.getAttribute('data-dept') || '';
                let any = false;
                dept.querySelectorAll('.otr-member').forEach(mb => {
                    const show = !v || dn.indexOf(v) !== -1 || mb.textContent.indexOf(v) !== -1;
                    mb.style.display = show ? '' : 'none';
                    if (show) any = true;
                });
                dept.style.display = (!v || any) ? '' : 'none';
                if (v && any) openDept(dept);
            });
        });
    }

    function progNav() {
        const m = NAV_TREE[S.navMenuIdx] || NAV_TREE[0];
        const d = m.depths[S.navDepthIdx] || m.depths[0];
        return { menu: m.menu, label: d.label, href: d.href };
    }
    function autoName() { return S.pt === '프로그램' ? progNav().label : S.f.name; }

    function step4() {
        const conn = S.pt === '전자문서' ? formLabel(S.formRef)
            : S.pt === '프로그램' ? (progNav().menu + ' › ' + progNav().label)
            : (S.files[0] && S.files[0].name ? S.files[0].name : '첨부파일');
        const setName = S.set ? ((SETS().find(x => x.id === S.set) || {}).name ? S.set + ' · ' + SETS().find(x => x.id === S.set).name : S.set) : '세트 미지정';
        const rows = [
            ['법령 분류', (MENUS()[S.menu] || {}).label || S.menu],
            ['세트', setName],
            ['PDCA 단계', (PDCA.find(p => p[0] === S.pdca) || [])[1] || S.pdca],
            ['처리유형', S.pt],
            ['문서명', autoName() || '(미입력)'],
            ['연계 대상', conn],
        ];
        if (S.pt === '첨부파일') rows.push(['담당', (S.f.assignee || '-') + ' · ' + (S.f.dept || '-')]);
        return '<p class="reg-lab">등록 내용 확인</p>' +
            rows.map(r => '<div class="reg-sum-row"><span>' + esc(r[0]) + '</span><span>' + esc(r[1]) + '</span></div>').join('') +
            '<p class="reg-sub" style="margin-top:14px;">저장 시 목록의 해당 위치에 즉시 추가되며, 새로고침 후에도 유지됩니다 (프로토타입 — localStorage).</p>';
    }

    const STEPS = [step1, step2, step3, step4];

    /* ── 현재 STEP 입력값 캡처 ── */
    function capture() {
        const root = document.getElementById('reg-body');
        if (!root) return;
        if (S.step === 0) {
            const set = root.querySelector('#reg-set'); if (set) S.set = set.value;
        } else if (S.step === 2) {
            root.querySelectorAll('[data-k]').forEach(el => { S.f[el.getAttribute('data-k')] = el.value; });
            if (S.pt === '첨부파일') {
                /* 파일은 [파일 추가] 버튼으로 S.files에 누적 — 단일 입력으로 덮어쓰지 않음 */
                const r = root.querySelector('#reg-reten'); if (r) S.retention = r.value;
            } else if (S.pt === '전자문서') {
                const sel = root.querySelector('#reg-form'); if (sel) S.formRef = formOptions()[+sel.value] || S.formRef;
            } else if (S.pt === '프로그램') {
                const mm = root.querySelector('#reg-navmenu'); if (mm) S.navMenuIdx = +mm.value;
                const dd = root.querySelector('#reg-navdepth'); if (dd) S.navDepthIdx = +dd.value;
            }
        }
    }

    /* ── 유효성 검사 ── */
    function validate(step) {
        if (step === 0) {
            if (!S.menu) { V().toast('법령 분류(대메뉴)를 선택하세요'); return false; }
            if (!S.pdca) { V().toast('PDCA 단계를 선택하세요'); return false; }
        }
        if (step === 1 && !S.pt) { V().toast('처리유형을 선택하세요'); return false; }
        if (step === 2) {
            /* 담당자는 3종 공통 필수 */
            if (!S.f.assignee || !S.f.assignee.trim()) { V().toast('[담당자 지정]에서 담당자를 지정하세요'); return false; }
            if (S.pt === '첨부파일') {
                if (!S.f.name.trim()) { V().toast('문서명을 입력하세요'); return false; }
            } else if (S.pt === '전자문서') {
                if (!S.f.name.trim()) { V().toast('문서명을 입력하세요'); return false; }
                if (!S.formRef) { V().toast('연계할 전자문서 양식을 선택하세요'); return false; }
            }
            /* 프로그램: 문서명은 화면 이름으로 자동, 메뉴·뎁스는 기본값 보장 */
        }
        return true;
    }

    /* ── 모델 빌드 · 저장 ── */
    function buildModel() {
        const isAttach = S.pt === '첨부파일', isEdoc = S.pt === '전자문서', isProg = S.pt === '프로그램';
        const nav = isProg ? progNav() : null;
        return {
            id: S.id, origin: 'user',
            name: (isProg ? nav.label : S.f.name.trim()),
            menuKey: S.menu, daemenu: (MENUS()[S.menu] || {}).label || S.menu,
            setId: S.set || null,
            pdca: S.pdca, processType: S.pt,
            procClass: isProg ? '프로그램형' : isEdoc ? '전자문서형' : '단순 첨부형',
            docRole: S.f.docRole || '-', subType: '-',
            theme: '', legalBasis: isAttach ? (S.f.legalBasis || '') : '',
            cycle: isAttach ? (S.f.cycle || '') : '', applyCond: S.f.applyCond || '',
            pre: '', post: '', needReview: 'N', needReason: '', confidence: '높음',
            assignee: (S.f.assignee || '').trim(), dept: S.f.dept || '',
            status: S.f.status || '미시행', updated: today(), version: S.f.version || 'v1.0',
            note: S.f.note || '',
            formRef: isEdoc ? S.formRef : null,
            linkHref: isProg ? nav.href : '', linkLabel: isProg ? nav.label : '', linkMenu: isProg ? nav.menu : '',
            files: isAttach ? S.files : null,
            retention: isAttach ? S.retention : '',
        };
    }
    function persist() {
        const m = buildModel();
        const list = userDocs();
        const i = list.findIndex(x => x.id === m.id);
        if (i >= 0) list[i] = m; else list.push(m);
        saveUserDocs(list);
        return m;
    }

    /* ── 모달 셸 + 네비게이션 ── */
    function renderStep() {
        document.getElementById('reg-steps-wrap').innerHTML = stepIndicator();
        document.getElementById('reg-body').innerHTML = STEPS[S.step]();
        const prev = document.getElementById('reg-prev');
        const next = document.getElementById('reg-next');
        prev.style.visibility = S.step === 0 ? 'hidden' : 'visible';
        next.textContent = S.step === STEPS.length - 1 ? (S.mode === 'edit' ? '저장' : '등록 완료') : '다음 →';
        wireStep();
    }
    function wireStep() {
        const root = document.getElementById('reg-body');
        if (S.step === 0) {
            root.querySelector('#reg-menu').addEventListener('click', e => {
                const b = e.target.closest('button'); if (!b) return;
                S.menu = b.dataset.k;
                S.set = (setsForMenu(S.menu)[0] || {}).id || '';
                renderStep();
            });
            root.querySelector('#reg-pdca').addEventListener('click', e => {
                const l = e.target.closest('.reg-radio'); if (!l) return;
                S.pdca = l.dataset.k;
                root.querySelectorAll('#reg-pdca .reg-radio').forEach(x => x.classList.toggle('on', x === l));
            });
            root.querySelector('#reg-set').addEventListener('change', function () { S.set = this.value; });
        } else if (S.step === 1) {
            root.querySelector('#reg-pt').addEventListener('click', e => {
                const c = e.target.closest('.reg-pcard'); if (!c) return;
                S.pt = c.dataset.k;
                root.querySelectorAll('#reg-pt .reg-pcard').forEach(x => x.classList.toggle('on', x === c));
            });
        } else if (S.step === 2) {
            wireOwnerTree(root);
            const fs = root.querySelector('#reg-form');
            if (fs) fs.addEventListener('change', function () {
                S.formRef = formOptions()[+this.value];
                const T = window.EDOC_T || { FORMS: {} };
                const fdef = T.FORMS[S.formRef.formId];
                const pv = root.querySelector('#reg-form-preview');
                if (pv && fdef) pv.innerHTML = '<b>미리보기 필드</b> — ' + esc(fdef.fields.map(x => x.label).join(' · '));
            });
            const nm = root.querySelector('#reg-navmenu');
            if (nm) nm.addEventListener('change', function () { S.navMenuIdx = +this.value; S.navDepthIdx = 0; renderStep(); });
            const nd = root.querySelector('#reg-navdepth');
            if (nd) nd.addEventListener('change', function () { S.navDepthIdx = +this.value; });
        }
    }

    function openModalShell(title) {
        V().openModal(esc(title),
            '<div id="reg-steps-wrap"></div><div id="reg-body"></div>',
            (S.mode === 'edit' ? '<button class="btn btn-outline" id="reg-del" style="margin-right:auto; color:var(--status-danger-fg); border-color:var(--status-danger-border,#fecaca);">삭제</button>' : '') +
            '<button class="btn btn-secondary" id="reg-prev">← 이전</button>' +
            '<button class="btn btn-primary" id="reg-next">다음 →</button>');

        document.getElementById('reg-next').addEventListener('click', () => {
            capture();
            if (!validate(S.step)) return;
            if (S.step < STEPS.length - 1) { S.step++; renderStep(); }
            else {
                const m = persist();
                V().closeModal();
                V().toast(S.mode === 'edit' ? '수정되었습니다' : '등록되었습니다 — ' + m.id);
                if (S.onDone) S.onDone(m);
            }
        });
        document.getElementById('reg-prev').addEventListener('click', () => {
            capture();
            if (S.step > 0) { S.step--; renderStep(); }
        });
        const del = document.getElementById('reg-del');
        if (del) del.addEventListener('click', () => { const id = S.id, cb = S.onDone; V().closeModal(); remove(id, { onDone: cb }); });

        renderStep();
    }

    /* ── 공개 API ── */
    function openCreate(opts) {
        opts = opts || {};
        S = freshState();
        S.onDone = opts.onDone || null;
        if (opts.menuKey && MENUS()[opts.menuKey]) {
            S.menu = opts.menuKey;
            S.set = (setsForMenu(S.menu)[0] || {}).id || '';
        }
        openModalShell('업무 등록');
    }
    function openEdit(id, opts) {
        opts = opts || {};
        const d = getDoc(id);
        if (!d) { V().toast('문서를 찾을 수 없습니다'); return; }
        if (!isUser(id)) { V().toast('기본 제공 문서는 수정할 수 없습니다 (사용자 등록 문서만 수정 가능)'); return; }
        S = freshState();
        S.mode = 'edit'; S.id = id; S.onDone = opts.onDone || null;
        S.menu = d.menuKey; S.set = d.setId || ''; S.pdca = d.pdca || 'P'; S.pt = d.processType || '첨부파일';
        S.f = {
            name: d.name || '', dept: d.dept || DEPTS[0], assignee: d.assignee || '', cycle: d.cycle || '연간',
            applyCond: d.applyCond || '상시', legalBasis: d.legalBasis || '', docRole: d.docRole || '계획',
            version: d.version || 'v1.0', note: d.note || '', status: d.status || '미시행',
        };
        if (d.formRef) S.formRef = d.formRef;
        if (d.linkHref) { const n = findNav(d.linkHref); S.navMenuIdx = n.mi; S.navDepthIdx = n.di; }
        S.files = (d.files && d.files.length) ? d.files.slice() : [];
        S.retention = d.retention || '5년';
        openModalShell('업무 수정');
    }
    function remove(id, opts) {
        opts = opts || {};
        const d = getDoc(id);
        if (!d) return;
        if (!isUser(id)) { V().toast('기본 제공 문서는 삭제할 수 없습니다'); return; }
        V().openModal('삭제 확인',
            '<p style="font-size:13px; line-height:1.6;">이 업무문서를 삭제하시겠습니까?<br><b>' + esc(d.name) + '</b> <span style="color:var(--text-gray);">(' + esc(id) + ')</span></p>' +
            '<p style="font-size:12px; color:var(--text-gray); margin-top:8px;">삭제하면 목록·상세에서 제거됩니다. (되돌릴 수 없음)</p>',
            '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" id="reg-del-yes" style="background:var(--status-danger-fg); border-color:var(--status-danger-fg);">삭제</button>');
        document.getElementById('reg-del-yes').addEventListener('click', () => {
            saveUserDocs(userDocs().filter(x => x.id !== id));
            V().closeModal();
            V().toast('삭제되었습니다');
            if (opts.onDone) opts.onDone(null);
        });
    }

    window.DYREG = {
        allDocs, getDoc, isUser, setIdOf,
        openCreate, openEdit, remove,
        LINK_TARGETS, linkTarget, formLabel,
        _addFile: addFile, _delFile: delFile,
    };
})();
