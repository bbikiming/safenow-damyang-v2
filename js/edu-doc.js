/* =====================================================================
   edu-doc.js · 안전보건교육 공문 (전역 EDUDOC) — DYDOC 골격 위 도메인 파사드
   ---------------------------------------------------------------------
   골격(순서·지면·결재선·상신·확인)은 `js/doc-flow.js` 가 전부 갖고 있고,
   여기서는 **교육 고유의 것만** 얹는다 — 붙임 후보·별지·삽입 조각·저장 위치.
   근거: docs/planning/기획-안전보건교육-온나라결재상신-v1.md v1.2 ·
         SCR-EDU-001 §4-6 · SCR-EDU-004 §4-5

   ── 단위는 교육 1건뿐이다 ─────────────────────────────────────────
   기간 총괄과 개인별을 두지 않는다. 기간 단위 실시 결과 제출은 **업무 축(DYWORK)**
   이 이미 담당하고(6개년 440문서·34부서 실측), 개인 이수 확인서는 결재가 아니라
   **증명서**라 보고서·제증명 소관이다. 갈래가 하나면 담당자가 무엇을 고를지
   판단하지 않는다.

   ── 붙임은 이미 올려 둔 파일이다 ──────────────────────────────────
   발주처: "붙임 파일에 넣어놨었잖아요. 그러면은 끝나는 거죠."
   교육에 붙인 교육일지·교육사진과 부서가 참석자 등록부에 올린 서명파일이 후보다.
   **여기서 파일을 새로 받지 않는다** — 같은 증빙이 두 벌 생긴다.
   이수자 명단만 파일이 아니라 **별지**로 짠다(사람이 만들어 올리던 것을 대신).

   로드 순서: common.js → org-pick.js → edu-data.js → doc-flow.js → edu-doc.js
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var E = function () { return global.DYEDU; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }

    var SKEY = 'dy-edu-doc-v1';      /* 교육 공문 저장 */
    var LKEY = 'dy-edu-docline-v1';  /* 결재선 */

    /* ===================== 저장 ===================== */
    function store() {
        var d = null;
        try { d = JSON.parse(global.sessionStorage.getItem(SKEY) || 'null'); } catch (e) { d = null; }
        if (!d) d = { seq: 2600, docs: {} };
        if (!d.docs) d.docs = {};
        return d;
    }
    function save(d) { try { global.sessionStorage.setItem(SKEY, JSON.stringify(d)); } catch (e) {} }
    function docsOf(courseId) { return (store().docs[courseId] || []); }
    function pushDoc(courseId, doc) {
        var d = store();
        (d.docs[courseId] = d.docs[courseId] || []).push(doc);
        save(d);
        E().pushCourseHistory(courseId, {
            type: 'STATUS', at: V().today(),
            by: doc.dept, memo: '공문 온나라 상신 — ' + doc.title + ' (' + doc.no + ')'
        });
    }
    function nextNo() { var d = store(); d.seq = (d.seq || 2600) + 1; save(d); return '재난안전과-' + d.seq; }
    function latestDoc(courseId) { var a = docsOf(courseId); return a.length ? a[a.length - 1] : null; }

    /* 결재가 올라간 교육은 잠근다 — 판정은 여기 한 곳이다.
       반려는 고쳐서 다시 올리라는 뜻이므로 잠그지 않는다. */
    function lockOf(courseId) {
        var d = latestDoc(courseId);
        if (!d) return null;
        return (d.status === '결재중' || d.status === '결재완료') ? d.status : null;
    }

    /* ===================== 교육 파생 ===================== */
    function courseOf(id) { return E().courseOf(id); }
    function enrollsOf(id) { return E().enrolls(id) || []; }
    function recordsOf(id) {
        return E().records().filter(function (r) { return r.courseId === id; });
    }
    function attendees(id) {
        return recordsOf(id).map(function (r) {
            var w = E().workerOf(r.workerId);
            return w ? { name: w.name, dept: E().deptName(w.deptId), hours: r.hours || 0, date: r.date } : null;
        }).filter(Boolean);
    }

    /* ===================== DYDOC 설정 ===================== */
    var T = global.DYDOC.define({
        ns: 'EDUDOC', lkey: LKEY, skey: SKEY,

        targetOf: function (id) { return courseOf(id); },
        subjectOf: function (c) { return c ? c.desc : ''; },
        titleOf: function (c) {
            if (!c) return '';
            var y = String(c.date || '').slice(0, 4);
            return y + '년 안전보건교육 실시 결과 보고 — ' + c.desc;
        },

        /* **종료 처리된 교육에만** 연다. 진행 중인 교육의 실시 결과는 보고할 수 없다.
           이수율은 조건이 아니다 — 전원 이수를 요구하면 이수율이 낮은 부서가 실시
           결과를 영영 보고하지 못한다(실측 38~56%). 미이수는 결과의 일부로 적는다. */
        ready: function (c) {
            if (!c) return { ok: false, why: '교육을 찾지 못했습니다.' };
            if (c.status !== 'DONE') return { ok: false, why: '교육 종료 처리 후에 기안할 수 있습니다.' };
            return { ok: true };
        },

        /* 본문 삽입 조각 — 문장을 지어내지 않고 **수치만** 건넨다 */
        chips: function (c) {
            if (!c) return [];
            var recs = recordsOf(c.id), en = enrollsOf(c.id);
            var depts = en.length;
            var people = recs.length;
            var hours = c.hours || 0;
            return [
                { label: '교육 개요', text: '1. 교육명: ' + c.desc + '\n2. 일시: ' + E().courseDateTime(c) + ' (' + hours + '시간)\n3. 장소: ' + (c.place || '-') + '\n4. 강사: ' + (c.instructor || '-') },
                { label: '실시 결과 (' + depts + '개 부서 · ' + people + '명)', text: '5. 실시 결과: ' + depts + '개 부서 ' + people + '명이 이수하였습니다.' },
                { label: '근거 문구', text: '「산업안전보건법」 제29조에 따른 근로자 안전보건교육을 위와 같이 실시하였기에 보고합니다.' }
            ];
        },

        /* 붙임 후보 — 이미 올려 둔 파일만. 새로 받지 않는다. */
        attachOf: function (c) {
            if (!c) return [];
            var out = [];
            (c.files || []).forEach(function (f) {
                out.push({ label: f.name, meta: f.slot || '교육 첨부' });
            });
            enrollsOf(c.id).forEach(function (e) {
                if (e.signFile) out.push({ label: e.signFile, meta: E().deptName(e.deptId) + ' 참석자 서명부' });
            });
            return out;
        },

        /* 붙임 별지 — 이수자 명단. 표준 공문은 큰 표를 본문에 넣지 않는다. */
        annexes: function (c, doc) {
            if (!c) return [];
            var list = attendees(c.id);
            if (!list.length) return [];
            return [{
                title: '이수자 명단 (' + list.length + '명)',
                html: '<table class="table-figma table-doc"><thead><tr>' +
                        '<th>연번</th><th>부서</th><th>성명</th><th>이수시간</th><th>이수일</th>' +
                      '</tr></thead><tbody>' +
                    list.map(function (w, i) {
                        return '<tr><td>' + (i + 1) + '</td><td>' + esc(w.dept) + '</td><td>' + esc(w.name) + '</td>' +
                            '<td>' + w.hours + 'h</td><td>' + esc(w.date) + '</td></tr>';
                    }).join('') + '</tbody></table>'
            }];
        },

        /* 법령 근거 — 담당자가 고른 것만 지면에 실린다. 안 고르면 절 자체가 사라진다.
           근거 문자열을 여기 하드코딩하지 않고 DYLAW 에서 가져온다(§10). */
        basisOf: function () {
            var L = global.DYLAW;
            if (!L || !L.basisTitle) return [];
            /* 라벨은 DYLAW 가 만든다 — 화면이 조문 표기를 조립하면 표기가 갈린다(§10) */
            return ['osh-29', 'oshr-t4'].map(function (k) {
                var t = L.basisTitle(k);
                return t ? { key: k, label: t } : null;
            }).filter(Boolean);
        },

        save: function (c, doc) { pushDoc(c.id, doc); },
        docsFor: function (c) { return c ? docsOf(c.id) : []; },
        nextNo: nextNo,
        lockNote: '상신 후에는 이 교육의 정보·대상자·이수기록을 수정하거나 삭제할 수 없습니다.'
    });

    /* 목록·상세가 쓰는 표시 컨트롤 — 종료 처리된 교육에만 나타난다 */
    function control(courseId) {
        var c = courseOf(courseId);
        if (!c || c.status !== 'DONE') return '';
        var d = latestDoc(courseId);
        if (!d) {
            return '<button type="button" class="btn btn-outline btn-sm" data-tour="edu-doc"' +
                ' onclick="EDUDOC.open(\'' + esc(courseId) + '\')">공문 기안</button>';
        }
        return '<span class="chip-status chip-sm ' + V().toneOf(d.status) + '">' + esc(d.status) + '</span> ' +
            '<button type="button" class="btn btn-outline btn-sm" onclick="EDUDOC.openDoc(\'' + esc(courseId) + '\',\'' + esc(d.sid) + '\')">문서 보기</button>';
    }

    T.control = control;
    T.lockOf = lockOf;
    T.docsOf = docsOf;
    T.latestDoc = latestDoc;
    T.reset = function () { try { global.sessionStorage.removeItem(SKEY); } catch (e) {} };
})(window);
