/* =====================================================================
   health-exam.js · 건강검진 목록 (HEX01-L)
   · 상단 필터(기준연도·검진 유형·부서) · 요약 카드(클릭=상태 필터)
   · 개인정보 보호: 목록은 인원수·이행현황만 · 개인별 상세는 상세화면 권한 열람
   · 완료 결과는 인력평가 「종사자의 건강진단 등 건강관리」 항목에 자동 연계
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var S = function () { return global.DYSH; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }

    var state = { mount: null, year: '2026', type: '', dept: '', tile: 'all' };

    function ownerName(o) { return (o || '').split('·').pop().trim(); }

    function baseRows() {
        return S().health().filter(function (r) {
            return (!state.year || String(r.year) === state.year)
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

    /* 관리 버전 탭(메뉴 상단) — 단순 첨부형(지자체 권장) / 상세 관리형 */
    function vbar() {
        var v = S().healthView();
        function tab(key, label, rec) {
            return '<button type="button" class="sh-vtab' + (v === key ? ' is-active' : '') + '" role="tab" aria-selected="' + (v === key ? 'true' : 'false') + '" onclick="HEX.setView(\'' + key + '\')">' + label + (rec ? ' <span class="rec">권장</span>' : '') + '</button>';
        }
        var note = v === 'simple'
            ? '<span class="sh-vnote"><b>단순 첨부형</b> — 계획·인원수·수검률·<b>결과보고서 첨부</b> 중심(개인정보 최소수집·지자체 권장). 개인별 상세는 관리하지 않습니다.</span>'
            : v === 'detail'
                ? '<span class="sh-vnote"><b>상세 관리형</b> — 개인별 수검 현황(권한 열람)·사후관리 계획/실적까지 관리(보건인력 배치 사업장용).</span>'
                : '<span class="sh-vnote"><b>절차 진행형</b> — <b>대상자 선정 → 문진표 발송 → 결과 업로드 → 새올 알림</b> 4단계 절차로 진행·추적합니다.</span>';
        return '<div class="sh-vbar"><div class="sh-vtabs" role="tablist" aria-label="건강검진 관리 버전">' +
            tab('simple', '단순 첨부형', true) + tab('detail', '상세 관리형', false) + tab('proc', '절차 진행형', false) + '</div>' + note + '</div>';
    }

    function toolbarHtml() {
        var deptOpts = ['<option value="">부서 전체</option>'].concat(
            uniq(S().health().map(function (r) { return r.dept; })).map(function (d) {
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
            '<button type="button" class="btn btn-primary" onclick="HEX.openNew()">＋ 검진 계획 등록</button></div>';
    }

    function render() {
        if (!state.mount) return;
        var v = S().healthView();
        if (v === 'proc') { renderProcList(); return; }
        var base = baseRows();
        var sum = S().healthSummary(base);
        var list = base.filter(tilePass);

        var linkbar =
            '<div class="sh-linkbar">' + S().icon('check', 18) + '<div>' +
                (v === 'simple'
                    ? '이 버전은 <b>인원수·수검률·결과보고서 증빙</b>만 관리합니다(개인정보 최소수집). '
                    : '목록에는 <b>인원수·이행현황</b>만 표시되며, 개인별 수검 상세는 <b>보건담당 권한</b> 사용자만 상세화면에서 열람합니다(개인정보 보호). ') +
                '완료 결과·증빙은 <b>안전보건관리책임자 평가</b>의 「종사자의 건강진단 등 건강관리」 항목에 <b>집계 지표로 자동 연계</b>됩니다. ' +
                '<a href="evl-eval.html">인력 평가로 이동 →</a></div>' +
            '</div>';

        var thead, cols, rowFn;
        if (v === 'simple') {
            thead = '<th>대상 부서</th><th>검진 유형</th><th>위탁 검진기관</th><th>예정일 · 실시일</th>' +
                '<th class="num">대상 인원</th><th class="num">수검률</th><th>결과보고서</th><th>사후관리</th><th>완료 상태</th><th>담당자</th>';
            cols = 10; rowFn = rowSimple;
        } else {
            thead = '<th>대상 부서</th><th>검진 유형</th><th>위탁 검진기관</th><th>예정일 · 실시일</th>' +
                '<th class="num">대상자</th><th class="num">수검자</th><th class="num">미검진</th>' +
                '<th>실시 증빙</th><th>사후조치</th><th>완료 상태</th><th>담당자</th>';
            cols = 11; rowFn = rowDetail;
        }
        var rows = list.length ? list.map(rowFn).join('') :
            '<tr><td colspan="' + cols + '" class="sh-empty">조건에 맞는 건강검진 건이 없습니다.</td></tr>';

        state.mount.innerHTML = vbar() + linkbar + tiles(sum) + toolbarHtml() +
            '<div class="sh-wrap"><table class="sh-table"><thead><tr>' + thead + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    /* ══════════ 절차 진행형 — 관점(주관부서↔담당부서) 목록 ══════════ */
    function perspBar() {
        var role = S().procRole();
        function ptab(key, label) {
            return '<button type="button" class="sh-ptab' + (role === key ? ' is-active' : '') + '" role="tab" aria-selected="' + (role === key ? 'true' : 'false') + '" onclick="HEX.setPersp(\'' + key + '\')">' + label + '</button>';
        }
        var deptSel = '';
        if (role === 'dept') {
            var cur = S().procDept();
            var opts = S().inboxDepts().map(function (d) {
                var s = S().deptInboxSummary(d);
                return '<option value="' + esc(d) + '"' + (d === cur ? ' selected' : '') + '>' + esc(d) + ' (대기 ' + s.pending + '·완료 ' + s.done + ')</option>';
            }).join('');
            deptSel = '<span class="sh-fl">담당부서</span><select class="form-select" aria-label="담당부서 선택" onchange="HEX.setPerspDept(this.value)">' + (opts || '<option>요청된 부서 없음</option>') + '</select>';
        }
        var note = role === 'admin'
            ? '<b>주관부서(재난안전과)</b> — 대상자 선정·문진표 발송·알림을 진행하고 부서별 제출 현황을 관리합니다.'
            : '<b>담당부서</b> — 우리 부서에 요청된 검진의 <b>결과 문서를 제출(업로드)</b>합니다.';
        return '<div class="sh-persp"><div class="sh-persp-tabs" role="tablist" aria-label="관점 전환">' +
            ptab('admin', '주관부서 (재난안전과)') + ptab('dept', '담당부서 (결과 제출)') + '</div>' +
            deptSel + '<span class="sh-persp-note">' + note + '</span></div>';
    }
    function procLinkbar(role) {
        return '<div class="sh-linkbar">' + S().icon('check', 18) + '<div>' +
            (role === 'dept'
                ? '재난안전과가 요청한 검진의 <b>결과 문서를 첨부파일로 제출</b>합니다. 제출 시 <b>재난안전과에 자동 통보</b>되고, 완료 지표가 <b>안전보건관리책임자 평가</b>에 반영됩니다. '
                : '<b>대상자 선정 → 문진표 발송 → (담당부서 결과 제출) → 알림 발송</b> 순으로 진행합니다. 결과 문서는 담당부서가 제출하며, 필요 시 <b>대행 업로드</b>도 가능합니다. ') +
            '<a href="evl-eval.html">인력 평가로 이동 →</a></div></div>';
    }
    function renderProcList() {
        var role = S().procRole();
        if (role === 'dept') {
            var dept = S().procDept();
            if (dept) S().setProcDept(dept);   // 선택 부서 고정(제출 후 다른 부서로 점프 방지)
            var rows = dept ? S().deptInbox(dept) : [];
            var sum = S().deptInboxSummary(dept);
            var theadD = '<th>검진 유형</th><th>위탁 검진기관</th><th>결과 제출 요청일</th><th>결과 문서</th><th>제출 상태</th><th>관리</th>';
            var bodyD = rows.length ? rows.map(rowDeptInbox).join('') :
                '<tr><td colspan="6" class="sh-empty">' + (dept ? esc(dept) + '에 요청된 검진 결과 제출 건이 없습니다.' : '결과 제출이 요청된 부서가 없습니다.') + '</td></tr>';
            /* 담당부서 관점은 관리버전 탭(vbar) 미노출 — 결과 제출에만 집중(관점 바로 주관부서 복귀) */
            state.mount.innerHTML = perspBar() + procLinkbar('dept') + deptTiles(sum) +
                '<div class="sh-wrap"><table class="sh-table"><thead><tr>' + theadD + '</tr></thead><tbody>' + bodyD + '</tbody></table></div>';
            return;
        }
        /* 주관부서 관점 — 전체 절차 진행 목록 */
        var base = baseRows();
        var theadA = '<th>대상 부서</th><th>검진 유형</th><th>위탁 검진기관</th><th>진행 단계</th><th class="num">대상자</th><th>결과 제출</th><th>담당자</th>';
        var bodyA = base.length ? base.map(rowProc).join('') :
            '<tr><td colspan="7" class="sh-empty">조건에 맞는 건강검진 건이 없습니다.</td></tr>';
        state.mount.innerHTML = vbar() + perspBar() + procLinkbar('admin') + procTiles(base) + toolbarHtml() +
            '<div class="sh-wrap"><table class="sh-table"><thead><tr>' + theadA + '</tr></thead><tbody>' + bodyA + '</tbody></table></div>';
    }

    /* 진행단계 미니 표시 */
    function stepBar(r) {
        var n = S().procStep(r), labels = S().PROC_STEPS;
        return '<div class="sh-stepmini" title="' + (n) + '/4 단계 완료">' + labels.map(function (lbl, i) {
            var done = i < n, cur = i === n;
            return (i ? '<span class="sh-stepline' + (done ? ' on' : '') + '"></span>' : '') +
                '<span class="sh-stepdot' + (done ? ' done' : (cur ? ' cur' : '')) + '">' + (done ? '✓' : (i + 1)) + '</span>';
        }).join('') + '</div>';
    }
    function submitCell(r) {
        if (r.resultBy) return '<span class="sh-res ok">제출 완료</span> <span style="font-size:11px;color:var(--text-gray)">' + esc(r.resultBy) + '</span>';
        if (r.proc && r.proc.qSent) return '<span class="sh-res warn">제출 대기</span>';
        return '<span class="sh-res none">요청 전</span>';
    }
    /* 주관부서 관점 행 — 진행단계·대상자·결과제출 주체 */
    function rowProc(r) {
        var tCount = (r.proc && r.proc.targets) ? r.proc.targets.length : 0;
        return '<tr onclick="HEX.detail(\'' + r.id + '\')">' +
            '<td><a class="sh-rowlink" href="health-exam-detail.html?id=' + r.id + '" onclick="event.stopPropagation()">' + esc(r.dept) + '</a></td>' +
            '<td>' + typeTag(r.type) + '</td>' +
            '<td>' + esc(r.agency) + '</td>' +
            '<td>' + stepBar(r) + '</td>' +
            '<td class="num">' + (tCount ? tCount + '명' : '<span style="color:var(--text-lightgray)">미선정</span>') + '</td>' +
            '<td>' + submitCell(r) + '</td>' +
            '<td>' + esc(ownerName(r.owner)) + '</td></tr>';
    }
    /* 담당부서 관점 행 — 결과 제출함 */
    function rowDeptInbox(r) {
        var reqAt = (r.proc && r.proc.qSentAt) ? r.proc.qSentAt : '-';
        var submitted = !!r.resultBy;
        var fileCell = submitted ? '<span class="sh-attached">' + S().icon('file') + '검진결과.pdf</span>' : '<span style="color:var(--text-lightgray)">미제출</span>';
        var stat = submitted ? '<span class="sh-res ok">제출 완료</span>' : '<span class="sh-res warn">제출 대기</span>';
        var action = submitted
            ? '<button type="button" class="sh-pill-link" onclick="event.stopPropagation();HEX.detail(\'' + r.id + '\')">보기</button>'
            : '<button type="button" class="btn btn-primary btn-sm" onclick="event.stopPropagation();HEX.deptUpload(\'' + r.id + '\')">＋ 결과 업로드</button>';
        return '<tr onclick="HEX.detail(\'' + r.id + '\')">' +
            '<td>' + typeTag(r.type) + '</td>' +
            '<td>' + esc(r.agency) + '</td>' +
            '<td>' + esc(reqAt) + '</td>' +
            '<td>' + fileCell + '</td>' +
            '<td>' + stat + '</td>' +
            '<td>' + action + '</td></tr>';
    }
    function procTiles(rows) {
        var c = [0, 0, 0, 0, 0];   // [전체, ≥1, ≥2, ≥3, ≥4]
        rows.forEach(function (r) { var n = S().procStep(r); c[0]++; for (var k = 1; k <= 4; k++) if (n >= k) c[k]++; });
        var defs = [
            { label: '전체', val: c[0], tone: 'info' },
            { label: '대상자 선정', val: c[1], tone: 'neutral' },
            { label: '문진표 발송', val: c[2], tone: 'neutral' },
            { label: '결과 제출', val: c[3], tone: 'warning' },
            { label: '알림 완료', val: c[4], tone: 'success' }
        ];
        return '<div class="sh-sum">' + defs.map(function (d) {
            return '<div class="sh-tile is-kpi tone-' + d.tone + '">' +
                '<span class="sh-tile-label"><span class="sh-tile-dot"></span>' + d.label + '</span>' +
                '<span class="sh-tile-value">' + d.val + '<span class="unit">건</span></span></div>';
        }).join('') + '</div>';
    }
    function deptTiles(sum) {
        var defs = [
            { label: '요청 전체', val: sum.total, tone: 'info' },
            { label: '제출 대기', val: sum.pending, tone: 'warning' },
            { label: '제출 완료', val: sum.done, tone: 'success' }
        ];
        return '<div class="sh-sum">' + defs.map(function (d) {
            return '<div class="sh-tile is-kpi tone-' + d.tone + '">' +
                '<span class="sh-tile-label"><span class="sh-tile-dot"></span>' + d.label + '</span>' +
                '<span class="sh-tile-value">' + d.val + '<span class="unit">건</span></span></div>';
        }).join('') + '</div>';
    }

    /* 공통 셀 조각 */
    function eviCell(r) {
        return r.evidence
            ? '<span class="sh-attached">' + S().icon('file') + '첨부됨</span>'
            : '<button type="button" class="sh-pill-link" onclick="event.stopPropagation();HEX.attach(\'' + r.id + '\')">＋ 첨부</button>';
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
            '<td>' + esc(r.planned) + ' <span style="color:var(--text-lightgray)">/</span> ' + doneTxt + '</td>';
    }

    /* 단순 첨부형 행 — 대상 인원·수검률(집계)·결과보고서 첨부 중심 */
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

    /* 상세 관리형 행 — 대상자/수검자/미검진 인원 분해 */
    function rowDetail(r) {
        var unex = S().hcUnexamined(r);
        return '<tr onclick="HEX.detail(\'' + r.id + '\')">' + baseCells(r) +
            '<td class="num">' + r.targetCount + '</td>' +
            '<td class="num">' + r.examinedCount + '</td>' +
            '<td class="num"' + (unex > 0 ? ' style="color:var(--status-danger-fg);font-weight:700;"' : '') + '>' + unex + '</td>' +
            '<td>' + eviCell(r) + '</td>' +
            '<td>' + followupCell(r) + '</td>' +
            '<td>' + stChip(r) + '</td>' +
            '<td>' + esc(ownerName(r.owner)) + '</td></tr>';
    }

    function setView(v) { S().setHealthView(v); render(); }
    function setPersp(role) { S().setProcRole(role); render(); }
    function setPerspDept(dept) { S().setProcDept(dept); render(); }

    function yearOpt(y) { return '<option value="' + y + '"' + (state.year === y ? ' selected' : '') + '>' + y + '년</option>'; }
    function uniq(a) { var s = {}, o = []; a.forEach(function (x) { if (!s[x]) { s[x] = 1; o.push(x); } }); return o; }

    function setYear(v) { state.year = v; render(); }
    function setType(v) { state.type = v; render(); }
    function setDept(v) { state.dept = v; render(); }
    function setTile(v) { state.tile = (state.tile === v ? 'all' : v); render(); }
    function detail(id) { location.href = 'health-exam-detail.html?id=' + id; }

    /* 목록 인라인 증빙 첨부 — 상세 진입 없이 실시확인서 등록(개인별 결과는 상세 권한 열람) */
    function attach(id) {
        var r = S().healthOf(id); if (!r) return;
        V().openModal('실시 증빙 등록',
            '<p style="font-size:13px;margin-bottom:10px;color:var(--text-gray);"><b>' + esc(r.dept) + ' · ' + esc(r.type) + '</b> 검진기관 실시확인서·집계 결과를 첨부합니다. (개인별 결과는 상세 권한 열람)</p>' +
            V().uploadDrop('파일을 끌어다 놓거나 클릭하여 업로드<br><span style="font-size:12px;">업로드 시 이력이 자동 기록됩니다</span>', null, { hint: true }),
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="HEX.saveAttach(\'' + id + '\')">등록</button>');
    }
    function saveAttach(id) { S().attachEvidence('hc', id, '실시 증빙'); V().closeModal(); render(); V().toast('증빙이 등록되었습니다.'); }

    /* 담당부서 관점 — 결과 문서 제출(목록 인라인) */
    function deptUpload(id) {
        var r = S().healthOf(id); if (!r) return;
        V().openModal('검진 결과 문서 제출',
            '<p style="font-size:13px;margin-bottom:10px;color:var(--text-gray);"><b>' + esc(r.dept) + ' · ' + esc(r.type) + '</b> 검진기관에서 받은 결과 문서를 제출합니다. 제출 시 <b>재난안전과</b>에 자동 통보됩니다.</p>' +
            V().uploadDrop('파일을 끌어다 놓거나 클릭하여 업로드<br><span style="font-size:12px;">업로드 시 이력이 자동 기록됩니다</span>', null, { hint: true }),
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="HEX.saveDeptUpload(\'' + id + '\')">제출</button>');
    }
    function saveDeptUpload(id) {
        var r = S().healthOf(id);
        S().submitResult(id, '담당부서', r ? r.dept : '담당부서');
        V().closeModal(); render(); V().toast('결과 문서를 제출했습니다. 재난안전과에 통보됩니다.');
    }

    function openNew() {
        V().openModal('건강검진 계획 등록',
            /* 대상 부서 — 조직도(DYV2.ORG) 인라인 트리에서 선택 */
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="he-n-deptname">대상 부서 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<div class="orgpick-field" id="he-n-deptfield"><div style="display:flex;gap:8px;">' +
                    '<input type="text" class="form-input" id="he-n-deptname" readonly placeholder="조직도에서 부서 선택" style="flex:1;" value="' + esc(state.dept || '') + '">' +
                    '<button type="button" class="btn btn-outline" onclick="ORGPICK.toggle(\'he-n-deptfield\',\'dept\',\'HEX.pickDept\')">조직도</button>' +
                '</div></div></div>' +
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="he-n-type">검진 유형</label>' +
                '<select class="form-select" id="he-n-type"><option>일반건강검진</option><option>특수건강진단</option></select></div>' +
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="he-n-agency">위탁 검진기관 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="text" class="form-input" id="he-n-agency" placeholder="예: 담양군보건소 / (주)녹십자헬스케어"></div>' +
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="he-n-target">대상자 수</label>' +
                '<input type="number" class="form-input" id="he-n-target" value="10" min="1"></div>' +
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="he-n-planned">검진 예정일</label>' +
                '<input type="date" class="form-input" id="he-n-planned" value="2026-09-15"></div>' +
            '<div class="ri-modal-row"><label><input type="checkbox" id="he-n-carc"> 발암성·특별관리물질 취급 (결과 30년 보존)</label></div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="HEX.saveNew()">등록</button>');
    }
    function pickDept(name) { var inp = document.getElementById('he-n-deptname'); if (inp) inp.value = name; }
    function saveNew() {
        var dept = (document.getElementById('he-n-deptname').value || '').trim();
        var agency = (document.getElementById('he-n-agency').value || '').trim();
        if (!dept) { V().toast('대상 부서를 선택하세요.'); return; }
        if (!agency) { V().toast('검진기관을 입력하세요.'); return; }
        S().addHealth({
            dept: dept,
            type: document.getElementById('he-n-type').value,
            agency: agency,
            targetCount: Number(document.getElementById('he-n-target').value) || 0,
            planned: document.getElementById('he-n-planned').value,
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

    global.HEX = { init: init, setView: setView, setPersp: setPersp, setPerspDept: setPerspDept,
        setYear: setYear, setType: setType, setDept: setDept, setTile: setTile,
        detail: detail, attach: attach, saveAttach: saveAttach, deptUpload: deptUpload, saveDeptUpload: saveDeptUpload,
        openNew: openNew, saveNew: saveNew, pickDept: pickDept };
})(window);
