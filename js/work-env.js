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
    /* ===== 권한 (CLAUDE.md §12) =====
     * 작업환경측정 결과는 그 부서 사업장의 것이다 — 남의 부서 측정 결과를 볼 이유가 없다.
     * 조회 범위는 DYROLE.scope(), 조작(계획 등록·결과 첨부)은 DYROLE.canAct() 단일 출처.
     * 부서를 **이름**으로 저장하는 도메인이라 DYV2.deptIdOf() 로 id 를 얻어 물어본다(§3). */
    function R() { return global.DYROLE; }
    function inScope(r) { return !R() || R().inScope(V().deptIdOf(r.dept)); }
    function canAct(deptName) { return !R() || R().canAct(deptName ? V().deptIdOf(deptName) : ''); }
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
    /* 주관부서 담당자 — 결과 안내 공문(재난안전과 위탁 측정) */
    function canOwner() { return !R() || R().canAct(R().OWNER_DEPT); }
    function halfName(h) { return h === 'H2' ? '하반기' : '상반기'; }
    function roNote() { return R() ? R().readOnlyNote('측정 계획 등록·결과 첨부') : ''; }
    /* 조작 차단 문구 — 조사는 DYV2.josa() 가 붙인다(라벨마다 받침이 갈려 고정 표기를 쓸 수 없다) */
    function denyNote(what) { return what + V().josa(what, '은', '는') + ' 해당 부서 담당자가 수행합니다.'; }

    var state = { mount: null, year: '2026', half: '', dept: '', tile: 'all' };

    function ownerName(o) { return (o || '').split('·').pop().trim(); }

    /* 필터 적용 (요약 카드는 tile 제외 집계에 쓰므로 base/list 분리) */
    function baseRows() {
        return S().workEnv().filter(function (r) {
            return inScope(r)
                && (!state.year || String(r.year) === state.year)
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
        if (r.result !== '개선 필요' || r.improveDone) return '<span style="color:var(--text-gray)">—</span>';
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
            /* 조회 범위 밖 부서는 필터 선택지에도 내지 않는다 — 목록에서 지워 놓고
               드롭다운에 남기면 '있는데 안 보여준다'로 읽힌다(§12). */
            uniq(S().workEnv().filter(inScope).map(function (r) { return r.dept; })).map(function (d) {
                return '<option value="' + esc(d) + '"' + (state.dept === d ? ' selected' : '') + '>' + esc(d) + '</option>';
            })).join('');

        var linkbar =
            '<div class="sh-linkbar">' +
                S().icon('check', 18) +
                /* 운영 T13(2026-11-04) — 연계·법령 설명은 걷고 이 화면에서 할 일만 남긴다 */
                '<div>개선 필요 결과는 <b>개선조치 기한</b> 내 조치·재측정으로 관리하세요.</div>' +
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
            (canAct() ? '<button type="button" class="btn btn-primary" onclick="WENV.openNew()">＋ 측정 계획 등록</button>' : '') + '</div>';

        var rows = list.length ? list.map(rowHtml).join('') :
            '<tr><td colspan="9" class="sh-empty">조건에 맞는 작업환경측정 건이 없습니다.</td></tr>';

        state.mount.innerHTML = linkbar + tiles(sum) + noticeLines() + toolbar + roNote() +
            '<div class="sh-wrap"><table class="sh-table"><thead><tr>' +
                '<th>대상 부서 / 사업장</th><th>측정 대상</th><th>위탁업체</th><th>측정 예정일 · 실시일</th>' +
                '<th>결과보고서</th><th>측정 결과</th><th>개선조치 기한</th><th>완료 여부</th><th>담당자</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    /* 반기별 결과 안내 공문 줄 — 재난안전과 담당자에게만. 결과가 들어온 사업장부터 보낸다
       (반기 전체를 기다리면 노출기준 초과 건의 60일 법정 기한 안에 부서가 알지 못한다).
       무엇이 남았는지는 사업장 이름으로 밝힌다. */
    function noticeLines() {
        if (!canOwner()) return '';
        var halves = state.half ? [state.half] : ['H1', 'H2'];
        var html = halves.map(function (h) {
            var st = S().halfStat(state.year, h);
            if (!st.total && !st.docs.length) return '';
            var key = state.year + '|' + h;
            var docs = st.docs.map(function (d, i) {
                return '<button type="button" class="btn btn-sm btn-outline" onclick="WENVDOC.openDoc(\'' + key + '\',\'' + d.sid + '\')">' +
                    (st.docs.length > 1 ? (i + 1) + '차 ' : '') + '공문 보기 · ' + esc(d.status) + '</button>';
            }).join('');
            var pend = st.pending.map(function (r) { return esc(r.site) + '(' + esc(String(r.planned || '').slice(5)) + ')'; }).join(' · ');
            return '<div class="sh-card" style="display:flex;flex-wrap:wrap;align-items:center;gap:var(--sp-2) var(--sp-3);margin-bottom:var(--stack-tight);">' +
                '<b>' + esc(state.year) + ' ' + halfName(h) + ' 결과 안내</b>' +
                '<span style="color:var(--text-gray);">측정 ' + st.done + ' / ' + st.total + '곳 · 공문 보냄 ' + st.sent + '곳</span>' +
                (st.notice.length
                    ? '<button type="button" class="btn btn-sm btn-primary" onclick="WENVDOC.open(\'' + key + '\')">결과 안내 공문 (' + st.notice.length + '곳)</button>'
                    : '') +
                docs +
                (pend ? '<span class="file-hint" style="flex-basis:100%;">측정 전: ' + pend + ' — 결과가 들어오면 다음 공문으로 보냅니다.</span>' : '') +
            '</div>';
        }).join('');
        return html;
    }

    function rowHtml(r) {
        // 목록에서 바로 증빙 첨부 → 상세 왕복 제거(고빈도 액션). 첨부 완료 시 상태 표시.
        var report = r.report
            ? '<span class="sh-attached">' + S().icon('file') + '첨부됨</span>'
            : (attachable(r)
                ? '<button type="button" class="sh-pill-link" onclick="event.stopPropagation();WENV.attach(\'' + r.id + '\')">＋ 첨부</button>'
                : '<span class="sh-pill-none">미첨부</span>');
        var doneTxt = r.done ? esc(r.done) : '<span style="color:var(--text-gray)">미실시</span>';
        return '<tr onclick="WENV.detail(\'' + r.id + '\')">' +
            '<td><a class="sh-rowlink" href="work-env-detail.html?id=' + r.id + '" onclick="event.stopPropagation()">' + esc(r.dept) + '</a><div class="sh-cellsub">' + esc(r.site) + '</div></td>' +
            '<td>' + esc(r.subject) + '</td>' +
            '<td>' + esc(r.vendor) + '</td>' +
            '<td>' + esc(r.planned) + ' <span style="color:var(--text-gray)">/</span> ' + doneTxt + '</td>' +
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
    /* 측정기관 보고서 한 부가 여러 사업장을 덮는다 — 같은 반기·같은 위탁업체·보고서 없는 행을 함께 고른다 */
    var AT = { id: null, file: null, with: {} };
    function attachable(r) { return r && !r.report && !r.done && canAct(r.dept) && !S().weLockOf(r.id); }
    function siblings(r) {
        return S().workEnv().filter(function (x) {
            return x.id !== r.id && String(x.year) === String(r.year) && x.half === r.half && x.vendor === r.vendor && attachable(x);
        });
    }
    function attach(id) {
        var r = S().workEnvOf(id); if (!r) return;
        if (!canAct(r.dept)) { V().toast(denyNote('결과 첨부')); return; }
        if (!attachable(r)) { V().toast('이 건에는 결과보고서를 올릴 수 없습니다.'); return; }
        AT = { id: id, file: null, with: {} };
        renderAttach();
    }
    function renderAttach() {
        var r = S().workEnvOf(AT.id); if (!r) return;
        var sib = siblings(r);
        V().openModal('결과보고서 등록',
            '<p style="font-size:13px;margin-bottom:10px;color:var(--text-gray);"><b>' + esc(r.dept) + ' · ' + esc(r.site) + '</b> 작업환경측정 결과보고서를 첨부합니다.</p>' +
            (AT.file ? '<p style="margin-bottom:8px;">' + S().icon('file') + ' <b>' + esc(AT.file.name) + '</b></p>' : '') +
            V().uploadDrop('파일을 끌어다 놓거나 클릭하여 업로드', null, { hint: true, pick: 'WENV.onPick' }) +
            (sib.length
                ? '<div style="margin-top:12px;"><label class="form-label">같은 보고서로 함께 등록 <span class="file-hint">' + esc(r.vendor) + ' · ' + halfName(r.half) + '</span></label>' +
                    sib.map(function (x) {
                        return '<label style="display:block;margin:4px 0;"><input type="checkbox"' + (AT.with[x.id] ? ' checked' : '') +
                            ' onchange="WENV.setWith(\'' + x.id + '\', this.checked)"> ' + esc(x.dept) + ' · ' + esc(x.site) + '</label>';
                    }).join('') + '</div>'
                : ''),
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="WENV.saveAttach()">등록</button>');
    }
    function onPick(items) { AT.file = items && items[0] ? { name: items[0].name, size: items[0].size } : null; renderAttach(); }
    function setWith(id, on) { if (on) AT.with[id] = true; else delete AT.with[id]; }
    function saveAttach() {
        var r = S().workEnvOf(AT.id); if (!r) return;
        if (!canAct(r.dept)) { V().toast(denyNote('결과 첨부')); return; }
        if (!AT.file) { V().toast('파일을 고르세요.'); return; }
        var ids = [AT.id].concat(Object.keys(AT.with));
        /* 저장에도 같은 판정 — 고른 뒤 상태가 바뀌었거나 전역 호출로 남의 부서 행이 들어와도 거른다 */
        var done = ids.filter(function (id) {
            var x = S().workEnvOf(id);
            return attachable(x) && !!S().attachEvidence('we', id, '결과보고서', AT.file.name);
        });
        V().closeModal(); render();
        V().toast(done.length ? '결과보고서를 ' + done.length + '곳에 등록했습니다.' : '등록하지 못했습니다.');
    }

    function openNew() {
        if (!canAct()) { V().toast(denyNote('측정 계획 등록')); return; }
        V().openModal('작업환경측정 계획 등록',
            /* 대상 부서 — 조직도(DYV2.ORG) 인라인 트리에서 선택(단일 모달 규칙: 별도 모달 없이 입력 아래 펼침) */
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="we-n-deptname">대상 부서 <span style="color:var(--status-danger-fg)">*</span></label>' +
                deptFieldHtml('we-n-deptfield', 'we-n-deptname', 'WENV.pickDept', canPickDept() ? (state.dept || '') : myDeptName()) + '</div>' +
            /* 사업장 — 사업장 마스터(시스템 관리)에서 부서별로 등록된 사업장 드롭다운 */
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="we-n-site">사업장 <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<select class="form-select" id="we-n-site" onchange="WENV.onSiteChange()"><option value="">부서를 먼저 선택하세요</option></select>' +
                '<div style="font-size:var(--fs-12);color:var(--text-gray);margin-top:3px;">사업장 목록은 <b>시스템 관리 &gt; 사업장 관리</b>에서 관리합니다.</div></div>' +
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="we-n-subject">측정 대상(유해인자) <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<input type="text" class="form-input" id="we-n-subject" placeholder="예: 소음·분진·유기용제 등 (사업장 선택 시 자동 채움)"></div>' +
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="we-n-vendor">위탁업체</label>' +
                '<input type="text" class="form-input" id="we-n-vendor" placeholder="예: (주)한국산업보건환경연구원"></div>' +
            '<div class="ri-modal-row" style="margin-bottom:12px;"><label class="form-label" for="we-n-planned">측정 예정일</label>' +
                '<input type="date" class="form-input" id="we-n-planned" value="' + S().addDays(S().TODAY, 14) + '"></div>' +
            '<div class="ri-modal-row"><label><input type="checkbox" id="we-n-carc"> 고용노동부 고시 30년 보존 대상 물질 기록</label></div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="WENV.saveNew()">등록</button>');
        /* 목록에서 부서 필터가 걸려 있거나 소속 부서로 고정되면 사업장도 채운다 */
        var initDept = canPickDept() ? state.dept : myDeptName();
        if (initDept) updateSiteOptions(initDept);
    }
    /* 부서 선택(공용 ORGPICK)에서 호출 — 부서명 세팅 + 사업장 드롭다운 갱신 */
    function pickDept(name) {
        if (!canAct(name)) { V().toast(denyNote('다른 부서 측정 계획 등록')); return; }
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
                return '<option value="' + esc(s.id) + '" data-haz="' + esc(s.hazards || '') + '" data-target="' + esc(s.targetState || '검토 중') + '">' +
                    esc(s.name) + ' (' + esc(s.type) + ' · ' + esc(s.targetState || '검토 중') + ')</option>';
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
        if (!canAct()) { V().toast(denyNote('측정 계획 등록')); return; }
        var dept = (document.getElementById('we-n-deptname').value || '').trim();
        /* 저장에도 같은 판정 — 화면에서 부서를 고정해도 전역 호출로 다른 부서가 들어올 수 있다 */
        if (dept && !canAct(dept)) { V().toast(denyNote('다른 부서 측정 계획 등록')); return; }
        var siteId = document.getElementById('we-n-site').value || '';
        var siteRec = global.DYSITE && siteId ? DYSITE.siteOf(siteId) : null;
        var subject = (document.getElementById('we-n-subject').value || '').trim();
        var planned = document.getElementById('we-n-planned').value;
        if (!dept) { V().toast('대상 부서를 선택하세요.'); return; }
        if (!siteRec) { V().toast('사업장을 선택하세요.'); return; }
        if (!subject) { V().toast('측정 대상을 입력하세요.'); return; }
        if (!planned) { V().toast('측정 예정일을 선택하세요.'); return; }
        /* 중복 계획 — year 는 숫자로 저장되므로 문자열과 직접 비교하면 영영 안 걸린다.
           (실측: r.year === '2026' 은 0건, String(r.year) === '2026' 은 1건 — 건강검진도 같은 원인이었다) */
        var dup = S().workEnv().filter(function (r) {
            var sameSite = r.siteId ? r.siteId === siteId : (r.dept === dept && r.site === siteRec.name);
            return sameSite && String(r.year) === String(planned).slice(0, 4) && r.half === (Number(String(planned).slice(5, 7)) <= 6 ? 'H1' : 'H2') &&
                String(r.subject || '').trim().replace(/\s+/g, ' ').toLowerCase() === subject.replace(/\s+/g, ' ').toLowerCase();
        })[0];
        if (dup) { V().toast('같은 반기·사업장·유해인자의 측정계획이 이미 있습니다.'); return; }
        S().addWorkEnv({
            dept: dept,
            siteId: siteId,
            site: siteRec.name,
            siteTargetState: siteRec.targetState || '검토 중',
            subject: subject,
            vendor: (document.getElementById('we-n-vendor').value || '').trim(),
            planned: planned,
            carcinogen: !!document.getElementById('we-n-carc').checked
        });
        V().closeModal(); render(); V().toast('측정 계획이 등록되었습니다.');
    }

    /* ===== 결과 안내 공문 — DYDOC 단순 기안(결재선 없음 · 온나라 기안함까지, 2026-11-06 운영 결정) =====
     * 대상은 «연도|반기» 키. 실리는 행은 DYSH.noticeRows 한 곳이 정한다(재난안전과 위탁 · 결과 입력 · 아직 공문 전).
     * 보낸 공문을 열 때는 그 공문에 실린 행(doc.rowIds)으로 별지를 다시 그린다 — 뒤에 결과가 바뀌어도
     * 이미 보낸 공문의 별지가 따라 바뀌지 않게 하려고 잠금을 함께 건다(DYSH.weLockOf). */
    function rowsOf(t, doc) {
        if (doc && doc.rowIds) return doc.rowIds.map(function (id) { return S().workEnvOf(id); }).filter(Boolean);
        return t ? t.rows : [];
    }
    function deptIdOf(name) { return V().deptIdOf ? V().deptIdOf(name) : name; }
    function deptNameOf(id) { var n = V().orgNode ? V().orgNode(id) : null; return n ? n.name : id; }
    function setupNoticeDoc() {
        if (!global.DYDOC || global.WENVDOC) return;
        var cfg = {
            ns: 'WENVDOC', lkey: 'dy-wenvdoc-apprline-v1', simple: true, simplePick: true,
            targetOf: function (key) {
                var p = String(key || '').split('|');
                if (p.length !== 2 || (p[1] !== 'H1' && p[1] !== 'H2')) return null;
                return { key: key, year: Number(p[0]), half: p[1], rows: S().noticeRows(p[0], p[1]) };
            },
            subjectOf: function (t) { return t.year + '년 ' + halfName(t.half) + ' 작업환경측정 결과 안내'; },
            titleOf: function (t) {
                var n = S().halfStat(t.year, t.half).docs.filter(function (d) { return d.status !== '반려' && d.status !== '반송'; }).length;
                return t.year + '년 ' + halfName(t.half) + ' 작업환경측정 결과 안내' + (n ? '(' + (n + 1) + '차)' : '');
            },
            initOf: function () { return { docType: '외부발송', to: '수신자 참조' }; },
            recipientsDefault: function (t) {
                var seen = {}, out = [];
                (t ? t.rows : []).forEach(function (r) { var id = deptIdOf(r.dept); if (id && !seen[id]) { seen[id] = 1; out.push(id); } });
                return out;
            },
            recipientsDefaultLabel: '결과가 들어온 사업장의 부서',
            recipientName: function (id) { return deptNameOf(id) + '장'; },
            recipientWarn: function (t, ids) {
                var miss = (t ? t.rows : []).filter(function (r) { return ids.indexOf(deptIdOf(r.dept)) < 0; })
                    .map(function (r) { return r.dept; });
                miss = miss.filter(function (x, i) { return miss.indexOf(x) === i; });
                return miss.length ? '별지에 ' + esc(miss.join(', ')) + ' 사업장이 있는데 수신처에서 빠졌습니다.' : '';
            },
            canDraft: function () { return canOwner() ? { ok: true } : { ok: false, why: '결과 안내 공문은 재난안전과 담당자가 보냅니다.' }; },
            ready: function (t) {
                if (!t.rows.length) return { ok: false, why: '공문에 실을 측정 결과가 없습니다 — 측정 완료 처리한 사업장이 있어야 합니다.' };
                var noRep = t.rows.filter(function (r) { return !S().reportFiles(r).length; });
                if (noRep.length) return { ok: false, why: '결과보고서가 없는 사업장: ' + noRep.map(function (r) { return r.site; }).join(', ') };
                var past = t.rows.filter(function (r) { return r.result === '개선 필요' && (!r.improveDue || r.improveDue < S().TODAY); });
                if (past.length) return { ok: false, why: '개선조치 기한이 지났거나 없는 사업장: ' + past.map(function (r) { return r.site; }).join(', ') + ' — [결과 수정]으로 기한을 고친 뒤 보냅니다.' };
                return { ok: true };
            },
            chips: function (t) {
                var rows = t.rows, imp = rows.filter(function (r) { return r.result === '개선 필요'; });
                var ex = imp.filter(function (r) { return r.exceed; });
                return [
                    { label: '결과 안내', text: '1. ' + t.year + '년 ' + halfName(t.half) + ' 작업환경측정 결과를 붙임과 같이 알려 드립니다.\n  가. 대상: 붙임 별지의 ' + rows.length + '개 사업장\n  나. 결과: 적정 ' + (rows.length - imp.length) + '곳 · 개선 필요 ' + imp.length + '곳' + (ex.length ? '(노출기준 초과 ' + ex.length + '곳)' : '') },
                    { label: '개선 요청', text: '2. 개선이 필요한 사업장은 붙임 별지의 조치기한 안에 개선조치를 하시고, 중대재해 통합관리시스템 › 작업환경·건강 › 작업환경측정에서 조치 증빙을 올려 완료 처리하여 주시기 바랍니다.' },
                    { label: '근로자 알림', text: '3. 측정 결과를 해당 작업장 근로자에게 알려 주시기 바랍니다.' }
                ];
            },
            attachOf: function (t) {
                var seen = {}, out = [];
                (t ? t.rows : []).forEach(function (r) {
                    S().reportFiles(r).forEach(function (f) {
                        if (seen[f.name]) return; seen[f.name] = 1;
                        out.push({ label: f.name, meta: '결과보고서', on: true, size: f.size || null });
                    });
                });
                return out;
            },
            annexes: function (t, doc) {
                var rows = rowsOf(t, doc);
                if (!rows.length) return [];
                return [{
                    title: '사업장별 작업환경측정 결과 (' + rows.length + '곳)',
                    html: '<table class="table-figma table-doc"><thead><tr>' +
                            '<th>연번</th><th>부서</th><th>사업장</th><th>측정 대상(유해인자)</th><th>측정일</th><th>결과</th><th>개선 요구</th><th>조치기한</th>' +
                          '</tr></thead><tbody>' +
                        rows.map(function (r, i) {
                            return '<tr><td>' + (i + 1) + '</td><td>' + esc(r.dept) + '</td><td>' + esc(r.site) + '</td><td>' + esc(r.subject) + '</td>' +
                                '<td>' + esc(r.done) + '</td><td>' + esc(r.result) + (r.exceed ? '(노출기준 초과)' : '') + '</td>' +
                                '<td>' + esc(r.result === '개선 필요' ? r.improveReq : '-') + '</td><td>' + esc(r.result === '개선 필요' ? r.improveDue : '-') + '</td></tr>';
                        }).join('') + '</tbody></table>'
                }];
            },
            basisOf: function () {
                var L = global.DYLAW;
                if (!L || !L.basisTitle) return [];
                var t = L.basisTitle('osh-125');
                return t ? [{ key: 'osh-125', label: t }] : [];
            },
            save: function (t, doc) { S().saveNotice(t.year, t.half, doc, t.rows.map(function (r) { return r.id; })); },
            docsFor: function (t) { return t ? S().halfStat(t.year, t.half).docs : []; },
            nextNo: function () { return S().nextNoticeNo(); },
            lockNote: '보낸 뒤에는 이 공문에 실린 사업장의 측정 결과와 결과보고서를 고칠 수 없습니다. 개선조치는 계속 진행합니다.',
            sentNote: '결과 안내 공문을 온나라 연계기안함에 보냈습니다. 개선이 필요한 사업장이 있으면 그 부서 내 할일에 개선조치가 생깁니다.'
        };
        global.DYDOC.define(cfg).registerRefresh(render);
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

    global.WENV = { init: init, setYear: setYear, setHalf: setHalf, setDept: setDept, setTile: setTile,
        detail: detail, attach: attach, saveAttach: saveAttach, onPick: onPick, setWith: setWith, openNew: openNew, saveNew: saveNew,
        pickDept: pickDept, onSiteChange: onSiteChange };
})(window);
