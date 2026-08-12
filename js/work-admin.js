/* =========================================================================
 * work-admin.js — 업무 발행 관리 (전역 WKADM) · WRK01-L
 * -------------------------------------------------------------------------
 * 주관부서(재난안전과) 관점. 4탭 — 발행 건 · 연간 캘린더 · 부서 이행 · 발행 규칙.
 *   · 탭은 메뉴가 아니라 뷰다(같은 발행 데이터의 다른 각도)
 *   · '다음 자동 발행' 블록이 **'자동'의 유일한 시각적 증거**다
 *   · 표는 .table-figma · 배지는 chip-status + DYV2.toneOf · 빈상태는 .v2-empty
 *   · 모달은 DYV2.openModal 하나만(§1)
 * ========================================================================= */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var W = function () { return global.DYWORK; };
    var T = function () { return global.DYWORKT; };
    var R = function () { return global.DYROLE; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }
    function chip(label, tone) {
        return '<span class="chip-status ' + (tone || V().toneOf(label)) + '">' + esc(label) + '</span>';
    }

    var state = {
        mount: null, tab: 'issues', autoFired: [], upOpen: null,
        year: 0, fStatus: '', q: '', openOnly: false,
        newTpl: '', newPeriod: '', reviewTpl: '', reviewPeriod: '', reviewDue: '', reviewMemo: '',
    };

    /* 발행·회수는 주관부서 담당자만. 조회는 막지 않는다(§12 두 축). */
    function canIssue() {
        var p = R() && R().current ? R().current() : null;
        if (!p) return true;
        return p.tier === 'staff' && p.deptId === R().OWNER_DEPT;
    }
    function denyIssue() {
        toast('업무 발행·회수는 주관부서(재난안전과) 담당자가 수행합니다 — 조회는 그대로 하실 수 있습니다');
    }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        state.year = +W().today().slice(0, 4);
        /* 자동발행 8종만 **스스로** 나간다 — 사람이 누르지 않는다.
           실 개발에서는 배치 스케줄러가, 프로토타입에서는 화면 진입이 트리거다. */
        state.autoFired = W().autoIssue();
        render();
        if (state.autoFired.length) {
            toast('정기 업무 ' + state.autoFired.length + '건이 자동 발행되었습니다');
        }
    }
    function setTab(t) { state.tab = t; render(); }
    function setYear(y) { state.year = +y; render(); }
    function setF(k, v) { state[k] = v; render(); }
    function toggleOpen(v) { state.openOnly = !!v; render(); }

    /* ================= 렌더 ================= */
    function render() {
        if (!state.mount) return;
        var gap = global.DEPTCHK ? global.DEPTCHK.gap() : { registered: 0, expected: 39, missing: 39 };
        /* 접었을 때도 남는 한 줄은 **지금 상태(부서 등록 갭)** 다 — 설명이 아니라 사실이라
           매일 봐도 값이 있다. 설명문은 접힌다. */
        var notice = V().notice('work-admin',
            '<b>대상 부서 ' + gap.registered + ' / ' + gap.expected + '개 등록</b> · 나머지 ' + gap.missing + '개 명단 미확보',
            '정해진 날짜에 각 부서로 나가는 업무를 관리합니다. 나간 뒤에는 부서별로 얼마나 회수됐는지 확인하고, ' +
            '안 낸 부서에 재촉할 수 있습니다. 발행은 <b>시스템 안에서 업무를 내려보내는 것</b>이며, ' +
            '공문 시행은 온나라에서 별도로 합니다.');
        /* 카드 헤더 제목 제거 — 페이지 제목과 **같은 문자열**이라 60px 를 정보 0 으로 썼다.
           액션은 페이지 제목 줄(.page-head-action)로 올린다(EDUAPV 선례). */
        var head = '';
        injectHeadActions();
        var tabs =
            '<div class="tabs" style="margin-bottom:14px;">' +
                tabBtn('issues', '발행 건', W().issues().filter(function (i) { return i.status !== W().IST.CANCELED; }).length) +
                tabBtn('cal', '연간 캘린더', 0) +
                tabBtn('depts', '부서 이행', 0) +
                tabBtn('rules', '발행 규칙', T().active().length) +
            '</div>';
        var body = state.tab === 'cal' ? viewCalendar()
                 : state.tab === 'depts' ? viewDepts()
                 : state.tab === 'rules' ? viewRules()
                 : viewIssues();
        state.mount.innerHTML = notice + head + viewUpcoming() + tabs + body;
    }
    /* 액션을 페이지 제목 줄로 — 별도 헤더 바(60px)를 없앤다 */
    function injectHeadActions() {
        var host = document.querySelector('.dy-page-title');
        if (!host) return;
        var old = host.querySelector('.page-head-action');
        if (old) old.remove();
        var wrap = document.createElement('div');
        wrap.className = 'page-head-action';
        wrap.innerHTML =
            (canIssue() ? '<button class="btn btn-primary btn-sm" onclick="WKADM.openIssue()">＋ 발생시 업무</button> ' : '') +
            '<button class="btn btn-outline btn-sm" onclick="WKADM.confirmReset()">시연 초기화</button>';
        host.appendChild(wrap);
    }

    function tabBtn(id, label, n) {
        return '<button type="button" class="tab' + (state.tab === id ? ' is-active' : '') +
               '" onclick="WKADM.setTab(\'' + id + '\')">' + esc(label) +
               (n ? ' <span class="wk-tab-n">' + n + '</span>' : '') + '</button>';
    }

    /* ── 자동 발행 블록 ────────────────────────────────────────────────
     * 실측(2026-08-11): 이 블록이 **322px** 를 상시 차지해 첫 데이터 행이 813px
     * 아래로 밀렸다(1280×900 에서 표가 한 줄만 보였다). '자동이 돈다'는 증거는
     * 시연 첫인상에 중요하지만 **매일 여는 사람에게는 벽**이다.
     *   · 기본은 **접힘** — 한 줄 요약(다음 발행 1건)만 남긴다.
     *   · 방금 자동 발행된 건이 있으면 **자동으로 펼친다** — 시연 당일엔 항상
     *     발행분이 있어 펼쳐지고, 평소엔 접힌다. 두 요구를 다 만족시킨다.
     *   · 프로토타입 주석(트리거 차이)은 상시 2줄이 아니라 ⓘ 로 접는다.
     * ================================================================= */
    function viewUpcoming() {
        var up = W().upcoming(3);
        var fired = state.autoFired || [];
        var open = state.upOpen == null ? fired.length > 0 : state.upOpen;
        var next = up[0];
        var lead = fired.length
            ? '<b>정기 업무 ' + fired.length + '건이 방금 자동 발행되었습니다</b>'
            : (next
                ? '다음 발행 <b>' + esc(next.issueDate) + '</b> ' + esc(next.tpl.name) +
                  ' <span class="wk-sub">D-' + V().daysTo(next.issueDate) + '</span>'
                : '올해 남은 정기 발행이 없습니다');
        if (!open) {
            return '<div class="wk-up is-folded">' +
                '<button type="button" class="wk-up-fold" aria-expanded="false" onclick="WKADM.toggleUp()">' +
                    lead + '<span class="wk-up-more">' + (up.length ? '예정 ' + up.length + '건 ' : '') + '▾</span>' +
                '</button></div>';
        }
        /* 펼친 상태에서 **둘을 동시에 보여주지 않는다** — 방금 나간 것이 있으면 그게
         * 지금 확인할 대상이고, 예정은 그때 볼 것이 아니다. 둘 다 펼쳤더니 5행이
         * 되어 블록이 335px 로 커졌다(첫 데이터 872px). 방금 발행분이 있으면
         * 예정은 한 줄 요약으로 접는다. */
        var rows, tail;
        if (fired.length) {
            rows = fired.map(function (m) {
                return '<div class="wk-up-row is-due">' +
                    '<span class="wk-up-date">방금</span>' +
                    '<span class="wk-up-name">' + esc(m.name) + ' <span class="wk-sub">' + esc(m.period) + '</span></span>' +
                    '<span class="wk-up-dept">' + m.depts + '개 부서</span>' +
                    '<span class="wk-up-dday">' + chip('자동 발행됨', 'success') + '</span>' +
                    '<button class="btn btn-sm btn-outline" onclick="WKADM.detail(\'' + esc(m.id) + '\')">상세</button>' +
                    '</div>';
            }).join('');
            tail = next
                ? '<div class="wk-up-empty">다음 발행 ' + esc(next.issueDate) + ' ' + esc(next.tpl.name) +
                  (up.length > 1 ? ' 외 ' + (up.length - 1) + '건' : '') + '</div>'
                : '';
        } else {
            rows = up.map(function (u) {
                return '<div class="wk-up-row">' +
                    '<span class="wk-up-date">' + esc(u.issueDate) + '</span>' +
                    '<span class="wk-up-name">' + esc(u.tpl.name) + '</span>' +
                    '<span class="wk-up-dept">' + u.depts.length + '개 부서</span>' +
                    '<span class="wk-up-dday">D-' + V().daysTo(u.issueDate) + '</span><span></span>' +
                    '</div>';
            }).join('');
            tail = '';
        }
        var missed = W().missedIssues();
        return '<div class="wk-up">' +
            '<button type="button" class="wk-up-fold" aria-expanded="true" onclick="WKADM.toggleUp()">' +
                lead + '<span class="wk-up-more">▴</span></button>' +
            rows + tail +
            '<div class="wk-up-foot">' +
                (missed ? '<span>발행일이 30일 넘게 지나 빠진 회차 ' + missed + '건 — 소급하지 않습니다</span>' : '<span></span>') +
                '<button type="button" class="wk-up-info" onclick="WKADM.upInfo()">ⓘ 자동 발행 방식</button>' +
            '</div></div>';
    }
    function toggleUp() { state.upOpen = !(state.upOpen == null ? (state.autoFired || []).length > 0 : state.upOpen); render(); }
    function upInfo() {
        V().openModal('자동 발행이 도는 방식',
            '<div class="wka-sum">' +
                row('대상', '주기가 있는 업무 <b>' + T().scheduled().length + '종</b> — 월·분기·반기·연') +
                row('트리거', '<b>프로토타입</b>은 이 화면을 열 때 실행합니다.<br><b>실제 시스템</b>은 배치가 새벽에 실행합니다 — 구조는 같고 트리거만 다릅니다.') +
                row('발행 주체', '시스템(<code class="wk-code">시스템 자동발행</code>) — 화면을 연 사람이 아닙니다') +
                row('소급 범위', '발행일 기준 <b>최근 30일</b>까지만. 지나간 회차는 발행하지 않습니다') +
                row('중복 방지', '같은 업무·같은 회차는 두 번 발행되지 않습니다') +
            '</div>',
            '<button class="btn btn-primary" onclick="DYV2.closeModal()">확인</button>');
    }

    /* ── 탭 1 · 발행 건 ── */
    function viewIssues() {
        var list = W().issues().filter(function (i) {
            if (i.status === W().IST.CANCELED) return false;
            if (String(i.periodKey).slice(0, 4) !== String(state.year)) return false;
            if (state.fStatus && i.status !== state.fStatus) return false;
            var tpl = T().byId(i.templateId) || {};
            if (state.q && (tpl.name || '').indexOf(state.q) < 0) return false;
            if (state.openOnly && W().issueStat(i).open === 0) return false;
            return true;
        }).sort(function (a, b) { return String(b.issuedAt).localeCompare(String(a.issuedAt)); });

        var years = [state.year + 1, state.year, state.year - 1];
        var bar =
            '<div class="wk-bar">' +
                '<input type="text" class="form-input wk-q" placeholder="업무명 검색" value="' + esc(state.q) + '" oninput="WKADM.setF(\'q\', this.value)">' +
                '<select class="form-select" onchange="WKADM.setYear(this.value)">' +
                    years.map(function (y) { return '<option value="' + y + '"' + (y === state.year ? ' selected' : '') + '>' + y + '년</option>'; }).join('') +
                '</select>' +
                '<select class="form-select" onchange="WKADM.setF(\'fStatus\', this.value)">' +
                    '<option value="">상태 전체</option>' +
                    ['OPEN', 'CLOSED'].map(function (s) {
                        return '<option value="' + s + '"' + (state.fStatus === s ? ' selected' : '') + '>' + W().IST_LABEL[s] + '</option>';
                    }).join('') +
                '</select>' +
                '<label class="wk-ck"><input type="checkbox"' + (state.openOnly ? ' checked' : '') +
                    ' onchange="WKADM.toggleOpen(this.checked)"> 미회수 있는 건만</label>' +
                '<span class="wk-count">' + list.length + '건</span>' +
            '</div>';

        if (!list.length) {
            return bar + '<div class="v2-empty">조건에 맞는 발행 건이 없습니다.<br>' +
                '<span style="color:var(--text-gray);">자동 대상은 발행일에 생성되고, 담당자 확인 대상은 ' +
                '<b>연간 캘린더</b>에서 발행합니다. 사건형 업무는 [＋ 발생시 업무]로 만듭니다.</span></div>';
        }
        var canScope = R().canScopeDept && R().canScopeDept();
        var rows = list.map(function (i) {
            var tpl = T().byId(i.templateId) || {};
            var s = W().issueStat(i);
            var dd = V().daysTo(i.due);
            var adv = W().remindAdvice(i);
            var open = i.status === W().IST.OPEN;
            var clickable = canScope && open;
            /* 배정 현황을 숫자 하나로 — '몇 곳이 아직 담당자가 없나'가 주관부서의 관심사다 */
            var asg = s.unassigned
                ? '<b class="wk-none">' + s.unassigned + '곳 미배정</b>'
                : '<span class="wk-sub">전부 배정됨</span>';
            return '<tr class="' + (clickable ? 'is-click' : '') + '"' +
                (clickable ? ' tabindex="0" role="button"' +
                    ' aria-label="' + esc((tpl.name || '') + ' 대상 부서 ' + s.total + '개 — 눌러서 조정') + '"' +
                    ' onclick="WKADM.scopeDept(\'' + esc(i.id) + '\')"' +
                    ' onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();WKADM.scopeDept(\'' + esc(i.id) + '\')}"' : '') +
                '>' +
                '<td><b>' + esc(tpl.name || i.templateId) + '</b>' +
                    '<div class="wk-sub">' + esc(i.periodLabel) + ' · ' + esc(i.issuedAt) + ' ' +
                    (i.origin === 'SCHEDULED' ? '자동' : '수동') + ' 발행</div></td>' +
                '<td class="wk-nowrap"><b>' + s.total + '개 부서</b>' +
                    (clickable ? '<div class="wk-rowcta">조정 ›</div>' : '<div class="wk-sub">' + esc(T().scopeLabel(tpl)) + '</div>') + '</td>' +
                '<td class="wk-nowrap"><span class="wk-dday' + (dd == null ? '' : (dd < 0 ? ' is-over' : (dd <= 7 ? ' is-soon' : ''))) + '">' +
                    (dd == null ? '' : (dd < 0 ? 'D+' + (-dd) : (dd === 0 ? 'D-day' : 'D-' + dd))) + '</span>' +
                    '<div class="wk-sub">' + esc(i.due) + '</div></td>' +
                '<td>' + asg + '</td>' +
                '<td>' + gauge(s.pct) + '<div class="wk-sub">회수 ' + s.done + ' / ' + s.total + '</div></td>' +
                '<td class="wk-nowrap">' + chip(W().IST_LABEL[i.status]) +
                    (adv ? '<div class="wk-warn">촉구 권고 ' + adv.n + '곳</div>' : '') + '</td>' +
                '<td class="wk-nowrap">' +
                    '<button class="btn btn-sm btn-outline" onclick="event.stopPropagation();WKADM.detail(\'' + esc(i.id) + '\')">상세</button>' +
                    (s.open && open && R().canRemind('')
                        ? ' <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();WKADM.remindAll(\'' + esc(i.id) + '\')">재촉 ' + s.open + '</button>' : '') +
                '</td></tr>';
        }).join('');
        var hint = canScope
            ? '<p class="wk-note">행을 누르면 <b>조직도가 열립니다</b> — 이 업무를 받을 <b>부서</b>를 조정합니다. ' +
              '담당자는 각 부서가 정합니다.</p>' : '';
        return bar + hint +
            '<div class="wk-scroll"><table class="table-figma table-compact wk-rowtable"><thead><tr>' +
            '<th>업무</th><th>대상 부서</th><th>기한</th><th>배정</th><th>회수</th><th>상태</th><th></th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    function gauge(pct) {
        return '<div class="progress" style="width:96px;"><div class="progress-bar" style="width:' + pct + '%;"></div></div>';
    }

    /* ── 탭 2 · 연간 캘린더 ── */
    function viewCalendar() {
        var y = state.year, t0 = W().today();
        var cells = [];
        for (var m = 1; m <= 12; m++) cells.push({ m: m, items: [] });
        T().active().forEach(function (tpl) {
            W().planOf(tpl.id, y).forEach(function (pl) {
                var m = +pl.issueDate.slice(5, 7);
                var iss = W().issueByKey(pl.templateId + '|' + pl.periodKey);
                cells[m - 1].items.push({ pl: pl, tpl: tpl, iss: iss });
            });
        });
        var rows = cells.map(function (c) {
            var chips = c.items.sort(function (a, b) { return a.pl.issueDate.localeCompare(b.pl.issueDate); })
                .map(function (it) {
                    var done = !!it.iss;
                    var mode = it.tpl.issueMode === 'SCHEDULED' ? 'sch' : 'man';
                    var action = done
                        ? 'detail(\'' + esc(it.iss.id) + '\')'
                        : (it.tpl.issueMode === 'MANUAL_REVIEW'
                            ? 'reviewPlan(\'' + esc(it.tpl.id) + '\',\'' + esc(it.pl.periodKey) + '\')'
                            : 'ruleInfo(\'' + esc(it.tpl.id) + '\')');
                    return '<button type="button" class="wk-cal-chip ' + (done ? 'is-done' : 'is-plan') + ' ' + mode + '"' +
                        ' onclick="WKADM.' + action + '">' +
                        '<span class="wk-cal-d">' + esc(it.pl.issueDate.slice(5)) + '</span> ' + esc(it.tpl.name) +
                        '</button>';
                }).join('');
            var isNow = (+t0.slice(0, 4) === y && +t0.slice(5, 7) === c.m);
            return '<div class="wk-cal-row' + (isNow ? ' is-now' : '') + '">' +
                '<div class="wk-cal-m">' + c.m + '월' + (isNow ? '<span class="wk-cal-now">이번 달</span>' : '') + '</div>' +
                '<div class="wk-cal-body">' + (chips || '<span class="wk-cal-none">발행 없음</span>') + '</div>' +
                '</div>';
        }).join('');
        return '<div class="wk-legend">' +
                '<span><i class="wk-dot sch"></i> 정기 자동발행 ' + T().scheduled().length + '종</span>' +
                '<span><i class="wk-dot man"></i> 담당자 확인 후 발행 ' + (T().active().length - T().scheduled().length) + '종</span>' +
                '<span><i class="wk-dot done"></i> 발행 완료</span>' +
            '</div><div class="wk-cal">' + rows + '</div>';
    }

    /* ── 탭 3 · 부서 이행 (업무 × 부서 매트릭스) ── */
    function viewDepts() {
        var open = W().issues().filter(function (i) {
            return i.status === W().IST.OPEN && String(i.periodKey).slice(0, 4) === String(state.year);
        });
        if (!open.length) return '<div class="v2-empty">' + state.year + '년 진행 중인 발행 건이 없습니다.</div>';
        var depts = V().orgDepts().filter(function (d) { return R().inScope(d.id); });
        var head = '<tr><th>부서</th><th>대상</th><th>완료</th><th>미배정</th>' +
            open.map(function (i) {
                var tpl = T().byId(i.templateId) || {};
                return '<th class="wk-mx-h" title="' + esc(tpl.name) + '">' + esc((tpl.name || '').slice(0, 6)) + '</th>';
            }).join('') + '<th>관리</th></tr>';
        var body = depts.map(function (d) {
            var mine = open.filter(function (i) { return (i.depts || []).indexOf(d.id) >= 0; });
            if (!mine.length) return '';
            var tasks = mine.map(function (i) { return W().taskOf(i.id, d.id); });
            var done = tasks.filter(function (t) { return W().deptDone(t); }).length;
            var un = tasks.filter(W().isUnassigned).length;
            return '<tr>' +
                '<td><b>' + esc(d.name) + '</b><div class="wk-sub">' + d.count + '명</div></td>' +
                '<td>' + mine.length + '</td><td>' + done + '</td>' +
                '<td>' + (un ? '<b style="color:var(--status-warning-fg);">' + un + '</b>' : '0') + '</td>' +
                open.map(function (i) {
                    if ((i.depts || []).indexOf(d.id) < 0) return '<td class="wk-mx-x">·</td>';
                    var t = W().taskOf(i.id, d.id);
                    if (W().deptDone(t)) return '<td>' + chip('완료') + '</td>';
                    if (W().isUnassigned(t)) return '<td>' + chip('미배정') + '</td>';
                    if (t.status === W().TST.SUBMITTED) return '<td>' + chip('제출') + '</td>';
                    return '<td>' + chip('미제출') + '</td>';
                }).join('') +
                '<td class="wk-nowrap">' +
                    (R().canRemind('') && (mine.length - done)
                        ? '<button class="btn btn-sm btn-outline" onclick="WKADM.remindDept(\'' + esc(d.id) + '\')">독촉</button>' : '') +
                '</td></tr>';
        }).join('');
        return '<p class="wk-note">진행 중인 발행 건을 부서 축으로 본 표입니다. ' +
            '완료는 <b>각 업무의 처리 화면</b>(이행점검·교육 등)에서 파생됩니다 — 여기서 완료를 찍지 않습니다.</p>' +
            '<div class="wk-scroll"><table class="table-figma table-compact table-nowrap"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
    }

    /* ── 탭 4 · 발행 규칙 ── */
    function viewRules() {
        var rows = T().active().map(function (t) {
            var thin = t.dueBasis && t.dueBasis.n > 0 && t.dueBasis.n < 5;
            var timing = t.confidence.timing;
            return '<tr>' +
                '<td class="wk-nowrap"><code class="wk-code">' + esc(t.id) + '</code></td>' +
                '<td><b>' + esc(t.name) + '</b><div class="wk-sub">' + esc((t.setRef || []).join(' · ') || (t.setNote ? '세트 미귀속' : '')) + '</div></td>' +
                '<td class="wk-nowrap">' + chip(T().modeLabel(t), t.issueMode === 'SCHEDULED' ? 'success' : 'neutral') + '</td>' +
                '<td class="wk-nowrap">' + esc(T().cycleLabel(t)) + '</td>' +
                '<td class="wk-nowrap">' + esc(scheduleText(t)) +
                    (timing === 'Low' ? '<div class="wk-warn">시점 편차 큼</div>' : '') + '</td>' +
                '<td class="wk-nowrap">' + esc(T().scopeLabel(t)) + '</td>' +
                '<td class="wk-nowrap">' + esc(t.dueAnchor === 'PERIOD_END' ? '회차 말일' : 'D+' + (t.dueDays || 0)) +
                    (thin ? '<div class="wk-warn">표본 ' + t.dueBasis.n + '건</div>' : '') + '</td>' +
                '<td class="wk-nowrap"><button class="btn btn-sm btn-outline" onclick="WKADM.ruleInfo(\'' + esc(t.id) + '\')">ⓘ 근거</button></td>' +
                '</tr>';
        }).join('');
        return '<div class="check-notice">' +
                '담양군 5개 부서 5개년 문서 <b>430,089건</b>에서 반복 확인된 업무를 규칙으로 만든 것입니다. ' +
                '기한은 <b>실제로 접수부터 결과 제출까지 걸린 날</b>에서 뽑은 값이며 <b>공문에 적힌 기한이 아닙니다</b> — 부서와 협의해 조정하세요.<br>' +
                '정기 자동발행은 <b>' + T().scheduled().length + '종</b>뿐입니다. 나머지는 발행 시점이 아직 한 자리로 모이지 않아 담당자가 확인하고 내보냅니다.' +
            '</div>' +
            '<div class="wk-scroll"><table class="table-figma table-compact"><thead><tr>' +
            '<th>코드</th><th>업무명 / 법령 세트</th><th>발행 방식</th><th>주기</th><th>발행 시점</th><th>대상</th><th>기한</th><th>근거</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    function scheduleText(t) {
        var k = t.schedule.kind;
        if (k === 'MONTH') return '매월 ' + (t.schedule.issueDay || 14) + '일';
        return (t.schedule.periods || []).map(function (p) { return p.issueMD || '수시'; }).join(' · ');
    }

    /* ── 근거 펼침 — 모달이 아니라 인라인이 원칙이나, 목록 행이 아니라
          독립 조회라 단일 모달로 연다(§1 준수, 적층 없음) ── */
    function ruleInfo(id) {
        var t = T().byId(id); if (!t) return;
        var e = t.evidence || {};
        var b = t.dueBasis || {};
        V().openModal(t.name,
            '<div class="wka-sum">' +
                row('코드', '<code class="wk-code">' + esc(t.id) + '</code>') +
                row('발행 방식', T().modeLabel(t) + ' · ' + T().cycleLabel(t) + ' 주기') +
                row('발행 시점', esc(scheduleText(t))) +
                row('대상 부서', esc(T().scopeLabel(t)) + ' — 명단이 아니라 <b>부서 속성</b>에서 파생합니다') +
                row('기한', t.dueAnchor === 'PERIOD_END' ? '회차 말일' : '발행일 + ' + (t.dueDays || 0) + '일') +
                row('기한 근거', esc(b.metric || '-') + (b.n ? ' · 표본 ' + b.n + '건 · ' + esc(b.years || '') : '') +
                    (b.note ? '<div class="wk-sub">' + esc(b.note) + '</div>' : '')) +
                row('신뢰도', '주기 ' + esc(t.confidence.cycle) + ' / 시점 ' + esc(t.confidence.timing)) +
                row('5개년 실측', (e.docs ? e.docs.toLocaleString() + '건' : '-') +
                    (e.years ? ' · ' + e.years + '개년' : '') + (e.deptCount ? ' · 제출 부서 ' + e.deptCount + '곳' : '') +
                    (e.note ? '<div class="wk-sub">' + esc(e.note) + '</div>' : '')) +
                row('법령 세트', (t.setRef || []).length ? esc(t.setRef.join(' · ')) :
                    '<span style="color:var(--status-warning-fg);font-weight:700;">미귀속</span>' +
                    (t.setNote ? '<div class="wk-sub">' + esc(t.setNote) + '</div>' : '')) +
                row('처리 위치', t.profile === 'menu'
                    ? esc(t.destLabel || '-') + ' 화면에서 처리하고 완료는 그 화면에서 <b>파생</b>됩니다'
                    : '업무 카드에서 <b>첨부</b>로 완료합니다' +
                      ((t.slots || []).length ? '<div class="wk-sub">필요: ' + esc(t.slots.map(function (s) { return s.key + (s.required ? '*' : ''); }).join(' · ')) + '</div>' : '')) +
            '</div>' +
            '<p class="wka-note">기한·발행 시점은 실제 회신 소요일에서 뽑은 <b>추정치</b>입니다. 공문에 적힌 실제 기한은 문서 목록 메타데이터에 없습니다.</p>',
            '<button class="btn btn-primary" onclick="DYV2.closeModal()">확인</button>');
    }
    function row(k, v) { return '<div class="wka-sum-row"><span>' + esc(k) + '</span><b>' + v + '</b></div>'; }

    /* ── 발행 건 상세 (부서별 회수) ── */
    function detail(id) {
        var iss = W().issueById(id); if (!iss) return;
        var tpl = T().byId(iss.templateId) || {};
        var s = W().issueStat(iss);
        var rows = W().tasksOf(id).filter(function (t) { return R().inScope(t.deptId); }).map(function (t) {
            var d = W().decorate(t, iss);
            var st = d.done ? '완료' : (t.status === W().TST.SUBMITTED ? '제출' : (d.unassigned ? '미배정' : '미제출'));
            return '<tr>' +
                '<td><b>' + esc(d.deptName) + '</b></td>' +
                '<td>' + chip(st) + (t.confirm.state === 'RETURNED' ? ' ' + chip('반려') : (t.confirm.state === 'OK' ? ' ' + chip('승인') : '')) + '</td>' +
                '<td>' + esc(t.assign.toName || '—') + (t.assign.toTeam ? '<div class="wk-sub">' + esc(t.assign.toTeam) + '</div>' : '') + '</td>' +
                '<td>' + esc(t.submittedAt || '—') + ((t.files || []).length ? '<div class="wk-sub">첨부 ' + t.files.length + '</div>' : '') + '</td>' +
                '<td class="wk-nowrap">' +
                    (t.status === W().TST.SUBMITTED && t.confirm.state !== 'OK' && canIssue()
                        ? '<button class="btn btn-sm btn-primary" onclick="WKADM.confirmT(\'' + esc(id) + '\',\'' + esc(t.deptId) + '\')">확인</button> ' +
                          '<button class="btn btn-sm btn-outline" onclick="WKADM.returnT(\'' + esc(id) + '\',\'' + esc(t.deptId) + '\')">반려</button>'
                        : '') +
                    (!d.done && R().canRemind('')
                        ? ' <button class="btn btn-sm btn-outline" onclick="WKADM.remindOne(\'' + esc(id) + '\',\'' + esc(t.deptId) + '\')">재촉' +
                          ((t.reminds || []).length ? ' ' + t.reminds.length : '') + '</button>' : '') +
                '</td></tr>';
        }).join('');
        var hist = (iss.history || []).slice().reverse().slice(0, 8).map(function (h) {
            return '<li><b>' + esc(W().HLABEL[h.type] || h.type) + '</b> · ' + esc(h.at) + ' · ' + esc(h.by) +
                   (h.memo ? ' — ' + esc(h.memo) : '') + '</li>';
        }).join('');
        var probeWarn = (tpl.profile === 'menu' && !W().probeAvailable(tpl))
            ? '<p class="wka-note" style="color:var(--status-warning-fg);">이 업무는 완료를 연동 화면에서 파생하는데 원본을 읽을 수 없습니다 — 제출 기록으로 판정합니다.</p>' : '';
        V().openModal(tpl.name + ' — ' + iss.periodLabel,
            '<div class="wka-sum">' +
                row('발행', esc(iss.issuedAt) + ' · ' + esc(iss.issuedBy) + ' · ' + (iss.origin === 'SCHEDULED' ? '정기 자동발행' : '수동 발행')) +
                row('기한', esc(iss.due)) +
                row('회수', s.done + ' / ' + s.total + ' (' + s.pct + '%) · 확인 ' + s.confirmed + ' · 미배정 ' + s.unassigned) +
                row('상태', chip(W().IST_LABEL[iss.status])) +
            '</div>' + probeWarn +
            '<div class="wk-scroll" style="margin-top:12px;"><table class="table-figma table-compact"><thead><tr>' +
            '<th>부서</th><th>상태</th><th>담당자</th><th>제출</th><th>관리</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
            '<div class="wk-hist"><b>이력</b><ul>' + hist + '</ul></div>',
            '<button class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
            (canIssue() && iss.status === W().IST.OPEN
                ? '<button class="btn btn-outline" onclick="WKADM.confirmCancel(\'' + esc(id) + '\')">발행 회수</button>' +
                  '<button class="btn btn-primary" onclick="WKADM.confirmClose(\'' + esc(id) + '\')">배치 종결</button>'
                : ''));
    }

    /* ── 대상 부서 조정 (재난안전과 전용) — 조직도 부서 트리 ──
     * 담당자를 정하는 것이 아니라 **어느 부서 소관인지**만 정한다.
     * 제출·완료한 부서는 뺄 수 없다(이력 변조 방지). */
    var sctx = null;
    function scopeDept(issueId) {
        if (!(R().canScopeDept && R().canScopeDept())) {
            toast('대상 부서 조정은 주관부서(재난안전과) 담당자가 합니다');
            return;
        }
        var iss = W().issueById(issueId); if (!iss) return;
        var sel = {};
        (iss.depts || []).forEach(function (d) { sel[d] = true; });
        sctx = { issueId: issueId, sel: sel };
        renderScope();
    }
    function renderScope() {
        var iss = W().issueById(sctx.issueId);
        var tpl = T().byId(iss.templateId) || {};
        var locked = (iss.depts || []).filter(function (d) {
            var t = W().taskOf(sctx.issueId, d);
            return t && (t.status === W().TST.SUBMITTED || W().deptDone(t) || (t.files || []).length);
        });
        V().openModal('대상 부서 조정 — ' + esc(tpl.name || ''),
            '<div class="wka-sum">' +
                row('회차', esc(iss.periodLabel) + ' · 기한 ' + esc(iss.due)) +
                row('자동 산정 기준', esc(T().scopeLabel(tpl)) +
                    (tpl.deptSource ? '<div class="wk-sub">' + esc(tpl.deptSource) + ' 도메인 명단 기준</div>'
                                    : '<div class="wk-sub">부서 속성 파생 — 실제와 다를 수 있습니다</div>')) +
            '</div>' +
            '<p class="wka-note">이 업무를 받을 <b>부서</b>를 고릅니다. 담당자는 각 부서가 정합니다.' +
                (locked.length ? '<br><b>이미 제출한 ' + locked.length + '개 부서는 뺄 수 없습니다</b> — ' +
                    esc(locked.map(W().deptName).join(' · ')) : '') + '</p>' +
            /* deptsPanel 은 HTML **문자열을 반환**한다(DOM 주입이 아니다) — 본문에 직접 넣는다 */
            global.ORGPICK.deptsPanel('wkadm-scope', {
                selectedPath: 'WKADM._scopeSel', onToggle: 'WKADM._scopeToggle', countId: 'wkadm-scope-n',
            }) +
            '<p class="wka-note">선택 <b id="wkadm-scope-n">' + (iss.depts || []).length + '</b>개 부서</p>',
            '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" onclick="WKADM.saveScope()">적용</button>');
    }
    function _scopeSel() { return sctx ? sctx.sel : {}; }
    function _scopeToggle(deptId, checked) { if (sctx) sctx.sel[deptId] = !!checked; }
    function saveScope() {
        var ids = Object.keys(sctx.sel).filter(function (k) { return sctx.sel[k]; });
        if (!ids.length) { toast('부서를 하나 이상 골라주세요'); return; }
        var r = W().setIssueDepts(sctx.issueId, ids);
        V().closeModal();
        if (!r.ok) { toast(r.msg); return; }
        toast(r.add || r.del
            ? '대상 부서를 조정했습니다 — 추가 ' + r.add + ' · 제외 ' + r.del
            : '변경 사항이 없습니다');
        render();
    }

    /* ── 발행 모달 ── */
    /* 상단 [발생시 업무]는 ADHOC 전용이다. 주기형 MANUAL_REVIEW 업무는 연간
       캘린더의 후보를 눌러 회차·기한을 확인한 뒤 발행한다. */
    function adhocTemplates() {
        return T().active().filter(function (t) { return t.schedule.kind === 'ADHOC'; });
    }
    function openIssue() {
        if (!canIssue()) { denyIssue(); return; }
        var list = adhocTemplates();
        if (!list.length) { toast('발생시 업무가 등록돼 있지 않습니다'); return; }
        if (!list.some(function (t) { return t.id === state.newTpl; })) state.newTpl = list[0].id;
        renderIssueForm();
    }
    function renderIssueForm() {
        var tpl = T().byId(state.newTpl);
        var depts = W().targetDepts(tpl, String(state.year));
        /* 발생시 업무는 **회차가 없다** — 사유와 발생일로 식별한다.
           periodKey 는 'ADHOC-2026-07-16-1' 형태로 만들어 멱등키를 유지한다. */
        state.adhocDate = state.adhocDate || W().today();
        state.adhocMemo = state.adhocMemo || '';
        var body =
            '<p class="wka-note">여기서는 <b>외부 사건으로 생긴 업무</b>만 만듭니다. 주기형 검토 대상은 ' +
                '<b>연간 캘린더</b>에서 회차와 기한을 확인한 뒤 발행합니다.</p>' +
            '<div class="wka-field"><label class="form-label">업무</label>' +
                '<select class="form-select" onchange="WKADM._tpl(this.value)">' +
                adhocTemplates().map(function (t) {
                    return '<option value="' + esc(t.id) + '"' + (t.id === state.newTpl ? ' selected' : '') + '>' +
                        esc(t.name) + '</option>';
                }).join('') + '</select></div>' +
            '<div class="wka-field"><label class="form-label">발생일 <span class="wka-req">*</span></label>' +
                '<input type="date" class="form-input" value="' + esc(state.adhocDate) + '" onchange="WKADM._adhocDate(this.value)"></div>' +
            '<div class="wka-field"><label class="form-label">사유·근거 <span class="wka-req">*</span></label>' +
                '<input type="text" class="form-input" placeholder="예: 2026년 위험성평가 용역 결과 조치사항 접수" ' +
                'value="' + esc(state.adhocMemo) + '" oninput="WKADM._adhocMemo(this.value)"></div>' +
            '<div class="wka-sum">' +
                row('대상 부서', depts.length + '개 — ' + esc(T().scopeLabel(tpl)) +
                    (depts.length ? '<div class="wk-sub">' + esc(depts.map(W().deptName).join(' · ')) + '</div>'
                                  : '<div class="wk-sub" style="color:var(--status-warning-fg);">대상 부서가 없습니다 — 선행 데이터(정기평가 등)를 먼저 등록하세요</div>')) +
                row('기한', '발생일 + ' + (tpl.dueDays || 14) + '일') +
                row('처리 위치', tpl.profile === 'menu' ? esc(tpl.destLabel || '-') + ' 화면' : '업무 카드 첨부') +
            '</div>';
        V().openModal('발생시 업무 생성', body,
            '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            (depts.length ? '<button class="btn btn-primary" onclick="WKADM.doIssue()">생성</button>' : ''));
    }
    function _adhocDate(v) { state.adhocDate = v; }
    function _adhocMemo(v) { state.adhocMemo = v; }

    function _tpl(v) { state.newTpl = v; renderIssueForm(); }
    function _period(v) { state.newPeriod = v; renderIssueForm(); }
    function doIssue() {
        if (!state.adhocMemo.trim()) { toast('사유를 적어주세요 — 발생시 업무는 근거가 있어야 합니다'); return; }
        var seq = W().issues().filter(function (i) { return i.templateId === state.newTpl; }).length + 1;
        var pk = 'ADHOC-' + state.adhocDate + '-' + seq;
        var r = W().issueBatch(state.newTpl, pk, {
            origin: 'MANUAL', issuedAt: state.adhocDate,
            due: null, memo: state.adhocMemo.trim(),
        });
        V().closeModal();
        if (!r.ok) { toast(r.msg); return; }
        state.adhocMemo = '';
        toast('생성했습니다 — 대상 ' + r.issue.depts.length + '개 부서');
        render();
    }
    /* 주기형 검토 대상 — 후보 회차를 담당자가 확인해야만 발행한다. */
    function reviewPlan(templateId, periodKey) {
        if (!canIssue()) { denyIssue(); return; }
        var tpl = T().byId(templateId);
        if (!tpl || tpl.issueMode !== 'MANUAL_REVIEW') { ruleInfo(templateId); return; }
        var plan = W().planOf(templateId, +String(periodKey).slice(0, 4)).filter(function (p) {
            return p.periodKey === periodKey;
        })[0];
        if (!plan) { toast('발행 후보 회차를 찾을 수 없습니다'); return; }
        var dup = W().issueByKey(templateId + '|' + periodKey);
        if (dup) { detail(dup.id); return; }
        state.reviewTpl = templateId;
        state.reviewPeriod = periodKey;
        state.reviewDue = plan.due;
        state.reviewMemo = '';
        renderReviewForm();
    }
    function renderReviewForm() {
        var tpl = T().byId(state.reviewTpl);
        var plan = W().planOf(state.reviewTpl, +String(state.reviewPeriod).slice(0, 4)).filter(function (p) {
            return p.periodKey === state.reviewPeriod;
        })[0];
        if (!tpl || !plan) { V().closeModal(); return; }
        var depts = W().targetDepts(tpl, state.reviewPeriod);
        var body =
            '<p class="wka-note">이 업무는 주기가 있지만 발행일 근거가 충분히 안정되지 않아 자동으로 내보내지 않습니다. ' +
                '이번 회차의 대상과 실제 기한을 확인한 뒤 발행하세요.</p>' +
            '<div class="wka-sum">' +
                row('회차', esc(plan.periodLabel)) +
                row('달력 후보일', esc(plan.issueDate) + '<div class="wk-sub">실측 기반 후보일이며 실제 발행일은 오늘로 기록됩니다</div>') +
                row('대상 부서', depts.length + '개 — ' + esc(T().scopeLabel(tpl)) +
                    (depts.length ? '<div class="wk-sub">' + esc(depts.map(W().deptName).join(' · ')) + '</div>'
                                  : '<div class="wk-sub" style="color:var(--status-warning-fg);">대상 부서가 없어 발행할 수 없습니다</div>')) +
            '</div>' +
            '<div class="wka-field"><label class="form-label">제출 기한 <span class="wka-req">*</span></label>' +
                '<input type="date" class="form-input" value="' + esc(state.reviewDue) + '" onchange="WKADM._reviewDue(this.value)">' +
                '<div class="wk-sub">공문·기관 일정의 기한이 있으면 그 날짜를 입력하고, 없으면 업무 규칙 기본값을 사용합니다.</div></div>' +
            '<div class="wka-field"><label class="form-label">확인 근거 <span class="wka-req">*</span></label>' +
                '<input type="text" class="form-input" maxlength="200" value="' + esc(state.reviewMemo) + '" ' +
                'placeholder="예: 2026년 교육 운영계획 일정 확인" oninput="WKADM._reviewMemo(this.value)"></div>';
        V().openModal('담당자 확인 후 발행 — ' + esc(tpl.name), body,
            '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            (depts.length ? '<button class="btn btn-primary" onclick="WKADM.doReviewIssue()">발행</button>' : ''));
    }
    function _reviewDue(v) { state.reviewDue = v; }
    function _reviewMemo(v) { state.reviewMemo = v; }
    function doReviewIssue() {
        if (!state.reviewDue) { toast('제출 기한을 입력하세요'); return; }
        if (state.reviewDue < W().today()) { toast('제출 기한은 오늘 이후여야 합니다'); return; }
        if (!state.reviewMemo.trim()) { toast('확인 근거를 입력하세요'); return; }
        var r = W().issueBatch(state.reviewTpl, state.reviewPeriod, {
            origin: 'MANUAL', originRef: 'MANUAL_REVIEW', issuedAt: W().today(),
            due: state.reviewDue, memo: state.reviewMemo.trim(),
        });
        V().closeModal();
        if (!r.ok) { toast(r.msg); return; }
        state.reviewMemo = '';
        toast('확인 발행 완료 — 대상 ' + r.issue.depts.length + '개 부서');
        render();
    }

    /* ── 확인·반려·재촉·회수 ── */
    function confirmT(id, deptId) { W().confirmTask(id, deptId); toast('접수 확인했습니다'); detail(id); }
    var rc = null;
    function returnT(id, deptId) {
        rc = { id: id, deptId: deptId, reason: '' };
        V().openModal('제출 반려 — ' + esc(W().deptName(deptId)),
            '<p class="wka-note">반려해도 부서의 <b>제출 상태는 되돌리지 않습니다</b> — 취합 진척이 뒤로 가지 않게 하기 위해서입니다. ' +
            '담당자 화면에 사유가 상시 표시되고, 배치 종결 판정에서 빠집니다.</p>' +
            '<div class="wka-field"><label class="form-label">반려 사유 <span class="wka-req">*</span></label>' +
            '<textarea class="form-input" rows="3" placeholder="무엇을 다시 해야 하는지 적어주세요" oninput="WKADM._rr(this.value)"></textarea></div>',
            '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" onclick="WKADM.saveReturn()">반려</button>');
    }
    function _rr(v) { rc.reason = v; }
    function saveReturn() {
        if (!rc.reason.trim()) { toast('반려 사유를 적어주세요 — 사유 없는 반려는 저장되지 않습니다'); return; }
        W().returnTask(rc.id, rc.deptId, rc.reason.trim());
        var id = rc.id; toast('반려했습니다'); detail(id);
    }
    function remindOne(id, deptId) { W().remind(id, deptId); toast(W().deptName(deptId) + ' 담당자·부서장에게 재촉 알림 발송 (프로토타입)'); detail(id); }
    function remindAll(id) {
        var n = 0;
        W().tasksOf(id).forEach(function (t) { if (!W().deptDone(t)) { W().remind(id, t.deptId); n++; } });
        toast('미제출 ' + n + '개 부서에 재촉 알림 발송 (프로토타입)');
        render();
    }
    function remindDept(deptId) {
        var n = 0;
        W().issues().forEach(function (i) {
            if (i.status !== W().IST.OPEN || (i.depts || []).indexOf(deptId) < 0) return;
            var t = W().taskOf(i.id, deptId);
            if (t && !W().deptDone(t)) { W().remind(i.id, deptId); n++; }
        });
        toast(W().deptName(deptId) + ' — 미완료 ' + n + '건 독촉 (프로토타입)');
        render();
    }
    function confirmCancel(id) {
        var im = W().cancelImpact(id);
        V().openModal('발행 회수',
            '<p class="wka-note">이 배치를 회수하면 아래가 함께 사라집니다. 되돌릴 수 없습니다.</p>' +
            '<div class="wka-sum">' + row('부서 업무', im.depts + '건') + row('배정', im.assigned + '명') +
            row('제출', im.submitted + '건') + row('첨부', im.files + '개') + '</div>',
            '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" onclick="WKADM.doCancel(\'' + esc(id) + '\')">회수</button>');
    }
    function doCancel(id) { W().cancelIssue(id); V().closeModal(); toast('발행을 회수했습니다'); render(); }
    function confirmClose(id) {
        var s = W().issueStat(W().issueById(id));
        V().openModal('배치 종결',
            '<p class="wka-note">종결은 <b>전 부서 완료</b>가 아니라 주관부서가 취합을 마쳤다는 표시입니다. ' +
            '5개년 실측상 전 부서 제출이 성립한 해는 한 번도 없습니다.</p>' +
            '<div class="wka-sum">' + row('회수', s.done + ' / ' + s.total + ' (' + s.pct + '%)') +
            row('미제출', '<b style="color:var(--status-danger-fg);">' + s.open + '개 부서</b>') + '</div>',
            '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" onclick="WKADM.doClose(\'' + esc(id) + '\')">종결</button>');
    }
    function doClose(id) { W().closeIssue(id, '주관부서 취합 종료'); V().closeModal(); toast('배치를 종결했습니다'); render(); }

    function confirmReset() {
        if (!canIssue()) { denyIssue(); return; }
        V().openModal('시연 초기화',
            '<p class="wka-note">발행 배치·배정·제출 기록을 <b>시드 상태로</b> 되돌립니다. 이행점검·교육 등 다른 화면의 데이터는 그대로입니다.</p>',
            '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" onclick="WKADM.doReset()">초기화</button>');
    }
    function doReset() { W().reset(); V().closeModal(); toast('시연 데이터를 초기화했습니다'); render(); }

    global.WKADM = {
        init: init, setTab: setTab, setYear: setYear, setF: setF, toggleOpen: toggleOpen,
        detail: detail, ruleInfo: ruleInfo, openIssue: openIssue, doIssue: doIssue,
        reviewPlan: reviewPlan, doReviewIssue: doReviewIssue,
        scopeDept: scopeDept, saveScope: saveScope, _scopeSel: _scopeSel, _scopeToggle: _scopeToggle,
        _tpl: _tpl, _period: _period, _rr: _rr, _adhocDate: _adhocDate, _adhocMemo: _adhocMemo,
        _reviewDue: _reviewDue, _reviewMemo: _reviewMemo,
        confirmT: confirmT, returnT: returnT, saveReturn: saveReturn,
        remindOne: remindOne, remindAll: remindAll, remindDept: remindDept,
        confirmCancel: confirmCancel, doCancel: doCancel, confirmClose: confirmClose, doClose: doClose,
        confirmReset: confirmReset, doReset: doReset, render: render,
        toggleUp: toggleUp, upInfo: upInfo,
    };
})(window);
