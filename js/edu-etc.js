/* =====================================================================
   edu-etc.js · 기타 교육 (EDU-ETC, EDU-SUP-ETC 공용)
   ---------------------------------------------------------------------
   docs/planning/기획-2026-07-30-회의반영-v1.md §1-4 · 기획-안전보건교육-재설계-v1.md §6.
   자체교육 형식 + **법정 3유형**(작업내용 변경 시 / 특별교육 / 건설업 기초안전보건교육) 선택.
   등록 주체는 **각 과**이고(연도마다 용역·채용자가 달라져 고정할 수 없다), 화면 상단에
   해당 여부 **판단 기준을 상시 노출**해 담당자가 법령 원문을 읽고 판단하지 않게 한다 —
     발주처 "이 기준을 위에다가 띄워놓고 이 기준에 해당하면 이거 만들어서 교육해야 된다"(녹취 1138)
     발주처 "법을 기준으로 해서 판단해서 눌러가지고 하는 것보다는 … 그 법의 근거를
             적어두는 게 나아요"(녹취 1155~1158)
   등록·진행 시 즉시 완료·카운트(참여자에 ETC 유형으로 기록).
   표준: 배지 chip-status+DYV2.toneOf · 빈상태 .v2-empty · 부서 선택 ORGPICK('deptId')
   ===================================================================== */
(function (global) {
    'use strict';
    var V = function () { return global.DYV2; };
    var E = function () { return global.DYEDU; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }

    var SUP_MODE = false;
    var state = { mount: null, fType: '', q: '', dept: '', year: '' };
    var F = null;

    function courseKind() { return SUP_MODE ? 'SUP_ETC' : 'ETC'; }
    function pickWorkers(deptId) {
        var arr = SUP_MODE ? E().supervisorWorkers() : E().fieldWorkers();
        return deptId ? arr.filter(function (w) { return w.deptId === deptId; }) : arr;
    }

    function render() {
        if (!state.mount) return;
        var all = E().courses({ kind: [courseKind()] });
        var list = all.filter(function (c) {
            if (state.fType && c.etcType !== state.fType) return false;
            if (state.dept && c.deptId !== state.dept) return false;
            if (state.year && String(c.date || '').slice(0, 4) !== state.year) return false;
            return EDUFILTER.match(state.q, [c.desc, c.instructor, c.place, c.etcType, E().deptName(c.deptId)]);
        });

        var head = EDUFILTER.bar([
            { type: 'search', id: 'ee-q', value: state.q, placeholder: '내용·강사·장소 검색', on: "EDUE.setF('q', this.value)" },
            { type: 'select', id: 'ee-f-type', value: state.fType, label: '교육 분류',
              options: [['', '분류 전체']].concat(E().ETC_TYPES.map(function (t) { return [t, t]; })), on: "EDUE.setF('fType', this.value)" },
            { type: 'select', id: 'ee-f-dept', value: state.dept, label: '부서',
              options: [['', '부서 전체']].concat(E().deptCandidates().map(function (d) { return [d.id, d.name]; })), on: "EDUE.setF('dept', this.value)" },
            { type: 'select', id: 'ee-f-year', value: state.year, label: '연도',
              options: EDUFILTER.yearOptions(all.map(function (c) { return c.date; })), on: "EDUE.setF('year', this.value)" }
        ], {
            count: list.length, unit: '건', reset: 'EDUE.resetF()',
            actions: '<button type="button" class="btn btn-primary" onclick="EDUE.openCreate()">＋ 기타 교육 등록·진행</button>'
        });

        var cards = list.length ? list.map(cardHtml).join('') :
            '<div class="edu-card"><div class="v2-empty">' +
                (all.length ? '조건에 맞는 기타 교육이 없습니다.' : '등록된 기타 교육이 없습니다.') + '</div></div>';
        state.mount.innerHTML = criteriaHtml() + head + cards;
    }

    /* 해당 여부 판단 기준 — 목록 상단 상시 노출 (2026-07-30 회의).
     * 법령 원문을 읽고 판단하게 하지 않고, 조문에 근거해 미리 만들어 둔 유형을 고르게 한다.
     * 근거 표기는 DYLAW 칩으로만 낸다(CLAUDE.md §10). */
    /* 대상 작업 목록 — 조문(DYLAW 'oshr-t5') 파생. 39종이라 상시 노출하면 표가 밀리므로
     * 접힌 인라인 펼침으로 둔다(§1 — 모달을 새로 띄우지 않는다). */
    function worksList(info) {
        var works = info && info.works;
        if (!info || !info.worksSource || !works || !works.length) return '';
        return '<details class="lawinfo-inline" style="margin-top:6px;">' +
            '<summary>대상 작업 ' + works.length + '종 보기</summary>' +
            '<ol style="margin:6px 0 0;padding-left:20px;">' +
                works.map(function (w) { return '<li value="' + w.no + '">' + esc(w.name) + '</li>'; }).join('') +
            '</ol>' +
            '<p class="file-hint" style="margin:6px 0 0;">출처 — ' + esc(info.worksSource) + '</p>' +
        '</details>';
    }
    function criteriaHtml() {
        var types = E().ETC_TYPES;
        var rows = types.map(function (t) {
            var info = E().etcTypeInfo(t) || {};
            var hrs = (info.hours || []).map(function (x) {
                return esc(x.who) + ' <b>' + x.h + 'h</b>';
            }).join(' · ') || '-';
            /* 대상 작업 목록이 있는 유형(특별교육)은 조문 파생 목록을 그 자리에서 펼친다.
             * 목록이 없으면 지어내지 않고 미등록으로 드러낸다(CLAUDE.md 말미 원칙). */
            var works = info.works || [];
            var mark = info.worksSource
                ? (works.length
                    ? ' <span class="chip-status chip-sm info">대상 작업 ' + works.length + '종</span>'
                    : ' <span class="chip-status chip-sm warning">대상 작업 목록 미등록</span>')
                : '';
            return '<tr><td><b>' + esc(t) + '</b>' + mark + '</td>' +
                '<td>' + esc(info.guide || '-') + worksList(info) + '</td>' +
                '<td>' + hrs + '</td></tr>';
        }).join('');
        var chip = window.DYLAW ? ' ' + DYLAW.basisChip('oshr-t4') : '';
        return '<details class="edu-criteria" open>' +
            '<summary><b>어떤 교육을 해야 하나 — 해당 여부 판단 기준</b>' + chip + '</summary>' +
            '<div class="edu-scroll"><table class="table-figma table-compact"><thead><tr>' +
                '<th style="min-width:150px;">교육 유형</th><th style="min-width:230px;">이럴 때 실시합니다</th>' +
                '<th style="min-width:200px;">법정 최소 교육시간</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
            '<p class="file-hint">기준에 해당하면 <b>[＋ 기타 교육 등록·진행]</b>으로 각 과가 직접 등록합니다. ' +
            '교육시간은 산업안전보건법 시행규칙 별표4 기준입니다.</p>' +
        '</details>';
    }
    /* 결재가 올라간 뒤에는 잠근다 — 판정은 EDUAPV.lockOf 한 곳에서만(CLAUDE.md §4).
     * "공문을 여기다 첨부하면은 문서들에 대한 기록이 남잖아요. 그러면 더 이상 수정이
     *  안 돼요. 이건 문서 위조예요."(2026-07-30 회의) */
    function lockOf(courseId) {
        /* 잠금은 공문 상신이 건다 — 판정은 EDUDOC.lockOf 한 곳(edu-reg.js 와 같은 근거) */
        if (global.EDUDOC && global.EDUDOC.lockOf) return global.EDUDOC.lockOf(courseId);
        return global.EDUAPV && global.EDUAPV.lockOf ? global.EDUAPV.lockOf('course', courseId) : null;
    }
    function cardHtml(c) {
        var stChip = c.status === 'DONE'
            ? '<span class="chip-status chip-sm ' + V().toneOf('완료') + '">완료</span>'
            : '<span class="chip-status chip-sm ' + V().toneOf('진행중') + '">진행중</span>';
        var typeBadge = c.etcType ? '<span class="chip-status chip-sm neutral" style="margin-right:6px;">' + esc(c.etcType) + '</span>' : '';
        var deptChip = c.deptId ? '<span class="chip-status chip-sm neutral" style="margin-right:6px;">' + esc(E().deptName(c.deptId)) + '</span>' : '';
        var enrolls = E().enrolls(c.id);
        var cnt = enrolls.reduce(function (n, e) { return n + (e.workerIds || []).length; }, 0);
        var apv = global.EDUAPV ? '<span class="edu-apv-slot">' + global.EDUAPV.courseControl(c.id) + '</span>' : '';
        var docCtl = global.EDUDOC ? '<span class="edu-doc-slot">' + global.EDUDOC.control(c.id) + '</span>' : '';
        /* 법정 최소 미달 — 시스템이 아는 사실을 감추지 않는다. 저장을 막지는 않았으므로
           (막으면 미달 교육이 아예 기록되지 않는다) 목록에서 계속 드러나야 한다.
           최소는 사람마다 다르므로 몇 명이 미달인지를 함께 낸다. */
        var short = E().etcShortfall ? E().etcShortfall(c) : [];
        var shortChip = short.length
            ? '<span class="chip-status chip-sm danger" style="margin-left:6px;">법정 최소 미달 ' + short.length + '명</span>' : '';
        var lock = lockOf(c.id);
        var workCount = (c.specialWorkNos || []).length + (c.specialWorkOtherReason ? 1 : 0);
        var workChip = c.etcType === '특별교육'
            ? '<span class="chip-status chip-sm info" style="margin-left:6px;">대상 작업 ' + workCount + '건</span>' : '';
        return '<div class="edu-course-card">' +
            '<div class="edu-course-head">' +
                '<div class="edu-course-title">' + typeBadge + deptChip + esc(c.desc) + ' ' + stChip + shortChip + workChip + '</div>' +
                '<div class="edu-course-actions">' + apv + docCtl +
                    '<button type="button" class="btn btn-outline btn-sm" onclick="EDUE.viewDetail(\'' + c.id + '\')">상세</button>' +
                    (lock
                        ? '<button type="button" class="btn btn-outline btn-sm" disabled title="결재 ' + esc(lock) +
                          ' — 공문 기록이 남아 수정·삭제할 수 없습니다">🔒 ' + esc(lock) + '</button>'
                        : '<button type="button" class="btn btn-outline btn-sm" onclick="EDUE.openEdit(\'' + c.id + '\')">수정</button>' +
                    '<button type="button" class="btn btn-outline btn-sm" style="border-color:var(--status-danger-border);color:var(--status-danger-fg);" onclick="EDUE.confirmRemove(\'' + c.id + '\')">삭제</button>') +
                '</div>' +
            '</div>' +
            '<div class="edu-course-meta">' +
                '<span>일정 <b>' + esc(E().courseDateTime(c)) + '</b></span>' +
                '<span>시간 <b' + (short.length ? ' class="edu-short-h"' : '') + '>' + c.hours + 'h</b>'
                    + (short.length ? ' <span class="edu-short-need">최소 ' + short[0].need + 'h</span>' : '') + '</span>' +
                '<span>강사 <b>' + esc(c.instructor || '-') + '</b></span>' +
                '<span>장소 <b>' + esc(c.place || '-') + '</b></span>' +
                '<span>대상자 <b>' + cnt + '명</b></span>' +
            '</div>' +
        '</div>';
    }
    function setF(k, v) { state[k] = v; EDUFILTER.rerender(render); }
    function resetF() { state.fType = ''; state.q = ''; state.dept = ''; state.year = ''; render(); }

    /* =============== 등록 · 수정 =============== */
    function openCreate() {
        var depts = E().deptCandidates();
        F = {
            edit: null,
            etcType: E().ETC_TYPES[0], deptId: depts[0].id,
            date: E().today(), time: '10:00', hours: 2, instructor: '', place: '', desc: '',
            files: [], workerIds: {}, specialWorkNos: {}, specialWorkOtherReason: ''
        };
        renderCreate();
    }
    /* 수정 — 대상자는 이미 이수기록이 붙어 있어 여기서 바꾸지 않는다(삭제 후 재등록 경로) */
    function openEdit(courseId) {
        var c = E().courseOf(courseId); if (!c) return;
        /* **버튼을 감추는 것만으로는 부족하다** — 전역 호출로 뚫린다(CLAUDE.md §12·§4).
           판정은 EDUAPV.lockOf 한 곳이고 여기서는 그 결과만 쓴다. */
        var lock = lockOf(courseId);
        if (lock) { toast('결재 ' + lock + ' 상태라 수정할 수 없습니다 — 반려 후 다시 시도하세요.'); return; }
        F = {
            edit: courseId,
            etcType: c.etcType || E().ETC_TYPES[0], deptId: c.deptId || E().deptCandidates()[0].id,
            date: c.date, time: c.time || '', hours: c.hours,
            instructor: c.instructor || '', place: c.place || '', desc: c.desc || '',
            files: (c.files || []).slice(), workerIds: {}, specialWorkNos: {}, specialWorkOtherReason: c.specialWorkOtherReason || ''
        };
        (c.specialWorkNos || []).forEach(function (no) { F.specialWorkNos[String(no)] = true; });
        renderCreate();
    }
    /* 선택한 교육 분류의 법정 최소 교육시간 + 대상 작업 안내.
     * 발주처 원칙 — "법을 기준으로 해서 판단해서 눌러가지고 하는 것보다는 이 법에 근거해서
     * 만들어 놓은 상태에서 그 법의 근거를 적어두는 게 나아요": 담당자에게 조문을 읽혀
     * 판단시키지 않고, 시스템이 만든 분류를 고르게 하고 근거는 참고로만 붙인다. */
    function typeGuideHtml(label) {
        var info = E().etcTypeInfo(label);
        if (!info) return '';
        var chip = (window.DYLAW && info.basis) ? ' ' + DYLAW.basisChip(info.basis) : '';
        var rows = info.hours.map(function (x) {
            return '<li><b>' + esc(x.who) + '</b> — 최소 <b>' + x.h + '시간</b>' +
                (x.note ? ' <span style="color:var(--text-gray);">(' + esc(x.note) + ')</span>' : '') + '</li>';
        }).join('');
        /* 대상 작업 목록 — 조문 파생. 등록 폼에서 **고르게 하지는 않는다**(해당 여부는
         * 등록자가 판단한다). 목록이 없는 유형은 지어내지 않고 미등록으로 드러낸다. */
        var works = '';
        if (info.worksSource) {
            works = (info.works && info.works.length)
                ? worksList(info)
                : '<p style="margin:6px 0 0;color:var(--status-warning-fg);"><b>대상 작업 목록 미등록</b> — ' +
                  esc(info.worksSource) + ' 수집 후 제공됩니다.</p>';
        }
        return '<div class="check-notice" style="margin-bottom:12px;">' +
            '<div style="font-weight:var(--fw-bold);">' + esc(label) + chip + '</div>' +
            '<p style="margin:4px 0 0;">' + esc(info.guide) + '</p>' +
            '<div style="margin-top:4px;">법정 최소 교육시간</div>' +
            '<ul style="margin:2px 0 0;padding-left:18px;">' + rows + '</ul>' + works +
        '</div>';
    }
    function specialWorksPickerHtml() {
        if (!F || F.etcType !== '특별교육') return '';
        var info = E().etcTypeInfo('특별교육') || {}, works = info.works || [];
        var selected = Object.keys(F.specialWorkNos || {}).filter(function (k) { return F.specialWorkNos[k]; }).length;
        var rows = works.map(function (w) {
            var ck = F.specialWorkNos[String(w.no)] ? ' checked' : '';
            return '<label class="edu-tg-member"><input type="checkbox"' + ck +
                ' onchange="EDUE.toggleSpecialWork(\'' + w.no + '\',this.checked)">' +
                '<span><b>' + w.no + '호</b> ' + esc(w.name) + '</span></label>';
        }).join('');
        return '<div class="edu-modal-row"><label class="form-label">특별교육 대상 작업 <span style="color:var(--status-danger-fg)">*</span> ' +
            '<span style="color:var(--text-gray);font-weight:var(--fw-regular);">(복수 선택 · ' + selected + '건)</span></label>' +
            '<details class="lawinfo-inline" open><summary>별표5 대상 작업에서 선택</summary>' +
            '<div class="edu-tg-body" style="max-height:220px;margin-top:8px;">' + rows + '</div></details>' +
            '<label class="edu-tg-member" style="margin-top:8px;"><input type="checkbox"' + (F.specialWorkOtherReason ? ' checked' : '') +
                ' onchange="EDUE.toggleSpecialOther(this.checked)"><span>기타 — 목록에 없어 법령 매핑이 필요한 작업</span></label>' +
            '<input type="text" class="form-input" id="ee-special-other" value="' + esc(F.specialWorkOtherReason || '') + '" ' +
                'placeholder="기타 작업 내용과 매핑 필요 사유" style="margin-top:6px;"' + (F.specialWorkOtherReason ? '' : ' disabled') + '>' +
            '<p class="file-hint">선택한 작업 번호·명칭을 교육 기록에 보존합니다. 기타는 등록을 막지 않되 법령 매핑 대기로 남깁니다.</p></div>';
    }
    function renderCreate() {
        var typeOpts = E().ETC_TYPES.map(function (t) { return '<option value="' + esc(t) + '"' + (t === F.etcType ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('');
        var ws = pickWorkers(F.deptId);
        var selCnt = Object.keys(F.workerIds).filter(function (k) { return F.workerIds[k]; }).length;
        var rows = ws.length ? ws.map(function (w) {
            var ck = F.workerIds[w.id] ? ' checked' : '';
            return '<label class="edu-tg-member"><input type="checkbox"' + ck +
                ' onchange="EDUE.toggleTarget(\'' + w.id + '\', this.checked)">' +
                '<span>' + esc(w.name) + '</span>' +
                '<span style="color:var(--text-gray);font-size:var(--fs-12);">' + esc(E().catLabel(w.category)) + '</span>' +
            '</label>';
        }).join('') : '<div style="color:var(--text-gray);font-size:var(--fs-12);padding:8px;">이 부서에 대상자가 없습니다.</div>';

        var body =
            '<div class="edu-modal-row-2">' +
                '<div><label class="form-label" for="ee-type">교육 분류 <span style="color:var(--status-danger-fg)">*</span></label>' +
                    '<select class="form-select" id="ee-type" onchange="EDUE.pickType(this.value)">' + typeOpts + '</select></div>' +
                '<div><label class="form-label">부서 <span style="color:var(--status-danger-fg)">*</span></label>' +
                    '<div class="orgpick-field" id="ee-deptfield"><div style="display:flex;gap:8px;align-items:center;">' +
                        '<input type="text" class="form-input" value="' + esc(E().deptName(F.deptId)) + '" readonly aria-label="부서" style="flex:1;background:var(--gray-50);">' +
                        '<button type="button" class="btn btn-sm btn-outline" onclick="ORGPICK.toggle(\'ee-deptfield\',\'deptId\',\'EDUE.pickDept\')">조직도</button>' +
                    '</div></div></div>' +
            '</div>' +
            typeGuideHtml(F.etcType) + specialWorksPickerHtml() +
            '<div class="edu-modal-row-2">' +
                '<div><label class="form-label" for="ee-date">일자 <span style="color:var(--status-danger-fg)">*</span></label>' +
                    '<input type="date" class="form-input" id="ee-date" value="' + esc(F.date) + '"></div>' +
                '<div><label class="form-label" for="ee-time">시작 시각 <span style="color:var(--status-danger-fg)">*</span></label>' +
                    '<input type="time" class="form-input" id="ee-time" value="' + esc(F.time) + '"></div>' +
            '</div>' +
            '<div class="edu-modal-row"><label class="form-label" for="ee-hours">교육 시간(h) <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="number" class="form-input" id="ee-hours" value="' + F.hours + '" style="max-width:120px;"></div>' +
            '<div class="edu-modal-row"><label class="form-label" for="ee-inst">강사</label>' +
                '<input type="text" class="form-input" id="ee-inst" value="' + esc(F.instructor) + '"></div>' +
            '<div class="edu-modal-row"><label class="form-label" for="ee-place">장소</label>' +
                '<input type="text" class="form-input" id="ee-place" value="' + esc(F.place) + '"></div>' +
            '<div class="edu-modal-row"><label class="form-label" for="ee-desc">내용 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<textarea class="form-textarea" id="ee-desc" rows="2">' + esc(F.desc) + '</textarea></div>' +
            (F.edit
                ? '<div class="check-notice">대상자는 이 화면에서 바꾸지 않습니다 — 이미 반영된 이수시간과 어긋나므로 <b>삭제 후 재등록</b>으로 처리합니다.</div>'
                : '<div class="edu-modal-row"><label class="form-label">대상자 <span style="color:var(--status-danger-fg)">*</span> ' +
                    '<span style="color:var(--text-gray);font-weight:var(--fw-regular);">(' + selCnt + ' / ' + ws.length + '명)</span></label>' +
                    '<div class="edu-tg-body" style="max-height:200px;">' + rows + '</div>' +
                  '</div>') +
            /* 첨부는 자체교육과 동일 구성 — 발주처: "교육하는 방법은 똑같이 정기 교육에
             * 자체 교육 버튼에 들어가 가지고 하는 그거" (교육일지 및 교육사진 등 한 칸) */
            EDUFORM.renderAttach(F, 'EDUE', 'done');
        V().openModal((SUP_MODE ? '관리감독자 ' : '') + (F.edit ? '기타 교육 수정' : '기타 교육 등록·진행'), body,
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUE.doCreate()">' + (F.edit ? '저장' : '진행 처리') + '</button>');
    }
    /* 재렌더 전 입력값 보존 — 원본은 체크·부서 변경 시 타이핑 값이 유실됐다(이식 시 보완) */
    function captureCreate() {
        var el = function (id) { return document.getElementById(id); };
        if (el('ee-type')) F.etcType = el('ee-type').value;
        if (el('ee-date')) F.date = el('ee-date').value;
        if (el('ee-time')) F.time = el('ee-time').value;
        if (el('ee-hours')) F.hours = parseFloat(el('ee-hours').value) || 0;
        if (el('ee-inst')) F.instructor = el('ee-inst').value.trim();
        if (el('ee-place')) F.place = el('ee-place').value.trim();
        if (el('ee-desc')) F.desc = el('ee-desc').value.trim();
        if (el('ee-special-other') && !el('ee-special-other').disabled) F.specialWorkOtherReason = el('ee-special-other').value.trim();
    }
    function pickType(v) { captureCreate(); F.etcType = v; renderCreate(); }
    function pickDept(id, name) { captureCreate(); F.deptId = id; F.workerIds = {}; renderCreate(); }
    function toggleTarget(id, on) { captureCreate(); if (on) F.workerIds[id] = true; else delete F.workerIds[id]; renderCreate(); }
    function toggleSpecialWork(no, on) { captureCreate(); if (on) F.specialWorkNos[String(no)] = true; else delete F.specialWorkNos[String(no)]; renderCreate(); }
    function toggleSpecialOther(on) { captureCreate(); F.specialWorkOtherReason = on ? (F.specialWorkOtherReason || '내용 입력 필요') : ''; renderCreate(); }
    function addFile(slot) { captureCreate(); EDUFORM.addFile(F, slot); renderCreate(); }
    function delFile(i) { captureCreate(); EDUFORM.delFile(F, i); renderCreate(); }
    function doCreate() {
        captureCreate();
        if (!F.date || !F.time || !F.hours || !F.desc) { toast('일자·시각·시간·내용을 모두 입력하세요.'); return; }
        var specialNos = Object.keys(F.specialWorkNos || {}).filter(function (k) { return F.specialWorkNos[k]; });
        if (F.etcType === '특별교육' && !specialNos.length && !F.specialWorkOtherReason) { toast('특별교육 대상 작업을 1건 이상 선택하세요.'); return; }
        if (F.etcType === '특별교육' && F.specialWorkOtherReason === '내용 입력 필요') { toast('기타 대상 작업 내용을 입력하세요.'); return; }
        if (F.edit) {
            E().updateCourse(F.edit, {
                etcType: F.etcType, deptId: F.deptId, date: F.date, time: F.time, hours: F.hours,
                instructor: F.instructor, place: F.place, desc: F.desc, files: F.files,
                specialWorkNos: F.etcType === '특별교육' ? specialNos : [],
                specialWorkOtherReason: F.etcType === '특별교육' ? F.specialWorkOtherReason : ''
            });
            E().pushCourseHistory(F.edit, { type: 'STATUS', by: E().deptName(F.deptId), memo: '기타 교육 정보 수정' });
            V().closeModal();
            toast('기타 교육 정보를 저장했습니다.');
            render();
            return;
        }
        var ids = Object.keys(F.workerIds).filter(function (k) { return F.workerIds[k]; });
        if (!ids.length) { toast('대상자를 1명 이상 선택하세요.'); return; }
        var c = E().addCourse({
            kind: courseKind(), etcType: F.etcType, deptId: F.deptId,
            date: F.date, time: F.time, hours: F.hours, instructor: F.instructor, place: F.place, desc: F.desc,
            files: F.files, specialWorkNos: F.etcType === '특별교육' ? specialNos : [],
            specialWorkOtherReason: F.etcType === '특별교육' ? F.specialWorkOtherReason : '',
            status: 'DONE', createdBy: E().deptName(F.deptId)
        });
        E().addEnroll({ courseId: c.id, deptId: F.deptId, workerIds: ids, at: F.date });
        E().recordCourseCompletion(c.id, ids, F.hours, F.date);
        E().pushCourseHistory(c.id, { type: 'STATUS', by: E().deptName(F.deptId), memo: F.etcType + ' 진행 처리 · ' + ids.length + '명 카운트' });
        V().closeModal();
        /* 법정 최소 미달은 **막지 않고 알린다** — 미달로 실시된 교육도 기록은 남아야 하고,
           막으면 담당자가 시간을 부풀려 적는다. 대신 그 사실이 이력과 목록에 계속 남는다. */
        var short = E().etcShortfall(c);
        if (short.length) {
            E().pushCourseHistory(c.id, { type: 'STATUS', by: E().deptName(F.deptId),
                memo: '법정 최소 교육시간 미달 ' + short.length + '명 (실시 ' + F.hours + 'h · 최소 ' + short[0].need + 'h)' });
            toast(F.etcType + ' 진행 완료 · ' + ids.length + '명 · 법정 최소 미달 ' + short.length + '명');
        } else {
            toast(F.etcType + ' 진행 완료 · ' + ids.length + '명 카운트');
        }
        render();
    }

    function viewDetail(courseId) {
        var c = E().courseOf(courseId); if (!c) return;
        var enrolls = E().enrolls(courseId);
        var names = enrolls.map(function (e) {
            return (e.workerIds || []).map(function (id) { var w = E().workerOf(id); return w ? w.name : id; }).join(', ');
        }).join(' · ');
        var hist = (c.history || []).map(function (h) {
            return '<div style="padding:6px 0;border-bottom:1px dashed var(--card-line);font-size:var(--fs-12);">' +
                '<span style="color:var(--text-gray);margin-right:8px;">' + esc(h.at) + '</span>' +
                esc(h.memo) + (h.by ? '<span style="color:var(--text-gray);margin-left:6px;">— ' + esc(h.by) + '</span>' : '') +
            '</div>';
        }).join('');
        /* 법정 최소 — 미달이면 누가 미달인지 이름으로 낸다(목록은 인원수만 알려준다).
           판정하지 않는 유형(특별교육)은 왜 판정하지 않는지를 대신 밝힌다 — 아무 표시가
           없으면 '검사했고 이상 없음'으로 읽힌다. */
        var short = E().etcShortfall(c);
        var info = E().etcTypeInfo(c.etcType) || {};
        var selectedWorks = (info.works || []).filter(function (w) { return (c.specialWorkNos || []).map(String).indexOf(String(w.no)) >= 0; });
        var worksBlock = c.etcType === '특별교육'
            ? '<div style="margin-top:10px;"><b>대상 작업:</b> ' +
                (selectedWorks.length ? selectedWorks.map(function (w) { return w.no + '호 ' + esc(w.name); }).join('<br>') : '') +
                (c.specialWorkOtherReason ? (selectedWorks.length ? '<br>' : '') + '기타 — ' + esc(c.specialWorkOtherReason) : '') + '</div>' : '';
        var lawBlock = short.length
            ? '<div class="check-notice" style="margin-top:10px;border-color:var(--status-danger-border);">' +
                '<b>법정 최소 교육시간 미달 ' + short.length + '명</b> — 실시 ' + c.hours + 'h · 최소 ' + short[0].need + 'h<br>' +
                short.map(function (x) { return esc(x.worker.name) + '(' + esc(E().empLabel(x.worker.empType)) + ' · 최소 ' + x.need + 'h)'; }).join(', ') +
                '<br><span class="file-hint">기록은 그대로 남습니다 — 미달 사실을 지우지 않기 위해서입니다.</span>' +
              '</div>'
            : (info.perCourseCheck === false && info.checkNote
                ? '<div class="check-notice" style="margin-top:10px;"><b>이 유형은 한 건만으로 미달을 판정하지 않습니다</b><br>' +
                    esc(info.checkNote) + '</div>'
                : '');
        V().openModal((c.etcType || '기타 교육') + ' — 상세',
            '<div style="font-size:var(--fs-13);">' +
                '<div style="font-weight:var(--fw-bold);">' + esc(c.desc) + '</div>' +
                '<div style="color:var(--text-gray);margin-top:6px;">' +
                    (c.deptId ? esc(E().deptName(c.deptId)) + ' · ' : '') +
                    '일정 ' + esc(E().courseDateTime(c)) + ' · ' + c.hours + 'h · 강사 ' + esc(c.instructor || '-') + ' · 장소 ' + esc(c.place || '-') +
                '</div>' +
                '<div style="margin-top:10px;"><b>대상자:</b> ' + esc(names || '없음') + '</div>' + worksBlock +
            '</div>' + lawBlock +
            (hist ? '<label class="form-label" style="margin-top:12px;">이력</label><div>' + hist + '</div>' : ''),
            '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal()">닫기</button>');
    }

    /* =============== 삭제 =============== */
    function confirmRemove(courseId) {
        var c = E().courseOf(courseId); if (!c) return;
        /* **버튼을 감추는 것만으로는 부족하다** — 전역 호출로 뚫린다(CLAUDE.md §12·§4).
           판정은 EDUAPV.lockOf 한 곳이고 여기서는 그 결과만 쓴다. */
        var lock = lockOf(courseId);
        if (lock) { toast('결재 ' + lock + ' 상태라 삭제할 수 없습니다 — 반려 후 다시 시도하세요.'); return; }
        var cnt = E().enrolls(courseId).reduce(function (n, e) { return n + (e.workerIds || []).length; }, 0);
        V().openModal('기타 교육 삭제',
            '<p style="font-size:var(--fs-13);"><b>' + esc(c.etcType || '기타 교육') + '</b> · ' + esc(c.desc) + '<br>' +
                esc(E().courseDateTime(c)) + ' · ' + c.hours + 'h</p>' +
            (cnt ? '<div class="check-notice" style="margin-top:10px;">대상자 <b>' + cnt + '명</b>에게 반영된 <b>이수시간 ' + c.hours + 'h 도 함께 회수</b>됩니다.</div>' : '') +
            '<p style="font-size:var(--fs-12);color:var(--text-gray);margin-top:8px;">삭제 후에는 되돌릴 수 없습니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUE.doRemove(\'' + courseId + '\')">삭제</button>');
    }
    function doRemove(courseId) {
        var r = E().removeCourse(courseId);
        V().closeModal();
        toast(r ? '기타 교육을 삭제했습니다 · 이수기록 ' + r.records + '건 회수' : '교육을 찾을 수 없습니다.');
        render();
    }

    function init(mountId, opts) {
        opts = opts || {};
        SUP_MODE = !!opts.supMode;
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        if (global.EDUAPV) global.EDUAPV.registerRefresh(render);
        render();
    }
    global.EDUE = {
        init: init, setF: setF, resetF: resetF,
        openCreate: openCreate, openEdit: openEdit, pickType: pickType, pickDept: pickDept, toggleTarget: toggleTarget, doCreate: doCreate,
        toggleSpecialWork: toggleSpecialWork, toggleSpecialOther: toggleSpecialOther,
        addFile: addFile, delFile: delFile,
        confirmRemove: confirmRemove, doRemove: doRemove,
        viewDetail: viewDetail
    };
})(window);
