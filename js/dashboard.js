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

    /* ── 법정 의무 행 공용 (기준일: 프로토타입 정적 오늘 2026-07-16) ──
     *   중처법 시행령 §4·§5 의 "반기 1회 이상 점검" 의무와 산안법 주기 의무를
     *   근거 조문·주기·마감 D-day 와 함께 표기한다. */
    const TODAY = '2026-07-16';
    function ddays(iso) { return Math.round((new Date(iso) - new Date(TODAY)) / 86400000); }
    function dday(iso) {
        const d = ddays(iso);
        return d < 0 ? 'D+' + (-d) : d === 0 ? 'D-day' : 'D-' + d;
    }
    function lawRow(x) {
        const d = x.due ? ddays(x.due) : null;
        const dCls = d == null ? '' : d < 0 ? ' over' : d <= 30 ? ' soon' : '';
        return '<a class="dsh-law-row" href="' + x.href + '">' +
            '<div class="dsh-law-main"><b>' + E(x.name) + '</b>' +
                '<span class="dsh-law-meta">' + E(x.basis) + ' · ' + E(x.cycle) + (x.note ? ' · ' + E(x.note) : '') + '</span></div>' +
            (x.due ? '<span class="dsh-law-dday' + dCls + '">' + dday(x.due) + '</span>' : '') +
            chip(x.st) +
        '</a>';
    }

    /* ── 시각화 공용 헬퍼 (css/v2.css .dsh-spark/.dsh-heat/.dsh-mbar/… 계열) ── */
    /* 스파크라인 — SVG polyline, 값 배열을 240×34 뷰박스에 정규화 */
    function sparkline(values, label) {
        const min = Math.min.apply(null, values), max = Math.max.apply(null, values);
        const span = (max - min) || 1;
        const pts = values.map((v, i) =>
            (i * (240 / (values.length - 1))).toFixed(1) + ',' +
            (30 - ((v - min) / span) * 26).toFixed(1)).join(' ');
        const last = pts.split(' ').pop().split(',');
        return '<div class="dsh-spark" role="img" aria-label="' + E(label) + ' — 최저 ' + min + ', 최고 ' + max + '">' +
            '<svg viewBox="0 0 240 34" preserveAspectRatio="none" aria-hidden="true">' +
                '<polyline points="' + pts + '" fill="none" stroke="var(--main)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
                '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="3" fill="var(--main)"/>' +
            '</svg>' +
            '<span class="dsh-spark-label">' + E(label) + '</span>' +
        '</div>';
    }
    /* 가로 막대 행 — 기존 .dsh-rate-row 계열 재사용 (값/최대값 스케일) */
    function hbarRow(label, val, max, cls, href, unit) {
        const w = Math.max(4, Math.round(val / (max || 1) * 100));
        const inner = '<span class="rate-label">' + E(label) + '</span>' +
            '<div class="progress"><div class="progress-bar ' + cls + '" style="width:' + w + '%"></div></div>' +
            '<span class="rate-num">' + val + (unit || '건') + '</span>';
        return href
            ? '<a class="dsh-rate-row" href="' + href + '" style="text-decoration:none;">' + inner + '</a>'
            : '<div class="dsh-rate-row">' + inner + '</div>';
    }

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
    /* 시각화 시드 필드 — funnel: 위험성평가 파이프라인 {t 대상, a 평가완료, i 개선 발행, d 개선 완료}
     *   aging: 개선조치 미완료 경과 구간 [1주 미만, 1~4주, 1개월 이상]
     *   hazards: 부서 위험요인 유형 TOP [이름, 건수] · eduHours: 반기 필요/인정 시간 */
    const SUPER_SEED = {
        safety: {
            eduRate: 96, rsk: { total: 14, done: 12, delay: 0 }, imp: { open: 2, delay: 0 },
            funnel: { t: 14, a: 12, i: 9, d: 7 }, aging: [2, 0, 0],
            hazards: [['추락', 3], ['전도', 2], ['끼임', 2], ['화재·감전', 1], ['온열질환', 1]],
            eduHours: { need: 48, done: 46 },
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
            funnel: { t: 9, a: 5, i: 7, d: 2 }, aging: [2, 2, 1],
            hazards: [['추락', 6], ['끼임', 4], ['전도', 3], ['감전', 2], ['온열질환', 1]],
            eduHours: { need: 96, done: 71 },
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
            funnel: { t: 6, a: 4, i: 4, d: 1 }, aging: [2, 1, 0],
            hazards: [['전도', 3], ['추락', 2], ['교통사고', 2], ['온열질환', 1]],
            eduHours: { need: 36, done: 30 },
            tasks: [
                { title: '보도블록 침하 신고 현장 확인', due: '2026-06-12', owner: '배주민', st: '진행', href: 'rsk-occ.html' },
                { title: '읍사무소 정기 위험성평가', due: '2026-06-25', owner: '배주민', st: '미착수', href: 'rsk-list.html' },
            ],
            confirms: [
                { title: '경로당 시설 점검 결과 보고', by: '배주민 담당', when: '오늘 11:00' },
            ],
        },
    };

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
                sparkline([58, 60, 61, 63, 64, 66, 68, 67, 69, 70, 68, 72], '최근 12개월 추이') +
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

        /* 중처법 시행령 §4 — 안전보건관리체계 구축·이행 9개 의무.
         *   3·5·7·8·9호는 "반기 1회 이상 점검" 명시 의무 → 하반기 점검 마감 D-day 표기. */
        const H2_DUE = '2026-12-31';
        const duties = [
            { name: '안전·보건 목표와 경영방침 설정',          basis: '시행령 §4 1호', cycle: '상시 게시',    st: '완료',   href: 'menu.html?m=policy' },
            { name: '안전보건 업무 전담조직 구성·운영',        basis: '시행령 §4 2호', cycle: '상시',         st: '완료',   href: 'menu.html?m=org' },
            { name: '유해·위험요인 확인·개선 (위험성평가)',    basis: '시행령 §4 3호', cycle: '반기 1회 점검', st: '진행',   href: 'rsk-list.html', due: H2_DUE },
            { name: '재해예방 예산 편성·집행',                 basis: '시행령 §4 4호', cycle: '연간·상시',    st: '진행',   href: 'bgt-main.html', note: '집행률 64.5%' },
            { name: '안전보건관리책임자 등 권한 부여·평가',    basis: '시행령 §4 5호', cycle: '반기 1회 평가', st: '완료',   href: 'evl-eval.html', due: H2_DUE },
            { name: '안전관리자 등 전문인력 배치',             basis: '시행령 §4 6호', cycle: '상시',         st: '완료',   href: 'menu.html?m=org' },
            { name: '종사자 의견청취 절차 운영',               basis: '시행령 §4 7호', cycle: '반기 1회 점검', st: '완료',   href: 'menu.html?m=opinion', note: '산보위 갈음' },
            { name: '중대재해·급박한 위험 대비 매뉴얼 점검',   basis: '시행령 §4 8호', cycle: '반기 1회 점검', st: '진행',   href: 'docs-archive.html', due: H2_DUE },
            { name: '도급·용역·위탁 시 기준·절차 확인',        basis: '시행령 §4 9호', cycle: '반기 1회 점검', st: '미착수', href: 'menu.html?m=contract', due: H2_DUE },
        ];
        const doneN = duties.filter(d => d.st === '완료').length;
        const dutyCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">안전보건관리체계 9개 의무 — 중처법 §4·시행령 §4</span>' +
                '<span class="chip-status warning chip-sm">하반기 점검 ' + dday(H2_DUE) + '</span></div>' +
              '<div class="card-body">' +
                '<div class="dsh-law-note">상반기 점검 결과는 <b>07-08 결재 완료</b>. 3·5·7·8·9호는 <b>반기 1회 이상 점검</b>이 법정 의무입니다 (하반기 마감 12-31).</div>' +
                '<div class="dsh-duty-sum"><div class="progress"><div class="progress-bar green" style="width:' + Math.round(doneN / duties.length * 100) + '%"></div></div>' +
                  '<span>' + doneN + ' / ' + duties.length + ' 완료</span></div>' +
                duties.map(lawRow).join('') +
              '</div>' +
            '</div>';

        /* 중처법 시행령 §5 — 안전보건 관계 법령 의무이행에 필요한 관리상 조치 */
        const law5Card =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">관계 법령 이행 관리 — 시행령 §5</span>' +
                '<a class="btn btn-sm btn-secondary" href="menu.html?m=comply">이행관리</a></div>' +
              '<div class="card-body">' +
                lawRow({ name: '관계 법령 의무이행 반기 점검',       basis: '시행령 §5 2항 1호', cycle: '반기 1회', st: '진행', href: 'menu.html?m=comply', due: H2_DUE, note: '상반기 완료' }) +
                lawRow({ name: '미이행 사항 인력·예산 등 지원 조치', basis: '시행령 §5 2항 2호', cycle: '점검 후 즉시', st: '진행', href: 'rsk-imp.html', note: '개선 2건' }) +
                lawRow({ name: '법정 교육 실시 확인·미실시 시 지시', basis: '시행령 §5 2항 3·4호', cycle: '반기 1회', st: '진행', href: 'edu-status.html', due: H2_DUE, note: '미달 2부서' }) +
              '</div>' +
            '</div>';

        /* 부서 × 9개 의무 히트맵 — "어느 부서의 어느 의무가 구멍인가"를 한 눈에.
         *   시연 시드: 부서 이행률(DEPT_RATES)에서 결정적으로 파생 (9호 도급은 전반 취약). */
        const heatHead = duties.map((d, j) =>
            '<th title="' + E(d.name) + '">' + (j + 1) + '호</th>').join('');
        const heatRows = DEPT_RATES.map((dep, i) => {
            const cells = duties.map((d, j) => {
                const score = dep.rate - j * 2 + ((i * 7 + j * 5) % 13) - (j === 8 ? 14 : 0);
                const cls = score >= 68 ? 'ok' : score >= 55 ? 'run' : 'bad';
                const glyph = cls === 'ok' ? '✓' : cls === 'run' ? '─' : '!';
                const stTxt = cls === 'ok' ? '이행' : cls === 'run' ? '진행' : '보완필요';
                return '<td><span class="dsh-heat-cell ' + cls + '" role="link" tabindex="0"' +
                    ' title="' + E(dep.name) + ' · ' + E(d.name) + ' — ' + stTxt + '"' +
                    ' aria-label="' + E(dep.name) + ' ' + (j + 1) + '호 ' + stTxt + '"' +
                    ' onclick="location.href=\'' + d.href + '\'"' +
                    ' onkeydown="if(event.key===\'Enter\')location.href=\'' + d.href + '\'">' + glyph + '</span></td>';
            }).join('');
            return '<tr><th class="rowh">' + E(dep.name) + '</th>' + cells + '</tr>';
        }).join('');
        const heatCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">부서 × 의무 이행 매트릭스 — 시행령 §4 반기 점검 준비</span>' +
                '<a class="btn btn-sm btn-secondary" href="menu.html?m=comply">이행관리</a></div>' +
              '<div class="card-body">' +
                '<div class="dsh-heat-wrap"><table class="dsh-heat" aria-label="부서별 9개 의무 이행 매트릭스">' +
                  '<thead><tr><th class="rowh">부서</th>' + heatHead + '</tr></thead>' +
                  '<tbody>' + heatRows + '</tbody>' +
                '</table></div>' +
                '<div class="dsh-viz-legend">' +
                  '<span><i style="background:var(--status-success-bg);"></i>✓ 이행</span>' +
                  '<span><i style="background:var(--status-warning-bg);"></i>─ 진행</span>' +
                  '<span><i style="background:var(--status-danger-bg);"></i>! 보완필요</span>' +
                  '<span style="margin-left:auto;">칸을 누르면 해당 의무 화면으로 이동</span>' +
                '</div>' +
              '</div>' +
            '</div>';

        /* 재해·아차사고 월별 추이 — 중대재해 0건의 근거 (예방활동 작동 증빙) */
        const ACC = [2, 1, 3, 0, 2, 1, 1, null, null, null, null, null];  /* null = 미도래 월 */
        const accMax = Math.max.apply(null, ACC.filter(v => v != null));
        const accCols = ACC.map((v, i) => {
            const future = v == null;
            const h = future ? 4 : Math.max(4, Math.round(v / accMax * 52));
            return '<div class="dsh-mbar-col' + (v === 0 ? ' zero' : '') + (future ? ' future' : '') + '"' +
                ' title="' + (i + 1) + '월 ' + (future ? '미도래' : '아차사고·신고 ' + v + '건') + '">' +
                (future ? '' : '<span class="dsh-mbar-num">' + v + '</span>') +
                '<div class="dsh-mbar-bar" style="height:' + h + 'px;"></div>' +
                '<span class="dsh-mbar-lbl">' + (i + 1) + '</span></div>';
        }).join('');
        const accCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">재해·아차사고 추이 (월별)</span>' +
                '<span class="chip-status success chip-sm">중대재해 0건 지속</span></div>' +
              '<div class="card-body">' +
                '<div class="dsh-mbar" role="img" aria-label="월별 아차사고·신고 건수 — 1월 2건부터 7월 1건까지, 중대재해 0건 지속">' + accCols + '</div>' +
                '<div class="dsh-viz-legend"><span><i style="background:var(--status-info-fg);"></i>아차사고·종사자 신고</span>' +
                  '<span><i style="background:var(--gray-200);"></i>0건</span>' +
                  '<a href="rsk-occ.html" style="margin-left:auto; color:var(--main); font-weight:700;">신고 현황 →</a></div>' +
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

        /* 예산 집행 도넛 — 항목별 분해 (시행령 §4 4호 "편성·집행" 증빙 관점) */
        const BGT = [
            { name: '시설 개선',      amt: '1.42억', pct: 34,   color: 'var(--main)' },
            { name: '안전보건교육',   amt: '0.63억', pct: 15,   color: 'var(--status-info-fg)' },
            { name: '보호구·장비',    amt: '0.38억', pct: 9,    color: 'var(--status-warning-fg)' },
            { name: '진단·컨설팅',    amt: '0.28억', pct: 6.5,  color: 'var(--status-purple-fg)' },
            { name: '미집행',         amt: '1.49억', pct: 35.5, color: 'var(--gray-200)' },
        ];
        let acc2 = 0;
        const donutStops = BGT.map(s => {
            const from = acc2; acc2 += s.pct;
            return s.color + ' ' + from + '% ' + acc2 + '%';
        }).join(', ');
        const donutLegend = BGT.map(s =>
            '<div class="dsh-legend-row"><i style="background:' + s.color + ';"></i>' +
            '<span>' + E(s.name) + '</span><b>' + E(s.amt) + '</b></div>').join('');
        const budgetCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">안전보건 예산 집행 — 시행령 §4 4호</span>' +
                '<a class="btn btn-sm btn-secondary" href="bgt-main.html">예산 총괄표</a></div>' +
              '<div class="card-body">' +
                '<div class="dsh-donut-wrap">' +
                  '<div class="dsh-donut" data-center="64.5%" role="img"' +
                    ' aria-label="예산 집행률 64.5% — 시설 개선 1.42억, 교육 0.63억, 보호구 0.38억, 진단 0.28억, 미집행 1.49억"' +
                    ' style="background:conic-gradient(' + donutStops + ');"></div>' +
                  '<div class="dsh-donut-legend">' + donutLegend + '</div>' +
                '</div>' +
                '<div class="dsh-duty-row"><span>2026년 편성액</span><b>4.20억 원</b></div>' +
                '<div class="dsh-duty-row"><span>집행액 (6월 기준)</span><b>2.71억 원</b></div>' +
                '<div class="dsh-duty-row"><span>집행 부진 항목 (진단·컨설팅)</span>' + chip('주의') + '</div>' +
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
              '<div style="display:flex; flex-direction:column; gap:16px;">' + heatCard + deptCard + dutyCard + '</div>' +
              '<div style="display:flex; flex-direction:column; gap:16px;">' + approveCard + law5Card + accCard + budgetCard + feedCard + '</div>' +
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

        /* 산안법 §16·시행령 §15 — 관리감독자 법정 직무 6항 + 본인 정기교육(연 16h).
         *   점검·개선 상태는 부서 시드(rsk/imp)와 연동해 부서별로 달라진다. */
        const lawSupCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">관리감독자 법정 직무 — 산안법 §16 · 시행령 §15</span>' +
                '<span class="chip-status info chip-sm">' + E(p.deptName) + '</span></div>' +
              '<div class="card-body">' +
                '<div class="dsh-law-note">관리감독자는 소관 부서의 <b>생산과 관련되는 업무와 소속 직원을 직접 지휘·감독</b>하며 아래 직무를 수행합니다. 미이행 시 중처법 시행령 §4 5호 평가에 반영됩니다.</div>' +
                lawRow({ name: '기계·기구·설비 안전 점검, 이상 시 즉시 조치', basis: '시행령 §15 1호', cycle: '수시',
                         st: seed.imp.delay ? '주의' : '진행', href: 'fac-list.html', note: seed.imp.delay ? '개선 지연 ' + seed.imp.delay + '건' : '' }) +
                lawRow({ name: '보호구·방호장치 점검과 착용·사용 교육·지도', basis: '시행령 §15 2호', cycle: '수시', st: '완료', href: 'edu-status.html?dept=' + E(p.deptId) }) +
                lawRow({ name: '산업재해 보고와 응급조치 (발생 시)',          basis: '시행령 §15 3호', cycle: '발생 즉시', st: '완료', href: 'rsk-occ.html', note: '보고체계 정비' }) +
                lawRow({ name: '작업장 정리정돈·통로 확보 확인·감독',        basis: '시행령 §15 4호', cycle: '수시', st: '완료', href: 'fac-list.html' }) +
                lawRow({ name: '부서 위험성평가 참여 — 유해·위험요인 파악·개선', basis: '산안법 §36 · 시행령 §15', cycle: '정기 연 1회 + 수시',
                         st: seed.rsk.delay ? '주의' : '진행', href: 'rsk-list.html', due: '2026-12-31', note: seed.rsk.done + '/' + seed.rsk.total + ' 완료' }) +
                lawRow({ name: '관리감독자 본인 정기교육 이수 (연 16h)',      basis: '산안법 §29 · 시행규칙 별표4', cycle: '연간', st: '진행', href: 'edu-sup.html', due: '2026-12-31', note: '8/16h 인정' }) +
              '</div>' +
            '</div>';

        /* 파이프라인 — 대상 → 평가 → 개선 발행 → 개선 완료 흐름 (statbox 요약 아래) */
        const fn = seed.funnel;
        const fnMax = Math.max(fn.t, fn.i);
        const funnelHtml =
            '<div class="dsh-funnel" role="img" aria-label="위험성평가 흐름 — 대상 ' + fn.t + '건, 평가 완료 ' + fn.a + '건, 개선 발행 ' + fn.i + '건, 개선 완료 ' + fn.d + '건">' +
                [['평가 대상', fn.t], ['평가 완료', fn.a], ['개선 발행', fn.i], ['개선 완료', fn.d]].map(s =>
                    '<div class="dsh-funnel-row"><span class="fn-label">' + s[0] + '</span>' +
                    '<div class="dsh-funnel-bar" style="width:' + Math.max(12, Math.round(s[1] / fnMax * 100)) + '%;">' + s[1] + '</div></div>').join('') +
            '</div>';
        const rskCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">위험성평가 · 개선조치</span>' +
                '<a class="btn btn-sm btn-secondary" href="rsk-list.html">위험성평가</a></div>' +
              '<div class="card-body"><div class="statbox-grid cols-3">' +
                '<div class="statbox info"><div class="statbox-num">' + seed.rsk.done + '/' + seed.rsk.total + '</div><div class="statbox-label">평가 완료 (건)</div></div>' +
                '<div class="statbox ' + (seed.rsk.delay ? 'danger' : 'success') + '"><div class="statbox-num">' + seed.rsk.delay + '</div><div class="statbox-label">평가 지연 (건)</div></div>' +
                '<div class="statbox ' + (seed.imp.delay ? 'danger' : 'neutral') + '"><div class="statbox-num">' + seed.imp.delay + '</div><div class="statbox-label">개선조치 지연 (건)</div></div>' +
              '</div>' + funnelHtml + '</div>' +
            '</div>';

        /* 위험요인 유형 TOP — "우리 부서는 뭐가 위험한가" (부서 위험 프로파일) */
        const hzMax = Math.max.apply(null, seed.hazards.map(h => h[1]));
        const hazardCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">부서 위험요인 유형 TOP ' + seed.hazards.length + '</span>' +
                '<a class="btn btn-sm btn-secondary" href="rsk-list.html">평가 상세</a></div>' +
              '<div class="card-body">' +
                seed.hazards.map(h => hbarRow(h[0], h[1], hzMax, 'warning', 'rsk-list.html')).join('') +
              '</div>' +
            '</div>';

        /* 개선조치 에이징 — 미완료 건의 경과 구간별 분포 (오래 방치된 것부터 재촉) */
        const agMax = Math.max.apply(null, seed.aging.concat([1]));
        const agingCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">개선조치 미완료 ' + seed.imp.open + '건 — 경과 기간</span>' +
                '<a class="btn btn-sm btn-secondary" href="rsk-imp.html">개선조치</a></div>' +
              '<div class="card-body">' +
                hbarRow('1주 미만',   seed.aging[0], agMax, 'green',   'rsk-imp.html') +
                hbarRow('1~4주 경과', seed.aging[1], agMax, 'warning', 'rsk-imp.html') +
                hbarRow('1개월 이상', seed.aging[2], agMax, 'danger',  'rsk-imp.html') +
                (seed.aging[2] ? '<div class="dsh-law-note" style="margin:8px 0 0;"><b>1개월 이상 방치 ' + seed.aging[2] + '건</b> — 재촉 또는 기한 협의가 필요합니다.</div>' : '') +
              '</div>' +
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
        const eh = seed.eduHours;
        const eduCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">부서원 교육 이수 현황</span>' +
                '<a class="btn btn-sm btn-secondary" href="edu-status.html?dept=' + E(p.deptId) + '">이수현황</a></div>' +
              '<div class="card-body">' +
                '<div class="dsh-duty-sum"><div class="progress"><div class="progress-bar ' + barCls(seed.eduRate) + '" style="width:' + seed.eduRate + '%"></div></div>' +
                  '<span>반기 필요 ' + eh.need + 'h 중 ' + eh.done + 'h 인정 (' + seed.eduRate + '%)</span></div>' +
                eduRows +
              '</div>' +
            '</div>';

        return hero +
            '<div class="dsh-grid">' +
              '<div style="display:flex; flex-direction:column; gap:16px;">' + taskCard + lawSupCard + rskCard + hazardCard + '</div>' +
              '<div style="display:flex; flex-direction:column; gap:16px;">' + confirmCard + agingCard + eduCard + '</div>' +
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

        /* D-day 구간 스트립 — 내 할일 분포를 하나의 축으로 (구간 클릭 = 해당 필터) */
        const dueSeg = [
            ['지연 4',    4, 't-danger',  'my-work.html?due=over'],
            ['오늘 2',    2, 't-warning', 'my-work.html?due=today'],
            ['이번주 7',  7, 't-info',    'my-work.html?due=week'],
            ['예정 9',    9, 't-neutral', 'my-work.html'],
        ];
        const dueTotal = dueSeg.reduce((a, s) => a + s[1], 0);
        const dueStrip =
            '<div class="dsh-stack" role="group" aria-label="내 할일 마감 분포 — 지연 4건, 오늘 2건, 이번주 7건, 예정 9건">' +
                dueSeg.map(s =>
                    '<a class="' + s[2] + '" href="' + s[3] + '" style="flex:' + s[1] + ' 1 0;"' +
                    ' title="' + s[0] + '건 — 클릭하면 내 할일에서 필터됩니다">' + s[0] + '</a>').join('') +
            '</div>';

        /* 실무자 법정 의무 캘린더 — 이번 반기(2026 하반기) 기준.
         *   산안법 §29(정기교육)·§36(위험성평가)·§24(산보위)·§125(작업환경측정) +
         *   중처법 시행령 §5(의무이행 점검표). 마감 D-day 순으로 표기, 내 할일과 딥링크 연동. */
        const lawItems = [
            { name: '의무이행 점검표 반기 제출',       basis: '중처법 시행령 §5', cycle: '반기 1회',    st: '기한초과', href: 'my-work.html?cat=comply', due: '2026-07-08' },
            { name: '산업안전보건위원회 정기회의',     basis: '산안법 §24',       cycle: '분기 1회',    st: '예정',     href: 'menu.html?m=opinion&sub=committee', due: '2026-09-30', note: '회의록 등록 필요' },
            { name: '정기 위험성평가 결과 등록',       basis: '산안법 §36',       cycle: '연 1회 + 수시', st: '진행',   href: 'rsk-list.html', due: '2026-12-31' },
            { name: '근로자 정기 안전보건교육',        basis: '산안법 §29',       cycle: '반기 6h/12h', st: '진행',     href: 'edu-status.html', due: '2026-12-31', note: '미달 2부서' },
            { name: '채용 시 안전보건교육 (신규자)',   basis: '산안법 §29',       cycle: '채용 즉시 8h', st: '주의',    href: 'edu-hire.html', note: '대상 2명 미이수' },
            { name: '작업환경측정',                    basis: '산안법 §125',      cycle: '반기 1회',    st: '미착수',   href: 'work-env.html', due: '2026-12-31' },
        ];
        const lawCalCard =
            '<div class="card" style="margin-bottom:16px;">' +
              '<div class="card-header"><span class="card-title">법정 의무 캘린더 — 2026 하반기</span>' +
                '<a class="btn btn-sm btn-secondary" href="my-work.html">내 할일</a></div>' +
              '<div class="card-body">' +
                '<div class="dsh-law-note">담당 업무 중 <b>법령이 주기를 정한 의무</b>만 모았습니다. 기한초과·마감 임박 건부터 처리하세요 — 행을 누르면 처리 화면으로 이동합니다.</div>' +
                lawItems.map(lawRow).join('') +
              '</div>' +
            '</div>';

        /* 연간 법정 의무 로드맵 (미니 간트) — 어느 달에 의무가 몰리는지 부하 예측.
         *   셀 상태: done 완료 / due 예정 / over 기한초과 / always 상시 · 7월 = 현재(외곽선) */
        const NOW_M = 7;
        const roadRows = [
            { name: '의무이행 점검표',      basis: '시행령 §5 · 반기',  m: { 7: 'over', 12: 'due' } },
            { name: '산업안전보건위원회',   basis: '산안법 §24 · 분기', m: { 3: 'done', 6: 'done', 9: 'due', 12: 'due' } },
            { name: '정기 위험성평가',      basis: '산안법 §36 · 연 1회', m: { 12: 'due' } },
            { name: '근로자 정기교육',      basis: '산안법 §29 · 반기', m: { 6: 'done', 12: 'due' } },
            { name: '채용 시 교육',         basis: '산안법 §29 · 상시', always: true },
            { name: '작업환경측정',         basis: '산안법 §125 · 반기', m: { 6: 'done', 12: 'due' } },
        ];
        const roadHead = '<div class="dsh-road-head"><span></span>' +
            Array.from({ length: 12 }, (_, i) =>
                '<span' + (i + 1 === NOW_M ? ' class="now"' : '') + '>' + (i + 1) + '월</span>').join('') + '</div>';
        const roadBody = roadRows.map(r => {
            const cells = Array.from({ length: 12 }, (_, i) => {
                const mo = i + 1;
                const cls = r.always ? 'always' : (r.m[mo] || '');
                const stTxt = cls === 'done' ? '완료' : cls === 'due' ? '예정' : cls === 'over' ? '기한초과' : cls === 'always' ? '상시' : '';
                return '<span class="dsh-road-cell ' + cls + (mo === NOW_M ? ' now' : '') + '"' +
                    (stTxt ? ' title="' + E(r.name) + ' — ' + mo + '월 ' + stTxt + '"' : '') + '></span>';
            }).join('');
            return '<div class="dsh-road-row"><span class="dsh-road-label" title="' + E(r.basis) + '">' + E(r.name) + '</span>' + cells + '</div>';
        }).join('');
        const roadCard =
            '<div class="card" style="margin-bottom:16px;">' +
              '<div class="card-header"><span class="card-title">연간 법정 의무 로드맵 (2026)</span>' +
                '<span class="chip-status info chip-sm">12월 마감 4건 집중</span></div>' +
              '<div class="card-body">' +
                '<div class="dsh-road-wrap"><div class="dsh-road" role="img" aria-label="연간 법정 의무 로드맵 — 12월에 점검표·산보위·위험성평가·정기교육·측정 마감이 집중됩니다">' +
                    roadHead + roadBody +
                '</div></div>' +
                '<div class="dsh-viz-legend">' +
                  '<span><i style="background:var(--status-success-bg);"></i>완료</span>' +
                  '<span><i style="background:var(--status-info-bg);"></i>예정</span>' +
                  '<span><i style="background:var(--status-danger-bg);"></i>기한초과</span>' +
                  '<span><i style="background:var(--brand-50);"></i>상시</span>' +
                  '<span style="margin-left:auto;">굵은 외곽선 = 이번 달 (7월)</span>' +
                '</div>' +
              '</div>' +
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

        /* 카테고리별 잔여 업무 미니 바 — 내 할일 ?cat= 딥링크 연동 */
        const catSeed = [
            ['결재', 'approval', 2], ['개선', 'improve', 2], ['점검', 'inspection', 2], ['이행', 'comply', 2],
            ['교육', 'edu', 2], ['도급', 'contract', 2], ['평가', 'eval', 1], ['의견', 'opinion', 1],
        ];
        const catMax = Math.max.apply(null, catSeed.map(c => c[2]));
        const catCard =
            '<div class="card">' +
              '<div class="card-header"><span class="card-title">카테고리별 잔여 업무</span>' +
                '<a class="btn btn-sm btn-secondary" href="my-work.html">내 할일</a></div>' +
              '<div class="card-body">' +
                catSeed.map(c => hbarRow(c[0], c[2], catMax, 'blue', 'my-work.html?cat=' + c[1])).join('') +
              '</div>' +
            '</div>';

        const feeds =
            '<div style="display:flex; flex-direction:column; gap:16px;">' +
              catCard +
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

        return myWork + dueStrip + lawCalCard + roadCard + dueCard +
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
        const body = p.tier === 'head' ? headView()
                   : p.tier === 'super' ? superView(p)
                   : staffView();
        root.innerHTML = body;
    }

    global.DYDSH = { init, toggleDue };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
