/* =====================================================================
   edu-reg.js · 정기교육 - 현업근로자 (EDU-REG) / 관리감독자 (EDU-SUP 재사용)
   ---------------------------------------------------------------------
   docs/planning/기획-안전보건교육-재설계-v1.md §4. (safe-damyang-v2 이식본 — 표준 치환)
   · 집합교육: 재난안전과 등록 → ① 교육 안내 공문 → (교육 뒤) 부서 참석자 등록부 → ② 등록부 제출 공문
               · 재난안전과 ③ 출장 결과 보고 → 종료 시 카운트 (2026-11-16 통화)
   · 자체교육: 부서 등록 → 즉시 이수 → 같은 창에서 ④ 실시 결과 보고 공문 (2차 통화 · 수정·삭제 없음, 등록 취소 하나)
   · 정원·마감·불참 개념 없음.
   표준: 탭 .sub-tabs · 배지 chip-status+DYV2.toneOf · 표 .table-figma ·
        빈상태 .v2-empty · 부서 선택 ORGPICK('deptId') · 안내 훅 EDUTOUR.onEvent
   ===================================================================== */
(function (global) {
    'use strict';
    var V = function () { return global.DYV2; };
    var E = function () { return global.DYEDU; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }
    function tone(label) { return V().toneOf(label); }
    function chip(label, extra) { return '<span class="chip-status chip-sm ' + (extra || tone(label)) + '">' + esc(label) + '</span>'; }
    function tourEvt(e) { if (global.EDUTOUR) global.EDUTOUR.onEvent(e); }

    /* SUP_MODE=true 면 관리감독자용 (edu-sup.html 이 재사용) */
    var SUP_MODE = false;
    /* 탭별 필터 — 집합/자체가 서로 다른 조건을 쓰므로 탭 전환 시에도 각자 유지 */
    var state = { mount: null, tab: 'group', q: '', st: '', year: '', month: '', dept: '' };
    var F = null;    /* course 등록·수정 폼 */
    var G = null;    /* 참석자 등록부 등록 폼 */

    function groupKind() { return SUP_MODE ? 'SUP_REG' : 'REG_GROUP'; }
    function selfKind()  { return SUP_MODE ? 'SUP_REG' : 'REG_SELF'; }
    function targetWorkers(deptId) {
        var arr = SUP_MODE ? E().supervisorWorkers() : E().fieldWorkers();
        return deptId ? arr.filter(function (w) { return w.deptId === deptId; }) : arr;
    }

    /* ===== 조작 권한 — 판정은 DYEDU(DYROLE.canAct 파생) 한 곳이다 =====
     * 집합교육은 재난안전과가 열고(부서 없는 건 = 주관부서 소관) 부서가 신청하며,
     * 자체교육은 부서가 자기 건을 등록한다. 관리·감독 계층은 조회만 한다.
     * 버튼을 감추는 것만으로는 부족하다 — 진입·저장 함수에도 같은 판정을 건다. */
    function canCreateGroup() { return E().canActCourse({ deptId: '' }); }
    function deny(deptId) { toast(E().denyMsg(deptId)); }
    function actor() { return global.DYROLE && global.DYROLE.actorLabel ? global.DYROLE.actorLabel() : '재난안전과'; }

    function render() {
        if (!state.mount) return;
        var head =
            '<div class="sub-tabs" style="margin-bottom:12px;">' +
                '<button type="button" class="sub-tab' + (state.tab === 'group' ? ' active' : '') + '" onclick="EDUR.setTab(\'group\')">집합교육</button>' +
                '<button type="button" class="sub-tab' + (state.tab === 'self'  ? ' active' : '') + '" onclick="EDUR.setTab(\'self\')">자체교육 (부서)</button>' +
            '</div>';
        /* 관리·감독 계층에는 등록·수정 수단 대신 누가 하는지를 밝힌다(담당자에게는 '') */
        var ro = global.DYROLE && global.DYROLE.readOnlyNote ? global.DYROLE.readOnlyNote('교육 등록·수정') : '';
        state.mount.innerHTML = head + ro + (state.tab === 'group' ? renderGroup() : renderSelf());
    }
    function setTab(t) { state.tab = t; render(); }
    /* 필터 — 검색어 입력 중에도 목록이 갱신되므로 rerender 로 포커스 보존 */
    function setF(k, v) { state[k] = v; EDUFILTER.rerender(render); }
    function resetF() { state.q = ''; state.st = ''; state.year = ''; state.month = ''; state.dept = ''; render(); }

    /* 탭 원본 목록(필터 적용 전) — 연도 옵션 파생과 필터링에 공용 */
    function baseList(tabKey) {
        var list = E().courses({ kind: SUP_MODE ? ['SUP_REG'] : (tabKey === 'group' ? ['REG_GROUP'] : ['REG_SELF']) });
        if (SUP_MODE) list = list.filter(function (c) { return tabKey === 'group' ? !c.deptId : !!c.deptId; });
        return list;
    }
    /* 집합교육 화면 상태 — 칩·필터가 같은 판정을 쓴다 */
    function groupState(c) {
        if (c.status === 'CANCELLED') return 'CANCELLED';
        if (c.status === 'DONE') return 'DONE';
        if (!E().noticeSent(c)) return 'NOTICE';
        return E().enrollOpen(c) ? 'ENROLL' : 'UPCOMING';
    }
    /* 자체교육 공문 상태 — 필터와 칩이 같은 판정을 쓴다 */
    function runState(c) {
        var d = E().latestAt(E().runDocKey(c));
        if (!d) return E().isFlow2(c) ? 'NODOC' : 'LEGACY';
        if (d.status === '결재완료') return 'APPROVED';
        if (d.status === '반려' || d.status === '반송') return 'RETURNED';
        return 'PENDING';
    }
    function isOwnerViewer() {
        var p = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        return !p || p.deptId === ((global.DYROLE && global.DYROLE.OWNER_DEPT) || 'safety') || p.tier === 'head';
    }
    function applyFilter(list, tabKey) {
        return list.filter(function (c) {
            /* «안내 공문 전» 교육은 재난안전과에만 보인다(DYEDU.visibleCourse 한 곳) */
            if (!E().visibleCourse(c)) return false;
            /* 자체교육은 부서 담당자에게 자기 부서 것만 — 채용시교육·현업근로자 명단과 같은 조회 범위(2차 통화 검수 L-1) */
            if (tabKey === 'self' && global.DYROLE && global.DYROLE.inScope && !global.DYROLE.inScope(c.deptId)) return false;
            if (state.st) {
                if (tabKey === 'group' && groupState(c) !== state.st) return false;
                if (tabKey === 'self' && runState(c) !== state.st) return false;
            }
            if (state.year && String(c.date || '').slice(0, 4) !== state.year) return false;
            if (state.month && String(c.date || '').slice(5, 7) !== state.month) return false;
            if (tabKey === 'self' && state.dept && c.deptId !== state.dept) return false;
            return EDUFILTER.match(state.q, [c.desc, c.instructor, c.place, E().deptName(c.deptId)]);
        });
    }
    function filterFields(all, tabKey) {
        /* 상태는 화면에 보이는 칩과 같은 말로 거른다 — 저장값(진행 중·완료) 둘로는 «안내 공문 전»·«등록부 받는 중»을 못 거른다 */
        var stOpts = tabKey === 'group'
            ? [['', '상태 전체']].concat(E().isOwnerStaff() || isOwnerViewer() ? [['NOTICE', '안내 공문 전']] : [])
                .concat([['UPCOMING', '교육 전'], ['ENROLL', '등록부 받는 중'], ['DONE', '완료'], ['CANCELLED', '취소']])
            : [['', '공문 상태 전체'], ['NODOC', '공문 미기안'], ['PENDING', '결재 미완료'], ['APPROVED', '결재 완료'], ['RETURNED', '반려·반송']];
        var fields = [
            { type: 'search', id: 'er-q', value: state.q, placeholder: '제목·강사·장소 검색', on: "EDUR.setF('q', this.value)" },
            { type: 'select', id: 'er-st', value: state.st, label: '상태',
              options: stOpts, on: "EDUR.setF('st', this.value)" },
            { type: 'select', id: 'er-year', value: state.year, label: '연도',
              options: EDUFILTER.yearOptions(all.map(function (c) { return c.date; })), on: "EDUR.setF('year', this.value)" },
            { type: 'select', id: 'er-month', value: state.month, label: '월',
              options: EDUFILTER.monthOptions(), on: "EDUR.setF('month', this.value)" }
        ];
        /* 부서 조건도 조회 범위를 따른다 — 목록은 우리 부서만인데 드롭다운에 전 부서를 두면 «있는데 안 보여준다»로 읽힌다.
           고를 부서가 하나뿐이면 드롭다운을 두지 않는다(CLAUDE.md §12) */
        var depts = tabKey === 'self' ? E().deptCandidates().filter(function (d) {
            return !global.DYROLE || !global.DYROLE.inScope || global.DYROLE.inScope(d.id);
        }) : [];
        if (depts.length > 1) {
            fields.push({ type: 'select', id: 'er-dept', value: state.dept, label: '부서',
                options: [['', '부서 전체']].concat(depts.map(function (d) { return [d.id, d.name]; })),
                on: "EDUR.setF('dept', this.value)" });
        }
        return fields;
    }

    /* =============== 집합교육 =============== */
    function renderGroup() {
        var all = baseList('group');
        var list = applyFilter(all, 'group');
        var head =
            EDUFILTER.bar(filterFields(all, 'group'), {
                count: list.length, unit: '건', reset: 'EDUR.resetF()',
                actions: canCreateGroup()
                    ? '<button type="button" class="btn btn-primary" data-tour="reg-create" onclick="EDUR.openCreate(\'group\')">＋ ' +
                        (SUP_MODE ? '관리감독자 정기(집합) 등록' : '집합교육 등록') + '</button>'
                    : '<span class="file-hint">집합교육은 재난안전과 담당자가 등록합니다</span>'
            });
        var cards = list.length ? list.map(function (c) { return courseCard(c, 'group'); }).join('')
            : '<div class="edu-card"><div class="v2-empty">' +
                (all.length ? '조건에 맞는 집합교육이 없습니다.' : '등록된 집합교육이 없습니다.') + '</div></div>';
        return head + cards;
    }
    function renderSelf() {
        var all = baseList('self');
        var list = applyFilter(all, 'self');
        var head =
            EDUFILTER.bar(filterFields(all, 'self'), {
                count: list.length, unit: '건', reset: 'EDUR.resetF()',
                /* 재난안전과는 검토만 — 자기 부서 몫만 등록한다(2차 통화 · D-4). 버튼이 없는 자리에는 누가 하는지를 밝힌다 */
                actions: (E().canRegister() ? '<button type="button" class="btn btn-primary" data-tour="self-create" onclick="EDUR.openCreate(\'self\')">＋ ' + (E().isOwnerStaff() ? '우리 부서 자체교육 등록' : '자체교육 등록') + '</button>' : '')
            });
        /* 재난안전과에는 한 줄만 — 필터 줄 안에 두면 필터가 세 줄로 밀리고, 조회 계층에는 readOnlyNote 가 같은 말을 한다(2차 통화 검토 C-2) */
        if (E().isOwnerStaff()) head = '<p class="file-hint" style="margin:0 0 10px;">자체교육은 각 부서 담당자가 등록하고 실시 결과 보고 공문을 보냅니다. 재난안전과는 결과를 봅니다.</p>' + head;
        var cards = list.length ? list.map(function (c) { return courseCard(c, 'self'); }).join('')
            : '<div class="edu-card"><div class="v2-empty">' +
                (all.length ? '조건에 맞는 자체교육이 없습니다.' : '등록된 자체교육이 없습니다.') + '</div></div>';
        return head + cards;
    }

    function courseCard(c, tabKey) {
        /* 집합교육은 «안내 공문 전 / 교육 전 / 등록부 받는 중 / 완료 / 취소» — 안내 공문(①)을 보내야 부서에 알려진다(2026-11-16) */
        var grpOpen = tabKey === 'group' && c.status === 'OPEN';
        var gs = tabKey === 'group' ? groupState(c) : '';
        var stChip = tabKey !== 'group' ? (c.status === 'DONE' ? chip('완료') : chip('진행중'))
            : gs === 'CANCELLED' ? chip('취소', tone('반려'))
            : gs === 'DONE' ? chip('완료')
            : gs === 'NOTICE' ? chip('안내 공문 전', tone('대기'))
            : gs === 'ENROLL' ? chip('등록부 받는 중', tone('진행중')) : chip('교육 전', tone('예정'));
        if (tabKey === 'self') stChip = '';
        var sessCnt = E().courseSessions(c).length;
        var enrolls = E().enrolls(c.id);
        var enrolledCnt = enrolls.reduce(function (n, e) { return n + (e.workerIds || []).length; }, 0);
        var enrolledDepts = enrolls.length;
        var deptChip = c.deptId ? '<span class="chip-status chip-sm neutral">' + esc(E().deptName(c.deptId)) + '</span> ' : '';
        /* 집합교육은 상세화면(edu-reg-detail)으로 이동, 자체교육은 인라인 상세 모달 유지 */
        var detailHref = tabKey === 'group' ? 'edu-reg-detail.html?id=' + encodeURIComponent(c.id) : null;
        var actions = '';
        if (detailHref) {
            actions += groupActions(c, gs);
            actions += '<a class="btn btn-primary btn-sm" href="' + detailHref + '">상세 →</a> ';
        } else {
            /* 자체교육 — [결재 상태 칩] [공문 보기](2차 통화 «두 개만») · 그 부서 담당자에게만 [공문 보내기]·[다시 보내기]·«등록 취소».
               [상세]·[수정]·자물쇠 버튼은 걷었다 */
            actions = global.EDUDOC ? global.EDUDOC.runCtl(c) : '';
        }
        if (detailHref) actions += editDeleteBtns(c);
        /* 온나라 결재 상태 칩/상신 버튼 (교육별 = Type 2) */
        /* 공문 기안 — 종료 처리된 교육에만 나타난다(EDUDOC 이 판정).
           상신은 이 자리가 아니라 문서 미리보기에만 있다. */
        var docCtl = global.EDUDOC && detailHref ? '<span class="edu-doc-slot">' + global.EDUDOC.control(c.id) + '</span>' : '';
        return '<div class="edu-course-card' + (gs === 'CANCELLED' ? ' is-muted' : '') + '" data-course-id="' + esc(c.id) + '">' +
            '<div class="edu-course-head">' +
                '<div class="edu-course-title">' + deptChip + esc(c.desc) + ' ' + stChip + '</div>' +
                '<div class="edu-course-actions">' + docCtl + actions + '</div>' +
            '</div>' +
            '<div class="edu-course-meta">' +
                '<span>일시 <b>' + esc(E().courseDateTime(c)) + '</b></span>' +
                '<span>시간 <b>' + c.hours + 'h</b>' + (sessCnt > 1 ? ' (' + sessCnt + '일 합계)' : '') + '</span>' +
                '<span>강사 <b>' + esc(c.instructor || '-') + '</b></span>' +
                '<span>장소 <b>' + esc(c.place || '-') + '</b></span>' +
                /* 자체교육은 늘 한 부서다 — «1개 부서»는 정보가 없다(C-7). 대상자 수만 */
                (tabKey === 'self' ? '<span>대상자 <b>' + enrolledCnt + '명</b></span>'
                    : '<span>등록 <b>' + enrolledDepts + '개 부서 · ' + enrolledCnt + '명</b></span>') +
                (grpOpen ? '<span>' + (E().enrollOpen(c) ? '등록 기한 <b>' + esc(E().enrollDue(c)) + '</b>' : '등록부는 <b>' + esc(E().lastSessionDate(c).slice(5)) + '부터</b> · 등록 기한 ' + esc(E().enrollDue(c).slice(5))) + '</span>' : '') +
            '</div>' +
        '</div>';
    }

    /* 결재가 올라간 뒤에는 잠근다 — 판정은 EDUDOC.lockOf 한 곳에서만 한다(CLAUDE.md §4·§7-1).
     * 근거: "공문을 여기다 첨부하면은 문서들에 대한 기록이 남잖아요. 그러면 더 이상 수정이
     * 안 돼요. 이건 문서 위조예요."(2026-07-30 회의)
     * 공문을 올리기 전에는 null 이라 아무 것도 잠기지 않고, [공문 기안] → 미리보기 →
     * 상신을 거친 순간부터 동작한다. 채용시교육(edu-hire.js)·정기교육 상세
     * (edu-reg-detail.js)가 같은 패턴을 쓴다 — 판정을 화면마다 재구현하지 말 것. */
    var SELF_FIX_MSG = '자체교육은 수정·삭제하지 않습니다 — 공문을 보내기 전이나 반려·반송되면 [공문 보기]에서 «등록 취소» 후 다시 등록합니다.';
    function lockOf(courseId) {
        /* 잠금은 **공문 상신**이 건다 — 공문에 붙어 나간 기록을 뒤에서 바꾸는 것이
           문서 위조이기 때문이다. 판정은 EDUDOC.lockOf 한 곳이다. */
        return global.EDUDOC && global.EDUDOC.lockOf ? global.EDUDOC.lockOf(courseId) : null;
    }
    /* 잠금은 버튼이 아니라 «고치는 버튼이 없음»으로 표현한다 — 자물쇠 버튼이 상태 칩과 함께 «결재 완료가 두 개»로 읽혔다(2차 통화) */
    function lockBtn(/* lock */) { return ''; }
    /* 카드 공통 [수정]·[삭제] — 등록만 있고 회수 수단이 없으면 시연을 반복할수록 데이터가 쌓인다.
       그 건을 처리할 수 있는 사람에게만 낸다(자체교육은 등록 부서, 집합교육은 재난안전과) */
    /* 집합교육 카드 버튼 — 역할 × 상태(기획 v2 §4-7).
     *   재난안전과 담당자: 안내 공문 전 [안내 공문 작성] · 등록부 받는 중 [출장 결과 보고서 작성] (종전 [＋ 참석자 등록부 등록] 자리 — 03:37)
     *   부서 담당자: 등록부 받는 중 — 미등록 [＋ 참석자 등록부 등록] / 저장만 [등록부 공문 보내기] / 보냄 ② 칩
     * 등록부 창은 교육 상세 한 곳이다(?apply=1) — 목록과 상세에 같은 창을 두 벌 두지 않는다. */
    function groupActions(c, gs) {
        var D = global.EDUDOC; if (!D) return '';
        var p = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        var href = 'edu-reg-detail.html?id=' + encodeURIComponent(c.id);
        var out = '';
        if (gs === 'NOTICE') return D.ctl(E().keyNotice(c.id), '안내 공문 작성', { primary: true, quiet: true }) + ' ';
        if (E().isFlow2(c) && c.noticeDirty && gs !== 'DONE') out += D.ctl(E().keyNotice(c.id), '', { quiet: true }) + ' ';
        /* 교육 전 — 재난안전과에 ① 안내 공문 상태 칩(v2 §4-7) */
        else if (gs === 'UPCOMING' && E().isFlow2(c) && E().isOwnerStaff()) out += D.ctl(E().keyNotice(c.id), '', { quiet: true, short: '교육 안내' }) + ' ';
        if (gs !== 'ENROLL' && gs !== 'DONE') return out;
        if (E().isOwnerStaff() && E().isFlow2(c)) {
            out += c.trip ? D.ctl(E().keyTrip(c.id), '출장 결과 보고 공문 보내기', { quiet: true, short: '출장 결과' }) + ' '
                : (gs === 'ENROLL' || gs === 'DONE') ? '<a class="btn btn-outline btn-sm" data-tour="edu-trip" href="' + href + '&trip=1">출장 결과 보고서 작성</a> ' : '';
            return out;
        }
        if (!p || p.tier !== 'staff' && !E().canActOwnDept(p.deptId)) return out;
        if (E().courseTargetDepts(c).indexOf(p.deptId) === -1) return out;
        var en = E().enrolls(c.id).filter(function (e) { return e.deptId === p.deptId; })[0];
        /* 종료 뒤에도 ② 는 남는다 — 내 할일과 같게 카드에도 ② 칩/[등록부 공문 보내기](v2 §4-6·§4-7) */
        if (gs === 'DONE') return out + (en && en.flow === 2 ? D.ctl(E().keyEnroll(c.id, p.deptId), '등록부 공문 보내기', { primary: true, quiet: true, short: '등록부 공문' }) + ' ' : '');
        if (gs !== 'ENROLL') return out;
        if (E().noAttendOf(c.id, p.deptId)) return out + chip('참석자 없음', 'neutral') + ' ';
        if (!en) return out + '<a class="btn btn-outline btn-sm" data-tour="apply" href="' + href + '&apply=1">＋ 참석자 등록부 등록</a> ';
        if (en.flow === 2) return out + D.ctl(E().keyEnroll(c.id, p.deptId), '등록부 공문 보내기', { primary: true, quiet: true, short: '등록부 공문' }) + ' ';
        return out;
    }
    function editDeleteBtns(c) {
        var id = c.id;
        /* 집합교육 새 흐름 — 안내 공문 전에는 [수정][삭제], 보낸 뒤에는 [수정][교육 취소](교육 전만). 삭제는 하지 않는다 */
        if (E().isGroupCourse(c) && E().isFlow2(c)) {
            if (!E().canActCourse(c) || c.status === 'CANCELLED') return '';
            var btns = c.status !== 'DONE' ? '<button type="button" class="btn btn-outline btn-sm" onclick="EDUR.openEdit(\'' + id + '\')">수정</button> ' : '';
            if (!E().everSent(E().keyNotice(id))) return btns + '<button type="button" class="btn btn-outline btn-sm" style="border-color:var(--status-danger-border);color:var(--status-danger-fg);" onclick="EDUR.confirmRemove(\'' + id + '\')">삭제</button>';
            if (c.status === 'OPEN' && !E().enrollOpen(c)) btns += '<button type="button" class="btn btn-outline btn-sm" style="border-color:var(--status-danger-border);color:var(--status-danger-fg);" onclick="EDUR.openCancel(\'' + id + '\')">교육 취소</button>';
            return btns;
        }
        var lock = lockOf(id);
        if (lock) return lockBtn(lock);
        if (!E().canActCourse(c)) return '';
        return '<button type="button" class="btn btn-outline btn-sm" onclick="EDUR.openEdit(\'' + id + '\')">수정</button> ' +
            '<button type="button" class="btn btn-outline btn-sm" style="border-color:var(--status-danger-border);color:var(--status-danger-fg);" onclick="EDUR.confirmRemove(\'' + id + '\')">삭제</button>';
    }

    /* 부서 선택 필드 — ORGPICK 인라인 조직도 (신규 select 금지, CLAUDE.md §3).
       전 부서 건을 처리하는 주관부서 담당자만 고른다. 그 밖의 담당자는 소속 부서로 고정하고
       [조직도]를 내지 않는다 — 선택지가 하나인 선택 수단은 «더 있는데 안 나온다»로 읽힌다 */
    function deptField(fieldId, deptId, onpickPath) {
        /* 자체교육은 누구든 소속 부서로 고정한다 — 남의 부서 실시 결과 보고 공문이 섞이지 않게(기획 v2 §10 N, 2026-11-16) */
        var pick = false;
        return '<div class="orgpick-field" id="' + fieldId + '"><div style="display:flex;gap:8px;align-items:center;">' +
            '<input type="text" class="form-input" value="' + esc(E().deptName(deptId)) + '" readonly aria-label="부서" style="flex:1;background:var(--gray-50);">' +
            (pick ? '<button type="button" class="btn btn-sm btn-outline" onclick="ORGPICK.toggle(\'' + fieldId + '\',\'deptId\',\'' + onpickPath + '\')">조직도</button>' : '') +
        '</div>' +
        (pick ? '' : '<p class="file-hint">소속 부서로 등록합니다 — 다른 부서 교육은 그 부서 담당자가 등록하고 실시 결과 보고 공문을 보냅니다.</p>') +
        '</div>';
    }

    /* 회차(일자 탭)·첨부·사진 UI 와 검증은 공용 EDUFORM 단일 출처(채용시교육과 동일 구성) */

    /* =============== 등록 · 수정 =============== */
    function openCreate(mode) {
        if (mode === 'group' ? !canCreateGroup() : !E().canRegister()) { deny(mode === 'group' ? '' : E().defaultDeptId()); return; }
        F = {
            edit: null, mode: mode, kind: mode === 'group' ? groupKind() : selfKind(),
            /* 기본 부서는 로그인한 사람의 소속 — 목록 첫 부서를 기본으로 두면 남의 부서 명의로 저장된다 */
            deptId: mode === 'self' ? E().defaultDeptId() : '',
            sessions: [EDUFORM.newSession({ end: SUP_MODE ? '18:00' : '17:00' })],
            sIdx: 0,
            instructor: '', place: '', desc: '', files: [], photos: [],
            workerIds: {}, enrollDays: 7
        };
        renderCreate();
    }
    /* 수정 — 등록 모달을 그대로 재사용하되 대상자 재선택은 받지 않는다
     * (이미 신청·이수기록이 붙어 있어 대상자를 바꾸면 카운트 정합이 깨지므로,
     *  대상자 변경은 신청 취소 → 재신청 경로로만 처리한다). */
    function openEdit(courseId) {
        var c = E().courseOf(courseId); if (!c) return;
        /* 자체교육(부서 실시 교육)은 수정·삭제가 없다 — 고치는 길은 공문 전·반려 때 «등록 취소»(묶음 전체) 하나(2차 통화).
           버튼만 걷고 함수를 열어 두면 전역 호출로 뚫린다 */
        if (!E().isGroupCourse(c)) { toast(SELF_FIX_MSG); return; }
        /* **버튼을 감추는 것만으로는 부족하다** — 전역 호출로 뚫린다(CLAUDE.md §12·§4).
           권한은 DYEDU.canActCourse, 잠금은 EDUDOC.lockOf 한 곳이고 여기서는 결과만 쓴다. */
        if (!E().canActCourse(c)) { deny(E().courseDeptOf(c)); return; }
        var lock = lockOf(courseId);
        if (lock) { toast('공문이 ' + lock + ' 상태라 수정할 수 없습니다 — 온나라에서 반려·반송되면 다시 열립니다.'); return; }
        /* 회차가 없는 구 데이터는 대표값(date·time)에서 1회차를 파생해 그대로 편집한다 */
        var ss = E().courseSessions(c).map(function (s) { return { date: s.date, start: s.start || '', end: s.end || '' }; });
        if (!ss.length) ss = [{ date: c.date || E().today(), start: c.time || '', end: '' }];
        F = {
            edit: courseId, mode: c.deptId ? 'self' : 'group', kind: c.kind,
            deptId: c.deptId || '', sessions: ss, sIdx: 0, legacyHours: c.hours,
            instructor: c.instructor || '', place: c.place || '', desc: c.desc || '',
            files: (c.files || []).slice(), photos: (c.photos || []).slice(), workerIds: {},
            enrollDays: E().enrollDays(c)
        };
        renderCreate();
    }
    function renderCreate() {
        var body =
            (F.mode === 'self'
                ? '<div class="edu-modal-row"><label class="form-label">부서 <span style="color:var(--status-danger-fg)">*</span></label>' +
                    deptField('er-deptfield', F.deptId, 'EDUR.pickDept') + '</div>'
                : '') +
            EDUFORM.renderSessions(F, 'EDUR') +
            '<div class="edu-modal-row"><label class="form-label" for="er-inst">강사</label>' +
                '<input type="text" class="form-input" id="er-inst" value="' + esc(F.instructor) + '"></div>' +
            '<div class="edu-modal-row"><label class="form-label" for="er-place">장소</label>' +
                '<input type="text" class="form-input" id="er-place" value="' + esc(F.place) + '"></div>' +
            /* «내용» → «제목»(2026-11-16 주무관 «이 내용을 제목으로 바꿔주세요») — 이 값이 카드·상세·공문의 교육 제목이다 */
            '<div class="edu-modal-row"><label class="form-label" for="er-desc">제목 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="text" class="form-input" id="er-desc" value="' + esc(F.desc) + '"></div>' +
            /* 집합교육 — 부서는 교육이 끝난 뒤 참석자 등록부를 올린다. 언제까지인지를 등록할 때 정한다(2026-11-12) */
            (F.mode === 'group'
                ? '<div class="edu-modal-row"><label class="form-label" for="er-enrolldays">참석자 등록부 기한 <span style="color:var(--status-danger-fg)">*</span></label>' +
                    '<div style="display:flex;align-items:center;gap:8px;">마지막 회차가 끝난 뒤 ' +
                    '<input type="number" class="form-input" id="er-enrolldays" min="1" max="30" value="' + esc(F.enrollDays) + '" style="width:90px;"> 일 안에</div>' +
                    '<p class="file-hint">부서는 교육이 끝난 날부터 참석자·실제 참석시간·서명부 스캔을 올립니다. 기한이 지나도 종료 처리 전까지 받습니다.</p></div>'
                : '') +
            /* 첨부 — 집합은 [참석자 명단·교육 자료] 2칸, 자체는 [교육일지 및 교육사진 등] 1칸 (2026-07-30 회의) */
            EDUFORM.renderAttach(F, 'EDUR', F.mode === 'group' ? 'group' : 'done') +
            (F.mode === 'group'
                ? ''
                : (F.edit
                    ? '<div class="check-notice">대상자는 이 화면에서 바꾸지 않습니다 — 이미 반영된 이수시간과 어긋나므로 <b>등록 취소 후 다시 등록</b>으로 처리합니다.</div>'
                    : renderSelfTargets())
            );
        var title = F.edit
            ? (F.mode === 'group' ? '집합교육 수정' : '자체교육 수정')
            : (F.mode === 'group'
                ? (SUP_MODE ? '관리감독자 집합교육 등록' : '집합교육 등록')
                : (SUP_MODE ? '관리감독자 자체교육 등록' : '자체교육 등록'));
        var foot = '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUR.doCreate()">' +
                (F.edit ? '저장' : (F.mode === 'group' ? '저장하고 안내 공문 작성 →' : '저장하고 공문 작성 →')) + '</button>';
        V().openModal(title, body, foot);
    }
    /* 회차 탭 위임 래퍼 — 변경 전 captureCreate 로 입력 보존, 변경 후 재렌더 */
    function sessTab(i) { captureCreate(); F.sIdx = i; renderCreate(); }
    function sessAdd() { captureCreate(); if (!EDUFORM.sessAdd(F)) toast('교육 일자는 최대 ' + EDUFORM.MAX_SESSIONS + '일까지 추가할 수 있습니다.'); renderCreate(); }
    function sessDel(i) { captureCreate(); EDUFORM.sessDel(F, i); renderCreate(); }
    function sessSync() { captureCreate(); renderCreate(); }
    /* 첨부·사진 위임 래퍼 */
    function addFile(slot) { captureCreate(); EDUFORM.addFile(F, slot); renderCreate(); }
    function delFile(i) { captureCreate(); EDUFORM.delFile(F, i); renderCreate(); }

    function renderSelfTargets() {
        var deptId = F.deptId;
        var ws = targetWorkers(deptId);
        var selCnt = Object.keys(F.workerIds).filter(function (k) { return F.workerIds[k]; }).length;
        var rows = ws.length ? ws.map(function (w) {
            var ck = F.workerIds[w.id] ? ' checked' : '';
            return '<label class="edu-tg-member"><input type="checkbox"' + ck +
                ' onchange="EDUR.toggleTarget(\'' + w.id + '\', this.checked)">' +
                '<span>' + esc(w.name) + '</span>' +
                '<span style="color:var(--text-gray);font-size:var(--fs-12);">' + esc(E().catLabel(w.category)) + '</span>' +
            '</label>';
        }).join('') : '<div style="color:var(--text-gray);font-size:var(--fs-12);padding:8px;">이 부서에 대상자가 없습니다.</div>';
        return '<div class="edu-modal-row"><label class="form-label">교육 대상자 <span style="color:var(--status-danger-fg)">*</span> ' +
            '<span style="color:var(--text-gray);font-weight:var(--fw-regular);">(' + selCnt + ' / ' + ws.length + '명 선택)</span></label>' +
            '<div class="edu-tg-body" style="max-height:200px;">' + rows + '</div>' +
        '</div>';
    }
    /* 재렌더 전 입력값 보존 — 회차는 공용 EDUFORM, 메타 필드는 화면 로컬 id */
    function captureCreate() {
        var el = function (id) { return document.getElementById(id); };
        EDUFORM.captureSessions(F);
        if (el('er-inst')) F.instructor = el('er-inst').value.trim();
        if (el('er-place')) F.place = el('er-place').value.trim();
        if (el('er-desc')) F.desc = el('er-desc').value.trim();
        if (el('er-enrolldays')) F.enrollDays = el('er-enrolldays').value;
    }
    function pickDept(id, name) {
        if (!E().canActDept(id)) { deny(id); return; }
        captureCreate();
        F.deptId = id; F.workerIds = {};
        renderCreate();
    }
    function toggleTarget(id, on) {
        captureCreate();
        if (on) F.workerIds[id] = true; else delete F.workerIds[id];
        renderCreate();
    }
    function doCreate() {
        captureCreate();
        /* 저장 경로에도 같은 판정 — 수정이면 원래 건과 바꾼 부서 둘 다 내 소관이어야 한다 */
        var orig = F.edit ? E().courseOf(F.edit) : null;
        var target = F.mode === 'group' ? '' : F.deptId;
        /* 자체교육은 소속 부서로만 — 전역 호출(EDUR.pickDept)로 남의 부서를 넣어도 저장에서 막는다(실시 결과 보고 공문이 섞인다) */
        if (!F.edit && F.mode === 'self' && !E().canActOwnDept(target)) { deny(target); return; }
        if ((orig && !E().canActCourse(orig)) || !E().canActDept(target)) {
            deny(orig && !E().canActCourse(orig) ? E().courseDeptOf(orig) : target);
            return;
        }
        if (!F.desc) { toast('교육 제목을 입력하세요.'); return; }
        if (F.mode === 'group' && !(+F.enrollDays >= 1 && +F.enrollDays <= 30)) { toast('참석자 등록부 기한을 1~30일로 정하세요.'); return; }
        var pr = EDUFORM.sessionPayload(F);
        if (!pr.ok) { F.sIdx = pr.badIdx; renderCreate(); toast(pr.msg); return; }
        var S = pr.payload;
        /* 수정 저장 — 대상자·신청 내역은 건드리지 않고 교육 정보만 갱신 */
        if (F.edit) {
            var before = E().courseOf(F.edit) || {};
            var prevHours = before.hours, prevDate = before.date;
            /* 회차(일시·시간)는 부서가 등록부 공문(②)을 한 곳이라도 보낸 뒤 잠근다 — 실제 참석시간이 실려 나갔다 */
            var sessKey = function (ss) { return JSON.stringify((ss || []).map(function (x) { return [x.date, x.start || x.time || '', x.end || '']; })); };
            /* 회차를 그대로 두면 시간도 그대로 둔다 — 점심시간 등으로 회차 폭과 인정 시간이 다른 기록(예: 09:30~18:30 · 8h)을
               장소만 고쳐도 9h 로 다시 계산해 이수기록을 바꾸고, 등록부 공문 뒤에는 장소 수정까지 막던 결함(2026-11-17 검수) */
            if (sessKey(E().courseSessions(before)) === sessKey(S.sessions) && prevHours != null) S.hours = prevHours;
            var sessChanged = sessKey(E().courseSessions(before)) !== sessKey(S.sessions) || prevHours !== S.hours;
            var sl = E().sessionLock ? E().sessionLock(F.edit) : null;
            if (sl && sessChanged) { toast('부서가 등록부 공문을 보낸 교육이라 일시·시간을 바꿀 수 없습니다 — 강사·장소·제목은 고칠 수 있습니다.'); return; }
            /* 안내 공문(①)을 보낸 교육의 일시·장소를 바꾸면 변경 안내 공문을 다시 보낸다 */
            var needChange = E().isGroupCourse(before) && E().isFlow2(before) && E().everSent(E().keyNotice(F.edit)) &&
                (sessChanged || (before.place || '') !== F.place);
            /* 집합교육 합계를 등록부 참석시간보다 작게 줄이지 않는다 — 그 등록부를 먼저 정정한다 */
            var cf = E().groupHoursConflicts ? E().groupHoursConflicts(F.edit, S.hours) : [];
            if (cf.length) {
                toast('교육시간 ' + S.hours + 'h 가 등록부 참석시간보다 적습니다 — ' +
                    cf.map(function (x) { return x.deptName + ' ' + x.actualHours + 'h'; }).join(', ') +
                    '. 그 등록부를 먼저 정정(등록 취소 후 재등록)하세요.');
                return;
            }
            E().updateCourse(F.edit, {
                deptId: F.deptId, date: S.date, time: S.time, endTime: S.endTime,
                sessions: S.sessions, hours: S.hours,
                instructor: F.instructor, place: F.place, desc: F.desc, files: F.files, photos: F.photos,
                enrollDays: F.mode === 'group' ? +F.enrollDays : undefined
            });
            /* 회차를 고치면 시간이 자동으로 바뀐다 — 이미 쌓인 이수기록도 함께 맞춰야
             * 카드의 교육시간과 이수현황 인정시간이 어긋나지 않는다. */
            /* 회차(시간·일자)를 바꾸지 않은 수정(강사·장소·내용·첨부)은 이수기록을 건드리지 않는다 */
            var synced = (prevHours !== S.hours || prevDate !== S.date)
                ? E().syncCourseRecordHours(F.edit, S.hours, S.date) : 0;
            /* 처리자는 실제 접속자다 — 자체교육은 등록 부서가 고치므로 '재난안전과'로 박으면 이력이 거짓이 된다 */
            E().pushCourseHistory(F.edit, { type: 'STATUS', by: actor(),
                memo: '교육 정보 수정 · ' + F.sessions.length + '일 · ' + S.hours + 'h' +
                    (synced ? ' (이수기록 ' + synced + '건 시간 재반영)' : '') + (needChange ? ' · 일시·장소 변경 — 변경 안내 공문 필요' : '') });
            if (needChange) {
                E().updateCourse(F.edit, { noticeDirty: '변경' });
                toast('일시·장소를 바꿨습니다 — 변경 안내 공문을 보냅니다.');
                render();
                if (global.EDUDOC) global.EDUDOC.open(E().keyNotice(F.edit));
                return;
            }
            V().closeModal();
            toast('교육 정보를 저장했습니다 · 교육시간 ' + S.hours + 'h' + (synced ? ' · 이수기록 ' + synced + '건 갱신' : ''));
            render();
            return;
        }
        if (F.mode === 'self') {
            var ids = Object.keys(F.workerIds).filter(function (k) { return F.workerIds[k]; });
            if (!ids.length) { toast('교육 대상자를 1명 이상 선택하세요.'); return; }
            /* 모집단이 섞이지 않게 — 교육을 만들기 전에 본다(운영 E19, 판정은 DYEDU 한 곳) */
            var popWhy = E().populationIssue(F.kind, ids);
            if (popWhy) { toast(popWhy); return; }
            /* 자체교육 즉시 완료 */
            var c = E().addCourse({
                kind: F.kind, deptId: F.deptId, date: S.date, time: S.time, endTime: S.endTime,
                sessions: S.sessions, hours: S.hours,
                instructor: F.instructor, place: F.place, desc: F.desc, files: F.files, photos: F.photos,
                status: 'DONE', createdBy: E().deptName(F.deptId), byDept: F.deptId
            });
            E().addEnroll({ courseId: c.id, deptId: F.deptId, workerIds: ids, at: S.date });
            E().recordCourseCompletion(c.id, ids, S.hours, S.date);
            E().pushCourseHistory(c.id, { type: 'STATUS', by: E().deptName(F.deptId),
                memo: '자체교육 즉시 완료 · ' + F.sessions.length + '일 ' + S.hours + 'h · 대상자 ' + ids.length + '명 카운트' });
            /* 저장하고 바로 실시 결과 보고 공문(등록 한 번 = 공문 한 번 — 2차 통화). 닫아도 기록·이수는 남고 공문만 «미기안» */
            render();
            if (global.EDUDOC) { global.EDUDOC.open(E().keyRun(E().batchOf(c))); return; }
            V().closeModal();
        } else {
            var gc = E().addCourse({
                kind: F.kind, date: S.date, time: S.time, endTime: S.endTime,
                sessions: S.sessions, hours: S.hours,
                instructor: F.instructor, place: F.place, desc: F.desc, files: F.files, photos: F.photos,
                status: 'OPEN', createdBy: '재난안전과', enrollDays: +F.enrollDays
            });
            /* 저장하고 바로 교육 안내 공문(①) — 00:59 «등록하고 바로 온나라 기안 타는 걸로요» → «예».
               예정 안내 알림은 공문을 보내는 순간 나간다(EDUDOC 저장) — 등록만으로는 부서에 알리지 않는다 */
            tourEvt('created');
            render();
            if (global.EDUDOC) { global.EDUDOC.open(E().keyNotice(gc.id)); return; }
            V().closeModal();
        }
        render();
    }

    /* =============== 참석자 등록부 등록 =============== */
    /* 등록부 창은 교육 상세 한 곳이다 — 목록에서는 상세로 보낸다(같은 창을 두 벌 두지 않는다, 2026-11-16) */
    function openApply(courseId) {
        location.href = 'edu-reg-detail.html?id=' + encodeURIComponent(courseId) + '&apply=1';
    }
    function openApplyLegacy(courseId) {
        var c = E().courseOf(courseId); if (!c) return;
        /* 신청은 부서 담당자가 자기 부서 몫을 올린다(주관부서 담당자는 전 부서) */
        if (!E().canRegister()) { deny(E().defaultDeptId()); return; }
        if (c.status === 'OPEN' && !E().enrollOpen(c)) { toast('교육이 끝난 뒤(' + E().lastSessionDate(c) + '부터) 참석자 등록부를 올립니다.'); return; }
        G = { courseId: courseId, deptId: E().defaultDeptId(), workerIds: {}, signFile: '', actualHours: c.hours, hoursBy: {}, hoursOpen: false };
        renderApply();
    }
    function renderApply() {
        var c = E().courseOf(G.courseId);
        var ws = targetWorkers(G.deptId);
        var selCnt = Object.keys(G.workerIds).filter(function (k) { return G.workerIds[k]; }).length;
        var rows = ws.length ? ws.map(function (w) {
            var ck = G.workerIds[w.id] ? ' checked' : '';
            return '<label class="edu-tg-member"><input type="checkbox"' + ck +
                ' onchange="EDUR.applyToggle(\'' + w.id + '\', this.checked)">' +
                '<span>' + esc(w.name) + '</span>' +
                '<span style="color:var(--text-gray);font-size:var(--fs-12);">' + esc(E().catLabel(w.category)) + '</span>' +
            '</label>';
        }).join('') : '<div style="color:var(--text-gray);font-size:var(--fs-12);padding:8px;">이 부서에 대상자가 없습니다.</div>';

        var body =
            '<div style="font-size:var(--fs-12);color:var(--text-gray);margin-bottom:10px;">' +
                '<b>' + esc(c.desc) + '</b> · 일정 ' + esc(E().courseDateTime(c)) + ' · ' + c.hours + 'h · ' + esc(c.place || '-') +
            '</div>' +
            '<div class="edu-modal-row"><label class="form-label">부서 <span style="color:var(--status-danger-fg)">*</span></label>' +
                deptField('er-applydept', G.deptId, 'EDUR.applyPickDept') + '</div>' +
            '<div class="edu-modal-row"><label class="form-label">근로자 선택 <span style="color:var(--status-danger-fg)">*</span> ' +
                '<span style="color:var(--text-gray);font-weight:var(--fw-regular);">(' + selCnt + ' / ' + ws.length + '명)</span></label>' +
                '<div class="edu-tg-body">' + rows + '</div>' +
            '</div>' +
            /* 실제 참석시간 — 모두에게 같은 시간 + 사람별 예외. 상세 화면·일괄 등록과 같은 블록(EDUFORM) */
            EDUFORM.hoursBlockHtml(G, ws.filter(function (w) { return G.workerIds[w.id]; }), c.hours, 'EDUR') +
            '<div class="edu-modal-row"><label class="form-label">서명부 스캔 <span style="color:var(--status-danger-fg)">*</span></label>' +
                /* 업로드 칸은 전 화면 공용 모양 하나(uploadDrop) — 버튼 하나짜리를 두지 않는다
                   (기획확인 4차 D-1, 2026-10-06). 고른 뒤에는 파일명과 [×]로 바꾼다. 서명부는 한 파일이라 안내도 «1개» */
                (G.signFile
                    ? '<span style="color:var(--main-dark);font-weight:var(--fw-bold);font-size:var(--fs-12);">' + esc(G.signFile) + '</span> ' +
                      '<button type="button" class="btn btn-sm btn-outline" onclick="EDUR.applyClearSign()" aria-label="서명부 지우기">×</button>' +
                      EDUFORM.oneFile(V().fileHint())
                    : EDUFORM.oneFile(V().uploadDrop('<b>서명부 스캔을 끌어다 놓거나 눌러서 선택</b>', 'EDUR.applyAttachSign()', { hint: true }))) +
            '</div>';
        V().openModal('참석자 등록부 등록 · ' + esc(E().deptName(G.deptId)), body,
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUR.doApply()">등록</button>');
    }
    function capApply() { if (G) EDUFORM.captureHours(G); }
    function hoursOpen(o) { if (G) G.hoursOpen = !!o; }
    function applyPickDept(id, name) {
        if (!E().canActOwnDept(id)) { deny(id); return; }
        capApply(); G.deptId = id; G.workerIds = {}; G.hoursBy = {}; renderApply();
    }
    function applyToggle(id, on) { capApply(); if (on) G.workerIds[id] = true; else delete G.workerIds[id]; renderApply(); }
    /* 파일 이름은 교육 일자로 — 내부 교육 번호를 사용자 눈에 띄는 이름에 넣지 않는다(§15) */
    function applyAttachSign() {
        capApply();
        var c = E().courseOf(G.courseId);
        G.signFile = E().deptName(G.deptId) + '_' + String((c && c.date) || E().today()).replace(/-/g, '') + '_참석자서명부.pdf';
        renderApply();
    }
    function applyClearSign() { capApply(); G.signFile = ''; renderApply(); }
    function doApply() {
        /* 등록부는 그 부서 담당자만 — 재난안전과 대리 등록은 걷었다(2026-11-16 통화). 목록 쪽 옛 창이 남아 있어 전역 호출로 뚫리던 길을 막는다 */
        if (!E().canActOwnDept(G.deptId)) { deny(G.deptId); return; }
        var ids = Object.keys(G.workerIds).filter(function (k) { return G.workerIds[k]; });
        if (!ids.length) { toast('근로자를 1명 이상 선택하세요.'); return; }
        if (!G.signFile) { toast('서명부 스캔을 올려 주세요 (필수).'); return; }
        /* 같은 부서가 두 번 쌓이면 이수기록이 이중으로 붙는다 — 정정은 취소 후 재등록 */
        if (E().hasEnroll(G.courseId, G.deptId)) {
            toast(E().deptName(G.deptId) + V().josa(E().deptName(G.deptId), '은', '는') + ' 이미 등록된 부서입니다 — 등록 취소 후 다시 등록하세요.');
            return;
        }
        /* 저장 여부는 데이터 계층이 정한다(중복 부서·모집단 불일치 — 운영 E19).
           반환값을 보지 않으면 저장되지 않았는데 «신청 완료»가 뜬다. */
        capApply();
        var c = E().courseOf(G.courseId);
        var hp = EDUFORM.hoursPayload(G, ids, c ? c.hours : 0);
        if (!hp.ok) { toast(hp.why); return; }
        var pr = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        var enr = { courseId: G.courseId, deptId: G.deptId, workerIds: ids, signFile: G.signFile, at: E().today(),
                    actualHours: hp.actualHours, hoursBy: hp.hoursBy,
                    by: pr ? pr.name : '', proxy: !!(pr && pr.deptId && pr.deptId !== G.deptId) };
        if (!E().addEnroll(enr)) { toast(E().enrollDenyReason(enr) || '등록부를 저장하지 못했습니다.'); return; }
        E().pushCourseHistory(G.courseId, { type: 'STATUS', by: enr.proxy ? actor() + '(대리 등록)' : actor(),
            memo: '참석자 등록부 등록 · ' + ids.length + '명 · 실제 참석 ' + (hp.actualHours == null ? c.hours : hp.actualHours) + 'h' +
                (hp.exceptions ? ' (사람별 ' + hp.exceptions + '명 따로)' : '') + ' · 서명부 첨부' });
        V().closeModal();
        toast(E().deptName(G.deptId) + ' · ' + ids.length + '명 참석자 등록부 등록');
        render();
        tourEvt('applied');
    }

    /* 교육 종료 처리는 **상세 화면 전용**이다(EDURD.closeCourse · SCR-EDU-004 §4-4).
     * 목록에도 두면 되돌릴 수 없는 조작의 진입점이 둘이 되고, 종료 확인창에 필요한
     * 신청 부서·인원을 목록에서 다시 집계해야 한다. 여기 있던 미사용 사본은 제거했다. */
    function confirmRemove(courseId) {
        var c = E().courseOf(courseId); if (!c) return;
        /* 자체교육(부서 실시 교육)은 수정·삭제가 없다 — 고치는 길은 공문 전·반려 때 «등록 취소»(묶음 전체) 하나(2차 통화).
           버튼만 걷고 함수를 열어 두면 전역 호출로 뚫린다 */
        if (!E().isGroupCourse(c)) { toast(SELF_FIX_MSG); return; }
        /* **버튼을 감추는 것만으로는 부족하다** — 전역 호출로 뚫린다(CLAUDE.md §12·§4).
           권한은 DYEDU.canActCourse, 잠금은 EDUDOC.lockOf 한 곳이고 여기서는 결과만 쓴다. */
        if (!E().canActCourse(c)) { deny(E().courseDeptOf(c)); return; }
        var lock = lockOf(courseId);
        if (lock) { toast('공문이 ' + lock + ' 상태라 삭제할 수 없습니다 — 온나라에서 반려·반송되면 다시 열립니다.'); return; }
        if (E().isGroupCourse(c) && E().isFlow2(c) && E().everSent(E().keyNotice(courseId))) { toast('안내 공문을 보낸 교육은 지우지 않고 [교육 취소]로 취소 안내를 보냅니다.'); return; }
        var enrolls = E().enrolls(courseId);
        var cnt = enrolls.reduce(function (n, e) { return n + (e.workerIds || []).length; }, 0);
        var counted = c.status === 'DONE' && cnt;
        V().openModal('교육 삭제',
            '<p style="font-size:var(--fs-13);"><b>' + esc(c.desc) + '</b><br>' +
                esc(E().courseDateTime(c)) + ' · ' + c.hours + 'h</p>' +
            (enrolls.length
                ? '<div class="check-notice" style="margin-top:10px;">참석자 등록부 <b>' + enrolls.length + '개 부서 · ' + cnt + '명</b>' +
                    (counted ? '의 <b>이수시간 ' + c.hours + 'h 반영분도 함께 회수</b>됩니다.' : ' 등록부가 함께 삭제됩니다.') + '</div>'
                : '') +
            '<p style="font-size:var(--fs-12);color:var(--text-gray);margin-top:8px;">삭제 후에는 되돌릴 수 없습니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUR.doRemove(\'' + courseId + '\')">삭제</button>');
    }
    function doRemove(courseId) {
        var c = E().courseOf(courseId);
        if (c && !E().isGroupCourse(c)) { V().closeModal(); toast(SELF_FIX_MSG); return; }
        if (c && !E().canActCourse(c)) { V().closeModal(); deny(E().courseDeptOf(c)); return; }
        /* 확인창을 띄운 뒤에 결재가 올라갔을 수 있다 — 저장 직전에 한 번 더 본다 */
        var lk = lockOf(courseId);
        if (lk) { V().closeModal(); toast('공문이 ' + lk + ' 상태라 삭제할 수 없습니다 — 온나라에서 반려·반송되면 다시 열립니다.'); return; }
        var r = E().removeCourse(courseId);
        V().closeModal();
        toast(r ? '교육을 삭제했습니다 · 등록부 ' + r.enrolls + '건 · 이수기록 ' + r.records + '건 회수' : '교육을 찾을 수 없습니다.');
        render();
    }

    /* =============== 교육 취소 — 안내 공문을 보낸 집합교육, 교육 전에만 · 사유 필수 =============== */
    function openCancel(courseId) {
        var c = E().courseOf(courseId); if (!c) return;
        if (!E().canActCourse(c)) { deny(E().courseDeptOf(c)); return; }
        if (c.status !== 'OPEN' || E().enrollOpen(c)) { toast('교육 취소는 교육 전에만 합니다.'); return; }
        V().openModal('교육 취소',
            '<p style="font-size:var(--fs-13);margin:0 0 8px;"><b>' + esc(c.desc) + '</b><br>' + esc(E().courseDateTime(c)) + '</p>' +
            '<div class="edu-modal-row"><label class="form-label" for="er-cancel">취소 사유 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="text" class="form-input" id="er-cancel" placeholder="예: 강사 사정으로 연기"></div>' +
            '<p class="file-hint">취소하면 이미 안내를 받은 부서에 취소 안내 공문을 보냅니다. 교육은 «취소»로 남고 할 일·이수 집계에서 빠집니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUR.doCancel(\'' + courseId + '\')">취소하고 취소 안내 공문 작성 →</button>');
    }
    function doCancel(courseId) {
        var el = document.getElementById('er-cancel');
        var reason = el ? el.value.trim() : '';
        if (!reason) { toast('취소 사유를 입력하세요.'); return; }
        var c = E().courseOf(courseId);
        if (!c || !E().canActCourse(c)) { V().closeModal(); deny(E().courseDeptOf(c)); return; }
        if (!E().cancelCourse(courseId, reason, actor())) { toast('교육 취소는 교육 전에만 합니다.'); return; }
        render();
        if (global.EDUDOC && E().everSent(E().keyNotice(courseId))) { global.EDUDOC.open(E().keyNotice(courseId)); return; }
        V().closeModal(); toast('교육을 취소했습니다.');
    }

    /* =============== 상세 (자체교육 인라인 모달) =============== */
    function viewDetail(courseId) {
        var c = E().courseOf(courseId); if (!c) return;
        var enrolls = E().enrolls(courseId);
        var enrollRows = enrolls.length ? enrolls.map(function (e) {
            /* 다른 부서 신청자 이름·서명파일은 가린다 — 판정은 DYEDU 한 곳(운영 P05) */
            var names = E().personLabels(e.workerIds);
            var seeSign = E().canSeePerson(e.deptId);
            return '<tr>' +
                '<td>' + esc(E().deptName(e.deptId)) + '</td>' +
                '<td>' + (e.workerIds || []).length + '명</td>' +
                '<td style="font-size:var(--fs-12);color:var(--text-gray);">' + esc(names) + '</td>' +
                '<td>' + (!e.signFile ? '<span style="color:var(--text-gray);font-size:var(--fs-12);">-</span>'
                    : seeSign ? '<span style="color:var(--main-dark);font-size:var(--fs-12);">' + esc(e.signFile) + '</span>'
                    : '<span style="color:var(--text-gray);font-size:var(--fs-12);">제출됨</span>') + '</td>' +
                '<td>' + esc(e.at) + '</td>' +
            '</tr>';
        }).join('') : '<tr><td colspan="5"><div class="v2-empty">등록된 참석자 등록부가 없습니다.</div></td></tr>';
        var hist = (c.history || []).map(function (h) {
            return '<div style="padding:6px 0;border-bottom:1px dashed var(--card-line);font-size:var(--fs-12);">' +
                '<span style="color:var(--text-gray);margin-right:8px;">' + esc(h.at) + '</span>' +
                esc(h.memo) + (h.by ? '<span style="color:var(--text-gray);margin-left:6px;">— ' + esc(h.by) + '</span>' : '') +
            '</div>';
        }).join('');
        V().openModal(esc(E().kindLabel(c.kind)) + ' — 상세',
            '<div style="font-size:var(--fs-13);margin-bottom:10px;">' +
                '<div style="font-weight:var(--fw-bold);">' + esc(c.desc) + '</div>' +
                '<div style="color:var(--text-gray);margin-top:4px;">' +
                    '일정 ' + esc(E().courseDateTime(c)) + ' · ' + c.hours + 'h · 강사 ' + esc(c.instructor || '-') + ' · 장소 ' + esc(c.place || '-') +
                '</div>' +
                ((c.files && c.files.length) ? '<div style="font-size:var(--fs-12);color:var(--main-dark);margin-top:6px;">📎 ' + c.files.map(function (f) { return esc(f.name); }).join(' · ') + '</div>' : '') +
                ((c.photos && c.photos.length) ? '<div style="font-size:var(--fs-12);color:var(--main-dark);margin-top:4px;">📷 교육 사진 ' + c.photos.length + '장 · ' + c.photos.map(function (p) { return esc(p.name); }).join(' · ') + '</div>' : '') +
            '</div>' +
            '<label class="form-label">등록 현황</label>' +
            '<div class="edu-scroll"><table class="table-figma table-compact"><thead><tr>' +
                '<th>부서</th><th>인원</th><th>참석자</th><th>서명부</th><th>등록일</th>' +
            '</tr></thead><tbody>' + enrollRows + '</tbody></table></div>' +
            (hist ? '<label class="form-label" style="margin-top:12px;">이력</label><div>' + hist + '</div>' : ''),
            '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal()">닫기</button>');
    }

    function init(mountId, opts) {
        opts = opts || {};
        SUP_MODE = !!opts.supMode;
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        if (global.EDUDOC) global.EDUDOC.registerRefresh(render);
        /* ?tab=self — 자체교육 탭으로 바로 연다(내 할일 «재촉» 카드의 [자체교육 진행]) */
        var qt = new URLSearchParams(location.search).get('tab');
        if (qt === 'self' || qt === 'group') state.tab = qt;
        render();
        /* ?doc=R|묶음 — 내 할일 «공문 보내기» 카드에서 그 공문 창을 바로 연다 */
        if (global.EDUDOC && global.EDUDOC.openFromQuery) global.EDUDOC.openFromQuery();
    }
    global.EDUR = {
        init: init, setTab: setTab, setF: setF, resetF: resetF,
        openCreate: openCreate, openEdit: openEdit, doCreate: doCreate, toggleTarget: toggleTarget, pickDept: pickDept,
        /* 회차(일자 탭) — 최대 5일, 교육시간 자동 합산 · 첨부/사진 (공용 EDUFORM) */
        sessTab: sessTab, sessAdd: sessAdd, sessDel: sessDel, sessSync: sessSync,
        addFile: addFile, delFile: delFile,
        confirmRemove: confirmRemove, doRemove: doRemove, openCancel: openCancel, doCancel: doCancel,
        openApply: openApply, applyPickDept: applyPickDept, applyToggle: applyToggle,
        applyAttachSign: applyAttachSign, applyClearSign: applyClearSign, doApply: doApply, hoursOpen: hoursOpen,
        viewDetail: viewDetail
    };
})(window);
