#!/usr/bin/env node
/* =========================================================================
 * 링크 정합 검사 — 화면 사이 이동이 논리적으로 성립하는지 본다.
 *
 *   실행: node tools/check-links.js
 *
 * [왜 필요한가]
 * 메뉴를 접거나 화면을 은퇴시키면 **그 화면을 가리키던 링크가 남는다.** 링크는
 * 깨지지 않는다 — 파일이 살아 있으니 열린다. 그래서 조용하다. 사용자만
 * "이전 버전 화면" 배너를 마주하고 «그럼 왜 나를 여기로 보냈지» 하게 된다.
 * 2026-08-31 점검에서 실제로 통계·기준문서함·경영방침·프리셋 양식 관리·문서 상세가
 * 그러고 있었다.
 *
 * [무엇을 보는가]
 *   1. 링크 대상 파일이 실재하는가
 *   2. 살아 있는 화면이 은퇴 화면으로 보내는가        ← 이번 사고
 *   3. 화면 문구에 없어진 대메뉴 이름이 남았는가 (링크가 없는 안내 문구까지)
 *   4. 폐기된 조회 파라미터를 아직 쓰는가
 *   5. 메뉴에도 없고 어디서도 링크하지 않는 화면이 있는가
 *
 * [은퇴 화면을 목록에 적는 자리]
 * RETIRED 는 «메뉴에서 뺐지만 파일은 살아 있는 화면»이다. 새로 은퇴시키면 여기에
 * 적는다 — 적지 않으면 2번 검사가 그 화면을 못 본다.
 * ========================================================================= */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const R = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* 메뉴 정의 */
const L = R('js/layout.js');
const a = L.indexOf('const NAV = ['), b = L.indexOf('\n    ];', a);
const NAV = vm.runInThisContext('(' + L.slice(a + 'const NAV = '.length, b + '\n    ]'.length) + ')');
const navItems = [];
NAV.forEach(g => g.items.forEach(it => navItems.push({ ...it, group: g.label, gid: g.id })));

/* 메뉴에서 뺐지만 파일은 살아 있는 화면 */
const RETIRED = new Set(['docs-preset.html', 'docs-exec.html', 'work-admin.html', 'work-dept.html',
    /* 2026-09-03 — 관리대상(구 기본정보) 대메뉴. base-targets 는 같은 날 되살렸다가
       **대시보드로 흡수**해 다시 뺐다 — 제안요청서가 요구한 것은 SFR-020 의 「원료·제조물
       개소 표시」이고 법령 어느 조문도 품목 대장을 명하지 않는다(§10 검증 6문 #2). */
    'base-targets.html', 'base-bulk.html', 'fac-sync.html', 'fac-settings.html',
    /* 2026-09-03 — 업무 관리는 이행 관리·문서 목록·내 할일 셋 안에서 끝낸다.
       기준문서함과 그 문서 상세는 메뉴에서 뺐다. */
    'docs-archive.html', 'doc-detail.html']);
/* 없어진 대메뉴 이름 — 링크 문구에 남으면 사용자가 찾을 수 없는 곳을 찾는다 */
const DEAD_MENU_TEXT = ['업무문서 >', '업무문서 &gt;', '시설물 안전관리', '예산관리 >', '(구)업무관리',
    '기본정보 >', '기본정보 &gt;', '시설물 관리 >', '시설물 관리 &gt;'];
/* 메뉴에서 뺀 «화면 이름» — 파일명 없이 이름만 적어도 사용자는 메뉴에서 그것을 찾는다.
   2026-09-03 실측: 이행점검이 «원문은 기준문서함에서 관리하고» 라고 안내하고 있었는데
   링크가 아니어서 어느 검사에도 걸리지 않았다. 대메뉴 이름(DEAD_MENU_TEXT)만으로는
   중메뉴가 없어진 경우를 못 잡는다. */
const GONE_SCREENS = ['관리대상 현황', '데이터 일괄등록', 'FMS 연계', '연계 설정', '기준문서함',
    '업무 목록', '이행 목록', '업무 발행 관리', '부서 업무함'];
/* «그리로 보낸다»로 읽히는 문맥에서만 잡는다 — 이름을 말하는 것과 보내는 것은 다르다 */
const GO_CTX = /(에서 (관리|확인|조회|등록|처리|수신|찾|받|올|본|봅|하세요|여세요)|으?로 (이동|간다|갑니다|유도|안내)|을 (여세요|열어|보세요)|바로가기)/;
/* 같은 줄에 이 말이 있으면 «없어졌다»를 밝히는 서술이다.
   ※ 좁게 유지한다 — 2026-09-03 적대적 시험에서 '종전'·'메뉴에서' 를 넣어 두었더니
     «종전 방식대로 기준문서함에서 관리합니다» 같은 **진짜 나쁜 문구가 통과**했다.
     면제어는 «메뉴에 없다»를 분명히 말하는 것만 둔다. */
const GONE_OK = ['메뉴 제외', '이전 버전', '은퇴', '2026-09-03', '2026-08-28'];
/* 폐기된 조회 파라미터 */
/* 폐기된 조회 파라미터 — 'tab=' 로 뭉뚱그리지 말 것(살아 있는 admin-law.html?tab=map 오탐) */
const DEAD_PARAM = ['ver=v2', 'tab=biz', 'tab=facility'];
/* 도달 불가가 «의도된» 화면 — 리다이렉트 스텁·소비처 없는 화면·은퇴 화면 */
const REACH_OK = new Set([
    'admin-law-map.html',   /* 법령 관리 매핑 탭 리다이렉트 스텁 — 외부 북마크 호환 */
    'edu.html',             /* 이수현황 리다이렉트 스텁 */
    'rsk-my.html',          /* 소비처 없는 화면(CLAUDE.md §6) */
    ...RETIRED,             /* 은퇴 화면 — 주소로만 여는 것이 확정된 상태다 */
]);
/* 링크가 아니라 «돌아갈 곳 허용 목록»인 파일 — 은퇴 화면이 들어 있는 것이 정상이다
   (그 화면에서 왔으면 그 화면으로 돌아가야 한다)
   ※ 여기에 적는 것은 «업무 흐름의 링크가 아닌 파일»뿐이다. 업무 화면이 은퇴 화면으로
     보내는 링크를 이 목록으로 통과시키지 말 것 — 그러면 검사가 무의미해진다. */
const BACK_ALLOWLIST = new Set([
    'js/doc-upload.js',
    /* 정의서 뷰어(개발용) — «그 정의서가 정의하는 화면»을 여는 도구다. 은퇴 화면의
       정의서도 계속 유지하므로(SCR-DOC-001 등) 그 화면을 가리키는 것이 정상이다. */
    'js/screen-definitions.js',
    /* 세트 테이블 — 살아 있는 소비처가 없다(CLAUDE.md §5: menu.js 가 #pane-docs 를
       찾지 못해 늘 early return). 화면에 그려지지 않으므로 사용자가 도달하지 않는다. */
    'js/setlist.js',
]);
/* 데이터·매핑 파일 — 링크가 아니다 */
/* ※ 여기에 «데이터처럼 보이지만 이동 수단을 가진» 파일을 넣지 말 것 — 통째로 검사 밖이
   된다. 2026-09-03 에 js/help-center.js 를 뺐다: 도움말의 «자주 하는 일» 바로가기가
   실제 화면 이동인데(go: 'xxx.html') 그 13개가 한 번도 검사되지 않고 있었다. */
const DATA_FILES = new Set(['js/screen-defs-data.js', 'js/doc-history-data.js', 'js/law-map.js',
    'js/doc-taxonomy-data.js', 'js/doc-seed-2026.js', 'js/cmp-dept-docs.js', 'js/law-admin-seed.js',
    'js/law-plain.js', 'js/law-sync-seed.js', 'js/policy-open.js']);

const htmlFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
const jsFiles = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f);
const files = [...htmlFiles, ...jsFiles.filter(f => !DATA_FILES.has(f))];

/* 어느 화면이 그 모듈을 로드하는가 — 모듈의 «살아 있음»은 그것을 싣는 화면이 정한다 */
const loadedBy = {};
htmlFiles.forEach(h => (R(h).match(/src="\.\/(js\/[\w\-.]+\.js)"/g) || []).forEach(m => {
    const f = m.match(/js\/[\w\-.]+\.js/)[0];
    (loadedBy[f] = loadedBy[f] || []).push(h);
}));
/* 은퇴 화면에서만 쓰이는 모듈은 그 자체가 은퇴한 것이다 */
const isRetiredSide = (f) => RETIRED.has(f) ||
    (f.startsWith('js/') && (loadedBy[f] || []).length > 0 && (loadedBy[f] || []).every(h => RETIRED.has(h)));

/* layout.js 는 «메뉴 정의»와 «알림 링크»를 한 파일에 갖는다. 종전에는 파일 통째로
   검사에서 뺐는데, 그러면 알림 드롭다운의 링크(NTF_ITEMS — 사용자가 실제로 누르는
   링크)가 영영 검사되지 않는다. 2026-09-03 실측으로 확인된 사각지대다.
   뺄 것은 NAV 블록뿐이므로 그 **줄 범위만** 제외한다. */
const NAV_RANGE = (() => {
    const lines = L.split('\n');
    const s = lines.findIndex(l => l.includes('const NAV = ['));
    let e = s;
    for (let i = s; i < lines.length; i++) if (lines[i] === '    ];') { e = i; break; }
    return { s: s + 1, e: e + 1 };
})();
const isNavDef = (l) => l.from === 'js/layout.js' && l.line >= NAV_RANGE.s && l.line <= NAV_RANGE.e;

/* 링크 추출 — 주석 줄은 뺀다(설명문의 파일명은 링크가 아니다) */
const links = [];
files.forEach(f => R(f).split('\n').forEach((ln, idx) => {
    const t = ln.trim();
    if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return;
    let m; const rx = /['"`]([\w\-]+\.html(?:\?[^'"`\s]*)?)['"`]/g;
    while ((m = rx.exec(ln))) links.push({ from: f, line: idx + 1, target: m[1], ctx: t.slice(0, 240) });
}));

let fail = 0;
const ok = (m) => console.log('  ✓ ' + m);
const bad = (m) => { console.log('  ✗ ' + m); fail++; };
const at = (l) => l.from + ':' + l.line;

console.log('링크 정합 검사 — 파일 ' + files.length + ' · 링크 ' + links.length + '\n');

/* 1 */
const deadFile = [...new Set(links.map(l => l.target.split('?')[0]))].filter(f => !fs.existsSync(path.join(ROOT, f)));
deadFile.length ? bad('없는 파일로 가는 링크: ' + deadFile.join(', ')) : ok('링크 대상 파일 전건 실재');

/* 2 — 이번 사고의 본체 */
const toRetired = links.filter(l => RETIRED.has(l.target.split('?')[0])
    && !isRetiredSide(l.from) && !isNavDef(l) && !BACK_ALLOWLIST.has(l.from));
toRetired.length
    ? bad('살아 있는 화면 → 은퇴 화면 ' + toRetired.length + '건: ' + toRetired.map(at).join(', ')
        + ' — 사용자가 «이전 버전» 화면에 도착한다')
    : ok('살아 있는 화면에서 은퇴 화면으로 보내는 링크 없음');

/* 3 — «링크가 있는 줄»만 보면 놓친다. 2026-09-03 실측: 업무문서 투어의 안내 문구와
      이행점검의 «업무문서 > 이행문서» 안내가 그 줄에 .html 링크가 없어 통째로 검사
      밖이었다. 사용자에게 보이는 것은 링크가 아니라 **문구**이므로 파일 전체를 본다.
      주석 줄은 뺀다(왜 그렇게 바꿨는지 적은 설명까지 위반으로 잡으면 못 적는다). */
const staleLabel = [];
files.forEach(f => {
    if (isRetiredSide(f) || BACK_ALLOWLIST.has(f)) return;
    R(f).split('\n').forEach((ln, idx) => {
        const t = ln.trim();
        if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return;
        if (f === 'js/layout.js' && idx + 1 >= NAV_RANGE.s && idx + 1 <= NAV_RANGE.e) return;
        DEAD_MENU_TEXT.forEach(d => { if (ln.includes(d)) staleLabel.push({ from: f, line: idx + 1, d: d }); });
    });
});
staleLabel.length
    ? bad('없어진 대메뉴 이름이 화면 문구에 남음: '
        + staleLabel.map(l => at(l) + ' «' + l.d + '»').join(', '))
    : ok('화면 문구에 없어진 대메뉴 이름 없음');

/* 3-2 — 없어진 «화면 이름»을 가리키는 안내 문구 */
const goneName = [];
files.forEach(f => {
    if (isRetiredSide(f) || BACK_ALLOWLIST.has(f)) return;
    R(f).split('\n').forEach((ln, idx) => {
        const t = ln.trim();
        if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return;
        if (f === 'js/layout.js' && idx + 1 >= NAV_RANGE.s && idx + 1 <= NAV_RANGE.e) return;
        if (GONE_OK.some(w => ln.includes(w))) return;
        const hit = GONE_SCREENS.find(n => ln.includes(n) && GO_CTX.test(ln));
        if (hit) goneName.push({ from: f, line: idx + 1, d: hit });
    });
});
goneName.length
    ? bad('메뉴에서 뺀 화면 이름으로 보내는 문구: '
        + goneName.map(l => at(l) + ' «' + l.d + '»').join(', '))
    : ok('메뉴에서 뺀 화면 이름으로 보내는 문구 없음');

/* 4 */
const staleParam = links.filter(l => DEAD_PARAM.some(p => l.target.includes(p)));
staleParam.length
    ? bad('폐기된 조회 파라미터 사용: ' + staleParam.map(at).join(', '))
    : ok('폐기된 조회 파라미터 없음');

/* 5 */
const visible = new Set(navItems.filter(it => !it.hidden).map(it => (it.href || '').split('?')[0]).filter(Boolean));
const inbound = {};
links.forEach(l => { const t = l.target.split('?')[0]; if (t !== l.from && !isNavDef(l)) (inbound[t] = inbound[t] || new Set()).add(l.from); });
const orphan = htmlFiles.filter(f => !/^(onepager|screen-definitions)/.test(f))
    .filter(f => !visible.has(f) && !(inbound[f] && inbound[f].size) && !REACH_OK.has(f));
orphan.length
    ? bad('메뉴에도 없고 어디서도 링크하지 않는 화면: ' + orphan.join(', ')
        + ' — 의도한 것이면 REACH_OK 에 사유와 함께 적는다')
    : ok('의도치 않은 도달 불가 화면 없음');

console.log(fail ? '\n✖ 위반 ' + fail + '건' : '\n✔ 링크 정합 6종 전건 통과');
process.exit(fail ? 1 : 0);
