/* =========================================================================
 * 업무 관리(신) — 파생 전용 공유 계층 (전역 DYCMP)
 *   기획: docs/planning/기획-업무관리-신버전-이행관리-문서목록-v1.md §3
 *   구조 SoT: docs/planning/자료-업무관리-이행관리-와이어프레임-v1.html
 *
 *   [저장소를 만들지 않는다 (MUST)]
 *   이 모듈은 읽고 **파생만** 한다. 쓰기(상태 전이·문서 등록·비해당)는 전부
 *   DYDOCS 로 위임한다. 여기에 스토어를 하나 더 두면 "'이행'을 말하는 축"이
 *   또 늘어난다(CLAUDE.md §5 — 축 셋을 합치지 말 것).
 *
 *   [무엇을 파생하나]
 *     · levelOf(stage)  계층 L1/L2/L3 — 우리 데이터에 필드가 없어 target 문자열 파생
 *     · cycleOf(stage)  주기 코드·연간 필요 회차 — opCycle 우선, 없으면 legalCycle
 *     · judge(stage,y)  표시 전용 이행상태 — DYDOCS 상태 + 문서 수 + DYV2.today()
 *     · axesOf(item)    누락 점검 축(중대산업/중대시민/산안법/개별법) — lawBases 파생
 *
 *   [판정은 여기 한 곳뿐]
 *   화면이 target·주기 문자열을 직접 검사하지 않는다. 두 화면이 각자 검사하면
 *   같은 단계가 화면마다 다른 계층·다른 상태로 보인다.
 *
 *   로드 순서: common.js → doc-taxonomy-data.js → doc-history-data.js →
 *              sets-data-v2.js → doc-progress.js → cmp-core.js → 화면 모듈
 * ========================================================================= */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYDOCS; };
    var T = function () { return global.DYDOCT || { ITEMS: [], STAGES: [] }; };

    /* =========================================================================
     * 1. 계층 파생 (§3-1)
     * -------------------------------------------------------------------------
     * 판정 순서가 규칙의 일부다 — 순서를 바꾸면 '재난안전과 주관'인 시설 단계가
     * L3 으로 내려간다. 4번(그 밖)은 L2 로 수렴하되 derived 로 표시해 화면이
     * "문자열 파생 추정"임을 상시 캡션으로 밝힌다.
     * ========================================================================= */
    /* note  = 접히지 않는 한 줄(계층 탭 아래 상시 노출) — 짧게 유지한다.
       note2 = 접히는 본문에 들어가는 나머지 설명 */
    var LEVELS = [
        { id: 'L1', label: '군 단위', short: '군',
          note: '담양군 전체에서 1회 수행 — 주체는 군수·전담조직(재난안전과)입니다.',
          note2: '부서 담당자에게는 조회 전용으로 보이고 부서 이행률 분모에서 제외됩니다.' },
        { id: 'L2', label: '부서 단위', short: '부서',
          note: '과·사업소·읍면이 각각 수행합니다.',
          note2: '부서 담당자는 자기 부서가 기본 조회 조건으로 걸리고(제한이 아니라 프리셋입니다), 군수·전담조직은 전 부서를 봅니다. ' +
                 '부서 귀속 자료가 아직 없어(원장이 재난안전과 문서다) 부서별 이행 판정은 «자료 미취합»으로 둡니다.' },
        { id: 'L3', label: '관리대상 단위', short: '시설',
          note: '시설·공사 건별로 수행해 세 계층 중 이행량이 가장 큽니다.',
          note2: '승강기·어린이놀이시설 자체점검은 이미 외부 시스템(승강기안전종합정보망 등)에 등록되므로 이 시스템은 결과 보고 문서를 관리합니다 — ' +
                 '회차 전수 관리는 Phase 2 입니다. 시설↔단계 매핑과 이행 칩은 업무단계 단위 판정이며 시설 건별 판정은 자료 미취합입니다.' },
    ];
    var RE_L1 = /(군\s*전체|관리주체\s*1단계|재난안전과\(전담조직\)|재난안전과\s*주관)/;
    var RE_L3 = /(시설|승강기|놀이시설|공중이용시설)/;
    var RE_L2 = /(전\s*부서|각\s*부서|전체\s*부서|현업종사자|취급\s*부서|배치\s*부서|발주|계약부서|민원응대)/;

    var _lv = null;
    function levelIndex() {
        if (_lv) return _lv;
        _lv = {};
        T().STAGES.forEach(function (s) {
            var t = String(s.target || '');
            if (RE_L1.test(t)) { _lv[s.id] = { level: 'L1', derived: false, by: 'target' }; return; }
            if (RE_L3.test(t)) { _lv[s.id] = { level: 'L3', derived: false, by: 'target' }; return; }
            /* 이행항목 id 접두 FAC-* 는 시설 축이지만 target 에 '시설'이 없는 건이 있다
               (재해영향평가 협의 등) — 접두로 걸린 건은 derived 로 표시한다 */
            if (String(s.itemId || '').indexOf('FAC-') === 0) { _lv[s.id] = { level: 'L3', derived: true, by: 'itemId' }; return; }
            if (RE_L2.test(t)) { _lv[s.id] = { level: 'L2', derived: false, by: 'target' }; return; }
            _lv[s.id] = { level: 'L2', derived: true, by: 'fallback' };
        });
        return _lv;
    }
    function levelOf(stage) {
        var id = stage && stage.id ? stage.id : stage;
        return levelIndex()[id] || { level: 'L2', derived: true, by: 'unknown' };
    }
    function stagesOfLevel(level) {
        return T().STAGES.filter(function (s) { return levelOf(s).level === level; });
    }
    /* 탭 건수는 런타임 파생이다 — 와이어프레임의 80/58/39 는 예시 수치다(§3-1) */
    function levelCounts() {
        /* derived 를 한 덩어리로 세면 캡션이 "26개는 문구로 못 가렸다"가 되는데,
           그중 15개는 이행항목 번호(FAC-*)라는 **규칙**으로 가린 것이지 폴백이 아니다.
           두 수를 나눠 두어 화면이 정확히 말하게 한다. */
        var c = { L1: 0, L2: 0, L3: 0, derived: 0, byItemId: 0, fallback: 0 };
        T().STAGES.forEach(function (s) {
            var l = levelOf(s);
            c[l.level]++;
            if (l.derived) c.derived++;
            if (l.by === 'itemId') c.byItemId++;
            if (l.by === 'fallback') c.fallback++;
        });
        return c;
    }

    /* =========================================================================
     * 2. 주기 파싱 (§3-2)
     * -------------------------------------------------------------------------
     * opCycle(재난안전과 운영주기) 우선, 없으면 legalCycle.
     * 파싱 불가는 EVENT 로 **수렴시키되 세어 둔다** — 화면이 "주기 미파싱 N건 —
     * 상시로 분류" 로 갭을 드러낸다(없는 주기를 지어내지 않는다).
     * ========================================================================= */
    function ccOfNeed(need) {
        if (need >= 48) return 'WEEK';
        if (need >= 12) return 'MONTH';
        if (need >= 4) return 'QUARTER';
        if (need >= 2) return 'HALF';
        return 'YEAR';
    }
    var _cy = null;
    function parseCycle(raw) {
        var s = String(raw == null ? '' : raw).trim();
        if (!s) return { cc: 'EVENT', need: 0, label: '정기주기 없음', unparsed: false };
        if (/정기주기\s*없음|수시/.test(s)) return { cc: 'EVENT', need: 0, label: s, unparsed: false };
        var m;
        if ((m = s.match(/주\s*(\d+)\s*회/))) return { cc: 'WEEK', need: (+m[1]) * 52, label: s, unparsed: false };
        if ((m = s.match(/(\d+)\s*개월(?:에|마다)\s*(\d+)\s*회/))) {
            /* '6~24개월에 1회' 처럼 범위로 적힌 것은 회차를 확정할 수 없다 */
            if (/~/.test(s)) return { cc: 'EVENT', need: 0, label: s, unparsed: true };
            var need1 = Math.round(12 / (+m[1])) * (+m[2]);
            if (!(need1 >= 1)) return { cc: 'EVENT', need: 0, label: s, unparsed: true };
            return { cc: ccOfNeed(need1), need: need1, label: s, unparsed: false };
        }
        if ((m = s.match(/월\s*(\d+)\s*회/))) return { cc: 'MONTH', need: 12 * (+m[1]), label: s, unparsed: false };
        if (/매월/.test(s)) return { cc: 'MONTH', need: 12, label: s, unparsed: false };
        if ((m = s.match(/분기\s*(?:마다\s*)?(\d+)?\s*회/))) {
            var nq = 4 * (+(m[1] || 1));
            return { cc: ccOfNeed(nq), need: nq, label: s, unparsed: false };
        }
        if (/매반기/.test(s)) return { cc: 'HALF', need: 2, label: s, unparsed: false };
        if ((m = s.match(/반기\s*(?:별\s*)?(\d+)?\s*회/))) {
            var nh = 2 * (+(m[1] || 1));
            return { cc: ccOfNeed(nh), need: nh, label: s, unparsed: false };
        }
        /* 'N년마다 1회' 는 그 해에 필요한 회차를 셀 수 없다 — 상시로 두고 갭에 센다 */
        if (/\d+\s*년\s*(?:마다|에)/.test(s)) return { cc: 'EVENT', need: 0, label: s, unparsed: true };
        if ((m = s.match(/(?:연|매년)\s*(\d+)\s*회/))) return { cc: 'YEAR', need: +m[1], label: s, unparsed: false };
        if (/매년/.test(s)) return { cc: 'YEAR', need: 1, label: s, unparsed: false };
        return { cc: 'EVENT', need: 0, label: s, unparsed: true };
    }
    function cycleOf(stage) {
        var s = (stage && stage.id) ? stage : D().stage(stage);
        if (!s) return { cc: 'EVENT', need: 0, label: '정기주기 없음', unparsed: false, src: 'none' };
        if (!_cy) _cy = {};
        if (_cy[s.id]) return _cy[s.id];
        var src = s.opCycle ? 'op' : (s.legalCycle ? 'legal' : 'none');
        var r = parseCycle(s.opCycle || s.legalCycle);
        r.src = src;
        _cy[s.id] = r;
        return r;
    }
    var CC_LABEL = { YEAR: '연 단위', HALF: '반기', QUARTER: '분기', MONTH: '월 단위', WEEK: '주 단위', EVENT: '상시·수시' };
    function ccLabel(cc) { return CC_LABEL[cc] || cc; }
    /* 주기 미파싱 — 화면 캡션이 쓴다 */
    function unparsedStages() {
        return T().STAGES.filter(function (s) { return cycleOf(s).unparsed; });
    }

    /* =========================================================================
     * 3. 회차 기한 — 달력 말일 **추정**이다 (§9-4)
     * -------------------------------------------------------------------------
     * 실제 공문 기한이 아니다. 화면이 그 사실을 함께 밝힌다.
     * 오늘은 DYV2.today() 하나만 본다 — new Date() 로 만들지 않는다(CLAUDE.md §11).
     * ========================================================================= */
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function lastDay(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }   /* m: 1~12 */
    /** k 회차(1-based)의 기한 ISO */
    function deadlineOf(need, k, year) {
        year = +year;
        if (!(need > 0)) return year + '-12-31';
        if (need <= 12) {
            var mo = Math.ceil(12 * k / need);
            if (mo < 1) mo = 1; if (mo > 12) mo = 12;
            return year + '-' + pad(mo) + '-' + pad(lastDay(year, mo));
        }
        /* 주 단위 등 12회 초과 — 연중 균등 분할 */
        var day = Math.ceil(365 * k / need);
        var d = new Date(Date.UTC(year, 0, 1));
        d.setUTCDate(d.getUTCDate() + day - 1);
        return d.toISOString().slice(0, 10);
    }
    /** 기준일까지 기한이 지난 회차 수 */
    function elapsedRounds(need, year) {
        if (!(need > 0)) return 0;
        var today = V() && V().today ? V().today() : new Date().toISOString().slice(0, 10);
        var cy = +String(today).slice(0, 4);
        if (+year < cy) return need;          /* 지난 해는 전 회차가 도래했다 */
        if (+year > cy) return 0;
        var n = 0;
        for (var k = 1; k <= need; k++) { if (deadlineOf(need, k, year) < today) n++; }
        return n;
    }

    /* =========================================================================
     * 4. 이행상태 판정 (§3-3) — **표시 전용**
     * -------------------------------------------------------------------------
     * DYDOCS 의 완료/진행중/미이행/해당없음 전이를 대체하지 않는다. 완료 확인
     * (재난안전과 담당자)의 축은 기존 이행 목록에 그대로 있다.
     * 문서 수는 DYDOCS.documentIdsOfStage(stageId, year).length 하나만 쓴다.
     * ========================================================================= */
    var JUDGE = {
        /* «도래 회차»가 아니라 **연간 필요 회차** 기준이다(아래 done >= cy.need).
           그래서 반기 이상 주기는 연말 전에 충족이 되지 않는다 — 설명이 코드와
           달라 «7월에 상반기분 냈는데 왜 충족이 아니냐»로 읽히던 것을 바로잡는다. */
        ok:   { key: 'ok',   label: '충족',   glyph: '✓', desc: '연간 필요 회차 전부 등록' },
        run:  { key: 'run',  label: '진행중', glyph: '◐', desc: '일부 등록' },
        late: { key: 'late', label: '지연',   glyph: '!', desc: '기한 경과' },
        no:   { key: 'no',   label: '미이행', glyph: '□', desc: '문서 0건' },
        na:   { key: 'na',   label: '비해당', glyph: '−', desc: '사유 기재' },
    };
    function judge(stage, year) {
        var s = (stage && stage.id) ? stage : D().stage(stage);
        if (!s) return null;
        year = +(year || D().DEFAULT_YEAR);
        var cy = cycleOf(s);
        var n = D().documentIdsOfStage(s.id, year).length;
        var rec = D().stageRecord(s.id, year);

        /* 비해당이 최우선 — 사유 없는 옛 데이터도 상태는 비해당으로 두되 화면이
           '사유 미기재'를 따로 드러낸다(CLAUDE.md §4-2 와 같은 근거) */
        if (rec.status === D().ST.NA) {
            return mk('na', 0, cy.need, n, cy, { reason: rec.naReason || '' });
        }
        if (cy.cc === 'EVENT') {
            return mk(n > 0 ? 'ok' : 'no', n > 0 ? 1 : 0, 0, n, cy, {});
        }
        var done = Math.min(n, cy.need);
        if (done >= cy.need) return mk('ok', done, cy.need, n, cy, {});
        if (done > 0) return mk('run', done, cy.need, n, cy, {});
        var due = elapsedRounds(cy.need, year);
        return mk(due > 0 ? 'late' : 'no', 0, cy.need, n, cy, { elapsed: due });

        function mk(key, done2, need2, n2, cy2, extra) {
            var j = JUDGE[key];
            var o = {
                key: key, label: j.label, glyph: j.glyph,
                tone: V().toneOf(j.label),
                done: done2, need: need2, docs: n2,
                cc: cy2.cc, cycleLabel: cy2.label,
                round: need2 > 0 ? (done2 + '/' + need2) : '',
                status: rec.status,
            };
            Object.keys(extra || {}).forEach(function (k) { o[k] = extra[k]; });
            return o;
        }
    }
    /* 다음 미충족 회차 — 이행 상세의 '○○ 회차가 비어 있습니다' 안내가 쓴다 */
    function nextGap(stage, year) {
        var s = (stage && stage.id) ? stage : D().stage(stage);
        if (!s) return null;
        var cy = cycleOf(s);
        if (!(cy.need > 0)) return null;
        var n = D().documentIdsOfStage(s.id, +year).length;
        if (n >= cy.need) return null;
        var k = n + 1;
        return { round: k, need: cy.need, due: deadlineOf(cy.need, k, +year) };
    }

    /* =========================================================================
     * 4-1. 업무 유형 — 「어디서 수행하는가」 (2026-08-18 신설)
     * -------------------------------------------------------------------------
     * 발주측 구현참고 §6.1: "모든 업무를 단순히 «새 문서 등록»으로 처리하지 않는다."
     * 데이터는 분류기준 CSV v3 의 `수행경로` 열 → DYDOCT.STAGES[].paths 다.
     *
     * [값이 비어 있어도 화면은 돈다 (MUST)]
     * 열은 전부 override 다 — 채우지 않은 단계는 taskType='UNKNOWN' 이고 CTA 는
     * 종전 «＋ 새 문서 등록» 그대로다. 그래야 177행을 다 채우기 전에도 배포된다.
     *
     * [UNKNOWN 을 숨기지 않는다]
     * §19 가 임의 확정을 금지하므로 «아직 정하지 않았다»가 산출물이다. 화면은
     * 그 사실과 `typeNote`(무엇을 확인해야 하는지)를 함께 보여준다.
     *
     * [연결메뉴는 여기서 해석한다]
     * CSV 168행에는 기능코드(RSK_REGULAR)만 있고 메뉴 id 는 코드표 한 줄에만 있다.
     * 메뉴가 개명·신설돼도 이 표만 고치면 된다.
     * ========================================================================= */
    var TASK_TYPE = {
        PROGRAM:        { key: 'PROGRAM',        label: '전용 화면',   cta: '바로가기',        tone: 'info' },
        ELECTRONIC_DOC: { key: 'ELECTRONIC_DOC', label: '공문·문서',   cta: '＋ 업무문서 작성', tone: 'neutral' },
        ATTACHMENT:     { key: 'ATTACHMENT',     label: '결과 등록',   cta: '＋ 결과 등록',    tone: 'purple' },
        UNKNOWN:        { key: 'UNKNOWN',        label: '수행 위치 확인 필요', cta: '＋ 새 문서 등록', tone: 'warning' },
    };
    /* 기능코드 → 실제 메뉴. CSV 가 아니라 여기(코드) 한 곳에서만 메뉴 id 를 안다.
       상태 LIVE = 지금 갈 수 있다 / PLANNED = 화면은 있으나 완료판정 미작성 /
       NONE = 아직 갈 곳이 없다(외부 시스템 포함). */
    var FUNCS = {
        RSK_REGULAR:    { name: '정기 위험성평가',   href: 'rsk-list.html',    state: 'LIVE' },
        RSK_OCCASIONAL: { name: '수시 위험성평가',   href: 'rsk-occ.html',     state: 'PLANNED' },
        EDU_STATUS:     { name: '교육 이수현황',     href: 'edu-status.html',  state: 'LIVE' },
        EDU_ETC:        { name: '기타 교육',        href: 'edu-etc.html',     state: 'PLANNED' },
        COMPLY_IND:     { name: '이행점검(산업)',    href: 'menu.html?m=comply', state: 'LIVE' },
        COMPLY_CIT:     { name: '이행점검(시민)',    href: 'menu.html?m=comply', state: 'LIVE' },
        POLICY_POST:    { name: '경영방침 게시',     href: 'menu.html?m=policy', state: 'LIVE' },
        WORKENV:        { name: '작업환경측정',      href: 'work-env.html',    state: 'LIVE' },
        HEALTH:         { name: '건강검진',         href: 'health-exam.html', state: 'PLANNED' },
        BUDGET:         { name: '예산 총괄표',      href: 'bgt-main.html',    state: 'NONE' },
        FACIL:          { name: '시설물 대장',      href: 'fac-list.html',    state: 'NONE' },
        EXT_ELEV:       { name: '승강기안전종합정보망', href: '',              state: 'NONE' },
        EXT_PLAY:       { name: '어린이놀이시설 안전관리시스템', href: '',      state: 'NONE' },
        EXT_ONNARA:     { name: '온나라 전자결재',   href: '',                 state: 'NONE' },
    };
    function typeOf(stage) {
        var s = (stage && stage.id) ? stage : D().stage(stage);
        var t = (s && s.taskType) || 'UNKNOWN';
        return TASK_TYPE[t] || TASK_TYPE.UNKNOWN;
    }
    /* 주 수행경로(첫 토큰)와 보조 경로를 함께 준다 — 한 단계가 두 형태를 갖는 경우
       (계획은 문서, 실시는 전용화면) 보조를 버리면 절반이 사라진다. */
    function pathsOf(stage) {
        var s = (stage && stage.id) ? stage : D().stage(stage);
        return ((s && s.paths) || []).map(function (p) {
            var f = p.code ? FUNCS[p.code] : null;
            return {
                type: p.type, code: p.code || '',
                meta: TASK_TYPE[p.type] || TASK_TYPE.UNKNOWN,
                func: f || null,
                /* 갈 수 있는가 — 메뉴가 실재하고 LIVE/PLANNED 인 경우만 */
                reachable: !!(f && f.href),
            };
        });
    }
    function funcOf(code) { return FUNCS[code] || null; }
    /* 확인 필요(초안·미확정) 인가 — 화면이 «우리가 정한 게 아니다»를 밝히는 근거 */
    function needsConfirm(stage) {
        var s = (stage && stage.id) ? stage : D().stage(stage);
        return !s || (s.typeConf || 'UNKNOWN') !== 'CONFIRMED';
    }
    function typeCounts() {
        var c = { PROGRAM: 0, ELECTRONIC_DOC: 0, ATTACHMENT: 0, UNKNOWN: 0, draft: 0, confirmed: 0 };
        T().STAGES.forEach(function (s) {
            c[(s.taskType || 'UNKNOWN')]++;
            if ((s.typeConf || 'UNKNOWN') === 'CONFIRMED') c.confirmed++; else c.draft++;
        });
        return c;
    }

    /* =========================================================================
     * 5. 누락 점검 축 (§4-4) — lawBases 파생
     * -------------------------------------------------------------------------
     * 이행항목 id 접두만 보면 MGT-01(중대재해 예방 안전계획)처럼 두 축에 걸친
     * 항목을 한쪽으로만 몬다. 중대재해처벌법은 **중대산업재해(§4)와 중대시민재해
     * (§9) 두 축**이므로(CLAUDE.md §10 검증 6문 #4) 근거 문자열에서 파생하고
     * 복수 축을 허용한다.
     * ========================================================================= */
    var AXES = [
        { id: '', label: '전체' },
        { id: 'IND', label: '중대산업재해' },
        { id: 'CIT', label: '중대시민재해' },
        { id: 'OSH', label: '산안법' },
        { id: 'ETC', label: '개별법' },
    ];
    function axesOf(item) {
        var it = (item && item.id) ? item : D().item(item);
        if (!it) return ['ETC'];
        var raw = (it.lawBases || []).join(' ');
        var out = [];
        if (/중대재해처벌법/.test(raw)) {
            if (/제9조|시행령\s*제8조|시행령\s*제9조|시행령\s*제10조|시행령\s*제11조/.test(raw)) out.push('CIT');
            if (/제4조|제5조|시행령\s*제4조|시행령\s*제5조|제8조|제13조|제16조/.test(raw)) out.push('IND');
        }
        if (/산업안전보건/.test(raw)) out.push('OSH');
        if (!out.length) out.push('ETC');
        /* 재난기본법·시설물법 등 개별법이 함께 걸린 항목도 개별법 축에 넣는다 */
        if (/(재난\s*및\s*안전관리\s*기본법|시설물의\s*안전|자연재해대책법|승강기|어린이놀이시설|급경사지|지하안전|지진|재해구호법|소규모\s*공공시설|저수지|원자력|산림보호법|재난관리자원|보조금|정부업무평가|국민\s*안전교육)/.test(raw)) {
            if (out.indexOf('ETC') < 0) out.push('ETC');
        }
        return out;
    }
    function axisLabel(id) {
        for (var i = 0; i < AXES.length; i++) { if (AXES[i].id === id) return AXES[i].label; }
        return id;
    }

    /* =========================================================================
     * 6. 집계 — KPI (§4-1)
     * -------------------------------------------------------------------------
     * 비해당은 분모에서 뺀다 — 사유를 대고 빠진 건을 미이행으로 세면 이행률이
     * 영영 100% 가 되지 않는다. 뺀 건수는 화면이 함께 밝힌다.
     * ========================================================================= */
    function kpiOf(stages, year) {
        var per = [], ev = [], na = 0;
        (stages || []).forEach(function (s) {
            var j = judge(s, year);
            if (!j) return;
            if (j.key === 'na') { na++; return; }
            (j.need > 0 ? per : ev).push(j);
        });
        var pOk = per.filter(function (j) { return j.key === 'ok'; }).length;
        var eOk = ev.filter(function (j) { return j.key === 'ok'; }).length;
        var rounds = 0;
        (stages || []).forEach(function (s) { rounds += cycleOf(s).need || 0; });
        return {
            periodic: per.length, periodicOk: pOk,
            rate: per.length ? Math.round(pOk / per.length * 100) : 0,
            event: ev.length, eventOk: eOk,
            na: na,
            unmet: (per.length - pOk) + (ev.length - eOk),
            late: per.filter(function (j) { return j.key === 'late'; }).length,
            rounds: rounds,
        };
    }

    /* =========================================================================
     * 7. 문서 조회 도우미
     * ========================================================================= */
    /* 부서 문서 보유량 — 5개년 원장 집계(DYCMPDEPT). 시드가 없으면 null 이고
     * 화면은 종전처럼 사용자 등록분만 센다.
     * ⚠ 이행 판정이 아니다 — 원본에 업무단계 분류가 없어 «문서가 있다» 까지만 말한다. */
    function deptDocs(name) {
        var S = global.DYCMPDEPT;
        if (!S || !S.DEPTS) return null;
        var d = S.DEPTS[name];
        return d ? { total: d.total, byYear: d.byYear || {}, byKind: d.byKind || {} } : null;
    }
    function deptDocsMeta() { var S = global.DYCMPDEPT; return (S && S.META) || null; }

    function docsOfStage(stageId, year) {
        return D().documentIdsOfStage(stageId, year).map(D().docById).filter(Boolean);
    }
    /* 연결 수 / 문서 수 — 한 문서가 여러 단계에 걸리므로 두 수가 다르다(§5-1).
       화면이 두 숫자를 함께 찍어 오해를 막는다. */
    function linkCounts(docs) {
        var links = 0;
        (docs || []).forEach(function (d) { links += (d.stageIds || []).length; });
        return { docs: (docs || []).length, links: links };
    }
    /* 등록 가능한 연도 — 데이터가 있는 연도 + 기준연도 */
    function years() { return D().yearsWithData(); }

    global.DYCMP = {
        LEVELS: LEVELS, AXES: AXES, JUDGE: JUDGE,
        levelOf: levelOf, stagesOfLevel: stagesOfLevel, levelCounts: levelCounts,
        cycleOf: cycleOf, parseCycle: parseCycle, ccLabel: ccLabel, unparsedStages: unparsedStages,
        deadlineOf: deadlineOf, elapsedRounds: elapsedRounds,
        judge: judge, nextGap: nextGap,
        axesOf: axesOf, axisLabel: axisLabel,
        TASK_TYPE: TASK_TYPE, FUNCS: FUNCS,
        typeOf: typeOf, pathsOf: pathsOf, funcOf: funcOf, needsConfirm: needsConfirm, typeCounts: typeCounts,
        kpiOf: kpiOf, docsOfStage: docsOfStage, deptDocs: deptDocs, deptDocsMeta: deptDocsMeta, linkCounts: linkCounts, years: years,
    };
}(window));
