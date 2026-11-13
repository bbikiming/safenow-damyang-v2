/* =========================================================================
 * 전자문서 공통 엔진 (e-Doc) — 기획 v1 컨펌 반영
 *   · 표준 폼 7종 렌더 (edoc-templates.js)
 *   · 상태 머신: 작성중 → 등록완료 → 확정  (확정 시 온나라 결재 요청 팝업 1회)
 *   · 처리 이력 타임라인 (안전나우 U5) · 연동 정보 카드 (U3)
 *   · 개선조치 자동 생성 스토어 · 알림 발송 시뮬레이션 (COM-008)
 *   · localStorage 영속 — 데모 중 등록한 문서가 화면 이동 후에도 유지
 * ========================================================================= */
(function () {
    'use strict';
    /* 점검표 X 항목에서 생기는 개선조치의 기본 예정일 — 오늘 + 30일(종전 고정값 2026-07-31 은 기준일을 11월로 옮기며 지난 날짜가 됐다) */
    function impDue() { var V = window.DYV2; var t = V && V.today ? V.today() : new Date().toISOString().slice(0, 10); var d = new Date(t + 'T00:00:00'); d.setDate(d.getDate() + 30); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    const T = window.EDOC_T;
    const V = () => window.DYV2;

    /* ── 스토어 ── */
    function load(key, def) { try { return JSON.parse(localStorage.getItem(key)) || def; } catch (e) { return def; } }
    function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
    /* ── 예시 자료 (2026-11-13 기준) ─────────────────────────────────────
     * 도급관리 — 계약 원장(DYCON 예시 자료)의 계약별 반기 점검표 · 위험성평가 실시 확인 · 수급인 평가.
     *   2026 상반기: 그때 진행 중이던 공사 2건(M-1·M-2) 확정.
     *   2026 하반기: 용역 대부분 확정 · 1건 등록완료(상신 전) · 1건 작성중 · 진행 중 공사 M-2·M-3·M-4 는 미작성(지금 할 일).
     *   도급 서식은 결재 결과를 옮겨 적지 않는 도메인이라(CLAUDE.md §7-1) «확정 · 온나라 상신»에서 멈춘다.
     * 조직 — 2026 상반기 수행평가 후속조치(F7) 확정.
     * 개선조치 — 의견청취 «개선조치중» 2건(IMP-2611·2608)과 점검표 X 항목에서 생긴 1건(IMP-2602).
     * 경영방침 점검표는 여기 두지 않는다 — 문서 id 가 판(v2.0)마다 하나라 확정본을 넣으면 하반기 점검을 쓸 수 없다.
     *   점검 이력은 경영방침 화면의 판 데이터(inspections)가 갖는다. */
    function seedDocs() {
        const P = (T && T.CHECKLIST_PRESETS) || {};
        const LINES = {
            water:  { by: '하정수', byUid: 'u_wat3', line: [{ uid: 'u_wat5', name: '문정수', role: '정수팀장', dept: '물순환사업소' }, { uid: 'u_wat1', name: '오순환', role: '물순환사업소장', dept: '물순환사업소' }], lineText: '기안 하정수 → 검토 문정수 → 결재 오순환' },
            con:    { by: '김도현', byUid: 'u_con3', line: [{ uid: 'u_con6', name: '정안전', role: '안전관리팀장', dept: '건설과' }, { uid: 'u_con1', name: '이건설', role: '건설과장', dept: '건설과' }], lineText: '기안 김도현 → 검토 정안전 → 결재 이건설' },
            hlth:   { by: '이보건', byUid: 'u_hlth2', line: [{ uid: 'u_hlth3', name: '윤담당', role: '보건담당', dept: '보건소' }, { uid: 'u_hlth1', name: '강보건', role: '보건소장', dept: '보건소' }], lineText: '기안 이보건 → 검토 윤담당 → 결재 강보건' },
            cul:    { by: '한지훈', byUid: 'u_cul1', line: [{ uid: 'u_jjt1', name: '김중대', role: '중대재해팀장', dept: '재난안전과' }, { uid: 'u_safe1', name: '홍길동', role: '재난안전과장', dept: '재난안전과' }], lineText: '기안 한지훈 → 검토 김중대 → 결재 홍길동' },
            safety: { by: '박안전', byUid: 'u_jjt2', line: [{ uid: 'u_jjt1', name: '김중대', role: '중대재해팀장', dept: '재난안전과' }, { uid: 'u_safe1', name: '홍길동', role: '재난안전과장', dept: '재난안전과' }], lineText: '기안 박안전 → 검토 김중대 → 결재 홍길동' },
        };
        const WHO = {
            water: '물순환사업소 · 주무관 / 하정수', con: '건설과 · 주무관 / 김도현', hlth: '보건소 · 보건행정 주무관 / 이보건',
            cul: '문화체육과 · 주무관 / 한지훈', safety: '재난안전과 · 안전관리 주무관 / 박안전',
        };
        const ox = (n, x) => { const o = {}; for (let i = 0; i < n; i++) o[i] = { v: (x && x[i]) ? 'X' : 'O', note: (x && x[i]) || '' }; return o; };
        let seq = 0;
        /* status: '작성중' | '등록완료' | '확정' — 확정은 상신까지 한 것 */
        const F5 = (who, date, status, list, x, sentAt) => {
            const L = LINES[who], n = list.length;
            const h = [{ at: date + ' 10:20', ev: status === '작성중' ? '임시저장' : '등록 (작성자: ' + L.by + ')' }];
            const d = { status: status, fields: { date: date, owner: WHO[who], items: ox(n, x) }, history: h, checklistSnapshot: JSON.parse(JSON.stringify(list)) };
            if (status === '확정') {
                h.push({ at: (sentAt || date) + ' 15:40', ev: '확정 · 온나라 결재 상신' });
                d.approval = Object.assign({ sample: true }, L);
                d.docNo = '온나라-2026-' + (5100 + (++seq) * 7);
            }
            return d;
        };
        const CON = (P.contract || []).concat(P.contractBuild || []);   /* 공사 = 공통 3 + 공사기간 */
        const SVC = P.contract || [];                                     /* 용역 = 공통 3 */
        const RISK = P.contractRisk || [];
        const D = {};
        const chk = (id, half, who, date, status, build, x, sentAt) => { D['EDOC-도급점검-' + id + '-' + half] = F5(who, date, status, build ? CON : SVC, x, sentAt); };
        const risk = (id, kind, who, date, status, sentAt) => { D['EDOC-도급위험성-' + id + '-' + kind] = F5(who, date, status, RISK, null, sentAt); };
        /* 2026 상반기 반기 점검표 — 그때 진행 중이던 공사 */
        chk('M-1', '2026H1', 'con', '2026-06-18', '확정', true, null, '2026-06-22');
        chk('M-2', '2026H1', 'water', '2026-06-24', '확정', true, null, '2026-06-26');
        /* 2026 하반기 반기 점검표 */
        chk('M-1', '2026H2', 'con', '2026-10-14', '확정', true, null, '2026-10-16');
        chk('G-4173', '2026H2', 'water', '2026-11-03', '확정', false, null, '2026-11-05');
        chk('G-4170', '2026H2', 'water', '2026-10-27', '확정', false, null, '2026-10-29');
        chk('G-4169', '2026H2', 'water', '2026-10-22', '확정', false, { 2: '서약서 미수령 — 10월 말까지 받기로 함(개선조치 IMP-2602)' }, '2026-10-23');
        chk('G-4168', '2026H2', 'water', '2026-10-20', '확정', false, null, '2026-10-21');
        chk('G-4166', '2026H2', 'water', '2026-11-10', '등록완료', false);
        chk('G-4165', '2026H2', 'water', '2026-10-28', '확정', false, null, '2026-10-30');
        chk('G-4164', '2026H2', 'water', '2026-10-28', '확정', false, null, '2026-10-30');
        chk('G-4167', '2026H2', 'safety', '2026-11-12', '작성중', false);
        chk('G-4172', '2026H2', 'safety', '2026-10-19', '확정', false, null, '2026-10-20');
        chk('G-4171', '2026H2', 'hlth', '2026-10-21', '확정', false, null, '2026-10-23');
        /* M-2·M-3·M-4 하반기 점검표는 미작성 — 진행 중인 공사의 지금 할 일 */
        /* 도급사업 위험성평가 실시 확인 — 작업 시작 전 최초 1장 + 작업이 바뀔 때 수시 */
        risk('M-1', '최초', 'con', '2026-02-27', '확정', '2026-02-27');
        risk('M-1', '수시-1', 'con', '2026-07-21', '확정', '2026-07-22');   /* 우기 배수로 작업 추가 */
        risk('M-2', '최초', 'water', '2026-05-29', '확정', '2026-05-29');
        risk('M-3', '최초', 'water', '2026-09-15', '확정', '2026-09-16');
        risk('M-4', '최초', 'cul', '2026-10-16', '등록완료');
        risk('G-4173', '최초', 'water', '2026-08-13', '확정', '2026-08-13');
        risk('G-4170', '최초', 'water', '2026-07-29', '확정', '2026-07-30');
        risk('G-4169', '최초', 'water', '2026-07-27', '확정', '2026-07-28');
        risk('G-4168', '최초', 'water', '2026-07-21', '확정', '2026-07-21');
        risk('G-4166', '최초', 'water', '2026-07-08', '확정', '2026-07-09');
        risk('G-4165', '최초', 'water', '2026-07-03', '확정', '2026-07-06');
        risk('G-4167', '최초', 'safety', '2026-07-09', '확정', '2026-07-10');
        /* 수급인 안전보건 수준 평가(F6) — 업체 단위. 연구·검토 용역 업체 2곳은 아직 미평가 */
        const sc = (a) => { const o = {}; a.forEach((v, i) => { o[i] = { v: v, note: '' }; }); return o; };
        const F6 = (who, date, co, scores, opinion, status) => {
            const L = LINES[who];
            const d = { status: status || '확정', fields: { date: date, subject: co, items: sc(scores), opinion: opinion },
                history: [{ at: date + ' 11:00', ev: '등록 (작성자: ' + L.by + ')' }] };
            if (d.status === '확정') { d.history.push({ at: date + ' 16:10', ev: '확정 · 온나라 결재 상신' }); d.approval = Object.assign({ sample: true }, L); d.docNo = '온나라-2026-' + (5100 + (++seq) * 7); }
            return d;
        };
        D['EDOC-수급인평가-(주)태성기술개발'] = F6('water', '2026-08-05', '(주)태성기술개발', ['5 (우수)', '4', '4', '4'], '안전보건관리체계·교육 양호. 정밀점검 현장 비상연락망 보완 권고.');
        D['EDOC-수급인평가-주식회사 길성이앤시'] = F6('water', '2026-08-04', '주식회사 길성이앤시', ['4', '4', '3 (보통)', '4'], '적격. 신규 투입자 교육 기록 보관 권고.');
        D['EDOC-수급인평가-(주)대림환경'] = F6('water', '2026-07-15', '(주)대림환경', ['4', '3 (보통)', '4', '3 (보통)'], '적격. 폐기물 상차 작업 신호수 배치 확인.');
        D['EDOC-수급인평가-(주)우리종합기술'] = F6('water', '2026-08-19', '(주)우리종합기술', ['4', '5 (우수)', '4', '4'], '적격.');
        D['EDOC-수급인평가-(주)우진엔지니어링'] = F6('water', '2026-07-24', '(주)우진엔지니어링', ['4', '4', '4', '3 (보통)'], '적격. 지하수 관정 작업 추락 방지 조치 확인.');
        D['EDOC-수급인평가-(주)진성기술단'] = F6('water', '2026-07-08', '(주)진성기술단', ['4', '4', '3 (보통)', '4'], '적격.');
        D['EDOC-수급인평가-(주)금성환경산업'] = F6('safety', '2026-11-11', '(주)금성환경산업', ['3 (보통)', '4', '미평가', '미평가'], '', '등록완료');
        /* 조직 — 2026 상반기 수행평가 후속조치(F7) */
        D['EDOC-후속조치-2026H1'] = { status: '확정', fields: { source: '2026 상반기 안전보건관리책임자등 수행평가',
                action: '우수 관리감독자 2명(건설과 정안전·물순환사업소 문정수) 하반기 포상 추천 · 평가 «보통» 항목(안전점검 기록 관리)은 하반기 교육에 반영',
                due: '2026-08-31', owner: '재난안전과 · 안전관리 주무관 / 박안전', checker: '재난안전과장 홍길동' },
            history: [{ at: '2026-07-20 10:00', ev: '등록 (작성자: 박안전)' }, { at: '2026-07-22 14:30', ev: '확정 · 온나라 결재 상신' }],
            approval: Object.assign({ sample: true }, LINES.safety), docNo: '온나라-2026-' + (5100 + (++seq) * 7) };
        return D;
    }
    function seedImps() {
        return [
            { id: 'IMP-2611', title: '도로 보수 현장 야간 작업 경광등 추가 배치', sourceMenu: '의견청취', sourceDoc: 'OPN-22',
              owner: '건설과 · 안전관리팀장 / 정안전', due: '2026-11-27', status: '진행', created: '2026-11-06 10:10',
              history: [{ at: '2026-11-06 10:10', ev: '접수 — 의견청취 자동 유입' }, { at: '2026-11-07 09:30', ev: '계획 처리 — 구간 시작·끝 경광등 각 1대 추가, 일몰 30분 전 점등' },
                        { at: '2026-11-11 15:00', ev: '진행 처리 — 경광등 4대 구매 요청(11-20 납품 예정)' }] },
            { id: 'IMP-2608', title: '동절기 방한 보호구 11월 중 지급', sourceMenu: '의견청취', sourceDoc: 'OPN-21',
              owner: '재난안전과 · 안전관리 주무관 / 박안전', due: '2026-11-20', status: '진행', created: '2026-10-30 09:40',
              history: [{ at: '2026-10-30 09:40', ev: '접수 — 의견청취 자동 유입' }, { at: '2026-11-02 10:00', ev: '계획 처리 — 현장 근무자 86명 방한장갑·방한화 지급' },
                        { at: '2026-11-09 11:20', ev: '진행 처리 — 구매 요청 완료(11-18 납품 예정)' }] },
            { id: 'IMP-2602', title: '안전보건관리 준수 서약서 수령 — 고서공공하수처리시설 외 1개소 정기안전점검용역', sourceMenu: '도급관리 · 반기',
              sourceDoc: '2026 하반기 도급사업 안전보건 점검표 — 2026년 고서공공하수처리시설 외 1개소 하반기 정기안전점검용역 시행',
              owner: '물순환사업소 · 주무관 / 하정수', due: '2026-10-31', status: '종결', created: '2026-10-23 15:40',
              history: [{ at: '2026-10-23 15:40', ev: '접수 — 도급관리 · 반기 자동 유입' }, { at: '2026-10-24 09:00', ev: '계획 처리' }, { at: '2026-10-24 09:05', ev: '진행 처리' },
                        { at: '2026-10-29 14:00', ev: '완료확인 처리 — 서약서 원본 수령(10-29)' }, { at: '2026-10-30 10:00', ev: '종결 처리' }] },
        ];
    }
    function loadSeeded(key, make) {
        let v = null;
        try { v = JSON.parse(localStorage.getItem(key)); } catch (e) { v = null; }
        if (v == null) { v = make(); save(key, v); }
        return v;
    }
    /* v2 — 2026-11-13 기준 예시 자료를 처음 한 번 싣는다(아래 seedDocs·seedImps). 키를 올려 옛 빈 저장분을 버린다. */
    const S = {
        docs() { return loadSeeded('dy-edoc-v2', seedDocs); },
        saveDoc(id, inst) { const all = this.docs(); all[id] = inst; save('dy-edoc-v2', all); },
        imps() { return loadSeeded('dy-imp-v2', seedImps); },
        saveImps(list) { save('dy-imp-v2', list); },
        ntfs() { return load('dy-ntf-v1', []); },
        pushNtf(n) { const l = this.ntfs(); l.unshift(n); save('dy-ntf-v1', l.slice(0, 50)); },
    };

    const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const clone = v => JSON.parse(JSON.stringify(v || []));

    /* 양식 마스터는 새 문서에만 적용한다. 기존 문서는 생성 당시 항목 스냅숏으로 연다. */
    function freezeChecklist(idPrefix, checklist) {
        const all = S.docs();
        let changed = false;
        Object.keys(all).forEach(id => {
            if (id.indexOf(idPrefix) !== 0 || all[id].checklistSnapshot) return;
            all[id].checklistSnapshot = clone(checklist);
            changed = true;
        });
        if (changed) save('dy-edoc-v2', all);
    }

    /* ── 알림 발송 시뮬레이션 (COM-008) ── */
    function notify(msg, channel) {
        S.pushNtf({ at: now(), channel: channel || '문자', msg });
        V().toast((channel || '문자') + ' 알림 발송 — ' + msg);
    }

    /* ── 개선조치 스토어 (전 메뉴 → 개선조치 자동 유입) ── */
    const IMP_FLOW = ['접수', '계획', '진행', '완료확인', '종결'];
    function addImprovement(o) {
        const list = S.imps();
        const imp = {
            id: 'IMP-' + String(list.length + 1 + 100),
            title: o.title, sourceMenu: o.sourceMenu || '-', sourceDoc: o.sourceDoc || '',
            owner: o.owner || '미지정', due: o.due || '', status: '접수', created: now(), history: [{ at: now(), ev: '접수 — ' + (o.sourceMenu || '') + ' 자동 유입' }],
        };
        list.unshift(imp);
        S.saveImps(list);
        return imp;
    }
    function advanceImprovement(id) {
        const list = S.imps();
        const imp = list.find(x => x.id === id);
        if (!imp) return;
        const i = IMP_FLOW.indexOf(imp.status);
        if (i < IMP_FLOW.length - 1) {
            imp.status = IMP_FLOW[i + 1];
            imp.history.push({ at: now(), ev: imp.status + ' 처리' });
            S.saveImps(list);
        }
    }

    /* ── 온나라 결재 요청 팝업 (컨펌: 안내 팝업 1회) ── */
    /* ── 결재선 — 공용 조각 하나만 쓴다 (CLAUDE.md §7-1) ──────────────────
     * 종전에는 이 모듈이 결재선을 **글자로만** 갖고 있었다("팀장 → 과장 → 부군수").
     * 담당자에게 한 번도 묻지 않은 값을 상신했다고 말한 셈이고, 온나라로 넘길 계정
     * 식별자도 만들 수 없었다. 이제 조직도에서 고르고 uid 로 보관한다.
     * 전자문서 폼(F1~F7)과 그 폼을 부르는 화면(경영방침 점검표·도급 점검표 등)이 공유한다. */
    /* ── 조작 권한 (CLAUDE.md §12 · 2026-08-28 검수 B-2) ────────────────
     * **상신은 기안 행위다.** 결재선을 붙인 뒤로는 조회 전용 계층이 상신을 누르면
     * 그 사람이 기안자로 온나라 결재선에 올라간다. 그래서 상신 경로만 담당자로
     * 좁힌다 — 화면 전체를 조회 전용으로 만드는 것은 §12 2단계(발주처 정책 확정 후)라
     * 여기서 하지 않는다. 판정은 DYROLE.canAct() 단일 출처. */
    function canDraft() { return !window.DYROLE || window.DYROLE.canAct(''); }
    /* 이력의 작성자는 **로그인 계정**이다 — '박안전' 고정이면 누가 등록했든 같은 이름이 남는다 */
    function actorName() { return (window.DYROLE && DYROLE.current) ? DYROLE.current().name : '담당자'; }
    const DRAFT_DENY = '상신은 <b>담당자</b>가 합니다 — 관리·감독 계층은 조회만 합니다.';

    let lnRedraw = null;                                   /* 결재선만 다시 그린다 — 폼 전체를 재렌더하지 않는다 */
    const LN = (window.DYDOC && window.DYDOC.approvalLine)
        ? window.DYDOC.approvalLine({
            ns: 'EDOCLN', key: 'dy-edoc-apprline-v1',
            onChange: () => { if (lnRedraw) lnRedraw(); },
        })
        : null;
    if (LN) window.EDOCLN = LN;

    /* 확정(=상신) 직전에만 결재선을 묻는다 — 작성중에는 아직 물을 단계가 아니다.
       확정된 뒤에는 그 문서에 실제로 실린 결재선을 조회로만 보여준다. */
    function lineBlock(saved, mountId) {
        if (!LN) return '';
        if (saved.status === '확정') {
            return saved.approval
                ? '<div class="edoc-linkcard">결재선 — ' + esc(saved.approval.lineText) + '</div>'
                : '';
        }
        if (saved.status !== '등록완료') return '';
        return '<div id="' + mountId + '">' + LN.lineEditorHtml() + '</div>';
    }
    function lineWire(mountId) {
        if (!LN) return;
        lnRedraw = () => {
            const el = document.getElementById(mountId);
            if (el) el.innerHTML = LN.lineEditorHtml();
        };
    }

    /* 결재선 값을 그대로 보여준다 — 고정 문구를 쓰지 않는다. 팝업·이력·지면이
       같은 값 하나를 읽어야 어긋나지 않는다(SCR-EDOC-008 §6). */
    /* 문서번호를 **돌려준다** — 화면이 「진행 상황은 온나라에서 문서번호로 확인하세요」라고
       안내하는데 그 번호가 팝업에만 있고 저장되지 않아 다시 볼 수 없었다(검수 E).
       호출부가 반환값을 그 문서에 실어 둔다. 실제 채번은 온나라 몫이다. */
    function onnaraPopup(docTitle, after, snap) {
        const no = '온나라-2026-' + String(Math.floor(1000 + (docTitle.length * 137) % 9000));
        const lineTxt = (snap && snap.lineText) || (LN ? LN.lineText() : '');
        V().openModal('온나라 결재 요청',
            '<div style="text-align:center; padding:8px 4px 4px;">' +
            '<p style="font-size:14px; font-weight:700; margin-bottom:6px;">온나라로 결재 요청을 보냈습니다</p>' +
            /* 상신 직후 돌려받는 값은 **연계 번호**다 — «문서번호»(생산등록번호)는 결재가 끝나야 생긴다(CLAUDE.md §7-1 2026-10-07). */
            '<p style="font-size:12px; color:var(--text-gray);">' + esc(docTitle) + '<br>연계 번호 <b>' + no + '</b>' +
                (lineTxt ? '<br>결재선: ' + esc(lineTxt) : '') + '</p>' +
            '<p style="font-size:12px; color:var(--text-gray); margin-top:8px;">진행 상황은 온나라에서 확인합니다.</p>' +
            '</div>',
            '<button class="btn btn-primary" onclick="DYV2.closeModal();' + (after ? after : '') + '">확인</button>');
        return no;
    }

    /* ── 필드 렌더 ── */
    function fieldHtml(f, val, ctx) {
        const v = val == null ? '' : val;
        const dis = f.readonly ? ' readonly style="background:var(--gray-50);"' : '';
        switch (f.type) {
            case 'textarea':
                return '<textarea data-k="' + f.k + '" placeholder="' + esc(f.ph || '') + '"' + dis + '>' + esc(v) + '</textarea>';
            case 'date':
                return '<input type="date" data-k="' + f.k + '" value="' + esc(v || '2026-06-11') + '"' + dis + '>';
            case 'number':
                return '<input type="number" data-k="' + f.k + '" value="' + esc(v) + '"' + dis + '>';
            case 'select':
                return '<select data-k="' + f.k + '">' + (f.options || []).map(o =>
                    '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>';
            case 'file': {
                const drop = V().uploadDrop(
                    (v ? esc(v) : '파일을 끌어다 놓거나 클릭하여 첨부 (다중 가능)'),
                    "DYV2.notReady('파일 첨부', '문서관리 연계')",
                    { style: 'padding:14px;', hint: true });
                /* SFR-005: 파일별 설명·관리 목록 (ctx.attachList 제공 시) */
                let list = '';
                if (ctx && ctx.attachList && ctx.attachList.length) {
                    list = '<div class="attach-list"><div class="attach-list-head">첨부파일 목록</div>' +
                        '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>파일명</th><th>파일 설명</th><th>등록일</th><th>관리</th></tr></thead><tbody>' +
                        ctx.attachList.map(a => '<tr><td>' + esc(a.name) + '</td><td>' + esc(a.desc || '') + '</td><td>' + esc(a.date || '') + '</td>' +
                            '<td><button type="button" class="btn btn-sm btn-outline" onclick="DYV2.notReady(\'파일 설명 수정\', \'문서관리 연계\')">설명 수정</button> ' +
                            '<button type="button" class="btn btn-sm btn-outline" onclick="DYV2.notReady(\'파일 삭제\', \'문서관리 연계\')">삭제</button></td></tr>').join('') +
                        '</tbody></table></div></div>';
                }
                return drop + list;
            }
            case 'checklist': {
                const items = (ctx && ctx.checklist) || T.CHECKLIST_PRESETS.default;
                const saved = v || {};
                const oxBtns = (cur) => '<span class="edoc-chk-btns">' +
                    ['O', 'X', '해당없음'].map(o =>
                        '<button type="button" class="edoc-ox' + (cur.v === o ? ' on' + (o === 'X' ? ' x' : '') : '') + '" data-v="' + o + '">' + o + '</button>').join('') +
                    '</span>';
                return '<div data-k="' + f.k + '" class="edoc-checklist">' + items.map((it, i) => {
                    const cur = saved[i] || {};
                    /* 레거시: 문자열 항목 → 기존 O/X 행 그대로 (다른 메뉴 호환) */
                    if (!it || typeof it !== 'object') {
                        return '<div class="edoc-chk-row" data-i="' + i + '" data-type="ox">' +
                            '<span class="edoc-chk-label">' + esc(it) + '</span>' +
                            oxBtns(cur) +
                            '<input type="text" class="edoc-chk-note" placeholder="비고 / X 사유" value="' + esc(cur.note || '') + '">' +
                            '</div>';
                    }
                    /* 신규: 객체 항목 → 영역·결과유형·근거 표시 + 유형별 입력 분기 (SFR-005) */
                    const type = it.type || 'O/X';
                    const head = '<div class="edoc-chk-head">' +
                        (it.area ? '<span class="chip-mini wt">' + esc(it.area) + '</span>' : '') +
                        '<span class="edoc-chk-label">' + esc(it.item) + '</span>' +
                        '<span class="chip-mini ' + (type === '텍스트' ? 'wt-elec' : 'st-done') + '">' + esc(type) + '</span>' +
                        '</div>' +
                        (it.basis ? lawTag(it.basis) : '');
                    if (type === '텍스트') {
                        return '<div class="edoc-chk-row rich" data-i="' + i + '" data-type="text">' + head +
                            '<textarea class="edoc-chk-text" placeholder="점검 결과를 입력하세요">' + esc(cur.text || '') + '</textarea>' +
                            '</div>';
                    }
                    return '<div class="edoc-chk-row rich" data-i="' + i + '" data-type="ox">' + head +
                        '<div class="edoc-chk-oxline">' + oxBtns(cur) +
                        '<input type="text" class="edoc-chk-note" placeholder="비고 및 판단 근거" value="' + esc(cur.note || '') + '"></div>' +
                        '</div>';
                }).join('') +
                '<p style="font-size:12px; color:var(--status-danger-fg); margin-top:6px;">X 판정 항목은 확정 시 개선조치로 자동 등록됩니다.</p></div>';
            }
            case 'scorelist': {
                const items = (ctx && ctx.scorelist) || T.SCORE_PRESETS.default;
                const saved = v || {};
                return '<div data-k="' + f.k + '" class="edoc-scorelist">' + items.map((it, i) => {
                    const cur = saved[i] || {};
                    return '<div class="edoc-chk-row" data-i="' + i + '">' +
                        '<span class="edoc-chk-label">' + esc(it) + '</span>' +
                        '<select class="edoc-score">' + ['미평가', '5 (우수)', '4', '3 (보통)', '2', '1 (미흡)'].map(o =>
                            '<option' + (o === (cur.v || '미평가') ? ' selected' : '') + '>' + o + '</option>').join('') + '</select>' +
                        '<input type="text" class="edoc-chk-note" placeholder="의견" value="' + esc(cur.note || '') + '">' +
                        '</div>';
                }).join('') + '</div>';
            }
            case 'orgpicker': {
                const pid = 'edoc-pick-' + f.k;
                return '<div class="orgpick-field">' +
                    '<div style="display:flex; gap:8px; align-items:center;">' +
                    '<input type="text" id="' + pid + '" data-k="' + f.k + '" value="' + esc(v) + '" placeholder="[조직도]에서 점검자를 선택하세요" readonly style="flex:1; background:var(--surface-alt);">' +
                    '<button type="button" class="btn btn-sm btn-outline" onclick="EDOC.openOrgTree(\'' + pid + '\')">조직도</button>' +
                    '</div>' +
                    '</div>';
            }
            default:
                return '<input type="text" data-k="' + f.k + '" placeholder="' + esc(f.ph || '') + '" value="' + esc(v) + '"' + dis + '>';
        }
    }

    function collect(formEl, formDef) {
        const out = {};
        formDef.fields.forEach(f => {
            if (f.type === 'checklist' || f.type === 'scorelist') {
                const wrap = formEl.querySelector('[data-k="' + f.k + '"]');
                const o = {};
                wrap.querySelectorAll('.edoc-chk-row').forEach(row => {
                    const i = row.getAttribute('data-i');
                    if (row.getAttribute('data-type') === 'text') {
                        const ta = row.querySelector('.edoc-chk-text');
                        o[i] = { text: ta ? ta.value : '' };
                        return;
                    }
                    const on = row.querySelector('.edoc-ox.on');
                    const sel = row.querySelector('.edoc-score');
                    const note = row.querySelector('.edoc-chk-note');
                    o[i] = { v: on ? on.getAttribute('data-v') : (sel ? sel.value : ''), note: note ? note.value : '' };
                });
                out[f.k] = o;
            } else if (f.type !== 'file') {
                const el = formEl.querySelector('[data-k="' + f.k + '"]');
                if (el) out[f.k] = el.value;
            }
        });
        return out;
    }

    const ST_CHIP = {
        '작성중': '<span class="chip-mini wt">작성중</span>',
        '등록완료': '<span class="chip-mini wt-elec">등록완료</span>',
        '확정': '<span class="chip-mini st-done">확정 · 온나라 상신</span>',
    };

    /* ── 메인: 폼 모달 열기 ──
     * opts: { id, title, form(F1~F7), ctx{checklist, scorelist, menuLabel}, source(연동 표시),
     *         fields(초기값), onFix(확정 후 콜백 코드 문자열 아님 — 함수) }
     */
    function openForm(opts) {
        const formDef = T.FORMS[opts.form];
        const id = opts.id || ('EDOC-' + opts.title);
        const stored = S.docs()[id];
        const saved = stored || { status: '작성중', fields: opts.fields || {}, history: [] };
        if (!saved.checklistSnapshot && opts.ctx && opts.ctx.checklist) saved.checklistSnapshot = clone(opts.ctx.checklist);
        const renderCtx = Object.assign({}, opts.ctx || {});
        if (saved.checklistSnapshot) renderCtx.checklist = saved.checklistSnapshot;

        const fixed = saved.status === '확정';
        const body =
            '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:14px;">' +
                '<span class="chip-mini pdca">' + formDef.name + '</span>' + (ST_CHIP[saved.status] || '') +
                (renderCtx.menuLabel ? '<span class="chip-mini wt">' + esc(renderCtx.menuLabel) + '</span>' : '') +
            '</div>' +
            (opts.source ?
                '<div class="edoc-linkcard">연동 정보 — ' + opts.source + '</div>' : '') +
            '<div class="preset-form-grid" id="edoc-form">' +
                formDef.fields.map(f =>
                    '<span class="k">' + esc(f.label) + '</span>' + fieldHtml(f, saved.fields[f.k], renderCtx)
                ).join('') +
            '</div>' +
            lineBlock(saved, 'edoc-lnmount') +
            (saved.history.length ?
                '<div class="edoc-history"><p class="edoc-history-title">처리 이력</p>' +
                saved.history.map(h => '<div class="edoc-history-row"><span>' + h.at + '</span>' + esc(h.ev) + '</div>').join('') +
                '</div>' : '');

        const foot = fixed
            ? '<button class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
              '<button class="btn btn-outline" onclick="DYV2.notReady(\'문서 개정\', \'문서관리 연계\')">개정</button>'
            : '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
              '<button class="btn btn-outline" id="edoc-save">임시저장</button>' +
              (saved.status === '작성중'
                ? '<button class="btn btn-primary" id="edoc-submit">등록</button>'
                : (canDraft() ? '<button class="btn btn-primary" id="edoc-fix">확정 · 온나라 결재 상신</button>'
                              : '<span class="file-hint">' + DRAFT_DENY + '</span>'));

        V().openModal(esc(opts.title), body, foot);
        lineWire('edoc-lnmount');

        /* 체크리스트 O/X 토글 */
        document.querySelectorAll('#edoc-form .edoc-ox').forEach(b => {
            b.addEventListener('click', () => {
                b.parentElement.querySelectorAll('.edoc-ox').forEach(x => x.classList.remove('on', 'x'));
                b.classList.add('on');
                if (b.getAttribute('data-v') === 'X') b.classList.add('x');
            });
        });

        function persist(status, ev) {
            const formEl = document.getElementById('edoc-form');
            saved.fields = Object.assign(saved.fields, collect(formEl, formDef));
            saved.status = status;
            saved.history.push({ at: now(), ev });
            S.saveDoc(id, saved);
        }
        const btnSave = document.getElementById('edoc-save');
        if (btnSave) btnSave.addEventListener('click', () => {
            persist(saved.status, '임시저장');
            V().closeModal(); V().toast('임시저장되었습니다 — 작성중 상태로 유지');
            if (opts.onChange) opts.onChange(saved);
        });
        const btnSubmit = document.getElementById('edoc-submit');
        if (btnSubmit) btnSubmit.addEventListener('click', () => {
            persist('등록완료', '등록 (작성자: ' + actorName() + ')');
            V().closeModal(); V().toast('등록되었습니다 — 확정 전까지 수정 가능');
            if (opts.onChange) opts.onChange(saved);
        });
        const btnFix = document.getElementById('edoc-fix');
        if (btnFix) btnFix.addEventListener('click', () => {
            /* 확정 = 상신이므로 결재선 규칙을 여기서 막는다. 확정은 되돌릴 수 없으니
               통과시킨 뒤 상신만 실패하는 상태를 만들면 안 된다. */
            if (!canDraft()) { V().toast('확정·상신은 담당자가 합니다 — 관리·감독 계층은 조회만 합니다.'); return; }
            if (LN && LN.lineDenied()) return;
            const snap = LN ? LN.snapshot() : null;
            persist('확정', '확정 · 온나라 결재 상신');
            if (snap) { saved.approval = snap; S.saveDoc(id, saved); }
            /* 점검표 X 항목 → 개선조치 자동 생성 (내부 데이터 연계 114건의 핵심 패턴) */
            let createdImps = 0;
            formDef.fields.filter(f => f.type === 'checklist').forEach(f => {
                const items = renderCtx.checklist || T.CHECKLIST_PRESETS.default;
                Object.entries(saved.fields[f.k] || {}).forEach(([i, r]) => {
                    if (r.v === 'X') {
                        addImprovement({ title: (items[i] && typeof items[i] === 'object' ? items[i].item : items[i]) + (r.note ? ' — ' + r.note : ''), sourceMenu: (opts.ctx && opts.ctx.menuLabel) || '점검', sourceDoc: opts.title, due: impDue() });
                        createdImps++;
                    }
                });
            });
            V().closeModal();
            const docNo = onnaraPopup(opts.title, '', snap);
            saved.docNo = docNo; S.saveDoc(id, saved);
            if (createdImps) setTimeout(() => V().toast('X 항목 ' + createdImps + '건이 개선조치로 자동 등록되었습니다'), 600);
            if (opts.onChange) opts.onChange(saved);
        });
    }

    /* data.js 문서(전자문서·이행)에서 바로 열기 */
    function openForDoc(docId) {
        const d = V().docs().find(x => x.id === docId);
        if (!d) return;
        openForm({
            id: d.id, title: d.name, form: T.formForDoc(d),
            ctx: { menuLabel: d.daemenu + ' · ' + d.cycle, checklist: T.CHECKLIST_PRESETS.default },
        });
    }

    function statusOf(id) {
        const inst = S.docs()[id];
        return inst ? inst.status : null;
    }

    /* ── 인라인 폼 렌더 (상세 페이지 좌측 패널에서 모달 없이 폼 표시·저장) ──
     * container 에 폼을 그리고 임시저장/등록/확정 버튼을 와이어링한다. 상태 전이 후 자기 자신을 다시 그린다.
     */
    function renderInline(container, opts) {
        const formDef = T.FORMS[opts.form];
        const id = opts.id || ('EDOC-' + opts.title);
        const stored = S.docs()[id];
        const saved = stored || { status: '작성중', fields: opts.fields || {}, history: [] };
        if (!saved.checklistSnapshot && opts.ctx && opts.ctx.checklist) saved.checklistSnapshot = clone(opts.ctx.checklist);
        const renderCtx = Object.assign({}, opts.ctx || {});
        if (saved.checklistSnapshot) renderCtx.checklist = saved.checklistSnapshot;
        const fixed = saved.status === '확정';

        const foot = fixed
            ? '<button class="btn btn-outline" data-act="revise">개정</button>'
            : '<button class="btn btn-outline" data-act="save">임시저장</button>' +
              (saved.status === '작성중'
                ? '<button class="btn btn-primary" data-act="submit">등록</button>'
                : (canDraft() ? '<button class="btn btn-primary" data-act="fix">확정 · 온나라 결재 상신</button>'
                              : '<span class="file-hint">' + DRAFT_DENY + '</span>'));

        container.innerHTML =
            '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:14px;">' +
                '<span class="chip-mini pdca">' + formDef.name + '</span>' + (ST_CHIP[saved.status] || '') +
                (renderCtx.menuLabel ? '<span class="chip-mini wt">' + esc(renderCtx.menuLabel) + '</span>' : '') +
            '</div>' +
            (opts.source ? '<div class="edoc-linkcard">연동 정보 — ' + opts.source + '</div>' : '') +
            '<div class="preset-form-grid edoc-form-grid">' +
                formDef.fields.map(f => '<span class="k">' + esc(f.label) + '</span>' + fieldHtml(f, saved.fields[f.k], renderCtx)).join('') +
            '</div>' +
            lineBlock(saved, 'edoc-lnmount-inline') +
            (saved.history.length
                ? '<div class="edoc-history"><p class="edoc-history-title">처리 이력</p>' +
                  saved.history.map(h => '<div class="edoc-history-row"><span>' + h.at + '</span>' + esc(h.ev) + '</div>').join('') + '</div>'
                : '') +
            '<div class="edoc-inline-foot">' + foot + '</div>';
        lineWire('edoc-lnmount-inline');

        const grid = container.querySelector('.edoc-form-grid');
        grid.querySelectorAll('.edoc-ox').forEach(b => b.addEventListener('click', () => {
            b.parentElement.querySelectorAll('.edoc-ox').forEach(x => x.classList.remove('on', 'x'));
            b.classList.add('on');
            if (b.getAttribute('data-v') === 'X') b.classList.add('x');
        }));

        function persist(status, ev) {
            saved.fields = Object.assign(saved.fields, collect(grid, formDef));
            saved.status = status;
            saved.history.push({ at: now(), ev });
            S.saveDoc(id, saved);
        }
        function rerender() { renderInline(container, opts); if (opts.onChange) opts.onChange(saved); }
        const act = a => container.querySelector('[data-act="' + a + '"]');
        if (act('save')) act('save').addEventListener('click', () => { persist(saved.status, '임시저장'); V().toast('임시저장되었습니다'); rerender(); });
        if (act('submit')) act('submit').addEventListener('click', () => { persist('등록완료', '등록 (작성자: ' + actorName() + ')'); V().toast('등록되었습니다 — 확정 전까지 수정 가능'); rerender(); });
        if (act('revise')) act('revise').addEventListener('click', () => V().notReady('문서 개정', '문서관리 연계'));
        if (act('fix')) act('fix').addEventListener('click', () => {
            if (!canDraft()) { V().toast('확정·상신은 담당자가 합니다 — 관리·감독 계층은 조회만 합니다.'); return; }
            if (LN && LN.lineDenied()) return;        /* 확정 = 상신 — 결재선 규칙을 여기서 막는다 */
            const snap = LN ? LN.snapshot() : null;
            persist('확정', '확정 · 온나라 결재 상신');
            if (snap) { saved.approval = snap; S.saveDoc(id, saved); }
            let created = 0;
            formDef.fields.filter(f => f.type === 'checklist').forEach(f => {
                const items = renderCtx.checklist || T.CHECKLIST_PRESETS.default;
                Object.entries(saved.fields[f.k] || {}).forEach(([i, r]) => {
                    if (r.v === 'X') { addImprovement({ title: (items[i] && typeof items[i] === 'object' ? items[i].item : items[i]) + (r.note ? ' — ' + r.note : ''), sourceMenu: (opts.ctx && opts.ctx.menuLabel) || '점검', sourceDoc: opts.title, due: impDue() }); created++; }
                });
            });
            const docNo = onnaraPopup(opts.title, '', snap);
            saved.docNo = docNo; S.saveDoc(id, saved);
            if (created) setTimeout(() => V().toast('X 항목 ' + created + '건이 개선조치로 자동 등록되었습니다'), 600);
            rerender();
        });
    }
    function formFor(d) { return T.formForDoc(d); }

    /* ── 조직도 트리 (점검자 선택) — 입력 아래 인라인 패널(별도 모달 없음, 단일 모달 규칙) ──
     *   조직도 데이터는 단일 출처(DYV2.ORG)에서 파생한다. 자체 하드코딩 금지.
     *   common.js 가 edoc.js 보다 먼저 로드되므로 IIFE 초기화 시점에 orgFlat() 조회 가능. */
    const ORG_TREE = (window.DYV2 && window.DYV2.orgFlat) ? window.DYV2.orgFlat() : [];
    function renderOrgTree(selectedVal) {
        return '<div class="org-tree-root">담양군청</div>' +
            ORG_TREE.map(d =>
                '<div class="otr-dept" data-dept="' + esc(d.dept) + '">' +
                '<button type="button" class="otr-deptbtn" onclick="EDOC._orgToggle(this)"><span class="otr-arrow">▸</span> ' + esc(d.dept) + ' <span class="otr-count">' + d.members.length + '명</span></button>' +
                '<div class="otr-members">' +
                d.members.map(m => {
                    const val = d.dept + ' · ' + m[0] + ' / ' + m[1];
                    const on = selectedVal && selectedVal === val ? ' on' : '';
                    return '<button type="button" class="otr-member' + on + '" onclick="EDOC.pickOrgMember(this,\'' + esc(d.dept) + '\',\'' + esc(m[0]) + '\',\'' + esc(m[1]) + '\')"><span class="otr-role">' + esc(m[0]) + '</span><span class="otr-name">' + esc(m[1]) + '</span></button>';
                }).join('') +
                '</div></div>'
            ).join('');
    }
    /* 입력 바로 아래에 인라인 트리 토글 — 별도 모달 없음(단일 모달 규칙). 같은 입력에 열려 있으면 닫는다. */
    function openOrgTree(targetId) {
        const inp = document.getElementById(targetId);
        if (!inp) return;
        const field = inp.closest('.orgpick-field') || inp.parentElement;
        const existing = field.querySelector(':scope > .org-inline');
        if (existing) { existing.remove(); return; }
        const panel = document.createElement('div');
        panel.className = 'org-inline';
        panel.setAttribute('data-target', targetId);
        panel.style.marginTop = '8px';
        panel.innerHTML =
            '<div class="org-inline-search"><input type="text" placeholder="부서·이름 검색" oninput="EDOC._orgFilter(this)"></div>' +
            '<div class="org-inline-body">' + renderOrgTree(inp.value) + '</div>';
        field.appendChild(panel);
        const cur = panel.querySelector('.otr-member.on');
        const dept = cur ? cur.closest('.otr-dept') : panel.querySelector('.otr-dept');
        if (dept) { const mm = dept.querySelector('.otr-members'); if (mm) mm.style.display = 'block'; const ar = dept.querySelector('.otr-arrow'); if (ar) ar.textContent = '▾'; }
        panel.scrollIntoView({ block: 'nearest' });
    }
    function orgToggle(btn) {
        const m = btn.nextElementSibling; if (!m) return;
        const open = m.style.display === 'block';
        m.style.display = open ? 'none' : 'block';
        const ar = btn.querySelector('.otr-arrow'); if (ar) ar.textContent = open ? '▸' : '▾';
    }
    function pickOrgMember(btnEl, dept, role, name) {
        const panel = btnEl.closest('.org-inline'); if (!panel) return;
        const tid = panel.getAttribute('data-target');
        const inp = tid ? document.getElementById(tid) : null;
        if (inp) inp.value = dept + ' · ' + role + ' / ' + name;
        panel.remove();   // 선택 후 인라인 트리 닫기
        V().toast('점검자 선택: ' + dept + ' ' + role + ' ' + name);
    }
    function orgFilter(inputEl) {
        const panel = inputEl && inputEl.closest ? inputEl.closest('.org-inline') : null;
        const scope = panel || document;
        const q = ((inputEl && inputEl.value) || '').trim();
        scope.querySelectorAll('.otr-dept').forEach(dept => {
            const dn = dept.getAttribute('data-dept') || '';
            let any = false;
            dept.querySelectorAll('.otr-member').forEach(mb => {
                const show = !q || dn.indexOf(q) !== -1 || mb.textContent.indexOf(q) !== -1;
                mb.style.display = show ? '' : 'none';
                if (show) any = true;
            });
            dept.style.display = (!q || any) ? '' : 'none';
            if (q && any) { const m = dept.querySelector('.otr-members'); if (m) m.style.display = 'block'; const ar = dept.querySelector('.otr-arrow'); if (ar) ar.textContent = '▾'; }
        });
    }

    /* ── 관련 법령 도움말 — ⓘ 호버 시 뷰포트 고정 툴팁(모달·오버플로에 안 잘림) ── */
    function lawTag(basis) {
        return '<span class="edoc-chk-basis" data-basis="' + esc(basis) + '" tabindex="0" role="button" aria-label="관련 법령 상세" onmouseenter="EDOC.lawTipShow(this)" onmouseleave="EDOC.lawTipHide()" onfocus="EDOC.lawTipShow(this)" onblur="EDOC.lawTipHide()">관련 근거 · ' + esc(basis) + ' <span class="law-i">\u24d8</span></span>';
    }
    function lawTipHide() { const t = document.getElementById('law-tip-float'); if (t) t.remove(); }
    function lawTipShow(el) {
        lawTipHide();
        const basis = el.getAttribute('data-basis');
        /* 1순위 기존 요약 사전, 2순위 DYLAW 조문 원문 스냅샷 (js/law-map.js) */
        let d = (T.LAW_DICT || {})[basis];
        let src = '';
        if (!d && window.DYLAW) {
            const key = DYLAW.resolveBasis(basis);
            const a = key && DYLAW.article(key);
            if (a) {
                const L = DYLAW.law(a.law) || {};
                d = { law: L.name || '', art: a.jo, clause: a.clause || '', title: a.title, text: a.text };
                src = '법제처 원문 · 시행 ' + (L.efYd || '-');
            }
        }
        const tip = document.createElement('div');
        tip.id = 'law-tip-float'; tip.className = 'law-tip-float';
        tip.innerHTML = d
            ? '<div class="law-tip-ref">' + esc(d.law) + ' <b>' + esc(d.art) + (d.clause ? ' ' + esc(d.clause) : '') + '</b></div><div class="law-tip-title">' + esc(d.title) + '</div><div class="law-tip-text">' + esc(d.text) + '</div>' + (src ? '<div class="law-tip-src">' + esc(src) + '</div>' : '')
            : '<div class="law-tip-text">' + esc(basis) + ' — 상세 조문 정보가 아직 등록되지 않았습니다.</div>';
        document.body.appendChild(tip);
        const r = el.getBoundingClientRect();
        const tw = tip.offsetWidth, th = tip.offsetHeight;
        let left = r.left, top = r.bottom + 8;
        if (left + tw > window.innerWidth - 10) left = window.innerWidth - tw - 10;
        if (top + th > window.innerHeight - 10) top = r.top - th - 8;
        tip.style.left = Math.max(8, left) + 'px';
        tip.style.top = Math.max(8, top) + 'px';
    }
    /* 하위호환: 옛 클릭 호출은 호버로 대체되어 무시 */
    function lawInfo() {}
    function closeLawInfo() { lawTipHide(); }

    window.EDOC = { openForm, openForDoc, renderInline, formFor, onnaraPopup, notify, addImprovement, advanceImprovement, IMP_FLOW, improvements: () => S.imps(), saveImps: l => S.saveImps(l), statusOf, ntfs: () => S.ntfs(), freezeChecklist, STCHIP: ST_CHIP, ORG_TREE, openOrgTree, pickOrgMember, _orgToggle: orgToggle, _orgFilter: orgFilter, lawTag, lawTipShow, lawTipHide, lawInfo, closeLawInfo };
})();
