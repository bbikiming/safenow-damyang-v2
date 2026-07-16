/* =========================================================================
 * 담양군 중대재해예방 통합관리시스템 v2 — 공통 헬퍼
 * 문서 3축 모델(data.js) 조회·집계 + 칩/뱃지/모달 렌더 유틸.
 * ========================================================================= */
(function () {
    'use strict';

    /* 안전보건관리체계 9개 대메뉴 메타 (재구축 프롬프트 §3 — 명칭 문자열 고정)
     * href — 대메뉴 진입 화면. 위험성평가·유해·위험요인 관리는 기존 프로토타입 UX 전용 화면 직결. */
    const MENUS = {
        policy:   { label: '경영방침',           sfr: 'SFR-005',          dept: '재난안전과 중대재해팀', href: 'menu.html?m=policy' },
        org:      { label: '조직',               sfr: 'SFR-006·009·010',  dept: '행정과·재난안전과',     href: 'menu.html?m=org' },
        risk:     { label: '위험성평가',         sfr: 'SFR-007',          dept: '재난안전과 중대재해팀', href: 'rsk-list.html' },
        hazard:   { label: '작업공정 관리',      sfr: 'SFR-007·019',      dept: '재난안전과·환경과',     href: 'rsk-proc.html' },
        edu:      { label: '안전보건교육',       sfr: 'SFR-004·010',      dept: '행정과(교육담당)',      href: 'edu.html' },
        opinion:  { label: '의견청취',           sfr: 'SFR-011',          dept: '재난안전과 중대재해팀', href: 'menu.html?m=opinion' },
        contract: { label: '도급관리',           sfr: 'SFR-013',          dept: '회계과·각 발주부서',    href: 'menu.html?m=contract' },
        improve:  { label: '개선조치',           sfr: 'SFR-003',          dept: '재난안전과 중대재해팀', href: 'rsk-imp.html' },
        comply:   { label: '이행관리',           sfr: 'SFR-008·014',      dept: '재난안전과·기획예산실', href: 'menu.html?m=comply' },
    };

    /* =========================================================================
     * 조직도 — 단일 출처 (DYV2.ORG)
     *   전 화면의 조직도(경영방침 점검자·의견청취 위원·인력평가 평가자·권한 관리·
     *   조직 요약·예산 기관 등)가 바라보는 유일한 캐노니컬 데이터.
     *   화면별 조직도는 이 트리의 파생 뷰(orgFlat 등)만 사용하고 자체 데이터를 만들지 않는다.
     *   노드 { id, name, type('root'|'post'|'bureau'|'dept'|'team'|'office'|'town'),
     *          members:[{uid, name, role, team?}], children:[...] }
     *   기존 권한 시드가 uid 를 참조하므로 uid 는 절대 변경 금지.
     * ========================================================================= */
    const ORG = {
        id: 'gov', name: '담양군청', type: 'root', members: [], children: [
            { id: 'n_mayor', name: '군수', type: 'post', members: [{ uid: 'u_mayor', name: '김담양', role: '군수' }], children: [
                { id: 'n_vice', name: '부군수', type: 'post', members: [{ uid: 'u_vice', name: '이부군', role: '부군수' }], children: [
                    { id: 'plan', name: '기획예산실', type: 'dept', members: [
                        { uid: 'u_plan1', name: '서기획', role: '기획예산실장' },
                        { uid: 'u_plan2', name: '한열람', role: '예산 담당 주무관' },
                    ], children: [] },
                    { id: 'bureau_adm', name: '행정복지국', type: 'bureau', members: [{ uid: 'u_badm', name: '박행정', role: '행정복지국장' }], children: [
                        { id: 'safety', name: '재난안전과', type: 'dept', members: [
                            { uid: 'u_safe1', name: '홍길동', role: '재난안전과장' },
                            { uid: 'u_safe2', name: '박담당', role: '안전관리담당' },
                        ], children: [
                            { id: 'jjt', name: '중대재해팀', type: 'team', members: [
                                { uid: 'u_jjt1', name: '김중대', role: '중대재해팀장' },
                                { uid: 'u_jjt2', name: '박안전', role: '안전관리 주무관' },
                                { uid: 'u_jjt3', name: '김안전', role: '안전관리자' },
                            ], children: [] },
                        ] },
                        { id: 'acct', name: '회계과', type: 'dept', members: [
                            { uid: 'u_acct1', name: '조회계', role: '회계과장' },
                            { uid: 'u_acct2', name: '최회계', role: '계약·도급 담당 주무관' },
                        ], children: [] },
                        { id: 'env', name: '환경과', type: 'dept', members: [
                            { uid: 'u_env1', name: '차환경', role: '환경과장' },
                            { uid: 'u_env2', name: '정환경', role: '유해·위험요인 담당 주무관' },
                            { uid: 'u_env3', name: '최보건', role: '보건관리자' },
                            { uid: 'u_env4', name: '김지도', role: '주무관', team: '환경지도팀' },
                            { uid: 'u_env5', name: '정수빈', role: '주무관', team: '자원순환팀' },
                        ], children: [] },
                        { id: 'culture', name: '문화체육과', type: 'dept', members: [
                            { uid: 'u_cul1', name: '한지훈', role: '주무관', team: '체육시설팀' },
                            { uid: 'u_cul2', name: '오세영', role: '주무관', team: '문화시설팀' },
                        ], children: [] },
                        { id: 'finance', name: '재무과', type: 'dept', members: [
                            { uid: 'u_fin1', name: '최재무', role: '주무관', team: '회계팀' },
                            { uid: 'u_fin2', name: '강세무', role: '주무관', team: '세정팀' },
                        ], children: [] },
                        { id: 'health', name: '보건소', type: 'dept', members: [
                            { uid: 'u_hlth1', name: '강보건', role: '보건소장' },
                            { uid: 'u_hlth2', name: '이보건', role: '보건행정 주무관' },
                            { uid: 'u_hlth3', name: '윤담당', role: '보건담당' },
                            { uid: 'u_hlth4', name: '백지영', role: '주무관', team: '보건행정과' },
                            { uid: 'u_hlth5', name: '곽문석', role: '주무관', team: '건강증진과' },
                        ], children: [] },
                    ] },
                    { id: 'bureau_ind', name: '산업건설국', type: 'bureau', members: [{ uid: 'u_bind', name: '정산업', role: '산업건설국장' }], children: [
                        { id: 'construct', name: '건설과', type: 'dept', members: [
                            { uid: 'u_con1', name: '이건설', role: '건설과장' },
                            { uid: 'u_con2', name: '박현장', role: '현장안전 담당 주무관' },
                            { uid: 'u_con3', name: '김도현', role: '주무관', team: '안전관리팀' },
                            { uid: 'u_con4', name: '박서준', role: '주무관', team: '시설관리팀' },
                            { uid: 'u_con5', name: '이준호', role: '주무관', team: '도로관리팀' },
                        ], children: [] },
                        { id: 'facility', name: '공공시설사업소', type: 'office', members: [
                            { uid: 'u_fac1', name: '임시설', role: '공공시설사업소장' },
                            { uid: 'u_fac2', name: '한담당', role: '시설안전 담당' },
                            { uid: 'u_fac3', name: '한운영', role: '주무관', team: '시설운영팀' },
                            { uid: 'u_fac4', name: '민설비', role: '주무관', team: '환경시설팀' },
                        ], children: [] },
                        { id: 'water', name: '물순환사업소', type: 'office', members: [
                            { uid: 'u_wat1', name: '오순환', role: '물순환사업소장' },
                            { uid: 'u_wat2', name: '서담당', role: '시설 담당' },
                            { uid: 'u_wat3', name: '하정수', role: '주무관', team: '정수팀' },
                            { uid: 'u_wat4', name: '오수질', role: '주무관', team: '수질관리팀' },
                        ], children: [] },
                    ] },
                    { id: 'town_damyang', name: '담양읍', type: 'town', members: [
                        { uid: 'u_twn1', name: '노읍장', role: '담양읍장' },
                        { uid: 'u_twn2', name: '배주민', role: '주민복지 담당' },
                    ], children: [] },
                ] },
            ] },
        ],
    };

    function orgWalk(fn, node) { node = node || ORG; fn(node); (node.children || []).forEach(c => orgWalk(fn, c)); }
    function orgNode(id) { let found = null; orgWalk(n => { if (n.id === id) found = n; }); return found; }
    /* 노드 하위 구성원 수 (includeSub=true 면 하위 부서까지 포함) */
    function orgCount(id, includeSub) {
        const n = orgNode(id); if (!n) return 0; let c = 0;
        (function w(nd, deep) {
            c += (nd.members || []).length;
            if (deep) (nd.children || []).forEach(x => w(x, true));
            else (nd.children || []).forEach(x => { if (x.type === 'team') w(x, false); });
        })(n, !!includeSub);
        return c;
    }
    function orgTotal() { let c = 0; orgWalk(n => { c += (n.members || []).length; }); return c; }
    const isDeptLike = n => n.type === 'dept' || n.type === 'office' || n.type === 'town';
    /* 부서형 노드(dept·office·town) 이름 목록 — 사업장 마스터·작업환경측정 등 부서 선택 공용 파생 */
    function deptNames() { const out = []; orgWalk(n => { if (isDeptLike(n)) out.push(n.name); }); return out; }
    /* 부서형 노드 [{id, name, count}] — deptId 로 저장하는 도메인(위험성평가·안전보건교육)의 부서 선택 공용 파생.
     * orgFlat() 은 EDOC 호환을 위해 id 를 버리고 부서명만 투영하므로 id 기준 화면에서는 이 헬퍼를 쓴다. */
    function orgDepts() {
        const out = [];
        orgWalk(n => { if (isDeptLike(n)) out.push({ id: n.id, name: n.name, count: orgCount(n.id) }); });
        return out;
    }
    /* EDOC 호환 평면 투영: [{dept, members:[[role,name],...]}]
     *   부서형 노드(dept·office·town) 단위 그룹핑, 팀 노드 구성원은 소속 과에 합산.
     *   기본적으로 지휘부(post·bureau 직속: 군수·부군수·국장)는 제외. */
    function orgFlat(opts) {
        opts = opts || {};
        const out = [];
        const isDeptLike = n => n.type === 'dept' || n.type === 'office' || n.type === 'town';
        function collect(n, acc) {
            (n.members || []).forEach(m => acc.push([m.role, m.name]));
            (n.children || []).forEach(c => { if (c.type === 'team') collect(c, acc); });
        }
        (function walk(n) {
            if (isDeptLike(n)) {
                const acc = []; collect(n, acc);
                out.push({ dept: n.name, members: acc });
                (n.children || []).forEach(c => { if (c.type !== 'team') walk(c); });
            } else {
                if (opts.includeLeadership && (n.type === 'post' || n.type === 'bureau') && (n.members || []).length) {
                    out.push({ dept: n.name, members: n.members.map(m => [m.role, m.name]) });
                }
                (n.children || []).forEach(walk);
            }
        })(ORG);
        return out;
    }

    const docs = () => window.DY_DOCS || [];

    /* =========================================================================
     * 브레이크포인트 — 단일 출처 (DYV2.BP)
     *   CSS 토큰 --bp-*(css/style.css :root)와 같은 값. JS 의 matchMedia 는
     *   1023 같은 리터럴을 쓰지 말고 이 상수를 참조한다.
     *   DYV2.below(k) → 해당 단계 "미만" 여부(예: below('lg') = 1023px 이하).
     * ========================================================================= */
    const BP = { xl: 1280, lg: 1024, md: 768, sm: 560 };
    function below(key) {
        return window.matchMedia('(max-width: ' + (BP[key] - 1) + 'px)').matches;
    }

    /* =========================================================================
     * 상태 라벨 → tone 매핑 — 단일 출처 (DYV2.STATUS_TONE)
     *   전 화면의 상태 배지는 이 표만 바라본다. 새 상태 어휘가 필요하면 여기에
     *   추가하고, 화면에서 색(tone)을 직접 고르지 않는다.
     *   tone 6종은 style.css --status-{tone}-bg/border/fg 페어와 1:1 대응.
     * ========================================================================= */
    const STATUS_TONE = {
        '완료': 'success', '적합': 'success', '승인': 'success', '이행': 'success',
        '진행': 'info', '진행중': 'info', '검토중': 'info', '접수': 'info',
        '미착수': 'neutral', '미완료': 'neutral', '해당없음': 'neutral', '대기': 'neutral',
        '지연': 'warning', '보완필요': 'warning', '보완 필요': 'warning', '주의': 'warning',
        '기한초과': 'danger', '기한 초과': 'danger', '부적합': 'danger', '반려': 'danger',
        '수시': 'purple', '임시저장': 'purple',
    };
    /* 매핑에 없는 라벨은 neutral 로 수렴(색을 임의로 만들지 않는다). */
    function toneOf(label) { return STATUS_TONE[String(label || '').trim()] || 'neutral'; }

    /* ── 첨부파일 업로드 제약 (지원 형식·용량·개수) — 단일 출처 ── */
    const FILE_LIMITS = {
        formats: 'HWP · HWPX · PDF · DOC(X) · XLS(X) · PPT(X) · JPG · PNG · ZIP',
        maxMB: 20, maxCount: 10,
    };
    /* 업로드 영역 하단에 붙이는 안내 문구 HTML */
    function fileHint() {
        return '<p class="file-hint"><b>지원 형식</b> ' + FILE_LIMITS.formats +
            ' <span class="fh-sep">·</span> <b>파일당 최대</b> ' + FILE_LIMITS.maxMB + 'MB' +
            ' <span class="fh-sep">·</span> <b>최대</b> ' + FILE_LIMITS.maxCount + '개</p>';
    }

    /* ── 접근성 업로드 드롭존 — 단일 출처 (fileHint 와 동일한 §2 원칙) ──
     * .upload-drop 은 cursor:pointer·hover 강조로 "클릭하여 업로드" 어포던스를 약속하므로,
     * 마우스뿐 아니라 키보드 활성화까지 반드시 배선한다(WCAG 2.1.1/4.1.2). 새 업로드 UI 는
     * 드롭존을 직접 쓰지 말고 이 헬퍼를 재사용한다.
     *   labelHtml : 드롭존 내부 표시(HTML 허용).
     *   onAct     : 활성화 시 실행할 인라인 JS 표현식(기존 onclick 관례대로 작은따옴표 문자열).
     *               생략 시 프로토타입 토스트. 실제 등록/제출은 모달 하단 [등록]·[제출] 버튼이 담당.
     *   opts.hint : true → fileHint() 를 함께 렌더하고 aria-describedby 로 제약 문구를 연결.
     *   opts.style: 드롭존에 덧붙일 인라인 style 문자열. */
    let _dropSeq = 0;
    function dropKey(e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();          /* Space 스크롤 방지 + 클릭으로 활성화 경로 단일화 */
            e.currentTarget.click();
        }
    }
    function uploadDrop(labelHtml, onAct, opts) {
        opts = opts || {};
        const act = onAct || "DYV2.toast('파일 선택 (프로토타입)')";
        const style = opts.style ? ' style="' + opts.style + '"' : '';
        let desc = '', hint = '';
        if (opts.hint) {
            const hid = 'updrop-hint-' + (++_dropSeq);
            desc = ' aria-describedby="' + hid + '"';
            hint = fileHint().replace('class="file-hint"', 'class="file-hint" id="' + hid + '"');
        }
        return '<div class="upload-drop" role="button" tabindex="0"' + style +
            ' onclick="' + act + '" onkeydown="DYV2.dropKey(event)"' + desc + '>' +
            labelHtml + '</div>' + hint;
    }

    function byMenu(key) { return docs().filter(d => d.menuKey === key); }

    /* 이행률: 대메뉴 내 이행+프로그램 문서 중 status=완료 비율 */
    function complianceRate(key) {
        const target = byMenu(key).filter(d => d.workType !== '첨부');
        if (!target.length) return 0;
        return Math.round(target.filter(d => d.status === '완료').length / target.length * 100);
    }

    /* 시기도래: due가 있고 미완료인 문서 수 (대메뉴 단위) */
    function dueCount(key) {
        return byMenu(key).filter(d => d.due && d.status !== '완료').length;
    }

    /* ── 렌더 유틸 ── */
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

    function statusChip(st) {
        const cls = st === '완료' ? 'st-done' : st === '진행' ? 'st-doing' : 'st-todo';
        return '<span class="chip-mini ' + cls + '">' + esc(st) + '</span>';
    }
    function workTypeChip(wt) {
        const cls = wt === '프로그램' ? 'wt-program' : wt === '이행' ? 'wt-elec' : 'wt-attach';
        return '<span class="chip-mini ' + cls + '">' + esc(wt) + '</span>';
    }
    function processTypeChip(pt) {
        const cls = pt === '프로그램' ? 'wt-program' : pt === '전자문서' ? 'wt-elec' : 'wt-attach';
        return '<span class="chip-mini ' + cls + '">' + esc(pt) + '</span>';
    }
    function pdcaChip(p) {
        if (!p) return '';
        return '<span class="chip-mini pdca">' + esc(p) + '</span>';
    }
    function lawChip(law) {
        return '<span class="chip-mini wt">' + esc(law || '-') + '</span>';
    }
    function unassignedBadge() { return '<span class="badge-unassigned">분류 미확정</span>'; }
    function secondReviewBadge() { return '<span class="badge-second-review">2차 검토 대상</span>'; }

    /* ── 모달 (페이지에 #v2-modal 컨테이너 없으면 동적 생성) ── */
    function openModal(title, bodyHtml, footHtml) {
        closeModal();
        const wrap = document.createElement('div');
        wrap.className = 'modal';
        wrap.id = 'v2-modal';
        wrap.innerHTML =
            '<div class="modal-backdrop" onclick="DYV2.closeModal()"></div>' +
            '<div class="modal-content" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
              '<div class="modal-header">' +
                '<span class="modal-title">' + title + '</span>' +
                '<button class="modal-close" type="button" aria-label="닫기" onclick="DYV2.closeModal()">&times;</button>' +
              '</div>' +
              '<div class="modal-body">' + bodyHtml + '</div>' +
              (footHtml ? '<div class="modal-footer">' + footHtml + '</div>' : '') +
            '</div>';
        document.body.appendChild(wrap);
        document.addEventListener('keydown', escClose);
    }
    function escClose(e) { if (e.key === 'Escape') closeModal(); }
    /* 단일 모달 규칙(UI-RULE: 한 시점에 모달은 1개) — 본 모달과 함께 부수 오버레이도 제거해 잔류 레이어 방지.
     * 규칙 전문은 프로젝트 루트 CLAUDE.md 참고. */
    function closeModal() {
        const m = document.getElementById('v2-modal');
        if (m) m.remove();
        ['org-tree-overlay', 'reg-owner-overlay', 'stack-overlay'].forEach(id => {
            const o = document.getElementById(id); if (o) o.remove();
        });
        document.removeEventListener('keydown', escClose);
    }

    function toast(msg) {
        let t = document.getElementById('toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'toast';
            t.className = 'toast';
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.classList.add('show');
        clearTimeout(window.__toastTimer);
        window.__toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
    }

    /* ── 문서 카드 클릭 공통 액션 ──
     * processType=전자문서 → 프리셋 등록폼 모달 / 첨부파일 → 업로드 모달 / 프로그램 → [이동]
     */
    function openDoc(docId) {
        const d = docs().find(x => x.id === docId);
        if (!d) return;
        if (d.processType === '프로그램') {
            const m = MENUS[d.menuKey];
            window.location.href = m ? m.href : 'docs-archive.html';
            return;
        }
        if (d.processType === '전자문서') {
            /* 전자문서 → e-Doc 엔진 표준 폼에서 값 입력 (작성중→등록완료→확정·온나라 상신) */
            if (window.EDOC) { window.EDOC.openForDoc(d.id); return; }
        }
        /* 첨부파일 */
        openModal('기준문서 업로드',
            '<div style="margin-bottom:14px;">' + processTypeChip(d.processType) + ' ' + lawChip(d.law) +
              ' <span class="chip-mini wt">' + esc(d.version) + '</span></div>' +
            '<p style="font-size:13px; font-weight:600; margin-bottom:12px;">' + esc(d.name) + '</p>' +
            uploadDrop('파일을 끌어다 놓거나 클릭하여 업로드<br><span style="font-size:12px;">다중 첨부 가능 · 업로드 시 버전 이력이 자동 기록됩니다</span>', null, { hint: true }),
            '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" onclick="DYV2.closeModal(); DYV2.toast(\'업로드되었습니다 (프로토타입)\')">업로드</button>'
        );
    }

    window.DYV2 = {
        MENUS, byMenu, complianceRate, dueCount,
        esc, statusChip, workTypeChip, processTypeChip, pdcaChip, lawChip,
        unassignedBadge, secondReviewBadge,
        openModal, closeModal, toast, openDoc,
        docs, FILE_LIMITS, fileHint, uploadDrop, dropKey,
        BP, below, STATUS_TONE, toneOf,
        ORG, orgFlat, orgNode, orgCount, orgTotal, orgWalk, deptNames, orgDepts,
    };
})();
