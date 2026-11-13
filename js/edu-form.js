/* =====================================================================
   edu-form.js · 교육 등록 폼 공용 조립 블록 (EDUFORM)
   ---------------------------------------------------------------------
   자체교육(EDUR)·채용시교육(EDUH)이 '동일한 팝업 구성'을 공유하도록,
   회차(일자 탭)·첨부파일·교육 사진 UI 와 그 캡처·검증을 단일 출처로 제공한다.
   화면 모듈은 자기 F(폼 객체)와 네임스페이스 문자열(inline onclick 위임용)만 넘긴다.

   폼 객체 규약: F.sessions:[{date,start,end}] · F.sIdx · F.files:[{name}] · F.photos:[{name}]
   입력 id 는 두 화면이 공유(동시에 열리는 모달은 1개 — 단일 모달 규칙):
     회차 eduf-s-date / eduf-s-start / eduf-s-end
   로드 순서: common.js → edu-data.js → edu-filter.js → edu-form.js → 화면 모듈
   전역: EDUFORM.*
   ===================================================================== */
(function (global) {
    'use strict';
    var V = function () { return global.DYV2; };
    var E = function () { return global.DYEDU; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }

    var MAX_SESSIONS = 5;

    /* ===== 회차(일자 탭) ===== */
    function sessHours(s) { return E().sessionHours(s); }
    function totalHours(F) { return E().sumSessionHours(F.sessions); }
    function addDays(iso, n) {
        var p = String(iso || '').split('-');
        if (p.length !== 3) return iso;
        var d = new Date(+p[0], +p[1] - 1, +p[2] + n);
        var mm = d.getMonth() + 1, dd = d.getDate();
        return d.getFullYear() + '-' + (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd;
    }
    function mdLabel(iso) {
        var p = String(iso || '').split('-');
        return p.length === 3 ? p[1] + '/' + p[2] : '일자 미정';
    }
    /* 기본 회차 1건 */
    function newSession(o) {
        o = o || {};
        return { date: o.date || E().today(), start: o.start || '14:00', end: o.end || '17:00' };
    }

    /* 회차 탭 + 활성 회차 입력 + 자동 산정 총 교육시간.
     * ns = 'EDUR' | 'EDUH' — 각 화면 모듈이 sessTab/sessAdd/sessDel/sessSync 위임 래퍼를 노출한다. */
    function renderSessions(F, ns, opts) {
        opts = opts || {};
        /* 합계 캡션 — 자체·집합은 '교육 시간'(=이수 인정), 채용시는 '행사 진행 시간'(인정은 필요시간 별도) */
        var totalCaption = opts.totalCaption || '교육 시간';
        var n = F.sessions.length;
        var idx = Math.min(F.sIdx, n - 1);
        var cur = F.sessions[idx];
        var total = totalHours(F);
        var curH = sessHours(cur);
        var invalid = cur.start && cur.end && curH === 0;

        var tabs = F.sessions.map(function (s, i) {
            var h = sessHours(s);
            return '<button type="button" class="edu-sess-tab' + (i === idx ? ' active' : '') + '"' +
                ' aria-pressed="' + (i === idx ? 'true' : 'false') + '"' +
                ' onclick="' + ns + '.sessTab(' + i + ')">' +
                '<b>' + (i + 1) + '회차</b> <span>' + esc(mdLabel(s.date)) + (h ? ' · ' + h + 'h' : '') + '</span>' +
            '</button>';
        }).join('');
        var addBtn = n < MAX_SESSIONS
            ? '<button type="button" class="edu-sess-add" onclick="' + ns + '.sessAdd()">＋ 일자 추가</button>'
            : '<span class="edu-sess-max">최대 ' + MAX_SESSIONS + '일</span>';

        return '<div class="edu-modal-row">' +
            '<label class="form-label">교육 일자 · 시간 <span style="color:var(--status-danger-fg)">*</span> ' +
                '<span style="color:var(--text-gray);font-weight:var(--fw-regular);">(일자별로 탭을 추가 · 최대 ' + MAX_SESSIONS + '일)</span></label>' +
            '<div class="edu-sess-tabs" role="group" aria-label="교육 회차">' + tabs + addBtn + '</div>' +
            '<div class="edu-sess-panel">' +
                '<div class="edu-sess-grid">' +
                    '<div><label class="form-label" for="eduf-s-date">일자</label>' +
                        '<input type="date" class="form-input" id="eduf-s-date" value="' + esc(cur.date || '') + '" onchange="' + ns + '.sessSync()"></div>' +
                    '<div><label class="form-label" for="eduf-s-start">시작 시각</label>' +
                        '<input type="time" class="form-input" id="eduf-s-start" value="' + esc(cur.start || '') + '" onchange="' + ns + '.sessSync()"></div>' +
                    '<div><label class="form-label" for="eduf-s-end">종료 시각</label>' +
                        '<input type="time" class="form-input" id="eduf-s-end" value="' + esc(cur.end || '') + '" onchange="' + ns + '.sessSync()"></div>' +
                '</div>' +
                '<div class="edu-sess-foot">' +
                    (invalid
                        ? '<span class="edu-sess-warn" role="alert">종료 시각이 시작 시각보다 빠르거나 같습니다 — 이 회차는 0h로 계산됩니다.</span>'
                        : '<span class="edu-sess-calc">이 회차 <b>' + curH + 'h</b> 자동 산정</span>') +
                    (n > 1
                        ? '<button type="button" class="edu-sess-del" onclick="' + ns + '.sessDel(' + idx + ')">이 일자 삭제</button>'
                        : '') +
                '</div>' +
            '</div>' +
            '<div class="edu-sess-total">' + totalCaption + ' 합계 <b>' + total + 'h</b> ' +
                '<span>(' + n + '일 · 회차 시간 자동 합산)</span></div>' +
        '</div>';
    }
    /* 재렌더 전 활성 회차 입력 보존 */
    function captureSessions(F) {
        var el = document.getElementById('eduf-s-date');
        if (!el) return;
        var idx = Math.min(F.sIdx, F.sessions.length - 1);
        var cur = F.sessions[idx];
        if (!cur) return;
        cur.date = el.value;
        cur.start = (document.getElementById('eduf-s-start') || {}).value || '';
        cur.end = (document.getElementById('eduf-s-end') || {}).value || '';
    }
    function sessAdd(F) {
        if (F.sessions.length >= MAX_SESSIONS) return false;
        var last = F.sessions[F.sessions.length - 1];
        /* 다음 날 같은 시간대를 기본값으로 — 연속 일정이 가장 흔하다 */
        F.sessions.push({ date: addDays(last.date, 1), start: last.start, end: last.end });
        F.sIdx = F.sessions.length - 1;
        return true;
    }
    function sessDel(F, i) {
        if (F.sessions.length <= 1) return;
        F.sessions.splice(i, 1);
        F.sIdx = Math.max(0, Math.min(F.sIdx, F.sessions.length - 1));
    }
    /* 저장 대표값(date·time·endTime·hours)은 회차에서만 파생 — 검증 후 payload 반환.
     * 반환: {ok:false, badIdx, msg} 또는 {ok:true, payload:{sessions,date,time,endTime,hours}} */
    function sessionPayload(F) {
        for (var i = 0; i < F.sessions.length; i++) {
            var s = F.sessions[i];
            if (!s.date || !s.start || !s.end || sessHours(s) <= 0) {
                return { ok: false, badIdx: i, msg: (i + 1) + '회차의 일자·시작·종료 시각을 확인하세요 (종료가 시작보다 뒤여야 합니다).' };
            }
        }
        var ss = F.sessions.slice().sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); });
        return { ok: true, payload: { sessions: ss, date: ss[0].date, time: ss[0].start, endTime: ss[0].end, hours: E().sumSessionHours(ss) } };
    }

    /* ===== 첨부파일 — 교육 형식별 슬롯 프로필 (2026-07-30 회의 반영) =====
     * 'group' 집합교육 : 등록 시점에는 교육이 아직 실시 전이므로 **참석자 명단·교육 자료 2칸만** 둔다.
     *                    교육 사진은 실시 후에 생기므로 등록 단계에서 요구하지 않는다.
     *                    ("계획서·교재" 라는 표현도 쓰지 않는다 — 발주처가 직접 금지)
     * 'done'  자체·채용시·기타 : 실시한 뒤 기록하는 형식이라 증빙이 **한 파일로** 올라온다.
     *                    "교육일지 및 교육사진 등" 한 칸으로 합친다 — 칸을 쪼개면 어디에 넣을지 헷갈린다.
     * 저장 스키마는 그대로 F.files[] 이고, 어느 칸에서 올렸는지만 file.slot 으로 함께 남긴다.
     * 드롭존은 접근성 렌더러 DYV2.uploadDrop 만 사용(CLAUDE.md §2). */
    var ATTACH_SLOTS = {
        group: [
            /* 드롭 칸 굵은 글씨는 칸마다 «파일 첨부»로 같다(운영 화면과 같음 — 위 라벨이 칸 이름이다).
             * 참석자 명단(서명 포함) — 운영 화면과 같은 이름으로 맞춘다(2026-11-13 사용자 지시, 종전 «서명부 양식»).
             * 교육 때 쓸 참석자 명단·출석부(서명란 포함)를 붙인다. 교육 뒤 부서가 서명받은 스캔본을 등록부로 올린다. */
            { key: 'roster',   label: '참석자 명단', note: '서명 포함', drop: '파일 첨부', sub: '참석자 명단·출석부' },
            { key: 'material', label: '교육 자료',   sub: '교육에 사용할 자료' }
        ],
        done: [
            { key: 'log', label: '교육일지 및 교육사진 등', sub: '교육일지·교육사진 등 실시 증빙' }
        ]
    };
    var SLOT_FILENAME = { roster: '참석자명단', material: '교육자료', log: '교육일지_교육사진' };
    /* slot 이 없는 파일(슬롯 도입 전에 저장된 것)은 **그 프로필의 첫 칸**에 보여준다.
     * 무조건 'log' 로 보면 집합교육(roster·material) 수정 화면에서 기존 첨부가 통째로
     * 사라져 보이는데, 데이터에는 남아 있어 화면과 저장값이 어긋난다. */
    function slotOf(f, slots) {
        if (f && f.slot) return f.slot;
        return (slots && slots[0] && slots[0].key) || 'log';
    }

    function fileListHtml(files, ns, slotKey, slots) {
        var rows = (files || []).map(function (f, i) { return { f: f, i: i }; })
            .filter(function (x) { return slotOf(x.f, slots) === slotKey; });
        if (!rows.length) return '';
        return '<ul class="edu-attach-list">' + rows.map(function (x) {
            return '<li><span class="edu-attach-name">📎 ' + esc(x.f.name) + '</span>' +
                '<button type="button" class="edu-attach-del" onclick="' + ns + '.delFile(' + x.i + ')" aria-label="' + esc(x.f.name) + ' 삭제">×</button></li>';
        }).join('') + '</ul>';
    }
    /* profile: 'group' | 'done'(기본) */
    function renderAttach(F, ns, profile) {
        var slots = ATTACH_SLOTS[profile] || ATTACH_SLOTS.done;
        return slots.map(function (s) {
            return '<div class="edu-modal-row"><label class="form-label">' + s.label +
                    (s.note ? ' <span class="edu-drop-sub">(' + s.note + ')</span>' : '') + '</label>' +
                V().uploadDrop(
                    '<b>' + (s.drop || '파일 첨부') + '</b> <span class="edu-drop-sub">' + s.sub + ' (클릭 또는 끌어놓기)</span>',
                    ns + '.addFile(\'' + s.key + '\')', { hint: true, style: 'padding:12px;' }) +
                fileListHtml(F.files, ns, s.key, slots) +
            '</div>';
        }).join('');
    }
    function addFile(F, slotKey) {
        F.files = F.files || [];
        if (F.files.length >= V().FILE_LIMITS.maxCount) { V().toast('첨부는 최대 ' + V().FILE_LIMITS.maxCount + '개까지 가능합니다.'); return; }
        var key = slotKey || 'log';
        var n = F.files.filter(function (f) { return f.slot === key; }).length + 1;
        F.files.push({ name: (SLOT_FILENAME[key] || '첨부') + '_' + n + '.pdf', slot: key });
    }
    function delFile(F, i) { if (F.files) F.files.splice(i, 1); }

    /* ===== 참석자 등록부 — 실제 참석시간 (2026-11-13) =====
     * 집합교육의 인정시간은 등록부의 **사람별** 실제 참석시간이다(CLAUDE.md §4 · SCR-EDU-004 §6).
     * 대부분은 전원이 같은 시간이므로 «모두에게 같은 시간» 한 칸을 기본으로 두고(비우면 전 회차),
     * 일찍 나간 사람만 사람별 칸에 적는다(비우면 위 시간). 부서 등록(목록·상세)과 일괄 등록이 같은 블록을 쓴다.
     * 폼 객체 규약: H.actualHours(문자열|숫자, '' = 전 회차) · H.hoursBy{workerId: 문자열} · H.hoursOpen
     * 입력 id: eduf-h-all · eduf-h-<workerId> (동시에 열리는 모달은 1개라 겹치지 않는다) */
    function hoursBlockHtml(H, people, courseHours, ns) {
        H.hoursBy = H.hoursBy || {};
        var diff = people.filter(function (w) { var v = H.hoursBy[w.id]; return v != null && v !== ''; }).length;
        var all = H.actualHours == null ? '' : H.actualHours;
        return '<div class="edu-modal-row"><label class="form-label" for="eduf-h-all">실제 참석시간 — 모두에게 같은 시간</label>' +
            '<input type="number" class="form-input" id="eduf-h-all" min="0.1" max="' + courseHours + '" step="0.1" value="' + esc(all) + '" placeholder="전 회차 ' + courseHours + 'h" style="max-width:160px;">' +
            '<p class="file-hint" style="margin:4px 0 0;">비우면 전 회차 참석(' + courseHours + 'h)입니다. 교육 시간 ' + courseHours + 'h를 넘을 수 없습니다.</p>' +
            (people.length
                ? '<details style="margin-top:6px;"' + (H.hoursOpen ? ' open' : '') + ' ontoggle="' + ns + '.hoursOpen(this.open)">' +
                    '<summary style="cursor:pointer;font-size:var(--fs-13);">사람별로 다르게 적기 <span class="file-hint">(선택 ' + people.length + '명' + (diff ? ' · 따로 적은 ' + diff + '명' : '') + ')</span></summary>' +
                    '<p class="file-hint" style="margin:6px 0;">일찍 나가거나 늦게 온 사람만 적습니다. 비우면 위 시간을 씁니다.</p>' +
                    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:var(--sp-1-5, 6px) var(--sp-3, 12px);">' +
                    people.map(function (w) {
                        var v = H.hoursBy[w.id];
                        return '<label style="display:flex;align-items:center;gap:6px;font-size:var(--fs-13);"><span style="flex:1;">' + esc(w.name) +
                            (w.deptLabel ? ' <span class="file-hint">' + esc(w.deptLabel) + '</span>' : '') + '</span>' +
                            '<input type="number" class="form-input" id="eduf-h-' + esc(w.id) + '" min="0.1" max="' + courseHours + '" step="0.1" value="' + esc(v == null ? '' : v) + '" placeholder="같은 시간" style="width:96px;" aria-label="' + esc(w.name) + ' 실제 참석시간"></label>';
                    }).join('') + '</div></details>'
                : '') +
            '</div>';
    }
    function captureHours(H) {
        var d = global.document;
        var a = d.getElementById('eduf-h-all');
        if (a) H.actualHours = a.value;
        H.hoursBy = H.hoursBy || {};
        Array.prototype.forEach.call(d.querySelectorAll('input[id^="eduf-h-"]'), function (el) {
            if (el.id === 'eduf-h-all') return;
            H.hoursBy[el.id.slice(7)] = el.value;
        });
    }
    /* 저장 값 — { ok, why, actualHours(숫자|null), hoursBy({id:숫자}) }. 공통값과 같은 사람별 값은 담지 않는다 */
    function hoursPayload(H, ids, courseHours) {
        var bad = function (v) { return !(+v > 0 && +v <= courseHours); };
        var all = (H.actualHours == null || H.actualHours === '') ? null : +H.actualHours;
        if (all != null && bad(all)) return { ok: false, why: '실제 참석시간은 0보다 크고 교육 시간(' + courseHours + 'h) 이하로 적습니다.' };
        var base = all == null ? courseHours : all, by = {}, n = 0;
        for (var i = 0; i < ids.length; i++) {
            var v = (H.hoursBy || {})[ids[i]];
            if (v == null || v === '') continue;
            if (bad(v)) return { ok: false, why: '사람별 실제 참석시간은 0보다 크고 교육 시간(' + courseHours + 'h) 이하로 적습니다.' };
            if (+v !== base) { by[ids[i]] = +v; n++; }
        }
        return { ok: true, actualHours: all, hoursBy: n ? by : null, exceptions: n };
    }
    /* 서명부는 한 파일이다 — 공용 안내(DYV2.fileHint)의 개수만 «1개»로 바꿔 쓴다(업로드 칸 모양은 그대로, §2) */
    function oneFile(html) { return String(html || '').replace(/(<b>최대<\/b> )\d+개/, function (m, p) { return p + '1개'; }); }

    global.EDUFORM = {
        MAX_SESSIONS: MAX_SESSIONS, newSession: newSession,
        renderSessions: renderSessions, captureSessions: captureSessions,
        sessAdd: sessAdd, sessDel: sessDel, sessionPayload: sessionPayload, totalHours: totalHours,
        ATTACH_SLOTS: ATTACH_SLOTS,
        renderAttach: renderAttach, addFile: addFile, delFile: delFile,
        hoursBlockHtml: hoursBlockHtml, captureHours: captureHours, hoursPayload: hoursPayload, oneFile: oneFile
    };
})(window);
