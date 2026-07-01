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
        risk:     { label: '위험성평가',         sfr: 'SFR-007',          dept: '재난안전과 중대재해팀', href: 'risk-list.html' },
        hazard:   { label: '유해·위험요인 관리', sfr: 'SFR-007·019',      dept: '재난안전과·환경과',     href: 'proc-list.html' },
        edu:      { label: '안전보건교육',       sfr: 'SFR-004·010',      dept: '행정과(교육담당)',      href: 'edu.html' },
        opinion:  { label: '의견청취',           sfr: 'SFR-011',          dept: '재난안전과 중대재해팀', href: 'menu.html?m=opinion' },
        contract: { label: '도급관리',           sfr: 'SFR-013',          dept: '회계과·각 발주부서',    href: 'menu.html?m=contract' },
        improve:  { label: '개선조치',           sfr: 'SFR-003',          dept: '재난안전과 중대재해팀', href: 'menu.html?m=improve' },
        comply:   { label: '이행관리',           sfr: 'SFR-008·014',      dept: '재난안전과·기획예산실', href: 'menu.html?m=comply' },
    };

    const docs = () => window.DY_DOCS || [];

    /* ── 첨부파일 업로드 제약 (지원 형식·용량·개수) — 단일 출처 ── */
    const FILE_LIMITS = {
        formats: 'HWP · HWPX · PDF · DOC(X) · XLS(X) · PPT(X) · JPG · PNG · ZIP',
        maxMB: 20, maxCount: 10,
    };
    /* 업로드 영역 하단에 붙이는 안내 문구 HTML */
    function fileHint() {
        return '<p class="file-hint">📎 <b>지원 형식</b> ' + FILE_LIMITS.formats +
            ' <span class="fh-sep">·</span> <b>파일당 최대</b> ' + FILE_LIMITS.maxMB + 'MB' +
            ' <span class="fh-sep">·</span> <b>최대</b> ' + FILE_LIMITS.maxCount + '개</p>';
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
            '<div class="upload-drop">파일을 끌어다 놓거나 클릭하여 업로드<br><span style="font-size:12px;">다중 첨부 가능 · 업로드 시 버전 이력이 자동 기록됩니다</span></div>' +
            fileHint(),
            '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" onclick="DYV2.closeModal(); DYV2.toast(\'업로드되었습니다 (프로토타입)\')">업로드</button>'
        );
    }

    window.DYV2 = {
        MENUS, byMenu, complianceRate, dueCount,
        esc, statusChip, workTypeChip, processTypeChip, pdcaChip, lawChip,
        unassignedBadge, secondReviewBadge,
        openModal, closeModal, toast, openDoc,
        docs, FILE_LIMITS, fileHint,
    };
})();
