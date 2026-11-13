/* =====================================================================
   dept-check.js · 부서 전수 이행 체크리스트 (전역 DEPTCHK)
   ---------------------------------------------------------------------
   2026-07-30 회의에서 확정된 "부서·사업장 단위로 했는지 안 했는지 훑는" 화면의 공용 엔진.

     참석자4 "그럼 그 부서가 그게 걸어져 있는지 안 걸어져 있는지 확인하게끔 체크리스트를
              만들어야 될 거 아니야 … 과 쭈르륵 사업소 쭈르륵 해가지고 돼 있는지 안 돼 있는지"
     참석자3 "어차피 이 시스템 존재 자체가 증빙 역할이니까 … 작은 거는 다 자료가 들어가야"

   같은 표를 **경영방침 게시 현황**과 **의무 이행점검** 두 곳이 쓴다.

   ── 두 가지 쓰임 (2026-11-12 이행점검 흐름 보완) ─────────────────────
   · 기본(경영방침 게시) — 부서가 [확인 등록]으로 게시/미게시/해당없음을 적는다.
   · **배포 흐름(opts.flow, 이행점검)** — 재난안전과가 점검표를 **배포**하고(양식·안내·기한·대상),
     부서가 내려받아 작성해 **[결과 제출]**하고, 재난안전과가 **[확인] / [보완 요청]**을 한다.
     군수 보고(마감 상신) 뒤에는 그 회차를 **잠근다**.
     근거: 전달-개발-이행점검·교육등록부-흐름보완-20261111-v1 · 확인-주무관-이행점검·교육-이슈점검-20261112-v2.

   ── «미등록(미제출)»은 저장 코드가 아니라 «기록 없음»이다 ───────────
   종전에는 손대지 않은 줄의 기본값이 TODO(미이행)라 **안 낸 부서와 점검했더니 미이행인 부서가
   같은 칩**으로 보였다. 그러면 정직하게 미이행을 적은 부서에도 독촉이 가고, 군수 보고의 미이행
   목록에 안 낸 부서가 섞인다. 저장 코드는 그대로 셋(DONE/TODO/NA)이고 «기록 없음»을 따로 판정한다.

   ── '해당없음'을 특별히 다루는 이유 ──────────────────────────────────
   발주처가 지적한 실패 모드가 **'해당 없음'으로 적고 빠져나가는 것**이었다. 해당없음은 사유 없이
   저장할 수 없고, 사유 없는 옛 데이터는 '사유 미기재 — 확인 필요'로 계속 드러난다.

   ── 부서 명단 갭 ────────────────────────────────────────────────────
   대상은 과·사업소 39개인데 DYV2.ORG 에는 일부만 있다. 지어내지 않고 '미등록'으로 드러낸다.
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }
    function today() { return V() && V().today ? V().today() : new Date().toISOString().slice(0, 10); }
    function nowTs() {
        var t = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
        return today() + ' ' + pad(t.getHours()) + ':' + pad(t.getMinutes());
    }
    /* ===== 권한 (CLAUDE.md §12) =====
     * 표는 전 부서를 보여주되(전수 점검이 목적), 각 행의 등록·제출은 그 부서 담당자와 주관부서만 한다.
     * 관리·감독(군수·과장·소장)은 조회만 한다 — 담당자 이름으로 대신 등록하면 문서 위조다. */
    function R() { return global.DYROLE; }
    function me() { return R() && R().current ? R().current() : null; }
    function canAct(deptId) { return !R() || R().canAct(deptId); }
    /* 배포·확인은 주관부서(재난안전과) **담당자**만 한다 */
    function isOwnerStaff() {
        var p = me();
        if (!R() || !p) return true;
        return p.tier === 'staff' && p.deptId === R().OWNER_DEPT;
    }
    /* 재난안전과 팀장 — 담당자와 함께 전 부서 제출을 검토한다(2026-11-12 사용자 지시).
       본인 제출은 본인이 검토하지 않으므로 재난안전과 줄도 팀장이 검토할 수 있다. */
    function isOwnerLead() {
        var p = me();
        return !!(R() && p && p.deptId === R().OWNER_DEPT && p.tier === 'super' && /팀장/.test(p.role || ''));
    }
    /* ===== 이행점검(배포 흐름) 권한 — 이 블록 한 곳에서만 판정한다 (2026-11-12 사용자 지시) =====
     *   결과 제출·고치기·취소·다시 제출 : 그 부서 담당자 — **자기 부서만**(재난안전과도 자기 줄만, 대리 제출 없음)
     *   검토(승인·반려·확인 취소)      : 재난안전과 담당자·팀장 — 전 부서(본인 제출 제외)
     *   독촉                           : DYROLE.canRemind — 주관부서와 그 부서장(담당자는 자기 부서 줄 없음, 군수 없음)
     *   배포·마감 상신·체계 점검표     : 재난안전과 담당자(화면 모듈이 판정)
     *   그 밖                          : 조회 */
    /* 결과 제출 — 그 부서 **실무자 누구나**(담당자 계층 · 과장·소장·팀장·군수 제외, 2026-11-12 개발 회신 B안).
       «부서 안전보건 담당자» 등급으로 좁히지 않는다 — 구성원 명단이 담양군 확정 전이라 좁히면 아무도 내지 못한다
       (온나라 잇기의 «담당자»와 같은 근거, 공통 권한 정의 §7). 그 부서에 실무자가 한 명도 없을 때만 부서장이 낸다. */
    var LEAD_RE = /(과장|소장|실장|국장|읍장|면장|군수|팀장)$/;
    function hasPractitioner(deptId) {
        var n = global.DYV2 && global.DYV2.orgNode ? global.DYV2.orgNode(deptId) : null;
        if (!n) return true;
        return (n.members || []).some(function (m) { return !m.lead && !LEAD_RE.test(m.role || ''); });
    }
    /* ===== 알림 받는 사람 — 받는 사람 = 할 수 있는 사람 (요청서 v2 R-14 · 2026-11-12) =====
     * 지정 담당자 — 운영은 조직 관리 › 부서 상세 한 곳에 저장한다. 프로토타입은 권한 관리의
     *   «부서 안전보건 담당자» 등급 구성원(DYADM.deptContacts)이 그 자리를 대신한다.
     * 배포·기한 변경·내 할일 : 지정 담당자 → 없으면 그 부서 실무자 전원 → 없으면 부서장
     * 반려                    : 제출한 사람 · 고친 사람 + 지정 담당자
     * 독촉                    : 지정 담당자 → 없으면 부서장 → 없으면 실무자 전원(공통 규칙, DYADM.deptContacts)
     * 검토 요청               : 재난안전과 담당자·팀장(과장 제외) */
    function membersDeep(deptId) {
        var n = global.DYV2 && global.DYV2.orgNode ? global.DYV2.orgNode(deptId) : null, out = [];
        (function walk(x) { if (!x) return; (x.members || []).forEach(function (m) { out.push(m); }); (x.children || []).forEach(walk); })(n);
        return out;
    }
    function designatedUids(deptId) {
        var A = global.DYADM, c = A && A.deptContacts ? A.deptContacts(deptId) : null;
        return c && c.kind === 'staff' ? c.people.map(function (x) { return x.uid; }).filter(Boolean) : [];
    }
    function practitionerUids(deptId) {
        return membersDeep(deptId).filter(function (m) { return !m.lead && !LEAD_RE.test(m.role || ''); })
            .map(function (m) { return m.uid; }).filter(Boolean);
    }
    function leadUids(deptId) {
        var l = R() && R().leadOf ? R().leadOf(deptId) : null;
        return l && l.uid ? [l.uid] : [];
    }
    /* 지정 담당자 가운데 «결과를 낼 수 있는 사람»만 — 재난안전과는 전담부서 등급(팀 단위)이 지정 담당자 자리를
       대신해 팀장이 섞인다. 팀장은 제출하지 않으므로(canSubmit) 할 일·배포 알림·반려 알림에서 뺀다(2026-11-12 검수) */
    function designatedSubmitters(deptId) {
        var d = designatedUids(deptId);
        if (!hasPractitioner(deptId)) return d;
        var lead = {};
        membersDeep(deptId).forEach(function (m) { if (m.lead || LEAD_RE.test(m.role || '')) lead[m.uid] = 1; });
        return d.filter(function (u) { return !lead[u]; });
    }
    function workUids(deptId) {
        var d = designatedSubmitters(deptId); if (d.length) return d;
        var pr = practitionerUids(deptId); if (pr.length) return pr;
        return leadUids(deptId);
    }
    /* 독촉 받는 사람 — 공통 규칙 한 곳(DYADM.deptContacts)을 그대로 쓴다. 독촉 확인 창이 보여 주는
       «받는 사람»(contactText)과 실제 알림이 같은 사람이어야 한다. */
    function remindUids(deptId) {
        var A = global.DYADM, c = A && A.deptContacts ? A.deptContacts(deptId) : null;
        if (c) return c.people.map(function (x) { return x.uid; }).filter(Boolean);
        var d = designatedUids(deptId); return d.length ? d : leadUids(deptId);
    }
    /* 배포·할 일을 받는 사람 한 줄 — 시달 공문 별지 «받는 사람»이 실제 할 일·알림 대상(workUids)과 같은 말을 한다.
       지정 담당자 → 실무자 전원 → 부서장(요청서 v2 §1-10) */
    function workText(deptId) {
        var names = function (uids) {
            return uids.map(function (u) { var m = membersDeep(deptId).filter(function (x) { return x.uid === u; })[0]; return m ? m.name : ''; }).filter(Boolean).join('·');
        };
        var d = designatedSubmitters(deptId); if (d.length) return names(d) + '(부서 안전보건 담당자)';
        var pr = practitionerUids(deptId); if (pr.length) return names(pr) + '(실무자 전원 — 담당자 미지정)';
        var l = leadUids(deptId); if (l.length) return '부서장 ' + names(l) + '(실무자 계정 없음)';
        return '받는 사람 없음(조직도 미등록)';
    }
    function reviewerUids() {
        var own = R() ? R().OWNER_DEPT : 'safety';
        return membersDeep(own).filter(function (m) { return !/(과장|소장|실장|국장|읍장|면장|군수)$/.test(m.role || ''); })
            .map(function (m) { return m.uid; }).filter(Boolean);
    }
    function uniq(a) { return a.filter(function (x, i) { return x && a.indexOf(x) === i; }); }
    function canSubmit(deptId) {
        var p = me();
        if (!R() || !p) return true;
        if (p.deptId !== deptId) return false;
        if (p.tier === 'staff') return true;
        return p.tier === 'super' && !hasPractitioner(deptId);
    }
    function canReviewer() { return isOwnerStaff() || isOwnerLead(); }
    function actor() { return R() && R().actorLabel ? R().actorLabel() : '재난안전과'; }
    function denied(deptId) {
        var p = me();
        toast(p && p.tier !== 'staff'
            ? '관리감독자는 조회만 합니다 — 등록·제출은 담당자 본인이 수행합니다.'
            : '해당 부서 담당자와 주관부서(재난안전과)만 등록할 수 있습니다.');
    }

    /* v6 — 2026-11-13 기준 운영 이력 예시(2025 상반기~2026 상반기 마감 · 2026 하반기 배포 전). v5 는 배포 흐름(확인 축·미이행 조치계획) 시드 (2026-11-12).
     * key 에 **회차 축**이 들어간다 — 호출자가 실어 보낸다.
     *   예) 'comply-industrial|2026-H1'(반기) · 'policy-post|v2.0'(방침 버전) */
    var SKEY = 'dy-deptcheck-v7';   /* v7 — 물순환사업소 게시 미등록(실습 자리) · 보건소 해당없음 사유 (2026-11-13) */
    var FKEY = 'dy-comply-flow-v3';   /* v3 — 시달 공문에 생산등록번호·결재일 (2026-11-13) */   /* 배포·마감 기록 — 회차 단위 */

    /* 회의에서 확인된 전체 대상 수(과 + 사업소). 실제 명단은 발주처 제공 대기. */
    var EXPECTED_DEPTS = 39;

    /* 상태는 **코드로 저장**하고 화면 문구는 화면이 정한다(CLAUDE.md §4-2). */
    var ST = { DONE: 'DONE', TODO: 'TODO', NA: 'NA' };
    var DEFAULT_LABELS = { DONE: '이행', TODO: '미이행', NA: '해당없음', NONE: '미등록' };
    /* 배포 흐름의 결과 라벨 — 결과는 «제출한 줄»에만 붙는다 */
    var FLOW_LABELS = { DONE: '전 항목 이행', TODO: '일부 미이행', NA: '해당없음', NONE: '미제출' };
    function labelsOf(opts) {
        return Object.assign({}, (opts && opts.flow) ? FLOW_LABELS : DEFAULT_LABELS, (opts && opts.labels) || {});
    }
    /* 확인 축 — 결과 값(status)을 건드리지 않는다(위험성평가 개선조치 확인과 같은 구조, CLAUDE.md §4-3) */
    var CF = { WAIT: 'WAIT', OK: 'OK', RETURNED: 'RETURNED' };

    /* ================= 예시 자료 ================= */
    var SEED_THUMB = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAwICQsJCAwLCgsODQwOEh4UEhEREiUbHBYeLCcuLisnKyoxN0Y7MTRCNCorPVM+QkhKTk9OLztWXFVMW0ZNTkv/2wBDAQ0ODhIQEiQUFCRLMisyS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0v/wAARCAB4AKADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDmc0ZpuaM1geUOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0ANzRmm5ozTGOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0ANzRmm5ozQUOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0ANzRmkzXVR6RaNdOhssojSC3+dh9rUQyMH6+qoeMD5sU7FKNzls0Zrq4tIsDBbyTWkqzScXMEYJ+zDsSS425HOWyKz4baze1s4jbDzZ7Gedpt7bgyGUrgZx/yzAPFOw+RmJmjNb1zDaW1tcXElqLh1FkFEkj4G+As3Qg8kfh+lWpdGtYZrqKO0M8MaXZacu2Ynj8zYvBx0VTyOd3pRYORnL5ozSZozSJFzRmkzRmgBc0ZpM0ZoAXNGaTNGaAFzRmkzRmgBc0ZpM0ZoAXNGaTNGaAG5qSC4kt3LxNtYoyE4zwylSPyJqHNGaCh2aM03NGaBDs1Zj1C5jtzAjqI9pXOxdwB6gNjIB9Ae59aqZozQMdmjNNzRmgQ7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA3NGabmjNModmjNNzRmgB2aM03NGaAHZozTc0ZoAdmjNNzRmgB2aM03NGaAHZozTc0ZoAdmjNNzRmgB2aM03NGaAHZozTc0ZoAbmjNJmjNAxc0ZpM0ZoAXNGaTNGaAFzRmkzRmgBc0ZpM0ZoAXNGaTNGaAFzRmkzRmgBc0ZpM0ZoAXNGaTNGaAFzRmkzRmgBuaM0UUxhmjNFFABmjNFFABmjNFFABmjNFFABmjNFFABmjNFFABmjNFFABmjNFFABmjNFFAH/9k=';
    function ph(n) { return { name: n, size: 164000, type: 'image/jpeg', w: 1600, h: 1200, thumb: SEED_THUMB }; }
    function doc(n) { return { name: n, size: 412000, type: 'application/pdf' }; }
    /* 예시 자료 — 2026-11-13 기준으로 «운영해 온 시스템»처럼 보이게 짠다(2026-11-13 개정).
     *   2025 상반기 · 2025 하반기 · 2026 상반기 — 배포(시달 공문) → 부서 제출 → 검토(승인·반려→재제출) → 독촉 → 마감 보고까지 끝나 잠긴 회차
     *   2026 하반기 — **배포 전**(하반기 점검은 11~12월에 한다). [점검 배포]부터 실습한다.
     *   지난 반기 «일부 미이행» 부서는 다음 회차에서 조치 결과를 함께 냈다(prevAction) — 2026 상반기 미이행
     *   (문화체육과·건설과 / 시민 축 환경과)은 하반기를 배포하면 «지난 반기 미이행 조치 결과»로 이어진다.
     *   사람은 조직도(DYV2.ORG) 실인물, 검토자는 재난안전과 박안전(자기 부서 줄은 김중대 팀장). */
    function ok(by, at, round) { return { state: 'OK', round: round || 1, by: by, at: at }; }
    /* 제출 한 줄 — status · 제출일 · 제출자 · uid · 점검표 파일명 · 확인 · 그 밖 */
    function sub(status, at, who, uid, file, confirm, extra) {
        return Object.assign({ status: status, date: at, submittedAt: at, submittedBy: who, submittedByUid: uid,
            photos: [doc(file)], confirm: confirm }, extra || {});
    }
    function fn(dept, per, ax) { return dept + '_' + per + '_' + ax + '_자체점검표(부서장 서명).pdf'; }
    var SEED = {
        /* 경영방침 게시 — 현행 v2.0(2026-01-29 결재, 02-02 시행). 대부분 2월 초 게시 ·
           재무과는 11월 사무실 이전으로 게시물을 떼어 «미게시» · 보건소는 «해당없음»(사유) ·
           담양읍·물순환사업소는 미등록 — 물순환사업소는 부서 담당자(하정수) 실습 자리로 비워 둔다(2026-11-13 실습 데이터 점검) */
        'policy-post|v2.0': {
            safety:    { status: 'DONE', place: '군청 본관 1층 게시판 · 내부망(새올) 전자게시', date: '2026-02-03', photos: [ph('재난안전과_게시_1.jpg'), ph('재난안전과_전자게시.jpg')] },
            plan:      { status: 'DONE', place: '기획예산실 사무실 출입문 게시판', date: '2026-02-04', photos: [ph('기획예산실_게시_1.jpg')] },
            acct:      { status: 'DONE', place: '회계과 계약 민원창구 옆 게시판', date: '2026-02-04', photos: [ph('회계과_게시_1.jpg')] },
            env:       { status: 'DONE', place: '환경과 사무실 입구 · 담양군 자원순환센터 관리동', date: '2026-02-05', photos: [ph('환경과_게시_1.jpg'), ph('자원순환센터_게시.jpg')] },
            culture:   { status: 'DONE', place: '담양종합체육관 1층 로비 게시판', date: '2026-02-10', photos: [ph('문화체육과_체육관_게시.jpg')] },
            finance:   { status: 'TODO', place: '사무실 이전(11-03)으로 기존 게시물 철거 — 11월 중 새 사무실 게시판에 다시 게시 예정', date: '2026-11-04', photos: [] },
            health:    { status: 'NA', naReason: '보건소 사무실은 군청 본관 2층에 있고 따로 관리하는 사업장이 없음 — 재난안전과가 본관 1층 게시판·새올 전자게시에 붙인 방침으로 갈음(재난안전과 협의 2026-02-09)', date: '2026-02-09' },
            construct: { status: 'DONE', place: '건설과 사무실 입구 · 도로보수 현장사무소', date: '2026-02-06', photos: [ph('건설과_게시_1.jpg'), ph('현장사무소_게시.jpg')] },
            facility:  { status: 'DONE', place: '공공시설사업소 현관 게시판', date: '2026-02-05', photos: [ph('공공시설_게시_1.jpg')] }
            /* water — 미등록(실습 자리) · town_damyang — 미등록 */
        },

        /* ── 2025 상반기 (배포 05-12 · 기한 06-30 · 마감 보고 07-11) ── */
        'comply-industrial|2025-H1': {
            safety:    sub('DONE', '2025-06-20', '박안전', 'u_jjt2', fn('재난안전과', '2025상반기', '중대산업재해'), ok('김중대', '2025-06-23')),
            plan:      sub('NA', '2025-06-18', '한열람', 'u_plan2', fn('기획예산실', '2025상반기', '중대산업재해'), ok('박안전', '2025-06-23'),
                           { naReason: '기획예산실은 현장 작업·관리 시설이 없어 안전조치 항목 대상이 아님 — 예산 편성 항목(점검표 10번)만 작성해 붙임' }),
            acct:      sub('DONE', '2025-06-25', '최회계', 'u_acct2', fn('회계과', '2025상반기', '중대산업재해'), ok('박안전', '2025-06-27')),
            env:       sub('TODO', '2025-06-27', '정수빈', 'u_env5', fn('환경과', '2025상반기', '중대산업재해'), ok('박안전', '2025-07-01'),
                           { missText: '점검표 7번(유해·위험요인 개선조치 이행) — 자원순환센터 슬러지 반출장 안전난간 보수 미완료',
                             plan: '7월 중 안전난간 보수 공사 발주, 8월 말까지 준공', planDue: '2025-08-29' }),
            culture:   sub('DONE', '2025-06-26', '한지훈', 'u_cul1', fn('문화체육과', '2025상반기', '중대산업재해'), ok('박안전', '2025-06-27')),
            finance:   sub('DONE', '2025-06-30', '최재무', 'u_fin1', fn('재무과', '2025상반기', '중대산업재해'), ok('박안전', '2025-07-01')),
            health:    sub('DONE', '2025-06-24', '이보건', 'u_hlth2', fn('보건소', '2025상반기', '중대산업재해'), ok('박안전', '2025-06-25')),
            construct: sub('TODO', '2025-06-30', '박현장', 'u_con2', fn('건설과', '2025상반기', '중대산업재해'), ok('박안전', '2025-07-02'),
                           { missText: '점검표 9번(수급인 안전보건 수준 평가) — 상반기 착공 공사 2건(군도 정비·배수로 정비) 평가 미실시',
                             plan: '8월까지 두 공사 수급인 평가표 작성·제출', planDue: '2025-08-31' }),
            /* 반려 → 재제출(2차) 사례 — 06-27 첫 제출은 부서장 서명이 빠져 07-01 반려, 07-03 다시 제출 */
            facility:  sub('DONE', '2025-07-03', '한담당', 'u_fac2', fn('공공시설사업소', '2025상반기', '중대산업재해'), ok('박안전', '2025-07-04', 2)),
            water:     sub('DONE', '2025-06-23', '하정수', 'u_wat3', fn('물순환사업소', '2025상반기', '중대산업재해'), ok('박안전', '2025-06-25')),
            /* 기한을 넘겨 독촉 2회 뒤 제출 */
            town_damyang: sub('DONE', '2025-07-02', '배주민', 'u_twn2', fn('담양읍', '2025상반기', '중대산업재해'), ok('박안전', '2025-07-03'))
        },
        'comply-citizen|2025-H1': {
            env:       sub('DONE', '2025-06-27', '정수빈', 'u_env5', fn('환경과', '2025상반기', '중대시민재해'), ok('박안전', '2025-07-01')),
            culture:   sub('DONE', '2025-06-26', '한지훈', 'u_cul1', fn('문화체육과', '2025상반기', '중대시민재해'), ok('박안전', '2025-06-27')),
            finance:   sub('DONE', '2025-06-30', '최재무', 'u_fin1', fn('재무과', '2025상반기', '중대시민재해'), ok('박안전', '2025-07-01')),
            construct: sub('DONE', '2025-06-30', '박현장', 'u_con2', fn('건설과', '2025상반기', '중대시민재해'), ok('박안전', '2025-07-02')),
            facility:  sub('TODO', '2025-06-27', '한담당', 'u_fac2', fn('공공시설사업소', '2025상반기', '중대시민재해'), ok('박안전', '2025-07-01'),
                           { missText: '점검표 3번(공중이용시설 정기점검 결과 보고) — 담양종합체육관 정밀안전점검 결과를 기한 내 보고하지 않음',
                             plan: '9월까지 정밀안전점검 결과 보고, 지적사항 보수계획 수립', planDue: '2025-09-30' }),
            water:     sub('DONE', '2025-06-23', '하정수', 'u_wat3', fn('물순환사업소', '2025상반기', '중대시민재해'), ok('박안전', '2025-06-25'))
        },

        /* ── 2025 하반기 (배포 11-10 · 기한 12-19 · 마감 보고 12-29) ── */
        'comply-industrial|2025-H2': {
            safety:    sub('DONE', '2025-12-05', '박안전', 'u_jjt2', fn('재난안전과', '2025하반기', '중대산업재해'), ok('김중대', '2025-12-08')),
            plan:      sub('NA', '2025-12-03', '한열람', 'u_plan2', fn('기획예산실', '2025하반기', '중대산업재해'), ok('박안전', '2025-12-04'),
                           { naReason: '기획예산실은 현장 작업·관리 시설이 없어 안전조치 항목 대상이 아님 — 2026 안전보건 예산 편성 내역(점검표 10번)만 작성해 붙임' }),
            acct:      sub('DONE', '2025-12-10', '최회계', 'u_acct2', fn('회계과', '2025하반기', '중대산업재해'), ok('박안전', '2025-12-11')),
            env:       sub('DONE', '2025-12-12', '정환경', 'u_env2', fn('환경과', '2025하반기', '중대산업재해'), ok('박안전', '2025-12-15'),
                           { prevAction: { state: 'DONE', text: '안전난간 보수 08-22 준공(08-25 준공검사) — 사진대장 붙임', period: '2025 상반기' } }),
            culture:   sub('TODO', '2025-12-15', '한지훈', 'u_cul1', fn('문화체육과', '2025하반기', '중대산업재해'), ok('박안전', '2025-12-16'),
                           { missText: '점검표 4번(체육시설 안전점검 결과 기록) — 하반기 정기점검 결과를 시설 대장에 기록하지 않음',
                             plan: '1월 중 체육시설 3개소 점검 결과를 대장에 기록하고 기록 담당자 지정', planDue: '2026-01-30' }),
            finance:   sub('DONE', '2025-12-11', '최재무', 'u_fin1', fn('재무과', '2025하반기', '중대산업재해'), ok('박안전', '2025-12-12')),
            health:    sub('DONE', '2025-12-09', '백지영', 'u_hlth4', fn('보건소', '2025하반기', '중대산업재해'), ok('김중대', '2025-12-10')),
            construct: sub('DONE', '2025-12-17', '김도현', 'u_con3', fn('건설과', '2025하반기', '중대산업재해'), ok('박안전', '2025-12-18'),
                           { prevAction: { state: 'DONE', text: '8월 두 공사 수급인 평가 완료(평가표 2부 제출)', period: '2025 상반기' } }),
            facility:  sub('DONE', '2025-12-16', '한운영', 'u_fac3', fn('공공시설사업소', '2025하반기', '중대산업재해'), ok('박안전', '2025-12-17')),
            water:     sub('DONE', '2025-12-04', '하정수', 'u_wat3', fn('물순환사업소', '2025하반기', '중대산업재해'), ok('박안전', '2025-12-05')),
            town_damyang: sub('DONE', '2025-12-23', '배주민', 'u_twn2', fn('담양읍', '2025하반기', '중대산업재해'), ok('박안전', '2025-12-24'))
        },
        'comply-citizen|2025-H2': {
            env:       sub('DONE', '2025-12-12', '정수빈', 'u_env5', fn('환경과', '2025하반기', '중대시민재해'), ok('박안전', '2025-12-15')),
            culture:   sub('DONE', '2025-12-15', '한지훈', 'u_cul1', fn('문화체육과', '2025하반기', '중대시민재해'), ok('박안전', '2025-12-16')),
            finance:   sub('DONE', '2025-12-11', '강세무', 'u_fin2', fn('재무과', '2025하반기', '중대시민재해'), ok('박안전', '2025-12-12')),
            construct: sub('DONE', '2025-12-17', '김도현', 'u_con3', fn('건설과', '2025하반기', '중대시민재해'), ok('박안전', '2025-12-18')),
            facility:  sub('DONE', '2025-12-16', '한운영', 'u_fac3', fn('공공시설사업소', '2025하반기', '중대시민재해'), ok('박안전', '2025-12-17'),
                           { prevAction: { state: 'DOING', text: '정밀안전점검 결과 09-26 보고 · 지적 보수공사는 2026년 예산에 반영(3월 착공 예정)', period: '2025 상반기' } }),
            water:     sub('DONE', '2025-12-04', '하정수', 'u_wat3', fn('물순환사업소', '2025하반기', '중대시민재해'), ok('박안전', '2025-12-05'))
        },

        /* ── 2026 상반기 (배포 05-14 · 기한 06-30 · 마감 보고 07-10) ── */
        'comply-industrial|2026-H1': {
            safety:    sub('DONE', '2026-06-24', '박안전', 'u_jjt2', fn('재난안전과', '2026상반기', '중대산업재해'), ok('김중대', '2026-06-26')),
            plan:      sub('NA', '2026-06-25', '한열람', 'u_plan2', fn('기획예산실', '2026상반기', '중대산업재해'), ok('박안전', '2026-06-29'),
                           { naReason: '기획예산실은 현장 작업이 없어 안전조치 점검 대상에서 제외 — 예산 편성 항목만 해당' }),
            acct:      sub('DONE', '2026-06-29', '최회계', 'u_acct2', fn('회계과', '2026상반기', '중대산업재해'), ok('박안전', '2026-06-30')),
            env:       sub('DONE', '2026-06-30', '정환경', 'u_env2', fn('환경과', '2026상반기', '중대산업재해'), ok('박안전', '2026-07-01')),
            culture:   sub('TODO', '2026-06-29', '오세영', 'u_cul2', fn('문화체육과', '2026상반기', '중대산업재해'), ok('박안전', '2026-07-01'),
                           { missText: '점검표 6번(종사자 의견청취 결과 반영) — 체육시설 위탁 운영 종사자 의견청취를 상반기에 실시하지 않음',
                             plan: '하반기 중 위탁 운영 종사자 간담회 1회 개최, 결과를 의견청취·건의함에 등록', planDue: '2026-09-30',
                             prevAction: { state: 'DONE', text: '01-28 체육시설 3개소 점검 결과 대장 기록, 기록 담당 한지훈 주무관 지정', period: '2025 하반기' } }),
            finance:   sub('DONE', '2026-06-26', '강세무', 'u_fin2', fn('재무과', '2026상반기', '중대산업재해'), ok('박안전', '2026-06-29')),
            health:    sub('DONE', '2026-06-23', '이보건', 'u_hlth2', fn('보건소', '2026상반기', '중대산업재해'), ok('김중대', '2026-06-24')),
            construct: sub('TODO', '2026-06-30', '김도현', 'u_con3', fn('건설과', '2026상반기', '중대산업재해'), ok('박안전', '2026-07-02'),
                           { missText: '점검표 8번(위험성평가 개선조치 기한 내 완료) — 도로 보수 현장 개선조치 2건이 기한을 넘김',
                             plan: '7월 중 2건 조치 완료 후 위험성평가 화면에 완료 등록', planDue: '2026-07-31' }),
            /* 반려 → 재제출(2차) — 07-01 첫 제출은 점검표 2쪽 부서장 서명 누락으로 07-02 반려, 07-03 서명본으로 다시 제출 */
            facility:  sub('DONE', '2026-07-03', '한운영', 'u_fac3', fn('공공시설사업소', '2026상반기', '중대산업재해'), ok('박안전', '2026-07-06', 2)),
            water:     sub('DONE', '2026-06-29', '하정수', 'u_wat3', fn('물순환사업소', '2026상반기', '중대산업재해'), ok('박안전', '2026-07-01'),
                           { editedAt: '2026-06-30 10:12', editedBy: '서한별', editedByUid: 'u_wat6' })
            /* town_damyang — 독촉 3회에도 미제출로 마감 보고에 올라갔다 */
        },
        'comply-citizen|2026-H1': {
            env:       sub('TODO', '2026-06-30', '정수빈', 'u_env5', fn('환경과', '2026상반기', '중대시민재해'), ok('박안전', '2026-07-02'),
                           { missText: '점검표 2번(공중화장실 안전점검 계획) — 하반기 공중화장실 안전점검 계획 미수립',
                             plan: '8월까지 공중화장실 12개소 안전점검 계획 수립·시행', planDue: '2026-08-31' }),
            culture:   sub('DONE', '2026-06-29', '한지훈', 'u_cul1', fn('문화체육과', '2026상반기', '중대시민재해'), ok('박안전', '2026-07-01')),
            finance:   sub('DONE', '2026-06-26', '강세무', 'u_fin2', fn('재무과', '2026상반기', '중대시민재해'), ok('박안전', '2026-06-29')),
            construct: sub('DONE', '2026-06-30', '김도현', 'u_con3', fn('건설과', '2026상반기', '중대시민재해'), ok('박안전', '2026-07-02')),
            facility:  sub('DONE', '2026-06-27', '한운영', 'u_fac3', fn('공공시설사업소', '2026상반기', '중대시민재해'), ok('박안전', '2026-06-30')),
            water:     sub('DONE', '2026-06-30', '하정수', 'u_wat3', fn('물순환사업소', '2026상반기', '중대시민재해'), ok('박안전', '2026-07-01'))
        }
        /* 2026 하반기 — 배포 전이라 제출 기록이 없다 */
    };
    function applySeed(d) {
        Object.keys(SEED).forEach(function (key) {
            var m = SEED[key];
            Object.keys(m).forEach(function (deptId) {
                var base = { status: ST.TODO, place: '', date: '', naReason: '', photos: [], note: '' };
                d[key + '|' + deptId] = Object.assign(base, JSON.parse(JSON.stringify(m[deptId])));
            });
        });
        return d;
    }

    /* ================= 스토어 ================= */
    var db = null;
    function load() {
        if (db) return db;
        try { db = JSON.parse(global.sessionStorage.getItem(SKEY) || 'null'); } catch (e) { db = null; }
        if (!db) { db = applySeed({}); save(); }
        return db;
    }
    function save() { try { global.sessionStorage.setItem(SKEY, JSON.stringify(db)); } catch (e) {} }
    function reset() { db = applySeed({}); save(); fdb = flowSeed(); fsave(); }
    /* 예시 데이터 되돌리기 — 도움말 시트(DYHELP «예시 데이터 되돌리기»)가 부른다(sbm-comply · sbm-policy).
     * 이행점검과 경영방침 게시 현황은 같은 스토어(DEPTCHK)라 함께 되돌아간다 — 확인 창이 그 사실을 밝힌다.
     * 이 화면에서 만든 이행점검 알림(배포·검토 요청·반려·독촉)과 올린 파일·연계 번호 일련도 함께 지운다 —
     * 남겨 두면 되돌린 뒤에도 «배포되었습니다» 알림이 남아 없는 배포를 가리킨다. */
    function resetDemo() {
        V().openModal('예시 데이터 되돌리기',
            '<p style="font-size:var(--fs-13); margin:0 0 8px;">아래를 처음 예시 상태로 되돌립니다. 되돌린 뒤에는 이 화면에서 한 일이 남지 않습니다.</p>' +
            '<ul style="font-size:var(--fs-13); margin:0 0 8px; padding-left:18px; line-height:1.7;">' +
                '<li><b>이행점검</b> — 2025 상·하반기 · 2026 상반기는 마감된 이력 그대로, <b>2026 하반기는 배포 전</b>으로</li>' +
                '<li>이 화면에서 한 <b>배포(시달 공문)·결과 제출·검토·독촉·마감 보고</b>와 그 알림, 올린 점검표 파일</li>' +
                '<li><b>경영방침 게시 현황</b> — 부서별 게시·미게시·해당없음 등록(물순환사업소·담양읍은 미등록으로)</li>' +
            '</ul>' +
            '<p class="file-hint">다른 메뉴(위험성평가·교육 등)의 예시 데이터는 그대로입니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="DEPTCHK.doResetDemo()">되돌리기</button>');
    }
    function doResetDemo() {
        reset();
        MEM = {};
        try {
            global.sessionStorage.removeItem(FILEKEY);
            ['dy-cmpdoc-seq', 'dy-cmpclose-seq'].forEach(function (k) { global.sessionStorage.removeItem(k); });
            /* 업무가 만든 헤더 알림(DYLayout.ntfPush) 가운데 이행점검 것만 걷는다 */
            var NK = 'dy-ntf-dyn-v1', dyn = JSON.parse(global.sessionStorage.getItem(NK) || '[]');
            global.sessionStorage.setItem(NK, JSON.stringify(dyn.filter(function (n) { return !/m=comply/.test(n.href || ''); })));
        } catch (e) {}
        V().closeModal();
        toast('이행점검·경영방침 게시 현황을 처음 예시로 되돌렸습니다');
        setTimeout(function () { global.location.reload(); }, 400);
    }

    function rowKey(key, deptId) { return key + '|' + deptId; }
    /* 부서 1건의 상태. 기록이 없으면 exists:false — «미등록/미제출»이다(미이행과 다르다). */
    function stateOf(key, deptId) {
        var d = load()[rowKey(key, deptId)];
        if (d) return Object.assign({ exists: true }, d);
        return { exists: false, status: ST.TODO, place: '', date: '', naReason: '', photos: [], note: '' };
    }
    function setState(key, deptId, patch) {
        var d = load(), k = rowKey(key, deptId);
        var cur = d[k] || { status: ST.TODO, place: '', date: '', naReason: '', photos: [], note: '' };
        d[k] = Object.assign({}, cur, patch || {});
        delete d[k].exists;
        save();
        return d[k];
    }
    function removeState(key, deptId) { var d = load(); delete d[rowKey(key, deptId)]; save(); }

    /* ================= 배포·마감 기록 (이행점검) =================
     * 회차마다 «무엇을(양식) · 누구에게(대상 부서) · 언제까지(기한)» 내려보냈는지가 남아야
     * «그 반기에 무엇을 점검했나»를 증명할 수 있다. */
    var fdb = null;
    function flowSeed() {
        var all = depts().map(function (d) { return d.id; });
        /* 시민 축 대상 — 공중이용시설을 관리하는 부서(조직도 속성 · 시설물 대장 관리부서). 회차마다 저장해 둔 값이라
           화면에 시설물 대장이 실려 있든 없든 같은 대상이 보인다. */
        var civ = ['env', 'culture', 'finance', 'construct', 'facility', 'water'].filter(function (id) { return all.indexOf(id) !== -1; });
        var BY = '박안전', BYU = 'u_jjt2';
        /* 시달 공문 — 온나라로 보낸 뒤 결재를 마치고 각 부서로 시행된 문서(연계 회신 반영) */
        /* 결재완료 공문은 생산등록번호·결재일을 갖는다 — «연계 번호»(no)는 상신 때 받은 값이고
           문서번호는 결재가 끝나야 생긴다(CLAUDE.md §7-1 «문서번호는 생산등록번호에만»). */
        function notice(key, no, at, due, targets, form, note, prodNo, apprDate) {
            var civil = /citizen/.test(key), per = key.split('|')[1];
            var perLbl = per.replace(/^(\d{4})-H([12])$/, function (m, y, h) { return y + '년 ' + (h === '1' ? '상반기' : '하반기'); });
            var ax = civil ? '중대시민재해' : '중대산업재해';
            return {
                sid: no + '-0', no: no, at: at, status: '결재완료', prodNo: prodNo || '', apprDate: apprDate || '', docType: '외부발송', to: '수신자 참조',
                title: perLbl + ' 중대(' + (civil ? '시민' : '산업') + ')재해 이행사항 자체점검 실시 통보',
                body: '1. ' + perLbl + ' ' + ax + ' 예방을 위한 안전·보건 확보의무 이행사항 자체점검을 아래와 같이 실시하오니, 부서별로 점검표를 작성하여 기한 내 제출하여 주시기 바랍니다.\n' +
                      '  가. 점검 대상: 붙임 별지의 ' + targets.length + '개 부서\n  나. 제출 기한: ' + due + '\n' +
                      '  다. 제출 방법: 중대재해 통합관리시스템 › 안전보건관리체계 › 이행점검에서 점검표를 내려받아 작성(부서장 확인)한 뒤 [결과 제출]\n' +
                      '  라. 일부 항목이 이행되지 않은 경우 미이행 내용과 조치계획·조치 예정일을 함께 적어 제출' +
                      (note ? '\n  마. ' + note : ''),
                attach: [{ label: form.name, meta: '점검표 양식', size: form.size, on: true }],
                annex: true, basis: [], recipients: targets.slice(), line: [], lineText: '',
                by: BY, byUid: BYU, dept: '재난안전과'
            };
        }
        function dist(key, o) {
            return Object.assign({ by: BY, ver: 1, changedAt: '' }, o, { docs: [notice(key, o.no, o.at, o.due, o.targets, o.forms[0], o.note, o.prodNo, o.apprDate)] });
        }
        var NOTE = '부서장 서명 후 스캔본(PDF)을 올려 주세요. 미이행 항목은 조치계획·예정일을 함께 적어 주세요.';
        var NOTE_C = '공중이용시설을 관리하는 부서만 작성합니다. 부서장 서명 후 스캔본(PDF)을 올려 주세요.';
        var NOTE_CARRY = ' 지난 반기 미이행 부서는 조치 결과도 함께 적어 주세요.';
        var D = {};
        D['comply-industrial|2025-H1'] = dist('comply-industrial|2025-H1', { at: '2025-05-12', due: '2025-06-30', no: '재난안전과-1712', prodNo: '재난안전과-1716', apprDate: '2025-05-13', note: NOTE,
            forms: [{ name: '2025년_상반기_중대산업재해_이행사항_자체점검표.hwpx', size: 86000 }], targets: all });
        D['comply-citizen|2025-H1'] = dist('comply-citizen|2025-H1', { at: '2025-05-13', due: '2025-06-30', no: '재난안전과-1720', prodNo: '재난안전과-1724', apprDate: '2025-05-14', note: NOTE_C,
            forms: [{ name: '2025년_상반기_중대시민재해_이행사항_자체점검표.hwpx', size: 74000 }], targets: civ });
        /* 하반기 점검은 11~12월에 한다 — 연말 마감 전에 받으려고 기한을 12월 셋째 주로 둔다.
           산업 축은 11-18 에 양식을 고쳐(제2판 — 도급 항목 문구 보완) 다시 내려보냈다 */
        D['comply-industrial|2025-H2'] = dist('comply-industrial|2025-H2', { at: '2025-11-10', due: '2025-12-19', no: '재난안전과-4206', prodNo: '재난안전과-4211', apprDate: '2025-11-11', note: NOTE + NOTE_CARRY,
            ver: 2, changedAt: '2025-11-18',
            forms: [{ name: '2025년_하반기_중대산업재해_이행사항_자체점검표(제2판).hwpx', size: 88000 }], targets: all });
        D['comply-citizen|2025-H2'] = dist('comply-citizen|2025-H2', { at: '2025-11-11', due: '2025-12-19', no: '재난안전과-4215', prodNo: '재난안전과-4219', apprDate: '2025-11-12', note: NOTE_C + NOTE_CARRY,
            forms: [{ name: '2025년_하반기_중대시민재해_이행사항_자체점검표.hwpx', size: 75000 }], targets: civ });
        D['comply-industrial|2026-H1'] = dist('comply-industrial|2026-H1', { at: '2026-05-14', due: '2026-06-30', no: '재난안전과-1873', prodNo: '재난안전과-1879', apprDate: '2026-05-15', note: NOTE + NOTE_CARRY,
            forms: [{ name: '2026년_상반기_중대산업재해_이행사항_자체점검표.hwpx', size: 88000 }], targets: all });
        D['comply-citizen|2026-H1'] = dist('comply-citizen|2026-H1', { at: '2026-05-15', due: '2026-06-30', no: '재난안전과-1881', prodNo: '재난안전과-1886', apprDate: '2026-05-18', note: NOTE_C,
            forms: [{ name: '2026년_상반기_중대시민재해_이행사항_자체점검표.hwpx', size: 76000 }], targets: civ });
        /* 마감 보고 — 온나라 기안함으로 보낸 뒤 결재를 마쳐(연계 회신) 회차가 잠긴 상태 */
        function closed(per, at, no, apprDate) {
            var lb = per.replace(/^(\d{4})-H([12])$/, function (m, y, h) { return y + ' ' + (h === '1' ? '상반기' : '하반기'); });
            return { at: at, status: '결재완료', by: BY, byUid: BYU, docNo: no, title: lb + ' 의무이행 점검 결과 보고', apprDate: apprDate };
        }
        /* 독촉 기록 — 회차·부서별. 발신자는 보낸 사람(재난안전과 박안전) */
        var TOWN = '부서장 노읍장(담당자 미지정 — 대신 받음)';
        function rm(at, what, to) { return { at: at, by: '재난안전과 ' + BY, what: what || '결과 제출 독촉', to: to || TOWN }; }
        return {
            dist: D,
            closed: {
                '2025-H1': closed('2025-H1', '2025-07-11', '재난안전과-2398', '2025-07-15'),
                '2025-H2': closed('2025-H2', '2025-12-29', '재난안전과-4871', '2025-12-31'),
                '2026-H1': closed('2026-H1', '2026-07-10', '재난안전과-2694', '2026-07-14')
            },
            reminds: {
                'comply-industrial|2025-H1|town_damyang': [rm('2025-06-24 10:05'), rm('2025-06-30 16:40')],
                'comply-industrial|2025-H1|facility': [rm('2025-07-01 14:20', '반려 재제출 독촉', '부서장 임시설(담당자 미지정 — 대신 받음)')],
                'comply-industrial|2025-H2|town_damyang': [rm('2025-12-15 09:30'), rm('2025-12-22 11:10')],
                'comply-industrial|2026-H1|town_damyang': [rm('2026-06-24 09:40'), rm('2026-07-01 10:15'), rm('2026-07-07 15:30')],
                'comply-industrial|2026-H1|facility': [rm('2026-07-02 16:05', '반려 재제출 독촉', '부서장 임시설(담당자 미지정 — 대신 받음)')]
            }
        };
    }
    function fload() {
        if (fdb) return fdb;
        try { fdb = JSON.parse(global.sessionStorage.getItem(FKEY) || 'null'); } catch (e) { fdb = null; }
        if (!fdb) { fdb = flowSeed(); fsave(); }
        return fdb;
    }
    function fsave() { try { global.sessionStorage.setItem(FKEY, JSON.stringify(fdb)); } catch (e) {} }
    /* 시민 축 기본 대상 — 공중이용시설 보유 부서(조직도 속성). 확정 명단은 담양군 확인(실측 11곳) */
    function civilDefaultTargets() {
        var out = [];
        try {
            V().orgWalk(function (n) { if (n && n.attrs && n.attrs.publicFacility) out.push(n.id); });
        } catch (e) {}
        /* 시설물 대장 관리부서도 기본값에 넣는다(조직도 속성은 예시 보강) */
        civilFacilityNames().ids.forEach(function (id) { if (out.indexOf(id) === -1) out.push(id); });
        return out;
    }
    /* 시민 축 — 시설물 대장의 관리부서 이름(요청서 v2 R-07 · A-42). 조직도에서 못 찾은 이름은 따로 돌려준다.
       시설물 대장 데이터(DY_FACIL_SEED)가 실린 화면에서만 값이 있다. */
    function civilFacilityNames() {
        var seed = global.DY_FACIL_SEED, names = [];
        if (seed && seed.ext) Object.keys(seed.ext).forEach(function (k) { var n = (seed.ext[k] || {}).deptNm; if (n && names.indexOf(n) === -1) names.push(n); });
        var ids = [], miss = [];
        names.forEach(function (n) { var id = V().deptIdOf ? V().deptIdOf(n) : null; if (id) ids.push(id); else miss.push(n); });
        return { ids: ids, missing: miss, loaded: !!seed };
    }
    var FLOW = {
        dist: function (key) { return fload().dist[key] || null; },
        setDist: function (key, o) { fload().dist[key] = o; fsave(); return o; },
        removeDist: function (key) { delete fload().dist[key]; fsave(); },
        /* 기안 중인 배포 — [공문 기안 →]을 누른 뒤 상신하기 전까지의 배포 내용. 상신하면 배포가 된다 */
        pending: function (key) { return (fload().pending || {})[key] || null; },
        setPending: function (key, o) { var f = fload(); f.pending = f.pending || {}; if (o) f.pending[key] = o; else delete f.pending[key]; fsave(); return o; },
        closed: function (period) { return fload().closed[period] || null; },
        setClosed: function (period, o) { if (o) fload().closed[period] = o; else delete fload().closed[period]; fsave(); },
        civilDefaultTargets: civilDefaultTargets
    };

    /* ================= 부서 목록 ================= */
    function depts() { return V().orgDepts(); }
    function gap() {
        var n = depts().length;
        return { registered: n, expected: EXPECTED_DEPTS, missing: Math.max(0, EXPECTED_DEPTS - n) };
    }

    /* ===== 배포 흐름 — 줄의 진행 상태 =====
     * 'OFF'(대상 아님) · 'NONE'(미제출) · 'WAIT'(확인 대기) · 'RETURNED'(보완 요청) · 'OK'(확인 완료) */
    function isTarget(flow, deptId) {
        return !!(flow && flow.dist && (flow.dist.targets || []).indexOf(deptId) !== -1);
    }
    function progressOf(key, deptId, flow) {
        if (!isTarget(flow, deptId)) return 'OFF';
        var st = stateOf(key, deptId);
        if (!st.exists) return 'NONE';
        var c = (st.confirm && st.confirm.state) || CF.WAIT;
        return c === CF.OK ? 'OK' : c === CF.RETURNED ? 'RETURNED' : 'WAIT';
    }
    var PROG_LABEL = { OFF: '대상 아님', NONE: '미제출', WAIT: '확인 대기', RETURNED: '반려', OK: '확인 완료' };
    /* 제출로 끝나는가 — 결과가 무엇이든 제출했으면 부서 할 일은 끝난다(보완 요청이면 다시 할 일) */
    function submitted(key, deptId) {
        var st = stateOf(key, deptId);
        return !!st.exists && !(st.confirm && st.confirm.state === CF.RETURNED);
    }
    /* ===== 지난 반기 미이행 이어 보기 (2026-11-12 — 시행령 §5②2 «미이행이면 필요한 조치») =====
     * 같은 축의 바로 앞 회차에 «일부 미이행»으로 낸 부서는, 이번 회차에서 **지난 조치계획의 결과**를 함께 낸다.
     * 조치 결과를 따로 올리는 단계를 두지 않는 대신 다음 반기 점검이 그 확인 자리다. */
    function prevKeyOf(key) {
        var i = key.lastIndexOf('|'), base = key.slice(0, i), per = key.slice(i + 1);
        var m = /^(\d{4})-H([12])$/.exec(per); if (!m) return '';
        return base + '|' + (m[2] === '2' ? m[1] + '-H1' : (+m[1] - 1) + '-H2');
    }
    function perLabelOf(key) {
        var per = key.slice(key.lastIndexOf('|') + 1);
        return per.replace(/^(\d{4})-H([12])$/, function (x, y, h) { return y + ' ' + (h === '1' ? '상반기' : '하반기'); });
    }
    function carryOf(key, deptId) {
        var pk = prevKeyOf(key); if (!pk) return null;
        var st = stateOf(pk, deptId);
        if (!st.exists || st.status !== ST.TODO) return null;
        return { key: pk, perLabel: perLabelOf(pk), missText: st.missText || '', plan: st.plan || '', planDue: st.planDue || '' };
    }
    var CARRY_LABEL = { DONE: '조치 완료', DOING: '조치 중', NONE: '미조치' };
    /* 마감 보고 차례인가 — 그 회차에 배포한 축이 있고, 배포한 축 전부가 «대상 전부 확인 완료» 또는 «기한 경과»면
       사유 문구를, 아니면 ''. 이미 보낸 회차는 ''. 이행점검 화면과 내 할일이 같은 판정을 쓴다. */
    function closeReady(per) {
        var c = FLOW.closed(per);
        if (c && (c.status === '기안함 전송' || c.status === '결재중' || c.status === '결재완료')) return '';
        var axes = ['comply-industrial', 'comply-citizen'].map(function (a) { var k = a + '|' + per; return { k: k, d: FLOW.dist(k) }; }).filter(function (x) { return x.d; });
        if (!axes.length) return '';
        var allOk = axes.every(function (x) { var q = summary(x.k, { dist: x.d }); return q.total > 0 && q.ok === q.total; });
        if (allOk) return '전 부서 확인 완료 — 마감 보고 차례';
        var allDue = axes.every(function (x) { return x.d.due && today() > x.d.due; });
        return allDue ? '기한 경과 — 마감 보고 차례' : '';
    }
    function carrySummary(key, flow) {
        var out = { total: 0, reported: 0, done: 0, list: [] };
        depts().forEach(function (d) {
            if (!isTarget(flow, d.id)) return;
            var c = carryOf(key, d.id); if (!c) return;
            var st = stateOf(key, d.id), pa = st.exists && st.prevAction;
            out.total++; if (pa) { out.reported++; if (pa.state === 'DONE') out.done++; }
            out.list.push({ dept: d, carry: c, action: pa || null });
        });
        return out;
    }
    function overdue(flow) { return !!(flow && flow.dist && flow.dist.due && today() > flow.dist.due); }

    function summary(key, flow) {
        if (flow) {
            var tg = depts().filter(function (d) { return isTarget(flow, d.id); });
            var s = { total: tg.length, submitted: 0, ok: 0, wait: 0, returned: 0, none: 0, done: 0, todo: 0, na: 0, naUnexplained: 0, late: 0 };
            tg.forEach(function (d) {
                var p = progressOf(key, d.id, flow), st = stateOf(key, d.id);
                if (p === 'NONE') { s.none++; return; }
                s.submitted++;
                if (p === 'OK') s.ok++; else if (p === 'WAIT') s.wait++; else if (p === 'RETURNED') s.returned++;
                if (st.status === ST.DONE) s.done++; else if (st.status === ST.TODO) s.todo++; else { s.na++; if (!st.naReason) s.naUnexplained++; }
                if (flow.dist.due && (st.submittedAt || '') > flow.dist.due) s.late++;
            });
            s.rate = s.total ? Math.round(s.submitted / s.total * 100) : 0;
            return s;
        }
        var rows = depts().map(function (d) { return stateOf(key, d.id); });
        var done = rows.filter(function (r) { return r.exists && r.status === ST.DONE; }).length;
        var na = rows.filter(function (r) { return r.exists && r.status === ST.NA; }).length;
        var none = rows.filter(function (r) { return !r.exists; }).length;
        return {
            total: rows.length, done: done, na: na, none: none,
            todo: rows.length - done - na - none,
            naUnexplained: rows.filter(function (r) { return r.exists && r.status === ST.NA && !r.naReason; }).length,
            rate: rows.length ? Math.round(done / rows.length * 100) : 0
        };
    }

    /* ================= 렌더 =================
     * opts: { key, ns, labels, statusLabel, rateLabel, placeLabel, evidenceLabel, onChange,
     *         flow?: { dist, locked, period } }  — flow 가 있으면 배포 흐름(이행점검) */
    function render(opts) {
        var key = opts.key, ns = opts.ns || 'DEPTCHK';
        var L = labelsOf(opts);
        var g = gap();
        var list = depts();
        var flow = opts.flow || null;

        var gapNote = g.missing
            ? '<div class="check-notice" style="margin-bottom:10px;">' +
                '<b>부서 명단 ' + g.registered + ' / ' + g.expected + '개 등록</b> — 대상은 과·사업소 ' +
                g.expected + '개인데 시스템에는 ' + g.registered + '개만 등록되어 있습니다. ' +
                '나머지 <b>' + g.missing + '개는 명단 미확보</b>라 표에 나타나지 않습니다.</div>'
            : '';

        var roleNote = '';
        if (R() && R().current) {
            var p = R().current();
            var anyAct = list.some(function (d) { return canAct(d.id); });
            if (flow) {
                /* 배포 흐름 — 내가 이 표에서 무엇을 하는지 한 줄로 밝힌다(권한 블록과 같은 말) */
                var own = R().OWNER_DEPT, mineTxt;
                if (p.tier === 'staff' && p.deptId === own) mineTxt = '<b>우리 부서(재난안전과) 결과 제출</b>과 <b>전 부서 검토(승인·반려)·독촉</b>을 합니다. 점검 배포·마감 보고도 재난안전과 담당자 몫입니다.';
                else if (isOwnerLead()) mineTxt = '<b>전 부서 검토(승인·반려)·독촉</b>을 합니다. 결과 제출·배포·마감은 담당자가 합니다.';
                else if (p.tier === 'staff') mineTxt = '<b>우리 부서 줄의 결과 제출</b>만 합니다(우리 부서 실무자 누구나). 검토는 재난안전과가 합니다.';
                else if (p.tier === 'super' && p.deptId !== own && !hasPractitioner(p.deptId)) mineTxt = '<b>우리 부서 결과 제출</b>과 <b>독촉</b>을 합니다 — 우리 부서에 실무자 계정이 없어 부서장이 냅니다.';
                else if (p.tier === 'super' && p.deptId === own) mineTxt = '<b>조회</b>와 <b>전 부서 독촉</b>을 합니다. 결과 제출은 부서 실무자, 검토는 재난안전과 담당자·팀장이 합니다.';
                else if (p.tier === 'super') mineTxt = '<b>조회</b>와 <b>우리 부서 독촉</b>을 합니다. 결과 제출은 부서 실무자가 합니다.';
                else mineTxt = '<b>조회 전용입니다.</b> 결과 제출은 각 부서 실무자, 검토는 재난안전과가 합니다.';
                roleNote = '<div class="check-notice" style="margin-bottom:10px;">' + mineTxt + '</div>';
            } else if (!anyAct) {
                roleNote = '<div class="check-notice" style="margin-bottom:10px;">' +
                    (p.tier !== 'staff'
                        ? '<b>조회 전용입니다.</b> 관리·감독 계층은 현황을 보고 지휘하며, ' +
                          (flow ? '결과 제출' : (opts.labels && opts.labels.DONE ? esc(opts.labels.DONE) : '이행') + ' 등록') +
                          '은 각 부서 담당자가 직접 수행합니다.'
                        : '<b>조회 전용입니다.</b> 등록은 해당 부서 담당자와 주관부서(재난안전과)가 수행합니다.') +
                    '</div>';
            }
        }

        if (flow) {
            var fullScope = !R() || !R().scope || R().scope() === 'all';
            return (fullScope ? gapNote : '') + roleNote + renderFlow(key, ns, list, opts, flow, L);
        }

        var s = summary(key);
        var stat =
            '<div class="dchk-stat">' +
                statBox('전체', g.registered + '개 부서', 'neutral') +
                statBox(L.DONE, s.done + '개', 'success') +
                statBox(L.TODO, s.todo + '개', s.todo ? 'danger' : 'neutral') +
                statBox(L.NONE, s.none + '개', s.none ? 'warning' : 'neutral') +
                statBox(L.NA, s.na + '개' + (s.naUnexplained ? ' (사유 없음 ' + s.naUnexplained + ')' : ''),
                    s.naUnexplained ? 'warning' : 'neutral') +
                statBox(opts.rateLabel || (L.DONE + '률'), s.rate + '%', s.rate === 100 ? 'success' : 'info') +
            '</div>';

        var rows = list.map(function (d) { return rowHtml(key, ns, d, opts); }).join('');
        if (!rows) rows = '<tr><td colspan="6"><div class="v2-empty">등록된 부서가 없습니다.</div></td></tr>';

        return gapNote + roleNote + stat +
            '<div class="dchk-scroll"><table class="table-figma table-compact"><thead><tr>' +
                '<th style="min-width:130px;">부서·사업장</th>' +
                '<th style="width:120px;">' + esc(opts.statusLabel || (L.DONE + ' 여부')) + '</th>' +
                '<th style="min-width:150px;">' + esc(opts.placeLabel || '위치·비고') + '</th>' +
                '<th style="width:110px;">확인일</th>' +
                '<th style="min-width:150px;">' + esc(opts.evidenceLabel || '증빙') + '</th>' +
                '<th style="width:150px;">관리</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    function statBox(label, val, tone) {
        return '<div class="dchk-stat-box"><span class="dchk-stat-label">' + esc(label) + '</span>' +
            '<span class="chip-status ' + tone + '">' + esc(val) + '</span></div>';
    }
    function chip(label) { return '<span class="chip-status chip-sm ' + V().toneOf(label) + '">' + esc(label) + '</span>'; }

    function rowHtml(key, ns, d, opts) {
        var st = stateOf(key, d.id);
        var L = labelsOf(opts);
        var label = st.exists ? (L[st.status] || L.TODO) : L.NONE;
        var naWarn = (st.exists && st.status === ST.NA && !st.naReason)
            ? '<div class="dchk-warn">사유 미기재 — 확인 필요</div>' : '';
        var mayAct = canAct(d.id);
        var photos = (st.photos || []).length
            ? '<div class="dchk-thumbs">' + st.photos.map(function (p, i) {
                  return '<span class="dchk-thumb" title="' + esc(p.name) + '">🖼️' + (mayAct
                      ? '<button type="button" onclick="' + ns + '.delPhoto(\'' + esc(d.id) + '\',' + i + ')"' +
                        ' aria-label="' + esc(p.name) + ' 삭제">×</button>'
                      : '') + '</span>';
              }).join('') + '</div>'
            : '<span class="dchk-none">증빙 없음</span>';

        return '<tr>' +
            '<td><b>' + esc(d.name) + '</b><div class="dchk-sub">' + d.count + '명</div></td>' +
            '<td>' + chip(label) + naWarn + '</td>' +
            '<td>' + (st.place ? esc(st.place) : '<span class="dchk-none">-</span>') +
                (st.naReason ? '<div class="dchk-sub">사유: ' + esc(st.naReason) + '</div>' : '') + '</td>' +
            '<td>' + (st.date ? esc(st.date) : '<span class="dchk-none">-</span>') + '</td>' +
            '<td>' + photos + '</td>' +
            '<td class="col-action">' +
                (mayAct
                    ? '<button type="button" class="btn btn-outline btn-sm" onclick="' + ns + '.open(\'' + esc(d.id) + '\')">확인 등록</button>'
                    : '<span class="dchk-ro">조회</span>') +
                /* 독촉은 아직 할 일이 남은 줄만 — 미등록·미게시·사유 없는 해당없음. 사유를 적은 해당없음은 끝난 줄이다 */
                ((!st.exists || st.status === ST.TODO || (st.status === ST.NA && !st.naReason)) && canRemindRow(d.id)
                    ? ' <button type="button" class="btn btn-outline btn-sm" onclick="' + ns + '.remind(\'' + esc(d.id) + '\')">독촉</button>' : '') +
            '</td>' +
        '</tr>';
    }

    /* ---------- 배포 흐름 표 ---------- */
    function renderFlow(key, ns, list, opts, flow, L) {
        if (!flow.dist) {
            return '<div class="v2-empty" style="padding:24px;">' +
                (isOwnerStaff()
                    ? '이 회차는 아직 배포하지 않았습니다. 위 <b>[점검 배포]</b>에서 점검표·기한·대상을 정하고 시달 공문을 온나라로 보내면 대상 부서에 할 일이 갑니다.'
                    : '재난안전과가 점검표를 배포하면 이 표에서 우리 부서 결과를 제출합니다.') + '</div>';
        }
        /* 조회 범위 — 재난안전과·총괄 책임자는 전 부서, 그 밖에는 **우리 부서 줄만** 본다(2026-11-12 사용자 지시).
           판정은 DYROLE.inScope 한 곳(CLAUDE.md §12). 범위가 좁으면 전 부서 요약 칸도 내지 않는다 —
           한 줄을 보면서 «대상 11개 부서»를 읽게 하지 않는다. */
        var full = !R() || !R().scope || R().scope() === 'all';
        if (!full) list = list.filter(function (d) { return R().inScope(d.id); });
        var s = summary(key, flow);
        var stat = !full ? '' :
            '<div class="dchk-stat">' +
                statBox('대상', s.total + '개 부서', 'neutral') +
                statBox('제출', s.submitted + '개 (' + s.rate + '%)', s.rate === 100 ? 'success' : 'info') +
                statBox('확인 완료', s.ok + '개', s.ok ? 'success' : 'neutral') +
                statBox('확인 대기', s.wait + '개', s.wait ? 'info' : 'neutral') +
                statBox('반려', s.returned + '개', s.returned ? 'warning' : 'neutral') +
                statBox('일부 미이행', s.todo + '개', s.todo ? 'danger' : 'neutral') +
                statBox('미제출', s.none + '개' + (s.none && overdue(flow) ? ' · 기한 경과' : ''), s.none ? 'danger' : 'neutral') +
            '</div>';
        /* 대상 부서를 위에, 대상 아닌 부서를 아래에 — 분모에 들지 않는 줄이 섞이면 표를 훑기 어렵다 */
        var sorted = list.filter(function (d) { return isTarget(flow, d.id); })
            .concat(list.filter(function (d) { return !isTarget(flow, d.id); }));
        var rows = sorted.map(function (d) { return flowRowHtml(key, ns, d, opts, flow, L); }).join('');
        var lockNote = flow.locked
            ? '<div class="check-notice" style="margin-bottom:10px;"><b>이 회차는 마감 보고를 온나라로 보냈습니다(' + esc(flow.locked) + ').</b> 보낸 그대로 잠겨 제출·검토·독촉을 바꿀 수 없습니다. 온나라에서 반려·반송되면 다시 열립니다.</div>'
            : '';
        var cs = full ? carrySummary(key, flow) : { total: 0 };
        var carryNote = cs.total
            ? '<div class="check-notice" style="margin-bottom:10px;"><b>지난 반기(' + esc(perLabelOf(prevKeyOf(key))) + ') 미이행 ' + cs.total + '곳</b> — 이번 점검에서 조치 결과를 함께 받습니다. ' +
              '보고 ' + cs.reported + '곳 · 조치 완료 ' + cs.done + '곳' + (cs.total - cs.reported ? ' · 아직 안 낸 곳 ' + (cs.total - cs.reported) : '') + '</div>'
            : '';
        var rt = remindTargets(key, flow);
        var bulk = rt.length > 1
            ? '<div style="display:flex;justify-content:flex-end;margin:0 0 8px;"><button type="button" class="btn btn-outline btn-sm" onclick="' + ns + '.remindAll()">미제출 ' + rt.length + '개 부서 독촉</button></div>'
            : '';
        return lockNote + carryNote + stat + bulk +
            '<div class="dchk-scroll"><table class="table-figma table-compact"><thead><tr>' +
                '<th style="min-width:130px;">부서·사업장</th>' +
                '<th style="width:130px;">진행</th>' +
                '<th style="min-width:200px;">점검 결과</th>' +
                '<th style="width:110px;">제출일</th>' +
                '<th style="min-width:150px;">작성한 점검표</th>' +
                '<th style="width:170px;">관리</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    function flowRowHtml(key, ns, d, opts, flow, L) {
        var p = progressOf(key, d.id, flow);
        if (p === 'OFF') {
            return '<tr class="dchk-off"><td><b>' + esc(d.name) + '</b></td><td>' + chip('대상 아님') + '</td>' +
                '<td colspan="4"><span class="dchk-none">이 회차 점검 대상이 아닙니다</span></td></tr>';
        }
        var st = stateOf(key, d.id);
        var cf = st.confirm || {};
        var rl = ((fload().reminds || {})[key + '|' + d.id] || []);
        var progCell = chip(p === 'NONE' && overdue(flow) ? '미제출' : PROG_LABEL[p]) +
            (rl.length && (p === 'NONE' || p === 'RETURNED') ? '<div class="dchk-sub">독촉 ' + rl.length + '회 · 최근 ' + esc(rl[rl.length - 1].at.slice(0, 10)) + '</div>' : '') +
            (p === 'NONE' && overdue(flow) ? '<div class="dchk-warn">기한 경과</div>' : '') +
            (p === 'RETURNED' && cf.reason ? '<div class="dchk-warn">' + esc(cf.reason) + '</div>' : '') +
            (p === 'OK' && cf.by ? '<div class="dchk-sub">' + esc(cf.by) + ' · ' + esc(cf.at || '') + '</div>' : '') +
            ((cf.round || 1) > 1 ? '<div class="dchk-sub">' + cf.round + '차 제출</div>' : '');
        var resCell = '<span class="dchk-none">-</span>';
        var cr = carryOf(key, d.id);
        var carryLine = cr
            ? '<div class="dchk-sub" style="margin-top:4px;"><b>지난 반기 미이행</b> · 조치계획 «' + esc(cr.plan) + '»(예정 ' + esc(cr.planDue) + ')' +
              (st.exists && st.prevAction ? ' → ' + chip(CARRY_LABEL[st.prevAction.state] || '') + ' ' + esc(st.prevAction.text || '') : ' → <span class="dchk-warn" style="display:inline;">조치 결과 미보고</span>') + '</div>'
            : '';
        if (st.exists) {
            resCell = chip(L[st.status]) +
                (st.status === ST.TODO
                    ? '<div class="dchk-sub">미이행: ' + esc(st.missText || '') + '</div>' +
                      '<div class="dchk-sub">조치계획: ' + esc(st.plan || '') + (st.planDue ? ' (예정 ' + esc(st.planDue) + ')' : '') + '</div>'
                    : '') +
                (st.status === ST.NA
                    ? (st.naReason ? '<div class="dchk-sub">사유: ' + esc(st.naReason) + '</div>' : '<div class="dchk-warn">사유 미기재 — 확인 필요</div>')
                    : '') +
                (st.place ? '<div class="dchk-sub">' + esc(st.place) + '</div>' : '');
        }
        if (carryLine) resCell = (resCell === '<span class="dchk-none">-</span>' ? '' : resCell) + carryLine;
        var late = st.exists && flow.dist.due && (st.submittedAt || '') > flow.dist.due;
        var dateCell = st.exists
            ? esc(st.submittedAt || st.date || '') + (late ? '<div class="dchk-warn">지연 제출</div>' : '') +
              (st.submittedBy ? '<div class="dchk-sub">' + esc(st.submittedBy) + '</div>' : '') +
              (st.editedBy ? '<div class="dchk-sub">고침 · ' + esc(st.editedBy) + ' · ' + esc((st.editedAt || '').slice(0, 10)) + '</div>' : '')
            : (function () { var cl = ((fload().cancels || {})[key + '|' + d.id] || []); var c = cl[cl.length - 1];
                return c ? '<span class="dchk-none">-</span><div class="dchk-sub">제출 취소 · ' + esc(c.by) + ' · ' + esc((c.at || '').slice(0, 10)) + '</div>' : '<span class="dchk-none">-</span>'; })();
        var files = (st.photos || []).length
            ? fileBtns(key, d.id, ns, st.photos)
            : '<span class="dchk-none">-</span>';

        var acts = '';
        if (!flow.locked) {
            var mine = canSubmit(d.id);
            if (mine && (p === 'NONE' || p === 'RETURNED'))
                acts += '<button type="button" class="btn btn-primary btn-sm" onclick="' + ns + '.open(\'' + esc(d.id) + '\')">' + (p === 'RETURNED' ? '다시 제출' : '결과 제출') + '</button> ';
            /* 제출 고치기·취소는 그 부서만 — 재난안전과가 남의 부서 제출을 고치면 대리 작성이다 */
            if (mine && p === 'WAIT')
                acts += '<button type="button" class="btn btn-outline btn-sm" onclick="' + ns + '.open(\'' + esc(d.id) + '\')">제출 고치기</button> ' +
                        '<button type="button" class="btn btn-outline btn-sm" onclick="' + ns + '.unsubmit(\'' + esc(d.id) + '\')">제출 취소</button> ';
            if (p === 'WAIT' && canReviewer()) {
                acts += canReview(st, d.id)
                    ? '<button type="button" class="btn btn-primary btn-sm" onclick="' + ns + '.review(\'' + esc(d.id) + '\')">검토</button> '
                    : '<span class="dchk-ro">다른 담당자·팀장이 검토</span> ';
            }
            if (p === 'OK' && canReviewer())
                acts += '<button type="button" class="btn btn-outline btn-sm" onclick="' + ns + '.uncfm(\'' + esc(d.id) + '\')">확인 취소</button> ';
            if ((p === 'NONE' || p === 'RETURNED') && canRemindRow(d.id))
                acts += '<button type="button" class="btn btn-outline btn-sm" title="받는 사람 ' + esc(global.DYADM && global.DYADM.contactText ? global.DYADM.contactText(d.id) : '그 부서 담당자') + '" onclick="' + ns + '.remind(\'' + esc(d.id) + '\')">독촉</button>';
        }
        if (!acts) acts = '<span class="dchk-ro">' + (flow.locked ? '잠김' : '조회') + '</span>';

        return '<tr>' +
            '<td><b>' + esc(d.name) + '</b><div class="dchk-sub">' + d.count + '명</div></td>' +
            '<td>' + progCell + '</td>' +
            '<td>' + resCell + '</td>' +
            '<td>' + dateCell + '</td>' +
            '<td>' + files + '</td>' +
            '<td class="col-action">' + acts + '</td>' +
        '</tr>';
    }
    /* 같은 사람이 제출하고 확인하지 않는다 — 자기 부서 줄은 재난안전과의 다른 담당자가 확인한다 */
    function canReview(st, deptId) {
        var p = me();
        if (p && st.submittedByUid && st.submittedByUid === p.uid) return false;
        if (p && st.editedByUid && st.editedByUid === p.uid) return false;
        /* 재난안전과 담당자와 팀장이 전 부서를 검토한다(2026-11-12 사용자 지시) */
        return canReviewer();
    }

    /* ================= 파일 내려받기 =================
     * 저장소에는 파일 이름만 남는다(파일 본문은 직렬화되지 않는다). 이 화면에서 올린 파일은
     * 메모리에 붙들어 두었다가 검토 창·표에서 바로 내려받게 한다. 그 밖의 파일(예시 자료·
     * 다른 브라우저에서 올린 것)은 첨부 저장 연계 후 내려받는다 — 받은 척하지 않는다. */
    var MEM = {};
    /* 계정을 바꾸면 화면을 다시 읽어 메모리가 비므로, 시연 확인용으로 작은 파일(1MB 이하)만
       이 브라우저 세션에 함께 담아 둔다. 실제 파일 보관은 첨부 저장 연계 몫이다. */
    var FILEKEY = 'dy-deptcheck-files-v1';
    function fileStore() { try { return JSON.parse(global.sessionStorage.getItem(FILEKEY) || '{}'); } catch (e) { return {}; } }
    function stashFiles(key, deptId, items) {
        (items || []).forEach(function (f) {
            if (!f.file || f.file.size > 1024 * 1024 || !global.FileReader) return;
            var r = new FileReader();
            r.onload = function () {
                var st = fileStore(); st[rowKey(key, deptId) + '|' + f.name] = r.result;
                try { global.sessionStorage.setItem(FILEKEY, JSON.stringify(st)); } catch (e) {}
            };
            r.readAsDataURL(f.file);
        });
    }
    function fileOf(key, deptId, i) {
        var mem = MEM[rowKey(key, deptId)] || [];
        var st = stateOf(key, deptId);
        var f = (st.photos || [])[i];
        if (!f) return null;
        var hit = mem.filter(function (m) { return m.name === f.name && m.file; })[0];
        return hit || f;
    }
    function download(key, deptId, i) {
        var f = fileOf(key, deptId, i);
        if (!f) return;
        var url = f.file ? URL.createObjectURL(f.file) : fileStore()[rowKey(key, deptId) + '|' + f.name];
        if (url) {
            var a = document.createElement('a');
            a.href = url; a.download = f.name;
            document.body.appendChild(a); a.click(); a.remove();
            return;
        }
        V().notReady('«' + f.name + '» 내려받기', '첨부 저장 연계');
    }
    function fileBtns(key, deptId, ns, photos) {
        return (photos || []).map(function (f, i) {
            return '<button type="button" class="btn btn-outline btn-sm" style="margin:2px 4px 2px 0;" onclick="' + ns + '.dl(\'' + esc(deptId) + '\',' + i + ')">⬇ ' + esc(f.name) + '</button>';
        }).join('');
    }

    /* ================= 등록·제출 모달 ================= */
    var F = null;
    function flowGate(key, deptId, flow) {
        if (!flow) return true;
        if (!flow.dist) { toast('아직 배포되지 않은 회차입니다 — 재난안전과가 점검표를 배포하면 제출합니다.'); return false; }
        if (flow.locked) { toast('이 회차는 마감 보고를 보내 잠겼습니다.'); return false; }
        if (!isTarget(flow, deptId)) { toast('이 회차 점검 대상 부서가 아닙니다.'); return false; }
        var p = progressOf(key, deptId, flow);
        if (p === 'OK') { toast('재난안전과가 확인한 결과입니다 — 고치려면 재난안전과에 확인 취소를 요청하세요.'); return false; }
        return true;
    }
    /* 입력 창을 다룰 수 있는가 — 배포 흐름은 «그 부서 담당자», 기본(경영방침 게시)은 종전 판정 */
    function canEdit(deptId, opts) { return (opts && opts.flow) ? canSubmit(deptId) : canAct(deptId); }
    function denySubmit() {
        toast(canReviewer()
            ? '결과 제출은 그 부서 실무자가 합니다 — 고칠 것이 있으면 [검토]에서 반려하세요.'
            : '결과 제출은 그 부서 실무자가 자기 부서 줄에서 합니다.');
    }
    function open(key, deptId, opts) {
        if (!canEdit(deptId, opts)) { if (opts.flow) denySubmit(); else denied(deptId); return; }
        if (!flowGate(key, deptId, opts.flow)) return;
        var d = depts().filter(function (x) { return x.id === deptId; })[0];
        if (!d) return;
        var st = stateOf(key, deptId);
        var fresh = !st.exists || (st.confirm && st.confirm.state === CF.RETURNED && opts.flow);
        F = {
            key: key, deptId: deptId, ns: opts.ns || 'DEPTCHK',
            status: st.exists ? st.status : (opts.flow ? '' : ST.DONE), place: st.place || '',
            date: st.date || today(),
            naReason: st.naReason || '', note: st.note, photos: (st.photos || []).slice(),
            missText: st.missText || '', plan: st.plan || '', planDue: st.planDue || '',
            prevRound: (st.confirm && st.confirm.round) || 0, resubmit: !!(st.exists && fresh), retReason: (st.confirm && st.confirm.state === CF.RETURNED && st.confirm.reason) || '',
            carry: opts.flow ? carryOf(key, deptId) : null,
            carryState: (st.prevAction && st.prevAction.state) || '', carryText: (st.prevAction && st.prevAction.text) || '',
            opts: opts
        };
        renderModal(d);
    }
    function req() { return ' <span style="color:var(--status-danger-fg)">*</span>'; }
    function renderModal(d) {
        var o = F.opts, ns = F.ns, flow = o.flow;
        var L = labelsOf(o);
        var radios = [ST.DONE, ST.TODO, ST.NA].map(function (v) {
            return '<label class="dchk-radio"><input type="radio" name="dchk-st" value="' + v + '"' +
                (F.status === v ? ' checked' : '') + ' onchange="' + ns + '.setStatus(this.value)"> ' + esc(L[v]) + '</label>';
        }).join('');
        var distHead = '';
        if (flow && flow.dist) {
            distHead = '<div class="check-notice" style="margin-bottom:12px;">' +
                '<b>' + esc(o.periodLabel || '') + ' 점검표</b> · 기한 ' + esc(flow.dist.due) +
                /* 배포한 양식은 이 창에서도 내려받는다 — «내려받아 작성» 단계가 창을 닫으러 가지 않게 한다 */
                ((flow.dist.forms || []).length ? '<br>' + flow.dist.forms.map(function (f, i) {
                    return o.formDl
                        ? '<button type="button" class="btn btn-sm btn-outline" style="margin:4px 4px 0 0;" onclick="' + o.formDl + '(' + i + ')">⬇ ' + esc(f.name) + '</button>'
                        : '📎 ' + esc(f.name);
                }).join(o.formDl ? '' : ' · ') + ' (제' + (flow.dist.ver || 1) + '판)' : '') +
                (flow.dist.note ? '<br>' + esc(flow.dist.note) : '') +
                (F.resubmit ? '<br><b>반려된 결과를 고쳐 다시 제출합니다.</b>' + (F.retReason ? ' 반려 사유: ' + esc(F.retReason) : '') : '') +
                '</div>';
        }
        var needEv = flow ? (F.status === ST.DONE || F.status === ST.TODO) : F.status === ST.DONE;
        var evLabel = flow ? '작성한 점검표' : (o.evidenceLabel || '증빙 사진');
        /* 지난 반기 미이행 — 이번 제출에서 그 조치 결과를 함께 받는다(필수) */
        var carryBlock = '';
        if (flow && F.carry) {
            carryBlock = '<div class="dchk-mrow" style="border:1px solid var(--status-warning-border); border-radius:var(--radius-sm); padding:var(--sp-2) var(--sp-3);">' +
                '<label class="form-label">지난 반기(' + esc(F.carry.perLabel) + ') 미이행 조치 결과' + req() + '</label>' +
                '<p class="file-hint" style="margin:0 0 6px;">미이행: ' + esc(F.carry.missText) + '<br>조치계획: ' + esc(F.carry.plan) + ' (예정 ' + esc(F.carry.planDue) + ')</p>' +
                '<div class="dchk-radios">' + ['DONE', 'DOING', 'NONE'].map(function (v) {
                    return '<label class="dchk-radio"><input type="radio" name="dchk-carry" value="' + v + '"' + (F.carryState === v ? ' checked' : '') +
                        ' onchange="' + ns + '.setCarry(this.value)"> ' + CARRY_LABEL[v] + '</label>';
                }).join('') + '</div>' +
                '<textarea class="form-textarea" id="dchk-carrytext" rows="2" style="margin-top:6px;" placeholder="무엇을 했는지(조치 중·미조치면 사유와 새 예정일)">' + esc(F.carryText) + '</textarea></div>';
        }
        var body = distHead + carryBlock +
            '<div class="dchk-mrow"><label class="form-label">' + esc(flow ? '점검 결과' : (o.statusLabel || (L.DONE + ' 여부'))) + req() + '</label>' +
                '<div class="dchk-radios">' + radios + '</div></div>' +
            (F.status === ST.NA
                ? '<div class="dchk-mrow"><label class="form-label" for="dchk-na">' + esc(L.NA) + ' 사유' + req() + '</label>' +
                    '<textarea class="form-textarea" id="dchk-na" rows="2" placeholder="왜 이 부서에 해당하지 않는지 적으세요">' + esc(F.naReason) + '</textarea>' +
                    '<p class="file-hint">사유가 없으면 <b>확인 필요</b>로 남습니다.</p></div>'
                : '') +
            (flow && F.status === ST.TODO
                ? '<div class="dchk-mrow"><label class="form-label" for="dchk-miss">미이행 내용' + req() + '</label>' +
                    '<textarea class="form-textarea" id="dchk-miss" rows="2" placeholder="점검표 몇 번 항목이 왜 지켜지지 않았는지">' + esc(F.missText) + '</textarea></div>' +
                  '<div class="dchk-mrow"><label class="form-label" for="dchk-plan">조치계획' + req() + '</label>' +
                    '<textarea class="form-textarea" id="dchk-plan" rows="2" placeholder="무엇을 하겠다">' + esc(F.plan) + '</textarea></div>' +
                  '<div class="dchk-mrow"><label class="form-label" for="dchk-plandue">조치 예정일' + req() + '</label>' +
                    '<input type="date" class="form-input" id="dchk-plandue" value="' + esc(F.planDue) + '" min="' + esc(today()) + '" style="max-width:200px;">' +
                    '<p class="file-hint">조치했는지는 다음 반기 점검에서 확인합니다.</p></div>'
                : '') +
            (!flow && F.status !== ST.NA
                ? '<div class="dchk-mrow"><label class="form-label" for="dchk-place">' + esc(o.placeLabel || '위치·비고') +
                    (F.status === ST.DONE ? req() : '') + '</label>' +
                    '<input type="text" class="form-input" id="dchk-place" value="' + esc(F.place) + '" placeholder="' + esc(o.placePlaceholder || '') + '"></div>'
                : '') +
            (flow && F.status && F.status !== ST.NA
                ? '<div class="dchk-mrow"><label class="form-label" for="dchk-place">비고</label>' +
                    '<input type="text" class="form-input" id="dchk-place" value="' + esc(F.place) + '" placeholder="한 줄로 짧게"></div>'
                : '') +
            '<div class="dchk-mrow"><label class="form-label" for="dchk-date">' + (flow ? '점검일' : '확인일') + '</label>' +
                '<input type="date" class="form-input" id="dchk-date" value="' + esc(F.date) + '" style="max-width:200px;"></div>' +
            (flow && F.status === ST.NA ? '' :
            '<div class="dchk-mrow"><label class="form-label">' + esc(evLabel) + (needEv ? req() : '') + '</label>' +
                V().uploadDrop(
                    '<b>' + esc(evLabel) + '</b> <span style="font-size:var(--fs-12);color:var(--text-gray);">클릭 또는 끌어놓기</span>',
                    null, { hint: true, multiple: true, pick: ns + '.addPhoto', style: 'padding:12px;', profile: o.uploadProfile }) +
                (F.photos.length
                    ? '<ul class="dchk-shots">' + F.photos.map(function (p, i) {
                          var src = p.thumb || p.url;
                          return '<li>' + (src
                                  ? '<span class="dchk-shot"><img src="' + esc(src) + '" alt=""></span>'
                                  : '<span class="dchk-shot is-plain">파일</span>') +
                              '<span class="dchk-shot-n" title="' + esc(p.name) + '">' + esc(p.name) + '</span>' +
                              '<button type="button" class="edu-attach-del" onclick="' + ns + '.mDelPhoto(' + i + ')" aria-label="' + esc(p.name) + ' 삭제">×</button></li>';
                      }).join('') + '</ul>'
                    : '') +
            '</div>');
        V().openModal(esc(d.name) + ' — ' + esc(o.title || '이행 확인 등록'), body,
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="' + ns + '.save()">' + (flow ? (F.resubmit ? '다시 제출' : '제출') : '저장') + '</button>');
    }
    function capture() {
        var el = function (id) { return document.getElementById(id); };
        if (el('dchk-place')) F.place = el('dchk-place').value.trim();
        if (el('dchk-na')) F.naReason = el('dchk-na').value.trim();
        if (el('dchk-date')) F.date = el('dchk-date').value;
        if (el('dchk-miss')) F.missText = el('dchk-miss').value.trim();
        if (el('dchk-plan')) F.plan = el('dchk-plan').value.trim();
        if (el('dchk-plandue')) F.planDue = el('dchk-plandue').value;
        if (el('dchk-carrytext')) F.carryText = el('dchk-carrytext').value.trim();
    }
    function setCarry(v) { if (!F) return; capture(); F.carryState = v; }
    function setStatus(v) {
        if (!F || !canEdit(F.deptId, F.opts)) { denied(F && F.deptId); return; } capture();
        /* 기본 모드(경영방침 게시) — 게시 여부를 바꾸면 그 판정에 딸린 값을 비우고 확인일을 오늘로 둔다.
           «미게시»인데 옛 게시 위치·사진·2월 확인일이 남으면 줄이 앞뒤가 맞지 않는다(2026-11-13 실습 데이터 점검) */
        if (!F.opts.flow && v !== F.status) {
            if (v !== ST.DONE) { F.photos = []; F.place = ''; }
            if (v !== ST.NA) F.naReason = '';
            F.date = today();
        }
        F.status = v; renderModal(deptOf(F.deptId)); }
    function deptOf(id) { return depts().filter(function (x) { return x.id === id; })[0]; }
    function addPhoto(files) {
        if (!F || !canEdit(F.deptId, F.opts)) { denied(F && F.deptId); return; }
        capture();
        if (!files || !files.length) return;
        var lim = (V().FILE_PROFILES && V().FILE_PROFILES[F.opts.uploadProfile]) || V().FILE_LIMITS;
        F.photos = F.photos.concat(files).slice(0, lim.maxCount);
        renderModal(deptOf(F.deptId));
        toast('파일 ' + files.length + '건 첨부');
    }
    function mDelPhoto(i) {
        if (!F || !canEdit(F.deptId, F.opts)) { denied(F && F.deptId); return; } capture(); F.photos.splice(i, 1); renderModal(deptOf(F.deptId)); }

    function saveModal() {
        if (!F || !canEdit(F.deptId, F.opts)) { denied(F && F.deptId); return; }
        capture();
        var flow = F.opts.flow;
        if (flow && !flowGate(F.key, F.deptId, flow)) return;
        var L = labelsOf(F.opts);
        if (!F.status) { toast('점검 결과를 고르세요.'); return; }
        if (flow) {
            if ((F.status === ST.DONE || F.status === ST.TODO) && !F.photos.length) { toast('작성한 점검표를 올려 주세요.'); return; }
            if (F.status === ST.TODO && (!F.missText || !F.plan || !F.planDue)) { toast('미이행 내용과 조치계획, 조치 예정일을 적어 주세요.'); return; }
            /* 조치 예정일은 오늘 이후 — 지난 날짜로 계획을 적으면 제출하는 순간 이미 늦은 계획이 된다 */
            if (F.status === ST.TODO && F.planDue < today()) { toast('조치 예정일은 오늘(' + today() + ') 이후로 정하세요.'); var pd = document.getElementById('dchk-plandue'); if (pd) pd.focus(); return; }
            if (F.carry && (!F.carryState || !F.carryText)) { toast('지난 반기 미이행 조치 결과(조치 완료·조치 중·미조치)와 내용을 적어 주세요.'); return; }
        } else {
            if (F.status === ST.DONE && !F.photos.length) {
                var ev = F.opts.evidenceLabel || '증빙';
                toast(L.DONE + V().josa(L.DONE, '으로', '로') + ' 등록하려면 ' + ev + V().josa(ev, '이', '가') + ' 필요합니다.');
                return;
            }
            if (F.status === ST.DONE && !F.place) {
                var pl = F.opts.placeLabel || '위치';
                toast(pl + V().josa(pl, '을', '를') + ' 입력하세요.'); return;
            }
        }
        if (F.status === ST.NA && !F.naReason) {
            toast(L.NA + ' 사유를 적으세요 — 사유 없이 빠질 수 없습니다.');
            var na = document.getElementById('dchk-na'); if (na) na.focus();
            return;
        }
        var patch = {
            status: F.status, place: F.place, date: F.date,
            naReason: F.status === ST.NA ? F.naReason : '',
            photos: F.status === ST.NA && flow ? [] : F.photos
        };
        if (flow) {
            var p = me();
            /* 제출 고치기(확인 대기 중 같은 차수)는 처음 낸 사람·날을 그대로 두고 고친 사람·날을 따로 남긴다 —
               같은 부서 실무자 누구나 고칠 수 있어 누가 무엇을 했는지 남아야 한다 */
            var prevSt = stateOf(F.key, F.deptId);
            var editing = prevSt.exists && prevSt.confirm && prevSt.confirm.state === CF.WAIT && !F.resubmit;
            Object.assign(patch, {
                missText: F.status === ST.TODO ? F.missText : '', plan: F.status === ST.TODO ? F.plan : '',
                prevAction: F.carry ? { state: F.carryState, text: F.carryText, period: F.carry.perLabel } : null,
                planDue: F.status === ST.TODO ? F.planDue : '',
                submittedAt: editing ? prevSt.submittedAt : today(),
                submittedBy: editing ? prevSt.submittedBy : (p ? p.name : actor()),
                submittedByUid: editing ? prevSt.submittedByUid : (p ? p.uid : ''),
                editedAt: editing ? nowTs() : '', editedBy: editing ? (p ? p.name : actor()) : '', editedByUid: editing && p ? p.uid : '',
                formVer: (flow.dist && flow.dist.ver) || 1,
                confirm: { state: CF.WAIT, round: F.resubmit ? F.prevRound + 1 : (F.prevRound || 1) }
            });
        }
        setState(F.key, F.deptId, patch);
        MEM[rowKey(F.key, F.deptId)] = (F.photos || []).filter(function (f) { return f.file; });
        stashFiles(F.key, F.deptId, F.photos);
        if (flow) notify({ kind: 'submit', key: F.key, deptId: F.deptId, flow: flow, periodLabel: F.opts.periodLabel });
        V().closeModal();
        toast((deptOf(F.deptId) || {}).name + (flow ? ' 결과 제출 — 재난안전과 확인을 기다립니다' : ' ' + L[F.status] + ' 등록'));
        if (F.opts.onChange) F.opts.onChange();
    }
    function delPhoto(key, deptId, i) {
        if (!canAct(deptId)) { denied(deptId); return; }
        var st = stateOf(key, deptId);
        var ph = (st.photos || []).slice();
        ph.splice(i, 1);
        setState(key, deptId, { photos: ph });
    }

    /* ================= 제출 취소 (확인 전만) ================= */
    function unsubmit(key, deptId, opts) {
        if (!canSubmit(deptId)) { denySubmit(); return; }
        if (!flowGate(key, deptId, opts.flow)) return;
        if (progressOf(key, deptId, opts.flow) !== 'WAIT') { toast('확인 대기 중인 제출만 취소할 수 있습니다.'); return; }
        var ns = opts.ns || 'DEPTCHK';
        V().openModal('제출 취소 — ' + esc((deptOf(deptId) || {}).name || ''),
            '<p style="font-size:var(--fs-13);">올린 점검표와 적은 결과·조치계획이 지워지고 <b>미제출</b>로 돌아갑니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
            '<button type="button" class="btn btn-primary" onclick="' + ns + '.doUnsubmit(\'' + esc(deptId) + '\')">제출 취소</button>');
    }
    function doUnsubmit(key, deptId, opts) {
        if (!canSubmit(deptId) || !flowGate(key, deptId, opts.flow)) { V().closeModal(); return; }
        if (progressOf(key, deptId, opts.flow) !== 'WAIT') { V().closeModal(); return; }
        removeState(key, deptId);
        /* 취소 기록 — 같은 부서 다른 실무자의 제출도 취소할 수 있어 누가 지웠는지 남긴다 */
        var lg = fload().cancels = fload().cancels || {};
        (lg[key + '|' + deptId] = lg[key + '|' + deptId] || []).push({ at: nowTs(), by: actor() });
        fsave();
        V().closeModal(); toast('제출을 취소했습니다.');
        if (opts.onChange) opts.onChange();
    }

    /* ================= 재난안전과 확인 · 보완 요청 ================= */
    function reviewGate(key, deptId, opts) {
        if (!canReviewer()) { toast('검토는 재난안전과 담당자·팀장이 합니다.'); return false; }
        if (opts.flow && opts.flow.locked) { toast('이 회차는 마감 보고를 보내 잠겼습니다.'); return false; }
        return true;
    }
    function review(key, deptId, opts) {
        if (!reviewGate(key, deptId, opts)) return;
        var st = stateOf(key, deptId);
        if (progressOf(key, deptId, opts.flow) !== 'WAIT') { toast('확인 대기 중인 제출이 아닙니다.'); return; }
        if (!canReview(st, deptId)) { toast('본인이 제출한 결과는 재난안전과의 다른 담당자나 팀장이 검토합니다.'); return; }
        var L = labelsOf(opts), ns = opts.ns || 'DEPTCHK';
        var body =
            '<div class="dchk-mrow"><span class="form-label">점검 결과</span> ' + chip(L[st.status]) +
                ((st.confirm && st.confirm.round > 1) ? ' <span class="dchk-sub">' + st.confirm.round + '차 제출</span>' : '') + '</div>' +
            (st.status === ST.TODO
                ? '<div class="dchk-mrow"><span class="form-label">미이행 내용</span><div>' + esc(st.missText) + '</div></div>' +
                  '<div class="dchk-mrow"><span class="form-label">조치계획</span><div>' + esc(st.plan) + ' (예정 ' + esc(st.planDue) + ')</div></div>'
                : '') +
            (st.status === ST.NA ? '<div class="dchk-mrow"><span class="form-label">해당없음 사유</span><div>' + esc(st.naReason || '사유 미기재') + '</div></div>' : '') +
            (carryOf(key, deptId)
                ? '<div class="dchk-mrow"><span class="form-label">지난 반기 미이행 조치 결과</span><div>' +
                    '조치계획 «' + esc(carryOf(key, deptId).plan) + '»(예정 ' + esc(carryOf(key, deptId).planDue) + ') → ' +
                    (st.prevAction ? chip(CARRY_LABEL[st.prevAction.state]) + ' ' + esc(st.prevAction.text || '') : '<span class="dchk-warn">보고 없음</span>') + '</div></div>'
                : '') +
            '<div class="dchk-mrow"><span class="form-label">작성한 점검표</span><div>' +
                ((st.photos || []).length ? fileBtns(key, deptId, ns, st.photos) : '없음') +
                (opts.flow && opts.flow.dist && (opts.flow.dist.forms || []).length
                    ? '<div class="dchk-sub">배포한 양식: ' + opts.flow.dist.forms.map(function (f) { return esc(f.name); }).join(' · ') + ' (제' + (opts.flow.dist.ver || 1) + '판) — 위 회차 머리에서 내려받습니다</div>' : '') +
                '</div></div>' +
            '<div class="dchk-mrow"><span class="form-label">제출</span><div>' + esc(st.submittedAt || '') + ' · ' + esc(st.submittedBy || '') + '</div></div>' +
            '<div class="dchk-mrow"><label class="form-label" for="dchk-ret">반려 사유 <span class="dchk-sub">(반려할 때 필수 — 제출한 사람에게 알림으로 갑니다)</span></label>' +
                '<textarea class="form-textarea" id="dchk-ret" rows="2" placeholder="부서가 무엇을 고칠지 적어 주세요"></textarea></div>';
        V().openModal('제출 검토 — ' + esc((deptOf(deptId) || {}).name || ''), body,
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
            '<button type="button" class="btn btn-outline" style="border-color:var(--status-danger-border);color:var(--status-danger-fg);" onclick="' + ns + '.doReturn(\'' + esc(deptId) + '\')">반려</button>' +
            '<button type="button" class="btn btn-primary" onclick="' + ns + '.doConfirm(\'' + esc(deptId) + '\')">승인</button>');
    }
    function doConfirm(key, deptId, opts) {
        if (!reviewGate(key, deptId, opts)) { V().closeModal(); return; }
        var st = stateOf(key, deptId);
        if (progressOf(key, deptId, opts.flow) !== 'WAIT' || !canReview(st, deptId)) { V().closeModal(); return; }
        var p = me();
        setState(key, deptId, { confirm: Object.assign({}, st.confirm, { state: CF.OK, by: p ? p.name : actor(), at: today(), reason: '' }) });
        V().closeModal(); toast((deptOf(deptId) || {}).name + ' 승인 — 확인 완료');
        if (opts.onChange) opts.onChange();
    }
    function doReturn(key, deptId, opts) {
        if (!reviewGate(key, deptId, opts)) { V().closeModal(); return; }
        var st = stateOf(key, deptId);
        if (progressOf(key, deptId, opts.flow) !== 'WAIT' || !canReview(st, deptId)) { V().closeModal(); return; }
        var reason = ((document.getElementById('dchk-ret') || {}).value || '').trim();
        if (!reason) { toast('반려 사유를 적어 주세요 — 부서가 무엇을 고칠지 알아야 합니다.'); var el = document.getElementById('dchk-ret'); if (el) el.focus(); return; }
        var p = me();
        setState(key, deptId, { confirm: Object.assign({}, st.confirm, { state: CF.RETURNED, by: p ? p.name : actor(), at: today(), reason: reason }) });
        notify({ kind: 'return', key: key, deptId: deptId, flow: opts.flow, periodLabel: opts.periodLabel, reason: reason });
        V().closeModal(); toast((deptOf(deptId) || {}).name + ' 반려 — 제출한 사람에게 알림을 보냈습니다');
        if (opts.onChange) opts.onChange();
    }
    function uncfm(key, deptId, opts) {
        if (!reviewGate(key, deptId, opts)) return;
        if (progressOf(key, deptId, opts.flow) !== 'OK') return;
        var ns = opts.ns || 'DEPTCHK';
        V().openModal('확인 취소 — ' + esc((deptOf(deptId) || {}).name || ''),
            '<p style="font-size:var(--fs-13);">확인을 풀면 <b>확인 대기</b>로 돌아가고 부서가 제출을 고칠 수 있습니다.</p>' +
            '<div class="dchk-mrow"><label class="form-label" for="dchk-unc">확인 취소 사유' + req() + '</label>' +
            '<textarea class="form-textarea" id="dchk-unc" rows="2"></textarea></div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
            '<button type="button" class="btn btn-primary" onclick="' + ns + '.doUncfm(\'' + esc(deptId) + '\')">확인 취소</button>');
    }
    function doUncfm(key, deptId, opts) {
        if (!reviewGate(key, deptId, opts)) { V().closeModal(); return; }
        var reason = ((document.getElementById('dchk-unc') || {}).value || '').trim();
        if (!reason) { toast('확인을 취소하는 이유를 적어 주세요.'); return; }
        var st = stateOf(key, deptId);
        setState(key, deptId, { confirm: Object.assign({}, st.confirm, { state: CF.WAIT, by: '', at: '', reason: '', unconfirmed: { by: actor(), at: nowTs(), reason: reason } }) });
        V().closeModal(); toast('확인을 취소했습니다');
        if (opts.onChange) opts.onChange();
    }

    /* 독촉 권한 — 독촉 경로(이행점검·경영방침·교육·위험성평가)가 같은 판정(DYROLE.canRemind).
       자기 자신에게는 보내지 않는다 — 그 부서 담당자 계정에는 자기 부서 줄 독촉이 없다(11-10). */
    function canRemindRow(deptId) {
        var Rr = global.DYROLE;
        if (!Rr || !Rr.canRemind) return canAct(deptId);
        var p = Rr.current ? Rr.current() : null;
        if (p && p.tier === 'staff' && p.deptId === deptId) return false;
        return Rr.canRemind(deptId);
    }
    /* 독촉 거절 문구 — 그 부서 담당자가 자기 부서를 누르면 «자기 자신»이라 따로 말한다(11-10 부서 단위) */
    function remindDeny(deptId) {
        var p = me();
        if (p && p.tier === 'staff' && p.deptId === deptId)
            return '우리 부서 독촉은 부서장과 재난안전과가 합니다 — 담당자 자신에게는 보내지 않습니다.';
        return global.DYROLE && global.DYROLE.remindDenyNote ? global.DYROLE.remindDenyNote('독촉') : '독촉 권한이 없습니다.';
    }
    function remind(key, deptId, opts, quiet) {
        if (!canRemindRow(deptId)) { if (!quiet) toast(remindDeny(deptId)); return false; }
        var flow = opts && opts.flow;
        if (flow) {
            if (!flow.dist) { if (!quiet) toast('아직 배포되지 않은 회차입니다.'); return false; }
            if (flow.locked) { if (!quiet) toast('이 회차는 마감 보고를 보내 잠겼습니다.'); return false; }
            var pr = progressOf(key, deptId, flow);
            if (pr !== 'NONE' && pr !== 'RETURNED') { if (!quiet) toast('미제출·반려된 부서에만 독촉합니다.'); return false; }
        }
        var d = deptOf(deptId);
        var who = global.DYADM && global.DYADM.contactText ? global.DYADM.contactText(deptId) : '그 부서 담당자';
        var what = flow ? (progressOf(key, deptId, flow) === 'RETURNED' ? '반려 재제출 독촉' : '결과 제출 독촉') : '독촉';
        if (flow) {
            /* 배포 흐름은 독촉 기록을 회차별로 남긴다 — 줄에 «독촉 N회 · 최근»이 보이고 마감 보고에도 쓴다.
               발신자는 실제 접속자다(재난안전과 고정 문자열 금지). 알림 발송 자체는 알림 연계 몫이다. */
            var log = fload().reminds = fload().reminds || {};
            var lk = key + '|' + deptId;
            (log[lk] = log[lk] || []).push({ at: nowTs(), by: actor(), what: what, to: who });
            fsave();
            notify({ kind: 'remind', key: key, deptId: deptId, what: what, due: flow.dist && flow.dist.due });
            if (quiet) return true;
            toast((d ? d.name : deptId) + ' ' + what + ' · 받는 사람 ' + who);
            if (opts && opts.onChange) opts.onChange();
            return true;
        }
        toast((d ? d.name : deptId) + ' ' + what + ' · 받는 사람 ' + who + ' — 발송 기록은 알림 연계 후 남습니다');
    }

    /* 일괄 독촉 — 미제출(NONE)만 센다(반려는 사유가 달라 줄에서 따로). 받는 사람을 누르기 전에 밝힌다. */
    function remindTargets(key, flow) {
        if (!flow || !flow.dist || flow.locked) return [];
        return depts().filter(function (d) {
            return (!R() || !R().inScope || R().inScope(d.id)) && progressOf(key, d.id, flow) === 'NONE' && canRemindRow(d.id);
        });
    }
    function remindAll(key, opts) {
        var flow = opts && opts.flow;
        var list = remindTargets(key, flow);
        if (!list.length) { toast('독촉할 미제출 부서가 없습니다.'); return; }
        var who = function (id) { return global.DYADM && global.DYADM.contactText ? global.DYADM.contactText(id) : '그 부서 담당자'; };
        V().openModal('미제출 ' + list.length + '개 부서 결과 제출 독촉',
            '<p style="margin:0 0 10px;">아래 부서에 «결과 제출 독촉» 알림을 보내고 회차 기록에 남깁니다.</p>' +
            '<div class="dchk-scroll"><table class="table-figma table-compact"><thead><tr><th>부서</th><th>받는 사람</th><th>이전 독촉</th></tr></thead><tbody>' +
            list.map(function (d) {
                var n = ((fload().reminds || {})[key + '|' + d.id] || []).length;
                return '<tr><td>' + esc(d.name) + '</td><td>' + esc(who(d.id)) + '</td><td>' + (n ? n + '회' : '-') + '</td></tr>';
            }).join('') + '</tbody></table></div>',
            '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" onclick="' + opts.ns + '.doRemindAll()">' + list.length + '개 부서 독촉</button>');
    }
    function doRemindAll(key, opts) {
        var sent = remindTargets(key, opts && opts.flow).filter(function (d) { return remind(key, d.id, opts, true); });
        var nobody = sent.filter(function (d) { return !remindUids(d.id).length; }).length;
        var n = sent.length - nobody;
        V().closeModal();
        /* 받는 사람이 없는 부서는 «보냈다»고 세지 않는다 — 기록만 남는다(CLAUDE.md §15) */
        toast(!sent.length ? '독촉할 미제출 부서가 없습니다.'
            : (n ? n + '개 부서에 결과 제출 독촉을 보냈습니다' : '독촉을 받을 사람이 있는 부서가 없습니다') +
              (nobody ? ' · 받는 사람이 없는 ' + nobody + '개 부서는 기록만 남겼습니다' : ''));
        if (opts && opts.onChange) opts.onChange();
    }

    /* ================= 알림 =================
     * 받는 사람이 할 일이 있을 때만 보낸다(SCR-ADMIN-002 §4-1):
     *   배포·기한 변경 → 지정 담당자(없으면 실무자 전원 · 없으면 부서장)
     *   제출 → 재난안전과 담당자·팀장 «검토 요청»(과장 제외)
     *   반려 → 제출한 사람 · 고친 사람 + 지정 담당자 «반려 — 사유»
     *   독촉 → 지정 담당자(없으면 부서장)
     * 헤더 알림은 DYLayout.ntfPush 한 곳으로 쌓는다(실제 문자·메일 발송은 알림 연계 몫). */
    function notify(o) {
        var L = global.DYLayout;
        if (!L || !L.ntfPush) return;
        var own = R() ? R().OWNER_DEPT : 'safety';
        var dn = (deptOf(o.deptId) || {}).name || o.deptId;
        var axis = /citizen/.test(o.key) ? 'citizen' : 'industrial';
        var per = o.key.split('|')[1] || '';
        var perLbl = per.replace(/^(\d{4})-H([12])$/, function (m, y, h) { return y + ' ' + (h === '1' ? '상반기' : '하반기'); }) +
            (axis === 'citizen' ? ' 중대시민재해' : ' 중대산업재해');
        var href = 'menu.html?m=comply&axis=' + axis + '&period=' + per;
        if (o.kind === 'dist' || o.kind === 'due') {
            L.ntfPush({ cat: 'compliance', catLabel: '이행', toUids: workUids(o.deptId),
                title: perLbl + ' 의무이행 자체점검 ' + (o.kind === 'dist'
                    ? '실시 통보 — 점검표가 배포되었습니다(기한 ' + o.due + ')'
                    : '제출 기한이 ' + String(o.from || '').slice(5) + ' → ' + String(o.due || '').slice(5) + ' 로 바뀌었습니다'),
                href: href, work: 'my-work.html?cat=comply', basis: 'cse-5' });
            return;
        }
        if (o.kind === 'remind') {
            L.ntfPush({ cat: 'compliance', catLabel: '이행', toUids: remindUids(o.deptId),
                title: perLbl + ' 의무이행 자체점검 ' + o.what + (o.what === '반려 재제출 독촉' ? ' — 반려된 결과를 고쳐 다시 제출해 주세요' : ' — 결과를 제출해 주세요') + (o.due ? '(기한 ' + o.due + ')' : ''),
                href: href, work: 'my-work.html?cat=comply', basis: 'cse-5' });
            return;
        }
        if (o.kind === 'return') {
            var st = stateOf(o.key, o.deptId);
            L.ntfPush({ cat: 'compliance', catLabel: '이행', toUids: uniq([st.submittedByUid, st.editedByUid].concat(designatedSubmitters(o.deptId))),
                title: perLbl + ' 의무이행 점검 결과 반려 — ' + o.reason, href: href, work: 'my-work.html?cat=comply', basis: 'cse-5' });
        } else if (o.kind === 'submit') {
            L.ntfPush({ cat: 'compliance', catLabel: '이행', toUids: reviewerUids(),
                title: dn + ' ' + perLbl + ' 의무이행 점검 결과 제출 — 검토 요청', href: href, work: 'my-work.html?cat=comply', basis: 'cse-5' });
        }
    }

    global.DEPTCHK = {
        ST: ST, CF: CF, DEFAULT_LABELS: DEFAULT_LABELS, FLOW_LABELS: FLOW_LABELS, EXPECTED_DEPTS: EXPECTED_DEPTS,
        depts: depts, gap: gap, summary: summary,
        stateOf: stateOf, setState: setState, reset: reset,
        render: render, open: open, setStatus: setStatus, addPhoto: addPhoto,
        mDelPhoto: mDelPhoto, save: saveModal, delPhoto: delPhoto, remind: remind, remindAll: remindAll, doRemindAll: doRemindAll,
        /* 배포 흐름 (이행점검) */
        closeReady: closeReady, carryOf: carryOf, carrySummary: carrySummary, prevKeyOf: prevKeyOf, CARRY_LABEL: CARRY_LABEL, setCarry: setCarry,
        notify: notify, workUids: workUids, workText: workText, civilFacilityNames: civilFacilityNames, resetDemo: resetDemo, doResetDemo: doResetDemo,
        flow: FLOW, remindLog: function (key, deptId) { return ((fload().reminds || {})[key + '|' + deptId] || []).slice(); }, isTarget: isTarget, progressOf: progressOf, submitted: submitted, isOwnerStaff: isOwnerStaff,
        unsubmit: unsubmit, doUnsubmit: doUnsubmit,
        review: review, doConfirm: doConfirm, download: download, doReturn: doReturn, uncfm: uncfm, doUncfm: doUncfm
    };
})(window);
