/* =========================================================================
 * 담양군 중대재해예방 통합관리시스템 v2 — 시설물 안전관리 (FAC)
 *   데이터 레이어(window.DYFACIL) + 5개 화면 렌더
 *   화면: FAC01-V 대장목록 / FAC02-D 상세·보완입력 / FAC03-V 위험도 /
 *         FAC04-S FMS 연계 / FAC05-S 연계 설정
 *   영속 키 'dyfacil-v1' = { recs, ext, syncLog, settings }
 *     recs  = FMS 소유(읽기전용) — 시드는 js/facil-data.js DY_FACIL_SEED.recs (80건)
 *     ext   = 보완입력 { <facilNo>: {...} } — 수신이 덮어쓰지 않는 칸.
 *             입력은 6항목만 받는다(2026-08-13 축소). 그중 4개는 FMS 추가 연계가
 *             붙으면 소유권이 FMS 로 넘어가는 **임시** 입력이다(openDetail 주석).
 *     syncLog = 수신/전송·필드변경 감사추적 []
 *     settings = FMS 연계 파라미터
 *   기획 근거: docs/planning/기획-시설물관리-FMS연계-PRD-v1.md
 *   단일 모달 규칙: 부가 UX는 DYV2.openModal / 인라인 패널만 사용(적층 금지).
 * ========================================================================= */
(function () {
    'use strict';

    const KEY = 'dyfacil-v1';
    const esc = s => (window.DYV2 && DYV2.esc) ? DYV2.esc(s)
        : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const V = () => window.DYV2;
    /* 연계 이력·보완입력 타임스탬프 — **날짜는 기준일(§11), 시각만 실제 시계**다.
       종전에는 통째로 실제 시각이라, 수신·전송이 한 번만 일어나도 연계 관리의
       「마지막 수신」이 기준일보다 미래 날짜로 뜨고 연계 로그가 법제처 수집 배치
       위로 올라갔다 — 화면들이 서로 다른 '오늘'을 말하는 것이 §11 이 없애려던 결함이다.
       시각까지 기준일로 굳히지 않는 이유는 정렬이다. 같은 날 연달아 한 작업이 모두
       같은 문자열이 되면 연계 로그의 최신 순 정렬이 무너져 방금 한 일을 찾을 수 없다.
       DYV2 부재를 전제한 이 파일의 지연 접근 관례(V()·esc·thisYear)를 여기도 따른다. */
    const now = () => {
        const d = (window.DYV2 && DYV2.today) ? DYV2.today() : new Date().toISOString().slice(0, 10);
        const t = new Date();
        const p = n => (n < 10 ? '0' : '') + n;
        return d + ' ' + p(t.getHours()) + ':' + p(t.getMinutes());
    };
    /* 기준일 단일 출처(§11) — 상수로 박아 두면 DEMO_TODAY 를 옮겼을 때
       «준공 경과 N년»만 옛 해를 기준으로 남는다. 이 파일은 DYV2 부재를 전제한
       지연 접근 관례를 쓰므로(V()·esc) 여기도 호출 시점에 읽는다. */
    const thisYear = () => +String((window.DYV2 && DYV2.today) ? DYV2.today() : new Date().toISOString()).slice(0, 4);

    /* ── 코드 라벨 (보유 가이드 기준 — FMS 최신 공통코드 규격 미수신, PRD §9-2) ── */
    const CLASS_NM = { '1': '1종', '2': '2종', '3': '3종' };
    const GRADE_DESC = {
        A: '우수 — 문제점 없는 최상 상태',
        B: '양호 — 보조부재 경미 결함, 기능 지장 없음',
        C: '보통 — 주요부재 경미 결함, 보수 필요',
        D: '미흡 — 긴급 보수·보강 필요, 사용제한 검토',
        E: '불량 — 심각 결함, 즉각 사용금지·개축',
    };
    /* 중대한결함등 — 시설물안전법 시행령 제18조. **두 축이다**:
     *   제1항 11호 = 구조안전에 중대한 영향(중대재해 산업 축)
     *   제2항  4호 = 공중이 이용하는 부위의 결함(중대시민재해 축) — 난간·포장·환기구 덮개
     * 종전 목록은 제5호(항만 계류시설)를 빠뜨리고 제10호(사면 균열 → 옹벽 균열·파손)를
     * 둘로 쪼개 개수만 11개로 맞춰 놓았고, 제2항은 통째로 없었다. 담양군은 공중이용시설
     * 관리자라 제2항이 오히려 핵심이다. 2026-08-11 조문 원문 대조로 바로잡음. */
    const DEFECT_GROUPS = [
        { label: '구조안전 (시행령 §18① 11호)', items: [
            '시설물기초의 세굴',
            '교량교각의 부등침하',
            '교량받침의 파손',
            '터널지반의 부등침하',
            '항만 계류시설 중 강관 또는 철근콘크리트파일의 파손·부식',
            '댐의 파이핑 및 구조적 균열',
            '건축물의 기둥·보 또는 내력벽의 내력 손실',
            '하천시설물의 본체, 교량 및 수문의 파손·누수·파이핑 또는 세굴',
            '시설물의 철근콘크리트의 염해 또는 탄산화에 따른 내력 손실',
            '절토사면 및 성토사면의 균열·이완 등에 따른 옹벽의 균열 또는 파손',
            '그 밖에 국토교통부령으로 정하는 구조안전 결함',
        ] },
        { label: '공중이 이용하는 부위 (시행령 §18② 4호)', items: [
            '시설물의 난간 등 추락방지시설의 파손',
            '도로교량·도로터널의 포장 부분이나 신축 이음부의 파손',
            '보행자 또는 차량이 이동하는 구간에 있는 환기구 등의 덮개 파손',
            '그 밖에 국토교통부령으로 정하는 공중 이용 부위의 결함',
        ] },
    ];
    /* ※ DEFECT_GROUPS 는 보완입력 축소(2026-08-13) 이후 입력 select 를 그리지 않는다.
       그래도 지우지 않는다 — 중대결함은 FMS 가 원천이라(등록·삭제 인터페이스가 없고
       updateMantbSeriousDefect 로 조치만 회신) 유형은 손으로 받을 값이 아니라
       **중대결함사후관리 연계로 수신할 값**이고, 이 목록이 그때 수신값을 읽는 기준표다.
       조문 원문 대조(2026-08-11)로 얻은 유일한 사본이기도 하다.
       종전 REPAIR_STATUS(보수보강 진행)는 제거했다 — 중대결함 조치는 개선조치 대장이
       맡는다는 확정(SCR-FAC-002 §6 FDT-08)과 중복이었다. */
    /* 위험도 산정에 쓰는 변수 종수 — 표시 분모의 단일 출처.
       경과연수·종별·내진·안전등급·최근점검·중대결함·이용인원 7종.
       하드코딩 8 이던 시절엔 어떤 시설물도 분모를 채울 수 없었다. */
    const RISK_VARS = 7;

    /* ── 스토어 ── */
    function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
    function persist(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }

    function seed() {
        const S = window.DY_FACIL_SEED || { recs: [], ext: {} };
        return {
            recs: JSON.parse(JSON.stringify(S.recs || [])),
            ext: JSON.parse(JSON.stringify(S.ext || {})),
            syncLog: [
                { at: '2026-07-01 06:00', dir: 'IN', iface: '엑셀 업로드', facilNo: '(전체)', key: '-', result: '성공', detail: '시설물관리대장 기본현황 80건 초기 적재' },
            ],
            settings: { orgCode: 'D-DAMYANG', userId: 'firex', batchDaily: true, batchLimit: 10, autoApprove: false },
        };
    }

    let DB = load();
    if (!DB || !DB.recs || !DB.recs.length) { DB = seed(); persist(DB); }
    /* 시드 스키마 진화 대비 */
    ['recs', 'ext', 'syncLog', 'settings'].forEach(k => { if (DB[k] == null) { DB[k] = seed()[k]; } });

    function save() { persist(DB); }
    function logSync(entry) {
        DB.syncLog.unshift(Object.assign({ at: now() }, entry));
        if (DB.syncLog.length > 200) DB.syncLog.length = 200;
        save();
    }

    /* ── 파생·조회 ── */
    function recOf(no) { return DB.recs.find(r => r.facilNo === no) || null; }
    function extOf(no) { return DB.ext[no] || {}; }
    function ageOf(r) { const y = (r.cplYmd || '').slice(0, 4); return /^\d{4}$/.test(y) ? (thisYear() - +y) : null; }
    function addrOf(r) { return [r.addrSido, r.addrGugun, r.addrDong, r.addrDetail].filter(x => x && x.trim()).join(' '); }
    /* 법정 점검주기 초과 개월 수 — 시행령 별표3. 등급별 주기(개월)를 기준으로 잰다.
       반환이 null 이면 판정 불가(점검일 없음). 양수면 초과 개월. */
    function cycleMonths(grade) { return (grade === 'D' || grade === 'E') ? 4 : 6; }
    function overdueMonths(last, grade) {
        if (!last) return null;
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(last); if (!m) return null;
        const t = (window.DYV2 && DYV2.today && DYV2.today()) || '';
        const tm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t); if (!tm) return null;
        const months = (+tm[1] - +m[1]) * 12 + (+tm[2] - +m[2]);
        return months - cycleMonths(grade);
    }
    /* 점수 — 주기 안이면 0, 한 주기까지 넘겼으면 8, 그 이상이면 16.
       계단으로 두는 이유: 개월 수에 비례시키면 오래 방치된 한 건이 다른
       모든 변수를 압도해 순위가 그 한 축으로만 정해진다. */
    function overdueScore(last, grade) {
        const od = overdueMonths(last, grade);
        if (od == null || od <= 0) return 0;
        return od <= cycleMonths(grade) ? 8 : 16;
    }
    /* 위험도: 확보된 변수만으로 점수. 핵심변수(안전등급 or 점검일) 없으면 '산정불가' — 0 처리 금지(PRD §8). */
    function riskOf(no) {
        const r = recOf(no), e = extOf(no);
        const have = [];
        let score = 0;
        const age = ageOf(r);
        if (age != null) { have.push('경과연수'); score += age >= 40 ? 30 : age >= 30 ? 22 : age >= 20 ? 12 : 5; }
        if (r.facilClass) { have.push('종별'); score += r.facilClass === '2' ? 10 : 6; }
        if (r.eqDsnAppYn) { have.push('내진'); score += r.eqDsnAppYn === 'Y' ? 0 : 6; }
        let coreMissing = true;
        if (e.safetyGrade) { have.push('안전등급'); coreMissing = false; score += { A: 0, B: 8, C: 18, D: 34, E: 45 }[e.safetyGrade] || 0; }
        /* 최근점검은 '몇 해 지났나'가 아니라 **법정 주기를 넘겼나**로 본다.
           A·B·C 는 반기 1회, D·E 는 연 3회(시행령 별표3)라 같은 1년 경과라도
           의미가 다르다 — 연수로만 재면 D·E 시설의 지연이 과소평가된다.
           경과 연수 기준은 별표3 수집 전의 임시식이었다(2026-08-11 정정). */
        if (e.lastInspectYmd) {
            have.push('최근점검'); coreMissing = false;
            score += overdueScore(e.lastInspectYmd, e.safetyGrade);
        }
        /* 중대결함은 '있음'일 때만 세면 결함 없는 시설물이 영원히 분모를 못 채운다.
           확인했다는 사실(있음/없음)이 곧 확보한 변수다 — 점수는 '있음'에만 더한다. */
        if (e.defectYn) { have.push('중대결함'); if (e.defectYn === 'Y') score += 40; }
        if (e.dailyUsers) { have.push('이용인원'); score += e.dailyUsers >= 1000 ? 12 : e.dailyUsers >= 300 ? 7 : 3; }
        if (coreMissing) return { level: 'na', score: null, have, label: '산정불가' };
        const level = score >= 55 ? 'high' : score >= 30 ? 'mid' : 'low';
        return { level, score, have, label: { high: '높음', mid: '보통', low: '낮음' }[level] };
    }
    /* 다음 정기안전점검 예정일 — 시설물안전법 시행령 별표3(안전점검 실시시기).
     *   A·B·C 등급 = 반기 1회 이상        → 최근 점검 + 6개월
     *   D·E   등급 = 1년 3회 이상          → 최근 점검 + 4개월
     *   안전등급 미지정 = 반기 1회 이상    → 최근 점검 + 6개월 (별표3 비고 2)
     * ※ D·E 는 법이 간격이 아니라 **시기**를 정한다 — 해빙기(2·3월)·우기(5·6월)·
     *   동절기(11·12월) 전 각 1회(비고 3). 아래 값은 연 3회를 균등 간격으로 환산한
     *   제안값이며, 실제 점검 시기는 그 세 창에 맞춰야 한다. 화면이 이 단서를 함께 낸다. */
    function suggestNext(last, grade) {
        if (!last) return '';
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(last); if (!m) return '';
        let y = +m[1], mo = +m[2] + ((grade === 'D' || grade === 'E') ? 4 : 6);
        y += Math.floor((mo - 1) / 12); mo = ((mo - 1) % 12) + 1;
        return y + '-' + String(mo).padStart(2, '0') + '-' + m[3];
    }
    /* 정기안전점검 주기 안내 문구 — 별표3 파생. 화면이 숫자만 던지지 않게 근거를 함께 낸다. */
    function cycleNote(grade) {
        return (grade === 'D' || grade === 'E')
            ? '연 3회 이상 — 해빙기(2·3월)·우기(5·6월)·동절기(11·12월) 전 각 1회'
            : (grade ? '반기 1회 이상' : '반기 1회 이상 (안전등급 지정 전)');
    }
    function counts() {
        const c = { total: DB.recs.length, cls2: 0, cls3: 0, aged: 0, noCoord: 0, noJur: 0, graded: 0 };
        DB.recs.forEach(r => {
            if (r.facilClass === '2') c.cls2++; if (r.facilClass === '3') c.cls3++;
            const a = ageOf(r); if (a != null && a >= 30) c.aged++;
            const e = extOf(r.facilNo);
            if (!e.lat || !e.lng) c.noCoord++;
            if (r.jur === '미상') c.noJur++;
            if (e.safetyGrade) c.graded++;
        });
        return c;
    }

    /* ── 자체 소유 필드 저장 (FMS 원본 불가침) ── */
    function saveExt(no, patch) {
        const before = Object.assign({}, extOf(no));
        DB.ext[no] = Object.assign({}, before, patch, { updatedAt: now() });
        save();
        const changed = Object.keys(patch).filter(k => String(before[k] || '') !== String(patch[k] || ''));
        if (changed.length) logSync({ dir: 'SELF', iface: '보완입력', facilNo: no, key: no, result: '저장', detail: changed.join(', ') + ' 변경' });
        return DB.ext[no];
    }

    /* ── FMS 전송(시뮬레이션) — 인터페이스 ID (PRD §5-2) ── */
    function sendFms(no, kind) {
        const r = recOf(no); if (!r) return { ok: false, msg: '대상 없음' };
        const iface = { insert: 'insertBastbMaster', update: 'updateBastbMaster', delete: 'deleteBastbMaster' }[kind];
        /* insertBastbMaster 는 상세제원(BASTB_DTL_*) 최소 1건 필수 — 미입력 차단 (PRD §5-2) */
        if (kind === 'insert') {
            return { ok: false, msg: 'insertBastbMaster는 상세제원(BASTB_DTL_*) 최소 1건이 필요합니다. 규모·구조 상세제원을 먼저 확보하세요.' };
        }
        logSync({ dir: 'OUT', iface, facilNo: no, key: r.facilNo, result: '0000 성공', detail: '반영키=' + r.facilNo + ' (시뮬레이션)' });
        return { ok: true, msg: iface + ' 전송 완료 — 반영키 ' + r.facilNo };
    }

    /* ── 엑셀(Ð 43토큰) 수신 파싱 — 프로토타입 재적재 시뮬레이션 (PRD §5-1) ── */
    const COL_ORDER = ['facilNo', 'facilNm', 'mngNo', 'mngMainCd', 'permitOrgCd', 'facilOwner', 'routeClass', 'routeDetail', 'facilClass', 'facilGbn', 'facilKind', 'facilDescCd', 'addrSido', 'addrGugun', 'addrDong', 'addrDetail', 'cplYmd', 'tempYmd', 'rspToYmd', 'designYmdFrom', 'designYmdTo', 'designerNm', 'constYmdFrom', 'constYmdTo', 'constractorCd', 'constractorNm', 'constAmt', 'spvYmdFrom', 'spvYmdTo', 'supervisorNm', 'constOrderCd', 'constOrderNm', 'constNm', 'constSpvsrNm', 'dsnKeepStatus', 'eqDsnAppYn', 'gamReasonCd', 'whlPhtFileCt', 'etcPhtFileCt', 'upperNo', 'lnkFacilNo', 'etcRemark'];
    /* 차이 미리보기: 업로드 레코드 vs 현재 대장 (신규/변경/동일). 자체소유 ext 는 건드리지 않음 */
    function diffAgainst(incoming) {
        const out = { add: [], upd: [], same: [] };
        incoming.forEach(row => {
            const cur = recOf(row.facilNo);
            if (!cur) { out.add.push(row); return; }
            const fields = COL_ORDER.filter(k => k in row && String(cur[k] || '') !== String(row[k] || ''));
            if (fields.length) out.upd.push({ row, fields }); else out.same.push(row);
        });
        return out;
    }
    function applyIncoming(incoming) {
        let added = 0, updated = 0;
        incoming.forEach(row => {
            const cur = recOf(row.facilNo);
            if (!cur) {
                row.jur = row.jur || '미상';
                DB.recs.push(Object.assign({ gbnNm: '', kindNm: '' }, row));
                added++;
            } else {
                COL_ORDER.forEach(k => { if (k in row) cur[k] = row[k]; });
                updated++;
            }
        });
        save();
        logSync({ dir: 'IN', iface: '엑셀 업로드', facilNo: '(배치)', key: '-', result: '성공', detail: '신규 ' + added + '건 · 변경 ' + updated + '건 반영' });
        return { added, updated };
    }

    /* ── 이 시설물에 달린 개선조치 (위험성평가 → 개선조치 사슬의 역방향 조회) ──
     * 검수 행에 붙인 시설물번호가 개선조치까지 승계되므로(js/rsk-data.js deliverFromReview),
     * 시설물 쪽에서 "이 시설물에 무슨 조치를 했나"를 되짚을 수 있다. 이름이 아니라
     * 시설물번호로 잇는 이유는 동명 시설물(삼지교 2건)·개명에 견디기 위해서다(PRD §4-3). */
    function impsOf(no) {
        const R = window.DYRSK;
        if (!R || typeof R.improvements !== 'function') return null;   /* 위험성평가 모듈 미로드 */
        return R.improvements().filter(m => m.hazard && m.hazard.facilNo === no);
    }

    /* ── 시설물 인라인 선택기 ──
     * 조직도 선택기(ORGPICK)와 **같은 GUI**(.org-inline/.otr-*)를 쓰고 데이터만 대장이다.
     * 별도 모달을 띄우지 않는다 — 모달 안에서 펼치는 인라인 패널(CLAUDE.md §1 단일 모달). */
    const GBN_GROUPS = [['BR', '교량'], ['AR', '건축물'], ['RI', '하천'], ['WS', '상하수도'], ['ET', '기타']];
    function facilTree(q) {
        q = String(q || '').trim().toLowerCase();
        const hit = r => !q || (r.facilNm + ' ' + r.facilNo + ' ' + addrOf(r)).toLowerCase().indexOf(q) >= 0;
        const out = GBN_GROUPS.map(g => {
            const list = DB.recs.filter(r => r.facilGbn === g[0] && hit(r));
            if (!list.length) return '';
            const open = q ? ' style="display:block;"' : '';
            return '<div class="otr-dept">' +
                '<button type="button" class="otr-deptbtn" onclick="DYFACIL._toggle(this)">' +
                    '<span class="otr-arrow">' + (q ? '▾' : '▸') + '</span> ' + g[1] +
                    ' <span class="otr-count">' + list.length + '건</span></button>' +
                '<div class="otr-members"' + open + '>' +
                list.map(r => '<button type="button" class="otr-member" onclick="DYFACIL._pick(this,\'' + r.facilNo + '\')">' +
                    '<span class="otr-role">' + (CLASS_NM[r.facilClass] || '-') + '</span>' +
                    '<span class="otr-name">' + esc(r.facilNm) +
                        ' <span class="otr-count">' + esc(r.facilNo) + '</span></span></button>').join('') +
                '</div></div>';
        }).join('');
        return '<div class="org-tree-root">담양군 시설물 대장 ' + DB.recs.length + '건</div>' +
            (out || '<div style="padding:10px;color:var(--text-gray);font-size:var(--fs-12);">검색 결과 없음</div>');
    }

    const DYFACIL = {
        list: (f) => {
            f = f || {};
            return DB.recs.filter(r => {
                if (f.gbn && r.facilGbn !== f.gbn) return false;
                if (f.cls && r.facilClass !== f.cls) return false;
                if (f.jur && r.jur !== f.jur) return false;
                if (f.aged && !((ageOf(r) || 0) >= 30)) return false;
                if (f.graded === 'y' && !extOf(r.facilNo).safetyGrade) return false;
                if (f.graded === 'n' && extOf(r.facilNo).safetyGrade) return false;
                if (f.q) {
                    const hay = (r.facilNm + ' ' + r.facilNo + ' ' + addrOf(r)).toLowerCase();
                    if (hay.indexOf(f.q.toLowerCase()) < 0) return false;
                }
                return true;
            });
        },
        rec: recOf, ext: extOf, age: ageOf, addr: addrOf, risk: riskOf, counts,
        saveExt, sendFms, suggestNext, cycleNote, overdueMonths, diffAgainst, applyIncoming, imps: impsOf, RISK_VARS,
        /* 시설물 한 건의 표시 라벨 — 다른 도메인이 시설물번호만 갖고 이름을 얻을 때 */
        label: (no) => { const r = recOf(no); return r ? r.facilNm : ''; },
        /* 인라인 선택기 — 필드 래퍼 id 와 선택 시 부를 전역 함수 경로를 받는다.
           onpick(시설물번호, 시설물명) 로 되돌려 준다. */
        toggle: (fieldId, onpick) => {
            const field = document.getElementById(fieldId); if (!field) return;
            const cur = field.querySelector(':scope > .org-inline');
            if (cur) { cur.remove(); return; }
            const panel = document.createElement('div');
            panel.className = 'org-inline';
            panel.style.marginTop = '8px';
            panel.setAttribute('data-onpick', onpick || '');
            panel.innerHTML =
                '<div class="org-inline-search"><input type="text" placeholder="시설명·시설물번호·소재지 검색" oninput="DYFACIL._filter(this)"></div>' +
                '<div class="org-inline-body">' + facilTree('') + '</div>';
            field.appendChild(panel);
            panel.scrollIntoView({ block: 'nearest' });
        },
        syncLog: () => DB.syncLog, settings: () => DB.settings,
        saveSettings: (patch) => { Object.assign(DB.settings, patch); save(); },
        seedRecs: () => (window.DY_FACIL_SEED || { recs: [] }).recs,
        reset: () => { DB = seed(); save(); },
    };
    window.DYFACIL = DYFACIL;

    /* =====================================================================
     * 화면 렌더 — 각 페이지의 마운트 컨테이너가 있을 때만 실행
     * ===================================================================== */
    const gradeChip = g => g ? '<span class="chip-status ' + ({ A: 'success', B: 'success', C: 'info', D: 'warning', E: 'danger' }[g] || 'neutral') + '">' + g + '등급</span>' : '<span class="chip-mini wt-attach">미평가</span>';
    const jurChip = j => '<span class="chip-mini ' + ({ '담양': 'st-done', '국가': 'wt-elec', '민간': 'wt-program', '미상': 'wt-attach' }[j] || 'wt') + '">' + esc(j) + '</span>';
    const riskChip = rk => '<span class="chip-status ' + ({ high: 'danger', mid: 'warning', low: 'success', na: 'neutral' }[rk.level]) + '">' + rk.label + (rk.score != null ? ' ' + rk.score : '') + '</span>';

    /* ─────────── FAC01-V 시설물 대장 목록 ─────────── */
    function mountList(app) {
        const UI = { gbn: '', cls: '', jur: '', aged: '', graded: '', q: '' };

        function kpi() {
            const c = counts();
            const card = (t, v, f) => '<div class="kpi-card"><div class="kpi-card-label"><span class="kpi-card-title">' + t + '</span></div><div class="kpi-card-value"><span style="font-size:24px;">' + v + '</span></div><div class="kpi-card-foot">' + f + '</div></div>';
            return '<div class="board-grid cols-4" style="margin-bottom:16px;">' +
                card('총 시설물', c.total + '건', 'FMS 시설물관리대장 수신') +
                card('종별', c.cls2 + '·' + c.cls3, '2종 ' + c.cls2 + ' · 3종 ' + c.cls3 + ' (1종 0)') +
                card('30년 초과 노후', c.aged + '건', '경과연수 30년+') +
                card('안전등급 확보', c.graded + '/' + c.total, '나머지 ' + (c.total - c.graded) + '건 보완입력 필요') +
                '</div>';
        }
        function toolbar() {
            const opt = (v, cur, lbl) => '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + lbl + '</option>';
            return '<div class="v2-toolbar">' +
                '<input class="select" id="fac-q" placeholder="시설명·번호·주소 검색" value="' + esc(UI.q) + '" style="min-width:200px;">' +
                '<select class="select" id="fac-gbn">' + opt('', UI.gbn, '구분 전체') + [['BR', '교량'], ['AR', '건축물'], ['RI', '하천'], ['WS', '상하수도'], ['ET', '기타']].map(x => opt(x[0], UI.gbn, x[1])).join('') + '</select>' +
                '<select class="select" id="fac-cls">' + opt('', UI.cls, '종별 전체') + opt('2', UI.cls, '2종') + opt('3', UI.cls, '3종') + '</select>' +
                '<select class="select" id="fac-jur">' + opt('', UI.jur, '소관 전체') + ['담양', '국가', '민간', '미상'].map(x => opt(x, UI.jur, x)).join('') + '</select>' +
                '<select class="select" id="fac-graded">' + opt('', UI.graded, '평가 전체') + opt('y', UI.graded, '등급 있음') + opt('n', UI.graded, '등급 없음') + '</select>' +
                '<label style="display:flex; align-items:center; gap:5px; font-size:13px; color:var(--text-gray);"><input type="checkbox" id="fac-aged"' + (UI.aged ? ' checked' : '') + '> 노후만</label>' +
                '<span class="spacer"></span>' +
                '<button class="btn btn-outline btn-sm" onclick="DYFACIL._go(\'fac-risk.html\')">위험도 보기</button>' +
                '<button class="btn btn-primary btn-sm" onclick="DYFACIL._go(\'fac-sync.html\')">FMS 연계</button>' +
                '</div>';
        }
        function rows() {
            const list = DYFACIL.list(UI);
            if (!list.length) return '<tr><td colspan="8"><div class="v2-empty">조건에 맞는 시설물이 없습니다.<br><span style="font-size:12px;">필터를 바꾸거나 [FMS 연계]에서 대장을 수신하세요.</span></div></td></tr>';
            return list.map(r => {
                const e = extOf(r.facilNo), age = ageOf(r), rk = riskOf(r.facilNo);
                const flags = [];
                if (age != null && age >= 30) flags.push('<span class="chip-mini wt-attach">노후 ' + age + '년</span>');
                if (r.jur === '미상') flags.push('<span class="chip-mini wt-attach">소관확인</span>');
                /* '좌표없음'은 담당자가 안 채운 것으로 읽혔다. 실제로는 80건 전건 결측이고
                   수기 입력이 아니라 주소 지오코딩 일괄 확보 대상이라(PRD §9-3) 문구를 고쳤다. */
                if (!e.lat) flags.push('<span class="chip-mini wt-attach">좌표 미확보</span>');
                /* 이 시설물로 지정된 개선조치가 있으면 대장에서 바로 보인다 — 조치 실적이
                   시설물에 쌓이는 것이 FMS 연계의 값이므로 상세를 열지 않아도 드러낸다. */
                const im = impsOf(r.facilNo);
                if (im && im.length) {
                    const nd = im.filter(m => m.status === 'DONE').length;
                    flags.push('<span class="chip-mini st-done">개선조치 ' + im.length + '건' + (nd ? ' · 완료 ' + nd : '') + '</span>');
                }
                return '<tr onclick="DYFACIL._detail(\'' + r.facilNo + '\')" style="cursor:pointer;">' +
                    '<td><b>' + esc(r.facilNm) + '</b><div style="font-size:var(--fs-12); color:var(--text-gray);">' + esc(r.facilNo) + '</div>' +
                        (flags.length ? '<div style="margin-top:4px; display:flex; flex-wrap:wrap; gap:4px;">' + flags.join('') + '</div>' : '') + '</td>' +
                    '<td>' + esc(r.gbnNm) + '<div style="font-size:var(--fs-12); color:var(--text-gray);">' + esc(r.kindNm) + '</div></td>' +
                    '<td>' + (CLASS_NM[r.facilClass] || '-') + '</td>' +
                    '<td style="font-size:12px;">' + esc(r.addrDong || '') + '</td>' +
                    '<td>' + (age != null ? age + '년' : '-') + '</td>' +
                    '<td>' + jurChip(r.jur) + '</td>' +
                    '<td>' + gradeChip(e.safetyGrade) + ' ' + riskChip(rk) + '</td>' +
                    '<td class="col-action"><button type="button" class="btn btn-sm btn-outline" onclick="event.stopPropagation(); DYFACIL._detail(\'' + r.facilNo + '\')">상세</button></td>' +
                    '</tr>';
            }).join('');
        }
        function render() {
            const list = DYFACIL.list(UI);
            app.innerHTML = kpi() + toolbar() +
                '<div class="card"><div class="card-body" style="overflow-x:auto; padding:0;">' +
                '<table class="table-figma"><thead><tr><th>시설명 / 번호</th><th>구분 / 종류</th><th>종별</th><th>소재</th><th>경과</th><th>소관</th><th>안전등급 / 위험도</th><th>관리</th></tr></thead>' +
                '<tbody>' + rows() + '</tbody></table>' +
                '</div><div class="card-body" style="border-top:1px solid var(--border); font-size:12px; color:var(--text-gray);">표시 ' + list.length + ' / 전체 ' + DB.recs.length + '건</div></div>';
            wire();
        }
        function wire() {
            const bind = (id, key, ev) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, () => { UI[key] = ev === 'input' ? el.value : (el.type === 'checkbox' ? (el.checked ? '1' : '') : el.value); render(); }); };
            bind('fac-q', 'q', 'input'); bind('fac-gbn', 'gbn', 'change'); bind('fac-cls', 'cls', 'change');
            bind('fac-jur', 'jur', 'change'); bind('fac-graded', 'graded', 'change'); bind('fac-aged', 'aged', 'change');
        }
        render();
    }

    /* ─────────── FAC02-D 시설물 상세 · 보완입력 (모달) ─────────── */
    function openDetail(no) {
        const r = recOf(no); if (!r) return;
        const e = extOf(no), age = ageOf(r), rk = riskOf(no);
        const ro = (lbl, val) => '<div class="fac-f"><span class="fac-f-l">' + lbl + '</span><span class="fac-f-v">' + (val && String(val).trim() ? esc(val) : '<em style="color:var(--text-gray);">— FMS 미제공</em>') + '</span></div>';

        /* 1) FMS 기본현황 (읽기전용) */
        const fmsBlock =
            '<div class="fac-sec-t">FMS 기본현황 <span class="chip-mini wt-elec">읽기전용</span></div>' +
            '<div class="fac-grid">' +
            ro('시설물번호', r.facilNo) + ro('시설물명', r.facilNm) +
            ro('구분 / 종류', r.gbnNm + ' / ' + r.kindNm) + ro('시설물종별', CLASS_NM[r.facilClass]) +
            ro('관리주체코드', r.mngMainCd) + ro('소유자', r.facilOwner) +
            ro('소재지', addrOf(r)) + ro('준공일자', r.cplYmd + (age != null ? ' (경과 ' + age + '년)' : '')) +
            ro('설계자', r.designerNm) + ro('시공자', r.constractorNm) +
            ro('공사명', r.constNm) + ro('내진설계', r.eqDsnAppYn === 'Y' ? '적용' : r.eqDsnAppYn === 'N' ? '미적용' : '') +
            '</div>';

        /* 2) 보완입력 — **6항목**. 2026-08-13 축소(종전 13항목).
           뺀 7개(차기 점검예정일·중대결함 유형·보수보강 진행·위험물 취급·인접 위험요소·
           좌표 위/경도)는 어느 화면도 읽지 않는 입력란이었다. 채워도 아무 일이 안 일어나는
           칸을 담당자에게 요구하면 곧 아무도 안 채우고, 그때부터 화면 전체가 신뢰를 잃는다.
           남긴 6개는 각각 소비처가 있다 —
             안전등급·최근 점검일·중대결함 유무·이용인원 = 위험도 산정 변수(riskOf)
             규모(값·단위) = 중대재해법 별표3 공중이용시설 판정의 유일한 근거
             소관부서       = 점검 주체. 없으면 누가 점검하는지가 정해지지 않는다
           **차기 점검예정일은 입력이 아니라 파생이다** — 최근 점검일 + 등급별 법정주기
           (시행령 별표3)로 나온다. 사람이 손으로 넣을 값이 아니라 읽기 전용으로 낸다.
           **좌표는 입력란을 두지 않는다** — 80건 전건 결측이라 수기 입력이 아니라
           주소 지오코딩 일괄 확보 대상이다(PRD §9-3). 결측 사실은 목록 태그로 남긴다.
           뺀 항목의 기존 저장값은 지우지 않는다 — collectExt 가 6키만 돌려주고
           saveExt 가 병합이라 이전 값은 ext 에 그대로 남는다. */
        const sel = (id, cur, opts, ph) => '<select class="select" id="' + id + '" style="width:100%;"><option value="">' + ph + '</option>' + opts.map(o => { const v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>';
        const inp = (id, cur, ph, type) => '<input class="select" id="' + id + '" style="width:100%;" type="' + (type || 'text') + '" value="' + esc(cur || '') + '" placeholder="' + esc(ph || '') + '">';
        const nextSuggest = e.lastInspectYmd ? DYFACIL.suggestNext(e.lastInspectYmd, e.safetyGrade || 'C') : '';
        const extBlock =
            '<div class="fac-sec-t" style="margin-top:18px;">보완입력 ' +
                '<span class="chip-mini wt-program">FMS 수신이 덮어쓰지 않음</span></div>' +
            /* 개발자·발주처가 이 구획을 "담양군 자체 데이터"로 읽은 사례가 있어(2026-08-13
               FMS 추가 요청 질의) 두 부류를 화면에서 갈라 밝힌다. 라벨만으로는 구분되지 않고,
               구분이 틀리면 추가 연계 요청 목록에서 FMS 소관 항목이 통째로 빠진다. */
            '<p class="fac-note">이 중 <b>안전등급 · 최근 점검일 · 중대결함 · 규모</b>는 원래 FMS 소관' +
                '(점검진단실적 · 중대결함사후관리 · 상세제원)인데 이번 수신분<b>(시설물관리대장 기본현황)</b>에 ' +
                '들어 있지 않아 <b>추가 연계가 붙을 때까지만</b> 직접 받는 값입니다. 연계되면 입력란은 닫히고 ' +
                '소유권이 FMS 로 넘어가며, 그때까지 채운 값은 지우지 않고 "직접 입력값"으로 남겨 수신값과 대조합니다. ' +
                '<b>소관부서 · 이용인원</b>은 FMS 표준연계 규격에 없어 담양군이 계속 관리합니다.</p>' +
            '<div class="fac-grid">' +
            '<div class="fac-f2"><span class="fac-f-l">안전등급 (A~E)</span>' + sel('ex-grade', e.safetyGrade, ['A', 'B', 'C', 'D', 'E'].map(g => [g, g + ' — ' + GRADE_DESC[g].split(' — ')[1]]), '미평가') +
                '<span class="fac-hint">연계 전 임시 입력 · 점검·진단 실시결과로 지정하는 값</span></div>' +
            '<div class="fac-f2"><span class="fac-f-l">최근 점검일</span>' + inp('ex-last', e.lastInspectYmd, 'YYYY-MM-DD', 'date') +
                '<span class="fac-hint">연계 전 임시 입력</span></div>' +
            '<div class="fac-f2"><span class="fac-f-l">차기 정기안전점검 예정일 <span class="chip-mini wt-elec">자동 산출</span></span>' +
                '<div class="fac-f-v">' + (nextSuggest ? esc(nextSuggest) : '<em style="color:var(--text-gray);">최근 점검일 입력 후 산출</em>') + '</div>' +
                '<span class="fac-hint">' + esc(cycleNote(e.safetyGrade)) + ' — 시행령 별표3</span></div>' +
            '<div class="fac-f2"><span class="fac-f-l">중대결함 유무</span>' + sel('ex-defyn', e.defectYn, [['N', '없음'], ['Y', '있음']], '미확인') +
                '<span class="fac-hint">연계 전 임시 입력 · 유형·통보일은 FMS 가 원천이라 받지 않음</span></div>' +
            '<div class="fac-f2"><span class="fac-f-l">규모 (값 / 단위)</span><div style="display:flex; gap:6px;">' + inp('ex-size', e.sizeValue, '값') + inp('ex-unit', e.sizeUnit, '㎡·m·톤/일') + '</div>' +
                '<span class="fac-hint">연계 전 임시 입력 · 공중이용시설 판정 근거</span></div>' +
            '<div class="fac-f2"><span class="fac-f-l">소관부서</span>' + inp('ex-dept', e.deptNm, '예: 건설과') +
                '<span class="fac-hint">담양군 관리 항목</span></div>' +
            '<div class="fac-f2"><span class="fac-f-l">이용인원 (일평균)</span>' + inp('ex-users', e.dailyUsers, '명', 'number') +
                '<span class="fac-hint">담양군 관리 항목</span></div>' +
            '</div>' +
            /* 시행령 §19 — 착수기한은 **통보일 +2년**, 완료기한은 **착수일 +3년**이다.
               종전에는 완료기한도 통보일 기준(+3년)으로 계산해 법정 기한보다 짧게 표시했다.
               착수일은 담당자만 아는 값이라 시스템이 단정하지 않고 기준만 밝힌다. */
            (e.defectYn === 'Y' && e.defectNotifyYmd
                ? '<p class="fac-note">중대결함 통보일 ' + esc(e.defectNotifyYmd) +
                  ' → 보수·보강 <b>착수기한 ' + plusYear(e.defectNotifyYmd, 2) + '</b>(통보일부터 2년 이내)' +
                  ' · <b>완료기한은 착수일부터 3년 이내</b>(특별한 사유가 없는 경우)' +
                  ' — 시설물안전법 제24조·시행령 제19조</p>'
                : '');

        /* 3) 위험도 요약 */
        const riskBlock =
            '<div class="fac-sec-t" style="margin-top:18px;">시설물 위험도 · 근로자 위험성평가 연계</div>' +
            '<div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">' +
            riskChip(rk) + '<span style="font-size:12px; color:var(--text-gray);">확보 변수: ' + (rk.have.length ? rk.have.join(', ') : '없음') + '</span>' +
            (rk.level === 'na' ? '<span class="chip-mini wt-attach">핵심변수(안전등급/점검일) 부족 — 보완입력 후 착수</span>' : '') +
            '</div>';

        /* 4) 이 시설물의 개선조치 내역 — 위험성평가 검수 행에 이 시설물을 지정하면 여기에 쌓인다.
              FMS 로 되돌려 보낼 보수·보강 실적의 근거가 되는 자리다(PRD §5-2 향후 인터페이스). */
        const imps = impsOf(no);
        let impBlock = '';
        if (imps === null) {
            impBlock = '<div class="fac-sec-t" style="margin-top:18px;">개선조치 내역</div>' +
                '<p class="fac-note">위험성평가 자료를 불러오지 못했습니다.</p>';
        } else if (!imps.length) {
            impBlock = '<div class="fac-sec-t" style="margin-top:18px;">개선조치 내역 <span class="chip-mini wt-attach">0건</span></div>' +
                '<p class="fac-note">근로자 위험성평가에서 이 시설물로 연결된 개선조치가 아직 없습니다. ' +
                '청소·정비 등 종사자 작업의 유해위험요인 행에 이 시설물을 지정한 경우에만 여기에 쌓입니다.</p>';
        } else {
            const R = window.DYRSK;
            const done = imps.filter(m => m.status === 'DONE').length;
            const rows = imps.map(m => {
                const over = m.status !== 'DONE' && R.isOverdue && R.isOverdue(m);
                const st = m.status === 'DONE' ? ['success', '완료'] : over ? ['danger', '기한 초과'] : ['warning', '진행'];
                const cf = m.confirm && m.confirm.state;
                const cfChip = m.status === 'DONE'
                    ? (cf === 'OK' ? '<span class="chip-mini st-done">확인 완료</span>'
                        : cf === 'RETURNED' ? '<span class="chip-mini wt-attach">반려</span>'
                        : '<span class="chip-mini wt">확인 대기</span>')
                    : '';
                const ph = (m.after_photos || []).length;
                return '<tr>' +
                    '<td><b>' + esc((m.hazard && m.hazard.name) || '-') + '</b>' +
                        '<div style="font-size:var(--fs-12);color:var(--text-gray);">' + esc(m.action || m.description || '') + '</div></td>' +
                    '<td style="font-size:var(--fs-12);">' + esc(R.deptName ? R.deptName(m.dept_id) : m.dept_id) + '</td>' +
                    '<td style="font-size:var(--fs-12);">' + esc(m.due_date || m.due || '-') + '</td>' +
                    '<td><span class="chip-status ' + st[0] + '">' + st[1] + '</span> ' + cfChip + '</td>' +
                    '<td style="font-size:var(--fs-12);">' + (ph ? '개선 후 ' + ph + '장' : '—') + '</td>' +
                    '<td class="col-action"><button type="button" class="btn btn-sm btn-outline" onclick="DYFACIL._toImp(\'' + esc(m.id) + '\')">보기</button></td>' +
                '</tr>';
            }).join('');
            impBlock = '<div class="fac-sec-t" style="margin-top:18px;">개선조치 내역 ' +
                    '<span class="chip-mini st-done">' + imps.length + '건 · 완료 ' + done + '</span></div>' +
                '<div style="overflow-x:auto;"><table class="table-figma">' +
                '<thead><tr><th>유해위험요인 / 조치</th><th style="white-space:nowrap;">부서</th>' +
                '<th style="white-space:nowrap;">기한</th><th style="white-space:nowrap;">상태</th>' +
                '<th style="white-space:nowrap;">증빙</th><th></th></tr></thead>' +
                '<tbody>' + rows + '</tbody></table></div>';
        }

        const foot =
            '<button class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
            '<button class="btn btn-outline" onclick="DYFACIL._send(\'' + no + '\', \'update\')">FMS 전송(수정)</button>' +
            (rk.level !== 'na'
                ? '<button class="btn btn-primary" onclick="DYFACIL._toRisk(\'' + no + '\')">근로자 위험성평가 연계</button>'
                : '<button class="btn btn-primary" onclick="DYFACIL._saveExt(\'' + no + '\')">보완입력 저장</button>') +
            '<button class="btn btn-primary" onclick="DYFACIL._saveExt(\'' + no + '\')" style="' + (rk.level !== 'na' ? '' : 'display:none;') + '">보완입력 저장</button>';

        V().openModal('시설물 상세 — ' + esc(r.facilNm), fmsBlock + extBlock + riskBlock + impBlock, foot);
        /* 등급/최근점검 바뀌면 차기 제안 갱신은 저장 시 반영(단순화) */
    }
    /* 중대결함 유형 select(defectSel)는 보완입력 축소로 제거했다(2026-08-13).
       유형은 손으로 고를 값이 아니라 중대결함사후관리 연계로 받을 값이다 —
       기준표 DEFECT_GROUPS 는 수신값을 읽기 위해 남겨 두었다(상단 주석). */
    function plusYear(ymd, n) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd); return m ? (+m[1] + n) + '-' + m[2] + '-' + m[3] : '-'; }

    /* 입력받는 6키만 돌려준다 — 축소로 사라진 입력란(ex-next·ex-deftype·ex-repair·
       ex-hazmat·ex-lat·ex-lng·ex-adj)을 계속 읽으면 getElementById 가 null 이라
       빈 문자열이 되고, saveExt 병합이 시드에 있던 값을 **조용히 지운다**. */
    function collectExt() {
        const g = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
        return {
            safetyGrade: g('ex-grade'), lastInspectYmd: g('ex-last'), defectYn: g('ex-defyn'),
            sizeValue: g('ex-size'), sizeUnit: g('ex-unit'), dailyUsers: g('ex-users'),
            deptNm: g('ex-dept'),
        };
    }

    /* ─────────── FAC03-V 위험도 ─────────── */
    function mountRisk(app) {
        /* 조회 조건은 대장(fac-list)과 같은 축을 쓴다 — 두 화면이 다른 축으로 걸리면
           "대장에서 본 그 시설물"을 위험도에서 못 찾는다. */
        const RF = { gbn: '', cls: '', jur: '' };
        function render() {
            let recs = DB.recs.filter(r =>
                (!RF.gbn || r.facilGbn === RF.gbn) &&
                (!RF.cls || r.facilClass === RF.cls) &&
                (!RF.jur || r.jur === RF.jur));
            const scored = recs.map(r => ({ r, rk: riskOf(r.facilNo), e: extOf(r.facilNo) }));
            const rank = { high: 0, mid: 1, low: 2, na: 3 };
            /* 동점이면 준공이 오래된 순 — 같은 점수라면 오래된 시설을 먼저 본다.
               정렬 기준을 사용자가 바꾸게 하지 않는다. 이 화면의 목적이 '어디부터
               볼지' 하나여서, 정렬을 바꾸는 순간 그 목적이 흐려진다(대장에서는 가능). */
            scored.sort((a, b) => (rank[a.rk.level] - rank[b.rk.level]) ||
                ((b.rk.score || 0) - (a.rk.score || 0)) ||
                ((ageOf(b.r) || 0) - (ageOf(a.r) || 0)));
            const nHigh = scored.filter(s => s.rk.level === 'high').length;
            const nNa = scored.filter(s => s.rk.level === 'na').length;
            const card = (t, v, f) => '<div class="kpi-card"><div class="kpi-card-label"><span class="kpi-card-title">' + t + '</span></div><div class="kpi-card-value"><span style="font-size:24px;">' + v + '</span></div><div class="kpi-card-foot">' + f + '</div></div>';
            const rowsH = scored.map(s => {
                /* 이미 평가에서 다뤄진 시설물도 랭킹에서 빼지 않는다 — 빼면 "왜 사라졌지"가
                   되고, 한 번 다뤘다고 위험이 없어지는 것도 아니다. 대신 표시로 구분한다. */
                const nImp = (impsOf(s.r.facilNo) || []).length;
                const btn = s.rk.level === 'na'
                    ? '<button class="btn btn-sm btn-outline" onclick="DYFACIL._detail(\'' + s.r.facilNo + '\')">보완입력</button>'
                    : '<button class="btn btn-sm ' + (nImp ? 'btn-outline' : 'btn-primary') + '" onclick="DYFACIL._toRisk(\'' + s.r.facilNo + '\')">' +
                      (nImp ? '연계 보기' : '근로자 위험성평가 연계') + '</button>';
                /* 점검 — 법정 주기 초과 여부. 위험도 점수에 이미 반영돼 있으므로
                   여기서는 왜 점수가 그런지 설명하는 자리다(별표3). */
                const od = overdueMonths(s.e.lastInspectYmd, s.e.safetyGrade);
                const insp = !s.e.lastInspectYmd
                    ? '<span style="color:var(--text-gray);">미확보</span>'
                    : esc(s.e.lastInspectYmd) +
                      (od != null && od > 0
                        ? '<div><span class="chip-status chip-sm danger">주기 ' + od + '개월 초과</span></div>'
                        : '<div style="font-size:var(--fs-12);color:var(--text-gray);">' + esc(cycleNote(s.e.safetyGrade)) + '</div>');
                return '<tr><td><b>' + esc(s.r.facilNm) + '</b><div style="font-size:var(--fs-12);color:var(--text-gray);">' + esc(s.r.gbnNm) + ' · ' + (CLASS_NM[s.r.facilClass] || '') + '</div></td>' +
                    '<td>' + gradeChip(s.e.safetyGrade) + '</td>' +
                    '<td>' + insp + '</td>' +
                    '<td>' + (ageOf(s.r) != null ? ageOf(s.r) + '년' : '-') + '</td>' +
                    '<td>' + (s.e.dailyUsers ? Number(s.e.dailyUsers).toLocaleString() + '명' : '-') + '</td>' +
                    '<td>' + riskChip(s.rk) +
                        (nImp ? '<div><span class="chip-status chip-sm info">개선조치 ' + nImp + '건</span></div>' : '') + '</td>' +
                    '<td style="font-size:var(--fs-12);color:var(--text-gray);">' + s.rk.have.length + '/' + DYFACIL.RISK_VARS + '</td>' +
                    '<td class="col-action">' + btn + '</td></tr>';
            }).join('');
            const sel = (id, val, opts) => '<select class="form-select" onchange="DYFACIL._rf(\'' + id + '\',this.value)">' +
                opts.map(o => '<option value="' + o[0] + '"' + (val === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';
            const filterBar =
                '<div class="ri-toolbar"><div class="ri-filters">' +
                    sel('gbn', RF.gbn, [['', '구분 전체']].concat(GBN_GROUPS.map(g => [g[0], g[1]]))) +
                    sel('cls', RF.cls, [['', '종별 전체'], ['1', '1종'], ['2', '2종'], ['3', '3종']]) +
                    sel('jur', RF.jur, [['', '소관 전체']].concat(
                        Array.from(new Set(DB.recs.map(r => r.jur).filter(Boolean))).sort().map(j => [j, j]))) +
                '</div><span style="color:var(--text-gray);font-size:var(--fs-12);">' + scored.length + ' / ' + DB.recs.length + '건</span></div>';
            app.innerHTML =
                '<div class="board-grid cols-3" style="margin-bottom:16px;">' +
                card('위험도 높음', nHigh + '건', '우선 평가 대상') +
                card('산정 불가', nNa + '건', '핵심변수 미확보 — 보완입력 필요') +
                card('평가 가능', (DB.recs.length - nNa) + '건', '안전등급·점검일 확보분') +
                '</div>' +
                '<div class="card"><div class="card-body" style="font-size:12px; color:var(--text-gray);">위험도는 확보된 변수만으로 산정합니다. 없는 값은 0으로 처리하지 않고 <b>산정불가</b>로 분류해 과소평가를 방지합니다. 점검 주기 초과는 안전등급별 법정 주기(반기 1회 · D·E는 연 3회)를 기준으로 판정합니다.</div></div>' +
                '<div class="card" style="margin-top:12px;"><div class="card-body" style="overflow-x:auto; padding:0;">' +
                filterBar +
                '<table class="table-figma"><thead><tr><th>시설물</th><th>안전등급</th><th>최근 점검</th><th>경과</th><th>이용인원</th><th>위험도</th><th>변수</th><th>관리</th></tr></thead><tbody>' +
                (rowsH || '<tr><td colspan="8" style="text-align:center;color:var(--text-gray);padding:24px;">조건에 맞는 시설물이 없습니다.</td></tr>') +
                '</tbody></table>' +
                '</div></div>';
        }
        render();
        DYFACIL._reRisk = render;
        DYFACIL._rf = (k, v) => { RF[k] = v; render(); };
    }

    /* ─────────── FAC04-S FMS 연계 ─────────── */
    function mountSync(app) {
        const ST = { staged: null };  /* 업로드 파싱 결과 스테이징 */

        function render() {
            const s = DB.settings, log = DB.syncLog;
            app.innerHTML =
                '<div class="board-grid cols-2" style="margin-bottom:16px;">' +
                /* 수신 IN */
                '<div class="card"><div class="card-header"><span class="card-title">수신 (IN) — FMS → 시스템</span></div><div class="card-body">' +
                '<p style="font-size:13px; color:var(--text-gray); margin-bottom:12px;">FMS 시설물관리대장(BASTB_MASTER, Ð 43토큰)을 불러와 <b>차이 미리보기</b> 후 선택 반영합니다. 자체 소유(보완입력) 필드는 덮어쓰지 않습니다.</p>' +
                '<div class="upload-drop" id="fac-drop" role="button" tabindex="0" style="cursor:pointer;" onkeydown="DYV2.dropKey(event)">엑셀(.xls)을 끌어다 놓거나 클릭하여 업로드<br><span style="font-size:12px;">원천: 88384_2.xls (FMS 수신 포맷)</span></div>' +
                '<input type="file" id="fac-file" accept=".xls,.xlsx" style="display:none;">' +
                (V().fileHint ? V().fileHint() : '') +
                '<div style="display:flex; gap:8px; margin-top:10px;">' +
                '<button class="btn btn-outline btn-sm" onclick="DYFACIL._sim()">시드 80건으로 재적재 (시뮬레이션)</button>' +
                '</div>' +
                '<div id="fac-stage"></div>' +
                '</div></div>' +
                /* 전송 OUT */
                '<div class="card"><div class="card-header"><span class="card-title">전송 (OUT) — 시스템 → FMS</span></div><div class="card-body">' +
                '<p style="font-size:13px; color:var(--text-gray); margin-bottom:12px;">인터페이스: <code>insertBastbMaster</code> · <code>updateBastbMaster</code> · <code>deleteBastbMaster</code>. 신규 등록은 상세제원(BASTB_DTL_*) 최소 1건이 필요합니다.</p>' +
                '<table class="table-figma"><thead><tr><th>인터페이스</th><th>upsert 키</th><th>상태</th></tr></thead><tbody>' +
                '<tr><td>insertBastbMaster</td><td>FACIL_NO</td><td><span class="chip-mini wt-attach">상세제원 필요</span></td></tr>' +
                '<tr><td>updateBastbMaster</td><td>FACIL_NO</td><td><span class="chip-mini st-done">가능</span></td></tr>' +
                '<tr><td>deleteBastbMaster</td><td>FACIL_NO</td><td><span class="chip-mini st-done">가능</span></td></tr>' +
                '</tbody></table>' +
                '<p style="font-size:12px; color:var(--text-gray); margin-top:10px;">개별 전송은 [시설물 상세]에서 실행합니다. 인증: 기관 ' + esc(s.orgCode) + ' · 사용자 ' + esc(s.userId) + ' (설정에서 변경)</p>' +
                '</div></div>' +
                '</div>' +
                /* 이력 */
                '<div class="card"><div class="card-header"><span class="card-title">연계 · 변경 이력 (감사추적)</span><button class="btn btn-sm btn-outline" onclick="DYFACIL._go(\'fac-settings.html\')">연계 설정</button></div>' +
                '<div class="card-body" style="overflow-x:auto; padding:0;">' +
                '<table class="table-figma"><thead><tr><th>일시</th><th>방향</th><th>인터페이스</th><th>시설물</th><th>반영키</th><th>결과</th><th>내용</th></tr></thead><tbody>' +
                (log.length ? log.map(l => '<tr><td style="font-size:12px;">' + esc(l.at) + '</td><td>' + dirChip(l.dir) + '</td><td style="font-size:12px;">' + esc(l.iface) + '</td><td style="font-size:12px;">' + esc(l.facilNo) + '</td><td style="font-size:12px;">' + esc(l.key) + '</td><td>' + esc(l.result) + '</td><td style="font-size:12px; color:var(--text-gray);">' + esc(l.detail) + '</td></tr>').join('') : '<tr><td colspan="7"><div class="v2-empty">연계 이력이 없습니다.</div></td></tr>') +
                '</tbody></table></div></div>';
            wire();
        }
        function wire() {
            const drop = document.getElementById('fac-drop'), file = document.getElementById('fac-file');
            if (drop && file) {
                drop.addEventListener('click', () => file.click());
                file.addEventListener('change', () => { if (file.files && file.files[0]) stageSim(file.files[0].name); });
            }
        }
        /* 파일 파싱은 프로토타입 범위 밖 — 시드 레코드를 '수신분'으로 스테이징 */
        function stageSim(fname) {
            const incoming = DYFACIL.seedRecs();
            ST.staged = { fname: fname || '88384_2.xls', diff: DYFACIL.diffAgainst(incoming), incoming };
            renderStage();
        }
        function renderStage() {
            const box = document.getElementById('fac-stage'); if (!box) return;
            if (!ST.staged) { box.innerHTML = ''; return; }
            const d = ST.staged.diff;
            box.innerHTML = '<div class="stack-inline" style="margin-top:12px;">' +
                '<div class="fac-sec-t">차이 미리보기 — ' + esc(ST.staged.fname) + '</div>' +
                '<p style="font-size:13px;">신규 <b>' + d.add.length + '</b>건 · 변경 <b>' + d.upd.length + '</b>건 · 동일 <b>' + d.same.length + '</b>건</p>' +
                (d.upd.length ? '<div style="font-size:12px; color:var(--text-gray); max-height:120px; overflow:auto;">' + d.upd.slice(0, 20).map(u => '· ' + esc(u.row.facilNm) + ' (' + u.fields.length + '개 필드 변경)').join('<br>') + '</div>' : '') +
                '<div style="display:flex; gap:8px; margin-top:12px;">' +
                '<button class="btn btn-secondary btn-sm" onclick="DYFACIL._stageCancel()">취소</button>' +
                '<button class="btn btn-primary btn-sm" onclick="DYFACIL._stageApply()">선택 반영</button>' +
                '</div></div>';
        }
        DYFACIL._sim = () => stageSim('88384_2.xls');
        DYFACIL._stageCancel = () => { ST.staged = null; renderStage(); };
        DYFACIL._stageApply = () => {
            if (!ST.staged) return;
            const res = DYFACIL.applyIncoming(ST.staged.incoming);
            ST.staged = null;
            V().toast('반영 완료 — 신규 ' + res.added + '건 · 변경 ' + res.updated + '건');
            render();
        };
        render();
    }
    const dirChip = d => '<span class="chip-mini ' + ({ IN: 'wt-elec', OUT: 'wt-program', SELF: 'pdca' }[d] || 'wt') + '">' + esc(d) + '</span>';

    /* ─────────── FAC05-S 연계 설정 ─────────── */
    function mountSettings(app) {
        function render() {
            const s = DB.settings;
            app.innerHTML =
                '<div class="card"><div class="card-header"><span class="card-title">FMS 인증 · 수신</span></div><div class="card-body">' +
                '<div class="fac-grid">' +
                fld('기관코드', 'set-org', s.orgCode) +
                fld('사용자 ID', 'set-uid', s.userId) +
                '<div class="fac-f2"><span class="fac-f-l">일 배치 수신</span><select class="select" id="set-batch" style="width:100%;"><option value="1"' + (s.batchDaily ? ' selected' : '') + '>사용 (06:00)</option><option value="0"' + (!s.batchDaily ? ' selected' : '') + '>미사용</option></select></div>' +
                '<div class="fac-f2"><span class="fac-f-l">1일 실행 상한</span><input class="select" id="set-limit" style="width:100%;" type="number" value="' + esc(s.batchLimit) + '"> <span style="font-size:var(--fs-12); color:var(--text-gray);">가이드 최대 10회</span></div>' +
                '<div class="fac-f2"><span class="fac-f-l">자동 승인요청</span><select class="select" id="set-appr" style="width:100%;"><option value="0"' + (!s.autoApprove ? ' selected' : '') + '>미사용</option><option value="1"' + (s.autoApprove ? ' selected' : '') + '>사용 (approveReqYn=Y)</option></select></div>' +
                '</div>' +
                '<p style="font-size:12px; color:var(--text-gray); margin-top:10px;">인증키·비밀번호 등 자격증명은 보안 절차상 이 화면에서 입력·저장하지 않습니다. (별도 보안 위임)</p>' +
                '<div style="margin-top:12px;"><button class="btn btn-primary btn-sm" onclick="DYFACIL._saveSet()">설정 저장</button></div>' +
                '</div></div>' +
                /* 필드 소유권 */
                '<div class="card" style="margin-top:12px;"><div class="card-header"><span class="card-title">필드 소유권 규칙</span></div><div class="card-body">' +
                '<div class="board-grid cols-2">' +
                '<div><div class="fac-sec-t">FMS 소유 (읽기전용)</div><p style="font-size:13px; color:var(--text-gray);">BASTB_MASTER 42컬럼 + FMS반영키. 수신 시 갱신, 정정은 updateBastbMaster 전송으로만.</p></div>' +
                /* 종전에는 보완입력 전 항목을 '자체 소유' 한 덩어리로 적어, 원래 FMS 소관인
                   항목까지 담양군 데이터로 읽혔다(2026-08-13 FMS 추가 요청 질의에서 드러남).
                   추가 연계 요청 목록이 이 표에서 나오므로 두 부류를 갈라 적는다. */
                '<div><div class="fac-sec-t">연계 전 임시 입력 <span class="chip-mini wt-attach">추가 연계 시 FMS 소유로 이관</span></div>' +
                '<p style="font-size:13px; color:var(--text-gray);">안전등급(점검진단실적) · 점검일(점검진단계획·실적) · 중대결함(중대결함사후관리) · 규모(상세제원). ' +
                'FMS 규격에는 있으나 이번 수신분(시설물관리대장 기본현황)에 0건이라 직접 받는다. 수신이 붙으면 입력란을 닫고 직접 입력값은 대조용으로 보관.</p>' +
                '<div class="fac-sec-t" style="margin-top:12px;">담양군 관리 (FMS 규격 밖)</div>' +
                '<p style="font-size:13px; color:var(--text-gray);">소관부서 · 관리담당자 · 이용인원 · 좌표 · 중대재해대상 구분. 추가 연계 요청 대상이 아니다.</p></div>' +
                '</div></div></div>' +
                /* 공통코드 */
                '<div class="card" style="margin-top:12px;"><div class="card-header"><span class="card-title">공통코드 매핑 <span class="chip-mini wt-attach">FMS 최신 공통코드 규격 미수신</span></span></div>' +
                '<div class="card-body" style="overflow-x:auto; padding:0;">' +
                '<table class="table-figma"><thead><tr><th>코드</th><th>가이드 v4.1</th><th>실데이터</th><th>판정</th></tr></thead><tbody>' +
                cmap('시설물구분/종류', 'GBN=RO·KIND=BR', 'GBN=BR·KIND=ROB', '코드체계 개편') +
                cmap('시설물종별(FACIL_CLASS)', '1,2,9', '2,3', '값 정의 재확인') +
                cmap('설계도서보존(DSN_KEEP_STATUS)', 'Y,N', '1/2/3/4', '값 정의 재확인') +
                '</tbody></table></div></div>' +
                /* 위험 초기화 */
                '<div class="card" style="margin-top:12px;"><div class="card-body" style="display:flex; justify-content:space-between; align-items:center;">' +
                '<span style="font-size:13px; color:var(--text-gray);">대장·보완입력·이력을 시드 상태로 되돌립니다.</span>' +
                '<button class="btn btn-outline btn-sm" onclick="DYFACIL._resetConfirm()">초기화</button></div></div>';
            wire();
        }
        function fld(l, id, v) { return '<div class="fac-f2"><span class="fac-f-l">' + l + '</span><input class="select" id="' + id + '" style="width:100%;" value="' + esc(v) + '"></div>'; }
        function cmap(a, b, c, d) { return '<tr><td>' + a + '</td><td style="font-size:12px;">' + b + '</td><td style="font-size:12px;"><b>' + c + '</b></td><td>' + d + '</td></tr>'; }
        function wire() {}
        DYFACIL._saveSet = () => {
            const g = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
            DYFACIL.saveSettings({ orgCode: g('set-org'), userId: g('set-uid'), batchDaily: g('set-batch') === '1', batchLimit: +g('set-limit') || 10, autoApprove: g('set-appr') === '1' });
            V().toast('연계 설정 저장됨');
        };
        DYFACIL._resetConfirm = () => {
            V().openModal('초기화 확인', '<p style="font-size:14px; line-height:1.6;">시설물 대장 80건, 보완입력, 연계 이력을 <b>시드 상태로 되돌립니다</b>. 저장한 보완입력이 사라집니다.</p>',
                '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button><button class="btn btn-primary" onclick="DYFACIL.reset(); DYV2.closeModal(); DYV2.toast(\'초기화되었습니다\'); location.reload();">초기화</button>');
        };
        render();
    }

    /* ── 인라인 선택기 내부 동작 ── */
    DYFACIL._toggle = btn => {
        const m = btn.nextElementSibling; if (!m) return;
        const open = m.style.display === 'block';
        m.style.display = open ? 'none' : 'block';
        const ar = btn.querySelector('.otr-arrow'); if (ar) ar.textContent = open ? '▸' : '▾';
    };
    DYFACIL._filter = inp => {
        const panel = inp.closest('.org-inline'); if (!panel) return;
        const b = panel.querySelector('.org-inline-body');
        if (b) b.innerHTML = facilTree(inp.value);
    };
    DYFACIL._pick = (btn, no) => {
        const panel = btn.closest('.org-inline'); if (!panel) return;
        const path = panel.getAttribute('data-onpick');
        panel.remove();
        const fn = String(path || '').split('.').reduce((o, k) => o && o[k], window);
        const r = recOf(no);
        if (typeof fn === 'function') fn(no, r ? r.facilNm : '');
    };

    /* ── 공통 액션 (전 화면 공유) ── */
    DYFACIL._go = href => { window.location.href = href; };
    DYFACIL._detail = no => openDetail(no);
    DYFACIL._saveExt = no => {
        saveExt(no, collectExt());
        DYV2.closeModal();
        V().toast('보완입력 저장됨');
        if (DYFACIL._reRisk) DYFACIL._reRisk();       /* 위험도 화면이면 재렌더 */
        if (window.__facRerender) window.__facRerender(); /* 목록 화면이면 재렌더 */
    };
    DYFACIL._send = (no, kind) => {
        const res = sendFms(no, kind);
        V().toast(res.msg);
    };
    DYFACIL._toImp = id => { window.location.href = 'rsk-imp-detail.html?id=' + encodeURIComponent(id); };
    DYFACIL._toRisk = no => {
        const r = recOf(no); if (!r) return;
        /* 위험성평가 대상으로 FACIL_NO 관통 (PRD §5-4) */
        window.location.href = 'rsk-list.html?target=' + encodeURIComponent(no) + '&name=' + encodeURIComponent(r.facilNm) + '&facilNo=' + encodeURIComponent(no);
    };

    /* ── 마운트 디스패치 ── */
    document.addEventListener('DOMContentLoaded', function () {
        const page = document.body.dataset.dyPage;
        const app = document.getElementById('fac-app');
        if (!app) return;
        if (page === 'fac-list') {
            window.__facRerender = () => mountList(app); mountList(app);
            /* 딥링크 ?no=시설물번호 — 이행 관리의 시설 상세가 «시설물 대장에서 열기»로
               넘길 때 쓴다. 없으면 그 버튼이 목록만 열고 끝나 막다른 길이 된다. */
            const no = new URLSearchParams(location.search).get('no');
            if (no && recOf(no)) openDetail(no);
        }
        else if (page === 'fac-risk') mountRisk(app);
        else if (page === 'fac-sync') mountSync(app);
        else if (page === 'fac-settings') mountSettings(app);
    });
})();
