/* =====================================================================
   dept-check.js · 부서 전수 이행 체크리스트 (전역 DEPTCHK)
   ---------------------------------------------------------------------
   2026-07-30 회의에서 확정된 "부서·사업장 단위로 했는지 안 했는지 훑는" 화면의 공용 엔진.

     참석자4 "그럼 그 부서가 그게 걸어져 있는지 안 걸어져 있는지 확인하게끔 체크리스트를
              만들어야 될 거 아니야 … 과 쭈르륵 사업소 쭈르륵 해가지고 돼 있는지 안 돼 있는지"
     참석자4 "여기 39개잖아요 … 전체가 리스트가 쭈르륵 나와가지고 얘네들이 증빙 자료
              조그마하게 사진 다 들게 하고 체크리스트 만들어가지고 얘가 안 했는지 했는지
              안 했으면 거기다 전화하면 되잖아"
     참석자3 "어차피 이 시스템 존재 자체가 증빙 역할이니까 … 작은 거는 다 자료가 들어가야"

   같은 표를 **경영방침 게시 현황**과 **의무 이행점검** 두 곳이 쓴다. 회의 결론이
   "경영방침 원본은 계획에서, 게시 여부는 이행점검에서 확인"이라 두 화면이 같은 축(부서)을
   공유하기 때문이다. 화면마다 표를 새로 짜지 말고 이 모듈을 재사용할 것.

   ── '해당없음'을 특별히 다루는 이유 ──────────────────────────────────
   발주처가 실제 종이 서식을 펼쳐 놓고 지적한 실패 모드가 "미이행"이 아니라
   **'해당 없음'으로 적고 빠져나가는 것**이었다.
     참석자1 "이 사람은 안 한 거죠. 개판이네 누구야 도시과 뭘 해야 되는데 원래 해야 돼요
              해당 없어 나 이해가 안 되네."
   그래서 해당없음은 사유 없이 고를 수 없고, 고르면 '사유 확인 필요'로 남아 미이행과
   같은 관리 대상이 된다. 체크박스 하나로 끝내면 종이 서식의 문제를 그대로 옮기게 된다.

   ── 부서 명단 갭 ────────────────────────────────────────────────────
   회의에서 대상은 "과 + 사업소 39개"로 확인됐는데 DYV2.ORG 에는 11개만 있다.
   그럴듯하게 지어내지 않고 화면에 '미등록'으로 드러낸다(CLAUDE.md 말미 원칙).
   실제 명단을 받으면 DYV2.ORG 한 곳만 늘리면 이 화면들은 자동으로 따라온다.
   ===================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }
    /* ===== 권한 (CLAUDE.md §12) =====
     * 이 표는 부서 전수 점검표다 — **표는 전 부서를 보여주되**(전수 점검이 목적),
     * 각 행의 '확인 등록·독촉'은 그 부서 담당자와 주관부서만 할 수 있다.
     * 관리·감독(군수·과장·소장)은 조회만 한다 — 담당자 이름으로 대신 등록하면 문서 위조다. */
    function R() { return global.DYROLE; }
    function canAct(deptId) { return !R() || R().canAct(deptId); }
    function denied(deptId) {
        var p = R() && R().current ? R().current() : null;
        toast(p && p.tier !== 'staff'
            ? '관리감독자는 조회만 합니다 — 확인 등록은 담당자 본인이 수행합니다.'
            : '해당 부서 담당자와 주관부서(재난안전과)만 등록할 수 있습니다.');
    }

    /* v3 — key 에 **회차 축**이 들어갔다(2026-08-10).
 * 종전 rowKey(key, deptId) 에는 회차가 없어 상·하반기가 한 행을 공유했다.
 * 5월에 이행을 찍으면 11월 하반기 업무가 발행 즉시 완료로 파생되고 이듬해도
 * 영구 완료였다. 회차는 **호출자가 key 에 실어 보낸다**(이 모듈은 무수정).
 *   예) 'comply-industrial|2026-H1' · 'policy-post|2026'
 * 업무 자동발행(DYWORK.deptDone)이 이 key 로 완료를 파생한다. */
var SKEY = 'dy-deptcheck-v3';

    /* 회의에서 확인된 전체 대상 수(과 + 사업소). 실제 명단은 발주처 제공 대기. */
    var EXPECTED_DEPTS = 39;

    /* 상태는 **코드로 저장**하고 화면 문구는 화면이 정한다.
     * 이행점검은 '이행/미이행', 경영방침 게시는 '게시/미게시'로 읽혀야 하는데,
     * 표시 문구를 그대로 저장하면 라벨을 바꿀 때마다 저장 데이터가 깨진다.
     * 표시 라벨은 DYV2.STATUS_TONE 이 아는 어휘여야 색이 붙는다(CLAUDE.md §7). */
    var ST = { DONE: 'DONE', TODO: 'TODO', NA: 'NA' };
    var DEFAULT_LABELS = { DONE: '이행', TODO: '미이행', NA: '해당없음' };
    function labelsOf(opts) {
        return Object.assign({}, DEFAULT_LABELS, (opts && opts.labels) || {});
    }


    /* ================= 시연 시드 =================
     * 전 부서 '미이행 0%' 로만 보이면 회의가 요구한 "돼 있는지 안 돼 있는지" 표에
     * **'돼 있는' 사례가 하나도 없다.** 상태 5종(이행·미이행·사유 있는 해당없음·
     * 사유 없는 해당없음·증빙 여러 장)이 한 화면에 다 보이도록 심는다.
     * 실제 명단(39개)을 받으면 DYV2.ORG 만 늘리면 나머지 부서는 자동으로 '미이행'이 된다. */
    var SEED_THUMB = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAwICQsJCAwLCgsODQwOEh4UEhEREiUbHBYeLCcuLisnKyoxN0Y7MTRCNCorPVM+QkhKTk9OLztWXFVMW0ZNTkv/2wBDAQ0ODhIQEiQUFCRLMisyS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0v/wAARCAB4AKADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDmc0ZpuaM1geUOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0ANzRmm5ozTGOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0ANzRmm5ozQUOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0ANzRmkzXVR6RaNdOhssojSC3+dh9rUQyMH6+qoeMD5sU7FKNzls0Zrq4tIsDBbyTWkqzScXMEYJ+zDsSS425HOWyKz4baze1s4jbDzZ7Gedpt7bgyGUrgZx/yzAPFOw+RmJmjNb1zDaW1tcXElqLh1FkFEkj4G+As3Qg8kfh+lWpdGtYZrqKO0M8MaXZacu2Ynj8zYvBx0VTyOd3pRYORnL5ozSZozSJFzRmkzRmgBc0ZpM0ZoAXNGaTNGaAFzRmkzRmgBc0ZpM0ZoAXNGaTNGaAG5qSC4kt3LxNtYoyE4zwylSPyJqHNGaCh2aM03NGaBDs1Zj1C5jtzAjqI9pXOxdwB6gNjIB9Ae59aqZozQMdmjNNzRmgQ7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA3NGabmjNModmjNNzRmgB2aM03NGaAHZozTc0ZoAdmjNNzRmgB2aM03NGaAHZozTc0ZoAdmjNNzRmgB2aM03NGaAHZozTc0ZoAbmjNJmjNAxc0ZpM0ZoAXNGaTNGaAFzRmkzRmgBc0ZpM0ZoAXNGaTNGaAFzRmkzRmgBc0ZpM0ZoAXNGaTNGaAFzRmkzRmgBuaM0UUxhmjNFFABmjNFFABmjNFFABmjNFFABmjNFFABmjNFFABmjNFFABmjNFFABmjNFFAH/9k=';
    function ph(n) { return { name: n, size: 164000, type: 'image/jpeg', w: 1600, h: 1200, thumb: SEED_THUMB }; }
    var SEED = {
        /* 경영방침 게시 — 게시 4 · 미게시 5 · 해당없음(사유O) 1 · 해당없음(사유X) 1 */
        'policy-post|2026': {
            safety:   { status: 'DONE', place: '군청 본관 1층 게시판', date: '2026-03-04', photos: [ph('재난안전과_게시_1.jpg')] },
            env:      { status: 'DONE', place: '환경과 사무실 입구', date: '2026-03-05', photos: [ph('환경과_게시_1.jpg')] },
            water:    { status: 'DONE', place: '물순환사업소 정문 게시판', date: '2026-03-06', photos: [ph('물순환_게시_1.jpg'), ph('물순환_게시_2.jpg')] },
            facility: { status: 'DONE', place: '공공시설사업소 현관', date: '2026-03-06', photos: [ph('공공시설_게시_1.jpg')] },
            health:   { status: 'NA', naReason: '보건소는 별도 청사로 군청 게시판 대상이 아님 — 보건소 자체 게시판에 별도 게시(2026-03-10)', date: '2026-03-10' },
            /* 사유 없이 저장된 옛 데이터 — 행에 '사유 미기재 — 확인 필요'로 계속 드러난다 */
            culture:  { status: 'NA', naReason: '', date: '' }
        },
        /* 중대산업재해 이행점검 — 이행 5 · 미이행 5 · 해당없음 1 */
        'comply-industrial|2026-H1': {
            safety:    { status: 'DONE', place: '재난안전과 안전보건 캐비닛', date: '2026-06-28', photos: [ph('재난안전과_점검표.jpg')] },
            water:     { status: 'DONE', place: '물순환사업소 사무실', date: '2026-06-29', photos: [ph('물순환_점검표.jpg')] },
            env:       { status: 'DONE', place: '환경과 사무실', date: '2026-06-30', photos: [ph('환경과_점검표.jpg')] },
            construct: { status: 'DONE', place: '건설과 안전관리팀', date: '2026-06-30', photos: [ph('건설과_점검표.jpg')] },
            facility:  { status: 'DONE', place: '공공시설사업소', date: '2026-07-01', photos: [ph('공공시설_점검표.jpg')] },
            plan:      { status: 'NA', naReason: '기획예산실은 현장 작업이 없어 안전조치 점검 대상에서 제외 — 예산 편성 항목만 해당', date: '2026-06-25' }
        },
        /* 중대시민재해 이행점검 — 이행 3 · 미이행 7 · 해당없음(사유X) 1 */
        'comply-citizen|2026-H1': {
            facility:  { status: 'DONE', place: '공공시설사업소 시설관리팀', date: '2026-06-27', photos: [ph('공중이용시설_점검.jpg')] },
            culture:   { status: 'DONE', place: '문화체육과 체육시설팀', date: '2026-06-29', photos: [ph('체육시설_점검.jpg')] },
            water:     { status: 'DONE', place: '물순환사업소 수질관리팀', date: '2026-06-30', photos: [ph('수질_점검.jpg')] },
            acct:      { status: 'NA', naReason: '', date: '' }
        }
    };
    function applySeed(d) {
        Object.keys(SEED).forEach(function (key) {
            var m = SEED[key];
            Object.keys(m).forEach(function (deptId) {
                var base = { status: ST.TODO, place: '', date: '', naReason: '', photos: [], note: '' };
                d[key + '|' + deptId] = Object.assign(base, m[deptId]);
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
    function reset() { db = applySeed({}); save(); }

    function rowKey(key, deptId) { return key + '|' + deptId; }
    /* 부서 1건의 이행 상태. 기본값은 '미이행' — 아무도 손대지 않은 것과 이행한 것을 구분해야 한다. */
    function stateOf(key, deptId) {
        var d = load()[rowKey(key, deptId)];
        return d || { status: ST.TODO, place: '', date: '', naReason: '', photos: [], note: '' };
    }
    function setState(key, deptId, patch) {
        var d = load(), k = rowKey(key, deptId);
        d[k] = Object.assign(stateOf(key, deptId), patch || {});
        save();
        return d[k];
    }

    /* ================= 부서 목록 ================= */
    /* DYV2.ORG 파생만 쓴다 — 자체 조직도를 만들지 않는다(CLAUDE.md §3) */
    function depts() { return V().orgDepts(); }
    function gap() {
        var n = depts().length;
        return { registered: n, expected: EXPECTED_DEPTS, missing: Math.max(0, EXPECTED_DEPTS - n) };
    }

    function summary(key) {
        var rows = depts().map(function (d) { return stateOf(key, d.id); });
        var done = rows.filter(function (r) { return r.status === ST.DONE; }).length;
        var na = rows.filter(function (r) { return r.status === ST.NA; }).length;
        return {
            total: rows.length, done: done, na: na,
            todo: rows.length - done - na,
            /* 사유 없이 해당없음을 고른 건 — 관리자가 따져봐야 하는 대상 */
            naUnexplained: rows.filter(function (r) { return r.status === ST.NA && !r.naReason; }).length,
            rate: rows.length ? Math.round(done / rows.length * 100) : 0
        };
    }

    /* ================= 렌더 =================
     * opts: { key, ns(전역 네임스페이스 문자열), evidenceLabel, placeLabel, onChange }
     *   ns 는 이 표의 버튼이 호출할 전역 객체 이름 — 화면 모듈이 DEPTCHK 위임 래퍼를 노출한다. */
    function render(opts) {
        var key = opts.key, ns = opts.ns || 'DEPTCHK';
        var L = labelsOf(opts);
        var g = gap(), s = summary(key);
        var list = depts();

        var gapNote = g.missing
            ? '<div class="check-notice" style="margin-bottom:10px;">' +
                '<b>부서 명단 ' + g.registered + ' / ' + g.expected + '개 등록</b> — 회의에서 확인된 대상은 과·사업소 ' +
                g.expected + '개인데 시스템에는 ' + g.registered + '개만 등록되어 있습니다. ' +
                '나머지 <b>' + g.missing + '개는 명단 미확보</b>라 표에 나타나지 않습니다. ' +
                '전수 점검이 성립하려면 부서 명단을 먼저 받아야 합니다.</div>'
            : '';

        /* 조작 권한이 없으면 **왜 없는지 상시 안내한다** — 종전에는 버튼을 눌렀을 때만
           토스트로 알렸다. 애초에 버튼을 내지 않으니 그 토스트에 도달할 길이 없고,
           관리·감독 계층은 "내 화면이 왜 비어 있지"만 남는다. 안내는 *왜*를 맡고
           표는 *무엇이 있는지*를 맡는다(§12 readOnlyNote 와 같은 기준). */
        var roleNote = '';
        if (R() && R().current) {
            var p = R().current();
            var anyAct = list.some(function (d) { return canAct(d.id); });
            if (!anyAct) {
                roleNote = '<div class="check-notice" style="margin-bottom:10px;">' +
                    (p.tier !== 'staff'
                        ? '<b>조회 전용입니다.</b> 관리·감독 계층은 현황을 보고 지휘하며, ' +
                          (opts.labels && opts.labels.DONE ? esc(opts.labels.DONE) : '이행') +
                          ' 등록은 각 부서 담당자가 직접 수행합니다.'
                        : '<b>조회 전용입니다.</b> 등록은 해당 부서 담당자와 주관부서(재난안전과)가 수행합니다.') +
                    '</div>';
            }
        }

        var stat =
            '<div class="dchk-stat">' +
                statBox('전체', g.registered + '개 부서', 'neutral') +
                statBox(L.DONE, s.done + '개', 'success') +
                statBox(L.TODO, s.todo + '개', s.todo ? 'danger' : 'neutral') +
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

    function rowHtml(key, ns, d, opts) {
        var st = stateOf(key, d.id);
        var L = labelsOf(opts);
        var label = L[st.status] || L.TODO;
        var tone = V().toneOf(label);
        /* 해당없음인데 사유가 없으면 그 사실을 행에서 바로 보이게 한다 — 조용히 넘어가면 안 된다 */
        var naWarn = (st.status === ST.NA && !st.naReason)
            ? '<div class="dchk-warn">사유 미기재 — 확인 필요</div>' : '';
        /* 증빙 삭제는 **조작 권한이 있을 때만** 낸다 — 저장 경로에는 가드가 있어 눌러도
           지워지지 않지만(denied), 남의 부서 행에 삭제 버튼이 보이면 담당자는 자기가
           할 수 있는 일로 읽는다. `[확인 등록]`(아래)과 같은 기준이어야 한다.
           도달할 수 없는 행동을 버튼으로 약속하지 않는다. */
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
            '<td><span class="chip-status chip-sm ' + tone + '">' + esc(label) + '</span>' + naWarn + '</td>' +
            '<td>' + (st.place ? esc(st.place) : '<span class="dchk-none">-</span>') +
                (st.naReason ? '<div class="dchk-sub">사유: ' + esc(st.naReason) + '</div>' : '') + '</td>' +
            '<td>' + (st.date ? esc(st.date) : '<span class="dchk-none">-</span>') + '</td>' +
            '<td>' + photos + '</td>' +
            '<td class="col-action">' +
                (canAct(d.id)
                    ? '<button type="button" class="btn btn-outline btn-sm" onclick="' + ns + '.open(\'' + esc(d.id) + '\')">확인 등록</button>'
                    : '<span class="dchk-ro">조회</span>') +
                (st.status !== ST.DONE
                    ? (canAct(d.id) ? ' <button type="button" class="btn btn-outline btn-sm" onclick="' + ns + '.remind(\'' + esc(d.id) + '\')">독촉</button>' : '')
                    : '') +
            '</td>' +
        '</tr>';
    }

    /* ================= 확인 등록 모달 ================= */
    var F = null;
    function open(key, deptId, opts) {
        if (!canAct(deptId)) { denied(deptId); return; }
        var d = depts().filter(function (x) { return x.id === deptId; })[0];
        if (!d) return;
        var st = stateOf(key, deptId);
        F = {
            key: key, deptId: deptId, ns: opts.ns || 'DEPTCHK',
            status: st.status, place: st.place,
            date: st.date || new Date().toISOString().slice(0, 10),
            naReason: st.naReason, note: st.note, photos: (st.photos || []).slice(),
            opts: opts
        };
        renderModal(d);
    }
    function renderModal(d) {
        var o = F.opts, ns = F.ns;
        var L = labelsOf(o);
        var radios = [ST.DONE, ST.TODO, ST.NA].map(function (v) {
            return '<label class="dchk-radio"><input type="radio" name="dchk-st" value="' + v + '"' +
                (F.status === v ? ' checked' : '') + ' onchange="' + ns + '.setStatus(this.value)"> ' + esc(L[v]) + '</label>';
        }).join('');
        var body =
            '<div class="dchk-mrow"><label class="form-label">' + esc(o.statusLabel || (L.DONE + ' 여부')) + ' <span style="color:var(--status-danger-fg)">*</span></label>' +
                '<div class="dchk-radios">' + radios + '</div></div>' +
            (F.status === ST.NA
                /* 해당없음은 사유 없이 넘어갈 수 없다 — 이 칸이 없으면 종이 서식과 같아진다 */
                ? '<div class="dchk-mrow"><label class="form-label" for="dchk-na">' + esc(L.NA) + ' 사유 <span style="color:var(--status-danger-fg)">*</span></label>' +
                    '<textarea class="form-textarea" id="dchk-na" rows="2" placeholder="왜 이 부서에 해당하지 않는지 적으세요">' + esc(F.naReason) + '</textarea>' +
                    '<p class="file-hint">사유가 없으면 <b>확인 필요</b>로 남아 미이행과 함께 관리됩니다.</p></div>'
                : '<div class="dchk-mrow"><label class="form-label" for="dchk-place">' + esc(o.placeLabel || '위치·비고') +
                    (F.status === ST.DONE ? ' <span style="color:var(--status-danger-fg)">*</span>' : '') + '</label>' +
                    '<input type="text" class="form-input" id="dchk-place" value="' + esc(F.place) + '" placeholder="' + esc(o.placePlaceholder || '') + '"></div>') +
            '<div class="dchk-mrow"><label class="form-label" for="dchk-date">확인일</label>' +
                '<input type="date" class="form-input" id="dchk-date" value="' + esc(F.date) + '" style="max-width:200px;"></div>' +
            '<div class="dchk-mrow"><label class="form-label">' + esc(o.evidenceLabel || '증빙 사진') +
                (F.status === ST.DONE ? ' <span style="color:var(--status-danger-fg)">*</span>' : '') + '</label>' +
                /* 실제 파일을 고른다 — '이행' 판정의 유일한 증빙이라 파일명을 지어내면
                   없는 사진으로 이행 처리가 되어 버린다(회의가 가장 강하게 요구한 지점). */
                V().uploadDrop(
                    '<b>' + esc(o.evidenceLabel || '증빙 사진') + '</b> <span style="font-size:var(--fs-12);color:var(--text-gray);">클릭 또는 끌어놓기</span>',
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
            '</div>';
        V().openModal(esc(d.name) + ' — ' + esc(o.title || '이행 확인 등록'), body,
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="' + ns + '.save()">저장</button>');
    }
    function capture() {
        var el = function (id) { return document.getElementById(id); };
        if (el('dchk-place')) F.place = el('dchk-place').value.trim();
        if (el('dchk-na')) F.naReason = el('dchk-na').value.trim();
        if (el('dchk-date')) F.date = el('dchk-date').value;
    }
    function setStatus(v) {
        if (!F || !canAct(F.deptId)) { denied(F && F.deptId); return; } capture(); F.status = v; renderModal(deptOf(F.deptId)); }
    function deptOf(id) { return depts().filter(function (x) { return x.id === id; })[0]; }
    function addPhoto(files) {
        if (!F || !canAct(F.deptId)) { denied(F && F.deptId); return; }
        capture();
        if (!files || !files.length) return;
        F.photos = F.photos.concat(files).slice(0, V().FILE_LIMITS.maxCount);
        renderModal(deptOf(F.deptId));
        toast('증빙 ' + files.length + '건 첨부');
    }
    function mDelPhoto(i) {
        if (!F || !canAct(F.deptId)) { denied(F && F.deptId); return; } capture(); F.photos.splice(i, 1); renderModal(deptOf(F.deptId)); }

    function saveModal() {
        if (!F || !canAct(F.deptId)) { denied(F && F.deptId); return; }
        capture();
        /* '이행'이라고 적으려면 증빙이 있어야 한다 — 시스템 존재 자체가 증빙 역할이라는 것이 회의 결론이다 */
        var L = labelsOf(F.opts);
        if (F.status === ST.DONE && !F.photos.length) {
            var ev = F.opts.evidenceLabel || '증빙';
            toast(L.DONE + V().josa(L.DONE, '으로', '로') + ' 등록하려면 ' + ev + V().josa(ev, '이', '가') + ' 필요합니다.');
            return;
        }
        if (F.status === ST.DONE && !F.place) {
            var pl = F.opts.placeLabel || '위치';
            toast(pl + V().josa(pl, '을', '를') + ' 입력하세요.'); return;
        }
        /* 해당없음은 사유 없이 저장할 수 없다 — 필수(*)라고 표시해 놓고 통과시키면 종이 서식과 같아진다.
         * (이미 사유 없이 쌓여 있는 기존 데이터는 행에서 '사유 미기재 — 확인 필요'로 계속 드러난다) */
        if (F.status === ST.NA && !F.naReason) {
            toast(L.NA + ' 사유를 적으세요 — 사유 없이 빠질 수 없습니다.');
            var na = document.getElementById('dchk-na'); if (na) na.focus();
            return;
        }
        setState(F.key, F.deptId, {
            status: F.status, place: F.place, date: F.date,
            naReason: F.status === ST.NA ? F.naReason : '',
            photos: F.photos
        });
        V().closeModal();
        toast((deptOf(F.deptId) || {}).name + ' ' + L[F.status] + ' 등록');
        if (F.opts.onChange) F.opts.onChange();
    }
    function delPhoto(key, deptId, i) {
        if (!canAct(deptId)) { denied(deptId); return; }
        var st = stateOf(key, deptId);
        var ph = (st.photos || []).slice();
        ph.splice(i, 1);
        setState(key, deptId, { photos: ph });
    }
    /* 독촉 — 회의에서 미이행 부서 대응으로 나온 수단은 전화와 알림이다 */
    function remind(key, deptId) {
        if (!canAct(deptId)) { denied(deptId); return; }
        var d = deptOf(deptId);
        toast((d ? d.name : deptId) + ' 담당자에게 독촉 알림 발송 (프로토타입)');
    }

    global.DEPTCHK = {
        ST: ST, DEFAULT_LABELS: DEFAULT_LABELS, EXPECTED_DEPTS: EXPECTED_DEPTS,
        depts: depts, gap: gap, summary: summary,
        stateOf: stateOf, setState: setState, reset: reset,
        render: render, open: open, setStatus: setStatus, addPhoto: addPhoto,
        mDelPhoto: mDelPhoto, save: saveModal, delPhoto: delPhoto, remind: remind
    };
})(window);
