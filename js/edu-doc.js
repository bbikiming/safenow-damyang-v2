/* =====================================================================
   edu-doc.js · 안전보건교육 공문 (전역 EDUDOC) — DYDOC 골격 위 도메인 파사드
   ---------------------------------------------------------------------
   골격(순서·지면·확인·온나라로 보내기)은 `js/doc-flow.js` 가 갖고 있고 **고치지 않는다**.
   여기서는 교육 고유의 것만 얹는다 — 대상·붙임 후보·별지·삽입 조각·권한·저장.
   근거: docs/planning/기획-안전보건교육-전메뉴-온나라연계·출장결과보고-20261116-v2.md

   ── 과정마다 공문 한 번 (2026-11-16 임영준 주무관 통화) ─────────────────
   «결과 공문만 끝났다 이것만 하는 게 아니라 그 과정들도 다 문서 대장에 등록이 다 돼야 돼요»
     ① 교육 안내(N)          재난안전과 → 대상 부서 · 집합교육 등록 직후 (변경·취소 안내 포함)
     ② 참석자 등록부 제출(E)  부서 → 재난안전과 · 등록부 저장 직후
     ③ 출장 결과 보고(T)      재난안전과 내부결재 · 교육이 끝난 날부터
     ④ 분기 실시 결과 보고(Q) 부서 → 재난안전과 · 부서 × 분기 한 장(자체·기타·채용시)
     (이전 방식) 실시 결과 공문(교육 id 키) — 새로 만들지 않는다. 반려·반송된 것만 다시 보낸다.
   **기록을 올린 부서가 그 공문을 보낸다** — 재난안전과가 남의 부서 공문을 대신 기안하지 않는다.
   공문 한 정의 · 대상 키 `종류|…` 로 다섯 공문을 싣는다(위험성평가 요청 공문 RSKREQ 와 같은 방식).
   저장은 교육 스토어(DYEDU docs) 한 곳 — 공문 모듈을 싣지 않는 내 할일·대시보드도 같은 판정을 본다.

   ── 붙임은 이미 올려 둔 파일이다 ──────────────────────────────────
   여기서 파일을 새로 받지 않는다(같은 증빙이 두 벌 생긴다). 방금 올린 파일은 미리 체크한다.

   로드 순서: common.js → org-pick.js → edu-data.js → doc-flow.js → edu-doc.js
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var E = function () { return global.DYEDU; };
    var R = function () { return global.DYROLE; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }

    var LKEY = 'dy-edu-docline-v1';  /* 결재선(단순 기안이라 쓰지 않지만 골격 계약) */
    var KIND_LABEL = { NOTICE: '교육 안내', ENROLL: '참석자 등록부 제출', TRIP: '출장 결과 보고', QUARTER: '분기 실시 결과 보고', RESULT: '실시 결과(이전 방식)' };

    /* ===================== 대상 ===================== */
    function parse(key) {
        var k = String(key || ''), p = k.split('|');
        if (p[0] === 'N') return { key: k, kind: 'NOTICE', c: E().courseOf(p[1]) };
        if (p[0] === 'E') return { key: k, kind: 'ENROLL', c: E().courseOf(p[1]), deptId: p[2] };
        if (p[0] === 'T') return { key: k, kind: 'TRIP', c: E().courseOf(p[1]) };
        if (p[0] === 'Q') return { key: k, kind: 'QUARTER', deptId: p[1], q: p[2] };
        return { key: k, kind: 'RESULT', c: E().courseOf(k) };
    }
    function targetOf(key) {
        var t = parse(key);
        if (t.kind === 'QUARTER') { t.list = qList(t); return t; }
        if (!t.c) return null;
        if (t.kind === 'ENROLL') t.enroll = E().enrolls(t.c.id).filter(function (e) { return e.deptId === t.deptId; })[0] || null;
        if (t.kind === 'NOTICE') t.sub = t.c.status === 'CANCELLED' ? '취소' : (t.c.noticeDirty ? '변경' : '');
        return t;
    }
    /* 분기 보고에 실리는 교육 — 보낸 보고는 보낼 때 고정한 목록(courseIds), 쓰는 중이면 지금 남은 건 */
    function qList(t, doc) {
        if (doc && doc.courseIds) return doc.courseIds.map(function (id) { return E().courseOf(id); }).filter(Boolean);
        var r = E().reportQuarterFor(t.deptId);
        return r.q === t.q ? r.list : E().pendingReportCourses(t.deptId, t.q);
    }
    function deptName(id) { return E().deptName(id); }
    function josa(w, a, b) { return V().josa ? V().josa(w, a, b) : a + '(' + b + ')'; }

    /* ===================== 권한 ===================== */
    var OWNER_WHY = '이 공문은 재난안전과 담당자가 보냅니다.';
    function roNote() {
        var p = R() && R().current ? R().current() : null;
        return p && p.tier !== 'staff' ? '관리·감독 계층은 공문을 조회만 합니다 — ' : '';
    }
    function canDraft(t) {
        if (!t) return { ok: false, why: '대상을 찾지 못했습니다.' };
        if (t.kind === 'ENROLL' || t.kind === 'QUARTER') {
            if (E().canActOwnDept(t.deptId)) return { ok: true };
            return { ok: false, why: roNote() + deptName(t.deptId) + ' 공문은 ' + deptName(t.deptId) + ' 담당자가 보냅니다.' };
        }
        if (E().isOwnerStaff()) return { ok: true };
        return { ok: false, why: roNote() + OWNER_WHY };
    }

    /* ===================== 기안 조건 ===================== */
    function ready(t) {
        if (!t) return { ok: false, why: '대상을 찾지 못했습니다.' };
        var st = E().docState(t.key);
        if (st === 'sent' && !(t.kind === 'NOTICE' && t.c && t.c.noticeDirty)) return { ok: false, why: '이 공문은 이미 온나라로 보냈습니다.' };
        if (t.kind === 'RESULT') {
            /* 이전 방식 공문은 새로 만들지 않는다 — 반려·반송된 것만 고쳐 다시 보낸다 */
            return st === 'returned' ? { ok: true } : { ok: false, why: '실시 결과 공문은 이제 출장 결과 보고(집합교육)와 분기 실시 결과 보고(부서 교육)로 보냅니다.' };
        }
        if (t.kind === 'NOTICE') {
            if (!E().isFlow2(t.c)) return { ok: false, why: '이 교육은 이전 방식이라 안내 공문이 이미 나갔습니다.' };
            if (t.c.status === 'DONE') return { ok: false, why: '종료된 교육입니다.' };
            if (t.c.status === 'CANCELLED' && t.c.noticeDirty !== '취소') return { ok: false, why: '취소 안내가 필요하지 않은 교육입니다.' };
            return { ok: true };
        }
        if (t.kind === 'ENROLL') {
            if (!t.enroll) return { ok: false, why: '먼저 참석자 등록부를 저장하세요.' };
            if (t.enroll.flow !== 2) return { ok: false, why: '이전 방식으로 낸 등록부라 공문이 필요하지 않습니다.' };
            return { ok: true };
        }
        if (t.kind === 'TRIP') return t.c.trip ? { ok: true } : { ok: false, why: '먼저 출장 결과 보고서(교육 자료 · 교육 사진 · 참석 인원)를 저장하세요.' };
        if (t.kind === 'QUARTER') return t.list.length ? { ok: true } : { ok: false, why: '이 분기에 보고할 교육이 없습니다.' };
        return { ok: false };
    }

    /* ===================== 제목 · 수신 · 안내 ===================== */
    function yearOf(c) { return String((c && c.date) || V().today()).slice(0, 4); }
    /* 교육 제목에 이미 연도가 있으면 다시 붙이지 않는다(«2026 2026년 …» 방지) */
    function withYear(c, text) { var y = yearOf(c); return /^\s*\d{4}/.test(text) ? text : y + ' ' + text; }
    function titleOf(t) {
        if (!t) return '';
        if (t.kind === 'NOTICE') return withYear(t.c, t.c.desc) + ' 집합교육 ' + (t.sub === '취소' ? '취소 안내' : t.sub === '변경' ? '변경 안내' : '실시 안내');
        if (t.kind === 'ENROLL') return t.c.desc + ' 참석자 등록부 제출(' + deptName(t.deptId) + ')';
        if (t.kind === 'TRIP') return t.c.desc + ' 출장 결과 보고';
        if (t.kind === 'QUARTER') return E().quarterLabel(t.q) + ' 안전보건교육 실시 결과 보고(' + deptName(t.deptId) + ')';
        return yearOf(t.c) + '년 안전보건교육 실시 결과 보고 — ' + t.c.desc;
    }
    function subjectOf(t) {
        if (!t) return '';
        return KIND_LABEL[t.kind] + ' — ' + (t.kind === 'QUARTER' ? deptName(t.deptId) + ' ' + E().quarterLabel(t.q) : t.c.desc);
    }
    var NOTICE_LINE = {
        NOTICE: '✓ 교육을 저장했습니다 — 이 안내 공문을 온나라로 보내야 대상 부서에 교육이 알려집니다.',
        ENROLL: '✓ 참석자 등록부는 저장돼 있습니다 — 이 공문을 온나라로 보내야 등록이 끝납니다.',
        TRIP: '✓ 출장 결과 보고서를 저장했습니다 — 이 공문을 온나라로 보내야 보고가 끝납니다.',
        QUARTER: '', RESULT: ''
    };
    function initOf(t) {
        if (!t) return {};
        var o = {};
        if (t.kind === 'NOTICE' || t.kind === 'ENROLL' || t.kind === 'QUARTER') { o.docType = '외부발송'; o.to = '수신자 참조'; }
        var lead = NOTICE_LINE[t.kind] || '';
        if (t.kind === 'NOTICE' && t.sub) lead = '교육을 ' + (t.sub === '취소' ? '취소' : '변경') + '했습니다 — 이미 안내를 받은 부서에 ' + t.sub + ' 안내 공문을 보냅니다.';
        if (t.kind === 'QUARTER') {
            var cnt = {}; t.list.forEach(function (c) { var k = E().kindLabel(c.kind); cnt[k] = (cnt[k] || 0) + 1; });
            var noEv = t.list.filter(function (c) { return !(c.files && c.files.length); }).length;
            lead = E().quarterLabel(t.q) + ' · 실린 교육 ' + t.list.length + '건(' + Object.keys(cnt).map(function (k) { return k + ' ' + cnt[k]; }).join(' · ') + ') — 목록은 미리보기 별지에서 봅니다. 잘못 등록한 건은 보내기 전에 그 화면에서 고치거나 지웁니다.' +
                (noEv ? ' 교육일지·사진이 없는 건 ' + noEv + '건.' : '');
        }
        o.notice = lead;
        var d = E().latestAt(t.key);
        if (d && (d.status === '반려' || d.status === '반송')) {
            o.title = d.title; o.body = d.body || '';
            o.notice = '앞서 보낸 공문이 ' + d.status + '되었습니다' + (d.rejectReason ? ' — 사유: ' + d.rejectReason : '') + '. 앞 기안의 제목·본문을 이어 왔습니다. 고친 뒤 다시 보냅니다.';
        }
        return o;
    }
    function recipientsOf(t, doc) {
        if (!t) return [];
        if (t.kind === 'NOTICE') return E().noticeRecipients(t.c).map(function (id) { return deptName(id) + '장'; });
        if (t.kind === 'ENROLL' || t.kind === 'QUARTER') return [deptName((R() && R().OWNER_DEPT) || 'safety') + '장'];
        return [];
    }

    /* ===================== 삽입 조각 — 문장을 지어내지 않고 수치만 ===================== */
    function overview(c) {
        return '1. 교육명: ' + c.desc + '\n2. 일시: ' + E().courseDateTime(c) + ' (' + (c.hours || 0) + '시간)\n3. 장소: ' + (c.place || '-') + '\n4. 강사: ' + (c.instructor || '-');
    }
    function basisText() {
        var L = global.DYLAW;
        var t = L && L.shortRef ? L.shortRef('osh-29') : '';
        return t ? t + '에 따른 근로자 안전보건교육' : '근로자 안전보건교육';
    }
    function chips(t) {
        if (!t) return [];
        if (t.kind === 'NOTICE') {
            var rc = E().noticeRecipients(t.c);
            return [
                { label: '교육 개요', text: overview(t.c) },
                { label: '참석 대상 (' + rc.length + '개 부서)', text: '5. 참석 대상: ' + (t.c.kind === 'SUP_REG' ? '관리감독자' : '현업근로자') + ' — ' + rc.map(deptName).join(', ') },
                { label: '등록부 제출 안내', text: '6. 교육이 끝나면 각 부서는 ' + E().enrollDue(t.c) + '까지 참석자 등록부(참석자 · 실제 참석시간 · 서명부)를 시스템에 올리고 제출 공문을 보내 주시기 바랍니다.' },
                { label: '근거 문구', text: basisText() + '을 위와 같이 실시하오니 참석하여 주시기 바랍니다.' }
            ].concat(t.sub ? [{ label: t.sub + ' 문구', text: t.sub === '취소' ? '위 교육은 사정으로 취소되었음을 알려 드립니다.' + (t.c.cancelReason ? ' (사유: ' + t.c.cancelReason + ')' : '') : '앞서 안내한 교육의 일시·장소가 아래와 같이 바뀌었음을 알려 드립니다.' }] : []);
        }
        if (t.kind === 'ENROLL') {
            var e = t.enroll || { workerIds: [] };
            var h = e.actualHours == null ? t.c.hours : e.actualHours;
            return [
                { label: '교육 개요', text: overview(t.c) },
                { label: '참석 결과 (' + (e.workerIds || []).length + '명)', text: '5. 참석 결과: ' + deptName(t.deptId) + ' ' + (e.workerIds || []).length + '명 참석 · 실제 참석 ' + h + '시간' },
                { label: '제출 문구', text: '위 교육의 참석자 등록부를 붙임과 같이 제출합니다.' }
            ];
        }
        if (t.kind === 'TRIP') {
            var tr = t.c.trip || {};
            return [
                { label: '교육 개요', text: overview(t.c) },
                { label: '참석 인원 (' + (tr.headcount || 0) + '명)', text: '5. 참석 인원: 약 ' + (tr.headcount || 0) + '명' },
                { label: '보고 문구', text: '위 교육에 출장하여 실시한 결과를 붙임과 같이 보고합니다.' }
            ];
        }
        if (t.kind === 'QUARTER') {
            var cnt = {}, people = 0, hours = 0;
            t.list.forEach(function (c) {
                var k = E().kindLabel(c.kind); cnt[k] = (cnt[k] || 0) + 1;
                E().records().forEach(function (r) { if (r.courseId === c.id) { people++; hours += +r.hours || 0; } });
            });
            return [
                { label: '실시 개요 (' + t.list.length + '건)', text: '1. ' + E().quarterLabel(t.q) + ' ' + deptName(t.deptId) + ' 안전보건교육 실시: ' + t.list.length + '건(' + Object.keys(cnt).map(function (k) { return k + ' ' + cnt[k] + '건'; }).join(', ') + ')' },
                { label: '이수 결과 (' + people + '명)', text: '2. 이수 결과: 연인원 ' + people + '명 · 이수시간 합계 ' + (Math.round(hours * 10) / 10) + '시간' },
                { label: '근거 문구', text: basisText() + '을 위와 같이 실시하였기에 그 결과를 보고합니다.' },
                { label: '증빙 보관 문구', text: '※ 교육일지·사진 원본은 안전보건관리 시스템에 보관합니다.' }
            ];
        }
        /* 이전 방식 */
        var recs = E().records().filter(function (r) { return r.courseId === t.c.id; });
        return [{ label: '교육 개요', text: overview(t.c) }, { label: '실시 결과 (' + recs.length + '명)', text: '5. 실시 결과: ' + recs.length + '명이 이수하였습니다.' }];
    }

    /* ===================== 붙임 후보 · 별지 ===================== */
    function fileItem(f, meta, on) { return { label: f.name, meta: meta, size: f.size || null, on: !!on }; }
    function attachOf(t) {
        if (!t) return [];
        if (t.kind === 'NOTICE') return (t.c.files || []).map(function (f) { return fileItem(f, E().slotLabel(f.slot), true); });
        if (t.kind === 'ENROLL') {
            var e = t.enroll; if (!e) return [];
            var name = e.signFrom === 'course' ? (t.c.signSheet && t.c.signSheet.file) : e.signFile;
            return name ? [{ label: name, meta: e.signFrom === 'course' ? '재난안전과가 올린 서명부' : deptName(t.deptId) + ' 참석자 서명부', on: true }] : [];
        }
        if (t.kind === 'TRIP') return ((t.c.trip && t.c.trip.files) || []).map(function (f) { return fileItem(f, f.slot === 'photo' ? '교육 사진' : '교육 자료', true); });
        if (t.kind === 'QUARTER') {
            var out = [];
            t.list.forEach(function (c) { (c.files || []).forEach(function (f) { out.push(fileItem(f, E().kindLabel(c.kind) + ' · ' + (c.date || ''), false)); }); });
            return out;
        }
        return (t.c.files || []).map(function (f) { return fileItem(f, E().slotLabel(f.slot), false); });
    }
    function table(head, rows) {
        return '<table class="table-figma table-doc"><thead><tr>' + head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
            rows.map(function (r) { return '<tr>' + r.map(function (x) { return '<td>' + esc(x) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
    }
    function attendeesOf(cid, deptId) {
        return E().records().filter(function (r) {
            if (r.courseId !== cid) return false;
            var w = E().workerOf(r.workerId); return w && (!deptId || w.deptId === deptId);
        }).map(function (r) { var w = E().workerOf(r.workerId); return { name: E().personLabel(w.id), dept: deptName(w.deptId), hours: r.hours || 0, date: r.date }; });
    }
    /* 분기 보고 별지 — 보낼 때 수치를 고정한다(보낸 뒤 이수 정정이 생겨도 나간 보고서 숫자는 그대로) */
    function quarterSnap(list) {
        return {
            rows: list.map(function (c, i) {
                var recs = E().records().filter(function (r) { return r.courseId === c.id; });
                var tgt = E().enrolls(c.id).reduce(function (n, e) { return n + (e.workerIds || []).length; }, 0);
                return [String(i + 1), E().kindLabel(c.kind) + (c.etcType ? ' · ' + c.etcType : ''), c.desc, c.date || '', (c.hours || 0) + 'h', tgt + '명', recs.length + '명', (c.files && c.files.length) ? '있음' : '없음'];
            }),
            people: [].concat.apply([], list.map(function (c) { return attendeesOf(c.id).map(function (a) { return [a.dept, a.name, c.desc, a.hours + 'h', a.date]; }); }))
        };
    }
    function annexes(t, doc) {
        if (!t) return [];
        if (t.kind === 'NOTICE' || t.kind === 'TRIP') return [];
        if (t.kind === 'ENROLL') {
            var list = (t.enroll ? t.enroll.workerIds : []).map(function (wid) {
                var w = E().workerOf(wid); return w ? [deptName(w.deptId), E().personLabel(w.id), E().catLabel(w.category)] : null;
            }).filter(Boolean);
            if (!list.length) return [];
            return [{ title: '참석자 명단 (' + list.length + '명)', html: table(['연번', '부서', '성명', '구분'], list.map(function (r, i) { return [String(i + 1)].concat(r); })) }];
        }
        if (t.kind === 'QUARTER') {
            var snap = (doc && doc.snap) || quarterSnap(t.list);
            return [
                { title: '분기 실시 실적표 (' + snap.rows.length + '건)', html: table(['연번', '구분', '교육명', '교육일', '시간', '대상', '이수', '교육일지·사진'], snap.rows) },
                { title: '이수자 명단 (' + snap.people.length + '명)', html: table(['부서', '성명', '교육', '이수시간', '이수일'], snap.people) }
            ];
        }
        var att = attendeesOf(t.c.id);
        if (!att.length) return [];
        return [{ title: '이수자 명단 (' + att.length + '명)', html: table(['부서', '성명', '이수시간', '이수일'], att.map(function (a) { return [a.dept, a.name, a.hours + 'h', a.date]; })) }];
    }
    function basisOf() {
        var L = global.DYLAW;
        if (!L || !L.basisTitle) return [];
        return ['osh-29', 'oshr-t4'].map(function (k) { var x = L.basisTitle(k); return x ? { key: k, label: x } : null; }).filter(Boolean);
    }

    /* ===================== 저장 — 보내는 순간의 효과 ===================== */
    function myDeptName() {
        var p = R() && R().current ? R().current() : null;
        return (p && p.deptName) || '재난안전과';
    }
    function nextNo() { return myDeptName() + '-' + E().nextDocSeq(); }
    function hist(cid, memo) {
        if (!cid) return;
        E().pushCourseHistory(cid, { type: 'STATUS', at: E().nowTs ? E().nowTs() : V().today(), by: R() && R().actorLabel ? R().actorLabel() : myDeptName(), memo: memo });
    }
    function notifyCancel(c) {
        var L = global.DYLayout; if (!L || !L.ntfPush) return;
        E().noticeRecipients(c).forEach(function (d) {
            try { L.ntfPush({ cat: 'edu', catLabel: '교육', toDept: d, title: '집합교육 취소 안내 — ' + c.desc, href: 'edu-reg-detail.html?id=' + encodeURIComponent(c.id), work: 'my-work.html', basis: 'osh-29' }); } catch (e) {}
        });
    }
    function saveDoc(t, doc) {
        doc.kind = t.kind;
        if (t.deptId) doc.deptId = t.deptId;
        if (t.kind === 'NOTICE') doc.sub = t.sub || '';
        if (t.kind === 'QUARTER') {
            doc.q = t.q;
            doc.courseIds = t.list.map(function (c) { return c.id; });
            doc.snap = quarterSnap(t.list);
        }
        E().pushDocAt(t.key, doc);
        var label = KIND_LABEL[t.kind];
        if (t.kind === 'QUARTER') {
            t.list.forEach(function (c) { hist(c.id, label + ' 공문에 실어 온나라로 보냄 — ' + doc.title + ' (' + doc.no + ')'); });
        } else if (t.c) {
            hist(t.c.id, label + (t.sub ? '(' + t.sub + ')' : '') + ' 공문 온나라로 보냄 — ' + doc.title + ' (' + doc.no + ')');
        }
        if (t.kind === 'NOTICE') {
            var sub = t.sub;
            if (t.c.noticeDirty) E().updateCourse(t.c.id, { noticeDirty: '' });
            if (sub === '취소') notifyCancel(t.c);
            else if (E().notifyUpcoming) E().notifyUpcoming(t.c.id, sub);
        }
    }

    /* 지금 열린 공문 — 확인 문구·결과 문구가 종류를 따라간다(골격은 cfg 값을 그 자리에서 읽는다) */
    var CUR = null;
    var LOCK_NOTE = {
        NOTICE: '보낸 뒤 일시·장소를 바꾸면 변경 안내 공문을 다시 보냅니다. 교육 전에는 [교육 취소]로 취소 안내를 보냅니다.',
        ENROLL: '보낸 뒤에는 이 부서 등록부를 취소·정정할 수 없습니다 — 온나라에서 반려·반송되면 다시 열립니다.',
        TRIP: '보낸 뒤에는 출장 결과 보고서를 고칠 수 없습니다 — 온나라에서 반려·반송되면 다시 열립니다.',
        QUARTER: '보낸 뒤에는 실린 교육을 수정·삭제할 수 없습니다. 그 뒤 등록한 교육은 다음 보고에 «추가분»으로 실립니다.',
        RESULT: '보낸 뒤에는 이 교육의 정보·대상자·이수기록을 수정·삭제할 수 없습니다.'
    };
    var SENT_NOTE = {
        NOTICE: '교육 안내 공문을 온나라 연계기안함에 보냈습니다. 대상 부서 내 할일에 예정 교육이 보입니다.',
        ENROLL: '참석자 등록부 제출 공문을 온나라 연계기안함에 보냈습니다. 이 교육의 우리 부서 할 일이 끝났습니다.',
        TRIP: '출장 결과 보고 공문을 온나라 연계기안함에 보냈습니다.',
        QUARTER: '분기 실시 결과 보고 공문을 온나라 연계기안함에 보냈습니다. 실린 교육을 잠갔습니다.',
        RESULT: '실시 결과 공문을 온나라 연계기안함에 보냈습니다.'
    };
    var cfg = {
        ns: 'EDUDOC', lkey: LKEY,
        /* 결재선 없이 «온나라로 보내기» — 온나라 기안함까지만(운영 결정 2026-11-06). 붙임은 이미 올린 파일에서 고른다 */
        simple: true, simplePick: true,
        initOf: initOf, recipientsOf: recipientsOf,
        targetOf: targetOf, subjectOf: subjectOf, titleOf: titleOf,
        ready: ready, canDraft: canDraft, chips: chips, attachOf: attachOf, annexes: annexes, basisOf: basisOf,
        save: saveDoc,
        docsFor: function (t) { return t ? E().docsAt(t.key) : []; },
        nextNo: nextNo
    };
    Object.defineProperty(cfg, 'lockNote', { get: function () { return LOCK_NOTE[(CUR && CUR.kind) || 'RESULT']; } });
    Object.defineProperty(cfg, 'sentNote', { get: function () { return SENT_NOTE[(CUR && CUR.kind) || 'RESULT']; } });
    var T = global.DYDOC.define(cfg);
    var baseOpen = T.open, baseOpenDoc = T.openDoc;
    T.open = function (key) { CUR = parse(key); baseOpen(key); };
    T.openDoc = function (key, sid) { CUR = parse(key); baseOpenDoc(key, sid); };

    /* ===================== 화면이 쓰는 표시 조각 ===================== */
    function q(s) { return esc(s).replace(/'/g, '&#39;'); }
    /* 공문 한 줄 — 미기안이면 [보내기] 버튼(권한이 있을 때) · 보냈으면 상태 칩 + [문서 보기] · 돌아왔으면 사유 + [다시 보내기] */
    function ctl(key, label, opts) {
        opts = opts || {};
        var t = targetOf(key); if (!t) return '';
        var d = E().latestAt(key), perm = canDraft(t);
        var btnCls = opts.primary ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';
        var tour = opts.tour ? ' data-tour="' + esc(opts.tour) + '"' : '';
        if (!d) {
            if (!perm.ok) return opts.quiet ? '' : '<span class="file-hint">' + esc(perm.why) + '</span>';
            var rd = ready(t);
            if (!rd.ok) return opts.quiet ? '' : '<span class="file-hint">' + esc(rd.why) + '</span>';
            return '<button type="button" class="' + btnCls + '"' + tour + ' onclick="EDUDOC.open(\'' + q(key) + '\')">' + esc(label) + '</button>';
        }
        var chip = '<span class="chip-status chip-sm ' + V().toneOf(d.status) + '">' + esc((opts.short || KIND_LABEL[t.kind]) + ' ' + d.status) + '</span>';
        var view = ' <button type="button" class="btn btn-outline btn-sm" onclick="EDUDOC.openDoc(\'' + q(key) + '\',\'' + q(d.sid) + '\')">문서 보기</button>';
        if ((d.status === '반려' || d.status === '반송') && perm.ok) {
            return chip + view + ' <button type="button" class="btn btn-primary btn-sm" onclick="EDUDOC.open(\'' + q(key) + '\')">다시 보내기</button>' +
                (d.rejectReason ? ' <span class="file-hint">' + esc(d.status) + ' 사유: ' + esc(d.rejectReason) + '</span>' : '');
        }
        /* 변경·취소 안내가 필요한 교육 — 보낸 안내 옆에 다음 안내 버튼 */
        if (t.kind === 'NOTICE' && t.c.noticeDirty && perm.ok) {
            return chip + view + ' <button type="button" class="btn btn-primary btn-sm" onclick="EDUDOC.open(\'' + q(key) + '\')">' + (t.c.noticeDirty === '취소' ? '취소' : '변경') + ' 안내 공문 보내기</button>';
        }
        return chip + view;
    }
    /* 이전 방식 교육의 표시 — 보낸 실시 결과 공문을 보이고, 반려·반송이면 다시 보낸다. 새 교육(flow 2)에는 쓰지 않는다 */
    function control(courseId) {
        var c = E().courseOf(courseId);
        if (!c || E().isFlow2(c)) return '';
        if (!E().latestAt(courseId)) return '';
        return ctl(courseId, '다시 보내기', { short: '실시 결과' });
    }
    /* 이 교육 건 기록의 잠금 — 이전 방식 실시 결과 공문 · 분기 보고에 실려 나감. 집합교육 새 흐름은 교육 전체를 잠그지 않는다
       (등록부는 부서마다 enrollLock, 회차는 sessionLock). 호출부 다섯 곳(목록·상세·채용시·기타·등록부 저장)이 이 뜻으로 쓴다 */
    function lockOf(courseId) {
        var c = E().courseOf(courseId);
        if (c && E().isFlow2(c)) return E().isDeptRun(c) ? E().reportLock(courseId) : null;
        return E().lockAt(courseId);
    }
    function latestDoc(courseId) { return E().latestAt(courseId); }

    /* ===================== 독촉 — 부서 줄마다 하나 · 문구는 단계에 맞춰 ===================== */
    function remindDept(deptId, what, ref) {
        var Rr = R();
        if (Rr && Rr.canRemind && !Rr.canRemind(deptId)) { toast(Rr.remindDenyNote ? Rr.remindDenyNote() : '독촉할 수 없습니다.'); return false; }
        var msg = { apply: '참석자 등록부를 올려 주세요', enrollDoc: '참석자 등록부 제출 공문을 보내 주세요', quarter: '분기 실시 결과 보고를 보내 주세요' }[what] || '처리해 주세요';
        var L = global.DYLayout;
        var title = '[독촉] ' + msg + (ref && ref.title ? ' — ' + ref.title : '');
        try { if (L && L.ntfPush) L.ntfPush({ cat: 'edu', catLabel: '교육', toDept: deptId, title: title, href: ref && ref.href || 'my-work.html', work: 'my-work.html', basis: 'osh-29' }); } catch (e) {}
        var d = E().load(); d.docRemind = d.docRemind || [];
        d.docRemind.push({ at: E().nowTs(), by: Rr && Rr.actorLabel ? Rr.actorLabel() : '재난안전과', deptId: deptId, what: what, ref: ref && ref.key || '' });
        E().save();
        if (ref && ref.courseId) hist(ref.courseId, '독촉 — ' + deptName(deptId) + ' · ' + msg);
        var who = global.DYADM && global.DYADM.contactText ? global.DYADM.contactText(deptId) : deptName(deptId) + ' 담당자';
        toast(deptName(deptId) + '에 독촉을 보냈습니다 — 받는 사람 ' + who);
        return true;
    }
    function remindCount(deptId, refKey) {
        return (E().load().docRemind || []).filter(function (r) { return r.deptId === deptId && (!refKey || r.ref === refKey); }).length;
    }

    /* ===================== ④ 분기 보고 띠 — 여섯 화면 공용 ===================== */
    function me() { return R() && R().current ? R().current() : null; }
    function quarterBar() {
        var p = me(); if (!p) return '';
        var own = (R() && R().OWNER_DEPT) || 'safety';
        var html = '';
        var r = E().reportQuarterFor(p.deptId);
        if (r.list.length || E().docState(E().keyQuarter(p.deptId, r.q)) !== 'none') {
            var key = E().keyQuarter(p.deptId, r.q);
            var st = E().docState(key), d = E().latestAt(key);
            var lab = E().quarterLabel(r.q) + ' 실시 결과 보고';
            var due = E().quarterEnd(r.q), left = V().daysTo(due);
            var dueTxt = '기한 ' + due.slice(5) + (left >= 0 ? ' (D-' + left + ')' : ' (D+' + (-left) + ' · 기한 지남)');
            var now = V().today() >= E().quarterOpen(r.q) || left < 0;
            var body;
            if (st === 'sent') {
                var extra = E().pendingReportCourses(p.deptId).length;
                body = '<b>' + esc(lab) + '</b> — ' + ctl(key, '', {}) + (extra ? ' <span class="file-hint">추가분 ' + extra + '건 — 다음 보고에 실립니다</span>' : '');
            } else {
                var btn = ctl(key, '분기 결과 보고 작성', { primary: now, tour: 'edu-report', quiet: false });
                body = '<b>' + esc(lab) + '</b> — 지금 ' + r.list.length + '건 · ' + esc(dueTxt) + ' ' + btn +
                    (!now && st === 'none' ? ' <span class="file-hint">' + E().quarterOpen(r.q).slice(5) + '부터 내 할일에 뜹니다 — 일찍 보내도 됩니다</span>' : '');
                if (d && st === 'returned') body = '<b>' + esc(lab) + '</b> — ' + ctl(key, '', {});
            }
            html += '<div class="check-notice edu-qbar">' + body + '</div>';
        }
        /* 재난안전과 — 부서별 현황 */
        if (p.deptId === own || p.tier === 'head') {
            var qq = E().quarterOf(V().today());
            var rows = quarterStatus(qq);
            if (rows.length) {
                var sent = rows.filter(function (x) { return x.st === 'sent'; }).length;
                html += '<div class="check-notice edu-qbar"><b>' + esc(E().quarterLabel(qq)) + ' 부서 실시 결과 보고</b> — ' + sent + ' / 대상 ' + rows.length + '개 부서 ' +
                    '<button type="button" class="btn btn-outline btn-sm" onclick="EDUDOC.openQuarterStatus(\'' + qq + '\')">부서별 현황</button></div>';
            }
        }
        return html;
    }
    /* 대상 = 그 분기 새 흐름 부서 실시 교육이 1건 이상인 부서 */
    function quarterStatus(qq) {
        var by = {};
        E().load().courses.forEach(function (c) {
            if (!E().isFlow2(c) || !E().isDeptRun(c) || c.status === 'CANCELLED' || E().quarterOf(c.date) !== qq) return;
            var d = E().reportDeptOf(c); (by[d] = by[d] || []).push(c);
        });
        return Object.keys(by).map(function (d) {
            return { deptId: d, n: by[d].length, st: E().docState(E().keyQuarter(d, qq)), key: E().keyQuarter(d, qq) };
        }).sort(function (a, b) { return deptName(a.deptId).localeCompare(deptName(b.deptId)); });
    }
    function openQuarterStatus(qq) {
        var rows = quarterStatus(qq);
        var ST = { sent: '보냄', returned: '반려·반송', none: '보내기 전' };
        var canR = function (d) { return R() && R().canRemind ? R().canRemind(d) : true; };
        var pend = rows.filter(function (x) { return x.st !== 'sent' && canR(x.deptId); });
        var body = '<p class="file-hint" style="margin:0 0 8px;">' + esc(E().quarterLabel(qq)) + ' · 기한 ' + E().quarterEnd(qq) + ' — 그 분기에 부서가 실시한 교육(자체 · 기타 · 채용시)이 1건 이상인 부서만 대상입니다.</p>' +
            '<div class="edu-scroll"><table class="table-figma table-compact"><thead><tr><th>부서</th><th>실시 교육</th><th>보고</th><th>독촉</th><th></th></tr></thead><tbody>' +
            (rows.length ? rows.map(function (x) {
                var d = E().latestAt(x.key);
                return '<tr><td class="edu-name">' + esc(deptName(x.deptId)) + '</td><td>' + x.n + '건</td>' +
                    '<td><span class="chip-status chip-sm ' + V().toneOf(d ? d.status : '미제출') + '">' + esc(d ? d.status : ST[x.st]) + '</span>' +
                        (d ? ' <button type="button" class="btn btn-outline btn-sm" onclick="EDUDOC.openDoc(\'' + q(x.key) + '\',\'' + q(d.sid) + '\')">문서 보기</button>' : '') + '</td>' +
                    '<td>' + remindCount(x.deptId, x.key) + '회</td>' +
                    '<td class="col-action">' + (x.st !== 'sent' && canR(x.deptId) ? '<button type="button" class="btn btn-outline btn-sm" onclick="EDUDOC.remindQuarter(\'' + q(x.deptId) + '\',\'' + qq + '\')">독촉</button>' : '') + '</td></tr>';
            }).join('') : '<tr><td colspan="5"><div class="v2-empty">이 분기에 부서가 실시한 교육이 아직 없습니다.</div></td></tr>') +
            '</tbody></table></div>';
        V().openModal(esc(E().quarterLabel(qq)) + ' 부서 실시 결과 보고 현황', body,
            (pend.length > 1 ? '<button type="button" class="btn btn-outline" onclick="EDUDOC.remindQuarterAll(\'' + qq + '\')">미보고 ' + pend.length + '개 부서 일괄 독촉</button>' : '') +
            '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal()">닫기</button>');
    }
    function remindQuarter(deptId, qq) {
        if (remindDept(deptId, 'quarter', { key: E().keyQuarter(deptId, qq), title: E().quarterLabel(qq) })) openQuarterStatus(qq);
    }
    function remindQuarterAll(qq) {
        var n = 0;
        quarterStatus(qq).forEach(function (x) { if (x.st !== 'sent' && remindDept(x.deptId, 'quarter', { key: x.key, title: E().quarterLabel(qq) })) n++; });
        toast(n + '개 부서에 독촉을 보냈습니다.');
        openQuarterStatus(qq);
    }
    /* 부서 실시 교육 등록 뒤 한 줄 — 어느 보고에 들어가는지 */
    function reportLine(course) {
        if (!course) return '';
        var d = E().reportDeptOf(course), qq = E().quarterOf(course.date);
        var sent = E().docState(E().keyQuarter(d, qq)) === 'sent';
        var r = E().reportQuarterFor(d);
        return sent
            ? '이 분기(' + E().quarterLabel(qq) + ') 보고는 이미 보냈습니다 — 이 교육은 다음 보고에 «추가분»으로 실립니다.'
            : E().quarterLabel(qq) + ' 실시 결과 보고에 들어갑니다 · 기한 ' + E().quarterEnd(qq) + ' · 이번 분기 지금 ' + (r.q === qq ? r.list.length : E().pendingReportCourses(d, qq).length) + '건';
    }
    /* 카드·행 칩 — «○분기 보고 전» 또는 보낸 상태 */
    function reportChip(course) {
        if (!course || !E().isFlow2(course) || !E().isDeptRun(course)) return '';
        var h = E().reportedKeyOf(course.id);
        var qq = E().quarterOf(course.date);
        if (h) return '<span class="chip-status chip-sm ' + V().toneOf(h.doc.status) + '">' + esc(String(h.doc.q || qq).slice(-1) + '분기 보고 ' + h.doc.status) + '</span>';
        return '<span class="chip-status chip-sm ' + V().toneOf('예정') + '">' + esc(qq.slice(-1) + '분기 보고 전') + '</span>';
    }

    /* ===================== 결재 이력 소비 API ===================== */
    function canViewHistory() {
        var p = me();
        if (!p) return true;
        return p.deptId === ((R() && R().OWNER_DEPT) || 'safety');
    }
    var HISTORY_DENY = '결재 이력은 재난안전과에서 봅니다 — 부서가 보낸 공문은 교육 카드·상세의 [문서 보기]로 봅니다.';
    function submissions() {
        if (!canViewHistory()) return [];
        var store = E().load().docs || {}, out = [];
        Object.keys(store).forEach(function (key) {
            var arr = store[key] || [], t = parse(key);
            arr.forEach(function (doc, i) {
                var c = t.c;
                out.push({
                    sid: doc.sid, no: doc.no, at: doc.at, status: doc.status,
                    label: doc.title, line: doc.lineText || '',
                    docKind: doc.kind || t.kind, docKindLabel: KIND_LABEL[doc.kind || t.kind] + (doc.sub ? '(' + doc.sub + ')' : ''),
                    fromDept: doc.dept || '',
                    kind: c ? c.kind : '', kindLabel: c ? E().kindLabel(c.kind) : (t.kind === 'QUARTER' ? '부서 실시 교육' : '-'),
                    scope: c ? c.desc : (t.kind === 'QUARTER' ? deptName(t.deptId) + ' ' + E().quarterLabel(t.q) : key),
                    year: String(doc.at || '').slice(0, 4),
                    courseId: c ? c.id : '', key: key,
                    latest: i === arr.length - 1
                });
            });
        });
        return out.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    }
    function openDocSid(sid) {
        var store = E().load().docs || {}, hit = null;
        Object.keys(store).forEach(function (key) { (store[key] || []).forEach(function (doc) { if (doc.sid === sid) hit = { key: key, doc: doc }; }); });
        if (!hit) { toast('문서를 찾지 못했습니다.'); return; }
        if (!canViewHistory()) { toast(HISTORY_DENY); return; }
        T.openDoc(hit.key, sid);
    }

    T.KIND_LABEL = KIND_LABEL;
    T.canDraftOf = function (c) { return canDraft(c && c.kind ? targetOf(c.id) : c); };
    T.canDraftKey = function (key) { return canDraft(targetOf(key)); };
    T.ctl = ctl;
    T.submissions = submissions;
    T.canViewHistory = canViewHistory;
    T.historyDenyNote = function () { return HISTORY_DENY; };
    T.openDocSid = openDocSid;
    T.control = control;
    T.lockOf = lockOf;
    T.docsOf = function (key) { return E().docsAt(key); };
    T.latestDoc = latestDoc;
    T.remindDept = remindDept;
    T.remindCount = remindCount;
    T.quarterBar = quarterBar;
    T.quarterStatus = quarterStatus;
    T.openQuarterStatus = openQuarterStatus;
    T.remindQuarter = remindQuarter;
    T.remindQuarterAll = remindQuarterAll;
    T.reportLine = reportLine;
    T.reportChip = reportChip;
    T.reset = function () { /* 공문은 교육 스토어에 있다 — DYEDU.reset() 이 함께 되돌린다 */ };
})(window);
