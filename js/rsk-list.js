/* =====================================================================
   rsk-list.js · 정기 위험성평가 목록·상세 통합 (RSK01-L, 재설계 v1.1 §6.1)
   ---------------------------------------------------------------------
   · 연도 셀렉트 + 전체 완료율 요약 (정기평가는 연 1건 원칙 → 목록·상세 통합)
   · 해당 연도 평가 존재 시:
       - 상단: 요약 카드(대상 부서·개선 N/M·완료율) + 이력 탭
       - 부서별 보고서 첨부 → 부서별 개선조치 **직접 작성**(자동 파싱 없음) → 조치기한 설정 → 부서 전달
         ※ 2026-07-30 회의로 파싱·검수 화면은 폐지됐다. 되살리지 말 것 — rsk-data.js uploadReport 주석 참고.
       - 부서별 조치 테이블: 재촉 · 부서 상세 (전달완료 부서는 개선조치 목록만 표시)
   · 해당 연도 평가 없음 시:
       - 빈 상태 + [+정기평가 생성] 3-STEP 마법사 (부서 선정 → 점검일자 → 설문조사표)
   · 단일 모달 규칙 준수 — DYV2.openModal/closeModal 만 사용, 인라인 패널로 검수/부서 관리
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYRSK; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    /* 받침 유무에 맞는 조사만 돌려준다 — 부서명을 문장에 넣을 때
       '공공시설사업소은' 같은 오식을 막는다. (담양읍은/공공시설사업소는) */
    /* 조사 — 공용 DYV2.josa 로 수렴(2026-08-12). 같은 함수를 두 모듈이 각자 갖고
       있어 한쪽만 고치면 어긋난다. DYV2 부재 시에만 자체 계산으로 떨어진다. */
    function josa(word, withJong, withoutJong) {
        var V0 = global.DYV2 || window.DYV2;
        if (V0 && V0.josa) return V0.josa(word, withJong, withoutJong);
        var t = String(word == null ? '' : word).trim(); if (!t) return withJong;
        var c = t.charCodeAt(t.length - 1);
        return ((c >= 0xac00 && c <= 0xd7a3) ? ((c - 0xac00) % 28) > 0 : false) ? withJong : withoutJong;
    }
    /* 유해위험요인의 법령 근거 — DYLAW 칩(CLAUDE.md §10). 근거 없으면 '법령 매핑 대기'. */
    function basisHtml(h) {
        var b = h && h.basis;
        if (!b) return '';   /* 근거는 선택 항목 — 없으면 자리 자체를 만들지 않는다 */
        return window.DYLAW ? DYLAW.basisChip(b) : '<span class="law-basis-plain">' + esc(b) + '</span>';
    }

    function toast(m) { V().toast(m); }

    var state = {
        mount: null, year: 2026, tab: 'depts',
        reviewOpen: {}, /* 검수 화면 부서별 접힘 상태 { deptId: true } */
        fromFacil: null, /* 시설물 위험도에서 넘어온 시설물 {no, name} — 첫 행 추가 때 한 번 쓴다 */
    };
    var W = null; /* 생성 마법사 상태 */

    /* =============== 최상위 렌더 =============== */
    /* ===== 조치 완료 확인 · 공문 (2026-07-31 신설) =====
     * 근거: docs/planning/기획-위험성평가-공문-온나라이관-v1.md
     * 부서가 완료를 누르면 아무도 확인하지 않고 평가까지 끝나던 구멍을 메운다. */
    function confirmBanner(a) {
        var c = D().confirmCount(a.id);
        if (!c.total) return '';
        if (!c.wait && !c.returned) return '';
        var mine = canManage();
        var parts = [];
        if (c.wait) parts.push('<b>확인 대기 ' + c.wait + '건</b>');
        if (c.returned) parts.push('<b class="rl-cfm-rj">반려 후 재제출 대기 ' + c.returned + '건</b>');
        return '<div class="rl-cfm-bar' + (c.wait ? ' is-wait' : '') + '">' +
            '<span class="rl-cfm-txt">' + parts.join(' · ') +
                (mine ? ' — 확인해야 공문을 기안할 수 있습니다.' : ' — 확인은 주관부서(재난안전과)가 수행합니다.') + '</span>' +
            (mine && c.wait
                ? '<button type="button" class="btn btn-primary btn-sm" data-tour="rsk-confirm" onclick="RSKLIST.openConfirmQueue()">확인 대기 건만 보기 →</button>'
                : '') +
        '</div>';
    }
    /* 확인 대기 건만 모아 한 화면에서 처리 — 부서를 건너다니지 않는다 */
    function openConfirmQueue() {
        var a = (D().assessments(state.year) || [])[0]; if (!a) return;
        if (!global.IMPCARD) return;
        IMPCARD.open({
            key: 'confirm:' + a.id,
            title: '완료 확인 대기 — ' + esc(a.title),
            metaHtml: '<span>대상 <b>전 부서</b></span><span>확인해야 공문을 기안할 수 있습니다</span>',
            noteHtml: '증빙(개선 전·후 사진)을 열어 본 뒤 확인하거나 반려합니다. 반려하면 사유가 담당자 화면에 전달됩니다.',
            emptyHtml: '확인 대기 건이 없습니다.',
            items: function () {
                return D().improvementsFor(a.id).filter(function (m) {
                    return m.status === 'DONE' && D().confirmState(m) !== 'OK';
                });
            },
            canConfirm: canManage(), canRemind: false, onChange: render
        });
    }

    /* 공문 — 진입점은 [공문 기안] 하나. 상신은 미리보기 화면에만 있다(발주처가 지적한 순서). */
    function docBar(a) {
        if (!global.DYRSKDOC) return '';
        var doc = D().latestDoc('A|' + a.id);
        var mine = canManage();
        if (doc) {
            var tone = V().toneOf(doc.status);
            return '<div class="rl-doc-bar">' +
                '<span class="rl-doc-lead"><b>온나라 이관</b> ' +
                    '<span class="chip-status ' + tone + ' chip-sm">' + esc(doc.status) + '</span></span>' +
                '<span class="rl-doc-meta">' + esc(doc.title) + ' · ' + esc(doc.no) +
                    ' <span class="pdf-note">(임시 채번 — 실제 번호는 온나라가 부여)</span> · ' + esc(doc.at) + '</span>' +
                '<span class="rl-doc-acts">' +
                    '<button type="button" class="btn btn-outline btn-sm" onclick="DYRSKDOC.openDocSid(\'' + esc(doc.sid) + '\')">문서 보기</button>' +
                    (mine ? '<button type="button" class="btn btn-outline btn-sm" data-tour="rsk-doc" onclick="DYRSKDOC.openStatus(\'' + esc(a.id) + '\')">결재 상태</button>' : '') +
                '</span>' +
            '</div>';
        }
        if (!mine) return '';
        var ready = D().docReady(a.id);
        var c = D().confirmCount(a.id);
        return '<div class="rl-doc-bar">' +
            '<span class="rl-doc-lead"><b>온나라 이관</b> <span class="chip-status neutral chip-sm">미상신</span></span>' +
            '<span class="rl-doc-meta">' + (ready
                ? '전 부서 확인 완료 — 공문을 작성해 온나라로 넘길 수 있습니다.'
                : (c.total
                    ? '전 건 확인 완료 후 기안할 수 있습니다 (확인 대기 ' + c.wait + '건 · 반려 ' + c.returned + '건)'
                    : '전달된 개선조치가 없습니다.')) + '</span>' +
            '<span class="rl-doc-acts">' +
                '<button type="button" class="btn btn-primary btn-sm"' + (ready ? '' : ' disabled') +
                    ' data-tour="rsk-doc" onclick="DYRSKDOC.open(\'' + esc(a.id) + '\')">공문 기안</button>' +
            '</span>' +
        '</div>';
    }

    /* ===== 관리 권한 =====
     * 정기 위험성평가는 **주관부서(재난안전과)** 가 운영한다 — 대상 부서는 설문조사표를
     * 제출하고 조치를 이행할 뿐, 남의 부서 보고서를 올리거나 조치기한을 정하지 않는다.
     * 종전에는 이 화면의 모든 조작이 누구에게나 열려 있었다. 조회는 막지 않는다. */
    var OWNER_DEPT = 'safety';
    /* 주관부서 소속이어도 **담당자(staff)** 만 조작한다 — 과장·소장은 관리·감독이지
     * 실무 수행자가 아니다. 종전에는 deptId 만 봐서 재난안전과장(super)이 주무관과
     * 완전히 같은 권한(생성·검수·전달·완료확인·공문 기안·상신)을 가졌다.
     * 조회는 막지 않는다 — my-work.js canAct() 와 같은 기준이다. */
    function canManage() {
        var p = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        if (!p) return true;                        /* 롤 스위처가 없는 환경은 종전대로 */
        if (p.tier !== 'staff') return false;       /* 총괄·관리감독자는 조회 전용 */
        return p.deptId === OWNER_DEPT;             /* 재난안전과 담당자 */
    }
    /* ===== 부서별 개선조치 작성 권한 (2026-08-14 발주처 지시) =====
     * "부서별 개선조치 입력이니까 담당자로 지정된 부서에서 확인하고 설정할 수 있어야 해"
     * 작성 대상이 그 부서의 조치 내용이므로 **그 부서 담당자도 같은 표에서 직접 적는다.**
     * 창구만 둘이고(이 화면의 인라인 표 · 내 할일의 업로드) 데이터는 하나다 —
     * 별도 '개선조치' 메뉴로 보내지 않는다(그 메뉴는 없앴다).
     * 열리는 범위는 **자기 부서 블록 하나**다. 남의 부서 조치를 적는 것은 조회 범위(§12)
     * 위반이자 저작 위조다. 판정은 DYROLE.canAct 단일 출처를 함께 본다.
     * 단계 진행(보고서 취소·재업로드 · 작성완료·조치기한 설정)은 여전히 주관부서 몫이다 —
     * 기한을 정하는 것은 총괄이고, 부서가 자기 기한을 정하는 흐름이 아니다. */
    function canWriteReview(deptId) {
        if (canManage()) return true;
        var p = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        if (!p) return true;                        /* 롤 스위처가 없는 환경은 종전대로 */
        if (p.tier !== 'staff') return false;       /* 관리·감독은 조회 전용 */
        if (!deptId || p.deptId !== deptId) return false;
        return !global.DYROLE.canAct || global.DYROLE.canAct(deptId);
    }
    /* 작성 패널을 주관부서가 아닌 사람에게도 보여줄지 — 내 부서가 이 평가의 대상이고
       작성 단계(REVIEW)일 때만이다. 대상이 아니면 종전대로 조회 전용 표를 그린다. */
    function myReviewDept(a) {
        if (!a || ((a.review && a.review.stage) || 'NONE') !== 'REVIEW') return '';
        var p = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        var mine = (p && p.deptId) || '';
        if (!mine || !canWriteReview(mine)) return '';
        return (a.depts || []).some(function (x) { return x.deptId === mine; }) ? mine : '';
    }
    /* 차단 안내 — 재난안전과장에게 "재난안전과만 할 수 있다"고 하면 거짓말이 된다.
       같은 화면의 조회 전용 안내(manageNote)와 같은 말을 해야 한다. */
    function denyToast(deptId) {
        var p = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        /* 부서 담당자가 남의 부서 행을 건드린 경우 — '재난안전과만'이라고 하면 거짓말이다.
           자기 부서 블록은 열려 있으므로 그 사실을 함께 알린다. */
        if (deptId && p && p.tier === 'staff' && p.deptId && p.deptId !== deptId && p.deptId !== OWNER_DEPT) {
            toast('다른 부서의 개선조치는 그 부서 담당자가 적습니다 — 내 부서 블록에서 작성하세요.');
            return;
        }
        toast(p && p.deptId === OWNER_DEPT
            ? '주관부서 안에서도 담당자(주무관)만 수행할 수 있습니다.'
            : '개선조치 작성은 주관부서(재난안전과) 담당자와 해당 부서 담당자가 수행합니다.');
    }
    /* 권한이 없을 때 관리 버튼 자리에 넣는 안내 — 버튼을 그냥 지우면 '왜 없지'가 된다.
     * 어휘 기준은 my-work.js readOnlyNote() (head / super / 타 부서) 와 맞춘다.
     * a 를 받는 이유 — 소속 부서가 그 해 평가 대상이 아니면 '위 진행 상황'을 가리켜도
     * 표에 자기 부서 줄이 없다. 없는 곳을 가리키는 안내는 안내가 아니다. */
    function manageNote(a) {
        if (canManage()) return '';
        var p = global.DYROLE.current();
        var mine = global.DYROLE.deptId ? global.DYROLE.deptId() : '';
        var listed = !!mine && (a.depts || []).some(function (x) { return x.deptId === mine; });
        /* 끝난 평가에는 제출·재촉 액션이 화면에 0개다 — 있지도 않은 행동을 약속하지 않는다 */
        var closed = a.status === 'COMPLETED';
        var n = (a.depts || []).length;
        var why;
        if (p.tier === 'head') {
            /* 아래 표는 a.depts 만 그린다. 담양군 39개 부서를 '전 부서'라 부르면
               화면이 하지 않는 일을 약속하는 셈이다(§10 검증 6문 #6 과 같은 실패). */
            why = '총괄 책임자는 <b>대상 부서 ' + n + '개</b>의 진행 상황을 조회합니다.';
        } else if (mine === OWNER_DEPT) {
            /* 주관부서 소속이지만 담당자가 아닌 자리 — '재난안전과가 수행합니다'만 쓰면
               "내가 재난안전과인데?"가 된다. 누가 하는지까지 밝힌다. */
            why = '주관부서 안에서도 <b>담당자(주무관)</b>가 수행합니다 — 관리감독자는 진행 상황을 확인' +
                  (closed ? '합니다.' : '하고, 지연 건은 <b>부서 상세</b>에서 재촉할 수 있습니다.');
        } else if (!listed) {
            /* 조회 범위가 소속 부서로 좁혀져 있으면 아래 표는 비어 있다 —
               '아래는 대상 부서의 진행 상황'이라고 쓰면 없는 것을 가리키게 된다 */
            var scoped = global.DYROLE.scope && global.DYROLE.scope() !== 'all';
            why = '<b>' + esc(p.deptName || '') + '</b>' + josa(p.deptName, '은', '는') + ' ' +
                  esc(a.year) + '년 평가 <b>대상 부서가 아닙니다</b>' +
                  (scoped ? '.' : ' — 아래는 대상 부서의 진행 상황입니다.');
        } else if (closed) {
            why = (p.tier === 'staff' ? '내 부서' : '소속 부서') + ' 진행 결과는 위 <b>진행 상황</b>에서 확인하세요.';
        } else if (p.tier === 'staff') {
            why = '내 부서 몫은 위 <b>진행 상황</b>에서 처리하세요.';
        } else {
            why = '소속 부서 진행은 위 <b>진행 상황</b>에서 확인하고, 지연 건은 <b>부서 상세</b>에서 재촉할 수 있습니다.';
        }
        return '<div class="rl-ro" role="note">' +
            '<b>조회 전용</b> — 정기 위험성평가의 <b>보고서 접수·검수·조치기한 설정</b>은 ' +
            '주관부서(<b>재난안전과</b>) 담당자가 수행합니다. ' + why +
        '</div>';
    }

    /* 평가가 아직 없는 해의 안내 어휘 — 그 해엔 a 가 없어 manageNote() 를 못 쓴다.
     *   head  군수: 소속 부서가 없다(전 부서 총괄)
     *   owner 재난안전과 관리감독자: 자기 과가 주관부서다 — '소속 부서'는 곧 전 부서다
     *   dept  그 밖의 부서: 자기 부서 몫만 표시된다 */
    function emptyScope() {
        var p = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        if (!p) return 'dept';
        if (p.tier === 'head') return 'head';
        return p.deptId === OWNER_DEPT ? 'owner' : 'dept';
    }
    /* '생성되면 표시됩니다'는 무조건 약속이 아니다 — 대상 부서로 **선정되어야** 뜬다.
       선정은 생성 마법사 STEP1 소관이므로 그 조건을 문장에 드러낸다. */
    var EMPTY_TAIL = {
        head:  '생성되면 <b>대상 부서</b>의 점검일자와 진행 상황이 여기에 표시됩니다.',
        owner: '생성되면 <b>부서별</b> 점검일자와 진행 상황이 여기에 표시됩니다.',
        dept:  '생성 시 <b>대상 부서로 선정되면</b> 소속 부서의 점검일자와 진행 상황이 여기에 표시됩니다.'
    };

    /* ===== 내 부서 진행 상황 (배정 부서 담당자 관점) =====
     * 이 화면은 주관부서(재난안전과)용 관리 화면이라, 부서 담당자가 들어오면
     * 자기 부서가 지금 어느 단계인지·다음에 뭘 해야 하는지가 표에 묻힌다.
     * 로그인한 사람의 소속이 대상 부서면 그 부서 줄만 뽑아 위에 세운다. */
    function myDeptPanel(a) {
        var mine = global.DYROLE && global.DYROLE.deptId ? global.DYROLE.deptId() : '';
        if (!mine) return '';
        var dp = (a.depts || []).filter(function (x) { return x.deptId === mine; })[0];
        if (!dp) return '';
        var ms = D().improvementsFor(a.id, mine);
        /* 반려된 건은 status 가 DONE 인 채로 남는다(§4-3 — 되돌리면 평가가 잠긴다).
           그래서 status 만 세면 **반려 건이 '완료'로 잡혀** 부서 담당자는
           다시 할 일이 있는 줄 모른다. 담당자 관점의 '할 일'은 needsAction 단일 판정이다. */
        var doneN = ms.filter(function (m) { return !D().needsAction(m); }).length;
        var cfm = D().confirmCount(a.id, mine);
        var returnedN = cfm.returned;
        var who = global.DYROLE.current();
        /* 끝난 평가에 '지금 제출하기'를 띄우면 없는 할 일을 만들어낸다 — 조회로만 남긴다 */
        var closed = a.status === 'COMPLETED';
        /* 관리감독자는 이 부서의 **실무자가 아니다** — 제출·완료는 담당자가 한다.
           같은 패널을 감독 관점으로 바꿔 준다: 확인은 조회로, 지연은 재촉으로. */
        var isStaff = who.tier === 'staff';
        var mineLabel = isStaff ? '내 부서' : '소속 부서';
        /* 주관부서 소속(재난안전과장)에게 2단계 주체를 그냥 '재난안전과'라고 쓰면
           본인 부서가 남의 부서처럼 읽힌다 — 누가 하는지까지 붙인다. */
        var ownerLabel = (mine === OWNER_DEPT) ? '재난안전과 담당자' : '재난안전과';
        /* 4단계 — ① 설문조사표 제출(부서) ② 검수·전달(재난안전과)
                    ③ 개선조치 완료(부서) ④ 완료 확인(재난안전과)
           ④ 를 빼면 부서 담당자는 완료 처리한 순간 카드가 전부 ✓ 로 끝나 '다 했다'로 읽는다.
           실제로는 주관부서 확인이 남아 있고, **반려되면 다시 해야 한다**. */
        var steps = [
            {
                lab: '설문조사표 작성·제출',
                mine: true,
                done: !!dp.reportFile,
                note: dp.reportFile
                    ? '제출 ' + (dp.reportAt || '') + (dp.reportBy ? ' · ' + dp.reportBy : '')
                    : (dp.inspectDate ? '점검일 ' + dp.inspectDate : '점검일 미정'),
                /* 제출은 **이 화면 안에서** 끝난다. 종전에는 '내 할일'로 보냈는데,
                   그러면 위험성평가 흐름 한가운데가 다른 화면에 의존해 이 축만 떼어
                   개발할 수 없다. '내 할일'은 여러 도메인 할 일을 **모아 보는 곳**이지
                   유일한 수행 경로가 아니어야 한다(개선조치가 rsk-imp-detail 에
                   자족 경로를 갖는 것과 같다). */
                act: closed ? '' : (isStaff
                    ? '<button type="button" class="btn btn-primary btn-sm" data-tour="rsk-submit" ' +
                      'onclick="RSKLIST.openMySubmit()">' +
                      (dp.reportFile ? '제출본 교체' : '지금 제출하기') + '</button>'
                    : '')
            },
            {
                lab: '보고서 검수 · 개선조치 전달',
                mine: false,
                done: !!ms.length,
                note: ms.length ? '개선조치 ' + ms.length + '건 전달됨' : ownerLabel + '가 진행합니다',
                act: ''
            },
            {
                lab: '개선조치 완료',
                mine: true,
                done: !!ms.length && doneN === ms.length,
                note: !ms.length ? '전달 대기'
                    : (returnedN
                        ? doneN + ' / ' + ms.length + '건 완료 · 반려 ' + returnedN + '건 재조치 필요'
                        : doneN + ' / ' + ms.length + '건 완료'),
                /* 완료 처리는 **이 화면 안에서** 끝난다 (2026-08-14 발주처 지시) —
                   개선조치는 독립 메뉴가 아니므로 rsk-imp 대장으로 내보내지 않는다.
                   [개선조치 완료 처리] → 부서 상세(IMPCARD) 카드의 [완료 처리] 로 이어지고,
                   같은 데이터를 '내 할일'에서 올려도 같은 곳에 쌓인다(창구만 둘이다). */
                act: ((!closed || returnedN) && ms.length && doneN < ms.length)
                    ? (isStaff
                        ? '<button type="button" class="btn btn-primary btn-sm" data-tour="rsk-complete" ' +
                          'onclick="RSKLIST.openDept(\'' + esc(mine) + '\')">개선조치 완료 처리</button>'
                        /* 감독자의 행동은 '대신 처리'가 아니라 '재촉'이다 (산안법 §16 지휘·감독) */
                        : '<button type="button" class="btn btn-outline btn-sm" onclick="RSKLIST.remindDept(\'' +
                          esc(mine) + '\')">기한초과 재촉</button>')
                    : ''
            },
            {
                /* 용역 보고서가 지적 → 재난안전과가 부서 지정·전달 → 부서가 조치 →
                   **재난안전과가 확인**. 마지막 단계가 있어야 흐름이 닫힌다. */
                lab: '완료 확인',
                mine: false,
                done: !!ms.length && cfm.ok === ms.length,
                note: !ms.length ? '전달 대기'
                    : (cfm.returned
                        ? '반려 ' + cfm.returned + '건 — 사유를 확인해 다시 제출하세요'
                        : (cfm.ok === ms.length && ms.length
                            ? '확인 완료 ' + cfm.ok + ' / ' + ms.length + '건'
                            : '확인 ' + cfm.ok + ' / ' + ms.length + '건 · ' + ownerLabel + '가 증빙을 열어 봅니다')),
                act: ''
            }
        ];
        /* 반려 건이 있으면 담당자에게는 아직 할 일이 남은 것이다 —
           평가가 COMPLETED 라고 커서를 지우면 [개선조치 완료 처리] 버튼이 사라져
           재제출 수단을 잃는다(§4-3 needsAction 과 같은 취지). */
        var cur = (closed && !returnedN) ? -1 : steps.findIndex(function (s) { return !s.done; });
        var items = steps.map(function (s, i) {
            var cls = s.done ? 'is-done' : (i === cur ? 'is-now' : '');
            return '<li class="rl-my-step ' + cls + (s.mine ? ' is-mine' : '') + '">' +
                '<span class="rl-my-no">' + (s.done ? '✓' : (i + 1)) + '</span>' +
                '<span class="rl-my-body">' +
                    '<b>' + s.lab + '</b>' +
                    '<span class="rl-my-who">' + (s.mine ? mineLabel : ownerLabel) + '</span>' +
                    '<span class="rl-my-note">' + esc(s.note) + '</span>' +
                '</span>' +
                (i === cur && s.act ? '<span class="rl-my-act">' + s.act + '</span>' : '') +
            '</li>';
        }).join('');
        return '<section class="rl-my card" aria-label="' + (isStaff ? '내 부서' : '소속 부서') + ' 진행 상황">' +
            '<div class="rl-my-head"><b>' + esc(D().deptName(mine)) + '</b> — ' +
                (isStaff ? '내 부서 진행 상황' : '소속 부서 진행 상황 (관리감독)') +
                /* 평가 전체가 COMPLETED 여도 이 부서에 반려 건이 남아 있을 수 있다 —
                   반려는 status 를 되돌리지 않기 때문이다(§4-3). 그때 '평가 완료' 만 보이면
                   아래 3·4단계의 '재조치 필요' 와 정면으로 어긋나 읽힌다. */
                (closed
                    ? (returnedN
                        ? '<span class="chip-status danger chip-sm">반려 ' + returnedN + '건 — 재조치 필요</span>'
                        : '<span class="chip-status success chip-sm">평가 완료</span>')
                    : '') +
                '<span class="rl-my-me">' + esc(who.name) + ' ' + esc(who.role) + '</span></div>' +
            '<ol class="rl-my-steps">' + items + '</ol>' +
        '</section>';
    }

    function render() {
        if (!state.mount) return;
        var years = D().assessmentYears();
        if (years.indexOf(state.year) === -1) years.unshift(state.year);
        years.sort(function (a, b) { return b - a; });

        var a = (D().assessments(state.year) || [])[0];

        var head = renderToolbar(years, a);

        if (!a) {
            state.mount.innerHTML = head +
                '<div class="v2-empty rl-empty">' +
                    '<div class="rl-empty-icon">📄</div>' +
                    '<div class="rl-empty-title">' + state.year + '년 정기 위험성평가가 등록되지 않았습니다</div>' +
                    '<div class="rl-empty-steps">' +
                        '<span class="rl-empty-step">① 대상 부서 선정</span>' +
                        '<span class="rl-empty-arrow">→</span>' +
                        '<span class="rl-empty-step">② 점검일자 지정</span>' +
                    '</div>' +
                    '<div class="rl-empty-sub">생성 시 <b>대상 부서에 점검예정일이 통보</b>됩니다. ' +
                        '유해위험요인 설문조사표는 생성 후 목록에서 공통 또는 부서별로 첨부합니다.</div>' +
                    (canManage()
                        ? '<button type="button" class="btn btn-primary" data-tour="rsk-create" onclick="RSKLIST.openWizard()">＋ 정기평가 생성</button>'
                        : '<div class="rl-ro" style="margin:0 auto;max-width:520px;">' +
                          '<b>조회 전용</b> — 정기 위험성평가는 주관부서(<b>재난안전과</b>) 담당자가 생성합니다. ' +
                          EMPTY_TAIL[emptyScope()] + '</div>') +
                '</div>';
            return;
        }

        D().refreshAssessmentStatus(a.id);
        a = D().assessmentOf(a.id);

        var summary = renderSummary(a);
        var tabs =
            '<div class="rl-tabs">' +
                '<button class="rl-tab ' + (state.tab === 'depts' ? 'on' : '') + '" onclick="RSKLIST.setTab(\'depts\')">부서별 조치</button>' +
                '<button class="rl-tab ' + (state.tab === 'history' ? 'on' : '') + '" onclick="RSKLIST.setTab(\'history\')">이력</button>' +
            '</div>';

        /* 작성 단계에서는 대상 부서 담당자도 **자기 부서 블록**을 직접 적는다(위 canWriteReview).
           그래서 조회 전용 표 대신 작성 패널을 그린다 — 같은 데이터, 같은 표다. */
        var body;
        if (state.tab !== 'depts') body = renderHistory(a);
        else if (canManage()) body = confirmBanner(a) + docBar(a) + renderDepts(a);
        else if (myReviewDept(a)) body = confirmBanner(a) + docBar(a) + renderReviewPanel(a);
        else body = confirmBanner(a) + docBar(a) + manageNote(a) + renderDeptsReadOnly(a);
        state.mount.innerHTML = head + myDeptPanel(a) + summary + tabs + body;
    }

    function renderToolbar(years, a) {
        var right = '';
        if (!a) {
            /* 평가 생성은 주관부서만 — 없는 권한의 1차 CTA 를 띄우지 않는다 */
            right = canManage()
                ? '<button type="button" class="btn btn-primary" data-tour="rsk-create" onclick="RSKLIST.openWizard()">＋ 정기평가 생성</button>'
                : '<span style="font-size:var(--fs-12);color:var(--text-gray);">재난안전과 담당자가 생성하면 여기에 표시됩니다</span>';
        } else if (a.status !== 'COMPLETED') {
            right = '<span style="font-size:var(--fs-12);color:var(--text-gray);">정기평가는 연 1회 등록 원칙</span>';
        } else {
            right = '<span class="chip-mini st-done">' + esc(a.year) + '년 평가 완료 (' + esc(a.completed_at || '') + ')</span>';
        }
        /* 시연 리셋 — 세션 데이터 초기화 후 빈 상태로 복귀 (DYRSK.reset 재활용).
           '조회 전용'이라 안내해 놓고 전 부서 데이터를 날리는 버튼을 남겨 두면 안내가 거짓이 된다.
           초기화는 시연을 운전하는 주관부서 담당자(canManage)만 한다. */
        var resetBtn = canManage()
            ? '<button type="button" class="btn btn-outline btn-sm rl-reset-btn" ' +
              'title="시연용 세션 데이터 초기화" onclick="RSKLIST.resetDemo()">↺ 시연 초기화</button>'
            : '';
        return '<div class="rl-toolbar">' +
                '<div class="rl-tb-left">' +
                    '<label class="rl-tb-label">연도</label>' +
                    '<select class="form-select" onchange="RSKLIST.setYear(+this.value)">' +
                        years.map(function (y) { return '<option value="' + y + '"' + (y === state.year ? ' selected' : '') + '>' + y + '년</option>'; }).join('') +
                    '</select>' +
                '</div>' +
                '<div class="rl-tb-right">' + right + resetBtn + '</div>' +
            '</div>';
    }

    /* 시연 리셋 — 확인 후 sessionStorage 위험성평가 데이터 초기화 */
    function resetDemo() {
        if (!canManage()) { denyToast(); return; }
        V().openModal('시연 데이터 초기화',
            '<p style="font-size:var(--fs-13);line-height:1.6;">위험성평가 세션 데이터를 초기 시연 상태로 되돌립니다.</p>' +
            '<p style="font-size:var(--fs-13);line-height:1.6;margin-top:8px;">' +
                /* 한 저장소를 쓰므로 수시평가도 함께 지워진다 — 밝히지 않으면 놀란다 */
                '<b>정기평가뿐 아니라 수시 위험성평가·개선조치도 함께</b> 초기화됩니다. ' +
                '2026년 생성·업로드·전달·조치 진행 내역이 모두 사라지고 ' +
                '<b>초기 시연 상태</b>(2026 미등록 · 2025 완료)로 복귀합니다.</p>' +
            '<p style="font-size:var(--fs-12);color:var(--text-gray);margin-top:8px;">2025년 참고 데이터는 유지됩니다. 진행 중인 시연 가이드도 함께 종료됩니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="RSKLIST.doResetDemo()">초기화</button>');
    }
    function doResetDemo() {
        if (!canManage()) { denyToast(); return; }
        D().reset();
        V().closeModal();
        state.tab = 'depts';
        state.reviewOpen = {};
        state.year = 2026;
        /* 투어 커서도 함께 되돌린다 — 데이터만 지우면 패널이 "9. 결재 결과 수신"을
           가리킨 채 남아, 두 번째 시연이 마지막 단계에서 시작하는 것처럼 보인다.
           stop() 이 커서·고정 관점을 함께 푼다(다음 start() 가 1단계부터 잡는다). */
        ['RSKTOUR', 'OCCTOUR'].forEach(function (n) {
            var t = global[n];
            if (t && t.active && t.active()) t.stop();
        });
        toast('시연 데이터 초기화 완료 · 2026년 미등록 상태로 복귀');
        render();
    }

    function renderSummary(a) {
        var prog = D().assessmentProgress(a.id);
        var stChip = a.status === 'COMPLETED'
            ? '<span class="chip-mini st-done">완료</span>'
            : '<span class="chip-mini st-doing">진행중</span>';
        var allDepts = a.depts || [];
        var anyDelivered = allDepts.some(function (dp) { return !!dp.deliveredAt; });
        /* 전달 후: 개선건이 있는 부서(actionable)만 요약·완료율에 포함, 0건 부서는 제외 */
        var scoped = anyDelivered
            ? allDepts.filter(function (dp) { return D().deptImpCount(a.id, dp.deptId).total > 0; })
            : allDepts;
        var deptCnt = scoped.length;
        var doneDept = scoped.filter(function (dp) {
            var c = D().deptImpCount(a.id, dp.deptId);
            return c.total > 0 && c.done === c.total;
        }).length;

        return '<div class="rl-summary"><div class="rl-summary-head">' +
                '<div class="rl-summary-title"><span class="type-badge">정기</span>' + esc(a.title) + ' ' + stChip + '</div>' +
                '<div class="rl-summary-meta">' +
                    '<span>대상 부서 <b>' + deptCnt + '개</b> (완료 ' + doneDept + '개)</span>' +
                    surveySummaryCell(a) +
                    '<span>보고서 <b>' + (a.files && a.files.report ? esc(a.files.report) : '미첨부') + '</b></span>' +
                    (a.status === 'COMPLETED' ? '<span>완료일 <b>' + esc(a.completed_at) + '</b></span>' : '') +
                '</div>' +
            '</div>' +
            '<div class="rl-progress">' +
                '<div class="rl-progress-bar"><div class="rl-progress-fill" style="width:' + prog.pct + '%"></div></div>' +
                '<div class="rl-progress-txt">개선 <b>' + prog.done + ' / ' + prog.total + '</b> (' + prog.pct + '%)</div>' +
            '</div></div>';
    }

    /* 설문조사표 첨부 가능 시점 — **보고서 등록 전까지만** (발주처 지시).
     * 설문조사표는 방문 전·중에 부서에서 받아 오는 입력 자료이고, 용역업체 보고서가 등록되면
     * 그 단계는 끝난 것이다. 보고서가 나온 뒤에 입력 자료를 바꾸면 보고서와 근거가 어긋난다.
     * 잠긴 뒤에는 지우지 않고 **열람만** 남긴다(이력·증빙이므로 사라지면 안 된다). */
    function surveyLocked(a) {
        return !a || a.status === 'COMPLETED' || ((a.review && a.review.stage) || 'NONE') !== 'NONE';
    }

    /* =============== 유해위험요인 설문조사표 첨부 (등록 이후) ===============
     * 생성 마법사에서 설문조사표 단계를 뺐으므로, 여기가 유일한 첨부 경로다.
     *   · 공통본  — 요약 카드에서 첨부 → 부서별본이 없는 모든 부서에 적용
     *   · 부서별본 — 부서 행에서 첨부 → 그 부서만 공통본 대신 사용
     * 완료된 평가는 첨부를 잠근다(이력 왜곡 방지). */
    function surveySummaryCell(a) {
        var p = D().surveyProgress(a.id);
        var locked = surveyLocked(a);
        var txt = p.all
            ? '<b>' + esc(p.all) + '</b>'
            : '<b class="rl-survey-none">미첨부</b>';
        var btns = (locked || !canManage()) ? '' :
            ' <button type="button" class="rl-file-btn" data-tour="rsk-survey" onclick="RSKLIST.openSurveyAll()">' +
                (p.all ? '변경' : '＋ 첨부') + '</button>' +
            (p.all ? ' <button type="button" class="rl-file-btn" onclick="RSKLIST.clearSurveyAll()">삭제</button>' : '');
        var note = locked
            ? '<span class="rl-survey-lock" title="설문조사표는 보고서 등록 전까지만 첨부할 수 있습니다">🔒 보고서 등록 후 잠김</span>'
            : '';
        return '<span>공통 유해위험요인 설문조사표 ' + txt + btns +
            '<span class="rl-survey-prog">부서 적용 ' + p.done + '/' + p.total + '</span>' + note + '</span>';
    }
    /* =============== 첨부 모달 (설문조사표·보고서 공용) ===============
     * **실제 파일을 고른다.** DYV2.uploadDrop 의 opts.pick 이 숨은 <input type="file"> 을 붙여
     * 클릭·키보드·끌어놓기를 모두 받고, 형식·용량 검증(FILE_LIMITS)까지 마친 결과만 넘어온다.
     * 고른 파일명이 아래 '첨부 파일명' 칸에 자동으로 들어가고, 담당자가 원하면 고쳐 쓸 수 있다.
     * (프로토타입이라 파일 내용을 서버로 보내지는 않는다 — 선택·검증·기록까지만 실제로 동작한다) */
    var PICKED = null;   /* 방금 고른 파일 메타 {name,size} */
    function surveyModal(title, noticeHtml, defName, confirmCall, opts) {
        opts = opts || {};
        PICKED = null;
        V().openModal(title,
            noticeHtml +
            V().uploadDrop(
                '<div style="font-weight:700;">클릭하여 ' + esc(opts.what || '파일') + ' 선택</div>' +
                '<div style="font-size:var(--fs-12);color:var(--text-gray);margin-top:4px;">또는 파일을 이 영역에 끌어다 놓으세요</div>',
                null, { hint: true, pick: 'RSKLIST.onPickFile' }) +
            '<div id="rl-picked" class="rl-picked" aria-live="polite"></div>' +
            '<div class="rl-modal-row" style="margin-top:10px;">' +
                '<label class="form-label" for="rl-survey-name">첨부 파일명</label>' +
                '<input type="text" class="form-input" id="rl-survey-name" value="' + esc(defName) + '">' +
                '<p class="file-hint">파일을 고르면 실제 파일명으로 자동 입력됩니다. 필요하면 고쳐 쓰세요.</p>' +
            '</div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="' + confirmCall + '">첨부</button>');
    }
    /* uploadDrop(pick) 콜백 — 검증을 통과한 파일 메타만 들어온다 */
    function onPickFile(files) {
        var f = files && files[0]; if (!f) return;
        PICKED = f;
        var name = document.getElementById('rl-survey-name');
        if (name) name.value = f.name;
        var slot = document.getElementById('rl-picked');
        if (slot) {
            slot.innerHTML = '<span class="chip-status chip-sm success">선택됨</span> ' +
                '<b>' + esc(f.name) + '</b> <span class="rl-picked-size">' + fmtSize(f.size) + '</span>' +
                ' <button type="button" class="rl-file-btn" onclick="RSKLIST.clearPick()">선택 해제</button>';
        }
        toast('파일 선택: ' + f.name);
    }
    function clearPick() {
        PICKED = null;
        var slot = document.getElementById('rl-picked');
        if (slot) slot.innerHTML = '';
    }
    function fmtSize(b) {
        if (!b && b !== 0) return '';
        return b < 1024 ? b + 'B' : b < 1048576 ? (b / 1024).toFixed(0) + 'KB' : (b / 1048576).toFixed(1) + 'MB';
    }
    function surveyNameInput(fallback) {
        var el = document.getElementById('rl-survey-name');
        return ((el && el.value) || fallback || '').trim();
    }
    function openSurveyAll() {
        if (!canManage()) { denyToast(); return; }
        var a = current(); if (!a) return;
        surveyModal('공통 유해위험요인 설문조사표 첨부',
            '<p style="font-size:13px;">선정된 <b>' + (a.depts || []).length + '개 부서</b>에 일괄 적용됩니다. ' +
            '부서별로 다른 설문조사표가 필요하면 부서 행에서 개별 첨부하세요.</p>',
            a.year + '_정기평가_유해위험요인설문조사표.hwpx', 'RSKLIST.doSurveyAll()',
            { what: '유해위험요인 설문조사표' });
    }
    function doSurveyAll() {
        var a = current(); if (!a) return;
        var name = surveyNameInput(a.year + '_정기평가_유해위험요인설문조사표.hwpx');
        if (!name) { toast('파일명을 입력하세요.'); return; }
        D().setSurveyAll(a.id, name);
        V().closeModal();
        toast('공통 유해위험요인 설문조사표 첨부 · 부서에 발송 (프로토타입)');
        render();
    }
    function clearSurveyAll() {
        if (!canManage()) { denyToast(); return; }
        var a = current(); if (!a) return;
        var p = D().surveyProgress(a.id);
        var onlyCommon = (a.depts || []).filter(function (dp) { return !dp.surveyFile; }).length;
        V().openModal('공통 유해위험요인 설문조사표 삭제',
            '<p style="font-size:13px;">공통 유해위험요인 설문조사표 <b>' + esc(p.all) + '</b> 를 삭제합니다.<br>' +
            '부서별 설문조사표가 없는 <b>' + onlyCommon + '개 부서</b>가 <b>설문조사표 미첨부</b> 상태가 됩니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="RSKLIST.doClearSurveyAll()">삭제</button>');
    }
    function doClearSurveyAll() {
        var a = current(); if (!a) return;
        D().setSurveyAll(a.id, '');
        V().closeModal(); toast('공통 유해위험요인 설문조사표 삭제'); render();
    }
    function openDeptSurvey(deptId) {
        if (!canManage()) { denyToast(); return; }   /* 형제 함수(openSurveyAll·clearSurveyAll)와 대칭 */
        var a = current(); if (!a) return;
        var name = D().deptName(deptId);
        var all = (a.files && a.files.surveyAll) || '';
        surveyModal(name + ' — 부서 설문조사표 첨부',
            '<p style="font-size:13px;">이 부서만 <b>공통본 대신</b> 사용할 설문조사표를 첨부합니다.' +
            (all ? '<br><span style="color:var(--text-gray);">현재 적용 중인 공통본: ' + esc(all) + '</span>' : '') + '</p>',
            a.year + '_' + name + '_유해위험요인설문조사표.hwpx', "RSKLIST.doDeptSurvey('" + deptId + "')",
            { what: '유해위험요인 설문조사표' });
    }
    function doDeptSurvey(deptId) {
        var a = current(); if (!a) return;
        var name = surveyNameInput(a.year + '_' + D().deptName(deptId) + '_유해위험요인설문조사표.hwpx');
        if (!name) { toast('파일명을 입력하세요.'); return; }
        D().setDeptSurvey(a.id, deptId, name);
        V().closeModal();
        toast(D().deptName(deptId) + ' 부서 설문조사표 첨부');
        render();
    }
    function clearDeptSurvey(deptId) {
        var a = current(); if (!a) return;
        D().setDeptSurvey(a.id, deptId, '');
        toast(D().deptName(deptId) + ' 부서 설문조사표 삭제 · 공통본 적용');
        render();
    }
    /* =============== 부서 제출본(설문조사표 작성본) 대리 등록 ===============
     * `dp.reportFile` 이 담는 것은 **부서가 작성해 낸 설문조사표**다 — 용역 보고서가
     * 아니다(용역 통합 보고서는 `a.files.report` 로 따로 있고 검수 입력이 그것이다).
     * 필드 이름이 report 라 오해를 사기 쉬워 여기 적어 둔다. 2026-08-11 정정 전에는
     * 이 모달이 "용역업체가 작성한 보고서를 첨부합니다"라고 설명해, 같은 값을
     * 두 화면이 다른 것으로 부르고 있었다.
     *
     * 이 경로는 **주관부서의 대리 등록**이다 — 부서가 종이·메일로 낸 경우를 위해 둔다.
     * 부서 담당자 본인의 제출 경로는 openMySubmit() 이다. */
    function openDeptReport(deptId) {
        var a = current(); if (!a) return;
        var name = D().deptName(deptId);
        var dp = (a.depts || []).filter(function (x) { return x.deptId === deptId; })[0] || {};
        surveyModal(name + ' — 제출본 대리 등록',
            '<p style="font-size:13px;"><b>' + esc(name) + '</b>가 작성한 <b>설문조사표 작성본</b>을 주관부서가 대신 등록합니다. ' +
            '부서가 종이나 메일로 제출한 경우에 씁니다 — 부서 담당자는 자기 화면에서 직접 제출합니다.' +
            (dp.reportFile ? '<br><span style="color:var(--text-gray);">현재 제출본: ' + esc(dp.reportFile) + '</span>' : '') + '</p>',
            a.year + '_' + name + '_설문조사표_작성본.hwpx', "RSKLIST.doDeptReport('" + deptId + "')",
            { what: '설문조사표 작성본' });
    }
    function doDeptReport(deptId) {
        var a = current(); if (!a) return;
        var name = surveyNameInput(a.year + '_' + D().deptName(deptId) + '_설문조사표_작성본.hwpx');
        if (!name) { toast('파일명을 입력하세요.'); return; }
        /* 대리 등록이므로 제출자를 '재난안전과 대리 등록'으로 남긴다 — 부서가 직접 낸 것과
           구분되지 않으면 나중에 "우리는 안 냈는데 냈다고 돼 있다"가 된다. */
        D().setDeptReport(a.id, deptId, name, remindBy() + ' 대리 등록');
        V().closeModal();
        toast(D().deptName(deptId) + ' 제출본 대리 등록');
        render();
    }
    function clearDeptReport(deptId) {
        var a = current(); if (!a) return;
        D().setDeptReport(a.id, deptId, '');
        toast(D().deptName(deptId) + ' 제출본 삭제');
        render();
    }
    /* 용역 통합 보고서 열기 — 부서별 개선조치를 적을 때 근거로 여는 문서다.
       프로토타입이라 실제 파일이 없으므로 그 사실을 알린다. */
    function openIntegratedReport() {
        var a = current(); if (!a) return;
        var f = a.files && a.files.report;
        if (!f) { toast('첨부된 통합 보고서가 없습니다.'); return; }
        toast('통합 보고서 열기: ' + f + ' (프로토타입 — 실제 파일 뷰어는 미연결)');
    }
    /* 제출본 열기 — 프로토타입이라 실제 파일이 없다. 없는 동작을 약속하지 않고 그 사실을 알린다. */
    function openDeptReportFile(deptId) {
        var a = current(); if (!a) return;
        var dp = (a.depts || []).filter(function (x) { return x.deptId === deptId; })[0];
        if (!dp || !dp.reportFile) { toast('제출된 설문조사표가 없습니다.'); return; }
        toast('제출본 열기: ' + dp.reportFile + ' (프로토타입 — 실제 파일 뷰어는 미연결)');
    }

    /* =============== 부서 담당자 본인의 제출 (2026-08-11 신설) ===============
     * 종전에는 이 단계가 '내 할일'에만 있어, 위험성평가 축을 떼어 개발하면 흐름
     * 한가운데가 비었다. 같은 도메인 함수(setDeptReport)를 쓰므로 두 화면 중 어디서
     * 내도 같은 값이 되고, 이력에는 실제 제출자가 남는다. */
    /* 제출 주체 — **내 소속 부서**의 담당자 본인. 관리·감독 계층은 조회만 한다.
       남의 이름으로 제출하면 그것은 기록의 위조다.
       판정은 DYROLE.canAct 단일 출처를 쓴다(CLAUDE.md §12) — 여기서 tier 를 다시
       따지면 권한 규칙이 두 곳이 되고, 한쪽만 고쳐지는 날이 온다.
       ※ 주관부서 담당자도 **자기 부서 몫만** 여기서 낸다. 남의 부서 것은 canAct 가
         허용하더라도 이 경로가 아니라 대리 등록(openDeptReport)으로 간다 —
         '본인 제출'과 '대리 등록'은 이력에 다르게 남아야 한다. */
    function mySubmitDept() {
        var p = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        if (!p) return '';                       /* 롤 스위처 없는 환경 */
        var mine = p.deptId || '';
        if (!mine) return '';
        return (global.DYROLE.canAct && global.DYROLE.canAct(mine)) ? mine : '';
    }
    function openMySubmit() {
        var a = current(); if (!a) return;
        var p = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        var deptId = mySubmitDept();
        if (!deptId) { toast('설문조사표 제출은 그 부서 담당자 본인이 합니다.'); return; }
        var dp = (a.depts || []).filter(function (x) { return x.deptId === deptId; })[0];
        if (!dp) { toast('소속 부서가 이 평가의 대상이 아닙니다.'); return; }
        if (surveyLocked(a)) { toast('보고서가 등록되어 제출본을 더 이상 바꿀 수 없습니다.'); return; }
        var form = dp.surveyFile || (a.files && a.files.surveyAll) || '';
        var nm = D().deptName(deptId);
        surveyModal(nm + ' — 설문조사표 제출',
            '<p style="font-size:13px;">배포된 양식을 내려받아 작성한 뒤 여기에 올립니다.</p>' +
            (form
                ? '<p class="file-hint" style="margin-bottom:8px;">배포 양식 ' +
                  '<button type="button" class="rl-file-btn" onclick="RSKLIST.dlForm()">📥 ' + esc(form) + '</button></p>'
                : '<p class="file-hint" style="margin-bottom:8px;">배포된 양식이 없습니다 — 재난안전과에 문의하세요.</p>') +
            (dp.reportFile
                ? '<p class="file-hint">현재 제출본 <b>' + esc(dp.reportFile) + '</b>' +
                  (dp.reportAt ? ' (' + esc(dp.reportAt) + (dp.reportBy ? ' · ' + esc(dp.reportBy) : '') + ')' : '') +
                  ' — 새 파일을 올리면 교체됩니다.</p>'
                : ''),
            a.year + '_' + nm + '_설문조사표_작성본.hwpx', 'RSKLIST.doMySubmit()',
            { what: '작성한 설문조사표' });
    }
    function dlForm() {
        var a = current(); if (!a) return;
        var dp = (a.depts || []).filter(function (x) { return x.deptId === mySubmitDept(); })[0] || {};
        var form = dp.surveyFile || (a.files && a.files.surveyAll) || '';
        toast('설문조사표 다운로드: ' + form + ' (프로토타입 — 실제 파일은 미연결)');
    }
    function doMySubmit() {
        var a = current(); if (!a) return;
        var deptId = mySubmitDept();
        if (!deptId) { toast('설문조사표 제출은 그 부서 담당자 본인이 합니다.'); return; }
        if (surveyLocked(a)) { toast('보고서가 등록되어 제출본을 더 이상 바꿀 수 없습니다.'); return; }
        var p = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        var nm = D().deptName(deptId);
        var name = surveyNameInput(a.year + '_' + nm + '_설문조사표_작성본.hwpx');
        if (!name) { toast('작성한 설문조사표 파일을 선택하세요.'); return; }
        D().setDeptReport(a.id, deptId, name, nm + (p && p.name ? ' · ' + p.name : ' 담당자'));
        V().closeModal();
        toast('설문조사표 제출 · 재난안전과로 전달되었습니다');
        render();
    }

    /* 현재 연도의 평가 (설문조사표 핸들러 공통 진입점) */
    function current() { return (D().assessments(state.year) || [])[0]; }

    /* ===== 보고서 첨부·교체 (개선 건수 확인 단계) — 파일만 갱신, 작성 내역은 건드리지 않는다 ===== */
    function openReportAttach() {
        if (!canManage()) { denyToast(); return; }
        var a = current(); if (!a) return;
        var existing = (a.files && a.files.report) || '';
        surveyModal('용역업체 보고서 첨부',
            '<p style="font-size:13px;">개선 건수 확인 단계에서 <b>보고서(최종본·보완본)를 첨부·교체</b>합니다. ' +
            '이미 작성·전달된 <b>개선 건수와 조치 내역은 그대로 유지</b>됩니다.' +
            (existing ? '<br><span style="color:var(--text-gray);">현재 보고서: ' + esc(existing) + '</span>' : '') + '</p>',
            a.year + '_정기평가_보고서_최종.hwpx', 'RSKLIST.doReportAttach()',
            { what: '용역업체 보고서' });
    }
    function doReportAttach() {
        var a = current(); if (!a) return;
        var name = surveyNameInput(a.year + '_정기평가_보고서.hwpx');
        if (!name) { toast('파일명을 입력하세요.'); return; }
        D().setReportFile(a.id, name);
        V().closeModal();
        toast('보고서 첨부 완료 · 개선 건수·조치 내역은 유지됩니다');
        render();
    }

    /* 조회 전용 부서 표 — 관리 조작(첨부·검수·기한 설정) 없이 진행 상황만.
       [상세]는 남긴다: 무엇이 어떻게 조치됐는지 보는 것은 조회의 핵심이다. */
    function renderDeptsReadOnly(a) {
        /* 조회 범위 밖 부서는 아예 빼고 그린다 (DYROLE.scope, layout.js) —
           사업소장이 남의 과 위험성평가 진행 상황을 볼 이유가 없다.
           군수·재난안전과는 'all' 이라 종전과 같이 전부 보인다. */
        var rows = (a.depts || []).filter(function (dp) {
            return !global.DYROLE || !global.DYROLE.inScope || global.DYROLE.inScope(dp.deptId);
        }).map(function (dp) {
            var c = D().deptImpCount(a.id, dp.deptId);
            var lbl = !dp.deliveredAt ? '전달 전' : (c.total && c.done === c.total ? '완료' : '조치중');
            return '<tr>' +
                '<td><b>' + esc(D().deptName(dp.deptId)) + '</b></td>' +
                '<td>' + esc(dp.inspectDate || '-') + '</td>' +
                '<td>' + (dp.reportFile
                    ? '<span class="rl-ro-file">' + esc(dp.reportFile) + '</span>'
                    : '<span class="rl-ro-none">미제출</span>') + '</td>' +
                '<td>' + (c.total ? c.done + ' / ' + c.total : '-') + '</td>' +
                '<td>' + esc(dp.dueDate || '-') + '</td>' +
                '<td><span class="chip-status ' + V().toneOf(lbl) + ' chip-sm">' + lbl + '</span></td>' +
                '<td style="text-align:center;">' + (c.total
                    ? '<button type="button" class="btn btn-outline btn-sm" onclick="RSKLIST.openDept(\'' + esc(dp.deptId) + '\')">상세</button>'
                    : '') + '</td>' +
            '</tr>';
        }).join('');
        if (!rows) {
            /* 범위 안에 보여줄 부서가 없는 경우와 애초에 대상이 없는 경우를 구분한다.
               '대상 부서가 아니다'는 위 안내(manageNote)가 이미 말하므로 여기서는
               반복하지 않고 **다음에 무엇이 생기면 채워지는지**만 말한다. */
            var scoped = global.DYROLE && global.DYROLE.scope && global.DYROLE.scope() !== 'all';
            rows = '<tr><td colspan="7"><div class="v2-empty">' +
                (scoped && (a.depts || []).length
                    ? '소속 부서 진행 상황이 없습니다.<br>대상 부서로 선정되면 <b>점검일자와 조치 진행</b>이 여기에 표시됩니다.'
                    : '대상 부서가 없습니다.') +
            '</div></td></tr>';
        }
        /* 표 외형은 이 화면이 이미 쓰는 .rl-dept-table 을 그대로 받는다(rsk-list.html 인라인 style).
           종전에는 여기만 `.rl-table` 이라는 **어디에도 정의가 없는 클래스**를 써서,
           조회 전용 화면(부서 담당자·사업소장·군수)에서만 테두리·헤더 배경·셀 여백이
           통째로 빠져 글자가 맞붙어 보였다. .rl-ro-table 은 폭·줄바꿈만 얹는 modifier 다. */
        return '<div class="rl-table-scroll"><table class="rl-dept-table rl-ro-table"><thead><tr>' +
            '<th style="min-width:120px;">부서</th><th style="width:110px;">점검일</th>' +
            '<th style="min-width:180px;">설문조사표 제출</th><th style="width:96px;">개선조치</th>' +
            '<th style="width:110px;">조치기한</th><th style="width:88px;">상태</th>' +
            '<th style="width:72px;"></th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    /* =============== 부서별 조치 탭 =============== */
    function renderDepts(a) {
        var review = a.review || { stage: 'NONE' };
        var reportBlock = renderReportBlock(a, review);

        /* 검수 중이면 검수 인라인 패널을 부서 테이블 대신 표시 */
        if (review.stage === 'REVIEW') {
            return reportBlock + fromFacilNote(a) + renderReviewPanel(a);
        }

        var facilNote = fromFacilNote(a);
        var allDepts = a.depts || [];
        var anyDelivered = allDepts.some(function (dp) { return !!dp.deliveredAt; });
        /* 전달 이후에는 개선건 0건 부서(지적사항 없음)를 목록에서 제외.
           보고서 업로드 전에는 전체 노출 유지. */
        var visible = anyDelivered
            ? allDepts.filter(function (dp) { return D().deptImpCount(a.id, dp.deptId).total > 0; })
            : allDepts;
        var excluded = allDepts.length - visible.length;

        var rows = visible.map(function (dp) { return deptRow(a, dp); }).join('');
        if (!rows) rows = '<tr><td colspan="8" style="text-align:center;color:var(--text-gray);padding:24px;">' +
            (allDepts.length ? '조치 대상 부서가 없습니다. 지적사항이 있는 부서가 발견되지 않았습니다.' : '선정된 부서가 없습니다.') + '</td></tr>';

        var excludedNote = excluded > 0
            ? '<div class="rl-dept-excluded">지적사항 없는 부서 <b>' + excluded + '개</b> 제외 · ' +
                allDepts.filter(function (dp) { return dp.deliveredAt && !D().deptImpCount(a.id, dp.deptId).total; })
                    .map(function (dp) { return D().deptName(dp.deptId); }).join(', ') +
              '</div>'
            : '';

        var deptTable =
            '<div class="rl-card"><div class="rl-card-title">부서별 조치</div>' +
                '<div class="rl-table-scroll"><table class="rl-dept-table"><thead><tr>' +
                    '<th>부서</th><th>점검일</th><th>설문조사표 양식</th><th>설문조사표 제출본</th><th>개선건수</th><th>조치기한</th><th>상태</th><th>관리</th>' +
                '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
                excludedNote +
            '</div>';

        return reportBlock + facilNote + deptTable;
    }

    function deptRow(a, dp) {
        var name = D().deptName(dp.deptId);
        var c = D().deptImpCount(a.id, dp.deptId);
        var overdue = D().improvementsFor(a.id, dp.deptId).some(function (m) { return D().isOverdue(m); });
        var deliveredNo = !dp.deliveredAt;
        var stCls = dp.status === 'DONE' ? 'st-done' : 'st-todo';
        var stLbl = dp.status === 'DONE' ? '조치완료' : '조치전';
        var reviewStage = (a.review && a.review.stage) || 'NONE';

        var mngBtn;
        if (a.status === 'COMPLETED') {
            mngBtn = '<button type="button" class="btn btn-outline btn-sm" onclick="RSKLIST.openDept(\'' + dp.deptId + '\')">보기</button>';
        } else if (deliveredNo) {
            mngBtn = reviewStage === 'NONE'
                ? '<span style="font-size:12px;color:var(--text-gray);">보고서 대기</span>'
                : '<button type="button" class="btn btn-outline btn-sm" onclick="RSKLIST.openDept(\'' + dp.deptId + '\')">검수 진행</button>';
        } else {
            mngBtn = '<button type="button" class="btn btn-primary btn-sm" onclick="RSKLIST.openDept(\'' + dp.deptId + '\')">관리</button>';
        }
        var remindBtn = (overdue && a.status !== 'COMPLETED')
            ? ' <button type="button" class="btn btn-outline btn-sm" style="border-color:var(--status-warning-border);color:var(--status-warning-fg);" onclick="RSKLIST.remindDept(\'' + dp.deptId + '\')">재촉</button>'
            : '';
        /* 설문조사표 — 부서별본 > 공통본 순으로 적용. **보고서 등록 전까지만** 첨부·교체 가능. */
        var locked = surveyLocked(a);
        var commonFile = (a.files && a.files.surveyAll) || '';
        var surveyCell;
        if (dp.surveyFile) {
            surveyCell = '<span class="rl-tiny-file">' + esc(dp.surveyFile) + '</span>' +
                (locked ? '' : ' <button type="button" class="rl-file-btn" onclick="RSKLIST.openDeptSurvey(\'' + dp.deptId + '\')">교체</button>' +
                    ' <button type="button" class="rl-file-btn" onclick="RSKLIST.clearDeptSurvey(\'' + dp.deptId + '\')">×</button>');
        } else if (commonFile) {
            surveyCell = '<span class="rl-tiny-file">' + esc(commonFile) + '</span>' +
                '<span class="rl-survey-tag">공통</span>' +
                (locked ? '' : ' <button type="button" class="rl-file-btn" onclick="RSKLIST.openDeptSurvey(\'' + dp.deptId + '\')">부서별</button>');
        } else {
            surveyCell = locked
                ? '<span style="color:var(--text-gray);">-</span>'
                : '<button type="button" class="rl-file-btn" onclick="RSKLIST.openDeptSurvey(\'' + dp.deptId + '\')">＋ 설문조사표 첨부</button>';
        }
        /* 설문조사표 제출본 — 그 부서가 양식을 받아 작성해 낸 파일이다(용역 보고서가 아니다).
         * 부서 담당자 본인 제출은 openMySubmit, 이 칸은 주관부서의 대리 등록 경로다.
         * 대상 부서는 점검일(방문일)을 지정한 이 목록에서 그대로 이어지므로 부서를 다시 고르지 않는다. */
        var reportCell;
        if (dp.reportFile) {
            reportCell = '<button type="button" class="rl-file-btn" onclick="RSKLIST.openDeptReportFile(\'' + dp.deptId + '\')" title="제출본 열기">📄 ' + esc(dp.reportFile) + '</button>' +
                (locked ? '' : ' <button type="button" class="rl-file-btn" onclick="RSKLIST.openDeptReport(\'' + dp.deptId + '\')">교체</button>' +
                    ' <button type="button" class="rl-file-btn" onclick="RSKLIST.clearDeptReport(\'' + dp.deptId + '\')">×</button>');
        } else {
            reportCell = locked
                ? '<span style="color:var(--text-gray);">-</span>'
                : '<button type="button" class="rl-file-btn" onclick="RSKLIST.openDeptReport(\'' + dp.deptId + '\')">＋ 제출본 대리 등록</button>';
        }
        var impCell = c.total ? c.done + ' / ' + c.total : '<span style="color:var(--text-gray);">-</span>';
        var dueCell = dp.dueDate
            ? '<span class="' + (overdue ? 'rl-overdue' : '') + '">' + esc(dp.dueDate) + '</span>'
            : '<span style="color:var(--text-gray);">-</span>';

        return '<tr>' +
            '<td class="rl-dept-name">' + esc(name) + '</td>' +
            '<td>' + esc(dp.inspectDate || '-') + '</td>' +
            '<td>' + surveyCell + '</td>' +
            '<td>' + reportCell + '</td>' +
            '<td>' + impCell + '</td>' +
            '<td>' + dueCell + '</td>' +
            '<td><span class="chip-mini ' + stCls + '">' + stLbl + '</span>' +
                (dp.deliveredAt ? '<div style="font-size:var(--fs-12);color:var(--text-gray);margin-top:3px;">전달 ' + esc(dp.deliveredAt) + '</div>' : '') + '</td>' +
            '<td>' + mngBtn + remindBtn + '</td>' +
        '</tr>';
    }

    /* =============== 보고서 업로드 블록 =============== */
    function renderReportBlock(a, review) {
        var stage = review.stage || 'NONE';
        if (a.status === 'COMPLETED') {
            return '<div class="rl-card"><div class="rl-card-title">용역업체 보고서 (HWPX)</div>' +
                '<div class="rl-report-row">' +
                    (a.files && a.files.report
                        ? '<span class="rl-report-file">📄 ' + esc(a.files.report) + '</span>' +
                          '<span style="font-size:12px;color:var(--text-gray);margin-left:auto;">' + esc(a.completed_at || '') + ' 승인 완료</span>'
                        : '<span style="font-size:12px;color:var(--text-gray);">보고서 미첨부</span>') +
                '</div></div>';
        }
        var body;
        if (stage === 'NONE') {
            body = '<button type="button" class="rl-file-btn" data-tour="rsk-report" onclick="RSKLIST.uploadReport()">＋ 통합 보고서 첨부</button>' +
                '<span style="font-size:12px;color:var(--text-gray);">전체 통합본을 첨부하면 <b>부서별 개선조치 작성표</b>가 열립니다. 용역 보고서는 통합본 하나이며, 부서가 낸 <b>설문조사표 제출본</b>은 아래 표에서 따로 관리합니다.</span>';
        } else if (stage === 'REVIEW') {
            var pd0 = (review.parsedDepts || {});
            var totalRows = 0;
            Object.keys(pd0).forEach(function (k) { totalRows += (pd0[k] || []).length; });
            body = '<span class="rl-report-file">📄 ' + esc(a.files.report) + '</span>' +
                '<span class="chip-mini st-doing" style="margin-left:6px;">작성 중</span>' +
                '<span style="font-size:12px;color:var(--text-gray);margin-left:auto;">작성 <b>' + totalRows + '</b>건 · 아래에서 부서별 개선조치를 적고 조치기한을 설정하세요</span>' +
                '<button type="button" class="rl-file-btn" onclick="RSKLIST.clearReport()">작성 취소</button>';
        } else {
            /* DELIVERED = 개선 건수 확인 단계. 보고서(최종본·보완본)를 첨부·교체해도 작성 내역은 유지된다. */
            body = (a.files && a.files.report
                    ? '<span class="rl-report-file">📄 ' + esc(a.files.report) + '</span>'
                    : '<span style="font-size:12px;color:var(--status-warning-fg);">보고서 미첨부</span>') +
                '<span class="chip-mini st-done" style="margin-left:6px;">전달 완료</span>' +
                '<span style="font-size:12px;color:var(--text-gray);margin-left:auto;">' + esc(review.extractedAt || '') + ' 작성 완료</span>' +
                '<button type="button" class="rl-file-btn" onclick="RSKLIST.openReportAttach()">' +
                    (a.files && a.files.report ? '보고서 교체' : '＋ 보고서 첨부') + '</button>';
        }
        return '<div class="rl-card"><div class="rl-card-title">용역업체 보고서 (HWPX)</div>' +
            '<div class="rl-report-row">' + body + '</div></div>';
    }

    /* =============== 부서별 개선조치 작성 인라인 패널 ===============
       담당자가 부서별 보고서를 열어 보고 **직접** 개선조치를 적는다(자동 추출 없음 — 2026-07-30 회의).
       이 단계에서는 유해위험요인·분류·원인·개선조치 내용만 다루고,
       조치기한은 다음 단계 [조치기한 설정] 모달에서 일괄+부서별로 지정한다. */
    /* 부서 작성 블록 상단의 자료 바 — **자료를 열어 보며 적는 단계이므로 여기서 열려야 한다.**
     * 종전에는 제출본·설문조사표 첨부가 '부서별 조치' 표에만 있었는데, 작성(REVIEW) 단계에서는
     * 그 표가 검수 패널로 교체돼 사라졌다. "이 부서의 자료를 열어 보고 적으세요"라고 안내하면서
     * 정작 열 수 없는 상태였다. 설문조사표도 발주처 요구(녹취 264 "조치 보고서 끝나기 전까지만
     * 첨부하면 돼요")대로 이 단계에서 계속 붙일 수 있어야 한다.
     *
     * ⚠ 라벨을 '부서 보고서'로 쓰지 말 것 (2026-08-14 정정) — 이 자리의 값은 `dp.reportFile`
     * 이고 그것이 담는 것은 **부서가 작성해 낸 설문조사표 작성본**이다(setDeptReport 참고).
     * 용역업체 보고서는 통합본 하나(`a.files.report`)뿐이라 부서별 보고서라는 것이 없는데,
     * 종전 라벨이 '부서 보고서'여서 설문조사표 제출본이 용역 보고서로 읽혔다. */
    function deptFilesBar(a, deptId) {
        var dp = (a.depts || []).filter(function (x) { return x.deptId === deptId; })[0] || {};
        var common = (a.files && a.files.surveyAll) || '';
        /* 제출본 교체·대리 등록은 주관부서 몫이다 — 부서 담당자의 제출 경로는
           설문조사표 제출(openMySubmit)이고 보고서 등록 뒤에는 이미 잠긴다. */
        var rep = dp.reportFile
            ? '<button type="button" class="rl-file-btn" onclick="RSKLIST.openDeptReportFile(\'' + deptId + '\')">📄 ' + esc(dp.reportFile) + '</button>' +
              (canManage() ? ' <button type="button" class="rl-file-btn" onclick="RSKLIST.openDeptReport(\'' + deptId + '\')">교체</button>' : '')
            : '<span class="rl-files-warn">미제출</span>' +
              (canManage() ? ' <button type="button" class="rl-file-btn" onclick="RSKLIST.openDeptReport(\'' + deptId + '\')">＋ 대리 등록</button>' : '');
        /* 설문조사표 양식은 이 단계(보고서 등록 후)에서는 **열람만** 한다 — 첨부 시점은 보고서 등록 전까지다.
         * 방금 무엇을 근거로 조치를 적는지 확인은 되어야 하므로 파일명은 계속 보여준다. */
        var applied = dp.surveyFile || common;
        var sur = applied
            ? '<span class="rl-tiny-file">' + esc(applied) + '</span>' +
              (dp.surveyFile ? '' : '<span class="rl-survey-tag">공통</span>') +
              '<span class="rl-survey-lock">🔒 열람</span>'
            : '<span class="rl-files-warn">설문조사표 양식 미첨부 — 보고서 등록 전에만 붙일 수 있습니다</span>';
        /* 조치 내용의 근거는 용역업체 **통합** 보고서다 — 열 수 있어야 한다. */
        var integ = (a.files && a.files.report)
            ? '<button type="button" class="rl-file-btn" onclick="RSKLIST.openIntegratedReport()">📄 ' + esc(a.files.report) + '</button>'
            : '<span class="rl-files-warn">미첨부</span>';
        return '<div class="rl-files-bar">' +
            '<span class="rl-files-item"><span class="rl-files-k">용역 통합 보고서</span>' + integ + '</span>' +
            '<span class="rl-files-item"><span class="rl-files-k">설문조사표 양식</span>' + sur + '</span>' +
            '<span class="rl-files-item"><span class="rl-files-k">설문조사표 제출본</span>' + rep + '</span>' +
        '</div>';
    }

    /* 시설물에서 넘어왔는데 아직 행에 넣지 못한 상태를 알린다 —
       조작 권한이 없거나 검수 단계가 아니면 넣을 자리가 없다. 그 이유를 밝힌다. */
    function fromFacilNote(a) {
        if (!state.fromFacil) return '';
        var nm = esc(state.fromFacil.name || state.fromFacil.no);
        var stage = (a && a.review && a.review.stage) || 'NONE';
        var why = !canManage()
            ? '조회 권한만 있어 검수 행을 만들 수 없습니다 — 주관부서 담당자에게 요청하세요.'
            : (stage !== 'REVIEW'
                ? '아직 보고서 검수 단계가 아닙니다. 통합 보고서를 첨부하면 이 시설물을 넣을 행을 만들 수 있습니다.'
                : '부서 블록의 <b>[＋ 행 추가]</b> 를 누르면 새 행에 이 시설물이 채워집니다.');
        return '<div class="rl-ro" role="note"><b>시설물 ' + nm + '</b> 에서 넘어왔습니다 — ' + why + '</div>';
    }
    function renderReviewPanel(a) {
        var pd = (a.review && a.review.parsedDepts) || {};
        var totalRows = 0;
        var owner = canManage();
        /* 부서 담당자에게는 **자기 부서 블록만** 그린다 — 남의 부서 조치 내용은
           조회 범위 밖이다(§12). 주관부서는 종전대로 전 부서를 본다. */
        var deptIds = (a.depts || []).map(function (dp) { return dp.deptId; })
            .filter(function (id) { return owner || canWriteReview(id); });
        var deptBlocks = deptIds.map(function (deptId) {
            var rows = pd[deptId] || [];
            totalRows += rows.length;
            var name = D().deptName(deptId);
            var open = state.reviewOpen[deptId] !== false;
            var head =
                '<div class="rl-rv-dept-head" onclick="RSKLIST.reviewToggleDept(\'' + deptId + '\')">' +
                    '<span class="rl-rv-arrow ' + (open ? 'open' : '') + '">▶</span>' +
                    '<span class="rl-rv-dept-name">' + esc(name) + '</span>' +
                    '<span class="chip-mini ' + (rows.length ? 'st-doing' : 'st-todo') + '" style="margin-left:auto;">' +
                        (rows.length ? rows.length + '건 작성' : '미작성') + '</span>' +
                '</div>';
            var body = '';
            if (open) {
                var tbody = rows.map(function (r, i) { return reviewRow(a.id, deptId, i, r); }).join('');
                if (!rows.length) tbody = '<tr><td colspan="9" style="text-align:center;color:var(--text-gray);padding:14px;">위 자료(통합 보고서·설문조사표 제출본)를 열어 보고 [＋행 추가]로 조치할 내용을 적으세요.</td></tr>';
                body = '<div class="rl-rv-dept-body">' +
                    deptFilesBar(a, deptId) +
                    '<div class="rl-rv-scroll"><table class="rl-rv-table"><thead><tr>' +
                        '<th style="width:132px;">시설물</th>' +
                        '<th style="min-width:150px;">유해위험요인</th><th style="width:104px;">분류</th>' +
                        '<th style="min-width:120px;">원인</th>' +
                        '<th style="min-width:180px;">개선조치</th>' +
                        '<th style="width:130px;">담당자</th><th style="width:104px;">증빙(전/후)</th>' +
                        '<th style="width:84px;">완료</th><th style="width:34px;"></th>' +
                    '</tr></thead><tbody>' + tbody + '</tbody></table></div>' +
                    /* 4단계 앵커를 이어받는다 — 보고서를 첨부하면 위쪽 [＋ 통합 보고서 첨부]가
                       사라져 투어가 가리킬 곳을 잃고 "이 화면에 아직 없는 요소입니다" 경고를
                       띄웠다. 성공한 순간 경고가 뜨면 시연이 어색해진다. 이 단계의 다음 행동이
                       실제로 [＋ 행 추가]이므로(clickPath 2번) 같은 앵커 이름을 붙인다. */
                    '<button type="button" class="btn btn-outline btn-sm" data-tour="rsk-report" onclick="RSKLIST.reviewAdd(\'' + deptId + '\')">＋ 행 추가</button>' +
                '</div>';
            }
            return '<div class="rl-rv-dept">' + head + body + '</div>';
        }).join('');

        var hasRows = totalRows > 0;
        /* 부서 담당자에게는 자기 부서 몫의 안내를 낸다 — 조치기한 설정은 주관부서가 한다.
           도달할 수 없는 버튼을 안내에 쓰지 않는다(§4-3 "도달 가능한 행동만 약속한다"). */
        var footNote = owner
            ? (hasRows
                ? '<span style="color:var(--text-gray);">[＋행 추가]로 부서별 조치 내용을 모두 적은 뒤 <b>[작성완료 · 조치기한 설정]</b>으로 진행하세요.</span>'
                : '<span style="color:var(--status-warning-fg);font-weight:700;">아직 작성한 항목이 없습니다. [＋행 추가]로 최소 1건을 입력해야 다음 단계로 갈 수 있습니다.</span>')
            : (hasRows
                ? '<span style="color:var(--text-gray);">적은 내용은 <b>즉시 저장</b>됩니다. 조치기한은 주관부서(재난안전과)가 설정합니다.</span>'
                : '<span style="color:var(--text-gray);">[＋행 추가]로 우리 부서 조치 내용을 적으세요. 내용은 <b>즉시 저장</b>되고, 조치기한은 주관부서(재난안전과)가 설정합니다.</span>');
        /* 단계 진행 버튼은 주관부서만 — 없는 권한의 1차 CTA 를 띄우지 않는다 */
        var footActions = owner
            ? '<button type="button" class="btn btn-secondary" onclick="RSKLIST.clearReport()">보고서 취소·재업로드</button>' +
              '<button type="button" class="btn btn-primary"' + (hasRows ? '' : ' disabled style="opacity:.5;cursor:not-allowed;"') +
                  ' data-tour="rsk-deliver" onclick="RSKLIST.openDueSet()">작성완료 · 조치기한 설정 →</button>'
            : '';

        return '<div class="rl-card rl-rv-card">' +
            '<div class="rl-card-title" style="justify-content:space-between;">' +
                '<span>부서별 개선조치 작성 <span class="chip-mini st-doing" style="margin-left:6px;">작성 중</span></span>' +
                '<span style="font-size:12px;color:var(--text-gray);font-weight:400;">시작 ' + esc(a.review.extractedAt || '') + ' · 총 ' + totalRows + '건</span>' +
            '</div>' +
            '<p style="font-size:12px;color:var(--text-gray);margin-bottom:12px;">' +
                '용역업체 보고서를 <b>시스템이 자동으로 옮기지 않습니다</b> — 부서 블록 상단의 <b>통합 보고서</b>를 열어 보고 조치할 내용을 <b>직접</b> 적습니다. ' +
                '현재 <b>' + totalRows + '건</b> 작성됨. ' +
                (owner
                    ? '조치기한은 다음 단계 [조치기한 설정] 모달에서 <b>일괄·부서별</b>로 지정합니다. 대상 부서 담당자도 자기 부서 블록을 같은 표에서 직접 적을 수 있습니다.'
                    : '<b>우리 부서 블록</b>만 표시되며, 여기서 적은 내용은 주관부서가 보는 것과 <b>같은 데이터</b>입니다 — <b>내 할일</b>에서 증빙을 올려도 같은 곳에 쌓입니다.') +
            '</p>' +
            deptBlocks +
            '<div class="rl-rv-foot">' +
                '<div class="rl-rv-foot-note">' + footNote + '</div>' +
                '<div class="rl-rv-foot-actions">' + footActions + '</div>' +
            '</div>' +
        '</div>';
    }
    /* 법령 근거 열은 작성표에서 제거했다 (2026-07-31) — 법이 요구하는 기록 항목은
       유해·위험요인·위험성 결정·조치 내용이고(산안법 §36①·⑤), 행별 조문 인용은
       의무가 아니다. 그런데도 미지정을 주황 '대기' 칩으로 띄워 필수처럼 읽혔다.
       스키마의 `r.basis` 는 남긴다 — 다른 경로가 채우면 개선조치 상세에서 그대로 표시된다. */
    function reviewRow(aid, deptId, i, r) {
        var cats = ['', '기계적', '화학적', '작업특성', '전기', '고소작업', '보건', '기타'];
        return '<tr>' +
            /* 시설물 — FMS 시설물 대장에서 고른다(SCR-FAC-001 연계). 담당자 셀과 같은 방식:
               셀의 버튼 → 모달 안 인라인 대장(CLAUDE.md §1 단일 모달).
               **선택 항목이다** — 작업 행동·화학물질·보건 요인은 시설물에 붙지 않는다.
               저장은 이름이 아니라 시설물번호로 한다(동명 시설물·개명에 견디기 위해). */
            '<td>' + facilCell(deptId, i, r) + '</td>' +
            '<td><input type="text" value="' + esc(r.name) + '" placeholder="유해위험요인" onchange="RSKLIST.reviewSet(\'' + deptId + '\',' + i + ',\'name\',this.value)"></td>' +
            '<td><select onchange="RSKLIST.reviewSet(\'' + deptId + '\',' + i + ',\'category\',this.value)">' +
                cats.map(function (c) { return '<option value="' + c + '"' + (r.category === c ? ' selected' : '') + '>' + (c || '분류') + '</option>'; }).join('') +
            '</select></td>' +
            '<td><input type="text" value="' + esc(r.cause) + '" placeholder="원인" onchange="RSKLIST.reviewSet(\'' + deptId + '\',' + i + ',\'cause\',this.value)"></td>' +
            '<td><textarea rows="2" placeholder="개선조치" onchange="RSKLIST.reviewSet(\'' + deptId + '\',' + i + ',\'action\',this.value)">' + esc(r.action) + '</textarea></td>' +
            /* 담당자 — 조직도(ORGPICK)로만 고른다. 표 셀 안에서 트리를 펼치면 표가 무너지므로
               버튼 → 모달 안 인라인 조직도로 받는다(CLAUDE.md §1 단일 모달 · §3 ORGPICK MUST). */
            '<td>' + ownerCell(deptId, i, r) + '</td>' +
            /* 증빙 — 개선 전/후 사진. 발주처가 가장 강조한 부분이다:
               "지금 제일 중요한 거는 개선 전 개선 후가 없어요. 이 개선 후를 사진을 올리기만
                하면 돼요 … 사진 첨부해서 이렇게 하면은 이게 법적으로 한 거예요"(녹취 222·224) */
            '<td>' + photoCell(deptId, i, r) + '</td>' +
            /* 완료 여부 체크 — 참석자4 "체크리스트 마지막에 완료 여부 체크하는 거잖아요"(녹취 355).
               개선 후 사진이 없으면 체크할 수 없다(증빙 없는 완료는 기록으로서 거짓이 된다). */
            '<td style="text-align:center;">' + doneCell(deptId, i, r) + '</td>' +
            '<td style="text-align:center;"><button type="button" class="rl-rv-del" onclick="RSKLIST.reviewDel(\'' + deptId + '\',' + i + ')" title="삭제">×</button></td>' +
        '</tr>';
    }

    /* 표 셀에서는 '부서 · 역할 / 이름' 중 이름을 앞세운다 — 좁은 칸에서 이름이 먼저 읽혀야 한다.
       전체 문자열은 title 로 남긴다(잘라내되 잃지 않는다). */
    function shortOwner(v) {
        var s = String(v || '');
        var i = s.lastIndexOf('/');
        return i >= 0 ? s.slice(i + 1).trim() : s;
    }
    function ownerCell(deptId, i, r) {
        return r.owner
            ? '<button type="button" class="rl-rv-owner is-set" title="' + esc(r.owner) + '" onclick="RSKLIST.openRowOwner(\'' + deptId + '\',' + i + ')">' +
                  esc(shortOwner(r.owner)) + '</button>'
            /* 비워 두는 것이 기본이다 — **담당자는 그 부서가 정한다**(발주처 2026-08-06).
               재난안전과는 부서까지 정해 내려보내고, 누가 할지는 부서가 안다.
               다만 이미 아는 경우 미리 적어 줄 수 있어 지정 자체를 막지는 않는다. */
            : '<button type="button" class="rl-rv-owner" title="비워 두면 해당 부서가 지정합니다"' +
              ' onclick="RSKLIST.openRowOwner(\'' + deptId + '\',' + i + ')">부서에서 지정</button>';
    }
    /* 시설물 셀 — **세 상태**다 (2026-08-12 분리).
     *   지정됨      facilNo 있음        → 시설물명
     *   해당 없음   facilNa === true    → 확인한 결과 시설물에 붙지 않는 요인
     *   미지정      둘 다 아님(기본)    → 아직 판단하지 않음
     * 종전에는 빈 값을 곧바로 '해당 없음'으로 읽어, **판단하지 않은 것과 확인해서
     * 없는 것이 구분되지 않았다**. 이 프로젝트는 다른 축에서 이미 그 둘을 나누고
     * 있다(원료·제조물 0건을 '해당 없음'으로 단정하지 않음 · 이행점검의 해당없음
     * 사유 강제). 같은 원칙을 여기에도 적용한다.
     * 미지정을 경고색으로 띄우지는 않는다 — 필수가 아닌 항목을 필수처럼 보이게 하면
     * 담당자가 아무 시설물이나 골라 넣고, 그 순간 대장 연계가 거짓 기록이 된다. */
    function facilCell(deptId, i, r) {
        var call = ' onclick="RSKLIST.openRowFacil(\'' + deptId + '\',' + i + ')"';
        if (r.facilNo) {
            return '<button type="button" class="rl-rv-owner is-set" title="' + esc((r.facilNm || '') + ' · ' + r.facilNo) + '"' +
                call + '>' + esc(r.facilNm || r.facilNo) + '</button>';
        }
        if (r.facilNa) {
            return '<button type="button" class="rl-rv-owner is-na" title="확인 결과 시설물에 해당하지 않는 요인입니다"' +
                call + '>해당 없음</button>';
        }
        return '<button type="button" class="rl-rv-owner" title="시설물에 해당하는 요인이면 대장에서 고르세요 — 해당하지 않으면 [해당 없음]으로 표시하세요"' +
            call + '>미지정</button>';
    }
    /* 셀 안에서는 전·후 대표 1장씩을 썸네일로 보여준다 — 개수만으로는 무엇을 올렸는지
       알 수 없어 매번 열어봐야 한다. 자세히 보기는 관리 모달의 미리보기가 맡는다. */
    function photoCell(deptId, i, r) {
        var slot = function (arr, label) {
            var n = (arr || []).length;
            /* 대표 이미지는 '첫 장'이 아니라 '썸네일이 있는 첫 장'이다 — 앞자리에 미리보기
               없는 첨부가 있다고 뒤의 사진을 못 보여줄 이유가 없다. */
            var src = '';
            for (var k = 0; k < n && !src; k++) src = arr[k].thumb || arr[k].url || '';
            var inner = src
                ? '<img src="' + esc(src) + '" alt="" onerror="this.remove()">' +
                  (n > 1 ? '<span class="rl-rv-phn">+' + (n - 1) + '</span>' : '')
                : '<span class="rl-rv-phz">' + (n ? n + '건' : '—') + '</span>';
            return '<span class="rl-rv-ph' + (n ? ' has' : '') + '">' +
                '<span class="rl-rv-phl">' + label + '</span>' +
                '<span class="rl-rv-phb">' + inner + '</span></span>';
        };
        var b = (r.beforePhotos || []).length, af = (r.afterPhotos || []).length;
        return '<button type="button" class="rl-rv-photos" onclick="RSKLIST.openRowPhotos(\'' + deptId + '\',' + i + ')"' +
            ' aria-label="개선 전 ' + b + '장, 개선 후 ' + af + '장 — 사진 관리">' +
            slot(r.beforePhotos, '전') + slot(r.afterPhotos, '후') +
        '</button>';
    }
    function doneCell(deptId, i, r) {
        var canDone = (r.afterPhotos || []).length > 0;
        var id = 'rvdone-' + deptId + '-' + i;
        return '<label class="rl-rv-done' + (canDone ? '' : ' is-locked') + '" for="' + id + '"' +
            (canDone ? '' : ' title="개선 후 사진을 올려야 완료로 체크할 수 있습니다"') + '>' +
            '<input type="checkbox" id="' + id + '"' + (r.done ? ' checked' : '') + (canDone ? '' : ' disabled') +
                ' onchange="RSKLIST.reviewDone(\'' + deptId + '\',' + i + ',this.checked)"' +
                ' aria-label="이 행의 개선조치 완료 여부">' +
            '<span>' + (r.done ? esc(r.doneAt || '완료') : (canDone ? '완료' : '사진 필요')) + '</span>' +
        '</label>';
    }

    /* =============== 이력 탭 =============== */
    function renderHistory(a) {
        var items = [].concat(a.history || []);
        D().improvementsFor(a.id).forEach(function (m) {
            (m.history || []).forEach(function (h) {
                if (h.type === 'NOTIFY') return;
                items.push({
                    type: h.type, at: h.at, by: h.by,
                    memo: D().deptName(m.dept_id) + ' · ' + (m.hazard && m.hazard.name ? m.hazard.name + ' — ' : '') + h.memo
                });
            });
        });
        items.sort(function (x, y) { return (x.at || '').localeCompare(y.at || ''); });
        if (!items.length) return '<div class="rl-card"><div class="v2-empty">이력이 없습니다.</div></div>';

        var LABELS = { CONFIRM:'확인', RETURN:'반려', REOPEN:'확인취소', DRAFT:'공문기안', DISPATCH:'온나라상신', RECEIVE:'결재회신', CREATE:'생성', NOTIFY:'알림', DELIVER:'전달', REMIND:'재촉', REASON:'사유', DUE_CHANGE:'기한변경', STATUS:'상태변경', COMPLETE:'완료', REVIEW:'검토', REGISTER:'등록', FILE:'첨부' };
        var rows = items.map(function (h) {
            return '<div class="rl-hist-row">' +
                '<span class="rl-hist-at">' + esc(h.at || '') + '</span>' +
                '<span class="rl-hist-type ' + (h.type || '') + '">' + esc(LABELS[h.type] || h.type || '기타') + '</span>' +
                '<span class="rl-hist-body">' + esc(h.memo || '') +
                    (h.by ? '<span class="rl-hist-by">— ' + esc(h.by) + '</span>' : '') +
                '</span>' +
            '</div>';
        }).join('');
        return '<div class="rl-card"><div class="rl-card-title">이력 타임라인</div><div class="rl-history">' + rows + '</div></div>';
    }

    function setTab(t) { state.tab = t; render(); }
    function setYear(y) { state.year = y; state.tab = 'depts'; state.reviewOpen = {}; render(); }

    /* =============== 보고서 업로드·취소·검수 상호작용 =============== */
    /* 통합 보고서 첨부 — 여기서도 실제 파일을 고른다(구: 파일명 자동 생성). */
    function uploadReport() {
        if (!canManage()) { denyToast(); return; }
        var a = (D().assessments(state.year) || [])[0]; if (!a) return;
        surveyModal('용역업체 통합 보고서 첨부',
            '<p style="font-size:var(--fs-13);">전체 통합본을 첨부하면 <b>' + (a.depts || []).length + '개 부서</b>의 ' +
            '개선조치 작성표가 열립니다. 용역 보고서는 이 통합본 하나이며, 부서가 낸 설문조사표 제출본과는 별개입니다.</p>',
            a.year + '_정기평가_통합보고서.pdf', 'RSKLIST.doUploadReport()', { what: '통합 보고서' });
    }
    function doUploadReport() {
        var a = (D().assessments(state.year) || [])[0]; if (!a) return;
        var name = surveyNameInput(a.year + '_정기평가_통합보고서.pdf');
        if (!name) { toast('파일을 고르거나 파일명을 입력하세요.'); return; }
        var r = D().uploadReport(a.id, name);
        if (!r) return;
        state.reviewOpen = {};
        V().closeModal();
        toast('보고서 첨부 · ' + r.deptCount + '개 부서 개선조치 작성표를 열었습니다. 부서별로 조치 내용을 적으세요.');
        render();
    }
    /* 작성 취소 — 담당자가 손으로 적은 내용이 날아가므로 **몇 건이 사라지는지 반드시 밝힌다**
     * (CLAUDE.md §4 회수 경로 원칙: 확인 모달에 회수되는 건수를 명시). */
    function clearReport() {
        if (!canManage()) { denyToast(); return; }
        var a = (D().assessments(state.year) || [])[0]; if (!a) return;
        var pd = (a.review && a.review.parsedDepts) || {};
        var n = 0, depts = 0;
        Object.keys(pd).forEach(function (k) { if (pd[k].length) { depts++; n += pd[k].length; } });
        V().openModal('작성 취소',
            '<p style="font-size:var(--fs-13);">보고서 첨부와 <b>작성한 개선조치 내용</b>을 모두 지웁니다.</p>' +
            (n
                ? '<div class="check-notice" style="margin-top:10px;">직접 작성한 <b>' + depts + '개 부서 · ' + n + '건</b>이 함께 삭제됩니다. 되돌릴 수 없습니다.</div>'
                : '<div class="check-notice" style="margin-top:10px;">아직 작성한 항목이 없어 보고서 첨부만 해제됩니다.</div>'),
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="RSKLIST.doClearReport(\'' + a.id + '\')">삭제</button>');
    }
    function doClearReport(aid) {
        D().clearReport(aid);
        V().closeModal();
        state.reviewOpen = {};
        toast('보고서 첨부·작성 내용 삭제');
        render();
    }
    function reviewToggleDept(deptId) {
        state.reviewOpen[deptId] = state.reviewOpen[deptId] === false;
        render();
    }
    function reviewSet(deptId, i, k, v) {
        if (!canWriteReview(deptId)) { denyToast(deptId); return; }
        var a = (D().assessments(state.year) || [])[0]; if (!a) return;
        D().reviewSet(a.id, deptId, i, k, v);
    }
    function reviewDel(deptId, i) {
        if (!canWriteReview(deptId)) { denyToast(deptId); return; }
        var a = (D().assessments(state.year) || [])[0]; if (!a) return;
        D().reviewDel(a.id, deptId, i);
        render();
    }
    function reviewAdd(deptId) {
        if (!canWriteReview(deptId)) { denyToast(deptId); return; }
        var a = (D().assessments(state.year) || [])[0]; if (!a) return;
        D().reviewAdd(a.id, deptId);
        /* 시설물 위험도에서 넘어왔으면 새 행에 그 시설물을 미리 채운다 —
           담당자가 방금 고른 시설물을 다시 찾게 하지 않는다. 한 번만 쓰고 비운다. */
        if (state.fromFacil) {
            var rows = ((a.review && a.review.parsedDepts) || {})[deptId] || [];
            var i = rows.length - 1;
            if (i >= 0) {
                D().reviewSet(a.id, deptId, i, 'facilNo', state.fromFacil.no);
                D().reviewSet(a.id, deptId, i, 'facilNm', state.fromFacil.name);
                toast('시설물 ' + (state.fromFacil.name || state.fromFacil.no) + ' 을(를) 새 행에 넣었습니다.');
            }
            state.fromFacil = null;
        }
        state.reviewOpen[deptId] = true;
        render();
    }
    function rowOf(deptId, i) {
        var a = current(); if (!a || !a.review) return null;
        return ((a.review.parsedDepts || {})[deptId] || [])[i] || null;
    }

    /* ===== 행 담당자 — 조직도(ORGPICK 'member')로만 고른다 (CLAUDE.md §3 MUST) ===== */
    var ROW = null;       /* 열려 있는 행 {deptId, i} */
    var PREVIEW = null;   /* 펼쳐 둔 미리보기 {kind:'before'|'after', n} */
    function openRowOwner(deptId, i) {
        if (!canWriteReview(deptId)) { denyToast(deptId); return; }
        var r = rowOf(deptId, i); if (!r) return;
        ROW = { deptId: deptId, i: i };
        V().openModal('개선조치 담당자 지정',
            '<p style="font-size:var(--fs-13);margin:0 0 4px;"><b>' + esc(D().deptName(deptId)) + '</b> · ' +
                esc(r.name || '(유해위험요인 미입력)') + '</p>' +
            '<p class="file-hint"><b>담당자는 원칙적으로 해당 부서가 정합니다.</b> ' +
                '비워 두면 전달 후 그 부서가 개선조치 목록에서 지정합니다 — ' +
                '이미 아는 경우에만 여기서 미리 적어 주세요.</p>' +
            '<div class="rl-modal-row" style="margin-top:10px;">' +
                '<label class="form-label" for="rl-owner-name">담당자</label>' +
                '<div class="orgpick-field" id="rl-owner-field"><div style="display:flex;gap:8px;align-items:center;">' +
                    '<input type="text" class="form-input" id="rl-owner-name" readonly placeholder="조직도에서 담당자 선택" ' +
                        'style="flex:1;background:var(--gray-50);" value="' + esc(r.owner || '') + '">' +
                    '<button type="button" class="btn btn-outline" onclick="ORGPICK.toggle(\'rl-owner-field\',\'member\',\'RSKLIST.pickRowOwner\')">조직도</button>' +
                '</div></div>' +
            '</div>',
            (r.owner ? '<button type="button" class="btn btn-outline" style="margin-right:auto;" onclick="RSKLIST.clearRowOwner()">지정 해제</button>' : '') +
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="RSKLIST.saveRowOwner()">저장</button>');
    }
    function pickRowOwner(label) {
        var el = document.getElementById('rl-owner-name'); if (el) el.value = label;
    }
    function saveRowOwner() {
        if (!ROW) return;
        var el = document.getElementById('rl-owner-name');
        var v = (el && el.value || '').trim();
        if (!v) { toast('조직도에서 담당자를 고르세요.'); return; }
        reviewSet(ROW.deptId, ROW.i, 'owner', v);
        V().closeModal(); toast('담당자 지정: ' + v); render();
    }
    function clearRowOwner() {
        if (!ROW) return;
        reviewSet(ROW.deptId, ROW.i, 'owner', '');
        V().closeModal(); toast('담당자 지정 해제'); render();
    }

    /* ===== 행 시설물 — FMS 시설물 대장(SCR-FAC-001)에서 고른다 =====
     * 조직도 선택기와 같은 GUI 를 쓰되 데이터만 대장이다(DYFACIL.toggle).
     * 이 값이 개선조치까지 승계되어(js/rsk-data.js) 시설물 상세에 조치 내역으로 쌓인다. */
    function openRowFacil(deptId, i) {
        if (!canWriteReview(deptId)) { denyToast(deptId); return; }
        var r = rowOf(deptId, i); if (!r) return;
        if (!global.DYFACIL) { toast('시설물 대장을 불러오지 못했습니다.'); return; }
        ROW = { deptId: deptId, i: i };
        V().openModal('유해위험요인 — 시설물 지정',
            '<p style="font-size:var(--fs-13);margin:0 0 4px;"><b>' + esc(D().deptName(deptId)) + '</b> · ' +
                esc(r.name || '(유해위험요인 미입력)') + '</p>' +
            '<p class="file-hint"><b>시설물에 해당하는 요인만 지정합니다.</b> ' +
                '작업 행동·화학물질·보건처럼 특정 시설물에 붙지 않는 요인은 <b>[해당 없음]</b>으로 표시하세요. ' +
                '지정하면 이 조치가 해당 시설물의 조치 내역으로 남고, 시설물 위험도에도 반영할 수 있습니다.</p>' +
            '<p class="file-hint" style="margin-top:4px;">아직 판단하지 않았으면 그대로 두세요 — <b>미지정</b>으로 남고 어떤 단계도 막지 않습니다. ' +
                '다만 <b>미지정과 해당 없음은 다릅니다</b>: 앞은 아직 안 본 것이고 뒤는 확인해서 없는 것입니다.</p>' +
            '<div class="rl-modal-row" style="margin-top:10px;">' +
                '<label class="form-label" for="rl-facil-name">시설물</label>' +
                '<div class="orgpick-field" id="rl-facil-field"><div style="display:flex;gap:8px;align-items:center;">' +
                    '<input type="text" class="form-input" id="rl-facil-name" readonly placeholder="시설물 대장에서 선택" ' +
                        'style="flex:1;background:var(--gray-50);" value="' + esc(r.facilNm || '') + '">' +
                    '<button type="button" class="btn btn-outline" onclick="DYFACIL.toggle(\'rl-facil-field\',\'RSKLIST.pickRowFacil\')">시설물 대장</button>' +
                '</div>' +
                '<input type="hidden" id="rl-facil-no" value="' + esc(r.facilNo || '') + '">' +
                '</div>' +
            '</div>',
            (r.facilNo || r.facilNa
                ? '<button type="button" class="btn btn-outline" style="margin-right:auto;" onclick="RSKLIST.clearRowFacil()">미지정으로 되돌리기</button>'
                : '') +
            '<button type="button" class="btn btn-outline" onclick="RSKLIST.markRowFacilNa()">해당 없음</button>' +
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="RSKLIST.saveRowFacil()">저장</button>');
    }
    function pickRowFacil(no, name) {
        var el = document.getElementById('rl-facil-name'); if (el) el.value = name || no;
        var hid = document.getElementById('rl-facil-no'); if (hid) hid.value = no;
    }
    function saveRowFacil() {
        if (!ROW) return;
        var hid = document.getElementById('rl-facil-no');
        var no = (hid && hid.value || '').trim();
        if (!no) { toast('시설물 대장에서 고르거나 [취소]로 닫으세요.'); return; }
        var nm = global.DYFACIL && DYFACIL.label ? DYFACIL.label(no) : '';
        reviewSet(ROW.deptId, ROW.i, 'facilNo', no);
        reviewSet(ROW.deptId, ROW.i, 'facilNm', nm);
        reviewSet(ROW.deptId, ROW.i, 'facilNa', false);   /* 지정하면 '해당 없음'은 자동 해제 */
        V().closeModal(); toast('시설물 지정: ' + (nm || no)); render();
    }
    /* '해당 없음' — 확인한 결과 시설물에 붙지 않는 요인임을 **적극적으로** 표시한다.
       미지정(아직 안 봄)과 구분하기 위한 별도 상태다. */
    function markRowFacilNa() {
        if (!ROW) return;
        reviewSet(ROW.deptId, ROW.i, 'facilNo', '');
        reviewSet(ROW.deptId, ROW.i, 'facilNm', '');
        reviewSet(ROW.deptId, ROW.i, 'facilNa', true);
        V().closeModal(); toast('시설물 해당 없음으로 표시했습니다.'); render();
    }
    function clearRowFacil() {
        if (!ROW) return;
        reviewSet(ROW.deptId, ROW.i, 'facilNo', '');
        reviewSet(ROW.deptId, ROW.i, 'facilNm', '');
        reviewSet(ROW.deptId, ROW.i, 'facilNa', false);
        V().closeModal(); toast('미지정으로 되돌렸습니다.'); render();
    }

    /* ===== 행 증빙 사진 — 개선 전/후 =====
     * 발주처: "개선 전 개선 후가 없어요. 이 개선 후를 사진을 올리기만 하면 돼요"(녹취 222)
     * 실제 파일을 고른다(DYV2.uploadDrop opts.pick — 형식·용량 검증 포함). */
    function openRowPhotos(deptId, i) {
        if (!canWriteReview(deptId)) { denyToast(deptId); return; }
        var r = rowOf(deptId, i); if (!r) return;
        ROW = { deptId: deptId, i: i };
        PREVIEW = null;
        renderRowPhotos();
    }
    /* 미리보기는 모달을 겹치지 않고 해당 구역 안에서 펼친다 (CLAUDE.md §1 단일 모달).
       원본 objectURL 은 새로고침하면 죽으므로 onerror 로 썸네일에 폴백한다. */
    function previewHtml(kind) {
        if (!PREVIEW || PREVIEW.kind !== kind) return '';
        var r = rowOf(ROW.deptId, ROW.i); if (!r) return '';
        var arr = r[kind === 'before' ? 'beforePhotos' : 'afterPhotos'] || [];
        var f = arr[PREVIEW.n]; if (!f) return '';
        var full = f.url || f.thumb, thumb = f.thumb || '';
        if (!full) return '';
        var dim = f.w && f.h ? f.w + '×' + f.h + 'px · ' : '';
        return '<figure class="rl-ph-view">' +
            '<img src="' + esc(full) + '" alt="' + esc(f.name) + '"' +
                (thumb && thumb !== full ? ' onerror="this.onerror=null;this.src=\'' + esc(thumb) + '\'"' : '') + '>' +
            '<figcaption>' + esc(f.name) +
                '<span class="rl-ph-meta">' + dim + fmtSize(f.size) + '</span>' +
                '<button type="button" class="btn btn-outline btn-sm" onclick="RSKLIST.closePreview()">미리보기 닫기</button>' +
            '</figcaption></figure>';
    }
    function renderRowPhotos() {
        var r = rowOf(ROW.deptId, ROW.i); if (!r) return;
        var list = function (arr, kind) {
            if (!arr || !arr.length) return '<p class="rl-ph-none">첨부된 사진이 없습니다.</p>';
            return '<ul class="rl-ph-grid">' + arr.map(function (f, n) {
                var src = f.thumb || f.url;
                var sel = PREVIEW && PREVIEW.kind === kind && PREVIEW.n === n;
                /* 볼 수 없는 첨부(옛 시드·비이미지)는 버튼으로 만들지 않는다 —
                   눌러도 아무 일이 없는 버튼은 없는 기능을 약속하는 것이다. */
                var box = src
                    ? '<button type="button" class="rl-ph-thumb" onclick="RSKLIST.preview(\'' + kind + '\',' + n + ')"' +
                          ' aria-label="' + esc(f.name) + ' 미리보기" aria-expanded="' + (sel ? 'true' : 'false') + '">' +
                          '<img src="' + esc(src) + '" alt=""></button>'
                    : '<span class="rl-ph-thumb is-plain" title="미리보기를 만들 수 없는 첨부입니다">' +
                          '<span class="rl-ph-noimg">미리보기 없음</span></span>';
                return '<li class="rl-ph-item' + (sel ? ' is-open' : '') + '">' + box +
                    '<span class="rl-ph-name" title="' + esc(f.name) + '">' + esc(f.name) + '</span>' +
                    '<button type="button" class="rl-ph-del" onclick="RSKLIST.delRowPhoto(\'' + kind + '\',' + n + ')" ' +
                    'aria-label="' + esc(f.name) + ' 삭제">×</button></li>';
            }).join('') + '</ul>';
        };
        V().openModal('개선 전·후 사진 — ' + esc(D().deptName(ROW.deptId)),
            '<p style="font-size:var(--fs-13);margin:0 0 4px;"><b>' + esc(r.name || '(유해위험요인 미입력)') + '</b></p>' +
            '<p class="file-hint">개선 <b>후</b> 사진은 조치 완료의 법적 증빙입니다 — 이 사진이 있어야 완료로 체크할 수 있습니다.</p>' +
            '<div class="rl-ph-sec"><label class="form-label">개선 전 사진</label>' +
                V().uploadDrop('<b>개선 전 사진</b> <span style="font-size:var(--fs-12);color:var(--text-gray);">클릭 또는 끌어놓기</span>',
                    null, { pick: 'RSKLIST.onPickBefore', multiple: true, style: 'padding:12px;' }) +
                list(r.beforePhotos, 'before') + previewHtml('before') +
            '</div>' +
            '<div class="rl-ph-sec"><label class="form-label">개선 후 사진 <span style="color:var(--status-danger-fg)">*</span></label>' +
                V().uploadDrop('<b>개선 후 사진</b> <span style="font-size:var(--fs-12);color:var(--text-gray);">클릭 또는 끌어놓기</span>',
                    null, { pick: 'RSKLIST.onPickAfter', multiple: true, hint: true, style: 'padding:12px;' }) +
                list(r.afterPhotos, 'after') + previewHtml('after') +
            '</div>',
            '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal()">닫기</button>');
    }
    function preview(kind, n) {
        PREVIEW = (PREVIEW && PREVIEW.kind === kind && PREVIEW.n === n) ? null : { kind: kind, n: n };
        renderRowPhotos();
    }
    function closePreview() { PREVIEW = null; renderRowPhotos(); }
    function addRowPhotos(kind, files) {
        var r = rowOf(ROW.deptId, ROW.i); if (!r) return;
        var key = kind === 'before' ? 'beforePhotos' : 'afterPhotos';
        var arr = (r[key] || []).concat(files).slice(0, V().FILE_LIMITS.maxCount);
        reviewSet(ROW.deptId, ROW.i, key, arr);
        renderRowPhotos(); render();
        toast('개선 ' + (kind === 'before' ? '전' : '후') + ' 사진 ' + files.length + '건 첨부');
    }
    function onPickBefore(files) { addRowPhotos('before', files); }
    function onPickAfter(files) { addRowPhotos('after', files); }
    function delRowPhoto(kind, n) {
        var r = rowOf(ROW.deptId, ROW.i); if (!r) return;
        var key = kind === 'before' ? 'beforePhotos' : 'afterPhotos';
        var arr = (r[key] || []).slice(); arr.splice(n, 1);
        reviewSet(ROW.deptId, ROW.i, key, arr);
        PREVIEW = null;   /* 인덱스가 밀리므로 열려 있던 미리보기는 닫는다 */
        /* 개선 후 사진을 다 지우면 완료 체크는 근거를 잃으므로 함께 해제한다 */
        if (key === 'afterPhotos' && !arr.length) { reviewSet(ROW.deptId, ROW.i, 'done', false); reviewSet(ROW.deptId, ROW.i, 'doneAt', ''); }
        renderRowPhotos(); render();
    }

    /* ===== 행 완료 체크 ===== */
    function reviewDone(deptId, i, on) {
        if (!canWriteReview(deptId)) { denyToast(deptId); return; }
        var r = rowOf(deptId, i); if (!r) return;
        if (on && !(r.afterPhotos || []).length) {
            toast('개선 후 사진을 올려야 완료로 체크할 수 있습니다.');
            render(); return;
        }
        reviewSet(deptId, i, 'done', !!on);
        reviewSet(deptId, i, 'doneAt', on ? D().today() : '');
        render();
        if (on) toast('개선조치 완료 체크 — ' + (r.name || '해당 항목'));
    }

    /* =============== 조치기한 설정 모달 (단일 모달 · 인라인 부서별 조정)
       검수 화면에서 유효 내용(요인명·조치)이 채워진 행이 있는 부서만 대상. */
    var DUE = null;
    function openDueSet() {
        if (!canManage()) { denyToast(); return; }
        var a = (D().assessments(state.year) || [])[0]; if (!a) return;
        var pd = (a.review && a.review.parsedDepts) || {};
        var deptDues = {};
        (a.depts || []).forEach(function (dp) {
            var validRows = (pd[dp.deptId] || []).filter(function (r) {
                return !r.deleted && (r.name || '').trim() && (r.action || '').trim();
            });
            if (validRows.length) deptDues[dp.deptId] = '';
        });
        if (!Object.keys(deptDues).length) {
            toast('유효한 항목이 있는 부서가 없습니다. 요인명·개선조치를 채워주세요.');
            return;
        }
        DUE = { aid: a.id, bulkDue: '', deptDues: deptDues };
        renderDueModal();
    }
    function renderDueModal() {
        var a = D().assessmentOf(DUE.aid);
        var pd = (a.review && a.review.parsedDepts) || {};
        var rows = Object.keys(DUE.deptDues).map(function (deptId) {
            var name = D().deptName(deptId);
            var validCnt = (pd[deptId] || []).filter(function (r) {
                return !r.deleted && (r.name || '').trim() && (r.action || '').trim();
            }).length;
            return '<tr><td>' + esc(name) + '</td><td>' + validCnt + '건</td>' +
                '<td><input type="date" class="form-input" value="' + esc(DUE.deptDues[deptId] || '') +
                    '" onchange="RSKLIST.dueSetDept(\'' + deptId + '\', this.value)"></td></tr>';
        }).join('');
        var body =
            '<div class="rl-modal-row">' +
                '<label class="form-label">일괄 조치기한 (전 부서에 적용)</label>' +
                '<div class="rl-bulk">' +
                    '<input type="date" class="form-input" id="rl-due-bulk" value="' + esc(DUE.bulkDue) + '" style="max-width:200px;">' +
                    '<button type="button" class="btn btn-outline btn-sm" onclick="RSKLIST.dueApplyBulk()">일괄 적용</button>' +
                    '<span style="font-size:12px;color:var(--text-gray);">부서별 조정은 아래 표에서 수정하세요.</span>' +
                '</div>' +
            '</div>' +
            '<div class="rl-modal-row">' +
                '<label class="form-label">부서별 조치기한</label>' +
                '<table class="rl-dates-table"><thead><tr><th>부서</th><th>작성 건수</th><th>조치기한</th></tr></thead>' +
                    '<tbody>' + rows + '</tbody></table>' +
                '<p style="font-size:12px;color:var(--text-gray);margin-top:8px;">전달 시 부서별로 개선조치가 배분되고 알림이 발송됩니다. 이후 부서 담당자는 <b>이 화면의 조치 상세 카드</b> 또는 <b>내 할일</b>에서 완료 처리합니다.</p>' +
            '</div>';
        V().openModal('조치기한 설정 · 부서 전달', body,
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="RSKLIST.dueDeliver()">전달 실행</button>');
    }
    function dueApplyBulk() {
        var v = document.getElementById('rl-due-bulk').value;
        if (!v) { toast('일괄 적용할 일자를 선택하세요.'); return; }
        DUE.bulkDue = v;
        Object.keys(DUE.deptDues).forEach(function (k) { DUE.deptDues[k] = v; });
        renderDueModal();
    }
    function dueSetDept(deptId, v) { DUE.deptDues[deptId] = v; }
    function dueDeliver() {
        if (!canManage()) { denyToast(); return; }
        var bulk = document.getElementById('rl-due-bulk');
        if (bulk) DUE.bulkDue = bulk.value || DUE.bulkDue;
        var missing = Object.keys(DUE.deptDues).filter(function (k) { return !DUE.deptDues[k] && !DUE.bulkDue; });
        if (missing.length) { toast('일괄 기한 또는 부서별 기한을 지정하세요 (' + missing.length + '개 부서 미지정).'); return; }
        var r = D().deliverFromReview(DUE.aid, { bulkDue: DUE.bulkDue, deptDues: DUE.deptDues });
        V().closeModal();
        var msg = r.deptsTouched + '개 부서에 개선조치 ' + r.total + '건 전달 · 알림 발송 (프로토타입)';
        if (r.deptsExcluded) msg += ' · 지적사항 없는 ' + r.deptsExcluded + '개 부서는 조치 대상 제외';
        toast(msg);
        state.reviewOpen = {};
        render();
    }

    /* =============== 부서 상세(전달 완료 후) — 단일 모달 ===============
     * 카드 렌더링은 공용 IMPCARD(js/rsk-imp-cards.js)가 맡는다. 수시평가 조치 상세와
     * 같은 화면이어야 하므로 화면마다 다시 짜지 않는다 (CLAUDE.md §7). */
    function openDept(deptId) {
        /* 표에서 지운 부서를 전역 호출로는 열 수 있으면 범위 제한이 무의미해진다 */
        if (global.DYROLE && global.DYROLE.inScope && !global.DYROLE.inScope(deptId)) {
            toast('소속 부서 소관이 아닙니다.'); return;
        }
        var a = (D().assessments(state.year) || [])[0]; if (!a) return;
        var dp = (a.depts || []).find(function (x) { return x.deptId === deptId; });
        if (!dp) return;
        if (!global.IMPCARD) { toast('개선조치 상세 모듈을 불러오지 못했습니다.'); return; }
        IMPCARD.open({
            key: 'dept:' + a.id + ':' + deptId,
            title: D().deptName(deptId) + ' — 개선조치 상세',
            metaHtml:
                '<span>점검일자 <b>' + esc(dp.inspectDate || '-') + '</b></span>' +
                '<span>설문조사표 <b>' + esc(dp.surveyFile || (a.files && a.files.surveyAll) || '-') + '</b></span>' +
                (dp.reportFile ? '<span>부서 제출본 <b>' + esc(dp.reportFile) + '</b></span>' : '') +
                (dp.deliveredAt ? '<span>전달일 <b>' + esc(dp.deliveredAt) + '</b></span>' : '') +
                (dp.dueDate ? '<span>조치기한 <b>' + esc(dp.dueDate) + '</b></span>' : ''),
            noteHtml: '부서 담당자는 <b>이 카드에서 바로</b> 완료 처리·재촉 응답을 합니다 — ' +
                '같은 건을 <b>내 할일</b>에서 올려도 같은 곳에 쌓입니다.',
            items: function () { return D().improvementsFor(a.id, deptId); },
            canRemind: a.status !== 'COMPLETED',
            onRemind: 'RSKLIST.remindOne',
            /* 완료 확인은 주관부서만 — 판정은 canManage() 한 곳에서만 한다 */
            canConfirm: canManage(),
            onChange: render
        });
    }

    /* =============== 재촉 =============== */
    /* 재촉 이력의 발신자 — 담양읍장이 눌러도 '재난안전과'로 남으면 이력이 거짓이 된다 */
    function remindBy() {
        var p = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        return p ? ((p.deptName ? p.deptName + ' ' : '') + p.name) : '재난안전과';
    }
    function remindDept(deptId) {
        var a = (D().assessments(state.year) || [])[0]; if (!a) return;
        var ms = D().improvementsFor(a.id, deptId).filter(function (m) { return D().isOverdue(m); });
        if (!ms.length) { toast('기한초과 항목이 없습니다.'); return; }
        ms.forEach(function (m) {
            D().pushImpHistory(m.id, { type: 'REMIND', by: remindBy(), memo: '기한초과 재촉 (기한 ' + (m.due || m.due_date) + ')' });
        });
        D().pushHistory(a.id, { type: 'REMIND', by: remindBy(), memo: D().deptName(deptId) + ' 기한초과 ' + ms.length + '건 재촉' });
        toast(D().deptName(deptId) + ' 재촉 알림 발송 (' + ms.length + '건)'); render();
    }
    function remindOne(impId) {
        var m = D().improvementOf(impId); if (!m) return;
        D().pushImpHistory(m.id, { type: 'REMIND', by: remindBy(), memo: '기한초과 재촉 (기한 ' + (m.due || m.due_date) + ')' });
        D().pushHistory(m.assessment_id, { type: 'REMIND', by: remindBy(), memo: D().deptName(m.dept_id) + ' · ' + (m.hazard && m.hazard.name || '') + ' 재촉' });
        toast('재촉 알림 발송 (프로토타입)');
        V().closeModal();
        render();
    }

    /* =============== 생성 마법사 (단일 모달, STEP 교체) =============== */
    function openWizard() {
        if (!canManage()) { denyToast(); return; }
        var year = state.year;
        var dup = D().assessments(year);
        if (dup.length) {
            V().openModal(year + '년 정기평가 이미 존재',
                '<p style="font-size:13px;">이미 <b>' + year + '년 정기 위험성평가</b>가 등록되어 있습니다.<br>다른 연도로 셀렉트를 바꿔서 생성하세요.</p>',
                '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal()">확인</button>');
            return;
        }
        var depts = D().deptCandidates();
        /* v1.1 §6.4: STEP1 부서 선정 기본값 전체선택 (인사정보시스템에서 조직 목록 로드 목업) */
        var deptSel = {};
        depts.forEach(function (d) { deptSel[d.id] = true; });
        /* 설문조사표 단계는 마법사에서 제외 — 생성 후 목록에서 공통/부서별로 첨부한다.
         * (설문조사표 확정이 늦어져 부서 선정·점검일자 통보까지 막히던 문제를 끊는다) */
        W = {
            step: 1, year: year,
            deptSel: deptSel,     /* {deptId: true} — 기본값 전체선택 */
            deptDates: {},        /* {deptId: 'YYYY-MM-DD'} */
            bulkDate: '',
            candidates: depts
        };
        renderWizard();
    }
    function renderWizard() {
        V().openModal(W.year + '년 정기평가 생성 마법사', wizardBody(), wizardFoot());
    }
    function wizardBody() {
        var stepBar =
            '<div class="rl-wiz-step">' +
                ['1. 부서 선정', '2. 점검일자'].map(function (s, i) {
                    var n = i + 1;
                    var cls = W.step === n ? 'on' : (W.step > n ? 'done' : '');
                    return '<span class="wz ' + cls + '">' + (W.step > n ? '✓ ' : '') + s + '</span>';
                }).join('') +
            '</div>';
        if (W.step === 1) return stepBar + wizStep1();
        return stepBar + wizStep2();
    }
    function wizardFoot() {
        var back = W.step > 1
            ? '<button type="button" class="btn btn-secondary" onclick="RSKLIST.wizBack()">← 이전</button>'
            : '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>';
        var nextLabel = W.step < 2 ? '다음 →' : '생성';
        var next = '<button type="button" class="btn btn-primary" onclick="RSKLIST.wizNext()">' + nextLabel + '</button>';
        return back + next;
    }
    function wizStep1() {
        var total = W.candidates.length;
        var cnt = Object.keys(W.deptSel).filter(function (k) { return W.deptSel[k]; }).length;
        var allOn = cnt === total && total > 0;
        return '<div class="rl-modal-row">' +
            '<div class="rl-hr-badge">' +
                '<span class="rl-hr-chip">🔗 인사정보시스템 연동</span>' +
                '<span style="font-size:12px;color:var(--text-gray);">조직(부서) 목록을 불러왔습니다 (프로토타입 · 실제는 <code>DYV2.ORG</code> 파생).</span>' +
                '<span style="font-size:12px;color:var(--text-black);font-weight:700;margin-left:auto;">선정 <b id="rl-w-cnt">' + cnt + '</b> / ' + total + '개 부서</span>' +
            '</div>' +
            '<label class="form-label" style="margin-top:10px;">평가 대상 부서 선택 <span style="color:var(--status-danger-fg)">*</span> ' +
                '<span style="color:var(--text-gray);font-weight:400;">(기본 전체선택 · 필요 시 해제)</span></label>' +
            '<div class="rl-dept-toolbar">' +
                '<label class="rl-dept-allck"><input type="checkbox" id="rl-w-allck"' + (allOn ? ' checked' : '') +
                    ' onchange="RSKLIST.wizToggleAllDepts(this.checked)"> 전체선택/해제</label>' +
            '</div>' +
            /* 공용 인라인 조직도(ORGPICK) 다중 선택 — 전 화면 공통 트리·검색·스크롤 재사용 */
            ORGPICK.deptsPanel('rl-w-orgtree', {
                selectedPath: 'RSKLIST.wizSelDepts',
                onToggle: 'RSKLIST.wizToggleDept',
                countId: 'rl-w-cnt',
                allckId: 'rl-w-allck',
            }) +
            '<p style="font-size:12px;color:var(--text-gray);margin-top:8px;">재난안전과 담당자와 용역업체가 논의한 결과를 반영합니다. 조직도는 <code>DYV2.ORG</code> 단일 출처.</p>' +
        '</div>';
    }
    /* ORGPICK 이 현재 선택 상태를 읽어가는 창구 */
    function wizSelDepts() { return W ? W.deptSel : {}; }
    /* 체크 토글은 상태만 갱신한다 — 마법사를 다시 그리면(openModal) 조직도 검색어·스크롤이 날아가므로
     * 선택 개수·전체선택 배지 동기화는 ORGPICK 이 인플레이스로 처리한다. */
    function wizToggleDept(id, on) {
        if (on) W.deptSel[id] = true; else delete W.deptSel[id];
    }
    function wizToggleAllDepts(on) {
        W.deptSel = {};
        if (on) W.candidates.forEach(function (d) { W.deptSel[d.id] = true; });
        ORGPICK.refreshDepts('rl-w-orgtree');   /* 체크 상태만 다시 맞춤 (검색어·스크롤 보존) */
    }
    function wizStep2() {
        var selIds = Object.keys(W.deptSel).filter(function (k) { return W.deptSel[k]; });
        var rows = selIds.map(function (id) {
            var name = D().deptName(id);
            var v = W.deptDates[id] || '';
            return '<tr><td>' + esc(name) + '</td><td><input type="date" class="form-input" value="' + esc(v) +
                '" onchange="RSKLIST.wizSetDate(\'' + id + '\', this.value)"></td></tr>';
        }).join('');
        return '<div class="rl-modal-row">' +
            '<label class="form-label">일괄 점검일자 (선택 부서 전체에 적용)</label>' +
            '<div class="rl-bulk">' +
                '<input type="date" class="form-input" id="rl-w-bulkdate" value="' + esc(W.bulkDate) + '" style="max-width:180px;">' +
                '<button type="button" class="btn btn-outline btn-sm" onclick="RSKLIST.wizApplyBulkDate()">일괄 적용</button>' +
                '<span style="font-size:12px;color:var(--text-gray);">건별 조정은 아래 표에서 수정하세요.</span>' +
            '</div>' +
            '<table class="rl-dates-table"><thead><tr><th>부서</th><th>점검일자</th></tr></thead>' +
                '<tbody>' + rows + '</tbody></table>' +
            '<p style="font-size:12px;color:var(--text-gray);margin-top:10px;">' +
                '유해위험요인 설문조사표는 생성 후 <b>부서별 조치 목록</b>에서 공통본 또는 부서별로 첨부합니다 — 설문조사표 없이 먼저 일정을 통보할 수 있습니다.</p>' +
        '</div>';
    }
    function wizApplyBulkDate() {
        var v = document.getElementById('rl-w-bulkdate').value;
        if (!v) { toast('일괄 적용할 일자를 선택하세요.'); return; }
        W.bulkDate = v;
        Object.keys(W.deptSel).forEach(function (id) { if (W.deptSel[id]) W.deptDates[id] = v; });
        renderWizard();
    }
    function wizSetDate(id, v) { W.deptDates[id] = v; }

    function wizBack() { if (W.step > 1) { W.step--; renderWizard(); } }
    function wizNext() {
        var selIds = Object.keys(W.deptSel).filter(function (k) { return W.deptSel[k]; });
        if (W.step === 1) {
            if (!selIds.length) { toast('1개 이상 부서를 선택하세요.'); return; }
        }
        if (W.step === 2) {
            var missing = selIds.filter(function (id) { return !W.deptDates[id]; });
            if (missing.length) { toast('점검일자가 비어있는 부서가 있습니다 (' + missing.length + '개).'); return; }
            doCreate();
            return;
        }
        W.step++;
        renderWizard();
    }
    function doCreate() {
        var selIds = Object.keys(W.deptSel).filter(function (k) { return W.deptSel[k]; });
        /* 설문조사표는 비운 채 생성 — 목록에서 첨부한다 */
        var deptsPayload = selIds.map(function (id) {
            return { deptId: id, inspectDate: W.deptDates[id] || '', surveyFile: '' };
        });
        var a = D().addRegular({ year: W.year, depts: deptsPayload, surveyAll: '' });
        V().closeModal();
        toast('정기평가 생성 · ' + selIds.length + '개 부서에 점검예정일 통보 · 설문조사표는 목록에서 첨부');
        state.tab = 'depts';
        state.reviewOpen = {};
        render();
    }

    /* =============== init =============== */
    function init(mountId) {
        /* 공문 상신·결재 회신 후 목록이 스스로 갱신되게 등록한다 —
           안 하면 상신했는데 화면은 '미상신'으로 남는다(EDUAPV 는 6개 화면이 등록한다). */
        if (global.DYRSKDOC && DYRSKDOC.registerRefresh) DYRSKDOC.registerRefresh(render);
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        var q = new URLSearchParams(location.search);
        var yr = q.get('year');
        if (yr) state.year = +yr;
        /* 시설물 위험도(SCR-FAC-003)에서 [평가 착수]로 넘어오면 시설물번호가 함께 온다.
           종전에는 year 만 읽어 넘어온 시설물이 화면에서 그대로 사라졌다 —
           버튼은 눌리는데 아무 일도 안 일어나는 상태였다.
           평가 대상은 부서 단위이고 시설물은 **행 단위** 값이므로(SCR-FAC-002 §6),
           평가를 자동 선택하지 않고 '이 시설물로 넘어왔다'를 유지했다가
           [＋ 행 추가] 시 그 행에 미리 채운다. */
        var fno = (q.get('facilNo') || '').trim();
        if (fno) {
            state.fromFacil = {
                no: fno,
                name: (q.get('name') || (global.DYFACIL ? DYFACIL.label(fno) : '') || '').trim()
            };
        }
        render();
    }

    global.RSKLIST = {
        init: init, setYear: setYear, setTab: setTab,
        resetDemo: resetDemo, doResetDemo: doResetDemo,
        /* 보고서·검수 (검수 화면에서는 확인 체크박스·행별 기한이 없다 — 조치기한은 다음 단계 모달에서만) */
        uploadReport: uploadReport, doUploadReport: doUploadReport, clearReport: clearReport, doClearReport: doClearReport,
        reviewToggleDept: reviewToggleDept, reviewSet: reviewSet,
        /* 행 담당자 (ORGPICK member) */
        openRowOwner: openRowOwner, pickRowOwner: pickRowOwner, saveRowOwner: saveRowOwner, clearRowOwner: clearRowOwner,
        /* 행 시설물 (FMS 시설물 대장) */
        openRowFacil: openRowFacil, pickRowFacil: pickRowFacil, saveRowFacil: saveRowFacil, clearRowFacil: clearRowFacil, markRowFacilNa: markRowFacilNa,
        /* 행 개선 전·후 사진 */
        openRowPhotos: openRowPhotos, onPickBefore: onPickBefore, onPickAfter: onPickAfter, delRowPhoto: delRowPhoto,
        preview: preview, closePreview: closePreview,
        /* 행 완료 체크 */
        reviewDone: reviewDone,
        reviewDel: reviewDel, reviewAdd: reviewAdd,
        openDueSet: openDueSet, dueApplyBulk: dueApplyBulk, dueSetDept: dueSetDept, dueDeliver: dueDeliver,
        /* 부서 상세·재촉 */
        openDept: openDept, openConfirmQueue: openConfirmQueue,
        remindDept: remindDept, remindOne: remindOne,
        /* 생성 마법사 (2-STEP: 부서→일자) — "대상자 = 대상 부서" (v1.1 §6.4)
         * 설문조사표는 마법사 단계가 아니라 생성 후 목록에서 첨부한다 */
        openWizard: openWizard, wizBack: wizBack, wizNext: wizNext,
        wizToggleDept: wizToggleDept, wizToggleAllDepts: wizToggleAllDepts, wizSelDepts: wizSelDepts,
        wizApplyBulkDate: wizApplyBulkDate, wizSetDate: wizSetDate,
        /* 유해위험요인 설문조사표 첨부 (등록 이후) */
        openSurveyAll: openSurveyAll, doSurveyAll: doSurveyAll,
        clearSurveyAll: clearSurveyAll, doClearSurveyAll: doClearSurveyAll,
        openDeptSurvey: openDeptSurvey, doDeptSurvey: doDeptSurvey, clearDeptSurvey: clearDeptSurvey,
        /* 부서별 보고서 (2026-07-30 회의) */
        openDeptReport: openDeptReport, doDeptReport: doDeptReport, clearDeptReport: clearDeptReport,
        /* 부서 담당자 본인의 설문조사표 제출 — '내 할일' 없이도 이 축이 닫히게 하는 경로 */
        openMySubmit: openMySubmit, doMySubmit: doMySubmit, dlForm: dlForm,
        openDeptReportFile: openDeptReportFile, openIntegratedReport: openIntegratedReport,
        /* 실제 파일 선택 콜백 (DYV2.uploadDrop opts.pick) */
        onPickFile: onPickFile, clearPick: clearPick,
        /* 보고서 첨부·교체 (개선 건수 확인 단계) */
        openReportAttach: openReportAttach, doReportAttach: doReportAttach
    };
})(window);
