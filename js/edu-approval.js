/* =====================================================================
   edu-approval.js · 안전보건교육 온나라 결재 상신 (EDUAPV)
   ---------------------------------------------------------------------
   근거: docs/planning/기획-안전보건교육-온나라결재상신-v1.md
   · 결재 상신 트리거 3종 (모두 결재 문서 미리보기 팝업 = DYV2.openModal wide 변형):
       ① 총괄(summary) — 목록 우측 최상단 버튼. 모든 총괄 데이터 기준(종류별·개인별·통합 3탭).
       ② 교육별(course) — 각 교육 상세/카드의 결재 상태 칩 → 그 교육 1건 실시 결과 문서.
       ③ 개인별(person) — 이수현황 대상자별 상세 행 → 그 사람 1명의 교육 이수 확인서.
   · 목록에는 온나라 결재 상태(미상신·결재중·결재완료·반려)를 칩으로 노출한다.
     칩 클릭 → 결재 상태 팝업(문서 다시 보기 · 결재 완료/반려 시연 회신 · 재상신).
   · 문서 데이터는 전부 DYEDU(js/edu-data.js) 파생 — 자체 시드를 만들지 않는다.
   · 결재선은 고정하지 않는다 — 법령은 결재권자를 정하지 않고 지자체 위임전결규칙 소관이므로,
     기본값(기안자 부서의 팀장 → 과장)만 조직도에서 파생하고 ORGPICK 으로 바꿀 수 있게 한다.
   · 상신·상태 이력은 sessionStorage(dy-edu-approval-v2), 결재선은 dy-edu-apprline-v1.
   표준: 모달 DYV2.openModal · 탭 .sub-tabs/.sub-tab · 표 .table-figma(.table-doc)
        · 배지 chip-status + DYV2.toneOf · select .form-select
   로드 순서: layout.js → common.js → edu-data.js → (화면 모듈) → edu-approval.js
   ===================================================================== */
(function (global) {
    'use strict';
    var V = function () { return global.DYV2; };
    var E = function () { return global.DYEDU; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }

    var AKEY = 'dy-edu-approval-v2';   /* 상신·상태 이력 (키드 스토어) */
    var LKEY = 'dy-edu-apprline-v1';   /* 결재선 (화면 간 유지) */
    var MAX_STEP = 3;                  /* 기안 외 결재 단계 최대 3(검토 2 + 결재 1) */

    /* 결재 상태 4단계 — 미상신은 스토어에 기록이 없는 상태(파생) */
    var ST_SUBMITTED = '결재중', ST_DONE = '결재완료', ST_REJECT = '반려', ST_NONE = '미상신';

    /* 총괄 문서 3종 — 라벨·부제·용도. 탭 순서가 곧 결재 서식 번호다. */
    var VIEWS = [
        { id: 'kind', tab: '① 교육 종류별 목록',
          title: '안전보건교육 실시 결과 보고',
          use: '교육 종류(정기·채용시·기타·관리감독자)별로 <b>무엇을 언제 몇 시간</b> 실시했는지를 목록으로 상신합니다.' },
        { id: 'person', tab: '② 개인별 이수 현황',
          title: '안전보건교육 개인별 이수 현황 보고',
          use: '대상자 <b>개인별 필요·인정·미달 시간과 이수 여부</b>를 부서별 요약과 함께 상신합니다.' },
        { id: 'all', tab: '③ 통합 문서',
          title: '안전보건교육 실시 결과 및 이수 현황 통합 보고',
          use: '①의 실시 내역과 ②의 이수 현황을 <b>한 건의 기안문</b>으로 묶어 상신합니다.' }
    ];
    function viewOf(id) {
        for (var i = 0; i < VIEWS.length; i++) if (VIEWS[i].id === id) return VIEWS[i];
        return VIEWS[0];
    }

    /* mode: 'summary'(①) | 'course'(②) | 'person'(③) */
    var state = { mode: 'summary', view: 'kind', year: '', dept: '',
                  courseId: null, workerId: null, line: null, editIdx: -1, refreshFns: [] };

    /* ======================= 결재 상태 스토어 (키드) =======================
     * subs: [{ sid, kind:'summary'|'course'|'person', target, no, at, status,
     *          label, line, view, year, dept, courseId, workerId, log:[{at,st}] }]
     * target 은 컨텍스트 키 — 같은 대상의 최신 1건이 그 대상의 현재 상태다. */
    var _store = null;
    function store() {
        if (_store) return _store;
        try { var raw = global.sessionStorage.getItem(AKEY); _store = raw ? JSON.parse(raw) : null; } catch (e) { _store = null; }
        if (!_store || !_store.subs) _store = { seq: 2600, subs: [] };
        return _store;
    }
    function saveStore() { try { global.sessionStorage.setItem(AKEY, JSON.stringify(store())); } catch (e) {} }
    function subsFor(kind, target) {
        return store().subs.filter(function (s) { return s.kind === kind && s.target === target; });
    }
    function latestSub(kind, target) {
        var arr = subsFor(kind, target);
        return arr.length ? arr[arr.length - 1] : null;
    }
    function statusOf(kind, target) {
        var s = latestSub(kind, target);
        return s ? s.status : ST_NONE;
    }
    function nextNo() { var st = store(); st.seq = (st.seq || 2600) + 1; return '재난안전과-' + st.seq; }
    function pushSub(rec) {
        rec.sid = 'A' + (store().seq) + '-' + store().subs.length;
        rec.log = [{ at: rec.at, st: rec.status }];
        store().subs.push(rec); saveStore();
    }
    function advanceSub(kind, target, newStatus) {
        var s = latestSub(kind, target); if (!s) return null;
        s.status = newStatus; s.log = s.log || []; s.log.push({ at: today(), st: newStatus });
        saveStore(); return s;
    }

    /* 컨텍스트 키 */
    function summaryTarget() { return 'S|' + state.view + '|' + curYear() + '|' + (state.dept || 'ALL'); }
    function courseTarget(id) { return 'C|' + id; }
    function personTarget(wid, year) { return 'P|' + wid + '|' + (year || curYear()); }

    /* =========================== 결재선 =========================== */
    function stepLabel(i, len) { return i === len - 1 ? '결재' : '검토'; }
    function defaultLine() {
        var p = persona();
        var deptName = p.deptName || '재난안전과';
        var d = (V().orgFlat() || []).filter(function (x) { return x.dept === deptName; })[0];
        var team = null, head = null;
        if (d) {
            d.members.forEach(function (m) {
                if (!team && /팀장/.test(m[0])) team = m;
                if (!head && /(과장|소장|실장|국장|읍장|면장)$/.test(m[0])) head = m;
            });
        }
        var out = [];
        if (team) out.push({ dept: deptName, role: team[0], name: team[1] });
        out.push(head ? { dept: deptName, role: head[0], name: head[1] }
                      : { dept: deptName, role: '과장', name: '' });
        return out;
    }
    function line() {
        if (state.line) return state.line;
        try {
            var raw = global.sessionStorage.getItem(LKEY);
            if (raw) { var v = JSON.parse(raw); if (v && v.length) { state.line = v; return v; } }
        } catch (e) {}
        state.line = defaultLine();
        return state.line;
    }
    function saveLine() { try { global.sessionStorage.setItem(LKEY, JSON.stringify(state.line || [])); } catch (e) {} }
    function lineText() {
        var p = persona(), L = line();
        return ['기안 ' + p.name].concat(L.map(function (s, i) {
            return stepLabel(i, L.length) + ' ' + (s.name || '(미지정)');
        })).join(' → ');
    }
    function parseMember(value) {
        var s = String(value || '');
        var slash = s.lastIndexOf(' / ');
        var name = slash >= 0 ? s.slice(slash + 3) : s;
        var left = slash >= 0 ? s.slice(0, slash) : '';
        var dot = left.indexOf(' · ');
        return { dept: dot >= 0 ? left.slice(0, dot) : '', role: dot >= 0 ? left.slice(dot + 3) : left, name: name };
    }
    function pickOpen(i) { state.editIdx = i; global.ORGPICK.toggle('eduapv-ln-' + i, 'member', 'EDUAPV.pickApprover'); }
    function pickApprover(value) {
        var i = state.editIdx, L = line();
        if (i < 0 || !L[i]) return;
        L[i] = parseMember(value); saveLine(); paint();
    }
    function addStep() {
        var L = line();
        if (L.length >= MAX_STEP) { toast('결재 단계는 최대 ' + MAX_STEP + '단계까지 지정할 수 있습니다'); return; }
        L.splice(L.length - 1, 0, { dept: '', role: '검토자', name: '' }); saveLine(); paint();
    }
    function delStep(i) {
        var L = line();
        if (L.length <= 1) { toast('최종 결재자는 삭제할 수 없습니다'); return; }
        L.splice(i, 1); saveLine(); paint();
    }
    function resetLine() { state.line = defaultLine(); saveLine(); paint(); toast('기본 결재선(팀장 → 과장)으로 되돌렸습니다'); }

    /* ============================ 공통 파생 ============================ */
    function persona() {
        var p = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        return p || { name: '박안전', role: '안전관리 주무관', org: '담양군청 · 재난안전과' };
    }
    function today() { return E().TODAY; }
    function curYear() { return state.year || String(today()).slice(0, 4); }
    function yearOptions() {
        var map = {};
        E().courses().forEach(function (c) { if (c.date) map[String(c.date).slice(0, 4)] = true; });
        map[String(today()).slice(0, 4)] = true;
        return Object.keys(map).sort().reverse();
    }
    function depts() { return E().deptCandidates(); }
    function deptLabel() { return state.dept ? E().deptName(state.dept) : '전체 부서(' + depts().length + '개)'; }

    function courseDepts(c) {
        if (c.deptId) return [c.deptId];
        var map = {};
        E().enrolls(c.id).forEach(function (e) { if (e.deptId) map[e.deptId] = true; });
        return Object.keys(map);
    }
    function courseDeptsInScope(c) {
        var ds = courseDepts(c);
        return state.dept ? ds.filter(function (d) { return d === state.dept; }) : ds;
    }
    function scopedCourses() {
        var y = curYear();
        return E().courses().filter(function (c) {
            if (String(c.date || '').slice(0, 4) !== y) return false;
            if (!state.dept) return true;
            return courseDepts(c).indexOf(state.dept) >= 0;
        }).sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    }
    function courseDone(c) {
        var dept = state.dept;
        return E().records().filter(function (r) {
            if (r.courseId !== c.id) return false;
            if (!dept) return true;
            var w = E().workerOf(r.workerId);
            return !!w && w.deptId === dept;
        }).length;
    }
    function scopedWorkers() {
        return E().workers().filter(function (w) { return !state.dept || w.deptId === state.dept; })
            .sort(function (a, b) {
                var d = E().deptName(a.deptId).localeCompare(E().deptName(b.deptId));
                return d !== 0 ? d : String(a.name).localeCompare(String(b.name));
            });
    }
    function statusRows() { return scopedWorkers().map(function (w) { return E().statusRow(w, today()); }); }
    var KIND_ORDER = ['REG_GROUP', 'REG_SELF', 'HIRE', 'ETC', 'SUP_REG', 'SUP_ETC'];
    function byKind() {
        var list = scopedCourses(), map = {};
        list.forEach(function (c) { (map[c.kind] = map[c.kind] || []).push(c); });
        return KIND_ORDER.filter(function (k) { return map[k]; }).map(function (k) {
            var arr = map[k];
            return { kind: k, label: E().kindLabel(k), courses: arr,
                hours: Math.round(arr.reduce(function (n, c) { return n + (c.hours || 0); }, 0) * 10) / 10,
                done: arr.reduce(function (n, c) { return n + courseDone(c); }, 0),
                closed: arr.filter(function (c) { return c.status === 'DONE'; }).length };
        });
    }

    /* ============================ 문서 조각 ============================ */
    function box(tone, value, label) { return '<div class="pdf-kpi ' + tone + '"><b>' + value + '</b><span>' + label + '</span></div>'; }
    function kpis(list) { return '<div class="pdf-kpis">' + list.map(function (k) { return box(k[0], k[1], k[2]); }).join('') + '</div>'; }
    function sec(no, title) { return '<div class="pdf-sec">' + no + '. ' + esc(title) + '</div>'; }
    function subsec(text) { return '<div class="pdf-subsec">' + text + '</div>'; }
    function chip(label) { return '<span class="chip-status chip-sm ' + V().toneOf(label) + '">' + esc(label) + '</span>'; }
    function dash() { return '<span class="pdf-dash">-</span>'; }

    function tbl(cols, rows) {
        var head = cols.map(function (c) {
            return '<th' + (c.a === 'l' ? '' : ' class="c"') + (c.w ? ' style="width:' + c.w + ';"' : '') + '>' + c.t + '</th>';
        }).join('');
        var body = rows.length
            ? rows.map(function (r) {
                var cls = r.tone ? ' class="' + r.tone + '"' : '';
                var cells = (r.cells || r);
                return '<tr' + cls + '>' + cells.map(function (v, i) {
                    return '<td' + (cols[i] && cols[i].a === 'l' ? '' : ' class="c"') + '>' + v + '</td>';
                }).join('') + '</tr>';
            }).join('')
            : '<tr><td class="c pdf-empty" colspan="' + cols.length + '">해당 조건의 자료가 없습니다</td></tr>';
        return '<div class="pdf-tablewrap"><table class="table-figma table-doc"><thead><tr>' + head +
               '</tr></thead><tbody>' + body + '</tbody></table></div>';
    }

    function docTop() {
        var p = persona(), L = line();
        var cols = [{ t: p.role || '담당', n: p.name }].concat(L.map(function (s) {
            return { t: s.role || stepLabel(L.indexOf(s), L.length), n: s.name };
        }));
        return '<div class="pdf-doc-top">' +
            '<div class="pdf-doc-org"><b>담양군청</b><span>' + esc(p.org || '재난안전과') + '</span></div>' +
            '<div class="pdf-appr" aria-label="결재란">' + cols.map(function (c) {
                return '<div class="pdf-appr-col"><div class="pdf-appr-t">' + esc(c.t) + '</div>' +
                       '<div class="pdf-appr-s">' + esc(c.n || '') + '</div></div>';
            }).join('') + '</div>' +
        '</div>';
    }
    function docTitle(titleText, subText) {
        return '<h2 class="pdf-title">' + esc(titleText) + '</h2>' +
               '<p class="pdf-doc-sub">' + subText + '</p>';
    }
    /* 문서 개요표 — 공통 행(문서번호·기안일자·기안자·결재선) + 컨텍스트 행 + 근거 법령 */
    function docMeta(no, ctxRows) {
        var p = persona();
        var rows = [
            ['문서번호', no ? esc(no.no) + ' <span class="pdf-note">(' + esc(no.at) + ' 상신 · ' + esc(no.status) + ')</span>'
                            : '<span class="pdf-note">상신 시 온나라에서 부여</span>'],
            ['기안일자', today()],
            ['기안자', esc(p.name) + ' ' + esc(p.role) + ' <span class="pdf-note">(' + esc(p.org) + ')</span>'],
            ['결재선', esc(lineText()) + ' <span class="pdf-note">· 담양군 사무 위임·전결 규칙에 따름</span>']
        ].concat(ctxRows || []).concat([
            ['근거 법령', '산업안전보건법 §29(근로자 안전보건교육) · 같은 법 시행규칙 §26 [별표 4] 교육시간<br>중대재해처벌법 §4①1호 · 같은 법 시행령 §4(안전보건 관리체계의 구축 및 이행)']
        ]);
        return '<table class="table-figma table-doc pdf-meta"><tbody>' + rows.map(function (r) {
            return '<tr><td class="k">' + r[0] + '</td><td>' + r[1] + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    function docFoot(extra) {
        return '<div class="pdf-doc-foot">' + (extra || '') +
            '<p>본 문서는 담양군 중대재해예방 통합관리시스템에서 자동 생성되어 <b>온나라 전자결재</b>로 상신됩니다. ' +
            '결재 완료 시 온나라가 부여한 문서등록번호·결재일이 회신 등록되어 교육 이력과 연결됩니다.</p>' +
        '</div>';
    }

    /* ====================== ① 총괄 — 교육 종류별 목록 ====================== */
    function docKind() {
        var groups = byKind();
        var all = scopedCourses();
        var hours = Math.round(all.reduce(function (n, c) { return n + (c.hours || 0); }, 0) * 10) / 10;
        var done = all.reduce(function (n, c) { return n + courseDone(c); }, 0);
        var deptMap = {};
        all.forEach(function (c) { courseDeptsInScope(c).forEach(function (d) { deptMap[d] = true; }); });
        var lastKpi = state.dept ? ['neutral', scopedWorkers().length + '명', '부서 대상 인원']
                                 : ['neutral', Object.keys(deptMap).length + '개', '참여 부서'];
        var sumRows = groups.map(function (g) {
            return [esc(g.label), g.courses.length + '건', g.hours + 'h', g.done + '명', g.closed + ' / ' + g.courses.length];
        });
        if (groups.length) sumRows.push({ tone: 'pdf-total', cells: ['합계', all.length + '건', hours + 'h', done + '명',
            groups.reduce(function (n, g) { return n + g.closed; }, 0) + ' / ' + all.length] });
        var detail = groups.map(function (g) {
            var rows = g.courses.map(function (c, i) {
                var ds = courseDeptsInScope(c).map(function (d) { return E().deptName(d); });
                return [String(i + 1), E().courseDateTime(c) || dash(),
                    '<span class="pdf-strong">' + esc(c.desc || E().kindLabel(c.kind)) + '</span>' +
                        (c.etcType ? ' <span class="pdf-note">(' + esc(c.etcType) + ')</span>' : ''),
                    (c.hours || 0) + 'h', esc(c.instructor || '-'), esc(c.place || '-'),
                    ds.length ? esc(ds.length > 3 ? ds.slice(0, 3).join(', ') + ' 외 ' + (ds.length - 3) : ds.join(', ')) : dash(),
                    courseDone(c) + '명', chip(c.status === 'DONE' ? '완료' : '진행중')];
            });
            return subsec('▸ ' + esc(g.label) + ' <span class="pdf-note">' + g.courses.length + '건 · ' + g.hours + 'h · 이수 연인원 ' + g.done + '명</span>') +
                tbl([{ t: '연번', a: 'c', w: '38px' }, { t: '교육 일시', a: 'c', w: '128px' }, { t: '교육명 (내용)', a: 'l' },
                     { t: '시간', a: 'c', w: '46px' }, { t: '강사', a: 'l', w: '108px' }, { t: '장소', a: 'l', w: '96px' },
                     { t: '대상 부서', a: 'l', w: '132px' }, { t: '이수', a: 'c', w: '52px' }, { t: '상태', a: 'c', w: '58px' }], rows);
        }).join('');
        return docTop() + docTitle(curYear() + '년 ' + viewOf('kind').title, summarySub()) +
            docMeta(latestSub('summary', summaryTarget()), summaryCtxRows()) +
            sec('Ⅰ', '종합 요약') +
            kpis([['info', all.length + '건', '실시 교육'], ['info', hours + 'h', '총 교육시간'],
                  ['success', done + '명', '이수 연인원'], lastKpi]) +
            sec('Ⅱ', '교육 종류별 실시 집계') +
            tbl([{ t: '교육 종류', a: 'l' }, { t: '실시 건수', a: 'c', w: '80px' }, { t: '교육시간 합계', a: 'c', w: '96px' },
                 { t: '이수 연인원', a: 'c', w: '90px' }, { t: '종료 / 전체', a: 'c', w: '90px' }], sumRows) +
            sec('Ⅲ', '교육 종류별 상세 목록') +
            (detail || '<p class="pdf-empty-p">대상기간에 실시한 교육이 없습니다.</p>') +
            docFoot('<p><b>붙임</b> 1. 교육계획서 각 1부  2. 참석자 서명부 사본 각 1부  3. 교육 사진 각 1부.  끝.</p>');
    }
    function summarySub() { return '대상기간 ' + curYear() + '.01.01 ~ ' + curYear() + '.12.31 · 기준일 ' + today() + ' · ' + esc(deptLabel()); }
    function summaryCtxRows() {
        return [['대상 범위', esc(deptLabel()) + ' <span class="pdf-note">· 근로자 명단(인사연동·직접등록·엑셀업로드) 기준</span>']];
    }

    /* ==================== ② 총괄 — 개인별 이수 현황 ==================== */
    function personSummaryRows() {
        return E().deptSummary(today(), function (w) { return !state.dept || w.deptId === state.dept; }).map(function (d) {
            var short = d.total - d.done;
            return [esc(d.name), d.total + '명', d.done + '명',
                    (short ? '<span class="pdf-bad">' + short + '명</span>' : '0명'), d.pct + '%'];
        });
    }
    function personDetailRows(rows) {
        return rows.map(function (s, i) {
            var w = s.worker;
            return { tone: s.complete ? '' : 'pdf-warn', cells: [
                String(i + 1), esc(E().deptName(w.deptId)), '<span class="pdf-strong">' + esc(w.name) + '</span>',
                esc(E().catLabel(w.category)), esc(E().empLabel(w.empType)), esc(w.hireDate || '-'),
                esc(s.cycle.start + ' ~ ' + s.cycle.end), s.need + 'h', s.done + 'h',
                (s.short ? '<span class="pdf-bad">' + s.short + 'h</span>' : dash()), chip(s.complete ? '완료' : '미이수')] };
        });
    }
    function personKpis(rows) {
        var done = rows.filter(function (r) { return r.complete; }).length;
        var shortH = Math.round(rows.reduce(function (n, r) { return n + r.short; }, 0) * 10) / 10;
        var pct = rows.length ? Math.round(done / rows.length * 100) : 0;
        return { done: done, shortH: shortH, pct: pct,
            list: [['info', rows.length + '명', '교육 대상자'], ['success', done + '명', '이수 완료'],
                   ['danger', (rows.length - done) + '명', '미이수'], ['warning', pct + '%', '이수 완료율']] };
    }
    function actionPlan(rows) {
        var shortList = rows.filter(function (r) { return !r.complete; });
        var soon = shortList.filter(function (r) { return r.cycle.daysToEnd <= 30; }).length;
        return '<ul class="pdf-list">' +
            '<li>미이수 <b>' + shortList.length + '명</b> · 부족 시간 합계 <b>' + Math.round(shortList.reduce(function (n, r) { return n + r.short; }, 0) * 10) / 10 + 'h</b> — 부서별 자체교육 또는 차기 집합교육 신청으로 사이클 내 보강합니다.</li>' +
            '<li>사이클 종료 <b>D-30 이내 ' + soon + '명</b>은 이수현황 화면에서 부서 담당자에게 <b>독촉 알림</b>을 우선 발송합니다.</li>' +
            '<li>차기 집합교육 등록 시 미이수자 소속 부서를 우선 대상으로 안내하고, 이수 결과는 서명부 첨부로 증빙합니다.</li>' +
        '</ul>';
    }
    function docPerson() {
        var rows = statusRows();
        var k = personKpis(rows);
        return docTop() + docTitle(curYear() + '년 ' + viewOf('person').title, summarySub()) +
            docMeta(latestSub('summary', summaryTarget()), summaryCtxRows()) +
            sec('Ⅰ', '종합 요약') + kpis(k.list) +
            '<p class="pdf-note-p">필요시간은 산업안전보건법 시행규칙 [별표 4] 및 담양군 운영 방침(채용일 기준 개인별 반기 사이클 · 관리감독자 연 16h)에 따라 산정하였습니다.</p>' +
            sec('Ⅱ', '부서별 이수 현황') +
            tbl([{ t: '부서', a: 'l' }, { t: '대상', a: 'c', w: '70px' }, { t: '완료', a: 'c', w: '70px' },
                 { t: '미이수', a: 'c', w: '76px' }, { t: '완료율', a: 'c', w: '70px' }], personSummaryRows()) +
            sec('Ⅲ', '개인별 이수 현황') +
            tbl([{ t: '연번', a: 'c', w: '38px' }, { t: '부서', a: 'l', w: '104px' }, { t: '성명', a: 'l', w: '68px' },
                 { t: '구분', a: 'c', w: '86px' }, { t: '고용형태', a: 'c', w: '70px' }, { t: '채용일', a: 'c', w: '84px' },
                 { t: '교육 사이클', a: 'c', w: '152px' }, { t: '필요', a: 'c', w: '46px' }, { t: '인정', a: 'c', w: '46px' },
                 { t: '미달', a: 'c', w: '46px' }, { t: '이수 여부', a: 'c', w: '66px' }], personDetailRows(rows)) +
            sec('Ⅳ', '미이수자 조치 계획') + actionPlan(rows) +
            docFoot('<p><b>붙임</b> 1. 개인별 이수 내역 1부  2. 미이수자 명단 1부.  끝.</p>');
    }

    /* ========================= ③ 총괄 — 통합 문서 ========================= */
    function docAll() {
        var groups = byKind();
        var all = scopedCourses();
        var hours = Math.round(all.reduce(function (n, c) { return n + (c.hours || 0); }, 0) * 10) / 10;
        var doneCnt = all.reduce(function (n, c) { return n + courseDone(c); }, 0);
        var rows = statusRows();
        var k = personKpis(rows);
        var sumRows = groups.map(function (g) {
            return [esc(g.label), g.courses.length + '건', g.hours + 'h', g.done + '명', g.closed + ' / ' + g.courses.length];
        });
        if (groups.length) sumRows.push({ tone: 'pdf-total', cells: ['합계', all.length + '건', hours + 'h', doneCnt + '명',
            groups.reduce(function (n, g) { return n + g.closed; }, 0) + ' / ' + all.length] });
        var courseRows = all.map(function (c, i) {
            return [String(i + 1), esc(E().kindLabel(c.kind)), E().courseDateTime(c) || dash(),
                '<span class="pdf-strong">' + esc(c.desc || E().kindLabel(c.kind)) + '</span>',
                (c.hours || 0) + 'h', esc(c.instructor || '-'), courseDone(c) + '명', chip(c.status === 'DONE' ? '완료' : '진행중')];
        });
        return docTop() + docTitle(curYear() + '년 ' + viewOf('all').title, summarySub()) +
            docMeta(latestSub('summary', summaryTarget()), summaryCtxRows()) +
            sec('Ⅰ', '종합 요약') +
            kpis([['info', all.length + '건', '실시 교육'], ['info', hours + 'h', '총 교육시간'],
                  ['success', doneCnt + '명', '이수 연인원'], ['neutral', k.list[0][1], '교육 대상자'],
                  ['success', k.done + '명', '이수 완료'], ['danger', (rows.length - k.done) + '명', '미이수'],
                  ['warning', k.pct + '%', '이수 완료율'], ['warning', k.shortH + 'h', '부족 시간 합계']]) +
            sec('Ⅱ', '교육 종류별 실시 집계') +
            tbl([{ t: '교육 종류', a: 'l' }, { t: '실시 건수', a: 'c', w: '80px' }, { t: '교육시간 합계', a: 'c', w: '96px' },
                 { t: '이수 연인원', a: 'c', w: '90px' }, { t: '종료 / 전체', a: 'c', w: '90px' }], sumRows) +
            sec('Ⅲ', '교육 실시 목록') +
            tbl([{ t: '연번', a: 'c', w: '38px' }, { t: '교육 종류', a: 'l', w: '116px' }, { t: '교육 일시', a: 'c', w: '128px' },
                 { t: '교육명 (내용)', a: 'l' }, { t: '시간', a: 'c', w: '46px' }, { t: '강사', a: 'l', w: '108px' },
                 { t: '이수', a: 'c', w: '52px' }, { t: '상태', a: 'c', w: '58px' }], courseRows) +
            sec('Ⅳ', '부서별 이수 현황') +
            tbl([{ t: '부서', a: 'l' }, { t: '대상', a: 'c', w: '70px' }, { t: '완료', a: 'c', w: '70px' },
                 { t: '미이수', a: 'c', w: '76px' }, { t: '완료율', a: 'c', w: '70px' }], personSummaryRows()) +
            sec('Ⅴ', '개인별 이수 현황') +
            tbl([{ t: '연번', a: 'c', w: '38px' }, { t: '부서', a: 'l', w: '104px' }, { t: '성명', a: 'l', w: '68px' },
                 { t: '구분', a: 'c', w: '86px' }, { t: '고용형태', a: 'c', w: '70px' }, { t: '채용일', a: 'c', w: '84px' },
                 { t: '교육 사이클', a: 'c', w: '152px' }, { t: '필요', a: 'c', w: '46px' }, { t: '인정', a: 'c', w: '46px' },
                 { t: '미달', a: 'c', w: '46px' }, { t: '이수 여부', a: 'c', w: '66px' }], personDetailRows(rows)) +
            sec('Ⅵ', '미이수자 조치 계획') + actionPlan(rows) +
            docFoot('<p><b>붙임</b> 1. 교육계획서·참석자 서명부 각 1부  2. 개인별 이수 내역 1부  3. 미이수자 명단 1부.  끝.</p>');
    }

    /* ==================== 교육별(②) — 그 교육 1건 실시 결과 ==================== */
    function recKindLabel(r) {
        var c = r.courseId ? E().courseOf(r.courseId) : null;
        if (c) return E().kindLabel(c.kind) + (c.etcType ? '(' + c.etcType + ')' : '');
        return ({ REG: '정기교육', HIRE: '채용시교육', ETC: '기타 교육' })[r.kind] || r.kind;
    }
    /* 교육명 정제 — 문서 제목용. desc 에 이미 연도가 들어 있어 연도 접두는 붙이지 않고,
     * ' — 신청 접수 중' 같은 상태 꼬리표는 제거한다. desc 가 없으면 종류 라벨로 대체. */
    function courseTitleBase(c) {
        var t = String((c && c.desc) || '').split(' — ')[0].trim();
        return t || (c ? E().kindLabel(c.kind) : '교육');
    }
    function docCourse() {
        var c = E().courseOf(state.courseId);
        if (!c) return '<p class="pdf-empty-p">교육을 찾을 수 없습니다.</p>';
        var sessions = E().courseSessions(c);
        var recs = E().records().filter(function (r) { return r.courseId === c.id; });
        var doneMap = {}; recs.forEach(function (r) { doneMap[r.workerId] = r; });
        var enrolls = E().enrolls(c.id);
        var yr = String(c.date || today()).slice(0, 4);

        var ctx = [
            ['교육 구분', esc(E().kindLabel(c.kind)) + (c.etcType ? ' <span class="pdf-note">(' + esc(c.etcType) + ')</span>' : '')],
            ['대상 범위', (c.deptId ? esc(E().deptName(c.deptId)) : '신청 부서(' + enrolls.length + '개)') +
                ' <span class="pdf-note">· ' + (c.status === 'DONE' ? '교육 종료(이수 반영)' : '신청 접수 중') + '</span>']
        ];

        /* 회차 표 */
        var sessRows = sessions.map(function (s, i) {
            return [String(i + 1), esc(s.date), esc((s.start || '') + (s.end ? ' ~ ' + s.end : '')) || dash(), E().sessionHours(s) + 'h'];
        });

        /* 참석·이수 현황 */
        var attendSec;
        if (enrolls.length) {
            var rows = enrolls.map(function (e, i) {
                var names = (e.workerIds || []).map(function (wid) { var w = E().workerOf(wid); return w ? w.name : wid; });
                var doneCnt = (e.workerIds || []).filter(function (wid) { return doneMap[wid]; }).length;
                return [String(i + 1), esc(E().deptName(e.deptId)),
                    esc(names.length > 6 ? names.slice(0, 6).join(', ') + ' 외 ' + (names.length - 6) : names.join(', ')) || dash(),
                    names.length + '명',
                    e.signFile ? '<span class="pdf-note">📎 ' + esc(e.signFile) + '</span>' : dash(),
                    (c.status === 'DONE' ? chip('완료') : (doneCnt ? doneCnt + '명' : chip('진행중')))];
            });
            attendSec = sec('Ⅱ', '신청·이수 현황 (부서별)') +
                tbl([{ t: '연번', a: 'c', w: '38px' }, { t: '부서', a: 'l', w: '110px' }, { t: '신청자 명단', a: 'l' },
                     { t: '인원', a: 'c', w: '54px' }, { t: '서명파일', a: 'l', w: '150px' }, { t: '이수', a: 'c', w: '66px' }], rows);
        } else {
            var wrows = Object.keys(doneMap).map(function (wid, i) {
                var w = E().workerOf(wid); var r = doneMap[wid];
                return [String(i + 1), esc(w ? E().deptName(w.deptId) : '-'),
                    '<span class="pdf-strong">' + esc(w ? w.name : wid) + '</span>',
                    esc(w ? E().catLabel(w.category) : '-'), (r.hours || 0) + 'h', esc(r.date || '-')];
            });
            attendSec = sec('Ⅱ', '이수자 명단') +
                tbl([{ t: '연번', a: 'c', w: '38px' }, { t: '부서', a: 'l', w: '110px' }, { t: '성명', a: 'l', w: '90px' },
                     { t: '구분', a: 'c', w: '96px' }, { t: '인정시간', a: 'c', w: '72px' }, { t: '이수일', a: 'c', w: '96px' }], wrows);
        }

        var enrolledCnt = enrolls.reduce(function (n, e) { return n + (e.workerIds || []).length; }, 0);
        var totalTargets = enrolls.length ? enrolledCnt : Object.keys(doneMap).length;
        var doneTotal = c.status === 'DONE' ? totalTargets : Object.keys(doneMap).length;

        var evid = [];
        if (c.files && c.files.length) evid.push('📎 계획서·문서 ' + c.files.map(function (f) { return esc(f.name); }).join(', '));
        if (c.photos && c.photos.length) evid.push('📷 교육 사진 ' + c.photos.length + '장');
        enrolls.forEach(function (e) { if (e.signFile) evid.push('✍ ' + esc(E().deptName(e.deptId)) + ' 서명부 ' + esc(e.signFile)); });

        return docTop() +
            docTitle(esc(courseTitleBase(c)) + ' 실시 결과 보고',
                '교육 일시 ' + esc(E().courseDateTime(c)) + ' · 기준일 ' + today() + ' · ' + esc(E().kindLabel(c.kind))) +
            docMeta(latestSub('course', courseTarget(c.id)), ctx) +
            sec('Ⅰ', '교육 개요') +
            kpis([['info', c.hours + 'h', '교육 시간'], ['info', sessions.length + '회차', '진행 회차'],
                  ['neutral', totalTargets + '명', enrolls.length ? '신청 인원' : '대상 인원'],
                  ['success', doneTotal + '명', '이수 인원']]) +
            tbl([{ t: '회차', a: 'c', w: '48px' }, { t: '일자', a: 'c', w: '120px' }, { t: '시간대', a: 'c', w: '140px' }, { t: '시간', a: 'c', w: '60px' }], sessRows) +
            '<table class="table-figma table-doc pdf-meta" style="margin-top:8px;"><tbody>' +
                '<tr><td class="k">강사</td><td>' + esc(c.instructor || '-') + '</td></tr>' +
                '<tr><td class="k">장소</td><td>' + esc(c.place || '-') + '</td></tr>' +
                '<tr><td class="k">교육 내용</td><td>' + esc(c.desc || '-') + '</td></tr>' +
            '</tbody></table>' +
            attendSec +
            sec('Ⅲ', '증빙 자료') +
            (evid.length ? '<ul class="pdf-list">' + evid.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>'
                         : '<p class="pdf-empty-p">등록된 증빙 자료가 없습니다.</p>') +
            docFoot('<p><b>붙임</b> 1. 교육계획서 1부  2. 참석자 서명부 1부  3. 교육 사진 1부.  끝.</p>');
    }

    /* ==================== 개인별(③) — 한 사람 이수 확인서 ==================== */
    function docPersonOne() {
        var w = E().workerOf(state.workerId);
        if (!w) return '<p class="pdf-empty-p">대상자를 찾을 수 없습니다.</p>';
        var sr = E().statusRow(w, today());
        var recs = E().recordsFor(w.id).slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
        var totalH = Math.round(recs.reduce(function (n, r) { return n + (r.hours || 0); }, 0) * 10) / 10;
        var recRows = recs.map(function (r, i) {
            return [String(i + 1), esc(r.date || '-'), '<span class="pdf-strong">' + esc(recCourseName(r)) + '</span>',
                    esc(recKindLabel(r)), (r.hours || 0) + 'h'];
        });
        var ctx = [
            ['대상자', '<span class="pdf-strong">' + esc(w.name) + '</span> · ' + esc(E().deptName(w.deptId)) +
                ' · ' + esc(E().catLabel(w.category)) + ' · ' + esc(E().empLabel(w.empType))],
            ['채용일 · 사이클', esc(w.hireDate || '-') + ' <span class="pdf-note">· 현재 사이클 ' + esc(sr.cycle.start + ' ~ ' + sr.cycle.end) + '</span>']
        ];
        return docTop() +
            docTitle(curYear() + '년 ' + esc(w.name) + ' 안전보건교육 이수 확인서',
                esc(E().deptName(w.deptId)) + ' · ' + esc(E().catLabel(w.category)) + ' · 기준일 ' + today()) +
            docMeta(latestSub('person', personTarget(w.id)), ctx) +
            sec('Ⅰ', '이수 종합') +
            kpis([['info', sr.need + 'h', '필요시간(현 사이클)'], ['success', sr.done + 'h', '인정시간'],
                  [sr.short ? 'danger' : 'success', sr.short + 'h', '미달시간'],
                  [sr.complete ? 'success' : 'warning', sr.complete ? '이수' : '미이수', '이수 여부']]) +
            '<p class="pdf-note-p">인정시간은 현재 교육 사이클(' + esc(sr.cycle.start + ' ~ ' + sr.cycle.end) + ') 내 이수분 기준이며, 아래 이수 내역은 대상자의 전체 교육 이력입니다.</p>' +
            sec('Ⅱ', '교육 이수 내역 (전체 이력)') +
            tbl([{ t: '연번', a: 'c', w: '40px' }, { t: '이수일', a: 'c', w: '110px' }, { t: '교육명', a: 'l' },
                 { t: '교육 구분', a: 'l', w: '150px' }, { t: '인정시간', a: 'c', w: '78px' }],
                recRows.concat(recRows.length ? [{ tone: 'pdf-total', cells: ['', '', '합계', recs.length + '건', totalH + 'h'] }] : [])) +
            sec('Ⅲ', '판정 및 조치') +
            '<ul class="pdf-list">' +
                '<li>현재 사이클 필요 <b>' + sr.need + 'h</b> 대비 인정 <b>' + sr.done + 'h</b> — ' +
                    (sr.complete ? '<b>이수 완료</b>입니다.' : '미달 <b>' + sr.short + 'h</b>로 <b>미이수</b> 상태이며, 사이클 종료(' + esc(sr.cycle.end) + ')까지 보강이 필요합니다.') + '</li>' +
                (sr.hire ? '<li>채용시교육: <b>' + esc(sr.hire.status === 'BEFORE' ? '정상 이수' : (sr.hire.status === 'LATE_DONE' ? '지연 이수' : '미이수')) + '</b></li>' : '') +
            '</ul>' +
            docFoot('<p><b>붙임</b> 1. 개인 교육 이수 내역 1부.  끝.</p>');
    }
    function recCourseName(r) {
        var c = r.courseId ? E().courseOf(r.courseId) : null;
        return c ? (c.desc || E().kindLabel(c.kind)) : recKindLabel(r);
    }

    /* ============================ 문서 라우팅 ============================ */
    function docHtml() {
        if (state.mode === 'course') return docCourse();
        if (state.mode === 'person') return docPersonOne();
        if (state.view === 'person') return docPerson();
        if (state.view === 'all') return docAll();
        return docKind();
    }
    /* 현재 컨텍스트의 (kind, target, 문서 라벨) */
    function ctxKey() {
        if (state.mode === 'course') { var c = E().courseOf(state.courseId);
            return { kind: 'course', target: courseTarget(state.courseId),
                     label: courseTitleBase(c) + ' 실시 결과 보고' }; }
        if (state.mode === 'person') { var w = E().workerOf(state.workerId);
            return { kind: 'person', target: personTarget(state.workerId),
                     label: curYear() + '년 ' + (w ? w.name : '') + ' 안전보건교육 이수 확인서' }; }
        return { kind: 'summary', target: summaryTarget(), label: curYear() + '년 ' + viewOf(state.view).title };
    }

    /* ============================== 팝업 ============================== */
    function summaryBar() {
        var ys = yearOptions();
        var last = store().subs.filter(function (s) { return s.kind === 'summary'; }).slice(-1)[0];
        return '<div class="eduapv-bar">' +
            '<label class="eduapv-f"><span>대상 연도</span>' +
                '<select class="form-select" onchange="EDUAPV.setYear(this.value)">' +
                ys.map(function (y) { return '<option value="' + y + '"' + (y === curYear() ? ' selected' : '') + '>' + y + '년</option>'; }).join('') +
                '</select></label>' +
            '<label class="eduapv-f"><span>대상 부서</span>' +
                '<select class="form-select" onchange="EDUAPV.setDept(this.value)">' +
                '<option value=""' + (state.dept ? '' : ' selected') + '>전체 부서</option>' +
                depts().map(function (d) { return '<option value="' + esc(d.id) + '"' + (d.id === state.dept ? ' selected' : '') + '>' + esc(d.name) + '</option>'; }).join('') +
                '</select></label>' +
            '<span class="eduapv-last">' + (last
                ? '최근 상신 <b>' + esc(last.no) + '</b> · ' + chipMini(last.status) + ' · ' + esc(last.at)
                : '아직 상신 이력이 없습니다') + '</span>' +
        '</div>';
    }
    function chipMini(label) { return '<span class="chip-status chip-sm ' + V().toneOf(label) + '">' + esc(label) + '</span>'; }
    /* 교육별·개인별 컨텍스트 바 — 조회 조건 대신 대상 정보 + 현재 상태 */
    function contextBar() {
        var k = ctxKey();
        var st = statusOf(k.kind, k.target);
        var info;
        if (state.mode === 'course') { var c = E().courseOf(state.courseId);
            info = '<b>' + esc(c ? (c.desc || E().kindLabel(c.kind)) : '-') + '</b> · ' + esc(E().kindLabel(c ? c.kind : '')) + ' · ' + esc(E().courseDateTime(c) || ''); }
        else { var w = E().workerOf(state.workerId);
            info = '<b>' + esc(w ? w.name : '-') + '</b> · ' + esc(w ? E().deptName(w.deptId) : '') + ' · ' + esc(w ? E().catLabel(w.category) : ''); }
        return '<div class="eduapv-bar">' +
            '<span class="eduapv-ctx">' + (state.mode === 'course' ? '교육별 상신' : '개인별 상신') + ' · ' + info + '</span>' +
            '<span class="eduapv-last">현재 상태 ' + chipMini(st) + '</span>' +
        '</div>';
    }
    function lineEditor() {
        var p = persona(), L = line();
        var rows = L.map(function (s, i) {
            var val = s.name ? ((s.dept ? s.dept + ' · ' : '') + (s.role || '') + ' / ' + s.name) : '';
            return '<div class="eduapv-ln-row">' +
                '<span class="eduapv-ln-step">' + (i + 2) + '. ' + stepLabel(i, L.length) + '</span>' +
                '<div class="orgpick-field" id="eduapv-ln-' + i + '">' +
                    '<div class="eduapv-ln-pick">' +
                        '<input type="text" class="form-input" value="' + esc(val) + '" readonly ' +
                            'title="' + esc(val) + '" placeholder="조직도에서 결재자를 선택하세요" aria-label="' + stepLabel(i, L.length) + '자">' +
                        '<button type="button" class="btn btn-sm btn-outline" onclick="EDUAPV.pickOpen(' + i + ')">조직도</button>' +
                        (L.length > 1 ? '<button type="button" class="btn btn-sm btn-outline" onclick="EDUAPV.delStep(' + i + ')" aria-label="' + stepLabel(i, L.length) + ' 단계 삭제">삭제</button>' : '') +
                    '</div>' +
                '</div>' +
            '</div>';
        }).join('');
        return '<div class="eduapv-line">' +
            '<div class="eduapv-line-head">' +
                '<b>결재선</b>' +
                '<span class="pdf-note">법령이 결재권자를 정하지 않으므로(위임전결규칙 소관) 조직도에서 지정합니다 · 기본값 팀장 → 과장</span>' +
                '<span class="eduapv-line-btns">' +
                    '<button type="button" class="btn btn-sm btn-outline" onclick="EDUAPV.addStep()">단계 추가</button>' +
                    '<button type="button" class="btn btn-sm btn-outline" onclick="EDUAPV.resetLine()">기본값</button>' +
                '</span>' +
            '</div>' +
            '<div class="eduapv-ln-row">' +
                '<span class="eduapv-ln-step">1. 기안</span>' +
                '<span class="eduapv-ln-fixed">' + esc(p.name) + ' ' + esc(p.role) +
                    ' <span class="pdf-note">(' + esc(p.org) + ') · 현재 로그인 사용자</span></span>' +
            '</div>' + rows +
        '</div>';
    }
    function tabs() {
        return '<div class="sub-tabs eduapv-tabs">' + VIEWS.map(function (v) {
            return '<button type="button" class="sub-tab' + (v.id === state.view ? ' active' : '') +
                   '" onclick="EDUAPV.setView(\'' + v.id + '\')">' + esc(v.tab) + '</button>';
        }).join('') + '</div>' +
        '<p class="eduapv-use">' + viewOf(state.view).use +
        ' <span class="pdf-note">아래 미리보기 그대로 규격 기안문(PDF)이 생성됩니다.</span></p>';
    }
    function wrapHtml() {
        var topBar = state.mode === 'summary' ? summaryBar() : contextBar();
        var tabsHtml = state.mode === 'summary' ? tabs()
            : '<p class="eduapv-use">' + (state.mode === 'course'
                ? '이 교육 <b>1건의 실시 결과</b>(참석·이수·서명·증빙)를 문서로 상신합니다.'
                : '이 대상자 <b>1명의 교육 이수 내역·시간</b>을 확인서로 상신합니다.') +
              ' <span class="pdf-note">아래 미리보기 그대로 규격 기안문(PDF)이 생성됩니다.</span></p>';
        return topBar + lineEditor() + tabsHtml + '<div class="pdf-paper pdf-doc" id="eduapv-paper">' + docHtml() + '</div>';
    }
    function footNote() { return '결재선 <b>' + esc(lineText()) + '</b> · 온나라 호출기안 연계'; }
    function paint() {
        var wrap = document.getElementById('eduapv-wrap');
        if (!wrap) { openModalDoc(); return; }
        wrap.innerHTML = wrapHtml();
        var fn = document.getElementById('eduapv-footnote');
        if (fn) fn.innerHTML = footNote();
    }
    function titleFor() {
        if (state.mode === 'course') return '교육별 결재 상신 — 문서 미리보기';
        if (state.mode === 'person') return '개인별 결재 상신 — 문서 미리보기';
        return '총괄 결재 상신 — 문서 미리보기';
    }
    function openModalDoc() {
        V().openModal(titleFor(),
            '<div class="eduapv-wrap" id="eduapv-wrap">' + wrapHtml() + '</div>',
            '<span class="eduapv-foot-note" id="eduapv-footnote">' + footNote() + '</span>' +
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUAPV.submit()">온나라로 결재 상신</button>',
            { variant: 'wide', headHtml: '<button type="button" class="btn btn-sm btn-outline" onclick="EDUAPV.print()">PDF 저장 / 인쇄</button>' });
    }

    /* 진입점 */
    function openSummary() { state.mode = 'summary'; openModalDoc(); }
    function openCourse(courseId) { state.mode = 'course'; state.courseId = courseId || courseIdFromUrl(); openModalDoc(); }
    function openPerson(workerId) { state.mode = 'person'; state.workerId = workerId; openModalDoc(); }
    function courseIdFromUrl() {
        try { return new URLSearchParams(global.location.search).get('id'); } catch (e) { return null; }
    }

    function setView(v) { state.view = v; paint(); }
    function setYear(y) { state.year = y; paint(); }
    function setDept(d) { state.dept = d; paint(); }
    function print() { global.print(); }

    function submit() {
        var L = line();
        var blank = L.filter(function (s) { return !s.name; }).length;
        if (blank) { toast('결재선에 지정하지 않은 단계가 ' + blank + '건 있습니다 — 조직도에서 결재자를 고르세요'); return; }
        var k = ctxKey();
        var scopeTxt = state.mode === 'summary' ? deptLabel()
            : (state.mode === 'course' ? '교육 1건' : '대상자 1명');
        if (!global.confirm('아래 문서를 온나라 전자결재로 상신할까요?\n\n· 문서: ' + k.label +
            '\n· 대상 범위: ' + scopeTxt + '\n· 결재선: ' + lineText())) return;
        var no = nextNo();
        pushSub({ kind: k.kind, target: k.target, no: no, at: today(), status: ST_SUBMITTED, label: k.label,
                  line: lineText(), view: state.view, year: curYear(), dept: state.dept || '',
                  courseId: state.courseId || '', workerId: state.workerId || '' });
        V().closeModal();
        sentPopup(k.label, no);
        refreshAll();
        toast('결재 상신 완료 · ' + no);
    }
    function sentPopup(label, no) {
        V().openModal('온나라 결재 요청',
            '<div class="eduapv-sent">' +
                '<p class="t">온나라로 결재 요청을 보냈습니다</p>' +
                '<p class="d">' + esc(label) + '<br>문서번호 <b>' + esc(no) + '</b><br>결재선: ' + esc(lineText()) + '</p>' +
                '<p class="d">결재 완료 시 온나라가 부여한 <b>문서등록번호·결재일</b>이 회신 등록되어 교육 이력과 연결됩니다. ' +
                '<span class="pdf-note">(프로토타입 — 연계 시뮬레이션)</span></p>' +
            '</div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">확인</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUAPV.reopenLast()">결재 상태 보기</button>');
    }
    function reopenLast() { var k = ctxKey(); openStatus(k.kind, k.target); }

    /* ==================== 결재 상태 팝업 (목록 칩 클릭 · 시연 회신) ==================== */
    function openStatusCtx(kind, courseId, workerId) {
        if (kind === 'course') { state.mode = 'course'; state.courseId = courseId; openStatus('course', courseTarget(courseId)); }
        else if (kind === 'person') { state.mode = 'person'; state.workerId = workerId; openStatus('person', personTarget(workerId)); }
        else { openStatus('summary', summaryTarget()); }
    }
    function openStatus(kind, target) {
        var sub = latestSub(kind, target);
        var reopenCall = kind === 'course' ? "EDUAPV.openCourse('" + esc(sub ? sub.courseId : state.courseId) + "')"
            : kind === 'person' ? "EDUAPV.openPerson('" + esc(sub ? sub.workerId : state.workerId) + "')"
            : 'EDUAPV.openSummary()';
        if (!sub) {
            V().openModal('결재 상태 — 미상신',
                '<div class="eduapv-status">' +
                    '<p class="eduapv-status-lead">아직 이 대상으로 상신한 문서가 없습니다. ' + chipMini(ST_NONE) + '</p>' +
                    '<p class="pdf-note-p">아래에서 결재 문서를 만들어 온나라로 상신하세요.</p>' +
                '</div>',
                '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
                '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal();' + reopenCall + '">결재 문서 만들기</button>');
            return;
        }
        var logRows = (sub.log || []).map(function (l) {
            return '<div class="edu-hist-row"><span class="edu-hist-at">' + esc(l.at) + '</span>' +
                '<span class="edu-hist-type">' + esc(l.st) + '</span>' +
                '<span class="edu-hist-body">' + statusMemo(l.st) + '</span></div>';
        }).join('');
        var infoTable = '<table class="table-figma table-doc pdf-meta"><tbody>' +
            '<tr><td class="k">문서</td><td>' + esc(sub.label) + '</td></tr>' +
            '<tr><td class="k">문서번호</td><td><b>' + esc(sub.no) + '</b></td></tr>' +
            '<tr><td class="k">상신일</td><td>' + esc(sub.at) + '</td></tr>' +
            '<tr><td class="k">결재선</td><td>' + esc(sub.line) + '</td></tr>' +
            '<tr><td class="k">현재 상태</td><td>' + chipMini(sub.status) + '</td></tr>' +
        '</tbody></table>';
        /* 시연 회신 컨트롤 — 온나라 결재 결과 회신 시뮬레이션 */
        var demo = '';
        if (sub.status === ST_SUBMITTED) {
            demo = '<button type="button" class="btn btn-outline btn-sm" style="border-color:var(--status-danger-border);color:var(--status-danger-fg);" onclick="EDUAPV.advance(\'' + kind + '\',\'' + esc(target) + '\',\'' + ST_REJECT + '\')">반려 처리</button>' +
                   '<button type="button" class="btn btn-primary btn-sm" onclick="EDUAPV.advance(\'' + kind + '\',\'' + esc(target) + '\',\'' + ST_DONE + '\')">결재 완료 처리</button>';
        } else {
            demo = '<button type="button" class="btn btn-primary btn-sm" onclick="DYV2.closeModal();' + reopenCall + '">재상신 (문서 열기)</button>';
        }
        V().openModal('결재 상태 · ' + esc(sub.no),
            '<div class="eduapv-status">' + infoTable +
                '<div class="eduapv-status-note">온나라 전자결재 진행 상태입니다. 실제 연계 시 결재 완료·반려는 온나라에서 회신됩니다. ' +
                '<span class="pdf-note">아래 버튼은 프로토타입 시연용 회신입니다.</span></div>' +
                '<div class="edu-card-title" style="margin-top:14px;">상태 이력</div>' +
                '<div class="edu-hist">' + logRows + '</div>' +
            '</div>',
            '<button type="button" class="btn btn-outline" onclick="DYV2.closeModal();' + reopenCall + '">문서 다시 보기</button>' +
            '<span style="flex:1;"></span>' + demo);
    }
    function statusMemo(st) {
        if (st === ST_SUBMITTED) return '온나라로 결재 상신';
        if (st === ST_DONE) return '결재 완료 (회신)';
        if (st === ST_REJECT) return '반려 (회신)';
        return '';
    }
    function advance(kind, target, st) {
        advanceSub(kind, target, st);
        V().closeModal();
        refreshAll();
        toast('결재 상태: ' + st + (st === ST_DONE ? ' · 문서등록번호 회신 등록(목업)' : ''));
    }

    /* ==================== 목록 상태 칩 · 행 컨트롤 ==================== */
    /* 교육별 상태 칩/버튼 — 미상신이면 '결재 상신' 액션, 아니면 상태 칩(→ 상태 팝업) */
    function courseControl(courseId) {
        var st = statusOf('course', courseTarget(courseId));
        if (st === ST_NONE) {
            return '<button type="button" class="btn btn-outline btn-sm eduapv-newbtn" onclick="EDUAPV.openCourse(\'' + esc(courseId) + '\')" title="이 교육 결재 상신">' + submitGlyph() + ' 결재 상신</button>';
        }
        return '<button type="button" class="chip-status chip-sm ' + V().toneOf(st) + ' eduapv-chip" onclick="EDUAPV.status(\'course\',\'' + esc(courseId) + '\')" title="결재 상태: ' + esc(st) + '">' + esc(st) + '</button>';
    }
    function personControl(workerId) {
        var st = statusOf('person', personTarget(workerId));
        if (st === ST_NONE) {
            return '<button type="button" class="btn btn-outline btn-sm eduapv-newbtn" onclick="EDUAPV.openPerson(\'' + esc(workerId) + '\')" title="개인 결재 상신">' + submitGlyph() + ' 개인 상신</button>';
        }
        return '<button type="button" class="chip-status chip-sm ' + V().toneOf(st) + ' eduapv-chip" onclick="EDUAPV.status(\'person\',null,\'' + esc(workerId) + '\')" title="결재 상태: ' + esc(st) + '">' + esc(st) + '</button>';
    }
    function submitGlyph() {
        return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
    }

    /* ===================== 버튼 주입 (우측 최상단) ===================== */
    function injectButton() {
        if (document.getElementById('eduapv-btn')) return true;
        var head = document.querySelector('main .dy-page-title');
        if (!head) return false;
        var isCourse = state.mode === 'course';
        var btn = document.createElement('button');
        btn.id = 'eduapv-btn';
        btn.type = 'button';
        btn.className = 'btn btn-primary btn-sm page-head-action';
        btn.innerHTML =
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>' +
            '<line x1="9" y1="14" x2="15" y2="14"/><line x1="9" y1="18" x2="13" y2="18"/></svg>' +
            '<span>' + (isCourse ? '이 교육 결재 상신' : '총괄 결재 상신') + '</span>';
        btn.addEventListener('click', function () { if (isCourse) openCourse(); else openSummary(); });
        head.appendChild(btn);
        return true;
    }

    var _refreshed = [];
    function registerRefresh(fn) { if (typeof fn === 'function' && _refreshed.indexOf(fn) < 0) _refreshed.push(fn); }
    function refreshAll() { _refreshed.forEach(function (fn) { try { fn(); } catch (e) {} }); }

    /* 각 edu 화면이 모듈 init 후 호출. opts.view 기본 서식 · opts.mode 'course' 상세 진입 · opts.refresh 재렌더 */
    function boot(opts) {
        opts = opts || {};
        if (opts.view) state.view = opts.view;
        if (opts.mode) state.mode = opts.mode;
        if (opts.refresh) registerRefresh(opts.refresh);
        if (!injectButton()) global.setTimeout(injectButton, 0);
    }

    global.EDUAPV = {
        boot: boot, registerRefresh: registerRefresh,
        openSummary: openSummary, openCourse: openCourse, openPerson: openPerson,
        setView: setView, setYear: setYear, setDept: setDept, print: print, submit: submit,
        reopenLast: reopenLast, advance: advance,
        /* 상태 팝업 진입 — status(kind, courseId, workerId) */
        status: openStatusCtx, openStatus: openStatus,
        /* 목록 상태 칩/버튼 (화면 렌더러가 셀에 삽입) */
        courseControl: courseControl, personControl: personControl,
        statusOf: statusOf,
        /* 결재선 편집 */
        pickOpen: pickOpen, pickApprover: pickApprover, addStep: addStep, delStep: delStep, resetLine: resetLine, line: line,
        /* 호환 (구 API) */
        open: openSummary
    };
})(window);
