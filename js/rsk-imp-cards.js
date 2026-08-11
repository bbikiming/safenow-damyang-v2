/* =====================================================================
   rsk-imp-cards.js · 개선조치 상세 카드 (전역 IMPCARD)
   · 정기평가 부서 상세(rsk-list)와 수시평가 조치 상세(rsk-occ)가 **같은 화면**을 쓴다.
     화면마다 카드를 다시 짜면 한쪽만 고쳐지고 다른 쪽이 조용히 뒤처진다 (CLAUDE.md §7).
   · 표가 아니라 카드인 이유: 건마다 개선 전·후 사진이 붙어 6열 표로는 좁은 폭에서
     못 읽고, 전·후 '대조'가 표의 한 칸으로 묻힌다.
   · 사진 확대는 카드 안 인라인 (모달 적층 금지, §1).
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYRSK; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function basisHtml(h) {
        var b = h && h.basis;
        if (!b) return '';   /* 근거는 선택 항목 — 없으면 자리 자체를 만들지 않는다 */
        return global.DYLAW ? DYLAW.basisChip(b) : '<span class="law-basis-plain">' + esc(b) + '</span>';
    }
    function fmtSize(n) {
        if (!n && n !== 0) return '';
        return n < 1048576 ? (n / 1024).toFixed(0) + 'KB' : (n / 1048576).toFixed(1) + 'MB';
    }

    /* CTX — 열려 있는 상세 {key, title, metaHtml, noteHtml, items(), canRemind, onRemind}
       filter/open 은 재렌더 사이에 유지되어야 하는 화면 상태다. */
    var CTX = null;

    /* 사진 배열 — 신규는 객체(썸네일 보유), 옛 데이터는 파일명 문자열/불리언이다.
       옛 값도 '있었다'는 사실은 남기고 미리보기만 없다고 밝힌다. */
    function photoItems(m, kind) {
        var arr = (kind === 'before' ? m.before_photos : m.after_photos) || [];
        if (arr.length) return arr;
        var legacy = kind === 'before' ? m.before_photo : m.after_photo;
        if (typeof legacy === 'string' && legacy.trim()) {
            return legacy.split(',').map(function (s) { return { name: s.trim() }; });
        }
        if (legacy === true) return [{ name: '(파일명 미기록)' }];
        return [];
    }
    function impStatus(m, overdue) {
        if (m.status === 'DONE') return '완료';
        return overdue ? '기한초과' : (m.status === 'IN_PROGRESS' ? '진행중' : '예정');
    }

    function shotHtml(m, kind, f, n) {
        var src = f.thumb || f.url;
        var key = m.id + ':' + kind + ':' + n;
        var sel = CTX && CTX.open === key;
        /* 볼 수 없는 첨부(옛 시드·비이미지)는 버튼으로 만들지 않는다 —
           눌러도 아무 일이 없는 버튼은 없는 기능을 약속하는 것이다. */
        if (!src) {
            return '<span class="rl-imp-shot is-plain" title="' + esc(f.name) + '">' +
                '<span class="rl-imp-shot-x">미리보기 없음</span></span>';
        }
        return '<button type="button" class="rl-imp-shot' + (sel ? ' is-open' : '') + '"' +
            ' onclick="IMPCARD.shot(\'' + esc(key) + '\')" aria-expanded="' + (sel ? 'true' : 'false') + '"' +
            ' aria-label="' + esc(f.name) + ' 크게 보기"><img src="' + esc(src) + '" alt=""></button>';
    }
    function shotViewHtml(m) {
        if (!CTX || !CTX.open || CTX.open.indexOf(m.id + ':') !== 0) return '';
        var p = CTX.open.split(':');
        var f = (photoItems(m, p[1]) || [])[Number(p[2])];
        var full = f && (f.url || f.thumb);
        if (!full) return '';
        var dim = f.w && f.h ? f.w + '×' + f.h + 'px · ' : '';
        return '<figure class="rl-imp-view">' +
            '<img src="' + esc(full) + '" alt="' + esc(f.name) + '"' +
                (f.thumb && f.thumb !== full ? ' onerror="this.onerror=null;this.src=\'' + esc(f.thumb) + '\'"' : '') + '>' +
            '<figcaption><b>' + (p[1] === 'before' ? '개선 전' : '개선 후') + '</b> ' + esc(f.name) +
                '<span class="rl-imp-view-meta">' + dim + (f.size ? fmtSize(f.size) : '') + '</span>' +
                '<button type="button" class="btn btn-outline btn-sm" onclick="IMPCARD.shot(\'\')">닫기</button>' +
            '</figcaption></figure>';
    }
    function sideHtml(m, kind) {
        var items = photoItems(m, kind);
        var lab = kind === 'before' ? '개선 전' : '개선 후';
        var body = items.length
            ? '<div class="rl-imp-shots">' + items.map(function (f, n) { return shotHtml(m, kind, f, n); }).join('') + '</div>'
            : '<div class="rl-imp-shots"><span class="rl-imp-shot is-empty">' +
                  '<span class="rl-imp-shot-x">' + (kind === 'after' ? '미제출' : '없음') + '</span></span></div>';
        return '<div class="rl-imp-side' + (kind === 'after' && !items.length ? ' is-missing' : '') + '">' +
            '<div class="rl-imp-side-lab">' + lab +
                (items.length > 1 ? ' <span class="rl-imp-side-n">' + items.length + '장</span>' : '') + '</div>' +
            body + '</div>';
    }
    /* 전·후 둘 다 없으면 빈 상자 두 개로 200px 를 낭비하지 않는다 — 한 줄로 사실만 말한다 */
    function pairHtml(m) {
        var b = photoItems(m, 'before').length, a = photoItems(m, 'after').length;
        if (!b && !a) return '<p class="rl-imp-nopair">증빙 사진 없음 — 개선 전·후 모두 미제출</p>';
        return '<div class="rl-imp-pair">' + sideHtml(m, 'before') + sideHtml(m, 'after') + '</div>';
    }
    function impCard(m, no) {
        var overdue = D().isOverdue(m);
        var lbl = impStatus(m, overdue);
        var sig = m.signature || {};
        var basis = m.hazard && m.hazard.basis;
        var meta = [];
        /* 시설물 — 조치하러 갈 대상을 담당자가 알아야 개선 전·후 사진을 찍으러 간다.
           미지정은 줄을 만들지 않는다(시설물에 붙지 않는 요인이 정상적으로 있다). */
        var facil = D().facilLabel ? D().facilLabel(m) : '';
        if (facil) meta.push('<span>시설물 <b>' + esc(facil) + '</b></span>');
        if (m.hazard && m.hazard.category) meta.push('<span>분류 <b>' + esc(m.hazard.category) + '</b></span>');
        meta.push('<span>담당자 <b>' + (m.assigned_to ? esc(m.assigned_to) : '미지정') + '</b></span>');
        /* 기한이 없는 건은 '-' 로 뭉개지 않는다 — 수시평가는 조치기한이 선택이라 실제로 생긴다.
           '-' 는 값이 비었다는 뜻으로도 읽혀 확인이 필요한 상태라는 사실이 묻힌다. */
        var dueTxt = m.due || m.due_date;
        meta.push('<span>기한 <b class="' + (overdue ? 'rl-overdue' : '') + '">' + (dueTxt ? esc(dueTxt) : '미지정') + '</b></span>');
        /* 담당자·기한 변경 — **권한이 두 갈래다** (발주처 2026-08-06)
             담당자 = 그 부서가 정한다. 재난안전과가 남의 부서 누가 할지 지정하는 것은
                     월권이고, 실제로 누가 적임인지도 그 부서가 안다.
             기한   = 주관부서가 정한다. 부서가 스스로 미루면 관리가 무너진다.
           완료된 건은 어느 쪽도 바꾸지 않는다(끝난 일을 고치는 건 기록 조작이다). */
        if (amendKind(m) && m.status !== 'DONE') {
            meta.push('<button type="button" class="rl-imp-amend" onclick="IMPCARD.amendOpen(\'' + esc(m.id) + '\')">' +
                (amendKind(m) === 'owner' ? '담당자 지정' : '변경') + '</button>');
        }
        if (amendLogHtml(m)) meta.push(amendLogHtml(m));
        return '<article class="rl-imp-card' + (overdue ? ' is-overdue' : '') + '">' +
            '<header class="rl-imp-card-head">' +
                '<span class="rl-imp-no">' + no + '</span>' +
                '<h4 class="rl-imp-title">' + esc((m.hazard && m.hazard.name) || m.hazard_risk_factor || '-') + '</h4>' +
                '<span class="chip-status ' + V().toneOf(lbl) + ' chip-sm">' + lbl + '</span>' +
            '</header>' +
            '<p class="rl-imp-metaline">' + meta.join('') + '</p>' +
            (basis ? '<p class="rl-imp-basis">' + basisHtml(m.hazard) + '</p>' : '') +
            '<p class="rl-imp-action">' + esc(m.description || m.action || '-') + '</p>' +
            pairHtml(m) +
            shotViewHtml(m) +
            confirmBar(m) +
            '<footer class="rl-imp-foot">' +
                (m.status === 'DONE'
                    ? '<span class="rl-imp-done">완료 ' + esc(m.completed_date || '-') +
                          (sig.by ? ' · 전자서명 <b>' + esc(sig.by) + '</b>' : '') + '</span>' +
                      (m.action_content ? '<span class="rl-imp-donetxt">' + esc(m.action_content) + '</span>' : '')
                    : '<span class="rl-imp-todo">' + (photoItems(m, 'after').length
                          ? '개선 후 사진 제출됨 — 완료 확인 대기'
                          : '개선 후 사진 미제출 — 완료 소명 불가') + '</span>') +
                (overdue && CTX.canRemind && CTX.onRemind
                    ? '<button type="button" class="btn btn-outline btn-sm rl-imp-remind" onclick="' +
                          esc(CTX.onRemind) + '(\'' + m.id + '\')">재촉</button>'
                    : '') +
            '</footer>' +
        '</article>';
    }

    /* ===== 조치 완료 확인 (재난안전과) =====
     * 부서가 올린 증빙을 실제로 열어보고 확인/반려한다. 이 단계가 없으면 부서의
     * 자기 선언이 곧 평가 완료가 된다. 새 모달을 띄우지 않고 카드 안에서 펼친다(§1). */
    function cfmState(m) {
        try { return D().confirmState(m); } catch (e) { return ''; }
    }
    function cfmInfo(m) {
        try { return D().confirmOf(m); } catch (e) { return { state: 'WAIT', round: 1 }; }
    }
    function confirmBar(m) {
        /* 미완료 건 — **그 부서 담당자면 여기서 바로 완료 처리한다.**
           종전에는 완료 등록 경로가 '내 할일' 하나뿐이라, 위험성평가 화면에서
           개선조치를 보다가 처리하려면 화면을 옮겨야 했다(발주처 지적).
           MYWORK 이 있는 화면(내 할일)에서는 그 화면의 버튼이 이미 하므로 중복을 피한다. */
        if (m.status !== 'DONE') {
            if (amendKind(m) === 'owner' && global.MYWORK && global.MYWORK.complete
                && !/my-work\.html$/.test(location.pathname)) {
                return '<div class="rl-imp-doact">' +
                    '<button type="button" class="btn btn-primary btn-sm"' +
                    ' onclick="MYWORK.completeFrom(\'' + esc(m.id) + '\')">완료 처리</button>' +
                    '<span class="rl-imp-doact-note">이 부서 담당자가 조치 결과를 등록합니다.</span>' +
                '</div>';
            }
            return '';
        }
        var st = cfmState(m); if (!st) return '';
        var c = cfmInfo(m);
        var locked = global.DYRSKDOC && m.assessment_id ? DYRSKDOC.lockOf(m.assessment_id) : null;
        var out = '';

        /* 반려 배너 — 담당자·확인자 양쪽 화면에 상시 뜬다. 무엇을 왜 다시 해야 하는지가
           도착하지 않으면 반려가 작동하지 않는다. */
        if (st === 'RETURNED') {
            out += '<div class="rl-imp-return" role="note">' +
                '<b>확인 반려</b> · ' + esc(c.at || '') + ' · ' + esc(c.by || '재난안전과') +
                (c.round > 1 ? ' <span class="rl-imp-round">' + c.round + '회차 제출</span>' : '') +
                '<p>' + esc(c.reason || '') + '</p>' +
                '<span class="rl-imp-return-how">담당자가 <b>완료 처리</b>를 다시 하면 확인 대기로 돌아갑니다.</span>' +
            '</div>';
        } else if (st === 'OK') {
            out += '<div class="rl-imp-cfm-ok">확인 ' + esc(c.at || '') + ' · ' + esc(c.by || '재난안전과') +
                (c.round > 1 ? ' <span class="rl-imp-round">' + c.round + '회차 제출분</span>' : '') + '</div>';
        }

        if (!CTX.canConfirm) return out;

        if (locked) {
            out += '<div class="rl-imp-cfm-lock">🔒 공문 상신됨(' + esc(locked) + ') — 확인 결과를 변경할 수 없습니다.</div>';
            return out;
        }
        if (st === 'OK') {
            out += '<div class="rl-imp-cfm-acts">' +
                '<button type="button" class="btn btn-outline btn-sm" onclick="IMPCARD.cfmCancel(\'' + esc(m.id) + '\')">확인 취소</button>' +
            '</div>';
            return out;
        }
        /* 확인 대기 · 반려 상태 — 인라인 패널 토글 */
        var openNow = CTX.cfmOpen === m.id;
        out += '<div class="rl-imp-cfm-acts">' +
            '<button type="button" class="btn btn-primary btn-sm" onclick="IMPCARD.cfmToggle(\'' + esc(m.id) + '\')"' +
            ' aria-expanded="' + (openNow ? 'true' : 'false') + '">' +
            (openNow ? '확인 닫기' : (st === 'RETURNED' ? '재확인' : '완료 확인')) + '</button>' +
        '</div>';
        if (openNow) out += confirmPanel(m);
        return out;
    }
    function confirmPanel(m) {
        var before = photoItems(m, 'before').length, after = photoItems(m, 'after').length;
        var sig = m.signature || {};
        var c = cfmInfo(m);
        var showReturn = CTX.cfmReturn === m.id;
        /* 재제출 건이면 직전 파일명과 같은지 알려 준다 — 막지는 않는다(같은 이름으로
           재촬영했을 수 있다). 확인자가 판단할 재료만 준다. */
        var sameName = '';
        if (c.round > 1 && (m.after_photos || []).length) {
            sameName = '<p class="rl-imp-cfm-warn">재제출 건입니다 — 개선 후 사진이 실제로 교체되었는지 확인하세요.</p>';
        }
        return '<div class="rl-imp-cfm">' +
            '<div class="rl-imp-cfm-head"><b>완료 확인</b> <span class="rl-imp-cfm-sub">증빙을 열어 본 뒤 확인하거나 반려합니다.</span></div>' +
            '<ul class="rl-imp-cfm-list">' +
                '<li>개선 전 <b>' + before + '장</b> · 개선 후 <b>' + after + '장</b></li>' +
                '<li>완료일 <b>' + esc(m.completed_date || '-') + '</b>' +
                    (sig.by ? ' · 전자서명 <b>' + esc(sig.by) + '</b>' : '') + '</li>' +
                (m.action_content ? '<li>조치 내용 ' + esc(m.action_content) + '</li>' : '') +
            '</ul>' + sameName +
            '<label class="rl-imp-cfm-ck"><input type="checkbox" id="cfmck-' + esc(m.id) + '"' +
                ' onchange="IMPCARD.cfmCk(\'' + esc(m.id) + '\')">' +
                '<span>개선 전·후 사진과 조치 내용을 <b>열람했습니다</b></span></label>' +
            (showReturn
                ? '<div class="rl-imp-cfm-rj"><label class="form-label" for="cfmrj-' + esc(m.id) + '">반려 사유 <span class="rskdoc-req">*</span></label>' +
                  '<textarea class="form-textarea" id="cfmrj-' + esc(m.id) + '" rows="2" placeholder="무엇을 다시 해야 하는지 적으세요"></textarea>' +
                  '<div class="rl-imp-cfm-btns">' +
                    '<button type="button" class="btn btn-secondary btn-sm" onclick="IMPCARD.cfmReturnCancel()">취소</button>' +
                    '<button type="button" class="btn btn-primary btn-sm" onclick="IMPCARD.cfmDoReturn(\'' + esc(m.id) + '\')">반려</button>' +
                  '</div></div>'
                : '<div class="rl-imp-cfm-btns">' +
                    '<button type="button" class="btn btn-outline btn-sm" onclick="IMPCARD.cfmReturnOpen(\'' + esc(m.id) + '\')">반려</button>' +
                    '<button type="button" class="btn btn-primary btn-sm" id="cfmok-' + esc(m.id) + '" disabled' +
                        ' onclick="IMPCARD.cfmDo(\'' + esc(m.id) + '\')">확인</button>' +
                  '</div>') +
        '</div>';
    }
    function cfmToggle(id) { CTX.cfmOpen = (CTX.cfmOpen === id) ? '' : id; CTX.cfmReturn = ''; render(); }
    /* 체크박스는 재렌더 없이 버튼만 켠다 — 재렌더하면 방금 누른 체크가 날아간다 */
    function cfmCk(id) {
        var ck = document.getElementById('cfmck-' + id), btn = document.getElementById('cfmok-' + id);
        if (ck && btn) btn.disabled = !ck.checked;
    }
    function cfmReturnOpen(id) { CTX.cfmReturn = id; render(); }
    function cfmReturnCancel() { CTX.cfmReturn = ''; render(); }
    function who() {
        var p = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        return p ? p.name : '재난안전과';
    }
    function cfmDo(id) {
        var r = D().confirmImprovement(id, who());
        if (r && r.error) { V().toast(r.error); return; }
        CTX.cfmOpen = ''; CTX.cfmReturn = '';
        V().toast('조치 완료 확인');
        render(); bubble();
    }
    function cfmDoReturn(id) {
        var el = document.getElementById('cfmrj-' + id);
        var r = D().returnImprovement(id, who(), (el && el.value) || '');
        if (r && r.error) { V().toast(r.error); return; }
        CTX.cfmOpen = ''; CTX.cfmReturn = '';
        V().toast('반려 — 담당자 화면에 사유가 전달됩니다');
        render(); bubble();
    }
    function cfmCancel(id) {
        var r = D().cancelConfirm(id, who());
        if (r && r.error) { V().toast(r.error); return; }
        V().toast('확인 취소 — 확인 대기로 되돌렸습니다');
        render(); bubble();
    }
    /* 바깥 화면(목록·배너)도 함께 갱신 */
    function bubble() { if (global.DYRSKDOC) DYRSKDOC.registerRefresh && null; if (typeof CTX.onChange === 'function') CTX.onChange(); }

    /* ===== 공개 API =====
     * open(opts) — opts: {key, title, metaHtml, noteHtml, emptyHtml, items(fn|array),
     *                     canRemind, onRemind('전역함수경로')}
     *   items 는 함수로 넘기면 재렌더마다 다시 읽는다(완료 처리 후 즉시 반영). */

    /* '' 권한 없음 | 'owner' 담당자만(그 부서) | 'both' 담당자+기한(주관부서) */
    function amendKind(m) {
        var R = global.DYROLE;
        if (!R || !R.current) return 'both';
        var p = R.current();
        if (!p || p.tier !== 'staff') return '';          /* 관리·감독은 조회 */
        if (p.deptId === R.OWNER_DEPT) return 'both';     /* 재난안전과 담당자 */
        return (p.deptId && p.deptId === m.dept_id) ? 'owner' : '';
    }

    /* 변경 이력 — 기한이 밀린 사실은 그 자리에 남아 있어야 관리 수단이 된다 */
    function amendLogHtml(m) {
        var logs = (m.history || []).filter(function (h) { return h.type === 'AMEND'; });
        if (!logs.length) return '';
        var last = logs[logs.length - 1];
        return '<span class="rl-imp-amendlog" title="' + esc(logs.map(function (h) { return h.at + ' ' + h.memo; }).join('\n')) + '">' +
            '변경 ' + logs.length + '회 · 최근 ' + esc(last.memo.split(' — 사유')[0]) + '</span>';
    }
    function amendOpen(id) {
        var m = D().improvementOf(id); if (!m) return;
        var kind = amendKind(m);
        if (!kind) { V().toast('이 개선조치를 변경할 권한이 없습니다.'); return; }
        AMEND = id;
        V().openModal(kind === 'both' ? '담당자 · 기한 변경' : '담당자 지정',
            '<p style="font-size:var(--fs-13);margin:0 0 4px;"><b>' +
                esc((m.hazard && m.hazard.name) || m.hazard_risk_factor || '-') + '</b></p>' +
            '<p class="file-hint">' +
                (kind === 'both'
                    ? '바꾼 내용과 사유가 이력에 남습니다.'
                    : '<b>이 부서에서 누가 조치할지 정합니다.</b> 바꾼 내용과 사유가 이력에 남습니다.') +
                ' <b>사유 없이는 저장되지 않습니다.</b></p>' +
            '<div class="rl-modal-row" style="margin-top:10px;">' +
                '<label class="form-label" for="imp-am-owner">담당자</label>' +
                '<div class="orgpick-field" id="imp-am-field"><div style="display:flex;gap:8px;align-items:center;">' +
                    '<input type="text" class="form-input" id="imp-am-owner" readonly placeholder="조직도에서 선택"' +
                        ' style="flex:1;background:var(--gray-50);" value="' + esc(m.assigned_to || '') + '">' +
                    '<button type="button" class="btn btn-outline" onclick="ORGPICK.toggle(\'imp-am-field\',\'member\',\'IMPCARD.amendPick\')">조직도</button>' +
                '</div></div></div>' +
            (kind === 'both'
                ? '<div class="rl-modal-row"><label class="form-label" for="imp-am-due">기한</label>' +
                    '<input type="date" class="form-input" id="imp-am-due" value="' + esc(m.due || m.due_date || '') + '" style="max-width:200px;"></div>'
                /* 부서는 기한을 못 바꾼다 — 왜 없는지 밝히지 않으면 '기능이 빠졌다'로 읽힌다 */
                : '<div class="rl-modal-row"><label class="form-label">기한</label>' +
                    '<div><b>' + esc(m.due || m.due_date || '-') + '</b>' +
                    '<p class="file-hint">기한 변경은 주관부서(재난안전과)에 요청하세요.</p></div></div>') +
            '<div class="rl-modal-row"><label class="form-label" for="imp-am-why">변경 사유 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<textarea class="form-textarea" id="imp-am-why" rows="2" placeholder="예: 담당자 인사이동 · 자재 수급 지연으로 2주 연장"></textarea></div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="IMPCARD.amendSave()">저장</button>');
    }
    function amendPick(label) { var el = document.getElementById('imp-am-owner'); if (el) el.value = label; }
    function amendSave() {
        if (!AMEND) return;
        var g = function (id) { var e = document.getElementById(id); return e ? e.value : ''; };
        var why = String(g('imp-am-why') || '').trim();
        if (!why) { V().toast('변경 사유를 입력하세요.'); var w = document.getElementById('imp-am-why'); if (w) w.focus(); return; }
        var by = (global.DYROLE && global.DYROLE.current && global.DYROLE.current().name) || '';
        var mm = D().improvementOf(AMEND);
        var patch = { assigned_to: g('imp-am-owner').trim() };
        /* 부서 담당자가 보낸 요청에 기한이 섞이지 않게 — 화면에 칸이 없어도 막는다 */
        if (amendKind(mm) === 'both') patch.due = g('imp-am-due');
        var r = D().amendImprovement(AMEND, patch, why, by);
        AMEND = null;
        if (!r) { V().toast('변경하지 못했습니다.'); return; }
        V().closeModal();
        if (CTX && CTX.onChange) { try { CTX.onChange(); } catch (e) {} }
        /* 카드 화면이 열려 있지 않은 곳(내 할일 목록)에서도 불린다 — 그때는 그 화면이
           스스로 다시 그린다. CTX 없이 render() 를 부르면 엉뚱한 것을 그린다. */
        if (CTX) render();
        else if (global.MYWORK && global.MYWORK.sync) { try { global.MYWORK.sync(); } catch (e) {} }
        /* 토스트는 **다시 그린 뒤** 띄운다 — sync() 가 제 안내로 덮어쓴다 */
        V().toast(patch.due !== undefined ? '담당자·기한 변경 · 이력에 남겼습니다' : '담당자 지정 · 이력에 남겼습니다');
    }

    function open(opts) {
        CTX = {
            key: opts.key || '', title: opts.title || '개선조치 상세',
            metaHtml: opts.metaHtml || '', noteHtml: opts.noteHtml || '',
            emptyHtml: opts.emptyHtml || '전달된 개선조치가 없습니다.',
            items: opts.items, canRemind: !!opts.canRemind, onRemind: opts.onRemind || '',
            /* 완료 확인 — **기본 false**. 수시평가 조치 상세는 확인 주체가 외부 용역
               안전관리자라 흐름이 다르므로 켜지 않는다. */
            canConfirm: !!opts.canConfirm, onChange: opts.onChange || null,
            filter: 'all', open: '', cfmOpen: '', cfmReturn: ''
        };
        render();
    }
    function itemsOf() {
        var it = CTX && CTX.items;
        return (typeof it === 'function' ? it() : it) || [];
    }
    function filter(f) { if (!CTX) return; CTX.filter = f; CTX.open = ''; render(); }
    function shot(key) { if (!CTX) return; CTX.open = (CTX.open === key) ? '' : key; render(); }

    function render() {
        if (!CTX) return;
        var all = itemsOf();
        var cnt = { all: all.length, over: 0, todo: 0, done: 0 };
        all.forEach(function (m) {
            if (m.status === 'DONE') cnt.done++;
            else { cnt.todo++; if (D().isOverdue(m)) cnt.over++; }
        });
        /* 급한 것부터 — 기한초과 → 미완료 → 완료. 건수가 많을수록 정렬이 곧 우선순위다. */
        var rank = function (m) { return m.status === 'DONE' ? 2 : (D().isOverdue(m) ? 0 : 1); };
        var list = all.filter(function (m) {
            if (CTX.filter === 'over') return m.status !== 'DONE' && D().isOverdue(m);
            if (CTX.filter === 'todo') return m.status !== 'DONE';
            if (CTX.filter === 'done') return m.status === 'DONE';
            return true;
        }).slice().sort(function (x, y) { return rank(x) - rank(y); });

        var pct = cnt.all ? Math.round(cnt.done / cnt.all * 100) : 0;
        var head =
            '<div class="rl-imp-sum">' +
                '<div class="rl-imp-sum-top">' +
                    '<b>개선조치 ' + cnt.all + '건</b>' +
                    '<span class="rl-imp-sum-rate">완료 ' + cnt.done + ' / ' + cnt.all + ' (' + pct + '%)</span>' +
                '</div>' +
                '<div class="progress" role="img" aria-label="완료율 ' + pct + '퍼센트">' +
                    '<div class="progress-bar green" style="width:' + pct + '%;"></div></div>' +
                (CTX.metaHtml ? '<div class="rl-imp-sum-meta">' + CTX.metaHtml + '</div>' : '') +
            '</div>';
        /* 필터는 건수가 적을 땐 소음이다 — 4건 이상일 때만 낸다 */
        var chip = function (k, lab, n, tone) {
            if (!n && k !== 'all') return '';
            return '<button type="button" class="rl-imp-fchip' + (CTX.filter === k ? ' is-on' : '') +
                (tone ? ' ' + tone : '') + '" onclick="IMPCARD.filter(\'' + k + '\')"' +
                (CTX.filter === k ? ' aria-current="true"' : '') + '>' + lab + ' <b>' + n + '</b></button>';
        };
        var filters = cnt.all >= 4
            ? '<div class="rl-imp-filters" role="group" aria-label="개선조치 상태 필터">' +
                  chip('all', '전체', cnt.all, '') + chip('over', '기한초과', cnt.over, 'is-danger') +
                  chip('todo', '미완료', cnt.todo, '') + chip('done', '완료', cnt.done, '') +
              '</div>'
            : '';
        var cards = list.length
            ? '<div class="rl-imp-cards">' + list.map(function (m, i) { return impCard(m, i + 1); }).join('') + '</div>'
            : '<div class="v2-empty">' + (cnt.all ? '이 조건에 해당하는 개선조치가 없습니다.' : CTX.emptyHtml) + '</div>';

        /* modal-wide 의 본문은 `display:flex; justify-content:center` 라 자식이 여럿이면
           가로로 흩어진다(문서 1장을 가운데 두려고 만든 규칙). 한 겹으로 싸서 넘긴다. */
        V().openModal(CTX.title,
            '<div class="rl-imp-wrap">' + head + filters + cards +
            (CTX.noteHtml ? '<p class="rl-imp-note">' + CTX.noteHtml + '</p>' : '') + '</div>',
            '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal()">닫기</button>',
            { variant: 'wide' });
    }

    var AMEND = null;
    global.IMPCARD = {
        open: open, amendOpen: amendOpen, amendPick: amendPick, amendSave: amendSave, filter: filter, shot: shot, render: render, photoItems: photoItems,
        cfmToggle: cfmToggle, cfmCk: cfmCk, cfmDo: cfmDo,
        cfmReturnOpen: cfmReturnOpen, cfmReturnCancel: cfmReturnCancel, cfmDoReturn: cfmDoReturn,
        cfmCancel: cfmCancel
    };
})(window);
