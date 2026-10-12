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
    const T = window.EDOC_T;
    const V = () => window.DYV2;

    /* ── 스토어 ── */
    function load(key, def) { try { return JSON.parse(localStorage.getItem(key)) || def; } catch (e) { return def; } }
    function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
    const S = {
        docs() { return load('dy-edoc-v1', {}); },
        saveDoc(id, inst) { const all = this.docs(); all[id] = inst; save('dy-edoc-v1', all); },
        imps() { return load('dy-imp-v1', []); },
        saveImps(list) { save('dy-imp-v1', list); },
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
        if (changed) save('dy-edoc-v1', all);
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
            '<p style="font-size:12px; color:var(--text-gray);">' + esc(docTitle) + '<br>문서번호 <b>' + no + '</b>' +
                (lineTxt ? '<br>결재선: ' + esc(lineTxt) : '') + '</p>' +
            '<p style="font-size:12px; color:var(--text-gray); margin-top:8px;">결재 완료·반려는 온나라에서 회신됩니다 — 진행 상황은 온나라에서 문서번호로 확인하세요. (연계 시뮬레이션)</p>' +
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
                        addImprovement({ title: (items[i] && typeof items[i] === 'object' ? items[i].item : items[i]) + (r.note ? ' — ' + r.note : ''), sourceMenu: (opts.ctx && opts.ctx.menuLabel) || '점검', sourceDoc: opts.title, due: '2026-07-31' });
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
                    if (r.v === 'X') { addImprovement({ title: (items[i] && typeof items[i] === 'object' ? items[i].item : items[i]) + (r.note ? ' — ' + r.note : ''), sourceMenu: (opts.ctx && opts.ctx.menuLabel) || '점검', sourceDoc: opts.title, due: '2026-07-31' }); created++; }
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
