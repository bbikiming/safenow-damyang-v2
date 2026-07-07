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
    function onnaraPopup(docTitle, after) {
        const no = '온나라-2026-' + String(Math.floor(1000 + (docTitle.length * 137) % 9000));
        V().openModal('온나라 결재 요청',
            '<div style="text-align:center; padding:8px 4px 4px;">' +
            '<p style="font-size:14px; font-weight:700; margin-bottom:6px;">온나라로 결재 요청을 보냈습니다</p>' +
            '<p style="font-size:12px; color:var(--text-gray);">' + esc(docTitle) + '<br>문서번호 <b>' + no + '</b> · 결재선: 팀장 → 과장 → 부군수</p>' +
            '<p style="font-size:12px; color:var(--text-gray); margin-top:8px;">결재 완료 시 문서 상태가 자동으로 갱신됩니다. (연계 시뮬레이션)</p>' +
            '</div>',
            '<button class="btn btn-primary" onclick="DYV2.closeModal();' + (after ? after : '') + '">확인</button>');
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
                const drop = '<div class="upload-drop" style="padding:14px;" onclick="DYV2.toast(\'파일 첨부 (프로토타입 — 다중 가능)\')">' +
                    (v ? esc(v) : '파일을 끌어다 놓거나 클릭하여 첨부 (다중 가능)') + '</div>' +
                    (V().fileHint ? V().fileHint() : '');
                /* SFR-005: 파일별 설명·관리 목록 (ctx.attachList 제공 시) */
                let list = '';
                if (ctx && ctx.attachList && ctx.attachList.length) {
                    list = '<div class="attach-list"><div class="attach-list-head">첨부파일 목록</div>' +
                        '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>파일명</th><th>파일 설명</th><th>등록일</th><th>관리</th></tr></thead><tbody>' +
                        ctx.attachList.map(a => '<tr><td>' + esc(a.name) + '</td><td>' + esc(a.desc || '') + '</td><td>' + esc(a.date || '') + '</td>' +
                            '<td><button type="button" class="btn btn-sm btn-outline" onclick="DYV2.toast(\'파일 설명 수정 (프로토타입)\')">설명 수정</button> ' +
                            '<button type="button" class="btn btn-sm btn-outline" onclick="DYV2.toast(\'파일 삭제 (프로토타입)\')">삭제</button></td></tr>').join('') +
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
                    '<input type="text" id="' + pid + '" data-k="' + f.k + '" value="' + esc(v) + '" placeholder="[조직도]에서 점검자를 선택하세요" readonly style="flex:1; background:var(--gray-50,#fafafa);">' +
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
        const saved = S.docs()[id] || { status: '작성중', fields: opts.fields || {}, history: [] };

        const fixed = saved.status === '확정';
        const body =
            '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:14px;">' +
                '<span class="chip-mini pdca">' + formDef.name + '</span>' + (ST_CHIP[saved.status] || '') +
                (opts.ctx && opts.ctx.menuLabel ? '<span class="chip-mini wt">' + esc(opts.ctx.menuLabel) + '</span>' : '') +
            '</div>' +
            (opts.source ?
                '<div class="edoc-linkcard">연동 정보 — ' + opts.source + '</div>' : '') +
            '<div class="preset-form-grid" id="edoc-form">' +
                formDef.fields.map(f =>
                    '<span class="k">' + esc(f.label) + '</span>' + fieldHtml(f, saved.fields[f.k], opts.ctx)
                ).join('') +
            '</div>' +
            (saved.history.length ?
                '<div class="edoc-history"><p class="edoc-history-title">처리 이력</p>' +
                saved.history.map(h => '<div class="edoc-history-row"><span>' + h.at + '</span>' + esc(h.ev) + '</div>').join('') +
                '</div>' : '');

        const foot = fixed
            ? '<button class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
              '<button class="btn btn-outline" onclick="DYV2.toast(\'개정 — 새 버전이 작성중 상태로 생성됩니다 (프로토타입)\')">개정</button>'
            : '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
              '<button class="btn btn-outline" id="edoc-save">임시저장</button>' +
              (saved.status === '작성중'
                ? '<button class="btn btn-primary" id="edoc-submit">등록</button>'
                : '<button class="btn btn-primary" id="edoc-fix">확정 · 온나라 결재 상신</button>');

        V().openModal(esc(opts.title), body, foot);

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
            persist('등록완료', '등록 (작성자: 박안전)');
            V().closeModal(); V().toast('등록되었습니다 — 확정 전까지 수정 가능');
            if (opts.onChange) opts.onChange(saved);
        });
        const btnFix = document.getElementById('edoc-fix');
        if (btnFix) btnFix.addEventListener('click', () => {
            persist('확정', '확정 · 온나라 결재 상신');
            /* 점검표 X 항목 → 개선조치 자동 생성 (내부 데이터 연계 114건의 핵심 패턴) */
            let createdImps = 0;
            formDef.fields.filter(f => f.type === 'checklist').forEach(f => {
                const items = (opts.ctx && opts.ctx.checklist) || T.CHECKLIST_PRESETS.default;
                Object.entries(saved.fields[f.k] || {}).forEach(([i, r]) => {
                    if (r.v === 'X') {
                        addImprovement({ title: (items[i] && typeof items[i] === 'object' ? items[i].item : items[i]) + (r.note ? ' — ' + r.note : ''), sourceMenu: (opts.ctx && opts.ctx.menuLabel) || '점검', sourceDoc: opts.title, due: '2026-07-31' });
                        createdImps++;
                    }
                });
            });
            V().closeModal();
            onnaraPopup(opts.title);
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
        const saved = S.docs()[id] || { status: '작성중', fields: opts.fields || {}, history: [] };
        const fixed = saved.status === '확정';

        const foot = fixed
            ? '<button class="btn btn-outline" data-act="revise">개정</button>'
            : '<button class="btn btn-outline" data-act="save">임시저장</button>' +
              (saved.status === '작성중'
                ? '<button class="btn btn-primary" data-act="submit">등록</button>'
                : '<button class="btn btn-primary" data-act="fix">확정 · 온나라 결재 상신</button>');

        container.innerHTML =
            '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:14px;">' +
                '<span class="chip-mini pdca">' + formDef.name + '</span>' + (ST_CHIP[saved.status] || '') +
                (opts.ctx && opts.ctx.menuLabel ? '<span class="chip-mini wt">' + esc(opts.ctx.menuLabel) + '</span>' : '') +
            '</div>' +
            (opts.source ? '<div class="edoc-linkcard">연동 정보 — ' + opts.source + '</div>' : '') +
            '<div class="preset-form-grid edoc-form-grid">' +
                formDef.fields.map(f => '<span class="k">' + esc(f.label) + '</span>' + fieldHtml(f, saved.fields[f.k], opts.ctx)).join('') +
            '</div>' +
            (saved.history.length
                ? '<div class="edoc-history"><p class="edoc-history-title">처리 이력</p>' +
                  saved.history.map(h => '<div class="edoc-history-row"><span>' + h.at + '</span>' + esc(h.ev) + '</div>').join('') + '</div>'
                : '') +
            '<div class="edoc-inline-foot">' + foot + '</div>';

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
        if (act('submit')) act('submit').addEventListener('click', () => { persist('등록완료', '등록 (작성자: 박안전)'); V().toast('등록되었습니다 — 확정 전까지 수정 가능'); rerender(); });
        if (act('revise')) act('revise').addEventListener('click', () => V().toast('개정 — 새 버전이 작성중 상태로 생성됩니다 (프로토타입)'));
        if (act('fix')) act('fix').addEventListener('click', () => {
            persist('확정', '확정 · 온나라 결재 상신');
            let created = 0;
            formDef.fields.filter(f => f.type === 'checklist').forEach(f => {
                const items = (opts.ctx && opts.ctx.checklist) || T.CHECKLIST_PRESETS.default;
                Object.entries(saved.fields[f.k] || {}).forEach(([i, r]) => {
                    if (r.v === 'X') { addImprovement({ title: (items[i] && typeof items[i] === 'object' ? items[i].item : items[i]) + (r.note ? ' — ' + r.note : ''), sourceMenu: (opts.ctx && opts.ctx.menuLabel) || '점검', sourceDoc: opts.title, due: '2026-07-31' }); created++; }
                });
            });
            onnaraPopup(opts.title);
            if (created) setTimeout(() => V().toast('X 항목 ' + created + '건이 개선조치로 자동 등록되었습니다'), 600);
            rerender();
        });
    }
    function formFor(d) { return T.formForDoc(d); }

    /* ── 조직도 트리 (점검자 선택) — 입력 아래 인라인 패널(별도 모달 없음, 단일 모달 규칙) ── */
    const ORG_TREE = [
        { dept: '재난안전과', members: [['재난안전과장', '홍길동'], ['중대재해팀장', '김안전'], ['안전관리담당', '박담당']] },
        { dept: '건설과', members: [['건설과장', '이건설'], ['안전관리자', '박현장']] },
        { dept: '환경과', members: [['환경과장', '정환경'], ['보건관리자', '최보건']] },
        { dept: '보건소', members: [['보건소장', '강보건'], ['보건담당', '윤담당']] },
        { dept: '공공시설사업소', members: [['소장', '임시설'], ['안전담당', '한담당']] },
        { dept: '물순환사업소', members: [['소장', '오순환'], ['시설담당', '서담당']] },
    ];
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
        const d = (T.LAW_DICT || {})[basis];
        const tip = document.createElement('div');
        tip.id = 'law-tip-float'; tip.className = 'law-tip-float';
        tip.innerHTML = d
            ? '<div class="law-tip-ref">' + esc(d.law) + ' <b>' + esc(d.art) + (d.clause ? ' ' + esc(d.clause) : '') + '</b></div><div class="law-tip-title">' + esc(d.title) + '</div><div class="law-tip-text">' + esc(d.text) + '</div>'
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

    window.EDOC = { openForm, openForDoc, renderInline, formFor, onnaraPopup, notify, addImprovement, advanceImprovement, IMP_FLOW, improvements: () => S.imps(), saveImps: l => S.saveImps(l), statusOf, ntfs: () => S.ntfs(), STCHIP: ST_CHIP, ORG_TREE, openOrgTree, pickOrgMember, _orgToggle: orgToggle, _orgFilter: orgFilter, lawTag, lawTipShow, lawTipHide, lawInfo, closeLawInfo };
})();
