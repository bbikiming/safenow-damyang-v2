/* =========================================================================
 * 담양군 중대재해예방 통합관리시스템 v2 — 시설물 안전관리 (FAC)
 *   데이터 레이어(window.DYFACIL) + 5개 화면 렌더
 *   화면: FAC01-V 대장목록 / FAC02-D 상세·보완입력 / FAC03-V 위험도 /
 *         FAC04-S FMS 연계 / FAC05-S 연계 설정
 *   영속 키 'dyfacil-v1' = { recs, ext, syncLog, settings }
 *     recs  = FMS 소유(읽기전용) — 시드는 js/facil-data.js DY_FACIL_SEED.recs (80건)
 *     ext   = 자체 소유(보완입력) { <facilNo>: {...} }
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
    const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
    const THIS_YEAR = 2026;

    /* ── 코드 라벨 (가이드 stale — FMS 최신 공통코드 재확인 필요, PRD §9-2) ── */
    const CLASS_NM = { '1': '1종', '2': '2종', '3': '3종' };
    const GRADE_DESC = {
        A: '우수 — 문제점 없는 최상 상태',
        B: '양호 — 보조부재 경미 결함, 기능 지장 없음',
        C: '보통 — 주요부재 경미 결함, 보수 필요',
        D: '미흡 — 긴급 보수·보강 필요, 사용제한 검토',
        E: '불량 — 심각 결함, 즉각 사용금지·개축',
    };
    /* 중대결함 유형 (시설물안전법 시행령 제18조 11종 요약) */
    const DEFECT_TYPES = [
        '시설물 기초의 세굴', '교량 교각의 부등침하', '교량 받침의 파손',
        '터널 지반의 부등침하', '댐의 파이핑·구조적 균열', '건축물 기둥·보·내력벽 내력 손실',
        '하천시설 본체·수문 파손·누수·세굴', '철근콘크리트 염해·탄산화 내력 손실',
        '절토·성토 사면 균열·이완', '옹벽의 균열·파손', '기타 국토교통부령 결함',
    ];
    const REPAIR_STATUS = ['계획', '착수', '완료'];

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
    function ageOf(r) { const y = (r.cplYmd || '').slice(0, 4); return /^\d{4}$/.test(y) ? (THIS_YEAR - +y) : null; }
    function addrOf(r) { return [r.addrSido, r.addrGugun, r.addrDong, r.addrDetail].filter(x => x && x.trim()).join(' '); }
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
        if (e.lastInspectYmd) { have.push('최근점검'); coreMissing = false; const gap = THIS_YEAR - +(e.lastInspectYmd.slice(0, 4)); score += gap >= 2 ? 12 : gap >= 1 ? 5 : 0; }
        if (e.defectYn === 'Y') { have.push('중대결함'); score += 40; }
        if (e.dailyUsers) { have.push('이용인원'); score += e.dailyUsers >= 1000 ? 12 : e.dailyUsers >= 300 ? 7 : 3; }
        if (coreMissing) return { level: 'na', score: null, have, label: '산정불가' };
        const level = score >= 55 ? 'high' : score >= 30 ? 'mid' : 'low';
        return { level, score, have, label: { high: '높음', mid: '보통', low: '낮음' }[level] };
    }
    /* 다음 점검 예정일 간이 산출 (안전등급 + 종별) — 법정주기 근사 (PRD §3 FAC02-D) */
    function suggestNext(last, grade) {
        if (!last) return '';
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(last); if (!m) return '';
        let y = +m[1], mo = +m[2] + ((grade === 'D' || grade === 'E') ? 4 : 6);
        y += Math.floor((mo - 1) / 12); mo = ((mo - 1) % 12) + 1;
        return y + '-' + String(mo).padStart(2, '0') + '-' + m[3];
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
        saveExt, sendFms, suggestNext, diffAgainst, applyIncoming,
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
                if (!e.lat) flags.push('<span class="chip-mini wt-attach">좌표없음</span>');
                return '<tr onclick="DYFACIL._detail(\'' + r.facilNo + '\')" style="cursor:pointer;">' +
                    '<td><b>' + esc(r.facilNm) + '</b><div style="font-size:11px; color:var(--text-gray);">' + esc(r.facilNo) + '</div></td>' +
                    '<td>' + esc(r.gbnNm) + '<div style="font-size:11px; color:var(--text-gray);">' + esc(r.kindNm) + '</div></td>' +
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

        /* 2) 보완입력 (자체 소유 · 편집) */
        const sel = (id, cur, opts, ph) => '<select class="select" id="' + id + '" style="width:100%;"><option value="">' + ph + '</option>' + opts.map(o => { const v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>';
        const inp = (id, cur, ph, type) => '<input class="select" id="' + id + '" style="width:100%;" type="' + (type || 'text') + '" value="' + esc(cur || '') + '" placeholder="' + esc(ph || '') + '">';
        const nextSuggest = e.lastInspectYmd ? DYFACIL.suggestNext(e.lastInspectYmd, e.safetyGrade || 'C') : '';
        const extBlock =
            '<div class="fac-sec-t" style="margin-top:18px;">보완입력 <span class="chip-mini wt-program">자체 소유 · FMS 수신이 덮어쓰지 않음</span></div>' +
            '<div class="fac-grid">' +
            '<div class="fac-f2"><span class="fac-f-l">안전등급 (A~E)</span>' + sel('ex-grade', e.safetyGrade, ['A', 'B', 'C', 'D', 'E'].map(g => [g, g + ' — ' + GRADE_DESC[g].split(' — ')[1]]), '미평가') + '</div>' +
            '<div class="fac-f2"><span class="fac-f-l">소관부서</span>' + inp('ex-dept', e.deptNm, '예: 건설과') + '</div>' +
            '<div class="fac-f2"><span class="fac-f-l">최근 점검일</span>' + inp('ex-last', e.lastInspectYmd, 'YYYY-MM-DD', 'date') + '</div>' +
            '<div class="fac-f2"><span class="fac-f-l">차기 점검예정일 ' + (nextSuggest ? '<span style="font-size:11px; color:var(--primary);">(법정주기 제안 ' + nextSuggest + ')</span>' : '') + '</span>' + inp('ex-next', e.nextInspectYmd, 'YYYY-MM-DD', 'date') + '</div>' +
            '<div class="fac-f2"><span class="fac-f-l">중대결함 유무</span>' + sel('ex-defyn', e.defectYn, [['N', '없음'], ['Y', '있음']], '미확인') + '</div>' +
            '<div class="fac-f2"><span class="fac-f-l">중대결함 유형</span>' + sel('ex-deftype', e.defectType, DEFECT_TYPES, '해당 없음') + '</div>' +
            '<div class="fac-f2"><span class="fac-f-l">보수보강 진행</span>' + sel('ex-repair', e.repairStatus, REPAIR_STATUS, '해당 없음') + '</div>' +
            '<div class="fac-f2"><span class="fac-f-l">규모 (값 / 단위)</span><div style="display:flex; gap:6px;">' + inp('ex-size', e.sizeValue, '값') + inp('ex-unit', e.sizeUnit, '㎡·m·톤/일') + '</div></div>' +
            '<div class="fac-f2"><span class="fac-f-l">이용인원 (일평균)</span>' + inp('ex-users', e.dailyUsers, '명', 'number') + '</div>' +
            '<div class="fac-f2"><span class="fac-f-l">위험물 취급</span>' + sel('ex-hazmat', e.hazmatYn, [['N', '없음'], ['Y', '있음']], '미확인') + '</div>' +
            '<div class="fac-f2"><span class="fac-f-l">좌표 (위도 / 경도)</span><div style="display:flex; gap:6px;">' + inp('ex-lat', e.lat, '위도') + inp('ex-lng', e.lng, '경도') + '</div></div>' +
            '<div class="fac-f2"><span class="fac-f-l">인접 위험요소</span>' + inp('ex-adj', e.adjacentRisk, '예: 급경사지 인접') + '</div>' +
            '</div>' +
            (e.defectYn === 'Y' && e.defectNotifyYmd ? '<p class="fac-note">중대결함 통보일 ' + esc(e.defectNotifyYmd) + ' → 보수·보강 착수기한 ' + plusYear(e.defectNotifyYmd, 2) + ' · 완료기한 ' + plusYear(e.defectNotifyYmd, 3) + ' (시설물안전법 제24조·시행령 제19조)</p>' : '');

        /* 3) 위험도 요약 */
        const riskBlock =
            '<div class="fac-sec-t" style="margin-top:18px;">위험도 · 위험성평가</div>' +
            '<div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">' +
            riskChip(rk) + '<span style="font-size:12px; color:var(--text-gray);">확보 변수: ' + (rk.have.length ? rk.have.join(', ') : '없음') + '</span>' +
            (rk.level === 'na' ? '<span class="chip-mini wt-attach">핵심변수(안전등급/점검일) 부족 — 보완입력 후 착수</span>' : '') +
            '</div>';

        const foot =
            '<button class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
            '<button class="btn btn-outline" onclick="DYFACIL._send(\'' + no + '\', \'update\')">FMS 전송(수정)</button>' +
            (rk.level !== 'na'
                ? '<button class="btn btn-primary" onclick="DYFACIL._toRisk(\'' + no + '\')">위험성평가 착수</button>'
                : '<button class="btn btn-primary" onclick="DYFACIL._saveExt(\'' + no + '\')">보완입력 저장</button>') +
            '<button class="btn btn-primary" onclick="DYFACIL._saveExt(\'' + no + '\')" style="' + (rk.level !== 'na' ? '' : 'display:none;') + '">보완입력 저장</button>';

        V().openModal('시설물 상세 — ' + esc(r.facilNm), fmsBlock + extBlock + riskBlock, foot);
        /* 등급/최근점검 바뀌면 차기 제안 갱신은 저장 시 반영(단순화) */
    }
    function plusYear(ymd, n) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd); return m ? (+m[1] + n) + '-' + m[2] + '-' + m[3] : '-'; }

    function collectExt() {
        const g = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
        return {
            safetyGrade: g('ex-grade'), deptNm: g('ex-dept'), lastInspectYmd: g('ex-last'), nextInspectYmd: g('ex-next'),
            defectYn: g('ex-defyn'), defectType: g('ex-deftype'), repairStatus: g('ex-repair'),
            sizeValue: g('ex-size'), sizeUnit: g('ex-unit'), dailyUsers: g('ex-users'), hazmatYn: g('ex-hazmat'),
            lat: g('ex-lat'), lng: g('ex-lng'), adjacentRisk: g('ex-adj'),
        };
    }

    /* ─────────── FAC03-V 위험도 ─────────── */
    function mountRisk(app) {
        function render() {
            const scored = DB.recs.map(r => ({ r, rk: riskOf(r.facilNo), e: extOf(r.facilNo) }));
            const rank = { high: 0, mid: 1, low: 2, na: 3 };
            scored.sort((a, b) => (rank[a.rk.level] - rank[b.rk.level]) || ((b.rk.score || 0) - (a.rk.score || 0)));
            const nHigh = scored.filter(s => s.rk.level === 'high').length;
            const nNa = scored.filter(s => s.rk.level === 'na').length;
            const card = (t, v, f) => '<div class="kpi-card"><div class="kpi-card-label"><span class="kpi-card-title">' + t + '</span></div><div class="kpi-card-value"><span style="font-size:24px;">' + v + '</span></div><div class="kpi-card-foot">' + f + '</div></div>';
            const rowsH = scored.map(s => {
                const btn = s.rk.level === 'na'
                    ? '<button class="btn btn-sm btn-outline" onclick="DYFACIL._detail(\'' + s.r.facilNo + '\')">보완입력</button>'
                    : '<button class="btn btn-sm btn-primary" onclick="DYFACIL._toRisk(\'' + s.r.facilNo + '\')">평가 착수</button>';
                return '<tr><td><b>' + esc(s.r.facilNm) + '</b><div style="font-size:11px;color:var(--text-gray);">' + esc(s.r.gbnNm) + ' · ' + (CLASS_NM[s.r.facilClass] || '') + '</div></td>' +
                    '<td>' + gradeChip(s.e.safetyGrade) + '</td>' +
                    '<td>' + (ageOf(s.r) != null ? ageOf(s.r) + '년' : '-') + '</td>' +
                    '<td>' + (s.e.dailyUsers ? Number(s.e.dailyUsers).toLocaleString() + '명' : '-') + '</td>' +
                    '<td>' + riskChip(s.rk) + '</td>' +
                    '<td style="font-size:11px;color:var(--text-gray);">' + s.rk.have.length + '/8</td>' +
                    '<td class="col-action">' + btn + '</td></tr>';
            }).join('');
            app.innerHTML =
                '<div class="board-grid cols-3" style="margin-bottom:16px;">' +
                card('위험도 높음', nHigh + '건', '우선 평가 대상') +
                card('산정 불가', nNa + '건', '핵심변수 미확보 — 보완입력 필요') +
                card('평가 가능', (DB.recs.length - nNa) + '건', '안전등급·점검일 확보분') +
                '</div>' +
                '<div class="card"><div class="card-body" style="font-size:12px; color:var(--text-gray);">위험도는 확보된 변수만으로 산정합니다. 없는 값은 0으로 처리하지 않고 <b>산정불가</b>로 분류해 과소평가를 방지합니다. (PRD §8)</div></div>' +
                '<div class="card" style="margin-top:12px;"><div class="card-body" style="overflow-x:auto; padding:0;">' +
                '<table class="table-figma"><thead><tr><th>시설물</th><th>안전등급</th><th>경과</th><th>이용인원</th><th>위험도</th><th>변수</th><th>관리</th></tr></thead><tbody>' + rowsH + '</tbody></table>' +
                '</div></div>';
        }
        render();
        DYFACIL._reRisk = render;
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
                '<div class="fac-f2"><span class="fac-f-l">1일 실행 상한</span><input class="select" id="set-limit" style="width:100%;" type="number" value="' + esc(s.batchLimit) + '"> <span style="font-size:11px; color:var(--text-gray);">가이드 최대 10회</span></div>' +
                '<div class="fac-f2"><span class="fac-f-l">자동 승인요청</span><select class="select" id="set-appr" style="width:100%;"><option value="0"' + (!s.autoApprove ? ' selected' : '') + '>미사용</option><option value="1"' + (s.autoApprove ? ' selected' : '') + '>사용 (approveReqYn=Y)</option></select></div>' +
                '</div>' +
                '<p style="font-size:12px; color:var(--text-gray); margin-top:10px;">인증키·비밀번호 등 자격증명은 보안 절차상 이 화면에서 입력·저장하지 않습니다. (별도 보안 위임)</p>' +
                '<div style="margin-top:12px;"><button class="btn btn-primary btn-sm" onclick="DYFACIL._saveSet()">설정 저장</button></div>' +
                '</div></div>' +
                /* 필드 소유권 */
                '<div class="card" style="margin-top:12px;"><div class="card-header"><span class="card-title">필드 소유권 규칙</span></div><div class="card-body">' +
                '<div class="board-grid cols-2">' +
                '<div><div class="fac-sec-t">FMS 소유 (읽기전용)</div><p style="font-size:13px; color:var(--text-gray);">BASTB_MASTER 42컬럼 + FMS반영키. 수신 시 갱신, 정정은 updateBastbMaster 전송으로만.</p></div>' +
                '<div><div class="fac-sec-t">자체 소유 (수신 불가침)</div><p style="font-size:13px; color:var(--text-gray);">안전등급 · 점검일 · 중대결함 · 규모 · 이용인원 · 위험물 · 좌표 · 소관부서 · 담당자 · 중대재해대상 구분.</p></div>' +
                '</div></div></div>' +
                /* 공통코드 */
                '<div class="card" style="margin-top:12px;"><div class="card-header"><span class="card-title">공통코드 매핑 <span class="chip-mini wt-attach">가이드 stale — FMS 최신 공통코드 재확인 필요</span></span></div>' +
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
        if (page === 'fac-list') { window.__facRerender = () => mountList(app); mountList(app); }
        else if (page === 'fac-risk') mountRisk(app);
        else if (page === 'fac-sync') mountSync(app);
        else if (page === 'fac-settings') mountSettings(app);
    });
})();
