/* =========================================================================
 * 업무문서 — 상태·진행률·문서 축 단일 출처 (전역 DYDOCS)
 *   기획: docs/planning/기획-업무문서-이행목록-업무목록-UX설계-v1.md
 *
 *   이행 목록(docs-exec) · 업무 목록(docs-preset) · 문서 상세(doc-detail) 가
 *   같은 판정을 각자 복제하지 않도록 여기 한 곳에만 둔다.
 *
 *   [축 3개를 섞지 말 것 — UX설계 §4]
 *     · 증빙문서 축(여기)      : 이행항목의 증빙이 갖춰졌나  → StageProgress
 *     · 부서 점검 축(DEPTCHK)  : 부서가 반기 점검을 했나
 *     · 발행·배정 축(DYWORK)   : 발행된 업무를 누가 끝냈나   → DYWORK.deptDone
 *   이 모듈은 DEPTCHK·DYWORK 의 판정을 읽지도 쓰지도 않는다. 부르는 순간
 *   CLAUDE.md §14-2 의 '완료는 한 곳에서만' 이 두 곳이 된다.
 *
 *   로드 순서: layout.js → common.js → doc-taxonomy-data.js →
 *              doc-history-data.js → sets-data-v2.js → doc-progress.js
 * ========================================================================= */
(function (global) {
    'use strict';

    var SKEY = 'dy-docs-v1';          /* 저장 키는 하나 — reset() 이 새는 곳을 만들지 않는다 */
    var BASE_YEAR = 2025;             /* 원장 연도 */
    var DEFAULT_YEAR = 2026;          /* 기준연도 기본값 (지시서 §5-2) */
    /* ── 시연 기준연도 — 발주처 확정 2026-08-18 ──────────────────────────────
     * "기준 연도는 실제처럼 2025년으로 채워주고 2026년은 대부분 미이행으로 해줘"
     *
     * 아래 defaultYear() 는 «진행이 있는 최신 연도»를 파생한다. 2026 예시 자료가
     * 붙으면서 그 규칙이 2026 을 돌려주게 됐는데, 그러면 화면 5곳(이행 관리·문서
     * 목록·이행 목록·업무 업로드·업무문서 투어)의 기본 연도가 **한꺼번에** 2026
     * 으로 움직인다. 시연 서사는 «작년 실적(실측)을 먼저 보고, 올해로 바꾸면
     * 아직 대부분 미이행»이라 기본값은 2025 다.
     *
     * DEMO_TODAY(§11) 와 같은 자리다 — 시연일에 이 한 줄만 바꾼다. 0 으로 두면
     * 파생 규칙(실서비스 동작)으로 돌아간다. */
    var DEMO_YEAR = 2025;

    var T = function () { return global.DYDOCT || { ITEMS: [], STAGES: [] }; };
    var H = function () { return global.DYDOCH || { DOCS: [], META: {} }; };
    /* 2026 예시 자료(생성물, js/doc-seed-2026.js). **없어도 돌아간다** — 로드하지
       않은 화면·실서비스에서는 빈 값이라 종전 동작 그대로다. */
    var Y26 = function () { return global.DYDOC2026 || null; };
    /* 시드는 «오늘»을 박아 두고 만들어졌다. DEMO_TODAY(§11)를 옮기면 회차 기한과
       지연 판정만 다시 계산되고 시드 문서 수는 그대로라 진행이 실제보다 뒤처져
       보인다. 자동 보정은 하지 않는다(그러면 시드가 규칙 밖에서 움직인다) —
       대신 어긋난 사실을 콘솔에 남겨 «시드를 다시 생성하라»를 알린다. */
    var _staleWarned = false;
    function seedStale() {
        var sd = Y26();
        if (!sd || !sd.META) return false;
        return sd.META.today !== today();
    }
    var V = function () { return global.DYV2; };
    var R = function () { return global.DYROLE; };

    /* ── 상태 어휘 ─────────────────────────────────────────────────────────
     * 코드로 저장하고 라벨은 화면이 아니라 여기서 낸다(DEPTCHK 와 같은 원칙).
     * 라벨은 DYV2.STATUS_TONE 이 아는 어휘여야 색이 붙는다(CLAUDE.md §7). */
    var ST = { NONE: 'not_started', WIP: 'in_progress', DONE: 'complete', NA: 'na' };
    var ST_LABEL = {};
    ST_LABEL[ST.NONE] = '미이행';
    ST_LABEL[ST.WIP] = '진행중';
    ST_LABEL[ST.DONE] = '완료';
    ST_LABEL[ST.NA] = '해당없음';
    var ST_ORDER = [ST.NONE, ST.WIP, ST.DONE, ST.NA];

    /* ── 문서 출처 4종 ──────────────────────────────────────────────────────
     * 지시서 §8-4 는 3종을 열거했지만, 현행 426문서의 '프로그램' 174건(전용
     * 화면에서 처리하는 업무)이 셋 중 어디에도 안 들어간다. 빼면 my-work·stats
     * 의 진입점이 끊긴다 — 네 번째로 세운다(UX설계 §5-3). */
    var SRC = {
        onnara:     { key: 'onnara',     label: '온나라',     status: ['결재중', '결재완료', '반려'] },
        electronic: { key: 'electronic', label: '전자문서',   status: ['작성중', '등록완료', '확정'] },
        upload:     { key: 'upload',     label: '직접 첨부',  status: ['검토대기', '확인완료'] },
        program:    { key: 'program',    label: '프로그램',   status: ['미시행', '진행', '완료'] },
    };
    var SRC_ORDER = ['onnara', 'electronic', 'upload', 'program'];

    /* ── 문서가 오간 방향 ──────────────────────────────────────────────────
     * [왜 필요한가] 원장의 `sr`(수발신자)은 «상대 기관» 하나로 부르기에는 세 가지가
     * 섞여 있다 — 실측 3,830건 중 외부 기관, **담양군 내부 부서 895건(26%)**,
     * 다중 수신 나열 231건, 그리고 뜻이 서지 않는 «노, 로, 도» 94건.
     * 마지막 것이 증거다: 「대설·한파 대비 안전관리 철저」 같은 **내부 통보문**의
     * 수신처가 «상대 기관» 칸에 억지로 들어가면서 깨진 값이 됐다. 방향을 먼저
     * 물으면 내부 문서는 상대 기관 칸 자체가 사라져 그런 값이 생기지 않는다.
     *
     * [판정 축이 아니다] 부서별 이행 판정의 축은 `dept`(우리 쪽 담당)이고 방향은
     * 그것을 대신하지 않는다. 여기는 «누구와 오간 문서인가»만 말한다.
     *
     * [옛 데이터는 미상이다] 원장·현행 업무문서·시연 시드에는 이 값이 없다.
     * 없으면 `null` 이고 화면은 종전대로 기관명만 낸다 — 지어내지 않는다. */
    var DIR = {
        'in':       { key: 'in',       label: '받은 문서', verb: '받음', help: '외부에서 우리에게 온 공문' },
        'out':      { key: 'out',      label: '보낸 문서', verb: '보냄', help: '우리가 외부로 내보낸 공문' },
        'internal': { key: 'internal', label: '내부 문서', verb: '내부', help: '담양군 안에서 만들고 끝난 문서' },
    };
    var DIR_ORDER = ['in', 'out', 'internal'];
    function dirOf(d) { return (d && DIR[d.dir]) || null; }
    /* 수발신 표기 — 화면마다 조립하지 않는다. full=false 면 목록용(방향 접두 없음:
       열 폭 안에서 기관명이 잘리는 비용이 방향 표시의 값보다 크다). */
    function srText(d, full) {
        var dir = dirOf(d);
        if (dir && dir.key === 'internal') return '내부 문서';
        if (!d || !d.sr) return '';
        return (full && dir) ? (dir.verb + ' · ' + d.sr) : d.sr;
    }
    /* DY_DOCS_V2 의 processType → 출처 */
    var PROC_SRC = { '전자문서': 'electronic', '첨부파일': 'upload', '프로그램': 'program' };

    /* ── 저장소 ────────────────────────────────────────────────────────────
     * prog   : {'stageId|year': StageProgress}
     * docs   : 사용자가 업로드/프리셋으로 만든 문서
     * presets: 프리셋 실행 이력(중복 경고용)
     * log    : 변경 이력 (완료 확인·환원·삭제·병합) */
    function blank() { return { prog: {}, docs: [], presets: [], log: [], fix: {} }; }
    var _s = null;
    function store() {
        if (_s) return _s;
        try { _s = JSON.parse(localStorage.getItem(SKEY)) || blank(); } catch (e) { _s = blank(); }
        if (!_s.prog) _s.prog = {};
        if (!_s.docs) _s.docs = [];
        if (!_s.presets) _s.presets = [];
        if (!_s.log) _s.log = [];
        if (!_s.fix) _s.fix = {};
        return _s;
    }
    function save() {
        try { localStorage.setItem(SKEY, JSON.stringify(store())); } catch (e) {}
        _cache = null;   /* 문서 축이 바뀌었으니 파생 인덱스를 버린다 */
    }
    function reset() { _s = blank(); _cache = null; try { localStorage.removeItem(SKEY); } catch (e) {} }

    function nowTs() { return new Date().toISOString().slice(0, 19).replace('T', ' '); }
    function today() { return V() && V().today ? V().today() : new Date().toISOString().slice(0, 10); }
    function curYear() { return +today().slice(0, 4) || DEFAULT_YEAR; }

    /* ── 분류 인덱스 (한 번만 만든다) ─────────────────────────────────────── */
    var _ix = null;
    function ix() {
        if (_ix) return _ix;
        var byItem = {}, byStage = {}, stagesOf = {};
        T().ITEMS.forEach(function (it) { byItem[it.id] = it; stagesOf[it.id] = []; });
        T().STAGES.forEach(function (s) {
            byStage[s.id] = s;
            (stagesOf[s.itemId] = stagesOf[s.itemId] || []).push(s);
        });
        _ix = { byItem: byItem, byStage: byStage, stagesOf: stagesOf };
        return _ix;
    }
    function item(id) { return ix().byItem[id] || null; }
    function stage(id) { return ix().byStage[id] || null; }
    function stagesOfItem(itemId) { return ix().stagesOf[itemId] || []; }

    /* =========================================================================
     * 문서 축 — 세 출처를 하나의 배열로 (UX설계 §5-3)
     *   2025 원장 57,765 + DY_DOCS_V2 426 + 2026 예시 자료 + 사용자 등록분
     *   6만행이 넘으므로 파생 인덱스까지 한 번에 만들고 캐시한다(실측 49ms).
     * ========================================================================= */
    var _cache = null;
    function build() {
        if (_cache) return _cache;
        if (!_staleWarned && seedStale()) {
            _staleWarned = true;
            try {
                console.warn('[DYDOCS] 2026 예시 자료의 기준일(' + Y26().META.today +
                    ')이 DEMO_TODAY(' + today() + ')와 다릅니다 — ' +
                    'python3 tools/build-doc-seed-2026.py 로 다시 생성하세요.');
            } catch (e) {}
        }
        var docs = [];

        /* (1) 2025 문서 원장 — 생성물(20개 부서 57,765건). 종전 3,830건은 재난안전과
               한 부서뿐이라 «부서 축 없음»이었으나 지금은 전건이 부서를 갖는다.
               관리자 교정(store().fix)은 원본을 고치지 않고 여기서 **덧씌운다**. */
        var FX = store().fix || {};
        H().DOCS.forEach(function (d) {
            var fx = FX[d.id];
            docs.push({
                id: d.id, title: d.title, sr: d.sr, date: d.date, year: 2025,
                stageIds: (fx && fx.stageIds) ? fx.stageIds : d.stageIds, cycle: d.cycle,
                fixedAt: fx && fx.at ? fx.at : null, fixedBy: fx && fx.by ? fx.by : null,
                mergedInto: fx && fx.mergedInto ? fx.mergedInto : null,
                src: d.src, status: d.st,
                dept: d.dept || '', assignee: '',   /* 담당자는 여전히 원장 미보유 */
                dir: d.dir || null,                 /* 발신구분 → 수발신 방향(전건 보유) */
                mapConf: d.mapConf || '',           /* sure·weak·vague — weak 이 진짜 위험 */
                excluded: d.excluded || '',         /* 타 기관 소관·의무아님 */
                origin: 'ledger', dataMode: d.dataMode || 'real',
                statusSource: d.statusSource || 'ledger-2025',
                nearDup: (fx && fx.mergedInto) ? null : (d.nearDup || null),
                mapped: ((fx && fx.stageIds) ? fx.stageIds : d.stageIds).length > 0,
            });
        });

        /* (2) 현행 업무문서 426 — 전자문서 폼·전용화면 진입점을 보존한다 */
        (global.DY_DOCS_V2 || []).forEach(function (d) {
            docs.push({
                id: d.id, title: d.name, sr: '', date: d.updated || '',
                year: +String(d.updated || '').slice(0, 4) || DEFAULT_YEAR,
                stageIds: [],                    /* 세트 축이라 이행항목 매핑이 없다 */
                cycle: d.cycle || '',
                src: PROC_SRC[d.processType] || 'upload', status: d.status,
                dept: d.dept || '', assignee: d.assignee || '',
                origin: 'v2', menuKey: d.menuKey, processType: d.processType,
                setId: d.setId, dataMode: 'seed', statusSource: 'sets-data-v2',
                mapped: false,
            });
        });

        /* (3) 2026 예시 자료 — 규칙으로 만든 올해 실적(tools/build-doc-seed-2026.py).
               2025 원장(1)과 섞이지 않게 origin·dataMode 로 구분한다. 파일을 로드
               하지 않으면 이 블록은 통째로 건너뛴다. */
        var sd = Y26();
        if (sd && sd.DOCS) {
            sd.DOCS.forEach(function (d) {
                docs.push({
                    id: d.id, title: d.title, sr: d.sr || '', date: d.date, year: +sd.META.year,
                    stageIds: (d.stageIds || []).slice(), cycle: d.cycle || '',
                    src: d.src || 'onnara', status: d.st || '',
                    dept: d.dept || '', assignee: '',   /* 부서는 원본 2025 문서에서 이어받는다 */
                    dir: d.dir || null,
                    origin: 'seed26', dataMode: 'demo', statusSource: 'demo-seed-2026',
                    nearDup: null, mapped: (d.stageIds || []).length > 0,
                    /* 어느 2025 문서에서 왔는지를 **presetOf 로 투영**한다. 화면의
                       «전년도 불러오기»·«올해 이어받기» 중복 검사가 이 필드를 보고
                       있어(cmp-status pulledInto · cmp-docs carry), 여기 실어 두면
                       두 화면을 고치지 않고도 «시드가 이미 옮긴 문서»를 또 옮기는
                       일이 막힌다. 안 막으면 그 단계만 회차를 넘어 «충족»이 뜬다. */
                    presetOf: d.seedOf || null,
                });
            });
        }

        /* (4) 사용자 등록분 (업로드·프리셋) */
        store().docs.forEach(function (d) { docs.push(d); });

        /* 파생 인덱스 */
        var byId = {}, byStage = {};
        docs.forEach(function (d) {
            byId[d.id] = d;
            for (var i = 0; i < d.stageIds.length; i++) {
                (byStage[d.stageIds[i]] = byStage[d.stageIds[i]] || []).push(d.id);
            }
        });
        _cache = { docs: docs, byId: byId, byStage: byStage };
        return _cache;
    }
    function allDocs() { return build().docs; }
    function docById(id) { return build().byId[id] || null; }

    /* =========================================================================
     * 기준연도 기본값 — 하드코딩하지 않고 **데이터가 있는 최신 연도**로 파생한다.
     * -------------------------------------------------------------------------
     * 2026 을 고정하면 시연 첫 화면이 이행항목 카드 전부 0% 라 "고장난 화면"으로 읽히고,
     * 2025 를 고정하면 실서비스에서 지난 해를 기본으로 보게 된다. 규칙으로 두면
     * 2026 에 실적이 쌓이는 순간 자동으로 2026 이 된다.
     *   · '데이터가 있다' = 그 연도의 업무단계 진행상태가 하나라도 미이행이 아니다
     *     (문서 존재가 아니라 **이행 현황**이 축이다 — 이 화면이 묻는 것이 그것이다)
     * ========================================================================= */
    function yearsWithData() {
        var ys = {};
        allDocs().forEach(function (d) { if (d.year) ys[d.year] = 1; });
        ys[BASE_YEAR] = 1; ys[DEFAULT_YEAR] = 1;
        return Object.keys(ys).map(Number).sort(function (a, b) { return a - b; });
    }
    function hasProgress(year) {
        return T().STAGES.some(function (s) { return statusOfStage(s.id, year) !== ST.NONE; });
    }
    function defaultYear() {
        if (DEMO_YEAR) return DEMO_YEAR;          /* 고정 기준연도 — 위 주석 참고 */
        var ys = yearsWithData().slice().reverse();
        for (var i = 0; i < ys.length; i++) { if (hasProgress(ys[i])) return ys[i]; }
        return DEFAULT_YEAR;
    }
    /* 프리셋 원본연도 — '대상연도 − 1' 이 아니라 **대상연도보다 이전이면서 문서가
       있는 가장 최근 연도**다. 단순히 1을 빼면 2025 화면에서 "2024년 프리셋"이
       뜨는데 2024 데이터가 없어 목록이 0건이다(약속만 하고 못 지키는 버튼). */
    function presetSourceYear(toYear) {
        var to = +toYear || defaultYear();
        var counts = {};
        allDocs().forEach(function (d) { if (d.year && d.year < to) counts[d.year] = (counts[d.year] || 0) + 1; });
        var ys = Object.keys(counts).map(Number).sort(function (a, b) { return b - a; });
        return ys.length ? ys[0] : 0;               /* 0 = 가져올 전년도가 없다 */
    }

    /* §10 계약 함수 */
    function documentIdsOfStage(stageId, year) {
        var ids = build().byStage[stageId] || [];
        if (year == null) return ids.slice();
        var byId = build().byId;
        return ids.filter(function (id) { return byId[id] && byId[id].year === +year; });
    }
    function stageIdsOfDocument(documentId) {
        var d = docById(documentId);
        return d ? d.stageIds.slice() : [];
    }
    function itemIdsOfDocument(documentId) {
        var out = [];
        stageIdsOfDocument(documentId).forEach(function (sid) {
            var s = stage(sid);
            if (s && out.indexOf(s.itemId) < 0) out.push(s.itemId);
        });
        return out;
    }

    /* =========================================================================
     * 진행상태 — StageProgress
     *   2025 의 기본값은 원자료 `취합상태` 의 투영(st2025)이지 합성이 아니다.
     *   그 밖의 연도는 비어서 출발한다 — 그 빈 상태가 프리셋의 존재 이유다.
     * ========================================================================= */
    function pkey(stageId, year) { return stageId + '|' + year; }
    function progOf(stageId, year) { return store().prog[pkey(stageId, year)] || null; }

    function statusOfStage(stageId, year) {
        year = +(year || DEFAULT_YEAR);
        var p = progOf(stageId, year);
        if (p && p.status) return p.status;
        if (year === BASE_YEAR) {
            var s = stage(stageId);
            if (s && s.st2025) return s.st2025;   /* v3 CSV 취합상태 투영(하위호환) */
            /* ── v3.3 부터는 취합상태 열이 없다 ────────────────────────────────
             * 분류기준 v3.3 은 「취합상태」를 빼고 **문서 목록 자체**로 판정하는
             * 방식으로 바뀌었다. 그 열을 되살리면 v3.3 이 뺀 축을 우리가 부활시키는
             * 것이고, 177/213 비대칭(신규 36단계는 값이 없다)도 생긴다.
             *
             * 그래서 **문서 존재**로 판정한다. 다만 «완료»는 만들지 않는다 —
             * 완료는 주관부서 담당자가 증빙을 확인해야 붙는 것이고(§5 MUST),
             * 2025년에 이 시스템에서 확인한 사람은 없다. 문서가 있으면 «진행중»,
             * 없으면 «미이행»이 사실이다.
             * 비해당도 만들지 않는다 — 사유를 대고 뺀 사람이 없기 때문이다. */
            return documentIdsOfStage(stageId, year).length > 0 ? ST.WIP : ST.NONE;
        }
        /* 2026 예시 자료 — st2025 와 **같은 방식**의 폴백이다. 저장소 override 가
           있으면 그쪽이 이기므로(위) 사용자가 바꾼 값은 시드가 덮지 않는다. */
        var sd = Y26();
        if (sd && sd.ST && year === +sd.META.year && sd.ST[stageId]) return sd.ST[stageId];
        return ST.NONE;
    }
    function statusLabel(code) { return ST_LABEL[code] || ST_LABEL[ST.NONE]; }
    function stageRecord(stageId, year) {
        year = +(year || DEFAULT_YEAR);
        var p = progOf(stageId, year) || {};
        return {
            stageId: stageId, year: year,
            status: statusOfStage(stageId, year),
            evidenceDocumentIds: p.evidenceDocumentIds || documentIdsOfStage(stageId, year),
            confirmedAt: p.confirmedAt || null, confirmedBy: p.confirmedBy || null,
            updatedAt: p.updatedAt || null, updatedBy: p.updatedBy || null,
            naReason: p.naReason || '',
            /* 완료였다가 담당자 수정으로 되돌아온 건 — 관리자가 다시 봐야 한다 */
            needsRecheck: !!p.needsRecheck,
            round: p.round || 0,
            /* 확인 반려 — status 와 **다른 축**이다(IMP-01).
               undefined = 반려 없음으로 파생되므로 옛 저장 데이터가 그대로 로드된다. */
            returned: p.returned || null,
            returnRound: p.returnRound || 0,
        };
    }
    /* 반려 여부만 묻는 자리(요약 집계)는 stageRecord 를 통째로 만들지 않는다 */
    function isReturned(stageId, year) {
        var p = progOf(stageId, +(year || DEFAULT_YEAR));
        return !!(p && p.returned);
    }

    function hasOperatingCycle(itemId) {
        var it = item(itemId);
        return !!(it && it.hasCycle);
    }
    function totalStageCount(itemId) { return stagesOfItem(itemId).length; }
    function completedStageCount(itemId, year) {
        return stagesOfItem(itemId).filter(function (s) {
            return statusOfStage(s.id, year) === ST.DONE;
        }).length;
    }
    /* 정기 주기를 가진 단계 수 — 바 노출 조건과 분모의 축이 다르다는 걸 화면이 밝히는 데 쓴다 */
    function cycleStageCount(itemId) {
        return stagesOfItem(itemId).filter(function (s) { return !!s.opCycle; }).length;
    }

    function progressOfItem(itemId, year) {
        var total = totalStageCount(itemId);
        var completed = completedStageCount(itemId, year);
        return {
            visible: hasOperatingCycle(itemId),
            completed: completed,
            total: total,
            /* 전체 단계 0 은 0으로 나누지 않고 데이터 오류로 처리한다(§10) */
            percentage: total > 0 ? Math.round(completed / total * 100) : 0,
            error: total === 0 ? '하위 업무단계 미등록' : '',
            cycleStages: cycleStageCount(itemId),
        };
    }

    /* 이행항목 단위 상태 요약 — 카드 헤더용 */
    function itemCounts(itemId, year) {
        var c = { not_started: 0, in_progress: 0, complete: 0, na: 0 };
        stagesOfItem(itemId).forEach(function (s) { c[statusOfStage(s.id, year)]++; });
        return c;
    }

    /* =========================================================================
     * 상태 전이 — 여기 한 곳에서만 (D-01)
     *   화면이 store().prog 를 직접 쓰지 않는다. 쓰면 '완료 처리'가 화면마다
     *   달라지고, 완료 후 수정의 환원이 한 화면에서만 동작한다.
     * ========================================================================= */
    /* 기록에 남는 이름은 화면이 조립하지 않는다 — DYROLE.actorLabel() 단일 출처
       (CLAUDE.md §14-9: by:'재난안전과' 하드코딩이면 남이 눌러도 그렇게 남는다). */
    function actor() {
        var r = R();
        return r && r.actorLabel ? r.actorLabel() : '시스템';
    }
    /* '관리자' = 재난안전과 담당자. 관리·감독(head/super)은 조회만 한다.
       판정 기준은 RSKLIST.canManage() 와 같다(CLAUDE.md §12). */
    function isManager() {
        var r = R();
        if (!r || !r.current) return true;              /* 롤 스위처 없는 환경 */
        var p = r.current();
        /* 계층 id 는 p.tier 다 — DYROLE.tier() 는 {label,tone,who,law} 서술 객체를
           돌려주므로 문자열 비교가 조용히 false 가 된다(실제로 낸 결함). */
        return !!p && p.tier === 'staff' && p.deptId === r.OWNER_DEPT;
    }
    /* '업로드 화면에 들어올 수 있나' — 부서를 특정하지 않은 진입 게이트다.
       ⚠ 이것만으로 저장을 허용하면 안 된다. 아래 canOwn() 이 **누구 이름으로**를 막는다. */
    function canUpload() { return R() && R().canAct ? R().canAct('') : true; }
    function canConfirm() { return isManager(); }
    function canDelete() { return isManager(); }
    function canSetNA() { return isManager(); }

    /* =========================================================================
     * 소유권 — '누구 이름으로 남길 수 있나' (MUST)
     * -------------------------------------------------------------------------
     * 조회(scope)·조작(canAct)과 별개로, **문서에 적히는 담당부서·담당자**는 아무나
     * 고를 수 없다. 종전에는 조직 선택기가 전 부서를 열어 두고 저장 계층도 값을
     * 그대로 받아, 물순환사업소 주무관이 재난안전과 박안전 이름으로 문서를 남길 수
     * 있었다 — 그게 곧 문서 위조다(CLAUDE.md §12).
     *
     * 판정은 DYROLE.canAct(deptId) 그대로다(새 규칙을 만들지 않는다):
     *   · 주관부서(재난안전과) 담당자 → 전 부서
     *   · 그 밖의 담당자             → 자기 부서만
     *   · 관리·감독(head/super)      → 불가
     * 조직 선택기의 rootId 도 같은 판정에서 파생한다(ownerRootId).
     * ========================================================================= */
    /* ⚠ 이 도메인은 부서를 **이름**으로 저장한다(DY_DOCS_V2 dept:'도시과' 와 같은 축).
       DYROLE.canAct 는 부서 **id**('water')를 비교하므로 반드시 변환해서 묻는다 —
       이름을 그대로 넘기면 자기 부서 건까지 전부 거부된다(CLAUDE.md §12 그대로의 함정). */
    function deptIdOfName(name) {
        var v = V();
        if (!name) return '';
        if (v && v.deptIdOf) { var id = v.deptIdOf(name); if (id) return id; }
        return name;                                /* 이미 id 로 넘어온 경우 */
    }
    function canOwn(deptName) {
        var r = R();
        if (!r || !r.canAct) return true;
        if (!deptName) return false;                /* 부서 없는 귀속은 허용하지 않는다 */
        var id = deptIdOfName(deptName);
        if (!id) return false;                      /* 조직도에 없는 부서 이름은 받지 않는다 */
        return r.canAct(id);
    }
    /* 조직 선택기에 열어 줄 뿌리 — 전 부서를 볼 자격이 없으면 자기 부서만 그린다.
       '숨기면 그만'이 아니라 저장 계층(assertOwn)이 같은 판정으로 다시 막는다. */
    function ownerRootId() {
        var r = R();
        if (!r || !r.current) return '';
        var p = r.current();
        if (!p) return '';
        if (p.tier === 'staff' && p.deptId === r.OWNER_DEPT) return '';   /* 주관부서 담당자 = 전 부서 */
        return p.deptId || '';
    }
    function ownDenyNote(deptName) {
        var r = R(), p = r && r.current ? r.current() : null;
        if (p && p.tier !== 'staff') return '관리·감독 계층은 문서를 등록·수정할 수 없습니다 — 담당자 본인이 수행합니다.';
        if (!deptName) return '담당부서·담당자를 지정해야 저장됩니다.';
        if (!deptIdOfName(deptName)) return '조직도에 없는 부서(' + deptName + ')입니다.';
        var mine = p && p.deptName ? p.deptName : '소속 부서';
        return '다른 부서(' + deptName + ') 이름으로는 등록·수정할 수 없습니다 — ' + mine + ' 건만 처리할 수 있습니다.';
    }
    /* 저장 직전 관문 — 화면을 우회한 전역 호출도 여기서 걸린다 */
    function assertOwn(deptId) {
        return canOwn(deptId) ? { ok: true } : { ok: false, reason: ownDenyNote(deptId) };
    }
    /* 이 문서를 이 사람이 고칠 수 있나 — 원장 문서는 주관부서 담당자만 */
    function canEditDoc(d) {
        if (!d) return false;
        if (d.origin !== 'user') return isManager();
        return canOwn(d.dept);
    }

    function log(kind, msg, refs) {
        store().log.unshift({ ts: nowTs(), by: actor(), kind: kind, msg: msg, refs: refs || {} });
        if (store().log.length > 500) store().log.length = 500;
    }

    /**
     * 업무단계 상태 전이.
     *   to: ST.WIP | ST.DONE | ST.NA | ST.NONE
     *   opt: { docId, reason, silent, kind }
     *        kind:'reject' 면 **확인 반려**다 — status 는 진행중 그대로 두고
     *        별도 축(returned·returnRound)에 사유를 남긴다(IMP-01).
     * 반환: { ok, reason }
     */
    function transition(stageId, year, to, opt) {
        opt = opt || {};
        year = +(year || DEFAULT_YEAR);
        if (!stage(stageId)) return { ok: false, reason: '없는 업무단계입니다.' };

        /* ── 확인 반려 ────────────────────────────────────────────────────
         * status 를 건드리지 않는 이유 — '진행중' 이분법을 소비하는 곳(요약 칩·
         * 진행률·필터)이 있어 값을 하나 더 넣으면 그 전부가 동시에 어긋난다
         * (위험성평가 improvement.confirm 선례 — CLAUDE.md §4-3).
         * 사유 검사는 화면이 아니라 **여기**서 한다 — 전역 호출로 뚫리지 않게. */
        var reject = opt.kind === 'reject';
        if (reject) {
            if (!canConfirm()) return { ok: false, reason: '확인 반려는 주관부서(재난안전과) 담당자만 할 수 있습니다.' };
            if (!String(opt.reason || '').trim()) {
                return { ok: false, reason: '반려 사유를 입력해야 저장됩니다 — 담당자가 무엇을 다시 해야 하는지 알 수 없습니다.' };
            }
        }
        if (to === ST.DONE && !canConfirm()) {
            return { ok: false, reason: '완료 확인은 주관부서(재난안전과) 담당자만 할 수 있습니다.' };
        }
        if (to === ST.NA) {
            if (!canSetNA()) return { ok: false, reason: '해당없음 처리는 주관부서(재난안전과) 담당자만 할 수 있습니다.' };
            /* 사유 없는 '해당없음'은 저장하지 않는다 — 종이 서식의 실패 모드가
               미이행이 아니라 '해당 없음으로 적고 빠져나가는 것'이었다(CLAUDE.md §4-2) */
            if (!String(opt.reason || '').trim()) return { ok: false, reason: '해당없음 사유를 입력해야 저장됩니다.' };
        }

        var k = pkey(stageId, year);
        var p = store().prog[k] || { stageId: stageId, year: year, evidenceDocumentIds: [], round: 0 };
        var from = statusOfStage(stageId, year);

        p.status = to;
        p.updatedAt = nowTs();
        p.updatedBy = actor();
        if (opt.docId && p.evidenceDocumentIds.indexOf(opt.docId) < 0) p.evidenceDocumentIds.push(opt.docId);

        if (to === ST.DONE) {
            p.confirmedAt = nowTs(); p.confirmedBy = actor(); p.needsRecheck = false;
        } else {
            /* 완료였다가 내려온 건 재확인 대상으로 남긴다 */
            if (from === ST.DONE) { p.needsRecheck = true; p.round = (p.round || 0) + 1; }
            p.confirmedAt = null; p.confirmedBy = null;
        }
        if (to === ST.NA) p.naReason = String(opt.reason || '').trim();
        else p.naReason = '';

        if (reject) {
            p.returned = { reason: String(opt.reason).trim(), at: nowTs(), by: actor() };
            /* 회차는 누적이다 — 재제출이 표시를 지워도 몇 번 반려됐는지는 남는다 */
            p.returnRound = (p.returnRound || 0) + 1;
        } else if (to !== ST.WIP) {
            /* 완료·해당없음·미이행으로 정리되면 반려는 해소된 것이다.
               (진행중 → 진행중 은 applyDocument 가 재제출로 판단해 지운다) */
            delete p.returned;
        }

        store().prog[k] = p;
        if (!opt.silent) {
            log(reject ? 'reject' : 'transition',
                reject
                    ? stage(stageId).name + ' — 확인 반려 ' + p.returnRound + '회 (' + p.returned.reason + ')'
                    : stage(stageId).name + ' — ' + statusLabel(from) + ' → ' + statusLabel(to) +
                      (opt.reason ? ' (' + opt.reason + ')' : ''),
                { stageId: stageId, year: year });
        }
        save();
        return { ok: true };
    }

    /** 문서 저장·수정 후 관련 단계를 일괄 갱신.
     *  완료였던 단계는 진행중으로 **환원**한다(D-01) — 재확인을 받아야 한다. */
    function applyDocument(docId, stageIds, year) {
        year = +(year || DEFAULT_YEAR);
        var reverted = [], cleared = [];
        (stageIds || []).forEach(function (sid) {
            if (statusOfStage(sid, year) === ST.DONE) reverted.push(sid);
            transition(sid, year, ST.WIP, { docId: docId, silent: true });
            /* 재제출이 반려 표시를 지운다(IMP-01) — 회차(returnRound)는 남긴다.
               지우지 않으면 다시 올린 뒤에도 '반려됨' 이 남아 담당자가 또 올린다. */
            var p = store().prog[pkey(sid, year)];
            if (p && p.returned) { delete p.returned; cleared.push(sid); }
        });
        log('upload', '문서 ' + docId + ' — 업무단계 ' + (stageIds || []).length + '개 진행중' +
            (reverted.length ? ' (완료 ' + reverted.length + '개 환원)' : '') +
            (cleared.length ? ' (반려 ' + cleared.length + '개 해소)' : ''), { docId: docId });
        save();
        return { reverted: reverted, cleared: cleared };
    }

    /** 완료 처리 대상이 어느 단계인지 미리 알려준다 (수정 경고용) */
    function completedAmong(stageIds, year) {
        return (stageIds || []).filter(function (s) { return statusOfStage(s, year) === ST.DONE; });
    }

    /* =========================================================================
     * 사용자 문서 CRUD — 회수 경로를 함께 만든다 (CLAUDE.md §4 CRUD MUST)
     * ========================================================================= */
    function nextDocId(year) {
        var n = store().docs.length + 1;
        var id;
        do { id = 'DOC-' + year + '-U' + ('000' + n).slice(-4); n++; } while (docById(id));
        return id;
    }

    function addDocument(d) {
        /* 소유권은 화면이 아니라 여기서 막는다 — 전역 호출로도 뚫리지 않게 */
        var own = assertOwn(d && d.dept);
        if (!own.ok) return { ok: false, reason: own.reason };
        var year = +(d.year || DEFAULT_YEAR);
        var doc = {
            id: d.id || nextDocId(year),
            title: String(d.title || '').trim(),
            sr: String(d.sr || '').trim(),
            date: d.date || today(),
            year: year,
            stageIds: (d.stageIds || []).slice(),
            cycle: d.cycle || '',
            src: d.src || 'upload',
            /* 방향 — 없으면 저장하지 않는다(옛 데이터와 같은 «미상»이 된다) */
            dir: DIR[d.dir] ? d.dir : null,
            status: d.status || SRC[d.src || 'upload'].status[0],
            dept: d.dept || '', assignee: d.assignee || '',
            note: d.note || '',
            files: (d.files || []).slice(),
            origin: d.origin || 'user',
            dataMode: 'user', statusSource: 'user',
            presetOf: d.presetOf || null,
            createdAt: nowTs(), createdBy: actor(),
            mapped: (d.stageIds || []).length > 0,
        };
        store().docs.push(doc);
        save();
        applyDocument(doc.id, doc.stageIds, year);
        return { ok: true, doc: doc };
    }

    function updateDocument(id, patch) {
        var list = store().docs;
        var i = -1;
        for (var k = 0; k < list.length; k++) { if (list[k].id === id) { i = k; break; } }
        if (i < 0) return { ok: false, reason: '시드 문서는 수정할 수 없습니다. 새 문서로 등록해 주세요.' };
        /* 남의 부서 문서를 고칠 수 없고, 남의 부서로 **옮길** 수도 없다 */
        var cur = assertOwn(list[i].dept);
        if (!cur.ok) return cur;
        if (patch && patch.dept !== undefined) {
            var next = assertOwn(patch.dept);
            if (!next.ok) return next;
        }
        var before = list[i].stageIds.slice();
        Object.keys(patch || {}).forEach(function (k2) { list[i][k2] = patch[k2]; });
        list[i].mapped = list[i].stageIds.length > 0;
        list[i].updatedAt = nowTs(); list[i].updatedBy = actor();
        save();
        /* 빠진 단계는 증빙이 사라진 것이므로 진행중으로 내린다 */
        before.forEach(function (sid) {
            if (list[i].stageIds.indexOf(sid) < 0 && statusOfStage(sid, list[i].year) === ST.DONE) {
                transition(sid, list[i].year, ST.WIP, { silent: true });
            }
        });
        applyDocument(id, list[i].stageIds, list[i].year);
        return { ok: true, doc: list[i] };
    }

    function removeDocument(id) {
        if (!canDelete()) return { ok: false, reason: '문서 삭제는 주관부서(재난안전과) 담당자만 할 수 있습니다.' };
        var list = store().docs;
        var i = -1;
        for (var k = 0; k < list.length; k++) { if (list[k].id === id) { i = k; break; } }
        if (i < 0) return { ok: false, reason: '원장 문서는 삭제할 수 없습니다.' };
        var d = list[i];
        list.splice(i, 1);
        save();
        /* 증빙이 사라진 단계는 다시 판정한다 — 남은 문서가 없으면 미이행 */
        d.stageIds.forEach(function (sid) {
            if (documentIdsOfStage(sid, d.year).length === 0) transition(sid, d.year, ST.NONE, { silent: true });
        });
        log('delete', '문서 삭제 — ' + d.title + ' (단계 ' + d.stageIds.length + '개)', { docId: id });
        save();
        return { ok: true, doc: d };
    }

    /* =========================================================================
     * 원장 교정 — 미분류 지정 · 근사 중복 병합 (관리자)
     * -------------------------------------------------------------------------
     * 원자료(생성물)는 고치지 않는다. 교정은 store().fix 에 **덧씌우기**로 쌓고
     * build() 가 원장 위에 얹는다 — 원본을 지우면 무엇을 고쳤는지 추적이 끊긴다.
     * ========================================================================= */
    function fixes() { var s = store(); if (!s.fix) s.fix = {}; return s.fix; }

    function remapLedger(docId, stageIds) {
        if (!isManager()) return { ok: false, reason: '미분류 교정은 주관부서(재난안전과) 담당자만 할 수 있습니다.' };
        var d = docById(docId);
        if (!d || d.origin !== 'ledger') return { ok: false, reason: '원장 문서만 교정할 수 있습니다.' };
        var ids = (stageIds || []).filter(function (s) { return !!stage(s); });
        if (!ids.length) return { ok: false, reason: '업무단계를 하나 이상 지정해야 합니다.' };
        fixes()[docId] = { stageIds: ids, at: nowTs(), by: actor() };
        log('remap', '미분류 교정 — ' + d.title + ' → 업무단계 ' + ids.length + '개', { docId: docId });
        save();
        applyDocument(docId, ids, d.year);
        return { ok: true, doc: docById(docId) };
    }

    function mergeNearDup(docId) {
        if (!isManager()) return { ok: false, reason: '중복 정리는 주관부서(재난안전과) 담당자만 할 수 있습니다.' };
        var d = docById(docId);
        if (!d || !d.nearDup || !d.nearDup.length) return { ok: false, reason: '중복 후보가 없습니다.' };
        var merged = 0, all = d.stageIds.slice();
        d.nearDup.forEach(function (oid) {
            var o = docById(oid); if (!o) return;
            o.stageIds.forEach(function (s) { if (all.indexOf(s) < 0) all.push(s); });
            fixes()[oid] = { mergedInto: docId, at: nowTs(), by: actor() };
            merged++;
        });
        var f = fixes()[docId] || {};
        f.stageIds = all; f.at = nowTs(); f.by = actor();
        fixes()[docId] = f;
        log('merge', '중복 정리 — ' + d.title + ' 로 ' + merged + '건 병합', { docId: docId });
        save();
        applyDocument(docId, all, d.year);
        return { ok: true, merged: merged };
    }

    /** 삭제·수정 영향 범위 — 확인 모달에 반드시 명시한다 */
    function impactOf(id) {
        var d = docById(id);
        if (!d) return null;
        var items = itemIdsOfDocument(id);
        return {
            title: d.title, stages: d.stageIds.length, items: items.length,
            files: (d.files || []).length,
            completed: completedAmong(d.stageIds, d.year).length,
        };
    }

    /* =========================================================================
     * 요약 (이행 목록 상단)
     * ========================================================================= */
    function summary(year) {
        year = +(year || DEFAULT_YEAR);
        var c = { not_started: 0, in_progress: 0, complete: 0, na: 0 };
        var returned = 0;
        T().STAGES.forEach(function (s) {
            c[statusOfStage(s.id, year)]++;
            if (isReturned(s.id, year)) returned++;
        });
        var docs = allDocs();
        return {
            year: year,
            items: T().ITEMS.length,
            stages: T().STAGES.length,
            counts: c,
            /* 반려는 status 축이 아니므로 counts 안에 넣지 않는다 — 넣으면 합이 업무단계 수를 넘는다 */
            returned: returned,
            unmapped: docs.filter(function (d) { return d.origin === 'ledger' && !d.mapped; }).length,
            nearDup: docs.filter(function (d) { return d.nearDup; }).length,
            docsOfYear: docs.filter(function (d) { return d.year === year; }).length,
        };
    }

    /* 화면이 '정기 주기 없음'을 같은 말로 내도록 문구도 한 곳에서 */
    function noCycleNote() { return '상시·수시 항목 — 정기 주기 없음'; }

    /* =========================================================================
     * 내 부서 관련 업무단계 — **추정** 파생 (IMP-02)
     * -------------------------------------------------------------------------
     * 확정 담당부서 연계(새올·온나라 — DYPOLICY 'doc-dept-src')를 받기 전까지의
     * 대체 동작이다. 원자료 `적용대상` 문구에서 부서명을 찾는다.
     *   ① 부서명(전체 또는 접미어를 뗀 형태, 2자 이상)을 포함하거나
     *   ② 전부서형 문구(전 부서·각 부서·전체 부서)를 포함하면 그 부서 몫으로 본다.
     *
     * 판정을 여기 한 곳에 두는 이유 — 화면이 각자 문자열 매칭을 복제하면 이행
     * 목록과 다른 화면이 서로 다른 '내 부서'를 말하게 된다(CLAUDE.md §5).
     * ⚠ 이것은 확정 매핑이 아니다. 화면은 반드시 '추정'임을 함께 밝힌다.
     * ========================================================================= */
    var ALLDEPT_RE = /(전\s*부서|각\s*부서|전체\s*부서)/;
    /* 담양군 부서 접미어 — '물순환사업소'→'물순환', '재난안전과'→'재난안전'.
       원자료가 접미어를 떼고 부르는 자리가 많다("건설과·물순환·공공시설"). */
    var DEPTSUFFIX_RE = /(사업소|보건소|사업단|센터|과|실|소|단|읍|면)$/;
    function deptAliases(deptName) {
        var n = String(deptName || '').trim();
        if (!n) return [];
        var out = [n];
        var short = n.replace(DEPTSUFFIX_RE, '');
        /* 1자로 줄면 아무 문장에나 걸린다('과'·'소') — 2자 미만은 쓰지 않는다 */
        if (short.length >= 2 && out.indexOf(short) < 0) out.push(short);
        return out;
    }
    function stageDeptHit(s, deptName) {
        if (!s) return false;
        var t = String(s.target || '');
        if (!t) return false;
        if (ALLDEPT_RE.test(t)) return true;
        var al = deptAliases(deptName);
        for (var i = 0; i < al.length; i++) { if (t.indexOf(al[i]) >= 0) return true; }
        return false;
    }

    global.DYDOCS = {
        /* 상수 */
        ST: ST, ST_ORDER: ST_ORDER, SRC: SRC, SRC_ORDER: SRC_ORDER,
        DIR: DIR, DIR_ORDER: DIR_ORDER, dirOf: dirOf, srText: srText,
        BASE_YEAR: BASE_YEAR, DEFAULT_YEAR: DEFAULT_YEAR, SKEY: SKEY, seedStale: seedStale,
        defaultYear: defaultYear, yearsWithData: yearsWithData, presetSourceYear: presetSourceYear,
        /* 소유권 */
        canOwn: canOwn, ownerRootId: ownerRootId, assertOwn: assertOwn,
        canEditDoc: canEditDoc, ownDenyNote: ownDenyNote,
        /* 분류 */
        items: function () { return T().ITEMS; },
        stages: function () { return T().STAGES; },
        item: item, stage: stage, stagesOfItem: stagesOfItem,
        /* 문서 축 */
        allDocs: allDocs, docById: docById,
        documentIdsOfStage: documentIdsOfStage,
        stageIdsOfDocument: stageIdsOfDocument,
        itemIdsOfDocument: itemIdsOfDocument,
        /* 상태·진행률 (§10 계약) */
        statusOfStage: statusOfStage, statusLabel: statusLabel, stageRecord: stageRecord,
        isReturned: isReturned, stageDeptHit: stageDeptHit, deptAliases: deptAliases,
        progressOfItem: progressOfItem, completedStageCount: completedStageCount,
        totalStageCount: totalStageCount, hasOperatingCycle: hasOperatingCycle,
        cycleStageCount: cycleStageCount, itemCounts: itemCounts,
        /* 전이 */
        transition: transition, applyDocument: applyDocument, completedAmong: completedAmong,
        /* CRUD */
        addDocument: addDocument, updateDocument: updateDocument,
        remapLedger: remapLedger, mergeNearDup: mergeNearDup,
        removeDocument: removeDocument, impactOf: impactOf,
        /* 권한 */
        isManager: isManager, canUpload: canUpload, canConfirm: canConfirm,
        canDelete: canDelete, canSetNA: canSetNA, actor: actor,
        /* 기타 */
        summary: summary, noCycleNote: noCycleNote, curYear: curYear, today: today,
        store: store, saveStore: save, reset: reset, log: log,
    };
}(window));
