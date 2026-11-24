/* =====================================================================
   edu-reg.js · 정기교육 - 현업근로자 (EDU-REG) / 관리감독자 (EDU-SUP 재사용)
   ---------------------------------------------------------------------
   docs/planning/기획-안전보건교육-재설계-v1.md §4. (safe-damyang-v2 이식본 — 표준 치환)
   · 집합교육: 재난안전과 등록(대상 부서에 바로 보임 · 예정 안내 알림) → (교육 뒤) 부서 참석자 등록부
               · 재난안전과 출장 결과 보고서 → 종료 시 카운트
   · 자체교육: 부서 등록 → 즉시 이수 · 고치는 길은 [등록 취소] 후 다시 등록 하나
   · 교육 공문은 걷었다(2026-11-23 — 기획-안전보건교육-온나라공문제거-20261123-v1). 되살리지 말 것.
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
        /* CANCELLED — 2026-11-23 전 [교육 취소]로 남은 옛 기록 표시용(지금은 만들지 않는다) */
        if (c.status === 'CANCELLED') return 'CANCELLED';
        if (c.status === 'DONE') return 'DONE';
        return E().enrollOpen(c) ? 'ENROLL' : 'UPCOMING';
    }
    function applyFilter(list, tabKey) {
        return list.filter(function (c) {
            /* 자체교육은 부서 담당자에게 자기 부서 것만 — 채용시교육·현업근로자 명단과 같은 조회 범위(2차 통화 검수 L-1) */
            if (tabKey === 'self' && global.DYROLE && global.DYROLE.inScope && !global.DYROLE.inScope(c.deptId)) return false;
            if (state.st && tabKey === 'group' && groupState(c) !== state.st) return false;
            if (state.year && String(c.date || '').slice(0, 4) !== state.year) return false;
            if (state.month && String(c.date || '').slice(5, 7) !== state.month) return false;
            if (tabKey === 'self' && state.dept && c.deptId !== state.dept) return false;
            return EDUFILTER.match(state.q, [c.desc, c.instructor, c.place, E().deptName(c.deptId)]);
        });
    }
    function filterFields(all, tabKey) {
        /* 상태는 화면에 보이는 칩과 같은 말로 거른다 — 저장값(진행 중·완료) 둘로는 «교육 전»·«등록부 받는 중»을 못 거른다.
           자체교육은 등록하면 끝이라 상태가 하나뿐이다 — 고를 것이 없는 조건은 두지 않는다(교육 공문 걷음, 2026-11-23) */
        var fields = [
            { type: 'search', id: 'er-q', value: state.q, placeholder: '제목·강사·장소 검색', on: "EDUR.setF('q', this.value)" }
        ];
        if (tabKey === 'group') fields.push({ type: 'select', id: 'er-st', value: state.st, label: '상태',
              options: [['', '상태 전체'], ['UPCOMING', '교육 전'], ['ENROLL', '등록부 받는 중'], ['DONE', '완료']], on: "EDUR.setF('st', this.value)" });
        fields = fields.concat([
            { type: 'select', id: 'er-year', value: state.year, label: '연도',
              options: EDUFILTER.yearOptions(all.map(function (c) { return c.date; })), on: "EDUR.setF('year', this.value)" },
            { type: 'select', id: 'er-month', value: state.month, label: '월',
              options: EDUFILTER.monthOptions(), on: "EDUR.setF('month', this.value)" }
        ]);
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
        if (E().isOwnerStaff()) head = '<p class="file-hint" style="margin:0 0 10px;">자체교육은 각 부서 담당자가 등록합니다. 재난안전과는 결과를 봅니다.</p>' + head;
        var cards = list.length ? list.map(function (c) { return courseCard(c, 'self'); }).join('')
            : '<div class="edu-card"><div class="v2-empty">' +
                (all.length ? '조건에 맞는 자체교육이 없습니다.' : '등록된 자체교육이 없습니다.') + '</div></div>';
        return head + cards;
    }

    function courseCard(c, tabKey) {
        /* 집합교육은 «교육 전 / 등록부 받는 중 / 완료» — 등록하는 순간 대상 부서에 보인다(교육 공문 걷음, 2026-11-23) */
        var grpOpen = tabKey === 'group' && c.status === 'OPEN';
        var gs = tabKey === 'group' ? groupState(c) : '';
        var stChip = tabKey !== 'group' ? (c.status === 'DONE' ? chip('완료') : chip('진행중'))
            : gs === 'CANCELLED' ? chip('취소', tone('반려'))
            : gs === 'DONE' ? chip('완료')
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
            /* 자체교육 — «등록 {사람} · {날짜}» · 그 부서 담당자에게만 [등록 취소](언제든, 묶음 전체 — 2026-11-23 D-1).
               [상세]·[수정]은 걷었다(2차 통화) */
            actions = EDUFORM.runLine(c);
        }
        if (detailHref) actions += editDeleteBtns(c);
        return '<div class="edu-course-card' + (gs === 'CANCELLED' ? ' is-muted' : '') + '" data-course-id="' + esc(c.id) + '">' +
            '<div class="edu-course-head">' +
                '<div class="edu-course-title">' + deptChip + esc(c.desc) + ' ' + stChip + '</div>' +
                '<div class="edu-course-actions">' + actions + '</div>' +
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

    /* 자체교육은 수정·삭제가 없다 — 고치는 길은 [등록 취소](묶음 전체) 후 다시 등록 하나(2차 통화 · 2026-11-23 D-1).
       교육 공문을 걷어 잠금도 없다 — 등록 취소는 언제든 된다 */
    var SELF_FIX_MSG = '자체교육은 수정·삭제하지 않습니다 — [등록 취소] 후 다시 등록합니다.';
    /* 집합교육 카드 버튼 — 역할 × 상태.
     *   재난안전과 담당자: 등록부 받는 중·완료 — [출장 결과 보고서 작성] / 저장했으면 «출장 보고 완료»
     *   부서 담당자: 등록부 받는 중 — 미등록 [＋ 참석자 등록부 등록] / 등록함 / 참석자 없음
     * 등록부 창은 교육 상세 한 곳이다(?apply=1) — 목록과 상세에 같은 창을 두 벌 두지 않는다. */
    function groupActions(c, gs) {
        var p = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        var href = 'edu-reg-detail.html?id=' + encodeURIComponent(c.id);
        if (gs !== 'ENROLL' && gs !== 'DONE') return '';
        if (E().isOwnerStaff() && E().isFlow2(c)) {
            return c.trip ? chip('출장 보고 완료', tone('완료')) + ' '
                : '<a class="btn btn-outline btn-sm" data-tour="edu-trip" href="' + href + '&trip=1">출장 결과 보고서 작성</a> ';
        }
        if (!p || p.tier !== 'staff' && !E().canActOwnDept(p.deptId)) return '';
        if (E().courseTargetDepts(c).indexOf(p.deptId) === -1) return '';
        if (E().noAttendOf(c.id, p.deptId)) return chip('참석자 없음', 'neutral') + ' ';
        var en = E().enrolls(c.id).filter(function (e) { return e.deptId === p.deptId; })[0];
        /* 등록함 표시는 받는 중에만 — 끝난 교육 카드마다 같은 칩을 되풀이하지 않는다 */
        if (en) return gs === 'ENROLL' ? chip('등록부 등록함', tone('완료')) + ' ' : '';
        if (gs === 'ENROLL') return '<a class="btn btn-outline btn-sm" data-tour="apply" href="' + href + '&apply=1">＋ 참석자 등록부 등록</a> ';
        /* 종료 뒤에도 미등록 대상 부서의 할 일은 남는다(내 할일과 같게) — 카드에서도 끝낼 길을 준다 */
        if (gs === 'DONE' && E().isFlow2(c)) return '<a class="btn btn-outline btn-sm" href="' + href + '&apply=1">＋ 등록부 추가</a> ';
        return '';
    }
    /* 집합교육 [수정]·[삭제] — 재난안전과 담당자. 삭제는 부서 등록부가 아직 없는 교육만(교육 전 · 2026-11-23 D-3) —
       교육 전에 지우면 대상 부서에 «교육 취소» 알림이 간다. 등록부가 붙은 교육은 부서 기록이 함께 사라지므로 지우지 않는다 */
    function editDeleteBtns(c) {
        var id = c.id;
        if (!E().canActCourse(c) || c.status === 'CANCELLED') return '';
        /* 종료한 교육도 강사·장소·회차를 고친다(바뀐 시간은 이수기록에 다시 반영) — 기록의 정본이 이 시스템이다 */
        var btns = '<button type="button" class="btn btn-outline btn-sm" onclick="EDUR.openEdit(\'' + id + '\')">수정</button> ';
        /* 누르면 거절하는 버튼을 내지 않는다 — 판정은 removeDenyReason 한 곳 */
        if (!removeDenyReason(c))
            btns += '<button type="button" class="btn btn-outline btn-sm" style="border-color:var(--status-danger-border);color:var(--status-danger-fg);" onclick="EDUR.confirmRemove(\'' + id + '\')">삭제</button>';
        return btns;
    }

    /* 부서 선택 필드 — ORGPICK 인라인 조직도 (신규 select 금지, CLAUDE.md §3).
       전 부서 건을 처리하는 주관부서 담당자만 고른다. 그 밖의 담당자는 소속 부서로 고정하고
       [조직도]를 내지 않는다 — 선택지가 하나인 선택 수단은 «더 있는데 안 나온다»로 읽힌다 */
    function deptField(fieldId, deptId, onpickPath) {
        /* 자체교육은 누구든 소속 부서로 고정한다 — 대리 등록은 없다(2026-11-16) */
        var pick = false;
        return '<div class="orgpick-field" id="' + fieldId + '"><div style="display:flex;gap:8px;align-items:center;">' +
            '<input type="text" class="form-input" value="' + esc(E().deptName(deptId)) + '" readonly aria-label="부서" style="flex:1;background:var(--gray-50);">' +
            (pick ? '<button type="button" class="btn btn-sm btn-outline" onclick="ORGPICK.toggle(\'' + fieldId + '\',\'deptId\',\'' + onpickPath + '\')">조직도</button>' : '') +
        '</div>' +
        (pick ? '' : '<p class="file-hint">소속 부서로 등록합니다 — 다른 부서 교육은 그 부서 담당자가 등록합니다.</p>') +
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
        /* 자체교육(부서 실시 교육)은 수정·삭제가 없다 — 고치는 길은 [등록 취소] 후 다시 등록 하나.
           버튼만 걷고 함수를 열어 두면 전역 호출로 뚫린다 */
        if (!E().isGroupCourse(c)) { toast(SELF_FIX_MSG); return; }
        /* **버튼을 감추는 것만으로는 부족하다** — 전역 호출로 뚫린다(CLAUDE.md §12·§4). 권한은 DYEDU.canActCourse 한 곳 */
        if (!E().canActCourse(c)) { deny(E().courseDeptOf(c)); return; }
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
                    '<p class="file-hint">부서는 교육이 끝난 날부터 참석자·실제 참석시간·서명부 스캔을 올립니다. 기한이 지나도 받고, 종료 뒤에도 [＋ 등록부 추가]로 받습니다.</p></div>'
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
                '저장' + '</button>';
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
        /* 자체교육은 소속 부서로만 — 전역 호출(EDUR.pickDept)로 남의 부서를 넣어도 저장에서 막는다(대리 등록 없음) */
        if (!F.edit && F.mode === 'self' && !E().canActOwnDept(target)) { toast(E().ownDenyMsg(target)); return; }
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
            var sessKey = function (ss) { return JSON.stringify((ss || []).map(function (x) { return [x.date, x.start || x.time || '', x.end || '']; })); };
            /* 회차를 그대로 두면 시간도 그대로 둔다 — 점심시간 등으로 회차 폭과 인정 시간이 다른 기록(예: 09:30~18:30 · 8h)을
               장소만 고쳐도 9h 로 다시 계산해 이수기록을 바꾸던 결함(2026-11-17 검수) */
            if (sessKey(E().courseSessions(before)) === sessKey(S.sessions) && prevHours != null) S.hours = prevHours;
            var sessChanged = sessKey(E().courseSessions(before)) !== sessKey(S.sessions) || prevHours !== S.hours;
            /* 부서가 등록부를 올렸거나 «참석자 없음»을 누른 교육은 교육일을 오늘 뒤로 옮기지 않는다 —
               «교육 전» 교육에 등록부가 붙는다(등록부는 교육이 끝난 뒤에만 받는다) */
            var moveWhy = dateMoveIssue(before, S.sessions);
            if (moveWhy) { toast(moveWhy); return; }
            /* 진행 중인 집합교육의 일시·장소를 바꾸면 대상 부서에 «변경 안내» 알림이 간다(공문 없음 — 2026-11-23) */
            var needChange = E().isGroupCourse(before) && E().isFlow2(before) && before.status === 'OPEN' &&
                (sessChanged || (before.place || '') !== F.place);
            /* 집합교육 합계를 등록부 참석시간보다 작게 줄이지 않는다 — 그 등록부를 먼저 정정한다 */
            var cf = E().groupHoursConflicts ? E().groupHoursConflicts(F.edit, S.hours) : [];
            if (cf.length) {
                toast('교육시간 ' + S.hours + 'h 가 등록부 참석시간보다 적습니다 — ' +
                    cf.map(function (x) { return x.deptName + ' ' + x.actualHours + 'h'; }).join(', ') +
                    '. 그 등록부를 먼저 정정(' + (before.status === 'DONE' ? '[이수 기록 정정] 후 [＋ 등록부 추가]' : '등록 취소 후 다시 등록') + ')하세요.');
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
                    (synced ? ' (이수기록 ' + synced + '건 시간 재반영)' : '') + (needChange ? ' · 일시·장소 변경 — 대상 부서에 변경 안내' : '') });
            var sentN = needChange ? E().notifyUpcoming(F.edit, '변경') : 0;
            V().closeModal();
            toast('교육 정보를 저장했습니다 · 교육시간 ' + S.hours + 'h' + (synced ? ' · 이수기록 ' + synced + '건 갱신' : '') +
                (sentN ? ' · 대상 부서 ' + sentN + '곳에 변경 안내를 보냈습니다' : ''));
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
            /* 등록하면 끝이다 — 이수는 바로 반영된다(교육 공문 걷음, 2026-11-23) */
            V().closeModal();
            toast('자체교육을 등록했습니다 · 대상자 ' + ids.length + '명 이수 반영');
        } else {
            var gc = E().addCourse({
                kind: F.kind, date: S.date, time: S.time, endTime: S.endTime,
                sessions: S.sessions, hours: S.hours,
                instructor: F.instructor, place: F.place, desc: F.desc, files: F.files, photos: F.photos,
                status: 'OPEN', createdBy: '재난안전과', enrollDays: +F.enrollDays
            });
            /* 등록하는 순간 대상 부서에 보이고 예정 안내 알림이 간다(교육 공문 걷음, 2026-11-23 — 11-13 방식) */
            var notified = E().notifyUpcoming(gc.id);
            tourEvt('created');
            V().closeModal();
            toast('집합교육을 등록했습니다' + (notified ? ' — 대상 부서 ' + notified + '곳에 예정 안내를 보냈습니다' : ''));
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
        /* 자체교육(부서 실시 교육)은 수정·삭제가 없다 — 고치는 길은 [등록 취소] 후 다시 등록 하나.
           버튼만 걷고 함수를 열어 두면 전역 호출로 뚫린다 */
        if (!E().isGroupCourse(c)) { toast(SELF_FIX_MSG); return; }
        /* **버튼을 감추는 것만으로는 부족하다** — 전역 호출로 뚫린다(CLAUDE.md §12·§4). 권한은 DYEDU.canActCourse 한 곳 */
        if (!E().canActCourse(c)) { deny(E().courseDeptOf(c)); return; }
        var whyNot = removeDenyReason(c);
        if (whyNot) { toast(whyNot); return; }
        /* 부서 기록(등록부·참석자 없음·서명부·출장 보고)이 있으면 위 removeDenyReason 이 이미 막았다 — 지울 것은 교육 건뿐이다 */
        V().openModal('교육 삭제',
            '<p style="font-size:var(--fs-13);"><b>' + esc(c.desc) + '</b><br>' +
                esc(E().courseDateTime(c)) + ' · ' + c.hours + 'h</p>' +
            (E().isFlow2(c) && E().noticeRecipients(c).length ? '<p class="file-hint">대상 부서 ' + E().noticeRecipients(c).length + '곳에 «교육 취소» 알림을 보냅니다.</p>' : '') +
            '<p style="font-size:var(--fs-12);color:var(--text-gray);margin-top:8px;">삭제 후에는 되돌릴 수 없습니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUR.doRemove(\'' + courseId + '\')">삭제</button>');
    }
    function doRemove(courseId) {
        var c = E().courseOf(courseId);
        if (c && !E().isGroupCourse(c)) { V().closeModal(); toast(SELF_FIX_MSG); return; }
        if (c && !E().canActCourse(c)) { V().closeModal(); deny(E().courseDeptOf(c)); return; }
        /* 확인창을 띄운 뒤에 부서가 등록부를 올렸을 수 있다 — 저장 직전에 한 번 더 본다 */
        var whyNot = c ? removeDenyReason(c) : '';
        if (whyNot) { V().closeModal(); toast(whyNot); return; }
        /* 이 시스템에서 등록한 교육(등록 순간 대상 부서에 알려졌다)을 지우면 «교육 취소» 알림 — 교육 당일이어도 보낸다.
           지우기 전에 보낸다(지운 뒤에는 대상을 셀 수 없다) */
        var cancelN = c && E().isFlow2(c) ? E().notifyUpcoming(courseId, '취소') : 0;
        var r = E().removeCourse(courseId);
        /* 교육 건과 그 이력이 함께 사라지므로 누가 언제 무엇을 지웠는지는 취소 기록에 남긴다(시스템 기록이 정본 — R35) */
        if (r) E().logCancel({ by: actor(), deptId: E().courseDeptOf(c), what: E().kindLabel(c.kind) + ' 삭제' + (cancelN ? ' · 취소 알림 ' + cancelN + '곳' : ''), title: c.desc, courses: 1, records: r.records, hours: 0 });
        V().closeModal();
        toast(r ? '교육을 삭제했습니다' + (cancelN ? ' · 대상 부서 ' + cancelN + '곳에 취소 알림' : '') : '교육을 찾을 수 없습니다.');
        render();
    }

    /* 교육일을 뒤로 옮길 수 있는가 — 등록부는 교육이 끝난 뒤에만 받으므로 교육일이 그 뒤에 남은 기록보다 늦으면 안 된다.
     *   · 종료한 교육: 마지막 회차가 오늘 뒤로 갈 수 없다(종료 교육이 «교육 전»이 되면 할 일·등록 판정이 뒤집힌다)
     *   · 부서 기록(등록부·참석자 없음)·서명부·출장 결과 보고서가 있는 교육: 그 기록 가운데 가장 이른 날과 오늘보다 늦게 옮길 수 없다
     *   마지막 회차를 늦추는 저장만 본다 — 앞당기거나 그대로 두는 수정은 막지 않는다(옛 기록의 날짜 어긋남으로 수정이 막히지 않게) */
    function dateMoveIssue(c, sessions) {
        var oldLast = E().lastSessionDate(c) || c.date || '';
        var newLast = (sessions || []).reduce(function (m, x) { return x.date > m ? x.date : m; }, '');
        if (!newLast || newLast <= oldLast) return '';
        var marks = [];
        E().enrolls(c.id).forEach(function (e) { if (e.at) marks.push(String(e.at).slice(0, 10)); });
        if (E().isGroupCourse(c)) E().courseTargetDepts(c).forEach(function (dp) { var na = E().noAttendOf(c.id, dp); if (na && na.at) marks.push(String(na.at).slice(0, 10)); });
        if (c.trip && c.trip.at) marks.push(String(c.trip.at).slice(0, 10));
        /* 서명부는 파일을 올린 경우만 — [필요 없음]은 기록이 아니다(removeDenyReason 과 같은 판정) */
        if (c.signSheet && c.signSheet.file && c.signSheet.at) marks.push(String(c.signSheet.at).slice(0, 10));
        if (c.status !== 'DONE' && !marks.length) return '';
        var limit = marks.concat([E().today()]).sort()[0];
        if (newLast <= limit) return '';
        return c.status === 'DONE' && !marks.length
            ? '종료한 교육은 교육일을 오늘 뒤로 옮기지 않습니다.'
            : '부서 기록(등록부·참석자 없음)이나 서명부·출장 결과 보고서가 있는 교육은 교육일을 ' + limit + ' 뒤로 옮기지 않습니다 — 그 기록이 교육보다 앞서게 됩니다.';
    }
    /* 집합교육 삭제 조건 — 진행 중이고 부서 기록이 아직 없을 때만(D-3). 버튼과 저장이 같은 판정을 쓴다 */
    function removeDenyReason(c) {
        if (c.status !== 'OPEN') return '종료한 교육은 지우지 않습니다.';
        if (E().enrolls(c.id).length) return '부서가 참석자 등록부를 올린 교육은 지우지 않습니다 — 부서 기록이 함께 사라집니다.';
        if (E().isGroupCourse(c) && E().courseTargetDepts(c).some(function (dp) { return E().noAttendOf(c.id, dp); })) return '«참석자 없음»으로 끝낸 부서가 있는 교육은 지우지 않습니다 — 부서 기록이 함께 사라집니다.';
        if (c.trip || (c.signSheet && c.signSheet.file)) return '출장 결과 보고서나 서명부를 올린 교육은 지우지 않습니다.';
        return '';
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
        EDUFORM.registerRefresh(render);
        /* ?tab=self — 자체교육 탭으로 바로 연다(내 할일 «재촉» 카드의 [자체교육 진행]) */
        var qt = new URLSearchParams(location.search).get('tab');
        if (qt === 'self' || qt === 'group') state.tab = qt;
        render();
    }
    global.EDUR = {
        init: init, setTab: setTab, setF: setF, resetF: resetF,
        openCreate: openCreate, openEdit: openEdit, doCreate: doCreate, toggleTarget: toggleTarget, pickDept: pickDept,
        /* 회차(일자 탭) — 최대 5일, 교육시간 자동 합산 · 첨부/사진 (공용 EDUFORM) */
        sessTab: sessTab, sessAdd: sessAdd, sessDel: sessDel, sessSync: sessSync,
        addFile: addFile, delFile: delFile,
        confirmRemove: confirmRemove, doRemove: doRemove,
        openApply: openApply, applyPickDept: applyPickDept, applyToggle: applyToggle,
        applyAttachSign: applyAttachSign, applyClearSign: applyClearSign, doApply: doApply, hoursOpen: hoursOpen,
        viewDetail: viewDetail
    };
})(window);
