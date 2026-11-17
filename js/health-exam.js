/* =====================================================================
   health-exam.js · 건강검진 목록 (HEX01-L)
   · 상단 필터(기준연도·검진 유형·부서) · 요약 카드(클릭=상태 필터)
   · 개인정보 최소수집: 인원수·수검률·증빙만 관리하고 개인별 검진 결과는 담지 않는다
     (건강진단 결과 = 민감정보 · 개보법 §23·산안법 §132 / 사업주 수령 문서는 집계형 결과표)
   · 완료 결과는 인력평가 「종사자의 건강진단 등 건강관리」 항목에 자동 연계
   · 부서의 결과 문서 제출은 이 화면이 아니라 업무함(W-HLT-EXE 「검진 결과 통보서」)이 받는다
     — 같은 문서를 올릴 자리를 두 곳에 두지 않는다
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var S = function () { return global.DYSH; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    /* ===== 권한 (CLAUDE.md §12) =====
     * 건강검진은 **개인 건강정보**다 — 남의 부서 검진 결과·대상 인원을 볼 이유가 없다.
     * 조회 범위는 DYROLE.scope(), 조작(계획 등록·증빙 첨부)은 DYROLE.canAct() 단일 출처.
     * 부서를 **이름**으로 저장하는 도메인이라 DYV2.deptIdOf() 로 id 를 얻어 물어본다(§3). */
    function R() { return global.DYROLE; }
    function inScope(r) { return !R() || R().inScope(V().deptIdOf(r.dept)); }
    function canAct(deptName) { return !R() || R().canAct(deptName ? V().deptIdOf(deptName) : ''); }
    function roNote() { return R() ? R().readOnlyNote('검진 계획 등록·증빙 첨부') : ''; }
    /* 등록 부서 — 부서 담당자는 소속 부서로 고정하고 주관부서 담당자만 고른다(기획확인 4차 3-3,
       2026-10-06). 교육 등록 폼과 같은 규칙이다(DYEDU.canPickDept). 종전에는 판정에 부서를 넘기지
       않아(canAct()) 부서 담당자가 남의 부서 계획을 등록할 수 있었고, 그 건은 조회 범위 밖이라
       등록한 본인 목록에서도 사라졌다. 작업환경측정·건강검진이 같은 규칙을 쓴다. */
    function canPickDept() { return !R() || R().canAct(R().OWNER_DEPT); }
    function myDeptName() {
        var p = R() && R().current ? R().current() : null;
        var n = p && p.deptId ? V().orgNode(p.deptId) : null;
        return n ? n.name : '';
    }
    function deptFieldHtml(fieldId, inputId, onpick, value) {
        var fixed = !canPickDept();
        return '<div class="orgpick-field" id="' + fieldId + '"><div style="display:flex;gap:8px;">' +
                '<input type="text" class="form-input" id="' + inputId + '" readonly placeholder="조직도에서 부서 선택" style="flex:1;" value="' + esc(value || '') + '">' +
                (fixed ? '' : '<button type="button" class="btn btn-outline" onclick="ORGPICK.toggle(\'' + fieldId + '\',\'dept\',\'' + onpick + '\')">조직도</button>') +
            '</div>' +
            (fixed ? '<p class="file-hint">소속 부서 계획으로 등록합니다 — 다른 부서 계획은 그 부서 담당자가 등록합니다.</p>' : '') +
        '</div>';
    }
    /* 조작 차단 문구 — 조사는 DYV2.josa() 가 붙인다('증빙 첨부은(는)' 같은 표기를 내지 않는다) */
    function canOwner() { return !R() || R().canAct(R().OWNER_DEPT); }
    function denyNote(what) { return what + V().josa(what, '은', '는') + ' 해당 부서 담당자가 수행합니다.'; }

    var state = { mount: null, year: '2026', type: '', dept: '', tile: 'all' };

    function ownerName(o) { return (o || '').split('·').pop().trim(); }

    function baseRows() {
        return S().health().filter(function (r) {
            return inScope(r)
                && (!state.year || String(r.year) === state.year)
                && (!state.type || r.type === state.type)
                && (!state.dept || r.dept === state.dept);
        });
    }
    /* 필터는 '건(행)' 단위 상태 타일에만 적용 — 인원(명) 집계는 순수 지표(비클릭) */
    function tilePass(r) {
        switch (state.tile) {
            case 'followup':   return S().hcFollowup(r);
            case 'overdue':    return S().effHealth(r).key === 'OVERDUE';
            default:           return true;
        }
    }

    function stChip(r) { var st = S().effHealth(r); return '<span class="sh-st ' + st.tone + '">' + esc(st.label) + '</span>'; }
    function typeTag(t) { return '<span class="sh-tag' + (t === '특수건강진단' ? ' spec' : '') + '">' + esc(t) + '</span>'; }

    /* 인원(명) 지표 3종은 비클릭 KPI, 상태(건) 2종만 클릭 필터 — 값 단위와 필터 대상 단위를 일치 */
    function tiles(sum) {
        var kpis = [
            { label: '전체 대상자', val: sum.target,    unit: '명', tone: 'info' },
            { label: '검진 완료',   val: sum.examined,  unit: '명', tone: 'success' },
            { label: '미검진',      val: sum.unexamined, unit: '명', tone: 'neutral' }
        ];
        var filters = [
            { k: 'followup', label: '사후관리 대상', val: sum.followup, unit: '건', tone: 'warning' },
            { k: 'overdue',  label: '기한 초과',    val: sum.overdue,  unit: '건', tone: 'danger' }
        ];
        var kpiHtml = kpis.map(function (d) {
            return '<div class="sh-tile is-kpi tone-' + d.tone + '">' +
                '<span class="sh-tile-label"><span class="sh-tile-dot"></span>' + d.label + '</span>' +
                '<span class="sh-tile-value">' + d.val + '<span class="unit">' + d.unit + '</span></span></div>';
        }).join('');
        var fHtml = filters.map(function (d) {
            var on = state.tile === d.k;
            return '<button type="button" class="sh-tile tone-' + d.tone + (on ? ' is-active' : '') +
                '" aria-pressed="' + (on ? 'true' : 'false') + '" title="클릭하여 목록 필터"' +
                ' onclick="HEX.setTile(\'' + d.k + '\')">' +
                '<span class="sh-tile-label"><span class="sh-tile-dot"></span>' + d.label + '</span>' +
                '<span class="sh-tile-value">' + d.val + '<span class="unit">' + d.unit + '</span></span></button>';
        }).join('');
        return '<div class="sh-sum">' + kpiHtml + fHtml + '</div>';
    }

    function toolbarHtml() {
        var deptOpts = ['<option value="">부서 전체</option>'].concat(
            /* 조회 범위 밖 부서는 필터 선택지에도 내지 않는다 — 목록에서 지워 놓고
               드롭다운에 남기면 '있는데 안 보여준다'로 읽힌다(§12). */
            uniq(S().health().filter(inScope).map(function (r) { return r.dept; })).map(function (d) {
                return '<option value="' + esc(d) + '"' + (state.dept === d ? ' selected' : '') + '>' + esc(d) + '</option>';
            })).join('');
        return '<div class="sh-toolbar"><div class="sh-filters">' +
            '<span class="sh-fl">기준연도</span>' +
            '<select class="form-select" aria-label="기준연도" onchange="HEX.setYear(this.value)">' + yearOpt('2026') + yearOpt('2025') + '</select>' +
            '<span class="sh-fl">검진 유형</span>' +
            '<select class="form-select" aria-label="검진 유형" onchange="HEX.setType(this.value)">' +
                '<option value="">전체</option>' +
                '<option value="일반건강검진"' + (state.type === '일반건강검진' ? ' selected' : '') + '>일반건강검진</option>' +
                '<option value="특수건강진단"' + (state.type === '특수건강진단' ? ' selected' : '') + '>특수건강진단</option>' +
            '</select>' +
            '<span class="sh-fl">부서</span>' +
            '<select class="form-select" aria-label="부서" onchange="HEX.setDept(this.value)">' + deptOpts + '</select>' +
            '</div>' +
            (canAct() ? '<div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;">' +
                '<button type="button" class="btn btn-outline" onclick="HEX.openNew()">검진 계획 등록</button>' +
                '<button type="button" class="btn btn-primary" onclick="HEX.openResult()">＋ 결과 등록</button></div>' : '') + '</div>';
    }

    function render() {
        if (!state.mount) return;
        var base = baseRows();
        var sum = S().healthSummary(base);
        var list = base.filter(tilePass);

        var linkbar =
            '<div class="sh-linkbar">' + S().icon('check', 18) + '<div>' +
                /* 운영 T14(2026-11-04) — 연계·개인정보 원칙 설명은 걷고 이 화면에서 하는 일만 남긴다 */
                '이 화면은 인원수·수검률·결과보고서만 관리합니다. 개인별 검진 결과는 올리지 않습니다.</div>' +
            '</div>';

        var thead = '<th>대상 부서</th><th>검진 유형</th><th>위탁 검진기관</th><th>예정일 · 실시일</th>' +
            '<th class="num">대상 인원</th><th class="num">수검률</th><th>결과보고서</th><th>사후관리</th><th>완료 상태</th><th>담당자</th>';
        var rows = list.length ? list.map(rowSimple).join('') :
            '<tr><td colspan="10" class="sh-empty">조건에 맞는 건강검진 건이 없습니다.</td></tr>';

        state.mount.innerHTML = linkbar + tiles(sum) + noticeLine() + toolbarHtml() + roNote() +
            '<div class="sh-wrap"><table class="sh-table"><thead><tr>' + thead + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
        /* «지금 할 일» — 재난안전과 담당자에게 보낼 결과 안내 공문이 있으면 그 버튼을 강조한다 */
        if (canOwner() && S().hcNoticeRows(state.year).length) S().markNow(state.mount, 'hc-notice');
    }

    /* 공통 셀 조각 */
    function eviCell(r) {
        /* 결과보고서는 실시일이 있어야 붙는다(운영 E04 ①) — 미실시 건에는 첨부 수단을 내지 않는다 */
        if (r.evidence) return '<span class="sh-attached">' + S().icon('file') + '첨부됨</span>';
        /* 결과는 [결과 등록] 한 창에서 파일·실시일·수검 인원을 함께 받는다(작업환경측정과 같다) */
        return resultable(r)
            ? '<button type="button" class="sh-pill-link" onclick="event.stopPropagation();HEX.openResult(\'' + r.id + '\')">＋ 결과 등록</button>'
            : '<span class="sh-pill-none">미첨부</span>';
    }
    function followupCell(r) {
        return r.followupNeeded
            ? (r.followupDone ? '<span class="sh-res ok">완료</span>' : '<span class="sh-res warn">대상</span>')
            : '<span style="color:var(--text-gray)">해당없음</span>';
    }
    function baseCells(r) {
        var doneTxt = r.done ? esc(r.done) : '<span style="color:var(--text-gray)">미실시</span>';
        return '<td><a class="sh-rowlink" href="health-exam-detail.html?id=' + r.id + '" onclick="event.stopPropagation()">' + esc(r.dept) + '</a></td>' +
            '<td>' + typeTag(r.type) + '</td>' +
            '<td>' + esc(r.agency) + '</td>' +
            '<td>' + esc(r.planned) + ' <span style="color:var(--text-gray)">/</span> ' + doneTxt + '</td>';
    }

    /* 목록 행 — 대상 인원·수검률(집계)·결과보고서 첨부 중심 */
    function rowSimple(r) {
        /* 실시일이 없으면 수검률은 «-»(운영 E04 ②) — 판정은 DYSH.hcRate 한 곳 */
        var rate = S().hcRate(r);
        return '<tr onclick="HEX.detail(\'' + r.id + '\')">' + baseCells(r) +
            '<td class="num">' + r.targetCount + '</td>' +
            '<td class="num">' + (rate == null ? '<span style="color:var(--text-gray)">-</span>' : rate + '%') + '</td>' +
            '<td>' + eviCell(r) + '</td>' +
            '<td>' + followupCell(r) + '</td>' +
            '<td>' + stChip(r) + '</td>' +
            '<td>' + esc(ownerName(r.owner)) + '</td></tr>';
    }

    function yearOpt(y) { return '<option value="' + y + '"' + (state.year === y ? ' selected' : '') + '>' + y + '년</option>'; }
    function uniq(a) { var s = {}, o = []; a.forEach(function (x) { if (!s[x]) { s[x] = 1; o.push(x); } }); return o; }

    function setYear(v) { state.year = v; render(); }
    function setType(v) { state.type = v; render(); }
    function setDept(v) { state.dept = v; render(); }
    function setTile(v) { state.tile = (state.tile === v ? 'all' : v); render(); }
    function detail(id) { location.href = 'health-exam-detail.html?id=' + id; }

    /* ===== 연도별 결과 안내 공문 줄 — 보내기는 재난안전과 담당자만, 보낸 공문 보기는 전 부서를 보는 사람도
       (작업환경측정 반기 줄과 같은 모양) ===== */
    function noticeLine() {
        var own = canOwner();
        if (!own && !(R() && R().scope && R().scope() === 'all')) return '';
        var st = S().hcYearStat(state.year);
        if (!st.total && !st.docs.length) return '';
        var key = String(state.year);
        var nd = S().noticeDue('hc', st.notice);
        var docs = st.docs.map(function (d, i) {
            return '<button type="button" class="btn btn-sm btn-outline" onclick="HEXDOC.openDoc(\'' + key + '\',\'' + d.sid + '\')">' +
                (st.docs.length > 1 ? (i + 1) + '차 ' : '') + '공문 보기 · ' + esc(d.status) + '</button>';
        }).join('');
        var pend = st.pending.map(function (r) { return esc(r.dept) + ' ' + esc(r.type) + '(' + esc(String(r.planned || '').slice(5)) + ')'; }).join(' · ');
        return '<div class="sh-card" style="display:flex;flex-wrap:wrap;align-items:center;gap:var(--sp-2) var(--sp-3);margin-bottom:var(--stack-tight);">' +
            '<b>' + esc(state.year) + ' 결과 안내</b>' +
            '<span style="color:var(--text-gray);">검진 ' + st.done + ' / ' + st.total + '건 · 공문 보냄 ' + st.sent + '건</span>' +
            (st.notice.length && own ? '<button type="button" class="btn btn-sm btn-outline" data-step="hc-notice" onclick="HEXDOC.open(\'' + key + '\')">결과 안내 공문 (' + st.notice.length + '건)</button>' : '') +
            (nd && own ? '<span class="sh-st ' + (V().daysTo(nd) < 0 ? 'danger' : 'warning') + '">공문 기한 ' + esc(nd) + ' — 노동관서 보고 대상 포함</span>' : '') +
            docs +
            (pend ? '<span class="file-hint" style="flex-basis:100%;">검진 전: ' + pend + ' — 결과가 들어오면 다음 공문으로 보냅니다.</span>' : '') +
        '</div>';
    }

    /* ===== 결과 등록 — 한 창에서 끝낸다 (작업환경측정 [＋ 결과 등록]과 같다, 2026-11-16) =====
     * 검진기관 결과 통보서 한 부 + 실시일 + 건별 수검 인원·사후관리 대상 유무를 한 번에 받는다.
     * 계획이 없으면 같은 창에서 부서·유형·대상 인원을 적어 그 자리에서 건을 만든다.
     * 개인별 결과는 받지 않는다 — 인원 집계와 사후관리 대상 «유무»뿐이다. */
    var RG = null;
    function resultable(r) { return r && !r.done && canAct(r.dept) && !S().hcLockOf(r.id); }
    function openResult(rowId) {
        if (!canAct()) { V().toast(denyNote('결과 등록')); return; }
        var r = rowId ? S().healthOf(rowId) : null;
        if (rowId && !resultable(r)) { V().toast('이 건에는 결과를 등록할 수 없습니다.'); return; }
        RG = { date: S().TODAY, received: S().TODAY, file: null, agency: r ? (r.agency === '미지정' ? '' : r.agency) : '', sel: {}, extra: [] };
        if (r) RG.sel[r.id] = { ex: r.targetCount, fu: false };
        renderResult();
    }
    function rgCands() {
        return S().hcYearRows(String(RG.date).slice(0, 4)).filter(resultable);
    }
    function rgCapture() {
        if (!RG) return;
        var g = function (id) { return document.getElementById(id); };
        if (g('hr-date')) RG.date = g('hr-date').value || RG.date;
        if (g('hr-agency')) RG.agency = g('hr-agency').value;
        if (g('hr-recv')) RG.received = g('hr-recv').value || RG.received;
        Object.keys(RG.sel).forEach(function (k) {
            var o = RG.sel[k];
            if (g('hr-ex-' + k)) o.ex = Number(g('hr-ex-' + k).value);
            if (g('hr-fu-' + k)) o.fu = g('hr-fu-' + k).checked;
            o.lb = g('hr-lb-' + k) ? g('hr-lb-' + k).checked : false;
        });
        RG.extra.forEach(function (o, i) {
            if (g('hr-xt-type-' + i)) o.type = g('hr-xt-type-' + i).value;
            if (g('hr-xt-tg-' + i)) o.target = Number(g('hr-xt-tg-' + i).value);
            if (g('hr-xt-ex-' + i)) o.ex = Number(g('hr-xt-ex-' + i).value);
            if (g('hr-xt-fu-' + i)) o.fu = g('hr-xt-fu-' + i).checked;
            o.lb = g('hr-xt-lb-' + i) ? g('hr-xt-lb-' + i).checked : false;
        });
    }
    /* 법정 보고 소견(시행규칙 §210③) — 특수·수시·임시검진에만 묻는다. 고르면 결과표를 받은 날부터 30일 안에
       재난안전과가 사후관리 조치결과 보고서를 노동관서에 낸다. 일반검진·요관찰 소견은 법정 보고 대상이 아니다. */
    function laborField(idLb, o, type) {
        if (!S().hcLegalType({ type: type })) return '';
        return '<label style="flex-basis:100%;"><input type="checkbox" id="' + idLb + '"' + (o.lb ? ' checked' : '') + '> ' +
            '근로 금지·제한, 작업전환, 근로시간 단축, 직업병 확진 의뢰 소견 있음 <span class="file-hint">노동관서 보고 대상 — 결과표 받은 날부터 30일</span></label>';
    }
    function lineFields(idEx, idFu, o, target, type, idLb) {
        return '<div style="display:flex;flex-wrap:wrap;gap:var(--sp-2);margin-top:var(--sp-2);align-items:center;">' +
            '<label class="file-hint" for="' + idEx + '">수검자 수</label><input type="number" class="form-input" id="' + idEx + '" style="width:90px;" min="0"' +
                (target != null ? ' max="' + target + '"' : '') + ' value="' + esc(o.ex != null ? o.ex : (target || 0)) + '">' +
            (target != null ? '<span class="file-hint">/ 대상 ' + target + '명</span>' : '') +
            '<label><input type="checkbox" id="' + idFu + '"' + (o.fu ? ' checked' : '') + '> 사후관리 대상 있음</label>' +
            laborField(idLb, o, type) + '</div>';
    }
    function renderResult() {
        var cand = rgCands();
        Object.keys(RG.sel).forEach(function (k) { if (!cand.some(function (r) { return r.id === k; })) delete RG.sel[k]; });
        var rows = cand.map(function (r) {
            var o = RG.sel[r.id];
            return '<div style="border:1px solid var(--card-line);border-radius:var(--radius-sm);padding:var(--sp-2) var(--sp-3);margin-bottom:var(--sp-1-5, 6px);">' +
                '<label style="display:flex;gap:var(--sp-2);align-items:center;"><input type="checkbox"' + (o ? ' checked' : '') +
                    ' onchange="HEX.rgToggle(\'' + r.id + '\', this.checked)"> <b>' + esc(r.dept) + '</b> <span class="file-hint">' + esc(r.type) + ' · 계획 ' + esc(String(r.planned || '').slice(5)) + '</span></label>' +
                (o ? lineFields('hr-ex-' + r.id, 'hr-fu-' + r.id, o, r.targetCount, r.type, 'hr-lb-' + r.id) : '') +
            '</div>';
        }).join('');
        var extra = RG.extra.map(function (o, i) {
            return '<div style="border:1px dashed var(--card-line);border-radius:var(--radius-sm);padding:var(--sp-2) var(--sp-3);margin-bottom:var(--sp-1-5, 6px);">' +
                '<div style="display:flex;flex-wrap:wrap;gap:var(--sp-2);align-items:center;"><b>' + esc(o.dept) + '</b>' +
                    '<select class="form-select" id="hr-xt-type-' + i + '" style="width:auto;" aria-label="검진 유형" onchange="HEX.rgRedraw()">' +
                        ['일반건강검진', '특수건강진단'].map(function (t) { return '<option' + (o.type === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select>' +
                    '<label class="file-hint" for="hr-xt-tg-' + i + '">대상자 수</label><input type="number" class="form-input" id="hr-xt-tg-' + i + '" style="width:90px;" min="1" value="' + esc(o.target || '') + '">' +
                    '<button type="button" class="btn btn-sm btn-outline" onclick="HEX.rgDropExtra(' + i + ')">빼기</button></div>' +
                lineFields('hr-xt-ex-' + i, 'hr-xt-fu-' + i, o, null, o.type, 'hr-xt-lb-' + i) +
            '</div>';
        }).join('');
        var fixed = !canPickDept();
        V().openModal('건강검진 결과 등록',
            '<p class="file-hint" style="margin-bottom:var(--sp-3);">검진기관이 보낸 결과 통보서를 올리고 건마다 수검 인원과 사후관리 대상 유무를 적습니다. 개인별 결과는 올리지 않습니다.</p>' +
            '<label class="form-label">결과 통보서 <span style="color:var(--status-danger-fg)">*</span></label>' +
            (RG.file ? '<p style="margin-bottom:var(--sp-2);">' + S().icon('file') + ' <b>' + esc(RG.file.name) + '</b></p>' : '') +
            V().uploadDrop('파일을 끌어다 놓거나 클릭하여 업로드', null, { hint: true, pick: 'HEX.rgPick' }) +
            '<div style="display:flex;flex-wrap:wrap;gap:var(--sp-3);margin:var(--sp-3) 0;">' +
                '<div><label class="form-label" for="hr-date">검진 실시일 <span style="color:var(--status-danger-fg)">*</span></label>' +
                    '<input type="date" class="form-input" id="hr-date" value="' + esc(RG.date) + '" onchange="HEX.rgRedraw()"></div>' +
                '<div><label class="form-label" for="hr-recv">결과 통보서 받은 날 <span style="color:var(--status-danger-fg)">*</span></label>' +
                    '<input type="date" class="form-input" id="hr-recv" value="' + esc(RG.received) + '"></div>' +
                '<div style="flex:1 1 200px;"><label class="form-label" for="hr-agency">검진기관</label>' +
                    '<input type="text" class="form-input" id="hr-agency" value="' + esc(RG.agency || '') + '" placeholder="예: (주)녹십자헬스케어"></div>' +
            '</div>' +
            '<label class="form-label">검진 건 <span style="color:var(--status-danger-fg)">*</span> <span class="file-hint">' + esc(String(RG.date).slice(0, 4)) + '년 · 결과가 아직 없는 계획</span></label>' +
            (rows || '<p class="file-hint">결과를 기다리는 계획이 없습니다.</p>') + extra +
            '<div class="orgpick-field" id="hr-xt-field" style="margin-top:var(--sp-2);">' +
                (fixed ? '<button type="button" class="btn btn-sm btn-outline" onclick="HEX.rgAddExtra(\'' + esc(myDeptName()) + '\')">＋ 계획에 없는 검진 추가</button>'
                       : '<button type="button" class="btn btn-sm btn-outline" onclick="HEX.rgCapture();ORGPICK.toggle(\'hr-xt-field\',\'dept\',\'HEX.rgAddExtra\')">＋ 계획에 없는 검진 추가 (부서 고르기)</button>') +
            '</div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="HEX.saveResult()">등록</button>');
    }
    function rgRedraw() { rgCapture(); renderResult(); }
    function rgToggle(id, on) { rgCapture(); if (on) { var r = S().healthOf(id); RG.sel[id] = { ex: r ? r.targetCount : 0, fu: false }; } else delete RG.sel[id]; renderResult(); }
    function rgPick(items) { rgCapture(); RG.file = items && items[0] ? { name: items[0].name, size: items[0].size } : null; renderResult(); }
    function rgAddExtra(name) {
        rgCapture();
        if (!name) return;
        if (!canAct(name)) { V().toast(denyNote('다른 부서 검진 결과 등록')); return; }
        RG.extra.push({ dept: name, type: '일반건강검진', target: '', ex: '', fu: false });
        renderResult();
    }
    function rgDropExtra(i) { rgCapture(); RG.extra.splice(i, 1); renderResult(); }
    function saveResult() {
        if (!RG) return;
        rgCapture();
        if (!canAct()) { V().toast(denyNote('결과 등록')); return; }
        if (!RG.file) { V().toast('결과 통보서 파일을 올리세요.'); return; }
        if (!RG.date || RG.date > S().TODAY) { V().toast('검진 실시일을 확인하세요 — 오늘 이후일 수 없습니다.'); return; }
        if (!RG.received || RG.received < RG.date || RG.received > S().TODAY) { V().toast('결과 통보서 받은 날을 확인하세요 — 실시일과 오늘 사이입니다.'); return; }
        var picked = rgCands().filter(function (r) { return RG.sel[r.id]; });
        if (!picked.length && !RG.extra.length) { V().toast('결과를 등록할 검진을 1건 이상 고르세요.'); return; }
        for (var i = 0; i < picked.length; i++) {
            var ex = RG.sel[picked[i].id].ex;
            if (!Number.isInteger(ex) || ex < 0 || ex > picked[i].targetCount) { V().toast(picked[i].dept + ' — 수검자 수는 0명 이상 대상자 수 이하입니다.'); return; }
        }
        for (var j = 0; j < RG.extra.length; j++) {
            var o = RG.extra[j];
            if (!Number.isInteger(o.target) || o.target < 1) { V().toast(o.dept + ' — 대상자 수를 1명 이상 입력하세요.'); return; }
            if (!Number.isInteger(o.ex) || o.ex < 0 || o.ex > o.target) { V().toast(o.dept + ' — 수검자 수는 0명 이상 대상자 수 이하입니다.'); return; }
        }
        var n = 0, agency = (RG.agency || '').trim();
        var finish = function (r, o) {
            if (!resultable(r)) return;
            if (agency && (!r.agency || r.agency === '미지정')) r.agency = agency;
            var lb = !!o.lb && S().hcLegalType(r);
            S().completeHealth(r.id, { doneDate: RG.date, received: RG.received, examinedCount: o.ex, followupNeeded: !!o.fu || lb, laborReport: lb });
            if (S().attachEvidence('hc', r.id, '결과보고서', RG.file.name)) n++;
        };
        picked.forEach(function (r) { finish(r, RG.sel[r.id]); });
        RG.extra.forEach(function (o) {
            if (!canAct(o.dept)) return;
            var r = S().addHealth({ dept: o.dept, type: o.type, agency: agency || '미지정', targetCount: o.target, planned: RG.date });
            finish(r, o);
        });
        RG = null; V().closeModal(); render();
        V().toast(n ? '결과를 ' + n + '건 등록했습니다.' + (canOwner() ? ' 이제 결과 안내 공문을 보냅니다.' : '') : '등록하지 못했습니다.');
    }

    /* ===== 결과 안내 공문 — DYDOC 단순 기안(작업환경측정 WENVDOC 과 같은 골격) =====
     * 별지는 부서별 집계(대상·수검·미검진·사후관리 대상 유무)뿐이다 — 개인별 결과를 싣지 않는다(산안법 §132②·③). */
    function rowsOf(t, doc) {
        if (doc && doc.rowIds) return doc.rowIds.map(function (id) { return S().healthOf(id); }).filter(Boolean);
        return t ? t.rows : [];
    }
    function setupNoticeDoc() {
        if (!global.DYDOC || global.HEXDOC) return;
        global.DYDOC.define({
            ns: 'HEXDOC', lkey: 'dy-hexdoc-apprline-v1', simple: true, simplePick: true,
            targetOf: function (key) {
                if (!/^\d{4}$/.test(String(key || ''))) return null;
                return { key: String(key), year: Number(key), rows: S().hcNoticeRows(key) };
            },
            subjectOf: function (t) { return t.year + '년 건강검진 결과 안내'; },
            titleOf: function (t) {
                var n = S().hcYearStat(t.year).docs.filter(function (d) { return d.status !== '반려' && d.status !== '반송'; }).length;
                return t.year + '년 건강검진 결과 안내' + (n ? '(' + (n + 1) + '차)' : '');
            },
            initOf: function () { return { docType: '외부발송', to: '수신자 참조' }; },
            recipientsDefault: function (t) {
                var seen = {}, out = [];
                (t ? t.rows : []).forEach(function (r) { var id = V().deptIdOf(r.dept); if (id && !seen[id]) { seen[id] = 1; out.push(id); } });
                return out;
            },
            recipientsDefaultLabel: '결과가 들어온 검진의 부서',
            recipientName: function (id) { var n = V().orgNode ? V().orgNode(id) : null; return (n ? n.name : id) + '장'; },
            recipientWarn: function (t, ids) {
                var miss = (t ? t.rows : []).filter(function (r) { return ids.indexOf(V().deptIdOf(r.dept)) < 0; }).map(function (r) { return r.dept; });
                miss = miss.filter(function (x, i) { return miss.indexOf(x) === i; });
                return miss.length ? '별지에 ' + esc(miss.join(', ')) + ' 검진이 있는데 수신처에서 빠졌습니다.' : '';
            },
            canDraft: function () { return canOwner() ? { ok: true } : { ok: false, why: '결과 안내 공문은 재난안전과 담당자가 보냅니다.' }; },
            ready: function (t) {
                if (!t.rows.length) return { ok: false, why: '공문에 실을 검진 결과가 없습니다 — [결과 등록]을 먼저 합니다.' };
                var noRep = t.rows.filter(function (r) { return !S().hcReportFiles(r).length; });
                if (noRep.length) return { ok: false, why: '결과 통보서가 없는 검진: ' + noRep.map(function (r) { return r.dept + ' ' + r.type; }).join(', ') };
                return { ok: true };
            },
            chips: function (t) {
                var rows = t.rows, tg = 0, ex = 0, fu = 0;
                rows.forEach(function (r) { tg += r.targetCount || 0; ex += r.examinedCount || 0; if (r.followupNeeded) fu++; });
                var lab = rows.filter(function (r) { return S().hcLaborReport(r); });
                return [
                    { label: '결과 안내', text: '1. ' + t.year + '년 건강검진 실시 결과를 붙임과 같이 알려 드립니다.\n  가. 대상: 붙임 별지의 ' + rows.length + '건(대상 ' + tg + '명 · 수검 ' + ex + '명 · 미검진 ' + (tg - ex) + '명)\n  나. 사후관리 대상이 있는 검진: ' + fu + '건' },
                    { label: '후속 요청', text: '2. 미검진자는 추가검진을, 사후관리 대상이 있는 부서는 사후관리 조치를 하시고 중대재해 통합관리시스템 › 작업환경·건강 › 건강검진에서 완료 처리하여 주시기 바랍니다.' +
                        (lab.length ? '\n  가. 근로 금지·제한, 작업전환 등 소견이 있는 검진(' + lab.map(function (r) { return r.dept; }).join(', ') + ')은 ' + lab.map(function (r) { return S().hcLaborDue(r); }).sort()[0] + '까지 조치하여 주시기 바랍니다(결과표를 받은 날부터 30일 안에 노동관서에 조치결과를 보고합니다).' : '') },
                    { label: '개인 결과', text: '3. 개인별 검진 결과는 검진기관이 본인에게 통보하며, 본인 동의 없이 공개하거나 다른 목적으로 사용할 수 없습니다.' }
                ];
            },
            attachOf: function (t) {
                var seen = {}, out = [];
                (t ? t.rows : []).forEach(function (r) {
                    S().hcReportFiles(r).forEach(function (f) {
                        if (seen[f.name]) return; seen[f.name] = 1;
                        out.push({ label: f.name, meta: '결과 통보서', on: true, size: f.size || null });
                    });
                });
                return out;
            },
            annexes: function (t, doc) {
                var rows = rowsOf(t, doc);
                if (!rows.length) return [];
                return [{
                    title: '부서별 건강검진 결과 (' + rows.length + '건)',
                    html: '<table class="table-figma table-doc"><thead><tr>' +
                            '<th>연번</th><th>부서</th><th>검진 유형</th><th>검진기관</th><th>실시일</th><th>대상</th><th>수검</th><th>미검진</th><th>사후관리 대상</th>' +
                          '</tr></thead><tbody>' +
                        rows.map(function (r, i) {
                            return '<tr><td>' + (i + 1) + '</td><td>' + esc(r.dept) + '</td><td>' + esc(r.type) + '</td><td>' + esc(r.agency) + '</td>' +
                                '<td>' + esc(r.done) + '</td><td>' + (r.targetCount || 0) + '명</td><td>' + (r.examinedCount || 0) + '명</td>' +
                                '<td>' + S().hcUnexamined(r) + '명</td><td>' + (r.followupNeeded ? '있음' : '없음') + '</td></tr>';
                        }).join('') + '</tbody></table>'
                }];
            },
            basisOf: function () {
                var L = global.DYLAW;
                if (!L || !L.basisTitle) return [];
                return ['osh-129'].map(function (k) { var tt = L.basisTitle(k); return tt ? { key: k, label: tt } : null; }).filter(Boolean);
            },
            save: function (t, doc) { S().saveHcNotice(t.year, doc, t.rows.map(function (r) { return r.id; })); },
            docsFor: function (t) { return t ? S().hcYearStat(t.year).docs : []; },
            nextNo: function () { return S().nextHcNoticeNo(); },
            lockNote: '보낸 뒤에는 이 공문에 실린 검진의 결과(실시일·수검 인원·사후관리 대상 유무)와 결과 통보서를 고칠 수 없습니다. 추가검진·사후관리는 계속 진행합니다.',
            sentNote: '결과 안내 공문을 온나라 연계기안함에 보냈습니다. 미검진자·사후관리 대상이 있는 부서는 내 할일에 그 일이 생깁니다.'
        }).registerRefresh(render);
    }

    function openNew() {
        if (!canAct()) { V().toast(denyNote('검진 계획 등록')); return; }
        V().openModal('건강검진 계획 등록',
            /* 대상 부서 — 조직도(DYV2.ORG) 인라인 트리에서 선택 */
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="he-n-deptname">대상 부서 <span style="color:var(--status-danger-fg)">*</span></label>' +
                deptFieldHtml('he-n-deptfield', 'he-n-deptname', 'HEX.pickDept', canPickDept() ? (state.dept || '') : myDeptName()) + '</div>' +
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="he-n-type">검진 유형</label>' +
                '<select class="form-select" id="he-n-type" onchange="HEX.onTypeChange()"><option>일반건강검진</option><option>특수건강진단</option></select></div>' +
            '<div class="ri-modal-row" id="he-n-basis-row" style="margin-bottom:12px;"><label class="form-label" for="he-n-basis">대상 근거</label>' +
                '<input type="text" class="form-input" id="he-n-basis" placeholder="일반: 사무직/그 밖의 근로자 · 특수: 유해인자·배치업무"></div>' +
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="he-n-agency">위탁 검진기관 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="text" class="form-input" id="he-n-agency" placeholder="예: 담양군보건소 / (주)녹십자헬스케어"></div>' +
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="he-n-target">대상자 수</label>' +
                '<input type="number" class="form-input" id="he-n-target" value="10" min="1"></div>' +
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="he-n-planned">검진 예정일</label>' +
                '<input type="date" class="form-input" id="he-n-planned" value="' + S().addDays(S().TODAY, 14) + '"></div>' +
            '<div class="ri-modal-row"><label><input type="checkbox" id="he-n-carc"> 고용노동부 고시 30년 보존 대상 물질 취급 기록</label></div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="HEX.saveNew()">등록</button>');
    }
    function onTypeChange() {
        var type = document.getElementById('he-n-type');
        var basis = document.getElementById('he-n-basis');
        if (!type || !basis) return;
        basis.placeholder = type.value === '특수건강진단'
            ? '필수: 대상 유해인자와 배치업무'
            : '예: 사무직 / 그 밖의 근로자';
    }
    function pickDept(name) {
        if (!canAct(name)) { V().toast(denyNote('다른 부서 검진 계획 등록')); return; }
        var inp = document.getElementById('he-n-deptname'); if (inp) inp.value = name;
    }
    function saveNew() {
        if (!canAct()) { V().toast(denyNote('검진 계획 등록')); return; }
        var dept = (document.getElementById('he-n-deptname').value || '').trim();
        var agency = (document.getElementById('he-n-agency').value || '').trim();
        var type = document.getElementById('he-n-type').value;
        var targetBasis = (document.getElementById('he-n-basis').value || '').trim();
        var targetCount = Number(document.getElementById('he-n-target').value);
        var planned = document.getElementById('he-n-planned').value;
        if (!dept) { V().toast('대상 부서를 선택하세요.'); return; }
        /* 저장에도 같은 판정 — 화면에서 부서를 고정해도 전역 호출로 다른 부서가 들어올 수 있다 */
        if (!canAct(dept)) { V().toast(denyNote('다른 부서 검진 계획 등록')); return; }
        if (!agency) { V().toast('검진기관을 입력하세요.'); return; }
        if (!Number.isInteger(targetCount) || targetCount < 1) { V().toast('대상자 수를 1명 이상 입력하세요.'); return; }
        if (!planned) { V().toast('검진 예정일을 선택하세요.'); return; }
        if (type === '특수건강진단' && !targetBasis) { V().toast('특수건강진단 대상 유해인자와 배치업무를 입력하세요.'); return; }
        /* 중복 계획 — year 는 숫자로 저장되므로 문자열과 직접 비교하면 영영 안 걸린다.
           (실측: r.year === '2026' 은 0건, String(r.year) === '2026' 은 6건) */
        var dup = S().health().filter(function (r) {
            return String(r.year) === String(planned).slice(0, 4) && r.dept === dept && r.type === type && r.planned === planned;
        })[0];
        if (dup) { V().toast('같은 부서·검진유형·예정일의 계획이 이미 있습니다.'); return; }
        S().addHealth({
            dept: dept,
            type: type,
            agency: agency,
            targetCount: targetCount,
            targetBasis: targetBasis,
            planned: planned,
            carcinogen: !!document.getElementById('he-n-carc').checked
        });
        V().closeModal(); render(); V().toast('검진 계획이 등록되었습니다.');
    }

    function init(mountId) {
        setupNoticeDoc();
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        var q = new URLSearchParams(location.search);
        if (q.get('dept')) state.dept = q.get('dept');
        if (q.get('year')) state.year = q.get('year');
        render();
    }

    global.HEX = { init: init,
        setYear: setYear, setType: setType, setDept: setDept, setTile: setTile,
        detail: detail, openResult: openResult, saveResult: saveResult, rgRedraw: rgRedraw, rgToggle: rgToggle, rgPick: rgPick,
        rgAddExtra: rgAddExtra, rgDropExtra: rgDropExtra, rgCapture: rgCapture,
        openNew: openNew, saveNew: saveNew, onTypeChange: onTypeChange, pickDept: pickDept };
})(window);
