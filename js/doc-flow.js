/* =====================================================================
   doc-flow.js · 공문 기안 → 미리보기 → 온나라 상신 **공용 골격** (전역 DYDOC)
   ---------------------------------------------------------------------
   이 시스템의 공문은 **한 골격만** 쓴다. 도메인(위험성평가·안전보건교육·…)은
   `DYDOC.define(cfg)` 로 **지면 내용과 저장 위치만** 얹는다.
   시연 투어가 `DYTOUR` 하나로 모인 것과 같은 구조다(CLAUDE.md §4-3 선례).

   ── 순서는 골격이 강제한다 (MUST) ─────────────────────────────────
     [공문 기안] → 본문 작성 → [문서 미리보기 →] → [온나라로 결재 상신] → 확인 → [상신]
   **기안 폼에는 상신 수단을 두지 않는다.** 발주처가 교육의 결재 상신을 지우게 한 이유가
   기능이 아니라 "공문 작성 단계 없이 결재만 올라가는 순서"였다(2026-07-30 회의).
   도메인이 이 순서를 건너뛸 수 없도록 골격이 화면을 나눠 그린다.

   ── 지면은 표준 공문 서식이다 ─────────────────────────────────────
   「행정업무의 운영 및 혁신에 관한 규정 시행규칙」 별지 제1호서식(기안문/시행문).
   전 행정기관 공통이라 담양군 고유 양식이 따로 없다. 다만 **이 규정을 근거 칩으로
   인용하지 않는다** — DYLAW 스냅샷에 없다(§10). 서식을 따르는 것과 조문을 인용하는
   것은 다른 문제다. 내부결재와 외부발송은 지면이 실제로 다르므로 합치지 않는다.
   큰 표는 본문이 아니라 **붙임 별지**로 뺀다.

   ── 확인 단계는 새 정보만 낸다 ────────────────────────────────────
   미리보기에서 이미 본 문서·붙임·결재선을 확인 화면에서 반복하지 않는다. 확인이
   필요한 이유는 **되돌릴 수 없다는 사실**(문서번호 채번·수정 잠금) 하나뿐이다.
   같은 내용을 세 번 보여주면 아무도 읽지 않는 확인이 된다(FMS FSY-01 과 같은 근거).

   전역: DYDOC.define(cfg) → 도메인 파사드  (js/common.js · org-pick.js 뒤에 로드)
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }

    /* =========================================================================
     * cfg 계약 — 도메인이 채우는 것만 적는다. 나머지는 골격이 한다.
     * -------------------------------------------------------------------------
     *   ns            전역 이름 (onclick 경로). 예 'EDUDOC'
     *   lkey / skey   결재선 · 문서 스토어 세션키
     *   targetOf(id)  대상 객체. 없으면 null → 기안이 열리지 않는다
     *   titleOf(t)    문서 제목 기본값
     *   subjectOf(t)  모달 제목에 붙는 대상 이름
     *   ready(t)      기안 가능 여부 { ok, why } — 도메인이 정한다
     *   chips(t)      본문 삽입 조각 [{ label, text }]
     *   attachOf(t)   붙임 후보 [{ label, meta }] — **이미 올려 둔 파일**을 고르게 한다
     *   annexes(t,d)  붙임 별지 [{ title, html }]
     *   basisOf(t)    법령 근거 후보 [{ key, label }] — 없으면 근거 절 자체가 사라진다
     *   save(t, doc)  상신 확정 시 저장. 도메인 스토어에 쌓는다
     *   docsFor(t)    그 대상의 문서 목록(최신순 아님, 배열 그대로)
     *   nextNo()      문서번호 채번
     *   lockNote      상신 확인에 낼 잠금 경고 문장
     * ========================================================================= */
    function define(cfg) {
        var NS = cfg.ns;
        var F = null;            /* 기안 폼 상태 */
        var LINE = null;         /* 결재선 */
        var editIdx = -1;
        var REFRESH = [];

        /* ===================== 사람 ===================== */
        function persona() {
            var R = global.DYROLE;
            return (R && R.current) ? R.current() : { name: '담당자', role: '담당', deptName: '재난안전과' };
        }
        function myDeptName() { return persona().deptName || '재난안전과'; }
        function today() { return V().today(); }

        /* ===================== 결재선 =====================
         * 결재권자는 안전보건 법령이 아니라 **지자체 위임전결규칙** 소관이라
         * 조직 개편·규칙 개정으로 바뀐다. 코드에 고정하지 않고 기본값만 조직도에서
         * 파생하며, 변경은 ORGPICK 인라인 조직도로만 받는다(새 select 금지). */
        function stepLabel(i, len) { return i === len - 1 ? '결재' : '검토'; }
        function defaultLine() {
            var out = [];
            var dept = (global.DYV2 && DYV2.orgNode) ? DYV2.orgNode(persona().deptId) : null;
            var lead = null, head = null;
            if (dept) {
                (dept.members || []).forEach(function (m) {
                    if (/팀장/.test(m.role || '') && !lead) lead = m;
                    if (/(과장|소장|실장)/.test(m.role || '') && !head) head = m;
                });
                (dept.children || []).forEach(function (c) {
                    (c.members || []).forEach(function (m) {
                        if (/팀장/.test(m.role || '') && !lead) lead = m;
                    });
                });
            }
            if (lead) out.push({ role: lead.role, name: lead.name });
            if (head) out.push({ role: head.role, name: head.name });
            if (!out.length) out.push({ role: '', name: '' });
            return out;
        }
        function line() {
            if (LINE) return LINE;
            try { LINE = JSON.parse(global.sessionStorage.getItem(cfg.lkey) || 'null'); } catch (e) { LINE = null; }
            if (!LINE || !LINE.length) LINE = defaultLine();
            return LINE;
        }
        function saveLine() { try { global.sessionStorage.setItem(cfg.lkey, JSON.stringify(LINE || [])); } catch (e) {} }
        function lineText(L) {
            L = L || line();
            return ['기안 ' + persona().name].concat(L.map(function (s, i) {
                return stepLabel(i, L.length) + ' ' + (s.name || '(미지정)');
            })).join(' → ');
        }
        function parseMember(value) {
            /* ORGPICK 'member' 는 '부서 · 역할 / 이름' 으로 준다 */
            var s = String(value || ''); var i = s.lastIndexOf('/');
            if (i < 0) return { role: '', name: s.trim() };
            var left = s.slice(0, i).trim(), name = s.slice(i + 1).trim();
            var j = left.lastIndexOf('·');
            return { role: (j < 0 ? left : left.slice(j + 1)).trim(), name: name };
        }
        function pickOpen(i) { editIdx = i; global.ORGPICK.toggle(NS + '-ln-' + i, 'member', NS + '.pickApprover'); }
        function pickApprover(value) {
            var m = parseMember(value); var L = line();
            if (L[editIdx]) { L[editIdx].role = m.role; L[editIdx].name = m.name; }
            saveLine(); renderDraft();
        }
        function addStep() { capture(); line().push({ role: '', name: '' }); saveLine(); renderDraft(); }
        function delStep(i) {
            capture(); var L = line();
            if (L.length <= 1) { toast('결재선은 최소 1단계가 필요합니다.'); return; }
            L.splice(i, 1); saveLine(); renderDraft();
        }
        function resetLine() { capture(); LINE = defaultLine(); saveLine(); renderDraft(); toast('기본 결재선으로 되돌렸습니다.'); }
        function lineEditorHtml() {
            var L = line();
            return '<div class="rskdoc-line">' +
                '<div class="rskdoc-line-head"><b>결재선</b>' +
                    '<span class="file-hint">위임전결규칙 소관이라 고정하지 않습니다 — 조직도에서 고르세요</span>' +
                    '<span class="spacer"></span>' +
                    '<button type="button" class="btn btn-sm btn-outline" onclick="' + NS + '.addStep()">＋ 단계</button> ' +
                    '<button type="button" class="btn btn-sm btn-outline" onclick="' + NS + '.resetLine()">기본값</button>' +
                '</div>' +
                '<div class="rskdoc-line-body">' +
                    '<span class="rskdoc-ln-fixed">기안 <b>' + esc(persona().name) + '</b></span>' +
                    L.map(function (s, i) {
                        return '<div class="rskdoc-ln orgpick-field" id="' + NS + '-ln-' + i + '">' +
                            '<span class="rskdoc-ln-k">' + stepLabel(i, L.length) + '</span>' +
                            '<input type="text" class="form-input" readonly placeholder="조직도에서 결재자를 선택하세요"' +
                                ' value="' + esc(s.name ? (s.role ? s.role + ' ' + s.name : s.name) : '') + '">' +
                            '<button type="button" class="btn btn-sm btn-outline" onclick="' + NS + '.pickOpen(' + i + ')">조직도</button>' +
                            '<button type="button" class="btn btn-sm btn-outline" onclick="' + NS + '.delStep(' + i + ')">×</button>' +
                        '</div>';
                    }).join('') +
                '</div>' +
            '</div>';
        }

        /* ===================== 기안 폼 =====================
         * **본문은 자동 생성하지 않는다.** 발주처: "이게 다 직접 타이핑 하셔야 돼".
         * 자동 연결에 합의된 것은 붙임뿐이고, 시스템은 수치를 세어 '삽입' 칩으로 건넬 뿐이다. */
        function open(id) {
            var t = cfg.targetOf(id);
            if (!t) { toast('대상을 찾지 못했습니다.'); return; }
            var r = cfg.ready ? cfg.ready(t) : { ok: true };
            if (!r.ok) { toast(r.why || '아직 기안할 수 없습니다.'); return; }
            F = {
                id: id, docType: '내부결재',
                title: cfg.titleOf ? cfg.titleOf(t) : '',
                to: '', body: '',
                attach: (cfg.attachOf ? cfg.attachOf(t) : []).map(function (a) { return { label: a.label, meta: a.meta || '', on: false }; }),
                basis: {}, annex: true
            };
            renderDraft();
        }
        function capture() {
            if (!F) return;
            var el = function (k) { return global.document.getElementById(NS + '-' + k); };
            if (el('title')) F.title = el('title').value;
            if (el('to')) F.to = el('to').value;
            if (el('body')) F.body = el('body').value;
        }
        function setType(v) { capture(); F.docType = v; renderDraft(); }
        function setAttach(i, on) { capture(); if (F.attach[i]) F.attach[i].on = !!on; }
        function setAnnex(on) { capture(); F.annex = !!on; renderDraft(); }
        function setBasis(key, on) { capture(); if (on) F.basis[key] = true; else delete F.basis[key]; }
        function insert(text) {
            capture();
            var el = global.document.getElementById(NS + '-body');
            if (!el) return;
            var s = F.body || '';
            F.body = s + (s && !/\n$/.test(s) ? '\n' : '') + text;
            el.value = F.body; el.focus();
        }

        function chipsHtml(t) {
            var list = cfg.chips ? cfg.chips(t) : [];
            if (!list.length) return '';
            return '<div class="rskdoc-chips">' + list.map(function (c) {
                return '<button type="button" class="btn btn-sm btn-outline" onclick="' + NS + '.insert(' +
                    JSON.stringify(c.text).replace(/"/g, '&quot;') + ')">＋ ' + esc(c.label) + '</button>';
            }).join('') + '</div>';
        }
        function attachPickHtml() {
            if (!F.attach.length) {
                return '<p class="file-hint">붙일 수 있는 파일이 없습니다 — 교육·평가에 올려 둔 파일이 붙임 후보가 됩니다.</p>';
            }
            return '<div class="rskdoc-attach">' + F.attach.map(function (a, i) {
                return '<label class="rskdoc-att"><input type="checkbox"' + (a.on ? ' checked' : '') +
                    ' onchange="' + NS + '.setAttach(' + i + ', this.checked)">' +
                    '<span><b>' + esc(a.label) + '</b>' + (a.meta ? ' <span class="file-hint">' + esc(a.meta) + '</span>' : '') + '</span></label>';
            }).join('') + '</div>';
        }
        function basisHtml(t) {
            var list = cfg.basisOf ? cfg.basisOf(t) : [];
            if (!list.length) return '';
            return '<div class="rskdoc-row"><label class="form-label">관련 근거 <span class="file-hint">고른 것만 지면에 실립니다</span></label>' +
                '<div class="rskdoc-basis">' + list.map(function (b) {
                    return '<label class="rskdoc-att"><input type="checkbox"' + (F.basis[b.key] ? ' checked' : '') +
                        ' onchange="' + NS + '.setBasis(\'' + b.key + '\', this.checked)"><span>' + esc(b.label) + '</span></label>';
                }).join('') + '</div></div>';
        }

        function renderDraft() {
            var t = cfg.targetOf(F.id);
            var out = F.docType === '외부발송';
            V().openModal('공문 기안 — ' + esc(cfg.subjectOf ? cfg.subjectOf(t) : ''),
                '<div class="rskdoc-draft">' +
                    '<div class="rskdoc-row"><label class="form-label" for="' + NS + '-type">문서 종류</label>' +
                        '<select class="form-select" id="' + NS + '-type" onchange="' + NS + '.setType(this.value)">' +
                            ['내부결재', '외부발송'].map(function (k) {
                                return '<option value="' + k + '"' + (F.docType === k ? ' selected' : '') + '>' + k + '</option>';
                            }).join('') + '</select></div>' +
                    '<div class="rskdoc-row"><label class="form-label" for="' + NS + '-title">제목 <span class="roc-req">*</span></label>' +
                        '<input type="text" class="form-input" id="' + NS + '-title" value="' + esc(F.title) + '"></div>' +
                    (out
                        ? '<div class="rskdoc-row"><label class="form-label" for="' + NS + '-to">수신</label>' +
                            '<input type="text" class="form-input" id="' + NS + '-to" value="' + esc(F.to) + '" placeholder="예: 수신자 참조"></div>'
                        : '') +
                    '<div class="rskdoc-row"><label class="form-label" for="' + NS + '-body">본문 <span class="roc-req">*</span>' +
                        ' <span class="file-hint">직접 작성합니다 — 아래 조각을 눌러 넣을 수 있습니다</span></label>' +
                        chipsHtml(t) +
                        '<textarea class="form-textarea" id="' + NS + '-body" rows="8" placeholder="공문 본문을 직접 입력하세요.">' + esc(F.body) + '</textarea></div>' +
                    basisHtml(t) +
                    '<div class="rskdoc-row"><label class="form-label">붙임 <span class="file-hint">이미 올려 둔 파일에서 고릅니다 — 여기서 새로 올리지 않습니다</span></label>' +
                        attachPickHtml() +
                        ((cfg.annexes && cfg.annexes(t, null).length)
                            ? '<label class="rskdoc-att" style="margin-top:6px;"><input type="checkbox"' + (F.annex ? ' checked' : '') +
                                ' onchange="' + NS + '.setAnnex(this.checked)"><span><b>붙임 별지</b> <span class="file-hint">' +
                                esc(cfg.annexes(t, null).map(function (x) { return x.title; }).join(' · ')) + '</span></span></label>'
                            : '') +
                    '</div>' +
                    lineEditorHtml() +
                '</div>',
                /* **기안 폼에는 상신 수단이 없다.** 순서를 건너뛸 길을 만들지 않는다. */
                '<span class="rskdoc-foot-note">작성 → <b>문서 미리보기</b> → 상신 순서입니다. 여기서는 상신되지 않습니다.</span>' +
                '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
                '<button type="button" class="btn btn-primary" onclick="' + NS + '.preview()">문서 미리보기 →</button>',
                { variant: 'wide' });
        }

        /* ===================== 지면 ===================== */
        function signLineHtml(L) {
            var p = persona();
            var cols = [{ t: '기안자', r: p.role || '담당', n: p.name }].concat(L.map(function (s, i) {
                return { t: i === L.length - 1 ? '결재권자' : '검토자', r: s.role || '', n: s.name || '' };
            }));
            return '<div class="pdf-gm-sign">' + cols.map(function (c) {
                return '<span class="pdf-gm-sign-i"><b>' + esc(c.t) + '</b> ' + esc(c.r) + ' ' + esc(c.n || '(미지정)') + '</span>';
            }).join('') + '</div>';
        }
        function bodyDocHtml(text) {
            var s = String(text || '');
            if (!s.trim()) return '<p class="pdf-gm-empty">(본문 미입력)</p>';
            return '<div class="pdf-gm-body">' + esc(s).replace(/\n/g, '<br>') + '</div>';
        }
        function attachDocHtml(list) {
            if (!list.length) return '<p class="pdf-gm-end">끝.</p>';
            return '<div class="pdf-gm-attach"><span class="pdf-gm-attach-k">붙임</span>' +
                '<span class="pdf-gm-attach-v">' + list.map(function (n, i) {
                    return (i + 1) + '. ' + esc(n) + ' 1부.' +
                        (i === list.length - 1 ? '<span class="pdf-gm-endmark">끝.</span>' : '');
                }).join('<br>') + '</span></div>';
        }
        function attachNames(t, doc) {
            var src = doc || F;
            var names = (src.attach || []).filter(function (x) { return x.on; }).map(function (x) { return x.label; });
            if (src.annex && cfg.annexes) {
                cfg.annexes(t, doc).forEach(function (x) { names.push(x.title); });
            }
            return names;
        }
        function paperMain(t, doc) {
            var src = doc || F;
            var L = doc ? doc.line : line();
            var out = src.docType === '외부발송';
            var no = doc && doc.no ? doc.no : '';
            var noCell = no
                ? esc(no) + '(' + esc(doc.at ? String(doc.at).slice(0, 10) : today()) + ')' +
                  ' <span class="pdf-note">임시 채번 — 실제 번호는 온나라가 부여</span>'
                : '<span class="pdf-dash">(온나라 상신 시 부여)</span>';
            return '<div class="pdf-paper pdf-doc pdf-gm">' +
                '<div class="pdf-gm-org">담 양 군</div>' +
                '<div class="pdf-gm-head">' +
                    '<div class="pdf-gm-row"><span class="k">수신</span><span class="v">' +
                        (out ? (esc(src.to || '') || '<span class="pdf-dash">(수신자 미지정)</span>') + '<span class="pdf-gm-via">(경유)</span>' : '내부결재') +
                    '</span></div>' +
                    '<div class="pdf-gm-row"><span class="k">제목</span><span class="v"><b>' +
                        (esc(src.title || '') || '<span class="pdf-dash">(제목 미입력)</span>') + '</b></span></div>' +
                '</div>' +
                bodyDocHtml(src.body) +
                attachDocHtml(attachNames(t, doc)) +
                (out ? '<div class="pdf-gm-issuer">담 양 군 수<span class="pdf-doc-seal">관인</span></div>' : '') +
                '<div class="pdf-gm-foot">' +
                    signLineHtml(L) +
                    '<div class="pdf-gm-frow"><span class="k">협조자</span><span class="v"><span class="pdf-dash">-</span></span></div>' +
                    '<div class="pdf-gm-frow"><span class="k">시행</span><span class="v">' + noCell + '</span>' +
                        (out ? '<span class="k">접수</span><span class="v"><span class="pdf-dash">-</span></span>' : '') + '</div>' +
                    (out
                        ? '<div class="pdf-gm-frow2">우 <span class="pdf-dash">우편번호 미등록</span> ' +
                              '<span class="pdf-dash">전남 담양군 담양읍 (주소 미등록)</span> / www.damyang.go.kr</div>' +
                          '<div class="pdf-gm-frow2">전화 <span class="pdf-dash">미등록</span> / 팩스 <span class="pdf-dash">미등록</span> / ' +
                              '<span class="pdf-dash">담당자 전자우편 미등록</span> / 공개구분 <span class="pdf-dash">미확정</span></div>'
                        : '') +
                '</div>' +
            '</div>';
        }
        function paperHtml(t, doc) {
            var src = doc || F;
            var annex = (src.annex && cfg.annexes) ? cfg.annexes(t, doc) : [];
            return paperMain(t, doc) + annex.map(function (a, i) {
                return '<div class="pdf-paper pdf-doc pdf-gm pdf-gm-annex">' +
                    '<div class="pdf-gm-annex-k">[붙임 ' + (i + 1) + '] ' + esc(a.title) + '</div>' + a.html + '</div>';
            }).join('');
        }

        function preview() {
            capture();
            if (!String(F.title || '').trim()) { toast('공문 제목을 입력하세요.'); return; }
            if (!String(F.body || '').trim()) { toast('공문 본문을 입력하세요.'); return; }
            var t = cfg.targetOf(F.id);
            V().openModal('문서 미리보기 — ' + esc(F.title),
                /* 지면(.pdf-paper)은 `margin: 0 auto` 로 중앙 정렬되므로 좁은 화면에서는 양쪽으로
                   넘쳐 **왼쪽이 스크롤로도 닿지 않는 곳으로 밀린다**(375px 실측). 래퍼가 가로로
                   스크롤되게 하고 왼쪽에 붙여 시작점을 지면 왼쪽 끝에 맞춘다. 지면 CSS 는 다른
                   도메인과 공유하므로 건드리지 않는다. */
                '<div class="rskdoc-preview" style="overflow-x:auto; display:flex; justify-content:flex-start;">' +
                    '<div>' + paperHtml(t, null) + '</div></div>',
                '<button type="button" class="btn btn-secondary" onclick="' + NS + '.back()">← 수정</button>' +
                '<button type="button" class="btn btn-primary" onclick="' + NS + '.confirmSend()">온나라로 결재 상신</button>',
                { variant: 'wide', headHtml: '<button type="button" class="btn btn-sm btn-outline pdf-noprint" onclick="' + NS + '.print()">PDF 저장 / 인쇄</button>' });
        }
        function back() { renderDraft(); }
        function print() { global.print(); }

        /* ===================== 상신 =====================
         * 확인 단계는 **되돌릴 수 없다는 사실만** 말한다. 문서·붙임·결재선은 바로 앞
         * 미리보기 지면에 이미 있으므로 표로 반복하지 않는다. */
        function confirmSend() {
            var L = line();
            var blank = L.filter(function (s) { return !s.name; }).length;
            if (blank) { toast('결재선에 지정하지 않은 단계가 ' + blank + '건 있습니다 — 조직도에서 결재자를 고르세요'); return; }
            V().openModal('상신하면 되돌릴 수 없습니다',
                '<div class="rskdoc-send">' +
                    '<div class="rskdoc-lock-warn">' +
                        '<b>' + esc(cfg.lockNote || '상신 후에는 이 기록을 수정할 수 없습니다.') + '</b><br>' +
                        '<span class="file-hint">문서번호가 채번되고 결재 이력에 남습니다. 되돌리려면 반려를 받아야 합니다.</span>' +
                    '</div>' +
                    '<p class="file-hint">문서 내용은 바로 앞 미리보기에서 확인했습니다 — 여기서 다시 보여드리지 않습니다.</p>' +
                '</div>',
                '<button type="button" class="btn btn-secondary" onclick="' + NS + '.preview()">← 미리보기</button>' +
                '<button type="button" class="btn btn-primary" onclick="' + NS + '.send()">상신</button>');
        }
        function send() {
            var t = cfg.targetOf(F.id);
            var no = cfg.nextNo();
            var doc = {
                sid: no + '-' + (cfg.docsFor(t) || []).length,
                no: no, at: today(), status: '결재중',
                docType: F.docType, title: F.title, to: F.to, body: F.body,
                attach: F.attach.filter(function (x) { return x.on; }),
                annex: F.annex, basis: Object.keys(F.basis),
                line: line().slice(), lineText: lineText(),
                by: persona().name, dept: myDeptName()
            };
            cfg.save(t, doc);
            V().closeModal();
            V().openModal('온나라 결재 요청',
                '<div class="rskdoc-sent">' +
                    '<p><b>' + esc(doc.title) + '</b></p>' +
                    '<p>문서번호 <b>' + esc(no) + '</b> <span class="file-hint">임시 채번 — 실제 번호는 온나라가 부여합니다</span></p>' +
                    '<p class="file-hint">온나라 연동은 아직 구현되지 않았습니다 — 이 화면은 상신 결과를 재현합니다.</p>' +
                '</div>',
                '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal()">확인</button>');
            refresh();
        }

        /* ===================== 문서 보기 · 상태 ===================== */
        function openDoc(id, sid) {
            var t = cfg.targetOf(id); if (!t) return;
            var doc = (cfg.docsFor(t) || []).filter(function (d) { return d.sid === sid; })[0];
            if (!doc) { toast('문서를 찾지 못했습니다.'); return; }
            V().openModal('공문 — ' + esc(doc.title),
                '<div class="rskdoc-preview" style="overflow-x:auto; display:flex; justify-content:flex-start;">' +
                    '<div>' + paperHtml(t, doc) + '</div></div>',
                '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal()">닫기</button>',
                { variant: 'wide', headHtml: '<button type="button" class="btn btn-sm btn-outline pdf-noprint" onclick="' + NS + '.print()">PDF 저장 / 인쇄</button>' });
        }

        function registerRefresh(fn) { if (typeof fn === 'function' && REFRESH.indexOf(fn) < 0) REFRESH.push(fn); }
        function refresh() { REFRESH.forEach(function (fn) { try { fn(); } catch (e) {} }); }

        var api = {
            open: open, preview: preview, back: back, print: print,
            confirmSend: confirmSend, send: send, openDoc: openDoc,
            capture: capture, insert: insert, setType: setType, setAttach: setAttach,
            setAnnex: setAnnex, setBasis: setBasis,
            pickOpen: pickOpen, pickApprover: pickApprover, addStep: addStep, delStep: delStep, resetLine: resetLine,
            line: line, lineText: lineText, registerRefresh: registerRefresh, refresh: refresh,
            paperHtml: paperHtml
        };
        global[NS] = api;
        return api;
    }

    global.DYDOC = { define: define };
})(window);
