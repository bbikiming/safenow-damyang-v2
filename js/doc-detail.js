/* =========================================================================
 * 문서 상세 페이지 — 업무 목록 / 이행 목록의 문서 행에서 진입 (?id=DOC-XXX)
 *   브레드크럼 · 좌측(첨부=미리보기 / 전자문서=입력폼 / 프로그램=이동 안내)
 *   우측(기준 문서 · 선행 문서 · 후행 문서 — 클릭 시 해당 문서 상세로 이동)
 * ========================================================================= */
(function () {
    'use strict';
    const V = window.DYV2, E = window.EDOC;
    const esc = V.esc;

    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    const isV2 = params.get('v') === '2';
    const verQS = isV2 ? '&v=2' : '';
    const listHref = isV2 ? 'docs-preset.html?ver=v2' : 'docs-preset.html';

    /* 버전별 데이터 소스 */
    const HAS_REG = isV2 && window.DYREG;
    const SETS = isV2 ? window.DY_SETS_V2 : window.DY_SETS;
    const DOC_SET = isV2 ? window.DY_DOC_SET_V2 : window.DY_DOC_SET;
    const ALL = isV2 ? (HAS_REG ? window.DYREG.allDocs() : (window.DY_DOCS_V2 || [])) : V.docs();
    const MENU_META = isV2 ? window.DY_MENUS_V2 : V.MENUS;
    /* 세트 해석: 사용자 등록 문서는 doc.setId 직접 보유, 시드는 DOC_SET 매핑 */
    function sidOf(doc) { return HAS_REG ? window.DYREG.setIdOf(doc) : (DOC_SET[doc.id]); }

    const d = ALL.find(x => x.id === id);

    if (!d) {
        document.getElementById('dd-main').innerHTML =
            '<div class="card"><div class="card-body"><div class="v2-empty">문서를 찾을 수 없습니다. <a href="' + listHref + '" style="color:var(--main); font-weight:700;">업무 목록</a>으로 돌아가기</div></div></div>';
        return;
    }

    const setId = sidOf(d) || null;
    const set = SETS.find(s => s.id === setId) || null;
    const menu = MENU_META[d.menuKey] || { label: d.daemenu, href: '#' };
    menu.href = menu.href || '#';
    document.title = d.name + ' - 담양군 중대재해예방통합관리시스템 v2';

    /* ── 문서번호 (결정적 합성 — 세트ID + 세트 내 순번) ── */
    function docNo(doc) {
        const sid = sidOf(doc);
        if (!sid) {
            const code = { 전자문서: 'EDOC', 첨부파일: 'FILE', 프로그램: 'PROG' }[doc.processType] || 'DOC';
            return code + '-' + doc.id.replace('DOC-', '');
        }
        const peers = ALL.filter(x => sidOf(x) === sid);
        const seq = peers.indexOf(doc) + 1;
        return sid + '-' + String(seq).padStart(2, '0');
    }

    /* ── 세트 선후행 파싱 (sets-data.js pre 텍스트 → 같은 메뉴 내 order 번호) ── */
    function parsePre(pre) {
        const ids = [];
        const cleaned = (pre || '').replace(/\([^)]*\)/g, ' ');
        if (/\bS0\b/.test(cleaned)) ids.push(0);
        const re = /세트\s*(\d+(?:\s*[~∼]\s*\d+)?(?:\s*·\s*\d+)*)/g;
        let m;
        while ((m = re.exec(cleaned))) {
            const body = m[1].replace(/\s/g, '');
            if (/[~∼]/.test(body)) { const [a, b] = body.split(/[~∼]/).map(Number); for (let i = a; i <= b; i++) ids.push(i); }
            else body.split('·').forEach(n => ids.push(parseInt(n, 10)));
        }
        return [...new Set(ids)];
    }
    function setsByOrders(menuKey, orders) {
        return orders.map(o => SETS.find(s => s.menuKey === menuKey && s.order === o)).filter(Boolean);
    }
    function precedingSets(s) { return s ? setsByOrders(s.menuKey, parsePre(s.pre)) : []; }
    function subsequentSets(s) {
        if (!s) return [];
        return SETS.filter(x => x.menuKey === s.menuKey && parsePre(x.pre).includes(s.order));
    }
    function docsOfSet(s, limit) {
        const list = ALL.filter(x => sidOf(x) === s.id);
        return limit ? list.slice(0, limit) : list;
    }

    const STATUS = (function () {
        const st = E.statusOf(id);
        if (st === '확정') return { label: '확정 · 온나라 상신', cls: 'st-done' };
        if (st === '등록완료') return { label: '등록완료', cls: 'st-doing' };
        if (st) return { label: '작성중', cls: 'st-todo' };
        return d.status === '완료' ? { label: '활성 (완료)', cls: 'st-done' }
            : d.status === '진행' ? { label: '진행중', cls: 'st-doing' }
            : { label: '시작 전', cls: 'st-todo' };
    })();

    const PT_CHIP = { 전자문서: 'wt-elec', 첨부파일: 'wt-attach', 프로그램: 'wt-program' };

    /* ── 브레드크럼 ── */
    const menuQS = (isV2 ? 'docs-preset.html?ver=v2&menu=' : 'docs-preset.html?menu=') + d.menuKey;
    document.getElementById('dd-breadcrumb').innerHTML =
        '<a href="' + listHref + '">업무문서</a>' +
        '<span class="dd-bc-sep">›</span><a href="' + listHref + '">업무 목록' + (isV2 ? ' (재분류 v2)' : '') + '</a>' +
        '<span class="dd-bc-sep">›</span><a href="' + menuQS + '">' + esc(menu.label) + '</a>' +
        (set ? '<span class="dd-bc-sep">›</span><a href="' + menuQS + '">' + esc(set.name) + '</a>' : '') +
        '<span class="dd-bc-sep">›</span><span class="dd-bc-cur">' + esc(d.name) + '</span>';

    /* ── 좌측: 헤더(메타) + 본문(처리유형별) ── */
    function metaCard() {
        return '<div class="dd-doc-head">' +
            '<div class="dd-doc-toprow">' +
                '<span class="chip-mini ' + (PT_CHIP[d.processType] || 'wt') + '">' + esc(d.processType) + '</span>' +
                '<span style="flex:1;"></span>' +
                (HAS_REG && window.DYREG.isUser(id)
                    ? '<button class="btn btn-sm btn-secondary" id="dd-edit">편집</button>' +
                      '<button class="btn btn-sm btn-secondary" id="dd-del">삭제</button>'
                    : '') +
                '<span class="chip-mini ' + STATUS.cls + '">' + STATUS.label + '</span>' +
                '<span class="dd-ver">Ver. ' + esc(d.version.replace('v', '')) + '</span>' +
            '</div>' +
            '<h1 class="dd-doc-title">' + esc(d.name) + '</h1>' +
            (isV2 && d.needReview === 'Y'
                ? '<div class="v2-todo" style="margin-bottom:12px;">기획자 확인 필요' + (d.needReason ? ' — ' + esc(d.needReason) : '') + '</div>'
                : '') +
            '<div class="dd-meta">' +
                metaField('문서 번호', docNo(d)) +
                metaField('최종 업데이트일', d.updated) +
                metaField('작성자', d.assignee + ' · ' + (d.processType === '전자문서' ? '담당' : '관리책임자')) +
                metaField('담당부서', d.dept) +
                (isV2 ? metaField('문서 역할', d.docRole || '-') : '') +
                (isV2 ? metaField('법적 근거', d.legalBasis || '-') : '') +
            '</div>' +
        '</div>';
    }
    function metaField(label, val) {
        return '<div class="dd-meta-field"><span class="dd-meta-label">' + esc(label) + '</span>' +
            '<span class="dd-meta-val">' + esc(val) + '</span></div>';
    }

    /* 첨부파일 미리보기 (목업 — 실제 문서를 렌더한 모습) */
    function previewBody() {
        return '<div class="card" style="margin-top:16px;">' +
            '<div class="card-header"><span class="card-title">문서 미리보기</span>' +
                '<div style="display:flex; gap:8px;">' +
                    '<button class="btn btn-sm btn-outline" onclick="DYV2.toast(\'다운로드 — ' + esc(docNo(d)) + '.pdf (프로토타입)\')">다운로드</button>' +
                    '<button class="btn btn-sm btn-secondary" onclick="DYV2.openDoc(\'' + d.id + '\')">새 버전 업로드</button>' +
                '</div></div>' +
            '<div class="card-body">' +
                '<div class="dd-preview">' +
                    '<div class="dd-pv-paper">' +
                        '<div class="dd-pv-band"></div>' +
                        '<p class="dd-pv-kicker">' + esc(menu.label) + (set ? ' · ' + esc(set.name) : '') + '</p>' +
                        '<h2 class="dd-pv-title">' + esc(d.name) + '</h2>' +
                        '<div class="dd-pv-meta"><span>문서번호 ' + esc(docNo(d)) + '</span><span>' + esc(d.version) + '</span><span>' + esc(d.updated) + '</span></div>' +
                        '<h3 class="dd-pv-h">1. 목적 및 범위</h3>' +
                        '<p class="dd-pv-p">본 문서는 「중대재해처벌법」 및 「산업안전보건법」에 따라 ' + esc(menu.label) + ' 업무의 기준·절차를 정하여, 담양군 사업장의 안전·보건 확보 의무 이행을 목적으로 한다. 적용 범위는 군 직영 사업장 및 관계 수급인의 종사자 전체로 한다.</p>' +
                        '<h3 class="dd-pv-h">2. 주요 내용</h3>' +
                        '<ul class="dd-pv-ul"><li>책임과 권한의 명확화 및 수행 주체 지정</li><li>주기적 점검·평가 및 기록 보존 절차</li><li>미흡 사항에 대한 개선조치 및 사후 확인</li></ul>' +
                        '<div class="dd-pv-alert"><b>중요 알림</b><br>' + (isV2 && d.legalBasis ? '법적 근거: ' + esc(d.legalBasis) + '. ' : '') + '본 문서는 ' + esc(set ? set.name : menu.label) + ' 이행의 ' + esc(isV2 ? (d.docRole || '근거') : '기준') + ' 문서이다.</div>' +
                        '<p class="dd-pv-foot">※ 본 미리보기는 프로토타입 더미입니다. 실제 첨부 원본(PDF·HWP)으로 대체됩니다.</p>' +
                    '</div>' +
                '</div>' +
                (d.files && d.files.length
                    ? '<div class="attach-list" style="margin-top:16px;"><div class="attach-list-head">첨부파일 목록 (' + d.files.length + '건)</div>' +
                      '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>파일명</th><th>설명</th><th>등록일</th><th>관리</th></tr></thead><tbody>' +
                      d.files.map(f => '<tr><td>' + esc(f.name) + '</td><td>' + esc(f.desc || '') + '</td><td>' + esc(f.date || d.updated) + '</td>' +
                        '<td><button class="btn btn-sm btn-outline" onclick="DYV2.toast(\'다운로드 — ' + esc(f.name) + ' (프로토타입)\')">다운로드</button></td></tr>').join('') +
                      '</tbody></table></div></div>'
                    : '') +
                '<div class="dd-ver-hist">' +
                    '<p class="edoc-history-title">버전 이력</p>' +
                    '<div class="edoc-history-row"><span>' + esc(d.updated) + '</span>' + esc(d.version) + ' · ' + esc(d.assignee) + ' · 최신</div>' +
                    '<div class="edoc-history-row"><span>2026-01-15</span>v1.0 · 김중대 · 최초 등록</div>' +
                '</div>' +
            '</div></div>';
    }

    /* 전자문서 입력폼 (인라인) */
    function formBody() {
        return '<div class="card" style="margin-top:16px;">' +
            '<div class="card-header"><span class="card-title">전자문서 입력</span></div>' +
            '<div class="card-body"><div id="dd-form"></div></div></div>';
    }
    /* 프로그램 문서 이동 안내 (사용자 등록 문서는 선택한 메뉴 › 뎁스로 이동) */
    function programBody() {
        const href = d.linkHref || menu.href;
        const target = d.linkLabel || menu.label;
        const path = d.linkMenu ? (esc(d.linkMenu) + ' › ' + esc(d.linkLabel)) : esc(menu.label);
        const desc = d.linkMenu
            ? (path + ' 화면에서 입력·평가·이력 관리가 이루어집니다.')
            : (esc(menu.label) + ' 전용 화면에서 입력·평가·이력 관리가 이루어집니다.');
        return '<div class="card" style="margin-top:16px;"><div class="card-body">' +
            '<div class="edoc-linkcard">이 문서는 전용 프로그램 화면에서 처리합니다.</div>' +
            '<p style="font-size:13px; color:var(--text-gray); margin:10px 0 14px;">' + desc + '</p>' +
            '<a class="btn btn-primary" href="' + href + '">' + esc(target) + ' 화면으로 이동 →</a>' +
        '</div></div>';
    }

    document.getElementById('dd-main').innerHTML =
        '<div class="card"><div class="card-body">' + metaCard() + '</div></div>' +
        (d.processType === '전자문서' ? formBody()
            : d.processType === '프로그램' ? programBody()
            : previewBody());

    if (d.processType === '전자문서') {
        E.renderInline(document.getElementById('dd-form'), {
            id: d.id, title: d.name, form: (d.formRef && d.formRef.formId) ? d.formRef.formId : E.formFor(d),
            ctx: { menuLabel: d.daemenu + ' · ' + d.cycle, checklist: window.EDOC_T.CHECKLIST_PRESETS.default },
            source: set ? '소속 세트 ' + set.id + ' · ' + set.name : null,
            onChange: function () { /* 상태 변경 시 헤더 칩 갱신 위해 페이지 리로드 없이 두기 — 새로고침 시 반영 */ },
        });
    }

    /* 사용자 등록 문서 — 편집(U)·삭제(D) */
    if (HAS_REG && window.DYREG.isUser(id)) {
        const eb = document.getElementById('dd-edit');
        if (eb) eb.addEventListener('click', () => window.DYREG.openEdit(id, { onDone: () => location.reload() }));
        const db = document.getElementById('dd-del');
        if (db) db.addEventListener('click', () => window.DYREG.remove(id, { onDone: () => { location.href = listHref; } }));
    }

    /* ── 우측: 기준 / 선행 / 후행 문서 ── */
    function relItem(doc, sub) {
        const icon = doc.processType === '전자문서' ? '전자' : doc.processType === '프로그램' ? '실행' : '문서';
        return '<a class="dd-rel-item" href="doc-detail.html?id=' + doc.id + verQS + '">' +
            '<span class="dd-rel-ico">' + icon + '</span>' +
            '<span class="dd-rel-body"><span class="dd-rel-name">' + esc(doc.name) + '</span>' +
            '<span class="dd-rel-no">' + esc(docNo(doc)) + ' · ' + esc(sub || doc.dept) + '</span></span></a>';
    }
    function lawItem(name, code) {
        return '<a class="dd-rel-item" href="docs-archive.html" onclick="DYV2.toast(\'법령 원문 연계 (프로토타입)\'); return false;">' +
            '<span class="dd-rel-ico">법령</span>' +
            '<span class="dd-rel-body"><span class="dd-rel-name">' + esc(name) + '</span>' +
            '<span class="dd-rel-no">' + esc(code) + ' · 외부 법령</span></span></a>';
    }
    function relCard(title, sub, itemsHtml) {
        return '<div class="dd-rel-card">' +
            '<div class="dd-rel-head"><b>' + title + '</b><span class="dd-rel-sub">' + sub + '</span></div>' +
            (itemsHtml || '<div class="dd-rel-empty">해당 문서 없음</div>') + '</div>';
    }

    let refHtml, preHtml, subHtml;

    if (isV2) {
        /* v2: 기준=같은 세트 내 docRole=기준/절차 문서 + 법적근거 / 선후행=같은 세트 PDCA 단계 순(P→D→C→A) */
        const PDORD = { P: 0, D: 1, C: 2, A: 3 };
        const peers = docsOfSet(set || {});
        const myStage = PDORD[d.pdca];
        const baseDocs = peers.filter(x => x.id !== id && /기준|절차|규정|매뉴얼/.test(x.docRole || ''));
        refHtml = (d.legalBasis ? lawItem(d.legalBasis, d.theme || '법적 근거') : '') +
            baseDocs.map(x => relItem(x, x.docRole || '기준/절차')).join('');
        const pre = peers.filter(x => x.id !== id && myStage != null && PDORD[x.pdca] != null && PDORD[x.pdca] < myStage).slice(0, 4);
        const sub = peers.filter(x => x.id !== id && myStage != null && PDORD[x.pdca] != null && PDORD[x.pdca] > myStage).slice(0, 4);
        preHtml = pre.map(x => relItem(x, x.docRole || ({ P: '계획', D: '실행', C: '점검', A: '조치' }[x.pdca] || ''))).join('');
        subHtml = sub.map(x => relItem(x, x.docRole || ({ P: '계획', D: '실행', C: '점검', A: '조치' }[x.pdca] || ''))).join('');
    } else {
        /* v1: 기준=같은 메뉴 S0 세트 + 외부 법령 / 선후행=세트 pre 파싱 */
        const baseSet = SETS.find(s => s.menuKey === d.menuKey && s.order === 0);
        const baseDocs = baseSet ? docsOfSet(baseSet).filter(x => x.id !== id) : [];
        const lawByMenu = {
            policy: ['중대재해처벌법 §4 (안전보건 목표·경영방침)', 'CRA-04'],
            comply: ['중대재해처벌법 시행령 §4·§5', 'CRA-D-04'],
            risk: ['산업안전보건법 §36 (위험성평가)', 'OSH-36'],
            hazard: ['산업안전보건법 §125 (작업환경측정)', 'OSH-125'],
            edu: ['산업안전보건법 §29 (안전보건교육)', 'OSH-29'],
            opinion: ['산업안전보건법 §24 (산업안전보건위원회)', 'OSH-24'],
            contract: ['산업안전보건법 §63 (도급인의 안전조치)', 'OSH-63'],
            improve: ['산업안전보건법 §56 (중대재해 원인조사)', 'OSH-56'],
            org: ['산업안전보건법 §17·§18 (안전·보건관리자)', 'OSH-17'],
        };
        const law = lawByMenu[d.menuKey];
        refHtml = (law ? lawItem(law[0], law[1]) : '') + baseDocs.map(x => relItem(x, '기준문서')).join('');
        preHtml = precedingSets(set).flatMap(s => docsOfSet(s, 2).map(x => relItem(x, s.name))).join('');
        subHtml = subsequentSets(set).flatMap(s => docsOfSet(s, 2).map(x => relItem(x, s.name))).join('');
    }

    document.getElementById('dd-side').innerHTML =
        relCard('기준 문서', 'Reference', refHtml) +
        relCard('↑ 선행 문서', 'Preceding', preHtml) +
        relCard('↓ 후행 문서', 'Subsequent', subHtml);
})();
