/* =========================================================================
 * work-assign.js — 배정 패널 (전역 WKASSIGN)
 * -------------------------------------------------------------------------
 * 부서 업무함(work-dept)과 내 할일(my-work) **두 화면이 공유**한다.
 * 한쪽에만 두면 반드시 복제되고, 그 순간 배정 규칙이 두 벌이 된다
 * (IMPCARD 가 rsk-list·my-work 를 공유하는 것과 같은 이유).
 *
 * 규칙
 *   · 모달은 DYV2.openModal 하나만 — 적층 금지(§1)
 *   · 담당자 선택은 ORGPICK 'memberUid' + rootId — 새 select 금지(§3),
 *     남의 부서 사람이 후보에 뜨면 그 자체가 조회 범위 위반(§12)
 *   · 배정 권한은 DYROLE.assignKind 한 곳에서만 판정(§14-7)
 *   · 저장은 assign.to(uid) 하나뿐 — 팀은 표시·필터용 파생이다
 * ========================================================================= */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var W = function () { return global.DYWORK; };
    var R = function () { return global.DYROLE; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }

    /* 연계 아이콘 (Lucide link-2, stroke 2 — 이모지 금지) */
    var ICO_LINK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;">' +
        '<path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';

    /* 열려 있는 배정 모달의 맥락 — 재렌더 사이에 유지한다 */
    var ctx = null;
    var onDone = null;

    function canAssign(deptId) { return R() && R().assignKind ? R().assignKind(deptId) !== '' : true; }
    /* 팀장이면 자기 팀 이름 — 조직도를 그 팀으로 좁힌다 */
    function myTeam() { return (R() && R().assignTeam) ? R().assignTeam() : ''; }

    /* 배정 주체를 지목한다 — 권한이 없는 사람에게 '누가 할 수 있는지' 알려준다.
       '주관부서만 할 수 있습니다' 같은 문구는 재난안전과 본인에게 거짓말이 된다. */
    function whoCanNote(deptId) {
        var lead = R() && R().leadOf ? R().leadOf(deptId) : null;
        var dn = W().deptName(deptId);
        if (lead) return '담당자를 정할 수 있는 사람: <b>' + esc(dn) + ' ' + esc(lead.name) + ' ' + esc(lead.role) + '</b>';
        return '<b>' + esc(dn) + '</b> 부서장이 시스템에 등록돼 있지 않습니다 — 재난안전과 확인 필요';
    }

    /* ── 배정 모달 ── */
    function open(issueId, deptId, cb) {
        var t = W().taskOf(issueId, deptId);
        var iss = W().issueById(issueId);
        if (!t || !iss) return;
        if (!canAssign(deptId)) { toast('이 배정은 ' + W().deptName(deptId) + '이(가) 정합니다'); return; }
        onDone = cb || null;
        ctx = { issueId: issueId, deptId: deptId, uid: t.assign.to || '', name: t.assign.toName || '', memo: '' };
        render();
    }

    function render() {
        var t = W().taskOf(ctx.issueId, ctx.deptId);
        var d = W().decorate(t);
        var teams = V().orgTeams(ctx.deptId);
        var mt = myTeam();
        var teamNote = mt
            ? '<p class="wka-note"><b>' + esc(mt) + '</b> 팀원 중에서 고릅니다 — 팀장은 자기 팀만 배정합니다.</p>'
            : (teams.length ? '' :
               '<p class="wka-note">이 부서는 <b>팀 정보가 등록돼 있지 않습니다</b> — 부서 전체에서 고릅니다.</p>');
        var body =
            '<div class="wka-sum">' +
                '<div class="wka-sum-row"><span>업무</span><b>' + esc(d.name) + '</b></div>' +
                '<div class="wka-sum-row"><span>회차</span><b>' + esc(d.periodLabel) + '</b></div>' +
                '<div class="wka-sum-row"><span>부서</span><b>' + esc(d.deptName) + '</b></div>' +
                '<div class="wka-sum-row"><span>기한</span><b>' + esc(d.due) + '</b> ' + ddayChip(d.dday) + '</div>' +
                ((d.tpl.slots || []).length
                    ? '<div class="wka-sum-row"><span>필요 증빙</span><b>' +
                        esc((d.tpl.slots || []).map(function (s) { return s.key + (s.required ? '*' : ''); }).join(' · ')) + '</b></div>'
                    : '<div class="wka-sum-row"><span>처리 위치</span><b>' + esc(d.tpl.destLabel || '업무 카드에서 첨부') + '</b></div>') +
            '</div>' +
            '<div class="wka-field">' +
                '<label class="form-label" for="wka-owner-in">담당자 <span class="wka-req">*</span></label>' +
                '<div class="orgpick-field" id="wka-owner">' +
                    '<div class="wka-inputrow">' +
                        '<input type="text" class="form-input" id="wka-owner-in" readonly placeholder="조직도에서 담당자를 고르세요" value="' +
                            esc(ctx.name ? ctx.name : '') + '">' +
                        '<button type="button" class="btn btn-sm btn-outline" ' +
                            'onclick="ORGPICK.toggle(\'wka-owner\',\'memberUid\',\'WKASSIGN._pick\',' +
                                '{rootId:\'' + esc(ctx.deptId) + '\',teamOnly:\'' + esc(myTeam()) + '\'})">' +
                            '조직도에서 고르기</button>' +
                    '</div>' +
                '</div>' +
                /* 조직도 출처를 밝힌다 — 자체 명단이 아니라 연계 데이터라는 것이
                   화면에 보여야 "왜 우리 팀원이 안 보이지"를 어디에 물을지 안다.
                   ※ 연계 관리(admin-integration)는 조직도를 **행정포털(SSO·조직도)**
                     소관으로 잡고 있다. 실무에서 '온나라 조직도'라 부르는 것이
                     같은 것인지 확인 필요(DYPOLICY work-org-source). */
                '<p class="wka-note">' + ICO_LINK + ' 담양군 <b>행정포털 조직도</b> 연계 · ' +
                    '마지막 동기화 <b>미연동(프로토타입 시드 ' + V().orgTotal() + '명)</b> — ' +
                    '실제 연계 시 부서·팀·직원이 자동으로 채워집니다.</p>' +
                teamNote +
            '</div>' +
            '<div class="wka-field">' +
                '<label class="form-label" for="wka-memo">전달 메모</label>' +
                '<input type="text" class="form-input" id="wka-memo" placeholder="예: 6월 점검표 서식으로 작성해 주세요" value="' + esc(ctx.memo) + '" ' +
                    'oninput="WKASSIGN._memo(this.value)">' +
            '</div>';
        var selfBtn = (R() && R().canClaim && R().canClaim(ctx.deptId))
            ? '<button class="btn btn-outline" onclick="WKASSIGN.claim()">내가 맡기</button>' : '';
        V().openModal('담당자 지정 — ' + esc(W().deptName(ctx.deptId)), body,
            '<button class="btn btn-secondary" onclick="WKASSIGN.close()">취소</button>' + selfBtn +
            '<button class="btn btn-primary" onclick="WKASSIGN.save()">지정하고 알림 보내기</button>');
    }
    function ddayChip(n) {
        if (n == null) return '';
        var label = n < 0 ? 'D+' + (-n) : (n === 0 ? 'D-day' : 'D-' + n);
        var tone = n < 0 ? 'danger' : (n <= 7 ? 'warning' : 'neutral');
        return '<span class="chip-status ' + tone + ' chip-sm">' + label + '</span>';
    }

    function _pick(uid, name, role, team) {
        ctx.uid = uid; ctx.name = name + (team ? ' (' + team + ')' : ' · ' + role);
        render();
    }
    function _memo(v) { ctx.memo = v; }
    function close() { ctx = null; V().closeModal(); }

    function save() {
        if (!ctx.uid) { toast('담당자를 골라주세요'); return; }
        if (!W().assign(ctx.issueId, ctx.deptId, ctx.uid, ctx.memo)) { toast('배정하지 못했습니다'); return; }
        var nm = ctx.name;
        var cb = onDone; close();
        toast(nm.split(' ')[0] + ' 님에게 배정했습니다 — 알림이 발송됩니다 (프로토타입)');
        if (cb) cb();
    }
    /* 자임 — 부서장이 부재해도 담당자가 스스로 가져가 일이 멈추지 않게 한다 */
    function claim() {
        var me = R() && R().current ? R().current() : null;
        if (!me) return;
        if (!W().assign(ctx.issueId, ctx.deptId, me.uid, '본인 자임')) { toast('처리하지 못했습니다'); return; }
        var cb = onDone; close();
        toast('내 업무로 가져왔습니다');
        if (cb) cb();
    }
    /* 화면 밖에서 바로 자임 (내 할일 카드의 [내가 맡기]) */
    function claimAt(issueId, deptId, cb) {
        var me = R() && R().current ? R().current() : null;
        if (!me) return;
        if (!(R() && R().canClaim && R().canClaim(deptId))) { toast('자기 부서 업무만 맡을 수 있습니다'); return; }
        if (!W().assign(issueId, deptId, me.uid, '본인 자임')) { toast('처리하지 못했습니다'); return; }
        toast('내 업무로 가져왔습니다');
        if (cb) cb();
    }

    /* ── 반송 (배정받은 사람이 되돌린다 — 사유 필수) ── */
    var rctx = null;
    function openReturn(issueId, deptId, cb) {
        rctx = { issueId: issueId, deptId: deptId, reason: '' };
        onDone = cb || null;
        V().openModal('배정 반송',
            '<p class="wka-note">이 업무가 내 담당이 아니라고 판단되면 사유와 함께 되돌립니다. ' +
            '부서장 화면에 <b>미배정</b>으로 다시 뜹니다.</p>' +
            '<div class="wka-field"><label class="form-label" for="wka-rr">반송 사유 <span class="wka-req">*</span></label>' +
            '<textarea class="form-input" id="wka-rr" rows="3" placeholder="예: 해당 시설은 시설운영팀 소관입니다" ' +
            'oninput="WKASSIGN._rr(this.value)"></textarea></div>',
            '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" onclick="WKASSIGN.saveReturn()">반송</button>');
    }
    function _rr(v) { rctx.reason = v; }
    function saveReturn() {
        if (!rctx.reason.trim()) { toast('반송 사유를 적어주세요 — 사유 없는 반송은 저장되지 않습니다'); return; }
        W().returnAssign(rctx.issueId, rctx.deptId, rctx.reason.trim());
        var cb = onDone; V().closeModal();
        toast('반송했습니다 — 부서장 화면에 미배정으로 표시됩니다');
        if (cb) cb();
    }

    global.WKASSIGN = {
        open: open, close: close, save: save, claim: claim, claimAt: claimAt,
        openReturn: openReturn, saveReturn: saveReturn,
        canAssign: canAssign, whoCanNote: whoCanNote, ddayChip: ddayChip,
        _pick: _pick, _memo: _memo, _rr: _rr,
    };
})(window);
