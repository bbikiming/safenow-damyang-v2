/* =====================================================================
   rsk-occ.js · 수시 위험성평가 (RSK03-L)  — 2026-07-30 회의 반영
   · 연도 셀렉트 + 실시 사유 필터 (고시 §15② 법정 6종)
   · [＋등록] → **실시 사유 선택**을 먼저 거친 뒤 등록 폼으로 (빈 폼 직행 금지)
   · 작성 양식(HWPX) 다운로드 → 작성본 첨부 → 상태 REGISTERED
   · 안전관리자 **검토파일 등록 = 검토 완료**(REVIEWED). 외부 용역이라 전자결재 불가.
   · 기존 등록 폼은 존치한다 — 발주처가 "버리기는 아까운데 … 안전 관리자랑 대화하고 나서"
     라며 폐기 판단을 유보했다. 지우지 말 것.
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYRSK; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }

    var state = { mount: null, year: 2026, fReason: '' };

    /* ===== 조회 범위 · 조작 권한 =====
     * 수시평가는 **부서가 자기 사업장 건을 등록**하고, **안전관리자 검토 서명**은
     * 주관부서(재난안전과)가 받아 붙인다(외부 용역이라 전자결재가 안 된다 — §4-3).
     * 종전에는 판정이 없어서 환경과 주무관이 물순환사업소 재해 건을 보고
     * [＋ 검토파일 등록]·[해제]까지 누를 수 있었다. 범위는 DYROLE.scope() 단일 출처. */
    function R() { return global.DYROLE; }
    function inScope(o) { return !R() || R().inScope(o.deptId); }
    function isStaff() { var p = R() && R().current(); return !p || p.tier === 'staff'; }
    /* 등록 — 자기 부서 건을 올리는 것이므로 부서 담당자면 된다 */
    function canRegister() { return isStaff(); }
    /* 검토 서명 첨부·해제 — 주관부서(재난안전과) 담당자만 */
    function canReview() {
        if (!R()) return true;
        var p = R().current();
        return !!p && p.tier === 'staff' && p.deptId === R().OWNER_DEPT;
    }
    function scopeNote() {
        if (!R()) return '';
        var p = R().current(), s = R().scope(), why;
        if (canReview()) return '';
        if (p.tier === 'head') why = '총괄 책임자는 <b>전 부서</b> 수시평가를 조회합니다. 등록·검토는 각 부서와 주관부서가 수행합니다.';
        else if (s === 'all') why = '주관부서 안에서도 등록·<b>안전관리자 검토 첨부</b>는 담당자(주무관)가 수행합니다.';
        else if (!isStaff()) why = '<b>' + esc(p.deptName || '') + '</b> 소관 건만 표시됩니다 — 등록·완료 처리는 <b>담당자 본인</b>이 수행합니다.';
        else why = '<b>' + esc(p.deptName || '') + '</b> 소관 건만 표시됩니다 — ' +
                   '<b>안전관리자 검토 서명</b> 첨부는 주관부서(<b>재난안전과</b>)가 수행합니다.';
        return '<div class="rl-ro" role="note"><b>조회 범위</b> — ' + why + '</div>';
    }
    var F = null; /* 등록 폼 상태 */

    function render() {
        if (!state.mount) return;
        var years = D().occasionalYears();
        if (years.indexOf(state.year) === -1) years.unshift(state.year);
        years.sort(function (a, b) { return b - a; });

        var list = D().occasionals(state.year).filter(function (o) {
            return inScope(o) && (!state.fReason || o.reason === state.fReason);
        });

        var head =
            '<div class="roc-toolbar">' +
                '<div class="roc-tb-left">' +
                    '<label class="roc-tb-label">연도</label>' +
                    '<select class="form-select" onchange="RSKOCC.setYear(+this.value)">' +
                        years.map(function (y) { return '<option value="' + y + '"' + (y === state.year ? ' selected' : '') + '>' + y + '년</option>'; }).join('') +
                    '</select>' +
                    '<label class="roc-tb-label" style="margin-left:12px;">사유</label>' +
                    '<select class="form-select" onchange="RSKOCC.setReason(this.value)">' +
                        '<option value="">전체</option>' +
                        Object.keys(D().OCC_REASONS).map(function (k) {
                            return '<option value="' + k + '"' + (state.fReason === k ? ' selected' : '') + '>' + esc(D().OCC_REASONS[k].label) + '</option>';
                        }).join('') +
                    '</select>' +
                '</div>' +
                '<div>' +
                    '<button type="button" class="btn btn-outline" onclick="RSKOCC.downloadForm()">📥 양식 다운로드 (HWPX)</button> ' +
                    (canRegister()
                        ? '<button type="button" class="btn btn-primary" data-tour="occ-create" onclick="RSKOCC.openReasonGate()">＋ 수시평가 등록</button>'
                        : '') +
                '</div>' +
            '</div>' +
            reasonGuideHtml();

        var rows = list.length ? list.map(rowHtml).join('') :
            /* 빈 상태는 표준 .v2-empty 로 (CLAUDE.md §7) — 화면마다 회색 문구를 새로 쓰지 않는다 */
            '<tr><td colspan="8"><div class="v2-empty">' + state.year + '년 수시 위험성평가가 없습니다.<br>' +
            '위 <b>실시 사유</b>에 해당하는 일이 생기면 [＋ 수시평가 등록]으로 시작하세요.</div></td></tr>';
        /* 7열이라 좁은 화면에서 내용 칸이 눌린다 — 표를 스크롤 래퍼에 넣고 최소폭을 준다 (CLAUDE.md §9-5) */
        var table =
            '<div class="roc-table-scroll"><table class="roc-table"><thead><tr>' +
                '<th style="width:104px;">발생일</th><th style="width:150px;">실시 사유</th>' +
                '<th style="width:120px;">부서</th><th style="min-width:200px;">내용 / 첨부</th>' +
                '<th style="width:170px;">개선조치</th>' +
                '<th style="width:190px;">안전관리자 검토</th>' +
                '<th style="width:88px;">상태</th><th style="width:76px;">관리</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>';

        state.mount.innerHTML = head + scopeNote() + table;
    }

    /* 화면 상단 안내 — 법령을 읽고 판단시키지 않고, 조문이 정한 6가지를 골라 쓰게 한다.
     * 근거 표기는 DYLAW 칩으로만 낸다(CLAUDE.md §10 — 근거를 문자열로 직접 쓰지 않는다). */
    function reasonGuideHtml() {
        var R = D().OCC_REASONS;
        var chip = window.DYLAW ? ' ' + DYLAW.basisChip(D().OCC_BASIS) : '';
        var items = Object.keys(R).map(function (k) {
            return '<li><b>' + esc(R[k].label) + '</b> — ' + esc(R[k].desc) + '</li>';
        }).join('');
        return '<div class="check-notice" style="margin-bottom:12px;">' +
            '<div style="font-weight:var(--fw-bold);">수시 위험성평가 실시 사유' + chip + '</div>' +
            '<p style="margin:4px 0 0;">아래 사유에 해당하면 수시 위험성평가를 실시해야 합니다. ' +
            '<b>[＋ 수시평가 등록]</b>을 누르면 먼저 해당 사유를 고르고, 그 사유에 맞춰 등록으로 넘어갑니다.</p>' +
            '<ul style="margin:6px 0 0;padding-left:18px;">' + items + '</ul>' +
        '</div>';
    }

    /* 개선조치 진행 — 수시평가를 '등록하고 끝'으로 두지 않기 위해 진행률을 같은 줄에 낸다.
       조치를 마무리하는 자리는 담당자의 [내 할일]이므로 그리로 바로 보낸다. */
    function impCell(o) {
        var c = D().occImpCount(o.id);
        if (!c.total) return '<span class="roc-imp-none">감소대책 없음</span>';
        var pct = Math.round(c.done / c.total * 100);
        var lbl = c.done === c.total ? '조치완료' : '조치중';
        return '<div class="roc-imp">' +
            '<div class="roc-imp-top">' +
                '<span class="chip-status ' + V().toneOf(lbl) + ' chip-sm">' + lbl + '</span>' +
                '<span class="roc-imp-n">' + c.done + ' / ' + c.total + '</span>' +
            '</div>' +
            '<div class="progress" role="img" aria-label="완료율 ' + pct + '퍼센트">' +
                '<div class="progress-bar green" style="width:' + pct + '%;"></div></div>' +
            '<div class="roc-imp-acts">' +
                /* 조치가 끝난 뒤 '무엇을 어떻게 고쳤는지'를 사진까지 보는 자리 —
                   정기평가 부서 상세와 같은 화면(IMPCARD)을 쓴다 (CLAUDE.md §7). */
                '<button type="button" class="btn btn-outline btn-sm" data-tour="occ-imp" onclick="RSKOCC.openImp(\'' + o.id + '\')">조치 상세</button>' +
                (c.done < c.total
                    ? '<a class="btn btn-primary btn-sm" href="my-work.html?dept=' + esc(o.deptId) +
                          '&cat=improve">내 할일에서 마무리 →</a>'
                    : '') +
            '</div>' +
        '</div>';
    }
    /* 수시평가 1건에서 나온 개선조치 상세 — 정기평가와 동일한 카드 화면 */
    function openImp(occId) {
        var o = D().occasionalOf(occId); if (!o) return;
        if (!global.IMPCARD) { toast('개선조치 상세 모듈을 불러오지 못했습니다.'); return; }
        var rMeta = D().OCC_REASONS[o.reason] || { label: o.reason };
        var files = (o.files || []).map(function (f) { return f.name; }).join(', ');
        IMPCARD.open({
            key: 'occ:' + occId,
            title: esc(o.id) + ' 조치 상세 — ' + esc(D().deptName(o.deptId)),
            metaHtml:
                '<span>발생일 <b>' + esc(o.date || '-') + '</b></span>' +
                '<span>실시 사유 <b>' + esc(rMeta.label) + '</b></span>' +
                (files ? '<span>첨부 <b>' + esc(files) + '</b></span>' : '') +
                (o.reviewFile
                    ? '<span>안전관리자 검토 <b>' + esc(o.reviewer || '안전관리자') + ' · ' + esc(o.reviewedAt || '-') + '</b></span>'
                    : '<span>안전관리자 검토 <b>미완료</b></span>'),
            noteHtml: '수시평가는 실시로 끝나지 않습니다 — <b>위험성 감소대책을 실행</b>해야 완결됩니다. ' +
                '부서 담당자는 <b>내 할일(my-work)</b>에서 완료 처리합니다.',
            emptyHtml: '이 수시평가에는 등록된 감소대책이 없습니다.',
            items: function () { return D().occImprovements(occId); },
            canRemind: false
        });
    }
    function rowHtml(o) {
        var rMeta = D().OCC_REASONS[o.reason] || { label: o.reason };
        var stChip = o.status === 'REVIEWED'
            ? '<span class="chip-mini st-done">검토완료</span>'
            : '<span class="chip-mini st-doing">등록됨</span>';
        var files = (o.files || []).map(function (f) { return f.name; }).join(', ');
        /* 안전관리자 검토 — 서명 파일이 붙으면 그 자체가 검토 완료다(외부 용역이라 전자결재 불가) */
        /* 검토 서명 첨부·해제는 주관부서 담당자만 — 다른 사람에게는 결과만 보인다 */
        var mayReview = canReview();
        var reviewCell = o.reviewFile
            ? '<div class="roc-files">📎 ' + esc(o.reviewFile) + '</div>' +
              '<div style="font-size:var(--fs-12);color:var(--text-gray);margin-top:2px;">' +
                  esc(o.reviewer || '안전관리자') + ' · ' + esc(o.reviewedAt || '-') + '</div>' +
              (mayReview ? ' <button type="button" class="btn btn-outline btn-sm" onclick="RSKOCC.clearReviewFile(\'' + o.id + '\')">해제</button>' : '')
            : (mayReview
                ? '<button type="button" class="btn btn-outline btn-sm" data-tour="occ-review" onclick="RSKOCC.openReviewFile(\'' + o.id + '\')">＋ 검토파일 등록</button>'
                : '<span style="color:var(--text-gray);font-size:var(--fs-12);">재난안전과 접수 대기</span>');
        return '<tr>' +
            '<td>' + esc(o.date || '-') + '</td>' +
            '<td><span class="roc-reason ' + o.reason + '">' + esc(rMeta.label) + '</span></td>' +
            '<td>' + esc(D().deptName(o.deptId)) + '</td>' +
            '<td><div>' + esc(o.desc || '-') + '</div>' +
                (files ? '<div class="roc-files">첨부 ' + esc(files) + '</div>' : '') + '</td>' +
            '<td>' + impCell(o) + '</td>' +
            '<td>' + reviewCell + '</td>' +
            '<td>' + stChip + '</td>' +
            '<td><button type="button" class="btn btn-outline btn-sm" onclick="RSKOCC.openView(\'' + o.id + '\')">이력</button></td>' +
        '</tr>';
    }

    function setYear(y) { state.year = y; render(); }
    function setReason(r) { state.fReason = r; render(); }

    /* =============== 실시 사유 선택 (등록 진입점) ===============
     * 발주처: "법 규정이 첫 번째가 들어가야지 눌렀을 때 그 해당 사항을 들어가야지만이
     *          수시 평가 등록을 할 수가 있어요."
     * 빈 등록 폼을 바로 열지 않고, 조문이 정한 6가지 사유 중 하나를 먼저 고르게 한다.
     * 단일 모달 규칙(CLAUDE.md §1) — 새 모달을 쌓지 않고 같은 모달의 본문을 등록 폼으로 교체한다. */
    function openReasonGate() {
        if (!canRegister()) { toast('수시평가 등록은 부서 담당자 본인이 수행합니다.'); return; }
        var R = D().OCC_REASONS;
        var chip = window.DYLAW ? ' ' + DYLAW.basisChip(D().OCC_BASIS) : '';
        var cards = Object.keys(R).map(function (k) {
            var r = R[k];
            return '<button type="button" class="roc-reason-pick" onclick="RSKOCC.openRegister(null, \'' + k + '\')">' +
                '<span class="roc-reason-no">' + r.no + '</span>' +
                '<span class="roc-reason-body"><b>' + esc(r.label) + '</b>' +
                    '<span class="roc-reason-desc">' + esc(r.desc) + '</span></span>' +
            '</button>';
        }).join('');
        V().openModal('수시 위험성평가 — 실시 사유 선택',
            '<p style="font-size:var(--fs-13);margin:0 0 10px;">어떤 사유로 수시평가를 실시하는지 먼저 고르세요.' + chip + '</p>' +
            '<div class="roc-reason-list">' + cards + '</div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>');
    }
    /* 양식 다운로드 — HWPX. 양식 안에 안전관리자 확인·서명란이 들어 있다. */
    function downloadForm() {
        toast('양식 다운로드: ' + D().OCC_FORM_FILE + ' (프로토타입 — 실제 파일은 미연결)');
    }

    /* =============== 등록 =============== */
    function openRegister(prefillDeptId, reason) {
        var depts = D().deptCandidates();
        /* 기본 부서는 로그인한 담당자의 소속 — 자기 부서 평가를 남의 부서로 올리는 사고를 줄인다 */
        var mine = global.DYROLE && global.DYROLE.deptId ? global.DYROLE.deptId() : '';
        F = {
            deptId: prefillDeptId || (mine && depts.some(function (d) { return d.id === mine; }) ? mine : '') ||
                    (depts[0] && depts[0].id) || '',
            reason: reason || 'ACCIDENT', date: D().today(), desc: '', files: [],
            /* 실시 결과 — 유해위험요인과 감소대책. 여기 적은 행이 개선조치가 된다. */
            hazards: [newHazard()],
            due: ''
        };
        renderRegister();
    }
    function newHazard() { return { name: '', cause: '', action: '', owner: '', beforePhotos: [] }; }

    /* ===== 실시 결과 행 — 요인 / 원인 / 감소대책 / 담당자 / 개선 전 사진 ===== */
    function hazRowHtml(h, i) {
        var photos = (h.beforePhotos || []);
        var thumbs = photos.map(function (f, n) {
            var src = f.thumb || f.url;
            return '<span class="roc-hz-shot">' +
                (src ? '<img src="' + esc(src) + '" alt="">' : '<span class="roc-hz-shot-x">파일</span>') +
                '<button type="button" class="roc-hz-shot-del" aria-label="' + esc(f.name) + ' 삭제"' +
                ' onclick="RSKOCC.hzDelPhoto(' + i + ',' + n + ')">×</button></span>';
        }).join('');
        return '<div class="roc-hz" data-i="' + i + '">' +
            '<div class="roc-hz-head"><span class="roc-hz-no">' + (i + 1) + '</span>' +
                '<button type="button" class="roc-hz-del" onclick="RSKOCC.hzDel(' + i + ')"' +
                ' aria-label="' + (i + 1) + '번 행 삭제">× 행 삭제</button></div>' +
            '<div class="roc-hz-grid">' +
                '<label class="form-label" for="roc-hz-n' + i + '">유해위험요인 <span class="roc-req">*</span></label>' +
                '<input type="text" class="form-input" id="roc-hz-n' + i + '" value="' + esc(h.name) + '"' +
                    ' placeholder="예: 정수장 개구부 추락 위험">' +
                '<label class="form-label" for="roc-hz-c' + i + '">원인</label>' +
                '<input type="text" class="form-input" id="roc-hz-c' + i + '" value="' + esc(h.cause) + '"' +
                    ' placeholder="예: 난간 미설치">' +
                '<label class="form-label" for="roc-hz-a' + i + '">위험성 감소대책 <span class="roc-req">*</span></label>' +
                '<textarea class="form-textarea" id="roc-hz-a' + i + '" rows="2"' +
                    ' placeholder="실제로 할 조치를 적으세요">' + esc(h.action) + '</textarea>' +
                '<label class="form-label">조치 담당자</label>' +
                '<div class="orgpick-field" id="roc-hz-of' + i + '">' +
                    '<div style="display:flex;gap:8px;">' +
                        '<input type="text" class="form-input" id="roc-hz-o' + i + '" readonly' +
                            ' placeholder="조직도에서 선택" style="flex:1;" value="' + esc(h.owner) + '">' +
                        '<button type="button" class="btn btn-outline"' +
                            ' onclick="RSKOCC.hzPickOwner(' + i + ')">조직도</button>' +
                    '</div></div>' +
                '<label class="form-label">개선 전 사진</label>' +
                '<div>' + (thumbs ? '<div class="roc-hz-shots">' + thumbs + '</div>' : '') +
                    V().uploadDrop('<b>개선 전 사진</b> <span style="font-size:var(--fs-12);color:var(--text-gray);">클릭 또는 끌어놓기</span>',
                        null, { pick: 'RSKOCC.hzPick' + i, multiple: true, style: 'padding:10px;' }) +
                '</div>' +
            '</div>' +
        '</div>';
    }
    function renderRegister() {
        var reasonOpts = Object.keys(D().OCC_REASONS).map(function (k) {
            return '<option value="' + k + '"' + (F.reason === k ? ' selected' : '') + '>' + esc(D().OCC_REASONS[k].label) + '</option>';
        }).join('');
        var fileList = F.files.length
            ? F.files.map(function (f, i) { return '<div style="font-size:12px;padding:3px 0;">' + esc(f.name) + ' <button type="button" style="border:none;background:none;color:var(--status-danger-fg);cursor:pointer;" onclick="RSKOCC.regDelFile(' + i + ')">×</button></div>'; }).join('')
            : '<div style="font-size:12px;color:var(--text-gray);">첨부 파일 없음</div>';
        var body =
            /* 부서 — 공용 인라인 조직도(ORGPICK)에서 선택 (단일 모달 규칙: 별도 모달 없이 입력 아래 펼침) */
            '<div class="roc-modal-row"><label class="form-label" for="roc-r-deptname">부서 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<div class="orgpick-field" id="roc-r-deptfield"><div style="display:flex;gap:8px;">' +
                    '<input type="text" class="form-input" id="roc-r-deptname" readonly placeholder="조직도에서 부서 선택" style="flex:1;" value="' + esc(F.deptId ? D().deptName(F.deptId) : '') + '">' +
                    '<button type="button" class="btn btn-outline" onclick="ORGPICK.toggle(\'roc-r-deptfield\',\'deptId\',\'RSKOCC.pickDept\')">조직도</button>' +
                '</div></div></div>' +
            '<div class="roc-modal-row"><label class="form-label" for="roc-r-reason">실시 사유 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<select class="form-select" id="roc-r-reason">' + reasonOpts + '</select>' +
                '<p class="file-hint">' + esc((D().OCC_REASONS[F.reason] || {}).desc || '') + '</p></div>' +
            /* 작성 양식은 담당자가 직접 위험도 계산표를 짜지 않게 하려고 제공한다 —
             * 발주처: "부서마다 이런 걸 작성을 못해요. 실질적으로 능력이 안 돼요." */
            '<div class="roc-modal-row"><label class="form-label">작성 양식</label>' +
                '<button type="button" class="btn btn-outline btn-sm" onclick="RSKOCC.downloadForm()">📥 ' + esc(D().OCC_FORM_FILE) + ' 다운로드</button>' +
                '<p class="file-hint">양식을 내려받아 작성한 뒤 아래 첨부파일로 올리세요. 양식에는 <b>안전관리자 확인·서명란</b>이 들어 있습니다.</p></div>' +
            '<div class="roc-modal-row"><label class="form-label">발생일 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="date" class="form-input" id="roc-r-date" value="' + esc(F.date) + '" style="max-width:200px;"></div>' +
            '<div class="roc-modal-row"><label class="form-label">내용 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<textarea class="form-textarea" id="roc-r-desc" rows="3" placeholder="사고·변경 사항의 경위와 필요한 위험성 재평가 요청 사항">' + esc(F.desc) + '</textarea></div>' +
            '<div class="roc-modal-row"><label class="form-label">첨부파일</label>' +
                '<div>' + fileList + '</div>' +
                '<button type="button" class="btn btn-outline btn-sm" style="margin-top:6px;" onclick="RSKOCC.regAddFile()">＋ 파일 첨부 (프로토타입)</button>' +
                V().fileHint() +
            '</div>' +
            /* 수시평가는 '실시했다'로 끝나지 않는다 — 감소대책을 수립·실행해야 완결된다.
             * 여기 적은 행이 그대로 개선조치가 되어 담당자의 [내 할일]에 뜬다. */
            '<div class="roc-modal-row roc-hz-sec">' +
                '<label class="form-label">실시 결과 — 유해위험요인과 감소대책 <span class="roc-req">*</span></label>' +
                '<p class="file-hint" style="margin-top:0;">여기 적은 행이 <b>개선조치</b>가 되어 담당자의 ' +
                    '<b>내 할일</b>에 뜹니다. 조치를 끝내고 <b>개선 후 사진</b>을 올리면 완료됩니다.</p>' +
                '<div id="roc-hz-list">' + F.hazards.map(hazRowHtml).join('') + '</div>' +
                '<button type="button" class="btn btn-outline btn-sm" onclick="RSKOCC.hzAdd()">＋ 요인 추가</button>' +
            '</div>' +
            '<div class="roc-modal-row"><label class="form-label" for="roc-r-due">조치기한</label>' +
                '<input type="date" class="form-input" id="roc-r-due" value="' + esc(F.due) + '" style="max-width:200px;">' +
                '<p class="file-hint">비워 두면 기한 없이 등록됩니다.</p></div>';
        V().openModal('수시 위험성평가 등록', body,
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="RSKOCC.doRegister()">등록</button>');
    }
    function regAddFile() {
        F.files.push({ name: '첨부_' + (F.files.length + 1) + '.pdf' });
        toast('파일 첨부 (프로토타입)'); renderRegister();
    }
    function regDelFile(i) { F.files.splice(i, 1); renderRegister(); }
    /* 조직도(ORGPICK 'deptId' 모드)에서 호출 — 표시는 부서명, 저장은 deptId */
    function pickDept(id, name) {
        F.deptId = id;
        var inp = document.getElementById('roc-r-deptname'); if (inp) inp.value = name;
    }
    function captureRegister() {
        /* 부서는 조직도 선택 시 F.deptId 에 이미 반영되어 있다(읽기전용 입력이라 DOM 에서 읽지 않는다) */
        var el = function (id) { return document.getElementById(id); };
        if (el('roc-r-reason')) F.reason = el('roc-r-reason').value;
        if (el('roc-r-date')) F.date = el('roc-r-date').value;
        if (el('roc-r-desc')) F.desc = (el('roc-r-desc').value || '').trim();
        if (el('roc-r-due')) F.due = el('roc-r-due').value;
        /* 재렌더 전에 반드시 부른다 — 안 그러면 사진 한 장 올릴 때마다 적어 둔 글이 날아간다 */
        F.hazards.forEach(function (h, i) {
            if (el('roc-hz-n' + i)) h.name = el('roc-hz-n' + i).value;
            if (el('roc-hz-c' + i)) h.cause = el('roc-hz-c' + i).value;
            if (el('roc-hz-a' + i)) h.action = el('roc-hz-a' + i).value;
            if (el('roc-hz-o' + i)) h.owner = el('roc-hz-o' + i).value;
        });
    }
    function hzAdd() {
        captureRegister();
        if (F.hazards.length >= 10) { toast('한 번에 최대 10건까지 등록합니다.'); return; }
        F.hazards.push(newHazard()); renderRegister();
    }
    function hzDel(i) {
        captureRegister();
        if (F.hazards.length <= 1) { toast('최소 1건은 있어야 합니다 — 내용을 지워서 비워 두세요.'); return; }
        F.hazards.splice(i, 1); renderRegister();
    }
    /* 담당자는 조직도(ORGPICK member)로만 고른다 — 모달 안이라 별도 모달을 띄우지 않고 필드 아래 펼친다 */
    function hzPickOwner(i) {
        captureRegister();
        window.ORGPICK && ORGPICK.toggle('roc-hz-of' + i, 'member', 'RSKOCC.hzOwnerPicked' + i);
    }
    function hzDelPhoto(i, n) {
        captureRegister();
        (F.hazards[i].beforePhotos || []).splice(n, 1); renderRegister();
    }
    /* uploadDrop/ORGPICK 은 전역 함수 경로 문자열을 부르므로 행 번호별 얇은 진입점을 만들어 둔다 */
    function wireHazardHooks() {
        for (var i = 0; i < 10; i++) (function (n) {
            global.RSKOCC['hzPick' + n] = function (files) {
                captureRegister();
                var h = F.hazards[n]; if (!h) return;
                h.beforePhotos = (h.beforePhotos || []).concat(files).slice(0, V().FILE_LIMITS.maxCount);
                renderRegister(); toast('개선 전 사진 ' + files.length + '건 첨부');
            };
            global.RSKOCC['hzOwnerPicked' + n] = function (v) {
                captureRegister();
                var h = F.hazards[n]; if (!h) return;
                h.owner = v; renderRegister();
            };
        })(i);
    }
    function doRegister() {
        if (!canRegister()) { toast('수시평가 등록은 부서 담당자 본인이 수행합니다.'); return; }
        captureRegister();
        if (!F.deptId || !F.reason || !F.date || !F.desc) { toast('부서·사유·발생일·내용을 모두 입력하세요.'); return; }
        var hz = F.hazards.filter(function (h) {
            return String(h.name || '').trim() && String(h.action || '').trim();
        });
        /* 요인만 적고 대책이 비면 '평가는 했는데 조치는 없는' 기록이 남는다 — 그 상태로 넘기지 않는다 */
        if (!hz.length) {
            toast('유해위험요인과 위험성 감소대책을 최소 1건 입력하세요.');
            var el = document.getElementById('roc-hz-n0'); if (el) el.focus();
            return;
        }
        var it = D().addOccasional({
            year: state.year, deptId: F.deptId, reason: F.reason,
            date: F.date, desc: F.desc, files: F.files,
            hazards: hz, due: F.due
        });
        V().closeModal();
        toast('수시평가 등록 · 개선조치 ' + hz.length + '건 생성 — [내 할일]에서 조치를 마무리하세요');
        render();
    }

    /* =============== 안전관리자 검토 ===============
     * 안전관리자가 외부 용역이라 시스템에 로그인해 직접 완료를 누를 수 없다.
     * 오프라인으로 검토·서명을 받아 온 파일을 담당자가 올리면 그 시점이 검토 완료다.
     * 시스템이 확인하지 못하는 부분(서명의 진위)은 감추지 않고 화면에 그대로 밝힌다. */
    function openReviewFile(id) {
        if (!canReview()) { toast('안전관리자 검토 서명은 주관부서(재난안전과) 담당자가 첨부합니다.'); return; }
        var o = D().occasionalOf(id); if (!o) return;
        V().openModal('안전관리자 검토파일 등록',
            '<p style="font-size:var(--fs-13);margin:0 0 8px;">' + esc(D().deptName(o.deptId)) + ' · ' + esc(o.date) + '</p>' +
            '<div class="check-notice" style="margin-bottom:10px;">담양군은 상시근로자 300명 미만이라 안전관리자를 <b>외부 용역</b>으로 두고 있어, ' +
                '안전관리자가 이 시스템에서 직접 검토 완료를 누를 수 없습니다. ' +
                '<b>서명받은 검토파일을 올리면 검토 완료로 처리</b>됩니다. 서명의 진위는 시스템이 확인하지 않습니다.</div>' +
            /* 실제 파일 선택 — DYV2.uploadDrop opts.pick (형식·용량 검증 포함) */
            V().uploadDrop(
                '<div style="font-weight:700;">클릭하여 안전관리자 서명 검토파일 선택</div>' +
                '<div style="font-size:var(--fs-12);color:var(--text-gray);margin-top:4px;">또는 파일을 이 영역에 끌어다 놓으세요</div>',
                null, { hint: true, pick: 'RSKOCC.onPickReview' }) +
            '<div id="roc-picked" class="rl-picked" aria-live="polite"></div>' +
            '<div class="roc-modal-row" style="margin-top:10px;"><label class="form-label" for="roc-rv-name">파일명</label>' +
                '<input type="text" class="form-input" id="roc-rv-name" value="' + esc(o.id + '_안전관리자검토_서명본.pdf') + '"></div>' +
            '<div class="roc-modal-row"><label class="form-label" for="roc-rv-by">안전관리자(검토자)</label>' +
                '<input type="text" class="form-input" id="roc-rv-by" placeholder="예: ○○안전기술원 김○○" style="max-width:280px;"></div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="RSKOCC.doReviewFile(\'' + id + '\')">등록 · 검토완료</button>');
    }
    /* uploadDrop(pick) 콜백 — 고른 파일명이 파일명 칸에 자동으로 들어간다 */
    function onPickReview(files) {
        var f = files && files[0]; if (!f) return;
        var el = document.getElementById('roc-rv-name');
        if (el) el.value = f.name;
        var slot = document.getElementById('roc-picked');
        if (slot) {
            var kb = f.size < 1048576 ? (f.size / 1024).toFixed(0) + 'KB' : (f.size / 1048576).toFixed(1) + 'MB';
            slot.innerHTML = '<span class="chip-status chip-sm success">선택됨</span> <b>' + esc(f.name) + '</b>' +
                ' <span class="rl-picked-size">' + kb + '</span>';
        }
        toast('파일 선택: ' + f.name);
    }
    function doReviewFile(id) {
        if (!canReview()) { toast('안전관리자 검토 서명은 주관부서(재난안전과) 담당자가 첨부합니다.'); return; }
        var nameEl = document.getElementById('roc-rv-name');
        var byEl = document.getElementById('roc-rv-by');
        var name = ((nameEl && nameEl.value) || '').trim();
        if (!name) { toast('파일명을 입력하세요.'); if (nameEl) nameEl.focus(); return; }
        D().setOccReviewFile(id, name, ((byEl && byEl.value) || '').trim());
        V().closeModal(); toast('안전관리자 검토파일 등록 · 검토완료 처리'); render();
    }
    function clearReviewFile(id) {
        if (!canReview()) { toast('안전관리자 검토 서명은 주관부서(재난안전과) 담당자가 첨부합니다.'); return; }
        D().setOccReviewFile(id, '');
        toast('검토파일 삭제 · 검토완료 해제'); render();
    }

    /* =============== 이력 =============== */
    function openView(id) {
        var o = D().occasionalOf(id); if (!o) return;
        var LABELS = { REGISTER:'등록', REVIEW:'검토', NOTIFY:'알림', STATUS:'상태변경' };
        var rows = (o.history || []).map(function (h) {
            return '<div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px dashed var(--card-line);font-size:13px;">' +
                '<span style="width:130px;font-size:12px;color:var(--text-gray);">' + esc(h.at) + '</span>' +
                '<span class="chip-mini st-doing" style="flex:none;">' + esc(LABELS[h.type] || h.type) + '</span>' +
                '<span style="flex:1;">' + esc(h.memo) + (h.by ? '<span style="font-size:var(--fs-12);color:var(--text-gray);margin-left:6px;">— ' + esc(h.by) + '</span>' : '') + '</span>' +
            '</div>';
        }).join('');
        V().openModal(esc(o.id) + ' 이력',
            '<div style="font-size:13px;color:var(--text-gray);margin-bottom:10px;">' +
                '부서 <b style="color:var(--text-black);">' + esc(D().deptName(o.deptId)) + '</b> · ' +
                '사유 <b style="color:var(--text-black);">' + esc((D().OCC_REASONS[o.reason] || {}).label || o.reason) + '</b> · ' +
                '발생일 <b style="color:var(--text-black);">' + esc(o.date) + '</b>' +
            '</div>' +
            '<div>' + rows + '</div>',
            '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal()">닫기</button>');
    }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        var q = new URLSearchParams(location.search);
        var yr = q.get('year'); if (yr) state.year = +yr;
        render();
        /* rsk-my에서 진입한 프리필 부서 */
        var pre = q.get('dept');
        if (q.get('new') === '1') openRegister(pre || '');
    }

    global.RSKOCC = {
        init: init, setYear: setYear, setReason: setReason,
        /* 등록은 반드시 실시 사유 선택을 거친다 (2026-07-30 회의) */
        openReasonGate: openReasonGate, downloadForm: downloadForm,
        openRegister: openRegister, pickDept: pickDept, regAddFile: regAddFile, regDelFile: regDelFile, doRegister: doRegister,
        /* 실시 결과 행 (유해위험요인 → 개선조치) */
        hzAdd: hzAdd, hzDel: hzDel, hzPickOwner: hzPickOwner, hzDelPhoto: hzDelPhoto,
        openImp: openImp,
        /* 안전관리자 검토 — 서명 파일 등록이 곧 검토 완료 */
        openReviewFile: openReviewFile, onPickReview: onPickReview, doReviewFile: doReviewFile, clearReviewFile: clearReviewFile,
        openView: openView
    };
    wireHazardHooks();   /* 행별 uploadDrop/ORGPICK 진입점을 RSKOCC 에 붙인다 */
})(window);
