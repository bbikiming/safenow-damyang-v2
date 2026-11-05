/* =====================================================================
   board-data.js · 게시판 데이터 (전역 DYBOARD) — 2026-11-05 운영 반영
   ---------------------------------------------------------------------
   · 게시판의 정의(이름·유형·쓰기 권한·순서·사용 여부)는 시스템 관리 >
     게시판 관리(admin-boards.html)가 정하고, 정보센터(info-center.html)는
     «사용» 게시판을 그 순서대로 탭으로 그린다. 두 화면이 같은 파일을 읽는다 —
     정보센터가 탭을 따로 들고 있으면 관리 화면에서 바꾼 것이 반영되지 않는다.
   · 기본 게시판은 공지사항 · 자료실 · 우수사례 3개다(운영 요청서 S2).
   · 유형 3종은 정보센터 정의서(SCR-RPT-003)의 세 영역 성격을 그대로 옮긴 것이다 —
       notice(공지형) 읽었는지가 중요 → 조회수 · archive(자료형) 찾는 것 → 구분·첨부
       case(사례형) 누가 했는지 → 부서·추천
   · 쓰기 권한 2종 — owner: 주관부서(재난안전과) 담당자 / dept: 각 부서 담당자.
     공지는 주관부서가 내고 자료·사례는 각 부서가 올린다(SCR-RPT-003 §6).
   · 게시판 삭제는 글이 0건일 때만 — 글이 있으면 «사용 끄기»로 내린다(글을 지우면
     언제 무엇을 알렸는지가 사라진다).
   · 저장: localStorage 한 키(dy-boards-v1). 첫 시드의 글은 예시 자료다(sample).
   ===================================================================== */
(function (global) {
    'use strict';

    var KEY = 'dy-boards-v1';
    var KINDS = {
        notice:  { label: '공지형', cols: ['제목', '작성', '등록일', '조회'] },
        archive: { label: '자료형', cols: ['자료명', '구분', '등록일', '첨부'] },
        'case':  { label: '사례형', cols: ['사례', '부서', '등록일', '추천'] }
    };
    var WRITES = {
        owner: '주관부서(재난안전과) 담당자',
        dept:  '각 부서 담당자'
    };
    /* 자료형 게시판의 구분 — 자료실 정의서(SCR-RPT-003 §4-2) */
    var CATS = ['법령', '지침', '양식', '기타'];
    var NAME_MAX = 20;

    function seed() {
        return {
            seq: 100,
            boards: [
                { id: 'notice',  name: '공지사항', kind: 'notice',  write: 'owner', use: true },
                { id: 'archive', name: '자료실',   kind: 'archive', write: 'dept',  use: true },
                { id: 'best',    name: '우수사례', kind: 'case',    write: 'dept',  use: true }
            ],
            posts: [
                { id: 'p1', board: 'notice', title: '[필독] 2026년 상반기 의무이행 점검 일정 안내', body: '부서별 상반기 의무이행 점검 일정을 안내합니다.', author: '재난안전과', authorUid: '', date: '2026-06-02', views: 214, sample: true },
                { id: 'p2', board: 'notice', title: '위험성평가 담당자 교육 신청 안내 (6/20)', body: '위험성평가 담당자 교육 신청을 받습니다.', author: '재난안전과', authorUid: '', date: '2026-05-28', views: 167, sample: true },
                { id: 'p3', board: 'notice', title: '시스템 정기 점검에 따른 일시 중단 안내', body: '정기 점검 시간에는 시스템을 쓸 수 없습니다.', author: '시스템 관리자', authorUid: '', date: '2026-05-20', views: 98, sample: true },
                { id: 'p4', board: 'archive', title: '중대재해처벌법 해설서 (고용노동부)', cat: '법령', body: '', author: '재난안전과', authorUid: '', date: '2026-03-02', files: [{ name: '중대재해처벌법_해설서.pdf' }], sample: true },
                { id: 'p5', board: 'archive', title: '지자체 위험성평가 실무 가이드', cat: '지침', body: '', author: '재난안전과', authorUid: '', date: '2026-02-14', files: [{ name: '지자체_위험성평가_실무가이드.pdf' }], sample: true },
                { id: 'p6', board: 'archive', title: 'TBM(작업 전 안전점검회의) 표준 양식', cat: '양식', body: '', author: '재난안전과', authorUid: '', date: '2026-01-30', files: [{ name: 'TBM_표준양식.hwpx' }], sample: true },
                { id: 'p7', board: 'best', title: '밀폐공간 작업 2인 1조 + 가스측정 정착 사례', body: '밀폐공간 작업 전 가스측정과 2인 1조를 정착시킨 과정입니다.', deptName: '환경과', author: '환경과', authorUid: '', date: '2026-05-15', recs: 12, sample: true },
                { id: 'p8', board: 'best', title: 'QR 신고함 도입으로 종사자 신고 3배 증가', body: 'QR 신고함을 두고 신고가 늘어난 사례입니다.', deptName: '재난안전과', author: '재난안전과', authorUid: '', date: '2026-04-22', recs: 9, sample: true }
            ]
        };
    }

    function load() {
        var v = null;
        try { v = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { v = null; }
        if (!v || !Array.isArray(v.boards) || !Array.isArray(v.posts)) v = seed();
        return v;
    }
    function store(v) {
        try { localStorage.setItem(KEY, JSON.stringify(v)); return true; } catch (e) { return false; }
    }
    function today() { return (global.DYV2 && global.DYV2.today) ? global.DYV2.today() : new Date().toISOString().slice(0, 10); }
    function me() { return (global.DYROLE && global.DYROLE.current) ? global.DYROLE.current() : null; }

    /* ── 권한 ── */
    /* 게시판 정의는 시스템 관리 화면에서만 바꾼다 — 시스템 관리 그룹이 보이는 사람
       (메뉴 권한과 같은 판정). 버튼만 숨기면 전역 호출로 뚫리므로 저장 함수도 본다. */
    function canManage() {
        var R = global.DYROLE;
        if (!R || !R.hidden) return true;
        return R.hidden().indexOf('admin') < 0;
    }
    function canWrite(b) {
        var R = global.DYROLE;
        if (!b || b.use === false) return false;
        if (!R || !R.canAct) return true;
        return b.write === 'owner' ? R.canAct(R.OWNER_DEPT) : R.canAct();
    }
    function writeDenyNote(b) {
        if (!b) return '';
        return '«' + b.name + '»에는 ' + WRITES[b.write] + '가 글을 올립니다.';
    }
    function canRemovePost(p) {
        var R = global.DYROLE, u = me();
        if (!p) return false;
        if (!R || !R.canAct) return true;
        if (R.canAct(R.OWNER_DEPT)) return true;
        return !!(u && p.authorUid && p.authorUid === u.uid && R.canAct());
    }

    /* ── 게시판 ── */
    function boards() { return load().boards.slice(); }
    function activeBoards() { return boards().filter(function (b) { return b.use !== false; }); }
    function board(id) { return boards().filter(function (b) { return b.id === id; })[0] || null; }
    function postCount(id) { return load().posts.filter(function (p) { return p.board === id; }).length; }

    function checkName(v, name, exceptId) {
        var n = String(name == null ? '' : name).trim();
        if (!n) return '게시판 이름을 입력하세요.';
        if (n.length > NAME_MAX) return '게시판 이름은 ' + NAME_MAX + '자 이내로 입력하세요.';
        var dup = v.boards.some(function (b) { return b.id !== exceptId && b.name.trim() === n; });
        if (dup) return '같은 이름의 게시판이 있습니다.';
        return '';
    }
    function createBoard(o) {
        if (!canManage()) return { ok: false, msg: '게시판은 시스템 관리자가 만듭니다.' };
        var v = load();
        var err = checkName(v, o && o.name);
        if (err) return { ok: false, msg: err };
        if (!KINDS[o.kind]) return { ok: false, msg: '게시판 유형을 고르세요.' };
        if (!WRITES[o.write]) return { ok: false, msg: '글을 올리는 사람을 고르세요.' };
        v.seq = (v.seq || 100) + 1;
        var b = { id: 'b' + v.seq, name: String(o.name).trim(), kind: o.kind, write: o.write, use: o.use !== false };
        v.boards.push(b);
        store(v);
        return { ok: true, board: b };
    }
    function updateBoard(id, o) {
        if (!canManage()) return { ok: false, msg: '게시판은 시스템 관리자가 고칩니다.' };
        var v = load();
        var b = v.boards.filter(function (x) { return x.id === id; })[0];
        if (!b) return { ok: false, msg: '게시판을 찾을 수 없습니다.' };
        var err = checkName(v, o && o.name, id);
        if (err) return { ok: false, msg: err };
        /* 유형을 바꾸면 정보센터의 열이 바뀐다 — 글이 있으면 그 글의 항목(구분·부서)이
           새 유형과 맞지 않으므로 글이 0건일 때만 바꾼다. */
        if (o.kind && o.kind !== b.kind) {
            if (!KINDS[o.kind]) return { ok: false, msg: '게시판 유형을 고르세요.' };
            if (postCount(id) > 0) return { ok: false, msg: '글이 있는 게시판은 유형을 바꿀 수 없습니다.' };
            b.kind = o.kind;
        }
        if (o.write) {
            if (!WRITES[o.write]) return { ok: false, msg: '글을 올리는 사람을 고르세요.' };
            b.write = o.write;
        }
        b.name = String(o.name).trim();
        if (typeof o.use === 'boolean') b.use = o.use;
        store(v);
        return { ok: true, board: b };
    }
    function setUse(id, on) {
        if (!canManage()) return false;
        var v = load();
        var b = v.boards.filter(function (x) { return x.id === id; })[0];
        if (!b) return false;
        b.use = !!on;
        store(v);
        return true;
    }
    function moveBoard(id, dir) {
        if (!canManage()) return false;
        var v = load();
        var i = v.boards.findIndex(function (b) { return b.id === id; });
        var j = i + (dir < 0 ? -1 : 1);
        if (i < 0 || j < 0 || j >= v.boards.length) return false;
        var t = v.boards[i]; v.boards[i] = v.boards[j]; v.boards[j] = t;
        store(v);
        return true;
    }
    function removeBoard(id) {
        if (!canManage()) return { ok: false, msg: '게시판은 시스템 관리자가 지웁니다.' };
        var n = postCount(id);
        if (n > 0) return { ok: false, msg: '글이 ' + n + '건 있어 지울 수 없습니다 — 사용을 끄면 정보센터에서 내려갑니다.' };
        var v = load();
        v.boards = v.boards.filter(function (b) { return b.id !== id; });
        store(v);
        return { ok: true };
    }

    /* ── 글 ── */
    function posts(boardId) {
        var b = board(boardId);
        var list = load().posts.filter(function (p) { return p.board === boardId; });
        /* 사례형은 추천이 많은 것이 위로 — 실제로 쓰인 사례가 먼저 보인다(SCR-RPT-003 §4-3).
           나머지는 최신순. 같은 값은 등록일·식별값으로 고정해 순서가 흔들리지 않게 한다. */
        list.sort(function (a, c) {
            if (b && b.kind === 'case' && (c.recs || 0) !== (a.recs || 0)) return (c.recs || 0) - (a.recs || 0);
            if (a.date !== c.date) return a.date < c.date ? 1 : -1;
            return a.id < c.id ? 1 : -1;
        });
        return list;
    }
    function post(id) { return load().posts.filter(function (p) { return p.id === id; })[0] || null; }

    function addPost(boardId, o) {
        var b = board(boardId);
        if (!b || b.use === false) return { ok: false, msg: '게시판을 찾을 수 없습니다.' };
        if (!canWrite(b)) return { ok: false, msg: writeDenyNote(b) };
        var title = String(o && o.title || '').trim();
        if (!title) return { ok: false, msg: '제목을 입력하세요.' };
        if (title.length > 100) return { ok: false, msg: '제목은 100자 이내로 입력하세요.' };
        if (b.kind === 'archive' && CATS.indexOf(o.cat) < 0) return { ok: false, msg: '구분을 고르세요.' };
        if (b.kind === 'case' && !String(o.deptName || '').trim()) return { ok: false, msg: '어느 부서 사례인지 고르세요.' };
        var u = me() || {};
        var v = load();
        v.seq = (v.seq || 100) + 1;
        var p = {
            id: 'p' + v.seq, board: boardId, title: title,
            body: String(o.body || '').trim(),
            author: u.deptName || u.org || '', authorUid: u.uid || '', authorName: u.name || '',
            date: today(), views: 0, recs: 0, recBy: [],
            files: (o.files || []).map(function (f) { return { name: f.name, size: f.size || 0 }; })
        };
        if (b.kind === 'archive') p.cat = o.cat;
        if (b.kind === 'case') p.deptName = String(o.deptName).trim();
        v.posts.push(p);
        store(v);
        return { ok: true, post: p };
    }
    function removePost(id) {
        var p = post(id);
        if (!p) return { ok: false, msg: '글을 찾을 수 없습니다.' };
        if (!canRemovePost(p)) return { ok: false, msg: '글은 쓴 사람과 주관부서 담당자가 지웁니다.' };
        var v = load();
        v.posts = v.posts.filter(function (x) { return x.id !== id; });
        store(v);
        return { ok: true };
    }
    function view(id) {
        var v = load();
        var p = v.posts.filter(function (x) { return x.id === id; })[0];
        if (!p) return null;
        p.views = (p.views || 0) + 1;
        store(v);
        return p;
    }
    /* 추천은 한 사람이 한 번 — 같은 사람이 여러 번 누르면 «실제로 도움이 됐는지»가 흐려진다 */
    function recommend(id) {
        var v = load(), u = me() || {};
        var p = v.posts.filter(function (x) { return x.id === id; })[0];
        if (!p) return { ok: false, msg: '글을 찾을 수 없습니다.' };
        p.recBy = p.recBy || [];
        var who = u.uid || 'anon';
        if (p.recBy.indexOf(who) >= 0) return { ok: false, msg: '이미 추천했습니다.' };
        p.recBy.push(who);
        p.recs = (p.recs || 0) + 1;
        store(v);
        return { ok: true, post: p };
    }

    global.DYBOARD = {
        KEY: KEY, KINDS: KINDS, WRITES: WRITES, CATS: CATS, NAME_MAX: NAME_MAX,
        boards: boards, activeBoards: activeBoards, board: board, postCount: postCount,
        createBoard: createBoard, updateBoard: updateBoard, setUse: setUse, moveBoard: moveBoard, removeBoard: removeBoard,
        posts: posts, post: post, addPost: addPost, removePost: removePost, view: view, recommend: recommend,
        canManage: canManage, canWrite: canWrite, writeDenyNote: writeDenyNote, canRemovePost: canRemovePost
    };
})(window);
