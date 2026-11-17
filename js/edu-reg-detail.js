/* =====================================================================
   edu-reg-detail.js · 정기교육 상세 (SCR-EDU-004 · 화면에는 화면 코드를 쓰지 않는다 — 운영 T25)
   ---------------------------------------------------------------------
   집합교육 상세를 모달 대신 별도 화면으로. ?id=course_id 로 진입.
   · 교육 정보(일정·시간·강사·장소·내용·첨부)
   · 등록 현황 테이블: 부서 · 참석자 명단 · 인원 · 서명파일 · 등록일 (2026-11-12 «신청» → «등록» — 사전 신청이 없다)
   · 참석자 등록부는 **교육이 끝난 뒤** 받는다(DYEDU.enrollOpen) — 서명은 참석 증빙이다
   · [참석자 등록부 등록] · [교육 종료 처리] · 이력
   표준: 배지 chip-status+DYV2.toneOf · 표 .table-figma · 부서 선택 ORGPICK ·
        안내 훅 EDUTOUR.onEvent('applied'|'closed')
   ===================================================================== */
(function (global) {
    'use strict';
    var V = function () { return global.DYV2; };
    var E = function () { return global.DYEDU; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }
    function tourEvt(e) { if (global.EDUTOUR) global.EDUTOUR.onEvent(e); }

    var state = { mount: null, courseId: null };
    var G = null; /* 참석자 등록부 등록 폼 */

    /* ===== 조작 권한 — 판정은 DYEDU(DYROLE.canAct 파생) 한 곳이다 =====
     * 종료 처리는 그 교육을 연 쪽(집합교육 = 재난안전과), 참석자 등록부·신청 취소·완료기록
     * 정정은 그 부서 담당자(주관부서 담당자는 전 부서)가 한다. 관리·감독 계층은 조회만 한다.
     * 버튼만 감추면 전역 호출로 뚫리므로 진입·저장 함수에도 같은 판정을 건다. */
    function deny(deptId) { toast(E().denyMsg(deptId)); }
    function FORM() { return global.EDUFORM; }
    /* 파일 이름은 교육 일자로 — 내부 교육 번호(C-M11 등)를 사용자 눈에 띄는 이름에 넣지 않는다(§15) */
    function dayKey(c) { return String((c && c.date) || E().today()).replace(/-/g, ''); }
    /* 등록 줄의 실제 참석 — 공통값 + 사람별로 따로 적은 시간 */
    function hoursCell(e, c) {
        var base = (e.actualHours == null ? c.hours : e.actualHours) + 'h';
        var ex = Object.keys(e.hoursBy || {});
        if (!ex.length) return base;
        var list = ex.map(function (wid) { return esc(E().personLabel(wid)) + ' ' + e.hoursBy[wid] + 'h'; }).join(', ');
        /* 전원이 따로 적힌 줄은 공통값을 내지 않는다 — 아무에게도 해당하지 않는 시간이다 */
        if ((e.workerIds || []).every(function (w) { return ex.indexOf(w) !== -1; })) return list;
        return base + '<br><span class="file-hint">' + ex.map(function (wid) { return esc(E().personLabel(wid)) + ' ' + e.hoursBy[wid] + 'h'; }).join(', ') + '</span>';
    }
    function hoursMemo(p, c) {
        return '실제 참석 ' + (p.actualHours == null ? c.hours : p.actualHours) + 'h' + (p.exceptions ? ' (사람별 ' + p.exceptions + '명 따로)' : '');
    }
    function actor() { return global.DYROLE && global.DYROLE.actorLabel ? global.DYROLE.actorLabel() : '재난안전과'; }

    function render() {
        if (!state.mount) return;
        var c = E().courseOf(state.courseId);
        if (!c) {
            state.mount.innerHTML = '<div class="edu-card"><div class="v2-empty">교육을 찾을 수 없습니다.</div></div>';
            return;
        }
        /* «안내 공문 전» 교육은 재난안전과에만 — 주소로 들어와도 열지 않는다(DYEDU.visibleCourse 한 곳) */
        if (!E().visibleCourse(c)) {
            state.mount.innerHTML = '<div class="edu-card"><div class="v2-empty">아직 안내되지 않은 교육입니다 — 재난안전과가 교육 안내 공문을 보내면 볼 수 있습니다.</div></div>';
            return;
        }
        var open = E().enrollOpen(c);
        var flow2 = E().isFlow2(c);
        var owner = E().isOwnerStaff();
        var me = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        var myDept = me ? me.deptId : '';
        var ownerDeptId = (global.DYROLE && global.DYROLE.OWNER_DEPT) || 'safety';
        var ownerView = !me || myDept === ownerDeptId || me.tier === 'head';
        var noticeOk = E().noticeSent(c);
        var stChip = c.status === 'CANCELLED'
            ? '<span class="chip-status chip-sm ' + V().toneOf('반려') + '">취소</span>'
            : c.status === 'DONE'
            ? '<span class="chip-status chip-sm ' + V().toneOf('완료') + '">완료</span>'
            : !noticeOk
            ? '<span class="chip-status chip-sm ' + V().toneOf('대기') + '">안내 공문 전</span>'
            : open
            ? '<span class="chip-status chip-sm ' + V().toneOf('진행중') + '">등록부 받는 중</span>'
            : '<span class="chip-status chip-sm ' + V().toneOf('예정') + '">교육 전</span>';
        var due = E().enrollDue(c), dueLeft = due ? V().daysTo(due) : null;
        var enrolls = E().enrolls(c.id);
        var allEnrolls = E().allEnrolls ? E().allEnrolls(c.id) : enrolls;
        var enrolledCnt = enrolls.reduce(function (n, e) { return n + (e.workerIds || []).length; }, 0);
        /* '개 부서'는 행 수가 아니라 **서로 다른 부서 수**다. 데이터 계층이 부서 중복
           등록을 막은 뒤로는 둘이 같지만, 그 전에 저장된 데이터가 브라우저에 남아
           있을 수 있어 세는 축을 표기와 맞춰 둔다. */
        var deptCnt = Object.keys(enrolls.reduce(function (m, e) { m[e.deptId] = 1; return m; }, {})).length;

        /* 버튼 — 역할 × 상태(기획 v2 §4-7). 재난안전과 담당자의 등록부 자리는 [출장 결과 보고서 작성]이다(03:37
           «재난안전과 담당자는 참석자 등록부를 등록할 필요가 없어요»). 일괄 등록은 걷었다 — 부서마다 제출 공문을 보낸다 */
        var D = global.EDUDOC;
        var actions = '';
        var canApply = E().canRegister();
        var myEnroll = enrollOfDept(myDept);
        var myTarget = E().courseTargetDepts(c).indexOf(myDept) !== -1;
        if (c.status === 'CANCELLED') {
            actions = D && flow2 && c.noticeDirty ? D.ctl(E().keyNotice(c.id), '', {}) : '';
        } else if (owner && flow2) {
            if (!noticeOk || c.noticeDirty) actions += D ? D.ctl(E().keyNotice(c.id), '안내 공문 작성', { primary: true, tour: 'edu-notice' }) : '';
            if (noticeOk && (open || c.status === 'DONE')) {
                actions += ' <button type="button" class="btn btn-outline" data-tour="edu-sign" onclick="EDURD.openSign()">' + (c.signSheet ? '서명부 다시 올리기' : '서명부 올리기') + '</button>';
                actions += c.trip
                    ? ' ' + (D ? D.ctl(E().keyTrip(c.id), '출장 결과 보고 공문 보내기', { primary: E().tripState(c) !== 'sent', short: '출장 결과' }) : '') +
                      (E().tripState(c) === 'sent' ? '' : ' <button type="button" class="btn btn-outline" onclick="EDURD.openTrip()">출장 결과 보고서 수정</button>')
                    : ' <button type="button" class="btn btn-primary" data-tour="edu-trip" onclick="EDURD.openTrip()">출장 결과 보고서 작성</button>';
                if (open && E().canActCourse(c)) actions += ' <button type="button" class="btn btn-outline" data-tour="close" onclick="EDURD.closeCourse()">교육 종료 처리</button>';
            }
        } else if (c.status === 'OPEN' && open && noticeOk && E().canActOwnDept(myDept) && !owner) {
            /* 부서 담당자 — 우리 부서 등록부 하나 */
            if (!myTarget) actions = '<span class="file-hint">우리 부서는 이 교육 대상자가 없습니다.</span>';
            else if (E().noAttendOf(c.id, myDept)) actions = '<span class="chip-status chip-sm neutral">참석자 없음</span> <button type="button" class="btn btn-outline btn-sm" onclick="EDURD.undoNoAttend()">되돌리기</button>';
            else if (!myEnroll) actions = '<button type="button" class="btn btn-primary" data-tour="apply" onclick="EDURD.openApply()">＋ 참석자 등록부 등록</button>';
            else if (myEnroll.flow === 2 && D) actions = D.ctl(E().keyEnroll(c.id, myDept), '등록부 공문 보내기', { primary: true, tour: 'enroll-send', short: '등록부 공문' });
        } else if (c.status === 'OPEN' && open && !flow2 && E().canActCourse(c)) {
            actions = '<button type="button" class="btn btn-primary" data-tour="close" onclick="EDURD.closeCourse()">교육 종료 처리</button>';
        } else if (c.status === 'DONE' && !lockOf(c.id) && E().canActOwnDept(myDept) && !owner && myTarget && !myEnroll && !E().noAttendOf(c.id, myDept)) {
            /* 종료 뒤 늦게 내는 부서 — 등록부를 올리고 제출 공문을 보낸다 */
            actions = '<button type="button" class="btn btn-outline" onclick="EDURD.openApply()" title="종료 뒤 늦게 내는 부서나 정정한 부서의 등록부를 올립니다">＋ 등록부 추가</button>';
        } else if (c.status === 'DONE' && !owner && myTarget && E().noAttendOf(c.id, myDept)) {
            actions = '<span class="chip-status chip-sm neutral">참석자 없음</span>' + (E().canActOwnDept(myDept) ? ' <button type="button" class="btn btn-outline btn-sm" onclick="EDURD.undoNoAttend()">되돌리기</button>' : '');
        } else if (c.status === 'DONE' && myEnroll && myEnroll.flow === 2 && D && !owner) {
            actions = D.ctl(E().keyEnroll(c.id, myDept), '등록부 공문 보내기', { primary: true, short: '등록부 공문' });
        }
        /* 안내 공문을 안 보낸 채 교육 날이 지났다 — 부서는 교육을 모르고 등록부 할 일도 없다 */
        var noNoticeWarn = owner && flow2 && !noticeOk && c.status === 'OPEN' && open
            ? '<div class="check-notice" style="margin-top:8px;">안내 공문을 보내지 않았습니다 — 부서가 교육을 모르고 참석자 등록부를 올릴 수 없습니다.</div>' : '';

        var sessions = E().courseSessions(c);
        /* 온나라 결재 상태 칩/상신 버튼 (교육별 = Type 2) */
        /* 공문 기안 — 종료 처리된 교육에만 나타난다(SCR-EDU-004 §4-5).
           상신은 이 자리가 아니라 문서 미리보기에만 있다. */
        var docCtl = global.EDUDOC ? '<span class="edu-doc-slot">' + global.EDUDOC.control(c.id) + '</span>' : '';
        /* 공문 요약 — 재난안전과·조회 계층은 ①·②·③, 부서는 우리 부서 ② 한 줄만 */
        var docSum = '';
        if (flow2 && D) {
            var en2 = E().enrolls(c.id).filter(function (e) { return e.flow === 2; });
            var sentE = en2.filter(function (e) { return E().docState(E().keyEnroll(c.id, e.deptId)) === 'sent'; }).length;
            var lines = [];
            if (ownerView) {
                var nd = E().latestAt(E().keyNotice(c.id));
                lines.push('① 교육 안내 ' + D.chipHtml(nd ? nd.status : ''));
                /* 분모는 대상 부서 수(기획 §2-8 «② n / 대상 m개 부서») — 이전 방식 등록부가 섞여 있을 때만 그 안내를 단다 */
                var legacyE = E().enrolls(c.id).filter(function (e) { return e.flow !== 2; }).length;
                if (noticeOk) lines.push('② 등록부 제출 공문 <b>' + sentE + '</b> / 대상 ' + E().courseTargetDepts(c).length + '개 부서' + (legacyE ? ' <span class="file-hint">(이전 방식 등록부 ' + legacyE + '건은 공문이 필요 없습니다)</span>' : ''));
                var td = E().latestAt(E().keyTrip(c.id));
                if (noticeOk) lines.push('③ 출장 결과 보고 ' + (td ? D.chipHtml(td.status) : c.trip ? '<span class="file-hint">보고서 작성함</span> ' + D.chipHtml('') : '<span class="file-hint">교육 뒤 작성</span>'));
            } else if (myEnroll && myEnroll.flow === 2) {
                var ed = E().latestAt(E().keyEnroll(c.id, myDept));
                lines.push('우리 부서 등록부 제출 공문 ' + D.chipHtml(ed ? ed.status : ''));
            }
            if (lines.length) docSum = '<div class="edu-detail-files edu-docsum">' + lines.join(' · ') + '</div>';
        }
        var summary =
            '<div class="edu-detail-head">' +
                '<div class="edu-detail-title">' + esc(c.desc) + ' ' + stChip + ' ' + docCtl + '</div>' +
                '<div class="edu-detail-meta">' +
                    '<span>구분 <b>' + esc(E().kindLabel(c.kind)) + '</b></span>' +
                    '<span>일정 <b>' + esc(E().courseDateTime(c)) + '</b></span>' +
                    '<span>시간 <b>' + c.hours + 'h</b>' + (sessions.length > 1 ? ' (' + sessions.length + '일 합계)' : '') + '</span>' +
                    '<span>강사 <b>' + esc(c.instructor || '-') + '</b></span>' +
                    '<span>장소 <b>' + esc(c.place || '-') + '</b></span>' +
                    '<span>등록 <b>' + deptCnt + '개 부서 · ' + enrolledCnt + '명</b></span>' +
                    (c.status === 'OPEN' && due ? '<span>등록 기한 <b>' + esc(due) + '</b>' + (open ? (dueLeft >= 0 ? ' (D-' + dueLeft + ')' : ' (D+' + (-dueLeft) + ' · 기한 지남)') : '') + '</span>' : '') +
                '</div>' +
                /* 교육 전에는 등록 수단 대신 «언제부터»를 밝힌다 — 서명은 참석한 뒤에 받는다 */
                (c.status === 'OPEN' && !open
                    ? '<div class="check-notice" style="margin-top:8px;">교육이 끝난 뒤(<b>' + esc(E().lastSessionDate(c)) + '</b>부터) 각 부서 담당자가 참석자 등록부를 올립니다 — 참석자 · 실제 참석시간 · 서명부 스캔. 등록 기한 ' + esc(due) + '.</div>'
                    : '') +
                /* 다회차 교육은 회차별 일자·시간을 펼쳐 보여준다 (합계만 보이면 일정 확인이 불가) */
                (sessions.length > 1
                    ? '<div class="edu-detail-files" style="color:var(--text-gray);">🗓 ' +
                        sessions.map(function (s, i) {
                            return (i + 1) + '회차 ' + esc(s.date) + ' ' + esc(s.start || '') +
                                (s.end ? '~' + esc(s.end) : '') + ' (' + E().sessionHours(s) + 'h)';
                        }).join(' · ') + '</div>'
                    : '') +
                (c.files && c.files.length ? '<div class="edu-detail-files">📎 ' + c.files.map(function (f) { return esc(f.name); }).join(' · ') + '</div>' : '') +
                (c.photos && c.photos.length ? '<div class="edu-detail-files">📷 교육 사진 ' + c.photos.length + '장 · ' + c.photos.map(function (p) { return esc(p.name); }).join(' · ') + '</div>' : '') +
                docSum + noNoticeWarn +
                (c.status === 'CANCELLED' ? '<div class="check-notice" style="margin-top:8px;">취소된 교육입니다' + (c.cancelReason ? ' — 사유: ' + esc(c.cancelReason) : '') + '</div>' : '') +
                (c.signSheet && c.signSheet.file ? '<div class="edu-detail-files">✍ 재난안전과 서명부 ' + (ownerView || E().canSeePerson(myDept) ? esc(c.signSheet.file) : '') + ' · ' + esc(c.signSheet.at || '') + '</div>' : '') +
                (actions ? '<div class="edu-detail-actions">' + actions + '</div>' : '') +
            '</div>';

        /* 신청현황 테이블 — 상신 뒤에는 취소 수단 자체를 내지 않는다.
         * 누르면 거절하는 버튼을 남겨 두면 담당자가 왜 안 되는지 모른 채 두 번 누른다. */
        var enrollLock = lockOf(state.courseId);
        /* 재난안전과·조회 계층은 대상 부서 전부를 줄로 — 누가 안 냈는지 본다. 부서 담당자는 등록한 줄만 */
        var ghost = [];
        if (ownerView && flow2 && noticeOk && (open || c.status === 'DONE')) {
            var hasRow = {}; allEnrolls.forEach(function (e) { if (e.status !== 'CANCELLED') hasRow[e.deptId] = 1; });
            E().courseTargetDepts(c).forEach(function (d) { if (!hasRow[d]) ghost.push(d); });
        }
        var ghostRows = ghost.map(function (d) {
            var na = E().noAttendOf(c.id, d);
            var canR = c.status === 'OPEN' && !na && global.DYROLE && global.DYROLE.canRemind && global.DYROLE.canRemind(d) && d !== myDept;
            var selfReg = d === myDept && owner && open && !na;
            return '<tr class="row-short"><td class="edu-name">' + esc(E().deptName(d)) + '</td>' +
                '<td colspan="4"><span class="chip-status chip-sm ' + (na ? 'neutral' : V().toneOf('미제출')) + '">' + (na ? '참석자 없음' : '미등록') + '</span></td>' +
                '<td>' + (global.EDUDOC ? global.EDUDOC.remindCount(d, 'A|' + c.id) + '회 독촉' : '') + '</td>' +
                '<td>—</td>' +
                '<td class="col-action">' + (canR ? '<button type="button" class="btn btn-outline btn-sm" onclick="EDURD.remind(\'' + esc(d) + '\',\'apply\')">독촉</button>' : '') +
                    (selfReg ? ' <button type="button" class="btn btn-outline btn-sm" onclick="EDURD.openApply()">＋ 우리 부서 등록부 등록</button>' : '') + '</td></tr>';
        }).join('');
        var rows = allEnrolls.length ? allEnrolls.map(function (e) {
            /* 다른 부서 신청 줄 — 이름은 «#번호»로 가리고 서명등록부(이름·서명이 있다)는 열지 않는다.
               신청 취소·정정도 내지 않는다(아래 canActDept). 판정은 DYEDU 한 곳(운영 P05). */
            var names = E().personLabels(e.workerIds);
            var seeSign = E().canSeePerson(e.deptId);
            var cancelled = e.status === 'CANCELLED';
            return '<tr>' +
                '<td class="edu-name">' + esc(E().deptName(e.deptId)) + (cancelled ? ' <span class="chip-status chip-sm danger">정정됨</span>' : '') +
                    (e.bulk ? ' <span class="chip-status chip-sm neutral">일괄 등록</span>' : e.proxy ? ' <span class="chip-status chip-sm neutral">대리 등록</span>' : '') + '</td>' +
                '<td>' + esc(names) + '</td>' +
                '<td>' + (e.workerIds || []).length + '명</td>' +
                '<td>' + hoursCell(e, c) + '</td>' +
                '<td>' + (e.signFrom === 'course' ? '<span style="color:var(--text-gray);font-size:var(--fs-12);">재난안전과 서명부</span>' : !e.signFile ? '<span style="color:var(--text-gray);">-</span>'
                    : seeSign ? '<span style="color:var(--main-dark);font-size:var(--fs-12);">📎 ' + esc(e.signFile) + '</span>'
                    : '<span style="color:var(--text-gray);font-size:var(--fs-12);">제출됨</span>') + '</td>' +
                '<td>' + esc(e.at) + '</td>' +
                '<td>' + docCell(c, e, myDept, ownerView) + '</td>' +
                '<td class="col-action">' + (cancelled
                    ? '<span style="font-size:var(--fs-12);color:var(--text-gray);">' + esc(e.cancelReason || '취소 사유 미기재') + '<br>' + esc(e.cancelledAt || '') + '</span>'
                    /* 신청 취소·완료기록 정정은 그 부서 담당자(주관부서 담당자는 전 부서)만 —
                       남의 부서 등록부를 거두는 것은 그 부서가 올린 기록을 지우는 일이다 */
                    : !canCancel(e)
                    ? (e.bulk && E().canActDept(e.deptId) ? '<span style="font-size:var(--fs-12);color:var(--text-gray);">일괄 등록 — 정정은 재난안전과</span>' : '')
                    /* 공문이 나간 등록부는 고치는 버튼이 없는 것으로 잠금을 나타낸다 — 자물쇠 버튼이 상태 칩과 함께
                       «결재 완료가 두 개»로 읽혔다(2차 통화 00:35). 상태는 «공문» 칸의 칩 하나가 말한다 */
                    : ((e.flow === 2 && E().enrollLock(c.id, e.deptId)) || enrollLock) ? ''
                    : '<button type="button" class="btn btn-outline btn-sm" style="border-color:var(--status-danger-border);color:var(--status-danger-fg);" onclick="EDURD.confirmCancel(\'' + esc(e.deptId) + '\')"' +
                        (c.status === 'DONE' ? ' title="이 등록부를 «정정됨»으로 남기고 이 교육 이수시간을 뺍니다">이수 기록 정정' : '>등록 취소') + '</button>') + '</td>' +
            '</tr>';
        }).join('') : (ghostRows ? '' : '<tr><td colspan="8"><div class="v2-empty">' + (!noticeOk ? '안내 공문을 보내면 부서에 알립니다.' : open || c.status === 'DONE' ? '아직 등록한 부서가 없습니다.' : '교육이 끝나면 부서가 참석자 등록부를 올립니다.') + '</div></td></tr>');
        rows += ghostRows;
        var enrollTable =
            '<div class="edu-card"><div class="edu-card-title">등록 현황 (' + deptCnt + '개 부서 · ' + enrolledCnt + '명)</div>' +
                (enrollLock ? '<div class="check-notice">공문 <b>' + esc(enrollLock) + '</b> — 이 교육의 이수자 명단이 공문 붙임으로 나가 있어 등록을 취소할 수 없습니다. 온나라에서 반려·반송되면 다시 열립니다.</div>'
                    /* 종료 뒤 정정 길을 한 줄로 밝힌다 — 버튼 이름만으로는 무엇이 일어나는지 모른다 */
                    : (c.status === 'DONE' && canApply && allEnrolls.length)
                    ? '<p class="file-hint" style="margin:0 0 8px;">등록부가 잘못됐으면 그 부서 줄의 [이수 기록 정정]으로 원래 등록부를 «정정됨»으로 남기고 이수시간을 뺀 뒤, [＋ 등록부 추가]로 바른 명단을 다시 올립니다. 등록부 제출 공문을 온나라로 보내면 잠깁니다.</p>'
                    : '') +
                '<div class="edu-scroll"><table class="table-figma table-compact"><thead><tr>' +
                    '<th style="width:15%;">부서</th><th>참석자 명단</th><th style="width:8%;">인원</th><th style="width:9%;">실제 참석</th><th style="width:16%;">서명부</th><th style="width:10%;">등록일</th><th style="width:14%;">공문</th><th></th>' +
                '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
            '</div>';

        /* 이력 */
        /* 이력 유형은 저장 코드(CREATE·STATUS)를 화면에 내지 않고 담당자 말로 바꾼다(CLAUDE.md §15) */
        var HIST_LABEL = { CREATE: '등록', STATUS: '처리' };
        /* 부서 화면의 이력은 재난안전과 공용 기록과 우리 부서 기록만 — 출장 결과 보고는 재난안전과 내부 보고이고,
           다른 부서 등록부 줄은 등록 현황 표처럼 감춘다(2026-11-17 검수) */
        var ownerName = E().deptName(ownerDeptId), myName = E().deptName(myDept);
        var histList = (c.history || []).filter(function (h) {
            if (ownerView) return true;
            if (/^출장 결과 보고/.test(h.memo || '')) return false;
            var by = String(h.by || '');
            return !by || by.indexOf(ownerName) === 0 || (myName && by.indexOf(myName) === 0);
        });
        var hist = histList.length ? histList.map(function (h) {
            return '<div class="edu-hist-row">' +
                '<span class="edu-hist-at">' + esc(h.at || '') + '</span>' +
                '<span class="edu-hist-type">' + esc(HIST_LABEL[h.type] || '기록') + '</span>' +
                '<span class="edu-hist-body">' + esc(h.memo || '') +
                    (h.by ? '<span class="edu-hist-by">— ' + esc(h.by) + '</span>' : '') +
                '</span>' +
            '</div>';
        }).join('') : '<div style="color:var(--text-gray);font-size:var(--fs-12);padding:12px;">이력이 없습니다.</div>';
        var histCard = '<div class="edu-card"><div class="edu-card-title">이력</div><div class="edu-hist">' + hist + '</div></div>';

        /* 관리·감독 계층에는 처리 수단 대신 누가 하는지를 밝힌다(담당자에게는 '') */
        var ro = global.DYROLE && global.DYROLE.readOnlyNote ? global.DYROLE.readOnlyNote('참석자 등록·종료 처리') : '';
        state.mount.innerHTML = ro + summary + enrollTable + histCard;
    }

    /* =============== 참석자 등록부 등록 =============== */
    function openApply() {
        var c = E().courseOf(state.courseId);
        if (!E().canRegister()) { deny(E().defaultDeptId()); return; }
        /* 완료 교육의 정정 등록부는 언제든, 접수 중 교육은 끝난 뒤에만 받는다 */
        if (c && c.status === 'OPEN' && !E().enrollOpen(c)) { toast('교육이 끝난 뒤(' + E().lastSessionDate(c) + '부터) 참석자 등록부를 올립니다.'); return; }
        /* 이전 방식 교육은 실시 결과 공문을 보낸 뒤 등록부를 받지 않는다(새 흐름은 부서 등록부 공문 ② 가 그 부서 줄만 잠근다) — 버튼만 숨기면 직접 호출로 뚫린다 */
        if (lockOf(state.courseId)) { toast(lockNote()); return; }
        if (c && !E().noticeSent(c)) { toast('교육 안내 공문을 보내기 전인 교육입니다.'); return; }
        /* 부서는 누구든 소속 부서로 고정 — 대리 등록 없음(그 부서 제출 공문은 그 부서가 보낸다, 2026-11-16) */
        var mine = global.DYROLE && global.DYROLE.deptId ? global.DYROLE.deptId() : E().defaultDeptId();
        if (!E().canActOwnDept(mine)) { deny(mine); return; }
        G = { deptId: mine, workerIds: {}, signFile: '', signFrom: c && c.signSheet && c.signSheet.file ? 'course' : 'self', actualHours: c ? c.hours : '', hoursBy: {}, hoursOpen: false };
        renderApply();
    }
    function targetWorkers(deptId) {
        var c = E().courseOf(state.courseId);
        var isSup = c && (c.kind === 'SUP_REG' || c.kind === 'SUP_ETC');
        var arr = isSup ? E().supervisorWorkers() : E().fieldWorkers();
        return deptId ? arr.filter(function (w) { return w.deptId === deptId; }) : arr;
    }
    function renderApply() {
        var c = E().courseOf(state.courseId);
        var ws = targetWorkers(G.deptId);
        var selCnt = Object.keys(G.workerIds).filter(function (k) { return G.workerIds[k]; }).length;
        var rows = ws.length ? ws.map(function (w) {
            var ck = G.workerIds[w.id] ? ' checked' : '';
            return '<label class="edu-tg-member"><input type="checkbox"' + ck +
                ' onchange="EDURD.applyToggle(\'' + w.id + '\', this.checked)">' +
                '<span>' + esc(w.name) + '</span>' +
                '<span style="color:var(--text-gray);font-size:var(--fs-12);">' + esc(E().catLabel(w.category)) + '</span>' +
            '</label>';
        }).join('') : '<div style="color:var(--text-gray);font-size:var(--fs-12);padding:8px;">이 부서에 대상자가 없습니다.</div>';
        var body =
            '<div style="font-size:var(--fs-12);color:var(--text-gray);margin-bottom:10px;">' +
                '<b>' + esc(c.desc) + '</b> · 일정 ' + esc(E().courseDateTime(c)) + ' · ' + c.hours + 'h' +
            '</div>' +
            '<div class="edu-modal-row"><label class="form-label">부서</label>' +
                '<input type="text" class="form-input" value="' + esc(E().deptName(G.deptId)) + '" readonly aria-label="부서" style="background:var(--gray-50);">' +
                '<p class="file-hint">소속 부서로 등록합니다 — 다른 부서 등록부는 그 부서 담당자가 올리고 제출 공문을 보냅니다.</p></div>' +
            '<div class="edu-modal-row"><label class="form-label">근로자 선택 <span style="color:var(--status-danger-fg)">*</span> ' +
                '<span style="color:var(--text-gray);font-weight:var(--fw-regular);">(' + selCnt + ' / ' + ws.length + '명)</span></label>' +
                '<div class="edu-tg-body" style="max-height:240px;">' + rows + '</div>' +
            '</div>' +
            /* 실제 참석시간 — 모두에게 같은 시간 + 사람별 예외(공용 블록, EDUFORM) */
            FORM().hoursBlockHtml(G, ws.filter(function (w) { return G.workerIds[w.id]; }), c.hours, 'EDURD') +
            '<div class="edu-modal-row"><label class="form-label">서명부 <span style="color:var(--status-danger-fg)">*</span></label>' +
                /* 집합교육 서명부는 한 장에 여러 부서가 섞여 재난안전과 손에 있다 — 재난안전과가 한 번 올리면 골라 쓴다 */
                (c.signSheet && c.signSheet.file
                    ? '<label class="rskdoc-ck"><input type="radio" name="erd-signfrom"' + (G.signFrom === 'course' ? ' checked' : '') + ' onchange="EDURD.applySignFrom(\'course\')"><span>재난안전과가 올린 서명부 사용 <span class="file-hint">' + esc(c.signSheet.file) + '</span></span></label>' +
                      '<label class="rskdoc-ck"><input type="radio" name="erd-signfrom"' + (G.signFrom !== 'course' ? ' checked' : '') + ' onchange="EDURD.applySignFrom(\'self\')"><span>직접 올리기</span></label>'
                    : '<p class="file-hint" style="margin:0 0 6px;">재난안전과가 서명부를 올리면 고를 수 있습니다. 우리 부서가 따로 받은 서명부가 있으면 직접 올립니다.</p>') +
                (G.signFrom === 'course' ? '' :
                '<p class="file-hint" style="margin:0 0 6px;">교육 때 참석자가 서명한 서명부를 스캔해 올립니다.</p>' +
                /* 업로드 칸은 전 화면 공용 모양 하나(uploadDrop) — 버튼 하나짜리를 두지 않는다
                   (기획확인 4차 D-1, 2026-10-06). 고른 뒤에는 파일명과 [×]로 바꾼다. */
                (G.signFile
                    ? '<span style="color:var(--main-dark);font-weight:var(--fw-bold);font-size:var(--fs-12);">' + esc(G.signFile) + '</span> ' +
                      '<button type="button" class="btn btn-sm btn-outline" onclick="EDURD.applyClearSign()" aria-label="서명부 지우기">×</button>' +
                      FORM().oneFile(V().fileHint())
                    : FORM().oneFile(V().uploadDrop('<b>서명부 스캔을 끌어다 놓거나 눌러서 선택</b>', 'EDURD.applyAttachSign()', { hint: true })))) +
            '</div>' +
            /* 대상자는 있는데 아무도 참석하지 않았다 — 공문 없이 할 일을 끝낸다(이수 기록은 생기지 않는다) */
            (c.status !== 'CANCELLED' ? '<p class="file-hint" style="margin-top:10px;">우리 부서에서 아무도 참석하지 않았으면 <button type="button" class="btn btn-outline btn-sm" onclick="EDURD.setNoAttend()">참석자 없음</button> — 공문 없이 할 일이 끝납니다.</p>' : '') +
            (G.why ? '<div class="check-notice" role="alert" style="margin-top:8px;">' + esc(G.why) + '</div>' : '');
        var isFlow2Enroll = E().isGroupCourse(c);
        V().openModal('참석자 등록부 등록 · ' + esc(E().deptName(G.deptId)), body,
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDURD.doApply()">' + (isFlow2Enroll ? '저장하고 공문 작성 →' : '등록') + '</button>');
    }
    function captureApply() { if (G) FORM().captureHours(G); }
    /* 등록 현황 표 «공문» 칸 — 이전 방식 등록부는 공문이 필요 없다 */
    function docCell(c, e, myDept, ownerView) {
        if (e.status === 'CANCELLED') return '—';
        if (e.flow !== 2) return '<span class="file-hint">이전 방식</span>';
        if (!ownerView && e.deptId !== myDept) return '—';
        var k = E().keyEnroll(c.id, e.deptId), d = E().latestAt(k);
        var D = global.EDUDOC;
        /* 제목 줄 버튼과 같은 이름 — 같은 일을 두 이름으로 부르지 않는다 */
        if (e.deptId === myDept && D) return D.ctl(k, '등록부 공문 보내기', { primary: true, short: '' });
        /* 어휘는 교육 전 화면 공통 — 공문 미기안 / 결재 미완료 / 결재 완료 / 반려 / 반송 · 열람 [공문 보기] (EDUDOC 한 곳) */
        var cell = !D ? '' : d ? D.chipHtml(d.status) +
                ' <button type="button" class="btn btn-outline btn-sm" onclick="EDUDOC.openDoc(\'' + esc(k) + '\',\'' + esc(d.sid) + '\')">공문 보기</button>'
            : D.chipHtml('');
        var canR = (!d || d.status === '반려' || d.status === '반송') && global.DYROLE && global.DYROLE.canRemind && global.DYROLE.canRemind(e.deptId) && ownerView && e.deptId !== myDept;
        return cell + (canR ? ' <button type="button" class="btn btn-outline btn-sm" onclick="EDURD.remind(\'' + esc(e.deptId) + '\',\'enrollDoc\')">독촉</button>' : '');
    }
    function remind(deptId, what) {
        var c = E().courseOf(state.courseId); if (!c || !global.EDUDOC) return;
        global.EDUDOC.remindDept(deptId, what, { key: (what === 'apply' ? 'A|' : 'E|') + c.id + (what === 'apply' ? '' : '|' + deptId), courseId: c.id, title: c.desc, href: 'edu-reg-detail.html?id=' + encodeURIComponent(c.id) });
        render();
    }
    /* 사람별 칸 펼침 — 다시 그려도 펼친 채로(일괄 등록 폼과 같은 함수) */
    function hoursOpen(o) { if (G) G.hoursOpen = !!o; }
    function applyPickDept(id, name) {
        if (!E().canActDept(id)) { deny(id); return; }
        captureApply(); G.deptId = id; G.workerIds = {}; renderApply();
    }
    function applyToggle(id, on) { captureApply(); if (on) G.workerIds[id] = true; else delete G.workerIds[id]; renderApply(); }
    function applyAttachSign() { captureApply(); G.signFile = E().deptName(G.deptId) + '_' + dayKey(E().courseOf(state.courseId)) + '_참석자서명부.pdf'; renderApply(); }
    function applyClearSign() { captureApply(); G.signFile = ''; renderApply(); }
    function doApply() {
        if (!E().canActOwnDept(G.deptId)) { deny(G.deptId); return; }
        captureApply();
        var ids = Object.keys(G.workerIds).filter(function (k) { return G.workerIds[k]; });
        if (!ids.length) { G.why = '근로자를 1명 이상 선택하세요 — 아무도 참석하지 않았으면 [참석자 없음]을 누릅니다.'; renderApply(); return; }
        var cc = E().courseOf(state.courseId);
        var useCourseSign = G.signFrom === 'course' && cc && cc.signSheet && cc.signSheet.file;
        if (!G.signFile && !useCourseSign) { G.why = '서명부를 올려 주세요 (필수).'; renderApply(); return; }
        var c = E().courseOf(state.courseId);
        if (c && c.status === 'OPEN' && !E().enrollOpen(c)) { toast('교육이 끝난 뒤 참석자 등록부를 올립니다.'); return; }
        if (lockOf(state.courseId)) { V().closeModal(); toast(lockNote()); return; }
        captureApply();
        var hp = FORM().hoursPayload(G, ids, c.hours);
        if (!hp.ok) { toast(hp.why); return; }
        /* 같은 부서가 두 번 쌓이면 이수기록이 이중으로 붙어 이수 판정과 공문 수치가
           함께 틀어진다. 인원·서명파일 정정은 신청 취소 후 재등록 경로다. */
        if (E().hasEnroll(state.courseId, G.deptId)) {
            toast(E().deptName(G.deptId) + V().josa(E().deptName(G.deptId), '은', '는') + ' 이미 등록된 부서입니다 — 등록 취소 후 다시 등록하세요.');
            return;
        }
        /* 저장 여부는 데이터 계층이 정한다(중복 부서·모집단 불일치 — 운영 E19).
           반환값을 보지 않으면 저장되지 않았는데 «신청 완료»가 뜨고 이수기록만 붙는다. */
        /* 재난안전과가 다른 부서 몫을 대신 올리면 «대리 등록»으로 남긴다(부서 담당자가 없는 부서용) */
        var pr = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        var enr = { courseId: state.courseId, deptId: G.deptId, workerIds: ids, signFile: useCourseSign ? '' : G.signFile, signFrom: useCourseSign ? 'course' : undefined,
                    actualHours: hp.actualHours, hoursBy: hp.hoursBy, at: E().today(),
                    by: pr ? pr.name : '', proxy: false };
        /* 저장 거절 사유는 창 안에 남긴다 — 토스트만으로 끝내면 무엇을 고칠지 놓친다 */
        if (!E().addEnroll(enr)) { G.why = E().enrollDenyReason(enr) || '등록부를 저장하지 못했습니다.'; renderApply(); return; }
        /* 종료 뒤 정정 등록부 — 사람마다 그 사람의 실제 참석시간으로 이수기록을 남긴다 */
        if (c.status === 'DONE') { var saved = enrollOfDept(G.deptId); if (saved) E().recordEnrollCompletion(saved, c.date); }
        E().pushCourseHistory(state.courseId, { type: 'STATUS', by: actor(), memo: '참석자 등록부 등록 · ' + ids.length + '명 · ' + hoursMemo(hp, c) + (useCourseSign ? ' · 재난안전과 서명부 사용' : ' · 서명부 첨부') });
        render();
        tourEvt('applied');
        /* 저장하고 바로 제출 공문(②) — 같은 창이 기안 폼으로 바뀐다. 닫아도 등록부는 남고 공문만 «보내기 전» */
        if (global.EDUDOC && E().isGroupCourse(c)) { global.EDUDOC.open(E().keyEnroll(state.courseId, G.deptId)); return; }
        V().closeModal();
        toast(E().deptName(G.deptId) + ' · ' + ids.length + '명 참석자 등록부 등록');
    }

    /* 일괄 등록(2026-11-11)은 2026-11-16 통화로 걷었다 — 재난안전과는 등록부를 올리지 않고 [서명부 올리기]로 서명부만 둔다.
       옛 «일괄 등록» 줄의 표시·정정 안내는 등록 현황 표에 남는다. 함수까지 지웠다(전역 호출로 대리 등록이 생기지 않게). */

    /* =============== 참석자 등록부 등록 취소 =============== */
    /* 잘못 신청한 부서를 되돌린다. 이미 종료 처리된 교육이면 그 부서 몫의
     * 이수기록까지 회수되므로 확인 문구에 명시한다.
     *
     * **결재가 올라간 뒤에는 잠근다.** 공문의 이수자 명단(붙임 별지)은 저장된 사본이
     * 아니라 **열 때마다 현재 이수기록에서 다시 파생**된다(js/doc-flow.js). 그래서
     * 상신 뒤에 신청을 취소하면 이미 결재선을 타고 올라간 문서의 명단이 사후에 줄어든다.
     * 판정은 EDUDOC.lockOf 한 곳에서만 한다(CLAUDE.md §4 — 화면이 재구현하지 말 것). */
    function lockOf(courseId) {
        return global.EDUDOC && global.EDUDOC.lockOf ? global.EDUDOC.lockOf(courseId) : null;
    }
    function lockNote() {
        return '공문이 ' + lockOf(state.courseId) + ' 상태라 등록부를 더 받지 않습니다 — 온나라에서 반려·반송되면 다시 열립니다.';
    }
    /* 등록 취소·정정 주체 — 그 부서 담당자(주관부서 담당자는 전 부서). 다만 일괄 등록 줄은
       올린 쪽(재난안전과)만 고친다 — 부서가 지우면 재난안전과가 받은 서명부와 기록이 갈린다 */
    function canCancel(e) {
        if (!e) return false;
        /* 새 흐름 등록부는 그 부서 담당자만 — 재난안전과가 남의 부서 등록부를 거두지 않는다 */
        if (e.flow === 2) return E().canActOwnDept(e.deptId);
        if (!E().canActDept(e.deptId)) return false;
        return !e.bulk || E().canPickDept();
    }
    function cancelLock(deptId) {
        var e = enrollOfDept(deptId);
        if (e && e.flow === 2) { var l = E().enrollLock(state.courseId, deptId); return l ? '등록부 공문이 ' + l + ' 상태라 등록부를 고칠 수 없습니다 — 온나라에서 정정한 뒤 재난안전과에 알려 주세요.' : ''; }
        var lk = lockOf(state.courseId);
        return lk ? '공문이 ' + lk + ' 상태라 등록부를 취소할 수 없습니다 — 온나라에서 반려·반송되면 다시 열립니다.' : '';
    }
    function enrollOfDept(deptId) {
        return E().enrolls(state.courseId).filter(function (e) { return e.deptId === deptId; })[0] || null;
    }
    function confirmCancel(deptId) {
        var c = E().courseOf(state.courseId); if (!c) return;
        /* 버튼을 감추는 것만으로는 부족하다 — 전역 호출(EDURD.confirmCancel)로 뚫린다 */
        if (!canCancel(enrollOfDept(deptId))) { toast(enrollOfDept(deptId) && enrollOfDept(deptId).bulk ? '일괄 등록한 등록부는 재난안전과 담당자가 정정합니다.' : E().denyMsg(deptId)); return; }
        var lock = cancelLock(deptId);
        if (lock) { toast(lock); return; }
        var mine = E().enrolls(state.courseId).filter(function (e) { return e.deptId === deptId; });
        var cnt = mine.reduce(function (n, e) { return n + (e.workerIds || []).length; }, 0);
        V().openModal(c.status === 'DONE' ? '이수 기록 정정' : '참석자 등록부 등록 취소',
            '<p style="font-size:var(--fs-13);"><b>' + esc(E().deptName(deptId)) + '</b> · 등록 ' + cnt + '명</p>' +
            (c.status === 'DONE'
                ? '<div class="check-notice" style="margin-top:10px;">원래 등록부는 지우지 않고 <b>«정정됨»</b>으로 남깁니다. 이 부서 ' + cnt + '명의 이 교육 이수시간만 빠집니다. ' +
                  '바른 명단은 이어서 <b>[＋ 등록부 추가]</b>로 다시 올립니다.</div>' +
                  '<div class="edu-modal-row"><label class="form-label" for="erd-cancel-reason">정정 사유 <span style="color:var(--status-danger-fg)">*</span></label><textarea class="form-textarea" id="erd-cancel-reason" rows="2"></textarea></div>'
                : '<p style="font-size:var(--fs-12);color:var(--text-gray);margin-top:8px;">등록부와 서명부 파일이 삭제됩니다.</p>'),
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDURD.doCancel(\'' + esc(deptId) + '\')">' + (c.status === 'DONE' ? '이수 기록 정정' : '등록 취소') + '</button>');
    }
    function doCancel(deptId) {
        if (!canCancel(enrollOfDept(deptId))) { V().closeModal(); deny(deptId); return; }
        var lock = cancelLock(deptId);
        if (lock) { V().closeModal(); toast(lock); return; }
        var c = E().courseOf(state.courseId);
        var reason = c && c.status === 'DONE' ? ((document.getElementById('erd-cancel-reason') || {}).value || '').trim() : '';
        if (c && c.status === 'DONE' && !reason) { toast('정정 사유를 입력하세요.'); return; }
        /* 정정의 처리자는 실제 접속자다(SCR-EDU-004 §3 — 사유·처리자·시각을 남긴다).
           부서 담당자도 자기 부서 기록을 정정하므로 '재난안전과'로 박으면 이력이 거짓이 된다 */
        var r = c && c.status === 'DONE'
            ? E().cancelCompletedEnroll(state.courseId, deptId, reason, actor())
            : E().removeEnroll(state.courseId, deptId);
        if (r) {
            E().pushCourseHistory(state.courseId, {
                type: 'STATUS', by: actor(),
                memo: (c && c.status === 'DONE' ? '이수 기록 정정(원 등록부 «정정됨») · 사유 ' + reason : '참석자 등록부 등록 취소') + ' · ' + r.workers + '명' + (r.records ? ' · 이수기록 ' + r.records + '건 집계 제외' : '')
            });
        }
        V().closeModal();
        toast(r ? (c && c.status === 'DONE' ? E().deptName(deptId) + ' 이수 기록을 정정했습니다 — 바른 명단은 [＋ 등록부 추가]로 올립니다.' : E().deptName(deptId) + ' 등록부를 취소했습니다.') : '등록 내역이 없습니다.');
        render();
    }

    function applySignFrom(v) { captureApply(); G.signFrom = v; G.why = ''; renderApply(); }
    /* =============== 참석자 없음 — 공문 없이 할 일을 끝낸다 =============== */
    function setNoAttend() {
        var c = E().courseOf(state.courseId); if (!c || !G) return;
        if (!E().canActOwnDept(G.deptId)) { deny(G.deptId); return; }
        /* 종료 뒤에도 — 등록부 할 일이 남으므로 끝낼 수단도 남긴다(11-17 개발 확인 요청 3-2) */
        if (c.status === 'CANCELLED') { toast('취소된 교육입니다.'); return; }
        E().setNoAttend(c.id, G.deptId, true, actor());
        E().pushCourseHistory(c.id, { type: 'STATUS', by: actor(), memo: '참석자 없음 — ' + E().deptName(G.deptId) });
        V().closeModal(); toast(E().deptName(G.deptId) + ' — 참석자 없음으로 처리했습니다.'); render();
    }
    function undoNoAttend() {
        var c = E().courseOf(state.courseId); if (!c) return;
        var d = global.DYROLE && global.DYROLE.deptId ? global.DYROLE.deptId() : '';
        if (!E().canActOwnDept(d) || c.status === 'CANCELLED') { deny(d); return; }
        E().setNoAttend(c.id, d, false); E().pushCourseHistory(c.id, { type: 'STATUS', by: actor(), memo: '참석자 없음 되돌림 — ' + E().deptName(d) });
        render();
    }
    /* =============== 서명부 올리기 (재난안전과 — 한 장 서명부를 교육에 한 번) =============== */
    var SG = null;
    function openSign() {
        var c = E().courseOf(state.courseId); if (!c) return;
        if (!E().isOwnerStaff()) { toast('서명부는 재난안전과 담당자가 올립니다.'); return; }
        if (!E().enrollOpen(c) && c.status !== 'DONE') { toast('교육이 끝난 뒤 올립니다.'); return; }
        SG = { file: c.signSheet && c.signSheet.file || '' };
        renderSign();
    }
    function renderSign() {
        var c = E().courseOf(state.courseId);
        V().openModal('서명부 올리기 — ' + esc(c.desc),
            '<p class="file-hint" style="margin:0 0 8px;">교육 때 받은 서명부를 한 번 올리면 부서가 등록부 창에서 «재난안전과가 올린 서명부 사용»으로 골라 씁니다(파일을 새로 받지 않습니다).</p>' +
            (SG.file ? '<span style="color:var(--main-dark);font-weight:var(--fw-bold);font-size:var(--fs-12);">' + esc(SG.file) + '</span> <button type="button" class="btn btn-sm btn-outline" onclick="EDURD.signClear()" aria-label="서명부 지우기">×</button>'
                : V().uploadDrop('<b>서명부 스캔을 끌어다 놓거나 눌러서 선택</b>', 'EDURD.signPick()', { hint: true })),
            '<button type="button" class="btn btn-outline" onclick="EDURD.signSkip()">필요 없음(부서가 따로 받음)</button>' +
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDURD.doSign()">저장</button>');
    }
    function signPick() { SG.file = String(E().courseOf(state.courseId).date || '').replace(/-/g, '') + '_집합교육_서명부.pdf'; renderSign(); }
    function signClear() { SG.file = ''; renderSign(); }
    function doSign() {
        var c = E().courseOf(state.courseId); if (!c || !E().isOwnerStaff()) return;
        if (!SG.file) { toast('서명부를 올려 주세요.'); return; }
        E().setSignSheet(c.id, { file: SG.file, by: actor() });
        E().pushCourseHistory(c.id, { type: 'STATUS', by: actor(), memo: '서명부 올림 — ' + SG.file });
        /* 아직 등록부를 안 올린 대상 부서에 알린다 — 그 부서는 이걸로 할 일이 있다 */
        var L = global.DYLayout, n = 0;
        E().courseTargetDepts(c).forEach(function (d) {
            if (d === ((global.DYROLE && global.DYROLE.OWNER_DEPT) || 'safety') || enrollOfDept(d) || E().noAttendOf(c.id, d)) return;
            try { if (L && L.ntfPush) { L.ntfPush({ cat: 'edu', catLabel: '교육', toDept: d, title: '서명부가 올라왔습니다 — ' + c.desc + ' · 참석자 등록부를 올려 주세요', href: 'edu-reg-detail.html?id=' + encodeURIComponent(c.id) + '&apply=1', work: 'my-work.html', basis: 'osh-29' }); n++; } } catch (e) {}
        });
        V().closeModal(); toast('서명부를 올렸습니다' + (n ? ' — 아직 등록부를 안 올린 ' + n + '개 부서에 알렸습니다' : '') + '.'); render();
    }
    function signSkip() {
        var c = E().courseOf(state.courseId); if (!c || !E().isOwnerStaff()) return;
        E().setSignSheet(c.id, { skip: true, by: actor() });
        V().closeModal(); toast('서명부는 부서가 따로 올립니다.'); render();
    }
    /* =============== ③ 출장 결과 보고서 (재난안전과 — 교육 자료 · 교육 사진 · 참석 인원) =============== */
    var TR = null;
    function openTrip() {
        var c = E().courseOf(state.courseId); if (!c) return;
        if (!E().isOwnerStaff()) { toast('출장 결과 보고서는 재난안전과 담당자가 씁니다.'); return; }
        if (!E().isFlow2(c) || (c.status === 'OPEN' && !E().enrollOpen(c))) { toast('교육이 끝난 날부터 씁니다.'); return; }
        if (E().lockAt(E().keyTrip(c.id))) { toast('출장 결과 보고 공문을 보내 고칠 수 없습니다.'); return; }
        var t = c.trip || {};
        /* 교육 자료는 등록 때 올린 파일을 참조로 불러온다 — 두 벌 만들지 않는다 */
        var mats = (t.files || (c.files || []).filter(function (f) { return f.slot === 'material'; }).map(function (f) { return { name: f.name, slot: 'material', ref: true }; }));
        TR = { headcount: t.headcount || '', files: mats.filter(function (f) { return f.slot !== 'photo'; }), photos: (t.files || []).filter(function (f) { return f.slot === 'photo'; }) };
        renderTrip();
    }
    function enrolledCount(c) { return E().enrolls(c.id).reduce(function (n, e) { return n + (e.workerIds || []).length; }, 0); }
    function renderTrip() {
        var c = E().courseOf(state.courseId);
        var list = function (arr, kind) {
            return arr.map(function (f, i) { return '<div style="font-size:var(--fs-12);">📎 ' + esc(f.name) + (f.ref ? ' <span class="file-hint">등록 때 올린 파일</span>' : '') +
                ' <button type="button" class="btn btn-sm btn-outline" onclick="EDURD.tripDel(\'' + kind + '\',' + i + ')" aria-label="빼기">×</button></div>'; }).join('');
        };
        V().openModal('출장 결과 보고서 — ' + esc(c.desc),
            '<div class="edu-modal-row"><label class="form-label">교육 자료 <span style="color:var(--status-danger-fg)">*</span></label>' + list(TR.files, 'files') +
                V().uploadDrop('<b>교육 자료를 끌어다 놓거나 눌러서 선택</b>', 'EDURD.tripAdd(\'files\')', { hint: true }) + '</div>' +
            '<div class="edu-modal-row"><label class="form-label">교육 사진 <span style="color:var(--status-danger-fg)">*</span></label>' + list(TR.photos, 'photos') +
                V().uploadDrop('<b>교육 사진을 끌어다 놓거나 눌러서 선택</b>', 'EDURD.tripAdd(\'photos\')', { hint: true, profile: 'image' }) + '</div>' +
            '<div class="edu-modal-row"><label class="form-label" for="erd-trip-n">참석 인원 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<div style="display:flex;align-items:center;gap:8px;"><input type="number" class="form-input" id="erd-trip-n" min="1" value="' + esc(TR.headcount) + '" style="width:120px;"> 명 ' +
                '<span class="file-hint">대략적인 수 · 참고: 등록부 기준 ' + enrolledCount(c) + '명(현재)</span></div>' +
                '<p class="file-hint">참석 인원은 보고용입니다 — 이수는 부서 등록부로 셉니다.</p></div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDURD.doTrip()">저장하고 공문 작성 →</button>');
    }
    function tripCap() { var el = document.getElementById('erd-trip-n'); if (el && TR) TR.headcount = el.value; }
    function tripAdd(kind) {
        tripCap();
        var c = E().courseOf(state.courseId), day = String(c.date || '').replace(/-/g, '');
        if (kind === 'photos') TR.photos.push({ name: day + '_교육사진_' + (TR.photos.length + 1) + '.jpg', slot: 'photo' });
        else TR.files.push({ name: day + '_교육자료_' + (TR.files.length + 1) + '.pdf', slot: 'material' });
        renderTrip();
    }
    function tripDel(kind, i) { tripCap(); TR[kind].splice(i, 1); renderTrip(); }
    function doTrip() {
        tripCap();
        var c = E().courseOf(state.courseId); if (!c || !E().isOwnerStaff()) return;
        if (!TR.files.length) { toast('교육 자료를 올려 주세요.'); return; }
        if (!TR.photos.length) { toast('교육 사진을 올려 주세요.'); return; }
        if (!(+TR.headcount >= 1)) { toast('참석 인원을 1명 이상 적어 주세요.'); return; }
        if (!E().setTrip(c.id, { headcount: +TR.headcount, files: TR.files.concat(TR.photos), by: actor() })) { toast('출장 결과 보고 공문을 보내 고칠 수 없습니다.'); return; }
        E().pushCourseHistory(c.id, { type: 'STATUS', by: actor(), memo: '출장 결과 보고서 저장 · 참석 약 ' + TR.headcount + '명' });
        render();
        if (global.EDUDOC) { global.EDUDOC.open(E().keyTrip(c.id)); return; }
        V().closeModal();
    }

    /* =============== 교육 종료 처리 =============== */
    function closeCourse() {
        var c = E().courseOf(state.courseId); if (!c) return;
        /* 종료 처리는 되돌릴 수 없다 — 그 교육을 연 쪽(집합교육 = 재난안전과 담당자)만 한다 */
        if (!E().canActCourse(c)) { deny(E().courseDeptOf(c)); return; }
        if (!E().enrollOpen(c)) { toast('교육이 끝난 뒤 종료 처리합니다.'); return; }
        var enrolls = E().enrolls(state.courseId);
        var due = E().enrollDue(c), early = due && E().today() <= due;
        var totalCnt = enrolls.reduce(function (n, e) { return n + (e.workerIds || []).length; }, 0);
        /* 남은 것을 수로 — 막지는 않는다(기한을 넘긴 부서 때문에 종료가 막히면 이수현황이 비어 있게 된다) */
        var left = '';
        if (E().isFlow2(c)) {
            var hasE = {}; enrolls.forEach(function (e) { hasE[e.deptId] = 1; });
            var miss = E().courseTargetDepts(c).filter(function (d) { return !hasE[d] && !E().noAttendOf(c.id, d); }).length;
            var undoc = enrolls.filter(function (e) { return e.flow === 2 && E().docState(E().keyEnroll(c.id, e.deptId)) !== 'sent'; }).length;
            var tripLeft = E().tripState(c) !== 'sent';
            /* 셋 다 종료 뒤에도 할 일로 남는다(11-17 개발 확인 요청 3-2) — 미등록 부서는 끝내는 길을 함께 말한다 */
            var stay = [undoc ? '등록부 공문 미기안 <b>' + undoc + '</b>개 부서' : '', tripLeft ? '출장 결과 보고서 ' + (c.trip ? '공문 보내기 전' : '미작성') : ''].filter(Boolean);
            if (miss || stay.length) left = '<div class="check-notice" style="margin-top:8px;">남은 것 — ' +
                (stay.length ? stay.join(' · ') + ' (종료한 뒤에도 할 일로 남습니다)' : '') +
                (miss ? (stay.length ? ' · ' : '') + '등록부 미등록 <b>' + miss + '</b>개 부서 (종료한 뒤에도 할 일로 남습니다 — [＋ 등록부 추가] 또는 [참석자 없음]으로 끝납니다)' : '') + '.</div>';
        }
        V().openModal('교육 종료 처리',
            '<p style="font-size:var(--fs-13);"><b>' + esc(c.desc) + '</b><br>등록 <b>' + enrolls.length + '개 부서 · ' + totalCnt + '명</b>에게 등록부별 실제 참석시간을 카운트합니다.</p>' + left +
            (early ? '<div class="check-notice" style="margin-top:8px;">아직 등록 기한(' + esc(due) + ') 전입니다. 종료한 뒤에 내는 부서의 등록부는 [＋ 등록부 추가]로 받습니다.</div>' : '') +
            '<p style="font-size:var(--fs-12);color:var(--text-gray);margin-top:6px;">' + (early ? '' : '종료한 뒤에 늦게 내는 등록부는 [＋ 등록부 추가]로 받습니다. ') + '등록부가 잘못된 것을 알면 그 부서 줄의 [이수 기록 정정]으로 이수시간을 빼고 [＋ 등록부 추가]로 다시 올립니다 — 그 부서 등록부 제출 공문을 보내기 전까지만 됩니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDURD.doClose()">종료 처리</button>');
    }
    function doClose() {
        var c = E().courseOf(state.courseId); if (!c) return;
        if (!E().canActCourse(c)) { V().closeModal(); deny(E().courseDeptOf(c)); return; }
        if (c.status === 'DONE') { V().closeModal(); toast('이미 종료 처리된 교육입니다.'); return; }
        /* 교육 전에는 종료하지 않는다 — 진입(closeCourse)과 같은 판정을 저장에서도 본다 */
        if (!E().enrollOpen(c)) { V().closeModal(); toast('교육이 끝난 뒤 종료 처리합니다.'); return; }
        var enrolls = E().enrolls(state.courseId);
        var total = 0;
        /* 사람마다 그 사람의 실제 참석시간으로 — 공통값 + 사람별 예외(DYEDU.enrollHours) */
        enrolls.forEach(function (e) { total += E().recordEnrollCompletion(e, c.date); });
        E().updateCourse(state.courseId, { status: 'DONE' });
        E().pushCourseHistory(state.courseId, { type: 'STATUS', by: actor(), memo: '교육 종료 처리 · 등록 ' + total + '명 실제 참석시간 카운트' });
        V().closeModal();
        toast('교육 종료 · ' + total + '명 카운트 완료');
        render();
        tourEvt('closed');
    }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        var qs = new URLSearchParams(location.search);
        state.courseId = qs.get('id');
        if (global.EDUDOC) global.EDUDOC.registerRefresh(render);
        render();
        /* 목록·내 할일에서 바로 그 창으로 — 등록부 창(?apply=1) · 출장 결과 보고서(?trip=1) */
        var c = E().courseOf(state.courseId);
        if (c && qs.get('apply') === '1') setTimeout(openApply, 0);
        if (c && qs.get('trip') === '1') setTimeout(openTrip, 0);
    }
    global.EDURD = {
        init: init, openApply: openApply, applyPickDept: applyPickDept, applyToggle: applyToggle,
        applyAttachSign: applyAttachSign, applyClearSign: applyClearSign, doApply: doApply, hoursOpen: hoursOpen,
        confirmCancel: confirmCancel, doCancel: doCancel, remind: remind,
        applySignFrom: applySignFrom, setNoAttend: setNoAttend, undoNoAttend: undoNoAttend,
        openSign: openSign, signPick: signPick, signClear: signClear, doSign: doSign, signSkip: signSkip,
        openTrip: openTrip, tripAdd: tripAdd, tripDel: tripDel, doTrip: doTrip,
        closeCourse: closeCourse, doClose: doClose
    };
})(window);
