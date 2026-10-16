/* =========================================================================
 * DYCON — 도급·용역·위탁 계약 원장 (2026-10-15 신설)
 * -------------------------------------------------------------------------
 * 도급관리(SCR-SBM-004)와 조직 › 공사별 안전관리자 선임 현황(SCR-SBM-002 §4-5)이
 * **같은 원장**을 읽는다. 종전에는 두 화면이 각자 배열(CONTRACT_BIZ_STATE ·
 * ORG_CONSTRUCTION_STATE)을 들고 있어 같은 공사의 금액·기간이 화면마다 갈릴 수
 * 있었다(SCR-SBM-002 §6 «같은 원장을 쓴다»).
 *
 * 계약이 들어오는 경로는 둘이다 — e호조 계약대장 **파일 반입**(주관부서 담당자)과
 * **직접 등록**(e호조에 없는 계약). 반입은 점검이 아니다: 반입분은 «미판정»으로
 * 오르고, 주관부서 담당자가 판정한 계약만 점검표·평가 대상이 된다.
 *
 * 계약 원장 값(관리번호·계약종류·계약명·계약일자·준공예정일자·총계약금액·업체명·
 * 사업자등록번호·감독부서)은 이 시스템이 고치지 않는다 — 다음 반입에 덮인다.
 * 사람이 정하는 값(판정·점검 유형·도급인 의무 적용·건축허가 대상·착공일 보완·
 * 안전관리자)은 반입이 덮지 않는다.
 *
 * 근거 — 도급관리 정의서 §6 «e호조 계약대장 파일 반입» · «점검 항목 생성 규칙»,
 *        `docs/planning/전달-개발-e호조계약대장-회신-20261015-v1.md`
 * ========================================================================= */
(function (global) {
    'use strict';
    const V = () => global.DYV2;
    const R = () => global.DYROLE;
    const SKEY = 'dy-contract-v1';

    /* 파일 머리글 — 줄바꿈·공백을 지운 이름으로 찾는다(실제 파일 머리글이 «계약해지\r\n여부»처럼 줄이 갈려 있다).
       열 순서로 찾지 않는다 — e호조 화면에서 내려받는 열 구성이 바뀌어도 이름이 같으면 읽힌다. */
    const COLS = {
        mngNo: '계약대장관리번호', kind: '계약종류', name: '계약명', signed: '계약일자',
        end: '준공예정일자', amount: '총계약금액', co: '업체명', brn: '사업자등록번호', dept: '감독부서',
    };
    /* 받아 두는 칸 — 없어도 반입은 된다. 해지여부는 점검 대상에서 거르는 필터, 계약내용은 판정 근거,
       신규/장기는 «장기계속» 표시에만 쓴다. */
    const KEEP = { cancel: '계약해지여부', content: '계약내용', term: '신규/장기' };
    const LEDGER = ['kind', 'name', 'signed', 'start', 'end', 'amount', 'co', 'brn', 'dept', 'cancel', 'content', 'term'];

    /* 점검 유형 = RFP SFR-013 관리 항목 5분류. e호조 원값(공사·용역·물품)과 **다른 칸**이다.
       물품은 «기타»가 기본 — 담양군 시설 안에서 설치 작업이 따를 때만 판정자가 «구매설치»로 바꾼다. */
    const CATS = ['공사', '용역', '구매설치', '위탁', '기타'];
    const KIND_TO_CAT = { '공사': '공사', '용역': '용역', '물품': '기타' };

    /* 법정 금액 기준 — 전부 법이 정한 값이다(우리가 정한 금액이 아니다 — EXT-14 와 혼동하지 말 것).
       판정 보조 표시일 뿐 제외 근거가 아니다(중처법 시행령 §4제9호 반기 점검에는 금액 기준이 없다). */
    const LEGAL = [
        { k: 'oshcost', label: '산업안전보건관리비', min: 2e7,              basis: '산업안전보건법 제72조 · 건설업 산업안전보건관리비 계상 및 사용기준 제3조' },
        { k: 'tech',    label: '기술지도',           min: 1e8, max: 1.2e10, basis: '산업안전보건법 제73조 · 같은 법 시행령 제59조' },
        { k: 'ledger',  label: '안전보건대장',       min: 5e9,              basis: '산업안전보건법 제67조 · 같은 법 시행령 제55조' },
    ];
    const TECH_TOPO_MAX = 1.5e10;   /* 토목공사업은 150억 미만까지 — 업종이 자료에 없어 120억~150억은 판정 보류 */
    const MGR_MIN = 5e9;            /* 안전관리자 선임 — 시행령 별표3 제49호 건설업(시공사 의무) */

    /* ── 저장 ── sessionStorage 하나(업무 자동발행 dy-work-v1 과 같은 방식) */
    let ST = null;
    function load() { try { return JSON.parse(sessionStorage.getItem(SKEY) || 'null'); } catch (e) { return null; } }
    function save() { try { sessionStorage.setItem(SKEY, JSON.stringify(ST)); } catch (e) { V().toast('저장 공간이 부족해 이 화면을 닫으면 반입 결과가 사라집니다'); } }

    function blank(o) {
        return Object.assign({
            id: '', src: 'manual', mngNo: '', srcNo: '', kind: '', name: '', signed: '', start: '', end: '',
            amount: '', co: '', brn: '', dept: '', owner: '담양군', cancel: '', content: '', term: '',
            cat: '기타', judge: '미판정', reason: '', judgedBy: '', judgedAt: '', duty: '미확인', permit: false,
            startFix: '', missing: false, changed: false, importId: '',
            mgr: '', mgrSt: '미시행',
        }, o);
    }
    function split(period) {
        const p = String(period == null ? '' : period).split('~').map(s => s.trim());
        return { from: p[0] || '', to: p[1] || '' };
    }

    /* ── 예시 자료 ──
       ① 담양군 계약정보시스템(gyeyak.damyang.go.kr) 공개 목록에서 옮겨 적은 계약 10건 — id 는 그 시스템 「번호」.
          계약기간은 목록 화면에 없어 10건 중 1건만 있다(지어내지 않는다). 종전 «등록 = 점검 대상» 규칙으로
          들어온 행이라 판정 «대상»으로 이어받는다.
       ② 조직 화면에서 직접 등록했던 공사 2건 — 같은 원장으로 합쳤다.
       e호조 반입분은 시드로 두지 않는다 — 실제 파일을 올려야 들어온다. */
    function seed() {
        const gy = [
            ['4173', '2026년 담양군 마을상수도 기술진단용역 추진, 감독공무원 지명 및 임명', '물순환사업소', '(주)우리종합기술', '2026-08-11', '2026-08-14 ~ 2027-08-13', 61000000],
            ['4172', '2026년도 의원 연구단체 정책개발연구용역 계약 추진', '의회사무과', '(사)한국행정발전연구원', '2026-07-30', '', 20460000],
            ['4171', '담양군보건소 이전신축 조성사업 교통성검토 용역', '보건소', '(주)우리이엔티', '2026-07-28', '', 22000000],
            ['4170', '2026년 담양공공하수처리시설 정밀안전점검 용역 시행', '물순환사업소', '(주)태성기술개발', '2026-07-27', '', 16300000],
            ['4169', '2026년 고서공공하수처리시설 외 1개소 하반기 정기안전점검용역 시행', '물순환사업소', '주식회사 길성이앤시', '2026-07-24', '', 11200000],
            ['4168', '가사문학면 학선리 개선동마을 등 3개소 소규모수도시설 지하수영향조사 용역', '물순환사업소', '(주)우진엔지니어링', '2026-07-17', '', 19980000],
            ['4167', '창평면 용수리 부동제 여수로 정비공사 폐기물처리용역 - 도급액', '본청', '(주)금성환경산업', '2026-07-07', '', 1555000],
            ['4166', '농어촌 생활용수(창평지구) 개발사업 폐기물처리용역(1차)', '물순환사업소', '(주)대림환경', '2026-07-06', '', 58700000],
            ['4165', '담양, 고서, 무증, 태암 공공하수도 재해복구사업 실시설계 용역', '물순환사업소', '(주)진성기술단', '2026-07-01', '', 16100000],
            ['4164', '담양읍 백동리(251-15) 하수관로 정비사업 설계안정성검토', '물순환사업소', '(주)태성기술개발', '2026-07-01', '', 7500000],
        ].map(a => {
            const p = split(a[5]);
            return blank({ id: 'G-' + a[0], src: 'gyeyak', srcNo: a[0], kind: '용역', cat: '용역', name: a[1], dept: a[2], co: a[3],
                signed: a[4], start: p.from, end: p.to, amount: a[6], judge: '대상', judgedBy: '종전 등록분 승계' });
        });
        const org = [
            blank({ id: 'M-1', src: 'manual', kind: '공사', cat: '공사', name: '군도 5호선 정비공사', start: '2026-03-02', end: '2026-10-30', amount: 1240000000, judge: '대상', judgedBy: '종전 등록분 승계', mgr: '김안전', mgrSt: '완료' }),
            blank({ id: 'M-2', src: 'manual', kind: '공사', cat: '공사', name: '정수장 내진보강 공사', start: '2026-06-01', end: '2026-12-20', amount: 870000000, judge: '대상', judgedBy: '종전 등록분 승계' }),
        ];
        return { v: 1, rows: gy.concat(org), imports: [], seq: 2, lastBulk: null };
    }
    function state() { if (!ST) ST = load() || seed(); return ST; }
    function rows() { return state().rows; }
    function get(id) { return rows().find(r => r.id === id) || null; }

    /* ── 날짜·회차 ── */
    function today() { return V().today(); }
    function roundOf(iso) {
        const t = iso || today(), y = t.slice(0, 4), h = Number(t.slice(5, 7)) <= 6 ? 1 : 2;
        return { key: y + 'H' + h, label: y + ' ' + (h === 1 ? '상반기' : '하반기'),
                 start: y + (h === 1 ? '-01-01' : '-07-01'), end: y + (h === 1 ? '-06-30' : '-12-31') };
    }
    /* 계약 시작 — 착공일(보완)이 있으면 그 값, 없으면 원장의 시작(파일은 계약일자) */
    function startOf(r) { return r.startFix || r.start || r.signed || ''; }
    function startBasis(r) { return r.startFix ? '착공일' : (r.start ? '' : '계약일'); }
    function periodBad(r) { const s = r.start || r.signed; return !!(s && r.end && r.end < s); }
    function amountOk(r) { return typeof r.amount === 'number' && r.amount > 0; }
    /* 자료 확인 필요 — 기간이 뒤집혔거나, 반입분인데 금액이 0원·빈 값. 직접 등록은 금액을 비워 둘 수 있어 세지 않는다. */
    function flagged(r) { return periodBad(r) || (!amountOk(r) && r.src === 'ehojo'); }
    /* 이번 회차와 겹치나 — true / false / null(기간이 뒤집혀 판정 불가). 기간을 모르면 걸러 내지 않는다 —
       모르는 것을 «대상 아님»으로 단정하면 점검하지 않은 현장이 사라진다. */
    function inRound(r, rd) {
        if (periodBad(r)) return null;
        rd = rd || roundOf();
        const from = startOf(r), to = r.end;
        if (from && from > rd.end) return false;
        if (to && to < rd.start) return false;
        return true;
    }
    function ended(r) { return !!(r.end && r.end < today()); }

    /* ── 법정 적용(자동) — 점검 유형 «공사»만 ── */
    function addMonth(iso) { const d = new Date(iso + 'T00:00:00Z'); if (isNaN(d)) return ''; d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 10); }
    function legal(r) {
        if (r.cat !== '공사') return { state: 'na', items: [] };
        if (!amountOk(r)) return { state: 'unknown', items: [] };
        const a = r.amount, items = [];
        LEGAL.forEach(L => {
            if (L.k === 'tech') {
                if (a >= 1.2e10 && a < TECH_TOPO_MAX) { items.push({ k: 'tech', label: '기술지도 판정 보류', hold: true, basis: L.basis }); return; }
                if (!((a >= L.min && a < L.max) || (a < L.min && r.permit))) return;
                /* 공사기간 1개월 미만은 제외(시행령 §59①1). 기간이 뒤집힌 계약은 길이를 알 수 없어 빼지 않고 보류로 둔다 —
                   조용히 빼면 기술지도 대상이 사라진다. */
                if (periodBad(r)) { items.push({ k: 'tech', label: '기술지도 (기간 확인 필요)', hold: true, basis: L.basis }); return; }
                const s = startOf(r);
                if (s && r.end && r.end < addMonth(s)) return;
                items.push({ k: L.k, label: L.label, basis: L.basis });
                return;
            }
            if (a >= L.min && (!L.max || a < L.max)) items.push({ k: L.k, label: L.label, basis: L.basis });
        });
        return { state: items.length ? 'some' : 'none', items: items };
    }
    /* 안전관리자 선임 의무(시공사) — required / none / unknown */
    function mgrDuty(r) { if (!amountOk(r)) return 'unknown'; return r.amount >= MGR_MIN ? 'required' : 'none'; }

    /* ── 권한 — 반입·판정은 주관부서 담당자, 착공일·점검은 그 계약 감독부서 담당자(주관부서 포함) ── */
    function canManage() { const D = R(); return !D || D.canAct(D.OWNER_DEPT); }
    function deptIdOf(r) { return V().deptIdOf ? V().deptIdOf(r.dept) : ''; }
    function canActRow(r) { const D = R(); return !D || D.canAct(deptIdOf(r)); }
    function actor() { const D = R(); const p = D && D.current && D.current(); return p ? p.name : '담당자'; }
    function stamp() { const d = new Date(), z = n => String(n).padStart(2, '0'); return today() + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()); }

    /* ── 파일 반입 ── */
    function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ''); }
    function asDate(v) {
        const s = String(v == null ? '' : v).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
        if (/^\d{4}\.\d{2}\.\d{2}/.test(s)) return s.slice(0, 10).replace(/\./g, '-');
        if (/^\d{8}$/.test(s)) return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
        if (/^\d+(\.\d+)?$/.test(s)) return global.DYXLSX ? global.DYXLSX.serialDate(s) : '';
        return '';
    }
    function asAmount(v) { const s = String(v == null ? '' : v).replace(/,/g, '').trim(); if (!s) return ''; const n = Number(s); return isFinite(n) ? Math.round(n) : ''; }
    function asBrn(v) { let s = String(v == null ? '' : v).replace(/\D/g, ''); if (s && s.length < 10) s = s.padStart(10, '0'); return s; }

    /* rows(2차원 배열) → 검사 결과. 필수 칸이 하나라도 없으면 **파일 전체를 받지 않는다** —
       일부만 반영하면 어느 값이 옛것인지 알 수 없다(정의서 §5-4). */
    function parse(table) {
        const hi = table.findIndex(line => line.some(c => norm(c) === COLS.mngNo));
        if (hi < 0) return { error: '계약대장 파일이 아닙니다 — «' + COLS.mngNo + '» 칸을 찾지 못했습니다' };
        const head = table[hi].map(norm), idx = {};
        Object.keys(COLS).forEach(k => { idx[k] = head.indexOf(COLS[k]); });
        Object.keys(KEEP).forEach(k => { idx[k] = head.indexOf(norm(KEEP[k])); });
        const miss = Object.keys(COLS).filter(k => idx[k] < 0).map(k => COLS[k]);
        if (miss.length) return { error: '필수 칸이 없어 반입하지 않았습니다 — ' + miss.join(' · ') };
        const out = [], skipped = [], seen = {};
        for (let i = hi + 1; i < table.length; i++) {
            const line = table[i], g = k => idx[k] >= 0 ? String(line[idx[k]] == null ? '' : line[idx[k]]).trim() : '';
            if (!line.some(c => String(c || '').trim())) continue;   /* 빈 줄 */
            const mng = g('mngNo');
            if (!mng) { skipped.push({ row: i + 1, why: '관리번호 없음' }); continue; }
            if (seen[mng]) { skipped.push({ row: i + 1, why: '관리번호 중복(' + mng + ')' }); continue; }
            seen[mng] = true;
            const signed = asDate(g('signed'));
            out.push({ mngNo: mng, kind: g('kind'), name: g('name'), signed: signed, start: signed, end: asDate(g('end')),
                amount: asAmount(g('amount')), co: g('co'), brn: asBrn(g('brn')), dept: g('dept'),
                cancel: g('cancel').toUpperCase() === 'Y' ? 'Y' : 'N', content: g('content'), term: g('term') });
        }
        return { list: out, skipped: skipped };
    }

    /* 반입 — 관리번호로 갱신(upsert). 사람이 정한 값은 덮지 않는다. 최근 파일에 없는 계약은 지우지 않는다. */
    function applyImport(list, meta) {
        const st = state();
        const imp = { id: 'IMP-' + (st.imports.length + 1), at: stamp(), by: actor(), file: meta.file || '', extracted: meta.extracted || '',
            total: list.length, added: [], changed: [], missingSet: [], prevImport: [], skipped: meta.skipped || [], flagged: 0, undone: false };
        const inFile = {};
        list.forEach(L => {
            inFile[L.mngNo] = true;
            const ex = st.rows.find(r => r.src === 'ehojo' && r.mngNo === L.mngNo);
            if (ex) {
                const prev = {};
                LEDGER.forEach(k => { if (String(ex[k]) !== String(L[k])) prev[k] = ex[k]; });
                const wasMissing = ex.missing;
                if (Object.keys(prev).length || wasMissing) {
                    imp.changed.push({ id: ex.id, prev: prev, missing: wasMissing, changed: ex.changed });
                    LEDGER.forEach(k => { ex[k] = L[k]; });
                    ex.missing = false;
                    if (Object.keys(prev).length && ex.judge !== '미판정') ex.changed = true;
                }
                imp.prevImport.push({ id: ex.id, importId: ex.importId });
                ex.importId = imp.id;
            } else {
                const row = blank(Object.assign({ id: 'E-' + L.mngNo, src: 'ehojo', cat: KIND_TO_CAT[L.kind] || '기타', importId: imp.id }, L));
                st.rows.push(row); imp.added.push(row.id);
            }
        });
        st.rows.forEach(r => {
            if (r.src === 'ehojo' && !inFile[r.mngNo] && !r.missing) { r.missing = true; imp.missingSet.push(r.id); }
        });
        imp.flagged = st.rows.filter(r => r.src === 'ehojo' && inFile[r.mngNo] && flagged(r)).length;
        st.imports.push(imp);
        save();
        return imp;
    }
    /* 가장 최근 반입만 되돌린다 — 그 뒤에 판정을 시작한 계약이 있으면 막는다(판정·점검 기록이 그 행에 붙는다). */
    function undoBlockers(imp) {
        return imp.added.map(get).filter(r => r && (r.judge !== '미판정' || r.startFix));
    }
    function lastImport() { const im = state().imports.filter(x => !x.undone); return im[im.length - 1] || null; }
    function undoImport(id) {
        const st = state(), imp = st.imports.find(x => x.id === id);
        if (!imp || imp.undone || imp !== lastImport()) return { ok: false, why: '가장 최근 반입만 되돌릴 수 있습니다' };
        const blk = undoBlockers(imp);
        if (blk.length) return { ok: false, why: '이 반입으로 들어온 계약 중 ' + blk.length + '건은 이미 판정하거나 착공일을 넣어 되돌릴 수 없습니다' };
        st.rows = st.rows.filter(r => imp.added.indexOf(r.id) < 0);
        imp.changed.forEach(c => { const r = get(c.id); if (!r) return; Object.assign(r, c.prev); r.missing = c.missing; r.changed = c.changed; });
        imp.missingSet.forEach(i => { const r = get(i); if (r) r.missing = false; });
        (imp.prevImport || []).forEach(x => { const r = get(x.id); if (r) r.importId = x.importId; });
        imp.undone = true; save();
        return { ok: true, imp: imp };
    }

    /* ── 판정 ── 제외는 사유 없이 저장하지 않는다(종이 서식의 실패 모드가 «해당 없음으로 적고 빠져나가기»였다) */
    function setJudge(ids, judge, reason, opts) {
        if (['미판정', '대상', '제외'].indexOf(judge) < 0) return { ok: false, why: '판정 값이 잘못됐습니다' };
        if (judge === '제외' && !String(reason || '').trim()) return { ok: false, why: '제외 사유를 적어야 합니다' };
        const st = state(), prev = [];
        ids.map(get).filter(Boolean).forEach(r => {
            prev.push({ id: r.id, judge: r.judge, reason: r.reason, judgedBy: r.judgedBy, judgedAt: r.judgedAt, changed: r.changed });
            r.judge = judge; r.reason = judge === '제외' ? String(reason).trim() : '';
            r.judgedBy = actor(); r.judgedAt = stamp(); r.changed = false;
        });
        if (opts && opts.bulk) st.lastBulk = { at: stamp(), judge: judge, prev: prev };
        save();
        return { ok: true, n: prev.length };
    }
    function undoBulk() {
        const st = state(), b = st.lastBulk; if (!b) return { ok: false };
        b.prev.forEach(p => { const r = get(p.id); if (r) Object.assign(r, { judge: p.judge, reason: p.reason, judgedBy: p.judgedBy, judgedAt: p.judgedAt, changed: p.changed }); });
        st.lastBulk = null; save();
        return { ok: true, n: b.prev.length };
    }
    function setAttrs(id, a) {
        const r = get(id); if (!r) return null;
        if (a.cat && CATS.indexOf(a.cat) >= 0) r.cat = a.cat;
        if (a.duty && ['예', '아니오', '미확인'].indexOf(a.duty) >= 0) r.duty = a.duty;
        if (typeof a.permit === 'boolean') r.permit = a.permit;
        save(); return r;
    }
    function setStartFix(id, date) {
        const r = get(id); if (!r) return { ok: false, why: '계약을 찾지 못했습니다' };
        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, why: '날짜 형식이 아닙니다' };
        if (date && r.end && date > r.end) return { ok: false, why: '착공일이 준공예정일보다 늦습니다' };
        r.startFix = date || ''; save(); return { ok: true };
    }
    function setMgr(id, name, st) { const r = get(id); if (!r) return null; if (name != null) r.mgr = name; if (st) r.mgrSt = st; save(); return r; }

    /* 직접 등록 — e호조에 없는 계약. 등록 자체가 «이 계약을 점검하겠다»는 뜻이라 판정 «대상»으로 들어간다. */
    function addManual(d) {
        const st = state();
        st.seq = (st.seq || 0) + 1;
        const row = blank(Object.assign({ id: 'M-' + st.seq, src: 'manual', kind: d.cat, cat: d.cat, judge: '대상', judgedBy: actor(), judgedAt: stamp() }, d));
        st.rows.push(row); save(); return row;
    }
    function updateManual(id, d) { const r = get(id); if (!r || r.src !== 'manual') return null; Object.assign(r, d); save(); return r; }

    /* 수급업체 — 점검 대상 계약에서 파생. 사업자등록번호가 있으면 그것으로 묶고(상호 표기가 둘이어도 한 업체),
       없으면(직접 등록·옮겨 적은 계약) 상호로 묶는다. */
    function vendors() {
        const out = [];
        rows().filter(r => r.judge === '대상' && r.co).forEach(r => {
            const key = r.brn || ('co:' + r.co);
            const v = out.find(x => x.key === key);
            if (v) { v.biz.push(r.name); if (v.names.indexOf(r.co) < 0) v.names.push(r.co); v.co = r.co; }
            else out.push({ key: key, brn: r.brn, co: r.co, names: [r.co], biz: [r.name] });
        });
        return out;
    }
    function maskBrn(b) { return b && b.length === 10 ? b.slice(0, 3) + '-' + b.slice(3, 5) + '-*****' : ''; }

    global.DYCON = {
        COLS, KEEP, CATS, LEGAL, MGR_MIN,
        state, rows, get, roundOf, startOf, startBasis, periodBad, amountOk, flagged, inRound, ended,
        legal, mgrDuty, canManage, canActRow, deptIdOf,
        parse, applyImport, lastImport, undoImport, setJudge, undoBulk, setAttrs, setStartFix, setMgr,
        addManual, updateManual, vendors, maskBrn,
        reset() { ST = seed(); save(); },
    };
})(window);
