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
    function canSubmit(deptId) {
        var p = me();
        if (!R() || !p) return true;
        return p.tier === 'staff' && p.deptId === deptId;
    }
    function canReviewer() { return isOwnerStaff() || isOwnerLead(); }
    function actor() { return R() && R().actorLabel ? R().actorLabel() : '재난안전과'; }
    function denied(deptId) {
        var p = me();
        toast(p && p.tier !== 'staff'
            ? '관리감독자는 조회만 합니다 — 등록·제출은 담당자 본인이 수행합니다.'
            : '해당 부서 담당자와 주관부서(재난안전과)만 등록할 수 있습니다.');
    }

    /* v5 — 이행점검 배포 흐름(확인 축·미이행 조치계획) 시드 (2026-11-12).
     * key 에 **회차 축**이 들어간다 — 호출자가 실어 보낸다.
     *   예) 'comply-industrial|2026-H1'(반기) · 'policy-post|v2.0'(방침 버전) */
    var SKEY = 'dy-deptcheck-v5';
    var FKEY = 'dy-comply-flow-v1';   /* 배포·마감 기록 — 회차 단위 */

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
    var SEED = {
        /* 경영방침 게시 — 게시 4 · 해당없음(사유O) 1 · 해당없음(사유X) 1 · 나머지 미등록 */
        'policy-post|v2.0': {
            safety:   { status: 'DONE', place: '군청 본관 1층 게시판', date: '2026-03-04', photos: [ph('재난안전과_게시_1.jpg')] },
            env:      { status: 'DONE', place: '환경과 사무실 입구', date: '2026-03-05', photos: [ph('환경과_게시_1.jpg')] },
            water:    { status: 'DONE', place: '물순환사업소 정문 게시판', date: '2026-03-06', photos: [ph('물순환_게시_1.jpg'), ph('물순환_게시_2.jpg')] },
            facility: { status: 'DONE', place: '공공시설사업소 현관', date: '2026-03-06', photos: [ph('공공시설_게시_1.jpg')] },
            health:   { status: 'NA', naReason: '보건소는 별도 청사로 군청 게시판 대상이 아님 — 보건소 자체 게시판에 별도 게시(2026-03-10)', date: '2026-03-10' },
            culture:  { status: 'NA', naReason: '', date: '' }
        },
        /* 중대산업재해 2026 상반기 — 확인 완료·확인 대기·보완 요청·일부 미이행·해당없음·미제출이 한 화면에 다 보이게 */
        'comply-industrial|2026-H1': {
            safety:    { status: 'DONE', date: '2026-06-24', photos: [doc('재난안전과_상반기_자체점검표.pdf')], submittedAt: '2026-06-24', submittedBy: '박안전', submittedByUid: 'u_jjt2',
                         confirm: { state: 'WAIT', round: 1 } },
            water:     { status: 'DONE', date: '2026-06-26', place: '지적 없음', photos: [doc('물순환사업소_상반기_자체점검표.pdf')], submittedAt: '2026-06-26', submittedBy: '하정수', submittedByUid: 'u_wat3',
                         confirm: { state: 'OK', round: 1, by: '박안전', at: '2026-06-29' } },
            env:       { status: 'DONE', date: '2026-06-27', photos: [doc('환경과_상반기_자체점검표.pdf')], submittedAt: '2026-06-27', submittedBy: '정수빈', submittedByUid: 'u_env5',
                         confirm: { state: 'OK', round: 1, by: '박안전', at: '2026-06-29' } },
            construct: { status: 'DONE', date: '2026-06-30', photos: [doc('건설과_상반기_자체점검표.pdf')], submittedAt: '2026-06-30', submittedBy: '건설과 담당자', submittedByUid: '',
                         confirm: { state: 'WAIT', round: 1 } },
            facility:  { status: 'DONE', date: '2026-07-01', photos: [doc('공공시설사업소_상반기_자체점검표.pdf')], submittedAt: '2026-07-01', submittedBy: '공공시설사업소 담당자', submittedByUid: '',
                         confirm: { state: 'RETURNED', round: 1, by: '박안전', at: '2026-07-03', reason: '점검표 2쪽 부서장 서명이 빠졌습니다 — 서명본으로 다시 올려 주세요' } },
            culture:   { status: 'TODO', date: '2026-06-29', photos: [doc('문화체육과_상반기_자체점검표.pdf')], submittedAt: '2026-06-29', submittedBy: '문화체육과 담당자', submittedByUid: '',
                         missText: '점검표 4번(체육시설 안전점검 결과 기록) — 상반기 정기점검 결과를 대장에 기록하지 않음',
                         plan: '7월 중 체육시설 3개소 점검 결과를 대장에 기록하고 담당자를 지정', planDue: '2026-07-31', needs: ['부서 자체 처리'],
                         confirm: { state: 'WAIT', round: 1 } },
            plan:      { status: 'NA', naReason: '기획예산실은 현장 작업이 없어 안전조치 점검 대상에서 제외 — 예산 편성 항목만 해당', date: '2026-06-25', submittedAt: '2026-06-25', submittedBy: '기획예산실 담당자', submittedByUid: '',
                         confirm: { state: 'OK', round: 1, by: '박안전', at: '2026-06-29' } }
        },
        /* 중대시민재해 2026 상반기 — 대상은 공중이용시설 보유 부서 */
        'comply-citizen|2026-H1': {
            facility: { status: 'DONE', date: '2026-06-27', photos: [doc('공공시설사업소_시민재해_점검표.pdf')], submittedAt: '2026-06-27', submittedBy: '공공시설사업소 담당자', submittedByUid: '',
                        confirm: { state: 'OK', round: 1, by: '박안전', at: '2026-06-30' } },
            culture:  { status: 'DONE', date: '2026-06-29', photos: [doc('문화체육과_시민재해_점검표.pdf')], submittedAt: '2026-06-29', submittedBy: '문화체육과 담당자', submittedByUid: '',
                        confirm: { state: 'WAIT', round: 1 } },
            water:    { status: 'DONE', date: '2026-06-30', photos: [doc('물순환사업소_시민재해_점검표.pdf')], submittedAt: '2026-06-30', submittedBy: '하정수', submittedByUid: 'u_wat3',
                        confirm: { state: 'OK', round: 1, by: '박안전', at: '2026-06-30' } },
            env:      { status: 'TODO', date: '2026-06-30', photos: [doc('환경과_시민재해_점검표.pdf')], submittedAt: '2026-06-30', submittedBy: '정수빈', submittedByUid: 'u_env5',
                        missText: '점검표 2번(공중화장실 안전점검 계획) — 하반기 계획 미수립',
                        plan: '8월까지 공중화장실 12개소 안전점검 계획 수립', planDue: '2026-08-31', needs: ['인력'],
                        confirm: { state: 'WAIT', round: 1 } }
        }
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
        var civ = civilDefaultTargets();
        return {
            dist: {
                'comply-industrial|2026-H1': { at: '2026-05-14', by: '박안전', due: '2026-06-30', ver: 1,
                    note: '부서장 서명 후 스캔본을 올려 주세요. 미이행 항목은 조치계획을 함께 적어 주세요.',
                    forms: [{ name: '2026년_상반기_중대산업재해_이행사항_자체점검표.hwpx', size: 88000 }], targets: all },
                'comply-citizen|2026-H1': { at: '2026-05-15', by: '박안전', due: '2026-06-30', ver: 1,
                    note: '공중이용시설을 관리하는 부서만 작성합니다. 부서장 서명 후 스캔본을 올려 주세요.',
                    forms: [{ name: '2026년_상반기_중대시민재해_이행사항_자체점검표.hwpx', size: 76000 }], targets: civ }
            },
            closed: {}
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
        return out;
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
                else if (p.tier === 'staff') mineTxt = '<b>우리 부서 줄의 결과 제출</b>만 합니다. 검토는 재난안전과가 합니다.';
                else if (p.tier === 'super' && p.deptId === own) mineTxt = '<b>조회</b>와 <b>전 부서 독촉</b>을 합니다. 결과 제출은 부서 담당자, 검토는 재난안전과 담당자·팀장이 합니다.';
                else if (p.tier === 'super') mineTxt = '<b>조회</b>와 <b>우리 부서 독촉</b>을 합니다. 결과 제출은 부서 담당자가 합니다.';
                else mineTxt = '<b>조회 전용입니다.</b> 결과 제출은 각 부서 담당자, 검토는 재난안전과가 합니다.';
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
                ((!st.exists || st.status !== ST.DONE) && canRemindRow(d.id)
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
              (st.submittedBy ? '<div class="dchk-sub">' + esc(st.submittedBy) + '' + '</div>' : '')
            : '<span class="dchk-none">-</span>';
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
            ? '결과 제출은 그 부서 담당자가 합니다 — 고칠 것이 있으면 [검토]에서 반려하세요.'
            : '결과 제출은 그 부서 담당자가 자기 부서 줄에서 합니다.');
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
                ((flow.dist.forms || []).length ? '<br>' + flow.dist.forms.map(function (f) { return '📎 ' + esc(f.name); }).join(' · ') + ' (제' + (flow.dist.ver || 1) + '판)' : '') +
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
                    '<input type="date" class="form-input" id="dchk-plandue" value="' + esc(F.planDue) + '" style="max-width:200px;">' +
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
                    null, { hint: true, multiple: true, pick: ns + '.addPhoto', style: 'padding:12px;' }) +
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
        if (!F || !canEdit(F.deptId, F.opts)) { denied(F && F.deptId); return; } capture(); F.status = v; renderModal(deptOf(F.deptId)); }
    function deptOf(id) { return depts().filter(function (x) { return x.id === id; })[0]; }
    function addPhoto(files) {
        if (!F || !canEdit(F.deptId, F.opts)) { denied(F && F.deptId); return; }
        capture();
        if (!files || !files.length) return;
        F.photos = F.photos.concat(files).slice(0, V().FILE_LIMITS.maxCount);
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
            Object.assign(patch, {
                missText: F.status === ST.TODO ? F.missText : '', plan: F.status === ST.TODO ? F.plan : '',
                prevAction: F.carry ? { state: F.carryState, text: F.carryText, period: F.carry.perLabel } : null,
                planDue: F.status === ST.TODO ? F.planDue : '',
                submittedAt: today(), submittedBy: p ? p.name : actor(), submittedByUid: p ? p.uid : '',
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
            '<div class="dchk-mrow"><label class="form-label" for="dchk-ret">반려 사유 <span class="dchk-sub">(반려할 때 필수 — 부서 담당자에게 알림으로 갑니다)</span></label>' +
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
        V().closeModal(); toast((deptOf(deptId) || {}).name + ' 반려 — 그 부서 담당자에게 알림을 보냈습니다');
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
        var n = remindTargets(key, opts && opts.flow).filter(function (d) { return remind(key, d.id, opts, true); }).length;
        V().closeModal();
        toast(n ? n + '개 부서에 결과 제출 독촉을 보냈습니다' : '독촉할 미제출 부서가 없습니다.');
        if (opts && opts.onChange) opts.onChange();
    }

    /* ================= 알림 =================
     * 받는 사람이 할 일이 있을 때만 보낸다(SCR-ADMIN-002 §4-1):
     *   제출 → 재난안전과 담당자(재난안전과 줄이면 팀장 포함) «검토 요청»
     *   반려 → 그 부서 담당자(없으면 부서장) «반려 — 사유»
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
        if (o.kind === 'remind') {
            L.ntfPush({ cat: 'compliance', catLabel: '이행', toDept: o.deptId, toTier: ['staff', 'super'],
                title: perLbl + ' 의무이행 자체점검 ' + o.what + (o.what === '반려 재제출 독촉' ? ' — 반려된 결과를 고쳐 다시 제출해 주세요' : ' — 결과를 제출해 주세요') + (o.due ? '(기한 ' + o.due + ')' : ''),
                href: href, work: 'my-work.html?cat=comply', basis: 'cse-5' });
            return;
        }
        if (o.kind === 'return') {
            L.ntfPush({ cat: 'compliance', catLabel: '이행', toDept: o.deptId, toTier: ['staff', 'super'],
                title: perLbl + ' 의무이행 점검 결과 반려 — ' + o.reason, href: href, work: 'my-work.html?cat=comply', basis: 'cse-5' });
        } else if (o.kind === 'submit') {
            L.ntfPush({ cat: 'compliance', catLabel: '이행', toDept: own, toTier: ['staff', 'super'],
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
        flow: FLOW, remindLog: function (key, deptId) { return ((fload().reminds || {})[key + '|' + deptId] || []).slice(); }, isTarget: isTarget, progressOf: progressOf, submitted: submitted, isOwnerStaff: isOwnerStaff,
        unsubmit: unsubmit, doUnsubmit: doUnsubmit,
        review: review, doConfirm: doConfirm, download: download, doReturn: doReturn, uncfm: uncfm, doUncfm: doUncfm
    };
})(window);
