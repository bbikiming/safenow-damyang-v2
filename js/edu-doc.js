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
     ④ 실시 결과 보고(R)      부서 → 재난안전과 · 등록 한 번 = 공문 한 번(자체·채용시·기타 — 2차 통화)
     (이전 방식) 분기 실시 결과 보고(Q) — 걷었다. 이미 보낸 것만 열람
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
    var KIND_LABEL = { NOTICE: '교육 안내', ENROLL: '참석자 등록부 제출', TRIP: '출장 결과 보고', RUN: '실시 결과 보고', QUARTER: '분기 실시 결과 보고(이전 방식)', RESULT: '실시 결과(이전 방식)' };
    /* 부서 실시 교육 공문의 이름은 교육 종류를 따른다 — 공문 이력에서 무엇의 결과인지 보이게 */
    var RUN_LABEL = { REG_SELF: '자체교육 실시 결과', SUP_REG: '관리감독자 자체교육 실시 결과', HIRE: '채용시교육 실시 결과', ETC: '기타교육 실시 결과', SUP_ETC: '관리감독자 기타교육 실시 결과' };
    function runLabel(c) { return (c && RUN_LABEL[c.kind]) || KIND_LABEL.RUN; }

    /* ===================== 대상 ===================== */
    function parse(key) {
        var k = String(key || ''), p = k.split('|');
        if (p[0] === 'N') return { key: k, kind: 'NOTICE', c: E().courseOf(p[1]) };
        if (p[0] === 'E') return { key: k, kind: 'ENROLL', c: E().courseOf(p[1]), deptId: p[2] };
        if (p[0] === 'T') return { key: k, kind: 'TRIP', c: E().courseOf(p[1]) };
        if (p[0] === 'Q') return { key: k, kind: 'QUARTER', deptId: p[1], q: p[2] };
        if (p[0] === 'R') return { key: k, kind: 'RUN', batchId: p[1] };
        return { key: k, kind: 'RESULT', c: E().courseOf(k) };
    }
    function targetOf(key) {
        var t = parse(key);
        if (t.kind === 'QUARTER') { t.list = qList(t); return t; }
        if (t.kind === 'RUN') {
            t.list = E().batchCourses(t.batchId);
            if (!t.list.length) return null;
            t.c = t.list[0]; t.deptId = E().reportDeptOf(t.c);
            return t;
        }
        if (!t.c) return null;
        if (t.kind === 'ENROLL') t.enroll = E().enrolls(t.c.id).filter(function (e) { return e.deptId === t.deptId; })[0] || null;
        if (t.kind === 'NOTICE') t.sub = t.c.status === 'CANCELLED' ? '취소' : (t.c.noticeDirty ? '변경' : '');
        return t;
    }
    /* 이전 방식 분기 보고 — 보낸 공문에 고정한 목록만 본다(새로 만들지 않는다) */
    function qList(t, doc) {
        var d = doc || E().latestAt(t.key);
        return d && d.courseIds ? d.courseIds.map(function (id) { return E().courseOf(id); }).filter(Boolean) : [];
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
        if (t.kind === 'ENROLL' || t.kind === 'QUARTER' || t.kind === 'RUN') {
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
            return st === 'returned' ? { ok: true } : { ok: false, why: '실시 결과 공문은 이제 출장 결과 보고(집합교육)와 부서 교육 실시 결과 보고로 보냅니다.' };
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
        if (t.kind === 'QUARTER') return { ok: false, why: '분기 실시 결과 보고는 이제 보내지 않습니다 — 교육을 등록할 때 실시 결과 보고 공문을 보냅니다.' };
        if (t.kind === 'RUN') return E().isFlow2(t.c) ? { ok: true } : { ok: false, why: '이전 방식 기록입니다.' };
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
        if (t.kind === 'RUN') return runTitle(t) + ' 실시 결과 보고(' + deptName(t.deptId) + ')';
        return yearOf(t.c) + '년 안전보건교육 실시 결과 보고 — ' + t.c.desc;
    }
    function subjectOf(t) {
        if (!t) return '';
        if (t.kind === 'RUN') return runLabel(t.c) + ' — ' + runTitle(t);
        return KIND_LABEL[t.kind] + ' — ' + (t.kind === 'QUARTER' ? deptName(t.deptId) + ' ' + E().quarterLabel(t.q) : t.c.desc);
    }
    /* 묶음 제목 — 채용시 «근로자별 개별 건»은 교육명 뒤에 « · 이름»이 붙어 있어 묶음 이름(batchTitle)을 먼저 쓴다 */
    function runTitle(t) {
        var c = t.c, n = t.list.length;
        var base = c.batchTitle || String(c.desc || '').replace(/\s·\s[^·]+$/, '');
        return base + (n > 1 ? ' (' + n + '건)' : '');
    }
    var NOTICE_LINE = {
        NOTICE: '✓ 교육을 저장했습니다 — 이 안내 공문을 온나라로 보내야 대상 부서에 교육이 알려집니다.',
        ENROLL: '✓ 참석자 등록부는 저장돼 있습니다 — 이 공문을 온나라로 보내야 등록이 끝납니다.',
        TRIP: '✓ 출장 결과 보고서를 저장했습니다 — 이 공문을 온나라로 보내야 보고가 끝납니다.',
        RUN: '✓ 교육 기록과 이수는 저장됐습니다 — 이 공문을 온나라로 보내야 할 일이 끝납니다.',
        QUARTER: '', RESULT: ''
    };
    function initOf(t) {
        if (!t) return {};
        var o = {};
        if (t.kind === 'NOTICE' || t.kind === 'ENROLL' || t.kind === 'QUARTER' || t.kind === 'RUN') { o.docType = '외부발송'; o.to = '수신자 참조'; }
        var lead = NOTICE_LINE[t.kind] || '';
        if (t.kind === 'NOTICE' && t.sub) lead = '교육을 ' + (t.sub === '취소' ? '취소' : '변경') + '했습니다 — 이미 안내를 받은 부서에 ' + t.sub + ' 안내 공문을 보냅니다.';
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
        if (t.kind === 'ENROLL' || t.kind === 'QUARTER' || t.kind === 'RUN') return [deptName((R() && R().OWNER_DEPT) || 'safety') + '장'];
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
        if (t.kind === 'RUN') {
            var c0 = t.c, recsR = [];
            t.list.forEach(function (c) { E().records().forEach(function (r) { if (r.courseId === c.id) recsR.push(r); }); });
            var hrs = t.list.reduce(function (n, c) { return Math.max(n, +c.hours || 0); }, 0);
            return [
                { label: '교육 개요', text: '1. 교육명: ' + runTitle(t) + (c0.etcType ? ' (' + c0.etcType + ')' : '') + '\n2. 일시: ' + E().courseDateTime(c0) + ' (' + hrs + '시간)\n3. 장소: ' + (c0.place || '-') + '\n4. 강사: ' + (c0.instructor || '-') },
                { label: '실시 결과 (' + recsR.length + '명)', text: '5. 실시 결과: ' + deptName(t.deptId) + ' ' + recsR.length + '명 이수' },
                { label: '근거 문구', text: basisText() + '을 위와 같이 실시하였기에 그 결과를 보고합니다.' }
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
        if (t.kind === 'QUARTER' || t.kind === 'RUN') {
            /* 묶음의 교육일지·사진 — 방금 올린 파일이라 미리 체크한다(같은 파일은 한 번만) */
            var out = [], seen = {};
            t.list.forEach(function (c) { (c.files || []).forEach(function (f) { if (seen[f.name]) return; seen[f.name] = 1; out.push(fileItem(f, E().kindLabel(c.kind) + ' · ' + (c.date || ''), t.kind === 'RUN')); }); });
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
        if (t.kind === 'RUN') {
            var rows = [];
            t.list.forEach(function (c) { attendeesOf(c.id).forEach(function (a) { rows.push([a.dept, a.name, a.hours + 'h', a.date]); }); });
            return rows.length ? [{ title: '이수자 명단 (' + rows.length + '명)', html: table(['부서', '성명', '이수시간', '이수일'], rows) }] : [];
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
        if (t.kind === 'RUN') {
            doc.courseIds = t.list.map(function (c) { return c.id; });
            doc.runKind = t.c.kind;
            t.list.forEach(function (c) { hist(c.id, '실시 결과 보고 공문 온나라로 보냄 — ' + doc.title + ' (' + doc.no + ')'); });
        } else if (t.kind === 'QUARTER') {
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
        QUARTER: '보낸 뒤에는 실린 교육을 수정·삭제할 수 없습니다.',
        RUN: '보낸 뒤에는 이 교육 기록을 고치거나 등록 취소할 수 없습니다 — 온나라에서 반려·반송되면 다시 열립니다.',
        RESULT: '보낸 뒤에는 이 교육의 정보·대상자·이수기록을 수정·삭제할 수 없습니다.'
    };
    var SENT_NOTE = {
        NOTICE: '교육 안내 공문을 온나라 연계기안함에 보냈습니다. 대상 부서 내 할일에 예정 교육이 보입니다.',
        ENROLL: '참석자 등록부 제출 공문을 온나라 연계기안함에 보냈습니다. 이 교육의 우리 부서 할 일이 끝났습니다.',
        TRIP: '출장 결과 보고 공문을 온나라 연계기안함에 보냈습니다.',
        QUARTER: '분기 실시 결과 보고 공문을 온나라 연계기안함에 보냈습니다.',
        RUN: '실시 결과 보고 공문을 온나라 연계기안함에 보냈습니다. 이 교육의 할 일이 끝났습니다.',
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
    /* 변경·취소 안내는 «예정 교육이 보입니다»가 아니다 — 대상의 sub 로 문구를 가른다(2026-11-17 검수) */
    var NOTICE_SUB_NOTE = {
        '변경': '변경 안내 공문을 온나라 연계기안함에 보냈습니다. 대상 부서 내 할일의 예정 교육에 바뀐 일시·장소가 보입니다.',
        '취소': '취소 안내 공문을 온나라 연계기안함에 보냈습니다. 대상 부서 내 할일에서 이 교육이 빠집니다.'
    };
    Object.defineProperty(cfg, 'sentNote', { get: function () {
        var k = (CUR && CUR.kind) || 'RESULT';
        if (k === 'NOTICE' && CUR && CUR.sub && NOTICE_SUB_NOTE[CUR.sub]) return NOTICE_SUB_NOTE[CUR.sub];
        return SENT_NOTE[k];
    } });
    var T = global.DYDOC.define(cfg);
    var baseOpen = T.open, baseOpenDoc = T.openDoc;
    /* 변경·취소 안내 여부는 열 때 기억한다 — 보내는 순간 noticeDirty 가 지워져 결과 문구에서는 알 수 없다 */
    T.open = function (key) { CUR = parse(key); var tt = targetOf(key); if (tt && tt.sub) CUR.sub = tt.sub; baseOpen(key); };
    T.openDoc = function (key, sid) { CUR = parse(key); baseOpenDoc(key, sid); };

    /* ===================== 화면이 쓰는 표시 조각 ===================== */
    function q(s) { return esc(s).replace(/'/g, '&#39;'); }
    /* 공문 한 줄 — 미기안이면 [보내기] 버튼(권한이 있을 때) · 보냈으면 상태 칩 + [공문 보기] · 돌아왔으면 사유 + [다시 보내기] */
    /* 결재 상태 칩 — 하나만(2차 통화 00:35 «결재 완료 버튼이 두 개»). 잠금은 버튼이 아니라 «고치는 버튼이 없음»으로 표현한다.
       어휘는 교육 전 화면이 같다: 공문 미기안 · 결재 미완료(기안함 전송·결재중) · 결재 완료 · 반려 · 반송 */
    var CHIP = { '기안함 전송': '결재 미완료', '결재중': '결재 미완료', '결재완료': '결재 완료', '반려': '반려', '반송': '반송' };
    var CHIP_TIP = { '결재 미완료': '온나라 기안함에서 검토·결재를 지정해 상신하세요 — 진행은 온나라에서 봅니다' };
    function stLabel(status) { return CHIP[status] || status; }
    T.stLabel = stLabel;
    T.chipHtml = function (status, prefix) { return chipHtml(status, prefix); };
    function chipHtml(status, prefix) {
        var lab = status ? stLabel(status) : '공문 미기안';
        var tone = status ? V().toneOf(status) : V().toneOf('대기');
        var tip = CHIP_TIP[lab] ? ' title="' + esc(CHIP_TIP[lab]) + '"' : '';
        return '<span class="chip-status chip-sm ' + tone + '"' + tip + '>' + esc((prefix ? prefix + ' ' : '') + lab) + '</span>';
    }
    function viewBtn(key, sid) {
        return ' <button type="button" class="btn btn-outline btn-sm" onclick="EDUDOC.openDoc(\'' + q(key) + '\',\'' + q(sid) + '\')">공문 보기</button>';
    }
    /* 공문 한 줄 — 미기안이면 [보내기] 버튼(권한이 있을 때) · 보냈으면 상태 칩 + [공문 보기] · 돌아왔으면 사유 + [다시 보내기] */
    function ctl(key, label, opts) {
        opts = opts || {};
        var t = targetOf(key); if (!t) return '';
        var d = E().latestAt(key), perm = canDraft(t);
        var btnCls = opts.primary ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';
        var tour = opts.tour ? ' data-tour="' + esc(opts.tour) + '"' : '';
        var prefix = opts.short == null ? '' : opts.short;
        if (!d) {
            if (!perm.ok) return opts.quiet ? '' : '<span class="file-hint">' + esc(perm.why) + '</span>';
            var rd = ready(t);
            if (!rd.ok) return opts.quiet ? '' : '<span class="file-hint">' + esc(rd.why) + '</span>';
            return '<button type="button" class="' + btnCls + '"' + tour + ' onclick="EDUDOC.open(\'' + q(key) + '\')">' + esc(label) + '</button>';
        }
        var chip = chipHtml(d.status, prefix);
        if ((d.status === '반려' || d.status === '반송') && perm.ok) {
            return chip + (d.rejectReason ? ' <span class="file-hint">사유: ' + esc(d.rejectReason) + '</span>' : '') +
                ' <button type="button" class="btn btn-primary btn-sm" onclick="EDUDOC.open(\'' + q(key) + '\')">다시 보내기</button>' + viewBtn(key, d.sid);
        }
        /* 변경·취소 안내가 필요한 교육 — 보낸 안내 옆에 다음 안내 버튼 */
        if (t.kind === 'NOTICE' && t.c.noticeDirty && perm.ok) {
            return chip + viewBtn(key, d.sid) + ' <button type="button" class="btn btn-primary btn-sm" onclick="EDUDOC.open(\'' + q(key) + '\')">' + (t.c.noticeDirty === '취소' ? '취소' : '변경') + ' 안내 공문 보내기</button>';
        }
        return chip + viewBtn(key, d.sid);
    }
    /* 부서 실시 교육(자체·채용시·기타) 한 줄 — [결재 상태 칩] [공문 보기] (2차 통화 «두 개만»).
       그 부서 담당자에게만: 미기안 [공문 보내기] · 반려 [다시 보내기] · 공문 전·반려 «[등록 취소]»(보조 링크).
       공문이 없으면 [공문 보기]를 내지 않는다 — 누르면 «없음»이 뜨는 버튼이다. 옛 기록(공문 없음)은 «이전 방식» */
    function runCtl(course, opts) {
        opts = opts || {};
        if (!course) return '';
        var key = E().runDocKey(course);
        if (!E().isFlow2(course)) {
            var od = E().latestAt(course.id);
            /* 옛 실시 결과 공문이 반려·반송됐으면 기안한 재난안전과에게 [다시 보내기](ctl 이 판정 — 2차 통화 검토 A-6) */
            if (od) return ctl(course.id, '다시 보내기', {});
            /* 표의 줄마다 «이전 방식»을 되풀이하지 않는다 — opts.dash 면 칸을 비워 두고 뜻은 title 로만 */
            return opts.dash ? '<span class="file-hint" title="이전 방식으로 등록한 기록 — 공문 없음" aria-label="이전 방식 — 공문 없음">—</span>'
                : '<span class="file-hint">이전 방식</span>';
        }
        var t = targetOf(key);
        var d = E().latestAt(key), perm = t ? canDraft(t) : { ok: false };
        if (key.indexOf('Q|') === 0) return d ? chipHtml(d.status) + viewBtn(key, d.sid) : '';
        var cancel = perm.ok && (!d || d.status === '반려' || d.status === '반송')
            ? ' <button type="button" class="edu-cancel-link" onclick="EDUDOC.confirmCancelRun(\'' + q(E().batchOf(course)) + '\',\'' + q(opts.refresh || '') + '\')">등록 취소</button>' : '';
        if (!d) {
            return chipHtml('') + (perm.ok ? ' <button type="button" class="btn btn-primary btn-sm" onclick="EDUDOC.open(\'' + q(key) + '\')">공문 보내기</button>' + cancel : '');
        }
        if ((d.status === '반려' || d.status === '반송') && perm.ok) {
            return chipHtml(d.status) + (d.rejectReason ? ' <span class="file-hint">사유: ' + esc(d.rejectReason) + '</span>' : '') +
                ' <button type="button" class="btn btn-primary btn-sm" onclick="EDUDOC.open(\'' + q(key) + '\')">다시 보내기</button>' + viewBtn(key, d.sid) +
                (cancel ? ' <span class="file-hint">기록이 틀렸으면</span>' + cancel : '');
        }
        return chipHtml(d.status) + viewBtn(key, d.sid);
    }
    /* 등록 취소 — 묶음 전체(공문이 묶음 단위다) · 회수되는 이수시간을 밝힌다 */
    function confirmCancelRun(batchId) {
        var list = E().batchCourses(batchId);
        if (!list.length) return;
        var t = targetOf('R|' + batchId);
        if (!t || !canDraft(t).ok) { toast(t ? canDraft(t).why : '대상을 찾지 못했습니다.'); return; }
        if (E().lockAt('R|' + batchId)) { toast('공문을 보낸 기록은 등록 취소할 수 없습니다 — 온나라에서 정정한 뒤 재난안전과에 알려 주세요.'); return; }
        var recList = E().records().filter(function (r) { return list.some(function (c) { return c.id === r.courseId; }); });
        var recs = recList.length;
        /* 회수되는 이수시간·인원을 수로 밝힌다(CLAUDE.md §4 «CRUD 는 회수 경로까지» · 2026-11-17 검수) */
        var people = {}; recList.forEach(function (r) { people[r.workerId] = 1; });
        var hrs = Math.round(recList.reduce(function (n, r) { return n + (+r.hours || 0); }, 0) * 10) / 10;
        V().openModal('등록 취소',
            '<p style="font-size:var(--fs-13);margin:0 0 8px;"><b>' + esc(runTitle(t)) + '</b></p>' +
            '<div class="check-notice">이 등록' + (list.length > 1 ? '(교육 ' + list.length + '건 — 한 번에 등록한 묶음)' : '') + '과 이수기록 <b>' + recs + '건</b>(' + Object.keys(people).length + '명 · 이수시간 합계 <b>' + hrs + 'h</b>)을 지웁니다. 그 사람들은 다시 미이수로 보입니다. 바른 내용으로 다시 등록하세요. 되돌릴 수 없습니다.</div>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>' +
            '<button type="button" class="btn btn-primary" onclick="EDUDOC.doCancelRun(\'' + q(batchId) + '\')">등록 취소</button>');
    }
    function doCancelRun(batchId) {
        var t = targetOf('R|' + batchId);
        if (!t || !canDraft(t).ok) { V().closeModal(); return; }
        var r = E().cancelRun(batchId);
        V().closeModal();
        toast(r ? '등록을 취소했습니다 · 교육 ' + r.courses + '건 · 이수기록 ' + r.records + '건 회수' : '공문을 보낸 기록은 등록 취소할 수 없습니다.');
        T.refresh();
    }
    /* 이전 방식 교육의 표시 — 보낸 실시 결과 공문을 보이고, 반려·반송이면 다시 보낸다. 새 교육(flow 2)에는 쓰지 않는다 */
    function control(courseId) {
        var c = E().courseOf(courseId);
        if (!c || E().isFlow2(c)) return '';
        if (!E().latestAt(courseId)) return '';
        return ctl(courseId, '다시 보내기', {});
    }
    /* 이 교육 건 기록의 잠금 — 부서 실시 교육은 등록 묶음 공문(또는 이번 주 분기 보고)이 나감 · 옛 기록은 실시 결과 공문.
       집합교육 새 흐름은 교육 전체를 잠그지 않는다(등록부는 enrollLock, 회차는 sessionLock). 호출부 다섯 곳이 이 뜻으로 쓴다 */
    function lockOf(courseId) {
        var c = E().courseOf(courseId);
        if (c && E().isFlow2(c)) return E().isDeptRun(c) ? E().reportLock(courseId) : null;
        return E().lockAt(courseId);
    }
    function latestDoc(courseId) { return E().latestAt(courseId); }
    /* 주소로 그 공문 창을 바로 연다 — 내 할일 카드 «공문 보내기»(?doc=R|묶음). 보낼 수 없으면 보낸 공문을 연다 */
    function openFromQuery() {
        var key = new URLSearchParams(global.location.search).get('doc');
        if (!key) return;
        var t = targetOf(key); if (!t) return;
        var d = E().latestAt(key);
        if (canDraft(t).ok && ready(t).ok) { setTimeout(function () { T.open(key); }, 0); return; }
        if (d) setTimeout(function () { T.openDoc(key, d.sid); }, 0);
    }

    function remindDept(deptId, what, ref) {
        var Rr = R();
        if (Rr && Rr.canRemind && !Rr.canRemind(deptId)) { toast(Rr.remindDenyNote ? Rr.remindDenyNote() : '독촉할 수 없습니다.'); return false; }
        var msg = { apply: '참석자 등록부를 올려 주세요', enrollDoc: '참석자 등록부 제출 공문을 보내 주세요', run: '실시 결과 보고 공문을 보내 주세요' }[what] || '처리해 주세요';
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

    function me() { return R() && R().current ? R().current() : null; }

    /* ===================== 결재 이력 소비 API ===================== */
    function canViewHistory() {
        var p = me();
        if (!p) return true;
        return p.deptId === ((R() && R().OWNER_DEPT) || 'safety');
    }
    var HISTORY_DENY = '결재 이력은 재난안전과에서 봅니다 — 부서가 보낸 공문은 교육 카드·상세의 [공문 보기]로 봅니다.';
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
                    docKind: doc.kind || t.kind, docKindLabel: ((doc.kind || t.kind) === 'RUN' ? (RUN_LABEL[doc.runKind] || KIND_LABEL.RUN) : KIND_LABEL[doc.kind || t.kind] + (doc.sub ? '(' + doc.sub + ')' : '')),
                    fromDept: doc.dept || '',
                    kind: c ? c.kind : '', kindLabel: c ? E().kindLabel(c.kind) : (t.kind === 'QUARTER' || t.kind === 'RUN' ? '부서 실시 교육' : '-'),
                    scope: c ? c.desc : (t.kind === 'QUARTER' ? deptName(t.deptId) + ' ' + E().quarterLabel(t.q) : t.kind === 'RUN' ? doc.title : key),
                    year: String(doc.at || '').slice(0, 4),
                    courseId: c ? c.id : '', key: key,
                    latest: i === arr.length - 1,
                    /* 등록 취소한 묶음의 공문 — 열 대상(등록)이 없다. 반려 수에 넣지 않고 «등록 취소»로 보인다 */
                    withdrawn: doc.withdrawn || ''
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
        if (hit.doc.withdrawn || !targetOf(hit.key)) { toast('등록을 취소한 기록이라 이 화면에서 공문을 다시 그릴 수 없습니다 — 보낸 공문은 온나라에서 봅니다.'); return; }
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
    T.runCtl = runCtl;
    T.chipHtml = chipHtml;
    T.stLabel = stLabel;
    T.runLabel = runLabel;
    T.confirmCancelRun = confirmCancelRun;
    T.doCancelRun = doCancelRun;
    T.openFromQuery = openFromQuery;
    T.reset = function () { /* 공문은 교육 스토어에 있다 — DYEDU.reset() 이 함께 되돌린다 */ };
})(window);
