/* =====================================================================
   doc-flow.js · 공문 기안 → 미리보기 → 온나라 상신 **공용 골격** (전역 DYDOC)
   ---------------------------------------------------------------------
   이 시스템의 공문은 **한 골격만** 쓴다. 도메인(위험성평가·안전보건교육·…)은
   `DYDOC.define(cfg)` 로 **지면 내용과 저장 위치만** 얹는다.
   단계별 안내가 `DYTOUR` 하나로 모인 것과 같은 구조다(CLAUDE.md §4-3 선례).

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

    /* ===================== 사람 ===================== */
    function persona() {
        var R = global.DYROLE;
        return (R && R.current) ? R.current() : { name: '담당자', role: '담당', deptName: '재난안전과' };
    }
    function myDeptName() { return persona().deptName || '재난안전과'; }

    /* 단계 라벨 — **한 곳에서만 정한다**(2026-08-28 검수 E).
     * 「마지막이 결재, 나머지는 검토」라는 같은 규칙이 6벌로 흩어져 있었다(골격 인스턴스·
     * 동결본·예산·경영방침 3함수·DYROLE). 라벨을 바꿀 일이 생기면 여섯 곳을 찾아야 한다. */
    function stepLabel(i, len) { return i === len - 1 ? '결재' : '검토'; }
    function today() { return V().today(); }

    /* 붙임 한도 — **설정값**이다(CLAUDE.md §7-1 · 2026-10-07). 온나라 확인 전 기본값이고
     * 회신이 오면 여기 한 줄만 바꾼다. 시스템이 만드는 별지(이수자 명단 등)도 붙임 1개로 센다.
     * 넘는 파일을 상신 때 조용히 빼지 않도록 **고르는 단계에서** 막는다.
     * 용량은 파일에 크기가 있을 때만 더한다 — 모르는 크기를 0 으로 세어 합계를 지어내지 않는다. */
    var ATTACH_LIMIT = { count: 5, fileMB: 10, totalMB: 30 };

    /* =====================================================================
     * 결재선 — **공용 조각** (DYDOC.approvalLine)
     * ---------------------------------------------------------------------
     * 공문 골격(define)뿐 아니라 **자체 상신 흐름을 가진 도메인**도 이걸 쓴다 —
     * 예산 총괄표·전자문서 폼·경영방침·의견청취 점검결과지·인력평가가 그렇다.
     * 그 다섯은 지면과 상태머신이 서로 달라 골격 전체를 태울 수 없지만,
     * **결재선만은 같아야 한다**. 각자 짜면 §7 계열 신설이고, 실제로 그렇게 갈려서
     * 「팀장 → 과장 → 부군수」 같은 문구가 화면마다 따로 박혀 있었다.
     *
     *   cfg.ns       이 인스턴스가 놓일 전역 경로 (onclick 문자열이 이것으로 만들어진다)
     *   cfg.key      sessionStorage 키
     *   cfg.shape    { min, max } — 생략 시 { min:2, max:4 }
     *   cfg.capture  값 보존 훅 — 재렌더 전에 폼 입력을 담아 두는 도메인이 준다
     *   cfg.onChange 결재선이 바뀐 뒤 도메인이 다시 그릴 함수
     * ===================================================================== */
    function approvalLine(cfg) {
        cfg = cfg || {};
        var NS = cfg.ns;
        var LK = cfg.key;
        var LINE = null, editIdx = -1;
        function drafter() { return persona(); }
        function capture() { if (typeof cfg.capture === 'function') cfg.capture(); }
        function changed() { if (typeof cfg.onChange === 'function') cfg.onChange(); }

        /* ===================== 결재선 =====================
         * 전 도메인이 **기안 → 검토 → 결재 3단계**로 같다(2026-08-27 확정).
         * 종전에는 도메인마다 갈려 예산만 4단계(팀장·과장·부군수)였고 경영방침·평가·도급은
         * 결재선 데이터 없이 문구만 있었다. 하나로 모은 이유는 담당자가 도메인마다 다른
         * 결재선을 외우지 않게 하기 위해서다.
         *
         * ── 세 단계는 서로 다른 계정이어야 한다 (MUST) ───────────────────
         * 상신은 **결재선 전체를 한 번에** 온나라로 넘긴다(호출기안). 같은 계정이 두 단계에
         * 들어가면 온나라가 그 자리에서 거절한다. 그래서
         *   ① 결재선은 이름이 아니라 **uid** 로 저장하고(동명이인·개명에 견딘다),
         *   ② 기안자 자신과 이미 고른 사람은 **고르는 자리에서** 막고,
         *   ③ 상신 경로 전부에서 다시 검사한다 — 버튼만 막으면 전역 호출로 뚫린다.
         *
         * ── 결재권자를 코드에 고정하지 않는다 ────────────────────────────
         * 결재권자는 안전보건 법령이 아니라 **지자체 위임전결규칙** 소관이라 조직 개편·규칙
         * 개정으로 바뀐다. 기본값만 조직도에서 직위명으로 파생하고 변경은 ORGPICK 으로만
         * 받는다(새 select 금지). **찾지 못한 자리는 지어내 채우지 않고 미지정으로 드러낸다** —
         * 11개 부서 중 7곳은 팀장·과장이 조직도에 없어 자동으로 채워지지 않는다. */
        /* 단계 수 — 도메인이 `cfg.shape` 로 덮어쓸 수 있으나 지금은 전부 같다.
         * min 2 는 「검토 없는 결재선」을 막는다. max 4 는 위임전결규칙상 검토가 늘 수 있는
         * 여지이고, 늘리면 그만큼 계정이 더 필요하다는 뜻이라 무한히 열지 않는다. */
        function shape() {
            var s = cfg.shape || {};
            return { min: s.min || 2, max: s.max || 4 };
        }
        function blank() { return { uid: '', name: '', role: '', dept: '' }; }
        /* 기안자 본인은 건너뛴다 — 안 그러면 관리감독자가 기안할 때 기본 결재선에
         * 자기가 들어가 「기안자가 결재선에 있습니다」로 막히고, 담당자는 무엇을 고쳐야
         * 하는지 알 수 없다(2026-08-28 검수 C-3). 못 찾으면 **비워 드러낸다**. */
        function findRole(list, re) {
            var me = drafter().uid;
            for (var i = 0; i < list.length; i++) {
                if (me && list[i].uid === me) continue;
                if (re.test(list[i].role || '')) return list[i];
            }
            return null;
        }
        function defaultLine() {
            /* 직위 정규식은 **동결된 위험성평가 공문(js/rsk-doc.js)과 같아야 한다.**
               골격을 뽑아낼 때 여기만 좁게(과장|소장|실장) 복제돼 담양읍장·면장·국장을
               놓쳤고, 담양읍은 결재선 기본값이 통째로 비었다. */
            var ms = (global.DYV2 && DYV2.orgMembers) ? DYV2.orgMembers(drafter().deptId) : [];
            var lead = findRole(ms, /팀장/);
            var head = findRole(ms, /(과장|소장|실장|국장|읍장|면장)$/);
            var row = function (m) {
                return m ? { uid: m.uid, name: m.name, role: m.role, dept: m.deptName || '' } : blank();
            };
            /* **언제나 2행**을 돌려준다. 찾지 못해도 자리를 남기는 이유는 규칙을 화면에
               보이게 하기 위해서다 — 행이 사라지면 담당자는 검토 단계가 없는 줄 안다. */
            return [row(lead), row(head)];
        }
        function line() {
            if (LINE) return LINE;
            try { LINE = JSON.parse(global.sessionStorage.getItem(LK) || 'null'); } catch (e) { LINE = null; }
            /* 옛 저장분은 `{role,name}` 만 있고 uid 가 없다. **이름으로 uid 를 추정하지 않는다** —
               동명이인에서 엉뚱한 계정으로 상신된다. 통째로 기본값으로 되돌린다. */
            if (LINE && LINE.some(function (s) { return s && s.name && !s.uid; })) LINE = null;
            if (!LINE || !LINE.length) LINE = defaultLine();
            return LINE;
        }
        function saveLine() { try { global.sessionStorage.setItem(LK, JSON.stringify(LINE || [])); } catch (e) {} }
        /* by: 저장된 기안자 이름. 주면 그걸 쓰고, 없으면 지금 사람(기안 중)이다.
           저장된 문서를 다른 계정으로 열 때 기안자가 바뀌지 않게 한다(검수 C-2). */
        function lineText(L, by) {
            L = L || line();
            return ['기안 ' + (by || drafter().name)].concat(L.map(function (s, i) {
                return stepLabel(i, L.length) + ' ' + (s.name || '(미지정)');
            })).join(' → ');
        }

        /* ── 중복 금지 — 판정은 여기 한 곳이다 ──────────────────────────
         * 화면마다 검사하면 반드시 빠뜨리는 곳이 생긴다(교육 addEnroll 중복 방지와 같은 근거). */
        function lineIssues(L) {
            L = L || line();
            var sh = shape(), out = [], me = drafter();
            if (L.length < sh.min) out.push('결재선은 최소 ' + sh.min + '단계입니다 — 지금은 ' + L.length + '단계입니다.');
            var miss = L.filter(function (s) { return !s.uid; }).length;
            if (miss) out.push('지정하지 않은 단계가 ' + miss + '건 있습니다 — 조직도에서 결재자를 고르세요.');
            var seen = {};
            L.forEach(function (s, i) {
                if (!s.uid) return;
                if (me.uid && s.uid === me.uid) {
                    out.push(stepLabel(i, L.length) + ' 단계에 기안자(' + me.name + ')가 지정돼 있습니다 — 기안·검토·결재는 서로 다른 사람이어야 합니다.');
                }
                if (seen[s.uid]) out.push(s.name + ' 님이 두 단계에 지정돼 있습니다 — 한 사람이 두 번 결재할 수 없습니다.');
                seen[s.uid] = true;
            });
            return out;
        }
        function lineReady(L) {
            var iss = lineIssues(L);
            return iss.length ? { ok: false, why: iss[0] } : { ok: true };
        }
        /* 상신 경로 공통 게이트 — preview 는 막지 않는다(문서를 못 보게 할 이유가 없다). */
        function lineDenied() {
            var r = lineReady();
            if (r.ok) return false;
            toast(r.why);
            return true;
        }

        /* ── 조직도 ────────────────────────────────────────────────────
         * 'member'(표시 문자열) 가 아니라 **'memberUid'** 를 쓴다 — 온나라 결재선은 계정
         * 식별자 배열이라 이름만으로는 만들 수 없다. leadership 을 켜는 이유는 위임전결
         * 규칙상 부군수·군수가 결재권자로 서는 문서가 있는데 종전 조직도에는 그 사람들이
         * 아예 나오지 않았기 때문이다. */
        function pickBlocked(i) {
            var out = {}, me = drafter(), L = line();
            if (me.uid) out[me.uid] = '기안자';
            L.forEach(function (s, j) {
                if (j !== i && s.uid) out[s.uid] = stepLabel(j, L.length) + ' 지정됨';
            });
            return out;
        }
        /* **한 번에 한 패널만 연다** — 두 패널이 동시에 열리면 선택 대상 인덱스(editIdx)가
         * 마지막으로 연 것으로 덮여, 먼저 연 패널에서 고른 사람이 **다른 단계에 들어간다**
         * (2026-08-28 검수 C-1 재현). 같은 인덱스를 다시 누르면 ORGPICK 이 토글로 닫는다. */
        function closeOtherPicks(i) {
            var L = line();
            for (var j = 0; j < L.length; j++) {
                if (j === i) continue;
                var f = global.document.getElementById(NS + '-ln-' + j);
                var open = f && f.querySelector('.org-inline');
                if (open) open.remove();
            }
        }
        function pickOpen(i) {
            closeOtherPicks(i);
            editIdx = i;
            global.ORGPICK.toggle(NS + '-ln-' + i, 'memberUid', NS + '.pickApprover',
                { leadership: true, disabled: pickBlocked(i) });
        }
        function pickApprover(uid, name, role, team, m) {
            var L = line();
            if (editIdx < 0 || !L[editIdx]) return;   /* 어느 단계인지 잃었으면 아무 데도 넣지 않는다 */
            if (L[editIdx]) {
                L[editIdx] = { uid: uid, name: name, role: role, dept: (m && m.deptName) || '' };
            }
            saveLine(); changed();
        }
        function addStep() {
            capture(); var L = line(), sh = shape();
            if (L.length >= sh.max) {
                toast('결재선은 최대 ' + sh.max + '단계입니다 — 단계마다 다른 계정이 필요합니다.');
                return;
            }
            L.splice(L.length - 1, 0, blank());   /* 검토를 늘린다 — 결재는 늘 마지막이다 */
            saveLine(); changed();
        }
        function delStep(i) {
            capture(); var L = line(), sh = shape();
            if (L.length <= sh.min) { toast('결재선은 최소 ' + sh.min + '단계입니다 — 검토 없이 결재만 올릴 수 없습니다.'); return; }
            L.splice(i, 1); saveLine(); changed();
        }
        function resetLine() { capture(); LINE = defaultLine(); saveLine(); changed(); toast('기본 결재선으로 되돌렸습니다.'); }
        function lineEditorHtml() {
            var L = line(), iss = lineIssues(L);
            return '<div class="rskdoc-line">' +
                /* 안내는 담당자가 할 일만 — 상신 방식(호출기안)·위임전결규칙 설명은 주석에만 둔다(운영 T30).
                   «서로 다른 사람» 규칙은 어겼을 때 아래 경고가 말한다. */
                '<div class="rskdoc-line-head"><b>결재선</b>' +
                    '<span class="file-hint">조직도에서 검토자·결재자를 고르세요</span>' +
                    '<span class="spacer"></span>' +
                    '<button type="button" class="btn btn-sm btn-outline" onclick="' + NS + '.addStep()">＋ 검토</button> ' +
                    '<button type="button" class="btn btn-sm btn-outline" onclick="' + NS + '.resetLine()">기본값</button>' +
                '</div>' +
                /* 결재선 행은 **이미 있는 계열**(.rskdoc-ln-row / -step / -pick)로 그린다.
                   골격을 분리할 때 여기만 새 이름(.rskdoc-ln·-ln-k·-line-body)을 만들어
                   CSS 가 하나도 붙지 않았다 — 계열을 새로 만들지 않는다(CLAUDE.md §7). */
                '<div class="rskdoc-ln-row">' +
                    '<span class="rskdoc-ln-step">기안</span>' +
                    '<div class="rskdoc-ln-pick"><b>' + esc(drafter().name) + '</b>' +
                        '<span class="file-hint">' + esc(drafter().role || '') + '</span></div>' +
                '</div>' +
                L.map(function (s, i) {
                    /* 지휘부 노드는 부서명 = 직위명이라(군수·부군수) 그대로 이으면
                       「군수 군수 김담양」이 된다 — 같으면 한 번만 쓴다(검수 E). */
                    var val = s.name ? [s.dept, (s.dept === s.role ? '' : s.role), s.name].filter(Boolean).join(' ') : '';
                    return '<div class="rskdoc-ln-row">' +
                        '<span class="rskdoc-ln-step">' + stepLabel(i, L.length) + '</span>' +
                        '<div class="orgpick-field" id="' + NS + '-ln-' + i + '">' +
                            '<div class="rskdoc-ln-pick">' +
                                '<input type="text" class="form-input" readonly placeholder="조직도에서 결재자를 선택하세요"' +
                                    ' aria-label="' + stepLabel(i, L.length) + ' 결재자"' +
                                    ' value="' + esc(val) + '">' +
                                '<button type="button" class="btn btn-sm btn-outline" onclick="' + NS + '.pickOpen(' + i + ')">조직도</button>' +
                                (L.length > shape().min ? '<button type="button" class="btn btn-sm btn-outline" onclick="' + NS + '.delStep(' + i + ')"' +
                                    ' aria-label="' + stepLabel(i, L.length) + ' 단계 삭제">×</button>' : '') +
                            '</div>' +
                        '</div>' +
                    '</div>';
                }).join('') +
                /* 규칙은 **상신 직전이 아니라 지금** 보인다 — 기안을 다 쓰고 나서야
                   결재선이 틀렸다고 알리면 담당자는 처음부터 다시 확인해야 한다. */
                (iss.length
                    ? '<div class="rskdoc-lock-warn"><b>결재선을 확인하세요</b><br>' +
                        iss.map(function (w) { return '<span class="file-hint">· ' + esc(w) + '</span>'; }).join('<br>') + '</div>'
                    : '<p class="file-hint">' + esc(lineText(L)) + ' — 상신할 수 있습니다.</p>') +
            '</div>';
        }
        /* 상신 확정 시 문서에 실어 보낼 값 — 이름이 아니라 **계정 식별자 배열**이 정본이다 */
        function snapshot() {
            return { by: drafter().name, byUid: drafter().uid || '', line: line().slice(), lineText: lineText() };
        }
        function clear() { LINE = null; try { global.sessionStorage.removeItem(LK); } catch (e) {} }

        return {
            line: line, lineText: lineText, lineIssues: lineIssues, lineReady: lineReady,
            lineDenied: lineDenied, lineEditorHtml: lineEditorHtml, snapshot: snapshot, clear: clear,
            pickOpen: pickOpen, pickApprover: pickApprover,
            addStep: addStep, delStep: delStep, resetLine: resetLine,
            stepLabel: stepLabel
        };
    }

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
     *   lineShape     결재선 단계 수 { min, max } — 생략하면 { min:2, max:4 } 다.
     *                 min 2 는 기안 제외 **검토+결재** 두 단계이고, 이것이 곧 「기안 →
     *                 검토 → 결재」다. 전 도메인이 같으므로 **선언하지 않는 것이 기본**이고,
     *                 다르게 쓰려면 그 도메인의 위임전결 근거를 §6 에 적는다.
     * ========================================================================= */
    function define(cfg) {
        var NS = cfg.ns;
        var F = null;            /* 기안 폼 상태 */
        var REFRESH = [];

        /* 결재선 — 공용 조각에 위임한다(§7-1). api 표면은 그대로 두어 onclick 경로가 바뀌지 않는다. */
        var LN = approvalLine({
            ns: NS, key: cfg.lkey, shape: cfg.lineShape,
            capture: function () { capture(); }, onChange: function () { renderDraft(); }
        });
        var line = LN.line, lineText = LN.lineText, lineIssues = LN.lineIssues;
        var lineReady = LN.lineReady, lineDenied = LN.lineDenied, lineEditorHtml = LN.lineEditorHtml;

        /* ===================== 기안 폼 =====================
         * **본문은 자동 생성하지 않는다.** 발주처: "이게 다 직접 타이핑 하셔야 돼".
         * 자동 연결에 합의된 것은 붙임뿐이고, 시스템은 수치를 세어 '삽입' 칩으로 건넬 뿐이다. */
        /* 기안·상신 **권한** — `ready`(기안 조건)와 다른 축이다.
         * ready 는 "이 건이 기안할 수 있는 상태인가"(예: 종료 처리됐는가),
         * canDraft 는 "이 사람이 이 건을 기안해도 되는가"를 묻는다.
         * 도메인이 주지 않으면 종전대로 열어 둔다 — 동결된 위험성평가 공문은
         * 자체 구현이라 영향이 없고, 훅을 안 준 도메인의 화면도 흔들리지 않는다. */
        function permit(t) { return cfg.canDraft ? cfg.canDraft(t) : { ok: true }; }
        /* 권한과 기안 조건을 **네 경로(기안·미리보기·확인·상신) 모두**에서 본다.
         * 종전에는 기안 조건(ready)을 기안 폼을 열 때만 봐서, 폼을 연 뒤의 전역 호출은
         * 조건을 다시 지나지 않았다(운영 23건 #1 — 진행 중 교육에 기안이 열렸다). */
        function denied(t) {
            var r = permit(t);
            if (!r.ok) { toast(r.why || '이 공문을 기안할 권한이 없습니다.'); return true; }
            var rd = cfg.ready ? cfg.ready(t) : { ok: true };
            if (!rd.ok) { toast(rd.why || '아직 기안할 수 없습니다.'); return true; }
            return false;
        }
        function open(id) {
            var t = cfg.targetOf(id);
            if (!t) { toast('대상을 찾지 못했습니다.'); return; }
            /* **버튼을 감추는 것만으로는 부족하다** — 전역 호출로 뚫린다.
               기안·미리보기·확인·상신 네 경로에 모두 건다. */
            if (denied(t)) return;
            /* cfg.initOf(t) — 문서 종류·수신의 기본값(선택). 부서에 시달하는 공문(이행점검 배포)은
               «외부발송 · 수신자 참조»로 시작한다. 주지 않으면 종전대로 내부결재. */
            var init = cfg.initOf ? (cfg.initOf(t) || {}) : {};
            F = {
                id: id, docType: init.docType || '내부결재',
                /* init.title · init.body — 반려·반송된 공문을 다시 기안할 때 앞 기안의 제목·본문을 이어 쓴다(선택).
                   init.notice — 기안 폼 맨 위에 띄울 한 줄(예: 반려 사유). 주지 않으면 종전과 같다. */
                title: init.title != null ? init.title : (cfg.titleOf ? cfg.titleOf(t) : ''),
                to: init.to || '', body: init.body || '', notice: init.notice || '',
                attach: (cfg.attachOf ? cfg.attachOf(t) : []).map(function (a) {
                    /* a.on — 반드시 실려야 하는 붙임(배포 공문의 점검표 양식)은 미리 고른 채 시작한다 */
                    return { label: a.label, meta: a.meta || '', on: !!a.on, size: (a.size > 0 ? +a.size : null) };
                }),
                basis: {}, annex: true
            };
            /* 수신처(cfg.recipientsDefault) — 공용 조직도로 고르는 부서 목록. 기본값은 도메인이 정한다 */
            if (cfg.recipientsDefault) {
                F.rc = {}; (cfg.recipientsDefault(t) || []).forEach(function (id) { F.rc[id] = true; });
                F.rcOpen = false;
            }
            renderDraft();
        }
        function rcIds() { return F && F.rc ? Object.keys(F.rc).filter(function (k) { return F.rc[k]; }) : []; }
        function rcName(id) { return cfg.recipientName ? cfg.recipientName(id) : id; }
        /* 수신처 이름 — 저장된 문서면 그때 고른 값, 기안 중이면 지금 고른 값 */
        function recipientNames(t, doc) {
            if (doc && doc.recipients) return doc.recipients.map(rcName);
            if (!doc && F && F.rc) return rcIds().map(rcName);
            return cfg.recipientsOf ? cfg.recipientsOf(t, doc) : [];
        }
        function rcSel() { return F && F.rc ? F.rc : {}; }
        /* 조직도에서 하나 켜고 끌 때 — 창을 다시 그리지 않는다(검색어·스크롤 보존, CLAUDE.md §3 ORGPICK) */
        function rcTog(id, on) {
            if (!F || !F.rc) return;
            if (on) F.rc[id] = true; else delete F.rc[id];
            syncRc();
        }
        function rcReset() {
            if (!F || !cfg.recipientsDefault) return;
            capture(); F.rc = {}; (cfg.recipientsDefault(cfg.targetOf(F.id)) || []).forEach(function (id) { F.rc[id] = true; });
            renderDraft();
        }
        function rcToggle() { capture(); F.rcOpen = !F.rcOpen; renderDraft(); }
        function rcSummaryHtml() {
            var t = cfg.targetOf(F.id), ids = rcIds();
            var warn = cfg.recipientWarn ? cfg.recipientWarn(t, ids) : '';
            return '<p style="margin:0;">' + esc(F.to || '수신자 참조') + ' — <b>' + ids.length + '곳</b> ' +
                '<span class="file-hint">' + esc(ids.map(rcName).join(', ') || '(수신처 없음)') + '</span></p>' +
                (warn ? '<p class="file-hint" style="color:var(--status-warning-fg); margin:4px 0 0;">' + warn + '</p>' : '');
        }
        function syncRc() {
            var el = global.document.getElementById(NS + '-rc-sum');
            if (el) el.innerHTML = rcSummaryHtml();
        }
        function capture() {
            if (!F) return;
            var el = function (k) { return global.document.getElementById(NS + '-' + k); };
            if (el('title')) F.title = el('title').value;
            if (el('to')) F.to = el('to').value;
            if (el('body')) F.body = el('body').value;
        }
        function setType(v) { capture(); F.docType = v; renderDraft(); }

        /* ── 붙임 한도 ──────────────────────────────────────────────── */
        function limit() { return cfg.attachLimit || ATTACH_LIMIT; }
        function annexCount() {
            if (!F || !F.annex || !cfg.annexes) return 0;
            return cfg.annexes(cfg.targetOf(F.id), null).length;
        }
        function attachCount() {
            return F.attach.filter(function (a) { return a.on; }).length + annexCount();
        }
        /* 고른 파일이 모두 크기를 알 때만 합계를 낸다(MB). 하나라도 모르면 null. */
        function attachTotalMB() {
            var on = F.attach.filter(function (a) { return a.on; });
            if (on.some(function (a) { return a.size == null; })) return null;
            return on.reduce(function (n, a) { return n + a.size; }, 0) / (1024 * 1024);
        }
        function mb(n) { return (Math.round(n * 10) / 10).toFixed(1); }
        function attachSumText() {
            var L = limit(), tot = attachTotalMB();
            return '붙임 ' + attachCount() + ' / ' + L.count + '개' +
                (tot == null ? '' : ' · 합계 ' + mb(tot) + ' / ' + L.totalMB + 'MB');
        }
        function attachIssue() {
            if (!F) return '';
            var L = limit();
            if (attachCount() > L.count) return '붙임은 ' + L.count + '개까지 붙일 수 있습니다.';
            var big = F.attach.filter(function (a) { return a.on && a.size != null && a.size > L.fileMB * 1024 * 1024; })[0];
            if (big) return big.label + ' — 파일당 ' + L.fileMB + 'MB까지 붙일 수 있습니다.';
            var tot = attachTotalMB();
            if (tot != null && tot > L.totalMB) return '붙임 합계는 ' + L.totalMB + 'MB까지입니다.';
            return '';
        }
        function syncAttachSum() {
            var el = global.document.getElementById(NS + '-attach-sum');
            if (el) el.textContent = attachSumText();
        }
        function setAttach(i, on) {
            capture();
            if (!F.attach[i]) return;
            F.attach[i].on = !!on;
            var why = on ? attachIssue() : '';
            if (why) { F.attach[i].on = false; toast(why); renderDraft(); return; }
            syncAttachSum();
        }
        function setAnnex(on) {
            capture(); F.annex = !!on;
            var why = on ? attachIssue() : '';
            if (why) { F.annex = false; toast(why); }
            renderDraft();
        }
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
            return '<div class="rskdoc-inslist">' + list.map(function (c) {
                return '<button type="button" class="btn btn-sm btn-outline" onclick="' + NS + '.insert(' +
                    JSON.stringify(c.text).replace(/"/g, '&quot;') + ')">＋ ' + esc(c.label) + '</button>';
            }).join('') + '</div>';
        }
        function attachPickHtml() {
            if (!F.attach.length) {
                return '<p class="file-hint">붙일 수 있는 파일이 없습니다 — 교육·평가에 올려 둔 파일이 붙임 후보가 됩니다.</p>';
            }
            var L = limit();
            return '<div class="rskdoc-cks">' + F.attach.map(function (a, i) {
                /* 파일당 한도를 넘는 파일은 고를 수 없게 두고 이유를 그 자리에 쓴다(SCR-EDU-004 §4-5) */
                var big = a.size != null && a.size > L.fileMB * 1024 * 1024;
                return '<label class="rskdoc-ck"><input type="checkbox"' + (a.on && !big ? ' checked' : '') + (big ? ' disabled' : '') +
                    ' onchange="' + NS + '.setAttach(' + i + ', this.checked)">' +
                    '<span><b>' + esc(a.label) + '</b>' + (a.meta ? ' <span class="file-hint">' + esc(a.meta) + '</span>' : '') +
                    (big ? ' <span class="file-hint">온나라 붙임 한도(파일당 ' + L.fileMB + 'MB) 초과 — 시스템에는 남아 있고 공문에는 붙지 않습니다</span>' : '') +
                    '</span></label>';
            }).join('') + '</div>';
        }
        function basisHtml(t) {
            var list = cfg.basisOf ? cfg.basisOf(t) : [];
            if (!list.length) return '';
            return '<div class="rskdoc-block"><label class="form-label">관련 근거 <span class="file-hint">고른 것만 지면에 실립니다</span></label>' +
                '<div class="rskdoc-cks">' + list.map(function (b) {
                    return '<label class="rskdoc-ck"><input type="checkbox"' + (F.basis[b.key] ? ' checked' : '') +
                        ' onchange="' + NS + '.setBasis(\'' + b.key + '\', this.checked)"><span>' + esc(b.label) + '</span></label>';
                }).join('') + '</div></div>';
        }

        /* ===== 단순 기안(cfg.simple) — 운영 결정(2026-11-06 «온나라로 기안까지만»)을 따르는 도메인용 =====
         * 결재선을 받지 않는다(검토·결재는 온나라 기안함에서 지정). 문서 종류·수신·붙임은 도메인이 정한 값으로
         * 고정해 보여만 주고, 담당자는 **제목과 본문만** 쓴다. 지면 서명란은 기안자만, 버튼은 «온나라로 보내기». */
        var SIMPLE = !!cfg.simple;
        function renderSimple(t) {
            var rc = recipientNames(t, null);
            var att = F.attach.filter(function (a) { return a.on; }).map(function (a) { return a.label; })
                .concat(F.annex && cfg.annexes ? cfg.annexes(t, null).map(function (x) { return x.title + '(별지)'; }) : []);
            V().openModal('공문 기안 — ' + esc(cfg.subjectOf ? cfg.subjectOf(t) : ''),
                '<div class="rskdoc-draft">' +
                    noticeHtml() +
                    (F.rc
                        ? '<div class="rskdoc-block"><label class="form-label">수신 <span class="roc-req">*</span> ' +
                              '<span class="file-hint">기본값은 ' + esc(cfg.recipientsDefaultLabel || '도메인 기본 수신처') + '입니다</span></label>' +
                              '<div id="' + NS + '-rc-sum">' + rcSummaryHtml() + '</div>' +
                              '<div style="display:flex; gap:6px; margin-top:6px;">' +
                                  '<button type="button" class="btn btn-sm btn-outline" onclick="' + NS + '.rcToggle()">' + (F.rcOpen ? '조직도 접기' : '조직도에서 수신처 고르기') + '</button>' +
                                  '<button type="button" class="btn btn-sm btn-outline" onclick="' + NS + '.rcReset()">기본값으로</button>' +
                              '</div>' +
                              (F.rcOpen && global.ORGPICK ? '<div style="margin-top:6px;">' + global.ORGPICK.deptsPanel(NS + '-rcpanel', { selectedPath: NS + '.rcSel', onToggle: NS + '.rcTog' }) + '</div>' : '') +
                          '</div>'
                        : '<div class="rskdoc-block"><label class="form-label">수신</label>' +
                              /* 내부결재(교육 실시 결과 보고 등)는 수신자가 없다 — 지면과 같은 말을 쓴다 */
                              '<p style="margin:0;">' + (F.docType === '외부발송'
                                  ? esc(F.to || '수신자 참조') + (rc.length ? ' — <b>' + rc.length + '곳</b> <span class="file-hint">' + esc(rc.join(', ')) + '</span>' : '')
                                  : '내부결재') + '</p></div>') +
                    '<div class="rskdoc-block"><label class="form-label" for="' + NS + '-title">제목 <span class="roc-req">*</span></label>' +
                        '<input type="text" class="form-input" id="' + NS + '-title" value="' + esc(F.title) + '"></div>' +
                    '<div class="rskdoc-block"><label class="form-label" for="' + NS + '-body">본문 <span class="roc-req">*</span>' +
                        ' <span class="file-hint">직접 작성합니다 — 아래 조각을 눌러 넣을 수 있습니다</span></label>' +
                        chipsHtml(t) +
                        '<textarea class="form-textarea" id="' + NS + '-body" rows="8" placeholder="공문 본문을 직접 입력하세요.">' + esc(F.body) + '</textarea></div>' +
                    /* cfg.simplePick — 붙임을 «이미 올려 둔 파일에서 고르는» 도메인(교육 실시 결과 공문, 2026-11-12 E-4).
                       결재선만 걷고 붙임 고르기·별지·관련 근거는 종전 기안 폼과 같다. 기본(고정 붙임)은 배포 공문용. */
                    (cfg.simplePick
                        ? basisHtml(t) +
                          '<div class="rskdoc-block"><label class="form-label">붙임 <span class="file-hint">이미 올려 둔 파일에서 고릅니다</span></label>' +
                              attachPickHtml() +
                              ((cfg.annexes && cfg.annexes(t, null).length)
                                  ? '<label class="rskdoc-ck" style="margin-top:6px;"><input type="checkbox"' + (F.annex ? ' checked' : '') +
                                      ' onchange="' + NS + '.setAnnex(this.checked)"><span><b>붙임 별지</b> <span class="file-hint">' +
                                      esc(cfg.annexes(t, null).map(function (x) { return x.title; }).join(' · ')) + '</span></span></label>'
                                  : '') +
                              '<p class="file-hint" id="' + NS + '-attach-sum" aria-live="polite">' + esc(attachSumText()) + '</p></div>'
                        : '<div class="rskdoc-block"><label class="form-label">붙임</label>' +
                              (att.length ? '<p style="margin:0;">' + att.map(function (n, i) { return (i + 1) + '. ' + esc(n); }).join('<br>') + '</p>' : '<p class="file-hint">없음</p>') +
                              '<p class="file-hint" id="' + NS + '-attach-sum">' + esc(attachSumText()) + '</p></div>') +
                '</div>',
                '<span class="rskdoc-foot-note">검토·결재는 온나라 기안함에서 지정합니다.</span>' +
                '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
                '<button type="button" class="btn btn-primary" onclick="' + NS + '.preview()">문서 미리보기 →</button>');
        }
        /* 기안 폼 맨 위 한 줄 — 반려·반송 뒤 다시 기안할 때 사유를 보이며 고치게 한다(cfg.initOf 의 notice) */
        function noticeHtml() {
            return F && F.notice ? '<div class="check-notice" style="margin-bottom:10px;">' + esc(F.notice) + '</div>' : '';
        }
        function renderDraft() {
            var t = cfg.targetOf(F.id);
            if (SIMPLE) { renderSimple(t); return; }
            var out = F.docType === '외부발송';
            V().openModal('공문 기안 — ' + esc(cfg.subjectOf ? cfg.subjectOf(t) : ''),
                '<div class="rskdoc-draft">' +
                    noticeHtml() +
                    '<div class="rskdoc-block"><label class="form-label" for="' + NS + '-type">문서 종류</label>' +
                        '<select class="form-select" id="' + NS + '-type" onchange="' + NS + '.setType(this.value)">' +
                            ['내부결재', '외부발송'].map(function (k) {
                                return '<option value="' + k + '"' + (F.docType === k ? ' selected' : '') + '>' + k + '</option>';
                            }).join('') + '</select></div>' +
                    '<div class="rskdoc-block"><label class="form-label" for="' + NS + '-title">제목 <span class="roc-req">*</span></label>' +
                        '<input type="text" class="form-input" id="' + NS + '-title" value="' + esc(F.title) + '"></div>' +
                    (out
                        ? '<div class="rskdoc-block"><label class="form-label" for="' + NS + '-to">수신</label>' +
                            '<input type="text" class="form-input" id="' + NS + '-to" value="' + esc(F.to) + '" placeholder="예: 수신자 참조"></div>'
                        : '') +
                    '<div class="rskdoc-block"><label class="form-label" for="' + NS + '-body">본문 <span class="roc-req">*</span>' +
                        ' <span class="file-hint">직접 작성합니다 — 아래 조각을 눌러 넣을 수 있습니다</span></label>' +
                        chipsHtml(t) +
                        '<textarea class="form-textarea" id="' + NS + '-body" rows="8" placeholder="공문 본문을 직접 입력하세요.">' + esc(F.body) + '</textarea></div>' +
                    basisHtml(t) +
                    '<div class="rskdoc-block"><label class="form-label">붙임 <span class="file-hint">이미 올려 둔 파일에서 고릅니다</span></label>' +
                        attachPickHtml() +
                        ((cfg.annexes && cfg.annexes(t, null).length)
                            ? '<label class="rskdoc-ck" style="margin-top:6px;"><input type="checkbox"' + (F.annex ? ' checked' : '') +
                                ' onchange="' + NS + '.setAnnex(this.checked)"><span><b>붙임 별지</b> <span class="file-hint">' +
                                esc(cfg.annexes(t, null).map(function (x) { return x.title; }).join(' · ')) + '</span></span></label>'
                            : '') +
                        /* 한도 안내는 수치만(운영 T30) — 별지도 개수에 들어간다 */
                        '<p class="file-hint" id="' + NS + '-attach-sum" aria-live="polite">' + esc(attachSumText()) + '</p>' +
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
        /* **기안자는 저장값에서 읽는다** — 저장된 문서를 다른 계정으로 열면 지면의
         * 기안자가 그 계정으로 바뀌던 결함이 있었다(2026-08-28 검수 C-2). 3계정 전환
         * 시연에서 바로 드러난다. `doc` 이 있으면 그때 상신한 사람, 없으면(기안 중
         * 미리보기) 지금 사람이다. 직위는 상신 당시 값을 따로 저장하지 않으므로
         * 조직도에서 uid 로 되찾고, 못 찾으면 비워 이름만 낸다. */
        function drafterOf(doc) {
            if (!doc) { var p = persona(); return { name: p.name, role: p.role || '담당' }; }
            var m = (doc.byUid && V().orgMemberByUid) ? V().orgMemberByUid(doc.byUid) : null;
            return { name: doc.by || (m && m.name) || '', role: (m && m.role) || '' };
        }
        function signLineHtml(L, doc) {
            var p = drafterOf(doc);
            if (SIMPLE) return '<div class="pdf-gm-sign"><span class="pdf-gm-sign-i"><b>기안자</b> ' + esc(p.role || '담당') + ' ' + esc(p.name) +
                '</span><span class="pdf-gm-sign-i"><span class="pdf-dash">검토·결재 — 온나라 기안함에서 지정</span></span></div>';
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
        /* 관련 근거 — 담당자가 기안 폼에서 **고른 것만** 지면에 싣는다. 하나도 안 골랐으면 줄 자체가 없다.
           표기는 DYLAW 가 만든다(CLAUDE.md §10 — 화면이 조문 표기를 조립하지 않는다). 기안 중에는 F.basis({key:true}),
           저장된 문서는 doc.basis([key]) 다. 근거 후보를 주지 않는 도메인(배포·요청 공문)은 늘 비어 있어 지면이 그대로다. */
        function basisKeys(src) {
            var b = src && src.basis;
            if (!b) return [];
            return Array.isArray(b) ? b.slice() : Object.keys(b).filter(function (k) { return b[k]; });
        }
        function basisLabel(t, key) {
            var L = global.DYLAW;
            if (L && L.shortRef && L.basisTitle && L.basisTitle(key)) return L.shortRef(key) + ' ' + L.basisTitle(key);
            var hit = (cfg.basisOf ? cfg.basisOf(t) : []).filter(function (b) { return b.key === key; })[0];
            return hit ? hit.label : key;
        }
        function basisRowHtml(t, src) {
            var keys = basisKeys(src);
            if (!keys.length) return '';
            return '<div class="pdf-gm-row"><span class="k">근거</span><span class="v">' +
                keys.map(function (k) { return esc(basisLabel(t, k)); }).join('<br>') + '</span></div>';
        }
        function paperMain(t, doc) {
            var src = doc || F;
            var L = doc ? doc.line : line();
            var out = src.docType === '외부발송';
            var no = doc && doc.no ? doc.no : '';
            /* 결재완료로 회신된 문서는 온나라가 준 생산등록번호·결재일을 싣는다 — «임시 채번»은 결재 전 연계 번호에만 붙인다(2026-11-13) */
            var prod = doc && doc.status === '결재완료' ? (doc.prodNo || doc.regNo || '') : '';
            var noCell = prod
                ? esc(prod) + '(' + esc(doc.apprDate || doc.doneAt || (doc.at ? String(doc.at).slice(0, 10) : today())) + ')'
                : no
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
                    basisRowHtml(t, src) +
                '</div>' +
                bodyDocHtml(src.body) +
                attachDocHtml(attachNames(t, doc)) +
                (out ? '<div class="pdf-gm-issuer">담 양 군 수<span class="pdf-doc-seal">관인</span></div>' : '') +
                /* 수신자 목록(선택) — «수신자 참조»로 보낼 때 받는 부서를 지면에 적는다(cfg.recipientsOf) */
                ((out && recipientNames(t, doc).length)
                    ? '<div class="pdf-gm-frow"><span class="k">수신자</span><span class="v">' + recipientNames(t, doc).map(esc).join(', ') + '</span></div>'
                    : '') +
                '<div class="pdf-gm-foot">' +
                    signLineHtml(L, doc) +
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
                    '<div class="pdf-gm-annex-h">[붙임 ' + (i + 1) + '] ' + esc(a.title) + '</div>' + a.html + '</div>';
            }).join('');
        }

        function preview() {
            /* 기안 폼을 거치지 않고 전역 호출로 들어오면 F 가 없다 — 크래시 대신 조용히 막는다 */
            if (!F) { toast('먼저 [공문 기안]으로 문서를 작성하세요.'); return; }
            capture();
            if (denied(cfg.targetOf(F.id))) return;
            if (!String(F.title || '').trim()) { toast('공문 제목을 입력하세요.'); return; }
            if (!String(F.body || '').trim()) { toast('공문 본문을 입력하세요.'); return; }
            if (F.rc && !rcIds().length) { toast('수신처를 1곳 이상 고르세요.'); return; }
            var t = cfg.targetOf(F.id);
            /* 상신을 막는 사유 — 결재선과 붙임 한도. 미리보기 자체는 막지 않고 버튼 자리에 사유를 쓴다 */
            var sendWhy = (!SIMPLE && !lineReady().ok) ? lineReady().why + ' [← 수정]에서 결재선을 고치세요.'
                : attachIssue() ? attachIssue() + ' [← 수정]에서 붙임을 줄이세요.' : '';
            V().openModal('문서 미리보기 — ' + esc(F.title),
                /* 좁은 화면에서 지면이 왼쪽으로 밀리는 것을 막는 래퍼 — 규칙은 .rskdoc-preview(css/v2.css) */
                '<div class="rskdoc-preview">' +
                    '<div>' + paperHtml(t, null) + '</div></div>',
                /* 결재선이 규칙에 안 맞아도 **미리보기 자체는 막지 않는다** — 문서를 못 보게
                   할 이유가 없다. 대신 상신 버튼을 잠그고 **무엇이 걸렸는지** 그 자리에 쓴다.
                   누르면 거절하는 버튼을 남기면 담당자가 이유를 모른 채 두 번 누른다. */
                '<button type="button" class="btn btn-secondary" onclick="' + NS + '.back()">← 수정</button>' +
                (!sendWhy
                    ? '<button type="button" class="btn btn-primary" onclick="' + NS + '.confirmSend()">' + (SIMPLE ? '온나라로 보내기' : '온나라로 결재 상신') + '</button>'
                    : '<span class="rskdoc-foot-note">' + esc(sendWhy) + '</span>'),
                { variant: 'wide', headHtml: '<button type="button" class="btn btn-sm btn-outline pdf-noprint" onclick="' + NS + '.print()">PDF 저장 / 인쇄</button>' });
        }
        function back() { if (!F) return; renderDraft(); }
        function print() { global.print(); }

        /* ===================== 상신 =====================
         * 확인 단계는 **되돌릴 수 없다는 사실만** 말한다. 문서·붙임·결재선은 바로 앞
         * 미리보기 지면에 이미 있으므로 표로 반복하지 않는다. */
        function confirmSend() {
            if (!F) { toast('먼저 [공문 기안]으로 문서를 작성하세요.'); return; }
            if (denied(cfg.targetOf(F.id))) return;
            if (!SIMPLE && lineDenied()) return;
            var ai = attachIssue();
            if (ai) { toast(ai); return; }
            if (SIMPLE) {
                V().openModal('온나라로 보내면 되돌릴 수 없습니다',
                    '<div class="rskdoc-send"><div class="rskdoc-lock-warn"><b>' + esc(cfg.lockNote || '보낸 뒤에는 이 기록을 고칠 수 없습니다.') + '</b><br>' +
                    '<span class="file-hint">공문은 온나라 연계기안함에 들어갑니다. 검토·결재를 지정해 상신하는 것은 온나라에서 합니다.</span></div></div>',
                    '<button type="button" class="btn btn-secondary" onclick="' + NS + '.preview()">← 미리보기</button>' +
                    '<button type="button" class="btn btn-primary" onclick="' + NS + '.send()">보내기</button>');
                return;
            }
            /* 확인 단계는 **같은 창의 본문을 바꿔** 보인다 — openModal 이 앞 창(미리보기)을 닫고
             * 연다(화면에 뜬 창은 늘 하나, 운영 23건 #3). 문서 내용을 다시 늘어놓지 않고
             * 되돌릴 수 없다는 사실만 말한다. */
            V().openModal('상신하면 되돌릴 수 없습니다',
                '<div class="rskdoc-send">' +
                    '<div class="rskdoc-lock-warn">' +
                        '<b>' + esc(cfg.lockNote || '상신 후에는 이 기록을 수정할 수 없습니다.') + '</b><br>' +
                        '<span class="file-hint">고치려면 반려를 받아 다시 올립니다.</span>' +
                    '</div>' +
                '</div>',
                '<button type="button" class="btn btn-secondary" onclick="' + NS + '.preview()">← 미리보기</button>' +
                '<button type="button" class="btn btn-primary" onclick="' + NS + '.send()">상신</button>');
        }
        function send() {
            if (!F) { toast('먼저 [공문 기안]으로 문서를 작성하세요.'); return; }
            var t = cfg.targetOf(F.id);
            if (denied(t)) return;
            /* 확인 화면을 건너뛰고 전역 호출로 들어오는 경로까지 막는다 — 버튼만 잠그면 뚫린다 */
            if (!SIMPLE && lineDenied()) return;
            var ai = attachIssue();
            if (ai) { toast(ai); return; }
            if (F.rc && !rcIds().length) { toast('수신처를 1곳 이상 고르세요.'); return; }
            var no = cfg.nextNo();
            var doc = {
                sid: no + '-' + (cfg.docsFor(t) || []).length,
                no: no, at: today(), status: SIMPLE ? '기안함 전송' : '결재중',
                docType: F.docType, title: F.title, to: F.to, body: F.body,
                attach: F.attach.filter(function (x) { return x.on; }),
                annex: F.annex, basis: Object.keys(F.basis),
                recipients: F.rc ? rcIds() : undefined,
                /* 온나라로 넘어가는 결재선 — **계정 식별자(uid) 배열**이다. 이름은 표시용이라
                   함께 담되, 연계가 붙으면 키가 되는 것은 uid 다(SCR-ADMIN-001 §4). */
                line: SIMPLE ? [] : line().slice(), lineText: SIMPLE ? '' : lineText(),
                by: persona().name, byUid: persona().uid || '', dept: myDeptName()
            };
            cfg.save(t, doc);
            V().closeModal();
            /* 상신 직후 값은 생산등록번호가 아니라 «연계 번호»다 — 문서번호는 결재가 끝나야 생긴다
             * (CLAUDE.md §7-1 2026-10-07). 결과 창은 개발 상태를 말하지 않고(운영 문구 원칙),
             * 연계 전 재현이라는 사실은 «예시 자료» 칩이 맡는다(§15). */
            /* 구성은 SCR-EDOC-008 §4 — 보낸 사실 · 문서명 · 연계 번호 · 문서번호 안내 · 결재선 · 보낸 붙임 */
            var sentAttach = attachNames(t, doc);
            if (SIMPLE) {
                V().openModal('온나라 기안함에 보냈습니다',
                    sentHtml({
                        lead: cfg.sentNote || '공문을 온나라 연계기안함에 보냈습니다.',
                        status: '기안함 전송',
                        rows: [
                            ['문서', doc.title],
                            ['연계 번호', no, '문서번호는 결재가 끝나면 온나라가 부여합니다.'],
                            ['붙임', sentAttach.join(' · ')],
                            ['다음 할 일', '온나라 기안함에서 검토·결재를 지정해 상신하세요.', doc.docType === '외부발송' ? '결재가 끝나면 온나라가 수신 부서로 시행합니다.' : '결재 진행은 온나라에서 확인합니다.']
                        ]
                    }),
                    '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal()">확인</button>');
                refresh();
                return;
            }
            V().openModal('온나라 결재 요청',
                sentHtml({
                    lead: '결재 요청을 보냈습니다.',
                    status: '결재중',
                    rows: [
                        ['문서', doc.title],
                        ['연계 번호', no, '문서번호는 결재가 끝나면 온나라가 부여합니다.'],
                        ['결재선', doc.lineText],
                        ['붙임', sentAttach.join(' · ')],
                        ['다음 할 일', '결재 진행은 온나라에서 확인합니다.', '결재 완료·반려가 회신되면 상태가 바뀝니다.']
                    ]
                }),
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
            rcSel: rcSel, rcTog: rcTog, rcReset: rcReset, rcToggle: rcToggle,
            pickOpen: LN.pickOpen, pickApprover: LN.pickApprover, addStep: LN.addStep,
            delStep: LN.delStep, resetLine: LN.resetLine,
            line: line, lineText: lineText, lineIssues: lineIssues, lineReady: lineReady,
            registerRefresh: registerRefresh, refresh: refresh,
            paperHtml: paperHtml
        };
        global[NS] = api;
        return api;
    }

    /* ===================== 온나라 전송 결과 창 — 한 모양 =====================
     * 공문을 온나라로 보낸 뒤 결과 창은 «온나라 결재 상태» 컴포넌트(.approval-box / .approval-kv, 라벨–값 2열)
     * 하나로 그린다. 문장 중간에 업로드 안내 상자(.file-hint)를 끼우면 가운데 정렬된 글이 상자 조각으로
     * 갈라져 읽을 수 없었다(2026-11-12). 도메인이 결과 창을 따로 짜지 않는다 — 시달 공문·일반 공문·마감 보고 공용.
     *   o.lead  — 무엇이 일어났는지 한 문장
     *   o.status — 상태 칩 라벨(«기안함 전송» · «결재중»)
     *   o.rows  — [[라벨, 값(HTML 이스케이프 전 문자열), 보조 문구?], ...] 값이 비면 그 줄을 내지 않는다 */
    function sentHtml(o) {
        var V = global.DYV2 || {};
        var esc = V.esc || function (x) { return String(x == null ? '' : x); };
        var tone = V.toneOf ? V.toneOf(o.status) : 'info';
        var rows = [['상태', null]].concat(o.rows || []).filter(function (r) { return r[0] === '상태' || (r[1] != null && r[1] !== ''); });
        return '<div class="approval-box">' +
            '<div class="approval-top"><span>' + esc(o.lead) + '</span></div>' +
            '<div class="approval-kv">' + rows.map(function (r) {
                var v = r[0] === '상태'
                    ? '<span class="chip-status ' + tone + ' chip-sm">' + esc(o.status) + '</span> ' + (V.sampleChip ? V.sampleChip('온나라 연계 전 전송 결과를 재현한 값입니다.') : '')
                    : esc(r[1]);
                return '<span class="ak">' + esc(r[0]) + '</span><span class="av">' + v +
                    (r[2] ? '<span class="av-sub">' + esc(r[2]) + '</span>' : '') + '</span>';
            }).join('') + '</div>' +
        '</div>';
    }

    global.DYDOC = { define: define, approvalLine: approvalLine, stepLabel: stepLabel, sentHtml: sentHtml };
})(window);
