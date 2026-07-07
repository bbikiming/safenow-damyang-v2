/* =========================================================================
 * 담양군 중대재해예방 통합관리시스템 v2 — 예산관리 (BGT)
 *   · 데이터 레이어 (window.DYBGT) + BGT01-V 예산 총괄표 화면 렌더
 *   · localStorage 영속 키 'dybgt-v3' = { targets, items, sheets, policies }
 *   · 화면 렌더는 #bgt-app 가 있을 때만 실행 (bgt-settings.html은 데이터 레이어로만 로드)
 *
 * 요구사항 매핑 (화면 정의서 추적용):
 *   R2 — 편성·집행·집행률 진행 확인 (KPI + 총괄 테이블 + 프로그레스 바)
 *   R4 — 기관별·시설별 편성·집행 점검표 생성 (대상은 targets 마스터에서)
 *   R5 — 점검표 등록·조회·수정
 *   R6 — 전자결재(온나라) 수신 구조 — 상신 + 결재 상태 조회(수신값 반영)
 *
 *   [3차] 점검 대상 = 조직도(기관)·대상 관리(시설) 연계 선택.
 *     · 기관 원본 = 타 메뉴 공용 조직도(window.EDOC.ORG_TREE 부서 목록)
 *     · 시설 원본 = 대상 관리(FMS 시설물 현황) 연계 시뮬레이션(FAC_SOURCE, 종별·안전점검 등급)
 *     · 자체 수기 등록·자체 FMS 동기화 폐지 — 팝업 뷰에서 다중 선택해 추가(addTargetsFromSource)
 * ========================================================================= */
(function () {
    'use strict';

    const KEY = 'dybgt-v3';
    /* DYV2.esc 재사용 (XSS 방지) — common.js 로드 전 호출 대비 폴백 */
    const esc = s => (window.DYV2 && DYV2.esc)
        ? DYV2.esc(s)
        : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

    /* ── 시설 원본 FAC_SOURCE (대상 관리 연계 데이터 시뮬레이션) ──
     * '중대재해 관리 대상 현황정보 관리'(대상 관리 메뉴)가 FMS 시설물을 연계해 제공하는
     * 원본을 흉내낸 상수. 9건 = 기존 6 + 담양청소년수련관·담양국민체육센터·메타세쿼이아랜드 관리동.
     *   cls   : 시설물안전법 종별(1·2·3종)
     *   grade : 안전점검 등급(A~D)
     * listSources('시설')가 이 원본을 그대로 노출하고, addTargetsFromSource가 선택분의
     * cls·grade 를 target 에 복사한다. (자체 등록·자체 동기화 없음 — 대상 관리에서 현행화) */
    const FAC_SOURCE = [
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
         * 대상 관리에 '추가된' 대상만 시드. 픽커 데모 목적으로 최소 축소:
         *   기관(org) = 조직도 연계 2건(재난안전과·환경과, src '조직도')
         *   시설(fac) = 대상 관리 연계 2건(담양군민체육관·담양하수처리장, src '대상관리',
         *               FAC_SOURCE와 동일한 cls·grade 복사) — 점검표 시드가 참조하는 대상만 */
        const facSeed = ['담양군민체육관', '담양하수처리장'].map((name, i) => {
            const src = FAC_SOURCE.find(f => f.name === name) || {};
            return { id: 'tg-f' + (i + 1), name, src: '대상관리', cls: src.cls || '', grade: src.grade || '' };
        });
        const targets = {
            org: ['재난안전과', '환경과'].map((name, i) => ({ id: 'tg-o' + (i + 1), name, src: '조직도' })),
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

        const sheets = [
            /* 승인완료 2건 — 집행 진행 중, 집행률 서로 다르게. onnara steps 4행(상신/팀장/과장/부군수) */
            {
                id: 'bs-2026-1', year: 2026, targetType: '기관', target: '재난안전과',
                rows: [
                    row('it-2', 120000, 96000, '청사 비상유도등 교체 집행'),
                    row('it-3', 90000, 72000, '옥상 안전난간 보강'),
                    row('it-8', 40000, 28000, '안전모·안전화 일괄 구입'),
                ],
                status: '승인완료', rejectReason: '',
                onnara: {
                    docNo: '온나라-2026-1042',
                    steps: [
                        { at: '2026-05-28 14:10', act: '결재 상신', by: '김담당(재난안전과)', note: '-' },
                        { at: '2026-05-29 09:20', act: '팀장 승인', by: '이팀장', note: '-' },
                        { at: '2026-05-30 11:05', act: '과장 승인', by: '김과장', note: '-' },
                        { at: '2026-06-02 11:00', act: '부군수 승인 — 승인 완료', by: '부군수', note: '승인 완료' },
                    ],
                },
                history: [
                    { at: '2026-05-20 09:30', ev: '점검표 생성' },
                    { at: '2026-05-28 14:10', ev: '온나라 결재 상신 (온나라-2026-1042)' },
                    { at: '2026-06-02 11:00', ev: '온나라 승인 완료 수신' },
                ],
                updated: '2026-06-30 16:20',
            },
            {
                id: 'bs-2026-2', year: 2026, targetType: '시설', target: '담양군민체육관',
                rows: [
                    row('it-2', 60000, 18000, '체육관 소방설비 정비'),
                    row('it-6', 50000, 20000, '작업용 리프트 임차'),
                    row('it-9', 30000, 9000, '보호구 비치'),
                ],
                status: '승인완료', rejectReason: '',
                onnara: {
                    docNo: '온나라-2026-1078',
                    steps: [
                        { at: '2026-05-30 15:40', act: '결재 상신', by: '김담당(재난안전과)', note: '-' },
                        { at: '2026-06-02 10:15', act: '팀장 승인', by: '이팀장', note: '-' },
                        { at: '2026-06-03 14:30', act: '과장 승인', by: '김과장', note: '-' },
                        { at: '2026-06-05 09:20', act: '부군수 승인 — 승인 완료', by: '부군수', note: '승인 완료' },
                    ],
                },
                history: [
                    { at: '2026-05-22 10:00', ev: '점검표 생성' },
                    { at: '2026-05-30 15:40', ev: '온나라 결재 상신 (온나라-2026-1078)' },
                    { at: '2026-06-05 09:20', ev: '온나라 승인 완료 수신' },
                ],
                updated: '2026-06-28 10:05',
            },
            /* 결재중 1건 — onnara steps 1행(상신만) */
            {
                id: 'bs-2026-3', year: 2026, targetType: '기관', target: '환경과',
                rows: [
                    row('it-5', 70000, 0, ''),
                    row('it-6', 45000, 0, ''),
                ],
                status: '결재중', rejectReason: '',
                onnara: {
                    docNo: '온나라-2026-1103',
                    steps: [
                        { at: '2026-06-18 13:30', act: '결재 상신', by: '김담당(재난안전과)', note: '-' },
                    ],
                },
                history: [
                    { at: '2026-06-01 10:00', ev: '점검표 생성' },
                    { at: '2026-06-18 13:30', ev: '온나라 결재 상신 (온나라-2026-1103)' },
                ],
                updated: '2026-06-18 13:30',
            },
            /* 작성중 1건 — onnara null (미상신) */
            {
                id: 'bs-2026-4', year: 2026, targetType: '시설', target: '담양하수처리장',
                rows: [
                    row('it-3', 80000, 0, ''),
                    row('it-8', 25000, 0, ''),
                    row('it-9', 20000, 0, ''),
                ],
                status: '작성중', rejectReason: '',
                onnara: null,
                history: [
                    { at: '2026-06-25 11:15', ev: '점검표 생성' },
                ],
                updated: '2026-06-25 11:15',
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
     * 점검 대상 (기관·시설) — §7 REQ-A (3차: 연계 선택)
     *   type: '기관' → targets.org / '시설' → targets.fac
     *   대상은 자체 등록하지 않고 연계 원본에서 팝업으로 선택해 추가한다.
     *     · 기관 원본 = 공용 조직도(window.EDOC.ORG_TREE 부서)  src '조직도'
     *     · 시설 원본 = 대상 관리 연계(FAC_SOURCE 종별·등급)   src '대상관리'
     * ───────────────────────────────────────────────────────────────────── */
    function targetBucket(type) { return type === '시설' ? _data.targets.fac : _data.targets.org; }
    function targetPrefix(type) { return type === '시설' ? 'tg-f' : 'tg-o'; }

    function listTargets(type) { return targetBucket(type).slice(); }

    /* 점검표(sheets)에서 대상 이름으로 사용 중인지 */
    function targetUsed(name) {
        return _data.sheets.some(s => s.target === name);
    }

    /* 연계 원본 목록 (선택 팝업이 참조) — 픽커 계약 고정
     *   type '기관' : 공용 조직도 부서. EDOC 부재 시 [] 폴백
     *                 → [{ name, meta: '구성원 N명' }]
     *   type '시설' : 대상 관리 연계(FAC_SOURCE) 그대로
     *                 → [{ name, cls, grade }] */
    function listSources(type) {
        if (type === '시설') {
            return FAC_SOURCE.map(f => ({ name: f.name, cls: f.cls, grade: f.grade }));
        }
        const tree = (window.EDOC && EDOC.ORG_TREE) || [];
        return tree.map(d => ({ name: d.dept, meta: '구성원 ' + ((d.members || []).length) + '명' }));
    }

    /* 원본에서 선택한 이름들을 대상으로 추가 (다중) — 픽커 계약 고정
     *   · 원본(listSources)에 존재하고 아직 미등록인 이름만 추가
     *   · 시설은 원본의 cls·grade 를 target 에 복사 / src 는 기관='조직도'·시설='대상관리'
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
            if (!name || !srcRow || bucket.some(t => t.name === name)) { skipped++; return; }
            const tg = { id: pfx + (next++), name, src: type === '시설' ? '대상관리' : '조직도' };
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
        if (targetUsed(tg.name)) return { ok: false, msg: '점검표에서 사용 중인 대상은 삭제할 수 없습니다.' };
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
        const itemIds = o.itemIds || [];
        if (!target) return { ok: false, msg: '대상을 선택하세요.' };
        if (!itemIds.length) return { ok: false, msg: '예방 항목을 1개 이상 선택하세요.' };
        if (_data.sheets.some(s => s.year === year && s.target === target)) {
            return { ok: false, msg: '이미 ' + year + '년 ' + target + ' 점검표가 있습니다.' };
        }
        const n = _data.sheets.reduce((mx, s) => {
            const m = new RegExp('^bs-' + year + '-(\\d+)$').exec(s.id); return m ? Math.max(mx, +m[1]) : mx;
        }, 0) + 1;
        const id = 'bs-' + year + '-' + n;
        _data.sheets.unshift({
            id, year, targetType, target,
            rows: itemIds.map(itemId => ({ itemId, plan: 0, exec: 0, note: '' })),
            status: '작성중', rejectReason: '', onnara: null,
            history: [{ at: now(), ev: '점검표 생성' }],
            updated: now(),
        });
        save();
        return { ok: true, msg: '점검표가 생성되었습니다.', id };
    }

    /* 상태 규칙 (데이터 레이어에서 강제 — 편집 잠금 매트릭스):
     *  - plan(편성) 수정: '작성중'·'반려'만
     *  - exec(집행)·note(비고): '결재중' 제외 항상 (승인완료 후에도 계속)
     *  - '결재중'에는 모든 편집 잠금 */
    function canEditPlan(status) { return status === '작성중' || status === '반려'; }
    function canEditExec(status) { return status !== '결재중'; }

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
     * 온나라 전자결재 — §3 REQ-C (수신 구조)
     *   · sheet.onnara = { docNo:'온나라-2026-<4자리>', steps:[{at, act, by, note}] }
     *   · 결재선 고정: 팀장(이팀장) → 과장(김과장) → 부군수(부군수)
     *   · 승인·반려는 '처리'가 아니라 온나라에서 수신하는 값(receiveOnnara)
     * ───────────────────────────────────────────────────────────────────── */
    const APPROVER = '김담당(재난안전과)';           /* 상신자 */
    const MID_STEPS = [                              /* 중간 결재 순서 */
        { act: '팀장 승인', by: '이팀장' },
        { act: '과장 승인', by: '김과장' },
    ];

    /* docNo 신규 발급 — '온나라-2026-<4자리>' (기존 발급 번호와 충돌 회피) */
    function issueDocNo() {
        const used = new Set(_data.sheets.map(s => s.onnara && s.onnara.docNo).filter(Boolean));
        let no;
        do { no = '온나라-2026-' + String(Math.floor(1000 + Math.random() * 9000)); }
        while (used.has(no));
        return no;
    }
    /* steps 에서 이미 처리된 중간 결재 단계 수 (팀장·과장) */
    function midDone(s) {
        const steps = (s.onnara && s.onnara.steps) || [];
        return MID_STEPS.filter(m => steps.some(x => x.act === m.act)).length;
    }

    /* 상신 — status '결재중', docNo 최초 1회 발급·저장, steps 에 '결재 상신' 행 추가(재상신도 누적) */
    function submitSheet(id) {
        const s = getSheet(id);
        if (!s) return { ok: false, msg: '점검표를 찾을 수 없습니다.' };
        if (s.status !== '작성중' && s.status !== '반려') return { ok: false, msg: '작성중·반려 상태에서만 상신할 수 있습니다.' };
        if (!s.onnara) s.onnara = { docNo: issueDocNo(), steps: [] };
        else if (!s.onnara.docNo) s.onnara.docNo = issueDocNo();
        const at = now();
        s.onnara.steps.push({ at, act: '결재 상신', by: APPROVER, note: '-' });
        s.status = '결재중';
        s.rejectReason = '';
        s.history.push({ at, ev: '온나라 결재 상신 (' + s.onnara.docNo + ')' });
        s.updated = at;
        save();
        return { ok: true, msg: '온나라로 상신되었습니다.', docNo: s.onnara.docNo };
    }

    /* 온나라 결재 결과 수신 (연계 응답 반영)
     *  kind 'mid'    : 중간 결재 1단계 승인 수신 — 팀장 → 과장 순차 1행, status '결재중' 유지
     *  kind 'approve': 최종 승인 수신 — 미진행 중간 단계 자동 보충 + 부군수 승인, status '승인완료'
     *  kind 'reject' : 반려 수신 — 반려 행 + 사유(필수), status '반려'
     */
    function receiveOnnara(id, kind, reason) {
        const s = getSheet(id);
        if (!s) return { ok: false, msg: '점검표를 찾을 수 없습니다.' };
        if (s.status !== '결재중' || !s.onnara) return { ok: false, msg: '결재중 상태에서만 수신할 수 있습니다.' };
        const at = now();
        const steps = s.onnara.steps;

        if (kind === 'mid') {
            const done = midDone(s);
            if (done >= MID_STEPS.length) return { ok: false, msg: '중간 결재가 이미 완료되었습니다. 최종 승인을 수신하세요.' };
            const step = MID_STEPS[done];
            steps.push({ at, act: step.act, by: step.by, note: '-' });
            s.history.push({ at, ev: '온나라 ' + step.act + ' 수신' });
            s.updated = at;
            save();
            return { ok: true, msg: step.act + ' 수신됨', act: step.act };
        }

        if (kind === 'approve') {
            /* 미진행 중간 단계 자동 보충 */
            for (let i = midDone(s); i < MID_STEPS.length; i++) {
                steps.push({ at, act: MID_STEPS[i].act, by: MID_STEPS[i].by, note: '-' });
            }
            steps.push({ at, act: '부군수 승인 — 승인 완료', by: '부군수', note: '승인 완료' });
            s.status = '승인완료';
            s.rejectReason = '';
            s.history.push({ at, ev: '온나라 승인 완료 수신' });
            s.updated = at;
            save();
            return { ok: true, msg: '최종 승인이 수신되었습니다.' };
        }

        if (kind === 'reject') {
            const rs = String(reason || '').trim();
            if (!rs) return { ok: false, msg: '반려 사유를 입력하세요.' };
            /* 당시 결재 단계 처리자 = 다음 처리 예정자 */
            const by = midDone(s) < MID_STEPS.length ? MID_STEPS[midDone(s)].by : '부군수';
            steps.push({ at, act: '반려', by, note: rs });
            s.status = '반려';
            s.rejectReason = rs;
            s.history.push({ at, ev: '온나라 반려 수신 — ' + rs });
            s.updated = at;
            save();
            return { ok: true, msg: '반려가 수신되었습니다.' };
        }

        return { ok: false, msg: '알 수 없는 수신 유형입니다.' };
    }

    /* ─────────────────────────────────────────────────────────────────────
     * 집계
     * ───────────────────────────────────────────────────────────────────── */
    function rate(plan, exec) {
        return plan > 0 ? Math.round(exec / plan * 100) : 0;
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
    function listPolicies() { return _data.policies; }

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
        return { '작성중': 'neutral', '결재중': 'info', '승인완료': 'success', '반려': 'danger' }[st] || 'neutral';
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
            card('집행률', r + '<span class="unit">%</span>', '편성 ' + fmtAmt(plan) + ' 기준') +
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
                '</select>' +
                '<select class="select" id="bgt-f-type">' +
                    '<option value="">대상구분 전체</option>' +
                    '<option value="기관"' + (UI.targetType === '기관' ? ' selected' : '') + '>기관</option>' +
                    '<option value="시설"' + (UI.targetType === '시설' ? ' selected' : '') + '>시설</option>' +
                '</select>' +
                '<select class="select" id="bgt-f-status">' +
                    ['', '작성중', '결재중', '승인완료', '반려'].map(v =>
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
        const rejectBox = (s.status === '반려' && s.rejectReason)
            ? '<div class="bgt-reject"><b>반려 사유</b> ' + esc(s.rejectReason) + '</div>'
            : '';

        /* 행 테이블 — 항목 / 편성액 / 집행액 / 집행률 / 비고 */
        const rowsHtml = (s.rows || []).map(r => {
            const rr = rate(r.plan, r.exec);
            const planDis = planEditable ? '' : ' disabled';
            const execDis = execEditable ? '' : ' disabled';
            return '<tr>' +
                '<td>' + esc(itemPath(r.itemId)) + '</td>' +
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
        if (status === '작성중' || status === '반려') msg = '편성액·집행액·비고를 입력할 수 있습니다. 입력 즉시 자동 저장됩니다.';
        else if (status === '결재중') msg = '결재중에는 편집이 잠깁니다. 승인 완료 후 집행액을 등록할 수 있습니다.';
        else msg = '승인 완료 — 집행액·비고는 계속 입력할 수 있습니다. (편성액은 잠금)';
        return '<p class="bgt-edit-hint">' + esc(msg) + '</p>';
    }

    /* 상태별 전자결재 카드 — §3 REQ-C
     * 공통: '온나라 결재' 행(칩 + docNo + [이력]) + 상태별 액션/안내 */
    function actionCard(s) {
        const docNo = (s.onnara && s.onnara.docNo) || '';
        /* 공통 행 — 경영방침 상세 '온나라 결재' 행과 동일 배치 */
        const commonRow = '<div class="bgt-appr-row">' +
            '<span class="bgt-appr-lab">온나라 결재</span>' +
            statusChip(s.status) +
            (docNo ? '<span class="bgt-appr-docno">' + esc(docNo) + '</span>' : '') +
            '<button class="btn btn-sm btn-outline" onclick="DYBGT._apprHistory(\'' + s.id + '\')">이력</button>' +
        '</div>';

        let body;
        if (s.status === '작성중' || s.status === '반려') {
            body = '<p class="bgt-act-desc">작성한 점검표를 온나라 전자결재로 상신합니다. 결재중에는 편집이 잠깁니다.</p>' +
                '<button class="btn btn-primary" onclick="DYBGT._submitPopup(\'' + s.id + '\')">온나라 결재 상신</button>';
        } else if (s.status === '결재중') {
            body = '<p class="bgt-act-desc">온나라 결재가 진행 중입니다. 승인·반려 결과는 온나라에서 수신하며, 시스템에서 직접 처리하지 않습니다.</p>' +
                '<button class="btn btn-primary" onclick="DYBGT._statusModal(\'' + s.id + '\')">결재 상태 조회</button>';
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
              '</tbody></table></div>'
            : '<p style="font-size:var(--fs-13); color:var(--text-gray); text-align:center; padding:20px 0;">결재 이력이 없습니다 — 상신 후 이력이 기록됩니다.</p>';
        V().openModal('온나라 결재 이력' + (docNo ? ' — ' + docNo : ''), body,
            '<button class="btn btn-primary" onclick="DYV2.closeModal()">확인</button>');
    }

    /* 온나라 결재 상신 팝업 — 발급 docNo 표기 (EDOC.onnaraPopup는 자체 docNo를 쓰므로,
     * 저장된 docNo와 일치시키기 위해 본 화면 소유 팝업으로 대체) */
    function submitPopup(id) {
        const res = submitSheet(id);              /* docNo 발급·상신은 여기서 확정 */
        if (!res.ok) { V().toast(res.msg); return; }
        /* 배경 상세를 먼저 '결재중' 뷰로 갱신 — 팝업이 백드롭·×·ESC 어떤 경로로
         * 닫혀도 화면·데이터가 일치하도록 (팝업 [확인]의 _afterSubmit 재렌더와 무관) */
        renderDetail(id);
        const s = getSheet(id);
        const title = s.year + '년 ' + esc(s.target) + ' 예산 편성·집행 점검표';
        V().openModal('온나라 결재 요청',
            '<div style="text-align:center; padding:8px 4px 4px;">' +
            '<p style="font-size:14px; font-weight:700; margin-bottom:6px;">온나라로 결재 요청을 보냈습니다</p>' +
            '<p style="font-size:12px; color:var(--text-gray);">' + title + '<br>문서번호 <b>' + esc(res.docNo) + '</b> · 결재선: 팀장 → 과장 → 부군수</p>' +
            '<p style="font-size:12px; color:var(--text-gray); margin-top:8px;">승인·반려 결과는 온나라에서 수신됩니다. (연계 시뮬레이션)</p>' +
            '</div>',
            '<button class="btn btn-primary" onclick="DYV2.closeModal(); DYBGT._afterSubmit(\'' + id + '\')">확인</button>');
    }

    /* 결재 상태 조회 모달 — 현재 steps 4열 + 모의 수신 버튼 3종 (연계 시뮬레이션) */
    function statusModal(id) {
        const s = getSheet(id); if (!s || s.status !== '결재중') return;
        V().openModal('온나라 결재 상태 조회 (연계 시뮬레이션)', statusModalBody(id),
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
            '<p class="bgt-act-desc" style="margin-bottom:10px;">문서번호 <b>' + esc(docNo) + '</b> · 결재선: 팀장(이팀장) → 과장(김과장) → 부군수(부군수)</p>' +
            table +
            '<div class="bgt-sim-box">' +
                '<div class="bgt-sim-head">모의 수신 (온나라 연계 응답)</div>' +
                '<div class="bgt-act-btns">' +
                    '<button class="btn btn-sm btn-outline" onclick="DYBGT._recv(\'' + id + '\', \'mid\')">중간 승인 수신</button>' +
                    '<button class="btn btn-sm btn-primary" onclick="DYBGT._recv(\'' + id + '\', \'approve\')">최종 승인 수신</button>' +
                    '<button class="btn btn-sm btn-outline" onclick="DYBGT._rejectToggle(\'' + id + '\')">반려 수신</button>' +
                '</div>' +
                '<div id="bgt-reject-form" style="display:none;"></div>' +
            '</div>' +
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
    const CREATE = { year: 2026, targetType: '기관', target: '', checked: {} };

    function openCreate() {
        CREATE.year = UI.year || 2026;
        CREATE.targetType = '기관';
        CREATE.target = '';
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
            list.map(t => '<option value="' + esc(t.name) + '"' + (CREATE.target === t.name ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('');
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
        if (tg) tg.onchange = () => { CREATE.target = tg.value; };
    }
    function wireCreate() {
        const yr = document.getElementById('bgt-c-year');
        if (yr) yr.onchange = () => { CREATE.year = Number(yr.value); };
        wireTargetField();
        /* 대상구분 라디오 — 변경 시 대상 필드 재렌더(listTargets) + 라디오 하이라이트 */
        document.querySelectorAll('input[name="bgt-ttype"]').forEach(r => {
            r.onchange = () => {
                CREATE.targetType = r.value;
                CREATE.target = '';
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
        if (!CREATE.target) { V().toast('대상을 선택하세요.'); return; }
        const checkedIds = Object.keys(CREATE.checked);
        const leafIds = checkedIds.filter(id => itemChildren(id).length === 0);
        if (!leafIds.length) { V().toast('예방 항목을 1개 이상 선택하세요.'); return; }
        const res = createSheet({ year: CREATE.year, targetType: CREATE.targetType, target: CREATE.target, itemIds: leafIds });
        if (!res.ok) { V().toast(res.msg); return; }
        V().closeModal();
        UI.year = CREATE.year;
        V().toast('점검표가 생성되었습니다.');
        renderDetail(res.id);
    }

    /* ── 온나라 상신 팝업 확인 후 콜백 (상신은 submitPopup에서 이미 확정됨) ── */
    function afterSubmit(id) {
        V().toast('온나라로 상신되었습니다.');
        renderDetail(id);
    }

    /* 결재 상태 조회 모달 안 '모의 수신' 처리 — 수신 반영 후 모달 본문 + 상세 갱신 */
    function recvOnnara(id, kind) {
        const res = receiveOnnara(id, kind);
        if (!res.ok) { V().toast(res.msg); return; }
        V().toast(res.msg);
        const s = getSheet(id);
        if (s && s.status === '결재중') {
            /* 중간 승인 수신 — 모달 유지, 본문(steps 테이블) 갱신 */
            refreshStatusModal(id);
        } else {
            /* 최종 승인·반려 수신 — 결재중 종료, 모달 닫고 상세 갱신 */
            V().closeModal();
            renderDetail(id);
        }
    }
    /* 상태 조회 모달 본문 재렌더 (열린 모달 안에서만) */
    function refreshStatusModal(id) {
        const body = document.querySelector('#v2-modal .modal-body');
        if (body) body.innerHTML = statusModalBody(id);
    }

    /* 반려 수신 — 사유 인라인 입력 (모달 안, 별도 모달 금지) */
    function rejectToggle(id) {
        const box = document.getElementById('bgt-reject-form');
        if (!box) return;
        if (box.style.display !== 'none' && box.innerHTML) { box.style.display = 'none'; box.innerHTML = ''; return; }
        box.style.display = 'block';
        box.innerHTML =
            '<div class="bgt-reject-inline">' +
                '<label class="bgt-lab">반려 사유 (필수)</label>' +
                '<textarea id="bgt-reject-reason" class="bgt-in" rows="2" placeholder="온나라에서 수신된 반려 사유를 입력하세요"></textarea>' +
                '<div class="bgt-act-btns" style="margin-top:8px;">' +
                    '<button class="btn btn-outline btn-sm" onclick="DYBGT._rejectCancel()">취소</button>' +
                    '<button class="btn btn-primary btn-sm" onclick="DYBGT._rejectConfirm(\'' + id + '\')">반려 수신 반영</button>' +
                '</div>' +
            '</div>';
        const ta = document.getElementById('bgt-reject-reason'); if (ta) ta.focus();
    }
    function rejectCancel() {
        const box = document.getElementById('bgt-reject-form');
        if (box) { box.style.display = 'none'; box.innerHTML = ''; }
    }
    function rejectConfirm(id) {
        const ta = document.getElementById('bgt-reject-reason');
        const reason = ta ? ta.value.trim() : '';
        if (!reason) { V().toast('반려 사유를 입력하세요.'); return; }
        const res = receiveOnnara(id, 'reject', reason);
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
    DYBGT._submitPopup = submitPopup;      /* [온나라 결재 상신] → 상신 팝업(발급 docNo) */
    DYBGT._afterSubmit = afterSubmit;      /* 상신 팝업 확인 후 상세 갱신 */
    DYBGT._statusModal = statusModal;      /* [결재 상태 조회] 모달 */
    DYBGT._apprHistory = apprHistoryModal; /* [이력] 모달 */
    DYBGT._recv = recvOnnara;              /* 모의 수신(중간/최종) */
    DYBGT._rejectToggle = rejectToggle;    /* 반려 수신 사유 인라인 토글 */
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
