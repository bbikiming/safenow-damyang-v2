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
    var V = function () { return global.DYV2 || { orgDepts: function () { return []; } }; };

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
                 '부서별 이행 판정은 2025년 문서 원장(20개 부서)에서 냅니다. 다만 어느 할 일이 어느 부서에 걸리는지는 ' +
                 '적용대상 문구에서 부서 이름을 찾은 추정이라, 분모가 추정임을 표에 함께 밝힙니다.' },
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
            /* ① 분류기준 CSV 의 «적용수준» 이 채워져 있으면 **그 값이 이긴다.**
               종전에는 이 분기가 없어, 발주처가 확정값을 채우고 재생성해도 화면은
               계속 문자열 파생 추정을 썼다 — «자료를 줬는데 반영이 안 된다»가 된다.
               그릇(CSV 열)만 만들고 뚜껑(읽는 코드)을 안 단 상태였다. */
            if (s.levelSrc === 'L1' || s.levelSrc === 'L2' || s.levelSrc === 'L3') {
                _lv[s.id] = { level: s.levelSrc, derived: false, by: 'confirmed' };
                return;
            }
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
    /* ④ 완료 판정 경로 — CSV «완료판정»(doneRule)이 실제로 읽히는 유일한 창구.
       PROGRAM 단계는 전용 화면에서 수행하는데, 그 화면의 결과를 이 화면이 읽어
       오려면 판정 키가 있어야 한다. 키가 없으면 «연결 대기»다.
       ⚠ 없는 판정을 지어내 채우지 않는다 — 키를 적어 두면 «연결됐다»고 말하는
       것이고, 실제 연동은 본개발 범위다. 지금은 **사실을 드러내는 것**이 일이다. */
    function doneProbe(stage) {
        var s = (stage && stage.id) ? stage : D().stage(stage);
        if (!s) return null;
        var r = s.doneRule || {};
        var isProgram = (s.taskType === 'PROGRAM');
        var key = (r.kind === 'PROBE' && r.key) ? r.key : '';
        return {
            program: isProgram,
            key: key,
            /* 판정 키가 있어도 그 도메인 모듈이 이 화면에 로드돼 있어야 실제로 읽는다.
               지금은 어느 쪽도 로드하지 않으므로 항상 false 다 — 감추지 않는다. */
            wired: false,
            state: !isProgram ? 'doc' : (key ? 'pending' : 'unmapped'),
        };
    }
    /* ── EVENT 단계가 «언제 어떻게 생기는가» — 연계 개발자 회신 확정본 ────────
     * 분류기준 v3.3 「EVENT생성방식」 시트(140단계 × 14열)가 정본이다.
     *   최종 생성 방식 — 사용자 직접 등록 112 · 시스템 연계(자동 생성) 9 · 판정 보류 19
     *   연계 실현 판정 — A 확보 1 · B 일부 부족 8 · C 23 · D 보류 19 · 해당없음 89
     *
     * [보류 19건은 이유가 있다] 전부 **계약정보시스템(차세대 e호조) 제공 항목 미수령**
     * 이다. 종전에는 우리가 «어느 결과를 이행으로 볼지 정해지지 않았습니다» 라고
     * 뭉뚱그렸는데, 시트는 **인터페이스 번호·미확보 항목·조치**까지 갖고 있다.
     * 모르는 것과 «자료를 기다리는 중»은 다르다 — 후자는 무엇을 받으면 되는지 안다.
     *
     * [B 등급은 «되지만 한 가지가 빈다»] 예: IND-05-01 은 직위명으로 관리감독자를
     * 가릴 수 있으나 **발령일**이 없어 감지일로 대체한다. 그 사실을 화면이 말한다. */
    function linkOf(stage) {
        var s = (stage && stage.id) ? stage : D().stage(stage);
        return (s && s.link) || null;
    }
    var LINK_GRADE = {
        'A': { label: '연계 가능', tone: 'success', desc: '필요 항목 전부 확보' },
        'B': { label: '일부 부족',  tone: 'info',    desc: '연계는 되나 일부 항목이 없어 대체값을 쓴다' },
        'C': { label: '연계 제한',  tone: 'warning', desc: '' },
        'D': { label: '판정 보류',  tone: 'warning', desc: '연계 시스템 제공 항목 미수령 — 수령 후 재판정' },
    };
    function linkGrade(stage) {
        var l = linkOf(stage);
        return (l && LINK_GRADE[l.grade]) || null;
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
    /* 「법정주기」 칸에 **시간만** 든 값 — 회·년·월·분기·반기·주 가 하나도 없다.
       실측 2건(OSH-03-04 «16시간 이상(단기간 작업 2시간 이상)» · OSH-03-05 «4시간»).
       원본이 틀린 것이 아니라 칸 이름이 좁다 — 이 두 의무는 법이 «몇 번»이 아니라
       «몇 시간»을 정한다(산안법 시행규칙 별표4 · 같은 법 §31). 수행 시점은 옆 칸
       (수행시점조건)이 정확히 담고 있다(«배치 전»·«채용 시»). */
    var RE_HOURS_ONLY = /\d+\s*시간/;
    var RE_CYCLE_WORD = /회|년|개월|월|분기|반기|주/;
    function cycleOf(stage) {
        var s = (stage && stage.id) ? stage : D().stage(stage);
        if (!s) return { cc: 'EVENT', need: 0, label: '정기주기 없음', unparsed: false, src: 'none' };
        if (!_cy) _cy = {};
        if (_cy[s.id]) return _cy[s.id];
        var src = s.opCycle ? 'op' : (s.legalCycle ? 'legal' : 'none');
        var r = parseCycle(s.opCycle || s.legalCycle);
        r.src = src;
        /* ── 분류기준 v3.3 «주기코드» 가 있으면 **그 값이 이긴다** ──────────────
         * 종전에는 법정주기 문장을 파싱해 회차를 만들었다. v3.3 은 발주처·컨설팅이
         * 확정한 코드를 직접 준다 — 추정보다 확정이 먼저다.
         *
         * ⚠ 네 종류는 **연 단위 고정 회차가 아니다.** 회차를 만들어 내면 없는 기한이
         * 생기고 «지연»이 거짓으로 뜬다. 회차 없이 두고 그 이유를 화면이 말한다.
         *   GRADE     시설 안전등급에 따라 다름(A·B·C 반기 1회 / D 월 1회 / E 월 2회)
         *             → **등급 자료를 받아야 회차가 정해진다**(FMS 80건 중 8건만 보유)
         *   TERM      «임기 중 2회 이상» — 임기 시작일이 있어야 창이 정해진다
         *   MULTIYEAR «2년에 1회»·«10년마다» — 그 해에 도래하는지 셀 수 없다
         *   BIENNIAL  «담당 후 6개월 내 신규, 이후 매 2년» — 담당 시작일이 필요하다
         * 네 종류 모두 **판정 보류**이고, 무엇이 있어야 판정되는지를 needs 로 남긴다. */
        var CC_FIXED = { YEAR: 1, HALF: 2, QUARTER: 4, MONTH: 12, WEEK: 52 };
        var CC_HOLD = {
            GRADE:     '시설 안전등급',
            TERM:      '임기 시작일',
            MULTIYEAR: '다년 주기 — 그 해 도래 여부',
            BIENNIAL:  '담당 시작일',
        };
        var code = s.cycleCode || '';
        if (code) {
            r.cycleCode = code;
            if (code === 'EVENT') { r.cc = 'EVENT'; r.need = 0; r.unparsed = false; }
            else if (CC_FIXED[code]) {
                /* 파싱이 같은 버킷을 이미 맞혔으면 그 회차(예: 월 2회=24)를 살린다 */
                if (r.cc !== code || !r.need) { r.cc = code; r.need = CC_FIXED[code]; }
                r.unparsed = false;
            } else if (CC_HOLD[code]) {
                r.cc = 'EVENT'; r.need = 0; r.unparsed = false;
                r.hold = true; r.needs = CC_HOLD[code];
            }
        }
        /* 주기가 아닌 값을 «이행주기» 자리에 두면 「4시간」이 떠서 데이터 오류로
           읽힌다. 표시용 라벨만 수행시점으로 바꾸고 **원문은 hoursOnly 에 남긴다**
           — 상세의 «법정주기» 행은 s.legalCycle 을 직접 쓰므로 시간 요건을 잃지
           않는다. 「5년마다 1회」처럼 주기를 말하는 값은 건드리지 않는다. */
        if (r.unparsed && !r.need && RE_HOURS_ONLY.test(r.label) && !RE_CYCLE_WORD.test(r.label) && s.timing) {
            r.hoursOnly = r.label;
            r.label = s.timing;
        }
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
    /* ── 이행의무 유형 — 「안 한 것」과 「할 조건이 안 된 것」을 가른다 ──────────
     * 분류기준 v3.3 «이행의무 유형» 이 213단계를 다섯으로 나눈다.
     *   정기주기 70 · 상시·최초 52 · 조건부(사유 발생) 45 · 조건부(대상 발생) 43 · 산출불가 3
     *
     * ⚠ 조건부라고 무조건 «미발생» 이 아니다 — **문서가 없을 때만** 그렇다.
     * 시트에서 조건부 88건 중 문서가 있는 72건은 그냥 «이행» 이다(문서가 있다는 것은
     * 조건이 발생했다는 뜻이다). 판정은 judge() 가 그 순서를 지킨다.
     *
     * ⚠ «산출불가» 는 판정 불가가 아니다 — 회차를 셀 수 없다는 뜻이고 문서가 있으면
     * 이행이다(DSM-06-01 문서 423건 → 이행). */
    var DUTY = {
        '정기주기':         { key: 'periodic',   label: '정기주기',            cond: false },
        '상시·최초':        { key: 'once',       label: '상시·최초',           cond: false },
        '조건부(사유 발생)': { key: 'condEvent',  label: '조건부 — 사유 발생 시', cond: true },
        '조건부(대상 발생)': { key: 'condTarget', label: '조건부 — 대상 발생 시', cond: true },
        '산출불가':         { key: 'nocalc',     label: '산출 불가',           cond: false },
    };
    function dutyOf(stage) {
        var s = (stage && stage.id) ? stage : D().stage(stage);
        return (s && DUTY[s.dutyKind]) || null;
    }
    /* 조건부 «이면서 문서가 없는» 단계인가 — 이 둘을 함께 봐야 «서류가 있는데
       조건이 없었다면 맞습니다» 같은 말을 하지 않는다. */
    function isConditional(stage, year) {
        var s = (stage && stage.id) ? stage : D().stage(stage);
        var d = dutyOf(s);
        if (!d || !d.cond) return false;
        return D().documentIdsOfStage(s.id, +(year || D().DEFAULT_YEAR)).length === 0;
    }

    /* =========================================================================
     * 이행 판정 — 분류기준 v3.3 「단계별현황」 시트의 판정 방식이 정본이다
     * -------------------------------------------------------------------------
     * 시트가 밝힌 기준 원문:
     *   «이행(문서 확인) · 미이행(정기주기·상시 항목인데 0건) ·
     *    사유 미발생 / 대상 미발생(조건부 항목이라 0건이 미이행을 뜻하지 않음) ·
     *    산출불가(회차 판정 불가)»
     *
     * [회차를 세지 않는다 (MUST)] 종전에는 «반기 2회 중 1회»를 세어 «지연»을 냈다.
     * 그러나 **자료가 그 정밀도를 못 받친다** — 문서 제목만으로는 같은 제목 3건이
     * 1·2·3회차인지 알 수 없고(2026-08-21 회의: *"제목만으로는 절대 파악이 안 된다"*),
     * 분류확인이 확실 44% · 모호 43% · 애매 13% 다. 실제로 시트는 주 52회짜리
     * FAC-16-02 에 문서 2건, 반기 2회짜리 IND-10-01 에 문서 1건인데 **둘 다 «이행»**
     * 으로 판정한다. 우리가 회차를 세면 그 11건을 «지연»이라 불러 **발주처 분석과
     * 화면이 서로 다른 말을 하게 된다.**
     * 회차는 버리지 않고 **이행 상세에만 참고로** 남긴다(round·need·hold).
     *
     * [조건부는 문서가 없을 때만 «미발생» 이다] 조건부 88건 중 문서가 있는 72건은
     * 시트에서 그냥 «이행» 이다 — 문서가 있다는 것은 조건이 발생했다는 뜻이다.
     * 문서 유무를 안 보고 조건부라는 이유만으로 «조건 확인» 을 붙이면, 서류가 있는
     * 단계에 «조건이 없었다면 서류가 없는 것이 맞습니다» 라고 말하게 된다.
     *
     * [산출불가는 «판정 불가»가 아니다] 회차를 셀 수 없다는 뜻이고, 문서가 있으면
     * 이행이다(DSM-06-01 문서 423건 → 이행). GRADE·TERM·MULTIYEAR·BIENNIAL 도 같다.
     * ========================================================================= */
    var JUDGE = {
        ok:   { key: 'ok',   label: '이행',       glyph: '✓', desc: '문서 확인' },
        no:   { key: 'no',   label: '미이행',     glyph: '□', desc: '정기주기·상시 항목인데 0건' },
        cev:  { key: 'cev',  label: '사유 미발생', glyph: '·', desc: '조건부 — 사유가 발생하지 않았을 수 있음' },
        ctg:  { key: 'ctg',  label: '대상 미발생', glyph: '·', desc: '조건부 — 대상이 발생하지 않았을 수 있음' },
        na:   { key: 'na',   label: '비해당',     glyph: '−', desc: '사유 기재' },
    };
    var JUDGE_ORDER = ['ok', 'no', 'cev', 'ctg', 'na'];
    function judge(stage, year) {
        var s = (stage && stage.id) ? stage : D().stage(stage);
        if (!s) return null;
        year = +(year || D().DEFAULT_YEAR);
        var cy = cycleOf(s);
        var n = D().documentIdsOfStage(s.id, year).length;
        var rec = D().stageRecord(s.id, year);

        /* 비해당이 최우선 — 사람이 사유를 대고 뺀 것이라 자동 판정보다 앞선다
           (사유 없는 옛 데이터도 상태는 비해당으로 두되 화면이 «사유 미기재»를 드러낸다) */
        if (rec.status === D().ST.NA) return mk('na', n, cy, rec, { reason: rec.naReason || '' });
        if (n > 0) return mk('ok', n, cy, rec, {});
        var d = dutyOf(s);
        if (d && d.key === 'condEvent') return mk('cev', 0, cy, rec, {});
        if (d && d.key === 'condTarget') return mk('ctg', 0, cy, rec, {});
        return mk('no', 0, cy, rec, {});

        function mk(key, n2, cy2, rec2, extra) {
            var j = JUDGE[key];
            var o = {
                key: key, label: j.label, glyph: j.glyph, desc: j.desc,
                tone: V().toneOf(j.label),
                docs: n2,
                /* ── 아래는 **상세 전용 참고값**이다. 판정에 쓰지 말 것. ──────────
                   표·필터·집계는 위 5상태만 본다(시트와 같은 말을 하기 위해서다). */
                cc: cy2.cc, cycleLabel: cy2.label, need: cy2.need,
                round: cy2.need > 0 ? (Math.min(n2, cy2.need) + '/' + cy2.need) : '',
                shortfall: cy2.need > 0 && n2 < cy2.need,   /* 회차 미달 — 참고 */
                hold: !!cy2.hold, holdNeeds: cy2.needs || '',
                status: rec2.status,
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
    /* ── 법정 이행률 — 분모는 «이행률 포함 = Y» 다 (v3.3 신규 축) ─────────────
     * 213단계 중 **72단계**만 이행률에 든다. 나머지 141 은 «마련»처럼 한 번 하면
     * 되는 일이거나 조건부라 분모에 넣으면 이행률이 영영 낮게 나온다.
     * 엑셀 「이행률」 시트가 이 분모로 L1 97% · L2 63% · L3 시설 100% ·
     * L3 공사 0% · 합계 82%(59/72)를 낸다 — 우리가 같은 값을 재현해야 한다.
     * inRate 가 없는 옛 데이터에서는 전 단계를 분모로 두어 종전 동작을 지킨다. */
    function rateStages(stages) {
        var arr = stages || [];
        var tagged = arr.filter(function (s) { return s && s.inRate === true; });
        return tagged.length ? tagged : arr;
    }
    function rateOf(stages, year) {
        var pool = rateStages(stages), done = 0;
        pool.forEach(function (s) { if (D().documentIdsOfStage(s.id, year).length > 0) done++; });
        return { total: pool.length, done: done, miss: pool.length - done,
                 pct: pool.length ? Math.round(done / pool.length * 100) : 0 };
    }
    /* KPI — 판정과 같은 축으로만 센다(시트와 같은 말을 하기 위해서다).
       종전의 «정기 이행률»(회차 충족률)은 회차를 세던 시절의 축이라 없앤다 —
       두 축이 공존하면 같은 화면에서 다른 이행률이 두 개 뜬다. */
    function kpiOf(stages, year) {
        var c = { ok: 0, no: 0, cev: 0, ctg: 0, na: 0 };
        (stages || []).forEach(function (s) {
            var j = judge(s, year);
            if (j && c[j.key] !== undefined) c[j.key]++;
        });
        var law = rateOf(stages, year);
        return {
            done: c.ok, unmet: c.no, condEvent: c.cev, condTarget: c.ctg, na: c.na,
            cond: c.cev + c.ctg,
            /* 법정 이행률 — 분모는 «이행률 포함 = Y» 다 */
            lawRate: law.pct, lawTotal: law.total, lawDone: law.done, lawMiss: law.miss,
        };
    }
    /* ── 부서 축 — 2025 원장(20개 부서 57,765건)에서 파생 ────────────────────
     * 종전에는 원장이 재난안전과 한 부서뿐이라 화면이 «부서별 이행 판정은 아직
     * 낼 수 없습니다»라고 말해 왔다. 지금은 전건이 부서를 갖는다.
     *
     * **부서 목록은 원장 ∪ 조직도다.** 어느 한쪽만 쓰면 조용히 잃는 것이 있다 —
     * 원장만 쓰면 조직에는 있는데 2025 문서가 0건인 부서(회계과·보건소·담양읍)가
     * 사라지고, 조직도만 쓰면 문서를 가진 12개 부서(경제교통과·산림정원과 등)가
     * 통째로 안 보인다. 둘 다 보여주고 **각 행이 어디서 왔는지 밝힌다**.
     *
     * ⚠ 두 명단은 부서를 나누는 깊이가 다르다 — 조직도의 「보건소」를 원장은
     *   「보건소보건행정과」로, 농업기술센터를 3개 과로 쪼갠다. 같은 것으로 합치지
     *   않는다(합치면 우리가 만든 매핑이 자료가 된다). 나란히 두고 드러낸다.
     */
    function deptList() {
        var led = {}, out = [], seen = {};
        D().allDocs().forEach(function (d) {
            if (d.origin === 'ledger' && d.dept) led[d.dept] = (led[d.dept] || 0) + 1;
        });
        Object.keys(led).sort().forEach(function (n) {
            seen[n] = 1; out.push({ name: n, docs: led[n], inLedger: true, inOrg: false });
        });
        (V() && V().orgDepts ? V().orgDepts() : []).forEach(function (dp) {
            if (seen[dp.name]) { out[idxOf(out, dp.name)].inOrg = true; return; }
            out.push({ name: dp.name, docs: 0, inLedger: false, inOrg: true });
        });
        return out;
    }
    function idxOf(arr, name) {
        for (var i = 0; i < arr.length; i++) { if (arr[i].name === name) return i; }
        return -1;
    }
    /* 한 부서의 이행 상태 — **분모가 추정이라는 사실을 값과 함께 돌려준다.**
     *   applied  : 적용대상 문구에서 부서 이름을 찾은 «추정» 단계 수
     *   withDoc  : 그 추정 단계 중 실제로 그 부서 문서가 붙은 수  → 이행
     *   extra    : 추정 밖인데 그 부서 문서가 붙은 단계 수
     * extra 가 크다는 것은 곧 «적용대상 문구 추정이 실제와 다르다»는 증거다.
     * 이 수를 숨기고 이행률만 내면 분모가 틀린 비율을 정답처럼 보여주게 된다.
     */
    function deptStats(name, year) {
        var stages = T().STAGES, applied = 0, withDoc = 0, extra = 0, docs = 0;
        var hit = {};
        D().allDocs().forEach(function (d) {
            if (d.dept !== name) return;
            if (year && +d.year !== +year) return;
            docs++;
            (d.stageIds || []).forEach(function (sid) { hit[sid] = 1; });
        });
        stages.forEach(function (s) {
            var ap = D().stageDeptHit(s, name), hs = !!hit[s.id];
            if (ap) { applied++; if (hs) withDoc++; }
            else if (hs) extra++;
        });
        /* 서류가 붙은 할 일 — 추정을 거치지 않은 **실측**이다. 부서 표가 확실히
           말할 수 있는 유일한 수라 별도로 돌려준다. */
        var covered = withDoc + extra;
        /* 비율을 낼 수 있는가 — **추정 밖이 적용보다 많으면 내지 않는다.**
           실측상 20개 부서 중 19개가 그 상태다(적용 23~48 vs 추정 밖 51~90).
           분모가 그 정도로 틀렸는데 «이행률 30%»를 칩으로 찍으면 담당자에게는
           그것이 측정값이 된다. 못 내는 이유를 말하는 편이 정확하다.

           **문서가 0건인 부서도 비율을 내지 않는다** — 회계과·담양읍처럼 원장에
           그 이름의 문서가 없는 부서에 «0%»를 찍으면 «아무것도 안 했다»로 읽히는데,
           실제로는 판정할 자료가 없는 것이다(원장이 다른 이름으로 부르거나 그 해
           문서가 없다). 대상이 아닌 것을 완료로 세지 않는 것과 같은 이유다. */
        var usable = applied > 0 && docs > 0 && extra <= applied;
        return { applied: applied, withDoc: withDoc, extra: extra, docs: docs,
                 covered: covered, usable: usable,
                 pct: usable ? Math.round(withDoc / applied * 100) : null };
    }

    /* 부서별 문서 보유량 — 5개년 원장 집계(js/cmp-dept-docs.js).
       ⚠ **이행 관리 표에서는 쓰지 않는다.** 이 집계는 폴더 안의 파일을 세고
       원장은 온나라 문서 1건을 세어 **단위가 다르다** — 건설과 2025 가 원장
       5,057 인데 이 집계로는 29,813 이다(6배). 한 칸에 섞으면 시드가 실린
       4개 부서만 자릿수가 커져 «그 부서가 일을 많이 했다»로 읽힌다.
       5개년 축 자체는 값이 있어 함수는 남긴다. */
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
        levelOf: levelOf, stagesOfLevel: stagesOfLevel, levelCounts: levelCounts, doneProbe: doneProbe,
        cycleOf: cycleOf, parseCycle: parseCycle, ccLabel: ccLabel, unparsedStages: unparsedStages,
        deadlineOf: deadlineOf, elapsedRounds: elapsedRounds,
        judge: judge, JUDGE_ORDER: JUDGE_ORDER, nextGap: nextGap,
        DUTY: DUTY, dutyOf: dutyOf, isConditional: isConditional,
        linkOf: linkOf, linkGrade: linkGrade, LINK_GRADE: LINK_GRADE,
        axesOf: axesOf, axisLabel: axisLabel,
        TASK_TYPE: TASK_TYPE, FUNCS: FUNCS,
        typeOf: typeOf, pathsOf: pathsOf, funcOf: funcOf, needsConfirm: needsConfirm, typeCounts: typeCounts,
        kpiOf: kpiOf, rateOf: rateOf, rateStages: rateStages, docsOfStage: docsOfStage, deptList: deptList, deptStats: deptStats, deptDocs: deptDocs, deptDocsMeta: deptDocsMeta, linkCounts: linkCounts, years: years,
    };
}(window));
