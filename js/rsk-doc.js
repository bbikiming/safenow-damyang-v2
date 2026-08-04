/* =====================================================================
   rsk-doc.js · 위험성평가 공문 기안 → 문서 미리보기 → 온나라 이관 (전역 DYRSKDOC)
   근거: docs/planning/기획-위험성평가-공문-온나라이관-v1.md

   순서가 이 모듈의 존재 이유다 —
     발주처가 교육의 [결재 상신]을 지우라고 한 이유는 기능이 아니라 **순서**였다.
     "왜 갑자기 뜬금없이 결재 상신이 있지" / "결재 상신을 눌러요. 그럼 공문 내용이
      있을 거 아니에요? **작성을 하고** … 붙임 파일에 넣어놨었잖아요."
     그래서 1차 진입점은 [공문 기안]이고, [상신]은 **미리보기 화면에만** 있다.
     기안 폼에서 곧바로 상신할 수 없다.

   본문은 자동 생성하지 않는다 —
     "이게 다 직접 타이핑 하셔야 돼. 이거는 자동으로 못 만들어드리고"(녹취 822).
     자동 연결에 합의된 것은 **붙임파일뿐**이다. 시스템은 붙임을 엮고 수치를 세어
     '삽입' 칩으로 건네줄 뿐, 문장은 사람이 친다.

   표준 준수 — 모달은 DYV2.openModal 하나(§1) · 지면은 .pdf-paper.pdf-doc(§7) ·
     결재자 선택은 ORGPICK member(§3) · 근거는 DYLAW 조문 키(§10) · 토큰만(§6).
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYRSK; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }
    function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }

    /* 결재선 저장 키는 **도메인 중립**이다 — 교육(dy-edu-apprline-v1)과 합칠 때
       이 키로 수렴시킨다. 지금 EDUAPV 를 건드리지 않는 대가로 두 벌이 공존한다. */
    var LKEY = 'dy-apprline-v1';
    var MAX_STEP = 3;

    /* 기안 폼 상태 — 모달 재렌더 사이에 유지된다 */
    var F = null;
    var LINE = null;
    var editIdx = -1;

    /* ===================== 사람·부서 ===================== */
    function persona() {
        var p = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        return p || { name: '박안전', role: '안전관리 주무관', org: '담양군청 · 재난안전과', deptName: '재난안전과' };
    }
    function myDeptName() { return persona().deptName || '재난안전과'; }

    /* ===================== 결재선 ===================== */
    function stepLabel(i, len) { return i === len - 1 ? '결재' : '검토'; }
    function defaultLine() {
        var dn = myDeptName();
        var d = (V().orgFlat() || []).filter(function (x) { return x.dept === dn; })[0];
        var team = null, head = null;
        if (d) {
            d.members.forEach(function (m) {
                if (!team && /팀장/.test(m[0])) team = m;
                if (!head && /(과장|소장|실장|국장|읍장|면장)$/.test(m[0])) head = m;
            });
        }
        var out = [];
        if (team) out.push({ dept: dn, role: team[0], name: team[1] });
        out.push(head ? { dept: dn, role: head[0], name: head[1] } : { dept: dn, role: '과장', name: '' });
        return out;
    }
    function line() {
        if (LINE) return LINE;
        try {
            var raw = global.sessionStorage.getItem(LKEY);
            if (raw) { var v = JSON.parse(raw); if (v && v.length) { LINE = v; return v; } }
        } catch (e) {}
        LINE = defaultLine();
        return LINE;
    }
    function saveLine() { try { global.sessionStorage.setItem(LKEY, JSON.stringify(LINE || [])); } catch (e) {} }
    function lineText(L) {
        L = L || line();
        var p = persona();
        return ['기안 ' + p.name].concat(L.map(function (s, i) {
            return stepLabel(i, L.length) + ' ' + (s.name || '(미지정)');
        })).join(' → ');
    }
    function parseMember(value) {
        var s = String(value || '');
        var slash = s.lastIndexOf(' / ');
        var name = slash >= 0 ? s.slice(slash + 3) : s;
        var left = slash >= 0 ? s.slice(0, slash) : '';
        var dot = left.indexOf(' · ');
        return { dept: dot >= 0 ? left.slice(0, dot) : '', role: dot >= 0 ? left.slice(dot + 3) : left, name: name };
    }
    function pickOpen(i) { editIdx = i; global.ORGPICK.toggle('rskdoc-ln-' + i, 'member', 'DYRSKDOC.pickApprover'); }
    function pickApprover(value) {
        var L = line();
        if (editIdx < 0 || !L[editIdx]) return;
        capture();
        L[editIdx] = parseMember(value); saveLine(); renderDraft();
    }
    function addStep() {
        var L = line();
        if (L.length >= MAX_STEP) { toast('결재 단계는 최대 ' + MAX_STEP + '단계입니다.'); return; }
        capture();
        L.splice(L.length - 1, 0, { dept: '', role: '검토자', name: '' }); saveLine(); renderDraft();
    }
    function delStep(i) {
        var L = line();
        if (L.length <= 1) { toast('최종 결재자는 삭제할 수 없습니다.'); return; }
        capture();
        L.splice(i, 1); saveLine(); renderDraft();
    }
    function resetLine() { capture(); LINE = defaultLine(); saveLine(); renderDraft(); toast('기본 결재선으로 되돌렸습니다.'); }

    function lineEditorHtml() {
        var L = line();
        var rows = L.map(function (s, i) {
            var val = s.name ? [s.dept, s.role].filter(Boolean).join(' · ') + ' / ' + s.name : '';
            return '<div class="rskdoc-ln-row">' +
                '<span class="rskdoc-ln-step">' + stepLabel(i, L.length) + '</span>' +
                '<div class="orgpick-field" id="rskdoc-ln-' + i + '">' +
                    '<div class="rskdoc-ln-pick">' +
                        '<input type="text" class="form-input" readonly value="' + esc(val) + '"' +
                            ' placeholder="조직도에서 결재자 선택" aria-label="' + stepLabel(i, L.length) + ' 결재자">' +
                        '<button type="button" class="btn btn-outline btn-sm" onclick="DYRSKDOC.pickOpen(' + i + ')">조직도</button>' +
                        (L.length > 1 ? '<button type="button" class="btn btn-outline btn-sm" onclick="DYRSKDOC.delStep(' + i + ')"' +
                            ' aria-label="' + stepLabel(i, L.length) + ' 단계 삭제">×</button>' : '') +
                    '</div>' +
                '</div></div>';
        }).join('');
        return '<div class="rskdoc-line">' +
            '<div class="rskdoc-line-head"><b>결재선</b>' +
                '<span class="pdf-note">기본값은 조직도의 팀장 → 부서장. 결재권자는 담양군 위임전결규칙 소관이라 코드에 고정하지 않습니다.</span>' +
                '<span class="rskdoc-line-btns">' +
                    '<button type="button" class="btn btn-outline btn-sm" onclick="DYRSKDOC.addStep()">＋ 단계</button>' +
                    '<button type="button" class="btn btn-outline btn-sm" onclick="DYRSKDOC.resetLine()">기본값</button>' +
                '</span>' +
            '</div>' + rows +
        '</div>';
    }

    /* ===================== 대상 데이터 ===================== */
    function assess(aid) { return D().assessmentOf(aid); }
    function targetKey(aid) { return 'A|' + aid; }

    /* 부서별 확인 결과 — 문서 표·수치의 단일 출처. 결재용 별도 시드를 만들지 않는다. */
    function deptRows(a) {
        return (a.depts || []).map(function (dp) {
            var c = D().confirmCount(a.id, dp.deptId);
            if (!c.total) return null;
            var ms = D().improvementsFor(a.id, dp.deptId);
            var lastAt = '';
            ms.forEach(function (m) {
                var cf = D().confirmOf(m);
                if (cf.state === 'OK' && cf.at > lastAt) lastAt = cf.at;
            });
            var reRound = ms.some(function (m) { return (D().confirmOf(m).round || 1) > 1; });
            return {
                deptId: dp.deptId, name: D().deptName(dp.deptId),
                total: c.total, done: c.done, ok: c.ok, returned: c.returned,
                due: dp.dueDate || '', confirmedAt: lastAt, reRound: reRound
            };
        }).filter(Boolean);
    }
    function totals(a) {
        var rows = deptRows(a);
        var t = { depts: rows.length, total: 0, done: 0, ok: 0, returned: 0, re: 0 };
        rows.forEach(function (r) {
            t.total += r.total; t.done += r.done; t.ok += r.ok; t.returned += r.returned;
            if (r.reRound) t.re++;
        });
        return t;
    }

    /* ===================== 기안 폼 ===================== */
    function open(aid) {
        var a = assess(aid); if (!a) return;
        if (!D().docReady(aid)) {
            var c = D().confirmCount(aid);
            toast('전 건 확인 완료 후 기안할 수 있습니다 — 확인 대기 ' + c.wait + '건 · 반려 ' + c.returned + '건');
            return;
        }
        var t = totals(a);
        if (!F || F.aid !== aid) {
            F = {
                aid: aid, docType: '내부결재',
                title: '', to: '', body: '',
                basis: [], attach: [
                    { label: '부서별 개선조치 확인 결과표', auto: true, on: true },
                    { label: '개선 전·후 증빙 사진철', auto: true, on: true }
                ],
                files: []
            };
        }
        F.t = t;
        renderDraft();
    }
    function capture() {
        var el = function (id) { return document.getElementById(id); };
        if (!F) return;
        if (el('rskdoc-title')) F.title = el('rskdoc-title').value;
        if (el('rskdoc-to')) F.to = el('rskdoc-to').value;
        if (el('rskdoc-body')) F.body = el('rskdoc-body').value;
        if (el('rskdoc-type')) F.docType = el('rskdoc-type').value;
    }
    function setType(v) { capture(); F.docType = v; renderDraft(); }
    function setBasis(key, on) { capture();
        var i = F.basis.indexOf(key);
        if (on && i < 0) F.basis.push(key);
        if (!on && i >= 0) F.basis.splice(i, 1);
    }
    function setAttach(i, on) { capture(); if (F.attach[i]) F.attach[i].on = !!on; }
    function delFile(i) { capture(); F.files.splice(i, 1); renderDraft(); }
    function onPickAttach(files) {
        capture();
        F.files = F.files.concat(files).slice(0, V().FILE_LIMITS.maxCount);
        renderDraft(); toast('붙임 ' + files.length + '건 추가');
    }
    /* 수치 삽입 — 문장은 사람이 치되, 숫자는 DYRSK 파생이라 화면과 어긋나지 않는다 */
    function insert(text) {
        var el = document.getElementById('rskdoc-body'); if (!el) return;
        var s = el.selectionStart == null ? el.value.length : el.selectionStart;
        var e = el.selectionEnd == null ? s : el.selectionEnd;
        el.value = el.value.slice(0, s) + text + el.value.slice(e);
        el.focus();
        el.selectionStart = el.selectionEnd = s + text.length;
        F.body = el.value;
    }

    function basisPickerHtml() {
        if (!global.DYLAW || !DYLAW.MAP) return '';
        var keys = (DYLAW.MAP['rsk-list'] || []).slice();
        if (!keys.length) return '';
        var items = keys.map(function (k) {
            var art = DYLAW.ARTICLES[k];
            var on = F.basis.indexOf(k) >= 0;
            return '<label class="rskdoc-ck"><input type="checkbox"' + (on ? ' checked' : '') +
                ' onchange="DYRSKDOC.setBasis(\'' + esc(k) + '\',this.checked)">' +
                '<span><b>' + esc(DYLAW.shortRef ? DYLAW.shortRef(k) : k) + '</b> ' +
                esc(art ? art.title : '') + '</span></label>';
        }).join('');
        return '<div class="rskdoc-block"><label class="form-label">관련 근거 <span class="pdf-note">(고른 것만 지면에 찍힙니다 — 안 골라도 됩니다)</span></label>' +
            '<div class="rskdoc-cks">' + items + '</div>' +
            '<p class="file-hint">보존 항목·기간 기준은 <b>미확정</b>입니다 — 산업안전보건법 시행규칙 §37(위험성평가 기록·보존)이 법령 스냅샷에 미수집이라 이 문서는 "법정 기록·보존 항목"이라고 주장하지 않습니다.</p></div>';
    }
    function attachHtml() {
        var auto = F.attach.map(function (x, i) {
            return '<label class="rskdoc-ck"><input type="checkbox"' + (x.on ? ' checked' : '') +
                ' onchange="DYRSKDOC.setAttach(' + i + ',this.checked)">' +
                '<span>' + esc(x.label) + ' <span class="pdf-note">자동 연결</span></span></label>';
        }).join('');
        var files = F.files.length
            ? '<ul class="rskdoc-files">' + F.files.map(function (f, i) {
                  return '<li><span>' + esc(f.name) + '</span>' +
                      '<button type="button" class="rskdoc-file-del" onclick="DYRSKDOC.delFile(' + i + ')"' +
                      ' aria-label="' + esc(f.name) + ' 제외">×</button></li>';
              }).join('') + '</ul>'
            : '';
        return '<div class="rskdoc-block"><label class="form-label">붙임</label>' +
            '<div class="rskdoc-cks">' + auto + '</div>' + files +
            V().uploadDrop('<b>붙임 파일 추가</b> <span style="font-size:var(--fs-12);color:var(--text-gray);">클릭 또는 끌어놓기</span>',
                null, { pick: 'DYRSKDOC.onPickAttach', multiple: true, style: 'padding:10px;margin-top:6px;' }) +
            '<p class="file-hint">회의에서 자동 연결에 합의된 것은 <b>붙임파일</b>입니다. 본문 문장은 자동으로 만들지 않습니다.</p></div>';
    }

    function renderDraft() {
        var a = assess(F.aid); if (!a) return;
        var t = totals(a);
        var chips = [
            ['대상 부서 ' + t.depts + '개', '대상 부서 ' + t.depts + '개'],
            ['개선조치 ' + t.total + '건', '개선조치 ' + t.total + '건'],
            ['확인 완료 ' + t.ok + '건', '확인 완료 ' + t.ok + '건'],
            ['재제출 ' + t.re + '개 부서', '재제출 ' + t.re + '개 부서']
        ].map(function (c) {
            return '<button type="button" class="rskdoc-ins" onclick="DYRSKDOC.insert(\'' + esc(c[1]) + '\')">' +
                '＋ ' + esc(c[0]) + '</button>';
        }).join('');

        var orgN = 0; try { orgN = (D().deptCandidates() || []).length; } catch (e) {}

        var body =
            '<div class="rskdoc-draft">' +
              '<div class="rskdoc-warn">' +
                '<b>표준 공문 서식</b>을 따릅니다 — 「행정업무의 운영 및 혁신에 관한 규정 시행규칙」 별지 제1호서식(기안문·시행문)은 ' +
                '전 행정기관 공통이라 담양군 고유 양식이 따로 있지 않습니다. ' +
                '<b>미확정은 담양군 고유값뿐</b>입니다 — 처리과 기호·주소·전화·팩스·전자우편·공개구분·관인 이미지(지면에 <span class="pdf-dash">미등록</span>으로 표시).' +
              '</div>' +

              '<div class="rskdoc-block"><label class="form-label" for="rskdoc-type">문서 유형</label>' +
                '<select class="form-select" id="rskdoc-type" style="max-width:200px;" onchange="DYRSKDOC.setType(this.value)">' +
                  ['내부결재', '외부발송'].map(function (v) {
                      return '<option value="' + v + '"' + (F.docType === v ? ' selected' : '') + '>' + v + '</option>';
                  }).join('') +
                '</select>' +
                '<p class="file-hint"><b>내부결재</b>는 수신란에 \'내부결재\'만 쓰고 발신명의·관인·접수란이 없습니다. ' +
                    '<b>외부발송</b>은 수신자를 지정하고 발신명의(담 양 군 수)·관인·시행/접수·기관정보가 붙습니다 — 지면이 실제로 달라집니다.</p></div>' +

              '<div class="rskdoc-block"><label class="form-label" for="rskdoc-title">제목 <span class="rskdoc-req">*</span></label>' +
                '<input type="text" class="form-input" id="rskdoc-title" value="' + esc(F.title) + '"' +
                  ' placeholder="예: 2026년 정기 위험성평가 개선조치 완료 확인 결과 통보">' +
                '<p class="file-hint">제목·본문은 <b>직접 입력</b>합니다. 시스템이 문장을 만들지 않습니다.</p></div>' +

              '<div class="rskdoc-block"><label class="form-label" for="rskdoc-to">수신</label>' +
                '<input type="text" class="form-input" id="rskdoc-to" value="' + esc(F.to) + '"' +
                  ' placeholder="예: 수신자 참조">' +
                '<p class="file-hint">부서 명단 <b>' + orgN + ' / 39개 등록</b> · 나머지 ' + Math.max(0, 39 - orgN) + '개 명단 미확보 — 실제 명단을 받으면 조직도(DYV2.ORG) 한 곳만 갱신하면 됩니다.</p></div>' +

              '<div class="rskdoc-block"><label class="form-label" for="rskdoc-body">본문 <span class="rskdoc-req">*</span></label>' +
                '<textarea class="form-textarea" id="rskdoc-body" rows="7" placeholder="공문 본문을 직접 입력하세요.">' + esc(F.body) + '</textarea>' +
                '<div class="rskdoc-inslist"><span class="rskdoc-inslead">항목</span>' +
                    [['1.', '\n1. '], ['가.', '\n  가. '], ['1)', '\n    1) '],
                     ['관련', '1. 관련: ']].map(function (x) {
                        return '<button type="button" class="rskdoc-ins is-item" onclick="DYRSKDOC.insert(\'' +
                            x[1].replace(/\n/g, '\\n') + '\')">' + x[0] + '</button>';
                     }).join('') +
                '</div>' +
                '<div class="rskdoc-inslist"><span class="rskdoc-inslead">수치 삽입</span>' + chips + '</div>' +
                '<p class="file-hint">표준 항목 체계는 <b>1. → 가. → 1) → 가)</b> 순이고 상위 항목보다 두 칸씩 들여 씁니다. ' +
                    '문서 끝의 <b>끝.</b> 표시는 붙임 유무에 따라 지면에서 자동으로 붙습니다.</p></div>' +

              basisPickerHtml() +
              attachHtml() +
              lineEditorHtml() +
            '</div>';

        V().openModal('공문 기안 — ' + esc(a.title),
            body,
            '<span class="rskdoc-foot-note">작성 → <b>문서 미리보기</b> → 상신 순서입니다. 여기서는 상신되지 않습니다.</span>' +
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
            '<button type="button" class="btn btn-primary" onclick="DYRSKDOC.preview()">문서 미리보기 →</button>',
            { variant: 'wide' });
    }

    /* ===================== 문서 지면 (미리보기) ===================== */
    /* ===================== 문서 지면 (표준 공문 서식) =====================
     * 「행정업무의 운영 및 혁신에 관한 규정 시행규칙」 별지 제1호서식(기안문/시행문)
     * 구조를 따른다 — 전 행정기관 공통 서식이라 담양군 고유 양식이 따로 있지 않다.
     * 다만 **이 규정을 근거 칩으로 인용하지는 않는다** — DYLAW 스냅샷에 없기 때문이다(§10).
     * 서식을 따르는 것과 조문을 인용하는 것은 다른 문제다.
     *
     * 내부결재 / 외부발송(시행문)은 지면이 실제로 다르다 —
     *   내부결재: 수신 '내부결재' · 발신명의·관인·접수란·기관정보 없음
     *   외부발송: 수신자 지정 · 발신명의 '담 양 군 수' + 관인 · 시행/접수 · 기관정보
     * 보고서 서식(Ⅰ/Ⅱ/Ⅲ 절, KPI 카드)은 공문이 아니므로 쓰지 않는다.
     * 표는 본문에 넣지 않고 **붙임 별지**로 뺀다. */

    /* 하단 서명란 — 표준 시행문은 결재란이 상단이 아니라 하단의
       '기안자 / 검토자 / 결재권자 직위(직급) 서명' 줄이다. */
    function signLineHtml(L) {
        var p = persona();
        var cols = [{ t: '기안자', r: p.role || '담당', n: p.name }].concat(L.map(function (s, i) {
            return { t: i === L.length - 1 ? '결재권자' : '검토자', r: s.role || '', n: s.name || '' };
        }));
        return '<div class="pdf-gm-sign">' + cols.map(function (c) {
            return '<span class="pdf-gm-sign-i"><b>' + esc(c.t) + '</b> ' +
                esc(c.r) + ' ' + esc(c.n || '(미지정)') + '</span>';
        }).join('') + '</div>';
    }

    /* 본문 — 사람이 친 문장을 그대로 낸다. 항목 들여쓰기는 표준 체계(1. 가. 1) 가))를
       그대로 살리기 위해 공백을 보존한다. */
    function bodyHtml(text) {
        var s = String(text || '');
        if (!s.trim()) return '<p class="pdf-gm-empty">(본문 미입력)</p>';
        return '<div class="pdf-gm-body">' + esc(s).replace(/\n/g, '<br>') + '</div>';
    }
    /* 붙임 표기 — 표준은 `붙임  1. ○○ 1부.` 이고 마지막에 두 칸 띄우고 `끝.` 이다.
       붙임이 없으면 본문 마지막에 `끝.` 이 온다. */
    function attachHtmlDoc(list) {
        if (!list.length) return '<p class="pdf-gm-end">끝.</p>';
        return '<div class="pdf-gm-attach">' +
            '<span class="pdf-gm-attach-k">붙임</span>' +
            '<span class="pdf-gm-attach-v">' + list.map(function (n, i) {
                return (i + 1) + '. ' + esc(n) + ' 1부.' + (i === list.length - 1 ? '<span class="pdf-gm-endmark">끝.</span>' : '');
            }).join('<br>') + '</span>' +
        '</div>';
    }

    function attachNames(doc) {
        return (doc ? doc.attach : F.attach.filter(function (x) { return x.on; }))
            .map(function (x) { return x.label; })
            .concat((doc ? (doc.files || []) : F.files).map(function (f) { return f.name; }));
    }

    /* 본문 지면 1장 */
    function paperMain(a, doc) {
        var src = doc || F;
        var L = doc ? doc.line : line();
        var p = persona();
        var out = src.docType === '외부발송';
        var no = doc && doc.no ? doc.no : '';
        var noCell = no
            ? esc(no) + '(' + esc(doc.at ? String(doc.at).slice(0, 10) : D().today()) + ')' +
              ' <span class="pdf-note">임시 채번 — 실제 번호는 온나라가 부여</span>'
            : '<span class="pdf-dash">(온나라 상신 시 부여)</span>';

        return '<div class="pdf-paper pdf-doc pdf-gm">' +
            /* ① 행정기관명 */
            '<div class="pdf-gm-org">담 양 군</div>' +

            /* ② 수신 / 경유 / 제목 */
            '<div class="pdf-gm-head">' +
                '<div class="pdf-gm-row"><span class="k">수신</span>' +
                    '<span class="v">' + (out
                        ? (esc(src.to || '') || '<span class="pdf-dash">(수신자 미지정)</span>') +
                          '<span class="pdf-gm-via">(경유)</span>'
                        : '내부결재') + '</span></div>' +
                '<div class="pdf-gm-row"><span class="k">제목</span>' +
                    '<span class="v"><b>' + (esc(src.title || '') || '<span class="pdf-dash">(제목 미입력)</span>') + '</b></span></div>' +
            '</div>' +

            /* ③ 본문 + ④ 붙임 */
            bodyHtml(src.body) +
            attachHtmlDoc(attachNames(doc)) +

            /* ⑤ 발신명의 — 외부발송만 */
            (out
                ? '<div class="pdf-gm-issuer">담 양 군 수<span class="pdf-doc-seal">관인</span></div>'
                : '') +

            /* ⑥ 서명란 · 시행/접수 · 기관정보 */
            '<div class="pdf-gm-foot">' +
                signLineHtml(L) +
                '<div class="pdf-gm-frow"><span class="k">협조자</span><span class="v"><span class="pdf-dash">-</span></span></div>' +
                '<div class="pdf-gm-frow"><span class="k">시행</span><span class="v">' + noCell + '</span>' +
                    (out ? '<span class="k">접수</span><span class="v"><span class="pdf-dash">-</span></span>' : '') + '</div>' +
                (out
                    ? '<div class="pdf-gm-frow2">우 <span class="pdf-dash">우편번호 미등록</span> ' +
                          '<span class="pdf-dash">전남 담양군 담양읍 (주소 미등록)</span> / www.damyang.go.kr</div>' +
                      '<div class="pdf-gm-frow2">전화 <span class="pdf-dash">미등록</span> / ' +
                          '팩스 <span class="pdf-dash">미등록</span> / ' +
                          '<span class="pdf-dash">담당자 전자우편 미등록</span> / ' +
                          '공개구분 <span class="pdf-dash">미확정</span></div>'
                    : '') +
            '</div>' +
        '</div>';
    }

    /* 붙임 별지 — 부서별 조치 확인 결과표.
       표준 공문 본문에 큰 표를 넣지 않는다. 별지로 뺀다. */
    function paperAnnex(a, doc) {
        var rows = deptRows(a);
        var t = totals(a);
        var src = doc || F;
        var tbody = rows.map(function (r, i) {
            return '<tr' + (r.reRound ? ' class="pdf-warn"' : '') + '>' +
                '<td class="c">' + (i + 1) + '</td><td>' + esc(r.name) + '</td>' +
                '<td class="c">' + r.total + '</td><td class="c">' + r.ok + '</td>' +
                '<td class="c">' + esc(r.due || '-') + '</td>' +
                '<td class="c">' + esc(r.confirmedAt || '-') + '</td>' +
                '<td class="c">' + (r.reRound ? '재제출 후 확인' : '확인 완료') + '</td></tr>';
        }).join('');
        /* 관련 근거 — 담당자가 고른 조문만. 안 골랐으면 절 자체가 없다. */
        var basisKeys = src.basis || [];
        var basisBlock = '';
        if (basisKeys.length && global.DYLAW) {
            basisBlock = '<div class="pdf-gm-annex-sub">관련 근거</div><ul class="pdf-list">' +
                basisKeys.map(function (k) {
                    var art = DYLAW.ARTICLES[k];
                    return '<li><b>' + esc(DYLAW.shortRef ? DYLAW.shortRef(k) : k) + '</b> ' + esc(art ? art.title : '') + '</li>';
                }).join('') + '</ul>';
        }
        return '<div class="pdf-paper pdf-doc pdf-gm pdf-gm-annex">' +
            '<div class="pdf-gm-annex-h">[붙임 1]</div>' +
            '<h3 class="pdf-gm-annex-t">부서별 개선조치 확인 결과표</h3>' +
            '<p class="pdf-gm-annex-m">' + esc(a.title) + ' · 대상 부서 ' + t.depts + '개 · 개선조치 ' + t.total + '건</p>' +
            '<div class="pdf-tablewrap"><table class="table-figma table-doc"><thead><tr>' +
                '<th class="c" style="width:38px;">연번</th><th>부서</th>' +
                '<th class="c" style="width:56px;">개선</th><th class="c" style="width:56px;">확인</th>' +
                '<th class="c" style="width:92px;">조치기한</th><th class="c" style="width:92px;">확인일</th>' +
                '<th class="c" style="width:96px;">비고</th>' +
            '</tr></thead><tbody>' + (tbody ||
                '<tr><td class="c" colspan="7"><span class="pdf-dash">대상 없음</span></td></tr>') +
                '<tr class="pdf-total"><td class="c" colspan="2">합계</td>' +
                    '<td class="c">' + t.total + '</td><td class="c">' + t.ok + '</td>' +
                    '<td class="c" colspan="3">' + (t.total && t.ok === t.total ? '전 부서 확인 완료' : '확인 진행 중') + '</td></tr>' +
            '</tbody></table></div>' +
            basisBlock +
            '<p class="pdf-gm-annex-note">전자서명 방식은 미확정입니다 — 현재는 로그인 사용자 이름을 기록합니다. ' +
                '관인·전자관인 연계는 하지 않습니다.</p>' +
        '</div>';
    }

    function paperHtml(a, doc) {
        return paperMain(a, doc) + paperAnnex(a, doc);
    }

    function preview() {
        capture();
        if (!String(F.title || '').trim()) { toast('제목을 입력하세요.'); var el = document.getElementById('rskdoc-title'); if (el) el.focus(); return; }
        if (!String(F.body || '').trim()) { toast('본문을 입력하세요 — 시스템이 문장을 만들지 않습니다.'); return; }
        var a = assess(F.aid); if (!a) return;
        V().openModal('문서 미리보기 — ' + esc(F.title),
            '<div class="rskdoc-wrap">' +
                '<div class="rskdoc-warn pdf-noprint">표준 공문 서식(기안문·시행문) · ' +
                    (F.docType === '외부발송' ? '<b>외부발송</b> — 발신명의·관인·시행/접수·기관정보 포함'
                                              : '<b>내부결재</b> — 발신명의·관인·접수란 없음') +
                    ' · 담양군 고유값(주소·전화·관인)은 <span class="pdf-dash">미등록</span>으로 표시됩니다. ' +
                    '<span class="pdf-note">(이 안내는 인쇄물에 찍히지 않습니다)</span></div>' +
                paperHtml(a, null) +
            '</div>',
            '<span class="rskdoc-foot-note">' + esc(lineText()) + '</span>' +
            '<button type="button" class="btn btn-secondary" onclick="DYRSKDOC.back()">← 수정</button>' +
            '<button type="button" class="btn btn-primary" onclick="DYRSKDOC.confirmSend()">온나라로 결재 상신</button>',
            { variant: 'wide',
              headHtml: '<button type="button" class="btn btn-sm btn-outline" onclick="DYRSKDOC.print()">PDF 저장 / 인쇄</button>' });
    }
    function back() { renderDraft(); }
    function print() { global.print(); }

    /* ===================== 상신 ===================== */
    function confirmSend() {
        var L = line();
        var blank = L.filter(function (s) { return !s.name; }).length;
        if (blank) { toast('결재선에 지정하지 않은 단계가 ' + blank + '건 있습니다 — 조직도에서 결재자를 고르세요.'); return; }
        var a = assess(F.aid); if (!a) return;
        var t = totals(a);
        var attachOn = F.attach.filter(function (x) { return x.on; }).length + F.files.length;
        /* 네이티브 confirm() 을 쓰지 않는다 — 부서·건수·결재선이 들어가면 평문 한계에 바로 걸린다.
           미리보기 모달이 닫히고 확인 모달이 뜨므로 적층이 아니다(§1). */
        V().openModal('온나라 결재 상신 확인',
            '<div class="rskdoc-send">' +
                '<table class="table-figma table-doc pdf-meta"><tbody>' +
                    '<tr><td class="k">문서</td><td><b>' + esc(F.title) + '</b></td></tr>' +
                    '<tr><td class="k">유형</td><td>' + esc(F.docType) + '</td></tr>' +
                    '<tr><td class="k">대상</td><td>' + t.depts + '개 부서 · 개선조치 ' + t.total + '건 (확인 완료 ' + t.ok + '건)</td></tr>' +
                    '<tr><td class="k">붙임</td><td>' + attachOn + '건</td></tr>' +
                    '<tr><td class="k">결재선</td><td>' + esc(lineText(L)) + '</td></tr>' +
                '</tbody></table>' +
                '<div class="rskdoc-lock-warn">상신 후에는 이 평가의 <b>완료 확인 결과와 증빙을 수정할 수 없습니다.</b><br>' +
                    '<span class="pdf-note">"공문을 여기다 첨부하면 문서들에 대한 기록이 남잖아요. 그러면 더 이상 수정이 안 돼요. 이건 문서 위조예요." (2026-07-30 회의)</span></div>' +
            '</div>',
            '<button type="button" class="btn btn-secondary" onclick="DYRSKDOC.preview()">← 미리보기</button>' +
            '<button type="button" class="btn btn-primary" onclick="DYRSKDOC.send()">상신</button>');
    }
    function send() {
        var a = assess(F.aid); if (!a) return;
        var p = persona();
        var no = myDeptName() + '-' + (100 + D().docs().length + 1);
        var doc = D().pushDoc({
            kind: 'assessment', target: targetKey(F.aid), aid: F.aid,
            no: no, title: F.title, to: F.to, body: F.body, docType: F.docType,
            basis: F.basis.slice(),
            attach: F.attach.filter(function (x) { return x.on; }).map(function (x) { return { label: x.label, auto: x.auto }; }),
            files: F.files.map(function (f) { return { name: f.name }; }),
            line: line().slice(), status: '결재중', by: p.name
        });
        D().pushHistory(F.aid, { type: 'DISPATCH', by: p.name,
            memo: '공문 온나라 상신 — ' + F.title + ' (' + no + ')' });
        V().closeModal();
        F = null;
        sentPopup(doc);
        refresh();
    }
    function sentPopup(doc) {
        V().openModal('온나라 결재 요청',
            '<div class="rskdoc-sent">' +
                '<p class="t">온나라로 결재 요청을 보냈습니다</p>' +
                '<p class="d"><b>' + esc(doc.title) + '</b><br>문서번호 ' + esc(doc.no) +
                    ' <span class="pdf-note">(임시 채번 — 실제 번호는 온나라가 부여)</span><br>' +
                    '결재선: ' + esc(lineText(doc.line)) + '</p>' +
                '<p class="d pdf-note">온나라 연동은 미구현입니다 — 결재 결과는 상태 카드의 <b>회신 버튼</b>으로 시연합니다.</p>' +
            '</div>',
            '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal()">확인</button>');
    }

    /* ===================== 상태 · 회신 ===================== */
    function openStatus(aid) {
        var docsFor = D().docsFor(targetKey(aid));
        if (!docsFor.length) return;
        var doc = docsFor[docsFor.length - 1];
        renderStatus(doc.sid);
    }
    function openDocSid(sid) {
        var doc = D().docs().filter(function (x) { return x.sid === sid; })[0];
        if (!doc) return;
        var a = assess(doc.aid); if (!a) return;
        V().openModal('공문 — ' + esc(doc.title),
            '<div class="rskdoc-wrap">' + paperHtml(a, doc) + '</div>',
            '<span class="rskdoc-foot-note">' + esc(doc.no) + ' · ' + esc(doc.status) + '</span>' +
            '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal()">닫기</button>',
            { variant: 'wide',
              headHtml: '<button type="button" class="btn btn-sm btn-outline" onclick="DYRSKDOC.print()">PDF 저장 / 인쇄</button>' });
    }
    function renderStatus(sid) {
        var doc = D().docs().filter(function (x) { return x.sid === sid; })[0];
        if (!doc) return;
        var isLatest = D().latestDoc(doc.target) === doc;
        var logRows = (doc.log || []).map(function (l) {
            return '<div class="edu-hist-row"><span class="edu-hist-at">' + esc(l.at) + '</span>' +
                '<span class="edu-hist-type">' + esc(l.st) + '</span>' +
                '<span class="edu-hist-body">' + esc(l.memo || '') + '</span></div>';
        }).join('');
        var demo = isLatest && doc.status === '결재중'
            ? '<div class="rskdoc-demo"><b>결재 결과 수신 (시연)</b>' +
                '<p class="pdf-note">시스템이 스스로 결재하지 않습니다 — 온나라가 보낸 결과를 받는 자리입니다.</p>' +
                '<div class="rskdoc-demo-btns">' +
                    '<button type="button" class="btn btn-primary btn-sm" onclick="DYRSKDOC.receive(\'' + esc(sid) + '\',\'결재완료\')">결재 완료 회신</button>' +
                    '<button type="button" class="btn btn-outline btn-sm" onclick="DYRSKDOC.receiveReject(\'' + esc(sid) + '\')">반려 회신</button>' +
                '</div></div>'
            : (!isLatest ? '<p class="pdf-note-p">재상신되어 최신 건이 아닙니다 — 상태를 바꿀 수 없습니다.</p>' : '');
        var redraft = (isLatest && doc.status === '반려')
            ? '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal();DYRSKDOC.open(\'' + esc(doc.aid) + '\')">재기안</button>'
            : '';
        V().openModal('결재 상태 — ' + esc(doc.title),
            '<div class="rskdoc-status">' +
                '<table class="table-figma table-doc pdf-meta"><tbody>' +
                    '<tr><td class="k">문서번호</td><td><b>' + esc(doc.no) + '</b> <span class="pdf-note">(임시 채번)</span></td></tr>' +
                    '<tr><td class="k">상신일시</td><td>' + esc(doc.at) + '</td></tr>' +
                    '<tr><td class="k">결재선</td><td>' + esc(lineText(doc.line)) + '</td></tr>' +
                    '<tr><td class="k">상태</td><td><span class="chip-status ' + V().toneOf(doc.status) + ' chip-sm">' + esc(doc.status) + '</span></td></tr>' +
                '</tbody></table>' +
                '<div class="rskdoc-log">' + logRows + '</div>' + demo +
            '</div>',
            '<button type="button" class="btn btn-outline" onclick="DYRSKDOC.openDocSid(\'' + esc(sid) + '\')">문서 보기</button>' +
            redraft +
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>');
    }
    function receive(sid, status, memo) {
        var r = D().receiveDoc(sid, status, memo || '');
        if (r && r.error) { toast(r.error); return; }
        toast('온나라 결재 회신 수신 — ' + status);
        renderStatus(sid);
        refresh();
    }
    function receiveReject(sid) {
        var doc = D().docs().filter(function (x) { return x.sid === sid; })[0]; if (!doc) return;
        V().openModal('반려 회신 (시연)',
            '<div class="rskdoc-block"><label class="form-label" for="rskdoc-rj">반려 사유 <span class="rskdoc-req">*</span></label>' +
            '<textarea class="form-textarea" id="rskdoc-rj" rows="3" placeholder="온나라 결재자가 보낸 반려 사유"></textarea></div>',
            '<button type="button" class="btn btn-secondary" onclick="DYRSKDOC.renderStatus(\'' + esc(sid) + '\')">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="DYRSKDOC.doReject(\'' + esc(sid) + '\')">반려 회신</button>');
    }
    function doReject(sid) {
        var el = document.getElementById('rskdoc-rj');
        var r = ((el && el.value) || '').trim();
        if (!r) { toast('반려 사유를 입력하세요.'); return; }
        receive(sid, '반려', r);
    }

    /* ===================== 잠금 =====================
     * 상신된 평가의 확인 결과·증빙은 고칠 수 없다.
     * **모듈 전역 state 를 읽지 않는다** — EDUAPV 는 state.year 가 target 키까지 좌우해
     * 이력 화면에서 과거 문서를 한 번 열면 잠금이 조용히 풀리는 결함이 있다. 인자만 쓴다. */
    function lockOf(aid) {
        if (!aid) return null;
        var doc = D().latestDoc(targetKey(aid));
        if (!doc) return null;
        return (doc.status === '결재중' || doc.status === '결재완료') ? doc.status : null;
    }

    /* 화면 자동 갱신 — 소비처가 render 를 등록한다 */
    var REFRESH = [];
    function registerRefresh(fn) { if (typeof fn === 'function' && REFRESH.indexOf(fn) < 0) REFRESH.push(fn); }
    function refresh() { REFRESH.forEach(function (fn) { try { fn(); } catch (e) {} }); }

    global.DYRSKDOC = {
        open: open, preview: preview, back: back, print: print,
        confirmSend: confirmSend, send: send,
        capture: capture, insert: insert, setType: setType, setBasis: setBasis, setAttach: setAttach,
        onPickAttach: onPickAttach, delFile: delFile,
        pickOpen: pickOpen, pickApprover: pickApprover, addStep: addStep, delStep: delStep, resetLine: resetLine,
        openStatus: openStatus, openDocSid: openDocSid, renderStatus: renderStatus,
        receive: receive, receiveReject: receiveReject, doReject: doReject,
        lockOf: lockOf, registerRefresh: registerRefresh, lineText: lineText
    };
})(window);
