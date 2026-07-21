/* =====================================================================
   work-env.js · 작업환경측정 목록 (WEM01-L)
   · 상단 필터(기준연도·반기·부서) · 요약 카드(클릭=상태 필터)
   · 목록 → work-env-detail · 완료 결과는 인력평가 항목에 자동 연계
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var S = function () { return global.DYSH; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }

    var state = { mount: null, year: '2026', half: '', dept: '', tile: 'all' };

    function ownerName(o) { return (o || '').split('·').pop().trim(); }

    /* 필터 적용 (요약 카드는 tile 제외 집계에 쓰므로 base/list 분리) */
    function baseRows() {
        return S().workEnv().filter(function (r) {
            return (!state.year || String(r.year) === state.year)
                && (!state.half || r.half === state.half)
                && (!state.dept || r.dept === state.dept);
        });
    }
    function tilePass(r) {
        switch (state.tile) {
            case 'measured':   return S().weMeasured(r);
            case 'unmeasured': return !S().weMeasured(r);
            case 'improve':    return S().weNeedsImprove(r);
            case 'overdue':    return S().effWorkEnv(r).key === 'OVERDUE';
            default:           return true;
        }
    }

    function stChip(r) { var st = S().effWorkEnv(r); return '<span class="sh-st ' + st.tone + '">' + esc(st.label) + '</span>'; }
    function resBadge(r) {
        if (!r.result) return '<span class="sh-res none">미측정</span>';
        return r.result === '적정' ? '<span class="sh-res ok">적정</span>' : '<span class="sh-res warn">개선 필요</span>';
    }
    function dueCell(r) {
        if (r.result !== '개선 필요' || r.improveDone) return '<span style="color:var(--text-lightgray)">—</span>';
        var dl = S().daysLeft(r.improveDue);
        var cls = dl == null ? '' : (dl < 0 ? 'over' : (dl <= 14 ? 'soon' : ''));
        var tag = dl == null ? '' : (dl < 0 ? ' (' + (-dl) + '일 초과)' : (dl <= 14 ? ' (D-' + dl + ')' : ''));
        return '<span class="sh-due ' + cls + '">' + esc(r.improveDue || '-') + tag + '</span>';
    }

    function tiles(sum) {
        var defs = [
            { k: 'all',        label: '전체 대상',  val: sum.total,     tone: 'info' },
            { k: 'measured',   label: '측정 완료',  val: sum.measured,  tone: 'success' },
            { k: 'unmeasured', label: '미실시',     val: sum.unmeasured, tone: 'neutral' },
            { k: 'improve',    label: '개선 필요',  val: sum.improve,   tone: 'warning' },
            { k: 'overdue',    label: '기한 초과',  val: sum.overdue,   tone: 'danger' }
        ];
        return '<div class="sh-sum" role="group" aria-label="상태별 필터">' + defs.map(function (d) {
            var on = state.tile === d.k;
            return '<button type="button" class="sh-tile tone-' + d.tone + (on ? ' is-active' : '') +
                '" aria-pressed="' + (on ? 'true' : 'false') + '" title="클릭하여 목록 필터"' +
                ' onclick="WENV.setTile(\'' + d.k + '\')">' +
                '<span class="sh-tile-label"><span class="sh-tile-dot"></span>' + d.label + '</span>' +
                '<span class="sh-tile-value">' + d.val + '<span class="unit">건</span></span></button>';
        }).join('') + '</div>';
    }

    function render() {
        if (!state.mount) return;
        var base = baseRows();
        var sum = S().workEnvSummary(base);
        var list = base.filter(tilePass);
        var deptOpts = ['<option value="">부서 전체</option>'].concat(
            uniq(S().workEnv().map(function (r) { return r.dept; })).map(function (d) {
                return '<option value="' + esc(d) + '"' + (state.dept === d ? ' selected' : '') + '>' + esc(d) + '</option>';
            })).join('');

        var linkbar =
            '<div class="sh-linkbar">' +
                S().icon('check', 18) +
                '<div>완료된 측정 결과와 증빙은 <b>안전보건관리책임자 평가</b>의 「작업환경측정 등 작업환경의 점검 및 개선」 항목에 <b>자동 연계</b>됩니다. ' +
                '개선 필요 결과는 <b>개선조치 기한</b> 내 조치·재측정으로 관리하세요. ' +
                '이행 증빙은 경영책임자(담양군수 · 중처법 §2 9호 나목)의 안전보건 확보의무 이행 자료입니다. ' +
                '<a href="evl-eval.html">인력 평가로 이동 →</a></div>' +
            '</div>';

        var toolbar =
            '<div class="sh-toolbar"><div class="sh-filters">' +
                '<span class="sh-fl" id="wf-year">기준연도</span>' +
                '<select class="form-select" aria-label="기준연도" onchange="WENV.setYear(this.value)">' +
                    yearOpt('2026') + yearOpt('2025') +
                '</select>' +
                '<span class="sh-fl">반기</span>' +
                '<select class="form-select" aria-label="반기" onchange="WENV.setHalf(this.value)">' +
                    '<option value="">전체</option>' +
                    '<option value="H1"' + (state.half === 'H1' ? ' selected' : '') + '>상반기</option>' +
                    '<option value="H2"' + (state.half === 'H2' ? ' selected' : '') + '>하반기</option>' +
                '</select>' +
                '<span class="sh-fl">부서</span>' +
                '<select class="form-select" aria-label="부서" onchange="WENV.setDept(this.value)">' + deptOpts + '</select>' +
            '</div>' +
            '<button type="button" class="btn btn-primary" onclick="WENV.openNew()">＋ 측정 계획 등록</button></div>';

        var rows = list.length ? list.map(rowHtml).join('') :
            '<tr><td colspan="9" class="sh-empty">조건에 맞는 작업환경측정 건이 없습니다.</td></tr>';

        state.mount.innerHTML = linkbar + tiles(sum) + toolbar +
            '<div class="sh-wrap"><table class="sh-table"><thead><tr>' +
                '<th>대상 부서 / 사업장</th><th>측정 대상</th><th>위탁업체</th><th>측정 예정일 · 실시일</th>' +
                '<th>결과보고서</th><th>측정 결과</th><th>개선조치 기한</th><th>완료 여부</th><th>담당자</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    function rowHtml(r) {
        // 목록에서 바로 증빙 첨부 → 상세 왕복 제거(고빈도 액션). 첨부 완료 시 상태 표시.
        var report = r.report
            ? '<span class="sh-attached">' + S().icon('file') + '첨부됨</span>'
            : '<button type="button" class="sh-pill-link" onclick="event.stopPropagation();WENV.attach(\'' + r.id + '\')">＋ 첨부</button>';
        var doneTxt = r.done ? esc(r.done) : '<span style="color:var(--text-gray)">미실시</span>';
        return '<tr onclick="WENV.detail(\'' + r.id + '\')">' +
            '<td><a class="sh-rowlink" href="work-env-detail.html?id=' + r.id + '" onclick="event.stopPropagation()">' + esc(r.dept) + '</a><div class="sh-cellsub">' + esc(r.site) + '</div></td>' +
            '<td>' + esc(r.subject) + '</td>' +
            '<td>' + esc(r.vendor) + '</td>' +
            '<td>' + esc(r.planned) + ' <span style="color:var(--text-lightgray)">/</span> ' + doneTxt + '</td>' +
            '<td>' + report + '</td>' +
            '<td>' + resBadge(r) + '</td>' +
            '<td>' + dueCell(r) + '</td>' +
            '<td>' + stChip(r) + '</td>' +
            '<td>' + esc(ownerName(r.owner)) + '</td></tr>';
    }

    function yearOpt(y) { return '<option value="' + y + '"' + (state.year === y ? ' selected' : '') + '>' + y + '년</option>'; }
    function uniq(a) { var s = {}, o = []; a.forEach(function (x) { if (!s[x]) { s[x] = 1; o.push(x); } }); return o; }

    function setYear(v) { state.year = v; render(); }
    function setHalf(v) { state.half = v; render(); }
    function setDept(v) { state.dept = v; render(); }
    function setTile(v) { state.tile = (state.tile === v ? 'all' : v); render(); }
    function detail(id) { location.href = 'work-env-detail.html?id=' + id; }

    /* 목록 인라인 증빙 첨부 — 상세 진입 없이 결과보고서 등록 */
    function attach(id) {
        var r = S().workEnvOf(id); if (!r) return;
        V().openModal('결과보고서 · 증빙 등록',
            '<p style="font-size:13px;margin-bottom:10px;color:var(--text-gray);"><b>' + esc(r.dept) + ' · ' + esc(r.site) + '</b> 작업환경측정 결과보고서를 첨부합니다.</p>' +
            V().uploadDrop('파일을 끌어다 놓거나 클릭하여 업로드<br><span style="font-size:12px;">업로드 시 이력이 자동 기록됩니다</span>', null, { hint: true }),
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="WENV.saveAttach(\'' + id + '\')">등록</button>');
    }
    function saveAttach(id) { S().attachEvidence('we', id, '결과보고서'); V().closeModal(); render(); V().toast('증빙이 등록되었습니다.'); }

    function openNew() {
        V().openModal('작업환경측정 계획 등록',
            /* 대상 부서 — 조직도(DYV2.ORG) 인라인 트리에서 선택(단일 모달 규칙: 별도 모달 없이 입력 아래 펼침) */
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="we-n-deptname">대상 부서 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<div class="orgpick-field" id="we-n-deptfield"><div style="display:flex;gap:8px;">' +
                    '<input type="text" class="form-input" id="we-n-deptname" readonly placeholder="조직도에서 부서 선택" style="flex:1;" value="' + esc(state.dept || '') + '">' +
                    '<button type="button" class="btn btn-outline" onclick="ORGPICK.toggle(\'we-n-deptfield\',\'dept\',\'WENV.pickDept\')">조직도</button>' +
                '</div></div></div>' +
            /* 사업장 — 사업장 마스터(시스템 관리)에서 부서별로 등록된 사업장 드롭다운 */
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="we-n-site">사업장 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<select class="form-select" id="we-n-site" onchange="WENV.onSiteChange()"><option value="">부서를 먼저 선택하세요</option></select>' +
                '<div style="font-size:11px;color:var(--text-lightgray);margin-top:3px;">사업장 목록은 <b>시스템 관리 &gt; 사업장 관리</b>에서 관리합니다.</div></div>' +
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="we-n-subject">측정 대상(유해인자) <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="text" class="form-input" id="we-n-subject" placeholder="예: 소음·분진·유기용제 등 (사업장 선택 시 자동 채움)"></div>' +
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="we-n-vendor">위탁업체</label>' +
                '<input type="text" class="form-input" id="we-n-vendor" placeholder="예: (주)한국산업보건환경연구원"></div>' +
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="we-n-planned">측정 예정일</label>' +
                '<input type="date" class="form-input" id="we-n-planned" value="2026-09-15"></div>' +
            '<div class="ri-modal-row"><label><input type="checkbox" id="we-n-carc"> 발암성·특별관리물질 취급 (결과 30년 보존)</label></div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="WENV.saveNew()">등록</button>');
        if (state.dept) updateSiteOptions(state.dept);   // 목록에서 부서 필터가 걸려 있으면 사업장도 채움
    }
    /* 부서 선택(공용 ORGPICK)에서 호출 — 부서명 세팅 + 사업장 드롭다운 갱신 */
    function pickDept(name) {
        var inp = document.getElementById('we-n-deptname'); if (inp) inp.value = name;
        updateSiteOptions(name);
    }
    function updateSiteOptions(dept) {
        var sel = document.getElementById('we-n-site'); if (!sel) return;
        var list = global.DYSITE ? DYSITE.sitesByDept(dept) : [];
        if (!list.length) {
            sel.innerHTML = '<option value="">등록된 사업장 없음 — 시스템 관리 &gt; 사업장 관리에서 등록</option>';
        } else {
            sel.innerHTML = '<option value="">-- 사업장 선택 --</option>' + list.map(function (s) {
                return '<option value="' + esc(s.name) + '" data-haz="' + esc(s.hazards || '') + '">' + esc(s.name) + ' (' + esc(s.type) + ')</option>';
            }).join('');
        }
    }
    function onSiteChange() {
        var sel = document.getElementById('we-n-site'); if (!sel) return;
        var opt = sel.options[sel.selectedIndex];
        var haz = opt ? opt.getAttribute('data-haz') : '';
        var subj = document.getElementById('we-n-subject');
        if (subj && haz && !subj.value.trim()) subj.value = haz;   // 유해인자 자동 채움(비어있을 때만)
    }
    function saveNew() {
        var dept = (document.getElementById('we-n-deptname').value || '').trim();
        var site = document.getElementById('we-n-site').value || '';
        var subject = (document.getElementById('we-n-subject').value || '').trim();
        if (!dept) { V().toast('대상 부서를 선택하세요.'); return; }
        if (!site) { V().toast('사업장을 선택하세요.'); return; }
        if (!subject) { V().toast('측정 대상을 입력하세요.'); return; }
        S().addWorkEnv({
            dept: dept,
            site: site,
            subject: subject,
            vendor: (document.getElementById('we-n-vendor').value || '').trim(),
            planned: document.getElementById('we-n-planned').value,
            carcinogen: !!document.getElementById('we-n-carc').checked
        });
        V().closeModal(); render(); V().toast('측정 계획이 등록되었습니다.');
    }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        var q = new URLSearchParams(location.search);
        if (q.get('dept')) state.dept = q.get('dept');
        if (q.get('year')) state.year = q.get('year');
        render();
    }

    global.WENV = { init: init, setYear: setYear, setHalf: setHalf, setDept: setDept, setTile: setTile,
        detail: detail, attach: attach, saveAttach: saveAttach, openNew: openNew, saveNew: saveNew,
        pickDept: pickDept, onSiteChange: onSiteChange };
})(window);
