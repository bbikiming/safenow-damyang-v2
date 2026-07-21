/* =====================================================================
   edu-reg.js · 정기교육 - 현업근로자 (EDU-REG) / 관리감독자 (EDU-SUP 재사용)
   ---------------------------------------------------------------------
   docs/planning/기획-안전보건교육-재설계-v1.md §4. (safe-damyang-v2 이식본 — 표준 치환)
   · 집합교육: 재난안전과 등록 → 부서 신청(서명 필수) → 교육 종료 시 카운트
   · 자체교육: 부서 등록 → 대상자 선택 → 진행 처리 = 즉시 완료·카운트
   · 정원·마감·불참 개념 없음.
   표준: 탭 .sub-tabs · 배지 chip-status+DYV2.toneOf · 표 .table-figma ·
        빈상태 .v2-empty · 부서 선택 ORGPICK('deptId') · 시연 훅 EDUTOUR.onEvent
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
    var G = null;    /* 부서 신청 폼 */

    function groupKind() { return SUP_MODE ? 'SUP_REG' : 'REG_GROUP'; }
    function selfKind()  { return SUP_MODE ? 'SUP_REG' : 'REG_SELF'; }
    function targetWorkers(deptId) {
        var arr = SUP_MODE ? E().supervisorWorkers() : E().fieldWorkers();
        return deptId ? arr.filter(function (w) { return w.deptId === deptId; }) : arr;
    }

    function render() {
        if (!state.mount) return;
        var head =
            '<div class="sub-tabs" style="margin-bottom:12px;">' +
                '<button type="button" class="sub-tab' + (state.tab === 'group' ? ' active' : '') + '" onclick="EDUR.setTab(\'group\')">집합교육</button>' +
                '<button type="button" class="sub-tab' + (state.tab === 'self'  ? ' active' : '') + '" onclick="EDUR.setTab(\'self\')">자체교육 (부서)</button>' +
            '</div>';
        state.mount.innerHTML = head + (state.tab === 'group' ? renderGroup() : renderSelf());
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
    function applyFilter(list, tabKey) {
        return list.filter(function (c) {
            if (state.st && c.status !== state.st) return false;
            if (state.year && String(c.date || '').slice(0, 4) !== state.year) return false;
            if (state.month && String(c.date || '').slice(5, 7) !== state.month) return false;
            if (tabKey === 'self' && state.dept && c.deptId !== state.dept) return false;
            return EDUFILTER.match(state.q, [c.desc, c.instructor, c.place, E().deptName(c.deptId)]);
        });
    }
    function filterFields(all, tabKey) {
        var fields = [
            { type: 'search', id: 'er-q', value: state.q, placeholder: '교육명·강사·장소 검색', on: "EDUR.setF('q', this.value)" },
            { type: 'select', id: 'er-st', value: state.st, label: '진행 상태',
              options: [['', '상태 전체'], ['OPEN', '신청 접수 중'], ['DONE', '완료']], on: "EDUR.setF('st', this.value)" },
            { type: 'select', id: 'er-year', value: state.year, label: '연도',
              options: EDUFILTER.yearOptions(all.map(function (c) { return c.date; })), on: "EDUR.setF('year', this.value)" },
            { type: 'select', id: 'er-month', value: state.month, label: '월',
              options: EDUFILTER.monthOptions(), on: "EDUR.setF('month', this.value)" }
        ];
        if (tabKey === 'self') {
            var depts = E().deptCandidates();
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
                actions: '<button type="button" class="btn btn-primary" data-tour="reg-create" onclick="EDUR.openCreate(\'group\')">＋ ' +
                    (SUP_MODE ? '관리감독자 정기(집합) 등록' : '집합교육 등록') + '</button>'
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
                actions: '<button type="button" class="btn btn-primary" onclick="EDUR.openCreate(\'self\')">＋ 자체교육 등록·진행</button>'
            });
        var cards = list.length ? list.map(function (c) { return courseCard(c, 'self'); }).join('')
            : '<div class="edu-card"><div class="v2-empty">' +
                (all.length ? '조건에 맞는 자체교육이 없습니다.' : '등록된 자체교육이 없습니다.') + '</div></div>';
        return head + cards;
    }

    function courseCard(c, tabKey) {
        var stChip = c.status === 'DONE' ? chip('완료') : chip('진행중');
        var sessCnt = E().courseSessions(c).length;
        var enrolls = E().enrolls(c.id);
        var enrolledCnt = enrolls.reduce(function (n, e) { return n + (e.workerIds || []).length; }, 0);
        var enrolledDepts = enrolls.length;
        var deptChip = c.deptId ? '<span class="chip-status chip-sm neutral">' + esc(E().deptName(c.deptId)) + '</span> ' : '';
        /* 집합교육은 상세화면(edu-reg-detail)으로 이동, 자체교육은 인라인 상세 모달 유지 */
        var detailHref = tabKey === 'group' ? 'edu-reg-detail.html?id=' + encodeURIComponent(c.id) : null;
        var actions = '';
        if (detailHref) {
            /* 신청 접수 중(OPEN)인 집합교육은 목록에서도 바로 [부서 신청] 가능 (v1.1 후속) */
            if (c.status === 'OPEN') {
                actions += '<button type="button" class="btn btn-outline btn-sm" data-tour="apply" onclick="EDUR.openApply(\'' + c.id + '\')">＋ 부서 신청</button> ';
            }
            actions += '<a class="btn btn-primary btn-sm" href="' + detailHref + '">상세 →</a> ';
        } else {
            actions = '<button type="button" class="btn btn-outline btn-sm" onclick="EDUR.viewDetail(\'' + c.id + '\')">상세</button> ';
        }
        actions += editDeleteBtns(c.id);
        return '<div class="edu-course-card" data-course-id="' + esc(c.id) + '">' +
            '<div class="edu-course-head">' +
                '<div class="edu-course-title">' + deptChip + esc(c.desc) + ' ' + stChip + '</div>' +
                '<div class="edu-course-actions">' + actions + '</div>' +
            '</div>' +
            '<div class="edu-course-meta">' +
                '<span>일시 <b>' + esc(E().courseDateTime(c)) + '</b></span>' +
                '<span>시간 <b>' + c.hours + 'h</b>' + (sessCnt > 1 ? ' (' + sessCnt + '일 합계)' : '') + '</span>' +
                '<span>강사 <b>' + esc(c.instructor || '-') + '</b></span>' +
                '<span>장소 <b>' + esc(c.place || '-') + '</b></span>' +
                '<span>신청 <b>' + enrolledDepts + '개 부서 · ' + enrolledCnt + '명</b></span>' +
            '</div>' +
        '</div>';
    }

    /* 카드 공통 [수정]·[삭제] — 등록만 있고 회수 수단이 없으면 시연을 반복할수록 데이터가 쌓인다 */
    function editDeleteBtns(id) {
        return '<button type="button" class="btn btn-outline btn-sm" onclick="EDUR.openEdit(\'' + id + '\')">수정</button> ' +
            '<button type="button" class="btn btn-outline btn-sm" style="border-color:var(--status-danger-border);color:var(--status-danger-fg);" onclick="EDUR.confirmRemove(\'' + id + '\')">삭제</button>';
    }

    /* 부서 선택 필드 — ORGPICK 인라인 조직도 (신규 select 금지, CLAUDE.md §3) */
    function deptField(fieldId, deptId, onpickPath) {
        return '<div class="orgpick-field" id="' + fieldId + '"><div style="display:flex;gap:8px;align-items:center;">' +
            '<input type="text" class="form-input" value="' + esc(E().deptName(deptId)) + '" readonly aria-label="부서" style="flex:1;background:var(--gray-50);">' +
            '<button type="button" class="btn btn-sm btn-outline" onclick="ORGPICK.toggle(\'' + fieldId + '\',\'deptId\',\'' + onpickPath + '\')">조직도</button>' +
        '</div></div>';
    }

    /* =============== 회차(일자 탭) ===============
     * 교육은 하루에 끝나지 않는다 — 일자 + 시작~종료 시각을 회차로 등록하고,
     * 교육 시간은 회차 합계로 자동 산정한다(직접 입력 금지 · DYEDU.sumSessionHours 단일 출처). */
    var MAX_SESSIONS = 5;
    function sessHours(s) { return E().sessionHours(s); }
    function totalHours() { return E().sumSessionHours(F.sessions); }
    function addDays(iso, n) {
        var p = String(iso || '').split('-');
        if (p.length !== 3) return iso;
        var d = new Date(+p[0], +p[1] - 1, +p[2] + n);
        var mm = d.getMonth() + 1, dd = d.getDate();
        return d.getFullYear() + '-' + (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd;
    }
    function mdLabel(iso) {
        var p = String(iso || '').split('-');
        return p.length === 3 ? p[1] + '/' + p[2] : '일자 미정';
    }

    /* =============== 등록 · 수정 =============== */
    function openCreate(mode) {
        var depts = E().deptCandidates();
        F = {
            edit: null, mode: mode, kind: mode === 'group' ? groupKind() : selfKind(),
            deptId: mode === 'self' ? depts[0].id : '',
            sessions: [{ date: E().today(), start: '14:00', end: SUP_MODE ? '18:00' : '17:00' }],
            sIdx: 0,
            instructor: '', place: '', desc: '', files: [],
            workerIds: {}
        };
        renderCreate();
    }
    /* 수정 — 등록 모달을 그대로 재사용하되 대상자 재선택은 받지 않는다
     * (이미 신청·이수기록이 붙어 있어 대상자를 바꾸면 카운트 정합이 깨지므로,
     *  대상자 변경은 신청 취소 → 재신청 경로로만 처리한다). */
    function openEdit(courseId) {
        var c = E().courseOf(courseId); if (!c) return;
        /* 회차가 없는 구 데이터는 대표값(date·time)에서 1회차를 파생해 그대로 편집한다 */
        var ss = E().courseSessions(c).map(function (s) { return { date: s.date, start: s.start || '', end: s.end || '' }; });
        if (!ss.length) ss = [{ date: c.date || E().today(), start: c.time || '', end: '' }];
        F = {
            edit: courseId, mode: c.deptId ? 'self' : 'group', kind: c.kind,
            deptId: c.deptId || '', sessions: ss, sIdx: 0, legacyHours: c.hours,
            instructor: c.instructor || '', place: c.place || '', desc: c.desc || '',
            files: (c.files || []).slice(), workerIds: {}
        };
        renderCreate();
    }
    function renderCreate() {
        var body =
            (F.mode === 'self'
                ? '<div class="edu-modal-row"><label class="form-label">부서 <span style="color:var(--status-danger-fg)">*</span></label>' +
                    deptField('er-deptfield', F.deptId, 'EDUR.pickDept') + '</div>'
                : '') +
            renderSessions() +
            '<div class="edu-modal-row"><label class="form-label" for="er-inst">강사</label>' +
                '<input type="text" class="form-input" id="er-inst" value="' + esc(F.instructor) + '"></div>' +
            '<div class="edu-modal-row"><label class="form-label" for="er-place">장소</label>' +
                '<input type="text" class="form-input" id="er-place" value="' + esc(F.place) + '"></div>' +
            '<div class="edu-modal-row"><label class="form-label" for="er-desc">내용 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<textarea class="form-textarea" id="er-desc" rows="2">' + esc(F.desc) + '</textarea></div>' +
            (F.mode === 'group'
                ? '<div class="edu-modal-row"><label class="form-label">첨부 (계획서 등)</label>' +
                    '<button type="button" class="btn btn-sm btn-outline" onclick="EDUR.attachFile()">＋ 파일 첨부 (프로토타입)</button>' +
                    (F.files.length ? '<div style="font-size:var(--fs-12);color:var(--main-dark);margin-top:6px;">' + F.files.map(function (f) { return esc(f.name); }).join(', ') + '</div>' : '') +
                    V().fileHint() +
                  '</div>'
                : (F.edit
                    ? '<div class="check-notice">대상자는 이 화면에서 바꾸지 않습니다 — 이미 반영된 이수시간과 어긋나므로 <b>신청 취소 후 재신청</b>으로 처리합니다.</div>'
                    : renderSelfTargets())
            );
        var title = F.edit
            ? (F.mode === 'group' ? '집합교육 수정' : '자체교육 수정')
            : (F.mode === 'group'
                ? (SUP_MODE ? '관리감독자 집합교육 등록' : '집합교육 등록')
                : (SUP_MODE ? '관리감독자 자체교육 등록·진행' : '자체교육 등록·진행'));
        var foot = '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUR.doCreate()">' +
                (F.edit ? '저장' : (F.mode === 'group' ? '등록' : '진행 처리')) + '</button>';
        V().openModal(title, body, foot);
    }
    /* 회차 탭 + 활성 회차 입력 + 자동 산정된 총 교육시간
     * 탭 라벨에 일자·시간을 함께 적어, 탭을 열어보지 않아도 전체 일정이 읽히게 한다. */
    function renderSessions() {
        var n = F.sessions.length;
        var idx = Math.min(F.sIdx, n - 1);
        var cur = F.sessions[idx];
        var total = totalHours();
        var curH = sessHours(cur);
        var invalid = cur.start && cur.end && curH === 0;

        var tabs = F.sessions.map(function (s, i) {
            var h = sessHours(s);
            return '<button type="button" class="edu-sess-tab' + (i === idx ? ' active' : '') + '"' +
                ' aria-pressed="' + (i === idx ? 'true' : 'false') + '"' +
                ' onclick="EDUR.sessTab(' + i + ')">' +
                '<b>' + (i + 1) + '회차</b> <span>' + esc(mdLabel(s.date)) + (h ? ' · ' + h + 'h' : '') + '</span>' +
            '</button>';
        }).join('');
        var addBtn = n < MAX_SESSIONS
            ? '<button type="button" class="edu-sess-add" onclick="EDUR.sessAdd()">＋ 일자 추가</button>'
            : '<span class="edu-sess-max">최대 ' + MAX_SESSIONS + '일</span>';

        return '<div class="edu-modal-row">' +
            '<label class="form-label">교육 일자 · 시간 <span style="color:var(--status-danger-fg)">*</span> ' +
                '<span style="color:var(--text-lightgray);font-weight:var(--fw-regular);">(일자별로 탭을 추가 · 최대 ' + MAX_SESSIONS + '일)</span></label>' +
            '<div class="edu-sess-tabs" role="group" aria-label="교육 회차">' + tabs + addBtn + '</div>' +
            '<div class="edu-sess-panel">' +
                '<div class="edu-sess-grid">' +
                    '<div><label class="form-label" for="er-s-date">일자</label>' +
                        '<input type="date" class="form-input" id="er-s-date" value="' + esc(cur.date || '') + '" onchange="EDUR.sessSync()"></div>' +
                    '<div><label class="form-label" for="er-s-start">시작 시각</label>' +
                        '<input type="time" class="form-input" id="er-s-start" value="' + esc(cur.start || '') + '" onchange="EDUR.sessSync()"></div>' +
                    '<div><label class="form-label" for="er-s-end">종료 시각</label>' +
                        '<input type="time" class="form-input" id="er-s-end" value="' + esc(cur.end || '') + '" onchange="EDUR.sessSync()"></div>' +
                '</div>' +
                '<div class="edu-sess-foot">' +
                    (invalid
                        ? '<span class="edu-sess-warn" role="alert">종료 시각이 시작 시각보다 빠르거나 같습니다 — 이 회차는 0h로 계산됩니다.</span>'
                        : '<span class="edu-sess-calc">이 회차 <b>' + curH + 'h</b> 자동 산정</span>') +
                    (n > 1
                        ? '<button type="button" class="edu-sess-del" onclick="EDUR.sessDel(' + idx + ')">이 일자 삭제</button>'
                        : '') +
                '</div>' +
            '</div>' +
            '<div class="edu-sess-total">교육 시간 합계 <b>' + total + 'h</b> ' +
                '<span>(' + n + '일 · 회차 시간 자동 합산)</span></div>' +
        '</div>';
    }
    function sessTab(i) { captureCreate(); F.sIdx = i; renderCreate(); }
    function sessAdd() {
        captureCreate();
        if (F.sessions.length >= MAX_SESSIONS) { toast('교육 일자는 최대 ' + MAX_SESSIONS + '일까지 추가할 수 있습니다.'); return; }
        var last = F.sessions[F.sessions.length - 1];
        /* 다음 날 같은 시간대를 기본값으로 — 연속 일정이 가장 흔하다 */
        F.sessions.push({ date: addDays(last.date, 1), start: last.start, end: last.end });
        F.sIdx = F.sessions.length - 1;
        renderCreate();
    }
    function sessDel(i) {
        captureCreate();
        if (F.sessions.length <= 1) return;
        F.sessions.splice(i, 1);
        F.sIdx = Math.max(0, Math.min(F.sIdx, F.sessions.length - 1));
        renderCreate();
    }
    /* 일자·시각 변경 즉시 재렌더 — 탭 라벨과 합계 시간이 항상 입력과 일치해야 한다 */
    function sessSync() { captureCreate(); renderCreate(); }

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
        }).join('') : '<div style="color:var(--text-lightgray);font-size:var(--fs-12);padding:8px;">이 부서에 대상자가 없습니다.</div>';
        return '<div class="edu-modal-row"><label class="form-label">교육 대상자 <span style="color:var(--status-danger-fg)">*</span> ' +
            '<span style="color:var(--text-lightgray);font-weight:var(--fw-regular);">(' + selCnt + ' / ' + ws.length + '명 선택)</span></label>' +
            '<div class="edu-tg-body" style="max-height:200px;">' + rows + '</div>' +
        '</div>';
    }
    /* 재렌더 전 입력값 보존 — 원본은 체크 시 타이핑 값이 유실됐다(이식 시 보완) */
    function captureCreate() {
        var el = function (id) { return document.getElementById(id); };
        var cur = F.sessions && F.sessions[F.sIdx];
        if (cur && el('er-s-date')) {
            cur.date = el('er-s-date').value;
            cur.start = el('er-s-start').value;
            cur.end = el('er-s-end').value;
        }
        if (el('er-inst')) F.instructor = el('er-inst').value.trim();
        if (el('er-place')) F.place = el('er-place').value.trim();
        if (el('er-desc')) F.desc = el('er-desc').value.trim();
    }
    function pickDept(id, name) {
        captureCreate();
        F.deptId = id; F.workerIds = {};
        renderCreate();
    }
    function toggleTarget(id, on) {
        captureCreate();
        if (on) F.workerIds[id] = true; else delete F.workerIds[id];
        renderCreate();
    }
    function attachFile() {
        captureCreate();
        F.files.push({ name: (F.desc.trim() || '교육_계획서') + '.hwpx' });
        toast('파일 첨부 (프로토타입)');
        renderCreate();
    }
    /* 회차 검증 — 저장 대표값(date·time·endTime·hours)은 여기서만 파생한다 */
    function sessionPayload() {
        var bad = -1;
        for (var i = 0; i < F.sessions.length; i++) {
            var s = F.sessions[i];
            if (!s.date || !s.start || !s.end || sessHours(s) <= 0) { bad = i; break; }
        }
        if (bad >= 0) {
            F.sIdx = bad; renderCreate();
            toast((bad + 1) + '회차의 일자·시작·종료 시각을 확인하세요 (종료가 시작보다 뒤여야 합니다).');
            return null;
        }
        var ss = F.sessions.slice().sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); });
        return {
            sessions: ss, date: ss[0].date, time: ss[0].start, endTime: ss[0].end,
            hours: E().sumSessionHours(ss)
        };
    }
    function doCreate() {
        captureCreate();
        if (!F.desc) { toast('교육 내용을 입력하세요.'); return; }
        var S = sessionPayload();
        if (!S) return;
        /* 수정 저장 — 대상자·신청 내역은 건드리지 않고 교육 정보만 갱신 */
        if (F.edit) {
            E().updateCourse(F.edit, {
                deptId: F.deptId, date: S.date, time: S.time, endTime: S.endTime,
                sessions: S.sessions, hours: S.hours,
                instructor: F.instructor, place: F.place, desc: F.desc, files: F.files
            });
            /* 회차를 고치면 시간이 자동으로 바뀐다 — 이미 쌓인 이수기록도 함께 맞춰야
             * 카드의 교육시간과 이수현황 인정시간이 어긋나지 않는다. */
            var synced = E().syncCourseRecordHours(F.edit, S.hours, S.date);
            E().pushCourseHistory(F.edit, { type: 'STATUS', by: '재난안전과',
                memo: '교육 정보 수정 · ' + F.sessions.length + '일 · ' + S.hours + 'h' +
                    (synced ? ' (이수기록 ' + synced + '건 시간 재반영)' : '') });
            V().closeModal();
            toast('교육 정보를 저장했습니다 · 교육시간 ' + S.hours + 'h' + (synced ? ' · 이수기록 ' + synced + '건 갱신' : ''));
            render();
            return;
        }
        if (F.mode === 'self') {
            var ids = Object.keys(F.workerIds).filter(function (k) { return F.workerIds[k]; });
            if (!ids.length) { toast('교육 대상자를 1명 이상 선택하세요.'); return; }
            /* 자체교육 즉시 완료 */
            var c = E().addCourse({
                kind: F.kind, deptId: F.deptId, date: S.date, time: S.time, endTime: S.endTime,
                sessions: S.sessions, hours: S.hours,
                instructor: F.instructor, place: F.place, desc: F.desc, files: F.files,
                status: 'DONE', createdBy: E().deptName(F.deptId)
            });
            E().addEnroll({ courseId: c.id, deptId: F.deptId, workerIds: ids, at: S.date });
            E().recordCourseCompletion(c.id, ids, S.hours, S.date);
            E().pushCourseHistory(c.id, { type: 'STATUS', by: E().deptName(F.deptId),
                memo: '자체교육 즉시 완료 · ' + F.sessions.length + '일 ' + S.hours + 'h · 대상자 ' + ids.length + '명 카운트' });
            V().closeModal();
            toast(E().deptName(F.deptId) + ' 자체교육 완료 · ' + S.hours + 'h · ' + ids.length + '명 카운트');
        } else {
            E().addCourse({
                kind: F.kind, date: S.date, time: S.time, endTime: S.endTime,
                sessions: S.sessions, hours: S.hours,
                instructor: F.instructor, place: F.place, desc: F.desc, files: F.files,
                status: 'OPEN', createdBy: '재난안전과'
            });
            V().closeModal();
            toast(SUP_MODE ? '관리감독자 집합교육 등록' : '집합교육 등록 · 부서 신청 접수 개시');
            tourEvt('created');
        }
        render();
    }

    /* =============== 부서 신청 =============== */
    function openApply(courseId) {
        var c = E().courseOf(courseId); if (!c) return;
        var depts = E().deptCandidates();
        G = { courseId: courseId, deptId: depts[0].id, workerIds: {}, signFile: '' };
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
        }).join('') : '<div style="color:var(--text-lightgray);font-size:var(--fs-12);padding:8px;">이 부서에 대상자가 없습니다.</div>';

        var body =
            '<div style="font-size:var(--fs-12);color:var(--text-gray);margin-bottom:10px;">' +
                '<b>' + esc(c.desc) + '</b> · 일정 ' + esc(E().courseDateTime(c)) + ' · ' + c.hours + 'h · ' + esc(c.place || '-') +
            '</div>' +
            '<div class="edu-modal-row"><label class="form-label">부서 <span style="color:var(--status-danger-fg)">*</span></label>' +
                deptField('er-applydept', G.deptId, 'EDUR.applyPickDept') + '</div>' +
            '<div class="edu-modal-row"><label class="form-label">근로자 선택 <span style="color:var(--status-danger-fg)">*</span> ' +
                '<span style="color:var(--text-lightgray);font-weight:var(--fw-regular);">(' + selCnt + ' / ' + ws.length + '명)</span></label>' +
                '<div class="edu-tg-body">' + rows + '</div>' +
            '</div>' +
            '<div class="edu-modal-row"><label class="form-label">서명파일 업로드 <span style="color:var(--status-danger-fg)">*</span></label>' +
                (G.signFile
                    ? '<span style="color:var(--main-dark);font-weight:var(--fw-bold);font-size:var(--fs-12);">' + esc(G.signFile) + '</span> ' +
                      '<button type="button" class="btn btn-sm btn-outline" onclick="EDUR.applyClearSign()">×</button>'
                    : '<button type="button" class="btn btn-sm btn-outline" onclick="EDUR.applyAttachSign()">＋ 서명파일 첨부 (프로토타입)</button>') +
                V().fileHint() +
            '</div>';
        V().openModal('부서 신청 · ' + esc(E().deptName(G.deptId)), body,
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUR.doApply()">신청 완료</button>');
    }
    function applyPickDept(id, name) { G.deptId = id; G.workerIds = {}; renderApply(); }
    function applyToggle(id, on) { if (on) G.workerIds[id] = true; else delete G.workerIds[id]; renderApply(); }
    function applyAttachSign() { G.signFile = E().deptName(G.deptId) + '_서명_' + G.courseId + '.pdf'; renderApply(); }
    function applyClearSign() { G.signFile = ''; renderApply(); }
    function doApply() {
        var ids = Object.keys(G.workerIds).filter(function (k) { return G.workerIds[k]; });
        if (!ids.length) { toast('근로자를 1명 이상 선택하세요.'); return; }
        if (!G.signFile) { toast('서명파일을 업로드하세요 (필수).'); return; }
        E().addEnroll({ courseId: G.courseId, deptId: G.deptId, workerIds: ids, signFile: G.signFile, at: E().today() });
        E().pushCourseHistory(G.courseId, { type: 'STATUS', by: E().deptName(G.deptId), memo: '부서 신청 · ' + ids.length + '명 · 서명파일 첨부' });
        V().closeModal();
        toast(E().deptName(G.deptId) + ' · ' + ids.length + '명 신청 완료');
        render();
        tourEvt('applied');
    }

    /* =============== 교육 종료 처리 =============== */
    function closeCourse(courseId) {
        var c = E().courseOf(courseId); if (!c) return;
        var enrolls = E().enrolls(courseId);
        var totalCnt = enrolls.reduce(function (n, e) { return n + (e.workerIds || []).length; }, 0);
        V().openModal('교육 종료 처리',
            '<p style="font-size:var(--fs-13);"><b>' + esc(c.desc) + '</b><br>신청 <b>' + enrolls.length + '개 부서 · ' + totalCnt + '명</b>에게 교육시간 ' + c.hours + 'h 를 카운트합니다.</p>' +
            '<p style="font-size:var(--fs-12);color:var(--text-gray);margin-top:6px;">종료 후에는 되돌릴 수 없습니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUR.doClose(\'' + courseId + '\')">종료 처리</button>');
    }
    function doClose(courseId) {
        var c = E().courseOf(courseId); if (!c) return;
        var enrolls = E().enrolls(courseId);
        var total = 0;
        enrolls.forEach(function (e) {
            E().recordCourseCompletion(courseId, e.workerIds, c.hours, c.date);
            total += (e.workerIds || []).length;
        });
        E().updateCourse(courseId, { status: 'DONE' });
        E().pushCourseHistory(courseId, { type: 'STATUS', by: '재난안전과', memo: '교육 종료 처리 · 신청자 ' + total + '명 카운트' });
        V().closeModal();
        toast('교육 종료 · ' + total + '명 카운트 완료');
        render();
        tourEvt('closed');
    }

    /* =============== 삭제 =============== */
    function confirmRemove(courseId) {
        var c = E().courseOf(courseId); if (!c) return;
        var enrolls = E().enrolls(courseId);
        var cnt = enrolls.reduce(function (n, e) { return n + (e.workerIds || []).length; }, 0);
        var counted = c.status === 'DONE' && cnt;
        V().openModal('교육 삭제',
            '<p style="font-size:var(--fs-13);"><b>' + esc(c.desc) + '</b><br>' +
                esc(E().courseDateTime(c)) + ' · ' + c.hours + 'h</p>' +
            (enrolls.length
                ? '<div class="check-notice" style="margin-top:10px;">신청 <b>' + enrolls.length + '개 부서 · ' + cnt + '명</b>' +
                    (counted ? '의 <b>이수시간 ' + c.hours + 'h 반영분도 함께 회수</b>됩니다.' : ' 신청 내역이 함께 삭제됩니다.') + '</div>'
                : '') +
            '<p style="font-size:var(--fs-12);color:var(--text-gray);margin-top:8px;">삭제 후에는 되돌릴 수 없습니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUR.doRemove(\'' + courseId + '\')">삭제</button>');
    }
    function doRemove(courseId) {
        var r = E().removeCourse(courseId);
        V().closeModal();
        toast(r ? '교육을 삭제했습니다 · 신청 ' + r.enrolls + '건 · 이수기록 ' + r.records + '건 회수' : '교육을 찾을 수 없습니다.');
        render();
    }

    /* =============== 상세 (자체교육 인라인 모달) =============== */
    function viewDetail(courseId) {
        var c = E().courseOf(courseId); if (!c) return;
        var enrolls = E().enrolls(courseId);
        var enrollRows = enrolls.length ? enrolls.map(function (e) {
            var names = (e.workerIds || []).map(function (id) { var w = E().workerOf(id); return w ? w.name : id; }).join(', ');
            return '<tr>' +
                '<td>' + esc(E().deptName(e.deptId)) + '</td>' +
                '<td>' + (e.workerIds || []).length + '명</td>' +
                '<td style="font-size:var(--fs-12);color:var(--text-gray);">' + esc(names) + '</td>' +
                '<td>' + (e.signFile ? '<span style="color:var(--main-dark);font-size:var(--fs-12);">' + esc(e.signFile) + '</span>' : '<span style="color:var(--text-lightgray);font-size:var(--fs-12);">-</span>') + '</td>' +
                '<td>' + esc(e.at) + '</td>' +
            '</tr>';
        }).join('') : '<tr><td colspan="5"><div class="v2-empty">신청이 없습니다.</div></td></tr>';
        var hist = (c.history || []).map(function (h) {
            return '<div style="padding:6px 0;border-bottom:1px dashed var(--card-line);font-size:var(--fs-12);">' +
                '<span style="color:var(--text-lightgray);margin-right:8px;">' + esc(h.at) + '</span>' +
                esc(h.memo) + (h.by ? '<span style="color:var(--text-lightgray);margin-left:6px;">— ' + esc(h.by) + '</span>' : '') +
            '</div>';
        }).join('');
        V().openModal(esc(E().kindLabel(c.kind)) + ' — 상세',
            '<div style="font-size:var(--fs-13);margin-bottom:10px;">' +
                '<div style="font-weight:var(--fw-bold);">' + esc(c.desc) + '</div>' +
                '<div style="color:var(--text-gray);margin-top:4px;">' +
                    '일정 ' + esc(E().courseDateTime(c)) + ' · ' + c.hours + 'h · 강사 ' + esc(c.instructor || '-') + ' · 장소 ' + esc(c.place || '-') +
                '</div>' +
            '</div>' +
            '<label class="form-label">신청 현황</label>' +
            '<div class="edu-scroll"><table class="table-figma table-compact"><thead><tr>' +
                '<th>부서</th><th>인원</th><th>대상자</th><th>서명</th><th>신청일</th>' +
            '</tr></thead><tbody>' + enrollRows + '</tbody></table></div>' +
            (hist ? '<label class="form-label" style="margin-top:12px;">이력</label><div>' + hist + '</div>' : ''),
            '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal()">닫기</button>');
    }

    function init(mountId, opts) {
        opts = opts || {};
        SUP_MODE = !!opts.supMode;
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        render();
    }
    global.EDUR = {
        init: init, setTab: setTab, setF: setF, resetF: resetF,
        openCreate: openCreate, openEdit: openEdit, doCreate: doCreate, attachFile: attachFile, toggleTarget: toggleTarget, pickDept: pickDept,
        /* 회차(일자 탭) — 최대 5일, 교육시간 자동 합산 */
        sessTab: sessTab, sessAdd: sessAdd, sessDel: sessDel, sessSync: sessSync,
        confirmRemove: confirmRemove, doRemove: doRemove,
        openApply: openApply, applyPickDept: applyPickDept, applyToggle: applyToggle,
        applyAttachSign: applyAttachSign, applyClearSign: applyClearSign, doApply: doApply,
        closeCourse: closeCourse, doClose: doClose, viewDetail: viewDetail
    };
})(window);
