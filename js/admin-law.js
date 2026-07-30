/* =============================================================================
 *  admin-law.js — 시스템 관리 > 법령 관리 (ADM04-S, 전역 DYADMLAW + LAWTABS)
 * -----------------------------------------------------------------------------
 *  2026-07-30 통합 — 법령·조문(구 ADM04)과 메뉴 근거 매핑(구 ADM05) 2메뉴를
 *  이 화면 하나의 **탭 3개**로 합쳤다(사용자 결정, 기획-법령관리-화면-v1 §2.3
 *  "2화면" 결정을 대체). 탭 셸이 LAWTABS 이고, 조문 탭 본체가 DYADMLAW 다.
 *
 *    탭1 법령·조문     — 수록 대장·원문·영향 범위·무결성·수집 검토 (DYADMLAW)
 *    탭2 메뉴 근거 매핑 — 화면별 근거 검토 대장·재검토 요청 (DYADMLAWMAP, admin-law-map.js)
 *    탭3 변경 이력     — 두 탭의 조작이 쌓이는 단일 타임라인
 *
 *  두 탭 모두 **편집 화면이 아니다** — 조문도 매핑도 생성물(law-map.js)이라
 *  화면에서 고치지 않는다. 사람이 남기는 것은 판단 기록(재검토 요청·분류·
 *  운영 판단)뿐이다.
 *
 *  수록 조문 대장. 이 화면의 핵심은 **조문을 고칠 수 없다는 것**이다.
 *  원문 옆에 편집 아이콘이 없는 것이 설계의 시각적 핵심이며, 규칙 문구보다
 *  없는 입력란이 세다(CLAUDE.md §10).
 *
 *  단일 모달 규칙(§1): 확인이 필요한 조작만 DYV2.openModal 1개. 그 외는 인라인 패널.
 * ========================================================================== */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var L = function () { return global.DYLAW; };
    var A = function () { return global.LAWADM; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }
    function toast(m) { V().toast(m); }
    function chip(label) {
        return '<span class="chip-status ' + V().toneOf(label) + '">' + esc(label) + '</span>';
    }

    var state = { mount: null, sel: { type: 'law', key: '' }, q: '', view: 'tree', open: {} };

    /* =============== 렌더 =============== */
    function render() {
        if (!state.mount) return;
        state.mount.innerHTML =
            topbar() +
            '<div class="admp-2col">' +
                '<div class="admp-listcard card">' + leftCard() + '</div>' +
                '<div class="admp-panel">' + panel() + '</div>' +
            '</div>';
        /* 변경 이력은 탭 3(단일 타임라인)으로 이동 — 이 탭에는 그리지 않는다 */
    }

    function topbar() {
        var S = L().SNAPSHOT, laws = Object.keys(L().LAWS).length, arts = Object.keys(L().ARTICLES).length;
        var bad = A().integrityBad();
        var stage = A().stageLoad();
        return '<div class="admp-topbar">' +
            '<span class="admp-topbar-hint">' +
                '법제처 스냅샷 <b>' + esc(S.fetchedAt) + '</b> · 법령 <b>' + laws + '종</b> · 조문 <b>' + arts + '건</b>' +
                '<br>조문 원문은 이 화면에서 <b>고칠 수 없습니다</b> — 법령 갱신(재수집)으로만 바뀝니다. ' +
                '수록 목록은 완결된 것이 아니며, <b>관계 법령 목록은 발주처 확정 대기</b>입니다.' +
            '</span>' +
            '<span style="flex:1;"></span>' +
            (bad ? '<button type="button" class="btn btn-sm btn-outline" onclick="DYADMLAW.sel(\'integrity\',\'\')">무결성 ' + bad + '건</button>' : '') +
            '<button type="button" class="btn btn-sm btn-primary" onclick="DYADMLAW.sync()">' +
                (stage ? '수집 결과 검토' : '수집 요청 등록 (시뮬레이션)') + '</button>' +
            '<button type="button" class="btn btn-sm btn-outline" onclick="DYADMLAW.exportOpen()">내보내기</button>' +
            '<button type="button" class="btn btn-sm btn-outline" onclick="DYADMLAW.resetDemo()">데모 데이터 초기화</button>' +
        '</div>';
    }

    /* ── 좌측 ── */
    function leftCard() {
        return '<div class="card-header"><span class="card-title">수록 법령·조문</span></div>' +
            '<div class="admm-search">' +
                '<input id="adml-q" type="text" placeholder="조문 검색 — §43 · 제43조 · 43 · 개구부" ' +
                    'value="' + esc(state.q) + '" oninput="DYADMLAW.search(this.value)">' +
            '</div>' +
            '<div class="admm-tree-body">' +
                queueSection() + integritySection() + lawSection() + unlinkedSection() +
            '</div>';
    }

    function queueSection() {
        var items = queueItems();
        return '<div class="adml-sec">' +
            '<div class="adml-sec-head">정비 큐 <span class="adml-count">' + items.length + '</span></div>' +
            (items.length
                ? items.map(function (q) {
                    return '<button type="button" class="adml-row" onclick="DYADMLAW.sel(\'' + q.type + '\',\'' + esc(q.key) + '\')">' +
                        '<span class="adml-row-main">' + esc(q.label) + '</span>' + chip(q.state) + '</button>';
                  }).join('')
                : '<div class="adml-empty-note">처리할 항목이 없습니다.<br>' +
                  '<b>다만 자동 검사가 잡지 못하는 오배정이 있습니다</b> — 조문 번호는 맞는데 내용이 다른 경우는 ' +
                  '어떤 검사에도 걸리지 않습니다. 전수 대조로만 발견됩니다.</div>') +
        '</div>';
    }
    function queueItems() {
        var out = [];
        A().integrity().forEach(function (c) {
            if (c.n > 0 && (c.id === 'dangling' || c.id === 'unreachable')) {
                out.push({ type: 'integrity', key: c.id, label: c.label + ' ' + c.n + '건', state: '개발 수정 필요' });
            }
        });
        /* 매핑 재검토 요청 — 담당자 이의가 묻히지 않게 큐 최상단 계열로 노출 */
        A().reviewAll().forEach(function (r) {
            out.push({ type: 'review', key: r.pageId, label: A().labelOf(r.pageId) + ' — 매핑 재검토 요청', state: '재검토 요청' });
        });
        A().staleVerifies().forEach(function (s) {
            out.push({ type: 'page', key: s.pageId, label: s.pageId + ' — 조문 변경으로 재검증', state: '검증 기록 없음' });
        });
        var st = A().stageLoad();
        if (st) {
            var pend = st.rows.filter(function (r) { return !r.decision && r.kind !== '변경 없음'; }).length;
            if (pend) out.push({ type: 'sync', key: '', label: '수집 결과 검토 대기 ' + pend + '건', state: '보류' });
        }
        return out;
    }

    function integritySection() {
        var bad = A().integrityBad();
        return '<div class="adml-sec">' +
            '<div class="adml-sec-head">무결성</div>' +
            '<button type="button" class="adml-row" onclick="DYADMLAW.sel(\'integrity\',\'\')">' +
                '<span class="adml-row-main">검사 6종</span>' + chip(bad ? '보완 필요' : '적합') + '</button>' +
        '</div>';
    }

    function matches(k, a) {
        if (!state.q) return true;
        var n = L().normalize(state.q);
        if (!n) return true;
        var hay = [k, a.jo, a.clause || '', a.title, a.text, L().shortRef(k)].join(' ');
        return L().normalize(hay).indexOf(n) >= 0;
    }

    function lawSection() {
        var laws = L().LAWS, arts = L().ARTICLES;
        var byLaw = {};
        Object.keys(arts).forEach(function (k) {
            if (!matches(k, arts[k])) return;
            (byLaw[arts[k].law] = byLaw[arts[k].law] || []).push(k);
        });
        var total = Object.keys(byLaw).reduce(function (s, l) { return s + byLaw[l].length; }, 0);
        var body = Object.keys(laws).map(function (lk) {
            var list = byLaw[lk] || [];
            if (state.q && !list.length) return '';
            var Lw = laws[lk];
            var isOpen = state.q ? true : !!state.open[lk];
            return '<div class="adml-law">' +
                '<button type="button" class="adml-row adml-law-head" onclick="DYADMLAW.toggleLaw(\'' + lk + '\')">' +
                    '<span class="adml-caret">' + (isOpen ? '▾' : '▸') + '</span>' +
                    '<span class="adml-row-main">' + esc(Lw.short) + '</span>' +
                    '<span class="adml-count">' + list.length + '</span>' +
                '</button>' +
                (isOpen ? list.map(function (k) {
                    var a = arts[k];
                    var imp = A().impactOf(k);
                    var on = state.sel.type === 'article' && state.sel.key === k;
                    return '<button type="button" class="adml-row adml-art' + (on ? ' is-on' : '') + '" ' +
                        'onclick="DYADMLAW.sel(\'article\',\'' + k + '\')">' +
                        '<span class="adml-row-main">' + esc(L().shortRef(k)) + ' <span class="adml-art-t">' + esc(a.title) + '</span></span>' +
                        '<span class="adml-ref">참조 ' + imp.total + '</span></button>';
                  }).join('') : '') +
            '</div>';
        }).join('');
        return '<div class="adml-sec">' +
            '<div class="adml-sec-head">법령·조문 <span class="adml-count">' +
                (state.q ? total + ' / ' + Object.keys(arts).length : Object.keys(arts).length) + '</span></div>' +
            (total || !state.q ? body :
              '<div class="adml-empty-note">검색 결과가 없습니다 — <b>' + esc(state.q) + '</b>' +
              '<br><button type="button" class="btn btn-sm btn-outline" onclick="DYADMLAW.search(\'\')">검색 초기화</button></div>') +
        '</div>';
    }

    function unlinkedSection() {
        var rows = A().unlinkedBasis();
        var todo = rows.filter(function (r) { return !r.triage; }).length;
        return '<div class="adml-sec">' +
            '<div class="adml-sec-head">미연계 근거 표기 <span class="adml-count">' + rows.length + '</span></div>' +
            '<button type="button" class="adml-row" onclick="DYADMLAW.sel(\'triage\',\'\')">' +
                '<span class="adml-row-main">업무문서 근거 문자열</span>' +
                chip(todo ? '미판단' : '완료') + '</button>' +
        '</div>';
    }

    /* ── 우측 패널 ── */
    function panel() {
        switch (state.sel.type) {
            case 'article':   return articlePanel(state.sel.key);
            case 'integrity': return integrityPanel();
            case 'triage':    return triagePanel();
            case 'sync':      return syncPanel();
            case 'page':      return pageHintPanel(state.sel.key);
            default:          return introPanel();
        }
    }

    function introPanel() {
        return '<div class="card"><div class="card-body">' +
            '<div class="v2-empty"><div class="v2-empty-title">좌측에서 조문을 선택하세요</div>' +
            '<div class="v2-empty-sub">조문을 고르면 원문과 <b>영향 범위</b>(이 조문을 쓰는 곳)를 함께 봅니다.<br>' +
            '조문을 바꾸기 전에 무엇이 흔들리는지 먼저 확인하기 위한 화면입니다.</div></div>' +
        '</div></div>';
    }

    function articlePanel(k) {
        var a = L().ARTICLES[k];
        if (!a) return introPanel();
        var Lw = L().LAWS[a.law] || {};
        var imp = A().impactOf(k);

        var srcRows = imp.sources.map(function (s) {
            var n = s.n == null ? '—' : s.n + '곳';
            var det = '';
            if ((s.detail || []).length) {
                /* 화면 매핑 소스는 매핑 탭으로 바로 이동할 수 있게 한다 —
                 * "이 조문을 쓰는 화면"에서 그 화면의 매핑 편집까지 두 번 클릭 */
                var items = (s.id === 'map')
                    ? s.detail.slice(0, 6).map(function (pid) {
                        return '<button type="button" class="adml-jump" ' +
                            'onclick="LAWTABS.open(\'map\',\'' + esc(pid) + '\')">' + esc(A().labelOf(pid)) + '</button>';
                      }).join(' · ')
                    : esc(s.detail.slice(0, 6).join(' · '));
                det = '<div class="adml-imp-detail">' + items +
                      (s.detail.length > 6 ? ' 외 ' + (s.detail.length - 6) + '건' : '') + '</div>';
            }
            return '<tr><td>' + esc(s.label) + '</td><td class="adml-imp-n">' + n + '</td>' +
                   '<td>' + esc(s.fix) + det + '</td></tr>';
        }).join('');

        return '<div class="card"><div class="card-header">' +
                '<span class="card-title">' + esc(L().shortRef(k)) + '</span>' +
                '<span class="adml-readonly">읽기 전용</span>' +
            '</div><div class="card-body">' +

            /* 조문 원문 — 편집 컨트롤이 없다 */
            '<div class="lawinfo-inline">' +
                '<div class="lawinfo-ref"><span class="lawinfo-law">' + esc(Lw.name || '') + '</span>' +
                    '<span class="lawinfo-art">' + esc(a.jo) + (a.clause ? ' ' + esc(a.clause) : '') + '</span></div>' +
                '<div class="lawinfo-title">' + esc(a.title) + '</div>' +
                '<div class="lawinfo-text" style="white-space:pre-line;">' + esc(a.text) + '</div>' +
                '<div class="lawinfo-meta">시행 ' + esc(Lw.efYd || '-') + ' · 법령ID ' + esc(Lw.lawId || '-') +
                    ' · 조회 ' + esc(L().SNAPSHOT.fetchedAt) + '</div>' +
            '</div>' +
            '<div class="adml-notice">' +
                '이 본문은 <b>' + esc(L().SNAPSHOT.fetchedAt) + ' 기준 스냅샷</b>이며, 법적 효력은 국가법령정보센터 정본에 있습니다.<br>' +
                '내용이 틀렸다면 여기서 고치지 않고 <b>재수집</b>으로 바로잡습니다 — 요약·의역이 섞이면 "원문"이라는 약속이 깨집니다.' +
            '</div>' +

            /* 영향 범위 */
            '<div class="adml-block-head">이 조문을 쓰는 곳 — 영향 범위</div>' +
            '<div class="adml-tablewrap"><table class="table-figma table-compact">' +
                '<thead><tr><th>소스</th><th>건수</th><th>변경 시 처리</th></tr></thead>' +
                '<tbody>' + srcRows + '</tbody></table></div>' +
            '<div class="adml-imp-sum">' +
                (imp.total === 0
                    ? '화면 매핑 참조 <b>0곳</b> — 다만 <b>미사용이라는 뜻이 아닙니다.</b> 기준규칙 조문은 유해위험요인의 항목 근거로, 주기 조문은 대시보드에서 쓰입니다.'
                    : '합계 참조 <b>' + imp.total + '건</b> — 조문을 바꾸면 이 참조들이 함께 움직입니다.') +
            '</div>' +

            /* 분류 — 편집값이 아니라 조문 성격에서 파생된다. 편집 select 를 두면
             * 소비자 없는 저장값이 생기고(구 축 지정), 매핑 탭의 역할 오표시와
             * 같은 사고가 난다. 검토 대장 원칙(2026-07-30)과 동일. */
            '<div class="adml-block-head">분류 <span class="adml-sub">조문 성격에서 파생됩니다</span></div>' +
            '<div class="adml-formrow">' +
                chip(a.civil ? '시민재해 축' : '산업재해 축') +
                (a.cycle ? ' ' + chip('주기·기준 근거') : '') +
                '<span class="adml-hint">중처법 양축 점검용 — 축 누락(시민재해 축 통째 누락)이 실제 감사에서 나온 결함 유형입니다</span>' +
            '</div>' +
            '<div class="adml-hint" style="margin-top:8px;">' +
                '이 화면에 조문 <b>삭제·보관 조작은 없습니다</b> — 조문키는 저장 스키마라 지우면 참조가 조용히 끊기고, ' +
                '수록 목록의 변경(제외 포함)도 조문 본문과 같은 경로(재수집·재생성)로만 합니다. ' +
                '화면 매핑이 없는 조문도 항목 근거·주기 근거로 쓰이므로 수록을 유지합니다.' +
            '</div>' +
        '</div></div>';
    }

    function integrityPanel() {
        var rows = A().integrity().map(function (c) {
            return '<tr>' +
                '<td>' + esc(c.label) + '</td>' +
                '<td>' + (c.n ? chip(c.severity === 'danger' ? '기한초과' : '보완 필요') : chip('적합')) + ' ' + c.n + '건</td>' +
                '<td>' + esc(c.note) + (c.n ? '<div class="adml-imp-detail">' + esc(c.detail.slice(0, 8).join(' · ')) + '</div>' : '') + '</td>' +
            '</tr>';
        }).join('');
        return '<div class="card"><div class="card-header"><span class="card-title">무결성 검사</span></div><div class="card-body">' +
            '<p class="adml-lead">감지 없는 정합은 유지되지 않습니다. 6종을 상시 검사합니다.</p>' +
            '<div class="adml-tablewrap"><table class="table-figma table-compact">' +
            '<thead><tr><th>검사</th><th>결과</th><th>의미</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
            '<div class="adml-notice">이 검사들이 통과해도 <b>조문 번호는 맞는데 내용이 다른 오배정</b>은 잡히지 않습니다. ' +
            '그 종류는 전수 대조로만 발견됩니다 — 실제로 그렇게 발견된 결함이 있습니다.</div>' +
        '</div></div>';
    }

    function triagePanel() {
        var rows = A().unlinkedBasis();
        var body = rows.map(function (r, i) {
            return '<tr>' +
                '<td><div class="adml-tri-text">' + esc(r.text) + '</div>' +
                    '<div class="adml-imp-detail">업무문서 ' + r.n + '건에서 사용</div></td>' +
                '<td>' + (r.resolved ? chip('근거 있음') : chip('법령 매핑 대기')) + '</td>' +
                '<td><select class="form-select" onchange="DYADMLAW.triage(' + i + ',this.value)">' +
                    '<option value="">-- 분류 --</option>' +
                    A().TRIAGE.map(function (t) {
                        return '<option value="' + t.id + '"' + (r.triage === t.id ? ' selected' : '') + '>' + esc(t.label) + '</option>';
                    }).join('') +
                '</select></td>' +
            '</tr>';
        }).join('');
        var todo = rows.filter(function (r) { return !r.triage; }).length;
        return '<div class="card"><div class="card-header"><span class="card-title">미연계 근거 표기</span></div><div class="card-body">' +
            '<p class="adml-lead">업무문서 <b>' + rows.reduce(function (s, r) { return s + r.n; }, 0) + '건</b>이 근거 문자열을 들고 있으나 ' +
            '수록 조문으로 <b>해석되지 않습니다</b>(고유 ' + rows.length + '종 · 미분류 ' + todo + '종). ' +
            '이 화면의 가장 큰 실제 일감입니다.</p>' +
            '<div class="adml-tablewrap"><table class="table-figma table-compact">' +
            '<thead><tr><th>근거 표기</th><th>해석</th><th>분류</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
        '</div></div>';
    }

    function syncPanel() {
        var st = A().stageLoad();
        if (!st) {
            return '<div class="card"><div class="card-body"><div class="v2-empty">' +
                '<div class="v2-empty-title">수집 결과가 없습니다</div>' +
                '<div class="v2-empty-sub">[수집 요청 등록]을 누르면 배치가 받아온 결과를 검토하는 흐름을 시연합니다.</div>' +
            '</div></div></div>';
        }
        var rows = st.rows.map(function (r, i) {
            var act = r.kind === '변경 없음' ? '<span class="adml-hint">조치 불필요</span>'
                : r.kind === '수집 실패' ? '<span class="adml-hint">다음 배치에서 재시도</span>'
                : (r.decision
                    ? chip(r.decision)
                    : '<button type="button" class="btn btn-sm btn-primary" onclick="DYADMLAW.decide(' + i + ',\'승인\')">승인</button> ' +
                      '<button type="button" class="btn btn-sm btn-outline" onclick="DYADMLAW.decide(' + i + ',\'보류\')">보류</button>');
            return '<tr>' +
                '<td><b>' + esc(r.ref) + '</b><div class="adml-imp-detail">' + esc(r.title) + '</div></td>' +
                '<td>' + chip(r.kind) + '</td>' +
                '<td><div class="adml-diff"><span class="adml-diff-b">' + esc(r.before) + '</span>' +
                    '<span class="adml-diff-a">' + esc(r.after) + '</span></div>' +
                    '<div class="adml-imp-detail">' + esc(r.detail) + '</div>' +
                    (r.impact.length ? '<div class="adml-imp-detail">영향 화면 ' + r.impact.length + ' — ' + esc(r.impact.join(', ')) + '</div>' : '') +
                '</td>' +
                '<td>' + act + '</td>' +
            '</tr>';
        }).join('');
        return '<div class="card"><div class="card-header"><span class="card-title">수집 결과 검토</span>' +
            '<span class="adml-readonly">시뮬레이션</span></div><div class="card-body">' +
            '<div class="adml-notice"><b>실제 법제처 API 를 호출하지 않았습니다.</b> ' +
            '방화벽 명세가 "배치 서버 단독 아웃바운드"이므로 화면이 외부를 직접 부르면 보안 심의에 제출한 명세와 어긋납니다. ' +
            '화면의 역할은 조회가 아니라 <b>검토·승인</b>입니다. (배치 기준 ' + esc((global.DYLAWSYNC || {}).batchAt || '-') + ')</div>' +
            '<div class="adml-tablewrap"><table class="table-figma table-compact">' +
            '<thead><tr><th>조문</th><th>변화</th><th>내용</th><th>처리</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
            '<div class="adml-notice">승인해도 <b>이 프로토타입은 조문 원문을 바꾸지 않습니다</b> — 실제 반영은 law-map.js 재생성(배치)이 합니다. ' +
            '여기서는 결정을 이력에 남기고 내보내기로 전달합니다.</div>' +
        '</div></div>';
    }

    function pageHintPanel(pid) {
        return '<div class="card"><div class="card-body">' +
            '<div class="v2-empty"><div class="v2-empty-title">' + esc(A().labelOf(pid)) + ' — 매핑 재검증 필요</div>' +
            '<div class="v2-empty-sub">검증 당시와 조문 제목이 달라졌습니다. 매핑 편집은 <b>메뉴 근거 매핑</b> 탭에서 합니다.<br><br>' +
            '<button type="button" class="btn btn-primary btn-sm" onclick="LAWTABS.open(\'map\',\'' + esc(pid) + '\')">메뉴 근거 매핑 탭으로 이동</button></div></div>' +
        '</div></div>';
    }

    /* ── 이력 ── */
    function historyCard() {
        var rows = A().logs();
        var body = rows.length
            ? rows.slice(0, 30).map(function (r) {
                return '<tr><td>' + esc(r.at) + '</td><td>' + esc(r.layer) + '</td><td>' + esc(r.target) + '</td>' +
                    '<td>' + esc(r.action) + '</td>' +
                    '<td><div class="adml-diff"><span class="adml-diff-b">' + esc(r.before || '-') + '</span>' +
                        '<span class="adml-diff-a">' + esc(r.after || '-') + '</span></div></td>' +
                    '<td>' + esc(r.by) + '</td></tr>';
              }).join('')
            : '<tr><td colspan="6" class="adml-empty-cell">변경 이력이 없습니다.</td></tr>';
        return '<div class="card" style="margin-top:16px;">' +
            '<div class="card-header"><span class="card-title">변경 이력</span>' +
            '<span class="adml-hint">전·후 값을 함께 남깁니다 — 없으면 되돌리기도 소명도 불가능합니다</span></div>' +
            '<div class="card-body"><div class="adml-tablewrap"><table class="table-figma table-compact">' +
            '<thead><tr><th>일시</th><th>층위</th><th>대상</th><th>행위</th><th>변경 전 → 후</th><th>처리자</th></tr></thead>' +
            '<tbody>' + body + '</tbody></table></div>' +
            (rows.length >= 200 ? '<div class="adml-notice">보관 상한 200건에 도달해 오래된 이력이 삭제되었습니다. 실 개발은 무절삭 보존입니다.</div>' : '') +
        '</div></div>';
    }

    /* =============== 액션 =============== */
    function sel(type, key) {
        /* 재검토 요청 큐 항목은 매핑 탭의 해당 화면으로 바로 보낸다 */
        if (type === 'review') { global.LAWTABS.open('map', key); return; }
        state.sel = { type: type, key: key };
        render();
        /* lg 미만에서는 2단이 세로로 쌓여 상세 패널이 트리 아래(뷰포트 밖)다 —
         * 스크롤해 주지 않으면 선택이 "안 되는 것처럼" 보인다.
         * (rAF — innerHTML 교체 직후의 동기 smooth 스크롤은 취소된다) */
        if (V().below('lg')) {
            requestAnimationFrame(function () {
                var p = state.mount && state.mount.querySelector('.admp-panel');
                if (p) p.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
    }
    function toggleLaw(lk) { state.open[lk] = !state.open[lk]; render(); }
    function search(v) {
        state.q = v;
        /* 카드째 다시 그리면 한글 조합 중 캐럿이 날아간다 — 목록만 교체하고 포커스를 되돌린다 */
        var host = state.mount.querySelector('.admm-tree-body');
        if (host) {
            host.innerHTML = queueSection() + integritySection() + lawSection() + unlinkedSection();
            var inp = document.getElementById('adml-q');
            if (inp && document.activeElement !== inp) { inp.value = v; }
        } else render();
    }
    /* 축 지정(setAxis)·보관(archive)은 2026-07-30 제거 — 저장값을 읽는 소비자가
     * 없었고, 축은 조문 성격에서 파생된다(ARTICLES[].civil). 수록 목록 변경은
     * 재수집(재생성)으로만 한다. */
    function triage(i, verdict) {
        var rows = A().unlinkedBasis();
        var r = rows[i]; if (!r) return;
        A().setTriage(r.text, verdict, '');
        toast('분류했습니다.'); render();
    }
    function sync() {
        if (!A().stageLoad()) {
            A().runSync();
            toast('수집 요청을 등록했습니다 — 프로토타입은 실제 API 를 호출하지 않습니다.');
        }
        sel('sync', '');
    }
    function decide(i, d) {
        var st = A().stageDecide(i, d);
        if (!st) return;
        var r = st.rows[i];
        A().log({ layer: '수집', target: r.ref, action: d, before: r.before, after: r.after,
                  impact: r.impact.length ? '영향 화면 ' + r.impact.length : '' });
        toast(d === '승인' ? '승인했습니다 — 실제 반영은 배치 재생성이 합니다.' : '보류했습니다.');
        render();
    }
    function exportOpen() {
        V().openModal('내보내기 — law-map.js 재생성 입력',
            '<p style="font-size:12px;color:var(--text-gray);margin-bottom:8px;">' +
            '이 내용을 개발에 전달하면 law-map.js 재생성에 반영됩니다. <b>조문 원문은 포함하지 않습니다</b>(법제처 수집분).</p>' +
            '<textarea class="form-textarea" rows="14" readonly style="font-family:monospace;font-size:var(--fs-12);">' +
                esc(A().exportJson()) + '</textarea>',
            '<button type="button" class="btn btn-primary" onclick="DYV2.closeModal()">닫기</button>');
    }
    function resetDemo() {
        var d = A().load();
        var rv = Object.keys(d.reviewReq || {}).length;
        V().openModal('데모 데이터 초기화',
            '<p style="font-size:13px;line-height:1.7;">아래가 삭제됩니다.</p>' +
            '<ul style="font-size:13px;line-height:1.9;margin-left:18px;">' +
                '<li>재검토 요청 <b>' + rv + '건</b></li>' +
                '<li>변경 이력 <b>' + d.log.length + '건</b></li>' +
                '<li>화면에서 남긴 조문 운영 판단·표기 분류 변경</li>' +
            '</ul>' +
            '<p style="font-size:12px;color:var(--text-gray);margin-top:10px;">빈 상태가 아니라 <b>2026-07-30 전수 검토 시드</b>로 되돌아갑니다 — ' +
            '검증 기록 74건·판정 사유·표기 분류가 초기값입니다. 조문 원문·매핑은 영향받지 않습니다.</p>',
            '<button type="button" class="btn btn-secondary" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="DYADMLAW.doReset()">초기화</button>');
    }
    function doReset() { A().reset(); V().closeModal(); toast('초기화했습니다.'); render(); }

    function init(mountId) {
        state.mount = document.getElementById(mountId);
        if (!state.mount) return;
        render();
    }

    global.DYADMLAW = {
        init: init, sel: sel, toggleLaw: toggleLaw, search: search,
        triage: triage, sync: sync, decide: decide,
        exportOpen: exportOpen, resetDemo: resetDemo, doReset: doReset
    };

    /* =============== 탭 셸 (전역 LAWTABS) ===================================
     *  법령·조문 / 메뉴 근거 매핑 / 변경 이력 3탭. 각 탭 본체는 기존 모듈
     *  (DYADMLAW · DYADMLAWMAP)을 그대로 쓰고, 셸은 전환·지연 초기화·딥링크만
     *  담당한다. 딥링크: admin-law.html?tab=map&page=rsk-list
     * ======================================================================= */
    var TABS = [
        { id: 'articles', label: '법령·조문' },
        { id: 'map', label: '메뉴 근거 매핑' },
        { id: 'history', label: '변경 이력' }
    ];
    var tabState = { host: null, current: '', inited: {} };

    function tabBar() {
        return '<div class="sub-tabs" role="tablist" aria-label="법령 관리 탭">' +
            TABS.map(function (t) {
                var on = tabState.current === t.id;
                return '<button type="button" class="sub-tab' + (on ? ' active' : '') + '" role="tab" ' +
                    'aria-selected="' + (on ? 'true' : 'false') + '" ' +
                    'onclick="LAWTABS.open(\'' + t.id + '\')">' + esc(t.label) + '</button>';
            }).join('') +
        '</div>';
    }

    function tabInit(mountId) {
        tabState.host = document.getElementById(mountId);
        if (!tabState.host) return;
        tabState.host.innerHTML =
            '<div id="lawtabs-bar" style="margin-bottom:16px;"></div>' +
            '<div id="lawtab-articles" role="tabpanel" aria-label="법령·조문"></div>' +
            '<div id="lawtab-map" role="tabpanel" aria-label="메뉴 근거 매핑" hidden></div>' +
            '<div id="lawtab-history" role="tabpanel" aria-label="변경 이력" hidden></div>';
        var p = new URLSearchParams(location.search);
        var t = p.get('tab');
        tabOpen((t === 'map' || t === 'history') ? t : 'articles', p.get('page') || '');
    }

    function tabOpen(id, pageId) {
        var M = global.DYADMLAWMAP;
        /* 매핑 탭은 검토 대장(읽기 전용)이라 미저장 변경이 없다 — 전환 가드 불필요 */
        tabState.current = id;
        var bar = document.getElementById('lawtabs-bar');
        if (bar) bar.innerHTML = tabBar();
        TABS.forEach(function (t) {
            var pane = document.getElementById('lawtab-' + t.id);
            if (pane) pane.hidden = t.id !== id;
        });

        if (id === 'articles' && !tabState.inited.articles) {
            tabState.inited.articles = true;
            init('lawtab-articles');
        }
        if (id === 'map' && M) {
            if (!tabState.inited.map) { tabState.inited.map = true; M.init('lawtab-map'); }
            if (pageId) M.sel(pageId);
        }
        /* 이력은 열 때마다 새로 그린다 — 두 탭의 조작이 그 사이 쌓였을 수 있다 */
        if (id === 'history') {
            var h = document.getElementById('lawtab-history');
            if (h) h.innerHTML = historyCard();
        }

        /* URL 동기화 — 새로고침·공유해도 같은 탭이 열린다 */
        try {
            var u = new URL(location.href);
            u.searchParams.set('tab', id);
            if (pageId) u.searchParams.set('page', pageId);
            else u.searchParams.delete('page');
            history.replaceState(null, '', u.toString());
        } catch (e) {}
    }

    /* 매핑 탭 등에서 조문 원문으로 점프 — 검증 6문 #1(원문을 실제로 열어봤나) */
    function tabOpenArticle(key) {
        tabOpen('articles');
        sel('article', key);
    }

    global.LAWTABS = { init: tabInit, open: tabOpen, openArticle: tabOpenArticle };
})(window);
