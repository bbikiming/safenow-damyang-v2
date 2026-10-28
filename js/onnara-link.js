/* =========================================================================
 * DYONNARA — 문서 목록 상세의 «온나라 원본 문서» 연결 (2026-10-28)
 * -------------------------------------------------------------------------
 * 정본: 화면 정의서 SCR-CMP-002 §3-3 · §4-4 · P17~P23 · DOC-06~08
 *       기획 docs/planning/기획-문서목록-상세-온나라원본정보-v2.md
 *
 * [연결은 사람이 한다] 2026-10-27 담양군 회신 — «다른 부서 문서는 조회되면 안 되고,
 *   각 부서 담당자가 본인 계정으로 조회해 저장한다». 시스템이 원장 전체를 한꺼번에
 *   맞추는 배치는 없다. 그 문서 부서의 담당자가 찾아 확인해야 이어진다(P17).
 *
 * [노출 축은 부서다] 온나라는 누른 사람의 계정으로 판정한다. 그래서 온나라를 부르는
 *   동작(원본 정보 보기·붙임 목록 갱신)과 이미 저장된 값(일련번호·붙임 이름·기안자)은
 *   **그 문서 부서 사람에게만** 보인다. 주관부서·관리자 역할로 넓히지 않는다 — 넓혀도
 *   온나라가 거절한다(P19). 다른 부서에는 «연결됨» 여부만 보인다(P18). 이 판정은
 *   DYROLE.canAct 가 아니다 — canAct 는 주관부서 담당자에게 전 부서를 연다.
 *
 * [프로토타입 범위] 온나라 연계가 없으므로 찾기 결과·결재 경로·붙임 목록은 원장 값과
 *   조직도에서 만든 **예시 자료**다. 화면은 그 사실을 예시 칩으로 밝힌다(CLAUDE.md §15).
 *   운영에서는 같은 함수 자리에 온나라 응답이 들어온다.
 *
 * [붙임 받기] 운영에서는 조건(임시 파일 확인·담양군 답 4건 — DOC-07)이 풀릴 때까지
 *   수단을 내지 않는다(P23). 그래서 이 모듈에는 받기 함수가 없다.
 * ========================================================================= */
(function (global) {
    'use strict';

    var SKEY = 'dy-onnara-link-v1';
    var V = function () { return global.DYV2; };
    var R = function () { return global.DYROLE; };
    var D = function () { return global.DYDOCS; };

    /* ── 저장소 — 연결(문서 → 온나라 문서 여러 건)과 기록 ── */
    var _s = null;
    function blank() { return { links: {}, log: [], seeded: false }; }
    function store() {
        if (_s) return _s;
        try { _s = JSON.parse(localStorage.getItem(SKEY)) || blank(); } catch (e) { _s = blank(); }
        if (!_s.links) _s.links = {};
        if (!_s.log) _s.log = [];
        if (!_s.seeded) { seed(); _s.seeded = true; save(); }
        return _s;
    }
    function save() { try { localStorage.setItem(SKEY, JSON.stringify(_s)); } catch (e) {} }
    function reset() { _s = null; try { localStorage.removeItem(SKEY); } catch (e) {} }
    /* 조회·잇기 시각 — 실제 시각이 필요한 자리라 DYV2.today() 가 아니라 로컬 시각을 쓴다(CLAUDE.md §11 예외) */
    function nowTs() {
        var d = new Date();
        function z(x) { return (x < 10 ? '0' : '') + x; }
        return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
    }

    /* 결정적 해시 — 같은 문서에는 늘 같은 예시 값이 나오게 한다(새로고침마다 바뀌면 시연이 흔들린다) */
    function hash(str) {
        var h = 2166136261;
        for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
        return h;
    }
    /* 날짜 더하기 — 로컬 날짜로 계산한다. toISOString 을 쓰면 UTC 로 바뀌어 KST 에서 하루가 밀린다 */
    function addDays(iso, n) {
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
        if (!m) return iso || '';
        var d = new Date(+m[1], +m[2] - 1, +m[3] + n);
        function z(x) { return (x < 10 ? '0' : '') + x; }
        return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
    }

    /* ── 부서 판정 ── */
    function me() { var r = R(); return r && r.current ? r.current() : null; }
    function deptIdOfDoc(d) {
        if (!d || !d.dept) return '';
        var v = V();
        return (v && v.deptIdOf) ? (v.deptIdOf(d.dept) || '') : '';
    }
    /* 보는 사람의 부서 = 그 문서의 부서인가 — 온나라를 부르는 동작과 저장값 노출의 유일한 판정 */
    function sameDept(d) {
        var p = me(), id = deptIdOfDoc(d);
        return !!(p && p.deptId && id && p.deptId === id);
    }
    /* 잇기·해제·갱신 — 그 문서 부서의 **담당자**만. 관리·감독 계층은 보기만 한다(CLAUDE.md §12) */
    function canLink(d) {
        var p = me();
        return sameDept(d) && !!p && p.tier === 'staff';
    }
    function denyNote(d) {
        var p = me();
        if (!sameDept(d)) return '다른 부서 문서는 온나라에서 조회할 수 없습니다 — 잇는 일은 ' + ((d && d.dept) || '담당 부서') + ' 담당자가 합니다.';
        if (p && p.tier !== 'staff') return '관리·감독 계층은 조회만 합니다 — 잇기·해제·갱신은 담당자가 합니다.';
        return '';
    }

    /* ── 예시 온나라 문서 만들기 ──
     * 원장 문서 한 건에서 그 문서와 같아 보이는 온나라 문서를 만든다. 운영에서는 담당자 계정으로
     * 문서관리카드를 조회한 응답이 이 자리에 온다. */
    function rcvOf(d) { return d.dir === 'in' ? 'R' : 'P'; }
    function gubunOf(d) { return d.dir === 'out' ? '시행' : '내부결재'; }
    function makeOnnara(d, variant) {
        var h = hash(d.id + '|' + (variant || 0));
        var deptId = deptIdOfDoc(d);
        var seq = 1000 + (h % 8000);
        var title = variant ? (d.title + ' (보완)') : d.title;
        var date = variant ? addDays(d.date, 3) : (d.date || '');
        var paper = !variant && (h % 11 === 0);
        return {
            oid: 'ONN-' + d.id + '-' + (variant || 0),
            deptId: deptId, deptName: d.dept, seq: seq,
            rcv: rcvOf(d), gubun: gubunOf(d),
            title: title, date: date, sr: d.sr || '',
            paper: paper,
            sample: true,
        };
    }
    /* 붙임 목록 — 저장해 두는 값(P17). 종이문서는 파일이 없다 */
    function makeFiles(o) {
        if (o.paper) return [];
        var h = hash(o.oid);
        var base = String(o.title).replace(/[\\/:*?"<>|]/g, '').slice(0, 28);
        var files = [{ kind: '본문', name: base + '.hwpx', size: 40000 + (h % 90000) }];
        var n = 1 + (h % 3);
        var names = ['결과보고서', '점검표', '현장사진', '참석자 명단'];
        for (var i = 0; i < n; i++) {
            files.push({ kind: '붙임 ' + (i + 1), name: names[(h + i) % names.length] + '.pdf', size: 90000 + ((h >> (i + 2)) % 900000) });
        }
        return files;
    }

    /* ── 예시 연결 — 다른 부서 화면에서 «연결됨»이 어떻게 보이는지 보이기 위한 몇 건 ── */
    var SEED_DEPTS = ['재난안전과', '물순환사업소', '환경과', '공공시설사업소'];
    function seed() {
        var dd = D();
        if (!dd || !dd.allDocs) return;
        var docs = dd.allDocs();
        SEED_DEPTS.forEach(function (dept) {
            var pick = docs.filter(function (d) {
                return d.origin === 'ledger' && d.dept === dept && d.year === 2025 && (d.stageIds || []).length;
            }).slice(0, 2);
            pick.forEach(function (d, i) {
                var o = makeOnnara(d, 0);
                /* 마지막 부서의 두 번째 문서는 종이문서 예시 — 파일 목록이 비어도 «붙임 없음»이 아님을 보인다 */
                if (dept === SEED_DEPTS[SEED_DEPTS.length - 1] && i === 1) o.paper = true;
                o.files = makeFiles(o);
                o.linkedBy = '예시 자료';
                o.linkedAt = d.date || '';
                o.refreshedAt = d.date || '';
                var list = [o];
                /* 첫 부서의 첫 문서에는 두 건을 잇는다 — 원장 한 건에 온나라 여러 건(P17) */
                if (dept === SEED_DEPTS[0] && i === 0) {
                    var o2 = makeOnnara(d, 1);
                    o2.files = makeFiles(o2);
                    o2.linkedBy = '예시 자료'; o2.linkedAt = d.date || ''; o2.refreshedAt = d.date || '';
                    list.push(o2);
                }
                _s.links[d.id] = list;
            });
        });
    }

    /* ── 읽기 ── */
    function linksOf(docId) { return (store().links[docId] || []).slice(); }
    function isLinked(docId) { return linksOf(docId).length > 0; }

    /* 찾기 — 담당자 계정으로 온나라를 찾는다(예시: 원장 값으로 후보 두 건을 만든다) */
    function search(docId) {
        var d = D().docById(docId);
        if (!d) return { ok: false, reason: '문서를 찾을 수 없습니다.' };
        if (!canLink(d)) return { ok: false, reason: denyNote(d) };
        var have = {};
        linksOf(docId).forEach(function (l) { have[l.oid] = 1; });
        var cands = [makeOnnara(d, 0), makeOnnara(d, 1)].filter(function (c) { return !have[c.oid]; });
        return { ok: true, cands: cands };
    }
    /* 원장 값과 온나라 값의 다른 점 — 경고만 하고 막지 않는다(§5) */
    function diffs(d, o) {
        var out = [];
        if (String(d.title || '').trim() !== String(o.title || '').trim()) out.push('제목');
        if (String(d.date || '').slice(0, 10) !== String(o.date || '').slice(0, 10)) out.push('보고일자');
        if ((d.dept || '') !== (o.deptName || '')) out.push('부서');
        return out;
    }

    /* 원본 정보 — 볼 때 받는다(P22). 저장하지 않는다 */
    function detail(docId, oid) {
        var d = D().docById(docId);
        var l = linksOf(docId).filter(function (x) { return x.oid === oid; })[0];
        if (!d || !l || !sameDept(d)) return null;
        var v = V();
        var ms = (v && v.orgMembers) ? v.orgMembers(l.deptId) : [];
        var lead = ms.filter(function (m) { return m.lead; })[0];
        var tl = ms.filter(function (m) { return m.teamLead; })[0];
        var staff = ms.filter(function (m) { return !m.lead && !m.teamLead; });
        var h = hash(l.oid);
        var drafter = staff.length ? staff[h % staff.length] : (tl || lead || null);
        var path = [];
        var day = String(l.date || '').slice(0, 10);
        /* 결재가 끝난 날을 원장의 보고일자로 둔다 — 기안은 그 전날 */
        if (drafter) path.push({ act: '기안', name: drafter.name, duty: drafter.role, at: addDays(day, -1) + ' 09:1' + (h % 10) });
        var jeon = !!tl && (h % 3 === 0);
        if (tl && tl !== drafter) path.push({ act: jeon ? '전결' : '검토', name: tl.name, duty: tl.role, at: day + ' 10:2' + (h % 10) });
        if (lead && !jeon) path.push({ act: '결재', name: lead.name, duty: lead.role, at: day + ' 16:4' + (h % 10) });
        var done = path.length ? path[path.length - 1].at.slice(0, 10) : day;
        var stateLabel = l.rcv === 'R' ? '' : (l.gubun === '시행' ? '결재완료 · 발송' : '결재완료');
        return {
            drafter: drafter ? drafter.name : '',
            state: stateLabel,
            doneAt: l.rcv === 'R' ? '' : done,
            path: l.rcv === 'R' ? [] : path,
            kind: l.rcv === 'R' ? '접수' : ('생산 · ' + (l.gubun === '시행' ? '시행(발송)' : '내부결재')),
            recv: l.rcv === 'P' && l.gubun === '시행' && l.sr ? [{ type: '대외', name: l.sr, status: '접수', at: done }] : [],
            send: l.rcv === 'R' && l.sr ? { org: l.sr, at: day } : null,
            fetchedAt: nowTs(),
            sample: true,
        };
    }
    /* 등록번호 표기 — DOC-08 답 전 기본값: «처리과 일련번호» + 생산/접수 */
    function noLabel() { return '처리과 일련번호'; }
    function noText(l) { return l ? (String(l.seq) + ' (' + (l.rcv === 'R' ? '접수' : '생산') + ')') : ''; }

    /* ── 쓰기 — 화면 버튼과 같은 판정을 저장 직전에 다시 본다 ── */
    function log(kind, docId, oid) {
        var p = me();
        store().log.push({ kind: kind, docId: docId, oid: oid, by: p ? (p.name + ' (' + (p.deptName || '') + ')') : '', at: nowTs() });
    }
    function link(docId, cand) {
        var d = D().docById(docId);
        if (!d) return { ok: false, reason: '문서를 찾을 수 없습니다.' };
        if (!canLink(d)) return { ok: false, reason: denyNote(d) };
        if (!cand || !cand.oid) return { ok: false, reason: '이을 온나라 문서를 고르세요.' };
        var list = store().links[docId] || [];
        if (list.some(function (l) { return l.oid === cand.oid; })) return { ok: false, reason: '이미 이어진 온나라 문서입니다.' };
        var p = me();
        var o = JSON.parse(JSON.stringify(cand));
        o.files = makeFiles(o);
        o.linkedBy = p ? p.name : '';
        o.linkedAt = nowTs();
        o.refreshedAt = nowTs();
        list.push(o);
        store().links[docId] = list;
        log('link', docId, o.oid);
        save();
        return { ok: true, link: o };
    }
    function unlink(docId, oid) {
        var d = D().docById(docId);
        if (!d) return { ok: false, reason: '문서를 찾을 수 없습니다.' };
        if (!canLink(d)) return { ok: false, reason: denyNote(d) };
        var list = store().links[docId] || [];
        var next = list.filter(function (l) { return l.oid !== oid; });
        if (next.length === list.length) return { ok: false, reason: '이미 끊어진 연결입니다.' };
        if (next.length) store().links[docId] = next; else delete store().links[docId];
        log('unlink', docId, oid);
        save();
        return { ok: true, left: next.length };
    }
    function refresh(docId, oid) {
        var d = D().docById(docId);
        if (!d) return { ok: false, reason: '문서를 찾을 수 없습니다.' };
        if (!canLink(d)) return { ok: false, reason: denyNote(d) };
        var l = (store().links[docId] || []).filter(function (x) { return x.oid === oid; })[0];
        if (!l) return { ok: false, reason: '연결을 찾을 수 없습니다.' };
        l.files = makeFiles(l);
        l.refreshedAt = nowTs();
        log('refresh', docId, oid);
        save();
        return { ok: true, link: l };
    }

    global.DYONNARA = {
        sameDept: sameDept, canLink: canLink, denyNote: denyNote,
        linksOf: linksOf, isLinked: isLinked,
        search: search, diffs: diffs, detail: detail,
        noLabel: noLabel, noText: noText,
        link: link, unlink: unlink, refresh: refresh,
        log: function () { return store().log.slice(); },
        reset: reset,
        MAX_FILE_MB: 20,
    };
}(window));
