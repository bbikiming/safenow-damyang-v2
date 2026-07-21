/* =========================================================================
 * 담양군 중대재해예방 통합관리시스템 v2 — 통합 현황 대시보드 (DYDSH)
 *   권한 시연(DYROLE, js/layout.js) 3계층에 따라 서로 다른 대시보드를 렌더한다.
 *     head  — 군수(총괄 책임자): 군 전체 거버넌스 뷰 (종합 이행률·책임체계·결재 대기)
 *     super — 실과장·사업소장·읍면장(관리감독자): 소관 부서 스코프 뷰
 *     staff — 업무담당자(실무 수행자): 내 할일·시기도래 중심 실무 뷰
 *   컴포넌트는 표준 계열만 사용: card / statbox / table-figma / chip-status(+toneOf) /
 *   progress / dsh-* (css/v2.css). 우측 상단 사용자 칩으로 권한 전환.
 * ========================================================================= */
(function (global) {
    'use strict';

    const E = s => global.DYV2 ? global.DYV2.esc(s) : String(s == null ? '' : s);
    const chip = label => '<span class="chip-status ' + global.DYV2.toneOf(label) + '">' + E(label) + '</span>';
    const barCls = r => r >= 70 ? 'green' : r >= 40 ? 'warning' : 'danger';

    /* ── 시연 시드 — 부서별 이행 현황 (head 뷰) · deptId 는 DYV2.ORG 와 동일 ── */
    const DEPT_RATES = [
        { id: 'safety',       name: '재난안전과',     rate: 92, overdue: 0 },
        { id: 'env',          name: '환경과',         rate: 81, overdue: 1 },
        { id: 'construct',    name: '건설과',         rate: 74, overdue: 2 },
        { id: 'plan',         name: '기획예산실',     rate: 70, overdue: 0 },
        { id: 'acct',         name: '회계과',         rate: 68, overdue: 1 },
        { id: 'town_damyang', name: '담양읍',         rate: 66, overdue: 2 },
        { id: 'health',       name: '보건소',         rate: 63, overdue: 1 },
        { id: 'culture',      name: '문화체육과',     rate: 61, overdue: 0 },
        { id: 'facility',     name: '공공시설사업소', rate: 58, overdue: 3 },
        { id: 'finance',      name: '재무과',         rate: 55, overdue: 1 },
        { id: 'water',        name: '물순환사업소',   rate: 45, overdue: 4 },
    ];

    /* ── 시연 시드 — 관리감독자 부서 스코프 (deptId 키) ── */
    const SUPER_SEED = {
        safety: {
            eduRate: 96, rsk: { total: 14, done: 12, delay: 0 }, imp: { open: 2, delay: 0 },
            tasks: [
                { title: '정기 위험성평가 결과 등록', due: '2026-06-11', owner: '박안전', st: '진행', href: 'rsk-list.html' },
                { title: '상반기 안전보건교육 결과 취합', due: '2026-06-17', owner: '김안전', st: '진행', href: 'edu-status.html' },
                { title: '의무이행 점검표 부서 확인', due: '2026-06-30', owner: '박담당', st: '미착수', href: 'menu.html?m=comply' },
            ],
            confirms: [
                { title: '수시 위험성평가 결과 — 하수처리장 설비 변경', by: '박안전 주무관', when: '오늘 10:20' },
                { title: '집합교육 참석자 서명부 업로드', by: '김안전 안전관리자', when: '어제 16:40' },
            ],
        },
        facility: {
            eduRate: 74, rsk: { total: 9, done: 5, delay: 2 }, imp: { open: 5, delay: 3 },
            tasks: [
                { title: '노후 사다리 교체 개선조치 완료 보고', due: '2026-06-03', owner: '한담당', st: '기한초과', href: 'rsk-imp.html' },
                { title: '체육시설 정기 위험성평가', due: '2026-06-11', owner: '한운영', st: '진행', href: 'rsk-list.html' },
                { title: '시설운영팀 채용시 교육 실시', due: '2026-06-20', owner: '민설비', st: '미착수', href: 'edu-hire.html' },
            ],
            confirms: [
                { title: '수영장 기계실 개선조치 사진 대장', by: '한담당', when: '오늘 09:40' },
                { title: '전기설비 점검표 6월분', by: '민설비 주무관', when: '어제 17:10' },
            ],
        },
        town_damyang: {
            eduRate: 82, rsk: { total: 6, done: 4, delay: 1 }, imp: { open: 3, delay: 1 },
            tasks: [
                { title: '보도블록 침하 신고 현장 확인', due: '2026-06-12', owner: '배주민', st: '진행', href: 'rsk-occ.html' },
                { title: '읍사무소 정기 위험성평가', due: '2026-06-25', owner: '배주민', st: '미착수', href: 'rsk-list.html' },
            ],
            confirms: [
                { title: '경로당 시설 점검 결과 보고', by: '배주민 담당', when: '오늘 11:00' },
            ],
        },
    };

    /* ── 공통: 현재 권한 안내 바 + [권한 전환] ── */
    function rolebar(p, t) {
        return '<div class="dsh-rolebar tier-' + p.tier + '">' +
            '<span class="dsh-rolebar-badge">' + E(t.label) + '</span>' +
            '<div class="dsh-rolebar-text"><strong>' + E(p.name) + ' ' + E(p.role) + '</strong>' +
              '<span class="dsh-rolebar-law">' + E(t.law) + '</span></div>' +
            '<button class="btn btn-sm btn-outline" type="button" onclick="DYROLE.open()">권한 전환</button>' +
        '</div>';
    }

    /* =====================================================================
     * head — 군수(총괄 책임자) 대시보드
     * ===================================================================== */
    function headView() {
        const supers = global.DYV2.orgDepts().length;                   /* 부서형 노드 수 = 관리감독자 */
        const staffN = global.DYV2.orgTotal() - supers - 4;             /* 군수·부군수·국장2 제외 실무 인원 */
        const low = DEPT_RATES.filter(d => d.rate < 60);
        const totalOverdue = DEPT_RATES.reduce((a, d) => a + d.overdue, 0);

        const hero =
            '<div class="dsh-hero">' +
              '<div class="dsh-hero-main">' +
                '<div class="dsh-hero-label">담양군 전체 안전관리 이행률</div>' +
                '<div class="dsh-hero-num">72<em>%</em></div>' +
                '<div class="progress"><div class="progress-bar" style="width:72%"></div></div>' +
                '<div class="dsh-hero-delta">전월 대비 +4%p · 이행률 미흡(60% 미만) 부서 ' + low.length + '곳</div>' +
              '</div>' +
              '<div class="dsh-hero-stats">' +
                '<a class="dsh-hero-stat" href="stats.html"><b>0<em>건</em></b><span>중대재해 발생 (올해)</span></a>' +
                '<a class="dsh-hero-stat is-danger" href="my-work.html"><b>' + totalOverdue + '<em>건</em></b><span>기한 초과 업무</span></a>' +
                '<a class="dsh-hero-stat" href="menu.html?m=policy"><b>2<em>건</em></b><span>결재 대기 (온나라)</span></a>' +
                '<a class="dsh-hero-stat" href="base-targets.html"><b>23<em>개소</em></b><span>관리 사업장</span></a>' +
              '</div>' +
            '</div>';

        const chain =
            '<div class="card" style="margin-bottom:16px;">' +
              '<div class="card-header"><span class="card-title">책임체계 지정 현황 — 중대재해처벌법 관리체계</span>' +
                '<a class="btn btn-sm btn-secondary" href="menu.html?m=org">조직 관리</a></div>' +
              '<div class="card-body"><div class="dsh-chain">' +
                '<div class="dsh-chain-node tier-head"><span class="dsh-chain-tier">총괄 책임자</span>' +
                  '<b>군수 <em>1명</em></b><span class="dsh-chain-who">경영책임자 (중처법 §2)</span>' + chip('완료') + '</div>' +
                '<span class="dsh-chain-arrow" aria-hidden="true">→</span>' +
                '<div class="dsh-chain-node tier-super"><span class="dsh-chain-tier">관리감독자</span>' +
                  '<b>실과장·사업소장·읍면장 <em>' + supers + '명</em></b><span class="dsh-chain-who">부서 관리·감독 (산안법 §16)</span>' + chip('완료') + '</div>' +
                '<span class="dsh-chain-arrow" aria-hidden="true">→</span>' +
                '<div class="dsh-chain-node tier-staff"><span class="dsh-chain-tier">업무담당자</span>' +
                  '<b>실무 수행자 <em>' + staffN + '명</em></b><span class="dsh-chain-who">부서 안전보건 업무 수행</span>' + chip('완료') + '</div>' +
              '</div></div>' +
            '</div>';

        const deptRows = DEPT_RATES.map(d =>
            '<tr' + (d.rate < 60 ? ' class="is-low"' : '') + '>' +
              '<td style="font-weight:600;">' + E(d.name) + '</td>' +
              '<td><div class="dsh-dept-bar"><div class="progress"><div class="progress-bar ' + barCls(d.rate) + '" style="width:' + d.rate + '%"></div></div>' +
                '<span class="dsh-dept-num">' + d.rate + '%</span></div></td>' +
              '<td style="text-align:center;">' + (d.overdue ? '<span class="chip-status danger chip-sm">' + d.overdue + '건</span>' : '<span style="color:var(--text-lightgray);">—</span>') + '</td>' +
              '<td>' + chip(d.rate >= 70 ? '이행' : d.rate >= 60 ? '주의' : '보완필요') + '</td>' +
            '</tr>').join('');
        const deptCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">부서별 안전관리 이행 현황</span>' +
                '<a class="btn btn-sm btn-secondary" href="stats.html">현황 통계</a></div>' +
              '<div class="card-body"><div style="overflow-x:auto;"><table class="table-figma">' +
                '<thead><tr><th>부서</th><th>이행률</th><th style="text-align:center;">기한 초과</th><th>상태</th></tr></thead>' +
                '<tbody>' + deptRows + '</tbody>' +
              '</table></div></div>' +
            '</div>';

        const duties = [
            ['안전보건 목표·경영방침 수립', '완료'], ['안전보건 전담조직 구성', '완료'],
            ['유해·위험요인 확인·개선 (위험성평가)', '진행'], ['안전보건 예산 편성·집행', '완료'],
            ['안전보건관리책임자 등 평가·지원', '완료'], ['안전보건교육 실시 확인', '진행'],
            ['종사자 의견청취 절차 운영', '완료'], ['급박한 위험 대비 매뉴얼 점검', '완료'],
            ['도급·용역·위탁 시 기준·절차 확인', '미착수'],
        ];
        const doneN = duties.filter(d => d[1] === '완료').length;
        const dutyCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">반기 의무이행 점검 — 시행령 §4 (9개 의무)</span>' +
                '<a class="btn btn-sm btn-secondary" href="menu.html?m=comply">이행관리</a></div>' +
              '<div class="card-body">' +
                '<div class="dsh-duty-sum"><div class="progress"><div class="progress-bar green" style="width:' + Math.round(doneN / duties.length * 100) + '%"></div></div>' +
                  '<span>' + doneN + ' / ' + duties.length + ' 완료</span></div>' +
                duties.map(d => '<div class="dsh-duty-row"><span>' + E(d[0]) + '</span>' + chip(d[1]) + '</div>').join('') +
              '</div>' +
            '</div>';

        const approveCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">결재·보고 대기</span><span class="chip-status danger chip-sm">2건</span></div>' +
              '<div class="card-body">' +
                '<div class="dsh-approve-row"><div><b>안전·보건 목표와 경영방침 (2026)</b><span>재난안전과 상신 · 온나라 연계 · 오늘 14:23</span></div>' +
                  '<a class="btn btn-sm btn-primary" href="menu.html?m=policy">결재</a></div>' +
                '<div class="dsh-approve-row"><div><b>상반기 의무이행 점검 결과 보고</b><span>재난안전과 상신 · 어제 17:40</span></div>' +
                  '<a class="btn btn-sm btn-primary" href="menu.html?m=comply">결재</a></div>' +
              '</div>' +
            '</div>';

        const budgetCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">안전보건 예산 집행</span>' +
                '<a class="btn btn-sm btn-secondary" href="bgt-main.html">예산 총괄표</a></div>' +
              '<div class="card-body">' +
                '<div class="dsh-duty-sum"><div class="progress"><div class="progress-bar green" style="width:64%"></div></div><span>64.5%</span></div>' +
                '<div class="dsh-duty-row"><span>2026년 편성액</span><b>4.20억 원</b></div>' +
                '<div class="dsh-duty-row"><span>집행액 (6월 기준)</span><b>2.71억 원</b></div>' +
                '<div class="dsh-duty-row"><span>집행 부진 항목</span>' + chip('주의') + '</div>' +
              '</div>' +
            '</div>';

        const feedCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">최근 부서 보고</span></div>' +
              '<div class="card-body">' +
                '<div class="dsh-feed-item"><span class="dsh-feed-time">오늘 10:20</span><span>물순환사업소 — 수시 위험성평가 완료 보고 (하수처리장 설비 변경)</span></div>' +
                '<div class="dsh-feed-item"><span class="dsh-feed-time">오늘 09:05</span><span>담양읍 — 종사자 신고 1건 접수 (보도블록 침하)</span></div>' +
                '<div class="dsh-feed-item"><span class="dsh-feed-time">어제 16:40</span><span>재난안전과 — 관리감독자 교육 이수율 100% 달성</span></div>' +
                '<div class="dsh-feed-item"><span class="dsh-feed-time">06-09</span><span>공공시설사업소 — 개선조치 2건 완료 (노후 사다리 교체 외)</span></div>' +
              '</div>' +
            '</div>';

        return hero + chain +
            '<div class="dsh-grid">' +
              '<div style="display:flex; flex-direction:column; gap:16px;">' + deptCard + dutyCard + '</div>' +
              '<div style="display:flex; flex-direction:column; gap:16px;">' + approveCard + budgetCard + feedCard + '</div>' +
            '</div>';
    }

    /* =====================================================================
     * super — 실과장·사업소장·읍면장(관리감독자) 대시보드 (소관 부서 스코프)
     * ===================================================================== */
    function superView(p) {
        const seed = SUPER_SEED[p.deptId] || SUPER_SEED.safety;
        const deptRow = DEPT_RATES.find(d => d.id === p.deptId) || { rate: 60, overdue: 0 };
        const headcount = global.DYV2.orgCount(p.deptId, true);
        const overdueN = seed.tasks.filter(t => t.st === '기한초과').length;

        const hero =
            '<div class="dsh-hero is-dept">' +
              '<div class="dsh-hero-main">' +
                '<div class="dsh-hero-label">' + E(p.deptName) + ' 안전관리 이행률</div>' +
                '<div class="dsh-hero-num">' + deptRow.rate + '<em>%</em></div>' +
                '<div class="progress"><div class="progress-bar ' + barCls(deptRow.rate) + '" style="width:' + deptRow.rate + '%"></div></div>' +
                '<div class="dsh-hero-delta">군 평균 72% ' + (deptRow.rate >= 72 ? '이상' : '미만') + ' · 소속 인원 ' + headcount + '명</div>' +
              '</div>' +
              '<div class="dsh-hero-stats">' +
                '<a class="dsh-hero-stat' + (overdueN ? ' is-danger' : '') + '" href="my-work.html"><b>' + overdueN + '<em>건</em></b><span>기한 초과</span></a>' +
                '<a class="dsh-hero-stat" href="my-work.html"><b>' + seed.tasks.length + '<em>건</em></b><span>부서 진행 업무</span></a>' +
                '<a class="dsh-hero-stat" href="edu-status.html?dept=' + E(p.deptId) + '"><b>' + seed.eduRate + '<em>%</em></b><span>교육 이수율</span></a>' +
                '<a class="dsh-hero-stat" href="rsk-imp.html"><b>' + seed.imp.open + '<em>건</em></b><span>개선조치 미완료</span></a>' +
              '</div>' +
            '</div>';

        const taskRows = seed.tasks.map(t =>
            '<tr><td style="font-weight:600;">' + E(t.title) + '</td>' +
            '<td>' + E(t.due) + '</td><td>' + E(t.owner) + '</td>' +
            '<td>' + chip(t.st) + '</td>' +
            '<td><a class="btn btn-sm btn-outline" href="' + t.href + '">이동</a></td></tr>').join('');
        const taskCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">우리 부서 진행 업무</span>' +
                '<a class="btn btn-sm btn-secondary" href="my-work.html">내 할일 전체</a></div>' +
              '<div class="card-body"><div style="overflow-x:auto;"><table class="table-figma">' +
                '<thead><tr><th>업무</th><th>기한</th><th>담당</th><th>상태</th><th></th></tr></thead>' +
                '<tbody>' + taskRows + '</tbody></table></div></div>' +
            '</div>';

        const rskCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">위험성평가 · 개선조치</span>' +
                '<a class="btn btn-sm btn-secondary" href="rsk-list.html">위험성평가</a></div>' +
              '<div class="card-body"><div class="statbox-grid cols-3">' +
                '<div class="statbox info"><div class="statbox-num">' + seed.rsk.done + '/' + seed.rsk.total + '</div><div class="statbox-label">평가 완료 (건)</div></div>' +
                '<div class="statbox ' + (seed.rsk.delay ? 'danger' : 'success') + '"><div class="statbox-num">' + seed.rsk.delay + '</div><div class="statbox-label">평가 지연 (건)</div></div>' +
                '<div class="statbox ' + (seed.imp.delay ? 'danger' : 'neutral') + '"><div class="statbox-num">' + seed.imp.delay + '</div><div class="statbox-label">개선조치 지연 (건)</div></div>' +
              '</div></div>' +
            '</div>';

        const confirmRows = seed.confirms.map(c =>
            '<div class="dsh-approve-row"><div><b>' + E(c.title) + '</b><span>' + E(c.by) + ' 제출 · ' + E(c.when) + '</span></div>' +
            '<button class="btn btn-sm btn-primary" type="button" onclick="DYV2.toast(\'확인 처리되었습니다 (프로토타입)\')">확인</button></div>').join('');
        const confirmCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">담당자 제출 확인 대기</span>' +
                '<span class="chip-status warning chip-sm">' + seed.confirms.length + '건</span></div>' +
              '<div class="card-body">' + confirmRows + '</div>' +
            '</div>';

        /* 부서원 교육 이수 — DYV2.ORG 부서 구성원 파생 + 시연 이수율 */
        const node = global.DYV2.orgNode(p.deptId);
        let members = [];
        if (node) {
            members = (node.members || []).slice();
            (node.children || []).forEach(c => { if (c.type === 'team') members = members.concat(c.members || []); });
        }
        const eduSeeds = [100, 100, 88, 60, 45];
        const eduRows = members.slice(0, 5).map((m, i) => {
            const r = eduSeeds[i % eduSeeds.length];
            return '<div class="dsh-rate-row"><span class="rate-label">' + E(m.name) + ' · ' + E(m.role) + '</span>' +
                '<div class="progress"><div class="progress-bar ' + barCls(r) + '" style="width:' + r + '%"></div></div>' +
                '<span class="rate-num">' + r + '%</span></div>';
        }).join('');
        const eduCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">부서원 교육 이수 현황</span>' +
                '<a class="btn btn-sm btn-secondary" href="edu-status.html?dept=' + E(p.deptId) + '">이수현황</a></div>' +
              '<div class="card-body">' + eduRows + '</div>' +
            '</div>';

        return hero +
            '<div class="dsh-grid">' +
              '<div style="display:flex; flex-direction:column; gap:16px;">' + taskCard + rskCard + '</div>' +
              '<div style="display:flex; flex-direction:column; gap:16px;">' + confirmCard + eduCard + '</div>' +
            '</div>';
    }

    /* =====================================================================
     * staff — 업무담당자(실무 수행자) 대시보드
     * ===================================================================== */
    function staffView() {
        const myWork =
            '<div class="statbox-grid cols-4" style="margin-bottom:16px;">' +
              '<a class="statbox danger" href="my-work.html?due=over" style="text-decoration:none;"><div class="statbox-num">4</div><div class="statbox-label">기한 초과 (건)</div></a>' +
              '<a class="statbox warning" href="my-work.html?due=today" style="text-decoration:none;"><div class="statbox-num">2</div><div class="statbox-label">오늘 마감 (건)</div></a>' +
              '<a class="statbox info" href="my-work.html?due=week" style="text-decoration:none;"><div class="statbox-num">7</div><div class="statbox-label">1주일 이내 (건)</div></a>' +
              '<a class="statbox neutral" href="docs-preset.html" style="text-decoration:none;"><div class="statbox-num">12</div><div class="statbox-label">내 담당 문서 (건)</div></a>' +
            '</div>';

        const dueCard =
            '<div class="card" style="margin-bottom:16px;">' +
              '<div class="card-header"><span class="card-title">시기도래 알림</span>' +
                '<div class="tabs" style="margin:0; border:none;">' +
                  '<button class="tab active" id="due-tab-list" onclick="DYDSH.toggleDue(\'list\')">목록</button>' +
                  '<button class="tab" id="due-tab-cal" onclick="DYDSH.toggleDue(\'cal\')">달력 보기</button>' +
                '</div></div>' +
              '<div class="card-body">' +
                '<div id="due-list">' +
                  '<div style="overflow-x:auto;"><table class="table-figma">' +
                    '<thead><tr><th>문서·업무</th><th>대메뉴</th><th>기한</th><th>상태</th><th></th></tr></thead>' +
                    '<tbody>' +
                      '<tr><td style="font-weight:600;">의무이행 점검표 반기 마감</td><td><span class="chip-mini pdca">이행관리</span></td><td>2026-06-03</td><td>' + chip('기한초과') + '</td><td><a class="btn btn-sm btn-outline" href="menu.html?m=comply">이동</a></td></tr>' +
                      '<tr><td style="font-weight:600;">정기 위험성평가 결과 등록</td><td><span class="chip-mini pdca">위험성평가</span></td><td>2026-06-11</td><td>' + chip('진행') + '</td><td><a class="btn btn-sm btn-outline" href="rsk-list.html">이동</a></td></tr>' +
                      '<tr><td style="font-weight:600;">상반기 안전보건교육 실시 결과</td><td><span class="chip-mini pdca">안전보건교육</span></td><td>2026-06-17</td><td>' + chip('진행') + '</td><td><a class="btn btn-sm btn-outline" href="edu-status.html">이동</a></td></tr>' +
                      '<tr><td style="font-weight:600;">도급사업 안전보건 점검 (군도 5호선)</td><td><span class="chip-mini pdca">도급관리</span></td><td>2026-06-30</td><td>' + chip('진행') + '</td><td><a class="btn btn-sm btn-outline" href="menu.html?m=contract">이동</a></td></tr>' +
                    '</tbody></table></div>' +
                '</div>' +
                '<div id="due-cal" style="display:none;">' +
                  '<p style="font-size:var(--fs-12); font-weight:700; margin-bottom:8px; text-align:center;">2026년 6월</p>' +
                  '<table class="mini-cal">' +
                    '<thead><tr><th>일</th><th>월</th><th>화</th><th>수</th><th>목</th><th>금</th><th>토</th></tr></thead>' +
                    '<tbody>' +
                      '<tr><td><span class="day muted">31</span></td><td><span class="day">1</span></td><td><span class="day">2</span></td><td><span class="day has-due">3</span></td><td><span class="day">4</span></td><td><span class="day">5</span></td><td><span class="day">6</span></td></tr>' +
                      '<tr><td><span class="day">7</span></td><td><span class="day">8</span></td><td><span class="day">9</span></td><td><span class="day">10</span></td><td><span class="day today has-due">11</span></td><td><span class="day">12</span></td><td><span class="day">13</span></td></tr>' +
                      '<tr><td><span class="day">14</span></td><td><span class="day">15</span></td><td><span class="day">16</span></td><td><span class="day has-due">17</span></td><td><span class="day">18</span></td><td><span class="day">19</span></td><td><span class="day">20</span></td></tr>' +
                      '<tr><td><span class="day">21</span></td><td><span class="day">22</span></td><td><span class="day">23</span></td><td><span class="day">24</span></td><td><span class="day">25</span></td><td><span class="day">26</span></td><td><span class="day">27</span></td></tr>' +
                      '<tr><td><span class="day">28</span></td><td><span class="day">29</span></td><td><span class="day has-due">30</span></td><td><span class="day muted">1</span></td><td><span class="day muted">2</span></td><td><span class="day muted">3</span></td><td><span class="day muted">4</span></td></tr>' +
                    '</tbody></table>' +
                  '<p style="font-size:var(--fs-12); color:var(--text-gray); text-align:center; margin-top:8px;">● 빨간 점 = 마감 도래 일자</p>' +
                '</div>' +
              '</div>' +
            '</div>';

        const ratesRows = Object.keys(global.DYV2.MENUS).map(key => {
            const m = global.DYV2.MENUS[key];
            const r = global.DYV2.complianceRate(key);
            return '<a class="dsh-rate-row" href="' + m.href + '" style="text-decoration:none;">' +
                '<span class="rate-label">' + E(m.label) + '</span>' +
                '<div class="progress"><div class="progress-bar ' + barCls(r) + '" style="width:' + r + '%"></div></div>' +
                '<span class="rate-num">' + r + '%</span></a>';
        }).join('');
        const ratesCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">안전관리 진행현황 — 대메뉴별 이행률</span></div>' +
              '<div class="card-body">' + ratesRows + '</div>' +
            '</div>';

        const feeds =
            '<div style="display:flex; flex-direction:column; gap:16px;">' +
              '<div class="card">' +
                '<div class="card-header"><span class="card-title">예방활동 요약</span></div>' +
                '<div class="card-body">' +
                  '<div class="dsh-feed-item"><span class="dsh-feed-time">오늘 10:20</span><span>수시 위험성평가 완료 — 하수처리장 설비 변경 <a href="rsk-list.html" style="color:var(--main); font-weight:700;">보기</a></span></div>' +
                  '<div class="dsh-feed-item"><span class="dsh-feed-time">오늘 09:05</span><span>종사자 신고 1건 접수 — 보도블록 침하 <a href="rsk-occ.html" style="color:var(--main); font-weight:700;">보기</a></span></div>' +
                  '<div class="dsh-feed-item"><span class="dsh-feed-time">어제 16:40</span><span>관리감독자 교육 이수율 100% 달성</span></div>' +
                  '<div class="dsh-feed-item"><span class="dsh-feed-time">06-09</span><span>개선조치 2건 완료 처리 — 노후 사다리 교체 외</span></div>' +
                  '<div class="dsh-feed-item"><span class="dsh-feed-time">06-08</span><span>도급사업 서약서 3건 첨부 완료</span></div>' +
                '</div>' +
              '</div>' +
              '<div class="card">' +
                '<div class="card-header"><span class="card-title">알림 메시지 이력</span>' +
                  '<a class="btn btn-sm btn-secondary" href="admin-notify.html">전체</a></div>' +
                '<div class="card-body">' +
                  '<div class="dsh-feed-item"><span class="dsh-feed-time">오늘 08:00</span><span><span class="chip-mini wt-elec">문자</span> 기한 초과 알림 — 의무이행 점검표 (재난안전과장 외 2명)</span></div>' +
                  '<div class="dsh-feed-item"><span class="dsh-feed-time">06-10 17:00</span><span><span class="chip-mini wt">메일</span> 시기도래 주간 요약 (부서장 12명)</span></div>' +
                  '<div class="dsh-feed-item"><span class="dsh-feed-time">06-09 09:00</span><span><span class="chip-mini wt-elec">문자</span> 위험성평가 평가자 지정 통보 (4명)</span></div>' +
                '</div>' +
              '</div>' +
            '</div>';

        return myWork + dueCard +
            '<div class="dsh-grid">' + ratesCard + feeds + '</div>';
    }

    function toggleDue(mode) {
        const list = document.getElementById('due-list');
        const cal = document.getElementById('due-cal');
        if (!list || !cal) return;
        list.style.display = mode === 'list' ? '' : 'none';
        cal.style.display = mode === 'cal' ? '' : 'none';
        document.getElementById('due-tab-list').classList.toggle('active', mode === 'list');
        document.getElementById('due-tab-cal').classList.toggle('active', mode === 'cal');
    }

    function init() {
        const root = document.getElementById('dsh-root');
        if (!root || !global.DYROLE || !global.DYV2) return;
        const p = global.DYROLE.current();
        const t = global.DYROLE.tier(p);
        const body = p.tier === 'head' ? headView()
                   : p.tier === 'super' ? superView(p)
                   : staffView();
        root.innerHTML = rolebar(p, t) + body;
    }

    global.DYDSH = { init, toggleDue };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
