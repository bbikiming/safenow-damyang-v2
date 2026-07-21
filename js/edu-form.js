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
                '<span style="color:var(--text-lightgray);font-weight:var(--fw-regular);">(일자별로 탭을 추가 · 최대 ' + MAX_SESSIONS + '일)</span></label>' +
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

    /* ===== 첨부파일(문서) + 교육 사진 =====
     * 드롭존은 접근성 렌더러 DYV2.uploadDrop 만 사용(CLAUDE.md §2).
     * ns 모듈이 addFile/delFile/addPhoto/delPhoto 위임 래퍼를 노출한다. */
    function photoHint() {
        var L = V().FILE_LIMITS;
        return '<p class="file-hint">이미지 <b>JPG·PNG</b> <span class="fh-sep">·</span> <b>파일당 최대</b> ' +
            L.maxMB + 'MB <span class="fh-sep">·</span> <b>최대</b> ' + L.maxCount + '장</p>';
    }
    function fileListHtml(files, ns) {
        if (!files || !files.length) return '';
        return '<ul class="edu-attach-list">' + files.map(function (f, i) {
            return '<li><span class="edu-attach-name">📎 ' + esc(f.name) + '</span>' +
                '<button type="button" class="edu-attach-del" onclick="' + ns + '.delFile(' + i + ')" aria-label="' + esc(f.name) + ' 삭제">×</button></li>';
        }).join('') + '</ul>';
    }
    function photoListHtml(photos, ns) {
        if (!photos || !photos.length) return '';
        return '<div class="edu-photo-grid">' + photos.map(function (p, i) {
            return '<div class="edu-photo-chip"><span class="edu-photo-thumb" aria-hidden="true">🖼️</span>' +
                '<span class="edu-photo-name">' + esc(p.name) + '</span>' +
                '<button type="button" class="edu-attach-del" onclick="' + ns + '.delPhoto(' + i + ')" aria-label="' + esc(p.name) + ' 삭제">×</button></div>';
        }).join('') + '</div>';
    }
    function renderAttach(F, ns) {
        var files = F.files || [], photos = F.photos || [];
        var fileDrop = V().uploadDrop(
            '<b>파일 첨부</b> <span class="edu-drop-sub">계획서·교재·출석부 등 (클릭 또는 끌어놓기 · 프로토타입)</span>',
            ns + '.addFile()', { hint: true, style: 'padding:12px;' });
        var photoDrop = V().uploadDrop(
            '<b>사진 첨부</b> <span class="edu-drop-sub">교육 진행 사진 (클릭 또는 끌어놓기 · 프로토타입)</span>',
            ns + '.addPhoto()', { style: 'padding:12px;' });
        return '<div class="edu-modal-row"><label class="form-label">첨부파일 (계획서·교재 등)</label>' +
                fileDrop + fileListHtml(files, ns) +
            '</div>' +
            '<div class="edu-modal-row"><label class="form-label">교육 사진</label>' +
                photoDrop + photoHint() + photoListHtml(photos, ns) +
            '</div>';
    }
    function addFile(F) {
        F.files = F.files || [];
        if (F.files.length >= V().FILE_LIMITS.maxCount) { V().toast('첨부는 최대 ' + V().FILE_LIMITS.maxCount + '개까지 가능합니다.'); return; }
        F.files.push({ name: '첨부_' + (F.files.length + 1) + '.pdf' });
    }
    function delFile(F, i) { if (F.files) F.files.splice(i, 1); }
    function addPhoto(F) {
        F.photos = F.photos || [];
        if (F.photos.length >= V().FILE_LIMITS.maxCount) { V().toast('사진은 최대 ' + V().FILE_LIMITS.maxCount + '장까지 가능합니다.'); return; }
        F.photos.push({ name: '교육사진_' + (F.photos.length + 1) + '.jpg' });
    }
    function delPhoto(F, i) { if (F.photos) F.photos.splice(i, 1); }

    global.EDUFORM = {
        MAX_SESSIONS: MAX_SESSIONS, newSession: newSession,
        renderSessions: renderSessions, captureSessions: captureSessions,
        sessAdd: sessAdd, sessDel: sessDel, sessionPayload: sessionPayload, totalHours: totalHours,
        renderAttach: renderAttach, addFile: addFile, delFile: delFile, addPhoto: addPhoto, delPhoto: delPhoto
    };
})(window);
