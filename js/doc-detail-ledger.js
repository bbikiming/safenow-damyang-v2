/* =========================================================================
 * 문서 상세 — 2025 원장 · 사용자 등록 문서 (전역 DOCDET)
 *   기획: docs/planning/기획-업무문서-이행목록-업무목록-UX설계-v1.md §8 (UF-08)
 *
 *   기존 doc-detail.js(세트·PDCA 축의 현행 업무문서 426건)는 **손대지 않는다** —
 *   docs-archive·screen-definitions·menu.js 문서탭이 그대로 쓰고 있어 회귀 위험이
 *   크다. 여기서는 새 축(이행항목·업무단계)의 문서만 받아 그리고, 그 밖의 id 는
 *   handles() 가 false 를 돌려 기존 화면으로 넘긴다.
 * ========================================================================= */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYDOCS; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }

    var docId = '', doc = null;

    /* 이 id 를 여기서 그릴 것인가 — 현행 업무문서(V2-###)는 기존 화면 소관이다 */
    function handles(id) {
        if (!id || !global.DYDOCS) return false;
        var d = D().docById(id);
        return !!d && d.origin !== 'v2';
    }

    /* 돌아갈 곳 — 허용 목록은 **DOCUP 단일 출처**다(업무관리 문서 상세와 같은
       목록을 쓴다). 종전에는 이 파일이 자체 BACKS 를 들고 있어, 화면이 하나
       늘 때 한쪽만 고치면 다른 쪽이 폴백으로 떨어졌다. */
    function backTarget() {
        var raw = new URLSearchParams(location.search).get('back') || '';
        var U = global.DOCUP;
        var t = (U && U.backTarget) ? U.backTarget(raw) : null;
        return t || { href: 'docs-preset.html', label: '업무 목록' };
    }
    function backHref() { return backTarget().href; }

    function render() {
        doc = D().docById(docId);
        var main = document.getElementById('dd-main');
        var side = document.getElementById('dd-side');
        var bc = document.getElementById('dd-breadcrumb');
        if (!doc) {
            main.innerHTML = '<div class="card"><div class="card-body"><div class="v2-empty">' +
                '<b>문서를 찾을 수 없습니다.</b><br><a href="' + esc(backHref()) + '">' +
                esc(backTarget().label) + '으로 돌아가기</a></div></div></div>';
            if (side) side.innerHTML = '';
            return;
        }
        document.title = doc.title + ' - 담양군 중대재해예방통합관리시스템 v2';
        var back = backTarget();
        bc.innerHTML =
            '<a href="docs-preset.html">업무문서</a>' +
            '<span class="dd-bc-sep">›</span><a href="' + esc(back.href) + '">' + esc(back.label) + '</a>' +
            '<span class="dd-bc-sep">›</span><span class="dd-bc-cur">' + esc(doc.title) + '</span>';
        main.innerHTML = head() + body();
        if (side) side.innerHTML = aside();
    }

    function srcChip(d) {
        var s = D().SRC[d.src];
        return '<span class="chip-status chip-sm ' + V().toneOf(s ? s.label : '') + '">' + esc(s ? s.label : d.src) + '</span>';
    }

    function head() {
        var d = doc;
        return '<div class="card dd-head">' +
            '<div class="card-body">' +
                '<div class="dd-head-chips">' + srcChip(d) +
                    '<span class="chip-status chip-sm ' + V().toneOf(d.status) + '">' + esc(d.status) + '</span>' +
                    (d.nearDup ? '<span class="chip-status chip-sm warning">중복 의심</span>' : '') +
                    (d.origin === 'ledger' && !d.mapped ? '<span class="chip-status chip-sm warning">미분류</span>' : '') +
                '</div>' +
                /* 이 화면의 주제목이다 — 페이지에 h1 이 없으면 읽기 순서가 h2 부터
                   시작해 보조기술이 문서 제목을 잡지 못한다 */
                '<h1 class="dd-title">' + esc(d.title) +
                    /* 제목은 **제목 옆**에서 고친다 — 아래 관리 영역까지 내려가야
                       하면 «여기가 틀렸는데»와 «고치는 곳»이 멀어진다. 권한이
                       없으면 버튼을 내지 않는다(눌러도 거절하는 버튼을 남기지 않는다). */
                    (canEditTitle()
                        ? ' <button type="button" class="dd-title-edit" onclick="DOCDET.editTitle()"' +
                          ' aria-label="문서 제목 수정">제목 수정</button>'
                        : '') +
                '</h1>' +
                '<dl class="dd-meta">' +
                    m('문서번호', d.origin === 'ledger' ? '<span class="dx-nodoc">기록 없음</span>' : '<span class="dx-nodoc">(온나라에서 부여)</span>') +
                    m('보고일자', d.date || '<span class="dx-nodoc">미기재</span>') +
                    /* 방향이 있으면 «받음 · 기관» 으로 낸다. 옛 데이터는 방향이
                       없어 기관명만 나온다 — 없는 값을 지어내지 않는다. */
                    m('수발신', D().srText(d, true)
                        ? esc(D().srText(d, true)) + (d.sr ? srNote(d.sr) : '')
                        : '<span class="dx-nodoc">미기재</span>') +
                    /* 문구가 출처를 지목하므로 출처별로 갈린다 — 2026 예시 자료에
                       «2025년 원장에 없다»고 쓰면 그 화면에서 바로 어긋난다. */
                    /* 원장이 20개 부서를 갖게 되면서 **부서는 있고 담당자만 없다**.
                       종전 문구(«원장에 담당 정보가 없습니다»)는 이제 사실과 다르다. */
                    m('담당부서 · 담당자', d.dept
                        ? esc(d.dept) + (d.assignee ? ' / ' + esc(d.assignee)
                            : ' <span class="dx-nodoc">/ 담당자는 기록 없음 — 문서 원장이 부서까지만 갖고 있습니다</span>')
                        : '<span class="dx-nodoc">기록 없음</span>') +
                    m('기준연도', d.year + '년') +
                    m('운영주기', d.cycle ? esc(d.cycle) : '<span class="dx-nodoc">미기재</span>') +
                    /* 출처를 틀리게 말하면 그 자체가 거짓 자료가 된다 — 원장 실측
                       57,765건이 «사용자 등록»으로 뜨던 결함을 여기서 막는다.
                       판정 순서는 좁은 것부터다(seed26 → real → demo → 등록분). */
                    m('데이터 구분', d.origin === 'seed26'
                        ? '<b>예시 자료</b> <span class="dx-nodoc">— 2026년 실적은 2025년 실측 패턴에서 규칙으로 만든 자료입니다(tools/build-doc-seed-2026.py). 실제 제출 기록이 아닙니다.</span>'
                        : d.dataMode === 'real'
                        ? '<b>문서 원장 실측</b> <span class="dx-nodoc">— ' + esc(d.year) + '년 담양군 문서 원장에서 그대로 가져온 실제 기록입니다.</span>'
                        : d.dataMode === 'demo'
                        ? '예시 값 <span class="dx-nodoc">— 출처·상태는 문서 ID 해시로 고정 배정된 값이며 실서비스에서는 온나라·전자문서·파일관리 어댑터의 원천 상태로 대체됩니다</span>'
                        : '사용자 등록') +
                '</dl>' +
                (d.note ? '<p class="dd-note">' + esc(d.note) + '</p>' : '') +
            '</div>' +
        '</div>';
    }
    function m(k, v) { return '<div><dt>' + esc(k) + '</dt><dd>' + v + '</dd></div>'; }
    /* 수발신자 상위 값은 전라남도 등 외부 발신기관이다 — 담당자로 오독하지 않게 */
    function srNote(sr) {
        if (sr === '노, 로, 도') return ' <span class="chip-status chip-sm warning">원본 확인 필요</span>';
        return /^(전라남도|행정안전부|고용노동부)/.test(sr) ? ' <span class="dx-nodoc">(외부 발신기관)</span>' : '';
    }

    function body() {
        var d = doc;
        return '<div class="card dd-sec"><div class="card-body">' +
                '<h3 class="dd-h3">이행항목 · 업무단계 <span class="dd-n">' + d.stageIds.length + '</span></h3>' +
                stageTable() +
            '</div></div>' +
            '<div class="card dd-sec"><div class="card-body">' +
                '<h3 class="dd-h3">첨부 · 원본</h3>' + files() +
            '</div></div>' +
            (canManage() ? '<div class="card dd-sec"><div class="card-body">' +
                '<h3 class="dd-h3">관리</h3>' + manage() +
            '</div></div>' : '');
    }

    function stageTable() {
        var d = doc;
        if (!d.stageIds.length) {
            return '<div class="v2-empty"><b>연결된 업무단계가 없습니다.</b><br>' +
                (d.origin === 'ledger'
                    ? '원자료에 분류가 비어 있던 문서입니다(미분류 34건). 어느 업무단계의 증빙인지 지정하면 이행 현황에 반영됩니다.'
                    : '업무를 다시 등록하면서 업무단계를 선택하세요.') +
                (canManage() ? '<div style="margin-top:10px;"><button class="btn btn-sm btn-primary" onclick="DOCDET.remap()">업무단계 지정</button></div>' : '') +
            '</div>';
        }
        var byItem = {};
        d.stageIds.forEach(function (sid) {
            var s = D().stage(sid); if (!s) return;
            (byItem[s.itemId] = byItem[s.itemId] || []).push(s);
        });
        return '<table class="table-figma table-compact dd-stages"><thead><tr>' +
            '<th>이행항목 / 업무단계</th><th>운영주기</th><th>' + d.year + '년 상태</th><th class="col-action">이동</th>' +
        '</tr></thead><tbody>' +
        Object.keys(byItem).map(function (iid) {
            var it = D().item(iid);
            return '<tr class="dd-item-row"><td colspan="4">' +
                    '<a href="docs-exec.html?item=' + esc(iid) + '&year=' + d.year + '">' + esc(it.id) + ' · ' + esc(it.name) + '</a></td></tr>' +
                byItem[iid].map(function (s) {
                    var code = D().statusOfStage(s.id, d.year);
                    return '<tr><td class="dd-stage-name">' + esc(s.id) + ' ' + esc(s.name) + '</td>' +
                        '<td>' + esc(s.opCycle || s.timing || '—') + '</td>' +
                        '<td><span class="chip-status chip-sm ' + V().toneOf(D().statusLabel(code)) + '">' +
                            esc(D().statusLabel(code)) + '</span></td>' +
                        '<td class="col-action"><a class="btn btn-sm btn-outline" href="docs-exec.html?stage=' +
                            esc(s.id) + '&year=' + d.year + '">이행 목록 →</a></td></tr>';
                }).join('');
        }).join('') + '</tbody></table>';
    }

    /* 첨부·PDF — 실제로 열 수 있는 것만 링크한다. 없는 파일에 깨진 링크를 만들지 않는다 */
    function files() {
        var d = doc, fs = d.files || [];
        var out = '';
        if (!fs.length) {
            out += '<div class="v2-empty">' +
                (d.origin === 'ledger'
                    ? '<b>원본 파일이 연계되어 있지 않습니다.</b><br>2025년 문서 원장은 문서명·수발신자·보고일자만 담고 있고 첨부 바이너리 경로가 없습니다. 파일관리 연계 후 제공됩니다.'
                    : '<b>첨부가 없습니다.</b>') +
            '</div>';
        } else {
            out += '<ul class="dd-files">' + fs.map(function (f) {
                var copied = f.copiedFromFileId;
                return '<li><span class="dd-f-name">' + esc(f.name) + '</span>' +
                    '<span class="dd-f-meta">' + (f.size ? Math.max(1, Math.round(f.size / 1024)) + ' KB · ' : '') + esc(f.at || '') +
                    (copied ? ' · <span class="chip-status chip-sm purple">' + esc(f.sourceYear) + '년에서 복사</span>' : '') + '</span>' +
                    '<span class="dx-nodoc dd-f-note">파일 실물 저장은 문서관리 연계 후 적용됩니다</span></li>';
            }).join('') + '</ul>';
        }
        /* 온나라 PDF — 예시 상태가 '온나라'라는 이유만으로 가짜 링크를 만들지 않는다 */
        out += '<div class="dd-pdf">' +
            (d.src === 'onnara'
                ? '<b>온나라 PDF</b> <span class="dx-nodoc">원본 PDF 미연계 — 온나라 연동 후 제공됩니다. ' +
                  '시스템에서 상신한 공문은 해당 도메인 화면(안전보건교육 결재 이력 · 위험성평가 공문)에서 지면으로 확인합니다.</span>'
                : '<b>온나라 PDF</b> <span class="dx-nodoc">이 문서의 출처가 온나라가 아닙니다.</span>') +
        '</div>';
        return out;
    }

    /* '사용자 등록 문서인가'만으로 판단하면 타 부서 담당자가 남의 문서를 고칠 수
       있다. 부서·작성자 범위까지 보는 DYDOCS.canEditDoc() 단일 출처를 쓴다. */
    function canManage() { return D().canEditDoc(doc); }
    /* 지울 수 있는 것은 **사용자 등록분뿐**이다 — removeDocument() 가 store().docs
       만 건드리므로 원장·시드 문서에서는 확인 모달까지 띄운 뒤 반드시 거부된다.
       확인까지 시키고 거절하는 버튼은 '없는 동작을 시각적으로 약속하는' 패턴이다
       (CLAUDE.md §2 무핸들러 드롭존 금지와 같은 근거). 데이터 계층 가드는 화면
       우회 방어로 그대로 둔다(IMP-04). */
    function canDeleteDoc() { return D().canDelete() && doc.origin === 'user'; }
    /* 판정도 DOCUP 단일 출처다 — 두 상세가 다른 기준을 갖지 않게 한다 */
    function canEditTitle() {
        var U = global.DOCUP;
        return !!(U && U.canEditTitle && U.canEditTitle(doc));
    }
    function delDenyNote() {
        if (doc.origin !== 'user') {
            return '원장·시드 문서는 지울 수 없습니다 — 잘못 붙은 분류는 [단계 지정]으로 고칩니다.';
        }
        return D().ownDenyNote(doc.dept);
    }
    /* 제목 수정은 DOCUP 이 한다 — 업무관리 문서 상세와 같은 모달·검사·권한을
       쓰기 위해서다(§7). 여기서는 저장 뒤 이 화면을 다시 그리는 것만 맡는다. */
    function editTitle() {
        var U = global.DOCUP;
        if (!U || !U.editTitle) { V().toast('제목 수정을 불러오지 못했습니다.'); return; }
        U.editTitle(docId, function () { render(); });
    }

    function manage() {
        var imp = D().impactOf(doc.id) || {};
        /* 영향 범위 설명은 **지울 수 있을 때만** 낸다 — 못 지우는 문서에 삭제
           영향을 적어 두면 도달할 수 없는 행동을 설명하는 글이 된다. */
        return (canDeleteDoc()
                ? '<p class="dd-imp">이 문서를 지우면 <b>업무단계 ' + (imp.stages || 0) + '개</b>' +
                  (imp.completed ? ' (완료 확인된 ' + imp.completed + '개 포함)' : '') +
                  ' · 이행항목 ' + (imp.items || 0) + '개의 증빙에서 빠지고, 남은 증빙이 없는 단계는 <b>미이행</b>으로 돌아갑니다.</p>'
                : '') +
            '<div class="dd-acts">' +
                (doc.origin === 'user' ? '<button class="btn btn-secondary" onclick="DOCDET.remap()">업무단계 수정</button>' : '') +
                (canDeleteDoc() ? '<button class="btn btn-outline" onclick="DOCDET.confirmDel()">문서 삭제</button>'
                    : '<span class="dx-nodoc">' + esc(delDenyNote()) + '</span>') +
            '</div>';
    }

    /* 우측 — 같은 업무단계를 증빙하는 다른 문서 */
    function aside() {
        var d = doc;
        if (!d.stageIds.length) return '<div class="dd-side-box"><h4>관련 문서</h4><div class="v2-empty">업무단계가 없어 관련 문서를 찾을 수 없습니다.</div></div>';
        var seen = {}, rel = [];
        d.stageIds.forEach(function (sid) {
            D().documentIdsOfStage(sid).forEach(function (id2) {
                if (id2 === d.id || seen[id2]) return;
                seen[id2] = 1;
                var o = D().docById(id2);
                if (o) rel.push(o);
            });
        });
        rel.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
        return '<div class="dd-side-box">' +
            '<h4>같은 업무단계의 다른 문서 <span class="dd-n">' + rel.length + '</span></h4>' +
            (rel.length
                ? '<ul class="dd-rel">' + rel.slice(0, 20).map(function (o) {
                    return '<li><a href="doc-detail.html?id=' + esc(o.id) + '">' + esc(o.title) + '</a>' +
                        '<span class="dx-nodoc">' + esc(o.date || '') + ' · ' + esc(o.year) + '년</span></li>';
                  }).join('') + '</ul>' + (rel.length > 20 ? '<p class="dx-nodoc">외 ' + (rel.length - 20) + '건</p>' : '')
                : '<div class="v2-empty">이 업무단계를 증빙하는 다른 문서가 없습니다.</div>') +
        '</div>';
    }

    /* ── 동작 ── */
    /* 단계 지정 화면을 여기서 또 만들지 않는다(§7 계열 신설 금지) — 업무 목록의
       교정 흐름으로 이 문서를 집어 보낸다. 버튼이 아무 데도 안 가면 그게 막다른 길이다. */
    function remap() {
        if (doc.origin === 'ledger') {
            location.href = 'docs-preset.html?mapping=unmapped&q=' + encodeURIComponent(doc.title);
            return;
        }
        V().toast('업무단계 수정은 업무 업로드 마법사에서 다시 등록해 주세요 — 이미 붙은 확인 기록과 어긋나지 않게 하기 위해서입니다.');
    }
    function confirmDel() {
        /* 버튼만 감추면 전역 호출로 뚫린다 — 확인 모달 진입도 같은 판정으로 막는다 */
        if (!canDeleteDoc()) { V().toast(delDenyNote()); return; }
        var imp = D().impactOf(doc.id);
        if (!imp) return;
        V().openModal('문서 삭제 확인',
            '<div class="dd-del">' +
                '<p><b>' + esc(imp.title) + '</b></p>' +
                '<ul class="dd-del-list">' +
                    '<li>연결 업무단계 <b>' + imp.stages + '개</b>' + (imp.completed ? ' (완료 확인된 <b>' + imp.completed + '개</b> 포함)' : '') + '</li>' +
                    '<li>이행항목 <b>' + imp.items + '개</b></li>' +
                    '<li>첨부 <b>' + imp.files + '개</b></li>' +
                '</ul>' +
                '<p class="dd-del-warn">남은 증빙이 없는 업무단계는 <b>미이행</b>으로 돌아갑니다. 되돌릴 수 없습니다.</p>' +
            '</div>',
            '<button class="btn btn-outline" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" onclick="DOCDET.doDel()">삭제</button>');
    }
    function doDel() {
        var r = D().removeDocument(docId);
        V().closeModal();
        if (!r.ok) { V().toast(r.reason); return; }
        V().toast('문서를 삭제했습니다.');
        location.href = backHref();
    }

    function init() {
        var p = new URLSearchParams(location.search);
        docId = p.get('id') || '';
        if (!handles(docId)) return false;
        render();
        return true;
    }

    global.DOCDET = { init: init, handles: handles, render: render, remap: remap, confirmDel: confirmDel, doDel: doDel,
        editTitle: editTitle };
}(window));
