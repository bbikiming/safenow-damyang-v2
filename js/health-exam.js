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
            (canAct() ? '<button type="button" class="btn btn-primary" onclick="HEX.openNew()">＋ 검진 계획 등록</button>' : '') + '</div>';
    }

    function render() {
        if (!state.mount) return;
        var base = baseRows();
        var sum = S().healthSummary(base);
        var list = base.filter(tilePass);

        var linkbar =
            '<div class="sh-linkbar">' + S().icon('check', 18) + '<div>' +
                '이 화면은 <b>인원수·수검률·결과보고서 증빙</b>만 관리합니다 — 개인별 검진 결과는 담지 않습니다(개인정보 최소수집). ' +
                '완료 결과·증빙은 <b>안전보건관리책임자 평가</b>의 「종사자의 건강진단 등 건강관리」 항목에 <b>집계 지표로 자동 연계</b>됩니다. ' +
                '<a href="evl-eval.html">인력 평가로 이동 →</a></div>' +
            '</div>';

        var thead = '<th>대상 부서</th><th>검진 유형</th><th>위탁 검진기관</th><th>예정일 · 실시일</th>' +
            '<th class="num">대상 인원</th><th class="num">수검률</th><th>결과보고서</th><th>사후관리</th><th>완료 상태</th><th>담당자</th>';
        var rows = list.length ? list.map(rowSimple).join('') :
            '<tr><td colspan="10" class="sh-empty">조건에 맞는 건강검진 건이 없습니다.</td></tr>';

        state.mount.innerHTML = linkbar + tiles(sum) + toolbarHtml() + roNote() +
            '<div class="sh-wrap"><table class="sh-table"><thead><tr>' + thead + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    /* 공통 셀 조각 */
    function eviCell(r) {
        return r.evidence
            ? '<span class="sh-attached">' + S().icon('file') + '첨부됨</span>'
            : (canAct(r.dept)
                ? '<button type="button" class="sh-pill-link" onclick="event.stopPropagation();HEX.attach(\'' + r.id + '\')">＋ 첨부</button>'
                : '<span class="sh-pill-none">미첨부</span>');
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
        var rate = r.targetCount ? Math.round(r.examinedCount / r.targetCount * 100) : 0;
        return '<tr onclick="HEX.detail(\'' + r.id + '\')">' + baseCells(r) +
            '<td class="num">' + r.targetCount + '</td>' +
            '<td class="num">' + rate + '%</td>' +
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

    /* 목록 인라인 증빙 첨부 — 상세 진입 없이 실시확인서·집계 결과표 등록 */
    function attach(id) {
        if (!canAct()) { V().toast(denyNote('증빙 첨부')); return; }
        var r = S().healthOf(id); if (!r) return;
        V().openModal('실시 증빙 등록',
            '<p style="font-size:13px;margin-bottom:10px;color:var(--text-gray);"><b>' + esc(r.dept) + ' · ' + esc(r.type) + '</b> 검진기관 실시확인서·집계 결과표를 첨부합니다. 개인별 결과지는 첨부하지 않습니다.</p>' +
            V().uploadDrop('파일을 끌어다 놓거나 클릭하여 업로드<br><span style="font-size:12px;">업로드 시 이력이 자동 기록됩니다</span>', null, { hint: true }),
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="HEX.saveAttach(\'' + id + '\')">등록</button>');
    }
    function saveAttach(id) {
        if (!canAct()) { V().toast(denyNote('증빙 첨부')); return; } S().attachEvidence('hc', id, '실시 증빙'); V().closeModal(); render(); V().toast('증빙이 등록되었습니다.'); }

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
                '<input type="date" class="form-input" id="he-n-planned" value="2026-09-15"></div>' +
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
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        var q = new URLSearchParams(location.search);
        if (q.get('dept')) state.dept = q.get('dept');
        if (q.get('year')) state.year = q.get('year');
        render();
    }

    global.HEX = { init: init,
        setYear: setYear, setType: setType, setDept: setDept, setTile: setTile,
        detail: detail, attach: attach, saveAttach: saveAttach,
        openNew: openNew, saveNew: saveNew, onTypeChange: onTypeChange, pickDept: pickDept };
})(window);
