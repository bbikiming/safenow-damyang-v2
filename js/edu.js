/* =========================================================================
 * 안전보건교육 전용 화면 — 기획 v1 §4 (컨펌: 서명 제외, 결과 확정 시 온나라 결재 요청)
 *   교육 생애주기: [+ 교육 등록] → (자동) 일정·대상자 알림·계획(P) 기록
 *   → 교육 당일 [실시 등록](출석 체크) → [결과 확정 · 온나라 상신] → 이수 시간 개인 이력 자동 가산
 * ========================================================================= */
(function () {
    'use strict';
    const V = window.DYV2, T = window.EDOC_T, E = window.EDOC;
    const esc = V.esc;

    /* ── 스토어 (localStorage 영속 + 최초 시드) ── */
    function load() {
        try { const s = JSON.parse(localStorage.getItem('dy-edu2-v1')); if (s && s.courses) return s; } catch (e) {}
        return seed();
    }
    function persist() { try { localStorage.setItem('dy-edu2-v1', JSON.stringify(DB)); } catch (e) {} }
    function seed() {
        return {
            courses: [
                { id: 'EDU-101', type: '관리감독자 정기교육', name: '2026 상반기 관리감독자 정기교육', date: '2026-04-22', place: '군청 대회의실', instructor: '안전보건공단 전문강사', hours: 8,
                  targets: [{ n: '김도시', d: '도시과' }, { n: '정환경', d: '환경과' }, { n: '최회계', d: '회계과' }, { n: '한기획', d: '기획예산실' }], att: { 0: true, 1: true, 2: true, 3: true }, status: '확정' },
                { id: 'EDU-102', type: '정기교육 (사무직)', name: '2026 상반기 정기 안전보건교육 (1차)', date: '2026-06-05', place: '온라인(LMS) + 집합', instructor: '이보건 보건관리자', hours: 3,
                  targets: [{ n: '박행정', d: '행정과' }, { n: '김도시', d: '도시과' }, { n: '이민원', d: '민원과' }, { n: '송세무', d: '세무과' }, { n: '한기획', d: '기획예산실' }], att: { 0: true, 1: true, 2: false, 3: true, 4: true }, status: '실시완료' },
                { id: 'EDU-103', type: '특별교육 (유해·위험작업)', name: '밀폐공간 작업 특별교육', date: '2026-07-03', place: '하수처리장 교육장', instructor: '김안전 안전관리자', hours: 16,
                  targets: [{ n: '정환경', d: '환경과' }, { n: '오하수', d: '환경과' }, { n: '윤설비', d: '환경과' }], att: {}, status: '예정' },
                { id: 'EDU-104', type: '채용 시 교육', name: '6월 신규 임용자 채용 시 교육', date: '2026-06-19', place: '군청 소회의실', instructor: '김안전 안전관리자', hours: 8,
                  targets: [{ n: '신입일', d: '행정과' }, { n: '신입이', d: '환경과' }], att: {}, status: '예정' },
            ],
            people: [
                { n: '김도시', d: '도시과', job: '관리감독자', req: 16, done: 11 },
                { n: '정환경', d: '환경과', job: '관리감독자', req: 16, done: 11 },
                { n: '최회계', d: '회계과', job: '관리감독자', req: 16, done: 8 },
                { n: '박행정', d: '행정과', job: '사무직', req: 12, done: 9 },
                { n: '이민원', d: '민원과', job: '사무직', req: 12, done: 3 },
                { n: '송세무', d: '세무과', job: '사무직', req: 12, done: 6 },
                { n: '한기획', d: '기획예산실', job: '사무직', req: 12, done: 12 },
                { n: '오하수', d: '환경과', job: '현장직', req: 24, done: 12 },
                { n: '윤설비', d: '환경과', job: '현장직', req: 24, done: 6 },
                { n: '신입일', d: '행정과', job: '신규 임용', req: 8, done: 0 },
                { n: '신입이', d: '환경과', job: '신규 임용', req: 8, done: 0 },
            ],
        };
    }
    const DB = load();
    persist();   // 최초 시드도 저장 — 화면 이동 후 등록·출석 상태 유지

    /* ── 요약 바 ── */
    function renderSummary() {
        const done = DB.courses.filter(c => c.status === '확정').length;
        const planned = DB.courses.filter(c => c.status === '예정').length;
        const complete = DB.people.filter(p => p.done >= p.req).length;
        const rate = Math.round(complete / DB.people.length * 100);
        document.getElementById('edu-summary').innerHTML =
            '<div class="sbm-summary-item sbm-summary-rate">' +
                '<span class="sbm-summary-label">이수율</span>' +
                '<div class="progress"><div class="progress-bar ' + (rate >= 70 ? 'green' : 'warning') + '" style="width:' + rate + '%"></div></div>' +
                '<span class="sbm-summary-value">' + rate + '%</span></div>' +
            '<div class="sbm-summary-divider"></div>' +
            '<div class="sbm-summary-item"><span class="sbm-summary-label">예정 교육</span>' +
                (planned ? '<span class="sbm-due-badge">● ' + planned + '건</span>' : '<span class="sbm-due-badge none">없음</span>') + '</div>' +
            '<div class="sbm-summary-divider"></div>' +
            '<div class="sbm-summary-item"><span class="sbm-summary-label">완료 교육</span><span class="sbm-summary-value">' + done + '건</span></div>' +
            '<div class="sbm-summary-divider"></div>' +
            '<div class="sbm-summary-item"><span class="sbm-summary-label">담당부서</span><span class="sbm-summary-value" style="font-size:13px;">행정과(교육담당)</span></div>';
    }

    /* ── 탭 ── */
    const tabs = document.querySelectorAll('#edu-tabs .tab');
    tabs.forEach(t => t.addEventListener('click', () => {
        tabs.forEach(x => x.classList.toggle('active', x === t));
        document.querySelectorAll('[data-pane]').forEach(p => p.style.display = p.dataset.pane === t.dataset.tab ? '' : 'none');
    }));

    /* ── 탭1: 교육 일정 카드 ── */
    const ST = { '예정': '<span class="chip-mini wt-elec">예정</span>', '실시완료': '<span class="chip-mini st-doing">실시완료 · 확정 대기</span>', '확정': '<span class="chip-mini st-done">확정 · 온나라 상신</span>' };
    function attCount(c) { return Object.values(c.att).filter(Boolean).length; }

    function renderCards() {
        const f = document.getElementById('edu-f-status').value;
        const list = DB.courses.filter(c => !f || c.status === f);
        document.getElementById('edu-cards').innerHTML = list.map(c => {
            const total = c.targets.length, att = attCount(c);
            const pct = total ? Math.round(att / total * 100) : 0;
            let actions = '';
            if (c.status === '예정') actions =
                '<button class="btn btn-sm btn-secondary" onclick="EDU.remind(\'' + c.id + '\')">대상자 알림</button>' +
                '<button class="btn btn-sm btn-primary" onclick="EDU.openAttend(\'' + c.id + '\')">실시 등록 (출석)</button>';
            if (c.status === '실시완료') actions =
                '<button class="btn btn-sm btn-outline" onclick="EDU.openAttend(\'' + c.id + '\')">출석 수정</button>' +
                '<button class="btn btn-sm btn-primary" onclick="EDU.finalize(\'' + c.id + '\')">결과 확정 · 온나라 상신</button>';
            if (c.status === '확정') actions =
                '<button class="btn btn-sm btn-outline" onclick="EDU.openResult(\'' + c.id + '\')">결과 보기</button>';
            return '<div class="edu-card">' +
                '<div class="edu-card-main">' +
                    '<div class="edu-card-name">' + esc(c.name) + ' ' + ST[c.status] + '</div>' +
                    '<div class="edu-card-meta"><span class="chip-mini pdca">' + esc(c.type) + '</span>' +
                        '<span>📅 ' + c.date + '</span><span>📍 ' + esc(c.place) + '</span><span>강사 ' + esc(c.instructor) + '</span><span>' + c.hours + '시간</span></div>' +
                '</div>' +
                '<div class="edu-att"><span>출석 ' + att + '/' + total + '</span>' +
                    '<div class="progress"><div class="progress-bar ' + (pct >= 80 ? 'green' : pct > 0 ? 'warning' : 'danger') + '" style="width:' + pct + '%"></div></div></div>' +
                '<div style="display:flex; gap:6px;">' + actions + '</div>' +
            '</div>';
        }).join('') || '<div class="v2-empty">조건에 맞는 교육이 없습니다.</div>';
    }
    document.getElementById('edu-f-status').addEventListener('change', renderCards);

    /* ── [+ 교육 등록] — 등록 시 일정·알림·계획(P) 자동 ── */
    function openCreate() {
        V.openModal('교육 등록 — 등록 시 일정 생성 · 대상자 알림 · 계획(P) 문서 자동 기록',
            '<div class="preset-form-grid">' +
            '<span class="k">과정 유형</span><select id="ec-type">' + T.EDU_CATALOG.map(c => '<option>' + c.name + '</option>').join('') + '</select>' +
            '<span class="k">교육명</span><input type="text" id="ec-name" placeholder="예: 하반기 정기 안전보건교육 (2차)">' +
            '<span class="k">일시</span><input type="date" id="ec-date" value="2026-07-15">' +
            '<span class="k">장소</span><input type="text" id="ec-place" placeholder="예: 군청 대회의실">' +
            '<span class="k">강사</span><input type="text" id="ec-inst" placeholder="예: 김안전 안전관리자">' +
            '<span class="k">교육 시간</span><input type="number" id="ec-hours" value="3">' +
            '<span class="k">대상자 선택</span><div id="ec-targets" style="display:flex; flex-direction:column; gap:4px; max-height:160px; overflow-y:auto; border:1px solid var(--card-line); border-radius:6px; padding:8px;">' +
                DB.people.map((p, i) => '<label style="font-size:12px; display:flex; gap:6px; align-items:center;"><input type="checkbox" data-i="' + i + '"> ' + esc(p.n) + ' <span style="color:var(--text-gray);">' + esc(p.d) + ' · ' + esc(p.job) + '</span></label>').join('') +
            '</div>' +
            '<span class="k">교안 첨부</span><div class="upload-drop" style="padding:14px;" onclick="DYV2.toast(\'교안 파일 첨부 (프로토타입)\')">교안·자료 파일을 첨부하세요 (다중 가능)</div>' +
            '</div>',
            '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" id="ec-submit">등록</button>');
        document.getElementById('ec-submit').addEventListener('click', () => {
            const targets = [...document.querySelectorAll('#ec-targets input:checked')].map(el => {
                const p = DB.people[+el.getAttribute('data-i')]; return { n: p.n, d: p.d };
            });
            if (!targets.length) { V.toast('대상자를 1명 이상 선택하세요'); return; }
            const c = {
                id: 'EDU-' + (105 + DB.courses.length),
                type: document.getElementById('ec-type').value,
                name: document.getElementById('ec-name').value || document.getElementById('ec-type').value,
                date: document.getElementById('ec-date').value, place: document.getElementById('ec-place').value || '미정',
                instructor: document.getElementById('ec-inst').value || '미정', hours: +document.getElementById('ec-hours').value || 1,
                targets, att: {}, status: '예정',
            };
            DB.courses.unshift(c); persist();
            V.closeModal(); renderAll();
            E.notify('교육 일정 안내 — ' + c.name + ' (' + c.date + ') 대상자 ' + targets.length + '명', '문자');
            setTimeout(() => V.toast('교육 계획(P) 문서가 자동 기록되고 일정이 시기도래에 등록되었습니다'), 1400);
        });
    }

    /* ── [실시 등록] 출석 체크 ── */
    function openAttend(id) {
        const c = DB.courses.find(x => x.id === id);
        V.openModal('실시 등록 — 출석 체크: ' + esc(c.name),
            '<p style="font-size:12px; color:var(--text-gray); margin-bottom:10px;">' + c.date + ' · ' + esc(c.place) + ' · 출석한 대상자를 체크하세요. (제안요청서 기준 서명 절차 없음 — 결과 확정 시 온나라 결재로 갈음)</p>' +
            '<div style="display:flex; flex-direction:column; gap:5px;">' +
            c.targets.map((t, i) =>
                '<label style="display:flex; align-items:center; gap:8px; padding:8px 10px; border:1px solid var(--card-line); border-radius:6px; font-size:13px;">' +
                '<input type="checkbox" data-i="' + i + '"' + (c.att[i] ? ' checked' : '') + '> <b>' + esc(t.n) + '</b> <span style="color:var(--text-gray);">' + esc(t.d) + '</span></label>'
            ).join('') + '</div>',
            '<button class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button class="btn btn-primary" id="ea-save">출석 저장</button>');
        document.getElementById('ea-save').addEventListener('click', () => {
            document.querySelectorAll('#v2-modal input[type=checkbox]').forEach(el => { c.att[+el.getAttribute('data-i')] = el.checked; });
            if (c.status === '예정') c.status = '실시완료';
            persist(); V.closeModal(); renderAll();
            V.toast('출석 ' + attCount(c) + '/' + c.targets.length + ' 저장 — 결과 확정 시 이수 시간이 자동 가산됩니다');
        });
    }

    /* ── [결과 확정 · 온나라 상신] — 이수 시간 자동 가산 ── */
    function finalize(id) {
        const c = DB.courses.find(x => x.id === id);
        c.status = '확정';
        c.targets.forEach((t, i) => {
            if (c.att[i]) {
                const p = DB.people.find(x => x.n === t.n);
                if (p) { p.done += c.hours; p.last = c.date; }
            }
        });
        persist(); renderAll();
        E.onnaraPopup('교육 결과 보고 — ' + c.name + ' (출석 ' + attCount(c) + '/' + c.targets.length + ')');
        setTimeout(() => V.toast('출석자 ' + attCount(c) + '명의 이수 시간이 +' + c.hours + 'h 자동 가산되었습니다'), 600);
    }

    function openResult(id) {
        const c = DB.courses.find(x => x.id === id);
        V.openModal('교육 결과 — ' + esc(c.name),
            '<div class="edoc-linkcard">🔗 연동 정보 — 온나라 결재 상신 완료 · 이수 이력 ' + attCount(c) + '건 반영 · 교육 결과(C) 문서 확정</div>' +
            '<table class="table-figma"><thead><tr><th>성명</th><th>부서</th><th>출석</th><th>가산 시간</th></tr></thead><tbody>' +
            c.targets.map((t, i) => '<tr><td>' + esc(t.n) + '</td><td>' + esc(t.d) + '</td><td>' +
                (c.att[i] ? '<span class="chip-mini st-done">출석</span>' : '<span class="chip-mini st-todo">불참</span>') + '</td><td>' + (c.att[i] ? '+' + c.hours + 'h' : '-') + '</td></tr>').join('') +
            '</tbody></table>',
            '<button class="btn btn-secondary" onclick="DYV2.closeModal()">닫기</button>');
    }

    /* ── 탭2: 개인별 이수 현황 ── */
    function renderPeople() {
        const f = document.getElementById('edu-f-dept').value;
        document.getElementById('edu-people').innerHTML = DB.people.filter(p => !f || p.d === f).map(p => {
            const pct = Math.min(100, Math.round(p.done / p.req * 100));
            const st = p.done >= p.req ? '<span class="chip-mini st-done">이수완료</span>' : p.done > 0 ? '<span class="chip-mini st-doing">이수중</span>' : '<span class="chip-mini st-todo">미이수</span>';
            return '<tr><td style="font-weight:600;">' + esc(p.n) + '</td><td>' + esc(p.d) + '</td><td>' + esc(p.job) + '</td>' +
                '<td><div style="display:flex; align-items:center; gap:8px;"><div class="progress" style="width:100px;"><div class="progress-bar ' + (pct >= 100 ? 'green' : pct >= 50 ? 'warning' : 'danger') + '" style="width:' + pct + '%"></div></div><b style="font-size:12px;">' + p.done + 'h / ' + p.req + 'h</b></div></td>' +
                '<td>' + (p.last || '-') + '</td><td>' + st + '</td></tr>';
        }).join('');
    }
    (function initDeptFilter() {
        const sel = document.getElementById('edu-f-dept');
        [...new Set(DB.people.map(p => p.d))].forEach(d => { const o = document.createElement('option'); o.value = d; o.textContent = d; sel.appendChild(o); });
        sel.addEventListener('change', renderPeople);
    })();
    function notifyIncomplete() {
        const n = DB.people.filter(p => p.done < p.req).length;
        E.notify('교육 이수 안내 — 법정 기준 미달 ' + n + '명에게 이수 독려 발송', '문자');
    }

    /* ── 탭3: 과정 카탈로그 + 반기 점검 ── */
    function renderCatalog() {
        document.getElementById('edu-catalog').innerHTML = T.EDU_CATALOG.map(c => {
            const n = DB.courses.filter(x => x.type === c.name).length;
            return '<tr><td style="font-weight:600;">' + esc(c.name) + '</td><td>' + c.cycle + '</td><td>' + c.hours + '</td><td>' + esc(c.target) + '</td>' +
                '<td>' + (n ? '<span class="chip-mini st-done">' + n + '회</span>' : '<span class="chip-mini wt">-</span>') + '</td></tr>';
        }).join('');
    }
    function openCheck() {
        E.openForm({
            id: 'EDOC-교육반기점검-2026H1', title: '2026 상반기 안전보건교육 실시 사항 점검표', form: 'F5',
            ctx: { menuLabel: '안전보건교육 · 반기', checklist: T.CHECKLIST_PRESETS.edu },
        });
    }

    function remind(id) {
        const c = DB.courses.find(x => x.id === id);
        E.notify('교육 D-안내 — ' + c.name + ' (' + c.date + ') 대상자 ' + c.targets.length + '명', '문자');
    }

    function renderAll() { renderSummary(); renderCards(); renderPeople(); renderCatalog(); }
    renderAll();

    window.EDU = { openCreate, openAttend, finalize, openResult, notifyIncomplete, openCheck, remind };
})();
