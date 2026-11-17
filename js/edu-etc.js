/* =====================================================================
   edu-etc.js · 기타 교육 (EDU-ETC, EDU-SUP-ETC 공용)
   ---------------------------------------------------------------------
   docs/planning/기획-2026-07-30-회의반영-v1.md §1-4 · 기획-안전보건교육-재설계-v1.md §6.
   자체교육 형식 + **법정 유형** 선택. 유형 목록은 모집단이 정한다 — 별표4가 제1호
   (근로자)와 제1호의2(관리감독자)를 다른 표로 두기 때문이다. `DYEDU.etcTypes(supMode)`
   한 창구에서만 받고 이 파일이 배열을 다시 쓰지 않는다.
     · 근로자(EDU-ETC)      3유형 — 작업내용 변경 시 / 특별교육 / 건설업 기초안전보건교육
     · 관리감독자(EDU-SUP-ETC) 2유형 — 작업내용 변경 시 / 특별교육
       (건설업 기초는 제1호의2 에 없다. 산안법 §31① 이 「건설업의 사업주」가
        「건설 일용근로자를 채용할 때」로 의무 주체를 한정한다.)
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
            /* 부서 담당자에게는 자기 부서 것만 — 채용시교육·현업근로자 명단과 같은 조회 범위(2차 통화 검수 L-1) */
            if (global.DYROLE && global.DYROLE.inScope && !global.DYROLE.inScope(c.deptId)) return false;
            if (state.fType && c.etcType !== state.fType) return false;
            if (state.dept && c.deptId !== state.dept) return false;
            if (state.year && String(c.date || '').slice(0, 4) !== state.year) return false;
            return EDUFILTER.match(state.q, [c.desc, c.instructor, c.place, c.etcType, E().deptName(c.deptId)]);
        });

        var scopedDepts = E().deptCandidates().filter(function (d) {
            return !global.DYROLE || !global.DYROLE.inScope || global.DYROLE.inScope(d.id);
        });
        var head = EDUFILTER.bar([
            { type: 'search', id: 'ee-q', value: state.q, placeholder: '제목·강사·장소 검색', on: "EDUE.setF('q', this.value)" },
            { type: 'select', id: 'ee-f-type', value: state.fType, label: '교육 분류',
              options: [['', '분류 전체']].concat(E().etcTypes(SUP_MODE).map(function (t) { return [t, t]; })), on: "EDUE.setF('fType', this.value)" },
            /* 부서 조건도 조회 범위를 따르고, 하나뿐이면 두지 않는다(§12) */
            scopedDepts.length > 1 ? { type: 'select', id: 'ee-f-dept', value: state.dept, label: '부서',
              options: [['', '부서 전체']].concat(scopedDepts.map(function (d) { return [d.id, d.name]; })), on: "EDUE.setF('dept', this.value)" } : null,
            { type: 'select', id: 'ee-f-year', value: state.year, label: '연도',
              options: EDUFILTER.yearOptions(all.map(function (c) { return c.date; })), on: "EDUE.setF('year', this.value)" }
        ], {
            count: list.length, unit: '건', reset: 'EDUE.resetF()',
            /* 재난안전과는 검토만 — «타 부서가 올린 거를 저희가 점검하는 거니까»(2차 통화 04:39). 자기 부서 몫만 등록(D-4) */
            actions: (E().canRegister() ? '<button type="button" class="btn btn-primary" onclick="EDUE.openCreate()">＋ ' + (E().isOwnerStaff() ? '우리 부서 기타 교육 등록' : '기타 교육 등록') + '</button>' : '')
        });
        /* 재난안전과에는 한 줄만 — 필터 줄 안에 두면 필터가 세 줄로 밀리고, 조회 계층에는 readOnlyNote 가 같은 말을 한다(2차 통화 검토 C-2) */
        var ownerNote = E().isOwnerStaff() ? '<p class="file-hint" style="margin:0 0 10px;">기타 교육은 각 부서 담당자가 등록하고 실시 결과 보고 공문을 보냅니다. 재난안전과는 결과를 봅니다.</p>' : '';

        var cards = list.length ? list.map(cardHtml).join('') :
            '<div class="edu-card"><div class="v2-empty">' +
                (all.length ? '조건에 맞는 기타 교육이 없습니다.' : '등록된 기타 교육이 없습니다.') + '</div></div>';
        /* 관리·감독 계층에는 등록·수정 수단 대신 누가 하는지를 밝힌다(담당자에게는 '') */
        var ro = global.DYROLE && global.DYROLE.readOnlyNote ? global.DYROLE.readOnlyNote('기타 교육 등록·수정') : '';
        state.mount.innerHTML = criteriaHtml() + ro + ownerNote + head + cards;
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
        var types = E().etcTypes(SUP_MODE);
        var rows = types.map(function (t) {
            var info = E().etcTypeInfo(t, SUP_MODE) || {};
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
        /* 등록하는 부서 담당자에게만 펼쳐 둔다 — 등록하지 않는 재난안전과·조회 계층에게는 접어 둔다(긴 표가 목록을 밀어낸다) */
        var openAttr = E().canRegister() && !E().isOwnerStaff() ? ' open' : '';
        return '<details class="edu-criteria"' + openAttr + '>' +
            '<summary><b>어떤 교육을 해야 하나 — 해당 여부 판단 기준</b>' + chip + '</summary>' +
            '<div class="edu-scroll"><table class="table-figma table-compact"><thead><tr>' +
                '<th style="min-width:150px;">교육 유형</th><th style="min-width:230px;">이럴 때 실시합니다</th>' +
                '<th style="min-width:200px;">법정 최소 교육시간</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
            '<p class="file-hint">기준에 해당하면 <b>[＋ 기타 교육 등록]</b>으로 각 과가 직접 등록합니다. ' +
            '교육시간은 산업안전보건법 시행규칙 별표4 기준입니다.</p>' +
        '</details>';
    }
    function cardHtml(c) {
        var typeBadge = c.etcType ? '<span class="chip-status chip-sm neutral" style="margin-right:6px;">' + esc(c.etcType) + '</span>' : '';
        var deptChip = c.deptId ? '<span class="chip-status chip-sm neutral" style="margin-right:6px;">' + esc(E().deptName(c.deptId)) + '</span>' : '';
        var enrolls = E().enrolls(c.id);
        var cnt = enrolls.reduce(function (n, e) { return n + (e.workerIds || []).length; }, 0);
        /* 법정 최소 미달 — 시스템이 아는 사실을 감추지 않는다. 저장을 막지는 않았으므로
           (막으면 미달 교육이 아예 기록되지 않는다) 목록에서 계속 드러나야 한다.
           최소는 사람마다 다르므로 몇 명이 미달인지를 함께 낸다. */
        var short = E().etcShortfall ? E().etcShortfall(c) : [];
        var shortChip = short.length
            /* 상세를 걷었으므로 누가 미달인지는 칩의 title 로 남긴다(다른 부서 사람은 조회 범위대로 가린다) */
            ? '<span class="chip-status chip-sm danger" style="margin-left:6px;" title="' + esc(short.map(function (x) { return E().personLabel(x.worker.id) + ' 최소 ' + x.need + 'h'; }).join(', ')) + '">법정 최소 미달 ' + short.length + '명</span>' : '';
        var workCount = (c.specialWorkNos || []).length + (c.specialWorkOtherReason ? 1 : 0);
        var workChip = c.etcType === '특별교육'
            ? '<span class="chip-status chip-sm info" style="margin-left:6px;">대상 작업 ' + workCount + '건</span>' : '';
        return '<div class="edu-course-card">' +
            '<div class="edu-course-head">' +
                '<div class="edu-course-title">' + typeBadge + deptChip + esc(c.desc) + ' ' + shortChip + workChip + '</div>' +
                /* [결재 상태 칩] [공문 보기] 둘만(2차 통화) — 그 부서 담당자에게만 [공문 보내기]·[다시 보내기]·«등록 취소».
                   [상세]·[수정]·[삭제]·자물쇠 버튼은 걷었다 */
                '<div class="edu-course-actions">' + (global.EDUDOC ? global.EDUDOC.runCtl(c) : '') +
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

    /* ===== 조작 권한 — 판정은 DYEDU(DYROLE.canAct 파생) 한 곳이다 =====
     * 기타 교육은 각 과가 직접 등록한다. 관리·감독 계층은 조회만 하고, 부서 담당자는 자기
     * 부서 건만, 주관부서 담당자는 전 부서 건을 처리한다. 진입·저장 양쪽에 같은 판정을 건다. */
    function deny(deptId) { toast(E().denyMsg(deptId)); }

    /* =============== 등록 · 수정 =============== */
    function openCreate(preset) {
        if (!E().canRegister()) { deny(E().defaultDeptId()); return; }
        F = {
            /* 기본 부서는 로그인한 사람의 소속 — 목록 첫 부서를 기본으로 두면 남의 부서 명의로 저장된다 */
            etcType: E().etcTypes(SUP_MODE)[0], deptId: E().defaultDeptId(),
            date: E().today(), time: '10:00', hours: 2, instructor: '', place: '', desc: '',
            files: [], workerIds: {}, specialWorkNos: {}, specialWorkOtherReason: ''
        };
        /* 현업근로자 관리 › 작업내용 변경 이력의 [기타 교육 등록] — ?type=change&worker=ID */
        if (preset && preset.type === 'change' && E().etcTypes(SUP_MODE).indexOf(E().CHANGE_EDU) !== -1) {
            F.etcType = E().CHANGE_EDU; F.desc = '작업내용 변경 시 안전보건교육';
            /* 그 창의 모집단 사람만 — 관리감독자 창에 현업근로자를 넣으면 보이지 않는 선택이 저장을 막는다 */
            if (preset.worker && pickWorkers(F.deptId).some(function (w) { return w.id === preset.worker; })) F.workerIds[preset.worker] = true;
        }
        preselectChange();
        renderCreate();
    }
    /* [수정]·[삭제]·[상세]는 걷었다(2차 통화 «결재 상태 칩 + 공문 보기 둘만»). 고치는 길은 공문 전·반려 때
       [공문 보기] 창의 «등록 취소»(묶음 전체) 하나다 — 판정은 EDUDOC.runCtl · DYEDU.cancelRun 한 곳. 되살리지 말 것. */
    /* 선택한 교육 분류의 법정 최소 교육시간 + 대상 작업 안내.
     * 발주처 원칙 — "법을 기준으로 해서 판단해서 눌러가지고 하는 것보다는 이 법에 근거해서
     * 만들어 놓은 상태에서 그 법의 근거를 적어두는 게 나아요": 담당자에게 조문을 읽혀
     * 판단시키지 않고, 시스템이 만든 분류를 고르게 하고 근거는 참고로만 붙인다. */
    function typeGuideHtml(label) {
        var info = E().etcTypeInfo(label, SUP_MODE);
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
        var info = E().etcTypeInfo('특별교육', SUP_MODE) || {}, works = info.works || [];
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
        var typeOpts = E().etcTypes(SUP_MODE).map(function (t) { return '<option value="' + esc(t) + '"' + (t === F.etcType ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('');
        var ws = pickWorkers(F.deptId);
        var selCnt = Object.keys(F.workerIds).filter(function (k) { return F.workerIds[k]; }).length;
        /* «작업내용 변경 시 교육» — 업무가 바뀐 뒤 아직 교육을 안 받은 사람을 맨 위에(현업근로자 관리 › 작업내용 변경 이력, 2차 통화) */
        var pendIds = {};
        if (F.etcType === E().CHANGE_EDU) E().changePending(F.deptId, SUP_MODE).forEach(function (w) { pendIds[w.id] = w; });
        var member = function (w) {
            var ck = F.workerIds[w.id] ? ' checked' : '';
            var log = pendIds[w.id] ? (w.dutyLog || [])[w.dutyLog.length - 1] : null;
            return '<label class="edu-tg-member"><input type="checkbox"' + ck +
                ' onchange="EDUE.toggleTarget(\'' + w.id + '\', this.checked)">' +
                '<span>' + esc(w.name) + '</span>' +
                '<span style="color:var(--text-gray);font-size:var(--fs-12);">' + esc(E().catLabel(w.category)) +
                    (log ? ' · ' + esc(log.at) + ' 업무 변경 ' + esc(dutyNames(log.from)) + ' → ' + esc(dutyNames(log.to)) : '') + '</span>' +
            '</label>';
        };
        var pendList = ws.filter(function (w) { return pendIds[w.id]; });
        var rest = ws.filter(function (w) { return !pendIds[w.id]; });
        var rows = ws.length
            ? (pendList.length ? '<div class="file-hint" style="margin:2px 0 4px;"><b>작업내용 변경 후 미이수 ' + pendList.length + '명</b></div>' + pendList.map(member).join('') +
                  (rest.length ? '<div class="file-hint" style="margin:8px 0 4px;">그 밖의 사람</div>' : '') : '') + rest.map(member).join('')
            : '<div style="color:var(--text-gray);font-size:var(--fs-12);padding:8px;">이 부서에 대상자가 없습니다.</div>';

        var body =
            '<div class="edu-modal-row-2">' +
                '<div><label class="form-label" for="ee-type">교육 분류 <span style="color:var(--status-danger-fg)">*</span></label>' +
                    '<select class="form-select" id="ee-type" onchange="EDUE.pickType(this.value)">' + typeOpts + '</select></div>' +
                '<div><label class="form-label">부서 <span style="color:var(--status-danger-fg)">*</span></label>' +
                    '<div class="orgpick-field" id="ee-deptfield"><div style="display:flex;gap:8px;align-items:center;">' +
                        '<input type="text" class="form-input" value="' + esc(E().deptName(F.deptId)) + '" readonly aria-label="부서" style="flex:1;background:var(--gray-50);">' +
                        /* 부서는 주관부서 담당자만 고른다 — 그 밖의 담당자는 소속 부서로 고정 */
                        /* 누구든 소속 부서로 고정 — 남의 부서 실시 결과 보고 공문이 섞이지 않게(2026-11-16) */
                    '</div>' +
                    '<p class="file-hint">소속 부서로 등록합니다 — 저장하면 실시 결과 보고 공문으로 이어집니다.</p>' +
                    '</div></div>' +
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
            '<div class="edu-modal-row"><label class="form-label" for="ee-desc">제목 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="text" class="form-input" id="ee-desc" value="' + esc(F.desc) + '"></div>' +
            '<div class="edu-modal-row"><label class="form-label">대상자 <span style="color:var(--status-danger-fg)">*</span> ' +
                '<span style="color:var(--text-gray);font-weight:var(--fw-regular);">(' + selCnt + ' / ' + ws.length + '명)</span></label>' +
                '<div class="edu-tg-body" style="max-height:200px;">' + rows + '</div>' +
            '</div>' +
            /* 첨부는 자체교육과 동일 구성 — 발주처: "교육하는 방법은 똑같이 정기 교육에
             * 자체 교육 버튼에 들어가 가지고 하는 그거" (교육일지 및 교육사진 등 한 칸) */
            EDUFORM.renderAttach(F, 'EDUE', 'done');
        V().openModal((SUP_MODE ? '관리감독자 ' : '') + '기타 교육 등록', body,
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUE.doCreate()">저장하고 공문 작성 →</button>');
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
    function dutyNames(list) { return (list || []).map(function (n) { var d = E().dutyOf(n); return d ? d.short : n; }).join('·') || '없음'; }
    /* «작업내용 변경 시 교육»을 고르면 변경 후 미이수자를 미리 고른다(나머지 사람도 고를 수 있다 — 막지 않는다) */
    function preselectChange() {
        if (F.etcType !== E().CHANGE_EDU) return;
        E().changePending(F.deptId, SUP_MODE).forEach(function (w) { F.workerIds[w.id] = true; });
    }
    function pickType(v) { captureCreate(); F.etcType = v; preselectChange(); renderCreate(); }
    function toggleTarget(id, on) { captureCreate(); if (on) F.workerIds[id] = true; else delete F.workerIds[id]; renderCreate(); }
    function toggleSpecialWork(no, on) { captureCreate(); if (on) F.specialWorkNos[String(no)] = true; else delete F.specialWorkNos[String(no)]; renderCreate(); }
    function toggleSpecialOther(on) { captureCreate(); F.specialWorkOtherReason = on ? (F.specialWorkOtherReason || '내용 입력 필요') : ''; renderCreate(); }
    function addFile(slot) { captureCreate(); EDUFORM.addFile(F, slot); renderCreate(); }
    function delFile(i) { captureCreate(); EDUFORM.delFile(F, i); renderCreate(); }
    function doCreate() {
        captureCreate();
        /* 새 등록은 소속 부서로만 — 전역 호출로 남의 부서를 넣어도 막는다(실시 결과 보고 공문이 섞인다) */
        if (!E().canActOwnDept(F.deptId)) { deny(F.deptId); return; }
        /* **셀렉트에서 감추는 것만으로는 부족하다** — 전역 호출(EDUE.pickType)로 뚫린다.
           별표4 제1호의2 에 없는 유형이 관리감독자 교육으로 저장되면, 그 뒤로는 화면이
           법에 없는 의무를 이수기록으로 들고 있게 된다(CLAUDE.md §4 저장 경로 가드). */
        if (E().etcTypes(SUP_MODE).indexOf(F.etcType) < 0) {
            toast(SUP_MODE
                ? '관리감독자 교육과정이 아닙니다 — 별표4 제1호의2 는 작업내용 변경 시 교육·특별교육 둘만 정합니다.'
                : '교육 종류를 다시 선택하세요.');
            return;
        }
        if (!F.date || !F.time || !F.hours || !F.desc) { toast('일자·시각·시간·내용을 모두 입력하세요.'); return; }
        var specialNos = Object.keys(F.specialWorkNos || {}).filter(function (k) { return F.specialWorkNos[k]; });
        if (F.etcType === '특별교육' && !specialNos.length && !F.specialWorkOtherReason) { toast('특별교육 대상 작업을 1건 이상 선택하세요.'); return; }
        if (F.etcType === '특별교육' && F.specialWorkOtherReason === '내용 입력 필요') { toast('기타 대상 작업 내용을 입력하세요.'); return; }
        /* 화면에 보이는 사람만 저장한다 — 보이지 않는 선택(전역 호출·옛 선택)이 섞이면 모집단 검사에서 통째로 거절된다 */
        var shown = {}; pickWorkers(F.deptId).forEach(function (w) { shown[w.id] = 1; });
        var ids = Object.keys(F.workerIds).filter(function (k) { return F.workerIds[k] && shown[k]; });
        if (!ids.length) { toast('대상자를 1명 이상 선택하세요.'); return; }
        /* 현업근로자 기타교육에 관리감독자, 관리감독자 기타교육에 근로자가 섞이지 않게(운영 E19).
           교육을 만들기 전에 본다 — 만든 뒤 등록부가 거절되면 대상자 없는 교육이 남는다. */
        var popWhy = E().populationIssue(courseKind(), ids);
        if (popWhy) { toast(popWhy); return; }
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
        }
        if (short.length) toast('법정 최소 교육시간 미달 ' + short.length + '명 — 기록은 남기고 목록에 표시합니다.');
        render();
        /* 저장하고 바로 실시 결과 보고 공문(등록 한 번 = 공문 한 번 — 2차 통화) */
        if (global.EDUDOC) global.EDUDOC.open(E().keyRun(E().batchOf(c)));
    }

    function init(mountId, opts) {
        opts = opts || {};
        SUP_MODE = !!opts.supMode;
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        if (global.EDUDOC) global.EDUDOC.registerRefresh(render);
        render();
        var qs = new URLSearchParams(location.search);
        /* ?doc=R|묶음 — 내 할일 «공문 보내기» · ?type=change&worker= — 작업내용 변경 이력에서 */
        if (global.EDUDOC && global.EDUDOC.openFromQuery) global.EDUDOC.openFromQuery();
        if (qs.get('type') === 'change' && E().canRegister()) setTimeout(function () { openCreate({ type: 'change', worker: qs.get('worker') || '' }); }, 0);
    }
    global.EDUE = {
        init: init, setF: setF, resetF: resetF,
        openCreate: openCreate, pickType: pickType, toggleTarget: toggleTarget, doCreate: doCreate,
        toggleSpecialWork: toggleSpecialWork, toggleSpecialOther: toggleSpecialOther,
        addFile: addFile, delFile: delFile
    };
})(window);
