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
                        ? '<button type="button" class="btn btn-primary" data-tour="occ-create" onclick="RSKOCC.openReasonGate()">＋ 수시평가 등록</button> '
                        : '') +
                    /* 시연 초기화 — 정기(rsk-list)에만 있어 수시를 반복 시연할 수 없었다.
                       초기화는 시연을 운전하는 주관부서 담당자만 한다(정기와 같은 원칙). */
                    (canReview()
                        ? '<button type="button" class="btn btn-outline btn-sm rl-reset-btn"' +
                          ' title="시연용 세션 데이터 초기화" onclick="RSKOCC.resetDemo()">↺ 시연 초기화</button>'
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
       조치를 마무리하는 자리는 **이 화면의 조치 상세 카드**다(2026-08-14). */
    /* 내가 완료 처리할 수 있는 미완료 조치가 이 건에 있는가 — 판정은 IMPCARD.canComplete
       한 곳이다. 목록 CTA 와 카드 안 버튼이 같은 기준을 봐야 한다:
       종전에는 미완료이기만 하면 '완료 처리'라고 써 놓아, 남의 부서 조치를 연 담당자에게
       약속한 버튼이 카드에 없었다. */
    function myCompletable(occId) {
        if (!global.IMPCARD || !IMPCARD.canComplete) return false;
        return (D().occImprovements(occId) || []).some(function (m) { return IMPCARD.canComplete(m); });
    }
    function impCell(o) {
        var c = D().occImpCount(o.id);
        if (!c.total) return '<span class="roc-imp-none">감소대책 없음</span>';
        var mineTodo = c.done < c.total && myCompletable(o.id);
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
                /* 미완료 건도 **이 화면 안에서** 끝낸다 (2026-08-14 발주처 지시) —
                   개선조치는 독립 메뉴가 아니므로 rsk-imp 대장으로 내보내지 않는다.
                   같은 IMPCARD 카드에 그 부서 담당자용 [완료 처리]가 이미 붙는다. */
                '<button type="button" class="btn ' + (mineTodo ? 'btn-primary' : 'btn-outline') +
                    ' btn-sm" data-tour="occ-imp" onclick="RSKOCC.openImp(\'' + o.id + '\')">' +
                    (mineTodo ? '조치 상세 · 완료 처리' : '조치 상세') + '</button>' +
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
                '그 부서 담당자는 <b>이 카드에서 바로</b> 완료 처리하며, 같은 건을 <b>내 할일</b>에서 올려도 같은 곳에 쌓입니다.',
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
                /* 재해 건은 작업 재개 예정일이 곧 법정 기한이다 — 목록에서 바로 보여야
                   담당자가 "언제까지 끝내야 하는지"를 열어보지 않고 안다 */
                (o.resumeDate
                    ? '<div class="roc-acc-line"><b>작업 재개 예정 ' + esc(o.resumeDate) + '</b>' +
                      ' <span>그 전까지 평가 완료</span></div>' : '') +
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

    /* ===== 시연 초기화 =====
     * DYRSK.reset() 은 **정기·수시·개선조치를 한 저장소에서 함께** 되돌린다.
     * 수시 화면에서 눌렀는데 정기 진행분까지 사라지면 놀라므로 미리 밝힌다. */
    function resetDemo() {
        if (!canReview()) { toast('시연 초기화는 주관부서(재난안전과) 담당자만 수행합니다.'); return; }
        V().openModal('시연 데이터 초기화',
            '<p style="font-size:var(--fs-13);line-height:1.6;">위험성평가 세션 데이터를 초기 시연 상태로 되돌립니다.</p>' +
            '<p style="font-size:var(--fs-13);line-height:1.6;margin-top:8px;">' +
                '<b>수시평가뿐 아니라 정기 위험성평가·개선조치도 함께</b> 초기화됩니다 — ' +
                '한 저장소를 쓰기 때문입니다. 2026년 진행 내역이 모두 사라지고 ' +
                '<b>초기 시연 상태</b>(2026 미등록 · 2025 완료)로 복귀합니다.</p>' +
            '<p style="font-size:var(--fs-12);color:var(--text-gray);margin-top:8px;">진행 중인 시연 가이드도 함께 종료됩니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="RSKOCC.doResetDemo()">초기화</button>');
    }
    function doResetDemo() {
        if (!canReview()) { toast('시연 초기화는 주관부서(재난안전과) 담당자만 수행합니다.'); return; }
        D().reset();
        V().closeModal();
        state.fReason = '';
        /* 투어 커서·고정 관점도 함께 되돌린다 — 데이터만 지우면 패널이 마지막 단계를
           가리킨 채 남아 두 번째 시연이 끝에서 시작하는 것처럼 보인다. */
        ['OCCTOUR', 'RSKTOUR'].forEach(function (n) {
            var t = global[n];
            if (t && t.active && t.active()) t.stop();
        });
        toast('시연 데이터 초기화 완료 · 2026년 미등록 상태로 복귀');
        render();
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
            accident: '', resumeDate: '',   /* 재해 사유 전용 (고시 §15② 5호 단서) */
            /* 실시 결과 — 유해위험요인과 감소대책. 여기 적은 행이 개선조치가 된다. */
            hazards: [newHazard()],
            due: ''
        };
        renderRegister();
    }
    /* 시설물(facilNo·facilNm)은 선택 항목이다 — 수시평가 사유 6종 중 '건설물의 설치·이전·변경·해체'와
     * '기계·설비 등의 정비 또는 보수'는 애초에 시설물이 원인이라 정기평가보다 오히려 결합도가 높다.
     * 잇는 키는 이름이 아니라 시설물번호다(동명 시설물·개명 대비). 정기 검수 행과 같은 규칙. */
    /* 시설물 축은 **세 상태**다 — 지정 / 해당 없음(확인 결과 붙지 않음) / 미지정(아직 판단 안 함).
     * 정기 검수 행(rsk-list)과 같은 규칙이며, 둘이 같은 개선조치 테이블로 흘러가므로
     * 어긋나면 개선조치에서 빈 값의 뜻을 정할 수 없다. 종전에는 수시만 2상태여서
     * **미입력을 '해당 없음'이라는 판단으로 단정**했다 — 이 프로젝트가 다른 축에서
     * 명시적으로 금지한 실패 모드다(부서 이행 체크의 '해당 없음' 사유 강제와 같은 근거). */
    function newHazard() { return { name: '', cause: '', action: '', owner: '', facilNo: '', facilNm: '', facilNa: false, beforePhotos: [] }; }

    /* 재해 발생(고시 §15② 5호)만 추가 필수 항목을 둔다 (docs/planning/확정-미결사항… §2)
       5호에는 다른 사유에 없는 단서가 붙어 있다 —
         "재해발생 작업을 대상으로 **작업을 재개하기 전에** 실시하여야 한다"
       작업 재개 시점이 법정 기한이므로 그 날짜를 남기지 않으면 기한을 셀 수 없고,
       무엇 때문에 멈춘 작업인지도 함께 있어야 재개 판단을 소명할 수 있다.
       다른 사유에는 붙이지 않는다 — 없는 요건을 만들면 등록이 무거워질 뿐이다. */
    function isAccident() { return F && F.reason === 'ACCIDENT'; }
    function accidentRowsHtml() {
        if (!isAccident()) return '';
        return '<div class="roc-modal-row roc-acc-note">' +
                '<b>재해 발생 건은 작업을 재개하기 전에 평가를 마쳐야 합니다.</b> ' +
                '<span>위험성평가 고시 §15② 단서 — 다른 사유에는 없는 요건입니다.</span></div>' +
            '<div class="roc-modal-row"><label class="form-label" for="roc-r-acc">재해 개요 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<textarea class="form-textarea" id="roc-r-acc" rows="2"' +
                    ' placeholder="언제·어디서·누가·어떻게 다쳤는지와 멈춘 작업">' + esc(F.accident || '') + '</textarea></div>' +
            '<div class="roc-modal-row"><label class="form-label" for="roc-r-resume">작업 재개 예정일 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="date" class="form-input" id="roc-r-resume" value="' + esc(F.resumeDate || '') + '" style="max-width:200px;">' +
                '<p class="file-hint">이 날짜 전까지 평가를 마쳐야 합니다.</p></div>';
    }

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
                '<label class="form-label">시설물</label>' +
                '<div class="orgpick-field" id="roc-hz-ff' + i + '">' +
                    /* 입력과 버튼을 한 줄에 두면 세 상태를 오가는 버튼 두 개가 자리를 먹어
                       시설물명이 들어갈 폭이 90px 남짓밖에 안 된다 — 이름을 못 읽는다.
                       입력은 한 줄을 통째로 쓰고 버튼은 그 아래로 내린다(좁은 화면에서도 같다). */
                    '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
                        '<input type="text" class="form-input" id="roc-hz-fn' + i + '" readonly' +
                            ' placeholder="미지정 — 아직 판단하지 않음" style="flex:1 1 100%;"' +
                            ' value="' + esc(h.facilNo ? (h.facilNm || h.facilNo) : (h.facilNa ? '해당 없음' : '')) + '">' +
                        /* 세 상태를 오갈 수 있어야 한다 — 잘못 고른 것도, 잘못 '해당 없음' 한 것도
                           미지정으로 되돌아갈 길이 있어야 판단을 취소할 수 있다. */
                        (h.facilNo || h.facilNa
                            ? '<button type="button" class="btn btn-outline" onclick="RSKOCC.hzClearFacil(' + i + ')">미지정으로</button>'
                            : '<button type="button" class="btn btn-outline" onclick="RSKOCC.hzNaFacil(' + i + ')">해당 없음</button>') +
                        (h.facilNo
                            ? ''
                            : '<button type="button" class="btn btn-outline" onclick="RSKOCC.hzPickFacil(' + i + ')">시설물 대장</button>') +
                    '</div></div>' +
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
                /* 재해 사유를 고르면 전용 필수 칸이 나타나야 하므로 그 자리에서 다시 그린다.
                   재렌더 전 captureRegister() 로 적어 둔 값을 반드시 보존한다. */
                '<select class="form-select" id="roc-r-reason" onchange="RSKOCC.onReasonChange()">' + reasonOpts + '</select>' +
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
            accidentRowsHtml() +
            '<div class="roc-modal-row"><label class="form-label">첨부파일</label>' +
                '<div>' + fileList + '</div>' +
                '<button type="button" class="btn btn-outline btn-sm" style="margin-top:6px;" onclick="RSKOCC.regAddFile()">＋ 파일 첨부 (프로토타입)</button>' +
                V().fileHint() +
            '</div>' +
            /* 수시평가는 '실시했다'로 끝나지 않는다 — 감소대책을 수립·실행해야 완결된다.
             * 여기 적은 행이 그대로 개선조치가 되어 담당자의 [개선조치] 목록에 뜬다. */
            '<div class="roc-modal-row roc-hz-sec">' +
                '<label class="form-label">실시 결과 — 유해위험요인과 감소대책 <span class="roc-req">*</span></label>' +
                '<p class="file-hint" style="margin-top:0;">여기 적은 행이 <b>개선조치</b>가 되어 담당자의 ' +
                    '<b>개선조치</b> 목록에 뜹니다. 조치를 끝내고 <b>개선 후 사진</b>을 올리면 완료됩니다.</p>' +
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
    function onReasonChange() { captureRegister(); renderRegister(); }
    function captureRegister() {
        /* 부서는 조직도 선택 시 F.deptId 에 이미 반영되어 있다(읽기전용 입력이라 DOM 에서 읽지 않는다) */
        var el = function (id) { return document.getElementById(id); };
        if (el('roc-r-reason')) F.reason = el('roc-r-reason').value;
        if (el('roc-r-date')) F.date = el('roc-r-date').value;
        if (el('roc-r-desc')) F.desc = (el('roc-r-desc').value || '').trim();
        if (el('roc-r-due')) F.due = el('roc-r-due').value;
        if (el('roc-r-acc')) F.accident = (el('roc-r-acc').value || '').trim();
        if (el('roc-r-resume')) F.resumeDate = el('roc-r-resume').value;
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
    /* 시설물 지정 — 정기 검수 행과 같은 GUI(DYFACIL 인라인 대장). 새 창을 겹치지 않는다. */
    function hzPickFacil(i) {
        if (!global.DYFACIL) { toast('시설물 대장을 불러오지 못했습니다.'); return; }
        DYFACIL.toggle('roc-hz-ff' + i, 'RSKOCC.hzSetFacil' + i);
    }
    function hzSetFacil(i, no, nm) {
        var h = F.hazards[i]; if (!h) return;
        h.facilNo = no; h.facilNm = nm || (global.DYFACIL ? DYFACIL.label(no) : '');
        h.facilNa = false;   /* 지정하면 '해당 없음'은 자동으로 풀린다 — 둘은 배타다 */
        renderRegister();
        toast('시설물 지정: ' + (h.facilNm || no));
    }
    function hzNaFacil(i) {
        var h = F.hazards[i]; if (!h) return;
        h.facilNo = ''; h.facilNm = ''; h.facilNa = true;
        renderRegister(); toast('시설물 해당 없음으로 표시');
    }
    function hzClearFacil(i) {
        var h = F.hazards[i]; if (!h) return;
        h.facilNo = ''; h.facilNm = ''; h.facilNa = false;
        renderRegister(); toast('미지정으로 되돌림');
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
            /* 시설물 선택 콜백 — DYFACIL.toggle 이 (시설물번호, 시설물명) 으로 부른다 */
            global.RSKOCC['hzSetFacil' + n] = function (no, nm) {
                captureRegister();
                hzSetFacil(n, no, nm);
            };
        })(i);
    }
    function doRegister() {
        if (!canRegister()) { toast('수시평가 등록은 부서 담당자 본인이 수행합니다.'); return; }
        captureRegister();
        if (!F.deptId || !F.reason || !F.date || !F.desc) { toast('부서·사유·발생일·내용을 모두 입력하세요.'); return; }
        /* 재해 건은 작업 재개 시점이 곧 법정 기한이라 비워 두면 기한을 셀 수 없다 */
        if (isAccident()) {
            if (!F.accident) { toast('재해 개요를 입력하세요.'); var a = document.getElementById('roc-r-acc'); if (a) a.focus(); return; }
            if (!F.resumeDate) { toast('작업 재개 예정일을 입력하세요 — 그 전까지 평가를 마쳐야 합니다.'); var r2 = document.getElementById('roc-r-resume'); if (r2) r2.focus(); return; }
        }
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
            accident: F.accident, resumeDate: F.resumeDate,
            /* 원본에는 **적은 그대로** 남긴다 — 개선조치는 요인·대책이 모두 채워진
               행에서만 생기지만(addOccasional 내부에서 다시 거른다), 부분 입력 행을
               저장 단계에서 지워 버리면 담당자가 적어 둔 내용이 소리 없이 사라진다. */
            hazards: F.hazards, due: F.due
        });
        V().closeModal();
        toast('수시평가 등록 · 개선조치 ' + hz.length + '건 생성 — 목록의 [조치 상세]에서 조치를 마무리하세요');
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
                '<input type="text" class="form-input" id="roc-rv-by" placeholder="예: ○○안전기술원 김○○" style="max-width:280px;"></div>' +
            /* 검토일은 업로드일과 다르다 — 외부 용역이 검토를 마친 날을 적는다.
               비워 두면 등록일로 기록되며 그 사실을 안내로 밝힌다. */
            '<div class="roc-modal-row"><label class="form-label" for="roc-rv-at">검토일</label>' +
                '<input type="date" class="form-input" id="roc-rv-at" value="' + esc(o.reviewedAt || '') + '" style="max-width:200px;">' +
                '<span class="file-hint">안전관리자가 검토를 마친 날입니다. 비워 두면 오늘 등록일로 기록됩니다.</span></div>',
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
        var atEl = document.getElementById('roc-rv-at');
        var name = ((nameEl && nameEl.value) || '').trim();
        if (!name) { toast('파일명을 입력하세요.'); if (nameEl) nameEl.focus(); return; }
        /* 이 단계가 남기는 것은 '누가 검토했는가'다 — 이름 없이 검토완료로 넘기면
           외부 용역 안전관리자의 검토 사실을 소명할 수 없고, 이력에도 '안전관리자'
           라는 총칭만 남는다. 파일명과 같은 강도로 막는다. */
        var by = ((byEl && byEl.value) || '').trim();
        if (!by) { toast('검토한 안전관리자 이름을 입력하세요.'); if (byEl) byEl.focus(); return; }
        D().setOccReviewFile(id, name, by, ((atEl && atEl.value) || '').trim());
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
        openReasonGate: openReasonGate, downloadForm: downloadForm, onReasonChange: onReasonChange,
        resetDemo: resetDemo, doResetDemo: doResetDemo,
        openRegister: openRegister, pickDept: pickDept, regAddFile: regAddFile, regDelFile: regDelFile, doRegister: doRegister,
        /* 실시 결과 행 (유해위험요인 → 개선조치) */
        hzAdd: hzAdd, hzDel: hzDel, hzPickOwner: hzPickOwner, hzDelPhoto: hzDelPhoto,
        /* 행 시설물 — FMS 시설물 대장(SCR-FAC-001) 연계. 선택 항목이다 */
        hzPickFacil: hzPickFacil, hzClearFacil: hzClearFacil, hzNaFacil: hzNaFacil,
        openImp: openImp,
        /* 안전관리자 검토 — 서명 파일 등록이 곧 검토 완료 */
        openReviewFile: openReviewFile, onPickReview: onPickReview, doReviewFile: doReviewFile, clearReviewFile: clearReviewFile,
        openView: openView
    };
    wireHazardHooks();   /* 행별 uploadDrop/ORGPICK 진입점을 RSKOCC 에 붙인다 */
})(window);
