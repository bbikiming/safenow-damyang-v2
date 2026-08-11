/* =========================================================================
 * work-data.js — 업무 자동발행 엔진 (전역 DYWORK)
 * -------------------------------------------------------------------------
 * 3층 모델
 *   ① Template  카탈로그 + 발행규칙        js/work-catalog.js (DYWORKT)
 *   ② Issue     발행 배치 = 템플릿 × 회차   이 파일 · sessionStorage
 *   ③ DeptTask  부서 업무 1건 (배정·처리·결과가 붙는 실체)
 *
 * ② 를 두지 않으면 — 실측상 한 공문이 부서 수만큼 각각 접수된다(2026 이행점검
 *   통보가 부서 문서함마다 05-14 로 들어온다). 배치가 없으면 같은 통보가 36개
 *   별개 업무가 되어 "접수·생산 문서를 서로 다른 업무로 생성"하는 오류가 된다.
 *
 * ── 저장하지 않고 파생하는 것 (MUST) ────────────────────────────────────
 *   기한초과 · D-day · 미배정 · 배치 회수율 · 발행 예정 — 전부 DYV2.today()
 *   파생이다. 시드에 'D+16' 이나 st:'진행' 을 박으면 시연일이 바뀌는 순간
 *   '기한 초과 0건' 옆에 지난 기한이 '진행'으로 남는다(dashboard dueSt 선례).
 *
 * ── 완료는 deptDone() 한 곳에서만 (MUST) ────────────────────────────────
 *   profile:'menu' 인 업무는 그 도메인의 기존 판정을 **읽어온다**(doneProbe).
 *   자체 완료 상태를 저장하면 "이행점검 화면은 완료인데 업무 카드는 미착수"가
 *   조용히 생긴다. 파생 원본이 영속 스토어를 갖지 않으면 'attach' 로 강등한다.
 * ========================================================================= */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var T = function () { return global.DYWORKT; };
    var R = function () { return global.DYROLE; };

    var SKEY = 'dy-work-v1';

    /* 상태 어휘 — 코드로 저장하고 문구는 화면이 정한다.
       표시 라벨은 DYV2.STATUS_TONE 이 아는 말이어야 색이 붙는다(CLAUDE.md §7). */
    var IST = { PLANNED: 'PLANNED', CANDIDATE: 'CANDIDATE', OPEN: 'OPEN', CLOSED: 'CLOSED', CANCELED: 'CANCELED' };
    var IST_LABEL = { PLANNED: '예정', CANDIDATE: '후보', OPEN: '진행', CLOSED: '종결', CANCELED: '취소' };
    var TST = { TODO: 'TODO', DOING: 'DOING', SUBMITTED: 'SUBMITTED' };
    var TST_LABEL = { TODO: '미착수', DOING: '진행', SUBMITTED: '제출' };
    var ASG = { NONE: 'NONE', ASSIGNED: 'ASSIGNED', RETURNED: 'RETURNED' };
    var CFM = { WAIT: 'WAIT', OK: 'OK', RETURNED: 'RETURNED' };

    /* 이력 유형 — rsk-list.js 어휘 재사용 */
    var HLABEL = {
        CREATE: '발행', ASSIGN: '배정', CLAIM: '자임', RETURN_ASSIGN: '반송',
        SUBMIT: '제출', CONFIRM: '접수 확인', RETURN: '반려', REMIND: '재촉',
        CLOSE: '종결', CANCEL: '회수', DEPT_ADD: '부서 추가', DEPT_DEL: '부서 제외',
    };

    /* ================= 날짜 · 회차 파생 ================= */
    function today() { return V().today(); }
    function daysTo(iso) { return V().daysTo(iso); }
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function parse(iso) { var p = String(iso || '').split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
    function lastDay(y, m) { return ymd(new Date(y, m, 0)); }   /* m 은 1-base */

    /* 공휴일 데이터는 코드베이스에 없다 — 주말만 판정하고 화면에 그 사실을 밝힌다.
       발행은 당기고(BACK) 기한은 미룬다(FWD). 반대로 하면 이미 제출한 부서가
       소급 지연이 된다. */
    var HOLIDAYS = {};
    function isOff(iso) {
        var d = parse(iso), w = d.getDay();
        if (w === 0 || w === 6) return true;
        var y = d.getFullYear();
        return (HOLIDAYS[y] || []).indexOf(iso) >= 0;
    }
    function shift(iso, dir) {
        var d = parse(iso), n = 0;
        while (isOff(ymd(d)) && n < 10) { d.setDate(d.getDate() + dir); n++; }
        return ymd(d);
    }
    function addDays(iso, n) { var d = parse(iso); d.setDate(d.getDate() + n); return ymd(d); }

    /* 한 해의 회차 목록 — 저장하지 않고 규칙에서 파생한다(DYTOUR done() 과 같은 원칙) */
    function periodsOf(tpl, year) {
        var k = tpl.schedule.kind, out = [];
        if (k === 'ADHOC') return out;        /* 발생시 — 달력 계획이 없다(수동 생성만) */
        if (k === 'MONTH') {
            for (var m = 1; m <= 12; m++) {
                out.push({
                    key: year + '-' + pad(m), label: year + '년 ' + m + '월',
                    issueMD: pad(m) + '-' + pad(tpl.schedule.issueDay || 14),
                    end: lastDay(year, m),
                });
            }
            return out;
        }
        (tpl.schedule.periods || []).forEach(function (p) {
            var key, end;
            if (k === 'HALF') { key = year + '-' + p.key; end = p.key === 'H1' ? lastDay(year, 6) : lastDay(year, 12); }
            else if (k === 'QUARTER') { key = year + '-' + p.key; end = lastDay(year, ({ Q1: 3, Q2: 6, Q3: 9, Q4: 12 })[p.key]); }
            else { key = String(year); end = lastDay(year, 12); }
            out.push({ key: key, label: year + '년 ' + p.label, issueMD: p.issueMD, end: end });
        });
        return out;
    }
    /* 발행 계획 1건 — 발행일·기한을 규칙에서 계산한다(저장 없음) */
    function planOne(tpl, period) {
        if (!period.issueMD) return null;                    /* 수시형은 계획이 없다 */
        var issue = shift(period.key.slice(0, 4) + '-' + period.issueMD, -1);
        var due = tpl.dueAnchor === 'PERIOD_END' ? period.end : addDays(issue, tpl.dueDays || 14);
        return {
            templateId: tpl.id, periodKey: period.key, periodLabel: period.label,
            issueDate: issue, due: shift(due, +1),
        };
    }
    function planOf(templateId, year) {
        var tpl = T().byId(templateId); if (!tpl) return [];
        return periodsOf(tpl, year).map(function (p) { return planOne(tpl, p); }).filter(Boolean);
    }
    /* 오늘 기준 아직 발행되지 않은 예정 건 (SCHEDULED 만) */
    function upcoming(limit) {
        var t0 = today(), out = [];
        T().scheduled().forEach(function (tpl) {
            [+t0.slice(0, 4), +t0.slice(0, 4) + 1].forEach(function (y) {
                planOf(tpl.id, y).forEach(function (pl) {
                    if (pl.issueDate < t0) return;
                    if (issueByKey(pl.templateId + '|' + pl.periodKey)) return;
                    out.push(Object.assign({ tpl: tpl, depts: targetDepts(tpl, pl.periodKey) }, pl));
                });
            });
        });
        out.sort(function (a, b) { return a.issueDate.localeCompare(b.issueDate); });
        return limit ? out.slice(0, limit) : out;
    }
    /* 발행일이 지났는데 아직 발행 안 된 건 — '자동'의 실체.
     * **최근 30일 창만** 본다. 7월에 1월분 월교육을 소급 발행하는 것은 실제 업무가
     * 아니고, 창을 안 두면 이 블록이 지나간 회차로 덮여 정작 다음 발행이 묻힌다.
     * 창 밖의 미발행 건은 '놓친 발행'으로 따로 센다(missed). */
    var CATCHUP_DAYS = 30;
    function due2issue() {
        var t0 = today(), out = [];
        T().scheduled().forEach(function (tpl) {
            planOf(tpl.id, +t0.slice(0, 4)).forEach(function (pl) {
                if (pl.issueDate > t0) return;
                if (V().daysTo(pl.issueDate) < -CATCHUP_DAYS) return;
                if (issueByKey(pl.templateId + '|' + pl.periodKey)) return;
                out.push(Object.assign({ tpl: tpl, depts: targetDepts(tpl, pl.periodKey) }, pl));
            });
        });
        out.sort(function (a, b) { return a.issueDate.localeCompare(b.issueDate); });
        return out;
    }
    /* 창 밖에서 발행되지 않고 지나간 회차 — 숨기지 않고 건수로 드러낸다 */
    function missedIssues() {
        var t0 = today(), n = 0;
        T().scheduled().forEach(function (tpl) {
            planOf(tpl.id, +t0.slice(0, 4)).forEach(function (pl) {
                if (pl.issueDate > t0) return;
                if (V().daysTo(pl.issueDate) >= -CATCHUP_DAYS) return;
                if (issueByKey(pl.templateId + '|' + pl.periodKey)) return;
                n++;
            });
        });
        return n;
    }

    /* =========================================================================
     * 자동 발행 (DYWORK.autoIssue) — 발주처 확정(2026-08-11)
     * -------------------------------------------------------------------------
     * **주기가 있는 업무는 기간에 맞춰 스스로 나간다.** 사람이 [발행] 을 누르지
     * 않는다. 실 개발에서는 배치 스케줄러가 이 함수를 부르고, 프로토타입에서는
     * 화면 진입 시 부른다(브라우저에 스케줄러가 없다) — **구조는 같고 트리거만
     * 다르다**는 것을 화면에 명시한다.
     *
     * 규칙
     *   · 발행 주체는 사람이 아니라 **시스템**이다(issuedBy='시스템 자동발행').
     *     누가 화면을 열었느냐에 따라 발행자가 달라지면 이력이 거짓이 된다.
     *   · 조회 전용 계층이 열어도 발행된다 — 배치는 사람과 무관하다.
     *   · 최근 30일 창(CATCHUP_DAYS) 밖은 발행하지 않는다. 7월에 1월분을
     *     소급 발행하는 것은 실제 업무가 아니다.
     *   · 멱등키(issueKey)로 중복 발행이 막힌다.
     * ========================================================================= */
    function autoIssue() {
        var made = [];
        due2issue().forEach(function (u) {
            if (!u.depts.length) return;                 /* 대상 부서가 없으면 발행하지 않는다 */
            var r = issueBatch(u.templateId, u.periodKey, {
                origin: 'SCHEDULED',
                issuedAt: u.issueDate,                   /* 발행일은 **규칙상 날짜**다(오늘이 아니다) */
                issuedBy: '시스템 자동발행',
                due: u.due,
            });
            if (r.ok) made.push({ id: r.issue.id, name: u.tpl.name, period: r.issue.periodLabel, depts: u.depts.length });
        });
        return made;
    }

    /* ================= 대상 부서 — 명단이 아니라 속성에서 파생 ================= */
    /* 템플릿에 deptIds 명단을 박지 않는다. 회계과는 5년 사이 사실상 폐지됐고
       세무회계과→재무과 등 개편이 6건이다(CLAUDE.md §14-4). */
    function targetDepts(tpl, periodKey) {
        /* 도메인이 대상 부서를 이미 알고 있으면 **그것을 쓴다**(deptSource).
         * 위험성평가가 그렇다 — 그 해 정기평가의 a.depts 가 실제 대상이고,
         * 속성(riskSite)으로 파생하면 평가 대상이 아닌 부서에까지 업무가 나간다
         * (실측: 속성 파생 6곳 vs 실제 평가 대상 3곳). 속성은 어디까지나
         * 도메인이 답을 못 줄 때의 **기본값**이다. */
        /* 교육 — 현업근로자 **명단이 있는 부서**가 곧 대상이다. 속성 파생(8곳)은
         * 실제(10곳)와 3곳 누락·1곳 과다로 어긋난다(기획예산실·재난안전과·회계과가
         * 빠지고 재무과가 잘못 들어간다). 명단은 2026년 전수 조사 결과라 더 정확하다. */
        if (tpl.deptSource === 'EDU' && global.DYEDU) {
            try {
                var seen = {}, out = [];
                global.DYEDU.workers().forEach(function (w) {
                    if (w.active === false || w.category === 'OFFICE') return;
                    if (!w.deptId || seen[w.deptId]) return;
                    seen[w.deptId] = 1; out.push(w.deptId);
                });
                if (out.length) return out;
            } catch (e) {}
        }
        if (tpl.deptSource === 'RSK' && global.DYRSK) {
            try {
                var yr = +String(periodKey || today()).slice(0, 4);
                var a = (global.DYRSK.assessments() || []).filter(function (x) {
                    return x.type === 'REGULAR' && x.year === yr;
                })[0];
                if (a) return (a.depts || []).map(function (d) { return d.deptId; });
                return [];        /* 평가가 아직 없으면 발행할 대상도 없다 */
            } catch (e) {}
        }
        var attrs = tpl.scopeAttr || [];
        return V().orgDepts().filter(function (d) {
            if (!attrs.length) return true;
            return attrs.every(function (a) { return V().orgHasAttr(d.id, a); });
        }).map(function (d) { return d.id; });
    }
    function deptName(id) { var n = V().orgNode(id); return (n && n.name) || id; }

    /* ================= 스토어 ================= */
    var db = null;
    function blank() { return { issues: [], tasks: {}, seq: 0 }; }
    function load() {
        if (db) return db;
        try { db = JSON.parse(global.sessionStorage.getItem(SKEY) || 'null'); } catch (e) { db = null; }
        if (!db || !db.issues) db = seed();
        return db;
    }
    function save() {
        try { global.sessionStorage.setItem(SKEY, JSON.stringify(db)); }
        catch (e) { if (V() && V().toast) V().toast('저장 공간이 부족해 기록하지 못했습니다'); }
    }
    /* 발신자·기록자 — 로그인한 사람이다. 폴백도 특정 부서명을 쓰지 않는다:
       '재난안전과' 로 두면 롤 스위처가 없는 환경에서 담양읍장의 행위까지
       재난안전과가 한 것으로 남는다(§14-9). */
    function actor() { return (R() && R().actorLabel) ? R().actorLabel() : '시스템'; }

    /* ================= 발행 ================= */
    function issueKeyOf(templateId, periodKey) { return templateId + '|' + periodKey; }
    function issues() { return load().issues.slice(); }
    function issueById(id) { return load().issues.filter(function (i) { return i.id === id; })[0] || null; }
    function issueByKey(k) { return load().issues.filter(function (i) { return i.issueKey === k; })[0] || null; }

    function taskId(issueId, deptId) { return issueId + '-' + deptId; }
    function taskOf(issueId, deptId) {
        var t = load().tasks[taskId(issueId, deptId)];
        return t || null;
    }
    function tasksOf(issueId) {
        var iss = issueById(issueId); if (!iss) return [];
        return (iss.depts || []).map(function (d) { return taskOf(issueId, d); }).filter(Boolean);
    }
    function newTask(issueId, deptId) {
        return {
            id: taskId(issueId, deptId), issueId: issueId, deptId: deptId,
            status: TST.TODO,
            assign: { state: ASG.NONE, to: '', toName: '', by: '', at: '', mode: '', reason: '', round: 0 },
            /* 확인 축은 improvement.confirm 과 필드명·어휘를 그대로 재사용한다(§4-3).
               undefined 는 WAIT 로 파생되므로 옛 데이터에 SKEY 범프가 필요 없다. */
            confirm: { state: CFM.WAIT, by: '', at: '', reason: '', round: 0 },
            files: [], naReason: '', submittedAt: '', submittedBy: '', reminds: [],
        };
    }

    /* 발행 — 멱등키로 중복을 막는다. 같은 회차 재발행은 거부하고 그 배치를 알려준다. */
    function issueBatch(templateId, periodKey, opts) {
        opts = opts || {};
        var tpl = T().byId(templateId); if (!tpl) return { ok: false, msg: '템플릿을 찾을 수 없습니다' };
        var key = issueKeyOf(templateId, periodKey);
        var dup = issueByKey(key);
        if (dup) return { ok: false, msg: '이미 발행된 배치가 있습니다', issue: dup };

        var d = load();
        var isAdhoc = String(periodKey).indexOf('ADHOC-') === 0;
        var period = isAdhoc ? null : periodsOf(tpl, +String(periodKey).slice(0, 4))
            .filter(function (p) { return p.key === periodKey; })[0];
        var pl = period ? planOne(tpl, period) : null;
        /* 발생시 — 회차 대신 발생일로 식별하고 기한은 발생일 + dueDays */
        if (isAdhoc && !opts.due) {
            opts.due = shift(addDays(opts.issuedAt || today(), tpl.dueDays || 14), +1);
        }
        d.seq++;
        var iss = {
            id: 'WI-' + String(periodKey).slice(0, 4) + '-' + pad(d.seq),
            templateId: templateId, periodKey: periodKey,
            periodLabel: isAdhoc ? ('발생시 · ' + String(periodKey).slice(6, 16)) : ((period && period.label) || periodKey),
            issueKey: key,
            origin: opts.origin || 'MANUAL', originRef: opts.originRef || null,
            status: IST.OPEN,
            issuedAt: opts.issuedAt || today(), issuedBy: opts.issuedBy || actor(),
            due: opts.due || (pl && pl.due) || (period && period.end) || '',
            /* 발행 시점 스냅샷 — 조직 개편이 과거 배치를 흔들면 안 된다 */
            depts: (opts.depts && opts.depts.length ? opts.depts : targetDepts(tpl, periodKey)).slice(),
            history: [{ type: 'CREATE', at: opts.issuedAt || today(), by: opts.issuedBy || actor(),
                        memo: (opts.origin === 'SCHEDULED' ? '정기 자동발행' : '발생시 수동 생성') +
                              ' · 대상 ' + (opts.depts || targetDepts(tpl, periodKey)).length + '개 부서' +
                              (opts.memo ? ' · ' + opts.memo : '') }],
        };
        d.issues.push(iss);
        iss.depts.forEach(function (dep) { d.tasks[taskId(iss.id, dep)] = newTask(iss.id, dep); });
        save();
        return { ok: true, issue: iss };
    }

    /* 대상 부서 조정 — 자동 파생이 늘 맞지는 않는다(회계과 폐지 · 작업환경측정
     * 속성 8곳 vs 실제 4곳). 주관부서가 조직도에서 빼거나 더한다.
     * **이미 제출한 부서는 뺄 수 없다** — 제출 기록이 사라지면 이력 변조가 된다. */
    function setIssueDepts(issueId, deptIds) {
        var iss = issueById(issueId); if (!iss) return { ok: false, msg: '배치를 찾을 수 없습니다' };
        var d = load();
        var keep = {}, add = [], del = [];
        (deptIds || []).forEach(function (x) { keep[x] = 1; });
        (iss.depts || []).forEach(function (dep) {
            if (keep[dep]) return;
            var t = taskOf(issueId, dep);
            if (t && (t.status === TST.SUBMITTED || deptDone(t) || (t.files || []).length)) {
                keep[dep] = 1;                       /* 제출·완료 건은 제외하지 않는다 */
                return;
            }
            del.push(dep);
        });
        (deptIds || []).forEach(function (dep) { if ((iss.depts || []).indexOf(dep) < 0) add.push(dep); });
        if (!add.length && !del.length) return { ok: true, add: 0, del: 0, locked: 0 };
        del.forEach(function (dep) { delete d.tasks[taskId(issueId, dep)]; });
        add.forEach(function (dep) { d.tasks[taskId(issueId, dep)] = newTask(issueId, dep); });
        var locked = (iss.depts || []).filter(function (dep) { return !keep[dep] ? false : (deptIds || []).indexOf(dep) < 0; });
        iss.depts = Object.keys(keep);
        if (add.length) pushHistory(iss, 'DEPT_ADD', add.map(deptName).join(' · '));
        if (del.length) pushHistory(iss, 'DEPT_DEL', del.map(deptName).join(' · '));
        save();
        return { ok: true, add: add.length, del: del.length, locked: locked.length };
    }

    function pushHistory(iss, type, memo) {
        iss.history = iss.history || [];
        iss.history.push({ type: type, at: today(), by: actor(), memo: memo || '' });
    }

    /* 회수 — 발행만 있고 지울 수단이 없으면 시연을 반복할수록 쌓여 발표가 망가진다 */
    function cancelIssue(id, memo) {
        var iss = issueById(id); if (!iss) return false;
        iss.status = IST.CANCELED;
        pushHistory(iss, 'CANCEL', memo || '');
        save(); return true;
    }
    function closeIssue(id, memo) {
        var iss = issueById(id); if (!iss) return false;
        iss.status = IST.CLOSED;
        pushHistory(iss, 'CLOSE', memo || '');
        save(); return true;
    }
    /* 회수 영향 — 확인 모달이 '무엇이 사라지는지'를 숫자로 밝힌다 */
    function cancelImpact(id) {
        var ts = tasksOf(id);
        return {
            depts: ts.length,
            assigned: ts.filter(function (t) { return t.assign.state === ASG.ASSIGNED; }).length,
            submitted: ts.filter(function (t) { return t.status === TST.SUBMITTED; }).length,
            files: ts.reduce(function (a, t) { return a + (t.files || []).length; }, 0),
        };
    }

    /* ================= 배정 ================= */
    function assign(issueId, deptId, uid, memo) {
        var t = taskOf(issueId, deptId); if (!t) return false;
        var cand = (R() && R().assignCandidates) ? R().assignCandidates(deptId) : [];
        var m = cand.filter(function (x) { return x.uid === uid; })[0];
        if (!m) return false;
        var self = R() && R().current && R().current().uid === uid;
        t.assign = {
            state: ASG.ASSIGNED, to: m.uid, toName: m.name, toTeam: m.team || '',
            by: (R() && R().current) ? R().current().uid : '', byName: actor(),
            at: today(), mode: self ? 'CLAIM' : 'ASSIGN', reason: memo || '',
            round: (t.assign.round || 0) + 1,
        };
        if (t.status === TST.TODO) t.status = TST.DOING;
        var iss = issueById(issueId);
        if (iss) pushHistory(iss, self ? 'CLAIM' : 'ASSIGN', deptName(deptId) + ' · ' + m.name);
        save(); return true;
    }
    /* 반송 — 배정받은 사람이 되돌린다. **사유 필수**이고 to 는 남긴다(누가 반송했는지) */
    function returnAssign(issueId, deptId, reason) {
        var t = taskOf(issueId, deptId); if (!t || !reason) return false;
        t.assign.state = ASG.RETURNED;
        t.assign.reason = reason;
        t.status = TST.TODO;
        var iss = issueById(issueId);
        if (iss) pushHistory(iss, 'RETURN_ASSIGN', deptName(deptId) + ' · ' + reason);
        save(); return true;
    }
    function unassign(issueId, deptId) {
        var t = taskOf(issueId, deptId); if (!t) return false;
        t.assign = newTask(issueId, deptId).assign;
        t.status = TST.TODO;
        save(); return true;
    }
    /* 배정 기한 — 전체 기간의 20%(최대 3근무일). 원자료에 배정 시점 컬럼이 없어
       **실측이 아니라 제안값**이다(DYPOLICY work-assign-sla). */
    function assignDue(iss) {
        if (!iss || !iss.due || !iss.issuedAt) return '';
        var span = V().daysTo(iss.due, iss.issuedAt);
        if (span == null) return '';
        var n = Math.max(1, Math.min(3, Math.ceil(span * 0.2)));
        return shift(addDays(iss.issuedAt, n), +1);
    }

    /* ================= 제출 · 확인 ================= */
    function submit(issueId, deptId, files, naReason) {
        var t = taskOf(issueId, deptId); if (!t) return false;
        t.files = files || [];
        t.naReason = naReason || '';
        t.status = TST.SUBMITTED;
        t.submittedAt = today();
        t.submittedBy = actor();
        /* 재제출은 확인을 WAIT 로 되돌리고 회차를 올린다 */
        t.confirm = { state: CFM.WAIT, by: '', at: '', reason: '', round: (t.confirm.round || 0) + 1 };
        var iss = issueById(issueId);
        if (iss) pushHistory(iss, 'SUBMIT', deptName(deptId));
        save(); return true;
    }
    /* 접수 확인·반려는 status 를 건드리지 않는다 (MUST) — §4-3 이 같은 이유로
       못박았다. 되돌리면 제출률이 롤백되어 취합 진척이 뒤로 간다. */
    function confirmTask(issueId, deptId) {
        var t = taskOf(issueId, deptId); if (!t) return false;
        t.confirm.state = CFM.OK; t.confirm.by = actor(); t.confirm.at = today(); t.confirm.reason = '';
        var iss = issueById(issueId);
        if (iss) pushHistory(iss, 'CONFIRM', deptName(deptId));
        save(); return true;
    }
    function returnTask(issueId, deptId, reason) {
        var t = taskOf(issueId, deptId); if (!t || !reason) return false;   /* 사유 없는 반려는 저장되지 않는다 */
        t.confirm.state = CFM.RETURNED; t.confirm.by = actor(); t.confirm.at = today(); t.confirm.reason = reason;
        var iss = issueById(issueId);
        if (iss) pushHistory(iss, 'RETURN', deptName(deptId) + ' · ' + reason);
        save(); return true;
    }

    /* ================= 재촉 ================= */
    /* 발신자는 로그인한 사람이다 — by:'재난안전과' 하드코딩이면 담양읍장이 눌러도
       재난안전과가 보낸 것으로 남는다(실제 고친 결함). */
    function remind(issueId, deptId, memo) {
        var t = taskOf(issueId, deptId); if (!t) return false;
        t.reminds = t.reminds || [];
        t.reminds.push({ at: today(), by: actor(), round: t.reminds.length + 1, memo: memo || '' });
        var iss = issueById(issueId);
        if (iss) pushHistory(iss, 'REMIND', deptName(deptId) + ' · ' + (t.reminds.length) + '차');
        save(); return true;
    }
    /* 촉구 '권고' 시점 — 실측 소요일의 올바른 용처는 기한이 아니라 리마인드다.
       실측 촉구 리드타임 21~49일, 촉구율 1.8%. 자동 발송하지 않고 권고만 한다. */
    function remindAdvice(iss) {
        if (!iss || iss.status !== IST.OPEN) return null;
        var tpl = T().byId(iss.templateId);
        var after = (tpl && tpl.remindAdvice && tpl.remindAdvice.after) || 21;
        var since = V().daysTo(today(), iss.issuedAt);
        if (since == null || since < after) return null;
        var open = tasksOf(iss.id).filter(function (t) { return !deptDone(t); });
        return open.length ? { n: open.length, after: after, depts: open.map(function (t) { return t.deptId; }) } : null;
    }

    /* ================= 완료 판정 — 단일 출처 ================= */
    /* profile:'menu' 는 그 도메인의 판정을 **읽어온다**. 자체 저장하지 않는다.
       파생 원본이 없으면 null 을 돌려주고 화면이 '판정 불가'를 드러낸다. */
    function probeDone(tpl, periodKey, deptId) {
        var p = tpl.doneProbe; if (!p) return null;
        var i = p.indexOf(':'), kind = p.slice(0, i), arg = p.slice(i + 1);
        try {
            if (kind === 'DEPTCHK') {
                var D = global.DEPTCHK; if (!D) return null;
                /* 회차 축을 key 에 넣는다 — 없으면 상·하반기가 한 행을 공유해
                   5월에 찍은 이행이 11월 업무를 발행 즉시 완료로 만든다. */
                return D.stateOf(arg + '|' + periodKey, deptId).status === 'DONE';
            }
            if (kind === 'EDU') {
                var E = global.DYEDU; if (!E) return null;
                if (arg === 'month') {
                    var mm = periodKey;                       /* '2026-07' */
                    return E.enrolls().some(function (en) {
                        if (en.deptId !== deptId) return false;
                        var c = E.courseOf(en.courseId);
                        return c && c.kind === 'REG_GROUP' && String(c.date || '').slice(0, 7) === mm;
                    });
                }
                /* ── 판정 기준이 업무마다 다르다 (MUST) ────────────────────
                 * '분기 교육 실시 **결과 제출**' 의 완료는 **결과가 있는가**이지
                 * 전원이 이수했는가가 아니다. 이수율 100% 로 잡으면 실측 이수율이
                 * 38~56% 인 부서는 **영원히 미완료**로 남아 회수율이 늘 0이 된다.
                 * 반대로 '미이수 조치'(W-EDU-CHK)는 미이수자가 0이 되어야 끝난다.
                 * 그래서 두 판정을 나눈다. */
                if (arg === 'quarter' || arg === 'half') {
                    var s0 = periodStartOf(tpl, periodKey), e0 = periodEndOf(tpl, periodKey);
                    return E.records().some(function (rc) {
                        if (!(rc.date >= s0 && rc.date <= e0)) return false;
                        var w = E.workerOf(rc.workerId);
                        return w && w.deptId === deptId;
                    });
                }
                /* 미이수 조치 — 그 회차 이수율이 100% 여야 끝난다 */
                if (arg === 'complete') {
                    var end2 = periodEndOf(tpl, periodKey);
                    var row = E.deptSummary(end2).filter(function (r) { return r.deptId === deptId; })[0];
                    return !!row && row.total > 0 && row.pct >= 100;
                }
                /* 관리감독자 정기교육 — 그 해 SUP_REG 교육에 그 부서가 신청했는가 */
                if (arg === 'supervisor') {
                    var y = String(periodKey).slice(0, 4);
                    return E.enrolls().some(function (en) {
                        if (en.deptId !== deptId) return false;
                        var c = E.courseOf(en.courseId);
                        return c && c.kind === 'SUP_REG' && String(c.date || '').slice(0, 4) === y;
                    });
                }
            }
            /* 위험성평가 — 정기평가 1건이 연 단위라 periodKey 의 연도로 찾는다 */
            if (kind === 'RSK') {
                var K = global.DYRSK; if (!K) return null;
                var yr = +String(periodKey).slice(0, 4);
                var a = (K.assessments() || []).filter(function (x) {
                    return x.type === 'REGULAR' && x.year === yr;
                })[0];
                if (!a) return false;                          /* 평가가 아직 생성되지 않았다 */
                var dp = (a.depts || []).filter(function (x) { return x.deptId === deptId; })[0];
                /* 그 회차 대상 부서가 아니면 **완료로 세지 않는다**(null = 판정 불가).
                 * true 를 돌려주면 아무것도 안 한 부서가 완료로 잡혀 회수율이 부풀고,
                 * 부풀린 수치는 아무도 들여다보지 않는다. 미완료로 남겨야 사람이
                 * "얘는 이 회차 대상이 아닌데?" 를 알아채고 대상 부서 산정을 고친다.
                 * 근본 해결은 대상 부서를 a.depts 와 맞추는 것이고 그건 별건이다. */
                if (!dp) return null;
                /* 설문조사표 제출 — 부서가 실제로 하는 일이다(양식 다운로드가 아니라 제출) */
                if (arg === 'survey') return !!dp.reportFile;
                /* 개선조치 — 그 부서 개선건이 전부 완료여야 한다. 0건이면 지적사항이 없었던 것 */
                if (arg === 'improve') {
                    var c = K.deptImpCount(a.id, deptId);
                    return !c || c.total === 0 || c.done >= c.total;
                }
            }
            /* 작업환경측정 — DYSH 는 부서를 **이름**으로 저장한다(§3 dept/deptId 이원화).
               DYV2.deptIdOf 로 환산해 비교한다. */
            if (kind === 'SH') {
                var H = global.DYSH; if (!H) return null;
                var yy = +String(periodKey).slice(0, 4);
                var half = String(periodKey).indexOf('H2') >= 0 ? 'H2' : 'H1';
                var rows = (H.workEnv() || []).filter(function (r) {
                    return r.year === yy && r.half === half &&
                           V().deptIdOf(r.dept) === deptId;
                });
                if (!rows.length) return true;                 /* 측정 대상 사업장이 없다 */
                return rows.every(function (r) { return !!r.done; });
            }
        } catch (e) { return null; }
        return null;
    }
    function periodStartOf(tpl, periodKey) {
        var y = +String(periodKey).slice(0, 4), k = tpl.schedule.kind;
        if (k === 'MONTH') return periodKey + '-01';
        if (k === 'HALF') return y + (String(periodKey).indexOf('H2') >= 0 ? '-07-01' : '-01-01');
        if (k === 'QUARTER') {
            var q = +String(periodKey).slice(-1);
            return y + '-' + pad((q - 1) * 3 + 1) + '-01';
        }
        return y + '-01-01';
    }
    function periodEndOf(tpl, periodKey) {
        var y = +String(periodKey).slice(0, 4);
        var hit = periodsOf(tpl, y).filter(function (p) { return p.key === periodKey; })[0];
        return hit ? hit.end : lastDay(y, 12);
    }
    /* 부서 업무 1건의 완료 여부 — 전 화면이 이 함수만 본다 */
    function deptDone(t) {
        if (!t) return false;
        var iss = issueById(t.issueId); if (!iss) return false;
        var tpl = T().byId(iss.templateId); if (!tpl) return false;
        if (tpl.profile === 'menu') {
            var p = probeDone(tpl, iss.periodKey, t.deptId);
            if (p !== null) return p;
            /* 판정 불가 — 제출 기록으로 폴백하고 화면이 그 사실을 밝힌다 */
        }
        if (t.naReason) return true;
        var need = (tpl.slots || []).filter(function (s) { return s.required; }).length;
        if (need) return (t.files || []).length >= need;
        return t.status === TST.SUBMITTED;
    }
    function probeAvailable(tpl) {
        if (tpl.profile !== 'menu' || !tpl.doneProbe) return true;
        var k = tpl.doneProbe.split(':')[0];
        return k === 'DEPTCHK' ? !!global.DEPTCHK : (k === 'EDU' ? !!global.DYEDU : false);
    }

    /* '할 일' 판정 — 노출 전용이다. 집계(제출률)는 이 함수를 쓰지 않는다.
       제출 후 확인 대기 중인 건은 담당자 할 일에서 빠진다(담당자는 할 게 없다).
       반려(confirm.RETURNED) 건은 다시 할 일로 올라온다 — 안 그러면 재제출
       수단이 완료 탭에 묻힌다(rsk 도메인에서 실제로 났던 결함). */
    function needsAction(t, uid) {
        if (!t) return false;
        if (uid && t.assign.to !== uid) return false;
        if (t.confirm && t.confirm.state === CFM.RETURNED) return true;
        if (deptDone(t)) return false;
        return t.status === TST.TODO || t.status === TST.DOING;
    }
    function isUnassigned(t) { return !t || t.assign.state !== ASG.ASSIGNED; }
    function overdue(t) {
        var iss = issueById(t.issueId); if (!iss || !iss.due) return false;
        return daysTo(dueOf(t)) < 0 && !deptDone(t);
    }
    function dueOf(t) {
        var iss = issueById(t.issueId);
        return (t && t.dueOverride) || (iss && iss.due) || '';
    }
    /* 미배정 지연은 지연과 따로 센다 — 책임자가 다르다(부서장 vs 담당자).
       판정 기준일도 제출 기한이 아니라 **배정 기한**이다. 반기 업무는 기한이
       반기말이라 due 기준으로 세면 배정이 6주 방치돼도 0으로 표시된다. */
    function assignOverdue(t) {
        if (!isUnassigned(t) || deptDone(t)) return false;
        var iss = issueById(t.issueId);
        var ad = assignDue(iss);
        return !!ad && daysTo(ad) < 0;
    }

    /* ================= 집계 ================= */
    function issueStat(iss) {
        var ts = tasksOf(iss.id);
        var done = ts.filter(deptDone).length;
        return {
            total: ts.length, done: done,
            open: ts.length - done,
            confirmed: ts.filter(function (t) { return t.confirm.state === CFM.OK; }).length,
            /* 이미 완료된 건은 배정 대상이 아니다 — 전용 화면에서 먼저 처리된 경우다 */
            unassigned: ts.filter(function (t) { return isUnassigned(t) && !deptDone(t); }).length,
            pct: ts.length ? Math.round(done / ts.length * 100) : 0,
        };
    }
    /* 부서 관점 — 조회 범위 밖은 애초에 넘기지 않는다 */
    function deptTasks(deptId) {
        var out = [];
        load().issues.forEach(function (iss) {
            if (iss.status === IST.CANCELED) return;
            if ((iss.depts || []).indexOf(deptId) < 0) return;
            var t = taskOf(iss.id, deptId);
            if (t) out.push(decorate(t, iss));
        });
        out.sort(function (a, b) { return String(a.due).localeCompare(String(b.due)); });
        return out;
    }
    /* 화면이 쓰기 좋은 형태로 파생값을 얹는다 — 저장하지 않는다 */
    function decorate(t, iss) {
        iss = iss || issueById(t.issueId);
        var tpl = T().byId(iss.templateId) || {};
        return Object.assign({}, t, {
            issue: iss, tpl: tpl,
            name: tpl.name || iss.templateId,
            periodLabel: iss.periodLabel,
            due: dueOf(t), dday: daysTo(dueOf(t)),
            done: deptDone(t), unassigned: isUnassigned(t),
            assignDue: assignDue(iss), assignLate: assignOverdue(t),
            overdue: overdue(t),
            deptName: deptName(t.deptId),
        });
    }
    function myTasks(uid, deptId) {
        return deptTasks(deptId).filter(function (t) { return t.assign.to === uid; });
    }

    /* ================= 시연 시드 ================= */
    /* 시연 기준일(DYV2.today() = 2026-07-16)에 **전 상태가 한 화면에** 보이도록
       심는다 — 기한초과·미제출·미배정·배정완료·제출·확인·종결·발행예정.
       상태·D-day 는 시드에 박지 않고 날짜에서 파생된다. */
    function seed() {
        db = blank();
        function mk(tplId, periodKey, opt) {
            var r = issueBatch(tplId, periodKey, Object.assign({ origin: 'SCHEDULED' }, opt || {}));
            return r.ok ? r.issue : null;
        }
        function setTask(iss, deptId, patch) {
            if (!iss) return;
            var t = db.tasks[taskId(iss.id, deptId)];
            if (t) Object.assign(t, patch);
        }
        function asg(iss, deptId, uid, name, at, team) {
            setTask(iss, deptId, {
                status: TST.DOING,
                assign: { state: ASG.ASSIGNED, to: uid, toName: name, toTeam: team || '',
                          by: 'seed', byName: deptName(deptId) + ' 부서장', at: at, mode: 'ASSIGN', reason: '', round: 1 },
            });
        }
        function sub(iss, deptId, at, files) {
            setTask(iss, deptId, {
                status: TST.SUBMITTED, submittedAt: at, submittedBy: deptName(deptId),
                files: files || [{ name: deptName(deptId) + '_제출.pdf', size: 240000 }],
            });
        }

        /* ① 상반기 중대산업재해 이행점검 — 발행 05-14 · 기한 06-30 → **기한 초과**
              완료 판정은 DEPTCHK 시드(5개 부서 이행)에서 파생된다. */
        var a = mk('W-CMP-IND', '2026-H1', { issuedAt: '2026-05-14', issuedBy: '재난안전과 박안전' });
        if (a) {
            asg(a, 'water', 'u_wat3', '하정수', '2026-05-18', '정수팀');
            asg(a, 'env', 'u_env2', '정환경', '2026-05-19');
            asg(a, 'construct', 'u_con3', '김도현', '2026-05-20', '안전관리팀');
            asg(a, 'facility', 'u_fac3', '한운영', '2026-05-21', '시설운영팀');
            sub(a, 'water', '2026-06-29'); sub(a, 'env', '2026-06-30'); sub(a, 'construct', '2026-06-30');
            setTask(a, 'water', { confirm: { state: CFM.OK, by: '재난안전과 박안전', at: '2026-07-01', reason: '', round: 1 } });
            setTask(a, 'env', { confirm: { state: CFM.RETURNED, by: '재난안전과 박안전', at: '2026-07-02',
                                           reason: '증빙 사진이 점검표와 다른 장소입니다 — 해당 사업장 사진으로 다시 올려주세요', round: 1 } });
            /* 미배정 잔류 — 부서장 화면의 '미배정 지연'을 시연한다 */
            db.tasks[taskId(a.id, 'culture')].reminds = [{ at: '2026-07-08', by: '재난안전과 박안전', round: 1, memo: '' }];
            pushHistory(a, 'REMIND', '문화체육과 · 1차');
        }

        /* ② 상반기 중대시민재해 이행점검 — 시설 보유 부서만 */
        var b = mk('W-CMP-CIV', '2026-H1', { issuedAt: '2026-05-15', issuedBy: '재난안전과 박안전' });
        if (b) {
            asg(b, 'facility', 'u_fac4', '민설비', '2026-05-20', '환경시설팀');
            asg(b, 'water', 'u_wat4', '오수질', '2026-05-20', '수질관리팀');
            sub(b, 'facility', '2026-06-27'); sub(b, 'water', '2026-06-30');
        }

        /* ③ 7월 현업근로자 정기교육 — **일부러 발행하지 않는다.**
         * 시연 기준일(2026-07-16) 기준으로 발행일 07-14 가 이미 지났으므로
         * 업무 관리 화면 '다음 자동 발행'에 **[발행일 도래] + [지금 발행]** 으로 뜬다.
         * 이게 없으면 시연에서 '자동 발행'을 눌러 보이는 장면 자체가 없다 —
         * 화면에 미래 날짜만 나열되고 아무 일도 일어나지 않는다.
         * 누르면 근로자 명단 보유 10개 부서에 한꺼번에 생성되고, 각 부서의
         * '부서 업무함'과 담당자 '내 할일'에 배정 대기로 즉시 나타난다. */

        /* ④ 2분기 안전보건교육 결과 — 발행 07-01 · 기한 07-29 → 진행 중 */
        var d2 = mk('W-EDU-QTR', '2026-Q2', { issuedAt: '2026-07-01', issuedBy: '재난안전과 박안전' });
        if (d2) {
            asg(d2, 'facility', 'u_fac3', '한운영', '2026-07-03', '시설운영팀');
            /* 물순환사업소는 **일부러 비워 둔다** — 부서장이 팀원에게 배정하는 장면이
               시연의 핵심인데, 시드가 전부 배정돼 있으면 누를 것이 없다. */
        }

        /* ⑤ 하반기 관리감독자 지정 — **일부러 발행하지 않는다.**
         * 발행일 07-03 이 시연 기준일보다 앞서므로 '발행일 도래'로 뜨고,
         * [지금 발행]을 누르면 **11개 부서 전부가 미배정**이 된다(attach 프로필이라
         * 연동 완료 파생이 없다). 그래야 '발행 → 부서 도착 → 부서장이 배정' 이
         * 한 흐름으로 보인다. 기한이 07-17(D-1)이라 긴박감도 함께 보인다.
         * ※ ③ 월교육과 대비된다 — 월교육은 발행하면 8/10 이 이미 완료로 잡혀
         *   '연동이 살아 있다'를 보여주고, 이쪽은 '배정이 필요하다'를 보여준다. */

        /* ⑥ 2분기 산업안전보건위원회 — 발행 06-12 · 기한 06-30 → 종결 */
        var f = mk('W-CMT-QTR', '2026-Q2', { issuedAt: '2026-06-12', issuedBy: '재난안전과 박안전' });
        if (f) {
            (f.depts || []).forEach(function (dep) {
                sub(f, dep, '2026-06-22', [{ name: deptName(dep) + '_2분기_회의록.pdf', size: 310000, slot: '회의록' }]);
                setTask(f, dep, { confirm: { state: CFM.OK, by: '재난안전과 박안전', at: '2026-06-25', reason: '', round: 1 } });
            });
            f.status = IST.CLOSED;
            pushHistory(f, 'CLOSE', '전 부서 회수 완료');
        }

        /* ⑦ 2026 중대재해 예방 안전계획 — 발행 02-04 · 기한 03-09 → 종결(촉구 이력 포함) */
        var g = mk('W-PLN-ANN', '2026', { issuedAt: '2026-02-04', issuedBy: '재난안전과 박안전' });
        if (g) {
            (g.depts || []).forEach(function (dep, i) {
                if (i % 4 === 3) return;                     /* 일부 미제출 — 촉구 대상이었던 부서 */
                sub(g, dep, '2026-03-06', [{ name: deptName(dep) + '_안전계획서.hwpx', size: 420000, slot: '안전계획서' }]);
                setTask(g, dep, { confirm: { state: CFM.OK, by: '재난안전과 박안전', at: '2026-03-12', reason: '', round: 1 } });
            });
            pushHistory(g, 'REMIND', '미제출 부서 · 1차 (2026-03-10 촉구)');
            g.status = IST.CLOSED;
            pushHistory(g, 'CLOSE', '반기 취합 종료 · 미제출 부서는 다음 회차로 이월');
        }

        save();
        return db;
    }
    function reset() { db = null; try { global.sessionStorage.removeItem(SKEY); } catch (e) {} return load(); }

    global.DYWORK = {
        IST: IST, IST_LABEL: IST_LABEL, TST: TST, TST_LABEL: TST_LABEL,
        ASG: ASG, CFM: CFM, HLABEL: HLABEL,
        /* 파생 */
        today: today, planOf: planOf, periodsOf: periodsOf, upcoming: upcoming, due2issue: due2issue,
        autoIssue: autoIssue,
        missedIssues: missedIssues,
        targetDepts: targetDepts, deptName: deptName, assignDue: assignDue,
        /* 조회 */
        issues: issues, issueById: issueById, issueByKey: issueByKey, issueKeyOf: issueKeyOf,
        taskOf: taskOf, tasksOf: tasksOf, deptTasks: deptTasks, myTasks: myTasks, decorate: decorate,
        issueStat: issueStat, remindAdvice: remindAdvice,
        /* 판정 */
        deptDone: deptDone, needsAction: needsAction, isUnassigned: isUnassigned,
        overdue: overdue, assignOverdue: assignOverdue, dueOf: dueOf, probeAvailable: probeAvailable,
        /* 변경 */
        issueBatch: issueBatch, setIssueDepts: setIssueDepts, cancelIssue: cancelIssue, closeIssue: closeIssue, cancelImpact: cancelImpact,
        assign: assign, returnAssign: returnAssign, unassign: unassign,
        submit: submit, confirmTask: confirmTask, returnTask: returnTask, remind: remind,
        reset: reset, _seed: seed,
    };
})(window);
