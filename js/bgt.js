/* =========================================================================
 * 담양군 중대재해예방 통합관리시스템 v2 — 예산관리 (BGT)
 *   · 데이터 레이어 (window.DYBGT) + BGT01-V 예산 총괄표 화면 렌더
 *   · localStorage 영속 키 'dybgt-v6' = { targets, items, sheets, policies }
 *   · 화면 렌더는 #bgt-app 가 있을 때만 실행 (bgt-settings.html은 데이터 레이어로만 로드)
 *
 * 요구사항 매핑 (화면 정의서 추적용):
 *   R2 — 편성·집행·집행률 진행 확인 (KPI + 총괄 테이블 + 프로그레스 바)
 *   R4 — 기관별·시설별 편성·집행 점검표 생성 (대상은 targets 마스터에서)
 *   R5 — 점검표 등록·조회·수정
 *   R6 — 전자결재(온나라) — 기안함으로 보내기(결재선 없음, 운영 결정 2026-11-06) + 결재 결과 회신 등록
 *
 *   점검 대상 = 조직도(기관)·시설물 대장(시설) 연계 선택.
 *     · 기관 원본 = 타 메뉴 공용 조직도(window.EDOC.ORG_TREE 부서 목록)
 *     · 시설 원본 = 시설물 대장(DYFACIL, 종별·안전등급)
 *     · 자체 수기 원본·별도 FMS 명단은 만들지 않고 원천 선택값만 보존한다.
 * ========================================================================= */
(function () {
    'use strict';

    /* **결재선 스키마가 바뀌면 키를 올린다** — v3 시절 시드는 결재선이 `이팀장`·`김과장`·
       `부군수` 4단계에 uid 가 없었다. 키를 그대로 두면 **이미 열어 본 브라우저만** 그 옛
       이력을 영구히 갖고, 새 브라우저와 화면이 달라진다(2026-08-28 검수 C-5).
       v4 = 3단계 결재선 · uid 저장 · 회신 등록 경로. 옛 키는 지워 혼선을 막는다. */
    /* ── 조작 권한 (CLAUDE.md §12 · 2026-08-28 검수 B-2) ────────────────
     * **온나라로 보내기는 기안 행위다.** 조회 전용 계층이 보내기를 누르면
     * 그 사람이 기안자로 온나라 기안함에 올라간다. 그래서 보내기 경로만 담당자로
     * 좁힌다 — 화면 전체를 조회 전용으로 만드는 것은 §12 2단계(발주처 정책 확정 후)라
     * 여기서 하지 않는다. 판정은 DYROLE.canAct() 단일 출처. */
    function canDraft() { return !window.DYROLE || window.DYROLE.canAct(''); }
    const DRAFT_DENY = '온나라로 보내기는 <b>담당자</b>가 합니다 — 관리·감독 계층은 조회만 합니다.';

    const KEY = 'dybgt-v7';   /* v7: 결재선 없이 온나라로 보내기(운영 결정 2026-11-06) · 상태 «기안함 전송»·«반송» · v6: 예시 자료 2025~2027 (2026-11-13 기준) · v5: 결재완료 회신의 생산등록번호·결재일(2026-11-05) */
    try { localStorage.removeItem('dybgt-v3'); localStorage.removeItem('dybgt-v5'); localStorage.removeItem('dybgt-v6'); } catch (e) {}
    /* DYV2.esc 재사용 (XSS 방지) — common.js 로드 전 호출 대비 폴백 */
    const esc = s => (window.DYV2 && DYV2.esc)
        ? DYV2.esc(s)
        : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

    /* 시설물 대장 모듈이 없는 단위 시연에서만 쓰는 폴백. 운영 원본은 DYFACIL이다. */
    const FAC_FALLBACK = [
        { name: '담양군민체육관', cls: '1종', grade: 'B' },
        { name: '담양공공도서관', cls: '2종', grade: 'A' },
        { name: '죽녹원 관리사무소', cls: '3종', grade: 'B' },
        { name: '담양하수처리장', cls: '1종', grade: 'C' },
        { name: '담양문화회관', cls: '2종', grade: 'B' },
        { name: '담양군립요양병원', cls: '1종', grade: 'A' },
        { name: '담양청소년수련관', cls: '2종', grade: 'B' },
        { name: '담양국민체육센터', cls: '1종', grade: 'C' },
        { name: '메타세쿼이아랜드 관리동', cls: '3종', grade: 'D' },
    ];

    /* ─────────────────────────────────────────────────────────────────────
     * 스토어 + 시드
     * ───────────────────────────────────────────────────────────────────── */
    function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
    function persist(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }

    function seed() {
        /* ── 점검 대상 (3차) ──
         * 원천에서 '추가된' 대상만 시드. 픽커 데모 목적으로 최소 축소:
         *   기관(org) = 조직도 연계 2건(재난안전과·환경과, src '조직도')
         *   시설(fac) = 시설물 대장 연계 2건(담양군민체육관·담양하수처리장) */
        const facSeed = ['담양군민체육관', '담양하수처리장'].map((name, i) => {
            const src = facilitySources().find(f => f.name === name) || {};
            return { id: 'tg-f' + (i + 1), sourceId: src.id || '', name, src: '시설물 대장', cls: src.cls || '', grade: src.grade || '' };
        });
        const targets = {
            org: ['재난안전과', '환경과'].map((name, i) => ({ id: 'tg-o' + (i + 1), sourceId: orgSourceId(name), name, src: '조직도' })),
            fac: facSeed,
        };

        /* 예방 항목 트리 — 대분류 3종 + 하위 (parentId null = 대분류) */
        const items = [
            { id: 'it-1', name: '시설', parentId: null },
            { id: 'it-2', name: '비상유도등·소방설비', parentId: 'it-1' },
            { id: 'it-3', name: '안전난간·추락방지', parentId: 'it-1' },
            { id: 'it-4', name: '장비', parentId: null },
            { id: 'it-5', name: '안전점검 장비', parentId: 'it-4' },
            { id: 'it-6', name: '작업용 장비', parentId: 'it-4' },
            { id: 'it-7', name: '안전장구류', parentId: null },
            { id: 'it-8', name: '안전모·안전화', parentId: 'it-7' },
            { id: 'it-9', name: '안전대·보호구', parentId: 'it-7' },
        ];

        /* 시트 rows 헬퍼 (plan·exec 단위: 천원) */
        const row = (itemId, plan, exec, note) => ({ itemId, plan, exec, note: note || '' });

        /* 기안자 — **예시 값**이다(§15). 운영 결정(2026-11-06)대로 이 시스템은 결재선을 받지 않고
           온나라 기안함까지만 보낸다 — 검토·결재는 담당자가 온나라에서 지정한다(_공통_권한정의 §7 머리).
           그래서 예시 이력에도 결재자 이름을 지어 넣지 않는다. */
        const LINE = () => ({ by: '박안전', byUid: 'u_jjt2', sample: true });
        /* 예시 자료 기간(2026-11-13 기준) — 2025 편성·집행 종결 · 2026 편성은 2~3월 결재완료 후
           10~11월까지 집행액 등록 · 2027 편성은 11월 작성·상신 중. 생산등록번호·결재일은 예시 값(§15). */
        const sheets = [
            /* ── 2026 — 승인완료 4건(집행 진행) ── */
            {
                id: 'bs-2026-1', year: 2026, targetType: '기관', target: '재난안전과',
                rows: [
                    row('it-2', 120000, 118500, '청사 비상유도등 교체 완료(10월)'),
                    row('it-3', 90000, 84000, '옥상 안전난간 보강 준공(9월) · 잔액 정산 중'),
                    row('it-8', 40000, 36200, '안전모·안전화 상·하반기 구입'),
                ],
                status: '승인완료', rejectReason: '',
                onnara: {
                    docNo: '온나라-2026-0187',
                    prodNo: '재난안전과-312', apprDate: '2026-02-06',
                    approval: LINE(),
                    steps: [
                        { at: '2026-02-03 10:20', act: '온나라로 보내기', by: '박안전', note: '기안함 전송' },
                        { at: '2026-02-06 09:40', act: '결재 완료 회신', by: '박안전', note: '승인완료' },
                    ],
                },
                history: [
                    { at: '2026-01-20 09:30', ev: '점검표 생성' },
                    { at: '2026-02-03 10:20', ev: '온나라 기안함으로 보냄 (온나라-2026-0187)' },
                    { at: '2026-02-06 09:40', ev: '온나라 결재 완료 회신 — 재난안전과-312 · 2026-02-06' },
                    { at: '2026-06-30 16:20', ev: '상반기 집행액 등록' },
                    { at: '2026-11-10 17:05', ev: '10월분 집행액 등록' },
                ],
                updated: '2026-11-10 17:05',
            },
            {
                id: 'bs-2026-2', year: 2026, targetType: '시설', target: '담양군민체육관',
                rows: [
                    row('it-2', 60000, 52000, '체육관 소방설비 정비 완료'),
                    row('it-6', 50000, 38500, '작업용 리프트 임차(3~10월)'),
                    row('it-9', 30000, 21000, '보호구 비치 · 11월 추가 구입 예정'),
                ],
                status: '승인완료', rejectReason: '',
                onnara: {
                    docNo: '온나라-2026-0231',
                    prodNo: '재난안전과-358', apprDate: '2026-02-13',
                    approval: LINE(),
                    steps: [
                        { at: '2026-02-10 15:40', act: '온나라로 보내기', by: '박안전', note: '기안함 전송' },
                        { at: '2026-02-13 09:20', act: '결재 완료 회신', by: '박안전', note: '승인완료' },
                    ],
                },
                history: [
                    { at: '2026-01-22 10:00', ev: '점검표 생성' },
                    { at: '2026-02-10 15:40', ev: '온나라 기안함으로 보냄 (온나라-2026-0231)' },
                    { at: '2026-02-13 09:20', ev: '온나라 결재 완료 회신 — 재난안전과-358 · 2026-02-13' },
                    { at: '2026-06-29 11:00', ev: '상반기 집행액 등록' },
                    { at: '2026-11-04 10:05', ev: '10월분 집행액 등록' },
                ],
                updated: '2026-11-04 10:05',
            },
            /* 한 번 반려(산출 근거 보완) 뒤 재상신해 결재완료 */
            {
                id: 'bs-2026-3', year: 2026, targetType: '기관', target: '환경과',
                rows: [
                    row('it-5', 70000, 41000, '가스측정기·소음계 구입 · 하반기 교정 예정'),
                    row('it-6', 45000, 29500, '선별라인 작업용 장비 교체'),
                ],
                status: '승인완료', rejectReason: '',
                onnara: {
                    docNo: '온나라-2026-0294',
                    prodNo: '재난안전과-447', apprDate: '2026-03-03',
                    approval: LINE(),
                    steps: [
                        { at: '2026-02-16 13:30', act: '온나라로 보내기', by: '박안전', note: '기안함 전송' },
                        { at: '2026-02-20 11:10', act: '반려 회신', by: '박안전', note: '2026-02-20 · 안전점검 장비 산출 근거(견적 2건) 보완' },
                        { at: '2026-02-25 09:50', act: '온나라로 보내기', by: '박안전', note: '기안함 전송' },
                        { at: '2026-03-03 10:00', act: '결재 완료 회신', by: '박안전', note: '승인완료' },
                    ],
                },
                history: [
                    { at: '2026-02-02 10:00', ev: '점검표 생성' },
                    { at: '2026-02-16 13:30', ev: '온나라 기안함으로 보냄 (온나라-2026-0294)' },
                    { at: '2026-02-20 11:10', ev: '온나라 반려 회신(2026-02-20) — 안전점검 장비 산출 근거(견적 2건) 보완' },
                    { at: '2026-02-25 09:50', ev: '온나라 기안함으로 보냄 (온나라-2026-0294)' },
                    { at: '2026-03-03 10:00', ev: '온나라 결재 완료 회신 — 재난안전과-447 · 2026-03-03' },
                    { at: '2026-10-30 15:40', ev: '9~10월분 집행액 등록' },
                ],
                updated: '2026-10-30 15:40',
            },
            {
                id: 'bs-2026-4', year: 2026, targetType: '시설', target: '담양하수처리장',
                rows: [
                    row('it-3', 80000, 52000, '침전지 안전난간 교체 1단계 준공 · 2단계 11월 착공'),
                    row('it-8', 25000, 18000, '안전모·안전화 지급'),
                    row('it-9', 20000, 11500, '밀폐공간 송기마스크·안전대 구입'),
                ],
                status: '승인완료', rejectReason: '',
                onnara: {
                    docNo: '온나라-2026-0356',
                    prodNo: '재난안전과-502', apprDate: '2026-03-12',
                    approval: LINE(),
                    steps: [
                        { at: '2026-03-09 14:20', act: '온나라로 보내기', by: '박안전', note: '기안함 전송' },
                        { at: '2026-03-12 11:15', act: '결재 완료 회신', by: '박안전', note: '승인완료' },
                    ],
                },
                history: [
                    { at: '2026-02-23 11:15', ev: '점검표 생성' },
                    { at: '2026-03-09 14:20', ev: '온나라 기안함으로 보냄 (온나라-2026-0356)' },
                    { at: '2026-03-12 11:15', ev: '온나라 결재 완료 회신 — 재난안전과-502 · 2026-03-12' },
                    { at: '2026-07-03 10:30', ev: '상반기 집행액 등록' },
                    { at: '2026-11-11 16:50', ev: '10월분 집행액 등록' },
                ],
                updated: '2026-11-11 16:50',
            },
            /* ── 2027 편성 — 11월 작성·상신 중 ── */
            {
                id: 'bs-2027-1', year: 2027, targetType: '기관', target: '재난안전과',
                rows: [
                    row('it-2', 130000, 0, ''),
                    row('it-3', 95000, 0, ''),
                    row('it-8', 45000, 0, ''),
                ],
                status: '결재중', rejectReason: '',
                onnara: {
                    docNo: '온나라-2026-2214',
                    approval: LINE(),
                    steps: [
                        { at: '2026-11-11 10:20', act: '온나라로 보내기', by: '박안전', note: '기안함 전송' },
                        { at: '2026-11-12 15:05', act: '결재중 반영', by: '박안전', note: '온나라 기안함에서 검토·결재 지정 후 상신' },
                    ],
                },
                history: [
                    { at: '2026-11-03 09:10', ev: '점검표 생성' },
                    { at: '2026-11-11 10:20', ev: '온나라 기안함으로 보냄 (온나라-2026-2214)' },
                    { at: '2026-11-12 15:05', ev: '온나라에서 상신 — 결재중' },
                ],
                updated: '2026-11-12 15:05',
            },
            {
                id: 'bs-2027-2', year: 2027, targetType: '시설', target: '담양군민체육관',
                rows: [
                    row('it-2', 65000, 0, ''),
                    row('it-6', 40000, 0, ''),
                    row('it-9', 0, 0, '보호구 수량 확인 중'),
                ],
                status: '작성중', rejectReason: '',
                onnara: null,
                history: [
                    { at: '2026-11-09 14:00', ev: '점검표 생성' },
                ],
                updated: '2026-11-12 11:30',
            },
            /* ── 2025 — 편성·집행 종결(지난 기록) ── */
            {
                id: 'bs-2025-1', year: 2025, targetType: '기관', target: '재난안전과',
                rows: [
                    row('it-2', 110000, 108900, '비상유도등 1차 교체'),
                    row('it-3', 80000, 79200, '계단 안전난간 보강'),
                    row('it-8', 35000, 35000, '안전모·안전화 일괄 구입'),
                ],
                status: '승인완료', rejectReason: '',
                onnara: {
                    docNo: '온나라-2025-0164',
                    prodNo: '재난안전과-298', apprDate: '2025-02-11',
                    approval: LINE(),
                    steps: [
                        { at: '2025-02-06 10:00', act: '온나라로 보내기', by: '박안전', note: '기안함 전송' },
                        { at: '2025-02-11 09:30', act: '결재 완료 회신', by: '박안전', note: '승인완료' },
                    ],
                },
                history: [
                    { at: '2025-01-21 09:00', ev: '점검표 생성' },
                    { at: '2025-02-06 10:00', ev: '온나라 기안함으로 보냄 (온나라-2025-0164)' },
                    { at: '2025-02-11 09:30', ev: '온나라 결재 완료 회신 — 재난안전과-298 · 2025-02-11' },
                    { at: '2025-12-29 16:00', ev: '연말 집행액 확정 등록' },
                ],
                updated: '2025-12-29 16:00',
            },
            {
                id: 'bs-2025-2', year: 2025, targetType: '시설', target: '담양군민체육관',
                rows: [
                    row('it-2', 55000, 54200, '소방설비 정비'),
                    row('it-6', 45000, 43800, '작업용 리프트 임차'),
                    row('it-9', 25000, 24100, '보호구 비치'),
                ],
                status: '승인완료', rejectReason: '',
                onnara: {
                    docNo: '온나라-2025-0219',
                    prodNo: '재난안전과-341', apprDate: '2025-02-18',
                    approval: LINE(),
                    steps: [
                        { at: '2025-02-13 15:00', act: '온나라로 보내기', by: '박안전', note: '기안함 전송' },
                        { at: '2025-02-18 09:10', act: '결재 완료 회신', by: '박안전', note: '승인완료' },
                    ],
                },
                history: [
                    { at: '2025-01-23 10:30', ev: '점검표 생성' },
                    { at: '2025-02-13 15:00', ev: '온나라 기안함으로 보냄 (온나라-2025-0219)' },
                    { at: '2025-02-18 09:10', ev: '온나라 결재 완료 회신 — 재난안전과-341 · 2025-02-18' },
                    { at: '2025-12-30 11:20', ev: '연말 집행액 확정 등록' },
                ],
                updated: '2025-12-30 11:20',
            },
        ];

        const policies = [
            {
                id: 'pol-1',
                title: '2026년도 안전보건 예산 편성·집행 관리 원칙',
                effective: '2026-01-01',
                body: '1. 안전보건 예산은 시설·장비·안전장구류 3대 분야로 구분해 편성한다.\n2. 각 기관·시설은 연 1회 편성·집행 점검표를 작성하고 온나라 전자결재로 상신한다.\n3. 집행액과 비고는 승인 이후에도 상시 등록해 집행률을 실시간으로 관리한다.\n4. 집행률 70% 미만 항목은 반기 점검 시 사유를 확인한다.',
                files: ['2026_안전보건예산_관리원칙.hwp'],
                updated: '2026-01-02 09:00',
            },
        ];

        const d = { targets, items, sheets, policies };
        persist(d);
        return d;
    }

    /* 최초 로드 시 시드 저장 (구 키 'dybgt-v1'·'dybgt-v2'는 무시 — 대상 연계 개편에 따른 마이그레이션) */
    let _data = load();
    if (!_data || !_data.targets || !_data.items || !_data.sheets || !_data.policies) { _data = seed(); }

    /* 구 저장값을 원천 식별값·선택 당시 스냅샷 계약으로 보강한다. */
    (function migrateTargetRefs() {
        ['org', 'fac'].forEach(bucket => (_data.targets[bucket] || []).forEach(t => {
            if (!t.sourceId) {
                const hit = listSources(bucket === 'fac' ? '시설' : '기관').find(s => s.name === t.name);
                t.sourceId = hit ? hit.id : '';
            }
        }));
        (_data.sheets || []).forEach(s => {
            const bucket = s.targetType === '시설' ? _data.targets.fac : _data.targets.org;
            const hit = bucket.find(t => t.name === s.target);
            if (!s.targetId && hit) s.targetId = hit.id;
            if (!s.targetSourceId && hit) s.targetSourceId = hit.sourceId || '';
            if (!s.targetSnapshot) s.targetSnapshot = s.target;
            (s.rows || []).forEach(r => { if (!r.itemSnapshot) r.itemSnapshot = itemPath(r.itemId); });
        });
        persist(_data);
    })();

    function data() { return _data; }
    function save() { persist(_data); }

    /* ─────────────────────────────────────────────────────────────────────
     * 포맷 / 항목 트리
     * ───────────────────────────────────────────────────────────────────── */
    /* '480,000천원' 형식 (3자리 콤마 + '천원') */
    function fmtAmt(n) {
        const v = Number(n) || 0;
        return v.toLocaleString('en-US') + '천원';
    }

    function itemChildren(parentId) {
        const pid = parentId == null ? null : parentId;
        return _data.items.filter(i => (i.parentId == null ? null : i.parentId) === pid);
    }
    function itemById(id) { return _data.items.find(i => i.id === id); }
    /* '시설 > 안전난간·추락방지' — 조상 체인을 ' > '로 연결 */
    function itemPath(id) {
        const names = [];
        let cur = itemById(id);
        let guard = 0;
        while (cur && guard < 20) {
            names.unshift(cur.name);
            cur = cur.parentId == null ? null : itemById(cur.parentId);
            guard++;
        }
        return names.join(' > ');
    }
    /* 시트 rows 어디서든 itemId 로 사용 중인지 */
    function itemUsed(id) {
        return _data.sheets.some(s => (s.rows || []).some(r => r.itemId === id));
    }

    function addItem(parentId, name) {
        const nm = String(name || '').trim();
        if (!nm) return { ok: false, msg: '항목명을 입력하세요.' };
        const n = _data.items.reduce((mx, i) => {
            const m = /^it-(\d+)$/.exec(i.id); return m ? Math.max(mx, +m[1]) : mx;
        }, 0) + 1;
        const it = { id: 'it-' + n, name: nm, parentId: parentId == null ? null : parentId };
        _data.items.push(it);
        save();
        return { ok: true, msg: '항목이 추가되었습니다.', id: it.id };
    }
    function renameItem(id, name) {
        const it = itemById(id);
        if (!it) return { ok: false, msg: '항목을 찾을 수 없습니다.' };
        const nm = String(name || '').trim();
        if (!nm) return { ok: false, msg: '항목명을 입력하세요.' };
        it.name = nm; save();
        return { ok: true, msg: '항목명이 변경되었습니다.' };
    }
    /* 사용 중이거나 하위 항목 있으면 삭제 차단 */
    function removeItem(id) {
        const it = itemById(id);
        if (!it) return { ok: false, msg: '항목을 찾을 수 없습니다.' };
        if (itemChildren(id).length) return { ok: false, msg: '하위 항목이 있어 삭제할 수 없습니다. 하위 항목을 먼저 삭제하세요.' };
        if (itemUsed(id)) return { ok: false, msg: '점검표에서 사용 중인 항목은 삭제할 수 없습니다.' };
        _data.items = _data.items.filter(i => i.id !== id);
        save();
        return { ok: true, msg: '항목이 삭제되었습니다.' };
    }

    /* ─────────────────────────────────────────────────────────────────────
     * 점검 대상 (기관·시설) — 원천 선택
     *   type: '기관' → targets.org / '시설' → targets.fac
     *   대상은 자체 등록하지 않고 연계 원본에서 팝업으로 선택해 추가한다.
     *     · 기관 원본 = 공용 조직도(window.EDOC.ORG_TREE 부서)  src '조직도'
     *     · 시설 원본 = 시설물 대장(DYFACIL 종별·안전등급)      src '시설물 대장'
     * ───────────────────────────────────────────────────────────────────── */
    function targetBucket(type) { return type === '시설' ? _data.targets.fac : _data.targets.org; }
    function targetPrefix(type) { return type === '시설' ? 'tg-f' : 'tg-o'; }

    function listTargets(type) { return targetBucket(type).slice(); }

    /* 점검표(sheets)에서 대상 이름으로 사용 중인지 */
    function targetUsed(name, id) {
        return _data.sheets.some(s => (id && s.targetId ? s.targetId === id : s.target === name));
    }

    function orgSourceId(name) {
        return (window.DYV2 && DYV2.deptIdOf && DYV2.deptIdOf(name)) || ('ORG:' + name);
    }
    function facilitySources() {
        if (window.DYFACIL && typeof DYFACIL.list === 'function') {
            return DYFACIL.list({ jur: '담양' }).map(f => ({
                id: f.facilNo, name: f.facilNm, cls: f.facilClass ? f.facilClass + '종' : '',
                grade: (DYFACIL.ext(f.facilNo) || {}).safetyGrade || ''
            }));
        }
        return FAC_FALLBACK.map((f, i) => ({ id: 'DEMO-FAC-' + (i + 1), name: f.name, cls: f.cls, grade: f.grade }));
    }

    /* 연계 원본 목록 (선택 팝업이 참조) — 픽커 계약 고정
     *   type '기관' : 공용 조직도 부서. EDOC 부재 시 [] 폴백
     *                 → [{ name, meta: '구성원 N명' }]
     *   type '시설' : 시설물 대장 연계(DYFACIL) 그대로
     *                 → [{ name, cls, grade }] */
    function listSources(type) {
        if (type === '시설') {
            return facilitySources();
        }
        const tree = (window.EDOC && EDOC.ORG_TREE) || [];
        return tree.map(d => ({ id: orgSourceId(d.dept), name: d.dept, meta: '구성원 ' + ((d.members || []).length) + '명' }));
    }

    /* 원본에서 선택한 이름들을 대상으로 추가 (다중) — 픽커 계약 고정
     *   · 원본(listSources)에 존재하고 아직 미등록인 이름만 추가
     *   · 시설은 원본의 cls·grade 를 선택 당시 값으로 복사한다.
     *   · 반환 { ok:true, added, skipped } (added 0이어도 ok:true — skipped만 증가) */
    function addTargetsFromSource(type, names) {
        const bucket = targetBucket(type);
        const pfx = targetPrefix(type);
        const src = listSources(type);
        const arr = Array.isArray(names) ? names : (names == null ? [] : [names]);
        let added = 0, skipped = 0;
        let next = bucket.reduce((mx, t) => {
            const m = new RegExp('^' + pfx + '(\\d+)$').exec(t.id); return m ? Math.max(mx, +m[1]) : mx;
        }, 0) + 1;
        arr.forEach(nm => {
            const name = String(nm == null ? '' : nm).trim();
            const srcRow = src.find(x => x.name === name);
            if (!name || !srcRow || bucket.some(t => (t.sourceId && srcRow.id) ? t.sourceId === srcRow.id : t.name === name)) { skipped++; return; }
            const tg = { id: pfx + (next++), sourceId: srcRow.id || '', name, src: type === '시설' ? '시설물 대장' : '조직도' };
            if (type === '시설') { tg.cls = srcRow.cls || ''; tg.grade = srcRow.grade || ''; }
            bucket.push(tg);
            added++;
        });
        if (added) save();
        return { ok: true, added, skipped };
    }

    function removeTarget(type, id) {
        const bucket = targetBucket(type);
        const tg = bucket.find(t => t.id === id);
        if (!tg) return { ok: false, msg: '대상을 찾을 수 없습니다.' };
        if (targetUsed(tg.name, tg.id)) return { ok: false, msg: '점검표에서 사용 중인 대상은 삭제할 수 없습니다.' };
        const idx = bucket.indexOf(tg);
        bucket.splice(idx, 1);
        save();
        return { ok: true, msg: '대상이 삭제되었습니다.' };
    }

    /* ─────────────────────────────────────────────────────────────────────
     * 시트 (점검표)
     * ───────────────────────────────────────────────────────────────────── */
    function listSheets(filter) {
        const f = filter || {};
        return _data.sheets.filter(s =>
            (f.year == null || String(s.year) === String(f.year)) &&
            (!f.targetType || s.targetType === f.targetType) &&
            (!f.status || s.status === f.status)
        );
    }
    function getSheet(id) { return _data.sheets.find(s => s.id === id); }

    /* 동일 연도+대상 중복 시 차단 */
    function createSheet(o) {
        const year = Number(o.year);
        const targetType = o.targetType;
        const target = o.target;
        const targetId = o.targetId || '';
        const targetSourceId = o.targetSourceId || '';
        const itemIds = o.itemIds || [];
        if (!target) return { ok: false, msg: '대상을 선택하세요.' };
        if (!itemIds.length) return { ok: false, msg: '예방 항목을 1개 이상 선택하세요.' };
        if (_data.sheets.some(s => s.year === year && s.targetType === targetType &&
            (targetId && s.targetId ? s.targetId === targetId : s.target === target))) {
            return { ok: false, msg: '이미 ' + year + '년 ' + target + ' 점검표가 있습니다.' };
        }
        const n = _data.sheets.reduce((mx, s) => {
            const m = new RegExp('^bs-' + year + '-(\\d+)$').exec(s.id); return m ? Math.max(mx, +m[1]) : mx;
        }, 0) + 1;
        const id = 'bs-' + year + '-' + n;
        _data.sheets.unshift({
            id, year, targetType, targetId, targetSourceId, target, targetSnapshot: target,
            rows: itemIds.map(itemId => ({ itemId, itemSnapshot: itemPath(itemId), plan: 0, exec: 0, note: '' })),
            status: '작성중', rejectReason: '', onnara: null,
            history: [{ at: now(), ev: '점검표 생성' }],
            updated: now(),
        });
        save();
        return { ok: true, msg: '점검표가 생성되었습니다.', id };
    }

    /* 상태 규칙 (데이터 레이어에서 강제 — 편집 잠금 매트릭스):
     *  - plan(편성) 수정: '작성중'·'반려'·'반송'만
     *  - exec(집행)·note(비고): 보낸 뒤(기안함 전송·결재중) 제외 항상 (승인완료 후에도 계속)
     *  - 기안함 전송·결재중에는 모든 편집 잠금 */
    /* 보낸 뒤 잠금 — «기안함 전송»(온나라 기안함에 들어감)·«결재중»(담당자가 온나라에서 상신함).
     * 반려·반송이면 다시 열린다(운영 결정 2026-11-06 · _공통_권한정의 §7-4). */
    function isLocked(status) { return status === '기안함 전송' || status === '결재중'; }
    function canEditPlan(status) { return status === '작성중' || status === '반려' || status === '반송'; }
    function canEditExec(status) { return !isLocked(status); }

    function updateRow(sheetId, itemId, patch) {
        const s = getSheet(sheetId);
        if (!s) return { ok: false, msg: '점검표를 찾을 수 없습니다.' };
        const r = (s.rows || []).find(x => x.itemId === itemId);
        if (!r) return { ok: false, msg: '항목을 찾을 수 없습니다.' };
        if ('plan' in patch) {
            if (!canEditPlan(s.status)) return { ok: false, msg: '현재 상태에서는 편성액을 수정할 수 없습니다.' };
            r.plan = Math.max(0, Number(patch.plan) || 0);
        }
        if ('exec' in patch) {
            if (!canEditExec(s.status)) return { ok: false, msg: '결재중에는 편집할 수 없습니다.' };
            r.exec = Math.max(0, Number(patch.exec) || 0);
        }
        if ('note' in patch) {
            if (!canEditExec(s.status)) return { ok: false, msg: '결재중에는 편집할 수 없습니다.' };
            r.note = String(patch.note == null ? '' : patch.note);
        }
        s.updated = now();
        save();
        return { ok: true, msg: '저장되었습니다.' };
    }

    /* 삭제: '작성중'만 허용 */
    function removeSheet(id) {
        const s = getSheet(id);
        if (!s) return { ok: false, msg: '점검표를 찾을 수 없습니다.' };
        if (s.status !== '작성중') return { ok: false, msg: '작성중 상태의 점검표만 삭제할 수 있습니다.' };
        _data.sheets = _data.sheets.filter(x => x.id !== id);
        save();
        return { ok: true, msg: '점검표가 삭제되었습니다.' };
    }

    /* ─────────────────────────────────────────────────────────────────────
     * 온나라 전자결재 — 수신 구조
     *   · sheet.onnara = { docNo:'온나라-2026-<4자리>', steps:[{at, act, by, note}] }
     *   · 결재선: **조직도에서 지정**한다(기안 → 검토 → 결재 3단계, 서로 다른 계정)
     *   · 승인·반려는 '처리'가 아니라 온나라에서 회신하는 값 — 화면은 그 결과를 옮겨 적기만 한다
     * ───────────────────────────────────────────────────────────────────── */
    /* ── 온나라로 보내기 — 결재선을 받지 않는다 (운영 결정 2026-11-06) ─────────
     * 이 시스템은 점검표를 온나라 **연계기안함까지만** 보낸다. 검토·결재는 담당자가 온나라
     * 기안함에서 지정해 상신한다(_공통_권한정의 §7 머리 · 이행점검 마감 보고와 같은 방식).
     * 종전(2026-08-27)에는 상신 앞에 3단계 결재선 지정 창(DYDOC.approvalLine)을 두었다 —
     * 운영 서버에 없는 단계라 걷었다. 되살리지 말 것.
     *
     * 지면은 PDF로 만들어 **붙임 1**로 싣고 본문은 «붙임 문서를 결재 요청합니다.» 한 줄이다 —
     * 온나라 본문은 글자만 받는다(EXT-22 를 마감 보고와 같은 방식으로 맞춘 것).
     * ───────────────────────────────────────────────────────────────────── */
    const DOC_BODY = '붙임 문서를 결재 요청합니다.';
    function sheetTitle(s) { return s.year + '년 ' + s.target + ' 예산 편성·집행 점검표'; }

    /* 연계 번호 신규 발급 — '온나라-2026-<4자리>' (기존 발급 번호와 충돌 회피) */
    function issueDocNo() {
        const used = new Set(_data.sheets.map(s => s.onnara && s.onnara.docNo).filter(Boolean));
        let no;
        do { no = '온나라-2026-' + String(Math.floor(1000 + Math.random() * 9000)); }
        while (used.has(no));
        return no;
    }

    /* 보내기 — status '기안함 전송', 연계 번호 최초 1회 발급·저장, steps 에 행 추가(다시 보내기도 누적) */
    function submitSheet(id) {
        const s = getSheet(id);
        if (!s) return { ok: false, msg: '점검표를 찾을 수 없습니다.' };
        if (!canEditPlan(s.status)) return { ok: false, msg: '작성중·반려·반송 상태에서만 보낼 수 있습니다.' };
        if (sheetTotals(s).plan <= 0) return { ok: false, msg: '편성액 합계가 0원인 점검표는 보낼 수 없습니다.' };
        const p = (window.DYROLE && DYROLE.current()) || {};
        if (!s.onnara) s.onnara = { docNo: issueDocNo(), steps: [] };
        else if (!s.onnara.docNo) s.onnara.docNo = issueDocNo();
        s.onnara.approval = { by: p.name || '담당자', byUid: p.uid || '' };   /* 기안자만 — 결재선은 온나라 몫 */
        delete s.onnara.prodNo; delete s.onnara.apprDate;
        const at = now();
        s.onnara.steps.push({ at, act: '온나라로 보내기', by: p.name || '담당자', note: '기안함 전송' });
        s.status = '기안함 전송';
        s.rejectReason = '';
        s.history.push({ at, ev: '온나라 기안함으로 보냄 (' + s.onnara.docNo + ')' });
        s.updated = at;
        save();
        return { ok: true, msg: '온나라 기안함에 보냈습니다.', docNo: s.onnara.docNo };
    }

    /* 온나라 결재 결과 **회신 등록** (연계 전 수동 기록 · 연계 후에는 문서조회 응답이 이걸 부른다)
     *   kind 'filed'   : 담당자가 온나라 기안함에서 상신함 — '기안함 전송' → '결재중'
     *   kind 'approve' : 결재 완료 — 생산등록번호·결재일 필수, status '승인완료'
     *   kind 'reject'  : 반려 — 반려일·사유 필수, status '반려'
     *   kind 'return'  : 반송 — 온나라가 접수하지 않았거나 상신하지 않고 지움, 사유 필수, status '반송'
     *
     * ── 예산은 결재 결과를 **받는 도메인**이다 (2026-08-28 확정) ──────────
     * 보낸 뒤에는 편성·집행이 전면 잠기므로 승인완료 회신이 없으면 집행액·비고를 영영
     * 입력할 수 없다 — 회신을 빼면 업무가 그 자리에서 멈춘다(_공통_권한정의 §7-4).
     * 「자체 결재」가 아니다 — 온나라가 보낸 결과를 옮겨 적는 자리이고 화면에 그렇게 밝힌다.
     * 결재선이 없으므로 승인 단계·처리자를 적지 않는다(운영 결정 2026-11-06). */
    function receiveOnnara(id, kind, reason, meta) {
        meta = meta || {};
        const s = getSheet(id);
        if (!s) return { ok: false, msg: '점검표를 찾을 수 없습니다.' };
        if (!isLocked(s.status) || !s.onnara) return { ok: false, msg: '온나라로 보낸 점검표만 회신을 등록할 수 있습니다.' };
        const at = now();
        const steps = s.onnara.steps;
        const who = ((window.DYROLE && DYROLE.current()) || {}).name || '담당자';

        if (kind === 'filed') {
            if (s.status !== '기안함 전송') return { ok: false, msg: '이미 결재중입니다.' };
            steps.push({ at, act: '결재중 반영', by: who, note: '온나라 기안함에서 검토·결재 지정 후 상신' });
            s.status = '결재중';
            s.history.push({ at, ev: '온나라에서 상신 — 결재중' });
            s.updated = at; save();
            return { ok: true, msg: '결재중으로 바꿨습니다.' };
        }

        if (kind === 'approve') {
            /* 결재완료 회신은 생산등록번호·결재일이 있어야 받는다(2026-11-05 기획 확인 회신 #6) */
            const prodNo = String(meta.prodNo || '').trim();
            const apprDate = String(meta.apprDate || '').trim();
            if (!prodNo) return { ok: false, msg: '생산등록번호를 입력하세요.' };
            if (!apprDate) return { ok: false, msg: '결재일을 입력하세요.' };
            s.onnara.prodNo = prodNo;
            s.onnara.apprDate = apprDate;
            steps.push({ at, act: '결재 완료 회신', by: who, note: prodNo + ' · ' + apprDate });
            s.status = '승인완료';
            s.rejectReason = '';
            s.history.push({ at, ev: '온나라 결재 완료 회신 — ' + prodNo + ' · ' + apprDate });
            s.updated = at; save();
            return { ok: true, msg: '결재 완료를 등록했습니다 — 집행액을 입력할 수 있습니다.' };
        }

        if (kind === 'reject' || kind === 'return') {
            const isRet = kind === 'return';
            const rs = String(reason || '').trim();
            const rejDate = String(meta.rejDate || '').trim();
            if (!rejDate) return { ok: false, msg: (isRet ? '반송일' : '반려일') + '을 입력하세요.' };
            if (!rs) return { ok: false, msg: (isRet ? '반송' : '반려') + ' 사유를 입력하세요.' };
            steps.push({ at, act: isRet ? '반송 회신' : '반려 회신', by: who, note: rejDate + ' · ' + rs });
            s.status = isRet ? '반송' : '반려';
            s.rejectReason = rs;
            s.history.push({ at, ev: '온나라 ' + (isRet ? '반송' : '반려') + ' 회신(' + rejDate + ') — ' + rs });
            s.updated = at; save();
            return { ok: true, msg: (isRet ? '반송' : '반려') + '을 등록했습니다 — 고친 뒤 다시 보냅니다.' };
        }

        return { ok: false, msg: '알 수 없는 회신 유형입니다.' };
    }

    /* ─────────────────────────────────────────────────────────────────────
     * 집계
     * ───────────────────────────────────────────────────────────────────── */
    function rate(plan, exec) {
        return plan > 0 ? Math.round(exec / plan * 100) : null;
    }
    function sheetTotals(sheet) {
        const rows = (sheet && sheet.rows) || [];
        const plan = rows.reduce((a, r) => a + (Number(r.plan) || 0), 0);
        const exec = rows.reduce((a, r) => a + (Number(r.exec) || 0), 0);
        return { plan, exec, rate: rate(plan, exec) };
    }
    /* 해당 연도 전체 집계 */
    function grandTotals(year) {
        let plan = 0, exec = 0;
        _data.sheets.filter(s => String(s.year) === String(year)).forEach(s => {
            const t = sheetTotals(s); plan += t.plan; exec += t.exec;
        });
        return { plan, exec, rate: rate(plan, exec) };
    }

    /* ─────────────────────────────────────────────────────────────────────
     * 관리 원칙 (정책 문서) — 최신 개정이 [0]
     * ───────────────────────────────────────────────────────────────────── */
    function listPolicies() {
        return _data.policies.slice().sort((a, b) => String(b.effective || '').localeCompare(String(a.effective || '')) || String(b.updated || '').localeCompare(String(a.updated || '')));
    }

    /* id 있으면 해당 건 필드 갱신(수정), 없으면 신규(개정) 등록 — 신규는 unshift로 [0]에 */
    function savePolicy(obj) {
        const o = obj || {};
        const title = String(o.title || '').trim();
        if (!title) return { ok: false, msg: '제목을 입력하세요.' };
        if (!o.effective) return { ok: false, msg: '시행일을 입력하세요.' };
        let id = o.id;
        const cur = id ? _data.policies.find(p => p.id === id) : null;
        if (cur) {
            /* 수정 */
            cur.title = title;
            cur.effective = o.effective;
            cur.body = String(o.body == null ? '' : o.body);
            cur.files = Array.isArray(o.files) ? o.files : [];
            cur.updated = now();
            id = cur.id;
        } else {
            /* 개정 등록 — 신규 id는 기존 최대 번호 + 1 (addItem 방식) */
            const n = _data.policies.reduce((mx, p) => {
                const m = /^pol-(\d+)$/.exec(p.id); return m ? Math.max(mx, +m[1]) : mx;
            }, 0) + 1;
            id = 'pol-' + n;
            _data.policies.unshift({
                id, title, effective: o.effective,
                body: String(o.body == null ? '' : o.body),
                files: Array.isArray(o.files) ? o.files : [],
                updated: now(),
            });
        }
        save();
        return { ok: true, msg: '저장되었습니다.', id };
    }

    function removePolicy(id) {
        if (!_data.policies.some(p => p.id === id)) return { ok: false, msg: '문서를 찾을 수 없습니다.' };
        _data.policies = _data.policies.filter(p => p.id !== id);
        save();
        return { ok: true, msg: '삭제되었습니다.' };
    }

    /* ─────────────────────────────────────────────────────────────────────
     * 공개 API (데이터 계약)
     * ───────────────────────────────────────────────────────────────────── */
    const DYBGT = {
        data, save,
        fmtAmt,
        /* 점검 대상 (§7 3차: 연계 선택) */
        listTargets, listSources, addTargetsFromSource, removeTarget, targetUsed,
        itemChildren, itemPath, itemUsed, addItem, renameItem, removeItem,
        listSheets, getSheet, createSheet, updateRow, removeSheet,
        /* 온나라 전자결재 (§3) */
        submitSheet, receiveOnnara,
        sheetTotals, grandTotals,
        listPolicies, savePolicy, removePolicy,
    };
    window.DYBGT = DYBGT;

    /* =====================================================================
     * BGT01-V 화면 렌더 — #bgt-app 이 있을 때만 (설정 화면은 데이터만 로드)
     * ===================================================================== */
    const app = document.getElementById('bgt-app');
    if (!app) return;

    const V = () => window.DYV2;
    const E = () => window.EDOC;
    /* 화면 상태: 목록 필터 + 현재 상세 시트 id (?sheet= 반영) */
    const UI = { year: 2026, targetType: '', status: '', sheet: null };

    /* 결재 상태 칩 — chip-status 표준 4색 (경영방침 apprColor 표준과 동일 매핑)
     *   작성중=neutral · 결재중=info · 승인완료=success · 반려=danger */
    function apprColor(st) {
        return { '작성중': 'neutral', '기안함 전송': 'warning', '결재중': 'info', '승인완료': 'success', '반려': 'danger', '반송': 'warning' }[st] || 'neutral';
    }
    function statusChip(st) {
        return '<span class="chip-status ' + apprColor(st) + '">' + esc(st) + '</span>';
    }
    /* 대상구분 칩 */
    function targetTypeChip(t) {
        return '<span class="chip-mini ' + (t === '시설' ? 'wt-elec' : 'pdca') + '">' + esc(t) + '</span>';
    }
    /* 집행률 프로그레스 바 (menu.js exec() 패턴) — 70%↑ green / 미만 warning, 바 폭은 100 캡·숫자는 실제값 */
    function execBar(p) {
        if (p == null) return '<span class="chip-status neutral">산정 불가</span>';
        const w = Math.min(100, Math.max(0, p));
        return '<div class="bgt-rate">' +
            '<div class="progress" style="width:90px;"><div class="progress-bar ' + (p >= 70 ? 'green' : 'warning') + '" style="width:' + w + '%"></div></div>' +
            '<b>' + p + '%</b></div>';
    }

    /* ── KPI 카드 3개 (연도 필터 반영, 하단 표에서 자동 집계) — R2 ──
     * §2: kpi-card-icon 슬롯 제거 (그림 이모지 미사용) */
    function kpiCards(list) {
        const plan = list.reduce((a, s) => a + sheetTotals(s).plan, 0);
        const exec = list.reduce((a, s) => a + sheetTotals(s).exec, 0);
        const r = rate(plan, exec);
        const card = (title, valHtml, foot) =>
            '<div class="kpi-card">' +
              '<div class="kpi-card-label"><span class="kpi-card-title">' + title + '</span></div>' +
              '<div class="kpi-card-value">' + valHtml + '</div>' +
              '<div class="kpi-card-foot">' + foot + '</div>' +
            '</div>';
        return '<div class="board-grid cols-3" style="margin-bottom:16px;">' +
            card('총 편성액', '<span style="font-size:24px;">' + fmtAmt(plan) + '</span>', UI.year + '년 점검표 ' + list.length + '건') +
            card('총 집행액', '<span style="font-size:24px;">' + fmtAmt(exec) + '</span>', '편성 대비 집행 진행') +
            card('집행률', (r == null ? '<span style="font-size:20px;">산정 불가</span>' : r + '<span class="unit">%</span>'), '편성 ' + fmtAmt(plan) + ' 기준') +
        '</div>';
    }

    /* ── 목록 뷰 ── */
    function renderList() {
        UI.sheet = null;
        const list = listSheets({ year: UI.year, targetType: UI.targetType, status: UI.status });

        /* 총괄 테이블 행 */
        let rowsHtml;
        if (!list.length) {
            rowsHtml = '<tr><td colspan="7"><div class="v2-empty">조건에 맞는 점검표가 없습니다.<br><span style="font-size:12px;">연도·대상구분·상태 필터를 바꾸거나 [+ 점검표 생성]으로 새로 만드세요.</span></div></td></tr>';
        } else {
            rowsHtml = list.map(s => {
                const t = sheetTotals(s);
                const del = s.status === '작성중'
                    ? ' <button type="button" class="btn btn-sm btn-outline" onclick="event.stopPropagation(); DYBGT._del(\'' + s.id + '\')">삭제</button>'
                    : '';
                return '<tr onclick="DYBGT._open(\'' + s.id + '\')">' +
                    '<td><div class="bgt-target">' + targetTypeChip(s.targetType) + '<b>' + esc(s.target) + '</b></div></td>' +
                    '<td>' + (s.rows || []).length + '개</td>' +
                    '<td>' + fmtAmt(t.plan) + '</td>' +
                    '<td>' + fmtAmt(t.exec) + '</td>' +
                    '<td>' + execBar(t.rate) + '</td>' +
                    '<td>' + statusChip(s.status) + '</td>' +
                    '<td class="col-action"><button type="button" class="btn btn-sm btn-outline" onclick="event.stopPropagation(); DYBGT._open(\'' + s.id + '\')">조회</button>' + del + '</td>' +
                    '</tr>';
            }).join('');
        }

        /* 합계 행 (tfoot) — 필터된 목록 기준 */
        const g = { plan: list.reduce((a, s) => a + sheetTotals(s).plan, 0), exec: list.reduce((a, s) => a + sheetTotals(s).exec, 0) };
        g.rate = rate(g.plan, g.exec);
        const foot = '<tfoot><tr class="bgt-foot">' +
            '<td>합계</td><td></td>' +
            '<td>' + fmtAmt(g.plan) + '</td>' +
            '<td>' + fmtAmt(g.exec) + '</td>' +
            '<td>' + execBar(g.rate) + '</td>' +
            '<td colspan="2"></td>' +
            '</tr></tfoot>';

        app.innerHTML =
            /* R2: 편성·집행·집행률 진행 확인 */
            kpiCards(list) +
            /* 툴바 */
            '<div class="v2-toolbar">' +
                '<select class="select" id="bgt-f-year">' +
                    '<option value="2025"' + (UI.year == 2025 ? ' selected' : '') + '>2025년</option>' +
                    '<option value="2026"' + (UI.year == 2026 ? ' selected' : '') + '>2026년</option>' +
                    '<option value="2027"' + (UI.year == 2027 ? ' selected' : '') + '>2027년</option>' +
                '</select>' +
                '<select class="select" id="bgt-f-type">' +
                    '<option value="">대상구분 전체</option>' +
                    '<option value="기관"' + (UI.targetType === '기관' ? ' selected' : '') + '>기관</option>' +
                    '<option value="시설"' + (UI.targetType === '시설' ? ' selected' : '') + '>시설</option>' +
                '</select>' +
                '<select class="select" id="bgt-f-status">' +
                    ['', '작성중', '기안함 전송', '결재중', '승인완료', '반려', '반송'].map(v =>
                        '<option value="' + v + '"' + (UI.status === v ? ' selected' : '') + '>' + (v || '상태 전체') + '</option>').join('') +
                '</select>' +
                '<span class="spacer"></span>' +
                '<button class="btn btn-primary" onclick="DYBGT._openCreate()">+ 점검표 생성</button>' +
            '</div>' +
            /* R2: 총괄 테이블 */
            '<div class="card"><div class="card-body" style="overflow-x:auto; padding:0;">' +
                '<table class="table-figma bgt-table">' +
                    '<thead><tr><th>대상</th><th>항목 수</th><th>편성액</th><th>집행액</th><th>집행률</th><th>상태</th><th>관리</th></tr></thead>' +
                    '<tbody>' + rowsHtml + '</tbody>' +
                    (list.length ? foot : '') +
                '</table>' +
            '</div></div>';

        /* 필터 wiring */
        const yr = document.getElementById('bgt-f-year');
        const tp = document.getElementById('bgt-f-type');
        const st = document.getElementById('bgt-f-status');
        if (yr) yr.onchange = () => { UI.year = Number(yr.value); renderList(); };
        if (tp) tp.onchange = () => { UI.targetType = tp.value; renderList(); };
        if (st) st.onchange = () => { UI.status = st.value; renderList(); };

        syncUrl(null);
    }

    /* ── 상세 뷰 — R5 조회·수정 / R6 전자결재 ── */
    function renderDetail(id) {
        const s = getSheet(id);
        if (!s) { renderList(); return; }
        UI.sheet = id;
        const t = sheetTotals(s);
        const planEditable = canEditPlan(s.status);
        const execEditable = canEditExec(s.status);

        /* 반려 사유 경고 박스 */
        const rejectBox = ((s.status === '반려' || s.status === '반송') && s.rejectReason)
            ? '<div class="bgt-reject"><b>' + esc(s.status) + ' 사유</b> ' + esc(s.rejectReason) + '</div>'
            : '';

        /* 행 테이블 — 항목 / 편성액 / 집행액 / 집행률 / 비고 */
        const rowsHtml = (s.rows || []).map(r => {
            const rr = rate(r.plan, r.exec);
            const planDis = planEditable ? '' : ' disabled';
            const execDis = execEditable ? '' : ' disabled';
            return '<tr>' +
                '<td>' + esc(r.itemSnapshot || itemPath(r.itemId)) + '</td>' +
                '<td><input type="number" class="bgt-in" min="0" value="' + (Number(r.plan) || 0) + '" data-row-plan="' + esc(r.itemId) + '"' + planDis + '></td>' +
                '<td><input type="number" class="bgt-in" min="0" value="' + (Number(r.exec) || 0) + '" data-row-exec="' + esc(r.itemId) + '"' + execDis + '></td>' +
                '<td data-rate="' + esc(r.itemId) + '">' + execBar(rr) + '</td>' +
                '<td><input type="text" class="bgt-in bgt-in-note" value="' + esc(r.note) + '" placeholder="비고" data-row-note="' + esc(r.itemId) + '"' + execDis + '></td>' +
                '</tr>';
        }).join('');

        const foot = '<tfoot><tr class="bgt-foot">' +
            '<td>합계</td>' +
            '<td data-foot-plan>' + fmtAmt(t.plan) + '</td>' +
            '<td data-foot-exec>' + fmtAmt(t.exec) + '</td>' +
            '<td data-foot-rate>' + execBar(t.rate) + '</td>' +
            '<td></td>' +
            '</tr></tfoot>';

        /* 처리 이력 타임라인 (문서 생명주기 — 온나라 결재 이력 모달과 역할 구분) */
        const histHtml = (s.history || []).slice().reverse().map(h =>
            '<li class="bgt-hist-item"><span class="bgt-hist-at">' + esc(h.at) + '</span><span class="bgt-hist-ev">' + esc(h.ev) + '</span></li>'
        ).join('');

        app.innerHTML =
            '<div class="bgt-detail-top">' +
                '<button class="btn btn-secondary btn-sm" onclick="DYBGT._back()">← 목록</button>' +
                '<h2 class="bgt-detail-title">' + esc(String(s.year)) + '년 ' + esc(s.target) + ' 예산 편성·집행 점검표</h2>' +
                statusChip(s.status) +
            '</div>' +
            rejectBox +
            /* R5: 행 테이블 (편성·집행·비고 입력) */
            '<div class="card" style="margin-bottom:16px;"><div class="card-header">' +
                '<span class="card-title">항목별 편성·집행 (' + targetTypeChip(s.targetType) + ' ' + esc(s.target) + ')</span>' +
            '</div><div class="card-body" style="overflow-x:auto;">' +
                editHintHtml(s.status) +
                '<table class="table-figma bgt-table">' +
                    '<thead><tr><th style="min-width:180px;">항목</th><th>편성액 (천원)</th><th>집행액 (천원)</th><th>집행률</th><th>비고</th></tr></thead>' +
                    '<tbody>' + rowsHtml + '</tbody>' +
                    foot +
                '</table>' +
            '</div></div>' +
            /* R6: 전자결재 카드 (상태별) */
            actionCard(s) +
            /* 처리 이력 카드 (문서 생명주기 타임라인) */
            '<div class="card"><div class="card-header"><span class="card-title">처리 이력</span></div>' +
                '<div class="card-body"><ul class="bgt-hist">' + (histHtml || '<li class="bgt-hist-item"><span class="bgt-hist-ev">이력이 없습니다.</span></li>') + '</ul></div>' +
            '</div>';

        wireDetailInputs(id);
        syncUrl(id);
    }

    /* 상태별 편집 안내 문구 */
    function editHintHtml(status) {
        let msg;
        if (canEditPlan(status)) msg = '편성액·집행액·비고를 입력할 수 있습니다. 입력 즉시 자동 저장됩니다.';
        else if (isLocked(status)) msg = '온나라로 보낸 뒤에는 편집이 잠깁니다. 결재가 끝나면 집행액을 등록할 수 있습니다.';
        else msg = '승인 완료 — 집행액·비고는 계속 입력할 수 있습니다. (편성액은 잠금)';
        return '<p class="bgt-edit-hint">' + esc(msg) + '</p>';
    }

    /* 상태별 전자결재 카드
     * 공통: '온나라 결재' 행(칩 + docNo + [이력]) + 상태별 액션/안내 */
    function actionCard(s) {
        const docNo = (s.onnara && s.onnara.docNo) || '';
        /* 공통 행 — 경영방침 상세 '온나라 결재' 행과 동일 배치 */
        const commonRow = '<div class="bgt-appr-row">' +
            '<span class="bgt-appr-lab">온나라 결재</span>' +
            statusChip(s.status) +
            ((s.onnara && s.onnara.prodNo)
                ? '<span class="bgt-appr-docno">생산등록번호 ' + esc(s.onnara.prodNo) + (s.onnara.apprDate ? ' · ' + esc(s.onnara.apprDate) : '') + '</span>'
                : (docNo ? '<span class="bgt-appr-docno">연계 번호 ' + esc(docNo) + '</span>' : '')) +
            '<button class="btn btn-sm btn-outline" onclick="DYBGT._apprHistory(\'' + s.id + '\')">이력</button>' +
        '</div>';

        let body;
        if (canEditPlan(s.status)) {
            body = '<p class="bgt-act-desc">작성한 점검표를 온나라 기안함으로 보냅니다. 보낸 뒤에는 편집이 잠깁니다.</p>' +
                (canDraft()
                    ? '<button class="btn btn-primary" onclick="DYBGT._submitPopup(\'' + s.id + '\')">' + (s.onnara ? '다시 보내기' : '온나라로 보내기') + '</button>'
                    : '<p class="bgt-act-desc">' + DRAFT_DENY + '</p>');
        } else if (isLocked(s.status)) {
            body = '<p class="bgt-act-desc">' + (s.status === '기안함 전송'
                    ? '온나라 기안함에 들어가 있습니다 — <b>온나라 기안함에서 검토·결재를 지정해 상신하세요.</b> '
                    : '온나라 결재가 진행 중입니다. ') +
                '보낸 뒤에는 편성액·집행액을 모두 잠그며, 결재가 끝나면 집행 입력이 열립니다.</p>' +
                '<button class="btn btn-primary" onclick="DYBGT._statusModal(\'' + s.id + '\')">결재 상태 · 회신 등록</button>';
        } else { /* 승인완료 */
            body = '<p class="bgt-act-desc bgt-act-ok">승인 완료 — 집행액·비고는 계속 입력할 수 있습니다. (편성액은 잠금)</p>';
        }
        return '<div class="card" style="margin-bottom:16px;"><div class="card-header"><span class="card-title">전자결재</span></div>' +
            '<div class="card-body">' + commonRow + body + '</div></div>';
    }

    /* 온나라 결재 이력 모달 — steps 실데이터 4열 (menu.js opnChkApprHistory 포맷) */
    function apprHistoryModal(id) {
        const s = getSheet(id); if (!s) return;
        const docNo = (s.onnara && s.onnara.docNo) || '';
        const steps = (s.onnara && s.onnara.steps) || [];
        const body = steps.length
            ? '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>일시</th><th>처리</th><th>처리자</th><th>비고</th></tr></thead><tbody>' +
              steps.map(x => '<tr><td>' + esc(x.at) + '</td><td>' + esc(x.act) + '</td><td>' + esc(x.by) + '</td><td>' + esc(x.note || '-') + '</td></tr>').join('') +
              '</tbody></table></div>' +
              ((s.onnara && s.onnara.approval && s.onnara.approval.sample) ? '<p style="margin-top:8px;">' + V().sampleChip('지난 점검표의 처리 이력은 예시 값입니다') + '</p>' : '') +
              ((s.onnara && s.onnara.prodNo)
                ? '<p class="file-hint" style="margin-top:10px;">생산등록번호 <b>' + esc(s.onnara.prodNo) + '</b> · 결재일 ' + esc(s.onnara.apprDate || '-') + '</p>'
                : '<p class="file-hint" style="margin-top:10px;">진행 상황은 온나라에서 확인합니다.</p>')
            : '<div class="v2-empty">결재 이력이 없습니다 — 온나라로 보내면 이력이 기록됩니다.</div>';
        V().openModal('온나라 결재 이력', body,
            '<button class="btn btn-primary" onclick="DYV2.closeModal()">확인</button>');
    }

    /* 보내기 순서 — 지면 미리보기 → [온나라로 보내기] → 확인(되돌릴 수 없음) → [보내기] → 결과 창.
     * 이행점검 마감 보고(menu.js PG.cmpClose)와 같은 모양이다. 결재선은 받지 않는다(운영 결정 2026-11-06). */
    function paperHtml(s) {
        const t = sheetTotals(s);
        const p = (window.DYROLE && DYROLE.current()) || {};
        const by = (s.onnara && isLocked(s.status) && s.onnara.approval && s.onnara.approval.by) || p.name || '담당자';
        return '<div class="cmp-report" style="border:1px solid var(--card-line); border-radius:var(--radius-card); padding:16px 18px; max-height:56vh; overflow:auto;">' +
            '<h3 style="text-align:center; margin:0 0 10px;">' + esc(sheetTitle(s)) + '</h3>' +
            '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>항목</th><th>편성액 (천원)</th><th>비고</th></tr></thead><tbody>' +
                (s.rows || []).map(r => '<tr><td>' + esc(r.itemSnapshot || itemPath(r.itemId)) + '</td><td>' + fmtAmt(r.plan) + '</td><td>' + esc(r.note || '') + '</td></tr>').join('') +
            '</tbody><tfoot><tr class="bgt-foot"><td>합계</td><td>' + fmtAmt(t.plan) + '</td><td></td></tr></tfoot></table></div>' +
            '<p style="font-size:var(--fs-12); margin-top:10px; text-align:right;">기안 ' + esc(by) + '</p>' +
        '</div>';
    }
    function submitPopup(id) {
        if (!canDraft()) { V().toast('보내기는 담당자가 합니다 — 관리·감독 계층은 조회만 합니다.'); return; }
        const s = getSheet(id); if (!s) return;
        if (!canEditPlan(s.status)) { V().toast('이미 온나라로 보낸 점검표입니다 — 반려·반송된 뒤에 다시 보냅니다.'); return; }
        if (sheetTotals(s).plan <= 0) { V().toast('편성액 합계가 0원인 점검표는 보낼 수 없습니다.'); return; }
        V().openModal(esc(sheetTitle(s)) + ' — 문서 미리보기',
            '<div class="check-notice" style="margin-bottom:10px;">이 지면은 <b>PDF로 만들어 붙임 1</b>로 보내고 본문은 «' + esc(DOC_BODY) + '» 한 줄입니다. ' +
                '<b>[온나라로 보내기]</b>를 누르면 온나라 기안함으로 가고 이 점검표는 잠깁니다. 검토·결재는 온나라에서 지정합니다.</div>' +
            paperHtml(s),
            '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" onclick="DYBGT._confirmSend(\'' + id + '\')">온나라로 보내기</button>');
    }
    function confirmSend(id) {
        if (!canDraft()) { V().toast('보내기는 담당자가 합니다 — 관리·감독 계층은 조회만 합니다.'); return; }
        const s = getSheet(id); if (!s) return;
        V().openModal('온나라로 보내면 되돌릴 수 없습니다',
            '<div class="rskdoc-send"><div class="rskdoc-lock-warn"><b>보내는 순간 편성액·집행액·비고가 모두 잠깁니다.</b><br>' +
            '<span class="file-hint">점검표는 온나라 연계기안함에 들어갑니다. 검토·결재를 지정해 상신하는 것은 온나라에서 합니다. 반려·반송되면 다시 열립니다.</span></div></div>',
            '<button class="btn btn-secondary" onclick="DYBGT._submitPopup(\'' + id + '\')">← 미리보기</button>' +
            '<button class="btn btn-primary" onclick="DYBGT._doSubmit(\'' + id + '\')">보내기</button>');
    }
    function doSubmit(id) {
        if (!canDraft()) { V().toast('보내기는 담당자가 합니다 — 관리·감독 계층은 조회만 합니다.'); return; }
        const res = submitSheet(id);
        if (!res.ok) { V().toast(res.msg); return; }
        /* 배경 상세를 먼저 갱신 — 결과 창이 어떤 경로로 닫혀도 화면·데이터가 일치하도록 */
        renderDetail(id);
        const s = getSheet(id);
        V().openModal('온나라 기안함에 보냈습니다',
            window.DYDOC && DYDOC.sentHtml
                ? DYDOC.sentHtml({
                    lead: '점검표를 온나라 연계기안함에 보냈고, 이 점검표를 잠갔습니다.',
                    status: '기안함 전송',
                    rows: [
                        ['문서', sheetTitle(s)],
                        ['연계 번호', res.docNo, '문서번호는 결재가 끝나면 온나라가 부여합니다.'],
                        ['붙임', '1. ' + sheetTitle(s) + '(PDF)', '본문은 «' + DOC_BODY + '» 한 줄입니다.'],
                        ['다음 할 일', '온나라 기안함에서 검토·결재를 지정해 상신하세요.', '결재가 끝나면 [결재 상태 · 회신 등록]에 생산등록번호·결재일을 적습니다.']
                    ]
                })
                : '<p>' + esc(sheetTitle(s)) + ' — 연계 번호 ' + esc(res.docNo) + '</p>',
            '<button class="btn btn-primary" onclick="DYV2.closeModal(); DYBGT._afterSubmit(\'' + id + '\')">확인</button>');
    }

    /* 결재 상태 모달 — steps 4열 + **결재 결과 회신 등록**(연계 전 수동 기록).
     * 결재는 온나라에서 하고 여기서는 그 결과를 옮겨 적는다. */
    function statusModal(id) {
        const s = getSheet(id); if (!s || !isLocked(s.status)) return;
        V().openModal('온나라 결재 상태 — 회신 등록', statusModalBody(id),
            '<button class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>');
    }
    function statusModalBody(id) {
        const s = getSheet(id);
        const docNo = (s.onnara && s.onnara.docNo) || '';
        const steps = (s.onnara && s.onnara.steps) || [];
        const table = '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>일시</th><th>처리</th><th>처리자</th><th>비고</th></tr></thead><tbody>' +
            steps.map(x => '<tr><td>' + esc(x.at) + '</td><td>' + esc(x.act) + '</td><td>' + esc(x.by) + '</td><td>' + esc(x.note || '-') + '</td></tr>').join('') +
            '</tbody></table></div>';
        return '<div class="bgt-status-modal">' +
            '<p class="bgt-act-desc" style="margin-bottom:10px;">' + statusChip(s.status) + ' 연계 번호 <b>' + esc(docNo) + '</b></p>' +
            table + recvBox(id, s) +
        '</div>';
    }
    /* 결재 결과 회신 등록 — **온나라가 보낸 결과를 옮겨 적는 자리**다. 결재선이 없으므로 단계·처리자를 적지 않는다. */
    function recvBox(id, s) {
        return '<div class="bgt-sim-box">' +
            '<div class="bgt-sim-head">결재 결과 회신 등록 — 연계 전 수동 기록</div>' +
            '<p class="file-hint" style="margin-bottom:10px;">온나라에서 확인한 결과를 옮겨 적습니다. 결재 완료는 생산등록번호·결재일, 반려·반송은 날짜·사유를 적습니다.</p>' +
            '<div class="bgt-act-btns">' +
                (s.status === '기안함 전송'
                    ? '<button class="btn btn-sm btn-outline" onclick="DYBGT._recv(\'' + id + '\', \'filed\')">온나라에서 상신함 (결재중)</button>'
                    : '') +
                '<button class="btn btn-sm btn-primary" onclick="DYBGT._approveToggle(\'' + id + '\')">결재 완료 회신</button>' +
                '<button class="btn btn-sm btn-outline" onclick="DYBGT._rejectToggle(\'' + id + '\')">반려 회신</button>' +
                '<button class="btn btn-sm btn-outline" onclick="DYBGT._returnToggle(\'' + id + '\')">반송 회신</button>' +
            '</div>' +
            '<div id="bgt-reject-form" style="display:none;"></div>' +
        '</div>';
    }

    /* 상세 뷰 입력 wiring — change 시 updateRow 자동 저장 + 집행률/합계 즉시 갱신 */
    function wireDetailInputs(id) {
        const commit = (itemId, patch) => {
            const res = updateRow(id, itemId, patch);
            if (!res.ok) { V().toast(res.msg); renderDetail(id); return; }
            refreshRowRate(id, itemId);
            refreshFoot(id);
            V().toast('저장됨');
        };
        app.querySelectorAll('[data-row-plan]').forEach(el => {
            el.addEventListener('change', () => commit(el.getAttribute('data-row-plan'), { plan: el.value }));
        });
        app.querySelectorAll('[data-row-exec]').forEach(el => {
            el.addEventListener('change', () => commit(el.getAttribute('data-row-exec'), { exec: el.value }));
        });
        app.querySelectorAll('[data-row-note]').forEach(el => {
            el.addEventListener('change', () => commit(el.getAttribute('data-row-note'), { note: el.value }));
        });
    }
    function refreshRowRate(id, itemId) {
        const s = getSheet(id); if (!s) return;
        const r = (s.rows || []).find(x => x.itemId === itemId); if (!r) return;
        const cell = app.querySelector('[data-rate="' + cssEsc(itemId) + '"]');
        if (cell) cell.innerHTML = execBar(rate(r.plan, r.exec));
    }
    function refreshFoot(id) {
        const s = getSheet(id); if (!s) return;
        const t = sheetTotals(s);
        const p = app.querySelector('[data-foot-plan]'); if (p) p.textContent = fmtAmt(t.plan);
        const e = app.querySelector('[data-foot-exec]'); if (e) e.textContent = fmtAmt(t.exec);
        const rt = app.querySelector('[data-foot-rate]'); if (rt) rt.innerHTML = execBar(t.rate);
    }

    /* =====================================================================
     * 점검표 생성 모달 (이 화면의 유일한 신규 모달 — DYV2.openModal 1회, 단일 폼)
     * R4 기관별·시설별 점검표 생성 / R5 등록
     * ===================================================================== */
    /* 모달 폼 로컬 상태 */
    const CREATE = { year: 2026, targetType: '기관', targetId: '', checked: {} };

    function openCreate() {
        CREATE.year = UI.year || 2026;
        CREATE.targetType = '기관';
        CREATE.targetId = '';
        CREATE.checked = {};
        V().openModal('편성·집행 점검표 생성', createBody(),
            '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" onclick="DYBGT._createConfirm()">생성</button>');
        wireCreate();
    }

    /* 대상 필드 — listTargets()에서 구성. 대상 0건이면 select 대신 안내문 (§1) */
    function targetFieldHtml() {
        const list = listTargets(CREATE.targetType);
        if (!list.length) {
            return '<p class="bgt-target-empty" id="bgt-c-target-wrap">예산 기준 설정 &gt; 점검 대상 관리에서 대상을 먼저 등록하세요.</p>';
        }
        const opts = '<option value="">대상 선택</option>' +
            list.map(t => '<option value="' + esc(t.id) + '"' + (CREATE.targetId === t.id ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('');
        return '<select class="select" id="bgt-c-target" style="width:100%;">' + opts + '</select>';
    }

    /* 예방 항목 트리 (대분류 체크 시 하위 전체 선택/해제) — 모달 본문 안 .org-inline 스크롤 패널 */
    function itemTreeHtml() {
        const roots = itemChildren(null);
        /* 엘보 커넥터 가이드 셀 — 섹션 B 관리 트리와 동일한 시각 언어(공유 .bgt-tg 클래스).
         * trail: 조상별 마지막 자식 여부(현재 노드 포함, depth 0 = 커넥터 없음). */
        const cells = (trail) => {
            if (!trail.length) return '';
            let out = '';
            for (let i = 0; i < trail.length; i++) {
                if (i === trail.length - 1) {
                    out += '<span class="bgt-tg bgt-tg--elbow' + (trail[i] ? ' is-last' : '') + '"></span>';
                } else {
                    out += '<span class="bgt-tg' + (trail[i] ? '' : ' bgt-tg--line') + '"></span>';
                }
            }
            return out;
        };
        const nodeHtml = (it, depth, trail) => {
            const kids = itemChildren(it.id);
            const on = !!CREATE.checked[it.id];
            const nameCls = depth === 0
                ? 'bgt-tree-name is-group'
                : ('bgt-tree-name' + (kids.length ? ' is-group' : ''));
            const row =
                '<label class="bgt-tree-row has-tg">' +
                    (depth === 0 ? '' : cells(trail)) +
                    '<span class="bgt-tree-check">' +
                        '<input type="checkbox" data-item="' + esc(it.id) + '"' + (on ? ' checked' : '') + '>' +
                        '<span class="' + nameCls + '">' + esc(it.name) + '</span>' +
                    '</span>' +
                '</label>';
            return row + kids.map((k, ki) =>
                nodeHtml(k, depth + 1, trail.concat(ki === kids.length - 1))
            ).join('');
        };
        return '<div class="org-inline"><div class="org-inline-body" id="bgt-tree">' +
            roots.map((r, ri) => nodeHtml(r, 0, [ri === roots.length - 1])).join('') +
            '</div></div>';
    }

    function createBody() {
        return '<div class="bgt-create">' +
            '<label class="bgt-lab">연도</label>' +
            '<select class="select" id="bgt-c-year" style="width:100%;">' +
                '<option value="2025"' + (CREATE.year == 2025 ? ' selected' : '') + '>2025년</option>' +
                '<option value="2026"' + (CREATE.year == 2026 ? ' selected' : '') + '>2026년</option>' +
                '<option value="2027"' + (CREATE.year == 2027 ? ' selected' : '') + '>2027년</option>' +
            '</select>' +
            '<label class="bgt-lab">대상구분</label>' +
            '<div class="bgt-radios">' +
                '<label class="bgt-radio' + (CREATE.targetType === '기관' ? ' on' : '') + '"><input type="radio" name="bgt-ttype" value="기관"' + (CREATE.targetType === '기관' ? ' checked' : '') + '><span>기관</span></label>' +
                '<label class="bgt-radio' + (CREATE.targetType === '시설' ? ' on' : '') + '"><input type="radio" name="bgt-ttype" value="시설"' + (CREATE.targetType === '시설' ? ' checked' : '') + '><span>시설</span></label>' +
            '</div>' +
            '<label class="bgt-lab">대상</label>' +
            '<div id="bgt-c-target-slot">' + targetFieldHtml() + '</div>' +
            '<label class="bgt-lab">예방 항목 선택 <span class="bgt-lab-sub">대분류를 체크하면 하위가 함께 선택됩니다</span></label>' +
            itemTreeHtml() +
        '</div>';
    }

    /* 대상 필드 wiring (select 존재 시 change 바인딩) — 라디오 전환 후에도 재호출 */
    function wireTargetField() {
        const tg = document.getElementById('bgt-c-target');
        if (tg) tg.onchange = () => { CREATE.targetId = tg.value; };
    }
    function wireCreate() {
        const yr = document.getElementById('bgt-c-year');
        if (yr) yr.onchange = () => { CREATE.year = Number(yr.value); };
        wireTargetField();
        /* 대상구분 라디오 — 변경 시 대상 필드 재렌더(listTargets) + 라디오 하이라이트 */
        document.querySelectorAll('input[name="bgt-ttype"]').forEach(r => {
            r.onchange = () => {
                CREATE.targetType = r.value;
                CREATE.targetId = '';
                document.querySelectorAll('.bgt-radio').forEach(l => l.classList.remove('on'));
                const lab = r.closest('.bgt-radio'); if (lab) lab.classList.add('on');
                const slot = document.getElementById('bgt-c-target-slot');
                if (slot) { slot.innerHTML = targetFieldHtml(); wireTargetField(); }
            };
        });
        wireTree();
    }

    /* 트리 체크박스: 대분류 체크 → 하위 전체 반영 */
    function wireTree() {
        const tree = document.getElementById('bgt-tree');
        if (!tree) return;
        tree.querySelectorAll('input[data-item]').forEach(cb => {
            cb.onchange = () => {
                const id = cb.getAttribute('data-item');
                setChecked(id, cb.checked);
                /* 하위 전체 동기화 */
                descendants(id).forEach(d => setChecked(d, cb.checked));
                /* 화면 반영 */
                tree.querySelectorAll('input[data-item]').forEach(x => {
                    x.checked = !!CREATE.checked[x.getAttribute('data-item')];
                });
            };
        });
    }
    function setChecked(id, on) { if (on) CREATE.checked[id] = true; else delete CREATE.checked[id]; }
    function descendants(id) {
        const out = [];
        (function walk(pid) { itemChildren(pid).forEach(c => { out.push(c.id); walk(c.id); }); })(id);
        return out;
    }

    /* 생성 확정 — 선택 항목 중 '리프(하위 없는 항목)'만 시트 rows 로.
     * (대분류 자체는 금액 입력 대상이 아니므로 리프만 담아 rows 를 구성) */
    function createConfirm() {
        if (!CREATE.targetId) { V().toast('대상을 선택하세요.'); return; }
        const targetRec = listTargets(CREATE.targetType).find(t => t.id === CREATE.targetId);
        if (!targetRec) { V().toast('선택한 대상을 찾을 수 없습니다.'); return; }
        const checkedIds = Object.keys(CREATE.checked);
        const leafIds = checkedIds.filter(id => itemChildren(id).length === 0);
        if (!leafIds.length) { V().toast('예방 항목을 1개 이상 선택하세요.'); return; }
        const res = createSheet({ year: CREATE.year, targetType: CREATE.targetType, targetId: targetRec.id,
            targetSourceId: targetRec.sourceId || '', target: targetRec.name, itemIds: leafIds });
        if (!res.ok) { V().toast(res.msg); return; }
        V().closeModal();
        UI.year = CREATE.year;
        V().toast('점검표가 생성되었습니다.');
        renderDetail(res.id);
    }

    /* ── 온나라 상신 팝업 확인 후 콜백 (상신은 submitPopup에서 이미 확정됨) ── */
    function afterSubmit(id) {
        V().toast('온나라 기안함에 보냈습니다.');
        renderDetail(id);
    }

    /* 결재 결과 회신 등록 — 화면 처리.
     * 2026-08-27 에 「모의 수신」이라는 이름으로 한 번 제거했다가 2026-08-28 확정으로 되살렸다.
     * 없앴을 때 **상신하면 결재중에서 나올 길이 없어 집행액을 영영 입력할 수 없었다** —
     * 예산은 결재 결과가 후속 업무를 여는 도메인이라 회신을 뺄 수 없다(receiveOnnara 주석).
     * 되살리되 이름과 문구를 「모의 수신」에서 **「회신 등록 — 연계 전 수동 기록」**으로 바꿨다:
     * 이 자리는 결재하는 곳이 아니라 온나라가 보낸 결과를 옮겨 적는 곳이다. */
    function recvOnnara(id, kind, meta) {
        const res = receiveOnnara(id, kind, '', meta);
        if (!res.ok) { V().toast(res.msg); return; }
        V().toast(res.msg);
        const s = getSheet(id);
        if (s && isLocked(s.status)) {
            refreshStatusModal(id);          /* 결재중 반영 — 모달 유지, 본문만 갱신 */
        } else {
            V().closeModal();                /* 최종 승인·반려 — 결재중 종료 */
            renderDetail(id);
        }
    }
    function refreshStatusModal(id) {
        const body = document.querySelector('#v2-modal .modal-body');
        if (body) body.innerHTML = statusModalBody(id);
    }
    /* 결재 완료 회신 — 생산등록번호·결재일을 모달 안 인라인으로 받는다(§1 · 2026-11-05 #6) */
    function approveToggle(id) {
        const box = document.getElementById('bgt-reject-form');
        if (!box) return;
        if (box.dataset.mode === 'approve' && box.style.display !== 'none') { rejectCancel(); return; }
        box.dataset.mode = 'approve';
        box.style.display = 'block';
        box.innerHTML =
            '<div class="bgt-reject-inline">' +
                '<label class="bgt-lab" for="bgt-prod-no">생산등록번호 (필수)</label>' +
                '<input id="bgt-prod-no" class="bgt-in" type="text" placeholder="예: 재난안전과-1234">' +
                '<label class="bgt-lab" for="bgt-appr-date" style="margin-top:8px;">결재일 (필수)</label>' +
                '<input id="bgt-appr-date" class="bgt-in" type="date">' +
                '<div class="bgt-act-btns" style="margin-top:8px;">' +
                    '<button class="btn btn-outline btn-sm" onclick="DYBGT._rejectCancel()">취소</button>' +
                    '<button class="btn btn-primary btn-sm" onclick="DYBGT._approveConfirm(\'' + id + '\')">결재 완료 회신 등록</button>' +
                '</div>' +
            '</div>';
        const el = document.getElementById('bgt-prod-no'); if (el) el.focus();
    }
    function approveConfirm(id) {
        const no = document.getElementById('bgt-prod-no');
        const dt = document.getElementById('bgt-appr-date');
        recvOnnara(id, 'approve', { prodNo: no ? no.value : '', apprDate: dt ? dt.value : '' });
    }
    /* 반려·반송 사유는 모달 안 인라인으로 받는다 — 별도 모달을 띄우지 않는다(CLAUDE.md §1) */
    function reasonToggle(id, mode) {
        const box = document.getElementById('bgt-reject-form');
        if (!box) return;
        if (box.dataset.mode === mode && box.style.display !== 'none' && box.innerHTML) { rejectCancel(); return; }
        const w = mode === 'return' ? '반송' : '반려';
        box.dataset.mode = mode;
        box.style.display = 'block';
        box.innerHTML =
            '<div class="bgt-reject-inline">' +
                '<label class="bgt-lab" for="bgt-reject-date">' + w + '일 (필수)</label>' +
                '<input id="bgt-reject-date" class="bgt-in" type="date">' +
                '<label class="bgt-lab" for="bgt-reject-reason" style="margin-top:8px;">' + w + ' 사유 (필수)</label>' +
                '<textarea id="bgt-reject-reason" class="bgt-in" rows="2" placeholder="온나라에서 확인한 ' + w + ' 사유를 그대로 옮겨 적으세요"></textarea>' +
                '<div class="bgt-act-btns" style="margin-top:8px;">' +
                    '<button class="btn btn-outline btn-sm" onclick="DYBGT._rejectCancel()">취소</button>' +
                    '<button class="btn btn-primary btn-sm" onclick="DYBGT._rejectConfirm(\'' + id + '\')">' + w + ' 회신 등록</button>' +
                '</div>' +
            '</div>';
        const ta = document.getElementById('bgt-reject-reason'); if (ta) ta.focus();
    }
    function rejectToggle(id) { reasonToggle(id, 'reject'); }
    function returnToggle(id) { reasonToggle(id, 'return'); }
    function rejectCancel() {
        const box = document.getElementById('bgt-reject-form');
        if (box) { box.style.display = 'none'; box.innerHTML = ''; box.dataset.mode = ''; }
    }
    function rejectConfirm(id) {
        const ta = document.getElementById('bgt-reject-reason');
        const reason = ta ? ta.value.trim() : '';
        const rd = document.getElementById('bgt-reject-date');
        const box = document.getElementById('bgt-reject-form');
        const kind = box && box.dataset.mode === 'return' ? 'return' : 'reject';
        const res = receiveOnnara(id, kind, reason, { rejDate: rd ? rd.value : '' });
        if (!res.ok) { V().toast(res.msg); return; }
        V().toast(res.msg);
        V().closeModal();
        renderDetail(id);
    }

    /* ── 목록/상세 진입 액션 ── */
    function openSheet(id) { renderDetail(id); }
    function back() { renderList(); }
    function delSheet(id) {
        const s = getSheet(id);
        if (!s) return;
        if (!confirm(s.year + '년 ' + s.target + ' 점검표를 삭제할까요? (작성중 상태만 가능)')) return;
        const res = removeSheet(id);
        V().toast(res.msg);
        renderList();
    }

    /* ── URL ?sheet= 반영 (선택) ── */
    function syncUrl(id) {
        try {
            const u = new URL(window.location.href);
            if (id) u.searchParams.set('sheet', id); else u.searchParams.delete('sheet');
            history.replaceState(null, '', u);
        } catch (e) {}
    }

    /* ── 유틸 ── */
    function cssEsc(s) { return String(s).replace(/["\\\]]/g, '\\$&'); }

    /* 화면 액션을 DYBGT 네임스페이스에 노출 (onclick 인라인 핸들러용, _접두사) */
    DYBGT._open = openSheet;
    DYBGT._back = back;
    DYBGT._del = delSheet;
    DYBGT._openCreate = openCreate;
    DYBGT._createConfirm = createConfirm;
    /* 온나라 전자결재 화면 액션 */
    DYBGT._submitPopup = submitPopup;      /* [온나라로 보내기] → 지면 미리보기 */
    DYBGT._afterSubmit = afterSubmit;      /* 상신 팝업 확인 후 상세 갱신 */
    DYBGT._statusModal = statusModal;      /* [결재 상태 조회] 모달 */
    DYBGT._apprHistory = apprHistoryModal; /* [이력] 모달 */
    DYBGT._confirmSend = confirmSend;      /* 미리보기 → 되돌릴 수 없다는 확인 */
    DYBGT._doSubmit = doSubmit;            /* 확인 → 실제 보내기 */
    DYBGT._recv = recvOnnara;              /* 결재 결과 회신 등록(결재중 반영/완료) */
    DYBGT._rejectToggle = rejectToggle;    /* 반려 회신 사유 인라인 토글 */
    DYBGT._returnToggle = returnToggle;    /* 반송 회신 사유 인라인 토글 */
    DYBGT._approveToggle = approveToggle;  /* 결재 완료 회신 — 생산등록번호·결재일 인라인 */
    DYBGT._approveConfirm = approveConfirm;
    DYBGT._rejectCancel = rejectCancel;
    DYBGT._rejectConfirm = rejectConfirm;

    /* 최초 진입: ?sheet= 있으면 상세, 아니면 목록 */
    (function boot() {
        let sheetId = null;
        try { sheetId = new URL(window.location.href).searchParams.get('sheet'); } catch (e) {}
        if (sheetId && getSheet(sheetId)) renderDetail(sheetId);
        else renderList();
    })();
})();
