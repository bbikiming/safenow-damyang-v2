/* =====================================================================
   edu-approval.js · 안전보건교육 온나라 결재 상신 (EDUAPV)
   ---------------------------------------------------------------------
   근거: docs/planning/기획-안전보건교육-온나라결재상신-v1.md
   · 전 edu-* 화면 우측 최상단(.dy-page-title 우측)에 [온나라 결재 상신] 버튼 주입.
   · 클릭 → 결재 문서 미리보기 팝업. 인력평가(evl-eval)의 결재 문서 미리보기와
     같은 패턴이되, 자작 오버레이(.ev-modal-backdrop) 대신 공용 모달의
     'wide' 변형(DYV2.openModal + variant:'wide')만 사용한다 (CLAUDE.md §1).
   · 문서 양식 컨펌용 프로토타입 — 한 팝업 안에서 3종 서식을 탭으로 전환한다.
       ① 교육 종류별 결재 목록 문서   (kind)   — 무엇을 언제 몇 시간 실시했는가
       ② 개인별 교육 이수 현황 결재 문서 (person) — 누가 몇 시간 이수/미달인가
       ③ 통합 결재 문서              (all)    — ①+② 를 한 건으로 상신
   · 문서 데이터는 전부 DYEDU(js/edu-data.js) 파생 — 자체 시드를 만들지 않는다.
   · 결재선은 고정하지 않는다 — 법령은 결재권자를 정하지 않고 지자체 위임전결규칙 소관이므로,
     기본값(기안자 부서의 팀장 → 과장)만 조직도에서 파생하고 ORGPICK 으로 바꿀 수 있게 한다.
   · 상신 이력·결재선은 sessionStorage(시연용, dy-edu-approval-v1 / dy-edu-apprline-v1)에만 남긴다.
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

    var AKEY = 'dy-edu-approval-v1';   /* 상신 이력(시연용) */
    var LKEY = 'dy-edu-apprline-v1';   /* 결재선 (화면 간 유지) */
    var MAX_STEP = 3;                  /* 기안 외 결재 단계 최대 3(검토 2 + 결재 1) */

    /* 문서 3종 — 라벨·부제·용도. 탭 순서가 곧 결재 서식 번호다. */
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

    var state = { view: 'kind', year: '', dept: '', open: false, line: null, editIdx: -1 };

    /* =========================== 결재선 ===========================
     * 법령은 결재권자를 정하지 않는다 — 지자체 위임전결규칙 소관이므로 고정하지 않고
     * 조직도(DYV2.ORG)에서 고르게 한다. 기본값은 기안자 소속 부서의 팀장 → 과장(부서장).
     * 마지막 단계가 '결재', 그 앞은 모두 '검토'다(행정 결재 관행 — 검토 N + 최종 결재 1).
     * 근거: docs/planning/기획-안전보건교육-온나라결재상신-v1.md §5
     * ============================================================= */
    function stepLabel(i, len) { return i === len - 1 ? '결재' : '검토'; }
    /* 조직도에서 기안자 소속 부서의 팀장·부서장을 찾아 기본 결재선을 만든다 */
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
    function saveLine() {
        try { global.sessionStorage.setItem(LKEY, JSON.stringify(state.line || [])); } catch (e) {}
    }
    /* 결재란·확인 문구가 함께 쓰는 한 줄 표기 — '기안 박안전 → 검토 김중대 → 결재 홍길동' */
    function lineText() {
        var p = persona(), L = line();
        return ['기안 ' + p.name].concat(L.map(function (s, i) {
            return stepLabel(i, L.length) + ' ' + (s.name || '(미지정)');
        })).join(' → ');
    }
    /* ORGPICK 'member' 반환값 '부서 · 역할 / 이름' 파싱 */
    function parseMember(value) {
        var s = String(value || '');
        var slash = s.lastIndexOf(' / ');
        var name = slash >= 0 ? s.slice(slash + 3) : s;
        var left = slash >= 0 ? s.slice(0, slash) : '';
        var dot = left.indexOf(' · ');
        return {
            dept: dot >= 0 ? left.slice(0, dot) : '',
            role: dot >= 0 ? left.slice(dot + 3) : left,
            name: name
        };
    }
    function pickOpen(i) {
        state.editIdx = i;
        global.ORGPICK.toggle('eduapv-ln-' + i, 'member', 'EDUAPV.pickApprover');
    }
    function pickApprover(value) {
        var i = state.editIdx;
        var L = line();
        if (i < 0 || !L[i]) return;
        L[i] = parseMember(value);
        saveLine(); paint();
    }
    function addStep() {
        var L = line();
        if (L.length >= MAX_STEP) { toast('결재 단계는 최대 ' + MAX_STEP + '단계까지 지정할 수 있습니다'); return; }
        /* 새 단계는 최종 결재자 앞에 검토로 끼운다 */
        L.splice(L.length - 1, 0, { dept: '', role: '검토자', name: '' });
        saveLine(); paint();
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

    /* 교육이 걸쳐 있는 부서 — 자체·채용시는 deptId, 집합은 신청(enroll) 부서 */
    function courseDepts(c) {
        if (c.deptId) return [c.deptId];
        var map = {};
        E().enrolls(c.id).forEach(function (e) { if (e.deptId) map[e.deptId] = true; });
        return Object.keys(map);
    }
    /* 부서 범위를 걸었으면 그 부서만 남긴다 — 문서에 범위 밖 부서가 섞이지 않도록 */
    function courseDeptsInScope(c) {
        var ds = courseDepts(c);
        return state.dept ? ds.filter(function (d) { return d === state.dept; }) : ds;
    }
    /* 대상 연도 + 부서 범위 안의 교육 — 문서 ①·③ 의 모집단 */
    function scopedCourses() {
        var y = curYear();
        return E().courses().filter(function (c) {
            if (String(c.date || '').slice(0, 4) !== y) return false;
            if (!state.dept) return true;
            return courseDepts(c).indexOf(state.dept) >= 0;
        }).sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    }
    /* 교육 1건의 이수 인원 — 부서 범위를 걸면 그 부서 인원만 센다 */
    function courseDone(c) {
        var dept = state.dept;
        return E().records().filter(function (r) {
            if (r.courseId !== c.id) return false;
            if (!dept) return true;
            var w = E().workerOf(r.workerId);
            return !!w && w.deptId === dept;
        }).length;
    }
    /* 부서 범위 안의 대상자 — 문서 ②·③ 의 모집단 */
    function scopedWorkers() {
        return E().workers().filter(function (w) { return !state.dept || w.deptId === state.dept; })
            .sort(function (a, b) {
                var d = E().deptName(a.deptId).localeCompare(E().deptName(b.deptId));
                return d !== 0 ? d : String(a.name).localeCompare(String(b.name));
            });
    }
    function statusRows() {
        return scopedWorkers().map(function (w) { return E().statusRow(w, today()); });
    }
    var KIND_ORDER = ['REG_GROUP', 'REG_SELF', 'HIRE', 'ETC', 'SUP_REG', 'SUP_ETC'];
    /* 교육 종류별 묶음 — 문서 ①·③ 의 집계·상세가 같은 순서를 공유한다 */
    function byKind() {
        var list = scopedCourses(), map = {};
        list.forEach(function (c) { (map[c.kind] = map[c.kind] || []).push(c); });
        return KIND_ORDER.filter(function (k) { return map[k]; }).map(function (k) {
            var arr = map[k];
            return {
                kind: k, label: E().kindLabel(k), courses: arr,
                hours: Math.round(arr.reduce(function (n, c) { return n + (c.hours || 0); }, 0) * 10) / 10,
                done: arr.reduce(function (n, c) { return n + courseDone(c); }, 0),
                closed: arr.filter(function (c) { return c.status === 'DONE'; }).length
            };
        });
    }

    /* ============================ 문서 조각 ============================ */
    function box(tone, value, label) {
        return '<div class="pdf-kpi ' + tone + '"><b>' + value + '</b><span>' + label + '</span></div>';
    }
    function kpis(list) { return '<div class="pdf-kpis">' + list.map(function (k) { return box(k[0], k[1], k[2]); }).join('') + '</div>'; }
    function sec(no, title) { return '<div class="pdf-sec">' + no + '. ' + esc(title) + '</div>'; }
    function subsec(text) { return '<div class="pdf-subsec">' + text + '</div>'; }
    function chip(label) { return '<span class="chip-status chip-sm ' + V().toneOf(label) + '">' + esc(label) + '</span>'; }
    function dash() { return '<span class="pdf-dash">-</span>'; }

    /* 문서용 표 — 표준 .table-figma 에 .table-doc modifier(격자 괘선·조밀) */
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

    /* 기안문 머리 — 기관 표시 + 결재란. 결재란 칸은 편집한 결재선을 그대로 따른다. */
    function docTop() {
        var p = persona();
        var L = line();
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
    function docTitle(v) {
        return '<h2 class="pdf-title">' + curYear() + '년 ' + esc(v.title) + '</h2>' +
               '<p class="pdf-doc-sub">대상기간 ' + curYear() + '.01.01 ~ ' + curYear() + '.12.31 · 기준일 ' + today() + ' · ' + esc(deptLabel()) + '</p>';
    }
    function docMeta() {
        var p = persona();
        var last = lastSubmit(state.view);
        var rows = [
            ['문서번호', last ? esc(last.no) + ' <span class="pdf-note">(' + esc(last.at) + " 상신)</span>" : '<span class="pdf-note">상신 시 온나라에서 부여</span>'],
            ['기안일자', today()],
            ['기안자', esc(p.name) + ' ' + esc(p.role) + ' <span class="pdf-note">(' + esc(p.org) + ')</span>'],
            ['결재선', esc(lineText()) + ' <span class="pdf-note">· 담양군 사무 위임·전결 규칙에 따름</span>'],
            ['대상 범위', esc(deptLabel()) + ' <span class="pdf-note">· 근로자 명단(인사연동·직접등록·엑셀업로드) 기준</span>'],
            ['근거 법령', '산업안전보건법 §29(근로자 안전보건교육) · 같은 법 시행규칙 §26 [별표 4] 교육시간<br>중대재해처벌법 §4①1호 · 같은 법 시행령 §4(안전보건 관리체계의 구축 및 이행)']
        ];
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

    /* ====================== ① 교육 종류별 목록 문서 ====================== */
    function docKind() {
        var groups = byKind();
        var all = scopedCourses();
        var hours = Math.round(all.reduce(function (n, c) { return n + (c.hours || 0); }, 0) * 10) / 10;
        var done = all.reduce(function (n, c) { return n + courseDone(c); }, 0);
        var deptMap = {};
        all.forEach(function (c) { courseDeptsInScope(c).forEach(function (d) { deptMap[d] = true; }); });
        /* 부서를 지정한 문서에서 '참여 부서 1개'는 정보가 없으므로 그 부서의 대상 인원으로 바꾼다 */
        var lastKpi = state.dept
            ? ['neutral', scopedWorkers().length + '명', '부서 대상 인원']
            : ['neutral', Object.keys(deptMap).length + '개', '참여 부서'];

        var sumRows = groups.map(function (g) {
            return [esc(g.label), g.courses.length + '건', g.hours + 'h', g.done + '명',
                    g.closed + ' / ' + g.courses.length];
        });
        if (groups.length) {
            sumRows.push({ tone: 'pdf-total', cells: ['합계', all.length + '건', hours + 'h', done + '명',
                groups.reduce(function (n, g) { return n + g.closed; }, 0) + ' / ' + all.length] });
        }

        var detail = groups.map(function (g) {
            var rows = g.courses.map(function (c, i) {
                var ds = courseDeptsInScope(c).map(function (d) { return E().deptName(d); });
                return [
                    String(i + 1),
                    E().courseDateTime(c) || dash(),
                    '<span class="pdf-strong">' + esc(c.desc || E().kindLabel(c.kind)) + '</span>' +
                        (c.etcType ? ' <span class="pdf-note">(' + esc(c.etcType) + ')</span>' : ''),
                    (c.hours || 0) + 'h',
                    esc(c.instructor || '-'),
                    esc(c.place || '-'),
                    ds.length ? esc(ds.length > 3 ? ds.slice(0, 3).join(', ') + ' 외 ' + (ds.length - 3) : ds.join(', ')) : dash(),
                    courseDone(c) + '명',
                    chip(c.status === 'DONE' ? '완료' : '진행중')
                ];
            });
            return subsec('▸ ' + esc(g.label) + ' <span class="pdf-note">' + g.courses.length + '건 · ' + g.hours + 'h · 이수 연인원 ' + g.done + '명</span>') +
                tbl([{ t: '연번', a: 'c', w: '38px' }, { t: '교육 일시', a: 'c', w: '128px' }, { t: '교육명 (내용)', a: 'l' },
                     { t: '시간', a: 'c', w: '46px' }, { t: '강사', a: 'l', w: '108px' }, { t: '장소', a: 'l', w: '96px' },
                     { t: '대상 부서', a: 'l', w: '132px' }, { t: '이수', a: 'c', w: '52px' }, { t: '상태', a: 'c', w: '58px' }], rows);
        }).join('');

        return docTop() + docTitle(viewOf('kind')) + docMeta() +
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

    /* ==================== ② 개인별 이수 현황 문서 ==================== */
    function personSummaryRows() {
        return E().deptSummary(today(), function (w) { return !state.dept || w.deptId === state.dept; })
            .map(function (d) {
                var short = d.total - d.done;
                return [esc(d.name), d.total + '명', d.done + '명',
                        (short ? '<span class="pdf-bad">' + short + '명</span>' : '0명'),
                        d.pct + '%'];
            });
    }
    function personDetailRows(rows) {
        return rows.map(function (s, i) {
            var w = s.worker;
            return {
                tone: s.complete ? '' : 'pdf-warn',
                cells: [
                    String(i + 1), esc(E().deptName(w.deptId)),
                    '<span class="pdf-strong">' + esc(w.name) + '</span>',
                    esc(E().catLabel(w.category)), esc(E().empLabel(w.empType)), esc(w.hireDate || '-'),
                    esc(s.cycle.start + ' ~ ' + s.cycle.end),
                    s.need + 'h', s.done + 'h',
                    (s.short ? '<span class="pdf-bad">' + s.short + 'h</span>' : dash()),
                    chip(s.complete ? '완료' : '미이수')
                ]
            };
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
        return docTop() + docTitle(viewOf('person')) + docMeta() +
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

    /* ========================= ③ 통합 결재 문서 ========================= */
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
        if (groups.length) {
            sumRows.push({ tone: 'pdf-total', cells: ['합계', all.length + '건', hours + 'h', doneCnt + '명',
                groups.reduce(function (n, g) { return n + g.closed; }, 0) + ' / ' + all.length] });
        }
        var courseRows = all.map(function (c, i) {
            return [String(i + 1), esc(E().kindLabel(c.kind)), E().courseDateTime(c) || dash(),
                '<span class="pdf-strong">' + esc(c.desc || E().kindLabel(c.kind)) + '</span>',
                (c.hours || 0) + 'h', esc(c.instructor || '-'), courseDone(c) + '명',
                chip(c.status === 'DONE' ? '완료' : '진행중')];
        });

        return docTop() + docTitle(viewOf('all')) + docMeta() +
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

    function docHtml() {
        if (state.view === 'person') return docPerson();
        if (state.view === 'all') return docAll();
        return docKind();
    }

    /* ============================ 상신 이력 ============================ */
    function history() {
        try { return JSON.parse(global.sessionStorage.getItem(AKEY) || '[]'); } catch (e) { return []; }
    }
    function lastSubmit(view) {
        var h = history().filter(function (x) { return x.view === view; });
        return h.length ? h[h.length - 1] : null;
    }
    function pushSubmit(rec) {
        var h = history(); h.push(rec);
        try { global.sessionStorage.setItem(AKEY, JSON.stringify(h)); } catch (e) {}
    }

    /* ============================== 팝업 ============================== */
    function bar() {
        var ys = yearOptions();
        var last = history().length ? history()[history().length - 1] : null;
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
                ? '최근 상신 <b>' + esc(last.no) + '</b> · ' + esc(viewOf(last.view).tab.replace(/^[①②③]\s*/, '')) + ' · ' + esc(last.at)
                : '아직 상신 이력이 없습니다') + '</span>' +
        '</div>';
    }
    /* 결재선 편집 — 조직도(ORGPICK 'member')로만 고른다. 새 select 를 만들지 않는다. */
    function lineEditor() {
        var p = persona();
        var L = line();
        var rows = L.map(function (s, i) {
            var val = s.name ? ((s.dept ? s.dept + ' · ' : '') + (s.role || '') + ' / ' + s.name) : '';
            return '<div class="eduapv-ln-row">' +
                '<span class="eduapv-ln-step">' + (i + 2) + '. ' + stepLabel(i, L.length) + '</span>' +
                '<div class="orgpick-field" id="eduapv-ln-' + i + '">' +
                    '<div class="eduapv-ln-pick">' +
                        '<input type="text" class="form-input" value="' + esc(val) + '" readonly ' +
                            'title="' + esc(val) + '" placeholder="조직도에서 결재자를 선택하세요" ' +
                            'aria-label="' + stepLabel(i, L.length) + '자">' +
                        '<button type="button" class="btn btn-sm btn-outline" onclick="EDUAPV.pickOpen(' + i + ')">조직도</button>' +
                        (L.length > 1
                            ? '<button type="button" class="btn btn-sm btn-outline" onclick="EDUAPV.delStep(' + i + ')" aria-label="' + stepLabel(i, L.length) + ' 단계 삭제">삭제</button>'
                            : '') +
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
        return bar() + lineEditor() + tabs() + '<div class="pdf-paper pdf-doc" id="eduapv-paper">' + docHtml() + '</div>';
    }
    function footNote() { return '결재선 <b>' + esc(lineText()) + '</b> · 온나라 호출기안 연계'; }
    function paint() {
        var wrap = document.getElementById('eduapv-wrap');
        if (!wrap) { open(); return; }
        wrap.innerHTML = wrapHtml();
        /* 푸터는 모달 본문(#eduapv-wrap) 밖이라 함께 갱신해야 결재선 편집이 즉시 반영된다 */
        var fn = document.getElementById('eduapv-footnote');
        if (fn) fn.innerHTML = footNote();
    }

    function open() {
        state.open = true;
        V().openModal('안전보건교육 — 온나라 결재 문서 미리보기',
            '<div class="eduapv-wrap" id="eduapv-wrap">' + wrapHtml() + '</div>',
            '<span class="eduapv-foot-note" id="eduapv-footnote">' + footNote() + '</span>' +
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUAPV.submit()">온나라로 결재 상신</button>',
            {
                variant: 'wide',
                headHtml: '<button type="button" class="btn btn-sm btn-outline" onclick="EDUAPV.print()">PDF 저장 / 인쇄</button>'
            });
    }
    function setView(v) { state.view = v; paint(); }
    function setYear(y) { state.year = y; paint(); }
    function setDept(d) { state.dept = d; paint(); }
    function print() { global.print(); }

    function submit() {
        var v = viewOf(state.view);
        var label = curYear() + '년 ' + v.title;
        var L = line();
        var blank = L.filter(function (s) { return !s.name; }).length;
        if (blank) { toast('결재선에 지정하지 않은 단계가 ' + blank + '건 있습니다 — 조직도에서 결재자를 고르세요'); return; }
        if (!global.confirm('아래 문서를 온나라 전자결재로 상신할까요?\n\n· 문서: ' + label +
            '\n· 대상 범위: ' + deptLabel() + '\n· 결재선: ' + lineText())) return;
        var no = '재난안전과-' + String(2600 + history().length * 7 + VIEWS.indexOf(v) + 1);
        pushSubmit({ view: v.id, no: no, at: today(), title: label, dept: state.dept || '', year: curYear(), line: lineText() });
        V().closeModal();
        V().openModal('온나라 결재 요청',
            '<div class="eduapv-sent">' +
                '<p class="t">온나라로 결재 요청을 보냈습니다</p>' +
                '<p class="d">' + esc(label) + '<br>문서번호 <b>' + esc(no) + '</b><br>결재선: ' + esc(lineText()) + '</p>' +
                '<p class="d">결재 완료 시 온나라가 부여한 <b>문서등록번호·결재일</b>이 회신 등록되어 교육 이력과 연결됩니다. ' +
                '<span class="pdf-note">(프로토타입 — 연계 시뮬레이션)</span></p>' +
            '</div>',
            '<button type="button" class="btn btn-secondary" onclick="EDUAPV.open()">문서 다시 보기</button>' +
            '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal()">확인</button>');
        toast('결재 상신 완료 · ' + no);
    }

    /* ===================== 버튼 주입 (우측 최상단) ===================== */
    function injectButton() {
        if (document.getElementById('eduapv-btn')) return true;
        var head = document.querySelector('main .dy-page-title');
        if (!head) return false;
        var btn = document.createElement('button');
        btn.id = 'eduapv-btn';
        btn.type = 'button';
        btn.className = 'btn btn-primary btn-sm page-head-action';
        btn.innerHTML =
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>' +
            '<line x1="9" y1="14" x2="15" y2="14"/><line x1="9" y1="18" x2="13" y2="18"/></svg>' +
            '<span>온나라 결재 상신</span>';
        btn.addEventListener('click', open);
        head.appendChild(btn);
        return true;
    }

    /* 각 edu 화면이 모듈 init 후 호출한다. opts.view — 화면 성격에 맞는 기본 서식. */
    function boot(opts) {
        opts = opts || {};
        if (opts.view) state.view = opts.view;
        if (!injectButton()) global.setTimeout(injectButton, 0);
    }

    global.EDUAPV = {
        boot: boot, open: open, setView: setView, setYear: setYear, setDept: setDept,
        print: print, submit: submit, history: history,
        /* 결재선 편집 */
        pickOpen: pickOpen, pickApprover: pickApprover,
        addStep: addStep, delStep: delStep, resetLine: resetLine, line: line
    };
})(window);
