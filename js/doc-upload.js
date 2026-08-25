/* =========================================================================
 * 업무 업로드 마법사 + 전년도 프리셋 (전역 DOCUP)
 *   기획: docs/planning/기획-업무문서-이행목록-업무목록-UX설계-v1.md §8 (UF-02·05·06)
 *
 *   [단일 모달 불변식] 모달 위에 모달을 띄우지 않는다(CLAUDE.md §1).
 *   STEP 전환·프리셋 선택·단계 다중선택 모두 **같은 모달 본문을 교체**한다.
 *
 *   [순서를 뒤집지 말 것] STEP1 문서·파일 → STEP2 업무단계 선택 → STEP3 확인·저장.
 *   저장 직후 선택한 단계는 반드시 **진행중**이고, 담당자에게 완료 처리 수단이 없다.
 *   완료는 주관부서 담당자가 이행 목록의 [증빙 확인]에서만 준다(D-01).
 * ========================================================================= */
(function (global) {
    'use strict';

    var V = function () { return global.DYV2; };
    var D = function () { return global.DYDOCS; };
    var F = function () { return global.EDUFILTER; };
    function esc(s) { return V().esc(String(s == null ? '' : s)); }

    /* ── 마법사 상태 ─────────────────────────────────────────────────────── */
    var W = null;
    /* 보고일자 기본값 — 기준연도가 올해가 아니면 오늘 날짜를 쓸 수 없다.
       2025년 화면에서 업로드를 열었는데 보고일이 2026-07-16 으로 채워지면
       저장되는 순간 연도와 날짜가 어긋난 문서가 된다(실제로 냈던 결함). */
    /* 보고일자는 **비워서 시작한다.**
       공문의 보고일자는 대개 오늘이 아니다 — 며칠 전 문서를 올린다. 오늘로 채워
       두면 안 보고 지나가 **틀린 날짜가 저장**된다. 같은 폼의 방향 세그먼트가
       «기본 선택을 두지 않는다»(안 보고 지나간다)를 지키는데 날짜만 채워 두면
       한 폼 안에서 원칙이 갈린다. 문서명은 파일명이라는 **근거**가 있어 채우지만
       날짜는 근거가 없다. */
    function defaultDate() { return ''; }
    function blankW(year) {
        year = year || D().defaultYear();
        var mine = me();
        return {
            step: 1, year: year,
            files: [],
            title: '', date: defaultDate(), sr: '', dir: '',
            /* 담당은 **본인으로 미리 채운다** — 대부분 올리는 사람이 담당자다.
               시스템이 로그인 정보를 알면서 비워 두면 조직도를 세 번 눌러야 한다.
               이 저장소에 이미 «내가 맡기»(§14-7) 선례가 있다. 날짜와 달리 근거가
               있는 기본값이고, 한 번 눌러 바꿀 수 있다. */
            dept: (mine.dept || ''), assignee: (mine.name || ''), assigneeUid: (mine.uid || ''),
            src: 'upload', note: '',
            dupWith: null,          /* 중복 후보 문서 id */
            dupMode: '',            /* 'append' 기존 문서에 파일 추가 | 'new' 새 문서 */
            stageIds: [],
            err: '', fieldErr: {},  /* 배너 + **필드 단위** 오류 (aria-invalid 연결) */
        };
    }

    /* ── 프리셋 상태 ─────────────────────────────────────────────────────── */
    var P = null;
    /* 원본연도 → 대상연도는 **기준연도에서 파생**한다. BASE_YEAR→DEFAULT_YEAR 로
       고정하면 2025년 화면에서 "2025년 것을 2026년으로" 라는 엉뚱한 안내가 나온다. */
    function blankP(toYear) {
        var to = toYear || (W ? W.year : D().defaultYear());
        return {
            from: D().presetSourceYear(to) || (to - 1), to: to,
            q: '', item: '', cycle: '', sr: '', month: '',
            page: 1, size: 20,
            sel: {},                /* docId → {titleMode, title, dept, assignee, files:{fileKey:'keep'|'replace'}} */
            onlySel: false,
            bulk: { titleMode: 'year', dept: '', assignee: '', fileMode: 'keep' },
            expand: {},             /* docId → 개별 설정 펼침 */
            err: '',
        };
    }

    /* =========================================================================
     * 공통 — 입력값 보존 (재렌더 전에 반드시 부른다)
     * ========================================================================= */
    function val(id) { var el = document.getElementById(id); return el ? el.value : null; }
    function captureStep1() {
        if (!W) return;
        var m = { 'du-title': 'title', 'du-date': 'date', 'du-sr': 'sr', 'du-note': 'note' };
        Object.keys(m).forEach(function (id) { var v = val(id); if (v != null) W[m[id]] = v; });
        /* 출처(src)는 더 이상 묻지 않는다 — 아래 dirField() 주석 참고. 사람이 파일을
           올리는 경로는 정의상 '직접 첨부'이고, 그래야 신규 문서의 상태가 항상
           '검토대기'가 되어 «완료는 주관부서 확인 뒤에만»(§5)과 맞는다. */
        W.src = 'upload';
    }

    /* =========================================================================
     * 진입
     * ========================================================================= */
    /* opts.stageIds — 업무단계 프리필(선택). 이행 상세·누락 점검처럼 **이미 어느
     * 할 일인지 아는 화면**에서 들어오면 STEP2 에서 168개를 다시 찾게 하지 않는다.
     * 인자 없는 기존 호출(docs-exec·docs-preset)은 그대로 동작한다(추가 전용). */
    function open(year, opts) {
        if (!D().canUpload()) { V().toast(denyNote()); return; }
        W = blankW(year);
        if (opts && opts.stageIds) {
            W.stageIds = opts.stageIds.filter(function (id) { return !!D().stage(id); });
        }
        /* 프리필은 사용자가 쓴 것이 아니다 — 이 기준선과 같으면 닫을 때 '작성 중인
           내용이 사라집니다'를 묻지 않는다(빈 마법사를 닫는데 확인이 뜨면 소음이다) */
        W._prefill = W.stageIds.join(',');
        global.DYPICK.reset('');
        armGuard();
        renderW();
    }
    /* 닫는 길이 넷(취소·X·백드롭·Esc)인데 확인이 하나에만 있으면 확인이 아니다.
       가드를 걸어 두면 어느 길로 닫아도 같은 확인을 받는다(DYV2.setModalGuard). */
    function armGuard() {
        V().setModalGuard(function () {
            if (!dirty()) return true;
            return global.confirm('작성 중인 내용이 사라집니다. 닫을까요?');
        });
    }
    function dirty() {
        if (W) {
            captureStep1();
            return !!(W.files.length || String(W.title).trim() ||
                W.stageIds.join(',') !== (W._prefill || ''));
        }
        if (P) return Object.keys(P.sel).length > 0;
        return false;
    }
    function denyNote() {
        var R = global.DYROLE;
        if (R && R.readOnlyNote) {
            var n = R.readOnlyNote('업무 업로드');
            if (n) return '조회 전용 — 업무 업로드는 부서 담당자가 수행합니다.';
        }
        return '업무 업로드 권한이 없습니다.';
    }

    /* =========================================================================
     * 마법사 렌더
     * ========================================================================= */
    function renderW() {
        var title = '서류 올리기 · ' + W.year + '년 <span class="du-step">' + W.step + '단계 / 3</span>';
        var body, foot;
        if (W.step === 1) { body = step1(); foot = foot1(); }
        else if (W.step === 2) { body = step2(); foot = foot2(); }
        else { body = step3(); foot = foot3(); }
        V().openModal(title, '<div class="du-wrap">' + stepBar() + errBox(W.err) + body + '</div>', foot);
    }
    function stepBar() {
        var names = ['서류 올리기', '무슨 일인지 고르기', '확인'];
        return '<ol class="du-steps">' + names.map(function (n, i) {
            var k = i + 1;
            return '<li class="' + (k === W.step ? 'is-on' : (k < W.step ? 'is-done' : '')) + '">' +
                '<span class="du-step-n">' + k + '</span>' + esc(n) + '</li>';
        }).join('') + '</ol>';
    }
    function errBox(msg) {
        return msg ? '<div class="du-err form-field-error" role="alert">' + esc(msg) + '</div>' : '';
    }

    /* 시작 갈래 — «새로 올리기»와 «작년 것 가져오기»는 진입 시점의 선택이지
       입력을 마친 뒤의 선택이 아니다. 파일을 이미 골랐으면 내지 않는다(그때는
       이미 «새로 올리기»를 택한 것이고, 남겨 두면 소음이다). */
    function startPaths() {
        if (W.files.length || !prevYear()) return '';
        return '<div class="du-start">' +
            /* 한 줄에 들어가야 한다 — 접히면 상단이 두 배가 되어 «시작 시점에
               보인다»는 이득을 밀도로 도로 내준다(모달 폭 452px 실측). */
            '<span class="du-start-t">작년 것을 그대로 쓸 수 있습니다</span>' +
            '<button type="button" class="btn btn-outline btn-sm" onclick="DOCUP.openPreset()">' +
                prevYear() + '년 문서 가져오기</button>' +
        '</div>';
    }

    /* ── STEP 1 ── */
    function step1() {
        var dup = W.dupWith ? D().docById(W.dupWith) : null;
        return '<div class="form-section">' +
            /* ① 대안 경로는 **시작 시점**에 낸다. 종전에는 폼 맨 아래(921px)에 있어
                  스크롤해야 보였고, 다 채운 뒤에 알면 입력한 것을 버려야 했다. */
            startPaths() +
            /* ⑤ 첨부는 필수인데 종전에는 * 표시가 없었다 — 나머지 네 필드에는 있고
                  유효성은 파일을 막는다. 라벨을 밖으로 빼 표시를 붙인다. */
            '<label class="form-label" for="du-drop">증빙 파일 <span class="du-req">*</span></label>' +
            V().uploadDrop('서류 파일을 끌어다 놓거나 눌러서 고르세요', null,
                { pick: 'DOCUP.addFiles', multiple: true, hint: true }) +
            fileList() +
            '<div class="du-grid">' +
                field('문서명', true, 'du-title',
                    '<input type="text" class="form-input" id="du-title" value="' + esc(W.title) + '" ' +
                    inv('du-title') + ' oninput="DOCUP.onTitle(this.value)" placeholder="첫 파일명에서 자동으로 채워집니다">') +
                field('보고일자', true, 'du-date',
                    '<input type="date" class="form-input" id="du-date" value="' + esc(W.date) + '" ' + inv('du-date') +
                    ' min="' + W.year + '-01-01" max="' + W.year + '-12-31">',
                    W.year + '년 업무이므로 ' + W.year + '년 안의 날짜만 받습니다') +
            '</div>' +
            dirField() +
            ownerField() +
            field('비고', false, 'du-note', '<textarea class="form-input" id="du-note" rows="2">' + esc(W.note) + '</textarea>') +
            (dup ? dupBox(dup) : '') +
        '</div>';
    }
    /* 프리셋의 원본연도는 '기준연도 직전 연도'다 — 2025 로 하드코딩하면 2025년
       화면에서 "2025년 문서에서 가져오기"라는 말이 안 되는 안내가 나온다. */
    function prevYear() { return D().presetSourceYear(W ? W.year : D().defaultYear()); }

    /* =========================================================================
     * 이 문서가 어떻게 오간 건가 — 방향을 먼저 묻고 상대 기관을 뒤에 붙인다
     * -------------------------------------------------------------------------
     * [왜 두 칸을 하나로 합쳤나] 종전에는 «상대 기관»과 «어디서 온 서류인가요»가
     * 나란히 있었다. 앞은 기관을, 뒤는 시스템 경로(온나라·전자문서·직접 첨부)를
     * 묻는데 **같은 질문처럼 읽혀** 담당자가 «어디서 온»에 기관을 적으려 했다.
     *
     * [출처(src)를 왜 뺐나] 두 가지가 근거다.
     *   ① 그 축은 원자료에 없다 — 원장 3,830건의 출처가 온나라 1,288 / 직접첨부
     *      1,263 / 전자문서 1,279 로 거의 정확히 3등분인데, 이는 문서 ID 해시로
     *      배정한 시연 보강값이다(doc-history-data.js 헤더).
     *   ② 사람이 파일을 끌어다 놓는 경로는 정의상 «직접 첨부»다. 온나라·전자문서는
     *      연계로 들어오는 경로이지 고르는 값이 아니다. 담당자가 «온나라»를 고르면
     *      상태가 «결재중»이 되는데(SRC[].status[0]) 실제 결재 여부를 시스템은
     *      모른다. upload 로 고정하면 상태가 «검토대기»가 되어 «완료는 주관부서
     *      확인 뒤에만»(§5)과 정확히 맞는다.
     *
     * [왜 필수인가] 모든 문서는 받았거나 보냈거나 내부에서 끝난 것 셋 중 하나다 —
     * 판단할 수 없는 경우가 없다. 기본 선택을 두지 않는 것은 «해당없음으로 빠져
     * 나가기»를 막는 §4-2 와 같은 근거다(기본값이 있으면 안 보고 지나간다).
     *
     * [세그먼트 클래스] 이 저장소의 세그먼트 컨트롤은 .cmp-seg 하나뿐이라 그것을
     * 쓴다. 접두어가 도메인을 가리킨다고 새 계열을 파지 않는다 — §7-1 이 기록한
     * 사고(rskdoc- 를 «위험성평가 전용»으로 읽고 새 이름을 지어 12개 클래스가
     * 무스타일로 떴다)의 교훈이 그것이다.
     * ========================================================================= */
    function dirField() {
        var cur = W.dir;
        var seg = '<div class="cmp-seg" role="radiogroup" aria-label="문서가 오간 방향"' +
            (W.fieldErr['du-dir'] ? ' aria-describedby="du-dir-e"' : '') + '>' +
            D().DIR_ORDER.map(function (k) {
                var m = D().DIR[k], on = cur === k;
                return '<button type="button" class="cmp-seg-btn' + (on ? ' is-on' : '') + '"' +
                    ' role="radio" aria-checked="' + (on ? 'true' : 'false') + '"' +
                    ' onclick="DOCUP.setDir(\'' + k + '\')">' + esc(m.label) + '</button>';
            }).join('') + '</div>';
        var help = cur ? D().DIR[cur].help : '받은 문서 · 보낸 문서 · 내부 문서 중 하나를 고르세요';

        /* `du-dir-f` 를 달고 있었으나 CSS 규칙도 JS 선택자 참조도 없었다 —
           포커스 이동은 `id="du-dir"` 가 담당하므로 클래스는 쓰임이 없다. */
        var out = '<div class="form-field' + (W.fieldErr['du-dir'] ? ' has-err' : '') + '" id="du-dir">' +
            '<label class="form-label">이 문서는 어떻게 오간 건가요 <span class="du-req">*</span></label>' +
            seg +
            (W.fieldErr['du-dir']
                ? '<p class="form-field-error" id="du-dir-e">' + esc(W.fieldErr['du-dir']) + '</p>'
                : '<p class="form-field-help">' + esc(help) + '</p>') +
        '</div>';

        /* 내부 문서는 상대 기관 칸 자체가 없다 — 있으면 «노, 로, 도» 같은 값이
           다시 생긴다(원장 94건이 그렇게 만들어졌다). */
        /* ③ 상대 기관은 «방향»의 결과이므로 **같은 덩어리 안에** 둔다.
              고르면 아래 필드가 122px 밀리는데, 그것을 없앨 수는 없다(progressive
              disclosure 의 정상 동작이다). 대신 두 칸을 한 테두리로 묶어 **방금 누른
              질문의 결과**임이 보이게 한다 — 사용자가 «왜 화면이 움직였나»가 아니라
              «다음 칸이 열렸구나»로 읽는다. */
        if (cur === 'internal') {
            return wrapDir(out + '<p class="du-dir-note">담양군 안에서 만들고 끝난 문서라 상대 기관은 받지 않습니다.</p>');
        }
        if (!cur) return wrapDir(out);
        return wrapDir(out + field('상대 기관', true, 'du-sr',
            '<input type="text" class="form-input" id="du-sr" value="' + esc(W.sr) + '" ' + inv('du-sr') +
            ' placeholder="' + (cur === 'in' ? '예: 전라남도 자연재난과' : '예: 전라남도지사(사회재난과장)') + '">',
            cur === 'in' ? '이 문서를 보낸 기관·부서입니다' : '이 문서를 받은 기관·부서입니다'));
    }
    function wrapDir(inner) { return '<div class="du-dirblock">' + inner + '</div>'; }
    function setDir(k) {
        if (!W || !D().DIR[k]) return;
        captureStep1();
        W.dir = k;
        /* 내부로 바꾸면 적어 두었던 상대 기관을 비운다 — 남겨 두면 화면에는 없는
           값이 저장돼 «내부 문서인데 상대 기관이 있다»가 된다. */
        if (k === 'internal') W.sr = '';
        delete W.fieldErr['du-dir']; delete W.fieldErr['du-sr'];
        renderW();
    }

    /* 담당부서·담당자 — 공용 인라인 조직도로만 받는다(CLAUDE.md §3).
     * rootId 로 **고를 수 있는 범위 자체를 좁힌다** — 조회 범위 밖 사람 이름을
     * 목록에 띄우는 것 자체가 위반이다(§14-7 assignCandidates 선례).
     * uid 로 저장해 동명이인·개명에 견딘다. 판정은 저장 계층이 다시 한다. */
    function ownerField() {
        var root = D().ownerRootId();
        var scopeNote = root
            ? '소속 부서 담당자만 지정할 수 있습니다'
            : '주관부서 담당자는 전 부서를 지정할 수 있습니다';
        return '<div class="form-field du-owner' + (W.fieldErr['du-org'] ? ' has-err' : '') + '">' +
            '<label class="form-label" id="du-org-l">담당부서 · 담당자 <span class="du-req">*</span></label>' +
            '<div class="orgpick-field" id="du-org">' +
                '<button type="button" class="form-input du-orgbtn" aria-labelledby="du-org-l"' +
                    (W.fieldErr['du-org'] ? ' aria-invalid="true" aria-describedby="du-org-e"' : '') +
                    ' onclick="ORGPICK.toggle(\'du-org\',\'memberUid\',\'DOCUP.pickOwner\'' +
                        (root ? ', {rootId:\'' + esc(root) + '\'}' : '') + ')">' +
                    (W.assignee ? esc(W.dept + ' / ' + W.assignee) : '<span class="du-ph">조직도에서 선택</span>') +
                '</button>' +
            '</div>' +
            (W.fieldErr['du-org']
                ? '<p class="form-field-error" id="du-org-e">' + esc(W.fieldErr['du-org']) + '</p>'
                : '<p class="form-field-help">' + esc(scopeNote) + '</p>') +
        '</div>';
    }
    /* 필드 단위 오류 — 배너만 띄우면 어느 칸이 문제인지 알 수 없다 */
    function inv(id) {
        return W.fieldErr[id] ? 'aria-invalid="true" aria-describedby="' + id + '-e"' : '';
    }
    function field(label, req, id, inner, help) {
        return '<div class="form-field' + (W.fieldErr[id] ? ' has-err' : '') + '">' +
            '<label class="form-label" for="' + id + '">' + esc(label) +
            (req ? ' <span class="du-req">*</span>' : '') + '</label>' + inner +
            (W.fieldErr[id] ? '<p class="form-field-error" id="' + id + '-e">' + esc(W.fieldErr[id]) + '</p>'
                : (help ? '<p class="form-field-help">' + esc(help) + '</p>' : '')) +
        '</div>';
    }
    function fileList() {
        if (!W.files.length) return '';
        return '<ul class="du-files">' + W.files.map(function (f, i) {
            return '<li><span class="du-fname">' + esc(f.name) + '</span>' +
                '<span class="du-fsize">' + kb(f.size) + '</span>' +
                '<button type="button" class="du-fdel" aria-label="' + esc(f.name) + ' 제거" onclick="DOCUP.delFile(' + i + ')">×</button></li>';
        }).join('') + '</ul>';
    }
    function kb(n) { return n ? Math.max(1, Math.round(n / 1024)) + ' KB' : '—'; }

    /* 중복은 차단하지 않고 선택지를 준다 — 같은 제목이 다른 날짜로 반복되는 자료다 */
    function dupBox(d) {
        return '<div class="du-dup" role="alert">' +
            '<b>같은 제목·수발신자·보고일자의 문서가 이미 있습니다.</b>' +
            '<p class="du-dup-t">' + esc(d.title) + ' <span class="du-dim">' + esc(d.date) + (d.sr ? ' · ' + esc(d.sr) : '') + '</span></p>' +
            '<div class="du-dup-act">' +
                '<label><input type="radio" name="du-dup" value="append"' + (W.dupMode === 'append' ? ' checked' : '') +
                    ' onchange="DOCUP.setDup(\'append\')"> 기존 문서에 파일을 추가한다</label>' +
                '<label><input type="radio" name="du-dup" value="new"' + (W.dupMode === 'new' ? ' checked' : '') +
                    ' onchange="DOCUP.setDup(\'new\')"> 다른 문서다 — 새로 만든다</label>' +
            '</div>' +
        '</div>';
    }
    function foot1() {
        return '<button class="btn btn-outline" onclick="DOCUP.cancel()">취소</button>' +
            '<button class="btn btn-primary" onclick="DOCUP.next()">다음 — 무슨 일인지 고르기 →</button>';
    }

    /* ── STEP 2 — 할 일 고르기 ─────────────────────────────────────────
     * 78개 아코디언을 펼쳤다 접었다 하면 원하는 것을 만나기까지 계속 굴려야 한다.
     * 채용 사이트의 직무 선택과 같은 2단 트리(DYPICK)로 낸다 —
     * 왼쪽 의무 / 오른쪽 그 의무의 할 일, 칸마다 검색, 아래에 고른 것.
     * 업무 목록의 상세 조건도 같은 선택기를 쓴다(두 번 배우지 않게). */
    function step2() {
        return '<div class="du-pick">' +
            '<p class="du-pick-lead">이 서류가 <b>어떤 의무의 무슨 일</b>을 했다는 증거인지 고르세요. ' +
                '왼쪽에서 의무를 고르면 오른쪽에 그 의무의 할 일이 나옵니다. 여러 개 고를 수 있습니다.</p>' +
            global.DYPICK.render({
                ns: 'DOCUP.onPick', multi: true,
                item: global.DYPICK.currentItem(), stages: W.stageIds, height: 260,
            }) +
        '</div>';
    }
    /* DYPICK 콜백 — 고른 값은 마법사가 들고 있다 */
    function onPick(kind, a, b) {
        if (kind === 'stage') {
            var i = W.stageIds.indexOf(a);
            if (b && i < 0) W.stageIds.push(a);
            if (!b && i >= 0) W.stageIds.splice(i, 1);
        } else if (kind === 'all') {
            a.forEach(function (id) {
                var j = W.stageIds.indexOf(id);
                if (b && j < 0) W.stageIds.push(id);
                if (!b && j >= 0) W.stageIds.splice(j, 1);
            });
        } else if (kind === 'clear') { W.stageIds = []; }
        F().rerender(renderW);
    }

    function foot2() {
        return '<button class="btn btn-outline" onclick="DOCUP.prev()">← 이전</button>' +
            '<button class="btn btn-primary" onclick="DOCUP.next()">다음 — 확인 →</button>';
    }

    /* ── STEP 3 ── */
    function step3() {
        var items = {};
        W.stageIds.forEach(function (sid) { var s = D().stage(sid); if (s) (items[s.itemId] = items[s.itemId] || []).push(s); });
        var reverting = D().completedAmong(W.stageIds, W.year);
        return '<div class="du-conf">' +
            '<dl class="du-conf-meta">' +
                row('문서명', W.title) +
                row('파일', W.files.map(function (f) { return f.name; }).join(', ') || '—') +
                row('보고일자', W.date) +
                row('수발신', D().srText({ sr: W.sr, dir: W.dir }, true) || '—') +
                row('담당', W.dept + ' / ' + W.assignee) +
                row('기준연도', W.year + '년') +
            '</dl>' +
            (reverting.length
                ? '<div class="du-dup" role="alert"><b>이미 확인이 끝난 할 일 ' + reverting.length + '개가 다시 진행중이 됩니다.</b>' +
                  '<p class="du-dim">서류가 바뀌었으니 재난안전과 확인을 다시 받습니다.</p></div>'
                : '') +
            '<h4 class="du-conf-sub">의무 ' + Object.keys(items).length + '가지 · 할 일 ' + W.stageIds.length + '개</h4>' +
            '<table class="table-figma table-compact du-conf-tbl"><thead><tr>' +
                '<th>어떤 의무 · 무슨 일</th><th>지금</th><th>등록 후</th>' +
            '</tr></thead><tbody>' +
            Object.keys(items).map(function (iid) {
                var it = D().item(iid);
                return '<tr class="du-conf-item"><td colspan="3">' + esc(it.id) + ' · ' + esc(it.name) + '</td></tr>' +
                    items[iid].map(function (s) {
                        var from = D().statusOfStage(s.id, W.year);
                        return '<tr><td class="du-conf-st">' + esc(s.id) + ' ' + esc(s.name) + '</td>' +
                            '<td><span class="chip-status chip-sm ' + V().toneOf(D().statusLabel(from)) + '">' + esc(D().statusLabel(from)) + '</span></td>' +
                            '<td><span class="chip-status chip-sm info">진행중</span></td></tr>';
                    }).join('');
            }).join('') +
            '</tbody></table>' +
            '<p class="du-hint">등록하면 고른 할 일이 <b>진행중</b>이 됩니다. ' +
                '<b>완료</b>는 재난안전과가 서류를 확인한 뒤에 붙습니다 — 내가 직접 완료로 만들 수는 없습니다.</p>' +
        '</div>';
    }
    function row(k, v) { return '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>'; }
    function foot3() {
        return '<button class="btn btn-outline" onclick="DOCUP.prev()">← 이전</button>' +
            '<button class="btn btn-primary" onclick="DOCUP.submit()">이대로 등록</button>';
    }

    /* =========================================================================
     * 마법사 동작
     * ========================================================================= */
    function addFiles(items) {
        (items || []).forEach(function (f) {
            if (W.files.length >= V().FILE_LIMITS.maxCount) return;
            W.files.push({ name: f.name, size: f.size, type: f.type });
        });
        captureStep1();
        if (!W.title && W.files.length) W.title = W.files[0].name.replace(/\.[^.]+$/, '');
        checkDup();
        renderW();
    }
    function delFile(i) { captureStep1(); W.files.splice(i, 1); renderW(); }
    function onTitle(v) { W.title = v; }
    /* ORGPICK memberUid 모드 콜백 — (uid, name, role, team). 부서는 uid 에서 파생한다
       (문자열 파싱으로 부서를 뽑으면 '·' 가 든 부서명에서 깨진다). */
    function pickOwner(uid, name) {
        captureStep1();
        var m = null;
        (V().orgDepts ? V().orgDepts() : []).some(function (d) {
            var hit = V().orgMembers(d.id).filter(function (x) { return x.uid === uid; })[0];
            if (hit) { m = hit; return true; }
            return false;
        });
        if (!m) { V().toast('담당자를 찾을 수 없습니다.'); return; }
        /* 화면을 우회해도 같은 판정으로 걸린다 */
        var own = D().assertOwn(m.deptName);
        if (!own.ok) { W.fieldErr['du-org'] = own.reason; renderW(); return; }
        W.assigneeUid = m.uid;
        W.dept = m.deptName;
        W.assignee = name || m.name;
        delete W.fieldErr['du-org'];
        checkDup();
        renderW();
    }
    function setDup(mode) { W.dupMode = mode; }
    function checkDup() {
        W.dupWith = null;
        if (!W.title || !W.date) return;
        var hit = D().allDocs().filter(function (d) {
            return d.title === W.title && (d.sr || '') === (W.sr || '') && d.date === W.date;
        })[0];
        if (hit) { W.dupWith = hit.id; if (!W.dupMode) W.dupMode = 'new'; }
    }

    function clearStages() { W.stageIds = []; F().rerender(renderW); }

    function next() {
        W.err = ''; W.fieldErr = {};
        if (W.step === 1) {
            captureStep1();
            checkDup();
            var miss = [];
            if (!W.files.length) { W.fieldErr['du-drop'] = '증빙 파일을 1개 이상 첨부해야 합니다.'; miss.push('첨부 파일'); }
            if (!String(W.title).trim()) { W.fieldErr['du-title'] = '문서명을 입력하세요.'; miss.push('문서명'); }
            if (!W.date) { W.fieldErr['du-date'] = W.year + '년 안의 보고일자를 고르세요.'; miss.push('보고일자'); }
            else if (String(W.date).slice(0, 4) !== String(W.year)) {
                W.fieldErr['du-date'] = '기준연도(' + W.year + '년)와 보고일자의 연도가 다릅니다.'; miss.push('보고일자');
            }
            if (!W.dir) { W.fieldErr['du-dir'] = '이 문서가 어떻게 오간 건지 골라 주세요.'; miss.push('오간 방향'); }
            else if (W.dir !== 'internal' && !String(W.sr).trim()) {
                /* 받은·보낸 문서인데 상대가 없다는 것은 성립하지 않는다. 여기를
                   비워 두면 원장의 «노, 로, 도» 같은 값이 다시 쌓인다. */
                W.fieldErr['du-sr'] = (W.dir === 'in' ? '이 문서를 보낸' : '이 문서를 받은') + ' 기관·부서를 적어 주세요.';
                miss.push('상대 기관');
            }
            if (!W.assignee) { W.fieldErr['du-org'] = '담당부서·담당자를 조직도에서 고르세요.'; miss.push('담당부서·담당자'); }
            else {
                var own = D().assertOwn(W.dept);
                if (!own.ok) { W.fieldErr['du-org'] = own.reason; miss.push('담당부서·담당자'); }
            }
            if (miss.length) {
                var last = miss[miss.length - 1];
                W.err = miss.join(' · ') + V().josa(last, '을', '를') + ' 확인해 주세요.';
                renderW(); focusFirstError(); return;
            }
            if (W.dupWith && !W.dupMode) { W.err = '같은 문서가 있습니다 — 기존에 추가할지 새로 만들지 골라 주세요.'; renderW(); return; }
            W.step = 2; renderW(); focusBody(); return;
        }
        if (W.step === 2) {
            if (!W.stageIds.length) { W.err = '이 문서가 증빙하는 업무단계를 하나 이상 선택해야 합니다.'; renderW(); return; }
            W.step = 3; renderW(); focusBody(); return;
        }
    }
    /* 오류가 난 첫 칸으로 초점을 옮긴다 — 배너만 띄우면 어디를 고쳐야 할지 모른다 */
    function focusFirstError() {
        /* 화면에 놓인 **순서 그대로** 훑는다 — 위에서 처음 걸리는 것으로 포커스를
           옮겨야 «어디를 고쳐야 하는지»가 맞는다. 종전에는 `du-dir`(문서 방향)이
           빠져 있어, 방향만 안 골랐을 때 오류 문구는 뜨는데 포커스가 아무 데도
           가지 않았다(§8 focus-management). */
        var order = ['du-drop', 'du-title', 'du-date', 'du-dir', 'du-org'];
        for (var i = 0; i < order.length; i++) {
            if (!W.fieldErr[order[i]]) continue;
            var el = order[i] === 'du-org' ? document.querySelector('#du-org .du-orgbtn')
                   : order[i] === 'du-drop' ? document.querySelector('.upload-drop')
                   : order[i] === 'du-dir' ? document.querySelector('#du-dir .cmp-seg-btn')
                   : document.getElementById(order[i]);
            if (el) { try { el.focus(); el.scrollIntoView({ block: 'center' }); } catch (e) {} return; }
        }
    }
    /* STEP 전환 시 본문으로 초점을 보낸다 — 모달 밖 버튼에 초점이 남아 있으면
       키보드 사용자는 방금 바뀐 화면을 지나쳐 버린다. */
    function focusBody() {
        var el = document.querySelector('#v2-modal .modal-body');
        if (!el) return;
        el.setAttribute('tabindex', '-1');
        try { el.focus(); } catch (e) {}
    }
    function prev() { W.err = ''; W.fieldErr = {}; if (W.step > 1) { W.step--; renderW(); focusBody(); } }
    function cancel() {
        /* 확인은 가드가 한 번만 낸다 — 여기서 또 물으면 두 번 묻는다 */
        if (V().closeModal() !== false) W = null;
    }

    function submit() {
        var doc, extra = '';
        if (W.dupWith && W.dupMode === 'append') {
            var base = D().docById(W.dupWith);
            var merged = (base.stageIds || []).slice();
            W.stageIds.forEach(function (s) { if (merged.indexOf(s) < 0) merged.push(s); });
            var r = D().updateDocument(W.dupWith, {
                stageIds: merged,
                files: (base.files || []).concat(W.files),
                note: W.note || base.note,
            });
            if (r.ok) { doc = r.doc; }
            else {
                /* 원장 문서이거나 남의 부서 문서라 덧붙일 수 없다 — 새 문서로 만들고
                   왜 그렇게 됐는지 사실대로 알린다(조용히 다른 짓을 하지 않는다). */
                var a = D().addDocument(payload());
                if (!a.ok) { W.err = a.reason; renderW(); return; }
                doc = a.doc; extra = r.reason + ' 새 문서로 등록했습니다.';
            }
        } else {
            var res = D().addDocument(payload());
            if (!res.ok) { W.err = res.reason; W.fieldErr['du-org'] = res.reason; renderW(); focusFirstError(); return; }
            doc = res.doc;
        }
        V().clearModalGuard();
        V().closeModal(true);
        afterSave(doc, extra);
    }
    function payload() {
        return {
            title: String(W.title).trim(), sr: W.sr, dir: W.dir, date: W.date, year: W.year,
            stageIds: W.stageIds.slice(), src: W.src,
            dept: W.dept, assignee: W.assignee, assigneeUid: W.assigneeUid, note: W.note,
            files: W.files.map(function (f) { return { id: fileId(), name: f.name, size: f.size, at: D().today() }; }),
        };
    }
    var _fseq = 0;
    function fileId() { return 'FILE-' + D().DEFAULT_YEAR + '-' + (++_fseq) + '-' + Math.abs(hash(String(_fseq) + D().today())); }
    function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return h; }

    function afterSave(doc, extra) {
        W = null;
        if (global.DOCEXEC && global.DOCEXEC.render) global.DOCEXEC.render();
        if (global.DOCLIST && global.DOCLIST.render) global.DOCLIST.render();
        /* 업무 관리(신) — 저장 뒤 낡은 화면을 남기지 않는다(같은 가드 패턴) */
        if (global.CMPST && global.CMPST.render) global.CMPST.render();
        if (global.CMPDOC && global.CMPDOC.render) global.CMPDOC.render();
        saved([doc], {
            title: '서류를 올렸습니다',
            lead: '«' + doc.title + '» 을 등록했습니다.',
            note: (extra ? esc(extra) + ' ' : '') +
                  '할 일 <b>' + (doc.stageIds || []).length + '개</b>가 진행중이 되었습니다.',
        });
    }

    /* =========================================================================
     * 전년도 프리셋 — 단건·다건을 **하나의 선택 화면**에서 처리 (D-03)
     * ========================================================================= */
    function openPreset(toYear) {
        if (!D().canUpload()) { V().toast(denyNote()); return; }
        P = blankP(toYear);
        W = null;                     /* 마법사에서 넘어온 경우 그 입력은 여기서 끝난다 */
        armGuard();
        renderP();
    }
    function renderP() {
        var res = presetView();
        var n = Object.keys(P.sel).length;
        var body =
            '<div class="du-pre">' +
                errBox(P.err) +
                '<p class="du-pre-lead"><b>' + P.from + '년</b> 문서의 업무단계 선택값을 <b>' + P.to + '년</b>으로 가져옵니다. ' +
                    '전년도 <b>진행상태·결재상태·보고일자·문서번호는 복제하지 않습니다.</b></p>' +
                presetBar(res) +
                presetTable(res) +
                presetPager(res) +
                (n ? presetFoot() : '') +
            '</div>';
        var foot =
            '<button class="btn btn-outline" onclick="DOCUP.closePreset()">닫기</button>' +
            (n === 1 ? '<button class="btn btn-primary" onclick="DOCUP.runPreset()">1건 가져오기</button>'
             : n > 1 ? '<button class="btn btn-primary" onclick="DOCUP.runPreset()">' + n + '건 가져오기</button>'
             : '<button class="btn btn-primary" disabled>문서를 선택하세요</button>');
        V().openModal('전년도 프리셋 불러오기 <span class="du-step">' + P.from + ' → ' + P.to + '</span>', body, foot);
    }
    function presetView() {
        var all = D().allDocs().filter(function (d) { return d.year === P.from; });
        var list = all.filter(function (d) {
            if (P.onlySel && !P.sel[d.id]) return false;
            if (P.item && d.stageIds.every(function (s) { var st = D().stage(s); return !st || st.itemId !== P.item; })) return false;
            if (P.cycle && d.cycle !== P.cycle) return false;
            if (P.sr && (d.sr || '') !== P.sr) return false;
            if (P.month && String(d.date || '').slice(5, 7) !== P.month) return false;
            if (P.q && !F().match(P.q, [d.title, d.sr, d.date].concat(
                d.stageIds.map(function (s) { var st = D().stage(s); return st ? st.name : ''; })))) return false;
            return true;
        });
        var total = list.length;
        var pages = Math.max(1, Math.ceil(total / P.size));
        if (P.page > pages) P.page = pages;
        return { list: list, total: total, pages: pages, rows: list.slice((P.page - 1) * P.size, P.page * P.size) };
    }
    /* 조회 조건 <select> — 표준 계열(.form-select)만 쓴다(CLAUDE.md §7).
       ⚠ 이 헬퍼가 없어 presetBar() 가 ReferenceError 로 죽었다(프리셋 모달이 아예
         열리지 않았다). 호출부는 처음부터 sel(...) 이었는데 정의가 없었다. */
    function sel(id, v, opts, on, label) {
        return '<select class="form-select" id="' + esc(id) + '" aria-label="' + esc(label || '조회 조건') + '"' +
            ' onchange="' + on + '">' + F().optionsHtml(opts, v) + '</select>';
    }
    function presetBar(res) {
        var items = [['', '이행항목 전체']].concat(D().items().map(function (i) { return [i.id, i.id + ' ' + i.name]; }));
        var cy = {}; D().allDocs().forEach(function (d) { if (d.year === P.from && d.cycle) cy[d.cycle] = 1; });
        var months = [['', '보고월 전체']].concat('01,02,03,04,05,06,07,08,09,10,11,12'.split(',').map(function (m) { return [m, +m + '월']; }));
        return '<div class="dy-toolbar dy-filterbar du-pre-bar">' +
            '<div class="dy-filterbar-fields">' +
                '<input type="search" class="form-input dy-f-search" id="dp-q" value="' + esc(P.q) + '"' +
                    ' placeholder="문서명·수발신자·업무단계" aria-label="문서 검색" oninput="DOCUP.setPreF(\'q\', this.value)">' +
                sel('dp-it', P.item, items, "DOCUP.setPreF('item', this.value)", '이행항목') +
                sel('dp-cy', P.cycle, [['', '주기 전체']].concat(Object.keys(cy).sort().map(function (c) { return [c, c]; })), "DOCUP.setPreF('cycle', this.value)", '주기') +
                sel('dp-mo', P.month, months, "DOCUP.setPreF('month', this.value)", '보고월') +
                '<label class="edu-short-ck"><input type="checkbox"' + (P.onlySel ? ' checked' : '') +
                    ' onchange="DOCUP.setPreF(\'onlySel\', this.checked)"> 선택한 항목만 보기</label>' +
            '</div>' +
            '<div class="dy-filterbar-tail">' +
                '<span class="dy-count">' + res.total + '건</span>' +
                '<span class="du-pre-sel"><b>선택 ' + Object.keys(P.sel).length + '건</b></span>' +
                '<button type="button" class="btn btn-outline btn-sm" onclick="DOCUP.resetPreF()">필터 초기화</button>' +
            '</div>' +
        '</div>';
    }
    function presetTable(res) {
        if (!res.total) {
            return '<div class="v2-empty"><b>조건에 맞는 ' + P.from + '년 문서가 없습니다.</b><br>' +
                '검색어나 조건을 지워보세요.</div>';
        }
        return '<div class="du-pre-tbl"><table class="table-figma table-compact"><thead><tr>' +
            '<th class="du-pre-ck"><span class="sr-only">선택</span></th>' +
            '<th>문서명</th><th>보고일자</th><th>수발신자</th><th>업무단계</th>' +
        '</tr></thead><tbody>' +
        res.rows.map(function (d) {
            var on = !!P.sel[d.id];
            return '<tr class="' + (on ? 'is-sel' : '') + '">' +
                '<td class="du-pre-ck"><input type="checkbox" id="dp-' + esc(d.id) + '"' + (on ? ' checked' : '') +
                    ' aria-label="' + esc(d.title) + ' 선택" onchange="DOCUP.selDoc(\'' + esc(d.id) + '\', this.checked)"></td>' +
                '<td class="du-pre-t"><label for="dp-' + esc(d.id) + '">' + esc(d.title) + '</label>' +
                    (on ? oneRow(d) : '') + '</td>' +
                '<td>' + esc(d.date) + '</td>' +
                '<td>' + esc(d.sr || '—') + '</td>' +
                '<td>' + (d.stageIds.length ? d.stageIds.length + '개 단계' : '<span class="dx-nodoc">미분류</span>') + '</td>' +
            '</tr>';
        }).join('') + '</tbody></table></div>';
    }
    /* 선택한 문서만 개별 설정을 펼친다 — 전부 펼치면 긴 화면이 된다(§7-3) */
    function oneRow(d) {
        var n = Object.keys(P.sel).length;
        if (n > 1 && !P.expand[d.id]) {
            return '<button type="button" class="du-link" onclick="DOCUP.expand(\'' + esc(d.id) + '\')">개별 설정 ▾</button>';
        }
        var c = P.sel[d.id];
        return '<div class="du-pre-one">' +
            '<label>문서명 ' +
                '<select class="form-select" onchange="DOCUP.setOne(\'' + esc(d.id) + '\',\'titleMode\',this.value)">' +
                    F().optionsHtml([['keep', '그대로'], ['year', '연도 치환 (' + P.from + '→' + P.to + ')'], ['edit', '직접 수정']], c.titleMode) +
                '</select></label>' +
            (c.titleMode === 'edit'
                ? '<input type="text" class="form-input" value="' + esc(c.title || d.title) + '" ' +
                  'oninput="DOCUP.setOne(\'' + esc(d.id) + '\',\'title\',this.value)">' : '') +
            '<label>첨부 ' +
                '<select class="form-select" onchange="DOCUP.setOne(\'' + esc(d.id) + '\',\'fileMode\',this.value)">' +
                    F().optionsHtml([['keep', '그대로 사용 (새 파일 ID 발급)'], ['replace', '파일 교체']], c.fileMode) +
                '</select></label>' +
            (c.fileMode === 'keep'
                ? '<p class="du-dim">' + P.from + '년 첨부 파일을 ' + P.to + '년 저장소로 복사하고 새 파일 ID 를 발급합니다. 원본은 바뀌지 않습니다.</p>'
                : '<p class="du-dim">등록 후 문서 상세에서 새 파일을 올립니다.</p>') +
            (n > 1 ? '<button type="button" class="du-link" onclick="DOCUP.expand(\'' + esc(d.id) + '\')">접기 ▴</button>' : '') +
        '</div>';
    }
    function presetPager(res) {
        if (res.pages <= 1) return '';
        return '<div class="du-pre-pager">' +
            '<button class="btn btn-sm btn-outline"' + (P.page <= 1 ? ' disabled' : '') + ' onclick="DOCUP.prePage(' + (P.page - 1) + ')">← 이전</button>' +
            '<span>' + P.page + ' / ' + res.pages + '</span>' +
            '<button class="btn btn-sm btn-outline"' + (P.page >= res.pages ? ' disabled' : '') + ' onclick="DOCUP.prePage(' + (P.page + 1) + ')">다음 →</button>' +
        '</div>';
    }
    /* 2건 이상이면 일괄 설정 막대 — 공통 옵션을 먼저 적용하고 예외만 개별 수정(D-03) */
    function presetFoot() {
        var n = Object.keys(P.sel).length;
        if (n < 2) return '';
        return '<div class="du-pre-bulk">' +
            '<b>' + n + '건 일괄 설정</b>' +
            '<label>문서명 <select class="form-select" onchange="DOCUP.setBulk(\'titleMode\', this.value)">' +
                F().optionsHtml([['keep', '그대로'], ['year', '연도 치환'], ['edit', '개별 수정']], P.bulk.titleMode) + '</select></label>' +
            '<label>첨부 <select class="form-select" onchange="DOCUP.setBulk(\'fileMode\', this.value)">' +
                F().optionsHtml([['keep', '모두 그대로 사용'], ['replace', '모두 교체']], P.bulk.fileMode) + '</select></label>' +
            '<button type="button" class="du-link" onclick="DOCUP.clearSel()">전체 해제</button>' +
        '</div>';
    }

    /* 접속자 본인 — 프리셋으로 만든 문서의 담당자 */
    function me() {
        var R = global.DYROLE, p = R && R.current ? R.current() : null;
        if (!p) return { dept: '', name: '', uid: '' };
        var dn = '';
        (V().orgDepts ? V().orgDepts() : []).some(function (d) {
            if (d.id === p.deptId) { dn = d.name; return true; }
            return false;
        });
        return { dept: dn || p.deptName || '', name: p.name || '', uid: p.uid || '' };
    }
    function setPreF(k, v) { P[k] = v; P.page = 1; F().rerender(renderP); }
    function resetPreF() { P.q = ''; P.item = ''; P.cycle = ''; P.sr = ''; P.month = ''; P.onlySel = false; P.page = 1; F().rerender(renderP); }
    function prePage(n) { P.page = n; renderP(); }
    function selDoc(id, on) {
        if (on) P.sel[id] = { titleMode: P.bulk.titleMode, title: '', fileMode: P.bulk.fileMode };
        else { delete P.sel[id]; delete P.expand[id]; }
        F().rerender(renderP);
    }
    function clearSel() { P.sel = {}; P.expand = {}; F().rerender(renderP); }
    function expand(id) { P.expand[id] = !P.expand[id]; renderP(); }
    function setOne(id, k, v) {
        if (!P.sel[id]) return;
        P.sel[id][k] = v;
        F().rerender(renderP);
    }
    function setBulk(k, v) {
        P.bulk[k] = v;
        Object.keys(P.sel).forEach(function (id) { P.sel[id][k] = v; });
        F().rerender(renderP);
    }
    function closePreset() { if (V().closeModal() !== false) P = null; }
    /* 저장 뒤에는 확인 없이 닫는다 */
    function closePresetDone() { V().clearModalGuard(); V().closeModal(true); P = null; }

    /* =========================================================================
     * 등록 결과 — 만든 문서로 가는 길을 준다 (2026-08-25 신설)
     * -------------------------------------------------------------------------
     * 종전에는 등록·불러오기·프리셋이 전부 **토스트만 내고 끝났다.** 방금 만든
     * 문서가 어떤 것인지, 어디서 볼 수 있는지 알 방법이 없었다 — 목록으로 돌아가
     * 검색해 찾아야 했다. 문서 상세의 «올해 이어받기»만 예외적으로 상세로
     * 이동하고 있었는데, 같은 일을 하는 네 경로가 서로 다르게 끝난 셈이다.
     *
     * **자동으로 튕기지 않는다.** 이행 관리에서 불러온 사람은 그 화면에 남고 싶을
     * 수 있어, 강제 이동하면 하던 일의 맥락을 잃는다. 대신 «갈 수 있게» 한다 —
     * 1건이면 주 버튼이 곧 그 문서이고, 여러 건이면 목록에서 고른다.
     *
     * 화면마다 결과 화면을 새로 짜지 않는다(§7 계열 신설 금지). 네 화면이 모두
     * 이 모듈을 로드하므로 여기 한 곳에 둔다.
     *
     *   docs : addDocument 가 돌려준 문서 객체 배열
     *   opts : { title, lead, note, backTo }
     *          backTo — 돌아올 화면(`cmp-status.html?year=2025` 등). 상세에서
     *          «뒤로»가 온 곳을 가리키게 한다. 생략하면 지금 화면.
     * ========================================================================= */
    /* 상세는 **업무관리의 문서 목록 안에서** 연다 — 업무관리에서 시작한 사람이
     * 업무문서 메뉴로 튕기면 하던 일의 맥락을 잃는다. 그 화면 상세가 문서 정보·
     * 제목 수정·삭제·이어받기를 전부 갖고 있어 거기서 끝난다.
     * 업무문서 메뉴 안에서 등록한 경우(docs-preset·docs-exec)는 그쪽 상세로 간다 —
     * 지금 있는 메뉴를 벗어나지 않는 것이 규칙이다. */
    function inWorkDocs() {
        var f = location.pathname.split('/').pop();
        return f === 'docs-preset.html' || f === 'docs-exec.html' || f === 'doc-detail.html';
    }
    function detailHref(doc, backTo) {
        var back = backTo || (location.pathname.split('/').pop() + location.search);
        if (inWorkDocs()) {
            return 'doc-detail.html?id=' + encodeURIComponent(doc.id) + '&back=' + encodeURIComponent(back);
        }
        return 'cmp-docs.html?doc=' + encodeURIComponent(doc.id) +
               '&year=' + encodeURIComponent(doc.year);
    }
    /* ── 문서 제목 수정 — 두 상세가 함께 쓴다 (2026-08-25) ────────────────
     * 업무문서 상세(doc-detail)와 업무관리 문서 목록 상세(cmp-docs) 양쪽에서
     * 고칠 수 있어야 하는데, 두 곳에 같은 모달을 짜면 문구·검사·권한이 갈린다.
     *
     * **등록분만** 고칠 수 있다 — `canEditDoc` 은 원장 문서에도 재난안전과
     * 담당자를 허용하지만 그건 «잘못 붙은 분류를 고치는» 권한이고, 원장 제목은
     * 실제 온나라 문서의 제목이라 이 시스템이 고칠 값이 아니다. updateDocument
     * 가 실제로 거절하므로 버튼만 내면 «확인까지 시키고 거절하는 버튼»이 된다.
     */
    function canEditTitle(d) { return !!d && D().canEditDoc(d) && d.origin === 'user'; }
    function titleDenyNote(d) {
        if (!d) return '문서를 찾을 수 없습니다.';
        if (d.origin !== 'user') {
            return '원장·예시 문서의 제목은 바꿀 수 없습니다 — 실제 문서의 제목이라 이 시스템이 고칠 값이 아닙니다.';
        }
        return D().ownDenyNote(d.dept);
    }
    /* 제목 옆에 다는 버튼 — 권한이 없으면 아무것도 내지 않는다 */
    function titleEditBtn(d, ns) {
        if (!canEditTitle(d)) return '';
        return ' <button type="button" class="dd-title-edit" aria-label="문서 제목 수정"' +
            ' onclick="' + esc(ns) + '.editTitle(\'' + esc(d.id) + '\')">제목 수정</button>';
    }
    function editTitle(id, onDone) {
        var d = D().docById(id);
        if (!canEditTitle(d)) { V().toast(titleDenyNote(d)); return; }
        _titleDone = typeof onDone === 'function' ? onDone : null;
        _titleId = id;
        V().openModal('문서 제목 수정',
            '<div class="form-field">' +
                '<label class="form-label" for="du-title-in">문서명 <b>(필수)</b></label>' +
                '<input type="text" class="form-input" id="du-title-in" value="' + esc(d.title) + '"' +
                    ' maxlength="200" autocomplete="off"' +
                    ' onkeydown="if(event.key===\'Enter\'){event.preventDefault();DOCUP.saveTitle();}">' +
                '<p class="form-field-help">지난 연도 문서를 불러오면 제목의 연도 표기가 남아 있을 수 있습니다 — ' +
                    '이 문서의 기준연도는 <b>' + esc(d.year) + '년</b>입니다.</p>' +
            '</div>',
            '<button type="button" class="btn btn-outline" onclick="DYV2.closeModal()">취소</button>' +
            '<button type="button" class="btn btn-primary" onclick="DOCUP.saveTitle()">저장</button>');
        setTimeout(function () {
            var el = document.getElementById('du-title-in');
            if (el) { el.focus(); el.select(); }
        }, 30);
    }
    var _titleId = '', _titleDone = null;
    function saveTitle() {
        var d = D().docById(_titleId);
        if (!canEditTitle(d)) { V().toast(titleDenyNote(d)); return; }
        var el = document.getElementById('du-title-in');
        var v = el ? String(el.value).trim() : '';
        /* 빈 제목은 저장하지 않는다 — 목록에서 그 줄이 통째로 사라진 것처럼 보인다 */
        if (!v) { V().toast('문서명을 입력해 주세요.'); if (el) el.focus(); return; }
        if (v === d.title) { V().closeModal(); return; }
        var r = D().updateDocument(_titleId, { title: v });
        if (!r.ok) { V().toast(r.reason); return; }
        V().closeModal();
        if (_titleDone) _titleDone(r.doc);
        V().toast('문서명을 바꿨습니다.');
    }

    function saved(docs, opts) {
        docs = (docs || []).filter(Boolean);
        var o = opts || {};
        if (!docs.length) { V().toast(o.note || '만들어진 문서가 없습니다.'); return; }
        var one = docs.length === 1;
        var body =
            '<div class="du-saved">' +
                '<p class="du-saved-lead"><b>' + esc(o.lead || (docs.length + '건을 등록했습니다.')) + '</b></p>' +
                (o.note ? '<p class="du-saved-note">' + o.note + '</p>' : '') +
                '<ul class="du-saved-list">' +
                docs.map(function (d) {
                    var stg = (d.stageIds || []).length;
                    return '<li class="du-saved-item">' +
                        '<a class="du-saved-t" href="' + esc(detailHref(d, o.backTo)) + '">' + esc(d.title) + '</a>' +
                        '<span class="du-saved-m">' + esc(d.id) +
                        (stg ? ' · 할 일 ' + stg + '개' : ' · 할 일 미지정') +
                        ((d.files || []).length ? ' · 첨부 ' + d.files.length + '건' : '') + '</span>' +
                    '</li>';
                }).join('') +
                '</ul>' +
                /* 지금 상태를 한 줄로 — «등록했다»만으로는 다음에 무엇이 남았는지 모른다.
                   그 다음 할 일은 이 화면이 아니라 **내 할일**에서 이어진다. */
                '<p class="du-saved-next">올린 서류는 <b>진행중</b>입니다. 재난안전과 담당자가 확인하면 완료가 됩니다. ' +
                    '<a class="du-saved-go" href="my-work.html">내 할일에서 이어서 처리 →</a></p>' +
            '</div>';
        /* **되돌리기** — 방금 만든 것을 바로 물릴 수 있어야 한다. 잘못 골라 30건을
           만들고 나면 한 건씩 찾아 지우는 수밖에 없었다(§4 «CRUD 는 회수 경로까지»).
           원본은 건드리지 않는다 — 지우는 것은 방금 만든 사본뿐이다. */
        _undo = docs.map(function (d) { return d.id; });
        /* 순서가 곧 배치다 — 되돌리기가 **맨 앞**이어야 `margin-right:auto` 가
           그 뒤를 전부 오른쪽으로 민다. 가운데 두면 앞 버튼까지 왼쪽 그룹이
           되어 [닫기][되돌리기] … [열기] 라는 어색한 묶음이 나온다.
           결과: [되돌리기] ……… [닫기] [열기] */
        var foot =
            /* 이 창을 닫으면 **일괄** 되돌리기 수단이 사라진다(문서별 삭제는 상세에
               남는다). 닫고 나서 찾게 하지 않으려면 버튼이 그 사실을 말해야 한다. */
            '<button type="button" class="btn btn-outline du-undo" onclick="DOCUP.undoSaved()"' +
                ' title="한 번에 되돌릴 수 있는 것은 지금뿐입니다 — 이 창을 닫으면 문서별로 지워야 합니다.">' +
                '방금 만든 ' + docs.length + '건 되돌리기</button>' +
            '<button type="button" class="btn btn-outline" onclick="DYV2.closeModal()">닫기</button>' +
            '<a class="btn btn-primary" href="' + esc(detailHref(docs[0], o.backTo)) + '">' +
                (one ? '문서 상세 보기 →' : '첫 문서 열기 →') + '</a>';
        V().openModal(o.title || '등록 완료', body, foot);
    }
    var _undo = [];
    /* 되돌리기는 **확인을 한 번 받는다** — 되돌릴 수 없는 삭제이고, 첨부까지
       함께 사라진다. 무엇이 지워지는지 수로 밝힌다(§4 회수 모달 규칙). */
    function undoSaved() {
        if (!_undo.length) { V().toast('되돌릴 것이 없습니다.'); return; }
        var ids = _undo.slice();
        var docs = ids.map(D().docById).filter(Boolean);
        var files = 0, stages = {};
        docs.forEach(function (d) {
            files += (d.files || []).length;
            (d.stageIds || []).forEach(function (sid) { stages[sid] = 1; });
        });
        V().openModal('되돌리기 — 방금 만든 ' + docs.length + '건을 지웁니다',
            '<div class="du-saved">' +
                '<p class="du-saved-lead"><b>' + docs.length + '건</b>을 지웁니다. 되돌릴 수 없습니다.</p>' +
                '<ul class="du-saved-list">' + docs.map(function (d) {
                    return '<li class="du-saved-item"><span class="du-saved-t">' + esc(d.title) + '</span>' +
                        '<span class="du-saved-m">' + esc(d.id) + '</span></li>';
                }).join('') + '</ul>' +
                '<p class="du-saved-note">함께 사라지는 것 — 첨부 <b>' + files + '건</b> · ' +
                    '할 일 <b>' + Object.keys(stages).length + '개</b>의 증빙에서 빠집니다. ' +
                    '남은 증빙이 없는 할 일은 <b>미이행</b>으로 돌아갑니다.<br>' +
                    '<b>가져온 원본 문서는 그대로 있습니다</b> — 지우는 것은 방금 만든 사본뿐입니다.</p>' +
            '</div>',
            '<button type="button" class="btn btn-outline" onclick="DYV2.closeModal()">그대로 둡니다</button>' +
            /* 삭제 확인도 primary 다 — 이 코드베이스의 관례이고(doc-detail 의 [삭제]와
               같다) 새 계열을 만들지 않는다(§7). 위험은 색이 아니라 문구가 말한다. */
            '<button type="button" class="btn btn-primary" onclick="DOCUP.doUndo()">' + docs.length + '건 지우기</button>');
    }
    function doUndo() {
        var ok = 0, fail = '';
        _undo.forEach(function (id) {
            var r = D().removeDocument(id);
            if (r && r.ok) ok++; else if (r) fail = r.reason;
        });
        _undo = [];
        V().closeModal();
        refreshScreens();
        V().toast(ok ? ok + '건을 지웠습니다 — 원본은 그대로입니다.' : (fail || '지우지 못했습니다.'));
    }
    /* 저장·삭제 뒤 낡은 화면을 남기지 않는다 — 어느 화면에서 불렀는지 모르므로 전부 */
    function refreshScreens() {
        ['DOCEXEC', 'DOCLIST', 'CMPST', 'CMPDOC'].forEach(function (k) {
            if (global[k] && global[k].render) global[k].render();
        });
    }

    function runPreset() {
        var ids = Object.keys(P.sel);
        if (!ids.length) return;
        /* closePreset() 이 P 를 비우므로 뒤에서 쓸 값은 **미리** 꺼내 둔다 —
           종전에는 성공 토스트가 P.to 를 읽어 예외가 났고, 가져오기는 됐는데
           아무 피드백도 안 뜨는 상태가 됐다. */
        var FROM = P.from, TO = P.to;
        /* 같은 원본 → 같은 대상연도 재실행은 조용히 중복을 쌓지 않는다(§7-4) */
        var dup = ids.filter(function (id) {
            return D().store().presets.some(function (p) { return p.sourceDocumentId === id && p.targetYear === TO; });
        });
        if (dup.length && !global.confirm(dup.length + '건은 이미 ' + TO + '년으로 가져온 적이 있습니다. 그래도 다시 만들까요?')) return;

        /* 가져온 문서의 담당자는 **가져온 사람 본인**이다 — 전년도 담당자를 그대로
           복제하면 남의 이름으로 새 연도 문서를 만드는 것이 된다(소유권 규칙). */
        var OWNER = me();
        var made = 0, missing = 0, denied = 0, madeDocs = [];
        ids.forEach(function (id) {
            var src = D().docById(id); if (!src) return;
            var c = P.sel[id];
            var title = c.titleMode === 'edit' ? (c.title || src.title)
                      : c.titleMode === 'year' ? String(src.title).split(FROM).join(TO)
                      : src.title;
            /* 첨부 '그대로 사용' = 원본 파일 ID 참조가 아니라 **새 파일 ID 발급**(D-04).
               파일 바이너리를 보관하지 않으므로 메타데이터 이력만 재현하고,
               원본 파일 정보가 없으면 깨진 링크를 만들지 않고 사실을 남긴다. */
            var files = [];
            if (c.fileMode === 'keep') {
                var srcFiles = src.files || [];
                if (!srcFiles.length) { missing++; }
                srcFiles.forEach(function (f) {
                    files.push({ id: fileId(), name: f.name, size: f.size, at: D().today(),
                                 copiedFromFileId: f.id, sourceYear: FROM, targetYear: TO });
                });
            }
            var res = D().addDocument({
                title: title, sr: src.sr || '', dir: src.dir || null,
                date: '', year: TO,   /* 보고일자·문서번호는 복제하지 않는다 */
                /* 방향·상대 기관은 이어받는다 — 같은 업무를 같은 곳과 다시
                   주고받는 것이 프리셋의 전제다. 원본에 없으면 미상 그대로. */
                stageIds: src.stageIds.slice(),
                src: 'upload', dept: OWNER.dept, assignee: OWNER.name, assigneeUid: OWNER.uid,
                files: files, presetOf: id,
                note: FROM + '년 «' + src.title + '» 에서 가져옴',
            });
            if (!res.ok) { denied++; return; }
            var doc = res.doc;
            madeDocs.push(doc);
            D().store().presets.push({
                id: 'PRESET-' + FROM + '-' + id, sourceYear: FROM, targetYear: TO,
                sourceDocumentId: id, newDocumentId: doc.id, stageIds: src.stageIds.slice(),
                attachmentMode: c.fileMode, createdAt: D().today(), createdBy: D().actor(),
            });
            made++;
        });
        D().saveStore();
        closePresetDone();
        if (global.DOCEXEC && global.DOCEXEC.render) global.DOCEXEC.render();
        if (global.DOCLIST && global.DOCLIST.render) global.DOCLIST.render();
        if (global.CMPST && global.CMPST.render) global.CMPST.render();
        if (global.CMPDOC && global.CMPDOC.render) global.CMPDOC.render();
        var warn = (missing ? missing + '건은 원본 첨부가 없어 <b>원본 파일 확인 필요</b>로 남았습니다. ' : '') +
                   (denied ? denied + '건은 소유권 검증에 걸려 만들지 않았습니다. ' : '');
        saved(madeDocs, {
            title: FROM + '년 문서를 ' + TO + '년으로 가져왔습니다',
            lead: made + '건을 ' + TO + '년 문서로 만들었습니다.',
            note: warn || null,
        });
    }

    global.DOCUP = {
        setDir: setDir,
        open: open, cancel: cancel, next: next, prev: prev, submit: submit,
        addFiles: addFiles, delFile: delFile, onTitle: onTitle, pickOwner: pickOwner, setDup: setDup,
        onPick: onPick, clearStages: clearStages,
        openPreset: openPreset, closePreset: closePreset, runPreset: runPreset, dirty: dirty,
        setPreF: setPreF, resetPreF: resetPreF, prePage: prePage,
        selDoc: selDoc, clearSel: clearSel, expand: expand, setOne: setOne, setBulk: setBulk,
        /* 등록 결과 화면 — 다른 화면(cmp-status 불러오기 등)이 함께 쓴다 */
        saved: saved, detailHref: detailHref, undoSaved: undoSaved, doUndo: doUndo,
        /* 제목 수정 — 두 상세(업무문서·업무관리)가 함께 쓴다 */
        editTitle: editTitle, saveTitle: saveTitle,
        canEditTitle: canEditTitle, titleDenyNote: titleDenyNote, titleEditBtn: titleEditBtn,
    };
}(window));
