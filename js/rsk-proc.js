/* =====================================================================
   rsk-proc.js · 작업공정 관리 (PRC01-L v2.2)
   ---------------------------------------------------------------------
   · 컴팩트 칩 VIEW + 카드당 [수정] 하나 → 카드 내부 인라인 편집
   · 설비/유해인자 = 카드 내 .stack-inline 검색·다중선택 (PRC03-M 인라인)
   · 유해위험요인 = 공정∪설비∪유해인자 병렬 합집합 자동 로드 + 가감 + [직접](PRC04-M)
   · 확정 폐지: 저장 즉시 활성. [반영] 시 설비/작업방법 델타 → 수시평가 확인 모달
   [CLAUDE.md] 모달은 DYV2.openModal/closeModal 만. 부가 선택은 적층 모달 대신 인라인 패널.
   조직도(담당 평가자)는 DYV2.orgFlat() 단일 출처.
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYRSK; };
    var KO = function () { return global.DYRSK.KOSHA; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }

    var state = { targetId: 'f_jns', mount: null, edit: null, panel: null };
    // edit = { pid|'NEW', isNew, work:{name,desc,evaluator,equip:[],hf:[],hrf:[{name,category,basis,source,legal_status,on}]}, orig:{name,desc,equip:[],insHas} }
    // panel = { kind:'equip'|'hf', sel:{}, q }

    function managers() {
        var re = /(과장|팀장|소장|실장|담당|관리자)/, out = [];
        (V().orgFlat() || []).forEach(function (d) {
            d.members.forEach(function (m) { if (re.test(m[0])) out.push(d.dept + ' · ' + m[0] + ' / ' + m[1]); });
        });
        return out;
    }

    /* ================= 렌더 ================= */
    function render() {
        if (!state.mount) return;
        var t = KO().targetOf(state.targetId);
        var procs = D().processes(state.targetId);
        var head =
            '<div class="rp-toolbar">' +
                '<div class="rp-tb-left">' +
                    '<label class="rp-tb-label">관리대상</label>' +
                    '<select class="form-select" id="rp-target" onchange="RSKPROC.setTarget(this.value)">' +
                        KO().TARGETS.map(function (x) {
                            return '<option value="' + x.id + '"' + (x.id === state.targetId ? ' selected' : '') + '>' + esc(x.name) + ' · ' + esc(x.dept) + '</option>';
                        }).join('') +
                    '</select>' +
                    '<span class="rp-tb-meta">업종 ' + esc(t ? t.industry : '-') + ' · 공정 ' + procs.length + '건</span>' +
                '</div>' +
                '<div class="rp-tb-right">' +
                    '<button type="button" class="btn btn-primary" onclick="RSKPROC.addNew()">＋ 공정 추가</button>' +
                '</div>' +
            '</div>';

        var body;
        if (state.edit && state.edit.isNew) {
            // 신규 편집 카드는 목록 최상단
            body = renderEditCard(null) + procs.map(cardHtml).join('');
        } else if (procs.length === 0) {
            body = '<div class="v2-empty">등록된 공정이 없습니다. ＋ 공정 추가로 등록하세요.</div>';
        } else {
            body = procs.map(cardHtml).join('');
        }
        state.mount.innerHTML = head + body;
    }

    function cardHtml(p) {
        if (state.edit && state.edit.pid === p.id) return renderEditCard(p);
        return renderView(p);
    }

    function chip(text, tone) { return '<span class="chip-status ' + tone + '">' + text + '</span>'; }

    function renderView(p) {
        var eqs = p.equip.map(function (id) { return KO().equipName(id); });
        var hfs = p.hf.map(function (id) { return KO().hfName(id); });
        var chips = '';
        eqs.slice(0, 4).forEach(function (n) { chips += '<span class="rp-chip rp-chip-eq">' + esc(n) + '</span>'; });
        hfs.slice(0, 4).forEach(function (n) { chips += '<span class="rp-chip rp-chip-hf">' + esc(n) + '</span>'; });
        (p.hrf || []).slice(0, 3).forEach(function (h) { chips += '<span class="rp-chip hrf">' + esc(h.name) + '</span>'; });
        var extra = (eqs.length + hfs.length + (p.hrf || []).length) - Math.min(4, eqs.length) - Math.min(4, hfs.length) - Math.min(3, (p.hrf || []).length);
        if (extra > 0) chips += '<span class="rp-chip">＋' + extra + '</span>';
        if (!chips) chips = '<span class="rp-none">설비·유해인자·유해위험요인 없음 — [수정]으로 추가</span>';

        return '<section class="rp-card"><div class="rp-view">' +
            '<div class="rp-view-main">' +
                '<div class="rp-view-title"><span class="rp-seq">' + (p.seq || '-') + '</span>' + esc(p.name) +
                    ' ' + (p.source === 'STD' ? chip('표준', 'info') : chip('직접', 'neutral')) + '</div>' +
                '<div class="rp-view-meta">담당 평가자 ' +
                    (p.evaluator ? esc(p.evaluator) : '<span class="rp-warn">미지정</span>') +
                    ' · 설비 ' + p.equip.length + ' · 유해인자 ' + p.hf.length + ' · 유해위험요인 ' + (p.hrf || []).length +
                    (p.desc ? ' · ' + esc(p.desc) : '') + '</div>' +
                '<div class="rp-view-chips">' + chips + '</div>' +
            '</div>' +
            '<div class="rp-view-act">' +
                '<button type="button" class="rp-tbtn" onclick="RSKPROC.editCard(\'' + p.id + '\')">수정</button>' +
                '<button type="button" class="rp-tbtn danger" onclick="RSKPROC.askDelete(\'' + p.id + '\')">삭제</button>' +
            '</div>' +
        '</div></section>';
    }

    /* ---- EDIT 카드 ---- */
    function renderEditCard(p) {
        var w = state.edit.work, isNew = state.edit.isNew;
        var mgrs = managers();
        var eqChips = w.equip.length
            ? w.equip.map(function (id) { return '<span class="rp-echip">' + esc(KO().equipName(id)) + '<button type="button" onclick="RSKPROC.removeEquip(\'' + id + '\')">×</button></span>'; }).join('')
            : '<span class="rp-none">없음</span>';
        var hfChips = w.hf.length
            ? w.hf.map(function (id) { return '<span class="rp-echip">' + esc(KO().hfName(id)) + '<span class="rp-chip-cat">' + esc(KO().hfCat(id)) + '</span><button type="button" onclick="RSKPROC.removeHf(\'' + id + '\')">×</button></span>'; }).join('')
            : '<span class="rp-none">없음</span>';

        var hrfRows = w.hrf.length
            ? w.hrf.map(function (h, i) {
                var badge = h.source === 'STD' ? '<span class="src-badge kosha">표준</span>' : (h.source === 'INSPECTION' ? '<span class="src-badge ins">점검</span>' : '<span class="src-badge manual">직접</span>');
                var legal = (h.legal_status === 'MAPPED' && h.basis) ? '<span class="rp-hrf-legal">' + esc(h.basis) + '</span>' : '<span class="rp-pending">법령 매핑 대기</span>';
                return '<div class="rp-hrf' + (h.on ? '' : ' off') + '">' +
                    '<input type="checkbox"' + (h.on ? ' checked' : '') + ' onchange="RSKPROC.toggleHrf(' + i + ',this.checked)"> ' +
                    '<span class="rp-hrf-name">' + esc(h.name) + '</span> ' + badge + legal +
                    '<span class="rp-hrf-tail"><button type="button" class="rp-tbtn danger" onclick="RSKPROC.removeHrf(' + i + ')">삭제</button></span>' +
                '</div>';
            }).join('')
            : '<div class="rp-none">유해위험요인이 없습니다. 공정·설비·유해인자를 선택하면 자동 로드됩니다.</div>';

        var panelHtml = state.panel ? renderPanel() : '';

        return '<section class="rp-card editing">' +
            '<div class="rp-edit-head"><b>' + (isNew ? '공정 추가' : '공정 편집') + '</b>' +
                '<div><button type="button" class="rp-tbtn" onclick="RSKPROC.cancelEdit()">취소</button> ' +
                '<button type="button" class="btn btn-primary btn-sm" onclick="RSKPROC.apply()">반영</button></div></div>' +
            '<div class="rp-edit-body">' +
                '<div class="rp-grid3">' +
                    '<div class="rp-frow"><label class="form-label">공정명 <span class="rp-req">*</span></label>' +
                        '<input type="text" class="form-input" id="rp-name" value="' + esc(w.name) + '" placeholder="예: 청사 전기설비 점검" oninput="RSKPROC.onName(this.value)"></div>' +
                    '<div class="rp-frow"><label class="form-label">담당 평가자 (관리감독자) <span class="rp-req">*</span></label>' +
                        '<select class="form-select" id="rp-eval" onchange="RSKPROC.onEval(this.value)"><option value="">-- 선택 --</option>' +
                            mgrs.map(function (m) { return '<option value="' + esc(m) + '"' + (w.evaluator === m ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join('') +
                        '</select></div>' +
                '</div>' +
                '<div class="rp-frow"><label class="form-label">공정 설명</label>' +
                    '<input type="text" class="form-input" id="rp-desc" value="' + esc(w.desc) + '" placeholder="작업 방법·절차 요약" oninput="RSKPROC.onDesc(this.value)"></div>' +

                '<div class="rp-sec">' +
                    '<div class="rp-sec-head"><span class="rp-sec-title">설비<span class="rp-cnt">' + w.equip.length + '</span></span>' +
                        '<button type="button" class="rp-sel" onclick="RSKPROC.openPanel(\'equip\')">＋ 설비 선택</button></div>' +
                    '<div class="rp-view-chips">' + eqChips + '</div>' +
                    (state.panel && state.panel.kind === 'equip' ? panelHtml : '') +
                '</div>' +

                '<div class="rp-sec">' +
                    '<div class="rp-sec-head"><span class="rp-sec-title">유해인자<span class="rp-cnt">' + w.hf.length + '</span></span>' +
                        '<button type="button" class="rp-sel" onclick="RSKPROC.openPanel(\'hf\')">＋ 유해인자 선택</button></div>' +
                    '<div class="rp-view-chips">' + hfChips + '</div>' +
                    (state.panel && state.panel.kind === 'hf' ? panelHtml : '') +
                '</div>' +

                '<div class="rp-sec">' +
                    '<div class="rp-sec-head"><span class="rp-sec-title">유해위험요인 (병렬 합집합)<span class="rp-cnt">' + w.hrf.filter(function (h) { return h.on; }).length + '</span></span>' +
                        '<button type="button" class="rp-sel" onclick="RSKPROC.addDirect()">＋ 직접 추가</button></div>' +
                    '<div class="rp-hrf-list">' + hrfRows + '</div>' +
                    (state.panel && state.panel.kind === 'direct' ? panelHtml : '') +
                '</div>' +
            '</div>' +
        '</section>';
    }

    /* ---- 인라인 선택 패널 (.stack-inline) ---- */
    function renderPanel() {
        if (state.panel.kind === 'direct') {
            return '<div class="stack-inline" style="margin-top:10px;">' +
                '<div class="rp-frow"><label class="form-label">요인명 <span class="rp-req">*</span></label>' +
                    '<input type="text" class="form-input" id="rp-dname" placeholder="예: 회전체 접촉 끼임"></div>' +
                '<div class="rp-grid3">' +
                    '<div class="rp-frow"><label class="form-label">분류</label><select class="form-select" id="rp-dcat">' +
                        KO().CATS.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select></div>' +
                    '<div class="rp-frow"><label class="form-label">출처</label><select class="form-select" id="rp-dsrc">' +
                        '<option value="MANUAL">직접 추가</option><option value="INSPECTION">점검(INS) 유입</option></select></div>' +
                '</div>' +
                '<div class="rp-frow"><label class="form-label">법령근거</label>' +
                    '<input type="text" class="form-input" id="rp-dbasis" placeholder="미입력 시 법령 매핑 대기"></div>' +
                '<div style="display:flex;justify-content:flex-end;gap:8px;">' +
                    '<button type="button" class="rp-tbtn" onclick="RSKPROC.closePanel()">취소</button>' +
                    '<button type="button" class="btn btn-primary btn-sm" onclick="RSKPROC.saveDirect()">추가</button></div>' +
            '</div>';
        }
        var isEq = state.panel.kind === 'equip';
        var master = isEq ? KO().EQUIP : KO().HF;
        return '<div class="stack-inline" style="margin-top:10px;">' +
            '<input type="text" class="form-input" placeholder="' + (isEq ? '설비' : '유해인자') + '명 검색" oninput="RSKPROC.panelSearch(this.value)">' +
            '<div class="rp-pick-list" id="rp-pick">' + panelList(master) + '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;">' +
                '<span class="rp-hint">선택됨 <b id="rp-pick-n">' + selCount() + '</b>개</span>' +
                '<span><button type="button" class="rp-tbtn" onclick="RSKPROC.closePanel()">취소</button> ' +
                '<button type="button" class="btn btn-primary btn-sm" onclick="RSKPROC.applyPanel()">적용</button></span></div>' +
        '</div>';
    }
    function panelList(master) {
        var q = (state.panel.q || '').trim();
        var ids = Object.keys(master).filter(function (id) { return !q || master[id].name.indexOf(q) !== -1; });
        if (!ids.length) return '<div class="rp-none" style="padding:12px;text-align:center;">일치 항목 없음</div>';
        return ids.map(function (id) {
            var m = master[id], on = !!state.panel.sel[id];
            return '<label class="rp-pick-item' + (on ? ' on' : '') + '">' +
                '<input type="checkbox"' + (on ? ' checked' : '') + ' onchange="RSKPROC.panelToggle(\'' + id + '\',this.checked)"> ' +
                esc(m.name) + '<span class="rp-pick-cat">' + esc(m.group || m.category) + '</span></label>';
        }).join('');
    }
    function selCount() { return Object.keys(state.panel.sel).filter(function (k) { return state.panel.sel[k]; }).length; }

    /* ================= 편집 진입/취소 ================= */
    function setTarget(id) { state.edit = null; state.panel = null; state.targetId = id; render(); }

    function cloneWork(p) {
        return {
            name: p ? p.name : '', desc: p ? p.desc : '', evaluator: p ? p.evaluator : '',
            equip: p ? p.equip.slice() : [], hf: p ? p.hf.slice() : [],
            hrf: p ? (p.hrf || []).map(function (h) { return { name: h.name, category: h.category, basis: h.basis, source: h.source, legal_status: h.legal_status, on: true }; }) : []
        };
    }
    function editCard(pid) {
        var p = D().processOf(pid);
        state.panel = null;
        state.edit = { pid: pid, isNew: false, work: cloneWork(p), orig: { name: p.name, desc: p.desc, equip: p.equip.slice(), insHas: (p.hrf || []).some(function (h) { return h.source === 'INSPECTION'; }) } };
        render();
    }
    function addNew() {
        state.panel = null;
        state.edit = { pid: 'NEW', isNew: true, work: cloneWork(null), orig: { name: '', desc: '', equip: [], insHas: false } };
        render();
    }
    function cancelEdit() { state.edit = null; state.panel = null; render(); }

    function onName(v) { state.edit.work.name = v; }
    function onDesc(v) { state.edit.work.desc = v; }
    function onEval(v) { state.edit.work.evaluator = v; }

    /* ================= 설비/유해인자 인라인 선택 ================= */
    function openPanel(kind) {
        var w = state.edit.work;
        state.panel = { kind: kind, sel: {}, q: '' };
        (kind === 'equip' ? w.equip : w.hf).forEach(function (id) { state.panel.sel[id] = true; });
        render();
    }
    function addDirect() { state.panel = { kind: 'direct' }; render(); }
    function closePanel() { state.panel = null; render(); }
    function panelSearch(v) {
        state.panel.q = v;
        var host = document.getElementById('rp-pick');
        if (host) host.innerHTML = panelList(state.panel.kind === 'equip' ? KO().EQUIP : KO().HF);
    }
    function panelToggle(id, on) {
        if (on) state.panel.sel[id] = true; else delete state.panel.sel[id];
        var n = document.getElementById('rp-pick-n'); if (n) n.textContent = selCount();
        var lbl = document.querySelector('#rp-pick input[onchange*="\'' + id + '\'"]');
        if (lbl) lbl.closest('.rp-pick-item').classList.toggle('on', on);
    }
    function applyPanel() {
        var w = state.edit.work, kind = state.panel.kind;
        var sel = Object.keys(state.panel.sel).filter(function (k) { return state.panel.sel[k]; });
        if (kind === 'equip') w.equip = sel; else w.hf = sel;
        state.panel = null;
        recomputeAuto();  // 병렬 합집합 재계산 (신규 표준 요인 추가)
        render();
        toast((kind === 'equip' ? '설비' : '유해인자') + ' ' + sel.length + '개 반영 · 유해위험요인 자동 합산');
    }
    /* 공정∪설비∪유해인자 자동매핑 → work.hrf 에 표준 후보 병합(중복 제외, 사용자 항목 보존) */
    function recomputeAuto() {
        var w = state.edit.work;
        var cand = D().autoMapHRF(state.targetId, w.name, w.equip, w.hf);
        var have = {}; w.hrf.forEach(function (h) { have[h.name] = true; });
        cand.forEach(function (c) { if (!have[c.name]) { w.hrf.push({ name: c.name, category: c.category, basis: c.basis, source: 'STD', legal_status: c.legal_status, on: true }); have[c.name] = true; } });
    }

    /* ================= 유해위험요인 가감/직접 ================= */
    function toggleHrf(i, on) { state.edit.work.hrf[i].on = on; render(); }
    function removeHrf(i) { state.edit.work.hrf.splice(i, 1); render(); }
    function removeEquip(id) { state.edit.work.equip = state.edit.work.equip.filter(function (x) { return x !== id; }); recomputeAuto(); render(); }
    function removeHf(id) { state.edit.work.hf = state.edit.work.hf.filter(function (x) { return x !== id; }); render(); }
    function saveDirect() {
        var name = (document.getElementById('rp-dname').value || '').trim();
        if (!name) { toast('요인명을 입력하세요.'); return; }
        var cat = document.getElementById('rp-dcat').value;
        var src = document.getElementById('rp-dsrc').value;
        var basis = (document.getElementById('rp-dbasis').value || '').trim();
        state.edit.work.hrf.push({ name: name, category: cat, basis: basis, source: src, legal_status: basis ? 'MAPPED' : 'PENDING', on: true });
        state.panel = null; render();
        toast(src === 'INSPECTION' ? '점검 유입 유해위험요인 추가' : '유해위험요인 추가');
    }

    /* ================= [반영] 저장 + 수시평가 트리거 ================= */
    function apply() {
        var w = state.edit.work;
        if (!w.name.trim()) { toast('공정명을 입력하세요.'); return; }
        if (!w.evaluator) { toast('담당 평가자를 지정하세요.'); return; }
        var hrf = w.hrf.filter(function (h) { return h.on; }).map(function (h) {
            return { id: D().nextHrfId(), name: h.name, category: h.category, basis: h.basis, source: h.source, legal_status: h.legal_status };
        });

        if (state.edit.isNew) {
            D().addProcess({ targetId: state.targetId, name: w.name.trim(), desc: w.desc.trim(), evaluator: w.evaluator, source: 'MANUAL', equip: w.equip, hf: w.hf, hrf: hrf });
            state.edit = null; render();
            toast('공정이 추가되었습니다. (최초 등록 — 다음 정기/최초 평가에 포함)');
            return;
        }

        var p = D().processOf(state.edit.pid);
        var o = state.edit.orig;
        // 델타 판정 (법정 수시평가 사유만)
        var equipChanged = o.equip.join(',') !== w.equip.join(',');
        var workChanged = o.name !== w.name.trim() || o.desc !== w.desc.trim();
        var insAdded = !o.insHas && hrf.some(function (h) { return h.source === 'INSPECTION'; });
        var reasons = [];
        if (equipChanged) reasons.push('설비 변경');
        if (workChanged) reasons.push('작업방법·절차 변경');
        if (insAdded) reasons.push('점검 발견 유해위험요인');

        // 저장
        p.name = w.name.trim(); p.desc = w.desc.trim(); p.evaluator = w.evaluator;
        p.equip = w.equip; p.hf = w.hf; p.hrf = hrf; p.revision_no = (p.revision_no || 1) + 1;
        D().saveProcess(p);
        var pid = p.id;
        state.edit = null; render();

        if (reasons.length) { confirmOccasional(pid, reasons); }
        else { toast('공정이 저장되었습니다. (유해위험요인 정리 — 수시평가 사유 아님)'); }
    }

    function confirmOccasional(pid, reasons) {
        var p = D().processOf(pid);
        var reasonText = reasons.join(' · ');
        V().openModal('수시 위험성평가 생성',
            '<p>변경으로 <b>수시 위험성평가</b>를 생성합니다. 진행할까요?</p>' +
            '<div style="margin-top:10px;padding:10px 12px;background:var(--page-bg);border-radius:var(--radius-button);font-size:13px;">' +
                '<div>대상 공정: <b>' + esc(p.name) + '</b></div>' +
                '<div style="margin-top:4px;">변경 사유: <b>' + esc(reasonText) + '</b></div></div>' +
            '<p class="rp-hint" style="margin-top:8px;">근거: 「사업장 위험성평가에 관한 지침」제15조 — 설비·작업방법 변경, 점검 발견은 수시평가 사유입니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="RSKPROC.createOccasional(\'' + pid + '\',\'' + esc(reasonText) + '\')">수시평가 생성</button>');
    }
    function createOccasional(pid, reasonText) {
        var p = D().processOf(pid);
        // 열린 수시 draft 있으면 공정 추가, 없으면 신규
        var open = D().assessments(state.targetId).filter(function (a) { return a.type === 'OCCASIONAL' && a.status === 'IN_PROGRESS'; })[0];
        if (open) {
            if (open.changed_processes.indexOf(pid) === -1) open.changed_processes.push(pid);
            open.change_reason = (open.change_reason ? open.change_reason + ' / ' : '') + reasonText + ': ' + p.name;
            D().saveImprovement();
        } else {
            open = D().addAssessment({ targetId: state.targetId, year: 2026, type: 'OCCASIONAL', scope: 'CHANGES_ONLY',
                title: '수시 — ' + reasonText, change_reason: reasonText + ': ' + p.name, changed_processes: [pid],
                method: '4x4', team: [], worker_participation: false });
        }
        V().closeModal();
        toast('수시 위험성평가가 생성되었습니다. 위험성평가 목록에서 확인하세요.');
    }

    function askDelete(pid) {
        var p = D().processOf(pid); if (!p) return;
        V().openModal('공정 삭제',
            '<p><b>' + esc(p.name) + '</b> 공정을 삭제하시겠습니까?</p><p class="rp-hint">진행 중인 위험성평가가 참조하는 공정이면 영향이 있을 수 있습니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="RSKPROC.doDelete(\'' + pid + '\')">삭제</button>');
    }
    function doDelete(pid) { D().deleteProcess(pid); V().closeModal(); render(); toast('공정이 삭제되었습니다.'); }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        render();
    }

    global.RSKPROC = {
        init: init, setTarget: setTarget,
        addNew: addNew, editCard: editCard, cancelEdit: cancelEdit, apply: apply,
        onName: onName, onDesc: onDesc, onEval: onEval,
        openPanel: openPanel, closePanel: closePanel, panelSearch: panelSearch, panelToggle: panelToggle, applyPanel: applyPanel,
        addDirect: addDirect, saveDirect: saveDirect,
        toggleHrf: toggleHrf, removeHrf: removeHrf, removeEquip: removeEquip, removeHf: removeHf,
        askDelete: askDelete, doDelete: doDelete,
        confirmOccasional: confirmOccasional, createOccasional: createOccasional
    };
})(window);
